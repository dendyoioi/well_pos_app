import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { userDualWriteService } from '../services/dual_write';

function mapToSystemRole(roleInput?: string): Role {
  if (!roleInput) return Role.CASHIER;
  const upper = roleInput.toUpperCase();
  // Direct enum match (OWNER, ADMIN, CASHIER, SUPERVISOR, KITCHEN, WAREHOUSE, WAITER)
  if (Object.values(Role).includes(upper as Role)) {
    return upper as Role;
  }
  // Semantic fallbacks
  if (upper.includes('SUPERVISOR') || upper.includes('MANAGER')) return Role.SUPERVISOR;
  if (upper.includes('KITCHEN') || upper.includes('BARISTA') || upper.includes('COOK')) return Role.KITCHEN;
  if (upper.includes('WAITER') || upper.includes('PELAYAN')) return Role.WAITER;
  if (upper.includes('GUDANG') || upper.includes('WAREHOUSE')) return Role.WAREHOUSE;
  if (upper.includes('ADMIN') || upper.includes('OWNER')) return Role.ADMIN;
  return Role.CASHIER;
}

const createUserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter').optional(),
  userCode: z.string().min(3).max(10).optional(),
  pin: z.string().min(4, 'PIN minimal 4 digit').max(6, 'PIN maksimal 6 digit').regex(/^\d{4,6}$/, 'PIN harus berupa angka'),
  role: z.string().default('CASHIER'),
  outletId: z.string().uuid().optional().nullable(),
  canCashOut: z.boolean().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').optional(),
  email: z.string().email('Format email tidak valid').optional(),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter').optional().or(z.literal('')),
  userCode: z.string().min(3).max(10).optional(),
  pin: z.string().min(4).max(6).regex(/^\d{4,6}$/, 'PIN harus berupa angka').optional().nullable(),
  role: z.string().optional(),
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
        canCashOut: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        pinHash: true,
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

    // Sanitize: jangan expose hash sensitif ke client
    const sanitized = users.map(({ pinHash, passwordHash, ...u }) => ({
      ...u,
      hasPin: pinHash !== null,
      hasPassword: passwordHash !== null,
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

    const { name, email, password, userCode, pin, role, outletId } = parseResult.data;
    const systemRole = mapToSystemRole(role);

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
          role: systemRole,
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
        canCashOut: true,
        isActive: true,
        createdAt: true,
        outlet: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const newUser = {
      ...userDb,
      pin: result.legacyData.pin,
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

    const { name, email, password, pin, role, isActive, outletId } = parseResult.data;

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

    // Tentukan role yang akan disimpan — jaga agar OWNER tidak bisa di-downgrade via form biasa
    let targetRole: Role | undefined = undefined;
    if (role) {
      const mappedRole = mapToSystemRole(role);
      // Jika user saat ini OWNER, pertahankan role OWNER (tidak boleh diubah dari form staf)
      if (currentRole === Role.OWNER) {
        targetRole = Role.OWNER;
      } else {
        targetRole = mappedRole;
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
          role: targetRole,
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
        name: true,
        email: true,
        role: true,
        canCashOut: true,
        isActive: true,
        updatedAt: true,
        outlet: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const updatedUser = {
      ...userDb,
      pin: pin !== undefined ? (pin || null) : null,
    };

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

    // Jika user sudah memiliki riwayat transaksi/shift, lakukan soft-delete (isActive: false)
    if (user._count.orders > 0 || user._count.shifts > 0) {
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
      return res.status(200).json({
        status: 'success',
        message: 'Akun staf telah dinonaktifkan (arsip tersimpan untuk audit)',
      });
    }

    // Jika belum ada riwayat, bisa dihapus permanen
    await prisma.user.delete({
      where: { id },
    });

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
import { roleService, DEFAULT_FNB_ROLES, RolePermissions, SYSTEM_PERMISSIONS } from '../services/role.service';

/**
 * Mendapatkan daftar master izin sistem fungsional
 * @route GET /api/users/roles/permissions
 */
export const getSystemPermissions = async (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'success',
    data: SYSTEM_PERMISSIONS,
  });
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

    const allRoles = roleService.getTenantRoles(tenantId);

    // Hitung staff count per role
    const users = await prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: { role: true },
    });

    const rolesWithCounts = allRoles.map((r) => {
      let count = 0;
      if (r.id === 'role-owner') count = users.filter((u) => u.role === 'ADMIN' || (u.role as any) === 'OWNER').length;
      else if (r.id === 'role-supervisor') count = users.filter((u) => u.role === 'SUPERVISOR').length;
      else if (r.id === 'role-cashier') count = users.filter((u) => u.role === 'CASHIER').length;
      else if (r.id === 'role-barista') count = users.filter((u) => u.role === 'KITCHEN' || (u.role as any) === 'BARISTA').length;
      else if (r.id === 'role-warehouse') count = users.filter((u) => u.role === 'WAREHOUSE').length;
      else if (r.id === 'role-waiter') count = users.filter((u) => u.role === 'WAITER').length;
      else count = 0;

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
      status: status !== undefined ? Boolean(status) : existing.status,
      permissions: Array.isArray(permissions) ? permissions : existing.permissions,
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

    await prisma.$transaction(async (tx) => {
      await userDualWriteService.revokeUserSession(tx, id, tenantId);
    });

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

