# EPIC-28: Staff Attendance (Absensi Mandiri Kasir & Non-Kasir) & Multi-Timezone Otomatis (WIB/WITA/WIT)

**Status**: COMPLETED ✅  
**Fase**: Fase 3 (Benchmarking Fitur Unggulan Kasir Pintar)  
**Dokumen Induk**: [`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](./00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)  
**Terkait**: [`docs/00_PROJECT_CONTEXT.md`](../00_PROJECT_CONTEXT.md)  

---

## 1. Ringkasan Eksekutif & Latar Belakang

Fitur absensi staf pada aplikasi POS ritel dan F&B seringkali mengalami dua kelemahan mendasar jika dirancang sembarangan:
1. **Percampuran Tanggung Jawab Kasir vs Non-Kasir**: Memaksa staf non-kasir (barista, koki dapur, waiter, staf gudang) membuka pembukuan laci kasir (`Shift`) hanya demi mencatat kehadiran, atau sebaliknya staf non-kasir tidak bisa absen jika kasir belum buka toko.
2. **Pergeseran Jam (*Timezone Drift*) pada Server UTC**: Server cloud (Render/Supabase) yang berjalan pada UTC (GMT+0) sering menyebabkan tanggal kerja (*workDate*) bergeser 1 hari lebih awal saat diakses pukul 00:00 - 06:59 WIB (+7), serta ketidakcocokan jam kerja antara Indonesia Barat (WIB), Indonesia Tengah (WITA), dan Indonesia Timur (WIT).

EPIC-28 menuntaskan kedua masalah ini dengan pendekatan arsitektur:
- **Pemisahan Murni (Option 1 - Fully Decoupled)**: Absensi staf mandiri via verifikasi PIN 4-6 digit di terminal POS tanpa menyentuh pembukuan laci kasir (`Shift`).
- **Toleransi Kehadiran (*Grace Period*)**: Jadwal masuk/pulang fleksibel dengan batas toleransi menit (misal: 15 menit), otomatis membedakan status `ON_TIME`, `LATE` (dengan catatan menit & alasan), dan `EARLY_LEAVE`.
- **Zero-Configuration Multi-Timezone**: Deteksi otomatis 100% dari perangkat browser/PWA kasir tanpa membebani merchant untuk memilih dropdown/manual default.

---

## 2. Struktur Data & Skema Database

### 2.1 Perubahan Model Prisma (`prisma/schema.prisma`)
```prisma
enum AttendanceStatus {
  ON_TIME
  LATE
  EARLY_LEAVE
}

model Attendance {
  id              String           @id @default(uuid())
  tenantId        String           @map("tenant_id")
  outletId        String           @map("outlet_id")
  userId          String           @map("user_id")
  workDate        String           @map("work_date") // YYYY-MM-DD sesuai zona waktu outlet
  clockIn         DateTime         @default(now()) @map("clock_in")
  clockOut        DateTime?        @map("clock_out")
  durationMinutes Int?             @map("duration_minutes")
  lateMinutes     Int?             @default(0) @map("late_minutes")
  status          AttendanceStatus @default(ON_TIME)
  notes           String?
  createdAt       DateTime         @default(now()) @map("created_at")
  updatedAt       DateTime         @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  outlet Outlet @relation(fields: [outletId], references: [id], onDelete: Restrict)
  user   User   @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@index([tenantId, outletId, workDate])
  @@index([tenantId, userId, workDate])
  @@map("attendances")
}
```

Kolom tambahan pada model `Outlet`:
- `timezone`: `String? @default("Asia/Jakarta") @map("timezone")`
- `attendanceConfig`: `Json? @map("attendance_config")`

### 2.2 Migrasi Idempotent (`schema_patcher.ts`)
ID Patch: `20261006_03_staff_attendance_and_multi_timezone`
Dijalankan otomatis saat server startup dan dapat diverifikasi via CLI:
```bash
npm run db:remote:patch --prefix pos_apps/server
```

---

## 3. Alur Fungsional & Spesifikasi Teknis

### 3.1 Deteksi & Sinkronisasi Zona Waktu Otomatis (Zero Configuration)
1. Saat frontend POS diinisialisasi pada peramban/tablet (`PosTerminalView.tsx`), sistem mengevaluasi `Intl.DateTimeFormat().resolvedOptions().timeZone`.
2. Jika terdeteksi zona waktu berbeda (misal `Asia/Makassar` di Bali/Sulawesi atau `Asia/Jayapura` di Papua/Maluku), frontend memanggil endpoint `/api/attendance/sync-timezone` secara hening (*silent sync*).
3. Backend menyelaraskan `outlet.timezone` dan seluruh kalkulasi invoice, tanggal pergantian hari, dan absensi otomatis mengikuti jam dinding fisik toko.

### 3.2 Pencatatan Absensi di Terminal Kasir POS (`StaffAttendanceModal.tsx`)
- **Pemicu**: Tombol cepat `[Absensi Staf]` di header kasir (`PosHeader.tsx`), aktif baik saat shift kasir buka maupun tutup.
- **Jam Digital Live**: Menampilkan jam, menit, detik realtime dalam zona waktu outlet (WIB/WITA/WIT).
- **Pemilihan Staf**: Kartu staf terdaftar di outlet menampilkan status aktif hari ini (Belum Absen / Sedang Bekerja / Selesai Bekerja).
- **Clock In (Masuk)**:
  - Input PIN 4-6 digit staf.
  - Pengecekan real-time: jika waktu saat ini > `standardClockIn` + `lateToleranceMinutes`, status `LATE` tercatat dengan `lateMinutes` dan field alasan keterlambatan.
  - Jika tepat waktu, status `ON_TIME`.
- **Clock Out (Pulang)**:
  - Menghitung durasi kerja dalam jam & menit.
  - Deteksi `EARLY_LEAVE` jika pulang sebelum `standardClockOut`.
  - Input PIN staf & catatan penutupan shift/tugas.
- **Tab Riwayat Hari Ini**: Pratinjau seluruh staf yang telah absen di outlet hari ini.

### 3.3 Rekapitulasi Backoffice Owner (`AttendanceReportView.tsx`)
- Terletak di sub-tab menu **Pengguna & Staf** (`UsersView.tsx`).
- **5 KPI Ringkasan**: Total Kehadiran, Tepat Waktu (dengan persentase kepatuhan), Terlambat (dengan rata-rata menit keterlambatan), Pulang Lebih Awal, Total Akumulasi Jam Kerja.
- **Filter Fleksibel**: Pemilihan cabang outlet, rentang tanggal (mulai - akhir), dan pencarian instan nama/ID staf.
- **Paginasi Kanonikal**: Terintegrasi penuh dengan komponen `<TablePagination />` (10, 25, 50, 100 baris per halaman).
- **Form Konfigurasi**: Pengaturan jam masuk, jam pulang, toleransi menit, dan override zona waktu toko.
- **Ekspor CSV**: Format tabel CSV dengan header UTF-8 BOM (`\uFEFF`) agar langsung terbaca rapi di Microsoft Excel Indonesia.

---

## 4. Matriks Pengujian & Verifikasi

| Skenario Pengujian | Ekspektasi | Hasil Aktual |
| :--- | :--- | :---: |
| **Clock In Tepat Waktu** | Jam masuk <= Jadwal + Toleransi (misal 08:10 vs 08:00 + 15m) -> Status `ON_TIME`, `lateMinutes = 0`. | PASSED ✅ |
| **Clock In Terlambat** | Jam masuk > Jadwal + Toleransi (misal 08:35 vs 08:00 + 15m) -> Status `LATE`, `lateMinutes = 35`, catatan tersimpan. | PASSED ✅ |
| **Clock Out Mandiri** | Staf non-kasir clock out tanpa mempengaruhi uang fisik laci kasir -> `durationMinutes` terhitung presisi. | PASSED ✅ |
| **Validasi PIN Staf** | Salah memasukkan PIN -> HTTP 401 "PIN salah. Akses absensi ditolak." | PASSED ✅ |
| **Zero-Config Timezone** | Perangkat di WITA/WIT otomatis menyinkronkan jam lokal toko tanpa dropdown manual. | PASSED ✅ |
| **Paging & Ekspor CSV** | `<TablePagination />` bekerja konsisten, unduhan CSV rapi tanpa karakter rusak di Excel. | PASSED ✅ |
| **Build Integrity** | `npm run build` berhasil pada `pos_apps/client` dan `pos_apps/server` (Exit code 0). | PASSED ✅ |
