import type { Order, OrderChannel } from '../types/order';
import { ORDER_CHANNEL_LABELS } from '../types/order';

export interface ExportOrdersCsvOptions {
  outletName?: string;
  cashierName?: string;
  filterChannel?: string;
  dateRangeText?: string;
  filenamePrefix?: string;
  onError?: (msg: string) => void;
}

/**
 * Ekspor Data Riwayat Transaksi Penjualan ke format CSV / Excel
 * Dilengkapi Kop Dokumen Resmi (Executive Header) dan UTF-8 BOM
 * agar terbaca sempurna dan profesional di Microsoft Excel (Indonesia/Global)
 */
export const exportOrdersToCsv = (
  orders: Order[],
  filenamePrefixOrOptions: string | ExportOrdersCsvOptions = 'rekap_faktur_penjualan_wellpos',
  legacyOnError?: (msg: string) => void
): boolean => {
  if (orders.length === 0) {
    const errorFn =
      typeof filenamePrefixOrOptions === 'object' && filenamePrefixOrOptions.onError
        ? filenamePrefixOrOptions.onError
        : legacyOnError;

    if (errorFn) {
      errorFn('Tidak ada data transaksi untuk diekspor.');
    } else {
      console.warn('exportOrdersToCsv: Tidak ada data transaksi untuk diekspor.');
    }
    return false;
  }

  // Resolusi options (mendukung pemanggilan modern objek maupun legacy string)
  const options: ExportOrdersCsvOptions =
    typeof filenamePrefixOrOptions === 'string'
      ? { filenamePrefix: filenamePrefixOrOptions, onError: legacyOnError }
      : filenamePrefixOrOptions;

  const outletName = options.outletName || orders[0]?.outlet?.name || 'Well POS';
  const cashierText = options.cashierName && options.cashierName !== 'ALL' ? options.cashierName : 'Semua Kasir';
  const filterCh = options.filterChannel || 'ALL';
  const channelText =
    filterCh === 'ALL'
      ? 'Semua Saluran Penjualan'
      : ORDER_CHANNEL_LABELS[filterCh as OrderChannel]?.label || filterCh;
  const dateRangeText = options.dateRangeText || 'Periode Aktif';
  const prefix = options.filenamePrefix || 'daftar_faktur_penjualan_wellpos';
  const nowStr = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });

  // Ringkasan Agregasi
  const totalFaktur = orders.length;
  const paidOrders = orders.filter((o) => o.paymentStatus !== 'UNPAID' && o.orderStatus !== 'VOIDED' && o.status !== 'CANCELLED');
  const totalLunasOmset = paidOrders.reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);
  const cashCount = orders.filter((o) => {
    const m = (o.payments?.[0]?.method || (o as any).paymentMethod || '').toUpperCase();
    return m === 'CASH' || m === 'TUNAI';
  }).length;
  const qrisCount = orders.filter((o) => {
    const m = (o.payments?.[0]?.method || (o as any).paymentMethod || '').toUpperCase();
    return m.includes('QRIS');
  }).length;
  const unpaidCount = orders.filter((o) => o.paymentStatus === 'UNPAID').length;

  // Helper escape CSV cell
  const escapeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  // 1. Kop Dokumen Resmi (Executive Header Banner - Excel Friendly)
  const headerBanner = [
    [escapeCell('REKAPITULASI DAFTAR FAKTUR PENJUALAN')],
    [
      escapeCell(`Toko / Outlet: ${outletName}`),
      escapeCell(`Saluran Penjualan: ${channelText}`),
    ],
    [
      escapeCell(`Kasir Operasional: ${cashierText}`),
      escapeCell(`Periode Tanggal: ${dateRangeText}`),
    ],
    [escapeCell(`Waktu Ekspor: ${nowStr}`)],
    [
      escapeCell(
        `Ringkasan: ${totalFaktur} Faktur Transaksi | Total Omset Lunas: Rp ${Math.round(totalLunasOmset).toLocaleString('id-ID')} | Tunai: ${cashCount} | QRIS: ${qrisCount} | Belum Bayar: ${unpaidCount}`
      ),
    ],
    ['""'], // Baris kosong pemisah
  ];

  // 2. Header Kolom CSV
  const headers = [
    'No',
    'No Faktur',
    'Tanggal & Waktu',
    'Saluran Pesanan',
    'Nama Pelanggan',
    'Nomor Meja',
    'Nomor WhatsApp',
    'Nama Kasir',
    'Metode Pembayaran',
    'Subtotal (Rp)',
    'Diskon (Rp)',
    'Pajak PPN (Rp)',
    'Biaya Layanan (Rp)',
    'Grand Total (Rp)',
    'Status Pembayaran',
    'Status Pesanan',
  ];

  // 3. Baris-baris data transaksi
  const rows = orders.map((order, idx) => {
    const chKey = (order.channel || 'DINE_IN') as OrderChannel;
    const chName = ORDER_CHANNEL_LABELS[chKey]?.label || order.channel || 'Dine In';
    
    // Format metode pembayaran multi-tender
    let method = 'CASH';
    if (order.payments && order.payments.length > 0) {
      if (order.payments.length > 1) {
        method = `SPLIT (${order.payments.map((p) => p.method).join(' + ')})`;
      } else {
        method = order.payments[0].method;
      }
    } else if ((order as any).paymentMethod) {
      method = (order as any).paymentMethod;
    }

    const dateStr = new Date(order.createdAt).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const tableStr = order.tableNumber ? `Meja ${order.tableNumber}` : '-';

    return [
      idx + 1,
      order.invoiceNumber,
      dateStr,
      chName,
      order.customerName || order.customer?.name || 'Umum',
      tableStr,
      order.customerPhone || order.customer?.phone || '-',
      order.cashier?.name || (order as any).user?.name || 'Kasir',
      method,
      Math.round(Number(order.subtotal || 0)),
      Math.round(Number(order.discountAmount || 0)),
      Math.round(Number(order.taxAmount || 0)),
      Math.round(Number(order.serviceCharge || 0)),
      Math.round(Number(order.grandTotal || 0)),
      order.paymentStatus || 'PAID',
      order.orderStatus || order.status || 'COMPLETED',
    ].map(escapeCell).join(',');
  });

  // Gabungkan seluruh baris dengan UTF-8 BOM (\uFEFF)
  const csvContent =
    '\uFEFF' +
    [
      ...headerBanner.map((b) => b.join(',')),
      headers.map(escapeCell).join(','),
      ...rows,
    ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  const dateTag = new Date().toISOString().slice(0, 10);
  downloadLink.download = `${prefix}_${dateTag}.csv`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
  return true;
};
