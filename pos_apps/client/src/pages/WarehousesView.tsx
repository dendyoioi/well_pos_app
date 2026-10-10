import React, { useState, useEffect } from 'react';
import {
  Warehouse,
  Plus,
  Search,
  MapPin,
  Phone,
  Edit2,
  AlertCircle,
  X,
  Store,
  Boxes,
  ArrowRight,
  LayoutGrid,
  List,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';
import { WhatsAppInput } from '../components/ui';
import { TablePagination } from '../components/TablePagination';
import type { Outlet } from '../types/outlet';

interface WarehousesViewProps {
  activeOutletId?: string;
  onSelectActiveOutlet: (outletId: string) => void;
  onWarehousesUpdated?: () => void;
}

export const WarehousesView: React.FC<WarehousesViewProps> = ({
  activeOutletId,
  onSelectActiveOutlet,
  onWarehousesUpdated,
}) => {
  const dialog = useDialog();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Outlet | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
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
      console.error('Gagal memuat data gudang & outlet:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutlets();
  }, []);

  // Filter khusus gudang
  const warehouses = outlets.filter((o) => !!o.isWarehouse);
  const stores = outlets.filter((o) => !o.isWarehouse);

  // Search & Status filter
  const filteredWarehouses = warehouses.filter((wh) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      wh.name.toLowerCase().includes(q) ||
      (wh.address && wh.address.toLowerCase().includes(q)) ||
      (wh.phone && wh.phone.toLowerCase().includes(q));

    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && wh.isActive) ||
      (statusFilter === 'INACTIVE' && !wh.isActive);

    return matchSearch && matchStatus;
  });

  const paginatedWarehouses = filteredWarehouses.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      address: '',
      phone: '',
      isActive: true,
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (wh: Outlet) => {
    setEditingWarehouse(wh);
    setFormData({
      name: wh.name,
      address: wh.address || '',
      phone: wh.phone || '',
      isActive: wh.isActive,
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Nama gudang logistik wajib diisi');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await api.createOutlet({
        name: formData.name.trim(),
        address: formData.address.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        isWarehouse: true,
        warehouseId: null,
      } as any);

      if (res.status === 'success') {
        setIsAddModalOpen(false);
        await fetchOutlets();
        if (onWarehousesUpdated) onWarehousesUpdated();
        dialog.toast('Gudang logistik baru berhasil dibuat!', 'success');
      } else {
        setFormError(res.message || 'Gagal membuat gudang');
      }
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse) return;

    if (!formData.name.trim()) {
      setFormError('Nama gudang wajib diisi');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await api.updateOutlet(editingWarehouse.id, {
        name: formData.name.trim(),
        address: formData.address.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        isWarehouse: true,
        warehouseId: null,
        isActive: formData.isActive,
      } as any);

      if (res.status === 'success') {
        setIsEditModalOpen(false);
        setEditingWarehouse(null);
        await fetchOutlets();
        if (onWarehousesUpdated) onWarehousesUpdated();
        dialog.toast('Data gudang berhasil diperbarui!', 'success');
      } else {
        setFormError(res.message || 'Gagal memperbarui gudang');
      }
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  const activeWarehousesCount = warehouses.filter((w) => w.isActive).length;
  const totalStoresSupplied = stores.filter((s) => s.warehouseId).length;
  const currentSelectedWarehouse = warehouses.find((w) => w.id === activeOutletId);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-28 sm:pb-12 space-y-5 sm:space-y-6 animate-fade-in">
      {/* =========================================================================
          TOP HEADER: Judul & Aksi Tambah Gudang (Kanonikal Navy Blue Well POS)
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900 shrink-0">
              <Warehouse className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Kelola Gudang Logistik
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium line-clamp-1 sm:line-clamp-none">
                Pusat penyimpanan bahan baku, penerimaan pengadaan (PO), dan pasokan otomatis ke seluruh toko / outlet
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-blue-900 hover:bg-blue-950 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-950/20 transition-all cursor-pointer shrink-0 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Tambah Gudang Baru</span>
        </button>
      </div>

      {/* =========================================================================
          RINGKASAN METRIK GUDANG (3 KPI CARDS SIMETRIS & PROPORSIONAL)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Card 1: Total Gudang Aktif */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5 sm:gap-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 flex items-center justify-center shrink-0">
            <Warehouse className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Gudang Logistik Aktif</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-black text-slate-900 tracking-tight">{activeWarehousesCount}</span>
              <span className="font-mono text-xs font-semibold text-slate-400">/ {warehouses.length} Total</span>
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">Fasilitas penyimpanan terdaftar</p>
          </div>
        </div>

        {/* Card 2: Toko yang Disuplai */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5 sm:gap-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Store className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Toko / Outlet Terhubung</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-black text-slate-900 tracking-tight">{totalStoresSupplied}</span>
              <span className="font-mono text-xs font-semibold text-slate-400">/ {stores.length} Toko POS</span>
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">Menerima pasokan &amp; auto-backflush</p>
          </div>
        </div>

        {/* Card 3: Sesi Mode Gudang Saat Ini */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5 sm:gap-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Boxes className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status Mode Sesi</p>
            {currentSelectedWarehouse ? (
              <div className="mt-1 min-w-0">
                <p className="font-mono text-base font-black text-slate-900 truncate tracking-tight">
                  {currentSelectedWarehouse.name}
                </p>
                <p className="text-[11px] font-bold text-blue-900 flex items-center gap-1 mt-0.5 truncate">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-900 shrink-0" />
                  <span>Mode Gudang Sedang Aktif</span>
                </p>
              </div>
            ) : (
              <div className="mt-1 min-w-0">
                <p className="text-sm sm:text-base font-bold text-slate-700 truncate">
                  Mode Toko POS Kasir
                </p>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">
                  Pilih gudang untuk masuk logistik
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          TOOLBAR: PENCARIAN, FILTER STATUS & TOGGLE VIEW
          ========================================================================= */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-2xl">
          {/* Input Search */}
          <div className="relative flex-1 w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama gudang, alamat, PIC..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 pl-10 pr-4 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Filter Status dengan Custom Chevron Proporsional */}
          <div className="relative w-full sm:w-52">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full h-10 pl-3.5 pr-9 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 transition-all text-slate-700 cursor-pointer appearance-none"
            >
              <option value="ALL">Semua Status Gudang</option>
              <option value="ACTIVE">Gudang Aktif Saja</option>
              <option value="INACTIVE">Gudang Nonaktif Saja</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Info Total & Toggle View */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
          <div className="text-xs font-semibold text-slate-500">
            Menampilkan <span className="font-mono font-bold text-slate-900">{filteredWarehouses.length}</span> Gudang
          </div>

          <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-blue-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Tampilan Grid Kartu"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-blue-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Tampilan Tabel Ringkas"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          DAFTAR GUDANG (CARD GRID vs TABEL RINGKAS)
          ========================================================================= */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
          <div className="w-10 h-10 border-4 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Memuat data gudang logistik...</p>
        </div>
      ) : filteredWarehouses.length === 0 ? (
        <div className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-200 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-blue-50 text-blue-900 flex items-center justify-center mx-auto">
            <Warehouse className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {searchQuery || statusFilter !== 'ALL' ? 'Gudang Tidak Ditemukan' : 'Belum Ada Gudang Logistik'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {searchQuery || statusFilter !== 'ALL'
                ? 'Tidak ada gudang yang cocok dengan kriteria pencarian atau filter yang dipilih.'
                : 'Buat gudang pertama Anda untuk menjadi pusat persediaan bahan baku dan menyuplai stok toko / outlet secara otomatis (auto-backflush).'}
            </p>
          </div>
          {!searchQuery && statusFilter === 'ALL' && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Gudang Sekarang</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* MODE 1: GRID KARTU */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {paginatedWarehouses.map((wh) => {
            const isCurrentlyActive = wh.id === activeOutletId;
            const suppliedStores = stores.filter((s) => s.warehouseId === wh.id);

            return (
              <div
                key={wh.id}
                className={`bg-white rounded-2xl border transition-all flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                  isCurrentlyActive
                    ? 'border-blue-900 ring-2 ring-blue-900/10'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Bagian Atas Card */}
                <div className="p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 flex items-center justify-center shrink-0">
                        <Warehouse className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-black text-slate-900 text-sm sm:text-base truncate" title={wh.name}>
                          {wh.name}
                        </h3>
                        <span className="inline-block text-[10px] font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md mt-0.5">
                          🏭 Gudang Logistik Pusat
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenEdit(wh)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-900 hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
                      title="Edit Gudang"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Informasi Alamat & Kontak */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">
                        {wh.address || <span className="italic text-slate-400">Belum ada alamat logistik</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-mono">{wh.phone || <span className="italic text-slate-400 font-sans">Belum ada kontak PIC</span>}</span>
                    </div>
                  </div>

                  {/* Daftar Toko yang Disuplai */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-blue-900" />
                        <span>Menyuplai {suppliedStores.length} Toko / Outlet:</span>
                      </span>
                    </div>
                    {suppliedStores.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {suppliedStores.map((store) => (
                          <span
                            key={store.id}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700"
                          >
                            🏪 {store.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic pt-0.5">
                        Belum ada toko / outlet yang memilih gudang ini sebagai sumber pasokan.
                      </p>
                    )}
                  </div>
                </div>

                {/* Bagian Bawah: Aksi Buka Mode Gudang */}
                <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                  <div className="flex items-center gap-1.5">
                    {wh.isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-200 px-2.5 py-1 rounded-full">
                        Nonaktif
                      </span>
                    )}
                    {isCurrentlyActive && (
                      <span className="text-[10px] font-extrabold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                        Sedang Dipilih
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => onSelectActiveOutlet(wh.id)}
                    className={`inline-flex items-center justify-center gap-1.5 h-9 sm:h-8 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer w-full sm:w-auto ${
                      isCurrentlyActive
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'bg-white hover:bg-blue-50 text-blue-900 border border-blue-200 hover:border-blue-900/30 shadow-2xs'
                    }`}
                  >
                    <span>{isCurrentlyActive ? 'Buka Mode Gudang' : 'Pilih & Buka Gudang'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* MODE 2: TABEL RINGKAS KANONIKAL */
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table className="min-w-[1050px] w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Gudang Logistik</th>
                <th className="py-3.5 px-4">Alamat Fisik</th>
                <th className="py-3.5 px-4">Kontak PIC WhatsApp</th>
                <th className="py-3.5 px-4">Toko / Outlet Terhubung</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Mode Sesi</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedWarehouses.map((wh) => {
                const isCurrentlyActive = wh.id === activeOutletId;
                const suppliedStores = stores.filter((s) => s.warehouseId === wh.id);

                return (
                  <tr
                    key={wh.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isCurrentlyActive ? 'bg-blue-50/30' : ''
                    }`}
                  >
                    {/* Nama Gudang */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 flex items-center justify-center shrink-0">
                          <Warehouse className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{wh.name}</p>
                          <span className="text-[10px] font-semibold text-blue-900">
                            Pusat Logistik
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Alamat Fisik */}
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {wh.address ? (
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate" title={wh.address}>{wh.address}</span>
                        </div>
                      ) : (
                        <span className="italic text-slate-400">-</span>
                      )}
                    </td>

                    {/* Kontak PIC */}
                    <td className="py-3 px-4 text-slate-600 font-mono">
                      {wh.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{wh.phone}</span>
                        </div>
                      ) : (
                        <span className="italic text-slate-400 font-sans">-</span>
                      )}
                    </td>

                    {/* Pasokan Toko */}
                    <td className="py-3 px-4">
                      {suppliedStores.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                          {suppliedStores.slice(0, 2).map((s) => (
                            <span
                              key={s.id}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700"
                            >
                              🏪 {s.name}
                            </span>
                          ))}
                          {suppliedStores.length > 2 && (
                            <span className="text-[10px] font-bold text-slate-500">
                              +{suppliedStores.length - 2} lainnya
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Belum ada toko</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      {wh.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-200 px-2.5 py-1 rounded-full">
                          Nonaktif
                        </span>
                      )}
                    </td>

                    {/* Mode Sesi */}
                    <td className="py-3 px-4 text-center">
                      {isCurrentlyActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-blue-900" />
                          Aktif Digunakan
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">Tersedia</span>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(wh)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-900 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Edit Gudang"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onSelectActiveOutlet(wh.id)}
                          className={`inline-flex items-center gap-1 h-8 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                            isCurrentlyActive
                              ? 'bg-blue-900 text-white shadow-2xs'
                              : 'bg-white hover:bg-blue-50 text-blue-900 border border-blue-200 hover:border-blue-900/30 shadow-2xs'
                          }`}
                        >
                          <span>{isCurrentlyActive ? 'Buka' : 'Pilih'}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* =========================================================================
          PAGINATION
          ========================================================================= */}
      {filteredWarehouses.length > 0 && (
        <TablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredWarehouses.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize: number) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      )}

      {/* =========================================================================
          MODAL TAMBAH GUDANG BARU (RESPONSIF BOTTOM-SHEET & STICKY ACTION FOOTER)
          ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 flex items-center justify-center shrink-0">
                  <Warehouse className="w-5 h-5 shrink-0" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 text-base sm:text-lg">Tambah Gudang Baru</h3>
                  <p className="text-xs text-slate-500">Pusat persediaan &amp; distribusi bahan baku logistik</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="add-warehouse-form" onSubmit={handleCreateWarehouse} className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Callout Panduan */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-blue-900">
                  <Boxes className="w-4 h-4 text-blue-900" />
                  <span>Karakteristik Gudang Logistik</span>
                </p>
                <p className="text-blue-900/90 leading-relaxed">
                  Gudang tidak memiliki menu kasir (POS). Fungsinya murni untuk penerimaan barang dari supplier (PO), stock opname bahan mentah, serta sumber pasokan bahan baku bagi seluruh toko / outlet.
                </p>
              </div>

              {/* Input Nama Gudang */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>Nama Gudang Logistik</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Gudang Logistik Pusat Jakarta"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-10 px-4 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Input WhatsApp PIC Gudang */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>Nomor WhatsApp / PIC Gudang</span>
                </label>
                <WhatsAppInput
                  value={formData.phone}
                  onChange={(val) => setFormData({ ...formData, phone: val })}
                  placeholder="81234567890"
                />
                <p className="text-[10px] text-slate-400">Untuk koordinasi pengiriman bahan baku dan notifikasi PO vendor.</p>
              </div>

              {/* Input Alamat Gudang */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Alamat Fisik Gudang</label>
                <textarea
                  rows={3}
                  placeholder="Contoh: Kawasan Industri Pergudangan Blok C No. 12, Cakung, Jakarta Timur"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-3 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 transition-all placeholder:text-slate-400 resize-none"
                />
              </div>
            </form>

            {/* Sticky Action Footer */}
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-end gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 sm:flex-none h-11 sm:h-10 px-4 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-100 transition-all cursor-pointer inline-flex items-center justify-center"
              >
                Batal
              </button>
              <button
                type="submit"
                form="add-warehouse-form"
                disabled={submitting}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-5 rounded-xl bg-blue-900 hover:bg-blue-950 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-blue-950/20 transition-all cursor-pointer"
              >
                {submitting ? 'Menyimpan...' : 'Buat Gudang Baru'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL EDIT GUDANG (RESPONSIF BOTTOM-SHEET & STICKY ACTION FOOTER)
          ========================================================================= */}
      {isEditModalOpen && editingWarehouse && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 flex items-center justify-center shrink-0">
                  <Warehouse className="w-5 h-5 shrink-0" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 text-base sm:text-lg">Edit Gudang Logistik</h3>
                  <p className="text-xs text-slate-500 truncate">{editingWarehouse.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingWarehouse(null);
                }}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="edit-warehouse-form" onSubmit={handleUpdateWarehouse} className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Status Pasokan Toko / Outlet */}
              {(() => {
                const suppliedStores = stores.filter((s) => s.warehouseId === editingWarehouse.id);
                return (
                  <div className="p-3.5 sm:p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-950 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-blue-900">
                      <Store className="w-4 h-4 text-blue-900" />
                      <span>Status Pasokan Toko / Outlet</span>
                    </p>
                    <p className="text-blue-900/90 leading-relaxed">
                      Gudang ini saat ini menyuplai <strong>{suppliedStores.length} toko / outlet</strong>. Perubahan nama atau kontak gudang akan langsung terhubung ke seluruh mutasi dan pengadaan toko tersebut.
                    </p>
                  </div>
                );
              })()}

              {/* Input Nama Gudang */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>Nama Gudang</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-10 px-4 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 transition-all font-medium"
                />
              </div>

              {/* Input WhatsApp PIC Gudang */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Nomor WhatsApp / PIC Gudang</label>
                <WhatsAppInput
                  value={formData.phone}
                  onChange={(val) => setFormData({ ...formData, phone: val })}
                  placeholder="81234567890"
                />
              </div>

              {/* Input Alamat Gudang */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Alamat Fisik Gudang</label>
                <textarea
                  rows={3}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-3 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 transition-all font-medium resize-none"
                />
              </div>

              {/* Status Aktif */}
              <div className="pt-2">
                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-all">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-900 focus:ring-blue-900"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-800">Status Gudang Aktif</p>
                    <p className="text-[11px] text-slate-500">
                      Gudang aktif dapat dipilih sebagai sumber pasokan stok bahan baku oleh toko / outlet.
                    </p>
                  </div>
                </label>
              </div>
            </form>

            {/* Sticky Action Footer */}
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-end gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingWarehouse(null);
                }}
                className="flex-1 sm:flex-none h-11 sm:h-10 px-4 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-100 transition-all cursor-pointer inline-flex items-center justify-center"
              >
                Batal
              </button>
              <button
                type="submit"
                form="edit-warehouse-form"
                disabled={submitting}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-5 rounded-xl bg-blue-900 hover:bg-blue-950 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-blue-950/20 transition-all cursor-pointer"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Perubahan Gudang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
