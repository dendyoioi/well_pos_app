import fs from 'fs';
import path from 'path';

export type PermissionCategory =
  | 'REGISTER_SALES'
  | 'LAUNDRY_OPERATIONS'
  | 'CATALOG_RECIPES'
  | 'INVENTORY_STOCK'
  | 'REPORTS_FINANCIAL'
  | 'SETTINGS_GOVERNANCE';

export interface PermissionDefinition {
  id: string;
  label: string;
  description: string;
  category: PermissionCategory;
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  // 1. Kasir & Transaksi POS
  {
    id: 'sales_shift',
    label: 'Buka & Tutup Shift Kasir',
    description: 'Mengelola modal kas awal dan rekap fisik uang di laci kasir',
    category: 'REGISTER_SALES',
  },
  {
    id: 'sales_checkout',
    label: 'Proses Pesanan & Pembayaran (Checkout)',
    description: 'Menerima pembayaran tunai, QRIS, kartu, serta cetak struk nota',
    category: 'REGISTER_SALES',
  },
  {
    id: 'sales_hold',
    label: 'Tahan & Lanjutkan Antrean (Hold Order)',
    description: 'Menyimpan pesanan pelanggan sementara saat antrean padat',
    category: 'REGISTER_SALES',
  },
  {
    id: 'sales_discount',
    label: 'Pemberian Diskon Manual',
    description: 'Memberikan potongan harga langsung sesuai batas toleransi peran',
    category: 'REGISTER_SALES',
  },
  {
    id: 'sales_void',
    label: 'Pembatalan & Void Pesanan (Refund)',
    description: 'Membatalkan item atau transaksi yang sudah terlanjur dicetak',
    category: 'REGISTER_SALES',
  },
  {
    id: 'sales_drawer',
    label: 'Buka Laci Uang Manual (No-Sale)',
    description: 'Membuka laci kas fisik tanpa harus melakukan transaksi penjualan',
    category: 'REGISTER_SALES',
  },
  {
    id: 'sales_reprint',
    label: 'Cetak Ulang Struk / Kirim WhatsApp',
    description: 'Mencetak ulang struk nota atau mengirimkan e-receipt ke pelanggan',
    category: 'REGISTER_SALES',
  },
  {
    id: 'sales_cash_expense',
    label: 'Catat Kas Keluar / Pengeluaran Kasir',
    description: 'Mencatat pengeluaran uang tunai operasional (iuran lingkungan, belanja toko, dll.) langsung dari kas kasir',
    category: 'REGISTER_SALES',
  },
  {
    id: 'sales_customer_debt',
    label: 'Pemberian Kasbon Pelanggan di Kasir (Piutang)',
    description: 'Memproses pesanan dengan kasbon / piutang pelanggan di layar kasir',
    category: 'REGISTER_SALES',
  },
  {
    id: 'sales_debt_payment',
    label: 'Terima Pelunasan Kasbon di Kasir',
    description: 'Menerima setoran uang pelunasan hutang/kasbon pelanggan di meja kasir',
    category: 'REGISTER_SALES',
  },
  {
    id: 'attendance_clock',
    label: 'Absensi Mandiri Staf (Clock In & Out)',
    description: 'Mencatat waktu absensi kehadiran datang dan pulang kerja mandiri menggunakan PIN staf di kasir',
    category: 'REGISTER_SALES',
  },

  // 2. Menu, Katalog & Resep
  {
    id: 'menu_view',
    label: 'Lihat Daftar Menu & Harga',
    description: 'Melihat katalog produk aktif toko tanpa hak mengedit',
    category: 'CATALOG_RECIPES',
  },
  {
    id: 'menu_manage',
    label: 'Tambah & Edit Produk / Harga Jual',
    description: 'Mengubah nama produk, foto, kategori, dan penetapan harga jual',
    category: 'CATALOG_RECIPES',
  },
  {
    id: 'menu_recipe',
    label: 'Kelola Resep Bahan Baku (BOM & HPP)',
    description: 'Mengatur racikan takaran gram/ml dan kalkulasi modal pokok HPP',
    category: 'CATALOG_RECIPES',
  },
  {
    id: 'menu_modifiers',
    label: 'Kelola Varian & Modifiers (Topping)',
    description: 'Mengatur pilihan ekstra shot, sirup, level gula, dan opsi kustom',
    category: 'CATALOG_RECIPES',
  },
  {
    id: 'menu_barcode_labels',
    label: 'Cetak Label Barcode & Stiker Rak',
    description: 'Mencetak stiker barcode produk, kode SKU, dan label harga rak toko (shelf tags)',
    category: 'CATALOG_RECIPES',
  },

  // 3. Bahan Baku & Pergudangan
  {
    id: 'stock_view',
    label: 'Lihat Saldo Stok Bahan Baku',
    description: 'Melihat sisa persediaan fisik di gudang utama maupun toko / outlet',
    category: 'INVENTORY_STOCK',
  },
  {
    id: 'stock_in',
    label: 'Penerimaan Barang Supplier (Purchase Order)',
    description: 'Mencatat stok masuk dari pemasok/vendor dan faktur pembelian',
    category: 'INVENTORY_STOCK',
  },
  {
    id: 'stock_adjustment',
    label: 'Penyesuaian Stok / Opname Fisik',
    description: 'Mencatat selisih audit fisik, barang tumpah, rusak, atau expired',
    category: 'INVENTORY_STOCK',
  },
  {
    id: 'stock_transfer',
    label: 'Transfer Stok Antar Toko / Outlet',
    description: 'Mengirim dan menerima mutasi bahan baku antar lokasi outlet',
    category: 'INVENTORY_STOCK',
  },

  // 4. Laporan & Finansial
  {
    id: 'report_x',
    label: 'Laporan Shift Kasir Berjalan (X-Report)',
    description: 'Melihat ringkasan total uang masuk selama sesi shift sedang berjalan',
    category: 'REPORTS_FINANCIAL',
  },
  {
    id: 'report_z',
    label: 'Rekap Tutup Shift Kasir (Z-Report)',
    description: 'Melihat laporan tutup buku shift dan audit selisih kas fisik laci',
    category: 'REPORTS_FINANCIAL',
  },
  {
    id: 'report_sales',
    label: 'Laporan Penjualan & Produk Terlaris',
    description: 'Analisis statistik omset, tren jam ramai, dan performa menu',
    category: 'REPORTS_FINANCIAL',
  },
  {
    id: 'report_pnl',
    label: 'Laporan Laba Rugi, HPP Riil & Margin (P&L)',
    description: 'Melihat laba kotor, margin profitabilitas, dan audit margin modal',
    category: 'REPORTS_FINANCIAL',
  },
  {
    id: 'report_cash_flow',
    label: 'Laporan Arus Kas Riil (Cash Flow)',
    description: 'Melihat rekap mutasi riil uang kas masuk, kas keluar, setoran modal awal, dan saldo kas bersih outlet',
    category: 'REPORTS_FINANCIAL',
  },
  {
    id: 'crm_debt_manage',
    label: 'Buku Kasbon CRM & Penagihan Piutang',
    description: 'Melihat buku piutang pelanggan, kelola limit kasbon, dan kirim pengingat tagihan WhatsApp otomatis',
    category: 'REPORTS_FINANCIAL',
  },

  // 5. Pengaturan & Tata Kelola
  {
    id: 'settings_staff',
    label: 'Kelola Akun Pegawai & PIN Staf',
    description: 'Menambah staf baru, mengatur PIN kasir, dan penugasan outlet',
    category: 'SETTINGS_GOVERNANCE',
  },
  {
    id: 'settings_roles',
    label: 'Atur Hak Akses & Peran Staf',
    description: 'Mengonfigurasi wewenang fitur dan toleransi diskon per peran',
    category: 'SETTINGS_GOVERNANCE',
  },
  {
    id: 'settings_tax',
    label: 'Atur Pajak Daerah (PB1) & Biaya Layanan',
    description: 'Menentukan persentase pajak restoran dan service charge per outlet',
    category: 'SETTINGS_GOVERNANCE',
  },
  {
    id: 'settings_printer',
    label: 'Konfigurasi Printer & Format Struk',
    description: 'Mengatur ukuran kertas thermal 58mm/80mm dan catatan footer nota',
    category: 'SETTINGS_GOVERNANCE',
  },
  {
    id: 'attendance_manage',
    label: 'Rekapitulasi Absensi & Jam Kerja Toko',
    description: 'Melihat rekap kehadiran seluruh staf, menetapkan jam kerja operasional, toleransi keterlambatan, dan ekspor lembar kehadiran',
    category: 'SETTINGS_GOVERNANCE',
  },
];

export const SYSTEM_LAUNDRY_PERMISSIONS: PermissionDefinition[] = [
  // 1. Kasir & Penjualan POS Laundry
  {
    id: 'sales_shift',
    label: 'Buka & Tutup Shift Kasir',
    description: 'Mengelola modal kas awal dan rekap fisik uang di laci kasir',
    category: 'REGISTER_SALES',
  },
  {
    id: 'sales_checkout',
    label: 'Proses Transaksi & Pembayaran Laundry',
    description: 'Penerimaan cucian, timbang kiloan/satuan, DP/Lunas, dan cetak nota',
    category: 'REGISTER_SALES',
  },
  {
    id: 'sales_hold',
    label: 'Tahan & Lanjutkan Antrean (Hold Order)',
    description: 'Menyimpan pesanan sementara saat pelanggan belum selesai memilah pakaian',
    category: 'REGISTER_SALES',
  },
  {
    id: 'sales_discount',
    label: 'Pemberian Diskon Manual',
    description: 'Memberikan potongan harga langsung sesuai batas toleransi peran',
    category: 'REGISTER_SALES',
  },
  {
    id: 'sales_void',
    label: 'Pembatalan & Void Nota (Refund)',
    description: 'Membatalkan item atau transaksi cucian yang sudah terlanjur dicetak',
    category: 'REGISTER_SALES',
  },
  {
    id: 'sales_drawer',
    label: 'Buka Laci Uang Manual (No-Sale)',
    description: 'Membuka laci kas fisik tanpa harus melakukan transaksi penjualan',
    category: 'REGISTER_SALES',
  },
  {
    id: 'sales_reprint',
    label: 'Cetak Ulang Struk / Kirim WhatsApp',
    description: 'Mencetak ulang struk nota thermal atau mengirimkan e-receipt WhatsApp ke pelanggan',
    category: 'REGISTER_SALES',
  },
  {
    id: 'sales_cash_expense',
    label: 'Catat Kas Keluar / Pengeluaran Kasir',
    description: 'Mencatat pengeluaran uang tunai operasional (iuran lingkungan, belanja toko mendesak, dll.)',
    category: 'REGISTER_SALES',
  },
  {
    id: 'sales_customer_debt',
    label: 'Kasbon / Bayar Nanti saat Ambil Cucian',
    description: 'Memproses pesanan laundry dengan status bayar belakangan saat cucian selesai',
    category: 'REGISTER_SALES',
  },
  {
    id: 'sales_debt_payment',
    label: 'Terima Pelunasan Kasbon / Sisa DP di Kasir',
    description: 'Menerima pembayaran sisa tagihan saat pelanggan mengambil cucian bersih di counter',
    category: 'REGISTER_SALES',
  },
  {
    id: 'attendance_clock',
    label: 'Absensi Mandiri Staf (Clock In & Out)',
    description: 'Mencatat waktu absensi kehadiran datang dan pulang kerja mandiri menggunakan PIN staf di kasir',
    category: 'REGISTER_SALES',
  },

  // 2. Operasional & Produksi Laundry
  {
    id: 'laundry_queue_view',
    label: 'Pantau Antrean Produksi Cucian',
    description: 'Melihat antrean pengerjaan cucian masuk, estimasi waktu selesai, dan status tiap SPK order',
    category: 'LAUNDRY_OPERATIONS',
  },
  {
    id: 'laundry_queue_update',
    label: 'Update Status Cuci, Kering, Setrika & Siap',
    description: 'Memproses tahapan mesin cuci, pengering dryer, setrika uap rapi, hingga packing parfum segel',
    category: 'LAUNDRY_OPERATIONS',
  },
  {
    id: 'laundry_racks_manage',
    label: 'Penataan & Manajemen Slot Rak Cucian',
    description: 'Menempatkan bungkusan cucian siap ambil ke nomor slot rak dan memonitor rak kosong/penuh',
    category: 'LAUNDRY_OPERATIONS',
  },
  {
    id: 'laundry_handover',
    label: 'Serah Terima Cucian Bersih (Handover)',
    description: 'Verifikasi nomor nota/telepon pelanggan dan serah terima bungkusan pakaian dari rak simpan',
    category: 'LAUNDRY_OPERATIONS',
  },
  {
    id: 'laundry_transfers',
    label: 'Transfer Cucian Antar-Workshop / Outlet',
    description: 'Mengirim dan menerima pakaian kotor/bersih antar workshop central dan counter penerimaan',
    category: 'LAUNDRY_OPERATIONS',
  },
  {
    id: 'laundry_courier',
    label: 'Tugas Kurir Antar-Jemput (Pickup & Delivery)',
    description: 'Menerima order pickup ke rumah pelanggan dan mengantar cucian bersih sampai ke alamat tujuan',
    category: 'LAUNDRY_OPERATIONS',
  },

  // 3. Layanan, Tarif & Add-on Laundry
  {
    id: 'menu_view',
    label: 'Lihat Daftar Layanan & Tarif',
    description: 'Melihat katalog layanan aktif toko (Kiloan, Satuan, Express) tanpa hak mengedit',
    category: 'CATALOG_RECIPES',
  },
  {
    id: 'menu_manage',
    label: 'Tambah & Edit Layanan Laundry / Tarif',
    description: 'Mengatur nama layanan, estimasi durasi jam, batas minimal order (kg/pcs), dan penetapan tarif',
    category: 'CATALOG_RECIPES',
  },
  {
    id: 'menu_recipe',
    label: 'Kebutuhan Bahan Cuci & HPP per Kg/Pcs',
    description: 'Mengatur estimasi pemakaian konsentrat deterjen, softener, dan plastik per satuan cucian',
    category: 'CATALOG_RECIPES',
  },
  {
    id: 'menu_modifiers',
    label: 'Kelola Pilihan Parfum & Add-on Laundry',
    description: 'Mengatur varian aroma parfum (Lavender, Ocean Fresh, Akasia) dan layanan tambahan (Anti Bakteri, Hanger, Plastik Klip)',
    category: 'CATALOG_RECIPES',
  },
  {
    id: 'menu_barcode_labels',
    label: 'Cetak Tag Baju & Barcode Rak Cucian',
    description: 'Mencetak pita label anti-air untuk baju kiloan/satuan dan kode barcode identitas slot rak',
    category: 'CATALOG_RECIPES',
  },

  // 4. Bahan Cuci & Perlengkapan (Supplies)
  {
    id: 'stock_view',
    label: 'Lihat Saldo Stok Bahan Cuci & Perlengkapan',
    description: 'Melihat sisa persediaan deterjen cair/bubuk, softener, parfum, plastik packing, dan hanger',
    category: 'INVENTORY_STOCK',
  },
  {
    id: 'stock_in',
    label: 'Penerimaan Perlengkapan Supplier (PO)',
    description: 'Mencatat pasokan bahan kimia cuci dan kemasan masuk dari vendor serta faktur pembelian',
    category: 'INVENTORY_STOCK',
  },
  {
    id: 'stock_adjustment',
    label: 'Opname Fisik & Penyesuaian Stok Supplies',
    description: 'Mencatat selisih fisik deterjen tumpah, botol bocor, plastik rusak, atau koreksi berkala',
    category: 'INVENTORY_STOCK',
  },
  {
    id: 'stock_transfer',
    label: 'Transfer Perlengkapan Antar-Toko / Gudang',
    description: 'Mengirim dan menerima mutasi persediaan deterjen & plastik antar outlet laundry',
    category: 'INVENTORY_STOCK',
  },

  // 5. Laporan & Finansial Laundry
  {
    id: 'report_x',
    label: 'Laporan Shift Kasir Berjalan (X-Report)',
    description: 'Melihat ringkasan total uang masuk selama sesi shift kasir sedang berjalan',
    category: 'REPORTS_FINANCIAL',
  },
  {
    id: 'report_z',
    label: 'Rekap Tutup Shift Kasir (Z-Report)',
    description: 'Melihat laporan tutup buku shift kasir dan audit selisih kas fisik laci',
    category: 'REPORTS_FINANCIAL',
  },
  {
    id: 'report_sales',
    label: 'Laporan Penjualan & Layanan Terlaris',
    description: 'Analisis statistik omset, perbandingan kiloan vs satuan, tren jam ramai, dan produktivitas outlet',
    category: 'REPORTS_FINANCIAL',
  },
  {
    id: 'report_pnl',
    label: 'Laporan Laba Rugi & HPP Riil (P&L)',
    description: 'Melihat pendapatan bersih, biaya bahan kimia cuci/listrik/air, dan margin profitabilitas usaha',
    category: 'REPORTS_FINANCIAL',
  },
  {
    id: 'report_cash_flow',
    label: 'Laporan Arus Kas Riil (Cash Flow)',
    description: 'Melihat mutasi uang kas masuk, operasional keluar, setoran modal, dan saldo kas bersih outlet',
    category: 'REPORTS_FINANCIAL',
  },
  {
    id: 'crm_debt_manage',
    label: 'Buku Piutang CRM & Pengingat Tagihan WhatsApp',
    description: 'Melihat buku piutang pelanggan, status titip cuci belum lunas, dan kirim pengingat tagihan WhatsApp',
    category: 'REPORTS_FINANCIAL',
  },

  // 6. Tata Kelola & Toko Laundry
  {
    id: 'settings_staff',
    label: 'Kelola Akun Pegawai & PIN Staf',
    description: 'Menambah staf kasir/operator, mengatur PIN 5-digit, dan penugasan toko / outlet',
    category: 'SETTINGS_GOVERNANCE',
  },
  {
    id: 'settings_roles',
    label: 'Atur Hak Akses & Peran Staf',
    description: 'Mengonfigurasi wewenang fitur dan toleransi diskon per peran staf',
    category: 'SETTINGS_GOVERNANCE',
  },
  {
    id: 'settings_tax',
    label: 'Atur Pajak (PPN) & Biaya Layanan',
    description: 'Menentukan persentase pajak pertambahan nilai dan biaya admin per outlet',
    category: 'SETTINGS_GOVERNANCE',
  },
  {
    id: 'settings_printer',
    label: 'Konfigurasi Printer Thermal & Tag Cucian',
    description: 'Mengatur ukuran kertas nota thermal 58mm/80mm, template nota, dan printer label tag pakaian',
    category: 'SETTINGS_GOVERNANCE',
  },
  {
    id: 'attendance_manage',
    label: 'Rekapitulasi Absensi & Jam Kerja Toko',
    description: 'Melihat rekap kehadiran seluruh tim laundry, jadwal shift kerja, dan toleransi keterlambatan',
    category: 'SETTINGS_GOVERNANCE',
  },
];

export interface RolePermissions {
  id: string;
  name: string;
  description?: string;
  status: boolean;
  isDefault?: boolean;
  permissions: string[];
  functionalPermissions?: {
    WEB: string[];
    POS: string[];
    HANDHELD: string[];
    IOS: string[];
  };
  businessPermissions: {
    orderDiscount: {
      maxPercent: number;
      maxAmount: number;
    };
    productDiscount: {
      maxPercent: number;
      maxAmount: number;
    };
  };
  staffCount?: number;
}

export const DEFAULT_FNB_ROLES: RolePermissions[] = [
  {
    id: 'role-owner',
    name: 'Pemilik Usaha (Owner)',
    description: 'Akses penuh tanpa batas ke seluruh modul operasional, finansial, dan pengaturan',
    status: true,
    isDefault: true,
    permissions: SYSTEM_PERMISSIONS.map((p) => p.id),
    businessPermissions: {
      orderDiscount: { maxPercent: 100, maxAmount: 10000000 },
      productDiscount: { maxPercent: 100, maxAmount: 10000000 },
    },
  },
  {
    id: 'role-supervisor',
    name: 'Supervisor / Manajer Toko',
    description: 'Mengelola operasional harian toko, otorisasi void/diskon kasir, absensi, dan laporan shift',
    status: true,
    isDefault: true,
    permissions: [
      'sales_shift',
      'sales_checkout',
      'sales_hold',
      'sales_discount',
      'sales_void',
      'sales_drawer',
      'sales_reprint',
      'sales_cash_expense',
      'sales_customer_debt',
      'sales_debt_payment',
      'attendance_clock',
      'menu_view',
      'menu_manage',
      'menu_modifiers',
      'menu_barcode_labels',
      'stock_view',
      'stock_in',
      'stock_adjustment',
      'stock_transfer',
      'report_x',
      'report_z',
      'report_sales',
      'report_cash_flow',
      'crm_debt_manage',
      'settings_printer',
      'attendance_manage',
    ],
    businessPermissions: {
      orderDiscount: { maxPercent: 30, maxAmount: 250000 },
      productDiscount: { maxPercent: 30, maxAmount: 250000 },
    },
  },
  {
    id: 'role-cashier',
    name: 'Kasir Toko (Cashier)',
    description: 'Melayani transaksi pemesanan, kasbon pelanggan, pelunasan piutang, buka/tutup shift, dan absensi',
    status: true,
    isDefault: true,
    permissions: [
      'sales_shift',
      'sales_checkout',
      'sales_hold',
      'sales_discount',
      'sales_reprint',
      'sales_cash_expense',
      'sales_customer_debt',
      'sales_debt_payment',
      'attendance_clock',
      'menu_view',
      'report_x',
    ],
    businessPermissions: {
      orderDiscount: { maxPercent: 10, maxAmount: 50000 },
      productDiscount: { maxPercent: 10, maxAmount: 50000 },
    },
  },
  {
    id: 'role-warehouse',
    name: 'Staf Gudang (Warehouse)',
    description: 'Fokus pada persediaan, cetak barcode rak, penerimaan PO supplier, opname, transfer, dan absensi',
    status: true,
    isDefault: true,
    permissions: [
      'stock_view',
      'stock_in',
      'stock_adjustment',
      'stock_transfer',
      'menu_view',
      'menu_barcode_labels',
      'attendance_clock',
    ],
    businessPermissions: {
      orderDiscount: { maxPercent: 0, maxAmount: 0 },
      productDiscount: { maxPercent: 0, maxAmount: 0 },
    },
  },
  {
    id: 'role-barista',
    name: 'Barista & Kru Dapur (Kitchen)',
    description: 'Menerima tiket pesanan dapur, memeriksa ketersediaan resep, melihat antrean, dan absensi mandiri',
    status: true,
    isDefault: true,
    permissions: [
      'menu_view',
      'stock_view',
      'sales_hold',
      'attendance_clock',
    ],
    businessPermissions: {
      orderDiscount: { maxPercent: 0, maxAmount: 0 },
      productDiscount: { maxPercent: 0, maxAmount: 0 },
    },
  },
  {
    id: 'role-waiter',
    name: 'Pelayan & Pramusaji (Waiter)',
    description: 'Melayani pemesanan meja pelanggan, antrean tamu, melihat daftar menu, dan absensi mandiri',
    status: true,
    isDefault: true,
    permissions: [
      'menu_view',
      'sales_checkout',
      'sales_hold',
      'attendance_clock',
    ],
    businessPermissions: {
      orderDiscount: { maxPercent: 0, maxAmount: 0 },
      productDiscount: { maxPercent: 0, maxAmount: 0 },
    },
  },
];

export const DEFAULT_LAUNDRY_ROLES: RolePermissions[] = [
  {
    id: 'role-owner',
    name: 'Pemilik Usaha (Owner / Admin)',
    description: 'Akses penuh tanpa batas ke seluruh modul operasional laundry, finansial, dan pengaturan toko',
    status: true,
    isDefault: true,
    permissions: SYSTEM_LAUNDRY_PERMISSIONS.map((p) => p.id),
    businessPermissions: {
      orderDiscount: { maxPercent: 100, maxAmount: 10000000 },
      productDiscount: { maxPercent: 100, maxAmount: 10000000 },
    },
  },
  {
    id: 'role-supervisor',
    name: 'Supervisor / Kepala Produksi',
    description: 'Mengawasi operasional harian, kontrol antrean cucian, otorisasi void & diskon kasir, absensi staf, dan rekap shift',
    status: true,
    isDefault: true,
    permissions: [
      'sales_shift',
      'sales_checkout',
      'sales_hold',
      'sales_discount',
      'sales_void',
      'sales_drawer',
      'sales_reprint',
      'sales_cash_expense',
      'sales_customer_debt',
      'sales_debt_payment',
      'attendance_clock',
      'laundry_queue_view',
      'laundry_queue_update',
      'laundry_racks_manage',
      'laundry_handover',
      'laundry_transfers',
      'laundry_courier',
      'menu_view',
      'menu_manage',
      'menu_modifiers',
      'menu_barcode_labels',
      'stock_view',
      'stock_in',
      'stock_adjustment',
      'stock_transfer',
      'report_x',
      'report_z',
      'report_sales',
      'report_cash_flow',
      'crm_debt_manage',
      'settings_printer',
      'attendance_manage',
    ],
    businessPermissions: {
      orderDiscount: { maxPercent: 30, maxAmount: 250000 },
      productDiscount: { maxPercent: 30, maxAmount: 250000 },
    },
  },
  {
    id: 'role-cashier',
    name: 'Kasir / Front Desk Laundry',
    description: 'Melayani penerimaan cucian (drop-off), timbangan kiloan/satuan, aroma parfum & add-on, pembayaran lunas/DP, nota, dan penyerahan cucian (handover)',
    status: true,
    isDefault: true,
    permissions: [
      'sales_shift',
      'sales_checkout',
      'sales_hold',
      'sales_discount',
      'sales_reprint',
      'sales_cash_expense',
      'sales_customer_debt',
      'sales_debt_payment',
      'attendance_clock',
      'laundry_queue_view',
      'laundry_racks_manage',
      'laundry_handover',
      'menu_view',
      'report_x',
    ],
    businessPermissions: {
      orderDiscount: { maxPercent: 10, maxAmount: 50000 },
      productDiscount: { maxPercent: 10, maxAmount: 50000 },
    },
  },
  {
    id: 'role-production',
    name: 'Operator Produksi (Cuci, Kering, Setrika, Packing)',
    description: 'Bertanggung jawab atas proses pencucian mesin, pengeringan dryer, setrika uap rapi, packing parfum segel, hingga penataan ke slot rak simpan',
    status: true,
    isDefault: true,
    permissions: [
      'laundry_queue_view',
      'laundry_queue_update',
      'laundry_racks_manage',
      'menu_view',
      'stock_view',
      'attendance_clock',
    ],
    businessPermissions: {
      orderDiscount: { maxPercent: 0, maxAmount: 0 },
      productDiscount: { maxPercent: 0, maxAmount: 0 },
    },
  },
  {
    id: 'role-courier',
    name: 'Kurir Antar-Jemput (Pickup & Delivery)',
    description: 'Melayani pickup cucian kotor dari pelanggan, delivery pakaian bersih, serta serah terima manifes transfer antar-outlet/workshop',
    status: true,
    isDefault: true,
    permissions: [
      'laundry_courier',
      'laundry_handover',
      'sales_hold',
      'attendance_clock',
    ],
    businessPermissions: {
      orderDiscount: { maxPercent: 0, maxAmount: 0 },
      productDiscount: { maxPercent: 0, maxAmount: 0 },
    },
  },
  {
    id: 'role-warehouse',
    name: 'Staf Gudang & Perlengkapan (Supplies)',
    description: 'Fokus pada persediaan konsentrat deterjen, softener, parfum, chemical noda, plastik packing, hanger, opname, dan absensi',
    status: true,
    isDefault: true,
    permissions: [
      'stock_view',
      'stock_in',
      'stock_adjustment',
      'stock_transfer',
      'menu_view',
      'menu_barcode_labels',
      'attendance_clock',
    ],
    businessPermissions: {
      orderDiscount: { maxPercent: 0, maxAmount: 0 },
      productDiscount: { maxPercent: 0, maxAmount: 0 },
    },
  },
];

class RoleService {
  private memoryCache: Map<string, RolePermissions[]> = new Map();
  private storagePath: string;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        console.warn('Gagal membuat folder data untuk roles:', err);
      }
    }
    this.storagePath = path.join(dataDir, 'roles.json');
    this.loadFromFile();
  }

  private loadFromFile() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const content = fs.readFileSync(this.storagePath, 'utf-8');
        const parsed = JSON.parse(content);
        Object.keys(parsed).forEach((k) => {
          this.memoryCache.set(k, parsed[k]);
        });
      }
    } catch (err) {
      console.warn('Gagal membaca roles.json, menggunakan in-memory cache');
    }
  }

  private saveToFile() {
    try {
      const obj: Record<string, RolePermissions[]> = {};
      this.memoryCache.forEach((val, key) => {
        obj[key] = val;
      });
      fs.writeFileSync(this.storagePath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Gagal menyimpan roles.json:', err);
    }
  }

  public getTenantRoles(tenantId: string, isLaundry: boolean = false): RolePermissions[] {
    const custom = this.memoryCache.get(tenantId) || [];
    const baseRoles = isLaundry ? DEFAULT_LAUNDRY_ROLES : DEFAULT_FNB_ROLES;
    const all = baseRoles.map((r) => ({ ...r, permissions: [...r.permissions] }));
    custom.forEach((cr) => {
      const idx = all.findIndex((r) => r.id === cr.id);
      if (idx >= 0) {
        all[idx] = cr;
      } else {
        all.push(cr);
      }
    });
    // Pastikan peran Owner selalu memiliki 100% seluruh izin sistem tanpa terkecuali
    const ownerIdx = all.findIndex((r) => r.id === 'role-owner');
    if (ownerIdx >= 0) {
      all[ownerIdx].permissions = (isLaundry ? SYSTEM_LAUNDRY_PERMISSIONS : SYSTEM_PERMISSIONS).map((p) => p.id);
    }
    return all;
  }

  public saveTenantRole(tenantId: string, role: RolePermissions): RolePermissions {
    const custom = this.memoryCache.get(tenantId) || [];
    const idx = custom.findIndex((r) => r.id === role.id);
    if (idx >= 0) {
      custom[idx] = role;
    } else {
      custom.push(role);
    }
    this.memoryCache.set(tenantId, custom);
    this.saveToFile();
    return role;
  }

  public deleteTenantRole(tenantId: string, roleId: string): boolean {
    const custom = this.memoryCache.get(tenantId) || [];
    const filtered = custom.filter((r) => r.id !== roleId);
    this.memoryCache.set(tenantId, filtered);
    this.saveToFile();
    return true;
  }
}

export const roleService = new RoleService();
