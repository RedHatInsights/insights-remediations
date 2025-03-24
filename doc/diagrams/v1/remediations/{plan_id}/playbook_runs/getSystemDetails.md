### GET v1/remediations/:plan_id/playbook_runs/:run_id/systems/:system_id?executor=executor_id&ansible_host=ansible_hostname

#### Procedure
1. system = fetch details FROM playbook_run_systems WHERE plan_id, run_id, system_id
2. else dispatcher_runs = GET /playbook-dispatcher/v1/runs?filter[labels][playbook-run]=run_id
   1. for run of dispatcher_runs
      1. run_host = GET /playbook-dispatcher/v1/run_hosts?filter[run][labels][playbook-run]=run_id&filter[run][id]=run.id&filter[inventory_id]=system_id (host, stdout, inventory_id)
      2. if run_host
         1. system = format host details
3. else 404
4. format system details
5. set etag
6. return

#### Sequence Diagram
```mermaid
sequenceDiagram
    actor u as User
    participant rem as Remediations
    participant db as Remediations<br>Database
    participant pd as Playbook-Dispatcher

    u ->> + rem: GET v1/remediations/:plan_id/playbook_runs/:run_id/systems/:system_id
 
    alt Receptor system
       rect rgba(191, 223, 255, .1)
          rem -->> db: SELECT "system details" FROM playbook_run_systems WHERE plan_id, run_id, system_id
          db ->> rem: (receptor system details)
       end

    else RHC system
       rect rgba(191, 223, 255, .1)
          rem -->> pd: GET v1/runs?filter[labels][playbook-run]=run_id
          pd ->> rem: [pd_run]
       end
       note right of pd: (see: /doc/responses/playbook-dispatcher/runs.json)
       loop Check each pd_run until system found
          rect rgba(191, 223, 255, .1)
             rem -->> pd: GET v1/run_hosts?filter[run][labels][playbook-run]=run_id&filter[run][id]=run.id&filter[inventory_id]=system_id
             pd ->> rem: (host, stdout, inventory_id)
          end
          note right of pd: (see: /doc/responses/playbook-dispatcher/run_hosts.json)
       end

    else No system found
       rem ->> u: 404
    end
 
    rem ->> rem: Format response
    rem ->> rem: Calculate etag
    rem ->> u: Response
    note left of rem: (see: /doc/responses/remediations/playbook_run_host.json)
```
