// Well POS - FinancialAnalyticsTab Component
// Sub-Tab Analitik Finansial & Arus Kas Laundry (Anti-Double-Counting, Tren Harian, Metode Pembayaran, OPEX)

import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  HelpCircle,
  Receipt,
  RotateCcw,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import type { FinancialAnalyticsResult, DrilldownType } from '../../../../types/laundryAnalytics';
import { fetchLaundryFinancial } from '../../../../services/laundryAnalyticsApi';
import { formatRupiah } from '../../../../utils/currency';

interface FinancialAnalyticsTabProps {
  preset: string;
  startDate?: string;
  endDate?: string;
  outletId: string;
  isOwner?: boolean;
  userRole?: string;
  onOpenDrilldown: (type: DrilldownType, context?: any) => void;
}

export const FinancialAnalyticsTab: React.FC<FinancialAnalyticsTabProps> = ({
  preset,
  startDate,
  endDate,
  outletId,
  isOwner: _isOwner,
  userRole: _userRole,
  onOpenDrilldown,
}) => {
  const [data, setData] = useState<FinancialAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);
  const [showCashDetails, setShowCashDetails] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadData = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setLoading(true);
    setError(null);

    fetchLaundryFinancial(
      {
        preset,
        startDate,
        endDate,
        outletId,
      },
      ac.signal
    )
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Gagal memuat analitik finansial');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [preset, startDate, endDate, outletId]);

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-200/80 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-200/80 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-48 bg-slate-200/80 rounded-2xl" />
          <div className="h-48 bg-slate-200/80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-3xl">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h4 className="font-bold text-rose-900 text-base">Gagal Memuat Laporan Finansial</h4>
        <p className="text-xs sm:text-sm text-rose-700 mt-1">{error}</p>
        <button
          type="button"
          onClick={loadData}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-900 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-blue-800 transition-colors shadow-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Muat Ulang
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { revenue, cashFlow, cogsAndProfit, opex, profitability, balanceSheetSummary, revenueSeries } = data;

  const renderTrend = (pct: number = 0, dir: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL') => {
    if (dir === 'NEUTRAL' || pct === 0) {
      return (
        <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          0%
        </span>
      );
    }
    const isUp = dir === 'UP';
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
          isUp
            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/80'
            : 'text-rose-700 bg-rose-50 border border-rose-200/80'
        }`}
      >
        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {pct > 0 ? `+${pct}%` : `${pct}%`}
      </span>
    );
  };

  // SVG Chart Dimensions & Helpers
  const chartHeight = 200;
  const chartWidth = 700;
  const paddingX = 40;
  const paddingY = 25;

  const series = revenueSeries || [];
  const maxVal = Math.max(
    1,
    ...series.map((s) => Math.max(s.accrualRevenue, s.realCashIn, s.recordedOpex))
  );

  const getX = (idx: number) => {
    if (series.length <= 1) return chartWidth / 2;
    return paddingX + (idx / (series.length - 1)) * (chartWidth - paddingX * 2);
  };

  const getY = (val: number) => {
    const usableH = chartHeight - paddingY * 2;
    return chartHeight - paddingY - (val / maxVal) * usableH;
  };

  const accrualPath = series
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(s.accrualRevenue)}`)
    .join(' ');

  const cashInPath = series
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(s.realCashIn)}`)
    .join(' ');

  const opexPath = series
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(s.recordedOpex)}`)
    .join(' ');

  return (
    <div className="space-y-6">
      {/* 1. Baris Kartu Metrik Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gross Revenue */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Pendapatan Kotor
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
              {formatRupiah(revenue?.grossRevenue?.current ?? 0)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              {renderTrend(revenue?.grossRevenue?.percentChange ?? 0, revenue?.grossRevenue?.direction ?? 'NEUTRAL')}
              <span className="text-[11px] text-slate-400">vs periode lalu</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
            <span>Diskon: {formatRupiah(revenue?.discountTotal?.current ?? 0)}</span>
            <span>Refund: {formatRupiah(revenue?.refundTotal?.current ?? 0)}</span>
          </div>
        </div>

        {/* Card 2: Net Revenue */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-blue-900 uppercase tracking-wider block mb-1">
              Pendapatan Bersih (Akrual)
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-blue-900 tabular-nums whitespace-nowrap">
              {formatRupiah(revenue?.netRevenue?.current ?? 0)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              {renderTrend(revenue?.netRevenue?.percentChange ?? 0, revenue?.netRevenue?.direction ?? 'NEUTRAL')}
              <span className="text-[11px] text-slate-400">vs periode lalu</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
            <span>Omzet transaksi valid</span>
            <button
              type="button"
              onClick={() => onOpenDrilldown('ORDERS_BY_DATE')}
              className="text-blue-900 font-bold hover:underline inline-flex items-center gap-0.5"
            >
              Rincian <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 3: Real Cash In (With Anti-Double Counting Disclosure) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">
                Kas Masuk Riil
              </span>
              <button
                type="button"
                onClick={() => setShowCashDetails(!showCashDetails)}
                className="text-emerald-700 hover:text-emerald-900 p-0.5 rounded"
                title="Lihat 4 komponen kas masuk riil"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-700 tabular-nums whitespace-nowrap">
              {formatRupiah(cashFlow?.realCashIn?.current ?? 0)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              {renderTrend(cashFlow?.realCashIn?.percentChange ?? 0, cashFlow?.realCashIn?.direction ?? 'NEUTRAL')}
              <span className="text-[11px] text-slate-400">vs periode lalu</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
            <span>Arus kas operasional</span>
            <span className="text-emerald-700 font-semibold text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded">
              Anti-Double Count
            </span>
          </div>
        </div>

        {/* Card 4: Operating Profit & Margin */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Laba Operasi (Recorded)
              </span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80">
                PARTIAL
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
              {formatRupiah(profitability?.operatingProfit?.current ?? 0)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full tabular-nums">
                Margin {profitability?.profitMarginPercent?.current ?? 0}%
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
            HPP BoM ({formatRupiah(cogsAndProfit?.cogsBom?.current ?? 0)}) + OPEX tercatat
          </div>
        </div>
      </div>

      {/* Rincian Komponen Kas Masuk Riil (Collapsible) */}
      {showCashDetails && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs sm:text-sm font-bold text-emerald-900 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-emerald-700" />
              Rincian 4 Komponen Kas Masuk Riil (Standar Akuntansi POS)
            </h4>
            <span className="text-xs text-emerald-700 font-semibold">
              Total: {formatRupiah(cashFlow?.realCashIn?.current ?? 0)}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
              <span className="text-slate-500 block mb-1">1. Pembayaran Langsung</span>
              <strong className="text-slate-900 text-sm tabular-nums">
                {formatRupiah(cashFlow?.components?.directOrderPayments?.current ?? 0)}
              </strong>
              <p className="text-[10px] text-slate-400 mt-1">Tunai, QRIS, & Transfer nota</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
              <span className="text-slate-500 block mb-1">2. Pelunasan Kasbon</span>
              <strong className="text-slate-900 text-sm tabular-nums">
                {formatRupiah(cashFlow?.components?.debtRepayments?.current ?? 0)}
              </strong>
              <p className="text-[10px] text-slate-400 mt-1">Pembayaran piutang pelanggan</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
              <span className="text-slate-500 block mb-1">3. Top-Up Saldo Dompet</span>
              <strong className="text-slate-900 text-sm tabular-nums">
                {formatRupiah(cashFlow?.components?.walletBalanceTopup?.current ?? 0)}
              </strong>
              <p className="text-[10px] text-slate-400 mt-1">Setoran deposit tunai ke kas</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
              <span className="text-slate-500 block mb-1">4. Beli Paket Kuota</span>
              <strong className="text-slate-900 text-sm tabular-nums">
                {formatRupiah(cashFlow?.components?.quotaTopupCash?.current ?? 0)}
              </strong>
              <p className="text-[10px] text-slate-400 mt-1">Pembelian kuota kg prabayar</p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Grafik SVG Responsif Tren Harian */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-900" />
              Tren Harian: Akrual vs Kas Masuk vs Beban OPEX
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Klik pada titik tanggal mana pun untuk membuka rincian transaksi nota.
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-blue-900">
              <span className="w-3 h-0.5 bg-blue-900 rounded" />
              Omzet Akrual
            </span>
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-3 h-0.5 bg-emerald-600 rounded" />
              Kas Masuk Riil
            </span>
            <span className="flex items-center gap-1.5 text-rose-600">
              <span className="w-3 h-0.5 bg-rose-500 rounded" />
              Recorded OPEX
            </span>
          </div>
        </div>

        {/* SVG Container */}
        {series.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-xs text-slate-400">
            Belum ada deret waktu transaksi pada periode ini.
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-48 sm:h-56 select-none"
            >
              {/* Horizontal Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                const y = paddingY + (chartHeight - paddingY * 2) * pct;
                return (
                  <line
                    key={i}
                    x1={paddingX}
                    y1={y}
                    x2={chartWidth - paddingX}
                    y2={y}
                    stroke="#f1f5f9"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Path Lines */}
              <path
                d={accrualPath}
                fill="none"
                stroke="#1e3a8a"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={cashInPath}
                fill="none"
                stroke="#059669"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={opexPath}
                fill="none"
                stroke="#e11d48"
                strokeWidth="2"
                strokeDasharray="4 4"
                strokeLinecap="round"
              />

              {/* Data Points (Clickable to open Drilldown) */}
              {series.map((s, idx) => {
                const cx = getX(idx);
                const cy = getY(s.accrualRevenue);
                return (
                  <g key={s.date} className="cursor-pointer group">
                    <circle
                      cx={cx}
                      cy={cy}
                      r="4"
                      className="fill-white stroke-blue-900 stroke-2 hover:r-6 hover:fill-blue-900 transition-all"
                      onMouseEnter={() => setHoveredPoint(s)}
                      onMouseLeave={() => setHoveredPoint(null)}
                      onClick={() => onOpenDrilldown('ORDERS_BY_DATE', { date: s.date })}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredPoint && (
              <div className="absolute top-2 right-4 bg-slate-900/95 text-white p-2.5 rounded-xl text-xs shadow-lg pointer-events-none z-10 space-y-1">
                <span className="font-bold block border-b border-white/20 pb-1">
                  Tanggal: {hoveredPoint.date}
                </span>
                <div className="flex justify-between gap-3 text-blue-200">
                  <span>Omzet Akrual:</span>
                  <strong className="tabular-nums">{formatRupiah(hoveredPoint.accrualRevenue)}</strong>
                </div>
                <div className="flex justify-between gap-3 text-emerald-300">
                  <span>Kas Masuk Riil:</span>
                  <strong className="tabular-nums">{formatRupiah(hoveredPoint.realCashIn)}</strong>
                </div>
                <div className="flex justify-between gap-3 text-rose-300">
                  <span>Recorded OPEX:</span>
                  <strong className="tabular-nums">{formatRupiah(hoveredPoint.recordedOpex)}</strong>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Baris 2 Kolom: Liabilitas & Piutang vs OPEX & HPP BoM */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Kolom Kiri: Posisi Piutang & Liabilitas Pelanggan */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-900" />
            Posisi Piutang & Liabilitas Pelanggan
          </h4>

          {/* Card Piutang Aktif */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 block">Piutang Kasbon Belum Lunas</span>
              <strong className="text-base text-rose-600 font-extrabold tabular-nums">
                {formatRupiah(balanceSheetSummary?.outstandingReceivables ?? 0)}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => onOpenDrilldown('UNPAID_DEBTS')}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            >
              Buku Piutang
            </button>
          </div>

          {/* Card Liabilitas Saldo & Kuota */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-xs text-slate-500 block">Liabilitas Dompet Pelanggan</span>
            <strong className="text-base text-slate-800 font-extrabold tabular-nums">
              {formatRupiah(balanceSheetSummary?.walletLiability?.balanceAmount ?? 0)}
            </strong>
            <p className="text-[11px] text-slate-400 mt-1">
              Uang kas yang telah diterima di awal dan menjadi kewajiban layanan laundry.
            </p>
          </div>
        </div>

        {/* Kolom Kanan: Rincian OPEX & Beban Tetap */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-900" />
            Beban Operasional (OPEX) & Bahan Baku
          </h4>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Bahan Baku BoM (Deterjen, Parfum, Plastik)</span>
              <strong className="text-slate-900 tabular-nums">
                {formatRupiah(cogsAndProfit?.cogsBom?.current ?? 0)}
              </strong>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Petty Cash Kasir (Operasional Harian)</span>
              <strong className="text-slate-900 tabular-nums">
                {formatRupiah(opex?.pettyCashOut?.current ?? 0)}
              </strong>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Klaim Kompensasi Insiden Mutu</span>
              <strong className="text-rose-600 tabular-nums">
                {formatRupiah(opex?.incidentExpense?.current ?? 0)}
              </strong>
            </div>

            {/* Banner Transparan Fixed Opex (DILARANG Rp 0 PALSU) */}
            <div className="mt-3 p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500 text-[11px]">
              <span className="font-semibold block text-slate-700">
                Beban Tetap Non-Shift (Sewa Toko, Listrik, Gaji Pokok):
              </span>
              <span>Data Belum Tersedia (Roadmap Wave 2: Pencatatan Beban Tetap Non-Shift).</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
