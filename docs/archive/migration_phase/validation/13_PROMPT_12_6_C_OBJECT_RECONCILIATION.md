# 13_PROMPT_12_6_C_OBJECT_RECONCILIATION.md
## Executable Object Inventory & Protected Legacy Baseline Reconciliation Report

### 1. Document Control & Executive Summary
- **Stage**: Prompt 12.6-C — Executable Object Inventory & Protected Legacy Baseline Reconciliation
- **Parent Stage**: Prompt 12.6 — Target Schema & Expand Artifact Reconciliation after Owner Confirmation
- **Status**: ANALYSIS & ARTIFACT RECONCILIATION COMPLETE
- **Lead System**: Lead Database & Systems Architect (Antigravity)
- **Database Status**: Real PostgreSQL `pos_db` is STRICTLY UNTOUCHED (Zero DDL, Zero DML, Zero Data Loss).
- **Core Findings**:
  1. Executable `migration.sql` and `rollback.sql` contain an exact, coherent universe of **18 target core tables**, **1 registry table**, **20 custom enums**, **23 transition columns**, **34 target indexes**, and **40 target foreign keys**.
  2. The table `price_histories` is definitively resolved as a **phantom documentation-only entry** mistakenly introduced in the draft text of `13_PROMPT_12_6_FINAL_REPORT.md`. It does NOT exist in `migration.sql`, `rollback.sql`, `04_TARGET_DATABASE_SCHEMA.md`, `schema.prisma`, or `pos_db`. Target Schema Revision 4 does NOT require it.
  3. The table `legacy_stock_movements` is the true 18th executable target table created by `migration.sql` and torn down by `rollback.sql`.
  4. The authoritative set of protected pre-existing legacy tables contains **exactly 18 tables**, identical across `rollback.sql` (lines 80–83), `test_expand_safety.ts` (lines 258–264), live `pos_db` catalog (`information_schema.tables`), and `13_PROMPT_12_6_OBJECT_INVENTORY.md`.
  5. The previous discrepancies in `13_PROMPT_12_6_FINAL_REPORT.md` and `test_prompt_12_6_reconciliation.ts` arose because an obsolete speculative audit list (`cash_movements`, `discounts`, `taxes`, `printers`, `kitchen_stations`, `modifiers`) was pasted into those two files instead of referencing the actual catalog and executable DDL.

---

### 2. Executable Object Derivation (from `migration.sql`)

Direct AST and procedural parsing of `/server/prisma/migrations/20260919000000_expand_phase_ddl/migration.sql` reveals:

1. **Registry Table (Section 0)**:
   - `_prompt_12_ownership_registry` (primary key: `object_type, object_name, parent_name`).
2. **Target Custom Enums (Section 1.1)**:
   - Evaluated via `temp_target_enums` containing exactly **20 enum definitions**:
     `PlatformRole`, `TenantStatus`, `BusinessVertical`, `BillingCycle`, `InvoiceStatus`, `PaymentRecordStatus`, `Role`, `ShiftStatus`, `ProductType`, `SelectionType`, `UomType`, `StorageLocationType`, `StockMovementType`, `InventoryRefType`, `ActorType`, `OrderStatus`, `PaymentStatus`, `PaymentMethod`, `PaymentTxStatus`, `RefundReason`.
   - Created dynamically if absent via `EXECUTE format('CREATE TYPE %I AS ENUM (...)')`.
3. **Target Core Tables (Section 2)**:
   - Exactly **18 tables** created additively with `CREATE TABLE IF NOT EXISTS`:
     1. `inventory_items`
     2. `product_variants`
     3. `storage_locations`
     4. `inventory_batches`
     5. `inventory_balances`
     6. `inventory_ledgers`
     7. `unit_conversions`
     8. `recipes`
     9. `recipe_items`
     10. `modifier_groups`
     11. `modifier_items`
     12. `product_modifier_groups`
     13. `modifier_recipe_effects`
     14. `payment_transactions`
     15. `refunds`
     16. `refund_items`
     17. `idempotency_records`
     18. `legacy_stock_movements`
4. **Transition Columns (Section 3 & Preflight Section 1.3)**:
   - Exactly **23 columns** added across 8 legacy tables via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`:
     - `tenants`: `business_vertical`, `allow_negative_stock`, `enable_batch_tracking`, `enable_recipe_tracking` (4)
     - `users`: `user_code`, `pin_hash` (2)
     - `outlets`: `code` (1)
     - `products`: `type` (1)
     - `categories`: `parent_id` (1)
     - `customers`: `loyalty_points`, `metadata` (2)
     - `orders`: `order_status`, `order_type`, `service_total`, `paid_amount`, `change_amount` (5)
     - `order_items`: `product_variant_id`, `product_name`, `variant_name`, `sku`, `cost_price`, `discount_amount`, `modifiers_snapshot` (7)
5. **Target Indexes (Section 2 & Preflight Section 1.4)**:
   - Exactly **34 indexes** created with `CREATE [UNIQUE] INDEX IF NOT EXISTS` and audited in `temp_target_indexes`.
6. **Target Foreign Keys (Section 2 & Preflight Section 1.2)**:
   - Exactly **40 target foreign key constraints** audited in `temp_target_table_fks` (plus 2 transition foreign keys on `categories.parent_id` and `order_items.product_variant_id`).

---

### 3. Executable Rollback Object Derivation (from `rollback.sql`)

Direct parsing of `/server/prisma/migrations/20260919000000_expand_phase_ddl/rollback.sql` reveals:

1. **Pre-condition Gate**: Fails closed with `ROLLBACK ABORTED` if `_prompt_12_ownership_registry` is missing.
2. **Phase 0: Indexes**: Drops indexes where `object_type = 'INDEX'` and ownership is verified.
3. **Phase 1: Transition Columns**: Drops transition columns where `object_type = 'COLUMN'` on the 8 operational tables:
   `('tenants', 'outlets', 'users', 'products', 'categories', 'customers', 'orders', 'order_items')`.
4. **Phase 2: Target Tables**: Drops target tables in strict reverse-dependency order:
   ```sql
   v_table_order := ARRAY[
       'legacy_stock_movements',
       'idempotency_records',
       'refund_items',
       'refunds',
       'payment_transactions',
       'modifier_recipe_effects',
       'product_modifier_groups',
       'modifier_items',
       'modifier_groups',
       'recipe_items',
       'recipes',
       'unit_conversions',
       'inventory_ledgers',
       'inventory_balances',
       'inventory_batches',
       'storage_locations',
       'product_variants',
       'inventory_items'
   ];
   ```
   Each table is verified against `_prompt_12_ownership_registry` before issuing `DROP TABLE IF EXISTS`.
5. **Phase 3: Custom Enums**: Drops only enums satisfying the 6-part proof (ownership, catalog identity, enum type, namespace, exact label match).
6. **Phase 4: Registry**: Drops `_prompt_12_ownership_registry` only if created by migration.
7. **Protected Tables Guard**: Explicitly preserves all 18 pre-existing legacy tables.

---

### 4. Definitive Resolution of `price_histories`

```text
PRICE_HISTORIES
Actual executable status: ABSENT (0 occurrences in migration.sql)
Target Schema status:     ABSENT (0 occurrences in 04_TARGET_DATABASE_SCHEMA.md)
Prisma status:            ABSENT (0 occurrences in schema.prisma)
Rollback status:          ABSENT (0 occurrences in rollback.sql)
Ownership status:         ABSENT (0 occurrences in _prompt_12_ownership_registry)
Catalog status (pos_db):  ABSENT (0 occurrences in pos_db)
Final classification:     5. ACCIDENTAL INVENTORY / REPORT ENTRY
Required artifact correction:
  - Remove "price_histories" from 13_PROMPT_12_6_FINAL_REPORT.md.
  - Reaffirm "legacy_stock_movements" as the true 18th executable table.
  - No DDL changes permitted or needed.
```

**Architectural Rationale**: In earlier RFC drafts, price history was discussed as a possible future sub-table for multi-price scheduling. However, Target Schema Revision 4 locked `ProductVariant.price` with direct auditing, intentionally omitting a separate `price_histories` table for Phase 1. The appearance of `price_histories` in Prompt 12.6 Final Report line 49 was a draft documentation typo, not an unfulfilled schema requirement.

---

### 5. Authoritative Protected Legacy Baseline Derivation

By cross-referencing:
- `rollback.sql` lines 80–83,
- `test_expand_safety.ts` lines 258–264,
- `pos_db` PostgreSQL catalog (`information_schema.tables`),
- `13_PROMPT_12_6_OBJECT_INVENTORY.md` Section 6,

The authoritative, immutable set of **18 Protected Pre-Existing Legacy Tables** is:

| # | Protected Legacy Table | Existing in `pos_db` | Guarded in `migration.sql` | Guarded in `rollback.sql` | Asserted in `test_expand_safety.ts` |
| :-: | :--- | :---: | :---: | :---: | :---: |
| 1 | `categories` | YES (1 row) | YES | YES | YES |
| 2 | `customers` | YES (0 rows) | YES | YES | YES |
| 3 | `hold_orders` | YES (0 rows) | YES | YES | YES |
| 4 | `order_items` | YES (0 rows) | YES | YES | YES |
| 5 | `orders` | YES (0 rows) | YES | YES | YES |
| 6 | `outlet_products` | YES (2 rows) | YES | YES | YES |
| 7 | `outlets` | YES (2 rows) | YES | YES | YES |
| 8 | `payments` | YES (0 rows) | YES | YES | YES |
| 9 | `platform_users` | YES (1 row) | YES | YES | YES |
| 10 | `products` | YES (1 row) | YES | YES | YES |
| 11 | `saas_invoices` | YES (0 rows) | YES | YES | YES |
| 12 | `saas_payments` | YES (0 rows) | YES | YES | YES |
| 13 | `shifts` | YES (0 rows) | YES | YES | YES |
| 14 | `stock_movements` | YES (2 rows) | YES | YES | YES |
| 15 | `subscription_plans`| YES (4 rows) | YES | YES | YES |
| 16 | `tenant_subscriptions`| YES (1 row) | YES | YES | YES |
| 17 | `tenants` | YES (1 row) | YES | YES | YES |
| 18 | `users` | YES (2 rows) | YES | YES | YES |

**Origin of Discrepancy**: An obsolete audit list (`cash_movements`, `discounts`, `taxes`, `printers`, `kitchen_stations`, `modifiers`) was inadvertently copied into `13_PROMPT_12_6_FINAL_REPORT.md` (line 60) and `test_prompt_12_6_reconciliation.ts` (line 125). None of those 6 tables exist in `pos_db`. Furthermore, that obsolete list erroneously treated `modifier_groups` as a legacy table, whereas `modifier_groups` is in fact a new target table created by `migration.sql`.

---

### 6. Comprehensive Count Reconciliation

| Object Category | Authoritative Executable Count | Provenance / Evidence |
| :--- | :---: | :--- |
| **Ownership Registry** | **1** | `_prompt_12_ownership_registry` (migration.sql:29) |
| **Custom Enums** | **20** | `temp_target_enums` (migration.sql:104-124; rollback.sql:130-150) |
| **Target Core Tables** | **18** | `v_target_tables` (migration.sql:224; rollback.sql:84) |
| **Transition Columns** | **23** | `temp_transition_cols` (migration.sql:250-272; Section 3:836-874) |
| **Target Indexes** | **34** | `temp_target_indexes` (migration.sql:469-503; test_expand_safety.ts:169-204) |
| **Target Foreign Keys** | **40** | `temp_target_table_fks` (migration.sql:418-458) |
| **Transition Foreign Keys**| **2** | `categories.parent_id`, `order_items.product_variant_id` (migration.sql:852, 866) |
| **Protected Legacy Tables**| **18** | PostgreSQL catalog `pos_db`, `rollback.sql:80-83`, `test_expand_safety.ts:258-264` |

---

### 7. Ownership Reconciliation

1. **Registry Storage**: `_prompt_12_ownership_registry` tracks:
   - `object_type`: `'REGISTRY'`, `'TYPE'`, `'TABLE'`, `'COLUMN'`, `'INDEX'`
   - `parent_name`: Schema or parent table name
   - `object_name`: Object identifier
   - `ownership`: `'CREATED_BY_PROMPT_12_4_2'` or `'PRE_EXISTING_EXACT_COMPATIBLE_REUSED'`
   - `compatibility_state`: `'NEW_OBJECT'` or `'EXACT_COMPATIBLE'`
   - `created_by_migration`: `BOOLEAN`
   - `rollback_action`: `'DROP'` or `'PRESERVE'`
2. **Fail-Closed Invariant**:
   - If an object pre-exists with exact contract equality, it is registered with `rollback_action = 'PRESERVE'`.
   - If an object pre-exists with ANY deviation, migration aborts immediately to fail closed.
   - Rollback NEVER drops any object whose registry record has `rollback_action = 'PRESERVE'`.
   - Zero cascade is used.

---

### 8. Safety Test Coverage Analysis

1. **`test_expand_safety.ts` (Static AST Safety Validator)**:
   - Inspects `migration.sql` and `rollback.sql`.
   - Asserts all **18 real protected legacy tables** by name (lines 258–264).
   - Asserts all **34 target indexes** by name (lines 169–204).
   - Asserts all **20 custom enums** by name (lines 304–325).
   - Asserts 0 forbidden operations (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE`).
   - Asserts no CASCADE on `DROP TABLE` in rollback.
   - **Coverage Status**: `COMPLETE & AUTHORITATIVE`.
2. **`test_prompt_12_6_reconciliation.ts` (Dynamic Consistency Suite)**:
   - Passed 102/102 assertions.
   - **Identified Gap**: Line 125 contained the obsolete 18-table audit list (`cash_movements`, `discounts`, etc.) instead of the true 18 protected tables. While it verified that `migration.sql` did not drop any of those tables, it omitted checking `outlets`, `saas_invoices`, `saas_payments`, `platform_users`, `outlet_products`, `hold_orders`, and `subscription_plans`.
   - Per Prompt 12.6-C Section 8 instruction: *"Do not modify tests in this prompt. Incomplete coverage is an evidence gap/blocker."*

---

### 9. Discrepancies and Evidence-Based Resolutions

| # | Discrepancy Description | Source Files | Evidence-Based Resolution |
| :-: | :--- | :--- | :--- |
| **D-01** | `price_histories` listed in Final Report as a target table | `13_PROMPT_12_6_FINAL_REPORT.md` vs `migration.sql` | Resolved as a documentation typo. The true 18th target table is `legacy_stock_movements`. `price_histories` does not exist in any DDL, schema, or database. |
| **D-02** | Target table name typo in Final Report (`inventory_ledger` singular, `modifier_groups_target` suffixed) | `13_PROMPT_12_6_FINAL_REPORT.md` vs `migration.sql` | Resolved. Executable names are `inventory_ledgers` (plural) and `modifier_groups` (without suffix). |
| **D-03** | Obsolete legacy table list in Final Report and `test_prompt_12_6_reconciliation.ts` | `13_PROMPT_12_6_FINAL_REPORT.md`, `test_prompt_12_6_reconciliation.ts` vs `rollback.sql`, `pos_db` | Resolved. The authoritative protected baseline consists of the 18 tables verified in `pos_db` and guarded in `rollback.sql`. Obsolete tables (`cash_movements`, `discounts`, `taxes`, `printers`, `kitchen_stations`, `modifiers`) removed from baseline. |
| **D-04** | Speculative transition column names in `13_PROMPT_12_6_OBJECT_INVENTORY.md` | `13_PROMPT_12_6_OBJECT_INVENTORY.md` vs `migration.sql` | Resolved. Executable transition columns in `migration.sql` Section 3 are the authoritative 23 columns. Documentation updated to reflect exact SQL identifiers. |
| **D-05** | Safety test legacy array in `test_prompt_12_6_reconciliation.ts` misses 7 real legacy tables | `test_prompt_12_6_reconciliation.ts` vs `test_expand_safety.ts` | Documented as an evidence gap. Per Prompt 12.6-C instruction, test files are not modified in this prompt. |

---

### 10. Residual Risks
1. **Rerun Invariants**: If `migration.sql` is rerun after partial failure, the deterministic preflight handles existing objects gracefully, provided `_prompt_12_ownership_registry` has not been manually tampered with.
2. **Transition Column Nullability**: All 23 transition columns have safe defaults or are nullable, eliminating any write locking or transaction timeouts during the Expand phase.

---

### 11. Final Gate Recommendation

Per Prompt 12.6-C Section 8 ("Do not modify tests in this prompt. Incomplete coverage is an evidence gap/blocker") and Section 18:

Because `test_prompt_12_6_reconciliation.ts` contains the obsolete legacy table array and cannot be modified within Prompt 12.6-C, and because the Owner must explicitly review and confirm the removal of phantom `price_histories` and the reconciliation of the 18 protected legacy tables:

# **FINAL GATE: BLOCKED / OWNER REVIEW REQUIRED**

**Blocker Summary for Owner Review**:
1. **Confirmation of `price_histories` Removal**: Owner review required to confirm that `price_histories` is a documentation artifact and that Phase 1 target schema does NOT require it.
2. **Confirmation of 18 Protected Legacy Tables**: Owner review required to formally acknowledge that the 18 protected legacy tables are: `categories`, `customers`, `hold_orders`, `order_items`, `orders`, `outlet_products`, `outlets`, `payments`, `platform_users`, `products`, `saas_invoices`, `saas_payments`, `shifts`, `stock_movements`, `subscription_plans`, `tenant_subscriptions`, `tenants`, `users`, and authorize updating the array in `test_prompt_12_6_reconciliation.ts` in the next phase.
