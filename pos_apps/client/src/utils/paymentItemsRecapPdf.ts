import { jsPDF } from 'jspdf';

export interface PaymentItemRecapRow {
  name: string;
  productName?: string;
  variantName?: string | null;
  modifiers?: Array<{ name: string; priceDelta?: number }>;
  notes?: string | null;
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
 * Format A4 Landscape (297mm x 210mm) profesional dengan paritas rincian varian, modifier, dan catatan.
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
  doc.text('REKAPITULASI PENJUALAN ITEM MENU PER METODE PEMBAYARAN', margin, y);
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

  const filterKasirText = cashierName && cashierName !== 'ALL' ? cashierName : 'Semua Kasir';
  doc.text(
    `Metode Pembayaran: ${methodLabel}  |  Kasir: ${filterKasirText}  |  Periode: ${dateRangeText}`,
    margin,
    y
  );
  y += 6.5;

  // Garis Pemisah Header
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Ringkasan Statistik 4 Kotak Berjajar Lega di Landscape (Lebar total 269mm)
  const totalQty = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
  const totalUnique = items.length;

  const boxWidth = (pageWidth - margin * 2 - 9) / 4; // ~65mm
  const boxHeight = 16;

  const metrics = [
    { label: 'TOTAL MENU TERJUAL', val: `${totalUnique} Item Menu`, sub: 'Produk/varian aktif' },
    {
      label: 'TOTAL KUANTITAS TERJUAL',
      val: `${totalQty % 1 === 0 ? totalQty : totalQty.toFixed(1)} Porsi / Pcs`,
      sub: 'Akumulasi fisik',
    },
    {
      label: 'TOTAL OMSET METODE',
      val: `Rp ${Math.round(totalRevenue).toLocaleString('id-ID')}`,
      sub: methodLabel,
    },
    {
      label: 'KASIR OPERASIONAL',
      val: filterKasirText.length > 20 ? `${filterKasirText.slice(0, 18)}...` : filterKasirText,
      sub: 'Operator shift audit',
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

  // Kolom Header Tabel Landscape (Lebar Total: 269mm)
  const cols = includeCostAndProfit
    ? [
        { name: 'No', width: 10, align: 'center' },
        { name: 'Nama Menu & Rincian Pesanan (Varian, Topping, Catatan)', width: 95, align: 'left' },
        { name: 'Kategori', width: 30, align: 'left' },
        { name: 'Qty Terjual', width: 18, align: 'right' },
        { name: 'Total Omset', width: 30, align: 'right' },
        { name: 'Total HPP', width: 28, align: 'right' },
        { name: 'Laba Kotor', width: 30, align: 'right' },
        { name: 'Margin', width: 28, align: 'right' },
      ]
    : [
        { name: 'No', width: 12, align: 'center' },
        { name: 'Nama Menu & Rincian Pesanan (Varian, Topping, Catatan)', width: 125, align: 'left' },
        { name: 'Kategori', width: 38, align: 'left' },
        { name: 'Terjual (Qty)', width: 24, align: 'right' },
        { name: 'Total Omset', width: 40, align: 'right' },
        { name: 'Kontribusi Omset (%)', width: 30, align: 'right' },
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

  // Render Baris-baris Data Item dengan Pola Sub-Row Paritas Rinci
  items.forEach((it, index) => {
    // Siapkan teks rincian
    const prodName = it.productName || it.name || 'Produk';
    const variantPart = it.variantName ? `[Varian: ${it.variantName}]` : '';
    
    let modPart = '';
    if (it.modifiers && it.modifiers.length > 0) {
      const modItems = it.modifiers.map((m) =>
        m.priceDelta && m.priceDelta > 0
          ? `${m.name} (+Rp ${Math.round(m.priceDelta).toLocaleString('id-ID')})`
          : m.name
      );
      modPart = `+ Topping: ${modItems.join(', ')}`;
    }

    const subDetailParts: string[] = [];
    if (variantPart) subDetailParts.push(variantPart);
    if (modPart) subDetailParts.push(modPart);
    const subDetailText = subDetailParts.join('  •  ');

    const notesText = it.notes ? `* Catatan: ${it.notes}` : '';
    const hasSubDetail = Boolean(subDetailText);
    const hasNotes = Boolean(notesText);

    // Hitung tinggi baris dinamis
    let rowHeight = 7;
    if (hasSubDetail && hasNotes) {
      rowHeight = 14;
    } else if (hasSubDetail || hasNotes) {
      rowHeight = 10.5;
    }

    // Auto-Pagination jika baris melebihi batas bawah halaman
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

    // Garis batas bawah per baris agar sangat rapi
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.3);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

    const primaryRowY = y + 4.8;
    let curX = margin;

    // 1. No
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(String(index + 1), curX + cols[0].width / 2, primaryRowY, { align: 'center' });
    curX += cols[0].width;

    // 2. Nama Menu & Rincian Pesanan
    const nameColWidth = cols[1].width - 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(23, 37, 84); // blue-950

    // Tambahkan label split jika item dialokasikan pro-rata
    const titleWithSplit = it.hasSplitAllocation ? `${prodName}  [Pro-Rata Split]` : prodName;
    const splitTitle = doc.splitTextToSize(titleWithSplit, nameColWidth);
    doc.text(splitTitle[0] || prodName, curX + 2.5, primaryRowY);

    let nextLineY = primaryRowY + 3.8;

    // Sub-baris Varian & Modifier
    if (hasSubDetail) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105); // slate-600
      const splitDetail = doc.splitTextToSize(subDetailText, nameColWidth);
      doc.text(splitDetail[0] || subDetailText, curX + 2.5, nextLineY);
      nextLineY += 3.4;
    }

    // Sub-baris Catatan Khusus
    if (hasNotes) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(180, 83, 9); // amber-700
      const splitNotes = doc.splitTextToSize(notesText, nameColWidth);
      doc.text(splitNotes[0] || notesText, curX + 2.5, nextLineY);
    }

    curX += cols[1].width;

    // 3. Kategori
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const cat = it.category || 'Umum';
    const splitCat = doc.splitTextToSize(cat, cols[2].width - 4);
    doc.text(splitCat[0] || cat, curX + 2.5, primaryRowY);
    curX += cols[2].width;

    // 4. Qty Terjual
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138); // blue-900
    const qtyStr = it.quantity % 1 === 0 ? String(it.quantity) : it.quantity.toFixed(1);
    doc.text(qtyStr, curX + cols[3].width - 2.5, primaryRowY, { align: 'right' });
    curX += cols[3].width;

    // 5. Total Omset
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(23, 37, 84);
    const omsetStr = `Rp ${Math.round(it.revenue).toLocaleString('id-ID')}`;
    doc.text(omsetStr, curX + cols[4].width - 2.5, primaryRowY, { align: 'right' });
    curX += cols[4].width;

    if (includeCostAndProfit) {
      // 6. Total HPP
      const costVal = Math.round(it.cost || 0);
      doc.text(`Rp ${costVal.toLocaleString('id-ID')}`, curX + cols[5].width - 2.5, primaryRowY, { align: 'right' });
      curX += cols[5].width;

      // 7. Laba Kotor
      const profitVal = Math.round(it.revenue - (it.cost || 0));
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129); // emerald-600
      doc.text(`Rp ${profitVal.toLocaleString('id-ID')}`, curX + cols[6].width - 2.5, primaryRowY, { align: 'right' });
      curX += cols[6].width;

      // 8. Margin %
      const marginPct = it.revenue > 0 ? `${(((it.revenue - (it.cost || 0)) / it.revenue) * 100).toFixed(1)}%` : '0.0%';
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(marginPct, curX + cols[7].width - 2.5, primaryRowY, { align: 'right' });
    } else {
      // 6. Kontribusi Omset (%)
      const pct = totalRevenue > 0 ? `${((it.revenue / totalRevenue) * 100).toFixed(1)}%` : '0.0%';
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(pct, curX + cols[5].width - 2.5, primaryRowY, { align: 'right' });
    }

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
  doc.text('TOTAL REKAPITULASI OMSET METODE:', margin + 40, y);
  doc.text(
    `${totalQty % 1 === 0 ? totalQty : totalQty.toFixed(1)} Porsi / Pcs   |   Rp ${Math.round(totalRevenue).toLocaleString('id-ID')}`,
    pageWidth - margin - 2.5,
    y,
    { align: 'right' }
  );

  // Unduh Berkas PDF Landscape
  const safeMethod = methodLabel.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Rekap_Item_${safeMethod}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
};
