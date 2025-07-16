'use strict';

const db = require('../db');
const log = require('../util/log');

const RUNS_TO_SYNC_SQL = `
    SELECT pr.id, 
           dr.dispatcher_run_id, 
           dr.status as current_status,
           CASE 
               WHEN dr.dispatcher_run_id IS NULL THEN 'missing'
               WHEN dr.status IN ('pending', 'running') THEN 'stale'
               ELSE 'ok'
           END as update_type
    FROM playbook_runs pr
    JOIN remediations r ON pr.remediation_id = r.id
    LEFT JOIN dispatcher_runs dr ON pr.id = dr.remediations_run_id
    WHERE r.tenant_org_id = :tenantOrg 
      AND r.created_by = :createdBy
      AND (
        -- Missing records or stale non-final statuses
        dr.dispatcher_run_id IS NULL OR dr.status IN ('pending', 'running')
      )
    ORDER BY pr.created_at DESC
    LIMIT 100
`;

// Get playbook runs that need dispatcher_runs sync
async function getRunsToSync(tenantOrg, createdBy) {
    return db.s.query(RUNS_TO_SYNC_SQL, {
        replacements: { tenantOrg, createdBy },
        type: db.s.QueryTypes.SELECT
    });
}

// Fetch dispatcher data for runs from playbook-dispatcher API
async function fetchDispatcherData(runs) {
    const dispatcher = require('../connectors/dispatcher');
    const pLimit = require('p-limit');
    
    // Limit concurrent API calls to avoid overwhelming the dispatcher service
    // Users can have many remediation plans with multiple runs each
    const limit = pLimit(10);
    
    await Promise.all(runs.map(run => limit(async () => {
        try {
            const filter = {
                filter: { 
                    service: 'remediations',
                    labels: { 'playbook-run': run.id } 
                }
            };
            const fields = {
                fields: { data: ['id', 'status'] }
            };
            
            const dispatcherData = await dispatcher.fetchPlaybookRuns(filter, fields);
            run.dispatcherData = dispatcherData?.data || [];
        } catch (error) {
            log.warn(`Failed to fetch dispatcher data for playbook run ${run.id}:`, error.message);
            run.dispatcherData = [];
        }
    })));
}

// Create dispatcher_runs records for old runs that predate this table or missed Kafka updates
async function backfillMissing(runs) {
    const missingRuns = runs.filter(r => r.update_type === 'missing' && r.dispatcherData.length > 0);
    
    if (!missingRuns.length) return;

    const dispatcherRuns = missingRuns.flatMap(run =>
        run.dispatcherData.map(d => ({
            dispatcher_run_id: d.id,
            remediations_run_id: run.id,
            status: d.status,
            created_at: new Date(),
            updated_at: new Date(),
            pd_response_code: null
        }))
    );
    
    await db.dispatcher_runs.bulkCreate(dispatcherRuns, { 
        ignoreDuplicates: true 
    });
}

 // Update non-final statuses in case Kafka messages were missed
async function updateStale(runs) {
    const staleRuns = runs.filter(r => r.update_type === 'stale' && r.dispatcherData.length > 0);
    
    for (const run of staleRuns) {
        try {
            for (const d of run.dispatcherData) {
                await db.dispatcher_runs.update(
                    { 
                        status: d.status,
                        updated_at: new Date()
                    },
                    { 
                        where: { 
                            dispatcher_run_id: d.id,
                            remediations_run_id: run.id 
                        } 
                    }
                );
            }
        } catch (error) {
            log.warn(`Failed to update stale dispatcher runs for playbook run ${run.id}:`, error.message);
        }
    }
}

/**
 * Sync dispatcher_runs records for status queries
 * 
 * This function:
 * 1. Creates missing dispatcher_runs records for old playbook runs (backfill)
 * 2. Updates stale non-final statuses in case Kafka messages were missed
 */
async function syncDispatcherRuns(tenantOrg, createdBy) {
    // Skip in test environments - tests manually set up their data
    if (process.env.NODE_ENV === 'test') {
        return;
    }
    
    try {
        const runs = await getRunsToSync(tenantOrg, createdBy);
        
        if (!runs.length) return;

        // Fetch dispatcher data for all runs
        await fetchDispatcherData(runs);

        // Backfill missing records and update stale ones
        await backfillMissing(runs);
        await updateStale(runs);
    } catch (error) {
        // Don't let sync errors break the main query
        log.warn('Failed to sync dispatcher runs:', error.message);
    }
}

module.exports = {
    syncDispatcherRuns,
    getRunsToSync,
    fetchDispatcherData,
    backfillMissing,
    updateStale
}; 
