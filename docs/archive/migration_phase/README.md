# Migration Phase Historical Archive

Folder ini berisi dokumen historis, prompt eksekusi, serta bukti validasi audit yang dihasilkan selama proses **Zero-Downtime Database Migration** (dari skema legacy ke 18 tabel target ternormalisasi).

> **Status:** **ARCHIVED & READ-ONLY (HISTORICAL AUDIT TRAIL)**  
> **Periode Aktif:** September 2026 (Phase 01 s.d Phase 17 Migrasi Skema)  
> **Status Sistem Saat Ini:** 100% CUTOVER TO TARGET SCHEMA (`TARGET_ONLY`).

---

## Isi Subfolder

### 1. `prompts/` (57 file)
Berisi seluruh berkas prompt instruksi dan perintah kerja yang diberikan kepada AI Assistant (Antigravity/LLM) pada setiap tahapan migrasi:
- **Audit & Analisis Domain**: `PROMPT_01_AUDIT.md`, `PROMPT_02_DEEP_ANALYSIS.md`, `PROMPT_03_DATA_ARCHITECTURE.md`.
- **Desain Skema & Gate Konsistensi**: `PROMPT_04` s.d `PROMPT_10`.
- **Kesiapan Migrasi & Hardening**: `PROMPT_11` s.d `PROMPT_12`.
- **Eksekusi Expand Phase & Blocker Resolution**: `PROMPT_13_1` s.d `PROMPT_13_4`.
- **Dual-Write Activation & Stabilization**: `PROMPT_14` s.d `PROMPT_15`.

### 2. `validation/` (88 file)
Berisi bukti pengujian (*audit evidence*), laporan rekonsiliasi, inventaris objek kepemilikan, dan laporan gate sebelum tiap fase migrasi diizinkan berjalan di basis data:
- Laporan Konsistensi Skema & Diff (`05_SCHEMA_CONSISTENCY_VALIDATION_REPORT.md`, `10_PROMPT_12_SCHEMA_DIFF.md`)
- Inventaris Kepemilikan Objek & Enum Rollback Contracts (`10_PROMPT_12_4_OBJECT_OWNERSHIP_INVENTORY.md`, dll.)
- Laporan Dry-Run & Backfill Execution (`18_PROMPT_13_3C_...`, `19_PROMPT_13_4_...`)
- Laporan Dual-Run Soak & Final Cutover (`20_PROMPT_14_1_...` s.d `29_PROMPT_17_1_...`)

---

*Catatan: Dokumen aktif arsitektur sistem dan roadmap fitur saat ini berada di folder utama `docs/` (`00_PROJECT_CONTEXT.md`, `SANDBOX_PLAYBOOK.md`, `architecture/`, `decisions/`, dan `epics/`).*
