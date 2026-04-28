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

### Important Context: Immutable System List

Systems are determined at run creation time. The list is fixed — only system **status** changes (pending → running → success/failure). The pagination problem is purely about efficiently querying a fixed, known set of systems.

### Longstanding Bug: RHC Direct Systems Display as "localhost"

RHC direct systems use `host = "localhost"` in dispatcher. The current fallback `details?.display_name || details?.hostname || host.host` returns `"localhost"` when lookup fails — a meaningless name. The recommended solution (Option 3) resolves this naturally by always using `inventory_id` as the lookup key.

## Options

### Option 1: Dispatcher Native Pagination — Not Feasible

Pass limit/offset to playbook-dispatcher. Rejected because dispatcher can only sort by its own fields (status, updated_at) — it has no knowledge of our `display_name`/`hostname` values, so sorting by `system_name` is impossible.

### Option 2: In-Memory Optimization (Interim)

Fetch all run_hosts from dispatcher, apply filtering/sorting in memory, fetch system details only for the paginated subset.

- **Pro:** Minimal code changes; leverages existing RHINENG-25820 batched fetch
- **Con:** Still fetches all run_hosts on every request; sorting by `system_name` requires all system details first; O(n) performance degradation

Viable as a quick interim step; not ideal for production at scale.

### Option 3: Local Database Storage — Recommended ✅

Populate a `dispatcher_run_systems` join table at run creation. Use a SQL JOIN with the `systems` table to sort and paginate. Fetch run_hosts from dispatcher only for the paginated N systems.

- **Pro:** True SQL pagination (LIMIT/OFFSET returns exactly N rows); fast indexed sorting; `getPlanSystemsDetails` called for N systems only
- **Con:** DB schema change + migration

## Implementation (Option 3)

### Phase 1: Database Migrations

**Migration 1 — Add `system_name` generated column to `systems` table:**

```sql
ALTER TABLE systems
    ADD COLUMN system_name TEXT
    GENERATED ALWAYS AS (COALESCE(display_name, hostname)) STORED;

CREATE INDEX idx_systems_system_name ON systems(system_name);
```

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

### Phase 3: Populate and Query Functions

**Key principle:** `dispatcher_run_systems` is the historical record of which systems were part of each dispatched playbook run. It stores `(dispatcher_run_id, system_id)` pairs only — status and system names remain live data from playbook-dispatcher and the `systems` table respectively.

**File:** `src/remediations/fifi.js`

```javascript
exports.populateDispatcherRunSystems = async function (playbookRunId) {
    trace.enter('fifi.populateDispatcherRunSystems');

    const dispatcherRuns = await exports.getRHCRuns(playbookRunId);
    if (!dispatcherRuns?.data?.length) { trace.leave('No dispatcher runs found'); return; }

    const runHostsFilter = createDispatcherRunHostsFilter(playbookRunId);
    const allRunHosts = await dispatcher.fetchPlaybookRunHosts(runHostsFilter, RHCRUNFIELDS);
    if (!allRunHosts?.data?.length) { trace.leave('No run_hosts found'); return; }

    const records = allRunHosts.data
        .filter(host => host.run?.id && host.inventory_id)
        .map(host => ({ dispatcher_run_id: host.run.id, system_id: host.inventory_id }));

    await db.dispatcher_run_systems.bulkCreate(records, { ignoreDuplicates: true });
    trace.event(`Populated ${records.length} rows`);
    trace.leave();
};

exports.getDispatcherRunSystems = async function (playbookRunId, options = {}) {
    trace.enter('fifi.getDispatcherRunSystems');

    const { limit = 50, offset = 0, sortAsc = true, hostnameFilter = null } = options;

    const dispatcherRuns = await exports.getRHCRuns(playbookRunId);
    const dispatcherRunIds = (dispatcherRuns?.data ?? []).map(r => r.id);

    if (dispatcherRunIds.length === 0) {
        trace.leave('No dispatcher runs found');
        return { systemIds: [], total: 0 };
    }

    // On-demand fallback for pre-existing runs
    const existingCount = await db.dispatcher_run_systems.count({ where: { dispatcher_run_id: dispatcherRunIds } });
    if (existingCount === 0) {
        trace.event('No rows in dispatcher_run_systems — populating from dispatcher');
        await exports.populateDispatcherRunSystems(playbookRunId);
    }

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

    const systems = result.rows.map(row => ({
        system_id: row.system_id,
        system_name: row.system?.system_name ?? row.system_id
    }));

    trace.leave();
    return { systems, total: result.count };
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

After dispatching to playbook-dispatcher, populate the table asynchronously (don't block the response — fallback handles any failure):

```javascript
fifi.populateDispatcherRunSystems(playbookRunId).catch(err => {
    log.error({ err, playbook_run_id: playbookRunId }, 'Failed to populate dispatcher_run_systems');
});
```

### Phase 5: Cleanup

`ON DELETE CASCADE` on both FKs handles cleanup automatically when runs or systems are deleted.

## Handling Pre-existing Runs

A backfill migration is not feasible — playbook-dispatcher has a data retention policy and historical volume makes bulk backfill impractical. Instead, `getDispatcherRunSystems` implements an **on-demand fallback**: if no rows exist for a run, it fetches from dispatcher, persists the results, and serves from the local table. If dispatcher has no data (retention window passed), the endpoint falls back gracefully to the existing behavior.

## Alternative: In-Memory Optimization (Option 2)

If time-constrained, this can land before the DB table as an interim improvement.

### Updated `formatRunHosts` signature

```javascript
exports.formatRunHosts = async function (dispatcherRuns, playbook_run_id, options = {})
// options: { limit, offset, sortColumn, sortAsc, hostnameFilter }
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
3. Deploy code
4. No backfill — fallback handles pre-existing runs on demand
5. Monitor `/playbook_runs/{id}/systems` response time and `getPlanSystemsDetails` query counts

## Acceptance Criteria

### Schema
- [ ] `dispatcher_run_systems`: composite PK `(dispatcher_run_id, system_id)`, no other columns
- [ ] FKs with ON DELETE CASCADE to both `dispatcher_runs` and `systems`
- [ ] Index on `dispatcher_run_id`
- [ ] `systems.system_name` generated column with `idx_systems_system_name` index
- [ ] Sequelize model with associations

### Population
- [ ] `populateDispatcherRunSystems()` inserts only `(dispatcher_run_id, system_id)` pairs
- [ ] Populated at playbook run creation (async, non-blocking)
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
- [ ] Unit tests: `populateDispatcherRunSystems`, `getDispatcherRunSystems` (pagination, sorting, fallback, empty dispatcher response)
- [ ] Integration tests: end-to-end populate → SQL paginate → filter dispatcher → format
- [ ] Performance tests confirm improvement for large runs (1000+ systems)

## Related Work

- **RHINENG-25820:** Batched run_hosts fetch from dispatcher (completed)
- **RHINENG-3d8cf010:** Single-query `getRunHostDetails` (completed)
- **This work:** `dispatcher_run_systems` table for true SQL pagination