import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { userDualWriteService } from '../services/dual_write';
import { invalidateUserAuthCache } from '../middlewares/auth.middleware';
import {
  roleService,
  DEFAULT_FNB_ROLES,
  RolePermissions,
  SYSTEM_PERMISSIONS,
  SYSTEM_LAUNDRY_PERMISSIONS,
} from '../services/role.service';

export const checkTenantIsLaundry = async (tenantId: string): Promise<boolean> => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessVertical: true, businessType: true, name: true },
    });
    if (
      tenant?.businessVertical === 'SERVICES' ||
      (typeof tenant?.businessType === 'string' && tenant.businessType.toLowerCase().includes('laundry')) ||
      (typeof tenant?.name === 'string' && tenant.name.toLowerCase().includes('laundry'))
    ) {
      return true;
    }
    const laundryOutlet = await prisma.outlet.findFirst({
      where: {
        tenantId,
        OR: [
          { name: { contains: 'laundry', mode: 'insensitive' } },
          { name: { contains: 'cuci', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    return !!laundryOutlet;
  } catch {
    return false;
  }
};

function mapToSystemRole(roleInput?: string): Role {
  if (!roleInput) return Role.CASHIER;
  const upper = roleInput.toUpperCase();
  // Direct enum match (OWNER, ADMIN, CASHIER, SUPERVISOR, KITCHEN, WAREHOUSE, WAITER)
  if (Object.values(Role).includes(upper as Role)) {
    return upper as Role;
  }
  // Semantic fallbacks
  if (upper.includes('SUPERVISOR') || upper.includes('MANAGER')) return Role.SUPERVISOR;
  if (upper.includes('KITCHEN') || upper.includes('BARISTA') || upper.includes('COOK') || upper.includes('PRODUCTION') || upper.includes('PRODUKSI') || upper.includes('OPERATOR')) return Role.KITCHEN;
  if (upper.includes('WAITER') || upper.includes('PELAYAN') || upper.includes('COURIER') || upper.includes('KURIR') || upper.includes('DRIVER')) return Role.WAITER;
  if (upper.includes('GUDANG') || upper.includes('WAREHOUSE')) return Role.WAREHOUSE;
  if (upper.includes('ADMIN') || upper.includes('OWNER')) return Role.ADMIN;
  return Role.CASHIER;
}

const createUserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter').optional(),
  userCode: z.string().regex(/^\d{5}$/, 'ID Staf harus tepat 5 digit angka, contoh: 10001').optional(),
  pin: z.string().min(4, 'PIN minimal 4 digit').max(6, 'PIN maksimal 6 digit').regex(/^\d{4,6}$/, 'PIN harus berupa angka'),
  voidPin: z.string().regex(/^\d{6}$/, 'PIN Khusus Void harus tepat 6 digit angka').optional().nullable().or(z.literal('')),
  role: z.string().default('CASHIER'),
  customRoleId: z.string().optional().nullable(),
  outletId: z.string().uuid().optional().nullable(),
  canCashOut: z.boolean().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').optional(),
  email: z.string().email('Format email tidak valid').optional(),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter').optional().or(z.literal('')),
  userCode: z.string().regex(/^\d{5}$/, 'ID Staf harus tepat 5 digit angka, contoh: 10001').optional(),
  pin: z.string().min(4).max(6).regex(/^\d{4,6}$/, 'PIN harus berupa angka').optional().nullable(),
  voidPin: z.string().regex(/^\d{6}$/, 'PIN Khusus Void harus tepat 6 digit angka').optional().nullable().or(z.literal('')),
  clearVoidPin: z.boolean().optional(),
  role: z.string().optional(),
  customRoleId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  outletId: z.string().uuid().optional().nullable(),
  canCashOut: z.boolean().optional(),
});

/**
 * Mendapatkan daftar semua staf / pengguna
 * @route GET /api/users
 */
export const getUsers = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const users = await prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        userCode: true,
        name: true,
        email: true,
        role: true,
        customRoleId: true,
        canCashOut: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        pinHash: true,
        voidPinHash: true,
        passwordHash: true,
        outletId: true,
        outlet: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Temukan akun pendaftar awal (prioritas role OWNER, atau user pertama yang dibuat)
    const initialOwnerUser = users.find((u) => u.role === Role.OWNER) || users[0];

    const isLaundry = await checkTenantIsLaundry(tenantId);
    const tenantRoles = roleService.getTenantRoles(tenantId, isLaundry);
    const roleMap = new Map<string, string>();
    tenantRoles.forEach((r) => roleMap.set(r.id, r.name));

    // Sanitize: jangan expose hash sensitif ke client
    const sanitized = users.map(({ pinHash, voidPinHash, passwordHash, ...u }) => ({
      ...u,
      customRoleName: u.customRoleId ? roleMap.get(u.customRoleId) || null : null,
      hasPin: pinHash !== null,
      hasVoidPin: voidPinHash !== null,
      hasPassword: passwordHash !== null,
      isInitialOwner: initialOwnerUser ? u.id === initialOwnerUser.id : false,
    }));

    return res.status(200).json({
      status: 'success',
      data: sanitized,
    });
  } catch (error) {
    console.error('Error saat mengambil daftar pengguna:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data staf / pengguna',
    });
  }
};

/**
 * Membuat akun staf baru
 * @route POST /api/users
 */
export const createUser = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const parseResult = createUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi data gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { name, email, password, userCode, pin, voidPin, role, customRoleId, outletId } = parseResult.data;
    const systemRole = mapToSystemRole(role);
    const trimmedVoidPin = typeof voidPin === 'string' && voidPin.trim() !== '' ? voidPin.trim() : null;

    if (trimmedVoidPin && !([Role.OWNER, Role.ADMIN, Role.SUPERVISOR] as Role[]).includes(systemRole)) {
      return res.status(400).json({
        status: 'error',
        message: 'PIN Khusus Void hanya berlaku untuk role Owner, Admin, atau Supervisor.',
      });
    }

    if (trimmedVoidPin && pin && trimmedVoidPin === pin.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'PIN Khusus Void harus berbeda dari PIN Akses / Login Terminal.',
      });
    }

    // Cek apakah email sudah digunakan
    const existingUsers = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "users" WHERE email = $1 LIMIT 1;`,
      email
    );
    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Email sudah terdaftar untuk pengguna lain',
      });
    }

    // Cek jika userCode sudah digunakan dalam tenant
    if (userCode) {
      const existingCode = await prisma.user.findFirst({
        where: { tenantId, userCode },
      });
      if (existingCode) {
        return res.status(400).json({
          status: 'error',
          message: `ID Staf ${userCode} sudah digunakan, silakan buat ID unik lain`,
        });
      }
    }

    // Hash password (default Password123! jika tidak diisi)
    const effectivePassword = password && password.trim() !== '' ? password : 'Password123!';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(effectivePassword, salt);

    // Ambil default outlet tenant jika tidak disediakan
    let assignedOutletId = outletId;
    if (!assignedOutletId) {
      const defaultOutlet = await prisma.outlet.findFirst({
        where: { tenantId },
      });
      assignedOutletId = defaultOutlet?.id || null;
    }

    const result = await prisma.$transaction(async (tx) => {
      return await userDualWriteService.createUser(
        {
          name,
          email,
          passwordHash,
          userCode: userCode || null,
          pin,
          voidPin: trimmedVoidPin,
          role: systemRole,
          customRoleId: customRoleId || null,
          outletId: assignedOutletId,
          canCashOut: parseResult.data.canCashOut ?? false,
          isActive: true,
        },
        { tx, tenantId, actorUserId: req.user?.id }
      );
    });

    const userDb = await prisma.user.findUnique({
      where: { id: result.legacyData.id },
      select: {
        id: true,
        userCode: true,
        name: true,
        email: true,
        role: true,
        customRoleId: true,
        canCashOut: true,
        isActive: true,
        createdAt: true,
        voidPinHash: true,
        outlet: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const { voidPinHash: createdVoidPinHash, ...userDbSafe } = userDb || ({} as any);
    const newUser = {
      ...userDbSafe,
      pin: result.legacyData.pin,
      hasVoidPin: Boolean(createdVoidPinHash),
    };

    return res.status(201).json({
      status: 'success',
      message: 'Akun staf berhasil dibuat',
      data: newUser,
    });
  } catch (error) {
    console.error('Error saat membuat akun staf:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal membuat akun staf baru',
    });
  }
};

/**
 * Mengupdate data staf / pengguna
 * @route PUT /api/users/:id
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const { id } = req.params;
    const parseResult = updateUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi data gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const userRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, email FROM "users" WHERE id = $1 AND ($2::text IS NULL OR tenant_id = $2) LIMIT 1;`,
      id,
      tenantId || null
    );
    if (!userRows || userRows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Pengguna tidak ditemukan dalam bisnis Anda',
      });
    }
    const user = userRows[0];

    const { name, email, password, pin, voidPin, clearVoidPin, role, customRoleId, userCode, isActive, outletId } = parseResult.data;

    const currentCredentialRecord = await prisma.user.findUnique({
      where: { id },
      select: { userCode: true, role: true, pinHash: true, voidPinHash: true },
    });

    // Jika userCode diubah, pastikan tidak duplikat di tenant
    if (userCode) {
      if (currentCredentialRecord && userCode !== currentCredentialRecord.userCode) {
        const existingCode = await prisma.user.findFirst({
          where: { tenantId, userCode, id: { not: id } },
        });
        if (existingCode) {
          return res.status(400).json({
            status: 'error',
            message: `ID Staf ${userCode} sudah digunakan, silakan buat ID unik lain`,
          });
        }
      }
    }

    // Jika email diubah, pastikan tidak duplikat
    if (email && email !== user.email) {
      const emailTaken = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM "users" WHERE email = $1 AND id != $2 LIMIT 1;`,
        email,
        id
      );
      if (emailTaken && emailTaken.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Email sudah digunakan pengguna lain',
        });
      }
    }

    // Ambil role saat ini dari DB untuk memastikan konsistensi
    const currentUserRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT role FROM "users" WHERE id = $1 AND tenant_id = $2 LIMIT 1;`,
      id,
      tenantId
    );
    const currentRole = currentUserRows?.[0]?.role as Role | undefined;

    // Tentukan role yang akan disimpan — jaga agar OWNER / pendaftar awal tidak bisa di-downgrade atau dinonaktifkan
    const initialOwnerUser = await prisma.user.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    const isInitialOwner = currentRole === Role.OWNER || (initialOwnerUser && id === initialOwnerUser.id);

    let targetRole: Role | undefined = undefined;
    if (isInitialOwner) {
      targetRole = Role.OWNER;
      if (isActive === false) {
        return res.status(400).json({
          status: 'error',
          message: 'Akun Pemilik Usaha / Pendaftar Awal utama tidak dapat dinonaktifkan.',
        });
      }
    } else if (role) {
      targetRole = mapToSystemRole(role);
    }

    const effectiveRole = targetRole || currentRole || currentCredentialRecord?.role || Role.CASHIER;
    const isVoidPinPrivilegedRole = ([Role.OWNER, Role.ADMIN, Role.SUPERVISOR] as Role[]).includes(effectiveRole);
    const trimmedVoidPinInput = typeof voidPin === 'string' && voidPin.trim() !== '' ? voidPin.trim() : null;

    if (trimmedVoidPinInput && !isVoidPinPrivilegedRole) {
      return res.status(400).json({
        status: 'error',
        message: 'PIN Khusus Void hanya berlaku untuk role Owner, Admin, atau Supervisor.',
      });
    }

    let voidPinUpdate: string | null | undefined = undefined;
    if (!isVoidPinPrivilegedRole) {
      if (currentCredentialRecord?.voidPinHash) {
        voidPinUpdate = null;
      }
    } else if (clearVoidPin === true) {
      voidPinUpdate = null;
    } else if (trimmedVoidPinInput) {
      voidPinUpdate = trimmedVoidPinInput;
    }

    // Validasi wajib berbeda antara PIN Akses (pinHash) & PIN Khusus Void (voidPinHash)
    const trimmedAccessPinInput = typeof pin === 'string' && pin.trim() !== '' ? pin.trim() : null;
    if (voidPinUpdate && trimmedAccessPinInput && voidPinUpdate === trimmedAccessPinInput) {
      return res.status(400).json({
        status: 'error',
        message: 'PIN Khusus Void harus berbeda dari PIN Akses / Login Terminal.',
      });
    }
    if (voidPinUpdate && !trimmedAccessPinInput && currentCredentialRecord?.pinHash) {
      if (await bcrypt.compare(voidPinUpdate, currentCredentialRecord.pinHash)) {
        return res.status(400).json({
          status: 'error',
          message: 'PIN Khusus Void harus berbeda dari PIN Akses / Login Terminal.',
        });
      }
    }
    if (trimmedAccessPinInput && voidPinUpdate === undefined && currentCredentialRecord?.voidPinHash) {
      if (await bcrypt.compare(trimmedAccessPinInput, currentCredentialRecord.voidPinHash)) {
        return res.status(400).json({
          status: 'error',
          message: 'PIN Akses tidak boleh sama dengan PIN Khusus Void.',
        });
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (targetRole) updateData.role = targetRole;
    if (pin !== undefined) updateData.pin = pin;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (outletId !== undefined) updateData.outletId = outletId;

    if (password && password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password, salt);
    }

    await prisma.$transaction(async (tx) => {
      return await userDualWriteService.updateUser(
        id,
        {
          name,
          email,
          passwordHash: updateData.passwordHash,
          pin: pin !== undefined ? (pin || null) : undefined,
          voidPin: voidPinUpdate,
          role: targetRole,
          customRoleId: customRoleId !== undefined ? (customRoleId || null) : undefined,
          userCode: userCode !== undefined ? (userCode || null) : undefined,
          isActive,
          outletId,
          canCashOut: parseResult.data.canCashOut,
        },
        { tx, tenantId, actorUserId: req.user?.id }
      );
    });

    const userDb = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        userCode: true,
        name: true,
        email: true,
        role: true,
        customRoleId: true,
        canCashOut: true,
        isActive: true,
        updatedAt: true,
        pinHash: true,
        voidPinHash: true,
        outlet: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const { pinHash: updatedPinHash, voidPinHash: updatedVoidPinHash, ...updatedDbSafe } = userDb || ({} as any);
    const updatedUser = {
      ...updatedDbSafe,
      pin: pin !== undefined ? (pin || null) : null,
      hasPin: Boolean(updatedPinHash),
      hasVoidPin: Boolean(updatedVoidPinHash),
    };

    invalidateUserAuthCache(id);

    return res.status(200).json({
      status: 'success',
      message: 'Data staf berhasil diperbarui',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error saat update staf:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui data staf',
    });
  }
};

/**
 * Menghapus atau menonaktifkan staf
 * @route DELETE /api/users/:id
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const { id } = req.params;

    // Jangan izinkan user menghapus dirinya sendiri
    if (req.user?.id === id) {
      return res.status(400).json({
        status: 'error',
        message: 'Tidak dapat menghapus atau menonaktifkan akun sendiri yang sedang aktif',
      });
    }

    const user = await prisma.user.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            orders: true,
            shifts: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'Pengguna tidak ditemukan dalam bisnis Anda',
      });
    }

    // Pemilik Usaha (Owner) utama / pendaftar awal tidak dapat dinonaktifkan atau dihapus dari Backoffice
    const initialOwnerUser = await prisma.user.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    if (user.role === Role.OWNER || (initialOwnerUser && user.id === initialOwnerUser.id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Akun Pemilik Usaha / Pendaftar Awal utama tidak dapat dinonaktifkan atau dihapus. Penghapusan akun hanya dapat dilakukan melalui portal SuperAdmin.',
      });
    }

    // Jika user sudah memiliki riwayat transaksi/shift, lakukan soft-delete (isActive: false)
    if (user._count.orders > 0 || user._count.shifts > 0) {
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
      invalidateUserAuthCache(id);
      return res.status(200).json({
        status: 'success',
        message: 'Akun staf telah dinonaktifkan (arsip tersimpan untuk audit)',
      });
    }

    // Jika belum ada riwayat, bisa dihapus permanen
    await prisma.user.delete({
      where: { id },
    });
    invalidateUserAuthCache(id);

    return res.status(200).json({
      status: 'success',
      message: 'Akun staf berhasil dihapus permanen',
    });
  } catch (error) {
    console.error('Error saat menghapus staf:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus pengguna',
    });
  }
};

// =========================================================================
// AKSES & PERAN (GRANULAR RBAC DOMAIN)
// =========================================================================

/**
 * Menghasilkan ID Staf 5-digit berikutnya yang unik berdasarkan peran
 * @route GET /api/users/next-code
 */
export const getNextUserCode = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const roleParam = ((req.query.role as string) || 'CASHIER').toUpperCase();
    const existingUsers = await prisma.user.findMany({
      where: { tenantId },
      select: { userCode: true },
    });
    const existingSet = new Set(existingUsers.map((u) => u.userCode).filter(Boolean));

    let start = 50001;
    let end = 99999;
    if (roleParam === 'OWNER' || roleParam === 'ADMIN') {
      start = 1;
      end = 9999;
    } else if (roleParam === 'CASHIER') {
      start = 10001;
      end = 49999;
    }

    let nextCode = '';
    for (let i = start; i <= end; i++) {
      const candidate = String(i).padStart(5, '0');
      if (!existingSet.has(candidate)) {
        nextCode = candidate;
        break;
      }
    }

    if (!nextCode) {
      nextCode = String(Date.now()).slice(-5);
    }

    return res.status(200).json({
      status: 'success',
      data: {
        userCode: nextCode,
        role: roleParam,
      },
    });
  } catch (err: any) {
    console.error('Error saat menghasilkan userCode berikutnya:', err);
    return res.status(500).json({ status: 'error', message: 'Gagal menghasilkan ID staf berikutnya' });
  }
};

/**
 * Mendapatkan daftar master izin sistem fungsional
 * @route GET /api/users/roles/permissions
 */
export const getSystemPermissions = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const isLaundry = tenantId ? await checkTenantIsLaundry(tenantId) : false;

    return res.status(200).json({
      status: 'success',
      data: isLaundry ? SYSTEM_LAUNDRY_PERMISSIONS : SYSTEM_PERMISSIONS,
    });
  } catch (err) {
    return res.status(200).json({
      status: 'success',
      data: SYSTEM_PERMISSIONS,
    });
  }
};

/**
 * Mendapatkan daftar semua peran staf & otoritas
 * @route GET /api/users/roles
 */
export const getRoles = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const isLaundry = await checkTenantIsLaundry(tenantId);
    const allRoles = roleService.getTenantRoles(tenantId, isLaundry);

    // Hitung staff count per role (akurat: peran kustom menghitung customRoleId)
    const users = await prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: { role: true, customRoleId: true },
    });

    const rolesWithCounts = allRoles.map((r) => {
      let count = 0;
      if (!r.isDefault || r.id.startsWith('role-custom')) {
        count = users.filter((u) => u.customRoleId === r.id).length;
      } else {
        const usersInRole = users.filter((u) => !u.customRoleId || u.customRoleId === r.id);
        if (r.id === 'role-owner') count = usersInRole.filter((u) => u.role === 'ADMIN' || (u.role as any) === 'OWNER').length;
        else if (r.id === 'role-supervisor') count = usersInRole.filter((u) => u.role === 'SUPERVISOR').length;
        else if (r.id === 'role-cashier') count = usersInRole.filter((u) => u.role === 'CASHIER').length;
        else if (r.id === 'role-production' || r.id === 'role-barista') count = usersInRole.filter((u) => u.role === 'KITCHEN' || (u.role as any) === 'BARISTA' || (u.role as any) === 'PRODUCTION').length;
        else if (r.id === 'role-warehouse') count = usersInRole.filter((u) => u.role === 'WAREHOUSE').length;
        else if (r.id === 'role-courier' || r.id === 'role-waiter') count = usersInRole.filter((u) => u.role === 'WAITER' || (u.role as any) === 'COURIER').length;
        else count = 0;
      }

      return {
        ...r,
        staffCount: count,
      };
    });

    return res.status(200).json({
      status: 'success',
      data: rolesWithCounts,
    });
  } catch (err) {
    console.error('Error saat mengambil daftar peran:', err);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil data peran' });
  }
};

/**
 * Membuat peran baru
 * @route POST /api/users/roles
 */
export const createRole = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const { name, description, status, permissions, functionalPermissions, businessPermissions } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ status: 'error', message: 'Nama peran wajib diisi' });
    }

    const newRole: RolePermissions = {
      id: `role-custom-${Date.now()}`,
      name: name.trim(),
      description: description || undefined,
      status: status !== undefined ? Boolean(status) : true,
      isDefault: false,
      permissions: Array.isArray(permissions) ? permissions : [],
      functionalPermissions: functionalPermissions || undefined,
      businessPermissions: businessPermissions || {
        orderDiscount: { maxPercent: 0, maxAmount: 0 },
        productDiscount: { maxPercent: 0, maxAmount: 0 },
      },
    };

    roleService.saveTenantRole(tenantId, newRole);

    return res.status(201).json({
      status: 'success',
      message: 'Peran baru berhasil dibuat',
      data: newRole,
    });
  } catch (err) {
    console.error('Error saat membuat peran baru:', err);
    return res.status(500).json({ status: 'error', message: 'Gagal membuat peran baru' });
  }
};

/**
 * Memperbarui peran
 * @route PUT /api/users/roles/:id
 */
export const updateRole = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const { id } = req.params;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const { name, description, status, permissions, functionalPermissions, businessPermissions } = req.body;

    const allRoles = roleService.getTenantRoles(tenantId);
    const existing = allRoles.find((r) => r.id === id);

    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Peran tidak ditemukan' });
    }

    const updatedRole: RolePermissions = {
      ...existing,
      name: name ? name.trim() : existing.name,
      description: description !== undefined ? description : existing.description,
      status: existing.id === 'role-owner' ? true : (status !== undefined ? Boolean(status) : existing.status),
      permissions: existing.id === 'role-owner' ? SYSTEM_PERMISSIONS.map((p) => p.id) : (Array.isArray(permissions) ? permissions : existing.permissions),
      functionalPermissions: functionalPermissions || existing.functionalPermissions,
      businessPermissions: businessPermissions || existing.businessPermissions,
    };

    roleService.saveTenantRole(tenantId, updatedRole);

    return res.status(200).json({
      status: 'success',
      message: 'Peran berhasil diperbarui',
      data: updatedRole,
    });
  } catch (err) {
    console.error('Error saat memperbarui peran:', err);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui peran' });
  }
};

/**
 * Menghapus peran kustom
 * @route DELETE /api/users/roles/:id
 */
export const deleteRole = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const { id } = req.params;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    if (DEFAULT_FNB_ROLES.some((r) => r.id === id)) {
      return res.status(400).json({ status: 'error', message: 'Peran sistem bawaan tidak dapat dihapus' });
    }

    roleService.deleteTenantRole(tenantId, id);

    return res.status(200).json({
      status: 'success',
      message: 'Peran berhasil dihapus',
    });
  } catch (err) {
    console.error('Error saat menghapus peran:', err);
    return res.status(500).json({ status: 'error', message: 'Gagal menghapus peran' });
  }
};

/**
 * Mencabut sesi perangkat staf secara instan (force logout / session revocation)
 * @route POST /api/users/:id/revoke-session
 */
export const revokeUserSession = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const { id } = req.params;

    // Pastikan user ada di tenant ini
    const targetUser = await prisma.user.findFirst({
      where: { id, tenantId },
      select: { id: true, name: true, role: true },
    });

    if (!targetUser) {
      return res.status(404).json({
        status: 'error',
        message: 'Pengguna tidak ditemukan dalam bisnis Anda',
      });
    }

    const requesterRole = (req.user?.role || '').toUpperCase();
    if (targetUser.role === 'OWNER' && !['OWNER', 'SUPERADMIN'].includes(requesterRole)) {
      return res.status(403).json({
        status: 'error',
        message: 'Hanya Pemilik Usaha (Owner) yang berhak mencabut sesi sesama Pemilik Usaha',
      });
    }

    await prisma.$transaction(async (tx) => {
      await userDualWriteService.revokeUserSession(tx, id, tenantId);
    });

    invalidateUserAuthCache(id);

    return res.status(200).json({
      status: 'success',
      message: `Sesi login perangkat untuk staf "${targetUser.name}" berhasil dicabut. Perangkat staf akan langsung logout pada permintaan berikutnya.`,
      data: {
        userId: targetUser.id,
        name: targetUser.name,
      },
    });
  } catch (error: any) {
    console.error('Error saat mencabut sesi pengguna:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mencabut sesi perangkat staf',
    });
  }
};

/**
 * Mencabut sesi seluruh perangkat staf/kasir di tenant secara massal (force logout massal)
 * @route POST /api/users/revoke-all-sessions
 */
export const revokeAllSessions = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    // Default: kecualikan sesi pemanggil saat ini agar owner/admin tidak ikut ter-logout secara mendadak
    const excludeCurrent = req.body?.excludeCurrent !== false;
    const currentUserId = req.user?.id;

    let affectedCount = 0;
    await prisma.$transaction(async (tx) => {
      affectedCount = await userDualWriteService.revokeAllSessions(
        tx,
        tenantId,
        excludeCurrent ? currentUserId : undefined
      );
    });

    invalidateUserAuthCache();

    return res.status(200).json({
      status: 'success',
      message: `Berhasil mencabut seluruh sesi perangkat kasir & staf (${affectedCount} staf terdampak). Seluruh kasir wajib memasukkan PIN ulang.`,
      data: {
        affectedCount,
        excludedCurrentUser: excludeCurrent ? currentUserId : null,
      },
    });
  } catch (error: any) {
    console.error('Error saat mencabut seluruh sesi pengguna:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mencabut seluruh sesi perangkat kasir',
    });
  }
};

