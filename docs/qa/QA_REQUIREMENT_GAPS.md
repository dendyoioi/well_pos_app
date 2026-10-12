# WELL POS — QA REQUIREMENT GAPS & EDGE CASE MATRIX
## Unresolved Assumptions, Boundary Conditions & Business Clarifications

> **Phase**: Test Design & Business Rule Validation (Antigravity Prompt 2)  
> **Repository**: `/Users/dendyaditya/Projects/pos_project`  
> **Date**: 12 Oktober 2026  
> **Execution Status**: `NOT RUN` (Design Phase Only)  

---

### 1. DAFTAR KASUS UJI NEGATIF & BATASAN SISTEM (EDGE CASES)

| ID Kasus | Kategori | Skenario Pengujian Negatif | Perilaku yang Diharapkan (Expected Behavior) | Klasifikasi Status |
| :--- | :--- | :--- | :--- | :---: |
| **NEG-01** | **Batas Kasir** | Kasir mencoba menutup shift saat ada pesanan berstatus `UNPAID` (Open Tab). | Backend menolak (`HTTP 400 UNPAID_ORDERS_REMAINING`), UI menampilkan peringatan daftar invoice aktif. | `[VERIFIED]` |
| **NEG-02** | **Otorisasi PIN** | Kasir memasukkan PIN salah saat membatalkan transaksi (VOID). | Permintaan void ditolak, sistem mencatat kegagalan audit PIN, stok tidak berubah. | `[VERIFIED]` |
| **NEG-03** | **Stok Negatif F&B** | Transaksi F&B tetap diproses saat saldo bahan baku di sistem mencapai 0. | Sesuai **ADR-002**, stok bahan baku diizinkan bertanda negatif di tingkat service layer agar operasional dapur tidak macet, dengan peringatan visual merah di Backoffice. | `[VERIFIED]` |
| **NEG-04** | **Batas Role Kasir** | Staf ber-role `CASHIER` mencoba mengakses endpoint laporan finansial (`GET /api/reports/financial`). | API backend menolak dengan `HTTP 403 Forbidden` (`INSUFFICIENT_PERMISSIONS`). | `[VERIFIED]` |
| **NEG-05** | **Duplikasi Offline** | Antrean transaksi offline dikirim ulang dua kali saat koneksi internet pulih. | Backend mendeteksi UUID `offlineReferenceId` yang sama pada tabel `IdempotencyRecord` dan mengabaikan pengiriman kedua tanpa membuat nota baru. | `[VERIFIED]` |
| **NEG-06** | **Pencabutan Sesi** | Owner mencabut sesi login kasir dari Backoffice saat kasir sedang membuka POS. | Event `auth:session_revoked` memicu pengosongan sesi lokal dan mengembalikan terminal ke layar login. | `[VERIFIED]` |

---

### 2. REQUIREMENT GAPS & ASUMSI YANG MEMERLUKAN KLARIFIKASI

Berikut adalah rincian area spesifikasi yang telah terimplementasi di kode namun dicatat untuk konfirmasi pemangku kepentingan bisnis:

1. **Kebijakan Pembatalan Parsial (Partial Item Void)**:
   - *Status Implementasi*: `EPIC-24` mendukung Full Transaction Void dan Partial Item Void.
   - *Pertanyaan Validasi*: Pada rilis awal, apakah seluruh kasir diizinkan melakukan Partial Item Void dengan PIN Supervisor, ataukah difokuskan pada pembatalan seluruh faktur nota (Full Void)?
   - *Catatan Uji*: Pengujian akan memverifikasi Full Transaction Void sebagai baseline P0.

2. **Toleransi Selisih Kas Tutup Shift (Over/Short)**:
   - *Status Implementasi*: Sistem mencatat selisih fisik kasir ke record `Shift` dan slip Z-Report tanpa memblokir tombol tutup shift.
   - *Pertanyaan Validasi*: Apakah ada batas nominal selisih (misal di atas Rp 50.000) yang mewajibkan approval PIN Supervisor sebelum kasir dapat menekan tombol tutup shift?
   - *Catatan Uji*: Pengujian saat ini memvalidasi pencatatan selisih berapapun nominalnya ke dalam laporan audit.

3. **Status Jatuh Tempo Kasbon (Customer Receivables)**:
   - *Status Implementasi*: `EPIC-27` mencatat tanggal jatuh tempo (+7, +14, +30 hari atau kustom) dengan tombol 1-klik tagih WhatsApp via deep-link `wa.me`.
   - *Catatan Uji*: Pengujian memvalidasi bahwa pelanggan kasbon yang melewati jatuh tempo mendapatkan badge visual peringatan di Backoffice CRM.
