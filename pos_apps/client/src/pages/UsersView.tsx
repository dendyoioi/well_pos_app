import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  KeyRound,
  Mail,
  UserCheck,
  Search,
  RefreshCw,
  Store,
  ArrowLeft,
  Sparkles,
  Plus,
  AlertCircle,
  Hash,
} from 'lucide-react';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';
import { TablePagination } from '../components/TablePagination';
import type { RolePermissions } from '../types/auth';
import type { Outlet } from '../types/outlet';

interface StaffUser {
  id: string;
  userCode?: string | null;
  name: string;
  email: string;
  role: string;
  hasPin: boolean;
  hasPassword: boolean;
  isActive: boolean;
  createdAt: string;
  outletId?: string | null;
  canCashOut?: boolean;
  outlet?: {
    id: string;
    name: string;
  } | null;
}

interface UsersViewProps {
  onNavigateToRoles?: () => void;
}

// Mapping dari role.id (dari RoleService) ke system enum Role di database
// Ini kritis agar dropdown <option value> cocok dengan formData.role yang berasal dari DB
const ROLE_ID_TO_SYSTEM_ENUM: Record<string, string> = {
  'role-owner': 'OWNER',
  'role-supervisor': 'SUPERVISOR',
  'role-cashier': 'CASHIER',
  'role-warehouse': 'WAREHOUSE',
  'role-barista': 'KITCHEN',
  'role-waiter': 'WAITER',
};

export const UsersView: React.FC<UsersViewProps> = ({ onNavigateToRoles }) => {
  const dialog = useDialog();
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [roles, setRoles] = useState<RolePermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [outletFilter, setOutletFilter] = useState<string>('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Full-Page View Mode: 'LIST' or 'FORM' (Zero Stacked Modals)
  const [viewMode, setViewMode] = useState<'LIST' | 'FORM'>('LIST');
  const [formMode, setFormMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [originalUserCode, setOriginalUserCode] = useState<string>('');

  // Form State matching Screenshot 3
  const [formData, setFormData] = useState({
    name: '',
    userCode: '',
    loginAccountType: 'EMAIL' as 'EMAIL' | 'CUSTOMER_ID',
    email: '',
    password: '',
    pin: '',
    role: 'CASHIER',
    outletId: '',
    canCashOut: false,
    isActive: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Toggle "Ubah Password" dan "Ubah PIN" di mode EDIT
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [showPinField, setShowPinField] = useState(false);

  // Auto-generate 5-digit Staff ID sesuai standar hierarki:
  // 0000x: Owner/Admin | 1000x: Kasir | 2000x: Supervisor | 3000x: Gudang
  const generateRandomStaffId = (targetRole?: string) => {
    const roleToUse = targetRole || formData.role;
    let minSeq = 10001;
    let maxSeq = 19999;

    if (roleToUse === 'ADMIN' || roleToUse === 'OWNER') {
      minSeq = 1;
      maxSeq = 9999;
    } else if (roleToUse === 'SUPERVISOR') {
      minSeq = 20001;
      maxSeq = 29999;
    } else if (roleToUse === 'WAREHOUSE') {
      minSeq = 30001;
      maxSeq = 39999;
    }

    const existingCodes = new Set(staffList.map((s) => s.userCode));
    let nextNum = minSeq;
    while (nextNum <= maxSeq) {
      const codeStr = (roleToUse === 'ADMIN' || roleToUse === 'OWNER')
        ? nextNum.toString().padStart(5, '0')
        : nextNum.toString();
      if (!existingCodes.has(codeStr)) {
        setFormData((prev) => ({ ...prev, userCode: codeStr }));
        return;
      }
      nextNum++;
    }

    const fallbackCode = Math.floor(minSeq + Math.random() * (maxSeq - minSeq)).toString().padStart(5, '0');
    setFormData((prev) => ({ ...prev, userCode: fallbackCode }));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resUsers, resOutlets, resRoles] = await Promise.all([
        api.getUsers(),
        api.getOutlets().catch(() => ({ status: 'error', data: [] })),
        api.getRoles().catch(() => ({ status: 'error', data: [] })),
      ]);

      if (resUsers.status === 'success' && resUsers.data) {
        setStaffList(resUsers.data);
      }
      if (resOutlets.status === 'success' && resOutlets.data) {
        setOutlets(resOutlets.data);
      }
      if (resRoles.status === 'success' && resRoles.data) {
        setRoles(resRoles.data);
      }
    } catch (err) {
      console.error('Gagal memuat data staf, outlet, atau peran:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreateForm = () => {
    const generatedId = Math.floor(10000 + Math.random() * 90000).toString();
    setSelectedUser(null);
    setFormData({
      name: '',
      userCode: generatedId,
      loginAccountType: 'EMAIL',
      email: '',
      password: '',
      pin: '',
      role: roles.length > 0 ? roles[0].name : 'CASHIER',
      outletId: outlets.length > 0 ? outlets[0].id : '',
      canCashOut: false,
      isActive: true,
    });
    setFormError(null);
    setFormMode('CREATE');
    setViewMode('FORM');
  };

  const handleOpenEditForm = (u: StaffUser) => {
    setSelectedUser(u);
    const existingCode = u.userCode || '';
    setOriginalUserCode(existingCode);
    setFormData({
      name: u.name,
      userCode: existingCode,
      loginAccountType: 'EMAIL',
      email: u.email,
      password: '',
      pin: '',
      role: u.role,
      outletId: u.outletId || u.outlet?.id || '',
      canCashOut: u.canCashOut ?? false,
      isActive: u.isActive,
    });
    setFormError(null);
    setFormMode('EDIT');
    setViewMode('FORM');
    // Reset toggle ubah credential
    setShowPasswordField(false);
    setShowPinField(false);
    setShowPassword(false);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) return setFormError('Nama staf wajib diisi');

    // Validasi userCode: format 5 digit hanya wajib saat CREATE atau saat EDIT dengan kode baru
    const isUserCodeChanged = formData.userCode.trim() !== originalUserCode;
    if (formMode === 'CREATE') {
      if (!formData.userCode.trim()) return setFormError('ID Staf (5 digit) wajib diisi');
      if (!/^\d{5}$/.test(formData.userCode)) {
        return setFormError('ID Staf harus berupa 5 digit angka murni (contoh: 24589)');
      }
    } else if (isUserCodeChanged && formData.userCode.trim()) {
      // Saat EDIT, jika user mengubah userCode, validasi format baru
      if (!/^\d{5}$/.test(formData.userCode)) {
        return setFormError('ID Staf baru harus berupa 5 digit angka murni (contoh: 24589)');
      }
    }

    if (formData.loginAccountType === 'EMAIL' && !formData.email.trim()) {
      return setFormError('Email login wajib diisi');
    }

    if (formMode === 'CREATE' && (!formData.password || formData.password.length < 6)) {
      return setFormError('Kata sandi login minimal 6 karakter');
    }

    if (formData.password && formData.password.length < 6) {
      return setFormError('Kata sandi baru minimal 6 karakter');
    }

    if (formData.pin && !/^\d{4,6}$/.test(formData.pin)) {
      return setFormError('Kode PIN harus berupa 4 sampai 6 digit angka');
    }

    setSubmitting(true);
    try {
      if (formMode === 'CREATE') {
        const res = await api.createUser({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          userCode: formData.userCode.trim(),
          pin: formData.pin || '1234',
          role: formData.role,
          outletId: formData.outletId || null,
          canCashOut: formData.canCashOut,
        });

        if (res.status === 'success') {
          await fetchData();
          setViewMode('LIST');
        } else {
          setFormError(res.message || 'Gagal menambahkan staf');
        }
      } else {
        if (!selectedUser) return;
        const payload: any = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          role: formData.role,
          pin: formData.pin || null,
          outletId: formData.outletId || null,
          canCashOut: formData.canCashOut,
          isActive: formData.isActive,
        };
        // Hanya kirim userCode jika benar-benar diubah oleh user
        if (isUserCodeChanged && formData.userCode.trim()) {
          payload.userCode = formData.userCode.trim();
        }
        if (formData.password && formData.password.trim().length >= 6) {
          payload.password = formData.password.trim();
        }

        const res = await api.updateUser(selectedUser.id, payload);
        if (res.status === 'success') {
          await fetchData();
          setViewMode('LIST');
        } else {
          setFormError(res.message || 'Gagal memperbarui data staf');
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem saat menghubungi server');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (u: StaffUser) => {
    const ok = await dialog.confirm({
      title: 'Nonaktifkan Akun Staf',
      message: `Yakin ingin menonaktifkan akun staf ${u.name} (${u.role})? Staf ini tidak akan dapat login ke mesin kasir maupun backoffice.`,
      variant: 'danger',
      confirmText: 'Ya, Nonaktifkan',
      cancelText: 'Batal',
    });
    if (!ok) return;

    try {
      const res = await api.deleteUser(u.id);
      if (res.status === 'success') {
        fetchData();
        dialog.toast(`Akun staf ${u.name} berhasil dinonaktifkan`, 'success');
      } else {
        dialog.alert({
          title: 'Gagal Menonaktifkan Staf',
          message: res.message || 'Gagal menghapus staf.',
          variant: 'danger',
        });
      }
    } catch (err: any) {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: 'Gagal menghubungi server.',
        variant: 'danger',
      });
    }
  };

  const getRoleBadge = (roleName: string) => {
    const upper = roleName.toUpperCase();
    if (upper.includes('ADMIN') || upper.includes('OWNER')) {
      return { label: roleName, color: 'bg-purple-100 text-purple-800 border-purple-200' };
    }
    if (upper.includes('SUPERVISOR') || upper.includes('MANAGER')) {
      return { label: roleName, color: 'bg-amber-100 text-amber-800 border-amber-200' };
    }
    if (upper.includes('GUDANG') || upper.includes('WAREHOUSE')) {
      return { label: roleName, color: 'bg-sky-100 text-sky-800 border-sky-200' };
    }
    if (upper.includes('BARISTA') || upper.includes('KITCHEN') || upper.includes('DAPUR')) {
      return { label: roleName, color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    }
    return { label: roleName, color: 'bg-blue-100 text-blue-900 border-blue-200' };
  };

  const filteredStaff = staffList.filter((s) => {
    const matchQuery =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.userCode && s.userCode.includes(searchQuery));

    const matchRole = roleFilter === 'ALL' || s.role.toUpperCase() === roleFilter.toUpperCase();
    const staffOutletId = s.outletId || s.outlet?.id;
    const matchOutlet = outletFilter === 'ALL' || staffOutletId === outletFilter;
    return matchQuery && matchRole && matchOutlet;
  });

  // Reset pagination ke halaman 1 saat filter atau pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, outletFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedStaff = filteredStaff.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const totalStaff = staffList.length;
  const activeCashiers = staffList.filter((s) => s.role.toUpperCase().includes('CASHIER') && s.isActive).length;
  const activeWarehouse = staffList.filter((s) => s.role.toUpperCase().includes('WAREHOUSE') && s.isActive).length;
  const activeAdmins = staffList.filter(
    (s) => (s.role.toUpperCase().includes('ADMIN') || s.role.toUpperCase().includes('SUPERVISOR')) && s.isActive
  ).length;

  // ==========================================
  // RENDER: FULL-PAGE FORM (MATCHING SCREENSHOT 3)
  // ==========================================
  if (viewMode === 'FORM') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        {/* Breadcrumb & Top Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setViewMode('LIST')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>
            <div className="text-xs font-semibold text-slate-400">
              Staf / <span className="text-blue-950 font-bold">{formMode === 'CREATE' ? 'Tambah Staf' : 'Ubah Staf'}</span>
            </div>
          </div>
        </div>

        {/* Title Header */}
        <div>
          <h1 className="text-2xl font-black text-blue-950 tracking-tight">
            {formMode === 'CREATE' ? 'Tambah Staf' : 'Ubah Data Staf'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Lengkapi data staf resto, nomor ID petugas, kredensial login, dan wewenang peran POS.
          </p>
        </div>

        {formError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-6">
          {/* CARD 1: INFORMASI DASAR */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-blue-950">Informasi Dasar</h2>
              <p className="text-xs text-slate-500 mt-0.5">Identitas utama dan akun login petugas resto Anda.</p>
            </div>

            {/* Nama Staf */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nama Staf <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={50}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Masukkan nama staf"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 pr-16"
                  required
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                  {formData.name.length}/50
                </span>
              </div>
            </div>

            {/* ID Staf + Tombol Buat */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                ID Staf {formMode === 'CREATE' && <span className="text-rose-500">*</span>}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Hash className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    maxLength={formMode === 'EDIT' ? 20 : 5}
                    value={formData.userCode}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Saat CREATE: hanya angka. Saat EDIT: bebas (bisa legacy format)
                      const filtered = formMode === 'CREATE' ? val.replace(/\D/g, '') : val;
                      setFormData({ ...formData, userCode: filtered });
                    }}
                    placeholder={formMode === 'CREATE' ? 'Contoh: 10001 (Kasir), 20001 (SPV)' : 'ID Staf (5-digit)'}
                    className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-mono font-bold text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 tracking-wider"
                    required={formMode === 'CREATE'}
                  />
                </div>
                {formMode === 'CREATE' && (
                  <button
                    type="button"
                    onClick={() => generateRandomStaffId()}
                    className="px-5 py-3 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-bold text-xs rounded-2xl transition-colors shrink-0 shadow-xs flex items-center gap-1.5"
                    title="Generate ID 5-Digit Sesuai Peran Otomatis"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                    <span>Buat</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {formMode === 'CREATE'
                  ? 'Standar 5-digit: 0000x (Owner), 1000x (Kasir), 2000x (SPV), 3000x (Gudang) untuk kemudahan login numpad kasir POS.'
                  : 'ID Staf 5-digit angka. Kosongkan atau biarkan untuk mempertahankan ID yang ada.'}
              </p>
            </div>

            {/* Akun Login */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Akun Login <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-6">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="loginAccountType"
                    value="EMAIL"
                    checked={formData.loginAccountType === 'EMAIL'}
                    onChange={() => setFormData({ ...formData, loginAccountType: 'EMAIL' })}
                    className="w-4 h-4 text-blue-900 focus:ring-blue-900 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-800">Email</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer opacity-50" title="Fitur ID Pelanggan segera hadir">
                  <input
                    type="radio"
                    name="loginAccountType"
                    value="CUSTOMER_ID"
                    checked={formData.loginAccountType === 'CUSTOMER_ID'}
                    disabled
                    className="w-4 h-4 text-blue-900 focus:ring-blue-900 cursor-not-allowed"
                  />
                  <span className="text-xs font-medium text-slate-500">ID Pelanggan (Segera)</span>
                </label>
              </div>
            </div>

            {/* Input Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Login <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Masukkan email staf (contoh: kasir@resto.com)"
                  className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  required
                />
              </div>
            </div>

            {/* Kata Sandi */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Kata Sandi {formMode === 'CREATE' && <span className="text-rose-500">*</span>}
              </label>
              {formMode === 'EDIT' && !showPasswordField ? (
                // Mode EDIT: tampilkan status + tombol ubah
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  {selectedUser?.hasPassword ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <span className="text-base">🔒</span> Password sudah diset
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                      <span className="text-base">⚠️</span> Belum ada password
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => { setShowPasswordField(true); setFormData(f => ({ ...f, password: '' })); }}
                    className="ml-auto text-xs font-bold text-blue-900 hover:text-blue-700 underline underline-offset-2"
                  >
                    {selectedUser?.hasPassword ? 'Ubah Password' : 'Set Password'}
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={formMode === 'CREATE' ? 'Minimal 6 karakter' : 'Masukkan password baru (min. 6 karakter)'}
                    className="w-full pl-9 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              )}
              <p className="text-[11px] text-slate-400 mt-1">
                Digunakan untuk autentikasi Backoffice dan portal manajemen.
              </p>
            </div>

            {/* Kode PIN */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Kode PIN (4-6 Digit)
              </label>
              {formMode === 'EDIT' && !showPinField ? (
                // Mode EDIT: tampilkan status + tombol ubah
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  {selectedUser?.hasPin ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <span className="text-base">🔢</span> PIN sudah diset <span className="font-mono tracking-widest text-slate-400">••••••</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                      <span className="text-base">⚠️</span> Belum ada PIN
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => { setShowPinField(true); setFormData(f => ({ ...f, pin: '' })); }}
                    className="ml-auto text-xs font-bold text-blue-900 hover:text-blue-700 underline underline-offset-2"
                  >
                    {selectedUser?.hasPin ? 'Ubah PIN' : 'Set PIN'}
                  </button>
                </div>
              ) : (
                <input
                  type="password"
                  maxLength={6}
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                  placeholder="Masukkan PIN baru (4-6 digit angka)"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-mono font-bold text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 tracking-widest"
                />
              )}
              <p className="text-[11px] text-slate-500 mt-1">
                Digunakan untuk login cepat dan otorisasi buka kasir pada aplikasi POS tablet/handheld.
              </p>
            </div>

            {/* Peran Staf + Tombol Tambah Peran */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Peran <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 cursor-pointer"
                >
                  {roles.length > 0 ? (
                    roles.map((r) => {
                      // Gunakan system enum sebagai value agar cocok dengan formData.role dari DB
                      const systemEnum = ROLE_ID_TO_SYSTEM_ENUM[r.id] || r.name.toUpperCase();
                      return (
                        <option key={r.id} value={systemEnum}>
                          {r.name} {!r.status ? '(Nonaktif)' : ''}
                        </option>
                      );
                    })
                  ) : (
                    <>
                      <option value="CASHIER">Kasir Toko</option>
                      <option value="WAREHOUSE">Staf Gudang</option>
                      <option value="SUPERVISOR">Supervisor / Manajer</option>
                      <option value="KITCHEN">Barista &amp; Kru Dapur</option>
                      <option value="OWNER">Pemilik Usaha (Owner)</option>
                    </>
                  )}
                </select>

                <button
                  type="button"
                  onClick={onNavigateToRoles}
                  className="px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-bold text-xs rounded-2xl transition-colors shrink-0 shadow-xs flex items-center gap-1.5"
                  title="Buka Akses & Peran untuk Menambah Peran Baru"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-700" />
                  <span>Tambah</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Wewenang fitur seperti batasan diskon kasir dan menu yang bisa dibuka diatur di modul Peran.
              </p>
            </div>
          </div>

          {/* CARD 2: PENGATURAN LANJUTAN */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-blue-950">Pengaturan Lanjutan</h2>
              <p className="text-xs text-slate-500 mt-0.5">Penugasan toko resto dan status operasional staf.</p>
            </div>

            {/* Penugasan Outlet Toko */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Penugasan Outlet Toko
              </label>
              <div className="relative">
                <Store className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={formData.outletId}
                  onChange={(e) => setFormData({ ...formData, outletId: e.target.value })}
                  className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 cursor-pointer"
                >
                  <option value="">Semua Toko (Akses Pusat / Bebas Buka Kasir di Semua Outlet)</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      📍 {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Kunci petugas ke toko tertentu agar hanya dapat melakukan shift dan penjualan di outlet tersebut.
              </p>
            </div>

            {/* Status Akun */}
            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-900 rounded-md border-slate-300 focus:ring-blue-900 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">Akun Staf Aktif</div>
                  <div className="text-[11px] text-slate-500">
                    Staf dapat melakukan login ke POS dan mengakses backoffice sesuai perannya.
                  </div>
                </div>
              </label>
            </div>

            {/* Izin Pengeluaran Kas (Petty Cash Out) */}
            <div className="pt-4 border-t border-slate-100">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.canCashOut}
                  onChange={(e) => setFormData({ ...formData, canCashOut: e.target.checked })}
                  className="w-4 h-4 mt-0.5 text-blue-900 rounded-md border-slate-300 focus:ring-blue-900 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <span>Izinkan Pengeluaran Kasir (Kas Keluar / Petty Cash)</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                      Hak Akses Kasir
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Jika diaktifkan, staf ini dapat mencatat pengeluaran uang tunai dari kasir (seperti iuran lingkungan, belanja bahan toko mendesak, dsb.). Nominal pengeluaran akan otomatis memotong uang kas yang diharapkan saat tutup shift (Z-Report).
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* ACTION BUTTONS (STICKY OR FOOTER) */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('LIST')}
              className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs sm:text-sm rounded-2xl transition-colors shadow-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-7 py-3 bg-blue-900 hover:bg-blue-950 text-white font-extrabold text-xs sm:text-sm rounded-2xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan</span>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ==========================================
  // RENDER: LIST VIEW
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold mb-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Hak Akses Khusus Administrator</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-blue-950 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-900" />
            <span>Manajemen Staf & Pengguna</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Kelola akun petugas kasir, barista, supervisor, nomor ID 5-digit, PIN cepat, dan wewenang sistem.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {onNavigateToRoles && (
            <button
              onClick={onNavigateToRoles}
              className="px-4 py-3 bg-slate-50 hover:bg-slate-100 text-blue-950 border border-slate-200 font-bold rounded-2xl text-xs sm:text-sm shadow-xs transition-colors flex items-center gap-2"
            >
              <Shield className="w-4 h-4 text-blue-900" />
              <span>Akses & Peran</span>
            </button>
          )}

          <button
            onClick={handleOpenCreateForm}
            className="px-5 py-3 bg-blue-900 hover:bg-blue-950 text-white font-extrabold rounded-2xl text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Staf</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">Total Petugas</span>
            <div className="text-2xl font-black text-blue-950 mt-1">{totalStaff}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Semua peran terdata</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">Kasir Aktif</span>
            <div className="text-2xl font-black text-blue-900 mt-1">{activeCashiers}</div>
            <p className="text-[11px] text-blue-600 mt-0.5">Akses mesin POS</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center font-bold">
            <KeyRound className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">Staf Gudang</span>
            <div className="text-2xl font-black text-sky-900 mt-1">{activeWarehouse}</div>
            <p className="text-[11px] text-sky-600 mt-0.5">Akses mutasi stok</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-900 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">Admin & Spv</span>
            <div className="text-2xl font-black text-purple-950 mt-1">{activeAdmins}</div>
            <p className="text-[11px] text-purple-600 mt-0.5">Audit & finansial</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-900 flex items-center justify-center font-bold">
            <Shield className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari ID staf, nama, email, atau PIN..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
            />
          </div>

          {/* Filter Berdasarkan Outlet Toko */}
          {outlets.length > 1 && (
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500 shrink-0">Toko:</span>
              <select
                value={outletFilter}
                onChange={(e) => setOutletFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 cursor-pointer"
              >
                <option value="ALL">Semua Toko (Semua)</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    📍 {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {['ALL', 'CASHIER', 'WAREHOUSE', 'SUPERVISOR', 'ADMIN'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 ${
                roleFilter === r
                  ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {r === 'ALL'
                ? 'Semua Peran'
                : r === 'CASHIER'
                ? 'Kasir'
                : r === 'WAREHOUSE'
                ? 'Gudang'
                : r === 'SUPERVISOR'
                ? 'Supervisor'
                : 'Admin'}
            </button>
          ))}

          <button
            onClick={fetchData}
            title="Refresh Data"
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-6">ID Staf</th>
                <th className="py-3.5 px-6">Nama Petugas</th>
                <th className="py-3.5 px-6">Email Login</th>
                <th className="py-3.5 px-6">Peran (Role)</th>
                <th className="py-3.5 px-6">Penugasan Toko</th>
                <th className="py-3.5 px-6">PIN Cepat</th>
                <th className="py-3.5 px-6">Status Akun</th>
                <th className="py-3.5 px-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="inline-block w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="font-semibold text-xs">Memuat daftar staf...</p>
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    Tidak ditemukan staf dengan kriteria tersebut.
                  </td>
                </tr>
              ) : (
                paginatedStaff.map((u) => {
                  const badge = getRoleBadge(u.role);
                  const outletName = u.outlet?.name || outlets.find((o) => o.id === u.outletId)?.name;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* ID Staf */}
                      <td className="py-3.5 px-6">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-slate-100 text-blue-950 font-mono font-black text-xs border border-slate-200">
                          #{u.userCode || '—'}
                        </span>
                      </td>

                      {/* Nama Petugas */}
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-blue-950 flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-900 font-black flex items-center justify-center text-xs border border-blue-100">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div>{u.name}</div>
                            <div className="text-[11px] text-slate-400 font-normal">
                              Dibuat: {new Date(u.createdAt).toLocaleDateString('id-ID')}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email Login */}
                      <td className="py-3.5 px-6 font-medium text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{u.email}</span>
                        </div>
                      </td>

                      {/* Peran */}
                      <td className="py-3.5 px-6">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${badge.color}`}>
                            {badge.label}
                          </span>
                          {(u.canCashOut || ['OWNER', 'ADMIN', 'SUPERVISOR'].includes(u.role)) && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200" title="Kasir berhak mencatat pengeluaran uang kas">
                              💸 Bisa Kas Keluar
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Penugasan Outlet Toko */}
                      <td className="py-3.5 px-6">
                        {outletName ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50/80 text-blue-900 border border-blue-200 text-xs font-extrabold">
                            <Store className="w-3.5 h-3.5 text-blue-700" />
                            <span>{outletName}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium">
                            <Store className="w-3.5 h-3.5 text-slate-400" />
                            <span>Semua Toko (Pusat)</span>
                          </span>
                        )}
                      </td>

                      {/* PIN Cepat */}
                      <td className="py-3.5 px-6">
                        {u.hasPin ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-mono font-bold tracking-widest">
                            ••••••
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
                            Belum set
                          </span>
                        )}
                      </td>

                      {/* Status Akun */}
                      <td className="py-3.5 px-6">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Aktif</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            <XCircle className="w-3 h-3" />
                            <span>Nonaktif</span>
                          </span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditForm(u)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-900 text-slate-600 transition-colors"
                            title="Edit Data Staf & Peran"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 transition-colors"
                            title="Hapus / Nonaktifkan Staf"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Staf */}
        {!loading && filteredStaff.length > 0 && (
          <TablePagination
            currentPage={safeCurrentPage}
            pageSize={pageSize}
            totalItems={filteredStaff.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="staf"
          />
        )}
      </div>
    </div>
  );
};
