import { jsPDF } from 'jspdf';
import type { Order, OrderChannel } from '../types/order';
import { ORDER_CHANNEL_LABELS } from '../types/order';

/**
 * Generator Dokumen PDF Rekapitulasi Transaksi Penjualan
 * Menghasilkan lembar laporan penjualan profesional berformat A4 Portrait.
 */
export const generateSalesRecapPdf = (
  orders: Order[],
  filterChannel: string = 'ALL',
  outletName: string = 'Well POS'
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4', // 210mm x 297mm
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  let y = 16;

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(23, 37, 84); // blue-950
  doc.text('REKAPITULASI TRANSAKSI PENJUALAN', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  const printDate = new Date().toLocaleString('id-ID', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
  doc.text(`Outlet: ${outletName} | Dicetak: ${printDate}`, margin, y);
  y += 5;

  const channelText =
    filterChannel === 'ALL'
      ? 'Semua Saluran Penjualan'
      : ORDER_CHANNEL_LABELS[filterChannel as OrderChannel]?.label || filterChannel;
  doc.text(`Filter Saluran: ${channelText}`, margin, y);
  y += 8;

  // Garis Pemisah Header
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  // Ringkasan Statistik Kotak
  const totalOmset = orders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
  const totalFaktur = orders.length;
  const cashCount = orders.filter((o) => o.payments?.[0]?.method === 'CASH').length;
  const qrisCount = orders.filter((o) => o.payments?.[0]?.method === 'QRIS').length;

  const boxWidth = (pageWidth - margin * 2 - 9) / 4;
  const boxHeight = 18;

  const metrics = [
    { label: 'TOTAL TRANSAKSI', val: `${totalFaktur} Faktur`, sub: 'Periode aktif' },
    { label: 'TOTAL OMSET KASIR', val: `Rp ${totalOmset.toLocaleString('id-ID')}`, sub: 'Akumulasi bruto' },
    { label: 'PEMBAYARAN TUNAI', val: `${cashCount} Transaksi`, sub: 'Laci kasir' },
    { label: 'PEMBAYARAN QRIS', val: `${qrisCount} Transaksi`, sub: 'Non-tunai digital' },
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
    doc.text(m.label, bx + 3, y + 5);

    doc.setFontSize(9.5);
    doc.setTextColor(23, 37, 84);
    doc.text(m.val, bx + 3, y + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(m.sub, bx + 3, y + 15);
  });

  y += boxHeight + 8;

  // Header Tabel Transaksi
  const cols = [
    { name: 'No', width: 8, align: 'center' },
    { name: 'No. Faktur', width: 42, align: 'left' },
    { name: 'Waktu', width: 28, align: 'left' },
    { name: 'Saluran', width: 26, align: 'left' },
    { name: 'Pelanggan', width: 34, align: 'left' },
    { name: 'Metode', width: 20, align: 'left' },
    { name: 'Total Bayar', width: 24, align: 'right' },
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
        doc.text(col.name, curX + col.width - 2, currentY + 4.8, { align: 'right' });
      } else if (col.align === 'center') {
        doc.text(col.name, curX + col.width / 2, currentY + 4.8, { align: 'center' });
      } else {
        doc.text(col.name, curX + 2, currentY + 4.8);
      }
      curX += col.width;
    });
  };

  drawTableHeader(y);
  y += 7;

  // Baris-baris Data Transaksi
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  orders.forEach((order, index) => {
    // Pagination jika mendekati batas bawah halaman
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 16;
      drawTableHeader(y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
    }

    // Zebra striping
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, pageWidth - margin * 2, 6.5, 'F');
    }

    const rowY = y + 4.5;
    let curX = margin;

    // No
    doc.setTextColor(100, 116, 139);
    doc.text(String(index + 1), curX + cols[0].width / 2, rowY, { align: 'center' });
    curX += cols[0].width;

    // No Faktur
    doc.setFont('courier', 'bold');
    doc.setTextColor(23, 37, 84);
    doc.text(order.invoiceNumber, curX + 2, rowY);
    curX += cols[1].width;

    // Waktu
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const dateStr = new Date(order.createdAt).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    doc.text(dateStr, curX + 2, rowY);
    curX += cols[2].width;

    // Saluran
    const chKey = (order.channel || 'DINE_IN') as OrderChannel;
    const chName = ORDER_CHANNEL_LABELS[chKey]?.label || order.channel || 'Dine In';
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text(chName, curX + 2, rowY);
    curX += cols[3].width;

    // Pelanggan
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const cust = order.customerName || order.customer?.name || 'Umum';
    const splitCust = doc.splitTextToSize(cust, cols[4].width - 3);
    doc.text(splitCust[0] || 'Umum', curX + 2, rowY);
    curX += cols[4].width;

    // Metode
    const method = order.payments?.[0]?.method || 'CASH';
    doc.text(method, curX + 2, rowY);
    curX += cols[5].width;

    // Total Bayar
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(23, 37, 84);
    const totalStr = `Rp ${Number(order.grandTotal).toLocaleString('id-ID')}`;
    doc.text(totalStr, curX + cols[6].width - 2, rowY, { align: 'right' });

    y += 6.5;
  });

  // Footer Total Keseluruhan
  y += 2;
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(23, 37, 84);
  doc.text('TOTAL KESELURUHAN PENJUALAN:', margin + 40, y);
  doc.text(`Rp ${totalOmset.toLocaleString('id-ID')}`, pageWidth - margin - 2, y, { align: 'right' });

  // Simpan / Unduh Dokumen PDF
  const filename = `Rekap_Penjualan_${filterChannel}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
};
