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
  Receipt,
  ChevronDown,
  ChevronUp,
  Wallet,
  Calculator,
  Coins,
  RotateCcw,
} from 'lucide-react';
import { api } from '../services/api';
import type { Shift, ZReportData } from '../types/shift';
import { CurrencyInput } from './ui/CurrencyInput';
import { printElementViaThermalIframe } from '../utils/thermalPrinter';

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShiftClosed: () => void;
  currentShift: Shift | null;
}

const DENOM_LIST = [
  { value: 100000, label: 'Rp 100.000', type: 'paper' },
  { value: 50000, label: 'Rp 50.000', type: 'paper' },
  { value: 20000, label: 'Rp 20.000', type: 'paper' },
  { value: 10000, label: 'Rp 10.000', type: 'paper' },
  { value: 5000, label: 'Rp 5.000', type: 'paper' },
  { value: 2000, label: 'Rp 2.000', type: 'paper' },
  { value: 1000, label: 'Rp 1.000', type: 'paper' },
  { value: 500, label: 'Rp 500 (Koin)', type: 'coin' },
  { value: 200, label: 'Rp 200 (Koin)', type: 'coin' },
  { value: 100, label: 'Rp 100 (Koin)', type: 'coin' },
];

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
  const [showOrdersList, setShowOrdersList] = useState<boolean>(false);
  const [showDenomCalculator, setShowDenomCalculator] = useState<boolean>(false);
  const [denominations, setDenominations] = useState<{ [key: number]: number }>({
    100000: 0,
    50000: 0,
    20000: 0,
    10000: 0,
    5000: 0,
    2000: 0,
    1000: 0,
    500: 0,
    200: 0,
    100: 0,
  });

  // Kalkulasi data kasir saat ini
  const startingCash = currentShift ? Number(currentShift.startingCash) : 0;
  const cashSales = currentShift?.stats?.cashSalesTotal || 0;
  const totalCashOut = currentShift?.stats?.totalCashOut || 0;
  const totalCashIn = currentShift?.stats?.totalCashIn || 0;
  const totalDebtCashIn =
    currentShift?.totalDebtCashIn ||
    currentShift?.stats?.totalDebtCashIn ||
    0;

  const expectedCash =
    currentShift?.stats?.expectedCash !== undefined
      ? currentShift.stats.expectedCash
      : (startingCash + cashSales + totalCashIn + totalDebtCashIn - totalCashOut);

  const difference = actualCash - expectedCash;
  const shiftOrders = currentShift?.orders || [];
  const shiftDebtPayments = currentShift?.debtPayments || [];

  // Validasi Integritas Operasional: Kasir dilarang tutup shift jika masih ada tagihan belum lunas
  const unpaidOrdersInShift = shiftOrders.filter(
    (o: any) => o.paymentStatus === 'UNPAID' && o.orderStatus !== 'VOIDED' && o.orderStatus !== 'CANCELLED'
  );

  const totalDenomCount = Object.values(denominations).reduce((a, b) => a + b, 0);
  const totalDenomSum = Object.entries(denominations).reduce(
    (sum, [valStr, count]) => sum + Number(valStr) * (count || 0),
    0
  );

  const handleDenomChange = (val: number, countStr: string) => {
    const parsed = parseInt(countStr, 10);
    const count = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    const next = { ...denominations, [val]: count };
    setDenominations(next);
    const nextSum = Object.entries(next).reduce(
      (sum, [vStr, c]) => sum + Number(vStr) * (c || 0),
      0
    );
    setActualCash(nextSum);
  };

  const handleResetDenom = () => {
    const emptyObj = {
      100000: 0,
      50000: 0,
      20000: 0,
      10000: 0,
      5000: 0,
      2000: 0,
      1000: 0,
      500: 0,
      200: 0,
      100: 0,
    };
    setDenominations(emptyObj);
    setActualCash(0);
  };

  useEffect(() => {
    if (isOpen) {
      setActualCash(expectedCash);
      setNotes('');
      setErrorMsg(null);
      setZReportData(null);
      setShowOrdersList(false);
      setShowDenomCalculator(false);
      setDenominations({
        100000: 0,
        50000: 0,
        20000: 0,
        10000: 0,
        5000: 0,
        2000: 0,
        1000: 0,
        500: 0,
        200: 0,
        100: 0,
      });
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
    printElementViaThermalIframe('z-report-printable', {
      paperWidth,
      title: `Z-Report Tutup Shift - ${currentShift?.outlet?.name || 'Well POS'}`,
    });
  };

  const handleFinish = () => {
    onShiftClosed();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
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
          /* Step 1: Input Uang Fisik Kasir & Review Transaksi */
          <form onSubmit={handleSubmitClose} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1 overscroll-contain">
              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Info Box Perhitungan Sistem */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
                    Rekap Sistem Saat Ini
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                    {shiftOrders.length} Transaksi
                  </span>
                </div>

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
                {totalDebtCashIn > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-emerald-700 font-semibold">(+) Pelunasan Kasbon Tunai:</span>
                    <span className="font-bold text-emerald-700">
                      Rp {totalDebtCashIn.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
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

              {/* Toggle Tampilkan Daftar Transaksi Selama Shift */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => setShowOrdersList(!showOrdersList)}
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-blue-900" />
                    <span className="text-xs font-bold text-slate-800">
                      Daftar Transaksi Selama Shift ({shiftOrders.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <span>{showOrdersList ? 'Tutup' : 'Lihat Rincian'}</span>
                    {showOrdersList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {showOrdersList && (
                  <div className="p-3 border-t border-slate-200 space-y-3">
                    {shiftOrders.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        Belum ada pesanan yang terselesaikan pada shift ini.
                      </div>
                    ) : (
                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
                        {shiftOrders.map((ord) => (
                          <div key={ord.id} className="py-2 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-800">{ord.invoiceNumber}</span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                                  {ord.channel || ord.orderType || 'DINE_IN'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {new Date(ord.createdAt).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}{' '}
                                • {ord.customerName || ord.tableNumber ? `${ord.customerName || ''} ${ord.tableNumber ? `(Meja ${ord.tableNumber})` : ''}` : 'Pelanggan'}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-black text-blue-950">
                                Rp {Number(ord.grandTotal).toLocaleString('id-ID')}
                              </div>
                              <span
                                className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                  ord.paymentMethod === 'CASH'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-blue-50 text-blue-700'
                                }`}
                              >
                                {ord.paymentMethod}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pelunasan Kasbon jika ada */}
                    {shiftDebtPayments.length > 0 && (
                      <div className="pt-2 border-t border-slate-200">
                        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-800 mb-2">
                          <Wallet className="w-3.5 h-3.5" />
                          <span>Pelunasan Kasbon Tunai ({shiftDebtPayments.length})</span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          {shiftDebtPayments.map((dp) => (
                            <div key={dp.id} className="flex justify-between text-slate-700">
                              <span>
                                {dp.customerName}{' '}
                                <span className="text-[10px] text-slate-400">
                                  ({new Date(dp.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})
                                </span>
                              </span>
                              <span className="font-bold text-emerald-700 font-mono">
                                + Rp {Number(dp.amount).toLocaleString('id-ID')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Kalkulator Denominasi Lembar Pecahan Uang Fisik */}
              <div className="border border-blue-200/80 rounded-2xl overflow-hidden bg-white shadow-xs">
                <button
                  type="button"
                  data-testid="toggle-denom-calc-btn"
                  onClick={() => setShowDenomCalculator(!showDenomCalculator)}
                  className="w-full px-4 py-3 bg-blue-50/70 hover:bg-blue-50 flex items-center justify-between text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-900 text-white flex items-center justify-center shrink-0">
                      <Calculator className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Kalkulator Lembar Pecahan Uang Fisik
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {totalDenomSum > 0
                          ? `${totalDenomCount} lembar/koin dihitung = Rp ${totalDenomSum.toLocaleString('id-ID')}`
                          : 'Buka untuk menghitung uang kertas & koin per lembar'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {totalDenomSum > 0 && (
                      <span className="text-xs font-black text-blue-900 bg-blue-100 px-2.5 py-1 rounded-lg">
                        Rp {totalDenomSum.toLocaleString('id-ID')}
                      </span>
                    )}
                    {showDenomCalculator ? (
                      <ChevronUp className="w-4 h-4 text-slate-600" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-600" />
                    )}
                  </div>
                </button>

                {showDenomCalculator && (
                  <div className="p-3.5 border-t border-blue-100 bg-slate-50/50 space-y-3" data-testid="denom-calc-container">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold px-0.5">
                      <span>Pecahan Rupiah (Kertas & Koin)</span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          data-testid="reset-denom-btn"
                          onClick={handleResetDenom}
                          className="text-[10px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset Hitungan</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {DENOM_LIST.map((item) => {
                        const count = denominations[item.value] || 0;
                        const subtotal = item.value * count;
                        return (
                          <div
                            key={item.value}
                            className={`p-2 rounded-xl border transition-colors flex items-center justify-between gap-2 ${
                              count > 0 ? 'bg-blue-50/80 border-blue-300' : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                {item.type === 'coin' ? (
                                  <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                ) : (
                                  <Wallet className="w-3.5 h-3.5 text-blue-800 shrink-0" />
                                )}
                                <span className="text-xs font-bold text-slate-800">{item.label}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                Sub: Rp {subtotal.toLocaleString('id-ID')}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                type="number"
                                min="0"
                                data-testid={`denom-input-${item.value}`}
                                value={count === 0 ? '' : count}
                                onChange={(e) => handleDenomChange(item.value, e.target.value)}
                                placeholder="0"
                                className="w-16 px-2 py-1.5 text-center text-xs font-bold text-slate-900 bg-white border border-slate-300 focus:border-blue-900 focus:ring-1 focus:ring-blue-900 rounded-lg outline-none"
                              />
                              <span className="text-[10px] text-slate-500 font-medium">
                                {item.type === 'coin' ? 'koin' : 'lbr'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Total Hitungan Pecahan:</span>
                      <span className="text-sm font-black text-blue-950 font-mono">
                        Rp {totalDenomSum.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                )}
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

              {/* Peringatan Keras Jika Ada Tagihan Belum Lunas (Open Tab) */}
              {unpaidOrdersInShift.length > 0 && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-900">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <div className="font-black text-rose-800">
                      Tutup Shift Terkunci: Ada {unpaidOrdersInShift.length} Tagihan Belum Lunas (Open Tab)
                    </div>
                    <div className="text-rose-700 leading-relaxed">
                      Kasir wajib menyelesaikan pembayaran atau membatalkan pesanan (VOID) berikut sebelum menutup shift:
                    </div>
                    <div className="font-mono font-bold text-rose-900 pt-0.5 flex flex-wrap gap-1.5">
                      {unpaidOrdersInShift.map((o: any) => (
                        <span key={o.id} className="px-2 py-0.5 bg-rose-100 rounded-md border border-rose-300">
                          {o.invoiceNumber || o.id.slice(0, 8)} (Rp {Number(o.grandTotal || 0).toLocaleString('id-ID')})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

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
            </div>

            {/* Sticky Actions Footer */}
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading || unpaidOrdersInShift.length > 0}
                className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-black shadow-md shadow-blue-900/20 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title={unpaidOrdersInShift.length > 0 ? 'Selesaikan tagihan belum bayar terlebih dahulu' : 'Kunci & Tutup Shift'}
              >
                <Lock className="w-4 h-4 stroke-[2.5]" />
                <span>{loading ? 'Menutup Shift...' : 'Kunci & Tutup Shift (Z-Report)'}</span>
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: Tampilan Resmi Z-Report Thermal */
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 bg-slate-100 flex flex-col items-center">
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
                  {zReportData.totalDebtCashIn && zReportData.totalDebtCashIn > 0 ? (
                    <div className="flex justify-between text-emerald-700">
                      <span>(+) Pelunasan Kasbon Tunai:</span>
                      <span>+ Rp {zReportData.totalDebtCashIn.toLocaleString('id-ID')}</span>
                    </div>
                  ) : null}
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
                  <div className="font-bold text-slate-800 uppercase text-[10px] tracking-wider mb-1">
                    REKAP METODE PEMBAYARAN
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Tunai (CASH):</span>
                    <span>Rp {zReportData.cashDrawer.totalCashSales.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total QRIS / Non-Tunai:</span>
                    <span>Rp {zReportData.nonCashSummary.totalQrisSales.toLocaleString('id-ID')}</span>
                  </div>
                  {zReportData.nonCashSummary.avgOrderValue !== undefined && zReportData.nonCashSummary.avgOrderValue > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Rata-rata (AOV):</span>
                      <span className="font-semibold">
                        Rp {zReportData.nonCashSummary.avgOrderValue.toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-blue-950 pt-1 border-t border-slate-200">
                    <span>TOTAL OMSET SHIFT:</span>
                    <span>Rp {zReportData.nonCashSummary.totalRevenue.toLocaleString('id-ID')}</span>
                  </div>
                </div>

                {/* Channel Breakdown */}
                {zReportData.channelBreakdown && zReportData.channelBreakdown.length > 0 && (
                  <div className="space-y-1 text-[10px] border-b border-dashed border-slate-300 pb-3">
                    <div className="font-bold text-slate-800 uppercase tracking-wider mb-1">
                      OMSET PER KANAL PENJUALAN
                    </div>
                    {zReportData.channelBreakdown.map((ch) => {
                      const channelLabel: Record<string, string> = {
                        DINE_IN: 'Dine In',
                        TAKEAWAY: 'Takeaway',
                        DELIVERY: 'Delivery',
                        GOFOOD: 'GoFood',
                        GRABFOOD: 'GrabFood',
                        SHOPEEFOOD: 'ShopeeFood',
                        QR_MENU: 'Self-Order QR',
                      };
                      return (
                        <div key={ch.channel} className="flex justify-between text-slate-600">
                          <span>{channelLabel[ch.channel] || ch.channel} ({ch.count}x)</span>
                          <span className="font-mono font-semibold">
                            Rp {Number(ch.revenue).toLocaleString('id-ID')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Rincian Pelunasan Kasbon di Struk Cetak jika ada */}
                {zReportData.debtPayments && zReportData.debtPayments.length > 0 && (
                  <div className="space-y-1 text-[10px] border-b border-dashed border-slate-300 pb-3">
                    <div className="font-bold text-slate-800 uppercase tracking-wider mb-1">
                      PELUNASAN KASBON TUNAI ({zReportData.debtPayments.length})
                    </div>
                    {zReportData.debtPayments.map((dp) => (
                      <div key={dp.id} className="flex justify-between text-slate-700 py-0.5">
                        <span className="truncate max-w-[190px]">{dp.customerName}</span>
                        <span className="font-mono font-semibold">
                          Rp {Number(dp.amount).toLocaleString('id-ID')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {zReportData.notes && (
                  <div className="text-[10px] text-slate-500 italic">
                    Catatan: {zReportData.notes}
                  </div>
                )}

                <div className="text-center pt-2 text-[10px] text-slate-400">
                  <p>Shift Resmi Ditutup. Terima Kasih.</p>
                </div>
              </div>
            </div>

            {/* Sticky Actions for Step 2 */}
            <div className="p-4 sm:px-6 bg-white border-t border-slate-200 flex items-center justify-center gap-3 no-print shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] w-full">
              <button
                onClick={handlePrint}
                className="flex-1 max-w-[180px] py-2.5 rounded-xl border-2 border-blue-900 text-blue-950 font-bold text-xs hover:bg-blue-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Z-Report</span>
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 max-w-[180px] py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-black shadow-md shadow-blue-900/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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
