import { Request, Response } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';

// Skema Biaya Dinamis Outlet
const feeItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Nama biaya tidak boleh kosong'),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  rate: z.number().min(0, 'Nilai biaya tidak boleh negatif'),
  channelScope: z.enum(['ALL', 'DINE_IN', 'TAKEAWAY', 'GOFOOD', 'GRABFOOD', 'SHOPEEFOOD', 'DELIVERY']).default('ALL'),
  isActive: z.boolean().default(true),
});

const updateFeesSchema = z.object({
  feesConfig: z.array(feeItemSchema),
  supervisorPin: z.string().optional(),
});

const createOutletSchema = z.object({
  name: z.string().min(2, 'Nama cabang minimal 2 karakter'),
  address: z.string().optional(),
  phone: z.string().optional(),
  isWarehouse: z.boolean().optional(),
  feesConfig: z.array(feeItemSchema).optional(),
});

const updateOutletSchema = z.object({
  name: z.string().min(2, 'Nama cabang minimal 2 karakter').optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  isWarehouse: z.boolean().optional(),
  isActive: z.boolean().optional(),
  receiptConfig: z.object({
    paperSize: z.enum(['58mm', '80mm']).default('58mm'),
    footerText: z.string().optional(),
  }).optional(),
});

/**
 * Controller: Ambil Seluruh Cabang Toko (Tenant Outlets)
 * @route GET /api/outlets
 */
export const getOutlets = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const outlets = await prisma.outlet.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: {
            users: true,
            orders: true,
            outletProducts: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.status(200).json({
      status: 'success',
      data: outlets,
    });
  } catch (error) {
    console.error('Error saat mengambil daftar outlet:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat daftar outlet' });
  }
};

/**
 * Controller: Detail Cabang Spesifik
 * @route GET /api/outlets/:id
 */
export const getOutletById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;

    const outlet = await prisma.outlet.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!outlet) {
      return res.status(404).json({ status: 'error', message: 'Outlet tidak ditemukan' });
    }

    return res.status(200).json({
      status: 'success',
      data: outlet,
    });
  } catch (error) {
    console.error('Error saat mengambil detail outlet:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat detail outlet' });
  }
};

/**
 * Controller: Buat Cabang Baru (Owner Only - Berdasarkan Kuota Paket)
 * @route POST /api/outlets
 */
export const createOutlet = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userRole = req.user?.role;

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    if (userRole !== Role.ADMIN) {
      return res.status(403).json({
        status: 'error',
        message: 'Hanya pemilik usaha (Owner / Admin) yang dapat menambah cabang baru',
      });
    }

    const parseResult = createOutletSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Data cabang tidak valid',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { name, address, phone, isWarehouse, feesConfig } = parseResult.data;

    // Cek kuota outlet dari langganan aktif
    const activeSub = await prisma.tenantSubscription.findFirst({
      where: { tenantId, isActive: true },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    const maxOutlets = activeSub?.plan?.maxOutlets || 1;
    const currentOutletCount = await prisma.outlet.count({ where: { tenantId } });

    if (currentOutletCount >= maxOutlets) {
      return res.status(403).json({
        status: 'error',
        message: `Batas cabang untuk paket ${activeSub?.plan?.name || 'Anda'} telah tercapai (Maksimal ${maxOutlets} cabang). Silakan upgrade paket untuk menambah cabang.`,
      });
    }

    // Default Fees Config jika tidak disediakan
    const defaultFees = feesConfig || [
      {
        id: 'fee_tax',
        name: 'PPN / PB1 Pajak',
        type: 'PERCENTAGE',
        rate: 10,
        channelScope: 'ALL',
        isActive: true,
      },
      {
        id: 'fee_service',
        name: 'Biaya Layanan (Service Charge)',
        type: 'PERCENTAGE',
        rate: 5,
        channelScope: 'DINE_IN',
        isActive: true,
      },
      {
        id: 'fee_box',
        name: 'Biaya Kemasan Box / Takeaway',
        type: 'FIXED',
        rate: 2000,
        channelScope: 'TAKEAWAY',
        isActive: true,
      },
    ];

    const newOutlet = await prisma.$transaction(async (tx) => {
      const outlet = await tx.outlet.create({
        data: {
          tenantId,
          name,
          address: address || null,
          phone: phone || null,
          isWarehouse: isWarehouse ?? false,
          feesConfig: defaultFees,
          isActive: true,
        },
      });

      // Duplikasi master produk ke OutletProduct cabang baru (stok awal 0)
      const tenantProducts = await tx.product.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, basePrice: true },
      });

      if (tenantProducts.length > 0) {
        await tx.outletProduct.createMany({
          data: tenantProducts.map((p) => ({
            outletId: outlet.id,
            productId: p.id,
            stock: 0,
            price: p.basePrice,
            minStockAlert: 5,
          })),
        });
      }

      return outlet;
    });

    return res.status(201).json({
      status: 'success',
      message: `Cabang "${newOutlet.name}" berhasil dibuat`,
      data: newOutlet,
    });
  } catch (error) {
    console.error('Error saat membuat cabang baru:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal membuat cabang baru' });
  }
};

/**
 * Controller: Perbarui Informasi Cabang
 * @route PUT /api/outlets/:id
 */
export const updateOutlet = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;

    const parseResult = updateOutletSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Data update cabang tidak valid',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const updated = await prisma.outlet.update({
      where: { id },
      data: {
        ...parseResult.data,
      },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Informasi cabang berhasil diperbarui',
      data: updated,
    });
  } catch (error) {
    console.error('Error saat memperbarui outlet:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui outlet' });
  }
};

/**
 * Controller: Perbarui Konfigurasi Biaya Dinamis & Pajak (Bisa di-toggle oleh SPV / Admin)
 * @route PUT /api/outlets/:id/fees
 */
export const updateOutletFees = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;
    const userRole = req.user?.role;

    // Hanya ADMIN atau SUPERVISOR yang diizinkan mengubah biaya
    if (userRole !== Role.ADMIN && userRole !== Role.SUPERVISOR) {
      return res.status(403).json({
        status: 'error',
        message: 'Hanya Supervisor atau Owner yang memiliki hak akses mengelola biaya toko',
      });
    }

    const parseResult = updateFeesSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Format data biaya tidak valid',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { feesConfig, supervisorPin } = parseResult.data;

    // Jika diakses oleh kasir yang meminta otorisasi PIN Supervisor
    if (supervisorPin) {
      const spvUser = await prisma.user.findFirst({
        where: {
          tenantId: tenantId || undefined,
          pin: supervisorPin,
          role: { in: [Role.SUPERVISOR, Role.ADMIN] },
          isActive: true,
        },
      });

      if (!spvUser) {
        return res.status(401).json({
          status: 'error',
          message: 'PIN Supervisor tidak valid atau akun dinonaktifkan',
        });
      }
    }

    const updated = await prisma.outlet.update({
      where: { id },
      data: {
        feesConfig,
      },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Konfigurasi biaya & pajak berhasil diperbarui',
      data: updated.feesConfig,
    });
  } catch (error) {
    console.error('Error saat memperbarui biaya outlet:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui biaya outlet' });
  }
};
