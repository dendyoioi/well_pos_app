import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Clock,
  ChefHat,
  ShoppingBag,
  CreditCard,
  Store,
  Check,
  XCircle,
  Search,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Flame,
} from 'lucide-react';
import { api } from '../services/api';
import type { QrLiveOrder } from '../types/qr_menu';
import type { Outlet } from '../types/outlet';
import { formatRupiah } from '../utils/currency';
import { useDialog } from '../context/DialogContext';
import { soundService } from '../utils/sound';

interface QrLiveOrdersViewProps {
  activeOutlet: Outlet | null;
  onOpenInPos?: (order: QrLiveOrder) => void;
}

export const QrLiveOrdersView: React.FC<QrLiveOrdersViewProps> = ({ activeOutlet, onOpenInPos }) => {
  const dialog = useDialog();
  const [orders, setOrders] = useState<QrLiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => soundService.isEnabled());
  const [isFullscreenKds, setIsFullscreenKds] = useState(false);
  const prevPendingCountRef = useRef<number | null>(null);

  const fetchOrders = async () => {
    if (!activeOutlet) return;
    try {
      const res = await api.getQrLiveOrders(activeOutlet.id);
      if (res.status === 'success' && res.data) {
        const fetchedOrders: QrLiveOrder[] = res.data;
        const currentPending = fetchedOrders.filter((o) => o.orderStatus === 'CONFIRMED').length;
        if (prevPendingCountRef.current !== null && currentPending > prevPendingCountRef.current) {
          soundService.playKitchenOrderAlert();
        }
        prevPendingCountRef.current = currentPending;
        setOrders(fetchedOrders);
      }
    } catch (err) {
      console.error('Gagal memuat pesanan QR masuk:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchOrders();
  }, [activeOutlet?.id]);

  // Polling auto-refresh every 10 seconds for kitchen real-time feed
  useEffect(() => {
    if (!autoRefresh || !activeOutlet) return;
    const interval = setInterval(() => {
      fetchOrders();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, activeOutlet?.id]);

  const handleUpdateStatus = async (
    orderId: string,
    newStatus: 'CONFIRMED' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELLED'
  ) => {
    setUpdatingId(orderId);
    try {
      const res = await api.updateQrOrderStatus(orderId, newStatus);
      if (res.status === 'success') {
        if (newStatus === 'READY') {
          soundService.playOrderReady();
        }
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, orderStatus: newStatus as any } : o))
        );
        dialog.toast(`Status pesanan diperbarui ke ${newStatus}`, 'success');
      } else {
        dialog.alert({
          title: 'Gagal Mengubah Status',
          message: res.message || 'Gagal mengubah status pesanan.',
          variant: 'danger',
        });
      }
    } catch (err: any) {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: err.message || 'Gagal menghubungi server.',
        variant: 'danger',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  if (!activeOutlet) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-3">
        <Store className="w-12 h-12 text-slate-400 mx-auto" />
        <h3 className="text-base font-black text-blue-950">Pilih Outlet Toko Terlebih Dahulu</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Silakan pilih outlet toko pada bilah navigasi atas untuk memantau pesanan masuk dari meja tamu.
        </p>
      </div>
    );
  }

  const filteredOrders = orders.filter((o) => {
    const matchQuery =
      o.tableNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus = statusFilter === 'ALL' || o.orderStatus === statusFilter;
    return matchQuery && matchStatus;
  });

  const pendingOrders = orders.filter((o) => o.orderStatus === 'CONFIRMED').length;
  const inProgressOrders = orders.filter((o) => o.orderStatus === 'IN_PROGRESS').length;
  const readyOrders = orders.filter((o) => o.orderStatus === 'READY').length;
  const totalTableRevenue = orders
    .filter((o) => o.orderStatus !== 'CANCELLED' && o.orderStatus !== 'VOIDED')
    .reduce((acc, curr) => acc + curr.grandTotal, 0);

  const getElapsedMinutes = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  return (
    <div className="space-y-6 pb-28 sm:pb-16">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold mb-2">
            <Bell className="w-3.5 h-3.5" />
            <span>Feed Pesanan Meja &bull; {activeOutlet.name}</span>
          </div>
          <h1 className="text-2xl font-black text-blue-950 tracking-tight flex items-center gap-2">
            <span>Pesanan Masuk dari Meja (Buku Menu QR)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pantau pesanan yang dikirimkan tamu secara mandiri dari meja, konfirmasi pesanan ke dapur, dan catat pembayaran di kasir.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Sound alert toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              soundService.setEnabled(next);
              if (next) soundService.playKitchenOrderAlert();
            }}
            className={`h-10 px-3.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              soundEnabled
                ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
            title={soundEnabled ? 'Klik untuk mematikan suara lonceng KDS' : 'Klik untuk mengaktifkan suara lonceng KDS'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-700" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Suara KDS Aktif' : 'Mute'}</span>
          </button>

          {/* Fullscreen KDS Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreenKds(true)}
            className="h-10 px-3.5 rounded-xl text-xs font-bold bg-blue-900 hover:bg-blue-950 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
            title="Buka tampilan layar penuh untuk monitor dapur (KDS)"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Layar Penuh KDS</span>
          </button>

          <div className="inline-flex items-center gap-2 px-3.5 py-2 h-10 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            <span>Live Feed ({autoRefresh ? '10d' : 'Off'})</span>
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="ml-1 text-[11px] font-bold text-blue-900 hover:text-blue-950 underline cursor-pointer"
            >
              {autoRefresh ? 'Jeda' : 'On'}
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate block">Perlu Konfirmasi</span>
            <div className="text-2xl font-black font-mono text-rose-600 mt-1">{pendingOrders}</div>
            <p className="text-[11px] text-rose-500 mt-0.5 truncate">Pesanan baru masuk</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0">
            <Bell className="w-5 h-5 shrink-0" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate block">Sedang Diracik</span>
            <div className="text-2xl font-black font-mono text-amber-600 mt-1">{inProgressOrders}</div>
            <p className="text-[11px] text-amber-500 mt-0.5 truncate">Diproses dapur / bar</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
            <ChefHat className="w-5 h-5 shrink-0" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate block">Siap Saji</span>
            <div className="text-2xl font-black font-mono text-blue-900 mt-1">{readyOrders}</div>
            <p className="text-[11px] text-blue-600 mt-0.5 truncate">Siap diantar ke meja</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 flex items-center justify-center font-bold shrink-0">
            <ShoppingBag className="w-5 h-5 shrink-0" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate block">Total Pesanan Meja</span>
            <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-blue-950 mt-1 truncate">{formatRupiah(totalTableRevenue)}</div>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{orders.length} transaksi meja</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center font-bold shrink-0">
            <CreditCard className="w-5 h-5 shrink-0" />
          </div>
        </div>
      </div>

      {/* Filter & Status Tabs */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nomor meja, nama, atau invoice..."
            className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 transition-all shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'Semua' },
            { id: 'CONFIRMED', label: 'Perlu Dikonfirmasi' },
            { id: 'IN_PROGRESS', label: 'Diproses Dapur' },
            { id: 'READY', label: 'Siap Saji' },
            { id: 'COMPLETED', label: 'Selesai / Terbayar' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`h-10 px-4 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-blue-900 text-white border-blue-900 shadow-sm shadow-blue-950/20'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 bg-white rounded-3xl border border-slate-200">
          <div className="inline-block w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="font-semibold text-xs">Memuat pesanan QR...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
          <Bell className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="font-bold text-sm text-slate-700">Tidak ada pesanan QR masuk</p>
          <p className="text-xs text-slate-400 mt-1">Pesanan yang dikirim oleh tamu dari meja akan otomatis muncul di sini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredOrders.map((order) => {
            const isUpdating = updatingId === order.id;

            const statusStyle =
              order.orderStatus === 'CONFIRMED'
                ? { label: 'Menunggu Konfirmasi', color: 'bg-rose-50 text-rose-700 border-rose-200' }
                : order.orderStatus === 'IN_PROGRESS'
                ? { label: 'Sedang Diproses', color: 'bg-amber-50 text-amber-800 border-amber-200' }
                : order.orderStatus === 'READY'
                ? { label: 'Siap Saji', color: 'bg-blue-50 text-blue-900 border-blue-200' }
                : order.orderStatus === 'COMPLETED'
                ? { label: 'Selesai & Lunas', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
                : { label: 'Dibatalkan', color: 'bg-slate-100 text-slate-600 border-slate-200' };

            const paymentStyle =
              order.paymentStatus === 'PAID'
                ? { label: 'Sudah Bayar', color: 'text-emerald-700 bg-emerald-50' }
                : { label: 'Belum Bayar (Bayar di Kasir)', color: 'text-amber-700 bg-amber-50' };

            return (
              <div
                key={order.id}
                className={`bg-white rounded-3xl border shadow-sm p-5 flex flex-col justify-between space-y-4 transition-all ${
                  order.orderStatus === 'CONFIRMED' ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200'
                }`}
              >
                {/* Header Card */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 rounded-xl bg-blue-900 text-white font-black text-sm shadow-xs">
                        Meja {order.tableNumber}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{order.customerName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{order.invoiceNumber}</div>
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${statusStyle.color}`}>
                      {statusStyle.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 flex-wrap gap-1">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                      </span>
                      {order.orderStatus !== 'COMPLETED' && order.orderStatus !== 'CANCELLED' && (
                        <span className={`px-2 py-0.5 rounded-md font-mono font-extrabold text-[10px] border flex items-center gap-1 ${
                          getElapsedMinutes(order.createdAt) >= 20
                            ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                            : getElapsedMinutes(order.createdAt) >= 10
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}>
                          <Flame className="w-3 h-3" />
                          <span>{getElapsedMinutes(order.createdAt)} mnt lalu</span>
                        </span>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${paymentStyle.color}`}>
                      {paymentStyle.label}
                    </span>
                  </div>
                </div>

                {/* Items List */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-2 text-xs">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-2 border-b border-slate-200/50 pb-1.5 last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <span className="font-extrabold text-blue-950 mr-1.5">{item.quantity}x</span>
                        <span className="font-bold text-slate-800">{item.productName}</span>
                        {item.variantName && item.variantName !== 'Standar' && (
                          <span className="text-[11px] text-slate-500 ml-1">({item.variantName})</span>
                        )}
                        {item.notes && (
                          <div className="text-[11px] text-amber-700 italic mt-0.5">&ldquo;{item.notes}&rdquo;</div>
                        )}
                      </div>
                      <span className="font-semibold text-slate-700 shrink-0">{formatRupiah(item.subtotal)}</span>
                    </div>
                  ))}

                  {order.notes && (
                    <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-slate-200/60">
                      <span className="font-bold text-slate-800">Catatan Tamu:</span> {order.notes}
                    </div>
                  )}
                </div>

                {/* Total & Action Footer */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Total Pesanan:</span>
                    <span className="text-base font-black font-mono text-blue-950">{formatRupiah(order.grandTotal)}</span>
                  </div>

                  {/* Actions based on status */}
                  <div className="flex items-center gap-2">
                    {order.orderStatus === 'CONFIRMED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(order.id, 'IN_PROGRESS')}
                          disabled={isUpdating}
                          className="flex-1 h-10 px-4 bg-blue-900 hover:bg-blue-950 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                        >
                          <ChefHat className="w-4 h-4" />
                          <span>Terima &amp; Kirim Dapur</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(order.id, 'CANCELLED')}
                          disabled={isUpdating}
                          className="w-10 h-10 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                          title="Tolak Pesanan"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {order.orderStatus === 'IN_PROGRESS' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order.id, 'READY')}
                        disabled={isUpdating}
                        className="flex-1 h-10 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>Tandai Siap Saji</span>
                      </button>
                    )}

                    {order.orderStatus === 'READY' && order.paymentStatus === 'UNPAID' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenInPos) onOpenInPos(order);
                          else handleUpdateStatus(order.id, 'COMPLETED');
                        }}
                        disabled={isUpdating}
                        className="flex-1 h-10 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Buka Bayar di Kasir</span>
                      </button>
                    )}

                    {order.orderStatus === 'COMPLETED' && (
                      <div className="w-full h-10 bg-slate-50 border border-slate-100 text-slate-500 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Pesanan Selesai &amp; Lunas</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FULLSCREEN KDS OVERLAY UNTUK MONITOR DAPUR */}
      {isFullscreenKds && (
        <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col p-4 sm:p-6 overflow-hidden">
          {/* Top Bar Fullscreen */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
                <ChefHat className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 flex-wrap">
                  <span>Monitor Dapur Layar Penuh (KDS)</span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                    {activeOutlet.name}
                  </span>
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                  <span className="text-rose-400 font-bold">{pendingOrders} Menunggu</span>
                  <span>&bull;</span>
                  <span className="text-amber-400 font-bold">{inProgressOrders} Dimasak</span>
                  <span>&bull;</span>
                  <span className="text-blue-400 font-bold">{readyOrders} Siap Saji</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {/* Sound alert toggle */}
              <button
                type="button"
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  soundService.setEnabled(next);
                  if (next) soundService.playKitchenOrderAlert();
                }}
                className={`h-10 px-3.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  soundEnabled
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                <span className="hidden sm:inline">{soundEnabled ? 'Suara Lonceng Aktif' : 'Mute'}</span>
              </button>

              {/* Exit Fullscreen */}
              <button
                type="button"
                onClick={() => setIsFullscreenKds(false)}
                className="h-10 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <Minimize2 className="w-4 h-4" />
                <span>Keluar Layar Penuh</span>
              </button>
            </div>
          </div>

          {/* Fullscreen Grid */}
          <div className="flex-1 overflow-y-auto pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-24 text-center text-slate-500">
                <ChefHat className="w-16 h-16 text-slate-700 mb-3" />
                <h3 className="text-lg font-bold text-slate-300">Semua Pesanan Dapur Telah Selesai</h3>
                <p className="text-xs text-slate-500 mt-1">Antrean masak kosong. Pesanan baru akan berbunyi otomatis.</p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isUpdating = updatingId === order.id;
                const elapsed = getElapsedMinutes(order.createdAt);

                return (
                  <div
                    key={order.id}
                    className={`rounded-2xl border p-4 flex flex-col justify-between transition-all ${
                      order.orderStatus === 'CONFIRMED'
                        ? 'bg-slate-900 border-rose-500 ring-2 ring-rose-500/20 shadow-lg shadow-rose-950/20'
                        : order.orderStatus === 'IN_PROGRESS'
                        ? 'bg-slate-900 border-amber-500/80 shadow-md'
                        : order.orderStatus === 'READY'
                        ? 'bg-slate-900 border-blue-500/80'
                        : 'bg-slate-900/60 border-slate-800 opacity-70'
                    }`}
                  >
                    <div>
                      {/* Card Header Large */}
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
                        <div className="flex items-center gap-2.5">
                          <span className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-base shadow-xs">
                            Meja {order.tableNumber}
                          </span>
                          <span className="text-xs font-bold text-slate-300 truncate max-w-[120px]">
                            {order.customerName}
                          </span>
                        </div>

                        <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border flex items-center gap-1 ${
                          elapsed >= 20
                            ? 'bg-rose-500/30 text-rose-300 border-rose-500/60 animate-pulse'
                            : elapsed >= 10
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                          <Clock className="w-3 h-3" />
                          <span>{elapsed} mnt</span>
                        </span>
                      </div>

                      {/* Items Large High Contrast */}
                      <div className="py-3 space-y-2.5">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2 last:border-0 last:pb-0">
                            <div className="min-w-0">
                              <span className="font-black text-amber-400 text-base mr-2">{item.quantity}x</span>
                              <span className="font-bold text-white text-sm leading-tight">{item.productName}</span>
                              {item.variantName && item.variantName !== 'Standar' && (
                                <span className="text-xs text-slate-400 ml-1.5 font-medium">({item.variantName})</span>
                              )}
                              {item.notes && (
                                <div className="text-xs text-amber-300 font-semibold bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 mt-1">
                                  &ldquo;{item.notes}&rdquo;
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {order.notes && (
                          <div className="mt-2 text-xs text-amber-200 bg-amber-950/40 p-2.5 rounded-xl border border-amber-800/50">
                            <strong className="text-amber-400">Catatan Tamu:</strong> {order.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button Large */}
                    <div className="pt-3 border-t border-slate-800">
                      {order.orderStatus === 'CONFIRMED' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(order.id, 'IN_PROGRESS')}
                          disabled={isUpdating}
                          className="w-full h-12 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-slate-950 font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                        >
                          <ChefHat className="w-5 h-5" />
                          <span>MASAK SEKARANG</span>
                        </button>
                      )}

                      {order.orderStatus === 'IN_PROGRESS' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(order.id, 'READY')}
                          disabled={isUpdating}
                          className="w-full h-12 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                        >
                          <ShoppingBag className="w-5 h-5" />
                          <span>HIDANGAN SIAP SAJI</span>
                        </button>
                      )}

                      {order.orderStatus === 'READY' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(order.id, 'COMPLETED')}
                          disabled={isUpdating}
                          className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                        >
                          <Check className="w-5 h-5" />
                          <span>SELESAI DISAJIKAN</span>
                        </button>
                      )}

                      {order.orderStatus === 'COMPLETED' && (
                        <div className="w-full h-10 bg-slate-800/60 text-emerald-400 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5">
                          <Check className="w-4 h-4" />
                          <span>Selesai &amp; Terhidang</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
