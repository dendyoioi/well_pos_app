import React, { useState, useEffect } from 'react';
import {
  Lock,
  Printer,
  X,
  AlertCircle,
  FileCheck,
  ArrowRight,
  Zap,
  Loader2,
} from 'lucide-react';
import { api } from '../services/api';
import type { Shift, ZReportData } from '../types/shift';
import { printElementViaThermalIframe } from '../utils/thermalPrinter';
import { useThermalPrinterHub } from '../hooks/useThermalPrinterHub';
import { ShiftCashDenominationTab } from './shift/ShiftCashDenominationTab';
import { ShiftReconciliationSummary } from './shift/ShiftReconciliationSummary';
import { ZReportSlipPrintBody } from './shift/ZReportSlipPrintBody';

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShiftClosed: () => void;
  currentShift: Shift | null;
}

const INITIAL_DENOMINATIONS: { [key: number]: number } = {
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
  const printerHub = useThermalPrinterHub();
  const [printSuccessMsg, setPrintSuccessMsg] = useState<string | null>(null);
  const [printErrMsg, setPrintErrMsg] = useState<string | null>(null);
  const [showDenomCalculator, setShowDenomCalculator] = useState<boolean>(false);
  const [denominations, setDenominations] = useState<{ [key: number]: number }>(INITIAL_DENOMINATIONS);
  const [activeShift, setActiveShift] = useState<Shift | null>(currentShift);

  useEffect(() => {
    setActiveShift(currentShift);
  }, [currentShift]);

  useEffect(() => {
    if (isOpen) {
      api.getCurrentShift()
        .then((res) => {
          if (res.status === 'success' && res.data) {
            setActiveShift(res.data);
          }
        })
        .catch((err) => {
          console.error('Gagal memuat data shift terkini:', err);
        });
    }
  }, [isOpen]);

  const effectiveShift = activeShift || currentShift;

  const startingCash = effectiveShift ? Number(effectiveShift.startingCash) : 0;
  const cashSales = effectiveShift?.stats?.cashSalesTotal || 0;
  const totalCashOut = effectiveShift?.stats?.totalCashOut || 0;
  const totalCashIn = effectiveShift?.stats?.totalCashIn || 0;
  const totalDebtCashIn =
    effectiveShift?.totalDebtCashIn ||
    effectiveShift?.stats?.totalDebtCashIn ||
    0;

  const expectedCash =
    effectiveShift?.stats?.expectedCash !== undefined
      ? effectiveShift.stats.expectedCash
      : startingCash + cashSales + totalCashIn + totalDebtCashIn - totalCashOut;

  const difference = actualCash - expectedCash;
  const shiftOrders = effectiveShift?.orders || [];
  const shiftDebtPayments = effectiveShift?.debtPayments || [];

  const unpaidOrdersInShift = shiftOrders.filter(
    (o: any) =>
      o.paymentStatus === 'UNPAID' &&
      o.orderStatus !== 'VOIDED' &&
      o.orderStatus !== 'CANCELLED'
  );

  const isLaundry =
    effectiveShift?.outlet?.industries?.includes('LAUNDRY') || false;

  useEffect(() => {
    if (isOpen) {
      setActualCash(expectedCash);
      setNotes('');
      setErrorMsg(null);
      setZReportData(null);
      setShowDenomCalculator(false);
      setDenominations({ ...INITIAL_DENOMINATIONS });
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

  const handleDirectPrint = async () => {
    if (!zReportData) return;
    setPrintErrMsg(null);
    setPrintSuccessMsg(null);
    try {
      if (!printerHub.isConnected) {
        const reconnected = await printerHub.tryAutoReconnect();
        if (!reconnected) {
          if (printerHub.connectionType === 'usb' && printerHub.isUsbSupported) {
            const ok = await printerHub.connectUsb();
            if (!ok) return;
          } else if (printerHub.isBluetoothSupported) {
            const ok = await printerHub.connectBluetooth();
            if (!ok) return;
          }
        }
      }

      const res = await printerHub.printXZReport(zReportData, 'Z', {
        paperSize: paperWidth,
      });

      if (res.mode === 'bluetooth' || res.mode === 'usb') {
        setPrintSuccessMsg(
          `✓ Slip Z-Report Berhasil Dicetak ke Printer ${res.mode === 'bluetooth' ? 'Bluetooth' : 'USB'}!`
        );
        setTimeout(() => setPrintSuccessMsg(null), 3500);
      }
    } catch (err: any) {
      setPrintErrMsg(err.message || 'Gagal mencetak ke printer');
      setTimeout(() => setPrintErrMsg(null), 4000);
    }
  };

  const handleBrowserPrint = () => {
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
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-800/80 flex items-center justify-center text-blue-200 shrink-0">
              {zReportData ? (
                <FileCheck className="w-5 h-5 stroke-[2.5] text-emerald-300 shrink-0" />
              ) : (
                <Lock className="w-5 h-5 stroke-[2.5] text-amber-300 shrink-0" />
              )}
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-800/80 text-[10px] font-bold text-blue-200 uppercase tracking-wider mb-0.5">
                {zReportData ? 'Z-Report Selesai' : 'Tutup Shift Kasir'}
              </div>
              <h3 className="font-black text-base text-white truncate">
                {zReportData ? 'Rekapitulasi Kas Akhir (Z-Report)' : 'Rekap Kas Fisik di Laci'}
              </h3>
            </div>
          </div>

          <button
            onClick={zReportData ? handleFinish : onClose}
            className="p-1.5 rounded-xl text-blue-200 hover:text-white hover:bg-blue-800/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
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

              {/* Denomination Calculator Toggle */}
              <ShiftCashDenominationTab
                showDenomCalculator={showDenomCalculator}
                setShowDenomCalculator={setShowDenomCalculator}
                denominations={denominations}
                setDenominations={setDenominations}
                setActualCash={setActualCash}
              />

              {/* Reconciliation & Notes Summary */}
              <ShiftReconciliationSummary
                startingCash={startingCash}
                cashSales={cashSales}
                totalDebtCashIn={totalDebtCashIn}
                totalCashIn={totalCashIn}
                totalCashOut={totalCashOut}
                expectedCash={expectedCash}
                actualCash={actualCash}
                setActualCash={setActualCash}
                difference={difference}
                shiftOrders={shiftOrders}
                shiftDebtPayments={shiftDebtPayments}
                unpaidOrdersInShift={unpaidOrdersInShift}
                isLaundry={isLaundry}
                notes={notes}
                setNotes={setNotes}
              />
            </div>

            {/* Sticky Actions Footer Step 1 */}
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading || (!isLaundry && unpaidOrdersInShift.length > 0)}
                className="h-10 px-5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-black shadow-md shadow-blue-900/20 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title={
                  !isLaundry && unpaidOrdersInShift.length > 0
                    ? 'Selesaikan tagihan belum bayar terlebih dahulu'
                    : 'Kunci & Tutup Shift'
                }
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
                    className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                      paperWidth === '58mm'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    58mm
                  </button>
                  <button
                    onClick={() => setPaperWidth('80mm')}
                    className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                      paperWidth === '80mm'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    80mm
                  </button>
                </div>
              </div>

              {/* Pure Summary Printable Slip Body */}
              <ZReportSlipPrintBody zReportData={zReportData} paperWidth={paperWidth} />
            </div>

            {/* Direct Print Feedback */}
            {(printSuccessMsg || printErrMsg) && (
              <div className="px-4 sm:px-6 pt-3 no-print">
                {printSuccessMsg && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between">
                    <span>{printSuccessMsg}</span>
                  </div>
                )}
                {printErrMsg && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center justify-between">
                    <span>{printErrMsg}</span>
                  </div>
                )}
              </div>
            )}

            {/* Sticky Actions Footer Step 2 */}
            <div className="p-4 sm:px-6 bg-white border-t border-slate-200 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 no-print shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] w-full">
              <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                <button
                  type="button"
                  onClick={handleBrowserPrint}
                  disabled={!zReportData}
                  className="px-3 py-2.5 border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Cetak via dialog browser standar"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Browser</span>
                </button>

                <button
                  type="button"
                  onClick={handleDirectPrint}
                  disabled={!zReportData || printerHub.isPrinting}
                  className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.99] ${
                    printerHub.isConnected
                      ? 'bg-blue-900 hover:bg-blue-950 text-white shadow-blue-900/20'
                      : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20'
                  }`}
                >
                  {printerHub.isPrinting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-blue-200" />
                      <span>Mencetak Z-Report...</span>
                    </>
                  ) : printerHub.isConnected ? (
                    <>
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>
                        ⚡ Cetak Langsung {printerHub.connectionType === 'usb' ? 'USB' : 'Bluetooth'} (
                        {printerHub.deviceName || paperWidth})
                      </span>
                    </>
                  ) : printerHub.deviceName ? (
                    <>
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>⚡ Sambungkan &amp; Cetak ({printerHub.deviceName})</span>
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4 text-blue-300" />
                      <span>⚡ Hubungkan &amp; Cetak ({paperWidth})</span>
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={handleFinish}
                className="h-10 px-5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-black shadow-md shadow-blue-900/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                title="Selesaikan penutupan shift dan kunci terminal untuk pergantian kasir berikutnya"
              >
                <Lock className="w-3.5 h-3.5 text-blue-200" />
                <span>Selesai &amp; Kunci Kasir</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
