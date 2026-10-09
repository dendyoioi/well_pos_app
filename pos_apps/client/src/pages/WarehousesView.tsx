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

  // Search filter
  const filteredWarehouses = warehouses.filter((wh) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      wh.name.toLowerCase().includes(q) ||
      (wh.address && wh.address.toLowerCase().includes(q)) ||
      (wh.phone && wh.phone.toLowerCase().includes(q))
    );
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

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* =========================================================================
          TOP HEADER: Judul & Aksi Tambah Gudang
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
              <Warehouse className="w-5 h-5 shrink-0" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Kelola Gudang Logistik
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Pusat penyimpanan bahan baku, penerimaan pengadaan (PO), dan pasokan otomatis ke toko cabang
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Gudang Baru</span>
        </button>
      </div>

      {/* =========================================================================
          RINGKASAN METRIK GUDANG
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Gudang Aktif */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Warehouse className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gudang Logistik Aktif</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              {activeWarehousesCount} <span className="text-sm font-semibold text-slate-400">/ {warehouses.length} Total</span>
            </p>
          </div>
        </div>

        {/* Card 2: Toko yang Disuplai */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Toko Cabang Terhubung</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              {totalStoresSupplied} <span className="text-sm font-semibold text-slate-400">/ {stores.length} Toko POS</span>
            </p>
          </div>
        </div>

        {/* Card 3: Info Rantai Pasok */}
        <div className="bg-indigo-900 text-white p-5 rounded-2xl shadow-xs flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Mode Logistik Terpadu</p>
            <p className="text-sm font-medium text-indigo-100 mt-1 leading-snug">
              Beralih ke gudang untuk mengelola stok bahan mentah &amp; penerimaan supplier.
            </p>
          </div>
          <Boxes className="w-8 h-8 text-indigo-300 shrink-0 opacity-80" />
        </div>
      </div>

      {/* =========================================================================
          PENCARIAN & TOOLBAR
          ========================================================================= */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama gudang, alamat, atau PIC..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
        <div className="text-xs font-semibold text-slate-500 self-end sm:self-center">
          Menampilkan <span className="font-bold text-slate-900">{filteredWarehouses.length}</span> Gudang Logistik
        </div>
      </div>

      {/* =========================================================================
          DAFTAR GUDANG (CARD GRID)
          ========================================================================= */}
      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3 shadow-xs">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-500">Memuat data gudang logistik...</p>
        </div>
      ) : filteredWarehouses.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Warehouse className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {searchQuery ? 'Gudang Tidak Ditemukan' : 'Belum Ada Gudang Logistik'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {searchQuery
                ? `Tidak ada gudang yang cocok dengan kata kunci "${searchQuery}".`
                : 'Buat gudang pertama Anda untuk menjadi pusat persediaan bahan baku dan menyuplai stok toko-toko cabang secara otomatis (auto-backflush).'}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Gudang Sekarang</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedWarehouses.map((wh) => {
            const isCurrentlyActive = wh.id === activeOutletId;
            const suppliedStores = stores.filter((s) => s.warehouseId === wh.id);

            return (
              <div
                key={wh.id}
                className={`bg-white rounded-3xl border transition-all flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                  isCurrentlyActive
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Bagian Atas Card */}
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                        <Warehouse className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-slate-900 text-base truncate" title={wh.name}>
                            {wh.name}
                          </h3>
                        </div>
                        <span className="inline-block text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md mt-0.5">
                          🏭 Gudang Logistik Pusat
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenEdit(wh)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                      title="Edit Gudang"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Informasi Alamat & Kontak */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">
                        {wh.address || <span className="italic text-slate-400">Belum ada alamat logistik</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{wh.phone || <span className="italic text-slate-400">Belum ada kontak PIC</span>}</span>
                    </div>
                  </div>

                  {/* Daftar Toko yang Disuplai */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Menyuplai {suppliedStores.length} Toko Cabang:</span>
                      </span>
                    </div>
                    {suppliedStores.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {suppliedStores.map((store) => (
                          <span
                            key={store.id}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700"
                          >
                            🏪 {store.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic pt-0.5">
                        Belum ada toko yang memilih gudang ini sebagai sumber pasokan.
                      </p>
                    )}
                  </div>
                </div>

                {/* Bagian Bawah: Aksi Buka Mode Gudang */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    {wh.isActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                        Nonaktif
                      </span>
                    )}
                    {isCurrentlyActive && (
                      <span className="text-[10px] font-extrabold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-full">
                        Sedang Dipilih
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => onSelectActiveOutlet(wh.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                      isCurrentlyActive
                        ? 'bg-indigo-900 text-white hover:bg-indigo-950 shadow-xs'
                        : 'bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 hover:border-indigo-300'
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
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                  <Warehouse className="w-5 h-5 shrink-0" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 text-lg">Tambah Gudang Baru</h3>
                  <p className="text-xs text-slate-500">Pusat persediaan &amp; distribusi bahan baku logistik</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="add-warehouse-form" onSubmit={handleCreateWarehouse} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {formError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Callout Panduan */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-indigo-700" />
                  <span>Karakteristik Gudang Logistik</span>
                </p>
                <p className="text-indigo-800 leading-relaxed">
                  Gudang tidak memiliki menu kasir (POS). Fungsinya murni untuk penerimaan barang dari supplier (PO), stock opname bahan mentah, serta sumber pasokan bahan baku bagi toko-toko cabang.
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
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
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
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium resize-none"
                />
              </div>
            </form>

            {/* Sticky Action Footer */}
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-end gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                form="add-warehouse-form"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
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
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                  <Warehouse className="w-5 h-5 shrink-0" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 text-lg">Edit Gudang Logistik</h3>
                  <p className="text-xs text-slate-500">{editingWarehouse.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingWarehouse(null);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="edit-warehouse-form" onSubmit={handleUpdateWarehouse} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {formError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Status Pasokan Toko Cabang */}
              {(() => {
                const suppliedStores = stores.filter((s) => s.warehouseId === editingWarehouse.id);
                return (
                  <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-indigo-700" />
                      <span>Status Pasokan Cabang</span>
                    </p>
                    <p className="text-indigo-800 leading-relaxed">
                      Gudang ini saat ini menyuplai <strong>{suppliedStores.length} toko cabang</strong>. Perubahan nama atau kontak gudang akan langsung terhubung ke seluruh mutasi dan pengadaan toko tersebut.
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
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
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
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium resize-none"
                />
              </div>

              {/* Status Aktif */}
              <div className="pt-2">
                <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-all">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded-md text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-800">Status Gudang Aktif</p>
                    <p className="text-[11px] text-slate-500">
                      Gudang aktif dapat dipilih sebagai sumber pasokan stok bahan baku oleh toko cabang.
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
                className="px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                form="edit-warehouse-form"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
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
