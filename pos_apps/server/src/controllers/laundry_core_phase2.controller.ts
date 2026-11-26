import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma, Role, OrderStatus } from '@prisma/client';
import { prisma } from '../config/prisma';

// ============================================================================
// A. LAUNDRY BATCH MANAGEMENT
// ============================================================================

const createBatchSchema = z.object({
  outletId: z.string().uuid('ID outlet tidak valid'),
  stage: z.enum(['WASHING', 'DRYING']),
  machineId: z.string().optional().nullable(),
  colorGroup: z.enum(['PUTIH', 'WARNA', 'GELAP', 'CAMPUR', 'DELICATE']).optional().nullable(),
  orderIds: z.array(z.string().uuid()).min(1, 'Minimal 1 pesanan dalam batch'),
  notes: z.string().max(1000).optional().nullable(),
  autoStart: z.boolean().optional().default(false),
});

const updateBatchStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  notes: z.string().max(1000).optional().nullable(),
});

export const getBatches = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPrivileged = user.role === Role.OWNER || user.role === Role.ADMIN;
    let targetOutletId = (req.query.outletId as string) || undefined;
    if (!isPrivileged && user.outletId) {
      targetOutletId = user.outletId;
    }

    const batches = await prisma.laundryBatch.findMany({
      where: {
        tenantId: user.tenantId,
        ...(targetOutletId ? { outletId: targetOutletId } : {}),
        ...(req.query.status ? { status: req.query.status as string } : {}),
        ...(req.query.stage ? { stage: req.query.stage as string } : {}),
      },
      include: {
        machine: {
          select: {
            id: true,
            code: true,
            name: true,
            capacityKg: true,
            status: true,
            machineType: true,
          },
        },
        items: {
          include: {
            order: {
              select: {
                id: true,
                invoiceNumber: true,
                orderStatus: true,
                totalAmount: true,
                customer: { select: { id: true, name: true, phone: true } },
                laundryDetail: {
                  select: {
                    currentStage: true,
                    estimatedReadyAt: true,
                    status: true,
                    totalWeightKg: true,
                    totalPieces: true,
                  },
                },
              },
            },
          },
        },
        operator: { select: { id: true, name: true, email: true } },
        outlet: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100)),
    });

    return res.json({
      status: 'success',
      data: batches,
    });
  } catch (error: any) {
    console.error('Error in getBatches:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil daftar batch laundry' });
  }
};

export const createBatch = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPrivileged = user.role === Role.OWNER || user.role === Role.ADMIN;

    const parseResult = createBatchSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { outletId, stage, machineId, colorGroup, orderIds, notes, autoStart } = parseResult.data;

    if (!isPrivileged && user.outletId && outletId !== user.outletId) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Anda hanya dapat membuat batch untuk outlet yang Anda kelola',
      });
    }

    // Validasi semua orderIds ada di tenant & outlet yang sama
    const orders = await prisma.order.findMany({
      where: {
        id: { in: orderIds },
        tenantId: user.tenantId,
        outletId,
      },
      include: { laundryDetail: true },
    });

    if (orders.length !== orderIds.length) {
      return res.status(400).json({
        status: 'error',
        message: 'Sebagian pesanan tidak ditemukan atau tidak berada di outlet ini',
      });
    }

    // Validasi mesin jika dispesifikasikan
    let machine: any = null;
    if (machineId) {
      machine = await prisma.laundryMachine.findFirst({
        where: { id: machineId, tenantId: user.tenantId, outletId },
      });
      if (!machine) {
        return res.status(404).json({
          status: 'error',
          message: 'Mesin laundry tidak ditemukan pada outlet ini',
        });
      }
      if (machine.status === 'MAINTENANCE') {
        return res.status(400).json({
          status: 'error',
          message: 'Mesin sedang dalam pemeliharaan (MAINTENANCE) dan tidak dapat digunakan',
        });
      }
    }

    // Hitung total berat akumulatif
    const totalWeight = orders.reduce(
      (sum, o) => sum + Number(o.laundryDetail?.totalWeightKg || 0),
      0
    );

    // Generate batchCode unik (BCH-YYMMDD-XXX)
    const todayPrefix = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const todayCount = await prisma.laundryBatch.count({
      where: {
        tenantId: user.tenantId,
        batchCode: { startsWith: `BCH-${todayPrefix}` },
      },
    });
    const batchCode = `BCH-${todayPrefix}-${String(todayCount + 1).padStart(3, '0')}`;

    // Eksekusi atomik dalam Prisma Transaction
    const batch = await prisma.$transaction(async (tx) => {
      const createdBatch = await tx.laundryBatch.create({
        data: {
          tenantId: user.tenantId,
          outletId,
          batchCode,
          stage,
          machineId: machine?.id || null,
          machineName: machine?.name || null,
          colorGroup: colorGroup || null,
          totalWeightKg: new Prisma.Decimal(totalWeight),
          status: autoStart ? 'IN_PROGRESS' : 'OPEN',
          operatorId: autoStart ? user.id : null,
          operatorName: autoStart ? (user.name || 'Operator Workshop') : null,
          startedAt: autoStart ? new Date() : null,
          notes: notes?.trim() || null,
          items: {
            create: orders.map((o) => ({
              tenantId: user.tenantId,
              orderId: o.id,
              weightKg: o.laundryDetail?.totalWeightKg || new Prisma.Decimal(0),
            })),
          },
        },
        include: {
          items: {
            include: {
              order: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  totalAmount: true,
                  laundryDetail: true,
                },
              },
            },
          },
          machine: true,
        },
      });

      if (autoStart) {
        for (const order of orders) {
          if (order.laundryDetail) {
            await tx.laundryOrderDetail.update({
              where: { id: order.laundryDetail.id },
              data: {
                currentStage: stage,
                status: 'WASHING_DRYING',
              },
            });

            await tx.laundryStageLog.create({
              data: {
                tenantId: user.tenantId,
                orderId: order.id,
                laundryDetailId: order.laundryDetail.id,
                stage: stage === 'WASHING' ? 'WASHING' : 'DRYING',
                operatorId: user.id,
                operatorName: user.name || 'Operator Workshop',
                machineId: machine?.id || null,
                machineName: machine?.name || null,
                weightKg: order.laundryDetail.totalWeightKg,
                piecesCount: order.laundryDetail.totalPieces,
                notes: `[BATCH ${batchCode}] ${notes || ''}`.trim(),
                startedAt: new Date(),
              },
            });
          }
        }
      }

      return createdBatch;
    });

    return res.status(201).json({
      status: 'success',
      data: batch,
      message: `Batch ${batchCode} berhasil dibuat (${orders.length} pesanan, ${totalWeight} kg)`,
    });
  } catch (error: any) {
    console.error('Error in createBatch:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal membuat batch laundry' });
  }
};

export const updateBatchStatus = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPrivileged = user.role === Role.OWNER || user.role === Role.ADMIN;
    const { batchId } = req.params;

    const parseResult = updateBatchStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi status gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { status, notes } = parseResult.data;

    const batch = await prisma.laundryBatch.findFirst({
      where: { id: batchId, tenantId: user.tenantId },
      include: {
        items: {
          include: {
            order: {
              include: { laundryDetail: true },
            },
          },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({ status: 'error', message: 'Batch laundry tidak ditemukan' });
    }

    if (!isPrivileged && user.outletId && batch.outletId !== user.outletId) {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak ke outlet batch ini' });
    }

    if (batch.status === 'COMPLETED') {
      return res.status(400).json({ status: 'error', message: 'Batch sudah selesai dan tidak dapat diubah lagi' });
    }

    if (status === 'IN_PROGRESS' && batch.status !== 'OPEN') {
      return res.status(400).json({ status: 'error', message: `Batch berstatus ${batch.status} tidak dapat dimulai` });
    }

    if (status === 'COMPLETED' && batch.status !== 'IN_PROGRESS') {
      return res.status(400).json({ status: 'error', message: 'Hanya batch yang sedang berjalan (IN_PROGRESS) yang dapat diselesaikan' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();

      if (status === 'IN_PROGRESS') {
        const updatedBatch = await tx.laundryBatch.update({
          where: { id: batch.id },
          data: {
            status: 'IN_PROGRESS',
            startedAt: now,
            operatorId: user.id,
            operatorName: user.name || 'Operator Workshop',
            notes: notes !== undefined ? notes : batch.notes,
          },
        });

        for (const item of batch.items) {
          const detail = item.order.laundryDetail;
          if (detail) {
            await tx.laundryOrderDetail.update({
              where: { id: detail.id },
              data: {
                currentStage: batch.stage,
                status: 'WASHING_DRYING',
              },
            });

            await tx.laundryStageLog.create({
              data: {
                tenantId: user.tenantId,
                orderId: item.order.id,
                laundryDetailId: detail.id,
                stage: batch.stage === 'WASHING' ? 'WASHING' : 'DRYING',
                operatorId: user.id,
                operatorName: user.name || 'Operator Workshop',
                machineId: batch.machineId || null,
                machineName: batch.machineName || null,
                weightKg: item.weightKg,
                piecesCount: detail.totalPieces,
                notes: `[BATCH ${batch.batchCode}] ${notes || ''}`.trim(),
                startedAt: now,
              },
            });
          }
        }

        return updatedBatch;
      }

      if (status === 'COMPLETED') {
        const updatedBatch = await tx.laundryBatch.update({
          where: { id: batch.id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            notes: notes !== undefined ? notes : batch.notes,
          },
        });

        // Tentukan stage selanjutnya secara logis
        // WASHING -> DRYING (tetap WASHING_DRYING)
        // DRYING -> IRONING (masuk status IRONING_PACKING)
        const nextStage = batch.stage === 'WASHING' ? 'DRYING' : 'IRONING';
        const nextStatus = batch.stage === 'WASHING' ? 'WASHING_DRYING' : 'IRONING_PACKING';

        for (const item of batch.items) {
          const detail = item.order.laundryDetail;
          if (detail) {
            await tx.laundryOrderDetail.update({
              where: { id: detail.id },
              data: {
                currentStage: nextStage,
                status: nextStatus,
              },
            });

            // Selesaikan log stage yang terbuka dengan penanda batch ini
            const openLog = await tx.laundryStageLog.findFirst({
              where: {
                orderId: item.order.id,
                stage: batch.stage === 'WASHING' ? 'WASHING' : 'DRYING',
                completedAt: null,
                notes: { contains: `[BATCH ${batch.batchCode}]` },
              },
              orderBy: { startedAt: 'desc' },
            });

            if (openLog) {
              const startT = openLog.startedAt.getTime();
              const durationMinutes = Math.max(1, Math.round((now.getTime() - startT) / 60000));
              await tx.laundryStageLog.update({
                where: { id: openLog.id },
                data: {
                  completedAt: now,
                  durationMinutes,
                },
              });
            }
          }
        }

        return updatedBatch;
      }

      // Status CANCELLED
      return await tx.laundryBatch.update({
        where: { id: batch.id },
        data: {
          status: 'CANCELLED',
          notes: notes !== undefined ? notes : batch.notes,
        },
      });
    });

    return res.json({
      status: 'success',
      data: updated,
      message: `Status batch ${batch.batchCode} berhasil diperbarui menjadi ${status}`,
    });
  } catch (error: any) {
    console.error('Error in updateBatchStatus:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui status batch' });
  }
};

// ============================================================================
// B. ITEM-LEVEL TRACKING & QR/BARCODE SCAN
// ============================================================================

const createOrderItemsSchema = z.object({
  items: z
    .array(
      z.object({
        garmentName: z.string().min(1, 'Nama pakaian wajib diisi').max(150),
        category: z.enum(['ATASAN', 'BAWAHAN', 'JAS_GAUN', 'BEDDING', 'SEPATU_TAS', 'LAINNYA']).optional().nullable(),
        color: z.string().max(50).optional().nullable(),
        brand: z.string().max(50).optional().nullable(),
        specialTreatment: z.string().max(255).optional().nullable(),
        photoUrl: z.string().url().optional().nullable().or(z.literal('')),
        notes: z.string().max(500).optional().nullable(),
      })
    )
    .min(1, 'Minimal 1 item pakaian'),
});

const updateItemSchema = z.object({
  currentStage: z
    .enum(['TAGGED', 'WASHING', 'DRYING', 'IRONING', 'PACKED', 'READY', 'HANDED_OVER'])
    .optional(),
  rackCode: z.string().max(50).optional().nullable(),
  specialTreatment: z.string().max(255).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const getOrderItems = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPrivileged = user.role === Role.OWNER || user.role === Role.ADMIN;
    const { orderId } = req.params;

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId: user.tenantId },
      select: { id: true, outletId: true, invoiceNumber: true },
    });

    if (!order) {
      return res.status(404).json({ status: 'error', message: 'Pesanan tidak ditemukan' });
    }

    if (!isPrivileged && user.outletId && order.outletId !== user.outletId) {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak ke outlet pesanan ini' });
    }

    const items = await prisma.laundryOrderItemTrack.findMany({
      where: { orderId: order.id, tenantId: user.tenantId },
      include: {
        handedOverBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalItems = items.length;
    const readyCount = items.filter((i) => i.currentStage === 'READY').length;
    const handedOverCount = items.filter((i) => i.currentStage === 'HANDED_OVER').length;
    const inProgressCount = totalItems - readyCount - handedOverCount;

    return res.json({
      status: 'success',
      data: {
        items,
        summary: {
          totalItems,
          readyCount,
          handedOverCount,
          inProgressCount,
        },
      },
    });
  } catch (error: any) {
    console.error('Error in getOrderItems:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil daftar item pakaian' });
  }
};

export const createOrderItems = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPrivileged = user.role === Role.OWNER || user.role === Role.ADMIN;
    const { orderId } = req.params;

    const parseResult = createOrderItemsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi item gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId: user.tenantId },
      select: { id: true, outletId: true, invoiceNumber: true },
    });

    if (!order) {
      return res.status(404).json({ status: 'error', message: 'Pesanan tidak ditemukan' });
    }

    if (!isPrivileged && user.outletId && order.outletId !== user.outletId) {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak ke outlet pesanan ini' });
    }

    const existingCount = await prisma.laundryOrderItemTrack.count({
      where: { orderId: order.id, tenantId: user.tenantId },
    });

    const invClean = order.invoiceNumber.replace(/[^A-Za-z0-9]/g, '').slice(-6);

    const createdItems = await prisma.$transaction(async (tx) => {
      const results = [];
      for (let i = 0; i < parseResult.data.items.length; i++) {
        const item = parseResult.data.items[i];
        const seq = String(existingCount + i + 1).padStart(2, '0');
        let tagCode = `TAG-${invClean}-${seq}`;

        // Cek jika tagCode bentrok di level tenant
        const conflict = await tx.laundryOrderItemTrack.findFirst({
          where: { tenantId: user.tenantId, tagCode },
        });
        if (conflict) {
          const rand = Math.random().toString(36).substring(2, 4).toUpperCase();
          tagCode = `TAG-${invClean}-${seq}${rand}`;
        }

        const created = await tx.laundryOrderItemTrack.create({
          data: {
            tenantId: user.tenantId,
            outletId: order.outletId,
            orderId: order.id,
            tagCode,
            garmentName: item.garmentName.trim(),
            category: item.category || null,
            color: item.color?.trim() || null,
            brand: item.brand?.trim() || null,
            specialTreatment: item.specialTreatment?.trim() || null,
            photoUrl: item.photoUrl || null,
            notes: item.notes?.trim() || null,
            currentStage: 'TAGGED',
          },
        });
        results.push(created);
      }
      return results;
    });

    return res.status(201).json({
      status: 'success',
      data: createdItems,
      message: `${createdItems.length} item pakaian berhasil didaftarkan dengan kode tag QR`,
    });
  } catch (error: any) {
    console.error('Error in createOrderItems:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menambahkan item pakaian' });
  }
};

export const scanItemByTag = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPrivileged = user.role === Role.OWNER || user.role === Role.ADMIN;
    const { tagCode } = req.params;

    if (!tagCode || !tagCode.trim()) {
      return res.status(400).json({ status: 'error', message: 'Kode tag tidak valid' });
    }

    const item = await prisma.laundryOrderItemTrack.findFirst({
      where: {
        tenantId: user.tenantId,
        tagCode: { equals: tagCode.trim(), mode: 'insensitive' },
      },
      include: {
        order: {
          select: {
            id: true,
            invoiceNumber: true,
            orderStatus: true,
            paymentStatus: true,
            totalAmount: true,
            customer: { select: { id: true, name: true, phone: true } },
            laundryDetail: {
              select: {
                currentStage: true,
                status: true,
                estimatedReadyAt: true,
                rackCode: true,
                totalPieces: true,
              },
            },
          },
        },
        outlet: { select: { id: true, name: true } },
        handedOverBy: { select: { id: true, name: true } },
      },
    });

    if (!item) {
      return res.status(404).json({
        status: 'error',
        message: `Item pakaian dengan tag "${tagCode.trim()}" tidak ditemukan`,
      });
    }

    if (!isPrivileged && user.outletId && item.outletId !== user.outletId) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Pakaian ini terdaftar di cabang lain',
      });
    }

    return res.json({
      status: 'success',
      data: item,
    });
  } catch (error: any) {
    console.error('Error in scanItemByTag:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memindai tag pakaian' });
  }
};

export const updateItem = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPrivileged = user.role === Role.OWNER || user.role === Role.ADMIN;
    const { itemId } = req.params;

    const parseResult = updateItemSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi perbaruan item gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const item = await prisma.laundryOrderItemTrack.findFirst({
      where: { id: itemId, tenantId: user.tenantId },
    });

    if (!item) {
      return res.status(404).json({ status: 'error', message: 'Item pakaian tidak ditemukan' });
    }

    if (!isPrivileged && user.outletId && item.outletId !== user.outletId) {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak ke outlet item ini' });
    }

    const { currentStage, rackCode, specialTreatment, notes } = parseResult.data;

    const updated = await prisma.laundryOrderItemTrack.update({
      where: { id: item.id },
      data: {
        ...(currentStage !== undefined ? { currentStage } : {}),
        ...(rackCode !== undefined ? { rackCode: rackCode?.trim() || null } : {}),
        ...(specialTreatment !== undefined ? { specialTreatment: specialTreatment?.trim() || null } : {}),
        ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      },
    });

    return res.json({
      status: 'success',
      data: updated,
      message: 'Data item pakaian berhasil diperbarui',
    });
  } catch (error: any) {
    console.error('Error in updateItem:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui item pakaian' });
  }
};

// ============================================================================
// C. SPLIT ORDER & PARTIAL HANDOVER
// ============================================================================

const partialHandoverSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1, 'Minimal 1 item pakaian untuk diserahkan'),
  receivedByName: z.string().min(1, 'Nama penerima wajib diisi').max(150),
  notes: z.string().max(500).optional().nullable(),
});

export const partialHandover = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPrivileged = user.role === Role.OWNER || user.role === Role.ADMIN;
    const { orderId } = req.params;

    const parseResult = partialHandoverSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi serah terima gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { itemIds, receivedByName, notes } = parseResult.data;

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId: user.tenantId },
      include: { laundryDetail: true },
    });

    if (!order) {
      return res.status(404).json({ status: 'error', message: 'Pesanan tidak ditemukan' });
    }

    const detail = order.laundryDetail;
    if (!detail) {
      return res.status(400).json({ status: 'error', message: 'Detail pesanan laundry tidak ditemukan' });
    }

    if (!isPrivileged && user.outletId && order.outletId !== user.outletId) {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak ke outlet pesanan ini' });
    }

    // Ambil seluruh tracked items milik order ini
    const allTracks = await prisma.laundryOrderItemTrack.findMany({
      where: { orderId: order.id, tenantId: user.tenantId },
    });

    if (allTracks.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Pesanan ini belum memiliki rincian item pakaian yang terdaftar (Item-Level Tracking). Daftarkan item terlebih dahulu sebelum serah terima bertahap.',
      });
    }

    // Validasi apakah itemIds valid dan belum diserahkan
    const targetTracks = allTracks.filter((t) => itemIds.includes(t.id));
    if (targetTracks.length !== itemIds.length) {
      return res.status(400).json({
        status: 'error',
        message: 'Sebagian item pakaian tidak ditemukan pada nota pesanan ini',
      });
    }

    const alreadyHandedOver = targetTracks.filter((t) => t.currentStage === 'HANDED_OVER');
    if (alreadyHandedOver.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Item "${alreadyHandedOver[0].garmentName}" (${alreadyHandedOver[0].tagCode}) sudah pernah diserahkan sebelumnya`,
      });
    }

    const previouslyHandedOver = allTracks.filter((t) => t.currentStage === 'HANDED_OVER').length;
    const totalTrackedItems = allTracks.length;
    const isFullyHandedOver = previouslyHandedOver + itemIds.length >= totalTrackedItems;

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Update seluruh item yang dipilih menjadi HANDED_OVER
      await tx.laundryOrderItemTrack.updateMany({
        where: {
          id: { in: itemIds },
          orderId: order.id,
          tenantId: user.tenantId,
        },
        data: {
          currentStage: 'HANDED_OVER',
          handedOverAt: now,
          handedOverById: user.id,
          handedOverByName: user.name || 'Staf Kasir',
          receivedByName: receivedByName.trim(),
        },
      });

      // Catat log stage audit
      await tx.laundryStageLog.create({
        data: {
          tenantId: user.tenantId,
          orderId: order.id,
          laundryDetailId: detail.id,
          stage: 'HANDOVER',
          operatorId: user.id,
          operatorName: user.name || 'Staf Kasir',
          notes: `[${isFullyHandedOver ? 'FINAL_HANDOVER' : 'PARTIAL_HANDOVER'}] ${itemIds.length} item diserahkan ke "${receivedByName.trim()}". ${notes || ''}`.trim(),
          startedAt: now,
          completedAt: now,
          durationMinutes: 0,
        },
      });

      // Jika seluruh item telah tuntas diserahkan, otomatis selesaikan order induk
      if (isFullyHandedOver) {
        await tx.laundryOrderDetail.update({
          where: { id: detail.id },
          data: {
            currentStage: 'HANDOVER',
            status: 'COMPLETED',
            pickedUpAt: now,
            pickedUpBy: receivedByName.trim(),
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: {
            orderStatus: OrderStatus.COMPLETED,
          },
        });
      }

      return {
        orderId: order.id,
        handedOverNow: itemIds.length,
        totalHandedOver: previouslyHandedOver + itemIds.length,
        totalItems: totalTrackedItems,
        isFullyHandedOver,
      };
    });

    return res.json({
      status: 'success',
      data: result,
      message: isFullyHandedOver
        ? `Seluruh pakaian (${result.totalHandedOver}/${result.totalItems}) telah diserahkan. Pesanan #${order.invoiceNumber} otomatis SELESAI.`
        : `Serah terima sebagian berhasil: ${result.handedOverNow} potong diserahkan (${result.totalHandedOver}/${result.totalItems} tuntas).`,
    });
  } catch (error: any) {
    console.error('Error in partialHandover:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memproses serah terima sebagian' });
  }
};

// ============================================================================
// D. SMART PRODUCTION QUEUE (AUTO-PRIORITIZATION SLA & EXPRESS)
// ============================================================================

export const getProductionQueue = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPrivileged = user.role === Role.OWNER || user.role === Role.ADMIN;
    let targetOutletId = (req.query.outletId as string) || undefined;
    if (!isPrivileged && user.outletId) {
      targetOutletId = user.outletId;
    }

    const orders = await prisma.order.findMany({
      where: {
        tenantId: user.tenantId,
        ...(targetOutletId ? { outletId: targetOutletId } : {}),
        orderStatus: { notIn: [OrderStatus.CANCELLED, OrderStatus.VOIDED, OrderStatus.COMPLETED] },
        laundryDetail: {
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          ...(req.query.stage ? { currentStage: req.query.stage as string } : {}),
        },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        laundryDetail: true,
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
            pricingBasis: true,
          },
        },
        laundryOrderItemTracks: {
          select: { id: true, currentStage: true, tagCode: true },
        },
        laundryBatchItems: {
          include: {
            batch: {
              select: {
                id: true,
                batchCode: true,
                stage: true,
                status: true,
                machineName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    const now = new Date();

    const scoredOrders = orders.map((o) => {
      const detail = o.laundryDetail;
      const estimatedReadyAt = detail?.estimatedReadyAt ? new Date(detail.estimatedReadyAt) : null;
      const isExpress =
        o.items.some(
          (i) => i.productName?.toUpperCase().includes('EXPRESS') || i.pricingBasis === 'EXPRESS'
        ) || (detail?.currentStage?.includes('EXPRESS') ?? false);

      let priorityTier: 'CRITICAL' | 'URGENT' | 'HIGH' | 'NORMAL' = 'NORMAL';
      let priorityScore = 0;
      let minutesLeft = 999999;
      let isOverdue = false;

      if (estimatedReadyAt) {
        minutesLeft = Math.round((estimatedReadyAt.getTime() - now.getTime()) / (1000 * 60));
        isOverdue = minutesLeft < 0;
      }

      if (isOverdue) {
        priorityTier = 'CRITICAL';
        priorityScore = 1000 + Math.abs(minutesLeft);
      } else if (minutesLeft <= 240 || isExpress) {
        priorityTier = 'URGENT';
        priorityScore = 500 + Math.max(0, 240 - minutesLeft) + (isExpress ? 150 : 0);
      } else if (minutesLeft <= 720) {
        priorityTier = 'HIGH';
        priorityScore = 200 + Math.max(0, 720 - minutesLeft);
      } else {
        priorityTier = 'NORMAL';
        priorityScore = Math.max(1, 100 - Math.floor(minutesLeft / 60));
      }

      // Info batch aktif
      const activeBatchItem = o.laundryBatchItems.find(
        (bi) => bi.batch.status === 'IN_PROGRESS' || bi.batch.status === 'OPEN'
      );

      // Ringkasan item-level tracking
      const tracks = o.laundryOrderItemTracks;
      const trackedItemsSummary = {
        total: tracks.length,
        ready: tracks.filter((t) => t.currentStage === 'READY').length,
        handedOver: tracks.filter((t) => t.currentStage === 'HANDED_OVER').length,
        inProgress: tracks.filter(
          (t) => t.currentStage !== 'READY' && t.currentStage !== 'HANDED_OVER'
        ).length,
      };

      return {
        id: o.id,
        invoiceNumber: o.invoiceNumber,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        totalAmount: Number(o.totalAmount),
        createdAt: o.createdAt,
        customer: o.customer,
        currentStage: detail?.currentStage || 'DROP_OFF',
        status: detail?.status || 'RECEIVED',
        totalWeightKg: detail?.totalWeightKg ? Number(detail.totalWeightKg) : null,
        totalPieces: detail?.totalPieces || 0,
        rackCode: detail?.rackCode || null,
        estimatedReadyAt: detail?.estimatedReadyAt || null,
        minutesLeft,
        isOverdue,
        isExpress,
        priorityTier,
        priorityScore,
        activeBatch: activeBatchItem
          ? {
              batchId: activeBatchItem.batch.id,
              batchCode: activeBatchItem.batch.batchCode,
              stage: activeBatchItem.batch.stage,
              status: activeBatchItem.batch.status,
              machineName: activeBatchItem.batch.machineName,
            }
          : null,
        trackedItemsSummary,
      };
    });

    // Urutkan prioritas: Score DESC, lalu CreatedAt ASC
    scoredOrders.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const totalActiveOrders = scoredOrders.length;
    const overdueCount = scoredOrders.filter((o) => o.priorityTier === 'CRITICAL').length;
    const urgentCount = scoredOrders.filter((o) => o.priorityTier === 'URGENT').length;
    const totalPendingWeightKg =
      Math.round(
        scoredOrders.reduce((sum, o) => sum + (o.totalWeightKg || 0), 0) * 1000
      ) / 1000;
    const uniqueActiveBatchIds = new Set(
      scoredOrders.filter((o) => o.activeBatch).map((o) => o.activeBatch!.batchId)
    );

    return res.json({
      status: 'success',
      data: scoredOrders,
      summary: {
        totalActiveOrders,
        overdueCount,
        urgentCount,
        totalPendingWeightKg,
        activeBatchesCount: uniqueActiveBatchIds.size,
      },
    });
  } catch (error: any) {
    console.error('Error in getProductionQueue:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil antrean produksi laundry' });
  }
};
