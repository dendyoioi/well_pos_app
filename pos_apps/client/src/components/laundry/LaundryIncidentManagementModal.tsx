import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ChevronDown,
  Loader2,
  Search,
} from 'lucide-react';
import { api } from '../../services/api';
import type { LaundryIncident } from '../../types/laundry';
import { CurrencyInput } from '../ui/CurrencyInput';

interface LaundryIncidentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  outletId: string;
}

export const LaundryIncidentManagementModal: React.FC<LaundryIncidentManagementModalProps> = ({
  isOpen,
  onClose,
  outletId,
}) => {
  const [incidents, setIncidents] = useState<LaundryIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<LaundryIncident | null>(null);

  // Resolution Form State
  const [resolveStatus, setResolveStatus] = useState<string>('RESOLVED');
  const [approvedComp, setApprovedComp] = useState<number>(0);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const fetchIncidents = () => {
    if (!outletId) return;
    setLoading(true);
    api
      .getLaundryIncidents({
        outletId,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      })
      .then((res) => {
        if (res.status === 'success' && Array.isArray(res.data)) {
          setIncidents(res.data);
        }
      })
      .catch((err) => console.error('Error fetching incidents:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      fetchIncidents();
    }
  }, [isOpen, outletId, statusFilter]);

  if (!isOpen) return null;

  const handleOpenResolution = (inc: LaundryIncident) => {
    setSelectedIncident(inc);
    setResolveStatus(inc.status === 'OPEN' ? 'RESOLVED' : inc.status);
    setApprovedComp(Number(inc.approvedCompensation || inc.estimatedCompensation || 0));
    setResolutionNotes(inc.resolutionNotes || '');
    setFeedback(null);
  };

  const handleSaveResolution = async () => {
    if (!selectedIncident) return;
    setUpdating(true);
    setFeedback(null);

    try {
      const res = await api.updateLaundryIncident(selectedIncident.id, {
        status: resolveStatus,
        approvedCompensation: Number(approvedComp || 0),
        resolutionNotes: resolutionNotes.trim(),
      });

      if (res.status === 'success') {
        setFeedback({ type: 'success', message: 'Status insiden berhasil diperbarui.' });
        fetchIncidents();
        setTimeout(() => {
          setSelectedIncident(null);
        }, 800);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Gagal memperbarui insiden.' });
      }
    } catch (err: any) {
      console.error('Error update incident:', err);
      setFeedback({ type: 'error', message: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setUpdating(false);
    }
  };

  const filteredIncidents = incidents.filter((inc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inc.order?.invoiceNumber?.toLowerCase().includes(q) ||
      inc.order?.customer?.name?.toLowerCase().includes(q) ||
      inc.itemDescription.toLowerCase().includes(q) ||
      inc.notes?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-4xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-900 text-white rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Manajemen Insiden Produksi</h3>
              <p className="text-xs text-slate-500">
                Pusat penanganan komplain pakaian rusak, luntur, hilang, dan persetujuan ganti rugi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div className="p-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { key: 'ALL', label: 'Semua Status' },
              { key: 'OPEN', label: 'Perlu Tindakan' },
              { key: 'INVESTIGATING', label: 'Investigasi' },
              { key: 'RESOLVED', label: 'Selesai' },
              { key: 'COMPENSATED', label: 'Diganti Rugi' },
            ].map((tab) => {
              const active = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                    active
                      ? 'bg-blue-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nota, pelanggan, pakaian..."
              className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent"
            />
          </div>
        </div>

        {/* Incident List Body */}
        <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-3.5 bg-slate-50/50">
          {loading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-900 mb-2" />
              <p className="text-xs">Memuat daftar insiden produksi...</p>
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 p-8">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Tidak Ada Insiden</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Semua cucian produksi berjalan dengan aman tanpa komplain aktif.
              </p>
            </div>
          ) : (
            filteredIncidents.map((inc) => {
              const isOpenCase = inc.status === 'OPEN' || inc.status === 'INVESTIGATING';
              return (
                <div
                  key={inc.id}
                  className={`bg-white rounded-2xl p-4 border transition-all shadow-sm ${
                    isOpenCase ? 'border-rose-200 ring-1 ring-rose-100' : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-slate-900">
                        {inc.order?.invoiceNumber || 'No Invoice'}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs text-slate-600 font-medium">
                        {inc.order?.customer?.name || 'Pelanggan Walk-In'}
                      </span>
                      {inc.order?.customer?.phone && (
                        <span className="text-xs text-slate-400">({inc.order.customer.phone})</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full uppercase tracking-wider ${
                          inc.status === 'OPEN'
                            ? 'bg-rose-100 text-rose-800'
                            : inc.status === 'INVESTIGATING'
                            ? 'bg-amber-100 text-amber-800'
                            : inc.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {inc.status}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(inc.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="py-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="md:col-span-2 space-y-1.5">
                      <p className="font-semibold text-slate-800 text-sm">{inc.itemDescription}</p>
                      <div className="flex flex-wrap items-center gap-2 text-slate-500 text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-700">
                          Tipe: {inc.incidentType}
                        </span>
                        {inc.stage && (
                          <span className="px-2 py-0.5 rounded bg-slate-100">Tahap: {inc.stage}</span>
                        )}
                        {inc.machineName && (
                          <span className="px-2 py-0.5 rounded bg-slate-100">Mesin: {inc.machineName}</span>
                        )}
                        {inc.responsibleStaff && (
                          <span className="px-2 py-0.5 rounded bg-slate-100">
                            Operator: {inc.responsibleStaff.name}
                          </span>
                        )}
                      </div>
                      {inc.notes && (
                        <p className="text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-2">
                          <span className="font-semibold text-slate-700">Kronologi: </span>
                          {inc.notes}
                        </p>
                      )}
                      {inc.resolutionNotes && (
                        <p className="text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 mt-2">
                          <span className="font-semibold">Solusi Owner: </span>
                          {inc.resolutionNotes}
                        </p>
                      )}
                    </div>

                    {/* Nominal & Status Approval */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px] text-slate-500">
                          <span>Saran Nota:</span>
                          <span className="tabular-nums font-semibold text-slate-700">
                            Rp {Number(inc.estimatedCompensation).toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold text-slate-900 pt-1 border-t border-slate-200">
                          <span>Ganti Rugi Disetujui:</span>
                          <span className="tabular-nums text-rose-700">
                            Rp {Number(inc.approvedCompensation).toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenResolution(inc)}
                        className="mt-3 w-full py-1.5 px-3 rounded-xl text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Tinjau & Putuskan</span>
                      </button>
                    </div>
                  </div>

                  {/* Foto Bukti */}
                  {Array.isArray(inc.photoUrls) && inc.photoUrls.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
                      <span className="text-[11px] text-slate-400 font-medium shrink-0">Bukti:</span>
                      {inc.photoUrls.map((url, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => setPreviewPhoto(url)}
                          className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-blue-900 transition-all shrink-0"
                        >
                          <img src={url} alt={`Bukti ${pIdx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Action Putusan (Nested / Overlay) */}
        {selectedIncident && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="font-bold text-sm text-slate-800">Putusan Kasus Insiden</h4>
                <button
                  type="button"
                  onClick={() => setSelectedIncident(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl">
                <p>
                  <span className="font-semibold text-slate-700">Nota:</span>{' '}
                  {selectedIncident.order?.invoiceNumber} ({selectedIncident.order?.customer?.name})
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Pakaian:</span>{' '}
                  {selectedIncident.itemDescription}
                </p>
              </div>

              {/* Status Putusan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status Penanganan</label>
                <div className="relative">
                  <select
                    value={resolveStatus}
                    onChange={(e) => setResolveStatus(e.target.value)}
                    className="w-full appearance-none pr-10 px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-800"
                  >
                    <option value="INVESTIGATING">INVESTIGASI (Sedang Ditelusuri)</option>
                    <option value="RESOLVED">RESOLVED (Kasus Selesai Tanpa Ganti Rugi)</option>
                    <option value="COMPENSATED">COMPENSATED (Disetujui Ganti Rugi)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Ganti Rugi Disetujui */}
              <div>
                <CurrencyInput
                  label="Nominal Ganti Rugi Disetujui (Rp)"
                  value={approvedComp}
                  onChange={(val) => setApprovedComp(val)}
                  placeholder="0"
                />
              </div>

              {/* Catatan Putusan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Penyelesaian / Solusi Pelanggan
                </label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Contoh: Disepakati cuci ulang gratis + kompensasi tunai Rp 50.000, pelanggan menerima dengan baik."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              {/* Tombol Aksi */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedIncident(null)}
                  disabled={updating}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveResolution}
                  disabled={updating}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-xl flex items-center gap-1.5 shadow-sm"
                >
                  {updating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan Putusan</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox Pratinjau Foto Bukti */}
        {previewPhoto && (
          <div
            className="fixed inset-0 z-70 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreviewPhoto(null)}
          >
            <div className="relative max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl">
              <img src={previewPhoto} alt="Pratinjau Foto" className="w-full h-full object-contain" />
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full hover:bg-black/90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between pb-[max(1rem,env(safe-area-inset-bottom))]">
          <span className="text-xs text-slate-500">
            Total {filteredIncidents.length} insiden tercatat
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors shadow-sm"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
