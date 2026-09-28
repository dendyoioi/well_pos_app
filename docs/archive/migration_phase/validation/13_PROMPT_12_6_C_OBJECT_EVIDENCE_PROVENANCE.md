# 13_PROMPT_12_6_C_OBJECT_EVIDENCE_PROVENANCE.md
## Object Inventory Evidence Provenance & Cross-Check Audit

### 1. Document Control
- **Stage**: Prompt 12.6-C — Executable Object Inventory & Protected Legacy Baseline Reconciliation
- **Purpose**: Document exact evidentiary provenance for all architectural, catalog, and executable object claims.
- **Evidence Hierarchy**:
  1. `EXECUTABLE_SQL`: DDL statements in `migration.sql` and `rollback.sql`.
  2. `POSTGRES_CATALOG`: Real PostgreSQL catalog metadata (`pos_db`) via `information_schema` and `pg_*` system catalogs.
  3. `TARGET_SCHEMA`: `04_TARGET_DATABASE_SCHEMA.md` (`ARCH-2026-09-DB-SCHEMA-04`).
  4. `PRISMA_SCHEMA`: `server/prisma/schema.prisma`.
  5. `TEST_CODE`: Automated test assertions in `test_expand_safety.ts` and `test_prompt_12_6_reconciliation.ts`.
  6. `DOCUMENTATION`: Derived reports and inventories in `/docs/validation/`.

---

### 2. Evidentiary Provenance Ledger

#### 2.1 Ownership Registry (1 Table)
- **Claim**: Exactly 1 ownership registry table exists (`_prompt_12_ownership_registry`).
- **Source File**: `/server/prisma/migrations/20260919000000_expand_phase_ddl/migration.sql`
- **Exact Statement**: Line 29: `CREATE TABLE "_prompt_12_ownership_registry" (...);`
- **Evidence Type**: `EXECUTABLE_SQL`
- **Derived or Declared**: Derived from executable DDL.
- **Cross-Check Result**: Verified in `rollback.sql` (line 29), `test_expand_safety.ts` (line 135), and `13_PROMPT_12_6_OBJECT_INVENTORY.md` (line 21).

#### 2.2 Target Custom Enums (20 Enums)
- **Claim**: Exactly 20 custom enum types are evaluated and managed.
- **Source File**: `/server/prisma/migrations/20260919000000_expand_phase_ddl/migration.sql`
- **Exact Statement**: Lines 104–124: `INSERT INTO temp_target_enums (enum_name, target_labels) VALUES ('PlatformRole', ...), ..., ('RefundReason', ...);`
- **Evidence Type**: `EXECUTABLE_SQL`
- **Derived or Declared**: Derived from executable preflight array.
- **Cross-Check Result**: Exact 20 matches found in `rollback.sql` (lines 130–150), `04_TARGET_DATABASE_SCHEMA.md` (lines 850–1000), `schema.prisma` (lines 750–850), `test_expand_safety.ts` (lines 304–325), and `13_PROMPT_12_6_ENUM_CONTRACT_INVENTORY.md`.

#### 2.3 Target Core Tables (18 Tables)
- **Claim**: Exactly 18 target core tables are created by migration and dropped by rollback.
- **Source File**: `/server/prisma/migrations/20260919000000_expand_phase_ddl/migration.sql`
- **Exact Statement**: Lines 224–229: `v_target_tables := ARRAY['inventory_items', 'product_variants', 'storage_locations', 'inventory_batches', 'inventory_balances', 'inventory_ledgers', 'unit_conversions', 'recipes', 'recipe_items', 'modifier_groups', 'modifier_items', 'product_modifier_groups', 'modifier_recipe_effects', 'payment_transactions', 'refunds', 'refund_items', 'idempotency_records', 'legacy_stock_movements'];`
- **Evidence Type**: `EXECUTABLE_SQL`
- **Derived or Declared**: Derived from executable preflight and Section 2 DDL.
- **Cross-Check Result**: Exact reverse dependency array verified in `rollback.sql` (lines 84–103). Verified in `13_PROMPT_12_6_OBJECT_INVENTORY.md` (Section 3).

#### 2.4 Status of `price_histories` (0 Tables)
- **Claim**: `price_histories` does NOT exist in the executable migration, Target Schema, Prisma, or database.
- **Source Files**:
  - `migration.sql`: 0 matches for `price_histories`.
  - `rollback.sql`: 0 matches for `price_histories`.
  - `04_TARGET_DATABASE_SCHEMA.md`: 0 matches for `price_histories`.
  - `schema.prisma`: 0 matches for `price_histories`.
  - `pos_db` catalog: 0 matches in `information_schema.tables`.
- **Exact Statement in Prior Report**: `13_PROMPT_12_6_FINAL_REPORT.md` Line 49 erroneously listed `price_histories`.
- **Evidence Type**: `DOCUMENTATION` (draft artifact error).
- **Derived or Declared**: Declared by mistake in report draft; contradicted by all executable and schema sources.
- **Cross-Check Result**: Confirmed phantom. Removed from authoritative target table inventory.

#### 2.5 Transition Columns (23 Columns across 8 Tables)
- **Claim**: Exactly 23 transition columns are added additively to legacy tables.
- **Source File**: `/server/prisma/migrations/20260919000000_expand_phase_ddl/migration.sql`
- **Exact Statement**: Lines 250–272 (`temp_transition_cols`) & Lines 836–874 (Section 3 `ALTER TABLE`).
- **Evidence Type**: `EXECUTABLE_SQL`
- **Derived or Declared**: Derived from executable DDL.
- **Cross-Check Result**:
  - `tenants`: `business_vertical`, `allow_negative_stock`, `enable_batch_tracking`, `enable_recipe_tracking` (4)
  - `users`: `user_code`, `pin_hash` (2)
  - `outlets`: `code` (1)
  - `products`: `type` (1)
  - `categories`: `parent_id` (1)
  - `customers`: `loyalty_points`, `metadata` (2)
  - `orders`: `order_status`, `order_type`, `service_total`, `paid_amount`, `change_amount` (5)
  - `order_items`: `product_variant_id`, `product_name`, `variant_name`, `sku`, `cost_price`, `discount_amount`, `modifiers_snapshot` (7)
  Total: 4 + 2 + 1 + 1 + 1 + 2 + 5 + 7 = 23 columns across 8 tables.

#### 2.6 Target Indexes (34 Indexes)
- **Claim**: Exactly 34 target indexes are created and audited.
- **Source File**: `/server/prisma/migrations/20260919000000_expand_phase_ddl/migration.sql`
- **Exact Statement**: Lines 469–503 (`temp_target_indexes`).
- **Evidence Type**: `EXECUTABLE_SQL`
- **Derived or Declared**: Derived from executable preflight table.
- **Cross-Check Result**: Verified in `test_expand_safety.ts` (lines 169–204) where all 34 index names are asserted individually.

#### 2.7 Target Foreign Keys (40 Constraints)
- **Claim**: Exactly 40 target foreign key constraints are defined on target tables.
- **Source File**: `/server/prisma/migrations/20260919000000_expand_phase_ddl/migration.sql`
- **Exact Statement**: Lines 418–458 (`temp_target_table_fks`).
- **Evidence Type**: `EXECUTABLE_SQL`
- **Derived or Declared**: Derived from executable preflight table.
- **Cross-Check Result**: Verified against Section 2 `CREATE TABLE` inline references (plus 2 transition foreign keys in Section 3).

#### 2.8 Protected Pre-Existing Legacy Tables (18 Tables)
- **Claim**: Exactly 18 pre-existing legacy tables exist and are protected against drop/truncate/alter.
- **Source Files**:
  - `pos_db` PostgreSQL Catalog: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'` yields exactly 18 tables: `categories`, `customers`, `hold_orders`, `order_items`, `orders`, `outlet_products`, `outlets`, `payments`, `platform_users`, `products`, `saas_invoices`, `saas_payments`, `shifts`, `stock_movements`, `subscription_plans`, `tenant_subscriptions`, `tenants`, `users`.
  - `rollback.sql`: Lines 80–83 explicitly lists these exact 18 tables.
  - `test_expand_safety.ts`: Lines 258–264 explicitly asserts these exact 18 tables.
  - `13_PROMPT_12_6_OBJECT_INVENTORY.md`: Section 6 explicitly lists these exact 18 tables.
- **Evidence Type**: `POSTGRES_CATALOG` & `EXECUTABLE_SQL`
- **Derived or Declared**: Derived from live database catalog and executable guard comments.
- **Cross-Check Result**: Confirmed 100% congruent. Obsolete audit list (`cash_movements`, `discounts`, `taxes`, `printers`, `kitchen_stations`, `modifiers`) in `13_PROMPT_12_6_FINAL_REPORT.md` (line 60) and `test_prompt_12_6_reconciliation.ts` (line 125) proven to be speculative documentation artifact.

---

### 3. Summary of Provenance Classifications

| Object Classification | Primary Evidence Source | Integrity Status |
| :--- | :--- | :--- |
| **Executable Objects** | `migration.sql` / `rollback.sql` | `100% VERIFIED` |
| **Catalog Baseline** | PostgreSQL `pos_db` (`information_schema`) | `100% VERIFIED` |
| **Schema Contracts** | `04_TARGET_DATABASE_SCHEMA.md` / `schema.prisma` | `100% VERIFIED` |
| **Safety Tests (AST)** | `test_expand_safety.ts` | `100% VERIFIED` |
| **Consistency Tests** | `test_prompt_12_6_reconciliation.ts` | `EVIDENCE GAP IDENTIFIED (Obsolete legacy array in line 125)` |
| **Documentation Artifacts** | `/docs/validation/` | `RECONCILED (Phantom objects eliminated)` |
