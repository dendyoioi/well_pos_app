import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { stockTransferService } from '../services/stock_transfer.service';
import { StockTransferStatus } from '@prisma/client';

const createTransferItemSchema = z.object({
  inventoryItemId: z.string().uuid('ID inventory item tidak valid'),
  inventoryBatchId: z.string().uuid().optional(),
  quantityDispatched: z.number().positive('Jumlah barang yang dikirim harus > 0'),
  unitCost: z.number().min(0).optional(),
});

const createTransferSchema = z.object({
  sourceOutletId: z.string().uuid('ID outlet asal tidak valid'),
  sourceLocationId: z.string().uuid().optional(),
  targetOutletId: z.string().uuid('ID outlet tujuan tidak valid'),
  targetLocationId: z.string().uuid().optional(),
  notes: z.string().optional(),
  items: z.array(createTransferItemSchema).min(1, 'Transfer harus memiliki minimal 1 item'),
});

const receiveTransferItemSchema = z.object({
  transferItemId: z.string().uuid('ID transfer item tidak valid'),
  quantityReceived: z.number().min(0),
});

const receiveTransferSchema = z.object({
  items: z.array(receiveTransferItemSchema).optional(),
});

export const getTransfers = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { sourceOutletId, targetOutletId, status, page = '1', limit = '20' } = req.query;
    const where: any = { tenantId };

    if (sourceOutletId && typeof sourceOutletId === 'string') {
      where.sourceOutletId = sourceOutletId;
    }
    if (targetOutletId && typeof targetOutletId === 'string') {
      where.targetOutletId = targetOutletId;
    }
    if (status && typeof status === 'string' && Object.values(StockTransferStatus).includes(status as any)) {
      where.status = status as StockTransferStatus;
    }

    const take = parseInt(limit as string, 10) || 20;
    const skip = ((parseInt(page as string, 10) || 1) - 1) * take;

    const [transfers, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          sourceOutlet: { select: { id: true, name: true, code: true } },
          targetOutlet: { select: { id: true, name: true, code: true } },
          sourceLocation: { select: { id: true, name: true } },
          targetLocation: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.stockTransfer.count({ where }),
    ]);

    return res.status(200).json({
      status: 'success',
      data: transfers,
      pagination: {
        total,
        page: parseInt(page as string, 10) || 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    console.error('Error in getTransfers:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil data Stock Transfer', error: error.message });
  }
};

export const getTransferById = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { id } = req.params;
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id, tenantId },
      include: {
        sourceOutlet: true,
        targetOutlet: true,
        sourceLocation: true,
        targetLocation: true,
        dispatchedByUser: { select: { id: true, name: true, userCode: true } },
        receivedByUser: { select: { id: true, name: true, userCode: true } },
        items: {
          include: {
            inventoryItem: true,
            inventoryBatch: true,
          },
        },
      },
    });

    if (!transfer) {
      return res.status(404).json({ status: 'error', message: 'Stock Transfer tidak ditemukan' });
    }

    return res.status(200).json({ status: 'success', data: transfer });
  } catch (error: any) {
    console.error('Error in getTransferById:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil detail Stock Transfer', error: error.message });
  }
};

export const createTransfer = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const validatedData = createTransferSchema.parse(req.body);

    const transfer = await stockTransferService.createTransfer({
      tenantId,
      sourceOutletId: validatedData.sourceOutletId,
      sourceLocationId: validatedData.sourceLocationId,
      targetOutletId: validatedData.targetOutletId,
      targetLocationId: validatedData.targetLocationId,
      notes: validatedData.notes,
      createdByUserId: req.user?.id,
      items: validatedData.items,
    });

    return res.status(201).json({ status: 'success', data: transfer });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: error.errors[0].message, errors: error.errors });
    }
    console.error('Error in createTransfer:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal membuat Stock Transfer' });
  }
};

export const dispatchTransfer = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { id } = req.params;
    const transfer = await stockTransferService.dispatchTransfer(id, tenantId, req.user?.id);

    return res.status(200).json({
      status: 'success',
      message: 'Stock Transfer berhasil dikirim (IN_TRANSIT)',
      data: transfer,
    });
  } catch (error: any) {
    console.error('Error in dispatchTransfer:', error);
    return res.status(400).json({ status: 'error', message: error.message || 'Gagal mendispatch Stock Transfer' });
  }
};

export const receiveTransfer = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { id } = req.params;
    const validatedData = receiveTransferSchema.parse(req.body);

    const transfer = await stockTransferService.receiveTransfer({
      transferId: id,
      tenantId,
      actorUserId: req.user?.id,
      items: validatedData.items,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Stock Transfer berhasil diterima (RECEIVED)',
      data: transfer,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: error.errors[0].message, errors: error.errors });
    }
    console.error('Error in receiveTransfer:', error);
    return res.status(400).json({ status: 'error', message: error.message || 'Gagal menerima Stock Transfer' });
  }
};
