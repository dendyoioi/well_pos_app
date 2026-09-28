import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';

const createSupplierSchema = z.object({
  code: z.string().min(1, 'Kode supplier wajib diisi').max(50),
  name: z.string().min(1, 'Nama supplier wajib diisi').max(150),
  contactName: z.string().max(100).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email('Format email tidak valid').optional().nullable(),
  address: z.string().optional().nullable(),
  taxId: z.string().max(50).optional().nullable(),
  paymentTermsDays: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const updateSupplierSchema = createSupplierSchema.partial();

export const getSuppliers = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { search, isActive } = req.query;
    const where: any = { tenantId };

    if (isActive === 'true') {
      where.isActive = true;
    } else if (isActive === 'false') {
      where.isActive = false;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { purchaseOrders: true },
        },
      },
    });

    return res.status(200).json({ status: 'success', data: suppliers });
  } catch (error: any) {
    console.error('Error in getSuppliers:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil data supplier', error: error.message });
  }
};

export const getSupplierById = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { id } = req.params;
    const supplier = await prisma.supplier.findFirst({
      where: { id, tenantId },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!supplier) {
      return res.status(404).json({ status: 'error', message: 'Supplier tidak ditemukan' });
    }

    return res.status(200).json({ status: 'success', data: supplier });
  } catch (error: any) {
    console.error('Error in getSupplierById:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil detail supplier', error: error.message });
  }
};

export const createSupplier = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const validatedData = createSupplierSchema.parse(req.body);

    // Cek duplikasi kode supplier per tenant
    const existing = await prisma.supplier.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: validatedData.code,
        },
      },
    });

    if (existing) {
      return res.status(409).json({ status: 'error', message: `Kode supplier ${validatedData.code} sudah digunakan` });
    }

    const supplier = await prisma.supplier.create({
      data: {
        tenantId,
        code: validatedData.code,
        name: validatedData.name,
        contactName: validatedData.contactName,
        phone: validatedData.phone,
        email: validatedData.email,
        address: validatedData.address,
        taxId: validatedData.taxId,
        paymentTermsDays: validatedData.paymentTermsDays,
        isActive: validatedData.isActive,
      },
    });

    return res.status(201).json({ status: 'success', data: supplier });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: error.errors[0].message, errors: error.errors });
    }
    console.error('Error in createSupplier:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal membuat supplier', error: error.message });
  }
};

export const updateSupplier = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { id } = req.params;
    const validatedData = updateSupplierSchema.parse(req.body);

    const supplier = await prisma.supplier.findFirst({
      where: { id, tenantId },
    });

    if (!supplier) {
      return res.status(404).json({ status: 'error', message: 'Supplier tidak ditemukan' });
    }

    if (validatedData.code && validatedData.code !== supplier.code) {
      const existing = await prisma.supplier.findUnique({
        where: {
          tenantId_code: {
            tenantId,
            code: validatedData.code,
          },
        },
      });
      if (existing) {
        return res.status(409).json({ status: 'error', message: `Kode supplier ${validatedData.code} sudah digunakan` });
      }
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: validatedData,
    });

    return res.status(200).json({ status: 'success', data: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: error.errors[0].message, errors: error.errors });
    }
    console.error('Error in updateSupplier:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui supplier', error: error.message });
  }
};

export const deleteSupplier = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { id } = req.params;
    const supplier = await prisma.supplier.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { purchaseOrders: true },
        },
      },
    });

    if (!supplier) {
      return res.status(404).json({ status: 'error', message: 'Supplier tidak ditemukan' });
    }

    if (supplier._count.purchaseOrders > 0) {
      // Soft-delete if has linked POs
      const softDeleted = await prisma.supplier.update({
        where: { id },
        data: { isActive: false },
      });
      return res.status(200).json({
        status: 'success',
        message: 'Supplier dinonaktifkan karena memiliki riwayat purchase order',
        data: softDeleted,
      });
    }

    await prisma.supplier.delete({ where: { id } });
    return res.status(200).json({ status: 'success', message: 'Supplier berhasil dihapus' });
  } catch (error: any) {
    console.error('Error in deleteSupplier:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menghapus supplier', error: error.message });
  }
};
