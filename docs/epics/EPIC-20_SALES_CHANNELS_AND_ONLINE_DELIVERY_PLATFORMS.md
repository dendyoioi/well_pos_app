# EPIC-20: KANAL PENJUALAN & MITRA ONLINE DELIVERY TERPADU
## Spesifikasi Manajemen Kanal Penjualan Kustom & Pesan Antar Online (GoFood, GrabFood, ShopeeFood, Maxim)

**Status**: COMPLETED ✅  
**Terakhir Diperbarui**: 24 September 2026  
**Dokumen Terkait**: [`docs/00_PROJECT_CONTEXT.md`](../00_PROJECT_CONTEXT.md), [`00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](./00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)

---

### 1. RINGKASAN EKSEKUTIF & LATAR BELAKANG
Dalam operasional bisnis F&B dan ritel modern di Indonesia, pesanan tidak hanya datang dari pelanggan yang makan di tempat (*Dine In*), melainkan terdistribusi ke berbagai kanal seperti bawa pulang (*Take Away*), kurir internal toko (*Kurir Toko / Delivery*), dan platform agregator pesan-antar online pihak ketiga seperti **GoFood, GrabFood, ShopeeFood, dan Maxim Food**.

Sebelumnya, pencatatan transaksi di kasir POS belum memisahkan kanal-kanal penjualan ini secara elegan dan terstandarisasi. Akibatnya:
1. Kasir terpaksa mencampur catatan driver di kolom meja atau catatan umum.
2. Owner bisnis tidak memiliki visibilitas analitis mengenai kanal mana yang menyumbang omset terbesar untuk menentukan strategi promosi dan komisi mitra.
3. Istilah informal seperti "online ojol" menurunkan citra profesionalitas sistem POS kelas enterprise.

**EPIC-20** menghadirkan arsitektur kanal penjualan terintegrasi dari hulu ke hilir:
- Penamaan elegan berstandar enterprise: **Mitra Online Delivery / Layanan Pesan Antar Online**.
- Pengaturan terpusat di Backoffice Owner: `Pengaturan Resto` ➔ `Kanal Penjualan & Mitra` dengan tata kelola hak akses berbasis peran (RBAC) yang ketat.
- Antarmuka Kasir POS adaptif: Pemisahan kontekstual antara pemilih Meja Resto (Dine In) vs formulir input ID Pesanan Driver Mitra Online (misal: `#GF-402`).
- Laporan Keuangan Backoffice: Pemecahan omset penjualan per kanal (*Channel Sales Breakdown*) dan ekspor CSV untuk analisis keputusan bisnis owner.

---

### 2. ARSITEKTUR & KOMPONEN TEKNIS

#### A. Basis Data & Model Prisma (`pos_apps/server`)
1. **Konfigurasi Kanal per Toko** (`outlets.channels_config` JSONB):
   - Menyimpan daftar kanal penjualan kustom per outlet fisik.
   - Struktur objek `SalesChannelConfig`:
     ```typescript
     interface SalesChannelConfig {
       id: string;                      // Unik per outlet (e.g. 'channel_gofood')
       code: string;                    // Kode kanonikal (DINE_IN, TAKE_AWAY, GOFOOD, dll)
       name: string;                    // Label tampilan (GoFood, GrabFood, dll)
       group: 'OFFLINE_DIRECT' | 'ONLINE_DELIVERY';
       isActive: boolean;               // Toggle status operasional
       color: string;                   // Aksen warna badge visual
       badge: string;                   // Keterangan ringkas (Mitra Gojek, Makan di Meja)
       requiresTable: boolean;          // Menentukan apakah form meja tampil di kasir
       requiresOnlineOrderId: boolean;  // Menentukan apakah input ID Driver tampil di kasir
       isCustom: boolean;               // True jika kanal tambahan yang dibuat owner
     }
     ```
2. **Kanonikal Order Tracking** (`orders.channel` & `orders.table_number`):
   - Kolom `channel` di tabel `orders` mencatat string kanal (misal: `DINE_IN`, `GOFOOD`, `GRABFOOD`, `SHOPEEFOOD`, `KURIR_TOKO`).
   - Format catatan otomatis: Jika transaksi online menyertakan ID pesanan driver, catatan otomatis diawali tag `[${channel} #${onlineOrderId}]`.

#### B. API Backend & Otorisasi RBAC (`pos_apps/server`)
1. **Endpoint Konfigurasi Kanal** (`PUT /api/outlets/:id/channels`):
   - Controller: `outlet.controller.ts` ➔ `updateOutletChannels`.
   - **Role RBAC Policy**:
     - `OWNER` & `ADMIN`: Hak penuh untuk menambah kanal kustom, mengubah nama/warna, dan menghapus kanal kustom.
     - `SUPERVISOR`: Hak operasional untuk mengubah status sakelar aktif/nonaktif (`isActive`) ketika dapur sedang padat.
     - `CASHIER`: Ditolak (HTTP 403 Forbidden).
2. **Checkout Controller & Dual-Write Hardening**:
   - `order.controller.ts`: Menerima field opsional `onlineOrderId` pada `checkoutSchema` dan memformat notes transaksi.
   - `sales.dual_write.service.ts`: Memperbaiki upsert varian produk olahan F&B (composite) agar tidak terjadi konflik duplikasi primary key pada `product_variants`.
3. **Agregasi Laporan Finansial** (`report.read_adapter.ts`):
   - Fungsi `getFinancialSummary` mengeksekusi agregasi SQL `channelSales` yang menghitung total omset (`amount`) dan frekuensi transaksi (`count`) per masing-masing kanal penjualan.
   - Diintegrasikan langsung ke response `GET /api/reports/financial`.

#### C. Antarmuka Backoffice Merchant (`pos_apps/client`)
1. **Halaman Pengaturan Kanal** (`src/pages/SalesChannelsSettingsView.tsx`):
   - Ditempatkan pada navigasi `Pengaturan Resto` ➔ `Kanal Penjualan & Mitra` (`settings_channels`).
   - Kartu statistik: Total Kanal Aktif, Kanal Langsung Toko, dan Mitra Online Terintegrasi.
   - Bagian 1: **Kanal Penjualan Langsung Toko** (Dine In, Take Away, Kurir Toko) dengan sakelar aktif/nonaktif dan badge status meja.
   - Bagian 2: **Mitra Online Delivery (Pesan Antar Online)** (GoFood, GrabFood, ShopeeFood, Maxim Food, dll) dengan sakelar operasional dan tombol Tambah Mitra Baru.
   - In-page form tambah mitra baru (Zero Stacked Modals) dengan pilihan warna aksen hex dan badge identitas.
   - Desain kanonikal: Tombol aksi utama Deep Navy (`bg-blue-900 hover:bg-blue-800 text-white font-extrabold shadow-md shadow-blue-900/20 active:scale-95`).

#### D. Terminal Kasir POS (`pos_apps/client`)
1. **Pemisahan Header Kanal POS** (`src/components/pos/PosHeader.tsx`):
   - Kanal langsung toko (Dine In, Take Away, Kurir Toko) tampil sebagai tombol pil (*quick switch pills*) yang mudah ditekan kasir.
   - Mitra Online Delivery tampil sebagai menu dropdown khusus dengan ikon sepeda motor dan panah, memungkinkan kasir beralih ke GoFood, GrabFood, ShopeeFood, atau mitra kustom dengan 1 klik.
2. **Pemisahan Kontekstual Keranjang Kasir & Searchable Table Selector** (`src/components/pos/OrderCartSidebar.tsx`):
   - **Kanal Dine In / QR Menu**:
     - Dilengkapi **Pencarian Cepat Nomor Meja (Searchable Table Selector)**: Kasir dapat mengetik nomor meja (misal: `01`, `VIP`, `Teras`) dengan filter real-time, filter zona/section meja, pemilihan cepat via kartu meja interaktif, serta opsi input manual instan dengan tombol `Enter`.
     - Menampilkan kartu ringkasan meja aktif (Nomor Meja, Nama Zona, dan Kapasitas Kursi) serta tombol Ganti/Reset.
   - **Kanal Mitra Online Delivery**: Menghilangkan sepenuhnya input meja; menampilkan kartu input ID Pesanan Driver (`📋 ID Pesanan Mitra (No. Pesanan Driver e.g. #GF-402)`).
   - Nilai ID Pesanan dikirimkan ke backend melalui payload `onlineOrderId` saat checkout.
3. **Harmonisasi Biaya Kemasan On-Demand (4 Pilihan Kemasan Lengkap)**:
   - Standarisasi `normalizeOutletFees` pada `src/types/outlet.ts` agar terminal kasir POS selalu memuat **4 pilihan kemasan on-demand** lengkap:
     1. Plastik / Kresek Sedang (Rp 500)
     2. Box Kemasan / Mika (Rp 2.000)
     3. Paper Bag Kraft (Rp 3.000)
     4. Set Sendok & Garpu Higienis (Rp 1.000)
   - Sinkronisasi `PosTerminalView.tsx`, `SupervisorFeesModal.tsx`, `TaxesSettingsView.tsx`, dan basis data outlet.

#### E. Laporan Finansial & Keputusan Bisnis (`src/pages/FinancialReportView.tsx`)
1. **Kartu & Tabel Kontribusi Omset per Kanal**:
   - Menampilkan total omset (Rp) dan jumlah transaksi per kanal dalam bentuk kartu ringkasan visual.
   - Tabel komparatif dengan persentase kontribusi terhadap total omset kotor outlet.
2. **Integrasi Ekspor CSV**:
   - File CSV hasil unduhan otomatis memuat lembar rekapitulasi penjualan per kanal penjualan untuk kebutuhan audit akuntansi toko.

---

### 3. KRITERIA PENERIMAAN (ACCEPTANCE CRITERIA)
- [x] Istilah informal "online ojol" telah digantikan sepenuhnya dengan "Mitra Online Delivery" / "Layanan Pesan Antar Online".
- [x] Menu pengaturan kanal berada di Backoffice Owner under `Pengaturan Resto` ➔ `Kanal Penjualan & Mitra`.
- [x] Role `OWNER` dan `ADMIN` dapat mengelola kanal secara penuh; `SUPERVISOR` dapat toggle on/off operasional; `CASHIER` tidak memiliki akses.
- [x] Terminal kasir menampilkan pemilih meja saat Dine In, dan otomatis menggantinya dengan input ID Pesanan Driver saat memilih kanal Mitra Online.
- [x] Transaksi checkout dengan mitra online tercatat dengan kanal spesifik dan ID pesanan driver tersemat rapi di catatan transaksi.
- [x] Laporan finansial menampilkan rincian kontribusi omset per kanal dan dapat diekspor ke CSV.
- [x] Seluruh komponen frontend dan backend lolos uji build (`npm run build`) dengan exit code 0 tanpa error TypeScript.
