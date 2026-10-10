import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeftRight,
  Plus,
  Search,
  RefreshCw,
  Truck,
  CheckCircle2,
  Clock,
  X,
  Package,
  Eye,
  Send,
  Trash2,
  Warehouse,
  Store,
  ChevronDown,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  StockTransfer,
  StockTransferStatus,
  CreateStockTransferInput,
} from '../types/purchasing';
import type { Outlet } from '../types/outlet';
import type { RecipeInventoryItem } from '../types/recipe';
import { TablePagination } from '../components/TablePagination';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState, TableSkeleton } from '../components/ui';
import { useDialog } from '../context/DialogContext';

interface StockTransfersViewProps {
  activeOutlet?: Outlet | null;
}

export const StockTransfersView: React.FC<StockTransfersViewProps> = ({ activeOutlet }) => {
  const dialog = useDialog();

  // Data states
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'OUTBOUND' | 'INBOUND'>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Modal: Create Transfer
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [submittingCreate, setSubmittingCreate] = useState<boolean>(false);
  const [sourceOutletId, setSourceOutletId] = useState<string>(activeOutlet?.id || '');
  const [targetOutletId, setTargetOutletId] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [sourceItems, setSourceItems] = useState<RecipeInventoryItem[]>([]);
  const [loadingSourceItems, setLoadingSourceItems] = useState<boolean>(false);
  const [transferItems, setTransferItems] = useState<
    Array<{
      inventoryItemId: string;
      quantityDispatched: number;
    }>
  >([]);

  // Modal: View Detail Transfer
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);

  // Confirm Dispatch / Receive Modal
  const [dispatchModalOpen, setDispatchModalOpen] = useState<boolean>(false);
  const [dispatchingTransfer, setDispatchingTransfer] = useState<StockTransfer | null>(null);
  const [submittingDispatch, setSubmittingDispatch] = useState<boolean>(false);

  const [receiveModalOpen, setReceiveModalOpen] = useState<boolean>(false);
  const [receivingTransfer, setReceivingTransfer] = useState<StockTransfer | null>(null);
  const [submittingReceive, setSubmittingReceive] = useState<boolean>(false);

  // 1. Fetch Outlets
  useEffect(() => {
    const fetchOutlets = async () => {
      try {
        const res = await api.getOutlets();
        if (res.status === 'success' && res.data) {
          setOutlets(res.data);
          const initialSource = activeOutlet?.id || res.data[0]?.id || '';
          setSourceOutletId(initialSource);
          const other = res.data.find((o) => o.id !== initialSource);
          setTargetOutletId(other?.id || '');
        }
      } catch (err) {
        console.error('Gagal mengambil daftar outlet:', err);
      }
    };
    fetchOutlets();
  }, [activeOutlet?.id]);

  // 2. Fetch Transfers List
  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      let srcParam: string | undefined;
      let tgtParam: string | undefined;

      if (directionFilter === 'OUTBOUND' && activeOutlet?.id) {
        srcParam = activeOutlet.id;
      } else if (directionFilter === 'INBOUND' && activeOutlet?.id) {
        tgtParam = activeOutlet.id;
      }

      const res = await api.getStockTransfers({
        sourceOutletId: srcParam,
        targetOutletId: tgtParam,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page: currentPage,
        limit: pageSize,
      });

      if (res.status === 'success' && res.data) {
        setTransfers(res.data);
        if (res.pagination) {
          setTotalCount(res.pagination.total);
        } else {
          setTotalCount(res.data.length);
        }
      }
    } catch (err) {
      console.error('Gagal mengambil transfer stok:', err);
    } finally {
      setLoading(false);
    }
  }, [directionFilter, activeOutlet?.id, statusFilter, currentPage, pageSize]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  // 3. Load items of source outlet when modal open or source outlet changed
  useEffect(() => {
    if (!createModalOpen || !sourceOutletId) return;

    const loadSourceItems = async () => {
      setLoadingSourceItems(true);
      try {
        const res = await api.getRecipeInventoryItems(sourceOutletId, 'all');
        if (res.status === 'success' && res.data) {
          setSourceItems(res.data);
        }
      } catch (err) {
        console.error('Gagal mengambil stok lokasi asal:', err);
      } finally {
        setLoadingSourceItems(false);
      }
    };
    loadSourceItems();
  }, [createModalOpen, sourceOutletId]);

  // Client search filter
  const filteredTransfers = useMemo(() => {
    if (!searchQuery.trim()) return transfers;
    const q = searchQuery.toLowerCase();
    return transfers.filter(
      (t) =>
        t.transferNumber.toLowerCase().includes(q) ||
        t.sourceOutlet?.name.toLowerCase().includes(q) ||
        t.targetOutlet?.name.toLowerCase().includes(q)
    );
  }, [transfers, searchQuery]);

  // KPI Stats
  const kpiStats = useMemo(() => {
    const total = transfers.length;
    const inTransit = transfers.filter((t) => t.status === 'IN_TRANSIT').length;
    const received = transfers.filter((t) => t.status === 'RECEIVED').length;
    const drafts = transfers.filter((t) => t.status === 'DRAFT').length;

    return { total, inTransit, received, drafts };
  }, [transfers]);

  // Status Badge Helper
  const renderStatusBadge = (status: StockTransferStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Draf
          </span>
        );
      case 'IN_TRANSIT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200 animate-pulse">
            <Truck className="w-3.5 h-3.5 text-blue-800" />
            Dalam Perjalanan
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

  // Open Create Transfer Modal
  const handleOpenCreateModal = () => {
    const initialSource = activeOutlet?.id || outlets[0]?.id || '';
    setSourceOutletId(initialSource);
    const other = outlets.find((o) => o.id !== initialSource);
    setTargetOutletId(other?.id || '');
    setTransferNotes('');
    setTransferItems([]);
    setCreateModalOpen(true);
  };

  // Add Item in Create Transfer Form
  const handleAddItem = () => {
    if (sourceItems.length === 0) {
      dialog.alert({ title: 'Peringatan', message: 'Tidak ada data bahan baku pada lokasi asal.', variant: 'warning' });
      return;
    }
    const firstItem = sourceItems[0];
    setTransferItems((prev) => [
      ...prev,
      {
        inventoryItemId: firstItem.id,
        quantityDispatched: 1,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setTransferItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    setTransferItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Submit Create Stock Transfer
  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceOutletId || !targetOutletId) {
      dialog.alert({ title: 'Validasi', message: 'Silakan pilih lokasi asal dan lokasi tujuan.', variant: 'warning' });
      return;
    }
    if (sourceOutletId === targetOutletId) {
      dialog.alert({ title: 'Validasi', message: 'Lokasi asal dan lokasi tujuan tidak boleh sama.', variant: 'warning' });
      return;
    }
    if (transferItems.length === 0) {
      dialog.alert({ title: 'Validasi', message: 'Minimal harus memilih 1 bahan baku yang akan ditransfer.', variant: 'warning' });
      return;
    }

    for (const it of transferItems) {
      const raw = sourceItems.find((s) => s.id === it.inventoryItemId);
      const avail = raw?.stock ?? raw?.warehouseStock ?? 0;
      if (it.quantityDispatched <= 0) {
        dialog.alert({ title: 'Validasi', message: 'Kuantitas transfer harus lebih dari 0.', variant: 'warning' });
        return;
      }
      if (it.quantityDispatched > avail) {
        dialog.alert({
          title: 'Stok Tidak Cukup',
          message: `Stok bahan "${raw?.name || 'Bahan'}" di lokasi asal tidak mencukupi (Tersedia: ${avail} ${raw?.canonicalUom || ''}).`,
          variant: 'warning',
        });
        return;
      }
    }

    setSubmittingCreate(true);
    try {
      const payload: CreateStockTransferInput = {
        sourceOutletId,
        targetOutletId,
        notes: transferNotes.trim() || undefined,
        items: transferItems.map((it) => ({
          inventoryItemId: it.inventoryItemId,
          quantityDispatched: Number(it.quantityDispatched),
        })),
      };

      const res = await api.createStockTransfer(payload);
      if (res.status === 'success') {
        dialog.toast('Draf transfer persediaan antar toko berhasil dibuat', 'success');
        setCreateModalOpen(false);
        fetchTransfers();
      } else {
        dialog.alert({ title: 'Gagal', message: res.message || 'Gagal membuat transfer persediaan.', variant: 'danger' });
      }
    } catch (err: any) {
      dialog.alert({ title: 'Kesalahan', message: err?.message || 'Terjadi kesalahan sistem.', variant: 'danger' });
    } finally {
      setSubmittingCreate(false);
    }
  };

  // Confirm Dispatch Transfer (Kirim ke Ekspedisi / Driver)
  const handleConfirmDispatch = async () => {
    if (!dispatchingTransfer) return;
    setSubmittingDispatch(true);
    try {
      const res = await api.dispatchStockTransfer(dispatchingTransfer.id);
      if (res.status === 'success') {
        dialog.toast(`Transfer #${dispatchingTransfer.transferNumber} berhasil dikirim!`, 'success');
        dialog.alert({
          title: 'Pengiriman Berhasil',
          message: `Transfer #${dispatchingTransfer.transferNumber} telah dikirim! Stok di lokasi asal telah terpotong dan kini berstatus Dalam Perjalanan (In-Transit).`,
          variant: 'success',
        });
        setDispatchModalOpen(false);
        setDetailModalOpen(false);
        fetchTransfers();
      } else {
        dialog.alert({ title: 'Gagal', message: res.message || 'Gagal memproses pengiriman transfer.', variant: 'danger' });
      }
    } catch (err: any) {
      dialog.alert({ title: 'Kesalahan', message: err?.message || 'Terjadi kesalahan sistem.', variant: 'danger' });
    } finally {
      setSubmittingDispatch(false);
    }
  };

  // Confirm Receive Transfer (Terima Barang di Toko Tujuan)
  const handleConfirmReceive = async () => {
    if (!receivingTransfer) return;
    setSubmittingReceive(true);
    try {
      const res = await api.receiveStockTransfer(receivingTransfer.id);
      if (res.status === 'success') {
        dialog.toast(`Transfer #${receivingTransfer.transferNumber} berhasil diterima di ${receivingTransfer.targetOutlet?.name}!`, 'success');
        dialog.alert({
          title: 'Penerimaan Berhasil',
          message: `Transfer #${receivingTransfer.transferNumber} berhasil diterima! Stok persediaan telah otomatis ditambahkan ke toko tujuan (${receivingTransfer.targetOutlet?.name}).`,
          variant: 'success',
        });
        setReceiveModalOpen(false);
        setDetailModalOpen(false);
        fetchTransfers();
      } else {
        dialog.alert({ title: 'Gagal', message: res.message || 'Gagal memproses penerimaan transfer.', variant: 'danger' });
      }
    } catch (err: any) {
      dialog.alert({ title: 'Kesalahan', message: err?.message || 'Terjadi kesalahan sistem.', variant: 'danger' });
    } finally {
      setSubmittingReceive(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-900 border border-blue-100">
              <ArrowLeftRight className="w-5 h-5 text-blue-900" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">Transfer Antar Toko &amp; Gudang</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
            Pantau pengiriman persediaan antar toko dan gudang, alokasi stok dalam perjalanan (In-Transit), dan verifikasi penerimaan di toko tujuan.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="h-10 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-950/20 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Buat Transfer Baru</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-2xl bg-white border cursor-pointer transition-all ${
            statusFilter === 'ALL'
              ? 'border-blue-900 ring-2 ring-blue-900/10 shadow-xs'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Transfer</span>
            <ArrowLeftRight className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 mt-2">{kpiStats.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">Semua alokasi stok</div>
        </div>

        <div
          onClick={() => setStatusFilter('IN_TRANSIT')}
          className={`p-4 rounded-2xl bg-white border cursor-pointer transition-all ${
            statusFilter === 'IN_TRANSIT'
              ? 'border-blue-900 ring-2 ring-blue-900/10 shadow-xs'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-blue-900">
            <span className="text-xs font-semibold">Dalam Perjalanan</span>
            <Truck className="w-4 h-4 text-blue-800" />
          </div>
          <div className="text-2xl font-black font-mono text-blue-900 mt-2">{kpiStats.inTransit}</div>
          <div className="text-[11px] text-blue-700 mt-1">Menunggu konfirmasi terima</div>
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
          <div className="text-2xl font-black font-mono text-emerald-700 mt-2">{kpiStats.received}</div>
          <div className="text-[11px] text-emerald-600 mt-1">Stok masuk ke tujuan</div>
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
            <span className="text-xs font-semibold">Draf Siap Kirim</span>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-800 mt-2">{kpiStats.drafts}</div>
          <div className="text-[11px] text-slate-500 mt-1">Belum di-dispatch</div>
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
            placeholder="Cari nomor transfer, nama toko asal atau tujuan..."
            className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 transition-all font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Direction Filter */}
          <div className="relative">
            <select
              value={directionFilter}
              onChange={(e) => {
                setDirectionFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="h-10 pl-3.5 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer appearance-none"
            >
              <option value="ALL">Semua Arah Transfer</option>
              <option value="OUTBOUND">Terkirim (Keluar dari sini)</option>
              <option value="INBOUND">Barang Masuk (Menuju sini)</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 pl-3.5 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer appearance-none"
            >
              <option value="ALL">Semua Status</option>
              <option value="DRAFT">Draf</option>
              <option value="IN_TRANSIT">Dalam Perjalanan</option>
              <option value="RECEIVED">Selesai Diterima</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Stock Transfers Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1050px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 min-w-[190px] whitespace-nowrap">No. Transfer &amp; Tanggal</th>
                <th className="py-3.5 px-4 min-w-[200px] whitespace-nowrap">Toko / Gudang Asal</th>
                <th className="py-3.5 px-4 min-w-[200px] whitespace-nowrap">Toko / Gudang Tujuan</th>
                <th className="py-3.5 px-4 min-w-[120px] text-center whitespace-nowrap">Bahan Baku</th>
                <th className="py-3.5 px-4 min-w-[140px] text-center whitespace-nowrap">Status</th>
                <th className="py-3.5 px-4 pr-6 min-w-[150px] text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <TableSkeleton rows={5} columns={6} actionCol />
              ) : filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    <EmptyState
                      icon={<ArrowLeftRight className="w-7 h-7 text-blue-900" />}
                      title={transfers.length === 0 ? 'Belum Ada Transfer Stok' : 'Tidak Ada Transfer yang Cocok'}
                      description={
                        transfers.length === 0
                          ? 'Gunakan fitur transfer stok untuk memindahkan bahan baku atau produk antar outlet toko dan gudang pusat.'
                          : 'Tidak ada riwayat transfer yang cocok dengan filter atau kata kunci pencarian.'
                      }
                      actionLabel={transfers.length === 0 ? '+ Buat Transfer Stok' : undefined}
                      onAction={transfers.length === 0 ? handleOpenCreateModal : undefined}
                    />
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((trf) => {
                  const itemCount = trf.items?.length || trf._count?.items || 0;
                  const dateStr = new Date(trf.createdAt).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  });

                  return (
                    <tr key={trf.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-extrabold text-blue-950 font-mono text-xs">{trf.transferNumber}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{dateStr}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                          <Store className="w-3.5 h-3.5 text-slate-400" />
                          <span>{trf.sourceOutlet?.name || '-'}</span>
                        </div>
                        {trf.dispatchedAt && (
                          <div className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">
                            Dikirim:{' '}
                            {new Date(trf.dispatchedAt).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                          <Warehouse className="w-3.5 h-3.5 text-blue-900" />
                          <span>{trf.targetOutlet?.name || '-'}</span>
                        </div>
                        {trf.receivedAt && (
                          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5 whitespace-nowrap">
                            Tiba:{' '}
                            {new Date(trf.receivedAt).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px] whitespace-nowrap">
                          {itemCount} Bahan
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">{renderStatusBadge(trf.status)}</td>
                      <td className="py-3.5 px-4 pr-6 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTransfer(trf);
                              setDetailModalOpen(true);
                            }}
                            className="w-8 h-8 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
                            title="Lihat Rincian Item"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {trf.status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => {
                                setDispatchingTransfer(trf);
                                setDispatchModalOpen(true);
                              }}
                              className="h-8 px-3 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                              title="Kirim Transfer (Potong Stok Asal)"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Kirim</span>
                            </button>
                          )}

                          {trf.status === 'IN_TRANSIT' && (
                            <button
                              type="button"
                              onClick={() => {
                                setReceivingTransfer(trf);
                                setReceiveModalOpen(true);
                              }}
                              className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                              title="Konfirmasi Terima Barang di Tujuan"
                            >
                              <Package className="w-3.5 h-3.5" />
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
      {/* MODAL 1: BUAT TRANSFER STOK BARU */}
      {/* ========================================================================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-900 rounded-2xl border border-blue-100">
                  <ArrowLeftRight className="w-5 h-5 text-blue-900" />
                </div>
                <div>
                  <h3 className="font-extrabold text-blue-950 text-base">Buat Transfer Antar Toko</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Alokasikan stok persediaan dari gudang/toko asal ke toko tujuan
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

            <form onSubmit={handleSubmitTransfer} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Location Selector Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Lokasi Asal Pengiriman <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={sourceOutletId}
                      onChange={(e) => setSourceOutletId(e.target.value)}
                      required
                      className="w-full h-10 pl-3.5 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 appearance-none cursor-pointer"
                    >
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} {o.isWarehouse ? '(Gudang)' : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Lokasi Tujuan Penerimaan <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={targetOutletId}
                      onChange={(e) => setTargetOutletId(e.target.value)}
                      required
                      className="w-full h-10 pl-3.5 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 appearance-none cursor-pointer"
                    >
                      {outlets
                        .filter((o) => o.id !== sourceOutletId)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name} {o.isWarehouse ? '(Gudang)' : ''}
                          </option>
                        ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Catatan Transfer</label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="Misal: Permintaan restock mingguan bahan espresso..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900"
                />
              </div>

              {/* Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-900" />
                    <span>Daftar Bahan yang Ditransfer</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    disabled={loadingSourceItems}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Item</span>
                  </button>
                </div>

                {loadingSourceItems ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-900 mb-2" />
                    Memuat daftar bahan baku lokasi asal...
                  </div>
                ) : transferItems.length === 0 ? (
                  <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-400 text-xs">
                    Belum ada bahan yang dipilih. Klik &quot;Tambah Item&quot; untuk memilih bahan yang akan dikirim.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {transferItems.map((item, idx) => {
                      const selectedItem = sourceItems.find((it) => it.id === item.inventoryItemId);
                      const availStock = selectedItem?.stock ?? selectedItem?.warehouseStock ?? 0;

                      return (
                        <div
                          key={idx}
                          className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-2xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                        >
                          <div className="sm:col-span-7">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Pilih Bahan Baku
                            </label>
                            <div className="relative">
                              <select
                                value={item.inventoryItemId}
                                onChange={(e) => handleUpdateItem(idx, 'inventoryItemId', e.target.value)}
                                className="w-full h-10 pl-2.5 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 appearance-none cursor-pointer"
                              >
                                {sourceItems.map((it) => (
                                  <option key={it.id} value={it.id}>
                                    {it.name} (Tersedia: {it.stock ?? it.warehouseStock ?? 0} {it.canonicalUom})
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          </div>

                          <div className="sm:col-span-3">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Qty Dikirim ({selectedItem?.canonicalUom || 'Satuan'})
                            </label>
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              max={availStock}
                              value={item.quantityDispatched}
                              onChange={(e) =>
                                handleUpdateItem(idx, 'quantityDispatched', parseFloat(e.target.value) || 0)
                              }
                              className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 text-right"
                            />
                          </div>

                          <div className="sm:col-span-2 flex items-center justify-end pt-2 sm:pt-4">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="w-8 h-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
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

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="h-10 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className="h-10 px-5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-md shadow-blue-950/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  {submittingCreate ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Draf Transfer</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: RINCIAN DETAIL TRANSFER */}
      {/* ========================================================================= */}
      {detailModalOpen && selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-900 rounded-2xl border border-blue-100">
                  <ArrowLeftRight className="w-5 h-5 text-blue-900" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-blue-950 text-base">
                      Detail Transfer #{selectedTransfer.transferNumber}
                    </h3>
                    {renderStatusBadge(selectedTransfer.status)}
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Dibuat pada{' '}
                    {new Date(selectedTransfer.createdAt).toLocaleDateString('id-ID', {
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
              {/* Route Card */}
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">
                    Toko / Outlet Asal (Pengirim)
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedTransfer.sourceOutlet?.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-blue-900 font-bold">
                  <span className="text-xs">Dikirim</span>
                  <Truck className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">
                    Toko / Outlet Tujuan (Penerima)
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedTransfer.targetOutlet?.name}
                  </span>
                </div>
              </div>

              {selectedTransfer.notes && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900">
                  <span className="font-bold">Catatan:</span> {selectedTransfer.notes}
                </div>
              )}

              {/* Items List */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-slate-900 text-sm">Bahan Baku yang Ditransfer</h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-extrabold text-slate-500 uppercase border-b border-slate-200">
                        <th className="py-2.5 px-3">Bahan Baku</th>
                        <th className="py-2.5 px-3 text-right">Qty Dikirim</th>
                        <th className="py-2.5 px-3 text-right">Qty Diterima</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedTransfer.items?.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-900 block">
                              {item.inventoryItem?.name || 'Bahan Baku'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {item.inventoryItem?.itemCode || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-800 font-mono">
                            {item.quantityDispatched} {item.inventoryItem?.canonicalUom || ''}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            <span
                              className={`font-bold ${
                                item.quantityReceived >= item.quantityDispatched
                                    ? 'text-emerald-600'
                                  : 'text-slate-400'
                              }`}
                            >
                              {item.quantityReceived} {item.inventoryItem?.canonicalUom || ''}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              {selectedTransfer.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={() => {
                    setDispatchingTransfer(selectedTransfer);
                    setDispatchModalOpen(true);
                  }}
                  className="h-10 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Kirim Sekarang (Dispatch)</span>
                </button>
              )}

              {selectedTransfer.status === 'IN_TRANSIT' && (
                <button
                  type="button"
                  onClick={() => {
                    setReceivingTransfer(selectedTransfer);
                    setReceiveModalOpen(true);
                  }}
                  className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Package className="w-4 h-4" />
                  <span>Terima Barang di Tujuan</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dispatch Modal */}
      <ConfirmModal
        isOpen={dispatchModalOpen}
        title="Kirim Transfer Persediaan"
        message={`Kirim transfer #${dispatchingTransfer?.transferNumber} sekarang? Stok fisik di lokasi asal (${dispatchingTransfer?.sourceOutlet?.name}) akan langsung dipotong dan status berubah menjadi Dalam Perjalanan.`}
        confirmText="Ya, Kirim Transfer"
        cancelText="Kembali"
        variant="info"
        loading={submittingDispatch}
        onConfirm={handleConfirmDispatch}
        onClose={() => setDispatchModalOpen(false)}
      />

      {/* Confirm Receive Modal */}
      <ConfirmModal
        isOpen={receiveModalOpen}
        title="Konfirmasi Penerimaan Transfer"
        message={`Konfirmasi penerimaan barang untuk transfer #${receivingTransfer?.transferNumber}? Stok akan langsung ditambahkan ke toko penerima (${receivingTransfer?.targetOutlet?.name}) dan transfer selesai.`}
        confirmText="Ya, Terima Barang"
        cancelText="Kembali"
        variant="success"
        loading={submittingReceive}
        onConfirm={handleConfirmReceive}
        onClose={() => setReceiveModalOpen(false)}
      />
    </div>
  );
};
