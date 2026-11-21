import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Receipt,
  ChevronDown,
  ChevronUp,
  Wallet,
} from 'lucide-react';
import { CurrencyInput } from '../ui/CurrencyInput';

interface ShiftReconciliationSummaryProps {
  startingCash: number;
  cashSales: number;
  totalDebtCashIn: number;
  totalCashIn: number;
  totalCashOut: number;
  expectedCash: number;
  actualCash: number;
  setActualCash: (val: number) => void;
  difference: number;
  shiftOrders: any[];
  shiftDebtPayments: any[];
  unpaidOrdersInShift: any[];
  isLaundry?: boolean;
  notes: string;
  setNotes: (val: string) => void;
}

export const ShiftReconciliationSummary: React.FC<ShiftReconciliationSummaryProps> = ({
  startingCash,
  cashSales,
  totalDebtCashIn,
  totalCashIn,
  totalCashOut,
  expectedCash,
  actualCash,
  setActualCash,
  difference,
  shiftOrders,
  shiftDebtPayments,
  unpaidOrdersInShift,
  isLaundry = false,
  notes,
  setNotes,
}) => {
  const [showOrdersList, setShowOrdersList] = useState(false);

  return (
    <div className="space-y-4">
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
          <span className="font-mono font-bold text-slate-900">
            Rp {startingCash.toLocaleString('id-ID')}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-600">(+) Penjualan Tunai:</span>
          <span className="font-mono font-bold text-emerald-700">
            Rp {cashSales.toLocaleString('id-ID')}
          </span>
        </div>
        {totalDebtCashIn > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-emerald-700 font-semibold">(+) Pelunasan Kasbon Tunai:</span>
            <span className="font-mono font-bold text-emerald-700">
              Rp {totalDebtCashIn.toLocaleString('id-ID')}
            </span>
          </div>
        )}
        {totalCashIn > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-600">(+) Kas Masuk Tambahan:</span>
            <span className="font-mono font-bold text-emerald-600">
              Rp {totalCashIn.toLocaleString('id-ID')}
            </span>
          </div>
        )}
        {totalCashOut > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-rose-600 font-semibold">(-) Pengeluaran Kasir (Kas Keluar):</span>
            <span className="font-mono font-bold text-rose-600">
              - Rp {totalCashOut.toLocaleString('id-ID')}
            </span>
          </div>
        )}
        <div className="flex justify-between text-xs pt-2 border-t border-slate-200 font-extrabold">
          <span className="text-slate-900">Total Seharusnya Ada di Laci:</span>
          <span className="text-sm font-mono font-black text-blue-900">
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

      {/* Input Fisik Uang di Laci */}
      <div>
        <CurrencyInput
          label="Hitungan Fisik Uang Tunai di Laci (Actual Cash)"
          value={actualCash}
          onChange={(val) => setActualCash(val)}
          inputClassName="py-3 text-lg font-mono font-black text-right tracking-tight bg-slate-50 border-2 border-slate-200 focus:bg-white rounded-2xl"
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
        <span className="text-sm font-mono font-black">
          {difference > 0 ? '+' : ''}Rp {difference.toLocaleString('id-ID')}
        </span>
      </div>

      {/* Peringatan Tagihan Belum Lunas */}
      {unpaidOrdersInShift.length > 0 && (
        <div
          className={`p-3.5 rounded-2xl flex items-start gap-2.5 ${
            isLaundry
              ? 'bg-amber-50 border border-amber-200 text-amber-900'
              : 'bg-rose-50 border border-rose-200 text-rose-900'
          }`}
        >
          <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${isLaundry ? 'text-amber-600' : 'text-rose-600'}`} />
          <div className="text-xs space-y-1">
            <div className={`font-black ${isLaundry ? 'text-amber-900' : 'text-rose-800'}`}>
              {isLaundry
                ? `Informasi: Terdapat ${unpaidOrdersInShift.length} Nota Laundry Belum Lunas (Bayar Nanti)`
                : `Tutup Shift Terkunci: Ada ${unpaidOrdersInShift.length} Tagihan Belum Lunas (Open Tab)`}
            </div>
            <div className={isLaundry ? 'text-amber-800 leading-relaxed' : 'text-rose-700 leading-relaxed'}>
              {isLaundry
                ? 'Operasional Laundry diizinkan tutup shift harian. Sisa piutang aktif akan otomatis dicatat pada slip Z-Report.'
                : 'Kasir wajib menyelesaikan pembayaran atau membatalkan pesanan (VOID) berikut sebelum menutup shift:'}
            </div>
            <div className="font-mono font-bold pt-0.5 flex flex-wrap gap-1.5">
              {unpaidOrdersInShift.map((o: any) => (
                <span
                  key={o.id}
                  className={`px-2 py-0.5 rounded-md border ${
                    isLaundry
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-rose-100 text-rose-900 border-rose-300'
                  }`}
                >
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
          Catatan Tutup Shift (Opsional)
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Contoh: Sisa cup 20, selisih nilai kasir -5000 rupiah"
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-900 focus:bg-white rounded-xl text-xs text-slate-800 outline-none transition-all resize-none leading-relaxed"
        />
      </div>
    </div>
  );
};
