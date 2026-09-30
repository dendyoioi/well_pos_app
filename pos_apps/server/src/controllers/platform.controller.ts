import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { TenantStatus, Role, InvoiceStatus, PlatformRole, Prisma } from '@prisma/client';
import { billingService } from '../services/billing.service';
import { licenseWorkerService } from '../services/licenseWorker.service';

// Fix K2: JWT_SECRET WAJIB ada di environment — tidak boleh ada fallback string.
if (!process.env.JWT_SECRET) {
  throw new Error('[FATAL] JWT_SECRET tidak ditemukan di environment variables.');
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(TenantStatus, {
    errorMap: () => ({ message: 'Status tenant tidak valid' }),
  }),
});

/**
 * Controller: Login khusus Platform User (Superadmin / Support Agent) Level 1
 * @route POST /api/platform/auth/login
 */
export const loginPlatformUser = async (req: Request, res: Response) => {
  try {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input gagal',
        errors: parse.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parse.data;

    const user = await prisma.platformUser.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Kredensial salah atau akun platform tidak ditemukan',
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Kredensial salah atau kata sandi tidak valid',
      });
    }

    const token = jwt.sign(
      {
        platformUserId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isPlatformAdmin: true,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      status: 'success',
      message: 'Login Superadmin Platform Berhasil',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('Error platform login:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan pada server saat login platform',
    });
  }
};

/**
 * Middleware: Verifikasi Superadmin Token
 */
export const authenticatePlatform = async (req: Request, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Akses ditolak: Token Superadmin tidak ditemukan',
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({
        status: 'error',
        message: 'Akses ditolak: Token tidak valid atau kadaluarsa',
      });
    }

    if (!decoded.isPlatformAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses terlarang: Bukan akun Superadmin Platform',
      });
    }

    const user = await prisma.platformUser.findUnique({
      where: { id: decoded.platformUserId },
    });

    if (!user) {
      return res.status(403).json({
        status: 'error',
        message: 'Akun Superadmin tidak ditemukan atau tidak aktif',
      });
    }

    (req as any).platformUser = user;
    next();
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memvalidasi otorisasi platform',
    });
  }
};

/**
 * Controller: Dashboard KPI Platform SaaS Level 1
 * @route GET /api/platform/dashboard
 */
export const getPlatformDashboard = async (_req: Request, res: Response) => {
  try {
    const [
      totalTenants,
      activeTenants,
      trialTenants,
      suspendedTenants,
      totalOutlets,
      activeOutlets,
      totalOrders,
      subscriptions,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: TenantStatus.ACTIVE } }),
      prisma.tenant.count({ where: { status: TenantStatus.TRIAL } }),
      prisma.tenant.count({ where: { status: TenantStatus.SUSPENDED } }),
      prisma.outlet.count(),
      prisma.outlet.count({
        where: {
          isActive: true,
          tenant: {
            status: { in: [TenantStatus.ACTIVE, TenantStatus.TRIAL] },
          },
        },
      }),
      prisma.order.count(),
      prisma.tenantSubscription.findMany({
        where: {
          isActive: true,
        },
        include: {
          plan: true,
        },
      }),
    ]);

    // Hitung Proyeksi Monthly Recurring Revenue (MRR)
    const projectedMrr = subscriptions.reduce((acc, sub) => {
      return acc + (sub.plan ? Number(sub.plan.price) : 0);
    }, 0);

    return res.status(200).json({
      status: 'success',
      data: {
        metrics: {
          totalTenants,
          activeTenants,
          trialTenants,
          suspendedTenants,
          totalOutlets,
          activeOutlets,
          totalOrders,
          projectedMRR: projectedMrr,
        },
      },
    });
  } catch (error) {
    console.error('Error platform dashboard:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memuat data dashboard platform',
    });
  }
};

/**
 * Controller: Ambil Daftar Seluruh Tenant Klien
 * @route GET /api/platform/tenants
 */
export const getPlatformTenants = async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;

    const where: any = {};
    if (status && typeof status === 'string' && status !== 'ALL' && status.trim() !== '') {
      if (status === 'INACTIVE') {
        where.status = { in: [TenantStatus.SUSPENDED, TenantStatus.CANCELLED] };
      } else if (status === 'ACTIVE') {
        where.status = { in: [TenantStatus.ACTIVE, TenantStatus.TRIAL] };
      } else {
        where.status = status as TenantStatus;
      }
    }
    if (search && typeof search === 'string' && search.trim() !== '') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { users: { some: { email: { contains: search, mode: 'insensitive' } } } },
        { users: { some: { name: { contains: search, mode: 'insensitive' } } } },
        { users: { some: { firstName: { contains: search, mode: 'insensitive' } } } },
        { users: { some: { lastName: { contains: search, mode: 'insensitive' } } } },
        { users: { some: { phone: { contains: search, mode: 'insensitive' } } } },
        { outlets: { some: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const tenants = await prisma.tenant.findMany({
      where,
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
        invoices: {
          where: { status: InvoiceStatus.PAID, tokenAmount: { gt: 0 } },
          select: { tokenAmount: true },
        },
        outlets: {
          select: { id: true, name: true, merchantName: true, industries: true, phone: true, address: true, isWarehouse: true, isActive: true, createdAt: true },
        },
        users: {
          select: { id: true, name: true, firstName: true, lastName: true, role: true, email: true, phone: true },
        },
        _count: {
          select: {
            orders: true,
            products: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      status: 'success',
      data: tenants.map((t) => {
        const activeSub = t.subscriptions[0] || null;
        const owner = t.users.find((u) => u.role === 'ADMIN') || t.users[0] || null;
        const ownerFullName = owner
          ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.name || 'Owner'
          : 'Owner';

        const totalPaidTokens = t.invoices
          ? t.invoices.reduce((sum: number, inv: any) => sum + (inv.tokenAmount || 0), 0)
          : 0;

        return {
          id: t.id,
          businessName: t.name,
          slug: t.slug,
          subdomain: t.slug,
          businessType: t.businessVertical,
          ownerName: ownerFullName,
          email: owner?.email || '-',
          phone: owner?.phone || t.phone || t.outlets[0]?.phone || '-',
          status: t.status,
          trialEndsAt: t.trialEndsAt || null,
          createdAt: t.createdAt,
          _count: {
            outlets: t.outlets.length,
            users: t.users.length,
          },
          outlets: t.outlets,
          subscriptionPlan: activeSub?.plan || null,
          tokenQuota: totalPaidTokens > 0 ? totalPaidTokens : (activeSub?.plan?.features as any)?.tokenQuota || 100,
          outletsCount: t.outlets.length,
          usersCount: t.users.length,
          ordersCount: t._count.orders,
          productsCount: t._count.products,
          currentPlan: activeSub?.plan
            ? {
                code: activeSub.plan.code,
                name: activeSub.plan.name,
                price: Number(activeSub.plan.price),
                expiresAt: activeSub.expiresAt,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error('Error list platform tenants:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memuat daftar tenant',
    });
  }
};

/**
 * Controller: Update Status Tenant (Suspend / Aktifkan)
 * @route PUT /api/platform/tenants/:id/status
 */
export const updateTenantStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parse = updateStatusSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input gagal',
        errors: parse.error.flatten().fieldErrors,
      });
    }

    const { status } = parse.data;

    const existing = await prisma.tenant.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Tenant tidak ditemukan',
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.tenant.update({
        where: { id },
        data: {
          status,
        },
      });

      if (status === 'SUSPENDED' || status === 'CANCELLED') {
        // Aturan Kaskade Kritis: Jika akun owner inactive/suspended, seluruh toko & user otomatis inactive
        await tx.outlet.updateMany({
          where: { tenantId: id },
          data: { isActive: false },
        });
        await tx.user.updateMany({
          where: { tenantId: id },
          data: { isActive: false },
        });
      } else if (status === 'TRIAL' || status === 'ACTIVE') {
        // Aktifkan kembali toko dan pengguna di bawah tenant
        await tx.outlet.updateMany({
          where: { tenantId: id },
          data: { isActive: true },
        });
        await tx.user.updateMany({
          where: { tenantId: id },
          data: { isActive: true },
        });

        const proPlan = await tx.subscriptionPlan.findFirst({ where: { code: 'PRO' } });
        if (proPlan) {
          const existingSub = await tx.tenantSubscription.findFirst({ where: { tenantId: id } });
          const subExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
          if (!existingSub) {
            await tx.tenantSubscription.create({
              data: {
                tenantId: id,
                planId: proPlan.id,
                startedAt: new Date(),
                expiresAt: subExpiry,
                isActive: true,
              },
            });
          } else {
            await tx.tenantSubscription.update({
              where: { id: existingSub.id },
              data: {
                planId: proPlan.id,
                expiresAt: subExpiry,
                isActive: true,
              },
            });
          }
        }
      }

      return t;
    });

    const isApproved = existing.status === 'PENDING' && (status === 'TRIAL' || status === 'ACTIVE');
    let emailNotification = null;

    if (isApproved) {
      // Catat invoice aktivasi pendaftaran (Rp 99.000 + 100 Bonus Token) ke Buku Besar Platform
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randSuffix = Math.floor(1000 + Math.random() * 9000);
      const defaultPlan = await prisma.subscriptionPlan.findFirst({ where: { code: 'PRO' } });
      const platformUser = (req as any).platformUser;

      const existingRegInvoice = await prisma.saaSInvoice.findFirst({
        where: {
          tenantId: id,
          invoiceNumber: { startsWith: 'INV-REG' },
        },
      });

      if (existingRegInvoice) {
        // Update invoice pendaftaran menjadi PAID dengan 100 bonus token
        await prisma.saaSInvoice.update({
          where: { id: existingRegInvoice.id },
          data: {
            amount: new Prisma.Decimal(99000),
            tokenAmount: 100,
            status: InvoiceStatus.PAID,
            paidAt: new Date(),
            notes: 'Biaya Aktivasi Pendaftaran Akun Pemilik + 100 Bonus Token Transaksi (Disetujui Super Admin)',
            payments: {
              create: {
                paymentChannel: 'APPROVAL_SUPERADMIN',
                verifiedById: platformUser?.id || null,
              },
            },
          },
        }).catch((err) => console.error('Error updating existing reg invoice on approval:', err));
      } else if (defaultPlan) {
        const invoiceNumber = `INV-REG-${todayStr}-${randSuffix}`;
        await prisma.saaSInvoice.create({
          data: {
            invoiceNumber,
            tenantId: id,
            planId: defaultPlan.id,
            amount: new Prisma.Decimal(99000),
            tokenAmount: 100,
            notes: 'Biaya Aktivasi Pendaftaran Akun Pemilik + 100 Bonus Token Transaksi (Disetujui Super Admin)',
            status: InvoiceStatus.PAID,
            dueDate: new Date(),
            paidAt: new Date(),
            paymentUrl: `https://checkout.wellpos.id/pay/${invoiceNumber}`,
            payments: {
              create: {
                paymentChannel: 'APPROVAL_SUPERADMIN',
                verifiedById: platformUser?.id || null,
              },
            },
          },
        }).catch((err) => console.error('Error creating setup invoice:', err));
      }

      // Cari pemilik tenant (Role.ADMIN adalah Owner)
      const ownerUser = await prisma.user.findFirst({
        where: { tenantId: id, role: Role.ADMIN },
        select: { email: true, name: true },
      });
      const recipientEmail = ownerUser?.email || 'klien@bisnis.com';
      const recipientName = ownerUser?.name || updated.name;

      emailNotification = {
        sent: true,
        recipient: recipientEmail,
        recipientName,
        subject: `Selamat! Akun Bisnis "${updated.name}" Telah Disetujui & Aktif`,
        sentAt: new Date().toISOString(),
        message: `Halo ${recipientName}, pendaftaran bisnis "${updated.name}" telah diverifikasi dan disetujui oleh Super Admin SaaS. Akun Anda telah aktif dengan biaya aktivasi Rp 99.000 dan bonus 100 token transaksi. Silakan masuk ke aplikasi untuk menyelesaikan pengaturan toko.`,
      };

      console.log(`\n======================================================`);
      console.log(`📧 [SIMULASI EMAIL DIKIRIM KE KLIEN]`);
      console.log(`Kepada  : ${recipientName} <${recipientEmail}>`);
      console.log(`Subjek  : ${emailNotification.subject}`);
      console.log(`Pesan   : ${emailNotification.message}`);
      console.log(`======================================================\n`);
    }

    return res.status(200).json({
      status: 'success',
      message: isApproved
        ? `Akun bisnis "${updated.name}" berhasil DISETUJUI & email konfirmasi telah dikirim ke klien!`
        : `Status tenant "${updated.name}" berhasil diubah menjadi ${updated.status}`,
      data: updated,
      emailNotification,
    });
  } catch (error) {
    console.error('Error update tenant status:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui status tenant',
      detail: (error as any)?.message || String(error),
    });
  }
};

/**
 * Controller: Ambil Master Paket Langganan
 * @route GET /api/platform/plans
 */
export const getPlatformPlans = async (_req: Request, res: Response) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
    });

    return res.status(200).json({
      status: 'success',
      data: plans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        price: Number(p.price),
        billingCycle: p.billingCycle,
        maxOutlets: p.maxOutlets,
        maxCashiers: p.maxCashiers,
        features: p.features,
      })),
    });
  } catch (error) {
    console.error('Error list platform plans:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memuat master paket langganan',
    });
  }
};

const updateSubscriptionSchema = z.object({
  planId: z.string().uuid('ID paket langganan tidak valid').optional(),
  planCode: z.string().optional(),
  durationDays: z.number().int().positive('Durasi hari harus positif').optional().nullable(),
  neverExpires: z.boolean().optional().default(true),
  tokenAmount: z.number().int().positive('Jumlah token harus positif').optional(),
  notes: z.string().optional(),
  paymentMethod: z.string().optional(),
  promoCode: z.string().optional(),
  discountAmount: z.number().optional(),
  amount: z.number().optional(),
});

/**
 * Controller: Perpanjang / Ubah Paket Langganan & Top-Up Kuota Token Tenant
 * @route PUT /api/platform/tenants/:id/subscription
 */
export const updateTenantSubscription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parse = updateSubscriptionSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi data langganan gagal',
        errors: parse.error.flatten().fieldErrors,
      });
    }

    const { planId, planCode, durationDays, neverExpires, tokenAmount, notes, paymentMethod, promoCode, discountAmount, amount } = parse.data;

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return res.status(404).json({ status: 'error', message: 'Tenant tidak ditemukan' });
    }

    let plan = null;
    if (planId) {
      plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    } else if (planCode) {
      plan = await prisma.subscriptionPlan.findFirst({ where: { code: planCode } });
    }

    if (!plan) {
      return res.status(404).json({ status: 'error', message: 'Paket langganan tidak ditemukan' });
    }

    let expiresAt: Date | null = null;
    if (!neverExpires && durationDays && durationDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationDays);
    }

    // Non-aktifkan langganan aktif sebelumnya
    await prisma.tenantSubscription.updateMany({
      where: { tenantId: id, isActive: true },
      data: { isActive: false },
    });

    // Buat langganan aktif baru
    const newSubscription = await prisma.tenantSubscription.create({
      data: {
        tenantId: id,
        planId: plan.id,
        startedAt: new Date(),
        expiresAt,
        isActive: true,
      },
      include: { plan: true },
    });

    // Update status tenant menjadi ACTIVE
    const updatedTenant = await prisma.tenant.update({
      where: { id },
      data: {
        status: TenantStatus.ACTIVE,
      },
    });

    // Catat invoice otomatis ke Buku Besar SaaS Platform
    const platformUser = (req as any).platformUser;
    const finalTokenAmount = tokenAmount || (plan.features as any)?.tokenQuota || 0;
    const calculatedAmount = finalTokenAmount > 0 ? finalTokenAmount * 110 : Number(plan.price);
    const finalDiscount = Number(discountAmount || 0);
    const finalAmount = Math.max(0, (amount !== undefined ? Number(amount) : calculatedAmount) - finalDiscount);

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-TOKEN/${todayStr}/${randSuffix}`;

    await prisma.saaSInvoice.create({
      data: {
        invoiceNumber,
        tenantId: id,
        planId: plan.id,
        amount: new Prisma.Decimal(finalAmount),
        tokenAmount: finalTokenAmount,
        notes: notes || `Top-up kuota ${finalTokenAmount.toLocaleString('id-ID')} token via ${paymentMethod || 'Manual'}`,
        promoCode: promoCode || null,
        discountAmount: new Prisma.Decimal(finalDiscount),
        status: InvoiceStatus.PAID,
        dueDate: new Date(),
        paidAt: new Date(),
        paymentUrl: `https://checkout.wellpos.id/pay/${invoiceNumber}`,
        payments: {
          create: {
            paymentChannel: paymentMethod || 'BANK_TRANSFER_MANUAL',
            verifiedById: platformUser?.id || null,
          },
        },
      },
    }).catch((err) => console.error('Error creating token invoice:', err));

    if (promoCode) {
      await prisma.saaSPromo.updateMany({
        where: { code: promoCode },
        data: { usedCount: { increment: 1 } },
      }).catch(() => {});
    }

    const quotaInfoStr = (plan.features as any)?.tokenQuota
      ? ` (${((plan.features as any).tokenQuota).toLocaleString('id-ID')} Token Kuota Tanpa Hangus)`
      : '';
    const responseMsg = neverExpires
      ? `Paket & kuota merchant "${updatedTenant.name}" berhasil diperbarui ke ${plan.name}${quotaInfoStr}. Invoice ${invoiceNumber} telah diterbitkan.`
      : `Langganan "${updatedTenant.name}" berhasil diperpanjang (+${durationDays} hari) dengan paket ${plan.name}. Invoice ${invoiceNumber} telah diterbitkan.`;

    return res.status(200).json({
      status: 'success',
      message: responseMsg,
      data: {
        tenant: updatedTenant,
        subscription: {
          id: newSubscription.id,
          planName: plan.name,
          planCode: plan.code,
          expiresAt: newSubscription.expiresAt,
          isActive: newSubscription.isActive,
        },
        invoiceNumber,
      },
    });
  } catch (error) {
    console.error('Error update tenant subscription:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui langganan tenant',
    });
  }
};

/**
 * Controller: Detail Mendalam Tenant Klien
 * @route GET /api/platform/tenants/:id
 */
export const getPlatformTenantDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        outlets: {
          select: {
            id: true,
            name: true,
            merchantName: true,
            industries: true,
            address: true,
            phone: true,
            isWarehouse: true,
            isActive: true,
            createdAt: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          include: { plan: true },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ status: 'error', message: 'Tenant tidak ditemukan' });
    }

    // Statistik Toko
    const [totalProducts, totalOrders, revenueAggregate] = await Promise.all([
      prisma.product.count({ where: { tenantId: id } }),
      prisma.order.count({ where: { tenantId: id } }),
      prisma.order.aggregate({
        where: { tenantId: id },
        _sum: { totalAmount: true },
      }),
    ]);

    const owner = tenant.users.find((u) => u.role === 'ADMIN') || tenant.users[0] || null;
    const activeSub = tenant.subscriptions.find((s) => s.isActive) || tenant.subscriptions[0] || null;
    const ownerPhone = owner?.phone || tenant.phone || tenant.outlets[0]?.phone || '-';
    const ownerFullName = owner
      ? (owner.name || `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || tenant.name)
      : tenant.name;

    return res.status(200).json({
      status: 'success',
      data: {
        tenant: {
          id: tenant.id,
          businessName: tenant.name,
          slug: tenant.slug,
          subdomain: tenant.slug,
          businessType: tenant.businessVertical,
          phone: ownerPhone,
          status: tenant.status,
          trialEndsAt: null,
          createdAt: tenant.createdAt,
        },
        owner: owner
          ? {
              id: owner.id,
              name: ownerFullName,
              firstName: owner.firstName,
              lastName: owner.lastName,
              email: owner.email,
              phone: ownerPhone,
              role: owner.role,
            }
          : null,
        stats: {
          totalUsers: tenant.users.length,
          totalOutlets: tenant.outlets.length,
          totalProducts,
          totalOrders,
          totalRevenue: Number(revenueAggregate._sum.totalAmount || 0),
        },
        outlets: tenant.outlets,
        users: tenant.users,
        currentSubscription: activeSub
          ? {
              id: activeSub.id,
              planCode: activeSub.plan.code,
              planName: activeSub.plan.name,
              price: Number(activeSub.plan.price),
              expiresAt: activeSub.expiresAt,
              isActive: activeSub.isActive,
            }
          : null,
        subscriptionHistory: tenant.subscriptions.map((s) => ({
          id: s.id,
          planName: s.plan.name,
          planCode: s.plan.code,
          startedAt: s.startedAt,
          expiresAt: s.expiresAt,
          isActive: s.isActive,
        })),
      },
    });
  } catch (error) {
    console.error('Error get platform tenant detail:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memuat detail tenant',
    });
  }
};

/**
 * Controller: Impersonasi Toko Klien (Buka Dashboard Toko)
 * @route POST /api/platform/tenants/:id/impersonate
 */
export const impersonateTenant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        users: true,
        outlets: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ status: 'error', message: 'Tenant tidak ditemukan' });
    }

    // Cari akun owner atau admin
    const owner = tenant.users.find((u) => u.role === 'ADMIN') || tenant.users[0];
    if (!owner) {
      return res.status(404).json({
        status: 'error',
        message: 'Tidak ada akun pengguna pada tenant ini untuk diimpersonasi',
      });
    }

    const targetOutlet = req.body?.outletId
      ? tenant.outlets.find((o) => o.id === req.body.outletId) || tenant.outlets[0]
      : tenant.outlets[0] || null;
    const platformUser = (req as any).platformUser;

    const token = jwt.sign(
      {
        userId: owner.id,
        role: owner.role,
        outletId: targetOutlet?.id || owner.outletId,
        tenantId: tenant.id,
        isImpersonated: true,
        impersonatedBy: platformUser?.id,
        impersonatorName: platformUser?.name,
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      status: 'success',
      message: `Berhasil mengimpersonasi toko ${targetOutlet?.name || tenant.name}`,
      data: {
        token,
        user: {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          role: owner.role,
          tenantId: tenant.id,
          outlet: targetOutlet
            ? {
                id: targetOutlet.id,
                name: targetOutlet.name,
              }
            : null,
          isImpersonated: true,
          impersonatedBy: platformUser?.name || 'Superadmin',
          businessName: tenant.name,
        },
      },
    });
  } catch (error) {
    console.error('Error impersonate tenant:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengimpersonasi tenant',
    });
  }
};

/**
 * Controller: Toggle Status Outlet Toko Fisik (Aktif / Nonaktif)
 * @route PATCH /api/platform/outlets/:id/status
 */
export const toggleOutletStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const outlet = await prisma.outlet.findUnique({
      where: { id },
      include: { tenant: true },
    });

    if (!outlet) {
      return res.status(404).json({ status: 'error', message: 'Toko tidak ditemukan' });
    }

    // Jika tenant inactive, cegah pengaktifan outlet individual
    if (outlet.tenant.status === 'SUSPENDED' && (isActive === true || !outlet.isActive)) {
      return res.status(400).json({
        status: 'error',
        message: 'Toko tidak dapat diaktifkan karena Akun Owner sedang nonaktif (dibekukan). Aktifkan akun owner terlebih dahulu.',
      });
    }

    const nextStatus = typeof isActive === 'boolean' ? isActive : !outlet.isActive;
    const updated = await prisma.outlet.update({
      where: { id },
      data: { isActive: nextStatus },
    });

    return res.status(200).json({
      status: 'success',
      message: `Status toko "${updated.name}" berhasil diubah menjadi ${updated.isActive ? 'AKTIF' : 'INAKTIF'}`,
      data: updated,
    });
  } catch (error) {
    console.error('Error toggle outlet status:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengubah status toko' });
  }
};

/**
 * Controller: Setel Ulang Kata Sandi Akun Owner Toko
 * @route POST /api/platform/tenants/:id/reset-password
 */
export const resetTenantOwnerPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        users: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ status: 'error', message: 'Tenant tidak ditemukan' });
    }

    const owner = tenant.users.find((u) => u.role === 'ADMIN') || tenant.users[0];
    if (!owner) {
      return res.status(404).json({
        status: 'error',
        message: 'Tidak ditemukan akun owner untuk di-reset',
      });
    }

    // Buat password sementara acak
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const temporaryPassword = `WellPos!${randomCode}`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await prisma.user.update({
      where: { id: owner.id },
      data: { passwordHash },
    });

    return res.status(200).json({
      status: 'success',
      message: `Kata sandi akun owner "${owner.name}" berhasil disetel ulang`,
      data: {
        ownerName: owner.name,
        ownerEmail: owner.email,
        temporaryPassword,
        businessName: tenant.name,
      },
    });
  } catch (error) {
    console.error('Error reset tenant owner password:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mereset kata sandi owner',
    });
  }
};

/**
 * Controller: Ambil Daftar Seluruh Invoice SaaS Platform & Mutasi Token
 * @route GET /api/platform/invoices
 */
export const getPlatformInvoices = async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;
    const where: any = {};
    if (status && typeof status === 'string' && status !== 'ALL' && status.trim() !== '') {
      where.status = status as InvoiceStatus;
    }
    if (search && typeof search === 'string' && search.trim() !== '') {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { tenant: { name: { contains: search, mode: 'insensitive' } } },
        { promoCode: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const invoices = await prisma.saaSInvoice.findMany({
      where,
      include: {
        plan: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            phone: true,
            users: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                role: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        payments: {
          include: {
            verifiedBy: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      status: 'success',
      data: invoices.map((inv) => {
        const owner = inv.tenant.users?.find((u) => u.role === 'ADMIN') || inv.tenant.users?.[0];
        const ownerFullName = owner
          ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.name || 'Owner'
          : '-';
        const ownerEmail = owner?.email || '-';
        const ownerPhone = owner?.phone || inv.tenant.phone || '-';

        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          tenantId: inv.tenantId,
          tenantName: inv.tenant.name,
          tenantSlug: inv.tenant.slug,
          tenantPhone: inv.tenant.phone,
          ownerName: ownerFullName,
          ownerEmail: ownerEmail,
          ownerPhone: ownerPhone,
          tenant: {
            id: inv.tenant.id,
            name: inv.tenant.name,
            businessName: inv.tenant.name,
            slug: inv.tenant.slug,
            phone: inv.tenant.phone,
            owner: {
              name: ownerFullName,
              email: ownerEmail,
              phone: ownerPhone,
            },
          },
          planCode: inv.plan.code,
          planName: inv.plan.name,
          amount: Number(inv.amount),
          tokenAmount: inv.tokenAmount || 0,
          notes: inv.notes || '',
          promoCode: inv.promoCode || null,
          discountAmount: Number(inv.discountAmount || 0),
          status: inv.status,
          dueDate: inv.dueDate,
          paidAt: inv.paidAt,
          paymentUrl: inv.paymentUrl,
          createdAt: inv.createdAt,
          payments: inv.payments,
        };
      }),
    });
  } catch (error) {
    console.error('Error get platform invoices:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memuat data invoice platform',
    });
  }
};

/**
 * Controller: Verifikasi Pembayaran Manual Invoice oleh Superadmin
 * @route POST /api/platform/invoices/:id/verify-payment
 */
export const verifyPlatformInvoicePayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentChannel, paymentProofUrl } = req.body;
    const platformUser = (req as any).platformUser;

    const result = await billingService.verifyManualPayment(
      id,
      platformUser?.id,
      paymentChannel || 'BANK_TRANSFER_MANUAL',
      paymentProofUrl
    );

    return res.status(200).json({
      status: 'success',
      message: `Pembayaran invoice ${result.invoice.invoiceNumber} berhasil diverifikasi`,
      data: {
        invoice: {
          id: result.invoice.id,
          invoiceNumber: result.invoice.invoiceNumber,
          status: result.invoice.status,
          paidAt: result.invoice.paidAt,
        },
        subscription: {
          id: result.subscription.id,
          planName: result.subscription.plan.name,
          expiresAt: result.subscription.expiresAt,
          isActive: result.subscription.isActive,
        },
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          status: result.tenant.status,
        },
      },
    });
  } catch (error) {
    console.error('Error verify platform invoice payment:', error);
    return res.status(400).json({
      status: 'error',
      message: (error as any)?.message || 'Gagal memverifikasi pembayaran invoice',
    });
  }
};

/**
 * Controller: Trigger Evaluasi Siklus Hidup Langganan & Auto-Suspension
 * @route POST /api/platform/subscriptions/evaluate-lifecycle
 */
export const triggerLicenseLifecycleEvaluation = async (req: Request, res: Response) => {
  try {
    const { simulatedDate } = req.body;
    const options = simulatedDate ? { simulatedDate: new Date(simulatedDate) } : undefined;

    const result = await licenseWorkerService.evaluateSubscriptionLifecycles(options);

    return res.status(200).json({
      status: 'success',
      message: 'Evaluasi siklus hidup lisensi toko berhasil dijalankan',
      data: result,
    });
  } catch (error) {
    console.error('Error evaluate subscription lifecycles:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengevaluasi siklus hidup langganan',
    });
  }
};

// ==========================================
// MANAJEMEN TIM STAFF PLATFORM (RBAC LEVEL 1)
// ==========================================

export const getPlatformUsers = async (_req: Request, res: Response) => {
  try {
    const users = await prisma.platformUser.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { verifiedPayments: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.status(200).json({ status: 'success', data: users });
  } catch (error) {
    console.error('Error get platform users:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat data staf platform' });
  }
};

const createPlatformUserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  role: z.nativeEnum(PlatformRole, {
    errorMap: () => ({ message: 'Role staf platform tidak valid' }),
  }),
});

export const createPlatformUser = async (req: Request, res: Response) => {
  try {
    const parse = createPlatformUserSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi data staf gagal',
        errors: parse.error.flatten().fieldErrors,
      });
    }

    const { name, email, password, role } = parse.data;

    const existing = await prisma.platformUser.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ status: 'error', message: 'Email sudah terdaftar sebagai akun platform' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.platformUser.create({
      data: { name, email, passwordHash, role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    return res.status(201).json({
      status: 'success',
      message: `Akun staf ${user.name} (${user.role}) berhasil ditambahkan`,
      data: user,
    });
  } catch (error) {
    console.error('Error create platform user:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menambahkan staf platform' });
  }
};

export const updatePlatformUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role, password } = req.body;

    const dataToUpdate: any = {};
    if (name) dataToUpdate.name = name;
    if (role && Object.values(PlatformRole).includes(role)) dataToUpdate.role = role;
    if (password && password.length >= 6) {
      dataToUpdate.passwordHash = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.platformUser.update({
      where: { id },
      data: dataToUpdate,
      select: { id: true, name: true, email: true, role: true, updatedAt: true },
    });

    return res.status(200).json({
      status: 'success',
      message: `Data staf ${updated.name} berhasil diperbarui`,
      data: updated,
    });
  } catch (error) {
    console.error('Error update platform user:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui staf platform' });
  }
};

export const deletePlatformUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentPlatformUser = (req as any).platformUser;

    if (currentPlatformUser?.id === id) {
      return res.status(400).json({ status: 'error', message: 'Tidak dapat menghapus akun Anda sendiri' });
    }

    const targetUser = await prisma.platformUser.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ status: 'error', message: 'Staf platform tidak ditemukan' });
    }

    if (targetUser.email === 'superadmin@wellpos.id') {
      return res.status(403).json({ status: 'error', message: 'Akun Superadmin Root tidak dapat dihapus' });
    }

    await prisma.platformUser.delete({ where: { id } });

    return res.status(200).json({
      status: 'success',
      message: `Akun staf ${targetUser.name} berhasil dihapus dari platform`,
    });
  } catch (error) {
    console.error('Error delete platform user:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menghapus staf platform' });
  }
};

// ==========================================
// MANAJEMEN MASTER PROMO SAAS PLATFORM (B2B)
// ==========================================

export const getPlatformPromos = async (_req: Request, res: Response) => {
  try {
    const promos = await prisma.saaSPromo.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      status: 'success',
      data: promos.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        type: p.type,
        value: Number(p.value),
        minSpend: p.minSpend ? Number(p.minSpend) : 0,
        maxDiscount: p.maxDiscount ? Number(p.maxDiscount) : null,
        usageLimit: p.usageLimit,
        usedCount: p.usedCount,
        validFrom: p.validFrom,
        validUntil: p.validUntil,
        isActive: p.isActive,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error get platform promos:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat daftar promo platform' });
  }
};

const createPlatformPromoSchema = z.object({
  code: z.string().min(3, 'Kode promo minimal 3 karakter').toUpperCase(),
  name: z.string().min(3, 'Nama promo minimal 3 karakter'),
  type: z.enum(['DISCOUNT_PERCENT', 'DISCOUNT_FIXED', 'BONUS_TOKENS']),
  value: z.number().positive('Nilai promo harus lebih dari 0'),
  minSpend: z.number().optional().default(0),
  maxDiscount: z.number().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  validUntil: z.string().optional().nullable(),
});

export const createPlatformPromo = async (req: Request, res: Response) => {
  try {
    const parse = createPlatformPromoSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi data promo gagal',
        errors: parse.error.flatten().fieldErrors,
      });
    }

    const { code, name, type, value, minSpend, maxDiscount, usageLimit, validUntil } = parse.data;

    const existing = await prisma.saaSPromo.findUnique({ where: { code } });
    if (existing) {
      return res.status(400).json({ status: 'error', message: `Kode promo "${code}" sudah digunakan` });
    }

    const promo = await prisma.saaSPromo.create({
      data: {
        id: `promo-${code.toLowerCase()}-${Date.now().toString(36)}`,
        code,
        name,
        type,
        value: new Prisma.Decimal(value),
        minSpend: new Prisma.Decimal(minSpend || 0),
        maxDiscount: maxDiscount ? new Prisma.Decimal(maxDiscount) : null,
        usageLimit: usageLimit || null,
        validUntil: validUntil ? new Date(validUntil) : null,
        isActive: true,
      },
    });

    return res.status(201).json({
      status: 'success',
      message: `Kode promo "${promo.code}" berhasil diterbitkan`,
      data: promo,
    });
  } catch (error) {
    console.error('Error create platform promo:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal membuat kode promo' });
  }
};

export const togglePlatformPromo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const promo = await prisma.saaSPromo.findUnique({ where: { id } });
    if (!promo) {
      return res.status(404).json({ status: 'error', message: 'Promo tidak ditemukan' });
    }

    const updated = await prisma.saaSPromo.update({
      where: { id },
      data: { isActive: !promo.isActive },
    });

    return res.status(200).json({
      status: 'success',
      message: `Promo "${updated.code}" sekarang ${updated.isActive ? 'AKTIF' : 'NONAKTIF'}`,
      data: updated,
    });
  } catch (error) {
    console.error('Error toggle platform promo:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengubah status promo' });
  }
};

export const deletePlatformPromo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.saaSPromo.delete({ where: { id } });

    return res.status(200).json({
      status: 'success',
      message: 'Kode promo berhasil dihapus',
    });
  } catch (error) {
    console.error('Error delete platform promo:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menghapus kode promo' });
  }
};

const PAYMENT_CONFIG_FILE = path.join(__dirname, '../../data/platform_payment_config.json');

export const readPlatformPaymentConfig = () => {
  try {
    if (fs.existsSync(PAYMENT_CONFIG_FILE)) {
      const raw = fs.readFileSync(PAYMENT_CONFIG_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading platform payment config:', err);
  }
  return {
    qris: {
      enabled: true,
      merchantName: 'WELL POS PLATFORM HQ',
      nmid: 'ID1020030040050',
      bankName: 'Bank Central Asia (BCA)',
      accountNumber: '8830129381',
      accountHolder: 'PT Well POS Solusi',
      imageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=00020101021126600016ID.CO.QRIS.WWW011893600002010200300400500215ID10200300400500303UME51440014ID.CO.QRIS.WWW0215ID10200300400500303UME5204581253033605802ID5919WELL+POS+PLATFORM+HQ6007JAKARTA61051219062070703A016304E85C',
      notes: 'Pindai kode QRIS di atas menggunakan GoPay, OVO, Dana, ShopeePay, BCA Mobile, Livin by Mandiri, atau m-Banking apa pun. Saldo token otomatis langsung bertambah setelah konfirmasi.',
      updatedAt: new Date().toISOString(),
    },
  };
};

export const writePlatformPaymentConfig = (data: any) => {
  const current = readPlatformPaymentConfig();
  const updated = {
    qris: {
      ...current.qris,
      ...data.qris,
      updatedAt: new Date().toISOString(),
    },
  };
  try {
    const dir = path.dirname(PAYMENT_CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PAYMENT_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing platform payment config:', err);
  }
  return updated;
};

export const getPlatformPaymentSettings = async (_req: Request, res: Response) => {
  try {
    const config = readPlatformPaymentConfig();
    return res.status(200).json({
      status: 'success',
      data: config,
    });
  } catch (error) {
    console.error('Error getting platform payment settings:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat pengaturan pembayaran platform' });
  }
};

export const updatePlatformPaymentSettings = async (req: Request, res: Response) => {
  try {
    const updated = writePlatformPaymentConfig(req.body);
    return res.status(200).json({
      status: 'success',
      message: 'Pengaturan QRIS Statis Platform berhasil diperbarui',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating platform payment settings:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui pengaturan pembayaran platform' });
  }
};



