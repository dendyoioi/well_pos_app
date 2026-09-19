import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';

const createUserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
  pin: z.string().length(6, 'PIN harus berupa 6 digit angka').regex(/^\d{6}$/, 'PIN harus berupa angka'),
  role: z.nativeEnum(Role, { message: 'Role tidak valid' }),
  outletId: z.string().uuid().optional().nullable(),
});

const updateUserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').optional(),
  email: z.string().email('Format email tidak valid').optional(),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter').optional().or(z.literal('')),
  pin: z.string().length(6, 'PIN harus berupa 6 digit angka').regex(/^\d{6}$/, 'PIN harus berupa angka').optional().nullable(),
  role: z.nativeEnum(Role, { message: 'Role tidak valid' }).optional(),
  isActive: z.boolean().optional(),
  outletId: z.string().uuid().optional().nullable(),
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
        name: true,
        email: true,
        role: true,
        pin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
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

    return res.status(200).json({
      status: 'success',
      data: users,
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

    const { name, email, password, pin, role, outletId } = parseResult.data;

    // Cek apakah email sudah digunakan
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'Email sudah terdaftar untuk pengguna lain',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Ambil default outlet tenant jika tidak disediakan
    let assignedOutletId = outletId;
    if (!assignedOutletId) {
      const defaultOutlet = await prisma.outlet.findFirst({
        where: { tenantId, isWarehouse: false },
      });
      assignedOutletId = defaultOutlet?.id || null;
    }

    const newUser = await prisma.user.create({
      data: {
        tenantId,
        name,
        email,
        passwordHash,
        pin,
        role,
        outletId: assignedOutletId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        pin: true,
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

    const user = await prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'Pengguna tidak ditemukan dalam bisnis Anda',
      });
    }

    const { name, email, password, pin, role, isActive, outletId } = parseResult.data;

    // Jika email diubah, pastikan tidak duplikat
    if (email && email !== user.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email },
      });
      if (emailTaken) {
        return res.status(400).json({
          status: 'error',
          message: 'Email sudah digunakan pengguna lain',
        });
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (pin !== undefined) updateData.pin = pin;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (outletId !== undefined) updateData.outletId = outletId;

    if (password && password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password, salt);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        pin: true,
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
