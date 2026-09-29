import React, { useState, useEffect } from 'react';
import {
  Lock,
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileCheck,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api';
import type { Shift, ZReportData } from '../types/shift';
import { CurrencyInput } from './ui/CurrencyInput';

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShiftClosed: () => void;
  currentShift: Shift | null;
}

export const CloseShiftModal: React.FC<CloseShiftModalProps> = ({
  isOpen,
  onClose,
  onShiftClosed,
  currentShift,
}) => {
  const [actualCash, setActualCash] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [zReportData, setZReportData] = useState<ZReportData | null>(null);
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('80mm');

  // Kalkulasi data kasir saat ini
  const startingCash = currentShift ? Number(currentShift.startingCash) : 0;
  const cashSales = currentShift?.stats?.cashSalesTotal || 0;
  const totalCashOut = currentShift?.stats?.totalCashOut || 0;
  const totalCashIn = currentShift?.stats?.totalCashIn || 0;
  const expectedCash = currentShift?.stats?.expectedCash !== undefined
    ? currentShift.stats.expectedCash
    : (startingCash + cashSales + totalCashIn - totalCashOut);
  const difference = actualCash - expectedCash;

  useEffect(() => {
    if (isOpen) {
      setActualCash(expectedCash);
      setNotes('');
      setErrorMsg(null);
      setZReportData(null);
    }
  }, [isOpen, expectedCash]);

  if (!isOpen) return null;

  const handleSubmitClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actualCash < 0) {
      setErrorMsg('Nominal uang fisik tidak boleh negatif');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.closeShift({ actualCash, notes });
      if (res.status === 'success') {
        setZReportData(res.data);
      } else {
        setErrorMsg(res.message || 'Gagal menutup shift kasir');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleFinish = () => {
    onShiftClosed();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 text-white p-4 sm:p-5 flex items-center justify-between no-print shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-800/80 flex items-center justify-center text-blue-200">
              {zReportData ? (
                <FileCheck className="w-5 h-5 stroke-[2.5] text-emerald-300" />
              ) : (
                <Lock className="w-5 h-5 stroke-[2.5] text-amber-300" />
              )}
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-800/80 text-[10px] font-bold text-blue-200 uppercase tracking-wider mb-0.5">
                {zReportData ? 'Z-Report Selesai' : 'Tutup Shift Kasir'}
              </div>
              <h3 className="font-black text-base text-white">
                {zReportData ? 'Rekapitulasi Kas Akhir (Z-Report)' : 'Rekap Kas Fisik di Laci'}
              </h3>
            </div>
          </div>

          <button
            onClick={zReportData ? handleFinish : onClose}
            className="p-1.5 rounded-xl text-blue-200 hover:text-white hover:bg-blue-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        {!zReportData ? (
          /* Step 1: Input Uang Fisik Kasir */
          <form onSubmit={handleSubmitClose} className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1 overscroll-contain">
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Info Box Perhitungan Sistem */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Rekap Sistem Saat Ini
              </span>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Modal Awal Kas:</span>
                <span className="font-bold text-slate-900">
                  Rp {startingCash.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">(+) Penjualan Tunai:</span>
                <span className="font-bold text-emerald-700">
                  Rp {cashSales.toLocaleString('id-ID')}
                </span>
              </div>
              {totalCashIn > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">(+) Kas Masuk Tambahan:</span>
                  <span className="font-bold text-emerald-600">
                    Rp {totalCashIn.toLocaleString('id-ID')}
                  </span>
                </div>
              )}
              {totalCashOut > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-rose-600 font-semibold">(-) Pengeluaran Kasir (Kas Keluar):</span>
                  <span className="font-bold text-rose-600">
                    - Rp {totalCashOut.toLocaleString('id-ID')}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-xs pt-2 border-t border-slate-200 font-extrabold">
                <span className="text-slate-900">Total Seharusnya Ada di Laci:</span>
                <span className="text-sm text-blue-900">
                  Rp {expectedCash.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Input Fisik Uang di Laci */}
            <div>
              <CurrencyInput
                label="Hitungan Fisik Uang Tunai di Laci (Actual Cash)"
                value={actualCash}
                onChange={(val) => setActualCash(val)}
                inputClassName="py-3 text-lg font-black text-right tracking-tight bg-slate-50 border-2 border-slate-200 focus:bg-white rounded-2xl"
                prefixClassName="text-sm font-extrabold"
                placeholder="0"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Keluarkan semua uang di laci kasir dan hitung secara manual.
              </p>
            </div>

            {/* Realtime Difference Badge */}
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                difference === 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : difference > 0
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                {difference === 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                )}
                <span>
                  {difference === 0
                    ? 'Status Kas: COCOK (PAS)'
                    : difference > 0
                    ? 'Status Kas: LEBIH (SURPLUS)'
                    : 'Status Kas: KURANG (DEFISIT)'}
                </span>
              </div>
              <span className="text-sm font-black">
                {difference > 0 ? '+' : ''}Rp {difference.toLocaleString('id-ID')}
              </span>
            </div>

            {/* Catatan Tutup Shift */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Catatan Serah Terima Kasir (Opsional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Ada uang kembalian receh belum ditukar"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-900 focus:bg-white rounded-xl text-xs text-slate-800 outline-none transition-all"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-black shadow-md shadow-blue-900/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Lock className="w-4 h-4 stroke-[2.5]" />
                <span>{loading ? 'Menutup Shift...' : 'Kunci & Tutup Shift (Z-Report)'}</span>
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: Tampilan Resmi Z-Report Thermal */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 flex flex-col items-center">
            {/* Paper Selector */}
            <div className="flex items-center gap-2 mb-4 no-print">
              <span className="text-xs font-bold text-slate-500">Lebar Cetak:</span>
              <div className="flex items-center bg-white rounded-xl p-0.5 border border-slate-300 text-[11px] font-bold">
                <button
                  onClick={() => setPaperWidth('58mm')}
                  className={`px-2 py-1 rounded-lg transition-all ${
                    paperWidth === '58mm'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  58mm
                </button>
                <button
                  onClick={() => setPaperWidth('80mm')}
                  className={`px-2 py-1 rounded-lg transition-all ${
                    paperWidth === '80mm'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  80mm
                </button>
              </div>
            </div>

            {/* Slip Printable */}
            <div
              id="z-report-printable"
              className={`bg-white p-5 sm:p-6 shadow-md rounded-2xl border border-slate-200 font-mono text-slate-900 space-y-4 ${
                paperWidth === '58mm' ? 'w-[280px] text-[11px]' : 'w-[360px] text-xs'
              }`}
            >
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h4 className="font-extrabold text-sm uppercase tracking-tight text-slate-900">
                  {zReportData.outlet}
                </h4>
                <div className="mt-2 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-bold tracking-wider">
                  *** LAPORAN TUTUP SHIFT (Z-REPORT) ***
                </div>
              </div>

              {/* Meta */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Kasir:</span>
                  <span className="font-bold">{zReportData.cashier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Buka Shift:</span>
                  <span>{new Date(zReportData.startTime).toLocaleTimeString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tutup Shift:</span>
                  <span>{new Date(zReportData.endTime).toLocaleTimeString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Transaksi:</span>
                  <span className="font-bold">{zReportData.totalTransactions} Transaksi</span>
                </div>
              </div>

              {/* Cash Drawer Reconciliation */}
              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                <div className="font-bold text-slate-800 uppercase text-[10px] tracking-wider mb-1">
                  REKONSILIASI KAS LACI
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Modal Awal:</span>
                  <span>Rp {zReportData.cashDrawer.startingCash.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">(+) Penjualan Tunai:</span>
                  <span>Rp {zReportData.cashDrawer.totalCashSales.toLocaleString('id-ID')}</span>
                </div>
                {zReportData.cashDrawer.totalCashIn && zReportData.cashDrawer.totalCashIn > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-slate-600">(+) Kas Masuk Tambahan:</span>
                    <span>Rp {zReportData.cashDrawer.totalCashIn.toLocaleString('id-ID')}</span>
                  </div>
                ) : null}
                {zReportData.cashDrawer.totalCashOut && zReportData.cashDrawer.totalCashOut > 0 ? (
                  <div className="flex justify-between text-rose-700">
                    <span>(-) Pengeluaran Kasir:</span>
                    <span>- Rp {zReportData.cashDrawer.totalCashOut.toLocaleString('id-ID')}</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Kas Seharusnya (Expected):</span>
                  <span>Rp {zReportData.cashDrawer.expectedCash.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-bold text-blue-900">
                  <span>Uang Fisik Dihitung (Actual):</span>
                  <span>Rp {zReportData.cashDrawer.actualCash.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-dashed border-slate-300">
                  <span>SELISIH KAS:</span>
                  <span
                    className={
                      zReportData.cashDrawer.difference === 0
                        ? 'text-emerald-700'
                        : zReportData.cashDrawer.difference > 0
                        ? 'text-blue-700'
                        : 'text-rose-700'
                    }
                  >
                    {zReportData.cashDrawer.difference > 0 ? '+' : ''}Rp{' '}
                    {zReportData.cashDrawer.difference.toLocaleString('id-ID')} (
                    {zReportData.cashDrawer.differenceLabel})
                  </span>
                </div>
              </div>

              {/* Rincian Pengeluaran Kasir jika ada */}
              {zReportData.cashMovements && zReportData.cashMovements.length > 0 && (
                <div className="space-y-1 text-[10px] border-b border-dashed border-slate-300 pb-3">
                  <div className="font-bold text-slate-800 uppercase tracking-wider mb-1">
                    RINCIAN PENGELUARAN KASIR
                  </div>
                  {zReportData.cashMovements.map((m: any) => (
                    <div key={m.id} className="flex justify-between text-slate-600">
                      <span className="truncate max-w-[180px]">{m.category} ({m.notes})</span>
                      <span className="font-mono">{m.type === 'CASH_OUT' ? '-' : '+'} Rp {Number(m.amount).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Non Cash Summary */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Penjualan QRIS:</span>
                  <span>Rp {zReportData.nonCashSummary.totalQrisSales.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-black text-blue-950 pt-1">
                  <span>TOTAL OMSET SHIFT:</span>
                  <span>Rp {zReportData.nonCashSummary.totalRevenue.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {zReportData.notes && (
                <div className="text-[10px] text-slate-500 italic">
                  Catatan: {zReportData.notes}
                </div>
              )}

              <div className="text-center pt-2 text-[10px] text-slate-400">
                <p>Shift Resmi Ditutup. Terima Kasih.</p>
              </div>
            </div>

            {/* Actions for Step 2 */}
            <div className="w-full max-w-[360px] pt-4 flex items-center justify-between gap-3 no-print pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                onClick={handlePrint}
                className="flex-1 py-2.5 rounded-xl border-2 border-blue-900 text-blue-950 font-bold text-xs hover:bg-blue-50 transition-all flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Z-Report</span>
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-black shadow-md shadow-blue-900/20 transition-all flex items-center justify-center gap-1.5"
              >
                <span>Selesai</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
