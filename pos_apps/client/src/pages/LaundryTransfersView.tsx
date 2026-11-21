import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  Printer,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowRight,
  Building2,
  Clock,
  PackageCheck,
  Send,
} from 'lucide-react';
import type { Outlet } from '../types/outlet';
import { api } from '../services/api';
import type { LaundryTransferManifest, AvailableOrderForManifest } from '../types/laundry';

interface LaundryTransfersViewProps {
  activeOutlet: Outlet | null;
}

export const LaundryTransfersView: React.FC<LaundryTransfersViewProps> = ({ activeOutlet }) => {
  const [manifests, setManifests] = useState<LaundryTransferManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabFilter, setTabFilter] = useState<'ALL' | 'TO_WORKSHOP' | 'TO_OUTLET'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [workshops, setWorkshops] = useState<Outlet[]>([]);

  // Modal State Buat Manifest Baru
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [direction, setDirection] = useState<'TO_WORKSHOP' | 'TO_OUTLET'>('TO_WORKSHOP');
  const [targetOutletId, setTargetOutletId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [notes, setNotes] = useState('');
  const [availableOrders, setAvailableOrders] = useState<AvailableOrderForManifest[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [submittingManifest, setSubmittingManifest] = useState(false);

  // Modal State Cetak Surat Jalan
  const [selectedManifestForPrint, setSelectedManifestForPrint] = useState<LaundryTransferManifest | null>(null);

  // State Konfirmasi Terima
  const [receiverName, setReceiverName] = useState('');
  const [manifestToReceive, setManifestToReceive] = useState<LaundryTransferManifest | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchManifests = async () => {
    try {
      setLoading(true);
      const res = await api.getLaundryManifests();
      if (res.status === 'success' && Array.isArray(res.data)) {
        setManifests(res.data);
      }
    } catch {
      showToast('Gagal memuat daftar surat jalan manifest', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkshops = async () => {
    try {
      const res = await api.getLaundryWorkshops();
      if (res.status === 'success' && Array.isArray(res.data)) {
        setWorkshops(res.data);
      }
    } catch {
      // Abaikan
    }
  };

  useEffect(() => {
    fetchManifests();
    fetchWorkshops();
  }, [activeOutlet?.id]);

  // Load order yang siap dikirim saat modal create dibuka atau arah berganti
  useEffect(() => {
    if (!showCreateModal || !activeOutlet?.id) return;

    const loadOrders = async () => {
      try {
        setLoadingOrders(true);
        setSelectedOrderIds([]);
        const res = await api.getAvailableOrdersForManifest(activeOutlet.id, direction);
        if (res.status === 'success' && Array.isArray(res.data)) {
          setAvailableOrders(res.data);
          // Default pilih semua pesanan yang tersedia
          setSelectedOrderIds(res.data.map((o: AvailableOrderForManifest) => o.orderId));
        }
      } catch {
        showToast('Gagal memuat daftar cucian yang siap dikirim', 'error');
      } finally {
        setLoadingOrders(false);
      }
    };

    loadOrders();
  }, [showCreateModal, direction, activeOutlet?.id]);

  // Set default target outlet saat workshop list siap
  useEffect(() => {
    if (workshops.length > 0 && !targetOutletId) {
      const otherOutlets = workshops.filter((w) => w.id !== activeOutlet?.id);
      const preferred = otherOutlets.find((w) => w.isWorkshop) || otherOutlets[0];
      if (preferred) setTargetOutletId(preferred.id);
    }
  }, [workshops, activeOutlet?.id]);

  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleSelectAllOrders = () => {
    if (selectedOrderIds.length === availableOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(availableOrders.map((o) => o.orderId));
    }
  };

  const handleCreateManifestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOutlet?.id || !targetOutletId) {
      showToast('Pilih outlet pengirim dan tujuan yang valid', 'error');
      return;
    }
    if (selectedOrderIds.length === 0) {
      showToast('Pilih minimal 1 nota cucian untuk dimasukkan ke surat jalan', 'error');
      return;
    }

    try {
      setSubmittingManifest(true);
      const payload = {
        sourceOutletId: activeOutlet.id,
        targetOutletId,
        direction,
        driverName: driverName.trim() || undefined,
        vehiclePlate: vehiclePlate.trim() || undefined,
        notes: notes.trim() || undefined,
        orderIds: selectedOrderIds,
      };

      const res = await api.createLaundryManifest(payload);
      if (res.status === 'success') {
        showToast(`Surat jalan ${res.data.manifestNumber} berhasil diterbitkan!`);
        setShowCreateModal(false);
        setDriverName('');
        setVehiclePlate('');
        setNotes('');
        setSelectedOrderIds([]);
        fetchManifests();
        // Langsung tampilkan modal cetak surat jalan
        setSelectedManifestForPrint(res.data);
      } else {
        showToast(res.message || 'Gagal membuat surat jalan', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat membuat manifest', 'error');
    } finally {
      setSubmittingManifest(false);
    }
  };

  const handleConfirmReceive = async () => {
    if (!manifestToReceive) return;
    try {
      const res = await api.receiveLaundryManifest(manifestToReceive.id, {
        receivedBy: receiverName.trim() || undefined,
      });
      if (res.status === 'success') {
        showToast(res.message || 'Surat jalan berhasil dikonfirmasi diterima!');
        setManifestToReceive(null);
        setReceiverName('');
        fetchManifests();
      } else {
        showToast(res.message || 'Gagal mengonfirmasi penerimaan', 'error');
      }
    } catch {
      showToast('Terjadi gangguan jaringan saat konfirmasi penerimaan', 'error');
    }
  };

  // Filter list manifest
  const filteredManifests = manifests.filter((m) => {
    if (tabFilter !== 'ALL' && m.direction !== tabFilter) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchNumber = m.manifestNumber.toLowerCase().includes(query);
      const matchDriver = m.driverName?.toLowerCase().includes(query);
      const matchVehicle = m.vehiclePlate?.toLowerCase().includes(query);
      const matchSource = m.sourceOutlet?.name.toLowerCase().includes(query);
      const matchTarget = m.targetOutlet?.name.toLowerCase().includes(query);
      return matchNumber || matchDriver || matchVehicle || matchSource || matchTarget;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Surat Jalan &amp; Workshop Terpusat
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Mutasi cucian kotor ke workshop dan pengiriman cucian bersih kembali ke outlet
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeOutlet && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-700">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Toko Aktif: {activeOutlet.name}</span>
              {activeOutlet.isWorkshop ? (
                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px]">
                  Mode Workshop
                </span>
              ) : (
                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px]">
                  Outlet Toko
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Surat Jalan</span>
          </button>
        </div>
      </div>

      {/* Toolbar Pencarian & Tab Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Tab Filter Direction */}
        <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setTabFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tabFilter === 'ALL'
                ? 'bg-blue-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua Manifest ({manifests.length})
          </button>
          <button
            type="button"
            onClick={() => setTabFilter('TO_WORKSHOP')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              tabFilter === 'TO_WORKSHOP'
                ? 'bg-blue-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Kirim ke Workshop</span>
          </button>
          <button
            type="button"
            onClick={() => setTabFilter('TO_OUTLET')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              tabFilter === 'TO_OUTLET'
                ? 'bg-blue-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Balik ke Outlet</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari No. Manifest, Toko, atau Driver..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-900 font-medium bg-white"
          />
        </div>
      </div>

      {/* Tabel Manifest Surat Jalan */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            Memuat daftar surat jalan manifest...
          </div>
        ) : filteredManifests.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Truck className="w-10 h-10 mx-auto text-slate-300 mb-2 opacity-50" />
            <p className="text-xs font-bold text-slate-600">Belum ada surat jalan manifest</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Klik &quot;Buat Surat Jalan&quot; untuk mengirimkan kumpulan cucian kotor ke sentral workshop.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-600">
                  <th className="py-3 px-4">No. Manifest</th>
                  <th className="py-3 px-4">Rute Pengiriman</th>
                  <th className="py-3 px-4">Muatan Cucian</th>
                  <th className="py-3 px-4">Kurir &amp; Armada</th>
                  <th className="py-3 px-4">Status &amp; Waktu</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredManifests.map((m) => {
                  const isReceived = m.status === 'RECEIVED';
                  const isToWorkshop = m.direction === 'TO_WORKSHOP';

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{m.manifestNumber}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(m.dispatchedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="text-slate-900">{m.sourceOutlet?.name}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="text-slate-900">{m.targetOutlet?.name}</span>
                        </div>
                        <span
                          className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isToWorkshop
                              ? 'bg-amber-50 text-amber-900 border border-amber-200'
                              : 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                          }`}
                        >
                          {isToWorkshop ? 'Cucian Kotor (Ke Workshop)' : 'Cucian Bersih (Ke Toko)'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{m.totalOrdersCount} Nota Pesanan</div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {m.totalWeightKg ? `${Number(m.totalWeightKg).toFixed(2)} Kg Total` : 'Satuan / Helai'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{m.driverName || 'Kurir Toko'}</div>
                        {m.vehiclePlate && (
                          <div className="text-[10px] font-mono text-slate-500">{m.vehiclePlate}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {isReceived ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Selesai Diterima</span>
                            </span>
                            <div className="text-[10px] text-slate-400">
                              Oleh: <span className="text-slate-700 font-semibold">{m.receivedBy || 'Staf'}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                            <Truck className="w-3 h-3 text-amber-600" />
                            <span>Dalam Pengiriman</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Tombol Cetak Surat Jalan */}
                          <button
                            type="button"
                            onClick={() => setSelectedManifestForPrint(m)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-900 hover:bg-slate-100 transition-colors"
                            title="Cetak Surat Jalan Manifest"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Tombol Konfirmasi Terima jika status masih DISPATCHED */}
                          {!isReceived && (
                            <button
                              type="button"
                              onClick={() => {
                                setManifestToReceive(m);
                                setReceiverName('');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Konfirmasi Cucian Telah Tiba &amp; Diterima"
                            >
                              <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Terima</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Terbitkan Surat Jalan Baru (Manifest Drop-off ke Workshop) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Terbitkan Surat Jalan Manifest</h3>
                  <p className="text-xs text-slate-500">Mutasi pengiriman cucian antar-toko / workshop</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManifestSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1">
                {/* 1. Arah Pengiriman */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Arah Pengiriman
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDirection('TO_WORKSHOP')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        direction === 'TO_WORKSHOP'
                          ? 'border-blue-900 bg-blue-50/50 text-blue-950 ring-1 ring-blue-900'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">Kirim ke Workshop</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Cucian kotor dari toko untuk dicuci</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection('TO_OUTLET')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        direction === 'TO_OUTLET'
                          ? 'border-blue-900 bg-blue-50/50 text-blue-950 ring-1 ring-blue-900'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">Kirim Balik ke Toko</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Cucian bersih untuk siap diambil</div>
                    </button>
                  </div>
                </div>

                {/* 2. Rute Toko Asal & Tujuan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Toko / Lokasi Asal (Pengirim)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={activeOutlet?.name || 'Toko Aktif'}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tujuan ({direction === 'TO_WORKSHOP' ? 'Workshop Pabrik' : 'Toko Cabang'}) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={targetOutletId}
                      onChange={(e) => setTargetOutletId(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-900"
                    >
                      {workshops
                        .filter((w) => w.id !== activeOutlet?.id)
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} {w.isWorkshop ? '(Pusat Workshop)' : '(Outlet Toko)'}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* 3. Driver & Kendaraan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Kurir / Driver
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Pak Joko (Kurir Internal)"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-900 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      No. Polisi / Kendaraan
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: B 1234 XYZ (Grand Max)"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-900 font-medium font-mono"
                    />
                  </div>
                </div>

                {/* 4. Daftar Nota Cucian yang Tersedia untuk Dikirim */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-700">
                      Pilih Nota Cucian ({selectedOrderIds.length} dari {availableOrders.length} terpilih)
                    </label>
                    {availableOrders.length > 0 && (
                      <button
                        type="button"
                        onClick={toggleSelectAllOrders}
                        className="text-[11px] font-bold text-blue-900 hover:underline"
                      >
                        {selectedOrderIds.length === availableOrders.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
                      </button>
                    )}
                  </div>

                  {loadingOrders ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Memuat daftar cucian...
                    </div>
                  ) : availableOrders.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                      Tidak ada pesanan cucian yang siap dikirim saat ini.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-52 overflow-y-auto">
                      {availableOrders.map((ord) => {
                        const isChecked = selectedOrderIds.includes(ord.orderId);
                        return (
                          <div
                            key={ord.orderId}
                            onClick={() => toggleSelectOrder(ord.orderId)}
                            className={`p-2.5 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                              isChecked ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}} // dikontrol oleh container onClick
                                className="rounded text-blue-900 focus:ring-blue-900"
                              />
                              <div>
                                <div className="font-bold text-slate-900">
                                  #{ord.invoiceNumber} — {ord.customerName}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {ord.serviceName} • {ord.totalWeightKg ? `${ord.totalWeightKg} Kg` : `${ord.totalPieces} Pcs`}
                                </div>
                              </div>
                            </div>

                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              {ord.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Catatan Tambahan */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Pengiriman (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Harap diprioritaskan paket Express"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-900 font-medium"
                  />
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingManifest || selectedOrderIds.length === 0}
                  className="px-5 py-2 text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white rounded-xl shadow-xs disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingManifest ? 'Menerbitkan...' : `Terbitkan Manifest (${selectedOrderIds.length})`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Penerimaan Surat Jalan */}
      {manifestToReceive && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 flex flex-col space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                <PackageCheck className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Konfirmasi Penerimaan Cucian</h3>
                <p className="text-xs text-slate-500">Manifest: {manifestToReceive.manifestNumber}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Rute:</span>
                <span className="font-bold text-slate-800">
                  {manifestToReceive.sourceOutlet?.name} &rarr; {manifestToReceive.targetOutlet?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jumlah Nota:</span>
                <span className="font-bold text-slate-800">{manifestToReceive.totalOrdersCount} Nota</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Driver:</span>
                <span className="font-bold text-slate-800">{manifestToReceive.driverName || 'Kurir Toko'}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Staf Penerima
              </label>
              <input
                type="text"
                placeholder="Masukkan nama staf yang menerima cucian"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-900 font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setManifestToReceive(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReceive}
                className="px-5 py-2 text-xs font-bold bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Konfirmasi Diterima</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cetak Surat Jalan Manifest */}
      {selectedManifestForPrint && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-900" />
                <h3 className="font-bold text-slate-900 text-sm">Dokumen Surat Jalan Manifest</h3>
              </div>
              <button
                onClick={() => setSelectedManifestForPrint(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Area Pratinjau Surat Jalan Resmi */}
            <div className="p-6 overflow-y-auto flex-1 font-sans text-xs bg-white text-slate-900 space-y-4">
              {/* Header Dokumen */}
              <div className="border-b-2 border-slate-900 pb-3 text-center">
                <h2 className="text-base font-black tracking-wide uppercase">
                  {selectedManifestForPrint.sourceOutlet?.name || 'WELL POS LAUNDRY'}
                </h2>
                <p className="text-[11px] text-slate-600">SURAT JALAN PENGIRIMAN CUCIAN ANTAR-CABANG</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  No. Dokumen: <span className="font-mono font-bold text-slate-900">{selectedManifestForPrint.manifestNumber}</span>
                </p>
              </div>

              {/* Data Meta Surat Jalan */}
              <div className="grid grid-cols-2 gap-4 text-[11px]">
                <div className="space-y-1">
                  <div>
                    <span className="text-slate-500">Toko Pengirim: </span>
                    <span className="font-bold">{selectedManifestForPrint.sourceOutlet?.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Tujuan: </span>
                    <span className="font-bold">{selectedManifestForPrint.targetOutlet?.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Jenis: </span>
                    <span className="font-bold">
                      {selectedManifestForPrint.direction === 'TO_WORKSHOP' ? 'Cucian Kotor (Workshop)' : 'Cucian Bersih (Outlet)'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 text-right">
                  <div>
                    <span className="text-slate-500">Tanggal: </span>
                    <span className="font-bold">{new Date(selectedManifestForPrint.dispatchedAt).toLocaleString('id-ID')}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Driver / Kurir: </span>
                    <span className="font-bold">{selectedManifestForPrint.driverName || 'Staf Internal'}</span>
                  </div>
                  {selectedManifestForPrint.vehiclePlate && (
                    <div>
                      <span className="text-slate-500">No. Kendaraan: </span>
                      <span className="font-mono font-bold">{selectedManifestForPrint.vehiclePlate}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Rincian Nota Cucian */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">No</th>
                      <th className="py-2 px-3">No. Nota</th>
                      <th className="py-2 px-3">Pelanggan</th>
                      <th className="py-2 px-3">Layanan</th>
                      <th className="py-2 px-3 text-right">Berat / Pcs</th>
                      <th className="py-2 px-3 text-center">Cek</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedManifestForPrint.items?.map((it, idx) => (
                      <tr key={it.id}>
                        <td className="py-2 px-3">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold">#{it.order?.invoiceNumber}</td>
                        <td className="py-2 px-3">{it.order?.customer?.name || 'Walk-In'}</td>
                        <td className="py-2 px-3">{it.order?.items?.[0]?.productName || 'Laundry'}</td>
                        <td className="py-2 px-3 text-right font-medium">
                          {it.order?.laundryDetail?.totalWeightKg
                            ? `${Number(it.order.laundryDetail.totalWeightKg).toFixed(2)} Kg`
                            : `${it.order?.laundryDetail?.totalPieces || 0} Pcs`}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="w-4 h-4 border border-slate-400 rounded-sm mx-auto" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                    <tr>
                      <td colSpan={4} className="py-2 px-3 text-right">
                        Total Muatan:
                      </td>
                      <td className="py-2 px-3 text-right">
                        {selectedManifestForPrint.totalWeightKg
                          ? `${Number(selectedManifestForPrint.totalWeightKg).toFixed(2)} Kg`
                          : `${selectedManifestForPrint.totalOrdersCount} Nota`}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Kolom Tanda Tangan */}
              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-[10px]">
                <div className="space-y-12">
                  <p className="font-semibold text-slate-600">Diserahkan Oleh (Driver/Staf Asal)</p>
                  <p className="font-bold underline text-slate-800">
                    ( {selectedManifestForPrint.driverName || 'Staf Pengirim'} )
                  </p>
                </div>
                <div className="space-y-12">
                  <p className="font-semibold text-slate-600">Diterima Oleh (Staf Workshop/Toko)</p>
                  <p className="font-bold underline text-slate-800">
                    ( {selectedManifestForPrint.receivedBy || '................................'} )
                  </p>
                </div>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedManifestForPrint(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Dokumen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Feedback Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-fadeIn transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
              : 'bg-rose-950 text-rose-100 border-rose-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};
