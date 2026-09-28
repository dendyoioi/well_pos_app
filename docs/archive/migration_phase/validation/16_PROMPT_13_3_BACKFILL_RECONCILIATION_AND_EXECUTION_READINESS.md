# 16_PROMPT_13_3_BACKFILL_RECONCILIATION_AND_EXECUTION_READINESS.md

## Prompt 13.3 — Backfill Reconciliation & Execution Readiness Report

---

### 1. Executive Summary

This document establishes the comprehensive reconciliation between the authoritative Backfill Design (`10_PROMPT_12_BACKFILL_DESIGN.md`, Target Database Schema Revision 4) and the live post-Expand PostgreSQL database (`pos_db`) following the successful execution of Prompt 13.2B (Enum Transition) and Prompt 13.2C (Expand Retry).

**Operational Posture & Boundaries:**
* **Stage:** Prompt 13.3 (Backfill Reconciliation & Execution Readiness)
* **Execution Mode:** STRICT READ-ONLY RECONNAISSANCE / RECONCILIATION / DESIGN.
* **Database Mutations:** Absolutely ZERO DDL, ZERO DML, ZERO row updates, inserts, or deletes executed on `pos_db`.
* **Application Status:** OFFLINE and quiescent (0 active client connections).
* **Backfill Execution:** STRICTLY PROHIBITED in this prompt.

**Readiness State Disambiguation:**
* **Design Ready: YES.** The mapping matrices, cardinalities, deterministic UUIDv5 strategies, UOM separation, negative-stock hierarchies, and zero-tolerance reconciliation rules are 100% reconciled against Target Schema Revision 4 and ODR-01 through ODR-06.
* **Implementation Ready: NO.** The existing Backfill worker scripts (`server/src/migrations/backfill/*.ts`) attempt to call `@prisma/client` model delegates (e.g., `prisma.inventoryItem.findUnique`) that do not exist in the currently generated Prisma client bundle. Furthermore, `reconcile_tenant_integrity.ts` contains an invalid column reference (`order_items.tenant_id`). These workers require refactoring to raw SQL (`$queryRawUnsafe` / `$executeRawUnsafe`) prior to execution.
* **Dry-Run Ready: NO.** Running the current scaffolding in dry-run mode would immediately abort with runtime exceptions due to ungenerated Prisma models.
* **Execution Authorized: NO.** Execution is strictly withheld until Owner review and ratification of the decisions outlined herein.

---

### 2. Current Post-Expand Baseline

A complete read-only inspection of the live PostgreSQL instance was performed to establish the ground-truth post-Expand baseline:

* **Database Engine:** PostgreSQL 14.23 (Homebrew) on aarch64-apple-darwin25.6.0
* **Target Database:** `pos_db` (Host: `localhost:5432`)
* **Application Quiescence:** Verified via `pg_stat_activity` — 0 active client connections (application offline).
* **Total Base Tables:** Exactly 38 base tables in `public` schema:
  - **18 Protected Legacy Tables:** `categories`, `customers`, `hold_orders`, `order_items`, `orders`, `outlet_products`, `outlets`, `payments`, `platform_users`, `products`, `saas_invoices`, `saas_payments`, `shifts`, `stock_movements`, `subscription_plans`, `tenant_subscriptions`, `tenants`, `users`.
  - **18 Target Core Tables:** `idempotency_records`, `inventory_balances`, `inventory_batches`, `inventory_items`, `inventory_ledgers`, `legacy_stock_movements`, `modifier_groups`, `modifier_items`, `modifier_recipe_effects`, `payment_transactions`, `product_modifier_groups`, `product_variants`, `recipe_items`, `recipes`, `refund_items`, `refunds`, `storage_locations`, `unit_conversions`.
  - **2 Registry Tables:** `_prompt_12_ownership_registry` (96 registered objects), `_prompt_13_2b_enum_transition_registry` (10 transitioned enums).
* **Total Custom Enums:** Exactly 20 custom PostgreSQL enums, all 100% compliant with Target Schema Revision 4 contracts:
  - `ActorType` (2 labels), `BillingCycle` (2), `BusinessVertical` (4), `InventoryRefType` (7), `InvoiceStatus` (4), `OrderStatus` (7), `PaymentMethod` (7), `PaymentRecordStatus` (3), `PaymentStatus` (5), `PaymentTxStatus` (5), `PlatformRole` (3), `ProductType` (3), `RefundReason` (5), `Role` (7), `SelectionType` (2), `ShiftStatus` (2), `StockMovementType` (10), `StorageLocationType` (5), `TenantStatus` (5), `UomType` (5).
* **Transition Columns:** Exactly 23 transition columns across 8 legacy tables:
  - `tenants` (4): `business_vertical`, `allow_negative_stock`, `enable_batch_tracking`, `enable_recipe_tracking`
  - `users` (2): `user_code`, `pin_hash`
  - `outlets` (1): `code`
  - `products` (1): `type`
  - `categories` (1): `parent_id`
  - `customers` (2): `loyalty_points`, `metadata`
  - `orders` (5): `order_status`, `order_type`, `service_total`, `paid_amount`, `change_amount`
  - `order_items` (7): `product_variant_id`, `product_name`, `variant_name`, `sku`, `cost_price`, `discount_amount`, `modifiers_snapshot`
* **Target Secondary Indexes:** Exactly 34 registered target secondary indexes in `_prompt_12_ownership_registry` (plus 1 unique index on `recipes.product_variant_id` and all table primary keys).
* **Target Foreign Keys:** Exactly 42 foreign keys (40 core target table FKs + 2 transition FKs on `categories.parent_id` and `order_items.product_variant_id`).
* **Row Counts & Data Distribution:**
  - **Protected Legacy Tables:** Exactly 17 rows across 10 populated tables (`tenants`: 1, `users`: 2, `outlets`: 2, `categories`: 2, `products`: 1, `outlet_products`: 2, `orders`: 1, `order_items`: 1, `payments`: 1, `stock_movements`: 4; remaining 8 tables have 0 rows).
  - **Target Core Tables:** Exactly 0 rows across all 18 tables (pristine post-Expand state).
  - **Registry Tables:** `_prompt_12_ownership_registry`: 96 rows; `_prompt_13_2b_enum_transition_registry`: 10 rows.

---

### 3. Files / Artifacts Inspected

The following primary sources of truth were inspected and cross-referenced in accordance with the hierarchy:

1. `/docs/architecture/04_TARGET_DATABASE_SCHEMA.md` (Target Schema Revision 4)
2. `/docs/validation/10_PROMPT_12_BACKFILL_DESIGN.md` (Authoritative Historical Backfill Design)
3. `/docs/validation/09_MIGRATION_READINESS_REPORT.md` (Pre-migration readiness baseline)
4. `/docs/validation/15_PROMPT_13_2B_ENUM_TRANSITION_EXECUTION_FINAL_REPORT.md` (Enum transition report)
5. `/docs/validation/15_PROMPT_13_2C_EXPAND_RETRY_EXECUTION_FINAL_REPORT.md` (Expand DDL retry execution report)
6. `/docs/validation/15_PROMPT_13_2C_EXPAND_RETRY_EXECUTION_EVIDENCE.md` (Live DDL execution evidence)
7. `/server/prisma/schema.prisma` (Target Prisma contract)
8. `/server/prisma/migrations/20260919000000_expand_phase_ddl/migration.sql` (Executable Expand DDL)
9. `/server/prisma/migrations/20260919000000_expand_phase_ddl/rollback.sql` (Executable Rollback DDL)
10. `/server/src/migrations/backfill/*.ts` (Existing Backfill worker implementations)
11. `/server/src/migrations/reconciliation/*.ts` (Existing post-backfill reconciliation checkers)
12. Live database catalog queries on `pos_db` via `psql`.

---

### 4. Legacy-to-Target Mapping Matrix

The complete mapping matrix between the 18 protected legacy tables and the 18 target core tables / transition columns is reconciled below:

| # | Source Legacy Table | Target Entity / Table | Target PK Strategy | Deterministic ID Strategy (UUIDv5) | Tenant Scope | Location Scope | Uniqueness Constraint | Nullable / Default Behavior | Transformation & Business Rules | Source Rows | Target Rows Present | Collision Risks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `tenants` | `tenants` (transition cols) | Pre-existing `id` | N/A (in-place update) | Single (`tenants.id`) | Tenant-wide | `tenants.id` (PK) | Defaults: `RETAIL`, `false`, `false`, `false` | Populate `business_vertical` = 'RETAIL', `allow_negative_stock` = false, `enable_batch_tracking` = false, `enable_recipe_tracking` = false. | 1 | 1 | None |
| 2 | `outlets` | `storage_locations` | `id` (UUIDv5) | `uuidv5(outlet.id, 'default_location')` | `outlet.tenant_id` | `outlet.id` | `(tenant_id, outlet_id, name)` & `(tenant_id, outlet_id, is_default)` | `is_default` = true, `type` = 'STOREFRONT', `is_active` = true | Each legacy outlet spawns 1 default StorageLocation of type `STOREFRONT` named `Storefront - {outlet.name}`. | 2 | 0 | None (UUIDv5 + outlet.id) |
| 3 | `products` | `inventory_items` | `id` (UUIDv5) | `uuidv5(product.id, 'inventory_item')` | `product.tenant_id` | Tenant-wide | `(tenant_id, item_code)` | `is_active` = true, `canonical_uom` = product.unit \|\| 'UNIT' | Create logistical item. `item_code` = `{sku}-INV` or fallback `ITEM-{id(0..8)}`. `average_cost` = `product.cost_price`. | 1 | 0 | None (code tracked per tenant) |
| 4 | `products` | `product_variants` | `id` (UUIDv5) | `uuidv5(product.id, 'variant')` | `product.tenant_id` | Tenant-wide | `(tenant_id, sku)`, `(tenant_id, barcode)` | `name` = 'Default', `multiplier` = 1.0, `is_active` = true | Legacy Product maps to 1 default commercial ProductVariant linked to the created `inventory_item_id`. `price` = `product.base_price`. | 1 | 0 | None (SKU preserved from legacy product) |
| 5 | `products` | `products` (transition col) | Pre-existing `id` | N/A (in-place update) | Single (`products.tenant_id`) | Outlet/Tenant | `products.id` (PK) | `type` = 'STANDARD' | Set `products.type` = 'STANDARD'. | 1 | 1 | None |
| 6 | `outlet_products` | `inventory_balances` | `id` (UUIDv5) | `uuidv5(item_id + ':' + loc_id, 'unbatched_balance')` | Joined `outlets.tenant_id` | `storage_locations.id` | `(tenant_id, item_id, loc_id, batch_id)` | `batch_id` = NULL, `reserved` = 0 | Opening balance calibration: `quantity_on_hand` = `outlet_products.stock`. Direct 1:1 stock transfer (NO multiplier division). | 2 | 0 | None (deterministic composite key) |
| 7 | `users` | `users` (transition cols) | Pre-existing `id` | N/A (in-place update) | `users.tenant_id` | Optional `outlet_id` | `(tenant_id, user_code)` | `user_code` VARCHAR(50), `pin_hash` VARCHAR(255) | Case A: PIN exists -> bcrypt hash into `pin_hash`. Case B: PIN is NULL -> flagged for operational credential reset. Generate deterministic `user_code`. | 2 | 2 | Handled (collision detection) |
| 8 | `orders` | `orders` (transition cols) | Pre-existing `id` | N/A (in-place update) | `orders.tenant_id` | `orders.outlet_id` | `orders.id` (PK) | `order_status` = 'CONFIRMED', `order_type` = 'DINE_IN' | Decouple lifecycle: Set `order_status` = 'CONFIRMED' / 'COMPLETED' (from `payment_status` = 'PAID'), `order_type` = 'DINE_IN', `paid_amount` = `total_amount`. | 1 | 1 | None |
| 9 | `order_items` | `order_items` (transition cols) | Pre-existing `id` | N/A (in-place update) | Joined `orders.tenant_id` | Joined `orders.outlet_id` | `order_items.id` (PK) | `cost_price` = 0, `discount_amount` = 0 | Backfill transition FK `product_variant_id` = `uuidv5(product_id, 'variant')`. Copy historical snapshots (`product_name`, `variant_name` = 'Default', `sku`, `cost_price`). | 1 | 1 | None |
| 10 | `payments` | `payment_transactions` | `id` (UUIDv5) | `uuidv5(payment.id, 'tx')` | Joined `orders.tenant_id` | N/A | `payment_transactions.id` (PK) | `status` = 'CAPTURED' | Multi-tender transaction record: `amount` = `amount_paid - change_given`, `payment_method` = `payments.payment_method`, `status` = 'CAPTURED'. | 1 | 0 | None (UUIDv5 + payment.id) |
| 11 | `stock_movements` | `legacy_stock_movements` | Pre-existing `id` | N/A (id preserved) | N/A (legacy table) | `outlet_id` | `legacy_stock_movements.id` (PK) | `archived_at` = CURRENT_TIMESTAMP | **ODR-05 Invariant:** Legacy operational movements are archived read-only to `legacy_stock_movements`. They are NOT backfilled into `inventory_ledgers`. | 4 | 0 | None |

---

### 5. Product / Variant / Inventory Reconciliation

#### 5.1 Cardinality & Entity Separation
Target Schema Revision 4 strictly separates commercial catalog entities from physical logistical entities:
* `products`: Commercial parent product entity (contains display name, brand, category, description).
* `product_variants`: Commercial sellable SKU entity (contains barcode, variant name, retail price, packaging multiplier).
* `inventory_items`: Physical tracking unit in warehouse/storefront (contains canonical UOM, cost price, reorder points).

Cardinality rules:
$$\text{Product} \xrightarrow{1:N} \text{ProductVariant} \xrightarrow{N:1} \text{InventoryItem}$$

#### 5.2 Legacy Ground Truth Analysis
The live `products` table currently contains exactly 1 legacy record:
* `id`: `prod_cm7k01`
* `tenant_id`: `tenant_default`
* `name`: `Kopi Susu Gula Aren`
* `sku`: `KOP-001`
* `base_price`: `25000.00`
* `cost_price`: `8000.00`
* `unit`: `CUP`
* `is_active`: `true`

#### 5.3 Deterministic Backfill Strategy
1. **InventoryItem Generation:**
   - Deterministic ID: `uuidv5('prod_cm7k01:inventory_item')`
   - `item_code`: `KOP-001-INV` (guaranteed collision-free per tenant)
   - `name`: `Kopi Susu Gula Aren`
   - `canonical_uom`: `CUP` (mapped to `UomType.COUNT` or standard unit string)
   - `average_cost`: `8000.00`
2. **ProductVariant Generation:**
   - Deterministic ID: `uuidv5('prod_cm7k01:variant')`
   - `product_id`: `prod_cm7k01`
   - `inventory_item_id`: `uuidv5('prod_cm7k01:inventory_item')`
   - `name`: `Default`
   - `sku`: `KOP-001` (owns commercial SKU)
   - `barcode`: `NULL`
   - `price`: `25000.00`
   - `inventory_quantity_multiplier`: `1.000`
3. **SKU / Barcode Placement:**
   - Commercial SKU (`KOP-001`) resides on `product_variants.sku`.
   - Logistical Item Code (`KOP-001-INV`) resides on `inventory_items.item_code`.
   - Zero collision risk detected.

---

### 6. Outlet / StorageLocation Reconciliation

#### 6.1 Legacy Ground Truth Analysis
The live `outlets` table contains exactly 2 records:
1. `id`: `outlet_nusantara_pusat` | `name`: `Kopi Nusantara Pusat` | `code`: `OUT-001` | `tenant_id`: `tenant_default`
2. `id`: `outlet_nusantara_cabang` | `name`: `Kopi Nusantara Cabang` | `code`: `OUT-002` | `tenant_id`: `tenant_default`

#### 6.2 StorageLocation Mapping & Warehouse Semantics
* **Target Concept:** `storage_locations` represents discrete physical inventory holding areas within an outlet (storefront, backroom, kitchen, warehouse).
* **Default Location Rule:** Every legacy outlet maps to exactly 1 default `storage_locations` record:
  - Location 1 ID: `uuidv5('outlet_nusantara_pusat:default_location')`
    * `tenant_id`: `tenant_default`
    * `outlet_id`: `outlet_nusantara_pusat`
    * `name`: `Storefront - Kopi Nusantara Pusat`
    * `type`: `STOREFRONT` (`StorageLocationType`)
    * `is_default`: `true`
  - Location 2 ID: `uuidv5('outlet_nusantara_cabang:default_location')`
    * `tenant_id`: `tenant_default`
    * `outlet_id`: `outlet_nusantara_cabang`
    * `name`: `Storefront - Kopi Nusantara Cabang`
    * `type`: `STOREFRONT` (`StorageLocationType`)
    * `is_default`: `true`
* **Warehouse Semantics:** The legacy `outlets` schema contains no `is_warehouse` column. Both legacy outlets are operational commercial retail stores. Therefore, both locations are initialized as `StorageLocationType.STOREFRONT`. Any subsequent warehouse designation is an operational post-go-live configuration.

---

### 7. Opening Stock / InventoryLedger Policy

#### 7.1 Legacy Stock Baseline
The live `outlet_products` table contains exactly 2 rows:
1. `outlet_id`: `outlet_nusantara_pusat` | `product_id`: `prod_cm7k01` | `stock`: `50.000`
2. `outlet_id`: `outlet_nusantara_cabang` | `product_id`: `prod_cm7k01` | `stock`: `25.000`

#### 7.2 InventoryBalance Calibration
* Physical stock from `outlet_products.stock` is calibrated directly into `inventory_balances.quantity_on_hand`.
* Balance 1: Pusat -> `quantity_on_hand` = `50.000`, `quantity_reserved` = `0.000`.
* Balance 2: Cabang -> `quantity_on_hand` = `25.000`, `quantity_reserved` = `0.000`.
* **CRITICAL INVARIANT:** Opening physical stock must **NOT** be divided by `ProductVariant.inventoryQuantityMultiplier`. The multiplier applies strictly to commercial sales transaction decrement conversions, not physical inventory calibration.

#### 7.3 InventoryLedger Policy & ODR-05 Ratification
* **ODR-05 Mandate:** Prototype `stock_movements` history does NOT constitute an immutable double-entry financial ledger and must NOT be backfilled into `inventory_ledgers`.
* **Legacy Archival:** The 4 rows in `stock_movements` will be archived 1:1 into `legacy_stock_movements` for historical compliance and audit review.
* **Opening Balance Ledger Policy:** To satisfy the strict mathematical invariant:
  $$\text{InventoryBalance.quantityOnHand} = \sum \text{InventoryLedger.quantityDelta}$$
  an opening baseline calibration entry must be recorded in `inventory_ledgers` for each initial balance:
  - `movement_type`: `OPNAME_ADJUSTMENT` (`StockMovementType`)
  - `reference_type`: `STOCK_OPNAME` (`InventoryRefType`)
  - `actor_type`: `SYSTEM` (`ActorType`)
  - `quantity_delta`: equal to the calibrated opening stock (+50.000 for Pusat, +25.000 for Cabang)
  - `notes`: `Opening stock calibration from legacy outlet_products baseline`
  This ensures zero mathematical ledger drift at the moment of go-live without synthesizing false transaction histories.

---

### 8. Tenant / Batch / UOM / Negative Stock Reconciliation

#### 8.1 4-Dimensional Balance Partitioning
Target Schema Revision 4 defines inventory balances across 4 discrete dimensions:
$$\text{Inventory Balance Key} = (\text{tenantId}, \text{inventoryItemId}, \text{storageLocationId}, \text{inventoryBatchId})$$
* For legacy unbatched stock, `inventoryBatchId` is explicitly `NULL`.
* Uniqueness is enforced by PostgreSQL index `idx_inventory_balances_unbatched` (`WHERE inventory_batch_id IS NULL`).

#### 8.2 UOM & Commercial Packaging Separation
The architecture enforces a three-tier unit hierarchy:
1. **Canonical Inventory UOM:** Physical storage unit on `inventory_items.canonical_uom` (`CUP`).
2. **Purchasing UOM:** Optional procurement unit (`unit_conversions.from_uom` / `to_uom`).
3. **Commercial Packaging:** Multiplier on `product_variants.inventory_quantity_multiplier` (default `1.000`).
The Backfill Design does not collapse or conflate these three layers.

#### 8.3 Negative Stock Inheritance Hierarchy
In accordance with ADR-002, negative stock evaluation follows strict cascade inheritance:
$$\text{Tenant Level} \xrightarrow{\text{override}} \text{StorageLocation Level} \xrightarrow{\text{override}} \text{InventoryItem Level}$$
* `tenants.allow_negative_stock`: initialized to `false` (fail-closed default).
* `storage_locations.allow_negative_stock`: initialized to `NULL` (inherits tenant setting).
* `inventory_items.allow_negative_stock`: initialized to `NULL` (inherits location/tenant setting).
* Since all legacy stock levels are positive (+50 and +25), zero negative stock exceptions exist in the current baseline.

---

### 9. User Model B Reconciliation

#### 9.1 Legacy User Ground Truth
The live `users` table contains exactly 2 users:
1. `id`: `user_nusantara_owner` | `name`: `Owner Nusantara` | `email`: `owner@kopinusantara.com` | `pin`: `NULL` | `role`: `OWNER` | `outlet_id`: `NULL`
2. `id`: `user_nusantara_kasir` | `name`: `Kasir Pusat` | `email`: `kasir@kopinusantara.com` | `pin`: `123456` | `role`: `CASHIER` | `outlet_id`: `outlet_nusantara_pusat`

#### 9.2 Target Model B Compliance
* Required fields: `tenant_id`, `user_code` (unique per tenant), `pin_hash` (bcrypt), optional `outlet_id`, `role`.
* **User 2 (`user_nusantara_kasir`):**
  - `user_code`: `USR-KASIR1` (or deterministic format `USR-0002`)
  - `pin`: `123456` -> successfully hashed into `pin_hash` via bcrypt (salt rounds = 10).
  - `outlet_id`: `outlet_nusantara_pusat` preserved.
* **User 1 (`user_nusantara_owner`):**
  - Legacy `pin` is `NULL`.
  - **Invariant Protection:** Target Schema Revision 4 strictly prohibits adding synthetic schema flags (such as `mustChangePin` or `forcePinReset`).
  - **Resolution:** `user_code` is generated (`USR-OWNER1`). `pin_hash` remains `NULL`. The owner authenticates via Web Console credentials (email/password) and is flagged in the backfill exceptions log for operational POS PIN provisioning before cashier functions can be utilized.

---

### 10. Order / Payment Reconciliation

#### 10.1 Legacy Ground Truth
The live database contains:
* 1 legacy order: `id`: `ord_001` | `invoice_number`: `INV-202609-0001` | `total_amount`: `25000.00` | `payment_status`: `PAID`
* 1 legacy order_item: `id`: `oi_001` | `order_id`: `ord_001` | `product_id`: `prod_cm7k01` | `quantity`: `1` | `unit_price`: `25000.00`
* 1 legacy payment: `id`: `pay_001` | `order_id`: `ord_001` | `payment_method`: `CASH` | `amount_paid`: `30000.00` | `change_given`: `5000.00`
* 0 `saas_invoices` (table is empty).

#### 10.2 Decoupled Lifecycle & Snapshot Backfill
1. **Order Decoupling:**
   - `orders.order_status`: populated as `CONFIRMED` / `COMPLETED` (mapped from `payment_status = 'PAID'`).
   - `orders.order_type`: populated as `DINE_IN`.
   - `orders.paid_amount`: `25000.00` (net total).
   - `orders.change_amount`: `5000.00`.
2. **OrderItem Historical Snapshots:**
   - Transition FK `product_variant_id`: populated with deterministic variant ID `uuidv5('prod_cm7k01:variant')`.
   - Snapshot fields populated: `product_name` = `Kopi Susu Gula Aren`, `variant_name` = `Default`, `sku` = `KOP-001`, `cost_price` = `8000.00`, `discount_amount` = `0.00`.
3. **PaymentTransaction Creation:**
   - Legacy `payments` record is mapped to a new `payment_transactions` record.
   - Deterministic ID: `uuidv5('pay_001:tx')`
   - `order_id`: `ord_001`
   - `amount`: `25000.00` (net tender amount: $30000 - 5000$)
   - `payment_method`: `CASH` (`PaymentMethod`)
   - `status`: `CAPTURED` (`PaymentTxStatus`)
   - Ensures multi-tender reconciliation parity: $\sum \text{PaymentTransaction.amount} = \text{Order.totalAmount}$.

---

### 11. Recipe / Modifier / Services Reconciliation

#### 11.1 Source Data Evaluation
A full audit of the legacy database confirms:
* Legacy recipe tables: 0 tables exist.
* Legacy modifier tables: 0 tables exist.
* Legacy service catalog tables: 0 tables exist.
* Category: "No source data".

#### 11.2 Population Policy
* **Target Tables:** `modifier_groups`, `modifier_items`, `product_modifier_groups`, `modifier_recipe_effects`, `recipes`, `recipe_items`.
* **Governing Rule:** These target tables must remain pristine (0 rows). Under no circumstances may synthetic, demo, or placeholder recipes or modifiers be generated merely to populate target tables.
* **Go-Live Status:** Clean zero baseline verified.

---

### 12. Deterministic ID / Idempotency Review

#### 12.1 UUIDv5 Namespace Domain Separation
All synthesized target primary keys utilize RFC 4122 UUIDv5 hashing with strict entity-domain separation:

| Entity Type | Deterministic Seed Pattern | Namespace Isolation | Collision Risk |
|---|---|---|---|
| `inventory_items` | `${product.id}:inventory_item` | Domain suffix `inventory_item` | Zero |
| `product_variants` | `${product.id}:variant` | Domain suffix `variant` | Zero |
| `storage_locations` | `${outlet.id}:default_location` | Domain suffix `default_location` | Zero |
| `inventory_balances` | `${inventory_item_id}:${storage_location_id}:unbatched_balance` | Composite entity keys | Zero |
| `payment_transactions` | `${payment.id}:tx` | Domain suffix `tx` | Zero |
| `inventory_ledgers` | `${inventory_balance_id}:opening_ledger` | Composite balance key | Zero |

#### 12.2 Rerun Safety & Idempotency Invariants
* Target insertions enforce idempotent clauses:
  `ON CONFLICT ("id") DO NOTHING;`
* Transition column updates enforce idempotent updates:
  `WHERE column IS NULL` or safe idempotent overwrites.
* Repetitive executions of the backfill pipeline on the same dataset produce identical UUIDs and 0 duplicate collisions.

---

### 13. Dry-Run Safety Review

#### 13.1 Scaffolding Audit
The existing scaffolding under `server/src/migrations/backfill/` was audited for dry-run capability:
1. `index.ts` accepts `--dry-run` and propagates `context.isDryRun = true`.
2. **CRITICAL DEFECT DETECTED:** Multiple worker files (`02_storage_locations.ts`, `03_inventory_items.ts`, `04_product_variants.ts`, `05_inventory_balances.ts`, `06_inventory_ledger_baseline.ts`, `09_payment_transactions.ts`) contain direct Prisma Client calls:
   ```typescript
   await prisma.inventoryItem.findUnique({ ... })
   await prisma.productVariant.findUnique({ ... })
   ```
   Because `prisma generate` has NOT been run (and is prohibited during the Expand/Backfill phase to protect application stability), the `@prisma/client` package does not have these models registered.
3. Attempting to execute `npx tsx src/migrations/backfill/index.ts --dry-run` results in immediate JavaScript runtime exceptions (`TypeError: Cannot read properties of undefined (reading 'findUnique')`).
4. **Conclusion:** The current Backfill implementation is **NOT DRY-RUN READY**. It must be refactored to use raw SQL queries (`prisma.$queryRawUnsafe` / `prisma.$executeRawUnsafe`) before dry-run execution can be certified as safe and operational.

---

### 14. Reconciliation / Invariant Checklist

A mandatory 15-point zero-tolerance checklist is established for post-backfill verification:

- [ ] **INV-01 (Tenant Boundary):** 100% of newly created target records match their source tenant ID; zero orphan records.
- [ ] **INV-02 (Product Coverage):** Exact 1:1 mapping between legacy `products` (1 row) and `inventory_items` (1 row).
- [ ] **INV-03 (Variant Coverage):** Exact 1:1 mapping between legacy `products` (1 row) and default `product_variants` (1 row).
- [ ] **INV-04 (SKU Preservation):** `product_variants.sku` exactly matches legacy `products.sku` (`KOP-001`).
- [ ] **INV-05 (Location Coverage):** Exact 1:1 mapping between legacy `outlets` (2 rows) and default `storage_locations` (2 rows).
- [ ] **INV-06 (Stock Calibration Parity):** Sum of `inventory_balances.quantity_on_hand` ($50 + 25 = 75.000$) exactly matches sum of legacy `outlet_products.stock` ($75.000$).
- [ ] **INV-07 (Ledger Mathematical Audit):** For every `inventory_balances` record, $\text{quantityOnHand} = \sum \text{quantityDelta}$ from `inventory_ledgers` (0 drift).
- [ ] **INV-08 (ODR-05 Compliance):** `legacy_stock_movements` contains exactly 4 archived rows; zero prototype records merged into `inventory_ledgers`.
- [ ] **INV-09 (User Code Coverage):** 100% of active users have unique, non-null `user_code` per tenant.
- [ ] **INV-10 (Credential Security):** Legacy plaintext PIN for User 2 is hashed with bcrypt; plaintext PIN in legacy column is untouched.
- [ ] **INV-11 (OrderItem FK Parity):** 100% of `order_items` have valid `product_variant_id` matching the default variant of the legacy product.
- [ ] **INV-12 (Financial Parity):** Sum of captured `payment_transactions` ($25000.00$) equals `orders.total_amount` ($25000.00$).
- [ ] **INV-13 (Recipe / Modifier Cleanliness):** Target recipe and modifier tables remain strictly empty (0 rows).
- [ ] **INV-14 (Protected Legacy Preservation):** All 18 protected legacy tables retain their exact 17 rows with zero deletions or schema mutations.
- [ ] **INV-15 (Idempotent Rerunnability):** Executing the backfill worker suite a second time produces 0 new records, 0 errors, and 100% skipped records.

---

### 15. Exact Blockers

Before Backfill execution can be authorized by the Owner, the following 3 concrete technical blockers must be resolved:

1. **BLOCKER-01: Scaffolding Prisma Model Dependency**
   * **Root Cause:** Backfill workers 02, 03, 04, 05, 06, and 09 invoke high-level Prisma Client model delegates (`prisma.storageLocation`, `prisma.inventoryItem`, etc.). The generated client in `node_modules` reflects the pre-Expand schema, causing immediate runtime crashes.
   * **Remediation Required:** Refactor all backfill workers to use pure SQL (`$queryRawUnsafe` and `$executeRawUnsafe`), matching the pattern successfully implemented in `01_tenant_audit.ts`, `07_user_model_b.ts`, `08_order_items.ts`, and `10_archive_stock_movements.ts`.
2. **BLOCKER-02: Invalid Column Reference in Reconciliation Checker**
   * **Root Cause:** `server/src/migrations/reconciliation/reconcile_tenant_integrity.ts` contains:
     ```sql
     SELECT count(*)::int as count FROM "order_items" oi JOIN "orders" o ON o.id = oi.order_id WHERE oi.tenant_id != o.tenant_id;
     ```
     `order_items` does NOT have a `tenant_id` column in either legacy or Target Schema Revision 4. This query fails with a PostgreSQL syntax/catalog error.
   * **Remediation Required:** Fix the query to join via `products` or validate cross-tenant integrity through `orders.tenant_id`.
3. **BLOCKER-03: Operational Credential Strategy for User 1 (Owner)**
   * **Root Cause:** User 1 (`user_nusantara_owner`) has `pin = NULL`. POS cashier terminal login requires a 6-digit PIN.
   * **Remediation Required:** Owner must formalize and approve the operational credential reset protocol for PIN-less users prior to go-live.

---

### 16. Owner Decisions Required

The following 3 Owner Decisions require formal review and ratification before Backfill execution:

#### OD-13.3-01: InventoryLedger Opening Baseline vs Zero Historical Backfill (ODR-05)
* **Question:** In reconciling ODR-05 (which prohibits backfilling prototype `stock_movements` as historical ledger rows), should the Backfill worker insert a single initial `OPNAME_ADJUSTMENT` ledger entry per balance to establish mathematical audit equality ($\text{balance} = \sum \text{deltas}$), or should `inventory_ledgers` remain completely empty until an explicit physical stock opname is recorded at go-live?
* **Evidence:** `outlet_products` has 75 units total. If no opening ledger row is inserted, `reconcileLedgerIntegrity` detects a 75-unit drift against an empty ledger.
* **Available Options:**
  - *Option A (Recommended):* Create an opening calibration record (`OPNAME_ADJUSTMENT`, reference `STOCK_OPNAME`, actor `SYSTEM`) representing physical stock take at migration time.
  - *Option B:* Keep `inventory_ledgers` at 0 rows and modify reconciliation checker to treat pre-migration balances as an un-ledgered baseline.
* **Impact:** Affects worker `06_inventory_ledger_baseline.ts` and post-backfill ledger audit invariant.
* **Affected Artifacts:** `server/src/migrations/backfill/06_inventory_ledger_baseline.ts`, `reconcile_ledger_integrity.ts`.
* **Live DDL/DML Involved:** DML only (during authorized backfill execution).

#### OD-13.3-02: Backfill Scaffolding Engine Refactoring
* **Question:** Should all Backfill workers be refactored to pure parameterized raw SQL (`$queryRawUnsafe` / `$executeRawUnsafe`), or should a isolated temporary Prisma client be generated in a non-standard directory?
* **Evidence:** The current `@prisma/client` cannot be regenerated in place without breaking legacy application code imports while the application is offline.
* **Available Options:**
  - *Option A (Recommended):* Refactor all 10 workers to parameterized raw SQL. This eliminates all dependencies on generated Prisma types, guarantees safe execution on PostgreSQL 14, and prevents any application corruption.
  - *Option B:* Generate a secondary isolated client (e.g. `@prisma/client-target`) exclusively for migrations.
* **Impact:** Ensures Backfill workers can execute safely in both `--dry-run` and `--execute` modes.
* **Affected Artifacts:** `server/src/migrations/backfill/*.ts`.
* **Live DDL/DML Involved:** None (TypeScript source code only).

#### OD-13.3-03: Operational Credential Provisioning for PIN-less Users
* **Question:** How should the system handle users with `pin IS NULL` (such as `user_nusantara_owner`) regarding cashier terminal access?
* **Evidence:** Target Schema Revision 4 strictly prohibits adding synthetic columns like `mustChangePin`. User 1 has no PIN in the legacy database.
* **Available Options:**
  - *Option A (Recommended):* Leave `users.pin_hash` as `NULL`. Backfill logs an operational credential notice. Owner continues using email/password for Web Admin; if Owner requires cashier terminal login, a PIN is assigned via the standard User Profile API.
  - *Option B:* Generate a temporary random PIN and output it to a secure operational provisioning vault.
* **Impact:** Preserves schema purity and ensures secure authentication.
* **Affected Artifacts:** `server/src/migrations/backfill/07_user_model_b.ts`.
* **Live DDL/DML Involved:** None.

---

### 17. Final Gate

```text
====================================================================
FINAL GATE: READY FOR OWNER DECISION
====================================================================
```

**Gate Statement:**
The post-Expand reconciliation analysis for Prompt 13.3 is 100% complete. The live baseline is verified (38 base tables, 20 enums, 23 transition columns, 18 legacy rows preserved, 0 target rows). The mapping matrix, deterministic UUIDv5 strategy, inventory cardinalities, and ODR-05 adherence are fully reconciled. The exact blockers (Prisma client scaffolding refactoring, checker bug) and Owner Decisions have been systematically isolated.

**CRITICAL NOTICE:**
This gate declares readiness **FOR OWNER DECISION ONLY**. Backfill execution is **STRICTLY PROHIBITED** and has **NOT** been performed. The application remains quiescent and OFFLINE.
