import React, { useState, useEffect } from 'react';
import { Archive, Plus, Search, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import type { Outlet } from '../types/outlet';
import { api } from '../services/api';
import type { LaundryRack } from '../types/laundry';

interface LaundryRacksViewProps {
  activeOutlet: Outlet | null;
}

const INITIAL_MOCK_RACKS: LaundryRack[] = [
  {
    id: 'rack-01',
    outletId: '',
    code: 'RAK-A1',
    name: 'Rak Kiloan Reguler A1',
    category: 'KILOAN',
    capacity: 10,
    currentCount: 8,
    locationNote: 'Lantai 1 - Sebelah Kasir',
    isActive: true,
    activeOrders: [
      { orderId: '1', orderNumber: 'LD-241101-002', customerName: 'Siti Aminah', totalPieces: 14, totalWeightKg: 4.8, status: 'READY_FOR_PICKUP', paymentStatus: 'PAID', readyAt: 'Hari ini 15:00' },
      { orderId: '2', orderNumber: 'LD-241101-007', customerName: 'Budi Hartono', totalPieces: 9, totalWeightKg: 3.2, status: 'READY_FOR_PICKUP', paymentStatus: 'UNPAID', readyAt: 'Kemarin' },
    ]
  },
  {
    id: 'rack-02',
    outletId: '',
    code: 'RAK-A2',
    name: 'Rak Kiloan Reguler A2',
    category: 'KILOAN',
    capacity: 10,
    currentCount: 4,
    locationNote: 'Lantai 1 - Sebelah Rak A1',
    isActive: true,
    activeOrders: [
      { orderId: '3', orderNumber: 'LD-241101-011', customerName: 'Rina Wijaya', totalPieces: 7, totalWeightKg: 2.5, status: 'READY_FOR_PICKUP', paymentStatus: 'PARTIALLY_PAID', readyAt: 'Besok 10:00' },
    ]
  },
  {
    id: 'rack-03',
    outletId: '',
    code: 'RAK-B1',
    name: 'Hanger Satuan & Jas B1',
    category: 'SATUAN',
    capacity: 15,
    currentCount: 5,
    locationNote: 'Gantungan Khusus Jas & Gaun',
    isActive: true,
    activeOrders: [
      { orderId: '4', orderNumber: 'LD-241101-005', customerName: 'Dra. Maya', totalPieces: 2, status: 'READY_FOR_PICKUP', paymentStatus: 'PAID', readyAt: 'Hari ini 18:00' },
    ]
  },
  {
    id: 'rack-04',
    outletId: '',
    code: 'RAK-EXP',
    name: 'Slot Khusus Kilat (Express)',
    category: 'EXPRESS',
    capacity: 6,
    currentCount: 5,
    locationNote: 'Area Meja Pengemasan Depan',
    isActive: true,
    activeOrders: [
      { orderId: '5', orderNumber: 'LD-241101-019', customerName: 'David Lee', totalPieces: 6, totalWeightKg: 2.1, status: 'READY_FOR_PICKUP', paymentStatus: 'PAID', readyAt: 'Hari ini 12:30' },
    ]
  },
  {
    id: 'rack-05',
    outletId: '',
    code: 'RAK-S1',
    name: 'Rak Sepatu & Tas S1',
    category: 'SEPATU_TAS',
    capacity: 8,
    currentCount: 0,
    locationNote: 'Lantai 2 - Ruang Treatment',
    isActive: true,
    activeOrders: []
  }
];

export const LaundryRacksView: React.FC<LaundryRacksViewProps> = ({ activeOutlet }) => {
  const [racks, setRacks] = useState<LaundryRack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRack, setSelectedRack] = useState<LaundryRack | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<'KILOAN' | 'SATUAN' | 'EXPRESS' | 'SEPATU_TAS'>('KILOAN');
  const [formCapacity, setFormCapacity] = useState('10');
  const [formLocation, setFormLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRacks = async () => {
    try {
      setLoading(true);
      const res = await api.getLaundryRacks(activeOutlet?.id);
      if (res.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
        setRacks(res.data);
        setSelectedRack(res.data[0]);
      } else {
        setRacks(INITIAL_MOCK_RACKS);
        setSelectedRack(INITIAL_MOCK_RACKS[0]);
      }
    } catch {
      setRacks(INITIAL_MOCK_RACKS);
      setSelectedRack(INITIAL_MOCK_RACKS[0]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRacks();
  }, [activeOutlet?.id]);

  const filteredRacks = racks.filter((rack) => {
    const matchesCategory = selectedCategory === 'ALL' || rack.category === selectedCategory;
    const matchesSearch = rack.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          rack.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (rack.locationNote && rack.locationNote.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleAddRack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formName.trim() || !activeOutlet?.id) return;

    try {
      setSaving(true);
      const payload = {
        outletId: activeOutlet.id,
        code: formCode.toUpperCase().trim(),
        name: formName.trim(),
        category: formCategory,
        capacity: parseInt(formCapacity, 10) || 10,
        locationNote: formLocation.trim() || undefined,
      };

      const res = await api.createLaundryRack(payload);
      if (res.status === 'success') {
        await fetchRacks();
        setShowAddModal(false);
        setFormCode('');
        setFormName('');
        setFormCapacity('10');
        setFormLocation('');
      } else {
        alert(res.message || 'Gagal mendaftarkan rak');
      }
    } catch {
      alert('Terjadi kesalahan saat mendaftarkan rak baru');
    } finally {
      setSaving(false);
    }
  };

  const getOccupancyColor = (current: number, capacity: number) => {
    const ratio = capacity > 0 ? current / capacity : 0;
    if (ratio >= 0.9) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (ratio >= 0.6) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  return (
    <div className="space-y-6">
      {/* Header View */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Manajemen Rak & Titik Simpan</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                Laundry Ready-To-Pickup
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Atur alokasi nomor rak penyimpanan cucian siap ambil di {activeOutlet?.name || 'Toko Ini'}.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Tambah Rak Baru
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'Semua Rak' },
            { id: 'KILOAN', label: 'Cucian Kiloan' },
            { id: 'SATUAN', label: 'Dry Clean & Satuan' },
            { id: 'EXPRESS', label: 'Cepat / Express' },
            { id: 'SEPATU_TAS', label: 'Sepatu & Tas' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari kode rak, nama, lokasi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Master Grid & Detail Side-Panel */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs font-semibold animate-pulse">
          Memuat data rak penyimpanan...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kolom Kiri: Kartu-kartu Rak */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredRacks.map((rack) => {
              const current = rack.currentCount || 0;
              const isSelected = selectedRack?.id === rack.id;
              const occupancyRatio = rack.capacity > 0 ? (current / rack.capacity) * 100 : 0;
              return (
                <div
                  key={rack.id}
                  onClick={() => setSelectedRack(rack)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50/50 border-blue-500 shadow-sm ring-1 ring-blue-500'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg font-mono font-bold text-sm bg-slate-900 text-white">
                        {rack.code}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                        {rack.category}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${getOccupancyColor(current, rack.capacity)}`}>
                      {current} / {rack.capacity} Slot
                    </span>
                  </div>

                  <h3 className="font-semibold text-slate-900 text-sm mb-1">{rack.name}</h3>
                  {rack.locationNote && (
                    <p className="text-xs text-slate-500 mb-3">{rack.locationNote}</p>
                  )}

                  {/* Progress Bar Okupansi */}
                  <div className="mt-2">
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          occupancyRatio >= 90 ? 'bg-rose-500' : occupancyRatio >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, occupancyRatio)}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
                      <span>Terisi {Math.round(occupancyRatio)}%</span>
                      <span>Sisa {Math.max(0, rack.capacity - current)} slot kosong</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredRacks.length === 0 && (
              <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200 p-6">
                <Archive className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">Tidak ada rak yang sesuai filter</p>
                <p className="text-xs text-slate-400 mt-1">Ganti kata kunci pencarian atau tambah rak baru</p>
              </div>
            )}
          </div>

          {/* Kolom Kanan: Rincian Isi Rak Terpilih */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col h-full">
            {selectedRack ? (
              <>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-base text-blue-600">{selectedRack.code}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {selectedRack.category}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-1">{selectedRack.name}</h4>
                    <p className="text-xs text-slate-500">{selectedRack.locationNote || 'Lokasi umum'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-slate-900">{selectedRack.currentCount || 0} <span className="text-xs font-normal text-slate-500">/ {selectedRack.capacity}</span></div>
                    <div className="text-[11px] text-slate-400">Kapasitas Rak</div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Daftar Nota di Rak Ini ({selectedRack.activeOrders?.length || 0})
                  </div>

                  {selectedRack.activeOrders && selectedRack.activeOrders.length > 0 ? (
                    selectedRack.activeOrders.map((order, idx) => (
                      <div key={idx} className="p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/70 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-xs font-bold text-slate-900">{order.orderNumber}</span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Siap Ambil
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-800">{order.customerName}</div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                          <span>{order.totalPieces} potong {order.totalWeightKg ? `(${order.totalWeightKg} kg)` : ''}</span>
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <Clock className="w-3 h-3" /> {order.readyAt || 'Siap'}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                      <p className="text-xs font-medium text-slate-600">Rak ini sedang kosong</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Siap digunakan saat cucian selesai dipacking</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 py-12 text-center text-slate-400">
                <AlertCircle className="w-8 h-8 mb-2" />
                <p className="text-xs">Pilih salah satu rak di sebelah kiri untuk melihat rincian nota yang tersimpan.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Tambah Rak (SOP Mobile & Sticky Footer) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Tambah Rak Penyimpanan</h3>
                  <p className="text-xs text-slate-500">Buat slot atau hanger baru untuk cucian siap ambil</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddRack} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode Rak / Hanger <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: RAK-A3, HGR-02, SP-01"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 uppercase font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama / Label Rak <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Rak Kiloan Reguler A3"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori Rak
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="KILOAN">Cucian Kiloan (Plastik / Bag)</option>
                    <option value="SATUAN">Hanger Dry Clean & Satuan</option>
                    <option value="EXPRESS">Express / Kilat</option>
                    <option value="SEPATU_TAS">Sepatu, Tas & Helm</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kapasitas Maksimal (Kantong / Hanger)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Lokasi Fisik
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Lantai 1 dekat pintu keluar"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Sticky Action Footer (SOP PWA iPhone safe-area) */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Rak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
