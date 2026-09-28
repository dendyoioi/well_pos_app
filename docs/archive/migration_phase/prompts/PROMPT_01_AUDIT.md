# PROMPT 01 — EXISTING SYSTEM AUDIT

## ROLE

You are Antigravity, the primary architecture and implementation agent for the Well POS / `pos_apps` project.

Your task is to perform a **read-only forensic audit of the existing system**.

Do not redesign the system during this task.

Do not implement fixes.

Do not modify source code, Prisma schema, migrations, database, APIs, or frontend.

The objective is to establish an evidence-based baseline for later architecture work.

---

# 1. READ FIRST

Inspect the repository structure and identify:

- frontend application
- backend application
- Prisma schema
- database configuration
- authentication
- authorization/RBAC
- tenant/SaaS logic
- product/catalog
- checkout/order
- payment
- shift
- inventory
- warehouse/outlet
- CRM
- reporting
- configuration
- tests
- deployment/infrastructure

Also read any existing project documentation that is relevant.

---

# 2. AUDIT PRINCIPLES

Use actual repository evidence.

For each important finding:

- identify the file/module/model
- describe the current behavior
- distinguish observed fact from inference
- identify dependencies
- identify risks
- identify whether the behavior is legacy, current, or target-oriented

Do not assume that a target architecture already exists merely because a concept appears desirable.

---

# 3. DATABASE / DATA MODEL AUDIT

Inspect the Prisma schema and document:

- all major models
- primary keys
- foreign keys
- tenant ownership
- nullable vs required tenant IDs
- unique constraints
- indexes
- enums
- relation cardinality
- delete behavior
- monetary types
- quantity types
- inventory fields
- order/payment relationships

Pay particular attention to:

- Product
- ProductVariant if present
- Inventory-related models
- Outlet
- User
- Order
- OrderItem
- Payment
- Shift
- Category
- Customer/CRM
- warehouse-related entities

---

# 4. TENANT / SAAS AUDIT

Trace tenant resolution end-to-end.

Inspect:

- middleware
- request context
- headers/query/body tenant inputs
- authenticated user tenant
- fallback/default tenant behavior
- controller filtering
- service-layer filtering
- database queries

Determine whether a tenant can potentially access or mutate another tenant's data.

Do not fix anything. Report it.

---

# 5. ORDER / CHECKOUT / PAYMENT AUDIT

Trace checkout from request to database mutation.

Document:

- validation
- order creation
- item creation
- payment creation
- payment status
- stock validation
- stock deduction
- shift impact
- receipt
- hold order
- split payment
- retry behavior

Identify whether concurrent checkouts can oversell inventory.

Identify whether checkout is idempotent.

---

# 6. INVENTORY AUDIT

Trace current stock architecture.

Document:

- stock balance source
- stock movement/history
- stock in
- stock out
- stock opname
- stock transfer
- warehouse
- outlet
- low stock
- HPP/cost
- concurrency handling

Determine whether the current stock movement structure is an accounting ledger or only an operational stock movement history.

Do not use accounting terminology unless supported by the implementation.

---

# 7. PRODUCT / CATALOG AUDIT

Document how Product currently functions as:

- catalog
- sellable item
- inventory item
- SKU/barcode
- price
- unit
- category

Identify where these concepts are coupled.

---

# 8. MULTI-OUTLET / WAREHOUSE AUDIT

Determine:

- how outlets are modeled
- how warehouse is represented
- whether warehouse can sell
- how stock is stored per location
- how transfers work
- whether location ownership is tenant-safe

---

# 9. REPORTING / CRM / SHIFT AUDIT

Audit:

- gross profit/HPP
- sales reports
- shift reports
- X/Z reports
- customer/CRM
- relevant aggregation queries

Identify tenant and performance implications.

---

# 10. OUTPUT

Create:

`/docs/architecture/01_EXISTING_SYSTEM_AUDIT.md`

The report must contain:

1. Executive Summary
2. Repository/Technology Overview
3. Existing Architecture Map
4. Authentication & Authorization
5. Tenant/SaaS Architecture
6. Product & Catalog
7. Order & Checkout
8. Payment
9. Shift
10. Inventory
11. Outlet/Warehouse
12. CRM
13. Reporting
14. Database Model Assessment
15. Critical Risks
16. Technical Debt
17. Existing Capabilities That Must Be Preserved
18. Gaps for Multi-Vertical SaaS
19. Migration Constraints
20. Audit Conclusion

Include a severity classification:

- Critical
- High
- Medium
- Low

Do not modify implementation.

---

# 11. FINAL REPORT FORMAT

End with:

## Existing System Readiness

Summarize:

- what is already strong
- what must be preserved
- what blocks multi-tenant/multi-vertical evolution
- what requires architectural decisions before implementation

The result must be an evidence-based baseline, not a redesign.
