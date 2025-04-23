### POST v1/remediations/:plan_id/playbook_runs
#### Procedure
1. Setup
   1. Sanitize `excludes` - RHC or satellite_id
   2. Fetch remediation
      1. Return 404 if not found
   3. Fetch RHC enabled status: GET /config-manager/v2/profiles/current
      1. Return 403 if not enabled
2. Check system status
   1. Calculate sorted list of distinct systems
      1. Return 422 if no systems
   2. Get recipient list: GET /playbook-dispatcher/internal/v2/connection_status
   3. Compute recipient status etag etag
      1. Return 412 if recipient status etag doesn't match request
3. Create playbook run
   1. Create playbook_run_id
   2. validate `excludes` list
      1. Return 400 if any item in `excludes` not present in remediation plan
   3. Create dispatcher work requests
      1. For each recipient:
         1. if satellite recipient: 
            1. if satellite_id is not in `excludes`
               1. create satellite work request, with all systems in this sat organization
         2. if direct recipient:
            1. if 'RHC' is not in `excludes`
               1. create direct work request, with just this one system
   4. return 422 if no work requests
   5. POST /playbook-dispatcher/internal/v2/dispatch
      1. calculate aggregate status: no partial success!
4. Results
   1. If all work requests successful
      1. Store playbook_run_id in database
   2. If any work request failed
      1. Return 422
   3. Return 201({id: <playbook_run_id>})

#### Sequence Diagram
```mermaid
sequenceDiagram
    actor u as User
    participant rem as Remediations
    participant db as Remediations<br>Database
    participant pd as Playbook-Dispatcher
    participant cfg as Config Manger

    u ->> + rem: POST v1/remediations/:plan_id/playbook_runs
    note right of u: {"exclude": ["RHC", "<satellite_id uuid>"]}

    note over rem: Setup
    rem ->> rem: Sanitize excludes
    rect rgba(191, 223, 255, .1)
       rem -->> db: SELECT * FROM remediations 
       rem -->> cfg: GET /config-manager/v2/profiles/current
       db ->> rem: (remediation plan info)
       cfg ->> rem: (current profile)
    end
    break Remediation plan not found
        rem ->> u: HTTP 404
    end
    break RHC remediations not enabled
        rem ->> u: HTTP 403: Access Forbidden
    end
    
    note over rem: Check system status
    rem ->> rem: Extract sorted list of<br/>distinct systems from plan
    break Plan contains no systems
       rem -->> u: HTTP 422: Remediation <plan_id> contains no systems
    end
    rect rgba(191, 223, 255, .1)
       rem -->> pd: GET /playbook-dispatcher/internal/v2/connection_status
       note right of rem: (see: /doc/requests/playbook-dispatcher/connection_status_req.json)
       pd ->> rem: [recipients]
       note left of pd: (see: /doc/responses/playbook-dispatcher/connection_status.json
    end
    rem ->> rem: Compute recipient status etag
    break Recipient status etag doesn't match request
        rem ->> u: HTTP 412
    end

    note over rem: Create playbook run
    rem ->> rem: Create playbook_run_id uuid
    rem ->> rem: Validate excludes list
    break No system in plan matches exclude
       rem ->> u: HTTP 400: Excluded Executor [<executor>] not found in list of identified executors
    end
    loop For each recipient
       alt Type = "satellite" & satellite_id not in excludes
          rem ->> rem: Create dispatcher satellite work request for all systems in sat org
       else Tyep = "directConnect" and RHC not in excludes
          rem ->> rem: Create dispatcher direct work request for single system
       end
    end
    break No work requests
       rem ->> u: HTTP 422: No executors available for Playbook <plan name> (<plan_id>)
    end
    rect rgba(191, 223, 255, .1)
       rem -->> pd: POST /playbook-dispatcher/internal/v2/dispatch
       pd ->> rem: [playbook-dispatcher run id]
    end

    note over rem: Results
    alt Success
       rem -->> db: INSERT playbook_run_id INTO playbook_runs
    else Any of the work requests failed...
        break
            rem ->> u: HTTP 422: No executors available for Playbook <plan name> (<plan_id>)
        end
    end

    rem ->> - u: HTTP 201: {id: playbook_run_id}
```
