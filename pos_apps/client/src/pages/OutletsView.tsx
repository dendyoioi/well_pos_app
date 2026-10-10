import React, { useState, useEffect } from 'react';
import {
  Store,
  Plus,
  Edit2,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Search,
  ArrowRight,
  Shield,
  Sliders,
  Warehouse,
  ShoppingBag,
  Smartphone,
  X,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { api, authStorage } from '../services/api';
import { useDialog } from '../context/DialogContext';
import { SupervisorFeesModal } from '../components/SupervisorFeesModal';
import { WhatsAppInput } from '../components/ui';
import { TablePagination } from '../components/TablePagination';
import type { Outlet, OutletFee } from '../types/outlet';

interface OutletsViewProps {
  activeOutletId?: string;
  onSelectActiveOutlet?: (outletId: string) => void;
  onOutletsUpdated?: () => void;
}

export const OutletsView: React.FC<OutletsViewProps> = ({
  activeOutletId,
  onSelectActiveOutlet,
  onOutletsUpdated,
}) => {
  const dialog = useDialog();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedStoreId, setCopiedStoreId] = useState(false);
  const [selectedFeeOutlet, setSelectedFeeOutlet] = useState<Outlet | null>(null);
  const [previewOnDemandOutletId, setPreviewOnDemandOutletId] = useState<string | null>(null);

  // Ambil storeId dari tenant aktif
  const currentUser = authStorage.getUser();
  const storeId = currentUser?.tenant?.slug || '';

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);

  // Form State (Murni untuk Toko Penjualan POS)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    warehouseId: null as string | null,
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchOutlets = async () => {
    setLoading(true);
    try {
      const res = await api.getOutlets();
      if (res.status === 'success' && res.data) {
        setOutlets(res.data);
      }
    } catch (err) {
      console.error('Gagal memuat daftar outlet:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutlets();
  }, []);

  // Filter murni toko penjualan & daftar gudang logistik untuk pilihan pasokan
  const stores = outlets.filter((o) => !o.isWarehouse);
  const warehouses = outlets.filter((o) => !!o.isWarehouse);

  const handleOpenAdd = () => {
    const defaultWh = warehouses.find((w) => w.isActive);
    setFormData({
      name: '',
      address: '',
      phone: '',
      warehouseId: defaultWh?.id || null,
      isActive: true,
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (outlet: Outlet) => {
    setEditingOutlet(outlet);
    setFormData({
      name: outlet.name,
      address: outlet.address || '',
      phone: outlet.phone || '',
      warehouseId: outlet.warehouseId || null,
      isActive: outlet.isActive,
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleCreateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Nama toko wajib diisi');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await api.createOutlet({
        name: formData.name.trim(),
        address: formData.address.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        isWarehouse: false,
        warehouseId: formData.warehouseId || null,
      } as any);

      if (res.status === 'success') {
        setIsAddModalOpen(false);
        await fetchOutlets();
        if (onOutletsUpdated) onOutletsUpdated();
        dialog.toast('Toko baru berhasil dibuat!', 'success');
      } else {
        setFormError(res.message || 'Gagal membuat toko baru');
      }
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOutlet) return;
    if (!formData.name.trim()) {
      setFormError('Nama toko wajib diisi');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await api.updateOutlet(editingOutlet.id, {
        name: formData.name.trim(),
        address: formData.address.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        isWarehouse: false,
        warehouseId: formData.warehouseId || null,
        isActive: formData.isActive,
      } as any);

      if (res.status === 'success') {
        setIsEditModalOpen(false);
        setEditingOutlet(null);
        await fetchOutlets();
        if (onOutletsUpdated) onOutletsUpdated();
        dialog.toast('Data toko berhasil diperbarui!', 'success');
      } else {
        setFormError(res.message || 'Gagal memperbarui data toko');
      }
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyStoreId = () => {
    if (!storeId) return;
    navigator.clipboard.writeText(storeId);
    setCopiedStoreId(true);
    setTimeout(() => setCopiedStoreId(false), 2000);
  };

  // Filter status aktif/nonaktif
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const filteredStores = stores.filter((s) => {
    if (statusFilter === 'ACTIVE' && !s.isActive) return false;
    if (statusFilter === 'INACTIVE' && s.isActive) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.address && s.address.toLowerCase().includes(q)) ||
      (s.phone && s.phone.toLowerCase().includes(q))
    );
  });

  const paginatedStores = filteredStores.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6 pb-28 sm:pb-16 font-sans animate-fadeIn">
      {/* =========================================================================
          HEADER BANNER
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 min-w-0 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold shrink-0">
              <Store className="w-4 h-4 shrink-0" />
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-blue-950 tracking-tight">
              Manajemen Outlet Toko
            </h2>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200 shrink-0">
              Paket PRO
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Kelola seluruh outlet toko kasir penjualan fisik &amp; meja makan Anda. Setiap outlet toko memiliki isolasi kasir POS, QR menu, dan pengaturan pasokan bahan baku.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="w-full sm:w-auto h-10 px-5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Outlet Toko</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          KONEKSI MESIN KASIR POS (DEVICE PAIRING)
          ========================================================================= */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-3xl p-5 sm:p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-extrabold uppercase tracking-wider">
              Koneksi Mesin Kasir POS
            </span>
            <span className="text-xs text-blue-200 font-medium">ID Toko Resmi Bisnis</span>
          </div>
          <div className="flex items-center gap-3 pt-0.5">
            <h2 className="text-2xl sm:text-3xl font-mono font-black tracking-wider text-amber-300">
              {storeId || 'BELUM DIATUR'}
            </h2>
            {storeId && (
              <button
                type="button"
                onClick={handleCopyStoreId}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer text-white"
                title="Salin ID Toko"
              >
                {copiedStoreId ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin ID Toko</span>
                  </>
                )}
              </button>
            )}
          </div>
          <p className="text-xs text-blue-100/90 leading-relaxed pt-0.5">
            Gunakan <strong>ID Toko</strong> ini bersama <strong>PIN Pemilik / Supervisor (123456)</strong> saat pertama kali menghubungkan mesin kasir tablet atau laptop ke toko ini.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl p-4 text-xs text-blue-100 max-w-sm shrink-0 space-y-1">
          <div className="font-bold text-white flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-amber-300 shrink-0" />
            <span>Alur Sambung Kasir</span>
          </div>
          <p className="text-[11px] text-blue-200 leading-snug">
            Buka menu <strong>Kasir POS</strong> $\rightarrow$ Masukkan <strong>ID Toko</strong> &amp; <strong>PIN</strong> $\rightarrow$ Pilih Outlet Toko. Perangkat akan terhubung otomatis tanpa perlu input ID Toko lagi.
          </p>
        </div>
      </div>

      {/* =========================================================================
          RINGKASAN METRIK TOKO PENJUALAN
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Toko Aktif */}
        <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Toko Penjualan (POS)</span>
            <Store className="w-4 h-4 text-blue-900" />
          </div>
          <div className="text-2xl font-mono font-black text-blue-950">
            {stores.filter((s) => s.isActive).length} Toko Aktif
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Dari total {stores.length} toko terdaftar
          </p>
        </div>

        {/* Card 2: Toko Terhubung Gudang Pasokan */}
        <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Disuplai Gudang Pusat</span>
            <Warehouse className="w-4 h-4 text-indigo-700" />
          </div>
          <div className="text-2xl font-mono font-black text-indigo-950">
            {stores.filter((s) => !!s.warehouseId).length} Toko
          </div>
          <p className="text-xs text-slate-500 mt-1">Bahan baku otomatis potong ke gudang (backflush)</p>
        </div>

        {/* Card 3: Toko Mandiri */}
        <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Toko Mandiri (Lokal)</span>
            <Store className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-mono font-black text-emerald-700">
            {stores.filter((s) => !s.warehouseId).length} Toko
          </div>
          <p className="text-xs text-slate-500 mt-1">Mengelola persediaan stok secara mandiri</p>
        </div>
      </div>

      {/* =========================================================================
          FILTER & PENCARIAN
          ========================================================================= */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Filter Status Aktif */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('ALL');
              setCurrentPage(1);
            }}
            className={`h-8 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center ${
              statusFilter === 'ALL'
                ? 'bg-white text-blue-950 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua ({stores.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('ACTIVE');
              setCurrentPage(1);
            }}
            className={`h-8 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center ${
              statusFilter === 'ACTIVE'
                ? 'bg-white text-emerald-800 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ● Aktif ({stores.filter((s) => s.isActive).length})
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('INACTIVE');
              setCurrentPage(1);
            }}
            className={`h-8 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center ${
              statusFilter === 'INACTIVE'
                ? 'bg-white text-rose-800 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ○ Nonaktif ({stores.filter((s) => !s.isActive).length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama toko, alamat, kontak..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 rounded-xl text-xs font-medium outline-none transition-all"
          />
        </div>
      </div>

      {/* =========================================================================
          DAFTAR KARTU TOKO PENJUALAN
          ========================================================================= */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 space-y-2">
          <div className="w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold">Memuat daftar outlet toko...</p>
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
          <Store className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">Tidak ada toko yang ditemukan</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `Tidak ditemukan toko yang sesuai dengan pencarian "${searchQuery}".`
              : 'Belum ada toko yang terdaftar. Tambahkan toko pertama Anda sekarang.'}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="mt-2 px-4 py-2 rounded-xl bg-blue-900 text-white font-bold text-xs"
            >
              Tambah Toko Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedStores.map((outlet) => {
            const isCurrentlyActive = outlet.id === activeOutletId;
            const fees = (outlet.feesConfig as OutletFee[]) || [];
            const defaultTaxFees = fees.filter(
              (f) =>
                f.category !== 'ON_DEMAND_PACKAGING' &&
                f.id !== 'fee_box' &&
                !f.id.includes('plastic') &&
                !f.name.toLowerCase().includes('kemasan') &&
                !f.name.toLowerCase().includes('plastik') &&
                !f.name.toLowerCase().includes('paperbag')
            );
            const activeOnDemandFees = fees.filter(
              (f) =>
                f.category === 'ON_DEMAND_PACKAGING' ||
                f.id === 'fee_box' ||
                f.id.includes('plastic') ||
                f.name.toLowerCase().includes('kemasan') ||
                f.name.toLowerCase().includes('plastik') ||
                f.name.toLowerCase().includes('paperbag')
            );
            const parentWarehouse = warehouses.find((w) => w.id === outlet.warehouseId);

            return (
              <div
                key={outlet.id}
                className={`bg-white rounded-3xl border transition-all flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                  isCurrentlyActive
                    ? 'border-blue-900 ring-2 ring-blue-900/10'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Header Card */}
                <div className="p-5 sm:p-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shrink-0 ${
                          isCurrentlyActive ? 'bg-blue-900' : 'bg-slate-800'
                        }`}
                      >
                        <Store className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-blue-950 text-base leading-tight">
                          {outlet.name}
                        </h3>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-800 border-blue-200">
                            🏪 Toko Kasir
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                              outlet.isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {outlet.isActive ? '● Aktif' : '○ Nonaktif'}
                          </span>
                          {isCurrentlyActive && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200 flex items-center gap-1">
                              <Check className="w-3 h-3 text-blue-900" />
                              <span>Sedang Digunakan</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(outlet)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-blue-900 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Edit Informasi Toko"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Info Sumber Pasokan Bahan Baku */}
                  <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2">
                      <Warehouse className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                      <span>
                        Pasokan:{' '}
                        <strong className="text-slate-900 font-bold">
                          {parentWarehouse ? parentWarehouse.name : 'Toko Mandiri (Lokal)'}
                        </strong>
                      </span>
                    </div>
                    {parentWarehouse ? (
                      <span className="text-[10px] font-black uppercase text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-md">
                        Auto-Backflush
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md">
                        Stok Lokal
                      </span>
                    )}
                  </div>

                  {/* Alamat & Telepon */}
                  <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <span className="truncate">{outlet.address || 'Alamat belum diatur'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{outlet.phone || 'Nomor telepon belum diatur'}</span>
                    </div>
                  </div>

                  {/* Counter Ringkas */}
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="block text-xs font-mono font-black text-blue-950">
                        {outlet._count?.users || 0}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Staf Toko</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="block text-xs font-mono font-black text-blue-950">
                        {outlet._count?.outletProducts || 0}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">SKU Menu</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="block text-xs font-mono font-black text-blue-950">
                        {outlet._count?.orders || 0}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Transaksi</span>
                    </div>
                  </div>

                  {/* Pengaturan Pajak Toko */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Biaya &amp; Pajak Toko ({defaultTaxFees.filter(f => f.isActive).length} Aktif)
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedFeeOutlet(outlet)}
                        className="text-[11px] font-bold text-blue-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Sliders className="w-3 h-3" />
                        <span>Kelola (SPV)</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {defaultTaxFees.length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">Pajak belum dikonfigurasi</span>
                      ) : (
                        defaultTaxFees.map((f) => (
                          <span
                            key={f.id}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                              f.isActive
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                            }`}
                          >
                            {f.name.split(' ')[0]}: {f.type === 'PERCENTAGE' ? `${f.rate}%` : `Rp ${f.rate}`}
                          </span>
                        ))
                      )}

                      {activeOnDemandFees.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewOnDemandOutletId(
                              previewOnDemandOutletId === outlet.id ? null : outlet.id
                            )
                          }
                          className="text-[10px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 cursor-pointer transition-all bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
                        >
                          <ShoppingBag className="w-2.5 h-2.5" />
                          <span>+{activeOnDemandFees.length} On-Demand</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer Action */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFeeOutlet(outlet)}
                    className="h-9 px-3 text-xs font-bold text-slate-700 hover:text-blue-900 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5 text-blue-900" />
                    <span>Atur Biaya SPV</span>
                  </button>

                  {!isCurrentlyActive ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectActiveOutlet) {
                          onSelectActiveOutlet(outlet.id);
                        }
                      }}
                      className="h-9 px-4 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer bg-blue-900 hover:bg-blue-800 active:scale-95"
                    >
                      <span>Pilih Toko Ini</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="h-9 px-3 text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Toko Aktif</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          PAGINATION
          ========================================================================= */}
      {filteredStores.length > 0 && (
        <TablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredStores.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize: number) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      )}

      {/* =========================================================================
          MODAL TAMBAH TOKO BARU (MURNI TOKO KASIR)
          ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 sm:px-6 sm:py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-extrabold text-blue-950 text-base">Tambah Outlet Toko</h3>
                <p className="text-xs text-slate-500">Buka outlet toko penjualan baru pada bisnis Anda</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 mx-4 mt-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateOutlet} className="flex-1 flex flex-col overflow-hidden">
              <div className="overflow-y-auto overscroll-contain flex-1 p-4 sm:p-6 space-y-3.5 pb-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Toko <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kopi Nusantara - Kemang"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 rounded-xl text-xs font-medium outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alamat Lengkap Toko
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Jl. Kemang Raya No. 45, Jakarta Selatan"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 rounded-xl text-xs font-medium outline-none resize-none transition-all"
                  />
                </div>

                <WhatsAppInput
                  label="Nomor WhatsApp / Telepon Toko"
                  value={formData.phone}
                  onChange={(val) => setFormData({ ...formData, phone: val })}
                  placeholder="81234567890"
                />

                {/* Dropdown Sumber Pasokan Stok dengan ChevronDown */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Gudang Sumber Pasokan (Backflush Warehouse)
                  </label>
                  <div className="relative">
                    <select
                      value={formData.warehouseId || ''}
                      onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value || null })}
                      className="w-full h-10 px-3.5 pr-8 appearance-none bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 rounded-xl text-xs font-medium outline-none transition-all cursor-pointer"
                    >
                      <option value="">— Toko Mandiri (Kelola Stok Lokal Sendiri) —</option>
                      {warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          🏭 {wh.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    Bahan baku menu yang diproses kasir di toko ini akan otomatis dipotong langsung ke gudang yang dipilih.
                  </p>
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-end gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 px-5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-md shadow-blue-900/20 disabled:opacity-50 cursor-pointer transition-all active:scale-95 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{submitting ? 'Menyimpan...' : 'Buat Toko Baru'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL EDIT TOKO (MURNI TOKO KASIR - LOCKED ENTITY TYPE)
          ========================================================================= */}
      {isEditModalOpen && editingOutlet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 sm:px-6 sm:py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-extrabold text-blue-950 text-base">Edit Outlet Toko</h3>
                <p className="text-xs text-slate-500">{editingOutlet.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingOutlet(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 mx-4 mt-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateOutlet} className="flex-1 flex flex-col overflow-hidden">
              <div className="overflow-y-auto overscroll-contain flex-1 p-4 sm:p-6 space-y-3.5 pb-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Toko <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 rounded-xl text-xs font-medium outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alamat Lengkap Toko
                  </label>
                  <textarea
                    rows={2}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 rounded-xl text-xs font-medium outline-none resize-none transition-all"
                  />
                </div>

                <WhatsAppInput
                  label="Nomor WhatsApp / Telepon"
                  value={formData.phone}
                  onChange={(val) => setFormData({ ...formData, phone: val })}
                  placeholder="81234567890"
                />

                {/* Dropdown Sumber Pasokan Gudang dengan ChevronDown */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Gudang Sumber Pasokan (Backflush Warehouse)
                  </label>
                  <div className="relative">
                    <select
                      value={formData.warehouseId || ''}
                      onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value || null })}
                      className="w-full h-10 px-3.5 pr-8 appearance-none bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 rounded-xl text-xs font-medium outline-none transition-all cursor-pointer"
                    >
                      <option value="">— Toko Mandiri (Kelola Stok Lokal Sendiri) —</option>
                      {warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          🏭 {wh.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    Bahan baku menu yang diproses kasir di toko ini akan otomatis dipotong langsung ke gudang yang dipilih.
                  </p>
                </div>

                {/* Status Operasional Toko (Canonical Pill Toggle Switch) */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div className="pr-3">
                    <span className="text-xs font-bold text-slate-900 block">Status Operasional Toko</span>
                    <span className="text-[11px] text-slate-500">Toko aktif dapat melayani kasir POS dan transaksi pesanan</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${formData.isActive ? 'text-blue-900' : 'text-slate-400'}`}>
                      {formData.isActive ? 'Aktif' : 'Off'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.isActive}
                      onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        formData.isActive ? 'bg-blue-900' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          formData.isActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-end gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingOutlet(null);
                  }}
                  className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 px-5 rounded-xl text-white font-extrabold text-xs shadow-md bg-blue-900 hover:bg-blue-800 shadow-blue-900/20 disabled:opacity-50 cursor-pointer transition-all active:scale-95 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{submitting ? 'Menyimpan...' : 'Simpan Perubahan Toko'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Atur Biaya Toko & Pajak Supervisor */}
      {selectedFeeOutlet && (
        <SupervisorFeesModal
          isOpen={true}
          onClose={() => setSelectedFeeOutlet(null)}
          outlet={selectedFeeOutlet}
          currentUserRole="ADMIN"
          onSaved={() => {
            fetchOutlets();
            if (onOutletsUpdated) onOutletsUpdated();
          }}
        />
      )}
    </div>
  );
};
