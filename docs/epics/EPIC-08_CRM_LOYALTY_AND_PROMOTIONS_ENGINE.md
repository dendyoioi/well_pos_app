# EPIC-08: CRM, CUSTOMER LOYALTY, DISCOUNTS & PROMOTIONS ENGINE
## Manajemen Pelanggan, Program Poin Reward, Voucher Promo & Struk Digital WhatsApp

**Epic ID**: `EPIC-08`  
**Status**: **COMPLETED ✅**  
**Prioritas**: **P3 — MEDIUM (CUSTOMER RETENTION & SALES GROWTH)**  
**Target Komponen**: `pos_apps/server` & `pos_apps/client`  
**Dokumen Induk**: [`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](file:///Users/dendyaditya/Projects/pos_project/docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)  
**Dokumen Arsitektur Rujukan**: `docs/00_PROJECT_CONTEXT.md` (Section 2 & 3)  
**Tanggal Eksekusi**: 2026-09-21  

---

### 1. DESKRIPSI & TUJUAN BISNIS
Membangun loyalitas pelanggan dengan mencatat riwayat transaksi konsumen, memberikan reward poin per pembelanjaan, menerapkan kode promo atau diskon otomatis berbasis aturan bisnis (persentase / nominal dengan batas diskon dan minimal belanja), audit mutasi saldo poin pelanggan (*double-entry ledger*), serta pengiriman struk digital via WhatsApp dan web view.

---

### 2. ARSITEKTUR & SKEMA DATABASE

#### 2.1 Enum Baru (`schema.prisma` & PostgreSQL)
- `CustomerTier`: `BRONZE`, `SILVER`, `GOLD`, `PLATINUM`.
- `PointTxType`: `EARNED_PURCHASE`, `REDEEMED_ORDER`, `MANUAL_ADJUSTMENT`, `REFUND_REVOCATION`, `EXPIRY`.
- `DiscountType`: `PERCENTAGE`, `FIXED_AMOUNT`.

#### 2.2 Tabel Baru & Kolom Tambahan
1. **`customer_point_ledgers`**:
   - Buku besar audit poin per pelanggan (`tenant_id`, `customer_id`, `order_id`, `type`, `delta_points`, `balance_after`, `notes`, `created_at`).
   - Immutable log untuk memastikan integritas perolehan dan penukaran poin.
2. **`promotions`**:
   - Master kupon/voucher (`tenant_id`, `code`, `name`, `discount_type`, `discount_value`, `min_spend`, `max_discount`, `quota_total`, `quota_used`, `start_date`, `end_date`, `is_active`).
3. **`promotion_usages`**:
   - Riwayat audit pemakaian promo (`tenant_id`, `promotion_id`, `order_id`, `customer_id`, `discount_amount`, `used_at`).
4. **Perluasan Tabel `outlets`**:
   - `loyalty_config`: Kolom JSONB untuk konfigurasi loyalitas granular per-outlet (`isActive`, `pointsPerSpend`, `pointValueIdr`, `minPointsToRedeem`). Default `null`/`isActive: false` (nonaktif secara default agar netral antar cabang).
5. **Perluasan Tabel `customers`**:
   - `tier`: Level membership (`CustomerTier`).
   - `notes`: Catatan CRM preferensi konsumen.
6. **Perluasan Tabel `orders`**:
   - `promotion_id`: Relasi ke voucher yang digunakan.
   - `points_earned`: Jumlah poin yang diperoleh dari pesanan.
   - `points_redeemed`: Jumlah poin yang ditukarkan pada pesanan.
   - `point_discount_amount`: Nilai potongan rupiah dari penukaran poin.

#### 2.3 Antarmuka Backoffice & POS
1. **`LoyaltySettingsView.tsx`**: Pengaturan program poin per outlet (saklar aktif/nonaktif, rasio belanja per poin, nilai konversi rupiah, minimal penukaran, dan kalkulator simulasi).
2. **`CustomersView.tsx`**: Kolom tier badge (🥉/🥈/🥇/💎) & saldo poin, modal detail riwayat transaksi vs mutasi buku besar poin (`CustomerPointLedger`), serta form penyesuaian manual poin instan (inline zero-stacked modal).
3. **`PromotionsView.tsx`**: Saklar toggle aktif/nonaktif cepat pada baris tabel & modal audit pemakaian voucher (`usages` log pelanggan, transaksi, & nominal diskon).
4. **`OrderCartSidebar.tsx` & `PosMobileView.tsx`**: Tampilan tier & poin member, slider/input penukaran poin langsung di kasir (hanya aktif jika outlet mengaktifkan program poin), dan integrasi struk termal/PDF.

---

### 3. ATURAN BISNIS (BUSINESS RULES)

#### 3.1 Loyalty Points & Tiering Rules
- **Nilai Poin**: 1 Poin = Rp 100 potongan belanja.
- **Perolehan Poin Base**: Setiap pembelanjaan Rp 10.000 menghasilkan 1 Poin dasar.
- **Threshold & Multiplier Tier Membership**:
  - `BRONZE`: Total belanja < Rp 1.000.000 (Multiplier: 1.0x).
  - `SILVER`: Total belanja >= Rp 1.000.000 (Multiplier: 1.25x).
  - `GOLD`: Total belanja >= Rp 5.000.000 (Multiplier: 1.5x).
  - `PLATINUM`: Total belanja >= Rp 15.000.000 (Multiplier: 2.0x).
- **Penukaran Poin**: Poin hanya dapat ditukarkan hingga maksimal subtotal transaksi (tidak boleh melebihi tagihan).

#### 3.2 Promo & Voucher Rules
- Kuota global voucher diperiksa sebelum checkout dan diinkrementasi saat transaksi berhasil.
- Mendukung `PERCENTAGE` dengan `max_discount` (misal diskon 20% capped di Rp 25.000).
- Validasi rentang tanggal aktif dan batas minimal belanja (`min_spend`).

#### 3.3 Struk Digital & WhatsApp Integration
- Format teks struk di-generate di backend dengan tipografi Markdown WhatsApp (`*bold*`, garis pemisah ASCII).
- Endpoint `/api/orders/:id/digital-receipt` menyediakan HTML web-receipt bersih yang dapat dibuka pelanggan.
- Endpoint `/api/orders/:id/send-receipt` menghasilkan tautan WhatsApp instan `https://api.whatsapp.com/send?phone=...&text=...`.

---

### 4. DAFTAR API ENDPOINTS BARU

| Method | Endpoint | Deskripsi | Akses |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/promotions` | List daftar promosi / voucher aktif tenant | Cashier / Admin |
| `POST` | `/api/promotions` | Buat promo / voucher baru | Admin |
| `POST` | `/api/promotions/validate` | Validasi kode promo terhadap keranjang belanja | Cashier / POS |
| `PUT` | `/api/promotions/:id` | Update master voucher promo | Admin |
| `DELETE` | `/api/promotions/:id` | Nonaktifkan voucher promo | Admin |
| `GET` | `/api/customers/:id/points-history`| Riwayat audit mutasi buku besar poin pelanggan | Cashier / Admin |
| `POST` | `/api/customers/:id/adjust-points` | Penyesuaian manual poin pelanggan (+/-) | Admin |
| `GET` | `/api/orders/:id/digital-receipt` | Render halaman web struk digital pesanan | Public / Pelanggan |
| `POST` | `/api/orders/:id/send-receipt` | Kirim struk digital ke WhatsApp / Email | Cashier |

---

### 5. HASIL VERIFIKASI SPRINT (VERIFICATION SUITE)

Script uji otomatis: `pos_apps/server/src/migrations/contract/test_epic08_crm_loyalty_promo.ts`.

```text
===============================================================
EPIC-08 VERIFICATION SUITE: CRM, LOYALTY, DISCOUNTS & PROMOTIONS
===============================================================

[1/7] Resolving Active Tenant, Outlet & User Context...
  Tenant: Ura Coffee (1b29b1a6-898b-4aab-bbda-76db544c4a8f)
  Outlet: Gudang Utama - Toko Utama - Ura Coffee (f1d3b250-4d75-40a3-99f3-a831263a0635)
  Cashier: Rudra (e2dce666-fe56-4b47-a39f-9ca911528fef)

[2/7] Verifying Customer CRM Profile & Tier Initialization...
  ✅ Customer Profile created: Rian Pratama Kusuma (CUST-31398)
     Tier: BRONZE, Poin: 0, Total Belanja: Rp 0

[3/7] Verifying Promotion & Voucher Engine...
  ✅ Promo Voucher created: DISKON20-1402 (Diskon Spesial 20% Grand Launching)
     Type: PERCENTAGE, Value: 20%, Min: Rp 50000, Max: Rp 25000
  ✅ Validation 1 Passed (Subtotal Rp 100.000): Potongan Rp 20.000
  ✅ Validation 2 Passed (Subtotal Rp 200.000 capped): Potongan Rp 25.000
  ✅ Validation 3 Passed (Subtotal < Min Spend): Ditolak dengan pesan "Minimal belanja untuk promo ini adalah Rp 50.000"

[4/7] Verifying Checkout with Voucher & Point Earning...
  ✅ Transaksi 1 Sukses: INV/20260921/OUT/1430 (Grand Total: Rp 80.000)
  ✅ Promotion Usage terverifikasi: Rp 20.000 applied
  ✅ Poin Pelanggan bertambah: 8 Poin (Total Belanja: Rp 80.000)
  ✅ Point Ledger Audit terbit: +8 Poin (Balance After: 8)

[5/7] Verifying Point Redemption on Checkout...
  ✅ Transaksi 2 Sukses: INV/20260921/OUT/1455
     Subtotal: Rp 50.000 | Tukar Poin: 5 pt (-Rp 500) | Grand Total: Rp 49.500
  ✅ Saldo Poin Akhir: 7 Poin (Expected: 7)
  ✅ Ledger Penukaran Poin terverifikasi: -5 Poin

[6/7] Verifying Lifetime Spend Tier Progression...
  ✅ Tier Upgrade terverifikasi: SILVER (Total Belanja: Rp 1.129.500)

[7/7] Verifying Digital Receipt Generation & WhatsApp Formatting...
  ✅ Digital Receipt WhatsApp text generated:

*STRUK PEMBELIAN - GUDANG UTAMA - TOKO UTAMA - URA COFFEE*
================================
No. Faktur : INV/20260921/OUT/1430
Kasir      : Rudra
Pelanggan  : Rian Pratama Kusuma (SILVER Member)
--------------------------------
Subtotal   : Rp 100.000
Promo [DISKON20-1402]: -Rp 20.000
*TOTAL      : Rp 80.000*
================================

  ✅ WhatsApp Sharing URL: https://api.whatsapp.com/send?phone=081007231398&text=*STRUK%20PEMBELIAN%20...
===============================================================
🎉 EPIC-08 VERIFICATION COMPLETE: ALL 7/7 MODULES PASSED!
===============================================================
```

---

### 6. KESIMPULAN
EPIC-08 telah rampung 100% dengan paritas penuh di seluruh layer:
1. Skema PostgreSQL target dan Prisma Client tersinkronisasi.
2. `LoyaltyService` & `PromotionService` teruji secara atomik dalam transaksi ACID.
3. Integrasi POS Terminal Checkout mendukung voucher diskon dan penukaran poin langsung.
4. Digital receipt WhatsApp dan HTML view siap pakai.
5. Zero TypeScript errors pada server maupun client build.
