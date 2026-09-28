import fs from 'fs';
import path from 'path';

export type PermissionCategory =
  | 'REGISTER_SALES'
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

  // 3. Bahan Baku & Pergudangan
  {
    id: 'stock_view',
    label: 'Lihat Saldo Stok Bahan Baku',
    description: 'Melihat sisa persediaan fisik di gudang utama maupun cabang toko',
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
    label: 'Transfer Stok Antar Cabang',
    description: 'Mengirim dan menerima mutasi bahan baku antar lokasi cabang',
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

  // 5. Pengaturan & Tata Kelola
  {
    id: 'settings_staff',
    label: 'Kelola Akun Pegawai & PIN Staf',
    description: 'Menambah staf baru, mengatur PIN kasir, dan penugasan cabang',
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
    description: 'Mengelola operasional harian cabang, otorisasi void/diskon kasir, dan laporan shift',
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
      'menu_view',
      'menu_manage',
      'menu_modifiers',
      'stock_view',
      'stock_in',
      'stock_adjustment',
      'stock_transfer',
      'report_x',
      'report_z',
      'report_sales',
      'settings_printer',
    ],
    businessPermissions: {
      orderDiscount: { maxPercent: 30, maxAmount: 250000 },
      productDiscount: { maxPercent: 30, maxAmount: 250000 },
    },
  },
  {
    id: 'role-cashier',
    name: 'Kasir Toko (Cashier)',
    description: 'Melayani transaksi pemesanan, menerima pembayaran kasir, buka/tutup shift laci pribadi',
    status: true,
    isDefault: true,
    permissions: [
      'sales_shift',
      'sales_checkout',
      'sales_hold',
      'sales_discount',
      'sales_reprint',
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
    description: 'Fokus pada pengelolaan persediaan, barang masuk supplier, opname, dan transfer cabang',
    status: true,
    isDefault: true,
    permissions: [
      'stock_view',
      'stock_in',
      'stock_adjustment',
      'stock_transfer',
      'menu_view',
    ],
    businessPermissions: {
      orderDiscount: { maxPercent: 0, maxAmount: 0 },
      productDiscount: { maxPercent: 0, maxAmount: 0 },
    },
  },
  {
    id: 'role-barista',
    name: 'Barista & Kru Dapur (Kitchen)',
    description: 'Menerima tiket pesanan dapur, memeriksa ketersediaan resep, dan melihat antrean',
    status: true,
    isDefault: true,
    permissions: [
      'menu_view',
      'stock_view',
      'sales_hold',
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

  public getTenantRoles(tenantId: string): RolePermissions[] {
    const custom = this.memoryCache.get(tenantId) || [];
    const all = DEFAULT_FNB_ROLES.map((r) => ({ ...r, permissions: [...r.permissions] }));
    custom.forEach((cr) => {
      const idx = all.findIndex((r) => r.id === cr.id);
      if (idx >= 0) {
        all[idx] = cr;
      } else {
        all.push(cr);
      }
    });
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
