# PROMPT 14.3 — CONTROLLER WIRE-UP & STAGED INTEGRATION TESTING

## 0. CONTEXT & LIFECYCLE POSITION

**Migration Lifecycle State:**
```text
  [ EXPAND ]     ===>  COMPLETED
  [ BACKFILL ]   ===>  COMPLETED & RECONCILED (100% Parity Achieved — OAUTH-13.4-01)
  [ DUAL-WRITE ] ===>  CURRENT PHASE (Controller Wire-Up & Integration Gate)
  [ RECONCILE ]  ===>  PENDING
  [ CUTOVER ]    ===>  PENDING
  [ CONTRACT ]   ===>  PENDING
```

Following the unconditional approval of Prompt 14.2 (Dual-Write Domain Services Implementation & Isolated Unit Testing), all 5 centralized domain services (`Catalog`, `Inventory`, `Sales`, `User`, `Location`) are fully implemented, typed with zero compilation errors, and verified with 11/11 passing test suites.

Tahap berikutnya adalah **PROMPT 14.3 — CONTROLLER WIRE-UP & STAGED INTEGRATION TESTING**.
Pada tahap ini, kontroler backend Express di `pos_apps/server/src/controllers/` akan didelegasikan secara bertahap untuk memanggil Domain Services Dual-Write yang telah teruji.

---

# 1. OBJECTIVES

Antigravity (*Implementation Agent*) diotorisasi untuk:
1. **Wire-up Controllers:** Memodifikasi kontroler publik di `pos_apps/server/src/controllers/` agar mendelegasikan transaksi mutasi ke layanan `server/src/services/dual_write/`:
   - `outlet.controller.ts`: Delegasikan pembuatan outlet ke `locationDualWriteService.createOutlet`.
   - `user.controller.ts`: Delegasikan pembuatan & pembaruan user ke `userDualWriteService.createUser` dan `updateUser`.
   - `product.controller.ts`: Delegasikan create, update, delete produk ke `catalogDualWriteService.createProduct`, `updateProduct`, `deleteProduct`.
   - `inventory.controller.ts`: Delegasikan stock-in, stock-out, adjustment, transfer ke `inventoryDualWriteService`.
   - `order.controller.ts`: Delegasikan checkout transaksi kasir ke `salesDualWriteService.processCheckout`.
2. **Preserve HTTP API Contracts:** Format response JSON, struktur error, dan status code HTTP pada kontroler **WAJIB 100% IDENTIK** dengan kontrak eksisting agar frontend POS tidak mengalami regresi.
3. **Staged End-to-End API Integration Testing:** Buat dan jalankan test runner integrasi API (misal: `supertest` atau HTTP simulation script) terhadap basis data sandbox terisolasi (`pos_dual_write_sandbox`) untuk membuktikan:
   - Request HTTP `POST /api/products` menghasilkan produk legacy + variant & balance target.
   - Request HTTP `POST /api/inventory/stock-in` mengupdate stok legacy + balance & ledger target.
   - Request HTTP `POST /api/orders/checkout` memproses penjualan kasir legacy + payment_transactions & pemotongan stok target dengan multiplier ADR-003.
   - Request HTTP `POST /api/users` menghasilkan user legacy + user_code & Bcrypt pin_hash (Model B / OD-13.3-03).
4. **Reconciliation Audit Verification:** Buktikan bahwa setelah simulasi mutasi end-to-end melalui API, skrip `reconcile_all.ts` tetap menghasilkan **100% Paritas (0 Diskrepansi)**.

---

# 2. HARD SAFETY BOUNDARIES

Selama Prompt 14.3:
- **STRICTLY PROHIBITED:**
  - DDL atau DML pada basis data produksi `pos_db`. Seluruh pengujian wajib diarahkan ke `pos_dual_write_sandbox`.
  - Menjalankan `prisma generate` yang menimpa `@prisma/client`.
  - Mengubah kontrak request/response API publik yang merusak frontend.
  - Menjalankan server produksi `pos_db` (tetap OFFLINE / quiescent).
- **ALLOWED:**
  - Mengedit file kontroler di `pos_apps/server/src/controllers/`.
  - Menambahkan file pengujian integrasi di `pos_apps/server/src/controllers/__tests__/` atau test runner dedicated.
  - Menjalankan pengujian API terhadap `pos_dual_write_sandbox`.

---

# 3. KONTRAK WIRE-UP KONTROLER (STEP-BY-STEP)

### 3.1 `outlet.controller.ts`
- Pada fungsi `createOutlet`, ganti blok transaksi Prisma langsung dengan pemanggilan:
  ```typescript
  const result = await prisma.$transaction(async (tx) => {
    return await locationDualWriteService.createOutlet(dto, { tx, tenantId: req.user.tenantId, actorUserId: req.user.id });
  });
  ```
- Kembalikan `result.legacyData` pada response JSON.

### 3.2 `user.controller.ts`
- Pada fungsi `createUser` dan `updateUser`, delegasikan mutasi ke:
  ```typescript
  userDualWriteService.createUser(dto, { tx, tenantId: req.user.tenantId, actorUserId: req.user.id })
  userDualWriteService.updateUser(id, dto, { tx, tenantId: req.user.tenantId, actorUserId: req.user.id })
  ```
- Pastikan OD-13.3-03 ditegakkan (PIN-less user retain `pin_hash = NULL`).

### 3.3 `product.controller.ts`
- Pada `createProduct`, `updateProduct`, dan `deleteProduct`, delegasikan ke `catalogDualWriteService`.
- Pastikan default variant, inventory item kanonikal, dan initial balance terbentuk secara otomatis.

### 3.4 `inventory.controller.ts`
- Pada `recordStockIn`, `recordStockOut`, `recordStockAdjustment`, dan `transferStock`, delegasikan ke `inventoryDualWriteService`.
- Pastikan pengecekan ADR-002 (Negative stock policy) tetap fail-closed pada Retail.

### 3.5 `order.controller.ts`
- Pada `checkoutOrder`, delegasikan pemotongan stok, pembuatan order items, dan pencatatan pembayaran ke `salesDualWriteService.processCheckout`.
- Pastikan `order_items.product_variant_id` terisi dan `payment_transactions` terbit secara atomik.

---

# 4. DELIVERABLES REQUIRED

Antigravity harus menghasilkan:
1. Kontroler yang terhubung (*wired-up*) di `pos_apps/server/src/controllers/`.
2. Test runner integrasi API (misal: `test_prompt_14_3_controller_integration.ts`).
3. Bukti eksekusi pengujian dengan status 100% kelulusan terhadap `pos_dual_write_sandbox`.
4. Laporan resmi eksekusi di:
   `docs/validation/22_PROMPT_14_3_CONTROLLER_WIRE_UP_REPORT.md`

### Final Gate Declaration:
```text
FINAL GATE: READY FOR PROJECT OWNER REVIEW & LIVE DUAL-WRITE ACTIVATION AUTHORIZATION
```

Setelah selesai, **BERHENTI DAN SERAHKAN KEPADA PROJECT OWNER UNTUK DIAUDIT.**
Dilarang menyalakan aplikasi terhadap `pos_db` sebelum otorisasi resmi Project Owner.
