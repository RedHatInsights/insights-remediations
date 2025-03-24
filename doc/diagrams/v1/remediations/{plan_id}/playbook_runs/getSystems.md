### GET v1/remediations/:plan_id/playbook_runs/:run_id/systems?executor=executor_id&ansible_host=ansible_hostname
#### Procedure
1. Fetch [receptor system] for run_id of plan_id from db, filter by executor_id, ansible_host
2. dispatcher_runs = GET /playbook-dispatcher/v1/runs?filter[labels][playbook-run]=run_id
3. If not filtering by receptor executor (i.e. always, since receptor has been retired):
   1. for each run in dispatcher_runs:
      1. GET [host, status, inventory_id]
         1. GET /playbook-dispatcher/v1/run_hosts?filter[run][labels][playbook-run]=run_id&filter[run][id]=run.id
            1. timeout -> failure 
         2. construct system object for each host {system_id, system_name, *status*, updated_at, executor_id}
   2. remove filtered hosts
4. If no systems remain, check to see if plan/run exist and return 404 if not
5. Paginate results
6. Sort systems (???)
7. Format result
8. Return

#### Sequence Diagram
```mermaid
sequenceDiagram
    actor u as User
    participant rem as Remediations
    participant db as Remediations<br>Database
    participant pd as Playbook-Dispatcher

    u ->> + rem: GET v1/remediations/:plan_id/playbook_runs/:run_id/systems?executor=xxx&ansible_host=yyy
    rect rgba(191, 223, 255, .1)
       rem -->> db: SELECT inventory_id FROM playbook_run_systems
       db ->> rem: [inventory_id] (receptor systems only)
    end
    rect rgba(191, 223, 255, .1)
       rem -->> pd: GET /playbook-dispatcher/v1/runs?filter[labels][playbook-run]=run_id
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
            rem ->> rem: construct system object (status: timeout -> failure)
        end
    end
    rem ->> rem: filter systems
    alt no systems remain && plan / run doesn't exist
        rem ->> u: 404
    else
       rem ->> rem: paginate results
       rem ->> rem: sort results
       rem ->> rem: format response
       rem ->> - u: Response
       note left of rem: (see: /doc/responses/remediations/single_playbook_run_systems.json)
    end
```
