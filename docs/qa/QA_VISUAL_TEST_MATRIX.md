# WELL POS — QA VISUAL AND RESPONSIVE TEST MATRIX
## Viewport Specifications, Screenshot Baselines & Component State Assertions

> **Phase**: Test Design & Business Rule Validation (Antigravity Prompt 2)  
> **Repository**: `/Users/dendyaditya/Projects/pos_project`  
> **Date**: 12 Oktober 2026  
> **Execution Status**: `NOT RUN` (Design Phase Only)  

---

### 1. SPESIFIKASI RESOLUSI VIEWPORT STANDAR (CANONICAL VIEWPORTS)

Pengujian visual otomatis Playwright wajib dieksekusi pada 3 resolusi perangkat standar:

| Tipe Perangkat | Resolusi Lebar x Tinggi | Rasio / Skala | Fokus Validasi Antarmuka |
| :--- | :---: | :---: | :--- |
| **Desktop Workstation** | `1440 x 900 px` | 1.0x | Sidebar accordion penuh, dasbor analitika SVG, tabel data lebar, kontrol Superadmin. |
| **Tablet Kasir Lanskap** | `1024 x 768 px` | 1.0x | Layout Terminal Kasir POS 2 kolom (katalog di kiri, nota belanja & tombol bayar di kanan). |
| **Mobile Smartphone PWA** | `375 x 812 px` (iPhone) | 2.0x / Mobile | Bottom-sheet drawer modal, sticky action footer, safe-area inset bottom, PWA banner. |

---

### 2. MATRIKS TANGKAPAN LAYAR & TARGET ASSERTION VISUAL

| ID Target | Halaman / Komponen | Viewport | Kondisi / State | Kriteria Assertion Visual (Objective Checks) |
| :--- | :--- | :---: | :--- | :--- |
| **VIS-01** | Landing Page Publik SaaS (`/#landing`) | Desktop & Mobile | Default Initial State | Hero banner rapi, kartu harga paket berlangganan tidak overflow, formulir registrasi 5-field presisi. |
| **VIS-02** | Superadmin Control Tower (`/#hq-gate-99`) | Desktop | Login & Dashboard | Tombol "Gunakan Akun Default", badge status tenant (pills), tabel daftar toko tenant tidak ada clipping. |
| **VIS-03** | Modal Buka Shift Kasir | Tablet & Mobile | Dialog Pop-up | Input uang modal kas awal `<CurrencyInput />` bersih dengan pemisah titik live, tombol aksi jelas. |
| **VIS-04** | Terminal Kasir POS (`/#pos`) | Tablet & Mobile | Katalog & Keranjang | Grid produk rapi, badge stok akurat, panel keranjang nota di sisi kanan mudah diakses. |
| **VIS-05** | Modal Varian & Modifier Resep | Tablet & Mobile | Bottom-Sheet PWA | Opsi pilihan topping (Extra Shot) terlihat jelas, tombol "Tambahkan ke Pesanan" sticky di footer bawah. |
| **VIS-06** | Modal Pembayaran QRIS Simulator | Tablet & Mobile | QRIS Modal | Gambar QR code tampil tajam di tengah, nominal tagihan jelas, tombol simulasi pembayaran interaktif. |
| **VIS-07** | Modal Sukses Pembayaran Kasir | Tablet & Mobile | Success Dialog | Nominal kembalian besar dan kontras, nomor antrean panggilan (misal `#01`) terbaca jelas. |
| **VIS-08** | Kitchen Display System KDS (`qr_orders`)| Desktop & Tablet | Dark Mode Fullscreen | Latar belakang tema gelap (`bg-slate-950`), kartu pesanan tiket kontras tinggi, elapsed timer badge menyala. |
| **VIS-09** | Modal Pembatalan Transaksi (VOID) | Desktop & Tablet | PIN Verification | Form 6 digit PIN supervisor, pilihan alasan void, konfirmasi pembatalan tanpa modal bertumpuk. |
| **VIS-10** | Pratinjau Struk Cetak Slip VOID | Desktop | Visual Slip Preview | Blok tanda tangan Kasir dan Supervisor tampil berdampingan, rincian refund tercatat. |
| **VIS-11** | Kalkulator Pecahan Uang (Tutup Shift) | Tablet & Mobile | Cash Counter Sheet | Grid pecahan uang kertas (100rb, 50rb, 20rb, dll) dan koin responsif, total hitungan fisik akurat live. |
| **VIS-12** | Pratinjau Slip Z-Report Kasir | Tablet & Mobile | Z-Report Slip | **Rekapitulasi finansial murni** (Kas laci, petty cash, omset tunai/QRIS, selisih). **NOL BARIS DAFTAR TRANSAKSI**. |
| **VIS-13** | Dasbor Laba Rugi Backoffice (`reports`) | Desktop | Executive Overview | 4 Kartu KPI finansial, kurva grafik visual tren penjualan/HPP SVG murni, tombol ekspor CSV. |

---

### 3. STANDAR INTEGRITAS ELEMEN & ATURAN PENGUJIAN VISUAL

1. **Aturan Sticky Action Footer (Anti-Unscrollable Modal)**:
   - Pada viewport mobile (375x812), seluruh modal input wajib memiliki body yang dapat digulir (`overflow-y-auto`) dengan tombol aksi di footer bawah yang terkunci (*sticky footer* `shrink-0`) dan memiliki bantalan safe area iPhone: `pb-[max(1rem,env(safe-area-inset-bottom))]`.
2. **Kebijakan Nol Modal Bertumpuk (Zero Stacked Modals)**:
   - Tes visual wajib memvalidasi bahwa membuka sub-aksi (seperti memilih varian atau input PIN) tidak merender backdrop modal gelap di atas modal yang sedang terbuka.
3. **Kebijakan Nol Tombol Refresh Mandiri**:
   - Memastikan tidak ada tombol icon `<RefreshCw />` mandiri yang mengacaukan keselarasan header dan toolbar view.
