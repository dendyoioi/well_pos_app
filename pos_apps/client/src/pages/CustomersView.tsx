import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  FileText,
  Edit2,
  Trash2,
  Eye,
  X,
  Loader2,
  TrendingUp,
  Award,
  Wallet,
  ShoppingBag,
  MessageCircle,
} from 'lucide-react';
import { customerApi } from '../services/api';
import type { Customer, CustomerFormData, CustomerSummaryStats } from '../types/customer';

export const CustomersView: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<CustomerSummaryStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState<CustomerFormData>({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    code: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Load Customers
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await customerApi.getCustomers({
        search: search.trim() || undefined,
        sortBy,
        sortOrder,
        limit: 100,
      });

      if (res.status === 'success') {
        setCustomers(res.data);
        if (res.summary) setSummary(res.summary);
      }
    } catch (err) {
      console.error('Gagal mengambil data pelanggan:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, sortBy, sortOrder]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
      code: '',
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      notes: c.notes || '',
      code: c.code || '',
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Open Detail Modal
  const handleOpenDetail = async (c: Customer) => {
    setSelectedCustomer(c);
    setIsDetailModalOpen(true);
    setLoadingDetail(true);
    try {
      const res = await customerApi.getCustomerById(c.id);
      if (res.status === 'success' && res.data) {
        setSelectedCustomer(res.data);
      }
    } catch (err) {
      console.error('Gagal memuat detail pelanggan:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Save Customer (Add / Edit)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Nama pelanggan wajib diisi');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      if (editingCustomer) {
        const res = await customerApi.updateCustomer(editingCustomer.id, formData);
        if (res.status === 'success') {
          setIsFormModalOpen(false);
          fetchCustomers();
        } else {
          setFormError(res.message || 'Gagal memperbarui pelanggan');
        }
      } else {
        const res = await customerApi.createCustomer(formData);
        if (res.status === 'success') {
          setIsFormModalOpen(false);
          fetchCustomers();
        } else {
          setFormError(res.message || 'Gagal menambah pelanggan');
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Customer
  const handleDelete = async (c: Customer) => {
    if (!window.confirm(`Yakin ingin menghapus pelanggan "${c.name}"? Riwayat penjualan tidak akan hilang.`)) {
      return;
    }

    try {
      const res = await customerApi.deleteCustomer(c.id);
      if (res.status === 'success') {
        fetchCustomers();
      } else {
        alert(res.message || 'Gagal menghapus pelanggan');
      }
    } catch (err) {
      alert('Terjadi kesalahan saat menghapus data');
    }
  };

  // Format phone to WhatsApp link
  const getWaLink = (phone?: string | null) => {
    if (!phone) return null;
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    return `https://wa.me/${clean}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Master Data Pelanggan
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Kelola basis data pelanggan, member, riwayat belanja, dan kontak WhatsApp toko Anda
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-sm shadow-sm hover:shadow transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Pelanggan Baru</span>
        </button>
      </div>

      {/* 2. Key Analytics Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Pelanggan</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {summary?.totalCustomers ?? customers.length}
            </span>
            <span className="text-xs text-slate-400 font-semibold">Orang</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Terdaftar di sistem database</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Pelanggan Loyal</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">
              {summary?.activeRepeatMembers ?? 0}
            </span>
            <span className="text-xs text-slate-400 font-semibold">Member</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">&gt; 1 kali transaksi belanja</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Akumulasi Belanja</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              Rp {(summary?.totalRevenueFromCustomers ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Customer Lifetime Value (CLV)</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Rata-rata / Pelanggan</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-indigo-950">
              Rp {(summary?.avgSpendPerCustomer ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Rata-rata belanja per member</p>
        </div>
      </div>

      {/* 3. Toolbar & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, nomor HP / WhatsApp, kode member..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 shrink-0">Urutkan:</span>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, ord] = e.target.value.split('-');
              setSortBy(field);
              setSortOrder(ord as 'asc' | 'desc');
            }}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-900 cursor-pointer"
          >
            <option value="createdAt-desc">Paling Baru Terdaftar</option>
            <option value="totalSpent-desc">Belanja Tertinggi (Top Spender)</option>
            <option value="visitCount-desc">Kunjungan Terbanyak</option>
            <option value="name-asc">Nama Pelanggan (A - Z)</option>
          </select>
        </div>
      </div>

      {/* 4. Table Customer List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] uppercase font-black tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3.5 px-4">Member</th>
                <th className="py-3.5 px-4">Kontak WhatsApp</th>
                <th className="py-3.5 px-4 text-center">Kunjungan</th>
                <th className="py-3.5 px-4 text-right">Total Belanja</th>
                <th className="py-3.5 px-4">Terdaftar</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-900" />
                      <span className="text-xs font-medium">Memuat data pelanggan...</span>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2 max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                        <Users className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-slate-700 text-sm">
                        {search ? 'Tidak ada pelanggan yang cocok' : 'Belum ada data pelanggan'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {search
                          ? 'Coba gunakan kata kunci pencarian nomor HP atau nama lain.'
                          : 'Tambahkan pelanggan baru atau layani transaksi di kasir POS.'}
                      </p>
                      {!search && (
                        <button
                          onClick={handleOpenAdd}
                          className="mt-2 px-4 py-2 bg-blue-900 text-white rounded-xl text-xs font-bold hover:bg-blue-950"
                        >
                          + Tambah Pelanggan Pertama
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const waLink = getWaLink(c.phone);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Pelanggan Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-900 to-indigo-700 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{c.name}</span>
                              {c.visitCount > 3 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                  ★ VIP
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {c.code && (
                                <span className="font-mono text-[11px] font-bold text-blue-900 bg-blue-50 px-1.5 py-0.2 rounded">
                                  {c.code}
                                </span>
                              )}
                              {c.email && (
                                <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
                                  {c.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Kontak & WhatsApp */}
                      <td className="py-3.5 px-4">
                        {c.phone ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-700 font-semibold">{c.phone}</span>
                            {waLink && (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Kirim Pesan WhatsApp"
                                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all shadow-xs"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs italic">Tanpa No. HP</span>
                        )}
                      </td>

                      {/* Kunjungan */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            c.visitCount > 1
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {c.visitCount}x Belanja
                        </span>
                      </td>

                      {/* Total Belanja */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-black text-slate-900">
                          Rp {Number(c.totalSpent).toLocaleString('id-ID')}
                        </span>
                      </td>

                      {/* Tanggal Terdaftar */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 font-medium">
                        {new Date(c.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenDetail(c)}
                            title="Lihat Detail & Riwayat Transaksi"
                            className="p-1.5 text-slate-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(c)}
                            title="Edit Data Pelanggan"
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            title="Hapus Pelanggan"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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

      {/* 5. Modal Tambah / Edit Pelanggan */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="font-black text-slate-900 text-base">
                  {editingCustomer ? 'Perbarui Data Pelanggan' : 'Tambah Pelanggan Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Pelanggan <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nomor WhatsApp / HP
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      placeholder="081234567890"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alamat Email (Opsional)
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="budi@gmail.com"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kode Member / ID Unik (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Kosongkan untuk auto-generate (misal: MBR-2609-0001)"
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Pengiriman / Domisili
                </label>
                <textarea
                  rows={2}
                  placeholder="Jl. Melati No. 12, RT 02/04, Jakarta..."
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Khusus Pelanggan
                </label>
                <input
                  type="text"
                  placeholder="Misal: Suka kopi tanpa gula, langganan pagi..."
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingCustomer ? 'Simpan Perubahan' : 'Tambahkan Pelanggan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal Detail & Riwayat Transaksi Pelanggan */}
      {isDetailModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-900 text-white font-black text-sm flex items-center justify-center shadow-xs">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base leading-tight">
                    {selectedCustomer.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {selectedCustomer.code && (
                      <span className="font-mono text-[11px] font-bold text-blue-900 bg-blue-50 px-1.5 py-0.2 rounded">
                        {selectedCustomer.code}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      Terdaftar sejak {new Date(selectedCustomer.createdAt).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto space-y-5">
              {/* Kontak & Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[11px] font-bold text-slate-400 block">Total Kunjungan</span>
                  <span className="text-xl font-black text-slate-900 mt-1 block">
                    {selectedCustomer.visitCount} Kali
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[11px] font-bold text-slate-400 block">Akumulasi Belanja</span>
                  <span className="text-xl font-black text-slate-900 mt-1 block">
                    Rp {Number(selectedCustomer.totalSpent).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[11px] font-bold text-slate-400 block">Status Pelanggan</span>
                  <span className="text-sm font-black text-emerald-600 mt-1.5 block">
                    {selectedCustomer.visitCount > 3 ? 'Pelanggan Setia (VIP)' : 'Pelanggan Reguler'}
                  </span>
                </div>
              </div>

              {/* Detail Info Kontak */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-50/50 border border-slate-200/60 text-xs">
                {selectedCustomer.phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>WhatsApp / Telepon:</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-800">{selectedCustomer.phone}</span>
                      {getWaLink(selectedCustomer.phone) && (
                        <a
                          href={getWaLink(selectedCustomer.phone)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-700"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>Chat WA</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {selectedCustomer.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>Email:</span>
                    </span>
                    <span className="font-semibold text-slate-800">{selectedCustomer.email}</span>
                  </div>
                )}

                {selectedCustomer.address && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>Alamat:</span>
                    </span>
                    <span className="font-medium text-slate-800 text-right">{selectedCustomer.address}</span>
                  </div>
                )}

                {selectedCustomer.notes && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>Catatan:</span>
                    </span>
                    <span className="font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-right">
                      {selectedCustomer.notes}
                    </span>
                  </div>
                )}
              </div>

              {/* Riwayat Transaksi Belanja */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-blue-900" />
                    <span>Riwayat Transaksi Terakhir</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {selectedCustomer.orders?.length || 0} Transaksi tercatat
                  </span>
                </div>

                {loadingDetail ? (
                  <div className="py-8 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-900 mb-1" />
                    <span className="text-xs">Memuat histori order...</span>
                  </div>
                ) : !selectedCustomer.orders || selectedCustomer.orders.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200/60 text-slate-400 text-xs">
                    Belum ada riwayat transaksi penjualan yang tercatat atas nama pelanggan ini.
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                          <th className="py-2.5 px-3">No. Invoice</th>
                          <th className="py-2.5 px-3">Outlet</th>
                          <th className="py-2.5 px-3">Waktu</th>
                          <th className="py-2.5 px-3 text-right">Total Transaksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedCustomer.orders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-mono font-bold text-blue-900">
                              {ord.invoiceNumber}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {ord.outlet?.name || 'Cabang Utama'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {new Date(ord.createdAt).toLocaleString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-slate-900">
                              Rp {Number(ord.grandTotal).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end shrink-0">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
