import React, { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  ArrowLeft,
  Search,
  Edit2,
  Trash2,
  Users,
  AlertCircle,
  CreditCard,
  UtensilsCrossed,
  Boxes,
  BarChart3,
  Sliders,
  Check,
  Percent,
  CheckCircle2,
  Sparkles,
  Crown,
} from 'lucide-react';
import { api } from '../services/api';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { useDialog } from '../context/DialogContext';
import type { RolePermissions, PermissionDefinition, PermissionCategory } from '../types/auth';

export const SYSTEM_PERMISSIONS_FALLBACK: PermissionDefinition[] = [
  // 1. Kasir & Penjualan POS
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

  // 2. Menu, Resep & Modifiers
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

  // 3. Inventori & Pergudangan
  {
    id: 'stock_view',
    label: 'Lihat Saldo Stok Bahan Baku',
    description: 'Melihat sisa persediaan fisik di gudang utama maupun outlet toko',
    category: 'INVENTORY_STOCK',
  },
  {
    id: 'stock_in',
    label: 'Penerimaan Barang Supplier (PO)',
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
    label: 'Transfer Stok Antar Toko',
    description: 'Mengirim dan menerima mutasi bahan baku antar lokasi toko',
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
    label: 'Laporan Penjualan & Menu Terlaris',
    description: 'Analisis statistik omset, tren jam ramai, dan performa menu',
    category: 'REPORTS_FINANCIAL',
  },
  {
    id: 'report_pnl',
    label: 'Laporan Laba Rugi & HPP Riil (P&L)',
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

  // 5. Tata Kelola & Toko
  {
    id: 'settings_staff',
    label: 'Kelola Akun Pegawai & PIN Staf',
    description: 'Menambah staf baru, mengatur PIN kasir, dan penugasan toko',
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

const CATEGORY_META: Record<
  PermissionCategory,
  {
    title: string;
    subtitle: string;
    icon: React.ElementType;
    badgeStyle: string;
    headerBg: string;
  }
> = {
  REGISTER_SALES: {
    title: 'Kasir & Penjualan POS',
    subtitle: 'Transaksi pemesanan, kas laci, kasbon pelanggan, absensi mandiri, dan struk nota',
    icon: CreditCard,
    badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200',
    headerBg: 'from-blue-50/60 to-transparent',
  },
  CATALOG_RECIPES: {
    title: 'Menu, Resep & Modifiers',
    subtitle: 'Katalog produk, racikan takaran gram/ml (BOM), varian rasa, dan cetak barcode',
    icon: UtensilsCrossed,
    badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200',
    headerBg: 'from-amber-50/60 to-transparent',
  },
  INVENTORY_STOCK: {
    title: 'Inventori & Pergudangan',
    subtitle: 'Persediaan bahan baku, faktur PO supplier, opname, dan mutasi toko',
    icon: Boxes,
    badgeStyle: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    headerBg: 'from-cyan-50/60 to-transparent',
  },
  REPORTS_FINANCIAL: {
    title: 'Laporan & Finansial',
    subtitle: 'Audit pendapatan, laporan shift X/Z, kasbon piutang CRM, laba rugi, dan arus kas riil',
    icon: BarChart3,
    badgeStyle: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    headerBg: 'from-indigo-50/60 to-transparent',
  },
  SETTINGS_GOVERNANCE: {
    title: 'Tata Kelola & Toko',
    subtitle: 'Otorisasi PIN staf, hak akses, rekap absensi, jadwal kerja, pajak PB1, dan printer',
    icon: Sliders,
    badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    headerBg: 'from-emerald-50/60 to-transparent',
  },
};

export const DEFAULT_FNB_ROLES_FALLBACK: RolePermissions[] = [
  {
    id: 'role-owner',
    name: 'Pemilik Usaha (Owner)',
    description: 'Akses penuh tanpa batas ke seluruh modul operasional, finansial, dan pengaturan',
    status: true,
    isDefault: true,
    permissions: SYSTEM_PERMISSIONS_FALLBACK.map((p) => p.id),
    businessPermissions: {
      orderDiscount: { maxPercent: 100, maxAmount: 10000000 },
      productDiscount: { maxPercent: 100, maxAmount: 10000000 },
    },
    staffCount: 1,
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
    staffCount: 1,
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
    staffCount: 2,
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
    staffCount: 1,
  },
  {
    id: 'role-barista',
    name: 'Barista & Kru Dapur (Kitchen)',
    description: 'Menerima tiket pesanan dapur, memeriksa ketersediaan resep, melihat antrean, dan absensi mandiri',
    status: true,
    isDefault: true,
    permissions: ['menu_view', 'stock_view', 'sales_hold', 'attendance_clock'],
    businessPermissions: {
      orderDiscount: { maxPercent: 0, maxAmount: 0 },
      productDiscount: { maxPercent: 0, maxAmount: 0 },
    },
    staffCount: 1,
  },
  {
    id: 'role-waiter',
    name: 'Pelayan & Pramusaji (Waiter)',
    description: 'Melayani pemesanan meja pelanggan, antrean tamu, melihat daftar menu, dan absensi mandiri',
    status: true,
    isDefault: true,
    permissions: ['menu_view', 'sales_checkout', 'sales_hold', 'attendance_clock'],
    businessPermissions: {
      orderDiscount: { maxPercent: 0, maxAmount: 0 },
      productDiscount: { maxPercent: 0, maxAmount: 0 },
    },
    staffCount: 1,
  },
];

interface StaffRolesViewProps {
  onBackToStaffList?: () => void;
  initialCreateMode?: boolean;
}

export const StaffRolesView: React.FC<StaffRolesViewProps> = ({
  onBackToStaffList,
  initialCreateMode = false,
}) => {
  const dialog = useDialog();
  const [roles, setRoles] = useState<RolePermissions[]>(DEFAULT_FNB_ROLES_FALLBACK);
  const [systemPermissions, setSystemPermissions] = useState<PermissionDefinition[]>(SYSTEM_PERMISSIONS_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(initialCreateMode);
  const [selectedRole, setSelectedRole] = useState<RolePermissions | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState(true);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [rolesSearch, setRolesSearch] = useState('');

  // Financial Guardrails
  const [orderMaxPercent, setOrderMaxPercent] = useState<number | ''>(10);
  const [orderMaxAmount, setOrderMaxAmount] = useState<number>(50000);
  const [productMaxPercent, setProductMaxPercent] = useState<number | ''>(10);
  const [productMaxAmount, setProductMaxAmount] = useState<number>(50000);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api.getRoles(),
        api.getSystemPermissions ? api.getSystemPermissions().catch(() => null) : Promise.resolve(null),
      ]);

      if (rolesRes && rolesRes.status === 'success' && Array.isArray(rolesRes.data) && rolesRes.data.length > 0) {
        setRoles(rolesRes.data);
      } else {
        setRoles(DEFAULT_FNB_ROLES_FALLBACK);
      }
      if (permsRes && permsRes.status === 'success' && Array.isArray(permsRes.data) && permsRes.data.length > 0) {
        setSystemPermissions(permsRes.data);
      }
    } catch (err) {
      console.error('Gagal mengambil data peran atau wewenang:', err);
      setRoles(DEFAULT_FNB_ROLES_FALLBACK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartCreate = () => {
    setSelectedRole(null);
    setName('');
    setDescription('');
    setStatus(true);
    setSearchFilter('');
    // Default sensible permissions for standard staff (Kasir umum)
    setSelectedPermissions([
      'sales_shift',
      'sales_checkout',
      'sales_hold',
      'sales_reprint',
      'attendance_clock',
      'menu_view',
      'report_x',
    ]);
    setOrderMaxPercent(10);
    setOrderMaxAmount(50000);
    setProductMaxPercent(10);
    setProductMaxAmount(50000);
    setIsEditing(true);
    setFeedback(null);
  };

  const handleStartEdit = (role: RolePermissions) => {
    setSelectedRole(role);
    setName(role.name);
    setDescription(role.description || '');
    setStatus(role.status);
    setSearchFilter('');
    setSelectedPermissions(role.permissions || []);
    setOrderMaxPercent(role.businessPermissions?.orderDiscount?.maxPercent ?? 10);
    setOrderMaxAmount(role.businessPermissions?.orderDiscount?.maxAmount ?? 50000);
    setProductMaxPercent(role.businessPermissions?.productDiscount?.maxPercent ?? 10);
    setProductMaxAmount(role.businessPermissions?.productDiscount?.maxAmount ?? 50000);
    setIsEditing(true);
    setFeedback(null);
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  const toggleSelectAllCategory = (category: PermissionCategory) => {
    const categoryPermIds = systemPermissions
      .filter((p) => p.category === category)
      .map((p) => p.id);

    const isAllSelected = categoryPermIds.every((id) => selectedPermissions.includes(id));

    if (isAllSelected) {
      // Uncheck all in category
      setSelectedPermissions((prev) => prev.filter((id) => !categoryPermIds.includes(id)));
    } else {
      // Check all in category
      setSelectedPermissions((prev) => Array.from(new Set([...prev, ...categoryPermIds])));
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'Nama peran wajib diisi' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    const payload = {
      name: name.trim(),
      description: description.trim(),
      status,
      permissions: selectedPermissions,
      businessPermissions: {
        orderDiscount: {
          maxPercent: Number(orderMaxPercent) || 0,
          maxAmount: Number(orderMaxAmount) || 0,
        },
        productDiscount: {
          maxPercent: Number(productMaxPercent) || 0,
          maxAmount: Number(productMaxAmount) || 0,
        },
      },
    };

    try {
      if (selectedRole) {
        const res = await api.updateRole(selectedRole.id, payload);
        if (res.status === 'success') {
          setFeedback({ type: 'success', message: 'Peran berhasil diperbarui!' });
          await fetchData();
          setIsEditing(false);
        } else {
          setFeedback({ type: 'error', message: res.message || 'Gagal memperbarui peran' });
        }
      } else {
        const res = await api.createRole(payload);
        if (res.status === 'success') {
          setFeedback({ type: 'success', message: 'Peran baru berhasil dibuat!' });
          await fetchData();
          setIsEditing(false);
        } else {
          setFeedback({ type: 'error', message: res.message || 'Gagal membuat peran baru' });
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Terjadi kesalahan sistem' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (id: string, roleName: string) => {
    const ok = await dialog.confirm({
      title: 'Hapus Peran Karyawan',
      message: `Apakah Anda yakin ingin menghapus peran "${roleName}"?`,
      variant: 'danger',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
    });
    if (!ok) return;

    try {
      const res = await api.deleteRole(id);
      if (res.status === 'success') {
        fetchData();
        dialog.toast(`Peran "${roleName}" berhasil dihapus`, 'success');
      } else {
        dialog.alert({
          title: 'Gagal Menghapus Peran',
          message: res.message || 'Gagal menghapus peran.',
          variant: 'danger',
        });
      }
    } catch (err: any) {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: 'Terjadi kesalahan saat menghapus peran.',
        variant: 'danger',
      });
    }
  };

  // Group permissions by category
  const categories: PermissionCategory[] = [
    'REGISTER_SALES',
    'CATALOG_RECIPES',
    'INVENTORY_STOCK',
    'REPORTS_FINANCIAL',
    'SETTINGS_GOVERNANCE',
  ];

  // =========================================================================
  // VIEW: FORM TAMBAH / UBAH PERAN (WELL POS STUDIO DESIGN)
  // =========================================================================
  if (isEditing) {
    const filteredPermissions = systemPermissions.filter((p) =>
      p.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.description.toLowerCase().includes(searchFilter.toLowerCase())
    );

    return (
      <div className="max-w-7xl mx-auto space-y-6 pb-28 sm:pb-16 font-sans">
        {/* Navigation Breadcrumb Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsEditing(false)}
              className="p-2 rounded-xl text-slate-600 hover:text-blue-900 hover:bg-blue-50 border border-slate-200/60 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Daftar Peran</span>
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <span>Manajemen Staf</span>
              <span>/</span>
              <span>Akses &amp; Peran</span>
              <span>/</span>
              <span className="font-bold text-slate-900">
                {selectedRole ? `Ubah Peran: ${selectedRole.name}` : 'Tambah Peran Baru'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedRole?.isDefault && (
              <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
                Peran Baku Sistem
              </span>
            )}
            {onBackToStaffList && (
              <button
                onClick={onBackToStaffList}
                className="text-xs text-blue-900 hover:underline font-bold px-2 py-1"
              >
                Lihat Semua Staf →
              </button>
            )}
          </div>
        </div>

        {feedback && (
          <div
            className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs'
                : 'bg-rose-50 text-rose-800 border border-rose-200 shadow-xs'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{feedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSaveRole} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ============================================================= */}
            {/* KOLOM KIRI (4 COLS): PROFIL PERAN & FINANCIAL GUARDRAILS       */}
            {/* ============================================================= */}
            <div className="lg:col-span-4 space-y-6">
              {/* Profil & Status Card */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-blue-50 border border-blue-100 text-blue-900 flex items-center justify-center font-black shrink-0">
                    <Shield className="w-4 h-4 shrink-0" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-900">Profil &amp; Status</h3>
                    <p className="text-[11px] text-slate-400">Identitas peran tim kerja</p>
                  </div>
                </div>

                {/* Nama Peran */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span className="text-rose-500">*</span>
                    <span>Nama Peran</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Barista Senior / Captain Kasir"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-900 text-xs font-semibold text-slate-900 transition-all outline-hidden shadow-2xs"
                  />
                </div>

                {/* Deskripsi Peran */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Deskripsi Tugas Operasional
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Jelaskan ringkasan tanggung jawab dan cakupan kerja peran ini..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-900 text-xs font-normal text-slate-800 transition-all outline-hidden resize-none shadow-2xs"
                  />
                </div>

                {/* Status Switch (iOS Modern Style) */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Status Peran</p>
                    <p className="text-[11px] text-slate-400">
                      {status ? 'Dapat ditugaskan ke akun staf' : 'Nonaktif (Staf tidak dapat login)'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStatus(!status)}
                    className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      status ? 'bg-blue-900' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        status ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Financial Guardrails (Batas Diskon Kasir) Card */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-100 text-amber-900 flex items-center justify-center font-black shrink-0">
                    <Percent className="w-4 h-4 shrink-0" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-900">Batas Toleransi Diskon</h3>
                    <p className="text-[11px] text-slate-400">Proteksi diskon kasir tanpa PIN supervisor</p>
                  </div>
                </div>

                {/* Diskon Total Pesanan */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-900" />
                    <h4 className="text-xs font-black text-slate-800">Diskon Transaksi (Per Nota)</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">Maks. Persen</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={orderMaxPercent}
                          onChange={(e) =>
                            setOrderMaxPercent(e.target.value === '' ? '' : Number(e.target.value))
                          }
                          className="w-full px-3 py-2 pr-7 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 outline-hidden focus:bg-white focus:border-blue-900"
                          placeholder="0"
                        />
                        <span className="absolute right-2.5 top-2 text-xs font-bold text-slate-400">
                          %
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">Maks. Rupiah</label>
                      <CurrencyInput
                        value={orderMaxAmount}
                        onChange={(val) => setOrderMaxAmount(val)}
                        prefix="Rp"
                        className="text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Diskon Satuan Produk */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-600" />
                    <h4 className="text-xs font-black text-slate-800">Diskon Produk (Per Menu)</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">Maks. Persen</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={productMaxPercent}
                          onChange={(e) =>
                            setProductMaxPercent(e.target.value === '' ? '' : Number(e.target.value))
                          }
                          className="w-full px-3 py-2 pr-7 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 outline-hidden focus:bg-white focus:border-blue-900"
                          placeholder="0"
                        />
                        <span className="absolute right-2.5 top-2 text-xs font-bold text-slate-400">
                          %
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">Maks. Rupiah</label>
                      <CurrencyInput
                        value={productMaxAmount}
                        onChange={(val) => setProductMaxAmount(val)}
                        prefix="Rp"
                        className="text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-100 text-[11px] text-blue-900 font-medium leading-relaxed">
                  💡 Jika kasir memasukkan diskon melebihi batasan ini di POS, sistem kasir akan secara otomatis meminta otorisasi PIN Supervisor.
                </div>
              </div>

              {/* Submit Buttons (Desktop) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="h-10 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 px-6 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:bg-slate-400 text-white font-extrabold text-xs shadow-md shadow-blue-900/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </div>

            {/* Mobile Sticky Action Footer (PWA Ergonomics) */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 flex items-center justify-end gap-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-5 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:bg-slate-400 text-white font-extrabold text-xs shadow-md shadow-blue-900/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </div>

            {/* ============================================================= */}
            {/* KOLOM KANAN (8 COLS): STUDIO WEWENANG 5 DOMAIN OPERASIONAL     */}
            {/* ============================================================= */}
            <div className="lg:col-span-8 space-y-6">
              {/* Toolbar & Filter */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">
                      Cakupan Wewenang Fungsional
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
                      {selectedPermissions.length} dari {systemPermissions.length} Aktif
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Aktifkan izin fitur berdasarkan ranah tanggung jawab nyata tim restoran
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Cari izin fitur..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-hidden focus:bg-white focus:border-blue-900 transition-all shadow-2xs"
                  />
                </div>
              </div>

              {/* 5 Domain Modules */}
              <div className="space-y-6">
                {categories.map((category) => {
                  const meta = CATEGORY_META[category];
                  const categoryPerms = filteredPermissions.filter((p) => p.category === category);
                  if (categoryPerms.length === 0 && searchFilter) return null;

                  const allCategoryPerms = systemPermissions.filter((p) => p.category === category);
                  const selectedCategoryCount = allCategoryPerms.filter((p) =>
                    selectedPermissions.includes(p.id)
                  ).length;
                  const isAllCategorySelected =
                    allCategoryPerms.length > 0 &&
                    allCategoryPerms.every((p) => selectedPermissions.includes(p.id));

                  const IconComponent = meta.icon;

                  return (
                    <div
                      key={category}
                      className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-xs hover:border-slate-300 transition-all"
                    >
                      {/* Header Domain Card */}
                      <div className={`p-5 sm:p-6 bg-gradient-to-b ${meta.headerBg} border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                        <div className="flex items-center gap-3.5">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black border ${meta.badgeStyle}`}>
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm sm:text-base font-black text-slate-900">
                                {meta.title}
                              </h4>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeStyle}`}>
                                {selectedCategoryCount}/{allCategoryPerms.length} Wewenang
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{meta.subtitle}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleSelectAllCategory(category)}
                          className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className={`w-3.5 h-3.5 ${isAllCategorySelected ? 'text-blue-900' : 'text-slate-400'}`} />
                          <span>{isAllCategorySelected ? 'Lepas Semua' : 'Pilih Semua'}</span>
                        </button>
                      </div>

                      {/* Items Grid */}
                      <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {categoryPerms.map((perm) => {
                          const isChecked = selectedPermissions.includes(perm.id);

                          return (
                            <div
                              key={perm.id}
                              onClick={() => togglePermission(perm.id)}
                              className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex items-start justify-between gap-3 ${
                                isChecked
                                  ? 'bg-blue-50/40 border-blue-200 shadow-xs'
                                  : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'
                              }`}
                            >
                              <div className="space-y-1">
                                <p
                                  className={`text-xs font-bold leading-tight ${
                                    isChecked ? 'text-blue-950 font-black' : 'text-slate-800'
                                  }`}
                                >
                                  {perm.label}
                                </p>
                                <p className="text-[11px] text-slate-500 leading-snug">
                                  {perm.description}
                                </p>
                              </div>

                              {/* Modern Toggle Switch */}
                              <div className="pt-0.5 shrink-0">
                                <span
                                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                    isChecked ? 'bg-blue-900' : 'bg-slate-200'
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                      isChecked ? 'translate-x-4' : 'translate-x-0'
                                    }`}
                                  />
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {filteredPermissions.length === 0 && (
                  <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-2">
                    <Search className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-700 text-sm">Tidak ditemukan wewenang</p>
                    <p className="text-xs text-slate-400">
                      Coba cari dengan kata kunci lain seperti "shift", "resep", "stok", atau "diskon".
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // =========================================================================
  // VIEW: LIST OF ROLES (WELL POS OVERVIEW CARDS)
  // =========================================================================
  const defaultRolesCount = roles.filter((r) => r.isDefault).length;
  const customRolesCount = roles.filter((r) => !r.isDefault).length;

  const filteredRoles = roles.filter((r) => {
    if (!rolesSearch.trim()) return true;
    const q = rolesSearch.toLowerCase();
    return r.name.toLowerCase().includes(q) || (r.description && r.description.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 pb-28 sm:pb-16 font-sans">
      {/* Top Banner & Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Akses &amp; Peran Staf
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-900 border border-blue-200">
              Role-Based Access Control
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Atur wewenang tim resto Anda berdasarkan domain fungsi operasional (Kasir, Resep/Menu, Gudang, Finansial, dan Tata Kelola) dengan pembatasan diskon yang aman.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          {/* Quick Search Roles */}
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
            <input
              type="text"
              value={rolesSearch}
              onChange={(e) => setRolesSearch(e.target.value)}
              placeholder="Cari nama peran..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-hidden focus:bg-white focus:border-blue-900 transition-all shadow-2xs"
            />
          </div>

          <button
            onClick={handleStartCreate}
            className="h-10 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-md shadow-blue-900/20 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Peran Kustom</span>
          </button>
        </div>
      </div>

      {/* Quick Stat Bar (Canonical font-mono formatting) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 flex items-center justify-center font-black shrink-0">
            <Shield className="w-5 h-5 shrink-0" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Total Peran</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono text-2xl font-black text-slate-900">{roles.length}</span>
              <span className="text-xs font-bold text-slate-500">Definisi</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 flex items-center justify-center font-black shrink-0">
            <Sparkles className="w-5 h-5 shrink-0" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Peran Baku Sistem</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono text-2xl font-black text-slate-900">{defaultRolesCount}</span>
              <span className="text-xs font-bold text-slate-500">Standar F&amp;B</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-800 flex items-center justify-center font-black shrink-0">
            <Users className="w-5 h-5 shrink-0" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Peran Kustom</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono text-2xl font-black text-slate-900">{customRolesCount}</span>
              <span className="text-xs font-bold text-slate-500">Dibuat Toko</span>
            </div>
          </div>
        </div>
      </div>

      {/* Roles Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredRoles.map((role) => {
          const rolePerms = role.permissions || [];
          const activeCategories = categories.filter((cat) =>
            systemPermissions
              .filter((p) => p.category === cat)
              .some((p) => rolePerms.includes(p.id))
          );
          const isOwnerRole = role.id === 'role-owner' || role.name.toLowerCase().includes('owner') || role.name.toLowerCase().includes('pemilik');

          return (
            <div
              key={role.id}
              className={`border rounded-3xl p-6 shadow-xs flex flex-col justify-between transition-all group ${
                isOwnerRole
                  ? 'bg-amber-50/20 border-amber-200/90 hover:border-amber-300 hover:shadow-md'
                  : 'bg-white border-slate-200 hover:shadow-md hover:border-blue-200'
              }`}
            >
              <div className="space-y-4">
                {/* Header Card */}
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black group-hover:scale-105 transition-transform ${
                    isOwnerRole
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-blue-50 border border-blue-100 text-blue-900'
                  }`}>
                    {isOwnerRole ? <Crown className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {isOwnerRole ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs">
                        <Crown className="w-3 h-3 text-amber-700" />
                        <span>Pemilik Utama</span>
                      </span>
                    ) : role.isDefault ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
                        Baku Sistem
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        Kustom
                      </span>
                    )}

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        role.status
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-600 border-rose-200'
                      }`}
                    >
                      {role.status ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                </div>

                {/* Role Title & Description */}
                <div>
                  <h3 className={`font-black text-base transition-colors ${
                    isOwnerRole
                      ? 'text-amber-950 group-hover:text-amber-900'
                      : 'text-slate-900 group-hover:text-blue-900'
                  }`}>
                    {role.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {role.description || 'Tidak ada deskripsi operasional.'}
                  </p>
                </div>

                {/* Staff Member Count */}
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                  <Users className="w-3.5 h-3.5 text-blue-900" />
                  <span>
                    <strong className="font-mono font-bold text-slate-800">{role.staffCount ?? 0}</strong> Staf ditugaskan ke peran ini
                  </span>
                </div>

                {/* Domain Coverage Badges */}
                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Cakupan Domain:
                    </span>
                    <span className="font-mono text-[11px] font-black text-blue-900">
                      {rolePerms.length} Izin
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {activeCategories.map((cat) => {
                      const meta = CATEGORY_META[cat];
                      return (
                        <span
                          key={cat}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${meta.badgeStyle}`}
                        >
                          {meta.title.split(' ')[0]}
                        </span>
                      );
                    })}
                    {activeCategories.length === 0 && (
                      <span className="text-[11px] text-slate-400 italic">Belum ada domain aktif</span>
                    )}
                  </div>
                </div>

                {/* Financial Guardrail Summary */}
                <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-100 text-[11px] text-slate-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-900">Diskon Transaksi:</span>
                    <span className="text-slate-900">
                      <strong className="font-mono font-black">{role.businessPermissions?.orderDiscount?.maxPercent ?? 0}%</strong> (Maks.{' '}
                      <strong className="font-mono font-bold">Rp {(role.businessPermissions?.orderDiscount?.maxAmount ?? 0).toLocaleString('id-ID')}</strong>)
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions Bottom Bar */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleStartEdit(role)}
                  className="h-9 px-3.5 rounded-xl hover:bg-blue-50 text-blue-900 border border-slate-200/80 hover:border-blue-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Ubah Wewenang</span>
                </button>

                {!role.isDefault && (
                  <button
                    onClick={() => handleDeleteRole(role.id, role.name)}
                    className="w-9 h-9 rounded-xl hover:bg-rose-50 text-rose-600 border border-slate-200/80 hover:border-rose-200 text-xs font-bold transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                    title="Hapus peran kustom"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredRoles.length === 0 && rolesSearch.trim() && (
        <div className="p-16 text-center bg-white border border-slate-200 rounded-3xl space-y-3 shadow-xs">
          <Search className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-black text-slate-800 text-base">Tidak Ditemukan Peran</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Tidak ada peran staf yang cocok dengan pencarian "{rolesSearch}". Coba kata kunci lain atau bersihkan filter.
          </p>
          <button
            onClick={() => setRolesSearch('')}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            Bersihkan Pencarian
          </button>
        </div>
      )}

      {roles.length === 0 && !loading && (
        <div className="p-16 text-center bg-white border border-slate-200 rounded-3xl space-y-3 shadow-xs">
          <Shield className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-black text-slate-800 text-base">Belum Ada Peran Terdaftar</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Sistem belum memuat data peran. Tambahkan peran baru atau muat ulang halaman.
          </p>
          <button
            onClick={handleStartCreate}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-md shadow-blue-900/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Peran Pertama</span>
          </button>
        </div>
      )}
    </div>
  );
};
