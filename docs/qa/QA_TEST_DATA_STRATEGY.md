# WELL POS — QA TEST DATA STRATEGY
## Fixture Management, Sandbox Seeding & Data Isolation Strategy

> **Phase**: Test Design & Business Rule Validation (Antigravity Prompt 2)  
> **Repository**: `/Users/dendyaditya/Projects/pos_project`  
> **Date**: 12 Oktober 2026  
> **Execution Status**: `NOT RUN` (Design Phase Only)  

---

### 1. STRATEGI BASELINE DATA (SANDBOX SEED FIXTURES)

Sebelum pengujian otomasi browser dijalankan, database lokal akan disterilkan menggunakan seeder kanonikal:

```bash
npm run seed:sandbox
```

Seeder ini menghasilkan baseline data bisnis operasional yang utuh untuk tenant `ura-coffee` (**Ura Coffee & Roastery**):

| Entitas Data | Record Fixture di Database | Rincian Spesifik untuk Pengujian |
| :--- | :--- | :--- |
| **Tenant & Toko** | Tenant `ura-coffee`<br/>Outlet `Kemang Flagship (OUT-01)` | Status: `ACTIVE`, Industri: F&B Cafe & Roastery, Pajak PB1: 10%. |
| **Gudang & Lokasi** | Gudang Pusat `Central Warehouse (WH-01)`<br/>Lokasi Toko: `Bar Display`, `Dapur Utama` | Alokasi pasokan bahan baku F&B terhubung ke gudang pusat. |
| **Katalog Produk** | Produk `Es Kopi Susu Gula Aren`<br/>Produk `Americano Classic`<br/>Produk Retail `Biji Kopi House Blend 250g` | Harga: Rp 22.000 (Kopi Susu), Rp 18.000 (Americano), Rp 75.000 (Retail). |
| **Grup Modifier** | Grup `Ukuran Cup` (Reguler / Large)<br/>Grup `Tambahan Topping` (Extra Shot Espresso) | Extra Shot menambah harga Rp 5.000 dan memotong 9g biji kopi. |
| **Bahan Baku & BOM** | `Biji Kopi Espresso` (Gram)<br/>`Susu Fresh Milk` (Mililiter)<br/>`Paper Cup 12oz` (Pcs)<br/>`Gula Aren Cair` (Mililiter) | Saldo awal mencukupi (>1.000 unit), satuan UOM terdefinisi. |
| **Pelanggan & Member** | `Budi Pelanggan Setia` (Gold)<br/>`Siti Member Baru` (Bronze) | Memiliki nomor telepon WhatsApp normal `+62812...` dan saldo kasbon awal Rp 0. |

---

### 2. ISOLASI & EKSEKUSI BERTAHAP (CUMULATIVE JOURNEY)

Strategi eksekusi pengujian browser Playwright untuk alur utama dirancang secara **berkesinambungan (*Cumulative E2E Chain*)**:

1. **Tahap 1**: Verifikasi SuperAdmin & Onboarding (Independen, membaca status tenant).
2. **Tahap 2**: Buka Shift Kasir dengan Modal Kas Rp 100.000.
3. **Tahap 3**: Transaksi Kasir F&B (Membentuk nota dan memotong stok bahan baku).
4. **Tahap 4**: Transaksi Non-Tunai QRIS Simulator.
5. **Tahap 5**: Pembatalan Transaksi (VOID) dengan PIN Supervisor.
6. **Tahap 6**: Pengujian Negatif Lock Tutup Shift pada Pesanan Belum Lunas (Open Tab).
7. **Tahap 7**: Tutup Shift Kasir (Menghasilkan Z-Report Murni Rekapitulasi).
8. **Tahap 8**: Verifikasi Konsistensi Laporan Finansial Owner Backoffice.

*Keuntungan Pendekatan Kumulatif*:
Menguji integritas sistem nyata dari hulu ke hilir seperti operasional toko di dunia nyata, membuktikan bahwa saldo kas laci, mutasi stok bahan baku, dan rekonsiliasi akhir sinkron 100%.

---

### 3. PENANGANAN LAYANAN EKSTERNAL (MOCK & SIMULATOR)

| Layanan Eksternal | Strategi Mocking / Simulasi Lokal | Bukti Kode |
| :--- | :--- | :--- |
| **Payment Gateway QRIS** | **Pakasir / Midtrans Simulator Lokal**: Modal simulator memicu callback webhook/status lokal tanpa kartu/rekening nyata. | [`PosTerminalView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PosTerminalView.tsx) |
| **WhatsApp Gateway** | **Sandbox Simulator Mode**: Pesan nota kasir tercatat ke audit log simulator tanpa request HTTP ke server Fonnte. | [`EPIC-25`](file:///Users/dendyaditya/Projects/pos_project/docs/epics/EPIC-25_WHATSAPP_GATEWAY_AUTOMATION.md) |
| **Thermal Printer** | **Virtual Preview & PDF**: Struk dirender di modal layar dan dapat diunduh sebagai PDF biner via jsPDF. | [`ReceiptSettingsView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ReceiptSettingsView.tsx) |
| **Hardware Cash Drawer** | **UI Event Listener**: Sinyal pulse laci kasir ditangkap via browser log. | [`PosTerminalView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PosTerminalView.tsx) |
