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
import { whatsAppService } from '../services/whatsapp.service';

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
          tokenQuota: totalPaidTokens > 0 ? totalPaidTokens : 100,
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
          OR: [
            { invoiceNumber: { startsWith: 'INV-REG' } },
            { invoiceNumber: { startsWith: 'INV-SETUP' } },
          ],
        },
      });

      const config = readPlatformPaymentConfig();
      const defaultRegFee = config.registrationFee ?? 99000;
      const defaultBonusTokens = config.registrationBonusTokens ?? 100;

      if (existingRegInvoice) {
        // Tandai invoice pendaftaran menjadi PAID (pertahankan nominal diskon dan token awal yang sudah disetujui/promo)
        const finalTokenAmount = existingRegInvoice.tokenAmount !== null && existingRegInvoice.tokenAmount !== undefined
          ? existingRegInvoice.tokenAmount
          : defaultBonusTokens;

        await prisma.saaSInvoice.update({
          where: { id: existingRegInvoice.id },
          data: {
            tokenAmount: finalTokenAmount,
            status: InvoiceStatus.PAID,
            paidAt: existingRegInvoice.paidAt || new Date(),
            notes: existingRegInvoice.notes || `Biaya Aktivasi Pendaftaran Akun Pemilik + ${finalTokenAmount} Bonus Token Transaksi (Disetujui Super Admin)`,
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
            amount: new Prisma.Decimal(defaultRegFee),
            tokenAmount: defaultBonusTokens,
            notes: `Biaya Aktivasi Pendaftaran Akun Pemilik + ${defaultBonusTokens} Bonus Token Transaksi (Disetujui Super Admin)`,
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
  planId: z.string().optional().nullable(),
  planCode: z.string().optional().nullable(),
  durationDays: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().int().positive('Durasi hari harus positif').optional().nullable()
  ),
  neverExpires: z.preprocess((val) => (typeof val === 'boolean' ? val : val === 'true'), z.boolean().optional().default(true)),
  tokenAmount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().int().positive('Jumlah token harus positif').optional()
  ),
  notes: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  promoCode: z.string().optional().nullable(),
  discountAmount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().min(0).optional()
  ),
  amount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().min(0).optional()
  ),
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
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planId || '');
    if (planId && isUuid) {
      plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    } else if (planCode) {
      plan = await prisma.subscriptionPlan.findFirst({ where: { code: planCode } });
    }

    // Jika planId bukan UUID di subscription_plans (misal ID paket token "pkg-enterprise-5000" dari katalog),
    // atau plan belum ditemukan, gunakan paket langganan aktif tenant yang sudah ada
    if (!plan) {
      const activeTenantSub = await prisma.tenantSubscription.findFirst({
        where: { tenantId: id, isActive: true },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });
      if (activeTenantSub?.plan) {
        plan = activeTenantSub.plan;
      }
    }

    // Jika tenant belum memiliki langganan sama sekali, fallback ke paket default sistem
    if (!plan) {
      plan = (await prisma.subscriptionPlan.findFirst({
        where: { code: { in: ['ENTERPRISE', 'PRO', 'STARTER', 'FREE'] } },
        orderBy: { price: 'desc' },
      })) || (await prisma.subscriptionPlan.findFirst());
    }

    if (!plan) {
      return res.status(404).json({ status: 'error', message: 'Paket langganan dasar platform tidak ditemukan' });
    }

    let expiresAt: Date | null = null;
    if (!neverExpires && durationDays && durationDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationDays);
    } else {
      // Untuk paket pay-as-you-go tanpa masa hangus, set ke tanggal jauh di masa depan (2099)
      // agar aman dari database constraint NOT NULL dan masa aktif tetap valid selamanya
      expiresAt = new Date('2099-12-31T23:59:59.999Z');
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
    const config = readPlatformPaymentConfig();
    const activeTokenPrice = typeof config.tokenPrice === 'number' && config.tokenPrice > 0 ? config.tokenPrice : 69;
    const platformUser = (req as any).platformUser;
    const finalTokenAmount = tokenAmount || (plan.features as any)?.tokenQuota || 0;
    const calculatedAmount = finalTokenAmount > 0 ? finalTokenAmount * activeTokenPrice : Number(plan.price);
    const finalDiscount = Number(discountAmount || 0);
    const finalAmount = Math.max(0, (amount !== undefined ? Number(amount) : calculatedAmount) - finalDiscount);

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-TOKEN/${todayStr}/${randSuffix}`;

    let validVerifiedById: string | null = null;
    if (platformUser?.id) {
      const exists = await prisma.platformUser.findUnique({ where: { id: platformUser.id } }).catch(() => null);
      if (exists) validVerifiedById = exists.id;
    }

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
            verifiedById: validVerifiedById,
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
        description: (p as any).description || '',
        scope: (p as any).scope || 'ALL',
        type: p.type,
        value: Number(p.value),
        minSpend: p.minSpend ? Number(p.minSpend) : 0,
        maxDiscount: p.maxDiscount ? Number(p.maxDiscount) : null,
        usageLimit: p.usageLimit,
        usedCount: p.usedCount,
        validFrom: p.validFrom,
        validUntil: p.validUntil,
        isActive: p.isActive,
        isPublished: (p as any).isPublished ?? true,
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
  description: z.string().optional().nullable(),
  scope: z.enum(['ALL', 'REGISTRATION', 'TOPUP']).optional().default('ALL'),
  type: z.enum(['DISCOUNT_PERCENT', 'DISCOUNT_FIXED', 'BONUS_TOKENS']),
  value: z.number().positive('Nilai promo harus lebih dari 0'),
  minSpend: z.number().optional().default(0),
  maxDiscount: z.number().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  isPublished: z.boolean().optional().default(true),
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

    const { code, name, description, scope = 'ALL', type, value, minSpend, maxDiscount, usageLimit, validUntil, isPublished = true } = parse.data;

    const existing = await prisma.saaSPromo.findUnique({ where: { code } });
    if (existing) {
      return res.status(400).json({ status: 'error', message: `Kode promo "${code}" sudah digunakan` });
    }

    const promo = await prisma.saaSPromo.create({
      data: {
        id: `promo-${code.toLowerCase()}-${Date.now().toString(36)}`,
        code,
        name,
        description: description || null,
        scope: scope || 'ALL',
        type,
        value: new Prisma.Decimal(value),
        minSpend: new Prisma.Decimal(minSpend || 0),
        maxDiscount: maxDiscount ? new Prisma.Decimal(maxDiscount) : null,
        usageLimit: usageLimit || null,
        validUntil: validUntil ? new Date(validUntil) : null,
        isActive: true,
        isPublished: Boolean(isPublished),
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

const updatePlatformPromoSchema = z.object({
  name: z.string().min(3, 'Nama promo minimal 3 karakter').optional(),
  description: z.string().optional().nullable(),
  scope: z.enum(['ALL', 'REGISTRATION', 'TOPUP']).optional(),
  type: z.enum(['DISCOUNT_PERCENT', 'DISCOUNT_FIXED', 'BONUS_TOKENS']).optional(),
  value: z.number().positive('Nilai promo harus lebih dari 0').optional(),
  minSpend: z.number().optional().default(0),
  maxDiscount: z.number().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

export const updatePlatformPromo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const promo = await prisma.saaSPromo.findUnique({ where: { id } });
    if (!promo) {
      return res.status(404).json({ status: 'error', message: 'Promo tidak ditemukan' });
    }

    const parse = updatePlatformPromoSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi data promo gagal',
        errors: parse.error.flatten().fieldErrors,
      });
    }

    const data = parse.data;
    const updatePayload: any = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.description !== undefined) updatePayload.description = data.description || null;
    if (data.scope !== undefined) updatePayload.scope = data.scope;
    if (data.type !== undefined) updatePayload.type = data.type;
    if (data.value !== undefined) updatePayload.value = new Prisma.Decimal(data.value);
    if (data.minSpend !== undefined) updatePayload.minSpend = new Prisma.Decimal(data.minSpend);
    if (data.maxDiscount !== undefined) updatePayload.maxDiscount = data.maxDiscount ? new Prisma.Decimal(data.maxDiscount) : null;
    if (data.usageLimit !== undefined) updatePayload.usageLimit = data.usageLimit || null;
    if (data.validUntil !== undefined) updatePayload.validUntil = data.validUntil ? new Date(data.validUntil) : null;
    if (data.isActive !== undefined) updatePayload.isActive = Boolean(data.isActive);
    if (data.isPublished !== undefined) updatePayload.isPublished = Boolean(data.isPublished);

    const updated = await prisma.saaSPromo.update({
      where: { id },
      data: updatePayload,
    });

    return res.status(200).json({
      status: 'success',
      message: `Kode promo "${updated.code}" berhasil diperbarui`,
      data: updated,
    });
  } catch (error) {
    console.error('Error update platform promo:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui data promo' });
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

export const togglePublishPlatformPromo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const promo = await prisma.saaSPromo.findUnique({ where: { id } });
    if (!promo) {
      return res.status(404).json({ status: 'error', message: 'Promo tidak ditemukan' });
    }

    const updated = await prisma.saaSPromo.update({
      where: { id },
      data: { isPublished: !promo.isPublished },
    });

    return res.status(200).json({
      status: 'success',
      message: `Promo "${updated.code}" sekarang ${updated.isPublished ? 'DITAMPILKAN DI WEBSITE' : 'DISEMBUNYIKAN DARI WEBSITE'}`,
      data: updated,
    });
  } catch (error) {
    console.error('Error toggle publish platform promo:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengubah status publikasi promo' });
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

const DEFAULT_PLATFORM_CONFIG = {
  registrationFee: 99000,
  registrationBonusTokens: 100,
  tokenPrice: 100,
  minTokenPurchase: 250,
  qrisEnabled: true,
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
  packages: [
    { id: 'pkg-starter-250', name: 'Starter 250', tokens: 250, label: 'Starter 250', price: 25000, badge: 'Trial Ramah', isPopular: false, description: 'Cocok untuk bisnis baru mulai buka' },
    { id: 'pkg-basic-1000', name: 'Basic 500', tokens: 500, label: 'Basic 500', price: 37500, badge: 'Paling Fleksibel', isPopular: false, description: 'Ideal untuk operasional harian kafe kecil' },
    { id: 'pkg-pro-2500', name: 'Pro 1.500', tokens: 1500, label: 'Pro 1.500', price: 90000, badge: '⭐ Paling Diminati', isPopular: true, description: 'Pilihan favorit resto dengan perputaran order tinggi' },
    { id: 'pkg-enterprise-5000', name: 'Enterprise 5.000', tokens: 5000, label: 'Enterprise 5.000', price: 0, badge: 'Kapasitas Besar', isPopular: false, description: 'Untuk multi-cabang dengan volume transaksi masif' },
  ],
};

export const readPlatformPaymentConfig = () => {
  try {
    if (fs.existsSync(PAYMENT_CONFIG_FILE)) {
      const raw = fs.readFileSync(PAYMENT_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const packagesList = Array.isArray(parsed.packages) ? parsed.packages : DEFAULT_PLATFORM_CONFIG.packages;
      const isQrisActive = typeof parsed.qrisEnabled === 'boolean'
        ? parsed.qrisEnabled
        : (typeof parsed.qris?.enabled === 'boolean' ? parsed.qris.enabled : true);

      return {
        ...DEFAULT_PLATFORM_CONFIG,
        ...parsed,
        registrationFee: typeof parsed.registrationFee === 'number' && !isNaN(parsed.registrationFee) && parsed.registrationFee >= 0 ? parsed.registrationFee : DEFAULT_PLATFORM_CONFIG.registrationFee,
        registrationBonusTokens: typeof parsed.registrationBonusTokens === 'number' && !isNaN(parsed.registrationBonusTokens) && parsed.registrationBonusTokens >= 0 ? parsed.registrationBonusTokens : DEFAULT_PLATFORM_CONFIG.registrationBonusTokens,
        tokenPrice: typeof parsed.tokenPrice === 'number' && !isNaN(parsed.tokenPrice) ? parsed.tokenPrice : DEFAULT_PLATFORM_CONFIG.tokenPrice,
        minTokenPurchase: typeof parsed.minTokenPurchase === 'number' && !isNaN(parsed.minTokenPurchase) ? parsed.minTokenPurchase : DEFAULT_PLATFORM_CONFIG.minTokenPurchase,
        qrisEnabled: isQrisActive,
        qris: {
          ...DEFAULT_PLATFORM_CONFIG.qris,
          ...(parsed.qris || {}),
          enabled: isQrisActive,
        },
        packages: packagesList.map((p: any, idx: number) => ({
          id: p.id || `pkg-${idx + 1}`,
          name: p.name || p.label || `Paket ${p.tokens || 250} Token`,
          tokens: Number(p.tokens) || 250,
          label: p.name || p.label || `Paket ${p.tokens || 250} Token`,
          price: typeof p.price === 'number' ? Number(p.price) : 0,
          badge: p.badge || '',
          isPopular: Boolean(p.isPopular),
          description: p.description || '',
        })),
      };
    }
  } catch (err) {
    console.error('Error reading platform payment config:', err);
  }
  return DEFAULT_PLATFORM_CONFIG;
};

export const writePlatformPaymentConfig = (data: any) => {
  const current = readPlatformPaymentConfig();
  const qrisEnabledVal = typeof data.qrisEnabled === 'boolean'
    ? data.qrisEnabled
    : (typeof data.qris?.enabled === 'boolean'
      ? data.qris.enabled
      : (data.qrisEnabled === 'true' ? true : data.qrisEnabled === 'false' ? false : current.qrisEnabled));

  const parsedRegFee = Number(data.registrationFee);
  const registrationFeeVal = !isNaN(parsedRegFee) && parsedRegFee >= 0 ? parsedRegFee : current.registrationFee;

  const parsedBonusTokens = Number(data.registrationBonusTokens);
  const registrationBonusTokensVal = !isNaN(parsedBonusTokens) && parsedBonusTokens >= 0 ? parsedBonusTokens : current.registrationBonusTokens;

  const parsedTokenPrice = Number(data.tokenPrice);
  const tokenPriceVal = !isNaN(parsedTokenPrice) && parsedTokenPrice > 0 ? parsedTokenPrice : current.tokenPrice;

  const parsedMinToken = Number(data.minTokenPurchase);
  const minTokenPurchaseVal = !isNaN(parsedMinToken) && parsedMinToken > 0 ? parsedMinToken : current.minTokenPurchase;

  const rawPackages = Array.isArray(data.packages) ? data.packages : current.packages;
  const normalizedPackages = rawPackages.map((p: any, idx: number) => ({
    id: p.id || `pkg-${Date.now()}-${idx + 1}`,
    name: p.name || p.label || `Paket ${p.tokens || 250} Token`,
    tokens: Math.max(1, Number(p.tokens) || 250),
    label: p.name || p.label || `Paket ${p.tokens || 250} Token`,
    price: typeof p.price === 'number' && p.price >= 0 ? Number(p.price) : 0,
    badge: p.badge ? String(p.badge).trim() : '',
    isPopular: Boolean(p.isPopular),
    description: p.description ? String(p.description).trim() : '',
  }));

  const updated = {
    ...current,
    registrationFee: registrationFeeVal,
    registrationBonusTokens: registrationBonusTokensVal,
    tokenPrice: tokenPriceVal,
    minTokenPurchase: minTokenPurchaseVal,
    qrisEnabled: qrisEnabledVal,
    qris: {
      ...current.qris,
      ...(data.qris || {}),
      enabled: qrisEnabledVal,
      updatedAt: new Date().toISOString(),
    },
    packages: normalizedPackages,
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
      message: 'Pengaturan Biaya Token & QRIS Platform berhasil diperbarui',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating platform payment settings:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui pengaturan pembayaran platform' });
  }
};

/**
 * Controller: Ambil Pengaturan WhatsApp Gateway Platform (Fonnte)
 * @route GET /api/platform/whatsapp/settings
 */
export const getPlatformWhatsAppSettings = async (_req: Request, res: Response) => {
  try {
    const config = whatsAppService.readPlatformConfig();
    return res.status(200).json({
      status: 'success',
      data: config,
    });
  } catch (error) {
    console.error('Error getting platform WhatsApp settings:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat pengaturan WhatsApp platform' });
  }
};

/**
 * Controller: Simpan Pengaturan WhatsApp Gateway Platform (Fonnte)
 * @route PUT /api/platform/whatsapp/settings
 */
export const updatePlatformWhatsAppSettings = async (req: Request, res: Response) => {
  try {
    const { apiKey, senderNumber, enabled, allowTenantFallback } = req.body;
    const updated = whatsAppService.writePlatformConfig({
      apiKey: apiKey !== undefined ? String(apiKey).trim() : undefined,
      senderNumber: senderNumber !== undefined ? String(senderNumber).trim() : undefined,
      enabled: enabled !== undefined ? Boolean(enabled) : undefined,
      allowTenantFallback: allowTenantFallback !== undefined ? Boolean(allowTenantFallback) : undefined,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Pengaturan WhatsApp Gateway Platform berhasil disimpan',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating platform WhatsApp settings:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui pengaturan WhatsApp platform' });
  }
};

/**
 * Controller: Uji Coba Koneksi Fonnte Device WhatsApp
 * @route POST /api/platform/whatsapp/test
 */
export const testPlatformWhatsAppConnection = async (req: Request, res: Response) => {
  try {
    const { apiKey, testPhone } = req.body;
    const activeKey = apiKey || whatsAppService.readPlatformConfig().apiKey;

    if (!activeKey) {
      return res.status(400).json({
        status: 'error',
        message: 'Masukkan token Fonnte API terlebih dahulu untuk melakukan pengetesan',
      });
    }

    const testRes = await whatsAppService.testDeviceConnection(activeKey, testPhone);
    return res.status(200).json(testRes);
  } catch (error: any) {
    console.error('Error testing WhatsApp connection:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal menguji koneksi WhatsApp' });
  }
};

// =========================================================================
// PENGELOLAAN NOTIFIKASI & PENGUMUMAN SUPERADMIN
// =========================================================================
export interface PlatformNotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'MAINTENANCE' | 'INFO' | 'WARNING' | 'UPDATE';
  target: 'ALL' | 'SPECIFIC';
  targetTenantId?: string | null;
  targetTenantName?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  createdBy?: string;
  isActive: boolean;
}

const NOTIFICATIONS_FILE = path.join(__dirname, '../../data/platform_notifications.json');

export const readPlatformNotifications = (): PlatformNotificationItem[] => {
  try {
    if (fs.existsSync(NOTIFICATIONS_FILE)) {
      const raw = fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        return list;
      }
    }
  } catch (err) {
    console.error('Error reading platform notifications:', err);
  }
  return [];
};

export const writePlatformNotifications = (items: PlatformNotificationItem[]): boolean => {
  try {
    const dir = path.dirname(NOTIFICATIONS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(items, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing platform notifications:', err);
    return false;
  }
};

export const getPlatformNotifications = async (_req: Request, res: Response) => {
  try {
    const list = readPlatformNotifications();
    return res.status(200).json({
      status: 'success',
      data: list,
    });
  } catch (error) {
    console.error('Error getting platform notifications:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat data notifikasi platform' });
  }
};

export const createPlatformNotification = async (req: Request, res: Response) => {
  try {
    const { title, message, type, target, targetTenantId, targetTenantName, expiresAt } = req.body;
    if (!title || !message) {
      return res.status(400).json({ status: 'error', message: 'Judul dan isi notifikasi wajib diisi' });
    }

    const currentList = readPlatformNotifications();
    const newNotif: PlatformNotificationItem = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: String(title).trim(),
      message: String(message).trim(),
      type: ['MAINTENANCE', 'INFO', 'WARNING', 'UPDATE'].includes(type) ? type : 'INFO',
      target: target === 'SPECIFIC' ? 'SPECIFIC' : 'ALL',
      targetTenantId: target === 'SPECIFIC' ? (targetTenantId || null) : null,
      targetTenantName: target === 'SPECIFIC' ? (targetTenantName || null) : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      createdAt: new Date().toISOString(),
      createdBy: (req as any).user?.name || (req as any).user?.email || 'Superadmin Platform',
      isActive: true,
    };

    const updated = [newNotif, ...currentList];
    writePlatformNotifications(updated);

    return res.status(201).json({
      status: 'success',
      message: 'Notifikasi berhasil diterbitkan ke merchant',
      data: newNotif,
    });
  } catch (error) {
    console.error('Error creating platform notification:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal membuat notifikasi platform' });
  }
};

export const deletePlatformNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentList = readPlatformNotifications();
    const filtered = currentList.filter((item) => item.id !== id);

    if (filtered.length === currentList.length) {
      return res.status(404).json({ status: 'error', message: 'Notifikasi tidak ditemukan' });
    }

    writePlatformNotifications(filtered);
    return res.status(200).json({
      status: 'success',
      message: 'Notifikasi berhasil dihapus',
    });
  } catch (error) {
    console.error('Error deleting platform notification:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menghapus notifikasi platform' });
  }
};




