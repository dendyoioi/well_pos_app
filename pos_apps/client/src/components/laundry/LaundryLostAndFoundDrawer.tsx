import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Search,
  Plus,
  PackageSearch,
  CheckCircle2,
  PhoneCall,
  MapPin,
  Clock,
  UserCheck,
  AlertCircle,
  Loader2,
  FileText,
  User,
} from 'lucide-react';
import { laundryCoreApi } from '../../services/api';
import type {
  LaundryLostAndFoundItem,
  LostAndFoundCategory,
} from '../../types/laundry_core';

interface LaundryLostAndFoundDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeOutletId: string;
  activeOutletName?: string;
}

export const LaundryLostAndFoundDrawer: React.FC<LaundryLostAndFoundDrawerProps> = ({
  isOpen,
  onClose,
  activeOutletId,
  activeOutletName,
}) => {
  const [items, setItems] = useState<LaundryLostAndFoundItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Form New Item State
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formCategory, setFormCategory] = useState<LostAndFoundCategory>('POCKET_ITEM');
  const [formItemName, setFormItemName] = useState<string>('');
  const [formStorageLocation, setFormStorageLocation] = useState<string>('Loker Temuan Kasir');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // Claim/Return Handover State
  const [handoverItemId, setHandoverItemId] = useState<string | null>(null);
  const [claimedByName, setClaimedByName] = useState<string>('');
  const [isHandoverSubmitting, setIsHandoverSubmitting] = useState<boolean>(false);

  const fetchItems = useCallback(async () => {
    if (!activeOutletId) return;
    setLoading(true);
    try {
      const res = await laundryCoreApi.getLostAndFound({
        outletId: activeOutletId,
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        itemCategory: selectedCategory === 'ALL' ? undefined : selectedCategory,
        search: search.trim() ? search.trim() : undefined,
      });
      if (res.status === 'success' && res.data) {
        setItems(res.data);
      }
    } catch (err) {
      console.error('Failed to load lost and found items:', err);
    } finally {
      setLoading(false);
    }
  }, [activeOutletId, selectedStatus, selectedCategory, search]);

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen, fetchItems]);

  const handleCreateNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formItemName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await laundryCoreApi.createLostAndFound({
        outletId: activeOutletId,
        itemCategory: formCategory,
        itemName: formItemName.trim(),
        storageLocation: formStorageLocation.trim() || undefined,
        description: formDescription.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });

      if (res.status === 'success') {
        setShowAddForm(false);
        setFormItemName('');
        setFormDescription('');
        setFormNotes('');
        await fetchItems();
      } else {
        alert(res.message || 'Gagal mencatat barang temuan');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat menyimpan barang temuan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkNotified = async (itemId: string) => {
    try {
      const res = await laundryCoreApi.updateLostAndFound(itemId, {
        status: 'NOTIFIED',
      });
      if (res.status === 'success') {
        await fetchItems();
      } else {
        alert(res.message || 'Gagal mengubah status');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat memperbarui status');
    }
  };

  const handleHandoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverItemId || !claimedByName.trim()) return;

    setIsHandoverSubmitting(true);
    try {
      const res = await laundryCoreApi.updateLostAndFound(handoverItemId, {
        status: 'RETURNED',
        claimedByName: claimedByName.trim(),
      });
      if (res.status === 'success') {
        setHandoverItemId(null);
        setClaimedByName('');
        await fetchItems();
      } else {
        alert(res.message || 'Gagal mencatat serah terima');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat memproses serah terima');
    } finally {
      setIsHandoverSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col min-h-0 border-l border-slate-200 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-900">
              <PackageSearch className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Lost & Found (Barang Temuan)</h2>
              <p className="text-xs text-slate-500">
                Inventaris barang tercecer di saku & pakaian tak bertuan {activeOutletName ? `• ${activeOutletName}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Category & Status Filters + Search */}
        <div className="p-4 border-b border-slate-100 bg-white space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama barang, invoice, lokasi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
            </div>

            {/* Toggle Add Form */}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{showAddForm ? 'Tutup Form' : 'Catat Temuan Baru'}</span>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-slate-400 text-[11px] font-medium mr-1">Kategori:</span>
            {[
              { id: 'ALL', label: 'Semua' },
              { id: 'POCKET_ITEM', label: 'Barang di Saku' },
              { id: 'UNCLAIMED_GARMENT', label: 'Pakaian Tak Bertuan' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}

            <span className="text-slate-400 text-[11px] font-medium ml-2 mr-1">Status:</span>
            {[
              { id: 'ALL', label: 'Semua' },
              { id: 'FOUND', label: 'Ditemukan' },
              { id: 'NOTIFIED', label: 'Sudah Dihubungi' },
              { id: 'RETURNED', label: 'Diambil' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  selectedStatus === st.id
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Expandable Add Form */}
        {showAddForm && (
          <form
            onSubmit={handleCreateNewItem}
            className="p-4 bg-blue-50/50 border-b border-blue-100 space-y-3 shrink-0 animate-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-blue-900" />
                Catat Barang Temuan Baru
              </span>
              <span className="text-[11px] text-blue-700">Tersimpan ke inventaris cabang</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Kategori Temuan *
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as LostAndFoundCategory)}
                  className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-900 focus:outline-none"
                >
                  <option value="POCKET_ITEM">Barang di Saku (Uang/Kunci/Perhiasan)</option>
                  <option value="UNCLAIMED_GARMENT">Pakaian Tak Bertuan / Tanpa Label</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nama / Rincian Barang *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kunci Motor Vario hitam, Uang Rp 50.000"
                  value={formItemName}
                  onChange={(e) => setFormItemName(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Lokasi Penyimpanan *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Loker Kasir A-2, Kotak Temuan"
                  value={formStorageLocation}
                  onChange={(e) => setFormStorageLocation(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Ciri-Ciri Tambahan / Deskripsi
                </label>
                <input
                  type="text"
                  placeholder="Gantungan dompet kulit cokelat"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !formItemName.trim()}
                className="px-4 py-1.5 bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Simpan Temuan</span>
              </button>
            </div>
          </form>
        )}

        {/* Modal Mini: Handover to Customer */}
        {handoverItemId && (
          <div className="p-4 bg-emerald-50 border-b border-emerald-200 space-y-3 shrink-0 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Konfirmasi Serah Terima ke Pemilik
              </span>
              <button
                type="button"
                onClick={() => setHandoverItemId(null)}
                className="text-xs text-emerald-700 hover:text-emerald-900 font-medium"
              >
                Tutup
              </button>
            </div>
            <form onSubmit={handleHandoverSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Nama penerima / pemilik yang mengambil *"
                value={claimedByName}
                onChange={(e) => setClaimedByName(e.target.value)}
                required
                className="flex-1 text-xs px-3 py-2 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <button
                type="submit"
                disabled={isHandoverSubmitting || !claimedByName.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0"
              >
                {isHandoverSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Selesaikan Serah Terima</span>
              </button>
            </form>
          </div>
        )}

        {/* Scrollable Items List */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <span className="text-xs">Memuat daftar barang temuan...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center">
              <PackageSearch className="w-12 h-12 stroke-[1.2] mb-3 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">Belum Ada Barang Temuan</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Tidak ada barang tercecer atau pakaian tanpa pemilik yang tercatat untuk filter ini.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all shadow-xs space-y-2.5"
              >
                {/* Header row: Category pill & Status badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                        item.itemCategory === 'POCKET_ITEM'
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : 'bg-purple-100 text-purple-900 border border-purple-200'
                      }`}
                    >
                      {item.itemCategory === 'POCKET_ITEM' ? 'Barang di Saku' : 'Pakaian Tak Bertuan'}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(item.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {item.status === 'FOUND' && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Belum Diambil
                      </span>
                    )}
                    {item.status === 'NOTIFIED' && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
                        <PhoneCall className="w-3 h-3" />
                        Sudah Dihubungi
                      </span>
                    )}
                    {item.status === 'RETURNED' && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Sudah Diserahkan
                      </span>
                    )}
                    {item.status === 'DISPOSED' && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        Dihibahkan / Dimusnahkan
                      </span>
                    )}
                  </div>
                </div>

                {/* Main info */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{item.itemName}</h4>
                  {item.description && (
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Meta details: Storage & Linkage */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Lokasi: </span>
                    <strong className="text-slate-700">{item.storageLocation || 'Kasir'}</strong>
                  </div>

                  {item.order && (
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Order: </span>
                      <strong className="text-blue-900 font-mono">#{item.order.invoiceNumber}</strong>
                    </div>
                  )}

                  {item.customer && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Pelanggan: </span>
                      <strong className="text-slate-800">{item.customer.name}</strong>
                    </div>
                  )}

                  {item.status === 'RETURNED' && item.claimedByName && (
                    <div className="flex items-center gap-1.5 text-emerald-700">
                      <UserCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>Penerima: </span>
                      <strong className="font-semibold">{item.claimedByName}</strong>
                    </div>
                  )}
                </div>

                {/* Actions row */}
                {item.status !== 'RETURNED' && item.status !== 'DISPOSED' && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    {item.status === 'FOUND' && (
                      <button
                        onClick={() => handleMarkNotified(item.id)}
                        className="px-2.5 py-1 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Tandai Sudah Dihubungi</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setHandoverItemId(item.id);
                        setClaimedByName(item.customer?.name || '');
                      }}
                      className="px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Serahkan ke Pemilik</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between text-[11px] text-slate-500 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span>Menampilkan {items.length} barang temuan</span>
          <span className="text-slate-400">Pemberitahuan pelanggan via WhatsApp/Telepon</span>
        </div>
      </div>
    </div>
  );
};
