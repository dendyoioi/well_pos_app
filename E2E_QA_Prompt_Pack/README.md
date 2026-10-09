# Antigravity E2E QA Prompt Pack

Paket ini berisi prompt bertahap untuk melakukan functional E2E testing, visual testing, responsive testing, dan regression testing pada website menggunakan Google Antigravity.

## Urutan penggunaan

1. `01_READ_ONLY_DISCOVERY_AUDIT.md` — audit awal, tanpa mengubah aplikasi.
2. `02_TEST_DESIGN_AND_BUSINESS_RULES.md` — susun test case dan expected result, belum eksekusi.
3. `03_EXECUTE_E2E_VISUAL_TESTS.md` — jalankan pengujian browser pada environment yang disetujui.
4. `04_DEFECT_TRIAGE_NO_CODE_CHANGES.md` — analisis dan prioritaskan bug, belum memperbaiki kode.
5. `05_POST_FIX_REGRESSION_RELEASE_READINESS.md` — jalankan setelah fix disetujui dan selesai.

## Approval gates

- Jangan melompati tahap. Periksa artefak dan ringkasan tahap sebelumnya sebelum melanjutkan.
- Tidak ada perubahan source code, konfigurasi aplikasi, dependency, skema database, atau data bisnis tanpa izin eksplisit.
- Prompt 3 hanya boleh menjalankan tindakan mutasi yang telah disetujui di environment pengujian yang aman.
- Pembuatan test script hanya boleh di direktori QA terisolasi dan mengikuti konvensi repository. Jangan mengubah perilaku aplikasi.
- Jika akses, kredensial, test data, atau environment tidak aman/tidak jelas, tandai test sebagai `BLOCKED`.
- Jangan menganggap semua modul POS ada. Temukan fitur nyata dari repository dan dokumentasi.
- Expected result harus berdasarkan requirement/business rule yang disetujui, bukan hanya perilaku kode saat ini.

## Status test

- `PASS`: semua assertion wajib telah dijalankan dan lulus.
- `FAIL`: satu atau lebih assertion wajib gagal.
- `BLOCKED`: prasyarat mencegah pengujian.
- `INCONCLUSIVE`: pengujian dilakukan tetapi bukti tidak cukup.
- `NOT RUN`: belum dijalankan.

## Prioritas test

- `P0`: risiko kritis untuk bisnis, integritas data, atau keamanan.
- `P1`: workflow utama atau kegagalan berdampak besar.
- `P2`: fungsi normal dan edge case bermakna.
- `P3`: kosmetik atau kasus berisiko rendah.

## Catatan tool

Antigravity dapat memiliki browser interaction, tetapi hal tersebut tidak otomatis berarti Playwright atau visual-diff engine tersedia. Prompt 1 meminta agent memverifikasi tool yang benar-benar tersedia. Jangan memasang dependency atau mengubah konfigurasi sebelum izin diberikan.

## Hasil yang diharapkan

Semua laporan harus menyebutkan bukti, keterbatasan, test yang belum dijalankan, dan risiko yang masih tersisa. Tidak boleh mengklaim aplikasi bebas bug hanya berdasarkan pass rate.
