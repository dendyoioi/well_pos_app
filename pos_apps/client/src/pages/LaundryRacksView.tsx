import React, { useState, useEffect, useMemo } from 'react';
import {
  Archive,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  Send,
  Bell,
  X,
  RefreshCw,
} from 'lucide-react';
import type { Outlet } from '../types/outlet';
import { api } from '../services/api';
import type { LaundryRack, LaundryAutoReminderResult } from '../types/laundry';

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
      {
        orderId: '1',
        orderNumber: 'LD-241101-002',
        customerName: 'Siti Aminah',
        customerPhone: '081234567890',
        totalPieces: 14,
        totalWeightKg: 4.8,
        status: 'READY_FOR_PICKUP',
        paymentStatus: 'PAID',
        readyAt: new Date(Date.now() - 9 * 86400000).toISOString(),
      },
      {
        orderId: '2',
        orderNumber: 'LD-241101-007',
        customerName: 'Budi Hartono',
        customerPhone: '081298765432',
        totalPieces: 9,
        totalWeightKg: 3.2,
        status: 'READY_FOR_PICKUP',
        paymentStatus: 'UNPAID',
        remainingAmount: 45000,
        readyAt: new Date(Date.now() - 16 * 86400000).toISOString(),
      },
    ],
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
      {
        orderId: '3',
        orderNumber: 'LD-241101-011',
        customerName: 'Rina Wijaya',
        customerPhone: '081311223344',
        totalPieces: 7,
        totalWeightKg: 2.5,
        status: 'READY_FOR_PICKUP',
        paymentStatus: 'PARTIALLY_PAID',
        remainingAmount: 20000,
        readyAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
    ],
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
      {
        orderId: '4',
        orderNumber: 'LD-241101-005',
        customerName: 'Dra. Maya',
        customerPhone: '081255667788',
        totalPieces: 2,
        status: 'READY_FOR_PICKUP',
        paymentStatus: 'PAID',
        readyAt: new Date(Date.now() - 8 * 86400000).toISOString(),
      },
    ],
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
      {
        orderId: '5',
        orderNumber: 'LD-241101-019',
        customerName: 'David Lee',
        customerPhone: '081900112233',
        totalPieces: 6,
        totalWeightKg: 2.1,
        status: 'READY_FOR_PICKUP',
        paymentStatus: 'PAID',
        readyAt: new Date().toISOString(),
      },
    ],
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
    activeOrders: [],
  },
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

  // Auto-Reminder WhatsApp Modal State (P2)
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderSubmitting, setReminderSubmitting] = useState(false);
  const [reminderTab, setReminderTab] = useState<'STALE_RACK' | 'EXPIRING_WALLET'>('STALE_RACK');
  const [reminderData, setReminderData] = useState<LaundryAutoReminderResult | null>(null);
  const [reminderToast, setReminderToast] = useState<string | null>(null);

  const handleOpenReminderModal = async () => {
    setShowReminderModal(true);
    setReminderLoading(true);
    try {
      const res = await api.runLaundryAutoReminders({
        outletId: activeOutlet?.id,
        dryRun: true,
      });
      if (res.status === 'success' && res.data) {
        setReminderData(res.data);
      }
    } catch (err) {
      console.error('Error fetching auto reminders preview:', err);
    } finally {
      setReminderLoading(false);
    }
  };

  const handleExecuteReminders = async () => {
    if (!activeOutlet?.id) return;
    setReminderSubmitting(true);
    try {
      const res = await api.runLaundryAutoReminders({
        outletId: activeOutlet.id,
        dryRun: false,
      });
      if (res.status === 'success' && res.data) {
        const totalSent = res.data.summary.sentCount;
        setReminderToast(
          `✅ Berhasil memproses ${totalSent} pengingat WhatsApp! (${res.data.summary.totalStaleRack} rak, ${res.data.summary.totalExpiringQuota} kuota expired)`
        );
        setTimeout(() => setReminderToast(null), 5000);
        setShowReminderModal(false);
        fetchRacks();
      } else {
        alert(res.message || 'Gagal mengirim pengingat otomatis');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem saat mengirim pengingat');
    } finally {
      setReminderSubmitting(false);
    }
  };

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

  const getDaysInRack = (order: any): number => {
    if (!order) return 0;
    const dateStr = order.readyAt || order.updatedAt || order.createdAt;
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      if (typeof dateStr === 'string' && dateStr.toLowerCase().includes('kemarin')) return 1;
      return 0;
    }
    const diffMs = Date.now() - d.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  const stagnantOrdersCount = useMemo(() => {
    let count = 0;
    racks.forEach((rack) => {
      (rack.activeOrders || []).forEach((order) => {
        if (getDaysInRack(order) >= 7) {
          count++;
        }
      });
    });
    return count;
  }, [racks]);

  const filteredRacks = racks.filter((rack) => {
    const matchesCategory =
      selectedCategory === 'ALL'
        ? true
        : selectedCategory === 'STAGNANT'
        ? (rack.activeOrders || []).some((o) => getDaysInRack(o) >= 7)
        : rack.category === selectedCategory;
    const matchesSearch =
      rack.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rack.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rack.locationNote && rack.locationNote.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleSendWaReminder = (order: any, rack: LaundryRack) => {
    const phoneRaw = order.customerPhone;
    if (!phoneRaw) {
      alert(`Nomor WhatsApp untuk pelanggan ${order.customerName} tidak tersedia`);
      return;
    }
    let cleanPhone = phoneRaw.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);

    const days = getDaysInRack(order);
    const remaining = Number(
      order.remainingAmount !== undefined
        ? order.remainingAmount
        : order.paymentStatus === 'PAID'
        ? 0
        : order.totalAmount || 0
    );
    const isPaid = order.paymentStatus === 'PAID' || remaining === 0;

    const paymentText = isPaid
      ? '• Status Pembayaran: *LUNAS* ✅'
      : `• Sisa Tagihan: *Rp ${remaining.toLocaleString('id-ID')}* (dapat dibayar saat ambil)`;

    const origin =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'https://wellpos.id';
    const trackingUrl = `${origin}/track/${encodeURIComponent(order.orderNumber)}`;

    const message =
      `*PENGINGAT PENGAMBILAN CUCIAN — ${(activeOutlet?.name || 'WELL LAUNDRY').toUpperCase()}*\n\n` +
      `Halo Kak *${order.customerName}*,\n` +
      `Kami informasikan bahwa cucian Anda telah selesai kami proses dan saat ini tersimpan rapi di rak kami:\n\n` +
      `📋 *DETAIL NOTA:*\n` +
      `• No. Nota     : *${order.orderNumber}*\n` +
      `• Lokasi Rak   : *${rack.code} (${rack.name})*\n` +
      `• Waktu Tunggu : *${days > 0 ? `${days} hari` : 'Siap diambil'}* di rak\n` +
      `${paymentText}\n\n` +
      `🔍 *Pantau Status & Rincian Cucian Live:*\n${trackingUrl}\n\n` +
      `Silakan kunjungi outlet kami untuk mengambil pakaian Anda.\n` +
      `Terima kasih atas kepercayaannya! ✨`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

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
    <div className="space-y-6 pb-28 sm:pb-16 font-sans">
      {/* Header View */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0 mt-0.5 sm:mt-0">
            <Archive className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">Manajemen Rak &amp; Titik Simpan</h1>
              <span className="text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700 border border-blue-200 shrink-0">
                Laundry Ready-To-Pickup
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-snug">
              Atur alokasi nomor rak penyimpanan cucian siap ambil di {activeOutlet?.name || 'Toko Ini'}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleOpenReminderModal}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-colors shadow-xs cursor-pointer active:scale-95 shrink-0"
            title="Scan & Broadcast Pengingat WhatsApp"
          >
            <Bell className="w-4 h-4 stroke-[2.5]" />
            <span>Reminder Otomatis WA</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs sm:text-sm transition-colors shadow-xs cursor-pointer active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Rak Baru</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-nowrap w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'Semua Rak' },
            { id: 'STAGNANT', label: `Mengendap > 7 Hari (${stagnantOrdersCount})` },
            { id: 'KILOAN', label: 'Cucian Kiloan' },
            { id: 'SATUAN', label: 'Dry Clean & Satuan' },
            { id: 'EXPRESS', label: 'Cepat / Express' },
            { id: 'SEPATU_TAS', label: 'Sepatu & Tas' },
          ].map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const isStagnantTab = cat.id === 'STAGNANT';
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? isStagnantTab
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-slate-900 text-white'
                    : isStagnantTab && stagnantOrdersCount > 0
                    ? 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {isStagnantTab && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari kode rak, nama, lokasi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
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
              const stagnantCount = (rack.activeOrders || []).filter((o) => getDaysInRack(o) >= 7).length;

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
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {stagnantCount > 0 && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                          <span>{stagnantCount} Mengendap</span>
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${getOccupancyColor(current, rack.capacity)}`}>
                        {current} / {rack.capacity} Slot
                      </span>
                    </div>
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
                    selectedRack.activeOrders.map((order, idx) => {
                      const days = getDaysInRack(order);
                      const isStagnantRose = days >= 14;
                      const isStagnantAmber = days >= 7;
                      const isPaid = order.paymentStatus === 'PAID';

                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-2xl border transition-all space-y-2 ${
                            isStagnantRose
                              ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-200'
                              : isStagnantAmber
                              ? 'bg-amber-50/70 border-amber-300'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-mono text-xs font-bold text-slate-900">{order.orderNumber}</span>
                            {isStagnantRose ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-800 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>Mengendap {days} Hari</span>
                              </span>
                            ) : isStagnantAmber ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Mengendap {days} Hari</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Siap Ambil</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-slate-800">{order.customerName}</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isPaid ? 'LUNAS' : 'BELUM LUNAS'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                            <span>
                              {order.totalPieces} potong {order.totalWeightKg ? `(${order.totalWeightKg} kg)` : ''}
                            </span>
                            <span className="text-slate-400">
                              {order.readyAt && !isNaN(new Date(order.readyAt).getTime())
                                ? new Date(order.readyAt).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                  })
                                : order.readyAt || 'Siap'}
                            </span>
                          </div>

                          {/* 1-Klik Tombol Ingatkan WA */}
                          <button
                            type="button"
                            onClick={() => handleSendWaReminder(order, selectedRack)}
                            className="w-full mt-1 min-h-[36px] py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-emerald-300 transition-all cursor-pointer active:scale-95"
                            title="Kirim pesan WhatsApp pengingat pengambilan cucian"
                          >
                            <Send className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Ingatkan WA</span>
                          </button>
                        </div>
                      );
                    })
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
                  <div className="relative">
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as any)}
                      className="w-full px-3 py-2 pr-10 text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-900 focus:outline-none appearance-none"
                    >
                      <option value="KILOAN">Cucian Kiloan (Plastik / Bag)</option>
                      <option value="SATUAN">Hanger Dry Clean & Satuan</option>
                      <option value="EXPRESS">Express / Kilat</option>
                      <option value="SEPATU_TAS">Sepatu, Tas & Helm</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
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
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-bold bg-blue-900 hover:bg-blue-800 text-white rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Rak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Broadcast Reminder WhatsApp Otomatis (P2) */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[92dvh] sm:max-h-[90vh] shadow-2xl flex flex-col min-h-0 overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Bell className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Broadcast Reminder WhatsApp Otomatis
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Kirim pengingat cucian mengendap di rak &amp; kuota paket kiloan expired
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReminderModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-Tabs Selector */}
            <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setReminderTab('STALE_RACK')}
                className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                  reminderTab === 'STALE_RACK'
                    ? 'border-emerald-700 text-emerald-900 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Cucian Mengendap di Rak (≥ 3 Hari)</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-mono font-bold">
                  {reminderData?.staleCandidates?.length || 0}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setReminderTab('EXPIRING_WALLET')}
                className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                  reminderTab === 'EXPIRING_WALLET'
                    ? 'border-emerald-700 text-emerald-900 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Kuota Paket Expired (H-1)</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-mono font-bold">
                  {reminderData?.expiringCandidates?.length || 0}
                </span>
              </button>
            </div>

            {/* Body Content */}
            <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain flex-1 space-y-3">
              {reminderLoading ? (
                <div className="p-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                  <span className="text-xs font-bold">Memindai data kandidat reminder WhatsApp...</span>
                </div>
              ) : reminderTab === 'STALE_RACK' ? (
                (!reminderData?.staleCandidates || reminderData.staleCandidates.length === 0) ? (
                  <div className="p-12 text-center text-slate-400">
                    <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
                    <p className="text-sm font-bold text-slate-700">Semua Rak Bersih!</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tidak ada cucian yang mengendap lebih dari 3 hari tanpa reminder.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {reminderData.staleCandidates.map((c) => (
                      <div
                        key={c.detailId || c.orderId}
                        className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{c.customerName}</span>
                            <span className="font-mono text-slate-400">({c.customerPhone || '-'})</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-500">
                            <span className="font-mono font-bold text-blue-900">{c.invoiceNumber}</span>
                            <span>•</span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-[11px] text-slate-700">
                              {c.rackCode}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            c.daysAging >= 7
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {c.daysAging} Hari di Rak
                          </span>
                          <span className="font-mono font-bold text-slate-800">
                            {c.remainingAmount <= 0 ? (
                              <span className="text-emerald-700 font-black">LUNAS</span>
                            ) : (
                              <span className="text-amber-800 font-black">
                                Tagihan Rp {c.remainingAmount.toLocaleString('id-ID')}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                (!reminderData?.expiringCandidates || reminderData.expiringCandidates.length === 0) ? (
                  <div className="p-12 text-center text-slate-400">
                    <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
                    <p className="text-sm font-bold text-slate-700">Tidak Ada Kuota Hampir Hangus</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Semua paket kiloan pelanggan aktif memiliki masa berlaku lebih dari 1 hari.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {reminderData.expiringCandidates.map((w) => (
                      <div
                        key={w.walletId}
                        className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{w.customerName}</span>
                            <span className="font-mono text-slate-400">({w.customerPhone || '-'})</span>
                          </div>
                          <div className="text-slate-500 text-[11px]">
                            Kedaluwarsa: <strong className="text-rose-700">{w.expiryDateStr || (w.quotaExpiresAt ? new Date(w.quotaExpiresAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-')}</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-900 border border-blue-200 font-mono">
                            Sisa {w.remainingQuotaKg} Kg
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3">
              <div className="text-xs text-slate-600 font-bold">
                <span>Siap Dikirim: </span>
                <strong className="text-emerald-700 font-mono">
                  {((reminderData?.staleCandidates?.length || 0) + (reminderData?.expiringCandidates?.length || 0))} Pesan WA
                </strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowReminderModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={
                    reminderSubmitting ||
                    reminderLoading ||
                    ((reminderData?.staleCandidates?.length || 0) + (reminderData?.expiringCandidates?.length || 0)) === 0
                  }
                  onClick={handleExecuteReminders}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  {reminderSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Mengirim Broadcast...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Kirim Reminder Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {reminderToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{reminderToast}</span>
        </div>
      )}
    </div>
  );
};
