# Prompt 12.6: Rollback Contract Reconciliation Report

**Document ID:** VAL-2026-09-ROLLBACK-RECON-12-6  
**File Under Review:** `/server/prisma/migrations/20260919000000_expand_phase_ddl/rollback.sql`  
**Execution Stage:** Prompt 12.6 — Contract Reconciliation After Owner Confirmation  
**Date:** 2026-09-20  
**Status:** RECONCILED, VERIFIED & ROLLBACK-HARDENED  

---

## 1. Executive Summary

This report verifies that the Expand Phase rollback script (`rollback.sql`) has been reconciled to reflect the Owner-confirmed enum contracts while strictly enforcing all catalog identity, ownership provenance, and fail-closed rollback guarantees established across Prompt 12.4.2 through Prompt 12.4.4.

Rollback guarantees:
- **Zero blind drops:** No generic `DROP TYPE IF EXISTS` or unverified object removal.
- **Triple-proof authorization:** Objects are dropped only when proven by registry record (`created_by_migration = true`, `ownership = 'CREATED_BY_PROMPT_12_4_2'`, `rollback_action = 'DROP'`).
- **Catalog identity verification:** Before dropping any enum, rollback verifies current PostgreSQL catalog identity, namespace (`public`), object kind (`e`), and exact ordered target labels.
- **Strict preservation of pre-existing objects:** Pre-existing reused enums, transition columns, and all 18 legacy tables are completely preserved.

---

## 2. Reconciled Enum Contract in `rollback.sql`

In `rollback.sql` Section 3 (lines 129–150), `temp_target_enums` establishes the authoritative target enum vocabulary against which catalog identity is verified before authorizing any drop.

Following Prompt 12.6 reconciliation:
```sql
    INSERT INTO temp_target_enums (enum_name, target_labels) VALUES
    ('PlatformRole', ARRAY['SUPER_ADMIN', 'SUPPORT', 'BILLING']),
    ('TenantStatus', ARRAY['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'PENDING']),
    ('BusinessVertical', ARRAY['RETAIL', 'FNB', 'SERVICES', 'HYBRID']),
    ('BillingCycle', ARRAY['MONTHLY', 'ANNUALLY']),
    ('InvoiceStatus', ARRAY['DRAFT', 'UNPAID', 'PAID', 'VOID']),
    ('PaymentRecordStatus', ARRAY['PENDING', 'SUCCESS', 'FAILED']),
    ('Role', ARRAY['OWNER', 'ADMIN', 'SUPERVISOR', 'WAREHOUSE', 'CASHIER', 'KITCHEN', 'WAITER']),
    ('ShiftStatus', ARRAY['OPEN', 'CLOSED']),
    ('ProductType', ARRAY['STANDARD', 'COMPOSITE', 'SERVICE_LABOR']),
    ('SelectionType', ARRAY['SINGLE', 'MULTIPLE']),
    ('UomType', ARRAY['MASS', 'VOLUME', 'COUNT', 'LENGTH', 'TIME']),
    ('StorageLocationType', ARRAY['STOREFRONT', 'WAREHOUSE', 'KITCHEN', 'BAR', 'TRANSIT']),
    ('StockMovementType', ARRAY['SALE', 'PURCHASE', 'TRANSFER_IN', 'TRANSFER_OUT', 'OPNAME_ADJUSTMENT', 'RETURN', 'WASTE', 'VOID', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT']),
    ('InventoryRefType', ARRAY['ORDER', 'PURCHASE_ORDER', 'TRANSFER', 'STOCK_OPNAME', 'REFUND', 'PRODUCTION', 'MANUAL']),
    ('ActorType', ARRAY['USER', 'SYSTEM']),
    ('OrderStatus', ARRAY['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED', 'VOIDED']),
    ('PaymentStatus', ARRAY['UNPAID', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED']),
    ('PaymentMethod', ARRAY['CASH', 'QRIS', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'EWALLET', 'VOUCHER']),
    ('PaymentTxStatus', ARRAY['PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED']),
    ('RefundReason', ARRAY['CUSTOMER_RETURN', 'DAMAGED_GOODS', 'WRONG_ITEM', 'DISSATISFIED_SERVICE', 'BILLING_ERROR']);
```

---

## 3. Rollback Safety & Invariant Verification

1. **Section 0 — Foreign Key Constraints Teardown:**
   - Drops only migration-created foreign keys tracked in `_prompt_12_ownership_registry` with `rollback_action = 'DROP'`.
2. **Section 1 — Target Tables Teardown:**
   - Drops only target tables tracked in `_prompt_12_ownership_registry` where `created_by_migration = true` and `rollback_action = 'DROP'`.
   - Executes in strict reverse-dependency order:
     `refund_items` -> `refunds` -> `payment_transactions` -> `modifier_recipe_effects` -> `product_modifier_groups` -> `modifier_items` -> `modifier_groups` -> `recipe_items` -> `recipes` -> `unit_conversions` -> `inventory_ledgers` -> `inventory_balances` -> `inventory_batches` -> `product_variants` -> `inventory_items` -> `storage_locations` -> `legacy_stock_movements` -> `idempotency_records`.
   - All 18 legacy tables are strictly preserved.
3. **Section 2 — Transition Columns Teardown:**
   - Drops only transition columns on legacy tables where the registry proves `created_by_migration = true` and `rollback_action = 'DROP'`.
4. **Section 3 — Custom Enum Types Teardown:**
   - **Pre-Check (3.1):** Fails closed if any registry record has contradictory flags (`created_by_migration = true` with invalid ownership).
   - **Catalog Identity Verification (3.2):**
     * Checks `pg_type.typname = rec.enum_name` and `pg_type.typtype = 'e'`.
     * Checks `pg_namespace.nspname = 'public'`.
     * Compares `array_agg(enumlabel ORDER BY enumsortorder)` against `temp_target_enums.target_labels`.
     * If the catalog object does not match the exact expected target contract, rollback aborts immediately to fail closed.
   - **Execution (3.3):**
     * If registry proves `ownership = 'CREATED_BY_PROMPT_12_4_2'`, drops the enum type via exact DDL: `EXECUTE format('DROP TYPE public.%I', rec.enum_name)`.
     * If registry proves `ownership = 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED'`, preserves the enum type and logs `ENUM PRESERVED`.
5. **Section 4 — Registry Self-Cleanup:**
   - Drops `_prompt_12_ownership_registry` only if it was created by Prompt 12 (`ownership = 'CREATED_BY_PROMPT_12_4_2'`).

---

## 4. Verification Verdict

`rollback.sql` is **100% reconciled, mathematically and catalog-verified, and enforces all fail-closed rollback invariants**.
