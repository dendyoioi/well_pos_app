# EPIC-07: Supply Chain Logistics, Central Warehouse & Purchasing (PO & Receiving)
## Detailed Sprint Breakdown & Execution Progress

**Status**: **COMPLETED (100% DONE) ✅**  
**Tanggal Mulai**: 21 September 2026  
**Tanggal Selesai**: 21 September 2026  
**Prasyarat**: EPIC-01 s.d EPIC-06 Selesai  

---

### 1. RINGKASAN & TUJUAN BISNIS
EPIC-07 menghadirkan modul logistik dan rantai pasok multi-cabang terintegrasi (*Central Warehouse & Supply Chain Logistics*) untuk Well POS. Fitur ini memungkinkan pelaku bisnis ritel dan F&B dengan banyak gerai/cabang untuk:
1. Mengelola **Master Data Supplier** terisolasi per tenant.
2. Menerbitkan **Purchase Order (PO)** ke pemasok lengkap dengan tenggat pengiriman, item bahan baku, dan kuantitas pesanan.
3. Melakukan **Goods Receiving** di gudang atau outlet dengan pembaruan otomatis **Moving Average Cost (HPP Rata-Rata Bergerak)** pada `inventory_items.average_cost`, penambahan saldo persediaan fisik di `inventory_balances`, dan pencatatan audit jurnal mutasi tak terhapuskan di `inventory_ledgers` (`movement_type = 'PURCHASE'`).
4. Menjalankan **Inter-Outlet Stock Transfer** dengan siklus lengkap (*DRAFT ➔ IN_TRANSIT [Dispatch] ➔ RECEIVED [Penerimaan]*), pemotongan stok otomatis di outlet pengirim (`TRANSFER_OUT`), dan penambahan stok di outlet penerima (`TRANSFER_IN`).
5. Menyediakan **Batch & Lot Tracking** dan peringatan dini kedaluwarsa bahan baku (**Expiry Alerts API**) untuk mencegah kerugian akibat bahan baku kedaluwarsa.

---

### 2. SPRINT BREAKDOWN & REKAP STATUS

| Sprint ID | Nama Modul / Task | Status | File Deliverables Utama |
| :--- | :--- | :---: | :--- |
| **Sprint 7.1** | **Master Supplier Management** | **DONE ✅** | `pos_apps/server/src/controllers/supplier.controller.ts`<br/>`pos_apps/server/src/routes/supplier.routes.ts` |
| **Sprint 7.2** | **Purchase Order (PO) & Moving Average Cost Engine** | **DONE ✅** | `pos_apps/server/src/services/purchasing.service.ts`<br/>`pos_apps/server/src/controllers/purchase_order.controller.ts`<br/>`pos_apps/server/src/routes/purchase_order.routes.ts` |
| **Sprint 7.3** | **Inter-Outlet Stock Transfer Lifecycle** | **DONE ✅** | `pos_apps/server/src/services/stock_transfer.service.ts`<br/>`pos_apps/server/src/controllers/stock_transfer.controller.ts`<br/>`pos_apps/server/src/routes/stock_transfer.routes.ts` |
| **Sprint 7.4** | **Batch / Lot Tracking & Expiry Alerts** | **DONE ✅** | `GET /api/inventory/expiry-alerts`<br/>`pos_apps/server/src/controllers/inventory.controller.ts`<br/>`pos_apps/server/src/routes/inventory.routes.ts` |
| **Sprint 7.5** | **Automated Integration Verification Suite** | **DONE ✅** | `pos_apps/server/src/migrations/contract/test_epic07_supply_chain.ts` |
| **Sprint 7.6** | **Bulk Stock Opname Workspace & Atomic Adjustment Engine** | **DONE ✅** | `POST /api/inventory/bulk-adjustment`<br/>`pos_apps/server/src/controllers/inventory.controller.ts`<br/>`pos_apps/client/src/components/FullScreenBulkOpnameModal.tsx`<br/>`pos_apps/client/src/pages/InventoryView.tsx` |
| **Sprint 7.7** | **Unified Bulk Inventory Workspace (Opname, Stock In, Stock Out, Inter-Outlet Transfer)** | **DONE ✅** | `POST /api/inventory/bulk-stock-in`<br/>`POST /api/inventory/bulk-stock-out`<br/>`POST /api/inventory/bulk-transfer`<br/>`pos_apps/client/src/components/FullScreenBulkOpnameModal.tsx`<br/>`pos_apps/client/src/services/api.ts` |
| **Sprint 7.8** | **Backoffice UI: Purchase Orders (PO) & Physical Goods Receiving** | **DONE ✅** | `pos_apps/client/src/pages/PurchaseOrdersView.tsx`<br/>`pos_apps/client/src/services/api.ts`<br/>`pos_apps/client/src/types/purchasing.ts` |
| **Sprint 7.9** | **Backoffice UI: Inter-Outlet Transfers & Expiry Alert Widget** | **DONE ✅** | `pos_apps/client/src/pages/StockTransfersView.tsx`<br/>`pos_apps/client/src/pages/InventoryView.tsx`<br/>`pos_apps/client/src/components/saas/BackofficeLayout.tsx`<br/>`pos_apps/client/src/pages/DashboardPage.tsx` |

---

### 3. DETAIL IMPLEMENTASI TEKNIS

#### A. Skema Basis Data (Prisma & PostgreSQL Target)
- **Tabel `suppliers`**:
  - Menyimpan profil pemasok (`code`, `name`, `contact_name`, `phone`, `email`, `address`, `tax_id`, `payment_terms_days`, `is_active`).
  - *Unique Constraint*: `("tenant_id", "code")`.
- **Tabel `purchase_orders`**:
  - Menyimpan dokumen PO (`po_number`, `outlet_id`, `storage_location_id`, `supplier_id`, `status` [DRAFT, ISSUED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED], `order_date`, `expected_delivery_date`, `subtotal`, `tax_amount`, `total_amount`, `notes`, `created_by_user_id`).
  - *Unique Constraint*: `("tenant_id", "po_number")`.
- **Tabel `purchase_order_items`**:
  - Menyimpan rincian item pesanan (`purchase_order_id`, `inventory_item_id`, `quantity_ordered`, `quantity_received`, `unit_cost`, `subtotal`).
- **Tabel `stock_transfers`**:
  - Menyimpan dokumen pengiriman antar-cabang (`transfer_number`, `source_outlet_id`, `source_location_id`, `target_outlet_id`, `target_location_id`, `status` [DRAFT, IN_TRANSIT, RECEIVED, CANCELLED], `dispatched_at`, `received_at`, `dispatched_by_user_id`, `received_by_user_id`).
- **Tabel `stock_transfer_items`**:
  - Menyimpan rincian transfer fisik (`stock_transfer_id`, `inventory_item_id`, `inventory_batch_id`, `quantity_dispatched`, `quantity_received`, `unit_cost`).

#### B. Formula Moving Average Cost (HPP Bergerak)
Saat penerimaan barang masuk (*Goods Receiving*), nilai HPP baru dihitung secara real-time dan disimpan pada `inventory_items.average_cost`:
$$\text{newAvgCost} = \frac{(\text{currentTotalStock} \times \text{currentAvgCost}) + (\text{receivedQty} \times \text{receivedUnitCost})}{\text{currentTotalStock} + \text{receivedQty}}$$

#### C. Invarian Mutasi Stok & Buku Besar (*Double-Entry Audit*)
- **Penerimaan PO**:
  - `inventory_balances.quantity_on_hand` bertambah (`+quantityReceived`).
  - `inventory_ledgers`: `movement_type = 'PURCHASE'`, `reference_type = 'PURCHASE_ORDER'`, `reference_id = po.id`.
- **Transfer Antar-Cabang**:
  - **Dispatch**: Saldo lokasi asal berkurang (`-quantityDispatched`). `inventory_ledgers`: `movement_type = 'TRANSFER_OUT'`, `reference_type = 'TRANSFER'`, `reference_id = transfer.id`.
  - **Receive**: Saldo lokasi tujuan bertambah (`+quantityReceived`). `inventory_ledgers`: `movement_type = 'TRANSFER_IN'`, `reference_type = 'TRANSFER'`, `reference_id = transfer.id`.

---

### 4. HASIL UJI VERIFIKASI OTOMATIS
Pengujian dijalankan via `test_epic07_supply_chain.ts`:
```text
===============================================================
EPIC-07 VERIFICATION SUITE: SUPPLY CHAIN, PURCHASING & LOGISTICS
===============================================================

[1/6] Resolving Active Tenant, Outlets & User Context...
  Tenant: Ura Coffee (1b29b1a6-898b-4aab-bbda-76db544c4a8f)
  Outlet A (Warehouse/Main): Gudang Utama - Toko Utama - Ura Coffee
  Outlet B (Branch): Toko Utama - Ura Coffee

[2/6] Verifying Master Supplier Lifecycle...
  ✅ Supplier dibuat: PT Biji Kopi Nusantara (SUPP-264426) - ID: b42f7c33-477c-4dbd-b175-00f16e2bfdf0
  ✅ Inventory Item disiapkan: Biji Kopi Arabica Gayo (RAW-BEAN-64429)
     Initial Stock: 20 KG @ Rp 90.000 / KG (Total Value = Rp 1.800.000)

[3/6] Verifying Purchase Order (PO) Creation & Issuance...
  ✅ Purchase Order dibuat: PO-20260921-5174 (Status: DRAFT, Total: Rp 3,000,000)
  ✅ Purchase Order di-issue: PO-20260921-5174 (Status: ISSUED)

[4/6] Verifying Goods Receiving & Moving Average Cost Recalculation...
  ✅ Goods Received processed for PO: PO-20260921-5174 (Status: RECEIVED)
  ✅ Moving Average Cost terverifikasi:
     Sebelumnya: Rp 90.000 | Penerimaan: 30 KG @ Rp 100.000
     Formula: ( (20 * 90.000) + (30 * 100.000) ) / 50 = Rp 96.000
     Hasil di Database: Rp 96,000
  ✅ Inventory Ledger audit terverifikasi: ID 4cb6413e-ec00-45be-a397-3d2c179926aa, Delta: +30, Balance After: 30

[5/6] Verifying Inter-Outlet Stock Transfer Workflow...
  ✅ Stock Transfer dibuat: TRF-20260921-3207 (Status: DRAFT)
  ✅ Stock Transfer di-dispatch: TRF-20260921-3207 (Status: IN_TRANSIT)
     Outlet A Balance: 20 KG -> 5 KG (Deducted 15 KG)
  ✅ TRANSFER_OUT Ledger terverifikasi: ID 27b1777d-873b-4b2a-ae5d-c122345e7eeb, Delta: -15
  ✅ Stock Transfer diterima di Outlet B: TRF-20260921-3207 (Status: RECEIVED)
     Outlet B Balance: 15 KG (Received 15 KG)
  ✅ TRANSFER_IN Ledger terverifikasi: ID f5b69803-98ff-4fd5-8669-5695fec5cbc3, Delta: +15

[6/6] Verifying Batch Expiry Alert System...
  ✅ Expiry Alert mendeteksi batch yang akan kadaluarsa:
     Batch: EXP-NEAR-4531, Item: Biji Kopi Arabica Gayo, Exp: 2026-09-26

===============================================================
🎉 EPIC-07 VERIFICATION COMPLETE: ALL 6/6 MODULES PASSED!
===============================================================
```

- **Server TypeScript Type Checking (`tsc --noEmit`)**: 0 error (Exit Code 0).
- **Client Production Build (`npm run build`)**: Berhasil 100% tanpa error kompilasi.
