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
  Sliders,
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
    shortDesc: 'Alur pendaftaran akun merchant dan panduan 5-langkah wizard untuk mendirikan toko cabang pertama.',
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
        highlight: 'Email terdaftar menjadi kredensial super-tenant untuk seluruh cabang.',
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
    tips: 'Jika Anda memiliki lebih dari 1 outlet cabang, tambahkan outlet baru kapan saja melalui menu Pengaturan Resto > Profil & Outlet Toko.',
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
        title: 'Fitur "Ambil dari Master Katalog" untuk Cabang Baru',
        description:
          'Saat membuka cabang toko baru, Anda tidak perlu mengetik ulang katalog produk. Cukup klik tombol "Ambil dari Master Katalog" di cabang baru untuk menyalin seluruh menu pusat dengan 1-klik.',
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
    shortDesc: 'Tata kelola pusat pasokan dan segregasi operasional antara gudang pusat logistik dengan toko cabang penjualan.',
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
        title: 'Transfer Pasokan Antar Cabang',
        description:
          'Gudang menerima permintaan barang dari toko cabang, mengirimkan pasokan (Dispatch), dan sistem mencatat mutasi stok secara otomatis pada buku besar persediaan (Ledger).',
        highlight: 'Sistem mencatat audit trail permanen: asal barang, tujuan cabang, dan staf penanggung jawab.',
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
        title: 'Pilih Toko Cabang yang Dikonfigurasi',
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
        title: 'Catat Kas Keluar / Masuk (Petty Cash)',
        description:
          'Jika selama shift ada pengeluaran kas kecil (misal beli es batu, galon air, atau uang kembalian tambahan), catat segera melalui menu "Kas Masuk / Kas Keluar".',
      },
      {
        number: 3,
        title: 'Akhir Hari: Tutup Shift & Hitung Uang Fisik',
        description:
          'Saat pergantian shift atau tutup toko, kasir menghitung seluruh uang fisik di laci tanpa melihat kalkulasi sistem (Blind Drop). Masukkan nominal fisik aktual.',
      },
      {
        number: 4,
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
    imageCaption: 'Form Mutasi & Transfer Stok: Pemindahan bahan baku dari Gudang Pusat ke Toko Cabang.',
    steps: [
      {
        number: 1,
        title: 'Buat Dokumen Permintaan Pasokan',
        description:
          'Toko cabang yang kekurangan bahan baku (misal biji kopi atau susu kemasan) membuat form transfer stok dengan menentukan gudang sumber dan kuantitas.',
      },
      {
        number: 2,
        title: 'Verifikasi & Pengiriman dari Gudang',
        description:
          'Staf gudang memeriksa ketersediaan fisik, menyetujui dokumen, dan mengirimkan barang. Status transfer berubah menjadi "Dalam Pengiriman".',
      },
      {
        number: 3,
        title: 'Konfirmasi Penerimaan di Cabang Tujuan',
        description:
          'Toko cabang menerima barang, menghitung jumlah fisik, lalu menekan tombol "Konfirmasi Penerimaan". Saldo stok kedua cabang otomatis disesuaikan di ledger.',
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
    title: '13. Manajemen Staf, Hak Akses & Multi-Cabang',
    category: 'OWNER_ADMIN',
    categoryLabel: 'Setup & Konfigurasi',
    targetRoles: ['OWNER', 'ADMIN'],
    shortDesc: 'Pengaturan hierarki pengguna, pembatasan wewenang kasir/gudang, dan isolasi data per cabang toko.',
    actionTab: 'staff_users',
    actionLabel: 'Buka Kelola Staf',
    image: '/guide/kelola-staf-hak-akses.png',
    imageCaption: 'Daftar Staf Toko: Penugasan peran, PIN kasir, dan penguncian cabang kerja.',
    steps: [
      {
        number: 1,
        title: 'Pahami Hierarki Peran Well POS',
        description:
          '• OWNER: Hak mutlak penuh atas seluruh cabang, paket langganan, dan laporan keuangan.\n• ADMIN: Akses konfigurasi backoffice dan kelola master produk.\n• SUPERVISOR: Akses pos terminal, otorisasi PIN void, audit shift, dan laporan operasional.\n• CASHIER: Terkunci pada terminal mesin kasir dan shift harian cabang bertugas.\n• WAREHOUSE: Terkunci pada modul gudang logistik, kartu stok, PO, dan vendor.',
      },
      {
        number: 2,
        title: 'Tambah Staf Baru & Berikan PIN',
        description:
          'Buka Manajemen Staf > Kelola Staf > Tambah Staf. Masukkan nama lengkap, email, nomor WhatsApp (+62), peran, cabang penugasan, dan 6 digit PIN kasir.',
      },
      {
        number: 3,
        title: 'Pencabutan Akses Instan (Force Logout)',
        description:
          'Jika seorang staf berhenti bekerja, nonaktifkan akunnya. Sistem secara instan mencabut token sesi login perangkat aktif di toko demi keamanan data usaha.',
      },
    ],
  },
];

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

  // Auto-scroll ke section terpilih saat initialSection berubah
  useEffect(() => {
    if (initialSection) {
      setActiveSectionId(initialSection);
      const el = sectionRefs.current[initialSection];
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      }
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

  const scrollToSection = (id: string) => {
    setActiveSectionId(id);
    const el = sectionRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Filter sections berdasarkan query pencarian dan kategori
  const filteredSections = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return GUIDE_SECTIONS.filter((sec) => {
      const matchCategory = selectedCategory === 'ALL' || sec.category === selectedCategory;
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

      {/* ─── 2. CATEGORY FILTER TABS & QUICK SHORTCUT PILLS ─── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
            <Sliders className="w-4 h-4 text-blue-900" />
            <span>Kategori Panduan Sesuai Peran:</span>
          </div>

          <span className="text-[11px] font-bold text-slate-500">
            Menampilkan <strong>{filteredSections.length}</strong> dari {GUIDE_SECTIONS.length} modul panduan
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-blue-950 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Semua Modul
          </button>
          <button
            onClick={() => setSelectedCategory('OWNER_ADMIN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              selectedCategory === 'OWNER_ADMIN'
                ? 'bg-blue-950 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>👑 Owner &amp; Admin</span>
          </button>
          <button
            onClick={() => setSelectedCategory('CASHIER')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              selectedCategory === 'CASHIER'
                ? 'bg-blue-950 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>💳 Kasir &amp; POS</span>
          </button>
          <button
            onClick={() => setSelectedCategory('SUPERVISOR')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              selectedCategory === 'SUPERVISOR'
                ? 'bg-blue-950 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>🛡️ Supervisor &amp; Audit</span>
          </button>
          <button
            onClick={() => setSelectedCategory('WAREHOUSE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              selectedCategory === 'WAREHOUSE'
                ? 'bg-blue-950 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>📦 Gudang &amp; Logistik</span>
          </button>
          <button
            onClick={() => setSelectedCategory('QR_MENU')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              selectedCategory === 'QR_MENU'
                ? 'bg-blue-950 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>📱 Buku Menu QR Meja</span>
          </button>
        </div>

        {/* Quick Jump Links Bar */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-[11px] scrollbar-thin">
          <span className="font-bold text-slate-400 shrink-0">Lompat Cepat:</span>
          {GUIDE_SECTIONS.map((sec) => (
            <button
              key={sec.id}
              onClick={() => scrollToSection(sec.id)}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors cursor-pointer ${
                activeSectionId === sec.id
                  ? 'bg-blue-100 text-blue-950 border border-blue-300'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {sec.title.split('. ')[1] || sec.title}
            </button>
          ))}
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
              className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300"
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

                {/* Direct Shortcut to Action Tab */}
                {sec.actionTab && (
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
                )}
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
