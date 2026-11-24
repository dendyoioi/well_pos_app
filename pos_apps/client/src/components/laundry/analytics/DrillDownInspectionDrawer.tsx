// Well POS - DrillDownInspectionDrawer Component
// Slide-Over Drawer Inspeksi Drilldown (Zero Stacked Modals Policy)

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  AlertCircle,
  User,
  Phone,
  FileText,
  RotateCcw,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import type { DrilldownResult, DrilldownType } from '../../../types/laundryAnalytics';
import { fetchLaundryDrilldown } from '../../../services/laundryAnalyticsApi';
import { TablePagination } from '../../TablePagination';
import { formatRupiah } from '../../../utils/currency';

interface DrillDownInspectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  type: DrilldownType;
  outletId: string;
  preset: string;
  startDate?: string;
  endDate?: string;
  contextParams?: {
    date?: string;
    stage?: string;
    paymentMethod?: string;
    dayOfWeek?: number;
    hour?: number;
    dormantDays?: number;
  };
  userRole?: string;
}

export const DrillDownInspectionDrawer: React.FC<DrillDownInspectionDrawerProps> = ({
  isOpen,
  onClose,
  type,
  outletId,
  preset,
  startDate,
  endDate,
  contextParams,
  userRole,
}) => {
  const [data, setData] = useState<DrilldownResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const isSupervisor = userRole === 'SUPERVISOR';
  const abortControllerRef = useRef<AbortController | null>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Fetch drilldown data
  const loadDrilldownData = () => {
    if (!isOpen) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setLoading(true);
    setError(null);

    fetchLaundryDrilldown(
      {
        type,
        preset,
        startDate,
        endDate,
        outletId,
        page,
        limit,
        targetDate: contextParams?.date,
        stage: contextParams?.stage,
        paymentMethod: contextParams?.paymentMethod,
        dayOfWeek: contextParams?.dayOfWeek,
        hour: contextParams?.hour,
        dormantDays: contextParams?.dormantDays,
      },
      ac.signal
    )
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Gagal memuat rincian data.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadDrilldownData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isOpen, type, outletId, preset, startDate, endDate, page, limit, contextParams]);

  if (!isOpen) return null;

  // Title and subtitle helper
  const getHeaderInfo = () => {
    switch (type) {
      case 'ORDERS_BY_DATE':
        return {
          title: 'Rincian Pesanan per Tanggal',
          desc: contextParams?.date
            ? `Daftar transaksi nota pada tanggal ${contextParams.date}`
            : 'Rincian nota transaksi operasional',
        };
      case 'ORDERS_BY_STAGE':
        return {
          title: 'Daftar Pesanan per Stase Kerja',
          desc: contextParams?.stage
            ? `Nota yang sedang berada pada tahapan ${contextParams.stage}`
            : 'Rincian nota dalam pipa produksi',
        };
      case 'ORDERS_BY_PAYMENT':
        return {
          title: 'Rincian Transaksi Pembayaran',
          desc: contextParams?.paymentMethod
            ? `Transaksi via metode pembayaran ${contextParams.paymentMethod}`
            : 'Daftar transaksi kas masuk',
        };
      case 'ORDERS_BY_HOUR':
        return {
          title: 'Rincian Pesanan Jam Sibuk',
          desc: `Daftar transaksi masuk pada pukul ${contextParams?.hour || 0}:00 WIB`,
        };
      case 'UNPAID_DEBTS':
        return {
          title: 'Buku Piutang & Kasbon Pelanggan',
          desc: 'Daftar pelanggan dengan tagihan cucian belum lunas',
        };
      case 'OVERDUE_ORDERS':
        return {
          title: 'Daftar Pesanan Terlambat (Overdue)',
          desc: 'Nota yang telah melewati estimasi janji selesai (SLA)',
        };
      case 'DORMANT_CUSTOMERS':
        return {
          title: 'Daftar Pelanggan Dorman',
          desc: `Pelanggan tidak mencuci lebih dari ${contextParams?.dormantDays || 30} hari`,
        };
      default:
        return {
          title: 'Rincian Data Analitik',
          desc: 'Inspeksi mendalam catatan transaksi',
        };
    }
  };

  const headerInfo = getHeaderInfo();

  // Client-side CSV export
  const handleExportCsv = () => {
    if (!data?.items || data.items.length === 0) return;
    try {
      const headers = Object.keys(data.items[0]);
      const csvRows = data.items.map((row) =>
        headers
          .map((h) => {
            const val = row[h];
            const str = val === null || val === undefined ? '' : String(val);
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(',')
      );
      const csvContent = [headers.join(','), ...csvRows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `drilldown_${type.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex sm:justify-end items-end sm:items-stretch bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      {/* Backdrop touch area */}
      <div className="fixed inset-0 -z-10" onClick={onClose} />

      {/* Main Container: Mobile Bottom-Sheet, Desktop Slide-Over Panel */}
      <div className="w-full sm:w-[480px] md:w-[540px] bg-white rounded-t-3xl sm:rounded-none sm:rounded-l-3xl max-h-[92dvh] sm:max-h-full h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-100/70 text-blue-900">
                <FileText className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                {headerInfo.title}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{headerInfo.desc}</p>
          </div>

          <div className="flex items-center gap-1">
            {data?.items && data.items.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                title="Ekspor CSV"
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-3">
          {/* Loading Skeleton */}
          {loading && (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-2xl" />
              ))}
            </div>
          )}

          {/* Error Message */}
          {error && !loading && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-rose-800">{error}</p>
              <button
                type="button"
                onClick={loadDrilldownData}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-900 text-white rounded-xl text-xs font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Coba Lagi
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && (!data?.items || data.items.length === 0) && (
            <div className="py-12 text-center text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-xs sm:text-sm font-semibold text-slate-600">
                Tidak ada data pada kriteria ini
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Silakan sesuaikan tanggal atau preset filter analitik.
              </p>
            </div>
          )}

          {/* List of Drilldown Items */}
          {!loading &&
            !error &&
            data?.items &&
            data.items.map((item: any, idx: number) => {
              return (
                <div
                  key={item.orderId || item.transactionId || item.debtId || item.customerId || idx}
                  className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl hover:bg-white hover:border-blue-900/30 transition-all shadow-2xs"
                >
                  {/* UNPAID_DEBTS */}
                  {type === 'UNPAID_DEBTS' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                        <span className="flex items-center gap-1.5 text-blue-900">
                          <FileText className="w-3.5 h-3.5" />
                          {item.invoiceNumber}
                        </span>
                        {!isSupervisor && (
                          <span className="text-rose-600 font-extrabold tabular-nums">
                            Sisa {formatRupiah(item.remainingAmount)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span className="flex items-center gap-1 font-medium">
                          <User className="w-3 h-3 text-slate-400" />
                          {item.customerName}
                        </span>
                        {item.customerPhone && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {item.customerPhone}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/50">
                        <span>Jatuh Tempo: {item.dueDate ? new Date(item.dueDate).toLocaleDateString('id-ID') : '-'}</span>
                        {!isSupervisor && (
                          <span>Total Nota: {formatRupiah(item.totalAmount)}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* OVERDUE_ORDERS */}
                  {type === 'OVERDUE_ORDERS' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                        <span className="text-blue-900">{item.invoiceNumber}</span>
                        <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          Terlambat {item.overdueHours} Jam
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span className="font-medium">{item.customerName}</span>
                        <span className="bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                          Stase: {item.currentStage}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/50">
                        <span>Estimasi: {item.estimatedReadyAt ? new Date(item.estimatedReadyAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'} WIB</span>
                        <span>{item.totalWeightKg ?? item.weightKg} Kg</span>
                      </div>
                    </div>
                  )}

                  {/* ORDERS_BY_STAGE */}
                  {type === 'ORDERS_BY_STAGE' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                        <span className="text-blue-900">{item.invoiceNumber}</span>
                        <span className="text-slate-600 font-semibold text-[11px]">
                          {item.totalWeightKg ?? item.weightKg} Kg
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span className="font-medium">{item.customerName}</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-900">
                          {item.currentStage}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/50">
                        <span>Masuk: {new Date(item.createdAt).toLocaleDateString('id-ID')}</span>
                        {item.isOverdue && (
                          <span className="text-rose-600 font-bold">Overdue SLA</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ORDERS_BY_PAYMENT */}
                  {type === 'ORDERS_BY_PAYMENT' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                        <span className="text-blue-900">{item.invoiceNumber}</span>
                        {!isSupervisor && (
                          <span className="text-emerald-700 font-extrabold tabular-nums">
                            {formatRupiah(item.amount)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>{item.customerName}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                          <CreditCard className="w-3 h-3" />
                          {item.paymentMethod}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-200/50">
                        <span>Waktu: {new Date(item.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                      </div>
                    </div>
                  )}

                  {/* DORMANT_CUSTOMERS */}
                  {type === 'DORMANT_CUSTOMERS' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                        <span className="text-blue-900">{item.name || item.customerName}</span>
                        <span className="text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          Dorman {item.daysSinceLastOrder ?? item.daysDormant} Hari
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>{item.phone || 'Tidak ada no telepon'}</span>
                        <span>{item.totalOrders ?? item.visitCount}x Pesanan</span>
                      </div>
                      {!isSupervisor && (
                        <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/50 flex justify-between">
                          <span>Total Belanja:</span>
                          <strong className="text-slate-800 tabular-nums">{formatRupiah(item.totalSpent)}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ORDERS_BY_DATE or ORDERS_BY_HOUR */}
                  {(type === 'ORDERS_BY_DATE' || type === 'ORDERS_BY_HOUR') && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                        <span className="text-blue-900">{item.invoiceNumber}</span>
                        {!isSupervisor && (
                          <span className="text-slate-900 font-extrabold tabular-nums">
                            {formatRupiah(item.grandTotal)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>{item.customerName}</span>
                        {(item.totalWeightKg !== undefined || item.weightKg !== undefined) && (
                          <span className="font-semibold text-slate-700">
                            {item.totalWeightKg ?? item.weightKg} Kg
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-200/50 flex justify-between">
                        <span>Jam: {new Date(item.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                        <span className="text-slate-600 font-semibold">{item.orderStatus || 'VALID'}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Drawer Sticky Action Footer with Safe-Area Cushion */}
        <div className="border-t border-slate-200 bg-slate-50 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {data?.pagination && data.pagination.totalItems > 0 && (
            <TablePagination
              currentPage={page}
              pageSize={limit}
              totalItems={data.pagination.totalItems}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(sz) => {
                setLimit(sz);
                setPage(1);
              }}
              pageSizeOptions={[10, 25, 50, 100]}
              itemLabel="data"
              className="bg-transparent border-t-0 py-2.5 px-4"
            />
          )}

          <div className="p-3 sm:px-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs sm:text-sm font-bold transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
