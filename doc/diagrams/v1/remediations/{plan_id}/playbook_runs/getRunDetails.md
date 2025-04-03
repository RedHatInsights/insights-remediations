### GET v1/remediations/:plan_id/playbook_runs/:run_id
#### Procedure
1. Fetch (run_id, user) for run_id of plan_id from db
2. GET /playbook-dispatcher/v1/runs?[labels][playbook-run]=run_id
3. for each pd_run:
    1. (paginated) GET /playbook-dispatcher/v1/run_hosts?[labels][playbook-run]=run_id&filter[run][id]=pd_run.id
    2. For each system:
        1. Group by executor
4. Resolve user info
5. Compute aggregate status
6. Format response
7. Return

#### Sequence Diagram
```mermaid
sequenceDiagram
    actor u as User
    participant rem as Remediations
    participant db as Remediations<br>Database
    participant pd as Playbook-Dispatcher

    u ->> + rem: GET v1/remediations/:plan_id/playbook_runs/:run_id

    rect rgba(191, 223, 255, .1)
       rem -->> db: SELECT id, user FROM playbook_runs 
       db ->> rem: (run_id, user)
    end
    rect rgba(191, 223, 255, .1)
       rem -->> pd: GET v1/runs?filter[labels][playbook-run]=run_id
       pd ->> rem: [pd_run]
       note left of pd: (see: /doc/responses/playbook-dispatcher/runs.json)
    end
    loop for each pd_run
        rect rgba(191, 223, 255, .1)
           rem -->> pd: GET v1/run_hosts?filter[run][labels][playbook-run]=run_id<br/>&filter[run][id]=pd_run.id
           pd ->> rem: [system]
           note left of pd: (see: /doc/responses/playbook-dispatcher/run_hosts.json)
        end
        loop for each system
            rem ->> rem: group by executors
        end
    end
    rem -->> rem: resolve users
    rem ->> rem: compute aggregate status
    rem ->> rem: format response
    rem ->> - u: HTTP 200
    note left of rem: (see: /doc/responses/remediations/single_playbook_run.json)
```
