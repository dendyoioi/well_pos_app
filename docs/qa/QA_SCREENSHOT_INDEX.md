# WELL POS — QA SCREENSHOT & EVIDENCE INDEX
**Indeks Bukti Visual Tangkapan Layar Pengujian E2E Pra-Rilis**
*Diterbitkan pada: 13 Oktober 2026 | Direktori Bukti: `docs/qa/evidence/`*

---

## 1. Daftar Bukti Tangkapan Layar Lengkap

| No | Berkas Tangkapan Layar | Viewport | Modul / Layar | Verifikasi Kunci |
| :---: | :--- | :---: | :--- | :--- |
| 1 | [`01_landing_hero_mobile.png`](file:///Users/dendyaditya/Projects/pos_project/docs/qa/evidence/01_landing_hero_mobile.png) | 375×812 | Landing Page Publik | Hero section, branding Well POS, CTA pendaftaran |
| 2 | [`02_registration_form_mobile.png`](file:///Users/dendyaditya/Projects/pos_project/docs/qa/evidence/02_registration_form_mobile.png) | 375×812 | Modal Registrasi Akun | Validasi input WhatsApp (+62), email unik, kata sandi |
| 3 | [`03_superadmin_dashboard_desktop.png`](file:///Users/dendyaditya/Projects/pos_project/docs/qa/evidence/03_superadmin_dashboard_desktop.png) | 1440×900 | SuperAdmin Control Tower | Tabel antrean persetujuan merchant & filter status |
| 4 | [`04_store_wizard_fullscreen_mobile.png`](file:///Users/dendyaditya/Projects/pos_project/docs/qa/evidence/04_store_wizard_fullscreen_mobile.png) | 375×812 | FullScreenStoreWizard | Wizard layar penuh pembuatan unit toko & jenis industri |
| 5 | [`05_shift_open_modal_tablet.png`](file:///Users/dendyaditya/Projects/pos_project/docs/qa/evidence/05_shift_open_modal_tablet.png) | 1024×768 | Modal Buka Shift Kasir | Input modal kas awal laci (*cash float*) Rp 100.000 |
| 6 | [`06_pos_terminal_active_tablet.png`](file:///Users/dendyaditya/Projects/pos_project/docs/qa/evidence/06_pos_terminal_active_tablet.png) | 1024×768 | Terminal Kasir Aktif | Katalog menu siap jual, sidebar keranjang belanja |
| 7 | [`07_cash_payment_modal_tablet.png`](file:///Users/dendyaditya/Projects/pos_project/docs/qa/evidence/07_cash_payment_modal_tablet.png) | 1024×768 | Modal Pembayaran Tunai | Input nominal uang dibayarkan Rp 50.000, kembalian live |
| 8 | [`08_cash_success_receipt_tablet.png`](file:///Users/dendyaditya/Projects/pos_project/docs/qa/evidence/08_cash_success_receipt_tablet.png) | 1024×768 | Struk Bukti Sukses Tunai | Nomor antrean transaksi, cetak struk, transaksi baru |
| 9 | [`09_qris_simulator_modal_tablet.png`](file:///Users/dendyaditya/Projects/pos_project/docs/qa/evidence/09_qris_simulator_modal_tablet.png) | 1024×768 | Simulator QRIS Dinamis | Kode QR dinamis, tombol simulasi pelunasan instan |
| 10 | [`10_orders_history_metrics_desktop.png`](file:///Users/dendyaditya/Projects/pos_project/docs/qa/evidence/10_orders_history_metrics_desktop.png) | 1440×900 | Riwayat Pesanan Kasir | 4 kartu metrik transaksi, kolom kasir eksplisit |
| 11 | [`11_order_voided_badge_desktop.png`](file:///Users/dendyaditya/Projects/pos_project/docs/qa/evidence/11_order_voided_badge_desktop.png) | 1440×900 | Badge Pembatalan (VOID) | Badge status `VOIDED`, otorisasi supervisor disahkan |
| 12 | [`12_close_shift_modal_tablet.png`](file:///Users/dendyaditya/Projects/pos_project/docs/qa/evidence/12_close_shift_modal_tablet.png) | 1024×768 | Modal Tutup Shift Kasir | Input hitungan kas fisik aktual & rekonsiliasi kas |
| 13 | [`13_z_report_pure_summary_slip.png`](file:///Users/dendyaditya/Projects/pos_project/docs/qa/evidence/13_z_report_pure_summary_slip.png) | 1024×768 | Slip Rekapan Murni Z-Report | Format ringkasan murni tanpa daftar nota (Zero Paper Waste) |
| 14 | [`14_financial_reports_dashboard_desktop.png`](file:///Users/dendyaditya/Projects/pos_project/docs/qa/evidence/14_financial_reports_dashboard_desktop.png) | 1440×900 | Dasbor Laporan Keuangan | Metrik omset bersih, HPP, margin laba, tombol ekspor CSV |

---

## 2. Parameter Penyimpanan Bukti
- **Format Berkas**: PNG (Lossless Compression, 24-bit color)
- **Kerapian Selektor**: Diambil langsung dari sesi headless Playwright native tanpa modifikasi atau injeksi mock palsu.
- **Integritas Privasi**: Kredensial rahasia SuperAdmin dan nomor telepon telah disanitasi.
