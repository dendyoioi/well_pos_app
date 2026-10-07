import React, { useState, useMemo, useEffect } from 'react';
import {
  ClipboardCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  RotateCcw,
  Package,
  Boxes,
  Save,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Store,
  Truck,
  Building2,
  AlertCircle,
} from 'lucide-react';
import type { Product } from '../types/product';
import type { RecipeInventoryItem } from '../types/recipe';
import type { Outlet } from '../types/outlet';
import { formatRupiah } from '../utils/currency';
import { api } from '../services/api';

export type BulkOperationType = 'OPNAME' | 'STOCK_IN' | 'STOCK_OUT' | 'TRANSFER';
export type BulkItemMode = 'PRODUCTS' | 'INGREDIENTS';

export interface FullScreenBulkStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  activeOutlet?: Outlet | null;
  initialMode?: BulkItemMode;
  initialOperation?: BulkOperationType;
  products: Product[];
  ingredients: RecipeInventoryItem[];
  outlets?: Outlet[];
}

export const FullScreenBulkStockModal: React.FC<FullScreenBulkStockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  activeOutlet,
  initialMode = 'PRODUCTS',
  initialOperation = 'OPNAME',
  products,
  ingredients,
  outlets: propOutlets,
}) => {
  // Mode Operasi: Opname, Stok Masuk, Stok Keluar, Transfer
  const [operation, setOperation] = useState<BulkOperationType>(initialOperation);
  // Mode Jenis Barang: Produk Jadi vs Bahan Baku
  const [mode, setMode] = useState<BulkItemMode>(initialMode);

  // Filter & Pencarian
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [filterOnlyActive, setFilterOnlyActive] = useState(false); // Untuk opname: selisih; untuk in/out/transfer: qty > 0

  // State Header Khusus per Operasi
  const [generalNotes, setGeneralNotes] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [generalReason, setGeneralReason] = useState('WASTE');
  const [transferNumber, setTransferNumber] = useState('');
  const [sourceOutletId, setSourceOutletId] = useState<string>('');
  const [targetOutletId, setTargetOutletId] = useState<string>('');

  // Outlets list untuk Transfer
  const [allOutlets, setAllOutlets] = useState<Outlet[]>(propOutlets || []);
  const [loadingOutlets, setLoadingOutlets] = useState(false);

  // Status submission & error
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ==========================================
  // STATE INPUT PER ITEM
  // ==========================================
  // 1. Stock Opname
  const [productOpname, setProductOpname] = useState<Record<string, { actualStock: number; notes: string; isModified: boolean }>>({});
  const [ingredientOpname, setIngredientOpname] = useState<Record<string, { actualStock: number; notes: string; isModified: boolean }>>({});

  // 2. Stok Masuk
  const [productStockIn, setProductStockIn] = useState<Record<string, { quantity: number; newCostPrice: number; notes: string }>>({});
  const [ingredientStockIn, setIngredientStockIn] = useState<Record<string, { quantity: number; newCostPrice: number; notes: string }>>({});

  // 3. Stok Keluar
  const [productStockOut, setProductStockOut] = useState<Record<string, { quantity: number; reason: string; notes: string }>>({});
  const [ingredientStockOut, setIngredientStockOut] = useState<Record<string, { quantity: number; reason: string; notes: string }>>({});

  // 4. Transfer
  const [productTransfer, setProductTransfer] = useState<Record<string, { quantity: number; notes: string }>>({});
  const [ingredientTransfer, setIngredientTransfer] = useState<Record<string, { quantity: number; notes: string }>>({});

  // Fetch Outlets jika belum ada
  useEffect(() => {
    if (isOpen && (!allOutlets || allOutlets.length === 0)) {
      setLoadingOutlets(true);
      api.getOutlets()
        .then((res) => {
          if (res.status === 'success' && res.data) {
            setAllOutlets(res.data);
          }
        })
        .catch((err) => console.error('Gagal mengambil daftar outlet:', err))
        .finally(() => setLoadingOutlets(false));
    }
  }, [isOpen, allOutlets]);

  // Set default source & target outlet untuk Transfer
  useEffect(() => {
    if (allOutlets.length > 0) {
      const defaultSrc = activeOutlet?.id || allOutlets[0]?.id || '';
      if (!sourceOutletId) setSourceOutletId(defaultSrc);
      if (!targetOutletId) {
        const other = allOutlets.find((o) => o.id !== defaultSrc);
        if (other) setTargetOutletId(other.id);
      }
    }
  }, [allOutlets, activeOutlet, sourceOutletId, targetOutletId]);

  // Sync rows saat modal dibuka atau initialOperation/mode berubah
  useEffect(() => {
    if (isOpen) {
      setOperation(initialOperation);
      setMode(initialMode);
      setSearch('');
      setCategoryFilter('ALL');
      setFilterOnlyActive(false);
      setErrorMsg(null);

      const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      setGeneralNotes(
        initialOperation === 'OPNAME'
          ? `Stock Opname Massal - ${todayStr}`
          : initialOperation === 'STOCK_IN'
          ? `Penerimaan Belanja Massal - ${todayStr}`
          : initialOperation === 'STOCK_OUT'
          ? `Pembersihan / Stok Rusak Massal - ${todayStr}`
          : `Pengiriman Transfer Antar Toko - ${todayStr}`
      );

      // Inisialisasi Opname
      const pOp: Record<string, { actualStock: number; notes: string; isModified: boolean }> = {};
      const pIn: Record<string, { quantity: number; newCostPrice: number; notes: string }> = {};
      const pOut: Record<string, { quantity: number; reason: string; notes: string }> = {};
      const pTrf: Record<string, { quantity: number; notes: string }> = {};

      products.forEach((p) => {
        const sys = Number(p.stock || 0);
        const cost = Number(p.costPrice || 0);
        pOp[p.id] = { actualStock: sys, notes: '', isModified: false };
        pIn[p.id] = { quantity: 0, newCostPrice: cost, notes: '' };
        pOut[p.id] = { quantity: 0, reason: 'WASTE', notes: '' };
        pTrf[p.id] = { quantity: 0, notes: '' };
      });

      setProductOpname(pOp);
      setProductStockIn(pIn);
      setProductStockOut(pOut);
      setProductTransfer(pTrf);

      // Inisialisasi Bahan Baku
      const iOp: Record<string, { actualStock: number; notes: string; isModified: boolean }> = {};
      const iIn: Record<string, { quantity: number; newCostPrice: number; notes: string }> = {};
      const iOut: Record<string, { quantity: number; reason: string; notes: string }> = {};
      const iTrf: Record<string, { quantity: number; notes: string }> = {};

      ingredients.forEach((ing) => {
        const sys = Number(ing.stock || 0);
        const cost = Number(ing.averageCost || 0);
        iOp[ing.id] = { actualStock: sys, notes: '', isModified: false };
        iIn[ing.id] = { quantity: 0, newCostPrice: cost, notes: '' };
        iOut[ing.id] = { quantity: 0, reason: 'WASTE', notes: '' };
        iTrf[ing.id] = { quantity: 0, notes: '' };
      });

      setIngredientOpname(iOp);
      setIngredientStockIn(iIn);
      setIngredientStockOut(iOut);
      setIngredientTransfer(iTrf);
    }
  }, [isOpen, initialMode, initialOperation, products, ingredients]);

  // Update default general notes saat tab operation berganti
  const handleOperationChange = (op: BulkOperationType) => {
    setOperation(op);
    setFilterOnlyActive(false);
    setErrorMsg(null);
    const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    setGeneralNotes(
      op === 'OPNAME'
        ? `Stock Opname Massal - ${todayStr}`
        : op === 'STOCK_IN'
        ? `Penerimaan Belanja Massal - ${todayStr}`
        : op === 'STOCK_OUT'
        ? `Pembersihan / Stok Rusak Massal - ${todayStr}`
        : `Pengiriman Transfer Antar Toko - ${todayStr}`
    );
  };

  // ==========================================
  // HANDLERS EDIT BARIS PER OPERASI
  // ==========================================

  // Opname Handlers
  const handleOpnameStockChange = (id: string, val: number) => {
    const safeVal = Math.max(0, isNaN(val) ? 0 : val);
    if (mode === 'PRODUCTS') {
      const prev = productOpname[id];
      const prod = products.find((p) => p.id === id);
      const isDiff = safeVal !== Number(prod?.stock || 0);
      setProductOpname((r) => ({
        ...r,
        [id]: { actualStock: safeVal, notes: prev?.notes || '', isModified: isDiff },
      }));
    } else {
      const prev = ingredientOpname[id];
      const ing = ingredients.find((i) => i.id === id);
      const isDiff = safeVal !== Number(ing?.stock || 0);
      setIngredientOpname((r) => ({
        ...r,
        [id]: { actualStock: safeVal, notes: prev?.notes || '', isModified: isDiff },
      }));
    }
  };

  const handleOpnameNotesChange = (id: string, notes: string) => {
    if (mode === 'PRODUCTS') {
      setProductOpname((r) => ({
        ...r,
        [id]: { ...(r[id] || { actualStock: 0, isModified: false }), notes },
      }));
    } else {
      setIngredientOpname((r) => ({
        ...r,
        [id]: { ...(r[id] || { actualStock: 0, isModified: false }), notes },
      }));
    }
  };

  // Stock In Handlers
  const handleStockInQtyChange = (id: string, val: number) => {
    const qty = Math.max(0, isNaN(val) ? 0 : val);
    if (mode === 'PRODUCTS') {
      const prev = productStockIn[id];
      setProductStockIn((r) => ({
        ...r,
        [id]: { ...(prev || { newCostPrice: 0, notes: '' }), quantity: qty },
      }));
    } else {
      const prev = ingredientStockIn[id];
      setIngredientStockIn((r) => ({
        ...r,
        [id]: { ...(prev || { newCostPrice: 0, notes: '' }), quantity: qty },
      }));
    }
  };

  const handleStockInPriceChange = (id: string, val: number) => {
    const price = Math.max(0, isNaN(val) ? 0 : val);
    if (mode === 'PRODUCTS') {
      const prev = productStockIn[id];
      setProductStockIn((r) => ({
        ...r,
        [id]: { ...(prev || { quantity: 0, notes: '' }), newCostPrice: price },
      }));
    } else {
      const prev = ingredientStockIn[id];
      setIngredientStockIn((r) => ({
        ...r,
        [id]: { ...(prev || { quantity: 0, notes: '' }), newCostPrice: price },
      }));
    }
  };

  const handleStockInNotesChange = (id: string, notes: string) => {
    if (mode === 'PRODUCTS') {
      setProductStockIn((r) => ({
        ...r,
        [id]: { ...(r[id] || { quantity: 0, newCostPrice: 0 }), notes },
      }));
    } else {
      setIngredientStockIn((r) => ({
        ...r,
        [id]: { ...(r[id] || { quantity: 0, newCostPrice: 0 }), notes },
      }));
    }
  };

  // Stock Out Handlers
  const handleStockOutQtyChange = (id: string, val: number) => {
    const qty = Math.max(0, isNaN(val) ? 0 : val);
    if (mode === 'PRODUCTS') {
      const prev = productStockOut[id];
      setProductStockOut((r) => ({
        ...r,
        [id]: { ...(prev || { reason: 'WASTE', notes: '' }), quantity: qty },
      }));
    } else {
      const prev = ingredientStockOut[id];
      setIngredientStockOut((r) => ({
        ...r,
        [id]: { ...(prev || { reason: 'WASTE', notes: '' }), quantity: qty },
      }));
    }
  };

  const handleStockOutReasonChange = (id: string, reason: string) => {
    if (mode === 'PRODUCTS') {
      setProductStockOut((r) => ({
        ...r,
        [id]: { ...(r[id] || { quantity: 0, notes: '' }), reason },
      }));
    } else {
      setIngredientStockOut((r) => ({
        ...r,
        [id]: { ...(r[id] || { quantity: 0, notes: '' }), reason },
      }));
    }
  };

  const handleStockOutNotesChange = (id: string, notes: string) => {
    if (mode === 'PRODUCTS') {
      setProductStockOut((r) => ({
        ...r,
        [id]: { ...(r[id] || { quantity: 0, reason: 'WASTE' }), notes },
      }));
    } else {
      setIngredientStockOut((r) => ({
        ...r,
        [id]: { ...(r[id] || { quantity: 0, reason: 'WASTE' }), notes },
      }));
    }
  };

  // Transfer Handlers
  const handleTransferQtyChange = (id: string, val: number) => {
    const qty = Math.max(0, isNaN(val) ? 0 : val);
    if (mode === 'PRODUCTS') {
      const prev = productTransfer[id];
      setProductTransfer((r) => ({
        ...r,
        [id]: { ...(prev || { notes: '' }), quantity: qty },
      }));
    } else {
      const prev = ingredientTransfer[id];
      setIngredientTransfer((r) => ({
        ...r,
        [id]: { ...(prev || { notes: '' }), quantity: qty },
      }));
    }
  };

  const handleTransferNotesChange = (id: string, notes: string) => {
    if (mode === 'PRODUCTS') {
      setProductTransfer((r) => ({
        ...r,
        [id]: { ...(r[id] || { quantity: 0 }), notes },
      }));
    } else {
      setIngredientTransfer((r) => ({
        ...r,
        [id]: { ...(r[id] || { quantity: 0 }), notes },
      }));
    }
  };

  // ==========================================
  // BATCH AUTOMATION ACTIONS
  // ==========================================
  const handleSyncAllToSystem = () => {
    if (mode === 'PRODUCTS') {
      const next: Record<string, { actualStock: number; notes: string; isModified: boolean }> = {};
      products.forEach((p) => {
        next[p.id] = { actualStock: Number(p.stock || 0), notes: productOpname[p.id]?.notes || '', isModified: false };
      });
      setProductOpname(next);
    } else {
      const next: Record<string, { actualStock: number; notes: string; isModified: boolean }> = {};
      ingredients.forEach((ing) => {
        next[ing.id] = { actualStock: Number(ing.stock || 0), notes: ingredientOpname[ing.id]?.notes || '', isModified: false };
      });
      setIngredientOpname(next);
    }
  };

  const handleResetCurrentOperation = () => {
    if (operation === 'OPNAME') {
      if (mode === 'PRODUCTS') {
        const next: Record<string, { actualStock: number; notes: string; isModified: boolean }> = {};
        products.forEach((p) => {
          const sys = Number(p.stock || 0);
          next[p.id] = { actualStock: 0, notes: productOpname[p.id]?.notes || '', isModified: sys !== 0 };
        });
        setProductOpname(next);
      } else {
        const next: Record<string, { actualStock: number; notes: string; isModified: boolean }> = {};
        ingredients.forEach((ing) => {
          const sys = Number(ing.stock || 0);
          next[ing.id] = { actualStock: 0, notes: ingredientOpname[ing.id]?.notes || '', isModified: sys !== 0 };
        });
        setIngredientOpname(next);
      }
    } else if (operation === 'STOCK_IN') {
      if (mode === 'PRODUCTS') {
        const next: Record<string, { quantity: number; newCostPrice: number; notes: string }> = {};
        products.forEach((p) => {
          next[p.id] = { quantity: 0, newCostPrice: Number(p.costPrice || 0), notes: '' };
        });
        setProductStockIn(next);
      } else {
        const next: Record<string, { quantity: number; newCostPrice: number; notes: string }> = {};
        ingredients.forEach((ing) => {
          next[ing.id] = { quantity: 0, newCostPrice: Number(ing.averageCost || 0), notes: '' };
        });
        setIngredientStockIn(next);
      }
    } else if (operation === 'STOCK_OUT') {
      if (mode === 'PRODUCTS') {
        const next: Record<string, { quantity: number; reason: string; notes: string }> = {};
        products.forEach((p) => {
          next[p.id] = { quantity: 0, reason: generalReason, notes: '' };
        });
        setProductStockOut(next);
      } else {
        const next: Record<string, { quantity: number; reason: string; notes: string }> = {};
        ingredients.forEach((ing) => {
          next[ing.id] = { quantity: 0, reason: generalReason, notes: '' };
        });
        setIngredientStockOut(next);
      }
    } else if (operation === 'TRANSFER') {
      if (mode === 'PRODUCTS') {
        const next: Record<string, { quantity: number; notes: string }> = {};
        products.forEach((p) => {
          next[p.id] = { quantity: 0, notes: '' };
        });
        setProductTransfer(next);
      } else {
        const next: Record<string, { quantity: number; notes: string }> = {};
        ingredients.forEach((ing) => {
          next[ing.id] = { quantity: 0, notes: '' };
        });
        setIngredientTransfer(next);
      }
    }
  };

  // Kategori List
  const categories = useMemo(() => {
    if (mode === 'PRODUCTS') {
      return Array.from(new Set(products.map((p) => p.category?.name).filter(Boolean))) as string[];
    }
    return [];
  }, [mode, products]);

  // Model Row Terintegrasi
  interface UnifiedRow {
    id: string;
    name: string;
    code: string;
    categoryName: string;
    unit: string;
    costPrice: number;
    systemStock: number;
    // Opname
    actualStock: number;
    opnameDelta: number;
    opnameNotes: string;
    isOpnameModified: boolean;
    // Stock In
    qtyIn: number;
    costPriceIn: number;
    stockInNotes: string;
    // Stock Out
    qtyOut: number;
    reasonOut: string;
    stockOutNotes: string;
    // Transfer
    qtyTransfer: number;
    transferNotes: string;
  }

  const currentList: UnifiedRow[] = useMemo(() => {
    if (mode === 'PRODUCTS') {
      return products.map((p) => {
        const sys = Number(p.stock || 0);
        const cost = Number(p.costPrice || 0);

        const op = productOpname[p.id] || { actualStock: sys, notes: '', isModified: false };
        const sin = productStockIn[p.id] || { quantity: 0, newCostPrice: cost, notes: '' };
        const sout = productStockOut[p.id] || { quantity: 0, reason: 'WASTE', notes: '' };
        const trf = productTransfer[p.id] || { quantity: 0, notes: '' };

        return {
          id: p.id,
          name: p.name,
          code: p.sku || '-',
          categoryName: p.category?.name || 'Umum',
          unit: p.unit || 'Pcs',
          costPrice: cost,
          systemStock: sys,
          actualStock: op.actualStock,
          opnameDelta: op.actualStock - sys,
          opnameNotes: op.notes,
          isOpnameModified: op.actualStock !== sys,
          qtyIn: sin.quantity,
          costPriceIn: sin.newCostPrice,
          stockInNotes: sin.notes,
          qtyOut: sout.quantity,
          reasonOut: sout.reason,
          stockOutNotes: sout.notes,
          qtyTransfer: trf.quantity,
          transferNotes: trf.notes,
        };
      });
    } else {
      return ingredients.map((ing) => {
        const sys = Number(ing.stock || 0);
        const cost = Number(ing.averageCost || 0);

        const op = ingredientOpname[ing.id] || { actualStock: sys, notes: '', isModified: false };
        const sin = ingredientStockIn[ing.id] || { quantity: 0, newCostPrice: cost, notes: '' };
        const sout = ingredientStockOut[ing.id] || { quantity: 0, reason: 'WASTE', notes: '' };
        const trf = ingredientTransfer[ing.id] || { quantity: 0, notes: '' };

        return {
          id: ing.id,
          name: ing.name,
          code: ing.itemCode || '-',
          categoryName: 'Bahan Baku',
          unit: ing.canonicalUom || 'Pcs',
          costPrice: cost,
          systemStock: sys,
          actualStock: op.actualStock,
          opnameDelta: op.actualStock - sys,
          opnameNotes: op.notes,
          isOpnameModified: op.actualStock !== sys,
          qtyIn: sin.quantity,
          costPriceIn: sin.newCostPrice,
          stockInNotes: sin.notes,
          qtyOut: sout.quantity,
          reasonOut: sout.reason,
          stockOutNotes: sout.notes,
          qtyTransfer: trf.quantity,
          transferNotes: trf.notes,
        };
      });
    }
  }, [
    mode,
    products,
    ingredients,
    productOpname,
    ingredientOpname,
    productStockIn,
    ingredientStockIn,
    productStockOut,
    ingredientStockOut,
    productTransfer,
    ingredientTransfer,
  ]);

  // Filtered List
  const filteredList = useMemo(() => {
    return currentList.filter((row) => {
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = row.name.toLowerCase().includes(q);
        const matchCode = row.code.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }

      if (categoryFilter !== 'ALL' && row.categoryName !== categoryFilter) {
        return false;
      }

      if (filterOnlyActive) {
        if (operation === 'OPNAME' && !row.isOpnameModified) return false;
        if (operation === 'STOCK_IN' && row.qtyIn <= 0) return false;
        if (operation === 'STOCK_OUT' && row.qtyOut <= 0) return false;
        if (operation === 'TRANSFER' && row.qtyTransfer <= 0) return false;
      }

      return true;
    });
  }, [currentList, search, categoryFilter, filterOnlyActive, operation]);

  // Statistik Ringkasan Dinamis
  const totalItems = currentList.length;

  // Opname Stats
  const opnameDivergentRows = currentList.filter((r) => r.isOpnameModified);
  const opnameDivergentCount = opnameDivergentRows.length;
  const opnameMatchCount = totalItems - opnameDivergentCount;
  const opnameTotalDeltaUnits = currentList.reduce((acc, r) => acc + r.opnameDelta, 0);
  const opnameFinancialImpact = currentList.reduce((acc, r) => acc + r.opnameDelta * r.costPrice, 0);

  // Stock In Stats
  const stockInActiveRows = currentList.filter((r) => r.qtyIn > 0);
  const stockInActiveCount = stockInActiveRows.length;
  const stockInTotalUnits = stockInActiveRows.reduce((acc, r) => acc + r.qtyIn, 0);
  const stockInTotalCost = stockInActiveRows.reduce((acc, r) => acc + r.qtyIn * (r.costPriceIn || r.costPrice), 0);

  // Stock Out Stats
  const stockOutActiveRows = currentList.filter((r) => r.qtyOut > 0);
  const stockOutActiveCount = stockOutActiveRows.length;
  const stockOutTotalUnits = stockOutActiveRows.reduce((acc, r) => acc + r.qtyOut, 0);
  const stockOutTotalLoss = stockOutActiveRows.reduce((acc, r) => acc + r.qtyOut * r.costPrice, 0);

  // Transfer Stats
  const transferActiveRows = currentList.filter((r) => r.qtyTransfer > 0);
  const transferActiveCount = transferActiveRows.length;
  const transferTotalUnits = transferActiveRows.reduce((acc, r) => acc + r.qtyTransfer, 0);
  const transferTotalAssetValue = transferActiveRows.reduce((acc, r) => acc + r.qtyTransfer * r.costPrice, 0);

  // Cari nama outlet asal & tujuan
  const sourceOutletObj = allOutlets.find((o) => o.id === sourceOutletId);
  const targetOutletObj = allOutlets.find((o) => o.id === targetOutletId);

  // ==========================================
  // SUBMIT HANDLER
  // ==========================================
  const handleSubmit = async () => {
    setErrorMsg(null);
    setSubmitting(true);

    try {
      if (operation === 'OPNAME') {
        const itemsPayload = currentList.map((r) => ({
          ...(mode === 'PRODUCTS' ? { productId: r.id } : { inventoryItemId: r.id }),
          actualStock: r.actualStock,
          notes: r.opnameNotes.trim() || undefined,
        }));

        const res = await api.recordBulkStockAdjustment({
          outletId: activeOutlet?.id,
          generalNotes: generalNotes.trim() || 'Stock Opname Massal',
          items: itemsPayload,
        });

        if (res.status === 'success') {
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.message || 'Gagal menyimpan penyesuaian opname massal');
        }
      } else if (operation === 'STOCK_IN') {
        if (stockInActiveCount === 0) {
          setErrorMsg('Masukkan jumlah stok masuk (Qty > 0) pada minimal 1 barang.');
          setSubmitting(false);
          return;
        }

        const itemsPayload = stockInActiveRows.map((r) => ({
          ...(mode === 'PRODUCTS' ? { productId: r.id } : { inventoryItemId: r.id }),
          quantity: r.qtyIn,
          newCostPrice: r.costPriceIn > 0 ? r.costPriceIn : undefined,
          notes: r.stockInNotes.trim() || undefined,
        }));

        const res = await api.recordBulkStockIn({
          outletId: activeOutlet?.id,
          supplierName: supplierName.trim() || undefined,
          poNumber: poNumber.trim() || undefined,
          generalNotes: generalNotes.trim() || undefined,
          items: itemsPayload,
        });

        if (res.status === 'success') {
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.message || 'Gagal mencatat penerimaan stok masuk massal');
        }
      } else if (operation === 'STOCK_OUT') {
        if (stockOutActiveCount === 0) {
          setErrorMsg('Masukkan jumlah stok keluar (Qty > 0) pada minimal 1 barang.');
          setSubmitting(false);
          return;
        }

        // Cek peringatan jika melebihi stok
        const overStock = stockOutActiveRows.find((r) => r.qtyOut > r.systemStock);
        if (overStock) {
          setErrorMsg(`Stok "${overStock.name}" tidak mencukupi! Tersedia: ${overStock.systemStock} ${overStock.unit}, diminta keluar: ${overStock.qtyOut}.`);
          setSubmitting(false);
          return;
        }

        const itemsPayload = stockOutActiveRows.map((r) => ({
          ...(mode === 'PRODUCTS' ? { productId: r.id } : { inventoryItemId: r.id }),
          quantity: r.qtyOut,
          reason: r.reasonOut || generalReason,
          notes: r.stockOutNotes.trim() || undefined,
        }));

        const res = await api.recordBulkStockOut({
          outletId: activeOutlet?.id,
          generalReason: generalReason || 'WASTE',
          generalNotes: generalNotes.trim() || undefined,
          items: itemsPayload,
        });

        if (res.status === 'success') {
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.message || 'Gagal mencatat pengeluaran stok massal');
        }
      } else if (operation === 'TRANSFER') {
        if (!sourceOutletId || !targetOutletId) {
          setErrorMsg('Silakan pilih outlet asal dan outlet tujuan pengiriman transfer.');
          setSubmitting(false);
          return;
        }
        if (sourceOutletId === targetOutletId) {
          setErrorMsg('Outlet asal dan outlet tujuan pengiriman tidak boleh sama!');
          setSubmitting(false);
          return;
        }
        if (transferActiveCount === 0) {
          setErrorMsg('Masukkan jumlah transfer (Qty > 0) pada minimal 1 barang.');
          setSubmitting(false);
          return;
        }

        // Cek peringatan jika transfer melebihi stok asal
        const overStock = transferActiveRows.find((r) => r.qtyTransfer > r.systemStock);
        if (overStock) {
          setErrorMsg(`Stok "${overStock.name}" di outlet asal tidak mencukupi! Tersedia: ${overStock.systemStock} ${overStock.unit}, diminta transfer: ${overStock.qtyTransfer}.`);
          setSubmitting(false);
          return;
        }

        const itemsPayload = transferActiveRows.map((r) => ({
          ...(mode === 'PRODUCTS' ? { productId: r.id } : { inventoryItemId: r.id }),
          quantity: r.qtyTransfer,
          notes: r.transferNotes.trim() || undefined,
        }));

        const res = await api.recordBulkTransfer({
          sourceOutletId,
          targetOutletId,
          transferNumber: transferNumber.trim() || undefined,
          generalNotes: generalNotes.trim() || undefined,
          items: itemsPayload,
        });

        if (res.status === 'success') {
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.message || 'Gagal memproses transfer stok massal');
        }
      }
    } catch (err: any) {
      console.error('Error saat submit lembar kerja massal:', err);
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat memproses transaksi massal');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* ========================================================================= */}
      {/* 1. TOP NAVBAR HEADER */}
      {/* ========================================================================= */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        {/* Title & Active Outlet Info */}
        <div className="flex items-center justify-between gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl border flex items-center justify-center shadow-xs transition-colors shrink-0 ${
                operation === 'OPNAME'
                  ? 'bg-blue-50 text-blue-900 border-blue-200'
                  : operation === 'STOCK_IN'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : operation === 'STOCK_OUT'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-indigo-50 text-indigo-900 border-indigo-200'
              }`}
            >
              {operation === 'OPNAME' && <ClipboardCheck className="w-5 h-5 shrink-0" />}
              {operation === 'STOCK_IN' && <ArrowDownLeft className="w-5 h-5 shrink-0" />}
              {operation === 'STOCK_OUT' && <ArrowUpRight className="w-5 h-5 shrink-0" />}
              {operation === 'TRANSFER' && <ArrowLeftRight className="w-5 h-5 shrink-0" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-sm sm:text-base md:text-lg font-black text-slate-900 tracking-tight">
                  Lembar Kerja Inventori Massal
                </h2>
                {activeOutlet && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1 shrink-0">
                    <Store className="w-3 h-3 text-slate-500 shrink-0" />
                    <span>{activeOutlet.name}</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                {operation === 'OPNAME' && 'Hitung dan sesuaikan seluruh stok fisik dalam 1 sesi audit yang aman & atomik'}
                {operation === 'STOCK_IN' && 'Pencatatan barang datang dari supplier / belanja stok masuk secara kolektif'}
                {operation === 'STOCK_OUT' && 'Pencatatan pembersihan barang rusak, kadaluarsa, basi, atau operasional internal'}
                {operation === 'TRANSFER' && 'Mutasi distribusi stok antar toko atau gudang dalam 1 manifest pengiriman'}
              </p>
            </div>
          </div>

          {/* Close Window (Handheld top-right) */}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-all cursor-pointer shrink-0 md:hidden"
            title="Tutup lembar kerja"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          </button>
        </div>

        {/* 4 Operations Selector Pill & Category Switcher */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 -mx-2 px-2 sm:mx-0 sm:px-0 flex-nowrap w-full md:w-auto">
          {/* 4 Operations Selector Pill */}
          <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => handleOperationChange('OPNAME')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                operation === 'OPNAME'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Opname</span>
            </button>

            <button
              type="button"
              onClick={() => handleOperationChange('STOCK_IN')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                operation === 'STOCK_IN'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
              <span>Masuk</span>
            </button>

            <button
              type="button"
              onClick={() => handleOperationChange('STOCK_OUT')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                operation === 'STOCK_OUT'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              <span>Keluar</span>
            </button>

            <button
              type="button"
              onClick={() => handleOperationChange('TRANSFER')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                operation === 'TRANSFER'
                  ? 'bg-indigo-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
              <span>Transfer</span>
            </button>
          </div>

          {/* Item Category Switcher: Produk Jadi vs Bahan Baku */}
          <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => {
                setMode('PRODUCTS');
                setSearch('');
                setCategoryFilter('ALL');
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                mode === 'PRODUCTS'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-blue-900 shrink-0" />
              <span>Produk ({products.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('INGREDIENTS');
                setSearch('');
                setCategoryFilter('ALL');
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                mode === 'INGREDIENTS'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Bahan ({ingredients.length})</span>
            </button>
          </div>

          {/* Close Window (Desktop) */}
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-2xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hidden md:flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Tutup lembar kerja"
          >
            <X className="w-5 h-5 shrink-0" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. OPERATION CONFIGURATION HEADER (DYNAMIC FOR EACH OPERATION) */}
      {/* ========================================================================= */}
      {operation === 'STOCK_IN' && (
        <div className="shrink-0 bg-emerald-50/60 border-b border-emerald-100 px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-emerald-900">
            <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Info Dokumen Pembelian:</span>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
            <span className="text-slate-500 font-semibold whitespace-nowrap">Supplier:</span>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Contoh: PT Sumber Makmur..."
              className="flex-1 px-3 py-1.5 bg-white border border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium text-slate-800"
            />
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
            <span className="text-slate-500 font-semibold whitespace-nowrap">No. Faktur / PO:</span>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="Contoh: PO-2026/09/001..."
              className="flex-1 px-3 py-1.5 bg-white border border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium text-slate-800"
            />
          </div>
        </div>
      )}

      {operation === 'STOCK_OUT' && (
        <div className="shrink-0 bg-rose-50/60 border-b border-rose-100 px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-rose-900">
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            <span>Alasan Umum:</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={generalReason}
              onChange={(e) => setGeneralReason(e.target.value)}
              className="py-1.5 px-3 bg-white border border-rose-200 rounded-xl font-bold text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-500/20 cursor-pointer"
            >
              <option value="WASTE">Rusak / Basi / Pecah (WASTE)</option>
              <option value="EXPIRED">Kadaluarsa (EXPIRED)</option>
              <option value="INTERNAL_USE">Konsumsi / Operasional (INTERNAL_USE)</option>
              <option value="SHRINKAGE">Penyusutan / Selisih Hilang (SHRINKAGE)</option>
              <option value="OTHER">Lainnya (Catat di baris)</option>
            </select>
          </div>
          <span className="text-slate-500 font-medium text-[11px] hidden sm:inline">
            * Menjadi default untuk seluruh baris, Anda juga dapat mengubah alasan secara spesifik per baris.
          </span>
        </div>
      )}

      {operation === 'TRANSFER' && (
        <div className="shrink-0 bg-indigo-50/60 border-b border-indigo-100 px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-indigo-900">
            <Building2 className="w-4 h-4 text-indigo-700 shrink-0" />
            <span>Rute Distribusi Transfer:</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold whitespace-nowrap">Dari:</span>
            <select
              value={sourceOutletId}
              onChange={(e) => setSourceOutletId(e.target.value)}
              disabled={loadingOutlets || allOutlets.length <= 1}
              className="py-1.5 px-3 bg-white border border-indigo-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              {allOutlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.isWarehouse ? '(Gudang)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-center text-indigo-600 font-bold">
            ➔
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold whitespace-nowrap">Ke:</span>
            <select
              value={targetOutletId}
              onChange={(e) => setTargetOutletId(e.target.value)}
              disabled={loadingOutlets || allOutlets.length <= 1}
              className="py-1.5 px-3 bg-white border border-indigo-200 rounded-xl font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="">-- Pilih Tujuan --</option>
              {allOutlets
                .filter((o) => o.id !== sourceOutletId)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} {o.isWarehouse ? '(Gudang)' : ''}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-[180px] max-w-xs">
            <span className="text-slate-500 font-semibold whitespace-nowrap">No. SJ:</span>
            <input
              type="text"
              value={transferNumber}
              onChange={(e) => setTransferNumber(e.target.value)}
              placeholder="Auto / SJ-TRF..."
              className="flex-1 px-3 py-1.5 bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800"
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TOOLBAR FILTER & QUICK ACTIONS */}
      {/* ========================================================================= */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 sm:py-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Cari ${mode === 'PRODUCTS' ? 'nama produk, SKU...' : 'nama bahan, kode item...'}`}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 font-medium transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5 shrink-0" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 flex-nowrap">
            {/* Category Dropdown (for Products) */}
            {mode === 'PRODUCTS' && categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 cursor-pointer shrink-0"
              >
                <option value="ALL">Semua Kategori ({products.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {/* Toggle: Tampilkan Hanya yang Aktif / Diisi / Selisih */}
            <button
              type="button"
              onClick={() => setFilterOnlyActive(!filterOnlyActive)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap border shrink-0 ${
                filterOnlyActive
                  ? operation === 'OPNAME'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-blue-900 text-white border-blue-900 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {operation === 'OPNAME' ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Hanya Selisih ({opnameDivergentCount})</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Hanya Diisi (
                    {operation === 'STOCK_IN'
                      ? stockInActiveCount
                      : operation === 'STOCK_OUT'
                      ? stockOutActiveCount
                      : transferActiveCount}
                    )
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Batch Automation Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 flex-nowrap">
          {operation === 'OPNAME' ? (
            <>
              <button
                type="button"
                onClick={handleSyncAllToSystem}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                title="Salin seluruh nilai stok sistem ke kolom stok fisik aktual"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Samakan Sistem</span>
              </button>

              <button
                type="button"
                onClick={handleResetCurrentOperation}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                title="Reset seluruh input fisik menjadi 0"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Nol-kan Semua (0)</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleResetCurrentOperation}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap"
              title="Reset seluruh input jumlah item menjadi 0"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>Reset Qty (0)</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MAIN TABLE SHEET AREA (SCROLLABLE) */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4">
        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-between shadow-xs">
            <span>{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-800">
              <X className="w-4 h-4 shrink-0" />
            </button>
          </div>
        )}

        {/* Desktop Table View (Hidden on mobile / tablet) */}
        <div className="hidden lg:block bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Nama Barang &amp; Kode</th>
                <th className="py-3 px-4 w-28">Kategori</th>

                {/* Kolom Khusus OPNAME */}
                {operation === 'OPNAME' && (
                  <>
                    <th className="py-3 px-4 w-32 text-right">Harga Modal (HPP)</th>
                    <th className="py-3 px-4 w-28 text-center bg-slate-100/60 font-black text-slate-700">Stok Sistem</th>
                    <th className="py-3 px-4 w-44 text-center">Stok Fisik Aktual</th>
                    <th className="py-3 px-4 w-32 text-center">Selisih (Δ)</th>
                    <th className="py-3 px-4">Alasan / Catatan Baris</th>
                  </>
                )}

                {/* Kolom Khusus STOCK_IN */}
                {operation === 'STOCK_IN' && (
                  <>
                    <th className="py-3 px-4 w-28 text-center bg-slate-100/60 font-black text-slate-700">Stok Saat Ini</th>
                    <th className="py-3 px-4 w-44 text-center font-black text-emerald-800">Qty Masuk (+)</th>
                    <th className="py-3 px-4 w-36 text-right">Harga Beli Satuan</th>
                    <th className="py-3 px-4 w-36 text-right font-black text-slate-800">Subtotal Belanja</th>
                    <th className="py-3 px-4">Catatan Baris</th>
                  </>
                )}

                {/* Kolom Khusus STOCK_OUT */}
                {operation === 'STOCK_OUT' && (
                  <>
                    <th className="py-3 px-4 w-28 text-center bg-slate-100/60 font-black text-slate-700">Stok Saat Ini</th>
                    <th className="py-3 px-4 w-44 text-center font-black text-rose-800">Qty Keluar (-)</th>
                    <th className="py-3 px-4 w-44">Alasan Spesifik</th>
                    <th className="py-3 px-4 w-36 text-right font-black text-rose-800">Kerugian HPP</th>
                    <th className="py-3 px-4">Catatan Baris</th>
                  </>
                )}

                {/* Kolom Khusus TRANSFER */}
                {operation === 'TRANSFER' && (
                  <>
                    <th className="py-3 px-4 w-28 text-center bg-slate-100/60 font-black text-slate-700">Stok di Asal</th>
                    <th className="py-3 px-4 w-44 text-center font-black text-indigo-900">Qty Transfer</th>
                    <th className="py-3 px-4 w-36 text-right">Harga Modal</th>
                    <th className="py-3 px-4 w-36 text-right font-black text-indigo-900">Nilai Aset</th>
                    <th className="py-3 px-4">Catatan Baris</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    Tidak ada item yang sesuai dengan filter pencarian saat ini.
                  </td>
                </tr>
              ) : (
                filteredList.map((row, idx) => {
                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        operation === 'OPNAME' && row.isOpnameModified
                          ? 'bg-amber-50/30 hover:bg-amber-50/60'
                          : operation === 'STOCK_IN' && row.qtyIn > 0
                          ? 'bg-emerald-50/30 hover:bg-emerald-50/60'
                          : operation === 'STOCK_OUT' && row.qtyOut > 0
                          ? 'bg-rose-50/30 hover:bg-rose-50/60'
                          : operation === 'TRANSFER' && row.qtyTransfer > 0
                          ? 'bg-indigo-50/30 hover:bg-indigo-50/60'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* No */}
                      <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>

                      {/* Nama & Kode */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className="font-extrabold text-slate-900 block text-xs">{row.name}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded font-bold text-slate-600">
                              {row.code}
                            </span>
                            <span className="text-[10px] text-blue-900 bg-blue-50 px-1.5 py-0.2 rounded font-bold border border-blue-100">
                              {row.unit}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Kategori */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px]">
                          {row.categoryName}
                        </span>
                      </td>

                      {/* ========================================= */}
                      {/* RENDER CELL OPNAME */}
                      {/* ========================================= */}
                      {operation === 'OPNAME' && (
                        <>
                          {/* HPP */}
                          <td className="py-3 px-4 text-right font-medium text-slate-600">
                            {formatRupiah(row.costPrice)}
                          </td>

                          {/* Stok Sistem */}
                          <td className="py-3 px-4 text-center bg-slate-100/40">
                            <span className="text-xs font-black text-slate-700">
                              {row.systemStock.toLocaleString('id-ID')}
                            </span>
                          </td>

                          {/* Input Stok Fisik Aktual */}
                          <td className="py-2.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpnameStockChange(row.id, row.actualStock - 1)}
                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={row.actualStock}
                                onChange={(e) => handleOpnameStockChange(row.id, parseFloat(e.target.value))}
                                onFocus={(e) => e.target.select()}
                                className="w-20 py-1.5 text-center text-xs font-black bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                              />
                              <button
                                type="button"
                                onClick={() => handleOpnameStockChange(row.id, row.actualStock + 1)}
                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Selisih (Delta) */}
                          <td className="py-3 px-4 text-center">
                            {!row.isOpnameModified ? (
                              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-slate-400" />
                                <span>Cocok (0)</span>
                              </span>
                            ) : row.opnameDelta < 0 ? (
                              <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-black text-[10px] inline-flex items-center gap-1">
                                <span>{row.opnameDelta}</span>
                                <span className="font-semibold text-[9px]">(Kurang)</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-black text-[10px] inline-flex items-center gap-1">
                                <span>+{row.opnameDelta}</span>
                                <span className="font-semibold text-[9px]">(Lebih)</span>
                              </span>
                            )}
                          </td>

                          {/* Catatan Baris */}
                          <td className="py-2.5 px-4">
                            <input
                              type="text"
                              value={row.opnameNotes}
                              onChange={(e) => handleOpnameNotesChange(row.id, e.target.value)}
                              placeholder="Contoh: pecah, basi, bonus..."
                              className="w-full px-2.5 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-900 font-medium"
                            />
                          </td>
                        </>
                      )}

                      {/* ========================================= */}
                      {/* RENDER CELL STOCK_IN */}
                      {/* ========================================= */}
                      {operation === 'STOCK_IN' && (
                        <>
                          {/* Stok Saat Ini */}
                          <td className="py-3 px-4 text-center bg-slate-100/40">
                            <span className="text-xs font-black text-slate-700">
                              {row.systemStock.toLocaleString('id-ID')}
                            </span>
                          </td>

                          {/* Input Qty Masuk */}
                          <td className="py-2.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStockInQtyChange(row.id, row.qtyIn - 1)}
                                className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={row.qtyIn}
                                onChange={(e) => handleStockInQtyChange(row.id, parseFloat(e.target.value))}
                                onFocus={(e) => e.target.select()}
                                className={`w-20 py-1.5 text-center text-xs font-black bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 ${
                                  row.qtyIn > 0 ? 'border-emerald-500 text-emerald-800' : 'border-slate-300 text-slate-700'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => handleStockInQtyChange(row.id, row.qtyIn + 1)}
                                className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Input Harga Beli Satuan (Opsional) */}
                          <td className="py-2.5 px-4 text-right">
                            <input
                              type="number"
                              min="0"
                              value={row.costPriceIn || ''}
                              onChange={(e) => handleStockInPriceChange(row.id, parseFloat(e.target.value))}
                              placeholder={formatRupiah(row.costPrice)}
                              className="w-28 py-1.5 px-2 text-right text-xs font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                            />
                          </td>

                          {/* Subtotal Belanja */}
                          <td className="py-3 px-4 text-right font-black text-emerald-800">
                            {formatRupiah(row.qtyIn * (row.costPriceIn || row.costPrice))}
                          </td>

                          {/* Catatan Baris */}
                          <td className="py-2.5 px-4">
                            <input
                              type="text"
                              value={row.stockInNotes}
                              onChange={(e) => handleStockInNotesChange(row.id, e.target.value)}
                              placeholder="Contoh: Dus segel, bonus 1 pcs..."
                              className="w-full px-2.5 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-emerald-600 font-medium"
                            />
                          </td>
                        </>
                      )}

                      {/* ========================================= */}
                      {/* RENDER CELL STOCK_OUT */}
                      {/* ========================================= */}
                      {operation === 'STOCK_OUT' && (
                        <>
                          {/* Stok Saat Ini */}
                          <td className="py-3 px-4 text-center bg-slate-100/40">
                            <span className="text-xs font-black text-slate-700">
                              {row.systemStock.toLocaleString('id-ID')}
                            </span>
                          </td>

                          {/* Input Qty Keluar */}
                          <td className="py-2.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStockOutQtyChange(row.id, row.qtyOut - 1)}
                                className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-900 font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={row.qtyOut}
                                onChange={(e) => handleStockOutQtyChange(row.id, parseFloat(e.target.value))}
                                onFocus={(e) => e.target.select()}
                                className={`w-20 py-1.5 text-center text-xs font-black bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 ${
                                  row.qtyOut > row.systemStock
                                    ? 'border-rose-600 text-rose-700 bg-rose-50/50'
                                    : row.qtyOut > 0
                                    ? 'border-rose-500 text-rose-800'
                                    : 'border-slate-300 text-slate-700'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => handleStockOutQtyChange(row.id, row.qtyOut + 1)}
                                className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-900 font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95"
                              >
                                +
                              </button>
                            </div>
                            {row.qtyOut > row.systemStock && (
                              <div className="text-[10px] text-rose-600 font-black mt-1">
                                Melebihi Stok!
                              </div>
                            )}
                          </td>

                          {/* Alasan Spesifik Baris */}
                          <td className="py-2.5 px-4">
                            <select
                              value={row.reasonOut}
                              onChange={(e) => handleStockOutReasonChange(row.id, e.target.value)}
                              className="w-full py-1.5 px-2 text-[11px] bg-white border border-slate-200 rounded-lg font-bold text-slate-700 focus:outline-none focus:border-rose-600"
                            >
                              <option value="WASTE">Rusak / Basi (WASTE)</option>
                              <option value="EXPIRED">Kadaluarsa (EXPIRED)</option>
                              <option value="INTERNAL_USE">Konsumsi (INTERNAL)</option>
                              <option value="SHRINKAGE">Penyusutan (SHRINKAGE)</option>
                              <option value="OTHER">Lainnya</option>
                            </select>
                          </td>

                          {/* Kerugian HPP */}
                          <td className="py-3 px-4 text-right font-black text-rose-700">
                            {formatRupiah(row.qtyOut * row.costPrice)}
                          </td>

                          {/* Catatan Baris */}
                          <td className="py-2.5 px-4">
                            <input
                              type="text"
                              value={row.stockOutNotes}
                              onChange={(e) => handleStockOutNotesChange(row.id, e.target.value)}
                              placeholder="Keterangan kondisi..."
                              className="w-full px-2.5 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-rose-600 font-medium"
                            />
                          </td>
                        </>
                      )}

                      {/* ========================================= */}
                      {/* RENDER CELL TRANSFER */}
                      {/* ========================================= */}
                      {operation === 'TRANSFER' && (
                        <>
                          {/* Stok di Asal */}
                          <td className="py-3 px-4 text-center bg-slate-100/40">
                            <span className="text-xs font-black text-slate-700">
                              {row.systemStock.toLocaleString('id-ID')}
                            </span>
                          </td>

                          {/* Input Qty Transfer */}
                          <td className="py-2.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleTransferQtyChange(row.id, row.qtyTransfer - 1)}
                                className="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={row.qtyTransfer}
                                onChange={(e) => handleTransferQtyChange(row.id, parseFloat(e.target.value))}
                                onFocus={(e) => e.target.select()}
                                className={`w-20 py-1.5 text-center text-xs font-black bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 ${
                                  row.qtyTransfer > row.systemStock
                                    ? 'border-rose-600 text-rose-700 bg-rose-50/50'
                                    : row.qtyTransfer > 0
                                    ? 'border-indigo-500 text-indigo-900'
                                    : 'border-slate-300 text-slate-700'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => handleTransferQtyChange(row.id, row.qtyTransfer + 1)}
                                className="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95"
                              >
                                +
                              </button>
                            </div>
                            {row.qtyTransfer > row.systemStock && (
                              <div className="text-[10px] text-rose-600 font-black mt-1">
                                Melebihi Stok Asal!
                              </div>
                            )}
                          </td>

                          {/* Harga Modal HPP */}
                          <td className="py-3 px-4 text-right font-medium text-slate-600">
                            {formatRupiah(row.costPrice)}
                          </td>

                          {/* Nilai Aset Transfer */}
                          <td className="py-3 px-4 text-right font-black text-indigo-900">
                            {formatRupiah(row.qtyTransfer * row.costPrice)}
                          </td>

                          {/* Catatan Baris */}
                          <td className="py-2.5 px-4">
                            <input
                              type="text"
                              value={row.transferNotes}
                              onChange={(e) => handleTransferNotesChange(row.id, e.target.value)}
                              placeholder="Koli / kemasan..."
                              className="w-full px-2.5 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-indigo-600 font-medium"
                            />
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ========================================================================= */}
        {/* HANDHELD MOBILE/TABLET CARD VIEW (ERGONOMIC & THUMB-FRIENDLY) */}
        {/* ========================================================================= */}
        <div className="block lg:hidden space-y-3 pb-6">
          {filteredList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 font-medium">
              Tidak ada item yang sesuai dengan filter pencarian saat ini.
            </div>
          ) : (
            filteredList.map((row, idx) => {
              return (
                <div
                  key={row.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    operation === 'OPNAME' && row.isOpnameModified
                      ? 'bg-amber-50/40 border-amber-300 shadow-xs'
                      : operation === 'STOCK_IN' && row.qtyIn > 0
                      ? 'bg-emerald-50/40 border-emerald-300 shadow-xs'
                      : operation === 'STOCK_OUT' && row.qtyOut > 0
                      ? 'bg-rose-50/40 border-rose-300 shadow-xs'
                      : operation === 'TRANSFER' && row.qtyTransfer > 0
                      ? 'bg-indigo-50/40 border-indigo-300 shadow-xs'
                      : 'bg-white border-slate-200 shadow-2xs'
                  }`}
                >
                  {/* Card Header: No, Nama, SKU, UOM & Kategori */}
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[11px] font-bold text-slate-400">#{idx + 1}</span>
                        <h4 className="text-sm font-extrabold text-slate-900 truncate">{row.name}</h4>
                      </div>
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-600">
                          {row.code}
                        </span>
                        <span className="text-[10px] text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded font-bold border border-blue-100">
                          {row.unit}
                        </span>
                        <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                          {row.categoryName}
                        </span>
                      </div>
                    </div>

                    {/* Status badge pada Opname */}
                    {operation === 'OPNAME' && (
                      <div className="shrink-0">
                        {!row.isOpnameModified ? (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold text-[10px] inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>Cocok</span>
                          </span>
                        ) : row.opnameDelta < 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-black text-[10px] inline-flex items-center gap-1">
                            <span>{row.opnameDelta}</span>
                            <span className="text-[9px]">(Kurang)</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-black text-[10px] inline-flex items-center gap-1">
                            <span>+{row.opnameDelta}</span>
                            <span className="text-[9px]">(Lebih)</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Body per Operasi */}
                  <div className="pt-3 space-y-3">
                    {/* OPNAME HANDHELD */}
                    {operation === 'OPNAME' && (
                      <>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-xl bg-slate-100/70 border border-slate-200/80">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Stok Sistem
                            </span>
                            <span className="text-base font-black text-slate-800">
                              {row.systemStock.toLocaleString('id-ID')}
                            </span>
                            <span className="text-[11px] text-slate-400 ml-1 font-semibold">{row.unit}</span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Harga Modal (HPP)
                            </span>
                            <span className="text-xs font-extrabold text-slate-700">
                              {formatRupiah(row.costPrice)}
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            Input Stok Fisik Aktual:
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpnameStockChange(row.id, Math.max(0, row.actualStock - 1))}
                              className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-lg font-black flex items-center justify-center transition-all active:scale-95 border border-slate-200 shrink-0"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={row.actualStock}
                              onChange={(e) => handleOpnameStockChange(row.id, parseFloat(e.target.value))}
                              onFocus={(e) => e.target.select()}
                              className="flex-1 h-11 text-center text-base font-black bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 text-slate-900"
                            />
                            <button
                              type="button"
                              onClick={() => handleOpnameStockChange(row.id, row.actualStock + 1)}
                              className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-lg font-black flex items-center justify-center transition-all active:scale-95 border border-slate-200 shrink-0"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div>
                          <input
                            type="text"
                            value={row.opnameNotes}
                            onChange={(e) => handleOpnameNotesChange(row.id, e.target.value)}
                            placeholder="Catatan selisih (misal: pecah, basi, kemasan rusak)..."
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-900 font-medium"
                          />
                        </div>
                      </>
                    )}

                    {/* STOCK_IN HANDHELD */}
                    {operation === 'STOCK_IN' && (
                      <>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/70 border border-slate-200/80 text-xs">
                          <span className="font-bold text-slate-500">Stok Saat Ini:</span>
                          <span className="font-black text-slate-800">{row.systemStock} {row.unit}</span>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-emerald-800 block mb-1">
                            Qty Masuk (+):
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleStockInQtyChange(row.id, Math.max(0, row.qtyIn - 1))}
                              className="w-11 h-11 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-lg font-black flex items-center justify-center transition-all active:scale-95 border border-emerald-200 shrink-0"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={row.qtyIn}
                              onChange={(e) => handleStockInQtyChange(row.id, parseFloat(e.target.value))}
                              onFocus={(e) => e.target.select()}
                              className="flex-1 h-11 text-center text-base font-black bg-white border border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-emerald-950"
                            />
                            <button
                              type="button"
                              onClick={() => handleStockInQtyChange(row.id, row.qtyIn + 1)}
                              className="w-11 h-11 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-lg font-black flex items-center justify-center transition-all active:scale-95 border border-emerald-200 shrink-0"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 block mb-1">Harga Beli Satuan</span>
                            <input
                              type="number"
                              min="0"
                              value={row.costPriceIn}
                              onChange={(e) => handleStockInPriceChange(row.id, parseFloat(e.target.value))}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 block mb-1">Subtotal Belanja</span>
                            <div className="h-8 flex items-center font-black text-slate-900">
                              {formatRupiah(row.qtyIn * (row.costPriceIn || row.costPrice))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <input
                            type="text"
                            value={row.stockInNotes}
                            onChange={(e) => handleStockInNotesChange(row.id, e.target.value)}
                            placeholder="Catatan masuk (no koli, batch, expired date)..."
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-600 font-medium"
                          />
                        </div>
                      </>
                    )}

                    {/* STOCK_OUT HANDHELD */}
                    {operation === 'STOCK_OUT' && (
                      <>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/70 border border-slate-200/80 text-xs">
                          <span className="font-bold text-slate-500">Stok Tersedia:</span>
                          <span className="font-black text-slate-800">{row.systemStock} {row.unit}</span>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-rose-800 block mb-1">
                            Qty Keluar (-):
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleStockOutQtyChange(row.id, Math.max(0, row.qtyOut - 1))}
                              className="w-11 h-11 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-900 text-lg font-black flex items-center justify-center transition-all active:scale-95 border border-rose-200 shrink-0"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={row.qtyOut}
                              onChange={(e) => handleStockOutQtyChange(row.id, parseFloat(e.target.value))}
                              onFocus={(e) => e.target.select()}
                              className={`flex-1 h-11 text-center text-base font-black bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 ${
                                row.qtyOut > row.systemStock
                                  ? 'border-rose-600 text-rose-700 bg-rose-50/50'
                                  : 'border-rose-300 text-rose-950'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => handleStockOutQtyChange(row.id, row.qtyOut + 1)}
                              className="w-11 h-11 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-900 text-lg font-black flex items-center justify-center transition-all active:scale-95 border border-rose-200 shrink-0"
                            >
                              +
                            </button>
                          </div>
                          {row.qtyOut > row.systemStock && (
                            <p className="text-[10px] text-rose-600 font-black mt-1">Melebihi stok yang tersedia!</p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 block mb-1">Alasan Pengeluaran</span>
                            <select
                              value={row.reasonOut}
                              onChange={(e) => handleStockOutReasonChange(row.id, e.target.value)}
                              className="w-full py-1.5 px-2 bg-white border border-rose-200 rounded-xl font-bold text-rose-950 text-xs"
                            >
                              <option value="WASTE">Rusak / Basi</option>
                              <option value="EXPIRED">Kadaluarsa</option>
                              <option value="INTERNAL_USE">Operasional</option>
                              <option value="SHRINKAGE">Penyusutan</option>
                              <option value="OTHER">Lainnya</option>
                            </select>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 block mb-1">Kerugian HPP</span>
                            <div className="h-8 flex items-center font-black text-rose-800 text-xs">
                              {formatRupiah(row.qtyOut * row.costPrice)}
                            </div>
                          </div>
                        </div>

                        <div>
                          <input
                            type="text"
                            value={row.stockOutNotes}
                            onChange={(e) => handleStockOutNotesChange(row.id, e.target.value)}
                            placeholder="Catatan detail barang keluar..."
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-rose-600 font-medium"
                          />
                        </div>
                      </>
                    )}

                    {/* TRANSFER HANDHELD */}
                    {operation === 'TRANSFER' && (
                      <>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/70 border border-slate-200/80 text-xs">
                          <span className="font-bold text-slate-500">Stok di Asal:</span>
                          <span className="font-black text-slate-800">{row.systemStock} {row.unit}</span>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-indigo-900 block mb-1">
                            Qty Transfer:
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleTransferQtyChange(row.id, Math.max(0, row.qtyTransfer - 1))}
                              className="w-11 h-11 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-lg font-black flex items-center justify-center transition-all active:scale-95 border border-indigo-200 shrink-0"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={row.qtyTransfer}
                              onChange={(e) => handleTransferQtyChange(row.id, parseFloat(e.target.value))}
                              onFocus={(e) => e.target.select()}
                              className={`flex-1 h-11 text-center text-base font-black bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 ${
                                row.qtyTransfer > row.systemStock
                                  ? 'border-rose-600 text-rose-700 bg-rose-50/50'
                                  : row.qtyTransfer > 0
                                  ? 'border-indigo-500 text-indigo-900'
                                  : 'border-slate-300 text-slate-700'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => handleTransferQtyChange(row.id, row.qtyTransfer + 1)}
                              className="w-11 h-11 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-lg font-black flex items-center justify-center transition-all active:scale-95 border border-indigo-200 shrink-0"
                            >
                              +
                            </button>
                          </div>
                          {row.qtyTransfer > row.systemStock && (
                            <p className="text-[10px] text-rose-600 font-black mt-1">Melebihi Stok Asal!</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span>Nilai Aset Transfer:</span>
                          <span className="font-black text-indigo-900">{formatRupiah(row.qtyTransfer * row.costPrice)}</span>
                        </div>

                        <div>
                          <input
                            type="text"
                            value={row.transferNotes}
                            onChange={(e) => handleTransferNotesChange(row.id, e.target.value)}
                            placeholder="Catatan transfer (koli / dus / kondisi)..."
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-600 font-medium"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. STICKY BOTTOM SUMMARY & SUBMISSION BAR */}
      {/* ========================================================================= */}
      <footer className="shrink-0 bg-white border-t border-slate-200 px-4 sm:px-6 py-3 sm:py-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        {/* Ringkasan Dinamis Sesuai Operasi Terpilih */}
        <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar py-1 flex-nowrap w-full md:w-auto">
          {operation === 'OPNAME' && (
            <>
              <div className="space-y-0.5 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Item Dihitung</span>
                <div className="text-xs sm:text-sm font-black text-slate-900">
                  {totalItems} Item{' '}
                  <span className="text-[11px] font-semibold text-slate-500">
                    ({opnameMatchCount} cocok, <span className="text-amber-600 font-bold">{opnameDivergentCount} selisih</span>)
                  </span>
                </div>
              </div>

              <div className="h-7 w-px bg-slate-200 shrink-0" />

              <div className="space-y-0.5 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Selisih</span>
                <div
                  className={`text-xs sm:text-sm font-black ${
                    opnameTotalDeltaUnits === 0 ? 'text-slate-700' : opnameTotalDeltaUnits < 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {opnameTotalDeltaUnits > 0 ? `+${opnameTotalDeltaUnits}` : opnameTotalDeltaUnits} {mode === 'PRODUCTS' ? 'Unit' : 'Satuan'}
                </div>
              </div>

              <div className="h-7 w-px bg-slate-200 shrink-0" />

              <div className="space-y-0.5 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Dampak HPP</span>
                <div
                  className={`text-xs sm:text-sm font-black ${
                    opnameFinancialImpact === 0
                      ? 'text-slate-700'
                      : opnameFinancialImpact < 0
                      ? 'text-rose-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {opnameFinancialImpact > 0 ? `+${formatRupiah(opnameFinancialImpact)}` : formatRupiah(opnameFinancialImpact)}
                </div>
              </div>
            </>
          )}

          {operation === 'STOCK_IN' && (
            <>
              <div className="space-y-0.5 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Item Masuk</span>
                <div className="text-xs sm:text-sm font-black text-emerald-800">
                  {stockInActiveCount} Item
                </div>
              </div>

              <div className="h-7 w-px bg-slate-200 shrink-0" />

              <div className="space-y-0.5 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Qty</span>
                <div className="text-xs sm:text-sm font-black text-emerald-800">
                  +{stockInTotalUnits} {mode === 'PRODUCTS' ? 'Unit' : 'Satuan'}
                </div>
              </div>

              <div className="h-7 w-px bg-slate-200 shrink-0" />

              <div className="space-y-0.5 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Est. Belanja</span>
                <div className="text-xs sm:text-sm font-black text-slate-900">
                  {formatRupiah(stockInTotalCost)}
                </div>
              </div>
            </>
          )}

          {operation === 'STOCK_OUT' && (
            <>
              <div className="space-y-0.5 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Item Keluar</span>
                <div className="text-xs sm:text-sm font-black text-rose-800">
                  {stockOutActiveCount} Item
                </div>
              </div>

              <div className="h-7 w-px bg-slate-200 shrink-0" />

              <div className="space-y-0.5 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Qty</span>
                <div className="text-xs sm:text-sm font-black text-rose-800">
                  -{stockOutTotalUnits} {mode === 'PRODUCTS' ? 'Unit' : 'Satuan'}
                </div>
              </div>

              <div className="h-7 w-px bg-slate-200 shrink-0" />

              <div className="space-y-0.5 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Kerugian HPP</span>
                <div className="text-xs sm:text-sm font-black text-rose-800">
                  {formatRupiah(stockOutTotalLoss)}
                </div>
              </div>
            </>
          )}

          {operation === 'TRANSFER' && (
            <>
              <div className="space-y-0.5 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Rute</span>
                <div className="text-xs font-black text-indigo-900 flex items-center gap-1">
                  <span className="bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 max-w-[90px] truncate">
                    {sourceOutletObj?.name || 'Asal'}
                  </span>
                  <span>➔</span>
                  <span className="bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 max-w-[90px] truncate">
                    {targetOutletObj?.name || 'Tujuan'}
                  </span>
                </div>
              </div>

              <div className="h-7 w-px bg-slate-200 shrink-0" />

              <div className="space-y-0.5 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Transfer</span>
                <div className="text-xs sm:text-sm font-black text-indigo-900">
                  {transferActiveCount} Item ({transferTotalUnits} Unit)
                </div>
              </div>

              <div className="h-7 w-px bg-slate-200 shrink-0" />

              <div className="space-y-0.5 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Nilai Aset</span>
                <div className="text-xs sm:text-sm font-black text-slate-900">
                  {formatRupiah(transferTotalAssetValue)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Input Catatan Global & Tombol Submit */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 flex-1 justify-end w-full md:max-w-xl">
          <input
            type="text"
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            placeholder={
              operation === 'OPNAME'
                ? 'Catatan umum sesi opname (misal: Opname Bulanan September)'
                : operation === 'STOCK_IN'
                ? 'Catatan umum stok masuk (misal: Kiriman batch 1)'
                : operation === 'STOCK_OUT'
                ? 'Catatan umum stok keluar (misal: Kerusakan akibat mati lampu freezer)'
                : 'Catatan umum transfer stok (misal: Pengiriman stok mingguan antar toko)'
            }
            className="w-full sm:flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 font-medium"
          />

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer text-center"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                submitting ||
                (operation === 'STOCK_IN' && stockInActiveCount === 0) ||
                (operation === 'STOCK_OUT' && stockOutActiveCount === 0) ||
                (operation === 'TRANSFER' && (transferActiveCount === 0 || !targetOutletId || sourceOutletId === targetOutletId))
              }
              className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-white text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md disabled:opacity-50 whitespace-nowrap ${
                operation === 'OPNAME'
                  ? 'bg-blue-900 hover:bg-blue-950 shadow-blue-950/20'
                  : operation === 'STOCK_IN'
                  ? 'bg-emerald-700 hover:bg-emerald-800 shadow-emerald-800/20'
                  : operation === 'STOCK_OUT'
                  ? 'bg-rose-700 hover:bg-rose-800 shadow-rose-800/20'
                  : 'bg-indigo-900 hover:bg-indigo-950 shadow-indigo-950/20'
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                  <span>Memproses...</span>
                </>
              ) : operation === 'OPNAME' ? (
                <>
                  <Save className="w-4 h-4 shrink-0" />
                  <span>Simpan Opname ({opnameDivergentCount})</span>
                </>
              ) : operation === 'STOCK_IN' ? (
                <>
                  <ArrowDownLeft className="w-4 h-4 shrink-0" />
                  <span>Simpan Masuk ({stockInActiveCount})</span>
                </>
              ) : operation === 'STOCK_OUT' ? (
                <>
                  <ArrowUpRight className="w-4 h-4 shrink-0" />
                  <span>Simpan Keluar ({stockOutActiveCount})</span>
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 shrink-0" />
                  <span>Kirim Transfer ({transferActiveCount})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Backwards compatibility alias
export const FullScreenBulkOpnameModal = FullScreenBulkStockModal;
