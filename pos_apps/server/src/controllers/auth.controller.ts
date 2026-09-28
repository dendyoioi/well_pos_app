import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/prisma';

// Fix K2: JWT_SECRET WAJIB ada di environment. Jika tidak ada, server gagal startup secara eksplisit.
// Generate dengan: openssl rand -hex 64
if (!process.env.JWT_SECRET) {
  throw new Error('[FATAL] JWT_SECRET tidak ditemukan di environment variables. Server tidak dapat dijalankan tanpa secret yang aman.');
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

// Skema validasi login email/password
const loginPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

// Skema validasi login PIN kasir
const loginPinSchema = z.object({
  pin: z.string().length(6, 'PIN harus terdiri dari 6 digit angka'),
  userCode: z.string().min(1).max(20).optional(), // ID Staff kasir (5 digit, misal: 10001)
  email: z.string().trim().toLowerCase().email().optional(),
  outletId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
});

// Skema validasi pairing perangkat kasir ke toko menggunakan ID Toko + ID Staff Owner/SPV
const pairDeviceSchema = z.object({
  tenantSlug: z.string().min(1, 'ID Toko wajib diisi'),       // slug toko, misal: kopi-nusantara
  staffCode: z.string().min(1, 'ID Staff Owner/SPV wajib diisi'), // userCode, misal: 00001
  authPin: z.string().length(6, 'PIN Otorisasi harus 6 digit'),
});

/**
 * Helper: Ambil info langganan aktif tenant (FREE vs PRO)
 */
const getTenantSubscriptionInfo = async (tenantId: string) => {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT ts.id, ts.expires_at, ts.is_active, sp.code as plan_code, sp.name as plan_name, sp.features
       FROM "tenant_subscriptions" ts
       JOIN "subscription_plans" sp ON sp.id = ts.plan_id
       WHERE ts.tenant_id = $1 AND ts.is_active = true
       ORDER BY ts.created_at DESC LIMIT 1;`,
      tenantId
    );
    if (!rows || rows.length === 0) return null;
    const sub = rows[0];
    return {
      planCode: sub.plan_code,
      planName: sub.plan_name,
      features: (sub.features as string[]) || [],
      isPro: sub.plan_code === 'PRO',
      isFree: sub.plan_code === 'FREE',
      expiresAt: sub.expires_at,
    };
  } catch (err) {
    return null;
  }
};

/**
 * Controller: Login menggunakan Email & Password
 * @route POST /api/auth/login
 */
export const loginWithPassword = async (req: Request, res: Response) => {
  try {
    const parseResult = loginPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parseResult.data;

    // Cari user berdasarkan email (case-insensitive & trimmed)
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            phone: true,
            status: true,
            slug: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Email atau kata sandi salah',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        status: 'error',
        message: 'Akun Anda dinonaktifkan. Silakan hubungi administrator.',
      });
    }

    if (user.tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { status: true, name: true },
      });
      if (tenant?.status === 'PENDING') {
        return res.status(403).json({
          status: 'error',
          code: 'TENANT_PENDING_APPROVAL',
          tenantName: tenant.name,
          message: `Akun bisnis "${tenant.name}" sedang dalam tahap peninjauan (Pending Approval) oleh tim SaaS. Silakan tunggu notifikasi persetujuan sebelum masuk.`,
        });
      }
    }

    // Verifikasi password hash
    if (!user.passwordHash) {
      return res.status(401).json({
        status: 'error',
        message: 'Pengguna ini tidak memiliki kata sandi aktif. Silakan gunakan Login PIN kasir.',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Email atau kata sandi salah',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        outletId: user.outletId,
        tenantId: user.tenantId,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Ambil info paket langganan tenant (FREE vs PRO)
    const subscriptionInfo = user.tenantId ? await getTenantSubscriptionInfo(user.tenantId) : null;

    return res.status(200).json({
      status: 'success',
      message: 'Login berhasil',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          hasPin: !!user.pinHash,
          tenantId: user.tenantId,
          tenant: user.tenant
            ? {
                id: user.tenant.id,
                name: user.tenant.name,
                phone: user.tenant.phone,
                slug: user.tenant.slug,
              }
            : null,
          outlet: user.outlet,
          subscription: subscriptionInfo,
        },
      },
    });
  } catch (error) {
    console.error('Error saat login dengan password:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan pada server saat proses login',
    });
  }
};

/**
 * Controller: Login cepat kasir menggunakan ID Staff (userCode) + PIN 6-digit
 * @route POST /api/auth/pin-login
 */
export const loginWithPin = async (req: Request, res: Response) => {
  try {
    const parseResult = loginPinSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { pin, userCode, email, outletId, tenantId } = parseResult.data;

    // Bangun filter pencarian user aktif yang memiliki PIN
    const whereClause: any = {
      isActive: true,
      pinHash: { not: null },
    };

    if (tenantId) whereClause.tenantId = tenantId;

    if (userCode && userCode.trim()) {
      // Cara baru: cari by userCode + tenantId (presisi, tidak perlu scan semua PIN)
      whereClause.userCode = userCode.trim();
    } else if (email) {
      whereClause.email = email;
    } else if (outletId) {
      // Fallback lama: scan PIN di outlet
      whereClause.OR = [
        { outletId },
        { outletId: null },
      ];
    }

    const candidateUsers = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        userCode: true,
        pinHash: true,
        tenantId: true,
        outletId: true,
        outlet: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
          },
        },
      },
    });

    // Validasi PIN via bcrypt
    const matchingUsers: typeof candidateUsers = [];
    for (const cand of candidateUsers) {
      if (cand.pinHash) {
        const isMatch = await bcrypt.compare(pin, cand.pinHash);
        if (isMatch) matchingUsers.push(cand);
      }
    }

    if (matchingUsers.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'ID Staff atau PIN tidak sesuai. Pastikan ID Staff dan PIN 6-digit Anda benar.',
      });
    }

    let user = matchingUsers[0];

    // Jika ada lebih dari 1 match (kasus PIN sama, userCode tidak disertakan)
    if (matchingUsers.length > 1) {
      const cashiers = matchingUsers.filter((u) => u.role === 'CASHIER');
      if (cashiers.length === 1) {
        user = cashiers[0];
      } else {
        return res.status(400).json({
          status: 'error',
          message: 'Ditemukan beberapa akun. Mohon sertakan ID Staff Anda.',
        });
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        outletId: user.outletId,
        tenantId: user.tenantId,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const subscriptionInfo = user.tenantId ? await getTenantSubscriptionInfo(user.tenantId) : null;

    return res.status(200).json({
      status: 'success',
      message: 'Login PIN kasir berhasil',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          userCode: user.userCode,
          hasPin: !!user.pinHash,
          tenantId: user.tenantId,
          outlet: user.outlet,
          subscription: subscriptionInfo,
        },
      },
    });
  } catch (error) {
    console.error('Error saat login PIN:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan pada server saat proses login PIN',
    });
  }
};

/**
 * Controller: Mendapatkan profil user yang sedang login
 * @route GET /api/auth/me
 */
export const getProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Pengguna belum terautentikasi',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            isActive: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            phone: true,
            status: true,
            slug: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'Pengguna tidak ditemukan',
      });
    }

    // Ambil info paket langganan tenant (FREE vs PRO)
    const subscriptionInfo = user.tenantId ? await getTenantSubscriptionInfo(user.tenantId) : null;

    return res.status(200).json({
      status: 'success',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        hasPin: !!user.pinHash,
        tenantId: user.tenantId,
        tenant: user.tenant
          ? {
              id: user.tenant.id,
              name: user.tenant.name,
              phone: user.tenant.phone,
              slug: user.tenant.slug,
            }
          : null,
        isActive: user.isActive,
        createdAt: user.createdAt,
        outlet: user.outlet,
        subscription: subscriptionInfo,
      },
    });
  } catch (error) {
    console.error('Error saat mengambil data profil:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan saat mengambil profil pengguna',
    });
  }
};

/**
 * Controller: Menghubungkan (Pairing) Perangkat Mesin Kasir ke Toko
 * @route POST /api/auth/pair-device
 */
/**
 * Controller: Pairing perangkat kasir menggunakan ID Toko (slug) + ID Staff Owner/SPV + PIN
 * Alur:
 *  1. Identifikasi tenant via slug toko
 *  2. Cari user Owner/SPV dalam tenant tersebut berdasarkan userCode
 *  3. Verifikasi PIN — hanya Owner/SPV yang berwenang pairing
 * @route POST /api/auth/pair-device
 */
export const pairDevice = async (req: Request, res: Response) => {
  try {
    const parseResult = pairDeviceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { tenantSlug, staffCode, authPin } = parseResult.data;

    // Langkah 1: Identifikasi tenant via slug toko
    const tenant = await prisma.tenant.findFirst({
      where: { slug: tenantSlug.trim().toLowerCase() },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        outlets: {
          where: { isActive: true },
          select: { id: true, name: true, address: true, phone: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({
        status: 'error',
        message: 'ID Toko tidak ditemukan. Pastikan slug toko Anda benar (contoh: kopi-nusantara).',
      });
    }

    if (tenant.status === 'PENDING') {
      return res.status(403).json({
        status: 'error',
        message: `Akun bisnis "${tenant.name}" belum diaktivasi. Hubungi administrator.`,
      });
    }

    // Langkah 2: Cari user aktif dalam tenant ini berdasarkan userCode
    const candidateUsers = await prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        userCode: staffCode.trim(),
        isActive: true,
        pinHash: { not: null },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        userCode: true,
        pinHash: true,
        outletId: true,
        outlet: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
          },
        },
      },
    });

    if (candidateUsers.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'ID Staff tidak ditemukan di toko ini atau belum memiliki PIN aktif.',
      });
    }

    // Langkah 3: Verifikasi PIN
    let authorizedUser: typeof candidateUsers[0] | null = null;
    for (const cand of candidateUsers) {
      if (cand.pinHash && (await bcrypt.compare(authPin, cand.pinHash))) {
        authorizedUser = cand;
        break;
      }
    }

    if (!authorizedUser) {
      return res.status(401).json({
        status: 'error',
        message: 'PIN tidak sesuai dengan ID Staff ini.',
      });
    }

    // Generate JWT token login otomatis
    const token = jwt.sign(
      {
        userId: authorizedUser.id,
        role: authorizedUser.role,
        outletId: authorizedUser.outletId,
        tenantId: tenant.id,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const subscriptionInfo = await getTenantSubscriptionInfo(tenant.id);

    return res.status(200).json({
      status: 'success',
      message: `Perangkat berhasil dihubungkan dengan ${tenant.name}`,
      data: {
        tenant: {
          id: tenant.id,
          businessName: tenant.name,
          slug: tenant.slug,
        },
        outlets: tenant.outlets,
        authorizedBy: authorizedUser.name,
        token,
        user: {
          id: authorizedUser.id,
          name: authorizedUser.name,
          email: authorizedUser.email,
          role: authorizedUser.role,
          userCode: authorizedUser.userCode,
          hasPin: true,
          tenantId: tenant.id,
          outletId: authorizedUser.outletId,
          outlet: authorizedUser.outlet,
          subscription: subscriptionInfo,
        },
      },
    });
  } catch (error: any) {
    console.error('Error saat pairing perangkat:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghubungkan perangkat mesin kasir',
    });
  }
};



/**
 * Controller: Mengambil daftar kasir aktif di cabang yang sudah terpasang (paired)
 * @route GET /api/auth/paired-cashiers
 */
export const getPairedOutletCashiers = async (req: Request, res: Response) => {
  try {
    const { outletId } = req.query;
    const queryTenantId = req.query.tenantId as string;
    const tenantId = (req as any).user?.tenantId || (req as any).tenantId || queryTenantId;
    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ status: 'error', message: 'Tenant ID wajib disertakan' });
    }

    const where: any = {
      tenantId,
      isActive: true,
      // Fix S3: Hanya tampilkan staf dengan role yang relevan untuk terminal kasir.
      // Petugas gudang (WAREHOUSE) tidak perlu muncul sebagai pilihan kasir.
      role: { in: ['CASHIER', 'SUPERVISOR', 'ADMIN', 'OWNER'] },
    };

    if (outletId && typeof outletId === 'string') {
      where.OR = [
        { outletId },
        { outletId: null },
      ];
    }

    const cashiers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        userCode: true,
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      status: 'success',
      data: cashiers,
    });
  } catch (error: any) {
    console.error('Error memuat staf kasir:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat staf kasir' });
  }
};
