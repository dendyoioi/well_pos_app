# 15_PROMPT_13_2B_ENUM_VOCABULARY_TRANSITION_DESIGN_REV2.md
## Application Compatibility Readiness Analysis — Revision 2 (Read-Only)

### 1. Executive Summary
This document provides **Revision 2** of the Prompt 13.2B design, focusing on the critical and previously unexamined boundary between the **Database PostgreSQL Enum Transition** and the **Application Source Code & Build Readiness**.

#### Critical Realities Uncovered:
1. **Prisma Client State**: `node_modules/@prisma/client` is **already generated with Target Schema Revision 4**. 
2. **Application Compile State**: `npx tsc --noEmit` currently reports **362 TypeScript errors across 15 files** in `server/src/`. The application controllers (`inventory.controller.ts`, `order.controller.ts`, `product.controller.ts`, `saas.controller.ts`) are still written against the legacy prototype schema and fail TypeScript validation because they reference legacy models and retired enum labels.
3. **Active Legacy Enum Invocations**:
   - Out of all 10 enums in `pos_db`, only **two enums** have active incompatible usages in application source code:
     - **`StockMovementType`**: `PURCHASE_IN`, `DAMAGE_OUT`, `ADJUSTMENT`, `SALE_OUT` (invoked across 4 controllers).
     - **`PaymentTxStatus`**: `SUCCESS` (invoked in `order.controller.ts`).
   - The remaining 8 enums either have zero occurrences in application code (`PlatformRole`, `InvoiceStatus`, `BillingCycle`) or only invoke values that are 100% valid in Target Revision 4 (`PaymentStatus.PAID`, `PaymentMethod.CASH/QRIS`, `Role.ADMIN/SUPERVISOR/CASHIER`, `TenantStatus.*`, `ShiftStatus.*`).
4. **Runtime Crash Hazard**: If the database executes Prompt 13.2B without updating the application code, any inventory movement or checkout transaction will crash at runtime with PostgreSQL `invalid input value for enum`.
5. **Authorization Boundary**: Database migration authorization (`OAUTH-13.2-01` / `ODR-13.2B`) **does not authorize application source code refactoring**. A distinct application modernization authorization is required.

**Strict Governance Guardrail**: This report is **READ-ONLY ANALYSIS ONLY**. Zero DDL/DML, zero code modification, zero Prisma regeneration, and zero database mutations were executed.

---

### 2. Application Enum Usage Inventory

A comprehensive static scan across all non-migration files in `server/src/` reveals every explicit enum invocation:

| Enum Name | Target Revision 4 Contract | Literal Invocations in `server/src/` | Files / Line References | Active Usage Category |
| :--- | :--- | :--- | :--- | :---: |
| **`StockMovementType`** | `SALE, PURCHASE, TRANSFER_IN, TRANSFER_OUT, OPNAME_ADJUSTMENT, RETURN, WASTE, VOID, PROD_*` | `StockMovementType.PURCHASE_IN`<br>`StockMovementType.DAMAGE_OUT`<br>`StockMovementType.ADJUSTMENT`<br>`StockMovementType.SALE_OUT`<br>`StockMovementType.TRANSFER_IN`<br>`StockMovementType.TRANSFER_OUT` | `inventory.controller.ts:106, 196, 281, 515, 530`<br>`product.controller.ts:330`<br>`order.controller.ts:389`<br>`saas.controller.ts:393, 407` | **CRITICAL INCOMPATIBLE**<br>(4 legacy values must be updated) |
| **`PaymentTxStatus`** | `PENDING, CAPTURED, FAILED, REFUNDED, VOIDED` | `PaymentTxStatus.SUCCESS` | `order.controller.ts:276, 306` | **CRITICAL INCOMPATIBLE**<br>(`SUCCESS` must be updated to `CAPTURED`) |
| **`Role`** | `OWNER, ADMIN, SUPERVISOR, WAREHOUSE, CASHIER, KITCHEN, WAITER` | `Role.ADMIN`<br>`Role.SUPERVISOR`<br>`Role.CASHIER` | `user.routes.ts:17, 20, 21, 22`<br>`outlet.controller.ts:127, 282, 306`<br>`auth.middleware.ts:88`<br>`saas.controller.ts:148, 308` | **FULLY COMPATIBLE**<br>(All invoked roles exist in Target) |
| **`PaymentMethod`** | `CASH, QRIS, CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, EWALLET, VOUCHER` | `PaymentMethod.CASH`<br>`PaymentMethod.QRIS` | `shift.controller.ts:135, 138, 224, 226, 331, 333, 483, 485`<br>`order.controller.ts:289, 299`<br>`report.controller.ts:152, 155, 218` | **FULLY COMPATIBLE**<br>(Both values exist in Target) |
| **`PaymentStatus`** | `UNPAID, PARTIALLY_PAID, PAID, PARTIALLY_REFUNDED, REFUNDED` | `PaymentStatus.PAID` | `order.controller.ts:340`<br>`report.controller.ts:60` | **FULLY COMPATIBLE**<br>(`PAID` exists in Target) |
| **`ShiftStatus`** | `OPEN, CLOSED` | `ShiftStatus.OPEN`<br>`ShiftStatus.CLOSED` | `shift.controller.ts:51, 72, 106, 184, 303, 352`<br>`order.controller.ts:183` | **EXACT MATCH** |
| **`TenantStatus`** | `TRIAL, ACTIVE, SUSPENDED, CANCELLED, PENDING` | `TenantStatus.ACTIVE`<br>`TenantStatus.TRIAL`<br>`TenantStatus.SUSPENDED`<br>`TenantStatus.PENDING` | `platform.controller.ts:160, 161, 162, 507`<br>`saas.controller.ts:110` | **EXACT MATCH** |
| **`PlatformRole`** | `SUPER_ADMIN, SUPPORT, BILLING` | *None* (0 references) | N/A | **NO ACTIVE APPLICATION USAGE** |
| **`InvoiceStatus`** | `DRAFT, UNPAID, PAID, VOID` | *None* (0 references) | N/A | **NO ACTIVE APPLICATION USAGE** |
| **`BillingCycle`** | `MONTHLY, ANNUALLY` | *None* (0 references) | N/A | **NO ACTIVE APPLICATION USAGE** |

---

### 3. Legacy vs Target Usage Matrix

Analysis of the required code transformations for active incompatible enums:

| Module / Controller | File Path | Line | Legacy Invocation | Target Revision 4 Replacement | Rationale / Mapping Contract |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **Inventory** | `src/controllers/inventory.controller.ts` | 106 | `StockMovementType.PURCHASE_IN` | `StockMovementType.PURCHASE` | Maps receiving movement to Target vocabulary |
| **Inventory** | `src/controllers/inventory.controller.ts` | 196 | `StockMovementType.DAMAGE_OUT` | `StockMovementType.WASTE` | Maps damaged goods write-off to Target `WASTE` |
| **Inventory** | `src/controllers/inventory.controller.ts` | 281 | `StockMovementType.ADJUSTMENT` | `StockMovementType.OPNAME_ADJUSTMENT` | Maps stock adjustment to Target `OPNAME_ADJUSTMENT` |
| **Product** | `src/controllers/product.controller.ts` | 330 | `StockMovementType.PURCHASE_IN` | `StockMovementType.PURCHASE` | Initial stock entry on product creation |
| **Order** | `src/controllers/order.controller.ts` | 389 | `StockMovementType.SALE_OUT` | `StockMovementType.SALE` | POS order checkout stock deduction |
| **SaaS** | `src/controllers/saas.controller.ts` | 393 | `StockMovementType.ADJUSTMENT` | `StockMovementType.OPNAME_ADJUSTMENT` | Seed stock for demo tenant |
| **SaaS** | `src/controllers/saas.controller.ts` | 407 | `StockMovementType.ADJUSTMENT` | `StockMovementType.OPNAME_ADJUSTMENT` | Seed stock for demo tenant |
| **Order** | `src/controllers/order.controller.ts` | 276 | `PaymentTxStatus.SUCCESS` | `PaymentTxStatus.CAPTURED` | Under `ODR-06`, successful checkout payment is `CAPTURED` |
| **Order** | `src/controllers/order.controller.ts` | 306 | `PaymentTxStatus.SUCCESS` | `PaymentTxStatus.CAPTURED` | Under `ODR-06`, cash payment completion is `CAPTURED` |

---

### 4. Prisma Client Compatibility

#### Verification Findings:
1. `server/prisma/schema.prisma` is currently configured to Target Schema Revision 4.
2. `node_modules/@prisma/client` is already generated from this file:
   ```typescript
   // node_modules/.prisma/client/index.d.ts line 283:
   export const StockMovementType: {
     SALE: 'SALE',
     PURCHASE: 'PURCHASE',
     TRANSFER_IN: 'TRANSFER_IN',
     TRANSFER_OUT: 'TRANSFER_OUT',
     OPNAME_ADJUSTMENT: 'OPNAME_ADJUSTMENT',
     RETURN: 'RETURN',
     WASTE: 'WASTE',
     VOID: 'VOID',
     PRODUCTION_CONSUMPTION: 'PRODUCTION_CONSUMPTION',
     PRODUCTION_OUTPUT: 'PRODUCTION_OUTPUT'
   };
   // node_modules/.prisma/client/index.d.ts line 365:
   export const PaymentTxStatus: {
     PENDING: 'PENDING',
     CAPTURED: 'CAPTURED',
     FAILED: 'FAILED',
     REFUNDED: 'REFUNDED',
     VOIDED: 'VOIDED'
   };
   ```
3. **Build Status**: Because `@prisma/client` contains Target Revision 4 types, any attempt to compile `server/src/controllers/inventory.controller.ts` throws:
   ```text
   error TS2551: Property 'PURCHASE_IN' does not exist on type 'StockMovementType'. Did you mean 'PURCHASE'?
   error TS2339: Property 'DAMAGE_OUT' does not exist on type 'StockMovementType'.
   error TS2339: Property 'ADJUSTMENT' does not exist on type 'StockMovementType'.
   error TS2339: Property 'SUCCESS' does not exist on type 'PaymentTxStatus'.
   ```
4. **Conclusion**: The current application code **cannot be built** with the current generated Prisma Client.

---

### 5. Application Build Compatibility & Legacy Model Divergence

Beyond enum values, `npx tsc --noEmit` reveals 362 compiler errors because the controllers reference legacy Prisma models that do not exist in Target Revision 4:
- Legacy references to `prisma.outletProduct` (replaced in target by `inventory_balances` / `inventory_items`).
- Legacy references to `prisma.stockMovement` (replaced in target by `inventory_ledgers` / `legacy_stock_movements`).
- Legacy references to `product.unit`, `product.costPrice`, `tenant.businessName`.

#### Crucial Architecture Insight:
The application in `server/src/` is an **unmigrated prototype codebase**. It cannot run directly against a database that has completed the Expand phase without either:
- **Approach A (Synchronous Application Modernization)**: Refactoring the entire application to Target Revision 4 models before bringing the service back online.
- **Approach B (Staged Dual-Write / Adapter Layer)**: Creating a compatibility adapter service that maps legacy controller calls to target tables.
- **Approach C (Maintenance Window Deployment)**: Keeping the backend service completely **OFFLINE** while the database undergoes Enum Transition (13.2B) and Expand (13.2), and only updating the codebase in Phase 2.

---

### 6. Required Pre-Transition Application Preparation

Before Prompt 13.2B is executed on `pos_db`, the following application preparation protocol is mandatory:

```text
+-----------------------------------------------------------------------------------+
| PRE-TRANSITION APPLICATION PREPARATION PROTOCOL                                   |
+-----------------------------------------------------------------------------------+
| 1. SERVICE DRAIN & SHUTDOWN:                                                      |
|    - The application MUST be shut down prior to Prompt 13.2B.                     |
|    - Under NO circumstances may the unmigrated prototype application be allowed   |
|      to execute writes against pos_db while enums are in Target Revision 4.       |
|                                                                                   |
| 2. SOURCE CODE PREPARATION (STAGING BRANCH):                                      |
|    - A dedicated branch (e.g. `feat/target-enum-compatibility`) must be prepared  |
|      updating the 9 lines in inventory, order, product, and saas controllers.     |
|    - This branch must NOT be merged to main until the database migration commits. |
|                                                                                   |
| 3. PRISMA CLIENT FREEZE:                                                          |
|    - Do not run `prisma generate` during migration execution.                     |
|    - Verify that node_modules/@prisma/client matches schema.prisma.               |
+-----------------------------------------------------------------------------------+
```

---

### 7. Safe Deployment Sequence (Consolidated)

```text
================================================================================
CONSOLIDATED DEPLOYMENT PROTOCOL — DATABASE & APPLICATION
================================================================================
PHASE 1: APPLICATION QUIESCENCE & FREEZE
  1.1 Gracefully stop Node.js server (terminate port 5001).
  1.2 Reject incoming traffic at gateway (HTTP 503 Maintenance Mode).
  1.3 Confirm zero client connections on pos_db:
      SELECT count(*) FROM pg_stat_activity WHERE datname = 'pos_db' AND pid <> pg_backend_pid();

PHASE 2: PRE-TRANSITION SNAPSHOT
  2.1 Execute physical dump: server/backups/pos_db_pre_enum_transition_<ts>.dump
  2.2 Verify dump via pg_restore --list; record SHA-256 checksum.

PHASE 3: DATABASE ENUM VOCABULARY TRANSITION (PROMPT 13.2B)
  3.1 Execute prompt_13_2b_enum_vocabulary_alignment.sql atomically.
  3.2 Audit pg_enum: confirm all 10 enums match Target Revision 4.
  3.3 Audit pos_db data: confirm 17 rows mapped (ADJUSTMENT -> OPNAME_ADJUSTMENT).
  3.4 Verify _prompt_12_ownership_registry pre-seeded with PRE_EXISTING_EXACT_COMPATIBLE_REUSED.

PHASE 4: DATABASE EXPAND PHASE MIGRATION (PROMPT 13.2 RETRY)
  4.1 Execute server/prisma/migrations/20260919000000_expand_phase_ddl/migration.sql.
  4.2 Confirm 18 target tables, 23 transition columns, 34 indexes created.
  4.3 Run test_prompt_12_6_reconciliation.ts (verify 102/102 PASS).
  4.4 Run test_expand_safety.ts (verify 0 violations).

PHASE 5: APPLICATION MODERNIZATION / ENUM COMPATIBILITY UPDATE
  5.1 Checkout application compatibility branch (`feat/target-enum-compatibility`).
  5.2 Update the 9 legacy enum invocations across the 4 controllers.
  5.3 Execute npx prisma generate.
  5.4 Verify build readiness: npx tsc --noEmit (ensure 0 enum-related errors).

PHASE 6: SERVICE RESTORATION & UNFREEZE
  6.1 Start backend application service on port 5001.
  6.2 Execute health-check probe (/health, /api/auth/status).
  6.3 Remove maintenance freeze; resume routing.
================================================================================
```

---

### 8. Application Rollback Sequence

If Expand or Enum Transition fails and must be rolled back:

```text
================================================================================
APPLICATION ROLLBACK TIMELINE
================================================================================
STEP 1: CONFIRM APPLICATION IS STOPPED
  - Ensure backend application on port 5001 remains offline.
  - No application traffic may touch the database during rollback.

STEP 2: DATABASE ROLLBACK (STRICT REVERSE ORDER)
  2.1 Run Expand rollback.sql (drops target tables, preserves enums).
  2.2 Verify Expand target tables are gone (count = 0).
  2.3 Run rollback preconditions for Prompt 13.2B (ensure 0 target-only rows).
  2.4 Run rollback_prompt_13_2b_enum_vocabulary.sql (restores legacy enums).

STEP 3: APPLICATION CODE REVERSION
  3.1 Revert application source code to legacy prototype commit (`git checkout main`).
  3.2 Regenerate legacy Prisma Client (if schema.prisma was altered) or reinstall node_modules.
  3.3 Verify application matches legacy database catalog.

STEP 4: SERVICE RESTART
  4.1 Restart backend application service on port 5001.
  4.2 Verify legacy routes function against restored prototype database.
================================================================================
```

---

### 9. Multi-Stage Recovery Interaction

| State | Database Catalog | `@prisma/client` | Application Source Code | Service Status | Recovery Action if Rollback Triggered |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Pre-13.2B** | Legacy (10 enums) | Target Rev 4 | Legacy | OFFLINE | N/A (Baseline) |
| **Post-13.2B** | Target Rev 4 (10 enums) | Target Rev 4 | Legacy | OFFLINE | Run `rollback_prompt_13_2b_enum_vocabulary.sql` |
| **Post-13.2 (Expand)** | Target Rev 4 (20 enums) | Target Rev 4 | Legacy | OFFLINE | Run `rollback.sql` → then run enum rollback |
| **Post-Code-Update** | Target Rev 4 (20 enums) | Target Rev 4 | Target Compatible | ONLINE | Revert git branch → run `rollback.sql` → run enum rollback |

**Critical Invariant**: Database rollback alone is **INSUFFICIENT** if the application code has already been updated to target vocabulary. Application code and database catalog must always be rolled back in synchronized tandem.

---

### 10. Owner Authorization Boundary

The Project Owner must understand and ratify two separate scopes of authority:

```text
+-------------------------------------------------------------------------------+
| BOUNDARY 1: DATABASE MIGRATION AUTHORIZATION (ODR-13.2B)                     |
+-------------------------------------------------------------------------------+
| Scope: Authorizes database DDL/DML on pos_db:                                 |
| - Execute Prompt 13.2B Enum Vocabulary Transition                             |
| - Execute Prompt 13.2 Expand Phase DDL Retry                                  |
| - Pre-seed _prompt_12_ownership_registry                                      |
+-------------------------------------------------------------------------------+
                                      ≠
+-------------------------------------------------------------------------------+
| BOUNDARY 2: APPLICATION CODE REFACTORING AUTHORIZATION (OAUTH-APP-COMPAT)     |
+-------------------------------------------------------------------------------+
| Scope: Authorizes TypeScript source code modifications in server/src/:        |
| - Update 9 lines in inventory, order, product, and saas controllers           |
| - Migrate references from PURCHASE_IN/DAMAGE_OUT/ADJUSTMENT/SUCCESS to Target |
| - Rebuild/re-test application service                                         |
+-------------------------------------------------------------------------------+
```

**Explicit Statement**: Authorizing Prompt 13.2B does **NOT** authorize application code refactoring. Application code edits must be authorized under a dedicated instruction packet.

---

### 11. Remaining Risks
1. **Divergence of Unmigrated Controllers**: Even if enum literals are updated, 362 TypeScript errors remain in `server/src/` due to legacy model references (`outletProduct`, `stockMovement`). This confirms that the legacy application cannot be run against the post-Expand database without an application modernization phase.
2. **Maintenance Downtime**: Because the prototype application is not dual-write capable, zero-downtime transition is not possible. A planned maintenance freeze (offline window) is mandatory.

---

### 12. Final Gate

In accordance with Prompt 13.2B-REV2 instructions:

## **READY FOR OWNER DECISION**

*(The application compatibility lifecycle, static enum usage inventory, Prisma Client state, 362 TypeScript compile errors, safe deployment sequence, synchronized rollback runbooks, and authorization boundaries have been fully articulated without assumptions. Zero database mutations and zero code modifications were performed. Awaiting Project Owner instruction.)*

---

### 13. Explicit Confirmation: STOP
**Zero database mutations and zero application code modifications were performed during Prompt 13.2B-REV2.** No DDL, no DML, no enum alteration, no migration retry, no Expand execution, no Prisma regeneration, and no application restart occurred. Execution has halted completely.
