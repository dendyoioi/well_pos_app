import React, { useState, useEffect, useCallback } from 'react';
import { X, History, Clock, ArrowRight, User, AlertCircle, Loader2 } from 'lucide-react';
import { laundryCoreApi } from '../../services/api';
import type { LaundryServicePriceHistoryItem } from '../../types/laundry_core';

interface ServicePriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string;
  serviceName: string;
  activeOutletId?: string;
}

export const ServicePriceHistoryModal: React.FC<ServicePriceHistoryModalProps> = ({
  isOpen,
  onClose,
  serviceId,
  serviceName,
  activeOutletId,
}) => {
  const [history, setHistory] = useState<LaundryServicePriceHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!serviceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await laundryCoreApi.getServicePriceHistory(serviceId, activeOutletId);
      if (res.status === 'success' && res.data) {
        setHistory(res.data);
      } else {
        setError(res.message || 'Gagal memuat riwayat harga');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  }, [serviceId, activeOutletId]);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, fetchHistory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 border border-slate-200">
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-900">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Riwayat Perubahan Harga</h2>
              <p className="text-xs text-slate-500 font-medium">Layanan: {serviceName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin mb-2" />
              <span className="text-xs">Memuat jejak audit perubahan harga...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
              <History className="w-10 h-10 stroke-[1.2] mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">Belum Ada Riwayat Perubahan</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Tarif layanan ini belum pernah diubah atau masih menggunakan harga awal.
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    {item.outletName}
                  </span>
                  <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <Clock className="w-3 h-3" />
                    {new Date(item.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Price change badge */}
                <div className="flex items-center gap-2 py-1">
                  <span className="text-xs font-mono font-medium text-slate-500 line-through">
                    Rp {item.oldPrice.toLocaleString('id-ID')}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm font-mono font-bold text-slate-900">
                    Rp {item.newPrice.toLocaleString('id-ID')}
                  </span>
                  {item.newPrice > item.oldPrice ? (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                      +Rp {(item.newPrice - item.oldPrice).toLocaleString('id-ID')}
                    </span>
                  ) : item.newPrice < item.oldPrice ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      -Rp {(item.oldPrice - item.newPrice).toLocaleString('id-ID')}
                    </span>
                  ) : null}
                </div>

                {/* Reason & Changed By */}
                <div className="text-[11px] text-slate-500 space-y-1 pt-1 border-t border-slate-200/60">
                  {item.reason && (
                    <p className="italic text-slate-600">
                      &quot;{item.reason}&quot;
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <User className="w-3 h-3" />
                    <span>Diubah oleh: </span>
                    <strong className="text-slate-700">{item.changedByName || 'Sistem'}</strong>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between pb-[max(1rem,env(safe-area-inset-bottom))]">
          <span className="text-xs text-slate-500">Total catatan: {history.length}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors shadow-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
