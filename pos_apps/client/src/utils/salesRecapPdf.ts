import { jsPDF } from 'jspdf';
import type { Order, OrderChannel } from '../types/order';
import { ORDER_CHANNEL_LABELS } from '../types/order';

export interface GenerateSalesPdfOptions {
  filterChannel?: string;
  outletName?: string;
  cashierName?: string;
  dateRangeText?: string;
}

/**
 * Generator Dokumen PDF Rekapitulasi Daftar Faktur Penjualan
 * Menghasilkan lembar laporan penjualan profesional berformat A4 Landscape (297mm x 210mm).
 */
export const generateSalesRecapPdf = (
  orders: Order[],
  filterChannelOrOptions: string | GenerateSalesPdfOptions = 'ALL',
  legacyOutletName: string = 'Well POS'
) => {
  // Dukungan opsi objek modern maupun argumen legacy
  const options: GenerateSalesPdfOptions =
    typeof filterChannelOrOptions === 'object'
      ? filterChannelOrOptions
      : {
          filterChannel: filterChannelOrOptions,
          outletName: legacyOutletName,
        };

  const filterChannel = options.filterChannel || 'ALL';
  const outletName = options.outletName || orders[0]?.outlet?.name || 'Well POS';
  const cashierText = options.cashierName && options.cashierName !== 'ALL' ? options.cashierName : 'Semua Kasir';
  const dateRangeText = options.dateRangeText || 'Periode Aktif';

  // Standar A4 Landscape: 297mm x 210mm memberikan ruang horizontal lega (+87mm dibanding portrait)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4', // 297mm x 210mm
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 14;
  let y = 14;

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(23, 37, 84); // blue-950
  doc.text('REKAPITULASI DAFTAR FAKTUR TRANSAKSI PENJUALAN', margin, y);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  const printDate = new Date().toLocaleString('id-ID', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
  doc.text(`Toko / Outlet: ${outletName}  |  Waktu Cetak: ${printDate}`, margin, y);
  y += 4.5;

  const channelText =
    filterChannel === 'ALL'
      ? 'Semua Saluran Penjualan'
      : ORDER_CHANNEL_LABELS[filterChannel as OrderChannel]?.label || filterChannel;
  doc.text(
    `Saluran Penjualan: ${channelText}  |  Kasir: ${cashierText}  |  Periode: ${dateRangeText}`,
    margin,
    y
  );
  y += 6.5;

  // Garis Pemisah Header
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Ringkasan Statistik 4 Kotak Berjajar di Landscape (Lebar total 269mm)
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

  const boxWidth = (pageWidth - margin * 2 - 9) / 4; // ~65mm
  const boxHeight = 16;

  const metrics = [
    { label: 'TOTAL FAKTUR PENJUALAN', val: `${totalFaktur} Transaksi`, sub: 'Faktur terfilter' },
    {
      label: 'TOTAL PENERIMAAN KASIR',
      val: `Rp ${Math.round(totalLunasOmset).toLocaleString('id-ID')}`,
      sub: 'Akumulasi lunas',
    },
    {
      label: 'TRANSAKSI TUNAI (CASH)',
      val: `${cashCount} Faktur`,
      sub: 'Laci kasir fisik',
    },
    {
      label: 'NON-TUNAI & BELUM BAYAR',
      val: `${qrisCount} QRIS  |  ${unpaidCount} Pending`,
      sub: 'Digital & Open Tab',
    },
  ];

  metrics.forEach((m, idx) => {
    const bx = margin + idx * (boxWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(bx, y, boxWidth, boxHeight, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(bx, y, boxWidth, boxHeight, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(m.label, bx + 3.5, y + 4.5);

    doc.setFontSize(9);
    doc.setTextColor(23, 37, 84);
    doc.text(m.val, bx + 3.5, y + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(m.sub, bx + 3.5, y + 13.8);
  });

  y += boxHeight + 7;

  // Kolom Header Tabel Transaksi Landscape (Lebar Total: 269mm)
  const cols = [
    { name: 'No', width: 10, align: 'center' },
    { name: 'No. Faktur Transaksi', width: 46, align: 'left' },
    { name: 'Tanggal & Jam', width: 30, align: 'left' },
    { name: 'Kasir', width: 28, align: 'left' },
    { name: 'Saluran', width: 26, align: 'left' },
    { name: 'Pelanggan & Meja', width: 40, align: 'left' },
    { name: 'Metode Bayar', width: 30, align: 'left' },
    { name: 'Status', width: 25, align: 'center' },
    { name: 'Grand Total (Rp)', width: 34, align: 'right' },
  ];

  const drawTableHeader = (currentY: number) => {
    doc.setFillColor(30, 58, 138); // blue-900
    doc.rect(margin, currentY, pageWidth - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let curX = margin;
    cols.forEach((col) => {
      if (col.align === 'right') {
        doc.text(col.name, curX + col.width - 2.5, currentY + 4.8, { align: 'right' });
      } else if (col.align === 'center') {
        doc.text(col.name, curX + col.width / 2, currentY + 4.8, { align: 'center' });
      } else {
        doc.text(col.name, curX + 2.5, currentY + 4.8);
      }
      curX += col.width;
    });
  };

  drawTableHeader(y);
  y += 7;

  // Baris-baris Data Transaksi
  const rowHeight = 7;

  orders.forEach((order, index) => {
    // Auto-Pagination jika baris mendekati batas bawah halaman
    if (y + rowHeight > pageHeight - 16) {
      doc.addPage();
      y = 14;
      drawTableHeader(y);
      y += 7;
    }

    // Zebra striping
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F');
    }

    // Garis batas bawah per baris
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.3);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

    const rowY = y + 4.8;
    let curX = margin;

    // 1. No
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(String(index + 1), curX + cols[0].width / 2, rowY, { align: 'center' });
    curX += cols[0].width;

    // 2. No Faktur
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(23, 37, 84); // blue-950
    doc.text(order.invoiceNumber, curX + 2.5, rowY);
    curX += cols[1].width;

    // 3. Tanggal & Waktu (WIB)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const dateStr = new Date(order.createdAt).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    doc.text(dateStr, curX + 2.5, rowY);
    curX += cols[2].width;

    // 4. Kasir (Visibilitas Akuntabilitas Kasir - Rule 15)
    const cashierName = order.cashier?.name || (order as any).user?.name || 'Kasir';
    const splitCashier = doc.splitTextToSize(cashierName, cols[3].width - 4);
    doc.text(splitCashier[0] || cashierName, curX + 2.5, rowY);
    curX += cols[3].width;

    // 5. Saluran
    const chKey = (order.channel || 'DINE_IN') as OrderChannel;
    const chName = ORDER_CHANNEL_LABELS[chKey]?.label || order.channel || 'Dine In';
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138); // blue-900
    doc.text(chName, curX + 2.5, rowY);
    curX += cols[4].width;

    // 6. Pelanggan & Meja
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const custBase = order.customerName || order.customer?.name || 'Umum';
    const tableSuffix = order.tableNumber ? ` (Meja ${order.tableNumber})` : '';
    const custDisplay = `${custBase}${tableSuffix}`;
    const splitCust = doc.splitTextToSize(custDisplay, cols[5].width - 4);
    doc.text(splitCust[0] || custDisplay, curX + 2.5, rowY);
    curX += cols[5].width;

    // 7. Metode Bayar
    let method = 'CASH';
    if (order.payments && order.payments.length > 0) {
      if (order.payments.length > 1) {
        method = 'SPLIT';
      } else {
        method = order.payments[0].method;
      }
    } else if ((order as any).paymentMethod) {
      method = (order as any).paymentMethod;
    }
    doc.text(method, curX + 2.5, rowY);
    curX += cols[6].width;

    // 8. Status Pembayaran
    const isVoid = order.orderStatus === 'VOIDED' || order.status === 'CANCELLED';
    const isUnpaid = order.paymentStatus === 'UNPAID';
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    if (isVoid) {
      doc.setTextColor(225, 29, 72); // rose-600
      doc.text('BATAL', curX + cols[7].width / 2, rowY, { align: 'center' });
    } else if (isUnpaid) {
      doc.setTextColor(217, 119, 6); // amber-600
      doc.text('BELUM BAYAR', curX + cols[7].width / 2, rowY, { align: 'center' });
    } else {
      doc.setTextColor(16, 185, 129); // emerald-600
      doc.text('LUNAS', curX + cols[7].width / 2, rowY, { align: 'center' });
    }
    curX += cols[7].width;

    // 9. Grand Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(23, 37, 84);
    const totalStr = `Rp ${Math.round(Number(order.grandTotal || 0)).toLocaleString('id-ID')}`;
    doc.text(totalStr, curX + cols[8].width - 2.5, rowY, { align: 'right' });

    y += rowHeight;
  });

  // Footer Total Keseluruhan
  y += 2.5;
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(23, 37, 84);
  doc.text('TOTAL REKAPITULASI PENJUALAN:', margin + 40, y);
  doc.text(
    `${totalFaktur} Faktur   |   Total Penerimaan Lunas: Rp ${Math.round(totalLunasOmset).toLocaleString('id-ID')}`,
    pageWidth - margin - 2.5,
    y,
    { align: 'right' }
  );

  // Simpan / Unduh Dokumen PDF Landscape
  const safeChannel = filterChannel.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Daftar_Faktur_Penjualan_${safeChannel}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
};
