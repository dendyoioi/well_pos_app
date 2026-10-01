import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import type { DailyTrendItem } from '../types/report';

interface SalesProfitTrendChartProps {
  dailyTrends: DailyTrendItem[];
}

export const SalesProfitTrendChart: React.FC<SalesProfitTrendChartProps> = ({ dailyTrends }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'bar' | 'line'>('bar');

  if (!dailyTrends || dailyTrends.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
        Belum ada data transaksi pada rentang periode yang dipilih untuk memuat grafik tren.
      </div>
    );
  }

  // Hitung nilai maksimum untuk scaling tinggi SVG
  const maxRevenue = Math.max(...dailyTrends.map((d) => d.revenue), 1000);
  const maxCogs = Math.max(...dailyTrends.map((d) => d.cogs), 0);
  const maxProfit = Math.max(...dailyTrends.map((d) => d.grossProfit), 0);
  const chartPeak = Math.max(maxRevenue, maxCogs + maxProfit) * 1.15; // 15% padding atas

  const svgHeight = 220;
  const svgWidth = Math.max(640, dailyTrends.length * 48);
  const paddingLeft = 55;
  const paddingBottom = 30;
  const paddingTop = 20;
  const plotWidth = svgWidth - paddingLeft - 20;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  const getX = (index: number) => {
    if (dailyTrends.length === 1) return paddingLeft + plotWidth / 2;
    return paddingLeft + (index / (dailyTrends.length - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    return paddingTop + plotHeight - (Math.max(0, val) / chartPeak) * plotHeight;
  };

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  };

  // Garis referensi horizontal (Gridlines)
  const gridTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => {
    const val = chartPeak * pct;
    return {
      value: val,
      y: getY(val),
      label: val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${Math.round(val / 1000)}k`,
    };
  });

  return (
    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
      {/* Header Grafik */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 border border-blue-200 flex items-center justify-center shadow-xs">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              Kurva Tren Penjualan, HPP &amp; Laba Kotor
            </h3>
            <p className="text-[11px] text-slate-500">
              Visualisasi perbandingan omzet bersih harian terhadap modal pokok (HPP) dan marjin laba.
            </p>
          </div>
        </div>

        {/* Legend & View Switcher */}
        <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
          <div className="flex items-center gap-2 text-[10px] font-bold">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />
              <span className="text-slate-600">Omzet Bersih</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
              <span className="text-slate-600">Laba Kotor</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 inline-block" />
              <span className="text-slate-500">HPP / Modal</span>
            </div>
          </div>

          <div className="bg-slate-100 p-0.5 rounded-lg flex items-center text-[10px] font-bold text-slate-600">
            <button
              type="button"
              onClick={() => setViewMode('bar')}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                viewMode === 'bar' ? 'bg-white text-blue-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Batang
            </button>
            <button
              type="button"
              onClick={() => setViewMode('line')}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                viewMode === 'line' ? 'bg-white text-blue-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Garis
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="overflow-x-auto relative">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-56 select-none"
          style={{ minWidth: '580px' }}
        >
          {/* Grid lines */}
          {gridTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={tick.y}
                x2={svgWidth - 20}
                y2={tick.y}
                stroke="#e2e8f0"
                strokeDasharray="2,2"
                strokeWidth="1"
              />
              <text
                x={paddingLeft - 8}
                y={tick.y + 3}
                textAnchor="end"
                fontSize="9"
                fontWeight="600"
                fill="#94a3b8"
                fontFamily="monospace"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {viewMode === 'bar' ? (
            /* Bar Chart Mode */
            dailyTrends.map((d, i) => {
              const xCenter = getX(i);
              const barWidth = Math.min(18, Math.max(8, plotWidth / (dailyTrends.length * 2.8)));

              const revY = getY(d.revenue);
              const revH = Math.max(2, plotHeight - (revY - paddingTop));

              const profitY = getY(d.grossProfit);
              const profitH = Math.max(2, plotHeight - (profitY - paddingTop));

              const isHovered = hoveredIndex === i;

              return (
                <g
                  key={i}
                  className="cursor-pointer transition-opacity"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Background highlight on hover */}
                  {isHovered && (
                    <rect
                      x={xCenter - barWidth * 1.5}
                      y={paddingTop}
                      width={barWidth * 3}
                      height={plotHeight}
                      fill="#f1f5f9"
                      rx="4"
                    />
                  )}

                  {/* Revenue Bar */}
                  <rect
                    x={xCenter - barWidth - 1}
                    y={revY}
                    width={barWidth}
                    height={revH}
                    fill={isHovered ? '#1d4ed8' : '#2563eb'}
                    rx="3"
                  />

                  {/* Profit Bar */}
                  <rect
                    x={xCenter + 1}
                    y={profitY}
                    width={barWidth}
                    height={profitH}
                    fill={isHovered ? '#059669' : '#10b981'}
                    rx="3"
                  />

                  {/* Date label at bottom */}
                  <text
                    x={xCenter}
                    y={svgHeight - 10}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight={isHovered ? 'bold' : 'normal'}
                    fill={isHovered ? '#0f172a' : '#64748b'}
                  >
                    {formatDate(d.date)}
                  </text>
                </g>
              );
            })
          ) : (
            /* Line/Area Mode */
            <>
              {/* Revenue Area & Line */}
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Area Fills */}
              <polygon
                points={`
                  ${dailyTrends.map((d, i) => `${getX(i)},${getY(d.revenue)}`).join(' ')}
                  ${getX(dailyTrends.length - 1)},${paddingTop + plotHeight}
                  ${getX(0)},${paddingTop + plotHeight}
                `}
                fill="url(#revGradient)"
              />
              <polygon
                points={`
                  ${dailyTrends.map((d, i) => `${getX(i)},${getY(d.grossProfit)}`).join(' ')}
                  ${getX(dailyTrends.length - 1)},${paddingTop + plotHeight}
                  ${getX(0)},${paddingTop + plotHeight}
                `}
                fill="url(#profitGradient)"
              />

              {/* Polylines */}
              <polyline
                points={dailyTrends.map((d, i) => `${getX(i)},${getY(d.cogs)}`).join(' ')}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1.5"
                strokeDasharray="3,3"
              />
              <polyline
                points={dailyTrends.map((d, i) => `${getX(i)},${getY(d.revenue)}`).join(' ')}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <polyline
                points={dailyTrends.map((d, i) => `${getX(i)},${getY(d.grossProfit)}`).join(' ')}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Interactive Dots */}
              {dailyTrends.map((d, i) => {
                const x = getX(i);
                const yRev = getY(d.revenue);
                const isHovered = hoveredIndex === i;

                return (
                  <g
                    key={i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {isHovered && (
                      <line
                        x1={x}
                        y1={paddingTop}
                        x2={x}
                        y2={paddingTop + plotHeight}
                        stroke="#cbd5e1"
                        strokeDasharray="2,2"
                        strokeWidth="1"
                      />
                    )}
                    <circle
                      cx={x}
                      cy={yRev}
                      r={isHovered ? 5 : 3.5}
                      fill="#2563eb"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <circle
                      cx={x}
                      cy={getY(d.grossProfit)}
                      r={isHovered ? 5 : 3.5}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text
                      x={x}
                      y={svgHeight - 10}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight={isHovered ? 'bold' : 'normal'}
                      fill={isHovered ? '#0f172a' : '#64748b'}
                    >
                      {formatDate(d.date)}
                    </text>
                  </g>
                );
              })}
            </>
          )}
        </svg>

        {/* Hover Floating Tooltip */}
        {hoveredIndex !== null && dailyTrends[hoveredIndex] && (
          <div className="absolute top-2 right-4 p-3 bg-slate-900/90 text-white rounded-xl shadow-xl backdrop-blur-xs text-xs space-y-1 border border-slate-700 pointer-events-none animate-in fade-in duration-100">
            <div className="font-bold text-slate-300 pb-1 border-b border-slate-700/60 flex items-center justify-between gap-4">
              <span>Tanggal: {dailyTrends[hoveredIndex].date}</span>
              <span className="text-[10px] text-blue-400 font-mono">
                {dailyTrends[hoveredIndex].ordersCount} Transaksi
              </span>
            </div>
            <div className="flex justify-between gap-4 pt-0.5">
              <span className="text-slate-400">Omzet Bersih:</span>
              <span className="font-bold text-white font-mono">
                Rp {dailyTrends[hoveredIndex].revenue.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">HPP / Biaya Bahan:</span>
              <span className="font-semibold text-slate-300 font-mono">
                Rp {dailyTrends[hoveredIndex].cogs.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between gap-4 pt-0.5 border-t border-slate-700/60 text-emerald-400 font-bold">
              <span>Laba Kotor:</span>
              <span className="font-mono">
                Rp {dailyTrends[hoveredIndex].grossProfit.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
