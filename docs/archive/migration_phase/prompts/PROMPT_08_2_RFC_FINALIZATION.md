# PROMPT_08_2_RFC_FINALIZATION.md

## PROMPT 08.2 — RFC FINALIZATION AFTER OWNER IDENTITY DECISION

### Role

You are **Antigravity**, the primary implementation/architecture agent for the Well POS (`pos_apps`) project.

Your task in this prompt is **DOCUMENTATION / ARCHITECTURE ONLY**.

Do NOT modify application code, Prisma schema, database, migrations, seed data, APIs, UI, tests, or infrastructure.

---

## 1. Objective

Finalize the Data Architecture RFC after the Project Owner has made the remaining User Identity decision.

The current RFC is Revision 3:

`/docs/architecture/03_DATA_ARCHITECTURE_RFC.md`

Create **Revision 4** of the RFC by applying:

1. The Project Owner's approved User Identity decision:
   - **Model B — Tenant-Scoped User Identity**
   - Operational login uses a tenant-scoped `userCode` + PIN pattern.
2. Correction to reconciliation Gate 2.
3. Correction to reconciliation Gate 3.
4. Any consistency updates required elsewhere in the RFC because of the User Identity decision.

The result must be internally consistent and ready to become the basis for the next database/schema-design phase.

---

# 2. Mandatory Source of Truth

Read these documents before editing:

1. `/docs/00_PROJECT_CONTEXT.md`
2. `/docs/architecture/01_EXISTING_SYSTEM_AUDIT.md`
3. `/docs/architecture/02_DEEP_DOMAIN_ANALYSIS.md`
4. `/docs/architecture/03_DATA_ARCHITECTURE_RFC.md`
5. `/docs/validation/05_SCHEMA_CONSISTENCY_VALIDATION_REPORT.md`
6. `/docs/validation/06_ARCHITECTURE_DECISION_GATE_REPORT.md`
7. `/docs/decisions/ADR-001-tenant-boundary-enforcement.md`
8. `/docs/decisions/ADR-002-negative-stock-policy.md`
9. `/docs/decisions/ADR-003-uom-vs-packaging.md`
10. `/docs/decisions/ADR-004-inventory-batch-lot.md`
11. `/docs/decisions/ADR-005-services-module-boundary.md`

Also inspect the actual existing source/schema where necessary to ensure the RFC does not contradict the current system.

### Source hierarchy

Use this hierarchy:

1. Existing source code + current database/schema
2. Approved Architecture Decisions
3. Approved Data Architecture
4. Approved Migration Design
5. This prompt
6. AI-generated inference

Do not silently invent unsupported business rules.

---

# 3. Owner Decision — USER IDENTITY

The Project Owner has explicitly selected:

## Model B — Tenant-Scoped User Identity

This decision is APPROVED and must no longer remain an unresolved gate.

The architectural intent is:

- User identity is scoped to a Tenant.
- Operational POS users should have a tenant-scoped human-friendly `userCode`.
- Typical examples:
  - `KSR001`
  - `KSR002`
  - `GUD001`
  - `SPV001`
- Operational authentication should support:
  - `userCode + PIN`
- PIN must be stored securely as a hash, never plaintext.
- The internal database primary key may remain UUID/opaque ID.
- `userCode` is the operational login identifier, not the database primary key.
- The design should support roles such as cashier, warehouse, and supervisor efficiently.

Do NOT assume that email must disappear.

Instead distinguish:

### Internal Identity
Opaque internal `User.id`.

### Tenant Identity
`tenantId + User.id`.

### Operational Login Identity
`tenantId + userCode`.

### Authentication Credential
PIN hash and/or other authentication credentials as supported by the application.

Email may remain for users who need backoffice/admin authentication or communication, but it must no longer be treated as a globally unique identity if that conflicts with the tenant-scoped model.

---

# 4. Required User Constraints

The RFC must explicitly define the intended uniqueness semantics.

At minimum:

```text
UNIQUE (tenantId, userCode)
```

For email, choose and document the semantics consistently with Model B.

Do not blindly assume email is mandatory.

If the existing application currently requires globally unique email, document the migration implication.

Do not design cross-tenant user identity unless explicitly required.

A user in Tenant A and a user in Tenant B may have the same `userCode` and/or email according to the approved tenant-scoped identity model and the final documented email semantics.

---

# 5. Important Distinction: User vs Platform Identity

Do not confuse:

- tenant operational users,
- tenant backoffice users,
- platform/superadmin users.

Review the existing `PlatformUser` concept.

The RFC must clearly state whether `PlatformUser` remains a separate platform-level identity from tenant-scoped `User`.

Do not merge them unless existing architecture explicitly requires it.

---

# 6. Correction — Reconciliation Gate 2

The current RFC contains wording implying that:

> legacy stock reconciliation should "account for" `inventoryQuantityMultiplier`.

This must be corrected.

## Correct principle

`inventoryQuantityMultiplier` is a **commercial packaging / transaction conversion mechanism**.

It does NOT change the physical canonical stock baseline.

Example:

```text
InventoryItem canonical UOM = PCS
Physical stock = 100 PCS

ProductVariant:
- 1 carton
- inventoryQuantityMultiplier = 24
```

Selling:

```text
10 cartons
```

produces:

```text
10 × 24 = 240 PCS deduction
```

The physical stock becomes:

```text
100 - 240 = -140 PCS
```

if negative stock is permitted, or the transaction is rejected if negative stock is not permitted.

The multiplier therefore affects **transaction quantity conversion**, not the meaning of the physical InventoryBalance itself.

### Gate 2 must therefore be rewritten to say:

- Legacy `OutletProduct.stock` is reconciled against target `InventoryBalance` in the canonical physical stock UOM.
- Batch dimensions must be included where applicable.
- Location/dimension mapping must be aligned.
- `inventoryQuantityMultiplier` is validated separately through transaction reconstruction / conversion tests where legacy packaging behavior exists.
- The multiplier must NOT be applied to the physical stock baseline comparison itself.

Do not introduce an alternative interpretation.

---

# 7. Correction — Reconciliation Gate 3

The current RFC wording effectively requires every order to have an InventoryLedger entry.

That is too broad.

The architecture explicitly supports:

- SERVICE_LABOR
- service-only orders
- non-stock commercial items
- orders that do not trigger inventory movement

Therefore:

## Correct principle

Only **inventory-affecting orders/operations** must produce corresponding inventory ledger entries.

Examples that may be inventory-affecting:

- Retail stock sale
- F&B recipe consumption
- modifier-driven inventory consumption
- stock adjustment
- stock transfer
- waste
- return/restock
- other approved inventory movements

Examples that may NOT be inventory-affecting:

- pure `SERVICE_LABOR`
- service-only order with no consumables
- non-stock commercial item

### Gate 3 must therefore be rewritten to:

> 100% of inventory-affecting orders/operations during dual-write have corresponding and reconcilable entries in both the legacy inventory movement representation and the target InventoryLedger where applicable.

The reconciliation must not require an InventoryLedger row for a transaction that legitimately does not affect inventory.

---

# 8. Stock Deduction Trigger Consistency

Ensure Revision 4 remains consistent with the existing configurable stock deduction trigger:

- `ON_PAYMENT` — default Retail
- `ON_ORDER_CONFIRM` — default F&B
- `ON_KITCHEN_DISPATCH` — optional advanced F&B
- `ON_WORK_ORDER_FINISH` — deferred Services capability

The RFC must make clear that reconciliation determines whether an operation was expected to affect inventory based on the configured domain workflow/trigger.

Do not assume every order automatically creates stock movement.

---

# 9. Inventory Ledger Consistency

Keep the terminology correction already approved:

Use:

> Immutable Inventory Stock Movement Ledger

Do NOT call it "double-entry inventory ledger" unless actual accounting double-entry debit/credit records are introduced.

Maintain:

- append-only behavior,
- signed quantity delta,
- optional batch,
- balanceBefore,
- balanceAfter,
- unit cost,
- reference type/id,
- actor,
- timestamp,
- negative-stock audit state.

Ensure the RFC does not imply that every commercial order must create a ledger entry.

---

# 10. Tenant Isolation Consistency

Revision 4 must remain consistent with ADR-001:

- direct `tenantId` on required child operational/domain records,
- NOT NULL where architecturally required,
- service-layer tenant validation,
- explicit cross-tenant reference prevention,
- removal of static/default tenant fallback,
- RLS as future defense-in-depth rather than the initial dependency.

Review User-related references to ensure they follow tenant boundaries.

---

# 11. Product / Inventory / Services Consistency

Do not change the approved architecture:

### Product

Commercial/sellable catalog item.

### InventoryItem

Physical/logistical/costed stock item.

### ProductVariant

Commercial sellable variant.

Approved variant strategies:

1. Direct InventoryItem
2. Recipe
3. No stock

### Services

`SERVICE_LABOR` is supported now.

Full appointment/work-order/commission workflow remains deferred.

A service-only `SERVICE_LABOR` order does not require an InventoryLedger entry unless it has an inventory-affecting material/consumable operation.

---

# 12. Batch / Lot Consistency

Keep approved ADR-004:

- `InventoryBatch` is an optional stock dimension from the initial target architecture.
- Advanced FEFO/recall workflows are deferred.
- Batch-aware balances must remain dimensionally correct.
- Physical stock reconciliation must account for batch dimensions when batches exist.
- Do not introduce `initialQuantity` into InventoryBatch as a separate stock source; stock remains represented through InventoryBalance / InventoryLedger.

---

# 13. UOM / Packaging Consistency

Keep approved ADR-003:

Strict separation between:

1. Physical canonical UOM
2. Purchasing UOM
3. Commercial packaging

All physical inventory balances and ledger quantities use canonical UOM.

`ProductVariant.inventoryQuantityMultiplier` converts commercial transaction quantity into canonical inventory quantity.

Do not conflate packaging conversion with physical stock reconciliation.

---

# 14. Concurrency Consistency

Keep the approved concurrency principles:

- transactional stock mutation,
- lock the exact InventoryBalance row,
- safely handle first-row creation races,
- calculate balanceBefore/After inside the transaction,
- append ledger and update balance atomically,
- retry transient transaction conflicts where appropriate,
- do not rely on controller-level pre-checks.

Revision 4 should explicitly flag first-row creation / upsert concurrency as an implementation detail to be validated in Prompt 09.

---

# 15. Idempotency Consistency

Keep the approved idempotency model:

```text
tenantId + operation + idempotencyKey
```

At minimum applicable to:

- checkout,
- payment,
- payment webhook,
- manual inventory mutation,
- other externally retryable commands where required.

Do not invent response-storage requirements beyond what is needed for the architecture.

---

# 16. Refund / Payment Consistency

Keep:

- OrderStatus separate from PaymentStatus.
- Payment starts from an appropriate unpaid/pending state rather than defaulting every order to PAID.
- Multiple PaymentTransaction records are supported.
- Refund and RefundItem are explicit.
- Refunds must define their inventory effect separately from payment reversal.
- Inventory return/restock is an inventory operation, not merely a financial refund state.

---

# 17. Required Revision 4 Checks

Before finalizing the RFC, verify that no remaining section contradicts Model B.

Search especially for:

- global email uniqueness,
- global user identity,
- user login by email only,
- User without tenant boundary,
- PlatformUser vs User ambiguity,
- cashier/PIN flow,
- tenant-scoped user codes,
- reconciliation Gate 2,
- reconciliation Gate 3,
- SERVICE_LABOR inventory assumptions,
- stock deduction trigger assumptions.

---

# 18. Deliverable

Update/create:

`/docs/architecture/03_DATA_ARCHITECTURE_RFC.md`

The document must become:

> **Revision 4 — OWNER ADRs + USER IDENTITY DECISION INCORPORATED**

Update the status accordingly.

The previous status:

> GATE: USER IDENTITY DECISION PENDING

must be removed.

Replace it with a status indicating that the User Identity decision is resolved, while implementation/schema design remains the next phase.

For example:

> RFC REVISION 4 — OWNER DECISIONS INCORPORATED — READY FOR SCHEMA DESIGN REVIEW

Use your judgment for exact wording, but do not claim implementation readiness.

---

# 19. What NOT To Do

Do NOT:

- modify Prisma schema,
- modify database,
- create migrations,
- modify API,
- modify frontend,
- modify authentication implementation,
- modify seed data,
- create code,
- create tests,
- perform deployment,
- introduce RLS now,
- invent additional business decisions,
- reopen approved ADR decisions.

This task is documentation finalization only.

---

# 20. Final Report

After updating the RFC, report:

### A. Status

- RFC Revision 4 completed or not.

### B. Owner Decision Incorporated

Confirm:

- Model B — Tenant-Scoped User Identity
- tenant-scoped `userCode`
- operational `userCode + PIN`
- `User.id` remains internal identity
- PlatformUser remains distinct if supported by existing architecture

### C. Corrections Applied

Confirm:

1. Gate 2 multiplier correction.
2. Gate 3 inventory-affecting transaction correction.

### D. Consistency Check

Report whether you found any remaining contradictions involving:

- User identity
- tenant isolation
- Product/InventoryItem
- ProductVariant
- Recipe
- modifiers
- InventoryBatch
- UOM/packaging
- Order/Payment/Refund
- Services
- inventory triggers
- idempotency
- concurrency

### E. Next Gate

State clearly:

> The next phase is Prompt 09 — Database/Prisma Schema Design Review.

Do not implement Prompt 09 in this task.
