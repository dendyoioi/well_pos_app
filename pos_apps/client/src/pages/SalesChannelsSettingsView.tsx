import React, { useState, useEffect } from 'react';
import {
  Globe,
  Store,
  Plus,
  CheckCircle2,
  Trash2,
  Bike,
  Utensils,
  Info,
  ShieldAlert,
  Edit2,
} from 'lucide-react';
import type { Outlet, SalesChannelConfig } from '../types/outlet';
import { DEFAULT_SALES_CHANNELS, normalizeSalesChannels } from '../types/outlet';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';

interface SalesChannelsSettingsViewProps {
  activeOutlet: Outlet | null;
  onOutletUpdated?: (updatedOutlet: Outlet) => void;
  currentUserRole?: string;
}

export const SalesChannelsSettingsView: React.FC<SalesChannelsSettingsViewProps> = ({
  activeOutlet,
  onOutletUpdated,
  currentUserRole = 'OWNER',
}) => {
  const dialog = useDialog();
  const isOwnerOrAdmin = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';
  const isSupervisor = currentUserRole === 'SUPERVISOR';
  const canEditStructure = isOwnerOrAdmin;
  const canToggle = isOwnerOrAdmin || isSupervisor;

  // Load existing channels from outlet and normalize to ensure core channels are always included
  const initialChannels: SalesChannelConfig[] = normalizeSalesChannels(activeOutlet?.channelsConfig);

  const [channels, setChannels] = useState<SalesChannelConfig[]>(initialChannels);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state if activeOutlet or channelsConfig changes
  useEffect(() => {
    setChannels(normalizeSalesChannels(activeOutlet?.channelsConfig));
  }, [activeOutlet?.id, activeOutlet?.channelsConfig]);

  // Edit Channel State (Zero Stacked Modals)
  const [editingChannel, setEditingChannel] = useState<SalesChannelConfig | null>(null);
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelBadge, setEditChannelBadge] = useState('');
  const [editChannelColor, setEditChannelColor] = useState('#2563eb');
  const [editRequiresOnlineOrderId, setEditRequiresOnlineOrderId] = useState(false);
  const [editRequiresTable, setEditRequiresTable] = useState(false);

  const handleOpenEdit = (channel: SalesChannelConfig) => {
    setEditingChannel(channel);
    setEditChannelName(channel.name);
    setEditChannelBadge(channel.badge || '');
    setEditChannelColor(channel.color || '#2563eb');
    setEditRequiresOnlineOrderId(!!channel.requiresOnlineOrderId);
    setEditRequiresTable(!!channel.requiresTable);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChannel || !editChannelName.trim()) return;

    const updated = channels.map((c) => {
      if (c.id === editingChannel.id) {
        return {
          ...c,
          name: editChannelName.trim(),
          badge: editChannelBadge.trim() || undefined,
          color: editChannelColor,
          requiresOnlineOrderId: editRequiresOnlineOrderId,
          requiresTable: editRequiresTable,
        };
      }
      return c;
    });

    setChannels(updated);
    setEditingChannel(null);
    await saveChannelsToBackend(updated);
  };

  // New Channel Dialog State (Single Clean Modal - Zero Stacked Modals)
  const [showAddModal, setShowAddModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelGroup, setNewChannelGroup] = useState<'OFFLINE_DIRECT' | 'ONLINE_DELIVERY'>('ONLINE_DELIVERY');
  const [newChannelColor, setNewChannelColor] = useState('#2563eb');
  const [newRequiresOnlineOrderId, setNewRequiresOnlineOrderId] = useState(true);

  const directChannels = channels.filter((c) => c.group === 'OFFLINE_DIRECT');
  const onlineChannels = channels.filter((c) => c.group === 'ONLINE_DELIVERY');

  const handleToggleChannel = async (channelId: string) => {
    if (!canToggle) {
      setErrorMessage('Anda tidak memiliki hak akses untuk mengubah status kanal penjualan.');
      return;
    }

    const updated = channels.map((c) => {
      if (c.id === channelId) {
        return { ...c, isActive: !c.isActive };
      }
      return c;
    });

    setChannels(updated);
    await saveChannelsToBackend(updated);
  };

  const handleDeleteCustomChannel = async (channelId: string) => {
    if (!canEditStructure) {
      setErrorMessage('Hanya Pemilik Toko (Owner) & Admin yang dapat menghapus kanal penjualan.');
      return;
    }

    const updated = channels.filter((c) => c.id !== channelId);
    setChannels(updated);
    await saveChannelsToBackend(updated);
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    const code = newChannelName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_');

    // Cek duplikasi code
    if (channels.some((c) => c.code === code)) {
      setErrorMessage(`Kanal dengan kode "${code}" sudah terdaftar.`);
      return;
    }

    const newChannel: SalesChannelConfig = {
      id: `channel_custom_${Date.now()}`,
      code,
      name: newChannelName.trim(),
      group: newChannelGroup,
      isActive: true,
      color: newChannelColor,
      badge: newChannelGroup === 'ONLINE_DELIVERY' ? 'Mitra Online' : 'Langsung Toko',
      requiresTable: false,
      requiresOnlineOrderId: newChannelGroup === 'ONLINE_DELIVERY' ? newRequiresOnlineOrderId : false,
      isCustom: true,
    };

    const updated = [...channels, newChannel];
    setChannels(updated);
    setShowAddModal(false);
    setNewChannelName('');
    setNewChannelGroup('ONLINE_DELIVERY');
    await saveChannelsToBackend(updated);
  };

  const saveChannelsToBackend = async (dataToSave: SalesChannelConfig[]) => {
    if (!activeOutlet?.id) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.updateOutletChannels(activeOutlet.id, dataToSave);
      if (res.status === 'success') {
        setSuccessMessage('Konfigurasi kanal penjualan berhasil diperbarui!');
        if (onOutletUpdated) {
          onOutletUpdated({
            ...activeOutlet,
            channelsConfig: dataToSave,
          });
        }
        setTimeout(() => setSuccessMessage(null), 3500);
      } else {
        setErrorMessage(res.message || 'Gagal menyimpan perubahan');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat menyimpan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!canEditStructure) return;
    const ok = await dialog.confirm({
      title: 'Reset Konfigurasi Kanal',
      message: 'Kembalikan konfigurasi seluruh kanal penjualan ke standar bawaan sistem?',
      variant: 'warning',
      confirmText: 'Ya, Kembalikan',
      cancelText: 'Batal',
    });
    if (ok) {
      setChannels(DEFAULT_SALES_CHANNELS);
      await saveChannelsToBackend(DEFAULT_SALES_CHANNELS);
    }
  };

  return (
    <div className="space-y-6 pb-28 sm:pb-16 font-sans">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-900" />
              <span>Kanal Penjualan &amp; Mitra Online Delivery</span>
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200 flex items-center gap-1">
              <Store className="w-3 h-3 text-blue-800" />
              Toko: {activeOutlet?.name || 'Utama'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium max-w-3xl leading-relaxed">
            Atur jalur penerimaan pesanan kasir: Penjualan Langsung (Dine In, Take Away, Kurir Internal) dan Mitra Online Delivery (GoFood, GrabFood, ShopeeFood). Laporan keuangan akan otomatis mengelompokkan omzet berdasarkan mitra penjualan.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {canEditStructure && (
            <button
              type="button"
              onClick={handleResetToDefault}
              disabled={isSaving}
              className="flex-1 sm:flex-initial justify-center px-4 h-10 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center disabled:opacity-50"
            >
              Reset Default
            </button>
          )}

          {canEditStructure && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex-1 sm:flex-initial justify-center px-5 h-10 bg-blue-900 hover:bg-blue-800 active:scale-95 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-900/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Mitra</span>
            </button>
          )}
        </div>
      </div>

      {/* Role Alert / Toast Notice */}
      {isSupervisor && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-3 text-xs text-blue-950 font-medium">
          <Info className="w-4 h-4 text-blue-800 shrink-0" />
          <span>
            Sebagai <strong>Supervisor</strong>, Anda dapat mengaktifkan/menonaktifkan operasional mitra secara fleksibel (misal saat dapur penuh). Penambahan mitra baru dikelola oleh Pemilik Resto (Owner) &amp; Admin.
          </span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 font-bold animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs text-rose-800 font-bold animate-in fade-in duration-200">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Group 1: Penjualan Langsung Toko */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-black">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">🏢 Penjualan Langsung Toko (Direct Store)</h3>
              <p className="text-xs text-slate-500">Transaksi langsung pelanggan di kasir outlet fisik</p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
            {directChannels.filter((c) => c.isActive).length} / {directChannels.length} Aktif
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {directChannels.map((channel) => (
            <div
              key={channel.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                channel.isActive
                  ? 'bg-slate-50/50 border-slate-200 shadow-xs'
                  : 'bg-slate-50/20 border-slate-100 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: channel.color || '#2563eb' }}
                    />
                    <span className="font-extrabold text-sm text-slate-900">{channel.name}</span>
                  </div>
                  {channel.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                      {channel.badge}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                  {channel.requiresTable
                    ? '🍽️ Mewajibkan pilihan nomor meja pada keranjang kasir'
                    : '📦 Bebas nomor meja (langsung bungkus / kirim internal)'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-400">Kode: {channel.code}</span>
                  {canEditStructure && (
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(channel)}
                      disabled={isSaving}
                      className="p-1 text-slate-400 hover:text-blue-900 transition-colors cursor-pointer"
                      title="Ubah nama & konfigurasi kanal"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                
                {/* Modern Canonical Toggle Switch */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${channel.isActive ? 'text-blue-900' : 'text-slate-400'}`}>
                    {channel.isActive ? 'Aktif' : 'Off'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={channel.isActive}
                    onClick={() => handleToggleChannel(channel.id)}
                    disabled={!canToggle || isSaving}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                      channel.isActive ? 'bg-blue-900' : 'bg-slate-300'
                    }`}
                    title={channel.isActive ? 'Klik untuk menonaktifkan' : 'Klik untuk mengaktifkan'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        channel.isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Group 2: Mitra Online Delivery */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-black">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">🌐 Mitra Online Delivery (Layanan Pesan Antar Online)</h3>
              <p className="text-xs text-slate-500">
                Pesanan dari platform aggregator &amp; kurir online dengan integrasi input ID Pesanan Driver
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            {onlineChannels.filter((c) => c.isActive).length} / {onlineChannels.length} Mitra Aktif
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {onlineChannels.map((channel) => (
            <div
              key={channel.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                channel.isActive
                  ? 'bg-blue-50/20 border-blue-200/80 shadow-xs'
                  : 'bg-slate-50/20 border-slate-100 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: channel.color || '#dc2626' }}
                    />
                    <span className="font-extrabold text-sm text-slate-900">{channel.name}</span>
                  </div>
                  {channel.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200">
                      {channel.badge}
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-xs text-slate-500 mb-3">
                  <p className="flex items-center gap-1.5">
                    <Bike className="w-3.5 h-3.5 text-blue-900 shrink-0" />
                    <span>Hadirkan input <strong>ID Pesanan Driver</strong></span>
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Otomatis mencatat omzet spesifik {channel.name} di laporan penjualan.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-slate-400">Kode: {channel.code}</span>
                  {canEditStructure && (
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(channel)}
                      disabled={isSaving}
                      className="p-1 text-slate-400 hover:text-blue-900 transition-colors ml-0.5 cursor-pointer"
                      title="Ubah nama & konfigurasi mitra"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {channel.isCustom && canEditStructure && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomChannel(channel.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                      title="Hapus kanal kustom"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Modern Canonical Toggle Switch */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${channel.isActive ? 'text-blue-900' : 'text-slate-400'}`}>
                    {channel.isActive ? 'Aktif' : 'Off'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={channel.isActive}
                    onClick={() => handleToggleChannel(channel.id)}
                    disabled={!canToggle || isSaving}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                      channel.isActive ? 'bg-blue-900' : 'bg-slate-300'
                    }`}
                    title={channel.isActive ? 'Klik untuk menonaktifkan' : 'Klik untuk mengaktifkan'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        channel.isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Card: Kasir Experience Context */}
      <div className="p-5 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-3xl text-white shadow-md">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
            <Utensils className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-black mb-1">
              Pemisahan Antarmuka Kasir: Nomor Meja vs ID Pesanan Online
            </h4>
            <p className="text-xs text-blue-100 leading-relaxed font-normal">
              Ketika kasir memilih kanal <strong>Makan di Tempat (Dine In)</strong>, kasir disajikan selektor nomor meja restoran. Namun jika kasir memilih kanal <strong>Mitra Online Delivery (GoFood, GrabFood, ShopeeFood)</strong>, selektor meja disembunyikan dan digantikan tombol/input kontekstual <strong>ID Pesanan Online Driver</strong> (contoh: <code className="bg-white/20 px-1 py-0.5 rounded font-mono text-[11px]">#GF-402</code>) untuk verifikasi cepat saat pengemudi tiba.
            </p>
          </div>
        </div>
      </div>

      {/* Modal: Ubah Konfigurasi Kanal / Mitra (Rule 10 PWA Responsive Bottom Sheet with Sticky Footer) */}
      {editingChannel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900">Ubah Pengaturan Kanal</h3>
                <p className="text-xs text-slate-500 font-medium">Kanal: {editingChannel.code}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingChannel(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form Container */}
            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain flex-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Tampilan Kanal <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: GoFood, GrabFood, Kurir Lokal"
                    value={editChannelName}
                    onChange={(e) => setEditChannelName(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Label / Badge Tambahan
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Mitra Gojek, Kurir Toko"
                    value={editChannelBadge}
                    onChange={(e) => setEditChannelBadge(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent font-medium"
                  />
                </div>

                {editingChannel.group === 'ONLINE_DELIVERY' && (
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="pr-3">
                      <span className="text-xs font-bold text-slate-900 block">Wajibkan ID Pesanan Driver</span>
                      <span className="text-[11px] text-slate-500">Kasir harus menginput nomor struk/kode online driver</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={editRequiresOnlineOrderId}
                      onClick={() => setEditRequiresOnlineOrderId(!editRequiresOnlineOrderId)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        editRequiresOnlineOrderId ? 'bg-blue-900' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          editRequiresOnlineOrderId ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )}

                {editingChannel.group === 'OFFLINE_DIRECT' && (
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="pr-3">
                      <span className="text-xs font-bold text-slate-900 block">Wajibkan Nomor Meja</span>
                      <span className="text-[11px] text-slate-500">Kasir harus memilih meja tamu saat checkout</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={editRequiresTable}
                      onClick={() => setEditRequiresTable(!editRequiresTable)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        editRequiresTable ? 'bg-blue-900' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          editRequiresTable ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Warna Indikator Visual
                  </label>
                  <div className="flex items-center gap-2">
                    {['#dc2626', '#ea580c', '#16a34a', '#2563eb', '#7c3aed', '#0d9488', '#475569'].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setEditChannelColor(hex)}
                        className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                          editChannelColor === hex ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingChannel(null)}
                  className="px-4 h-10 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !editChannelName.trim()}
                  className="px-5 h-10 bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-900/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tambah Mitra / Kanal Penjualan (Rule 10 PWA Responsive Bottom Sheet with Sticky Footer) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900">Tambah Mitra / Kanal Penjualan</h3>
                <p className="text-xs text-slate-500 font-medium">Buat kanal baru untuk transaksi kasir</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form Container */}
            <form onSubmit={handleAddChannel} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain flex-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Mitra / Kanal Penjualan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Maxim Food, Catering Event, Titip Kurir"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kelompok Kanal
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewChannelGroup('ONLINE_DELIVERY');
                        setNewRequiresOnlineOrderId(true);
                      }}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center gap-2 cursor-pointer ${
                        newChannelGroup === 'ONLINE_DELIVERY'
                          ? 'border-blue-900 bg-blue-50 text-blue-950 font-black'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <Globe className="w-4 h-4 text-blue-900 shrink-0" />
                      <span>Mitra Online Delivery</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNewChannelGroup('OFFLINE_DIRECT');
                        setNewRequiresOnlineOrderId(false);
                      }}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center gap-2 cursor-pointer ${
                        newChannelGroup === 'OFFLINE_DIRECT'
                          ? 'border-blue-900 bg-blue-50 text-blue-950 font-black'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <Store className="w-4 h-4 text-blue-900 shrink-0" />
                      <span>Penjualan Langsung</span>
                    </button>
                  </div>
                </div>

                {newChannelGroup === 'ONLINE_DELIVERY' && (
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="pr-3">
                      <span className="text-xs font-bold text-slate-900 block">Wajibkan ID Pesanan Driver</span>
                      <span className="text-[11px] text-slate-500">Kasir harus menginput nomor struk/kode online driver</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={newRequiresOnlineOrderId}
                      onClick={() => setNewRequiresOnlineOrderId(!newRequiresOnlineOrderId)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        newRequiresOnlineOrderId ? 'bg-blue-900' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          newRequiresOnlineOrderId ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Warna Indikator Visual
                  </label>
                  <div className="flex items-center gap-2">
                    {['#dc2626', '#ea580c', '#16a34a', '#2563eb', '#7c3aed', '#0d9488', '#475569'].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setNewChannelColor(hex)}
                        className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                          newChannelColor === hex ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 h-10 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !newChannelName.trim()}
                  className="px-5 h-10 bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-900/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  Simpan Mitra Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
