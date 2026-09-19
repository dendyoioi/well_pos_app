import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { TenantStatus, Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'rahasia_super_aman_pos_12345';
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
      totalOrders,
      subscriptions,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: TenantStatus.ACTIVE } }),
      prisma.tenant.count({ where: { status: TenantStatus.TRIAL } }),
      prisma.tenant.count({ where: { status: TenantStatus.SUSPENDED } }),
      prisma.outlet.count(),
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
    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status as TenantStatus;
    }
    if (search && typeof search === 'string' && search.trim() !== '') {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { users: { some: { email: { contains: search, mode: 'insensitive' } } } },
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
        outlets: {
          select: { id: true, name: true, phone: true, address: true },
        },
        users: {
          select: { id: true, name: true, role: true, email: true },
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
        return {
          id: t.id,
          businessName: t.businessName,
          slug: t.slug,
          subdomain: t.slug,
          businessType: t.businessType,
          ownerName: owner?.name || 'Owner',
          email: owner?.email || '-',
          phone: t.phone,
          status: t.status,
          trialEndsAt: t.trialEndsAt,
          createdAt: t.createdAt,
          _count: {
            outlets: t.outlets.length,
            users: t.users.length,
          },
          subscriptionPlan: activeSub?.plan || null,
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

    const trialEndsAt = (status === 'TRIAL' || status === 'ACTIVE')
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      : existing.trialEndsAt;

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.tenant.update({
        where: { id },
        data: {
          status,
          ...(status === 'TRIAL' || status === 'ACTIVE' ? { trialEndsAt } : {}),
        },
      });

      if (status === 'TRIAL' || status === 'ACTIVE') {
        const proPlan = await tx.subscriptionPlan.findFirst({ where: { code: 'PRO' } });
        if (proPlan) {
          const existingSub = await tx.tenantSubscription.findFirst({ where: { tenantId: id } });
          const subExpiry = trialEndsAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
          if (!existingSub) {
            await tx.tenantSubscription.create({
              data: {
                tenantId: id,
                planId: proPlan.id,
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
      // Cari pemilik tenant (Role.ADMIN adalah Owner)
      const ownerUser = await prisma.user.findFirst({
        where: { tenantId: id, role: Role.ADMIN },
        select: { email: true, name: true },
      });
      const recipientEmail = ownerUser?.email || 'klien@bisnis.com';
      const recipientName = ownerUser?.name || updated.businessName;

      emailNotification = {
        sent: true,
        recipient: recipientEmail,
        recipientName,
        subject: `Selamat! Akun Bisnis "${updated.businessName}" Telah Disetujui & Aktif`,
        sentAt: new Date().toISOString(),
        message: `Halo ${recipientName}, pendaftaran bisnis "${updated.businessName}" telah diverifikasi dan disetujui oleh Admin SaaS. Masa uji coba PRO 14 hari telah aktif. Silakan masuk ke aplikasi untuk menyelesaikan pengaturan toko.`,
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
        ? `Akun bisnis "${updated.businessName}" berhasil DISETUJUI & email konfirmasi telah dikirim ke klien!`
        : `Status tenant "${updated.businessName}" berhasil diubah menjadi ${updated.status}`,
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
  durationDays: z.number().int().positive('Durasi hari harus positif').optional().default(30),
});

/**
 * Controller: Perpanjang / Ubah Paket Langganan Tenant
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

    const { planId, planCode, durationDays } = parse.data;

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

    const effectiveDuration = durationDays || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + effectiveDuration);

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
        trialEndsAt: expiresAt,
      },
    });

    return res.status(200).json({
      status: 'success',
      message: `Langganan "${updatedTenant.businessName}" berhasil diperpanjang (+${durationDays} hari) dengan paket ${plan.name}`,
      data: {
        tenant: updatedTenant,
        subscription: {
          id: newSubscription.id,
          planName: plan.name,
          planCode: plan.code,
          expiresAt: newSubscription.expiresAt,
          isActive: newSubscription.isActive,
        },
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
            address: true,
            phone: true,
            isActive: true,
            createdAt: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
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
        _sum: { grandTotal: true },
      }),
    ]);

    const owner = tenant.users.find((u) => u.role === 'ADMIN') || tenant.users[0] || null;
    const activeSub = tenant.subscriptions.find((s) => s.isActive) || tenant.subscriptions[0] || null;

    return res.status(200).json({
      status: 'success',
      data: {
        tenant: {
          id: tenant.id,
          businessName: tenant.businessName,
          slug: tenant.slug,
          subdomain: tenant.slug,
          businessType: tenant.businessType,
          phone: tenant.phone || tenant.outlets[0]?.phone || '-',
          status: tenant.status,
          trialEndsAt: tenant.trialEndsAt,
          createdAt: tenant.createdAt,
        },
        owner: owner
          ? {
              id: owner.id,
              name: owner.name,
              email: owner.email,
              phone: tenant.phone || tenant.outlets[0]?.phone || '-',
              role: owner.role,
            }
          : null,
        stats: {
          totalUsers: tenant.users.length,
          totalOutlets: tenant.outlets.length,
          totalProducts,
          totalOrders,
          totalRevenue: Number(revenueAggregate._sum.grandTotal || 0),
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

    const firstOutlet = tenant.outlets[0] || null;
    const platformUser = (req as any).platformUser;

    const token = jwt.sign(
      {
        userId: owner.id,
        role: owner.role,
        outletId: owner.outletId || firstOutlet?.id,
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
      message: `Berhasil mengimpersonasi toko ${tenant.businessName}`,
      data: {
        token,
        user: {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          role: owner.role,
          tenantId: tenant.id,
          outlet: firstOutlet
            ? {
                id: firstOutlet.id,
                name: firstOutlet.name,
              }
            : null,
          isImpersonated: true,
          impersonatedBy: platformUser?.name || 'Superadmin',
          businessName: tenant.businessName,
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
        businessName: tenant.businessName,
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

