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
    const priceEach = Number(it.unitPrice ?? it.price ?? 0);
    const subtotal = Number(it.subtotal ?? (priceEach > 0 ? priceEach * qty : 0));

    builder.bold(true).twoColumns(`${pName} x${qty}`, `Rp ${subtotal.toLocaleString('id-ID')}`);
    builder.bold(false);

    // Keterangan harga satuan jika qty > 1
    if (qty > 1 && priceEach > 0) {
      builder.line(`  @ Rp ${priceEach.toLocaleString('id-ID')}`);
    }

    // Modifiers / Pilihan Tambahan
    const mods = it.modifiers || it.modifiersSnapshot || it.selectedModifiers || [];
    if (Array.isArray(mods) && mods.length > 0) {
      for (const m of mods) {
        let modName = '';
        let modPrice = 0;
        if (typeof m === 'string') {
          modName = m;
        } else if (m?.option) {
          modName = m.option.name;
          modPrice = Number(m.option.priceDelta || 0);
        } else if (m?.name) {
          modName = m.name;
          modPrice = Number(m.priceAdjustment || m.price_adjustment || 0);
        }
        if (modName) {
          const priceTag = modPrice > 0 ? ` (+Rp ${modPrice.toLocaleString('id-ID')})` : '';
          builder.line(`  + ${modName}${priceTag}`);
        }
      }
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
export function buildTestPrintEscPos(paperSize: '58mm' | '80mm' = '58mm'): Uint8Array {
  const builder = new EscPosBuilder(paperSize);
  builder.align('center');
  builder.bold(true).size('double').line('WELL POS');
  builder.bold(false).size('normal');
  builder.line('Sistem Kasir & Stok Modern');
  builder.divider('=');
  builder.bold(true).line('TEST PRINT THERMAL OK!');
  builder.bold(false);
  builder.line(`Format: ${paperSize}`);
  builder.line(new Date().toLocaleString('id-ID'));
  builder.divider('-');
  builder.line('Printer Bluetooth terhubung');
  builder.line('dan siap digunakan untuk kasir.');
  builder.feed(4);
  builder.cut();
  return builder.toUint8Array();
}
