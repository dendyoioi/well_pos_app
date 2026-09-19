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
  Flame,
  Droplets,
  Search,
  ChevronDown,
  CheckCircle2,
  Infinity as InfinityIcon,
  Package,
} from 'lucide-react';
import type { Product, Category, ProductModifierGroup } from '../types/product';
import { api } from '../services/api';

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

// Helper auto-format Rupiah dan Parser numerik
const formatRupiah = (val: number | string): string => {
  if (val === '' || val === undefined || val === null) return '0';
  const clean = typeof val === 'string' ? val.replace(/\D/g, '') : String(val);
  const num = parseInt(clean, 10);
  return isNaN(num) ? '0' : num.toLocaleString('id-ID');
};

const parseRupiah = (val: string): number => {
  const clean = val.replace(/\D/g, '');
  return clean ? parseInt(clean, 10) : 0;
};

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
  const isEdit = !!productToEdit;

  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [costPrice, setCostPrice] = useState<number>(0);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [unit, setUnit] = useState('Pcs');
  const [hasStock, setHasStock] = useState<boolean>(true);
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

  // Modifiers state
  const [modifiers, setModifiers] = useState<ProductModifierGroup[]>([]);

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

      setModifiers(productToEdit.modifiers ? JSON.parse(JSON.stringify(productToEdit.modifiers)) : []);
    } else {
      // Reset form
      setName('');
      setBarcode('');
      setSku('');
      setCategoryId(categories[0]?.id || '');
      setCostPrice(0);
      setBasePrice(0);
      setUnit('Pcs');
      setHasStock(true); // Default tetap ada stok sesuai requirement #4
      setInitialStock(0);
      setMinStockAlert(5);
      setDescription('');
      setImageUrl('');
      setModifiers([]);
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
      } else {
        alert(res.message || 'Gagal menambahkan kategori');
      }
    } catch {
      alert('Terjadi kesalahan saat menambah kategori');
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
      } else {
        alert(res.message || 'Gagal menambahkan kategori');
      }
    } catch {
      alert('Terjadi kesalahan saat menambah kategori');
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

  // Modifiers Quick Templates
  const addPedasTemplate = () => {
    const newGroup: ProductModifierGroup = {
      id: `mod_pedas_${Date.now()}`,
      name: 'Level Pedas',
      type: 'SINGLE',
      required: true,
      options: [
        { id: `opt_${Date.now()}_0`, name: 'Level 0 (Tidak Pedas)', priceDelta: 0, isDefault: true },
        { id: `opt_${Date.now()}_1`, name: 'Level 1 (Sedang)', priceDelta: 0 },
        { id: `opt_${Date.now()}_2`, name: 'Level 2 (Pedas)', priceDelta: 0 },
        { id: `opt_${Date.now()}_3`, name: 'Level 3 (Extra Pedas)', priceDelta: 2000 },
      ],
    };
    setModifiers((prev) => [...prev, newGroup]);
  };

  const addGulaTemplate = () => {
    const newGroup: ProductModifierGroup = {
      id: `mod_gula_${Date.now()}`,
      name: 'Tingkat Kemanisan (Sugar)',
      type: 'SINGLE',
      required: true,
      options: [
        { id: `opt_${Date.now()}_0`, name: 'Normal Sugar (100%)', priceDelta: 0, isDefault: true },
        { id: `opt_${Date.now()}_1`, name: 'Less Sugar (50%)', priceDelta: 0 },
        { id: `opt_${Date.now()}_2`, name: 'No Sugar (0%)', priceDelta: 0 },
      ],
    };
    setModifiers((prev) => [...prev, newGroup]);
  };

  const addEsTemplate = () => {
    const newGroup: ProductModifierGroup = {
      id: `mod_es_${Date.now()}`,
      name: 'Level Es (Ice)',
      type: 'SINGLE',
      required: true,
      options: [
        { id: `opt_${Date.now()}_0`, name: 'Normal Ice', priceDelta: 0, isDefault: true },
        { id: `opt_${Date.now()}_1`, name: 'Less Ice', priceDelta: 0 },
        { id: `opt_${Date.now()}_2`, name: 'No Ice', priceDelta: 0 },
      ],
    };
    setModifiers((prev) => [...prev, newGroup]);
  };

  const addToppingTemplate = () => {
    const newGroup: ProductModifierGroup = {
      id: `mod_topping_${Date.now()}`,
      name: 'Pilihan Ekstra Topping',
      type: 'MULTIPLE',
      required: false,
      options: [
        { id: `opt_${Date.now()}_0`, name: 'Ekstra Keju Mozzarella', priceDelta: 4000 },
        { id: `opt_${Date.now()}_1`, name: 'Telur Dadar / Ceplok', priceDelta: 5000 },
        { id: `opt_${Date.now()}_2`, name: 'Boba Jelly Brown Sugar', priceDelta: 3000 },
      ],
    };
    setModifiers((prev) => [...prev, newGroup]);
  };

  const addCustomGroup = () => {
    const newGroup: ProductModifierGroup = {
      id: `mod_custom_${Date.now()}`,
      name: 'Pilihan Baru',
      type: 'SINGLE',
      required: false,
      options: [
        { id: `opt_${Date.now()}_1`, name: 'Opsi A', priceDelta: 0, isDefault: true },
        { id: `opt_${Date.now()}_2`, name: 'Opsi B', priceDelta: 0 },
      ],
    };
    setModifiers((prev) => [...prev, newGroup]);
  };

  const removeModifierGroup = (groupId: string) => {
    setModifiers((prev) => prev.filter((g) => g.id !== groupId));
  };

  const updateGroupName = (groupId: string, newTitle: string) => {
    setModifiers((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, name: newTitle } : g))
    );
  };

  const setGroupType = (groupId: string, type: 'SINGLE' | 'MULTIPLE') => {
    setModifiers((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, type } : g))
    );
  };

  const setGroupRequired = (groupId: string, required: boolean) => {
    setModifiers((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, required } : g))
    );
  };

  const addOptionToGroup = (groupId: string) => {
    setModifiers((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          options: [
            ...g.options,
            { id: `opt_${Date.now()}`, name: 'Varian Baru', priceDelta: 0 },
          ],
        };
      })
    );
  };

  const updateOption = (
    groupId: string,
    optId: string,
    field: 'name' | 'priceDelta',
    value: any
  ) => {
    setModifiers((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          options: g.options.map((opt) =>
            opt.id === optId ? { ...opt, [field]: value } : opt
          ),
        };
      })
    );
  };

  const removeOption = (groupId: string, optId: string) => {
    setModifiers((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          options: g.options.filter((opt) => opt.id !== optId),
        };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // If modifiers or hasStock are present, encode metadata cleanly with description
    let finalDescription = description.trim();
    const metadata: any = {
      text: description.trim(),
      hasStock,
    };
    if (modifiers.length > 0) {
      metadata.modifiers = modifiers;
    }
    if (!hasStock || modifiers.length > 0) {
      finalDescription = JSON.stringify(metadata);
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

        if (res.status === 'success') {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-sm">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-blue-950 text-base sm:text-lg">
                {isEdit ? 'Edit Data Produk' : 'Tambah Produk Baru'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEdit
                  ? 'Perbarui informasi katalog, foto, harga, dan kustomisasi rasa/topping'
                  : 'Input data katalog, foto produk, dan kustomisasi makanan/minuman'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Isi */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Harga Modal (HPP) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  Rp
                </span>
                <input
                  type="text"
                  id="product-cost-price"
                  inputMode="numeric"
                  required
                  value={formatRupiah(costPrice)}
                  onChange={(e) => setCostPrice(parseRupiah(e.target.value))}
                  placeholder="0"
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl pl-9 pr-3.5 py-2.5 text-sm transition-all outline-none font-semibold"
                />
              </div>
            </div>

            {/* Harga Jual (HPJ) - Auto-Format Rupiah */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Harga Jual Standar *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  Rp
                </span>
                <input
                  type="text"
                  id="product-base-price"
                  inputMode="numeric"
                  required
                  value={formatRupiah(basePrice)}
                  onChange={(e) => setBasePrice(parseRupiah(e.target.value))}
                  placeholder="0"
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl pl-9 pr-3.5 py-2.5 text-sm transition-all outline-none font-bold text-blue-950"
                />
              </div>
            </div>

            {/* Opsi Pengelolaan Stok Produk: Ada Stok vs Tanpa Stok */}
            <div className="sm:col-span-2 bg-slate-50/90 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-900" />
                    Pengelolaan Stok Toko
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {hasStock
                      ? 'Kuantitas stok dicatat riil, dipantau, dan berkurang otomatis saat terjadi order'
                      : 'Tanpa batasan kuantitas stok (Cocok untuk menu masak on-demand, digital, atau jasa)'}
                  </p>
                </div>

                {/* Segmented Toggle Control */}
                <div className="flex items-center bg-slate-200/80 p-1 rounded-xl gap-1 flex-shrink-0">
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
                    Ada Stok
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasStock(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      !hasStock
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <InfinityIcon className={`w-3.5 h-3.5 ${!hasStock ? 'text-white' : 'text-slate-400'}`} />
                    Tanpa Stok
                  </button>
                </div>
              </div>

              {/* Sub-Panel Input Stok atau Banner Bebas Stok */}
              {!hasStock ? (
                <div className="p-3 bg-amber-50 border border-amber-200/90 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                  <span className="text-base">✨</span>
                  <span>
                    Produk diset <strong>Tanpa Stok</strong>. Kasir dapat melakukan penjualan tanpa batasan sisa stok dan tidak akan pernah diblokir peringatan stok habis.
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
                        Biarkan kosong/0 jika stok akan dimasukkan nanti lewat menu Stok Masuk (PO Gudang) atau Transfer Cabang.
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

          {/* Section 3: Modifiers / Kustomisasi Makanan & Minuman Dinamis */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-blue-950 flex items-center gap-1.5 uppercase tracking-wider">
                  <Sliders className="w-4 h-4 text-blue-900" />
                  <span>Kustomisasi Dinamis (Modifiers)</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Untuk makanan & minuman (Level pedas, sugar, ice, ekstra topping)
                </p>
              </div>

              {/* Template Buttons */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={addPedasTemplate}
                  className="px-2.5 py-1 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <Flame className="w-3 h-3 text-rose-500" /> + Level Pedas
                </button>
                <button
                  type="button"
                  onClick={addGulaTemplate}
                  className="px-2.5 py-1 bg-white border border-amber-200 text-amber-800 hover:bg-amber-50 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <Droplets className="w-3 h-3 text-amber-500" /> + Level Gula
                </button>
                <button
                  type="button"
                  onClick={addEsTemplate}
                  className="px-2.5 py-1 bg-white border border-cyan-200 text-cyan-800 hover:bg-cyan-50 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  🧊 + Level Es
                </button>
                <button
                  type="button"
                  onClick={addToppingTemplate}
                  className="px-2.5 py-1 bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  🧀 + Topping
                </button>
                <button
                  type="button"
                  onClick={addCustomGroup}
                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> + Buat Baru
                </button>
              </div>
            </div>

            {/* List Modifier Groups */}
            {modifiers.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-white/60">
                <Sliders className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-500">
                  Belum ada opsi kustomisasi untuk produk ini
                </p>
                <p className="text-[11px] text-slate-400">
                  Klik salah satu tombol template di atas untuk menambahkan level pedas, es, atau topping.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {modifiers.map((group, gIdx) => (
                  <div
                    key={group.id}
                    className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-3"
                  >
                    {/* Header Group dengan Segmented Control yang Sangat Jelas & Interaktif */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-900 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {gIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={group.name}
                          onChange={(e) => updateGroupName(group.id, e.target.value)}
                          placeholder="Nama Grup (misal: Level Pedas)"
                          className="font-bold text-xs sm:text-sm text-slate-800 bg-transparent border-b border-dashed border-slate-300 focus:border-blue-900 outline-none px-1 py-0.5 w-full max-w-xs"
                        />
                      </div>

                      {/* Controls Group: Segmented Controls untuk Tipe dan Aturan */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Segmented Control 1: Tipe Pemilihan (Radio vs Checkbox) */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                          <button
                            type="button"
                            onClick={() => setGroupType(group.id, 'SINGLE')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              group.type === 'SINGLE'
                                ? 'bg-blue-900 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                            title="Pelanggan hanya boleh memilih satu pilihan (Radio Button)"
                          >
                            <span
                              className={`w-2.5 h-2.5 rounded-full border flex items-center justify-center ${
                                group.type === 'SINGLE' ? 'border-white' : 'border-slate-400'
                              }`}
                            >
                              {group.type === 'SINGLE' && (
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                              )}
                            </span>
                            <span>Radio (Pilih 1)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setGroupType(group.id, 'MULTIPLE')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              group.type === 'MULTIPLE'
                                ? 'bg-purple-900 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                            title="Pelanggan boleh memilih lebih dari satu pilihan (Checkbox)"
                          >
                            <span
                              className={`w-2.5 h-2.5 rounded-xs border flex items-center justify-center ${
                                group.type === 'MULTIPLE' ? 'border-white bg-purple-900' : 'border-slate-400'
                              }`}
                            >
                              {group.type === 'MULTIPLE' && (
                                <Check className="w-2 h-2 text-white stroke-[3]" />
                              )}
                            </span>
                            <span>Checkbox (Boleh Multi)</span>
                          </button>
                        </div>

                        {/* Segmented Control 2: Aturan Wajib vs Opsional */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                          <button
                            type="button"
                            onClick={() => setGroupRequired(group.id, true)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              group.required
                                ? 'bg-rose-700 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                            title="Wajib memilih opsi kustomisasi ini"
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                group.required ? 'bg-white' : 'bg-rose-500'
                              }`}
                            />
                            <span>Wajib</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setGroupRequired(group.id, false)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              !group.required
                                ? 'bg-emerald-800 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                            title="Opsi kustomisasi ini opsional / tidak wajib"
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                !group.required ? 'bg-white' : 'bg-emerald-500'
                              }`}
                            />
                            <span>Opsional</span>
                          </button>
                        </div>

                        {/* Delete Group */}
                        <button
                          type="button"
                          onClick={() => removeModifierGroup(group.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer ml-auto"
                          title="Hapus grup kustomisasi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Options Rows - Dengan Auto-Format Rupiah pada priceDelta */}
                    <div className="space-y-1.5 pl-2">
                      {group.options.map((opt) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <span className="text-slate-300 text-xs">•</span>
                          <input
                            type="text"
                            value={opt.name}
                            onChange={(e) => updateOption(group.id, opt.id, 'name', e.target.value)}
                            placeholder="Nama varian..."
                            className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-900 focus:bg-white"
                          />
                          <div className="flex items-center gap-1 w-40">
                            <span className="text-[11px] font-bold text-slate-400">+Rp</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatRupiah(opt.priceDelta)}
                              onChange={(e) =>
                                updateOption(group.id, opt.id, 'priceDelta', parseRupiah(e.target.value))
                              }
                              placeholder="0"
                              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-900 focus:bg-white text-right font-bold text-slate-800"
                            />
                          </div>
                          {group.options.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeOption(group.id, opt.id)}
                              className="text-slate-300 hover:text-rose-500 p-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => addOptionToGroup(group.id)}
                        className="text-[11px] font-bold text-blue-900 hover:text-blue-700 flex items-center gap-1 mt-1 pl-1 pt-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Tambah Pilihan Varian
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Tombol */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-100 transition-colors"
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
