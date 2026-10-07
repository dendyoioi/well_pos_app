import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PaymentMethod, PaymentStatus, PaymentTxStatus, StockMovementType, ShiftStatus, Role, OrderStatus, RefundReason, PointTxType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { sendOrderReceiptEmail } from '../services/mail.service';
import { salesDualWriteService } from '../services/dual_write';
import { salesReadAdapter, isReadFromTargetEnabled } from '../services/read_adapters';
import { loyaltyService, LoyaltyService } from '../services/loyalty.service';
import { promotionService } from '../services/promotion.service';
import { qrMenuService } from '../services/qr_menu.service';
import { whatsAppService } from '../services/whatsapp.service';
import { toWibDateStr } from '../utils/date.utils';

// Skema validasi item keranjang belanja
const orderItemSchema = z.object({
  productId: z.string().uuid('ID produk tidak valid'),
  variantId: z.string().uuid().optional().nullable(),
  quantity: z.number().int().positive('Jumlah harus minimal 1'),
  discountAmount: z.number().min(0).default(0),
  modifierItemIds: z.array(z.string().uuid()).optional().default([]),
  notes: z.string().optional().nullable(),
});

// Skema validasi pembayaran tunggal
const paymentItemSchema = z.object({
  method: z.preprocess(
    (val) => {
      const s = String(val).toUpperCase();
      if (s === 'DEBT' || s === 'CUSTOMER_DEBT') return PaymentMethod.CUSTOMER_DEBT;
      if (s === 'TRANSFER' || s === 'BANK_TRANSFER') return PaymentMethod.BANK_TRANSFER;
      if (s === 'DEBIT' || s === 'DEBIT_CARD') return PaymentMethod.DEBIT_CARD;
      if (s === 'CREDIT' || s === 'CREDIT_CARD') return PaymentMethod.CREDIT_CARD;
      if (s === 'QRIS') return PaymentMethod.QRIS;
      if (s === 'CASH') return PaymentMethod.CASH;
      return val;
    },
    z.nativeEnum(PaymentMethod, {
      errorMap: () => ({ message: 'Metode pembayaran tidak valid' }),
    })
  ),
  amountPaid: z.number().min(0, 'Jumlah bayar tidak boleh negatif'),
  changeGiven: z.number().min(0).optional(),
  qrisReference: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  debtNotes: z.string().optional().nullable(),
});

// Skema validasi checkout lengkap (mendukung single payment maupun split payments)
const checkoutSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Keranjang belanja tidak boleh kosong'),
  channel: z.string().optional().default('DINE_IN'),
  orderType: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'RETAIL']).optional(),
  tableNumber: z.string().optional().nullable(),
  onlineOrderId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  customerName: z.string().optional(),
  customerEmail: z.string().email('Format email tidak valid').optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  discountAmount: z.number().min(0).default(0),
  promoCode: z.string().optional().nullable(),
  pointsToRedeem: z.number().int().min(0).default(0),
  taxRate: z.number().min(0).max(1).default(0), // Misal 0.11 untuk PPN 11% atau 0
  taxAmount: z.number().min(0).optional(), // Nilai nominal pajak jika dihitung dinamis dari outlet
  serviceCharge: z.number().min(0).default(0),
  payment: paymentItemSchema.optional(),
  payments: z.array(paymentItemSchema).optional(),
  existingOrderId: z.string().uuid().optional().nullable(),
  shiftId: z.string().uuid().optional(),
  outletId: z.string().uuid().optional(),
  dueDate: z.string().optional().nullable(),
  debtNotes: z.string().optional().nullable(),
  offlineReferenceId: z.string().optional().nullable(),
});

/**
 * Helper: Menghasilkan Nomor Invoice Standar
 * Format: INV/YYYYMMDD/{outletCode}/{sequence 4 digit}
 * Contoh: INV/20260915/PST/0001
 */
const generateInvoiceNumber = async (outletId: string): Promise<string> => {
  const today = new Date();
  // Fix Timezone: Gunakan toWibDateStr agar nomor invoice pakai tanggal WIB, bukan UTC.
  // Mencegah struk malam tengah malam mendapat nomor tanggal kemarin.
  const dateStr = toWibDateStr(today).replace(/-/g, ''); // YYYYMMDD dalam WIB

  // Ambil kode singkatan outlet
  const outlet = await prisma.outlet.findUnique({
    where: { id: outletId },
    select: { name: true },
  });

  const outletCode = outlet?.name
    ? outlet.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 3)
        .toUpperCase()
    : 'OUT';

  // Hitung jumlah transaksi hari ini untuk prefix tersebut secara global
  const prefix = `INV/${dateStr}/${outletCode}/`;
  const existingWithPrefix = await prisma.$queryRawUnsafe<any[]>(
    `SELECT count(*)::int as cnt FROM "orders" WHERE invoice_number LIKE $1;`,
    `${prefix}%`
  );
  const sequenceNum = (existingWithPrefix[0]?.cnt || 0) + 1;
  const sequence = String(sequenceNum).padStart(4, '0');
  return `${prefix}${sequence}`;
};

/**
 * Controller: Checkout Transaksi Penjualan (POS Core Engine)
 * @route POST /api/orders/checkout
 */
export const checkoutOrder = async (req: Request, res: Response) => {
  try {
    const parseResult = checkoutSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Data checkout tidak valid',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const {
      items,
      channel = 'DINE_IN',
      orderType,
      tableNumber,
      onlineOrderId,
      notes,
      customerId,
      customerName,
      customerEmail,
      customerPhone,
      discountAmount: globalDiscount,
      promoCode,
      pointsToRedeem = 0,
      taxRate,
      taxAmount: explicitTaxAmount,
      serviceCharge,
      payment,
      payments,
      existingOrderId,
      shiftId,
      outletId: bodyOutletId,
      dueDate: bodyDueDate,
      debtNotes: bodyDebtNotes,
      offlineReferenceId,
    } = parseResult.data;

    let tenantId = req.user?.tenantId || req.tenantId || (req.headers['x-tenant-id'] as string) || null;

    // Tentukan outlet cabang transaksi
    let targetOutletId = bodyOutletId || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = tenantId
        ? await prisma.outlet.findFirst({
            where: { tenantId },
            select: { id: true },
          })
        : null;
      targetOutletId = defaultOutlet?.id;
    }

    if (!targetOutletId) {
      return res.status(400).json({ status: 'error', message: 'Toko / outlet tidak ditemukan' });
    }

    const targetOutlet = await prisma.outlet.findUnique({
      where: { id: targetOutletId },
      select: { tenantId: true, loyaltyConfig: true, paymentConfig: true },
    });
    if (!targetOutlet) {
      return res.status(400).json({ status: 'error', message: 'Toko / outlet tidak ditemukan' });
    }

    if (!tenantId) {
      tenantId = targetOutlet.tenantId || null;
    }
    if (!tenantId) {
      // Fix K3: Jangan fallback ke tenant pertama — checkout tanpa konteks tenant adalah error fatal
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    const isLoyaltyActive = (targetOutlet.loyaltyConfig as any)?.isActive === true;

    const cashierId = req.user?.id;
    if (!cashierId) {
      return res.status(401).json({ status: 'error', message: 'Kasir belum terautentikasi' });
    }

    // ====================================================
    // IDEMPOTENSI TRANSAKSI OFFLINE PWA (ANTI-DUPLIKASI)
    // ====================================================
    if (offlineReferenceId && offlineReferenceId.trim()) {
      const cleanRef = offlineReferenceId.trim();
      const existingOfflineOrder = await prisma.order.findFirst({
        where: {
          tenantId,
          outletId: targetOutletId,
          notes: { contains: `[OFFLINE_REF:${cleanRef}]` },
        },
        include: {
          items: true,
          payments: true,
          outlet: true,
          cashier: { select: { id: true, name: true } },
        },
      });
      if (existingOfflineOrder) {
        return res.status(200).json({
          status: 'success',
          message: 'Transaksi offline sudah berhasil disinkronkan sebelumnya',
          data: existingOfflineOrder,
        });
      }
    }

    // Resolusi data pelanggan (Customer / CRM)
    let resolvedCustomerId = customerId || null;
    let finalCustomerName = customerName || null;
    let finalCustomerPhone = customerPhone || null;
    let finalCustomerEmail = customerEmail || null;

    if (resolvedCustomerId) {
      const existingCustomer = await prisma.customer.findFirst({
        where: { id: resolvedCustomerId, ...(tenantId ? { tenantId } : {}) },
        select: { id: true, name: true, phone: true, email: true },
      });
      if (existingCustomer) {
        finalCustomerName = finalCustomerName || existingCustomer.name;
        finalCustomerPhone = finalCustomerPhone || existingCustomer.phone;
        finalCustomerEmail = finalCustomerEmail || existingCustomer.email;
      } else {
        resolvedCustomerId = null;
      }
    } else if (finalCustomerPhone && finalCustomerPhone.trim()) {
      const matchedByPhone = await prisma.customer.findFirst({
        where: { phone: finalCustomerPhone.trim(), ...(tenantId ? { tenantId } : {}) },
        select: { id: true, name: true, phone: true, email: true },
      });
      if (matchedByPhone) {
        resolvedCustomerId = matchedByPhone.id;
        finalCustomerName = finalCustomerName || matchedByPhone.name;
        finalCustomerEmail = finalCustomerEmail || matchedByPhone.email;
      } else if (finalCustomerName && finalCustomerName.trim() && finalCustomerName.trim().toLowerCase() !== 'umum') {
        // CRM Opsi A: Otomatis tambahkan pelanggan baru jika belum terdaftar
        try {
          const newCustomer = await prisma.customer.create({
            data: {
              tenantId: tenantId!,
              name: finalCustomerName.trim(),
              phone: finalCustomerPhone.trim(),
              email: finalCustomerEmail?.trim() || undefined,
            },
          });
          resolvedCustomerId = newCustomer.id;
        } catch (custErr) {
          console.warn('Gagal auto-create customer saat transaksi:', custErr);
        }
      }
    }

    // Jika shiftId tidak dikirimkan, otomatis hubungkan dengan shift aktif kasir saat ini
    let resolvedShiftId = shiftId;
    if (!resolvedShiftId) {
      const activeShifts = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM "shifts" WHERE cashier_id = $1 AND status = 'OPEN' LIMIT 1;`,
        cashierId
      );
      if (activeShifts && activeShifts.length > 0) {
        resolvedShiftId = activeShifts[0].id;
      }
    }

    // Ambil data produk & stok riil dari target database (gabungan products, product_variants, storage_locations & inventory_balances)
    const uniqueProductIds = Array.from(new Set(items.map((i) => i.productId)));
    const productsInDb = await prisma.$queryRawUnsafe<any[]>(
      `SELECT DISTINCT ON (p.id) p.id, p.name, p.unit, p.type, COALESCE(ii.average_cost, 0) as "costPrice", COALESCE(pv.price, 0) as "basePrice",
              COALESCE(ib.quantity_on_hand, 0) as stock,
              COALESCE(pv.price, 0) as "outletPrice",
              pv.id as "variantId",
              r.id as "recipeId"
       FROM "products" p
       LEFT JOIN "product_variants" pv ON pv.product_id = p.id AND pv.is_active = true
       LEFT JOIN "recipes" r ON r.product_variant_id = pv.id
       LEFT JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id
       LEFT JOIN "storage_locations" sl ON sl.outlet_id = $1 AND sl.is_default = true
       LEFT JOIN "inventory_balances" ib ON ib.inventory_item_id = ii.id AND ib.storage_location_id = sl.id
       WHERE p.id = ANY($2::text[]) AND p.is_active = true AND ($3::text IS NULL OR p.tenant_id = $3);`,
      targetOutletId,
      uniqueProductIds,
      tenantId
    );

    const dbProductIds = new Set(productsInDb.map((p) => p.id));
    if (uniqueProductIds.some((id) => !dbProductIds.has(id))) {
      return res.status(400).json({
        status: 'error',
        message: 'Beberapa produk di keranjang tidak aktif atau tidak ditemukan',
      });
    }

    // Peta produk untuk lookup cepat
    const productMap = new Map(productsInDb.map((p) => [p.id, p]));

    // Validasi stok fisik sebelum eksekusi (hanya untuk barang jadi non-resep jika tenant menolak stok negatif)
    const tenantSetting = await prisma.tenant.findUnique({
      where: { id: tenantId! },
      select: { allowNegativeStock: true },
    });
    const isNegativeStockAllowed = tenantSetting?.allowNegativeStock ?? true;

    if (!isNegativeStockAllowed) {
      for (const item of items) {
        const p = productMap.get(item.productId);
        const isRecipeItem = Boolean(p?.recipeId || p?.type === 'COMPOSITE');
        if (!isRecipeItem) {
          const stock = Number(p?.stock ?? 0);
          if (stock < item.quantity) {
            return res.status(400).json({
              status: 'error',
              message: `Stok "${p?.name}" tidak mencukupi! Tersedia: ${stock} ${p?.unit}, diminta: ${item.quantity}`,
            });
          }
        }
      }
    }

    // Resolusi data Modifier dan kalkulasi biaya ekstra
    const allModifierItemIds = Array.from(
      new Set(items.flatMap((i) => i.modifierItemIds || []))
    );

    let modifierMap = new Map<string, { id: string; name: string; priceAdjustment: number }>();
    if (allModifierItemIds.length > 0) {
      const modRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name, price_adjustment as "priceAdjustment" 
         FROM "modifier_items" 
         WHERE id = ANY($1::text[]);`,
        allModifierItemIds
      );
      modifierMap = new Map(modRows.map((m) => [m.id, { id: m.id, name: m.name, priceAdjustment: Number(m.priceAdjustment || 0) }]));
    }

    // Kalkulasi Rincian Biaya
    let subtotal = 0;
    let totalCost = 0; // Akumulasi HPP barang yang terjual

    const preparedOrderItems = items.map((item) => {
      const p = productMap.get(item.productId)!;
      const baseUnitPrice = Number(p.outletPrice ?? p.basePrice);
      const costPrice = Number(p.costPrice);
      const itemDiscount = item.discountAmount || 0;

      // Tambahkan biaya ekstra modifier
      const modifierExtra = (item.modifierItemIds || []).reduce(
        (acc, mid) => acc + (modifierMap.get(mid)?.priceAdjustment || 0),
        0
      );
      const unitPrice = baseUnitPrice + modifierExtra;
      const itemSubtotal = (unitPrice - itemDiscount) * item.quantity;

      subtotal += itemSubtotal;
      totalCost += costPrice * item.quantity;

      return {
        productId: item.productId,
        variantId: item.variantId || p.variantId,
        modifierItemIds: item.modifierItemIds || [],
        notes: item.notes || null,
        quantity: item.quantity,
        costPrice,
        unitPrice,
        discountAmount: itemDiscount,
        subtotal: itemSubtotal,
      };
    });

    // Kalkulasi Promo Voucher & Diskon Poin Loyalitas
    let promoDiscount = 0;
    let appliedPromotionId: string | null = null;
    let appliedPromoCode: string | null = null;

    if (promoCode && promoCode.trim()) {
      const promoResult = await promotionService.validatePromotion(
        tenantId!,
        promoCode.trim(),
        subtotal,
        resolvedCustomerId
      );
      if (!promoResult.valid) {
        return res.status(400).json({ status: 'error', message: promoResult.message });
      }
      promoDiscount = promoResult.discountAmount;
      appliedPromotionId = promoResult.promotion.id;
      appliedPromoCode = promoResult.promotion.code;
    }

    let pointDiscount = 0;
    if (pointsToRedeem > 0) {
      if (!isLoyaltyActive) {
        return res.status(400).json({
          status: 'error',
          message: 'Program loyalitas dan penukaran poin sedang dinonaktifkan di outlet ini.',
        });
      }
      if (!resolvedCustomerId) {
        return res.status(400).json({
          status: 'error',
          message: 'Pelanggan harus dipilih untuk dapat menukarkan poin loyalitas',
        });
      }
      const customer = await prisma.customer.findUnique({
        where: { id: resolvedCustomerId },
      });
      const currentPoints = Number(customer?.loyaltyPoints || 0);
      if (currentPoints < pointsToRedeem) {
        return res.status(400).json({
          status: 'error',
          message: `Poin tidak mencukupi. Tersedia: ${currentPoints} poin, diminta: ${pointsToRedeem} poin`,
        });
      }
      const { maxPoints } = loyaltyService.calculateMaxRedeemable(subtotal, currentPoints);
      if (pointsToRedeem > maxPoints) {
        return res.status(400).json({
          status: 'error',
          message: `Maksimal penukaran poin untuk transaksi ini adalah ${maxPoints} poin`,
        });
      }
      pointDiscount = pointsToRedeem * LoyaltyService.POINT_VALUE_IDR;
    }

    // Kalkulasi Total Diskon, Pajak & Grand Total
    const totalDiscount = (globalDiscount || 0) + promoDiscount + pointDiscount;
    const discountedSubtotal = Math.max(0, subtotal - totalDiscount);
    const taxableSubtotal = discountedSubtotal + serviceCharge;
    const taxAmount = explicitTaxAmount !== undefined ? explicitTaxAmount : Math.round(taxableSubtotal * taxRate);
    const grandTotal = taxableSubtotal + taxAmount;

    // Menyiapkan Rincian Pembayaran (Dukungan Split Payment: Tunai + QRIS)
    const preparedPayments: Array<{
      method: PaymentMethod;
      amountPaid: number;
      changeGiven: number;
      qrisReference: string | null;
      status: PaymentTxStatus;
      dueDate?: string | null;
      debtNotes?: string | null;
    }> = [];

    const normalizeMethod = (m: string | PaymentMethod): PaymentMethod => {
      const raw = String(m).toUpperCase();
      if (raw === 'DEBT' || raw === 'CUSTOMER_DEBT') return PaymentMethod.CUSTOMER_DEBT;
      if (raw === 'TRANSFER' || raw === 'BANK_TRANSFER') return PaymentMethod.BANK_TRANSFER;
      if (raw === 'DEBIT' || raw === 'DEBIT_CARD') return PaymentMethod.DEBIT_CARD;
      if (raw === 'CREDIT' || raw === 'CREDIT_CARD') return PaymentMethod.CREDIT_CARD;
      if (raw === 'QRIS') return PaymentMethod.QRIS;
      if (raw === 'CASH') return PaymentMethod.CASH;
      return m as PaymentMethod;
    };

    if (payments && payments.length > 0) {
      let totalAmountPaid = 0;
      for (const p of payments) {
        totalAmountPaid += p.amountPaid;
        const normMethod = normalizeMethod(p.method);
        const isDebt = normMethod === PaymentMethod.CUSTOMER_DEBT;
        preparedPayments.push({
          method: normMethod,
          amountPaid: p.amountPaid,
          changeGiven: p.changeGiven || 0,
          qrisReference: p.qrisReference || null,
          status: isDebt ? PaymentTxStatus.PENDING : PaymentTxStatus.CAPTURED,
          dueDate: p.dueDate || bodyDueDate || null,
          debtNotes: p.debtNotes || bodyDebtNotes || null,
        });
      }

      if (totalAmountPaid < grandTotal) {
        return res.status(400).json({
          status: 'error',
          message: `Total pembayaran kurang! Tagihan: Rp ${grandTotal.toLocaleString(
            'id-ID'
          )}, Total dibayar: Rp ${totalAmountPaid.toLocaleString('id-ID')}`,
        });
      }
    } else if (payment) {
      const normMethod = normalizeMethod(payment.method);
      const isDebt = normMethod === PaymentMethod.CUSTOMER_DEBT;
      if (normMethod === PaymentMethod.CASH && payment.amountPaid < grandTotal) {
        return res.status(400).json({
          status: 'error',
          message: `Uang pembayaran tunai kurang! Tagihan: Rp ${grandTotal.toLocaleString(
            'id-ID'
          )}, Dibayar: Rp ${payment.amountPaid.toLocaleString('id-ID')}`,
        });
      }

      const changeGiven =
        normMethod === PaymentMethod.CASH ? Math.max(0, payment.amountPaid - grandTotal) : 0;

      preparedPayments.push({
        method: normMethod,
        amountPaid: isDebt && payment.amountPaid === 0 ? grandTotal : payment.amountPaid,
        changeGiven: payment.changeGiven !== undefined ? payment.changeGiven : changeGiven,
        qrisReference: payment.qrisReference || null,
        status: isDebt ? PaymentTxStatus.PENDING : PaymentTxStatus.CAPTURED,
        dueDate: payment.dueDate || bodyDueDate || null,
        debtNotes: payment.debtNotes || bodyDebtNotes || null,
      });
    } else {
      return res.status(400).json({
        status: 'error',
        message: 'Rincian pembayaran wajib disertakan',
      });
    }

    // Validasi Kasbon / Piutang Pelanggan
    const hasDebtPayment = preparedPayments.some((p) => p.method === PaymentMethod.CUSTOMER_DEBT);
    if (hasDebtPayment) {
      if (!resolvedCustomerId) {
        return res.status(400).json({
          status: 'error',
          message: 'Pembayaran kasbon / piutang wajib memilih data pelanggan terdaftar.',
        });
      }

      const outletPaymentConfig = targetOutlet.paymentConfig as any;
      const isCreditAllowed = outletPaymentConfig?.customerDebt?.allowCredit === true;
      if (!isCreditAllowed) {
        return res.status(403).json({
          status: 'error',
          message: 'Metode pembayaran kasbon / piutang belum diaktifkan oleh pemilik toko di Pengaturan Pembayaran.',
        });
      }
    }

    const invoiceNumber = await generateInvoiceNumber(targetOutletId);

    // ====================================================
    // EKSEKUSI DATABASE TRANSACTION (ACID & DUAL-WRITE)
    // ====================================================
    const result = await prisma.$transaction(async (tx) => {
      if (tenantId) {
        try {
          await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, true);`, tenantId);
        } catch (_) {}
      }

      const dwResult = await salesDualWriteService.processCheckout(
        {
          targetOutletId: targetOutletId!,
          cashierId,
          invoiceNumber,
          channel: channel || 'DINE_IN',
          orderType: orderType || channel || 'DINE_IN',
          tableNumber: tableNumber || null,
          notes: (() => {
            const baseNotes = onlineOrderId && onlineOrderId.trim()
              ? (notes && notes.trim() ? `[${channel} #${onlineOrderId.trim()}] ${notes.trim()}` : `[${channel} #${onlineOrderId.trim()}]`)
              : (notes || (tableNumber ? `Meja ${tableNumber}` : null));
            if (offlineReferenceId && offlineReferenceId.trim()) {
              const tag = `[OFFLINE_REF:${offlineReferenceId.trim()}]`;
              return baseNotes ? `${baseNotes} ${tag}` : tag;
            }
            return baseNotes;
          })(),
          items: preparedOrderItems,
          payments: preparedPayments,
          subtotal,
          grandTotal,
          totalCost,
          globalDiscount: totalDiscount,
          taxAmount,
          serviceCharge,
          customerId: resolvedCustomerId,
          customerName: finalCustomerName,
          customerEmail: finalCustomerEmail,
          customerPhone: finalCustomerPhone,
          existingOrderId: existingOrderId || null,
          shiftId: resolvedShiftId || null,
        },
        { tx, tenantId: tenantId!, actorUserId: cashierId }
      );

      const orderId = dwResult.legacyData.id;

      // 1. Catat penggunaan promo jika menggunakan voucher
      if (appliedPromotionId) {
        await promotionService.recordUsage(
          tx,
          tenantId!,
          appliedPromotionId,
          orderId,
          promoDiscount,
          resolvedCustomerId
        );
      }

      // 2. Potong poin jika melakukan penukaran poin belanja
      if (pointsToRedeem > 0 && resolvedCustomerId) {
        await loyaltyService.redeemPoints(
          {
            tenantId: tenantId!,
            customerId: resolvedCustomerId,
            orderId,
            pointsToRedeem,
            subtotal,
          },
          tx
        );
      }

      // 3. Tambahkan poin reward belanja untuk pelanggan terdaftar (hanya jika program loyalitas outlet aktif)
      let pointsEarned = 0;
      if (resolvedCustomerId && isLoyaltyActive) {
        const awardRes = await loyaltyService.awardPoints(
          {
            tenantId: tenantId!,
            customerId: resolvedCustomerId,
            orderId,
            spendAmount: grandTotal,
          },
          tx
        );
        pointsEarned = awardRes.pointsEarned;
      }

      // 4. Update order record dengan metadata promosi dan poin
      await tx.$executeRawUnsafe(
        `UPDATE "orders"
         SET "promotion_id" = $1,
             "points_earned" = $2,
             "points_redeemed" = $3,
             "point_discount_amount" = $4,
             "discount_amount" = $5
         WHERE "id" = $6;`,
        appliedPromotionId,
        pointsEarned,
        pointsToRedeem,
        pointDiscount,
        totalDiscount,
        orderId
      );

      // 5. Catat kasbon pelanggan ke customer_debts jika transaksi menggunakan CUSTOMER_DEBT
      if (hasDebtPayment && resolvedCustomerId) {
        const debtItem = preparedPayments.find((p) => p.method === PaymentMethod.CUSTOMER_DEBT);
        const debtAmount = debtItem ? debtItem.amountPaid : grandTotal;
        const totalCashPaid = preparedPayments
          .filter((p) => p.method !== PaymentMethod.CUSTOMER_DEBT)
          .reduce((sum, p) => sum + Math.max(0, p.amountPaid - (p.changeGiven || 0)), 0);

        const newPaymentStatus = totalCashPaid > 0 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.UNPAID;

        await tx.$executeRawUnsafe(
          `UPDATE "orders"
           SET "payment_status" = $1::"PaymentStatus",
               "paid_amount" = $2
           WHERE "id" = $3;`,
          newPaymentStatus,
          totalCashPaid,
          orderId
        );

        let resolvedDueDate: Date | null = null;
        const rawDueDate = debtItem?.dueDate || bodyDueDate;
        if (rawDueDate) {
          resolvedDueDate = new Date(rawDueDate);
        } else {
          const defaultDueDays = (targetOutlet?.paymentConfig as any)?.customerDebt?.defaultDueDays || 7;
          resolvedDueDate = new Date();
          resolvedDueDate.setDate(resolvedDueDate.getDate() + defaultDueDays);
        }

        const debtNotesText =
          debtItem?.debtNotes ||
          bodyDebtNotes ||
          (notes ? `Kasbon: ${notes}` : `Kasbon transaksi ${invoiceNumber}`);

        await tx.customerDebt.create({
          data: {
            tenantId: tenantId!,
            outletId: targetOutletId!,
            customerId: resolvedCustomerId,
            orderId,
            totalAmount: debtAmount,
            paidAmount: 0,
            remainingAmount: debtAmount,
            dueDate: resolvedDueDate,
            status: 'UNPAID',
            notes: debtNotesText,
          },
        });
      }

      // Query order with relations for exact legacy shape
      const [orderRows, itemRows, paymentRows, outletRows, cashierRows, customerRows] = await Promise.all([
        tx.$queryRawUnsafe<any[]>(`SELECT * FROM "orders" WHERE id = $1 LIMIT 1;`, dwResult.legacyData.id),
        tx.$queryRawUnsafe<any[]>(
          `SELECT oi.id, oi.order_id as "orderId", pv.product_id as "productId", oi.quantity,
                  oi.cost_price as "costPrice", oi.unit_price as "unitPrice", oi.discount_amount as "discountAmount",
                  oi.subtotal, (NOW() AT TIME ZONE 'UTC') as "createdAt",
                  json_build_object('name', oi.product_name, 'sku', oi.sku, 'unit', COALESCE(p.unit, 'PCS')) as product
           FROM "order_items" oi
           LEFT JOIN "product_variants" pv ON pv.id = oi.product_variant_id
           LEFT JOIN "products" p ON p.id = pv.product_id
           WHERE oi.order_id = $1;`,
          dwResult.legacyData.id
        ),
        tx.$queryRawUnsafe<any[]>(
          `SELECT id, order_id as "orderId", payment_method::text as "paymentMethod", amount,
                  amount as "cashReceived", 0 as "cashChange",
                  status::text as status, created_at as "createdAt"
           FROM "payment_transactions" WHERE order_id = $1;`,
          dwResult.legacyData.id
        ),
        tx.$queryRawUnsafe<any[]>(`SELECT name, address, phone, receipt_config FROM "outlets" WHERE id = $1 LIMIT 1;`, targetOutletId),
        tx.$queryRawUnsafe<any[]>(`SELECT name FROM "users" WHERE id = $1 LIMIT 1;`, cashierId),
        resolvedCustomerId
          ? tx.$queryRawUnsafe<any[]>(`SELECT id, name, phone, code FROM "customers" WHERE id = $1 LIMIT 1;`, resolvedCustomerId)
          : Promise.resolve([]),
      ]);

      const o = orderRows[0] || (dwResult as any)?.legacyData;
      if (!o) {
        throw new Error('Gagal memuat data pesanan setelah transaksi checkout.');
      }

      const fullOrder = {
        id: o.id,
        invoiceNumber: o.invoice_number || o.invoiceNumber,
        queueNumber: o.queue_number !== undefined && o.queue_number !== null ? Number(o.queue_number) : ((dwResult as any)?.legacyData?.queueNumber || null),
        outletId: o.outlet_id || o.outletId,
        cashierId: o.cashier_id || o.cashierId,
        shiftId: o.shift_id || o.shiftId,
        customerId: o.customer_id || o.customerId,
        customerName: customerRows[0]?.name || finalCustomerName || (o as any)?.customer_name || (o as any)?.customerName || null,
        customerEmail: customerRows[0]?.email || finalCustomerEmail || (o as any)?.customer_email || (o as any)?.customerEmail || null,
        customerPhone: customerRows[0]?.phone || finalCustomerPhone || (o as any)?.customer_phone || (o as any)?.customerPhone || null,
        channel: o.channel,
        tableNumber: o.table_number || o.tableNumber || null,
        subtotal: Number(o.subtotal || subtotal),
        discountAmount: Number(o.discount_amount || totalDiscount || 0),
        taxAmount: Number(o.tax_amount || taxAmount || 0),
        serviceCharge: Number(o.service_total || o.service_charge || serviceCharge || 0),
        grandTotal: Number(o.grand_total || grandTotal),
        totalCost: Number(totalCost || 0),
        pointsEarned: Number(pointsEarned || o.points_earned || 0),
        pointsRedeemed: Number(pointsToRedeem || o.points_redeemed || 0),
        pointDiscountAmount: Number(pointDiscount || o.point_discount_amount || 0),
        paymentStatus: o.payment_status || 'PAID',
        notes: o.notes || null,
        createdAt: o.created_at || new Date(),
        updatedAt: o.updated_at || new Date(),
        orderItems: itemRows.map((it) => ({
          ...it,
          costPrice: Number(it.costPrice),
          unitPrice: Number(it.unitPrice),
          discountAmount: Number(it.discountAmount),
          subtotal: Number(it.subtotal),
        })),
        payments: paymentRows.map((pay, idx) => {
          const prep = preparedPayments[idx] || preparedPayments[0];
          const m = pay.paymentMethod || pay.payment_method || prep?.method || 'CASH';
          const amtPaid = prep?.amountPaid !== undefined ? Number(prep.amountPaid) : Number(pay.amount);
          const chg = prep?.changeGiven !== undefined ? Number(prep.changeGiven) : 0;
          return {
            ...pay,
            method: m,
            paymentMethod: m,
            amountPaid: amtPaid,
            amount: Number(pay.amount),
            changeGiven: chg,
            cashReceived: amtPaid,
            cashChange: chg,
            qrisReference: prep?.qrisReference || null,
          };
        }),
        outlet: outletRows[0] ? {
          name: outletRows[0].name,
          address: outletRows[0].address,
          phone: outletRows[0].phone,
          receiptConfig: outletRows[0].receipt_config,
        } : null,
        cashier: cashierRows[0] || null,
        customer: customerRows[0] || null,
      };

      return fullOrder;
    });

    // Jika transaksi terhubung dengan meja (Dine In / QR Menu), otomatis sinkronkan status meja agar kembali AVAILABLE
    const tableToRelease = tableNumber || (result as any)?.tableNumber;
    if (tableToRelease && targetOutletId && tenantId) {
      try {
        await qrMenuService.releaseTableIfNoActiveOrders(tenantId, targetOutletId, tableToRelease);
      } catch (tblErr) {
        console.warn('Gagal mereset status meja pasca checkout:', tblErr);
      }
    }

    // Otomatis kirim struk WhatsApp jika customerPhone terisi dan outlet/platform mengizinkan
    const customerPhoneToSend = (result as any)?.customerPhone || finalCustomerPhone;
    if (customerPhoneToSend && targetOutletId) {
      try {
        const outletConfig = (result as any)?.outlet?.receiptConfig;
        const waConfig = outletConfig?.whatsappConfig;
        if (waConfig?.autoSendOnCheckout !== false) {
          whatsAppService
            .sendOrderReceipt(
              {
                invoiceNumber: (result as any).invoiceNumber,
                queueNumber: (result as any).queueNumber,
                createdAt: (result as any).createdAt,
                customerName: (result as any).customerName,
                customerPhone: customerPhoneToSend,
                outlet: {
                  name: (result as any).outlet?.name || 'Well POS Toko',
                  address: (result as any).outlet?.address,
                  phone: (result as any).outlet?.phone,
                  receiptConfig: outletConfig,
                },
                cashierName: (result as any).cashier?.name,
                orderItems: ((result as any).orderItems || []).map((it: any) => ({
                  name: it.product?.name || it.productName || 'Produk',
                  quantity: it.quantity,
                  unitPrice: it.unitPrice,
                  discountAmount: it.discountAmount,
                  subtotal: it.subtotal,
                })),
                subtotal: (result as any).subtotal,
                discountAmount: (result as any).discountAmount,
                taxAmount: (result as any).taxAmount,
                serviceCharge: (result as any).serviceCharge,
                grandTotal: (result as any).grandTotal,
                pointsEarned: (result as any).pointsEarned,
                pointsRedeemed: (result as any).pointsRedeemed,
                pointDiscountAmount: (result as any).pointDiscountAmount,
                payments: (result as any).payments || [],
              },
              customerPhoneToSend
            )
            .catch((waErr) => {
              console.warn('[WHATSAPP AUTO-SEND BACKGROUND ERROR]', waErr);
            });
        }
      } catch (err) {
        console.warn('Gagal memicu pengiriman otomatis WhatsApp struk:', err);
      }
    }

    return res.status(201).json({
      status: 'success',
      message: 'Transaksi berhasil diselesaikan',
      data: result,
    });
  } catch (error: any) {
    console.error('Error saat memproses checkout order:', error);
    return res.status(500).json({
      status: 'error',
      message: error?.message || 'Gagal menyelesaikan transaksi checkout',
    });
  }
};

/**
 * Controller: Mendapatkan riwayat transaksi penjualan
 * @route GET /api/orders
 */
export const getOrders = async (req: Request, res: Response) => {
  try {
    const { outletId, cashierId, channel, search, startDate, endDate, limit = '20', page = '1' } = req.query;

    // Fix T1: Hapus req.query.tenantId — user input tidak boleh override konteks JWT
    let userTenantId: string | undefined = req.user?.tenantId || req.tenantId || (req.headers['x-tenant-id'] as string);
    if (!userTenantId && outletId) {
      const outlet = await prisma.outlet.findUnique({
        where: { id: outletId as string },
        select: { tenantId: true },
      });
      userTenantId = outlet?.tenantId;
    }
    // Fix K3: Jangan fallback ke tenant pertama — tolak dengan 401
    if (!userTenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    const result = await salesReadAdapter.getOrders({
      tenantId: userTenantId || '',
      outletId: outletId as string,
      cashierId: cashierId as string,
      channel: channel as string,
      search: search as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: parseInt(limit as string, 10),
      page: parseInt(page as string, 10),
    });

    return res.status(200).json({
      status: 'success',
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    console.error('Error saat mengambil daftar transaksi:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memuat riwayat transaksi',
    });
  }
};

/**
 * Controller: Detail transaksi penjualan spesifik
 * @route GET /api/orders/:id
 */
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Fix T1: Hapus req.query.tenantId
    let userTenantId = req.user?.tenantId || req.tenantId || (req.headers['x-tenant-id'] as string);

    if (!userTenantId) {
      const orderTenant = await prisma.$queryRawUnsafe<any[]>(
        `SELECT tenant_id FROM "orders" WHERE id = $1 LIMIT 1;`,
        id
      );
      userTenantId = orderTenant[0]?.tenant_id;
    }

    const order = await salesReadAdapter.getOrderById(userTenantId || '', id);
    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Transaksi tidak ditemukan',
      });
    }

    return res.status(200).json({
      status: 'success',
      data: order,
    });
  } catch (error) {
    console.error('Error saat mengambil detail transaksi:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memuat detail transaksi',
    });
  }
};

const sendEmailSchema = z.object({
  email: z.string().email('Format alamat email tidak valid'),
});

/**
 * Controller: Mengirimkan struk transaksi ke email pelanggan
 * @route POST /api/orders/:id/send-email
 */
export const sendOrderEmail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = sendEmailSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Alamat email tidak valid',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { email } = parseResult.data;

    let userTenantId = req.user?.tenantId || req.tenantId;
    if (!userTenantId) {
      const orderTenant = await prisma.$queryRawUnsafe<any[]>(
        `SELECT tenant_id FROM "orders" WHERE id = $1 LIMIT 1;`,
        id
      );
      userTenantId = orderTenant[0]?.tenant_id;
    }

    const order = await salesReadAdapter.getOrderById(userTenantId || '', id);
    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Transaksi tidak ditemukan',
      });
    }

    const payment = order.payments?.[0] || {
      method: 'CASH',
      amountPaid: order.totalAmount,
      changeGiven: 0,
      qrisReference: null,
    };

    const mailResult = await sendOrderReceiptEmail(email, {
      invoiceNumber: order.invoiceNumber,
      createdAt: order.createdAt,
      customerName: order.customer?.name || null,
      outlet: {
        name: order.outlet.name,
        address: null,
        phone: null,
      },
      cashierName: order.cashier?.name,
      orderItems: order.orderItems.map((item: any) => ({
        name: item.productName || item.name || 'Produk',
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discountAmount: Number(item.discountAmount || 0),
        subtotal: Number(item.subtotal),
        unit: 'pcs',
      })),
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountTotal || 0),
      serviceCharge: Number(order.serviceTotal || 0),
      taxAmount: Number(order.taxTotal || 0),
      grandTotal: Number(order.totalAmount),
      payment: {
        method: payment.paymentMethod || 'CASH',
        amountPaid: Number(payment.amount || order.totalAmount),
        changeGiven: Number(order.changeAmount || 0),
        qrisReference: payment.referenceNumber,
      },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Struk transaksi berhasil dikirimkan ke email',
      previewUrl: (mailResult as any)?.previewUrl,
    });
  } catch (error: any) {
    console.error('Error saat mengirim email struk:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Gagal mengirim email struk',
    });
  }
};

/**
 * Controller: Kirim Struk WhatsApp via Fonnte Gateway (atau Simulator)
 * @route POST /api/orders/:id/send-whatsapp
 */
export const sendOrderWhatsApp = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { recipientPhone } = req.body;

    let userTenantId = req.user?.tenantId || req.tenantId;
    if (!userTenantId) {
      const orderTenant = await prisma.$queryRawUnsafe<any[]>(
        `SELECT tenant_id FROM "orders" WHERE id = $1 LIMIT 1;`,
        id
      );
      userTenantId = orderTenant[0]?.tenant_id;
    }

    const order = await salesReadAdapter.getOrderById(userTenantId || '', id);
    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Transaksi tidak ditemukan',
      });
    }

    const targetPhone = recipientPhone || order.customer?.phone;
    if (!targetPhone || !targetPhone.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Nomor WhatsApp tujuan wajib diisi',
      });
    }

    // Ambil receiptConfig toko untuk template / custom Fonnte API Key
    const outletRow = await prisma.outlet.findUnique({
      where: { id: order.outletId },
      select: { name: true, address: true, phone: true, receiptConfig: true },
    });

    const sendResult = await whatsAppService.sendOrderReceipt(
      {
        invoiceNumber: order.invoiceNumber,
        queueNumber: order.queueNumber,
        createdAt: order.createdAt,
        customerName: order.customer?.name || null,
        customerPhone: targetPhone,
        outlet: {
          name: outletRow?.name || order.outlet?.name || 'Well POS Toko',
          address: outletRow?.address,
          phone: outletRow?.phone,
          receiptConfig: outletRow?.receiptConfig,
        },
        cashierName: order.cashier?.name,
        orderItems: (order.orderItems || []).map((item: any) => ({
          name: item.productName || item.name || 'Produk',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          subtotal: item.subtotal,
        })),
        subtotal: order.subtotal,
        discountAmount: order.discountAmount || order.discountTotal || 0,
        taxAmount: order.taxAmount || order.taxTotal || 0,
        serviceCharge: order.serviceCharge || order.serviceTotal || 0,
        grandTotal: order.grandTotal || order.totalAmount,
        payments: (order.payments || []).map((p: any) => ({
          method: p.method || p.paymentMethod || 'CASH',
          amountPaid: p.amountPaid || p.amount,
          changeGiven: p.changeGiven || 0,
        })),
      },
      targetPhone
    );

    if (sendResult.status === 'success') {
      return res.status(200).json({
        status: 'success',
        message: sendResult.message,
        data: sendResult,
      });
    } else {
      return res.status(400).json({
        status: 'error',
        message: sendResult.message,
        data: sendResult,
      });
    }
  } catch (error: any) {
    console.error('Error saat mengirim WhatsApp struk:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Gagal mengirim WhatsApp struk',
    });
  }
};

/**
 * Helper: Memastikan tabel antrean hold_orders tersedia di database (Self-Healing DDL)
 */
async function ensureHoldOrdersTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "hold_orders" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT,
        "outlet_id" TEXT NOT NULL,
        "cashier_id" TEXT NOT NULL,
        "customer_name" TEXT,
        "channel" TEXT DEFAULT 'DINE_IN',
        "note" TEXT,
        "cart_items" JSONB NOT NULL,
        "total_amount" NUMERIC NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.warn('[DB] ensureHoldOrdersTable notice:', err);
  }
}

/**
 * Skema validasi Tahan Pesanan (Hold Order)
 */
const holdOrderSchema = z.object({
  outletId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  channel: z.string().optional().default('DINE_IN'),
  tableNumber: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  items: z.array(z.any()).min(1, 'Item belanja tidak boleh kosong'),
  totalAmount: z.number().min(0),
  onDemandQuantities: z.record(z.string(), z.number()).optional().nullable(),
  appliedPromotion: z.any().optional().nullable(),
});

/**
 * Menyimpan draf pesanan kasir yang ditahan (Hold Order)
 * @route POST /api/orders/hold
 */
export const holdOrder = async (req: Request, res: Response) => {
  try {
    await ensureHoldOrdersTable();

    const parseResult = holdOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi data tahan pesanan gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const {
      outletId,
      customerName,
      channel,
      tableNumber,
      note,
      items,
      totalAmount,
      onDemandQuantities,
      appliedPromotion,
    } = parseResult.data;

    const cashierId = req.user?.id;
    if (!cashierId) {
      return res.status(401).json({ status: 'error', message: 'Kasir belum terautentikasi' });
    }

    const tenantId = req.user?.tenantId || req.tenantId || null;

    let targetOutletId = outletId || req.user?.outletId;
    if (!targetOutletId) {
      const def = tenantId
        ? await prisma.outlet.findFirst({
            where: { tenantId },
            select: { id: true },
          })
        : null;
      targetOutletId = def?.id;
    }

    if (!targetOutletId) {
      return res.status(400).json({ status: 'error', message: 'Outlet tidak ditemukan' });
    }

    // Bungkus metadata kemasan, kupon voucher promo, dan meja ke dalam cart_items JSONB
    const cartPayload = {
      items,
      onDemandQuantities: onDemandQuantities || {},
      appliedPromotion: appliedPromotion || null,
      tableNumber: tableNumber || null,
    };

    const newHoldId = crypto.randomUUID();

    const newHoldRows = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "hold_orders" (
        "id", "tenant_id", "outlet_id", "cashier_id", "customer_name", "channel", "note", "cart_items", "total_amount", "created_at", "updated_at"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, NOW(), NOW()
      ) RETURNING *;`,
      newHoldId,
      tenantId,
      targetOutletId,
      cashierId,
      customerName || `Antrean #${Date.now().toString().slice(-4)}`,
      channel || 'DINE_IN',
      note || null,
      JSON.stringify(cartPayload),
      totalAmount
    );

    return res.status(201).json({
      status: 'success',
      message: 'Pesanan berhasil ditahan di daftar antrean',
      data: newHoldRows[0],
    });
  } catch (error: any) {
    console.error('Error saat menahan pesanan:', error);
    return res.status(500).json({
      status: 'error',
      message: error?.message || 'Gagal menahan pesanan kasir',
    });
  }
};

/**
 * Mendapatkan daftar antrean pesanan tertahan
 * @route GET /api/orders/hold
 */
export const getHoldOrders = async (req: Request, res: Response) => {
  try {
    await ensureHoldOrdersTable();

    const outletId = (req.query.outletId as string) || req.user?.outletId;
    const tenantId = req.user?.tenantId || req.tenantId;

    const holdOrders = await prisma.$queryRawUnsafe<any[]>(
      `SELECT h.*, u.name as cashier_name
       FROM "hold_orders" h
       LEFT JOIN "users" u ON u.id = h.cashier_id
       WHERE ($1::text IS NULL OR h.outlet_id = $1)
         AND ($2::text IS NULL OR h.tenant_id = $2)
       ORDER BY h.created_at DESC;`,
      outletId || null,
      tenantId || null
    );

    const formatted = holdOrders.map((h) => {
      const rawPayload = h.cart_items;
      const isObjectPayload = rawPayload && !Array.isArray(rawPayload) && Array.isArray(rawPayload.items);
      const items = isObjectPayload ? rawPayload.items : (Array.isArray(rawPayload) ? rawPayload : []);
      const onDemandQuantities = isObjectPayload ? rawPayload.onDemandQuantities || {} : {};
      const appliedPromotion = isObjectPayload ? rawPayload.appliedPromotion || null : null;
      const tableNumber = isObjectPayload ? rawPayload.tableNumber || null : null;

      return {
        id: h.id,
        tenantId: h.tenant_id,
        outletId: h.outlet_id,
        cashierId: h.cashier_id,
        customerName: h.customer_name,
        channel: h.channel,
        note: h.note,
        cartItems: items,
        items,
        onDemandQuantities,
        appliedPromotion,
        tableNumber,
        totalAmount: Number(h.total_amount),
        createdAt: h.created_at,
        updatedAt: h.updated_at,
        cashier: { name: h.cashier_name },
      };
    });

    return res.status(200).json({
      status: 'success',
      data: formatted,
    });
  } catch (error: any) {
    console.error('Error saat mengambil pesanan tertahan:', error);
    return res.status(500).json({
      status: 'error',
      message: error?.message || 'Gagal mengambil daftar pesanan tertahan',
    });
  }
};

/**
 * Menghapus pesanan tertahan setelah dipanggil kembali atau dibatalkan
 * @route DELETE /api/orders/hold/:id
 */
export const deleteHoldOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId || null;

    // Fix B3: Tambahkan filter tenant_id untuk mencegah kasir dari tenant/outlet lain
    // menghapus hold order yang bukan miliknya.
    const result = await prisma.$queryRawUnsafe<any[]>(
      `DELETE FROM "hold_orders" WHERE id = $1 AND ($2::text IS NULL OR tenant_id = $2) RETURNING id;`,
      id,
      tenantId
    );

    if (!result || result.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Pesanan tertahan tidak ditemukan atau tidak dapat diakses' });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Pesanan tertahan berhasil diproses atau dibatalkan',
    });
  } catch (error) {
    console.error('Error saat menghapus pesanan tertahan:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus pesanan tertahan',
    });
  }
};

/**
 * Mengambil Kitchen Order Ticket (KOT) untuk kebutuhan dapur & barista
 * @route GET /api/orders/:id/kitchen-ticket
 */
export const getKitchenTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId || (req.headers['x-tenant-id'] as string) || null;

    const orders = await prisma.$queryRawUnsafe<any[]>(
      `SELECT o.id, o.invoice_number, o.order_type, o.table_number, o.notes as order_notes,
              o.order_status, o.created_at,
              out.name as outlet_name,
              u.name as cashier_name
       FROM "orders" o
       JOIN "outlets" out ON out.id = o.outlet_id
       LEFT JOIN "users" u ON u.id = o.cashier_id
       WHERE o.id = $1 ${tenantId ? 'AND o.tenant_id = $2' : ''}
       LIMIT 1;`,
      ...(tenantId ? [id, tenantId] : [id])
    );

    if (orders.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Pesanan tidak ditemukan' });
    }

    const order = orders[0];

    const items = await prisma.$queryRawUnsafe<any[]>(
      `SELECT oi.id, oi.product_name, oi.variant_name, oi.quantity, oi.notes,
              oi.modifiers_snapshot
       FROM "order_items" oi
       WHERE oi.order_id = $1
       ORDER BY oi.id ASC;`,
      id
    );

    return res.json({
      status: 'success',
      data: {
        ticketNumber: order.invoice_number,
        outletName: order.outlet_name,
        orderType: order.order_type || 'DINE_IN',
        tableNumber: order.table_number || null,
        cashierName: order.cashier_name || 'Kasir',
        orderNotes: order.order_notes || null,
        orderStatus: order.order_status,
        timestamp: order.created_at,
        items: items.map((item) => ({
          id: item.id,
          productName: item.product_name,
          variantName: item.variant_name,
          quantity: Number(item.quantity),
          notes: item.notes || null,
          modifiers: typeof item.modifiers_snapshot === 'string'
            ? JSON.parse(item.modifiers_snapshot)
            : item.modifiers_snapshot || [],
        })),
      },
    });
  } catch (error: any) {
    console.error('Error saat mengambil tiket dapur (KOT):', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

/**
 * Controller: Mendapatkan struk digital interaktif & teks siap kirim WhatsApp (EPIC-08)
 * @route GET /api/orders/:id/digital-receipt
 */
export const getDigitalReceipt = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user?.tenantId;

    const order = await prisma.order.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {}),
      },
      include: {
        outlet: true,
        cashier: { select: { id: true, name: true, userCode: true } },
        customer: true,
        promotion: true,
        items: true,
        payments: true,
      },
    });

    if (!order) {
      return res.status(404).json({ status: 'error', message: 'Pesanan tidak ditemukan' });
    }

    const formattedDate = new Date(order.createdAt).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const itemsText = order.items
      .map((i) => {
        const itemSub = Number(i.subtotal).toLocaleString('id-ID');
        const unitP = Number(i.unitPrice).toLocaleString('id-ID');
        return `${Number(i.quantity)}x ${i.productName}${i.variantName !== 'Default' ? ` (${i.variantName})` : ''} @Rp ${unitP}\n   = Rp ${itemSub}`;
      })
      .join('\n');

    const paymentText = order.payments
      .map((p) => `${p.paymentMethod}: Rp ${Number(p.amount).toLocaleString('id-ID')}`)
      .join(', ');

    const whatsAppText = [
      `*STRUK PEMBELIAN - ${order.outlet.name.toUpperCase()}*`,
      `================================`,
      `No. Faktur : ${order.invoiceNumber}`,
      `Tanggal    : ${formattedDate}`,
      `Kasir      : ${order.cashier.name}`,
      order.customer ? `Pelanggan  : ${order.customer.name} (${order.customer.tier})` : '',
      `--------------------------------`,
      itemsText,
      `--------------------------------`,
      `Subtotal   : Rp ${Number(order.subtotal).toLocaleString('id-ID')}`,
      order.promotion ? `Promo [${order.promotion.code}]: -Rp ${(Number(order.discountTotal) - Number(order.pointDiscountAmount)).toLocaleString('id-ID')}` : '',
      order.pointsRedeemed > 0 ? `Tukar Poin (${order.pointsRedeemed} pt): -Rp ${Number(order.pointDiscountAmount).toLocaleString('id-ID')}` : '',
      Number(order.taxTotal) > 0 ? `Pajak      : Rp ${Number(order.taxTotal).toLocaleString('id-ID')}` : '',
      Number(order.serviceTotal) > 0 ? `Service    : Rp ${Number(order.serviceTotal).toLocaleString('id-ID')}` : '',
      `*TOTAL      : Rp ${Number(order.totalAmount).toLocaleString('id-ID')}*`,
      `Pembayaran : ${paymentText}`,
      order.pointsEarned > 0 ? `\n🎉 Poin Diperoleh: +${order.pointsEarned} Poin` : '',
      order.customer ? `Total Poin Anda : ${order.customer.loyaltyPoints} Poin (${order.customer.tier})` : '',
      `================================`,
      `Terima kasih atas kunjungan Anda!`,
    ]
      .filter((line) => line !== '')
      .join('\n');

    const whatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsAppText)}`;

    return res.status(200).json({
      status: 'success',
      data: {
        order,
        receipt: {
          invoiceNumber: order.invoiceNumber,
          outletName: order.outlet.name,
          outletAddress: order.outlet.address,
          outletPhone: order.outlet.phone,
          cashierName: order.cashier.name,
          customer: order.customer
            ? {
                name: order.customer.name,
                phone: order.customer.phone,
                tier: order.customer.tier,
                currentPoints: order.customer.loyaltyPoints,
              }
            : null,
          formattedDate,
          items: order.items,
          subtotal: Number(order.subtotal),
          discountTotal: Number(order.discountTotal),
          pointDiscountAmount: Number(order.pointDiscountAmount),
          pointsEarned: order.pointsEarned,
          pointsRedeemed: order.pointsRedeemed,
          totalAmount: Number(order.totalAmount),
          payments: order.payments,
          shareableWhatsAppText: whatsAppText,
          whatsAppUrl,
        },
      },
    });
  } catch (error: any) {
    console.error('Error in getDigitalReceipt:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal membuat struk digital', error: error.message });
  }
};

/**
 * Controller: Kirim Struk Digital via WhatsApp / Email (Simulator Payload)
 * @route POST /api/orders/:id/send-receipt
 */
export const sendDigitalReceipt = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { recipientPhone, recipientEmail, method = 'WHATSAPP' } = req.body;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { outlet: true, customer: true },
    });

    if (!order) {
      return res.status(404).json({ status: 'error', message: 'Pesanan tidak ditemukan' });
    }

    const targetPhone = recipientPhone || order.customer?.phone;
    const targetEmail = recipientEmail || order.customer?.email;

    return res.status(200).json({
      status: 'success',
      message: `Struk digital berhasil dikirim via ${method}`,
      deliveryDetails: {
        orderId: order.id,
        invoiceNumber: order.invoiceNumber,
        method,
        sentTo: method === 'WHATSAPP' ? targetPhone : targetEmail,
        timestamp: new Date(),
        status: 'DELIVERED',
      },
    });
  } catch (error: any) {
    console.error('Error in sendDigitalReceipt:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengirim struk digital', error: error.message });
  }
};

/**
 * Skema validasi untuk Buka Tagihan Meja (Open Tab)
 */
const openTabSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Pesanan harus memiliki minimal 1 produk'),
  channel: z.string().optional().default('DINE_IN'),
  orderType: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'RETAIL']).optional().default('DINE_IN'),
  tableNumber: z.string().optional().nullable(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  discountAmount: z.number().min(0).default(0),
  taxRate: z.number().min(0).max(1).default(0),
  taxAmount: z.number().min(0).optional(),
  serviceCharge: z.number().min(0).default(0),
  shiftId: z.string().optional().nullable(),
  outletId: z.string().optional().nullable(),
  existingOrderId: z.string().optional().nullable(),
});

/**
 * Controller: Buka Tagihan Meja / Simpan Pesanan Tanpa Pembayaran Langsung (Open Tab)
 * @route POST /api/orders/open-tab
 */
export const createOpenTabOrder = async (req: Request, res: Response) => {
  try {
    const parseResult = openTabSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Data tagihan meja tidak valid',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const {
      items,
      channel = 'DINE_IN',
      orderType = 'DINE_IN',
      tableNumber,
      customerName,
      customerPhone,
      customerId,
      notes,
      discountAmount = 0,
      taxRate = 0,
      taxAmount: explicitTaxAmount,
      serviceCharge = 0,
      shiftId,
      outletId: bodyOutletId,
      existingOrderId,
    } = parseResult.data;

    let tenantId = req.user?.tenantId || req.tenantId || (req.headers['x-tenant-id'] as string) || null;
    let targetOutletId = bodyOutletId || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = tenantId
        ? await prisma.outlet.findFirst({
            where: { tenantId },
            select: { id: true },
          })
        : null;
      targetOutletId = defaultOutlet?.id;
    }

    if (!targetOutletId) {
      return res.status(400).json({ status: 'error', message: 'Toko / outlet tidak ditemukan' });
    }

    if (!tenantId && targetOutletId) {
      const outlet = await prisma.outlet.findUnique({
        where: { id: targetOutletId },
        select: { tenantId: true },
      });
      tenantId = outlet?.tenantId || null;
    }

    const cashierId = req.user?.id;
    if (!cashierId) {
      return res.status(401).json({ status: 'error', message: 'Kasir belum terautentikasi' });
    }

    // Resolusi shift aktif kasir jika tidak dikirim
    let resolvedShiftId = shiftId;
    if (!resolvedShiftId) {
      const activeShifts = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM "shifts" WHERE cashier_id = $1 AND status = 'OPEN' LIMIT 1;`,
        cashierId
      );
      if (activeShifts && activeShifts.length > 0) {
        resolvedShiftId = activeShifts[0].id;
      }
    }

    const cleanTable = tableNumber?.trim() || null;

    // Cek jika order sudah ada (misal update open tab / update pesanan QR meja)
    let isUpdate = false;
    let targetOrderId = existingOrderId || null;
    let currentInvoiceNumber = '';

    if (targetOrderId) {
      const existingRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, invoice_number, table_number, channel FROM "orders" WHERE id = $1 AND tenant_id = $2 LIMIT 1;`,
        targetOrderId,
        tenantId
      );
      if (existingRows && existingRows.length > 0) {
        isUpdate = true;
        currentInvoiceNumber = existingRows[0].invoice_number;
      } else {
        targetOrderId = null; // fallback buat order baru jika ID tidak ditemukan
      }
    }

    // Proteksi: Jika order baru (bukan update), cegah pemilihan meja yang sudah terisi / aktif
    if (!isUpdate && cleanTable) {
      const occupiedMeja = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, invoice_number, channel, notes
         FROM "orders"
         WHERE outlet_id = $1 AND tenant_id = $2 AND table_number = $3
           AND payment_status = 'UNPAID'
           AND order_status NOT IN ('CANCELLED', 'VOIDED')
         LIMIT 1;`,
        targetOutletId,
        tenantId,
        cleanTable
      );

      if (occupiedMeja.length > 0) {
        const occ = occupiedMeja[0];
        return res.status(400).json({
          status: 'error',
          message: `Meja ${cleanTable} saat ini sedang aktif digunakan (${occ.notes || 'Tagihan Aktif'} • #${occ.invoice_number}). Silakan selesaikan tagihan meja tersebut atau pilih meja kosong lainnya.`,
        });
      }
    }

    // Ambil data produk dari database
    const productIds = items.map((i) => i.productId);
    const productsInDb = await prisma.$queryRawUnsafe<any[]>(
      `SELECT p.id, p.name, p.unit, COALESCE(pv.price, 0) as "basePrice",
              pv.id as "variantId", pv.name as "variantName"
       FROM "products" p
       LEFT JOIN "product_variants" pv ON pv.product_id = p.id AND pv.is_active = true
       WHERE p.id = ANY($1::text[]) AND p.is_active = true AND ($2::text IS NULL OR p.tenant_id = $2);`,
      productIds,
      tenantId
    );

    const productMap = new Map(productsInDb.map((p) => [p.id, p]));

    let subtotal = 0;
    const preparedItems = items.map((item) => {
      const p = productMap.get(item.productId);
      const unitPrice = Number(p?.basePrice || 0);
      const itemSubtotal = (unitPrice - (item.discountAmount || 0)) * item.quantity;
      subtotal += itemSubtotal;
      return {
        productId: item.productId,
        productName: p?.name || 'Produk',
        variantId: item.variantId || p?.variantId || null,
        variantName: p?.variantName || 'Standar',
        quantity: item.quantity,
        unitPrice,
        discountAmount: item.discountAmount || 0,
        subtotal: itemSubtotal,
        notes: item.notes || null,
      };
    });

    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const taxableSubtotal = discountedSubtotal + serviceCharge;
    const taxAmount = explicitTaxAmount !== undefined ? explicitTaxAmount : Math.round(taxableSubtotal * taxRate);
    const grandTotal = taxableSubtotal + taxAmount;

    const orderNotes = notes || (cleanTable ? `Meja ${cleanTable}` : null);
    const finalCustomerName = customerName?.trim() || (cleanTable ? `Tamu Meja ${cleanTable}` : 'Pelanggan');

    if (isUpdate && targetOrderId) {
      // MODE UPDATE: Perbarui order yang sudah ada (tambahkan pesanan susulan via kasir)
      let openTabNotes = orderNotes;
      if (finalCustomerName && (!openTabNotes || !openTabNotes.includes(finalCustomerName))) {
        openTabNotes = openTabNotes ? `${openTabNotes} (Pelanggan: ${finalCustomerName})` : `Pelanggan: ${finalCustomerName}`;
      }

      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `UPDATE "orders" SET
            "subtotal" = $1,
            "discount_amount" = $2,
            "tax_amount" = $3,
            "service_total" = $4,
            "grand_total" = $5,
            "notes" = COALESCE($6, notes),
            "shift_id" = COALESCE($7, shift_id),
            "table_number" = COALESCE($8, table_number),
            "updated_at" = CURRENT_TIMESTAMP
          WHERE id = $9 AND tenant_id = $10;`,
          subtotal,
          discountAmount,
          taxAmount,
          serviceCharge,
          grandTotal,
          openTabNotes,
          resolvedShiftId || null,
          cleanTable,
          targetOrderId,
          tenantId
        );

        // Timpa daftar item dengan item terkini yang lengkap
        await tx.$executeRawUnsafe(`DELETE FROM "order_items" WHERE "order_id" = $1;`, targetOrderId);

        for (const item of preparedItems) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "order_items" (
              "id", "tenant_id", "order_id", "product_variant_id",
              "product_name", "variant_name", "quantity", "cost_price", "unit_price", "discount_amount", "subtotal", "notes"
            ) VALUES (
              $1, $2, $3, $4,
              $5, $6, $7, $8, $9, $10, $11, $12
            );`,
            crypto.randomUUID(),
            tenantId,
            targetOrderId,
            item.variantId,
            item.productName,
            item.variantName,
            item.quantity,
            0,
            item.unitPrice,
            item.discountAmount,
            item.subtotal,
            item.notes
          );
        }
      });

      return res.status(200).json({
        status: 'success',
        message: `Tagihan Meja ${cleanTable || ''} (#${currentInvoiceNumber}) berhasil diperbarui & dikirim ke dapur.`,
        data: {
          id: targetOrderId,
          invoiceNumber: currentInvoiceNumber,
          outletId: targetOutletId,
          tableNumber: cleanTable,
          customerName: finalCustomerName,
          customerPhone: customerPhone?.trim() || null,
          grandTotal,
          itemsCount: preparedItems.reduce((acc, i) => acc + i.quantity, 0),
          orderStatus: 'IN_PROGRESS',
          paymentStatus: 'UNPAID',
          updatedAt: new Date().toISOString(),
        },
      });
    }

    // MODE BARU: Buat order open tab baru
    const invoiceNumber = await generateInvoiceNumber(targetOutletId);
    const orderId = crypto.randomUUID();

    let openTabNotes = orderNotes;
    if (finalCustomerName && (!openTabNotes || !openTabNotes.includes(finalCustomerName))) {
      openTabNotes = openTabNotes ? `${openTabNotes} (Pelanggan: ${finalCustomerName})` : `Pelanggan: ${finalCustomerName}`;
    }

    // Cek konfigurasi nomor antrean outlet
    const outletInfoRows = await prisma.$queryRawUnsafe<{ receipt_config: any }[]>(
      `SELECT receipt_config FROM "outlets" WHERE id = $1 LIMIT 1;`,
      targetOutletId
    );
    const isQueueNumberEnabled = outletInfoRows[0]?.receipt_config?.showQueueNumber !== false;
    let openTabQueueNumber: number | null = null;
    let hasQueueColumn = true;
    if (isQueueNumberEnabled) {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const queueResult = await prisma.$queryRawUnsafe<{ next_queue: number }[]>(
          `SELECT (COALESCE(MAX(queue_number), 0) + 1)::int as next_queue 
           FROM "orders" 
           WHERE tenant_id = $1 AND outlet_id = $2 AND created_at >= ($3 AT TIME ZONE 'UTC');`,
          tenantId,
          targetOutletId,
          todayStart
        );
        openTabQueueNumber = queueResult[0]?.next_queue || 1;
      } catch (err: any) {
        if (err.message && err.message.includes('queue_number')) {
          hasQueueColumn = false;
          openTabQueueNumber = null;
        } else {
          throw err;
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      if (hasQueueColumn) {
        try {
          await tx.$executeRawUnsafe(
            `INSERT INTO "orders" (
              "id", "tenant_id", "outlet_id", "cashier_id", "invoice_number", "queue_number",
              "customer_id", "shift_id",
              "subtotal", "discount_amount", "tax_amount", "service_total", "grand_total",
              "payment_status", "channel", "order_type", "table_number", "notes", "order_status", "created_at", "updated_at"
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8,
              $9, $10, $11, $12, $13,
              'UNPAID'::"PaymentStatus", $14, $15, $16, $17, 'IN_PROGRESS'::"OrderStatus", (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC')
            );`,
            orderId,
            tenantId,
            targetOutletId,
            cashierId,
            invoiceNumber,
            openTabQueueNumber,
            customerId || null,
            resolvedShiftId || null,
            subtotal,
            discountAmount,
            taxAmount,
            serviceCharge,
            grandTotal,
            channel,
            orderType,
            cleanTable,
            openTabNotes
          );
        } catch (err: any) {
          if (err.message && err.message.includes('queue_number')) {
            hasQueueColumn = false;
            await tx.$executeRawUnsafe(
              `INSERT INTO "orders" (
                "id", "tenant_id", "outlet_id", "cashier_id", "invoice_number",
                "customer_id", "shift_id",
                "subtotal", "discount_amount", "tax_amount", "service_total", "grand_total",
                "payment_status", "channel", "order_type", "table_number", "notes", "order_status", "created_at", "updated_at"
              ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7,
                $8, $9, $10, $11, $12,
                'UNPAID'::"PaymentStatus", $13, $14, $15, $16, 'IN_PROGRESS'::"OrderStatus", (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC')
              );`,
              orderId,
              tenantId,
              targetOutletId,
              cashierId,
              invoiceNumber,
              customerId || null,
              resolvedShiftId || null,
              subtotal,
              discountAmount,
              taxAmount,
              serviceCharge,
              grandTotal,
              channel,
              orderType,
              cleanTable,
              openTabNotes
            );
          } else {
            throw err;
          }
        }
      } else {
        await tx.$executeRawUnsafe(
          `INSERT INTO "orders" (
            "id", "tenant_id", "outlet_id", "cashier_id", "invoice_number",
            "customer_id", "shift_id",
            "subtotal", "discount_amount", "tax_amount", "service_total", "grand_total",
            "payment_status", "channel", "order_type", "table_number", "notes", "order_status", "created_at", "updated_at"
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7,
            $8, $9, $10, $11, $12,
            'UNPAID'::"PaymentStatus", $13, $14, $15, $16, 'IN_PROGRESS'::"OrderStatus", (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC')
          );`,
          orderId,
          tenantId,
          targetOutletId,
          cashierId,
          invoiceNumber,
          customerId || null,
          resolvedShiftId || null,
          subtotal,
          discountAmount,
          taxAmount,
          serviceCharge,
          grandTotal,
          channel,
          orderType,
          cleanTable,
          openTabNotes
        );
      }

      for (const item of preparedItems) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "order_items" (
            "id", "tenant_id", "order_id", "product_variant_id",
            "product_name", "variant_name", "quantity", "cost_price", "unit_price", "discount_amount", "subtotal", "notes"
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8, $9, $10, $11, $12
          );`,
          crypto.randomUUID(),
          tenantId,
          orderId,
          item.variantId,
          item.productName,
          item.variantName,
          item.quantity,
          0,
          item.unitPrice,
          item.discountAmount,
          item.subtotal,
          item.notes
        );
      }
    });

    return res.status(201).json({
      status: 'success',
      message: `Tagihan Meja ${cleanTable || ''} berhasil disimpan & dikirim ke dapur.`,
      data: {
        id: orderId,
        invoiceNumber,
        outletId: targetOutletId,
        tableNumber: cleanTable,
        customerName: finalCustomerName,
        customerPhone: customerPhone?.trim() || null,
        grandTotal,
        itemsCount: preparedItems.reduce((acc, i) => acc + i.quantity, 0),
        orderStatus: 'IN_PROGRESS',
        paymentStatus: 'UNPAID',
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error saat membuat tagihan meja terbuka (open-tab):', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal membuat tagihan meja terbuka',
      error: error.message,
    });
  }
};

/**
 * Controller: Daftar Tagihan Meja Terbuka (Open Tabs / Unpaid Orders)
 * @route GET /api/orders/open-tabs
 */
export const getOpenTabs = async (req: Request, res: Response) => {
  try {
    const outletId = (req.query.outletId as string) || req.user?.outletId;
    const tenantId = req.user?.tenantId || req.tenantId;

    const orders = await prisma.$queryRawUnsafe<any[]>(
      `SELECT o.*, u.name as cashier_name, c.name as customer_name, c.phone as customer_phone
       FROM "orders" o
       LEFT JOIN "users" u ON u.id = o.cashier_id
       LEFT JOIN "customers" c ON c.id = o.customer_id
       WHERE ($1::text IS NULL OR o.outlet_id = $1)
         AND ($2::text IS NULL OR o.tenant_id = $2)
         AND o.payment_status = 'UNPAID'
         AND o.order_status NOT IN ('CANCELLED', 'VOIDED')
         AND (o.channel != 'QR_MENU' OR o.channel IS NULL)
       ORDER BY o.created_at DESC;`,
      outletId || null,
      tenantId || null
    );

    const orderIds = orders.map((o) => o.id);
    let itemsByOrderId: Record<string, any[]> = {};

    if (orderIds.length > 0) {
      const allItems = await prisma.$queryRawUnsafe<any[]>(
        `SELECT oi.*, p.id as prod_id, p.name as prod_name, pv.name as var_name
         FROM "order_items" oi
         LEFT JOIN "product_variants" pv ON pv.id = oi.product_variant_id
         LEFT JOIN "products" p ON p.id = pv.product_id
         WHERE oi.order_id = ANY($1::text[])
         ORDER BY oi.id ASC;`,
        orderIds
      );

      for (const item of allItems) {
        if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
        itemsByOrderId[item.order_id].push({
          id: item.id,
          productId: item.prod_id || item.product_variant_id,
          variantId: item.product_variant_id,
          productName: item.product_name || item.prod_name || 'Produk',
          variantName: item.variant_name || item.var_name || null,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          discountAmount: Number(item.discount_amount || 0),
          subtotal: Number(item.subtotal),
          notes: item.notes,
        });
      }
    }

    const formatted = orders.map((o) => {
      let derivedCustomerName = o.customer_name;
      if (!derivedCustomerName && o.notes) {
        const guestMatch = o.notes.match(/Tamu:\s*([^|(]+)/i) || o.notes.match(/Pelanggan:\s*([^|(]+)/i);
        if (guestMatch) {
          derivedCustomerName = guestMatch[1].trim();
        }
      }

      return {
        id: o.id,
        invoiceNumber: o.invoice_number,
        queueNumber: o.queue_number ? Number(o.queue_number) : null,
        outletId: o.outlet_id,
        cashierId: o.cashier_id,
        customerName: derivedCustomerName || 'Pelanggan Umum',
        customerPhone: o.customer_phone || null,
        channel: o.channel,
        tableNumber: o.table_number,
        notes: o.notes,
        subtotal: Number(o.subtotal),
        discountAmount: Number(o.discount_amount || 0),
        taxAmount: Number(o.tax_amount || 0),
        serviceCharge: Number(o.service_total || 0),
        grandTotal: Number(o.grand_total),
        orderStatus: o.order_status,
        paymentStatus: o.payment_status,
        createdAt: o.created_at,
        cashier: { name: o.cashier_name },
        items: itemsByOrderId[o.id] || [],
      };
    });

    return res.status(200).json({ status: 'success', data: formatted });
  } catch (error: any) {
    console.error('Error in getOpenTabs:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil daftar tagihan meja' });
  }
};

/**
 * Controller: Batalkan Tagihan Meja Terbuka (Cancel Open Tab)
 * @route POST /api/orders/:id/cancel-tab
 */
export const cancelOpenTab = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const tenantId = req.user?.tenantId || req.tenantId;

    // Fix B2: Hanya SUPERVISOR atau ADMIN yang boleh membatalkan tagihan meja terbuka.
    const userRole = req.user?.role;
    if (userRole !== 'SUPERVISOR' && userRole !== 'ADMIN' && userRole !== 'OWNER') {
      return res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN_ROLE',
        message: 'Pembatalan tagihan meja hanya dapat dilakukan oleh Supervisor atau Admin. Hubungi supervisor Anda.',
      });
    }

    const orderRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT outlet_id, table_number FROM "orders" WHERE id = $1 AND ($2::text IS NULL OR tenant_id = $2) LIMIT 1;`,
      id,
      tenantId || null
    );

    await prisma.$executeRawUnsafe(
      `UPDATE "orders" 
       SET "order_status"   = 'CANCELLED'::"OrderStatus",
           "notes"          = CONCAT(COALESCE("notes", ''), ' [Dibatalkan Kasir: ', $2::text, ']'),
           "updated_at"     = CURRENT_TIMESTAMP
       WHERE "id" = $1 AND ($3::text IS NULL OR "tenant_id" = $3);`,
      id,
      reason || 'Dibatalkan oleh kasir',
      tenantId || null
    );

    // Rilis meja hanya jika data order ditemukan dan ada nomor meja & tenantId valid.
    // Catatan: payment_status tetap 'UNPAID' karena enum tidak memiliki nilai CANCELLED.
    // Semua query sinkronisasi meja sudah menyertakan filter order_status NOT IN ('CANCELLED', 'VOIDED')
    // sehingga order yang dibatalkan TIDAK akan dianggap sebagai pesanan aktif.
    if (orderRows.length > 0 && orderRows[0].table_number && orderRows[0].outlet_id && tenantId) {
      try {
        await qrMenuService.releaseTableIfNoActiveOrders(
          tenantId,
          orderRows[0].outlet_id,
          orderRows[0].table_number
        );
      } catch (tblErr) {
        console.warn('Gagal mereset status meja pasca cancel open tab:', tblErr);
      }
    }

    return res.json({ status: 'success', message: 'Tagihan meja berhasil dibatalkan' });
  } catch (err: any) {
    console.error('Error in cancelOpenTab:', err);
    return res.status(500).json({ status: 'error', message: 'Gagal membatalkan tagihan meja' });
  }
};

/**
 * Void transaksi yang sudah dibuat / selesai
 * Memerlukan approval PIN dari Owner atau Supervisor.
 */
export const voidOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { pin, reason, notes } = req.body;
    const tenantId = (req as any).tenantId;
    const currentUser = (req as any).user;

    if (!id) {
      return res.status(400).json({ status: 'error', message: 'ID transaksi wajib disertakan' });
    }

    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      return res.status(400).json({ status: 'error', message: 'Alasan pembatalan (void) wajib diisi' });
    }

    // 1. Validasi Otorisasi / Approval PIN dari Supervisor atau Owner
    const isPrivilegedUser = currentUser && [Role.SUPERVISOR, Role.ADMIN, Role.OWNER].includes(currentUser.role);
    let approvedByUser: { id: string; name: string; role: Role } | null = null;

    if (pin && typeof pin === 'string' && pin.trim().length > 0) {
      // Cari supervisor / admin / owner aktif pada tenant ini yang memiliki PIN cocok
      const spvCandidates = await prisma.user.findMany({
        where: {
          tenantId: tenantId || undefined,
          role: { in: [Role.SUPERVISOR, Role.ADMIN, Role.OWNER] },
          isActive: true,
          pinHash: { not: null },
        },
        select: { id: true, name: true, role: true, pinHash: true },
      });

      for (const spv of spvCandidates) {
        if (spv.pinHash && (await bcrypt.compare(pin.trim(), spv.pinHash))) {
          approvedByUser = { id: spv.id, name: spv.name, role: spv.role };
          break;
        }
      }

      if (!approvedByUser) {
        return res.status(401).json({
          status: 'error',
          message: 'PIN Supervisor atau Owner tidak valid',
        });
      }
    } else if (isPrivilegedUser) {
      // Pengguna saat ini sudah berstatus Supervisor/Admin/Owner dan melakukan void langsung
      approvedByUser = { id: currentUser.id, name: currentUser.name || currentUser.email, role: currentUser.role };
    } else {
      return res.status(403).json({
        status: 'error',
        message: 'PIN persetujuan dari Supervisor atau Owner wajib dimasukkan',
      });
    }

    // 2. Cari order yang akan di-void
    const order = await prisma.order.findFirst({
      where: {
        id,
        tenantId: tenantId || undefined,
      },
      include: {
        items: true,
        payments: true,
        customer: true,
        promotion: true,
      },
    });

    if (!order) {
      return res.status(404).json({ status: 'error', message: 'Transaksi tidak ditemukan' });
    }

    if (order.orderStatus === OrderStatus.VOIDED) {
      return res.status(400).json({ status: 'error', message: 'Transaksi ini sudah dibatalkan (VOIDED) sebelumnya' });
    }

    const approverLabel = `${approvedByUser.name} (${approvedByUser.role})`;
    const voidAuditTag = `[VOID: ${reason.trim()}${notes ? ` - ${notes.trim()}` : ''} | Disetujui: ${approverLabel}]`;

    // 3. Eksekusi Pembatalan dan Pemulihan Stok dalam Database Transaction
    await prisma.$transaction(async (tx) => {
      // A. Ambil semua ledger stok keluar (quantity_delta < 0) yang terkait dengan order ini
      const deductedLedgers = await tx.inventoryLedger.findMany({
        where: {
          tenantId: order.tenantId,
          referenceType: 'ORDER',
          referenceId: order.id,
          quantityDelta: { lt: 0 },
        },
      });

      // B. Kembalikan stok ke inventory_balances dan catat compensating ledger dengan movementType VOID
      for (const ledger of deductedLedgers) {
        const returnQty = Math.abs(Number(ledger.quantityDelta));

        // Cari balance terkini
        const currentBalance = await tx.inventoryBalance.findFirst({
          where: {
            tenantId: order.tenantId,
            inventoryItemId: ledger.inventoryItemId,
            storageLocationId: ledger.storageLocationId,
            inventoryBatchId: ledger.inventoryBatchId,
          },
        });

        const balBefore = currentBalance ? Number(currentBalance.quantityOnHand) : 0;
        const balAfter = balBefore + returnQty;

        if (currentBalance) {
          await tx.inventoryBalance.update({
            where: { id: currentBalance.id },
            data: {
              quantityOnHand: balAfter,
              updatedAt: new Date(),
            },
          });
        } else {
          await tx.inventoryBalance.create({
            data: {
              tenantId: order.tenantId,
              inventoryItemId: ledger.inventoryItemId,
              storageLocationId: ledger.storageLocationId,
              inventoryBatchId: ledger.inventoryBatchId,
              quantityOnHand: returnQty,
              quantityReserved: 0,
            },
          });
        }

        // Catat InventoryLedger pembalik dengan movement_type 'VOID'
        await tx.inventoryLedger.create({
          data: {
            tenantId: order.tenantId,
            inventoryItemId: ledger.inventoryItemId,
            storageLocationId: ledger.storageLocationId,
            inventoryBatchId: ledger.inventoryBatchId,
            quantityDelta: returnQty,
            balanceBefore: balBefore,
            balanceAfter: balAfter,
            unitCost: ledger.unitCost,
            movementType: StockMovementType.VOID,
            referenceType: 'ORDER',
            referenceId: order.id,
            actorType: 'USER',
            actorUserId: approvedByUser?.id || currentUser?.id || null,
            isNegativeBalance: balAfter < 0,
            notes: `Pemulihan stok transaksi void faktur ${order.invoiceNumber}: ${reason.trim()}`,
          },
        });
      }

      // C. Update status Order ke VOIDED dan Payment ke REFUNDED
      await tx.order.update({
        where: { id: order.id },
        data: {
          orderStatus: OrderStatus.VOIDED,
          paymentStatus: PaymentStatus.REFUNDED,
          notes: order.notes ? `${order.notes} ${voidAuditTag}` : voidAuditTag,
          updatedAt: new Date(),
        },
      });

      // D. Update payment_transactions ke REFUNDED
      await tx.paymentTransaction.updateMany({
        where: { orderId: order.id, tenantId: order.tenantId },
        data: {
          status: PaymentTxStatus.REFUNDED,
        },
      });

      // E. Buat entri audit di tabel refunds
      const upperReason = reason.toUpperCase();
      let refundReasonEnum: RefundReason = RefundReason.CUSTOMER_RETURN;
      if (upperReason.includes('ITEM') || upperReason.includes('SALAH') || upperReason.includes('PRODUK')) {
        refundReasonEnum = RefundReason.WRONG_ITEM;
      } else if (upperReason.includes('BAYAR') || upperReason.includes('HARGA') || upperReason.includes('KASIR')) {
        refundReasonEnum = RefundReason.BILLING_ERROR;
      }

      const refundNumber = `REF-${order.invoiceNumber}-${Date.now().toString().slice(-4)}`;
      const createdRefund = await tx.refund.create({
        data: {
          tenantId: order.tenantId,
          orderId: order.id,
          refundNumber,
          amount: order.totalAmount,
          reason: refundReasonEnum,
          notes: `Void disetujui: ${approverLabel}. Alasan: ${reason.trim()}${notes ? ` | Catatan: ${notes.trim()}` : ''}`,
        },
      });

      // Catat refund items jika ada item
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          await tx.refundItem.create({
            data: {
              tenantId: order.tenantId,
              refundId: createdRefund.id,
              orderItemId: item.id,
              quantity: item.quantity,
              amount: item.subtotal,
              restockItem: true,
            },
          });
        }
      }

      // F. Kembalikan / sesuaikan loyalty points jika transaksi terikat dengan customer
      if (order.customerId) {
        const cust = await tx.customer.findUnique({ where: { id: order.customerId } });
        if (cust) {
          let currentCustPts = Number(cust.loyaltyPoints || 0);

          // 1) Kembalikan poin yang ditukar untuk diskon
          if (Number(order.pointDiscountAmount || 0) > 0) {
            const redeemedPts = Math.round(Number(order.pointDiscountAmount) / LoyaltyService.POINT_VALUE_IDR);
            if (redeemedPts > 0) {
              const before = currentCustPts;
              currentCustPts += redeemedPts;
              await tx.customer.update({
                where: { id: cust.id },
                data: { loyaltyPoints: currentCustPts },
              });
              await tx.customerPointLedger.create({
                data: {
                  tenantId: order.tenantId,
                  customerId: cust.id,
                  orderId: order.id,
                  deltaPoints: redeemedPts,
                  balanceBefore: before,
                  balanceAfter: currentCustPts,
                  type: PointTxType.MANUAL_ADJUSTMENT,
                  notes: `Pengembalian ${redeemedPts} poin dari void transaksi ${order.invoiceNumber}`,
                },
              });
            }
          }

          // 2) Batalkan poin yang didapat saat pembelian
          const earnedLedgers = await tx.customerPointLedger.findMany({
            where: {
              tenantId: order.tenantId,
              customerId: cust.id,
              orderId: order.id,
              type: PointTxType.EARNED_PURCHASE,
            },
          });

          for (const el of earnedLedgers) {
            const ptsToDeduct = Math.abs(Number(el.deltaPoints));
            if (ptsToDeduct > 0) {
              const before = currentCustPts;
              currentCustPts = Math.max(0, currentCustPts - ptsToDeduct);
              await tx.customer.update({
                where: { id: cust.id },
                data: { loyaltyPoints: currentCustPts },
              });
              await tx.customerPointLedger.create({
                data: {
                  tenantId: order.tenantId,
                  customerId: cust.id,
                  orderId: order.id,
                  deltaPoints: -ptsToDeduct,
                  balanceBefore: before,
                  balanceAfter: currentCustPts,
                  type: PointTxType.REFUND_DEDUCT,
                  notes: `Penarikan poin pembelian karena transaksi void ${order.invoiceNumber}`,
                },
              });
            }
          }
        }
      }

      // G. Pulihkan kuota penggunaan promo jika transaksi menggunakan promo
      if (order.promotionId) {
        await tx.promotion.updateMany({
          where: { tenantId: order.tenantId, id: order.promotionId, usageCount: { gt: 0 } },
          data: { usageCount: { decrement: 1 } },
        });
        await tx.promotionUsage.deleteMany({
          where: { tenantId: order.tenantId, orderId: order.id },
        });
      }
    });

    // 4. Meja: Lepaskan meja jika sebelumnya terikat pada pesanan ini
    if (order.tableNumber && order.outletId) {
      try {
        await qrMenuService.releaseTableIfNoActiveOrders(
          order.tenantId,
          order.outletId,
          order.tableNumber
        );
      } catch (tblErr) {
        console.warn('Gagal mereset status meja pasca void order:', tblErr);
      }
    }

    return res.json({
      status: 'success',
      message: `Transaksi ${order.invoiceNumber} berhasil dibatalkan (VOID)`,
      data: {
        orderId: order.id,
        invoiceNumber: order.invoiceNumber,
        status: OrderStatus.VOIDED,
        approvedBy: approverLabel,
      },
    });
  } catch (err: any) {
    console.error('Error in voidOrder:', err);
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Gagal memproses pembatalan (void) transaksi',
    });
  }
};

/**
 * Void / Retur Sebagian Item Pesanan (Item-Level Partial Void with Supervisor PIN)
 * @route POST /api/orders/:id/void-item
 */
export const voidOrderItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { orderItemId, quantityToVoid, pin, reason, notes } = req.body;
    const tenantId = (req as any).tenantId;
    const currentUser = (req as any).user;

    if (!id || !orderItemId) {
      return res.status(400).json({ status: 'error', message: 'ID transaksi dan ID item pesanan wajib disertakan' });
    }

    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      return res.status(400).json({ status: 'error', message: 'Alasan pembatalan item wajib diisi' });
    }

    // 1. Validasi Otorisasi / Approval PIN dari Supervisor atau Owner
    const isPrivilegedUser = currentUser && [Role.SUPERVISOR, Role.ADMIN, Role.OWNER].includes(currentUser.role);
    let approvedByUser: { id: string; name: string; role: Role } | null = null;

    if (pin && typeof pin === 'string' && pin.trim().length > 0) {
      const spvCandidates = await prisma.user.findMany({
        where: {
          tenantId: tenantId || undefined,
          role: { in: [Role.SUPERVISOR, Role.ADMIN, Role.OWNER] },
          isActive: true,
          pinHash: { not: null },
        },
        select: { id: true, name: true, role: true, pinHash: true },
      });

      for (const spv of spvCandidates) {
        if (spv.pinHash && (await bcrypt.compare(pin.trim(), spv.pinHash))) {
          approvedByUser = { id: spv.id, name: spv.name, role: spv.role };
          break;
        }
      }

      if (!approvedByUser) {
        return res.status(401).json({ status: 'error', message: 'PIN Supervisor atau Owner tidak valid' });
      }
    } else if (isPrivilegedUser) {
      approvedByUser = { id: currentUser.id, name: currentUser.name || currentUser.email, role: currentUser.role };
    } else {
      return res.status(403).json({ status: 'error', message: 'PIN persetujuan dari Supervisor atau Owner wajib dimasukkan' });
    }

    // 2. Ambil detail pesanan & item target
    const order = await prisma.order.findFirst({
      where: { id, tenantId: tenantId || undefined },
      include: {
        items: true,
        payments: true,
      },
    });

    if (!order) {
      return res.status(404).json({ status: 'error', message: 'Transaksi tidak ditemukan' });
    }

    if (order.orderStatus === OrderStatus.VOIDED) {
      return res.status(400).json({ status: 'error', message: 'Transaksi ini sudah berstatus VOID penuh sebelumnya' });
    }

    const targetItem = order.items.find((i) => i.id === orderItemId);
    if (!targetItem) {
      return res.status(404).json({ status: 'error', message: 'Item pesanan tidak ditemukan pada transaksi ini' });
    }

    const currentQty = Number(targetItem.quantity);
    const voidQty = Number(quantityToVoid || currentQty);

    if (voidQty <= 0 || voidQty > currentQty) {
      return res.status(400).json({
        status: 'error',
        message: `Jumlah item yang dibatalkan tidak valid (tersedia: ${currentQty}, diminta: ${voidQty})`,
      });
    }

    const approverLabel = `${approvedByUser.name} (${approvedByUser.role})`;
    const itemRefundAmount = (Number(targetItem.unitPrice) - Number(targetItem.discountAmount || 0)) * voidQty;

    let updatedOrderStatus: OrderStatus | any = order.orderStatus;
    let isFullVoidNow = false;

    // 3. Eksekusi Pembatalan Item dan Pemulihan Stok Parsial dalam Database Transaction
    await prisma.$transaction(async (tx) => {
      // A. Kembalikan stok inventaris untuk item ini
      const deductedLedgers = await tx.inventoryLedger.findMany({
        where: {
          tenantId: order.tenantId,
          referenceType: 'ORDER',
          referenceId: order.id,
          quantityDelta: { lt: 0 },
        },
      });

      // Hitung rasio pemulihan
      const ratio = voidQty / currentQty;
      for (const ledger of deductedLedgers) {
        const returnQty = Math.abs(Number(ledger.quantityDelta)) * ratio;
        if (returnQty <= 0) continue;

        const currentBalance = await tx.inventoryBalance.findFirst({
          where: {
            tenantId: order.tenantId,
            inventoryItemId: ledger.inventoryItemId,
            storageLocationId: ledger.storageLocationId,
            inventoryBatchId: ledger.inventoryBatchId,
          },
        });

        const balBefore = currentBalance ? Number(currentBalance.quantityOnHand) : 0;
        const balAfter = balBefore + returnQty;

        if (currentBalance) {
          await tx.inventoryBalance.update({
            where: { id: currentBalance.id },
            data: { quantityOnHand: balAfter, updatedAt: new Date() },
          });
        }

        await tx.inventoryLedger.create({
          data: {
            tenantId: order.tenantId,
            inventoryItemId: ledger.inventoryItemId,
            storageLocationId: ledger.storageLocationId,
            inventoryBatchId: ledger.inventoryBatchId,
            quantityDelta: returnQty,
            balanceBefore: balBefore,
            balanceAfter: balAfter,
            unitCost: ledger.unitCost,
            movementType: StockMovementType.VOID,
            referenceType: 'ORDER',
            referenceId: order.id,
            actorType: 'USER',
            actorUserId: approvedByUser?.id || currentUser?.id || null,
            isNegativeBalance: balAfter < 0,
            notes: `Pemulihan stok void item "${targetItem.productName}" (${voidQty}x) faktur ${order.invoiceNumber}: ${reason.trim()}`,
          },
        });
      }

      // B. Catat Audit Retur / Refund di tabel refunds
      const refundNumber = `REF-ITEM-${order.invoiceNumber}-${Date.now().toString().slice(-4)}`;
      const createdRefund = await tx.refund.create({
        data: {
          tenantId: order.tenantId,
          orderId: order.id,
          refundNumber,
          amount: itemRefundAmount,
          reason: RefundReason.WRONG_ITEM,
          notes: `Void Item "${targetItem.productName}" (${voidQty}x) disetujui: ${approverLabel}. Alasan: ${reason.trim()}${notes ? ` | ${notes.trim()}` : ''}`,
        },
      });

      await tx.refundItem.create({
        data: {
          tenantId: order.tenantId,
          refundId: createdRefund.id,
          orderItemId: targetItem.id,
          quantity: voidQty,
          amount: itemRefundAmount,
          restockItem: true,
        },
      });

      // C. Update atau kurangi OrderItem
      const remainingItemQty = currentQty - voidQty;
      const newItemSubtotal = Math.max(0, Number(targetItem.subtotal) - itemRefundAmount);

      if (remainingItemQty <= 0) {
        await tx.orderItem.delete({
          where: { id: targetItem.id },
        });
      } else {
        await tx.orderItem.update({
          where: { id: targetItem.id },
          data: {
            quantity: remainingItemQty,
            subtotal: newItemSubtotal,
            notes: targetItem.notes ? `${targetItem.notes} [Void ${voidQty}x]` : `[Void ${voidQty}x]`,
          },
        });
      }

      // D. Cek apakah masih ada sisa item di order
      const remainingItems = await tx.orderItem.findMany({
        where: { orderId: order.id },
      });

      if (remainingItems.length === 0) {
        // Jika seluruh item telah di-void, ubah order menjadi VOIDED penuh
        isFullVoidNow = true;
        updatedOrderStatus = OrderStatus.VOIDED;

        await tx.order.update({
          where: { id: order.id },
          data: {
            subtotal: 0,
            totalAmount: 0,
            orderStatus: OrderStatus.VOIDED,
            paymentStatus: PaymentStatus.REFUNDED,
            notes: order.notes ? `${order.notes} [FULL VOID via Item Cancellation]` : `[FULL VOID via Item Cancellation]`,
            updatedAt: new Date(),
          },
        });

        await tx.paymentTransaction.updateMany({
          where: { orderId: order.id, tenantId: order.tenantId },
          data: { status: PaymentTxStatus.REFUNDED },
        });
      } else {
        // Hitung ulang subtotal dan totalAmount baru
        const newSubtotal = remainingItems.reduce((acc, curr) => acc + Number(curr.subtotal), 0);
        const newGrandTotal = Math.max(0, Number(order.totalAmount) - itemRefundAmount);
        const partialVoidTag = `[PARTIAL VOID: ${targetItem.productName} (${voidQty}x) - Rp ${itemRefundAmount.toLocaleString('id-ID')} | Disetujui: ${approverLabel}]`;

        await tx.order.update({
          where: { id: order.id },
          data: {
            subtotal: newSubtotal,
            totalAmount: newGrandTotal,
            notes: order.notes ? `${order.notes} ${partialVoidTag}` : partialVoidTag,
            updatedAt: new Date(),
          },
        });
      }
    });

    // 4. Meja: Lepaskan meja jika full void
    if (isFullVoidNow && order.tableNumber && order.outletId) {
      try {
        await qrMenuService.releaseTableIfNoActiveOrders(order.tenantId, order.outletId, order.tableNumber);
      } catch (tblErr) {
        console.warn('Gagal mereset status meja pasca void item:', tblErr);
      }
    }

    return res.json({
      status: 'success',
      message: `Item "${targetItem.productName}" (${voidQty}x) berhasil dibatalkan (VOID ITEM)`,
      data: {
        orderId: order.id,
        invoiceNumber: order.invoiceNumber,
        voidedItemName: targetItem.productName,
        voidedQuantity: voidQty,
        refundAmount: itemRefundAmount,
        approvedBy: approverLabel,
        isFullVoid: isFullVoidNow,
        orderStatus: updatedOrderStatus,
      },
    });
  } catch (err: any) {
    console.error('Error in voidOrderItem:', err);
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Gagal memproses pembatalan item pesanan',
    });
  }
};




