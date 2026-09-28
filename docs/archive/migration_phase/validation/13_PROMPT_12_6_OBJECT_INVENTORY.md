# Prompt 12.6: Reconciled Migration Object Inventory

**Document ID:** VAL-2026-09-OBJECT-INVENTORY-12-6  
**Execution Stage:** Prompt 12.6 — Contract Reconciliation After Owner Confirmation  
**Date:** 2026-09-20  
**Status:** RECONCILED & DERIVED FROM EXECUTABLE CONTRACTS  

---

## 1. Executive Summary

This inventory establishes the comprehensive, reconciled list of all database objects governed by the Expand Phase DDL migration (`migration.sql`) and rollback (`rollback.sql`).

All object counts are derived directly from the executable migration SQL files:
- **Target Custom Enum Types:** 20
- **Target Core Tables:** 18
- **Target Indexes:** 34
- **Target Foreign Key Constraints:** 40
- **Transition Columns on Legacy Tables:** 23
- **Protected Pre-Existing Legacy Tables:** 18
- **Ownership Registry Table:** 1 (`_prompt_12_ownership_registry`)

---

## 2. Target Custom Enum Types (20)

| # | Enum Name | Reconciled Ordered Contract Labels | Count | Ownership Model | Rollback Action |
| :-: | :--- | :--- | :-: | :--- | :--- |
| 1 | `PlatformRole` | `SUPER_ADMIN, SUPPORT, BILLING` | 3 | Dynamic (Registry-proven) | DROP if created; PRESERVE if reused |
| 2 | `TenantStatus` | `TRIAL, ACTIVE, SUSPENDED, CANCELLED, PENDING` | 5 | Dynamic (Exact Match in `pos_db`) | PRESERVE (`PRE_EXISTING_EXACT_COMPATIBLE_REUSED`) |
| 3 | `BusinessVertical` | `RETAIL, FNB, SERVICES, HYBRID` | 4 | Dynamic (Registry-proven) | DROP if created; PRESERVE if reused |
| 4 | `BillingCycle` | `MONTHLY, ANNUALLY` | 2 | Dynamic (Exact Match in `pos_db`) | PRESERVE (`PRE_EXISTING_EXACT_COMPATIBLE_REUSED`) |
| 5 | `InvoiceStatus` | `DRAFT, UNPAID, PAID, VOID` | 4 | Dynamic (Registry-proven) | DROP if created; PRESERVE if reused |
| 6 | `PaymentRecordStatus`| `PENDING, SUCCESS, FAILED` | 3 | Dynamic (Registry-proven) | DROP if created; PRESERVE if reused |
| 7 | `Role` | `OWNER, ADMIN, SUPERVISOR, WAREHOUSE, CASHIER, KITCHEN, WAITER` | 7 | Dynamic (Registry-proven) | DROP if created; PRESERVE if reused |
| 8 | `ShiftStatus` | `OPEN, CLOSED` | 2 | Dynamic (Exact Match in `pos_db`) | PRESERVE (`PRE_EXISTING_EXACT_COMPATIBLE_REUSED`) |
| 9 | `ProductType` | `STANDARD, COMPOSITE, SERVICE_LABOR` | 3 | Dynamic (Registry-proven) | DROP if created; PRESERVE if reused |
| 10 | `SelectionType` | `SINGLE, MULTIPLE` | 2 | Dynamic (Registry-proven) | DROP if created; PRESERVE if reused |
| 11 | `UomType` | `MASS, VOLUME, COUNT, LENGTH, TIME` | 5 | Dynamic (Registry-proven) | DROP if created; PRESERVE if reused |
| 12 | `StorageLocationType`| `STOREFRONT, WAREHOUSE, KITCHEN, BAR, TRANSIT` | 5 | Dynamic (Registry-proven) | DROP if created; PRESERVE if reused |
| 13 | `StockMovementType` | `SALE, PURCHASE, TRANSFER_IN, TRANSFER_OUT, OPNAME_ADJUSTMENT, RETURN, WASTE, VOID, PRODUCTION_CONSUMPTION, PRODUCTION_OUTPUT` | 10 | Dynamic (Registry-proven) | DROP if created; PRESERVE if reused |
| 14 | `InventoryRefType` | `ORDER, PURCHASE_ORDER, TRANSFER, STOCK_OPNAME, REFUND, PRODUCTION, MANUAL` | 7 | Dynamic (Registry-proven) | DROP if created; PRESERVE if reused |
| 15 | `ActorType` | `USER, SYSTEM` | 2 | Dynamic (Registry-proven) | DROP if created; PRESERVE if reused |
| 16 | `OrderStatus` | `DRAFT, CONFIRMED, IN_PROGRESS, READY, COMPLETED, CANCELLED, VOIDED` | 7 | Dynamic (Registry-proven) | DROP if created; PRESERVE if reused |
| 17 | `PaymentStatus` | `UNPAID, PARTIALLY_PAID, PAID, PARTIALLY_REFUNDED, REFUNDED` | 5 | Dynamic (Registry-proven) | DROP if created; PRESERVE if reused |
| 18 | `PaymentMethod` | `CASH, QRIS, CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, EWALLET, VOUCHER` | 7 | Dynamic (Registry-proven) | DROP if created; PRESERVE if reused |
| 19 | `PaymentTxStatus` | `PENDING, CAPTURED, FAILED, REFUNDED, VOIDED` | 5 | Dynamic (Registry-proven) | DROP if created; PRESERVE if reused |
| 20 | `RefundReason` | `CUSTOMER_RETURN, DAMAGED_GOODS, WRONG_ITEM, DISSATISFIED_SERVICE, BILLING_ERROR` | 5 | Dynamic (Registry-proven) | DROP if created; PRESERVE if reused |

---

## 3. Target Core Tables (18)

| # | Table Name | Domain | Primary Key | Rollback Teardown Order |
| :-: | :--- | :--- | :--- | :-: |
| 1 | `idempotency_records` | API Infrastructure | `id` | 18 |
| 2 | `legacy_stock_movements` | Transition Storage | `id` | 17 |
| 3 | `storage_locations` | Logistics / Inventory | `id` | 16 |
| 4 | `inventory_items` | Logistics / Inventory | `id` | 15 |
| 5 | `product_variants` | Product Catalog | `id` | 14 |
| 6 | `inventory_batches` | Logistics / Inventory | `id` | 13 |
| 7 | `inventory_balances` | Logistics / Inventory | `id` | 12 |
| 8 | `inventory_ledgers` | Logistics / Movement History | `id` | 11 |
| 9 | `unit_conversions` | Logistics / Inventory | `id` | 10 |
| 10 | `recipes` | F&B BOM / Production | `id` | 9 |
| 11 | `recipe_items` | F&B BOM / Production | `id` | 8 |
| 12 | `modifier_groups` | F&B Modifiers | `id` | 7 |
| 13 | `modifier_items` | F&B Modifiers | `id` | 6 |
| 14 | `product_modifier_groups`| F&B Modifiers Link | `id` | 5 |
| 15 | `modifier_recipe_effects`| F&B BOM Modifiers | `id` | 4 |
| 16 | `payment_transactions` | Payments / Financials | `id` | 3 |
| 17 | `refunds` | Payments / Financials | `id` | 2 |
| 18 | `refund_items` | Payments / Financials | `id` | 1 |

---

## 4. Transition Columns on Pre-Existing Legacy Tables (23 across 8 Tables)

| # | Legacy Table | Transition Column Added | Type / Nullability | Purpose |
| :-: | :--- | :--- | :--- | :--- |
| 1 | `tenants` | `business_vertical` | `BusinessVertical NULL DEFAULT 'RETAIL'` | Multi-vertical classification |
| 2 | `tenants` | `allow_negative_stock` | `bool NULL DEFAULT false` | Inventory policy override |
| 3 | `tenants` | `enable_batch_tracking`| `bool NULL DEFAULT false` | Batch logistics feature flag |
| 4 | `tenants` | `enable_recipe_tracking`| `bool NULL DEFAULT false`| Recipe tracking feature flag |
| 5 | `users` | `user_code` | `varchar(50) NULL` | Model B tenant-scoped user code |
| 6 | `users` | `pin_hash` | `varchar(255) NULL` | Model B staff PIN credential hash |
| 7 | `outlets` | `code` | `varchar(50) NULL` | Unique outlet identifier |
| 8 | `products` | `type` | `ProductType NULL DEFAULT 'STANDARD'` | Product hierarchy classification |
| 9 | `categories` | `parent_id` | `text NULL REFERENCES categories(id)` | Hierarchical category self-reference |
| 10 | `customers` | `loyalty_points` | `int4 NULL DEFAULT 0` | Customer loyalty program balance |
| 11 | `customers` | `metadata` | `jsonb NULL` | Extensible customer metadata |
| 12 | `orders` | `order_status` | `OrderStatus NULL DEFAULT 'CONFIRMED'` | Decoupled order fulfillment state |
| 13 | `orders` | `order_type` | `varchar(50) NULL DEFAULT 'DINE_IN'` | Order fulfillment type |
| 14 | `orders` | `service_total` | `numeric(15, 2) NULL DEFAULT 0` | Service charge financial amount |
| 15 | `orders` | `paid_amount` | `numeric(15, 2) NULL DEFAULT 0` | Tender amount collected |
| 16 | `orders` | `change_amount` | `numeric(15, 2) NULL DEFAULT 0` | Cash change returned |
| 17 | `order_items` | `product_variant_id` | `text NULL REFERENCES product_variants(id)` | Master variant foreign key |
| 18 | `order_items` | `product_name` | `text NULL` | Historical product name snapshot |
| 19 | `order_items` | `variant_name` | `text NULL` | Historical variant name snapshot |
| 20 | `order_items` | `sku` | `text NULL` | Historical SKU snapshot |
| 21 | `order_items` | `cost_price` | `numeric(15, 4) NULL DEFAULT 0` | Historical cost of goods snapshot |
| 22 | `order_items` | `discount_amount` | `numeric(15, 2) NULL DEFAULT 0` | Line-item discount deduction |
| 23 | `order_items` | `modifiers_snapshot` | `jsonb NULL` | Historical modifier snapshot |

---

## 5. Target Indexes (34) & Target Foreign Keys (40)

- **34 Target Indexes:** Created across target tables and transition columns with deterministic naming (`idx_<table_name>_<columns>`).
- **40 Target Foreign Key Constraints:** Created with explicit `ON DELETE RESTRICT` or `ON DELETE CASCADE` actions matching Prisma definitions.

---

## 6. Protected Pre-Existing Legacy Tables (18)

Guarded by fail-closed assertions in `migration.sql` and `rollback.sql`:
`tenants`, `outlets`, `users`, `products`, `categories`, `customers`, `orders`, `order_items`, `payments`, `shifts`, `subscription_plans`, `tenant_subscriptions`, `saas_invoices`, `saas_payments`, `platform_users`, `outlet_products`, `stock_movements`, `hold_orders`.

**Verdict:** 100% verified, consistent, and tracked in the deterministic ownership model.
