### GET v1/remediations/:plan_id/playbook_runs
#### Procedure
1. Fetch (run_ids, users) for plan_id from db
2. For each run_id:
   1. (paginated) GET /playbook-dispatcher/v1/runs?[labels][playbook-run]=run_id
   2. for each pd_run:
      1. (paginated) GET /playbook-dispatcher/v1/run_hosts?[labels][playbook-run]=run_id
      2. For each system: 
         1. Group by executor
6. Paginate by run_id
7. Resolve user info
8. Compute aggregate status
9. Format response
10. Return 

#### Sequence Diagram
```mermaid
sequenceDiagram
    actor u as User
    participant rem as Remediations
    participant db as Database
    participant pd as Playbook-Dispatcher

    u ->> + rem: GET v1/remediations/:plan_id/playbook_runs
    rem -->> db: SELECT id, user FROM playbook_runs 
    db ->> rem: [run_id, user]
    loop for each run_id
       rect rgba(191, 223, 255, .1)
          rem -->> pd: GET v1/runs?filter[labels][playbook-run]=run_id
          pd ->> rem: [pd_run]
       end
       note right of pd: (see: /doc/responses/playbook-dispatcher/runs.json)
       loop for each pd_run
           rect rgba(191, 223, 255, .1)
              rem -->> pd: GET v1/run_hosts?filter[run][labels][playbook-run]=run_id<br/>&filter[run][id]=pd_run.id
              pd ->> rem: [system]
           end
           note right of pd: (see: /doc/responses/playbook-dispatcher/run_hosts.json)
           loop for each system
               rem ->> rem: group by executors
           end
       end
    end
    rem ->> rem: paginate by run_id
    rem -->> rem: resolve users
    rem ->> rem: compute aggregate status
    rem ->> rem: format response
    rem ->> - u: Response
    note left of rem: (see: /doc/responses/remediations/playbook_runs.json)
```
