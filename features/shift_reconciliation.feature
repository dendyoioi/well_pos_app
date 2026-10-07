# features/shift_reconciliation.feature
# Language: id
# Spesifikasi BDD (Gherkin Syntax) untuk Siklus Hidup Shift Kasir & Rekonsiliasi Finansial

Fitur: Siklus Hidup Shift Kasir, Mutasi Kas, Kalkulator Pecahan Uang, dan Rekonsiliasi Z-Report
  Sebagai Kasir dan Pemilik Usaha (Store Owner)
  Saya ingin mengelola modal awal, mutasi kas, transaksi tunai, dan rekonsiliasi laci fisik
  Agar pembukuan harian akurat, transparan, dan tidak terjadi kebocoran saldo kasir

  Latar Belakang:
    Dengan Kasir telah login ke sistem POS dengan kredensial toko aktif
    Dan Kasir berada di layar terminal penjualan (POS Terminal)

  Skenario: [Happy Path] Buka shift baru, catat kas masuk & keluar, transaksi tunai, hitung lembar pecahan uang, dan tutup shift MATCH
    Ketika Kasir membuka shift baru dengan modal awal "Rp 200.000"
    Dan Kasir mencatat kas masuk tambahan sebesar "Rp 50.000" dengan keterangan "Tambahan uang kembalian dari bos"
    Dan Kasir mencatat kas keluar operasional sebesar "Rp 20.000" dengan keterangan "Beli es batu kristal"
    Dan Kasir melayani transaksi penjualan tunai dengan total "Rp 50.600"
    Dan Kasir membuka modal tutup shift kasir
    Dan Kasir membuka kalkulator lembar pecahan uang kertas dan koin di laci:
      | Pecahan    | Jumlah |
      | 100000     | 2      |
      | 50000      | 1      |
      | 20000      | 1      |
      | 10000      | 1      |
      | 500        | 1      |
      | 100        | 1      |
    Maka Total hitungan pecahan kas di laci otomatis terkumpul sebesar "Rp 280.600"
    Dan Indikator status kas laci menampilkan "Status Kas: COCOK (PAS)" dengan selisih "Rp 0"
    Ketika Kasir mengonfirmasi tutup shift dan membuat Z-Report
    Maka Sistem berhasil menutup shift dan menampilkan ringkasan Z-Report akhir

  Skenario: [Sad Path] Rekonsiliasi kas laci mengalami selisih kurang atau defisit (SHORTAGE)
    Ketika Kasir membuka shift baru dengan modal awal "Rp 100.000"
    Dan Kasir melayani transaksi penjualan tunai dengan total "Rp 44.000"
    Dan Kasir membuka modal tutup shift kasir
    Dan Kasir memasukkan hitungan fisik uang kas kurang sebesar "Rp 120.000"
    Maka Indikator status kas laci menampilkan "Status Kas: KURANG (DEFISIT)"
    Ketika Kasir mengisi catatan selisih "Uang kembalian receh tercecer belum ditemukan" dan mengonfirmasi tutup shift
    Maka Sistem berhasil menutup shift dengan status audit selisih kas defisit

  Skenario: [Bad Path] Validasi keamanan input nominal tidak valid dan mutasi kas tanpa keterangan
    Ketika Kasir berada pada shift kasir aktif
    Dan Kasir membuka form kas masuk dan keluar
    Dan Kasir mencoba menyimpan mutasi kas dengan nominal "0" dan keterangan kosong
    Maka Sistem menolak dan menampilkan pesan validasi "Nominal mutasi kas harus lebih besar dari 0"
    Ketika Kasir membuka modal tutup shift dan memasukkan nominal fisik negatif "-50000"
    Maka Sistem menolak tutup shift dengan pesan error "Nominal uang fisik tidak boleh negatif"
