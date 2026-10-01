# Well POS — Technical & Architecture Documentation Index

Selamat datang di direktori dokumentasi proyek **Well POS**. Direktori ini berfungsi sebagai pusat referensi teknis, memori arsitektur, panduan pengujian, dan spesifikasi fungsional untuk seluruh pengembang, DevOps, dan AI Coding Assistant.

---

## 🗺️ Peta Direktori & Navigasi Cepat

```text
docs/
├── README.md                                  # Index navigasi & panduan penggunaan dokumentasi (file ini)
├── 00_PROJECT_CONTEXT.md                      # [LIVING] Master context, tech stack, skema DB, & coding standards
├── SANDBOX_PLAYBOOK.md                        # [LIVING] Panduan operasional & skenario QA Sandbox lokal
│
├── epics/                                     # [LIVING] Spesifikasi fitur, checklist acceptance criteria, & roadmap
│   ├── 00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md # Master registry seluruh EPIC-01 s.d EPIC-21 & changelog
│   └── EPIC-XX_*.md                           # Spesifikasi detail tiap modul (POS, F&B BOM, CRM, Billing, QR Menu, dll.)
│
├── decisions/                                 # [LIVING] Architecture Decision Records (ADR)
│   ├── ADR-001-tenant-boundary-enforcement.md# Penegakan batas tenant & Postgres RLS
│   ├── ADR-002-negative-stock-policy.md       # Kebijakan stok negatif persediaan
│   ├── ADR-003-uom-vs-packaging.md            # Satuan dasar (UOM) vs kemasan ritel
│   ├── ADR-004-inventory-batch-lot.md         # Pelacakan batch & kadaluarsa
│   ├── ADR-005-services-module-boundary.md    # Penanganan produk tipe jasa/layanan
│   ├── ADR-006-decoupled-saas-onboarding-and-store-wizard.md # Onboarding mandiri & store wizard
│   ├── ADR-007-security-hardening-tenant-isolation.md # Pengerasan keamanan isolasi tenant
│   └── ADR-008-free-tier-infrastructure-and-evolution-strategy.md # Arsitektur hybrid free-tier & upgrade strategy
│
├── architecture/                              # [REFERENCE] Spesifikasi teknis & perancangan arsitektur
│   ├── 01_EXISTING_SYSTEM_AUDIT.md            # Hasil audit sistem lama sebelum migrasi
│   ├── 02_DEEP_DOMAIN_ANALYSIS.md             # Analisis domain Retail, F&B, & Multi-Outlet
│   ├── 03_DATA_ARCHITECTURE_RFC.md            # RFC rancangan arsitektur data baru
│   ├── 04_TARGET_DATABASE_SCHEMA.md           # Definisi kanonikal 18 tabel target (Revision 4)
│   ├── 05_DUAL_WRITE_ARCHITECTURE_SPECIFICATION.md # Spesifikasi dual-write zero-downtime
│   ├── 06_READ_SURFACE_INVENTORY_AND_TARGET_ADAPTERS.md # Inventaris query & adapter baca
│   └── 07_MASTER_CUTOVER_RUNBOOK.md           # SOP langkah cutover & dekomisioning legacy
│
└── archive/                                   # [ARCHIVED / READ-ONLY] Arsip historis
    ├── initial_product_plan/                  # Blueprint & PRD konsepsi awal proyek (10 file)
    └── migration_phase/                       # Berkas eksekusi migrasi skema basis data
        ├── README.md                          # Panduan & rincian isi arsip migrasi
        ├── prompts/                           # 57 file prompt instruksi AI per-tahapan migrasi
        ├── validation/                        # 88 file bukti pengujian, schema diff, & laporan audit
        └── tools/                             # Skrip one-off ekstraksi & audit migrasi
```

---

## 📖 Panduan Penggunaan Dokumen (Dokumen Mana yang Harus Dibuka?)

| Kebutuhan Anda | Dokumen Acuan Utama | Deskripsi |
| :--- | :--- | :--- |
| **Memahami Tech Stack, Aturan Coding & Arsitektur Sistem** | [`00_PROJECT_CONTEXT.md`](./00_PROJECT_CONTEXT.md) | Buka dokumen ini untuk melihat konfigurasi Express/Prisma/Postgres/Redis/React 19, aturan komponen UI (`<CurrencyInput />`, `<WhatsAppInput />`), relasi model database, dan security RLS. |
| **Menjalankan / Menguji Sandbox Lokal** | [`SANDBOX_PLAYBOOK.md`](./SANDBOX_PLAYBOOK.md) | Berisi cara menjalankan sandbox via Docker, akun demo multi-role (Owner, Kasir, Gudang, Spv), dan skenario pengujian transaksi. |
| **Mengecek Status Fitur & Rencana Modul Baru** | [`epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](./epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md) | Buka registry ini untuk melihat fitur yang sudah selesai (EPIC-01 s.d EPIC-21) dan tahapan selanjutnya (WhatsApp Gateway, Midtrans QRIS, Thermal Printer). |
| **Mempelajari Kontrak Fitur Tertentu (cth: F&B Resep, CRM)** | `epics/EPIC-XX_*.md` | Spesifikasi fungsional detail, skema data terkait, dan acceptance criteria per modul. |
| **Mengetahui Alasan Keputusan Desain Tertentu** | `decisions/ADR-*.md` | Membaca riwayat pertimbangan arsitektur teknis (ADR). |
| **Melihat Definisi Skema Database Kanonikal** | [`architecture/04_TARGET_DATABASE_SCHEMA.md`](./architecture/04_TARGET_DATABASE_SCHEMA.md) | Definisi spesifikasi kolom, tipe data, foreign key, dan indeks dari 18 tabel target. |
| **Melacak Histori Eksekusi & Bukti Audit Migrasi Lalu** | `archive/migration_phase/` | Catatan prompt AI dan laporan pembuktian validasi keamanan data saat cutover skema lama ke baru. |

---

## ✍️ Aturan Pemeliharaan Dokumentasi

1. **Prioritas Pembaruan (Living Documents)**:
   - Jika ada perubahan pada struktur kode, skema Prisma, atau aturan antarmuka umum, **wajib perbarui [`00_PROJECT_CONTEXT.md`](./00_PROJECT_CONTEXT.md)**.
   - Jika ada fitur/epic baru yang diselesaikan atau diubah cakupannya, **wajib perbarui [`epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](./epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)**.
2. **Ketetapan Arsip (Archived Documents)**:
   - Folder `archive/` bersifat **statis dan read-only** sebagai jejak audit kepatuhan (*compliance trail*). Jangan mengubah berkas di dalam arsip kecuali untuk perbaikan link yang rusak.
3. **Architecture Decision Records (ADR)**:
   - Buat file baru di `decisions/ADR-XXX-<judul-keputusan>.md` jika ada keputusan teknis besar baru yang diambil (misalnya: pemilihan payment gateway, provider WhatsApp, atau arsitektur offline-first).
