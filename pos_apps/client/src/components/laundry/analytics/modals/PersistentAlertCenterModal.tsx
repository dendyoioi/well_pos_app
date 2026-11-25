/**
 * Persistent Alert Center Modal
 * Laundry Outlet Performance Intelligence (Well POS) - Wave 3A
 * 
 * Pusat Peringatan Dini & Konfigurasi Ambang Batas Operasional Kanonikal.
 * Mengikuti standar modal Well POS (mobile bottom-sheet max-h-[92dvh],
 * sticky header & safe-area footer, zero stacked modals, canonical TablePagination).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Sliders,
  MessageSquare,
  ChevronDown,
  Check,
  RefreshCw,
  Info,
} from 'lucide-react';
import { TablePagination } from '../../../TablePagination';
import { useDialog } from '../../../../context/DialogContext';
import {
  fetchPersistentAlerts,
  evaluatePersistentAlerts,
  updatePersistentAlertStatus,
  fetchAlertRules,
  upsertAlertRule,
} from '../../../../services/laundryAnalyticsApi';
import type {
  PersistentAlertItem,
  AlertRuleConfigItem,
  PersistentAlertsSummary,
} from '../../../../types/laundryAnalytics';

export interface PersistentAlertCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOutletId?: string | null;
  outlets?: Array<{ id: string; name: string }>;
  isOwner?: boolean;
  canSwitchOutlet?: boolean;
  userRole?: string;
  onSuccess?: () => void;
}

export function PersistentAlertCenterModal({
  isOpen,
  onClose,
  activeOutletId,
  outlets = [],
  isOwner = false,
  canSwitchOutlet = false,
  userRole = 'SUPERVISOR',
  onSuccess,
}: PersistentAlertCenterModalProps) {
  const { toast } = useDialog();

  // Active Tab: 'LIST' (Daftar Peringatan) | 'CONFIG' (Pengaturan Ambang Batas - Khusus Owner)
  const [activeTab, setActiveTab] = useState<'LIST' | 'CONFIG'>('LIST');

  // Filter States for List
  const [selectedOutlet, setSelectedOutlet] = useState<string>(activeOutletId || 'ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Data States for List
  const [alerts, setAlerts] = useState<PersistentAlertItem[]>([]);
  const [summary, setSummary] = useState<PersistentAlertsSummary>({
    openCriticalCount: 0,
    openWarningCount: 0,
    inProgressCount: 0,
    resolvedCount: 0,
    totalOpen: 0,
  });
  const [totalItems, setTotalItems] = useState<number>(0);
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [evaluating, setEvaluating] = useState<boolean>(false);

  // Resolution Notes Inline Form State
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [submittingStatus, setSubmittingStatus] = useState<boolean>(false);

  // Data States for Config (Tab 2)
  const [rules, setRules] = useState<AlertRuleConfigItem[]>([]);
  const [configOutlet, setConfigOutlet] = useState<string>('ALL');
  const [loadingRules, setLoadingRules] = useState<boolean>(false);
  const [savingRuleKey, setSavingRuleKey] = useState<string | null>(null);

  // Local draft values for rules editing
  const [draftRules, setDraftRules] = useState<
    Record<
      string,
      {
        warningThreshold: number;
        criticalThreshold: number;
        isEnabled: boolean;
        hasWhatsApp: boolean;
      }
    >
  >({});

  // Sinkronisasi outlet saat prop berubah
  useEffect(() => {
    if (activeOutletId) {
      setSelectedOutlet(activeOutletId);
      if (activeOutletId !== 'ALL') {
        setConfigOutlet(activeOutletId);
      }
    }
  }, [activeOutletId]);

  // Load Alerts List
  const loadAlerts = useCallback(async () => {
    if (!isOpen) return;
    setLoadingList(true);
    try {
      const res = await fetchPersistentAlerts({
        outletId: selectedOutlet === 'ALL' ? undefined : selectedOutlet,
        status: selectedStatus,
        severity: selectedSeverity,
        page: currentPage,
        limit: pageSize,
      });

      setAlerts(res.alerts || []);
      setSummary(
        res.summary || {
          openCriticalCount: 0,
          openWarningCount: 0,
          inProgressCount: 0,
          resolvedCount: 0,
          totalOpen: 0,
        }
      );
      setTotalItems(res.pagination?.totalItems || 0);
    } catch (err: any) {
      console.error('[LOAD ALERTS ERROR]', err);
      toast(err.message || 'Gagal memuat daftar alert', 'error');
    } finally {
      setLoadingList(false);
    }
  }, [isOpen, selectedOutlet, selectedStatus, selectedSeverity, currentPage, pageSize, toast]);

  // Load Rules Config
  const loadRules = useCallback(async () => {
    if (!isOpen || !isOwner) return;
    setLoadingRules(true);
    try {
      const res = await fetchAlertRules(configOutlet === 'ALL' ? undefined : configOutlet);
      setRules(res || []);

      // Inisialisasi draft rules
      const drafts: Record<string, any> = {};
      (res || []).forEach((r) => {
        drafts[r.ruleKey] = {
          warningThreshold: r.warningThreshold,
          criticalThreshold: r.criticalThreshold,
          isEnabled: r.isEnabled,
          hasWhatsApp: Array.isArray(r.notificationChannels) && r.notificationChannels.includes('WHATSAPP'),
        };
      });
      setDraftRules(drafts);
    } catch (err: any) {
      console.error('[LOAD RULES ERROR]', err);
      toast(err.message || 'Gagal memuat aturan alert', 'error');
    } finally {
      setLoadingRules(false);
    }
  }, [isOpen, isOwner, configOutlet, toast]);

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'LIST') {
        loadAlerts();
      } else if (activeTab === 'CONFIG') {
        loadRules();
      }
    }
  }, [isOpen, activeTab, loadAlerts, loadRules]);

  // Trigger Evaluasi Sekarang
  const handleEvaluateNow = async () => {
    if (evaluating) return;

    // Evaluasi membutuhkan target outlet spesifik atau ALL untuk Owner
    let targetOutletId = selectedOutlet;
    if (!targetOutletId || targetOutletId === 'ALL') {
      if (isOwner) {
        targetOutletId = 'ALL';
      } else if (outlets.length > 0) {
        targetOutletId = outlets[0].id;
      } else {
        toast('Pilih salah satu outlet spesifik untuk menjalankan evaluasi', 'error');
        return;
      }
    }

    setEvaluating(true);
    try {
      const res = await evaluatePersistentAlerts({
        outletId: targetOutletId,
        preset: 'month',
        triggerWa: true,
      });

      toast(
        `Evaluasi selesai! ${res.createdCount} anomali baru, ${res.updatedCount} diperbarui.`,
        'success'
      );
      await loadAlerts();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('[EVALUATE ERROR]', err);
      toast(err.message || 'Gagal menjalankan evaluasi alert', 'error');
    } finally {
      setEvaluating(false);
    }
  };

  // Ubah Status Alert (OPEN / IN_PROGRESS / RESOLVED / IGNORED)
  const handleUpdateStatus = async (
    alertId: string,
    newStatus: 'IN_PROGRESS' | 'RESOLVED' | 'IGNORED' | 'OPEN',
    notes?: string
  ) => {
    setSubmittingStatus(true);
    try {
      await updatePersistentAlertStatus(alertId, {
        status: newStatus,
        resolutionNotes: notes,
      });

      toast(`Status peringatan berhasil diubah ke ${newStatus}`, 'success');

      setResolvingAlertId(null);
      setResolutionNotes('');
      await loadAlerts();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('[UPDATE ALERT STATUS ERROR]', err);
      toast(err.message || 'Gagal memperbarui status peringatan', 'error');
    } finally {
      setSubmittingStatus(false);
    }
  };

  // Simpan Aturan Alert (Tab 2)
  const handleSaveRule = async (ruleKey: string) => {
    const draft = draftRules[ruleKey];
    if (!draft) return;

    setSavingRuleKey(ruleKey);
    try {
      const channels = ['IN_APP'];
      if (draft.hasWhatsApp) {
        channels.push('WHATSAPP');
      }

      await upsertAlertRule({
        outletId: configOutlet === 'ALL' ? null : configOutlet,
        ruleKey,
        warningThreshold: draft.warningThreshold,
        criticalThreshold: draft.criticalThreshold,
        isEnabled: draft.isEnabled,
        notificationChannels: channels,
      });

      toast(`Aturan ${ruleKey} berhasil disimpan`, 'success');
      await loadRules();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('[SAVE RULE ERROR]', err);
      toast(err.message || 'Gagal menyimpan aturan alert', 'error');
    } finally {
      setSavingRuleKey(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white w-full sm:max-w-4xl rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up sm:animate-scale-in">
        
        {/* Sticky Header */}
        <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900 shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Pusat Peringatan & Ambang Batas
                </h2>
                {summary.totalOpen > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                    {summary.totalOpen} Perlu Tindakan
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 line-clamp-1">
                Deteksi dini anomali operasional, finansial, dan eskalasi notifikasi WhatsApp Owner.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs Header */}
        <div className="px-5 pt-2 bg-slate-50 border-b border-slate-200 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('LIST')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'LIST'
                  ? 'border-blue-900 text-blue-900 bg-white rounded-t-xl'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Daftar Peringatan</span>
              {summary.totalOpen > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                  {summary.totalOpen}
                </span>
              )}
            </button>

            {isOwner && (
              <button
                type="button"
                onClick={() => setActiveTab('CONFIG')}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'CONFIG'
                    ? 'border-blue-900 text-blue-900 bg-white rounded-t-xl'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sliders className="w-4 h-4 text-blue-900" />
                <span>Pengaturan Ambang Batas</span>
              </button>
            )}
          </div>

          {activeTab === 'LIST' && (userRole === 'OWNER' || userRole === 'ADMIN') && (
            <button
              type="button"
              onClick={handleEvaluateNow}
              disabled={evaluating}
              className="mb-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
              <span>{evaluating ? 'Mengevaluasi...' : 'Evaluasi Sekarang'}</span>
            </button>
          )}
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
          
          {/* ================================================================= */}
          {/* TAB 1: DAFTAR PERINGATAN (LIST & RESOLUTION WORKFLOW) */}
          {/* ================================================================= */}
          {activeTab === 'LIST' && (
            <div className="space-y-4">
              {/* Filter Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                {/* Outlet Selector (Hanya jika diizinkan switch outlet & terdapat outlet) */}
                {canSwitchOutlet && outlets.length > 0 && (
                  <div className="relative">
                    <select
                      value={selectedOutlet}
                      onChange={(e) => {
                        setSelectedOutlet(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-900 appearance-none cursor-pointer"
                    >
                      <option value="ALL">Semua Outlet</option>
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                )}

                {/* Status Selector */}
                <div className="relative">
                  <select
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-900 appearance-none cursor-pointer"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="OPEN">Menunggu Tindakan (OPEN)</option>
                    <option value="IN_PROGRESS">Sedang Ditangani (IN_PROGRESS)</option>
                    <option value="RESOLVED">Selesai (RESOLVED)</option>
                    <option value="IGNORED">Diabaikan (IGNORED)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>

                {/* Severity Selector */}
                <div className="relative">
                  <select
                    value={selectedSeverity}
                    onChange={(e) => {
                      setSelectedSeverity(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-900 appearance-none cursor-pointer"
                  >
                    <option value="ALL">Semua Tingkat (Kritis & Waspada)</option>
                    <option value="CRITICAL">🚨 Kritis (CRITICAL)</option>
                    <option value="WARNING">⚠️ Peringatan (WARNING)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Alert Items Feed */}
              {loadingList ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-blue-900 animate-spin" />
                  <p className="text-xs text-slate-500 font-medium">Memuat data peringatan...</p>
                </div>
              ) : alerts.length === 0 ? (
                <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Tidak Ada Peringatan Aktif</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Kondisi operasional dan finansial berada dalam batas aman ambang batas yang ditentukan.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((item) => {
                    const isCritical = item.severity === 'CRITICAL';
                    const isOpenAlert = item.status === 'OPEN';
                    const isInProgress = item.status === 'IN_PROGRESS';
                    const isResolved = item.status === 'RESOLVED';
                    const isIgnored = item.status === 'IGNORED';

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isCritical
                            ? 'bg-rose-50/30 border-rose-200 hover:border-rose-300'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Header Baris Alert */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                isCritical
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {item.severity}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isOpenAlert
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : isInProgress
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : isResolved
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {item.status}
                            </span>
                            {item.outlet?.name && (
                              <span className="text-[11px] font-semibold text-slate-500">
                                • {item.outlet.name}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {new Date(item.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Title & Message */}
                        <h4 className="text-sm font-black text-slate-900 tracking-tight">
                          {item.title}
                        </h4>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {item.message}
                        </p>

                        {/* Metrik Box & WhatsApp Tag */}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
                          <div className="flex items-center gap-4 text-xs">
                            <div className="text-slate-600">
                              Nilai Terdeteksi: <strong className="text-slate-900">{Number(item.metricValue).toLocaleString('id-ID')}</strong>
                            </div>
                            <div className="text-slate-500">
                              Ambang Batas: <strong className="text-slate-700">{Number(item.thresholdValue).toLocaleString('id-ID')}</strong>
                            </div>
                          </div>

                          {item.waNotifiedAt && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>WA Terkirim ke Owner</span>
                            </div>
                          )}
                        </div>

                        {/* Resolving Information */}
                        {(isResolved || isIgnored) && (
                          <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Catatan Resolusi ({item.resolvedBy?.name || 'Kasir / Supervisor'}):</span>
                            </div>
                            <p className="text-slate-600 italic">
                              "{item.resolutionNotes || 'Diselesaikan tanpa catatan khusus.'}"
                            </p>
                          </div>
                        )}

                        {/* Inline Note Input for Resolution */}
                        {resolvingAlertId === item.id && (
                          <div className="mt-3 p-3 rounded-xl bg-blue-50/50 border border-blue-200 space-y-2 animate-fade-in">
                            <label className="block text-xs font-bold text-slate-800">
                              Catatan Tindakan / Solusi Penyelesaian:
                            </label>
                            <input
                              type="text"
                              value={resolutionNotes}
                              onChange={(e) => setResolutionNotes(e.target.value)}
                              placeholder="Contoh: Sudah restock deterjen 10L dari gudang / Shift kasir sudah diaudit ulang"
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-900"
                            />
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setResolvingAlertId(null);
                                  setResolutionNotes('');
                                }}
                                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                disabled={submittingStatus}
                                onClick={() => handleUpdateStatus(item.id, 'RESOLVED', resolutionNotes)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{submittingStatus ? 'Menyimpan...' : 'Tandai Selesai'}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        {resolvingAlertId !== item.id && (
                          <div className="mt-3 flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            {isOpenAlert && (
                              <button
                                type="button"
                                disabled={submittingStatus}
                                onClick={() => handleUpdateStatus(item.id, 'IN_PROGRESS')}
                                className="px-3 py-1.5 bg-white border border-blue-200 hover:bg-blue-50 text-blue-900 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                              >
                                Tangani (In Progress)
                              </button>
                            )}

                            {(isOpenAlert || isInProgress) && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResolvingAlertId(item.id);
                                    setResolutionNotes('');
                                  }}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Selesaikan</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={submittingStatus}
                                  onClick={() => handleUpdateStatus(item.id, 'IGNORED')}
                                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                >
                                  Abaikan
                                </button>
                              </>
                            )}

                            {(isResolved || isIgnored) && (
                              <button
                                type="button"
                                disabled={submittingStatus}
                                onClick={() => handleUpdateStatus(item.id, 'OPEN')}
                                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                              >
                                Buka Kembali
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Canonical Table Pagination */}
                  <TablePagination
                    currentPage={currentPage}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    itemLabel="peringatan"
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: PENGATURAN AMBANG BATAS (KHUSUS OWNER) */}
          {/* ================================================================= */}
          {activeTab === 'CONFIG' && isOwner && (
            <div className="space-y-4">
              {/* Outlet Context Selector for Rules */}
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Info className="w-5 h-5 text-blue-900 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-blue-950 uppercase tracking-wider">
                      Cakupan Konfigurasi Aturan
                    </h4>
                    <p className="text-xs text-blue-900/80 mt-0.5">
                      Pilih apakah aturan berlaku secara global untuk semua outlet atau disesuaikan khusus untuk outlet tertentu.
                    </p>
                  </div>
                </div>

                <div className="relative min-w-[200px]">
                  <select
                    value={configOutlet}
                    onChange={(e) => setConfigOutlet(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 bg-white border border-blue-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-900 appearance-none cursor-pointer"
                  >
                    <option value="ALL">🌐 Berlaku Global (Semua Outlet)</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        🏢 Khusus {o.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-blue-900 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Rules List / Table */}
              {loadingRules ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-blue-900 animate-spin" />
                  <p className="text-xs text-slate-500 font-medium">Memuat konfigurasi aturan...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map((rule) => {
                    const draft = draftRules[rule.ruleKey] || {
                      warningThreshold: rule.warningThreshold,
                      criticalThreshold: rule.criticalThreshold,
                      isEnabled: rule.isEnabled,
                      hasWhatsApp: false,
                    };
                    const isSaving = savingRuleKey === rule.ruleKey;

                    return (
                      <div
                        key={rule.ruleKey}
                        className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3"
                      >
                        {/* Header Aturan */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900">
                              {rule.label}
                            </span>
                            {rule.isFinancial && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                Finansial
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400 font-mono">
                              ({rule.ruleKey})
                            </span>
                          </div>

                          {/* Toggle Aktif */}
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                            <span>Status Aturan:</span>
                            <input
                              type="checkbox"
                              checked={draft.isEnabled}
                              onChange={(e) => {
                                setDraftRules((prev) => ({
                                  ...prev,
                                  [rule.ruleKey]: {
                                    ...draft,
                                    isEnabled: e.target.checked,
                                  },
                                }));
                              }}
                              className="w-4 h-4 text-blue-900 rounded-md border-slate-300 focus:ring-blue-900 cursor-pointer"
                            />
                            <span className={draft.isEnabled ? 'text-emerald-700' : 'text-slate-400'}>
                              {draft.isEnabled ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </label>
                        </div>

                        {/* Input Ambang Batas Warning & Critical */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                          {/* Warning Threshold */}
                          <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-amber-800">
                              Ambang Peringatan (Warning):
                            </label>
                            <div className="relative flex items-center">
                              <span className="absolute left-3 text-xs font-bold text-slate-400">
                                {rule.operator === 'LT' ? '<' : rule.operator === 'GT' ? '>' : '>='}
                              </span>
                              <input
                                type="number"
                                value={draft.warningThreshold}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setDraftRules((prev) => ({
                                    ...prev,
                                    [rule.ruleKey]: {
                                      ...draft,
                                      warningThreshold: val,
                                    },
                                  }));
                                }}
                                className="w-full pl-7 pr-12 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-900"
                              />
                              <span className="absolute right-3 text-xs font-semibold text-slate-400">
                                {rule.unit}
                              </span>
                            </div>
                          </div>

                          {/* Critical Threshold */}
                          <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-rose-800">
                              Ambang Kritis (Critical):
                            </label>
                            <div className="relative flex items-center">
                              <span className="absolute left-3 text-xs font-bold text-slate-400">
                                {rule.operator === 'LT' ? '<' : rule.operator === 'GT' ? '>' : '>='}
                              </span>
                              <input
                                type="number"
                                value={draft.criticalThreshold}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setDraftRules((prev) => ({
                                    ...prev,
                                    [rule.ruleKey]: {
                                      ...draft,
                                      criticalThreshold: val,
                                    },
                                  }));
                                }}
                                className="w-full pl-7 pr-12 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-900"
                              />
                              <span className="absolute right-3 text-xs font-semibold text-slate-400">
                                {rule.unit}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* WhatsApp Notification & Save Button */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={draft.hasWhatsApp}
                              onChange={(e) => {
                                setDraftRules((prev) => ({
                                  ...prev,
                                  [rule.ruleKey]: {
                                    ...draft,
                                    hasWhatsApp: e.target.checked,
                                  },
                                }));
                              }}
                              className="w-4 h-4 text-emerald-600 rounded-md border-slate-300 focus:ring-emerald-600 cursor-pointer"
                            />
                            <span className="flex items-center gap-1 text-slate-700">
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Kirim Notifikasi WA Kritis ke Owner</span>
                            </span>
                          </label>

                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleSaveRule(rule.ruleKey)}
                            className="px-3.5 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                          >
                            {isSaving ? 'Menyimpan...' : 'Simpan Aturan'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {activeTab === 'LIST' ? (
              <span>
                Total <strong className="text-slate-800">{totalItems}</strong> log peringatan tercatat
              </span>
            ) : (
              <span>
                10 aturan peringatan dini kanonikal Well POS
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
