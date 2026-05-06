# Paginate Before Fetching System Details

## Problem Statement

The `GET /v1/remediations/{id}/playbook_runs/{playbook_run_id}/systems` endpoint fetches **all** system details before applying pagination, causing performance issues when playbook runs have many systems.

**Jira:** RHINENG-TBD  
**Related:** RHINENG-25820 (optimized `formatRHCRuns` but not `formatRunHosts`)

**TODO Comment (line 152, controller.fifi.js):**
```javascript
// TODO: we should trim the systems list before gathering the details for each system and then trimming that
```

### Current Behavior

```javascript
// controller.fifi.js:109-169 (getSystems)
1. Fetch ALL RHC runs from playbook-dispatcher
2. combineHosts() → formatRunHosts():
   - Fetches ALL run_hosts from playbook-dispatcher API
   - Fetches system details (display_name, hostname) for ALL systems from DB
   - Formats ALL hosts
3. Apply pagination (limit/offset) ← TOO LATE!
4. Sort results
5. Return paginated subset
```

**Example:** `?limit=10` on a 1,000-system run: fetches 1,000 run_hosts, queries 1,000 system details, formats 1,000 objects, returns 10.

## Options

### Option 1: Dispatcher Native Pagination — Not Feasible

Pass limit/offset to playbook-dispatcher. Rejected because dispatcher can only sort by its own fields (status, updated_at) — it has no knowledge of our `display_name`/`hostname` values, so sorting by `system_name` is impossible.

### Option 2: In-Memory Optimization (Interim)

Fetch all run_hosts from dispatcher, apply filtering/sorting in memory, fetch system details only for the paginated subset.

- **Pro:** Minimal code changes; leverages existing RHINENG-25820 batched fetch
- **Con:** Still fetches all run_hosts on every request; sorting by `system_name` requires all system details first; O(n) performance degradation

Viable as a quick interim step; not ideal for production at scale.

### Option 3: Local Database Storage — Recommended ✅

**Core solution:** Maintain complete historical records of which dispatcher runs and systems belong to each playbook run in local tables (`dispatcher_runs.remediations_run_id` and `dispatcher_run_systems`). This enables:
1. SQL-based sorting and pagination (no need to fetch all systems before paginating)
2. Eliminating unnecessary playbook-dispatcher API calls (query local tables instead)

**Implementation:** Both tables are populated eagerly for new runs (at creation time) and backfilled on-demand for pre-existing runs (during user requests). A `dispatcher_runs_backfilled` boolean on `playbook_runs` tracks completion status.

- **Pro:** True SQL pagination (LIMIT/OFFSET returns exactly N rows); fast indexed sorting; `getPlanSystemsDetails` called for N systems only; eliminates dispatcher API call for resolving run IDs
- **Con:** DB schema changes + migrations; backfill logic for pre-existing runs

## Implementation (Option 3)

### Schema Changes Overview

**Before:**
```
┌─────────────────────────┐
│    playbook_runs        │
├─────────────────────────┤
│ • id (PK)               │
│ • remediation_id        │
│ • status                │
└───────────┬─────────────┘
            │
            │ 1:N
            ↓
┌─────────────────────────────┐
│     dispatcher_runs         │
├─────────────────────────────┤
│ • dispatcher_run_id (PK)    │
│ • remediations_run_id (FK)  │ ← Links to playbook_runs
└─────────────────────────────┘
            │
            │ No direct link to systems!
            │ Must fetch ALL run_hosts from
            │ playbook-dispatcher API to get
            │ system list → pagination happens
            │ after fetching all data
             
┌─────────────────────────┐
│       systems           │
├─────────────────────────┤
│ • id (PK)               │
│ • display_name          │
│ • hostname              │
└─────────────────────────┘
```

**After:**
```
┌─────────────────────────────────┐
│         playbook_runs           │
├─────────────────────────────────┤
│ • id (PK)                       │
│ • remediation_id                │
│ • status                        │
│ • dispatcher_runs_backfilled ──────┐ ← NEW: completeness flag
└───────────┬─────────────────────┘  │
            │                        │
            │ 1:N                    │ Tracks if dispatcher_runs
            ↓                        │ backfill is complete
┌─────────────────────────────────┐  │
│      dispatcher_runs            │  │
├─────────────────────────────────┤  │
│ • dispatcher_run_id (PK)        │  │
│ • remediations_run_id (FK)      │◄─┘
└───────────┬─────────────────────┘
            │
            │ 1:N
            ↓
┌────────────────────────────────────────────┐
│     dispatcher_run_systems (NEW)           │
├────────────────────────────────────────────┤
│ • dispatcher_run_id (PK, FK)               │ ← Historical record of
│ • system_id (PK, FK)                       │   which systems were in
│                                            │   each dispatcher run
│ Composite PK (dispatcher_run_id, system_id)│
└───────────┬────────────────────────────────┘
            │
            │ N:N
            ↓
┌─────────────────────────────────────┐
│           systems                   │
├─────────────────────────────────────┤
│ • id (PK)                           │
│ • display_name                      │
│ • hostname                          │
│ • system_name (GENERATED) ──────────┤ ← NEW: indexed generated column
│   = COALESCE(display_name, hostname)│   for fast sorting/filtering
└─────────────────────────────────────┘

Query Flow:
───────────
1. Check playbook_runs.dispatcher_runs_backfilled
   → If FALSE: fetch from dispatcher API, persist, mark TRUE
   → If TRUE: query local dispatcher_runs table

2. SQL JOIN: dispatcher_run_systems ⟗ systems
   → ORDER BY system_name (indexed!)
   → LIMIT/OFFSET (paginate in SQL!)
   → Returns exactly N system IDs

3. Fetch run_hosts from dispatcher for those N systems only
```

### Phase 1: Database Migrations

**Migration 1 — Add `system_name` generated column to `systems` table:**

```sql
ALTER TABLE systems
    ADD COLUMN system_name TEXT
    GENERATED ALWAYS AS (COALESCE(display_name, hostname)) STORED;

CREATE INDEX idx_systems_system_name ON systems(system_name);
```

**Note:** `GENERATED ALWAYS AS ... STORED` requires **PostgreSQL 12+**. The generated column is automatically maintained by PostgreSQL whenever `display_name` or `hostname` changes — no application code needed.

**Migration 2 — Create `dispatcher_run_systems` table:**

```sql
CREATE TABLE dispatcher_run_systems (
    dispatcher_run_id UUID NOT NULL
        REFERENCES dispatcher_runs(dispatcher_run_id) ON DELETE CASCADE,
    system_id UUID NOT NULL
        REFERENCES systems(id) ON DELETE CASCADE,
    PRIMARY KEY (dispatcher_run_id, system_id)
);

CREATE INDEX idx_dispatcher_run_systems_run
    ON dispatcher_run_systems(dispatcher_run_id);
```

**Migration 3 — Add backfill tracking to `playbook_runs` table:**

The `dispatcher_runs` table already has a `remediations_run_id` column that associates dispatcher runs with playbook runs.

Add backfill tracking to `playbook_runs`:
```sql
ALTER TABLE playbook_runs ADD COLUMN dispatcher_runs_backfilled BOOLEAN DEFAULT FALSE;
```

This boolean tracks whether we've completed the historical record for a given playbook run — new runs created after deployment will be marked `TRUE` immediately, old runs will be backfilled on-demand during user requests.

**Note:** Code examples use `remediations_run_id` for both the variable name and the `dispatcher_runs` column name. The term "playbook run" in function names (like `getDispatcherRunIdsByPlaybookRun`) refers to remediations playbook runs, not dispatcher playbook runs.

### Phase 2: Sequelize Model

**File:** `src/remediations/models/dispatcherRunSystems.js`

```javascript
'use strict';

module.exports = (sequelize, { UUID }) => {
    const DispatcherRunSystems = sequelize.define('dispatcher_run_systems', {
        dispatcher_run_id: {
            type: UUID,
            primaryKey: true,
            references: { model: 'dispatcher_runs', key: 'dispatcher_run_id' },
            onDelete: 'CASCADE'
        },
        system_id: {
            type: UUID,
            primaryKey: true,
            references: { model: 'systems', key: 'id' },
            onDelete: 'CASCADE'
        }
    }, {
        timestamps: false,
        tableName: 'dispatcher_run_systems'
    });

    DispatcherRunSystems.associate = models => {
        DispatcherRunSystems.belongsTo(models.dispatcher_runs, { foreignKey: 'dispatcher_run_id' });
        DispatcherRunSystems.belongsTo(models.systems, { foreignKey: 'system_id', as: 'system' });
    };

    return DispatcherRunSystems;
};
```

### Phase 3: Backfill and Query Functions

**Key principles:**
- `dispatcher_run_systems` is the historical record of which systems were part of each dispatched playbook run
- `dispatcher_runs.remediations_run_id` is the historical record of which dispatcher runs belong to each playbook run
- Both tables were not originally populated for old runs — we backfill them on-demand during user requests
- New runs populate these tables eagerly at creation time

**Note:** Code examples use `remediationsRunId` as the variable/parameter name to match the column name `remediations_run_id` in the `dispatcher_runs` table. This avoids ambiguity between dispatcher playbook runs and remediations playbook runs.

**Layer split:**
- **`src/remediations/remediations.queries.js`** — DB operations: backfill status checks, dispatcher run ID lookups, paginated JOIN query
- **`src/remediations/fifi.js`** — orchestration: resolve dispatcher run IDs, trigger backfills (calls dispatcher connector, so cannot live in queries.js)

**File:** `src/remediations/remediations.queries.js`

```javascript
exports.isDispatcherRunsBackfilled = async function (remediationsRunId) {
    const run = await db.playbook_runs.findByPk(remediationsRunId, {
        attributes: ['dispatcher_runs_backfilled']
    });
    return run?.dispatcher_runs_backfilled ?? false;
};

exports.markDispatcherRunsBackfilled = async function (remediationsRunId) {
    await db.playbook_runs.update(
        { dispatcher_runs_backfilled: true },
        { where: { id: remediationsRunId } }
    );
};

exports.getDispatcherRunIdsByPlaybookRun = async function (remediationsRunId) {
    const runs = await db.dispatcher_runs.findAll({
        where: { remediations_run_id: remediationsRunId },
        attributes: ['dispatcher_run_id'],
        raw: true
    });
    return runs.map(r => r.dispatcher_run_id);
};

exports.dispatcherRunSystemsExist = async function (dispatcherRunIds) {
    const count = await db.dispatcher_run_systems.count({
        where: { dispatcher_run_id: dispatcherRunIds }
    });
    return count > 0;
};

exports.getDispatcherRunSystemsPage = async function (dispatcherRunIds, options = {}) {
    const { limit = 50, offset = 0, sortAsc = true, hostnameFilter = null } = options;
    const sortDir = sortAsc ? 'ASC' : 'DESC';

    const systemInclude = {
        model: db.systems,
        as: 'system',
        attributes: ['id', 'system_name'],
        required: false
    };

    // ansible_host filter maps to system_name ILIKE on the indexed generated column
    if (hostnameFilter) {
        systemInclude.where = { system_name: { [db.Sequelize.Op.iLike]: `%${hostnameFilter}%` } };
        systemInclude.required = true;
    }

    const result = await db.dispatcher_run_systems.findAndCountAll({
        where: { dispatcher_run_id: dispatcherRunIds },
        include: [systemInclude],
        order: [[{ model: db.systems, as: 'system' }, 'system_name', sortDir]],
        limit,
        offset,
        raw: false
    });

    return {
        systems: result.rows.map(row => ({
            system_id: row.system_id,
            system_name: row.system?.system_name ?? row.system_id
        })),
        total: result.count
    };
};
```

**File:** `src/remediations/fifi.js`

```javascript
exports.backfillDispatcherRuns = async function (remediationsRunId) {
    trace.enter('fifi.backfillDispatcherRuns');

    // Fetch dispatcher runs from playbook-dispatcher API
    const dispatcherRuns = await exports.getRHCRuns(remediationsRunId);
    if (!dispatcherRuns?.data?.length) {
        trace.leave('No dispatcher runs found in playbook-dispatcher');
        return [];
    }

    const dispatcherRunIds = dispatcherRuns.data.map(r => r.id);

    // Persist dispatcher run → playbook run associations
    const records = dispatcherRunIds.map(dispatcher_run_id => ({
        remediations_run_id: remediationsRunId,
        dispatcher_run_id
        // Note: if dispatcher_runs table has other columns from the response, map them here
    }));

    await db.dispatcher_runs.bulkCreate(records, { ignoreDuplicates: true });
    await queries.markDispatcherRunsBackfilled(remediationsRunId);

    trace.event(`Backfilled ${dispatcherRunIds.length} dispatcher runs`);
    trace.leave();
    return dispatcherRunIds;
};

exports.resolveDispatcherRunIds = async function (remediationsRunId) {
    trace.enter('fifi.resolveDispatcherRunIds');

    // Check if we've completed the historical record for this playbook run
    if (await queries.isDispatcherRunsBackfilled(remediationsRunId)) {
        const dispatcherRunIds = await queries.getDispatcherRunIdsByPlaybookRun(remediationsRunId);
        trace.event(`Found ${dispatcherRunIds.length} dispatcher runs in local table`);
        trace.leave();
        return dispatcherRunIds;
    }

    // Historical record is incomplete — backfill from playbook-dispatcher
    trace.event('dispatcher_runs not backfilled — fetching from playbook-dispatcher');
    const dispatcherRunIds = await exports.backfillDispatcherRuns(remediationsRunId);
    trace.leave();
    return dispatcherRunIds;
};

exports.populateDispatcherRunSystems = async function (remediationsRunId) {
    trace.enter('fifi.populateDispatcherRunSystems');

    // Use local dispatcher_runs table when available (already backfilled)
    const dispatcherRunIds = await exports.resolveDispatcherRunIds(remediationsRunId);
    if (!dispatcherRunIds.length) {
        trace.leave('No dispatcher runs found');
        return;
    }

    const runHostsFilter = createDispatcherRunHostsFilter(remediationsRunId);
    const allRunHosts = await dispatcher.fetchPlaybookRunHosts(runHostsFilter, RHCRUNFIELDS);
    if (!allRunHosts?.data?.length) {
        trace.leave('No run_hosts found');
        return;
    }

    const records = allRunHosts.data
        .filter(host => host.run?.id && host.inventory_id)
        .map(host => ({ dispatcher_run_id: host.run.id, system_id: host.inventory_id }));

    await db.dispatcher_run_systems.bulkCreate(records, { ignoreDuplicates: true });
    trace.event(`Populated ${records.length} dispatcher_run_systems rows`);
    trace.leave();
};

exports.getDispatcherRunSystems = async function (remediationsRunId, options = {}) {
    trace.enter('fifi.getDispatcherRunSystems');

    // Resolve dispatcher run IDs from local table (backfills if needed)
    const dispatcherRunIds = await exports.resolveDispatcherRunIds(remediationsRunId);

    if (dispatcherRunIds.length === 0) {
        trace.leave('No dispatcher runs found');
        return { systems: [], total: 0 };
    }

    // On-demand backfill of dispatcher_run_systems if needed
    if (!await queries.dispatcherRunSystemsExist(dispatcherRunIds)) {
        trace.event('No rows in dispatcher_run_systems — populating from dispatcher');
        await exports.populateDispatcherRunSystems(remediationsRunId);
    }

    const result = await queries.getDispatcherRunSystemsPage(dispatcherRunIds, options);
    trace.leave();
    return result;
};
```

### Phase 4: Update Controller

**File:** `src/remediations/controller.fifi.js:109-169`

New `getSystems` flow:
1. SQL JOIN of `dispatcher_run_systems` with `systems`, sorted by `system_name`, paginated → `{ systems: [{ system_id, system_name }], total }`
2. Fetch all run_hosts from dispatcher (single batched call, RHINENG-25820)
3. Index dispatcher response by `inventory_id`
4. Merge paginated systems with status from dispatcher index
5. Format and return

```javascript
exports.getSystems = errors.async(async function (req, res) {
    trace.enter('fifi.getSystems');

    const {column, asc} = format.parseSort(req.query.sort);
    const {limit, offset} = req.query;

    const remediation = await queries.getRunDetails(
        req.params.id,
        req.params.playbook_run_id,
        req.user.tenant_org_id,
        req.user.username
    );

    if (!remediation) {
        trace.leave('Playbook run not found or not authorized');
        return notFound(res);
    }

    trace.event('Fetch paginated system list from dispatcher_run_systems...');
    const { systems, total } = await fifi.getDispatcherRunSystems(req.params.playbook_run_id, {
        limit, offset, sortAsc: asc, hostnameFilter: req.query.ansible_host
    });

    if (total > 0 && offset >= total) {
        throw errors.invalidOffset(offset, total);
    }

    trace.event('Fetch run_hosts from dispatcher...');
    const rhcRuns = await fifi.getRHCRuns(req.params.playbook_run_id);
    const runHostsFilter = createDispatcherRunHostsFilter(req.params.playbook_run_id);
    const allRunHosts = await dispatcher.fetchPlaybookRunHosts(runHostsFilter, RHCRUNFIELDS);

    const runHostsBySystemId = _.keyBy(allRunHosts?.data ?? [], 'inventory_id');
    const runsMap = _.keyBy(rhcRuns?.data ?? [], 'id');

    const pageSystems = systems.map(({ system_id, system_name }) => {
        const runHost = runHostsBySystemId[system_id] ?? {};
        const run = runsMap[runHost.run?.id] ?? {};
        const isDirect = (runHost.host === 'localhost');
        return {
            system_id,
            system_name,
            status: runHost.status === 'timeout' ? 'failure' : (runHost.status ?? 'pending'),
            updated_at: run.updated_at,
            playbook_run_executor_id: isDirect ? req.params.playbook_run_id : runHost.run?.id,
            executor_type: isDirect ? 'direct' : 'satellite'
        };
    });

    trace.leave();
    res.status(200).send(format.playbookSystems(pageSystems, total));
});
```

### Phase 4b: Populate at Run Creation

**When playbook run is created** (after successful dispatch to playbook-dispatcher):

```javascript
// After dispatching to playbook-dispatcher, the response contains dispatcher run data
const dispatcherRunIds = dispatchResponse.data.map(r => r.id);

// 1. Populate dispatcher_runs table (complete historical record)
const dispatcherRunRecords = dispatcherRunIds.map(dispatcher_run_id => ({
    remediations_run_id: remediationsRunId,
    dispatcher_run_id
    // Add other fields from dispatchResponse.data if needed by dispatcher_runs schema
}));

await db.dispatcher_runs.bulkCreate(dispatcherRunRecords, { ignoreDuplicates: true });
await queries.markDispatcherRunsBackfilled(remediationsRunId);

// 2. Populate dispatcher_run_systems asynchronously (non-blocking)
fifi.populateDispatcherRunSystems(remediationsRunId).catch(err => {
    log.error({ err, playbook_run_id: remediationsRunId }, 'Failed to populate dispatcher_run_systems');
    // Non-critical — on-demand fallback will handle it on first GET request
});
```

New runs created after deployment will have complete historical records from creation. Old runs will be backfilled on-demand during user requests.

### Phase 5: Cleanup

`ON DELETE CASCADE` on both FKs handles cleanup automatically when runs or systems are deleted.

## Handling Pre-existing Runs

**Why backfill migrations are not feasible:**
- Playbook-dispatcher is multi-tenant with its own authentication — no non-tenant-specific way to retrieve historical data
- Playbook-dispatcher has a data retention policy — older data may not be available
- Historical volume makes bulk backfill impractical

**On-demand backfill strategy:**
Both `dispatcher_runs` and `dispatcher_run_systems` use on-demand backfills triggered by user requests:

1. **First request** for a pre-existing playbook run triggers backfills:
   - `resolveDispatcherRunIds` checks `dispatcher_runs_backfilled` flag
   - If `FALSE`, fetches from playbook-dispatcher API (authenticated with user's tenant context)
   - Persists to `dispatcher_runs` table and marks `dispatcher_runs_backfilled = TRUE`
   - Then checks `dispatcher_run_systems` and populates if needed

2. **Subsequent requests** use local tables:
   - `dispatcher_runs_backfilled = TRUE` → query local `dispatcher_runs` table (no dispatcher API call)
   - `dispatcher_run_systems` populated → query local table with SQL pagination

3. **Retention window expired:** If dispatcher has no data for a very old run, the backfill returns empty and the endpoint serves an empty result (acceptable — data is genuinely unavailable).

## Alternative: In-Memory Optimization (Option 2)

If time-constrained, this can land before the DB table as an interim improvement.

### Updated `formatRunHosts` signature

```javascript
exports.formatRunHosts = async function (dispatcherRuns, playbook_run_id, options = {}) {
    // options: { limit, offset, sortColumn, sortAsc, hostnameFilter }
}
```

**Logic:**
- For `system_name` sort: fetch all system details → sort full list → paginate
- For other sorts (status, updated_at, executor_type): sort run_hosts in memory → paginate → fetch system details only for paginated subset

### Updated `getSystems` controller

```javascript
const result = await fifi.formatRunHosts(rhcRuns, req.params.playbook_run_id, {
    limit, offset, sortColumn: column, sortAsc: asc, hostnameFilter: req.query.ansible_host
});
const formatted = format.playbookSystems(result.hosts, result.total);
```

Remove `combineHosts` (logic moves into `formatRunHosts`), remove the separate pagination/sort steps.

## Risks & Mitigations

**Dispatcher retention limits fallback data:** Pre-existing runs with expired retention windows will return empty results. Accept this — log a warning when fallback returns empty, document the behavior.

**Hostname filter misses systems with no `systems` row:** Systems deleted before soft-delete is implemented have no matching row; the LEFT JOIN returns NULL and ILIKE won't match them. Document the edge case; uncommon in practice.

**Regression:** Mitigated by unit + integration tests and monitoring during rollout.

**Partial backfill failures:** If `backfillDispatcherRuns` succeeds but `populateDispatcherRunSystems` fails (either synchronously or asynchronously), the system self-heals on the next request:
- `dispatcher_runs_backfilled = TRUE` means `resolveDispatcherRunIds` will query the local table (no retry of `backfillDispatcherRuns`)
- `getDispatcherRunSystems` checks `dispatcherRunSystemsExist` independently
- If no rows found, `populateDispatcherRunSystems` is called again (idempotent via `ignoreDuplicates: true`)
- Edge case: if `dispatcher_runs` bulkCreate fails after the flag is set, `resolveDispatcherRunIds` returns empty array → `getDispatcherRunSystems` returns empty result. This is acceptable because it indicates a database consistency issue that requires investigation, not a transient failure.

**Recommendation:** Add error telemetry to track backfill failures and monitor self-healing recovery on subsequent requests.

**Concurrent requests:** Multiple simultaneous requests for the same `remediationsRunId` may trigger duplicate backfill operations:
- Both see `dispatcher_runs_backfilled = FALSE` → both call `backfillDispatcherRuns`
- Both see empty `dispatcher_run_systems` → both call `populateDispatcherRunSystems`
- Duplicate work is wasteful (redundant dispatcher API calls) but safe:
  - `bulkCreate(..., { ignoreDuplicates: true })` prevents duplicate rows
  - `markDispatcherRunsBackfilled` is idempotent (sets same boolean to TRUE)
  - Last write wins for the flag (same result regardless of order)

**Mitigation options:**
1. *Accept the race* (recommended for initial implementation): Duplicate backfills are rare (only on first request for old runs) and self-limiting (flag prevents future duplicates). Monitor dispatcher API call patterns to confirm.
2. *Add in-memory deduplication guard* (if monitoring shows excessive duplicate work): Maintain a `Map<remediationsRunId, Promise>` of pending backfills. Before starting a backfill, check if one is already in progress and await the same promise. Clear the map entry when the promise settles.

```javascript
// Example deduplication guard (optional)
const pendingBackfills = new Map();

exports.resolveDispatcherRunIds = async function (remediationsRunId) {
    if (await queries.isDispatcherRunsBackfilled(remediationsRunId)) {
        return await queries.getDispatcherRunIdsByPlaybookRun(remediationsRunId);
    }

    // Check for in-flight backfill
    if (pendingBackfills.has(remediationsRunId)) {
        return await pendingBackfills.get(remediationsRunId);
    }

    // Start new backfill and cache the promise
    const backfillPromise = exports.backfillDispatcherRuns(remediationsRunId)
        .finally(() => pendingBackfills.delete(remediationsRunId));
    
    pendingBackfills.set(remediationsRunId, backfillPromise);
    return await backfillPromise;
};
```

Database-level locking (SELECT FOR UPDATE) is not recommended because:
- Adds transaction overhead and potential lock contention
- Duplicate work is rare and self-limiting
- Application-level deduplication is simpler and sufficient if needed

## Future Enhancements

### Soft-Delete Systems (Preserves Historical Records)

`remediations-consumer` currently hard-deletes from `systems` on inventory delete events, which would cascade-delete `dispatcher_run_systems` rows and break historical run lookups. Add a `deleted_at` column and change the consumer to soft-delete instead:

```sql
ALTER TABLE systems ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
CREATE INDEX idx_systems_deleted_at ON systems(deleted_at) WHERE deleted_at IS NULL;
```

Extend the existing cleaner job to hard-delete soft-deleted systems that have no remaining `dispatcher_run_systems` references:

```sql
DELETE FROM systems
WHERE deleted_at IS NOT NULL
  AND id NOT IN (SELECT DISTINCT system_id FROM dispatcher_run_systems);
```

Use manual `deleted_at` (not Sequelize `paranoid: true`) since `remediations-consumer` uses Knex and would need explicit handling regardless. Also update `storeSystemDetails()` to upsert (clear `deleted_at`) rather than `ignoreDuplicates: true` to handle system re-registration.

### Full-Text Search

With `system_name` already an indexed generated column, ILIKE is already efficient. For very large deployments, add a GIN index:

```sql
ALTER TABLE systems ADD COLUMN system_name_tsvector TSVECTOR
    GENERATED ALWAYS AS (to_tsvector('simple', COALESCE(system_name, ''))) STORED;

CREATE INDEX idx_systems_system_name_search ON systems USING GIN(system_name_tsvector);
```

## Deployment

1. Run migration: add `system_name` generated column + index to `systems`
2. Run migration: create `dispatcher_run_systems` table
3. Run migration: add `dispatcher_runs_backfilled` boolean to `playbook_runs`
4. Deploy code
5. No bulk backfill — on-demand backfills handle pre-existing runs during user requests
6. Monitor `/playbook_runs/{id}/systems` response time and `getPlanSystemsDetails` query counts

## Acceptance Criteria

### Schema
- [ ] `dispatcher_run_systems`: composite PK `(dispatcher_run_id, system_id)`, no other columns
- [ ] FKs with ON DELETE CASCADE to both `dispatcher_runs` and `systems`
- [ ] Index on `dispatcher_run_id`
- [ ] `systems.system_name` generated column with `idx_systems_system_name` index
- [ ] `dispatcher_runs.remediations_run_id` column exists with FK to `playbook_runs.id` and index
- [ ] `playbook_runs.dispatcher_runs_backfilled` boolean column (default FALSE)
- [ ] Sequelize model with associations

### Historical Record Completeness (dispatcher_runs)
- [ ] `backfillDispatcherRuns()` fetches from playbook-dispatcher, persists to `dispatcher_runs`, and marks `dispatcher_runs_backfilled = TRUE`
- [ ] `resolveDispatcherRunIds()` checks `dispatcher_runs_backfilled` flag first
- [ ] If `TRUE`, query local `dispatcher_runs` table (no dispatcher API call)
- [ ] If `FALSE`, call `backfillDispatcherRuns()` to complete the historical record
- [ ] New playbook runs populate `dispatcher_runs` at creation and mark `dispatcher_runs_backfilled = TRUE` immediately
- [ ] Pre-existing runs backfilled on-demand during first user request

### Historical Record Completeness (dispatcher_run_systems)
- [ ] `populateDispatcherRunSystems()` inserts only `(dispatcher_run_id, system_id)` pairs
- [ ] New playbook runs populate `dispatcher_run_systems` at creation (async, non-blocking)
- [ ] `ignoreDuplicates: true` prevents errors on double-population
- [ ] On-demand fallback populates when no rows exist for a run
- [ ] Graceful fallback when dispatcher has no data (retention window passed)

### API
- [ ] `GET /playbook_runs/{id}/systems` paginates via SQL JOIN (single query)
- [ ] `limit=10` results in exactly 10 system_ids resolved from DB; dispatcher and `getPlanSystemsDetails` called for those 10 only
- [ ] Sorting by `system_name` uses `ORDER BY system_name` on the indexed column
- [ ] `ansible_host` filter works as `system_name ILIKE` on the same index
- [ ] RHC direct systems return real `display_name`/`hostname` instead of `"localhost"`
- [ ] No breaking changes to response format
- [ ] Offset validation works correctly

### Testing
- [ ] All existing tests pass
- [ ] Unit tests: `backfillDispatcherRuns` (backfill tracking, marks flag correctly)
- [ ] Unit tests: `resolveDispatcherRunIds` (uses local table when backfilled, calls backfill when not)
- [ ] Unit tests: `populateDispatcherRunSystems`, `getDispatcherRunSystems` (pagination, sorting, fallback, empty dispatcher response)
- [ ] Integration tests: end-to-end backfill → populate → SQL paginate → filter dispatcher → format
- [ ] Performance tests confirm improvement for large runs (1000+ systems)
- [ ] Test pre-existing run: first request triggers backfills, second request uses local tables
- [ ] Test new run: created with backfilled flag TRUE, no dispatcher API call on GET

## Related Work

- **RHINENG-25820:** Batched run_hosts fetch from dispatcher (completed)
- **RHINENG-3d8cf010:** Single-query `getRunHostDetails` (completed)
- **This work:** `dispatcher_run_systems` table for true SQL pagination