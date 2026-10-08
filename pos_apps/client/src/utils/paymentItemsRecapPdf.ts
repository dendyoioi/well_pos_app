import { jsPDF } from 'jspdf';

export interface PaymentItemRecapRow {
  name: string;
  category: string;
  quantity: number;
  revenue: number;
  cost?: number;
  grossProfit?: number;
  marginPercent?: string;
  hasSplitAllocation?: boolean;
}

export interface GeneratePaymentItemsPdfOptions {
  items: PaymentItemRecapRow[];
  methodLabel: string;
  outletName?: string;
  cashierName?: string;
  dateRangeText?: string;
  totalRevenue: number;
  includeCostAndProfit?: boolean;
}

/**
 * Generator Dokumen PDF Rekapitulasi Item Menu Terjual per Metode Pembayaran
 * Format A4 Portrait profesional dan standar audit keuangan.
 */
export const generatePaymentItemsRecapPdf = (options: GeneratePaymentItemsPdfOptions) => {
  const {
    items,
    methodLabel,
    outletName = 'Well POS',
    cashierName,
    dateRangeText = 'Periode Aktif',
    totalRevenue,
    includeCostAndProfit = false,
  } = options;

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
  doc.text('REKAPITULASI PENJUALAN ITEM MENU', margin, y);
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

  const filterKasirText = cashierName && cashierName !== 'ALL' ? cashierName : 'Semua Kasir';
  doc.text(
    `Filter Metode: ${methodLabel} | Kasir: ${filterKasirText} | Rentang: ${dateRangeText}`,
    margin,
    y
  );
  y += 8;

  // Garis Pemisah Header
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  // Ringkasan Statistik Kotak
  const totalQty = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
  const totalUnique = items.length;

  const boxWidth = (pageWidth - margin * 2 - 9) / 4;
  const boxHeight = 18;

  const metrics = [
    { label: 'TOTAL MENU TERJUAL', val: `${totalUnique} Item`, sub: 'Menu unik aktif' },
    {
      label: 'TOTAL KUANTITAS',
      val: `${totalQty % 1 === 0 ? totalQty : totalQty.toFixed(1)} Porsi`,
      sub: 'Akumulasi terjual',
    },
    {
      label: 'TOTAL OMSET METODE',
      val: `Rp ${Math.round(totalRevenue).toLocaleString('id-ID')}`,
      sub: methodLabel,
    },
    {
      label: 'KASIR OPERASIONAL',
      val: filterKasirText.length > 15 ? `${filterKasirText.slice(0, 13)}...` : filterKasirText,
      sub: 'Operator shift',
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
    doc.text(m.label, bx + 3, y + 5);

    doc.setFontSize(9);
    doc.setTextColor(23, 37, 84);
    doc.text(m.val, bx + 3, y + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(m.sub, bx + 3, y + 15);
  });

  y += boxHeight + 8;

  // Kolom Header Tabel (Adaptif jika HPP & Laba Kotor diaktifkan oleh Owner)
  const cols = includeCostAndProfit
    ? [
        { name: 'No', width: 8, align: 'center' },
        { name: 'Nama Menu / Produk', width: 44, align: 'left' },
        { name: 'Kategori', width: 22, align: 'left' },
        { name: 'Qty', width: 14, align: 'right' },
        { name: 'Omset', width: 24, align: 'right' },
        { name: 'Total HPP', width: 22, align: 'right' },
        { name: 'Laba Kotor', width: 24, align: 'right' },
        { name: 'Margin', width: 18, align: 'right' },
      ]
    : [
        { name: 'No', width: 10, align: 'center' },
        { name: 'Nama Menu / Produk', width: 66, align: 'left' },
        { name: 'Kategori', width: 34, align: 'left' },
        { name: 'Terjual (Qty)', width: 24, align: 'right' },
        { name: 'Total Omset', width: 28, align: 'right' },
        { name: 'Pangsa (%)', width: 20, align: 'right' },
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

  // Baris-baris Data Item
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  items.forEach((it, index) => {
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

    // Nama Menu / Produk
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(23, 37, 84);
    const splitName = doc.splitTextToSize(it.name, cols[1].width - 3);
    doc.text(splitName[0] || it.name, curX + 2, rowY);
    curX += cols[1].width;

    // Kategori
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const cat = it.category || 'Umum';
    const splitCat = doc.splitTextToSize(cat, cols[2].width - 3);
    doc.text(splitCat[0] || cat, curX + 2, rowY);
    curX += cols[2].width;

    // Qty Terjual
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    const qtyStr = it.quantity % 1 === 0 ? String(it.quantity) : it.quantity.toFixed(1);
    doc.text(qtyStr, curX + cols[3].width - 2, rowY, { align: 'right' });
    curX += cols[3].width;

    // Total Omset
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(23, 37, 84);
    const omsetStr = `Rp ${Math.round(it.revenue).toLocaleString('id-ID')}`;
    doc.text(omsetStr, curX + cols[4].width - 2, rowY, { align: 'right' });
    curX += cols[4].width;

    if (includeCostAndProfit) {
      // Total HPP
      const costVal = Math.round(it.cost || 0);
      doc.text(`Rp ${costVal.toLocaleString('id-ID')}`, curX + cols[5].width - 2, rowY, { align: 'right' });
      curX += cols[5].width;

      // Laba Kotor
      const profitVal = Math.round(it.revenue - (it.cost || 0));
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129); // emerald-600
      doc.text(`Rp ${profitVal.toLocaleString('id-ID')}`, curX + cols[6].width - 2, rowY, { align: 'right' });
      curX += cols[6].width;

      // Margin %
      const marginPct = it.revenue > 0 ? `${(((it.revenue - (it.cost || 0)) / it.revenue) * 100).toFixed(1)}%` : '0.0%';
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(marginPct, curX + cols[7].width - 2, rowY, { align: 'right' });
    } else {
      // Pangsa (%)
      const pct =
        totalRevenue > 0 ? `${((it.revenue / totalRevenue) * 100).toFixed(1)}%` : '0.0%';
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(pct, curX + cols[5].width - 2, rowY, { align: 'right' });
    }

    y += 6.5;
  });

  // Footer Total Keseluruhan
  y += 2;
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(23, 37, 84);
  doc.text('TOTAL REKAPITULASI ITEM:', margin + 40, y);
  doc.text(
    `${totalQty % 1 === 0 ? totalQty : totalQty.toFixed(1)} Porsi  |  Rp ${Math.round(totalRevenue).toLocaleString('id-ID')}`,
    pageWidth - margin - 2,
    y,
    { align: 'right' }
  );

  // Unduh Berkas PDF
  const safeMethod = methodLabel.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Rekap_Item_${safeMethod}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
};
