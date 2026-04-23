# Paginate Before Fetching System Details

## Problem Statement

The `GET /v1/remediations/{id}/playbook_runs/{playbook_run_id}/systems` endpoint fetches **all** system details before applying pagination, causing performance issues when playbook runs have many systems.

**Jira:** RHINENG-TBD  
**Related:** RHINENG-25820 (optimized `formatRHCRuns` but not `formatRunHosts`)

### Current Behavior

```javascript
// controller.fifi.js:109-169 (getSystems)
1. Fetch ALL RHC runs from playbook-dispatcher
2. Call combineHosts() which:
   - Calls formatRunHosts()
   - Fetches ALL run_hosts from playbook-dispatcher API
   - Extracts ALL inventory IDs
   - Fetches system details (display_name, hostname) for ALL systems from DB
   - Formats ALL hosts
3. Apply pagination (limit/offset) ← TOO LATE!
4. Sort results
5. Return paginated subset
```

**Example:** If a playbook run has 1,000 systems and the UI requests `?limit=10&offset=0`:
- We fetch 1,000 run_hosts from playbook-dispatcher
- We fetch system details for 1,000 systems from the database
- We format 1,000 host objects
- We return 10 results

**TODO Comment (line 152):**
```javascript
// TODO: we should trim the systems list before gathering the details for each system and then trimming that
```

### Important Context: Immutable System List

When a remediation playbook run is triggered:
1. The systems to be remediated are determined at creation time
2. Playbook-dispatcher is called to dispatch run requests to those specific systems
3. **This list is immutable** - systems cannot be added or removed from an active playbook run
4. Only the **status** of systems changes (pending → running → success/failure)

This means we're not dealing with a "growing" or "changing" list - the pagination problem is purely about efficiently querying a fixed, known set of systems and their current status.

## Impact

### Performance Issues
- Database query fetches 1,000+ systems when only 10 needed
- Playbook-dispatcher API returns all run_hosts (already fetched via single batched call thanks to RHINENG-25820)
- Unnecessary memory allocation for unused objects
- Slower response times for large playbook runs

### User Experience
- UI pagination feels slow because API is doing extra work
- Appears like API is "fetching all details before pagination"

### Longstanding Bug: RHC Direct Systems Display as "localhost"

RHC direct systems are dispatched by playbook-dispatcher with `host = "localhost"` (the ansible host for a direct connection is always localhost). The current `formatRunHosts` implementation falls back to `host.host` when a system name cannot be resolved:

```javascript
const systemName = details?.display_name || details?.hostname || host.host;
```

This means any RHC direct system that falls through the lookup returns `"localhost"` as its `system_name` in the API response — a meaningless name that gives the user no indication of which system it is.

The new design resolves this naturally: `populateDispatcherRunSystems` always stores `host.inventory_id` (the real system UUID) as `system_id`, and `getDispatcherRunSystems` resolves the display name via a JOIN with the `systems` table using that UUID. The `"localhost"` string from dispatcher is only used to derive `executor_type` (`'direct'` vs `'satellite'`) — it never influences the display name. As long as the system exists in the `systems` table (guaranteed for any system that was part of a remediation plan), its real `display_name` or `hostname` is returned.

## Root Cause

The code was structured to:
1. Fetch all data first (to enable filtering by `ansible_host`)
2. Apply pagination afterward
3. The sorting requirement complicates this (need `system_name` from DB to sort)

## Why We Fetch All run_hosts from Playbook-Dispatcher

### The Fundamental Problem

The endpoint needs to combine data from two sources:
1. **Playbook-Dispatcher API:** run_host status, updated_at, executor information
2. **Local Database (systems table):** display_name, hostname for proper system names

To properly sort and paginate, we need both data sources. This creates a chicken-and-egg problem:

**Scenario: Sort by system_name (most common use case)**
- ❌ Can't paginate dispatcher first → system names are in our DB, not dispatcher
- ❌ Can't paginate DB first → run status is in dispatcher, not our DB
- ✅ Must fetch both → combine → sort → paginate

### Current Dispatcher Fetch Behavior

The `fetchPlaybookRunHosts()` connector function fetches **all pages** from dispatcher:

```javascript
// src/connectors/dispatcher/impl.js
async fetchPlaybookRunHosts (filter, fields) {
    do {
        batch = await this.doHttp(options, false, this.fetchRunHosts);
        results.data = [...results.data, ...batch.data];  // Accumulate ALL pages
        next = batch?.links?.next;
        uri = next;
    } while (next);  // Keep fetching until no more pages
}
```

**Why we can't just use dispatcher's pagination:**
- Even if dispatcher supports `?limit=10&offset=0`, it can't sort by `system_name`
- We'd get 10 random systems, not the first 10 alphabetically
- Still need to fetch system details from our DB for those 10

### Options Evaluated

Three approaches were considered to solve the pagination problem:

#### Option 1: Use Dispatcher Native Pagination
**Why it doesn't work:** Can only sort by fields dispatcher knows (status, updated_at). Can't sort by `system_name` since dispatcher doesn't know our display_name/hostname values. Not viable.

#### Option 2: Optimize In-Memory (Fetch All, Paginate After)
**Approach:** Fetch all run_hosts from dispatcher, apply filtering/sorting in memory, only fetch system details for paginated subset.

**Limitations:** 
- Still fetches all run_hosts from dispatcher on every request
- Sorting by `system_name` requires fetching all system details first
- Performance degrades with run size (O(n) operations)

**Verdict:** Acceptable as interim optimization, but not ideal for production.

#### Option 3: Local Database Storage (RECOMMENDED ✅)
**Approach:** Populate a simple `dispatcher_run_systems` join table at run creation. Use a SQL JOIN with the `systems` table, sorting and filtering on the `system_name` generated column (`COALESCE(display_name, hostname)`). Fetch run_hosts from dispatcher only for the paginated N systems.

**Why this is the best solution:**
- ✅ True SQL pagination: LIMIT/OFFSET on the JOIN returns exactly the right N system_ids
- ✅ Fast sorting and filtering: `ORDER BY system_name` and `ansible_host` filter both use the `idx_systems_system_name` index on the generated column
- ✅ Storage cost is negligible — two UUID columns per system (~32 bytes per row)
- ✅ We control our DB, making this reliable and maintainable
- ✅ Enables future enhancements (full-text search on systems table, analytics)
- ✅ `getPlanSystemsDetails` is now called only for N systems (paginated subset), not all systems

**Verdict:** This is the recommended primary implementation (detailed below in "Solution Approaches").

### Recommended Decision

**Implement Option 3: `dispatcher_run_systems` table** as the primary solution (see Approach 1 below for full implementation).

With `dispatcher_run_systems` populated at run creation, the `GET /playbook_runs/{id}/systems` request can paginate the system list via SQL, then fetch run_hosts from dispatcher and filter to just those N systems. This still requires fetching all run_hosts from dispatcher (a single batched call, already optimized by RHINENG-25820), but `getPlanSystemsDetails` is now only called for the N paginated systems rather than all systems in the run.

**Alternative:** If severely time-constrained, Option 2 (in-memory optimization) can be implemented as a quick interim step, then migrated to Option 3 later. However, the database table approach is not significantly more complex and provides far better long-term value, so jumping directly to Option 3 is recommended.

## Solution Approaches

### Approach 1: Store Dispatcher Run Hosts Locally (RECOMMENDED)

**Strategy:** 
Create a `dispatcher_run_systems` table to store the computed system list for each dispatcher run, enabling true SQL-based pagination and sorting.

**Why This is the Best Solution:**
- ✅ **True pagination:** Single SQL query with LIMIT/OFFSET returns only requested rows
- ✅ **Fast sorting:** Database indexes handle sorting efficiently (O(log n) vs O(n))
- ✅ **No repeated API calls:** Fetch from dispatcher once, serve paginated requests from DB
- ✅ **Offline capability:** Works even if dispatcher is temporarily unavailable
- ✅ **Scalable:** Performance doesn't degrade with large playbook runs
- ✅ **Simple queries:** Standard SQL pagination, no complex in-memory sorting

**Tradeoffs:**
- ✅ **Storage overhead:** Negligible — only two UUID columns per system (roughly 32 bytes per row)
- ❌ **Implementation effort:** Database schema changes, population logic, migration

**When to Use:** This should be the default approach for production. The benefits far outweigh the costs.

### Approach 2: Optimize In-Memory Pagination (Interim/Fallback)

**Strategy:** 
- Fetch ALL run_hosts from playbook-dispatcher (already optimized with single call)
- Apply hostname filtering if needed
- Sort and paginate in-memory
- Only fetch system details for the paginated subset (when possible)

**Pros:**
- Minimal changes to existing code
- Leverages existing RHINENG-25820 optimization
- Reduces database queries for system details
- Simple to implement quickly

**Cons:**
- Still fetches all run_hosts from playbook-dispatcher on every request
- Sorting by `system_name` requires fetching all system details first
- Performance degrades with run size (O(n) operations)
- Memory overhead for large runs

**When to Use:** As a quick interim optimization while implementing Approach 1, or for small deployments where playbook runs rarely exceed 100 systems.

### Approach 3: Playbook-Dispatcher Native Pagination (Not Feasible)

**Strategy:**
- Pass limit/offset to playbook-dispatcher API
- Let playbook-dispatcher handle pagination

**Why This Doesn't Work:**
- ❌ Can't sort by `system_name` (dispatcher doesn't know our display_name/hostname values)
- ❌ Would need dispatcher API changes (don't control external service)
- ❌ Still need to join with local systems table for display names

**Verdict:** Not a viable solution given current architecture.

## Recommended Implementation: Approach 1 (Local Database Storage)

Store dispatcher run_host data in a local `dispatcher_run_systems` table for efficient pagination.

### Key Architecture Principle

`dispatcher_run_systems` records only which systems belong to a dispatcher run. No status, no names, no volatile data — those continue to come from playbook-dispatcher. The table exists solely to enable SQL-based sorting and pagination of the system list.

**Implementation Implications:**
- ✅ **Populate once:** Insert (dispatcher_run_id, system_id) pairs when playbook run is created
- ✅ **Sort and paginate via SQL JOIN:** JOIN with the `systems` table on the `system_name` generated column (`COALESCE(display_name, hostname)`), sort and LIMIT/OFFSET in SQL to get exactly N system_ids. `ansible_host` filter becomes a simple `system_name ILIKE` on the same indexed column.
- ✅ **Status and names always from dispatcher:** Fetch run_hosts from playbook-dispatcher for the paginated subset only
- ❌ **Never store volatile data:** Status, system names, and console output are not stored — those continue to come from playbook-dispatcher

### Handling Pre-existing Runs (Fallback Behavior)

A backfill migration to populate `dispatcher_run_systems` for existing dispatcher runs is not feasible:
- Playbook-dispatcher has a **data retention policy** — older run_host data may no longer be available
- The volume of historical data makes a migration impractical

Instead, `getDispatcherRunSystems` implements an **on-demand fallback**: if no rows exist for a given playbook run, it fetches from playbook-dispatcher and persists the results to `dispatcher_run_systems` before serving the request. This handles pre-existing runs transparently with no migration required, at the cost of one slower first request per pre-existing run (subsequent requests use the local table).

### Implementation Plan

#### Phase 1: Database Migrations

**Migration 1 — Add `system_name` generated column to `systems` table:**
`src/db/migrations/YYYYMMDDHHMMSS-systems-add-system-name.js`

```sql
ALTER TABLE systems
    ADD COLUMN system_name TEXT
    GENERATED ALWAYS AS (COALESCE(display_name, hostname)) STORED;

CREATE INDEX idx_systems_system_name ON systems(system_name);
```

`system_name` is a stored generated column — PostgreSQL keeps it in sync automatically whenever `display_name` or `hostname` changes. Requires PostgreSQL 12+.

**Migration 2 — Create `dispatcher_run_systems` table:**
`src/db/migrations/YYYYMMDDHHMMSS-create-dispatcher-run-systems.js`

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

#### Phase 2: Create Sequelize Model

**File:** `src/remediations/models/dispatcherRunSystems.js`

```javascript
'use strict';

module.exports = (sequelize, { UUID }) => {
    const DispatcherRunSystems = sequelize.define('dispatcher_run_systems', {
        dispatcher_run_id: {
            type: UUID,
            primaryKey: true,
            references: {
                model: 'dispatcher_runs',
                key: 'dispatcher_run_id'
            },
            onDelete: 'CASCADE'
        },
        system_id: {
            type: UUID,
            primaryKey: true,
            references: {
                model: 'systems',
                key: 'id'
            },
            onDelete: 'CASCADE'
        }
    }, {
        timestamps: false,
        tableName: 'dispatcher_run_systems'
    });

    DispatcherRunSystems.associate = models => {
        DispatcherRunSystems.belongsTo(models.dispatcher_runs, {
            foreignKey: 'dispatcher_run_id'
        });
        DispatcherRunSystems.belongsTo(models.systems, {
            foreignKey: 'system_id',
            as: 'system'
        });
    };

    return DispatcherRunSystems;
};
```

#### Phase 3: Implement Sync Functions

**File:** `src/remediations/fifi.js`

Two functions are needed: one to populate the table at run creation, and one to query it with SQL-based sorting and pagination.

```javascript
exports.populateDispatcherRunSystems = async function (playbookRunId) {
    trace.enter('fifi.populateDispatcherRunSystems');

    const dispatcherRuns = await exports.getRHCRuns(playbookRunId);
    if (!dispatcherRuns?.data?.length) {
        trace.leave('No dispatcher runs found');
        return;
    }

    const runHostsFilter = createDispatcherRunHostsFilter(playbookRunId);
    const allRunHosts = await dispatcher.fetchPlaybookRunHosts(runHostsFilter, RHCRUNFIELDS);
    if (!allRunHosts?.data?.length) {
        trace.leave('No run_hosts found');
        return;
    }

    const records = allRunHosts.data
        .filter(host => host.run?.id && host.inventory_id)
        .map(host => ({
            dispatcher_run_id: host.run.id,
            system_id: host.inventory_id
        }));

    await db.dispatcher_run_systems.bulkCreate(records, { ignoreDuplicates: true });

    trace.event(`Populated ${records.length} rows`);
    trace.leave();
};

exports.getDispatcherRunSystems = async function (playbookRunId, options = {}) {
    trace.enter('fifi.getDispatcherRunSystems');

    const {
        limit = 50,
        offset = 0,
        sortAsc = true,
        hostnameFilter = null
    } = options;

    // Resolve dispatcher run IDs for this playbook run
    const dispatcherRuns = await exports.getRHCRuns(playbookRunId);
    const dispatcherRunIds = (dispatcherRuns?.data ?? []).map(r => r.id);

    if (dispatcherRunIds.length === 0) {
        trace.leave('No dispatcher runs found');
        return { systemIds: [], total: 0 };
    }

    const existingCount = await db.dispatcher_run_systems.count({
        where: { dispatcher_run_id: dispatcherRunIds }
    });

    if (existingCount === 0) {
        trace.event('No rows in dispatcher_run_systems — populating from dispatcher');
        await exports.populateDispatcherRunSystems(playbookRunId);
    }

    const sortDir = sortAsc ? 'ASC' : 'DESC';

    const where = { dispatcher_run_id: dispatcherRunIds };

    const systemInclude = {
        model: db.systems,
        as: 'system',
        attributes: ['id', 'system_name'],
        required: false
    };

    // hostnameFilter maps directly to system_name — a simple ILIKE on an indexed column
    if (hostnameFilter) {
        systemInclude.where = { system_name: { [db.Sequelize.Op.iLike]: `%${hostnameFilter}%` } };
        systemInclude.required = true; // INNER JOIN to exclude non-matching systems
    }

    const result = await db.dispatcher_run_systems.findAndCountAll({
        where,
        include: [systemInclude],
        order: [[{ model: db.systems, as: 'system' }, 'system_name', sortDir]],
        limit,
        offset,
        raw: false
    });

    // Return the resolved names from the JOIN alongside the IDs.
    // The controller uses these directly — no second DB query needed.
    const systems = result.rows.map(row => ({
        system_id: row.system_id,
        system_name: row.system?.system_name ?? row.system_id
    }));

    trace.leave();
    return { systems, total: result.count };
};
```

#### Phase 4: Update Controller to Use dispatcher_run_systems

**File:** `src/remediations/controller.fifi.js:109-169`

The updated `getSystems` flow:

1. Call `getDispatcherRunSystems` — SQL JOIN of `dispatcher_run_systems` with `systems`, sorted by `system_name` (an indexed generated column: `COALESCE(display_name, hostname)`), paginated with LIMIT/OFFSET. Returns `{ systems: [{ system_id, system_name }], total }` — names from the JOIN, no second DB call needed. `ansible_host` filter applied as `system_name ILIKE` on the same JOIN.
2. Fetch all run_hosts from playbook-dispatcher for the playbook run (single batched call, already optimized by RHINENG-25820).
3. Index dispatcher response by `inventory_id` for O(1) lookup.
4. Merge: for each paginated system, look up its run_host in the index to get status, updated_at, executor info.
5. Format and return.

```javascript
exports.getSystems = errors.async(async function (req, res) {
    trace.enter('fifi.getSystems');

    const {column, asc} = format.parseSort(req.query.sort);
    const {limit, offset} = req.query;

    // Verify the playbook run belongs to the user's remediation
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

    // Step 1: SQL-sorted, paginated system list from dispatcher_run_systems JOIN systems
    // Returns { systems: [{ system_id, system_name }], total } — names resolved from JOIN
    trace.event('Fetch paginated system list from dispatcher_run_systems...');
    const { systems, total } = await fifi.getDispatcherRunSystems(req.params.playbook_run_id, {
        limit,
        offset,
        sortAsc: asc,
        hostnameFilter: req.query.ansible_host
    });

    // Validate offset
    if (total > 0 && offset >= total) {
        throw errors.invalidOffset(offset, total);
    }

    // Step 2: Fetch all run_hosts from dispatcher for this playbook run (single batched call)
    trace.event('Fetch run_hosts from dispatcher...');
    const rhcRuns = await fifi.getRHCRuns(req.params.playbook_run_id);
    const runHostsFilter = createDispatcherRunHostsFilter(req.params.playbook_run_id);
    const allRunHosts = await dispatcher.fetchPlaybookRunHosts(runHostsFilter, RHCRUNFIELDS);

    // Step 3: Index dispatcher response by inventory_id for fast lookup
    const runHostsBySystemId = _.keyBy(allRunHosts?.data ?? [], 'inventory_id');
    const runsMap = _.keyBy(rhcRuns?.data ?? [], 'id');

    // Step 4: Merge paginated systems (names from JOIN) with status from dispatcher
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

    // Step 5: Format and return
    const formatted = format.playbookSystems(pageSystems, total);

    trace.leave();
    res.status(200).send(formatted);
});
```

#### Phase 4b: Populate Table at Playbook Run Creation

**When to populate:** When a playbook run is created (triggered via POST `/remediations/{id}/playbook_runs`)

**File:** `src/remediations/controller.fifi_2.js` (or wherever playbook runs are created)

After creating the playbook run and dispatching to playbook-dispatcher, populate `dispatcher_run_systems`:

```javascript
// After successful dispatch and playbook_run record creation
const playbookRunId = result; // UUID from createPlaybookRun

// Populate dispatcher_run_systems asynchronously
// Don't await - let it populate in background
fifi.populateDispatcherRunSystems(playbookRunId).catch(err => {
    log.error({ err, playbook_run_id: playbookRunId }, 'Failed to populate dispatcher_run_systems');
    // Not critical - will populate on-demand if needed
});
```

**Alternative:** Populate synchronously if you want to guarantee `dispatcher_run_systems` is ready before responding:
```javascript
try {
    await fifi.populateDispatcherRunSystems(playbookRunId);
} catch (err) {
    log.error({ err, playbook_run_id: playbookRunId }, 'Failed to populate dispatcher_run_systems');
    // Continue anyway - dispatcher_run_systems will be populated on first GET request via fallback
}
```

#### Phase 5: Cleanup on Playbook Run Deletion

Ensure cascade delete is working, or add explicit cleanup:

```javascript
// When playbook_run is deleted, dispatcher_run_systems rows are automatically 
// deleted via ON DELETE CASCADE foreign key constraint
```

### Alternative Implementation: Phase 1 (Interim Optimization)

If you need a quick win before implementing the database table, use this interim approach:

#### Refactor `formatRunHosts` to Support Pagination

**File:** `src/remediations/fifi.js`

**Current signature:**
```javascript
exports.formatRunHosts = async function (dispatcherRuns, playbook_run_id)
```

**New signature:**
```javascript
exports.formatRunHosts = async function (dispatcherRuns, playbook_run_id, options = {})
// options: { limit, offset, sortColumn, sortAsc, hostnameFilter }
```

**Changes:**
1. Keep the existing batched fetch of all run_hosts (RHINENG-25820 optimization)
2. Apply hostname filtering early (if provided)
3. **New:** For `system_name` sorting:
   - Fetch system details for ALL hosts (needed for sorting)
   - Sort the full list
   - Apply pagination
4. **New:** For other sorting (status, updated_at, executor_type):
   - Sort the run_hosts by fields already available
   - Apply pagination
   - Fetch system details ONLY for paginated subset
5. Return: `{ hosts: [...], total: count }`

#### Phase 2: Update `getSystems` Controller

**File:** `src/remediations/controller.fifi.js:109-169`

**Current flow:**
```javascript
const rhcRuns = await fifi.getRHCRuns(req.params.playbook_run_id);
let systems = [];
await fifi.combineHosts(rhcRuns, systems, req.params.playbook_run_id, req.query.ansible_host);
const total = fifi.getListSize(systems);
systems = fifi.pagination(systems, total, limit, offset);
systems = fifi.sortSystems(systems, column, asc);
```

**New flow:**
```javascript
const rhcRuns = await fifi.getRHCRuns(req.params.playbook_run_id);
const result = await fifi.formatRunHosts(rhcRuns, req.params.playbook_run_id, {
    limit,
    offset,
    sortColumn: column,
    sortAsc: asc,
    hostnameFilter: req.query.ansible_host
});
// result = { hosts: [...], total: 123 }
const formatted = format.playbookSystems(result.hosts, result.total);
```

**Changes:**
1. Remove `combineHosts` call (logic moves into `formatRunHosts`)
2. Remove separate pagination step
3. Remove separate sorting step
4. Pass all options to `formatRunHosts` in one call

#### Phase 3: Update Helper Functions

**Remove/Deprecate:**
- `combineHosts` (line 386) - logic absorbed into `formatRunHosts`
- Manual pagination/sorting in controller

**Keep:**
- `sortSystems` - may still be useful as a helper, or inline the logic

## Detailed Implementation

### Step 1: Update `formatRunHosts` Function

**Location:** `src/remediations/fifi.js:235-278`

```javascript
/**
 * Format RHC (Red Hat Connect) run hosts data by fetching proper system names
 * Applies filtering, sorting, and pagination efficiently.
 * 
 * @param {Object} dispatcherRuns - Dispatcher runs data
 * @param {string} playbook_run_id - The playbook run ID
 * @param {Object} options - Pagination and filtering options
 * @param {number} options.limit - Maximum number of results to return
 * @param {number} options.offset - Number of results to skip
 * @param {string} options.sortColumn - Column to sort by (system_name, status, updated_at, executor_type)
 * @param {boolean} options.sortAsc - Sort ascending (true) or descending (false)
 * @param {string} options.hostnameFilter - Optional hostname substring filter
 * @returns {Promise<{hosts: Array, total: number}>} Paginated and formatted hosts with total count
 */
exports.formatRunHosts = async function (dispatcherRuns, playbook_run_id, options = {}) {
    const {
        limit,
        offset,
        sortColumn = 'system_name',
        sortAsc = true,
        hostnameFilter = null
    } = options;

    let hosts = [];

    if (!dispatcherRuns?.data) {
        return { hosts: [], total: 0 };
    }

    // Build a map of run.id -> run for looking up updated_at
    const runsMap = _.keyBy(dispatcherRuns.data, 'id');

    // Fetch all run_hosts for this playbook run in a single API call (RHINENG-25820 optimization)
    const runHostsFilter = createDispatcherRunSystemsFilter(playbook_run_id);
    const allRunHosts = await dispatcher.fetchPlaybookRunHosts(runHostsFilter, RHCRUNFIELDS);

    if (!allRunHosts?.data) {
        return { hosts: [], total: 0 };
    }

    // Apply hostname filtering early if provided
    let filteredRunHosts = allRunHosts.data;
    if (hostnameFilter) {
        // We'll need system details to filter by hostname, so we must fetch them all
        const allInventoryIds = _.uniq(filteredRunHosts.map(host => host.inventory_id));
        const systemDetails = await queries.getPlanSystemsDetails(allInventoryIds);
        
        filteredRunHosts = filteredRunHosts.filter(host => {
            const details = systemDetails[host.inventory_id];
            const systemName = details?.display_name || details?.hostname || host.host;
            return systemName.indexOf(hostnameFilter) >= 0;
        });
    }

    const total = filteredRunHosts.length;

    // Sorting strategy depends on sort column
    if (sortColumn === 'system_name') {
        // Must fetch system details for ALL hosts to sort by system_name
        const allInventoryIds = _.uniq(filteredRunHosts.map(host => host.inventory_id));
        const systemDetails = await queries.getPlanSystemsDetails(allInventoryIds);
        
        // Format all hosts (we need system_name to sort)
        const allFormatted = filteredRunHosts.map(host => {
            const details = systemDetails[host.inventory_id];
            const systemName = details?.display_name || details?.hostname || host.host;
            const isDirect = (host.host === 'localhost');
            const run = runsMap[host.run?.id] || {};
            return {
                system_id: host.inventory_id,
                system_name: systemName,
                status: (host.status === 'timeout' ? 'failure' : host.status),
                updated_at: run.updated_at,
                playbook_run_executor_id: isDirect ? playbook_run_id : host.run?.id,
                executor_type: isDirect ? 'direct' : 'satellite'
            };
        });

        // Sort by system_name
        const sorted = _.orderBy(allFormatted, [sortColumn], [sortAsc ? 'asc' : 'desc']);
        
        // Paginate
        hosts = sorted.slice(offset, offset + limit);
        
    } else {
        // For status, updated_at, executor_type: we can sort/paginate before fetching system details
        
        // Pre-sort the run_hosts by available fields
        const sortedRunHosts = filteredRunHosts.map(host => {
            const isDirect = (host.host === 'localhost');
            const run = runsMap[host.run?.id] || {};
            return {
                ...host,
                _status: (host.status === 'timeout' ? 'failure' : host.status),
                _updated_at: run.updated_at,
                _executor_type: isDirect ? 'direct' : 'satellite'
            };
        });

        const sortField = `_${sortColumn}`;
        const sorted = _.orderBy(sortedRunHosts, [sortField], [sortAsc ? 'asc' : 'desc']);
        
        // Paginate BEFORE fetching system details
        const paginated = sorted.slice(offset, offset + limit);
        
        // Fetch system details ONLY for paginated subset
        const paginatedInventoryIds = paginated.map(host => host.inventory_id);
        const systemDetails = await queries.getPlanSystemsDetails(paginatedInventoryIds);
        
        // Format only the paginated hosts
        hosts = paginated.map(host => {
            const details = systemDetails[host.inventory_id];
            const systemName = details?.display_name || details?.hostname || host.host;
            return {
                system_id: host.inventory_id,
                system_name: systemName,
                status: host._status,
                updated_at: host._updated_at,
                playbook_run_executor_id: host._executor_type === 'direct' ? playbook_run_id : host.run?.id,
                executor_type: host._executor_type
            };
        });
    }

    return { hosts, total };
};
```

### Step 2: Update `getSystems` Controller

**Location:** `src/remediations/controller.fifi.js:109-169`

```javascript
exports.getSystems = errors.async(async function (req, res) {
    trace.enter('fifi.getSystems');

    const {column, asc} = format.parseSort(req.query.sort);
    const {limit, offset} = req.query;

    // Verify the playbook run belongs to the user's remediation
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

    // Get RHC runs from dispatcher
    trace.event('fetch RHC runs from dispatcher...');
    const rhcRuns = await fifi.getRHCRuns(req.params.playbook_run_id);
    trace.event(`RHC runs fetched`);

    // Get systems from RHC runs with pagination applied efficiently
    let result = { hosts: [], total: 0 };
    if (!_.isEmpty(rhcRuns)) {
        trace.event('Get systems from RHC runs with pagination...');
        result = await fifi.formatRunHosts(rhcRuns, req.params.playbook_run_id, {
            limit,
            offset,
            sortColumn: column,
            sortAsc: asc,
            hostnameFilter: req.query.ansible_host
        });
    }

    // Validate offset
    if (result.total > 0 && offset >= result.total) {
        throw errors.invalidOffset(offset, result.total);
    }

    const formatted = format.playbookSystems(result.hosts, result.total);

    trace.leave();
    res.status(200).send(formatted);
});
```

### Step 3: Remove `combineHosts`

**Location:** `src/remediations/fifi.js:386-394`

Mark as deprecated or remove entirely since the logic is now in `formatRunHosts`.

## Testing Strategy

### Unit Tests

**File:** `src/remediations/fifi.unit.js`

Add tests for `formatRunHosts` with pagination options:

```javascript
describe('formatRunHosts with pagination', function () {
    test('sorts by system_name and paginates correctly', async () => {
        // Setup: 50 systems
        // Request: limit=10, offset=0, sort=system_name:asc
        // Assert: Returns 10 systems, sorted alphabetically
    });

    test('sorts by status and paginates (optimal path)', async () => {
        // Setup: 100 systems
        // Request: limit=10, offset=20, sort=status:desc
        // Assert: Only fetches system details for 10 systems (not 100)
    });

    test('applies hostname filter before pagination', async () => {
        // Setup: 50 systems, 5 match "web-server"
        // Request: limit=10, offset=0, ansible_host=web-server
        // Assert: Returns 5 systems (all matches), total=5
    });

    test('handles empty results', async () => {
        // Setup: No run_hosts
        // Assert: Returns { hosts: [], total: 0 }
    });
});
```

### Integration Tests

**File:** `src/remediations/fifi.integration.js`

Test the full flow with real playbook-dispatcher responses:

```javascript
describe('getSystems with pagination', function () {
    test('paginates large playbook runs efficiently', async () => {
        // Setup: Playbook run with 1000 systems
        // Mock: playbook-dispatcher returns 1000 run_hosts
        // Mock: Verify getPlanSystemsDetails called with only 10 IDs (for limit=10)
        // Request: GET /remediations/{id}/playbook_runs/{run_id}/systems?limit=10&offset=0
        // Assert: Returns 10 systems, meta.total=1000
    });
});
```

### Performance Tests

**Manual testing:**
1. Create a playbook run with 1000+ systems
2. Request: `GET /playbook_runs/{id}/systems?limit=10&offset=0`
3. Monitor:
   - Database query log (should see query for ~10 systems, not 1000)
   - Response time (should be fast)
   - Memory usage (should be low)

## Migration & Rollout

### Why No Backfill Migration

A database migration to pre-populate `dispatcher_run_systems` for existing playbook runs is not viable:

- **Data retention policy:** Playbook-dispatcher does not retain run_host data indefinitely. Historical runs may return no data or partial data from the API.
- **Historical volume:** The number of existing dispatcher runs makes a bulk backfill impractical without significant risk of timeouts or partial data.

Pre-existing runs are handled instead by the **on-demand fallback** in `getDispatcherRunSystems`: the first request for a run with no rows fetches from dispatcher, persists the result, and subsequent requests use the local table. If dispatcher returns no data (retention window passed), the endpoint falls back to the existing fetch-all behavior.

### Backward Compatibility

✅ **No breaking changes:**
- Response format unchanged
- Query parameters unchanged
- Pre-existing runs work via fallback (slower first request, fast thereafter)

### Deployment

1. Run migration to add `system_name` generated column and index to `systems` table
2. Run migration to create `dispatcher_run_systems` table
3. Deploy code changes
4. No data backfill needed — fallback handles pre-existing runs on demand
5. Monitor for performance improvements in metrics

### Metrics to Watch

- Response time for `/playbook_runs/{id}/systems` endpoint
- Database query counts for `getPlanSystemsDetails`
- Memory usage of the API pods

## Risks & Mitigations

### Risk 1: Dispatcher retention policy limits fallback data

Pre-existing runs may have no run_host data available from playbook-dispatcher if the retention window has passed. In that case, `populateDispatcherRunSystems` will insert nothing and the endpoint will serve an empty result rather than erroring.

**Mitigation:**
- Accept this limitation — if dispatcher has no data, we have no data
- Log a warning when fallback returns empty so it is observable
- Document that the systems list for very old runs may be unavailable

### Risk 2: Hostname filter may miss systems with no `systems` table row

Systems removed from inventory before the soft-delete enhancement is implemented, or systems that were never written to the `systems` table, will have no matching row. The LEFT JOIN returns `NULL` for `system_name`; an `ansible_host` ILIKE filter will not match them.

**Mitigation:**
- Document this edge case
- Most users do not filter by hostname on old runs
- The row still appears (unsorted position) without the filter applied

### Risk 3: Regression in existing behavior

**Mitigation:**
- Comprehensive unit and integration tests
- Test with production-like data volumes
- Gradual rollout with monitoring

## Future Enhancements

**Note:** The `dispatcher_run_systems` table is the recommended primary implementation (see above). These are additional enhancements that build on top of that solution.

### 1. Full-Text Search on the Systems Table

With `system_name` already a dedicated indexed column, hostname filtering is already an efficient `ILIKE` on an indexed column. For very large deployments where ILIKE performance is still insufficient, add a PostgreSQL tsvector GIN index directly on `system_name`:

```sql
ALTER TABLE systems ADD COLUMN system_name_tsvector TSVECTOR
    GENERATED ALWAYS AS (to_tsvector('simple', COALESCE(system_name, ''))) STORED;

CREATE INDEX idx_systems_system_name_search
    ON systems USING GIN(system_name_tsvector);
```

This enables prefix/full-text searches using `@@` operators instead of ILIKE, at the cost of additional storage.

### 2. Soft-Delete Systems to Preserve Historical Playbook Run Records

#### Background

`remediations-consumer` is a separate Kafka listener that processes `system.delete` messages from the inventory service. Currently it hard-deletes rows from the `systems` table. This causes two problems for `dispatcher_run_systems`:

1. The `system_id` FK (`REFERENCES systems(id) ON DELETE CASCADE`) would cascade-delete `dispatcher_run_systems` rows when a system is removed, destroying the historical record of which systems were part of a run.
2. The `LEFT JOIN systems` in `getDispatcherRunSystems` would return `NULL` for deleted systems, so historical playbook runs would lose their system names.

#### Proposed Change

Instead of hard-deleting from the `systems` table, mark rows as deleted by adding a `deleted_at` column. The `dispatcher_run_systems` FK and JOIN continue to work normally, preserving names and membership records for the lifetime of the remediation plan.

**Schema change:**

```sql
ALTER TABLE systems ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
CREATE INDEX idx_systems_deleted_at ON systems(deleted_at) WHERE deleted_at IS NULL;
```

#### Decision: Manual `deleted_at` vs. Sequelize `paranoid: true`

Sequelize's `paranoid: true` adds `deleted_at` automatically and filters deleted rows from all queries (`WHERE deleted_at IS NULL`). However, `remediations-consumer` uses **Knex** (not Sequelize) — meaning soft-delete semantics would need to be implemented manually in the consumer regardless. Given this, a manual `deleted_at` column is preferred over `paranoid: true`:

- Avoids adding implicit `WHERE deleted_at IS NULL` to every Sequelize query in this service, which would unexpectedly exclude soft-deleted systems from the `getDispatcherRunSystems` JOIN
- Keeps the semantics explicit and consistent across both services
- Both services use `deleted_at IS NULL` or `deleted_at IS NOT NULL` explicitly where needed

The one query that should filter deleted systems in normal operation (`getPlanSystems`, which builds the active remediation plan view) would add `WHERE deleted_at IS NULL` explicitly.

#### Changes Required in remediations-consumer

- **System delete handler:** Replace `DELETE FROM systems WHERE id = ?` with `UPDATE systems SET deleted_at = NOW() WHERE id = ?`
- **Active plan cleanup:** Continue removing the system from `remediation_issue_systems` (a deleted system should no longer appear in active plans)
- **Cleaner job extension:** remediations-consumer already has a periodic cleaner job. Extend it with a cleanup task that hard-deletes soft-deleted system rows that have no remaining references in `dispatcher_run_systems`:

```sql
DELETE FROM systems
WHERE deleted_at IS NOT NULL
  AND id NOT IN (
    SELECT DISTINCT system_id FROM dispatcher_run_systems
  );
```

This keeps the `systems` table bounded — soft-deleted rows are cleaned up once no active or historical playbook run references them. The existing retention policy that culls old plans will naturally drain `dispatcher_run_systems` over time, making their referenced system rows eligible for cleanup.

#### Re-registration Edge Case

`storeSystemDetails()` uses `bulkCreate({ ignoreDuplicates: true })`. If a system is re-registered under the same UUID after being soft-deleted, the insert would be silently skipped, leaving `deleted_at` set. This should be changed to an upsert that clears `deleted_at`:

```javascript
await db.systems.bulkCreate(records, {
    updateOnDuplicate: ['hostname', 'display_name', 'ansible_hostname', 'deleted_at', 'updated_at']
    // system_name is a generated column — PostgreSQL updates it automatically
});
```

### 3. Analytics and Reporting

With system membership recorded in a local table, lightweight analytics become possible:

```sql
-- Systems participating in the most playbook runs
SELECT s.display_name, COUNT(*) AS run_count
FROM dispatcher_run_systems drs
JOIN systems s ON drs.system_id = s.id
GROUP BY s.display_name
ORDER BY run_count DESC
LIMIT 10;
```

## Related Work

- **RHINENG-25820:** Optimized `formatRHCRuns` to batch fetch run_hosts from dispatcher (completed)
- **RHINENG-3d8cf010:** Optimized `getRunHostDetails` to use single query (completed)
- **This work:** Create `dispatcher_run_systems` table for true SQL pagination

## Acceptance Criteria

### Database & Schema
- [ ] `dispatcher_run_systems` table created with schema: composite PK `(dispatcher_run_id, system_id)`, no other columns
- [ ] `dispatcher_run_id` references `dispatcher_runs(dispatcher_run_id)` ON DELETE CASCADE
- [ ] `system_id` references `systems(id)` ON DELETE CASCADE
- [ ] Index on `dispatcher_run_id` for efficient filtering
- [ ] Sequelize model created with associations to `dispatcher_runs` and `systems`
- [ ] Database migration tested on dev/staging environments

### Population
- [ ] `populateDispatcherRunSystems()` inserts only `(dispatcher_run_id, system_id)` pairs — no system_name, no status, no other columns
- [ ] Table is populated when playbook run is created (after dispatch to playbook-dispatcher)
- [ ] `ignoreDuplicates: true` prevents errors on double-population
- [ ] On-demand fallback: if no rows exist for a run when `getDispatcherRunSystems` is called, `populateDispatcherRunSystems` is invoked before querying
- [ ] Fallback handles pre-existing runs transparently (no migration required)
- [ ] If dispatcher returns no data (retention window passed), the endpoint falls back gracefully to the existing fetch-all behavior

### API Endpoints
- [ ] `GET /playbook_runs/{id}/systems` sorts and paginates via SQL JOIN with `systems` table (single query)
- [ ] When requesting `limit=10`, exactly 10 `system_ids` are resolved from the database; dispatcher and `getPlanSystemsDetails` are called only for those 10
- [ ] Response time improves significantly for large playbook runs (1000+ systems)
- [ ] `systems` table has `system_name` generated column (`COALESCE(display_name, hostname)`) with `idx_systems_system_name` index
- [ ] Sorting by `system_name` works correctly via `ORDER BY system_name` on the JOIN
- [ ] Hostname (`ansible_host`) filtering works as `system_name ILIKE` on the indexed column
- [ ] Offset validation works correctly
- [ ] Status and system names in the response still come from playbook-dispatcher (not from `dispatcher_run_systems`)
- [ ] RHC direct systems return their real `display_name`/`hostname` instead of `"localhost"`
- [ ] No breaking changes to response format

### Data Integrity
- [ ] No orphaned records when dispatcher runs are deleted (CASCADE works)
- [ ] No orphaned records when systems are deleted (CASCADE works)

### Testing
- [ ] All existing tests pass
- [ ] New unit tests for `populateDispatcherRunSystems` (inserts only id pairs)
- [ ] New unit tests for `getDispatcherRunSystems` (pagination, sorting, fallback)
- [ ] Integration tests verify end-to-end: populate → SQL paginate → filter dispatcher → format
- [ ] Performance tests confirm improvement over baseline for large runs
- [ ] Tests for fallback behavior when no rows exist (pre-existing runs)
- [ ] Tests for fallback when dispatcher returns no data (retention window passed)

### Backward Compatibility
- [ ] No breaking changes to API response format
- [ ] Response structure identical to previous implementation
- [ ] Existing clients work without changes

## References

- Code: `src/remediations/controller.fifi.js:109-169`
- Code: `src/remediations/fifi.js:235-278`
- TODO comment: Line 152 in controller.fifi.js
- Related optimization: RHINENG-25820 (commits ec43887b, b590a896)