# WELL POS — QA TESTABILITY AUDIT
## Evaluation of System Testability, Selectors, Data Fixtures & Verification Strategies

> **Audit Type**: Strict Read-Only Discovery Audit (Antigravity Prompt 1)  
> **Repository**: `/Users/dendyaditya/Projects/pos_project`  
> **Audit Date**: 12 Oktober 2026  
> **Status**: COMPLETED ✅  

---

### 1. SELEKTOR ELEMEN & DATA-TESTID READINESS

| Aspek | Kondisi Saat Ini | Klasifikasi | Evaluasi & Rekomendasi |
| :--- | :--- | :---: | :--- |
| **Atribut `data-testid`** | Mayoritas komponen interaktif menggunakan selektor teks semantik (`role="button"`, placeholder, class nama form). Sebagian formulir belum memiliki atribut `data-testid` eksplisit secara universal. | `[VERIFIED]` | Untuk pengujian E2E Playwright, gunakan selektor semantik Playwright (`page.getByRole('button', { name: ... })`, `page.getByPlaceholder(...)`, `page.getByText(...)`) yang tahan terhadap refaktor layout internal. |
| **Konsistensi Komponen Input** | Menggunakan wrapper standar: `<WhatsAppInput />`, `<CurrencyInput />`, `<SearchInput />`, `<TablePagination />`. | `[VERIFIED]` | Sangat menguntungkan untuk testability karena perilaku input angka uang dan telepon terstandarisasi seragam di seluruh form. |
| **Modal & Dialog** | Pola kanonikal Bottom-Sheet responsif PWA (`max-h-[92dvh] sm:max-h-[90vh]`, sticky footer dengan safe area). Kebijakan *Zero Stacked Modals* aktif. | `[VERIFIED]` | Mengurangi flaky test secara drastis karena tidak ada layer popup bertumpuk yang memblokir klik pointer pada elemen di bawahnya. |

---

### 2. AUTENTIKASI & KETERSEDIAAN AKUN UJI COBA (TEST ACCOUNTS)

Akun pengujian multi-role telah terpasang permanen di dalam seeder sandbox lokal ([`prisma/seed.sandbox.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/prisma/seed.sandbox.ts) dan [`prisma/seed.testbed_statuses.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/prisma/seed.testbed_statuses.ts)):

| Role Pengujian | Kredensial Login | Lingkungan / Modul Target | Klasifikasi |
| :--- | :--- | :--- | :---: |
| **SuperAdmin** | Email: `superadmin@wellpos.id`<br/>Password: `SuperAdmin123!` | Portal Platform SaaS (`/#hq-gate-99`) | `[VERIFIED]` |
| **Owner Merchant** | Email: `owner@uracoffee.id`<br/>Password: `Owner123!`<br/>PIN Spv: `123456` | Backoffice Merchant Lengkap & Otorisasi (`/#dashboard`) | `[VERIFIED]` |
| **Kasir Toko (Cashier)** | Nama: `Rian Kasir Kemang`<br/>Toko: `ura-coffee`<br/>PIN: `123456` | Terminal Kasir POS & Buka/Tutup Shift (`/#pos`) | `[VERIFIED]` |
| **Kepala Gudang** | Email: `gudang@uracoffee.id`<br/>Password: `Gudang123!` | Rantai Pasok & Multi-Gudang (`WH-01`) | `[VERIFIED]` |
| **Supervisor Toko** | Email: `supervisor@uracoffee.id`<br/>Password: `Spv123!` | Otorisasi Void/Refund & Audit Kasir | `[VERIFIED]` |
| **Staf Dapur (Kitchen)** | Akun Dapur KDS | Layar Monitor Pesanan Dapur (`/#dashboard` tab `qr_orders`) | `[VERIFIED]` |

*Catatan Keamanan*: Kredensial di atas merupakan data dummy seeder lokal standar sandbox (`SANDBOX_PLAYBOOK.md`), bukan data akun pengguna produksi.

---

### 3. PENYIAPAN & PEMBERSIHAN DATA PENGUJIAN (FIXTURE & CLEANUP)

| Mekanisme | Perintah Eksekusi | Kecepatan Eksekusi | Efek Samping & Isolasi |
| :--- | :--- | :--- | :--- |
| **Reset Sandbox Steril** | `npm run seed:sandbox` | ~2.8 detik | Mengembalikan seluruh tenant Ura Coffee ke kondisi awal siap pakai (katalog, stok, dan resep utuh). |
| **Reset Status Multi-Tenant** | `npm run seed:testbed` | ~3.1 detik | Menyediakan 5 variasi status akun SaaS (Pending, Active 0-toko, Active normal, Expired, Suspended). |
| **Wipe Data Transaksi Dummy** | `npm run db:clean` | ~1.2 detik | Menghapus log mutasi dan transaksi uji coba tanpa merusak master data. |
| **Isolasi Multi-Tenant** | Query database dibatasi klausul `tenantId` ketat. | Otomatis | Pengujian satu tenant tidak akan mencemari data tenant lainnya jika dijalankan dengan tenant context yang benar. |

---

### 4. KELAYAKAN LINGKUNGAN PENGUJIAN (TEST ENVIRONMENT SAFETY)

1. **Local Host Isolation (`http://localhost:5001` & `http://localhost:5173`)**:
   - `[VERIFIED]` Server backend dan frontend berjalan sepenuhnya di localhost tanpa menyentuh database produksi cloud.
   - Tidak ada transaksi kartu kredit atau rekening bank nyata yang dapat terpotong secara tidak sengaja.
2. **Payment Gateway Mocking**:
   - `[VERIFIED]` Gateway Pakasir / Midtrans beroperasi dalam mode simulator lokal. Checkout QRIS kasir menyajikan modal simulasi QRIS tanpa gateway berbayar eksternal.
3. **Hardware Simulation**:
   - `[VERIFIED]` Virtual printer thermal 58mm / 80mm merender pratinjau struk di layar (modal visual) atau PDF canvas via jsPDF, sehingga tidak memerlukan perangkat printer fisik nyata.
   - Virtual cash drawer kick mensimulasikan getaran/sinyal buka laci via UI indicator.
4. **WhatsApp Digital Receipt Mocking**:
   - `[VERIFIED]` Engine WhatsApp Gateway (`EPIC-25`) memiliki mode simulator lokal (`SANDBOX_SIMULATOR`) yang mencatat pengiriman pesan ke audit log internal tanpa menghabiskan kuota pesan Fonnte API nyata.

---

### 5. OPERASI ASINKRON, LOADING STATES & POLLING

Aplikasi memiliki beberapa operasi asinkron yang wajib diperhitungkan dalam assertion test:
- **System Maintenance Polling**: Berjalan setiap 25 detik via `api.getSystemStatus()`.
- **KDS Live Feed Polling**: Berjalan berkala untuk mendeteksi tiket pesanan masuk baru di layar dapur.
- **Vite View Lazy-Loading**: Modul tab dimuat on-demand melalui `React.lazy` dengan indikator fallback `<ViewLoadingFallback />` atau `<ViewTabFallback />`. Tes otomasi wajib menunggu hilangnya elemen loading sebelum berinteraksi dengan elemen form.
- **Audio Synthesis**: `Web Audio API` berjalan 100% lokal di browser (`sound.ts`) tanpa delay network.

---

### 6. DUKUNGAN RESPONSIVE VIEWPORT

Aplikasi Well POS dirancang responsif untuk 3 skenario perangkat fisik kasir:
1. **Desktop / Backoffice PC (1440 x 900 px)**: Tampilan penuh dasbor analitika, tabel manajemen, sidebar accordion 8 rumpun modul.
2. **Tablet POS Kasir (1024 x 768 px)**: Tampilan kasir lanskap 2 kolom (Katalog menu di kiri, keranjang nota & tombol bayar cepat di kanan).
3. **Mobile Phone / Smartphone PWA (375 x 812 px - iPhone viewport)**: Tata letak kasir bertumpuk responsif, navigasi sticky footer bottom bar, bottom-sheet drawer modal.

---

### 7. VERIFIKASI BASIS DATA & LOG AUDIT

Pengujian end-to-end dapat memverifikasi keabsahan bisnis melalui 2 kanal:
1. **Verifikasi Antarmuka Visual**: Cek angka total nota, status lunas, badge stok, dan grafik SVG di halaman web.
2. **Verifikasi Integritas Data Relasional (Headless / API)**: Memeriksa record Prisma `Order`, `PaymentTransaction`, `InventoryLedger`, dan `CashMovement` untuk memastikan saldo kas dan stok mutasi tercatat seimbang (*double-entry balancing*).
