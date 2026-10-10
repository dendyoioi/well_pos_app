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
  Coins,
  Sparkles,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { customerApi } from '../services/api';
import type { Customer, CustomerFormData, CustomerSummaryStats, CustomerPointLedger } from '../types/customer';
import type { Outlet } from '../types/outlet';
import { WhatsAppInput, EmptyState, TableSkeleton } from '../components/ui';
import { TablePagination } from '../components/TablePagination';
import { useDialog } from '../context/DialogContext';
import { CustomerDebtsTab } from '../components/CustomerDebtsTab';

interface CustomersViewProps {
  activeOutlet?: Outlet | null;
}

export const CustomersView: React.FC<CustomersViewProps> = ({ activeOutlet }) => {
  const dialog = useDialog();
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'debts'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('subtab') === 'debts') return 'debts';
    }
    return 'directory';
  });

  const handleSubTabChange = (tab: 'directory' | 'debts') => {
    setActiveSubTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (tab === 'debts') {
        url.searchParams.set('subtab', 'debts');
      } else {
        url.searchParams.delete('subtab');
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<CustomerSummaryStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  // Detail Modal & Point History State
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'orders' | 'points'>('orders');
  const [pointLedgers, setPointLedgers] = useState<CustomerPointLedger[]>([]);
  const [loadingPoints, setLoadingPoints] = useState<boolean>(false);
  const [isAdjustingPoints, setIsAdjustingPoints] = useState<boolean>(false);
  const [adjustDelta, setAdjustDelta] = useState<number>(0);
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [savingAdjust, setSavingAdjust] = useState<boolean>(false);

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

  const getTierBadgeClass = (tier?: string) => {
    switch (tier) {
      case 'PLATINUM':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'GOLD':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'SILVER':
        return 'bg-slate-200 text-slate-800 border-slate-300';
      case 'BRONZE':
      default:
        return 'bg-orange-50 text-orange-800 border-orange-200';
    }
  };

  const getTierIcon = (tier?: string) => {
    switch (tier) {
      case 'PLATINUM':
        return '💎';
      case 'GOLD':
        return '🥇';
      case 'SILVER':
        return '🥈';
      case 'BRONZE':
      default:
        return '🥉';
    }
  };

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

  // Reset pagination ke halaman 1 saat filter atau pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(customers.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedCustomers = customers.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

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
    setActiveDetailTab('orders');
    setIsAdjustingPoints(false);
    setAdjustDelta(0);
    setAdjustNotes('');
    setLoadingDetail(true);
    setLoadingPoints(true);
    try {
      const [resDetail, resPoints] = await Promise.all([
        customerApi.getCustomerById(c.id),
        customerApi.getPointsHistory(c.id),
      ]);
      if (resDetail.status === 'success' && resDetail.data) {
        setSelectedCustomer(resDetail.data);
      }
      if (resPoints.status === 'success' && resPoints.data) {
        setPointLedgers(resPoints.data);
      }
    } catch (err) {
      console.error('Gagal memuat detail pelanggan:', err);
    } finally {
      setLoadingDetail(false);
      setLoadingPoints(false);
    }
  };

  // Handle Save Manual Point Adjustment
  const handleSaveAdjustPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    if (adjustDelta === 0) {
      dialog.alert({
        title: 'Perubahan Poin Kosong',
        message: 'Jumlah penyesuaian poin tidak boleh 0.',
        variant: 'warning',
      });
      return;
    }
    if (!adjustNotes.trim()) {
      dialog.alert({
        title: 'Catatan Wajib Diisi',
        message: 'Harap cantumkan alasan penyesuaian poin (misal: Kompensasi Pelayanan, Hadiah Spesial).',
        variant: 'warning',
      });
      return;
    }

    setSavingAdjust(true);
    try {
      const res = await customerApi.adjustPoints(selectedCustomer.id, {
        deltaPoints: Number(adjustDelta),
        notes: adjustNotes.trim(),
      });

      if (res.status === 'success') {
        dialog.toast(res.message || 'Poin berhasil disesuaikan', 'success');
        setIsAdjustingPoints(false);
        setAdjustDelta(0);
        setAdjustNotes('');

        // Refresh detail & points history
        const [resDetail, resPoints] = await Promise.all([
          customerApi.getCustomerById(selectedCustomer.id),
          customerApi.getPointsHistory(selectedCustomer.id),
        ]);
        if (resDetail.status === 'success' && resDetail.data) {
          setSelectedCustomer(resDetail.data);
        }
        if (resPoints.status === 'success' && resPoints.data) {
          setPointLedgers(resPoints.data);
        }
        fetchCustomers();
      } else {
        dialog.alert({
          title: 'Gagal Menyesuaikan Poin',
          message: res.message || 'Gagal menyesuaikan saldo poin.',
          variant: 'danger',
        });
      }
    } catch (err: any) {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: err.message || 'Terjadi kesalahan sistem saat penyesuaian poin.',
        variant: 'danger',
      });
    } finally {
      setSavingAdjust(false);
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
          dialog.toast('Data pelanggan berhasil diperbarui!', 'success');
          fetchCustomers();
        } else {
          setFormError(res.message || 'Gagal memperbarui pelanggan');
        }
      } else {
        const res = await customerApi.createCustomer(formData);
        if (res.status === 'success') {
          setIsFormModalOpen(false);
          dialog.toast('Pelanggan baru berhasil ditambahkan!', 'success');
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
    const ok = await dialog.confirm({
      title: 'Hapus Pelanggan',
      message: `Yakin ingin menghapus pelanggan "${c.name}"? Riwayat penjualan tidak akan hilang.`,
      variant: 'danger',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
    });
    if (!ok) return;

    try {
      const res = await customerApi.deleteCustomer(c.id);
      if (res.status === 'success') {
        fetchCustomers();
        dialog.toast('Pelanggan berhasil dihapus', 'success');
      } else {
        dialog.alert({
          title: 'Gagal Menghapus Pelanggan',
          message: res.message || 'Gagal menghapus pelanggan.',
          variant: 'danger',
        });
      }
    } catch (err: any) {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: 'Terjadi kesalahan saat menghapus data pelanggan.',
        variant: 'danger',
      });
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
    <div className="space-y-6 animate-in fade-in duration-300 pb-28 sm:pb-16 font-sans">
      {/* Subtab Navigation: Direktori Pelanggan vs Buku Kasbon & Piutang */}
      <div className="p-1 bg-slate-100 rounded-2xl flex items-center gap-1.5 w-fit border border-slate-200/60">
        <button
          type="button"
          onClick={() => handleSubTabChange('directory')}
          className={`flex items-center gap-2 h-9 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeSubTab === 'directory'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Direktori &amp; Loyalitas Pelanggan</span>
        </button>
        <button
          type="button"
          onClick={() => handleSubTabChange('debts')}
          className={`flex items-center gap-2 h-9 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeSubTab === 'debts'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Buku Kasbon &amp; Piutang</span>
        </button>
      </div>

      {activeSubTab === 'debts' ? (
        <CustomerDebtsTab activeOutlet={activeOutlet} />
      ) : (
        <>
          {/* 1. Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold shrink-0">
              <Users className="w-5 h-5 shrink-0" />
            </div>
            <div className="min-w-0">
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
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs sm:text-sm shadow-xs hover:shadow transition-all active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Pelanggan Baru</span>
        </button>
      </div>

      {/* 2. Key Analytics Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500 truncate">Total Pelanggan</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-900">
              {summary?.totalCustomers ?? customers.length}
            </span>
            <span className="text-xs text-slate-400 font-semibold">Orang</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Terdaftar di sistem database</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500 truncate">Pelanggan Loyal</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Award className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-600">
              {summary?.activeRepeatMembers ?? 0}
            </span>
            <span className="text-xs text-slate-400 font-semibold">Member</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">&gt; 1 kali transaksi belanja</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500 truncate">Akumulasi Belanja</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black font-mono text-slate-900">
              Rp {(summary?.totalRevenueFromCustomers ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Customer Lifetime Value (CLV)</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500 truncate">Rata-rata / Pelanggan</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black font-mono text-indigo-950">
              Rp {(summary?.avgSpendPerCustomer ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Rata-rata belanja per member</p>
        </div>
      </div>

      {/* 3. Toolbar & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, nomor HP / WhatsApp, kode member..."
            className="w-full h-10 pl-10 pr-8 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white transition-all font-medium"
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
          <div className="relative">
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, ord] = e.target.value.split('-');
                setSortBy(field);
                setSortOrder(ord as 'asc' | 'desc');
              }}
              className="h-10 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-8 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-900 cursor-pointer appearance-none"
            >
              <option value="createdAt-desc">Paling Baru Terdaftar</option>
              <option value="totalSpent-desc">Belanja Tertinggi (Top Spender)</option>
              <option value="visitCount-desc">Kunjungan Terbanyak</option>
              <option value="name-asc">Nama Pelanggan (A - Z)</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 4. Table Customer List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Desktop Table View (Hidden on Mobile) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] uppercase font-black tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3.5 px-4">Member</th>
                <th className="py-3.5 px-4">Kontak WhatsApp</th>
                <th className="py-3.5 px-4 text-center">Tier &amp; Poin</th>
                <th className="py-3.5 px-4 text-center">Kunjungan</th>
                <th className="py-3.5 px-4 text-right">Total Belanja</th>
                <th className="py-3.5 px-4">Terdaftar</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {loading ? (
                <TableSkeleton rows={5} columns={7} avatarCol actionCol />
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <EmptyState
                      icon={<Users className="w-7 h-7 text-blue-900" />}
                      title={search ? 'Tidak Ada Pelanggan yang Cocok' : 'Belum Ada Data Pelanggan'}
                      description={
                        search
                          ? `Tidak ditemukan pelanggan yang cocok dengan kata kunci "${search}".`
                          : 'Daftarkan pelanggan setia untuk mengumpulkan loyalty points dan diskon khusus member.'
                      }
                      actionLabel={!search ? '+ Tambah Pelanggan Pertama' : undefined}
                      onAction={!search ? handleOpenAdd : undefined}
                    />
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((c) => {
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

                      {/* Tier & Poin Loyalitas */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getTierBadgeClass(c.tier)}`}>
                            {getTierIcon(c.tier)}
                            <span>{c.tier || 'BRONZE'}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                            <Coins className="w-3 h-3 text-amber-600" />
                            <span>{Number(c.loyaltyPoints || 0).toLocaleString('id-ID')} pt</span>
                          </span>
                        </div>
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
                        <span className="font-mono font-black text-slate-900">
                          Rp {Number(c.totalSpent).toLocaleString('id-ID')}
                        </span>
                      </td>

                      {/* Tanggal Terdaftar */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500 font-medium">
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
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-900 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(c)}
                            title="Edit Data Pelanggan"
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            title="Hapus Pelanggan"
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
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

        {/* Mobile Customer Card List (Visible on Smartphone 6.8") */}
        <div className="block md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="divide-y divide-slate-100 p-3 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse space-y-2 p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-200" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 bg-slate-200 rounded w-1/3" />
                      <div className="h-3 bg-slate-200 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 px-4">
              <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-xs text-slate-700">Tidak ada pelanggan ditemukan</p>
            </div>
          ) : (
            paginatedCustomers.map((c) => {
              const waLink = getWaLink(c.phone);
              return (
                <div key={c.id} className="p-3.5 space-y-2.5 hover:bg-slate-50/70 transition-colors">
                  {/* Top Bar: Avatar + Name + VIP + Code */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-900 to-indigo-700 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5 truncate">
                          <span className="truncate">{c.name}</span>
                          {c.visitCount > 3 && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 shrink-0">
                              ★ VIP
                            </span>
                          )}
                        </div>
                        {c.code && (
                          <span className="font-mono text-[10px] font-bold text-blue-900 bg-blue-50 px-1.5 py-0.2 rounded inline-block mt-0.5">
                            {c.code}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 font-medium block">Total Belanja</span>
                      <span className="font-mono font-black text-xs sm:text-sm text-blue-950">
                        Rp {Number(c.totalSpent || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {/* Middle: Kontak & Tier/Poin & Kunjungan */}
                  <div className="flex items-center justify-between gap-2 text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 text-slate-600 truncate">
                      <span className="font-mono text-[11px] font-semibold text-slate-700">
                        {c.phone || 'Tanpa No. HP'}
                      </span>
                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold hover:bg-emerald-200 transition-colors shrink-0"
                        >
                          Chat WA
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold border ${getTierBadgeClass(c.tier)}`}>
                        {getTierIcon(c.tier)} {c.tier || 'BRONZE'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                        <Coins className="w-3 h-3 text-amber-600" />
                        <span className="font-mono">{Number(c.loyaltyPoints || 0).toLocaleString('id-ID')} pt</span>
                      </span>
                    </div>
                  </div>

                  {/* Bottom: Action buttons */}
                  <div className="flex items-center justify-end gap-1.5 pt-0.5">
                    <button
                      onClick={() => handleOpenDetail(c)}
                      className="h-9 px-3 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-blue-50 hover:text-blue-900 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detail</span>
                    </button>
                    <button
                      onClick={() => handleOpenEdit(c)}
                      className="h-9 px-3 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="w-9 h-9 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition-colors cursor-pointer flex items-center justify-center"
                      title="Hapus Pelanggan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Pelanggan */}
        {!loading && customers.length > 0 && (
          <TablePagination
            currentPage={safeCurrentPage}
            pageSize={pageSize}
            totalItems={customers.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="pelanggan"
          />
        )}
      </div>

      {/* 5. Modal Tambah / Edit Pelanggan */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
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
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain flex-1">
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
                    className="w-full h-10 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <WhatsAppInput
                    label="Nomor WhatsApp / HP"
                    placeholder="81234567890"
                    value={formData.phone || ''}
                    onChange={(val) => setFormData({ ...formData, phone: val })}
                  />

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
                        className="w-full h-10 pl-9 pr-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white"
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
                    className="w-full h-10 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white"
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
                    className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white resize-none"
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
                    className="w-full h-10 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="h-10 px-5 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 h-10 px-6 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
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
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain flex-1 space-y-5">
              {/* Kontak & Stats Row (4 Kolom Termasuk Poin) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[11px] font-bold text-slate-400 block">Total Kunjungan</span>
                  <span className="text-lg sm:text-xl font-black font-mono text-slate-900 mt-1 block">
                    {selectedCustomer.visitCount} Kali
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[11px] font-bold text-slate-400 block">Akumulasi Belanja</span>
                  <span className="text-lg sm:text-xl font-black font-mono text-slate-900 mt-1 block">
                    Rp {Number(selectedCustomer.totalSpent).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/70">
                  <span className="text-[11px] font-bold text-amber-700 block flex items-center justify-between">
                    <span>Saldo Poin Member</span>
                    <Coins className="w-3.5 h-3.5 text-amber-600" />
                  </span>
                  <span className="text-lg sm:text-xl font-black font-mono text-amber-900 mt-1 block">
                    {Number(selectedCustomer.loyaltyPoints || 0).toLocaleString('id-ID')} pt
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[11px] font-bold text-slate-400 block">Tingkatan Member</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${getTierBadgeClass(selectedCustomer.tier)}`}>
                      {getTierIcon(selectedCustomer.tier)} {selectedCustomer.tier || 'BRONZE'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tombol Aksi Sesuaikan Poin Manual */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Kelola Saldo Poin Loyalitas Pelanggan
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdjustingPoints(!isAdjustingPoints)}
                  className="h-9 px-3.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {isAdjustingPoints ? 'Tutup Form Poin' : '⚡ Sesuaikan Poin Manual'}
                </button>
              </div>

              {/* Form Penyesuaian Poin Manual (Zero Stacked Modals) */}
              {isAdjustingPoints && (
                <form onSubmit={handleSaveAdjustPoints} className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                    <h4 className="text-xs font-extrabold text-blue-950">
                      Penyesuaian Saldo Poin Manual
                    </h4>
                    <span className="text-[10px] text-slate-500 font-mono font-bold">
                      Saldo Saat Ini: {Number(selectedCustomer.loyaltyPoints || 0)} pt
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Perubahan Poin (+ Tambah / - Kurang)
                      </label>
                      <input
                        type="number"
                        placeholder="Contoh: 50 atau -20"
                        value={adjustDelta || ''}
                        onChange={(e) => setAdjustDelta(parseInt(e.target.value) || 0)}
                        className="w-full h-10 text-xs font-semibold rounded-xl border border-slate-300 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900 font-mono"
                        required
                      />
                      <span className="text-[10px] text-slate-500 block">
                        Ketik angka positif untuk menambah bonus, atau negatif untuk memotong.
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Alasan / Catatan Penyesuaian
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Hadiah Ulang Tahun / Kompensasi"
                        value={adjustNotes}
                        onChange={(e) => setAdjustNotes(e.target.value)}
                        className="w-full h-10 text-xs font-semibold rounded-xl border border-slate-300 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
                        required
                      />
                      <span className="text-[10px] text-slate-500 block">
                        Catatan audit yang akan tersimpan permanen di buku besar mutasi poin.
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAdjustingPoints(false)}
                      className="h-9 px-4 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={savingAdjust}
                      className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {savingAdjust ? 'Menyimpan...' : 'Simpan Mutasi Poin'}
                    </button>
                  </div>
                </form>
              )}

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

              {/* Tab Switcher: Riwayat Belanja vs Riwayat Mutasi Poin */}
              <div className="p-1 bg-slate-100 rounded-2xl flex items-center gap-1.5 w-fit border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setActiveDetailTab('orders')}
                  className={`flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeDetailTab === 'orders'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Riwayat Transaksi ({selectedCustomer.orders?.length || 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDetailTab('points')}
                  className={`flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeDetailTab === 'points'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Buku Besar Mutasi Poin ({pointLedgers.length})</span>
                </button>
              </div>

              {/* Tab Content 1: Riwayat Transaksi Belanja */}
              {activeDetailTab === 'orders' && (
                <div>
                  {loadingDetail ? (
                    <div className="py-8 text-center text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-900 mb-1" />
                      <span className="text-xs">Memuat histori order...</span>
                    </div>
                  ) : !selectedCustomer.orders || selectedCustomer.orders.length === 0 ? (
                    <EmptyState
                      compact
                      icon={<Receipt className="w-5 h-5 text-blue-900" />}
                      title="Belum Ada Riwayat Transaksi"
                      description="Belum ada transaksi penjualan yang tercatat atas nama pelanggan ini."
                    />
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
                                {ord.outlet?.name || 'Toko Utama'}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-500">
                                {new Date(ord.createdAt).toLocaleString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                                Rp {Number(ord.grandTotal).toLocaleString('id-ID')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content 2: Riwayat Buku Besar Mutasi Poin */}
              {activeDetailTab === 'points' && (
                <div>
                  {loadingPoints ? (
                    <div className="py-8 text-center text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-900 mb-1" />
                      <span className="text-xs">Memuat riwayat mutasi poin...</span>
                    </div>
                  ) : pointLedgers.length === 0 ? (
                    <EmptyState
                      compact
                      icon={<Award className="w-5 h-5 text-blue-900" />}
                      title="Belum Ada Mutasi Poin"
                      description="Belum ada riwayat perolehan atau penukaran poin loyalty yang tercatat."
                    />
                  ) : (
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                            <th className="py-2.5 px-3">Waktu</th>
                            <th className="py-2.5 px-3">Tipe Mutasi</th>
                            <th className="py-2.5 px-3 text-center">Perubahan</th>
                            <th className="py-2.5 px-3 text-right">Saldo Akhir</th>
                            <th className="py-2.5 px-3">Keterangan / Faktur</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pointLedgers.map((l) => {
                            const isPositive = l.deltaPoints > 0;
                            return (
                              <tr key={l.id} className="hover:bg-slate-50/50">
                                <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                                  {new Date(l.createdAt).toLocaleString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    l.type === 'EARNED_PURCHASE'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : l.type === 'REDEEMED_ORDER'
                                      ? 'bg-rose-50 text-rose-700'
                                      : 'bg-blue-50 text-blue-700'
                                  }`}>
                                    {l.type === 'EARNED_PURCHASE' ? 'Reward Belanja' : l.type === 'REDEEMED_ORDER' ? 'Tukar Diskon' : 'Penyesuaian Manual'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold">
                                  <span className={`inline-flex items-center gap-0.5 ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                    <span>{isPositive ? `+${l.deltaPoints}` : l.deltaPoints} pt</span>
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-black text-slate-800">
                                  {l.balanceAfter} pt
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {l.order?.invoiceNumber ? (
                                    <span className="font-mono font-bold text-blue-900">{l.order.invoiceNumber}</span>
                                  ) : (
                                    <span>{l.notes || '-'}</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 sm:px-6 border-t border-slate-200 bg-slate-50 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex justify-end">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="h-10 px-6 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
