# language: id
Fitur: Pecah Tagihan (Split Bill), Pembayaran Campuran Multi-Tender, dan Siklus Piutang Kasbon Pelanggan
  Sebagai kasir dan pemilik toko POS
  Saya ingin membagi tagihan meja, menerima pembayaran gabungan Tunai & QRIS, serta mencatat kasbon pelanggan
  Agar operasional kasir fleksibel terhadap berbagai skenario pembayaran tamu dan buku piutang toko terkelola rapi

  Latar Belakang:
    Dengan kasir login ke terminal POS Flagship Kemang
    Dan kasir memastikan shift kasir telah dibuka dengan modal awal yang valid

  @happy_path @split_bill @multi_tender
  Skenario: Kasir memecah tagihan meja dan menerima pembayaran campuran Tunai dan QRIS (Multi-Tender)
    Ketika kasir menambahkan 2 item "Kopi Susu Aren Ura" ke dalam keranjang belanja
    Dan kasir menekan tombol "Split Bill" pada keranjang pesanan
    Maka modal Pecah Tagihan menampilkan kalkulator pembagian tagihan meja
    Dan kasir dapat melihat simulasi bagi rata 2 orang maupun pemilihan item menu
    Ketika kasir melanjutkan ke modal pembayaran dan memilih tab "Split"
    Dan kasir mengatur porsi pembayaran Tunai sebesar Rp 25.000 dan sisa QRIS sebesar Rp 25.600
    Dan kasir memasukkan uang tunai yang diterima sebesar Rp 25.000
    Dan kasir menandai verifikasi pembayaran QRIS berhasil
    Dan kasir menekan tombol "Selesaikan Pembayaran Split"
    Maka pesanan berhasil diselesaikan dengan status Lunas (PAID)
    Dan rincian pembayaran pada struk menampilkan porsi Tunai Rp 25.000 dan QRIS Rp 25.600

  @sad_path @customer_debt @piutang_pelanggan
  Skenario: Kasir mencatat kasbon pelanggan terdaftar dan melakukan pelunasan di Backoffice
    Ketika kasir menambahkan item menu ke dalam keranjang belanja
    Dan kasir membuka modal pembayaran dan memilih tab "Kasbon"
    Maka sistem menampilkan peringatan bahwa data pelanggan wajib dipilih untuk metode kasbon
    Ketika kasir memilih pelanggan member terdaftar "Budi Santoso"
    Dan kasir mengatur tanggal jatuh tempo 7 hari ke depan dengan catatan "Kasbon makan siang kantor"
    Dan kasir menekan tombol "Simpan Piutang Kasbon"
    Maka pesanan kasbon berhasil disimpan dengan status Belum Lunas (UNPAID)
    Dan bukti struk kasbon tercetak dengan keterangan jatuh tempo
    Ketika kasir atau pemilik toko membuka Backoffice menu "Pelanggan & Member"
    Dan membuka tab "Buku Piutang & Kasbon Pelanggan"
    Maka tagihan piutang pelanggan "Budi Santoso" tampil dalam daftar dengan status "Belum Lunas"
    Ketika kasir menekan tombol "Pelunasan", memasukkan nominal pelunasan penuh, dan memilih metode "Tunai"
    Dan kasir mengonfirmasi pembayaran pelunasan piutang
    Maka status tagihan piutang berhasil diperbarui menjadi "Lunas" (PAID)

  @bad_path @split_insufficient_validation
  Skenario: Sistem menolak checkout split payment jika uang tunai yang diserahkan kurang dari porsi tunai
    Ketika kasir menambahkan item menu ke keranjang dan membuka tab pembayaran "Split"
    Dan porsi tunai yang ditentukan adalah Rp 25.000
    Tetapi kasir memasukkan uang tunai yang diserahkan hanya Rp 10.000
    Maka sistem memblokir tombol "Selesaikan Pembayaran Split"
    Dan menampilkan indikator merah "Uang Tunai Kurang" dengan nilai kekurangan "- Rp 15.000"
