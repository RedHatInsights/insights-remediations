### POST v1/remediations

#### Procedure
1. Validate input
   1. Each issue has at least 1 system
   2. No duplication of issues
   3. Systems exist
      1. Fetch systems from Inventory
2. Update db
   1. Create new plan (generate id)
   2. Update existing issues (doesn't apply to new plans)
   3. Add new issues
   4. Add systems
3. Return new plan id

#### Sequence Diagram
```mermaid
sequenceDiagram
    actor u as User
    participant rem as Remediations
    participant db as Remediations<br>Database
    participant hbi as Inventory

    u ->> + rem: POST v1/remediations
    
    break
        rem ->> u: HTTP 400: DUPLICATE_ISSUE | NO_SYSTEMS
    end

    rect rgba(191, 223, 255, .1)
       rem -->> hbi: GET inventory/v1/hosts/<id_1>,<id_2>...
       hbi ->> rem: [{id, display_name, hostname, ansible_host, facts}]
    end

    break
        rem ->> u: HTTP 400: UNKNOWN_SYSTEM
    end

    rect rgba(191, 223, 255, .3)
        rem -->> db: INSERT (<generated plan_id>, plan_name...) INTO remediations
        rem -->> db: INSERT issues INTO remediation_issues
        rem -->> db: INSERT systems INTO remediation_issue_systems
    end

    rem ->> - u: HTTP 201: [Location = /api/remediations/v1/remediations/<plan_id>]<br>{"id": "9197ba55-0abc-4028-9bbe-269e530f8bd5"}
    note left of rem: (see: /doc/responses/remediations/create_plan.json)
```
