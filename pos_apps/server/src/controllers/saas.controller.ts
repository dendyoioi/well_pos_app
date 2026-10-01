import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import * as crypto from 'crypto';
import { Role, TenantStatus, BusinessVertical, StorageLocationType, InvoiceStatus, Prisma, OrderStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { catalogDualWriteService } from '../services/dual_write';
import { billingService } from '../services/billing.service';
import { pakasirService } from '../services/pakasir.service';
import { readPlatformPaymentConfig } from './platform.controller';

// Fix K2: JWT_SECRET WAJIB ada di environment — tidak boleh ada fallback string.
if (!process.env.JWT_SECRET) {
  throw new Error('[FATAL] JWT_SECRET tidak ditemukan di environment variables.');
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

const registerSchema = z
  .object({
    firstName: z.string().min(1, 'Nama depan wajib diisi'),
    lastName: z.string().min(1, 'Nama belakang wajib diisi'),
    phone: z
      .string()
      .regex(
        /^\+?628[0-9]{8,12}$|^08[0-9]{8,12}$/,
        'Nomor telepon harus berupa nomor seluler Indonesia yang valid (+628... atau 08...) dengan 9 s.d. 13 digit setelah kode negara'
      ),
    email: z.string().email('Format email tidak valid'),
    password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
    confirmPassword: z.string().min(6, 'Konfirmasi kata sandi minimal 6 karakter'),
    businessVertical: z.enum(['FNB', 'RETAIL', 'SERVICES']).optional().default('FNB'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak cocok dengan kata sandi',
    path: ['confirmPassword'],
  });

const onboardingSchema = z.object({
  outletId: z.string().uuid().optional(),
  address: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  warehouse: z
    .object({
      name: z.string().min(1, 'Nama gudang wajib diisi').default('Gudang Utama Toko'),
      address: z.string().optional().default(''),
      phone: z.string().optional().default(''),
    })
    .optional(),
  receiptSize: z.enum(['58mm', '80mm']).optional().default('58mm'),
  receiptFooter: z.string().optional().default('Terima kasih atas kunjungan Anda!'),
  spvName: z.string().optional(),
  spvPin: z.string().length(6, 'PIN supervisor harus 6 digit angka').regex(/^\d{6}$/).optional(),
  cashierName: z.string().optional(),
  cashierPin: z.string().length(6, 'PIN kasir harus 6 digit angka').regex(/^\d{6}$/).optional(),
  initialProduct: z
    .object({
      name: z.string().min(1, 'Nama produk wajib diisi'),
      categoryName: z.string().min(1, 'Kategori produk wajib diisi'),
      unit: z.string().default('Pcs'),
      costPrice: z.number().min(0).default(0),
      basePrice: z.number().min(0).default(0),
      storeStock: z.number().min(0).optional(),
      warehouseStock: z.number().min(0).optional(),
      initialStock: z.number().min(0).default(0),
      isUnlimited: z.boolean().default(false),
    })
    .optional(),
  seedSampleProducts: z.boolean().optional().default(false),
});

/**
 * Registrasi Mandiri Klien Baru (Self-Service Sign Up)
 * @route POST /api/saas/register
 */
export const registerClient = async (req: Request, res: Response) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi data gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { firstName, lastName, email, phone, password, businessVertical } = parseResult.data;
    const fullName = `${firstName} ${lastName}`.trim();

    // 1. Cek duplikasi email
    const existingUser = await prisma.user.findFirst({
      where: { email },
    });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'Email bisnis ini sudah terdaftar. Silakan gunakan email lain atau login.',
      });
    }

    // 2. Generate slug unik
    let slug = `${firstName}-${lastName}`
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!slug) slug = 'owner-' + Date.now();

    const existingTenantSlug = await prisma.tenant.findUnique({ where: { slug } });
    if (existingTenantSlug) {
      slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Eksekusi transaksi atomik Prisma: Buat Tenant & User Owner SAJA (0 Toko di awal)
    const result = await prisma.$transaction(async (tx) => {
      const vertical = businessVertical === 'SERVICES'
        ? BusinessVertical.SERVICES
        : businessVertical === 'RETAIL'
          ? BusinessVertical.RETAIL
          : BusinessVertical.FNB;

      // a. Buat Tenant baru dengan status PENDING (Menunggu Approval Super Admin SaaS)
      const tenant = await tx.tenant.create({
        data: {
          name: fullName,
          slug,
          phone,
          businessVertical: vertical,
          status: TenantStatus.PENDING,
          enableRecipeTracking: vertical === BusinessVertical.FNB,
          enableBatchTracking: true,
        },
      });

      // b. Buat Akun Owner (Role ADMIN), outletId: null karena belum ada toko
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          outletId: null,
          userCode: '00001',
          name: fullName,
          firstName,
          lastName,
          email,
          phone,
          passwordHash,
          pinHash: null,
          role: Role.ADMIN,
          isActive: true,
        },
      });

      return { tenant, user };
    });

    // 5. Buat Catatan Tagihan Pendaftaran Awal (Rp 99.000 + 100 Token) status UNPAID
    // Tagihan ini akan disetujui dan dilunasi otomatis ketika Super Admin menyetujui (approve) akun
    const REGISTRATION_FEE = 99000;
    const REGISTRATION_BONUS_TOKENS = 100;
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-REG-${todayStr}-${randSuffix}`;

    let plan = await prisma.subscriptionPlan.findFirst({ where: { code: 'PRO' } });
    if (!plan) {
      plan = await prisma.subscriptionPlan.findFirst();
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    await prisma.saaSInvoice.create({
      data: {
        invoiceNumber,
        tenantId: result.tenant.id,
        planId: plan ? plan.id : '',
        amount: new Prisma.Decimal(REGISTRATION_FEE),
        tokenAmount: REGISTRATION_BONUS_TOKENS,
        notes: `Biaya Aktivasi Pendaftaran Akun Pemilik + ${REGISTRATION_BONUS_TOKENS} Bonus Token Transaksi (Menunggu Approval Super Admin)`,
        status: InvoiceStatus.UNPAID,
        dueDate,
        paymentGateway: 'MANUAL_APPROVAL',
        paymentUrl: `https://checkout.wellpos.id/pay/${invoiceNumber}`,
      },
    }).catch((err) => console.error('Error creating pending reg invoice:', err));

    return res.status(201).json({
      status: 'success',
      message: 'Pendaftaran akun pemilik berhasil diajukan! Akun Anda saat ini berstatus PENDING dan sedang menunggu persetujuan (approval) oleh Super Admin SaaS.',
      data: {
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug,
          status: result.tenant.status,
        },
        user: {
          id: result.user.id,
          name: result.user.name,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          email: result.user.email,
          phone: result.user.phone,
          role: result.user.role,
        },
      },
    });
  } catch (error) {
    console.error('Error saat registrasi tenant SaaS:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan sistem saat memproses pendaftaran toko baru',
    });
  }
};

/**
 * Onboarding Wizard Setup Toko
 * @route POST /api/saas/onboarding
 */
export const onboardingClient = async (req: Request, res: Response) => {
  try {
    const parseResult = onboardingSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi onboarding gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const {
      outletId,
      address,
      phone,
      warehouse: warehouseInput,
      receiptSize,
      receiptFooter,
      spvName,
      spvPin,
      cashierName,
      cashierPin,
      initialProduct,
    } = parseResult.data;

    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({
        status: 'error',
        message: 'Konteks tenant tidak ditemukan',
      });
    }

    // Fix T4: Guard status PENDING — tenant yang belum diapprove tidak boleh melanjutkan onboarding
    const tenantRecord = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true, name: true },
    });
    if (!tenantRecord) {
      return res.status(404).json({ status: 'error', message: 'Data toko tidak ditemukan' });
    }
    if (tenantRecord.status === 'PENDING') {
      return res.status(403).json({
        status: 'error',
        code: 'TENANT_PENDING_APPROVAL',
        message: `Akun bisnis "${tenantRecord.name}" masih menunggu persetujuan administrator. Onboarding toko belum dapat dilanjutkan.`,
      });
    }

    // Tentukan outlet yang akan dikonfigurasi
    let targetOutletId = outletId || req.user?.outletId;
    if (!targetOutletId) {
      const firstOutlet = await prisma.outlet.findFirst({
        where: { tenantId },
      });
      targetOutletId = firstOutlet?.id;
    }

    if (!targetOutletId) {
      return res.status(404).json({
        status: 'error',
        message: 'Outlet toko tidak ditemukan',
      });
    }

    // 1. Pastikan StorageLocation default ada di dalam Outlet Toko ini (Gudang Fisik Toko Level 1)
    let defaultLocation = await prisma.storageLocation.findFirst({
      where: { tenantId, outletId: targetOutletId, isDefault: true },
    });

    if (!defaultLocation) {
      defaultLocation = await prisma.storageLocation.create({
        data: {
          tenantId,
          outletId: targetOutletId,
          name: warehouseInput?.name?.trim() || 'Area Penyimpanan Utama',
          type: StorageLocationType.STOREFRONT,
          isDefault: true,
          isActive: true,
        },
      });
    } else if (warehouseInput?.name?.trim()) {
      await prisma.storageLocation.update({
        where: { id: defaultLocation.id },
        data: { name: warehouseInput.name.trim() },
      });
    }

    // 2. Update data profil outlet dan ukuran struk default
    const receiptConfig = {
      paperSize: receiptSize || '58mm',
      footerText: receiptFooter || 'Terima kasih atas kunjungan Anda!',
    };

    await prisma.outlet.update({
      where: { id: targetOutletId },
      data: {
        address: address || undefined,
        phone: phone || undefined,
        receiptConfig,
      },
    });

    // 3. Buat supervisor jika disediakan
    let createdSpv = null;
    if (spvName?.trim() && spvPin?.trim()) {
      const spvEmail = `spv-${Date.now()}@${tenantId.slice(0, 8)}.pos`;
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('spv123456', salt);
      const spvPinHash = await bcrypt.hash(spvPin, salt);
      const userCode = `SPV-${Math.floor(100 + Math.random() * 900)}`;

      createdSpv = await prisma.user.create({
        data: {
          tenantId,
          outletId: targetOutletId,
          userCode,
          name: spvName.trim(),
          email: spvEmail,
          passwordHash,
          pinHash: spvPinHash,
          role: Role.SUPERVISOR,
          isActive: true,
        },
        select: {
          id: true,
          userCode: true,
          name: true,
          email: true,
          role: true,
        },
      });
    }

    // 4. Buat kasir pertama jika disediakan
    let createdCashier = null;
    if (cashierName?.trim() && cashierPin?.trim()) {
      const cashierEmail = `kasir-${Date.now()}@${tenantId.slice(0, 8)}.pos`;
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('kasir123', salt);
      const cashierPinHash = await bcrypt.hash(cashierPin, salt);
      const userCode = `KSR-${Math.floor(100 + Math.random() * 900)}`;

      createdCashier = await prisma.user.create({
        data: {
          tenantId,
          outletId: targetOutletId,
          userCode,
          name: cashierName.trim(),
          email: cashierEmail,
          passwordHash,
          pinHash: cashierPinHash,
          role: Role.CASHIER,
          isActive: true,
        },
        select: {
          id: true,
          userCode: true,
          name: true,
          email: true,
          role: true,
        },
      });
    }

    // 4. Buat 1 Produk Pertama Terpandu & Alokasi Saldo Awal di Toko
    let createdProduct = null;
    if (initialProduct && initialProduct.name) {
      const catName = initialProduct.categoryName || 'Umum';
      let category = await prisma.category.findFirst({
        where: { tenantId, name: catName },
      });
      if (!category) {
        category = await prisma.category.create({
          data: {
            name: catName,
            slug: catName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            tenantId,
          },
        });
      }

      const sku = `SKU-${Date.now().toString().slice(-6)}`;
      const barcode = `899${Math.floor(1000000000 + Math.random() * 9000000000)}`;

      const initialStockQty = initialProduct.isUnlimited
        ? 999999
        : (initialProduct.storeStock !== undefined
            ? initialProduct.storeStock
            : (initialProduct.initialStock || 0));

      const dwResult = await prisma.$transaction(async (tx) => {
        const prodResult = await catalogDualWriteService.createProduct(
          {
            name: initialProduct.name,
            sku,
            barcode,
            categoryId: category.id,
            costPrice: initialProduct.costPrice || 0,
            basePrice: initialProduct.basePrice || 0,
            unit: initialProduct.unit || 'Pcs',
            initialStock: initialStockQty,
            minStockAlert: 5,
            outletId: targetOutletId,
          },
          { tx, tenantId, actorUserId: req.user?.id }
        );

        return prodResult;
      });

      createdProduct = {
        id: dwResult.targetDetails?.productId || dwResult.legacyData?.id,
        name: initialProduct.name,
        category: category.name,
        basePrice: initialProduct.basePrice || 0,
        costPrice: initialProduct.costPrice || 0,
        storeStock: initialStockQty,
      };
    }

    return res.status(200).json({
      status: 'success',
      message: 'Onboarding toko berhasil diselesaikan! Profil toko, kasir, dan katalog perdana telah aktif.',
      data: {
        outlet: {
          id: targetOutletId,
          address,
          phone,
          receiptConfig,
        },
        supervisor: createdSpv,
        cashier: createdCashier,
        product: createdProduct,
      },
    });
  } catch (error) {
    console.error('Error saat onboarding client:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan saat memproses setup onboarding',
    });
  }
};

/**
 * Membaca Status Lisensi & Berlangganan S/**
 * Endpoint Informasi Status Langganan, Kuota Token, dan Penggunaan
 * @route GET /api/saas/subscription
 */
export const getSubscriptionStatus = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({
        status: 'error',
        message: 'Konteks akun pemilik / tenant tidak ditemukan',
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscriptions: {
          where: { isActive: true },
          include: {
            plan: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        outlets: {
          select: {
            id: true,
            name: true,
            isWarehouse: true,
            isActive: true,
            phone: true,
            address: true,
          },
        },
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
        _count: {
          select: {
            outlets: true,
            users: true,
            products: true,
            orders: true,
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({
        status: 'error',
        message: 'Tenant tidak ditemukan',
      });
    }

    // Hitung seluruh token dari invoice PAID
    const paidInvoices = await prisma.saaSInvoice.findMany({
      where: {
        tenantId,
        status: InvoiceStatus.PAID,
        tokenAmount: { gt: 0 },
      },
      select: { tokenAmount: true },
    });

    const sumTokensFromInvoices = paidInvoices.reduce((sum, inv) => sum + (inv.tokenAmount || 0), 0);

    const currentSub = tenant.subscriptions[0] || null;
    const planTokenQuota = (currentSub?.plan?.features as any)?.tokenQuota ||
      (currentSub?.plan?.code === 'ENTERPRISE' ? 5000 : currentSub?.plan?.code === 'PRO' ? 2000 : currentSub?.plan?.code === 'STARTER' ? 1000 : 500);

    const totalTokenQuota = sumTokensFromInvoices > 0 ? sumTokensFromInvoices : planTokenQuota;
    const activeOrdersCount = await prisma.order.count({
      where: {
        tenantId,
        orderStatus: { notIn: [OrderStatus.CANCELLED, OrderStatus.VOIDED] },
      },
    });
    const usedOrders = activeOrdersCount;
    const remainingQuota = Math.max(0, totalTokenQuota - usedOrders);
    const percentUsed = totalTokenQuota > 0 ? Math.min(100, Math.round((usedOrders / totalTokenQuota) * 100)) : 0;
    const quotaStatus: 'SAFE' | 'LOW' | 'EMPTY' = remainingQuota === 0 ? 'EMPTY' : remainingQuota <= 100 ? 'LOW' : 'SAFE';

    // Penggunaan per outlet (hanya transaksi aktif yang tidak di-void)
    const ordersGrouped = await prisma.order.groupBy({
      by: ['outletId'],
      where: {
        tenantId,
        orderStatus: { notIn: [OrderStatus.CANCELLED, OrderStatus.VOIDED] },
      },
      _count: { id: true },
    });

    const outletUsage = tenant.outlets.map((o) => {
      const match = ordersGrouped.find((g) => g.outletId === o.id);
      return {
        outletId: o.id,
        outletName: o.name,
        isWarehouse: o.isWarehouse,
        ordersCount: match ? match._count.id : 0,
      };
    });

    const now = new Date();
    let daysRemaining = 0;
    let isExpired = false;

    const expirationDate = currentSub?.expiresAt;
    if (expirationDate) {
      const diffTime = expirationDate.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      isExpired = diffTime <= 0;
    }

    const owner = tenant.users.find((u) => u.role === Role.ADMIN) || tenant.users[0] || null;
    const ownerFullName = owner
      ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.name || 'Owner'
      : 'Owner';

    return res.status(200).json({
      status: 'success',
      data: {
        tenant: {
          id: tenant.id,
          businessName: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          businessType: tenant.businessVertical,
          trialEndsAt: tenant.trialEndsAt,
          ownerName: ownerFullName,
          ownerEmail: owner?.email || null,
          ownerPhone: owner?.phone || tenant.phone || null,
          counts: tenant._count,
        },
        subscription: currentSub
          ? {
              id: currentSub.id,
              planCode: currentSub.plan.code,
              planName: currentSub.plan.name,
              price: Number(currentSub.plan.price),
              features: currentSub.plan.features || [],
              isPro: currentSub.plan.code === 'PRO',
              isFree: currentSub.plan.code === 'FREE',
              maxOutlets: currentSub.plan.maxOutlets,
              maxCashiers: currentSub.plan.maxCashiers,
              expiresAt: currentSub.expiresAt,
            }
          : null,
        quota: {
          totalQuota: totalTokenQuota,
          usedOrders,
          remainingQuota,
          percentUsed,
          quotaStatus,
          neverExpires: true,
          outletUsage,
        },
        daysRemaining,
        isExpired,
      },
    });
  } catch (error) {
    console.error('Error saat mengambil status langganan:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data lisensi berlangganan',
    });
  }
};

const topUpTokenSchema = z.object({
  tokenAmount: z.number().int().positive('Jumlah token harus lebih dari 0'),
  promoCode: z.string().optional(),
  paymentMethod: z.string().default('QRIS'),
});

/**
 * Top-Up Kuota Token Pesanan oleh Pemilik Tenant (Pay-As-You-Go)
 * @route POST /api/saas/subscription/top-up
 */
export const topUpSubscriptionTokens = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Konteks tenant tidak ditemukan' });
    }

    const parse = topUpTokenSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi data gagal',
        errors: parse.error.flatten().fieldErrors,
      });
    }

    const { tokenAmount, promoCode, paymentMethod } = parse.data;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscriptions: {
          where: { isActive: true },
          include: { plan: true },
          take: 1,
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ status: 'error', message: 'Tenant tidak ditemukan' });
    }

    // Default plan
    let plan: any = tenant.subscriptions[0]?.plan;
    if (!plan) {
      plan = await prisma.subscriptionPlan.findFirst({ where: { code: 'PRO' } });
    }
    if (!plan) {
      return res.status(500).json({ status: 'error', message: 'Master paket langganan belum diatur' });
    }

    const config = readPlatformPaymentConfig();
    const tokenPrice = typeof config.tokenPrice === 'number' ? config.tokenPrice : 69;
    const minTokenPurchase = typeof config.minTokenPurchase === 'number' ? config.minTokenPurchase : 250;
    const qrisEnabled = typeof config.qrisEnabled === 'boolean' ? config.qrisEnabled : (config.qris?.enabled ?? true);

    if (!qrisEnabled) {
      return res.status(400).json({
        status: 'error',
        message: 'Metode pembayaran QRIS saat ini sedang dinonaktifkan / pemeliharaan sementara oleh platform HQ.',
      });
    }

    if (tokenAmount < minTokenPurchase) {
      return res.status(400).json({
        status: 'error',
        message: `Minimal pembelian token adalah ${minTokenPurchase.toLocaleString('id-ID')} token`,
      });
    }

    let finalTokenAmount = tokenAmount;
    let baseAmount = tokenAmount * tokenPrice;
    let discountAmount = 0;

    // Evaluasi Promo jika ada
    if (promoCode && promoCode.trim() !== '') {
      const promo = await prisma.saaSPromo.findFirst({
        where: { code: promoCode.trim().toUpperCase(), isActive: true },
      });

      if (promo) {
        const now = new Date();
        const notExpired = !promo.validUntil || promo.validUntil >= now;
        const withinUsageLimit = !promo.usageLimit || promo.usedCount < promo.usageLimit;
        const meetsMinSpend = !promo.minSpend || baseAmount >= Number(promo.minSpend);

        if (notExpired && withinUsageLimit && meetsMinSpend) {
          if (promo.type === 'DISCOUNT_PERCENT') {
            discountAmount = Math.round((baseAmount * Number(promo.value)) / 100);
            if (promo.maxDiscount) {
              discountAmount = Math.min(discountAmount, Number(promo.maxDiscount));
            }
          } else if (promo.type === 'DISCOUNT_FIXED') {
            discountAmount = Math.min(baseAmount, Number(promo.value));
          } else if (promo.type === 'BONUS_TOKENS') {
            finalTokenAmount += Number(promo.value);
          }

          await prisma.saaSPromo.update({
            where: { id: promo.id },
            data: { usedCount: { increment: 1 } },
          }).catch(() => {});
        }
      }
    }

    const finalAmount = Math.max(0, baseAmount - discountAmount);
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-TOKEN-${todayStr}-${randSuffix}`;

    // Request Direct QRIS ke Pakasir jika nominal > 0
    let qrisData = {
      txnId: '',
      qrString: '',
      expiredAt: undefined as string | undefined,
      isSandbox: true,
    };

    const isDirectQris = paymentMethod === 'QRIS' || paymentMethod === 'QRIS_PAKASIR' || !paymentMethod;
    const isFree = finalAmount === 0;

    if (!isFree && isDirectQris) {
      try {
        const pakasirRes = await pakasirService.createTransaction({
          orderId: invoiceNumber,
          amount: finalAmount,
          method: 'qris',
        });
        qrisData = {
          txnId: pakasirRes.txnId,
          qrString: pakasirRes.qrString || '',
          expiredAt: pakasirRes.expiredAt,
          isSandbox: pakasirRes.isSandbox,
        };
      } catch (pakasirErr: any) {
        console.warn('[TopUp] Pakasir API warning (fallback QRIS generated):', pakasirErr.message);
        qrisData.qrString = `00020101021226610016ID.CO.SHOPEE.WWW01189360091800216005230208${invoiceNumber}5204581253033605405${finalAmount}5802ID5910WELLPOSDEV6007JAKARTA6304A1B2`;
      }
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    // Buat invoice (UNPAID jika berbayar, PAID jika gratis 100% promo)
    const initialStatus = isFree ? InvoiceStatus.PAID : InvoiceStatus.UNPAID;

    const invoice = await prisma.saaSInvoice.create({
      data: {
        invoiceNumber,
        tenantId,
        planId: plan.id,
        amount: new Prisma.Decimal(finalAmount),
        tokenAmount: finalTokenAmount,
        notes: `Top-Up Kuota +${finalTokenAmount.toLocaleString('id-ID')} Token Pesanan (Pay-As-You-Go)`,
        promoCode: promoCode || null,
        discountAmount: new Prisma.Decimal(discountAmount),
        status: initialStatus,
        dueDate,
        paidAt: isFree ? new Date() : null,
        paymentUrl: `https://checkout.wellpos.id/pay/${invoiceNumber}`,
        paymentGateway: 'PAKASIR',
        qrString: qrisData.qrString || null,
        externalTxnId: qrisData.txnId || null,
        payments: isFree
          ? {
              create: {
                paymentChannel: 'PROMO_FREE',
              },
            }
          : undefined,
      },
      include: {
        plan: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            phone: true,
            users: {
              select: { id: true, name: true, firstName: true, lastName: true, email: true, phone: true, role: true },
            },
          },
        },
      },
    });

    const owner = invoice.tenant.users?.find((u) => u.role === Role.ADMIN) || invoice.tenant.users?.[0];
    const ownerFullName = owner
      ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.name || 'Owner'
      : 'Owner';

    return res.status(201).json({
      status: 'success',
      message: `Top-up +${finalTokenAmount.toLocaleString('id-ID')} token berhasil diproses. Faktur ${invoiceNumber} telah diterbitkan.`,
      data: {
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          tenantName: invoice.tenant.name,
          amount: Number(invoice.amount),
          tokenAmount: invoice.tokenAmount,
          notes: invoice.notes,
          promoCode: invoice.promoCode,
          discountAmount: Number(invoice.discountAmount),
          status: invoice.status,
          paidAt: invoice.paidAt,
          qrString: qrisData.qrString || invoice.qrString,
          externalTxnId: qrisData.txnId || invoice.externalTxnId,
          expiredAt: qrisData.expiredAt,
          isSandbox: qrisData.isSandbox,
          tenant: {
            id: invoice.tenant.id,
            name: invoice.tenant.name,
            businessName: invoice.tenant.name,
            slug: invoice.tenant.slug,
            owner: {
              name: ownerFullName,
              email: owner?.email || '-',
              phone: owner?.phone || invoice.tenant.phone || '-',
            },
          },
        },
      },
    });
  } catch (error) {
    console.error('Error top-up subscription tokens:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memproses top-up token kuota',
    });
  }
};

/**
 * Validasi Kupon Promo B2B oleh Merchant
 * @route GET /api/saas/promos/validate
 */
export const validateTenantPromoCode = async (req: Request, res: Response) => {
  try {
    const { code, tokenAmount } = req.query;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ status: 'error', message: 'Kode kupon promo wajib diisi' });
    }

    const promo = await prisma.saaSPromo.findFirst({
      where: { code: code.trim().toUpperCase(), isActive: true },
    });

    if (!promo) {
      return res.status(404).json({ status: 'error', message: 'Kupon promo tidak ditemukan atau sudah tidak aktif' });
    }

    const now = new Date();
    if (promo.validUntil && promo.validUntil < now) {
      return res.status(400).json({ status: 'error', message: 'Kupon promo telah melewati masa berlaku' });
    }

    if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
      return res.status(400).json({ status: 'error', message: 'Kuota penggunaan kupon promo ini telah habis' });
    }

    const config = readPlatformPaymentConfig();
    const tokenPrice = typeof config.tokenPrice === 'number' ? config.tokenPrice : 69;
    const tokens = Number(tokenAmount) || 1000;
    const baseAmount = tokens * tokenPrice;

    if (promo.minSpend && baseAmount < Number(promo.minSpend)) {
      return res.status(400).json({
        status: 'error',
        message: `Minimal transaksi untuk kupon ini adalah Rp ${Number(promo.minSpend).toLocaleString('id-ID')}`,
      });
    }

    let discountAmount = 0;
    let bonusTokens = 0;

    if (promo.type === 'DISCOUNT_PERCENT') {
      discountAmount = Math.round((baseAmount * Number(promo.value)) / 100);
      if (promo.maxDiscount) {
        discountAmount = Math.min(discountAmount, Number(promo.maxDiscount));
      }
    } else if (promo.type === 'DISCOUNT_FIXED') {
      discountAmount = Math.min(baseAmount, Number(promo.value));
    } else if (promo.type === 'BONUS_TOKENS') {
      bonusTokens = Number(promo.value);
    }

    return res.status(200).json({
      status: 'success',
      data: {
        code: promo.code,
        name: promo.name,
        type: promo.type,
        value: Number(promo.value),
        discountAmount,
        bonusTokens,
        finalAmount: Math.max(0, baseAmount - discountAmount),
      },
    });
  } catch (error) {
    console.error('Error validate promo:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memvalidasi promo' });
  }
};

const createInvoiceSchema = z.object({
  planCode: z.string().min(1, 'Kode paket langganan wajib diisi'),
  durationMonths: z.number().int().positive().optional().default(1),
});

/**
 * Buat tagihan SaaS baru untuk tenant (Upgrade / Perpanjang)
 * @route POST /api/saas/invoices
 */
export const createSubscriptionInvoice = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Konteks tenant tidak ditemukan' });
    }

    const parse = createInvoiceSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi data gagal',
        errors: parse.error.flatten().fieldErrors,
      });
    }

    const invoice = await billingService.createInvoice({
      tenantId,
      planCode: parse.data.planCode,
      durationMonths: parse.data.durationMonths,
    });

    return res.status(201).json({
      status: 'success',
      message: `Invoice langganan ${invoice.invoiceNumber} berhasil dibuat`,
      data: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        planCode: invoice.plan.code,
        planName: invoice.plan.name,
        amount: Number(invoice.amount),
        dueDate: invoice.dueDate,
        paymentUrl: invoice.paymentUrl,
        status: invoice.status,
      },
    });
  } catch (error) {
    console.error('Error create subscription invoice:', error);
    return res.status(400).json({
      status: 'error',
      message: (error as any)?.message || 'Gagal membuat tagihan langganan',
    });
  }
};

/**
 * Ambil daftar tagihan/invoice langganan milik tenant
 * @route GET /api/saas/invoices
 */
export const getSubscriptionInvoices = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Konteks tenant tidak ditemukan' });
    }

    const invoices = await billingService.getTenantInvoices(tenantId);

    return res.status(200).json({
      status: 'success',
      data: invoices.map((inv: any) => {
        const owner = inv.tenant?.users?.find((u: any) => u.role === Role.ADMIN) || inv.tenant?.users?.[0];
        const ownerFullName = owner
          ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.name || 'Owner'
          : '-';
        const ownerEmail = owner?.email || '-';
        const ownerPhone = owner?.phone || inv.tenant?.phone || '-';

        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          tenantId: inv.tenantId,
          tenantName: inv.tenant?.name || 'Toko Saya',
          tenant: {
            id: inv.tenant?.id || inv.tenantId,
            name: inv.tenant?.name || 'Toko Saya',
            businessName: inv.tenant?.name || 'Toko Saya',
            slug: inv.tenant?.slug || '',
            phone: inv.tenant?.phone || '',
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
          dueDate: inv.dueDate,
          paidAt: inv.paidAt,
          status: inv.status,
          paymentUrl: inv.paymentUrl,
          payments: inv.payments,
          createdAt: inv.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error('Error get subscription invoices:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil riwayat invoice tenant',
    });
  }
};

const webhookSchema = z.object({
  invoiceNumber: z.string().min(1, 'Nomor invoice wajib diisi'),
  amount: z.number().min(0),
  paymentChannel: z.string().default('QRIS'),
  transactionStatus: z.enum(['settlement', 'capture', 'PAID', 'pending', 'failed', 'expire']),
  signatureKey: z.string().optional(),
  paymentProofUrl: z.string().optional(),
});

/**
 * Callback Webhook Payment Gateway (Midtrans / Xendit)
 * @route POST /api/saas/billing/webhook
 */
export const handleBillingWebhook = async (req: Request, res: Response) => {
  try {
    const parse = webhookSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Payload webhook tidak valid',
        errors: parse.error.flatten().fieldErrors,
      });
    }

    const result = await billingService.processPaymentWebhook(parse.data);

    return res.status(200).json({
      status: 'success',
      message: result.message,
      data: {
        invoiceNumber: result.invoice.invoiceNumber,
        status: result.invoice.status,
        planName: result.invoice.plan.name,
        subscriptionExpiresAt: ('subscription' in result && result.subscription) ? result.subscription.expiresAt : null,
      },
    });
  } catch (error) {
    console.error('Error handle billing webhook:', error);
    return res.status(400).json({
      status: 'error',
      message: (error as any)?.message || 'Gagal memproses callback pembayaran',
    });
  }
};

/**
 * Pembuatan Toko Perdana dari Full-Screen Wizard
 * @route POST /api/saas/stores/create-initial
 */
export const createInitialStore = async (req: Request, res: Response) => {
  try {
    const createStoreSchema = z.object({
      merchantName: z.string().min(2, 'Nama pedagang minimal 2 karakter'),
      storeName: z.string().min(2, 'Nama toko minimal 2 karakter'),
      address: z.string().min(3, 'Alamat toko wajib diisi'),
      phone: z.string().optional(),
      industries: z.array(z.string()).min(1, 'Pilih minimal 1 tipe industri'),
    });

    const parseResult = createStoreSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi toko gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { merchantName, storeName, address, phone, industries } = parseResult.data;
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({
        status: 'error',
        message: 'Konteks akun pemilik / tenant tidak ditemukan',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Tentukan vertical bisnis dari industri
      const isFnB = industries.some((ind) =>
        [
          'Restoran',
          'Restoran Cepat Saji',
          'Kedai Kopi',
          'Kedai Teh dan Jus Buah',
          'Bar',
          'Food Truck',
          'Toko Kue dan Makanan Penutup',
          'Kios di Pusat Kuliner',
        ].includes(ind)
      );
      const isServices = industries.some((ind) =>
        ['Layanan', 'Salon Kecantikan dan Rambut', 'Bengkel Mobil', 'Spa', 'Pusat Kebugaran'].includes(ind)
      );
      const vertical = isFnB ? BusinessVertical.FNB : isServices ? BusinessVertical.SERVICES : BusinessVertical.RETAIL;

      // 2. Perbarui profil Tenant dengan Nama Pedagang dan Industri
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          name: merchantName,
          businessVertical: vertical,
          businessType: industries.join(', '),
          enableRecipeTracking: isFnB,
        },
      });

      // 3. Buat Outlet Toko
      const existingOutletsCount = await tx.outlet.count({ where: { tenantId } });
      const code = `OUT-0${existingOutletsCount + 1}`;

      const outlet = await tx.outlet.create({
        data: {
          tenantId,
          code,
          name: storeName,
          merchantName,
          address,
          phone: phone?.trim() || null,
          industries,
          isActive: true,
          receiptConfig: {
            paperSize: '58mm',
            footerText: `Terima kasih telah berbelanja di ${storeName}!`,
          },
        },
      });

      // 4. Buat StorageLocation default di dalam Toko baru ini
      await tx.storageLocation.create({
        data: {
          tenantId,
          outletId: outlet.id,
          name: 'Area Penyimpanan Utama',
          type: StorageLocationType.STOREFRONT,
          isDefault: true,
          isActive: true,
        },
      });

      // 5. Hubungkan user owner ke outlet baru
      if (req.user?.id) {
        await tx.user.update({
          where: { id: req.user.id },
          data: { outletId: outlet.id },
        });
      }

      return outlet;
    });

    return res.status(201).json({
      status: 'success',
      message: 'Toko berhasil dibuat! Mengalihkan ke Dashboard Toko Anda...',
      data: {
        outlet: result,
      },
    });
  } catch (error) {
    console.error('Error saat membuat toko baru:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal membuat toko baru',
    });
  }
};

export const getPublicPlatformPaymentConfig = async (_req: Request, res: Response) => {
  try {
    const config = readPlatformPaymentConfig();
    return res.status(200).json({
      status: 'success',
      data: config,
    });
  } catch (error) {
    console.error('Error fetching platform payment config for owner:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat konfigurasi pembayaran platform' });
  }
};


