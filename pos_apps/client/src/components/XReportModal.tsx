import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  X,
  Banknote,
  CreditCard,
  AlertCircle,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { api } from '../services/api';
import type { XReportData } from '../types/shift';
import { printElementViaThermalIframe } from '../utils/thermalPrinter';

interface XReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const XReportModal: React.FC<XReportModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<XReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('80mm');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchXReport = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getXReport();
      if (res.status === 'success') {
        setData(res.data);
      } else {
        setErrorMsg(res.message || 'Gagal memuat X-Report');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchXReport();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrint = () => {
    printElementViaThermalIframe('x-report-printable', {
      paperWidth,
      title: `X-Report Laporan Berjalan - ${data?.outlet?.name || 'Well POS'}`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white p-4 sm:p-5 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-800 flex items-center justify-center text-blue-200">
              <FileText className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-800/80 text-[10px] font-bold text-blue-200 uppercase tracking-wider mb-0.5">
                X-Report
              </div>
              <h3 className="font-black text-base text-white">Laporan Berjalan Kasir</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Paper Width Toggle */}
            <div className="flex items-center bg-blue-950/80 rounded-xl p-0.5 border border-blue-800/80 text-[11px] font-bold">
              <button
                onClick={() => setPaperWidth('58mm')}
                className={`px-2 py-1 rounded-lg transition-all ${
                  paperWidth === '58mm' ? 'bg-blue-800 text-white shadow-xs' : 'text-blue-200 hover:text-white'
                }`}
              >
                58mm
              </button>
              <button
                onClick={() => setPaperWidth('80mm')}
                className={`px-2 py-1 rounded-lg transition-all ${
                  paperWidth === '80mm' ? 'bg-blue-800 text-white shadow-xs' : 'text-blue-200 hover:text-white'
                }`}
              >
                80mm
              </button>
            </div>

            <button
              onClick={fetchXReport}
              title="Perbarui Data"
              className="p-1.5 rounded-xl text-blue-200 hover:text-white hover:bg-blue-800/60 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-blue-200 hover:text-white hover:bg-blue-800/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 flex justify-center">
          {loading && !data ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-900" />
              <span className="text-xs font-semibold">Mengambil data X-Report...</span>
            </div>
          ) : errorMsg ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-semibold my-auto">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : data ? (
            <div
              id="x-report-printable"
              className={`bg-white p-5 sm:p-6 shadow-md rounded-2xl border border-slate-200 font-mono text-slate-900 space-y-4 ${
                paperWidth === '58mm' ? 'w-[280px] text-[11px]' : 'w-[360px] text-xs'
              }`}
            >
              {/* Slip Header */}
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h4 className="font-extrabold text-sm uppercase tracking-tight text-slate-900">
                  {data.outlet.name}
                </h4>
                {data.outlet.address && (
                  <p className="text-[10px] text-slate-500 mt-0.5">{data.outlet.address}</p>
                )}
                <div className="mt-2 py-1 bg-slate-100 rounded-lg text-[10px] font-bold tracking-wider text-slate-700">
                  *** LAPORAN BERJALAN KASIR (X-REPORT) ***
                </div>
              </div>

              {/* Meta Info */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Kasir:</span>
                  <span className="font-bold">{data.cashier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Jam Buka:</span>
                  <span>{new Date(data.startTime).toLocaleTimeString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Waktu Cetak:</span>
                  <span>{new Date(data.generatedAt).toLocaleTimeString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status Shift:</span>
                  <span className="font-bold text-emerald-600">SEDANG BERJALAN (OPEN)</span>
                </div>
              </div>

              {/* Cash Drawer Status */}
              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                <div className="font-bold text-slate-800 uppercase text-[10px] tracking-wider mb-1">
                  1. POSISI KAS DI LACI (DRAWER)
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Modal Awal Kas:</span>
                  <span className="font-semibold">
                    Rp {data.cashDrawer.startingCash.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">(+) Penjualan Tunai:</span>
                  <span className="font-semibold text-emerald-700">
                    Rp {data.cashDrawer.cashSales.toLocaleString('id-ID')}
                  </span>
                </div>
                {data.cashDrawer.totalDebtCashIn && data.cashDrawer.totalDebtCashIn > 0 ? (
                  <div className="flex justify-between text-emerald-700">
                    <span>(+) Pelunasan Kasbon:</span>
                    <span className="font-semibold">
                      +Rp {data.cashDrawer.totalDebtCashIn.toLocaleString('id-ID')}
                    </span>
                  </div>
                ) : null}
                {data.cashDrawer.totalCashIn && data.cashDrawer.totalCashIn > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-slate-600">(+) Kas Masuk:</span>
                    <span className="font-semibold text-emerald-700">
                      +Rp {data.cashDrawer.totalCashIn.toLocaleString('id-ID')}
                    </span>
                  </div>
                ) : null}
                {data.cashDrawer.totalCashOut && data.cashDrawer.totalCashOut > 0 ? (
                  <div className="flex justify-between text-rose-700">
                    <span className="text-slate-600">(-) Pengeluaran Kasir:</span>
                    <span className="font-semibold text-rose-700">
                      -Rp {data.cashDrawer.totalCashOut.toLocaleString('id-ID')}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between pt-1 border-t border-slate-200 font-extrabold text-blue-950">
                  <span>Estimasi Kas di Laci:</span>
                  <span className="text-sm">
                    Rp {data.cashDrawer.expectedCashInDrawer.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Rincian Pengeluaran Kasir jika ada */}
              {data.cashMovements && data.cashMovements.length > 0 && (
                <div className="space-y-1 text-[10px] border-b border-dashed border-slate-300 pb-3">
                  <div className="font-bold text-slate-800 uppercase tracking-wider mb-1">
                    RINCIAN PENGELUARAN KASIR
                  </div>
                  {data.cashMovements.map((m: any) => (
                    <div key={m.id} className="flex justify-between text-slate-600">
                      <span className="truncate max-w-[180px]">{m.category} ({m.notes})</span>
                      <span className={`font-mono font-medium ${m.type === 'CASH_OUT' ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {m.type === 'CASH_OUT' ? '-' : '+'}Rp {Number(m.amount).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Pelunasan Kasbon Pelanggan jika ada */}
              {data.debtPayments && data.debtPayments.length > 0 && (
                <div className="space-y-1 text-[10px] border-b border-dashed border-slate-300 pb-3">
                  <div className="font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Wallet className="w-3 h-3 text-emerald-700" />
                    <span>PELUNASAN KASBON TUNAI ({data.debtPayments.length})</span>
                  </div>
                  {data.debtPayments.map((dp) => (
                    <div key={dp.id} className="flex justify-between text-slate-700 py-0.5">
                      <span className="truncate max-w-[190px]">{dp.customerName}</span>
                      <span className="font-mono font-semibold text-emerald-700">
                        +Rp {Number(dp.amount).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Payment Summary */}
              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                <div className="font-bold text-slate-800 uppercase text-[10px] tracking-wider mb-1">
                  2. REKAP OMSET PENJUALAN
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 flex items-center gap-1">
                    <Banknote className="w-3 h-3" /> Penjualan Tunai:
                  </span>
                  <span className="font-semibold">
                    Rp {data.paymentSummary.cashSales.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> Penjualan QRIS:
                  </span>
                  <span className="font-semibold">
                    Rp {data.paymentSummary.qrisSales.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-black text-slate-900">
                  <span>Total Omset Bersih:</span>
                  <span className="text-sm text-blue-900">
                    Rp {data.paymentSummary.netRevenue.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Transaction Metrics */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3 text-slate-600">
                <div className="flex justify-between">
                  <span>Total Faktur Berhasil:</span>
                  <span className="font-bold text-slate-900">
                    {data.transactionSummary.totalOrders} Transaksi
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal Penjualan:</span>
                  <span>Rp {data.transactionSummary.totalGrossSales.toLocaleString('id-ID')}</span>
                </div>
                {data.transactionSummary.totalDiscounts > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Total Diskon Kasir:</span>
                    <span>-Rp {data.transactionSummary.totalDiscounts.toLocaleString('id-ID')}</span>
                  </div>
                )}
                {data.transactionSummary.totalService > 0 && (
                  <div className="flex justify-between">
                    <span>Biaya Layanan:</span>
                    <span>Rp {data.transactionSummary.totalService.toLocaleString('id-ID')}</span>
                  </div>
                )}
                {data.transactionSummary.totalTax > 0 && (
                  <div className="flex justify-between">
                    <span>PPN (11%):</span>
                    <span>Rp {data.transactionSummary.totalTax.toLocaleString('id-ID')}</span>
                  </div>
                )}
              </div>

              {/* Daftar Transaksi Terakhir di Slip */}
              {data.recentOrders && data.recentOrders.length > 0 && (
                <div className="space-y-1 text-[10px] border-b border-dashed border-slate-300 pb-3">
                  <div className="font-bold text-slate-800 uppercase tracking-wider mb-1">
                    TRANSAKSI TERBARU ({data.recentOrders.length})
                  </div>
                  {data.recentOrders.map((ord, idx) => (
                    <div key={idx} className="flex justify-between text-slate-700 py-0.5">
                      <span className="truncate max-w-[190px]">
                        {ord.invoiceNumber} ({ord.paymentMethod})
                      </span>
                      <span className="font-mono font-semibold">
                        Rp {Number(ord.grandTotal).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="text-center pt-1 text-[10px] text-slate-400">
                <p>Dokumen ini adalah laporan sementara (X-Report).</p>
                <p>Shift kasir masih aktif dan belum ditutup.</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between no-print">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Tutup
          </button>

          <button
            onClick={handlePrint}
            disabled={!data}
            className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-black shadow-md shadow-blue-900/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Printer className="w-4 h-4 stroke-[2.5]" />
            <span>Cetak Slip X-Report</span>
          </button>
        </div>
      </div>
    </div>
  );
};
