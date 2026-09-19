import React, { useState, useEffect } from 'react';
import {
  Store,
  Plus,
  MapPin,
  Phone,
  Users,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Sliders,
  X,
  Search,
  RefreshCw,
  Check,
  Shield,
  ArrowRight,
  ShoppingBag,
  Warehouse,
} from 'lucide-react';
import type { Outlet, OutletFee } from '../types/outlet';
import { SupervisorFeesModal } from '../components/SupervisorFeesModal';
import { api } from '../services/api';

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
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [selectedFeeOutlet, setSelectedFeeOutlet] = useState<Outlet | null>(null);
  const [previewOnDemandOutletId, setPreviewOnDemandOutletId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    isWarehouse: false,
    isActive: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      address: '',
      phone: '',
      isWarehouse: false,
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
      isWarehouse: !!outlet.isWarehouse,
      isActive: outlet.isActive,
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleCreateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Nama cabang wajib diisi');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await api.createOutlet({
        name: formData.name.trim(),
        address: formData.address.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        isWarehouse: formData.isWarehouse,
      });

      if (res.status === 'success') {
        setIsAddModalOpen(false);
        fetchOutlets();
        if (onOutletsUpdated) onOutletsUpdated();
      } else {
        setFormError(res.message || 'Gagal membuat cabang baru');
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
      setFormError('Nama cabang wajib diisi');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await api.updateOutlet(editingOutlet.id, {
        name: formData.name.trim(),
        address: formData.address.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        isWarehouse: formData.isWarehouse,
        isActive: formData.isActive,
      });

      if (res.status === 'success') {
        setIsEditModalOpen(false);
        setEditingOutlet(null);
        fetchOutlets();
        if (onOutletsUpdated) onOutletsUpdated();
      } else {
        setFormError(res.message || 'Gagal memperbarui cabang');
      }
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  const mainWarehouse = outlets.find((o) => o.isWarehouse);
  const storeOutlets = outlets.filter((o) => !o.isWarehouse);

  const filteredOutlets = storeOutlets.filter((o) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      o.name.toLowerCase().includes(q) ||
      (o.address && o.address.toLowerCase().includes(q)) ||
      (o.phone && o.phone.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold">
              <Store className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-extrabold text-blue-950 tracking-tight">
              Manajemen Cabang Toko (Multi-Outlet)
            </h2>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
              Paket PRO
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Kelola seluruh cabang usaha retail Anda dalam 1 akun owner. Setiap cabang memiliki isolasi inventori stok, riwayat transaksi, staf kasir, serta aturan biaya dan pajak dinamis.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-md shadow-blue-900/20 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Cabang Baru</span>
        </button>
      </div>

      {/* Quota & Summary Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Toko Aktif</span>
            <Store className="w-4 h-4 text-blue-900" />
          </div>
          <div className="text-2xl font-black text-blue-950">
            {storeOutlets.filter((o) => o.isActive).length} Gerai Toko
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Kuota Paket PRO: Hingga 5 Toko Terintegrasi
          </p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Staf Seluruh Cabang</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {outlets.reduce((acc, o) => acc + (o._count?.users || 0), 0)} Orang
          </div>
          <p className="text-xs text-slate-500 mt-1">Kasir, Gudang, & Supervisor terdistribusi</p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Akumulasi Transaksi</span>
            <Receipt className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-900">
            {outlets.reduce((acc, o) => acc + (o._count?.orders || 0), 0)} Pesanan
          </div>
          <p className="text-xs text-slate-500 mt-1">Faktur riil di seluruh outlet</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari cabang berdasarkan nama, alamat, atau no telepon..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white"
          />
        </div>

        <button
          type="button"
          onClick={fetchOutlets}
          title="Segarkan Data"
          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-900' : ''}`} />
        </button>
      </div>

      {/* Outlets Cards Grid */}
      {loading && outlets.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-900 mb-2" />
          <p className="text-xs font-semibold">Memuat daftar cabang outlet...</p>
        </div>
      ) : filteredOutlets.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
          <Store className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">Tidak ada cabang yang cocok</p>
          <p className="text-xs text-slate-400 mt-1">Coba kata kunci pencarian lain atau buat cabang baru.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOutlets.map((outlet) => {
            const isCurrentlyActive = outlet.id === activeOutletId;
            const fees = (outlet.feesConfig as OutletFee[]) || [];
            
            // Pisahkan biaya toko & pajak otomatis vs kemasan on-demand manual kasir
            const defaultTaxFees = fees.filter(
              (f) =>
                f.category !== 'ON_DEMAND_PACKAGING' &&
                f.id !== 'fee_box' &&
                !f.id.includes('plastic') &&
                !f.name.toLowerCase().includes('kemasan') &&
                !f.name.toLowerCase().includes('plastik') &&
                !f.name.toLowerCase().includes('paperbag')
            );
            const onDemandFees = fees.filter(
              (f) =>
                f.category === 'ON_DEMAND_PACKAGING' ||
                f.id === 'fee_box' ||
                f.id.includes('plastic') ||
                f.name.toLowerCase().includes('kemasan') ||
                f.name.toLowerCase().includes('plastik') ||
                f.name.toLowerCase().includes('paperbag')
            );

            const activeTaxFees = defaultTaxFees.filter((f) => f.isActive);
            const activeOnDemandFees = onDemandFees.filter((f) => f.isActive);

            return (
              <div
                key={outlet.id}
                className={`bg-white rounded-3xl border transition-all flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
                  isCurrentlyActive
                    ? 'border-blue-900 ring-2 ring-blue-900/10'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white shrink-0 shadow-sm ${
                          isCurrentlyActive ? 'bg-blue-900' : 'bg-slate-800'
                        }`}
                      >
                        <Store className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-blue-950 text-base leading-tight">
                            {outlet.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                              outlet.isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {outlet.isActive ? '● Toko Aktif' : '○ Nonaktif'}
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
                      className="p-1.5 rounded-xl text-slate-400 hover:text-blue-900 hover:bg-slate-100 transition-colors"
                      title="Edit Informasi Cabang"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Sumber Pasokan Gudang */}
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-indigo-50/60 p-2.5 rounded-2xl border border-indigo-100">
                    <Warehouse className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                    <span>Sumber Pasokan: <strong className="text-indigo-950 font-bold">{mainWarehouse?.name || 'Gudang Utama Pusat'}</strong></span>
                  </div>

                  {/* Address & Phone */}
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

                  {/* Quick Stat Counters */}
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="block text-xs font-black text-blue-950">
                        {outlet._count?.users || 0}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Staf Toko</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="block text-xs font-black text-blue-950">
                        {outlet._count?.outletProducts || 0}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">SKU Stok</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="block text-xs font-black text-blue-950">
                        {outlet._count?.orders || 0}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Transaksi</span>
                    </div>
                  </div>

                  {/* Active Fees Badge List: Khusus Pajak/Biaya Toko, On-Demand via Tooltip Preview */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Biaya & Pajak Toko ({activeTaxFees.length} Aktif)
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
                            title={`${f.name} (${f.type === 'PERCENTAGE' ? f.rate + '%' : 'Rp ' + f.rate.toLocaleString('id-ID')})`}
                          >
                            {f.name.split(' ')[0]}: {f.type === 'PERCENTAGE' ? `${f.rate}%` : `Rp ${f.rate}`}
                          </span>
                        ))
                      )}

                      {/* Tooltip Pill Button untuk Kemasan On-Demand */}
                      {activeOnDemandFees.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewOnDemandOutletId(
                              previewOnDemandOutletId === outlet.id ? null : outlet.id
                            )
                          }
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 cursor-pointer transition-all shadow-2xs ${
                            previewOnDemandOutletId === outlet.id
                              ? 'bg-amber-600 text-white border-amber-700'
                              : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                          }`}
                          title="Klik untuk melihat preview daftar kemasan on-demand"
                        >
                          <ShoppingBag className="w-2.5 h-2.5" />
                          <span>+{activeOnDemandFees.length} On-Demand</span>
                        </button>
                      )}
                    </div>

                    {/* Expandable Preview Box untuk Kemasan On-Demand */}
                    {previewOnDemandOutletId === outlet.id && activeOnDemandFees.length > 0 && (
                      <div className="mt-2.5 p-3 bg-slate-900 text-white rounded-2xl shadow-lg text-xs space-y-2 border border-slate-700 animate-fadeIn">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                          <span className="font-extrabold text-[11px] text-amber-400 flex items-center gap-1">
                            🛍️ Kemasan On-Demand ({activeOnDemandFees.length})
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreviewOnDemandOutletId(null)}
                            className="text-slate-400 hover:text-white cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          Biaya kemasan ini tidak otomatis, hanya ditambahkan saat kasir memilihnya di keranjang POS.
                        </p>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                          {activeOnDemandFees.map((f) => (
                            <div
                              key={f.id}
                              className="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-800/60 last:border-0"
                            >
                              <span className="text-slate-300 truncate max-w-[170px]" title={f.name}>
                                • {f.name}
                              </span>
                              <span className="font-extrabold text-amber-300 text-[10px] shrink-0">
                                Rp {f.rate.toLocaleString('id-ID')}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="pt-1.5 border-t border-slate-800 flex justify-between items-center text-[10px]">
                          <span className="text-slate-500">Manual Kasir</span>
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewOnDemandOutletId(null);
                              setSelectedFeeOutlet(outlet);
                            }}
                            className="text-blue-400 hover:text-blue-300 font-bold hover:underline cursor-pointer"
                          >
                            Kelola di SPV &rarr;
                          </button>
                        </div>
                      </div>
                    )}
                    </div>
                  </div>

                {/* Card Footer Action */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFeeOutlet(outlet)}
                    className="px-3 py-2 text-xs font-bold text-slate-700 hover:text-blue-900 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all flex items-center gap-1.5"
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
                      className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Pilih Cabang Ini</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Cabang Aktif</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Tambah Cabang Baru */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-blue-950 text-base">Tambah Cabang Baru</h3>
                <p className="text-xs text-slate-500">Buka cabang outlet baru pada toko Anda</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateOutlet} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Cabang <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Minimarket Maju Jaya - Cabang Cilandak"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-900 rounded-xl text-xs font-medium outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Lengkap Cabang
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Jl. Cilandak Barat No. 88, Jakarta Selatan"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-900 rounded-xl text-xs font-medium outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Telepon Cabang
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 021-7654321 atau 0812-3456-7890"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-900 rounded-xl text-xs font-medium outline-none"
                />
              </div>

              <div className="p-3 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-indigo-950 text-xs flex items-start gap-2.5">
                <Warehouse className="w-4 h-4 text-indigo-700 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">Pasokan Otomatis dari Gudang Utama:</span> Cabang toko baru ini secara default akan dipasok dari <strong>{mainWarehouse?.name || 'Gudang Utama Perusahaan'}</strong>. Seluruh master produk langsung siap dengan stok awal 0.
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-md shadow-blue-900/20 disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Buat Cabang Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Cabang */}
      {isEditModalOpen && editingOutlet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-blue-950 text-base">Edit Informasi Cabang</h3>
                <p className="text-xs text-slate-500">{editingOutlet.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingOutlet(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateOutlet} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Cabang <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-900 rounded-xl text-xs font-medium outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Lengkap
                </label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-900 rounded-xl text-xs font-medium outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Telepon
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-900 rounded-xl text-xs font-medium outline-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-900 focus:ring-blue-900"
                  />
                  <span>Toko Aktif dan Beroperasi</span>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingOutlet(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-md shadow-blue-900/20 disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
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
