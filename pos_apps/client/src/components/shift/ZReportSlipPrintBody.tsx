import React from 'react';
import type { ZReportData } from '../../types/shift';

interface ZReportSlipPrintBodyProps {
  zReportData: ZReportData;
  paperWidth: '58mm' | '80mm';
}

export const ZReportSlipPrintBody: React.FC<ZReportSlipPrintBodyProps> = ({
  zReportData,
  paperWidth,
}) => {
  return (
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
              <span className="truncate max-w-[180px]">
                {m.category} ({m.notes})
              </span>
              <span className="font-mono">
                {m.type === 'CASH_OUT' ? '-' : '+'} Rp {Number(m.amount).toLocaleString('id-ID')}
              </span>
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
          <span className="text-slate-600">Total QRIS:</span>
          <span>Rp {zReportData.nonCashSummary.totalQrisSales.toLocaleString('id-ID')}</span>
        </div>
        {zReportData.nonCashSummary.totalOtherNonCashSales !== undefined &&
          zReportData.nonCashSummary.totalOtherNonCashSales > 0 && (
            <div className="flex justify-between text-slate-700">
              <span className="text-slate-600">Total Non-Tunai Lainnya (Transfer/EDC):</span>
              <span>Rp {zReportData.nonCashSummary.totalOtherNonCashSales.toLocaleString('id-ID')}</span>
            </div>
          )}
        {zReportData.nonCashSummary.avgOrderValue !== undefined &&
          zReportData.nonCashSummary.avgOrderValue > 0 && (
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
                <span>
                  {channelLabel[ch.channel] || ch.channel} ({ch.count}x)
                </span>
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

      {/* Ringkasan Piutang Aktif / Bayar Nanti (Pure Summary - Tanpa Daftar Rincian Nota) */}
      {zReportData.receivablesSummary && zReportData.receivablesSummary.unpaidCount > 0 && (
        <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
          <div className="font-bold text-slate-800 uppercase text-[10px] tracking-wider mb-1">
            PIUTANG AKTIF / BAYAR NANTI
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Nota Belum Lunas:</span>
            <span className="font-bold">{zReportData.receivablesSummary.unpaidCount} Nota</span>
          </div>
          <div className="flex justify-between font-bold text-amber-900">
            <span>Total Piutang Berjalan:</span>
            <span>
              Rp {Number(zReportData.receivablesSummary.totalReceivables).toLocaleString('id-ID')}
            </span>
          </div>
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
  );
};
