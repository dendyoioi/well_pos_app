import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma, Role, OrderStatus } from '@prisma/client';
import { prisma } from '../config/prisma';

// ============================================================================
// A. CUSTOMER PREFERENCES & SECONDARY PHONES
// ============================================================================

const customerPreferencesSchema = z.object({
  laundryPreferences: z
    .object({
      allergies: z.array(z.string()).optional(),
      separateColors: z.boolean().optional(),
      preferFoldOrHang: z.enum(['FOLD', 'HANG', 'MIXED']).optional(),
      preferPerfume: z.string().nullable().optional(),
      avoidSoftener: z.boolean().optional(),
      alwaysExpress: z.boolean().optional(),
      customNotes: z.string().nullable().optional(),
    })
    .optional(),
  secondaryPhones: z.array(z.string()).max(3, 'Maksimal 3 nomor telepon sekunder').optional(),
});

export const getCustomerPreferences = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { customerId } = req.params;

    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId: user.tenantId,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        secondaryPhones: true,
        laundryPreferences: true,
      },
    });

    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'Pelanggan tidak ditemukan',
      });
    }

    return res.json({
      status: 'success',
      data: {
        customerId: customer.id,
        name: customer.name,
        phone: customer.phone,
        secondaryPhones: customer.secondaryPhones ?? [],
        laundryPreferences: customer.laundryPreferences ?? {},
      },
    });
  } catch (error: any) {
    console.error('Error in getCustomerPreferences:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil preferensi pelanggan: ' + error.message,
    });
  }
};

export const updateCustomerPreferences = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { customerId } = req.params;

    const parsed = customerPreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Data preferensi tidak valid',
        errors: parsed.error.errors,
      });
    }

    const { laundryPreferences, secondaryPhones } = parsed.data;

    const existingCustomer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId: user.tenantId,
      },
    });

    if (!existingCustomer) {
      return res.status(404).json({
        status: 'error',
        message: 'Pelanggan tidak ditemukan',
      });
    }

    const updateData: any = {};
    if (laundryPreferences !== undefined) {
      updateData.laundryPreferences = laundryPreferences;
    }
    if (secondaryPhones !== undefined) {
      updateData.secondaryPhones = secondaryPhones;
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        secondaryPhones: true,
        laundryPreferences: true,
      },
    });

    return res.json({
      status: 'success',
      message: 'Preferensi pelanggan berhasil diperbarui',
      data: {
        customerId: updated.id,
        name: updated.name,
        phone: updated.phone,
        secondaryPhones: updated.secondaryPhones ?? [],
        laundryPreferences: updated.laundryPreferences ?? {},
      },
    });
  } catch (error: any) {
    console.error('Error in updateCustomerPreferences:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui preferensi pelanggan: ' + error.message,
    });
  }
};

// ============================================================================
// B. BERAT AWAL VS BERAT FINAL & QC CHECKLIST
// ============================================================================

const updateWeightSchema = z.object({
  finalWeightKg: z.number().positive('Berat final harus lebih besar dari 0'),
  weightDiffReason: z.string().optional(),
  syncTotalWeight: z.boolean().optional().default(true),
});

export const updateOrderWeight = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { orderId } = req.params;

    const parsed = updateWeightSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Data berat tidak valid',
        errors: parsed.error.errors,
      });
    }

    const { finalWeightKg, weightDiffReason, syncTotalWeight } = parsed.data;

    const detailWhere: any = {
      orderId,
      tenantId: user.tenantId,
    };
    if (user.outletId && user.role !== Role.OWNER && user.role !== Role.ADMIN) {
      detailWhere.outletId = user.outletId;
    }

    const detail = await prisma.laundryOrderDetail.findFirst({
      where: detailWhere,
    });

    if (!detail) {
      return res.status(404).json({
        status: 'error',
        message: 'Detail order laundry tidak ditemukan',
      });
    }

    // Resolusi initial weight: jika belum ada, pakai totalWeightKg eksisting atau fallback ke finalWeightKg
    const initialWeight = Number(detail.initialWeightKg ?? detail.totalWeightKg ?? finalWeightKg);
    const weightDiffKg = Number((finalWeightKg - initialWeight).toFixed(3));

    const updated = await prisma.laundryOrderDetail.update({
      where: { id: detail.id },
      data: {
        finalWeightKg: new Prisma.Decimal(finalWeightKg),
        initialWeightKg: new Prisma.Decimal(initialWeight),
        weightDiffReason: weightDiffReason ?? detail.weightDiffReason,
        ...(syncTotalWeight ? { totalWeightKg: new Prisma.Decimal(finalWeightKg) } : {}),
      },
    });

    return res.json({
      status: 'success',
      message: 'Berat final pakaian berhasil dicatat',
      data: {
        orderId: detail.orderId,
        initialWeightKg: Number(updated.initialWeightKg),
        finalWeightKg: Number(updated.finalWeightKg),
        weightDiffKg,
        weightDiffReason: updated.weightDiffReason,
        totalWeightKg: Number(updated.totalWeightKg),
      },
    });
  } catch (error: any) {
    console.error('Error in updateOrderWeight:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui berat order: ' + error.message,
    });
  }
};

const updateQcSchema = z.object({
  qcStatus: z.enum(['PASSED', 'REWASH_REQUIRED']),
  qcChecklist: z.object({
    stainFree: z.boolean(),
    odorFresh: z.boolean(),
    ironedNeat: z.boolean(),
    pieceCountVerified: z.boolean(),
    verifiedPieces: z.number().optional(),
    notes: z.string().optional(),
  }),
  qcAfterPhotos: z.array(z.string()).optional(),
});

export const updateOrderQc = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { orderId } = req.params;

    const parsed = updateQcSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Data Quality Control tidak valid',
        errors: parsed.error.errors,
      });
    }

    const { qcStatus, qcChecklist, qcAfterPhotos } = parsed.data;

    const detailWhere: any = {
      orderId,
      tenantId: user.tenantId,
    };
    if (user.outletId && user.role !== Role.OWNER && user.role !== Role.ADMIN) {
      detailWhere.outletId = user.outletId;
    }

    const detail = await prisma.laundryOrderDetail.findFirst({
      where: detailWhere,
    });

    if (!detail) {
      return res.status(404).json({
        status: 'error',
        message: 'Detail order laundry tidak ditemukan',
      });
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Jika REWASH_REQUIRED: catat stage log & kembalikan status ke WASHING
      if (qcStatus === 'REWASH_REQUIRED') {
        await tx.laundryStageLog.create({
          data: {
            tenantId: user.tenantId,
            orderId: detail.orderId,
            laundryDetailId: detail.id,
            stage: 'WASHING',
            operatorId: user.id,
            operatorName: user.name || 'Staff QC',
            notes: `[QC_REWASH] ${qcChecklist.notes || 'Pencucian ulang dari hasil Quality Control'}`,
          },
        });

        const updatedDetail = await tx.laundryOrderDetail.update({
          where: { id: detail.id },
          data: {
            currentStage: 'WASHING',
            status: 'WASHING_DRYING',
            qcStatus: 'REWASH_REQUIRED',
            qcChecklist: qcChecklist as any,
            qcAfterPhotos: (qcAfterPhotos ?? []) as any,
            qcCheckedAt: now,
            qcCheckedById: user.id,
            qcCheckedByName: user.name || 'Staff QC',
          },
        });

        await tx.order.update({
          where: { id: detail.orderId },
          data: { orderStatus: OrderStatus.IN_PROGRESS },
        });

        return updatedDetail;
      }

      // 2. Jika PASSED: catat stage log QC Passed & simpan hasil checklist
      await tx.laundryStageLog.create({
        data: {
          tenantId: user.tenantId,
          orderId: detail.orderId,
          laundryDetailId: detail.id,
          stage: detail.currentStage,
          operatorId: user.id,
          operatorName: user.name || 'Staff QC',
          notes: `[QC_PASSED] ${qcChecklist.notes || 'Lolos Quality Control'}`,
        },
      });

      const updatedDetail = await tx.laundryOrderDetail.update({
        where: { id: detail.id },
        data: {
          qcStatus: 'PASSED',
          qcChecklist: qcChecklist as any,
          qcAfterPhotos: (qcAfterPhotos ?? []) as any,
          qcCheckedAt: now,
          qcCheckedById: user.id,
          qcCheckedByName: user.name || 'Staff QC',
        },
      });

      return updatedDetail;
    });

    return res.json({
      status: 'success',
      message:
        qcStatus === 'PASSED'
          ? 'Quality control berhasil: Lolos QC'
          : 'Quality control: Pakaian dikembalikan ke stasiun cuci (Rewash)',
      data: {
        orderId: result.orderId,
        qcStatus: result.qcStatus,
        qcChecklist: result.qcChecklist,
        qcCheckedAt: result.qcCheckedAt,
        qcCheckedByName: result.qcCheckedByName,
        currentStage: result.currentStage,
        status: result.status,
      },
    });
  } catch (error: any) {
    console.error('Error in updateOrderQc:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui QC order: ' + error.message,
    });
  }
};

// ============================================================================
// C. LOST & FOUND (BARANG TERTINGGAL / PAKAIAN TAK BERTUAN)
// ============================================================================

export const getLostAndFound = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { outletId, status, itemCategory, search } = req.query;

    const where: Prisma.LaundryLostAndFoundWhereInput = {
      tenantId: user.tenantId,
    };

    // Kunci outlet jika user memiliki outletId khusus (kasir/staf outlet)
    if (user.outletId && user.role !== Role.OWNER && user.role !== Role.ADMIN) {
      where.outletId = user.outletId;
    } else if (outletId && typeof outletId === 'string' && outletId !== 'ALL') {
      where.outletId = outletId;
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }

    if (itemCategory && typeof itemCategory === 'string' && itemCategory !== 'ALL') {
      where.itemCategory = itemCategory;
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { itemName: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { claimedByName: { contains: q, mode: 'insensitive' } },
        { storageLocation: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.laundryLostAndFound.findMany({
      where,
      include: {
        order: { select: { id: true, invoiceNumber: true } },
        customer: { select: { id: true, name: true, phone: true } },
        outlet: { select: { id: true, name: true, code: true } },
        foundBy: { select: { id: true, name: true } },
        returnedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.json({
      status: 'success',
      data: items,
    });
  } catch (error: any) {
    console.error('Error in getLostAndFound:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data Lost & Found: ' + error.message,
    });
  }
};

const createLostAndFoundSchema = z.object({
  outletId: z.string().min(1, 'Outlet ID wajib diisi'),
  orderId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  itemCategory: z.enum(['POCKET_ITEM', 'UNCLAIMED_GARMENT']).default('POCKET_ITEM'),
  itemName: z.string().min(1, 'Nama barang wajib diisi'),
  description: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  storageLocation: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const createLostAndFound = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const parsed = createLostAndFoundSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Data Lost & Found tidak valid',
        errors: parsed.error.errors,
      });
    }

    const {
      outletId,
      orderId,
      customerId,
      itemCategory,
      itemName,
      description,
      photoUrl,
      storageLocation,
      notes,
    } = parsed.data;

    // RBAC: Staf cabang hanya boleh mencatat untuk outlet tugasnya
    const isBranchStaff = user.outletId && user.role !== Role.OWNER && user.role !== Role.ADMIN;
    if (isBranchStaff && outletId !== user.outletId) {
      return res.status(403).json({
        status: 'error',
        message: 'Anda hanya memiliki izin mencatat Lost & Found untuk outlet tugas Anda',
      });
    }

    // Verifikasi outlet milik tenant
    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId: user.tenantId },
    });
    if (!outlet) {
      return res.status(404).json({
        status: 'error',
        message: 'Outlet tidak ditemukan atau bukan milik tenant',
      });
    }

    let finalCustomerId = customerId;
    if (orderId && !finalCustomerId) {
      const order = await prisma.order.findFirst({
        where: { id: orderId, tenantId: user.tenantId },
        select: { customerId: true },
      });
      if (order?.customerId) {
        finalCustomerId = order.customerId;
      }
    }

    const newItem = await prisma.laundryLostAndFound.create({
      data: {
        tenantId: user.tenantId,
        outletId,
        orderId: orderId || null,
        customerId: finalCustomerId || null,
        itemCategory,
        itemName,
        description: description || null,
        photoUrl: photoUrl || null,
        storageLocation: storageLocation || null,
        status: 'FOUND',
        foundById: user.id,
        foundByName: user.name || 'Staff',
        notes: notes || null,
      },
      include: {
        order: { select: { id: true, invoiceNumber: true } },
        customer: { select: { id: true, name: true, phone: true } },
        outlet: { select: { id: true, name: true, code: true } },
      },
    });

    return res.status(201).json({
      status: 'success',
      message: 'Barang tertinggal (Lost & Found) berhasil dicatat',
      data: newItem,
    });
  } catch (error: any) {
    console.error('Error in createLostAndFound:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal membuat catatan Lost & Found: ' + error.message,
    });
  }
};

const updateLostAndFoundSchema = z.object({
  status: z.enum(['FOUND', 'NOTIFIED', 'RETURNED', 'DISPOSED']).optional(),
  claimedByName: z.string().nullable().optional(),
  storageLocation: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const updateLostAndFound = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const parsed = updateLostAndFoundSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Data pembaruan Lost & Found tidak valid',
        errors: parsed.error.errors,
      });
    }

    const existingWhere: any = { id, tenantId: user.tenantId };
    if (user.outletId && user.role !== Role.OWNER && user.role !== Role.ADMIN) {
      existingWhere.outletId = user.outletId;
    }

    const existing = await prisma.laundryLostAndFound.findFirst({
      where: existingWhere,
    });

    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Barang Lost & Found tidak ditemukan',
      });
    }

    const { status, claimedByName, storageLocation, notes } = parsed.data;

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (claimedByName !== undefined) updateData.claimedByName = claimedByName;
    if (storageLocation !== undefined) updateData.storageLocation = storageLocation;
    if (notes !== undefined) updateData.notes = notes;

    if (status === 'RETURNED' && existing.status !== 'RETURNED') {
      updateData.returnedAt = new Date();
      updateData.returnedById = user.id;
      if (!claimedByName && existing.claimedByName) {
        updateData.claimedByName = existing.claimedByName;
      }
    }

    const updated = await prisma.laundryLostAndFound.update({
      where: { id },
      data: updateData,
      include: {
        order: { select: { id: true, invoiceNumber: true } },
        customer: { select: { id: true, name: true, phone: true } },
        outlet: { select: { id: true, name: true, code: true } },
        foundBy: { select: { id: true, name: true } },
        returnedBy: { select: { id: true, name: true } },
      },
    });

    return res.json({
      status: 'success',
      message: 'Status Lost & Found berhasil diperbarui',
      data: updated,
    });
  } catch (error: any) {
    console.error('Error in updateLostAndFound:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui Lost & Found: ' + error.message,
    });
  }
};

// ============================================================================
// D. OUTLET PRICING & PRICE HISTORY
// ============================================================================

export const getOutletServicesWithPricing = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { outletId } = req.query;

    if (!outletId || typeof outletId !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'Query parameter outletId wajib disertakan',
      });
    }

    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId: user.tenantId },
    });
    if (!outlet) {
      return res.status(404).json({
        status: 'error',
        message: 'Outlet tidak ditemukan atau bukan milik tenant',
      });
    }

    const [services, outletPrices] = await Promise.all([
      prisma.laundryService.findMany({
        where: { tenantId: user.tenantId },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
      prisma.laundryServiceOutletPrice.findMany({
        where: { tenantId: user.tenantId, outletId },
      }),
    ]);

    const priceMap = new Map<string, (typeof outletPrices)[0]>();
    for (const op of outletPrices) {
      priceMap.set(op.laundryServiceId, op);
    }

    const result = services.map((srv) => {
      const op = priceMap.get(srv.id);
      const basePrice = Number(srv.price);
      const priceOverride = op?.priceOverride != null ? Number(op.priceOverride) : null;
      const effectivePrice = priceOverride != null ? priceOverride : basePrice;

      const baseExpressMultiplier = Number(srv.expressMultiplier);
      const expressMultiplierOverride =
        op?.expressMultiplierOverride != null ? Number(op.expressMultiplierOverride) : null;
      const effectiveExpressMultiplier =
        expressMultiplierOverride != null ? expressMultiplierOverride : baseExpressMultiplier;

      const isAvailable = op != null ? op.isAvailable : srv.isActive;

      return {
        id: srv.id,
        name: srv.name,
        category: srv.category,
        unit: srv.unit,
        durationHours: srv.durationHours,
        minOrderQty: Number(srv.minOrderQty),
        basePrice,
        priceOverride,
        effectivePrice,
        baseExpressMultiplier,
        expressMultiplierOverride,
        effectiveExpressMultiplier,
        isMasterActive: srv.isActive,
        isAvailable,
      };
    });

    return res.json({
      status: 'success',
      data: {
        outletId,
        outletName: outlet.name,
        services: result,
      },
    });
  } catch (error: any) {
    console.error('Error in getOutletServicesWithPricing:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil harga layanan outlet: ' + error.message,
    });
  }
};

const updateOutletPriceSchema = z.object({
  outletId: z.string().min(1, 'Outlet ID wajib diisi'),
  priceOverride: z.number().nonnegative('Harga tidak boleh negatif').nullable(),
  expressMultiplierOverride: z.number().positive('Perkalian express harus lebih dari 0').nullable().optional(),
  isAvailable: z.boolean().optional(),
  reason: z.string().optional(),
});

export const setOutletServicePrice = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { serviceId } = req.params;

    const parsed = updateOutletPriceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Data penetapan harga outlet tidak valid',
        errors: parsed.error.errors,
      });
    }

    const { outletId, priceOverride, expressMultiplierOverride, isAvailable, reason } = parsed.data;

    // 1. Verifikasi Service & Outlet milik tenant
    const [service, outlet] = await Promise.all([
      prisma.laundryService.findFirst({
        where: { id: serviceId, tenantId: user.tenantId },
      }),
      prisma.outlet.findFirst({
        where: { id: outletId, tenantId: user.tenantId },
      }),
    ]);

    if (!service) {
      return res.status(404).json({
        status: 'error',
        message: 'Layanan laundry tidak ditemukan',
      });
    }

    if (!outlet) {
      return res.status(404).json({
        status: 'error',
        message: 'Outlet tidak ditemukan',
      });
    }

    const basePrice = Number(service.price);
    const newEffectivePrice = priceOverride != null ? priceOverride : basePrice;

    const result = await prisma.$transaction(async (tx) => {
      const existingOutletPrice = await tx.laundryServiceOutletPrice.findUnique({
        where: {
          outletId_laundryServiceId: {
            outletId,
            laundryServiceId: serviceId,
          },
        },
      });

      const oldEffectivePrice =
        existingOutletPrice?.priceOverride != null
          ? Number(existingOutletPrice.priceOverride)
          : basePrice;

      const updated = await tx.laundryServiceOutletPrice.upsert({
        where: {
          outletId_laundryServiceId: {
            outletId,
            laundryServiceId: serviceId,
          },
        },
        create: {
          tenantId: user.tenantId,
          outletId,
          laundryServiceId: serviceId,
          priceOverride: priceOverride != null ? new Prisma.Decimal(priceOverride) : null,
          expressMultiplierOverride:
            expressMultiplierOverride != null ? new Prisma.Decimal(expressMultiplierOverride) : null,
          isAvailable: isAvailable !== undefined ? isAvailable : true,
        },
        update: {
          priceOverride: priceOverride != null ? new Prisma.Decimal(priceOverride) : null,
          ...(expressMultiplierOverride !== undefined
            ? {
                expressMultiplierOverride:
                  expressMultiplierOverride != null
                    ? new Prisma.Decimal(expressMultiplierOverride)
                    : null,
              }
            : {}),
          ...(isAvailable !== undefined ? { isAvailable } : {}),
        },
      });

      // Catat price history jika effective price berubah
      if (newEffectivePrice !== oldEffectivePrice) {
        await tx.laundryServicePriceHistory.create({
          data: {
            tenantId: user.tenantId,
            laundryServiceId: serviceId,
            outletId,
            oldPrice: new Prisma.Decimal(oldEffectivePrice),
            newPrice: new Prisma.Decimal(newEffectivePrice),
            reason: reason || 'Pembaruan tarif khusus outlet',
            changedById: user.id,
            changedByName: user.name || 'Owner/Admin',
          },
        });
      }

      return {
        updated,
        oldEffectivePrice,
        newEffectivePrice,
      };
    });

    return res.json({
      status: 'success',
      message: 'Tarif layanan khusus outlet berhasil diperbarui',
      data: {
        serviceId,
        outletId,
        basePrice,
        oldEffectivePrice: result.oldEffectivePrice,
        newEffectivePrice: result.newEffectivePrice,
        priceOverride: result.updated.priceOverride != null ? Number(result.updated.priceOverride) : null,
        isAvailable: result.updated.isAvailable,
      },
    });
  } catch (error: any) {
    console.error('Error in setOutletServicePrice:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui tarif outlet: ' + error.message,
    });
  }
};

export const getServicePriceHistory = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { serviceId } = req.params;
    const { outletId } = req.query;

    const service = await prisma.laundryService.findFirst({
      where: { id: serviceId, tenantId: user.tenantId },
    });

    if (!service) {
      return res.status(404).json({
        status: 'error',
        message: 'Layanan laundry tidak ditemukan',
      });
    }

    const where: Prisma.LaundryServicePriceHistoryWhereInput = {
      tenantId: user.tenantId,
      laundryServiceId: serviceId,
    };

    if (outletId && typeof outletId === 'string' && outletId !== 'ALL') {
      where.outletId = outletId;
    }

    const histories = await prisma.laundryServicePriceHistory.findMany({
      where,
      include: {
        outlet: { select: { id: true, name: true, code: true } },
        changedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const formatted = histories.map((h) => ({
      id: h.id,
      serviceId: h.laundryServiceId,
      outletId: h.outletId,
      outletName: h.outlet ? h.outlet.name : 'Harga Master (Tenant)',
      oldPrice: Number(h.oldPrice),
      newPrice: Number(h.newPrice),
      reason: h.reason,
      changedById: h.changedById,
      changedByName: h.changedByName || (h.changedBy ? h.changedBy.name : 'System'),
      createdAt: h.createdAt,
    }));

    return res.json({
      status: 'success',
      data: formatted,
    });
  } catch (error: any) {
    console.error('Error in getServicePriceHistory:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil histori harga layanan: ' + error.message,
    });
  }
};
