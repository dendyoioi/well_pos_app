import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  RefreshCw,
  Printer,
  Trash2,
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  Clock,
  WifiOff,
  User,
  ShoppingBag,
} from 'lucide-react';
import {
  getOfflineOrdersByOutlet,
  deleteOfflineOrder,
  type OfflineOrderEntry,
} from '../../utils/offlineQueue';
import { formatCacheTime } from '../../utils/offlineDataCache';
import { formatRupiah } from '../../utils/currency';
import { useDialog } from '../../context/DialogContext';

export interface OfflineQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  outletId?: string;
  orderKind: 'POS' | 'LAUNDRY';
  isOnline: boolean;
  isSyncing?: boolean;
  canDeleteEntry?: boolean;
  onRetrySingle: (entry: OfflineOrderEntry) => Promise<void>;
  onRetryAll: () => Promise<void>;
  onReprintReceipt: (entry: OfflineOrderEntry) => void;
  onQueueChanged?: () => void;
}

export const OfflineQueueModal: React.FC<OfflineQueueModalProps> = ({
  isOpen,
  onClose,
  outletId,
  orderKind,
  isOnline,
  isSyncing = false,
  canDeleteEntry = false,
  onRetrySingle,
  onRetryAll,
  onReprintReceipt,
  onQueueChanged,
}) => {
  const dialog = useDialog();
  const [entries, setEntries] = useState<OfflineOrderEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getOfflineOrdersByOutlet(outletId, orderKind);
      setEntries(list);
    } finally {
      setLoading(false);
    }
  }, [outletId, orderKind]);

  useEffect(() => {
    if (isOpen) {
      loadEntries();
    }
  }, [isOpen, loadEntries]);

  if (!isOpen) return null;

  const handleRetrySingleClick = async (entry: OfflineOrderEntry) => {
    if (!isOnline || isSyncing || syncingId) return;
    setSyncingId(entry.offlineId);
    try {
      await onRetrySingle(entry);
      await loadEntries();
      onQueueChanged?.();
    } finally {
      setSyncingId(null);
    }
  };

  const handleRetryAllClick = async () => {
    if (!isOnline || isSyncing || entries.length === 0) return;
    await onRetryAll();
    await loadEntries();
    onQueueChanged?.();
  };

  const handleDeleteClick = async (entry: OfflineOrderEntry) => {
    const invNumber = entry.tempOrder?.invoiceNumber || entry.offlineId;
    const confirmed = await dialog.confirm({
      title: 'Hapus Antrean Transaksi Offline?',
      message: `Nota sementara #${invNumber} akan dihapus permanen dari penyimpanan lokal perangkat ini dan TIDAK akan masuk ke laporan server. Lanjutkan hanya jika transaksi dibatalkan atau sudah dicatat ulang.`,
      confirmText: 'Ya, Hapus Antrean',
      cancelText: 'Batal',
      variant: 'danger',
    });
    if (!confirmed) return;

    setDeletingId(entry.offlineId);
    try {
      await deleteOfflineOrder(entry.offlineId);
      await loadEntries();
      onQueueChanged?.();
      dialog.toast(`Antrean #${invNumber} telah dihapus dari perangkat.`, 'info');
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: OfflineOrderEntry['status']) => {
    if (status === 'FAILED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap shrink-0">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>Gagal Sync</span>
        </span>
      );
    }
    if (status === 'SYNCING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-900 border border-blue-200 whitespace-nowrap shrink-0">
          <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
          <span>Menyinkronkan</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap shrink-0">
        <Clock className="w-3 h-3 shrink-0" />
        <span>Menunggu Sync</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[85vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 text-white p-4 sm:p-5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-800/80 flex items-center justify-center text-blue-200 shrink-0">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-800/80 text-[10px] font-bold text-blue-200 uppercase tracking-wider mb-0.5 whitespace-nowrap">
                {orderKind === 'LAUNDRY' ? 'Antrean Kasir Laundry' : 'Antrean Kasir POS'}
              </div>
              <h3 className="font-black text-base text-white truncate">
                Manajemen Transaksi Offline ({entries.length})
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-blue-200 hover:text-white hover:bg-blue-800/60 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Koneksi */}
        {!isOnline && (
          <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-900 text-xs font-semibold flex items-center gap-2 shrink-0 min-w-0">
            <WifiOff className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="min-w-0 break-words">
              Perangkat sedang offline. Anda tetap dapat mencetak ulang nota lokal; sinkronisasi aktif saat internet pulih.
            </span>
          </div>
        )}

        {/* Body Daftar Antrean */}
        <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain flex-1 space-y-3 bg-slate-50/70">
          {loading ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-900" />
              <p className="text-xs font-semibold">Memuat antrean offline...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="py-10 px-4 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-900">Semua Transaksi Sudah Tersinkron</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                Tidak ada nota offline yang tertunda di perangkat ini.
              </p>
            </div>
          ) : (
            entries.map((entry) => {
              const tempOrder = entry.tempOrder || {};
              const invoiceNumber = tempOrder.invoiceNumber || entry.offlineId;
              const createdTime = formatCacheTime(entry.createdAt);
              const customerLabel =
                tempOrder.customerName || tempOrder.customer?.name || entry.payload?.customerName || '';
              const tableLabel = tempOrder.tableNumber || entry.payload?.tableNumber || '';
              const itemList = tempOrder.orderItems || tempOrder.items || entry.payload?.items || [];
              const itemCount = Array.isArray(itemList) ? itemList.length : 0;
              const grandTotal = Number(tempOrder.grandTotal ?? tempOrder.totalAmount ?? 0);
              const isEntrySyncing = syncingId === entry.offlineId || entry.status === 'SYNCING';

              return (
                <div
                  key={entry.offlineId}
                  className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-2xs space-y-3 min-w-0"
                >
                  {/* Row 1: Invoice & Status */}
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-xs sm:text-sm text-blue-950 break-all">
                          #{invoiceNumber}
                        </span>
                        {createdTime && (
                          <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                            {createdTime}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-slate-600">
                        {(customerLabel || tableLabel) && (
                          <span className="inline-flex items-center gap-1 font-semibold min-w-0">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[180px]">
                              {customerLabel || 'Pelanggan Umum'}
                              {tableLabel ? ` • Meja ${tableLabel}` : ''}
                            </span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-slate-500 whitespace-nowrap">
                          <ShoppingBag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{itemCount} item</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {getStatusBadge(entry.status)}
                      <span className="font-black text-xs sm:text-sm text-blue-950 whitespace-nowrap">
                        {formatRupiah(grandTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Error Box bila gagal sync */}
                  {entry.status === 'FAILED' && entry.lastError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold break-words leading-relaxed">
                      <span className="font-extrabold">Alasan Gagal: </span>
                      {entry.lastError}
                    </div>
                  )}

                  {/* Row Action Buttons */}
                  <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onReprintReceipt(entry)}
                      className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Cetak Ulang</span>
                    </button>

                    <button
                      type="button"
                      disabled={!isOnline || isSyncing || isEntrySyncing}
                      onClick={() => handleRetrySingleClick(entry)}
                      className="flex-1 sm:flex-initial h-9 px-3.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isEntrySyncing ? 'animate-spin' : ''}`} />
                      <span>{isEntrySyncing ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
                    </button>

                    {canDeleteEntry && (
                      <button
                        type="button"
                        disabled={deletingId === entry.offlineId || isEntrySyncing}
                        onClick={() => handleDeleteClick(entry)}
                        className="h-9 px-3 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sticky Footer */}
        <div className="p-4 sm:px-6 bg-white border-t border-slate-200 grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            Tutup
          </button>
          <button
            type="button"
            disabled={!isOnline || isSyncing || entries.length === 0}
            onClick={handleRetryAllClick}
            className="h-10 px-5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-black shadow-md shadow-blue-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Semua'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
