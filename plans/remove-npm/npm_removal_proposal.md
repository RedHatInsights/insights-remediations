# Proposal: Remove npm from Production Container Images

**Date:** 2026-04-08  
**Author:** Rex White  
**Status:** Proposal

## Executive Summary

Remove the `npm` package manager from production container images to reduce attack surface while maintaining all functionality. This change affects only the runtime images; build processes remain unchanged.

## Background

Currently, npm is installed in the base image and included in all derived images (build, test, dist). However, analysis shows:

- **Application runtime** (`node src/app.js`): Does not use npm
- **Runtime code**: No `npm` or `npx` commands in `src/`
- **InitContainer migrations**: Uses npm only as a script runner (`npm run db:migrate`)

The only production usage of npm is as a convenience wrapper around `sequelize-cli` commands in the initContainer.

## Motivation

### Security Benefits

1. **Reduced Attack Surface**
   - npm has had multiple CVEs (e.g., CVE-2023-46809, CVE-2022-29244)
   - Removing npm eliminates an entire class of potential vulnerabilities
   - Fewer binaries for security scanners to analyze

2. **Principle of Least Privilege**
   - Production containers should only contain what's needed to run
   - Package managers are development/build-time tools

### Operational Benefits

1. **Smaller Image Size**: Save ~15-20MB
2. **Faster Security Scans**: Fewer components to analyze
3. **Clearer Intent**: Image contents match runtime needs

## Proposed Solution

**Approach:** Single production image without npm, used by both main container and initContainer.

**Architecture:**
- Single production image used by both main container and initContainer
- Remove npm from production base image
- Keep sequelize-cli in node_modules (needed for migrations)
- Call sequelize-cli directly instead of via `npm run`

**Benefits:**
- ✅ Simple: No deployment manifest changes required
- ✅ Low risk: Single image to build and manage
- ✅ Achieves primary goal: Removes npm from production
- ✅ Fast to implement: Minimal changes
- ✅ Easy rollback: Revert Dockerfile + config changes

**Trade-offs:**
- ⚠️ Runtime container includes sequelize-cli (unused, ~2MB)
- ⚠️ Runtime container includes migration files from db/
- These are acceptable trade-offs for simplicity and low risk

**Image Contents:**
```
Runtime Container:
├── node (nodejs binary) ✓
├── jq ✓
├── shadow-utils ✓
├── src/ (application code) ✓
├── db/ (migrations) ⚠️ unused at runtime
└── node_modules/
    ├── sequelize (ORM) ✓
    ├── sequelize-cli (migrations) ⚠️ unused at runtime
    └── ... (production dependencies) ✓

InitContainer (same image):
├── node ✓
├── jq ✓
├── db/ (migrations) ✓
└── node_modules/
    ├── sequelize-cli ✓
    └── ... ✓
```

**Deployment Changes:**
- Update migration commands in values-*.yaml files
- No changes to deployment manifests

**Estimated Savings:**
- Image size: -15-20MB (npm removed)
- Security: Eliminate npm CVEs
- Complexity: No additional complexity

## Implementation Details

### Phase 1: Update Dockerfile

Modify `build/Dockerfile` to create two base images:

```dockerfile
#----------------------- base (with npm for building) -----------------------
FROM registry.access.redhat.com/ubi9/ubi-minimal:9.7-1773939694 AS base

RUN microdnf module enable -y nodejs:22 && \
    microdnf install -y shadow-utils jq nodejs npm --nodocs && \
    microdnf upgrade -y && \
    microdnf clean all

# ... rest of base setup ...

#----------------------- prod-base (no npm) -----------------------
FROM registry.access.redhat.com/ubi9/ubi-minimal:9.7-1773939694 AS prod-base

RUN microdnf module enable -y nodejs:22 && \
    microdnf install -y shadow-utils jq nodejs --nodocs && \
    microdnf upgrade -y && \
    microdnf clean all

# ... same setup as base but without npm ...

#---------------------- build (uses base with npm) -----------------------
FROM base AS build

# ... existing build steps ...

#----------------------- test (uses base with npm) -----------------------
FROM base AS test

# ... existing test steps ...

#----------------------- dist (uses prod-base without npm) -----------------------
FROM prod-base AS dist

COPY --from=build $APP_ROOT/dist ./
COPY --from=build $APP_ROOT/node_modules ./node_modules

# Note: No npm commands here, just copy built artifacts
```

### Phase 2: Update Migration Commands

Update deployment configuration files to call `sequelize` CLI directly instead of via `npm run`:

**Files to update:**
- `deployment/chart/values-ci.yaml`
- `deployment/chart/values-qa.yaml`
- `deployment/chart/values-prod.yaml`

**IMPORTANT - External Configuration:**

The `${MIGRATION_COMMAND}` variable in `deployment/clowdapp.yml` is populated from the **app-interface** repository, not from this codebase. The actual migration command values are defined in:

- **Repository:** `https://gitlab.cee.redhat.com/service/app-interface`
- **File:** `data/services/insights/remediations/deploy-clowder.yml`
- **Reference:** [commit 589010f](https://gitlab.cee.redhat.com/service/app-interface/-/blob/589010f48d9266b3eed9ebf5c3c0123ab51d5751/data/services/insights/remediations/deploy-clowder.yml)

This external configuration must be updated in addition to the local values files.

**Changes:**

```yaml
# OLD (uses npm):
migrationCommand: "npm run db:create; npm run db:migrate"
migrationCommand: "npm run db:init && npm run db:migrate && npm run db:seed"

# NEW (calls sequelize directly):
migrationCommand: "node_modules/.bin/sequelize db:create; node_modules/.bin/sequelize db:migrate"
migrationCommand: "node_modules/.bin/sequelize db:drop; node_modules/.bin/sequelize db:create && node_modules/.bin/sequelize db:migrate && node_modules/.bin/sequelize db:seed:all"
```

### Phase 3: Update dist Stage Build Commands

Remove `npm ci --omit=dev` from the dist stage since we're copying pre-built `node_modules` from build stage:

**Current (line 64):**
```dockerfile
FROM base AS dist
COPY --from=build $APP_ROOT/dist ./
RUN npm ci --omit=dev && npm cache clean --force
RUN npx clean-modules -y
```

**Proposed:**
```dockerfile
FROM prod-base AS dist
COPY --from=build $APP_ROOT/dist ./
COPY --from=build $APP_ROOT/node_modules ./node_modules
```

**Rationale:**
- Build stage already runs `npm ci`, builds, and cleans modules
- Dist stage should just copy the production-ready artifacts
- No need to reinstall dependencies in dist stage

## What Stays the Same

### Build Process (Unchanged)
- Build stage still has npm
- Still runs `npm ci`, `npm run build`, `npx clean-modules`
- Build artifacts remain identical

### Test Process (Unchanged)
- Test stage still has npm
- Still runs `npx npm run test:ci`
- All test commands work as before

### Application Runtime (Unchanged)
- Main container CMD: `node src/app.js` (never used npm)
- Application code unchanged
- No code changes required

### Dependencies (Unchanged)
- `sequelize-cli` stays in dependencies
- `node_modules` content identical
- Same production dependencies

## What Changes

### Container Images
- `dist` stage base changes from `base` (with npm) to `prod-base` (without npm)
- Both main container and initContainer built from dist stage (no npm in either)

### Deployment Configuration
- InitContainer migration commands change from `npm run` syntax to direct `node_modules/.bin/sequelize` calls
- Functionally identical, just different invocation

## Risk Assessment

### Low Risk ✅

1. **Application runtime**: Already doesn't use npm
2. **Migration commands**: `sequelize` CLI is just a node script (`#!/usr/bin/env node`)
3. **Build process**: Completely unchanged
4. **Rollback**: Simple revert of Dockerfile and config changes

### Testing Strategy

1. **Local Testing**
   ```bash
   # Build new image
   docker build -t remediations:test --target dist -f build/Dockerfile .
   
   # Verify npm is absent
   docker run remediations:test which npm  # Should fail
   
   # Verify sequelize works
   docker run remediations:test node_modules/.bin/sequelize --version
   
   # Test migration command
   docker run remediations:test sh -c "node_modules/.bin/sequelize db:migrate"
   ```

2. **CI Environment**
   - Deploy to CI first with new migration commands
   - Verify migrations run successfully
   - Run full test suite

3. **QA Environment**
   - Deploy to QA
   - Verify all functionality
   - Run integration tests

4. **Production**
   - Deploy during maintenance window
   - Monitor initContainer logs for migration success
   - Have rollback plan ready

## Implementation Plan

### Step 1: Update Dockerfile
- Create `prod-base` stage without npm
- Update `dist` stage to use `prod-base`
- Update `dist` stage to copy node_modules instead of running npm ci

### Step 2: Update Deployment Configs

**External repository (app-interface):**
- Update `data/services/insights/remediations/deploy-clowder.yml` in app-interface repository
- Change `MIGRATION_COMMAND` values from `npm run` to direct `node_modules/.bin/sequelize` calls
- Coordinate deployment timing with app-interface changes

### Step 3: Test Locally
- Build image
- Verify npm absent
- Verify sequelize present and functional
- Test migration commands

### Step 4: Deploy to CI
- Push changes
- Verify CI build succeeds
- Verify migrations run
- Verify tests pass

### Step 5: Deploy to QA
- Promote to QA
- Run integration tests
- Verify all endpoints functional

### Step 6: Deploy to Production
- Schedule deployment
- Monitor initContainer migration logs
- Verify application starts successfully
- Monitor for issues

## Rollback Plan

If issues arise:

1. **Immediate**: Revert deployment config changes (restore `npm run` commands)
   - Revert app-interface repository changes to restore original `MIGRATION_COMMAND` values
   - Revert local values-*.yaml files if necessary
2. **Next deploy**: Revert Dockerfile changes (restore npm in prod-base)
3. **Low risk**: Changes are isolated and easily reversible
4. **Coordination**: Ensure app-interface rollback is coordinated with image rollback if needed

## Future Enhancements (Out of Scope)

After successful deployment and validation of this proposal, future optimizations could include:

### Separate Migration and Runtime Images

**Concept:**
Build two distinct images instead of one:
- `remediations-runtime` - Minimal image for main container (no sequelize-cli, no db/)
- `remediations-migration` - Image for initContainer (includes sequelize-cli, db/)

**Architecture:**
```dockerfile
# Build stage (same as current)
FROM base AS build
RUN npm ci
RUN npm run build
RUN npx clean-modules -y

# Migration image (for initContainer)
FROM prod-base AS migration
COPY --from=build $APP_ROOT/dist ./
COPY --from=build $APP_ROOT/node_modules ./node_modules
COPY --from=build $APP_ROOT/db ./db

# Runtime image (for main container)
FROM prod-base AS runtime
COPY --from=build $APP_ROOT/dist/src ./src
COPY --from=build $APP_ROOT/dist/certs ./certs
# Copy only runtime dependencies from node_modules
```

**Deployment changes:**
```yaml
# deployment/clowdapp.yml
spec:
  containers:
    - image: quay.io/cloudservices/remediations-runtime:${IMAGE_TAG}
  initContainers:
    - image: quay.io/cloudservices/remediations-migration:${IMAGE_TAG}
```

**Benefits:**
- Runtime container has only what it needs (clearest separation of concerns)
- Additional ~2-5MB savings on runtime image
- Runtime container cannot run migrations (defense in depth)

**Costs:**
- Two images to build, tag, and push
- Deployment manifest changes required
- More complex to maintain
- Dependency extraction complexity
- Potential for version skew
- Higher testing burden

**When to reconsider:**
- After this proposal has been validated in production for 3-6 months
- If image size becomes a critical concern (CI/CD performance, registry costs)
- As part of a broader image optimization initiative
- If sequelize-cli CVEs emerge

**Decision criteria:**
- Measure actual image size savings from this proposal
- Assess operational complexity appetite
- Evaluate CI/CD pipeline capacity for multi-image builds
- Consider maintenance burden vs. marginal security benefit (~2MB, low-risk component)

**Why defer:**
- This proposal delivers 95% of the benefit with 20% of the complexity
- Validate this approach in production first
- Gather data to inform future optimization decisions
- Avoid premature optimization

## Success Criteria

- [ ] Production images do not contain npm binary
- [ ] All migrations run successfully in all environments
- [ ] Application functionality unchanged
- [ ] Image size reduced by 15-20MB
- [ ] Security scans show fewer vulnerabilities
- [ ] No production incidents related to this change

## Questions & Answers

**Q: Why keep sequelize-cli if the runtime doesn't use it?**  
A: The initContainer needs it for migrations, and both containers use the same image. This keeps the solution simple with a single image to manage. We could build separate images (see **Future Enhancements**), but the added complexity isn't worth the marginal ~2MB savings. Separate images remain a future possibility after this approach is validated in production.

**Q: Does this affect local development?**  
A: No. Developers still have npm locally. This only affects containerized deployments.

**Q: What about npm scripts?**  
A: Build time scripts (in package.json) still work in the build stage which has npm. We're only removing npm from the final runtime image.

**Q: Is calling node_modules/.bin/sequelize directly supported?**  
A: Yes, this is the standard way to invoke CLI tools. npm scripts are just convenience wrappers that do exactly this.
