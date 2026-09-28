import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { promotionService } from '../services/promotion.service';
import { DiscountType } from '@prisma/client';

const createPromotionSchema = z.object({
  code: z.string().min(1, 'Kode promo wajib diisi').max(50).transform((val) => val.trim().toUpperCase()),
  name: z.string().min(1, 'Nama promo wajib diisi').max(150),
  description: z.string().optional().nullable(),
  discountType: z.nativeEnum(DiscountType),
  discountValue: z.number().positive('Nilai diskon harus > 0'),
  minOrderAmount: z.number().min(0).default(0),
  maxDiscountAmount: z.number().positive().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  perCustomerLimit: z.number().int().positive().default(1),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  isActive: z.boolean().default(true),
});

const updatePromotionSchema = createPromotionSchema.partial();

const validatePromotionSchema = z.object({
  code: z.string().min(1, 'Kode promo wajib diisi'),
  subtotal: z.number().min(0, 'Subtotal tidak boleh negatif'),
  customerId: z.string().uuid().optional().nullable(),
});

export const getPromotions = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { isActive, search, page = '1', limit = '20' } = req.query;
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
      ];
    }

    const take = parseInt(limit as string, 10) || 20;
    const skip = ((parseInt(page as string, 10) || 1) - 1) * take;

    const [promotions, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { usages: true },
          },
        },
      }),
      prisma.promotion.count({ where }),
    ]);

    return res.status(200).json({
      status: 'success',
      data: promotions,
      pagination: {
        total,
        page: parseInt(page as string, 10) || 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    console.error('Error in getPromotions:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil data promosi', error: error.message });
  }
};

export const getPromotionById = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { id } = req.params;
    const promotion = await prisma.promotion.findFirst({
      where: { id, tenantId },
      include: {
        usages: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            order: { select: { id: true, invoiceNumber: true, totalAmount: true } },
          },
        },
        _count: { select: { usages: true } },
      },
    });

    if (!promotion) {
      return res.status(404).json({ status: 'error', message: 'Promosi tidak ditemukan' });
    }

    return res.status(200).json({ status: 'success', data: promotion });
  } catch (error: any) {
    console.error('Error in getPromotionById:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil detail promosi', error: error.message });
  }
};

export const createPromotion = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const validatedData = createPromotionSchema.parse(req.body);

    const existing = await prisma.promotion.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: validatedData.code,
        },
      },
    });

    if (existing) {
      return res.status(409).json({ status: 'error', message: `Kode promo "${validatedData.code}" sudah digunakan` });
    }

    const promotion = await prisma.promotion.create({
      data: {
        tenantId,
        code: validatedData.code,
        name: validatedData.name,
        description: validatedData.description,
        discountType: validatedData.discountType,
        discountValue: validatedData.discountValue,
        minOrderAmount: validatedData.minOrderAmount,
        maxDiscountAmount: validatedData.maxDiscountAmount,
        usageLimit: validatedData.usageLimit,
        perCustomerLimit: validatedData.perCustomerLimit,
        startDate: new Date(validatedData.startDate),
        endDate: new Date(validatedData.endDate),
        isActive: validatedData.isActive,
      },
    });

    return res.status(201).json({ status: 'success', data: promotion });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: error.errors[0].message, errors: error.errors });
    }
    console.error('Error in createPromotion:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal membuat promo', error: error.message });
  }
};

export const updatePromotion = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { id } = req.params;
    const validatedData = updatePromotionSchema.parse(req.body);

    const promotion = await prisma.promotion.findFirst({
      where: { id, tenantId },
    });

    if (!promotion) {
      return res.status(404).json({ status: 'error', message: 'Promosi tidak ditemukan' });
    }

    if (validatedData.code && validatedData.code !== promotion.code) {
      const existing = await prisma.promotion.findUnique({
        where: {
          tenantId_code: {
            tenantId,
            code: validatedData.code,
          },
        },
      });
      if (existing) {
        return res.status(409).json({ status: 'error', message: `Kode promo "${validatedData.code}" sudah digunakan` });
      }
    }

    const updated = await prisma.promotion.update({
      where: { id },
      data: {
        ...validatedData,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : undefined,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : undefined,
      },
    });

    return res.status(200).json({ status: 'success', data: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: error.errors[0].message, errors: error.errors });
    }
    console.error('Error in updatePromotion:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui promo', error: error.message });
  }
};

export const deletePromotion = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { id } = req.params;
    const promotion = await prisma.promotion.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { usages: true } },
      },
    });

    if (!promotion) {
      return res.status(404).json({ status: 'error', message: 'Promosi tidak ditemukan' });
    }

    if (promotion._count.usages > 0) {
      const softDeleted = await prisma.promotion.update({
        where: { id },
        data: { isActive: false },
      });
      return res.status(200).json({
        status: 'success',
        message: 'Promo dinonaktifkan karena sudah memiliki riwayat penggunaan',
        data: softDeleted,
      });
    }

    await prisma.promotion.delete({ where: { id } });
    return res.status(200).json({ status: 'success', message: 'Promo berhasil dihapus' });
  } catch (error: any) {
    console.error('Error in deletePromotion:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menghapus promo', error: error.message });
  }
};

export const validatePromotion = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { code, subtotal, customerId } = validatePromotionSchema.parse(req.body);

    const result = await promotionService.validatePromotion(tenantId, code, subtotal, customerId);

    if (!result.valid) {
      return res.status(400).json({ status: 'error', message: result.message, discountAmount: 0 });
    }

    return res.status(200).json({
      status: 'success',
      message: `Promo "${result.promotion.name}" valid`,
      data: {
        promotionId: result.promotion.id,
        code: result.promotion.code,
        name: result.promotion.name,
        discountType: result.promotion.discountType,
        discountValue: Number(result.promotion.discountValue),
        discountAmount: result.discountAmount,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: error.errors[0].message, errors: error.errors });
    }
    console.error('Error in validatePromotion:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memvalidasi promo', error: error.message });
  }
};
