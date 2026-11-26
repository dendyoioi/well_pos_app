import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Camera,
  Trash2,
  Image as ImageIcon,
  ChevronDown,
} from 'lucide-react';
import { api, laundryCoreApi } from '../../services/api';
import { compressImage } from '../../utils/imageCompressor';
import { useDialog } from '../../context/DialogContext';
import type { LaundryLostAndFoundItem } from '../../types/laundry_core';

interface LaundryLostAndFoundDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeOutletId: string;
  activeOutletName?: string;
}

const PRESET_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'POCKET_ITEM', label: 'Barang di Saku' },
  { value: 'UNCLAIMED_GARMENT', label: 'Pakaian Tak Bertuan' },
  { value: 'ACCESSORIES', label: 'Aksesori / Perhiasan' },
  { value: 'DOCUMENTS', label: 'Dokumen / Kartu' },
];

const CUSTOM_CATEGORY_OPTION = '__CUSTOM__';

const getCategoryDisplayLabel = (category: string): string => {
  const preset = PRESET_CATEGORIES.find((c) => c.value === category);
  if (preset) return preset.label;
  if (category === 'VALUABLES') return 'Barang Berharga';
  if (category === 'CLOTHING') return 'Pakaian';
  if (category === 'OTHER') return 'Lainnya';
  return category;
};

export const LaundryLostAndFoundDrawer: React.FC<LaundryLostAndFoundDrawerProps> = ({
  isOpen,
  onClose,
  activeOutletId,
  activeOutletName,
}) => {
  const dialog = useDialog();
  const [items, setItems] = useState<LaundryLostAndFoundItem[]>([]);
  const [knownCustomCategories, setKnownCustomCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [drawerError, setDrawerError] = useState<string | null>(null);

  // Form New Item State
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formCategorySelect, setFormCategorySelect] = useState<string>('POCKET_ITEM');
  const [formCustomCategory, setFormCustomCategory] = useState<string>('');
  const [formItemName, setFormItemName] = useState<string>('');
  const [formStorageLocation, setFormStorageLocation] = useState<string>('Loker Temuan Kasir');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formPhotoUrl, setFormPhotoUrl] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Preview Lightbox State
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

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
        const presetSet = new Set(PRESET_CATEGORIES.map((c) => c.value));
        const customFromItems = Array.from(
          new Set(
            res.data
              .map((it) => it.itemCategory)
              .filter((cat): cat is string => Boolean(cat) && !presetSet.has(cat))
          )
        );
        if (customFromItems.length > 0) {
          setKnownCustomCategories((prev) => Array.from(new Set([...prev, ...customFromItems])));
        }
      }
    } catch (err) {
      console.error('Failed to load lost and found items:', err);
    } finally {
      setLoading(false);
    }
  }, [activeOutletId, selectedStatus, selectedCategory, search]);

  useEffect(() => {
    if (isOpen) {
      setDrawerError(null);
      fetchItems();
    }
  }, [isOpen, fetchItems]);

  const filterCategories = useMemo(() => {
    const presetEntries = PRESET_CATEGORIES.map((c) => ({ id: c.value, label: c.label }));
    const presetSet = new Set(PRESET_CATEGORIES.map((c) => c.value));
    const customEntries = knownCustomCategories
      .filter((cat) => !presetSet.has(cat))
      .map((cat) => ({ id: cat, label: getCategoryDisplayLabel(cat) }));
    return [{ id: 'ALL', label: 'Semua' }, ...presetEntries, ...customEntries];
  }, [knownCustomCategories]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (!file) return;

    setDrawerError(null);
    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file, {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.8,
        mimeType: 'image/webp',
      });

      const uploadRes = await api.uploadLaundryConditionPhoto({
        image: compressed.dataUrl,
        caption: formItemName.trim() || 'Foto Barang Temuan Lost & Found',
        stage: 'LOST_AND_FOUND',
      });

      if (uploadRes?.status === 'success' && uploadRes?.data?.url) {
        setFormPhotoUrl(uploadRes.data.url);
        dialog.toast('Foto barang temuan berhasil diunggah.', 'success');
      } else {
        setDrawerError(uploadRes?.message || 'Gagal mengunggah foto ke server penyimpanan.');
      }
    } catch (err: any) {
      setDrawerError(err?.message || 'Gagal memproses atau mengunggah foto barang temuan.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCreateNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setDrawerError(null);

    const resolvedCategory =
      formCategorySelect === CUSTOM_CATEGORY_OPTION
        ? formCustomCategory.trim()
        : formCategorySelect;

    if (!resolvedCategory || resolvedCategory.length < 2) {
      setDrawerError('Nama kategori manual wajib diisi (minimal 2 karakter).');
      return;
    }
    if (!formItemName.trim()) {
      setDrawerError('Nama / rincian barang temuan wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await laundryCoreApi.createLostAndFound({
        outletId: activeOutletId,
        itemCategory: resolvedCategory,
        itemName: formItemName.trim(),
        storageLocation: formStorageLocation.trim() || undefined,
        description: formDescription.trim() || undefined,
        photoUrl: formPhotoUrl || undefined,
        notes: formNotes.trim() || undefined,
      });

      if (res.status === 'success') {
        setShowAddForm(false);
        setFormCategorySelect('POCKET_ITEM');
        setFormCustomCategory('');
        setFormItemName('');
        setFormDescription('');
        setFormNotes('');
        setFormPhotoUrl('');
        dialog.toast('Barang temuan berhasil dicatat.', 'success');
        await fetchItems();
      } else {
        setDrawerError(res.message || 'Gagal mencatat barang temuan');
      }
    } catch (err: any) {
      setDrawerError(err?.message || 'Terjadi kesalahan saat menyimpan barang temuan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkNotified = async (itemId: string) => {
    setDrawerError(null);
    try {
      const res = await laundryCoreApi.updateLostAndFound(itemId, {
        status: 'NOTIFIED',
      });
      if (res.status === 'success') {
        dialog.toast('Status diperbarui menjadi Sudah Dihubungi.', 'success');
        await fetchItems();
      } else {
        setDrawerError(res.message || 'Gagal mengubah status barang temuan');
      }
    } catch (err: any) {
      setDrawerError(err?.message || 'Terjadi kesalahan saat memperbarui status');
    }
  };

  const handleHandoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverItemId || !claimedByName.trim()) return;

    setDrawerError(null);
    setIsHandoverSubmitting(true);
    try {
      const res = await laundryCoreApi.updateLostAndFound(handoverItemId, {
        status: 'RETURNED',
        claimedByName: claimedByName.trim(),
      });
      if (res.status === 'success') {
        setHandoverItemId(null);
        setClaimedByName('');
        dialog.toast('Serah terima barang temuan berhasil dicatat.', 'success');
        await fetchItems();
      } else {
        setDrawerError(res.message || 'Gagal mencatat serah terima');
      }
    } catch (err: any) {
      setDrawerError(err?.message || 'Terjadi kesalahan saat memproses serah terima');
    } finally {
      setIsHandoverSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col min-h-0 border-l border-slate-200 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-900 shrink-0">
              <PackageSearch className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                Lost &amp; Found (Barang Temuan)
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Inventaris barang tercecer di saku &amp; pakaian tak bertuan{' '}
                {activeOutletName ? `• ${activeOutletName}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inline Error Banner */}
        {drawerError && (
          <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-semibold flex items-start justify-between gap-2 shrink-0">
            <div className="flex items-start gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="break-words min-w-0">{drawerError}</span>
            </div>
            <button
              type="button"
              onClick={() => setDrawerError(null)}
              className="text-rose-600 hover:text-rose-800 p-0.5 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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
                className="w-full h-10 sm:h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
            </div>

            {/* Toggle Add Form */}
            <button
              type="button"
              onClick={() => {
                setDrawerError(null);
                setShowAddForm(!showAddForm);
              }}
              className="h-11 sm:h-9 px-3.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm shrink-0 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>{showAddForm ? 'Tutup Form' : 'Catat Temuan Baru'}</span>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-nowrap sm:flex-wrap pb-0.5">
              <span className="text-slate-400 text-[11px] font-medium mr-1 shrink-0">Kategori:</span>
              {filterCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-nowrap sm:flex-wrap">
              <span className="text-slate-400 text-[11px] font-medium mr-1 shrink-0">Status:</span>
              {[
                { id: 'ALL', label: 'Semua' },
                { id: 'FOUND', label: 'Ditemukan' },
                { id: 'NOTIFIED', label: 'Sudah Dihubungi' },
                { id: 'RETURNED', label: 'Diambil' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSelectedStatus(st.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
        </div>

        {/* Expandable Add Form */}
        {showAddForm && (
          <form
            onSubmit={handleCreateNewItem}
            className="p-4 bg-blue-50/50 border-b border-blue-100 space-y-3 shrink-0 max-h-[55dvh] overflow-y-auto overscroll-contain animate-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center justify-between flex-wrap gap-1">
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
                <div className="relative">
                  <select
                    value={formCategorySelect}
                    onChange={(e) => setFormCategorySelect(e.target.value)}
                    className="w-full h-10 sm:h-9 text-xs pl-3 pr-10 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="POCKET_ITEM">Barang di Saku (Uang/Kunci/Perhiasan)</option>
                    <option value="UNCLAIMED_GARMENT">Pakaian Tak Bertuan / Tanpa Label</option>
                    <option value="ACCESSORIES">Aksesori / Perhiasan</option>
                    <option value="DOCUMENTS">Dokumen / Kartu</option>
                    <option value={CUSTOM_CATEGORY_OPTION}>Kategori Lain (Ketik Manual)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {formCategorySelect === CUSTOM_CATEGORY_OPTION && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Nama Kategori Manual *
                  </label>
                  <input
                    type="text"
                    minLength={2}
                    maxLength={60}
                    placeholder="Contoh: Elektronik, Tas / Dompet"
                    value={formCustomCategory}
                    onChange={(e) => setFormCustomCategory(e.target.value)}
                    required
                    className="w-full h-10 sm:h-9 text-xs px-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none"
                  />
                </div>
              )}

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
                  className="w-full h-10 sm:h-9 text-xs px-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none"
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
                  className="w-full h-10 sm:h-9 text-xs px-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none"
                />
              </div>

              <div className={formCategorySelect === CUSTOM_CATEGORY_OPTION ? 'sm:col-span-2' : ''}>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Ciri-Ciri Tambahan / Deskripsi
                </label>
                <input
                  type="text"
                  placeholder="Gantungan dompet kulit cokelat"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full h-10 sm:h-9 text-xs px-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none"
                />
              </div>

              {/* Upload Foto Barang Temuan (Cloudflare R2) */}
              <div className="sm:col-span-2 space-y-2">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Foto Barang Temuan (Opsional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                {formPhotoUrl ? (
                  <div className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-xl">
                    <img
                      src={formPhotoUrl}
                      alt="Pratinjau barang temuan"
                      className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Foto berhasil diunggah</span>
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{formPhotoUrl}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormPhotoUrl('')}
                      className="h-9 px-2.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                      title="Hapus foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Foto</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploadingPhoto}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-11 sm:h-10 px-3 bg-white hover:bg-slate-50 border border-dashed border-blue-300 rounded-xl text-xs font-bold text-blue-900 flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {uploadingPhoto ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Memproses &amp; Mengunggah Foto...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 text-blue-800" />
                        <span>Ambil / Pilih Foto Barang</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="h-11 sm:h-9 px-4 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting || uploadingPhoto || !formItemName.trim()}
                className="h-11 sm:h-9 px-4 bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold rounded-xl shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
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
                className="text-xs text-emerald-700 hover:text-emerald-900 font-medium cursor-pointer"
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
                className="flex-1 h-11 sm:h-9 text-xs px-3 bg-white border border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <button
                type="submit"
                disabled={isHandoverSubmitting || !claimedByName.trim()}
                className="h-11 sm:h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0 cursor-pointer"
              >
                {isHandoverSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Selesaikan Serah Terima</span>
              </button>
            </form>
          </div>
        )}

        {/* Scrollable Items List */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
                className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all shadow-xs space-y-2.5 min-w-0"
              >
                {/* Header row: Category pill & Status badge */}
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="flex items-center flex-wrap gap-2 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase whitespace-nowrap ${
                        item.itemCategory === 'POCKET_ITEM'
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : item.itemCategory === 'UNCLAIMED_GARMENT'
                          ? 'bg-purple-100 text-purple-900 border border-purple-200'
                          : 'bg-blue-50 text-blue-900 border border-blue-200'
                      }`}
                    >
                      {getCategoryDisplayLabel(item.itemCategory)}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 whitespace-nowrap">
                      <Clock className="w-3 h-3 shrink-0" />
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
                  <div className="shrink-0">
                    {item.status === 'FOUND' && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 whitespace-nowrap">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        Belum Diambil
                      </span>
                    )}
                    {item.status === 'NOTIFIED' && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1 whitespace-nowrap">
                        <PhoneCall className="w-3 h-3 shrink-0" />
                        Sudah Dihubungi
                      </span>
                    )}
                    {item.status === 'RETURNED' && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 whitespace-nowrap">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        Sudah Diserahkan
                      </span>
                    )}
                    {item.status === 'DISPOSED' && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                        Dihibahkan / Dimusnahkan
                      </span>
                    )}
                  </div>
                </div>

                {/* Main info + Clickable Photo Thumbnail */}
                <div className="flex items-start gap-3 min-w-0">
                  {item.photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewPhotoUrl(item.photoUrl!)}
                      className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0 relative group cursor-pointer bg-slate-100"
                      title="Klik untuk memperbesar foto barang"
                    >
                      <img
                        src={item.photoUrl}
                        alt={item.itemName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <span className="absolute bottom-1 right-1 bg-slate-900/70 text-white p-0.5 rounded">
                        <ImageIcon className="w-3 h-3" />
                      </span>
                    </button>
                  )}

                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-slate-900 break-words">{item.itemName}</h4>
                    {item.description && (
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed break-words">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Meta details: Storage & Linkage */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Lokasi: </span>
                    <strong className="text-slate-700 truncate">
                      {item.storageLocation || 'Kasir'}
                    </strong>
                  </div>

                  {item.order && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Order: </span>
                      <strong className="text-blue-900 font-mono truncate">
                        #{item.order.invoiceNumber}
                      </strong>
                    </div>
                  )}

                  {item.customer && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Pelanggan: </span>
                      <strong className="text-slate-800 truncate">{item.customer.name}</strong>
                    </div>
                  )}

                  {item.status === 'RETURNED' && item.claimedByName && (
                    <div className="flex items-center gap-1.5 text-emerald-700 min-w-0">
                      <UserCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>Penerima: </span>
                      <strong className="font-semibold truncate">{item.claimedByName}</strong>
                    </div>
                  )}
                </div>

                {/* Actions row */}
                {item.status !== 'RETURNED' && item.status !== 'DISPOSED' && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    {item.status === 'FOUND' && (
                      <button
                        type="button"
                        onClick={() => handleMarkNotified(item.id)}
                        className="h-11 sm:h-8 px-3 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <PhoneCall className="w-3.5 h-3.5 shrink-0" />
                        <span>Sudah Dihubungi</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setHandoverItemId(item.id);
                        setClaimedByName(item.customer?.name || '');
                      }}
                      className="h-11 sm:h-8 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <UserCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>Serahkan ke Pemilik</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Lightbox Perbesar Foto Barang Temuan */}
      {previewPhotoUrl && (
        <div
          onClick={() => setPreviewPhotoUrl(null)}
          className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-lg w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-slate-900/80 text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewPhotoUrl}
              alt="Detail Foto Lost & Found"
              className="w-full max-h-[80dvh] object-contain bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
};
