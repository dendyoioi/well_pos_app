import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  AlertCircle,
  PackagePlus,
  Check,
  Image as ImageIcon,
  Upload,
  Plus,
  Trash2,
  Sliders,
  Search,
  ChevronDown,
  CheckCircle2,
  Infinity as InfinityIcon,
  Package,
} from 'lucide-react';
import type { Product, Category } from '../types/product';
import type { ModifierGroup } from '../types/modifier';
import { api } from '../services/api';
import { CurrencyInput } from './ui/CurrencyInput';
import { useDialog } from '../context/DialogContext';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  productToEdit?: Product | null;
  categories: Category[];
  outletId?: string;
}

// Default daftar satuan unit yang umum di F&B dan Retail
const DEFAULT_UNITS = [
  'Pcs',
  'Cup',
  'Botol',
  'Porsi',
  'Box',
  'Kg',
  'Gram',
  'Liter',
  'Sachet',
  'Paket',
  'Mangkok',
  'Piring',
  'Gelas',
  'Bungkus',
  'Loyang',
  'Potong',
  'Set',
];

// Preset foto makanan & minuman populer F&B
const PRESET_IMAGES = [
  { label: '☕ Kopi', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80' },
  { label: '🧋 Boba Tea', url: 'https://images.unsplash.com/photo-1558857563-b37cf0088195?w=400&auto=format&fit=crop&q=80' },
  { label: '🥤 Es Teh', url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&auto=format&fit=crop&q=80' },
  { label: '🍗 Ayam', url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&auto=format&fit=crop&q=80' },
  { label: '🍜 Mie/Bakso', url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop&q=80' },
  { label: '🍔 Burger', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=80' },
  { label: '🍟 Kentang', url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&auto=format&fit=crop&q=80' },
  { label: '🍰 Pastry', url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&auto=format&fit=crop&q=80' },
];

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  productToEdit,
  categories,
  outletId,
}) => {
  const dialog = useDialog();
  const isEdit = !!productToEdit;

  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [costPrice, setCostPrice] = useState<number>(0);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [unit, setUnit] = useState('Pcs');
  const [hasStock, setHasStock] = useState<boolean>(false); // Default F&B: Olahan Dapur / Resep BOM
  const [initialStock, setInitialStock] = useState<number>(0);
  const [minStockAlert, setMinStockAlert] = useState<number>(5);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Unit Search & Add State
  const [unitList, setUnitList] = useState<string[]>(DEFAULT_UNITS);
  const [unitSearch, setUnitSearch] = useState('');
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const unitDropdownRef = useRef<HTMLDivElement>(null);

  // Category Search State
  const [categorySearch, setCategorySearch] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Relational Modifiers state
  const [availableModifierGroups, setAvailableModifierGroups] = useState<ModifierGroup[]>([]);
  const [selectedModifierGroupIds, setSelectedModifierGroupIds] = useState<string[]>([]);
  const [loadingModifiers, setLoadingModifiers] = useState(false);

  // Quick Category Add
  const [showQuickCategory, setShowQuickCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryList, setCategoryList] = useState<Category[]>(categories);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle click outside to close unit & category dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(event.target as Node)) {
        setIsUnitDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setCategoryList(categories);
  }, [categories]);

  useEffect(() => {
    if (!isOpen) return;

    // Load centralized modifier groups
    const loadModifiers = async () => {
      setLoadingModifiers(true);
      try {
        const res = await api.getModifierGroups();
        if (res.status === 'success' && res.data) {
          setAvailableModifierGroups(res.data);
        }
      } catch (err) {
        console.error('Gagal memuat modifier groups:', err);
      } finally {
        setLoadingModifiers(false);
      }
    };
    loadModifiers();

    if (productToEdit) {
      setName(productToEdit.name);
      setBarcode(productToEdit.barcode);
      setSku(productToEdit.sku);
      setCategoryId(productToEdit.category.id);
      setCostPrice(productToEdit.costPrice);
      setBasePrice(productToEdit.basePrice);
      setUnit(productToEdit.unit);
      setMinStockAlert(productToEdit.minStockAlert);
      setImageUrl(productToEdit.imageUrl || '');

      // Parse description and check for hasStock metadata
      let loadedHasStock = true;
      let rawDesc = productToEdit.description || '';
      if (rawDesc.startsWith('{')) {
        try {
          const parsed = JSON.parse(rawDesc);
          if (parsed.hasStock !== undefined) {
            loadedHasStock = Boolean(parsed.hasStock);
          }
          setDescription(parsed.text || '');
        } catch {
          setDescription(rawDesc);
        }
      } else {
        setDescription(rawDesc);
      }

      if (productToEdit.stock >= 99999) {
        loadedHasStock = false;
      }
      setHasStock(loadedHasStock);

      // Ensure unit is in unitList
      if (productToEdit.unit && !DEFAULT_UNITS.includes(productToEdit.unit)) {
        setUnitList((prev) => (prev.includes(productToEdit.unit) ? prev : [...prev, productToEdit.unit]));
      }

      // Initialize selected modifier IDs from relational product.modifiers
      const linkedIds = productToEdit.modifiers?.map((m) => m.id) || [];
      setSelectedModifierGroupIds(linkedIds);
    } else {
      // Reset form
      setName('');
      setBarcode('');
      setSku('');
      setCategoryId(categories[0]?.id || '');
      setCostPrice(0);
      setBasePrice(0);
      setUnit('Pcs');
      setHasStock(false); // Default F&B: Olahan Dapur / Resep BOM (Made-to-Order)
      setInitialStock(0);
      setMinStockAlert(5);
      setDescription('');
      setImageUrl('');
      setSelectedModifierGroupIds([]);
    }
    setError(null);
    setShowQuickCategory(false);
    setNewCategoryName('');
    setIsUnitDropdownOpen(false);
    setUnitSearch('');
    setIsCategoryDropdownOpen(false);
    setCategorySearch('');
  }, [productToEdit, isOpen]);

  if (!isOpen) return null;

  // Generator Barcode acak untuk memudahkan pengujian kasir
  const generateRandomBarcode = () => {
    const randomEan = '899' + Math.floor(1000000000 + Math.random() * 9000000000);
    setBarcode(randomEan);
  };

  // Generator SKU otomatis berdasarkan nama atau kategori
  const generateAutoSku = () => {
    const cat = categoryList.find((c) => c.id === categoryId)?.name.substring(0, 3).toUpperCase() || 'ITM';
    const rand = Math.floor(100 + Math.random() * 900);
    setSku(`${cat}-${rand}`);
  };

  // Handle local image file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Ukuran file foto maksimal 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Quick Category Create
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await api.createCategory(newCategoryName.trim());
      if (res.status === 'success' && res.data) {
        setCategoryList((prev) => [...prev, res.data!]);
        setCategoryId(res.data.id);
        setNewCategoryName('');
        setShowQuickCategory(false);
        setIsCategoryDropdownOpen(false);
        setCategorySearch('');
        dialog.toast(`Kategori "${res.data.name}" berhasil ditambahkan`, 'success');
      } else {
        dialog.alert({
          title: 'Gagal Menambah Kategori',
          message: res.message || 'Gagal menambahkan kategori.',
          variant: 'danger',
        });
      }
    } catch {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: 'Terjadi kesalahan saat menambah kategori.',
        variant: 'danger',
      });
    }
  };

  // Handle Create Category directly from Search bar
  const handleCreateCategoryFromSearch = async (catName: string) => {
    const trimmed = catName.trim();
    if (!trimmed) return;
    try {
      const res = await api.createCategory(trimmed);
      if (res.status === 'success' && res.data) {
        setCategoryList((prev) => [...prev, res.data!]);
        setCategoryId(res.data.id);
        setIsCategoryDropdownOpen(false);
        setCategorySearch('');
        dialog.toast(`Kategori "${res.data.name}" berhasil ditambahkan`, 'success');
      } else {
        dialog.alert({
          title: 'Gagal Menambah Kategori',
          message: res.message || 'Gagal menambahkan kategori.',
          variant: 'danger',
        });
      }
    } catch {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: 'Terjadi kesalahan saat menambah kategori.',
        variant: 'danger',
      });
    }
  };

  // Handle Add Custom Unit
  const handleAddCustomUnit = (newUnitStr: string) => {
    const trimmed = newUnitStr.trim();
    if (!trimmed) return;
    if (!unitList.some((u) => u.toLowerCase() === trimmed.toLowerCase())) {
      setUnitList((prev) => [...prev, trimmed]);
    }
    setUnit(trimmed);
    setUnitSearch('');
    setIsUnitDropdownOpen(false);
  };

  // Toggle pemilihan grup modifier terpusat untuk produk ini
  const toggleModifierGroup = (groupId: string) => {
    setSelectedModifierGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Encode metadata hasStock ke deskripsi untuk kompatibilitas filter F&B
    let finalDescription = description.trim();
    if (!hasStock) {
      finalDescription = JSON.stringify({
        text: description.trim(),
        hasStock: false,
      });
    }

    try {
      if (isEdit && productToEdit) {
        const res = await api.updateProduct(productToEdit.id, {
          name,
          barcode,
          sku,
          categoryId,
          costPrice: Number(costPrice),
          basePrice: Number(basePrice),
          unit,
          description: finalDescription,
          imageUrl: imageUrl.trim() || undefined,
          minStockAlert: hasStock ? Number(minStockAlert) : 0,
        });

        if (res.status === 'success') {
          // Sinkronisasi relasi modifier terpusat
          const linkRes = await api.linkProductModifiers(productToEdit.id, selectedModifierGroupIds);
          if (linkRes && linkRes.status === 'error') {
            setError(linkRes.message || 'Gagal menghubungkan modifier ke produk');
            return;
          }
          onSuccess();
          onClose();
        } else {
          setError(res.message || 'Gagal memperbarui produk');
        }
      } else {
        const res = await api.createProduct({
          name,
          barcode,
          sku,
          categoryId,
          costPrice: Number(costPrice),
          basePrice: Number(basePrice),
          unit,
          initialStock: hasStock ? Number(initialStock) : 999999,
          minStockAlert: hasStock ? Number(minStockAlert) : 0,
          description: finalDescription,
          imageUrl: imageUrl.trim() || undefined,
          outletId: outletId || undefined,
        });

        if (res.status === 'success' && res.data?.id) {
          // Hubungkan produk baru ke modifier groups terpilih jika ada
          if (selectedModifierGroupIds.length > 0) {
            const linkRes = await api.linkProductModifiers(res.data.id, selectedModifierGroupIds);
            if (linkRes && linkRes.status === 'error') {
              setError(linkRes.message || 'Gagal menghubungkan modifier ke produk');
              return;
            }
          }
          onSuccess();
          onClose();
        } else {
          setError(res.message || 'Gagal menambahkan produk');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[90vh]">
        {/* Header Modal */}
        <div className="px-5 py-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-sm shrink-0">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-blue-950 text-base sm:text-lg truncate">
                {isEdit ? 'Edit Data Produk' : 'Tambah Produk Baru'}
              </h3>
              <p className="text-xs text-slate-500 truncate">
                {isEdit
                  ? 'Perbarui informasi katalog, foto, harga, dan kustomisasi rasa/topping'
                  : 'Input data katalog, foto produk, dan kustomisasi makanan/minuman'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Isi */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
            {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Foto Produk */}
          <div className="bg-slate-50/70 border border-slate-200 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-blue-900" />
                <span>Foto Produk</span>
              </label>
              <span className="text-[11px] text-slate-400">Pilih template foto atau upload mandiri</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {/* Preview Box */}
              <div className="relative w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner group">
                {imageUrl ? (
                  <>
                    <img
                      src={imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={() => setImageUrl('')}
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1"
                    >
                      <Trash2 className="w-4 h-4 text-rose-300" /> Hapus
                    </button>
                  </>
                ) : (
                  <div className="text-center p-2 text-slate-400">
                    <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" />
                    <span className="text-[10px] leading-tight block">Belum ada foto</span>
                  </div>
                )}
              </div>

              {/* Upload & Presets */}
              <div className="flex-1 space-y-2.5 w-full">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Tempel URL gambar (https://...)"
                    className="flex-1 bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3 py-2 text-xs outline-none"
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-900" /> Upload File
                  </button>
                </div>

                {/* Preset Chips */}
                <div>
                  <div className="text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                    Foto Cepat (Klik untuk memilih):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_IMAGES.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setImageUrl(preset.url)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                          imageUrl === preset.url
                            ? 'bg-blue-900 text-white border-blue-900 font-bold shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Informasi Utama */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nama Produk */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Produk *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="misal: Kopi Susu Aren Spesial"
                className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all outline-none"
              />
            </div>

            {/* Kategori dengan shortcut Tambah Cepat dan Pencarian */}
            <div className="relative" ref={categoryDropdownRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Kategori *
                </label>
                <button
                  type="button"
                  onClick={() => setShowQuickCategory(!showQuickCategory)}
                  className="text-[11px] font-bold text-blue-900 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Kategori Baru
                </button>
              </div>

              {showQuickCategory ? (
                <div className="flex items-center gap-1.5 mb-2 p-2 bg-blue-50/60 border border-blue-200 rounded-xl">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nama kategori baru..."
                    className="flex-1 bg-white border border-blue-300 text-xs px-2.5 py-1.5 rounded-lg outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    className="px-2.5 py-1.5 bg-blue-900 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                  >
                    Simpan
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQuickCategory(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : null}

              {/* Custom Searchable Category Dropdown Button */}
              <button
                type="button"
                id="product-category-btn"
                onClick={() => {
                  setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                  setIsUnitDropdownOpen(false);
                }}
                className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all outline-none flex items-center justify-between text-left cursor-pointer shadow-xs"
              >
                <span className="truncate font-medium text-slate-800">
                  {categoryList.find((c) => c.id === categoryId)?.name || '-- Pilih Kategori --'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </button>

              {/* Popover Pencarian Kategori */}
              {isCategoryDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 space-y-1.5 animate-fadeIn">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      placeholder="Ketik untuk mencari kategori..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-900 focus:bg-white"
                      autoFocus
                    />
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-0.5">
                    {categoryList
                      .filter((c) => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCategoryId(c.id);
                            setIsCategoryDropdownOpen(false);
                            setCategorySearch('');
                          }}
                          className={`w-full px-3 py-2 text-xs rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                            c.id === categoryId
                              ? 'bg-blue-900 text-white font-bold shadow-xs'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{c.name}</span>
                          {c.id === categoryId && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}

                    {categoryList.filter((c) =>
                      c.name.toLowerCase().includes(categorySearch.toLowerCase())
                    ).length === 0 && (
                      <div className="p-3 text-center text-xs text-slate-400">
                        Kategori "{categorySearch}" tidak ditemukan
                      </div>
                    )}
                  </div>

                  {categorySearch.trim() &&
                    !categoryList.some(
                      (c) => c.name.toLowerCase() === categorySearch.trim().toLowerCase()
                    ) && (
                      <div className="pt-1.5 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleCreateCategoryFromSearch(categorySearch)}
                          className="w-full px-3 py-2 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Buat kategori "{categorySearch.trim()}"</span>
                        </button>
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Satuan Unit dengan Pencarian dan Tambah Mandiri */}
            <div className="relative" ref={unitDropdownRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Satuan Unit *
                </label>
                <span className="text-[10px] text-slate-400">Bisa cari & tambah</span>
              </div>

              {/* Custom Searchable Unit Dropdown Button */}
              <button
                type="button"
                id="product-unit-btn"
                onClick={() => {
                  setIsUnitDropdownOpen(!isUnitDropdownOpen);
                  setIsCategoryDropdownOpen(false);
                }}
                className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all outline-none flex items-center justify-between text-left cursor-pointer shadow-xs"
              >
                <span className="font-semibold text-slate-800">{unit}</span>
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </button>

              {/* Popover Pencarian Satuan Unit */}
              {isUnitDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 space-y-1.5 animate-fadeIn">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={unitSearch}
                      onChange={(e) => setUnitSearch(e.target.value)}
                      placeholder="Cari atau ketik satuan baru..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-900 focus:bg-white"
                      autoFocus
                    />
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-0.5">
                    {unitList
                      .filter((u) => u.toLowerCase().includes(unitSearch.toLowerCase()))
                      .map((uItem) => (
                        <button
                          key={uItem}
                          type="button"
                          onClick={() => {
                            setUnit(uItem);
                            setIsUnitDropdownOpen(false);
                            setUnitSearch('');
                          }}
                          className={`w-full px-3 py-1.5 text-xs rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                            uItem === unit
                              ? 'bg-blue-900 text-white font-bold shadow-xs'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{uItem}</span>
                          {uItem === unit && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}

                    {unitList.filter((u) =>
                      u.toLowerCase().includes(unitSearch.toLowerCase())
                    ).length === 0 && (
                      <div className="p-3 text-center text-xs text-slate-400">
                        Satuan "{unitSearch}" belum ada
                      </div>
                    )}
                  </div>

                  {unitSearch.trim() &&
                    !unitList.some(
                      (u) => u.toLowerCase() === unitSearch.trim().toLowerCase()
                    ) && (
                      <div className="pt-1.5 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleAddCustomUnit(unitSearch)}
                          className="w-full px-3 py-2 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Gunakan "{unitSearch.trim()}" sebagai satuan baru</span>
                        </button>
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Barcode EAN */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Barcode (EAN-13) *
                </label>
                <button
                  type="button"
                  onClick={generateRandomBarcode}
                  className="text-[11px] font-semibold text-blue-900 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" /> Auto
                </button>
              </div>
              <input
                type="text"
                required
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="misal: 8991234567809"
                className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm font-mono transition-all outline-none"
              />
            </div>

            {/* SKU */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Kode SKU *
                </label>
                <button
                  type="button"
                  onClick={generateAutoSku}
                  className="text-[11px] font-semibold text-blue-900 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" /> Auto
                </button>
              </div>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="misal: DRK-001"
                className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm font-mono transition-all outline-none"
              />
            </div>

            {/* Harga Modal (HPP) - Auto-Format Rupiah */}
            <div>
              <CurrencyInput
                id="product-cost-price"
                label="Harga Modal (HPP)"
                required
                value={costPrice}
                onChange={(val) => setCostPrice(val)}
                placeholder="0"
                inputClassName="font-semibold text-slate-900"
              />
            </div>

            {/* Harga Jual (HPJ) - Auto-Format Rupiah */}
            <div>
              <CurrencyInput
                id="product-base-price"
                label="Harga Jual Standar"
                required
                value={basePrice}
                onChange={(val) => setBasePrice(val)}
                placeholder="0"
                inputClassName="font-bold text-blue-950"
              />
            </div>

            {/* Opsi Tipe Pengelolaan: Olahan F&B (Made to Order) vs Barang Kemasan Ritel */}
            <div className="sm:col-span-2 bg-slate-50/90 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-900" />
                    Tipe Produk & Kontrol Stok
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {!hasStock
                      ? 'Olahan Dapur F&B (Made-to-Order): Kasir tidak diblokir sisa stok, pengurangan bahan baku dilacak via Resep/BOM.'
                      : 'Barang Kemasan Ritel Fisik: Kuantitas stok dihitung per unit dan berkurang langsung di kasir.'}
                  </p>
                </div>

                {/* Segmented Toggle Control */}
                <div className="flex items-center bg-slate-200/80 p-1 rounded-xl gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setHasStock(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      !hasStock
                        ? 'bg-blue-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <InfinityIcon className={`w-3.5 h-3.5 ${!hasStock ? 'text-amber-300' : 'text-slate-400'}`} />
                    Resep / Dapur F&B
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasStock(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      hasStock
                        ? 'bg-blue-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${hasStock ? 'text-emerald-400' : 'text-slate-400'}`} />
                    Barang Ritel Fisik
                  </button>
                </div>
              </div>

              {/* Sub-Panel Input Stok atau Banner Bebas Stok */}
              {!hasStock ? (
                <div className="p-3 bg-blue-50 border border-blue-200/90 rounded-xl text-xs text-blue-950 flex items-center gap-2">
                  <span className="text-base">🍳</span>
                  <span>
                    Produk diatur sebagai <strong>Menu Olahan Dapur F&B (Made-to-Order)</strong>. Kasir dapat menjual bebas tanpa pembatasan kuantitas etalase. Bahan baku (kopi, gula, susu, dll.) dipotong otomatis saat transaksi melalui sistem <strong>Resep / BOM</strong>.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-slate-200/70">
                  {!isEdit && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Stok Awal Fisik (Opsional)
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">Bisa 0</span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        value={initialStock === 0 ? '' : initialStock}
                        placeholder="0 (Bisa diisi nanti via Stok Masuk Gudang)"
                        onChange={(e) => setInitialStock(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                        className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2 text-sm transition-all outline-none"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Biarkan kosong/0 jika stok akan dimasukkan nanti lewat menu Stok Masuk (PO Gudang) atau Transfer Toko.
                      </p>
                    </div>
                  )}
                  <div className={isEdit ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Batas Minimum Notifikasi Stok Menipis
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={minStockAlert}
                      onChange={(e) => setMinStockAlert(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2 text-sm transition-all outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Deskripsi */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Deskripsi Produk (Opsional)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Catatan komposisi atau spesifikasi produk..."
                className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2 text-sm transition-all outline-none"
              />
            </div>
          </div>

          {/* Section 3: Pilihan Kustomisasi Terpusat (Modifiers & Topping F&B) */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-blue-950 flex items-center gap-1.5 uppercase tracking-wider">
                  <Sliders className="w-4 h-4 text-blue-900" />
                  <span>Kustomisasi Dinamis (Modifiers & Topping)</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Pilih grup varian & kustomisasi terpusat yang berlaku untuk menu ini (Level pedas, sugar, es, topping).
                </p>
              </div>
              <span className="text-[11px] font-semibold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 self-start sm:self-auto">
                {selectedModifierGroupIds.length} grup dipilih
              </span>
            </div>

            {loadingModifiers ? (
              <div className="text-center py-6 bg-white/60 rounded-xl border border-slate-200 text-xs text-slate-500">
                Memuat daftar modifier terpusat...
              </div>
            ) : availableModifierGroups.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-white/60 space-y-1">
                <Sliders className="w-7 h-7 text-slate-300 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-600">
                  Belum ada grup modifier di sistem
                </p>
                <p className="text-[11px] text-slate-400">
                  Kelola master grup varian & topping terpusat melalui tab <strong>Modifiers</strong> di menu Katalog Produk.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {availableModifierGroups.map((group) => {
                  const isChecked = selectedModifierGroupIds.includes(group.id);
                  return (
                    <div
                      key={group.id}
                      onClick={() => toggleModifierGroup(group.id)}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-blue-50/70 border-blue-300 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // event dikontrol oleh onClick container
                        className="mt-1 w-4 h-4 rounded text-blue-900 focus:ring-blue-900 accent-blue-900 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {group.name}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              group.selectionType === 'SINGLE'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {group.selectionType === 'SINGLE' ? 'Pilih 1 (Radio)' : 'Boleh Multi (Checkbox)'}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                              group.isRequired
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {group.isRequired ? 'Wajib Pilih' : 'Opsional'}
                          </span>
                        </div>

                        {/* List Options Preview */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {group.items && group.items.length > 0 ? (
                            group.items.map((item, idx) => (
                              <span
                                key={idx}
                                className="text-[11px] bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md"
                              >
                                {item.name}
                                {item.priceAdjustment > 0
                                  ? ` (+Rp ${item.priceAdjustment.toLocaleString('id-ID')})`
                                  : ''}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Tidak ada opsi varian
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          </div>

          {/* Footer Tombol - Selalu tampak, tidak terpotong oleh browser mobile navigation bar */}
          <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t border-slate-200 bg-slate-50/95 backdrop-blur-xs flex items-center justify-end gap-3 shrink-0 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-100 transition-colors shadow-2xs"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-[0.98] disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-900/20 transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {loading ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Produk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
