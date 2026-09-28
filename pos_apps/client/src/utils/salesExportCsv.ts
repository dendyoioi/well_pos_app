import type { Order, OrderChannel } from '../types/order';
import { ORDER_CHANNEL_LABELS } from '../types/order';

/**
 * Ekspor Data Riwayat Transaksi Penjualan ke format CSV / Excel
 * Menggunakan UTF-8 BOM agar terbaca sempurna di Microsoft Excel (Indonesia/Global)
 */
export const exportOrdersToCsv = (
  orders: Order[],
  filenamePrefix: string = 'rekap_transaksi_wellpos',
  onError?: (msg: string) => void
): boolean => {
  if (orders.length === 0) {
    if (onError) {
      onError('Tidak ada data transaksi untuk diekspor.');
    } else {
      console.warn('exportOrdersToCsv: Tidak ada data transaksi untuk diekspor.');
    }
    return false;
  }

  // Header Kolom CSV
  const headers = [
    'No',
    'No Faktur',
    'Tanggal & Waktu',
    'Saluran Pesanan',
    'Nama Pelanggan',
    'Nomor WhatsApp',
    'Nama Kasir',
    'Metode Pembayaran',
    'Subtotal (Rp)',
    'Diskon (Rp)',
    'Pajak PPN (Rp)',
    'Biaya Layanan (Rp)',
    'Grand Total (Rp)',
    'Status Pembayaran',
  ];

  // Helper escape CSV cell
  const escapeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  // Baris-baris data
  const rows = orders.map((order, idx) => {
    const chKey = (order.channel || 'DINE_IN') as OrderChannel;
    const chName = ORDER_CHANNEL_LABELS[chKey]?.label || order.channel || 'Dine In';
    const method = order.payments?.map((p) => p.method).join(' + ') || 'CASH';
    const dateStr = new Date(order.createdAt).toLocaleString('id-ID');

    return [
      idx + 1,
      order.invoiceNumber,
      dateStr,
      chName,
      order.customerName || order.customer?.name || 'Umum',
      order.customerPhone || order.customer?.phone || '-',
      order.cashier?.name || 'Kasir',
      method,
      order.subtotal,
      order.discountAmount || 0,
      order.taxAmount || 0,
      order.serviceCharge || 0,
      order.grandTotal,
      order.paymentStatus || 'PAID',
    ].map(escapeCell).join(',');
  });

  // Gabungkan dengan UTF-8 BOM (\uFEFF)
  const csvContent = '\uFEFF' + [headers.map(escapeCell).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  const dateTag = new Date().toISOString().slice(0, 10);
  downloadLink.download = `${filenamePrefix}_${dateTag}.csv`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
  return true;
};
