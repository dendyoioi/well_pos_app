# PROMPT 13.2A — ENUM PROVENANCE vs VOCABULARY BLOCKER ANALYSIS

## 0. Execution Contract

**Stage:** Prompt 13.2A — Post-Expand Failure Analysis
**Classification:** READ-ONLY / ANALYSIS / NO DATABASE MUTATION
**Parent Stage:** Prompt 13.2 — Expand Migration Execution
**Trigger:** Authorized Expand attempt `OAUTH-13.2-01` aborted safely at Section 0.2.

### Objective

Analyze the exact runtime blocker:

> `ENUM OWNERSHIP PROVENANCE UNVERIFIED: Enum "PlatformRole" exists in PostgreSQL catalog, but has no ownership record in "_prompt_12_ownership_registry".`

Determine how the Expand lifecycle can proceed **without weakening the already-ratified enum safety contract** and without silently changing Owner Decisions ODR-01..06.

This prompt is analysis-only. It MUST NOT execute DDL, DML, migration, rollback, reset, truncate, delete, enum alteration, or application changes.

---

# 1. Source-of-Truth Hierarchy

Use exactly:

1. Existing source code + actual `pos_db` catalog/data
2. Approved Target Database Schema Revision 4 (`ARCH-2026-09-DB-SCHEMA-04`)
3. Approved Owner Decisions ODR-01..06
4. Prompt 12.4 / 12.6 enum and rollback hardening artifacts
5. Prompt 13.1 / 13.2 execution evidence
6. This prompt

Do not silently revise the target schema.

---

# 2. Current Verified Runtime State

The last authorized Expand attempt produced:

- `pos_db` on `localhost:5432`, PostgreSQL 14.23.
- Expand executed under `OAUTH-13.2-01`.
- `migration.sql` ran inside an atomic transaction.
- Migration aborted at Section 0.2, before target objects were created.
- Exit code: `3`.
- `_prompt_12_ownership_registry` was rolled back and does not exist.
- Target core tables: `0`.
- Protected legacy tables: `18`.
- Total rows: `17`.
- No enum was altered or dropped.
- No Backfill / Dual-write / Cutover / Contract / Prompt 14+ was executed.

Treat this as the current baseline unless direct verification proves otherwise.

---

# 3. Critical Enum Contract Already Ratified

The target contract contains 20 enum types.

Current live `pos_db` classification:

### Exact-compatible pre-existing enums

- `BillingCycle`
- `ShiftStatus`
- `TenantStatus`

These match the target contract exactly and may be classified as:

`PRE_EXISTING_EXACT_COMPATIBLE_REUSED`

with rollback action `PRESERVE`.

### Pre-existing incompatible enums

- `PlatformRole`
- `InvoiceStatus`
- `Role`
- `StockMovementType`
- `PaymentStatus`
- `PaymentMethod`
- `PaymentTxStatus`

These MUST remain `PRE_EXISTING_INCOMPATIBLE` until a separately authorized transition strategy is approved.

The exact target vocabulary MUST NOT be weakened into subset/superset compatibility.

---

# 4. Exact Known Vocabulary Differences

Use the verified live baseline and target contract.

| Enum | Current `pos_db` vocabulary | Target vocabulary | Current live data |
|---|---|---|---|
| `PlatformRole` | `SUPER_ADMIN`, `SUPPORT_AGENT`, `FINANCE_ADMIN` | `SUPER_ADMIN`, `SUPPORT`, `BILLING` | 1 row: `SUPER_ADMIN` |
| `TenantStatus` | `TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`, `PENDING` | same 5 labels | 1 row: `TRIAL` |
| `InvoiceStatus` | `UNPAID`, `PAID`, `CANCELLED`, `EXPIRED` | `DRAFT`, `UNPAID`, `PAID`, `VOID` | 0 rows |
| `Role` | `ADMIN`, `SUPERVISOR`, `WAREHOUSE`, `CASHIER` | `OWNER`, `ADMIN`, `SUPERVISOR`, `WAREHOUSE`, `CASHIER`, `KITCHEN`, `WAITER` | 2 rows: `ADMIN`, `CASHIER` |
| `StockMovementType` | `PURCHASE_IN`, `SALE_OUT`, `DAMAGE_OUT`, `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT` | `SALE`, `PURCHASE`, `TRANSFER_IN`, `TRANSFER_OUT`, `OPNAME_ADJUSTMENT`, `RETURN`, `WASTE`, `VOID`, `PRODUCTION_CONSUMPTION`, `PRODUCTION_OUTPUT` | 2 rows: `ADJUSTMENT` |
| `PaymentStatus` | `PAID`, `UNPAID`, `CANCELLED`, `REFUNDED` | `UNPAID`, `PARTIALLY_PAID`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED` | 0 rows |
| `PaymentMethod` | `CASH`, `QRIS` | `CASH`, `QRIS`, `CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`, `EWALLET`, `VOUCHER` | 0 rows |
| `PaymentTxStatus` | `SUCCESS`, `PENDING`, `FAILED` | `PENDING`, `CAPTURED`, `FAILED`, `REFUNDED`, `VOIDED` | 0 rows |

For `StockMovementType`, preserve the approved canonical target list above exactly.

---

# 5. Root Problem To Analyze

The current Expand contract has two independent safety concepts:

### A. Ownership provenance

A registry record is required before a pre-existing object may be treated as reusable.

### B. Exact vocabulary compatibility

A pre-existing enum may only be reused if its complete ordered definition is exactly equal to the target definition.

The failed runtime shows that the first check currently runs before a usable provenance record exists on first execution.

However, simply pre-seeding all ten existing enums as `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` would be incorrect because seven live enums are vocabulary-incompatible.

Analyze these concepts separately.

---

# 6. Required Analysis Questions

Answer every item with `VERIFIED`, `NOT VERIFIED`, `BLOCKED BY ACCESS`, or `NOT APPLICABLE` where appropriate.

### Q1 — First-run registry semantics

Explain whether Section 0 creating an empty `_prompt_12_ownership_registry` and then demanding an existing record for every pre-existing enum is logically compatible with first-run execution.

Do not change the rule in this prompt; analyze it.

### Q2 — Exact-compatible enum handling

For the three exact-compatible enums, determine whether a controlled first-run registration step could establish:

`PRE_EXISTING_EXACT_COMPATIBLE_REUSED`

without modifying the enum itself.

Specify what exact catalog evidence must be captured before registration.

### Q3 — Incompatible enum handling

For the seven incompatible enums, determine the minimum additional migration stage required before the target schema can safely use the target enum vocabulary.

Do not implement it.

### Q4 — Data mapping determinism

For every live value that actually exists in `pos_db`, determine whether a deterministic mapping to the future target vocabulary exists.

Known live enum rows must be assessed individually.

Do not assume zero-row legacy values can be ignored unless the future contract explicitly permits dropping them.

### Q5 — Column dependency inventory

Identify every legacy table/column currently using the seven incompatible enums.

For each one, record:

- table
- column
- enum type
- current values/counts
- target enum type
- conversion requirement
- dependency risk

### Q6 — Prisma/application dependency impact

Identify repository code that depends on each incompatible enum's legacy labels.

At minimum inspect:

- Prisma schema
- backend enum/type definitions
- frontend role/type usage
- query filters
- validation logic
- RBAC / authorization checks
- serialization/deserialization
- seed/demo data

Do not edit any file.

### Q7 — Option comparison

Analyze at least these strategies:

**Option A — First-run provenance bootstrap only**

Register only exact-compatible existing enums before/inside Expand, while keeping incompatible enums fail-closed.

**Option B — Separate authorized enum vocabulary transition before Expand**

Perform a dedicated migration stage that safely transitions affected legacy enum columns/types to the approved target vocabulary, with explicit mapping and rollback design.

**Option C — Prototype database reset/rebuild**

Assess whether recreating the prototype database from the approved target contract is technically possible, what data would be lost, and whether existing Owner Decisions actually authorize such a reset.

**Option D — Change target enum names / Prisma mapping to avoid collision**

Assess whether this preserves or violates Target Schema Revision 4 and the existing contract.

Do not declare a winner. Report technical consequences and prerequisites only.

### Q8 — Rollback safety

For each option, analyze whether rollback can:

- restore all legacy columns and values;
- preserve unrelated pre-existing enums;
- avoid dropping the wrong PostgreSQL type;
- restore catalog identity where relevant;
- remain deterministic after partial failure.

### Q9 — Expand dependency

Determine exactly which current migration sections depend on the seven incompatible enum names/definitions and whether Expand can be split so that unrelated additive tables can be created first without violating the target contract.

Do not modify migration SQL.

### Q10 — Required Owner Decision

State precisely what decision(s) the Project Owner must make before any mutation can be authorized.

Do not invent a decision or implicitly approve one.

---

# 7. Mandatory Safety Rules

DO NOT:

- execute `migration.sql`;
- execute `rollback.sql`;
- alter any enum;
- rename any enum;
- add/drop enum labels;
- alter legacy columns;
- create registry records in `pos_db`;
- create target tables;
- modify Prisma schema;
- modify application source;
- reset/truncate/delete data;
- create a backup as a substitute for analysis;
- rerun Expand.

Read-only catalog queries and static repository inspection are allowed.

---

# 8. Required Output Artifact

Create:

`/docs/validation/15_PROMPT_13_2A_ENUM_PROVENANCE_VOCABULARY_BLOCKER_ANALYSIS.md`

The artifact MUST contain exactly these sections:

1. Executive Summary
2. Evidence / Files Inspected
3. Live Enum Baseline
4. Provenance vs Vocabulary Analysis
5. Column Dependency Inventory
6. Live Data Mapping Analysis
7. Prisma / Application Dependency Analysis
8. Option A Analysis
9. Option B Analysis
10. Option C Analysis
11. Option D Analysis
12. Rollback / Recovery Analysis
13. Expand Dependency Analysis
14. Required Owner Decisions
15. Database Safety Attestation
16. Final Gate
17. Explicit Confirmation — No Database Mutation

---

# 9. Final Gate

Allowed final gate:

## `READY FOR OWNER DECISION`

only when the blocker is fully analyzed and no unanswered critical dependency remains.

Otherwise:

## `BLOCKED / OWNER REVIEW REQUIRED`

This prompt MUST NOT authorize implementation.

---

# 10. STOP CONDITION

After creating the analysis artifact:

**STOP.**

Do not execute any option.

Do not modify migration SQL.

Do not rerun Expand.

Wait for Project Owner review and explicit authorization.
