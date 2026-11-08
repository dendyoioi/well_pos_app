/**
 * Cup Label / Sticker Thermal Generator for F&B Coffee Shops & Restaurants
 * Supports TSPL (TSC Printer Language) and ESC/POS Label mode for:
 * Xprinter (XP-237B, XP-365B, XP-420B), Panda Label, HPRT, Iware, Blueprint.
 * Standard label sizes: 40x30mm, 50x30mm, 40x20mm, 50x40mm.
 */

export interface CupItemDetail {
  cupNumber: number;
  totalCupsInOrder: number;
  productName: string;
  variantName?: string;
  modifiers: string[];
  notes?: string;
  customerName?: string;
  tableNumber?: string | number;
  orderChannel?: string;
  queueNumber?: number;
  invoiceNumber?: string;
  timeStr: string;
}

const BEVERAGE_KEYWORDS = [
  'kopi', 'coffee', 'latte', 'espresso', 'cappuccino', 'americano', 'tea', 'teh',
  'susu', 'milk', 'drink', 'beverage', 'jus', 'juice', 'matcha', 'boba', 'mojito',
  'ice', 'es ', 'shake', 'frappe', 'smoothie', 'choco', 'cokelat', 'syrup', 'sirup',
  'taro', 'red velvet', 'mocktail', 'brew', 'macchiato'
];

/**
 * Filter and expand order items into individual cup/portion units
 */
export function getCupItemsFromOrder(order: any, onlyBeverages: boolean = true): CupItemDetail[] {
  const items = order.orderItems || order.items || [];
  const rawCups: Array<{ item: any; pName: string; vName?: string; mods: string[]; notes?: string }> = [];

  const timeStr = order.createdAt
    ? new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  for (const it of items) {
    const rawName = it.product?.name || it.productName || it.name || 'Minuman';
    const variantName = it.variantName || it.variant?.name;
    const catName = it.product?.category?.name || '';
    const isBeverage =
      BEVERAGE_KEYWORDS.some((kw) => rawName.toLowerCase().includes(kw)) ||
      BEVERAGE_KEYWORDS.some((kw) => catName.toLowerCase().includes(kw));

    if (onlyBeverages && !isBeverage) {
      continue;
    }

    const mods: string[] = [];
    const rawMods = it.modifiers || it.modifiersSnapshot || it.selectedModifiers || [];
    if (Array.isArray(rawMods)) {
      for (const m of rawMods) {
        if (typeof m === 'string') {
          mods.push(m);
        } else if (m?.option?.name) {
          const delta = Number(m.option.priceDelta || 0);
          mods.push(delta > 0 ? `${m.option.name} (+Rp ${delta.toLocaleString('id-ID')})` : m.option.name);
        } else if (m?.name) {
          const delta = Number(m.priceAdjustment || m.price_adjustment || 0);
          const gName = m.group_name || m.groupName || m.slotName || m.slot_name;
          const prefix = gName ? `[${gName}] ` : '';
          mods.push(delta > 0 ? `${prefix}${m.name} (+Rp ${delta.toLocaleString('id-ID')})` : `${prefix}${m.name}`);
        }
      }
    }

    const qty = Math.max(1, it.quantity || 1);
    for (let q = 0; q < qty; q++) {
      rawCups.push({
        item: it,
        pName: rawName,
        vName: variantName && variantName !== 'Default' && variantName !== 'Standar' ? variantName : undefined,
        mods,
        notes: it.notes || it.itemNote,
      });
    }
  }

  const totalCupsInOrder = rawCups.length;
  return rawCups.map((c, idx) => ({
    cupNumber: idx + 1,
    totalCupsInOrder,
    productName: c.pName,
    variantName: c.vName,
    modifiers: c.mods,
    notes: c.notes,
    customerName: order.customer?.name || order.customerName,
    tableNumber: order.tableNumber,
    orderChannel: order.orderChannel,
    queueNumber: order.queueNumber,
    invoiceNumber: order.invoiceNumber,
    timeStr,
  }));
}

/**
 * Generate TSPL (TSC Printer Language) for single or multiple cup labels.
 * Compatible with Xprinter, Panda, HPRT, Iware label thermal printers.
 */
export function buildCupLabelsTspl(
  cups: CupItemDetail[],
  options: {
    paperSize?: '40x30mm' | '50x30mm' | '40x20mm' | '50x40mm';
    outletName?: string;
  } = {}
): Uint8Array {
  const paperSize = options.paperSize || '40x30mm';
  const [wStr, hStr] = paperSize.replace('mm', '').split('x');
  const widthMm = Number(wStr) || 40;
  const heightMm = Number(hStr) || 30;

  const tsplCommands: string[] = [];

  for (const cup of cups) {
    tsplCommands.push(`SIZE ${widthMm} mm, ${heightMm} mm`);
    tsplCommands.push(`GAP 2 mm, 0`);
    tsplCommands.push(`DIRECTION 1`);
    tsplCommands.push(`CLS`);

    let y = 14;

    // 1. Header: Channel & Meja / Antrean
    const channelTag = cup.orderChannel === 'DINE_IN' ? '[Dine In]' : cup.orderChannel === 'TAKEAWAY' ? '[Takeaway]' : '[Order]';
    const tableTag = cup.tableNumber ? `Meja ${cup.tableNumber}` : '';
    const queueTag = cup.queueNumber !== undefined && cup.queueNumber !== null ? `#${String(cup.queueNumber).padStart(2, '0')}` : '';
    const headerLine = [channelTag, tableTag, queueTag].filter(Boolean).join(' ');
    tsplCommands.push(`TEXT 14,${y},"2",0,1,1,"${escapeTspl(headerLine)}"`);
    y += 26;

    // 2. Product Name (Bold / Font 3)
    const pName = cup.productName.toUpperCase();
    tsplCommands.push(`TEXT 14,${y},"3",0,1,1,"${escapeTspl(pName)}"`);
    y += 30;

    // 3. Variant (if any)
    if (cup.variantName) {
      tsplCommands.push(`TEXT 14,${y},"2",0,1,1,"* ${escapeTspl(cup.variantName)}"`);
      y += 22;
    }

    // 4. Modifiers (Up to 3 lines on small sticker)
    if (cup.modifiers && cup.modifiers.length > 0) {
      for (const m of cup.modifiers.slice(0, 3)) {
        tsplCommands.push(`TEXT 14,${y},"1",0,1,1,"- ${escapeTspl(m)}"`);
        y += 18;
      }
    }

    // 5. Notes (if any)
    if (cup.notes) {
      tsplCommands.push(`TEXT 14,${y},"1",0,1,1,"Note: ${escapeTspl(cup.notes)}"`);
      y += 18;
    }

    // 6. Footer Line: Cup [1/3] • Nama Pelanggan • Waktu
    const custTag = cup.customerName ? ` • ${cup.customerName}` : '';
    const footerText = `Cup [${cup.cupNumber}/${cup.totalCupsInOrder}]${custTag} • ${cup.timeStr}`;
    const footerY = Math.max(y + 8, heightMm * 8 - 32); // Posisi dekat dasar stiker (8 dots/mm)
    tsplCommands.push(`TEXT 14,${footerY},"1",0,1,1,"${escapeTspl(footerText)}"`);

    tsplCommands.push(`PRINT 1,1`);
  }

  const fullScript = tsplCommands.join('\r\n') + '\r\n';
  return new TextEncoder().encode(fullScript);
}

function escapeTspl(str: string): string {
  return str.replace(/"/g, "'").replace(/[\r\n]+/g, ' ');
}

/**
 * Generate ESC/POS format for hybrid receipt/label printers (Goojprt, Panda mini)
 */
export function buildCupLabelsEscPos(
  cups: CupItemDetail[],
  _options: {
    paperSize?: '40x30mm' | '50x30mm' | '40x20mm' | '50x40mm';
    outletName?: string;
  } = {}
): Uint8Array {
  const buffer: number[] = [];

  const text = (str: string) => {
    const bytes = new TextEncoder().encode(str);
    for (let i = 0; i < bytes.length; i++) buffer.push(bytes[i]);
  };
  const line = (str: string = '') => {
    text(str);
    buffer.push(0x0a);
  };

  for (const cup of cups) {
    // ESC @ : Init
    buffer.push(0x1b, 0x40);

    // Header
    const channelTag = cup.orderChannel === 'DINE_IN' ? '[Dine In]' : '[Takeaway]';
    const tableTag = cup.tableNumber ? `Meja ${cup.tableNumber}` : '';
    const queueTag = cup.queueNumber !== undefined && cup.queueNumber !== null ? `#${String(cup.queueNumber).padStart(2, '0')}` : '';
    line([channelTag, tableTag, queueTag].filter(Boolean).join(' '));

    // Divider
    line('--------------------------------');

    // Product Name (Bold)
    buffer.push(0x1b, 0x45, 0x01); // Bold ON
    line(cup.productName.toUpperCase());
    buffer.push(0x1b, 0x45, 0x00); // Bold OFF

    if (cup.variantName) {
      line(`* ${cup.variantName}`);
    }

    if (cup.modifiers && cup.modifiers.length > 0) {
      for (const m of cup.modifiers) {
        line(`- ${m}`);
      }
    }

    if (cup.notes) {
      line(`Catatan: ${cup.notes}`);
    }

    line('--------------------------------');
    const custTag = cup.customerName ? ` • ${cup.customerName}` : '';
    line(`Cup [${cup.cupNumber}/${cup.totalCupsInOrder}]${custTag} • ${cup.timeStr}`);

    // Feed and label cut
    buffer.push(0x0a, 0x0a);
    buffer.push(0x1d, 0x56, 0x41, 0x02); // Cut
  }

  return new Uint8Array(buffer);
}

/**
 * Uji coba stiker label cup
 */
export function buildTestCupLabelTspl(paperSize: '40x30mm' | '50x30mm' = '40x30mm'): Uint8Array {
  const dummyCup: CupItemDetail = {
    cupNumber: 1,
    totalCupsInOrder: 1,
    productName: 'Kopi Susu Aren (Test)',
    variantName: 'Regular (Less Ice)',
    modifiers: ['Less Sugar 50%', 'Oatmilk (+Rp 5.000)'],
    notes: 'Uji Coba Printer Label OK',
    customerName: 'Barista Test',
    tableNumber: '02',
    orderChannel: 'DINE_IN',
    queueNumber: 7,
    timeStr: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  };

  return buildCupLabelsTspl([dummyCup], { paperSize });
}
