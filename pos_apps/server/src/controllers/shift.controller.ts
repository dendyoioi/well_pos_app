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

    let targetOutletId = parseResult.data.outletId || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = await prisma.outlet.findFirst({ select: { id: true } });
      targetOutletId = defaultOutlet?.id;
    }

    if (!targetOutletId) {
      return res.status(400).json({ status: 'error', message: 'Outlet tidak ditemukan' });
    }

    // Cek apakah kasir sudah memiliki shift yang masih berstatus OPEN
    const existingOpenShift = await prisma.shift.findFirst({
      where: {
        cashierId,
        status: ShiftStatus.OPEN,
      },
      include: { outlet: { select: { name: true } }, cashier: { select: { name: true } } },
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
        tenantId: req.user?.tenantId || undefined,
        outletId: targetOutletId,
        cashierId,
        startingCash,
        status: ShiftStatus.OPEN,
        notes: notes || 'Buka shift kasir harian',
      },
      include: {
        outlet: { select: { name: true } },
        cashier: { select: { name: true } },
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
        cashierId,
        status: ShiftStatus.OPEN,
      },
      include: {
        outlet: { select: { name: true, address: true, phone: true } },
        cashier: { select: { name: true, email: true } },
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
    const orders = await prisma.order.findMany({
      where: { shiftId: activeShift.id },
      include: { payments: true },
    });

    let cashSalesTotal = 0;
    let cashSalesCount = 0;
    let qrisSalesTotal = 0;
    let qrisSalesCount = 0;

    orders.forEach((order) => {
      order.payments.forEach((p) => {
        if (p.method === PaymentMethod.CASH) {
          cashSalesTotal += Number(order.grandTotal);
          cashSalesCount += 1;
        } else if (p.method === PaymentMethod.QRIS) {
          qrisSalesTotal += Number(order.grandTotal);
          qrisSalesCount += 1;
        }
      });
    });

    const startingCash = Number(activeShift.startingCash);
    const expectedCash = startingCash + cashSalesTotal;

    return res.status(200).json({
      status: 'success',
      data: {
        ...activeShift,
        startingCash,
        stats: {
          totalOrders: orders.length,
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
        cashierId,
        status: ShiftStatus.OPEN,
      },
      include: {
        outlet: true,
        cashier: { select: { name: true, email: true } },
      },
    });

    if (!activeShift) {
      return res.status(404).json({
        status: 'error',
        message: 'Tidak ada sesi shift aktif untuk menghasilkan X-Report',
      });
    }

    const orders = await prisma.order.findMany({
      where: { shiftId: activeShift.id },
      include: {
        orderItems: {
          include: { product: { select: { name: true, sku: true } } },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalGrossSales = 0;
    let totalDiscounts = 0;
    let totalTax = 0;
    let totalService = 0;
    let totalCashSales = 0;
    let totalQrisSales = 0;

    orders.forEach((order) => {
      totalGrossSales += Number(order.subtotal);
      totalDiscounts += Number(order.discountAmount);
      totalTax += Number(order.taxAmount);
      totalService += Number(order.serviceCharge);

      order.payments.forEach((p) => {
        if (p.method === PaymentMethod.CASH) {
          totalCashSales += Number(order.grandTotal);
        } else if (p.method === PaymentMethod.QRIS) {
          totalQrisSales += Number(order.grandTotal);
        }
      });
    });

    const startingCash = Number(activeShift.startingCash);
    const expectedCashInDrawer = startingCash + totalCashSales;
    const netRevenue = totalCashSales + totalQrisSales;

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
        cashier: activeShift.cashier.name,
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
          totalOrders: orders.length,
          totalGrossSales,
          totalDiscounts,
          totalTax,
          totalService,
        },
        recentOrders: orders.slice(0, 10).map((o) => ({
          invoiceNumber: o.invoiceNumber,
          createdAt: o.createdAt,
          grandTotal: Number(o.grandTotal),
          paymentMethod: o.payments[0]?.method || 'CASH',
        })),
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
        cashierId,
        status: ShiftStatus.OPEN,
      },
      include: {
        outlet: true,
        cashier: { select: { name: true } },
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
    const orders = await prisma.order.findMany({
      where: { shiftId: activeShift.id },
      include: { payments: true },
    });

    let totalCashSales = 0;
    let totalQrisSales = 0;

    orders.forEach((order) => {
      order.payments.forEach((p) => {
        if (p.method === PaymentMethod.CASH) {
          totalCashSales += Number(order.grandTotal);
        } else if (p.method === PaymentMethod.QRIS) {
          totalQrisSales += Number(order.grandTotal);
        }
      });
    });

    const startingCash = Number(activeShift.startingCash);
    const expectedCash = startingCash + totalCashSales;
    const difference = actualCash - expectedCash; // Selisih: positif (lebih), negatif (kurang), 0 (cocok)

    const endTime = new Date();

    const closedShift = await prisma.shift.update({
      where: { id: activeShift.id },
      data: {
        endTime,
        expectedCash,
        actualCash,
        difference,
        status: ShiftStatus.CLOSED,
        notes: notes || `Tutup shift. Kas fisik: Rp ${actualCash.toLocaleString('id-ID')}. Selisih: Rp ${difference.toLocaleString('id-ID')}`,
      },
      include: {
        outlet: true,
        cashier: { select: { name: true } },
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
        cashier: closedShift.cashier.name,
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
        totalTransactions: orders.length,
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
        cashier: { select: { name: true, email: true } },
        outlet: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const formatted = shifts.map((s) => ({
      id: s.id,
      cashier: s.cashier.name,
      cashierEmail: s.cashier.email,
      outlet: s.outlet.name,
      startTime: s.startTime,
      endTime: s.endTime,
      startingCash: Number(s.startingCash),
      expectedCash: s.expectedCash !== null ? Number(s.expectedCash) : null,
      actualCash: s.actualCash !== null ? Number(s.actualCash) : null,
      difference: s.difference !== null ? Number(s.difference) : null,
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
        cashier: { select: { name: true, email: true } },
        outlet: { select: { name: true, address: true, phone: true } },
        orders: {
          include: {
            payments: true,
            orderItems: {
              include: { product: { select: { name: true, sku: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!shift) {
      return res.status(404).json({ status: 'error', message: 'Data shift tidak ditemukan' });
    }

    let cashSales = 0;
    let qrisSales = 0;

    shift.orders.forEach((order) => {
      order.payments.forEach((p) => {
        if (p.method === PaymentMethod.CASH) {
          cashSales += Number(order.grandTotal);
        } else if (p.method === PaymentMethod.QRIS) {
          qrisSales += Number(order.grandTotal);
        }
      });
    });

    return res.status(200).json({
      status: 'success',
      data: {
        ...shift,
        startingCash: Number(shift.startingCash),
        expectedCash: shift.expectedCash !== null ? Number(shift.expectedCash) : null,
        actualCash: shift.actualCash !== null ? Number(shift.actualCash) : null,
        difference: shift.difference !== null ? Number(shift.difference) : null,
        stats: {
          totalOrders: shift.orders.length,
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

