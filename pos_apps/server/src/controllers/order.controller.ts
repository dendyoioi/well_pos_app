import { Request, Response } from 'express';
import { z } from 'zod';
import { PaymentMethod, PaymentStatus, PaymentTxStatus, StockMovementType, ShiftStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { sendOrderReceiptEmail } from '../services/mail.service';

// Skema validasi item keranjang belanja
const orderItemSchema = z.object({
  productId: z.string().uuid('ID produk tidak valid'),
  quantity: z.number().int().positive('Jumlah harus minimal 1'),
  discountAmount: z.number().min(0).default(0),
});

// Skema validasi pembayaran tunggal
const paymentItemSchema = z.object({
  method: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: 'Metode pembayaran harus CASH atau QRIS' }),
  }),
  amountPaid: z.number().min(0, 'Jumlah bayar tidak boleh negatif'),
  changeGiven: z.number().min(0).optional().default(0),
  qrisReference: z.string().optional().nullable(),
});

// Skema validasi checkout lengkap (mendukung single payment maupun split payments)
const checkoutSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Keranjang belanja tidak boleh kosong'),
  channel: z.string().optional().default('DINE_IN'),
  customerId: z.string().uuid().optional().nullable(),
  customerName: z.string().optional(),
  customerEmail: z.string().email('Format email tidak valid').optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  discountAmount: z.number().min(0).default(0),
  taxRate: z.number().min(0).max(1).default(0), // Misal 0.11 untuk PPN 11% atau 0
  taxAmount: z.number().min(0).optional(), // Nilai nominal pajak jika dihitung dinamis dari outlet
  serviceCharge: z.number().min(0).default(0),
  payment: paymentItemSchema.optional(),
  payments: z.array(paymentItemSchema).optional(),
  shiftId: z.string().uuid().optional(),
  outletId: z.string().uuid().optional(),
});

/**
 * Helper: Menghasilkan Nomor Invoice Standar
 * Format: INV/YYYYMMDD/{outletCode}/{sequence 4 digit}
 * Contoh: INV/20260915/PST/0001
 */
const generateInvoiceNumber = async (outletId: string): Promise<string> => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

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

  // Hitung jumlah transaksi hari ini di outlet tersebut
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  const countToday = await prisma.order.count({
    where: {
      outletId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  const sequence = String(countToday + 1).padStart(4, '0');
  return `INV/${dateStr}/${outletCode}/${sequence}`;
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
      customerId,
      customerName,
      customerEmail,
      customerPhone,
      discountAmount: globalDiscount,
      taxRate,
      taxAmount: explicitTaxAmount,
      serviceCharge,
      payment,
      payments,
      shiftId,
      outletId: bodyOutletId,
    } = parseResult.data;

    // Tentukan outlet cabang transaksi
    let targetOutletId = bodyOutletId || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = await prisma.outlet.findFirst({ select: { id: true } });
      targetOutletId = defaultOutlet?.id;
    }

    if (!targetOutletId) {
      return res.status(400).json({ status: 'error', message: 'Outlet cabang tidak ditemukan' });
    }

    const cashierId = req.user?.id;
    if (!cashierId) {
      return res.status(401).json({ status: 'error', message: 'Kasir belum terautentikasi' });
    }

    const tenantId = req.user?.tenantId || req.tenantId || null;

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
              tenantId: tenantId || undefined,
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
      const activeShift = await prisma.shift.findFirst({
        where: { cashierId, status: ShiftStatus.OPEN },
        select: { id: true },
      });
      if (activeShift) {
        resolvedShiftId = activeShift.id;
      }
    }

    // Ambil data produk & stok riil dari database
    const productIds = items.map((i) => i.productId);
    const productsInDb = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
      include: {
        outletProducts: {
          where: { outletId: targetOutletId },
        },
      },
    });

    if (productsInDb.length !== productIds.length) {
      return res.status(400).json({
        status: 'error',
        message: 'Beberapa produk di keranjang tidak aktif atau tidak ditemukan',
      });
    }

    // Peta produk untuk lookup cepat
    const productMap = new Map(productsInDb.map((p) => [p.id, p]));

    // Validasi stok fisik sebelum eksekusi
    for (const item of items) {
      const p = productMap.get(item.productId);
      const stock = p?.outletProducts[0]?.stock ?? 0;
      if (stock < item.quantity) {
        return res.status(400).json({
          status: 'error',
          message: `Stok "${p?.name}" tidak mencukupi! Tersedia: ${stock} ${p?.unit}, diminta: ${item.quantity}`,
        });
      }
    }

    // Kalkulasi Rincian Biaya
    let subtotal = 0;
    let totalCost = 0; // Akumulasi HPP barang yang terjual

    const preparedOrderItems = items.map((item) => {
      const p = productMap.get(item.productId)!;
      const outletStock = p.outletProducts[0];
      const unitPrice = outletStock?.price ? Number(outletStock.price) : Number(p.basePrice);
      const costPrice = Number(p.costPrice);
      const itemDiscount = item.discountAmount || 0;
      const itemSubtotal = (unitPrice - itemDiscount) * item.quantity;

      subtotal += itemSubtotal;
      totalCost += costPrice * item.quantity;

      return {
        productId: item.productId,
        quantity: item.quantity,
        costPrice,
        unitPrice,
        discountAmount: itemDiscount,
        subtotal: itemSubtotal,
      };
    });

    // Kalkulasi Pajak, Diskon Global, & Grand Total
    const discountedSubtotal = Math.max(0, subtotal - globalDiscount);
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
    }> = [];

    if (payments && payments.length > 0) {
      let totalAmountPaid = 0;
      for (const p of payments) {
        totalAmountPaid += p.amountPaid;
        preparedPayments.push({
          method: p.method,
          amountPaid: p.amountPaid,
          changeGiven: p.changeGiven || 0,
          qrisReference: p.qrisReference || null,
          status: PaymentTxStatus.SUCCESS,
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
      if (payment.method === PaymentMethod.CASH && payment.amountPaid < grandTotal) {
        return res.status(400).json({
          status: 'error',
          message: `Uang pembayaran tunai kurang! Tagihan: Rp ${grandTotal.toLocaleString(
            'id-ID'
          )}, Dibayar: Rp ${payment.amountPaid.toLocaleString('id-ID')}`,
        });
      }

      const changeGiven =
        payment.method === PaymentMethod.CASH ? Math.max(0, payment.amountPaid - grandTotal) : 0;

      preparedPayments.push({
        method: payment.method,
        amountPaid: payment.amountPaid,
        changeGiven: payment.changeGiven !== undefined ? payment.changeGiven : changeGiven,
        qrisReference: payment.qrisReference || null,
        status: PaymentTxStatus.SUCCESS,
      });
    } else {
      return res.status(400).json({
        status: 'error',
        message: 'Rincian pembayaran wajib disertakan',
      });
    }

    const invoiceNumber = await generateInvoiceNumber(targetOutletId);

    // ====================================================
    // EKSEKUSI DATABASE TRANSACTION (ACID)
    // ====================================================
    const result = await prisma.$transaction(async (tx) => {
      // 1. Buat record Order penjualan
      const order = await tx.order.create({
        data: {
          tenantId,
          invoiceNumber,
          channel: channel || 'DINE_IN',
          outletId: targetOutletId!,
          cashierId,
          shiftId: resolvedShiftId || null,
          customerId: resolvedCustomerId,
          customerName: finalCustomerName,
          customerEmail: finalCustomerEmail,
          customerPhone: finalCustomerPhone,
          subtotal,
          discountAmount: globalDiscount,
          taxAmount,
          serviceCharge,
          grandTotal,
          totalCost,
          paymentStatus: PaymentStatus.PAID,
          orderItems: {
            create: preparedOrderItems,
          },
          payments: {
            create: preparedPayments,
          },
        },
        include: {
          orderItems: {
            include: { product: { select: { name: true, sku: true, unit: true } } },
          },
          payments: true,
          outlet: { select: { name: true, address: true, phone: true } },
          cashier: { select: { name: true } },
          customer: { select: { id: true, name: true, phone: true, code: true } },
        },
      });

      // Update akumulasi belanja & kunjungan pelanggan (Customer CRM)
      if (resolvedCustomerId) {
        await tx.customer.update({
          where: { id: resolvedCustomerId },
          data: {
            visitCount: { increment: 1 },
            totalSpent: { increment: grandTotal },
          },
        });
      }

      // 2. Potong stok riil di outlet_products & catat kartu stok mutasi SALE_OUT
      for (const item of preparedOrderItems) {
        await tx.outletProduct.update({
          where: {
            outletId_productId: {
              outletId: targetOutletId!,
              productId: item.productId,
            },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        await tx.stockMovement.create({
          data: {
            outletId: targetOutletId!,
            productId: item.productId,
            userId: cashierId,
            type: StockMovementType.SALE_OUT,
            quantity: -item.quantity,
            notes: `Penjualan kasir faktur: ${invoiceNumber}`,
          },
        });
      }

      return order;
    });

    return res.status(201).json({
      status: 'success',
      message: 'Transaksi berhasil diselesaikan',
      data: result,
    });
  } catch (error) {
    console.error('Error saat memproses checkout order:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menyelesaikan transaksi checkout',
    });
  }
};

/**
 * Controller: Mendapatkan riwayat transaksi penjualan
 * @route GET /api/orders
 */
export const getOrders = async (req: Request, res: Response) => {
  try {
    const { outletId, cashierId, channel, search, limit = '20', page = '1' } = req.query;

    const userTenantId = req.user?.tenantId;
    const where: any = {};
    if (userTenantId) where.tenantId = userTenantId;
    if (outletId && typeof outletId === 'string') where.outletId = outletId;
    if (cashierId && typeof cashierId === 'string') where.cashierId = cashierId;
    if (channel && typeof channel === 'string' && channel !== 'ALL') where.channel = channel;

    if (search && typeof search === 'string') {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const take = parseInt(limit as string, 10);
    const skip = (parseInt(page as string, 10) - 1) * take;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          orderItems: {
            include: { product: { select: { name: true, unit: true } } },
          },
          payments: true,
          cashier: { select: { id: true, name: true } },
          outlet: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, phone: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.order.count({ where }),
    ]);

    return res.status(200).json({
      status: 'success',
      data: orders,
      meta: {
        total,
        page: parseInt(page as string, 10),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('Error saat mengambil riwayat transaksi:', error);
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
    const userTenantId = req.user?.tenantId;

    const order = await prisma.order.findFirst({
      where: {
        id,
        ...(userTenantId ? { tenantId: userTenantId } : {}),
      },
      include: {
        orderItems: {
          include: { product: { select: { name: true, sku: true, barcode: true, unit: true } } },
        },
        payments: true,
        cashier: { select: { id: true, name: true } },
        outlet: true,
        customer: { select: { id: true, name: true, phone: true, code: true, email: true } },
      },
    });

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

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: { product: { select: { name: true, sku: true, unit: true } } },
        },
        payments: true,
        cashier: { select: { name: true } },
        outlet: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Transaksi tidak ditemukan',
      });
    }

    // Update customerEmail jika belum tersimpan
    if (order.customerEmail !== email) {
      await prisma.order.update({
        where: { id },
        data: { customerEmail: email },
      });
    }

    const payment = order.payments[0] || {
      method: 'CASH',
      amountPaid: order.grandTotal,
      changeGiven: 0,
      qrisReference: null,
    };

    const mailResult = await sendOrderReceiptEmail(email, {
      invoiceNumber: order.invoiceNumber,
      createdAt: order.createdAt,
      customerName: order.customerName,
      outlet: {
        name: order.outlet.name,
        address: order.outlet.address,
        phone: order.outlet.phone,
      },
      cashierName: order.cashier?.name,
      orderItems: order.orderItems.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discountAmount: Number(item.discountAmount),
        subtotal: Number(item.subtotal),
        unit: item.product.unit,
      })),
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
      serviceCharge: Number(order.serviceCharge),
      taxAmount: Number(order.taxAmount),
      grandTotal: Number(order.grandTotal),
      payment: {
        method: payment.method,
        amountPaid: Number(payment.amountPaid),
        changeGiven: Number(payment.changeGiven),
        qrisReference: payment.qrisReference,
      },
    });

    return res.status(200).json({
      status: 'success',
      message: mailResult.message,
      previewUrl: mailResult.previewUrl,
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
 * Skema validasi Tahan Pesanan (Hold Order)
 */
const holdOrderSchema = z.object({
  outletId: z.string().uuid().optional(),
  customerName: z.string().optional(),
  channel: z.string().optional().default('DINE_IN'),
  note: z.string().optional(),
  items: z.array(z.any()).min(1, 'Item belanja tidak boleh kosong'),
  totalAmount: z.number().min(0),
});

/**
 * Menyimpan draf pesanan kasir yang ditahan (Hold Order)
 * @route POST /api/orders/hold
 */
export const holdOrder = async (req: Request, res: Response) => {
  try {
    const parseResult = holdOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi data tahan pesanan gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { outletId, customerName, channel, note, items, totalAmount } = parseResult.data;
    const cashierId = req.user?.id;
    if (!cashierId) {
      return res.status(401).json({ status: 'error', message: 'Kasir belum terautentikasi' });
    }

    let targetOutletId = outletId || req.user?.outletId;
    if (!targetOutletId) {
      const def = await prisma.outlet.findFirst({ select: { id: true } });
      targetOutletId = def?.id;
    }

    if (!targetOutletId) {
      return res.status(400).json({ status: 'error', message: 'Outlet tidak ditemukan' });
    }

    const tenantId = req.user?.tenantId || req.tenantId || null;

    const newHold = await prisma.holdOrder.create({
      data: {
        tenantId,
        outletId: targetOutletId,
        cashierId,
        customerName: customerName || `Antrean #${Date.now().toString().slice(-4)}`,
        channel: channel || 'DINE_IN',
        note: note || null,
        cartItems: items,
        totalAmount,
      },
    });

    return res.status(201).json({
      status: 'success',
      message: 'Pesanan berhasil ditahan sementara',
      data: newHold,
    });
  } catch (error) {
    console.error('Error saat menahan pesanan:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menahan pesanan kasir',
    });
  }
};

/**
 * Mendapatkan daftar antrean pesanan tertahan
 * @route GET /api/orders/hold
 */
export const getHoldOrders = async (req: Request, res: Response) => {
  try {
    const outletId = (req.query.outletId as string) || req.user?.outletId;
    const tenantId = req.user?.tenantId || req.tenantId;

    const where: any = {};
    if (outletId) where.outletId = outletId;
    if (tenantId) where.tenantId = tenantId;

    const holdOrders = await prisma.holdOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        cashier: { select: { name: true } },
      },
    });

    return res.status(200).json({
      status: 'success',
      data: holdOrders,
    });
  } catch (error) {
    console.error('Error saat mengambil pesanan tertahan:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil daftar pesanan tertahan',
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
    await prisma.holdOrder.delete({
      where: { id },
    });

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
