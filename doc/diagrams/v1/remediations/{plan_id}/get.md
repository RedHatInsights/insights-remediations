### GET v1/remediations/:plan_id

#### Procedure
1. Fetch plan from db
2. Get systems from inventory
   1. Remove systems not in inventory
3. Get resolution for each issue
4. Get details for each issue
5. Get user details from BOP
6. Remove issues with 0 systems or missing details
7. Infer needs_reboot
8. Return formatted result

#### Sequence Diagram
```mermaid
sequenceDiagram
    actor u as User
    participant rem as Remediations
    participant db as Remediations<br>Database
    participant hbi as Inventory
    participant bop as Back<br>Office<br>Proxy
    participant svc as Issue<br>Service

    u ->> + rem: GET v1/remediations/:plan_id

   rect rgba(191, 223, 255, .1)
       rem -->> db: SELECT * FROM remediations * issues * issue_systems WHERE id = :plan_id
       db ->> rem: (plan details)
   end
   
   rect rgba(191, 223, 255, .1)
      rem -->> hbi: GET /inventory/v1/hosts
      hbi ->> rem: [systems]
      rem ->> rem: Remove duplicate systems
   end

   rect rgba(191, 223, 255, .1)
      loop for each issue
         rem -->> svc: GET issue resolution
         svc ->> rem: (resolution details)
         rem -->> svc: GET issue details
         svc ->> rem: (issue details)
      end
   end

   rect rgba(191, 223, 255, .1)
      rem -->> bop: GET user details
      bop ->> rem: (user details)
   end

```