import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { Role, TenantStatus, StockMovementType } from '@prisma/client';
import { prisma } from '../config/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'rahasia_super_aman_pos_12345';
const JWT_EXPIRES_IN = '7d';

const registerSchema = z.object({
  businessName: z.string().min(2, 'Nama bisnis minimal 2 karakter'),
  businessType: z.string().optional().default('Retail / Umum'),
  ownerName: z.string().min(2, 'Nama pemilik minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  phone: z.string().min(8, 'Nomor telepon minimal 8 digit'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
  pin: z.string().length(6, 'PIN harus 6 digit angka').regex(/^\d{6}$/, 'PIN harus angka').optional().default('111111'),
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

    const { businessName, businessType, ownerName, email, phone, password, pin } = parseResult.data;

    // 1. Cek duplikasi email
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'Email bisnis ini sudah terdaftar. Silakan gunakan email lain atau login.',
      });
    }

    // 2. Generate slug unik
    let slug = businessName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!slug) slug = 'toko-' + Date.now();

    const existingTenantSlug = await prisma.tenant.findUnique({ where: { slug } });
    if (existingTenantSlug) {
      slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // 3. Hitung masa trial 14 hari
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // 4. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 5. Eksekusi transaksi atomik Prisma
    const result = await prisma.$transaction(async (tx) => {
      // a. Buat Tenant baru dengan status PENDING (Menunggu Approval Super Admin SaaS)
      const tenant = await tx.tenant.create({
        data: {
          businessName,
          slug,
          businessType: businessType || 'Retail / Kafe',
          phone,
          status: TenantStatus.PENDING,
          trialEndsAt: null, // Diaktifkan saat Super Admin melakukan approval
        },
      });

      // c1. Buat Gudang Utama (Central Warehouse) Otomatis
      const warehouse = await tx.outlet.create({
        data: {
          tenantId: tenant.id,
          name: `Gudang Utama - ${businessName}`,
          phone,
          address: 'Sentral Logistik & Gudang Utama',
          isWarehouse: true,
          isActive: true,
        },
      });

      // c2. Buat Toko Cabang Utama Otomatis
      const outlet = await tx.outlet.create({
        data: {
          tenantId: tenant.id,
          name: `Toko Utama - ${businessName}`,
          phone,
          address: 'Alamat belum diatur (Setup di Onboarding)',
          isWarehouse: false,
          isActive: true,
        },
      });

      // d. Buat Akun Owner (Role ADMIN)
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          outletId: outlet.id,
          name: ownerName,
          email,
          passwordHash,
          pin: pin || '111111',
          role: Role.ADMIN,
          isActive: true,
        },
      });

      return { tenant, outlet, user };
    });

    return res.status(201).json({
      status: 'success',
      message: 'Pendaftaran calon klien berhasil diajukan! Akun Anda saat ini berstatus PENDING dan sedang menunggu persetujuan (approval) oleh Super Admin SaaS.',
      data: {
        tenant: {
          id: result.tenant.id,
          businessName: result.tenant.businessName,
          slug: result.tenant.slug,
          status: result.tenant.status,
        },
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        },
        outlet: {
          id: result.outlet.id,
          name: result.outlet.name,
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

    // Tentukan outlet yang akan dikonfigurasi
    let targetOutletId = outletId || req.user?.outletId;
    if (!targetOutletId) {
      const firstOutlet = await prisma.outlet.findFirst({
        where: { tenantId, isWarehouse: false },
      });
      targetOutletId = firstOutlet?.id;
    }

    if (!targetOutletId) {
      const anyOutlet = await prisma.outlet.findFirst({
        where: { tenantId },
      });
      targetOutletId = anyOutlet?.id;
    }

    if (!targetOutletId) {
      return res.status(404).json({
        status: 'error',
        message: 'Outlet toko tidak ditemukan',
      });
    }

    // 1. Setup / Update Gudang Utama (Wajib & Terhubung)
    let warehouseOutlet = await prisma.outlet.findFirst({
      where: { tenantId, isWarehouse: true },
    });

    const warehouseName = warehouseInput?.name?.trim() || (warehouseOutlet ? warehouseOutlet.name : 'Gudang Utama Toko');
    const warehouseAddress = warehouseInput?.address?.trim() || address || 'Sentral Logistik & Gudang';
    const warehousePhone = warehouseInput?.phone?.trim() || phone || '';

    if (warehouseOutlet) {
      warehouseOutlet = await prisma.outlet.update({
        where: { id: warehouseOutlet.id },
        data: {
          name: warehouseName,
          address: warehouseAddress,
          phone: warehousePhone,
          isActive: true,
        },
      });
    } else {
      warehouseOutlet = await prisma.outlet.create({
        data: {
          tenantId,
          name: warehouseName,
          address: warehouseAddress,
          phone: warehousePhone,
          isWarehouse: true,
          isActive: true,
        },
      });
    }

    // 2. Update data profil outlet, ukuran struk default, dan hubungkan ke gudang
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
        warehouseId: warehouseOutlet.id,
      },
    });

    // 3. Buat kasir pertama jika disediakan
    let createdCashier = null;
    if (cashierName && cashierPin) {
      const cashierEmail = `kasir-${Date.now()}@${tenantId.slice(0, 8)}.pos`;
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('kasir123', salt);

      createdCashier = await prisma.user.create({
        data: {
          tenantId,
          outletId: targetOutletId,
          name: cashierName,
          email: cashierEmail,
          passwordHash,
          pin: cashierPin,
          role: Role.CASHIER,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          pin: true,
          role: true,
        },
      });
    }

    // 4. Buat 1 Produk Pertama Terpandu & Alokasi Saldo Awal (Toko vs Gudang)
    let createdProduct = null;
    if (initialProduct && initialProduct.name) {
      const catName = initialProduct.categoryName || 'Umum';
      const category = await prisma.category.upsert({
        where: {
          tenantId_name: {
            tenantId,
            name: catName,
          },
        },
        update: {},
        create: {
          name: catName,
          tenantId,
        },
      });

      const sku = `SKU-${Date.now().toString().slice(-6)}`;
      const barcode = `899${Math.floor(1000000000 + Math.random() * 9000000000)}`;

      const product = await prisma.product.create({
        data: {
          tenantId,
          categoryId: category.id,
          name: initialProduct.name,
          sku,
          barcode,
          costPrice: initialProduct.costPrice || 0,
          basePrice: initialProduct.basePrice || 0,
          unit: initialProduct.unit || 'Pcs',
          isActive: true,
        },
      });

      const storeStockQty = initialProduct.isUnlimited
        ? 999999
        : (initialProduct.storeStock !== undefined ? initialProduct.storeStock : (initialProduct.initialStock || 0));

      const warehouseStockQty = initialProduct.isUnlimited
        ? 999999
        : (initialProduct.warehouseStock !== undefined ? initialProduct.warehouseStock : 0);

      // Hubungkan ke Toko Utama (Stok Siap Jual Kasir)
      await prisma.outletProduct.create({
        data: {
          outletId: targetOutletId,
          productId: product.id,
          stock: storeStockQty,
          minStockAlert: 5,
        },
      });

      // Hubungkan ke Gudang Utama (Stok Cadangan)
      if (warehouseOutlet && warehouseOutlet.id !== targetOutletId) {
        await prisma.outletProduct.create({
          data: {
            outletId: warehouseOutlet.id,
            productId: product.id,
            stock: warehouseStockQty,
            minStockAlert: 10,
          },
        });
      }

      // Catat Buku Besar Mutasi Saldo Awal untuk Toko
      if (!initialProduct.isUnlimited && storeStockQty > 0 && req.user?.id) {
        await prisma.stockMovement.create({
          data: {
            outletId: targetOutletId,
            productId: product.id,
            userId: req.user.id,
            type: StockMovementType.ADJUSTMENT,
            quantity: storeStockQty,
            notes: 'Saldo Awal Toko (Siap Jual di Etalase)',
          },
        });
      }

      // Catat Buku Besar Mutasi Saldo Awal untuk Gudang Utama
      if (!initialProduct.isUnlimited && warehouseStockQty > 0 && req.user?.id && warehouseOutlet) {
        await prisma.stockMovement.create({
          data: {
            outletId: warehouseOutlet.id,
            productId: product.id,
            userId: req.user.id,
            type: StockMovementType.ADJUSTMENT,
            quantity: warehouseStockQty,
            notes: 'Saldo Awal Gudang Utama (Stok Cadangan)',
          },
        });
      }

      createdProduct = {
        id: product.id,
        name: product.name,
        category: category.name,
        basePrice: product.basePrice,
        costPrice: product.costPrice,
        storeStock: storeStockQty,
        warehouseStock: warehouseStockQty,
        totalStock: storeStockQty + warehouseStockQty,
        unit: product.unit,
      };
    }

    return res.status(200).json({
      status: 'success',
      message: 'Onboarding toko berhasil diselesaikan!',
      data: {
        outletId: targetOutletId,
        receiptConfig,
        createdCashier,
        createdProduct,
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
 * Membaca Status Lisensi & Berlangganan SaaS
 * @route GET /api/saas/subscription
 */
export const getSubscriptionStatus = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({
        status: 'error',
        message: 'Konteks tenant tidak ditemukan',
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
        _count: {
          select: {
            outlets: true,
            users: true,
            products: true,
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

    const currentSub = tenant.subscriptions[0] || null;
    const now = new Date();
    let daysRemaining = 0;
    let isExpired = false;

    const expirationDate = currentSub?.expiresAt || tenant.trialEndsAt;
    if (expirationDate) {
      const diffTime = expirationDate.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      isExpired = diffTime <= 0;
    }

    return res.status(200).json({
      status: 'success',
      data: {
        tenant: {
          id: tenant.id,
          businessName: tenant.businessName,
          slug: tenant.slug,
          status: tenant.status,
          businessType: tenant.businessType,
          trialEndsAt: tenant.trialEndsAt,
          counts: tenant._count,
        },
        subscription: currentSub
          ? {
              id: currentSub.id,
              planCode: currentSub.plan.code,
              planName: currentSub.plan.name,
              features: (currentSub.plan.features as string[]) || [],
              isPro: currentSub.plan.code === 'PRO',
              isFree: currentSub.plan.code === 'FREE',
              maxOutlets: currentSub.plan.maxOutlets,
              maxCashiers: currentSub.plan.maxCashiers,
              expiresAt: currentSub.expiresAt,
            }
          : null,
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
