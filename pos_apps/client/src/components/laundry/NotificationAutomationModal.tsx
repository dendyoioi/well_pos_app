import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Bell,
  Settings,
  ListFilter,
  CheckCircle2,
  AlertCircle,
  Send,
  RotateCw,
  Info,
  Check,
  AlertTriangle,
  ArrowLeft,
  Eye,
  Smartphone,
} from 'lucide-react';
import { authStorage, laundryCore3Api } from '../../services/api';
import { WhatsAppInput, WhatsAppChatPreview } from '../ui';
import { buildWhatsAppUrl } from '../../utils/phone';
import type {
  NotificationAutomationRuleItem,
  NotificationDispatchLogItem,
  CanonicalEventKey,
  NotificationChannel,
} from '../../types/laundry_core3';

interface NotificationAutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOutlet?: { id: string; name: string; phone?: string | null } | null;
}

const renderPreviewMessage = (
  template: string,
  recipientName: string,
  outletName: string
): string => {
  if (!template) return '';
  const sampleVars: Record<string, string> = {
    customerName: recipientName.trim() || 'Pelanggan Uji Coba',
    outletName: outletName || 'Well POS Laundry',
    invoiceNumber: 'INV-SIM-001',
    estimatedReadyAt: new Date(Date.now() + 24 * 3600 * 1000).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
    rackCode: 'RAK-A-01',
    requestCode: 'PKP-SIM-001',
    courierName: 'Kurir Well POS',
    courierPhone: '+6281234567890',
    referenceCode: 'PKP-SIM-001',
    reason: 'Penerima tidak berada di lokasi',
    rescheduledAt: new Date(Date.now() + 24 * 3600 * 1000).toLocaleString('id-ID'),
    remainingQuota: '10 kg',
    expiryDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toLocaleDateString('id-ID'),
  };
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => sampleVars[key] ?? '');
};

export const NotificationAutomationModal: React.FC<NotificationAutomationModalProps> = ({
  isOpen,
  onClose,
  activeOutlet,
}) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'logs'>('rules');

  // Rules state
  const [rules, setRules] = useState<NotificationAutomationRuleItem[]>([]);
  const [loadingRules, setLoadingRules] = useState<boolean>(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [simulatingKey, setSimulatingKey] = useState<string | null>(null);

  // Interactive Simulator state
  const [simRule, setSimRule] = useState<NotificationAutomationRuleItem | null>(null);
  const [simRecipientName, setSimRecipientName] = useState<string>('Pelanggan Uji Coba');
  const [simRecipientPhone, setSimRecipientPhone] = useState<string>('+6281234567890');
  const [simSendRealTest, setSimSendRealTest] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<{
    status: string;
    renderedMessage: string;
    summaryText: string;
    error?: string;
  } | null>(null);

  // Logs state
  const [logs, setLogs] = useState<NotificationDispatchLogItem[]>([]);
  const [logSummary, setLogSummary] = useState({
    total: 0,
    totalSent: 0,
    totalFailed: 0,
    totalSkipped: 0,
  });
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);

  // Toast / feedback message
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const loadRules = async () => {
    try {
      setLoadingRules(true);
      const res = await laundryCore3Api.getAutomationRules(activeOutlet?.id);
      if (res.status === 'success' && Array.isArray(res.data)) {
        setRules(res.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingRules(false);
    }
  };

  const loadLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await laundryCore3Api.getNotificationLogs({
        outletId: activeOutlet?.id,
        status: statusFilter,
      });
      if (res.status === 'success' && res.data) {
        setLogs(res.data);
        if (res.summary) {
          setLogSummary(res.summary);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'rules') {
        loadRules();
      } else {
        loadLogs();
      }
    } else {
      setSimRule(null);
      setSimResult(null);
    }
  }, [isOpen, activeTab, statusFilter, activeOutlet?.id]);

  const handleToggleRule = (key: CanonicalEventKey) => {
    setRules((prev) =>
      prev.map((r) => (r.eventKey === key ? { ...r, isEnabled: !r.isEnabled } : r))
    );
  };

  const handleToggleChannel = (key: CanonicalEventKey, channel: NotificationChannel) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.eventKey !== key) return r;
        const exists = r.channels.includes(channel);
        const nextChannels = exists
          ? r.channels.filter((c) => c !== channel)
          : [...r.channels, channel];
        if (nextChannels.length === 0) return r; // minimal 1 channel
        return { ...r, channels: nextChannels };
      })
    );
  };

  const handleTemplateChange = (key: CanonicalEventKey, text: string) => {
    setRules((prev) =>
      prev.map((r) => (r.eventKey === key ? { ...r, messageTemplate: text } : r))
    );
  };

  const handleSaveRule = async (rule: NotificationAutomationRuleItem) => {
    try {
      setSavingKey(rule.eventKey);
      const res = await laundryCore3Api.updateAutomationRule(rule.eventKey, {
        outletId: activeOutlet?.id || null,
        isEnabled: rule.isEnabled,
        channels: rule.channels,
        messageTemplate: rule.messageTemplate,
      });
      if (res.status === 'success') {
        showToast(`Aturan otomasi ${rule.eventKey} berhasil diperbarui!`);
      } else {
        showToast(res.message || 'Gagal menyimpan aturan', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menyimpan aturan.', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleOpenSimulator = (rule: NotificationAutomationRuleItem) => {
    const activeUser = authStorage.getUser();
    const defaultPhoneRaw =
      activeOutlet?.phone ||
      (activeUser as { phone?: string } | null)?.phone ||
      '+6281234567890';
    setSimRecipientName(activeUser?.name || 'Pelanggan Uji Coba');
    setSimRecipientPhone(defaultPhoneRaw || '+6281234567890');
    setSimSendRealTest(false);
    setSimResult(null);
    setSimRule(rule);
  };

  const liveRenderedPreview = useMemo(() => {
    if (!simRule) return '';
    return renderPreviewMessage(
      simRule.messageTemplate,
      simRecipientName,
      activeOutlet?.name || 'Well POS Laundry'
    );
  }, [simRule, simRecipientName, activeOutlet?.name]);

  const handleExecuteSimulate = async () => {
    if (!simRule) return;
    if (simSendRealTest && !simRecipientPhone.trim()) {
      showToast('Masukkan nomor WhatsApp tujuan terlebih dahulu untuk mengirim tes manual.', 'error');
      return;
    }

    try {
      setSimulatingKey(simRule.eventKey);
      const res = await laundryCore3Api.simulateNotification({
        outletId: activeOutlet?.id || null,
        eventKey: simRule.eventKey,
        recipientName: simRecipientName.trim() || 'Pelanggan Uji Coba',
        recipientPhone: simRecipientPhone.trim() || null,
        messageTemplate: simRule.messageTemplate,
        channels: simRule.channels,
        sendRealTest: false,
      });

      if (simSendRealTest) {
        window.open(
          buildWhatsAppUrl(simRecipientPhone, liveRenderedPreview),
          '_blank',
          'noopener,noreferrer'
        );
      }

      if (res.status === 'success' && res.data && res.data.length > 0) {
        const firstLog = res.data[0];
        const rendered = res.renderedMessage || firstLog.messageBody || liveRenderedPreview;
        const failedLog = res.data.find((l) => l.status === 'FAILED');

        if (firstLog.status === 'SKIPPED') {
          setSimResult({
            status: 'SKIPPED',
            renderedMessage: rendered,
            summaryText: `[SIMULASI] Event ${simRule.eventKey} DI-SKIP karena saklar aturan dinonaktifkan.${simSendRealTest ? ' Chat wa.me tetap dibuka untuk pratinjau manual.' : ''}`,
          });
          showToast(`[SIMULASI] Event ${simRule.eventKey} DI-SKIP karena saklar dinonaktifkan.`, 'success');
        } else if (failedLog) {
          setSimResult({
            status: 'FAILED',
            renderedMessage: rendered,
            summaryText: `Pengiriman kanal ${failedLog.channel} gagal.`,
            error: failedLog.errorMessage || 'Periksa nomor tujuan.',
          });
          showToast(failedLog.errorMessage || 'Sebagian kanal gagal dicatat.', 'error');
        } else {
          const modeText = simSendRealTest ? 'TES MANUAL WA' : 'SIMULASI';
          setSimResult({
            status: 'SENT',
            renderedMessage: rendered,
            summaryText: simSendRealTest
              ? `[${modeText}] Log simulasi event ${simRule.eventKey} tercatat & chat WhatsApp dibuka.`
              : `[${modeText}] Event ${simRule.eventKey} dicatat ke riwayat log (${res.data.map((l) => l.channel).join(', ')}).`,
          });
          showToast(
            simSendRealTest
              ? 'Log tersimpan & WhatsApp dibuka ke nomor tujuan!'
              : `[${modeText}] Event ${simRule.eventKey} tercatat di riwayat log!`,
            'success'
          );
        }
        loadLogs();
      } else {
        showToast(res.message || 'Simulasi notifikasi selesai.', res.status === 'error' ? 'error' : 'success');
      }
    } catch {
      showToast('Gagal menjalankan simulasi notifikasi.', 'error');
    } finally {
      setSimulatingKey(null);
    }
  };

  const handleRetryLog = async (logId: string) => {
    try {
      setRetryingLogId(logId);
      const res = await laundryCore3Api.retryNotificationLog(logId);
      if (res.status === 'success') {
        showToast('Notifikasi berhasil dikirim ulang (status: RETRIED)!');
        loadLogs();
      } else {
        showToast(res.message || 'Gagal mengirim ulang notifikasi', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan saat mencoba mengirim ulang.', 'error');
    } finally {
      setRetryingLogId(null);
    }
  };

  const renderEventFriendlyName = (key: CanonicalEventKey) => {
    switch (key) {
      case 'ORDER_CREATED':
        return 'Pesanan Diterima di Kasir';
      case 'ORDER_READY':
        return 'Pesanan Siap Diambil / Diantar';
      case 'ORDER_OVERDUE':
        return 'Peringatan SLA Waktu Penyelesaian Terlewat';
      case 'PICKUP_REQUEST_CONFIRMED':
        return 'Permintaan Jemput Dikonfirmasi / Kurir Ditugaskan';
      case 'DELIVERY_FAILED':
        return 'Percobaan Antar / Jemput Terkendala';
      case 'CUSTOMER_DORMANT_WINBACK':
        return 'Pengingat Pelanggan Lama Tidak Berkunjung (Winback)';
      case 'QUOTA_EXPIRING':
        return 'Pengingat Kuota / Saldo Paket Segera Berakhir';
      default:
        return key;
    }
  };

  const renderLogStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">Terkirim</span>;
      case 'FAILED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">Gagal</span>;
      case 'SKIPPED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">Di-skip (Off)</span>;
      case 'RETRIED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-900">Dikirim Ulang</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full sm:max-w-4xl rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[90vh] shadow-2xl flex flex-col flex-1 min-h-0 overflow-hidden animate-slideUp sm:animate-zoomIn">
        {/* HEADER MODAL */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/50 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-xs shrink-0">
              <Bell className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-slate-900 text-sm sm:text-lg leading-tight truncate">
                  Pusat Otomasi &amp; Notifikasi Pelanggan
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200 whitespace-nowrap shrink-0">
                  Core Phase 3
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {activeOutlet?.name || 'Seluruh Outlet Toko'} • Pengiriman pesan terintegrasi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TOAST NOTIFIKASI DALAM MODAL */}
        {toastMsg && (
          <div
            className={`p-3 text-xs font-semibold flex items-center gap-2 border-b shrink-0 ${
              toastMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {toastMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="break-words min-w-0">{toastMsg.text}</span>
          </div>
        )}

        {/* TAB NAVIGATION */}
        {!simRule && (
          <div className="flex border-b border-slate-200 bg-white px-4 pt-2 gap-2 shrink-0 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'rules'
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Aturan &amp; Template (7 Event)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'logs'
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ListFilter className="w-4 h-4 shrink-0" />
              <span>Riwayat Log Pengiriman ({logSummary.total})</span>
            </button>
          </div>
        )}

        {/* BODY KONTEN */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0 bg-slate-50/50 space-y-4">
          {simRule ? (
            /* MINI-PANEL INTERAKTIF: SIMULASI & UJI PENGIRIMAN */
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setSimRule(null);
                    setSimResult(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Kembali ke Daftar Aturan</span>
                </button>
                <span className="font-mono text-[11px] bg-blue-50 text-blue-900 px-2.5 py-1 rounded-lg border border-blue-200 font-bold">
                  {simRule.eventKey}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Simulasi Pengiriman Notifikasi — {renderEventFriendlyName(simRule.eventKey)}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Uji pratinjau isi pesan terkini dan pilih apakah hanya mencatat log simulasi atau mengirim WhatsApp tes nyata.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Nama Penerima Uji
                  </label>
                  <input
                    type="text"
                    value={simRecipientName}
                    onChange={(e) => setSimRecipientName(e.target.value)}
                    placeholder="Pelanggan Uji Coba"
                    className="w-full h-11 sm:h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-white"
                  />
                </div>

                <div>
                  <WhatsAppInput
                    label="Nomor WhatsApp Tujuan"
                    value={simRecipientPhone}
                    onChange={setSimRecipientPhone}
                    placeholder="81234567890"
                  />
                </div>
              </div>

              {/* Mode Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Mode Pengujian</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSimSendRealTest(false)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      !simSendRealTest
                        ? 'border-blue-900 bg-blue-50/70 ring-2 ring-blue-900/10'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Eye className="w-4 h-4 text-blue-900 shrink-0" />
                      <span>Simulasi Log &amp; Preview Saja</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Menguji aturan aktif/nonaktif &amp; mencatat log simulasi tanpa membuka aplikasi WhatsApp.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSimSendRealTest(true)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      simSendRealTest
                        ? 'border-emerald-700 bg-emerald-50/70 ring-2 ring-emerald-700/10'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Smartphone className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Kirim Tes Manual via WhatsApp (wa.me)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Mencatat log simulasi dan langsung membuka WhatsApp ke nomor tujuan dengan pesan hasil render.
                    </p>
                  </button>
                </div>
              </div>

              {/* Pratinjau Pesan Hasil Render (Antarmuka Chat WhatsApp) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Pratinjau Pesan WhatsApp</span>
                  <span className="text-[11px] text-slate-400">
                    Outlet: <strong className="text-slate-600">{activeOutlet?.name || 'Well POS Laundry'}</strong>
                  </span>
                </div>
                <WhatsAppChatPreview
                  senderName={activeOutlet?.name || 'Well POS Laundry'}
                  recipientLabel={simRecipientName || 'Pelanggan Uji Coba'}
                  recipientPhone={simRecipientPhone}
                  message={liveRenderedPreview || '(Template pesan kosong)'}
                />
              </div>

              {/* Hasil Pengujian Terakhir */}
              {simResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                    simResult.status === 'FAILED'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : simResult.status === 'SKIPPED'
                      ? 'bg-slate-100 border-slate-300 text-slate-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <div className="font-bold">{simResult.summaryText}</div>
                  {simResult.error && (
                    <div className="text-[11px] text-rose-700 font-semibold break-words">
                      Detail: {simResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'rules' ? (
            /* TAB 1: DAFTAR ATURAN & TEMPLATE */
            loadingRules ? (
              <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-3 border-blue-900 border-t-transparent rounded-full animate-spin" />
                <span>Memuat aturan notifikasi...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-blue-950 text-xs flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-900 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="font-bold">Variabel Template yang Didukung:</span>
                    <p className="text-slate-600 mt-0.5 break-words">
                      <code className="text-blue-900 bg-white px-1 py-0.5 rounded border">{'{{customerName}}'}</code>,{' '}
                      <code className="text-blue-900 bg-white px-1 py-0.5 rounded border">{'{{invoiceNumber}}'}</code>,{' '}
                      <code className="text-blue-900 bg-white px-1 py-0.5 rounded border">{'{{outletName}}'}</code>,{' '}
                      <code className="text-blue-900 bg-white px-1 py-0.5 rounded border">{'{{estimatedReadyAt}}'}</code>,{' '}
                      <code className="text-blue-900 bg-white px-1 py-0.5 rounded border">{'{{requestCode}}'}</code>,{' '}
                      <code className="text-blue-900 bg-white px-1 py-0.5 rounded border">{'{{courierName}}'}</code>,{' '}
                      <code className="text-blue-900 bg-white px-1 py-0.5 rounded border">{'{{reason}}'}</code>,{' '}
                      <code className="text-blue-900 bg-white px-1 py-0.5 rounded border">{'{{rescheduledAt}}'}</code>
                    </p>
                  </div>
                </div>

                {rules.map((rule) => (
                  <div
                    key={rule.eventKey}
                    className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs transition space-y-3.5 ${
                      rule.isEnabled ? 'border-slate-200' : 'border-slate-200/60 bg-slate-50/40 opacity-80'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* TOGGLE SWITCH */}
                        <button
                          type="button"
                          onClick={() => handleToggleRule(rule.eventKey)}
                          className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                            rule.isEnabled ? 'bg-blue-900' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                              rule.isEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-slate-900 text-sm">
                              {renderEventFriendlyName(rule.eventKey)}
                            </h3>
                            <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {rule.eventKey}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {rule.isEnabled ? 'Status: Aktif' : 'Status: Nonaktif (Pesan otomatis di-skip)'}
                          </p>
                        </div>
                      </div>

                      {/* CHANNELS CHECKBOXES */}
                      <div className="flex items-center flex-wrap gap-2 pl-14 sm:pl-0">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                          Kanal:
                        </span>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.channels.includes('WHATSAPP')}
                            onChange={() => handleToggleChannel(rule.eventKey, 'WHATSAPP')}
                            className="rounded text-blue-900 focus:ring-blue-900"
                          />
                          <span>WA</span>
                        </label>

                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.channels.includes('IN_APP')}
                            onChange={() => handleToggleChannel(rule.eventKey, 'IN_APP')}
                            className="rounded text-blue-900 focus:ring-blue-900"
                          />
                          <span>In-App</span>
                        </label>

                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.channels.includes('EMAIL')}
                            onChange={() => handleToggleChannel(rule.eventKey, 'EMAIL')}
                            className="rounded text-blue-900 focus:ring-blue-900"
                          />
                          <span>Email</span>
                        </label>
                      </div>
                    </div>

                    {/* TEXTAREA TEMPLATE */}
                    <div>
                      <textarea
                        rows={3}
                        value={rule.messageTemplate}
                        onChange={(e) => handleTemplateChange(rule.eventKey, e.target.value)}
                        placeholder="Ketik isi template pesan dengan variabel {{...}}"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900 font-sans"
                      />
                    </div>

                    {/* ACTIONS */}
                    <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleOpenSimulator(rule)}
                        className="h-10 sm:h-8 px-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Simulasi Kirim</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveRule(rule)}
                        disabled={savingKey === rule.eventKey}
                        className="h-10 sm:h-8 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {savingKey === rule.eventKey ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Menyimpan...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Simpan Aturan</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* TAB 2: RIWAYAT LOG PENGIRIMAN */
            <div className="space-y-4">
              {/* COUNTER & FILTER BAR */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider mr-1">Rekap:</span>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 font-bold rounded-lg border border-emerald-100">
                    {logSummary.totalSent} Terkirim
                  </span>
                  <span className="px-2.5 py-1 bg-rose-50 text-rose-800 font-bold rounded-lg border border-rose-100">
                    {logSummary.totalFailed} Gagal
                  </span>
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200">
                    {logSummary.totalSkipped} Di-skip
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-10 sm:h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-900 bg-white"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="SENT">Terkirim</option>
                    <option value="FAILED">Gagal</option>
                    <option value="SKIPPED">Di-skip (Off)</option>
                    <option value="RETRIED">Dikirim Ulang</option>
                  </select>
                </div>
              </div>

              {loadingLogs ? (
                <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-3 border-blue-900 border-t-transparent rounded-full animate-spin" />
                  <span>Memuat riwayat notifikasi...</span>
                </div>
              ) : logs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
                  <Bell className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">Belum Ada Riwayat Pengiriman</p>
                  <p className="text-xs text-slate-500">
                    Gunakan tombol "Simulasi Kirim" pada Tab Aturan untuk menguji template &amp; melihat log.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1.5 flex-1 text-xs min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {renderLogStatusBadge(item.status)}
                          <span className="font-mono text-[11px] font-bold bg-blue-50 text-blue-900 px-2 py-0.5 rounded">
                            {item.eventKey}
                          </span>
                          <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            Via {item.channel}
                          </span>
                          {item.retryCount > 0 && (
                            <span className="text-[11px] text-amber-700 font-medium">
                              (Percobaan ke-{item.retryCount + 1})
                            </span>
                          )}
                          <span className="text-slate-400 text-[11px] ml-auto">
                            {new Date(item.createdAt).toLocaleString('id-ID')}
                          </span>
                        </div>

                        <div className="text-slate-700">
                          Penerima:{' '}
                          <strong className="text-slate-900">{item.recipientName || 'Anonim'}</strong>{' '}
                          {item.recipientPhone ? `(${item.recipientPhone})` : ''}
                        </div>

                        <p className="text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2 font-mono text-[11px] whitespace-pre-wrap break-words">
                          {item.messageBody}
                        </p>

                        {item.errorMessage && (
                          <p className="text-rose-700 font-medium text-[11px] flex items-center gap-1 break-words">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Error: {item.errorMessage}</span>
                          </p>
                        )}
                      </div>

                      {item.status === 'FAILED' && (
                        <div className="shrink-0 pt-2 sm:pt-0">
                          <button
                            type="button"
                            onClick={() => handleRetryLog(item.id)}
                            disabled={retryingLogId === item.id}
                            className="h-10 sm:h-9 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <RotateCw
                              className={`w-3.5 h-3.5 ${retryingLogId === item.id ? 'animate-spin' : ''}`}
                            />
                            <span>{retryingLogId === item.id ? 'Mengirim...' : 'Kirim Ulang'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* STICKY ACTION FOOTER */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {simRule ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setSimRule(null);
                  setSimResult(null);
                }}
                className="h-11 sm:h-10 px-4 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Tutup Simulasi
              </button>
              <button
                type="button"
                disabled={simulatingKey === simRule.eventKey}
                onClick={handleExecuteSimulate}
                className={`h-11 sm:h-10 px-5 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer ${
                  simSendRealTest
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    : 'bg-blue-900 hover:bg-blue-800 shadow-blue-900/20'
                }`}
              >
                {simulatingKey === simRule.eventKey ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {simSendRealTest ? 'Buka & Kirim Tes di WhatsApp' : 'Jalankan Simulasi Log'}
                    </span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                {activeTab === 'rules'
                  ? 'Seluruh otomasi terkirim secara instan tanpa biaya token per order.'
                  : `Menampilkan ${logs.length} riwayat aktivitas notifikasi.`}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="h-11 sm:h-10 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationAutomationModal;
