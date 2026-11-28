import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  FileCheck2,
  Loader2,
  Lock,
  MessageCircle,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Store,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import { api, authStorage } from '../../services/api';
import type { IncidentPayoutMethod, LaundryIncident } from '../../types/laundry';
import { CurrencyInput } from '../ui/CurrencyInput';
import { useDialog } from '../../context/DialogContext';
import { buildWhatsAppUrl } from '../../utils/phone';

interface LaundryIncidentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  outletId: string;
}

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  DAMAGED: 'Pakaian Rusak / Luntur',
  LOST: 'Pakaian Hilang',
  STAIN_REMAINING: 'Noda Membandel',
  MIXED_UP: 'Pakaian Tertukar',
};

const PAYOUT_METHOD_LABELS: Record<string, string> = {
  CASH_DRAWER: 'Kas Laci Kasir',
  BANK_TRANSFER: 'Transfer Bank / Kas Pusat',
  CUSTOMER_WALLET: 'Saldo Deposit Pelanggan',
};

export const LaundryIncidentManagementModal: React.FC<LaundryIncidentManagementModalProps> = ({
  isOpen,
  onClose,
  outletId,
}) => {
  const dialog = useDialog();
  const currentUser = authStorage.getUser();
  const canSettle = ['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(
    String(currentUser?.role || '').toUpperCase()
  );

  const [incidents, setIncidents] = useState<LaundryIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<LaundryIncident | null>(null);

  // Settlement Form State
  const [triggerRewash, setTriggerRewash] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [compensationAmount, setCompensationAmount] = useState<number>(0);
  const [payoutMethod, setPayoutMethod] = useState<IncidentPayoutMethod>('CASH_DRAWER');
  const [payoutReference, setPayoutReference] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [settling, setSettling] = useState(false);
  const [markingInvestigating, setMarkingInvestigating] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const fetchIncidents = async (keepSelectedId?: string) => {
    if (!outletId) return;
    setLoading(true);
    try {
      const res = await api.getLaundryIncidents({
        outletId,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });
      if (res.status === 'success' && Array.isArray(res.data)) {
        setIncidents(res.data);
        if (keepSelectedId) {
          const refreshed = res.data.find((i) => i.id === keepSelectedId);
          if (refreshed) {
            setSelectedIncident(refreshed);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching incidents:', err);
      dialog.toast('Gagal memuat daftar insiden', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedIncident(null);
      fetchIncidents();
    }
  }, [isOpen, outletId, statusFilter]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        inc.order?.invoiceNumber?.toLowerCase().includes(q) ||
        inc.order?.customer?.name?.toLowerCase().includes(q) ||
        inc.customerClaimantName?.toLowerCase().includes(q) ||
        inc.itemDescription.toLowerCase().includes(q) ||
        inc.notes?.toLowerCase().includes(q)
      );
    });
  }, [incidents, searchQuery]);

  if (!isOpen) return null;

  const openDetailView = (inc: LaundryIncident) => {
    setSelectedIncident(inc);
    setTriggerRewash(Boolean(inc.rewashTriggered));
    setRefundAmount(Number(inc.refundAmount || 0));
    setCompensationAmount(
      inc.settledAt
        ? Number(inc.approvedCompensation || 0)
        : Number(inc.approvedCompensation || inc.estimatedCompensation || 0)
    );
    if (inc.payoutMethod && ['CASH_DRAWER', 'BANK_TRANSFER', 'CUSTOMER_WALLET'].includes(inc.payoutMethod)) {
      setPayoutMethod(inc.payoutMethod as IncidentPayoutMethod);
    } else if (inc.customerBankInfo?.accountNumber) {
      setPayoutMethod('BANK_TRANSFER');
    } else {
      setPayoutMethod('CASH_DRAWER');
    }
    setPayoutReference(inc.payoutReference || '');
    setResolutionNotes(inc.resolutionNotes || '');
  };

  const ensureClaimToken = async (inc: LaundryIncident): Promise<string | null> => {
    if (inc.customerClaimToken) return inc.customerClaimToken;
    try {
      setGeneratingToken(true);
      const res = await api.generateLaundryIncidentClaimToken(inc.id);
      if (res.status === 'success' && res.data?.customerClaimToken) {
        const token = res.data.customerClaimToken;
        setIncidents((prev) =>
          prev.map((item) => (item.id === inc.id ? { ...item, customerClaimToken: token } : item))
        );
        if (selectedIncident?.id === inc.id) {
          setSelectedIncident((prev) => (prev ? { ...prev, customerClaimToken: token } : prev));
        }
        return token;
      }
      dialog.toast(res.message || 'Gagal membuat link klaim pelanggan', 'error');
      return null;
    } catch {
      dialog.toast('Gagal membuat link klaim pelanggan', 'error');
      return null;
    } finally {
      setGeneratingToken(false);
    }
  };

  const copyTextWithFeedback = async (text: string, key: string, successMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      dialog.toast(successMsg, 'success');
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      dialog.toast('Gagal menyalin ke clipboard', 'error');
    }
  };

  const handleCopyClaimLink = async (inc: LaundryIncident) => {
    const token = await ensureClaimToken(inc);
    if (!token || typeof window === 'undefined') return;
    const url = `${window.location.origin}/incident-claim/${token}`;
    await copyTextWithFeedback(url, `link-${inc.id}`, 'Link form klaim pelanggan berhasil disalin!');
  };

  const handleSendClaimWhatsApp = async (inc: LaundryIncident) => {
    const token = await ensureClaimToken(inc);
    if (!token || typeof window === 'undefined') return;
    const url = `${window.location.origin}/incident-claim/${token}`;
    const phone = inc.customerClaimantPhone || inc.order?.customer?.phone;
    const customerName = inc.customerClaimantName || inc.order?.customer?.name || 'Pelanggan';
    const message =
      `Halo Kak ${customerName},\n` +
      `Terkait penanganan insiden pada nota *${inc.order?.invoiceNumber || '-'}* (${inc.itemDescription}), ` +
      `silakan isi kronologi & unggah foto bukti dari pihak Kakak melalui tautan resmi berikut agar dapat segera kami tindak lanjuti:\n\n` +
      `${url}\n\nTerima kasih.`;
    window.open(buildWhatsAppUrl(phone, message), '_blank', 'noopener,noreferrer');
  };

  const handleSendSettlementWhatsApp = (inc: LaundryIncident) => {
    if (typeof window === 'undefined') return;
    const url = inc.customerClaimToken
      ? `${window.location.origin}/incident-claim/${inc.customerClaimToken}`
      : '';
    const phone = inc.customerClaimantPhone || inc.order?.customer?.phone;
    const customerName = inc.customerClaimantName || inc.order?.customer?.name || 'Pelanggan';
    const totalPayout = Number(inc.refundAmount || 0) + Number(inc.approvedCompensation || 0);
    const lines = [
      `Halo Kak ${customerName},`,
      `Berikut adalah *Berita Acara Penyelesaian Insiden* untuk nota *${inc.order?.invoiceNumber || '-'}* (${inc.itemDescription}):`,
      `• Garansi Cuci Ulang: ${inc.rewashTriggered ? 'Ya (Rp 0 — sedang diproses ulang)' : 'Tidak'}`,
      `• Refund Biaya Cuci: Rp ${Number(inc.refundAmount || 0).toLocaleString('id-ID')}`,
      `• Kompensasi Ganti Rugi: Rp ${Number(inc.approvedCompensation || 0).toLocaleString('id-ID')}`,
      ...(totalPayout > 0
        ? [
            `• Total Pencairan: Rp ${totalPayout.toLocaleString('id-ID')} (${PAYOUT_METHOD_LABELS[inc.payoutMethod || ''] || inc.payoutMethod || '-'})`,
          ]
        : []),
      ...(inc.payoutReference ? [`• No. Referensi: ${inc.payoutReference}`] : []),
      ...(inc.resolutionNotes ? [`• Catatan Outlet: ${inc.resolutionNotes}`] : []),
      ...(url ? [`\nLihat Berita Acara lengkap di:\n${url}`] : []),
    ];
    const message = lines.join('\n');
    window.open(buildWhatsAppUrl(phone, message), '_blank', 'noopener,noreferrer');
  };

  const handleMarkInvestigating = async () => {
    if (!selectedIncident) return;
    try {
      setMarkingInvestigating(true);
      const res = await api.updateLaundryIncident(selectedIncident.id, {
        status: 'INVESTIGATING',
      });
      if (res.status === 'success') {
        dialog.toast('Status insiden diubah menjadi Investigasi', 'success');
        await fetchIncidents(selectedIncident.id);
      } else {
        dialog.toast(res.message || 'Gagal memperbarui status insiden', 'error');
      }
    } catch {
      dialog.toast('Gagal memperbarui status insiden', 'error');
    } finally {
      setMarkingInvestigating(false);
    }
  };

  const handleSettleIncident = async () => {
    if (!selectedIncident) return;

    const maxRefund =
      selectedIncident.maxRefundableAmount !== undefined
        ? Number(selectedIncident.maxRefundableAmount)
        : Number(selectedIncident.order?.paidAmount || 0);

    if (!triggerRewash && refundAmount <= 0 && compensationAmount <= 0) {
      dialog.toast(
        'Pilih minimal satu penyelesaian: Garansi Cuci Ulang, Refund Biaya Cuci, atau Kompensasi Ganti Rugi.',
        'error'
      );
      return;
    }

    if (refundAmount > maxRefund) {
      dialog.toast(
        `Nominal refund melebihi batas maksimal yang dapat di-refund (Rp ${maxRefund.toLocaleString('id-ID')}).`,
        'error'
      );
      return;
    }

    const totalCashOut = Number(refundAmount) + Number(compensationAmount);
    if (totalCashOut > 0 && payoutMethod === 'CUSTOMER_WALLET' && !selectedIncident.order?.customerId) {
      dialog.toast('Order ini tidak terhubung dengan pelanggan terdaftar untuk Saldo Deposit.', 'error');
      return;
    }

    if (resolutionNotes.trim().length < 3) {
      dialog.toast('Catatan Penyelesaian / Berita Acara wajib diisi (minimal 3 karakter).', 'error');
      return;
    }

    const summaryParts: string[] = [];
    if (triggerRewash) summaryParts.push('Garansi Cuci Ulang (Rp 0)');
    if (refundAmount > 0) summaryParts.push(`Refund Rp ${refundAmount.toLocaleString('id-ID')}`);
    if (compensationAmount > 0) {
      summaryParts.push(`Kompensasi Rp ${compensationAmount.toLocaleString('id-ID')}`);
    }

    const confirmed = await dialog.confirm({
      title: 'Sahkan & Cairkan Penyelesaian?',
      message: `Tindakan ini bersifat permanen dan terkunci. Rincian: ${summaryParts.join(' + ')}${
        totalCashOut > 0 ? ` via ${PAYOUT_METHOD_LABELS[payoutMethod]}` : ''
      }. Lanjutkan?`,
      variant: 'warning',
      confirmText: 'Ya, Selesaikan & Cairkan',
      cancelText: 'Batal',
    });
    if (!confirmed) return;

    try {
      setSettling(true);
      const res = await api.settleLaundryIncident(selectedIncident.id, {
        triggerRewash,
        refundAmount: Number(refundAmount || 0),
        compensationAmount: Number(compensationAmount || 0),
        payoutMethod: totalCashOut > 0 ? payoutMethod : null,
        payoutReference: totalCashOut > 0 && payoutReference.trim() ? payoutReference.trim() : null,
        resolutionNotes: resolutionNotes.trim(),
      });

      if (res.status === 'success' && res.data) {
        dialog.toast('Penyelesaian insiden berhasil disahkan dan dicairkan!', 'success');
        setSelectedIncident(res.data);
        await fetchIncidents(selectedIncident.id);
      } else {
        dialog.toast(res.message || 'Gagal memproses penyelesaian insiden', 'error');
      }
    } catch (err: any) {
      dialog.toast(err?.message || 'Terjadi kesalahan saat menyelesaikan insiden', 'error');
    } finally {
      setSettling(false);
    }
  };

  const renderClientEvidenceBadge = (inc: LaundryIncident) => {
    if (inc.settledAt) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
          <Lock className="w-3 h-3 shrink-0" />
          <span>Selesai &amp; Cair</span>
        </span>
      );
    }
    if (inc.customerEvidenceSubmittedAt) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-900 border border-blue-200 whitespace-nowrap">
          <UserCheck className="w-3 h-3 shrink-0" />
          <span>Bukti Klien Masuk</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        <span>Menunggu Bukti Klien</span>
      </span>
    );
  };

  const selectedMaxRefund = selectedIncident
    ? selectedIncident.maxRefundableAmount !== undefined
      ? Number(selectedIncident.maxRefundableAmount)
      : Number(selectedIncident.order?.paidAmount || 0)
    : 0;
  const totalSettlementCashOut = Number(refundAmount || 0) + Number(compensationAmount || 0);
  const hasCustomerId = Boolean(selectedIncident?.order?.customerId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-4xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="px-4 sm:px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {selectedIncident ? (
              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                title="Kembali ke daftar insiden"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="p-2 bg-blue-900 text-white rounded-xl shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                {selectedIncident
                  ? `Detail & Penyelesaian • ${selectedIncident.order?.invoiceNumber || 'Insiden'}`
                  : 'Manajemen Insiden Produksi'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                {selectedIncident
                  ? 'Bandingkan bukti toko vs klien, lalu eksekusi cuci ulang, refund, atau ganti rugi terpadu'
                  : 'Pusat penanganan komplain, portal bukti pelanggan, dan pencairan kompensasi'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal manajemen insiden"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* LIST VIEW */}
        {!selectedIncident ? (
          <>
            {/* Toolbar & Filters */}
            <div className="p-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
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
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                        active
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nota, pelanggan, pakaian..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>
            </div>

            {/* Incident List Body */}
            <div className="overflow-y-auto overscroll-contain flex-1 min-h-0 p-4 sm:p-5 space-y-3.5 bg-slate-50/50">
              {loading ? (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-900 mb-2" />
                  <p className="text-xs font-semibold">Memuat daftar insiden produksi...</p>
                </div>
              ) : filteredIncidents.length === 0 ? (
                <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 p-8">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">Tidak Ada Insiden</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Semua cucian produksi berjalan aman tanpa komplain aktif.
                  </p>
                </div>
              ) : (
                filteredIncidents.map((inc) => {
                  const isOpenCase = !inc.settledAt && (inc.status === 'OPEN' || inc.status === 'INVESTIGATING');
                  const totalPayout = Number(inc.refundAmount || 0) + Number(inc.approvedCompensation || 0);

                  return (
                    <div
                      key={inc.id}
                      className={`bg-white rounded-2xl p-4 border transition-all shadow-xs ${
                        isOpenCase ? 'border-rose-200 ring-1 ring-rose-100' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs text-blue-950">
                            {inc.order?.invoiceNumber || 'No Invoice'}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-xs text-slate-700 font-bold">
                            {inc.order?.customer?.name || inc.customerClaimantName || 'Pelanggan Walk-In'}
                          </span>
                          {(inc.customerClaimantPhone || inc.order?.customer?.phone) && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              ({inc.customerClaimantPhone || inc.order?.customer?.phone})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {renderClientEvidenceBadge(inc)}
                          <span
                            className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full uppercase ${
                              inc.status === 'OPEN'
                                ? 'bg-rose-100 text-rose-800'
                                : inc.status === 'INVESTIGATING'
                                ? 'bg-amber-100 text-amber-800'
                                : inc.status === 'RESOLVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-900'
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
                          <p className="font-bold text-slate-900 text-sm">{inc.itemDescription}</p>
                          <div className="flex flex-wrap items-center gap-1.5 text-slate-500 text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-700">
                              {INCIDENT_TYPE_LABELS[inc.incidentType] || inc.incidentType}
                            </span>
                            {inc.stage && <span className="px-2 py-0.5 rounded bg-slate-100">Tahap: {inc.stage}</span>}
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
                            <p className="text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                              <span className="font-semibold text-slate-700">Catatan Toko: </span>
                              {inc.notes}
                            </p>
                          )}
                          {inc.customerEvidenceNotes && (
                            <p className="text-blue-950 bg-blue-50/70 p-2.5 rounded-xl border border-blue-100">
                              <span className="font-semibold">Kronologi Klien: </span>
                              {inc.customerEvidenceNotes}
                            </p>
                          )}
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px] text-slate-500">
                              <span>Saran Nota:</span>
                              <span className="tabular-nums font-semibold text-slate-700">
                                Rp {Number(inc.estimatedCompensation || 0).toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold text-slate-900 pt-1 border-t border-slate-200">
                              <span>{inc.settledAt ? 'Total Dicairkan:' : 'Kompensasi Disetujui:'}</span>
                              <span className="tabular-nums text-rose-700">
                                Rp {(inc.settledAt ? totalPayout : Number(inc.approvedCompensation || 0)).toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <button
                              type="button"
                              onClick={() => openDetailView(inc)}
                              className="w-full min-h-[38px] py-2 px-3 rounded-xl text-xs font-extrabold text-white bg-blue-900 hover:bg-blue-800 transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                              <span>{inc.settledAt ? 'Lihat Berita Acara' : 'Tinjau & Selesaikan'}</span>
                            </button>

                            {!inc.settledAt && !inc.customerEvidenceSubmittedAt && (
                              <button
                                type="button"
                                disabled={generatingToken}
                                onClick={() => handleSendClaimWhatsApp(inc)}
                                className="w-full min-h-[36px] py-1.5 px-3 rounded-xl text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>Minta Bukti Klien (WA)</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer List */}
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between pb-[max(1rem,env(safe-area-inset-bottom))]">
              <span className="text-xs font-medium text-slate-500">
                Total {filteredIncidents.length} insiden tercatat
              </span>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] px-5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </>
        ) : (
          /* DETAIL & PENYELESAIAN VIEW (SINGLE MODAL - ZERO STACKED MODALS) */
          <>
            <div className="overflow-y-auto overscroll-contain flex-1 min-h-0 p-4 sm:p-5 space-y-4 bg-slate-50/50 text-xs">
              {/* Ringkasan Header Detail */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-sm text-blue-950">
                      {selectedIncident.order?.invoiceNumber}
                    </span>
                    {renderClientEvidenceBadge(selectedIncident)}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700">
                      {INCIDENT_TYPE_LABELS[selectedIncident.incidentType] || selectedIncident.incidentType}
                    </span>
                  </div>
                  <div className="text-sm font-extrabold text-slate-900">{selectedIncident.itemDescription}</div>
                  <div className="text-[11px] text-slate-500">
                    Pelanggan: <strong>{selectedIncident.order?.customer?.name || 'Walk-In'}</strong> • Nilai Nota:{' '}
                    <strong className="text-slate-700">
                      Rp {Number(selectedIncident.order?.totalAmount || 0).toLocaleString('id-ID')}
                    </strong>{' '}
                    • Terbayar:{' '}
                    <strong className="text-slate-700">
                      Rp {Number(selectedIncident.order?.paidAmount || 0).toLocaleString('id-ID')}
                    </strong>
                  </div>
                </div>

                {!selectedIncident.settledAt && selectedIncident.status === 'OPEN' && canSettle && (
                  <button
                    type="button"
                    disabled={markingInvestigating}
                    onClick={handleMarkInvestigating}
                    className="min-h-[38px] px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs transition-colors cursor-pointer shrink-0"
                  >
                    {markingInvestigating ? 'Memproses...' : 'Tandai Sedang Investigasi'}
                  </button>
                )}
              </div>

              {/* Perbandingan Bukti Berdampingan (2 Kolom Desktop / Stack Mobile) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Kolom 1: Bukti & Catatan Toko */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 font-extrabold text-slate-900 text-xs sm:text-sm">
                      <Store className="w-4 h-4 text-blue-900 shrink-0" />
                      <span>Bukti &amp; Catatan Toko</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">
                      Oleh: {selectedIncident.reportedBy?.name || 'Staf'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-600">
                    {selectedIncident.stage && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-medium">
                        Tahap: {selectedIncident.stage}
                      </span>
                    )}
                    {selectedIncident.machineName && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-medium">
                        Mesin: {selectedIncident.machineName}
                      </span>
                    )}
                    {selectedIncident.responsibleStaff && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-medium">
                        Operator: {selectedIncident.responsibleStaff.name}
                      </span>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 leading-relaxed">
                    {selectedIncident.notes || <span className="italic text-slate-400">Tidak ada catatan tambahan toko.</span>}
                  </div>

                  <div>
                    <div className="text-[11px] font-bold text-slate-500 mb-1.5">Foto Bukti Toko</div>
                    {Array.isArray(selectedIncident.photoUrls) && selectedIncident.photoUrls.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedIncident.photoUrls.map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setPreviewPhoto(url)}
                            className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 hover:ring-2 hover:ring-blue-900 transition-all cursor-pointer"
                          >
                            <img src={url} alt={`Bukti Toko ${idx + 1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">Belum ada foto bukti dari toko.</p>
                    )}
                  </div>
                </div>

                {/* Kolom 2: Bukti & Kronologi Klien */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 font-extrabold text-slate-900 text-xs sm:text-sm">
                      <UserCheck className="w-4 h-4 text-blue-900 shrink-0" />
                      <span>Bukti &amp; Kronologi Klien</span>
                    </div>
                    {selectedIncident.customerEvidenceSubmittedAt && (
                      <span className="text-[10px] font-bold text-emerald-700">
                        Masuk{' '}
                        {new Date(selectedIncident.customerEvidenceSubmittedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>

                  {selectedIncident.customerEvidenceSubmittedAt ? (
                    <>
                      <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                        <span>
                          Pengirim: <strong className="text-slate-900">{selectedIncident.customerClaimantName}</strong>
                        </span>
                        <span className="font-mono">{selectedIncident.customerClaimantPhone}</span>
                      </div>

                      <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-slate-800 leading-relaxed">
                        {selectedIncident.customerEvidenceNotes}
                      </div>

                      <div>
                        <div className="text-[11px] font-bold text-slate-500 mb-1.5">Foto Bukti Klien</div>
                        {Array.isArray(selectedIncident.customerEvidencePhotos) &&
                        selectedIncident.customerEvidencePhotos.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedIncident.customerEvidencePhotos.map((url, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setPreviewPhoto(url)}
                                className="w-16 h-16 rounded-xl overflow-hidden border border-blue-200 hover:ring-2 hover:ring-blue-900 transition-all cursor-pointer"
                              >
                                <img src={url} alt={`Bukti Klien ${idx + 1}`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">Klien tidak melampirkan foto.</p>
                        )}
                      </div>

                      {selectedIncident.customerBankInfo && (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold text-slate-500 uppercase">
                              Info Rekening Klien
                            </div>
                            <div className="font-bold text-slate-900 text-xs mt-0.5">
                              {selectedIncident.customerBankInfo.bankName} •{' '}
                              <span className="font-mono">{selectedIncident.customerBankInfo.accountNumber}</span>
                            </div>
                            <div className="text-[11px] text-slate-600">
                              a.n. {selectedIncident.customerBankInfo.accountHolder}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              copyTextWithFeedback(
                                selectedIncident.customerBankInfo!.accountNumber,
                                `bank-${selectedIncident.id}`,
                                'Nomor rekening klien berhasil disalin!'
                              )
                            }
                            className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            {copiedKey === `bank-${selectedIncident.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>Salin Rek</span>
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                      <p className="text-xs text-amber-900 leading-relaxed">
                        Pelanggan belum mengisi form klaim &amp; bukti publik. Bagikan tautan di bawah ini agar bukti pelanggan tercatat sebelum penyelesaian dicairkan.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={generatingToken}
                          onClick={() => handleCopyClaimLink(selectedIncident)}
                          className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {copiedKey === `link-${selectedIncident.id}` ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                          <span>Salin Link Form Klaim</span>
                        </button>
                        <button
                          type="button"
                          disabled={generatingToken}
                          onClick={() => handleSendClaimWhatsApp(selectedIncident)}
                          className="min-h-[40px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Kirim Form Klaim via WA</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* PANEL PENYELESAIAN INSIDEN */}
              {selectedIncident.settledAt ? (
                /* Kartu Penyelesaian Terkunci (Read-Only) */
                <div className="bg-emerald-50/80 rounded-2xl border border-emerald-200 p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-emerald-200/80">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <FileCheck2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-emerald-950 text-sm">
                          Penyelesaian Insiden Terkunci (Berita Acara Sah)
                        </h4>
                        <p className="text-[11px] text-emerald-800">
                          Disahkan pada{' '}
                          {new Date(selectedIncident.settledAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSendSettlementWhatsApp(selectedIncident)}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Kirim Berita Acara via WA</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-xl bg-white border border-emerald-200/70">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Cuci Ulang (Rewash)</div>
                      <div className="font-extrabold text-slate-900 mt-0.5">
                        {selectedIncident.rewashTriggered ? 'Ya (Rp 0)' : 'Tidak'}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-emerald-200/70">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Refund Biaya Cuci</div>
                      <div className="font-extrabold text-slate-900 mt-0.5 tabular-nums">
                        Rp {Number(selectedIncident.refundAmount || 0).toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-emerald-200/70">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Kompensasi Barang</div>
                      <div className="font-extrabold text-rose-700 mt-0.5 tabular-nums">
                        Rp {Number(selectedIncident.approvedCompensation || 0).toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-emerald-200/70">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Metode Pencairan</div>
                      <div className="font-extrabold text-slate-900 mt-0.5">
                        {selectedIncident.payoutMethod
                          ? PAYOUT_METHOD_LABELS[selectedIncident.payoutMethod] || selectedIncident.payoutMethod
                          : 'Tanpa Pencairan Dana'}
                      </div>
                      {selectedIncident.payoutReference && (
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          Ref: {selectedIncident.payoutReference}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedIncident.resolutionNotes && (
                    <div className="p-3 rounded-xl bg-white border border-emerald-200/70">
                      <div className="text-[11px] font-bold text-slate-600 mb-0.5">Berita Acara / Catatan Penyelesaian</div>
                      <p className="text-slate-800 leading-relaxed">{selectedIncident.resolutionNotes}</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Panel Form Penyelesaian (Khusus Owner / Admin / Supervisor) */
                <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">
                        Panel Penyelesaian Insiden Terpadu
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Kombinasikan Garansi Cuci Ulang, Refund Biaya Cuci, dan Kompensasi Ganti Rugi Barang secara atomik.
                      </p>
                    </div>
                  </div>

                  {!canSettle ? (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>
                        Hanya <strong>Owner, Admin, atau Supervisor</strong> yang berwenang mengesahkan dan mencairkan penyelesaian insiden.
                      </span>
                    </div>
                  ) : (
                    <>
                      {/* 1. Checkbox Garansi Cuci Ulang (Rewash Rp 0) */}
                      <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-blue-200/80 bg-blue-50/40 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={triggerRewash}
                          onChange={(e) => setTriggerRewash(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900 cursor-pointer shrink-0"
                        />
                        <div className="space-y-0.5">
                          <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                            <RotateCcw className="w-3.5 h-3.5 text-blue-900 shrink-0" />
                            <span>Garansi Cuci Ulang (Rewash Rp 0)</span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            Order akan otomatis kembali ke antrean produksi (tahap Spotting/Cuci) tanpa mengubah nilai omzet nota.
                          </p>
                        </div>
                      </label>

                      {/* 2. Refund Biaya Cuci & Kompensasi Barang */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <CurrencyInput
                            label="Refund Biaya Cuci (Rp)"
                            value={refundAmount}
                            onChange={(val) => setRefundAmount(val)}
                            placeholder="0"
                          />
                          <div className="flex items-center justify-between text-[11px] px-1">
                            <span className="text-slate-500">
                              Maks. Refund: <strong className="text-slate-800">Rp {selectedMaxRefund.toLocaleString('id-ID')}</strong>
                            </span>
                            {selectedMaxRefund > 0 && (
                              <button
                                type="button"
                                onClick={() => setRefundAmount(selectedMaxRefund)}
                                className="text-blue-900 font-bold hover:underline cursor-pointer"
                              >
                                Isi Maksimal
                              </button>
                            )}
                          </div>
                          {refundAmount > selectedMaxRefund && (
                            <p className="text-[11px] text-rose-600 font-semibold px-1">
                              Melebihi batas maksimal refund (Rp {selectedMaxRefund.toLocaleString('id-ID')}).
                            </p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <CurrencyInput
                            label="Kompensasi Ganti Rugi Barang (Rp)"
                            value={compensationAmount}
                            onChange={(val) => setCompensationAmount(val)}
                            placeholder="0"
                          />
                          <p className="text-[11px] text-slate-500 px-1">
                            Referensi S&amp;K umum: 5x–10x ongkos cuci (Saran nota: Rp{' '}
                            {Number(selectedIncident.estimatedCompensation || 0).toLocaleString('id-ID')}).
                          </p>
                        </div>
                      </div>

                      {/* 3. Pemilih Metode Pencairan (jika Total Refund + Kompensasi > 0) */}
                      {totalSettlementCashOut > 0 && (
                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                          <div className="text-xs font-extrabold text-slate-900">
                            Metode Pencairan Dana (Total: Rp {totalSettlementCashOut.toLocaleString('id-ID')})
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <button
                              type="button"
                              onClick={() => setPayoutMethod('CASH_DRAWER')}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                payoutMethod === 'CASH_DRAWER'
                                  ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 font-extrabold text-xs">
                                <Banknote className="w-4 h-4 shrink-0" />
                                <span>Kas Laci Kasir</span>
                              </div>
                              <p className={`text-[10px] mt-1 ${payoutMethod === 'CASH_DRAWER' ? 'text-blue-100' : 'text-slate-500'}`}>
                                Potong kas shift kasir aktif &amp; tercatat di Z-Report
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPayoutMethod('BANK_TRANSFER')}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                payoutMethod === 'BANK_TRANSFER'
                                  ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 font-extrabold text-xs">
                                <Building2 className="w-4 h-4 shrink-0" />
                                <span>Transfer Bank / Kas Pusat</span>
                              </div>
                              <p className={`text-[10px] mt-1 ${payoutMethod === 'BANK_TRANSFER' ? 'text-blue-100' : 'text-slate-500'}`}>
                                Dicairkan dari rekening/kas pusat dengan bukti referensi
                              </p>
                            </button>

                            <button
                              type="button"
                              disabled={!hasCustomerId}
                              onClick={() => hasCustomerId && setPayoutMethod('CUSTOMER_WALLET')}
                              className={`p-3 rounded-xl border text-left transition-all ${
                                !hasCustomerId
                                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-70'
                                  : payoutMethod === 'CUSTOMER_WALLET'
                                  ? 'bg-blue-900 text-white border-blue-900 shadow-xs cursor-pointer'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 font-extrabold text-xs">
                                <Wallet className="w-4 h-4 shrink-0" />
                                <span>Saldo Deposit Pelanggan</span>
                              </div>
                              <p
                                className={`text-[10px] mt-1 ${
                                  !hasCustomerId
                                    ? 'text-slate-400'
                                    : payoutMethod === 'CUSTOMER_WALLET'
                                    ? 'text-blue-100'
                                    : 'text-slate-500'
                                }`}
                              >
                                {hasCustomerId
                                  ? 'Masuk otomatis ke dompet deposit pelanggan'
                                  : 'Tidak tersedia: order belum tertaut ke data pelanggan'}
                              </p>
                            </button>
                          </div>

                          {payoutMethod === 'BANK_TRANSFER' && (
                            <div className="space-y-2 pt-1">
                              {selectedIncident.customerBankInfo && (
                                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-950">
                                  Rekening Tujuan Klien: <strong>{selectedIncident.customerBankInfo.bankName}</strong>{' '}
                                  <span className="font-mono font-bold">{selectedIncident.customerBankInfo.accountNumber}</span>{' '}
                                  (a.n. {selectedIncident.customerBankInfo.accountHolder})
                                </div>
                              )}
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  No. Referensi / Bukti Transfer (Disarankan)
                                </label>
                                <input
                                  type="text"
                                  value={payoutReference}
                                  onChange={(e) => setPayoutReference(e.target.value)}
                                  placeholder="Contoh: TRF-BCA-20261128-001"
                                  className="w-full min-h-[40px] px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 4. Catatan Penyelesaian / Berita Acara */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Catatan Penyelesaian / Berita Acara <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          rows={3}
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          placeholder="Contoh: Disepakati garansi cuci ulang + kompensasi ganti rugi via transfer, pelanggan menyetujui Berita Acara."
                          className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-900"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Sticky Footer Detail */}
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="text-xs font-bold text-slate-700 text-center sm:text-left">
                {selectedIncident.settledAt ? (
                  <span className="text-emerald-700 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Total dicairkan: Rp {(Number(selectedIncident.refundAmount || 0) + Number(selectedIncident.approvedCompensation || 0)).toLocaleString('id-ID')}</span>
                  </span>
                ) : (
                  <span>
                    Total Pencairan:{' '}
                    <strong className="text-blue-950">Rp {totalSettlementCashOut.toLocaleString('id-ID')}</strong>
                    {triggerRewash && ' + Cuci Ulang Rp 0'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSelectedIncident(null)}
                  className="min-h-[44px] sm:h-10 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Kembali
                </button>
                {!selectedIncident.settledAt && canSettle ? (
                  <button
                    type="button"
                    disabled={settling}
                    onClick={handleSettleIncident}
                    className="min-h-[44px] sm:h-10 px-5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-md shadow-blue-900/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {settling && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Selesaikan &amp; Cairkan</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[44px] sm:h-10 px-5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs cursor-pointer"
                  >
                    Tutup
                  </button>
                )}
              </div>
            </div>
          </>
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
                aria-label="Tutup pratinjau"
                className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full hover:bg-black/90 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
