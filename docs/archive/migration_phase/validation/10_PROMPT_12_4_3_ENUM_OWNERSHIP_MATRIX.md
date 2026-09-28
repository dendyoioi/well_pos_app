# 10_PROMPT_12_4_3_ENUM_OWNERSHIP_MATRIX.md
## Target Database Schema Revision 4 Enum Ownership Provenance Matrix

### 1. Execution Stage
- **Stage**: Prompt 12.4.3 — Enum Ownership Provenance & Rerun Hardening
- **Authoritative Target Schema**: `/docs/architecture/04_TARGET_DATABASE_SCHEMA.md` (`ARCH-2026-09-DB-SCHEMA-04`)
- **Core Principle**: Ownership represents historical provenance, not merely current catalog state. `EXACT_MATCH != PRE_EXISTING`. Existing registry provenance is immutable and strictly preserved across safe reruns.

---

### 2. Comprehensive 20-Enum Ownership Provenance Matrix

| Enum Name | Catalog State (`pos_db` Baseline) | Registry State | Ownership State | Rerun Behavior | Rollback Action | Evidence / Reference |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `PlatformRole` | `INCOMPATIBLE` (Labels: `SUPER_ADMIN`, `SUPPORT_AGENT`, `FINANCE_ADMIN`) | `ABSENT` (Unregistered) | `FAIL CLOSED` | Aborts transaction on catalog contract mismatch | `DO NOT DROP (SAFE ABORT)` | Schema Rev 4: line 853; `migration.sql` line 147; `pg_enum` |
| `TenantStatus` | `INCOMPATIBLE` (Labels: `TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`, `PENDING`) | `ABSENT` (Unregistered) | `FAIL CLOSED` | Aborts transaction on extra label `PENDING` | `DO NOT DROP (SAFE ABORT)` | Schema Rev 4: line 859; `migration.sql` line 147; `pg_enum` |
| `BusinessVertical` | `ABSENT` (Not in catalog before Expand) | `ABSENT` (First run) / `CREATED_BY_PROMPT_12_4_2` (Rerun) | `CREATED_BY_PROMPT_12_4_2` | Created on first run; on rerun, verified exact and preserved as `CREATED_BY_PROMPT_12_4_2` (no downgrade) | `DROP TYPE IF EXISTS "BusinessVertical"` | Schema Rev 4: line 866; `migration.sql` line 161; `rollback.sql` line 146 |
| `BillingCycle` | `EXACT` (Labels: `MONTHLY`, `ANNUALLY`) | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` (Pre-seeded) | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` | Verified exact; preserved as `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` without modification | `PRESERVE (NO ACTION)` | Schema Rev 4: line 873; `migration.sql` line 155; `rollback.sql` line 154 |
| `InvoiceStatus` | `INCOMPATIBLE` (Labels: `UNPAID`, `PAID`, `CANCELLED`, `EXPIRED`) | `ABSENT` (Unregistered) | `FAIL CLOSED` | Aborts transaction on vocabulary mismatch | `DO NOT DROP (SAFE ABORT)` | Schema Rev 4: line 878; `migration.sql` line 147; `pg_enum` |
| `PaymentRecordStatus` | `ABSENT` (Not in catalog before Expand) | `ABSENT` (First run) / `CREATED_BY_PROMPT_12_4_2` (Rerun) | `CREATED_BY_PROMPT_12_4_2` | Created on first run; on rerun, verified exact and preserved as `CREATED_BY_PROMPT_12_4_2` (no downgrade) | `DROP TYPE IF EXISTS "PaymentRecordStatus"` | Schema Rev 4: line 885; `migration.sql` line 161; `rollback.sql` line 146 |
| `Role` | `INCOMPATIBLE` (Labels: `ADMIN`, `SUPERVISOR`, `WAREHOUSE`, `CASHIER`) | `ABSENT` (Unregistered) | `FAIL CLOSED` | Aborts transaction on missing/extra labels | `DO NOT DROP (SAFE ABORT)` | Schema Rev 4: line 891; `migration.sql` line 147; `pg_enum` |
| `ShiftStatus` | `EXACT` (Labels: `OPEN`, `CLOSED`) | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` (Pre-seeded) | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` | Verified exact; preserved as `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` without modification | `PRESERVE (NO ACTION)` | Schema Rev 4: line 900; `migration.sql` line 155; `rollback.sql` line 154 |
| `ProductType` | `ABSENT` (Not in catalog before Expand) | `ABSENT` (First run) / `CREATED_BY_PROMPT_12_4_2` (Rerun) | `CREATED_BY_PROMPT_12_4_2` | Created on first run; on rerun, verified exact and preserved as `CREATED_BY_PROMPT_12_4_2` (no downgrade) | `DROP TYPE IF EXISTS "ProductType"` | Schema Rev 4: line 905; `migration.sql` line 161; `rollback.sql` line 146 |
| `SelectionType` | `ABSENT` (Not in catalog before Expand) | `ABSENT` (First run) / `CREATED_BY_PROMPT_12_4_2` (Rerun) | `CREATED_BY_PROMPT_12_4_2` | Created on first run; on rerun, verified exact and preserved as `CREATED_BY_PROMPT_12_4_2` (no downgrade) | `DROP TYPE IF EXISTS "SelectionType"` | Schema Rev 4: line 911; `migration.sql` line 161; `rollback.sql` line 146 |
| `UomType` | `ABSENT` (Not in catalog before Expand) | `ABSENT` (First run) / `CREATED_BY_PROMPT_12_4_2` (Rerun) | `CREATED_BY_PROMPT_12_4_2` | Created on first run; on rerun, verified exact and preserved as `CREATED_BY_PROMPT_12_4_2` (no downgrade) | `DROP TYPE IF EXISTS "UomType"` | Schema Rev 4: line 916; `migration.sql` line 161; `rollback.sql` line 146 |
| `StorageLocationType` | `ABSENT` (Not in catalog before Expand) | `ABSENT` (First run) / `CREATED_BY_PROMPT_12_4_2` (Rerun) | `CREATED_BY_PROMPT_12_4_2` | Created on first run; on rerun, verified exact and preserved as `CREATED_BY_PROMPT_12_4_2` (no downgrade) | `DROP TYPE IF EXISTS "StorageLocationType"` | Schema Rev 4: line 924; `migration.sql` line 161; `rollback.sql` line 146 |
| `StockMovementType` | `INCOMPATIBLE` (Legacy prototype vocabulary) | `ABSENT` (Unregistered) | `FAIL CLOSED` | Aborts transaction on vocabulary mismatch | `DO NOT DROP (SAFE ABORT)` | Schema Rev 4: line 932; `migration.sql` line 147; `pg_enum` |
| `InventoryRefType` | `ABSENT` (Not in catalog before Expand) | `ABSENT` (First run) / `CREATED_BY_PROMPT_12_4_2` (Rerun) | `CREATED_BY_PROMPT_12_4_2` | Created on first run; on rerun, verified exact and preserved as `CREATED_BY_PROMPT_12_4_2` (no downgrade) | `DROP TYPE IF EXISTS "InventoryRefType"` | Schema Rev 4: line 945; `migration.sql` line 161; `rollback.sql` line 146 |
| `ActorType` | `ABSENT` (Not in catalog before Expand) | `ABSENT` (First run) / `CREATED_BY_PROMPT_12_4_2` (Rerun) | `CREATED_BY_PROMPT_12_4_2` | Created on first run; on rerun, verified exact and preserved as `CREATED_BY_PROMPT_12_4_2` (no downgrade) | `DROP TYPE IF EXISTS "ActorType"` | Schema Rev 4: line 955; `migration.sql` line 161; `rollback.sql` line 146 |
| `OrderStatus` | `ABSENT` (Not in catalog before Expand) | `ABSENT` (First run) / `CREATED_BY_PROMPT_12_4_2` (Rerun) | `CREATED_BY_PROMPT_12_4_2` | Created on first run; on rerun, verified exact and preserved as `CREATED_BY_PROMPT_12_4_2` (no downgrade) | `DROP TYPE IF EXISTS "OrderStatus"` | Schema Rev 4: line 960; `migration.sql` line 161; `rollback.sql` line 146 |
| `PaymentStatus` | `INCOMPATIBLE` (Labels: `PAID`, `CANCELLED`, `REFUNDED`) | `ABSENT` (Unregistered) | `FAIL CLOSED` | Aborts transaction on missing/extra labels | `DO NOT DROP (SAFE ABORT)` | Schema Rev 4: line 970; `migration.sql` line 147; `pg_enum` |
| `PaymentMethod` | `INCOMPATIBLE` (Labels: `CASH`, `QRIS`) | `ABSENT` (Unregistered) | `FAIL CLOSED` | Aborts transaction on missing 5 labels | `DO NOT DROP (SAFE ABORT)` | Schema Rev 4: line 978; `migration.sql` line 147; `pg_enum` |
| `PaymentTxStatus` | `INCOMPATIBLE` (Labels: `SUCCESS`, `PENDING`, `FAILED`) | `ABSENT` (Unregistered) | `FAIL CLOSED` | Aborts transaction on extra `SUCCESS`, missing labels | `DO NOT DROP (SAFE ABORT)` | Schema Rev 4: line 988; `migration.sql` line 147; `pg_enum` |
| `RefundReason` | `ABSENT` (Not in catalog before Expand) | `ABSENT` (First run) / `CREATED_BY_PROMPT_12_4_2` (Rerun) | `CREATED_BY_PROMPT_12_4_2` | Created on first run; on rerun, verified exact and preserved as `CREATED_BY_PROMPT_12_4_2` (no downgrade) | `DROP TYPE IF EXISTS "RefundReason"` | Schema Rev 4: line 996; `migration.sql` line 161; `rollback.sql` line 146 |

---

### 3. Provenance & State Invariants Summary
1. **Zero Ownership Inferences from Existence Alone**:
   If an enum exists in the catalog but has no registry record (`v_has_reg = false`), migration raises `ENUM OWNERSHIP PROVENANCE UNVERIFIED` and fails closed (P-05).
2. **Zero Downgrade on Rerun**:
   If registry proves `CREATED_BY_PROMPT_12_4_2`, rerun retains `CREATED_BY_PROMPT_12_4_2` with `rollback_action = 'DROP'` (P-03, P-11). It is never downgraded to `PRE_EXISTING_EXACT_COMPATIBLE_REUSED`.
3. **Rollback Triple-Proof Invariant**:
   Rollback drops an enum IF AND ONLY IF `created_by_migration = true AND ownership = 'CREATED_BY_PROMPT_12_4_2' AND rollback_action = 'DROP'` (P-12).
4. **Fail-Closed on Registry Contradictions**:
   Any mismatch between catalog state, registry ownership, and rollback action triggers an immediate transaction abort (P-06, P-07, P-08, P-09, P-10, P-15).
