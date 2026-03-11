# AsyncLocalStorage Migration Plan

This document outlines the minimal changes needed to switch from `cls-hooked` / `express-http-context` to Node.js built-in `AsyncLocalStorage`.

## Summary

- **Files to modify:** 2
- **Lines changed:** ~20
- **No changes needed to:** Connectors, controllers, handlers, resolvers, tests

---

## File 1: `src/util/cls.js`

### BEFORE (current):
```javascript
'use strict';

const httpContext = require('express-http-context');

const P = require('bluebird');
const sequelize = require('sequelize');
const clsBluebird = require('cls-bluebird');
clsBluebird(httpContext.ns, P);
sequelize.useCLS(httpContext.ns);

exports.middleware = function (req, res, next) {
    httpContext.set('req', req);
    next();
};

exports.getReq = function () {
    return httpContext.get('req');
};

exports.patchMiddleware = function (fn) {
    return function (req, res, next) {
        return fn(req, res, httpContext.ns.bind(next));
    };
};
```

### AFTER (AsyncLocalStorage):
```javascript
'use strict';

const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

// NOTE: Removed sequelize.useCLS() - not needed because we pass transactions explicitly
// NOTE: Removed cls-bluebird - not needed with AsyncLocalStorage

exports.middleware = function (req, res, next) {
    asyncLocalStorage.run({ req }, next);
};

exports.getReq = function () {
    const store = asyncLocalStorage.getStore();
    return store ? store.req : undefined;
};

exports.patchMiddleware = function (fn) {
    // AsyncLocalStorage automatically propagates context - no manual binding needed
    return fn;
};
```

---

## File 2: `src/routes.js`

### BEFORE (current):
```javascript
// Line 8
const httpContext = require('express-http-context');

// Lines 66-67
app.use(httpContext.middleware);
app.use(cls.middleware);
```

### AFTER:
```javascript
// Line 8 - REMOVE THIS LINE
// const httpContext = require('express-http-context');

// Lines 66-67 - REMOVE httpContext.middleware, keep cls.middleware
// app.use(httpContext.middleware);  // DELETE THIS LINE
app.use(cls.middleware);              // KEEP THIS LINE
```

---

## Packages that can be removed from package.json (optional, can do later):

```json
{
  "dependencies": {
    "cls-bluebird": "...",        // Can remove
    "express-http-context": "..."  // Can remove
  }
}
```

Note: Keep these packages for now until you verify everything works. Remove in a follow-up PR.

---

## Why this works:

1. **AsyncLocalStorage is built into Node.js** (since v12.17) - no external package needed
2. **Works with native Promises** - compatible with axios
3. **`cls.getReq()` still works** - same API, different implementation
4. **Sequelize doesn't need CLS** - your code already passes `{transaction}` explicitly (see verification below)
5. **No connector/controller changes needed** - they keep calling `this.getForwardedHeaders()` which calls `cls.getReq()` internally

---

## Verification: Sequelize transactions are passed explicitly

The `sequelize.useCLS()` feature auto-binds transactions to queries within a transaction callback. However, this codebase **does not rely on it** - all transactions are passed explicitly.

### Transaction blocks and their operations:

| Location | Operations | Transaction passed? |
|----------|-----------|---------------------|
| `exports.create` (L167) | `db.remediation.create`, `storeNewActions` | ✓ Yes |
| `exports.patch` (L210) | `db.remediation.findOne`, `storeNewActions`, `.save` | ✓ Yes |
| `exports.patchIssue` (L263) | `db.issue.findOne`, `.save`, `remediationUpdated` | ✓ Yes |
| `findAndDestroy` (L313) | `findOne`, `.destroy`, `remediationUpdated` | ✓ Yes |
| `findAllAndDestroy` (L334) | `findAll`, `.destroy`, `remediationUpdated` | ✓ Yes |

### Helper functions that receive transaction:

- `storeNewActions(remediation, add, transaction)` - all db operations pass `{transaction}`
- `remediationUpdated(req, transaction)` - passes `{transaction}` to its update

### Operations outside transactions (no transaction needed):

These are single atomic operations that don't require transactional consistency:

- `insertRHCPlaybookRun` - single create
- `insertDispatcherRuns` - single bulkCreate  
- `updateDispatcherRuns` - single update
- `storePlaybookDefinition` - single create

### Files checked:

- `src/remediations/controller.write.js` - all transaction blocks verified
- `src/remediations/remediations.queries.js` - no transactions (single operations)
- `src/generator/generator.controller.js` - no transactions (single operations)
- `src/admin/admin.controller.js` - no transactions

**Conclusion:** Removing `sequelize.useCLS()` is safe - it was never being relied upon

---

## Testing:

After making these changes:
1. Run the test suite: `npm test`
2. Verify HTTP context is available in connectors (headers are forwarded correctly)
3. Verify database transactions still work (they use explicit `{transaction}` already)

---

## Comparison with explicit `req` passing approach:

| Approach | Files Changed | Complexity |
|----------|---------------|------------|
| AsyncLocalStorage | ~2 files | Simple |
| Explicit `req` passing | ~50+ files | Complex but more explicit |

Both approaches work. AsyncLocalStorage is simpler but keeps implicit context.
Explicit `req` passing is more work but results in cleaner architecture.
