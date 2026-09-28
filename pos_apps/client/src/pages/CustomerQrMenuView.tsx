import React, { useState, useEffect } from 'react';
import {
  Utensils,
  Search,
  Wifi,
  Clock,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  ChefHat,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { api, authStorage } from '../services/api';
import type { PublicMenuResponse, PublicMenuProduct } from '../types/qr_menu';
import { formatRupiah } from '../utils/currency';
import { useDialog } from '../context/DialogContext';
import { normalizeOutletFees } from '../types/outlet';
import type { OutletFee } from '../types/outlet';


interface CartItem {
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

interface CustomerQrMenuViewProps {
  outletId: string;
  tableCode?: string | null;
  hidePreviewBanner?: boolean;
}

export const CustomerQrMenuView: React.FC<CustomerQrMenuViewProps> = ({
  outletId,
  tableCode,
  hidePreviewBanner = false,
}) => {
  const dialog = useDialog();
  const [data, setData] = useState<PublicMenuResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Deteksi mode pratinjau: apakah user backoffice (admin/kasir) yang membuka tampilan tamu
  const isPreviewMode = Boolean(authStorage.getUser());

  // Filter & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Variant / Customization Modal
  const [selectedProduct, setSelectedProduct] = useState<PublicMenuProduct | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemNotes, setItemNotes] = useState<string>('');

  // Customer Checkout Details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadMenu(targetOutletId: string) {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getPublicQrMenu(targetOutletId, tableCode || undefined);
        if (!isMounted) return;
        if (res.status === 'success' && res.data) {
          setData(res.data);
        } else {
          setError(res.message || 'Menu restoran tidak ditemukan.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Gagal menghubungi server menu.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (outletId) {
      loadMenu(outletId);
    } else {
      // Fallback jika outletId belum terisi: ambil outlet aktif toko
      api.getOutlets().then((res) => {
        if (!isMounted) return;
        if (res.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
          const firstOutlet = res.data.find((o: any) => !o.isWarehouse) || res.data[0];
          loadMenu(firstOutlet.id);
        } else {
          setError('Outlet toko restoran belum ditentukan.');
          setLoading(false);
        }
      }).catch(() => {
        if (!isMounted) return;
        setError('Gagal memuat informasi outlet toko.');
        setLoading(false);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [outletId, tableCode]);

  const handleOpenProduct = (p: PublicMenuProduct) => {
    setSelectedProduct(p);
    setSelectedVariantId(p.variants.length > 0 ? p.variants[0].id : '');
    setItemQuantity(1);
    setItemNotes('');
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;

    let variant = selectedProduct.variants.find((v) => v.id === selectedVariantId);
    if (!variant && selectedProduct.variants.length > 0) {
      variant = selectedProduct.variants[0];
    }

    const price = variant ? variant.price : selectedProduct.minPrice;
    const variantName = variant ? variant.name : undefined;

    const newItem: CartItem = {
      productId: selectedProduct.id,
      variantId: variant?.id,
      productName: selectedProduct.name,
      variantName,
      quantity: itemQuantity,
      unitPrice: price,
      notes: itemNotes.trim() || undefined,
    };

    setCart((prev) => {
      // Cek apakah item dengan varian dan notes yang sama sudah ada di keranjang
      const existingIdx = prev.findIndex(
        (i) =>
          i.productId === newItem.productId &&
          i.variantId === newItem.variantId &&
          (i.notes || '') === (newItem.notes || '')
      );

      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += newItem.quantity;
        return updated;
      }
      return [...prev, newItem];
    });

    setSelectedProduct(null);
  };

  const handleUpdateCartQuantity = (idx: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const newQty = updated[idx].quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== idx);
      }
      updated[idx].quantity = newQty;
      return updated;
    });
  };

  // Kalkulasi Biaya — identik dengan logika POS kasir (DINE_IN context)
  const subtotal = cart.reduce((acc, curr) => acc + curr.quantity * curr.unitPrice, 0);
  const totalItemCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);

  // Normalisasi feesConfig dari API agar sama persis dengan data yang dipakai POS kasir
  const normalizedFees = normalizeOutletFees((data?.outlet.feesConfig as OutletFee[] | undefined) || []);

  // Filter biaya otomatis: sama persis dengan POS untuk channel DINE_IN / QR_MENU
  const channelActiveFees = normalizedFees.filter((f) => {
    if (!f.isActive || f.category === 'ON_DEMAND_PACKAGING') return false;
    if (!f.channelScope || f.channelScope === 'ALL') return true;
    if (f.channelScope === 'DINE_IN') return true; // QR Menu = DINE_IN
    return false;
  });

  let taxAmount = 0;
  let serviceCharge = 0;
  channelActiveFees.forEach((fee) => {
    const val = fee.type === 'PERCENTAGE'
      ? Math.round((subtotal * fee.rate) / 100)
      : fee.rate;
    // Biaya Layanan diidentifikasi lewat id/nama (sama seperti logika POS)
    const isServiceCharge = fee.id.includes('service') ||
      fee.name.toLowerCase().includes('layanan') ||
      fee.name.toLowerCase().includes('service charge');
    if (isServiceCharge) serviceCharge += val;
    else taxAmount += val;
  });

  const grandTotal = subtotal + taxAmount + serviceCharge;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      dialog.alert({
        title: 'Nama Pelanggan Wajib Diisi',
        message: 'Mohon masukkan nama Anda terlebih dahulu sebelum memesan.',
        variant: 'warning',
      });
      return;
    }
    if (cart.length === 0) {
      dialog.alert({
        title: 'Keranjang Masih Kosong',
        message: 'Silakan pilih menu terlebih dahulu ke dalam keranjang pesanan.',
        variant: 'warning',
      });
      return;
    }

    const tableNumber = data?.table?.tableNumber || tableCode || '01';

    setSubmitting(true);
    try {
      const res = await api.submitPublicQrOrder({
        outletId,
        tableNumber,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        notes: orderNotes.trim() || undefined,
        items: cart,
      });

      if (res.status === 'success') {
        setOrderSuccess(res.data);
        setCart([]);
        setIsCartOpen(false);
      } else {
        dialog.alert({
          title: 'Gagal Mengirimkan Pesanan',
          message: res.message || 'Gagal mengirimkan pesanan.',
          variant: 'danger',
        });
      }
    } catch (err: any) {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: err.message || 'Terjadi kesalahan sistem saat mengirimkan pesanan.',
        variant: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-blue-900 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-blue-950">Memuat Buku Menu Resto...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white p-6 rounded-3xl border border-slate-200 shadow-xl text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-base font-black text-blue-950">Buku Menu Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {error || 'Pastikan kode QR atau link meja yang Anda buka sudah tepat.'}
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: MEJA SEDANG TERISI (OCCUPIED)
  // ==========================================
  if (data.tableOccupied && data.activeOrderInfo) {
    const tableNum = data.table?.tableNumber || tableCode || '?';
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-3xl border border-amber-200 shadow-2xl p-6 text-center space-y-5">
          {/* Icon */}
          <div className="w-16 h-16 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto">
            <span className="text-3xl">🪑</span>
          </div>

          {/* Heading */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-extrabold mb-2 border border-amber-200">
              📍 Meja {tableNum}
            </div>
            <h1 className="text-xl font-black text-blue-950">Meja Sedang Terisi</h1>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Meja ini sedang digunakan oleh tamu lain. Anda tidak dapat melakukan pemesanan baru melalui QR ini.
            </p>
          </div>

          {/* Info Tagihan Aktif */}
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 text-left space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-700 mb-1">Tagihan Aktif</p>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">No. Invoice:</span>
              <span className="font-mono font-bold text-blue-950">#{data.activeOrderInfo.invoiceNumber}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Tamu:</span>
              <span className="font-bold text-slate-900">{data.activeOrderInfo.customerName}</span>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-2.5">
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs text-left flex items-start gap-2">
              <span className="text-base shrink-0">💬</span>
              <span>Jika Anda adalah pelanggan meja ini, silakan hubungi kasir atau staf kami untuk menambahkan pesanan.</span>
            </div>
            {data.outlet.phone && (
              <a
                href={`https://wa.me/${data.outlet.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs transition-colors shadow-sm"
              >
                <span>💬</span>
                Hubungi Staf via WhatsApp
              </a>
            )}
          </div>

          {/* Refresh hint */}
          <p className="text-[10px] text-slate-400">
            Sudah selesai? <button onClick={() => window.location.reload()} className="underline text-blue-600 font-medium cursor-pointer">Muat ulang halaman</button>
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: ORDER SUCCESS CONFIRMATION SCREEN
  // ==========================================
  if (orderSuccess) {
    const isPreviewSuccess = orderSuccess.isPreview === true;
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 text-center space-y-6 animate-in zoom-in-95">

          {/* Banner khusus pratinjau */}
          {isPreviewSuccess && (
            <div className="p-3 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 text-xs font-bold flex items-start gap-2.5 text-left -mb-2">
              <span className="text-base shrink-0">🔎</span>
              <div>
                <div className="font-extrabold uppercase tracking-wide">Ini Hanya Pratinjau — Bukan Pesanan Nyata</div>
                <div className="font-normal text-amber-700 mt-0.5">
                  Tampilan di bawah adalah contoh layar konfirmasi yang akan dilihat pelanggan nyata. Tidak ada pesanan yang dikirim ke sistem atau dapur.
                </div>
              </div>
            </div>
          )}

          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto shadow-inner ${
            isPreviewSuccess ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-900 text-xs font-extrabold mb-2">
              <span>📍 Meja {orderSuccess.tableNumber}</span>
              {isPreviewSuccess && <span className="bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded-full text-[10px] font-black">PRATINJAU</span>}
            </div>
            <h1 className="text-2xl font-black text-blue-950">
              {isPreviewSuccess ? 'Contoh: Pesanan Diterima Dapur!' : 'Pesanan Diterima Dapur!'}
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              {isPreviewSuccess
                ? <>Ini contoh pesan konfirmasi untuk tamu. Di kondisi nyata, nama tamu <strong>{orderSuccess.customerName}</strong> akan muncul di sini.</>
                : <>Terima kasih, <strong>{orderSuccess.customerName}</strong>. Pesanan Anda telah langsung diteruskan ke barista / dapur kami.</>
              }
            </p>
          </div>

          {/* Invoice Box */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Nomor Pesanan:</span>
              <span className="font-mono font-bold text-blue-950">{orderSuccess.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Estimasi Saji:</span>
              <span className="font-bold text-amber-700">~{data.settings.estimatedPrepMinutes || 15} Menit</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
              <span className="font-bold text-slate-700">Total Tagihan:</span>
              <span className="font-black text-blue-950">{formatRupiah(orderSuccess.grandTotal)}</span>
            </div>
          </div>

          {/* Payment Notice */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs text-left flex items-start gap-2.5">
            <CreditCard className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Pembayaran di Kasir:</strong> Silakan santai di meja Anda. Pembayaran dapat dilakukan ke meja atau kasir sebelum pulang dengan menyebutkan <strong>Meja {orderSuccess.tableNumber}</strong>.
            </div>
          </div>

          <button
            onClick={() => setOrderSuccess(null)}
            className={`w-full py-3.5 rounded-2xl font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 text-white ${
              isPreviewSuccess ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-900 hover:bg-blue-950'
            }`}
          >
            <span>{isPreviewSuccess ? 'Kembali ke Pratinjau Menu' : 'Pesan Menu Tambahan'}</span>
            <ArrowLeft className="w-4 h-4 rotate-180" />
          </button>
        </div>
      </div>
    );
  }

  // Filter Categories
  const categories = ['ALL', ...data.categories];
  const filteredProducts = data.products.filter((p) => {
    const matchCat = selectedCategory === 'ALL' || p.categoryName === selectedCategory;
    const matchQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchQuery;
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      {/* BANNER MODE PRATINJAU: Tampil jika user backoffice sedang membuka tampilan tamu (kecuali jika disembunyikan di mockup) */}
      {isPreviewMode && !hidePreviewBanner && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-md sticky top-0 z-40 border-b border-rose-700">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0">🚫</span>
            <div className="min-w-0">
              <div className="font-extrabold uppercase tracking-wide">Mode Pratinjau — Pesanan Tidak Akan Dikirim ke Dapur</div>
              <div className="text-rose-200 text-[10px] font-medium truncate">Anda membuka buku menu sebagai admin/kasir. Pesanan di sini hanya simulasi tampilan, tidak diproses sistem.</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { window.location.hash = '#pos'; }}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ml-3 border border-white/30"
          >
            ← Backoffice
          </button>
        </div>
      )}

      {/* RESTAURANT HEADER BANNER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-3xl mx-auto px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            {/* Nama toko & judul — flex-1 min-w-0 agar bisa truncate */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-black text-blue-950 truncate">{data.outlet.tenantName}</span>
                {data.outlet.name !== data.outlet.tenantName && (
                  <>
                    <span className="text-slate-300 shrink-0">•</span>
                    <span className="text-[10px] font-semibold text-slate-400 truncate">{data.outlet.name}</span>
                  </>
                )}
              </div>
              <h1 className="text-sm font-black text-blue-950 truncate tracking-tight leading-snug">
                {data.settings.welcomeTitle || 'Buku Menu Digital'}
              </h1>
            </div>

            {/* Table Badge — shrink-0 agar tidak terpotong */}
            <div className="px-2.5 py-1 rounded-xl bg-blue-900 text-white font-black text-[11px] shrink-0 shadow-xs flex items-center gap-1">
              <span>📍</span>
              <span>Meja {data.table?.tableNumber || tableCode || '01'}</span>
            </div>
          </div>

          {/* Wi-Fi & Facility Strip (Modular: respects wifiEnabled & showEstimatedTime) */}
          {(((data.settings.wifiEnabled ?? Boolean(data.settings.wifiName)) && Boolean(data.settings.wifiName)) ||
            (data.settings.showEstimatedTime ?? true)) && (
            <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center gap-2 text-[10px] text-slate-600 flex-wrap">
              {(data.settings.wifiEnabled ?? Boolean(data.settings.wifiName)) && data.settings.wifiName ? (
                <div className="flex items-center gap-1 font-medium">
                  <Wifi className="w-3 h-3 text-blue-900 shrink-0" />
                  <span className="font-semibold text-slate-700">{data.settings.wifiName}</span>
                  {data.settings.wifiPassword && (
                    <span className="flex items-center gap-1">
                      <span className="text-slate-300">|</span>
                      <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-950 font-mono font-bold text-[10px]">
                        {data.settings.wifiPassword}
                      </code>
                    </span>
                  )}
                </div>
              ) : null}

              {(data.settings.showEstimatedTime ?? true) && (
                <div className="flex items-center gap-1 text-slate-500 ml-auto bg-slate-50 border border-slate-200/80 px-1.5 py-0.5 rounded-md shrink-0">
                  <Clock className="w-2.5 h-2.5 text-slate-400" />
                  <span className="font-semibold">~{data.settings.estimatedPrepMinutes || 15}m saji</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search & Horizontal Category Scroller */}
        <div className="max-w-3xl mx-auto px-4 pb-3 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari makanan atau minuman..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat === 'ALL' ? 'Semua Menu' : cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* PRODUCT CATALOG GRID */}
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-4">
        {filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 p-6">
            <Utensils className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-sm text-slate-700">Menu tidak ditemukan</p>
            <p className="text-xs text-slate-400 mt-1">Coba kata kunci lain atau pilih kategori lain.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {/* Card: horizontal layout — teks kiri, foto kanan */}
                <div className="flex items-stretch gap-0">
                  {/* Kiri: info produk */}
                  <div className="flex-1 min-w-0 p-3.5 flex flex-col justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[9px] font-extrabold text-blue-700 uppercase tracking-wider bg-blue-50 px-1.5 py-0.5 rounded-md inline-block mb-1 border border-blue-100">
                        {product.categoryName}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{product.name}</h3>
                      {product.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                    </div>

                    {/* Harga + Tombol */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 mt-auto">
                      <div>
                        <span className="text-[9px] text-slate-400 font-medium block leading-tight">Harga</span>
                        <span className="text-sm font-black text-blue-950">{formatRupiah(product.minPrice)}</span>
                      </div>
                      {data.settings.selfOrderingEnabled && (
                        <button
                          onClick={() => handleOpenProduct(product)}
                          className="px-3 py-1.5 bg-blue-900 hover:bg-blue-950 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Kanan: foto produk */}
                  <div className="w-28 shrink-0 self-stretch">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        style={{ minHeight: '100px', maxHeight: '140px' }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center" style={{ minHeight: '100px' }}>
                        <Utensils className="w-8 h-8 text-blue-200" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* FLOATING CART BAR (IF CART HAS ITEMS) */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-4 inset-x-4 max-w-3xl mx-auto z-40 animate-in slide-in-from-bottom-5">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full p-4 bg-blue-900 hover:bg-blue-950 text-white rounded-2xl shadow-xl flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center font-bold text-xs">
                {totalItemCount}
              </div>
              <div className="text-left">
                <div className="text-xs text-blue-200">Total Pesanan Meja</div>
                <div className="text-sm font-black">{formatRupiah(subtotal)}</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-bold bg-white/20 px-3 py-1.5 rounded-xl">
              <span>Lihat Pesanan</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* MODAL: CUSTOMIZE / ADD PRODUCT */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-md inline-block mb-1">
                  {selectedProduct.categoryName}
                </span>
                <h3 className="text-base font-black text-blue-950">{selectedProduct.name}</h3>
                <div className="text-sm font-black text-blue-900 mt-1">
                  {formatRupiah(
                    selectedProduct.variants.find((v) => v.id === selectedVariantId)?.price || selectedProduct.minPrice
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pilihan Varian jika ada */}
            {selectedProduct.variants.length > 1 && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Pilih Varian Menu
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {selectedProduct.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        selectedVariantId === v.id
                          ? 'border-blue-900 bg-blue-50/60 text-blue-950 shadow-2xs ring-2 ring-blue-900/10'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-bold">{v.name}</div>
                      <div className="text-[11px] font-semibold text-blue-900 mt-0.5">{formatRupiah(v.price)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Catatan Khusus */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Catatan Khusus (Opsional)
              </label>
              <input
                type="text"
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                placeholder="Contoh: Less ice, jangan pakai bawang..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
              />
            </div>

            {/* Quantity Selector & Add Button */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setItemQuantity((prev) => Math.max(1, prev - 1))}
                  className="w-8 h-8 rounded-xl bg-white shadow-2xs flex items-center justify-center font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center font-black text-sm text-blue-950">{itemQuantity}</span>
                <button
                  type="button"
                  onClick={() => setItemQuantity((prev) => prev + 1)}
                  className="w-8 h-8 rounded-xl bg-white shadow-2xs flex items-center justify-center font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                className="flex-1 py-3 bg-blue-900 hover:bg-blue-950 text-white rounded-2xl font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <span>Tambahkan</span>
                <span>&bull;</span>
                <span>
                  {formatRupiah(
                    (selectedProduct.variants.find((v) => v.id === selectedVariantId)?.price || selectedProduct.minPrice) *
                      itemQuantity
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN / SHEET: CART & CHECKOUT REVIEW */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-900 text-[11px] font-black">
                  <span>📍 Meja {data.table?.tableNumber || tableCode || '01'}</span>
                </div>
                <h3 className="text-base font-black text-blue-950 mt-1">Konfirmasi Pesanan Meja</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <form onSubmit={handleSubmitOrder} className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Customer Info Form */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                <div className="text-xs font-extrabold text-blue-950">Informasi Pemesan</div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Nama Anda <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Masukkan nama Anda (contoh: Budi)"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    No. WhatsApp (Opsional, untuk e-struk)
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Contoh: 08123456789"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Catatan Pesanan Meja (Opsional)
                  </label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Contoh: Minta sendok garpu tambahan..."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  />
                </div>
              </div>

              {/* Items in Cart */}
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-slate-700">Daftar Menu yang Dipesan ({cart.length})</div>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {cart.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-blue-950">{item.productName}</div>
                        {item.variantName && item.variantName !== 'Standar' && (
                          <div className="text-[11px] text-slate-500 font-medium">Varian: {item.variantName}</div>
                        )}
                        {item.notes && (
                          <div className="text-[10px] text-amber-700 italic mt-0.5">&ldquo;{item.notes}&rdquo;</div>
                        )}
                        <div className="text-xs font-extrabold text-blue-900 mt-1">
                          {formatRupiah(item.unitPrice * item.quantity)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 bg-slate-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQuantity(idx, -1)}
                          className="w-6 h-6 rounded-lg bg-white shadow-2xs flex items-center justify-center font-bold text-slate-700 text-xs"
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-black text-xs text-blue-950">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQuantity(idx, 1)}
                          className="w-6 h-6 rounded-lg bg-white shadow-2xs flex items-center justify-center font-bold text-slate-700 text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost Summary Breakdown */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-semibold">{formatRupiah(subtotal)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Pajak (PB1):</span>
                    <span className="font-semibold">{formatRupiah(taxAmount)}</span>
                  </div>
                )}
                {serviceCharge > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Biaya Layanan:</span>
                    <span className="font-semibold">{formatRupiah(serviceCharge)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-black text-blue-950">
                  <span>Total Tagihan:</span>
                  <span>{formatRupiah(grandTotal)}</span>
                </div>
              </div>

              {/* Payment Policy Notice */}
              <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-[11px] text-blue-950 flex items-start gap-2">
                <CreditCard className="w-4 h-4 text-blue-900 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Metode Pembayaran:</strong> Bayar di Kasir. Pesanan Anda langsung diproses dapur dan pembayaran dapat dilakukan ke meja atau kasir sebelum pulang.
                </div>
              </div>

              {/* Submit Button — Mode Pratinjau: tampilkan mock demo, bukan kirim ke API */}
              <div className="pt-2 space-y-2">
                {isPreviewMode && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-bold flex items-start gap-2">
                    <span className="text-base shrink-0">🚫</span>
                    <div>
                      <div className="font-extrabold">Mode Pratinjau Aktif</div>
                      <div className="font-normal text-rose-700 mt-0.5">Tombol di bawah hanya menampilkan contoh tampilan konfirmasi. Pesanan TIDAK dikirim ke sistem atau dapur.</div>
                    </div>
                  </div>
                )}
                <button
                  type={isPreviewMode ? 'button' : 'submit'}
                  disabled={submitting}
                  onClick={isPreviewMode ? () => {
                    if (!customerName.trim()) {
                      dialog.alert({ title: 'Nama Wajib Diisi', message: 'Isi nama untuk melihat contoh tampilan konfirmasi.', variant: 'warning' });
                      return;
                    }
                    // Snapshot grandTotal LENGKAP (subtotal + pajak + biaya) sebelum cart dikosongkan
                    const snapSubtotal = cart.reduce((acc, curr) => acc + curr.quantity * curr.unitPrice, 0);
                    const snapFees = normalizeOutletFees((data?.outlet.feesConfig as OutletFee[] | undefined) || []);
                    const snapActiveFees = snapFees.filter((f) => {
                      if (!f.isActive || f.category === 'ON_DEMAND_PACKAGING') return false;
                      if (!f.channelScope || f.channelScope === 'ALL') return true;
                      if (f.channelScope === 'DINE_IN') return true;
                      return false;
                    });
                    let snapTax = 0;
                    let snapService = 0;
                    snapActiveFees.forEach((fee) => {
                      const val = fee.type === 'PERCENTAGE'
                        ? Math.round((snapSubtotal * fee.rate) / 100)
                        : fee.rate;
                      const isSvc = fee.id.includes('service') ||
                        fee.name.toLowerCase().includes('layanan') ||
                        fee.name.toLowerCase().includes('service charge');
                      if (isSvc) snapService += val; else snapTax += val;
                    });
                    const snapGrandTotal = snapSubtotal + snapTax + snapService;
                    // Mock success screen — tidak memanggil API
                    setOrderSuccess({
                      invoiceNumber: `QR/DEMO/${new Date().toISOString().slice(0,10).replace(/-/g,'')}/PREVIEW`,
                      tableNumber: data?.table?.tableNumber || tableCode || 'DEMO',
                      customerName: customerName.trim(),
                      grandTotal: snapGrandTotal,
                      isPreview: true,
                    });
                    setCart([]);
                    setIsCartOpen(false);
                  } : undefined}
                  className={`w-full py-3.5 rounded-2xl font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                    isPreviewMode
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-blue-900 hover:bg-blue-950 text-white'
                  }`}
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Mengirim Pesanan ke Dapur...</span>
                    </>
                  ) : isPreviewMode ? (
                    <>
                      <span>👁️</span>
                      <span>Pratinjau Tampilan Konfirmasi ({formatRupiah(grandTotal)})</span>
                    </>
                  ) : (
                    <>
                      <ChefHat className="w-4 h-4" />
                      <span>Kirim Pesanan ke Dapur ({formatRupiah(grandTotal)})</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
