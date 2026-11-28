import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Layers,
  Lock,
  Pin,
  PinOff,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { useDialog } from '../../context/DialogContext';
import type { LaundryServiceCategory } from '../../types/laundry';

interface LaundryCategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialCategories?: LaundryServiceCategory[];
}

function normalizeCategoryKey(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function sortAndReindex(list: LaundryServiceCategory[]): LaundryServiceCategory[] {
  const sorted = [...list].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return a.label.localeCompare(b.label, 'id');
  });

  return sorted.map((item, idx) => ({
    ...item,
    sortOrder: idx,
  }));
}

export const LaundryCategoryManagerModal: React.FC<LaundryCategoryManagerModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialCategories = [],
}) => {
  const dialog = useDialog();
  const [categories, setCategories] = useState<LaundryServiceCategory[]>([]);
  const [persistedKeys, setPersistedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form Tambah Kategori Baru
  const [newLabel, setNewLabel] = useState('');
  const [newIsPinned, setNewIsPinned] = useState(true);

  // Panel Pindahkan Layanan Massal
  const [reassignSourceKey, setReassignSourceKey] = useState<string | null>(null);
  const [reassignTargetKey, setReassignTargetKey] = useState<string>('');
  const [reassigning, setReassigning] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const res = await api.getLaundryCategories();
      if (res.status === 'success' && Array.isArray(res.data)) {
        const ordered = sortAndReindex(res.data);
        setCategories(ordered);
        setPersistedKeys(new Set(ordered.map((c) => c.key)));
      } else if (initialCategories.length > 0) {
        const ordered = sortAndReindex(initialCategories);
        setCategories(ordered);
      }
    } catch {
      if (initialCategories.length > 0) {
        setCategories(sortAndReindex(initialCategories));
      }
      dialog.toast('Gagal memuat daftar kategori terbaru', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setReassignSourceKey(null);
      setReassignTargetKey('');
      setNewLabel('');
      setNewIsPinned(true);
      if (initialCategories.length > 0) {
        setCategories(sortAndReindex(initialCategories));
      }
      loadCategories();
    }
  }, [isOpen]);

  const pinnedCategories = useMemo(
    () => categories.filter((c) => c.isPinned),
    [categories]
  );

  const unpinnedCategories = useMemo(
    () => categories.filter((c) => !c.isPinned),
    [categories]
  );

  if (!isOpen) return null;

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedLabel = newLabel.trim();
    if (!trimmedLabel) {
      dialog.toast('Nama kategori wajib diisi', 'error');
      return;
    }

    const key = normalizeCategoryKey(trimmedLabel);
    if (!key || key === 'ALL' || key === 'ADDON') {
      dialog.toast('Nama kategori tersebut tidak diperbolehkan (ALL / ADDON)', 'error');
      return;
    }

    if (categories.some((c) => c.key === key)) {
      dialog.toast(`Kategori "${key}" sudah terdaftar`, 'info');
      return;
    }

    const groupItems = newIsPinned ? pinnedCategories : unpinnedCategories;
    const maxGroupOrder = groupItems.reduce((max, c) => Math.max(max, c.sortOrder), -1);

    const newItem: LaundryServiceCategory = {
      key,
      label: trimmedLabel,
      isPinned: newIsPinned,
      sortOrder: maxGroupOrder + 1,
      serviceCount: 0,
      activeServiceCount: 0,
    };

    setCategories((prev) => sortAndReindex([...prev, newItem]));
    setNewLabel('');
    dialog.toast(`Kategori "${trimmedLabel}" ditambahkan ke daftar. Jangan lupa simpan urutan.`, 'success');
  };

  const handleTogglePin = (key: string) => {
    setCategories((prev) => {
      const target = prev.find((c) => c.key === key);
      if (!target) return prev;
      const nextPinned = !target.isPinned;
      const targetGroup = prev.filter((c) => c.isPinned === nextPinned && c.key !== key);
      const nextOrder = targetGroup.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;

      const updated = prev.map((c) =>
        c.key === key
          ? {
              ...c,
              isPinned: nextPinned,
              sortOrder: nextOrder,
            }
          : c
      );
      return sortAndReindex(updated);
    });
  };

  const handleMoveInGroup = (key: string, direction: 'UP' | 'DOWN') => {
    setCategories((prev) => {
      const target = prev.find((c) => c.key === key);
      if (!target) return prev;

      const sameGroup = prev.filter((c) => c.isPinned === target.isPinned);
      const otherGroup = prev.filter((c) => c.isPinned !== target.isPinned);
      const idx = sameGroup.findIndex((c) => c.key === key);
      if (idx === -1) return prev;

      const swapIdx = direction === 'UP' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sameGroup.length) return prev;

      const reorderedGroup = [...sameGroup];
      const temp = reorderedGroup[idx];
      reorderedGroup[idx] = reorderedGroup[swapIdx];
      reorderedGroup[swapIdx] = temp;

      const combined = target.isPinned
        ? [...reorderedGroup, ...otherGroup]
        : [...otherGroup, ...reorderedGroup];

      return combined.map((item, i) => ({
        ...item,
        sortOrder: i,
      }));
    });
  };

  const handleOpenReassign = (sourceKey: string) => {
    if (reassignSourceKey === sourceKey) {
      setReassignSourceKey(null);
      setReassignTargetKey('');
      return;
    }
    const candidates = categories.filter((c) => c.key !== sourceKey);
    setReassignSourceKey(sourceKey);
    setReassignTargetKey(candidates[0]?.key || '');
  };

  const handleConfirmReassign = async (sourceCat: LaundryServiceCategory) => {
    if (!reassignTargetKey) {
      dialog.toast('Pilih kategori tujuan terlebih dahulu', 'error');
      return;
    }
    const targetCat = categories.find((c) => c.key === reassignTargetKey);
    if (!targetCat) {
      dialog.toast('Kategori tujuan tidak valid', 'error');
      return;
    }

    const confirmed = await dialog.confirm({
      title: 'Pindahkan Layanan Massal',
      message: `Pindahkan seluruh ${sourceCat.serviceCount} layanan dari "${sourceCat.label}" ke kategori "${targetCat.label}"?`,
      variant: 'warning',
      confirmText: 'Ya, Pindahkan',
      cancelText: 'Batal',
    });
    if (!confirmed) return;

    try {
      setReassigning(true);
      const res = await api.reassignLaundryCategory({
        sourceCategory: sourceCat.key,
        targetCategory: targetCat.key,
        targetLabel: targetCat.label,
      });

      if (res.status !== 'success') {
        dialog.toast(res.message || 'Gagal memindahkan layanan', 'error');
        return;
      }

      const movedCount = res.data?.movedCount ?? sourceCat.serviceCount;

      // Refresh count dari backend sambil menjaga konfigurasi lokal (pin/urutan/kategori baru)
      const latestRes = await api.getLaundryCategories();
      if (latestRes.status === 'success' && Array.isArray(latestRes.data)) {
        const countByKey = new Map<string, { serviceCount: number; activeServiceCount: number }>();
        for (const item of latestRes.data as LaundryServiceCategory[]) {
          countByKey.set(item.key, {
            serviceCount: item.serviceCount,
            activeServiceCount: item.activeServiceCount,
          });
        }
        setPersistedKeys((prev) => {
          const next = new Set(prev);
          next.add(targetCat.key);
          next.add(sourceCat.key);
          return next;
        });
        setCategories((prev) =>
          sortAndReindex(
            prev.map((c) => {
              const latestCount = countByKey.get(c.key);
              if (latestCount) {
                return {
                  ...c,
                  serviceCount: latestCount.serviceCount,
                  activeServiceCount: latestCount.activeServiceCount,
                };
              }
              if (c.key === sourceCat.key) {
                return { ...c, serviceCount: 0, activeServiceCount: 0 };
              }
              return c;
            })
          )
        );
      } else {
        setCategories((prev) =>
          sortAndReindex(
            prev.map((c) => {
              if (c.key === sourceCat.key) {
                return { ...c, serviceCount: 0, activeServiceCount: 0 };
              }
              if (c.key === targetCat.key) {
                return {
                  ...c,
                  serviceCount: c.serviceCount + sourceCat.serviceCount,
                  activeServiceCount: c.activeServiceCount + sourceCat.activeServiceCount,
                };
              }
              return c;
            })
          )
        );
      }

      setReassignSourceKey(null);
      setReassignTargetKey('');
      dialog.toast(`${movedCount} layanan berhasil dipindahkan ke "${targetCat.label}"`, 'success');
      onSaved();
    } catch (err: any) {
      dialog.toast(err?.message || 'Terjadi kesalahan saat memindahkan layanan', 'error');
    } finally {
      setReassigning(false);
    }
  };

  const handleDeleteCategory = async (cat: LaundryServiceCategory) => {
    if (cat.serviceCount > 0) {
      dialog.toast(
        `Kategori "${cat.label}" masih memiliki ${cat.serviceCount} layanan tertaut. Pindahkan layanan ke kategori lain terlebih dahulu.`,
        'info'
      );
      return;
    }

    const confirmed = await dialog.confirm({
      title: 'Hapus Kategori',
      message: `Yakin ingin menghapus kategori "${cat.label}" (${cat.key})?`,
      variant: 'danger',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
    });
    if (!confirmed) return;

    try {
      setDeletingKey(cat.key);
      if (persistedKeys.has(cat.key)) {
        const res = await api.deleteLaundryCategory(cat.key);
        if (res.status !== 'success') {
          dialog.toast(res.message || 'Gagal menghapus kategori', 'error');
          return;
        }
      }

      setCategories((prev) => sortAndReindex(prev.filter((c) => c.key !== cat.key)));
      setPersistedKeys((prev) => {
        const next = new Set(prev);
        next.delete(cat.key);
        return next;
      });
      if (reassignSourceKey === cat.key) {
        setReassignSourceKey(null);
      }
      dialog.toast(`Kategori "${cat.label}" berhasil dihapus`, 'success');
      onSaved();
    } catch (err: any) {
      dialog.toast(err?.message || 'Terjadi kesalahan saat menghapus kategori', 'error');
    } finally {
      setDeletingKey(null);
    }
  };

  const handleSaveOrderAndPins = async () => {
    try {
      setSaving(true);
      const payload = sortAndReindex(categories).map((c, idx) => ({
        key: c.key,
        label: c.label.trim() || c.key,
        isPinned: Boolean(c.isPinned),
        sortOrder: idx,
      }));

      const res = await api.updateLaundryCategories(payload);
      if (res.status === 'success') {
        if (Array.isArray(res.data)) {
          const ordered = sortAndReindex(res.data);
          setCategories(ordered);
          setPersistedKeys(new Set(ordered.map((c) => c.key)));
        }
        dialog.toast('Urutan & pin kategori layanan berhasil disimpan', 'success');
        onSaved();
        onClose();
      } else {
        dialog.toast(res.message || 'Gagal menyimpan pengaturan kategori', 'error');
      }
    } catch (err: any) {
      dialog.toast(err?.message || 'Terjadi kesalahan sistem saat menyimpan kategori', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start sm:items-center justify-between gap-2.5 shrink-0 bg-slate-50/50">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="font-black text-slate-900 text-sm sm:text-base">
                  Kelola Kategori Layanan
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-900 border border-blue-200 whitespace-nowrap shrink-0">
                  {categories.length} Kategori • {pinnedCategories.length} Dipin
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Atur pin kategori prioritas di kasir, urutkan tab, pindahkan layanan massal, atau hapus kategori kosong.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal kategori"
            className="w-9 h-9 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-4 text-xs">
          {/* Form Tambah Kategori Baru */}
          <form
            onSubmit={handleAddCategory}
            className="p-3.5 sm:p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-3"
          >
            <div className="font-extrabold text-blue-950 text-xs flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-900 shrink-0" />
              <span>Tambah Kategori Baru</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Nama kategori (cth: Karpet Masjid, Bedcover Ekstra)..."
                className="flex-1 min-h-[42px] px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-900 focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-[42px] px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Tambah</span>
              </button>
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-[11px] font-bold text-slate-700">
              <input
                type="checkbox"
                checked={newIsPinned}
                onChange={(e) => setNewIsPinned(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900 cursor-pointer"
              />
              <Pin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Langsung Pin di Awal (tampil tepat di sebelah tab Semua)</span>
            </label>
          </form>

          {/* Daftar Kategori */}
          {loading && categories.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <div className="inline-block w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="font-bold">Memuat daftar kategori layanan...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="py-10 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
              <p className="font-bold text-slate-500">Belum ada kategori layanan.</p>
              <p className="text-[11px] mt-1">Tambahkan kategori baru menggunakan formulir di atas.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {categories.map((cat) => {
                const groupList = cat.isPinned ? pinnedCategories : unpinnedCategories;
                const posInGroup = groupList.findIndex((g) => g.key === cat.key);
                const isFirstInGroup = posInGroup <= 0;
                const isLastInGroup = posInGroup === groupList.length - 1;
                const targetOptions = categories.filter((c) => c.key !== cat.key);
                const isReassignOpen = reassignSourceKey === cat.key;
                const isLockedDelete = cat.serviceCount > 0;

                return (
                  <div
                    key={cat.key}
                    className={`p-3.5 rounded-2xl border transition-all space-y-3 ${
                      cat.isPinned
                        ? 'bg-amber-50/40 border-amber-200 shadow-2xs'
                        : 'bg-white border-slate-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Info Kategori */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 text-xs sm:text-sm truncate">
                            {cat.label}
                          </span>
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {cat.key}
                          </span>
                          {cat.isPinned && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                              <Pin className="w-3 h-3 shrink-0" />
                              <span>Dipin</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold border ${
                              cat.serviceCount > 0
                                ? 'bg-blue-50 text-blue-900 border-blue-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {cat.serviceCount} layanan
                          </span>
                          {cat.serviceCount > 0 && cat.activeServiceCount !== cat.serviceCount && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              ({cat.activeServiceCount} aktif)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Aksi Kategori */}
                      <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
                        {/* Pin / Unpin */}
                        <button
                          type="button"
                          onClick={() => handleTogglePin(cat.key)}
                          title={cat.isPinned ? 'Lepas pin kategori' : 'Pin kategori di posisi awal'}
                          className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                            cat.isPinned
                              ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
                              : 'bg-white hover:bg-amber-50 text-slate-700 border-slate-300'
                          }`}
                        >
                          {cat.isPinned ? (
                            <>
                              <PinOff className="w-3.5 h-3.5 shrink-0" />
                              <span>Lepas Pin</span>
                            </>
                          ) : (
                            <>
                              <Pin className="w-3.5 h-3.5 shrink-0" />
                              <span>Pin</span>
                            </>
                          )}
                        </button>

                        {/* Urutan ▲ / ▼ */}
                        <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                          <button
                            type="button"
                            disabled={isFirstInGroup}
                            onClick={() => handleMoveInGroup(cat.key, 'UP')}
                            title="Naikkan urutan"
                            className="min-h-[38px] w-9 flex items-center justify-center text-slate-700 hover:bg-slate-200 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <div className="w-px h-5 bg-slate-200" />
                          <button
                            type="button"
                            disabled={isLastInGroup}
                            onClick={() => handleMoveInGroup(cat.key, 'DOWN')}
                            title="Turunkan urutan"
                            className="min-h-[38px] w-9 flex items-center justify-center text-slate-700 hover:bg-slate-200 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Pindahkan Layanan Massal */}
                        {cat.serviceCount > 0 && targetOptions.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenReassign(cat.key)}
                            title="Pindahkan seluruh layanan ke kategori lain"
                            className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                              isReassignOpen
                                ? 'bg-blue-900 text-white border-blue-900'
                                : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-200'
                            }`}
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                            <span>Pindahkan</span>
                          </button>
                        )}

                        {/* Hapus Kategori */}
                        <button
                          type="button"
                          disabled={deletingKey === cat.key}
                          onClick={() => handleDeleteCategory(cat)}
                          title={
                            isLockedDelete
                              ? `Terkunci: masih ada ${cat.serviceCount} layanan tertaut. Pindahkan layanan dulu.`
                              : `Hapus kategori ${cat.label}`
                          }
                          className={`min-h-[38px] min-w-[38px] px-2.5 py-1.5 rounded-xl border flex items-center justify-center gap-1 transition-all ${
                            isLockedDelete
                              ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 cursor-pointer'
                          }`}
                        >
                          {isLockedDelete ? (
                            <Lock className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Panel Inline Pindahkan Layanan Massal */}
                    {isReassignOpen && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-blue-200 space-y-2.5 animate-fadeIn">
                        <div className="text-[11px] font-bold text-slate-700">
                          Pindahkan semua <strong>{cat.serviceCount} layanan</strong> dari{' '}
                          <span className="text-blue-900">{cat.label}</span> ke:
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <select
                              value={reassignTargetKey}
                              onChange={(e) => setReassignTargetKey(e.target.value)}
                              className="w-full min-h-[40px] px-3 py-2 pr-10 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-900 focus:outline-none appearance-none"
                            >
                              {targetOptions.map((opt) => (
                                <option key={opt.key} value={opt.key}>
                                  {opt.label} ({opt.serviceCount} layanan)
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setReassignSourceKey(null)}
                              className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                              Tutup
                            </button>
                            <button
                              type="button"
                              disabled={reassigning || !reassignTargetKey}
                              onClick={() => handleConfirmReassign(cat)}
                              className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {reassigning ? 'Memindahkan...' : 'Pindahkan Layanan'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="text-[11px] font-semibold text-slate-500 text-center sm:text-left">
            Kategori yang di-pin akan tampil paling awal di halaman Layanan &amp; Kasir.
          </p>

          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] sm:h-10 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-200 transition-all text-xs cursor-pointer flex items-center justify-center whitespace-nowrap"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveOrderAndPins}
              disabled={saving || loading}
              className="min-h-[44px] sm:h-10 px-4 sm:px-5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-md shadow-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan Urutan & Pin'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
