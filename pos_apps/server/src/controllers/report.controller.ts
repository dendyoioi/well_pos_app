import { Request, Response } from 'express';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { prisma } from '../config/prisma';

/**
 * Controller: Laporan Finansial & Akuntansi Sederhana
 * @route GET /api/reports/financial
 */
export const getFinancialSummary = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenantId;
    if (tenantId) {
      const activeSub = await prisma.tenantSubscription.findFirst({
        where: { tenantId, isActive: true },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });

      if (activeSub && activeSub.plan.code === 'FREE') {
        return res.status(403).json({
          status: 'error',
          code: 'PRO_FEATURE_REQUIRED',
          isLocked: true,
          message: 'Fitur Laporan Laba Kotor & Analisis HPP hanya tersedia pada Paket Pro. Silakan upgrade paket bisnis Anda untuk mengaktifkan fitur ini!',
        });
      }
    }

    const { startDate, endDate, outletId } = req.query;

    let targetOutletId = (outletId as string) || user?.outletId;
    if (outletId === 'ALL') {
      targetOutletId = undefined;
    }

    // Tentukan filter rentang tanggal
    const now = new Date();
    let start: Date;
    let end: Date;

    if (startDate) {
      start = new Date(`${startDate}T00:00:00.000Z`);
    } else {
      // Default: 30 hari terakhir
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start.setUTCHours(0, 0, 0, 0);
    }

    if (endDate) {
      end = new Date(`${endDate}T23:59:59.999Z`);
    } else {
      end = new Date(now);
      end.setUTCHours(23, 59, 59, 999);
    }

    // Ambil seluruh order penjualan yang berhasil lunas (PAID) dalam rentang tanggal
    const orders = await prisma.order.findMany({
      where: {
        paymentStatus: PaymentStatus.PAID,
        ...(tenantId ? { tenantId } : {}),
        outletId: targetOutletId || undefined,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        orderItems: {
          include: {
            product: {
              include: { category: { select: { id: true, name: true } } },
            },
          },
        },
        payments: true,
        outlet: { select: { id: true, name: true } },
        cashier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 1. Kalkulasi Metrik Finansial Utama
    let totalGrossSales = 0;
    let totalDiscounts = 0;
    let totalTax = 0;
    let totalService = 0;
    let totalNetRevenue = 0;
    let totalCOGS = 0; // HPP (Cost of Goods Sold)

    // 2. Arus Kas (Metode Pembayaran)
    let cashSalesTotal = 0;
    let cashSalesCount = 0;
    let qrisSalesTotal = 0;
    let qrisSalesCount = 0;

    // 3. Peta Penjualan per Produk & Kategori
    const productStatsMap = new Map<
      string,
      {
        id: string;
        name: string;
        sku: string;
        categoryName: string;
        qtySold: number;
        revenue: number;
        cost: number;
      }
    >();

    const categoryStatsMap = new Map<
      string,
      {
        id: string;
        name: string;
        qtySold: number;
        revenue: number;
      }
    >();

    // 4. Tren Harian
    const dailyMap = new Map<
      string,
      {
        date: string;
        ordersCount: number;
        revenue: number;
        cogs: number;
        grossProfit: number;
        cashRevenue: number;
        qrisRevenue: number;
      }
    >();

    orders.forEach((order) => {
      const orderNet = Number(order.grandTotal);
      const orderGross = Number(order.subtotal);
      const orderDisc = Number(order.discountAmount);
      const orderTax = Number(order.taxAmount);
      const orderSvc = Number(order.serviceCharge);
      const orderCost = Number(order.totalCost);

      totalGrossSales += orderGross;
      totalDiscounts += orderDisc;
      totalTax += orderTax;
      totalService += orderSvc;
      totalNetRevenue += orderNet;
      totalCOGS += orderCost;

      // Payments
      order.payments.forEach((p) => {
        if (p.method === PaymentMethod.CASH) {
          cashSalesTotal += Number(order.grandTotal);
          cashSalesCount += 1;
        } else if (p.method === PaymentMethod.QRIS) {
          qrisSalesTotal += Number(order.grandTotal);
          qrisSalesCount += 1;
        }
      });

      // Produk & Kategori
      order.orderItems.forEach((item) => {
        const prod = item.product;
        const itemSubtotal = Number(item.subtotal);
        const itemCost = Number(item.costPrice) * item.quantity;
        const catName = prod.category?.name || 'Lainnya';
        const catId = prod.categoryId;

        // Stat Produk
        if (!productStatsMap.has(prod.id)) {
          productStatsMap.set(prod.id, {
            id: prod.id,
            name: prod.name,
            sku: prod.sku,
            categoryName: catName,
            qtySold: 0,
            revenue: 0,
            cost: 0,
          });
        }
        const pStat = productStatsMap.get(prod.id)!;
        pStat.qtySold += item.quantity;
        pStat.revenue += itemSubtotal;
        pStat.cost += itemCost;

        // Stat Kategori
        if (!categoryStatsMap.has(catId)) {
          categoryStatsMap.set(catId, {
            id: catId,
            name: catName,
            qtySold: 0,
            revenue: 0,
          });
        }
        const cStat = categoryStatsMap.get(catId)!;
        cStat.qtySold += item.quantity;
        cStat.revenue += itemSubtotal;
      });

      // Daily Trend grouping
      const dateKey = order.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: dateKey,
          ordersCount: 0,
          revenue: 0,
          cogs: 0,
          grossProfit: 0,
          cashRevenue: 0,
          qrisRevenue: 0,
        });
      }
      const dayStat = dailyMap.get(dateKey)!;
      dayStat.ordersCount += 1;
      dayStat.revenue += orderNet;
      dayStat.cogs += orderCost;
      dayStat.grossProfit += orderNet - orderTax - orderCost;
      if (order.payments[0]?.method === PaymentMethod.CASH) {
        dayStat.cashRevenue += orderNet;
      } else {
        dayStat.qrisRevenue += orderNet;
      }
    });

    // Laba Kotor (Gross Profit): Net Revenue (tanpa PPN titipan pajak) - COGS/HPP
    const netSalesExTax = Math.max(0, totalNetRevenue - totalTax);
    const grossProfit = netSalesExTax - totalCOGS;
    const grossProfitMargin =
      netSalesExTax > 0 ? Number(((grossProfit / netSalesExTax) * 100).toFixed(2)) : 0;

    const totalTransactions = orders.length;
    const averageOrderValue =
      totalTransactions > 0 ? Math.round(totalNetRevenue / totalTransactions) : 0;

    // Sort Top Products by Qty Sold
    const topProducts = Array.from(productStatsMap.values())
      .map((p) => ({
        ...p,
        profit: p.revenue - p.cost,
        profitMargin: p.revenue > 0 ? Number((((p.revenue - p.cost) / p.revenue) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.qtySold - a.qtySold)
      .slice(0, 10);

    // Ambil seluruh produk terdaftar di outlet untuk identifikasi Slow-Moving Items
    const allProducts = await prisma.product.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        isActive: true,
      },
      include: {
        category: { select: { name: true } },
        outletProducts: {
          where: targetOutletId ? { outletId: targetOutletId } : undefined,
          select: { stock: true },
        },
      },
    });

    const slowMovingProducts = allProducts
      .map((p) => {
        const soldStat = productStatsMap.get(p.id);
        const currentStock = p.outletProducts[0]?.stock ?? 0;
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          categoryName: p.category?.name || 'Lainnya',
          currentStock,
          costPrice: Number(p.costPrice),
          basePrice: Number(p.basePrice),
          qtySold: soldStat?.qtySold || 0,
          revenue: soldStat?.revenue || 0,
          deadStockValue: (soldStat?.qtySold || 0) === 0 ? currentStock * Number(p.costPrice) : 0,
        };
      })
      .filter((p) => p.qtySold <= 2 && p.currentStock > 0)
      .sort((a, b) => a.qtySold - b.qtySold || b.currentStock - a.currentStock)
      .slice(0, 10);

    // Categories with percentage
    const salesByCategory = Array.from(categoryStatsMap.values())
      .map((c) => ({
        ...c,
        percentage:
          totalGrossSales > 0 ? Number(((c.revenue / totalGrossSales) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Daily trends sorted ascending
    const dailyTrends = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return res.status(200).json({
      status: 'success',
      data: {
        filter: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          outletId: targetOutletId,
        },
        financialSummary: {
          totalGrossSales,
          totalDiscounts,
          totalService,
          totalTax,
          totalNetRevenue,
          totalCOGS,
          netSalesExTax,
          grossProfit,
          grossProfitMargin,
          totalTransactions,
          averageOrderValue,
        },
        cashFlow: {
          cash: {
            amount: cashSalesTotal,
            count: cashSalesCount,
            percentage:
              totalNetRevenue > 0
                ? Number(((cashSalesTotal / totalNetRevenue) * 100).toFixed(2))
                : 0,
          },
          qris: {
            amount: qrisSalesTotal,
            count: qrisSalesCount,
            percentage:
              totalNetRevenue > 0
                ? Number(((qrisSalesTotal / totalNetRevenue) * 100).toFixed(2))
                : 0,
          },
        },
        topProducts,
        slowMovingProducts,
        salesByCategory,
        dailyTrends,
      },
    });
  } catch (error: any) {
    console.error('Error saat memuat laporan finansial:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat laporan finansial' });
  }
};
