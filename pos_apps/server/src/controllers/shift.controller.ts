import { Request, Response } from 'express';
import { z } from 'zod';
import { ShiftStatus, PaymentMethod, CashMovementType, Role } from '@prisma/client';
import { prisma } from '../config/prisma';

const startShiftSchema = z.object({
  startingCash: z.number().min(0, 'Modal awal kas tidak boleh negatif'),
  notes: z.string().optional(),
  outletId: z.string().uuid().optional(),
});

const closeShiftSchema = z.object({
  actualCash: z.number().min(0, 'Uang fisik di laci tidak boleh negatif'),
  notes: z.string().optional(),
});

const cashMovementSchema = z.object({
  type: z.enum(['CASH_OUT', 'CASH_IN']).default('CASH_OUT'),
  category: z.string().min(1, 'Kategori mutasi kas wajib dipilih/diisi'),
  amount: z.number().positive('Nominal mutasi kas harus lebih besar dari 0'),
  notes: z.string().min(3, 'Keterangan mutasi kas minimal 3 karakter'),
});

/**
 * Controller: Buka Shift Baru Kasir (Start Shift)
 * @route POST /api/shifts/start
 */
export const startShift = async (req: Request, res: Response) => {
  try {
    const parseResult = startShiftSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi modal awal gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const cashierId = req.user?.id;
    if (!cashierId) {
      return res.status(401).json({ status: 'error', message: 'Kasir belum terautentikasi' });
    }

    let tenantId: string | undefined = req.user?.tenantId || req.tenantId;
    let targetOutletId = parseResult.data.outletId || req.user?.outletId;
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
      return res.status(400).json({ status: 'error', message: 'Outlet tidak ditemukan' });
    }

    if (!tenantId && targetOutletId) {
      const outlet = await prisma.outlet.findUnique({
        where: { id: targetOutletId },
        select: { tenantId: true },
      });
      tenantId = outlet?.tenantId;
    }
    // Fix K3: Jangan fallback ke tenant pertama — tolak dengan 401
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    // Cek apakah kasir sudah memiliki shift yang masih berstatus OPEN
    const existingOpenShift = await prisma.shift.findFirst({
      where: {
        userId: cashierId,
        status: ShiftStatus.OPEN,
      },
      include: { outlet: { select: { name: true } }, user: { select: { name: true } } },
    });

    if (existingOpenShift) {
      return res.status(200).json({
        status: 'success',
        message: 'Kasir sudah memiliki sesi shift aktif yang sedang berjalan',
        data: existingOpenShift,
      });
    }

    const { startingCash, notes } = parseResult.data;

    const newShift = await prisma.shift.create({
      data: {
        tenantId: tenantId!,
        outletId: targetOutletId,
        userId: cashierId,
        startingCash,
        status: ShiftStatus.OPEN,
        notes: notes || 'Buka shift kasir harian',
      },
      include: {
        outlet: { select: { name: true } },
        user: { select: { name: true } },
      },
    });

    return res.status(201).json({
      status: 'success',
      message: 'Sesi shift kasir berhasil dibuka',
      data: newShift,
    });
  } catch (error: any) {
    console.error('Error saat membuka shift kasir:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal membuka shift kasir' });
  }
};

/**
 * Controller: Mendapatkan status shift aktif kasir saat ini
 * @route GET /api/shifts/current
 */
export const getCurrentShift = async (req: Request, res: Response) => {
  try {
    const cashierId = req.user?.id;
    if (!cashierId) {
      return res.status(401).json({ status: 'error', message: 'Kasir belum terautentikasi' });
    }

    const activeShift = await prisma.shift.findFirst({
      where: {
        userId: cashierId,
        status: ShiftStatus.OPEN,
      },
      include: {
        outlet: { select: { name: true, address: true, phone: true } },
        user: { select: { name: true, email: true } },
      },
    });

    if (!activeShift) {
      return res.status(200).json({
        status: 'success',
        data: null,
        message: 'Tidak ada sesi shift aktif',
      });
    }

    // Ambil rekap transaksi berjalan selama shift ini
    const paymentRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT pt.payment_method as "paymentMethod", pt.amount
       FROM "payment_transactions" pt
       JOIN "orders" o ON o.id = pt.order_id
       WHERE o.shift_id = $1 AND pt.status = 'CAPTURED' AND o.order_status NOT IN ('CANCELLED', 'VOIDED');`,
      activeShift.id
    );

    let cashSalesTotal = 0;
    let cashSalesCount = 0;
    let qrisSalesTotal = 0;
    let qrisSalesCount = 0;

    paymentRows.forEach((p) => {
      if (p.paymentMethod === 'CASH') {
        cashSalesTotal += Number(p.amount);
        cashSalesCount += 1;
      } else if (p.paymentMethod === 'QRIS') {
        qrisSalesTotal += Number(p.amount);
        qrisSalesCount += 1;
      }
    });

    const countRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT count(*)::int as count FROM "orders" 
       WHERE shift_id = $1 AND order_status NOT IN ('CANCELLED', 'VOIDED');`,
      activeShift.id
    );
    const totalOrders = countRows[0]?.count || 0;

    // Ambil mutasi kas (pengeluaran kasir & kas masuk tambahan)
    const cashMovements = await prisma.cashMovement.findMany({
      where: {
        shiftId: activeShift.id,
        tenantId: activeShift.tenantId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, userCode: true } },
      },
    });

    let totalCashOut = 0;
    let totalCashIn = 0;
    cashMovements.forEach((cm) => {
      if (cm.type === 'CASH_OUT') {
        totalCashOut += Number(cm.amount);
      } else if (cm.type === 'CASH_IN') {
        totalCashIn += Number(cm.amount);
      }
    });

    // Ambil transaksi pelunasan piutang/kasbon pelanggan tunai selama shift
    const debtCashRows = await prisma.customerDebtPayment.findMany({
      where: {
        OR: [
          { shiftId: activeShift.id },
          {
            outletId: activeShift.outletId,
            cashierId: activeShift.userId,
            createdAt: { gte: activeShift.startTime, lte: activeShift.endTime || new Date() },
          },
        ],
        paymentMethod: 'CASH',
      },
      include: {
        debt: {
          include: {
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalDebtCashIn = debtCashRows.reduce((sum, d) => sum + Number(d.amount), 0);
    const formattedDebtPayments = debtCashRows.map((d) => ({
      id: d.id,
      amount: Number(d.amount),
      customerName: d.debt?.customer?.name || 'Pelanggan',
      notes: d.notes,
      createdAt: d.createdAt,
    }));

    // Ambil seluruh daftar transaksi/pesanan selama shift berjalan
    const shiftOrders = await prisma.order.findMany({
      where: {
        shiftId: activeShift.id,
        orderStatus: { notIn: ['CANCELLED', 'VOIDED'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        payments: {
          where: { status: 'CAPTURED' },
          select: { paymentMethod: true, amount: true },
        },
      },
    });

    const formattedOrders = shiftOrders.map((o) => {
      const primaryPayment = o.payments[0]?.paymentMethod || 'CASH';
      return {
        id: o.id,
        invoiceNumber: o.invoiceNumber,
        orderType: o.orderType,
        channel: o.channel || o.orderType || 'DINE_IN',
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        grandTotal: Number(o.totalAmount),
        subtotal: Number(o.subtotal),
        discountAmount: Number(o.discountTotal),
        taxAmount: Number(o.taxTotal),
        createdAt: o.createdAt,
        customerName: o.customer?.name || null,
        tableNumber: o.tableNumber || null,
        paymentMethod: primaryPayment,
        payments: o.payments.map((pt) => ({
          method: pt.paymentMethod,
          amount: Number(pt.amount),
        })),
      };
    });

    const startingCash = Number(activeShift.startingCash);
    const expectedCash = startingCash + cashSalesTotal + totalCashIn + totalDebtCashIn - totalCashOut;

    return res.status(200).json({
      status: 'success',
      data: {
        ...activeShift,
        cashier: { name: activeShift.user.name, email: activeShift.user.email },
        startingCash,
        stats: {
          totalOrders,
          cashSalesTotal,
          cashSalesCount,
          qrisSalesTotal,
          qrisSalesCount,
          totalRevenue: cashSalesTotal + qrisSalesTotal,
          totalCashOut,
          totalCashIn,
          totalDebtCashIn,
          expectedCash,
        },
        orders: formattedOrders,
        debtPayments: formattedDebtPayments,
        totalDebtCashIn,
        cashMovements,
      },
    });
  } catch (error: any) {
    console.error('Error saat mengambil shift aktif:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat status shift aktif' });
  }
};

/**
 * Controller: Laporan Berjalan Kasir (X-Report)
 * @route GET /api/shifts/x-report
 */
export const getXReport = async (req: Request, res: Response) => {
  try {
    const cashierId = req.user?.id;
    if (!cashierId) {
      return res.status(401).json({ status: 'error', message: 'Kasir belum terautentikasi' });
    }

    const activeShift = await prisma.shift.findFirst({
      where: {
        userId: cashierId,
        status: ShiftStatus.OPEN,
      },
      include: {
        outlet: true,
        user: { select: { name: true, email: true } },
      },
    });

    if (!activeShift) {
      return res.status(404).json({
        status: 'error',
        message: 'Tidak ada sesi shift aktif untuk menghasilkan X-Report',
      });
    }

    const orderRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT o.id, o.invoice_number as "invoiceNumber", o.subtotal, o.discount_amount as "discountAmount",
              o.tax_amount as "taxAmount", COALESCE(o.service_total, 0) as "serviceCharge", o.grand_total as "grandTotal",
              o.created_at as "createdAt", pt.payment_method as "paymentMethod", pt.amount
       FROM "orders" o
       LEFT JOIN "payment_transactions" pt ON pt.order_id = o.id AND pt.status = 'CAPTURED'
       WHERE o.shift_id = $1 AND o.payment_status = 'PAID' AND o.order_status NOT IN ('CANCELLED', 'VOIDED')
       ORDER BY o.created_at DESC;`,
      activeShift.id
    );

    let totalGrossSales = 0;
    let totalDiscounts = 0;
    let totalTax = 0;
    let totalService = 0;
    let totalCashSales = 0;
    let totalQrisSales = 0;
    const orderMap = new Map<string, any>();

    orderRows.forEach((row) => {
      if (!orderMap.has(row.id)) {
        orderMap.set(row.id, {
          invoiceNumber: row.invoiceNumber,
          createdAt: row.createdAt,
          grandTotal: Number(row.grandTotal || 0),
          paymentMethod: row.paymentMethod || 'CASH',
        });
        totalGrossSales += Number(row.subtotal || 0);
        totalDiscounts += Number(row.discountAmount || 0);
        totalTax += Number(row.taxAmount || 0);
        totalService += Number(row.serviceCharge || 0);
      }
      if (row.paymentMethod === 'CASH') {
        totalCashSales += Number(row.amount || 0);
      } else if (row.paymentMethod === 'QRIS') {
        totalQrisSales += Number(row.amount || 0);
      }
    });

    // Ambil mutasi kas shift
    const cashMovements = await prisma.cashMovement.findMany({
      where: {
        shiftId: activeShift.id,
        tenantId: activeShift.tenantId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, userCode: true } },
      },
    });

    let totalCashOut = 0;
    let totalCashIn = 0;
    cashMovements.forEach((cm) => {
      if (cm.type === 'CASH_OUT') {
        totalCashOut += Number(cm.amount);
      } else if (cm.type === 'CASH_IN') {
        totalCashIn += Number(cm.amount);
      }
    });

    // Ambil pelunasan kasbon pelanggan tunai selama shift
    const debtCashRows = await prisma.customerDebtPayment.findMany({
      where: {
        OR: [
          { shiftId: activeShift.id },
          {
            outletId: activeShift.outletId,
            cashierId: activeShift.userId,
            createdAt: { gte: activeShift.startTime, lte: activeShift.endTime || new Date() },
          },
        ],
        paymentMethod: 'CASH',
      },
      include: {
        debt: {
          include: {
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalDebtCashIn = debtCashRows.reduce((sum, d) => sum + Number(d.amount), 0);
    const formattedDebtPayments = debtCashRows.map((d) => ({
      id: d.id,
      amount: Number(d.amount),
      customerName: d.debt?.customer?.name || 'Pelanggan',
      notes: d.notes,
      createdAt: d.createdAt,
    }));

    const startingCash = Number(activeShift.startingCash);
    const expectedCashInDrawer = startingCash + totalCashSales + totalCashIn + totalDebtCashIn - totalCashOut;
    const netRevenue = totalCashSales + totalQrisSales;

    const allOrders = Array.from(orderMap.values());
    const recentOrders = allOrders.slice(0, 20);

    return res.status(200).json({
      status: 'success',
      data: {
        reportType: 'X-REPORT (Laporan Berjalan Kasir)',
        shiftId: activeShift.id,
        status: activeShift.status,
        startTime: activeShift.startTime,
        generatedAt: new Date(),
        outlet: {
          name: activeShift.outlet.name,
          address: activeShift.outlet.address,
        },
        cashier: activeShift.user.name,
        cashDrawer: {
          startingCash,
          cashSales: totalCashSales,
          totalCashOut,
          totalCashIn,
          totalDebtCashIn,
          expectedCashInDrawer,
        },
        debtPayments: formattedDebtPayments,
        totalDebtCashIn,
        cashMovements,
        paymentSummary: {
          cashSales: totalCashSales,
          qrisSales: totalQrisSales,
          netRevenue,
        },
        transactionSummary: {
          totalOrders: orderMap.size,
          totalGrossSales,
          totalDiscounts,
          totalTax,
          totalService,
        },
        recentOrders,
        allOrders,
      },
    });
  } catch (error: any) {
    console.error('Error saat menghasilkan X-Report:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal membuat X-Report' });
  }
};

/**
 * Controller: Tutup Shift Kasir & Rekap Kas Fisik (Z-Report)
 * @route POST /api/shifts/close
 */
export const closeShift = async (req: Request, res: Response) => {
  try {
    const parseResult = closeShiftSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi uang fisik gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const cashierId = req.user?.id;
    if (!cashierId) {
      return res.status(401).json({ status: 'error', message: 'Kasir belum terautentikasi' });
    }

    const activeShift = await prisma.shift.findFirst({
      where: {
        userId: cashierId,
        status: ShiftStatus.OPEN,
      },
      include: {
        outlet: true,
        user: { select: { name: true } },
      },
    });

    if (!activeShift) {
      return res.status(404).json({
        status: 'error',
        message: 'Tidak ditemukan sesi shift aktif yang dapat ditutup',
      });
    }

    const { actualCash, notes } = parseResult.data;

    // Hitung rekap seluruh order pada shift ini
    const paymentRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT pt.payment_method as "paymentMethod", pt.amount
       FROM "payment_transactions" pt
       JOIN "orders" o ON o.id = pt.order_id
       WHERE o.shift_id = $1 AND pt.status = 'CAPTURED' AND o.payment_status = 'PAID' AND o.order_status NOT IN ('CANCELLED', 'VOIDED');`,
      activeShift.id
    );

    let totalCashSales = 0;
    let totalQrisSales = 0;

    paymentRows.forEach((p) => {
      if (p.paymentMethod === 'CASH') {
        totalCashSales += Number(p.amount);
      } else if (p.paymentMethod === 'QRIS') {
        totalQrisSales += Number(p.amount);
      }
    });

    const countRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT count(*)::int as count FROM "orders" 
       WHERE shift_id = $1 AND payment_status = 'PAID' AND order_status NOT IN ('CANCELLED', 'VOIDED');`,
      activeShift.id
    );
    const totalOrders = countRows[0]?.count || 0;

    // ─── Breakdown omset per channel penjualan ───────────────────────────────
    const channelRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(o.channel, o.order_type, 'DINE_IN') as channel, COUNT(*)::int as count,
              COALESCE(SUM(o.grand_total), 0) as revenue
       FROM "orders" o
       WHERE o.shift_id = $1 AND o.payment_status = 'PAID' AND o.order_status NOT IN ('CANCELLED', 'VOIDED')
       GROUP BY COALESCE(o.channel, o.order_type, 'DINE_IN')
       ORDER BY revenue DESC;`,
      activeShift.id
    );

    // ─── Rata-rata nilai transaksi (Average Order Value) ─────────────────────
    const totalRevenue = totalCashSales + totalQrisSales;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Ambil mutasi kas pada shift ini
    const cashMovements = await prisma.cashMovement.findMany({
      where: {
        shiftId: activeShift.id,
        tenantId: activeShift.tenantId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, userCode: true } },
      },
    });

    let totalCashOut = 0;
    let totalCashIn = 0;
    cashMovements.forEach((cm) => {
      if (cm.type === 'CASH_OUT') {
        totalCashOut += Number(cm.amount);
      } else if (cm.type === 'CASH_IN') {
        totalCashIn += Number(cm.amount);
      }
    });

    // Ambil transaksi pelunasan piutang/kasbon pelanggan tunai selama shift
    const debtCashRows = await prisma.customerDebtPayment.findMany({
      where: {
        OR: [
          { shiftId: activeShift.id },
          {
            outletId: activeShift.outletId,
            cashierId: activeShift.userId,
            createdAt: { gte: activeShift.startTime, lte: activeShift.endTime || new Date() },
          },
        ],
        paymentMethod: 'CASH',
      },
      include: {
        debt: {
          include: {
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalDebtCashIn = debtCashRows.reduce((sum, d) => sum + Number(d.amount), 0);
    const formattedDebtPayments = debtCashRows.map((d) => ({
      id: d.id,
      amount: Number(d.amount),
      customerName: d.debt?.customer?.name || 'Pelanggan',
      notes: d.notes,
      createdAt: d.createdAt,
    }));

    // Ambil seluruh daftar pesanan selama shift ini untuk rincian Z-Report
    const shiftOrders = await prisma.order.findMany({
      where: {
        shiftId: activeShift.id,
        paymentStatus: 'PAID',
        orderStatus: { notIn: ['CANCELLED', 'VOIDED'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        payments: {
          where: { status: 'CAPTURED' },
          select: { paymentMethod: true, amount: true },
        },
      },
    });

    const formattedOrders = shiftOrders.map((o) => {
      const primaryPayment = o.payments[0]?.paymentMethod || 'CASH';
      return {
        id: o.id,
        invoiceNumber: o.invoiceNumber,
        orderType: o.orderType,
        channel: o.channel || o.orderType || 'DINE_IN',
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        grandTotal: Number(o.totalAmount),
        subtotal: Number(o.subtotal),
        discountAmount: Number(o.discountTotal),
        taxAmount: Number(o.taxTotal),
        createdAt: o.createdAt,
        customerName: o.customer?.name || null,
        tableNumber: o.tableNumber || null,
        paymentMethod: primaryPayment,
        payments: o.payments.map((pt) => ({
          method: pt.paymentMethod,
          amount: Number(pt.amount),
        })),
      };
    });

    const startingCash = Number(activeShift.startingCash);
    const expectedCash = startingCash + totalCashSales + totalCashIn + totalDebtCashIn - totalCashOut;
    const difference = actualCash - expectedCash; // Selisih: positif (lebih), negatif (kurang), 0 (cocok)

    const endTime = new Date();

    const closedShift = await prisma.shift.update({
      where: { id: activeShift.id },
      data: {
        endTime,
        expectedEnding: expectedCash,
        actualEnding: actualCash,
        cashDifference: difference,
        status: ShiftStatus.CLOSED,
        notes: notes || `Tutup shift. Kas fisik: Rp ${actualCash.toLocaleString('id-ID')}. Kas keluar: Rp ${totalCashOut.toLocaleString('id-ID')}. Pelunasan kasbon: Rp ${totalDebtCashIn.toLocaleString('id-ID')}. Selisih: Rp ${difference.toLocaleString('id-ID')}`,
      },
      include: {
        outlet: true,
        user: { select: { name: true } },
      },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Sesi shift berhasil ditutup (Z-Report tersimpan)',
      data: {
        reportType: 'Z-REPORT (Laporan Tutup Shift Kasir)',
        shiftId: closedShift.id,
        startTime: closedShift.startTime,
        endTime: closedShift.endTime,
        outlet: closedShift.outlet.name,
        cashier: closedShift.user.name,
        cashDrawer: {
          startingCash,
          totalCashSales,
          totalCashOut,
          totalCashIn,
          totalDebtCashIn,
          expectedCash,
          actualCash,
          difference,
          differenceLabel:
            difference === 0 ? 'COCOK (Pas)' : difference > 0 ? 'LEBIH (+)' : 'KURANG (-)',
        },
        debtPayments: formattedDebtPayments,
        totalDebtCashIn,
        cashMovements,
        nonCashSummary: {
          totalQrisSales,
          totalRevenue,
          avgOrderValue,
        },
        channelBreakdown: channelRows.map((r) => ({
          channel: r.channel,
          count: Number(r.count),
          revenue: Number(r.revenue),
        })),
        totalTransactions: totalOrders,
        orders: formattedOrders,
        notes: closedShift.notes,
      },
    });
  } catch (error: any) {
    console.error('Error saat menutup shift kasir:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menutup shift kasir' });
  }
};

/**
 * Controller: Mengambil riwayat shift kasir cabang
 * @route GET /api/shifts
 */
export const getShiftHistory = async (req: Request, res: Response) => {
  try {
    const userTenantId = req.user?.tenantId;
    let targetOutletId = (req.query.outletId as string) || req.user?.outletId;
    if (req.query.outletId === 'ALL') {
      targetOutletId = undefined;
    }

    const userRole = req.user?.role;
    const isPrivileged = userRole && ([Role.OWNER, Role.ADMIN, Role.SUPERVISOR] as Role[]).includes(userRole);

    const shifts = await prisma.shift.findMany({
      where: {
        ...(userTenantId ? { tenantId: userTenantId } : {}),
        outletId: targetOutletId || undefined,
        ...(!isPrivileged && req.user ? { userId: req.user.id } : {}),
      },
      include: {
        user: { select: { name: true, email: true } },
        outlet: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const formatted = shifts.map((s) => ({
      id: s.id,
      cashier: s.user.name,
      cashierEmail: s.user.email,
      outlet: s.outlet.name,
      startTime: s.startTime,
      endTime: s.endTime,
      startingCash: Number(s.startingCash),
      expectedCash: s.expectedEnding !== null ? Number(s.expectedEnding) : null,
      actualCash: s.actualEnding !== null ? Number(s.actualEnding) : null,
      difference: s.cashDifference !== null ? Number(s.cashDifference) : null,
      status: s.status,
      notes: s.notes,
      createdAt: s.createdAt,
    }));

    return res.status(200).json({
      status: 'success',
      data: formatted,
    });
  } catch (error: any) {
    console.error('Error saat memuat riwayat shift:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat riwayat shift' });
  }
};

/**
 * Controller: Mengambil detail shift spesifik beserta daftar ordernya
 * @route GET /api/shifts/:id
 */
export const getShiftById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userTenantId = req.user?.tenantId;

    const shift = await prisma.shift.findFirst({
      where: {
        id,
        ...(userTenantId ? { tenantId: userTenantId } : {}),
      },
      include: {
        user: { select: { name: true, email: true } },
        outlet: { select: { name: true, address: true, phone: true } },
      },
    });

    if (!shift) {
      return res.status(404).json({ status: 'error', message: 'Data shift tidak ditemukan' });
    }

    const orderRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT o.id, o.grand_total as "grandTotal", o.invoice_number as "invoiceNumber", o.created_at,
              o.order_status as "orderStatus",
              pt.payment_method as "paymentMethod", pt.amount
       FROM "orders" o
       LEFT JOIN "payment_transactions" pt ON pt.order_id = o.id AND pt.status = 'CAPTURED'
       WHERE o.shift_id = $1 AND o.payment_status = 'PAID' AND o.order_status NOT IN ('CANCELLED', 'VOIDED');`,
      id
    );

    let cashSales = 0;
    let qrisSales = 0;
    const orderSet = new Set<string>();

    orderRows.forEach((row) => {
      orderSet.add(row.id);
      if (row.paymentMethod === 'CASH') {
        cashSales += Number(row.amount || 0);
      } else if (row.paymentMethod === 'QRIS') {
        qrisSales += Number(row.amount || 0);
      }
    });

    const cashMovements = await prisma.cashMovement.findMany({
      where: {
        shiftId: shift.id,
        tenantId: shift.tenantId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, userCode: true } },
      },
    });

    let totalCashOut = 0;
    let totalCashIn = 0;
    cashMovements.forEach((cm) => {
      if (cm.type === 'CASH_OUT') totalCashOut += Number(cm.amount);
      else if (cm.type === 'CASH_IN') totalCashIn += Number(cm.amount);
    });

    // Ambil transaksi pelunasan kasbon pelanggan tunai selama shift ini
    const debtCashRows = await prisma.customerDebtPayment.findMany({
      where: {
        OR: [
          { shiftId: shift.id },
          {
            outletId: shift.outletId,
            cashierId: shift.userId,
            createdAt: { gte: shift.startTime, lte: shift.endTime || new Date() },
          },
        ],
        paymentMethod: 'CASH',
      },
      include: {
        debt: {
          include: {
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalDebtCashIn = debtCashRows.reduce((sum, d) => sum + Number(d.amount), 0);
    const formattedDebtPayments = debtCashRows.map((d) => ({
      id: d.id,
      amount: Number(d.amount),
      customerName: d.debt?.customer?.name || 'Pelanggan',
      notes: d.notes,
      createdAt: d.createdAt,
    }));

    // Ambil seluruh detail pesanan shift ini
    const shiftOrders = await prisma.order.findMany({
      where: {
        shiftId: shift.id,
        paymentStatus: 'PAID',
        orderStatus: { notIn: ['CANCELLED', 'VOIDED'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        payments: {
          where: { status: 'CAPTURED' },
          select: { paymentMethod: true, amount: true },
        },
      },
    });

    const formattedOrders = shiftOrders.map((o) => {
      const primaryPayment = o.payments[0]?.paymentMethod || 'CASH';
      return {
        id: o.id,
        invoiceNumber: o.invoiceNumber,
        orderType: o.orderType,
        channel: o.channel || o.orderType || 'DINE_IN',
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        grandTotal: Number(o.totalAmount),
        subtotal: Number(o.subtotal),
        discountAmount: Number(o.discountTotal),
        taxAmount: Number(o.taxTotal),
        createdAt: o.createdAt,
        customerName: o.customer?.name || null,
        tableNumber: o.tableNumber || null,
        paymentMethod: primaryPayment,
        payments: o.payments.map((pt) => ({
          method: pt.paymentMethod,
          amount: Number(pt.amount),
        })),
      };
    });

    return res.status(200).json({
      status: 'success',
      data: {
        ...shift,
        cashier: { name: shift.user.name, email: shift.user.email },
        startingCash: Number(shift.startingCash),
        expectedCash: shift.expectedEnding !== null ? Number(shift.expectedEnding) : null,
        actualCash: shift.actualEnding !== null ? Number(shift.actualEnding) : null,
        difference: shift.cashDifference !== null ? Number(shift.cashDifference) : null,
        totalCashOut,
        totalCashIn,
        totalDebtCashIn,
        debtPayments: formattedDebtPayments,
        orders: formattedOrders,
        cashMovements,
        stats: {
          totalOrders: formattedOrders.length,
          cashSales,
          qrisSales,
          totalRevenue: cashSales + qrisSales,
        },
      },
    });
  } catch (error: any) {
    console.error('Error saat memuat detail shift:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat detail shift' });
  }
};

/**
 * Controller: Catat Mutasi Kas / Pengeluaran Kasir (Petty Cash Out)
 * @route POST /api/shifts/cash-movement
 */
export const recordCashMovement = async (req: Request, res: Response) => {
  try {
    const parseResult = cashMovementSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi mutasi kas gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const cashierId = req.user?.id;
    if (!cashierId) {
      return res.status(401).json({ status: 'error', message: 'Kasir belum terautentikasi' });
    }

    // Periksa hak akses pengeluaran kas kasir
    // User berhak jika: role OWNER / ADMIN / SUPERVISOR ATAU canCashOut === true
    const user = await prisma.user.findUnique({
      where: { id: cashierId },
      select: { role: true, canCashOut: true, name: true, tenantId: true },
    });

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Pengguna tidak ditemukan' });
    }

    const hasPermission =
      ['OWNER', 'ADMIN', 'SUPERVISOR'].includes(user.role) || user.canCashOut === true;

    if (!hasPermission) {
      return res.status(403).json({
        status: 'error',
        message: 'Anda tidak memiliki hak akses untuk mencatat pengeluaran kas. Hubungi Owner atau Supervisor untuk memberikan izin.',
      });
    }

    // Ambil shift aktif yang terikat ketat dengan tenant kasir
    const activeShift = await prisma.shift.findFirst({
      where: {
        userId: cashierId,
        ...(user.tenantId ? { tenantId: user.tenantId } : {}),
        status: ShiftStatus.OPEN,
      },
      include: { outlet: true },
    });

    if (!activeShift) {
      return res.status(400).json({
        status: 'error',
        message: 'Tidak ada sesi shift aktif. Buka shift terlebih dahulu sebelum mencatat pengeluaran kas.',
      });
    }

    const { type, category, amount, notes } = parseResult.data;

    const movement = await prisma.cashMovement.create({
      data: {
        tenantId: activeShift.tenantId,
        outletId: activeShift.outletId,
        shiftId: activeShift.id,
        userId: cashierId,
        type: type as CashMovementType,
        category,
        amount,
        notes,
      },
      include: {
        user: { select: { id: true, name: true, userCode: true } },
      },
    });

    return res.status(201).json({
      status: 'success',
      message: type === 'CASH_OUT' ? 'Pengeluaran kas berhasil dicatat' : 'Kas masuk berhasil dicatat',
      data: movement,
    });
  } catch (error: any) {
    console.error('Error saat mencatat mutasi kas:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mencatat mutasi kas' });
  }
};

/**
 * Controller: Daftar Riwayat Mutasi Kas Shift (Strict Tenant & Staff Boundary)
 * @route GET /api/shifts/cash-movements
 */
export const getCashMovements = async (req: Request, res: Response) => {
  try {
    const cashierId = req.user?.id;
    const userTenantId = req.user?.tenantId;
    const userRole = req.user?.role;
    if (!cashierId || !userTenantId) {
      return res.status(401).json({ status: 'error', message: 'Kasir belum terautentikasi' });
    }

    const { shiftId } = req.query;

    let targetShiftId = shiftId as string | undefined;
    if (!targetShiftId) {
      const activeShift = await prisma.shift.findFirst({
        where: {
          userId: cashierId,
          tenantId: userTenantId,
          status: ShiftStatus.OPEN,
        },
        select: { id: true },
      });
      targetShiftId = activeShift?.id;
    } else {
      // Keamanan Ketat: Jika query param shiftId diberikan:
      // 1. Wajib cocok dengan tenantId pengguna aktif (mencegah kebocoran lintas tenant)
      // 2. Jika bukan Owner/Admin/Supervisor, kasir biasa hanya boleh melihat shift miliknya sendiri
      const isPrivileged = ['OWNER', 'ADMIN', 'SUPERVISOR'].includes(userRole || '');
      const validShift = await prisma.shift.findFirst({
        where: {
          id: targetShiftId,
          tenantId: userTenantId,
          ...(!isPrivileged ? { userId: cashierId } : {}),
        },
        select: { id: true },
      });

      if (!validShift) {
        return res.status(403).json({
          status: 'error',
          message: 'Akses ditolak: Shift tidak ditemukan atau Anda tidak memiliki akses ke data shift ini',
        });
      }
    }

    if (!targetShiftId) {
      return res.status(200).json({
        status: 'success',
        data: {
          movements: [],
          totalCashOut: 0,
          totalCashIn: 0,
        },
        message: 'Tidak ada sesi shift aktif',
      });
    }

    // Query mutasi kas terisolasi dengan filter tenantId & shiftId
    const movements = await prisma.cashMovement.findMany({
      where: {
        shiftId: targetShiftId,
        tenantId: userTenantId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, userCode: true } },
      },
    });

    let totalCashOut = 0;
    let totalCashIn = 0;
    movements.forEach((m) => {
      if (m.type === 'CASH_OUT') totalCashOut += Number(m.amount);
      else if (m.type === 'CASH_IN') totalCashIn += Number(m.amount);
    });

    return res.status(200).json({
      status: 'success',
      data: {
        movements,
        totalCashOut,
        totalCashIn,
      },
    });
  } catch (error: any) {
    console.error('Error saat mengambil mutasi kas:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil riwayat mutasi kas' });
  }
};

