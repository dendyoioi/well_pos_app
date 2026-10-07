import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Search,
  Sparkles,
  Maximize2,
  X,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  Lock,
  ArrowUp,
} from 'lucide-react';
import type { UserRole } from '../types/auth';

export interface GuideSection {
  id: string;
  title: string;
  category: 'OWNER_ADMIN' | 'CASHIER' | 'SUPERVISOR' | 'WAREHOUSE' | 'QR_MENU';
  categoryLabel: string;
  targetRoles: UserRole[];
  shortDesc: string;
  actionTab?: string;
  actionLabel?: string;
  image?: string;
  imageCaption?: string;
  steps: {
    number: number;
    title: string;
    description: string;
    highlight?: string;
  }[];
  tips?: string;
  warning?: string;
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'onboarding',
    title: '1. Registrasi Akun & Wizard Setup Toko Baru',
    category: 'OWNER_ADMIN',
    categoryLabel: 'Setup & Konfigurasi',
    targetRoles: ['OWNER', 'ADMIN'],
    shortDesc: 'Alur pendaftaran akun merchant dan panduan 5-langkah wizard untuk mendirikan toko perdana.',
    actionTab: 'outlets',
    actionLabel: 'Buka Kelola Outlet',
    image: '/guide/onboarding-profil-toko.png',
    imageCaption: 'Tampilan Langkah 1 Wizard Pembuatan Toko: Nama toko, kategori usaha, dan alamat lokasi.',
    steps: [
      {
        number: 1,
        title: 'Registrasi Akun Pemilik (Owner)',
        description:
          'Buka landing page resmi Well POS, klik "Coba Gratis" atau "Buka Toko", lalu isi nama pemilik, email bisnis, dan kata sandi.',
        highlight: 'Email terdaftar menjadi kredensial super-tenant untuk seluruh toko / outlet.',
      },
      {
        number: 2,
        title: 'Lengkapi 5 Langkah Store Wizard',
        description:
          'Setelah login pertama kali, sistem menampilkan wizard layar penuh: (1) Profil toko & alamat, (2) Pengaturan gudang pusat/toko, (3) Format struk kasir thermal, (4) Pembuatan kasir awal & PIN, serta (5) Katalog menu demo.',
        highlight: 'Zero Stacked Modals — seluruh konfigurasi dilakukan dalam antarmuka layar penuh ergonomis.',
      },
      {
        number: 3,
        title: 'Verifikasi Dashboard & Siap Jualan',
        description:
          'Selesai wizard, toko Anda langsung aktif dengan status siap operasional. Anda dapat langsung membuka Mesin Kasir (POS) atau melengkapi data produk.',
      },
    ],
    tips: 'Jika Anda memiliki lebih dari 1 unit toko fisik, tambahkan outlet baru kapan saja melalui menu Pengaturan Resto > Profil & Outlet Toko.',
  },
  {
    id: 'products',
    title: '2. Manajemen Katalog Menu, Produk, & Kategori',
    category: 'OWNER_ADMIN',
    categoryLabel: 'Produk & Menu',
    targetRoles: ['OWNER', 'ADMIN', 'SUPERVISOR'],
    shortDesc: 'Pengelolaan daftar makanan/minuman, kategori hirarkis, varian ukuran, grup modifier topping, penetapan HPP modal (COGS), dan impor massal CSV/Excel.',
    actionTab: 'products',
    actionLabel: 'Buka Kelola Produk',
    image: '/guide/katalog-kategori-menu.png',
    imageCaption: 'Tampilan Manajemen Katalog Produk: Kategori menu, varian harga jual, filter cepat, dan tombol impor massal.',
    steps: [
      {
        number: 1,
        title: 'Buat Kategori Menu Hirarkis',
        description:
          'Buka menu Produk > Kategori, lalu tambahkan pengelompokan menu (misal: Minuman Kopi, Makanan Berat, Snack, Topping). Kategori ini menjadi tombol tab navigasi cepat di layar kasir POS.',
        highlight: 'Kategori dapat diatur urutannya agar menu best-seller tampil di posisi teratas kasir.',
      },
      {
        number: 2,
        title: 'Input Master Produk & Varian Harga',
        description:
          'Klik "Tambah Produk", isi nama produk, pilih kategori, tentukan satuan (Cup, Pcs, Porsi), harga jual kasir, serta estimasi HPP (Harga Pokok Penjualan) untuk kalkulasi laba kotor otomatis.',
        highlight: 'Mendukung multi-varian seperti Regular / Large atau Panas / Dingin dengan harga berbeda.',
      },
      {
        number: 3,
        title: 'Hubungkan Modifier & Topping (BOM Pemotongan Stok)',
        description:
          'Untuk menu yang memiliki opsi tambahan (seperti Ekstra Espresso, Boba, Sambal Ekstra), kaitkan dengan grup modifier. Opsi topping dapat dikonfigurasi untuk memotong stok bahan baku mentah gudang secara live saat terjual.',
      },
      {
        number: 4,
        title: 'Impor Massal Produk via Template CSV/Excel',
        description:
          'Jika Anda memiliki ratusan menu, klik tombol "Impor Produk", unduh template CSV resmi, isi daftar nama dan harga, lalu unggah file spreadsheet. Seluruh produk akan terinput otomatis dalam hitungan detik.',
        highlight: 'Zero Stacked Modals — wizard layar penuh dengan pratinjau validasi data sebelum disimpan permanen.',
      },
      {
        number: 5,
        title: 'Fitur "Ambil dari Master Katalog" untuk Toko Baru',
        description:
          'Saat membuka toko baru, Anda tidak perlu mengetik ulang katalog produk. Cukup klik tombol "Ambil dari Master Katalog" di toko baru untuk menyalin seluruh menu pusat dengan 1-klik.',
      },
    ],
    tips: 'Selalu lengkapi estimasi HPP (modal bahan baku). Laporan Analisis Produk & Menu (EPIC-09) otomatis menampilkan persentase margin laba bersih dan mengklasifikasikan menu Pareto terlaris Anda.',
    warning: 'Jangan menghapus SKU produk yang sedang berada dalam sesi shift kasir terbuka atau transaksi pending untuk menjaga konsistensi audit penjualan.',
  },
  {
    id: 'warehouse',
    title: '3. Multi-Outlet & Mode Khusus Gudang (Logistik Pusat)',
    category: 'WAREHOUSE',
    categoryLabel: 'Gudang & Logistik',
    targetRoles: ['OWNER', 'ADMIN', 'WAREHOUSE'],
    shortDesc: 'Tata kelola pusat pasokan dan segregasi operasional antara gudang pusat logistik dengan toko fisik penjualan.',
    actionTab: 'transfers',
    actionLabel: 'Buka Mutasi & Transfer Stok',
    image: '/guide/onboarding-mode-gudang.png',
    imageCaption: 'Pengaktifan Mode Gudang: Tombol toggle khusus pusat logistik bahan baku.',
    steps: [
      {
        number: 1,
        title: 'Aktivasi Status Outlet Gudang',
        description:
          'Buka menu Kelola Toko, pilih atau tambah outlet, lalu aktifkan opsi "Jadikan Sebagai Gudang Pusat (Bahan Baku & Logistik)".',
        highlight: 'Outlet gudang otomatis memiliki tema warna Indigo pembeda visual yang tegas.',
      },
      {
        number: 2,
        title: 'Spesialisasi Menu Navigasi Gudang',
        description:
          'Saat mode gudang aktif, sistem secara otomatis menyembunyikan modul kasir (POS), meja QR, dan biaya layanan. Navigasi difokuskan pada: Stok Bahan Baku, Mutasi Toko, Pengadaan PO, dan Pemasok (Vendor).',
      },
      {
        number: 3,
        title: 'Transfer Pasokan Antar Toko & Gudang',
        description:
          'Gudang menerima permintaan barang dari toko fisik, mengirimkan pasokan (Dispatch), dan sistem mencatat mutasi stok secara otomatis pada buku besar persediaan (Ledger).',
        highlight: 'Sistem mencatat audit trail permanen: asal barang, tujuan toko, dan staf penanggung jawab.',
      },
    ],
    tips: 'Sesuai ADR-002, pencatatan mutasi stok di Well POS menjamin integritas riwayat ledger permanen (immutable audit trail).',
  },
  {
    id: 'taxes',
    title: '4. Konfigurasi Pajak PB1 & Biaya Layanan Toko',
    category: 'OWNER_ADMIN',
    categoryLabel: 'Keuangan & Regulasi',
    targetRoles: ['OWNER', 'ADMIN', 'SUPERVISOR'],
    shortDesc: 'Pemisahan transparan antara Pajak Daerah (PB1 / PBJT 10%) titipan kas daerah dengan Service Charge restoran.',
    actionTab: 'settings_taxes',
    actionLabel: 'Buka Pengaturan Pajak',
    image: '/guide/konfig-pajak-biaya-layanan.png',
    imageCaption: 'Tampilan Pengaturan Pajak PB1 & Biaya Layanan dilengkapi simulator tagihan live.',
    steps: [
      {
        number: 1,
        title: 'Pilih Toko yang Dikonfigurasi',
        description:
          'Buka Pengaturan Resto > Pajak (PB1) & Biaya Layanan. Pastikan outlet aktif yang dipilih sudah sesuai dengan lokasi toko Anda.',
      },
      {
        number: 2,
        title: 'Atur Tarif Pajak Daerah (PB1 / Restoran)',
        description:
          'Aktifkan saklar Pajak Daerah. Masukkan persentase (standar peraturan daerah adalah 10%). Pajak ini otomatis ditambahkan ke tagihan pelanggan dan terpisah dari omzet bersih toko.',
        highlight: 'Transparansi akuntansi: Dana pajak daerah dikelompokkan terpisah agar mempermudah laporan setoran kas daerah.',
      },
      {
        number: 3,
        title: 'Atur Biaya Layanan (Service Charge) & Kemasan',
        description:
          'Jika resto Anda memberlakukan biaya layanan untuk dine-in (misal 5%), aktifkan opsi Service Fee. Anda juga dapat menentukan biaya kemasan takeaway (Packaging Fee).',
      },
      {
        number: 4,
        title: 'Gunakan Live Simulator Struk',
        description:
          'Uji coba simulasi perhitungan di sisi kanan layar untuk melihat bagaimana subtotal, service charge, PB1, dan grand total dihitung sebelum diterapkan ke kasir.',
      },
    ],
    warning: 'Pengubahan nilai pajak atau biaya layanan saat kasir sedang aktif memerlukan otorisasi Mode PIN Supervisor demi keamanan audit.',
  },
  {
    id: 'receipt',
    title: '5. Format Struk Kasir Thermal (58mm / 80mm)',
    category: 'OWNER_ADMIN',
    categoryLabel: 'Setup & Konfigurasi',
    targetRoles: ['OWNER', 'ADMIN', 'SUPERVISOR'],
    shortDesc: 'Kustomisasi tata letak nota belanja, pilihan lebar kertas thermal printer, nomor antrean, dan footer promosi.',
    actionTab: 'settings_receipt',
    actionLabel: 'Buka Pengaturan Struk',
    image: '/guide/onboarding-format-struk.png',
    imageCaption: 'Form Konfigurasi Format Struk: Pilihan lebar kertas, nomor antrean, dan preview nota thermal.',
    steps: [
      {
        number: 1,
        title: 'Pilih Lebar Kertas Printer Thermal',
        description:
          'Pilih ukuran kertas sesuai printer yang digunakan di kasir Anda: 58mm untuk printer Bluetooth portabel atau 80mm untuk printer kasir desktop/dapur.',
      },
      {
        number: 2,
        title: 'Aktifkan Nomor Antrean Otomatis (Queue Calling)',
        description:
          'Centang opsi "Tampilkan Nomor Antrean Otomatis di Struk" agar kasir dan barista/dapur memiliki nomor panggilan pesanan yang seragam.',
        highlight: 'Nomor antrean memudahkan pelanggan menunggu pesanan siap saji (F&B Counter Calling).',
      },
      {
        number: 3,
        title: 'Kustomisasi Catatan Kaki (Footer Struk)',
        description:
          'Tuliskan ucapan terima kasih, akun media sosial (misal: Follow Instagram @toko.anda), nomor WhatsApp komplain, serta password Wi-Fi outlet.',
      },
    ],
    tips: 'Format struk Well POS telah dioptimasi khusus untuk cetak bersih (*crisp contrast*) tanpa memotong pinggiran kertas thermal.',
  },
  {
    id: 'channels',
    title: '6. Kanal Penjualan & Mitra Online Delivery',
    category: 'OWNER_ADMIN',
    categoryLabel: 'Setup & Konfigurasi',
    targetRoles: ['OWNER', 'ADMIN', 'SUPERVISOR'],
    shortDesc: 'Manajemen harga jual khusus aplikasi pesan antar (GoFood, GrabFood, ShopeeFood) dan dine-in.',
    actionTab: 'settings_channels',
    actionLabel: 'Buka Kanal Penjualan',
    image: '/guide/konfig-kanal-penjualan.png',
    imageCaption: 'Tampilan Kanal Penjualan: Pengaturan mark-up harga mitra online delivery dan saluran aktif.',
    steps: [
      {
        number: 1,
        title: 'Aktifkan Mitra Saluran Penjualan',
        description:
          'Buka Pengaturan Resto > Kanal Penjualan & Mitra. Nyalakan saklar untuk mitra yang Anda gunakan: GoFood, GrabFood, ShopeeFood, Dine-In, atau Takeaway.',
      },
      {
        number: 2,
        title: 'Atur Markup Harga Mitra (Profit Protection)',
        description:
          'Guna mengimbangi potongan komisi platform online (15-20%), Anda dapat memasukkan mark-up otomatis (misal +20%). Kasir tidak perlu menghitung manual saat melayani pesanan ojek online.',
        highlight: 'Margin laba kotor toko tetap aman terjaga dari potongan komisi aplikasi.',
      },
      {
        number: 3,
        title: 'Pemisahan Laporan Omzet per Kanal',
        description:
          'Di menu Laporan Finansial, Anda dapat memfilter omzet murni dine-in vs omzet mitra online delivery untuk evaluasi performa bisnis.',
      },
    ],
  },
  {
    id: 'login_pin',
    title: '7. Pairing Terminal Kasir & Layar Kunci PIN Cepat',
    category: 'CASHIER',
    categoryLabel: 'Operasional Kasir',
    targetRoles: ['CASHIER', 'SUPERVISOR', 'ADMIN'],
    shortDesc: 'Keamanan terminal: Pairing perangkat baru dengan kode verifikasi dan akses cepat kasir menggunakan 4-6 digit PIN.',
    actionTab: 'staff_users',
    actionLabel: 'Buka Kelola Staf & PIN',
    image: '/guide/login-lockscreen-pin.png',
    imageCaption: 'Layar Kunci PIN Kasir: Numpad cepat untuk login kasir tanpa memasukkan kata sandi panjang.',
    steps: [
      {
        number: 1,
        title: 'Pairing Perangkat Pertama Kali',
        description:
          'Saat membuka aplikasi di tablet/komputer kasir baru, masukkan email pemilik dan klik "Kirim Kode Verifikasi" untuk menautkan terminal secara aman.',
      },
      {
        number: 2,
        title: 'Pilih Profil Kasir & Masukkan PIN',
        description:
          'Setelah ter-pairing, terminal beralih ke Layar Kunci (Lockscreen). Kasir cukup mengetuk nama akunnya dan memasukkan 4-6 digit PIN laci kasir.',
        highlight: 'Kecepatan transaksi: Kasir dapat login dalam 3 detik tanpa mengetik keyboard rumit.',
      },
      {
        number: 3,
        title: 'Kunci Layar Terminal (Lock Terminal)',
        description:
          'Setiap kali kasir meninggalkan meja kasir (istirahat atau ke toilet), tekan ikon Gembok di pojok kanan atas untuk mengunci layar seketika.',
      },
    ],
    tips: 'Jika kasir lupa PIN, Owner atau Admin toko dapat mereset PIN staf melalui menu Manajemen Staf > Kelola Staf.',
  },
  {
    id: 'pos',
    title: '8. Operasional Mesin Kasir (POS Terminal) & Transaksi',
    category: 'CASHIER',
    categoryLabel: 'Operasional Kasir',
    targetRoles: ['CASHIER', 'SUPERVISOR'],
    shortDesc: 'Panduan lengkap melayani pelanggan, memilih menu/topping, memilih tipe pesanan, dan memproses pembayaran.',
    actionTab: 'pos',
    actionLabel: 'Buka Terminal Kasir (POS)',
    image: '/guide/pos-terminal-transaksi.png',
    imageCaption: 'Antarmuka Mesin Kasir Well POS: Grid katalog produk, keranjang pesanan, dan panel pembayaran cepat.',
    steps: [
      {
        number: 1,
        title: 'Buka Terminal Kasir',
        description:
          'Klik tombol "Buka Kasir POS" di header atas atau navigasi samping untuk masuk ke terminal transaksi berkecepatan tinggi.',
      },
      {
        number: 2,
        title: 'Pilih Menu & Tambahkan Modifier / Topping',
        description:
          'Ketuk menu yang dipesan pelanggan. Jika menu memiliki pilihan varian (panas/dingin, ukuran cup) atau topping tambahan, pilih pada kartu interaktif.',
      },
      {
        number: 3,
        title: 'Tentukan Tipe Pesanan & Nomor Meja',
        description:
          'Pilih apakah pesanan adalah Dine In (Makan di Tempat dengan input nomor meja), Takeaway (Bungkus Bawa Pulang), atau Mitra Online.',
      },
      {
        number: 4,
        title: 'Proses Pembayaran & Cetak Nota',
        description:
          'Tekan tombol Bayar. Pilih metode pembayaran: Tunai (masukkan nominal bayar, kalkulator uang kembalian otomatis tampil), QRIS, atau Kartu Debit. Klik Selesaikan & Cetak Struk.',
        highlight: 'Struk otomatis terkirim ke printer thermal atau dapat dibagikan via WhatsApp/Email.',
      },
    ],
  },
  {
    id: 'shifts',
    title: '9. Pembukaan & Rekap Tutup Shift Kasir (X & Z Report)',
    category: 'CASHIER',
    categoryLabel: 'Operasional Kasir',
    targetRoles: ['CASHIER', 'SUPERVISOR', 'OWNER'],
    shortDesc: 'SOP wajib kasir: Input modal awal uang laci kas, pencatatan kas keluar, dan audit selisih fisik saat tutup shift.',
    actionTab: 'shifts',
    actionLabel: 'Buka Rekap Shift Kasir',
    image: '/guide/dashboard-ringkasan-bisnis.png',
    imageCaption: 'Dashboard Ringkasan Operasional & Audit Penjualan Shift Kasir.',
    steps: [
      {
        number: 1,
        title: 'Awal Hari: Buka Shift Kasir (Modal Awal)',
        description:
          'Sebelum melayani pelanggan pertama, kasir wajib membuka shift dan memasukkan nominal uang modal pecahan kasir di laci (misal Rp 200.000).',
        highlight: 'Modal awal penting sebagai acuan penghitungan uang fisik akhir hari.',
      },
      {
        number: 2,
        title: 'Kalkulator Pecahan Uang Tunai (Denomination Counter)',
        description:
          'Gunakan fitur Kalkulator Pecahan pada modal Buka/Tutup Shift. Cukup masukkan jumlah lembar uang kertas (Rp 100rb, 50rb, 20rb, 10rb, 5rb, 2rb, 1rb) dan koin di laci kasir; sistem otomatis menjumlahkan nominal secara akurat tanpa perlu kalkulator terpisah.',
        highlight: 'Menghilangkan potensi salah hitung uang modal awal dan mempercepat proses audit kasir.',
      },
      {
        number: 3,
        title: 'Catat Kas Keluar / Masuk (Petty Cash)',
        description:
          'Jika selama shift ada pengeluaran kas kecil (misal beli es batu, galon air, atau uang kembalian tambahan), catat segera melalui menu "Kas Masuk / Kas Keluar".',
      },
      {
        number: 4,
        title: 'Akhir Hari: Tutup Shift & Hitung Uang Fisik',
        description:
          'Saat pergantian shift atau tutup toko, kasir menghitung seluruh uang fisik di laci menggunakan Kalkulator Pecahan tanpa melihat kalkulasi sistem (Blind Drop). Masukkan nominal fisik aktual.',
      },
      {
        number: 5,
        title: 'Audit Selisih & Cetak Z-Report',
        description:
          'Sistem otomatis membandingkan uang fisik vs kalkulasi transaksi. Jika ada selisih lebih (+Over) atau kurang (-Short), sistem menandai untuk diaudit oleh Supervisor.',
      },
    ],
    tips: 'Cetak X-Report untuk melihat rekap sementara tanpa menutup shift; cetak Z-Report untuk penutupan resmi dan final shift.',
  },
  {
    id: 'void',
    title: '10. Pembatalan Pesanan (Void) & Otorisasi PIN Supervisor',
    category: 'SUPERVISOR',
    categoryLabel: 'Audit & Pengawasan',
    targetRoles: ['SUPERVISOR', 'OWNER', 'ADMIN', 'CASHIER'],
    shortDesc: 'Aturan keamanan transaksi: Pencegahan fraud kasir dengan kewajiban input PIN otorisasi Supervisor saat pembatalan order.',
    actionTab: 'orders',
    actionLabel: 'Buka Riwayat Pesanan',
    image: '/guide/kelola-staf-hak-akses.png',
    imageCaption: 'Manajemen Staf & Hak Akses Supervisor yang berwenang memberikan PIN Void.',
    steps: [
      {
        number: 1,
        title: 'Kasir Meminta Pembatalan Pesanan',
        description:
          'Buka menu Riwayat Pesanan, cari nomor invoice pelanggan, dan klik tombol "Batalkan Pesanan (Void)".',
      },
      {
        number: 2,
        title: 'Modal Validasi PIN Supervisor Muncul',
        description:
          'Sistem menampilkan jendela otorisasi bertingkat. Kasir tidak dapat membatalkan pesanan sendiri; Supervisor atau Manager toko wajib memasukkan PIN otorisasi.',
        highlight: 'SOP Anti-Fraud: Melindungi toko dari manipulasi pembatalan fiktif setelah uang tunai diterima.',
      },
      {
        number: 3,
        title: 'Catat Alasan Pembatalan & Pengembalian Stok',
        description:
          'Pilih alasan pembatalan (misal: Pelanggan Batal, Salah Input Menu, Bahan Habis). Sistem otomatis mengembalikan saldo stok bahan baku ke gudang.',
      },
    ],
  },
  {
    id: 'transfers',
    title: '11. Mutasi Stok Bahan Baku & Kartu Ledger Persediaan',
    category: 'WAREHOUSE',
    categoryLabel: 'Gudang & Logistik',
    targetRoles: ['WAREHOUSE', 'ADMIN', 'SUPERVISOR'],
    shortDesc: 'Pencatatan mutasi bahan baku masuk, bahan baku keluar, transfer antar toko, serta audit penyesuaian stok (Stock Opname).',
    actionTab: 'stock_movements',
    actionLabel: 'Buka Mutasi Stok',
    image: '/guide/transfer-mutasi-stok.png',
    imageCaption: 'Form Mutasi & Transfer Stok: Pemindahan bahan baku dari Gudang Pusat ke Toko Tujuan.',
    steps: [
      {
        number: 1,
        title: 'Buat Dokumen Permintaan Pasokan',
        description:
          'Toko fisik yang kekurangan bahan baku (misal biji kopi atau susu kemasan) membuat form transfer stok dengan menentukan gudang sumber dan kuantitas.',
      },
      {
        number: 2,
        title: 'Verifikasi & Pengiriman dari Gudang',
        description:
          'Staf gudang memeriksa ketersediaan fisik, menyetujui dokumen, dan mengirimkan barang. Status transfer berubah menjadi "Dalam Pengiriman".',
      },
      {
        number: 3,
        title: 'Konfirmasi Penerimaan di Toko Tujuan',
        description:
          'Toko penerima menerima barang, menghitung jumlah fisik, lalu menekan tombol "Konfirmasi Penerimaan". Saldo stok kedua outlet otomatis disesuaikan di ledger.',
      },
    ],
    tips: 'Sesuai aturan Well POS, stok bahan baku dapur ditoleransi bernilai negatif secara kontekstual di service layer (ADR-002) agar pelayanan pesanan pelanggan tidak macet saat operasional puncak.',
  },
  {
    id: 'qr_menu',
    title: '12. Buku Menu QR & Pesanan Mandiri Pelanggan (Self-Ordering)',
    category: 'QR_MENU',
    categoryLabel: 'Buku Menu Digital',
    targetRoles: ['OWNER', 'ADMIN', 'SUPERVISOR', 'CASHIER'],
    shortDesc: 'Digitalisasi pesanan meja: Pelanggan memindai QR meja via kamera smartphone dan memesan langsung tanpa antre.',
    actionTab: 'qr_tables',
    actionLabel: 'Buka Kelola Meja QR',
    image: '/guide/qr-meja-buku-menu.png',
    imageCaption: 'Kelola Meja & Kode QR: Cetak stiker QR meja untuk ditempel di meja restoran.',
    steps: [
      {
        number: 1,
        title: 'Buat Nomor Meja & Unduh QR Code',
        description:
          'Buka menu Buku Menu QR > Kelola Meja. Tambahkan meja (Meja 01, Meja 02, VIP, dll). Klik "Unduh QR Code" atau cetak stiker meja.',
      },
      {
        number: 2,
        title: 'Pelanggan Memindai QR di Meja',
        description:
          'Pelanggan memindai stiker QR menggunakan kamera smartphone biasa tanpa perlu mengunduh aplikasi tambahan dari App Store / Play Store.',
        highlight: 'Web App responsif langsung terbuka dengan identitas nomor meja yang terkunci secara otomatis.',
      },
      {
        number: 3,
        title: 'Pelanggan Memilih Menu & Kirim Pesanan',
        description:
          'Pelanggan memasukkan nama, memilih menu, level gula, topping, dan menekan tombol Kirim Pesanan.',
      },
      {
        number: 4,
        title: 'Kasir Menerima Pesanan di "Pesanan QR Live"',
        description:
          'Pesanan muncul seketika di layar kasir ("Pesanan QR Live") dan layar Kitchen Display System (KDS) untuk segera diproses barista/dapur.',
      },
    ],
  },
  {
    id: 'staff_roles',
    title: '13. Manajemen Staf, Hak Akses & Multi-Outlet',
    category: 'OWNER_ADMIN',
    categoryLabel: 'Setup & Konfigurasi',
    targetRoles: ['OWNER', 'ADMIN'],
    shortDesc: 'Pengaturan hierarki pengguna, pembatasan wewenang kasir/gudang, dan isolasi data per toko / outlet.',
    actionTab: 'staff_users',
    actionLabel: 'Buka Kelola Staf',
    image: '/guide/kelola-staf-hak-akses.png',
    imageCaption: 'Daftar Staf Toko: Penugasan peran, PIN kasir, dan penguncian toko tempat bertugas.',
    steps: [
      {
        number: 1,
        title: 'Pahami Hierarki Peran Well POS',
        description:
          '• OWNER: Hak mutlak penuh atas seluruh toko / outlet, paket langganan, dan laporan keuangan.\n• ADMIN: Akses konfigurasi backoffice dan kelola master produk.\n• SUPERVISOR: Akses pos terminal, otorisasi PIN void, audit shift, dan laporan operasional.\n• CASHIER: Terkunci pada terminal mesin kasir dan shift harian outlet bertugas.\n• WAREHOUSE: Terkunci pada modul gudang logistik, kartu stok, PO, dan vendor.',
      },
      {
        number: 2,
        title: 'Tambah Staf Baru & Berikan PIN',
        description:
          'Buka Manajemen Staf > Kelola Staf > Tambah Staf. Masukkan nama lengkap, email, nomor WhatsApp (+62), peran, outlet penugasan, dan 6 digit PIN kasir.',
      },
      {
        number: 3,
        title: 'Pencabutan Akses Instan (Force Logout)',
        description:
          'Jika seorang staf berhenti bekerja, nonaktifkan akunnya. Sistem secara instan mencabut token sesi login perangkat aktif di toko demi keamanan data usaha.',
      },
    ],
  },
  {
    id: 'bluetooth_printer',
    title: '14. Printer Kasir Bluetooth Thermal (Web Bluetooth BLE)',
    category: 'OWNER_ADMIN',
    categoryLabel: 'Perangkat & Printer',
    targetRoles: ['OWNER', 'ADMIN', 'CASHIER'],
    shortDesc: 'Koneksi nirkabel printer kasir Bluetooth (58mm / 80mm ESC/POS) langsung dari browser tablet/laptop kasir tanpa kabel USB dan driver tambahan.',
    actionTab: 'settings_receipt',
    actionLabel: 'Buka Pengaturan Struk & Printer',
    image: '/guide/onboarding-format-struk.png',
    imageCaption: 'Konfigurasi Printer Thermal & Tombol Koneksi Bluetooth BLE pada Pengaturan Resto.',
    steps: [
      {
        number: 1,
        title: 'Nyalakan Printer & Aktifkan Bluetooth Perangkat',
        description:
          'Pastikan printer thermal kasir (58mm atau 80mm) dalam posisi menyala dengan kertas terpasang rapi, dan Bluetooth pada tablet / laptop kasir aktif.',
      },
      {
        number: 2,
        title: 'Sambungkan via Web Bluetooth',
        description:
          'Buka menu Pengaturan Resto > Format Struk Kasir (atau tombol sambung di jendela sukses transaksi kasir). Klik tombol "Sambungkan Printer Bluetooth". Pop-up browser Chrome/Edge akan memindai printer terdekat.',
        highlight: 'Web Bluetooth BLE murni — bekerja langsung di browser tanpa instalasi driver desktop.',
      },
      {
        number: 3,
        title: 'Pilih Nama Printer Kasir & Sandingkan',
        description:
          'Pilih nama printer Anda (misalnya: RPP02N, PT-210, MPT-II, Thermal Printer) lalu klik Sandingkan (Pair). Status indikator printer akan berubah hijau menjadi "Terhubung".',
      },
      {
        number: 4,
        title: 'Uji Cetak Struk & Buka Laci Kas',
        description:
          'Tekan tombol "Uji Cetak Struk" untuk memverifikasi keluaran nota thermal, dan tekan "Buka Laci Kas" jika printer tersambung dengan laci kasir RJ11.',
      },
      {
        number: 5,
        title: 'Cetak 1-Klik Saat Transaksi Kasir Selesai',
        description:
          'Setiap kali transaksi checkout berhasil di POS, klik tombol "Cetak Struk Bluetooth" di jendela sukses pembayaran. Nota langsung tercetak dalam hitungan detik.',
        highlight: 'Proses cetak 100% read-only dan tidak membebani mutasi database kasir.',
      },
    ],
    tips: 'Gunakan browser Google Chrome atau Microsoft Edge untuk dukungan Web Bluetooth resmi. Untuk perangkat iOS/iPad, gunakan opsi cetak standar browser (AirPrint / System Print).',
    warning: 'Pastikan printer Bluetooth tidak sedang terhubung secara eksklusif ke ponsel lain agar sinyal BLE dapat ditemukan oleh browser kasir.',
  },
  {
    id: 'whatsapp_receipt',
    title: '15. Integrasi WhatsApp Gateway & Resi Digital (Fonnte)',
    category: 'OWNER_ADMIN',
    categoryLabel: 'Setup & Konfigurasi',
    targetRoles: ['OWNER', 'ADMIN'],
    shortDesc: 'Keputusan otomatisasi pengiriman bukti transaksi / e-receipt berformat nota rapi ke nomor WhatsApp pelanggan melalui Fonnte Gateway atau tautan wa.me.',
    actionTab: 'settings_receipt',
    actionLabel: 'Buka Pengaturan Resi WhatsApp',
    image: '/guide/onboarding-format-struk.png',
    imageCaption: 'Pengaturan WhatsApp Gateway: Saklar aktivasi resi digital otomatis dan konfigurasi token Fonnte.',
    steps: [
      {
        number: 1,
        title: 'Keputusan Otomatisasi di Tangan Owner',
        description:
          'Wewenang mengaktifkan pengiriman resi otomatis sepenuhnya dipegang oleh Owner/Admin toko. Kasir di lapangan tidak perlu dibebani konfigurasi teknis.',
        highlight: 'Segregasi wewenang: Owner menetapkan token gateway, kasir hanya melayani pelanggan.',
      },
      {
        number: 2,
        title: 'Daftarkan Akun & API Key Fonnte',
        description:
          'Dapatkan API Token dari akun resmi Fonnte (fonnte.com). Anda dapat memasukkan token toko sendiri atau memanfaatkan gateway terpusat platform.',
      },
      {
        number: 3,
        title: 'Aktivasi di Pengaturan Resto',
        description:
          'Buka Pengaturan Resto > Format Struk Kasir > bagian "Integrasi WhatsApp Gateway". Nyalakan saklar "Aktifkan Pengiriman Resi WhatsApp Otomatis", masukkan token, lalu simpan.',
      },
      {
        number: 4,
        title: 'Kasir Menginput Nomor WA Pelanggan',
        description:
          'Saat kasir melayani transaksi di POS Terminal, tanyakan nomor WhatsApp pelanggan dan ketik di kolom nomor telepon (misal: 08123456789 atau +62812...).',
      },
      {
        number: 5,
        title: 'Pengiriman Resi Otomatis Non-Blocking',
        description:
          'Begitu tombol "Selesaikan & Bayar" ditekan, server di latar belakang secara asinkron mengirimkan resi resmi berformat rapi ke WhatsApp pelanggan.',
        highlight: 'Transaksi kasir selesai instan tanpa menunggu proses pengiriman WA selesai.',
      },
      {
        number: 6,
        title: 'Opsi Manual Kasir (wa.me)',
        description:
          'Jika nomor WA belum sempat diinput saat checkout atau toko belum berlangganan Fonnte, kasir tetap dapat mengirim resi manual via tombol "Kirim via WhatsApp (wa.me)" di modal pembayaran sukses.',
      },
    ],
    tips: 'Resi digital WhatsApp ramah lingkungan, menghemat pengeluaran kertas thermal gulung, dan nomor WA pelanggan otomatis tersimpan di data riwayat pesanan untuk keperluan promosi toko mendatang.',
    warning: 'Pengiriman otomatis berjalan asinkron (non-blocking). Jika kuota Fonnte habis atau koneksi pelanggan terganggu, transaksi kasir tetap sah dan tidak akan dibatalkan.',
  },
  {
    id: 'pwa_install',
    title: '16. Aplikasi Kasir Desktop & Tablet (PWA / Layar Penuh)',
    category: 'OWNER_ADMIN',
    categoryLabel: 'Perangkat & Terminal',
    targetRoles: ['OWNER', 'ADMIN', 'CASHIER'],
    shortDesc: 'Instalasi Well POS menjadi aplikasi mandiri (*standalone app*) di Tablet Android, iPad, Laptop Windows, atau Mac dengan kecepatan instan tanpa address bar browser.',
    actionTab: 'pos',
    actionLabel: 'Buka Terminal Kasir (POS)',
    image: '/guide/pos-terminal-transaksi.png',
    imageCaption: 'Antarmuka Kasir Well POS dalam mode Standalone PWA Layar Penuh.',
    steps: [
      {
        number: 1,
        title: 'Buka Well POS di Perangkat Kasir',
        description:
          'Akses website Well POS melalui browser Google Chrome, Microsoft Edge, atau Safari di tablet / komputer kasir Anda.',
      },
      {
        number: 2,
        title: 'Klik Tombol Pasang Aplikasi Kasir',
        description:
          'Pada bagian bawah layar kasir, klik banner biru "Pasang Aplikasi Well POS Kasir" (atau klik ikon instal di bilah alamat browser).',
        highlight: 'Progressive Web App resmi dengan ikon beresolusi tinggi dan manifest terstandarisasi.',
      },
      {
        number: 3,
        title: 'Konfirmasi Instalasi ke Layar Utama',
        description:
          'Konfirmasi pop-up pemasangan. Ikon resmi Well POS akan langsung disematkan pada layar utama (Home Screen Android/iPad atau Desktop Windows/Mac).',
      },
      {
        number: 4,
        title: 'Buka Layar Penuh Mandiri (Standalone Window)',
        description:
          'Jalankan aplikasi dari ikon Home Screen tersebut. Antarmuka Well POS akan tampil penuh tanpa bilah URL browser, memberikan area kerja yang luas dan ergonomis bagi kasir.',
      },
      {
        number: 5,
        title: 'Akses Super Cepat via Service Worker',
        description:
          'Aset aplikasi kasir di-cache secara aman oleh Service Worker, membuat aplikasi terbuka instan bahkan saat koneksi internet toko sedang lambat.',
      },
    ],
    tips: 'Pemasangan mode standalone PWA sangat direkomendasikan agar kasir fokus melayani pelanggan dan tidak terdistraksi membuka tab browser lain.',
  },
  {
    id: 'open_tab_rules',
    title: '17. Alur Open Tab Meja & Kebijakan Pesanan Susulan (Anti-Fraud)',
    category: 'CASHIER',
    categoryLabel: 'Operasional Kasir',
    targetRoles: ['CASHIER', 'SUPERVISOR', 'OWNER'],
    shortDesc: 'Standar operasional pesanan susulan (add-on): Perbedaan meja belum lunas (UNPAID) dan penguncian ketat transaksi lunas (PAID) demi mencegah manipulasi kas.',
    actionTab: 'orders',
    actionLabel: 'Buka Riwayat Pesanan',
    image: '/guide/pos-terminal-transaksi.png',
    imageCaption: 'Pembeda Status Pesanan: Meja Belum Lunas (Open Tab) vs Pesanan Terkunci (PAID).',
    steps: [
      {
        number: 1,
        title: 'Pesanan Meja Belum Bayar (Open Tab / UNPAID)',
        description:
          'Pelanggan makan di tempat (Dine-In) yang belum menyelesaikan pembayaran memiliki status UNPAID. Meja ini berstatus terbuka (open tab).',
      },
      {
        number: 2,
        title: 'Tambah Pesanan Susulan (+ Susulan)',
        description:
          'Jika pelanggan di meja tersebut ingin menambah menu baru (misal ekstra minuman atau camilan), kasir membuka Riwayat Pesanan atau Detail Meja lalu menekan tombol "+ Susulan".',
        highlight: 'Menu tambahan ditarik langsung ke keranjang kasir untuk ditambahkan item baru.',
      },
      {
        number: 3,
        title: 'Pembaruan Tagihan Meja Terbuka',
        description:
          'Item baru diperbarui ke pesanan meja yang sama tanpa membuat tagihan terpisah, menjaga struk meja tetap terintegrasi.',
      },
      {
        number: 4,
        title: 'Pesanan Lunas (PAID) Terkunci Total',
        description:
          'Untuk pesanan yang pembayarannya telah diselesaikan (PAID), sistem secara tegas mengunci transaksi. Tombol susulan dinonaktifkan secara permanen.',
        highlight: 'SOP Anti-Fraud: Transaksi lunas tidak dapat disusul atau diubah kembali.',
      },
      {
        number: 5,
        title: 'Pelanggan Tambah Menu Setelah Bayar = Transaksi Baru',
        description:
          'Jika pelanggan ingin memesan lagi setelah nota tercetak lunas, kasir wajib membuat transaksi penjualan baru di kasir. Hal ini menjamin uang fisik di laci kasir cocok dengan Z-Report dan menutup celah selisih kas.',
      },
    ],
    tips: 'Kebijakan ini menjamin laporan rekap omzet kasir dan mutasi HPP bahan baku selalu sinkron 100% dengan fisik laci kasir.',
    warning: 'Jangan pernah membatalkan nota yang sudah dibayar tunai hanya untuk menggabungkan pesanan susulan. Buatlah transaksi baru agar pembukuan kasir tetap tertib.',
  },
  {
    id: 'payment_methods',
    title: '18. Metode Pembayaran Kasir & Integrasi QRIS / EDC',
    category: 'OWNER_ADMIN',
    categoryLabel: 'Keuangan & Regulasi',
    targetRoles: ['OWNER', 'ADMIN', 'SUPERVISOR'],
    shortDesc: 'Aktivasi dan standarisasi opsi pembayaran kasir: Uang Tunai, QRIS Statis/Dinamis, Mesin EDC Debit/Kredit, dan Transfer Bank.',
    actionTab: 'settings_payment',
    actionLabel: 'Buka Metode Pembayaran',
    image: '/guide/pos-terminal-transaksi.png',
    imageCaption: 'Konfigurasi Metode Pembayaran Toko & Pilihan Pembayaran di Mesin Kasir.',
    steps: [
      {
        number: 1,
        title: 'Pilih Metode Pembayaran yang Diterima',
        description:
          'Buka Pengaturan Resto > Metode Pembayaran. Aktifkan saluran bayar yang tersedia di toko Anda: Tunai, QRIS, EDC Bank (Debit/Kredit), atau Transfer.',
      },
      {
        number: 2,
        title: 'Input Kode QRIS Usaha',
        description:
          'Jika toko menggunakan QRIS cetak/statis (misal QRIS BCA, Mandiri, BRI, GoPay), Anda dapat mengunggah gambar QRIS atau kode NMDID agar kasir dapat menampilkannya langsung di layar kasir.',
      },
      {
        number: 3,
        title: 'Kasir Memilih Jalur Pembayaran di Terminal',
        description:
          'Saat checkout di POS, kasir cukup mengetuk kartu pembayaran yang dipilih pelanggan. Sistem secara otomatis menghitung kembalian tunai atau mencatat nomor referensi transaksi digital.',
      },
      {
        number: 4,
        title: 'Rekap Omzet per Metode di Z-Report',
        description:
          'Di akhir hari saat tutup shift, sistem merinci total omzet non-tunai (QRIS & EDC) secara terpisah dari uang tunai fisik di laci kasir.',
        highlight: 'Rekonsiliasi laci kasir akurat: Omzet non-tunai dipisahkan dari uang tunai fisik.',
      },
    ],
    tips: 'Pemisahan omzet non-tunai dan tunai memudahkan kasir saat rekonsiliasi laci kasir (Blind Drop) dan mempermudah pencocokan mutasi rekening koran toko.',
  },
  {
    id: 'supervisor_playbook',
    title: '19. SOP Supervisor: Audit Kas Harian, Blind Drop, & Otorisasi PIN Bertingkat',
    category: 'SUPERVISOR',
    categoryLabel: 'Audit & Pengawasan',
    targetRoles: ['SUPERVISOR', 'OWNER', 'ADMIN'],
    shortDesc: 'Prosedur operasional standar (SOP) harian Supervisor toko: Pemeriksaan modal awal kasir, otorisasi PIN pembatalan/void, audit rekonsiliasi kas (Blind Drop), investigasi selisih fisik (+Over / -Short), dan pengesahan Z-Report.',
    actionTab: 'shifts',
    actionLabel: 'Buka Audit Shift & Kas',
    image: '/guide/dashboard-ringkasan-bisnis.png',
    imageCaption: 'Dashboard Monitoring & Audit Penjualan Shift Kasir: Rekonsiliasi fisik vs sistem dan riwayat audit trail.',
    steps: [
      {
        number: 1,
        title: 'Verifikasi Modal Awal Kasir (Opening Cash Audit)',
        description:
          'Di awal hari sebelum kasir mulai melayani pelanggan, Supervisor wajib menghitung uang fisik modal laci kasir (pecahan uang kembalian) dan memastikan nominal yang diinput kasir pada sistem tepat sesuai fisik (misal Rp 200.000).',
        highlight: 'Audit modal awal penting untuk menghindari defisit semu kas pada saat tutup toko.',
      },
      {
        number: 2,
        title: 'Otorisasi PIN Supervisor Bertingkat (Zero Sharing PIN)',
        description:
          'Setiap pembatalan pesanan (Void), pembatalan parsial menu (Void Item), atau perubahan sensitif mewajibkan otorisasi PIN Supervisor. Supervisor wajib hadir secara fisik di depan mesin kasir untuk memverifikasi nota transaksi dan memasukkan PIN sendiri.',
        highlight: 'SOP Anti-Fraud: Dilarang keras membagikan atau meminjamkan 6-digit PIN Supervisor kepada kasir.',
      },
      {
        number: 3,
        title: 'Pengawasan Open Tab Meja & Pesanan Susulan',
        description:
          'Supervisor memantau seluruh meja berstatus UNPAID (open tab) agar tidak ada tamu meninggalkan lokasi tanpa pelunasan. Pastikan aturan ditegakkan: Pesanan yang sudah lunas (PAID) terkunci total dan tidak boleh ditambah pesanan susulan (wajib buat nota transaksi baru).',
      },
      {
        number: 4,
        title: 'Proses Rekonsiliasi Blind Drop Tutup Shift',
        description:
          'Saat shift berakhir, kasir menghitung dan menginput seluruh uang fisik di laci kasir tanpa melihat angka kalkulasi sistem (Blind Drop). Supervisor mendampingi proses penghitungan dan memverifikasi hasil rekonsiliasi sistem:',
        highlight: 'Impas (0): Lulus sempurna. Selisih Kurang (-Short): Kasir mengisi berita acara selisih. Selisih Lebih (+Over): Diperiksa apakah ada uang tip atau kesalahan kembalian.',
      },
      {
        number: 5,
        title: 'Pemeriksaan Slip EDC Non-Tunai & Mutasi QRIS',
        description:
          'Supervisor mencocokkan total slip transaksi pada mesin EDC bank dan mutasi QRIS dengan angka laporan non-tunai di Well POS sebelum menutup kasir.',
      },
      {
        number: 6,
        title: 'Pengesahan X-Report & Penandatanganan Z-Report Final',
        description:
          'Cetak X-Report untuk audit tengah hari tanpa menutup sesi. Cetak Z-Report untuk penutupan resmi akhir hari, tanda tangani struk Z-Report bersama kasir, dan serahkan setoran kas fisik ke brankas/Owner.',
        highlight: 'Z-Report adalah dokumen audit fiskal permanen yang mengunci pembukuan hari tersebut.',
      },
    ],
    tips: 'Blind Drop Policy adalah standar baku restoran & retail modern agar kasir tidak dapat memanipulasi penghitungan fisik untuk menyamakan dengan angka sistem.',
    warning: 'Jangan pernah mengizinkan kasir menutup shift sendiri tanpa verifikasi fisik langsung dari Supervisor atau Store Manager.',
  },
  {
    id: 'barcode_shelf_labels',
    title: '20. Barcode Scanner Kamera & Cetak Label Stiker Rak',
    category: 'OWNER_ADMIN',
    categoryLabel: 'Hardware & Katalog',
    targetRoles: ['OWNER', 'ADMIN', 'SUPERVISOR', 'WAREHOUSE', 'CASHIER'],
    shortDesc: 'Pemindaian barcode instan menggunakan kamera smartphone/laptop (tanpa alat scanner fisik) dan generator cetak stiker label rak harga (shelf tag) dengan barcode Code128 standar industri.',
    actionTab: 'products',
    actionLabel: 'Buka Katalog & Label Barcode',
    image: '/guide/katalog-kategori-menu.png',
    imageCaption: 'Antarmuka Pemindai Barcode Kamera & Panel Cetak Label Stiker Rak Otomatis.',
    steps: [
      {
        number: 1,
        title: 'Aktivasi Barcode Scanner Kamera di Layar Kasir (POS)',
        description:
          'Di layar kasir POS, kasir dapat mengetuk ikon Kamera di samping kolom pencarian item. Jendela bidik kamera akan aktif seketika. Arahkan kamera ke barcode kemasan produk; sistem akan berbunyi beep konfirmasi dan item langsung otomatis ditambahkan ke keranjang belanja.',
        highlight: 'Zero-Hardware: Tidak perlu membeli alat scanner barcode USB eksternal, cukup gunakan kamera bawaan tablet/HP.',
      },
      {
        number: 2,
        title: 'Input Cepat Barcode di Form Master Produk',
        description:
          'Saat mendaftarkan produk baru di Backoffice, tekan tombol "Pindai Kamera" pada kolom Barcode/SKU. Sorot barcode fisik produk, dan angka kode (EAN-13, UPC, Code128) akan terisi otomatis tanpa risiko salah ketik.',
      },
      {
        number: 3,
        title: 'Pilih Produk untuk Cetak Stiker Rak Toko',
        description:
          'Buka menu Produk, centang produk yang ingin dicetak label raknya (atau pilih semua produk dalam satu kategori), lalu klik tombol "Cetak Label Rak" di bagian atas tabel.',
      },
      {
        number: 4,
        title: 'Konfigurasi Format Kertas (Thermal Roll vs Kertas A4)',
        description:
          'Modal pratinjau cetak menyediakan 2 opsi tata letak: (1) Format Kertas Thermal Label Gulung (58mm / 80mm) untuk printer label stiker portable, dan (2) Format Lembar Stiker A4 (kisi stiker baris x kolom) untuk printer laser/inkjet standar kantor.',
        highlight: 'Tata letak otomatis menyesuaikan ukuran kertas dan siap dicetak langsung via dialog print browser (Ctrl/Cmd + P).',
      },
      {
        number: 5,
        title: 'Kelengkapan Informasi Stiker Label Rak',
        description:
          'Setiap label rak memuat informasi krusial belanja: Nama Toko, Nama Produk, Varian, Tanggal Cetak, Harga Jual Kasir tercetak tebal kontras tinggi, serta gambar barcode Code128 presisi tinggi yang mudah dibaca ulang oleh scanner.',
      },
    ],
    tips: 'Pastikan pencahayaan ruangan memadai saat menggunakan scanner kamera HP. Untuk produk kecil tanpa kemasan pabrik, cetak stiker rak dan tempelkan di etalase toko untuk mempercepat proses scan kasir.',
    warning: 'Hindari menduplikasi nomor barcode pada produk yang berbeda agar scanner kamera tidak memasukkan menu yang keliru ke keranjang transaksi.',
  },
  {
    id: 'customer_debt_cashflow',
    title: '21. Manajemen Kasbon Piutang Pelanggan & Laporan Arus Kas Riil',
    category: 'OWNER_ADMIN',
    categoryLabel: 'Keuangan & CRM',
    targetRoles: ['OWNER', 'ADMIN', 'SUPERVISOR', 'CASHIER'],
    shortDesc: 'Pencatatan transaksi bayar nanti (kasbon/bon) pelanggan langganan di kasir, manajemen batas piutang (debt limit), rekonsiliasi pelunasan bon, dan pemisahan laporan omzet akrual vs arus kas riil (Cash Flow).',
    actionTab: 'customers',
    actionLabel: 'Buka Buku Kasbon & CRM',
    image: '/guide/pos-terminal-transaksi.png',
    imageCaption: 'Buku Piutang Kasbon Pelanggan: Saldo limit, riwayat tagihan belum lunas, dan modul pelunasan kasbon.',
    steps: [
      {
        number: 1,
        title: 'Pendaftaran Member CRM & Pengaturan Limit Kasbon',
        description:
          'Buka menu Pelanggan > Tambah Pelanggan. Masukkan nama, nomor WhatsApp aktif (+628...), dan tentukan "Batas Maksimal Kasbon" (misal Rp 500.000). Batas ini melindungi toko dari risiko piutang macet yang tak terkendali.',
        highlight: 'Limit kasbon memblokir transaksi baru secara otomatis jika piutang pelanggan sudah melampaui batas aman.',
      },
      {
        number: 2,
        title: 'Mencatat Transaksi Kasbon di Mesin Kasir (POS)',
        description:
          'Saat melayani pelanggan langganan yang ingin bayar nanti, pilih nama pelanggan tersebut di kasir, lalu pilih metode pembayaran "Kasbon / Bayar Nanti". Sistem akan memvalidasi sisa limit piutang. Jika valid, transaksi tersimpan dengan status BELUM LUNAS (UNPAID).',
      },
      {
        number: 3,
        title: 'Pemeriksaan Buku Kasbon (Accounts Receivable Ledger)',
        description:
          'Buka menu Pelanggan > Tab Buku Kasbon. Supervisor dan Owner dapat melihat daftar saldo piutang seluruh pelanggan, total bon yang belum tertagih, tanggal jatuh tempo, dan rincian transaksi nota kasbon.',
      },
      {
        number: 4,
        title: 'Penerimaan Pelunasan Kasbon (Parsial atau Lunas Penuh)',
        description:
          'Saat pelanggan datang untuk membayar hutang bon, klik tombol "Catat Pelunasan" pada baris pelanggan. Masukkan jumlah uang yang dibayarkan (bisa mencicil atau bayar lunas), pilih metode bayar (Tunai, QRIS, atau Transfer), dan simpan. Sistem mencetak tanda terima pelunasan kasbon.',
        highlight: 'Pelunasan kasbon otomatis mengurangi saldo piutang pelanggan dan menambah uang kas toko seketika.',
      },
      {
        number: 5,
        title: 'Laporan Arus Kas Riil (Real Cash Flow Engine)',
        description:
          'Di menu Laporan > Arus Kas Riil, sistem memisahkan secara matematis antara: (A) Omzet Penjualan Akrual, (B) Kas Masuk Riil dari transaksi tunai/digital hari ini, (C) Kas Masuk Riil dari pelunasan kasbon lama, serta (D) Pengeluaran Kas Toko (Petty Cash).',
        highlight: 'Laporan ini mencegah kebingungan pemilik toko di mana omzet tercatat tinggi di pembukuan tetapi uang fisik kas di rekening atau laci tidak tersedia.',
      },
    ],
    tips: 'Kirimkan rekap tagihan nota kasbon secara berkala ke WhatsApp pelanggan langsung dari menu Pelanggan untuk menjaga hubungan baik dan mempercepat perputaran arus kas toko.',
    warning: 'Dilarang memberikan fasilitas kasbon kepada pelanggan tamu umum (Walk-in Customer) tanpa data nomor HP dan identitas yang terverifikasi di sistem CRM.',
  },
  {
    id: 'staff_attendance',
    title: '22. Absensi Staf Mandiri, Toleransi Kehadiran & Multi-Timezone',
    category: 'OWNER_ADMIN',
    categoryLabel: 'SDM & Operasional',
    targetRoles: ['OWNER', 'ADMIN', 'SUPERVISOR', 'CASHIER', 'WAREHOUSE'],
    shortDesc: 'Sistem absensi mandiri karyawan (Clock In & Clock Out) via PIN kasir, pengaturan batas jam kerja & toleransi keterlambatan dinamis per outlet, deteksi otomatis zona waktu WIB/WITA/WIT, serta rekap jam kerja.',
    actionTab: 'staff_users',
    actionLabel: 'Buka Rekap Absensi Staf',
    image: '/guide/kelola-staf-hak-akses.png',
    imageCaption: 'Panel Absensi Karyawan & Rekapitulasi Jam Kerja Harian: Status hadir tepat waktu, toleransi menit, dan total jam kerja.',
    steps: [
      {
        number: 1,
        title: 'Konfigurasi Jadwal Jam Kerja & Toleransi Menit Outlet',
        description:
          'Owner atau Admin dapat menentukan jam operasional masuk toko (misal 08:00) dan "Toleransi Keterlambatan" (misal 15 menit) di pengaturan outlet. Karyawan yang absen hingga 08:15 tetap berstatus Tepat Waktu (PRESENT), sedangkan absen lewat dari 08:15 otomatis tercatat Terlambat (LATE).',
        highlight: 'Toleransi dinamis memberikan fleksibilitas operasional tanpa mengorbankan ketertiban kerja.',
      },
      {
        number: 2,
        title: 'Dukungan Otomatis Tiga Zona Waktu Indonesia (WIB, WITA, WIT)',
        description:
          'Sistem Well POS secara otomatis mendeteksi zona waktu toko (Asia/Jakarta, Asia/Makassar, Asia/Jayapura). Waktu pencatatan kehadiran dikonversi secara real-time sesuai jam lokal toko tanpa terdistorsi jam server cloud.',
      },
      {
        number: 3,
        title: 'Absen Masuk (Clock In) Mandiri oleh Staf',
        description:
          'Saat tiba di outlet, staf membuka terminal kasir atau menu Staf, menekan tombol "Catat Kehadiran", memilih nama pribadinya, dan memasukkan 6-digit PIN rahasia. Sistem langsung merekam waktu masuk dan status ketepatan jam kerja.',
      },
      {
        number: 4,
        title: 'Absen Pulang (Clock Out) Selesai Jam Kerja',
        description:
          'Saat shift berakhir, staf kembali memasukkan PIN untuk melakukan Clock Out. Sistem secara otomatis menghitung total durasi jam kerja aktif (Working Hours) dan mencatat jika staf pulang sebelum jam shift selesai (Early Departure).',
      },
      {
        number: 5,
        title: 'Rekapitulasi Kehadiran & Laporan Disiplin Staf',
        description:
          'Supervisor dan Owner dapat memantau log kehadiran harian dan bulanan pada menu Staf & Pengguna > Tab Absensi. Tersedia filter per tanggal, filter per outlet, dan ringkasan persentase kehadiran tepat waktu untuk evaluasi kinerja & insentif bulanan.',
      },
    ],
    tips: 'Integrasikan kebiasaan absensi mandiri saat staf membuka shift kasir di pagi hari agar rekonsiliasi jam kerja dan buku kas harian tercatat selaras.',
    warning: 'Setiap karyawan wajib menjaga kerahasiaan 6-digit PIN masing-masing. Praktik titip absen menggunakan PIN rekan lain adalah pelanggaran SOP yang tercatat di audit trail sistem.',
  },
  {
    id: 'granular_rbac_roles',
    title: '23. Matriks Hak Akses Granular & Keamanan Wewenang Staf (RBAC)',
    category: 'OWNER_ADMIN',
    categoryLabel: 'Keamanan & Otorisasi',
    targetRoles: ['OWNER', 'ADMIN', 'SUPERVISOR'],
    shortDesc: 'Hierarki wewenang Role-Based Access Control (RBAC) Well POS: Matriks izin menu per peran (Owner, Admin, Supervisor, Kasir, Gudang), otorisasi PIN supervisor, perlindungan data laba kotor, dan audit kepatuhan.',
    actionTab: 'staff_roles',
    actionLabel: 'Buka Konfigurasi Peran',
    image: '/guide/kelola-staf-hak-akses.png',
    imageCaption: 'Matriks Konfigurasi Hak Akses Granular: Penguncian wewenang per modul dan proteksi operasional kasir.',
    steps: [
      {
        number: 1,
        title: 'Memahami 5 Tingkatan Peran Baku (Standard RBAC)',
        description:
          'Well POS menerapkan pembagian wewenang ketat: (1) OWNER memiliki akses penuh 100% termasuk langganan & hapus outlet, (2) ADMIN mengelola operasional katalog, promo, dan staf, (3) SUPERVISOR mengawasi kasir dan otorisasi PIN void/diskon, (4) CASHIER terisolasi pada penjualan dan pembayaran, dan (5) WAREHOUSE terisolasi pada persediaan barang, PO, dan transfer.',
        highlight: 'Isolasi wewenang mencegah kebocoran informasi margin laba dan membatasi manipulasi data operasional.',
      },
      {
        number: 2,
        title: 'Pendaftaran Akun Karyawan & Penugasan Peran',
        description:
          'Buka menu Staf & Pengguna > Tambah Staf. Masukkan nama, email/username, tentukan peran yang sesuai tanggung jawab kerja, pilih outlet tugas, dan buat 6-digit PIN login untuk kasir/supervisor.',
      },
      {
        number: 3,
        title: 'Proteksi Ganda: UI Masking & Server-Side JWT Enforcement',
        description:
          'Selain menyembunyikan tombol/menu di aplikasi frontend, setiap endpoint API di server backend (pos_apps/server) mewajibkan verifikasi token JWT dan peran yang berwenang. Permintaan tanpa wewenang akan ditolak secara mutlak dengan kode HTTP 403 Forbidden.',
      },
      {
        number: 4,
        title: 'Prinsip Hak Akses Terkecil (Least Privilege Policy)',
        description:
          'Staf kasir tidak dapat melihat menu Pengaturan Pajak PB1, Rekening Bank Merchant, maupun Laporan Laba Rugi Toko. Staf gudang tidak dapat membuka mesin kasir POS. Hal ini memastikan setiap orang fokus pada tugasnya tanpa celah kecurangan (fraud).',
      },
      {
        number: 5,
        title: 'Pencabutan Akses Instan (Immediate Account Revocation)',
        description:
          'Jika seorang staf berhenti bekerja atau dimutasi, Owner atau Admin dapat menonaktifkan akun karyawan seketika dalam 1-klik di menu Staf. Seluruh sesi login dan otorisasi PIN karyawan tersebut langsung ditolak oleh sistem tanpa perlu merestart server.',
        highlight: 'Keamanan terjamin: Akun non-aktif langsung diblokir di seluruh terminal toko secara instan.',
      },
    ],
    tips: 'Jangan pernah membagikan akun Owner kepada kasir atau pihak ketiga. Buatlah akun dengan peran Supervisor jika Anda menunjuk penanggung jawab harian di outlet.',
    warning: 'PIN Supervisor tidak boleh diinformasikan kepada Kasir. Jika terjadi pembatalan nota (void), Supervisor wajib datang langsung dan memasukkan PIN sendiri di depan mesin kasir.',
  },
  {
    id: 'offline_first_queue',
    title: '24. Operasional Kasir Offline-First & Antrean Sinkronisasi Otomatis',
    category: 'CASHIER',
    categoryLabel: 'Operasional Kasir',
    targetRoles: ['CASHIER', 'SUPERVISOR', 'OWNER', 'ADMIN'],
    shortDesc: 'Panduan keandalan terminal kasir saat jaringan internet mati: Checkout offline tetap berjalan lancar, penyimpanan antrean IndexedDB lokal, deteksi banner koneksi, dan sinkronisasi otomatis idempoten saat online kembali.',
    actionTab: 'pos',
    actionLabel: 'Buka Terminal Kasir (POS)',
    image: '/guide/pos-terminal-transaksi.png',
    imageCaption: 'Terminal Kasir dalam Mode Offline: Indikator status jaringan dan antrean sinkronisasi transaksi otomatis.',
    steps: [
      {
        number: 1,
        title: 'Deteksi Otomatis Koneksi Internet Terputus',
        description:
          'Saat jaringan Wi-Fi atau paket data toko terputus, terminal kasir mendeteksi status offline secara real-time. Banner status "Mode Offline Aktif" otomatis muncul di layar kasir.',
        highlight: 'Kasir tidak perlu panik; transaksi pembayaran tunai tetap dapat dilayani tanpa kendala.',
      },
      {
        number: 2,
        title: 'Checkout Transaksi Tanpa Internet (Offline Queue)',
        description:
          'Kasir tetap memilih produk, menerima uang tunai, dan menekan tombol Bayar. Sistem mengamankan transaksi ke dalam antrean lokal (Local Storage / IndexedDB) perangkat kasir dengan nomor referensi acak offlineReferenceId.',
        highlight: 'Struk kasir tetap dapat dicetak langsung ke printer thermal Bluetooth lokal.',
      },
      {
        number: 3,
        title: 'Pemantauan Antrean Pesanan Tertunda',
        description:
          'Kasir dapat memantau badge jumlah transaksi offline di pojok layar kasir. Mengklik badge tersebut akan membuka modal daftar transaksi tertunda lengkap dengan nomor invoice sementara dan nominalnya.',
      },
      {
        number: 4,
        title: 'Sinkronisasi Otomatis Saat Jaringan Pulih',
        description:
          'Begitu sinyal internet kembali online, sistem kasir otomatis mengirimkan seluruh antrean pesanan ke server backend di latar belakang secara tenang dan berurutan.',
      },
      {
        number: 5,
        title: 'Jaminan Idempotensi Anti-Duplikasi Transaksi',
        description:
          'Server Well POS dilengkapi pengaman idempotensi: jika koneksi sempat terputus di tengah proses sinkronisasi, transaksi dengan offlineReferenceId yang sama tidak akan pernah terduplikasi atau memotong stok ganda.',
        highlight: 'Buku kas dan kartu stok bahan baku tetap 100% akurat tanpa selisih.',
      },
    ],
    tips: 'Untuk transaksi offline, prioritaskan metode pembayaran Tunai (Cash). Metode QRIS dinamis memerlukan koneksi internet aktif untuk verifikasi pelunasan seketika.',
    warning: 'Dilarang keras membersihkan cache/data browser perangkat kasir sebelum seluruh transaksi offline berhasil disinkronkan ke server cloud.',
  },
];

// Helper untuk memeriksa apakah tab aksi diizinkan untuk peran yang sedang aktif
const isTabAllowedForRole = (tab?: string, role?: string): boolean => {
  if (!tab) return false;
  const userRole = (role || 'OWNER').toUpperCase();
  if (userRole === 'OWNER' || userRole === 'ADMIN') return true;
  if (userRole === 'SUPERVISOR') {
    const supervisorTabs = [
      'overview', 'pos', 'orders', 'customers', 'shifts', 'products', 'categories',
      'modifiers', 'recipes', 'qr_tables', 'qr_settings', 'qr_orders', 'qr_guest_menu',
      'inventory', 'stock_movements', 'purchase_orders', 'transfers', 'suppliers',
      'reports', 'product_analytics', 'promotions', 'staff_users', 'settings_payment',
      'settings_channels', 'settings_loyalty', 'outlets', 'guide',
    ];
    return supervisorTabs.includes(tab);
  }
  if (userRole === 'CASHIER') {
    const cashierTabs = ['pos', 'orders', 'customers', 'shifts', 'qr_orders', 'guide'];
    return cashierTabs.includes(tab);
  }
  if (userRole === 'WAREHOUSE') {
    const warehouseTabs = [
      'inventory', 'stock_movements', 'purchase_orders', 'transfers',
      'suppliers', 'recipes', 'products', 'overview', 'guide',
    ];
    return warehouseTabs.includes(tab);
  }
  return false;
};

interface UserGuideViewProps {
  initialSection?: string;
  onNavigateTab: (tab: any) => void;
  currentUserRole?: string;
}

export const UserGuideView: React.FC<UserGuideViewProps> = ({
  initialSection,
  onNavigateTab,
  currentUserRole = 'OWNER',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeSectionId, setActiveSectionId] = useState<string>(initialSection || 'onboarding');
  const [lightboxImage, setLightboxImage] = useState<{ src: string; caption: string } | null>(null);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Filter sections berdasarkan query pencarian dan kategori
  const filteredSections = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return GUIDE_SECTIONS.filter((sec) => {
      const matchCategory =
        selectedCategory === 'ALL' ||
        sec.category === selectedCategory ||
        (selectedCategory === 'SUPERVISOR' &&
          (sec.category === 'SUPERVISOR' || sec.targetRoles.includes('SUPERVISOR')));
      if (!matchCategory) return false;
      if (!q) return true;

      const inTitle = sec.title.toLowerCase().includes(q);
      const inDesc = sec.shortDesc.toLowerCase().includes(q);
      const inCategory = sec.categoryLabel.toLowerCase().includes(q);
      const inTips = (sec.tips || '').toLowerCase().includes(q);
      const inWarning = (sec.warning || '').toLowerCase().includes(q);
      const inSteps = sec.steps.some(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          (s.highlight || '').toLowerCase().includes(q)
      );

      return inTitle || inDesc || inCategory || inTips || inWarning || inSteps;
    });
  }, [searchQuery, selectedCategory]);

  // Auto-scroll ke section terpilih saat initialSection berubah
  useEffect(() => {
    if (initialSection) {
      setActiveSectionId(initialSection);
      const targetSec = GUIDE_SECTIONS.find((s) => s.id === initialSection);
      const isCurrentlyVisible = filteredSections.some((s) => s.id === initialSection);

      if (!isCurrentlyVisible && targetSec) {
        setSelectedCategory('ALL');
        if (searchQuery) {
          setSearchQuery('');
        }
      }

      setTimeout(() => {
        const el = sectionRefs.current[initialSection];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, isCurrentlyVisible ? 100 : 250);
    }
  }, [initialSection]);

  // Kunci scroll halaman latar belakang & bind tombol Escape saat lightbox terbuka
  useEffect(() => {
    if (lightboxImage) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setLightboxImage(null);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [lightboxImage]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const scrollContainers = document.querySelectorAll('.overflow-y-auto');
    scrollContainers.forEach((el) => {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const scrollToSection = (id: string) => {
    setActiveSectionId(id);
    const targetSec = GUIDE_SECTIONS.find((s) => s.id === id);
    const isCurrentlyVisible = filteredSections.some((s) => s.id === id);

    // Jika section yang dituju sedang tersembunyi karena filter kategori/pencarian,
    // otomatis reset filter agar section tersebut ter-render di DOM!
    if (!isCurrentlyVisible && targetSec) {
      setSelectedCategory('ALL');
      if (searchQuery) {
        setSearchQuery('');
      }
    }

    setTimeout(() => {
      const el = sectionRefs.current[id];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, isCurrentlyVisible ? 10 : 120);
  };

  // Pantau bab yang sedang aktif di viewport menggunakan IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSectionId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-20% 0px -65% 0px',
        threshold: 0,
      }
    );

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [filteredSections]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ─── 1. HERO HEADER BANNER ─── */}
      <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-blue-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-blue-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-bold">
              <BookOpen className="w-3.5 h-3.5 text-blue-300" />
              <span>Dokumentasi Resmi &amp; SOP Operasional Well POS</span>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
              Peran Anda: {currentUserRole}
            </span>
          </div>

          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white">
            Pusat Panduan &amp; Tutorial Penggunaan
          </h1>

          <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed">
            Panduan visual lengkap langkah demi langkah untuk setiap peran kerja (Owner, Kasir, Supervisor, &amp; Gudang). Dilengkapi tangkapan layar antarmuka nyata dan tombol pintas aksi langsung ke menu konfigurasi.
          </p>

          {/* Search Box Input */}
          <div className="pt-2">
            <div className="relative max-w-xl">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari panduan (misal: 'PB1', 'tutup shift', 'void', 'gudang', 'struk', 'qr meja')..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 focus:bg-white text-white focus:text-slate-900 placeholder:text-blue-200/60 focus:placeholder:text-slate-400 text-xs sm:text-sm font-semibold border border-white/20 focus:border-blue-500 transition-all outline-hidden shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. STICKY CATEGORY FILTER TABS & QUICK SHORTCUT DOCK ─── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md p-3 sm:p-3.5 rounded-2xl border border-slate-200/90 shadow-md shadow-slate-900/5 space-y-2 transition-all -mx-1 sm:mx-0">
        {/* Baris 1: Filter Kategori & Tombol Aksi Cepat */}
        <div className="flex items-center justify-between gap-2">
          {/* Kategori Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-blue-950 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Semua ({GUIDE_SECTIONS.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('OWNER_ADMIN')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                selectedCategory === 'OWNER_ADMIN'
                  ? 'bg-blue-950 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>👑 Owner &amp; Admin</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('CASHIER')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                selectedCategory === 'CASHIER'
                  ? 'bg-blue-950 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>💳 Kasir &amp; POS</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('SUPERVISOR')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                selectedCategory === 'SUPERVISOR'
                  ? 'bg-blue-950 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>🛡️ Supervisor &amp; Audit</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('WAREHOUSE')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                selectedCategory === 'WAREHOUSE'
                  ? 'bg-blue-950 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>📦 Gudang &amp; Logistik</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('QR_MENU')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                selectedCategory === 'QR_MENU'
                  ? 'bg-blue-950 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>📱 Menu QR Meja</span>
            </button>
          </div>

          {/* Sisi Kanan: Tombol Cepat Ke Atas */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-slate-400 hidden xl:inline">
              {filteredSections.length} bab aktif
            </span>
            <button
              type="button"
              onClick={scrollToTop}
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-950 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              title="Kembali ke Bagian Paling Atas (Pencarian)"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ke Atas</span>
            </button>
          </div>
        </div>

        {/* Baris 2: Sub-bar Lompat Cepat Horizontal Scrollable */}
        <div className="pt-2 border-t border-slate-100/80 flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-thin">
          <span className="font-black text-slate-400 shrink-0 uppercase tracking-wider text-[10px] pr-1">
            Lompat Cepat ({filteredSections.length}):
          </span>
          {filteredSections.map((sec) => {
            const isActive = activeSectionId === sec.id;
            const chapNum = sec.title.split('.')[0];
            const chapTitle = sec.title.split('. ')[1] || sec.title;
            return (
              <button
                key={sec.id}
                onClick={() => scrollToSection(sec.id)}
                className={`px-2 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                  isActive
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title={sec.title}
              >
                <span className={`text-[10px] px-1 rounded ${isActive ? 'bg-blue-800 text-amber-300 font-black' : 'bg-slate-200 text-slate-600'}`}>
                  #{chapNum}
                </span>
                <span className="max-w-[140px] sm:max-w-[180px] truncate">
                  {chapTitle}
                </span>
              </button>
            );
          })}
          {selectedCategory !== 'ALL' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className="px-2.5 py-1 rounded-lg font-bold shrink-0 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 transition-colors cursor-pointer ml-1"
            >
              Tampilkan Semua ({GUIDE_SECTIONS.length} Bab)
            </button>
          )}
        </div>
      </div>

      {/* ─── 3. SECTIONS LIST ─── */}
      <div className="space-y-8">
        {filteredSections.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-base">Panduan Tidak Ditemukan</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Tidak ada modul panduan yang cocok dengan kata kunci &quot;{searchQuery}&quot;. Coba ganti kata pencarian atau pilih kategori Semua Modul.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
              }}
              className="px-4 py-2 bg-blue-900 text-white rounded-xl text-xs font-bold hover:bg-blue-800 transition-colors"
            >
              Reset Filter Pencarian
            </button>
          </div>
        ) : (
          filteredSections.map((sec) => (
            <article
              key={sec.id}
              id={sec.id}
              ref={(el) => {
                sectionRefs.current[sec.id] = el;
              }}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300 scroll-mt-24 sm:scroll-mt-28"
            >
              {/* Section Header */}
              <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-900 text-white">
                      {sec.categoryLabel}
                    </span>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      Peran: {sec.targetRoles.join(', ')}
                    </span>
                  </div>

                  <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                    {sec.title}
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
                    {sec.shortDesc}
                  </p>
                </div>

                {/* Direct Shortcut to Action Tab (Dilindungi Hak Akses RBAC agar tidak kehilangan konteks) */}
                {sec.actionTab && (() => {
                  const isAllowed = isTabAllowedForRole(sec.actionTab, currentUserRole);
                  if (isAllowed) {
                    return (
                      <div className="shrink-0">
                        <button
                          type="button"
                          onClick={() => onNavigateTab(sec.actionTab)}
                          className="w-full sm:w-auto px-4 py-2.5 bg-blue-900 hover:bg-blue-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                          title={`Buka menu ${sec.actionLabel}`}
                        >
                          <span>{sec.actionLabel || 'Buka Menu Konfigurasi'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div className="shrink-0">
                      <div
                        className="w-full sm:w-auto px-3.5 py-2 bg-slate-100 border border-slate-200 text-slate-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed select-none"
                        title={`Menu ${sec.actionLabel || sec.actionTab} membutuhkan wewenang peran ${sec.targetRoles.join('/')}`}
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Khusus {sec.targetRoles.filter((r) => r !== 'CASHIER' && r !== 'WAREHOUSE').join('/') || 'Owner'}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Section Body: Two Column (Steps + Screenshot Frame) */}
              <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Numbered SOP Steps */}
                <div className="lg:col-span-7 space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-900" />
                    <span>Langkah Demi Langkah (SOP):</span>
                  </h3>

                  <div className="space-y-3">
                    {sec.steps.map((st) => (
                      <div
                        key={st.number}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg bg-blue-900 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-xs">
                            {st.number}
                          </div>
                          <h4 className="text-xs sm:text-sm font-extrabold text-blue-950">
                            {st.title}
                          </h4>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed pl-8">
                          {st.description}
                        </p>

                        {st.highlight && (
                          <div className="ml-8 mt-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200/60 text-[11px] text-blue-900 font-bold flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-blue-700 shrink-0" />
                            <span>{st.highlight}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Tips Callout */}
                  {sec.tips && (
                    <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
                      <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <strong className="font-extrabold">Tips Best Practice: </strong>
                        <span>{sec.tips}</span>
                      </div>
                    </div>
                  )}

                  {/* Warning Callout */}
                  {sec.warning && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <strong className="font-extrabold">Peringatan Penting: </strong>
                        <span>{sec.warning}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Screenshot Visual Frame with Lightbox Zoom */}
                <div className="lg:col-span-5 space-y-2">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-blue-900" />
                    <span>Tampilan Antarmuka Nyata:</span>
                  </h3>

                  {sec.image ? (
                    <div className="group relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm cursor-pointer hover:shadow-md transition-all">
                      <img
                        src={sec.image}
                        alt={sec.title}
                        className="w-full h-auto object-cover max-h-[340px] transition-transform duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                        onClick={() =>
                          setLightboxImage({
                            src: sec.image!,
                            caption: sec.imageCaption || sec.title,
                          })
                        }
                      />
                      <div
                        onClick={() =>
                          setLightboxImage({
                            src: sec.image!,
                            caption: sec.imageCaption || sec.title,
                          })
                        }
                        className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-bold text-xs"
                      >
                        <Maximize2 className="w-4 h-4" />
                        <span>Klik untuk Perbesar Tampilan</span>
                      </div>

                      {sec.imageCaption && (
                        <div className="p-2.5 bg-slate-900/90 text-white text-[11px] leading-tight">
                          {sec.imageCaption}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-400">
                      Tangkapan layar modul ini telah terintegrasi dalam alur wizard.
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* ─── 4. LIGHTBOX MODAL FOR FULL SCREEN IMAGE PREVIEW (PORTAL TO BODY) ─── */}
      {lightboxImage &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 md:p-8 animate-fade-in"
            onClick={() => setLightboxImage(null)}
          >
            <div
              className="relative bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-up"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Modal */}
              <div className="px-5 py-3.5 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5 min-w-0 pr-3">
                  <div className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                    {lightboxImage.caption}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Tutup Pratinjau (ESC)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Image Viewport (Proporsional & Auto-fit Vertikal & Horizontal) */}
              <div className="flex-1 min-h-0 bg-slate-950 flex items-center justify-center p-3 sm:p-5 overflow-hidden">
                <img
                  src={lightboxImage.src}
                  alt={lightboxImage.caption}
                  className="max-h-[calc(92vh-125px)] w-auto max-w-full object-contain rounded-xl shadow-2xl transition-all"
                />
              </div>

              {/* Footer Modal */}
              <div className="px-5 py-3 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
                <span className="text-[11px] text-slate-400 truncate pr-2">
                  Tampilan Antarmuka Nyata Well POS • Tekan <kbd className="px-1.5 py-0.5 rounded-sm bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono">ESC</kbd> untuk menutup
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shrink-0"
                >
                  Tutup Pratinjau
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
