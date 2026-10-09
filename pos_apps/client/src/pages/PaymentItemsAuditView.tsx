import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Search,
  FileSpreadsheet,
  FileText,
  Banknote,
  QrCode,
  Layers,
  CreditCard,
  Building2,
  UtensilsCrossed,
  CheckCircle2,
  HelpCircle,
  Filter,
  UserCheck,
  BookOpen,
  TrendingUp,
} from 'lucide-react';
import { api } from '../services/api';
import type { Order } from '../types/order';
import type { Outlet } from '../types/outlet';
import type { User as AuthUser } from '../types/auth';
import { TablePagination } from '../components/TablePagination';
import { generatePaymentItemsRecapPdf } from '../utils/paymentItemsRecapPdf';

export interface PaymentItemsAuditViewProps {
  activeOutlet?: Outlet | null;
  currentUser?: AuthUser | null;
  orders?: Order[];
  isEmbedded?: boolean;
  selectedCashier?: string;
  dateRangeText?: string;
  exportHandlerRef?: React.MutableRefObject<{ exportCsv: () => void; exportPdf: () => void } | null>;
}

// Helper normalisasi nama dan kode sub-metode non-tunai
const normalizeNonCashSubMethod = (rawMethod: string): { code: string; label: string } => {
  const m = (rawMethod || '').toUpperCase().trim();
  if (m === 'QRIS') return { code: 'QRIS', label: 'QRIS' };
  if (m === 'TRANSFER' || m === 'BANK_TRANSFER') return { code: 'TRANSFER', label: 'Transfer Bank' };
  if (['DEBIT', 'DEBIT_CARD', 'CREDIT', 'CREDIT_CARD', 'EDC'].includes(m)) {
    return { code: 'EDC', label: 'Kartu EDC / Debit' };
  }
  if (m === 'CUSTOMER_DEBT' || m === 'DEBT') return { code: 'DEBT', label: 'Kasbon Pelanggan' };
  return { code: m || 'LAINNYA', label: m || 'Lainnya' };
};

export const PaymentItemsAuditView: React.FC<PaymentItemsAuditViewProps> = ({
  activeOutlet,
  currentUser,
  orders: propOrders,
  isEmbedded = false,
  selectedCashier,
  dateRangeText,
  exportHandlerRef,
}) => {
  const [internalOrders, setInternalOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCostAndProfit, setShowCostAndProfit] = useState(false);

  const isPrivileged = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  // Primary Payment Card filter: ONLY 'ALL' | 'CASH' | 'NON_CASH' | 'SPLIT'
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  // Sub-Filter untuk Non-Tunai: 'ALL_NON_CASH' | 'QRIS' | 'TRANSFER' | 'EDC' | etc.
  const [selectedSubMethod, setSelectedSubMethod] = useState<string>('ALL_NON_CASH');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch orders jika tidak diberikan oleh parent
  const loadOrders = async () => {
    if (propOrders) return;
    setLoading(true);
    try {
      const res = await api.getOrders({
        outletId: activeOutlet?.id,
        limit: 1000,
      });

      if (res && res.data) {
        setInternalOrders(res.data);
      } else {
        setInternalOrders([]);
      }
    } catch (err) {
      console.error('Gagal memuat transaksi audit pembayaran:', err);
      setInternalOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!propOrders) {
      loadOrders();
    }
  }, [activeOutlet?.id, propOrders]);

  const rawOrders = propOrders || internalOrders;

  // Hanya proses pesanan yang lunas dan bukan VOID/BATAL (Refleksi Uang Masuk Riil)
  const paidOrders = useMemo(() => {
    return rawOrders.filter(
      (o) =>
        o.orderStatus !== 'VOIDED' &&
        o.orderStatus !== 'CANCELLED' &&
        o.paymentStatus !== 'UNPAID'
    );
  }, [rawOrders]);

  // Ekstraksi & Agregasi Metode Pembayaran + Item dengan Standar Akuntansi Pro-Rata Multi-Tender
  const {
    topLevelCards,
    nonCashSubOptions,
    itemAggregationByMethod,
    totalGrossRevenue,
    totalGrossCost,
    totalGrossProfit,
    totalPaidOrdersCount,
    totalUniqueItemsSold,
  } = useMemo(() => {
    let grossRev = 0;
    let grossCost = 0;
    const allItemsMap: Record<
      string,
      {
        name: string;
        category: string;
        quantity: number;
        revenue: number;
        cost: number;
        hasSplitAllocation: boolean;
      }
    > = {};

    // Map untuk menampung agregasi per metode
    const methodSummaryMap: Record<
      string,
      {
        code: string;
        label: string;
        isGroup?: boolean;
        txCount: number;
        totalAmount: number;
        totalCost: number;
        itemsMap: Record<
          string,
          {
            name: string;
            category: string;
            quantity: number;
            revenue: number;
            cost: number;
            hasSplitAllocation: boolean;
          }
        >;
      }
    > = {
      ALL: {
        code: 'ALL',
        label: 'Semua Metode',
        txCount: 0,
        totalAmount: 0,
        totalCost: 0,
        itemsMap: {},
      },
      CASH: {
        code: 'CASH',
        label: 'Tunai (Cash)',
        txCount: 0,
        totalAmount: 0,
        totalCost: 0,
        itemsMap: {},
      },
      NON_CASH: {
        code: 'NON_CASH',
        label: 'Non-Tunai',
        isGroup: true,
        txCount: 0,
        totalAmount: 0,
        totalCost: 0,
        itemsMap: {},
      },
      SPLIT: {
        code: 'SPLIT',
        label: 'Split Payment',
        txCount: 0,
        totalAmount: 0,
        totalCost: 0,
        itemsMap: {},
      },
    };

    // Helper push ke itemsMap metode
    const addItemToMethod = (
      methodKey: string,
      pName: string,
      pCat: string,
      qty: number,
      rev: number,
      cost: number,
      isSplit: boolean
    ) => {
      if (!methodSummaryMap[methodKey]) {
        const { label } = normalizeNonCashSubMethod(methodKey);
        methodSummaryMap[methodKey] = {
          code: methodKey,
          label: label,
          txCount: 0,
          totalAmount: 0,
          totalCost: 0,
          itemsMap: {},
        };
      }
      const targetMap = methodSummaryMap[methodKey].itemsMap;
      if (!targetMap[pName]) {
        targetMap[pName] = {
          name: pName,
          category: pCat || 'Umum',
          quantity: 0,
          revenue: 0,
          cost: 0,
          hasSplitAllocation: false,
        };
      }
      targetMap[pName].quantity += qty;
      targetMap[pName].revenue += rev;
      targetMap[pName].cost += cost;
      methodSummaryMap[methodKey].totalCost += cost;
      if (isSplit) targetMap[pName].hasSplitAllocation = true;
    };

    for (const order of paidOrders) {
      const orderTotal = Number(order.grandTotal || order.totalAmount || 0);
      grossRev += orderTotal;
      methodSummaryMap.ALL.txCount += 1;
      methodSummaryMap.ALL.totalAmount += orderTotal;

      const orderItemList =
        order.items && Array.isArray(order.items) && order.items.length > 0
          ? order.items
          : (order as any).orderItems && Array.isArray((order as any).orderItems)
          ? (order as any).orderItems
          : [];

      // Catat ke ALL items
      for (const it of orderItemList) {
        const name = it.productName || it.product?.name || 'Produk';
        const cat = it.categoryName || (it.product as any)?.category?.name || 'Umum';
        const qty = Number(it.quantity || 0);
        const subtotal = Number(it.subtotal || (it.unitPrice || 0) * qty);
        const costPrice = Number(it.costPrice || (it as any).cost_price || 0);
        const itemCost = costPrice * qty;

        grossCost += itemCost;
        addItemToMethod('ALL', name, cat, qty, subtotal, itemCost, false);

        if (!allItemsMap[name]) {
          allItemsMap[name] = {
            name,
            category: cat,
            quantity: 0,
            revenue: 0,
            cost: 0,
            hasSplitAllocation: false,
          };
        }
        allItemsMap[name].quantity += qty;
        allItemsMap[name].revenue += subtotal;
        allItemsMap[name].cost += itemCost;
      }

      const payments = order.payments || [];
      const isSplitOrder = payments.length > 1;

      if (isSplitOrder) {
        methodSummaryMap.SPLIT.txCount += 1;
        methodSummaryMap.SPLIT.totalAmount += orderTotal;

        // Catat full items ke kategori SPLIT
        for (const it of orderItemList) {
          const name = it.productName || it.product?.name || 'Produk';
          const cat = it.categoryName || (it.product as any)?.category?.name || 'Umum';
          const qty = Number(it.quantity || 0);
          const subtotal = Number(it.subtotal || (it.unitPrice || 0) * qty);
          const costPrice = Number(it.costPrice || (it as any).cost_price || 0);
          const itemCost = costPrice * qty;
          addItemToMethod('SPLIT', name, cat, qty, subtotal, itemCost, true);
        }

        // Hitung alokasi pro-rata per metode bayar penyusun split
        let hasNonCashInSplit = false;
        let nonCashSplitAmount = 0;

        for (const pay of payments) {
          const rawM = (pay.method || (pay as any).paymentMethod || 'CASH').toUpperCase();
          const pAmount = Number(pay.amount || pay.amountPaid || 0);
          const ratio = orderTotal > 0 ? pAmount / orderTotal : 0;

          if (rawM === 'CASH') {
            methodSummaryMap.CASH.totalAmount += pAmount;
            // Alokasi pro-rata item ke Tunai
            for (const it of orderItemList) {
              const name = it.productName || it.product?.name || 'Produk';
              const cat = it.categoryName || (it.product as any)?.category?.name || 'Umum';
              const itemSubtotal = Number(it.subtotal || (it.unitPrice || 0) * Number(it.quantity || 0));
              const costPrice = Number(it.costPrice || (it as any).cost_price || 0);
              const itemCost = costPrice * Number(it.quantity || 0);
              addItemToMethod(
                'CASH',
                name,
                cat,
                Number(it.quantity || 0) * ratio,
                itemSubtotal * ratio,
                itemCost * ratio,
                true
              );
            }
          } else {
            hasNonCashInSplit = true;
            nonCashSplitAmount += pAmount;

            const { code: subCode, label: subLabel } = normalizeNonCashSubMethod(rawM);
            if (!methodSummaryMap[subCode]) {
              methodSummaryMap[subCode] = {
                code: subCode,
                label: subLabel,
                txCount: 0,
                totalAmount: 0,
                totalCost: 0,
                itemsMap: {},
              };
            }
            methodSummaryMap[subCode].totalAmount += pAmount;

            for (const it of orderItemList) {
              const name = it.productName || it.product?.name || 'Produk';
              const cat = it.categoryName || (it.product as any)?.category?.name || 'Umum';
              const itemSubtotal = Number(it.subtotal || (it.unitPrice || 0) * Number(it.quantity || 0));
              const costPrice = Number(it.costPrice || (it as any).cost_price || 0);
              const itemCost = costPrice * Number(it.quantity || 0);
              // Masuk ke sub-metode spesifik (misal QRIS)
              addItemToMethod(
                subCode,
                name,
                cat,
                Number(it.quantity || 0) * ratio,
                itemSubtotal * ratio,
                itemCost * ratio,
                true
              );
              // Dan juga ke induk NON_CASH
              addItemToMethod(
                'NON_CASH',
                name,
                cat,
                Number(it.quantity || 0) * ratio,
                itemSubtotal * ratio,
                itemCost * ratio,
                true
              );
            }
          }
        }

        if (hasNonCashInSplit) {
          methodSummaryMap.NON_CASH.totalAmount += nonCashSplitAmount;
        }
      } else {
        // Single Tender Payment
        const primaryPay = payments[0];
        const rawM = (primaryPay?.method || (primaryPay as any)?.paymentMethod || 'CASH').toUpperCase();
        const pAmount = orderTotal;

        if (rawM === 'CASH') {
          methodSummaryMap.CASH.txCount += 1;
          methodSummaryMap.CASH.totalAmount += pAmount;
          for (const it of orderItemList) {
            const name = it.productName || it.product?.name || 'Produk';
            const cat = it.categoryName || (it.product as any)?.category?.name || 'Umum';
            const qty = Number(it.quantity || 0);
            const subtotal = Number(it.subtotal || (it.unitPrice || 0) * qty);
            const costPrice = Number(it.costPrice || (it as any).cost_price || 0);
            const itemCost = costPrice * qty;
            addItemToMethod('CASH', name, cat, qty, subtotal, itemCost, false);
          }
        } else {
          methodSummaryMap.NON_CASH.txCount += 1;
          methodSummaryMap.NON_CASH.totalAmount += pAmount;

          const { code: subCode, label: subLabel } = normalizeNonCashSubMethod(rawM);
          if (!methodSummaryMap[subCode]) {
            methodSummaryMap[subCode] = {
              code: subCode,
              label: subLabel,
              txCount: 0,
              totalAmount: 0,
              totalCost: 0,
              itemsMap: {},
            };
          }
          methodSummaryMap[subCode].txCount += 1;
          methodSummaryMap[subCode].totalAmount += pAmount;

          for (const it of orderItemList) {
            const name = it.productName || it.product?.name || 'Produk';
            const cat = it.categoryName || (it.product as any)?.category?.name || 'Umum';
            const qty = Number(it.quantity || 0);
            const subtotal = Number(it.subtotal || (it.unitPrice || 0) * qty);
            const costPrice = Number(it.costPrice || (it as any).cost_price || 0);
            const itemCost = costPrice * qty;
            addItemToMethod(subCode, name, cat, qty, subtotal, itemCost, false);
            addItemToMethod('NON_CASH', name, cat, qty, subtotal, itemCost, false);
          }
        }
      }
    }

    // Top-Level Cards: MURNI HANYA Semua Metode, Tunai, Non-Tunai, dan Split (jika ada)
    const cards = [
      methodSummaryMap.ALL,
      methodSummaryMap.CASH,
      methodSummaryMap.NON_CASH,
    ];

    if (methodSummaryMap.SPLIT && (methodSummaryMap.SPLIT.txCount > 0 || methodSummaryMap.SPLIT.totalAmount > 0)) {
      cards.push(methodSummaryMap.SPLIT);
    }

    // Sub-options Non-Tunai: Ditampilkan HANYA saat Card Non-Tunai diklik
    const subOptions = [
      {
        code: 'ALL_NON_CASH',
        label: 'Semua Non-Tunai',
        txCount: methodSummaryMap.NON_CASH?.txCount || 0,
        totalAmount: methodSummaryMap.NON_CASH?.totalAmount || 0,
      },
    ];

    Object.values(methodSummaryMap).forEach((m) => {
      if (!['ALL', 'CASH', 'NON_CASH', 'SPLIT'].includes(m.code) && (m.txCount > 0 || m.totalAmount > 0)) {
        subOptions.push({
          code: m.code,
          label: m.label || m.code,
          txCount: m.txCount,
          totalAmount: m.totalAmount,
        });
      }
    });

    return {
      topLevelCards: cards,
      nonCashSubOptions: subOptions,
      itemAggregationByMethod: methodSummaryMap,
      totalGrossRevenue: grossRev,
      totalGrossCost: grossCost,
      totalGrossProfit: grossRev - grossCost,
      totalPaidOrdersCount: paidOrders.length,
      totalUniqueItemsSold: Object.keys(allItemsMap).length,
    };
  }, [paidOrders]);

  // Handle pemilihan top-level card
  const handleSelectMethodCard = (code: string) => {
    setSelectedMethod(code);
    setSelectedSubMethod('ALL_NON_CASH');
    setCurrentPage(1);
  };

  // Resolusi Key Metode yang Aktif (memperhitungkan sub-filter non-tunai)
  const activeMethodKey = useMemo(() => {
    if (selectedMethod === 'NON_CASH') {
      if (selectedSubMethod !== 'ALL_NON_CASH' && itemAggregationByMethod[selectedSubMethod]) {
        return selectedSubMethod;
      }
      return 'NON_CASH';
    }
    return selectedMethod;
  }, [selectedMethod, selectedSubMethod, itemAggregationByMethod]);

  // Ambil list item untuk metode yang sedang aktif
  const currentItemsList = useMemo(() => {
    const selectedObj = itemAggregationByMethod[activeMethodKey] || itemAggregationByMethod.ALL;
    if (!selectedObj) return [];

    let list = Object.values(selectedObj.itemsMap);

    // Filter berdasarkan search term
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (it) => it.name.toLowerCase().includes(q) || it.category.toLowerCase().includes(q)
      );
    }

    // Sort default: kuantitas terbanyak
    return list.sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
  }, [itemAggregationByMethod, activeMethodKey, searchTerm]);

  // Reset page saat ganti metode atau search
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMethod, selectedSubMethod, searchTerm]);

  // Paging item
  const totalPages = Math.max(1, Math.ceil(currentItemsList.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return currentItemsList.slice(start, start + pageSize);
  }, [currentItemsList, safeCurrentPage, pageSize]);

  // Total pendapatan metode terpilih
  const currentMethodTotalRevenue = useMemo(() => {
    return itemAggregationByMethod[activeMethodKey]?.totalAmount || 0;
  }, [itemAggregationByMethod, activeMethodKey]);

  // Ekspor CSV Kanonikal
  const handleExportCsv = () => {
    const methodLabel = itemAggregationByMethod[activeMethodKey]?.label || activeMethodKey;
    const includeHpp = showCostAndProfit && isPrivileged;
    const headers = [
      'No',
      'Nama Menu / Produk',
      'Kategori',
      'Jumlah Terjual (Porsi/Pcs)',
      'Total Omset Penjualan (Rp)',
      'Kontribusi Omset (%)',
      ...(includeHpp ? ['Total HPP (Rp)', 'Laba Kotor (Rp)', 'Margin (%)'] : []),
      'Keterangan Alokasi',
    ];

    const rows = currentItemsList.map((it, idx) => {
      const pct =
        currentMethodTotalRevenue > 0
          ? ((it.revenue / currentMethodTotalRevenue) * 100).toFixed(1)
          : '0.0';
      const itemCost = it.cost || 0;
      const profit = it.revenue - itemCost;
      const margin = it.revenue > 0 ? ((profit / it.revenue) * 100).toFixed(1) + '%' : '0.0%';

      return [
        idx + 1,
        `"${it.name.replace(/"/g, '""')}"`,
        `"${it.category.replace(/"/g, '""')}"`,
        it.quantity % 1 === 0 ? it.quantity : it.quantity.toFixed(2),
        Math.round(it.revenue),
        `${pct}%`,
        ...(includeHpp ? [Math.round(itemCost), Math.round(profit), margin] : []),
        it.hasSplitAllocation ? 'Pro-Rata Split Payment' : 'Reguler',
      ];
    });

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Audit_Item_Penjualan_${methodLabel.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Cetak Dokumen PDF Rekap Item
  const handleExportPdf = () => {
    const methodLabel = itemAggregationByMethod[activeMethodKey]?.label || activeMethodKey;
    generatePaymentItemsRecapPdf({
      items: currentItemsList.map((it) => {
        const itemCost = it.cost || 0;
        const profit = it.revenue - itemCost;
        const margin = it.revenue > 0 ? ((profit / it.revenue) * 100).toFixed(1) + '%' : '0.0%';
        return {
          ...it,
          cost: itemCost,
          grossProfit: profit,
          marginPercent: margin,
        };
      }),
      methodLabel,
      outletName: activeOutlet?.name || 'Well POS',
      cashierName: selectedCashier,
      dateRangeText: dateRangeText || 'Periode Aktif',
      totalRevenue: currentMethodTotalRevenue,
      includeCostAndProfit: showCostAndProfit && isPrivileged,
    });
  };

  // Daftarkan handler ekspor ke ref parent (OrdersView) jika diberikan
  useEffect(() => {
    if (exportHandlerRef) {
      exportHandlerRef.current = {
        exportCsv: handleExportCsv,
        exportPdf: handleExportPdf,
      };
    }
  }, [exportHandlerRef, handleExportCsv, handleExportPdf, showCostAndProfit, isPrivileged]);

  const getMethodIcon = (code: string, isSelected = false) => {
    switch (code) {
      case 'ALL':
        return <Layers className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-blue-900'}`} />;
      case 'CASH':
        return <Banknote className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-emerald-700'}`} />;
      case 'NON_CASH':
        return <QrCode className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-indigo-700'}`} />;
      case 'SPLIT':
        return <Layers className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-purple-700'}`} />;
      case 'QRIS':
        return <QrCode className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-indigo-700'}`} />;
      case 'TRANSFER':
        return <Building2 className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-sky-700'}`} />;
      case 'EDC':
        return <CreditCard className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-teal-700'}`} />;
      case 'DEBT':
        return <BookOpen className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-amber-700'}`} />;
      default:
        return <CreditCard className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-700'}`} />;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      {/* Jika BUKAN mode embedded, tampilkan header dan toolbar mandiri */}
      {!isEmbedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-blue-950 flex items-center gap-2.5">
              <Receipt className="w-6 h-6 text-blue-900" />
              <span>Rekap Item per Pembayaran</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Audit rincian menu yang terjual berdasarkan aliran kas masuk (Tunai, Non-Tunai, &amp; Split).
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={loading || currentItemsList.length === 0}
              className="h-10 px-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-40 active:scale-95 cursor-pointer"
              title="Ekspor Rincian Item ke File Excel / CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>
      )}

      {/* Indikator Kasir Terpilih jika disaring oleh parent */}
      {selectedCashier && selectedCashier !== 'ALL' && (
        <div className="px-4 py-2.5 bg-blue-50/80 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 text-xs font-bold text-blue-950">
          <div className="flex items-center gap-2 min-w-0">
            <UserCheck className="w-4 h-4 text-blue-900 shrink-0" />
            <span className="truncate">
              Menyaring penjualan kasir: <strong>{selectedCashier}</strong>
            </span>
          </div>
          <span className="text-[11px] text-blue-800 font-medium shrink-0">
            Data menu &amp; kartu pembayaran disesuaikan khusus kasir ini.
          </span>
        </div>
      )}

      {/* Overview Ringkasan Periode Ini */}
      <div className={`grid grid-cols-1 ${showCostAndProfit && isPrivileged ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3`}>
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Total Omset Lunas (Kas Masuk)
          </span>
          <div className="text-2xl font-black text-blue-950">
            Rp {totalGrossRevenue.toLocaleString('id-ID')}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Murni penerimaan riil (bebas faktur void)
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Faktur Transaksi Lunas
          </span>
          <div className="text-2xl font-black text-emerald-700">
            {totalPaidOrdersCount} Faktur
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Telah diselesaikan oleh kasir
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Varian Menu Terjual
          </span>
          <div className="text-2xl font-black text-indigo-900">
            {totalUniqueItemsSold} Menu Unik
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Terekam dalam transaksi periode aktif
          </span>
        </div>

        {showCostAndProfit && isPrivileged && (
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl shadow-xs animate-fadeIn">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-1 flex items-center justify-between">
              <span>Estimasi Laba Kotor</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-200/70 text-emerald-900 font-extrabold">Owner</span>
            </span>
            <div className="text-2xl font-black text-emerald-950">
              Rp {Math.round(totalGrossProfit).toLocaleString('id-ID')}
            </div>
            <span className="text-[11px] text-emerald-700 mt-1 block font-medium">
              Margin {totalGrossRevenue > 0 ? ((totalGrossProfit / totalGrossRevenue) * 100).toFixed(1) : '0'}% • HPP: Rp {Math.round(totalGrossCost).toLocaleString('id-ID')}
            </span>
          </div>
        )}
      </div>

      {/* Standar Akuntansi Split Payment Note */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-start gap-2.5 text-xs text-blue-950">
        <HelpCircle className="w-4 h-4 text-blue-900 shrink-0 mt-0.5" />
        <div>
          <span className="font-extrabold block">Alur Audit Metode Pembayaran &amp; Menu:</span>
          <span className="text-blue-900/80">
            Pilih salah satu <strong>Card Metode Pembayaran</strong> di bawah untuk menyaring menu yang dibeli.
            Jika memilih <strong>Non-Tunai</strong>, Anda dapat memilih sub-jalur (seperti QRIS, Transfer, atau EDC) untuk melihat menu spesifik jalur tersebut.
          </span>
        </div>
      </div>

      {/* TOP-LEVEL PAYMENT SELECTOR CARDS */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            PILIH METODE PEMBAYARAN ({topLevelCards.length} JALUR):
          </span>
          <span className="text-xs text-slate-500 font-medium">
            Aktif:{' '}
            <strong className="text-blue-950">
              {itemAggregationByMethod[selectedMethod]?.label || selectedMethod}
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {topLevelCards.map((card) => {
            const isSelected = selectedMethod === card.code;
            return (
              <button
                key={card.code}
                type="button"
                onClick={() => handleSelectMethodCard(card.code)}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'bg-blue-50/70 border-blue-900 ring-2 ring-blue-900/30 shadow-md shadow-blue-900/5'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-blue-900 text-white shadow-xs'
                          : card.code === 'CASH'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : card.code === 'NON_CASH'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          : card.code === 'SPLIT'
                          ? 'bg-purple-50 text-purple-700 border border-purple-100'
                          : 'bg-blue-50 text-blue-900 border border-blue-100'
                      }`}
                    >
                      {getMethodIcon(card.code, isSelected)}
                    </div>
                    {isSelected && (
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-900" />
                    )}
                  </div>
                  <span
                    className={`text-xs sm:text-sm font-black block truncate ${
                      isSelected ? 'text-blue-950' : 'text-slate-800'
                    }`}
                  >
                    {card.label}
                  </span>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500">
                    {card.txCount} Transaksi
                  </div>
                  <div
                    className={`text-xs sm:text-sm font-black truncate mt-0.5 ${
                      isSelected ? 'text-blue-900 font-black' : 'text-slate-900'
                    }`}
                  >
                    Rp {card.totalAmount.toLocaleString('id-ID')}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* SUB-FILTER NON-TUNAI: MUNCUL HANYA SAAT CARD NON-TUNAI DIKLIK */}
        {selectedMethod === 'NON_CASH' && (
          <div className="mt-3 p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl animate-fadeIn space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-indigo-700" />
                <span>Pilih Sub-Jalur Non-Tunai:</span>
              </span>
              <span className="text-[11px] font-bold text-indigo-700">
                Menampilkan:{' '}
                <strong className="text-indigo-950">
                  {nonCashSubOptions.find((s) => s.code === selectedSubMethod)?.label || 'Semua Non-Tunai'}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {nonCashSubOptions.map((sub) => {
                const isSubActive = selectedSubMethod === sub.code;
                return (
                  <button
                    key={sub.code}
                    type="button"
                    onClick={() => {
                      setSelectedSubMethod(sub.code);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSubActive
                        ? 'bg-indigo-900 text-white shadow-xs'
                        : 'bg-white text-indigo-950 hover:bg-indigo-100 border border-indigo-200'
                    }`}
                  >
                    <span>{sub.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                        isSubActive ? 'bg-indigo-800 text-white' : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {sub.txCount} tx • Rp {sub.totalAmount.toLocaleString('id-ID')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* TABEL RINCIAN ITEM TERJUAL INTERAKTIF */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
              Daftar Menu Terjual via{' '}
              <span className="text-blue-900">
                {itemAggregationByMethod[activeMethodKey]?.label || activeMethodKey}
              </span>
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Total kontribusi omset:{' '}
              <strong className="text-emerald-700">
                Rp {currentMethodTotalRevenue.toLocaleString('id-ID')}
              </strong>{' '}
              ({currentItemsList.length} varian menu)
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Search menu */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari menu / kategori..."
                className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-xl text-xs font-medium focus:border-blue-900 outline-none transition-all"
              />
            </div>

            {/* Toggle HPP & Laba Kotor Khusus Owner/Admin */}
            {isPrivileged && (
              <button
                type="button"
                onClick={() => setShowCostAndProfit(!showCostAndProfit)}
                className={`h-10 px-3 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95 ${
                  showCostAndProfit
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
                title="Tampilkan HPP dan Estimasi Margin Laba Kotor (Khusus Owner/Admin)"
              >
                <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">
                  {showCostAndProfit ? 'Sembunyikan HPP' : 'HPP & Margin'}
                </span>
                <span className="sm:hidden">HPP</span>
              </button>
            )}

            {/* Ekspor CSV */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={currentItemsList.length === 0}
              className="h-10 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shrink-0 active:scale-95"
              title="Ekspor tabel menu ini ke CSV / Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="hidden sm:inline">Excel</span>
            </button>

            {/* Cetak PDF Rekap Item */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={currentItemsList.length === 0}
              className="h-10 px-3 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shrink-0 active:scale-95"
              title="Cetak rekapitulasi item menu ini ke dokumen PDF"
            >
              <FileText className="w-3.5 h-3.5 text-blue-900 shrink-0" />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Memuat rincian item penjualan...</div>
        ) : currentItemsList.length === 0 ? (
          <div className="p-8 text-center">
            <UtensilsCrossed className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600">Tidak Ada Item Terjual</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {searchTerm
                ? `Tidak ditemukan menu yang cocok dengan kata kunci "${searchTerm}"`
                : `Belum ada transaksi penjualan lunas dengan metode ${
                    itemAggregationByMethod[activeMethodKey]?.label || activeMethodKey
                  } pada periode ini.`}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center whitespace-nowrap">No</th>
                    <th className="py-3 px-4 min-w-[180px] whitespace-nowrap">Nama Menu / Produk</th>
                    <th className="py-3 px-4 min-w-[120px] whitespace-nowrap">Kategori</th>
                    <th className="py-3 px-4 min-w-[110px] whitespace-nowrap text-center">Jumlah Terjual</th>
                    <th className="py-3 px-4 min-w-[140px] whitespace-nowrap text-right">Total Omset</th>
                    <th className="py-3 px-4 min-w-[100px] whitespace-nowrap text-right">Kontribusi</th>
                    {showCostAndProfit && isPrivileged && (
                      <>
                        <th className="py-3 px-4 min-w-[140px] whitespace-nowrap text-right text-slate-700">Total HPP</th>
                        <th className="py-3 px-4 min-w-[140px] whitespace-nowrap text-right text-emerald-800">Laba Kotor</th>
                        <th className="py-3 px-4 min-w-[90px] whitespace-nowrap text-center text-emerald-800">Margin</th>
                      </>
                    )}
                    <th className="py-3 px-4 min-w-[120px] whitespace-nowrap text-center">Alokasi Kas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700 text-xs">
                  {paginatedItems.map((item, idx) => {
                    const rowNumber = (safeCurrentPage - 1) * pageSize + idx + 1;
                    const contribPct =
                      currentMethodTotalRevenue > 0
                        ? ((item.revenue / currentMethodTotalRevenue) * 100).toFixed(1)
                        : '0.0';

                    return (
                      <tr key={item.name} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-400 text-xs font-mono whitespace-nowrap">
                          {rowNumber}
                        </td>
                        <td className="py-3 px-4 font-bold text-blue-950 text-xs whitespace-nowrap">
                          {item.name}
                        </td>
                        <td className="py-3 px-4 text-xs whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-xs whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-slate-900">
                            {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)}
                            <span className="text-[11px] font-normal text-slate-500">porsi</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-blue-950 font-mono text-xs whitespace-nowrap">
                          Rp {Math.round(item.revenue).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-600 text-xs whitespace-nowrap">
                          {contribPct}%
                        </td>
                        {showCostAndProfit && isPrivileged && (
                          <>
                            <td className="py-3 px-4 text-right font-medium text-slate-600 font-mono text-xs whitespace-nowrap">
                              Rp {Math.round(item.cost || 0).toLocaleString('id-ID')}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-emerald-700 font-mono text-xs whitespace-nowrap">
                              Rp {Math.round((item.revenue || 0) - (item.cost || 0)).toLocaleString('id-ID')}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-xs whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                                {item.revenue > 0
                                  ? (((item.revenue - (item.cost || 0)) / item.revenue) * 100).toFixed(1)
                                  : '0.0'}%
                              </span>
                            </td>
                          </>
                        )}
                        <td className="py-3 px-4 text-center text-xs whitespace-nowrap">
                          {item.hasSplitAllocation ? (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200 inline-flex items-center gap-1"
                              title="Porsi dan nominal dihitung secara proporsional pro-rata dari transaksi split payment"
                            >
                              <Layers className="w-2.5 h-2.5" />
                              <span>Pro-Rata</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>100% Kas Masuk</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Kanonikal TablePagination */}
            <TablePagination
              currentPage={safeCurrentPage}
              totalItems={currentItemsList.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
};
