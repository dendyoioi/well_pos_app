import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { purchasingService } from '../services/purchasing.service';
import { PurchaseOrderStatus } from '@prisma/client';

const createPOItemSchema = z.object({
  inventoryItemId: z.string().uuid('ID inventory item tidak valid'),
  quantityOrdered: z.number().positive('Jumlah pesanan harus > 0'),
  unitCost: z.number().min(0, 'Harga satuan tidak boleh negatif'),
  notes: z.string().optional(),
});

const createPOSchema = z.object({
  outletId: z.string().uuid('ID outlet tidak valid'),
  storageLocationId: z.string().uuid().optional(),
  supplierId: z.string().uuid('ID supplier tidak valid'),
  expectedDeliveryDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  notes: z.string().optional(),
  items: z.array(createPOItemSchema).min(1, 'PO harus memiliki minimal 1 item'),
});

const receivePOItemSchema = z.object({
  purchaseOrderItemId: z.string().uuid('ID purchase order item tidak valid'),
  quantityReceived: z.number().positive('Jumlah penerimaan harus > 0'),
  unitCost: z.number().min(0).optional(),
  batchNumber: z.string().optional(),
  expirationDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

const receivePOSchema = z.object({
  items: z.array(receivePOItemSchema).min(1, 'Harus ada minimal 1 item yang diterima'),
});

export const getPurchaseOrders = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { outletId, supplierId, status, page = '1', limit = '20' } = req.query;
    const where: any = { tenantId };

    if (outletId && typeof outletId === 'string') {
      where.outletId = outletId;
    }
    if (supplierId && typeof supplierId === 'string') {
      where.supplierId = supplierId;
    }
    if (status && typeof status === 'string' && Object.values(PurchaseOrderStatus).includes(status as any)) {
      where.status = status as PurchaseOrderStatus;
    }

    const take = parseInt(limit as string, 10) || 20;
    const skip = ((parseInt(page as string, 10) || 1) - 1) * take;

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true, code: true } },
          outlet: { select: { id: true, name: true, code: true } },
          storageLocation: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return res.status(200).json({
      status: 'success',
      data: orders,
      pagination: {
        total,
        page: parseInt(page as string, 10) || 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    console.error('Error in getPurchaseOrders:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil data Purchase Order', error: error.message });
  }
};

export const getPurchaseOrderById = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { id } = req.params;
    const po = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        outlet: true,
        storageLocation: true,
        createdByUser: { select: { id: true, name: true, userCode: true } },
        items: {
          include: {
            inventoryItem: true,
          },
        },
      },
    });

    if (!po) {
      return res.status(404).json({ status: 'error', message: 'Purchase Order tidak ditemukan' });
    }

    return res.status(200).json({ status: 'success', data: po });
  } catch (error: any) {
    console.error('Error in getPurchaseOrderById:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil detail Purchase Order', error: error.message });
  }
};

export const createPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const validatedData = createPOSchema.parse(req.body);

    const po = await purchasingService.createPurchaseOrder({
      tenantId,
      outletId: validatedData.outletId,
      storageLocationId: validatedData.storageLocationId,
      supplierId: validatedData.supplierId,
      expectedDeliveryDate: validatedData.expectedDeliveryDate ? new Date(validatedData.expectedDeliveryDate) : undefined,
      notes: validatedData.notes,
      createdByUserId: req.user?.id,
      items: validatedData.items,
    });

    return res.status(201).json({ status: 'success', data: po });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: error.errors[0].message, errors: error.errors });
    }
    console.error('Error in createPurchaseOrder:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal membuat Purchase Order' });
  }
};

export const issuePurchaseOrder = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { id } = req.params;
    const po = await purchasingService.issuePurchaseOrder(id, tenantId);

    return res.status(200).json({ status: 'success', message: 'Purchase Order berhasil di-issue', data: po });
  } catch (error: any) {
    console.error('Error in issuePurchaseOrder:', error);
    return res.status(400).json({ status: 'error', message: error.message || 'Gagal meng-issue Purchase Order' });
  }
};

export const receivePurchaseOrder = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { id } = req.params;
    const validatedData = receivePOSchema.parse(req.body);

    const po = await purchasingService.receivePurchaseOrder({
      purchaseOrderId: id,
      tenantId,
      actorUserId: req.user?.id,
      items: validatedData.items.map((i) => ({
        purchaseOrderItemId: i.purchaseOrderItemId,
        quantityReceived: i.quantityReceived,
        unitCost: i.unitCost,
        batchNumber: i.batchNumber,
        expirationDate: i.expirationDate ? new Date(i.expirationDate) : undefined,
      })),
    });

    return res.status(200).json({ status: 'success', message: 'Penerimaan barang berhasil diproses', data: po });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: error.errors[0].message, errors: error.errors });
    }
    console.error('Error in receivePurchaseOrder:', error);
    return res.status(400).json({ status: 'error', message: error.message || 'Gagal memproses penerimaan barang' });
  }
};

export const cancelPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { id } = req.params;

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });

    if (!po) {
      return res.status(404).json({ status: 'error', message: 'Purchase Order tidak ditemukan' });
    }

    if (po.status === PurchaseOrderStatus.RECEIVED || po.status === PurchaseOrderStatus.PARTIALLY_RECEIVED) {
      return res.status(400).json({
        status: 'error',
        message: 'Tidak dapat membatalkan PO yang sudah memiliki mutasi penerimaan barang',
      });
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.CANCELLED },
    });

    return res.status(200).json({ status: 'success', message: 'Purchase Order berhasil dibatalkan', data: updated });
  } catch (error: any) {
    console.error('Error in cancelPurchaseOrder:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal membatalkan Purchase Order', error: error.message });
  }
};
