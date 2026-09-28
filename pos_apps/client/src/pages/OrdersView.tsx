import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  RefreshCw,
  Printer,
  Banknote,
  QrCode,
  User,
  FileSpreadsheet,
  FileText,
  Filter,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import type { Order, OrderChannel } from '../types/order';
import type { Outlet } from '../types/outlet';
import { ORDER_CHANNEL_LABELS } from '../types/order';
import { OrderSuccessModal } from '../components/OrderSuccessModal';
import { TablePagination } from '../components/TablePagination';
import { generateSalesRecapPdf } from '../utils/salesRecapPdf';
import { exportOrdersToCsv } from '../utils/salesExportCsv';
import { api } from '../services/api';

interface OrdersViewProps {
  activeOutlet?: Outlet | null;
  onAppendOrder?: (order: Order) => void;
}

type DatePreset = 'all' | 'today' | '7days' | '30days' | 'thismonth' | 'custom';
const PRESET_LABELS: Record<DatePreset, string> = {
  all: 'Semua Periode',
  today: 'Hari Ini',
  '7days': '7 Hari Terakhir',
  '30days': '30 Hari Terakhir',
  thismonth: 'Bulan Ini',
  custom: 'Kustom Tanggal',
};

import { toLocalDateStr, computePresetDateRange } from '../utils/date';

function getPresetRange(preset: DatePreset): { start?: string; end?: string } {
  if (preset === 'all') return {};
  const { startStr, endStr } = computePresetDateRange(preset as any);
  return { start: startStr, end: endStr };
}

export const OrdersView: React.FC<OrdersViewProps> = ({ activeOutlet, onAppendOrder }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Date Filter State
  const [datePreset, setDatePreset] = useState<DatePreset>('thismonth');
  const [customStart, setCustomStart] = useState(toLocalDateStr(new Date()));
  const [customEnd, setCustomEnd] = useState(toLocalDateStr(new Date()));
  const [showDateDrop, setShowDateDrop] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadOrders = async (
    targetChannel?: string,
    targetPreset?: DatePreset,
    startD?: string,
    endD?: string
  ) => {
    setLoading(true);
    try {
      const channelParam = targetChannel !== undefined ? targetChannel : selectedChannel;
      const currentPreset = targetPreset !== undefined ? targetPreset : datePreset;

      let sDate: string | undefined;
      let eDate: string | undefined;
      if (currentPreset === 'custom') {
        sDate = startD !== undefined ? startD : customStart;
        eDate = endD !== undefined ? endD : customEnd;
      } else {
        const range = getPresetRange(currentPreset);
        sDate = range.start;
        eDate = range.end;
      }

      const res = await api.getOrders({
        search: search.trim() || undefined,
        channel: channelParam,
        outletId: activeOutlet?.id,
        startDate: sDate,
        endDate: eDate,
        limit: 200,
      });
      if (res.status === 'success') {
        setOrders(res.data);
      }
    } catch (err) {
      console.error('Gagal mengambil daftar pesanan:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [activeOutlet?.id]);

  // Reset pagination ke halaman 1 saat filter atau pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedChannel, datePreset, customStart, customEnd]);

  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedOrders = orders.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadOrders();
  };

  const handleViewReceipt = (order: Order) => {
    setSelectedOrder(order);
    setModalOpen(true);
  };

  // Ringkasan metrik hari ini
  const totalOmset = orders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
  const totalTransaksi = orders.length;
  const cashTransaksi = orders.filter((o) => o.payments?.[0]?.method === 'CASH').length;
  const qrisTransaksi = orders.filter((o) => o.payments?.[0]?.method === 'QRIS').length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Stats Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-blue-950 flex items-center gap-2.5">
            <Receipt className="w-6 h-6 text-blue-900" />
            <span>Riwayat Transaksi Penjualan</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Daftar faktur transaksi penjualan kasir, pembayaran, ekspor laporan, dan cetak struk.
          </p>
        </div>

        {/* Action Buttons: Ekspor Excel, Cetak Rekap PDF, Segarkan Data */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => exportOrdersToCsv(orders)}
            disabled={loading || orders.length === 0}
            className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-40 active:scale-95"
            title="Ekspor Riwayat Transaksi ke Excel / CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Ekspor Excel</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const outletName = orders[0]?.outlet?.name || 'Well POS';
              generateSalesRecapPdf(orders, selectedChannel, outletName);
            }}
            disabled={loading || orders.length === 0}
            className="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-40 active:scale-95"
            title="Cetak Dokumen Rekap Penjualan Kasir (PDF)"
          >
            <FileText className="w-4 h-4 text-blue-900" />
            <span>Cetak Rekap PDF</span>
          </button>

          <button
            type="button"
            onClick={() => loadOrders()}
            disabled={loading}
            className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 text-blue-900 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Total Transaksi
          </div>
          <div className="text-2xl font-black text-blue-950">{totalTransaksi} Faktur</div>
          <div className="text-[11px] text-slate-400 mt-1">Hari ini / periode aktif</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Total Omset Kasir
          </div>
          <div className="text-2xl font-black text-blue-900">
            Rp {totalOmset.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Akumulasi penerimaan</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tunai (Cash)</span>
          </div>
          <div className="text-2xl font-black text-emerald-700">{cashTransaksi} Transaksi</div>
          <div className="text-[11px] text-slate-400 mt-1">Uang fisik laci kasir</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5 text-indigo-600" />
            <span>QRIS Non-Tunai</span>
          </div>
          <div className="text-2xl font-black text-indigo-700">{qrisTransaksi} Transaksi</div>
          <div className="text-[11px] text-slate-400 mt-1">Settlement digital QR</div>
        </div>
      </div>

      {/* Filter Bar (Search + Channel Dropdown) */}
      <div className="flex flex-col sm:flex-row gap-2">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor invoice (INV/...) atau nama pelanggan..."
              className="w-full bg-white border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium transition-all outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm shrink-0"
          >
            Cari
          </button>
        </form>

        {/* Dropdown Filter Saluran Pesanan */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shrink-0 shadow-2xs">
          <Filter className="w-4 h-4 text-blue-900 shrink-0" />
          <span className="text-xs font-bold text-slate-600">Saluran:</span>
          <select
            value={selectedChannel}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedChannel(val);
              loadOrders(val);
            }}
            className="bg-transparent text-xs font-bold text-blue-950 outline-none cursor-pointer pr-1"
          >
            <option value="ALL">Semua Saluran</option>
            <option value="DINE_IN">🍽️ Dine In (Makan di Tempat)</option>
            <option value="TAKEAWAY">🛍️ Takeaway (Bawa Pulang)</option>
            <option value="GOFOOD">🛵 GoFood Online</option>
            <option value="GRABFOOD">🟢 GrabFood Online</option>
            <option value="SHOPEEFOOD">🟠 ShopeeFood Online</option>
            <option value="DELIVERY">📦 Kurir / Delivery</option>
          </select>
        </div>

        {/* Dropdown Filter Periode / Tanggal */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDateDrop((v) => !v)}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:border-blue-900/30 rounded-xl px-3 py-2 shrink-0 shadow-2xs text-xs font-bold text-slate-700 transition-all cursor-pointer h-full"
          >
            <Calendar className="w-4 h-4 text-blue-900 shrink-0" />
            <span>{datePreset !== 'custom' ? PRESET_LABELS[datePreset] : `${customStart} s/d ${customEnd}`}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showDateDrop && (
            <div className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-[210px] p-2 animate-in fade-in zoom-in-95">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2.5 py-1 mb-1">
                Pilih Periode Transaksi
              </div>
              {(['thismonth', 'today', '7days', '30days', 'all', 'custom'] as DatePreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setDatePreset(p);
                    if (p !== 'custom') {
                      setShowDateDrop(false);
                      loadOrders(selectedChannel, p);
                    }
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    datePreset === p
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {PRESET_LABELS[p]}
                </button>
              ))}

              {datePreset === 'custom' && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-2 p-1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Dari Tanggal:</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-200 rounded-lg p-1.5 outline-none focus:border-blue-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Sampai Tanggal:</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-200 rounded-lg p-1.5 outline-none focus:border-blue-900"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDateDrop(false);
                      loadOrders(selectedChannel, 'custom', customStart, customEnd);
                    }}
                    className="w-full mt-1 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                  >
                    Terapkan Rentang
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-semibold">Memuat riwayat transaksi...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-sm text-slate-700">Belum ada data transaksi</p>
            <p className="text-xs text-slate-400">
              Transaksi yang diselesaikan di Mesin Kasir akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">No. Faktur</th>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Saluran</th>
                  <th className="py-3 px-4">Pelanggan</th>
                  <th className="py-3 px-4">Metode Bayar</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-right">Total Bayar</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedOrders.map((order) => {
                  const payment = order.payments?.[0];
                  const chKey = (order.channel || 'DINE_IN') as OrderChannel;
                  const chInfo = ORDER_CHANNEL_LABELS[chKey] || {
                    label: order.channel || 'Dine In',
                    color: '#1e3a8a',
                    bg: '#dbeafe',
                  };

                  return (
                    <tr key={order.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-950">
                        {order.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs">
                        {new Date(order.createdAt).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold"
                          style={{ color: chInfo.color, backgroundColor: chInfo.bg }}
                        >
                          {chInfo.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {order.customerName ? (
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{order.customerName}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Umum / Tunai</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {payment?.method === 'CASH' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                            <Banknote className="w-3 h-3" />
                            <span>Tunai</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold">
                            <QrCode className="w-3 h-3" />
                            <span>QRIS</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600">
                        Rp {Number(order.subtotal).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-blue-950">
                        Rp {Number(order.grandTotal).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {onAppendOrder && (
                            <button
                              type="button"
                              onClick={() => onAppendOrder(order)}
                              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1 active:scale-95"
                              title="Buat Transaksi Tambahan / Susulan untuk Pesanan Ini"
                            >
                              <span>+ Susulan</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleViewReceipt(order)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-blue-900 hover:text-white text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 active:scale-95"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Lihat Struk</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Riwayat Transaksi */}
        {!loading && orders.length > 0 && (
          <TablePagination
            currentPage={safeCurrentPage}
            pageSize={pageSize}
            totalItems={orders.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="transaksi"
          />
        )}
      </div>

      {/* Modal Preview Struk */}
      <OrderSuccessModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        order={selectedOrder}
        onAppendOrder={onAppendOrder}
      />
    </div>
  );
};
