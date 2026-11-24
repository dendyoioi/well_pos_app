/**
 * Outlet Target Modal
 * Laundry Outlet Performance Intelligence (Well POS) - Wave 2
 * 
 * Form modal kanonikal khusus OWNER untuk penetapan dan monitoring target bisnis
 * bulanan per outlet (Target Omzet, Target Laba, Target Tonase, Target Nota, Pelanggan Baru).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Target,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { CurrencyInput } from '../../../ui/CurrencyInput';
import { useDialog } from '../../../../context/DialogContext';
import {
  fetchOutletTargets,
  upsertOutletTarget,
  deleteOutletTarget,
} from '../../../../services/laundryAnalyticsApi';
import type {
  OutletBusinessTargetItem,
} from '../../../../types/laundryAnalytics';

export interface OutletTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOutletId?: string | null;
  outlets?: Array<{ id: string; name: string }>;
  userRole?: string;
  onSuccess?: () => void;
}

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export const OutletTargetModal: React.FC<OutletTargetModalProps> = ({
  isOpen,
  onClose,
  activeOutletId,
  outlets = [],
  userRole = 'OWNER',
  onSuccess,
}) => {
  const dialog = useDialog();
  const isOwner = userRole === 'OWNER';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // View state: 'FORM' | 'LIST'
  const [activeTab, setActiveTab] = useState<'FORM' | 'LIST'>('FORM');

  // Form State
  const [outletId, setOutletId] = useState<string>('');
  const [periodYear, setPeriodYear] = useState<number>(currentYear);
  const [periodMonth, setPeriodMonth] = useState<number>(currentMonth);
  const [targetRevenue, setTargetRevenue] = useState<number>(0);
  const [targetProfit, setTargetProfit] = useState<number>(0);
  const [targetWeightKg, setTargetWeightKg] = useState<number>(0);
  const [targetOrdersCount, setTargetOrdersCount] = useState<number>(0);
  const [targetNewCustomers, setTargetNewCustomers] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Targets List State
  const [targets, setTargets] = useState<OutletBusinessTargetItem[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(false);

  // Inisialisasi outlet
  useEffect(() => {
    if (isOpen) {
      if (activeOutletId && activeOutletId !== 'ALL') {
        setOutletId(activeOutletId);
      } else if (outlets.length > 0) {
        setOutletId(outlets[0].id);
      }
    }
  }, [isOpen, activeOutletId, outlets]);

  const loadTargets = useCallback(async () => {
    if (!isOpen) return;
    try {
      setLoadingList(true);
      const res = await fetchOutletTargets({
        outletId: outletId && outletId !== 'ALL' ? outletId : undefined,
      });
      setTargets(res || []);
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal memuat target bisnis outlet', 'error');
    } finally {
      setLoadingList(false);
    }
  }, [isOpen, outletId, dialog]);

  useEffect(() => {
    if (isOpen) {
      loadTargets();
    }
  }, [isOpen, loadTargets]);

  // Otomatis pre-fill form jika kombinasi (outletId, periodYear, periodMonth) sudah tersimpan
  useEffect(() => {
    if (!outletId || !isOpen) return;
    const existing = targets.find(
      (t) =>
        t.outletId === outletId &&
        t.periodYear === periodYear &&
        t.periodMonth === periodMonth
    );

    if (existing) {
      setTargetRevenue(Number(existing.targetRevenue));
      setTargetProfit(Number(existing.targetProfit));
      setTargetWeightKg(Number(existing.targetWeightKg));
      setTargetOrdersCount(existing.targetOrdersCount);
      setTargetNewCustomers(existing.targetNewCustomers);
      setNotes(existing.notes || '');
    }
  }, [outletId, periodYear, periodMonth, targets, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isOwner) {
      dialog.toast('Akses ditolak: Hanya peran OWNER yang diizinkan mengatur target bisnis', 'error');
      return;
    }

    if (!outletId) {
      dialog.toast('Harap pilih outlet terlebih dahulu', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await upsertOutletTarget({
        outletId,
        periodYear,
        periodMonth,
        targetRevenue,
        targetProfit,
        targetWeightKg,
        targetOrdersCount,
        targetNewCustomers,
        notes: notes.trim() || undefined,
      });

      dialog.toast(`Target bisnis untuk ${MONTH_NAMES[periodMonth - 1]} ${periodYear} berhasil disimpan!`, 'success');
      loadTargets();
      setActiveTab('LIST');
      onSuccess?.();
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal menyimpan target bisnis', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditInline = (item: OutletBusinessTargetItem) => {
    setOutletId(item.outletId);
    setPeriodYear(item.periodYear);
    setPeriodMonth(item.periodMonth);
    setTargetRevenue(Number(item.targetRevenue));
    setTargetProfit(Number(item.targetProfit));
    setTargetWeightKg(Number(item.targetWeightKg));
    setTargetOrdersCount(item.targetOrdersCount);
    setTargetNewCustomers(item.targetNewCustomers);
    setNotes(item.notes || '');
    setActiveTab('FORM');
  };

  const handleDeleteInline = async (item: OutletBusinessTargetItem) => {
    if (!isOwner) {
      dialog.toast('Hanya peran OWNER yang diizinkan menghapus target', 'error');
      return;
    }

    const confirmed = await dialog.confirm({
      title: 'Hapus Target Bisnis',
      message: `Hapus target outlet untuk periode ${MONTH_NAMES[item.periodMonth - 1]} ${item.periodYear}?`,
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      await deleteOutletTarget(item.id);
      dialog.toast('Target bisnis berhasil dihapus', 'success');
      loadTargets();
      onSuccess?.();
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal menghapus target bisnis', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
      <div className="w-full sm:max-w-4xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-black">
              <Target className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-sm">Target Bisnis Bulanan Outlet</h3>
                {!isOwner && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    Read-Only (Non-Owner)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Tolok ukur pencapaian performa bulanan untuk Multi-Outlet Benchmark &amp; Health Score
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 shrink-0 gap-2">
          {isOwner && (
            <button
              type="button"
              onClick={() => setActiveTab('FORM')}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'FORM'
                  ? 'bg-white text-blue-900 border-t border-x border-slate-200 shadow-2xs font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Atur Target Baru</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('LIST')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'LIST'
                ? 'bg-white text-blue-900 border-t border-x border-slate-200 shadow-2xs font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Daftar Target Aktif</span>
          </button>
        </div>

        {/* Body Scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 bg-white">
          {!isOwner && activeTab === 'FORM' ? (
            <div className="p-8 text-center max-w-md mx-auto">
              <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <h4 className="font-black text-slate-900 text-sm">Akses Khusus Pemilik Usaha (OWNER)</h4>
              <p className="text-xs text-slate-500 mt-1">
                Pengaturan target finansial dan operasional hanya dapat dikonfigurasi oleh akun Owner. Anda dapat melihat daftar target aktif di tab "Daftar Target Aktif".
              </p>
            </div>
          ) : activeTab === 'FORM' ? (
            <form id="outlet-target-form" onSubmit={handleSubmit} className="space-y-4 max-w-2xl mx-auto">
              {/* Outlet & Periode (Bulan / Tahun) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Outlet / Toko <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={outletId}
                      onChange={(e) => setOutletId(e.target.value)}
                      required
                      className="w-full appearance-none pr-10 pl-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none transition-colors"
                    >
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bulan Target <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={periodMonth}
                      onChange={(e) => setPeriodMonth(parseInt(e.target.value))}
                      required
                      className="w-full appearance-none pr-10 pl-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none transition-colors"
                    >
                      {MONTH_NAMES.map((name, idx) => (
                        <option key={idx + 1} value={idx + 1}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tahun Target <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={periodYear}
                      onChange={(e) => setPeriodYear(parseInt(e.target.value))}
                      required
                      className="w-full appearance-none pr-10 pl-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none transition-colors"
                    >
                      {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              {/* Target Finansial (CurrencyInput kanonikal) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <CurrencyInput
                    label="Target Omzet Penjualan (Rp)"
                    value={targetRevenue}
                    onChange={(numericVal) => setTargetRevenue(numericVal)}
                    placeholder="0"
                    helperText="Target penerimaan kotor bulan ini"
                  />
                </div>

                <div>
                  <CurrencyInput
                    label="Target Laba Operasional (Rp)"
                    value={targetProfit}
                    onChange={(numericVal) => setTargetProfit(numericVal)}
                    placeholder="0"
                    helperText="Target profit setelah HPP & OPEX"
                  />
                </div>
              </div>

              {/* Target Operasional & Pelanggan */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Tonase (Kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={targetWeightKg || ''}
                    onChange={(e) => setTargetWeightKg(parseFloat(e.target.value) || 0)}
                    placeholder="Contoh: 1500"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Transaksi (Nota)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={targetOrdersCount || ''}
                    onChange={(e) => setTargetOrdersCount(parseInt(e.target.value) || 0)}
                    placeholder="Contoh: 300"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pelanggan Baru
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={targetNewCustomers || ''}
                    onChange={(e) => setTargetNewCustomers(parseInt(e.target.value) || 0)}
                    placeholder="Contoh: 40"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Catatan Strategis */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Strategis / Rencana Aksi
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Fokus promosi bundle cuci selimut & sebar brosur di perumahan sekitar"
                  rows={2}
                  className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none transition-colors"
                />
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {loadingList ? (
                <div className="py-12 text-center text-xs font-semibold text-slate-400 animate-pulse">
                  Memuat data target outlet...
                </div>
              ) : targets.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium border border-dashed border-slate-200 rounded-2xl">
                  Belum ada target bisnis yang ditetapkan.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-3.5">Periode</th>
                        <th className="py-3 px-3">Outlet</th>
                        <th className="py-3 px-3">Target Omzet</th>
                        <th className="py-3 px-3">Target Laba</th>
                        <th className="py-3 px-3">Tonase</th>
                        <th className="py-3 px-3">Transaksi</th>
                        <th className="py-3 px-3">Pelanggan Baru</th>
                        {isOwner && <th className="py-3 px-3 text-right">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {targets.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3.5 whitespace-nowrap font-bold text-slate-900">
                            {MONTH_NAMES[item.periodMonth - 1]} {item.periodYear}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap text-slate-600 font-semibold">
                            {item.outlet?.name || '-'}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap font-black text-blue-900">
                            {formatRupiah(Number(item.targetRevenue))}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap font-bold text-emerald-700">
                            {formatRupiah(Number(item.targetProfit))}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap text-slate-700">
                            {Number(item.targetWeightKg).toLocaleString('id-ID')} Kg
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap text-slate-700">
                            {item.targetOrdersCount} Nota
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap text-slate-700">
                            +{item.targetNewCustomers}
                          </td>
                          {isOwner && (
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleEditInline(item)}
                                  className="p-1 rounded-lg hover:bg-blue-50 text-blue-900 transition-colors cursor-pointer"
                                  title="Edit Target"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteInline(item)}
                                  className="p-1 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                                  title="Hapus Target"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Tutup
          </button>

          {isOwner && activeTab === 'FORM' && (
            <button
              type="submit"
              form="outlet-target-form"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Target Bisnis'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default OutletTargetModal;
