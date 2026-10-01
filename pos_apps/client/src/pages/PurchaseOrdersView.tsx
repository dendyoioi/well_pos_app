import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  Truck,
  CheckCircle2,
  Clock,
  X,
  Package,
  Calendar,
  Send,
  Trash2,
  Eye,
  Boxes,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
  CreatePurchaseOrderInput,
  ReceivePOItemInput,
} from '../types/purchasing';
import type { Supplier } from '../types/supplier';
import type { Outlet } from '../types/outlet';
import type { RecipeInventoryItem } from '../types/recipe';
import { TablePagination } from '../components/TablePagination';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { ConfirmModal } from '../components/ConfirmModal';
import { useDialog } from '../context/DialogContext';
import { formatRupiah } from '../utils/currency';

interface PurchaseOrdersViewProps {
  activeOutlet?: Outlet | null;
}

export const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({ activeOutlet }) => {
  const dialog = useDialog();

  // Data states
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [inventoryItems, setInventoryItems] = useState<RecipeInventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [outletFilter, setOutletFilter] = useState<string>(activeOutlet?.id || 'ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Modal: Create PO
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [submittingPO, setSubmittingPO] = useState<boolean>(false);
  const [poFormOutletId, setPoFormOutletId] = useState<string>(activeOutlet?.id || '');
  const [poFormSupplierId, setPoFormSupplierId] = useState<string>('');
  const [poFormExpectedDate, setPoFormExpectedDate] = useState<string>('');
  const [poFormNotes, setPoFormNotes] = useState<string>('');
  const [poFormItems, setPoFormItems] = useState<
    Array<{
      inventoryItemId: string;
      quantityOrdered: number;
      unitCost: number;
      notes: string;
    }>
  >([]);

  // Modal: View Detail PO
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);

  // Modal: Receive Goods (Penerimaan Fisik)
  const [receiveModalOpen, setReceiveModalOpen] = useState<boolean>(false);
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [submittingReceive, setSubmittingReceive] = useState<boolean>(false);
  const [receiveItemsData, setReceiveItemsData] = useState<
    Array<{
      purchaseOrderItemId: string;
      itemName: string;
      uom: string;
      ordered: number;
      alreadyReceived: number;
      remaining: number;
      quantityReceived: number;
      unitCost: number;
      batchNumber: string;
      expirationDate: string;
    }>
  >([]);

  // Modal: Cancel Confirm
  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [cancellingPO, setCancellingPO] = useState<PurchaseOrder | null>(null);
  const [submittingCancel, setSubmittingCancel] = useState<boolean>(false);

  // Initial Fetch Suppliers & Outlets
  useEffect(() => {
    const fetchPrerequisites = async () => {
      try {
        const [supRes, outRes] = await Promise.all([
          api.getSuppliers({ isActive: true }),
          api.getOutlets(),
        ]);
        if (supRes.status === 'success' && supRes.data) {
          setSuppliers(supRes.data);
        }
        if (outRes.status === 'success' && outRes.data) {
          setOutlets(outRes.data);
          if (!poFormOutletId && outRes.data.length > 0) {
            setPoFormOutletId(activeOutlet?.id || outRes.data[0].id);
          }
        }
      } catch (err) {
        console.error('Gagal mengambil data prasyarat PO:', err);
      }
    };
    fetchPrerequisites();
  }, [activeOutlet?.id, poFormOutletId]);

  // Load Inventory Items for Selected Outlet in Create Form
  useEffect(() => {
    if (!createModalOpen || !poFormOutletId) return;
    const loadItems = async () => {
      try {
        const res = await api.getRecipeInventoryItems(poFormOutletId, 'all');
        if (res.status === 'success' && res.data) {
          setInventoryItems(res.data);
        }
      } catch (err) {
        console.error('Gagal mengambil bahan baku:', err);
      }
    };
    loadItems();
  }, [createModalOpen, poFormOutletId]);

  // Fetch Purchase Orders List
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getPurchaseOrders({
        outletId: outletFilter === 'ALL' ? undefined : outletFilter,
        supplierId: supplierFilter === 'ALL' ? undefined : supplierFilter,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page: currentPage,
        limit: pageSize,
      });

      if (res.status === 'success' && res.data) {
        setOrders(res.data);
        if (res.pagination) {
          setTotalCount(res.pagination.total);
        } else {
          setTotalCount(res.data.length);
        }
      }
    } catch (err) {
      console.error('Gagal mengambil data purchase orders:', err);
    } finally {
      setLoading(false);
    }
  }, [outletFilter, supplierFilter, statusFilter, currentPage, pageSize]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Client-side search filtering if query provided
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(
      (po) =>
        po.poNumber.toLowerCase().includes(q) ||
        po.supplier?.name.toLowerCase().includes(q) ||
        po.outlet?.name.toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);

  // KPI Calculations
  const kpiStats = useMemo(() => {
    const total = orders.length;
    const drafts = orders.filter((o) => o.status === 'DRAFT').length;
    const issued = orders.filter(
      (o) => o.status === 'ISSUED' || o.status === 'PARTIALLY_RECEIVED'
    ).length;
    const received = orders.filter((o) => o.status === 'RECEIVED').length;
    const totalAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    return { total, drafts, issued, received, totalAmount };
  }, [orders]);

  // Status Badge Helper
  const renderStatusBadge = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Draf
          </span>
        );
      case 'ISSUED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200">
            <Send className="w-3.5 h-3.5 text-blue-800" />
            Diterbitkan
          </span>
        );
      case 'PARTIALLY_RECEIVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Truck className="w-3.5 h-3.5 text-amber-600" />
            Diterima Sebagian
          </span>
        );
      case 'RECEIVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Selesai Diterima
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <X className="w-3.5 h-3.5 text-rose-600" />
            Dibatalkan
          </span>
        );
      default:
        return null;
    }
  };

  // Open Create PO Modal
  const handleOpenCreateModal = () => {
    setPoFormOutletId(activeOutlet?.id || outlets[0]?.id || '');
    setPoFormSupplierId(suppliers[0]?.id || '');
    setPoFormExpectedDate('');
    setPoFormNotes('');
    setPoFormItems([]);
    setCreateModalOpen(true);
  };

  // Add Item in Create PO Form
  const handleAddItemToPO = () => {
    if (inventoryItems.length === 0) {
      dialog.alert({ title: 'Peringatan', message: 'Tidak ada data bahan baku yang tersedia di outlet terpilih.', variant: 'warning' });
      return;
    }
    const firstItem = inventoryItems[0];
    setPoFormItems((prev) => [
      ...prev,
      {
        inventoryItemId: firstItem.id,
        quantityOrdered: 1,
        unitCost: firstItem.averageCost || 0,
        notes: '',
      },
    ]);
  };

  const handleRemoveItemFromPO = (index: number) => {
    setPoFormItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateItemField = (index: number, field: string, value: any) => {
    setPoFormItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === 'inventoryItemId') {
        const found = inventoryItems.find((it) => it.id === value);
        if (found) {
          item.unitCost = found.averageCost || 0;
        }
      }
      next[index] = item;
      return next;
    });
  };

  // Submit Create PO
  const handleSavePurchaseOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poFormOutletId) {
      dialog.alert({ title: 'Validasi', message: 'Silakan pilih outlet tujuan penerimaan.', variant: 'warning' });
      return;
    }
    if (!poFormSupplierId) {
      dialog.alert({ title: 'Validasi', message: 'Silakan pilih pemasok (vendor).', variant: 'warning' });
      return;
    }
    if (poFormItems.length === 0) {
      dialog.alert({ title: 'Validasi', message: 'Daftar item PO minimal harus memiliki 1 bahan baku.', variant: 'warning' });
      return;
    }

    for (const it of poFormItems) {
      if (!it.inventoryItemId) {
        dialog.alert({ title: 'Validasi', message: 'Semua baris item wajib memilih bahan baku.', variant: 'warning' });
        return;
      }
      if (it.quantityOrdered <= 0) {
        dialog.alert({ title: 'Validasi', message: 'Jumlah kuantitas harus lebih dari 0.', variant: 'warning' });
        return;
      }
    }

    setSubmittingPO(true);
    try {
      const payload: CreatePurchaseOrderInput = {
        outletId: poFormOutletId,
        supplierId: poFormSupplierId,
        expectedDeliveryDate: poFormExpectedDate ? new Date(poFormExpectedDate).toISOString() : undefined,
        notes: poFormNotes.trim() || undefined,
        items: poFormItems.map((it) => ({
          inventoryItemId: it.inventoryItemId,
          quantityOrdered: Number(it.quantityOrdered),
          unitCost: Number(it.unitCost),
          notes: it.notes.trim() || undefined,
        })),
      };

      const res = await api.createPurchaseOrder(payload);
      if (res.status === 'success') {
        dialog.toast('Draf Purchase Order berhasil dibuat', 'success');
        setCreateModalOpen(false);
        fetchOrders();
      } else {
        dialog.alert({ title: 'Gagal', message: res.message || 'Gagal membuat purchase order.', variant: 'danger' });
      }
    } catch (err: any) {
      dialog.alert({ title: 'Kesalahan', message: err?.message || 'Terjadi kesalahan sistem saat membuat PO.', variant: 'danger' });
    } finally {
      setSubmittingPO(false);
    }
  };

  // Action: Issue PO (Kirim ke Pemasok)
  const handleIssuePO = async (po: PurchaseOrder) => {
    const confirmed = await dialog.confirm({
      title: 'Terbitkan Purchase Order',
      message: `Apakah Anda yakin ingin menerbitkan PO #${po.poNumber} ke pemasok ${po.supplier?.name}? Status PO akan berubah menjadi "Diterbitkan" (ISSUED) dan siap untuk penerimaan barang fisik.`,
      confirmText: 'Ya, Terbitkan PO',
      variant: 'info',
    });
    if (!confirmed) return;

    try {
      const res = await api.issuePurchaseOrder(po.id);
      if (res.status === 'success') {
        dialog.toast(`PO #${po.poNumber} berhasil diterbitkan`, 'success');
        fetchOrders();
        if (selectedPO?.id === po.id) {
          setDetailModalOpen(false);
        }
      } else {
        dialog.alert({ title: 'Gagal', message: res.message || 'Gagal menerbitkan purchase order.', variant: 'danger' });
      }
    } catch (err: any) {
      dialog.alert({ title: 'Kesalahan', message: err?.message || 'Terjadi kesalahan sistem.', variant: 'danger' });
    }
  };

  // Open Receive Goods Modal
  const handleOpenReceiveModal = (po: PurchaseOrder) => {
    setReceivingPO(po);
    const itemsData = (po.items || []).map((item) => {
      const ordered = item.quantityOrdered;
      const alreadyReceived = item.quantityReceived;
      const remaining = Math.max(0, ordered - alreadyReceived);
      return {
        purchaseOrderItemId: item.id,
        itemName: item.inventoryItem?.name || 'Bahan Baku',
        uom: item.inventoryItem?.canonicalUom || 'Satuan',
        ordered,
        alreadyReceived,
        remaining,
        quantityReceived: remaining, // default to receiving the remaining balance
        unitCost: item.unitCost,
        batchNumber: '',
        expirationDate: '',
      };
    });
    setReceiveItemsData(itemsData);
    setReceiveModalOpen(true);
  };

  // Submit Goods Receiving
  const handleSubmitReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingPO) return;

    const itemsToSubmit: ReceivePOItemInput[] = [];
    for (const item of receiveItemsData) {
      if (item.quantityReceived > 0) {
        itemsToSubmit.push({
          purchaseOrderItemId: item.purchaseOrderItemId,
          quantityReceived: Number(item.quantityReceived),
          unitCost: Number(item.unitCost),
          batchNumber: item.batchNumber.trim() || undefined,
          expirationDate: item.expirationDate ? new Date(item.expirationDate).toISOString() : undefined,
        });
      }
    }

    if (itemsToSubmit.length === 0) {
      dialog.alert({ title: 'Peringatan', message: 'Minimal harus menerima 1 item dengan kuantitas lebih dari 0.', variant: 'warning' });
      return;
    }

    setSubmittingReceive(true);
    try {
      const res = await api.receivePurchaseOrder(receivingPO.id, { items: itemsToSubmit });
      if (res.status === 'success') {
        dialog.alert({
          title: 'Penerimaan Berhasil',
          message: `Fisik barang PO #${receivingPO.poNumber} berhasil diterima! Stok persediaan di outlet telah diperbarui dan Harga Pokok Rata-Rata (Moving Average Cost) telah dihitung ulang secara otomatis.`,
          variant: 'success',
        });
        setReceiveModalOpen(false);
        setDetailModalOpen(false);
        fetchOrders();
      } else {
        dialog.alert({ title: 'Gagal', message: res.message || 'Gagal memproses penerimaan barang.', variant: 'danger' });
      }
    } catch (err: any) {
      dialog.alert({ title: 'Kesalahan', message: err?.message || 'Terjadi kesalahan saat memproses penerimaan.', variant: 'danger' });
    } finally {
      setSubmittingReceive(false);
    }
  };

  // Action: Cancel PO
  const handleConfirmCancelPO = async () => {
    if (!cancellingPO) return;
    setSubmittingCancel(true);
    try {
      const res = await api.cancelPurchaseOrder(cancellingPO.id);
      if (res.status === 'success') {
        dialog.toast(`PO #${cancellingPO.poNumber} berhasil dibatalkan`, 'info');
        setCancelModalOpen(false);
        setDetailModalOpen(false);
        fetchOrders();
      } else {
        dialog.alert({ title: 'Gagal', message: res.message || 'Gagal membatalkan purchase order.', variant: 'danger' });
      }
    } catch (err: any) {
      dialog.alert({ title: 'Kesalahan', message: err?.message || 'Terjadi kesalahan sistem.', variant: 'danger' });
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Calculate Subtotal for PO Form
  const poFormTotal = useMemo(() => {
    return poFormItems.reduce((acc, it) => acc + (it.quantityOrdered || 0) * (it.unitCost || 0), 0);
  }, [poFormItems]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-900 border border-blue-100">
              <FileText className="w-5 h-5 text-blue-900" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">Pengadaan Barang (PO)</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
            Kelola pesanan pembelian bahan baku ke pemasok, cetak/kirim PO, dan verifikasi penerimaan fisik barang dengan perhitungan Moving Average Cost (MAC) otomatis.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchOrders}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
            title="Muat ulang data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-900' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-850 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-950/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Buat PO Baru</span>
          </button>
        </div>
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-2xl bg-white border cursor-pointer transition-all ${
            statusFilter === 'ALL'
              ? 'border-blue-900 ring-2 ring-blue-900/10 shadow-xs'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total PO</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{kpiStats.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">Semua status</div>
        </div>

        <div
          onClick={() => setStatusFilter('DRAFT')}
          className={`p-4 rounded-2xl bg-white border cursor-pointer transition-all ${
            statusFilter === 'DRAFT'
              ? 'border-slate-900 ring-2 ring-slate-900/10 shadow-xs'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-semibold">Draf PO</span>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-800 mt-2">{kpiStats.drafts}</div>
          <div className="text-[11px] text-slate-500 mt-1">Belum dikirim</div>
        </div>

        <div
          onClick={() => setStatusFilter('ISSUED')}
          className={`p-4 rounded-2xl bg-white border cursor-pointer transition-all ${
            statusFilter === 'ISSUED'
              ? 'border-blue-900 ring-2 ring-blue-900/10 shadow-xs'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-blue-900">
            <span className="text-xs font-semibold">Menunggu Kirim</span>
            <Truck className="w-4 h-4 text-blue-800" />
          </div>
          <div className="text-2xl font-black text-blue-900 mt-2">{kpiStats.issued}</div>
          <div className="text-[11px] text-blue-850/80 mt-1">Dalam proses / jalan</div>
        </div>

        <div
          onClick={() => setStatusFilter('RECEIVED')}
          className={`p-4 rounded-2xl bg-white border cursor-pointer transition-all ${
            statusFilter === 'RECEIVED'
              ? 'border-emerald-600 ring-2 ring-emerald-600/10 shadow-xs'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-semibold">Selesai Diterima</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">{kpiStats.received}</div>
          <div className="text-[11px] text-emerald-600 mt-1">Stok telah masuk</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Nilai PO</span>
            <Boxes className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-2 truncate">
            {formatRupiah(kpiStats.totalAmount)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Estimasi belanja</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nomor PO, nama pemasok, atau outlet..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900"
          >
            <option value="ALL">Semua Status</option>
            <option value="DRAFT">Draf</option>
            <option value="ISSUED">Diterbitkan</option>
            <option value="PARTIALLY_RECEIVED">Diterima Sebagian</option>
            <option value="RECEIVED">Selesai</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>

          {/* Supplier filter */}
          <select
            value={supplierFilter}
            onChange={(e) => {
              setSupplierFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 max-w-[180px] truncate"
          >
            <option value="ALL">Semua Pemasok</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Outlet filter */}
          <select
            value={outletFilter}
            onChange={(e) => {
              setOutletFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 max-w-[180px] truncate"
          >
            <option value="ALL">Semua Cabang / Gudang</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} {o.isWarehouse ? '(Gudang)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Purchase Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">No. PO &amp; Tanggal</th>
                <th className="py-3.5 px-4">Pemasok</th>
                <th className="py-3.5 px-4">Outlet Tujuan</th>
                <th className="py-3.5 px-4 text-center">Bahan Baku</th>
                <th className="py-3.5 px-4 text-right">Total Nilai</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-900 mb-2" />
                    Memuat data purchase orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    Belum ada data purchase order yang sesuai kriteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((po) => {
                  const itemCount = po.items?.length || po._count?.items || 0;
                  const dateStr = new Date(po.orderDate || po.createdAt).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  });

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-blue-950">{po.poNumber}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{dateStr}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{po.supplier?.name || '-'}</div>
                        <div className="text-[11px] text-slate-400">{po.supplier?.code || ''}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{po.outlet?.name || '-'}</div>
                        {po.expectedDeliveryDate && (
                          <div className="text-[11px] text-blue-800 font-semibold flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            Estimasi:{' '}
                            {new Date(po.expectedDeliveryDate).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                          {itemCount} Bahan
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-extrabold text-slate-900">
                          {formatRupiah(po.totalAmount || 0)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">{renderStatusBadge(po.status)}</td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPO(po);
                              setDetailModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                            title="Lihat Detail PO"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {po.status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => handleIssuePO(po)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-850 text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                              title="Terbitkan ke Pemasok"
                            >
                              <Send className="w-3 h-3" />
                              <span>Kirim</span>
                            </button>
                          )}

                          {(po.status === 'ISSUED' || po.status === 'PARTIALLY_RECEIVED') && (
                            <button
                              type="button"
                              onClick={() => handleOpenReceiveModal(po)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                              title="Penerimaan Fisik Barang"
                            >
                              <Package className="w-3 h-3" />
                              <span>Terima</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Canonical Pagination */}
        <TablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalCount}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: BUAT PURCHASE ORDER (PO) BARU */}
      {/* ========================================================================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-900 rounded-2xl border border-blue-100">
                  <FileText className="w-5 h-5 text-blue-900" />
                </div>
                <div>
                  <h3 className="font-extrabold text-blue-950 text-base">Buat Purchase Order (PO)</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Pesan persediaan bahan baku baru kepada pemasok resmi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchaseOrder} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Header Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Outlet / Gudang Tujuan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={poFormOutletId}
                    onChange={(e) => setPoFormOutletId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900"
                  >
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} {o.isWarehouse ? '(Gudang)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Pemasok (Supplier) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={poFormSupplierId}
                    onChange={(e) => setPoFormSupplierId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900"
                  >
                    <option value="">-- Pilih Pemasok --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Perkiraan Tiba (Opsional)
                  </label>
                  <input
                    type="date"
                    value={poFormExpectedDate}
                    onChange={(e) => setPoFormExpectedDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Catatan PO</label>
                <input
                  type="text"
                  value={poFormNotes}
                  onChange={(e) => setPoFormNotes(e.target.value)}
                  placeholder="Misal: Harap kirim sebelum jam 11 siang..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900"
                />
              </div>

              {/* Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-900" />
                    <span>Daftar Bahan Baku yang Dipesan</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItemToPO}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Item</span>
                  </button>
                </div>

                {poFormItems.length === 0 ? (
                  <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-400 text-xs">
                    Belum ada bahan baku yang ditambahkan. Klik &quot;Tambah Item&quot; untuk memilih bahan.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {poFormItems.map((item, idx) => {
                      const selectedItem = inventoryItems.find((it) => it.id === item.inventoryItemId);
                      const subtotal = (item.quantityOrdered || 0) * (item.unitCost || 0);

                      return (
                        <div
                          key={idx}
                          className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-2xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                        >
                          <div className="sm:col-span-5">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Bahan Baku
                            </label>
                            <select
                              value={item.inventoryItemId}
                              onChange={(e) => handleUpdateItemField(idx, 'inventoryItemId', e.target.value)}
                              className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                            >
                              {inventoryItems.map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.name} ({it.canonicalUom})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Kuantitas ({selectedItem?.canonicalUom || 'Satuan'})
                            </label>
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={item.quantityOrdered}
                              onChange={(e) =>
                                handleUpdateItemField(idx, 'quantityOrdered', parseFloat(e.target.value) || 0)
                              }
                              className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 text-right"
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Harga Satuan Beli
                            </label>
                            <CurrencyInput
                              value={item.unitCost}
                              onChange={(val) => handleUpdateItemField(idx, 'unitCost', val)}
                              className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 text-right"
                            />
                          </div>

                          <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0">
                            <div className="text-right">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase">
                                Subtotal
                              </span>
                              <span className="font-extrabold text-blue-950 text-xs">
                                {formatRupiah(subtotal)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveItemFromPO(idx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Hapus baris item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Total Calculation Bar */}
              <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-blue-900 block">Total Estimasi Nilai PO</span>
                  <span className="text-[11px] text-blue-700">
                    {poFormItems.length} macam bahan baku
                  </span>
                </div>
                <div className="text-xl font-black text-blue-950">{formatRupiah(poFormTotal)}</div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingPO}
                  className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-850 text-white font-extrabold text-xs shadow-md shadow-blue-950/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  {submittingPO ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Draf PO</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DETAIL PURCHASE ORDER */}
      {/* ========================================================================= */}
      {detailModalOpen && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-900 rounded-2xl border border-blue-100">
                  <FileText className="w-5 h-5 text-blue-900" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-blue-950 text-base">
                      Detail PO #{selectedPO.poNumber}
                    </h3>
                    {renderStatusBadge(selectedPO.status)}
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Dibuat pada{' '}
                    {new Date(selectedPO.orderDate || selectedPO.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 font-medium block">Pemasok:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedPO.supplier?.name}
                  </span>
                  <span className="text-slate-500 block text-[11px]">
                    {selectedPO.supplier?.phone || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Outlet Tujuan:</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedPO.outlet?.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Perkiraan Tiba:</span>
                  <span className="font-bold text-slate-900">
                    {selectedPO.expectedDeliveryDate
                      ? new Date(selectedPO.expectedDeliveryDate).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'Belum ditentukan'}
                  </span>
                </div>
              </div>

              {selectedPO.notes && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900">
                  <span className="font-bold">Catatan:</span> {selectedPO.notes}
                </div>
              )}

              {/* Items List Table */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-slate-900 text-sm">Rincian Item Bahan Baku</h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-extrabold text-slate-500 uppercase border-b border-slate-200">
                        <th className="py-2.5 px-3">Bahan Baku</th>
                        <th className="py-2.5 px-3 text-right">Dipesan</th>
                        <th className="py-2.5 px-3 text-right">Diterima</th>
                        <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedPO.items?.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-900 block">
                              {item.inventoryItem?.name || 'Bahan Baku'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {item.inventoryItem?.itemCode || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-800">
                            {item.quantityOrdered} {item.inventoryItem?.canonicalUom || ''}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span
                              className={`font-bold ${
                                item.quantityReceived >= item.quantityOrdered
                                  ? 'text-emerald-600'
                                  : item.quantityReceived > 0
                                  ? 'text-amber-600'
                                  : 'text-slate-400'
                              }`}
                            >
                              {item.quantityReceived} {item.inventoryItem?.canonicalUom || ''}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right text-slate-600">
                            {formatRupiah(item.unitCost)}
                          </td>
                          <td className="py-3 px-3 text-right font-extrabold text-slate-900">
                            {formatRupiah(item.subtotal || item.quantityOrdered * item.unitCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50/80 font-black text-sm text-slate-900 border-t border-slate-200">
                        <td colSpan={4} className="py-3 px-3 text-right">
                          Total Nilai PO:
                        </td>
                        <td className="py-3 px-3 text-right text-blue-950">
                          {formatRupiah(selectedPO.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div>
                {selectedPO.status !== 'CANCELLED' && selectedPO.status !== 'RECEIVED' && (
                  <button
                    type="button"
                    onClick={() => {
                      setCancellingPO(selectedPO);
                      setCancelModalOpen(true);
                    }}
                    className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Batalkan PO
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedPO.status === 'DRAFT' && (
                  <button
                    type="button"
                    onClick={() => handleIssuePO(selectedPO)}
                    className="px-4 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-850 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Terbitkan ke Pemasok</span>
                  </button>
                )}

                {(selectedPO.status === 'ISSUED' || selectedPO.status === 'PARTIALLY_RECEIVED') && (
                  <button
                    type="button"
                    onClick={() => handleOpenReceiveModal(selectedPO)}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Package className="w-4 h-4" />
                    <span>Terima Fisik Barang</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PENERIMAAN FISIK BARANG (GOODS RECEIVING) */}
      {/* ========================================================================= */}
      {receiveModalOpen && receivingPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200">
                  <Package className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-blue-950 text-base">
                    Penerimaan Barang Fisik PO #{receivingPO.poNumber}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Verifikasi fisik barang yang tiba, input nomor batch dan tanggal kadaluarsa
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReceiveModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReceive} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Alert Notice regarding MAC */}
              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold block">Pembaruan Nilai Persediaan Otomatis:</span>
                  Kuantitas yang Anda terima di sini akan langsung menambah stok persediaan di{' '}
                  <span className="font-bold underline">{receivingPO.outlet?.name}</span> dan
                  memperbarui Harga Pokok Rata-Rata (Moving Average Cost) berdasarkan harga beli aktual.
                </div>
              </div>

              {/* Receiving Items Table */}
              <div className="space-y-3">
                {receiveItemsData.map((item, idx) => (
                  <div
                    key={item.purchaseOrderItemId}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                      <div>
                        <span className="font-extrabold text-slate-900 text-sm">{item.itemName}</span>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Total Dipesan: <span className="font-bold text-slate-800">{item.ordered} {item.uom}</span>{' '}
                          | Sudah Masuk: <span className="font-bold text-emerald-700">{item.alreadyReceived} {item.uom}</span>{' '}
                          | Sisa Belum Tiba:{' '}
                          <span className="font-bold text-amber-700">{item.remaining} {item.uom}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Qty Diterima Saat Ini ({item.uom}) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.quantityReceived}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setReceiveItemsData((prev) => {
                              const next = [...prev];
                              next[idx].quantityReceived = val;
                              return next;
                            });
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 text-right focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Harga Satuan Aktual (HPP)
                        </label>
                        <CurrencyInput
                          value={item.unitCost}
                          onChange={(val) => {
                            setReceiveItemsData((prev) => {
                              const next = [...prev];
                              next[idx].unitCost = val;
                              return next;
                            });
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 text-right"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Nomor Batch / Lot
                        </label>
                        <input
                          type="text"
                          value={item.batchNumber}
                          placeholder="Misal: LOT-2026-001"
                          onChange={(e) => {
                            const val = e.target.value;
                            setReceiveItemsData((prev) => {
                              const next = [...prev];
                              next[idx].batchNumber = val;
                              return next;
                            });
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Tanggal Kadaluarsa (Expired)
                        </label>
                        <input
                          type="date"
                          value={item.expirationDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReceiveItemsData((prev) => {
                              const next = [...prev];
                              next[idx].expirationDate = val;
                              return next;
                            });
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReceiveModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingReceive}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  {submittingReceive ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan Penerimaan...</span>
                    </>
                  ) : (
                    <span>Konfirmasi Terima Barang</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Cancel PO */}
      <ConfirmModal
        isOpen={cancelModalOpen}
        title="Batalkan Purchase Order"
        message={`Apakah Anda yakin ingin membatalkan PO #${cancellingPO?.poNumber}? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Ya, Batalkan PO"
        cancelText="Kembali"
        variant="danger"
        loading={submittingCancel}
        onConfirm={handleConfirmCancelPO}
        onClose={() => setCancelModalOpen(false)}
      />
    </div>
  );
};
