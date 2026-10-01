import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  Download,
  Calendar,
  ShoppingCart,
  Receipt,
  CreditCard,
  Layers,
  ArrowUpRight,
  Loader2,
  BarChart2,
  TableProperties,
  Clock,
  ChevronDown,
  Package,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api';
import type { Outlet } from '../../types/outlet';
import type { Order } from '../../types/order';
import { formatRupiah } from '../../utils/currency';
import { useDialog } from '../../context/DialogContext';
import { exportOrdersToCsv } from '../../utils/salesExportCsv';

interface BusinessSummaryViewProps {
  activeOutlet: Outlet | null;
  onOpenPos?: () => void;
}

import { toLocalDateStr, getLocalStartOfDay, getLocalEndOfDay } from '../../utils/date';

type DatePreset = 'today' | '7days' | '30days' | 'thismonth' | 'custom';
const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Hari Ini', '7days': '7 Hari Terakhir', '30days': '30 Hari Terakhir',
  thismonth: 'Bulan Ini', custom: 'Kustom',
};

function getPresetRange(preset: DatePreset): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case 'today': return { start: getLocalStartOfDay(now), end: getLocalEndOfDay(now) };
    case '7days': return { start: getLocalStartOfDay(new Date(now.getTime() - 6 * 86400_000)), end: getLocalEndOfDay(now) };
    case '30days': return { start: getLocalStartOfDay(new Date(now.getTime() - 29 * 86400_000)), end: getLocalEndOfDay(now) };
    case 'thismonth': return { start: getLocalStartOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), end: getLocalEndOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)) };
    default: return { start: getLocalStartOfDay(now), end: getLocalEndOfDay(now) };
  }
}

// ─── Chart helpers ────────────────────────────────────────────────────────────
interface BarItem { label: string; value: number; color: string; }
function MiniBarChart({ data }: { data: BarItem[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const BAR_W = 42, GAP = 14, H = 110, LABEL_H = 28;
  const totalW = data.length * (BAR_W + GAP) - GAP + 8;
  return (
    <svg width={totalW} height={H + LABEL_H} style={{ overflow: 'visible' }}>
      {data.map((item, i) => {
        const barH = Math.max(4, (item.value / max) * H);
        const x = i * (BAR_W + GAP);
        const y = H - barH;
        return (
          <g key={item.label}>
            <rect x={x} y={y} width={BAR_W} height={barH} rx={6} fill={item.color} opacity={0.82} />
            <text x={x + BAR_W / 2} y={y - 5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#1e293b">
              {item.value >= 1_000_000 ? `${(item.value/1_000_000).toFixed(1)}jt` : item.value >= 1000 ? `${(item.value/1000).toFixed(0)}rb` : item.value}
            </text>
            <text x={x + BAR_W / 2} y={H + LABEL_H - 4} textAnchor="middle" fontSize="9" fill="#64748b">
              {item.label.length > 9 ? item.label.slice(0, 9) + '…' : item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface DonutItem { label: string; value: number; color: string; }
function DonutChart({ data, size = 110 }: { data: DonutItem[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={size/2 - 12} fill="none" stroke="#e2e8f0" strokeWidth={18} />
    </svg>
  );
  const r = size / 2 - 12, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {data.map((item, i) => {
        const dash = (item.value / total) * circ;
        const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={item.color} strokeWidth={18}
          strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} />;
        offset += dash;
        return el;
      })}
    </svg>
  );
}

function TrendLine({ points, color = '#1d4ed8' }: { points: { x: string; y: number }[]; color?: string }) {
  if (points.length < 2) return <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', margin: 0 }}>Butuh min. 2 hari data.</p>;
  const W = 400, H = 80;
  const maxY = Math.max(...points.map(p => p.y), 1);
  const minY = Math.min(...points.map(p => p.y), 0);
  const norm = (v: number) => H - ((v - minY) / (maxY - minY + 1)) * (H - 12) - 6;
  const step = W / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step},${norm(p.y)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80 }}>
      <defs>
        <linearGradient id={`tg_${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${d} L ${(points.length-1)*step},${H} L 0,${H} Z`} fill={`url(#tg_${color.replace('#','')})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => <circle key={i} cx={i * step} cy={norm(p.y)} r={3} fill={color} />)}
    </svg>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────
const COLORS = ['#1d4ed8','#16a34a','#ea580c','#7c3aed','#dc2626','#0891b2','#ca8a04','#db2777'];

function PanelHeader({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: string }) {
  return (
    <div style={{ padding: '11px 16px', background: 'rgba(241,245,249,0.75)', borderBottom: '1px solid #e2e8f0',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h3 style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase',
        letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}{title}
      </h3>
      {badge && <span style={{ fontSize: 10, color: '#94a3b8' }}>{badge}</span>}
    </div>
  );
}

function RowCard({ left, right, subLeft, subRight, accent, highlight }:
  { left: string; right: string; subLeft?: string; subRight?: string; accent?: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px',
      borderRadius: 10, background: highlight ? '#eff6ff' : '#f8fafc',
      border: `1px solid ${highlight ? '#bfdbfe' : '#f1f5f9'}`, gap: 8 }}>
      <div>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{left}</p>
        {subLeft && <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>{subLeft}</p>}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 900, color: accent ?? '#0f172a' }}>{right}</p>
        {subRight && <p style={{ margin: 0, fontSize: 10, color: accent ?? '#94a3b8', fontWeight: 700 }}>{subRight}</p>}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: '28px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
      <ShoppingCart size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
      <p style={{ margin: 0 }}>{message}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const BusinessSummaryView: React.FC<BusinessSummaryViewProps> = ({ activeOutlet, onOpenPos }) => {
  const dialog = useDialog();

  // View state
  const [subTab, setSubTab] = useState<'data' | 'grafik'>('data');
  const [pill, setPill] = useState<'operasional' | 'pembayaran' | 'produk'>('operasional');

  // Filter state
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [preset, setPreset] = useState<DatePreset>('today');
  const [customStart, setCustomStart] = useState(toLocalDateStr(new Date()));
  const [customEnd, setCustomEnd] = useState(toLocalDateStr(new Date()));
  const [showDateDrop, setShowDateDrop] = useState(false);
  const [timeMode, setTimeMode] = useState<'24h' | 'custom'>('24h');
  const [startHour, setStartHour] = useState('00:00');
  const [endHour, setEndHour] = useState('23:59');

  // Data state
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const dateRange = useMemo(() => {
    if (preset === 'custom') {
      return { start: getLocalStartOfDay(new Date(customStart + 'T00:00:00')), end: getLocalEndOfDay(new Date(customEnd + 'T23:59:59')) };
    }
    return getPresetRange(preset);
  }, [preset, customStart, customEnd]);

  // Fetch orders
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getOrders({ outletId: activeOutlet?.id, limit: 500 });
      if (res.status === 'success' && res.data) setAllOrders(res.data);
    } catch (e) { console.error('BusinessSummary fetch error:', e); }
    finally { setLoading(false); }
  }, [activeOutlet?.id]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Filter in-memory
  const filtered = useMemo(() => allOrders.filter(o => {
    const at = new Date(o.createdAt);
    if (at < dateRange.start || at > dateRange.end) return false;
    if (timeMode === 'custom') {
      const [sh, sm] = startHour.split(':').map(Number);
      const [eh, em] = endHour.split(':').map(Number);
      const om = at.getHours() * 60 + at.getMinutes();
      if (om < sh * 60 + sm || om > eh * 60 + em) return false;
    }
    if (channelFilter !== 'ALL') {
      const ch = (o.channel || '').toUpperCase();
      if (channelFilter === 'OFFLINE' && !['DINE_IN','TAKEAWAY','QR_MENU','DELIVERY'].includes(ch)) return false;
      if (channelFilter === 'ONLINE' && !['GOFOOD','GRABFOOD','SHOPEEFOOD'].includes(ch)) return false;
      if (channelFilter === 'GOFOOD' && ch !== 'GOFOOD') return false;
      if (channelFilter === 'GRABFOOD' && ch !== 'GRABFOOD') return false;
      if (channelFilter === 'SHOPEEFOOD' && ch !== 'SHOPEEFOOD') return false;
    }
    if (serviceFilter !== 'ALL') {
      const ch = (o.channel || '').toUpperCase();
      if (serviceFilter === 'DINE_IN' && !['DINE_IN','QR_MENU'].includes(ch)) return false;
      if (serviceFilter === 'TAKE_AWAY' && !['TAKEAWAY','TAKE_AWAY'].includes(ch)) return false;
      if (serviceFilter === 'DELIVERY' && ch !== 'DELIVERY') return false;
      if (serviceFilter === 'ONLINE_DELIVERY' && !['GOFOOD','GRABFOOD','SHOPEEFOOD'].includes(ch)) return false;
    }
    return true;
  }), [allOrders, dateRange, timeMode, startHour, endHour, channelFilter, serviceFilter]);

  // Compute metrics
  const m = useMemo(() => {
    let totalSales = 0, subtotal = 0, tax = 0, svc = 0, disc = 0;
    let dineInS = 0, dineInC = 0, takeS = 0, takeC = 0;
    let kurirS = 0, kurirC = 0;
    let gofoodS = 0, gofoodC = 0;
    let grabfoodS = 0, grabfoodC = 0;
    let shopeefoodS = 0, shopeefoodC = 0;
    let onlineMitraS = 0, onlineMitraC = 0;
    let cash = 0, qris = 0, card = 0, transfer = 0, costTotal = 0;
    const catMap: Record<string, { sales: number; qty: number }> = {};
    const prodMap: Record<string, { name: string; cat: string; sales: number; qty: number }> = {};

    filtered.forEach(o => {
      const amt = Number(o.grandTotal ?? o.totalAmount ?? 0);
      totalSales += amt;
      subtotal += Number(o.subtotal ?? 0);
      tax += Number(o.taxAmount ?? o.taxTotal ?? 0);
      svc += Number(o.serviceCharge ?? o.serviceTotal ?? 0);
      disc += Number(o.discountAmount ?? o.discountTotal ?? 0);

      const ch = (o.channel ?? o.orderType ?? '').toUpperCase();
      if (['DINE_IN','QR_MENU'].includes(ch) || (!ch && o.orderType === 'DINE_IN')) {
        dineInS += amt; dineInC++;
      } else if (['TAKEAWAY', 'TAKE_AWAY'].includes(ch)) {
        takeS += amt; takeC++;
      } else if (ch === 'DELIVERY') {
        kurirS += amt; kurirC++;
      } else if (ch === 'GOFOOD') {
        gofoodS += amt; gofoodC++;
        onlineMitraS += amt; onlineMitraC++;
      } else if (ch === 'GRABFOOD') {
        grabfoodS += amt; grabfoodC++;
        onlineMitraS += amt; onlineMitraC++;
      } else if (ch === 'SHOPEEFOOD') {
        shopeefoodS += amt; shopeefoodC++;
        onlineMitraS += amt; onlineMitraC++;
      } else {
        dineInS += amt; dineInC++;
      }

      // Payment
      if (o.payments?.length) {
        o.payments.forEach(p => {
          const pa = Number(p.amountPaid ?? p.amount ?? 0);
          const pm = (p.method ?? p.paymentMethod ?? '').toUpperCase();
          if (pm === 'QRIS') qris += pa;
          else if (['DEBIT','CREDIT','DEBIT_CARD','CREDIT_CARD'].includes(pm)) card += pa;
          else if (['TRANSFER','BANK_TRANSFER'].includes(pm)) transfer += pa;
          else cash += pa;
        });
      } else { cash += amt; }

      // Items
      (o.orderItems ?? []).forEach((item: any) => {
        const catName = item.product?.category?.name ?? item.categoryName ?? 'Lainnya';
        const prodName = item.product?.name ?? item.productName ?? 'Produk';
        const itemS = Number(item.subtotal != null ? item.subtotal : ((item.unitPrice || 0) * (item.quantity || 0)));
        const itemQ = Number(item.quantity ?? 0);
        costTotal += Number(item.costPrice ?? 0) * itemQ;
        if (!catMap[catName]) catMap[catName] = { sales: 0, qty: 0 };
        catMap[catName].sales += itemS; catMap[catName].qty += itemQ;
        if (!prodMap[prodName]) prodMap[prodName] = { name: prodName, cat: catName, sales: 0, qty: 0 };
        prodMap[prodName].sales += itemS; prodMap[prodName].qty += itemQ;
      });
    });

    const gp = costTotal > 0 ? Math.max(0, subtotal - costTotal) : Math.round(subtotal * 0.4);
    const margin = subtotal > 0 ? Math.round((gp / subtotal) * 100) : 0;
    const aov = filtered.length > 0 ? Math.round(totalSales / filtered.length) : 0;
    const topCat = Object.entries(catMap).map(([n,v]) => ({ name: n, ...v })).sort((a,b) => b.sales - a.sales);
    const topProd = Object.values(prodMap).sort((a,b) => b.sales - a.sales).slice(0, 10);

    return { totalSales, subtotal, tax, svc, disc, aov,
      dineInS, dineInC, takeS, takeC,
      kurirS, kurirC,
      gofoodS, gofoodC,
      grabfoodS, grabfoodC,
      shopeefoodS, shopeefoodC,
      onlineMitraS, onlineMitraC,
      delS: kurirS + onlineMitraS,
      delC: kurirC + onlineMitraC,
      cash, qris, card, transfer, gp, margin, topCat, topProd };
  }, [filtered]);

  const dailyTrend = useMemo(() => {
    const map: Record<string, { sales: number; orders: number }> = {};
    filtered.forEach(o => {
      const d = new Date(o.createdAt).toISOString().slice(0, 10);
      if (!map[d]) map[d] = { sales: 0, orders: 0 };
      map[d].sales += Number(o.grandTotal ?? o.totalAmount ?? 0);
      map[d].orders++;
    });
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([d, v]) => ({ x: d.slice(5), ...v }));
  }, [filtered]);

  const handleExport = () => {
    const ok = exportOrdersToCsv(filtered, `ringkasan_bisnis_${activeOutlet?.name?.replace(/\s+/g, '_') ?? 'outlet'}`,
      msg => dialog.toast(msg, 'error'));
    if (ok) dialog.toast(`Berhasil mengekspor ${filtered.length} transaksi ke CSV.`, 'success');
  };

  const dateLabel = preset !== 'custom' ? PRESET_LABELS[preset] : `${customStart} – ${customEnd}`;

  // ── Style helpers (inline to stay Vanilla-CSS friendly) ────────────────────
  const card: React.CSSProperties = { background:'#fff', borderRadius:16, border:'1px solid #e2e8f0',
    boxShadow:'0 1px 4px rgba(0,0,0,0.04)', overflow:'hidden' };
  const grid2: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px,1fr))', gap:20 };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, fontFamily:'Inter, system-ui, sans-serif', position:'relative' }}>

      {loading && (
        <div style={{ position:'absolute', top:0, right:0, display:'flex', alignItems:'center', gap:5,
          fontSize:11, color:'#1d4ed8', fontWeight:700, zIndex:10 }}>
          <Loader2 size={13} style={{ animation:'spin 1s linear infinite' }} /> Memuat data...
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-1">
            <span>Laporan</span>
            <span>/</span>
            <span className="text-slate-800 font-bold">Ringkasan Bisnis</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Ringkasan Bisnis
            </h1>
            {activeOutlet && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {activeOutlet.name}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Subtab toggle */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
            {(['data', 'grafik'] as const).map(t => (
              <button
                key={t}
                onClick={() => setSubTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  subTab === t
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t === 'data' ? <TableProperties size={13} /> : <BarChart2 size={13} />}
                <span>{t === 'data' ? 'Data' : 'Statistik Grafik'}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadOrders()}
              disabled={loading}
              title="Segarkan data ringkasan bisnis"
              className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Segarkan</span>
            </button>

            {onOpenPos && (
              <button
                onClick={onOpenPos}
                className="px-3.5 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
              >
                <span>Buka Kasir</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {(['operasional', 'pembayaran', 'produk'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPill(p)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
              pill === p
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {p === 'operasional' ? 'Operasional' : p === 'pembayaran' ? 'Pembayaran' : 'Produk'}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-2xs space-y-3">
        {/* Row 1: Saluran & Layanan Selector (Grid 2 kolom seimbang di mobile, sejajar di desktop) */}
        <div className="grid grid-cols-2 lg:flex items-center gap-2 sm:gap-2.5 w-full">
          {/* Saluran */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 flex-1 lg:max-w-xs transition-colors focus-within:border-blue-400 focus-within:bg-white">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase sm:normal-case tracking-wider sm:tracking-normal shrink-0">Saluran</span>
            <select
              value={channelFilter}
              onChange={e => setChannelFilter(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-bold text-slate-800 outline-none cursor-pointer flex-1 min-w-0 truncate"
            >
              <option value="ALL">Semua Saluran</option>
              <option value="OFFLINE">Kasir Langsung (POS)</option>
              <option value="ONLINE">Mitra Online (Semua Ojol)</option>
              <option value="GOFOOD">Mitra GoFood</option>
              <option value="GRABFOOD">Mitra GrabFood</option>
              <option value="SHOPEEFOOD">Mitra ShopeeFood</option>
            </select>
          </div>

          {/* Jenis Layanan */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 flex-1 lg:max-w-xs transition-colors focus-within:border-blue-400 focus-within:bg-white">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase sm:normal-case tracking-wider sm:tracking-normal shrink-0">Layanan</span>
            <select
              value={serviceFilter}
              onChange={e => setServiceFilter(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-bold text-slate-800 outline-none cursor-pointer flex-1 min-w-0 truncate"
            >
              <option value="ALL">Semua Jenis</option>
              <option value="DINE_IN">Makan di Tempat (Dine In)</option>
              <option value="TAKE_AWAY">Bawa Pulang (Take Away)</option>
              <option value="DELIVERY">Kurir Toko (Internal)</option>
              <option value="ONLINE_DELIVERY">Mitra Online Delivery</option>
            </select>
          </div>
        </div>

        {/* Row 2: Date Picker, Jam, & Ekspor CSV */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Date picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDateDrop(v => !v)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-800 transition-colors cursor-pointer"
              >
                <Calendar size={13} className="text-slate-500" />
                <span>{dateLabel}</span>
                <ChevronDown size={12} className="text-slate-500" />
              </button>
              {showDateDrop && (
                <div className="absolute top-[calc(100%+6px)] left-0 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 min-w-[200px] p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                  {(['today','7days','30days','thismonth','custom'] as DatePreset[]).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { setPreset(p); if (p !== 'custom') setShowDateDrop(false); }}
                      className={`block w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        preset === p ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {PRESET_LABELS[p]}
                    </button>
                  ))}
                  {preset === 'custom' && (
                    <div className="p-2 border-t border-slate-100 mt-1 flex flex-col gap-2">
                      {[['Dari:', customStart, setCustomStart], ['Sampai:', customEnd, setCustomEnd]].map(([lbl, val, setter]) => (
                        <div key={lbl as string} className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500 font-semibold min-w-[42px]">{lbl as string}</span>
                          <input
                            type="date"
                            value={val as string}
                            onChange={e => (setter as Function)(e.target.value)}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none flex-1 bg-white"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setShowDateDrop(false)}
                        className="w-full py-1.5 rounded-lg bg-blue-900 text-white font-bold text-xs hover:bg-blue-800 transition-colors"
                      >
                        Terapkan
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Time Mode Radio */}
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              {(['24h','custom'] as const).map(tm => (
                <label key={tm} className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700">
                  <input
                    type="radio"
                    name="timeMode"
                    checked={timeMode === tm}
                    onChange={() => setTimeMode(tm)}
                    className="accent-blue-900 w-3.5 h-3.5"
                  />
                  <span>{tm === '24h' ? '24 Jam' : 'Pilih Jam'}</span>
                </label>
              ))}
              {timeMode === 'custom' && (
                <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-slate-200">
                  <Clock size={12} className="text-slate-500" />
                  {[startHour, endHour].map((val, i) => (
                    <React.Fragment key={i}>
                      {i === 1 && <span className="text-slate-400">–</span>}
                      <input
                        type="time"
                        value={val}
                        onChange={e => i === 0 ? setStartHour(e.target.value) : setEndHour(e.target.value)}
                        className="text-xs border border-slate-200 rounded-lg px-1.5 py-0.5 outline-none w-16 bg-white"
                      />
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ekspor CSV */}
          <button
            type="button"
            onClick={handleExport}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <Download size={13} className="text-slate-500" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* ── 3 KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {[
          { label:'Pembayaran Diterima', value: formatRupiah(m.totalSales), sub:`${m.totalSales > 0 ? m.dineInC + m.takeC + m.delC : 0} Transaksi`, icon:'Rp', bg:'#ecfdf5', ic:'#16a34a', foot:'Omset bersih masuk', fc:'#16a34a' },
          { label:'Volume Pesanan', value:`${filtered.length} pesanan`, sub:`AOV ${formatRupiah(m.aov)}`, icon:<ShoppingCart size={15}/>, bg:'#eff6ff', ic:'#1d4ed8', foot:'Frekuensi transaksi', fc:'#1d4ed8' },
          { label:'Laba Kotor (Est.)', value: formatRupiah(m.gp), sub:`~${m.margin}% Margin`, icon:<TrendingUp size={15}/>, bg:'#faf5ff', ic:'#7c3aed', foot:'Margin pendapatan kotor', fc:'#7c3aed' },
        ].map(card2 => (
          <div key={card2.label} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{card2.label}</span>
              <div
                style={{ background: card2.bg, color: card2.ic }}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0"
              >
                {card2.icon}
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{card2.value}</p>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>{card2.foot}</span>
              <span style={{ color: card2.fc }} className="font-bold flex items-center gap-1">
                <ArrowUpRight size={12} />
                <span>{card2.sub}</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── DATA TAB CONTENT ─────────────────────────────────────────────────── */}
      {subTab === 'data' && (
        <>
          {/* OPERASIONAL */}
          {pill === 'operasional' && (
            <div style={grid2}>
              {/* Panel 1: Saluran & Jenis Pesanan */}
              <div style={card}>
                <PanelHeader icon={<Layers size={13} color="#1d4ed8" />} title="Rincian Saluran & Jenis Pesanan" badge="Penjualan & Volume" />
                <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
                  {filtered.length === 0 ? <EmptyState message="Belum ada transaksi pada periode ini." /> : (
                    <>
                      {/* Layanan Langsung Toko */}
                      <div style={{ fontSize:10, fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.4px', marginTop:2 }}>
                        Layanan Langsung Toko (POS)
                      </div>
                      <RowCard left="Makan di Tempat (Dine In)" subLeft={`${m.dineInC} pesanan`}
                        right={formatRupiah(m.dineInS)}
                        subRight={m.totalSales > 0 ? `${Math.round(m.dineInS/m.totalSales*100)}%` : '0%'}
                        accent="#16a34a" />
                      <RowCard left="Bawa Pulang (Take Away)" subLeft={`${m.takeC} pesanan`}
                        right={formatRupiah(m.takeS)}
                        subRight={m.totalSales > 0 ? `${Math.round(m.takeS/m.totalSales*100)}%` : '0%'}
                        accent="#ea580c" />
                      <RowCard left="Kurir Toko (Delivery Internal)" subLeft={`${m.kurirC} pesanan`}
                        right={formatRupiah(m.kurirS)}
                        subRight={m.totalSales > 0 ? `${Math.round(m.kurirS/m.totalSales*100)}%` : '0%'}
                        accent="#0284c7" />

                      {/* Mitra Online Delivery */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:10, fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.4px', marginTop:6, paddingTop:6, borderTop:'1px dashed #e2e8f0' }}>
                        <span>Mitra Online Delivery (Ojol)</span>
                        <span style={{ color:'#059669', fontWeight:800 }}>Total: {formatRupiah(m.onlineMitraS)} ({m.onlineMitraC} pesanan)</span>
                      </div>
                      <RowCard left="Mitra GoFood" subLeft={`${m.gofoodC} pesanan online`}
                        right={formatRupiah(m.gofoodS)}
                        subRight={m.totalSales > 0 ? `${Math.round(m.gofoodS/m.totalSales*100)}%` : '0%'}
                        accent="#00aa13" />
                      <RowCard left="Mitra GrabFood" subLeft={`${m.grabfoodC} pesanan online`}
                        right={formatRupiah(m.grabfoodS)}
                        subRight={m.totalSales > 0 ? `${Math.round(m.grabfoodS/m.totalSales*100)}%` : '0%'}
                        accent="#00b14f" />
                      <RowCard left="Mitra ShopeeFood" subLeft={`${m.shopeefoodC} pesanan online`}
                        right={formatRupiah(m.shopeefoodS)}
                        subRight={m.totalSales > 0 ? `${Math.round(m.shopeefoodS/m.totalSales*100)}%` : '0%'}
                        accent="#ee4d2d" />
                    </>
                  )}
                </div>
              </div>

              {/* Panel 2: Diskon & Pembulatan */}
              <div style={card}>
                <PanelHeader icon={<Receipt size={13} color="#ca8a04" />} title="Komposisi Diskon & Biaya" badge="Potongan Harga" />
                <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:9 }}>
                  <RowCard left="Total Potongan Diskon" right={`-${formatRupiah(m.disc)}`} accent="#dc2626" />
                  <RowCard left="Pajak (PPN)" right={formatRupiah(m.tax)} />
                  <RowCard left="Biaya Layanan (Service Charge)" right={formatRupiah(m.svc)} />
                  <RowCard left="Total Penjualan Bersih (Grand Total)" right={formatRupiah(m.totalSales)} highlight />
                </div>
              </div>
            </div>
          )}

          {/* PEMBAYARAN */}
          {pill === 'pembayaran' && (
            <div style={grid2}>
              {/* Panel: Kanal Pembayaran */}
              <div style={card}>
                <PanelHeader icon={<CreditCard size={13} color="#7c3aed" />} title="Perincian Metode Pembayaran" badge="Kanal Pembayaran" />
                <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:9 }}>
                  {filtered.length === 0 ? <EmptyState message="Belum ada pembayaran pada periode ini." /> : (
                    [
                      { label:'Tunai (Cash)', value: m.cash, color:'#16a34a' },
                      { label:'QRIS (GoPay, OVO, Dana, dll)', value: m.qris, color:'#1d4ed8' },
                      { label:'Kartu Debit / Kredit (EDC)', value: m.card, color:'#7c3aed' },
                      { label:'Transfer Bank', value: m.transfer, color:'#ca8a04' },
                    ].map(r => {
                      const pct = m.totalSales > 0 ? Math.round(r.value / m.totalSales * 100) : 0;
                      return (
                        <div key={r.label} style={{ padding:'9px 12px', borderRadius:10, background:'#f8fafc', border:'1px solid #f1f5f9' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                            <span style={{ fontSize:12, fontWeight:700, color:'#1e293b' }}>{r.label}</span>
                            <div style={{ textAlign:'right' }}>
                              <span style={{ fontSize:12, fontWeight:900, color:'#0f172a' }}>{formatRupiah(r.value)}</span>
                              <span style={{ fontSize:10, color:r.color, fontWeight:700, marginLeft:6 }}>{pct}%</span>
                            </div>
                          </div>
                          <div style={{ height:4, borderRadius:2, background:'#e2e8f0' }}>
                            <div style={{ height:4, borderRadius:2, background:r.color, width:`${pct}%`, transition:'width 0.4s' }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Panel: Rekonsiliasi Kas */}
              <div style={card}>
                <PanelHeader icon={<Receipt size={13} color="#16a34a" />} title="Rekonsiliasi Kas" badge="Ringkasan" />
                <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:9 }}>
                  <RowCard left="Total Penjualan Bruto" right={formatRupiah(m.subtotal)} />
                  <RowCard left="(-) Total Diskon" right={`-${formatRupiah(m.disc)}`} accent="#dc2626" />
                  <RowCard left="(+) Pajak (PPN)" right={formatRupiah(m.tax)} accent="#ca8a04" />
                  <RowCard left="(+) Biaya Layanan" right={formatRupiah(m.svc)} accent="#7c3aed" />
                  <RowCard left="= Grand Total Bersih" right={formatRupiah(m.totalSales)} highlight />
                  <div style={{ marginTop:4, padding:'9px 12px', borderRadius:10, background:'#f0fdf4', border:'1px solid #bbf7d0' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontWeight:700 }}>
                      <span style={{ color:'#166534' }}>Estimasi Laba Kotor</span>
                      <span style={{ color:'#16a34a', fontWeight:900 }}>{formatRupiah(m.gp)} (~{m.margin}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PRODUK */}
          {pill === 'produk' && (
            <div style={grid2}>
              {/* Panel: Per Kategori */}
              <div style={card}>
                <PanelHeader icon={<ShoppingCart size={13} color="#16a34a" />} title="Penjualan per Kategori" badge="Top Kategori" />
                <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:9 }}>
                  {m.topCat.length === 0 ? <EmptyState message="Belum ada data produk pada periode ini." /> :
                    m.topCat.map((cat, i) => (
                      <div key={cat.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'9px 12px', borderRadius:10, background:'#f8fafc', border:'1px solid #f1f5f9', gap:8 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ width:22, height:22, borderRadius:6, flexShrink:0,
                            background:COLORS[i % COLORS.length] + '22', color:COLORS[i % COLORS.length],
                            display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:10 }}>
                            {i + 1}
                          </span>
                          <div>
                            <p style={{ margin:0, fontSize:12, fontWeight:700, color:'#1e293b' }}>{cat.name}</p>
                            <p style={{ margin:0, fontSize:10, color:'#94a3b8' }}>{cat.qty} item terjual</p>
                          </div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <p style={{ margin:0, fontSize:12, fontWeight:900, color:'#0f172a' }}>{formatRupiah(cat.sales)}</p>
                          <p style={{ margin:0, fontSize:10, fontWeight:700, color:COLORS[i % COLORS.length] }}>
                            {m.totalSales > 0 ? Math.round(cat.sales / m.totalSales * 100) : 0}%
                          </p>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Panel: Top Produk */}
              <div style={card}>
                <PanelHeader icon={<Package size={13} color="#7c3aed" />} title="Produk Terlaris" badge="Top 10" />
                <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:9 }}>
                  {m.topProd.length === 0 ? <EmptyState message="Belum ada data produk pada periode ini." /> :
                    m.topProd.map((prod, i) => (
                      <div key={prod.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'9px 12px', borderRadius:10, background:'#f8fafc', border:'1px solid #f1f5f9', gap:8 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ width:22, height:22, borderRadius:6, flexShrink:0,
                            background:COLORS[i % COLORS.length] + '22', color:COLORS[i % COLORS.length],
                            display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:10 }}>
                            {i + 1}
                          </span>
                          <div>
                            <p style={{ margin:0, fontSize:12, fontWeight:700, color:'#1e293b' }}>{prod.name}</p>
                            <p style={{ margin:0, fontSize:10, color:'#94a3b8' }}>{prod.cat}</p>
                          </div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <p style={{ margin:0, fontSize:12, fontWeight:900, color:'#0f172a' }}>{formatRupiah(prod.sales)}</p>
                          <p style={{ margin:0, fontSize:10, fontWeight:700, color:'#7c3aed' }}>{prod.qty} qty</p>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── GRAFIK TAB ─────────────────────────────────────────────────────── */}
      {subTab === 'grafik' && (
        <div style={grid2}>
          {/* Tren Penjualan - full width */}
          <div style={{ ...card, gridColumn:'1 / -1' }}>
            <PanelHeader icon={<TrendingUp size={13} color="#1d4ed8" />} title="Tren Penjualan Harian" badge="Grafik Kurva" />
            <div style={{ padding:'14px 16px' }}>
              <p style={{ margin:'0 0 4px', fontSize:10, color:'#94a3b8' }}>Total Penjualan (Rp)</p>
              <TrendLine points={dailyTrend.map(d => ({ x: d.x, y: d.sales }))} color="#1d4ed8" />
              <p style={{ margin:'12px 0 4px', fontSize:10, color:'#94a3b8' }}>Volume Pesanan</p>
              <TrendLine points={dailyTrend.map(d => ({ x: d.x, y: d.orders }))} color="#16a34a" />
            </div>
          </div>

          {/* Bar: Jenis Pesanan */}
          <div style={card}>
            <PanelHeader icon={<Layers size={13} color="#1d4ed8" />} title="Distribusi Jenis Pesanan" badge="Bar Chart" />
            <div style={{ padding:'14px 16px', overflowX:'auto' }}>
              {filtered.length === 0 ? <EmptyState message="Belum ada data." /> : (
                <>
                  <MiniBarChart data={[
                    { label:'Dine In', value: m.dineInS, color:'#16a34a' },
                    { label:'Take Away', value: m.takeS, color:'#ea580c' },
                    { label:'Kurir Toko', value: m.kurirS, color:'#0284c7' },
                    { label:'GoFood', value: m.gofoodS, color:'#00aa13' },
                    { label:'GrabFood', value: m.grabfoodS, color:'#00b14f' },
                    { label:'ShopeeFood', value: m.shopeefoodS, color:'#ee4d2d' },
                  ]} />
                  <div style={{ marginTop:10, display:'flex', flexWrap:'wrap', gap:10 }}>
                    {[
                      { l:'Dine In', c:'#16a34a', v:m.dineInC },
                      { l:'Take Away', c:'#ea580c', v:m.takeC },
                      { l:'Kurir Toko', c:'#0284c7', v:m.kurirC },
                      { l:'GoFood', c:'#00aa13', v:m.gofoodC },
                      { l:'GrabFood', c:'#00b14f', v:m.grabfoodC },
                      { l:'ShopeeFood', c:'#ee4d2d', v:m.shopeefoodC },
                    ].map(leg => (
                      <span key={leg.l} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10 }}>
                        <span style={{ width:8, height:8, borderRadius:2, background:leg.c, display:'inline-block' }} />
                        <span style={{ color:'#64748b' }}>{leg.l}</span>
                        <strong style={{ color:'#1e293b' }}>{leg.v} pesanan</strong>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Donut: Metode Bayar */}
          <div style={card}>
            <PanelHeader icon={<CreditCard size={13} color="#7c3aed" />} title="Distribusi Metode Bayar" badge="Donut Chart" />
            <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
              <div style={{ flexShrink:0 }}>
                <DonutChart size={110} data={[
                  { label:'Tunai', value: m.cash, color:'#16a34a' },
                  { label:'QRIS', value: m.qris, color:'#1d4ed8' },
                  { label:'Kartu', value: m.card, color:'#7c3aed' },
                  { label:'Transfer', value: m.transfer, color:'#ca8a04' },
                ]} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, width: '100%' }}>
                {[
                  { l:'Tunai', c:'#16a34a', v: m.cash },
                  { l:'QRIS', c:'#1d4ed8', v: m.qris },
                  { l:'Kartu EDC', c:'#7c3aed', v: m.card },
                  { l:'Transfer', c:'#ca8a04', v: m.transfer },
                ].map(leg => (
                  <div key={leg.l} style={{ display:'flex', alignItems:'center', justifyContent: 'space-between', gap:6 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:9, height:9, borderRadius:2, background:leg.c, flexShrink:0, display:'inline-block' }} />
                      <span style={{ fontSize:10, color:'#64748b' }}>{leg.l}</span>
                    </div>
                    <strong style={{ fontSize:11, color:'#1e293b' }}>{formatRupiah(leg.v)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bar: Kategori Produk - full width */}
          <div style={{ ...card, gridColumn:'1 / -1' }}>
            <PanelHeader icon={<Package size={13} color="#16a34a" />} title="Penjualan per Kategori" badge="Bar Chart" />
            <div style={{ padding:'14px 16px', overflowX:'auto' }}>
              {m.topCat.length === 0 ? <EmptyState message="Belum ada data produk pada periode ini." /> : (
                <MiniBarChart data={m.topCat.slice(0, 8).map((c, i) => ({
                  label: c.name, value: c.sales, color: COLORS[i % COLORS.length]
                }))} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

