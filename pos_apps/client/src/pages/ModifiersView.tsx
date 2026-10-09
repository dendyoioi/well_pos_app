import React, { useState, useEffect, useMemo } from 'react';
import {
  Sliders,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  Info,
  Check,
  ToggleLeft,
  ToggleRight,
  Layers,
  Package,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import type { ModifierGroup, ModifierItem, UpsertModifierGroupInput } from '../types/modifier';
import type { RecipeInventoryItem } from '../types/recipe';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { TablePagination } from '../components/TablePagination';
import { formatRupiah } from '../utils/currency';
import { useDialog } from '../context/DialogContext';
import { Button } from '../components/ui/Button';

export const ModifiersView: React.FC = () => {
  const dialog = useDialog();
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [inventoryItems, setInventoryItems] = useState<RecipeInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Opsi Bahan Baku Terformat untuk Searchable Dropdown
  const inventoryOptions = useMemo(() => {
    return inventoryItems.map((inv) => ({
      value: inv.id,
      label: inv.name,
      sublabel: inv.itemCode ? `Kode: ${inv.itemCode}` : undefined,
      badge: inv.canonicalUom,
    }));
  }, [inventoryItems]);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Form State (In-Page Form, Zero Stacked Modals)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [formData, setFormData] = useState<UpsertModifierGroupInput>({
    name: '',
    selectionType: 'SINGLE',
    minSelection: 0,
    maxSelection: 1,
    isRequired: false,
    items: [
      { name: '', priceAdjustment: 0, isDefault: true },
      { name: '', priceAdjustment: 0, isDefault: false },
    ],
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchModifierGroups = async () => {
    setLoading(true);
    try {
      const [groupsRes, itemsRes] = await Promise.all([
        api.getModifierGroups(),
        api.getRecipeInventoryItems(),
      ]);
      if (groupsRes.status === 'success') {
        setGroups(groupsRes.data);
      }
      if (itemsRes.status === 'success' && Array.isArray(itemsRes.data)) {
        setInventoryItems(itemsRes.data);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal memuat grup modifier & bahan baku' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModifierGroups();
  }, []);

  const handleOpenCreate = () => {
    setEditingGroupId(null);
    setFormData({
      name: '',
      selectionType: 'SINGLE',
      minSelection: 0,
      maxSelection: 1,
      isRequired: false,
      items: [
        { name: '', priceAdjustment: 0, isDefault: true },
        { name: '', priceAdjustment: 0, isDefault: false },
      ],
    });
    setIsFormOpen(true);
    setFeedback(null);
  };

  const handleOpenEdit = (group: ModifierGroup) => {
    setEditingGroupId(group.id);
    setFormData({
      id: group.id,
      name: group.name,
      selectionType: group.selectionType,
      minSelection: group.minSelection,
      maxSelection: group.maxSelection,
      isRequired: group.isRequired,
      items: group.items.map((item) => {
        const eff = item.recipeEffects?.[0];
        return {
          id: item.id,
          name: item.name,
          priceAdjustment: Number(item.priceAdjustment) || 0,
          isDefault: item.isDefault,
          inventoryEffect: eff
            ? {
                inventoryItemId: eff.inventoryItemId,
                quantityDelta: Number(eff.quantityDelta) || 0,
              }
            : undefined,
        };
      }),
    });
    setIsFormOpen(true);
    setFeedback(null);
  };

  const handleItemInventoryEffectChange = (
    index: number,
    inventoryItemId: string,
    quantityDelta: number
  ) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      if (!inventoryItemId) {
        newItems[index] = { ...newItems[index], inventoryEffect: undefined };
      } else {
        newItems[index] = {
          ...newItems[index],
          inventoryEffect: {
            inventoryItemId,
            quantityDelta: Number(quantityDelta) || 0,
          },
        };
      }
      return { ...prev, items: newItems };
    });
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingGroupId(null);
  };

  const handleAddItemRow = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { name: '', priceAdjustment: 0, isDefault: false }],
    }));
  };

  const handleRemoveItemRow = (index: number) => {
    if (formData.items.length <= 1) {
      dialog.alert({
        title: 'Opsi Minimal',
        message: 'Grup modifier harus memiliki minimal 1 opsi pilihan.',
        variant: 'warning',
      });
      return;
    }
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemChange = (index: number, field: keyof ModifierItem, value: any) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      if (field === 'isDefault' && prev.selectionType === 'SINGLE' && value === true) {
        // Only 1 default allowed for SINGLE selection
        newItems.forEach((item, i) => {
          newItems[i] = { ...item, isDefault: i === index };
        });
      } else {
        newItems[index] = { ...newItems[index], [field]: value };
      }
      return { ...prev, items: newItems };
    });
  };

  const handleSelectionTypeChange = (type: 'SINGLE' | 'MULTIPLE') => {
    setFormData((prev) => ({
      ...prev,
      selectionType: type,
      maxSelection: type === 'SINGLE' ? 1 : Math.max(prev.items.length, 2),
      minSelection: prev.isRequired ? 1 : 0,
    }));
  };

  const handleToggleRequired = () => {
    setFormData((prev) => {
      const nextRequired = !prev.isRequired;
      return {
        ...prev,
        isRequired: nextRequired,
        minSelection: nextRequired ? Math.max(1, prev.minSelection) : 0,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFeedback({ type: 'error', message: 'Nama grup modifier wajib diisi' });
      return;
    }

    // Validasi nama setiap item opsi
    const emptyItems = formData.items.filter((it) => !it.name.trim());
    if (emptyItems.length > 0) {
      setFeedback({ type: 'error', message: 'Seluruh baris opsi pilihan wajib memiliki nama' });
      return;
    }

    setFormSubmitting(true);
    try {
      const res = await api.upsertModifierGroup(formData);
      if (res.status === 'success') {
        setFeedback({
          type: 'success',
          message: `Grup modifier "${formData.name}" berhasil ${editingGroupId ? 'diperbarui' : 'dibuat'}`,
        });
        handleCloseForm();
        fetchModifierGroups();
      } else {
        setFeedback({ type: 'error', message: res.message || 'Gagal menyimpan modifier' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Terjadi kesalahan sistem' });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (group: ModifierGroup) => {
    const ok = await dialog.confirm({
      title: 'Hapus Grup Modifier',
      message: `Yakin ingin menghapus grup modifier "${group.name}"? Pilihan opsi ini tidak akan lagi muncul di kasir.`,
      variant: 'danger',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
    });
    if (!ok) return;

    setDeletingId(group.id);
    try {
      const res = await api.deleteModifierGroup(group.id);
      if (res.status === 'success') {
        setFeedback({ type: 'success', message: `Grup modifier "${group.name}" berhasil dihapus` });
        fetchModifierGroups();
      } else {
        setFeedback({ type: 'error', message: res.message || 'Gagal menghapus grup modifier' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal menghapus modifier' });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reset pagination ke halaman 1 saat filter atau pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedGroups = filteredGroups.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const totalOptions = groups.reduce((acc, g) => acc + (g.items?.length || 0), 0);

  // VIEW: IN-PAGE FORM MODE
  if (isFormOpen) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-16">
        {/* Header Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCloseForm}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Menu &amp; Produk / Modifier &amp; Topping
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              {editingGroupId ? `Ubah Grup: ${formData.name}` : 'Tambah Grup Modifier & Topping Baru'}
            </h1>
          </div>
        </div>

        {feedback && (
          <div
            className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
              feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card 1: Informasi Dasar Grup */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              1. Pengaturan Dasar Grup
            </h2>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Nama Grup Modifier <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Contoh: Pilihan Susu, Level Gula, Tingkat Es, Ekstra Topping"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 font-medium text-sm transition-all"
                required
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Nama ini menjadi judul kelompok pilihan saat kasir atau pelanggan memesan menu.
              </p>
            </div>

            {/* Selection Type */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Tipe Pilihan Pelanggan
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => handleSelectionTypeChange('SINGLE')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    formData.selectionType === 'SINGLE'
                      ? 'border-blue-900 bg-blue-50/50 text-blue-950 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm">Pilih 1 Saja (Radio Button)</span>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        formData.selectionType === 'SINGLE' ? 'border-blue-900 bg-blue-900' : 'border-slate-300'
                      }`}
                    >
                      {formData.selectionType === 'SINGLE' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Pelanggan hanya boleh memilih 1 opsi. Cocok untuk <em>Level Manis, Tingkat Es, Pilihan Susu</em>.
                  </p>
                </div>

                <div
                  onClick={() => handleSelectionTypeChange('MULTIPLE')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    formData.selectionType === 'MULTIPLE'
                      ? 'border-blue-900 bg-blue-50/50 text-blue-950 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm">Boleh Pilih Banyak (Checkbox)</span>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        formData.selectionType === 'MULTIPLE' ? 'border-blue-900 bg-blue-900 text-white' : 'border-slate-300'
                      }`}
                    >
                      {formData.selectionType === 'MULTIPLE' && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Pelanggan dapat memilih lebih dari 1 opsi. Cocok untuk <em>Aneka Topping, Ekstra Shot, Saus Tambahan</em>.
                  </p>
                </div>
              </div>
            </div>

            {/* Switch Wajib Dipilih */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-slate-800 block">Wajib Dipilih oleh Pelanggan</span>
                <span className="text-xs text-slate-500">
                  Jika aktif, kasir atau tamu tidak bisa menambahkan produk ke keranjang tanpa memilih opsi ini.
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleRequired}
                className="text-blue-600 focus:outline-none"
              >
                {formData.isRequired ? (
                  <ToggleRight className="w-9 h-9 fill-blue-600 text-white" />
                ) : (
                  <ToggleLeft className="w-9 h-9 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          {/* Card 2: Daftar Pilihan Opsi */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">2. Opsi Pilihan Modifier</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Masukkan nama variasi rasa/tambahan dan nominal harga tambahan (jika berbayar).
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Opsi</span>
              </button>
            </div>

            <div className="space-y-3.5">
              {formData.items.map((item, index) => (
                <div
                  key={index}
                  className="p-4 bg-slate-50/70 border border-slate-200/90 rounded-xl space-y-3 hover:border-slate-300 transition-colors"
                >
                  {/* Baris 1: Atribut Utama (Nama Opsi, Tambahan Harga, Bawaan, Hapus) */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                    {/* Nama Opsi */}
                    <div className="sm:col-span-6">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nama Opsi #{index + 1} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        placeholder="Contoh: Fresh Milk / Less Sugar / Boba"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
                        required
                      />
                    </div>

                    {/* Tambahan Harga (+Rp) via CurrencyInput */}
                    <div className="sm:col-span-4">
                      <CurrencyInput
                        label="Tambahan Harga"
                        value={item.priceAdjustment}
                        onChange={(num) => handleItemChange(index, 'priceAdjustment', num)}
                        placeholder="0"
                        inputClassName="py-2 text-sm"
                      />
                    </div>

                    {/* Default & Delete */}
                    <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-6">
                      <label
                        className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 px-2.5 py-2 rounded-lg border border-slate-200 transition-colors"
                        title="Jadikan pilihan standar terpilih"
                      >
                        <input
                          type="checkbox"
                          checked={item.isDefault}
                          onChange={(e) => handleItemChange(index, 'isDefault', e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Bawaan</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(index)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus baris opsi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Baris 2: Sub-Card Efek Pengurangan Bahan Baku (BOM / Pemotongan Stok) */}
                  <div className="p-3 bg-white border border-slate-200/90 rounded-lg">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <Package className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Koneksi Bahan Baku (BOM / Pemotongan Stok)</span>
                        {item.inventoryEffect?.inventoryItemId && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                            Terhubung
                          </span>
                        )}
                      </div>
                      {item.inventoryEffect?.inventoryItemId && (
                        <button
                          type="button"
                          onClick={() => handleItemInventoryEffectChange(index, '', 0)}
                          className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                          <span>Lepas Bahan Baku</span>
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      {/* Dropdown Bahan Baku dengan Fitur Pencarian (Searchable Dropdown) */}
                      <div className="w-full sm:w-72 lg:w-80 shrink-0">
                        <SearchableSelect
                          value={item.inventoryEffect?.inventoryItemId || ''}
                          onChange={(selectedId) => {
                            handleItemInventoryEffectChange(
                              index,
                              selectedId,
                              item.inventoryEffect?.quantityDelta || 1
                            );
                          }}
                          options={inventoryOptions}
                          placeholder="-- Tanpa Efek Bahan Baku --"
                          searchPlaceholder="Cari nama atau kode bahan baku..."
                          emptyMessage="Tidak ada bahan baku ditemukan"
                          emptyLabel="-- Tanpa Efek Bahan Baku --"
                          accentColor="amber"
                        />
                      </div>

                      {/* Jika Terhubung: Input Takaran & Satuan */}
                      {item.inventoryEffect?.inventoryItemId ? (
                        <div className="flex items-center gap-1.5">
                          <div className="relative w-28 sm:w-32 shrink-0">
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={item.inventoryEffect.quantityDelta || ''}
                              onChange={(e) =>
                                handleItemInventoryEffectChange(
                                  index,
                                  item.inventoryEffect!.inventoryItemId,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              placeholder="Takaran"
                              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-700 bg-amber-50 px-2.5 py-2 rounded-lg border border-amber-200 shrink-0">
                            {inventoryItems.find((ii) => ii.id === item.inventoryEffect?.inventoryItemId)
                              ?.canonicalUom || 'Satuan'}
                          </span>
                          <span className="text-[11px] text-slate-400 ml-1 hidden sm:inline">
                            per porsi
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">
                          Pilih jika opsi ini memotong stok fisik saat dipesan kasir (cth: Susu, Sirup, Cup)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddItemRow}
              className="w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Opsi Tambahan Baru</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleCloseForm}
              disabled={formSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={formSubmitting}
            >
              {editingGroupId ? 'Simpan Perubahan' : 'Buat Grup Modifier'}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // VIEW: LIST / GRID MODE
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Menu &amp; Produk</span>
            <span>•</span>
            <span className="text-blue-600">Kustomisasi F&amp;B</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Modifier &amp; Topping</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Atur opsi tambahan sajian hidangan seperti level gula, pilihan susu alternatif, es batu, dan aneka topping berbayar.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleOpenCreate}
            fullWidthOnMobile
          >
            Tambah Grup Modifier
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm min-w-0">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <Sliders className="w-6 h-6 shrink-0" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">Total Grup Modifier</div>
            <div className="text-2xl font-bold text-slate-900">{groups.length} Kelompok</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm min-w-0">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
            <Layers className="w-6 h-6 shrink-0" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">Total Opsi Pilihan</div>
            <div className="text-2xl font-bold text-slate-900">{totalOptions} Opsi Rasa/Topping</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm min-w-0">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <Info className="w-6 h-6 shrink-0" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">Standar Operasional</div>
            <div className="text-sm font-bold text-slate-800">Tersinkronisasi Kasir &amp; QR Meja</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari grup modifier (misal: Level Gula, Susu, Topping)..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Grid Modifier Groups */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
          <p className="text-sm font-medium">Memuat data modifier &amp; topping...</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
          <Sliders className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">
            {searchTerm ? 'Grup modifier tidak ditemukan' : 'Belum Ada Grup Modifier'}
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? `Tidak ada grup modifier yang cocok dengan kata kunci "${searchTerm}".`
              : 'Buat kustomisasi hidangan pertama Anda seperti Pilihan Susu (Oatmilk +Rp 7.000) atau Level Manis.'}
          </p>
          {!searchTerm && (
            <button
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 bg-blue-900 hover:bg-blue-800 active:scale-95 text-white font-extrabold rounded-xl text-xs sm:text-sm inline-flex items-center gap-2 shadow-md shadow-blue-900/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Grup Pertama</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedGroups.map((group) => (
            <div
              key={group.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{group.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md">
                        {group.selectionType === 'SINGLE' ? 'Pilih 1 (Radio)' : 'Boleh Banyak (Checkbox)'}
                      </span>
                      {group.isRequired ? (
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-xs font-bold rounded-md border border-rose-200">
                          Wajib
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-50 text-slate-500 text-xs font-medium rounded-md">
                          Opsional
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                    {group.items?.length || 0} Opsi
                  </span>
                </div>

                {/* Items Preview */}
                <div className="space-y-1.5 mt-4 pt-3 border-t border-slate-100">
                  {group.items?.map((item) => (
                    <div
                      key={item.id || item.name}
                      className="py-1.5 px-2.5 rounded-lg text-xs bg-slate-50 text-slate-700 font-medium space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                          <span className="truncate">{item.name}</span>
                          {item.isDefault && (
                            <span className="text-[10px] text-blue-700 font-bold bg-blue-100/70 px-1.5 py-0.5 rounded">
                              Bawaan
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-slate-900 ml-2 flex-shrink-0">
                          {Number(item.priceAdjustment) > 0 ? `+${formatRupiah(Number(item.priceAdjustment))}` : 'Gratis'}
                        </span>
                      </div>

                      {item.recipeEffects && item.recipeEffects.length > 0 && item.recipeEffects[0].inventoryItem && (
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 rounded px-1.5 py-0.5">
                          <Package className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="truncate">
                            Potong {Number(item.recipeEffects[0].quantityDelta)} {item.recipeEffects[0].inventoryItem.canonicalUom} {item.recipeEffects[0].inventoryItem.name}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {group.products && group.products.length > 0 ? `${group.products.length} Menu Terhubung` : 'Siap Terhubung'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(group)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Ubah Grup"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(group)}
                    disabled={deletingId === group.id}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Hapus Grup"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          </div>

          {/* Pagination Grup Modifier */}
          {!loading && filteredGroups.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <TablePagination
                currentPage={safeCurrentPage}
                pageSize={pageSize}
                totalItems={filteredGroups.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
                itemLabel="grup modifier"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
