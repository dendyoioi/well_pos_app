# PROMPT 12.5 — ENUM VOCABULARY MIGRATION STRATEGY & DATA DEPENDENCY REVIEW

## 0. Execution Contract

**Execution Stage:** Prompt 12.5  
**Classification:** OWNER-AUTHORIZED — ANALYSIS / RECONNAISSANCE / STRATEGY ONLY

### Objective

Perform a read-only analysis of the eight legacy PostgreSQL enum vocabularies in the real `pos_db` that are currently incompatible with Target Database Schema Revision 4.

The purpose is to determine:
1. where each enum is used;
2. what legacy values actually exist in the database;
3. what application/schema dependencies exist;
4. whether each legacy value has a deterministic target mapping;
5. which mappings are technically safe versus requiring explicit owner/domain decisions;
6. what migration strategy would be required later.

This prompt MUST NOT implement any enum migration.

---

# 1. Mandatory Scope

Analyze exactly these eight enums:

1. `PlatformRole`
2. `TenantStatus`
3. `InvoiceStatus`
4. `Role`
5. `StockMovementType`
6. `PaymentStatus`
7. `PaymentMethod`
8. `PaymentTxStatus`

The real legacy baseline established by Prompt 12.4.4-C is:

| Enum | Legacy `pos_db` vocabulary | Target Revision 4 |
|---|---|---|
| PlatformRole | `SUPER_ADMIN`, `SUPPORT_AGENT`, `FINANCE_ADMIN` | `SUPER_ADMIN`, `SUPPORT`, `BILLING` |
| TenantStatus | `TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`, `PENDING` | `TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED` |
| InvoiceStatus | `UNPAID`, `PAID`, `CANCELLED`, `EXPIRED` | `DRAFT`, `UNPAID`, `PAID`, `VOID` |
| Role | `ADMIN`, `SUPERVISOR`, `WAREHOUSE`, `CASHIER` | `OWNER`, `ADMIN`, `SUPERVISOR`, `CASHIER`, `KITCHEN`, `WAITER` |
| StockMovementType | `PURCHASE_IN`, `SALE_OUT`, `DAMAGE_OUT`, `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT` | Target Revision 4 `StockMovementType` vocabulary |
| PaymentStatus | `PAID`, `CANCELLED`, `REFUNDED` | `UNPAID`, `PARTIALLY_PAID`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED` |
| PaymentMethod | `CASH`, `QRIS` | `CASH`, `QRIS`, `CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`, `EWALLET`, `VOUCHER` |
| PaymentTxStatus | `SUCCESS`, `PENDING`, `FAILED` | `PENDING`, `CAPTURED`, `FAILED`, `REFUNDED`, `VOIDED` |

For `StockMovementType`, DO NOT invent the target vocabulary if it is not directly available from the canonical Target Revision 4 schema/artifacts. Read the exact target labels from the canonical artifact and report them.

---

# 2. Source-of-Truth Hierarchy

Use this hierarchy:

1. Existing source code + actual `pos_db` catalog/data
2. Approved Target Database Schema Revision 4
3. Approved ADR / migration-readiness artifacts
4. This prompt

Do not silently modify or reinterpret the target schema.

If a fact cannot be verified, classify it explicitly as:

- `VERIFIED`
- `NOT VERIFIED`
- `NOT APPLICABLE`
- `BLOCKED BY ACCESS`

Never infer missing database facts.

---

# 3. Absolute Prohibitions

This prompt is READ-ONLY.

DO NOT:

- `ALTER TYPE`
- `CREATE TYPE`
- `DROP TYPE`
- `ALTER TABLE` for enum migration
- rename enum labels
- rewrite existing enum values
- update legacy data
- execute migration.sql against `pos_db`
- execute Expand
- execute Backfill
- execute Dual-write
- execute Cutover
- execute Contract
- modify Prisma schema
- modify Target Database Schema Revision 4
- modify production/staging data
- create a migration file intended for execution
- change application behavior
- start Prompt 13

Temporary disposable test fixtures are permitted only if needed for analysis, and must not be presented as evidence of the real `pos_db`.

---

# 4. Required Analysis Per Enum

For each of the eight enums, produce all of the following.

## 4.1 Catalog Contract

Verify from the actual database:

- enum exists / absent
- PostgreSQL type
- schema/namespace
- exact ordered labels
- dependency count where determinable

## 4.2 Usage Discovery

Find every usage in:

### Database
- table
- column
- view
- materialized view
- function
- trigger
- index/constraint
- default
- generated expression
- other PostgreSQL dependency

### Application
Search the repository for:

- enum name
- each legacy label
- each target label
- Prisma enum references
- TypeScript/JavaScript constants
- validation schemas
- API request/response handling
- authorization checks
- reporting/filtering logic
- seed/test fixtures

Do not stop at Prisma schema usage.

## 4.3 Existing Data Distribution

For every enum-backed column in the real `pos_db`, determine:

- total rows
- NULL count if nullable
- count per enum value
- tenant distribution if applicable
- whether inactive/archived records contain values
- whether there are values outside the enum domain through related text fields or legacy representations

Do not modify data.

## 4.4 Mapping Analysis

For every legacy value classify the relationship to Target Revision 4:

- `EXACT`
- `DIRECT_RENAME`
- `SEMANTIC_TRANSFORM`
- `SPLIT_REQUIRED`
- `MERGE_REQUIRED`
- `NO_SAFE_MAPPING`
- `TARGET_ADDITIVE_ONLY`
- `LEGACY_ONLY`
- `REQUIRES_OWNER_DECISION`

A mapping must be supported by actual usage/context.

Do NOT decide that a label is equivalent merely because its name looks similar.

---

# 5. Special Rules Per Enum

## 5.1 PlatformRole

Investigate whether:

- `SUPPORT_AGENT` really corresponds to target `SUPPORT`
- `FINANCE_ADMIN` really corresponds to target `BILLING`

Review actual authorization behavior and usage before proposing any mapping.

Do not approve the mapping yourself if the evidence is insufficient.

## 5.2 TenantStatus

Investigate `PENDING`.

Determine:

- which records use it;
- what business state it represents;
- whether it can safely map to an existing target state;
- whether it requires a transition/state migration before enum conversion.

Do NOT automatically delete or map `PENDING`.

## 5.3 InvoiceStatus

Investigate:

- `CANCELLED`
- `EXPIRED`
- target `DRAFT`
- target `VOID`

Determine whether these represent equivalent lifecycle states.

Do not assume `CANCELLED → VOID`.

## 5.4 Role

Investigate:

- `WAREHOUSE`
- target `OWNER`
- target `KITCHEN`
- target `WAITER`

Do not automatically map `WAREHOUSE` to another role.

Review actual users, permissions, outlet assignment, and application authorization logic.

## 5.5 StockMovementType

Read the exact Target Revision 4 enum vocabulary.

For every legacy movement value, inspect:

- direction
- affected inventory
- reference type
- reference source
- whether it represents stock movement, adjustment, transfer, damage, sale, purchase, or another domain event.

Do not map purely by string similarity.

Also determine whether historical `StockMovement` records should eventually become:

- `InventoryLedger` history,
- archived legacy history,
- transformed historical movements,
- or remain outside the new ledger.

This is analysis only.

## 5.6 PaymentStatus

Investigate:

- `PAID`
- `CANCELLED`
- `REFUNDED`

Compare actual order/payment lifecycle usage with Target Revision 4's separate:

- `OrderStatus`
- `PaymentStatus`
- `PaymentTransaction`
- `Refund`

Do not collapse order status and payment status.

## 5.7 PaymentMethod

Investigate existing `CASH` and `QRIS` usage.

Determine whether the current legacy representation contains:

- provider identifiers
- gateway references
- transaction references
- QRIS-specific metadata
- external payment IDs

Target additional methods are additive and must not be retroactively assigned to legacy transactions without evidence.

## 5.8 PaymentTxStatus

Investigate:

- `SUCCESS`
- `PENDING`
- `FAILED`

Determine whether legacy `SUCCESS` is semantically equivalent to target `CAPTURED`, or whether evidence requires another treatment.

Review actual transaction/payment gateway fields if present.

Do not assume `SUCCESS → CAPTURED` without evidence.

---

# 6. Dependency Risk Analysis

For each enum identify:

### A. Data risk
Could conversion lose information?

### B. Semantic risk
Could two labels that look equivalent represent different business states?

### C. Referential risk
Would changing the enum break existing references?

### D. Application risk
Would existing code behavior change?

### E. Historical/audit risk
Would historical records become ambiguous?

### F. Migration sequencing risk
Does this enum need a transitional representation before Target Revision 4 can be adopted?

Classify each:

- LOW
- MEDIUM
- HIGH
- BLOCKER

Explain the evidence.

---

# 7. Required Proposed Strategy

For each enum provide a proposed future strategy, but DO NOT implement it.

Possible strategy categories:

1. `DIRECT_COMPATIBILITY`
2. `TRANSITIONAL_TEXT/CODE`
3. `NEW_TARGET_ENUM + DATA TRANSFORM`
4. `LEGACY_ENUM PRESERVED + NEW TARGET FIELD`
5. `ARCHIVE-ONLY LEGACY HISTORY`
6. `OWNER DECISION REQUIRED`
7. `NOT YET DETERMINABLE`

The strategy must include:

- prerequisite
- migration ordering
- data transformation requirement
- rollback consideration
- validation requirement

---

# 8. Owner Decision Register

Create an explicit decision table containing every issue that cannot safely be resolved technically.

Minimum expected candidates include, where evidence supports them:

- PlatformRole mapping
- TenantStatus.PENDING treatment
- InvoiceStatus.CANCELLED / EXPIRED mapping
- Role.WAREHOUSE treatment
- PaymentTxStatus.SUCCESS → CAPTURED
- historical StockMovementType treatment

Do not manufacture decisions merely to complete the table.

---

# 9. Required Artifacts

Create:

1. `/docs/validation/11_PROMPT_12_5_ENUM_VOCABULARY_ANALYSIS.md`
2. `/docs/validation/11_PROMPT_12_5_ENUM_USAGE_INVENTORY.md`
3. `/docs/validation/11_PROMPT_12_5_ENUM_DATA_DISTRIBUTION.md`
4. `/docs/validation/11_PROMPT_12_5_ENUM_MAPPING_MATRIX.md`
5. `/docs/validation/11_PROMPT_12_5_ENUM_DEPENDENCY_RISK.md`
6. `/docs/validation/11_PROMPT_12_5_OWNER_DECISION_REGISTER.md`
7. `/docs/validation/11_PROMPT_12_5_FINAL_REPORT.md`

If actual repository/database evidence requires additional supporting read-only scripts, they may be created under the migration validation/test area, but they must be clearly marked analysis-only and must not mutate `pos_db`.

---

# 10. Mandatory Validation Tests

Create and execute read-only validation tests covering at minimum:

- `EVM-01` all 8 real enum catalogs identified
- `EVM-02` exact ordered labels captured
- `EVM-03` every database dependency discovered or explicitly marked NOT VERIFIED
- `EVM-04` every application dependency searched
- `EVM-05` row/value distribution captured for every enum-backed column
- `EVM-06` NULL handling captured where applicable
- `EVM-07` every legacy value has an explicit mapping classification
- `EVM-08` no mapping is accepted solely by label similarity
- `EVM-09` owner decisions are explicitly separated from technical findings
- `EVM-10` no database mutation occurred
- `EVM-11` no schema/migration artifact was modified
- `EVM-12` target vocabulary is sourced from canonical Target Revision 4
- `EVM-13` StockMovementType target labels are verified rather than invented
- `EVM-14` historical StockMovement treatment is explicitly analyzed
- `EVM-15` PaymentStatus vs OrderStatus separation is preserved
- `EVM-16` final strategy is non-executable / analysis-only

All tests must PASS, or be explicitly marked BLOCKED with evidence.

---

# 11. Evidence Requirements

Every factual finding must identify its source:

- PostgreSQL catalog query
- PostgreSQL data query
- source file/path
- Prisma schema
- Target Revision 4 artifact
- previous validation artifact

Do not cite a disposable fixture as evidence of real `pos_db`.

If `pos_db` access is unavailable, stop the affected analysis and mark it `BLOCKED BY ACCESS`.

---

# 12. Gate Rules

Final Gate may be:

### READY FOR OWNER REVIEW

Only if:

- all eight enums were analyzed;
- actual database usage/data was inspected;
- mappings are evidence-based;
- unresolved semantic decisions are explicitly listed;
- no mutation occurred;
- all mandatory tests PASS.

### BLOCKED

If:

- real `pos_db` cannot be inspected;
- target vocabulary cannot be verified;
- important dependencies cannot be discovered;
- evidence is contradictory;
- any prohibited mutation occurred.

Do not declare migration-ready from this prompt.

---

# 13. STOP CONDITION

After producing the artifacts and final report:

**STOP.**

Do not:

- create or execute enum migration SQL;
- execute Expand;
- proceed to Backfill;
- proceed to Dual-write;
- proceed to Cutover;
- proceed to Contract;
- start Prompt 13.

Return the final report and wait for Owner Review.

---

# 14. Final Response Required From Antigravity

Return:

1. final gate;
2. eight-enum summary;
3. actual legacy value distribution;
4. dependency inventory status;
5. mapping matrix summary;
6. owner decision register summary;
7. proposed non-executable migration strategy;
8. validation test result;
9. artifact inventory;
10. explicit statement confirming no mutation of `pos_db`;
11. blockers, if any.

**END OF PROMPT 12.5**
