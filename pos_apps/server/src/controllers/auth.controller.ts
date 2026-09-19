import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'rahasia_super_aman_pos_12345';
const JWT_EXPIRES_IN = '7d';

// Skema validasi login email/password
const loginPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

// Skema validasi login PIN kasir
const loginPinSchema = z.object({
  pin: z.string().length(6, 'PIN harus terdiri dari 6 digit angka'),
  email: z.string().trim().toLowerCase().email().optional(),
  outletId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
});

// Skema validasi pairing perangkat kasir ke toko
const pairDeviceSchema = z.object({
  storeIdentifier: z.string().min(2, 'ID Toko atau Nomor Telepon wajib diisi'),
  authPin: z.string().length(6, 'PIN Otorisasi harus 6 digit'),
});

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
        select: { status: true, businessName: true },
      });
      if (tenant?.status === 'PENDING') {
        return res.status(403).json({
          status: 'error',
          code: 'TENANT_PENDING_APPROVAL',
          tenantName: tenant.businessName,
          message: `Akun bisnis "${tenant.businessName}" sedang dalam tahap peninjauan (Pending Approval) oleh tim SaaS. Silakan tunggu notifikasi persetujuan sebelum masuk.`,
        });
      }
    }

    // Verifikasi password hash
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
    let subscriptionInfo = null;
    if (user.tenantId) {
      const activeSub = await prisma.tenantSubscription.findFirst({
        where: { tenantId: user.tenantId, isActive: true },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });

      if (activeSub) {
        subscriptionInfo = {
          planCode: activeSub.plan.code,
          planName: activeSub.plan.name,
          features: (activeSub.plan.features as string[]) || [],
          isPro: activeSub.plan.code === 'PRO',
          isFree: activeSub.plan.code === 'FREE',
          expiresAt: activeSub.expiresAt,
        };
      }
    }

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
          pin: user.pin,
          tenantId: user.tenantId,
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
 * Controller: Login cepat kasir menggunakan PIN 6-digit
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

    const { pin, email, outletId, tenantId } = parseResult.data;

    // Filter pencarian user aktif
    const whereClause: any = {
      pin,
      isActive: true,
    };

    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    if (email) {
      whereClause.email = email;
    }

    if (outletId) {
      whereClause.OR = [
        { outletId },
        { outletId: null },
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
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

    if (users.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'PIN tidak sesuai atau kasir tidak terdaftar di toko ini',
      });
    }

    let user = users[0];

    // Jika ada lebih dari 1 user yang memakai PIN sama dan tanpa spesifikasi email/outlet
    if (users.length > 1) {
      // Prioritaskan akun dengan role CASHIER
      const cashiers = users.filter((u) => u.role === 'CASHIER');
      if (cashiers.length === 1) {
        user = cashiers[0];
      } else {
        return res.status(400).json({
          status: 'error',
          message: 'Ditemukan beberapa akun dengan PIN ini. Mohon sertakan email Anda.',
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

    // Ambil info paket langganan tenant (FREE vs PRO)
    let subscriptionInfo = null;
    if (user.tenantId) {
      const activeSub = await prisma.tenantSubscription.findFirst({
        where: { tenantId: user.tenantId, isActive: true },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });

      if (activeSub) {
        subscriptionInfo = {
          planCode: activeSub.plan.code,
          planName: activeSub.plan.name,
          features: (activeSub.plan.features as string[]) || [],
          isPro: activeSub.plan.code === 'PRO',
          isFree: activeSub.plan.code === 'FREE',
          expiresAt: activeSub.expiresAt,
        };
      }
    }

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
          pin: user.pin,
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
      },
    });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'Pengguna tidak ditemukan',
      });
    }

    // Ambil info paket langganan tenant (FREE vs PRO)
    let subscriptionInfo = null;
    if (user.tenantId) {
      const activeSub = await prisma.tenantSubscription.findFirst({
        where: { tenantId: user.tenantId, isActive: true },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });

      if (activeSub) {
        subscriptionInfo = {
          planCode: activeSub.plan.code,
          planName: activeSub.plan.name,
          features: (activeSub.plan.features as string[]) || [],
          isPro: activeSub.plan.code === 'PRO',
          isFree: activeSub.plan.code === 'FREE',
          expiresAt: activeSub.expiresAt,
        };
      }
    }

    return res.status(200).json({
      status: 'success',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        pin: user.pin,
        tenantId: user.tenantId,
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

    const { storeIdentifier, authPin } = parseResult.data;
    const cleanId = storeIdentifier.trim();
    const digitsOnly = cleanId.replace(/\D/g, '');
    const phoneCandidates = [
      cleanId,
      digitsOnly ? `+62${digitsOnly.replace(/^62/, '').replace(/^0+/, '')}` : '',
      digitsOnly ? `0${digitsOnly.replace(/^62/, '').replace(/^0+/, '')}` : '',
    ].filter(Boolean);

    // Cari tenant berdasarkan slug, phone, email user, atau id tenant
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: cleanId.toLowerCase() },
          { phone: { in: phoneCandidates } },
          { users: { some: { email: cleanId.toLowerCase() } } },
          ...(cleanId.length === 36 ? [{ id: cleanId }] : []),
        ],
      },
      include: {
        outlets: {
          where: { isWarehouse: false, isActive: true },
          select: { id: true, name: true, address: true, phone: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({
        status: 'error',
        message: 'Toko dengan ID Toko, Email Pemilik, atau Nomor HP tersebut tidak ditemukan',
      });
    }

    // Validasi authPin harus cocok dengan PIN Owner/Admin atau Supervisor di tenant tersebut
    const authorizedUser = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        pin: authPin,
        role: { in: ['ADMIN', 'SUPERVISOR'] },
        isActive: true,
      },
      select: { id: true, name: true, role: true },
    });

    if (!authorizedUser) {
      return res.status(401).json({
        status: 'error',
        message: 'PIN Otorisasi Pemilik / Supervisor salah atau akun tidak memiliki wewenang',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: `Perangkat berhasil dihubungkan dengan ${tenant.businessName}`,
      data: {
        tenant: {
          id: tenant.id,
          businessName: tenant.businessName,
          slug: tenant.slug,
          phone: tenant.phone,
        },
        outlets: tenant.outlets,
        authorizedBy: authorizedUser.name,
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
    const { tenantId, outletId } = req.query;
    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ status: 'error', message: 'Tenant ID wajib disertakan' });
    }

    const where: any = {
      tenantId,
      isActive: true,
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
