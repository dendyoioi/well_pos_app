# 10 — PROMPT 12 REPOSITORY & SCHEMA RECONNAISSANCE REPORT

**Project:** Well POS Multi-Tenant SaaS Platform  
**Document ID:** `DOC-VAL-10-PROMPT-12-RECONNAISSANCE`  
**Execution Stage:** Prompt 12 — Database Migration Scripting & Expand-Phase DDL Implementation  
**Preceding Gate:** Prompt 11.3 = `GO WITH CONDITIONS` (Project Owner Approved)  
**Date:** September 19, 2026  
**Status:** **AUTHORITATIVE RECONNAISSANCE ASSESSMENT — READ-ONLY / IMPLEMENTATION PREPARATION**  
**Live Data Status:** `LIVE DATA COUNTS NOT VERIFIED — LIVE DATA ACCESS NOT AVAILABLE`

---

## 1. Executive Summary

This reconnaissance document establishes the technical baseline of the Well POS repository, Prisma schema, migration mechanism, and legacy application state prior to generating the Expand-phase DDL and backfill scaffolding.

The primary discovery confirms that the repository has historically operated via **`prisma db push`** without a formal Prisma `migrations/` directory. The active `server/prisma/schema.prisma` was updated in Prompt 10 to reflect the 31 models and 20 enums of **Target Database Schema Revision 4**. However, any operational staging or production database seeded from the prototype era currently possesses the 18-model legacy schema. 

Executing direct `prisma migrate dev`, `prisma migrate deploy`, or `prisma db push` against existing databases would immediately execute destructive alterations (dropping legacy commercial pricing, integer stock tracking, and user PIN columns), cause constraint violations on `NOT NULL` fields, and break operational POS checkout.

To ensure continuous backward compatibility and zero downtime, Prompt 12 produces a **reversible, non-destructive, phased EXPAND migration package**.

---

## 2. Model, Enum, and Migration State Inventory

### 2.1 Prisma Schema Metrics
- **Active Schema Path:** `pos_apps/server/prisma/schema.prisma`
- **Total Models in Active Schema:** 31 models
- **Total Enums in Active Schema:** 20 enums
- **Target Schema Specification:** `docs/architecture/04_TARGET_DATABASE_SCHEMA.md` (Revision 4, Architecture-Locked)
- **Active Schema Validation:** Passed (`npx prisma validate` executed cleanly in Prompt 10 validation).

### 2.2 Repository Database Migration Mechanism
- **Migration Directory:** `pos_apps/server/prisma/migrations/` was **NOT PRESENT** (0 existing migration files).
- **Historic Schema Application:** Defined in `pos_apps/server/package.json` line 10 as `"db:push": "prisma db push"`.
- **Database Engine:** PostgreSQL 15+ (`postgresql://` connection provider).
- **Migration Strategy Required:** Transition from unversioned `db push` to a strict **Phased Expand-Contract Migration Architecture**:
  1. Expand (Additive DDL)
  2. Backfill (Deterministic Data Transformation)
  3. Dual-Write (Application Shadow Writing)
  4. Validate & Reconcile (Dimensional Zero-Tolerance Parity)
  5. Cutover (Traffic Switch)
  6. Contract (Destructive Cleanup & Constraints)

---

## 3. Drift & Mismatch Analysis

### 3.1 Three-Way State Comparison
There are three distinct states in the lifecycle of this evolution:
1. **Current Physical Database State (Legacy Baseline):** 18 tables, nullable tenant IDs, monolithic Product table (with `basePrice`, `costPrice`, `unit`, `sku`, `barcode`), integer `outlet_products.stock`, monolithic `payments` (cash/qris), and plaintext `users.pin`.
2. **Active Prisma Schema (`schema.prisma`):** Contains the 31 target models defined in Prompt 10.
3. **Target Database Schema Revision 4 (`04_TARGET_DATABASE_SCHEMA.md`):** Complete architectural design including partial unique indexes (e.g. single default storage location per outlet) and operational guidelines.

### 3.2 Drift Identification

| Domain | Legacy Database Structure | Active Prisma Schema | Target Revision 4 Specification | Migration Phase Assignment |
|---|---|---|---|---|
| **Users / Auth** | `users.pin` (plaintext), `users.email` unique | `users.userCode`, `users.pinHash`, `users.email` optional | Model B: tenant-scoped `userCode` + `pinHash`, optional `outletId` | **Expand:** add `userCode` (NULL), `pinHash` (NULL). **Backfill:** populate. **Contract:** drop `pin`. |
| **Catalog** | Monolithic `products` (price, cost, sku, barcode) | `Product` + `ProductVariant` (sku, barcode, price) | 1:N cardinality; variant owns price & SKU | **Expand:** create `product_variants`. **Backfill:** map 1:1:1. **Contract:** drop `products.basePrice`, `costPrice`. |
| **Inventory** | `outlet_products.stock` (Int) | `InventoryItem`, `StorageLocation`, `InventoryBalance`, `InventoryLedger` | Canonical physical stock in `InventoryBalance.quantityOnHand` (`Decimal(12,3)`) | **Expand:** create inventory tables. **Backfill:** calibrate baseline. **Contract:** drop `outlet_products`. |
| **Stock History** | `stock_movements` (no location, no balance) | `InventoryLedger` (immutable append-only) | Archive legacy movements; initialize target ledger with opening calibration | **Expand:** create `legacy_stock_movements` archive table and `inventory_ledgers`. |
| **Orders** | `orders.paymentStatus` monolithic | `OrderStatus` + `PaymentStatus` decoupled | Independent operational and financial states | **Expand:** add target lifecycle columns to `orders`. **Backfill:** map status. |
| **Payments** | `payments` (CASH, QRIS) | `PaymentTransaction`, `Refund`, `RefundItem` | Multi-tender, partial payments, gateways, formal refunds | **Expand:** create `payment_transactions`, `refunds`. **Backfill:** transform. **Contract:** drop `payments`. |
| **Hold Orders** | `hold_orders` separate table | Mapped to `orders` with `OrderStatus.DRAFT` | Parked cart retention: `OWNER DECISION REQUIRED` | **Expand:** maintain legacy table. **Backfill:** conditional merge. **Contract:** drop table. |

---

## 4. Prisma-to-SQL Identifier & Naming Conventions

All PostgreSQL tables and columns use snake_case mapped via Prisma `@map` and `@@map`:

| Prisma Model | PostgreSQL Table Name (`@@map`) | Key Column Mappings |
|---|---|---|
| `PlatformUser` | `platform_users` | `is_active`, `created_at`, `updated_at` |
| `Tenant` | `tenants` | `business_name`, `business_vertical`, `trial_ends_at` |
| `User` | `users` | `tenant_id`, `outlet_id`, `user_code`, `password_hash`, `pin_hash` |
| `Outlet` | `outlets` | `tenant_id`, `is_warehouse`, `receipt_header`, `receipt_footer` |
| `Product` | `products` | `tenant_id`, `category_id`, `image_url`, `is_active` |
| `ProductVariant` | `product_variants` | `tenant_id`, `product_id`, `inventory_item_id`, `inventory_quantity_multiplier` |
| `InventoryItem` | `inventory_items` | `tenant_id`, `item_code`, `canonical_uom`, `average_cost`, `allow_negative_stock` |
| `StorageLocation`| `storage_locations`| `tenant_id`, `outlet_id`, `is_default`, `allow_negative_stock` |
| `InventoryBalance`| `inventory_balances`| `tenant_id`, `inventory_item_id`, `storage_location_id`, `quantity_on_hand` |
| `InventoryLedger` | `inventory_ledgers` | `tenant_id`, `inventory_item_id`, `storage_location_id`, `quantity_delta`, `is_negative_balance` |
| `Order` | `orders` | `tenant_id`, `outlet_id`, `invoice_number`, `order_status`, `payment_status` |
| `OrderItem` | `order_items` | `tenant_id`, `order_id`, `product_variant_id`, `unit_price`, `cost_price` |
| `PaymentTransaction`| `payment_transactions`| `tenant_id`, `order_id`, `payment_method`, `payment_tx_status` |
| `IdempotencyRecord`| `idempotency_records`| `tenant_id`, `operation_type`, `idempotency_key`, `expires_at` |

---

## 5. Critical Legacy Domain Semantics & Risks

### 5.1 Nullable Legacy `tenantId`
- In legacy tables (`outlets`, `users`, `categories`, `products`, `orders`, `shifts`, `customers`, `hold_orders`), `tenant_id` was defined as nullable (`String?`).
- **Expand Invariant:** The Expand DDL cannot apply `ALTER TABLE ... ALTER COLUMN tenant_id SET NOT NULL` on existing tables because existing legacy rows might contain `NULL`.
- **Mitigation:** The pre-migration audit query suite must verify and backfill all null `tenant_id` values prior to enforcing `NOT NULL` in the Contract phase. New tables created in Expand enforce `tenant_id NOT NULL` immediately.

### 5.2 Legacy `users.pin` Representation
- Legacy `User` authenticates using plaintext `pin` compared via `user.pin === pin` in `auth.controller.ts:133`.
- **Target Invariant:** Target Model B uses `pinHash` (Bcrypt/Argon2id).
- **Cases:**
  - Case A (`pin IS NOT NULL`): Deterministically hash during Backfill.
  - Case B (`pin IS NULL`): User requires credential reset via approved operational procedure; no target schema column (`mustChangePin`, `forcePinReset`) may be introduced.
  - Case C: Post-migration verification requires that 100% of active PIN-authenticated users possess non-null `pinHash`.

### 5.3 Legacy Product SKU / Barcode Uniqueness
- Legacy unique constraints were on `products` (`@@unique([tenantId, sku])`, `@@unique([tenantId, barcode])`).
- In Target Revision 4, commercial uniqueness belongs strictly to `ProductVariant` (`@@unique([tenantId, sku])`, `@@unique([tenantId, barcode])`).
- Legacy duplicates across products would break the creation of unique indexes on `product_variants`. Pre-flight audit queries must confirm zero collisions per tenant.

### 5.4 Legacy `outlet_products.stock` vs `InventoryBalance`
- Legacy POS tracks stock as a mutable integer scalar in `outlet_products.stock`.
- Target tracks physical stock as `InventoryBalance.quantityOnHand` (`Decimal(12,3)`).
- Canonical baseline: `legacy outlet_products.stock = InventoryBalance.quantityOnHand`.
- Default legacy backfill mapping sets `inventoryQuantityMultiplier = 1.000`.
- The multiplier is strictly a transaction conversion multiplier; physical balance is never divided by the multiplier.

### 5.5 Negative Stock Semantics (ADR-002)
- Target `InventoryBalance` has NO `isNegativeBalance` column.
- Negative balance flag exists only on `InventoryLedger.isNegativeBalance`.
- Case A (Permitted by ADR-002 policy): Preserve negative decimal in `InventoryBalance.quantityOnHand`, create ledger row with `isNegativeBalance = true`.
- Case B (Not Permitted): Flag as migration exception requiring manual resolution.

### 5.6 Active Shifts and In-Flight Orders
- Any open cashier shift (`Shift.status = OPEN`) during cutover presents a race condition between legacy mutable records and target append-only ledger entries.
- Operational cutover prerequisite: All open shifts must be closed (Z-Report submitted) and all hold orders resolved.

---

## 6. Pre-Flight Query Readiness Status

In strict accordance with Prompt 12 rules, live database access is not permitted in this phase. The pre-flight audit queries are formally prepared as executable SQL and TypeScript audit modules:
1. `audit_null_tenants.sql`
2. `audit_sku_barcode_collisions.sql`
3. `audit_negative_stock.sql`
4. `audit_orphan_records.sql`
5. `audit_legacy_pin_status.sql`
6. `audit_unmapped_order_statuses.sql`

All metrics in subsequent planning documents are explicitly designated as `LIVE DATA COUNTS NOT VERIFIED — LIVE DATA ACCESS NOT AVAILABLE`.

---
*End of Prompt 12 Reconnaissance Report.*
