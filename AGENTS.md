# WELL POS — AGENT OPERATING INSTRUCTIONS & DOCUMENTATION PROTOCOL

Selamat datang di repositori **Well POS**. Dokumen ini adalah panduan perilaku wajib (*binding instructions*) untuk seluruh AI Coding Assistant (Antigravity, Gemini, Claude, Cursor, dll.) saat bekerja di workspace ini.

---

## 🚀 PROTOKOL AWAL SESI (SESSION BOOTSTRAP / GOLDEN TRIANGLE)

Setiap kali memulai percakapan sesi baru atau sebelum mengeksekusi analisis/perubahan kode berskala besar, **AI Agent WAJIB memeriksa konteks melalui Segitiga Emas Dokumen (*The Golden Triangle*)**:

1. **[`docs/00_PROJECT_CONTEXT.md`](file:///Users/dendyaditya/Projects/pos_project/docs/00_PROJECT_CONTEXT.md)**:
   * Fondasi arsitektur, Canonical Codebase Map, skema Prisma aktif, alur autentikasi/onboarding (Section 7), dan standar coding (Section 10).
2. **[`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](file:///Users/dendyaditya/Projects/pos_project/docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)**:
   * Status pengerjaan fitur (EPIC-01 s.d EPIC-21 telah selesai, mencakup QR Menu Self-Ordering, Mitra Online Delivery, serta Multi-Outlet Catalog & Mode Khusus Gudang) serta arah roadmap aktif (WhatsApp Gateway, Midtrans QRIS/VA, Thermal Printer).
3. **Dokumen Spesifik Modul Terkait**:
   * Buka [`docs/epics/EPIC-XX_*.md`](file:///Users/dendyaditya/Projects/pos_project/docs/epics) yang sesuai dengan modul yang sedang dibahas.

---

## 🎯 PROTOKOL DOKUMENTASI OTOMATIS (TRIGGER `[DOC]`)

Setiap kali User menyertakan trigger **`[DOC]`** atau **`@doc`** (tidak sensitif huruf besar/kecil) di awal, tengah, atau akhir pesan:

```text
Contoh:
"[DOC] Mulai sekarang kasir wajib memasukkan PIN supervisor jika ingin membatalkan (void) pesanan."
atau
"Tolong buatkan endpoint kirim struk via WhatsApp @doc"
```

**AI Agent WAJIB secara otomatis:**
1. Menganalisis dan mengklasifikasikan substansi perintah ke kategori dokumen yang tepat di dalam folder `docs/`.
2. Melakukan penulisan/pembaruan langsung pada file `.md` yang relevan sebelum atau sesudah mengimplementasikan kode.
3. Melaporkan dalam respon akhir berkas `.md` apa saja yang telah diperbarui beserta tautan klik langsungnya.

---

## 🗺️ MATRIKS KLASIFIKASI DOKUMENTASI (`docs/`)

AI Agent wajib memetakan perintah ber-tag `[DOC]` sesuai matriks kanonikal berikut:

| Kategori Perintah | File Sasaran | Aksi AI Agent |
| :--- | :--- | :--- |
| **1. Keputusan Arsitektur Strategis**<br>*(Pemilihan vendor, kebijakan boundary, struktur data fundamental, aturan non-fungsional)* | [`docs/decisions/ADR-XXX-*.md`](file:///Users/dendyaditya/Projects/pos_project/docs/decisions)<br>& [`docs/README.md`](file:///Users/dendyaditya/Projects/pos_project/docs/README.md) | • Buat ADR baru dengan nomor urut berikutnya (misal: `ADR-007-*.md`).<br>• Gunakan format standar (Context, Problem, Drivers, Decision, Consequences).<br>• Daftarkan ADR baru di indeks `docs/README.md`. |
| **2. Modul Fitur, Scope & Acceptance Criteria**<br>*(Penambahan fitur POS, alur F&B, aturan promo, HPP, alur kerja kasir)* | [`docs/epics/EPIC-XX_*.md`](file:///Users/dendyaditya/Projects/pos_project/docs/epics)<br>& [`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](file:///Users/dendyaditya/Projects/pos_project/docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md) | • Buka dokumen EPIC terkait (atau buat `EPIC-XX.md` baru jika fitur besar baru).<br>• Perbarui checklist spesifikasi teknis dan kriteria penerimaan.<br>• Catat ringkasan perubahannya pada tabel status di `00_EPIC_REGISTRY...`. |
| **3. Standar Koding, Skema DB & Arsitektur Utama**<br>*(Perubahan skema Prisma, middleware auth, aturan komponen UI, library)* | [`docs/00_PROJECT_CONTEXT.md`](file:///Users/dendyaditya/Projects/pos_project/docs/00_PROJECT_CONTEXT.md) | • Perbarui Section 5 (Epic Mapping), Section 6 (Canonical Map), Section 7 (Governance/Flow), atau Section 10 (Coding Standards & UI Rules).<br>• Pastikan selalu selaras dengan kode aktual di `pos_apps/server` & `pos_apps/client`. |
| **4. Panduan QA, Skenario Testing & Kredensial Demo**<br>*(Langkah pengujian manual, kredensial baru di seeder, alur verifikasi sandbox)* | [`docs/SANDBOX_PLAYBOOK.md`](file:///Users/dendyaditya/Projects/pos_project/docs/SANDBOX_PLAYBOOK.md) | • Perbarui daftar kredensial (Bagian 3) jika ada akun baru.<br>• Tambahkan atau sesuaikan skenario pengujian di Bagian 5.<br>• Perbarui panduan troubleshooting di Bagian 6 jika ada gotchas baru. |

> **Catatan Multi-Update (Hybrid)**:  
> Jika perintah yang diberikan menyentuh lebih dari satu domain (misalnya: penambahan fitur baru yang mengubah skema DB dan memerlukan skenario pengujian sandbox), **AI Agent wajib memperbarui seluruh dokumen terkait secara terpadu** (contoh: update `00_PROJECT_CONTEXT.md` + update `EPIC-XX.md` + tambah skenario di `SANDBOX_PLAYBOOK.md`).

---

## ⚡ REFLEKS ARSITEKTUR MANDIRI (AUTONOMOUS REFLEX)

Meskipun User **lupa** mengetik tag `[DOC]`, jika User memberikan instruksi yang secara fundamental **mengubah flow sistem, mengubah skema Prisma, atau memodifikasi aturan keamanan**, AI Agent:
1. Tetap disarankan memperbarui dokumen terkait secara proaktif.
2. Memberitahukan pada User:  
   *"Catatan: Perubahan alur ini telah otomatis saya dokumentasikan ke [nama_dokumen.md] agar konteks proyek tetap terjaga."*

---

## 🚫 DAFTAR PANTANGAN KERAS (THE ANTI-PATTERNS & GOTCHAS WALL)

AI Agent **DILARANG KERAS** melakukan hal-hal berikut di repositori ini:

1. ❌ **DILARANG Mengubah Styling ke TailwindCSS**:
   - Frontend Well POS murni menggunakan **Vanilla CSS** (`index.css`) dengan curated clean classes. Jangan menginstal, menyarankan, atau menginjeksi utility-classes TailwindCSS tanpa izin tertulis eksplisit.
2. ❌ **DILARANG Membuat Modal Bertumpuk (Zero Stacked Modals Policy)**:
   - Jangan pernah menampilkan pop-up modal di atas modal lain. Alur kerja multi-step atau wizard kompleks wajib menggunakan antarmuka layar penuh (seperti `FullScreenStoreWizard.tsx`) atau layout tab terpisah.
3. ❌ **DILARANG Memasukkan Hardcoded Tenant Fallback**:
   - Dilarang keras menulis string fallback seperti `'toko-maju-jaya'`. Seluruh request wajib memiliki tenant context yang valid atau ditolak dengan HTTP 401/403.
4. ❌ **DILARANG Memasang Hard Database Constraint `CHECK (quantity_on_hand >= 0)`**:
   - Sesuai **ADR-002**, stok negatif ditoleransi secara kontekstual di service layer (khususnya untuk operasional F&B dapur). Jangan memasang hard constraint SQL di level DDL PostgreSQL.
5. ❌ **DILARANG Menggunakan Input Mentah untuk Telepon & Mata Uang**:
   - Seluruh input nomor telepon wajib dinormalisasi ke `+628...` menggunakan `<WhatsAppInput />`.
   - Seluruh input nominal uang wajib menggunakan `<CurrencyInput />` (pemisah titik live `1.000`, transmisi integer/desimal bersih ke API).
6. ❌ **DILARANG Meninggalkan Build Eror**:
   - Setiap kali selesai mengedit kode, selalu verifikasi `npm run build` berhasil (Exit code 0) pada `pos_apps/server` dan `pos_apps/client`.
7. 📜 **WAJIB Menyeragamkan Paging Tabel (Kanonikal `<TablePagination />`)**:
   - Seluruh tabel data (baik di Backoffice merchant maupun Superadmin) wajib menggunakan komponen kanonikal `<TablePagination />`.
   - Default baris per halaman adalah **10**, dengan opsi pilihan **10 / 25 / 50 / 100**. Wajib menyertakan indikator rentang data aktif (`Menampilkan X - Y dari Z`) dan auto-reset ke halaman 1 saat pencarian/filter diubah.
8. 🧪 **PENGUJIAN BROWSER PLAYWRIGHT LOKAL**:
   - Playwright telah terinstal secara lokal di lingkungan pengguna. Segala pemeriksaan/automasi berbasis Playwright wajib dijalankan secara lokal (CLI/script lokal), bukan mengunduh binary eksternal secara berulang dari server cloud remote yang rentan error jaringan/404.
9. ⚠️ **ATURAN MIGRASI & EARLY WARNING INFRASTRUKTUR CLOUD (RENDER, SUPABASE, VERCEL)**:
   - **Mekanisme Otomatis `SchemaPatcher` (`src/migrations/schema_patcher.ts`)**: Setiap penambahan model, enum, atau kolom baru wajib didaftarkan ke array `SCHEMA_PATCHES`. Backend akan mengeksekusinya secara otomatis saat startup Render ke tabel `_schema_patches`.
   - **Eksekusi Mandiri AI Agent via CLI (`npm run db:remote:patch` / `npm run db:remote:sql`)**: AI Agent dan developer dapat mengeksekusi DDL langsung ke Supabase tanpa membuka browser. Kredensial remote database disimpan permanen di file lokal `pos_apps/server/.env.production` (Project Supabase: `izzcirbofftkprrtpqae`, AWS Singapore, Direct Port 5432). AI Agent DILARANG menanyakan kembali password Supabase kepada User karena konfigurasi ini telah terpasang permanen di `.env.production`.
   - **Port 6543 (PgBouncer) vs Port 5432 (Direct)**: Port 6543 adalah mode transaction pooler yang menolak DDL (`ALTER TABLE`, `CREATE TYPE`). Seluruh migrasi skema wajib diarahkan ke Port 5432.
   - **Supabase 7-Day Inactivity Warning**: Jika proyek Supabase free tier tidak menerima request selama 7 hari, database akan tidur (*paused*). Jika API throw `Connection refused`, ingatkan User untuk me-restore proyek di Dashboard Supabase (`izzcirbofftkprrtpqae`).
   - **Render 750h Limit & Cold Start**: Render Free Tier memiliki batas 750 jam/bulan per akun dan dapat mengalami cold start (~50 detik) jika pinger cron GitHub Actions tertunda. Dilarang menambah web service gratis lain di akun Render yang sama agar kuota tidak habis di pertengahan bulan.
   - **Vercel Production Deployment Rule**: Domain utama `well-pos-app.vercel.app` terikat secara ketat ke branch `main`. Push ke branch `dev` TIDAK mengupdate website produksi. Fitur baru baru aktif di produksi setelah di-merge ke `main`.
10. 📱 **WAJIB Menggunakan Pola Kanonikal Modal Form Responsif & PWA (Anti-Unscrollable & Sticky Footer)**:
    - Seluruh modal input/form wajib menggunakan bottom-sheet mobile: `items-end sm:items-center p-0 sm:p-4`, `rounded-t-3xl sm:rounded-3xl`, dan `max-h-[92dvh] sm:max-h-[90vh]`.
    - Container form wajib `flex flex-col flex-1 min-h-0 overflow-hidden` dengan scrollable body `overflow-y-auto overscroll-contain flex-1`.
    - DILARANG menaruh tombol submit/batal di dalam body scrollable. Seluruh tombol aksi wajib diletakkan di **Sticky Action Footer** terpisah di bagian bawah dengan bantalan safe-area iPhone: `p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]`.
11. 🤫 **KEBIJAKAN OPTIMASI FOTO BACKGROUND (ZERO TECHNICAL JARGON TO TENANT)**:
    - Utilitas `imageCompressor.ts` wajib berjalan 100% hening di background tanpa membebani tenant.
    - DILARANG menampilkan badge/angka statistik teknis kompresi ("Terkompresi otomatis: X KB -> Y KB (-Z%)") pada form katalog atau pengaturan QRIS. Cukup gunakan status netral "Memproses..." dan toast ramah "Foto produk berhasil diunggah".
12. 🏪 **STANDAR KANONIKAL TERMINOLOGI TOKO & OUTLET (ZERO AMBIGUITY - ANTI-ISTILAH 'GERAI' / 'CABANG')**:
    - **DILARANG KERAS** menggunakan kata **"Gerai"** atau **"Cabang"** di seluruh antarmuka pengguna (UI), notifikasi, form, seeder, maupun respons API.
    - Seluruh representasi unit fisik/operasional (model Prisma `Outlet`) **WAJIB** secara seragam menggunakan terminologi kanonikal: **"Toko"**, **"Outlet"**, atau **"Toko / Outlet"** (contoh: *"Kelola Toko"*, *"Daftar Outlet"*, *"Toko Aktif"*, *"Toko / Outlet F&B"*).

---

## 🎨 PALET WARNA & IDENTITAS VISUAL

* **Theme**: Clean White-Blue palette dengan kontras teks tajam (WCAG AA).
* **Typography**: Modern system fonts / Inter, hindari abu-abu redup (*low contrast*).
* **Card & Form**: Border halus beradius rounded-xl, hover micro-transitions, dan elevasi bayangan lembut (*soft subtle shadows*).

---

## 🧭 PROTOKOL KONSULTASI ROADMAP & PRIORITAS (ANTI-OVERENGINEERING)

Ketika User bertanya mengenai arah langkah berikutnya, merasa bimbang/buntu menentukan prioritas, atau meminta saran arsitektur (contoh: *"sebaiknya fitur A atau fitur B dulu?"*):

1. **DILARANG Langsung Menulis Kode**: AI dilarang langsung melompat membuat file atau mengedit kode tanpa menyelaraskan rencana terlebih dahulu.
2. **Wajib Analisis Ketergantungan Alur (*User Journey & Dependency Mapping*)**:
   - Jelaskan fitur mana yang menjadi prasyarat (*blocker*) bagi fitur lainnya.
   - Evaluasi dari alur nyata pengguna (*merchant real-world journey*):
     $$\text{Registrasi} \longrightarrow \text{Buka Toko} \longrightarrow \text{Navigasi Backoffice} \longrightarrow \text{Katalog Produk} \longrightarrow \text{Kasir/Stok} \longrightarrow \text{Laporan}$$
3. **Sajikan Rekomendasi Bertahap yang Terukur**:
   - Tampilkan perbandingan *trade-off* (kelebihan, risiko, dan dampak) secara ringkas dan objektif.
   - Berikan rekomendasi urutan fase (Fase 1 $\rightarrow$ Fase 2) yang paling efisien agar terhindar dari pengerjaan ulang (*zero rework*).
4. **Tunggu Keputusan User**: Berikan opsi jelas dan tunggu konfirmasi User sebelum mengeksekusi kode.

