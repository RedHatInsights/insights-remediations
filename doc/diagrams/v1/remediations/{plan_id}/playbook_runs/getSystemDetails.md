### GET v1/remediations/:plan_id/playbook_runs/:run_id/systems/:system_id

#### Procedure
1. dispatcher_runs = GET /playbook-dispatcher/v1/runs?filter[labels][playbook-run]=run_id
2. for each run in dispatcher_runs
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
    participant pd as Playbook-Dispatcher

    u ->> + rem: GET v1/remediations/:plan_id/playbook_runs/:run_id/systems/:system_id

    rect rgba(191, 223, 255, .1)
       rem -->> pd: GET v1/runs?filter[labels][playbook-run]=run_id
       pd ->> rem: [pd_run]
       note left of pd: (see: /doc/responses/playbook-dispatcher/runs.json)
    end
    loop Check each pd_run until system is found
       rect rgba(191, 223, 255, .1)
          rem -->> pd: GET v1/run_hosts?filter[run][labels][playbook-run]=run_id&filter[run][id]=run.id&filter[inventory_id]=system_id
          pd ->> rem: (host, stdout, inventory_id)
          note left of pd: (see: /doc/responses/playbook-dispatcher/run_hosts.json)
       end
    end

    alt No system found
       rem ->> u: HTTP 404
    end
 
    rem ->> rem: Format response
    rem ->> rem: Calculate etag
    rem ->> - u: HTTP 200
    note left of rem: (see: /doc/responses/remediations/playbook_run_host.json)
```
