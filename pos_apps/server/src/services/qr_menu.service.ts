import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../config/prisma';

export interface QrTable {
  id: string;
  tenantId: string;
  outletId: string;
  tableNumber: string;
  name: string;
  section: string;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
  qrSlug: string;
  createdAt: string;
  updatedAt: string;
}

export interface QrMenuSettings {
  tenantId: string;
  outletId: string;
  selfOrderingEnabled: boolean;
  welcomeTitle: string;
  welcomeSubtitle: string;
  wifiEnabled?: boolean;
  wifiName?: string;
  wifiPassword?: string;
  paymentPolicy: 'PAY_AT_CASHIER';
  showEstimatedTime: boolean;
  estimatedPrepMinutes: number;
  bannerUrl?: string;
  updatedAt: string;
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const TABLES_FILE = path.join(DATA_DIR, 'qr_menu_tables.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'qr_menu_settings.json');

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(TABLES_FILE)) {
    fs.writeFileSync(TABLES_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function readTables(): QrTable[] {
  ensureDataFiles();
  try {
    const raw = fs.readFileSync(TABLES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading qr_menu_tables.json:', err);
    return [];
  }
}

function writeTables(tables: QrTable[]): void {
  ensureDataFiles();
  fs.writeFileSync(TABLES_FILE, JSON.stringify(tables, null, 2), 'utf-8');
}

function readSettings(): QrMenuSettings[] {
  ensureDataFiles();
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading qr_menu_settings.json:', err);
    return [];
  }
}

function writeSettings(settings: QrMenuSettings[]): void {
  ensureDataFiles();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

export const qrMenuService = {
  /**
   * Mengambil daftar meja per tenant & outlet.
   * Jika belum ada data, otomatis men-seed 5 meja awal untuk kemudahan merchant.
   */
  async getTables(tenantId: string, outletId?: string | null): Promise<QrTable[]> {
    let all = readTables();
    let filtered = all.filter((t) => t.tenantId === tenantId && (!outletId || t.outletId === outletId));


    // Sinkronisasi status meja secara real-time dengan pesanan aktif yang belum dibayar di database
    if (outletId && filtered.length > 0) {
      try {
        const activeOccupied = await prisma.$queryRawUnsafe<any[]>(
          `SELECT DISTINCT table_number 
           FROM "orders" 
           WHERE tenant_id = $1 AND outlet_id = $2 
             AND payment_status = 'UNPAID' 
             AND order_status NOT IN ('CANCELLED', 'VOIDED', 'COMPLETED');`,
          tenantId,
          outletId
        );
        const occupiedTableNumbers = new Set(
          activeOccupied.map((r) => (r.table_number || '').replace(/^Meja\s*/i, '').trim().toLowerCase())
        );

        let hasChanges = false;
        for (const t of filtered) {
          const cleanTbl = t.tableNumber.replace(/^Meja\s*/i, '').trim().toLowerCase();
          const shouldBeOccupied = occupiedTableNumbers.has(cleanTbl);
          if (shouldBeOccupied && t.status === 'AVAILABLE') {
            t.status = 'OCCUPIED';
            t.updatedAt = new Date().toISOString();
            hasChanges = true;
          } else if (!shouldBeOccupied && t.status === 'OCCUPIED') {
            t.status = 'AVAILABLE';
            t.updatedAt = new Date().toISOString();
            hasChanges = true;
          }
        }
        if (hasChanges) {
          writeTables(all);
        }
      } catch (syncErr) {
        console.warn('Gagal sinkronisasi status meja dengan DB:', syncErr);
      }
    }

    return filtered;
  },

  async createTable(
    tenantId: string,
    data: {
      outletId: string;
      tableNumber: string;
      name?: string;
      section?: string;
      capacity?: number;
    }
  ): Promise<QrTable> {
    const all = readTables();
    const existing = all.find(
      (t) => t.tenantId === tenantId && t.outletId === data.outletId && t.tableNumber === data.tableNumber.trim()
    );
    if (existing) {
      throw new Error(`Nomor meja ${data.tableNumber} sudah terdaftar di cabang ini.`);
    }

    const now = new Date().toISOString();
    const cleanNumber = data.tableNumber.trim();
    const newTable: QrTable = {
      id: crypto.randomUUID(),
      tenantId,
      outletId: data.outletId,
      tableNumber: cleanNumber,
      name: data.name?.trim() || `Meja ${cleanNumber}`,
      section: data.section?.trim() || 'Utama',
      capacity: Number(data.capacity) || 4,
      status: 'AVAILABLE',
      qrSlug: `tbl-${data.outletId.slice(0, 6)}-${cleanNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      createdAt: now,
      updatedAt: now,
    };

    all.push(newTable);
    writeTables(all);
    return newTable;
  },

  async updateTable(
    tenantId: string,
    id: string,
    data: {
      tableNumber?: string;
      name?: string;
      section?: string;
      capacity?: number;
      status?: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
    }
  ): Promise<QrTable> {
    const all = readTables();
    const idx = all.findIndex((t) => t.id === id && t.tenantId === tenantId);
    if (idx === -1) {
      throw new Error('Meja tidak ditemukan');
    }

    const current = all[idx];
    if (data.tableNumber && data.tableNumber.trim() !== current.tableNumber) {
      const conflict = all.find(
        (t) =>
          t.id !== id &&
          t.tenantId === tenantId &&
          t.outletId === current.outletId &&
          t.tableNumber === data.tableNumber!.trim()
      );
      if (conflict) {
        throw new Error(`Nomor meja ${data.tableNumber} sudah digunakan.`);
      }
    }

    const updated: QrTable = {
      ...current,
      tableNumber: data.tableNumber ? data.tableNumber.trim() : current.tableNumber,
      name: data.name !== undefined ? data.name.trim() : current.name,
      section: data.section !== undefined ? data.section.trim() : current.section,
      capacity: data.capacity !== undefined ? Number(data.capacity) : current.capacity,
      status: data.status || current.status,
      updatedAt: new Date().toISOString(),
    };

    all[idx] = updated;
    writeTables(all);
    return updated;
  },

  async deleteTable(tenantId: string, id: string): Promise<boolean> {
    const all = readTables();
    const filtered = all.filter((t) => !(t.id === id && t.tenantId === tenantId));
    if (filtered.length === all.length) return false;
    writeTables(filtered);
    return true;
  },

  /**
   * Mengambil atau menginisialisasi pengaturan Buku Menu QR per outlet
   */
  async getSettings(tenantId: string, outletId: string): Promise<QrMenuSettings> {
    const all = readSettings();
    let current = all.find((s) => s.tenantId === tenantId && s.outletId === outletId);

    if (!current) {
      current = {
        tenantId,
        outletId,
        selfOrderingEnabled: true,
        welcomeTitle: 'Selamat Datang di Buku Menu Digital!',
        welcomeSubtitle: 'Pesan makanan & minuman langsung dari meja Anda tanpa perlu antri.',
        wifiEnabled: true,
        wifiName: 'KedaiKopi_Guest',
        wifiPassword: 'ngopidulu',
        paymentPolicy: 'PAY_AT_CASHIER',
        showEstimatedTime: true,
        estimatedPrepMinutes: 15,
        updatedAt: new Date().toISOString(),
      };
      all.push(current);
      writeSettings(all);
    }

    return current;
  },

  async updateSettings(
    tenantId: string,
    outletId: string,
    data: Partial<Omit<QrMenuSettings, 'tenantId' | 'outletId' | 'updatedAt'>>
  ): Promise<QrMenuSettings> {
    const all = readSettings();
    let idx = all.findIndex((s) => s.tenantId === tenantId && s.outletId === outletId);

    const now = new Date().toISOString();
    let updated: QrMenuSettings;

    if (idx === -1) {
      updated = {
        tenantId,
        outletId,
        selfOrderingEnabled: data.selfOrderingEnabled ?? true,
        welcomeTitle: data.welcomeTitle || 'Selamat Datang!',
        welcomeSubtitle: data.welcomeSubtitle || 'Silakan pilih menu favorit Anda.',
        wifiEnabled: data.wifiEnabled !== undefined ? Boolean(data.wifiEnabled) : true,
        wifiName: data.wifiName || '',
        wifiPassword: data.wifiPassword || '',
        paymentPolicy: 'PAY_AT_CASHIER',
        showEstimatedTime: data.showEstimatedTime ?? true,
        estimatedPrepMinutes: data.estimatedPrepMinutes || 15,
        bannerUrl: data.bannerUrl,
        updatedAt: now,
      };
      all.push(updated);
    } else {
      updated = {
        ...all[idx],
        ...data,
        wifiEnabled: data.wifiEnabled !== undefined ? Boolean(data.wifiEnabled) : (all[idx].wifiEnabled ?? true),
        paymentPolicy: 'PAY_AT_CASHIER', // Lock to Pay At Cashier as agreed
        updatedAt: now,
      };
      all[idx] = updated;
    }

    writeSettings(all);
    return updated;
  },

  /**
   * Mengambil data Menu Publik untuk Pelanggan (Tanpa login akun staf)
   */
  async getPublicMenu(outletId: string, tableCode?: string | null) {
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!outlet) {
      throw new Error('Outlet tidak ditemukan.');
    }

    const tenantId = outlet.tenantId;
    const settings = await this.getSettings(tenantId, outletId);

    // Cari info meja jika tableCode diberikan
    let matchedTable: QrTable | null = null;
    if (tableCode) {
      const tables = await this.getTables(tenantId, outletId);
      matchedTable =
        tables.find(
          (t) =>
            t.tableNumber.toLowerCase() === tableCode.toLowerCase() ||
            t.qrSlug.toLowerCase() === tableCode.toLowerCase() ||
            t.id === tableCode
        ) || null;
    }

    // ─── Cek apakah meja sedang aktif dipakai tamu lain ───
    let tableOccupied = false;
    let activeOrderInfo: { invoiceNumber: string; customerName: string; channel: string } | null = null;

    if (matchedTable) {
      const activeOrders = await prisma.$queryRawUnsafe<any[]>(
        `SELECT invoice_number, channel, notes
         FROM "orders"
         WHERE outlet_id = $1
           AND tenant_id = $2
           AND table_number = $3
           AND payment_status = 'UNPAID'
           AND order_status NOT IN ('CANCELLED', 'VOIDED')
         ORDER BY created_at DESC
         LIMIT 1;`,
        outletId,
        tenantId,
        matchedTable.tableNumber
      );

      if (activeOrders.length > 0) {
        tableOccupied = true;
        const guestMatch = activeOrders[0].notes?.match(/Tamu:\s*([^|(]+)/i);
        activeOrderInfo = {
          invoiceNumber: activeOrders[0].invoice_number,
          customerName: guestMatch ? guestMatch[1].trim() : 'Tamu',
          channel: activeOrders[0].channel,
        };
      }
    }

    // Ambil produk katalog yang aktif untuk outlet ini (EPIC-19 & QR Menu)
    const rawProducts = await prisma.$queryRawUnsafe<any[]>(
      `SELECT 
        p.id, p.name, p.description, p.image_url, p.category_id,
        c.name as category_name,
        pv.id as variant_id, pv.name as variant_name, pv.sku,
        COALESCE(op.price_override, pv.price, 0) as price
       FROM "products" p
       JOIN "outlet_products" op ON op.product_id = p.id AND op.outlet_id = $2 AND op.is_available = true
       LEFT JOIN "categories" c ON p.category_id = c.id
       LEFT JOIN "product_variants" pv ON p.id = pv.product_id AND pv.is_active = true
       WHERE p.tenant_id = $1 
         AND p.is_active = true
       ORDER BY c.name ASC, p.name ASC;`,
      tenantId,
      outletId
    );

    // Agregasi produk dengan varian harga
    const productMap = new Map<string, any>();
    const categorySet = new Set<string>();

    for (const r of rawProducts) {
      const catName = r.category_name || 'Menu Lainnya';
      categorySet.add(catName);

      if (!productMap.has(r.id)) {
        productMap.set(r.id, {
          id: r.id,
          name: r.name,
          description: r.description,
          imageUrl: r.image_url,
          categoryName: catName,
          minPrice: Number(r.price) || 0,
          variants: [],
          modifiers: [],
        });
      }

      const p = productMap.get(r.id)!;
      const priceNum = Number(r.price) || 0;
      if (priceNum > 0 && (p.minPrice === 0 || priceNum < p.minPrice)) {
        p.minPrice = priceNum;
      }

      if (r.variant_id) {
        p.variants.push({
          id: r.variant_id,
          name: r.variant_name || 'Standard',
          price: priceNum,
          sku: r.sku,
        });
      }
    }

    // Ambil relational modifiers untuk seluruh produk dalam menu QR
    const productIds = Array.from(productMap.keys());
    if (productIds.length > 0) {
      try {
        const pmgRows = await prisma.productModifierGroup.findMany({
          where: {
            productId: { in: productIds },
            tenantId,
          },
          include: {
            modifierGroup: {
              include: {
                items: {
                  orderBy: { createdAt: 'asc' },
                },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        });

        for (const pmg of pmgRows) {
          const prod = productMap.get(pmg.productId);
          if (prod && pmg.modifierGroup) {
            prod.modifiers.push({
              id: pmg.modifierGroup.id,
              name: pmg.modifierGroup.name,
              type: pmg.modifierGroup.selectionType,
              required: pmg.modifierGroup.isRequired,
              options: pmg.modifierGroup.items.map((it: any) => ({
                id: it.id,
                name: it.name,
                priceDelta: Number(it.priceAdjustment) || 0,
                isDefault: it.isDefault,
              })),
            });
          }
        }
      } catch (modErr) {
        console.warn('Gagal memuat relational modifiers produk untuk QR Menu:', modErr);
      }
    }

    const products = Array.from(productMap.values());
    const categories = Array.from(categorySet);

    return {
      outlet: {
        id: outlet.id,
        name: outlet.name,
        address: outlet.address,
        phone: outlet.phone,
        tenantName: outlet.tenant?.name || outlet.name,
        feesConfig: outlet.feesConfig,
      },
      settings,
      table: matchedTable,
      tableOccupied,
      activeOrderInfo,
      categories,
      products,
    };
  },

  /**
   * Menyerahkan pesanan dari Meja Pelanggan (Customer Self-Ordering)
   * Menyimpan ke database Order dengan channel QR_MENU, paymentStatus UNPAID, orderStatus CONFIRMED.
   */
  async submitPublicOrder(data: {
    outletId: string;
    tableNumber: string;
    customerName: string;
    customerPhone?: string;
    notes?: string;
    items: Array<{
      productId: string;
      variantId?: string;
      productName: string;
      variantName?: string;
      quantity: number;
      unitPrice: number;
      notes?: string;
      modifiers?: Array<{
        groupName: string;
        option: {
          id: string;
          name: string;
          priceDelta: number;
        };
      }>;
    }>;
  }) {
    if (!data.items || data.items.length === 0) {
      throw new Error('Keranjang belanja kosong');
    }
    if (!data.customerName || !data.customerName.trim()) {
      throw new Error('Nama pelanggan wajib diisi');
    }
    if (!data.tableNumber || !data.tableNumber.trim()) {
      throw new Error('Nomor meja wajib diisi');
    }

    // Guard: Tolak pesanan dari mode pratinjau (table=DEMO)
    if (data.tableNumber.trim().toUpperCase() === 'DEMO') {
      throw new Error(
        'Pesanan dari mode pratinjau tidak dapat diproses. Ini hanya tampilan contoh untuk pengelola toko. Gunakan QR code dari meja nyata untuk memesan.'
      );
    }

    const outlet = await prisma.outlet.findUnique({
      where: { id: data.outletId },
      select: { id: true, tenantId: true, name: true, feesConfig: true },
    });
    if (!outlet) {
      throw new Error('Outlet tidak ditemukan.');
    }

    const tenantId = outlet.tenantId;

    // Cari actor user default untuk cashier_id FK constraint
    let actorUser = await prisma.user.findFirst({
      where: { tenantId, role: 'ADMIN' },
      select: { id: true },
    });
    if (!actorUser) {
      actorUser = await prisma.user.findFirst({
        where: { tenantId },
        select: { id: true },
      });
    }
    const cashierId = actorUser?.id || crypto.randomUUID();

    // Kalkulasi subtotal
    let subtotal = 0;
    for (const item of data.items) {
      const q = Math.max(1, Number(item.quantity) || 1);
      const p = Math.max(0, Number(item.unitPrice) || 0);
      subtotal += q * p;
    }

    // Kalkulasi Pajak / Service — QR Menu = konteks DINE_IN
    // Hanya apply fee dengan channelScope 'ALL' atau 'DINE_IN'
    let taxAmount = 0;
    let serviceCharge = 0;
    if (outlet.feesConfig && Array.isArray(outlet.feesConfig)) {
      for (const fee of outlet.feesConfig as any[]) {
        if (!fee.isActive) continue;
        if (fee.category === 'ON_DEMAND_PACKAGING') continue;
        const feeRate: number = fee.rate ?? fee.value ?? 0;
        const feeScope: string = fee.channelScope ?? fee.category ?? 'ALL';
        // Filter: hanya berlaku untuk semua channel atau khusus DINE_IN
        if (feeScope !== 'ALL' && feeScope !== 'DINE_IN') continue;
        if (fee.type === 'PERCENTAGE') {
          const val = Math.round((subtotal * feeRate) / 100);
          // Biaya Layanan (Service Charge) dikategorikan berdasarkan nama/id fee
          const isServiceCharge = (fee.id as string || '').includes('service') ||
            (fee.name as string || '').toLowerCase().includes('layanan') ||
            (fee.name as string || '').toLowerCase().includes('service');
          if (isServiceCharge) serviceCharge += val;
          else taxAmount += val;
        } else {
          taxAmount += feeRate;
        }
      }
    }

    const grandTotal = subtotal + taxAmount + serviceCharge;

    // Buat invoice number khusus QR: QR/YYYYMMDD/{outletCode}/{4-digit sequence}
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const outletCode = outlet.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 3)
      .toUpperCase();

    const seqCount = await prisma.$queryRawUnsafe<any[]>(
      `SELECT count(*)::int as cnt FROM "orders" WHERE invoice_number LIKE $1;`,
      `QR/${dateStr}/${outletCode}/%`
    );
    const seq = String((seqCount[0]?.cnt || 0) + 1).padStart(4, '0');
    const invoiceNumber = `QR/${dateStr}/${outletCode}/${seq}`;

    const orderId = crypto.randomUUID();
    const cleanTable = data.tableNumber.trim();

    // ─── Proteksi Ganda: Blokir order baru jika meja sedang aktif terisi tamu lain ───
    const occupiedCheck = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, invoice_number, notes
       FROM "orders"
       WHERE outlet_id = $1
         AND tenant_id = $2
         AND table_number = $3
         AND payment_status = 'UNPAID'
         AND order_status NOT IN ('CANCELLED', 'VOIDED')
       ORDER BY created_at DESC
       LIMIT 1;`,
      data.outletId,
      tenantId,
      cleanTable
    );

    if (occupiedCheck.length > 0) {
      const occ = occupiedCheck[0];
      throw new Error(
        `Meja ${cleanTable} sedang digunakan oleh tamu lain (Tagihan #${occ.invoice_number}). Silakan hubungi kasir atau staf kami untuk bantuan.`
      );
    }

    const combinedNotes = `Meja ${cleanTable} | Tamu: ${data.customerName.trim()}${
      data.notes ? ` (${data.notes.trim()})` : ''
    }`;

    // Simpan Order secara atomik
    await prisma.$transaction(async (tx) => {
      // 1. Simpan order header
      await tx.$executeRawUnsafe(
        `INSERT INTO "orders" (
          "id", "tenant_id", "outlet_id", "cashier_id", "invoice_number",
          "subtotal", "discount_amount", "tax_amount", "service_total", "grand_total",
          "payment_status", "channel", "order_type", "table_number", "notes", "order_status", "created_at", "updated_at"
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, 0, $7, $8, $9,
          'UNPAID'::"PaymentStatus", 'QR_MENU', 'DINE_IN', $10, $11, 'CONFIRMED'::"OrderStatus", (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC')
        );`,
        orderId,
        tenantId,
        outlet.id,
        cashierId,
        invoiceNumber,
        subtotal,
        taxAmount,
        serviceCharge,
        grandTotal,
        cleanTable,
        combinedNotes
      );

      // 2. Simpan order items dengan skema kanonikal target
      for (const item of data.items) {
        const orderItemId = crypto.randomUUID();
        const qty = Math.max(1, Number(item.quantity) || 1);
        const price = Math.max(0, Number(item.unitPrice) || 0);

        let resolvedVariantId = item.variantId || null;
        if (!resolvedVariantId && item.productId) {
          const defaultVariant = await tx.productVariant.findFirst({
            where: { productId: item.productId, tenantId },
            select: { id: true, name: true },
          });
          if (defaultVariant) {
            resolvedVariantId = defaultVariant.id;
          }
        }

        // Resolusi snapshot modifiers jika dipilih oleh tamu
        let modifiersSnapshotJson: string | null = null;
        if (item.modifiers && item.modifiers.length > 0) {
          const snapshot = item.modifiers.map((m) => ({
            id: m.option.id,
            name: m.option.name,
            price_adjustment: m.option.priceDelta,
            group_name: m.groupName,
          }));
          modifiersSnapshotJson = JSON.stringify(snapshot);
        }

        await tx.$executeRawUnsafe(
          `INSERT INTO "order_items" (
            "id", "tenant_id", "order_id", "product_variant_id",
            "product_name", "variant_name", "quantity", "unit_price", "cost_price", "discount_amount", "subtotal", "notes", "modifiers_snapshot"
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8, 0, 0, $9, $10, $11::jsonb
          );`,
          orderItemId,
          tenantId,
          orderId,
          resolvedVariantId,
          item.productName,
          item.variantName || 'Standar',
          qty,
          price,
          qty * price,
          item.notes || null,
          modifiersSnapshotJson
        );
      }
    });

    // Otomatis ubah status meja menjadi OCCUPIED
    const tables = readTables();
    const matchedTableIdx = tables.findIndex(
      (t) => t.tenantId === tenantId && t.outletId === outlet.id && t.tableNumber === cleanTable
    );
    if (matchedTableIdx !== -1) {
      tables[matchedTableIdx].status = 'OCCUPIED';
      tables[matchedTableIdx].updatedAt = new Date().toISOString();
      writeTables(tables);
    }

    return {
      orderId,
      invoiceNumber,
      tableNumber: cleanTable,
      customerName: data.customerName.trim(),
      subtotal,
      taxAmount,
      serviceCharge,
      grandTotal,
      paymentPolicy: 'PAY_AT_CASHIER',
      orderStatus: 'CONFIRMED',
      message: 'Pesanan meja berhasil dikirim ke dapur. Silakan lakukan pembayaran di kasir.',
    };
  },

  /**
   * Mengambil antrean pesanan QR masuk untuk Backoffice / Dapur
   */
  async getQrOrders(tenantId: string, outletId?: string | null) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT 
        o.id, o.invoice_number, o.created_at, o.subtotal, o.tax_amount, o.service_total as service_charge, 
        o.grand_total, o.order_status, o.payment_status, o.table_number, o.notes,
        c.name as customer_name, c.phone as customer_phone,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'productId', pv.product_id,
              'productName', oi.product_name,
              'variantName', oi.variant_name,
              'quantity', oi.quantity,
              'unitPrice', oi.unit_price,
              'subtotal', oi.subtotal,
              'notes', oi.notes
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) as items
       FROM "orders" o
       LEFT JOIN "customers" c ON c.id = o.customer_id
       LEFT JOIN "order_items" oi ON o.id = oi.order_id
       LEFT JOIN "product_variants" pv ON pv.id = oi.product_variant_id
       WHERE o.tenant_id = $1
         AND o.channel = 'QR_MENU'
         AND o.order_status NOT IN ('CANCELLED', 'VOIDED')
         ${outletId ? `AND o.outlet_id = $2` : ''}
       GROUP BY o.id, c.name, c.phone
       ORDER BY o.created_at DESC
       LIMIT 50;`,
      ...(outletId ? [tenantId, outletId] : [tenantId])
    );

    return rows.map((r) => {
      let derivedCustomerName = r.customer_name;
      if (!derivedCustomerName && r.notes) {
        const guestMatch = r.notes.match(/Tamu:\s*([^|(]+)/i);
        if (guestMatch) {
          derivedCustomerName = guestMatch[1].trim();
        }
      }

      return {
        id: r.id,
        invoiceNumber: r.invoice_number,
        createdAt: r.created_at,
        subtotal: Number(r.subtotal) || 0,
        taxAmount: Number(r.tax_amount) || 0,
        serviceCharge: Number(r.service_charge) || 0,
        grandTotal: Number(r.grand_total) || 0,
        orderStatus: r.order_status,
        paymentStatus: r.payment_status,
        tableNumber: r.table_number || 'Tanpa Meja',
        notes: r.notes,
        customerName: derivedCustomerName || 'Pelanggan',
        customerPhone: r.customer_phone || null,
        items: Array.isArray(r.items) ? r.items : [],
      };
    });
  },

  /**
   * Mengupdate status pesanan QR (CONFIRMED -> IN_PROGRESS -> READY -> COMPLETED / CANCELLED)
   */
  async updateOrderStatus(tenantId: string, orderId: string, status: string) {
    const valid = ['CONFIRMED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED', 'VOIDED'];
    if (!valid.includes(status)) {
      throw new Error(`Status ${status} tidak valid.`);
    }

    const order = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, table_number, outlet_id FROM "orders" WHERE id = $1 AND tenant_id = $2;`,
      orderId,
      tenantId
    );
    if (!order || order.length === 0) {
      throw new Error('Pesanan tidak ditemukan.');
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "orders" 
       SET "order_status" = $1::"OrderStatus", 
           "updated_at" = CURRENT_TIMESTAMP 
       WHERE "id" = $2 AND "tenant_id" = $3;`,
      status,
      orderId,
      tenantId
    );

    // Rilis meja HANYA jika pesanan dibatalkan/divoid oleh staf.
    // Status COMPLETED dari dapur berarti makanan siap/terkirim ke meja,
    // NAMUN belum tentu tagihan sudah lunas di kasir — meja harus tetap OCCUPIED
    // sampai kasir melakukan checkout dan pembayaran selesai.
    if (status === 'CANCELLED' || status === 'VOIDED') {
      const tableNumber = order[0].table_number;
      const outletId = order[0].outlet_id;

      if (tableNumber && outletId) {
        await this.releaseTableIfNoActiveOrders(tenantId, outletId, tableNumber);
      }
    }

    return { id: orderId, status };
  },

  /**
   * Me-release status meja menjadi AVAILABLE jika sudah tidak ada pesanan aktif (UNPAID)
   */
  async releaseTableIfNoActiveOrders(tenantId: string, outletId: string, tableNumber: string) {
    const cleanTable = (tableNumber || '').replace(/^Meja\s*/i, '').trim();
    if (!cleanTable) return;

    const activeOrders = await prisma.$queryRawUnsafe<any[]>(
      `SELECT count(*)::int as cnt FROM "orders" 
       WHERE tenant_id = $1 AND outlet_id = $2 
         AND LOWER(REGEXP_REPLACE(table_number, '^Meja\\s*', '', 'i')) = LOWER($3)
         AND payment_status = 'UNPAID'
         AND order_status NOT IN ('CANCELLED', 'VOIDED', 'COMPLETED');`,
      tenantId,
      outletId,
      cleanTable
    );

    if ((activeOrders[0]?.cnt || 0) === 0) {
      const tables = readTables();
      const tIdx = tables.findIndex(
        (t) =>
          t.tenantId === tenantId &&
          t.outletId === outletId &&
          t.tableNumber.replace(/^Meja\s*/i, '').trim().toLowerCase() === cleanTable.toLowerCase()
      );
      if (tIdx !== -1) {
        tables[tIdx].status = 'AVAILABLE';
        tables[tIdx].updatedAt = new Date().toISOString();
        writeTables(tables);
      }
    }
  },
};
