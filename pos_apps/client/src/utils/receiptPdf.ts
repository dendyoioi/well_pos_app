import { jsPDF } from 'jspdf';
import type { Order, OrderChannel } from '../types/order';
import { ORDER_CHANNEL_LABELS } from '../types/order';

/**
 * Generator Dokumen PDF Struk Transaksi Kasir
 * Mendukung format thermal roll 58mm & 80mm
 */
export const generateReceiptPdf = (
  order: Order,
  paperSize: '58mm' | '80mm' = '80mm',
  isFree: boolean = false
) => {
  const widthMm = paperSize === '58mm' ? 58 : 80;
  
  // Hitung perkiraan tinggi konten berdasarkan jumlah item
  const baseHeight = 110;
  const itemHeight = (order.orderItems?.length || 1) * 12;
  const totalHeight = Math.max(160, baseHeight + itemHeight);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [widthMm, totalHeight],
  });

  const margin = 4;
  const contentWidth = widthMm - margin * 2;
  let y = 8;

  // Set Font Monospace
  doc.setFont('courier', 'bold');

  // Header Toko
  doc.setFontSize(paperSize === '58mm' ? 10 : 12);
  doc.text(order.outlet?.name || 'POS TOKO UTAMA', widthMm / 2, y, { align: 'center' });
  y += 4.5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(paperSize === '58mm' ? 7 : 8);
  if (order.outlet?.address) {
    const addressLines = doc.splitTextToSize(order.outlet.address, contentWidth);
    doc.text(addressLines, widthMm / 2, y, { align: 'center' });
    y += addressLines.length * 3.5;
  }
  if (order.outlet?.phone) {
    doc.text(`Telp: ${order.outlet.phone}`, widthMm / 2, y, { align: 'center' });
    y += 4;
  }

  // Divider Line
  const drawDashedLine = (currentY: number) => {
    doc.setLineDashPattern([1, 1], 0);
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, currentY, widthMm - margin, currentY);
  };

  drawDashedLine(y);
  y += 4;

  // Info Faktur & Saluran
  doc.setFontSize(paperSize === '58mm' ? 7 : 8);
  doc.text(`No: ${order.invoiceNumber}`, margin, y);
  y += 3.5;

  // Saluran Pesanan Badge
  const channelKey = (order.channel || 'DINE_IN') as OrderChannel;
  const channelInfo = ORDER_CHANNEL_LABELS[channelKey] || { label: order.channel || 'Dine In' };
  doc.setFont('courier', 'bold');
  doc.text(`Saluran: [${channelInfo.label.toUpperCase()}]`, margin, y);
  doc.setFont('courier', 'normal');
  y += 3.5;

  const dateStr = new Date(order.createdAt).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(`Tgl: ${dateStr}`, margin, y);
  y += 3.5;

  doc.text(`Kasir: ${order.cashier?.name || 'Kasir'}`, margin, y);
  y += 3.5;

  if (order.customerName || order.customer?.name) {
    const custName = order.customer?.name || order.customerName;
    const memberCode = order.customer?.code ? ` [${order.customer.code}]` : '';
    doc.text(`Plg: ${custName}${memberCode}`, margin, y);
    y += 3.5;
    if (order.customerPhone || order.customer?.phone) {
      const phone = order.customer?.phone || order.customerPhone;
      doc.text(`WA : ${phone}`, margin, y);
      y += 3.5;
    }
  }

  drawDashedLine(y);
  y += 4;

  // Line Items
  order.orderItems?.forEach((item) => {
    doc.setFont('courier', 'bold');
    doc.setFontSize(paperSize === '58mm' ? 7 : 8);
    const itemName = item.product?.name || 'Produk';
    const splitName = doc.splitTextToSize(itemName, contentWidth);
    doc.text(splitName, margin, y);
    y += splitName.length * 3.2;

    doc.setFont('courier', 'normal');
    doc.setFontSize(paperSize === '58mm' ? 6.5 : 7.5);
    const qtyPrice = `${item.quantity} x ${Number(item.unitPrice).toLocaleString('id-ID')}`;
    const subtotalStr = Number(item.subtotal).toLocaleString('id-ID');
    doc.text(qtyPrice, margin + 2, y);
    doc.text(subtotalStr, widthMm - margin, y, { align: 'right' });
    y += 3.2;

    if (item.discountAmount > 0) {
      const discStr = `-Disc: ${Number(item.discountAmount * item.quantity).toLocaleString('id-ID')}`;
      doc.text(discStr, margin + 2, y);
      y += 3.2;
    }
  });

  drawDashedLine(y);
  y += 4;

  // Summary Calculations
  doc.setFontSize(paperSize === '58mm' ? 7 : 8);

  const printRow = (label: string, value: string, isBold = false) => {
    if (isBold) doc.setFont('courier', 'bold');
    else doc.setFont('courier', 'normal');
    doc.text(label, margin, y);
    doc.text(value, widthMm - margin, y, { align: 'right' });
    y += 3.8;
  };

  printRow('Subtotal:', `Rp ${Number(order.subtotal).toLocaleString('id-ID')}`);

  if (order.discountAmount > 0) {
    printRow('Diskon:', `-Rp ${Number(order.discountAmount).toLocaleString('id-ID')}`);
  }
  if (order.serviceCharge > 0) {
    printRow('Biaya/Layanan:', `+Rp ${Number(order.serviceCharge).toLocaleString('id-ID')}`);
  }
  if (order.taxAmount > 0) {
    printRow('Pajak (PB1/PPN):', `+Rp ${Number(order.taxAmount).toLocaleString('id-ID')}`);
  }

  y += 1;
  drawDashedLine(y);
  y += 4;

  doc.setFontSize(paperSize === '58mm' ? 8.5 : 9.5);
  printRow('TOTAL:', `Rp ${Number(order.grandTotal).toLocaleString('id-ID')}`, true);

  y += 1;
  drawDashedLine(y);
  y += 4;

  // Pembayaran & Kembalian
  const payment = order.payments?.[0];
  if (payment) {
    doc.setFontSize(paperSize === '58mm' ? 7 : 8);
    printRow('Metode:', payment.method);
    printRow('Bayar:', `Rp ${Number(payment.amountPaid).toLocaleString('id-ID')}`);
    if (payment.method === 'CASH') {
      printRow('Kembalian:', `Rp ${Number(payment.changeGiven).toLocaleString('id-ID')}`, true);
    }
    if (payment.qrisReference) {
      printRow('Ref QRIS:', payment.qrisReference);
    }
  }

  y += 2;
  drawDashedLine(y);
  y += 5;

  // Footer Message
  doc.setFont('courier', 'normal');
  doc.setFontSize(paperSize === '58mm' ? 6 : 7);
  doc.text('Terima kasih atas kunjungan Anda!', widthMm / 2, y, { align: 'center' });
  y += 3;
  doc.text('Bukti pembayaran yang sah', widthMm / 2, y, { align: 'center' });

  if (isFree) {
    y += 3.5;
    doc.setFont('courier', 'bold');
    doc.setFontSize(paperSize === '58mm' ? 5.5 : 6.5);
    doc.text('Powered by Well POS (Aplikasi Kasir Gratis)', widthMm / 2, y, { align: 'center' });
  }

  // Unduh File PDF
  const cleanInv = order.invoiceNumber.replace(/\//g, '-');
  doc.save(`Struk_${cleanInv}.pdf`);
};
