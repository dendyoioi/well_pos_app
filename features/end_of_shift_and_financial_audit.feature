# language: id
Fitur: Rekonsiliasi Finansial Multi-Kanal dan Audit Tutup Shift Kasir (End of Shift)
  Sebagai Pemilik Usaha dan Kasir
  Saya ingin melakukan penutupan shift kasir dengan rekonsiliasi kas fisik, pencetakan Z-Report, dan audit selisih kas
  Agar pembukuan laci kasir bebas kebocoran, akurat terhadap modal awal, dan terdokumentasi rapi di Backoffice

  Latar Belakang:
    Dengan kasir login di terminal POS dengan shift kasir terbuka
    Dan kasir telah memproses transaksi penjualan tunai di outlet aktif

  Skenario: [Happy Path] Kasir menutup shift dengan kas fisik pas dan menerbitkan Z-Report sinkron
    Ketika kasir menekan tombol "Tutup Shift" di header terminal POS
    Maka modal "Rekap Kas Fisik di Laci" terbuka dengan status perhitungan sistem
    Ketika kasir memasukkan uang fisik aktual yang cocok dengan nominal sistem (expected cash)
    Dan status selisih kas menampilkan badge hijau "Status Kas: COCOK (PAS)"
    Dan kasir menekan tombol "Kunci & Tutup Shift (Z-Report)"
    Maka sistem menerbitkan slip "Z-REPORT TUTUP SHIFT" dengan rincian rekonsiliasi kas
    Dan pemilik usaha membuka Backoffice Audit Shift untuk memverifikasi sesi shift berstatus "CLOSED" dengan selisih "Rp 0"

  Skenario: [Sad Path] Kasir menutup shift dengan selisih defisit kas fisik dan mencatat alasan selisih
    Ketika kasir menekan tombol "Tutup Shift" di header terminal POS
    Dan kasir memasukkan uang fisik aktual lebih kecil sebesar Rp 20.000 dari ekspektasi sistem
    Maka sistem menampilkan badge merah peringatan "Status Kas: KURANG (DEFISIT)" sebesar "-Rp 20.000"
    Ketika kasir mengisi catatan serah terima "Ada selisih uang kembalian pecahan receh"
    Dan kasir menekan tombol "Kunci & Tutup Shift (Z-Report)"
    Maka slip Z-Report mencatat selisih defisit "-Rp 20.000 (DEFISIT)" beserta catatan kasir
    Dan laporan Audit Shift di Backoffice menandai sesi tersebut dengan badge merah "Kurang (Short)"

  Skenario: [Bad Path] Validasi sistem menolak input uang fisik negatif dan mencegah penutupan shift ganda
    Ketika kasir menekan tombol "Tutup Shift" di header terminal POS
    Ketika kasir mencoba memasukkan nominal uang fisik negatif "-50000"
    Maka sistem menampilkan pesan peringatan validasi "Nominal uang fisik tidak boleh negatif"
    Dan proses penutupan shift diblokir hingga kasir memasukkan angka yang valid
