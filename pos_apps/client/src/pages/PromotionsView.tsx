import React, { useState, useEffect } from 'react';
import {
  Tag,
  Plus,
  Search,
  RefreshCw,
  Users,
  Copy,
  Check,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import type { Promotion, PromotionFormData } from '../types/promotion';
import { formatRupiah } from '../utils/currency';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { ConfirmModal } from '../components/ConfirmModal';
import { TablePagination } from '../components/TablePagination';
import { useDialog } from '../context/DialogContext';

export const PromotionsView: React.FC = () => {
  const dialog = useDialog();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState<PromotionFormData>({
    code: '',
    name: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minOrderAmount: 0,
    maxDiscountAmount: null,
    usageLimit: null,
    perCustomerLimit: 1,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    isActive: true,
  });

  // Delete Confirmation State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingPromotion, setDeletingPromotion] = useState<Promotion | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const res = await api.getPromotions();
      if (res.status === 'success' && res.data) {
        if (Array.isArray(res.data)) {
          setPromotions(res.data);
        } else if (Array.isArray((res.data as any).promotions)) {
          setPromotions((res.data as any).promotions);
        }
      }
    } catch (err) {
      console.error('Gagal mengambil daftar promosi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleOpenCreateModal = () => {
    setEditingPromotion(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderAmount: 0,
      maxDiscountAmount: null,
      usageLimit: null,
      perCustomerLimit: 1,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      isActive: true,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (promo: Promotion) => {
    setEditingPromotion(promo);
    setFormData({
      code: promo.code,
      name: promo.name,
      description: promo.description || '',
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      minOrderAmount: promo.minOrderAmount || 0,
      maxDiscountAmount: promo.maxDiscountAmount || null,
      usageLimit: promo.usageLimit || null,
      perCustomerLimit: promo.perCustomerLimit || 1,
      startDate: promo.startDate ? promo.startDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      endDate: promo.endDate ? promo.endDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      isActive: promo.isActive,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSavePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      setFormError('Kode voucher wajib diisi.');
      return;
    }
    if (!formData.name.trim()) {
      setFormError('Nama program promo wajib diisi.');
      return;
    }
    if (formData.discountValue <= 0) {
      setFormError('Nilai diskon harus lebih besar dari 0.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...formData,
        code: formData.code.toUpperCase().trim(),
        discountValue: Number(formData.discountValue),
        minOrderAmount: Number(formData.minOrderAmount || 0),
        maxDiscountAmount: formData.maxDiscountAmount ? Number(formData.maxDiscountAmount) : null,
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
        perCustomerLimit: Number(formData.perCustomerLimit || 1),
      };

      if (editingPromotion) {
        const res = await api.updatePromotion(editingPromotion.id, payload);
        if (res.status === 'success') {
          setModalOpen(false);
          fetchPromotions();
        } else {
          setFormError(res.message || 'Gagal memperbarui voucher promo.');
        }
      } else {
        const res = await api.createPromotion(payload);
        if (res.status === 'success') {
          setModalOpen(false);
          fetchPromotions();
        } else {
          setFormError(res.message || 'Gagal membuat voucher promo.');
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan saat menyimpan promosi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePromotion = async () => {
    if (!deletingPromotion) return;
    setDeleting(true);
    try {
      const res = await api.deletePromotion(deletingPromotion.id);
      if (res.status === 'success') {
        setDeleteConfirmOpen(false);
        setDeletingPromotion(null);
        fetchPromotions();
        dialog.toast('Promo berhasil dihapus', 'success');
      } else {
        dialog.alert({
          title: 'Gagal Menghapus Promo',
          message: res.message || 'Gagal menghapus promo.',
          variant: 'danger',
        });
      }
    } catch (err: any) {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: err.message || 'Gagal menghapus promo.',
        variant: 'danger',
      });
    } finally {
      setDeleting(false);
    }
  };

  const filteredPromotions = promotions.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      p.code.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q));

    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && p.isActive) ||
      (statusFilter === 'INACTIVE' && !p.isActive);

    return matchSearch && matchStatus;
  });

  // Reset pagination ke halaman 1 saat filter atau pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPromotions.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedPromotions = filteredPromotions.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const activeCount = promotions.filter((p) => p.isActive).length;
  const totalUsed = promotions.reduce((acc, curr) => acc + (curr.usedCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-900" />
            <span>Promosi &amp; Voucher Diskon Toko</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Rancang strategi promosi resto &amp; kafe: diskon persen (%), potongan nominal kasir, minimum belanja, dan batas kuota voucher.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchPromotions}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-900' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-900/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Promo Baru</span>
          </button>
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Voucher</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{promotions.length} Promo</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Program diskon dibuat</p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Promo Aktif Saat Ini</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-700">{activeCount} Promo</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Dapat diklaim kasir / pelanggan</p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Terpakai</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{totalUsed} Kali</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Akumulasi klaim transaksi lunas</p>
        </div>
      </div>

      {/* Toolbar Filter & Search */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode voucher, nama promo..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all outline-hidden"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full sm:w-auto py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-blue-900 outline-hidden cursor-pointer"
          >
            <option value="ALL">Semua Status ({promotions.length})</option>
            <option value="ACTIVE">Aktif Saja ({activeCount})</option>
            <option value="INACTIVE">Nonaktif Saja ({promotions.length - activeCount})</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 font-semibold self-end sm:self-auto">
          Menampilkan {filteredPromotions.length} dari {promotions.length} voucher
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200 tracking-wider">
              <tr>
                <th className="px-5 py-3.5 pl-6">Kode Voucher</th>
                <th className="px-4 py-3.5">Program Promosi</th>
                <th className="px-4 py-3.5 text-center">Tipe &amp; Diskon</th>
                <th className="px-4 py-3.5 text-right">Min. Belanja</th>
                <th className="px-4 py-3.5 text-center">Pemakaian</th>
                <th className="px-4 py-3.5 text-center">Periode Berlaku</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 pr-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
                      <span>Memuat program promosi...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPromotions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <Tag className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-700">Tidak ada voucher ditemukan</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {promotions.length === 0
                        ? 'Buat voucher diskon pertama untuk meningkatkan penjualan toko Anda.'
                        : 'Sesuaikan filter status atau kata kunci pencarian.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedPromotions.map((promo) => (
                  <tr key={promo.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 pl-6 font-mono font-bold text-xs">
                      <button
                        type="button"
                        onClick={() => handleCopyCode(promo.code)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-950 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                        title="Klik untuk salin kode"
                      >
                        <span>{promo.code}</span>
                        {copiedCode === promo.code ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-400" />
                        )}
                      </button>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="font-extrabold text-slate-900 text-sm block">
                        {promo.name}
                      </span>
                      {promo.description && (
                        <span className="text-[11px] text-slate-400 line-clamp-1">
                          {promo.description}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      {promo.discountType === 'PERCENTAGE' ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-black">
                            Diskon {promo.discountValue}%
                          </span>
                          {promo.maxDiscountAmount && (
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              Maks {formatRupiah(promo.maxDiscountAmount)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black">
                          Potongan {formatRupiah(promo.discountValue)}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right font-bold text-slate-700">
                      {promo.minOrderAmount > 0 ? formatRupiah(promo.minOrderAmount) : 'Tanpa Min.'}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span className="font-extrabold text-slate-900 text-xs">
                        {promo.usedCount}
                      </span>
                      <span className="text-slate-400 text-xs">
                        {promo.usageLimit ? ` / ${promo.usageLimit}` : ' (Unlimited)'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-center text-[11px] text-slate-500 font-semibold">
                      <div>{promo.startDate ? promo.startDate.slice(0, 10) : '-'}</div>
                      <div className="text-slate-400 text-[10px]">s.d {promo.endDate ? promo.endDate.slice(0, 10) : '-'}</div>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      {promo.isActive ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          Aktif
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold">
                          Nonaktif
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 pr-6 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(promo)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                          title="Edit Voucher"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingPromotion(promo);
                            setDeleteConfirmOpen(true);
                          }}
                          className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                          title="Hapus Voucher"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Promosi */}
        {!loading && filteredPromotions.length > 0 && (
          <TablePagination
            currentPage={safeCurrentPage}
            pageSize={pageSize}
            totalItems={filteredPromotions.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="voucher"
          />
        )}
      </div>

      {/* Modal Buat / Edit Promo */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-900" />
                <span>{editingPromotion ? 'Ubah Voucher Diskon' : 'Buat Program Voucher Diskon'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePromotion} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kode Voucher <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="DISKON10"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold uppercase focus:bg-white focus:border-blue-900 outline-hidden"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Program Promo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: Diskon Pelanggan Baru 10%"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-blue-900 outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipe Diskon
                  </label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-blue-900 outline-hidden cursor-pointer"
                  >
                    <option value="PERCENTAGE">Persentase (%)</option>
                    <option value="FIXED_AMOUNT">Potongan Nominal (Rp)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Besaran Diskon <span className="text-rose-500">*</span>
                  </label>
                  {formData.discountType === 'PERCENTAGE' ? (
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={formData.discountValue}
                        onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                        placeholder="10"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-blue-900 outline-hidden"
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        %
                      </span>
                    </div>
                  ) : (
                    <CurrencyInput
                      value={formData.discountValue}
                      onChange={(val) => setFormData({ ...formData, discountValue: val })}
                      placeholder="Contoh: 10.000"
                    />
                  )}
                </div>
              </div>

              {formData.discountType === 'PERCENTAGE' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Maksimal Nilai Diskon (Opsional)
                  </label>
                  <CurrencyInput
                    value={formData.maxDiscountAmount || 0}
                    onChange={(val) => setFormData({ ...formData, maxDiscountAmount: val > 0 ? val : null })}
                    placeholder="Kosongkan jika tanpa batas maksimal diskon"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Minimal Belanja (Rp)
                  </label>
                  <CurrencyInput
                    value={formData.minOrderAmount || 0}
                    onChange={(val) => setFormData({ ...formData, minOrderAmount: val })}
                    placeholder="0 = Tanpa minimal belanja"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Batas Kuota Pemakaian
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.usageLimit || ''}
                    onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value ? parseInt(e.target.value, 10) : null })}
                    placeholder="Kosong = Unlimited"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-900 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mulai Berlaku
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-900 outline-hidden cursor-pointer"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Berakhir Pada
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-900 outline-hidden cursor-pointer"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="promoIsActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded-sm border-slate-300 text-blue-900 focus:ring-blue-900 cursor-pointer"
                />
                <label htmlFor="promoIsActive" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Voucher promo ini aktif dan dapat digunakan di kasir
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-900 hover:bg-blue-800 active:scale-95 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-900/20 cursor-pointer flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Voucher</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Hapus Voucher Promo"
        message={`Apakah Anda yakin ingin menghapus voucher "${deletingPromotion?.code}"? Voucher ini tidak akan dapat digunakan lagi.`}
        confirmText="Ya, Hapus Voucher"
        cancelText="Batal"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeletePromotion}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeletingPromotion(null);
        }}
      />
    </div>
  );
};
