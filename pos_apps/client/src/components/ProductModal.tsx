import React, { useState, useEffect } from 'react';
import {
  X,
  PackagePlus,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Boxes,
  Utensils,
  Loader2,
} from 'lucide-react';
import type { Product, Category } from '../types/product';
import type { ModifierGroup } from '../types/modifier';
import { api } from '../services/api';
import { Button } from './ui/Button';
import { useDialog } from '../context/DialogContext';
import { ProductBasicInfoTab } from './product/ProductBasicInfoTab';
import { ProductPhotoUploadTab } from './product/ProductPhotoUploadTab';
import { ProductBundlingTab, type BundleItem, type PriceTier } from './product/ProductBundlingTab';
import { ProductFnbSettingsTab } from './product/ProductFnbSettingsTab';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  productToEdit?: Product | null;
  categories: Category[];
  outletId?: string;
  isLaundryMode?: boolean;
}

const DEFAULT_UNITS = [
  'Pcs', 'Cup', 'Botol', 'Porsi', 'Box', 'Kg', 'Gram', 'Liter', 'Sachet', 'Paket', 'Mangkok', 'Piring', 'Gelas', 'Bungkus', 'Loyang', 'Potong', 'Set',
];

const LAUNDRY_UNITS = [
  'Pcs', 'Botol', 'Pack', 'Liter', 'Ml', 'Kg', 'Gram', 'Sachet', 'Set', 'Box', 'Roll', 'Lembar',
];

type ModalTab = 'info' | 'photo' | 'bundling' | 'fnb';

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  productToEdit,
  categories,
  outletId,
  isLaundryMode = false,
}) => {
  const dialog = useDialog();
  const isEdit = !!productToEdit;

  const [activeTab, setActiveTab] = useState<ModalTab>('info');

  // Form Fields
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [costPrice, setCostPrice] = useState<number>(0);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [unit, setUnit] = useState('Pcs');
  const [initialStock, setInitialStock] = useState<number>(0);
  const [editPhysicalStock, setEditPhysicalStock] = useState<number>(0);
  const [minStockAlert, setMinStockAlert] = useState<number>(5);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isCompressingImage, setIsCompressingImage] = useState(false);

  // Mode: F&B vs Standard Retail vs Composite Bundle
  const [productMode, setProductMode] = useState<'STANDARD' | 'FNB' | 'COMPOSITE'>('FNB');

  // Bundling (EPIC-29)
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);

  // Price Tiers (EPIC-29)
  const [showPriceTiers, setShowPriceTiers] = useState(false);
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([]);

  // Unit & Category list state
  const [unitList, setUnitList] = useState<string[]>(isLaundryMode ? LAUNDRY_UNITS : DEFAULT_UNITS);
  const [categoryList, setCategoryList] = useState<Category[]>(categories);
  const [showQuickCategory, setShowQuickCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    setUnitList(isLaundryMode ? LAUNDRY_UNITS : DEFAULT_UNITS);
  }, [isLaundryMode]);

  // Modifiers
  const [availableModifierGroups, setAvailableModifierGroups] = useState<ModifierGroup[]>([]);
  const [selectedModifierGroupIds, setSelectedModifierGroupIds] = useState<string[]>([]);
  const [loadingModifiers, setLoadingModifiers] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCategoryList(categories);
  }, [categories]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('info');
    setError(null);

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

    // Ambil daftar produk aktif untuk komponen penyusun paket komposit
    api.getProducts({ isActive: 'true', outletId }).then((res) => {
      if (res.status === 'success' && Array.isArray(res.data)) {
        const candidates = res.data.filter(
          (p) =>
            p.id !== productToEdit?.id &&
            !p.isBundle &&
            (!p.bundleItems || p.bundleItems.length === 0)
        );
        setAvailableProducts(candidates);
      }
    });

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

      let loadedHasStock = true;
      let initialMode: 'STANDARD' | 'FNB' | 'COMPOSITE' = 'FNB';

      if (productToEdit.isBundle || (productToEdit.bundleItems && productToEdit.bundleItems.length > 0)) {
        loadedHasStock = false;
        initialMode = 'COMPOSITE';
      } else if (productToEdit.hasRecipe || productToEdit.hasStock === false || productToEdit.stock >= 99999) {
        loadedHasStock = false;
        initialMode = 'FNB';
      } else if (productToEdit.productType === 'STANDARD' || productToEdit.hasStock === true) {
        loadedHasStock = true;
        initialMode = 'STANDARD';
      } else {
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
        initialMode = loadedHasStock ? 'STANDARD' : 'FNB';
      }
      setProductMode(initialMode);
      setEditPhysicalStock(productToEdit.stock >= 99999 ? 0 : (productToEdit.stock || 0));

      if (productToEdit.unit && !DEFAULT_UNITS.includes(productToEdit.unit)) {
        setUnitList((prev) => (prev.includes(productToEdit.unit) ? prev : [...prev, productToEdit.unit]));
      }

      const linkedIds = productToEdit.modifiers?.map((m) => m.id) || [];
      setSelectedModifierGroupIds(linkedIds);

      // Ambil item bundle
      api.getBundleItems(productToEdit.id).then((bRes) => {
        if (bRes.status === 'success' && bRes.data?.bundleItems) {
          if (bRes.data.bundleItems.length > 0) {
            setProductMode('COMPOSITE');
          }
          setBundleItems(
            bRes.data.bundleItems.map((bi) => ({
              childProductId: bi.childProductId,
              childVariantId: bi.childVariantId || null,
              childProductName: bi.childProductName,
              childUnit: bi.childUnit,
              childAverageCost: bi.childAverageCost || 0,
              childBasePrice: bi.childBasePrice || 0,
              quantity: bi.quantity,
              slotName: bi.slotName || '',
              priceAdjustment: bi.priceAdjustment || 0,
              isDefault: Boolean(bi.isDefault),
            }))
          );
        }
      });

      // Ambil price tiers
      api.getPriceTiers(productToEdit.id).then((tRes) => {
        if (tRes.status === 'success' && tRes.data?.priceTiers) {
          setPriceTiers(
            tRes.data.priceTiers.map((pt) => ({
              minQuantity: pt.minQuantity,
              tierPrice: pt.tierPrice,
            }))
          );
          if (tRes.data.priceTiers.length > 0) {
            setShowPriceTiers(true);
          }
        }
      });
    } else {
      setName('');
      setBarcode('');
      setSku('');
      setCategoryId(categories[0]?.id || '');
      setCostPrice(0);
      setBasePrice(0);
      setUnit('Pcs');
      setProductMode(isLaundryMode ? 'STANDARD' : 'FNB');
      setBundleItems([]);
      setPriceTiers([]);
      setShowPriceTiers(false);
      setInitialStock(0);
      setMinStockAlert(5);
      setDescription('');
      setImageUrl('');
      setSelectedModifierGroupIds([]);
    }
  }, [productToEdit, isOpen, categories, outletId, isLaundryMode]);

  if (!isOpen) return null;

  const generateRandomBarcode = () => {
    const randomEan = '899' + Math.floor(1000000000 + Math.random() * 9000000000);
    setBarcode(randomEan);
  };

  const generateAutoSku = () => {
    const cat = categoryList.find((c) => c.id === categoryId)?.name.substring(0, 3).toUpperCase() || 'ITM';
    const rand = Math.floor(100 + Math.random() * 900);
    setSku(`${cat}-${rand}`);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await api.createCategory(newCategoryName.trim());
      if (res.status === 'success' && res.data) {
        setCategoryList((prev) => [...prev, res.data!]);
        setCategoryId(res.data.id);
        setNewCategoryName('');
        setShowQuickCategory(false);
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

  const handleCreateCategoryFromSearch = async (catName: string) => {
    const trimmed = catName.trim();
    if (!trimmed) return;
    try {
      const res = await api.createCategory(trimmed);
      if (res.status === 'success' && res.data) {
        setCategoryList((prev) => [...prev, res.data!]);
        setCategoryId(res.data.id);
        dialog.toast(`Kategori "${res.data.name}" berhasil dibuat`, 'success');
      }
    } catch {
      // Ignored
    }
  };

  const handleAddCustomUnit = (newUnitStr: string) => {
    const trimmed = newUnitStr.trim();
    if (!trimmed) return;
    if (!unitList.some((u) => u.toLowerCase() === trimmed.toLowerCase())) {
      setUnitList((prev) => [...prev, trimmed]);
    }
    setUnit(trimmed);
  };

  const toggleModifierGroup = (groupId: string) => {
    setSelectedModifierGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const isComposite = productMode === 'COMPOSITE';
    const isStandard = productMode === 'STANDARD';

    if (isComposite && bundleItems.length === 0) {
      setError('Paket komposit wajib memiliki minimal 1 produk komponen penyusun.');
      return;
    }

    setLoading(true);

    let finalDescription = description.trim();
    if (!isStandard) {
      finalDescription = JSON.stringify({
        text: description.trim(),
        hasStock: false,
      });
    }

    try {
      let targetProductId = '';

      if (isEdit && productToEdit) {
        targetProductId = productToEdit.id;
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
          minStockAlert: isStandard ? Number(minStockAlert) : 0,
          productType: isComposite ? 'COMPOSITE' : isStandard ? 'STANDARD' : 'COMPOSITE',
          hasStock: isStandard,
          currentStock: isStandard ? Number(editPhysicalStock) : undefined,
          outletId: outletId || undefined,
        });

        if (res.status !== 'success') {
          setError(res.message || 'Gagal memperbarui produk');
          return;
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
          initialStock: isStandard ? Number(initialStock) : 0,
          minStockAlert: isStandard ? Number(minStockAlert) : 0,
          description: finalDescription,
          imageUrl: imageUrl.trim() || undefined,
          outletId: outletId || undefined,
          productType: isComposite ? 'COMPOSITE' : isStandard ? 'STANDARD' : 'COMPOSITE',
          hasStock: isStandard,
        });

        if (res.status !== 'success' || !res.data?.id) {
          setError(res.message || 'Gagal menambahkan produk');
          return;
        }
        targetProductId = res.data.id;
      }

      if (targetProductId) {
        await api.updateBundleItems(
          targetProductId,
          isComposite
            ? bundleItems.map((bi) => ({
                childProductId: bi.childProductId,
                childVariantId: bi.childVariantId || null,
                quantity: bi.quantity,
                slotName: bi.slotName && bi.slotName.trim() !== '' ? bi.slotName.trim() : null,
                priceAdjustment: bi.priceAdjustment || 0,
                isDefault: Boolean(bi.isDefault),
              }))
            : []
        );

        await api.updatePriceTiers(
          targetProductId,
          priceTiers.map((pt) => ({
            minQuantity: pt.minQuantity,
            tierPrice: pt.tierPrice,
          }))
        );

        if (selectedModifierGroupIds.length > 0 && !isLaundryMode) {
          await api.linkProductModifiers(targetProductId, selectedModifierGroupIds);
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-sm shrink-0">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-black text-slate-900 text-base leading-tight truncate">
                {isEdit ? 'Ubah Informasi Produk' : 'Tambah Produk Baru'}
              </h3>
              <p className="text-xs text-slate-500 truncate">
                {isEdit ? `ID: ${productToEdit?.sku || '-'}` : 'Lengkapi data katalog produk toko'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 sm:px-6 pt-2 border-b border-slate-200 bg-white shrink-0 flex items-center gap-2 overflow-x-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'info'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Info Dasar & Harga</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('photo')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'photo'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Foto Produk</span>
            {imageUrl && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bundling')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'bundling'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Varian & Bundling</span>
            {(bundleItems.length > 0 || priceTiers.length > 0) && (
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>

          {/* Tab Khusus F&B — Disembunyikan total jika dalam mode Laundry */}
          {!isLaundryMode && (
            <button
              type="button"
              onClick={() => setActiveTab('fnb')}
              className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'fnb'
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>Resep & Topping (F&B)</span>
              {selectedModifierGroupIds.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-900 text-[10px]">
                  {selectedModifierGroupIds.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-4 flex-1">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {activeTab === 'info' && (
              <ProductBasicInfoTab
                name={name}
                setName={setName}
                categoryId={categoryId}
                setCategoryId={setCategoryId}
                categoryList={categoryList}
                showQuickCategory={showQuickCategory}
                setShowQuickCategory={setShowQuickCategory}
                newCategoryName={newCategoryName}
                setNewCategoryName={setNewCategoryName}
                handleCreateCategory={handleCreateCategory}
                handleCreateCategoryFromSearch={handleCreateCategoryFromSearch}
                unit={unit}
                setUnit={setUnit}
                unitList={unitList}
                handleAddCustomUnit={handleAddCustomUnit}
                barcode={barcode}
                setBarcode={setBarcode}
                generateRandomBarcode={generateRandomBarcode}
                sku={sku}
                setSku={setSku}
                generateAutoSku={generateAutoSku}
                costPrice={costPrice}
                setCostPrice={setCostPrice}
                basePrice={basePrice}
                setBasePrice={setBasePrice}
                productMode={productMode}
                isEdit={isEdit}
                initialStock={initialStock}
                setInitialStock={setInitialStock}
                editPhysicalStock={editPhysicalStock}
                setEditPhysicalStock={setEditPhysicalStock}
                minStockAlert={minStockAlert}
                setMinStockAlert={setMinStockAlert}
                description={description}
                setDescription={setDescription}
                isLaundryMode={isLaundryMode}
              />
            )}

            {activeTab === 'photo' && (
              <ProductPhotoUploadTab
                imageUrl={imageUrl}
                setImageUrl={setImageUrl}
                isCompressingImage={isCompressingImage}
                setIsCompressingImage={setIsCompressingImage}
                onError={setError}
              />
            )}

            {activeTab === 'bundling' && (
              <ProductBundlingTab
                productMode={productMode}
                setProductMode={setProductMode}
                availableProducts={availableProducts}
                bundleItems={bundleItems}
                setBundleItems={setBundleItems}
                basePrice={basePrice}
                costPrice={costPrice}
                setCostPrice={setCostPrice}
                unit={unit}
                priceTiers={priceTiers}
                setPriceTiers={setPriceTiers}
                showPriceTiers={showPriceTiers}
                setShowPriceTiers={setShowPriceTiers}
              />
            )}

            {activeTab === 'fnb' && !isLaundryMode && (
              <ProductFnbSettingsTab
                productMode={productMode}
                setProductMode={setProductMode}
                availableModifierGroups={availableModifierGroups}
                selectedModifierGroupIds={selectedModifierGroupIds}
                toggleModifierGroup={toggleModifierGroup}
                loadingModifiers={loadingModifiers}
              />
            )}
          </div>

          {/* Sticky Action Footer (Rule #10) */}
          <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between pb-[max(1rem,env(safe-area-inset-bottom))]">
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              * Kolom bertanda bintang wajib diisi
            </span>
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="w-1/2 sm:w-auto"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={loading || isCompressingImage}
                className="w-1/2 sm:w-auto bg-blue-900 hover:bg-blue-800 text-white font-bold"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Menyimpan...
                  </>
                ) : isEdit ? (
                  'Perbarui Produk'
                ) : (
                  'Simpan Produk'
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
