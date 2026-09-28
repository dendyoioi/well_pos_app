import { Request, Response } from 'express';
import { z } from 'zod';
import { ShiftStatus, PaymentMethod } from '@prisma/client';
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
       WHERE o.shift_id = $1 AND pt.status = 'CAPTURED';`,
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

    const startingCash = Number(activeShift.startingCash);
    const expectedCash = startingCash + cashSalesTotal;

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
          expectedCash,
        },
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
              o.tax_amount as "taxAmount", o.service_charge as "serviceCharge", o.grand_total as "grandTotal",
              o.created_at as "createdAt", pt.payment_method as "paymentMethod", pt.amount
       FROM "orders" o
       LEFT JOIN "payment_transactions" pt ON pt.order_id = o.id AND pt.status = 'CAPTURED'
       WHERE o.shift_id = $1
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

    const startingCash = Number(activeShift.startingCash);
    const expectedCashInDrawer = startingCash + totalCashSales;
    const netRevenue = totalCashSales + totalQrisSales;

    const recentOrders = Array.from(orderMap.values()).slice(0, 10);

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
          expectedCashInDrawer,
        },
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
       WHERE o.shift_id = $1 AND pt.status = 'CAPTURED';`,
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
       WHERE shift_id = $1 AND order_status NOT IN ('CANCELLED', 'VOIDED');`,
      activeShift.id
    );
    const totalOrders = countRows[0]?.count || 0;

    const startingCash = Number(activeShift.startingCash);
    const expectedCash = startingCash + totalCashSales;
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
        notes: notes || `Tutup shift. Kas fisik: Rp ${actualCash.toLocaleString('id-ID')}. Selisih: Rp ${difference.toLocaleString('id-ID')}`,
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
          expectedCash,
          actualCash,
          difference,
          differenceLabel:
            difference === 0 ? 'COCOK (Pas)' : difference > 0 ? 'LEBIH (+)' : 'KURANG (-)',
        },
        nonCashSummary: {
          totalQrisSales,
          totalRevenue: totalCashSales + totalQrisSales,
        },
        totalTransactions: totalOrders,
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

    const shifts = await prisma.shift.findMany({
      where: {
        ...(userTenantId ? { tenantId: userTenantId } : {}),
        outletId: targetOutletId || undefined,
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
       WHERE o.shift_id = $1 AND o.order_status NOT IN ('CANCELLED', 'VOIDED');`,
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

    return res.status(200).json({
      status: 'success',
      data: {
        ...shift,
        cashier: { name: shift.user.name, email: shift.user.email },
        startingCash: Number(shift.startingCash),
        expectedCash: shift.expectedEnding !== null ? Number(shift.expectedEnding) : null,
        actualCash: shift.actualEnding !== null ? Number(shift.actualEnding) : null,
        difference: shift.cashDifference !== null ? Number(shift.cashDifference) : null,
        stats: {
          totalOrders: orderSet.size,
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

