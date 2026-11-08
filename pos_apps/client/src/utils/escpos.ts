/**
 * ESC/POS Command Generator for Direct Thermal Receipt Printing
 * Compatible with 58mm (32 cols) and 80mm (48 cols) Bluetooth thermal printers
 * (Epson, Panda, Goojprt, Iware, MPT-II, RPP02N, Xprinter, etc.)
 */

export interface EscPosOptions {
  paperSize?: '58mm' | '80mm';
  showQueueNumber?: boolean;
  showWatermark?: boolean;
  footerText?: string;
}

export class EscPosBuilder {
  private buffer: number[] = [];
  private cols: number;

  constructor(paperSize: '58mm' | '80mm' = '58mm') {
    this.cols = paperSize === '58mm' ? 32 : 48;
    this.init();
  }

  /** ESC @ : Inisialisasi printer */
  init(): this {
    this.buffer.push(0x1b, 0x40);
    return this;
  }

  /** ESC a n : Perataan teks (0 = Kiri, 1 = Tengah, 2 = Kanan) */
  align(alignment: 'left' | 'center' | 'right'): this {
    const val = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.buffer.push(0x1b, 0x61, val);
    return this;
  }

  /** ESC E n : Huruf tebal / bold */
  bold(enable: boolean = true): this {
    this.buffer.push(0x1b, 0x45, enable ? 1 : 0);
    return this;
  }

  /** GS ! n : Ukuran font (normal vs double height/width) */
  size(size: 'normal' | 'double' | 'large'): this {
    if (size === 'double') {
      this.buffer.push(0x1d, 0x21, 0x11); // Double width & double height
    } else if (size === 'large') {
      this.buffer.push(0x1d, 0x21, 0x22); // Triple
    } else {
      this.buffer.push(0x1d, 0x21, 0x00); // Normal
    }
    return this;
  }

  /** Text biasa + newline */
  text(str: string): this {
    const bytes = new TextEncoder().encode(str);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
    return this;
  }

  line(str: string = ''): this {
    this.text(str);
    this.buffer.push(0x0a);
    return this;
  }

  feed(lines: number = 1): this {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  /** Garis pemisah putus-putus atau solid */
  divider(char: string = '-'): this {
    this.line(char.repeat(this.cols));
    return this;
  }

  /** Format 2 kolom: Kiri & Kanan (contoh: "Kopi Susu x2       44.000") */
  twoColumns(left: string, right: string): this {
    const maxLeftLen = this.cols - right.length - 1;
    let safeLeft = left;
    if (safeLeft.length > maxLeftLen) {
      safeLeft = safeLeft.substring(0, maxLeftLen);
    }
    const spaceCount = Math.max(1, this.cols - safeLeft.length - right.length);
    this.line(safeLeft + ' '.repeat(spaceCount) + right);
    return this;
  }

  /** ESC p : Sinyal pemicu laci kasir (Cash Drawer Kick) */
  kickDrawer(): this {
    this.buffer.push(0x1b, 0x70, 0x00, 0x19, 0xfa);
    return this;
  }

  /** GS V : Potong kertas (Cut paper) jika printer mendukung cutter */
  cut(): this {
    this.feed(3);
    this.buffer.push(0x1d, 0x56, 0x41, 0x03);
    return this;
  }

  /** Mengembalikan buffer mentah Uint8Array */
  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Helper untuk menyusun struk transaksi belanja POS lengkap dalam format ESC/POS
 */
export function buildReceiptEscPos(order: any, options: EscPosOptions = {}): Uint8Array {
  const paperSize = options.paperSize || '58mm';
  const builder = new EscPosBuilder(paperSize);

  // 1. Header Toko
  builder.align('center');
  builder.bold(true).size('double').line(order.outlet?.name || 'WELL POS TOKO');
  builder.bold(false).size('normal');
  if (order.outlet?.address) {
    builder.line(order.outlet.address);
  }
  if (order.outlet?.phone) {
    builder.line(`Telp: ${order.outlet.phone}`);
  }

  builder.divider('-');

  // 2. Nomor Antrean (Jika ada)
  if (options.showQueueNumber !== false && order.queueNumber !== undefined && order.queueNumber !== null) {
    builder.bold(true).line(`NO. ANTREAN: #${String(order.queueNumber).padStart(2, '0')}`);
    builder.bold(false);
    builder.divider('-');
  }

  // 3. Info Transaksi
  builder.align('left');
  builder.twoColumns('No. Faktur:', `#${order.invoiceNumber || '-'}`);
  const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleString('id-ID') : new Date().toLocaleString('id-ID');
  builder.twoColumns('Waktu:', dateStr);
  if (order.user?.name || order.cashierName) {
    builder.twoColumns('Kasir:', order.user?.name || order.cashierName);
  }
  if (order.tableNumber) {
    builder.twoColumns('Meja:', String(order.tableNumber));
  }
  if (order.customer?.name || order.customerName) {
    builder.twoColumns('Pelanggan:', order.customer?.name || order.customerName);
  }

  builder.divider('-');

  // 4. Daftar Item Pesanan
  const items = order.orderItems || order.items || [];
  for (const it of items) {
    const rawName = it.product?.name || it.productName || it.name || 'Produk';
    const variantName = it.variantName || it.variant?.name;
    const hasVariant = Boolean(variantName && variantName !== 'Default' && variantName !== 'Standar');
    const pName = hasVariant ? `${rawName} (${variantName})` : rawName;
    const qty = it.quantity || 1;
    const rawPriceEach = Number(it.unitPrice ?? it.price ?? 0);
    const subtotal = Number(it.subtotal ?? (rawPriceEach > 0 ? rawPriceEach * qty : 0));
    const itemDisc = Number(it.discountAmount || 0);

    // Modifiers / Pilihan Tambahan
    const mods = it.modifiers || it.modifiersSnapshot || it.selectedModifiers || [];
    let totalModPerUnit = 0;
    if (Array.isArray(mods) && mods.length > 0) {
      for (const m of mods) {
        if (m?.option?.priceDelta) totalModPerUnit += Number(m.option.priceDelta);
        else if (m?.priceAdjustment || m?.price_adjustment) totalModPerUnit += Number(m.priceAdjustment || m.price_adjustment);
      }
    }
    const basePriceEach = Math.max(0, rawPriceEach - totalModPerUnit);

    builder.bold(true).twoColumns(`${pName}`, `Rp ${subtotal.toLocaleString('id-ID')}`);
    builder.bold(false);

    // Keterangan harga satuan dasar
    if (basePriceEach > 0) {
      builder.line(`  ${qty} x Rp ${basePriceEach.toLocaleString('id-ID')}`);
    }

    if (Array.isArray(mods) && mods.length > 0) {
      for (const m of mods) {
        let modName = '';
        let modPrice = 0;
        let groupLabel = '';

        if (typeof m === 'string') {
          modName = m;
        } else if (m?.option) {
          modName = m.option.name;
          modPrice = Number(m.option.priceDelta || 0);
          if (m.modifierGroup?.name) {
            groupLabel = `[${m.modifierGroup.name}] `;
          }
        } else if (m?.name) {
          modName = m.name;
          modPrice = Number(m.priceAdjustment || m.price_adjustment || 0);
          const gName = m.group_name || m.groupName || m.slotName || m.slot_name;
          if (gName) {
            groupLabel = `[${gName}] `;
          }
        }
        if (modName) {
          const priceTag = modPrice > 0 ? (qty > 1 ? ` (+Rp ${(modPrice * qty).toLocaleString('id-ID')})` : ` (+Rp ${modPrice.toLocaleString('id-ID')})`) : '';
          builder.line(`  + ${groupLabel}${modName}${priceTag}`);
        }
      }
    }

    if (itemDisc > 0) {
      const discPercent = (basePriceEach || rawPriceEach) > 0 ? Math.round((itemDisc / (basePriceEach || rawPriceEach)) * 100) : 0;
      const percentTag = discPercent > 0 ? ` (${discPercent}%)` : '';
      builder.line(`  Diskon Item${percentTag}: -Rp ${(itemDisc * qty).toLocaleString('id-ID')}`);
    }

    const itemNote = it.notes || it.itemNote;
    if (itemNote) {
      builder.line(`  Catatan: ${itemNote}`);
    }
  }

  builder.divider('-');

  // 5. Rincian Finansial (Subtotal, Diskon, Pajak, Total)
  builder.twoColumns('Subtotal:', `Rp ${Number(order.subtotal || 0).toLocaleString('id-ID')}`);

  if (Number(order.discountAmount || 0) > 0) {
    builder.twoColumns('Diskon:', `-Rp ${Number(order.discountAmount).toLocaleString('id-ID')}`);
  }

  if (Number(order.taxAmount || 0) > 0) {
    builder.twoColumns('Pajak (PB1/PPN):', `+Rp ${Number(order.taxAmount).toLocaleString('id-ID')}`);
  }

  if (Number(order.serviceCharge || 0) > 0) {
    builder.twoColumns('Biaya Layanan:', `+Rp ${Number(order.serviceCharge).toLocaleString('id-ID')}`);
  }

  builder.bold(true).size('double');
  builder.twoColumns('TOTAL:', `Rp ${Number(order.grandTotal || 0).toLocaleString('id-ID')}`);
  builder.bold(false).size('normal');

  builder.divider('-');

  // 6. Metode Pembayaran
  const payments = order.payments || [];
  if (payments.length > 0) {
    for (const p of payments) {
      const method = p.method || p.paymentMethod || 'CASH';
      const paid = Number(p.amountPaid ?? p.amount ?? order.grandTotal ?? 0);
      const change = Number(p.changeGiven ?? p.cashChange ?? 0);

      builder.twoColumns(`Bayar (${method}):`, `Rp ${paid.toLocaleString('id-ID')}`);
      if (method === 'CASH' && change > 0) {
        builder.twoColumns('Kembalian:', `Rp ${change.toLocaleString('id-ID')}`);
      }
      if (p.qrisReference) {
        builder.line(`Ref QRIS: ${p.qrisReference}`);
      }
    }
  } else {
    builder.twoColumns('Pembayaran:', 'LUNAS');
  }

  // 7. Footer Struk
  builder.divider('-');
  builder.align('center');
  const footer = options.footerText || 'Terima kasih atas kunjungan Anda!\nFollow Instagram kami: @wellpos.id';
  const footerLines = footer.split('\n');
  for (const fLine of footerLines) {
    if (fLine.trim()) {
      builder.line(fLine.trim());
    }
  }
  if (options.showWatermark !== false) {
    builder.line('Powered by Well POS');
  }

  // Berikan spasi kosong & potong
  builder.feed(4);
  builder.cut();

  return builder.toUint8Array();
}

/**
 * Struk uji coba thermal singkat
 */
export function buildTestPrintEscPos(paperSize: '58mm' | '80mm' = '58mm', deviceLabel: string = 'Hardware'): Uint8Array {
  const builder = new EscPosBuilder(paperSize);
  builder.align('center');
  builder.bold(true).size('double').line('WELL POS');
  builder.bold(false).size('normal');
  builder.line('Sistem Kasir & Stok Modern');
  builder.divider('=');
  builder.bold(true).line('TEST PRINT THERMAL OK!');
  builder.bold(false);
  builder.line(`Perangkat: ${deviceLabel}`);
  builder.line(`Format Kertas: ${paperSize}`);
  builder.line(new Date().toLocaleString('id-ID'));
  builder.divider('-');
  builder.line('Printer thermal terhubung');
  builder.line('dan siap digunakan untuk kasir.');
  builder.feed(4);
  builder.cut();
  return builder.toUint8Array();
}

/**
 * Slip Rekapitulasi Murni X-Report (Laporan Berjalan) & Z-Report (Tutup Shift)
 * Murni ringkasan finansial kas & omzet TANPA rincian daftar transaksi per nota (Kebijakan Rule 13).
 */
export function buildXZReportEscPos(
  reportData: any,
  type: 'X' | 'Z',
  options: EscPosOptions = {}
): Uint8Array {
  const paperSize = options.paperSize || '58mm';
  const builder = new EscPosBuilder(paperSize);

  const outletName = typeof reportData.outlet === 'string'
    ? reportData.outlet
    : reportData.outlet?.name || 'WELL POS OUTLET';
  const outletAddr = typeof reportData.outlet === 'object' ? reportData.outlet?.address : '';

  // 1. Header
  builder.align('center');
  builder.bold(true).size('double').line(outletName);
  builder.bold(false).size('normal');
  if (outletAddr) {
    builder.line(outletAddr);
  }
  builder.divider('=');

  // 2. Judul Laporan
  builder.bold(true);
  if (type === 'X') {
    builder.line('*** LAPORAN BERJALAN (X-REPORT) ***');
    builder.line('STATUS: SHIFT SEDANG BERJALAN');
  } else {
    builder.line('*** LAPORAN TUTUP SHIFT (Z-REPORT) ***');
    builder.line('STATUS: SHIFT RESMI DITUTUP');
  }
  builder.bold(false);
  builder.divider('-');

  // 3. Info Shift & Kasir
  builder.align('left');
  builder.twoColumns('Kasir:', reportData.cashier || '-');
  if (reportData.shiftId) {
    builder.twoColumns('ID Shift:', `#${String(reportData.shiftId).slice(0, 8)}`);
  }
  if (reportData.startTime) {
    const startStr = new Date(reportData.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    builder.twoColumns('Waktu Buka:', startStr);
  }
  if (type === 'Z' && reportData.endTime) {
    const endStr = new Date(reportData.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    builder.twoColumns('Waktu Tutup:', endStr);
  } else if (reportData.generatedAt) {
    const genStr = new Date(reportData.generatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    builder.twoColumns('Dicetak:', genStr);
  }

  builder.divider('-');

  // 4. POSISI UANG KAS DI LACI (CASH DRAWER RECONCILIATION)
  builder.bold(true).line('POSISI UANG KAS LACI:');
  builder.bold(false);

  const startingCash = Number(reportData.cashDrawer?.startingCash || 0);
  const cashSales = Number(reportData.cashDrawer?.totalCashSales ?? reportData.cashDrawer?.cashSales ?? 0);
  const debtCashIn = Number(reportData.totalDebtCashIn ?? reportData.cashDrawer?.totalDebtCashIn ?? 0);
  const totalCashIn = Number(reportData.cashDrawer?.totalCashIn || 0);
  const totalCashOut = Number(reportData.cashDrawer?.totalCashOut || 0);
  const expectedCash = Number(reportData.cashDrawer?.expectedCash ?? reportData.cashDrawer?.expectedCashInDrawer ?? 0);

  builder.twoColumns('  Modal Awal (Cash):', `Rp ${startingCash.toLocaleString('id-ID')}`);
  builder.twoColumns('  + Penjualan Tunai:', `Rp ${cashSales.toLocaleString('id-ID')}`);
  if (debtCashIn > 0) {
    builder.twoColumns('  + Pelunasan Kasbon:', `Rp ${debtCashIn.toLocaleString('id-ID')}`);
  }
  if (totalCashIn > 0) {
    builder.twoColumns('  + Kas Masuk (In):', `Rp ${totalCashIn.toLocaleString('id-ID')}`);
  }
  if (totalCashOut > 0) {
    builder.twoColumns('  - Kas Keluar (Out):', `Rp ${totalCashOut.toLocaleString('id-ID')}`);
  }
  builder.divider('-');
  builder.bold(true).twoColumns('Total Kas Sistem:', `Rp ${expectedCash.toLocaleString('id-ID')}`);
  builder.bold(false);

  // Jika Z-Report: tampilkan uang fisik & selisih kas
  if (type === 'Z' && reportData.cashDrawer?.actualCash !== undefined) {
    const actualCash = Number(reportData.cashDrawer.actualCash || 0);
    const diff = Number(reportData.cashDrawer.difference || 0);
    const diffSign = diff > 0 ? '+' : '';

    builder.twoColumns('Kas Fisik Aktual:', `Rp ${actualCash.toLocaleString('id-ID')}`);
    builder.bold(true);
    if (diff === 0) {
      builder.twoColumns('Status Selisih:', 'SEIMBANG (Rp 0)');
    } else if (diff > 0) {
      builder.twoColumns('Selisih Kas (+):', `${diffSign}Rp ${diff.toLocaleString('id-ID')} (LEBIH)`);
    } else {
      builder.twoColumns('Selisih Kas (-):', `Rp ${diff.toLocaleString('id-ID')} (KURANG)`);
    }
    builder.bold(false);
  }

  builder.divider('-');

  // 5. REKAPITULASI OMSET & METODE PEMBAYARAN
  builder.bold(true).line('RINGKASAN OMSET & METODE:');
  builder.bold(false);

  const qrisSales = Number(
    reportData.nonCashSummary?.totalQrisSales ??
    reportData.paymentSummary?.qrisSales ??
    0
  );
  const totalRevenue = Number(
    reportData.nonCashSummary?.totalRevenue ??
    reportData.paymentSummary?.netRevenue ??
    (cashSales + qrisSales)
  );

  builder.twoColumns('  Tunai (Cash):', `Rp ${cashSales.toLocaleString('id-ID')}`);
  builder.twoColumns('  Non-Tunai / QRIS:', `Rp ${qrisSales.toLocaleString('id-ID')}`);
  builder.divider('-');
  builder.bold(true).twoColumns('TOTAL OMSET (NET):', `Rp ${totalRevenue.toLocaleString('id-ID')}`);
  builder.bold(false);

  // 6. STATISTIK PENJUALAN
  const totalTx = Number(
    reportData.totalTransactions ??
    reportData.transactionSummary?.totalOrders ??
    0
  );
  if (totalTx > 0) {
    builder.divider('-');
    builder.twoColumns('Jumlah Transaksi:', `${totalTx} Nota`);
    const avgTicket = Math.round(totalRevenue / totalTx);
    builder.twoColumns('Rata-rata per Nota:', `Rp ${avgTicket.toLocaleString('id-ID')}`);
  }

  // 7. Kolom Pengesahan Tanda Tangan
  builder.divider('-');
  builder.align('center');
  builder.line('LEMBAR PENGESAHAN:');
  builder.feed(1);
  builder.twoColumns('Kasir Bertugas,', 'Supervisor/Owner,');
  builder.feed(3);
  builder.twoColumns('(...............)', '(...............)');

  // 8. Footer Watermark
  builder.feed(1);
  builder.line('Well POS - Pure Financial Slip');
  builder.feed(4);
  builder.cut();

  return builder.toUint8Array();
}
