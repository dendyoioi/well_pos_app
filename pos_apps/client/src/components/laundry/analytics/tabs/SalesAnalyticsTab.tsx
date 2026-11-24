// Well POS - SalesAnalyticsTab Component
// Sub-Tab Analitik Penjualan Laundry (Split Kiloan vs Satuan, Heatmap 7x24 Jam, Top Layanan & Kasir)

import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  AlertCircle,
  RotateCcw,
  Clock,
  Sparkles,
  Flame,
  UserCheck,
} from 'lucide-react';
import type { SalesAnalyticsResult, DrilldownType } from '../../../../types/laundryAnalytics';
import { fetchLaundrySales } from '../../../../services/laundryAnalyticsApi';
import { formatRupiah } from '../../../../utils/currency';

interface SalesAnalyticsTabProps {
  preset: string;
  startDate?: string;
  endDate?: string;
  outletId: string;
  onOpenDrilldown: (type: DrilldownType, context?: any) => void;
}

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const ACTIVE_HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 s/d 22:00 WIB

export const SalesAnalyticsTab: React.FC<SalesAnalyticsTabProps> = ({
  preset,
  startDate,
  endDate,
  outletId,
  onOpenDrilldown,
}) => {
  const [data, setData] = useState<SalesAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number; orders: number; amount: number } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadData = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setLoading(true);
    setError(null);

    fetchLaundrySales(
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
        setError(err.message || 'Gagal memuat analitik penjualan');
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-200/80 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-200/80 rounded-2xl" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-3xl">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h4 className="font-bold text-rose-900 text-base">Gagal Memuat Analitik Penjualan</h4>
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

  const { summary, kiloanVsSatuan, heatmap = [], topServices = [], byCashier = [], topPerfumes = [] } = data;

  // Bangun lookup map untuk heatmap 7x24
  const heatmapMap = new Map<string, { orders: number; amount: number }>();
  let maxCellOrders = 1;
  for (const item of heatmap || []) {
    const key = `${item.dayOfWeek}_${item.hour}`;
    heatmapMap.set(key, { orders: item.orderCount, amount: item.revenue });
    if (item.orderCount > maxCellOrders) maxCellOrders = item.orderCount;
  }

  return (
    <div className="space-y-6">
      {/* 1. Split Omzet Kiloan vs Satuan */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-blue-900" />
              Komposisi Penjualan: Layanan Kiloan vs Satuan
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Porsi kontribusi omzet dan volume dari layanan cuci kiloan berbanding dry clean / satuan.
            </p>
          </div>
        </div>

        {/* Progress Bar Proporsi */}
        <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex mb-4">
          <div
            className="bg-blue-900 h-full transition-all duration-500"
            style={{ width: `${kiloanVsSatuan?.kiloan?.sharePercent ?? 50}%` }}
            title={`Kiloan: ${kiloanVsSatuan?.kiloan?.sharePercent ?? 0}%`}
          />
          <div
            className="bg-indigo-500 h-full transition-all duration-500"
            style={{ width: `${kiloanVsSatuan?.satuan?.sharePercent ?? 50}%` }}
            title={`Satuan: ${kiloanVsSatuan?.satuan?.sharePercent ?? 0}%`}
          />
        </div>

        {/* 2 Kolom Detail Kiloan vs Satuan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Kolom Kiloan */}
          <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs uppercase tracking-wider text-blue-900">
                Layanan Kiloan ({kiloanVsSatuan?.kiloan?.sharePercent ?? 0}%)
              </span>
              <span className="text-xs text-blue-800 font-semibold">
                {kiloanVsSatuan?.kiloan?.orderCount ?? 0} Nota
              </span>
            </div>
            <div className="text-2xl font-extrabold text-blue-950 tabular-nums">
              {formatRupiah(kiloanVsSatuan?.kiloan?.revenue ?? 0)}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Total Item/Kg: <strong className="text-slate-800">{kiloanVsSatuan?.kiloan?.itemCount ?? 0} Kg</strong>
            </p>
          </div>

          {/* Kolom Satuan */}
          <div className="p-4 bg-indigo-50/60 border border-indigo-200/80 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs uppercase tracking-wider text-indigo-900">
                Layanan Satuan ({kiloanVsSatuan?.satuan?.sharePercent ?? 0}%)
              </span>
              <span className="text-xs text-indigo-800 font-semibold">
                {kiloanVsSatuan?.satuan?.orderCount ?? 0} Nota
              </span>
            </div>
            <div className="text-2xl font-extrabold text-indigo-950 tabular-nums">
              {formatRupiah(kiloanVsSatuan?.satuan?.revenue ?? 0)}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Total Potong: <strong className="text-slate-800">{kiloanVsSatuan?.satuan?.itemCount ?? 0} Pcs</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Kartu Ringkasan Pembatalan & Void */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold block mb-1">Tingkat Void / Batal</span>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {summary?.cancellationRate?.current ?? 0}%
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Rasio nota void/batal terhadap pesanan valid</p>
        </div>
        <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold block mb-1">Pesanan Dibatalkan</span>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {summary?.cancelledCount?.current ?? 0} Nota
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Refund: {formatRupiah(summary?.refundAmount?.current ?? 0)}</p>
        </div>
        <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold block mb-1">Pesanan Di-Void Kasir</span>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {summary?.voidedCount?.current ?? 0} Nota
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Total {summary?.refundCount?.current ?? 0} transaksi direfund</p>
        </div>
      </div>

      {/* 2. Heatmap Jam & Hari Sibuk (7 Hari x Jam Operasional 07:00-22:00) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-900" />
              Heatmap Jam Sibuk & Hari Operasional (WIB)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Identifikasi kepadatan antrean kasir. Klik pada sel untuk melihat nota yang masuk pada jam tersebut.
            </p>
          </div>

          {/* Scale Legend */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Sepi</span>
            <div className="flex items-center gap-0.5">
              <span className="w-3.5 h-3.5 rounded bg-slate-100" />
              <span className="w-3.5 h-3.5 rounded bg-blue-200" />
              <span className="w-3.5 h-3.5 rounded bg-blue-400" />
              <span className="w-3.5 h-3.5 rounded bg-blue-700" />
              <span className="w-3.5 h-3.5 rounded bg-blue-900" />
            </div>
            <span>Padat</span>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[560px]">
            {/* Header Jam */}
            <div className="grid grid-cols-17 gap-1 text-[10px] text-slate-400 font-semibold mb-1 text-center">
              <span className="text-left font-medium">Hari</span>
              {ACTIVE_HOURS.map((hr) => (
                <span key={hr}>{hr}</span>
              ))}
            </div>

            {/* Rows per Hari */}
            {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
              const dayName = DAY_NAMES[dayIdx];
              return (
                <div key={dayIdx} className="grid grid-cols-17 gap-1 items-center mb-1">
                  <span className="text-[11px] font-bold text-slate-700 truncate pr-1">
                    {dayName}
                  </span>
                  {ACTIVE_HOURS.map((hr) => {
                    const key = `${dayIdx}_${hr}`;
                    const val = heatmapMap.get(key) || { orders: 0, amount: 0 };
                    const intensity = val.orders > 0 ? Math.min(1, val.orders / maxCellOrders) : 0;

                    let bgClass = 'bg-slate-100 hover:bg-slate-200';
                    if (intensity > 0.75) bgClass = 'bg-blue-900 hover:bg-blue-950 text-white';
                    else if (intensity > 0.5) bgClass = 'bg-blue-700 hover:bg-blue-800 text-white';
                    else if (intensity > 0.25) bgClass = 'bg-blue-400 hover:bg-blue-500 text-white';
                    else if (intensity > 0) bgClass = 'bg-blue-200 hover:bg-blue-300 text-slate-900';

                    return (
                      <button
                        key={hr}
                        type="button"
                        onClick={() =>
                          onOpenDrilldown('ORDERS_BY_HOUR', {
                            dayOfWeek: dayIdx,
                            hour: hr,
                          })
                        }
                        onMouseEnter={() =>
                          setHoveredCell({
                            day: dayIdx,
                            hour: hr,
                            orders: val.orders,
                            amount: val.amount,
                          })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`h-7 rounded flex items-center justify-center text-[10px] font-bold transition-all cursor-pointer ${bgClass}`}
                        title={`${dayName} jam ${hr}:00 WIB (${val.orders} order)`}
                      >
                        {val.orders > 0 ? val.orders : ''}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Hover Feedback Bar */}
        {hoveredCell && (
          <div className="mt-2 text-xs bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 flex items-center justify-between text-slate-700">
            <span>
              <strong>{DAY_NAMES[hoveredCell.day]}</strong> pukul{' '}
              <strong>{hoveredCell.hour}:00 WIB</strong>
            </span>
            <span>
              {hoveredCell.orders} Nota Masuk • Omzet: <strong>{formatRupiah(hoveredCell.amount)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* 3. Baris 2 Kolom: Top 10 Layanan & Performa Kasir */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Kolom Kiri: Top Layanan Terlaris (Pareto) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500" />
            Top Layanan Terlaris (Pareto Omzet)
          </h4>

          {topServices.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Belum ada data penjualan layanan pada periode ini.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {topServices.slice(0, 10).map((svc, i) => (
                <div
                  key={svc.serviceId || i}
                  className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-bold text-slate-800 block truncate">
                      {i + 1}. {svc.serviceName}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {svc.orderCount} Nota • Kategori: {svc.category}
                    </span>
                  </div>
                  <strong className="text-slate-900 tabular-nums shrink-0">
                    {formatRupiah(svc.revenue)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kolom Kanan: Performa Penjualan Kasir & Top Parfum */}
        <div className="space-y-4">
          {/* Performa Kasir */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-900" />
              Performa Penjualan per Kasir
            </h4>

            {byCashier.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Belum ada data kasir yang bertugas.
              </p>
            ) : (
              <div className="space-y-2 text-xs">
                {byCashier.map((c) => (
                  <div
                    key={c.cashierId}
                    className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block">{c.cashierName}</span>
                      <span className="text-[11px] text-slate-400">
                        {c.validOrders} Nota Valid • Void Rate: {c.voidRate}%
                      </span>
                    </div>
                    <strong className="text-blue-900 font-extrabold tabular-nums">
                      {formatRupiah(c.totalRevenue)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Parfum Favorit */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              Parfum Paling Diminati Pelanggan
            </h4>

            {topPerfumes.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 text-center">
                Belum ada varian parfum yang tercatat.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {topPerfumes.slice(0, 4).map((p, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-bold text-slate-800 block truncate">
                      {p.perfumeVariant}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {p.orderCount}x Dipilih ({p.totalWeightKg} Kg)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
