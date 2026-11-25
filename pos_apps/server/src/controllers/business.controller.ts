import { Request, Response } from 'express';
import { z } from 'zod';
import { Role, BusinessVerticalMode } from '@prisma/client';
import { prisma } from '../config/prisma';
import { locationDualWriteService } from '../services/dual_write';
import { invalidateOutletsCache } from './outlet.controller';
import { clearLaundryOutletScopeCache } from '../services/laundry_analytics/laundryOutletScope.helper';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

const feeItemSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1, 'Nama biaya tidak boleh kosong'),
    type: z.enum(['PERCENTAGE', 'FIXED']),
    rate: z.number().min(0, 'Nilai biaya tidak boleh negatif'),
    channelScope: z
      .enum([
        'ALL',
        'DINE_IN',
        'TAKEAWAY',
        'GOFOOD',
        'GRABFOOD',
        'SHOPEEFOOD',
        'DELIVERY',
        'ONLINE_DELIVERY',
      ])
      .default('ALL'),
    isActive: z.boolean().default(true),
    category: z.enum(['DEFAULT_TAX_SERVICE', 'ON_DEMAND_PACKAGING']).optional(),
    isQuickAccess: z.boolean().optional(),
  })
  .passthrough();

const defaultFees = [
  {
    id: 'fee_tax',
    name: 'PPN / PB1 Pajak',
    type: 'PERCENTAGE',
    rate: 10,
    channelScope: 'ALL',
    isActive: false,
  },
  {
    id: 'fee_service',
    name: 'Biaya Layanan (Service Charge)',
    type: 'PERCENTAGE',
    rate: 5,
    channelScope: 'DINE_IN',
    isActive: false,
  },
  {
    id: 'fee_box',
    name: 'Biaya Kemasan Box / Takeaway',
    type: 'FIXED',
    rate: 2000,
    channelScope: 'TAKEAWAY',
    isActive: false,
  },
];

const createBusinessSchema = z.object({
  name: z.string().trim().min(2, 'Nama bisnis minimal 2 karakter').max(100, 'Nama bisnis maksimal 100 karakter'),
  vertical: z.enum(['FNB', 'RETAIL', 'LAUNDRY']),
  subCategory: z.string().trim().optional().nullable(),
  logoUrl: z.string().trim().optional().nullable(),
  initialOutlet: z.object({
    name: z.string().trim().min(2, 'Nama toko / cabang minimal 2 karakter'),
    address: z.string().trim().optional().nullable(),
    phone: z.string().trim().optional().nullable(),
    isWorkshop: z.boolean().optional(),
  }),
});

const updateBusinessSchema = z.object({
  name: z.string().trim().min(2, 'Nama bisnis minimal 2 karakter').max(100).optional(),
  vertical: z.enum(['FNB', 'RETAIL', 'LAUNDRY']).optional(),
  subCategory: z.string().trim().optional().nullable(),
  logoUrl: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * Controller: Mengambil Daftar Bisnis Milik Tenant
 * @route GET /api/businesses
 */
export const getBusinesses = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const userRole = req.user?.role;
    const userOutletId = req.user?.outletId;

    let targetBusinessId: string | null = null;
    if (userRole !== Role.OWNER && userOutletId) {
      const userOutlet = await prisma.outlet.findFirst({
        where: { id: userOutletId, tenantId },
        select: { businessId: true },
      });
      if (userOutlet?.businessId) {
        targetBusinessId = userOutlet.businessId;
      }
    }

    const whereClause: any = { tenantId };
    if (targetBusinessId) {
      whereClause.id = targetBusinessId;
    }

    const businesses = await prisma.business.findMany({
      where: whereClause,
      include: {
        outlets: {
          select: {
            id: true,
            tenantId: true,
            businessId: true,
            code: true,
            name: true,
            merchantName: true,
            address: true,
            phone: true,
            industries: true,
            isWarehouse: true,
            isWorkshop: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                users: true,
                orders: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Hitung total active outlets dan total valid orders per bisnis
    const businessesWithMetrics = await Promise.all(
      businesses.map(async (bus) => {
        const outletIds = bus.outlets.map((o) => o.id);
        const totalActiveOutlets = bus.outlets.filter((o) => o.isActive).length;

        let totalValidOrders = 0;
        if (outletIds.length > 0) {
          totalValidOrders = await prisma.order.count({
            where: {
              tenantId,
              outletId: { in: outletIds },
              orderStatus: { notIn: ['CANCELLED', 'VOIDED'] },
            },
          });
        }

        return {
          ...bus,
          totalActiveOutlets,
          totalValidOrders,
        };
      })
    );

    return res.status(200).json({
      status: 'success',
      data: businessesWithMetrics,
    });
  } catch (error) {
    console.error('Error saat mengambil daftar bisnis:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat daftar bisnis' });
  }
};

/**
 * Controller: Buat Bisnis Baru Beserta Outlet Pertama
 * @route POST /api/businesses
 */
export const createBusiness = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    if (req.user?.role !== Role.OWNER) {
      return res.status(403).json({
        status: 'error',
        message: 'Hanya pemilik akun (Owner) yang berwenang membuat entitas bisnis baru',
      });
    }

    const parseResult = createBusinessSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Data bisnis tidak valid',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { name, vertical, subCategory, logoUrl, initialOutlet } = parseResult.data;

    // Generate unique slug within tenant
    const baseSlug = slugify(name) || 'business';
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await prisma.business.findUnique({
        where: { tenantId_slug: { tenantId, slug } },
        select: { id: true },
      });
      if (!existing) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Tentukan default industries berdasarkan vertical
    let industriesArray: string[];
    if (vertical === 'LAUNDRY') {
      industriesArray = ['LAUNDRY'];
    } else if (vertical === 'FNB') {
      industriesArray = ['FOOD_AND_BEVERAGE'];
    } else {
      industriesArray = ['RETAIL'];
    }

    const isWorkshop = initialOutlet.isWorkshop ?? (vertical === 'LAUNDRY');

    const result = await prisma.$transaction(async (tx) => {
      // 1. Buat record Business
      const newBusiness = await tx.business.create({
        data: {
          tenantId,
          name,
          slug,
          vertical,
          subCategory: subCategory || null,
          logoUrl: logoUrl || null,
          isActive: true,
        },
      });

      // 2. Buat initial Outlet dan Default StorageLocation via DualWriteService
      const dwResult = await locationDualWriteService.createOutlet(
        {
          name: initialOutlet.name,
          address: initialOutlet.address || undefined,
          phone: initialOutlet.phone || undefined,
          isWarehouse: false,
          feesConfig: defaultFees,
        },
        { tx, tenantId, actorUserId: req.user?.id }
      );

      const outletId = dwResult.legacyData.id;

      // 3. Kaitkan outlet dengan businessId, industries, dan isWorkshop
      const updatedOutlet = await tx.outlet.update({
        where: { id: outletId },
        data: {
          businessId: newBusiness.id,
          industries: industriesArray,
          isWorkshop,
        },
      });

      return {
        business: newBusiness,
        outlet: updatedOutlet,
      };
    });

    // Invalidate cache outlet & scope laundry tenant
    invalidateOutletsCache(tenantId);
    clearLaundryOutletScopeCache(tenantId);

    return res.status(201).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    console.error('Error saat membuat bisnis baru:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal membuat bisnis baru' });
  }
};

/**
 * Controller: Perbarui Informasi Bisnis
 * @route PATCH /api/businesses/:id
 */
export const updateBusiness = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    if (req.user?.role !== Role.OWNER) {
      return res.status(403).json({
        status: 'error',
        message: 'Hanya pemilik akun (Owner) yang berwenang mengubah profil bisnis',
      });
    }

    const parseResult = updateBusinessSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Data pembaruan bisnis tidak valid',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const existingBusiness = await prisma.business.findFirst({
      where: { id, tenantId },
      include: { outlets: { select: { id: true } } },
    });

    if (!existingBusiness) {
      return res.status(404).json({ status: 'error', message: 'Bisnis tidak ditemukan' });
    }

    const { name, vertical, subCategory, logoUrl, isActive } = parseResult.data;

    // Guardrail: Jika mengubah vertical, periksa apakah sudah ada order aktif
    if (vertical && vertical !== existingBusiness.vertical) {
      const outletIds = existingBusiness.outlets.map((o) => o.id);
      if (outletIds.length > 0) {
        const orderCount = await prisma.order.count({
          where: {
            tenantId,
            outletId: { in: outletIds },
            orderStatus: { notIn: ['CANCELLED', 'VOIDED'] },
          },
        });

        if (orderCount > 0) {
          return res.status(400).json({
            status: 'error',
            message:
              'Jenis vertikal bisnis tidak dapat diubah karena bisnis ini sudah memiliki riwayat transaksi aktif.',
          });
        }
      }
    }

    const updated = await prisma.business.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(vertical !== undefined && { vertical }),
        ...(subCategory !== undefined && { subCategory: subCategory || null }),
        ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        outlets: true,
      },
    });

    // Invalidate cache outlet & scope laundry tenant
    invalidateOutletsCache(tenantId);
    clearLaundryOutletScopeCache(tenantId);

    return res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    console.error('Error saat memperbarui bisnis:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui data bisnis' });
  }
};

/**
 * Controller: Ringkasan 1 Dompet Token Bersama (Pay-As-You-Go) Milik Tenant
 * @route GET /api/businesses/token-summary
 */
export const getTokenSummary = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    if (req.user?.role !== Role.OWNER) {
      return res.status(403).json({
        status: 'error',
        message: 'Hanya pemilik akun (Owner) yang berwenang melihat ringkasan token bersama',
      });
    }

    // 1. Total Token dari Faktur Berbayar (PAID invoices)
    const paidInvoices = await prisma.saaSInvoice.findMany({
      where: {
        tenantId,
        status: 'PAID',
        tokenAmount: { gt: 0 },
      },
      select: { tokenAmount: true },
    });
    const sumTokens = paidInvoices.reduce((acc, inv) => acc + (inv.tokenAmount || 0), 0);

    // 2. Ambil kuota bawaan paket jika belum ada pembelian token
    let totalPurchasedTokens = sumTokens;
    if (totalPurchasedTokens === 0) {
      const sub = await prisma.tenantSubscription.findFirst({
        where: { tenantId, isActive: true },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });
      let planQuota = 500;
      if (sub?.plan?.code === 'ENTERPRISE') planQuota = 5000;
      else if (sub?.plan?.code === 'PRO') planQuota = 2000;
      else if (sub?.plan?.code === 'STARTER') planQuota = 1000;
      else if ((sub?.plan?.features as any)?.tokenQuota) {
        planQuota = Number((sub?.plan?.features as any).tokenQuota) || 500;
      }
      totalPurchasedTokens = planQuota;
    }

    // 3. Hitung jumlah order aktif non-void tenant-wide
    const totalUsedTokens = await prisma.order.count({
      where: {
        tenantId,
        orderStatus: { notIn: ['CANCELLED', 'VOIDED'] },
      },
    });

    const remainingTokens = Math.max(0, totalPurchasedTokens - totalUsedTokens);

    // 4. Hitung run-rate 30 hari terakhir
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ordersLast30d = await prisma.order.count({
      where: {
        tenantId,
        orderStatus: { notIn: ['CANCELLED', 'VOIDED'] },
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const dailyBurnRate = Number((ordersLast30d / 30).toFixed(2));
    const estimatedDaysLeft = dailyBurnRate > 0 ? Math.round(remainingTokens / dailyBurnRate) : null;

    // 5. Konsumsi token per bisnis
    const businesses = await prisma.business.findMany({
      where: { tenantId },
      include: {
        outlets: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const usageByBusiness = await Promise.all(
      businesses.map(async (bus) => {
        const outletIds = bus.outlets.map((o) => o.id);
        let busTotalOrders = 0;
        let busOrdersLast30d = 0;

        if (outletIds.length > 0) {
          busTotalOrders = await prisma.order.count({
            where: {
              tenantId,
              outletId: { in: outletIds },
              orderStatus: { notIn: ['CANCELLED', 'VOIDED'] },
            },
          });

          busOrdersLast30d = await prisma.order.count({
            where: {
              tenantId,
              outletId: { in: outletIds },
              orderStatus: { notIn: ['CANCELLED', 'VOIDED'] },
              createdAt: { gte: thirtyDaysAgo },
            },
          });
        }

        return {
          businessId: bus.id,
          businessName: bus.name,
          vertical: bus.vertical,
          totalOrders: busTotalOrders,
          ordersLast30d: busOrdersLast30d,
        };
      })
    );

    // 6. Riwayat 10 Faktur SaaS Terbaru
    const recentInvoices = await prisma.saaSInvoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        amount: true,
        tokenAmount: true,
        createdAt: true,
        paidAt: true,
      },
    });

    return res.status(200).json({
      status: 'success',
      data: {
        totalPurchasedTokens,
        totalUsedTokens,
        remainingTokens,
        ordersLast30d,
        dailyBurnRate,
        estimatedDaysLeft,
        usageByBusiness,
        recentInvoices,
      },
    });
  } catch (error) {
    console.error('Error saat mengambil ringkasan token bersama:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat ringkasan token' });
  }
};
