import React, { useState, useEffect } from 'react';
import {
  Bell,
  Clock,
  ChefHat,
  ShoppingBag,
  CreditCard,
  RefreshCw,
  Store,
  Check,
  XCircle,
  Search,
} from 'lucide-react';
import { api } from '../services/api';
import type { QrLiveOrder } from '../types/qr_menu';
import type { Outlet } from '../types/outlet';
import { formatRupiah } from '../utils/currency';
import { useDialog } from '../context/DialogContext';

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

  const fetchOrders = async () => {
    if (!activeOutlet) return;
    try {
      const res = await api.getQrLiveOrders(activeOutlet.id);
      if (res.status === 'success' && res.data) {
        setOrders(res.data);
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

  return (
    <div className="space-y-6">
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

        <div className="flex items-center gap-3 shrink-0">
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-3.5 h-3.5 text-blue-900 rounded-md focus:ring-blue-900"
            />
            <span>Auto-Refresh (10d)</span>
          </label>

          <button
            onClick={fetchOrders}
            className="p-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
            title="Muat Ulang Pesanan"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">Perlu Konfirmasi</span>
            <div className="text-2xl font-black text-rose-600 mt-1">{pendingOrders}</div>
            <p className="text-[11px] text-rose-500 mt-0.5">Pesanan baru masuk</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
            <Bell className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">Sedang Diracik</span>
            <div className="text-2xl font-black text-amber-600 mt-1">{inProgressOrders}</div>
            <p className="text-[11px] text-amber-500 mt-0.5">Diproses dapur / bar</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <ChefHat className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">Siap Saji</span>
            <div className="text-2xl font-black text-blue-900 mt-1">{readyOrders}</div>
            <p className="text-[11px] text-blue-600 mt-0.5">Siap diantar ke meja</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center font-bold">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">Total Pesanan Meja</span>
            <div className="text-xl font-black text-blue-950 mt-1">{formatRupiah(totalTableRevenue)}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">{orders.length} transaksi meja</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Status Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nomor meja, nama, atau invoice..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
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

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                    </span>
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
                    <span className="text-base font-black text-blue-950">{formatRupiah(order.grandTotal)}</span>
                  </div>

                  {/* Actions based on status */}
                  <div className="flex items-center gap-2">
                    {order.orderStatus === 'CONFIRMED' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'IN_PROGRESS')}
                          disabled={isUpdating}
                          className="flex-1 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                        >
                          <ChefHat className="w-3.5 h-3.5" />
                          <span>Terima & Kirim Dapur</span>
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'CANCELLED')}
                          disabled={isUpdating}
                          className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors"
                          title="Tolak Pesanan"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {order.orderStatus === 'IN_PROGRESS' && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'READY')}
                        disabled={isUpdating}
                        className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Tandai Siap Saji</span>
                      </button>
                    )}

                    {order.orderStatus === 'READY' && order.paymentStatus === 'UNPAID' && (
                      <button
                        onClick={() => {
                          if (onOpenInPos) onOpenInPos(order);
                          else handleUpdateStatus(order.id, 'COMPLETED');
                        }}
                        disabled={isUpdating}
                        className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Buka Bayar di Kasir</span>
                      </button>
                    )}

                    {order.orderStatus === 'COMPLETED' && (
                      <div className="w-full py-2 bg-slate-50 text-slate-500 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5">
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
    </div>
  );
};
