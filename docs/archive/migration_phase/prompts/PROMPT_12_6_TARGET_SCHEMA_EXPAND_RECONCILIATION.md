# PROMPT 12.6 — TARGET SCHEMA & EXPAND ARTIFACT RECONCILIATION AFTER OWNER CONFIRMATION

## Project
Well POS Multi-Tenant SaaS Platform

## Execution Stage
Prompt 12.6 — Final Target Contract Reconciliation After Owner Decision Register

## Preceding Gate
Prompt 12.5-D = `OWNER CONFIRMED`

## Owner Authority
The Project Owner has explicitly confirmed ODR-01 through ODR-06 as final decisions.

## Purpose

Reconcile the approved Owner decisions with all canonical implementation specifications and Expand migration artifacts **before Prompt 13**.

This prompt is an implementation-preparation and contract-reconciliation stage.

It must make the following invariant true:

```text
FINAL OWNER DECISIONS
=
TARGET DATABASE SCHEMA
=
PRISMA TARGET CONTRACT
=
APPLICATION ENUM / ROLE CONTRACT
=
EXPAND MIGRATION CONTRACT
=
ROLLBACK CONTRACT
=
PREFLIGHT CONTRACT
=
OWNERSHIP INVENTORY
=
DOCUMENTED ARTIFACT INVENTORY
```

This prompt does NOT authorize staging or production migration.

---

# 1. SOURCE-OF-TRUTH HIERARCHY

Use this order:

1. Existing source code + actual database/catalog evidence
2. Explicit Owner-confirmed ODR-01 through ODR-06
3. Approved ADRs
4. Target Database Schema Revision 4, updated through this prompt
5. Existing validated migration/rollback artifacts
6. Generated reports

If generated artifacts conflict with an Owner-confirmed decision or canonical target contract, correct the artifact. Do not weaken the contract to make an artifact pass.

Do not invent new Owner decisions.

---

# 2. OWNER-CONFIRMED DECISIONS — BINDING CONTRACT

The following are FINAL.

## ODR-01 — PlatformRole

Canonical:

```text
SUPER_ADMIN
SUPPORT
BILLING
```

Legacy prototype names are not preserved as compatibility aliases:

```text
SUPPORT_AGENT -> SUPPORT
FINANCE_ADMIN -> BILLING
```

Current data is prototype/dummy and does not require historical role preservation.

---

## ODR-02 — TenantStatus

Canonical onboarding lifecycle:

```text
REGISTER
  -> PENDING
  -> SUPERADMIN REVIEW
  -> TRIAL
  -> ACTIVE
```

Therefore the canonical `TenantStatus` target enum MUST include:

```text
TRIAL
ACTIVE
SUSPENDED
CANCELLED
PENDING
```

Preserve the approved target vocabulary and add `PENDING` as required by the Owner decision.

Do not remove or silently rename `PENDING`.

---

## ODR-03 — InvoiceStatus

Canonical:

```text
DRAFT
UNPAID
PAID
VOID
```

Prototype `CANCELLED` / `EXPIRED` terminology is not retained.

Phase 1 SaaS billing:

```text
DRAFT
 -> UNPAID
 -> manual payment submission
 -> manual review
 -> PAID
```

Cancellation is represented by `VOID`.

Phase 1 does NOT introduce payment gateway/webhook assumptions.

Do not confuse `InvoiceStatus` with any stale/non-canonical `SubscriptionInvoiceStatus`.

---

## ODR-04 — Role

Canonical application roles:

```text
OWNER
ADMIN
SUPERVISOR
WAREHOUSE
CASHIER
KITCHEN
WAITER
```

`WAREHOUSE` is an official role.

Do not replace it with a new permission model in this prompt.

---

## ODR-05 — Inventory History

Current `stock_movements` data is prototype/dummy.

Decision:

```text
NO HISTORICAL BACKFILL OF CURRENT STOCK_MOVEMENTS
```

Inventory starts clean using the target architecture:

```text
InventoryItem
 -> StorageLocation
 -> InventoryBalance
 -> authorized opening stock
 -> InventoryLedger
```

Do not fabricate historical:

- balanceBefore
- balanceAfter
- unitCost
- batch
- location
- actor provenance
- movement semantics

`InventoryLedger` remains an immutable append-only stock movement ledger.

Important terminology:

`InventoryLedger` is NOT an accounting double-entry ledger.

---

## ODR-06 — PaymentTxStatus

Canonical:

```text
PENDING
CAPTURED
FAILED
REFUNDED
VOIDED
```

Prototype `SUCCESS` is not retained.

Phase 1 manual verification:

```text
PENDING
 -> operator verification
 -> CAPTURED
```

Future payment gateways may use the same canonical `CAPTURED` state.

Keep these concepts separate:

```text
OrderStatus
PaymentStatus
PaymentTxStatus
```

---

# 3. REQUIRED TARGET SCHEMA RECONCILIATION

Update the canonical Target Database Schema Revision 4 specification only as required to incorporate the confirmed Owner decisions.

## Required changes

### 3.1 TenantStatus

Current target:

```text
TRIAL
ACTIVE
SUSPENDED
CANCELLED
```

Required canonical target:

```text
TRIAL
ACTIVE
SUSPENDED
CANCELLED
PENDING
```

Verify all references and ordering.

### 3.2 Role

Current target:

```text
OWNER
ADMIN
SUPERVISOR
CASHIER
KITCHEN
WAITER
```

Required canonical target:

```text
OWNER
ADMIN
SUPERVISOR
WAREHOUSE
CASHIER
KITCHEN
WAITER
```

### 3.3 Other target contracts

Do NOT change other enum vocabularies merely because the legacy database differs.

In particular verify that:

- PlatformRole remains `SUPER_ADMIN, SUPPORT, BILLING`
- InvoiceStatus remains `DRAFT, UNPAID, PAID, VOID`
- PaymentTxStatus remains `PENDING, CAPTURED, FAILED, REFUNDED, VOIDED`
- PaymentStatus remains separate from PaymentTxStatus
- OrderStatus remains separate from PaymentStatus
- StockMovementType target remains the canonical target vocabulary
- PaymentRecordStatus is not incorrectly conflated with PaymentTxStatus

---

# 4. PRISMA TARGET CONTRACT RECONCILIATION

Inspect the actual Prisma schema.

Validate:

- enum definitions exactly match the reconciled target contract;
- TenantStatus includes PENDING;
- Role includes WAREHOUSE;
- no stale enum labels remain where they are prohibited;
- no invented enum aliases are added;
- model fields, defaults, nullability, precision/scale and relations remain unchanged unless required by the reconciled target contract;
- no unsupported `UserOutletAssignment` or similar Phase 2 model is introduced;
- no `InventoryBalance.isNegativeBalance` field is introduced;
- `InventoryLedger.isNegativeBalance` remains the approved target field;
- Model B User identity remains intact.

Do not use Prisma migration generation as a substitute for contract review.

---

# 5. APPLICATION ENUM / RBAC RECONCILIATION

Inspect backend and frontend.

Validate:

## PlatformRole

All application references use:

```text
SUPER_ADMIN
SUPPORT
BILLING
```

## TenantStatus

Registration and approval workflow supports:

```text
PENDING
TRIAL
ACTIVE
SUSPENDED
CANCELLED
```

Verify current onboarding code remains semantically correct.

## Role

All role types and RBAC references support:

```text
OWNER
ADMIN
SUPERVISOR
WAREHOUSE
CASHIER
KITCHEN
WAITER
```

Do not remove existing WAREHOUSE UI capability.

## Payment

Verify the distinction:

```text
PaymentStatus
PaymentTxStatus
```

and manual Phase 1 flow.

## Inventory

Verify no application logic assumes historical migration of prototype `stock_movements`.

---

# 6. EXPAND MIGRATION ARTIFACT RECONCILIATION

Inspect the current executable:

- Expand migration SQL
- rollback SQL
- preflight
- ownership registry
- object inventory
- schema contract tests
- enum contract tests
- rollback tests
- static safety scans

The artifacts must now reflect:

```text
TenantStatus + PENDING
Role + WAREHOUSE
```

without weakening the existing Prompt 12.4 ownership and rollback guarantees.

For enums:

- exact ordered label contract;
- exact catalog validation;
- ownership provenance;
- catalog identity verification;
- rollback triple-proof;
- no blind DROP;
- no `DROP TYPE IF EXISTS` in owned rollback paths.

For target tables/indexes/FKs:

- preserve the previously established complete contract;
- do not regress the 18 target tables / 34 target indexes / 40 target FKs / transition objects;
- derive counts from executable artifacts rather than hardcoding them.

---

# 7. LEGACY DATA / PROTOTYPE DATA POLICY

This prompt must NOT execute reset/delete.

It may document the future clean-initialization strategy.

Required distinction:

```text
CURRENT DATA = PROTOTYPE / DUMMY
```

does NOT mean:

```text
DELETE NOW
```

No DML is authorized.

For ODR-05:

- no historical stock movement backfill design is required;
- future opening stock must be explicit and authorized;
- opening stock must create mathematically valid InventoryBalance and InventoryLedger state;
- do not manufacture historical events.

---

# 8. PAYMENT ARCHITECTURE RECONCILIATION

Phase 1 payment architecture is:

### SaaS invoice

```text
DRAFT
 -> UNPAID
 -> manual payment
 -> manual review
 -> PAID
```

### POS payment transaction

```text
PENDING
 -> manual cashier/operator verification
 -> CAPTURED
```

No:

- payment gateway integration
- webhook
- automatic reconciliation daemon
- gateway-specific status vocabulary

is authorized by this prompt.

Do not design future gateway details beyond preserving the canonical `CAPTURED` boundary.

---

# 9. REQUIRED ARTIFACTS

Produce/update:

1. Target Schema Revision 4 reconciliation artifact
2. Prisma target contract reconciliation report
3. Application enum/RBAC reconciliation report
4. Expand migration contract reconciliation report
5. Rollback contract reconciliation report
6. Final object inventory
7. Final enum contract inventory
8. Validation test evidence
9. Final Prompt 12.6 report

Recommended paths:

```text
/docs/validation/13_PROMPT_12_6_TARGET_SCHEMA_RECONCILIATION.md
/docs/validation/13_PROMPT_12_6_PRISMA_CONTRACT_RECONCILIATION.md
/docs/validation/13_PROMPT_12_6_APP_ENUM_RBAC_RECONCILIATION.md
/docs/validation/13_PROMPT_12_6_EXPAND_CONTRACT_RECONCILIATION.md
/docs/validation/13_PROMPT_12_6_ROLLBACK_CONTRACT_RECONCILIATION.md
/docs/validation/13_PROMPT_12_6_OBJECT_INVENTORY.md
/docs/validation/13_PROMPT_12_6_ENUM_CONTRACT_INVENTORY.md
/docs/validation/13_PROMPT_12_6_VALIDATION_EVIDENCE.md
/docs/validation/13_PROMPT_12_6_FINAL_REPORT.md
```

Use actual repository conventions if they differ, but document the final paths.

---

# 10. REQUIRED VALIDATION SCENARIOS

At minimum test:

### Owner Decision Contract

- ODR-01 canonical PlatformRole
- ODR-02 PENDING onboarding
- ODR-03 InvoiceStatus/manual payment
- ODR-04 WAREHOUSE role
- ODR-05 no stock movement backfill
- ODR-06 PaymentTxStatus/CAPTURED

### Schema

- TenantStatus exact contract
- Role exact contract
- all other 20 enum contracts remain intentional
- no accidental enum vocabulary changes
- target table contracts remain valid
- index contracts remain valid
- FK contracts remain valid

### Application

- registration writes PENDING
- approval can transition PENDING -> TRIAL
- WAREHOUSE role remains usable
- manual payment lifecycle remains valid
- PaymentStatus and PaymentTxStatus remain distinct

### Migration safety

- ownership registry consistent
- no ownership downgrade
- no pre-existing object mutation
- rollback remains ownership-safe
- catalog identity checks remain enforced
- legacy tables remain protected
- static scan passes

---

# 11. FORBIDDEN ACTIONS

The executing agent MUST NOT:

- execute staging migration;
- execute production migration;
- execute Backfill;
- execute Dual-write;
- execute Cutover;
- execute Contract;
- delete dummy data;
- reset the real database;
- run destructive DML;
- run Prompt 13;
- introduce payment gateway integration;
- invent new Owner decisions;
- weaken validation criteria;
- silently alter Target Schema decisions beyond ODR-01..06.

If repository edits are necessary, they must be limited to the explicitly authorized contract reconciliation in this prompt.

No database execution against `pos_db` is allowed.

A disposable local test database may be used only for validation.

---

# 12. SOURCE-CODE / ARTIFACT CONSISTENCY RULE

If any of the following disagree:

```text
Target Schema
Prisma
Backend enums
Frontend types
Migration SQL
Rollback SQL
Preflight
Ownership inventory
Object inventory
Validation reports
```

do not simply choose whichever passes.

Trace the discrepancy to the source-of-truth hierarchy and correct the generated/derived artifact.

Every final report must state the discrepancy and its resolution.

---

# 13. FINAL GATE

Allowed final gates:

## READY FOR OWNER REVIEW

Only if:

- ODR-01..06 are correctly incorporated;
- Target Schema Revision 4 is internally consistent;
- Prisma target contract is consistent;
- application enum/RBAC contracts are consistent;
- Expand migration matches target;
- rollback matches ownership rules;
- enum catalog/ownership contract remains safe;
- object inventory is complete;
- validation tests pass;
- no unexplained contradiction remains;
- no staging/production migration occurred;
- no DML/reset occurred;
- Prompt 13 did not start.

OR:

## BLOCKED / OWNER REVIEW REQUIRED

If ANY:

- target contract mismatch;
- application inconsistency;
- migration mismatch;
- rollback weakness;
- ownership ambiguity;
- unexplained artifact contradiction;
- failed validation;
- unverified critical condition

remains.

Do not downgrade a blocker to a warning.

---

# 14. STOP CONDITION

After producing the final report:

**STOP.**

Do not start Prompt 13.

Do not execute any migration phase.

Wait for Project Owner review and authorization.

---

# 15. FINAL RESPONSE FORMAT

Return:

1. final gate;
2. ODR-01..06 reconciliation summary;
3. Target Schema changes;
4. Prisma reconciliation;
5. application enum/RBAC reconciliation;
6. Expand migration reconciliation;
7. rollback reconciliation;
8. object/enum inventory summary;
9. validation test results;
10. unresolved blockers;
11. explicit confirmation that no real `pos_db` mutation occurred;
12. exact artifact paths.

END OF PROMPT 12.6
