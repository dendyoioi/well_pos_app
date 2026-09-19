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
  X,
  Store,
} from 'lucide-react';
import { api } from '../services/api';
import type { UserRole } from '../types/auth';
import type { Outlet } from '../types/outlet';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  pin: string | null;
  isActive: boolean;
  createdAt: string;
  outletId?: string | null;
  outlet?: {
    id: string;
    name: string;
  } | null;
}

export const UsersView: React.FC = () => {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [outletFilter, setOutletFilter] = useState<string>('ALL');
  const [showPins, setShowPins] = useState<Record<string, boolean>>({});

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    pin: '',
    role: 'CASHIER' as UserRole,
    outletId: '' as string,
    isActive: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [resUsers, resOutlets] = await Promise.all([
        api.getUsers(),
        api.getOutlets().catch(() => ({ status: 'error', data: [] })),
      ]);
      if (resUsers.status === 'success' && resUsers.data) {
        setStaffList(resUsers.data);
      }
      if (resOutlets.status === 'success' && resOutlets.data) {
        setOutlets(resOutlets.data);
      }
    } catch (err) {
      console.error('Gagal memuat data staf & cabang:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const togglePinVisibility = (id: string) => {
    setShowPins((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      pin: '',
      role: 'CASHIER',
      outletId: outlets.length > 0 ? outlets[0].id : '',
      isActive: true,
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (u: StaffUser) => {
    setSelectedUser(u);
    setFormData({
      name: u.name,
      email: u.email,
      password: '',
      pin: u.pin || '',
      role: u.role,
      outletId: u.outletId || u.outlet?.id || '',
      isActive: u.isActive,
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) return setFormError('Nama lengkap wajib diisi');
    if (!formData.email.trim()) return setFormError('Email login wajib diisi');
    if (formData.password.length < 6) return setFormError('Password minimal 6 karakter');
    if (!/^\d{6}$/.test(formData.pin)) return setFormError('PIN harus berupa 6 digit angka');

    setSubmitting(true);
    try {
      const res = await api.createUser({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        pin: formData.pin,
        role: formData.role,
        outletId: formData.outletId || null,
      });

      if (res.status === 'success') {
        setIsAddModalOpen(false);
        fetchUsers();
      } else {
        setFormError(res.message || 'Gagal menambahkan staf');
      }
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormError(null);

    if (!formData.name.trim()) return setFormError('Nama lengkap wajib diisi');
    if (!formData.email.trim()) return setFormError('Email login wajib diisi');
    if (formData.pin && !/^\d{6}$/.test(formData.pin)) {
      return setFormError('PIN harus berupa 6 digit angka');
    }
    if (formData.password && formData.password.length < 6) {
      return setFormError('Password baru minimal 6 karakter');
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        pin: formData.pin || null,
        outletId: formData.outletId || null,
        isActive: formData.isActive,
      };
      if (formData.password) {
        payload.password = formData.password;
      }

      const res = await api.updateUser(selectedUser.id, payload);
      if (res.status === 'success') {
        setIsEditModalOpen(false);
        fetchUsers();
      } else {
        setFormError(res.message || 'Gagal mengupdate staf');
      }
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (u: StaffUser) => {
    if (!window.confirm(`Yakin ingin menonaktifkan akun staf ${u.name} (${u.role})?`)) {
      return;
    }

    try {
      const res = await api.deleteUser(u.id);
      if (res.status === 'success') {
        fetchUsers();
      } else {
        alert(res.message || 'Gagal menghapus pengguna');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menghubungi server');
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return { label: 'Admin / Owner', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'SUPERVISOR':
        return { label: 'Supervisor', color: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'WAREHOUSE':
        return { label: 'Staf Gudang', color: 'bg-sky-100 text-sky-800 border-sky-200' };
      case 'CASHIER':
      default:
        return { label: 'Kasir', color: 'bg-blue-100 text-blue-900 border-blue-200' };
    }
  };

  const filteredStaff = staffList.filter((s) => {
    const matchQuery =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.pin && s.pin.includes(searchQuery));
    const matchRole = roleFilter === 'ALL' || s.role === roleFilter;
    const staffOutletId = s.outletId || s.outlet?.id;
    const matchOutlet = outletFilter === 'ALL' || staffOutletId === outletFilter;
    return matchQuery && matchRole && matchOutlet;
  });

  const totalStaff = staffList.length;
  const activeCashiers = staffList.filter((s) => s.role === 'CASHIER' && s.isActive).length;
  const activeWarehouse = staffList.filter((s) => s.role === 'WAREHOUSE' && s.isActive).length;
  const activeAdmins = staffList.filter((s) => (s.role === 'ADMIN' || s.role === 'SUPERVISOR') && s.isActive).length;

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
            Kelola akun petugas kasir, staf gudang, supervisor, PIN 6-digit akses cepat, dan wewenang sistem.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-5 py-3 bg-blue-900 hover:bg-blue-950 text-white font-extrabold rounded-2xl text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Tambah Staf Baru</span>
        </button>
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
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, email, atau PIN..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
            />
          </div>

          {/* Filter Berdasarkan Cabang Outlet */}
          {outlets.length > 1 && (
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500 shrink-0">Cabang:</span>
              <select
                value={outletFilter}
                onChange={(e) => setOutletFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 cursor-pointer"
              >
                <option value="ALL">Semua Cabang (Semua)</option>
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
            onClick={fetchUsers}
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
                <th className="py-3.5 px-6">Nama Petugas</th>
                <th className="py-3.5 px-6">Email Login</th>
                <th className="py-3.5 px-6">Peran (Role)</th>
                <th className="py-3.5 px-6">Penugasan Cabang</th>
                <th className="py-3.5 px-6">PIN Cepat (6-Digit)</th>
                <th className="py-3.5 px-6">Status Akun</th>
                <th className="py-3.5 px-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="inline-block w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="font-semibold text-xs">Memuat daftar staf...</p>
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    Tidak ditemukan staf dengan kriteria tersebut.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((u) => {
                  const badge = getRoleBadge(u.role);
                  const isPinVisible = showPins[u.id] || false;
                  const outletName = u.outlet?.name || (outlets.find((o) => o.id === u.outletId)?.name);

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-blue-950 flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 text-blue-900 font-black flex items-center justify-center text-xs">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <div>{u.name}</div>
                            <div className="text-[11px] text-slate-400 font-normal">
                              Dibuat: {new Date(u.createdAt).toLocaleDateString('id-ID')}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-6 font-medium text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{u.email}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-6">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Penugasan Cabang Toko */}
                      <td className="py-3.5 px-6">
                        {outletName ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50/80 text-blue-900 border border-blue-200 text-xs font-extrabold">
                            <Store className="w-3.5 h-3.5 text-blue-700" />
                            <span>{outletName}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium">
                            <Store className="w-3.5 h-3.5 text-slate-400" />
                            <span>Semua Cabang (Akses Pusat)</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-6">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200">
                          <span className="font-mono font-bold tracking-widest text-slate-800 text-xs">
                            {isPinVisible ? u.pin || 'Belum set' : u.pin ? '••••••' : 'None'}
                          </span>
                          {u.pin && (
                            <button
                              onClick={() => togglePinVisibility(u.id)}
                              title={isPinVisible ? 'Sembunyikan PIN' : 'Lihat PIN'}
                              className="text-slate-400 hover:text-blue-900 transition-colors"
                            >
                              {isPinVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>

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

                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-900 text-slate-600 transition-colors"
                            title="Edit Data Staf & Penugasan Cabang"
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
      </div>

      {/* MODAL: TAMBAH STAF BARU */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-blue-950 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-900" />
                <span>Tambah Staf / Kasir Baru</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Rina Anggraini"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Email Login</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="kasir2@pos.com"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Min. 6 karakter"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">PIN 6-Digit</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                    placeholder="Contoh: 555555"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Peran / Hak Akses</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  >
                    <option value="CASHIER">Kasir (Layar Kasir & Shift)</option>
                    <option value="WAREHOUSE">Staf Gudang (Stok & Mutasi)</option>
                    <option value="SUPERVISOR">Supervisor (Audit & Supervisi Toko)</option>
                    <option value="ADMIN">Admin / Owner (Akses Penuh)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Penugasan Cabang</label>
                  <select
                    value={formData.outletId}
                    onChange={(e) => setFormData({ ...formData, outletId: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  >
                    <option value="">-- Akses Semua Cabang (Pusat) --</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        📍 {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 flex gap-2 justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Akun Staf'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT STAF & PIN */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-blue-950 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-900" />
                <span>Edit Staf: {selectedUser.name}</span>
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Email Login</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Ganti Password <span className="text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Kosongkan jika tetap"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">PIN 6-Digit</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                    placeholder="6 digit angka"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Peran / Hak Akses</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  >
                    <option value="CASHIER">Kasir (Layar Kasir & Shift)</option>
                    <option value="WAREHOUSE">Staf Gudang (Stok & Mutasi)</option>
                    <option value="SUPERVISOR">Supervisor (Audit & Supervisi Toko)</option>
                    <option value="ADMIN">Admin / Owner (Akses Penuh)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Penugasan Cabang</label>
                  <select
                    value={formData.outletId}
                    onChange={(e) => setFormData({ ...formData, outletId: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  >
                    <option value="">-- Akses Semua Cabang (Pusat) --</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        📍 {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-900 rounded-sm border-slate-300 focus:ring-blue-900"
                />
                <label htmlFor="isActiveToggle" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Status Akun Aktif (Dapat Login & Bertransaksi)
                </label>
              </div>

              <div className="pt-3 flex gap-2 justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
