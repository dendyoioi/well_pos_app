import React, { useState, useEffect, useMemo } from 'react';
import {
  Star,
  Search,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  X,
  Send,
} from 'lucide-react';
import { api } from '../../services/api';
import type { Outlet } from '../../types/outlet';
import type { LaundryCustomerFeedback } from '../../types/laundry';
import { TablePagination } from '../TablePagination';
import { TableSkeleton, EmptyState } from '../ui';
import { useDialog } from '../../context/DialogContext';

interface LaundryFeedbackManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOutlet?: Outlet | null;
}

export const LaundryFeedbackManagementModal: React.FC<LaundryFeedbackManagementModalProps> = ({
  isOpen,
  onClose,
  activeOutlet,
}) => {
  const dialog = useDialog();

  const [feedbacks, setFeedbacks] = useState<LaundryCustomerFeedback[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // ALL, PENDING, IN_REVIEW, RESOLVED
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'COMPLAINTS' | 'PRAISES'>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Resolution Modal State
  const [selectedFeedback, setSelectedFeedback] = useState<LaundryCustomerFeedback | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<'IN_REVIEW' | 'RESOLVED'>('RESOLVED');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [submittingResolution, setSubmittingResolution] = useState<boolean>(false);

  const fetchFeedbacks = async () => {
    try {
      setLoading(true);
      const res = await api.getLaundryFeedbacks({
        outletId: activeOutlet && !activeOutlet.isWarehouse ? activeOutlet.id : undefined,
      });

      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray((res.data as any)?.feedbacks)
        ? (res.data as any).feedbacks
        : [];
      setFeedbacks(list);
    } catch {
      setFeedbacks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFeedbacks();
      setCurrentPage(1);
    }
  }, [isOpen, activeOutlet?.id]);

  // Metrics
  const metrics = useMemo(() => {
    if (feedbacks.length === 0) return { avgRating: 5.0, total: 0, complaints: 0, pending: 0 };
    const totalRating = feedbacks.reduce((acc, f) => acc + f.rating, 0);
    const avgRating = Number((totalRating / feedbacks.length).toFixed(1));
    const complaints = feedbacks.filter((f) => f.isComplaint).length;
    const pending = feedbacks.filter((f) => f.isComplaint && f.status !== 'RESOLVED').length;
    return { avgRating, total: feedbacks.length, complaints, pending };
  }, [feedbacks]);

  // Filter & Search
  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((f) => {
      if (statusFilter !== 'ALL' && f.status !== statusFilter) return false;
      if (typeFilter === 'COMPLAINTS' && !f.isComplaint) return false;
      if (typeFilter === 'PRAISES' && f.isComplaint) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesInvoice = f.invoiceNumber?.toLowerCase().includes(q);
        const matchesCustomer = f.customer?.name?.toLowerCase().includes(q) || f.order?.customerName?.toLowerCase().includes(q);
        const matchesComment = f.comment?.toLowerCase().includes(q);
        const matchesNotes = f.resolutionNotes?.toLowerCase().includes(q);
        if (!matchesInvoice && !matchesCustomer && !matchesComment && !matchesNotes) return false;
      }
      return true;
    });
  }, [feedbacks, statusFilter, typeFilter, search]);

  const paginatedFeedbacks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFeedbacks.slice(start, start + pageSize);
  }, [filteredFeedbacks, currentPage, pageSize]);

  const handleOpenResolution = (f: LaundryCustomerFeedback) => {
    setSelectedFeedback(f);
    setResolutionStatus(f.status === 'RESOLVED' ? 'RESOLVED' : 'RESOLVED');
    setResolutionNotes(f.resolutionNotes || '');
  };

  const handleSaveResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeedback) return;
    try {
      setSubmittingResolution(true);
      const res = await api.resolveLaundryFeedback(selectedFeedback.id, {
        status: resolutionStatus,
        resolutionNotes: resolutionNotes.trim() || undefined,
      });

      if (res.status === 'success') {
        dialog.toast('Status tindak lanjut komplain berhasil disimpan!', 'success');
        setSelectedFeedback(null);
        fetchFeedbacks();
      } else {
        dialog.toast(res.message || 'Gagal menyimpan status komplain', 'error');
      }
    } catch {
      dialog.toast('Terjadi kesalahan saat memproses tindak lanjut komplain', 'error');
    } finally {
      setSubmittingResolution(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
      <div className="w-full sm:max-w-4xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
              <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm">Audit Rating &amp; Komplain Pelanggan</h3>
              <p className="text-xs text-slate-500">
                Laporan kepuasan dan penanganan komplain live dari pelanggan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top KPI Metrics Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0 text-xs">
          <div className="p-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rata-rata Rating</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="text-base font-black text-slate-900">{metrics.avgRating} / 5.0</span>
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Ulasan</span>
            <div className="text-base font-black text-blue-900 mt-0.5">{metrics.total} Ulasan</div>
          </div>

          <div className="p-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Komplain</span>
            <div className="text-base font-black text-slate-700 mt-0.5">{metrics.complaints} Kasus</div>
          </div>

          <div className="p-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Komplain Belum Selesai</span>
            <div className={`text-base font-black mt-0.5 ${metrics.pending > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {metrics.pending} Pending
            </div>
          </div>
        </div>

        {/* Toolbar Filter & Search */}
        <div className="p-4 border-b border-slate-200/60 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nomor nota, nama pelanggan, komentar..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-900 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="appearance-none pr-10 pl-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none"
              >
                <option value="ALL">Semua Ulasan</option>
                <option value="COMPLAINTS">Hanya Komplain (1-3 Bintang)</option>
                <option value="PRAISES">Puas / Pujian (4-5 Bintang)</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none pr-10 pl-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none"
              >
                <option value="ALL">Semua Status</option>
                <option value="PENDING">Pending (Belum Ditangani)</option>
                <option value="IN_REVIEW">Sedang Ditinjau</option>
                <option value="RESOLVED">Selesai (Resolved)</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-4 overflow-y-auto overscroll-contain flex-1 space-y-3">
          {loading ? (
            <TableSkeleton rows={4} />
          ) : filteredFeedbacks.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Star className="w-8 h-8 text-slate-400" />}
                title="Tidak Ada Ulasan"
                description="Belum ada ulasan atau komplain yang sesuai dengan filter pencarian."
              />
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedFeedbacks.map((item) => {
                const customerName = item.customer?.name || item.order?.customerName || 'Pelanggan';
                const customerPhone = item.customer?.phone || item.order?.customerPhone;

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      item.isComplaint
                        ? item.status === 'RESOLVED'
                          ? 'bg-emerald-50/30 border-emerald-200'
                          : 'bg-rose-50/40 border-rose-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-black text-blue-900">
                            {item.invoiceNumber}
                          </span>
                          <span className="text-xs font-extrabold text-slate-900">
                            • {customerName}
                          </span>
                          {customerPhone && (
                            <span className="text-[11px] font-mono text-slate-500">
                              ({customerPhone})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center text-amber-400">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3.5 h-3.5 ${
                                  s <= item.rating
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'text-slate-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-[11px] font-bold text-slate-600">
                            ({item.rating} / 5)
                          </span>
                          <span className="text-[10px] text-slate-400">
                            • {new Date(item.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black ${
                            item.status === 'RESOLVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'IN_REVIEW'
                              ? 'bg-indigo-100 text-indigo-900'
                              : item.isComplaint
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.isComplaint
                            ? item.status === 'RESOLVED'
                              ? '✓ Komplain Selesai'
                              : item.status === 'IN_REVIEW'
                              ? 'Sedang Ditinjau'
                              : 'Pending'
                            : 'Ulasan Positif'}
                        </span>

                        {item.isComplaint && (
                          <button
                            type="button"
                            onClick={() => handleOpenResolution(item)}
                            className="px-3 py-1 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold transition-all cursor-pointer"
                          >
                            Tindak Lanjut
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Category & Comment */}
                    {item.isComplaint && item.category && (
                      <div className="mt-2 text-[11px] font-bold text-rose-900 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                        <span>Kategori: {item.category}</span>
                      </div>
                    )}

                    {item.comment && (
                      <div className="mt-2 p-2.5 rounded-xl bg-white/80 border border-slate-200 text-xs text-slate-800 italic">
                        "{item.comment}"
                      </div>
                    )}

                    {/* Resolution Notes */}
                    {item.resolutionNotes && (
                      <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-0.5">
                        <div className="font-black text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Tindakan / Solusi dari Toko:</span>
                        </div>
                        <p className="text-[11.5px]">{item.resolutionNotes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Pagination & Close */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-auto">
            <TablePagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={filteredFeedbacks.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
            />
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Sub-Modal: Form Tindak Lanjut Komplain (Responsive) */}
      {selectedFeedback && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h4 className="font-black text-slate-900 text-sm">
                Tindak Lanjut Komplain #{selectedFeedback.invoiceNumber}
              </h4>
              <button
                type="button"
                onClick={() => setSelectedFeedback(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResolution} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 overflow-y-auto overscroll-contain flex-1 space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Status Penyelesaian Komplain:
                  </label>
                  <div className="relative">
                    <select
                      value={resolutionStatus}
                      onChange={(e) => setResolutionStatus(e.target.value as any)}
                      className="w-full p-2.5 appearance-none pr-10 rounded-xl border border-slate-300 bg-white font-bold text-xs focus:outline-none focus:border-blue-900"
                    >
                      <option value="IN_REVIEW">Sedang Ditinjau (IN_REVIEW)</option>
                      <option value="RESOLVED">Selesai Ditangani (RESOLVED)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Catatan Solusi / Tindak Lanjut (Ditampilkan ke Pelanggan di Halaman Tracking):
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Contoh: Sudah dihubungi via WA. Pakaian telah dicuci ulang gratis dan dikirim ke alamat pelanggan hari ini..."
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-blue-900 leading-relaxed"
                  />
                </div>
              </div>

              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedFeedback(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingResolution || !resolutionNotes.trim()}
                  className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-black text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingResolution ? 'Menyimpan...' : 'Simpan Solusi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
