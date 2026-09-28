# PROMPT 14.1 — DUAL-WRITE ARCHITECTURE & SERVICE BOUNDARY SPECIFICATION

## 0. CONTEXT & LIFECYCLE POSITION

**Migration Lifecycle State:**
```text
  [ EXPAND ]     ===>  COMPLETED
  [ BACKFILL ]   ===>  COMPLETED & RECONCILED (100% Parity Achieved — OAUTH-13.4-01)
  [ DUAL-WRITE ] ===>  CURRENT PHASE (Architecture & Specification Gate)
  [ RECONCILE ]  ===>  PENDING
  [ CUTOVER ]    ===>  PENDING
  [ CONTRACT ]   ===>  PENDING
```

Following the successful execution and 100% reconciliation of the Live Backfill (Prompt 13.4), the database `pos_db` possesses full parity between the legacy schema (18 protected tables) and the target schema (18 target core tables).

The next required phase is **DUAL-WRITE**.  
This prompt (**PROMPT 14.1**) is strictly an **ARCHITECTURE DESIGN & SPECIFICATION PHASE**.  
**ZERO CODE IMPLEMENTATION, ZERO SCHEMA ALTERATIONS, AND ZERO RUNTIME MODIFICATIONS ARE AUTHORIZED AT THIS STAGE.**

---

# 1. OBJECTIVES

Antigravity (*Implementation Agent*) is tasked with conducting a deep architectural analysis of the application backend codebase and producing a comprehensive **Dual-Write Architecture Specification Document** (`docs/architecture/05_DUAL_WRITE_ARCHITECTURE_SPECIFICATION.md`).

The specification must resolve and formalize:
1. **Inventory of Mutation Endpoints:** Audit all active controllers in `pos_apps/server/src/controllers/` to identify every single mutation point (INSERT, UPDATE, DELETE) across Catalog, Inventory, Sales, and User domains.
2. **Domain Service Architecture:** Design a centralized, decoupled Domain Service layer under `pos_apps/server/src/services/dual_write/` (per `00_PROJECT_CONTEXT.md:440` and ADR-005) rather than scattering dual-write code across controllers.
3. **Write Consistency & Failure Handling Strategy:** Formulate architectural options for transaction boundaries, failure handling (strict rollback vs fail-safe audit queue/outbox), and tenant isolation.
4. **Data Access Technology Strategy:** Determine how dual-write services will mutate target tables (parameterized raw SQL vs isolated secondary Prisma client) while preserving legacy runtime stability without premature `prisma generate`.
5. **Reconciliation & Drift Detection Strategy:** Define how continuous background reconciliation (`reconcile_all.ts`) will detect and report divergence between legacy and target tables during the dual-write operational phase.

---

# 2. HARD SAFETY BOUNDARIES

During Prompt 14.1:
- **STRICTLY PROHIBITED:**
  - Any DDL or DML on `pos_db`.
  - Any execution of migrations or backfill.
  - Any `prisma generate` or modification of `@prisma/client`.
  - Any editing of runtime application controllers or routes.
  - Starting the application server against `pos_db`.
- **ALLOWED:**
  - Reading all files in `/docs` and `pos_apps/`.
  - Performing static code analysis and grep searches.
  - Writing the design specification document to `docs/architecture/05_DUAL_WRITE_ARCHITECTURE_SPECIFICATION.md`.
  - Writing the summary report to `docs/validation/20_PROMPT_14_1_DUAL_WRITE_ARCHITECTURE_REPORT.md`.

---

# 3. AUTHORITATIVE SOURCES TO RECONCILE

The architecture specification must adhere to:
1. `docs/00_PROJECT_CONTEXT.md` (Section 13: Migration Strategy, Section 14: Source-of-Truth Hierarchy)
2. `docs/architecture/04_TARGET_DATABASE_SCHEMA.md` (Target Schema Revision 4)
3. `docs/decisions/` (ADR-001 through ADR-005)
4. `docs/validation/11_PROMPT_12_5_OWNER_DECISION_REGISTER.md` (ODR-01 through ODR-06)
5. `docs/validation/19_PROMPT_13_4_LIVE_BACKFILL_EXECUTION_REPORT.md` (Post-Backfill Physical Baseline)
6. Existing controllers in `pos_apps/server/src/controllers/`

---

# 4. REQUIRED ARCHITECTURAL SPECIFICATION SECTIONS

The resulting document (`docs/architecture/05_DUAL_WRITE_ARCHITECTURE_SPECIFICATION.md`) must cover the following sections in exhaustive detail:

### 4.1 Domain Mutation Inventory
Inspect each of the following controllers and detail every endpoint that mutates state:
- `product.controller.ts` & `category.controller.ts` (Catalog mutations)
- `inventory.controller.ts` (Stock in, stock out, stock opname, stock transfer)
- `order.controller.ts` (Order creation, payment processing, split payment, hold order)
- `user.controller.ts` & `auth.controller.ts` (User creation, profile updates, PIN updates)
- `outlet.controller.ts` (Outlet creation/updates)

For each endpoint, document:
- Source legacy mutation (tables, columns modified).
- Corresponding target schema entity/table to be mutated.
- Data transformation and mapping rules (including UUIDv5 generation and multipliers).

### 4.2 Centralized Service Layer Design
Design the architecture of the dual-write services:
- `CatalogDualWriteService`
- `InventoryDualWriteService`
- `SalesDualWriteService`
- `UserDualWriteService`
- `LocationDualWriteService`

Specify interface contracts, input payloads, return types, and how existing controllers will invoke them with minimal code disruption.

### 4.3 Consistency & Failure Handling Matrix (Trade-off Analysis)
Present a formal trade-off matrix evaluating:
- **Pattern A (Synchronous Strict Transaction):**
  - Legacy and target writes executed inside a single atomic PostgreSQL transaction (`tx`).
  - If target write fails, entire request aborts and rolls back.
  - *Pros:* Zero data divergence.
  - *Cons:* Target bug blocks cashiers from selling.
- **Pattern B (Fail-Safe Dual-Write with Drift Outbox):**
  - Legacy write commits. Target write executes; if it fails, exception is caught and logged to `dual_write_drift_queue` for asynchronous replay.
  - *Pros:* Operational resilience (cashier never blocked).
  - *Cons:* Eventual consistency lag and drift resolution complexity.
- Formulate a clear recommendation for the Project Owner.

### 4.4 Inventory Concurrency & Mutex Semantics
Detail how dual-write will handle concurrent stock decrements during checkout:
- How `outlet_products.stock` and `inventory_balances.quantity_on_hand` are updated atomically.
- How `inventory_ledgers` append-only records are emitted per transaction.
- UOM multiplier calculation (`ProductVariant.inventoryQuantityMultiplier`).
- Negative stock policy enforcement per ADR-002.

### 4.5 Data Access Technology Selection
Evaluate:
- Using `$queryRawUnsafe` / `$executeRawUnsafe` (proven in Prompt 13.3B / 13.4).
- Generating a secondary isolated client (`@prisma/client-target`).
- Provide technical rationale and safety guarantees for the recommended approach.

### 4.6 Verification & Testing Strategy
- How dual-write services will be unit-tested.
- How mock integration tests will verify that 1 legacy write produces exactly 1 corresponding target write without touching `pos_db`.
- How `reconcile_all.ts` will serve as the continuous validation harness.

---

# 5. DELIVERABLES REQUIRED

Antigravity must produce:
1. **Primary Specification:**  
   `docs/architecture/05_DUAL_WRITE_ARCHITECTURE_SPECIFICATION.md`
2. **Review & Evaluation Report:**  
   `docs/validation/20_PROMPT_14_1_DUAL_WRITE_ARCHITECTURE_REPORT.md`

### Final Gate Declaration:
```text
FINAL GATE: READY FOR PROJECT OWNER REVIEW & DUAL-WRITE STRATEGY SELECTION
```

Setelah dokumen selesai disusun, **BERHENTI DAN SERAHKAN KEPADA PROJECT OWNER UNTUK DIAUDIT DAN MEMILIH KEPUTUSAN STRATEGI DUAL-WRITE.**
