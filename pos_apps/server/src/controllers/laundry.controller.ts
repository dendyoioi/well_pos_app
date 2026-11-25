import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { PaymentStatus, OrderStatus, PaymentMethod, PaymentTxStatus, ShiftStatus, Role, Prisma } from '@prisma/client';
import { whatsAppService, LaundryNotificationData } from '../services/whatsapp.service';
import { idempotencyService } from '../services/idempotency.service';
import { storageService } from '../services/storage.service';
import { promotionService } from '../services/promotion.service';
import { loyaltyService } from '../services/loyalty.service';

// ==========================================
// 1. SCHEMAS
// ==========================================

const createLaundryServiceSchema = z.object({
  name: z.string().min(2, 'Nama layanan minimal 2 karakter'),
  category: z.string().min(1, 'Kategori layanan wajib diisi').default('KILOAN'),
  unit: z.string().default('KG'),
  price: z.number().min(0, 'Tarif tidak boleh negatif'),
  minOrderQty: z.number().min(0).default(1.00),
  durationHours: z.number().int().min(1).default(48),
  expressMultiplier: z.number().min(1.00).default(1.00),
  description: z.string().optional(),
  stages: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

const updateLaundryServiceSchema = createLaundryServiceSchema.partial();

const createLaundryRackSchema = z.object({
  outletId: z.string().uuid('ID Outlet tidak valid'),
  code: z.string().min(2, 'Kode rak minimal 2 karakter'),
  name: z.string().min(2, 'Nama rak minimal 2 karakter'),
  category: z.enum(['KILOAN', 'SATUAN', 'EXPRESS', 'SEPATU_TAS']).default('KILOAN'),
  capacity: z.number().int().min(1).default(10),
  locationNote: z.string().optional(),
});

const createLaundryOrderSchema = z.object({
  outletId: z.string().uuid('ID Outlet tidak valid'),
  customerId: z.string().uuid().optional().nullable(),
  customerName: z.string().min(2, 'Nama pelanggan wajib diisi'),
  customerPhone: z.string().optional().nullable(),
  customerAddress: z.string().optional().nullable(),
  deliveryType: z.enum(['NONE', 'PICKUP_ONLY', 'DELIVERY_ONLY', 'PICKUP_AND_DELIVERY', 'SELF_PICKUP', 'DELIVERY']).optional().default('NONE'),
  deliveryDistanceKm: z.number().min(0).optional().default(0),
  deliveryFeePerKm: z.number().min(0).optional().default(0),
  deliveryFee: z.number().min(0).optional().default(0),
  deliveryZoneName: z.string().optional().nullable(),
  deliveryAddress: z.string().optional().nullable(),
  deliveryNotes: z.string().optional().nullable(),
  deliveryScheduledAt: z.union([z.string(), z.date()]).optional().nullable(),
  courierName: z.string().optional().nullable(),
  courierPhone: z.string().optional().nullable(),
  items: z.array(
    z.object({
      serviceId: z.string().optional(),
      laundryServiceId: z.string().optional(),
      name: z.string().min(1),
      category: z.string().optional().default('KILOAN'),
      quantity: z.number().min(0.01, 'Kuantitas/bobot minimal 0.01'),
      unit: z.string().default('KG'),
      unitPrice: z.number().min(0),
      perfumeVariant: z.string().optional(),
      notes: z.string().optional(),
      addons: z.array(
        z.object({
          id: z.string().optional(),
          name: z.string(),
          price: z.number().min(0),
          unit: z.string().default('FLAT'),
          total: z.number().min(0).optional(),
        })
      ).optional(),
    })
  ).min(1, 'Minimal sertakan 1 layanan cucian'),
  totalPieces: z.number().int().min(0).default(0),
  perfumeVariant: z.string().optional().default('Lavender'),
  estimatedReadyHours: z.number().int().default(48),
  depositAmount: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  manualDiscountAmount: z.number().min(0).optional().default(0),
  promotionId: z.string().uuid().optional().nullable(),
  promoCode: z.string().optional().nullable(),
  pointsToRedeem: z.number().int().min(0).optional().default(0),
  paymentMethod: z.enum(['CASH', 'QRIS', 'TRANSFER', 'UNPAID', 'CUSTOMER_DEPOSIT', 'LAUNDRY_QUOTA']).default('UNPAID'),
  customerNotes: z.string().optional(),
});

const updateLaundryStatusSchema = z.object({
  status: z.enum(['RECEIVED', 'WASHING_DRYING', 'IRONING_PACKING', 'READY_FOR_PICKUP', 'COMPLETED']),
  rackCode: z.string().optional().nullable(),
  pickedUpBy: z.string().optional().nullable(),
  paymentMethod: z.enum(['CASH', 'QRIS', 'TRANSFER']).optional().default('CASH'),
});

// ==========================================
// 2. LAUNDRY SERVICES CONTROLLER
// ==========================================

export const getLaundryServices = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    let services = await prisma.laundryService.findMany({
      where: { tenantId },
      include: {
        bomItems: {
          include: {
            inventoryItem: {
              select: {
                averageCost: true,
              },
            },
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { category: 'asc' }, { name: 'asc' }],
    });

    // Auto-seed paket katalog awal layanan jika masih kosong
    if (services.length === 0) {
      const sampleServices = [
        { name: 'Cuci Kering Setrika (Reguler)', category: 'KILOAN', unit: 'KG', price: new Prisma.Decimal(8000), minOrderQty: new Prisma.Decimal(3), durationHours: 48, expressMultiplier: new Prisma.Decimal(1.0), description: 'Cuci bersih, pengeringan mesin, setrika uap rapi, dan parfum wangi tahan lama.' },
        { name: 'Cuci Kering Lipat (Non-Setrika)', category: 'KILOAN', unit: 'KG', price: new Prisma.Decimal(6000), minOrderQty: new Prisma.Decimal(3), durationHours: 48, expressMultiplier: new Prisma.Decimal(1.0), description: 'Cuci bersih dan pengeringan tumbler hangat, dilipat rapi tanpa setrika.' },
        { name: 'Setrika Saja (Steam Boiler)', category: 'KILOAN', unit: 'KG', price: new Prisma.Decimal(5000), minOrderQty: new Prisma.Decimal(3), durationHours: 24, expressMultiplier: new Prisma.Decimal(1.0), description: 'Penyetrikaan uap boiler profesional dan semprot parfum.' },
        { name: 'Cuci Setrika Express (24 Jam)', category: 'KILOAN', unit: 'KG', price: new Prisma.Decimal(12000), minOrderQty: new Prisma.Decimal(2), durationHours: 24, expressMultiplier: new Prisma.Decimal(1.0), description: 'Layanan kilat 1 hari selesai untuk kebutuhan mendesak.' },
        { name: 'Bed Cover King / Jumbo', category: 'SATUAN', unit: 'PCS', price: new Prisma.Decimal(35000), minOrderQty: new Prisma.Decimal(1), durationHours: 48, expressMultiplier: new Prisma.Decimal(1.0), description: 'Pencucian khusus selimut tebal bed cover ukuran 180x200 atau 200x200.' },
        { name: 'Bed Cover Single', category: 'SATUAN', unit: 'PCS', price: new Prisma.Decimal(25000), minOrderQty: new Prisma.Decimal(1), durationHours: 48, expressMultiplier: new Prisma.Decimal(1.0), description: 'Pencucian bed cover ukuran single 120x200.' },
        { name: 'Jas / Blazer Formal (Dry Clean)', category: 'DRY_CLEAN', unit: 'PCS', price: new Prisma.Decimal(30000), minOrderQty: new Prisma.Decimal(1), durationHours: 72, expressMultiplier: new Prisma.Decimal(1.0), description: 'Pembersihan kimia kering (dry clean) menjaga serat jas tetap presisi.' },
        { name: 'Gamis / Gaun Pesta', category: 'DRY_CLEAN', unit: 'PCS', price: new Prisma.Decimal(35000), minOrderQty: new Prisma.Decimal(1), durationHours: 72, expressMultiplier: new Prisma.Decimal(1.0), description: 'Perawatan khusus busana berpayet, brokat, dan sutra halus.' },
        { name: 'Deep Clean Sepatu Sneakers', category: 'TREATMENT', unit: 'PCS', price: new Prisma.Decimal(30000), minOrderQty: new Prisma.Decimal(1), durationHours: 48, expressMultiplier: new Prisma.Decimal(1.0), description: 'Pencucian menyeluruh sol luar, midsole, tali, dan upper sneakers.' },
        { name: 'Cuci Helm Full Face', category: 'TREATMENT', unit: 'PCS', price: new Prisma.Decimal(25000), minOrderQty: new Prisma.Decimal(1), durationHours: 24, expressMultiplier: new Prisma.Decimal(1.0), description: 'Pembersihan busa helm, anti-bakteri, dan pengharum segar.' },
      ];

      for (const item of sampleServices) {
        await prisma.laundryService.create({
          data: {
            ...item,
            tenantId,
          },
        });
      }

      services = await prisma.laundryService.findMany({
        where: { tenantId },
        include: {
          bomItems: {
            include: {
              inventoryItem: {
                select: {
                  averageCost: true,
                },
              },
            },
          },
        },
        orderBy: [{ isActive: 'desc' }, { category: 'asc' }, { name: 'asc' }],
      });
    }

    // Auto-seed paket Layanan Tambahan (Add-on Treatment) jika belum ada
    const hasAddons = services.some((s) => s.category === 'ADDON');
    if (!hasAddons) {
      const defaultAddons = [
        { name: 'Hilangkan Noda Membandel (Spotting)', category: 'ADDON', unit: 'FLAT', price: new Prisma.Decimal(10000), minOrderQty: new Prisma.Decimal(1), durationHours: 0, expressMultiplier: new Prisma.Decimal(1.0), description: 'Treatment cairan khusus untuk noda darah, getah, tinta, karat, atau jamur.' },
        { name: 'Parfum Sultan Premium (Grade A)', category: 'ADDON', unit: 'PER_KG', price: new Prisma.Decimal(2500), minOrderQty: new Prisma.Decimal(1), durationHours: 0, expressMultiplier: new Prisma.Decimal(1.0), description: 'Parfum konsentrat mewah wangi tahan lama hingga 14 hari.' },
        { name: 'Anti-Bakteri & Sanitasi Higienis', category: 'ADDON', unit: 'PER_KG', price: new Prisma.Decimal(2000), minOrderQty: new Prisma.Decimal(1), durationHours: 0, expressMultiplier: new Prisma.Decimal(1.0), description: 'Sanitasi disinfektan higienis membunuh 99.9% kuman dan tungau pakaian.' },
        { name: 'Hanger Jas & Plastik Pelindung', category: 'ADDON', unit: 'FLAT', price: new Prisma.Decimal(3500), minOrderQty: new Prisma.Decimal(1), durationHours: 0, expressMultiplier: new Prisma.Decimal(1.0), description: 'Gantungan baju kokoh dan kantong plastik pelindung debu.' },
      ];
      for (const item of defaultAddons) {
        await prisma.laundryService.create({
          data: {
            ...item,
            tenantId,
          },
        });
      }
      services = await prisma.laundryService.findMany({
        where: { tenantId },
        include: {
          bomItems: {
            include: {
              inventoryItem: {
                select: {
                  averageCost: true,
                },
              },
            },
          },
        },
        orderBy: [{ isActive: 'desc' }, { category: 'asc' }, { name: 'asc' }],
      });
    }

    const outletId = (req.query.outletId as string) || (req.user?.outletId as string);
    let outletPricesMap = new Map<string, any>();
    if (outletId && outletId !== 'ALL') {
      const outletPrices = await prisma.laundryServiceOutletPrice.findMany({
        where: { tenantId, outletId },
      });
      for (const op of outletPrices) {
        outletPricesMap.set(op.laundryServiceId, op);
      }
    }

    const formattedServices = services.map((s: any) => {
      const bomItemsCount = s.bomItems?.length || 0;
      const estimatedBomCost = (s.bomItems || []).reduce((acc: number, item: any) => {
        return acc + Math.round(Number(item.quantityPerUnit) * Number(item.inventoryItem?.averageCost || 0));
      }, 0);

      const op = outletPricesMap.get(s.id);
      const basePrice = Number(s.price);
      const priceOverride = op?.priceOverride != null ? Number(op.priceOverride) : null;
      const effectivePrice = priceOverride != null ? priceOverride : basePrice;

      const baseExpressMultiplier = Number(s.expressMultiplier);
      const expressMultiplierOverride =
        op?.expressMultiplierOverride != null ? Number(op.expressMultiplierOverride) : null;
      const effectiveExpressMultiplier =
        expressMultiplierOverride != null ? expressMultiplierOverride : baseExpressMultiplier;

      const isAvailableAtOutlet = op != null ? op.isAvailable : s.isActive;

      return {
        ...s,
        basePrice,
        priceOverride,
        effectivePrice,
        price: effectivePrice,
        baseExpressMultiplier,
        expressMultiplierOverride,
        effectiveExpressMultiplier,
        isAvailableAtOutlet,
        bomItemsCount,
        estimatedBomCost,
      };
    });

    return res.status(200).json({
      status: 'success',
      data: formattedServices,
    });
  } catch (error: any) {
    console.error('Error getLaundryServices:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil daftar layanan laundry' });
  }
};

export const createLaundryService = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const role = (req.user?.role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(role)) {
      return res.status(403).json({ status: 'error', message: 'Hanya Owner, Admin, atau Supervisor yang dapat membuat layanan laundry' });
    }

    const parseResult = createLaundryServiceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi form layanan laundry gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const service = await prisma.laundryService.create({
      data: {
        tenantId,
        ...parseResult.data,
      },
    });

    return res.status(201).json({
      status: 'success',
      message: 'Layanan laundry berhasil dibuat',
      data: service,
    });
  } catch (error: any) {
    console.error('Error createLaundryService:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal membuat layanan laundry baru' });
  }
};

export const updateLaundryService = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const role = (req.user?.role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(role)) {
      return res.status(403).json({ status: 'error', message: 'Hanya Owner, Admin, atau Supervisor yang dapat mengubah layanan laundry' });
    }

    const existing = await prisma.laundryService.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Layanan laundry tidak ditemukan' });
    }

    const parseResult = updateLaundryServiceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi pembaruan layanan laundry gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const updated = await prisma.laundryService.update({
      where: { id },
      data: parseResult.data,
    });

    if (parseResult.data.price !== undefined && Number(parseResult.data.price) !== Number(existing.price)) {
      try {
        await prisma.laundryServicePriceHistory.create({
          data: {
            tenantId,
            laundryServiceId: id,
            outletId: null, // Perubahan master price
            oldPrice: existing.price,
            newPrice: new Prisma.Decimal(parseResult.data.price),
            reason: (req.body.reason as string) || 'Pembaruan tarif master laundry',
            changedById: req.user?.id || null,
            changedByName: req.user?.name || 'Owner/Admin',
          },
        });
      } catch (errPriceHist) {
        console.error('Gagal mencatat history harga master:', errPriceHist);
      }
    }

    return res.status(200).json({
      status: 'success',
      message: 'Layanan laundry berhasil diperbarui',
      data: updated,
    });
  } catch (error: any) {
    console.error('Error updateLaundryService:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui layanan laundry' });
  }
};

export const deleteLaundryService = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const role = (req.user?.role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(role)) {
      return res.status(403).json({ status: 'error', message: 'Hanya Owner, Admin, atau Supervisor yang dapat menghapus layanan laundry' });
    }

    const existing = await prisma.laundryService.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Layanan laundry tidak ditemukan' });
    }

    // Soft-delete atau non-aktifkan agar riwayat nota lama tidak broken
    await prisma.laundryService.update({
      where: { id },
      data: { isActive: false },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Layanan laundry dinonaktifkan',
    });
  } catch (error: any) {
    console.error('Error deleteLaundryService:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menonaktifkan layanan laundry' });
  }
};

/**
 * Mengambil konfigurasi takaran bahan cuci (Bill of Materials / BoM) untuk layanan laundry
 * @route GET /api/laundry/services/:id/bom
 */
export const getLaundryServiceBom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const service = await prisma.laundryService.findFirst({
      where: { id, tenantId },
    });
    if (!service) {
      return res.status(404).json({ status: 'error', message: 'Layanan laundry tidak ditemukan' });
    }

    const bomItems = await prisma.laundryServiceBomItem.findMany({
      where: { tenantId, laundryServiceId: id },
      include: {
        inventoryItem: {
          select: {
            id: true,
            itemCode: true,
            name: true,
            canonicalUom: true,
            purchaseUom: true,
            purchaseConversionFactor: true,
            averageCost: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    let totalBomCost = 0;
    const formattedItems = bomItems.map((item) => {
      const avgCost = Number(item.inventoryItem.averageCost || 0);
      const qty = Number(item.quantityPerUnit);
      const lineCost = Math.round(avgCost * qty);
      totalBomCost += lineCost;
      return {
        id: item.id,
        inventoryItemId: item.inventoryItemId,
        itemCode: item.inventoryItem.itemCode,
        name: item.inventoryItem.name,
        canonicalUom: item.inventoryItem.canonicalUom,
        purchaseUom: item.inventoryItem.purchaseUom,
        purchaseConversionFactor: Number(item.inventoryItem.purchaseConversionFactor || 1),
        averageCost: avgCost,
        quantityPerUnit: qty,
        consumptionBasis: item.consumptionBasis,
        notes: item.notes,
        lineCost,
      };
    });

    const servicePrice = Number(service.price);
    const grossMargin = Math.max(0, servicePrice - totalBomCost);
    const marginPercent = servicePrice > 0 ? Math.round((grossMargin / servicePrice) * 100) : 0;

    return res.status(200).json({
      status: 'success',
      data: {
        service: {
          id: service.id,
          name: service.name,
          category: service.category,
          unit: service.unit,
          price: servicePrice,
        },
        bomItems: formattedItems,
        totalBomCost,
        grossMargin,
        marginPercent,
      },
    });
  } catch (error: any) {
    console.error('Error getLaundryServiceBom:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil konfigurasi takaran bahan (BoM)' });
  }
};

const saveBomSchema = z.object({
  bomItems: z.array(
    z.object({
      inventoryItemId: z.string().uuid('ID Bahan tidak valid'),
      quantityPerUnit: z.number().positive('Takaran harus berupa angka positif'),
      consumptionBasis: z.enum(['PER_UNIT', 'PER_ORDER']).default('PER_UNIT'),
      notes: z.string().optional().nullable(),
    })
  ),
});

/**
 * Menyimpan / memperbarui daftar takaran bahan (BoM) untuk layanan laundry
 * @route PUT /api/laundry/services/:id/bom
 */
export const saveLaundryServiceBom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const role = (req.user?.role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(role)) {
      return res.status(403).json({ status: 'error', message: 'Hanya Owner, Admin, atau Supervisor yang dapat mengubah takaran bahan (BoM)' });
    }

    const service = await prisma.laundryService.findFirst({
      where: { id, tenantId },
    });
    if (!service) {
      return res.status(404).json({ status: 'error', message: 'Layanan laundry tidak ditemukan' });
    }

    const parseResult = saveBomSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi form takaran bahan (BoM) gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { bomItems } = parseResult.data;

    if (bomItems.length > 0) {
      const itemIds = bomItems.map((b) => b.inventoryItemId);
      const verifiedItems = await prisma.inventoryItem.findMany({
        where: { tenantId, id: { in: itemIds } },
        select: { id: true },
      });
      if (verifiedItems.length !== itemIds.length) {
        return res.status(400).json({
          status: 'error',
          message: 'Salah satu bahan baku yang dipilih tidak valid atau bukan milik toko Anda',
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      // Hapus konfigurasi BoM lama untuk service ini
      await tx.laundryServiceBomItem.deleteMany({
        where: { tenantId, laundryServiceId: id },
      });

      // Simpan konfigurasi baru
      for (const item of bomItems) {
        await tx.laundryServiceBomItem.create({
          data: {
            tenantId,
            laundryServiceId: id,
            inventoryItemId: item.inventoryItemId,
            quantityPerUnit: item.quantityPerUnit,
            consumptionBasis: item.consumptionBasis,
            notes: item.notes || null,
          },
        });
      }
    });

    return res.status(200).json({
      status: 'success',
      message: 'Konfigurasi takaran bahan cuci (BoM) berhasil disimpan',
    });
  } catch (error: any) {
    console.error('Error saveLaundryServiceBom:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menyimpan takaran bahan (BoM)' });
  }
};

// ==========================================
// 2B. LAUNDRY PERFUMES CONTROLLER
// ==========================================

export const getLaundryPerfumes = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const includeInactive = req.query.includeInactive === 'true';

    let perfumes = await prisma.laundryPerfume.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        inventoryItem: {
          select: {
            id: true,
            name: true,
            itemCode: true,
            canonicalUom: true,
            averageCost: true,
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    if (perfumes.length === 0) {
      const defaultPerfumes = [
        { name: 'Lavender', extraPrice: new Prisma.Decimal(0), isDefault: true, sortOrder: 1, usageBasis: 'PER_KG' },
        { name: 'Ocean Fresh', extraPrice: new Prisma.Decimal(0), isDefault: false, sortOrder: 2, usageBasis: 'PER_KG' },
        { name: 'Akasia', extraPrice: new Prisma.Decimal(0), isDefault: false, sortOrder: 3, usageBasis: 'PER_KG' },
        { name: 'Snappy', extraPrice: new Prisma.Decimal(0), isDefault: false, sortOrder: 4, usageBasis: 'PER_KG' },
        { name: 'Sakura', extraPrice: new Prisma.Decimal(0), isDefault: false, sortOrder: 5, usageBasis: 'PER_KG' },
        { name: 'Tanpa Parfum', extraPrice: new Prisma.Decimal(0), isDefault: false, sortOrder: 6, usageBasis: 'PER_KG' },
      ];

      for (const p of defaultPerfumes) {
        await prisma.laundryPerfume.create({
          data: {
            ...p,
            tenantId,
          },
        });
      }

      perfumes = await prisma.laundryPerfume.findMany({
        where: {
          tenantId,
          ...(includeInactive ? {} : { isActive: true }),
        },
        include: {
          inventoryItem: {
            select: {
              id: true,
              name: true,
              itemCode: true,
              canonicalUom: true,
              averageCost: true,
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    }

    const formatted = perfumes.map((p) => {
      const qty = Number(p.usageQtyPerUnit);
      return {
        id: p.id,
        name: p.name,
        extraPrice: Number(p.extraPrice),
        inventoryItemId: p.inventoryItemId,
        usageQtyPerUnit: qty,
        usageBasis: p.usageBasis,
        dosageMl: qty,
        dosageUnit: p.usageBasis,
        isActive: p.isActive,
        isDefault: p.isDefault,
        sortOrder: p.sortOrder,
        outletId: p.outletId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        inventoryItem: p.inventoryItem ? {
          id: p.inventoryItem.id,
          name: p.inventoryItem.name,
          sku: p.inventoryItem.itemCode,
          canonicalUom: p.inventoryItem.canonicalUom,
          averageCost: Number(p.inventoryItem.averageCost || 0),
        } : null,
      };
    });

    return res.status(200).json({
      status: 'success',
      data: formatted,
    });
  } catch (error: any) {
    console.error('Error getLaundryPerfumes:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil data parfum laundry' });
  }
};

export const createLaundryPerfume = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const role = (req.user?.role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(role)) {
      return res.status(403).json({ status: 'error', message: 'Hanya Owner, Admin, atau Supervisor yang dapat menambah varian parfum' });
    }

    const {
      name,
      extraPrice = 0,
      inventoryItemId,
      usageQtyPerUnit,
      dosageMl,
      usageBasis,
      dosageUnit,
      isActive = true,
      isDefault = false,
      sortOrder = 0,
      outletId,
    } = req.body;

    const resolvedQty = usageQtyPerUnit !== undefined ? usageQtyPerUnit : (dosageMl !== undefined ? dosageMl : 0);
    const resolvedBasis = usageBasis !== undefined ? usageBasis : (dosageUnit !== undefined ? dosageUnit : 'PER_KG');

    if (!name || !name.trim()) {
      return res.status(400).json({ status: 'error', message: 'Nama parfum wajib diisi' });
    }

    if (inventoryItemId) {
      const inv = await prisma.inventoryItem.findFirst({
        where: { id: inventoryItemId, tenantId },
      });
      if (!inv) {
        return res.status(400).json({ status: 'error', message: 'Bahan baku yang dipilih tidak valid' });
      }
    }

    if (isDefault) {
      await prisma.laundryPerfume.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const perfume = await prisma.laundryPerfume.create({
      data: {
        tenantId,
        outletId: outletId || null,
        name: name.trim(),
        extraPrice: new Prisma.Decimal(Math.max(0, Number(extraPrice || 0))),
        inventoryItemId: inventoryItemId || null,
        usageQtyPerUnit: new Prisma.Decimal(Math.max(0, Number(resolvedQty || 0))),
        usageBasis: ['PER_KG', 'PER_ORDER'].includes(resolvedBasis) ? resolvedBasis : 'PER_KG',
        isActive: Boolean(isActive),
        isDefault: Boolean(isDefault),
        sortOrder: Number(sortOrder || 0),
      },
      include: {
        inventoryItem: {
          select: { id: true, name: true, itemCode: true, canonicalUom: true },
        },
      },
    });

    const createdQty = Number(perfume.usageQtyPerUnit);
    return res.status(201).json({
      status: 'success',
      message: 'Varian parfum berhasil ditambahkan',
      data: {
        ...perfume,
        extraPrice: Number(perfume.extraPrice),
        usageQtyPerUnit: createdQty,
        dosageMl: createdQty,
        dosageUnit: perfume.usageBasis,
      },
    });
  } catch (error: any) {
    console.error('Error createLaundryPerfume:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal membuat varian parfum' });
  }
};

export const updateLaundryPerfume = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const role = (req.user?.role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(role)) {
      return res.status(403).json({ status: 'error', message: 'Hanya Owner, Admin, atau Supervisor yang dapat mengubah varian parfum' });
    }

    const existing = await prisma.laundryPerfume.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Parfum tidak ditemukan' });
    }

    const {
      name,
      extraPrice,
      inventoryItemId,
      usageQtyPerUnit,
      dosageMl,
      usageBasis,
      dosageUnit,
      isActive,
      isDefault,
      sortOrder,
      outletId,
    } = req.body;

    const resolvedQty = usageQtyPerUnit !== undefined ? usageQtyPerUnit : dosageMl;
    const resolvedBasis = usageBasis !== undefined ? usageBasis : dosageUnit;

    if (inventoryItemId) {
      const inv = await prisma.inventoryItem.findFirst({
        where: { id: inventoryItemId, tenantId },
      });
      if (!inv) {
        return res.status(400).json({ status: 'error', message: 'Bahan baku yang dipilih tidak valid' });
      }
    }

    if (isDefault) {
      await prisma.laundryPerfume.updateMany({
        where: { tenantId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.laundryPerfume.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(extraPrice !== undefined ? { extraPrice: new Prisma.Decimal(Math.max(0, Number(extraPrice || 0))) } : {}),
        ...(inventoryItemId !== undefined ? { inventoryItemId: inventoryItemId || null } : {}),
        ...(resolvedQty !== undefined ? { usageQtyPerUnit: new Prisma.Decimal(Math.max(0, Number(resolvedQty || 0))) } : {}),
        ...(resolvedBasis !== undefined ? { usageBasis: ['PER_KG', 'PER_ORDER'].includes(resolvedBasis) ? resolvedBasis : 'PER_KG' } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(isDefault !== undefined ? { isDefault: Boolean(isDefault) } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
        ...(outletId !== undefined ? { outletId: outletId || null } : {}),
      },
      include: {
        inventoryItem: {
          select: { id: true, name: true, itemCode: true, canonicalUom: true },
        },
      },
    });

    const updatedQty = Number(updated.usageQtyPerUnit);
    return res.status(200).json({
      status: 'success',
      message: 'Varian parfum berhasil diperbarui',
      data: {
        ...updated,
        extraPrice: Number(updated.extraPrice),
        usageQtyPerUnit: updatedQty,
        dosageMl: updatedQty,
        dosageUnit: updated.usageBasis,
      },
    });
  } catch (error: any) {
    console.error('Error updateLaundryPerfume:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui varian parfum' });
  }
};

export const deleteLaundryPerfume = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const role = (req.user?.role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(role)) {
      return res.status(403).json({ status: 'error', message: 'Hanya Owner, Admin, atau Supervisor yang dapat menghapus varian parfum' });
    }

    const existing = await prisma.laundryPerfume.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Parfum tidak ditemukan' });
    }

    await prisma.laundryPerfume.delete({
      where: { id },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Varian parfum berhasil dihapus',
    });
  } catch (error: any) {
    console.error('Error deleteLaundryPerfume:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menghapus varian parfum' });
  }
};

// ==========================================
// 3. LAUNDRY RACKS CONTROLLER
// ==========================================

export const getLaundryRacks = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const { outletId } = req.query;

    const where: any = { tenantId, isActive: true };
    if (outletId && typeof outletId === 'string') {
      where.outletId = outletId;
    }

    let racks = await prisma.laundryRack.findMany({
      where,
      orderBy: [{ code: 'asc' }],
    });

    // Auto-seed rak penyimpanan default jika belum ada
    if (racks.length === 0 && outletId && typeof outletId === 'string') {
      const sampleRacks = [
        { code: 'RAK-A1', name: 'Rak Kiloan A1', category: 'KILOAN', capacity: 10 },
        { code: 'RAK-A2', name: 'Rak Kiloan A2', category: 'KILOAN', capacity: 10 },
        { code: 'RAK-A3', name: 'Rak Kiloan A3', category: 'KILOAN', capacity: 10 },
        { code: 'RAK-B1', name: 'Rak Bed Cover B1', category: 'SATUAN', capacity: 6 },
        { code: 'RAK-B2', name: 'Rak Bed Cover B2', category: 'SATUAN', capacity: 6 },
        { code: 'HGR-01', name: 'Gantungan Hanger Jas 01', category: 'SATUAN', capacity: 15 },
        { code: 'HGR-02', name: 'Gantungan Hanger Gaun 02', category: 'SATUAN', capacity: 15 },
        { code: 'SPT-01', name: 'Rak Khusus Sepatu / Tas', category: 'SEPATU_TAS', capacity: 8 },
      ];

      for (const item of sampleRacks) {
        await prisma.laundryRack.create({
          data: {
            ...item,
            tenantId: tenantId as string,
            outletId,
          },
        });
      }

      racks = await prisma.laundryRack.findMany({
        where,
        orderBy: [{ code: 'asc' }],
      });
    }

    // Hitung berapa nota yang saat ini sedang disimpan di masing-masing rak
    const rackCodes = racks.map((r) => r.code);
    const activeOrdersInRacks = await prisma.laundryOrderDetail.findMany({
      where: {
        tenantId,
        rackCode: { in: rackCodes },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        order: { orderStatus: { notIn: [OrderStatus.VOIDED, OrderStatus.CANCELLED] } },
      },
      include: {
        order: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            paidAmount: true,
            paymentStatus: true,
            customer: { select: { name: true, phone: true } },
          },
        },
      },
    });

    const racksWithOccupancy = racks.map((rack) => {
      const ordersInThisRack = activeOrdersInRacks.filter((o) => o.rackCode === rack.code);
      return {
        ...rack,
        currentCount: ordersInThisRack.length,
        activeOrders: ordersInThisRack.map((o) => {
          const totalAmount = Number(o.order.totalAmount || 0);
          const paidAmount = Number(o.order.paidAmount || 0);
          return {
            orderId: o.orderId,
            orderNumber: o.order.invoiceNumber,
            customerName: o.order.customer?.name || 'Pelanggan Walk-In',
            customerPhone: o.order.customer?.phone || null,
            totalWeightKg: o.totalWeightKg ? Number(o.totalWeightKg) : null,
            totalPieces: o.totalPieces,
            totalAmount,
            paidAmount,
            remainingAmount: Math.max(0, totalAmount - paidAmount),
            paymentStatus: o.order.paymentStatus,
            status: o.status,
            readyAt: o.estimatedReadyAt || o.completedAt || o.updatedAt,
            updatedAt: o.updatedAt,
            createdAt: o.createdAt,
          };
        }),
      };
    });

    return res.status(200).json({
      status: 'success',
      data: racksWithOccupancy,
    });
  } catch (error: any) {
    console.error('Error getLaundryRacks:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil daftar rak penyimpanan' });
  }
};

export const createLaundryRack = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const role = (req.user?.role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(role)) {
      return res.status(403).json({ status: 'error', message: 'Hanya Owner, Admin, atau Supervisor yang dapat menambah rak penyimpanan' });
    }
    const parseResult = createLaundryRackSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi form rak laundry gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { outletId, code, name, category, capacity, locationNote } = parseResult.data;
    const upperCode = code.toUpperCase().trim();

    const existing = await prisma.laundryRack.findFirst({
      where: { tenantId, outletId, code: upperCode },
    });
    if (existing) {
      return res.status(400).json({
        status: 'error',
        message: `Rak dengan kode ${upperCode} sudah terdaftar pada toko ini`,
      });
    }

    const rack = await prisma.laundryRack.create({
      data: {
        tenantId,
        outletId,
        code: upperCode,
        name,
        category,
        capacity,
        locationNote: locationNote?.trim() || null,
        isActive: true,
      },
    });

    return res.status(201).json({
      status: 'success',
      message: 'Rak penyimpanan berhasil didaftarkan',
      data: rack,
    });
  } catch (error: any) {
    console.error('Error createLaundryRack:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mendaftarkan rak laundry baru' });
  }
};

// ==========================================
// 3B. LAUNDRY MACHINES CONTROLLER
// ==========================================

export const getLaundryMachines = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    let outletId = (req.query.outletId as string) || (req.user as any)?.outletId;
    if (!outletId) {
      const firstOutlet = await prisma.outlet.findFirst({
        where: { tenantId, isActive: true },
        select: { id: true },
      });
      outletId = firstOutlet?.id;
    }

    if (!outletId) {
      return res.status(404).json({ status: 'error', message: 'Outlet tidak ditemukan' });
    }

    let machines = await prisma.laundryMachine.findMany({
      where: { tenantId, outletId },
      orderBy: [{ machineType: 'desc' }, { code: 'asc' }],
    });

    // Auto-seed mesin awal jika kosong
    if (machines.length === 0) {
      const defaultMachines = [
        { code: 'W-01', name: 'Mesin Cuci W-01', machineType: 'WASHER' as const, capacityKg: new Prisma.Decimal(8), status: 'ACTIVE' },
        { code: 'W-02', name: 'Mesin Cuci W-02', machineType: 'WASHER' as const, capacityKg: new Prisma.Decimal(8), status: 'ACTIVE' },
        { code: 'W-03', name: 'Mesin Cuci W-03', machineType: 'WASHER' as const, capacityKg: new Prisma.Decimal(8), status: 'ACTIVE' },
        { code: 'W-04', name: 'Mesin Cuci W-04', machineType: 'WASHER' as const, capacityKg: new Prisma.Decimal(8), status: 'ACTIVE' },
        { code: 'D-01', name: 'Mesin Pengering D-01', machineType: 'DRYER' as const, capacityKg: new Prisma.Decimal(9), status: 'ACTIVE' },
        { code: 'D-02', name: 'Mesin Pengering D-02', machineType: 'DRYER' as const, capacityKg: new Prisma.Decimal(9), status: 'ACTIVE' },
        { code: 'D-03', name: 'Mesin Pengering D-03', machineType: 'DRYER' as const, capacityKg: new Prisma.Decimal(9), status: 'ACTIVE' },
        { code: 'D-04', name: 'Mesin Pengering D-04', machineType: 'DRYER' as const, capacityKg: new Prisma.Decimal(9), status: 'ACTIVE' },
      ];

      for (const m of defaultMachines) {
        await prisma.laundryMachine.create({
          data: {
            ...m,
            tenantId,
            outletId,
          },
        });
      }

      machines = await prisma.laundryMachine.findMany({
        where: { tenantId, outletId },
        orderBy: [{ machineType: 'desc' }, { code: 'asc' }],
      });
    }

    const formatted = machines.map((m) => ({
      id: m.id,
      outletId: m.outletId,
      code: m.code,
      name: m.name,
      machineType: m.machineType,
      capacityKg: m.capacityKg ? Number(m.capacityKg) : null,
      status: m.status,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    return res.status(200).json({
      status: 'success',
      data: formatted,
    });
  } catch (error: any) {
    console.error('Error getLaundryMachines:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil data mesin produksi' });
  }
};

export const createLaundryMachine = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const role = (req.user?.role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(role)) {
      return res.status(403).json({ status: 'error', message: 'Hanya Owner, Admin, atau Supervisor yang dapat menambah mesin' });
    }

    const { outletId, code, name, machineType, capacityKg, status = 'ACTIVE' } = req.body;

    if (!outletId) {
      return res.status(400).json({ status: 'error', message: 'Outlet wajib ditentukan' });
    }
    if (!code || !code.trim()) {
      return res.status(400).json({ status: 'error', message: 'Kode mesin wajib diisi' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ status: 'error', message: 'Nama mesin wajib diisi' });
    }
    if (!['WASHER', 'DRYER'].includes(machineType)) {
      return res.status(400).json({ status: 'error', message: 'Tipe mesin harus WASHER atau DRYER' });
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = await prisma.laundryMachine.findFirst({
      where: { outletId, code: cleanCode },
    });
    if (existing) {
      return res.status(400).json({ status: 'error', message: `Kode mesin ${cleanCode} sudah digunakan di outlet ini` });
    }

    const machine = await prisma.laundryMachine.create({
      data: {
        tenantId,
        outletId,
        code: cleanCode,
        name: name.trim(),
        machineType,
        capacityKg: capacityKg ? new Prisma.Decimal(Number(capacityKg)) : null,
        status: ['ACTIVE', 'MAINTENANCE', 'INACTIVE'].includes(status) ? status : 'ACTIVE',
      },
    });

    return res.status(201).json({
      status: 'success',
      message: 'Mesin produksi berhasil ditambahkan',
      data: {
        ...machine,
        capacityKg: machine.capacityKg ? Number(machine.capacityKg) : null,
      },
    });
  } catch (error: any) {
    console.error('Error createLaundryMachine:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal membuat mesin produksi' });
  }
};

export const updateLaundryMachine = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const role = (req.user?.role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(role)) {
      return res.status(403).json({ status: 'error', message: 'Hanya Owner, Admin, atau Supervisor yang dapat mengubah mesin' });
    }

    const existing = await prisma.laundryMachine.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Mesin tidak ditemukan' });
    }

    const { code, name, machineType, capacityKg, status } = req.body;

    let cleanCode = existing.code;
    if (code && code.trim().toUpperCase() !== existing.code) {
      cleanCode = code.trim().toUpperCase();
      const duplicate = await prisma.laundryMachine.findFirst({
        where: { outletId: existing.outletId, code: cleanCode, id: { not: id } },
      });
      if (duplicate) {
        return res.status(400).json({ status: 'error', message: `Kode mesin ${cleanCode} sudah digunakan di outlet ini` });
      }
    }

    const updated = await prisma.laundryMachine.update({
      where: { id },
      data: {
        code: cleanCode,
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(machineType !== undefined && ['WASHER', 'DRYER'].includes(machineType) ? { machineType } : {}),
        ...(capacityKg !== undefined ? { capacityKg: capacityKg ? new Prisma.Decimal(Number(capacityKg)) : null } : {}),
        ...(status !== undefined && ['ACTIVE', 'MAINTENANCE', 'INACTIVE'].includes(status) ? { status } : {}),
      },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Data mesin berhasil diperbarui',
      data: {
        ...updated,
        capacityKg: updated.capacityKg ? Number(updated.capacityKg) : null,
      },
    });
  } catch (error: any) {
    console.error('Error updateLaundryMachine:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui data mesin' });
  }
};

export const deleteLaundryMachine = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const role = (req.user?.role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(role)) {
      return res.status(403).json({ status: 'error', message: 'Hanya Owner, Admin, atau Supervisor yang dapat menghapus mesin' });
    }

    const existing = await prisma.laundryMachine.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Mesin tidak ditemukan' });
    }

    await prisma.laundryMachine.delete({
      where: { id },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Mesin berhasil dihapus',
    });
  } catch (error: any) {
    console.error('Error deleteLaundryMachine:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menghapus mesin' });
  }
};

// ==========================================
// 4. LAUNDRY ORDERS & KANBAN QUEUE
// ==========================================

export const getLaundryOrders = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const { outletId, status, mode } = req.query;

    const where: any = { tenantId };
    if (outletId && typeof outletId === 'string') {
      if (mode === 'WORKSHOP') {
        where.workshopOutletId = outletId;
      } else {
        where.outletId = outletId;
      }
    }
    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 100));
    const skip = (page - 1) * limit;

    const details = await prisma.laundryOrderDetail.findMany({
      where,
      include: {
        order: {
          include: {
            items: {
              select: {
                id: true,
                productName: true,
                quantity: true,
                unitPrice: true,
                subtotal: true,
                unit: true,
                pricingBasis: true,
                perfumeVariant: true,
                notes: true,
              },
            },
            customer: {
              select: {
                id: true,
                name: true,
                phone: true,
                address: true,
              },
            },
            cashier: { select: { id: true, name: true } },
            laundryIncidents: {
              select: {
                id: true,
                incidentType: true,
                status: true,
                itemDescription: true,
                estimatedCompensation: true,
                approvedCompensation: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      skip,
    });

    const formattedQueue = details.map((detail) => {
      const incidents = (detail.order as any).laundryIncidents || [];
      const incidentCount = incidents.length;
      const hasOpenIncident = incidents.some(
        (inc: any) => inc.status === 'OPEN' || inc.status === 'INVESTIGATING'
      );
      const itemsCount = detail.order.items.length;
      const primaryServiceName = detail.order.items[0]?.productName || 'Layanan Laundry';
      const serviceSummary =
        itemsCount > 1
          ? `${primaryServiceName} (+${itemsCount - 1} layanan)`
          : primaryServiceName;

      return {
        id: detail.id,
        orderId: detail.orderId,
        invoiceNumber: detail.order.invoiceNumber,
        orderStatus: detail.order.orderStatus,
        status: (detail.order.orderStatus === OrderStatus.VOIDED || detail.order.orderStatus === OrderStatus.CANCELLED || detail.status === 'CANCELLED') ? 'CANCELLED' : detail.status,
        customerName: detail.order.customer?.name || 'Pelanggan Walk-In',
        customerPhone: detail.order.customer?.phone || null,
        customerAddress: detail.order.customer?.address || null,
        serviceName: primaryServiceName,
        serviceSummary,
        itemsCount,
        items: detail.order.items.map((oi) => ({
          id: oi.id,
          productName: oi.productName || 'Layanan Laundry',
          quantity: oi.quantity,
          unitPrice: Number(oi.unitPrice),
          subtotal: Number(oi.subtotal),
          unit: oi.unit || 'KG',
          pricingBasis: oi.pricingBasis || 'KILOAN',
          perfumeVariant: oi.perfumeVariant || detail.perfumeVariant || 'Standard',
          notes: oi.notes || null,
        })),
        totalWeightKg: detail.totalWeightKg ? Number(detail.totalWeightKg) : null,
        totalPieces: detail.totalPieces,
        grandTotal: Number(detail.order.totalAmount),
        paidAmount: Number(detail.order.paidAmount || 0),
        paymentStatus: detail.order.paymentStatus,
        rackCode: detail.rackCode || null,
        perfumeVariant: detail.perfumeVariant || 'Standard',
        currentStage: detail.currentStage || 'DROP_OFF',
        transferStatus: detail.transferStatus || 'AT_OUTLET',
        workshopOutletId: detail.workshopOutletId || null,
        customerNotes: detail.customerNotes || null,
        deliveryType: detail.deliveryType || 'NONE',
        deliveryStatus: detail.deliveryStatus || null,
        deliveryFee: Number(detail.deliveryFee || 0),
        deliveryZoneName: detail.deliveryZoneName || null,
        deliveryAddress: detail.deliveryAddress || detail.order.customer?.address || null,
        deliveryNotes: detail.deliveryNotes || null,
        courierName: detail.courierName || null,
        courierPhone: detail.courierPhone || null,
        deliveredAt: detail.deliveredAt || null,
        deliveryProofPhotoUrl: detail.deliveryProofPhotoUrl || null,
        estimatedReadyAt: detail.estimatedReadyAt,
        completedAt: detail.completedAt,
        pickedUpAt: detail.pickedUpAt,
        defects: detail.defects || null,
        defectNotes: detail.defectNotes || null,
        conditionPhotos: detail.conditionPhotos || null,
        isSorted: detail.isSorted,
        garmentCounts: detail.garmentCounts || null,
        incidentCount,
        hasOpenIncident,
        incidents,
        // Laundry Core Phase 1: Operational Precision Fields
        initialWeightKg: detail.initialWeightKg ? Number(detail.initialWeightKg) : (detail.totalWeightKg ? Number(detail.totalWeightKg) : null),
        finalWeightKg: detail.finalWeightKg ? Number(detail.finalWeightKg) : null,
        weightDiffKg:
          detail.finalWeightKg && (detail.initialWeightKg || detail.totalWeightKg)
            ? Math.round((Number(detail.finalWeightKg) - Number(detail.initialWeightKg || detail.totalWeightKg)) * 1000) / 1000
            : null,
        weightDiffReason: detail.weightDiffReason || null,
        qcStatus: detail.qcStatus || null,
        qcChecklist: detail.qcChecklist || null,
        createdAt: detail.createdAt,
      };
    });

    return res.status(200).json({
      status: 'success',
      data: formattedQueue,
    });
  } catch (error: any) {
    console.error('Error getLaundryOrders:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil antrean cucian laundry' });
  }
};

class BusinessValidationError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = 'BusinessValidationError';
    this.statusCode = 400;
  }
}

/**
 * Helper Idempoten: Berikan poin belanja reward pada nota laundry yang telah lunas
 */
async function awardLaundryOrderPointsIfEligible(
  tx: any,
  tenantId: string,
  outletId: string,
  customerId: string | null | undefined,
  orderId: string,
  spendAmount: number
) {
  if (!customerId || spendAmount <= 0) return;

  const outlet = await tx.outlet.findFirst({
    where: { id: outletId, tenantId },
    select: { loyaltyConfig: true },
  });
  const loyaltyConfig = outlet?.loyaltyConfig as any;
  if (!loyaltyConfig || !loyaltyConfig.isActive) return;

  // Idempotency check: apakah poin EARNED_PURCHASE sudah pernah diberikan untuk nota ini
  const existingLedger = await tx.customerPointLedger.findFirst({
    where: {
      tenantId,
      orderId,
      type: 'EARNED_PURCHASE',
    },
  });
  if (existingLedger) return;

  await loyaltyService.awardPoints(
    {
      tenantId,
      customerId,
      orderId,
      spendAmount,
    },
    tx,
    loyaltyConfig
  );
}

export const createLaundryOrder = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ status: 'error', message: 'Konteks autentikasi kasir tidak ditemukan' });
    }

    // ====================================================
    // IDEMPOTENSI ORDER LAUNDRY & OFFLINE RETRY
    // ====================================================
    const idempotencyKey = idempotencyService.getIdempotencyKey(req);
    if (idempotencyKey) {
      const cached = await idempotencyService.getExistingIdempotentResponse(tenantId, 'LAUNDRY_CHECKOUT', idempotencyKey);
      if (cached) {
        return res.status(cached.statusCode).json({
          ...cached.responseBody,
          _idempotentReplay: true,
        });
      }
    }

    const parseResult = createLaundryOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.log('CREATE LAUNDRY ORDER VALIDATION ERRORS:', parseResult.error.flatten().fieldErrors);
      return res.status(400).json({
        status: 'error',
        message: 'Validasi form pesanan laundry gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const {
      outletId,
      customerId,
      customerName,
      customerPhone,
      customerAddress,
      deliveryType: rawDeliveryType,
      deliveryDistanceKm,
      deliveryFeePerKm,
      deliveryFee,
      deliveryZoneName,
      deliveryAddress,
      deliveryNotes,
      deliveryScheduledAt,
      courierName,
      courierPhone,
      items,
      totalPieces,
      perfumeVariant,
      estimatedReadyHours,
      depositAmount,
      discountAmount,
      manualDiscountAmount,
      promotionId,
      promoCode,
      pointsToRedeem,
      paymentMethod,
      customerNotes,
    } = parseResult.data;

    let deliveryType = rawDeliveryType || 'NONE';
    if (deliveryType === 'SELF_PICKUP') deliveryType = 'NONE';
    if (deliveryType === 'DELIVERY') deliveryType = 'DELIVERY_ONLY';
    const isDelivery = deliveryType !== 'NONE';

    const effectiveAddress = (deliveryAddress || customerAddress || '').trim();

    // Validasi prasyarat pembayaran deposit / kuota: pelanggan terdaftar wajib dipilih
    if ((paymentMethod === 'CUSTOMER_DEPOSIT' || paymentMethod === 'LAUNDRY_QUOTA') && !customerId) {
      return res.status(400).json({
        status: 'error',
        message: paymentMethod === 'CUSTOMER_DEPOSIT'
          ? 'Pelanggan wajib dipilih untuk pembayaran menggunakan saldo deposit'
          : 'Pelanggan wajib dipilih untuk pembayaran menggunakan kuota kiloan',
      });
    }

    // 1. Dapatkan atau daftarkan Customer jika belum ada, serta update alamat jika disediakan
    let effectiveCustomerId = customerId;
    if (effectiveCustomerId && effectiveAddress) {
      await prisma.customer.updateMany({
        where: { id: effectiveCustomerId, tenantId },
        data: { address: effectiveAddress },
      });
    } else if (!effectiveCustomerId && customerName.trim()) {
      let cust = await prisma.customer.findFirst({
        where: {
          tenantId,
          OR: [
            ...(customerPhone ? [{ phone: customerPhone.trim() }] : []),
            { name: customerName.trim() },
          ],
        },
      });

      if (!cust) {
        cust = await prisma.customer.create({
          data: {
            tenantId,
            name: customerName.trim(),
            phone: customerPhone?.trim() || null,
            address: effectiveAddress || null,
          },
        });
      } else if (effectiveAddress && !cust.address) {
        await prisma.customer.update({
          where: { id: cust.id },
          data: { address: effectiveAddress },
        });
      }
      effectiveCustomerId = cust.id;
    }

    // 2. Hitung Grand Total Subtotal dari items & addons
    let subtotal = 0;
    let totalWeightKg = 0;
    const orderItemsData = items.map((item) => {
      const normUnit = (item.unit || 'PCS').trim().toUpperCase();
      const isKiloan = ['KG', 'PER_KG'].includes(normUnit);
      const baseLineTotal = Math.round(item.quantity * item.unitPrice);
      const addonsTotal = (item.addons || []).reduce((acc, a) => {
        if (a.total !== undefined) return acc + a.total;
        const isPerUnit = ['PER_KG', 'PER_UNIT', 'KG'].includes((a.unit || '').toUpperCase());
        return acc + (isPerUnit ? Math.round(a.price * item.quantity) : a.price);
      }, 0);
      const lineTotal = baseLineTotal + addonsTotal;
      subtotal += lineTotal;
      if (isKiloan) {
        totalWeightKg += item.quantity;
      }

      let itemNotes = item.notes || '';
      if (item.addons && item.addons.length > 0) {
        const addonStr = item.addons.map((a) => `+${a.name} (Rp ${a.price.toLocaleString('id-ID')})`).join(', ');
        itemNotes = itemNotes ? `${itemNotes} | Add-on: ${addonStr}` : `Add-on: ${addonStr}`;
      }

      return {
        tenantId,
        productName: item.name,
        quantity: Math.max(1, Math.round(item.quantity)),
        unitPrice: item.unitPrice,
        costPrice: 0,
        discountAmount: 0,
        subtotal: lineTotal,
        notes: itemNotes || null,
        unit: normUnit,
        pricingBasis: isKiloan ? 'KILOAN' : 'SATUAN',
        perfumeVariant: item.perfumeVariant || perfumeVariant || 'Standard',
        laundryServiceId: item.laundryServiceId || item.serviceId || null,
        addonsSnapshot: item.addons && item.addons.length > 0 ? (item.addons as any) : undefined,
      };
    });

    // Ongkos Kirim Antar-Jemput
    const effectiveDeliveryFee = isDelivery ? Number(deliveryFee || 0) : 0;

    // Ambil konfigurasi outlet, loyalitas, dan resi
    const outletRecord = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        receiptConfig: true,
        loyaltyConfig: true,
        googleReviewUrl: true,
      },
    });
    const loyaltyConfig = (outletRecord?.loyaltyConfig as any) || undefined;
    const isLoyaltyActive = Boolean(loyaltyConfig?.isActive);

    // 1. Validasi Kode Promo / Voucher Terkelola
    let promoDiscount = 0;
    let validPromotion: any = null;
    const rawPromoCode = promoCode?.trim().toUpperCase();
    let resolvedPromoCode = rawPromoCode;

    if (!resolvedPromoCode && promotionId) {
      const promoDb = await prisma.promotion.findFirst({
        where: { id: promotionId, tenantId },
      });
      if (promoDb) {
        resolvedPromoCode = promoDb.code;
      }
    }

    if (resolvedPromoCode) {
      const promoValidation = await promotionService.validatePromotion(
        tenantId,
        resolvedPromoCode,
        subtotal,
        effectiveCustomerId
      );
      if (!promoValidation.valid) {
        return res.status(400).json({
          status: 'error',
          message: promoValidation.message || 'Kode promo tidak valid atau tidak dapat digunakan',
        });
      }
      promoDiscount = promoValidation.discountAmount;
      validPromotion = promoValidation.promotion;
    }

    // 2. Validasi Penukaran Poin Member (Loyalty Points Redeem)
    let pointDiscount = 0;
    const requestedPointsToRedeem = Number(pointsToRedeem || 0);

    if (requestedPointsToRedeem > 0) {
      if (!isLoyaltyActive) {
        return res.status(400).json({
          status: 'error',
          message: 'Program loyalitas dan poin member sedang tidak aktif di outlet ini',
        });
      }
      if (!effectiveCustomerId) {
        return res.status(400).json({
          status: 'error',
          message: 'Pelanggan harus dipilih untuk dapat menukarkan poin loyalitas',
        });
      }
      const customerRecord = await prisma.customer.findUnique({
        where: { id: effectiveCustomerId },
      });
      const currentPoints = Number(customerRecord?.loyaltyPoints || 0);
      if (currentPoints < requestedPointsToRedeem) {
        return res.status(400).json({
          status: 'error',
          message: `Poin tidak mencukupi. Tersedia: ${currentPoints} poin, diminta: ${requestedPointsToRedeem} poin`,
        });
      }
      const minPoints = Number(loyaltyConfig?.minPointsToRedeem || 10);
      if (requestedPointsToRedeem < minPoints) {
        return res.status(400).json({
          status: 'error',
          message: `Minimal penukaran poin adalah ${minPoints} poin`,
        });
      }
      const ptValue = Number(loyaltyConfig?.pointValueIdr || 100);
      const { maxPoints } = loyaltyService.calculateMaxRedeemable(subtotal, currentPoints, ptValue);
      if (requestedPointsToRedeem > maxPoints) {
        return res.status(400).json({
          status: 'error',
          message: `Maksimal penukaran poin untuk transaksi ini adalah ${maxPoints} poin`,
        });
      }
      pointDiscount = requestedPointsToRedeem * ptValue;
    }

    // 3. Kalkulasi Diskon Gabungan Bersih (Voucher + Manual + Poin)
    const manualDiscount = Math.max(
      0,
      Number(manualDiscountAmount || (discountAmount && !validPromotion ? discountAmount : 0))
    );
    const effectiveDiscount = Math.min(
      subtotal + effectiveDeliveryFee,
      promoDiscount + manualDiscount + pointDiscount
    );
    const grandTotal = Math.max(0, subtotal + effectiveDeliveryFee - effectiveDiscount);
    const paidAmount = paymentMethod === 'UNPAID' ? 0 : Math.min(grandTotal, depositAmount || grandTotal);

    let initialDeliveryStatus: string | null = null;
    if (isDelivery) {
      if (deliveryType === 'PICKUP_ONLY' || deliveryType === 'PICKUP_AND_DELIVERY') {
        initialDeliveryStatus = 'PENDING_PICKUP';
      } else if (deliveryType === 'DELIVERY_ONLY') {
        initialDeliveryStatus = 'PICKED_UP';
      }
    }

    // Keterangan Pengantaran & Catatan
    let formattedNotes = customerNotes?.trim() || '';
    if (isDelivery) {
      const typeLabel =
        deliveryType === 'PICKUP_ONLY'
          ? 'Jemput'
          : deliveryType === 'DELIVERY_ONLY'
          ? 'Antar'
          : 'Jemput & Antar';
      const zoneInfo = deliveryZoneName ? ` (${deliveryZoneName})` : '';
      const feeInfo = effectiveDeliveryFee > 0 ? ` (Ongkir: Rp ${effectiveDeliveryFee.toLocaleString('id-ID')})` : ' (Gratis Ongkir)';
      const addrInfo = effectiveAddress ? `Alamat: ${effectiveAddress}` : '';
      const deliveryHeader = `🛵 [${typeLabel}${zoneInfo}${feeInfo}] ${addrInfo}`;
      formattedNotes = formattedNotes ? `${deliveryHeader} | Catatan: ${formattedNotes}` : deliveryHeader;
    } else {
      formattedNotes = formattedNotes ? `🧺 [Ambil di Toko] ${formattedNotes}` : '🧺 [Ambil di Toko]';
    }

    if (validPromotion && promoDiscount > 0) {
      formattedNotes += ` | [Voucher: ${validPromotion.code} -Rp ${promoDiscount.toLocaleString('id-ID')}]`;
    }
    if (pointDiscount > 0) {
      formattedNotes += ` | [Tukar ${requestedPointsToRedeem} Poin -Rp ${pointDiscount.toLocaleString('id-ID')}]`;
    }

    // Tentukan paymentStatus: Lunas vs DP vs Belum Bayar
    let paymentStatus: PaymentStatus = PaymentStatus.UNPAID;
    if (paidAmount >= grandTotal && grandTotal > 0) {
      paymentStatus = PaymentStatus.PAID;
    } else if (paidAmount > 0) {
      paymentStatus = PaymentStatus.PARTIALLY_PAID;
    }

    // Invoice generator
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const orderCountToday = await prisma.order.count({
      where: {
        tenantId,
        createdAt: {
          gte: new Date(today.setHours(0, 0, 0, 0)),
        },
      },
    });
    const invoiceNumber = `LD-${dateStr}-${String(orderCountToday + 1).padStart(4, '0')}`;

    // Waktu estimasi selesai
    const estimatedReadyAt = new Date(Date.now() + estimatedReadyHours * 3600 * 1000);

    // Cari shift kasir aktif di outlet untuk pelacakan kas laci
    const activeShift = await prisma.shift.findFirst({
      where: {
        tenantId,
        outletId,
        status: ShiftStatus.OPEN,
        ...(userId ? { userId } : {}),
      },
    }) || await prisma.shift.findFirst({
      where: {
        tenantId,
        outletId,
        status: ShiftStatus.OPEN,
      },
    });

    // Simpan dalam transaksi Prisma atomic
    const createdOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          tenantId,
          outletId,
          userId,
          shiftId: activeShift?.id || null,
          customerId: effectiveCustomerId,
          invoiceNumber,
          orderStatus: OrderStatus.CONFIRMED,
          paymentStatus,
          orderType: isDelivery ? 'DELIVERY' : 'SERVICES',
          channel: isDelivery ? 'DELIVERY' : 'DIRECT_STORE',
          subtotal,
          serviceTotal: effectiveDeliveryFee,
          discountTotal: effectiveDiscount,
          totalAmount: grandTotal,
          paidAmount,
          changeAmount: 0,
          notes: formattedNotes || null,
          items: {
            create: orderItemsData,
          },
        },
      });

      // Buat detail khusus laundry
      const laundryDetail = await tx.laundryOrderDetail.create({
        data: {
          orderId: order.id,
          tenantId,
          outletId,
          status: 'RECEIVED',
          currentStage: 'DROP_OFF',
          totalWeightKg: totalWeightKg > 0 ? totalWeightKg : null,
          initialWeightKg: totalWeightKg > 0 ? totalWeightKg : null,
          totalPieces,
          perfumeVariant,
          estimatedReadyAt,
          customerNotes: formattedNotes || null,
          deliveryType,
          deliveryStatus: initialDeliveryStatus,
          deliveryFee: effectiveDeliveryFee,
          deliveryZoneName: deliveryZoneName || null,
          deliveryAddress: effectiveAddress || null,
          deliveryNotes: deliveryNotes || null,
          deliveryScheduledAt: deliveryScheduledAt ? new Date(deliveryScheduledAt) : null,
          courierName: courierName || null,
          courierPhone: courierPhone || null,
        },
      });

      // 1. Catat penggunaan promo jika ada voucher aktif
      if (validPromotion && promoDiscount > 0) {
        await promotionService.recordUsage(
          tx,
          tenantId,
          validPromotion.id,
          order.id,
          promoDiscount,
          effectiveCustomerId
        );
      }

      // 2. Potong poin pelanggan jika melakukan penukaran poin belanja
      if (requestedPointsToRedeem > 0 && effectiveCustomerId) {
        await loyaltyService.redeemPoints(
          {
            tenantId,
            customerId: effectiveCustomerId,
            orderId: order.id,
            pointsToRedeem: requestedPointsToRedeem,
            subtotal,
          },
          tx,
          loyaltyConfig
        );
      }

      // 3. Berikan reward poin jika pesanan langsung lunas di kasir
      if (paymentStatus === PaymentStatus.PAID) {
        await awardLaundryOrderPointsIfEligible(
          tx,
          tenantId,
          outletId,
          effectiveCustomerId,
          order.id,
          grandTotal
        );
      }

      // Catat log stage awal (1. DROP_OFF) untuk audit trail produksi & KPI kasir
      await tx.laundryStageLog.create({
        data: {
          tenantId,
          orderId: order.id,
          laundryDetailId: laundryDetail.id,
          stage: 'DROP_OFF',
          operatorId: userId,
          operatorName: (req.user as any)?.name || 'Kasir Drop-off',
          weightKg: totalWeightKg > 0 ? totalWeightKg : null,
          piecesCount: totalPieces,
          completedAt: new Date(),
          durationMinutes: 0,
          notes: 'Penerimaan pakaian & penimbangan awal di kasir',
        },
      });

      // Catat piutang CustomerDebt jika belum lunas penuh dan pelanggan terdaftar
      const remainingAmount = grandTotal - paidAmount;
      if (remainingAmount > 0 && effectiveCustomerId) {
        const defaultDueDays = 7;
        const resolvedDueDate = new Date();
        resolvedDueDate.setDate(resolvedDueDate.getDate() + defaultDueDays);

        await tx.customerDebt.create({
          data: {
            tenantId,
            outletId,
            customerId: effectiveCustomerId,
            orderId: order.id,
            totalAmount: grandTotal,
            paidAmount,
            remainingAmount,
            dueDate: resolvedDueDate,
            status: paidAmount > 0 ? 'PARTIAL' : 'UNPAID',
            notes: `Piutang laundry nota ${order.invoiceNumber}${isDelivery ? ' (termasuk ongkir)' : ''}`,
          },
        });
      }

      // Catat transaksi pembayaran jika ada pembayaran di awal
      if (paidAmount > 0 && paymentMethod !== 'UNPAID') {
        let method: PaymentMethod = PaymentMethod.CASH;
        if (paymentMethod === 'QRIS') {
          method = PaymentMethod.QRIS;
        } else if (paymentMethod === 'TRANSFER') {
          method = PaymentMethod.BANK_TRANSFER;
        } else if (paymentMethod === 'CUSTOMER_DEPOSIT') {
          method = PaymentMethod.CUSTOMER_DEPOSIT;
          if (!effectiveCustomerId) {
            throw new BusinessValidationError('Pelanggan wajib dipilih untuk pembayaran menggunakan saldo deposit');
          }
          const wallet = await tx.customerLaundryWallet.findUnique({
            where: { tenantId_customerId: { tenantId, customerId: effectiveCustomerId } },
          });
          if (!wallet || Number(wallet.balanceAmount) < paidAmount) {
            throw new BusinessValidationError(`Saldo deposit pelanggan tidak mencukupi (Sisa: Rp ${Number(wallet?.balanceAmount || 0).toLocaleString('id-ID')}, Butuh: Rp ${paidAmount.toLocaleString('id-ID')})`);
          }
          if (wallet.balanceExpiresAt && new Date(wallet.balanceExpiresAt) < new Date()) {
            throw new BusinessValidationError('Masa berlaku saldo deposit pelanggan telah kedaluwarsa');
          }
          const balanceBefore = Number(wallet.balanceAmount);
          const balanceAfter = balanceBefore - paidAmount;
          await tx.customerLaundryWallet.update({
            where: { id: wallet.id },
            data: { balanceAmount: balanceAfter },
          });
          await tx.customerLaundryWalletLedger.create({
            data: {
              walletId: wallet.id,
              tenantId,
              outletId,
              orderId: order.id,
              shiftId: activeShift?.id || null,
              cashierId: userId,
              ledgerType: 'USE_BALANCE',
              deltaAmount: -paidAmount,
              balanceBefore,
              balanceAfter,
              notes: `Pemakaian saldo deposit untuk nota ${order.invoiceNumber}`,
            },
          });
        } else if (paymentMethod === 'LAUNDRY_QUOTA') {
          method = PaymentMethod.LAUNDRY_QUOTA;
          if (!effectiveCustomerId) {
            throw new BusinessValidationError('Pelanggan wajib dipilih untuk pembayaran menggunakan kuota kiloan');
          }
          const wallet = await tx.customerLaundryWallet.findUnique({
            where: { tenantId_customerId: { tenantId, customerId: effectiveCustomerId } },
          });
          const neededKg = totalWeightKg > 0 ? totalWeightKg : 1;
          if (!wallet || Number(wallet.quotaKg) < neededKg) {
            throw new BusinessValidationError(`Kuota kiloan pelanggan tidak mencukupi (Sisa: ${Number(wallet?.quotaKg || 0)} Kg, Butuh: ${neededKg} Kg)`);
          }
          if (wallet.quotaExpiresAt && new Date(wallet.quotaExpiresAt) < new Date()) {
            throw new BusinessValidationError('Masa berlaku kuota kiloan pelanggan telah kedaluwarsa');
          }
          const kgBefore = Number(wallet.quotaKg);
          const kgAfter = kgBefore - neededKg;
          await tx.customerLaundryWallet.update({
            where: { id: wallet.id },
            data: { quotaKg: kgAfter },
          });
          await tx.customerLaundryWalletLedger.create({
            data: {
              walletId: wallet.id,
              tenantId,
              outletId,
              orderId: order.id,
              shiftId: activeShift?.id || null,
              cashierId: userId,
              ledgerType: 'USE_QUOTA_KG',
              deltaKg: -neededKg,
              kgBefore,
              kgAfter,
              notes: `Pemakaian kuota kiloan untuk nota ${order.invoiceNumber} (${neededKg} Kg)`,
            },
          });
        }

        await tx.paymentTransaction.create({
          data: {
            tenantId,
            orderId: order.id,
            shiftId: activeShift?.id || null,
            outletId,
            cashierId: userId || null,
            paymentMethod: method,
            amount: paidAmount,
            status: PaymentTxStatus.CAPTURED,
          },
        });
      }

      return { ...order, laundryDetail };
    });

    // =========================================================================
    // AUTO-WA DROPOFF + LINK TRACKING (NON-BLOCKING)
    // =========================================================================
    if (customerPhone && customerPhone.trim() && outletRecord) {
      try {
        const rc = (outletRecord.receiptConfig as any) || {};
        const isAutoWaDropoff = rc.autoSendWaOnDropoff !== false;
        if (isAutoWaDropoff) {
          const itemsCount = items.length;
          const primaryServiceName = items[0]?.name || 'Layanan Laundry';
          const serviceSummary =
            itemsCount > 1
              ? `${primaryServiceName} (+${itemsCount - 1} layanan)`
              : primaryServiceName;

          whatsAppService.sendLaundryNotification(
            {
              invoiceNumber,
              customerName: customerName.trim(),
              customerPhone: customerPhone.trim(),
              outlet: {
                name: outletRecord.name || 'Well Laundry',
                address: outletRecord.address,
                phone: outletRecord.phone,
                receiptConfig: outletRecord.receiptConfig,
              },
              servicesSummary: serviceSummary,
              perfume: perfumeVariant,
              grandTotal,
              remainingAmount: Math.max(0, grandTotal - paidAmount),
              status: 'RECEIVED',
              estimatedCompletionDate: estimatedReadyAt,
            },
            'DROPOFF'
          ).catch((waErr: any) => {
            console.warn('[AutoWA Dropoff] Gagal kirim WA otomatis:', waErr?.message);
          });
        }
      } catch (autoWaErr: any) {
        console.warn('[AutoWA Dropoff Trigger] Error non-blocking:', autoWaErr?.message);
      }
    }

    const responsePayload = {
      status: 'success',
      message: 'Nota penerimaan laundry berhasil dibuat',
      data: createdOrder,
    };

    if (idempotencyKey) {
      await idempotencyService.saveIdempotentResponse(tenantId, 'LAUNDRY_CHECKOUT', idempotencyKey, 201, responsePayload);
    }

    return res.status(201).json(responsePayload);
  } catch (error: any) {
    console.error('Error createLaundryOrder:', error);
    if (
      error.statusCode === 400 ||
      error.name === 'BusinessValidationError' ||
      (error.message &&
        (error.message.includes('Saldo deposit') ||
          error.message.includes('Kuota kiloan') ||
          error.message.includes('kedaluwarsa') ||
          error.message.includes('Pelanggan wajib dipilih')))
    ) {
      return res.status(400).json({ status: 'error', message: error.message });
    }
    return res.status(500).json({ status: 'error', message: 'Gagal membuat pesanan laundry' });
  }
};

export const updateLaundryStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // orderId atau detailId
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const parseResult = updateLaundryStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi status laundry gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { status, rackCode, pickedUpBy, paymentMethod } = parseResult.data;

    // Cari detail laundry berdasarkan id atau orderId
    const detail = await prisma.laundryOrderDetail.findFirst({
      where: {
        tenantId,
        OR: [{ id }, { orderId: id }],
      },
      include: { order: true },
    });

    if (!detail) {
      return res.status(404).json({ status: 'error', message: 'Data cucian laundry tidak ditemukan' });
    }

    const updatePayload: any = {
      status,
    };

    if (rackCode !== undefined) {
      updatePayload.rackCode = rackCode ? rackCode.toUpperCase().trim() : null;
    }

    if (status === 'READY_FOR_PICKUP') {
      if (!detail.completedAt) {
        updatePayload.completedAt = new Date();
      }
      if (['DELIVERY_ONLY', 'PICKUP_AND_DELIVERY', 'DELIVERY'].includes(detail.deliveryType)) {
        if (!['OUT_FOR_DELIVERY', 'DELIVERED'].includes(detail.deliveryStatus || '')) {
          updatePayload.deliveryStatus = 'READY_TO_DELIVER';
        }
      }
    }

    if (status === 'COMPLETED') {
      updatePayload.pickedUpAt = new Date();
      if (pickedUpBy) {
        updatePayload.pickedUpBy = pickedUpBy.trim();
      }
    }

    const updatedDetail = await prisma.$transaction(async (tx) => {
      const resDetail = await tx.laundryOrderDetail.update({
        where: { id: detail.id },
        data: updatePayload,
      });

      // Update order status jika selesai
      if (status === 'COMPLETED') {
        const orderDataToUpdate: any = { orderStatus: OrderStatus.COMPLETED };

        // Jika ada sisa tagihan yang belum lunas, otomatis lunasi saat penyerahan
        const currentPaid = Number(detail.order.paidAmount || 0);
        const total = Number(detail.order.totalAmount);
        const remaining = Math.max(0, total - currentPaid);

        if (detail.order.paymentStatus !== PaymentStatus.PAID || remaining > 0) {
          orderDataToUpdate.paymentStatus = PaymentStatus.PAID;
          orderDataToUpdate.paidAmount = total;

          if (remaining > 0) {
            const handoverShift = await tx.shift.findFirst({
              where: {
                tenantId,
                outletId: detail.outletId,
                status: ShiftStatus.OPEN,
                ...(userId ? { userId } : {}),
              },
            }) || await tx.shift.findFirst({
              where: {
                tenantId,
                outletId: detail.outletId,
                status: ShiftStatus.OPEN,
              },
            });

            const handoverMethod =
              paymentMethod === 'QRIS'
                ? PaymentMethod.QRIS
                : paymentMethod === 'TRANSFER'
                ? PaymentMethod.BANK_TRANSFER
                : PaymentMethod.CASH;

            await tx.paymentTransaction.create({
              data: {
                tenantId,
                orderId: detail.orderId,
                shiftId: handoverShift?.id || null,
                outletId: detail.outletId,
                cashierId: userId || null,
                paymentMethod: handoverMethod,
                amount: remaining,
                status: PaymentTxStatus.CAPTURED,
              },
            });

            // Sinkronkan pelunasan piutang (CustomerDebt) dan buat riwayat CustomerDebtPayment
            const existingDebt = await tx.customerDebt.findFirst({
              where: { tenantId, orderId: detail.orderId },
            });
            if (existingDebt) {
              await tx.customerDebt.update({
                where: { id: existingDebt.id },
                data: {
                  paidAmount: total,
                  remainingAmount: 0,
                  status: 'PAID',
                },
              });

              await tx.customerDebtPayment.create({
                data: {
                  tenantId,
                  debtId: existingDebt.id,
                  outletId: detail.outletId,
                  cashierId: userId || null,
                  shiftId: handoverShift?.id || null,
                  amount: remaining,
                  paymentMethod: handoverMethod,
                  notes: 'Pelunasan saat serah terima pakaian di outlet',
                },
              });
            }
          }
        }

        await tx.order.update({
          where: { id: detail.orderId },
          data: orderDataToUpdate,
        });

        // Kosongkan nomor rak penyimpanan saat pakaian sudah diserahkan ke pelanggan
        await tx.laundryOrderDetail.update({
          where: { id: detail.id },
          data: { rackCode: null },
        });

        // Berikan reward poin jika pesanan berstatus PAID
        if (orderDataToUpdate.paymentStatus === PaymentStatus.PAID || detail.order.paymentStatus === PaymentStatus.PAID) {
          await awardLaundryOrderPointsIfEligible(
            tx,
            tenantId,
            detail.outletId,
            detail.order.customerId,
            detail.order.id,
            Number(detail.order.totalAmount)
          );
        }
      }

      // Auto-BoM Deduction jika cucian masuk status WASHING_DRYING atau lebih lanjut dan belum dipotong
      const isWashOrBeyondStatus =
        status === 'WASHING_DRYING' ||
        status === 'IRONING_PACKING' ||
        status === 'READY_FOR_PICKUP' ||
        status === 'COMPLETED';

      if (isWashOrBeyondStatus && !detail.isBomDeducted) {
        await deductLaundryOrderBom(tx, detail, tenantId, userId);
      }

      return resDetail;
    });

    // Auto-Sender Notifikasi WhatsApp Gateway (Non-blocking background)
    if (status === 'READY_FOR_PICKUP') {
      triggerLaundryNotification(detail.orderId, 'READY', tenantId).catch((e) =>
        console.error('[AUTO WA READY TRIGGER FAILED]', e)
      );
    } else if (status === 'COMPLETED') {
      triggerLaundryNotification(detail.orderId, 'COMPLETED', tenantId).catch((e) =>
        console.error('[AUTO WA COMPLETED TRIGGER FAILED]', e)
      );
    }

    return res.status(200).json({
      status: 'success',
      message: `Status cucian berhasil diperbarui menjadi ${status}`,
      data: updatedDetail,
    });
  } catch (error: any) {
    console.error('Error updateLaundryStatus:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui status laundry' });
  }
};

/**
 * Helper pengirim notifikasi WhatsApp laundry
 */
export const triggerLaundryNotification = async (
  orderId: string,
  type: 'READY' | 'COMPLETED',
  tenantId: string,
  targetPhoneOverride?: string
) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        customer: true,
        outlet: true,
        items: true,
        laundryDetail: true,
      },
    });

    if (!order) {
      console.log(`[LAUNDRY WA SKIPPED] Order #${orderId} tidak ditemukan`);
      return { status: 'error' as const, message: 'Pesanan tidak ditemukan' };
    }

    const customerPhone = targetPhoneOverride || order.customer?.phone;
    if (!customerPhone) {
      console.log(`[LAUNDRY WA SKIPPED] Pelanggan untuk order #${order.invoiceNumber} tidak memiliki nomor telepon`);
      return { status: 'error' as const, message: 'Nomor WhatsApp pelanggan tidak ditemukan' };
    }

    const itemsSummary = (order.items || [])
      .map((it) => `${it.productName} x${it.quantity}`)
      .join(', ');

    const grandTotal = Number(order.totalAmount);
    const paidAmount = Number(order.paidAmount || 0);
    const remainingAmount = Math.max(0, grandTotal - paidAmount);

    const notificationData: LaundryNotificationData = {
      invoiceNumber: order.invoiceNumber,
      customerName: order.customer?.name || 'Pelanggan',
      customerPhone,
      outlet: {
        name: order.outlet?.name || 'Well Laundry',
        address: order.outlet?.address,
        phone: order.outlet?.phone,
        receiptConfig: order.outlet?.receiptConfig,
      },
      servicesSummary: itemsSummary || 'Layanan Laundry',
      perfume: order.laundryDetail?.perfumeVariant,
      rackCode: order.laundryDetail?.rackCode,
      grandTotal,
      remainingAmount,
      status: order.laundryDetail?.status || 'READY_FOR_PICKUP',
      estimatedCompletionDate: order.laundryDetail?.estimatedReadyAt,
    };

    const res = await whatsAppService.sendLaundryNotification(
      notificationData,
      type,
      customerPhone
    );
    console.log(`[LAUNDRY WA RESULT] Order #${order.invoiceNumber} -> ${type}:`, res.message);
    return res;
  } catch (err: any) {
    console.error(`[LAUNDRY WA ERROR] Failed to send ${type} notification:`, err);
    return { status: 'error' as const, message: err.message || 'Gagal mengirim pesan WhatsApp' };
  }
};

/**
 * Controller endpoint manual trigger / resend WhatsApp Notifikasi dari dashboard kasir
 */
export const sendLaundryWhatsApp = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const { type = 'READY', phoneOverride } = req.body;

    // Cari orderId jika id yang diberikan adalah detailId
    const detail = await prisma.laundryOrderDetail.findFirst({
      where: {
        tenantId,
        OR: [{ id }, { orderId: id }],
      },
    });

    const targetOrderId = detail?.orderId || id;

    const result = await triggerLaundryNotification(
      targetOrderId,
      type === 'COMPLETED' ? 'COMPLETED' : 'READY',
      tenantId,
      phoneOverride
    );

    if (!result) {
      return res.status(400).json({
        status: 'error',
        message: 'Gagal mengirim pesan: data pesanan atau nomor pelanggan tidak ditemukan',
      });
    }

    return res.status(result.status === 'success' ? 200 : 400).json(result);
  } catch (error: any) {
    console.error('Error sendLaundryWhatsApp:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memproses pengiriman WhatsApp' });
  }
};

// ==========================================
// 6. MULTI-CABANG & MODE WORKSHOP (MANIFEST SURAT JALAN)
// ==========================================

const createLaundryManifestSchema = z.object({
  sourceOutletId: z.string().uuid('ID Toko asal tidak valid'),
  targetOutletId: z.string().uuid('ID Toko/Workshop tujuan tidak valid'),
  direction: z.enum(['TO_WORKSHOP', 'TO_OUTLET']).default('TO_WORKSHOP'),
  driverName: z.string().optional().nullable(),
  vehiclePlate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  orderIds: z.array(z.string()).min(1, 'Pilih minimal 1 pesanan untuk surat jalan'),
});

/**
 * Mengambil daftar manifest surat jalan pengiriman cucian antar-outlet/workshop
 */
export const getLaundryManifests = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const { sourceOutletId, targetOutletId, status, direction } = req.query;

    const where: any = { tenantId };
    if (sourceOutletId && typeof sourceOutletId === 'string') {
      where.sourceOutletId = sourceOutletId;
    }
    if (targetOutletId && typeof targetOutletId === 'string') {
      where.targetOutletId = targetOutletId;
    }
    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }
    if (direction && typeof direction === 'string' && direction !== 'ALL') {
      where.direction = direction;
    }

    const manifests = await prisma.laundryTransferManifest.findMany({
      where,
      include: {
        sourceOutlet: { select: { id: true, name: true, address: true, phone: true } },
        targetOutlet: { select: { id: true, name: true, address: true, phone: true, isWorkshop: true } },
        items: {
          include: {
            order: {
              include: {
                customer: true,
                items: true,
                laundryDetail: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      status: 'success',
      data: manifests,
    });
  } catch (error: any) {
    console.error('Error getLaundryManifests:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil daftar manifest cucian' });
  }
};

/**
 * Membuat Manifest Surat Jalan Baru (Kirim Cucian ke Workshop atau Balik ke Outlet)
 */
export const createLaundryManifest = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const parseResult = createLaundryManifestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi form surat jalan manifest gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { sourceOutletId, targetOutletId, direction, driverName, vehiclePlate, notes, orderIds } =
      parseResult.data;

    if (sourceOutletId === targetOutletId) {
      return res.status(400).json({
        status: 'error',
        message: 'Toko asal dan Toko/Workshop tujuan tidak boleh sama',
      });
    }

    // Ambil detail pesanan yang akan dimasukkan ke manifest
    const orders = await prisma.order.findMany({
      where: {
        id: { in: orderIds },
        tenantId,
      },
      include: {
        laundryDetail: true,
      },
    });

    if (orders.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Tidak ada nota cucian valid yang ditemukan untuk dimasukkan ke manifest',
      });
    }

    // Hitung total berat akumulatif
    let totalWeightKg = 0;
    orders.forEach((o) => {
      if (o.laundryDetail?.totalWeightKg) {
        totalWeightKg += Number(o.laundryDetail.totalWeightKg);
      }
    });

    // Nomor Manifest Generator: MAN-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(
      today.getDate()
    ).padStart(2, '0')}`;
    const countToday = await prisma.laundryTransferManifest.count({
      where: {
        tenantId,
        createdAt: {
          gte: new Date(today.setHours(0, 0, 0, 0)),
        },
      },
    });
    const manifestNumber = `MAN-${dateStr}-${String(countToday + 1).padStart(4, '0')}`;

    const createdManifest = await prisma.$transaction(async (tx) => {
      const manifest = await tx.laundryTransferManifest.create({
        data: {
          tenantId,
          manifestNumber,
          sourceOutletId,
          targetOutletId,
          direction,
          driverName: driverName?.trim() || null,
          vehiclePlate: vehiclePlate?.trim() || null,
          notes: notes?.trim() || null,
          totalOrdersCount: orders.length,
          totalWeightKg: totalWeightKg > 0 ? totalWeightKg : null,
          status: 'DISPATCHED',
          items: {
            create: orders.map((o) => ({
              orderId: o.id,
            })),
          },
        },
        include: {
          items: true,
          sourceOutlet: true,
          targetOutlet: true,
        },
      });

      // Update transfer_status pada laundry_order_details
      const nextTransferStatus = direction === 'TO_WORKSHOP' ? 'IN_TRANSIT_TO_WORKSHOP' : 'IN_TRANSIT_TO_OUTLET';
      for (const ord of orders) {
        if (ord.laundryDetail) {
          await tx.laundryOrderDetail.update({
            where: { id: ord.laundryDetail.id },
            data: {
              transferStatus: nextTransferStatus,
              ...(direction === 'TO_WORKSHOP' ? { workshopOutletId: targetOutletId } : {}),
            },
          });
        }
      }

      return manifest;
    });

    return res.status(201).json({
      status: 'success',
      message: `Surat jalan ${manifestNumber} berhasil diterbitkan`,
      data: createdManifest,
    });
  } catch (error: any) {
    console.error('Error createLaundryManifest:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal membuat surat jalan manifest cucian' });
  }
};

/**
 * Menerima Manifest Cucian di Tujuan (Workshop atau Outlet Asal)
 */
export const receiveLaundryManifest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const { receivedBy } = req.body;

    const manifest = await prisma.laundryTransferManifest.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
      },
    });

    if (!manifest) {
      return res.status(404).json({ status: 'error', message: 'Surat jalan manifest tidak ditemukan' });
    }

    if (manifest.status === 'RECEIVED') {
      return res.status(400).json({ status: 'error', message: 'Surat jalan ini sudah pernah diterima sebelumnya' });
    }

    const orderIds = manifest.items.map((it) => it.orderId);
    const receiver = receivedBy?.trim() || req.user?.name || 'Staf Penerima';

    const updated = await prisma.$transaction(async (tx) => {
      const updatedManifest = await tx.laundryTransferManifest.update({
        where: { id: manifest.id },
        data: {
          status: 'RECEIVED',
          receivedAt: new Date(),
          receivedBy: receiver,
        },
      });

      // Update transferStatus cucian
      const nextTransferStatus = manifest.direction === 'TO_WORKSHOP' ? 'AT_WORKSHOP' : 'AT_OUTLET';

      for (const oId of orderIds) {
        const detail = await tx.laundryOrderDetail.findFirst({
          where: { orderId: oId, tenantId },
        });
        if (detail) {
          const updateData: any = { transferStatus: nextTransferStatus };

          // Jika tiba di workshop dan status masih RECEIVED, naikkan otomatis ke WASHING_DRYING
          if (manifest.direction === 'TO_WORKSHOP' && detail.status === 'RECEIVED') {
            updateData.status = 'WASHING_DRYING';
          }

          await tx.laundryOrderDetail.update({
            where: { id: detail.id },
            data: updateData,
          });
        }
      }

      return updatedManifest;
    });

    return res.status(200).json({
      status: 'success',
      message: `Surat jalan ${manifest.manifestNumber} berhasil dikonfirmasi diterima oleh ${receiver}`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error receiveLaundryManifest:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menerima surat jalan manifest' });
  }
};

/**
 * Mengambil daftar pesanan yang siap dimasukkan ke Surat Jalan Manifest
 */
export const getAvailableOrdersForManifest = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const { outletId, direction = 'TO_WORKSHOP' } = req.query;
    if (!outletId || typeof outletId !== 'string') {
      return res.status(400).json({ status: 'error', message: 'ID Toko wajib disertakan' });
    }

    let where: any = {
      tenantId,
    };

    if (direction === 'TO_WORKSHOP') {
      // Nota yang ada di outlet penerima dan belum dikirim / selesai
      where.outletId = outletId;
      where.status = { notIn: ['COMPLETED', 'READY_FOR_PICKUP'] };
      where.OR = [
        { transferStatus: 'AT_OUTLET' },
        { transferStatus: null },
      ];
    } else {
      // Nota yang sedang diproses di workshop dan siap dikirim balik ke outlet asal
      where.workshopOutletId = outletId;
      where.transferStatus = 'AT_WORKSHOP';
      where.status = { in: ['IRONING_PACKING', 'READY_FOR_PICKUP'] };
    }

    const details = await prisma.laundryOrderDetail.findMany({
      where,
      include: {
        order: {
          include: {
            customer: true,
            items: true,
          },
        },
        outlet: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = details.map((d) => ({
      id: d.id,
      orderId: d.orderId,
      invoiceNumber: d.order.invoiceNumber,
      customerName: d.order.customer?.name || 'Pelanggan',
      serviceName: d.order.items[0]?.productName || 'Layanan Laundry',
      totalWeightKg: d.totalWeightKg ? Number(d.totalWeightKg) : null,
      totalPieces: d.totalPieces,
      status: d.status,
      perfumeVariant: d.perfumeVariant,
      outletName: d.outlet?.name,
      createdAt: d.createdAt,
    }));

    return res.status(200).json({
      status: 'success',
      data: formatted,
    });
  } catch (error: any) {
    console.error('Error getAvailableOrdersForManifest:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil pesanan siap transfer' });
  }
};

/**
 * Mengambil daftar toko/outlet dan workshop untuk keperluan mutasi antar-cabang
 */
export const getLaundryWorkshops = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const outlets = await prisma.outlet.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone: true,
        isWarehouse: true,
        isWorkshop: true,
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      status: 'success',
      data: outlets,
    });
  } catch (error: any) {
    console.error('Error getLaundryWorkshops:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil daftar workshop' });
  }
};

/**
 * Mengubah role outlet (Toko Retail vs Workshop Pabrik Cuci)
 */
export const toggleOutletWorkshopMode = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const role = (req.user?.role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(role)) {
      return res.status(403).json({ status: 'error', message: 'Hanya Owner, Admin, atau Supervisor yang dapat mengubah mode workshop' });
    }

    const { isWorkshop } = req.body;

    const existing = await prisma.outlet.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Outlet tidak ditemukan' });
    }

    const updated = await prisma.outlet.update({
      where: { id },
      data: { isWorkshop: Boolean(isWorkshop) },
    });

    return res.status(200).json({
      status: 'success',
      message: `Status workshop outlet ${updated.name} berhasil diperbarui`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error toggleOutletWorkshopMode:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengubah status workshop outlet' });
  }
};

// ==========================================
// 7. SISTEM 11 TAHAPAN WORKFLOW PRODUKSI & KPI OPERATOR
// ==========================================

export interface ProductionStageDefinition {
  key: string;            // e.g. 'LABEL', 'SORTIR', 'CLEANING', 'SPOTTING', 'DETAILING', 'CUCI', 'KERING', 'SETRIKA', 'EXTRA_SETRIKA', 'LIPAT', 'PENGEMASAN'
  code?: string;          // e.g. '2000', '3000', '3100', '4000', '4100', '5000', '6000', '7000', '7100', '7200', '8000'
  name: string;           // e.g. 'Label & Tagging', 'Sortir & QC Helai', etc.
  sequence: number;       // 1, 2, 3, ...
  isActive: boolean;      // true / false
  isDefault?: boolean;
  macroStatus: string;    // 'RECEIVED' | 'WASHING_DRYING' | 'IRONING_PACKING' | 'READY_FOR_PICKUP' | 'COMPLETED'
  description?: string;
  icon?: string;
}

export const DEFAULT_PRODUCTION_STAGES: ProductionStageDefinition[] = [
  { key: 'LABEL', code: '2000', name: 'Label & Tagging', sequence: 1, isActive: true, isDefault: true, macroStatus: 'RECEIVED', icon: 'Tag', description: 'Pemasangan tag label barcode pita anti-luntur pada pakaian' },
  { key: 'SORTIR', code: '3000', name: 'Sortir & QC Helai', sequence: 2, isActive: true, isDefault: true, macroStatus: 'RECEIVED', icon: 'Filter', description: 'Penghitungan jumlah helai, pemisahan warna/bahan, dan cek kendala fisik' },
  { key: 'CLEANING', code: '3100', name: 'Cleaning (Pembersihan Awal)', sequence: 3, isActive: true, isDefault: true, macroStatus: 'RECEIVED', icon: 'Sparkles', description: 'Pembersihan awal untuk kotoran berat, sepatu, tas, atau stroller' },
  { key: 'SPOTTING', code: '4000', name: 'Spotting (Treatment Noda)', sequence: 4, isActive: true, isDefault: true, macroStatus: 'RECEIVED', icon: 'ShieldAlert', description: 'Penanganan noda membandel (darah, tinta, karat, minyak) dengan bahan kimia khusus' },
  { key: 'DETAILING', code: '4100', name: 'Detailing & Proteksi', sequence: 5, isActive: true, isDefault: true, macroStatus: 'RECEIVED', icon: 'Wrench', description: 'Perawatan detail kancing, resleting, unyellowing sepatu, dan proteksi kain' },
  { key: 'CUCI', code: '5000', name: 'Cuci (Washing)', sequence: 6, isActive: true, isDefault: true, macroStatus: 'WASHING_DRYING', icon: 'Waves', description: 'Pencucian pakaian pada mesin washer / extractor sesuai takaran deterjen' },
  { key: 'KERING', code: '6000', name: 'Kering (Drying)', sequence: 7, isActive: true, isDefault: true, macroStatus: 'WASHING_DRYING', icon: 'Wind', description: 'Pengeringan pada mesin dryer tumbler dengan temperatur aman serat kain' },
  { key: 'SETRIKA', code: '7000', name: 'Setrika Uap (Ironing)', sequence: 8, isActive: true, isDefault: true, macroStatus: 'IRONING_PACKING', icon: 'Flame', description: 'Penyetrikaan uap boiler bertekanan tinggi hingga rapi dan licin' },
  { key: 'EXTRA_SETRIKA', code: '7100', name: 'Extra Setrika / Finishing', sequence: 9, isActive: true, isDefault: true, macroStatus: 'IRONING_PACKING', icon: 'Sparkles', description: 'Finishing khusus jas, gaun, kebaya, lipatan gorden, atau pewangi ekstra' },
  { key: 'LIPAT', code: '7200', name: 'Lipat (Folding)', sequence: 10, isActive: true, isDefault: true, macroStatus: 'IRONING_PACKING', icon: 'Layers', description: 'Pelipatan rapi sesuai standar dimensi kemasan' },
  { key: 'PENGEMASAN', code: '8000', name: 'Pengemasan & Rak (Packing)', sequence: 11, isActive: true, isDefault: true, macroStatus: 'READY_FOR_PICKUP', icon: 'Package', description: 'Penyemprotan parfum wangi, segel plastik higienis, dan simpan di rak' },
];

export const LAUNDRY_11_STAGES = [
  { key: 'DROP_OFF', sequence: 1, label: '1. Drop-off (Timbang)', macroStatus: 'RECEIVED', icon: 'Scale' },
  { key: 'TAGGING', sequence: 2, label: '2. Label / Tagging', macroStatus: 'RECEIVED', icon: 'Tag' },
  { key: 'SORTING', sequence: 3, label: '3. Sortir (Warna/Bahan)', macroStatus: 'RECEIVED', icon: 'Filter' },
  { key: 'SPOTTING', sequence: 4, label: '4. Spotting (Noda)', macroStatus: 'RECEIVED', icon: 'Sparkles' },
  { key: 'WASHING', sequence: 5, label: '5. Cuci (Washing)', macroStatus: 'WASHING_DRYING', icon: 'Waves' },
  { key: 'DRYING', sequence: 6, label: '6. Kering (Drying)', macroStatus: 'WASHING_DRYING', icon: 'Wind' },
  { key: 'IRONING', sequence: 7, label: '7. Setrika (Ironing)', macroStatus: 'IRONING_PACKING', icon: 'Flame' },
  { key: 'FOLDING', sequence: 8, label: '8. Lipat (Folding)', macroStatus: 'IRONING_PACKING', icon: 'Layers' },
  { key: 'PACKING', sequence: 9, label: '9. Packing & Parfum', macroStatus: 'IRONING_PACKING', icon: 'Package' },
  { key: 'RACK_STORAGE', sequence: 10, label: '10. Masuk Rak (Siap Ambil)', macroStatus: 'READY_FOR_PICKUP', icon: 'Archive' },
  { key: 'HANDOVER', sequence: 11, label: '11. Penyerahan (Selesai)', macroStatus: 'COMPLETED', icon: 'CheckCircle2' },
] as const;

/**
 * Helper: Pemotongan Stok Bahan Cuci Otomatis (Auto-BoM Deduction)
 * Dijalankan saat cucian masuk ke proses cuci (WASHING / CUCI / WASHING_DRYING atau tahapan sesudahnya)
 * Idempotent: hanya dieksekusi 1x (is_bom_deducted: false -> true)
 */
export async function deductLaundryOrderBom(
  tx: Prisma.TransactionClient,
  detail: any,
  tenantId: string,
  userId?: string | null
) {
  if (detail.isBomDeducted) {
    return { deducted: false, reason: 'ALREADY_DEDUCTED' };
  }

  // 1. Ambil order dengan relasi items jika belum ada
  let orderItems = detail.order?.items;
  let invoiceNumber = detail.order?.invoiceNumber;
  if (!orderItems || orderItems.length === 0) {
    const fullOrder = await tx.order.findUnique({
      where: { id: detail.orderId },
      include: { items: true },
    });
    orderItems = fullOrder?.items || [];
    invoiceNumber = fullOrder?.invoiceNumber;
  }

  if (orderItems.length === 0) {
    await tx.laundryOrderDetail.update({
      where: { id: detail.id },
      data: { isBomDeducted: true, bomDeductedAt: new Date() },
    });
    return { deducted: false, reason: 'NO_ITEMS' };
  }

  // 2. Resolusi lokasi penyimpanan (default storage location outlet)
  let storageLoc = await tx.storageLocation.findFirst({
    where: { tenantId, outletId: detail.outletId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });

  if (!storageLoc) {
    storageLoc = await tx.storageLocation.create({
      data: {
        tenantId,
        outletId: detail.outletId,
        name: 'Gudang Utama & Dapur',
        isDefault: true,
      },
    });
  }

  // 3. Cari layanan laundry utama (via laundryServiceId terlebih dahulu, fallback ke nama item)
  const serviceIds = orderItems.map((i: any) => i.laundryServiceId).filter(Boolean);
  const itemNames = orderItems.map((i: any) => i.productName);

  const matchedServices = await tx.laundryService.findMany({
    where: {
      tenantId,
      OR: [
        ...(serviceIds.length > 0 ? [{ id: { in: serviceIds } }] : []),
        { name: { in: itemNames } },
      ],
    },
    include: {
      bomItems: {
        include: {
          inventoryItem: true,
        },
      },
    },
  });

  // 4. Cari juga add-on dari addonsSnapshot pada order items
  const allAddons: Array<{ addon: any; parentItemQty: number; parentItemUnit: string }> = [];
  for (const item of orderItems) {
    let addons = (item.addonsSnapshot as any) || [];
    if (typeof addons === 'string') {
      try { addons = JSON.parse(addons); } catch (_) { addons = []; }
    }
    if (Array.isArray(addons)) {
      for (const addon of addons) {
        allAddons.push({
          addon,
          parentItemQty: Number(item.quantity || 1),
          parentItemUnit: item.unit || 'PCS',
        });
      }
    }
  }

  let matchedAddonServices: any[] = [];
  const addonIds = allAddons.map((a) => a.addon.id).filter(Boolean);
  const addonNames = allAddons.map((a) => a.addon.name).filter(Boolean);
  if (addonIds.length > 0 || addonNames.length > 0) {
    matchedAddonServices = await tx.laundryService.findMany({
      where: {
        tenantId,
        OR: [
          ...(addonIds.length > 0 ? [{ id: { in: addonIds } }] : []),
          { name: { in: addonNames } },
        ],
      },
      include: {
        bomItems: {
          include: {
            inventoryItem: true,
          },
        },
      },
    });
  }

  // 5. Cari master parfum untuk tenant ini
  const perfumes = await tx.laundryPerfume.findMany({
    where: { tenantId, isActive: true },
    include: { inventoryItem: true },
  });

  const consumptionMap = new Map<string, { qty: number; avgCost: number; itemName: string; uom: string; serviceNames: string[] }>();

  // Helper untuk menambah ke consumptionMap
  const addConsumption = (
    inventoryItemId: string,
    qty: number,
    avgCost: number,
    itemName: string,
    uom: string,
    sourceName: string,
    isPerOrder = false
  ) => {
    if (qty <= 0) return;
    const existing = consumptionMap.get(inventoryItemId);
    if (existing) {
      if (!isPerOrder) {
        existing.qty += qty;
      }
      if (!existing.serviceNames.includes(sourceName)) {
        existing.serviceNames.push(sourceName);
      }
    } else {
      consumptionMap.set(inventoryItemId, {
        qty,
        avgCost,
        itemName,
        uom,
        serviceNames: [sourceName],
      });
    }
  };

  // A. Hitung BoM Layanan Utama
  for (const service of matchedServices) {
    if (!service.bomItems || service.bomItems.length === 0) continue;

    const matchingOrderItems = orderItems.filter((i: any) =>
      (i.laundryServiceId && i.laundryServiceId === service.id) ||
      (!i.laundryServiceId && i.productName.toLowerCase() === service.name.toLowerCase())
    );
    if (matchingOrderItems.length === 0) continue;

    const orderItemQty = matchingOrderItems.reduce((acc: number, cur: any) => acc + Number(cur.quantity || 1), 0);
    const effectiveUnits = (service.unit === 'KG' && detail.totalWeightKg && Number(detail.totalWeightKg) > 0)
      ? Number(detail.totalWeightKg)
      : Math.max(1, orderItemQty);

    for (const bom of service.bomItems) {
      const perUnitQty = Number(bom.quantityPerUnit);
      const isPerOrder = bom.consumptionBasis === 'PER_ORDER';
      const consumedQty = isPerOrder ? perUnitQty : perUnitQty * effectiveUnits;

      addConsumption(
        bom.inventoryItemId,
        consumedQty,
        Number(bom.inventoryItem.averageCost || 0),
        bom.inventoryItem.name,
        bom.inventoryItem.canonicalUom,
        service.name,
        isPerOrder
      );
    }
  }

  // B. Hitung BoM Add-on
  for (const { addon, parentItemQty } of allAddons) {
    const addonService = matchedAddonServices.find((s) =>
      (addon.id && s.id === addon.id) ||
      (addon.name && s.name.toLowerCase() === addon.name.toLowerCase())
    );
    if (!addonService || !addonService.bomItems || addonService.bomItems.length === 0) continue;

    const isPerUnit = ['PER_KG', 'PER_UNIT', 'KG'].includes((addon.unit || '').toUpperCase());
    const effectiveUnits = isPerUnit ? parentItemQty : 1;

    for (const bom of addonService.bomItems) {
      const perUnitQty = Number(bom.quantityPerUnit);
      const isPerOrder = bom.consumptionBasis === 'PER_ORDER';
      const consumedQty = isPerOrder ? perUnitQty : perUnitQty * effectiveUnits;

      addConsumption(
        bom.inventoryItemId,
        consumedQty,
        Number(bom.inventoryItem.averageCost || 0),
        bom.inventoryItem.name,
        bom.inventoryItem.canonicalUom,
        `Add-on: ${addon.name}`,
        isPerOrder
      );
    }
  }

  // C. Hitung Auto-Potong Parfum
  const processedPerOrderPerfumes = new Set<string>();
  for (const item of orderItems) {
    const chosenPerfumeName = (item.perfumeVariant || detail.perfumeVariant || '').trim();
    if (!chosenPerfumeName || chosenPerfumeName.toLowerCase() === 'tanpa parfum') continue;

    const perfume = perfumes.find((p) => p.name.toLowerCase() === chosenPerfumeName.toLowerCase());
    if (!perfume || !perfume.inventoryItemId || !perfume.inventoryItem || Number(perfume.usageQtyPerUnit) <= 0) continue;

    const isPerOrder = perfume.usageBasis === 'PER_ORDER';
    if (isPerOrder && processedPerOrderPerfumes.has(perfume.id)) {
      continue;
    }
    if (isPerOrder) {
      processedPerOrderPerfumes.add(perfume.id);
    }

    const itemWeightOrQty = item.unit === 'KG'
      ? Number(item.quantity || (detail.totalWeightKg ? Number(detail.totalWeightKg) : 1))
      : 1;
    const consumedQty = isPerOrder ? Number(perfume.usageQtyPerUnit) : Number(perfume.usageQtyPerUnit) * itemWeightOrQty;

    addConsumption(
      perfume.inventoryItemId,
      consumedQty,
      Number(perfume.inventoryItem.averageCost || 0),
      perfume.inventoryItem.name,
      perfume.inventoryItem.canonicalUom,
      `Parfum: ${perfume.name}`,
      isPerOrder
    );
  }

  if (consumptionMap.size === 0) {
    await tx.laundryOrderDetail.update({
      where: { id: detail.id },
      data: { isBomDeducted: true, bomDeductedAt: new Date() },
    });
    return { deducted: false, reason: 'NO_BOM_CONFIGURED' };
  }

  // 6. Potong stok di InventoryBalance dan catat InventoryLedger
  for (const [inventoryItemId, data] of consumptionMap.entries()) {
    if (data.qty <= 0) continue;

    let bal = await tx.inventoryBalance.findFirst({
      where: {
        tenantId,
        storageLocationId: storageLoc.id,
        inventoryItemId,
      },
    });

    const balanceBefore = Number(bal?.quantityOnHand || 0);
    const balanceAfter = balanceBefore - data.qty;

    if (bal) {
      await tx.inventoryBalance.update({
        where: { id: bal.id },
        data: { quantityOnHand: balanceAfter },
      });
    } else {
      await tx.inventoryBalance.create({
        data: {
          tenantId,
          storageLocationId: storageLoc.id,
          inventoryItemId,
          quantityOnHand: balanceAfter,
          quantityReserved: 0,
        },
      });
    }

    await tx.inventoryLedger.create({
      data: {
        tenantId,
        storageLocationId: storageLoc.id,
        inventoryItemId,
        quantityDelta: -data.qty,
        balanceBefore,
        balanceAfter,
        unitCost: data.avgCost,
        movementType: 'PRODUCTION_CONSUMPTION',
        referenceType: 'ORDER',
        referenceId: detail.orderId,
        actorType: userId ? 'USER' : 'SYSTEM',
        actorUserId: userId || null,
        notes: `Auto-BoM Bahan Cuci (${data.qty} ${data.uom}) Nota #${invoiceNumber || detail.orderId} [${data.serviceNames.join(', ')}]`,
      },
    });
  }

  // Tandai detail bahwa BoM sudah dipotong
  await tx.laundryOrderDetail.update({
    where: { id: detail.id },
    data: {
      isBomDeducted: true,
      bomDeductedAt: new Date(),
    },
  });

  return { deducted: true, itemsCount: consumptionMap.size };
}

/**
 * Memajukan pengerjaan cucian ke tahapan berikutnya dari alur produksi riil (mendukung tahapan kustom toko)
 */
export const advanceLaundryStage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const { nextStage, operatorId, operatorName, notes, rackCode, pickedUpBy, paymentMethod, machineName } = req.body;
    if (!nextStage) {
      return res.status(400).json({ status: 'error', message: 'Tahapan produksi (nextStage) wajib dipilih' });
    }

    // Ambil tahapan aktif dari tenant atau gunakan default
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { laundryStages: true },
    });
    const tenantStages: ProductionStageDefinition[] = (Array.isArray(tenant?.laundryStages) && tenant.laundryStages.length > 0)
      ? (tenant.laundryStages as any)
      : (DEFAULT_PRODUCTION_STAGES as any);

    let stageConfig: { key: string; macroStatus: string; label?: string; name?: string } | undefined =
      tenantStages.find((s) => s.key === nextStage) || (LAUNDRY_11_STAGES as readonly any[]).find((s) => s.key === nextStage);

    // Dukung mapping alias legacy
    if (!stageConfig) {
      if (nextStage === 'TAGGING') stageConfig = tenantStages.find((s) => s.key === 'LABEL');
      else if (nextStage === 'SORTING') stageConfig = tenantStages.find((s) => s.key === 'SORTIR');
      else if (nextStage === 'WASHING') stageConfig = tenantStages.find((s) => s.key === 'CUCI');
      else if (nextStage === 'DRYING') stageConfig = tenantStages.find((s) => s.key === 'KERING');
      else if (nextStage === 'IRONING') stageConfig = tenantStages.find((s) => s.key === 'SETRIKA');
      else if (nextStage === 'FOLDING') stageConfig = tenantStages.find((s) => s.key === 'LIPAT');
      else if (nextStage === 'PACKING') stageConfig = tenantStages.find((s) => s.key === 'PENGEMASAN');
    }

    if (!stageConfig) {
      return res.status(400).json({ status: 'error', message: `Tahapan '${nextStage}' tidak valid dalam alur produksi` });
    }

    const detail = await prisma.laundryOrderDetail.findFirst({
      where: {
        tenantId,
        OR: [{ id }, { orderId: id }],
      },
      include: {
        order: true,
        stageLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!detail) {
      return res.status(404).json({ status: 'error', message: 'Detail pesanan laundry tidak ditemukan' });
    }

    const now = new Date();
    const lastLog = detail.stageLogs[0];
    let durationMinutes = 0;
    if (lastLog?.completedAt) {
      durationMinutes = Math.max(1, Math.round((now.getTime() - new Date(lastLog.completedAt).getTime()) / 60000));
    }

    const effectiveOperatorId = operatorId || req.user?.id || null;
    let effectiveOperatorName = operatorName?.trim() || (req.user as any)?.name || 'Staf Produksi';

    if (operatorId && !operatorName) {
      const opUser = await prisma.user.findFirst({
        where: { id: operatorId, tenantId },
        select: { name: true },
      });
      if (opUser) effectiveOperatorName = opUser.name;
    }

    const detailUpdate: any = {
      currentStage: nextStage,
      status: stageConfig.macroStatus,
    };

    if (nextStage === 'RACK_STORAGE' || stageConfig.macroStatus === 'READY_FOR_PICKUP') {
      detailUpdate.rackCode = rackCode ? rackCode.toUpperCase().trim() : detail.rackCode || 'RAK-A1';
      if (!detail.completedAt) detailUpdate.completedAt = now;
      if (['DELIVERY_ONLY', 'PICKUP_AND_DELIVERY', 'DELIVERY'].includes(detail.deliveryType)) {
        if (!['OUT_FOR_DELIVERY', 'DELIVERED'].includes(detail.deliveryStatus || '')) {
          detailUpdate.deliveryStatus = 'READY_TO_DELIVER';
        }
      }
    }

    if (nextStage === 'HANDOVER') {
      const currentPaid = Number(detail.order.paidAmount || 0);
      const total = Number(detail.order.totalAmount);
      const remaining = Math.max(0, total - currentPaid);

      if (remaining > 0) {
        const userRole = (req.user?.role || '').toUpperCase();
        if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'CASHIER', 'SUPERADMIN'].includes(userRole)) {
          return res.status(403).json({
            status: 'error',
            message: 'Penyerahan pakaian yang belum lunas hanya dapat diproses oleh Kasir di Outlet',
          });
        }
      }

      detailUpdate.pickedUpAt = now;
      if (pickedUpBy) detailUpdate.pickedUpBy = pickedUpBy.trim();
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update status pada laundryOrderDetail
      const updatedDetail = await tx.laundryOrderDetail.update({
        where: { id: detail.id },
        data: detailUpdate,
      });

      // 2. Buat record audit log pengerjaan tahapan
      const stageLog = await tx.laundryStageLog.create({
        data: {
          tenantId,
          orderId: detail.orderId,
          laundryDetailId: detail.id,
          stage: nextStage,
          operatorId: effectiveOperatorId,
          operatorName: effectiveOperatorName,
          weightKg: detail.totalWeightKg,
          piecesCount: detail.totalPieces,
          machineName: machineName?.trim() || null,
          completedAt: now,
          durationMinutes,
          notes: notes?.trim() || null,
        },
      });

      // 3. Jika Handover: Lunasi sisa tagihan jika ada, kosongkan rak
      if (nextStage === 'HANDOVER') {
        const orderDataToUpdate: any = { orderStatus: OrderStatus.COMPLETED };
        const currentPaid = Number(detail.order.paidAmount || 0);
        const total = Number(detail.order.totalAmount);
        const remaining = Math.max(0, total - currentPaid);

        if (detail.order.paymentStatus !== PaymentStatus.PAID || remaining > 0) {
          orderDataToUpdate.paymentStatus = PaymentStatus.PAID;
          orderDataToUpdate.paidAmount = total;

          if (remaining > 0) {
            const handoverShift = await tx.shift.findFirst({
              where: {
                tenantId,
                outletId: detail.outletId,
                status: ShiftStatus.OPEN,
                ...(userId ? { userId } : {}),
              },
            }) || await tx.shift.findFirst({
              where: {
                tenantId,
                outletId: detail.outletId,
                status: ShiftStatus.OPEN,
              },
            });

            const handoverMethod =
              paymentMethod === 'QRIS'
                ? PaymentMethod.QRIS
                : paymentMethod === 'TRANSFER'
                ? PaymentMethod.BANK_TRANSFER
                : PaymentMethod.CASH;

            await tx.paymentTransaction.create({
              data: {
                tenantId,
                orderId: detail.orderId,
                shiftId: handoverShift?.id || null,
                outletId: detail.outletId,
                cashierId: userId || null,
                paymentMethod: handoverMethod,
                amount: remaining,
                status: PaymentTxStatus.CAPTURED,
              },
            });

            // Sinkronkan pelunasan piutang (CustomerDebt) dan buat riwayat CustomerDebtPayment
            const existingDebt = await tx.customerDebt.findFirst({
              where: { tenantId, orderId: detail.orderId },
            });
            if (existingDebt) {
              await tx.customerDebt.update({
                where: { id: existingDebt.id },
                data: {
                  paidAmount: total,
                  remainingAmount: 0,
                  status: 'PAID',
                },
              });

              await tx.customerDebtPayment.create({
                data: {
                  tenantId,
                  debtId: existingDebt.id,
                  outletId: detail.outletId,
                  cashierId: userId || null,
                  shiftId: handoverShift?.id || null,
                  amount: remaining,
                  paymentMethod: handoverMethod,
                  notes: 'Pelunasan saat serah terima pakaian di outlet',
                },
              });
            }
          }
        }

        await tx.order.update({
          where: { id: detail.orderId },
          data: orderDataToUpdate,
        });

        await tx.laundryOrderDetail.update({
          where: { id: detail.id },
          data: { rackCode: null },
        });

        // Berikan reward poin jika pesanan berstatus PAID
        if (orderDataToUpdate.paymentStatus === PaymentStatus.PAID || detail.order.paymentStatus === PaymentStatus.PAID) {
          await awardLaundryOrderPointsIfEligible(
            tx,
            tenantId,
            detail.outletId,
            detail.order.customerId,
            detail.order.id,
            Number(detail.order.totalAmount)
          );
        }
      }

      // 4. Auto-BoM Deduction jika cucian masuk tahap cuci (atau lebih lanjut) dan belum dipotong
      const isWashOrBeyond =
        nextStage === 'WASHING' ||
        nextStage === 'CUCI' ||
        stageConfig.macroStatus === 'WASHING_DRYING' ||
        stageConfig.macroStatus === 'IRONING_PACKING' ||
        stageConfig.macroStatus === 'READY_FOR_PICKUP' ||
        stageConfig.macroStatus === 'COMPLETED';

      if (isWashOrBeyond && !detail.isBomDeducted) {
        await deductLaundryOrderBom(tx, detail, tenantId, effectiveOperatorId || userId);
      }

      return { updatedDetail, stageLog };
    });

    // Background WhatsApp auto-notification
    if (nextStage === 'RACK_STORAGE') {
      triggerLaundryNotification(detail.orderId, 'READY', tenantId).catch((e) =>
        console.error('[AUTO WA READY TRIGGER FAILED]', e)
      );
    } else if (nextStage === 'HANDOVER') {
      triggerLaundryNotification(detail.orderId, 'COMPLETED', tenantId).catch((e) =>
        console.error('[AUTO WA COMPLETED TRIGGER FAILED]', e)
      );
    }

    return res.status(200).json({
      status: 'success',
      message: `Pengerjaan cucian berhasil dialihkan ke tahap ${stageConfig.label}`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error advanceLaundryStage:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui tahapan produksi laundry' });
  }
};

/**
 * Mengambil riwayat log 11 tahapan pengerjaan untuk satu nota pesanan
 */
export const getOrderStageLogs = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const detail = await prisma.laundryOrderDetail.findFirst({
      where: {
        tenantId,
        OR: [{ id }, { orderId: id }],
      },
    });

    if (!detail) {
      return res.status(404).json({ status: 'error', message: 'Pesanan laundry tidak ditemukan' });
    }

    const logs = await prisma.laundryStageLog.findMany({
      where: {
        tenantId,
        orderId: detail.orderId,
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.status(200).json({
      status: 'success',
      data: {
        orderId: detail.orderId,
        currentStage: detail.currentStage,
        logs,
      },
    });
  } catch (error: any) {
    console.error('Error getOrderStageLogs:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat log tahapan produksi' });
  }
};

/**
 * Mengambil rekapitulasi metrik KPI produktivitas operator staf per tahapan
 */
export const getProductionKpiReport = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const { startDate, endDate, operatorId } = req.query;

    const where: any = { tenantId };
    if (operatorId && typeof operatorId === 'string' && operatorId !== 'ALL') {
      where.operatorId = operatorId;
    }
    if (startDate || endDate) {
      where.completedAt = {};
      if (startDate) where.completedAt.gte = new Date(startDate as string);
      if (endDate) where.completedAt.lte = new Date(endDate as string);
    } else {
      // Default batas aman 30 hari untuk mencegah OOM pada server GCP e2-micro 1GB RAM
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      where.completedAt = { gte: thirtyDaysAgo };
    }

    const logs = await prisma.laundryStageLog.findMany({
      where,
      orderBy: { completedAt: 'desc' },
      take: 2000,
    });

    // Agregasi KPI per operator
    const kpiByOperator: Record<
      string,
      {
        operatorId: string;
        operatorName: string;
        totalJobs: number;
        totalWashingKg: number;
        totalDryingKg: number;
        totalIroningKg: number;
        totalPackingOrders: number;
        totalDurationMinutes: number;
        stagesCount: Record<string, number>;
      }
    > = {};

    logs.forEach((log) => {
      const opName = log.operatorName || 'Staf Operasional';
      const opKey = log.operatorId || opName;

      if (!kpiByOperator[opKey]) {
        kpiByOperator[opKey] = {
          operatorId: log.operatorId || '',
          operatorName: opName,
          totalJobs: 0,
          totalWashingKg: 0,
          totalDryingKg: 0,
          totalIroningKg: 0,
          totalPackingOrders: 0,
          totalDurationMinutes: 0,
          stagesCount: {},
        };
      }

      const op = kpiByOperator[opKey];
      op.totalJobs += 1;
      op.totalDurationMinutes += log.durationMinutes || 0;
      op.stagesCount[log.stage] = (op.stagesCount[log.stage] || 0) + 1;

      const kg = Number(log.weightKg || 0);
      const stageUpper = String(log.stage || '').toUpperCase();
      if (['WASHING', 'CUCI'].includes(stageUpper)) op.totalWashingKg += kg;
      if (['DRYING', 'KERING'].includes(stageUpper)) op.totalDryingKg += kg;
      if (['IRONING', 'SETRIKA', 'EXTRA_SETRIKA'].includes(stageUpper)) op.totalIroningKg += kg;
      if (['PACKING', 'PENGEMASAN'].includes(stageUpper)) op.totalPackingOrders += 1;
    });

    return res.status(200).json({
      status: 'success',
      data: Object.values(kpiByOperator),
    });
  } catch (error: any) {
    console.error('Error getProductionKpiReport:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil rekapitulasi KPI produksi staf' });
  }
};

// ==========================================
// 8. PENGATURAN TAHAPAN PRODUKSI TOKO (OWNER CUSTOM STAGES)
// ==========================================

export const getLaundryStageSettings = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { laundryStages: true },
    });

    const stages =
      Array.isArray(tenant?.laundryStages) && tenant.laundryStages.length > 0
        ? tenant.laundryStages
        : DEFAULT_PRODUCTION_STAGES;

    return res.status(200).json({
      status: 'success',
      data: stages,
    });
  } catch (error: any) {
    console.error('Error getLaundryStageSettings:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil pengaturan tahapan produksi' });
  }
};

export const updateLaundryStageSettings = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const role = (req.user?.role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(role)) {
      return res.status(403).json({ status: 'error', message: 'Hanya Owner, Admin, atau Supervisor yang dapat mengubah tahapan produksi' });
    }

    const { stages } = req.body;
    if (!Array.isArray(stages)) {
      return res.status(400).json({ status: 'error', message: 'Daftar tahapan harus berupa array' });
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { laundryStages: stages },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Pengaturan tahapan produksi toko berhasil disimpan',
      data: stages,
    });
  } catch (error: any) {
    console.error('Error updateLaundryStageSettings:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menyimpan pengaturan tahapan produksi' });
  }
};

export const resetLaundryStageSettings = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const role = (req.user?.role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(role)) {
      return res.status(403).json({ status: 'error', message: 'Hanya Owner, Admin, atau Supervisor yang dapat mereset tahapan produksi' });
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { laundryStages: DEFAULT_PRODUCTION_STAGES as any },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Pengaturan tahapan produksi berhasil direset ke standar 11 tahapan SmartOwner',
      data: DEFAULT_PRODUCTION_STAGES,
    });
  } catch (error: any) {
    console.error('Error resetLaundryStageSettings:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mereset pengaturan tahapan' });
  }
};

// ==========================================
// 9. FORMULIR SORTIR PAKAIAN & QUALITY CONTROL (QC)
// ==========================================

export const saveLaundrySortingData = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const { garmentCounts, defects, defectNotes, conditionPhotos, operatorName, advanceToNext } = req.body;

    const detail = await prisma.laundryOrderDetail.findFirst({
      where: {
        tenantId,
        OR: [{ id }, { orderId: id }],
      },
      include: { order: true },
    });

    if (!detail) {
      return res.status(404).json({ status: 'error', message: 'Detail pesanan laundry tidak ditemukan' });
    }

    // Hitung total pieces dari garmentCounts jika berupa array
    let totalPieces = detail.totalPieces;
    if (Array.isArray(garmentCounts)) {
      totalPieces = garmentCounts.reduce((acc: number, item: any) => acc + (Number(item?.qty) || 0), 0);
    }

    const now = new Date();
    const sortedBy = operatorName || (req.user as any)?.name || 'Kasir / Operator';

    // Tentukan currentStage baru jika advanceToNext
    let newStage = detail.currentStage;
    let newStatus = detail.status;
    if (advanceToNext && (detail.currentStage === 'DROP_OFF' || detail.currentStage === 'SORTING' || detail.currentStage === 'TAGGING')) {
      newStage = 'WASHING';
      newStatus = 'WASHING_DRYING';
    }

    const updated = await prisma.laundryOrderDetail.update({
      where: { id: detail.id },
      data: {
        garmentCounts: garmentCounts ?? detail.garmentCounts,
        defects: defects ?? detail.defects,
        defectNotes: defectNotes ?? detail.defectNotes,
        conditionPhotos: conditionPhotos ?? detail.conditionPhotos,
        totalPieces: totalPieces > 0 ? totalPieces : detail.totalPieces,
        isSorted: true,
        sortedAt: now,
        sortedBy,
        currentStage: newStage,
        status: newStatus,
      },
    });

    // Catat log sortir ke laundry_stage_logs
    await prisma.laundryStageLog.create({
      data: {
        tenantId,
        orderId: detail.orderId,
        laundryDetailId: detail.id,
        stage: 'SORTING',
        operatorId: req.user?.id || null,
        operatorName: sortedBy,
        weightKg: detail.totalWeightKg,
        piecesCount: totalPieces,
        startedAt: now,
        completedAt: now,
        durationMinutes: 5,
        notes: defectNotes || 'Sortir dan penghitungan helai pakaian selesai',
      },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Data sortir dan QC pakaian berhasil disimpan',
      data: updated,
    });
  } catch (error: any) {
    console.error('Error saveLaundrySortingData:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menyimpan data sortir pakaian' });
  }
};

// ==========================================
// 10. PUBLIC LIVE TRACKING VIA QR STRUK NOTA
// ==========================================

export const getPublicLaundryTracking = async (req: Request, res: Response) => {
  try {
    const { invoiceNumber } = req.params;
    if (!invoiceNumber) {
      return res.status(400).json({ status: 'error', message: 'Nomor nota invoice wajib diisi' });
    }

    const order = await prisma.order.findFirst({
      where: {
        invoiceNumber: { equals: invoiceNumber.trim(), mode: 'insensitive' },
      },
      include: {
        customer: true,
        outlet: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            receiptConfig: true,
            googleReviewUrl: true,
          },
        },
        items: true,
        laundryFeedback: true,
        laundryDetail: {
          include: {
            stageLogs: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!order || !order.laundryDetail) {
      return res.status(404).json({ status: 'error', message: 'Nota pesanan laundry tidak ditemukan' });
    }

    // Ambil tahapan aktif dari tenant atau default
    const tenant = await prisma.tenant.findUnique({
      where: { id: order.tenantId },
      select: { laundryStages: true, name: true },
    });
    const allStages =
      Array.isArray(tenant?.laundryStages) && tenant.laundryStages.length > 0
        ? tenant.laundryStages
        : DEFAULT_PRODUCTION_STAGES;

    // Mask nama pelanggan untuk privasi publik (cth: "Budi Santoso" -> "Budi S***")
    const rawName = order.customer?.name || 'Pelanggan';
    const nameParts = rawName.split(' ');
    const maskedName =
      nameParts.length > 1
        ? `${nameParts[0]} ${nameParts[1].charAt(0)}***`
        : `${rawName.slice(0, 3)}***`;

    return res.status(200).json({
      status: 'success',
      data: {
        invoiceNumber: order.invoiceNumber,
        status: order.laundryDetail.status,
        currentStage: order.laundryDetail.currentStage,
        customerName: maskedName,
        outlet: order.outlet,
        tenantName: tenant?.name || 'Well POS Laundry',
        createdAt: order.createdAt,
        estimatedReadyAt: order.laundryDetail.estimatedReadyAt,
        completedAt: order.laundryDetail.completedAt,
        pickedUpAt: order.laundryDetail.pickedUpAt,
        totalWeightKg: order.laundryDetail.totalWeightKg,
        totalPieces: order.laundryDetail.totalPieces,
        perfumeVariant: order.laundryDetail.perfumeVariant,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        paidAmount: order.paidAmount,
        rackCode: order.laundryDetail.rackCode,
        isSorted: order.laundryDetail.isSorted,
        garmentCounts: order.laundryDetail.garmentCounts,
        defects: order.laundryDetail.defects,
        defectNotes: order.laundryDetail.defectNotes,
        conditionPhotos: order.laundryDetail.conditionPhotos || [],
        deliveryType: order.laundryDetail.deliveryType || 'NONE',
        deliveryStatus: order.laundryDetail.deliveryStatus || null,
        deliveryFee: Number(order.laundryDetail.deliveryFee || 0),
        deliveryZoneName: order.laundryDetail.deliveryZoneName || null,
        deliveryAddress: order.laundryDetail.deliveryAddress || null,
        courierName: order.laundryDetail.courierName || null,
        deliveredAt: order.laundryDetail.deliveredAt || null,
        items: order.items.map((oi) => ({
          name: oi.productName || 'Layanan Laundry',
          quantity: oi.quantity,
          unitPrice: Number(oi.unitPrice),
          totalPrice: Number(oi.subtotal),
          unit: oi.unit || 'KG',
          pricingBasis: oi.pricingBasis || 'KILOAN',
          perfumeVariant: oi.perfumeVariant || order.laundryDetail?.perfumeVariant || 'Standard',
        })),
        itemsCount: order.items.length,
        serviceSummary:
          order.items.length > 1
            ? `${order.items[0]?.productName || 'Layanan'} (+${order.items.length - 1} layanan)`
            : (order.items[0]?.productName || 'Layanan Laundry'),
        googleReviewUrl: order.outlet.googleReviewUrl || null,
        hasFeedback: Boolean(order.laundryFeedback),
        feedbackRating: order.laundryFeedback?.rating || null,
        feedback: order.laundryFeedback
          ? {
              rating: order.laundryFeedback.rating,
              category: order.laundryFeedback.category,
              comment: order.laundryFeedback.comment,
              isComplaint: order.laundryFeedback.isComplaint,
              redirectedToGoogle: order.laundryFeedback.redirectedToGoogle,
              status: order.laundryFeedback.status,
              resolutionNotes: order.laundryFeedback.resolutionNotes,
              createdAt: order.laundryFeedback.createdAt,
            }
          : null,
        stages: allStages,
        stageLogs: order.laundryDetail.stageLogs.map((log) => ({
          stage: log.stage,
          completedAt: log.completedAt || log.startedAt,
          notes: log.notes,
          machineName: log.machineName || null,
        })),
        laundryTerms: (order.outlet as any)?.receiptConfig?.laundryTerms || null,
      },
    });
  } catch (error: any) {
    console.error('Error getPublicLaundryTracking:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil data pelacakan cucian' });
  }
};

// ==========================================
// 11. BUKTI FOTO KONDISI PAKAIAN ANTI-KOMPLAIN
// ==========================================

export const uploadLaundryConditionPhoto = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks autentikasi tidak ditemukan' });
    }

    const { image, caption, stage } = req.body;
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ status: 'error', message: 'Data foto (Base64 Data URL) wajib disertakan' });
    }

    // Ekstrak MIME & Base64 data
    const matches = image.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ status: 'error', message: 'Format Data URL gambar tidak valid' });
    }

    const rawSubtype = matches[1].toLowerCase();
    const ALLOWED_MIME_EXTS: Record<string, string> = {
      jpeg: 'jpg',
      jpg: 'jpg',
      png: 'png',
      webp: 'webp',
    };

    if (!ALLOWED_MIME_EXTS[rawSubtype]) {
      return res.status(400).json({
        status: 'error',
        message: 'Format gambar tidak didukung. Hanya file JPG, JPEG, PNG, dan WebP yang diizinkan.',
      });
    }

    const ext = ALLOWED_MIME_EXTS[rawSubtype];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Validasi batas ukuran file (maksimal 2 MB = 2 * 1024 * 1024 byte)
    const MAX_FILE_SIZE = 2 * 1024 * 1024;
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({
        status: 'error',
        message: `Ukuran foto melebihi batas maksimal (Maksimal 2 MB, ukuran file: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`,
      });
    }

    const contentType = `image/${rawSubtype === 'jpg' ? 'jpeg' : rawSubtype}`;
    const uploadResult = await storageService.uploadBuffer({
      buffer,
      contentType,
      ext,
      tenantId,
      module: 'laundry',
    });

    return res.status(200).json({
      status: 'success',
      message: 'Foto kondisi pakaian berhasil diunggah',
      data: {
        url: uploadResult.url,
        caption: caption || '',
        stage: stage || 'SORTING',
        uploadedBy: (req.user as any)?.name || 'Kasir',
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error uploadLaundryConditionPhoto:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengunggah foto kondisi pakaian' });
  }
};

// ==========================================
// 12. CUSTOMER LAUNDRY WALLET & KILO QUOTA
// ==========================================

export const getCustomerLaundryWallet = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const { customerId } = req.params;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks autentikasi tidak ditemukan' });
    }

    const wallet = await prisma.customerLaundryWallet.findUnique({
      where: {
        tenantId_customerId: {
          tenantId,
          customerId,
        },
      },
      include: {
        ledgers: {
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: {
            cashier: { select: { id: true, name: true } },
            outlet: { select: { id: true, name: true } },
            order: { select: { id: true, invoiceNumber: true } },
          },
        },
      },
    });

    if (!wallet) {
      return res.status(200).json({
        status: 'success',
        data: {
          balanceAmount: 0,
          balanceExpiresAt: null,
          quotaKg: 0,
          quotaExpiresAt: null,
          ledgers: [],
        },
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        id: wallet.id,
        balanceAmount: Number(wallet.balanceAmount),
        balanceExpiresAt: wallet.balanceExpiresAt,
        quotaKg: Number(wallet.quotaKg),
        quotaExpiresAt: wallet.quotaExpiresAt,
        ledgers: wallet.ledgers.map((l) => ({
          id: l.id,
          ledgerType: l.ledgerType,
          deltaAmount: Number(l.deltaAmount),
          balanceBefore: Number(l.balanceBefore),
          balanceAfter: Number(l.balanceAfter),
          deltaKg: Number(l.deltaKg),
          kgBefore: Number(l.kgBefore),
          kgAfter: Number(l.kgAfter),
          paymentMethod: l.paymentMethod,
          notes: l.notes,
          createdAt: l.createdAt,
          cashierName: l.cashier?.name,
          outletName: l.outlet?.name,
          invoiceNumber: l.order?.invoiceNumber,
        })),
      },
    });
  } catch (error: any) {
    console.error('Error getCustomerLaundryWallet:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil data saldo/kuota pelanggan' });
  }
};

export const topupCustomerLaundryWallet = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id;
    const { customerId } = req.params;
    if (!tenantId || !userId) {
      return res.status(401).json({ status: 'error', message: 'Konteks autentikasi kasir tidak ditemukan' });
    }

    const {
      type, // 'BALANCE' | 'QUOTA_KG'
      amount, // nominal saldo jika type BALANCE
      bonusAmount, // bonus saldo tambahan (opsional dari paket deposit)
      kg, // kuota kg jika type QUOTA_KG
      quotaBonusKg, // bonus kuota kg tambahan (opsional dari paket deposit)
      pricePaid, // uang yang dibayar pelanggan
      paymentMethod = 'CASH', // 'CASH' | 'QRIS' | 'BANK_TRANSFER' | 'TRANSFER'
      shiftId,
      outletId,
      notes,
      quotaExpiresAt,
      validityDays,
      expiryPolicy,
    } = req.body;

    if (!type || !['BALANCE', 'QUOTA_KG'].includes(type)) {
      return res.status(400).json({ status: 'error', message: 'Tipe top-up harus BALANCE atau QUOTA_KG' });
    }

    if (type === 'BALANCE' && (!amount || Number(amount) <= 0)) {
      return res.status(400).json({ status: 'error', message: 'Nominal top-up saldo harus lebih besar dari 0' });
    }

    if (type === 'QUOTA_KG' && (!kg || Number(kg) <= 0)) {
      return res.status(400).json({ status: 'error', message: 'Jumlah kuota kg harus lebih besar dari 0' });
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });
    if (!customer) {
      return res.status(404).json({ status: 'error', message: 'Pelanggan tidak ditemukan' });
    }

    const effectiveOutletId = outletId || (req.user as any)?.outletId;
    if (!effectiveOutletId) {
      return res.status(400).json({ status: 'error', message: 'Outlet aktif wajib disertakan' });
    }

    const paidNominal = type === 'BALANCE'
      ? (pricePaid !== undefined && pricePaid !== null ? Number(pricePaid) : Number(amount))
      : Number(pricePaid || 0);

    // Cari shift kasir aktif jika ada
    const activeShift = shiftId
      ? await prisma.shift.findFirst({ where: { id: shiftId, tenantId, status: ShiftStatus.OPEN } })
      : await prisma.shift.findFirst({
          where: {
            tenantId,
            outletId: effectiveOutletId,
            status: ShiftStatus.OPEN,
            userId,
          },
        });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Upsert wallet
      let wallet = await tx.customerLaundryWallet.findUnique({
        where: { tenantId_customerId: { tenantId, customerId } },
      });

      if (!wallet) {
        wallet = await tx.customerLaundryWallet.create({
          data: {
            tenantId,
            customerId,
            balanceAmount: 0,
            quotaKg: 0,
          },
        });
      }

      const balanceBefore = Number(wallet.balanceAmount);
      const kgBefore = Number(wallet.quotaKg);

      let deltaAmount = 0;
      let balanceAfter = balanceBefore;
      let deltaKg = 0;
      let kgAfter = kgBefore;
      let ledgerType = 'TOPUP_BALANCE';

      let resolvedBalanceExpiry: Date | null = null;
      let resolvedQuotaExpiry: Date | null = null;

      if (type === 'BALANCE') {
        deltaAmount = Number(amount) + Number(bonusAmount || 0);
        balanceAfter = balanceBefore + deltaAmount;
        ledgerType = 'TOPUP_BALANCE';

        if (req.body.balanceExpiresAt) {
          resolvedBalanceExpiry = new Date(req.body.balanceExpiresAt);
        } else if (validityDays && Number(validityDays) > 0) {
          const days = Number(validityDays);
          const policy = expiryPolicy || 'ACCUMULATE';
          const now = new Date();
          if (policy === 'ACCUMULATE' && wallet.balanceExpiresAt && new Date(wallet.balanceExpiresAt) > now) {
            resolvedBalanceExpiry = new Date(wallet.balanceExpiresAt);
            resolvedBalanceExpiry.setDate(resolvedBalanceExpiry.getDate() + days);
          } else {
            resolvedBalanceExpiry = new Date(now);
            resolvedBalanceExpiry.setDate(resolvedBalanceExpiry.getDate() + days);
          }
        }
      } else {
        deltaKg = Number(kg) + Number(quotaBonusKg || 0);
        kgAfter = kgBefore + deltaKg;
        ledgerType = 'TOPUP_QUOTA_KG';

        if (quotaExpiresAt) {
          resolvedQuotaExpiry = new Date(quotaExpiresAt);
        } else if (validityDays && Number(validityDays) > 0) {
          const days = Number(validityDays);
          const policy = expiryPolicy || 'ACCUMULATE';
          const now = new Date();
          if (policy === 'ACCUMULATE' && wallet.quotaExpiresAt && new Date(wallet.quotaExpiresAt) > now) {
            resolvedQuotaExpiry = new Date(wallet.quotaExpiresAt);
            resolvedQuotaExpiry.setDate(resolvedQuotaExpiry.getDate() + days);
          } else {
            resolvedQuotaExpiry = new Date(now);
            resolvedQuotaExpiry.setDate(resolvedQuotaExpiry.getDate() + days);
          }
        }
      }

      // Update wallet
      const updatedWallet = await tx.customerLaundryWallet.update({
        where: { id: wallet.id },
        data: {
          balanceAmount: balanceAfter,
          quotaKg: kgAfter,
          ...(resolvedBalanceExpiry ? { balanceExpiresAt: resolvedBalanceExpiry } : {}),
          ...(resolvedQuotaExpiry ? { quotaExpiresAt: resolvedQuotaExpiry } : {}),
        },
      });

      // 2. Buat ledger immutable
      const ledger = await tx.customerLaundryWalletLedger.create({
        data: {
          walletId: wallet.id,
          tenantId,
          outletId: effectiveOutletId,
          shiftId: activeShift?.id || null,
          cashierId: userId,
          ledgerType,
          deltaAmount,
          balanceBefore,
          balanceAfter,
          deltaKg,
          kgBefore,
          kgAfter,
          paymentMethod,
          notes: notes || `Top-up ${type === 'BALANCE' ? `saldo Rp ${deltaAmount.toLocaleString('id-ID')}` : `kuota ${deltaKg} Kg`}`,
        },
      });

      // 3. Jika bayar tunai (CASH) dan ada shift aktif, catat CashMovement agar kas fisik laci seimbang
      if (paymentMethod === 'CASH' && paidNominal > 0 && activeShift) {
        await tx.cashMovement.create({
          data: {
            tenantId,
            outletId: effectiveOutletId,
            shiftId: activeShift.id,
            userId,
            type: 'CASH_IN',
            category: 'WALLET_TOPUP',
            amount: paidNominal,
            notes: `Top-up ${type === 'BALANCE' ? 'saldo' : 'kuota'} laundry: ${customer.name}`,
          },
        });

        await tx.shift.update({
          where: { id: activeShift.id },
          data: {
            expectedEnding: {
              increment: paidNominal,
            },
          },
        });
      }

      return { wallet: updatedWallet, ledger };
    });

    return res.status(200).json({
      status: 'success',
      message: `Top-up ${type === 'BALANCE' ? 'saldo deposit' : 'kuota kiloan'} berhasil diproses!`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error topupCustomerLaundryWallet:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal memproses top-up saldo laundry' });
  }
};

export const DEFAULT_LAUNDRY_DEPOSIT_CONFIG = {
  packages: [
    {
      id: 'pkg-kiloan-25',
      name: 'Paket Kiloan Hemat 25 Kg',
      type: 'QUOTA_KG',
      price: 175000,
      quotaKg: 25,
      quotaBonusKg: 0,
      validityDays: 30,
      description: '25 Kg kuota cuci komplit, masa aktif 30 hari',
    },
    {
      id: 'pkg-kiloan-50',
      name: 'Paket Kiloan Jumbo 50 Kg',
      type: 'QUOTA_KG',
      price: 325000,
      quotaKg: 50,
      quotaBonusKg: 5,
      validityDays: 60,
      description: '50 Kg + Bonus 5 Kg, masa aktif 60 hari',
    },
    {
      id: 'pkg-deposit-100',
      name: 'Deposit Saldo Rp 100.000',
      type: 'BALANCE',
      price: 100000,
      balanceAmount: 100000,
      bonusAmount: 10000,
      validityDays: 90,
      description: 'Saldo Rp 100.000 + Bonus Rp 10.000 (Masa Aktif 90 Hari)',
    },
    {
      id: 'pkg-deposit-200',
      name: 'Deposit Saldo Rp 200.000',
      type: 'BALANCE',
      price: 200000,
      balanceAmount: 200000,
      bonusAmount: 25000,
      validityDays: 90,
      description: 'Saldo Rp 200.000 + Bonus Rp 25.000 (Masa Aktif 90 Hari)',
    },
  ],
  expiryPolicy: 'ACCUMULATE' as 'ACCUMULATE' | 'EXPIRE',
};

export const getLaundryDepositConfig = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const { outletId } = req.query;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const effectiveOutletId = (typeof outletId === 'string' && outletId) || (req.user as any)?.outletId;
    let outlet = null;
    if (effectiveOutletId) {
      outlet = await prisma.outlet.findFirst({
        where: { id: effectiveOutletId, tenantId },
        select: { id: true, name: true, laundryDepositConfig: true },
      });
    }
    if (!outlet) {
      outlet = await prisma.outlet.findFirst({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, laundryDepositConfig: true },
      });
    }

    const config = (outlet?.laundryDepositConfig as any) || DEFAULT_LAUNDRY_DEPOSIT_CONFIG;

    return res.status(200).json({
      status: 'success',
      data: {
        outletId: outlet?.id || null,
        outletName: outlet?.name || null,
        config,
      },
    });
  } catch (error: any) {
    console.error('Error getLaundryDepositConfig:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat konfigurasi paket deposit' });
  }
};

export const updateLaundryDepositConfig = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const userRole = (req.user?.role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(userRole)) {
      return res.status(403).json({ status: 'error', message: 'Hanya Owner/Admin yang berhak mengubah paket deposit' });
    }

    const { outletId, packages, expiryPolicy } = req.body;
    const effectiveOutletId = outletId || (req.user as any)?.outletId;
    let targetOutlet = null;
    if (effectiveOutletId) {
      targetOutlet = await prisma.outlet.findFirst({
        where: { id: effectiveOutletId, tenantId },
      });
    }
    if (!targetOutlet) {
      targetOutlet = await prisma.outlet.findFirst({
        where: { tenantId, isActive: true },
      });
    }

    if (!targetOutlet) {
      return res.status(404).json({ status: 'error', message: 'Outlet tidak ditemukan' });
    }

    const newConfig = {
      packages: Array.isArray(packages) ? packages : DEFAULT_LAUNDRY_DEPOSIT_CONFIG.packages,
      expiryPolicy: expiryPolicy === 'EXPIRE' ? 'EXPIRE' : 'ACCUMULATE',
      updatedAt: new Date().toISOString(),
    };

    const updatedOutlet = await prisma.outlet.update({
      where: { id: targetOutlet.id },
      data: { laundryDepositConfig: newConfig },
      select: { id: true, name: true, laundryDepositConfig: true },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Konfigurasi paket deposit dan masa aktif berhasil disimpan',
      data: updatedOutlet,
    });
  } catch (error: any) {
    console.error('Error updateLaundryDepositConfig:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui konfigurasi paket deposit' });
  }
};

// ==========================================
// 12. DELIVERY & ONGKIR OTOMATIS
// ==========================================

const DEFAULT_DELIVERY_CONFIG = {
  enabled: true,
  freeDeliveryMinAmount: 50000,
  freeDeliveryMinWeightKg: 5,
  roundTripMultiplier: 1.5,
  zones: [
    { id: 'zone_near', name: 'Zona Dekat (<= 2 Km)', fee: 5000 },
    { id: 'zone_mid', name: 'Zona Menengah (2 - 5 Km)', fee: 10000 },
    { id: 'zone_far', name: 'Zona Jauh (> 5 Km)', fee: 15000 },
  ],
};

/**
 * Mengambil konfigurasi tarif ongkir dan zona delivery toko
 */
export const getLaundryDeliveryConfig = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const outletId = (req.query.outletId as string) || req.user?.outletId;
    if (!tenantId || !outletId) {
      return res.status(400).json({ status: 'error', message: 'ID Toko / Outlet wajib disertakan' });
    }

    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId },
      select: { laundryDeliveryConfig: true },
    });

    const config = (outlet?.laundryDeliveryConfig as any) || DEFAULT_DELIVERY_CONFIG;
    return res.status(200).json({ status: 'success', data: config });
  } catch (error: any) {
    console.error('Error getLaundryDeliveryConfig:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil konfigurasi delivery' });
  }
};

/**
 * Menyimpan konfigurasi tarif ongkir dan zona delivery toko
 */
export const updateLaundryDeliveryConfig = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const { outletId, config } = req.body;
    const targetOutletId = outletId || req.user?.outletId;
    if (!tenantId || !targetOutletId) {
      return res.status(400).json({ status: 'error', message: 'ID Toko / Outlet wajib disertakan' });
    }

    const role = (req.user?.role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(role)) {
      return res.status(403).json({ status: 'error', message: 'Hanya Pengelola/Supervisor yang dapat mengubah tarif delivery' });
    }

    const payload = config && typeof config === 'object' ? config : req.body;
    delete (payload as any).outletId;

    const updated = await prisma.outlet.update({
      where: { id: targetOutletId },
      data: { laundryDeliveryConfig: payload },
      select: { laundryDeliveryConfig: true },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Konfigurasi delivery berhasil disimpan',
      data: updated.laundryDeliveryConfig,
    });
  } catch (error: any) {
    console.error('Error updateLaundryDeliveryConfig:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menyimpan konfigurasi delivery' });
  }
};

/**
 * Mengambil daftar tugas penjemputan dan pengantaran cucian pelanggan beserta KPI
 */
export const getLaundryDeliveries = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const outletId = (req.query.outletId as string) || req.user?.outletId;
    const status = req.query.status as string;
    const search = ((req.query.search as string) || '').trim().toLowerCase();

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const whereClause: any = {
      tenantId,
      ...(outletId ? { outletId } : {}),
      deliveryType: { notIn: ['NONE'] },
    };

    if (status && status !== 'ALL') {
      whereClause.deliveryStatus = status;
    }

    if (search) {
      whereClause.OR = [
        { order: { invoiceNumber: { contains: search, mode: 'insensitive' } } },
        { order: { customer: { name: { contains: search, mode: 'insensitive' } } } },
        { order: { customer: { phone: { contains: search, mode: 'insensitive' } } } },
        { deliveryAddress: { contains: search, mode: 'insensitive' } },
        { courierName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const details = await prisma.laundryOrderDetail.findMany({
      where: whereClause,
      include: {
        order: {
          include: {
            customer: true,
            items: true,
            cashier: { select: { id: true, name: true } },
            payments: { take: 1, orderBy: { createdAt: 'desc' } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    // Hitung KPI Delivery untuk seluruh outlet aktif
    const allOutletDeliveries = await prisma.laundryOrderDetail.findMany({
      where: {
        tenantId,
        ...(outletId ? { outletId } : {}),
        deliveryType: { notIn: ['NONE'] },
        deliveryStatus: { not: 'CANCELLED' },
        status: { not: 'CANCELLED' },
        order: {
          orderStatus: { notIn: [OrderStatus.VOIDED, OrderStatus.CANCELLED] },
        },
      },
      include: {
        order: { select: { totalAmount: true, paidAmount: true, paymentStatus: true, orderStatus: true } },
      },
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    let pendingPickup = 0;
    let readyToDeliver = 0;
    let outForDelivery = 0;
    let deliveredToday = 0;
    let totalCodRemaining = 0;

    for (const d of allOutletDeliveries) {
      if (d.deliveryStatus === 'PENDING_PICKUP') pendingPickup++;
      else if (d.deliveryStatus === 'READY_TO_DELIVER') readyToDeliver++;
      else if (d.deliveryStatus === 'OUT_FOR_DELIVERY') outForDelivery++;

      if (d.deliveryStatus === 'DELIVERED' && d.deliveredAt && new Date(d.deliveredAt) >= startOfToday) {
        deliveredToday++;
      }

      if (['READY_TO_DELIVER', 'OUT_FOR_DELIVERY'].includes(d.deliveryStatus || '')) {
        const remaining = Math.max(0, Number(d.order.totalAmount) - Number(d.order.paidAmount || 0));
        if (remaining > 0 && d.order.paymentStatus !== 'PAID') {
          totalCodRemaining += remaining;
        }
      }
    }

    const formatted = details.map((d) => ({
      id: d.id,
      orderId: d.orderId,
      invoiceNumber: d.order.invoiceNumber,
      status: d.status,
      currentStage: d.currentStage,
      rackCode: d.rackCode,
      totalWeightKg: d.totalWeightKg ? Number(d.totalWeightKg) : null,
      totalPieces: d.totalPieces,
      totalAmount: Number(d.order.totalAmount),
      paidAmount: Number(d.order.paidAmount || 0),
      remainingAmount: Math.max(0, Number(d.order.totalAmount) - Number(d.order.paidAmount || 0)),
      paymentStatus: d.order.paymentStatus,
      serviceName: d.order.items[0]?.productName || 'Layanan Laundry',
      customer: d.order.customer
        ? {
            id: d.order.customer.id,
            name: d.order.customer.name,
            phone: d.order.customer.phone,
            address: d.order.customer.address,
          }
        : null,
      items: d.order.items.map((i) => ({
        name: i.productName,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        subtotal: Number(i.subtotal),
      })),
      deliveryType: d.deliveryType,
      deliveryStatus: d.deliveryStatus || 'PENDING_PICKUP',
      deliveryFee: Number(d.deliveryFee || 0),
      deliveryZoneName: d.deliveryZoneName,
      deliveryAddress: d.deliveryAddress || d.order.customer?.address || null,
      deliveryNotes: d.deliveryNotes,
      deliveryScheduledAt: d.deliveryScheduledAt,
      courierName: d.courierName,
      courierPhone: d.courierPhone,
      deliveredAt: d.deliveredAt,
      deliveryProofPhotoUrl: d.deliveryProofPhotoUrl,
      createdAt: d.createdAt,
      order: {
        id: d.order.id,
        invoiceNumber: d.order.invoiceNumber,
        totalAmount: Number(d.order.totalAmount),
        paidAmount: Number(d.order.paidAmount || 0),
        paymentStatus: d.order.paymentStatus,
        paymentMethod: d.order.payments?.[0]?.paymentMethod || null,
        status: d.status,
        currentStage: d.currentStage,
        rackCode: d.rackCode,
        serviceName: d.order.items[0]?.productName || 'Layanan Laundry',
        totalWeightKg: d.totalWeightKg ? Number(d.totalWeightKg) : undefined,
        totalPieces: d.totalPieces,
        customer: d.order.customer
          ? {
              id: d.order.customer.id,
              name: d.order.customer.name,
              phone: d.order.customer.phone,
              address: d.order.customer.address,
            }
          : null,
      },
    }));

    return res.status(200).json({
      status: 'success',
      data: formatted,
      kpi: {
        pendingPickup,
        readyToDeliver,
        outForDelivery,
        deliveredToday,
        totalCodRemaining,
      },
    });
  } catch (error: any) {
    console.error('Error getLaundryDeliveries:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil data delivery laundry' });
  }
};

/**
 * Memperbarui status kurir/delivery dan memproses pelunasan COD jika selesai
 */
export const updateLaundryDeliveryStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const {
      deliveryStatus,
      courierName,
      courierPhone,
      deliveryProofPhotoUrl,
      deliveryNotes,
      collectCodPayment,
      codPaymentMethod,
    } = req.body;

    if (!deliveryStatus) {
      return res.status(400).json({ status: 'error', message: 'Status delivery wajib diisi' });
    }

    const detail = await prisma.laundryOrderDetail.findFirst({
      where: {
        tenantId,
        OR: [{ id: orderId }, { orderId }],
      },
      include: {
        order: true,
      },
    });

    if (!detail) {
      return res.status(404).json({ status: 'error', message: 'Data delivery cucian tidak ditemukan' });
    }

    const now = new Date();
    const updateDetailData: any = {
      deliveryStatus,
    };

    if (courierName !== undefined) updateDetailData.courierName = courierName ? courierName.trim() : null;
    if (courierPhone !== undefined) updateDetailData.courierPhone = courierPhone ? courierPhone.trim() : null;
    if (deliveryProofPhotoUrl !== undefined) {
      const resolvedProofPhoto = await storageService.resolveDataUrlToStorage({
        input: deliveryProofPhotoUrl,
        tenantId,
        module: 'laundry-delivery',
      });
      updateDetailData.deliveryProofPhotoUrl = resolvedProofPhoto || null;
    }
    if (deliveryNotes !== undefined) updateDetailData.deliveryNotes = deliveryNotes || null;

    if (deliveryStatus === 'DELIVERED') {
      updateDetailData.deliveredAt = now;
      updateDetailData.status = 'COMPLETED';
      updateDetailData.currentStage = 'HANDOVER';
      if (!detail.completedAt) updateDetailData.completedAt = now;
      updateDetailData.pickedUpAt = now;
      updateDetailData.pickedUpBy = courierName ? `Kurir: ${courierName}` : 'Kurir Delivery';
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedDetail = await tx.laundryOrderDetail.update({
        where: { id: detail.id },
        data: updateDetailData,
      });

      if (deliveryStatus === 'DELIVERED') {
        const orderDataToUpdate: any = { orderStatus: OrderStatus.COMPLETED };

        const currentPaid = Number(detail.order.paidAmount || 0);
        const total = Number(detail.order.totalAmount);
        const remaining = Math.max(0, total - currentPaid);

        if (collectCodPayment && remaining > 0) {
          orderDataToUpdate.paymentStatus = PaymentStatus.PAID;
          orderDataToUpdate.paidAmount = total;

          const activeShift = await tx.shift.findFirst({
            where: {
              tenantId,
              outletId: detail.outletId,
              status: ShiftStatus.OPEN,
            },
          });

          let method: PaymentMethod = PaymentMethod.CASH;
          if (codPaymentMethod === 'QRIS') method = PaymentMethod.QRIS;
          else if (codPaymentMethod === 'TRANSFER') method = PaymentMethod.BANK_TRANSFER;

          await tx.paymentTransaction.create({
            data: {
              tenantId,
              orderId: detail.order.id,
              shiftId: activeShift?.id || null,
              outletId: detail.outletId,
              cashierId: userId || null,
              paymentMethod: method,
              amount: remaining,
              status: PaymentTxStatus.CAPTURED,
            },
          });

          const existingDebt = await tx.customerDebt.findFirst({
            where: { tenantId, orderId: detail.order.id },
          });
          if (existingDebt) {
            await tx.customerDebt.update({
              where: { id: existingDebt.id },
              data: {
                paidAmount: total,
                remainingAmount: 0,
                status: 'PAID',
              },
            });
            await tx.customerDebtPayment.create({
              data: {
                tenantId,
                debtId: existingDebt.id,
                outletId: detail.outletId,
                cashierId: userId || null,
                shiftId: activeShift?.id || null,
                amount: remaining,
                paymentMethod: method,
                notes: 'Pelunasan COD oleh Kurir saat pengantaran selesai',
              },
            });
          }
        } else if (remaining === 0) {
          orderDataToUpdate.paymentStatus = PaymentStatus.PAID;
        }

        await tx.order.update({
          where: { id: detail.order.id },
          data: orderDataToUpdate,
        });

        // Berikan reward poin jika pesanan berstatus PAID
        if (orderDataToUpdate.paymentStatus === PaymentStatus.PAID || detail.order.paymentStatus === PaymentStatus.PAID) {
          await awardLaundryOrderPointsIfEligible(
            tx,
            tenantId,
            detail.outletId,
            detail.order.customerId,
            detail.order.id,
            Number(detail.order.totalAmount)
          );
        }

        await tx.laundryStageLog.create({
          data: {
            tenantId,
            orderId: detail.order.id,
            laundryDetailId: detail.id,
            stage: 'HANDOVER',
            operatorId: userId,
            operatorName: courierName ? `Kurir: ${courierName}` : ((req.user as any)?.name || 'Kurir Delivery'),
            completedAt: now,
            durationMinutes: 0,
            notes: `Pengantaran selesai ke pelanggan oleh ${courierName || 'Kurir'}${collectCodPayment ? ' (Pelunasan COD Berhasil)' : ''}`,
          },
        });
      }

      return updatedDetail;
    });

    return res.status(200).json({
      status: 'success',
      message: `Status delivery berhasil diperbarui menjadi ${deliveryStatus}`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error updateLaundryDeliveryStatus:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui status delivery laundry' });
  }
};

/**
 * Garansi Cuci Ulang (Rewash Rp 0)
 * Mengembalikan cucian yang telah siap ambil atau selesai ke tahapan produksi tanpa mengubah omset transaksi.
 */
export const rewashLaundryOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const { reason, notes, targetStage, operatorName } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ status: 'error', message: 'Alasan cuci ulang (garansi) wajib diisi' });
    }

    const detail = await prisma.laundryOrderDetail.findFirst({
      where: {
        tenantId,
        OR: [{ id }, { orderId: id }],
      },
      include: {
        order: {
          include: { customer: true },
        },
      },
    });

    if (!detail) {
      return res.status(404).json({ status: 'error', message: 'Pesanan laundry tidak ditemukan' });
    }

    const cleanReason = reason.trim();
    const additionalNotes = notes ? notes.trim() : '';
    const reasonTag = `[REWASH/GARANSI: ${cleanReason}]${additionalNotes ? ` (${additionalNotes})` : ''}`;
    const updatedDefectNotes = detail.defectNotes ? `${detail.defectNotes}\n${reasonTag}` : reasonTag;
    const resolvedOperator = operatorName?.trim() || (req.user as any)?.name || 'Kasir / Operator';
    const chosenStage = targetStage || 'SPOTTING';
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Reset LaundryOrderDetail: status -> WASHING_DRYING, currentStage -> targetStage || 'SPOTTING', kosongkan rackCode
      const updated = await tx.laundryOrderDetail.update({
        where: { id: detail.id },
        data: {
          status: 'WASHING_DRYING',
          currentStage: chosenStage,
          rackCode: null,
          defectNotes: updatedDefectNotes,
          pickedUpAt: null,
          pickedUpBy: null,
        },
      });

      // 2. Kembalikan Order.orderStatus -> IN_PROGRESS (Order.totalAmount & Order.paymentStatus TETAP UTUH)
      await tx.order.update({
        where: { id: detail.orderId },
        data: {
          orderStatus: OrderStatus.IN_PROGRESS,
        },
      });

      // 3. Catat audit trail di LaundryStageLog
      await tx.laundryStageLog.create({
        data: {
          tenantId,
          orderId: detail.orderId,
          laundryDetailId: detail.id,
          stage: 'REWASH',
          operatorId: userId || null,
          operatorName: resolvedOperator,
          weightKg: detail.totalWeightKg,
          piecesCount: detail.totalPieces,
          completedAt: now,
          durationMinutes: 0,
          notes: `Cuci Ulang Garansi (Rp 0): ${cleanReason}${additionalNotes ? ` - ${additionalNotes}` : ''}`,
        },
      });

      return updated;
    });

    return res.status(200).json({
      status: 'success',
      message: `Garansi cuci ulang berhasil diaktifkan: ${cleanReason}`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error rewashLaundryOrder:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memproses garansi cuci ulang' });
  }
};

// ==========================================
// 14. SISTEM KOMISI OTOMATIS STAF PRODUKSI & KURIR
// ==========================================

export const DEFAULT_COMMISSION_CONFIG = {
  enabled: true,
  washingPerKg: 300,
  dryingPerKg: 200,
  ironingPerKg: 500,
  packingPerOrder: 500,
  deliveryPerTrip: 3000,
  pickupPerTrip: 2000,
  rewashPenaltyPerCase: 0,
  // Komisi Sales Kasir (P2)
  cashierCommissionEnabled: false,
  cashierCommissionBasis: 'PAID_ONLY' as 'PAID_ONLY' | 'ALL_ORDERS',
  cashierCommissionTiers: [
    { minSales: 5000000, percent: 1.5 },
    { minSales: 10000000, percent: 3.0 },
  ],
};

export const getLaundryCommissionConfig = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const { outletId } = req.query;

    let outlet = null;
    if (outletId && typeof outletId === 'string') {
      outlet = await prisma.outlet.findFirst({
        where: { id: outletId, tenantId },
        select: { id: true, name: true, laundryCommissionConfig: true },
      });
    }

    if (!outlet) {
      outlet = await prisma.outlet.findFirst({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, laundryCommissionConfig: true },
      });
    }

    const rawConfig = outlet?.laundryCommissionConfig;
    const config = {
      ...DEFAULT_COMMISSION_CONFIG,
      ...(typeof rawConfig === 'object' && rawConfig !== null ? rawConfig : {}),
    };

    return res.status(200).json({
      status: 'success',
      data: {
        outletId: outlet?.id,
        outletName: outlet?.name,
        config,
      },
    });
  } catch (error: any) {
    console.error('Error getLaundryCommissionConfig:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil konfigurasi komisi' });
  }
};

export const updateLaundryCommissionConfig = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const role = (req.user?.role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(role)) {
      return res.status(403).json({ status: 'error', message: 'Hanya Owner, Admin, atau Supervisor yang dapat mengubah tarif komisi' });
    }

    const { outletId, config } = req.body;
    const src = config && typeof config === 'object' ? { ...req.body, ...config } : req.body;

    let targetOutletId = outletId || src.outletId;
    if (!targetOutletId) {
      const firstOutlet = await prisma.outlet.findFirst({
        where: { tenantId, isActive: true },
        select: { id: true },
      });
      targetOutletId = firstOutlet?.id;
    }

    if (!targetOutletId) {
      return res.status(404).json({ status: 'error', message: 'Toko/Outlet tidak ditemukan' });
    }

    const outlet = await prisma.outlet.findFirst({
      where: { id: targetOutletId, tenantId },
    });
    if (!outlet) {
      return res.status(404).json({ status: 'error', message: 'Outlet tidak ditemukan atau akses ditolak' });
    }

    const existingConfig = (outlet.laundryCommissionConfig as any) || {};

    const washRate = src.washingPerKg !== undefined
      ? Math.max(0, Math.round(Number(src.washingPerKg || 0)))
      : (src.washPerKg !== undefined ? Math.max(0, Math.round(Number(src.washPerKg || 0))) : Number(existingConfig.washingPerKg || existingConfig.washPerKg || 0));

    const dryRate = src.dryingPerKg !== undefined
      ? Math.max(0, Math.round(Number(src.dryingPerKg || 0)))
      : (src.dryPerKg !== undefined ? Math.max(0, Math.round(Number(src.dryPerKg || 0))) : Number(existingConfig.dryingPerKg || existingConfig.dryPerKg || 0));

    const ironRate = src.ironingPerKg !== undefined
      ? Math.max(0, Math.round(Number(src.ironingPerKg || 0)))
      : (src.ironPerKg !== undefined ? Math.max(0, Math.round(Number(src.ironPerKg || 0))) : Number(existingConfig.ironingPerKg || existingConfig.ironPerKg || 0));

    const isProdEnabled = src.productionCommissionEnabled !== undefined
      ? Boolean(src.productionCommissionEnabled)
      : (src.enabled !== undefined ? Boolean(src.enabled) : (existingConfig.productionCommissionEnabled ?? existingConfig.enabled ?? true));

    const cleanConfig = {
      ...existingConfig,
      enabled: isProdEnabled,
      productionCommissionEnabled: isProdEnabled,
      washingPerKg: washRate,
      washPerKg: washRate,
      dryingPerKg: dryRate,
      dryPerKg: dryRate,
      ironingPerKg: ironRate,
      ironPerKg: ironRate,
      packingPerOrder: src.packingPerOrder !== undefined ? Math.max(0, Math.round(Number(src.packingPerOrder || 0))) : Number(existingConfig.packingPerOrder || 0),
      deliveryPerTrip: src.deliveryPerTrip !== undefined ? Math.max(0, Math.round(Number(src.deliveryPerTrip || 0))) : Number(existingConfig.deliveryPerTrip || 0),
      pickupPerTrip: src.pickupPerTrip !== undefined ? Math.max(0, Math.round(Number(src.pickupPerTrip || 0))) : Number(existingConfig.pickupPerTrip || 0),
      rewashPenaltyPerCase: src.rewashPenaltyPerCase !== undefined ? Math.max(0, Math.round(Number(src.rewashPenaltyPerCase || 0))) : Number(existingConfig.rewashPenaltyPerCase || 0),
      cashierCommissionEnabled: src.cashierCommissionEnabled !== undefined ? Boolean(src.cashierCommissionEnabled) : Boolean(existingConfig.cashierCommissionEnabled),
      cashierCommissionBasis: src.cashierCommissionBasis || existingConfig.cashierCommissionBasis || 'PAID_ONLY',
      cashierCommissionTiers: src.cashierCommissionTiers || existingConfig.cashierCommissionTiers || [],
    };

    const updated = await prisma.outlet.update({
      where: { id: targetOutletId },
      data: {
        laundryCommissionConfig: cleanConfig,
      },
      select: {
        id: true,
        name: true,
        laundryCommissionConfig: true,
      },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Konfigurasi komisi staf & kurir berhasil disimpan',
      data: updated.laundryCommissionConfig,
    });
  } catch (error: any) {
    console.error('Error updateLaundryCommissionConfig:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui konfigurasi komisi' });
  }
};

export const getLaundryCommissions = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const { outletId, startDate, endDate, search } = req.query;

    // 1. Ambil config outlet aktif
    let targetOutlet = null;
    if (outletId && typeof outletId === 'string') {
      targetOutlet = await prisma.outlet.findFirst({
        where: { id: outletId, tenantId },
        select: { id: true, name: true, laundryCommissionConfig: true },
      });
    }
    if (!targetOutlet) {
      targetOutlet = await prisma.outlet.findFirst({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, laundryCommissionConfig: true },
      });
    }

    const rawConfig = targetOutlet?.laundryCommissionConfig;
    const config = {
      ...DEFAULT_COMMISSION_CONFIG,
      ...(typeof rawConfig === 'object' && rawConfig !== null ? rawConfig : {}),
    };

    // 2. Tentukan rentang tanggal
    const now = new Date();
    let start: Date;
    let end: Date;

    if (startDate && typeof startDate === 'string') {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
    } else {
      // Default: Awal bulan berjalan
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }

    if (endDate && typeof endDate === 'string') {
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    }

    // 3. Ambil data LaundryStageLog dalam rentang tanggal
    const stageLogs = await prisma.laundryStageLog.findMany({
      where: {
        tenantId,
        completedAt: {
          gte: start,
          lte: end,
        },
        order: {
          ...(outletId ? { outletId: String(outletId) } : {}),
          orderStatus: { notIn: [OrderStatus.VOIDED, OrderStatus.CANCELLED] },
        },
      },
      include: {
        order: {
          select: { id: true, invoiceNumber: true, outletId: true, orderStatus: true },
        },
      },
      orderBy: { completedAt: 'asc' },
    });

    // 4. Ambil data LaundryOrderDetail dengan deliveryStatus = 'DELIVERED'
    const deliveries = await prisma.laundryOrderDetail.findMany({
      where: {
        tenantId,
        deliveryStatus: 'DELIVERED',
        status: { not: 'CANCELLED' },
        ...(outletId ? { outletId: String(outletId) } : {}),
        deliveredAt: {
          gte: start,
          lte: end,
        },
        order: {
          orderStatus: { notIn: [OrderStatus.VOIDED, OrderStatus.CANCELLED] },
        },
      },
      include: {
        order: {
          select: { id: true, invoiceNumber: true, outletId: true, orderStatus: true },
        },
      },
    });

    // 4b. Ambil data Order untuk Komisi Sales Kasir (Tiered)
    const cashierOrders = await prisma.order.findMany({
      where: {
        tenantId,
        ...(outletId ? { outletId: String(outletId) } : {}),
        createdAt: { gte: start, lte: end },
        orderStatus: { notIn: [OrderStatus.VOIDED, OrderStatus.CANCELLED] },
        ...(config.cashierCommissionBasis === 'PAID_ONLY' ? { paymentStatus: 'PAID' } : {}),
      },
      select: {
        id: true,
        userId: true,
        totalAmount: true,
        cashier: { select: { id: true, name: true, userCode: true } },
      },
    });

    // 4c. Ambil data Kasbon Karyawan yang masih aktif (OPEN / PARTIAL)
    const activeAdvances = await prisma.staffCashAdvance.findMany({
      where: {
        tenantId,
        ...(outletId ? { outletId: String(outletId) } : {}),
        status: { in: ['OPEN', 'PARTIAL'] },
      },
      select: {
        id: true,
        staffId: true,
        staffName: true,
        remainingAmount: true,
      },
    });

    const advancesMap: Record<string, number> = {};
    for (const adv of activeAdvances) {
      const rem = Number(adv.remainingAmount || 0);
      if (adv.staffId) {
        advancesMap[adv.staffId] = (advancesMap[adv.staffId] || 0) + rem;
      }
      const nameKey = (adv.staffName || '').trim().toLowerCase();
      if (nameKey) {
        advancesMap[nameKey] = (advancesMap[nameKey] || 0) + rem;
      }
    }

    // 5. Akumulasi data per staf / kurir
    const staffMap: Record<string, {
      staffId?: string;
      name: string;
      roleType: 'OPERATOR' | 'COURIER' | 'CASHIER' | 'BOTH';
      washingKg: number;
      dryingKg: number;
      ironingKg: number;
      packingOrders: number;
      rewashCount: number;
      pickupTrips: number;
      deliveryTrips: number;
      washingCommission: number;
      dryingCommission: number;
      ironingCommission: number;
      packingCommission: number;
      deliveryCommission: number;
      rewashPenalty: number;
      productionCommission: number;
      cashierSales: number;
      cashierOrders: number;
      appliedTierPercent: number;
      cashierCommission: number;
      outstandingCashAdvance: number;
      totalCommission: number;
    }> = {};

    const getOrCreateStaff = (name: string, staffId?: string | null) => {
      const cleanName = (name || 'Staf Laundry').trim();
      const key = cleanName.toLowerCase();
      if (!staffMap[key]) {
        staffMap[key] = {
          staffId: staffId || undefined,
          name: cleanName,
          roleType: 'OPERATOR',
          washingKg: 0,
          dryingKg: 0,
          ironingKg: 0,
          packingOrders: 0,
          rewashCount: 0,
          pickupTrips: 0,
          deliveryTrips: 0,
          washingCommission: 0,
          dryingCommission: 0,
          ironingCommission: 0,
          packingCommission: 0,
          deliveryCommission: 0,
          rewashPenalty: 0,
          productionCommission: 0,
          cashierSales: 0,
          cashierOrders: 0,
          appliedTierPercent: 0,
          cashierCommission: 0,
          outstandingCashAdvance: 0,
          totalCommission: 0,
        };
      }
      return staffMap[key];
    };

    // Akumulasi Stage Logs (Produksi)
    for (const log of stageLogs) {
      const staff = getOrCreateStaff(log.operatorName || 'Operator Produksi', log.operatorId);
      const stage = String(log.stage || '').toUpperCase();
      const kg = Number(log.weightKg || 0);

      if (['WASHING', 'CUCI'].includes(stage)) {
        staff.washingKg += kg;
      } else if (['DRYING', 'KERING'].includes(stage)) {
        staff.dryingKg += kg;
      } else if (['IRONING', 'SETRIKA', 'EXTRA_SETRIKA'].includes(stage)) {
        staff.ironingKg += kg;
      } else if (['PACKING', 'PENGEMASAN'].includes(stage)) {
        staff.packingOrders += 1;
      } else if (['REWASH'].includes(stage)) {
        staff.rewashCount += 1;
      }
    }

    // Akumulasi Deliveries (Kurir)
    for (const d of deliveries) {
      const courierName = d.courierName || 'Kurir Delivery';
      const staff = getOrCreateStaff(courierName);

      const type = String(d.deliveryType || 'NONE').toUpperCase();
      if (type === 'DELIVERY_ONLY') {
        staff.deliveryTrips += 1;
      } else if (type === 'PICKUP_ONLY') {
        staff.pickupTrips += 1;
      } else if (type === 'PICKUP_AND_DELIVERY') {
        staff.pickupTrips += 1;
        staff.deliveryTrips += 1;
      }
    }

    // Akumulasi Komisi Sales Kasir (Tiered)
    const cashierTiers: Array<{ minSales: number; percent: number }> = Array.isArray(config.cashierCommissionTiers)
      ? [...config.cashierCommissionTiers].sort((a, b) => b.minSales - a.minSales)
      : [];

    const cashierAggregation: Record<string, { name: string; totalSales: number; orderCount: number }> = {};
    for (const ord of cashierOrders) {
      const cId = ord.userId;
      const cName = ord.cashier?.name || 'Kasir';
      if (!cashierAggregation[cId]) {
        cashierAggregation[cId] = { name: cName, totalSales: 0, orderCount: 0 };
      }
      cashierAggregation[cId].totalSales += Number(ord.totalAmount || 0);
      cashierAggregation[cId].orderCount += 1;
    }

    for (const [cId, cData] of Object.entries(cashierAggregation)) {
      const staff = getOrCreateStaff(cData.name, cId);
      staff.cashierSales = Math.round(cData.totalSales * 100) / 100;
      staff.cashierOrders = cData.orderCount;

      const matchedTier = cashierTiers.find((t) => cData.totalSales >= t.minSales);
      if (matchedTier && config.cashierCommissionEnabled !== false) {
        staff.appliedTierPercent = matchedTier.percent;
        staff.cashierCommission = Math.round(cData.totalSales * (matchedTier.percent / 100));
      } else {
        staff.appliedTierPercent = 0;
        staff.cashierCommission = 0;
      }
    }

    // 6. Hitung komisi dan tentukan roleType
    let totalProductionCommission = 0;
    let totalDeliveryCommission = 0;
    let totalCashierCommission = 0;
    let totalPenalty = 0;
    let grandTotalCommission = 0;
    let totalWashingKg = 0;
    let totalDryingKg = 0;
    let totalIroningKg = 0;
    let totalTripsCompleted = 0;
    let totalOutstandingAdvances = 0;

    const staffList = Object.values(staffMap).map((s) => {
      // Pembulatan angka tonase
      s.washingKg = Math.round(s.washingKg * 100) / 100;
      s.dryingKg = Math.round(s.dryingKg * 100) / 100;
      s.ironingKg = Math.round(s.ironingKg * 100) / 100;

      s.washingCommission = Math.round(s.washingKg * config.washingPerKg);
      s.dryingCommission = Math.round(s.dryingKg * config.dryingPerKg);
      s.ironingCommission = Math.round(s.ironingKg * config.ironingPerKg);
      s.packingCommission = s.packingOrders * config.packingPerOrder;

      s.deliveryCommission =
        s.deliveryTrips * config.deliveryPerTrip + s.pickupTrips * config.pickupPerTrip;

      s.rewashPenalty = s.rewashCount * (config.rewashPenaltyPerCase || 0);

      s.productionCommission =
        s.washingCommission + s.dryingCommission + s.ironingCommission + s.packingCommission;

      s.totalCommission = Math.max(
        0,
        s.productionCommission + s.deliveryCommission + (s.cashierCommission || 0) - s.rewashPenalty
      );

      // Kaitkan Kasbon Aktif
      const advTotal = (s.staffId && advancesMap[s.staffId]) || advancesMap[s.name.toLowerCase()] || 0;
      s.outstandingCashAdvance = Math.round(advTotal * 100) / 100;

      // Tentukan peran
      const hasProd = s.washingKg > 0 || s.dryingKg > 0 || s.ironingKg > 0 || s.packingOrders > 0;
      const hasCourier = s.deliveryTrips > 0 || s.pickupTrips > 0;
      const hasCashier = (s.cashierCommission || 0) > 0 || (s.cashierSales || 0) > 0;

      const rolesActive = [hasProd, hasCourier, hasCashier].filter(Boolean).length;
      if (rolesActive > 1) {
        s.roleType = 'BOTH';
      } else if (hasCourier) {
        s.roleType = 'COURIER';
      } else if (hasCashier) {
        s.roleType = 'CASHIER';
      } else {
        s.roleType = 'OPERATOR';
      }

      // Akumulasi ringkasan
      totalProductionCommission += s.productionCommission;
      totalDeliveryCommission += s.deliveryCommission;
      totalCashierCommission += s.cashierCommission || 0;
      totalPenalty += s.rewashPenalty;
      grandTotalCommission += s.totalCommission;
      totalWashingKg += s.washingKg;
      totalDryingKg += s.dryingKg;
      totalIroningKg += s.ironingKg;
      totalTripsCompleted += s.deliveryTrips + s.pickupTrips;
      totalOutstandingAdvances += s.outstandingCashAdvance;

      return s;
    });

    // Urutkan staf berdasarkan total komisi tertinggi
    staffList.sort((a, b) => b.totalCommission - a.totalCommission);

    // Filter search jika ada
    let filteredStaff = staffList;
    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      filteredStaff = staffList.filter((s) => s.name.toLowerCase().includes(q));
    }

    const summary = {
      totalStaff: filteredStaff.length,
      totalProductionCommission,
      totalDeliveryCommission,
      totalCashierCommission,
      totalPenalty,
      grandTotalCommission,
      totalOutstandingAdvances,
      totalKgProcessed: Math.round((totalWashingKg + totalDryingKg + totalIroningKg) * 100) / 100,
      totalTripsCompleted,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };

    return res.status(200).json({
      status: 'success',
      data: {
        config,
        summary,
        staff: filteredStaff,
      },
    });
  } catch (error: any) {
    console.error('Error getLaundryCommissions:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil laporan komisi staf & kurir' });
  }
};

/**
 * Controller: Pencatatan Pencairan Kas Komisi Staf/Kurir (STAFF_COMMISSION)
 * @route POST /api/laundry/commissions/payout
 */
export const payoutLaundryCommission = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ status: 'error', message: 'Konteks autentikasi tidak valid' });
    }

    const { outletId, staffName, staffId, amount, periodLabel, notes, deductCashAdvanceAmount } = req.body;

    if (!outletId || typeof outletId !== 'string') {
      return res.status(400).json({ status: 'error', message: 'Outlet ID wajib diisi' });
    }
    if (!staffName || typeof staffName !== 'string' || !staffName.trim()) {
      return res.status(400).json({ status: 'error', message: 'Nama staf/kurir wajib diisi' });
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ status: 'error', message: 'Nominal pencairan komisi harus lebih dari Rp 0' });
    }

    const numDeductAdvance = Number(deductCashAdvanceAmount) > 0 ? Number(deductCashAdvanceAmount) : 0;
    const netPayout = Math.max(0, numAmount - numDeductAdvance);

    // 1. Validasi kepemilikan outlet
    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId },
    });
    if (!outlet) {
      return res.status(404).json({
        status: 'error',
        message: 'Outlet tidak ditemukan atau tidak sesuai dengan akses akun Anda.',
      });
    }

    // 2. Cari shift yang benar-benar sedang terbuka
    const activeShift = await prisma.shift.findFirst({
      where: {
        outletId,
        status: ShiftStatus.OPEN,
      },
      orderBy: { startTime: 'desc' },
    });

    if (!activeShift) {
      return res.status(400).json({
        status: 'error',
        message: 'Shift kasir belum dibuka. Buka shift kasir terlebih dahulu sebelum mencatat pencairan komisi dari kas laci.',
      });
    }

    const shiftId = activeShift.id;

    const movementNotes = `Pencairan Komisi: ${staffName.trim()}${
      numDeductAdvance > 0 ? ` (Komisi Rp ${numAmount.toLocaleString('id-ID')} - Potong Kasbon Rp ${numDeductAdvance.toLocaleString('id-ID')})` : ''
    }${periodLabel ? ` [${periodLabel}]` : ''}${notes ? ` - ${notes.trim()}` : ''}`;

    const result = await prisma.$transaction(async (tx) => {
      // Potong kasbon secara FIFO jika ada deductCashAdvanceAmount
      if (numDeductAdvance > 0) {
        const advances = await tx.staffCashAdvance.findMany({
          where: {
            tenantId,
            outletId,
            status: { in: ['OPEN', 'PARTIAL'] },
            ...(staffId ? { staffId } : { staffName: { equals: staffName.trim(), mode: 'insensitive' } }),
          },
          orderBy: { createdAt: 'asc' },
        });

        let remainingToDeduct = numDeductAdvance;
        for (const adv of advances) {
          if (remainingToDeduct <= 0) break;
          const currentRem = Number(adv.remainingAmount || 0);
          const deduction = Math.min(currentRem, remainingToDeduct);
          const newRem = currentRem - deduction;
          await tx.staffCashAdvance.update({
            where: { id: adv.id },
            data: {
              remainingAmount: newRem,
              status: newRem <= 0 ? 'PAID' : 'PARTIAL',
            },
          });
          remainingToDeduct -= deduction;
        }
      }

      let movement = null;
      if (netPayout > 0) {
        movement = await tx.cashMovement.create({
          data: {
            tenantId,
            outletId,
            shiftId,
            userId,
            type: 'CASH_OUT',
            category: 'STAFF_COMMISSION',
            amount: netPayout,
            notes: movementNotes,
          },
        });

        await tx.shift.update({
          where: { id: activeShift.id },
          data: {
            expectedEnding: { decrement: netPayout },
          },
        });
      }

      return { movement, netPayout, deductedAdvance: numDeductAdvance };
    });

    return res.status(201).json({
      status: 'success',
      message: `Pencairan komisi Rp ${numAmount.toLocaleString('id-ID')} untuk ${staffName} berhasil diproses.${
        numDeductAdvance > 0 ? ` Dipotong kasbon Rp ${numDeductAdvance.toLocaleString('id-ID')}, kas keluar laci: Rp ${netPayout.toLocaleString('id-ID')}` : ''
      }`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error in payoutLaundryCommission:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mencatat pencairan komisi', error: error?.message });
  }
};

/**
 * Controller: Daftar Kasbon Karyawan (P2)
 * @route GET /api/laundry/cash-advances
 */
export const getStaffCashAdvances = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks autentikasi tidak valid' });
    }

    const { outletId, status, search } = req.query;

    const where: any = { tenantId };
    if (outletId && typeof outletId === 'string') where.outletId = outletId;
    if (status && typeof status === 'string' && status !== 'ALL') where.status = status;
    if (search && typeof search === 'string' && search.trim()) {
      where.staffName = { contains: search.trim(), mode: 'insensitive' };
    }

    const advances = await prisma.staffCashAdvance.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        staff: { select: { id: true, name: true, userCode: true, role: true } },
        outlet: { select: { id: true, name: true } },
        shift: { select: { id: true, startTime: true, endTime: true, status: true } },
      },
    });

    // KPI total outstanding
    const outstandingAgg = await prisma.staffCashAdvance.aggregate({
      where: {
        tenantId,
        ...(outletId ? { outletId: String(outletId) } : {}),
        status: { in: ['OPEN', 'PARTIAL'] },
      },
      _sum: { remainingAmount: true },
      _count: true,
    });

    return res.status(200).json({
      status: 'success',
      data: advances,
      summary: {
        totalOutstandingAmount: Number(outstandingAgg._sum.remainingAmount || 0),
        totalActiveAdvances: outstandingAgg._count || 0,
      },
    });
  } catch (error: any) {
    console.error('Error in getStaffCashAdvances:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil data kasbon karyawan' });
  }
};

/**
 * Controller: Catat Kasbon Karyawan Baru (P2)
 * @route POST /api/laundry/cash-advances
 */
export const createStaffCashAdvance = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id;
    const userRole = (req.user?.role || '').toUpperCase();

    if (!tenantId || !userId) {
      return res.status(401).json({ status: 'error', message: 'Konteks autentikasi tidak valid' });
    }

    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(userRole)) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Hanya Owner, Admin, atau Supervisor yang berhak mencatat kasbon karyawan',
      });
    }

    const { outletId, staffId, staffName, amount, reason, deductFromOpenShift } = req.body;

    if (!outletId || typeof outletId !== 'string') {
      return res.status(400).json({ status: 'error', message: 'Outlet ID wajib diisi' });
    }
    if (!staffName || typeof staffName !== 'string' || !staffName.trim()) {
      return res.status(400).json({ status: 'error', message: 'Nama staf wajib diisi' });
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ status: 'error', message: 'Nominal kasbon harus lebih dari Rp 0' });
    }

    let activeShiftId: string | null = null;
    if (deductFromOpenShift) {
      const activeShift = await prisma.shift.findFirst({
        where: { outletId, status: ShiftStatus.OPEN },
        orderBy: { startTime: 'desc' },
      });
      if (!activeShift) {
        return res.status(400).json({
          status: 'error',
          message: 'Pencairan kasbon dari laci kasir gagal: Tidak ada shift kasir yang sedang aktif di outlet ini.',
        });
      }
      activeShiftId = activeShift.id;
    }

    const result = await prisma.$transaction(async (tx) => {
      const advance = await tx.staffCashAdvance.create({
        data: {
          tenantId,
          outletId,
          staffId: staffId || null,
          staffName: staffName.trim(),
          amount: numAmount,
          remainingAmount: numAmount,
          status: 'OPEN',
          reason: reason?.trim() || null,
          shiftId: activeShiftId,
          createdById: userId,
        },
        include: {
          staff: { select: { id: true, name: true, userCode: true } },
          outlet: { select: { id: true, name: true } },
        },
      });

      if (activeShiftId) {
        await tx.cashMovement.create({
          data: {
            tenantId,
            outletId,
            shiftId: activeShiftId,
            userId,
            type: 'CASH_OUT',
            category: 'STAFF_CASH_ADVANCE',
            amount: numAmount,
            notes: `Kasbon Karyawan: ${staffName.trim()}${reason ? ` (${reason.trim()})` : ''}`,
          },
        });

        await tx.shift.update({
          where: { id: activeShiftId },
          data: { expectedEnding: { decrement: numAmount } },
        });
      }

      return advance;
    });

    return res.status(201).json({
      status: 'success',
      message: `Kasbon Rp ${numAmount.toLocaleString('id-ID')} untuk ${staffName} berhasil dicatat${
        activeShiftId ? ' dan kas keluar laci berhasil dicatat' : ''
      }`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error in createStaffCashAdvance:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mencatat kasbon karyawan' });
  }
};

/**
 * Controller: Pelunasan / Cicilan Kasbon Karyawan Manual (P2)
 * @route PATCH /api/laundry/cash-advances/:id/repay
 */
export const repayStaffCashAdvance = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userRole = (req.user?.role || '').toUpperCase();

    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks autentikasi tidak valid' });
    }

    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(userRole)) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Hanya Owner, Admin, atau Supervisor yang berhak mencatat pelunasan kasbon',
      });
    }

    const { id } = req.params;
    const { amount, notes } = req.body;

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ status: 'error', message: 'Nominal pelunasan kasbon harus lebih dari Rp 0' });
    }

    const advance = await prisma.staffCashAdvance.findFirst({
      where: { id, tenantId },
    });

    if (!advance) {
      return res.status(404).json({ status: 'error', message: 'Data kasbon tidak ditemukan' });
    }

    const currentRemaining = Number(advance.remainingAmount);
    const newRemaining = Math.max(0, currentRemaining - numAmount);
    const newStatus = newRemaining <= 0 ? 'PAID' : 'PARTIAL';

    const updated = await prisma.staffCashAdvance.update({
      where: { id },
      data: {
        remainingAmount: newRemaining,
        status: newStatus,
        reason: notes ? `${advance.reason || ''} [Pelunasan: ${notes.trim()}]`.trim() : advance.reason,
      },
    });

    return res.status(200).json({
      status: 'success',
      message: `Pelunasan kasbon Rp ${numAmount.toLocaleString('id-ID')} berhasil dicatat. Sisa kasbon: Rp ${newRemaining.toLocaleString('id-ID')}`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error in repayStaffCashAdvance:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mencatat pelunasan kasbon' });
  }
};

/**
 * Helper: Logika Inti Pengingat Otomatis (Stale Rack & Expiring Quota)
 */
export const runLaundryAutoReminders = async (
  tenantId: string,
  outletId?: string,
  options?: { dryRun?: boolean }
) => {
  const isDryRun = options?.dryRun === true;
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // 1. Ambil Kandidat Cucian Mengendap di Rak (>= 3 hari)
  const staleDetails = await prisma.laundryOrderDetail.findMany({
    where: {
      tenantId,
      ...(outletId ? { outletId } : {}),
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
      currentStage: { in: ['RACK_STORAGE', 'READY_FOR_PICKUP'] },
      order: {
        orderStatus: { notIn: [OrderStatus.CANCELLED, OrderStatus.VOIDED, OrderStatus.COMPLETED] },
      },
      OR: [
        { completedAt: { lte: threeDaysAgo } },
        { completedAt: null, updatedAt: { lte: threeDaysAgo } },
      ],
      AND: [
        {
          OR: [
            { lastReminderSentAt: null },
            { lastReminderSentAt: { lte: seventyTwoHoursAgo } },
          ],
        },
      ],
    },
    include: {
      order: {
        include: {
          customer: true,
          outlet: true,
          customerDebts: true,
        },
      },
    },
    orderBy: { updatedAt: 'asc' },
  });

  const staleCandidates = staleDetails.map((detail) => {
    const order = detail.order;
    const completedOrUpdated = detail.completedAt || detail.updatedAt;
    const daysAging = Math.max(3, Math.floor((now.getTime() - new Date(completedOrUpdated).getTime()) / (24 * 60 * 60 * 1000)));

    let remaining = 0;
    if (order.paymentStatus !== 'PAID') {
      const activeDebt = order.customerDebts?.find((d) => d.status === 'UNPAID' || d.status === 'PARTIAL');
      remaining = activeDebt ? Number(activeDebt.remainingAmount) : Math.max(0, Number(order.totalAmount || 0) - Number(order.paidAmount || 0));
    }

    return {
      detailId: detail.id,
      orderId: order.id,
      invoiceNumber: order.invoiceNumber,
      rackCode: detail.rackCode || 'KASIR',
      customerName: order.customer?.name || 'Pelanggan',
      customerPhone: order.customer?.phone || null,
      daysAging,
      remainingAmount: remaining,
      outletName: order.outlet.name,
      lastReminderSentAt: detail.lastReminderSentAt,
      outletReceiptConfig: (order.outlet as any)?.receiptConfig,
    };
  });

  // 2. Ambil Kandidat Kuota Kiloan Akan Expired (H-1)
  const expiringWallets = await prisma.customerLaundryWallet.findMany({
    where: {
      tenantId,
      quotaKg: { gt: 0 },
      quotaExpiresAt: {
        gte: now,
        lte: twentyFourHoursFromNow,
      },
      OR: [
        { lastExpiryReminderSentAt: null },
        { lastExpiryReminderSentAt: { lte: twentyFourHoursAgo } },
      ],
    },
    include: {
      customer: true,
    },
  });

  let defaultOutletName = 'Outlet Laundry';
  let defaultReceiptConfig = null;
  const outletInfo = await prisma.outlet.findFirst({
    where: { tenantId, ...(outletId ? { id: outletId } : { isActive: true }) },
    select: { name: true, receiptConfig: true },
  });
  if (outletInfo) {
    defaultOutletName = outletInfo.name;
    defaultReceiptConfig = outletInfo.receiptConfig;
  }

  const expiringCandidates = expiringWallets.map((w) => ({
    walletId: w.id,
    customerId: w.customerId,
    customerName: w.customer.name,
    customerPhone: w.customer.phone,
    remainingQuotaKg: Number(w.quotaKg),
    quotaExpiresAt: w.quotaExpiresAt,
    expiryDateStr: w.quotaExpiresAt
      ? new Date(w.quotaExpiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : '',
    outletName: defaultOutletName,
    receiptConfig: defaultReceiptConfig,
    lastExpiryReminderSentAt: w.lastExpiryReminderSentAt,
  }));

  let sentCount = 0;
  let failedCount = 0;

  if (!isDryRun) {
    for (const item of staleCandidates) {
      if (!item.customerPhone) {
        failedCount++;
        continue;
      }
      try {
        const sendRes = await whatsAppService.sendStaleRackReminder({
          phone: item.customerPhone,
          customerName: item.customerName,
          invoiceNumber: item.invoiceNumber,
          rackCode: item.rackCode,
          daysAging: item.daysAging,
          remainingAmount: item.remainingAmount,
          outletName: item.outletName,
          receiptConfig: item.outletReceiptConfig,
        });

        if (sendRes.status === 'success') {
          await prisma.laundryOrderDetail.update({
            where: { id: item.detailId },
            data: { lastReminderSentAt: now },
          });
          sentCount++;
        } else {
          failedCount++;
        }
      } catch (err) {
        console.error(`[AUTO-REMINDER] Gagal kirim WA ke ${item.customerPhone}:`, err);
        failedCount++;
      }
    }

    for (const item of expiringCandidates) {
      if (!item.customerPhone) {
        failedCount++;
        continue;
      }
      try {
        const sendRes = await whatsAppService.sendQuotaExpiryReminder({
          phone: item.customerPhone,
          customerName: item.customerName,
          remainingQuotaKg: item.remainingQuotaKg,
          expiryDateStr: item.expiryDateStr,
          outletName: item.outletName,
          receiptConfig: item.receiptConfig,
        });

        if (sendRes.status === 'success') {
          await prisma.customerLaundryWallet.update({
            where: { id: item.walletId },
            data: { lastExpiryReminderSentAt: now },
          });
          sentCount++;
        } else {
          failedCount++;
        }
      } catch (err) {
        console.error(`[AUTO-REMINDER] Gagal kirim WA ke ${item.customerPhone}:`, err);
        failedCount++;
      }
    }
  }

  return {
    isDryRun,
    summary: {
      totalStaleRack: staleCandidates.length,
      totalExpiringQuota: expiringCandidates.length,
      totalCandidates: staleCandidates.length + expiringCandidates.length,
      sentCount,
      failedCount,
    },
    staleCandidates,
    expiringCandidates,
  };
};

/**
 * Controller: Eksekusi / Preview Auto-Reminder WA (P2)
 * @route POST /api/laundry/reminders/run
 */
export const executeLaundryAutoReminders = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userRole = (req.user?.role || '').toUpperCase();

    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks autentikasi tidak valid' });
    }

    if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(userRole)) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Hanya Owner, Admin, atau Supervisor yang berhak menjalankan auto-reminder',
      });
    }

    const { outletId, dryRun } = req.body;
    const isDryRun = dryRun !== false;

    const result = await runLaundryAutoReminders(tenantId, outletId, { dryRun: isDryRun });

    return res.status(200).json({
      status: 'success',
      message: isDryRun
        ? `Preview auto-reminder berhasil dimuat: ${result.summary.totalCandidates} kandidat ditemukan`
        : `Auto-reminder berhasil dijalankan: ${result.summary.sentCount} terkirim, ${result.summary.failedCount} gagal`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error executeLaundryAutoReminders:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menjalankan auto-reminder WhatsApp' });
  }
};

/**
 * Controller: Agregasi Dashboard Pintar Berbasis Peran Laundry (Owner, Kasir, Produksi)
 * @route GET /api/laundry/dashboard-summary
 */
export const getLaundryDashboardSummary = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id;
    const userRole = (req.user?.role || '').toUpperCase();

    if (!tenantId || !userId) {
      return res.status(401).json({ status: 'error', message: 'Konteks autentikasi tidak valid' });
    }

    // 1. Tentukan Role Mode
    let roleMode: 'OWNER' | 'CASHIER' | 'PRODUCTION' = 'OWNER';
    if (userRole === Role.CASHIER) {
      roleMode = 'CASHIER';
    } else if (userRole === Role.WAREHOUSE || userRole === Role.KITCHEN || userRole === Role.WAITER) {
      roleMode = 'PRODUCTION';
    } else {
      roleMode = 'OWNER';
    }

    // 2. Tentukan Scoping Outlet
    let effectiveOutletId = req.user?.outletId || undefined;
    if (!effectiveOutletId && req.query.outletId && req.query.outletId !== 'ALL') {
      effectiveOutletId = String(req.query.outletId);
    }

    // 3. Parser Rentang Waktu (WIB / GMT+7)
    const nowUtc = new Date();
    const nowWib = new Date(nowUtc.getTime() + 7 * 3600_000);
    const currYear = nowWib.getUTCFullYear();
    const currMonth = String(nowWib.getUTCMonth() + 1).padStart(2, '0');
    const currDay = String(nowWib.getUTCDate()).padStart(2, '0');

    const defaultStartStr = `${currYear}-${currMonth}-01`;
    const defaultEndStr = `${currYear}-${currMonth}-${currDay}`;

    const startDateStr = (req.query.startDate as string) || defaultStartStr;
    const endDateStr = (req.query.endDate as string) || defaultEndStr;

    const startDateTime = new Date(`${startDateStr}T00:00:00.000+07:00`);
    const endDateTime = new Date(`${endDateStr}T23:59:59.999+07:00`);

    const durationMs = Math.max(1, endDateTime.getTime() - startDateTime.getTime() + 1);
    const prevStartDateTime = new Date(startDateTime.getTime() - durationMs);
    const prevEndDateTime = new Date(startDateTime.getTime() - 1);

    const diffDays = Math.ceil(durationMs / (24 * 3600_000));
    let granularity = ((req.query.granularity as string) || '').toUpperCase();
    if (!['DAY', 'MONTH'].includes(granularity)) {
      granularity = diffDays > 62 ? 'MONTH' : 'DAY';
    }

    // Today WIB boundaries for operational widgets
    const todayStartWib = new Date(`${currYear}-${currMonth}-${currDay}T00:00:00.000+07:00`);
    const todayEndWib = new Date(`${currYear}-${currMonth}-${currDay}T23:59:59.999+07:00`);

    // =========================================================================
    // A. JALUR ROLE CASHIER (FRONT-DESK) — ZERO OVERALL OMZET / PROFIT
    // =========================================================================
    if (roleMode === 'CASHIER') {
      // 1. Shift Aktif Kasir
      const activeShift = await prisma.shift.findFirst({
        where: {
          tenantId,
          status: 'OPEN',
          ...(effectiveOutletId ? { outletId: effectiveOutletId } : {}),
        },
        include: {
          user: { select: { id: true, name: true, userCode: true } },
          paymentTransactions: { where: { status: 'CAPTURED' } },
        },
        orderBy: { startTime: 'desc' },
      });

      let shiftSummary = null;
      if (activeShift) {
        const cashPayments = activeShift.paymentTransactions
          .filter((p) => p.paymentMethod === 'CASH')
          .reduce((acc, p) => acc + Number(p.amount), 0);
        const nonCashPayments = activeShift.paymentTransactions
          .filter((p) => p.paymentMethod !== 'CASH')
          .reduce((acc, p) => acc + Number(p.amount), 0);
        const startCash = Number(activeShift.startingCash || 0);

        shiftSummary = {
          id: activeShift.id,
          cashierName: activeShift.user?.name || req.user?.name || 'Kasir',
          startTime: activeShift.startTime,
          startingCash: startCash,
          cashInTunai: cashPayments,
          totalCashDrawer: startCash + cashPayments,
          nonTunaiAmount: nonCashPayments,
        };
      }

      // 2. Daftar Siap Diambil di Rak (Ready for Pickup)
      const readyOrders = await prisma.order.findMany({
        where: {
          tenantId,
          ...(effectiveOutletId ? { outletId: effectiveOutletId } : {}),
          orderStatus: { notIn: ['COMPLETED', 'VOIDED', 'CANCELLED'] },
          laundryDetail: {
            currentStage: { in: ['READY', 'RACK_STORAGE', 'PENGEMASAN', 'READY_FOR_PICKUP'] },
          },
        },
        include: {
          customer: true,
          laundryDetail: true,
          customerDebts: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 30,
      });

      const readyForPickupOrders = readyOrders.map((o) => {
        const debtRem = o.customerDebts?.reduce((acc, d) => acc + Number(d.remainingAmount || 0), 0) || 0;
        const totalAmt = Number(o.totalAmount || 0);
        const paidAmt = Number(o.paidAmount || 0);
        const remainingAmount = debtRem > 0 ? debtRem : Math.max(0, totalAmt - paidAmt);

        return {
          id: o.id,
          invoiceNumber: o.invoiceNumber,
          customerName: o.customer?.name || 'Pelanggan',
          customerPhone: o.customer?.phone || null,
          rackCode: o.laundryDetail?.rackCode || 'RAK',
          weightKg: o.laundryDetail?.totalWeightKg ? Number(o.laundryDetail.totalWeightKg) : null,
          totalPieces: o.laundryDetail?.totalPieces || 0,
          paymentStatus: o.paymentStatus,
          remainingAmount,
          isPaid: o.paymentStatus === 'PAID',
        };
      });

      // 3. Pengiriman / Kurir Hari Ini
      const todayDeliveriesCount = await prisma.laundryOrderDetail.count({
        where: {
          tenantId,
          ...(effectiveOutletId ? { outletId: effectiveOutletId } : {}),
          deliveryType: { not: 'NONE' },
          createdAt: { gte: todayStartWib, lte: todayEndWib },
        },
      });

      // 4. Cucian Mengendap di Rak (> 3 Hari)
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600_000);
      const staleOrders = await prisma.order.findMany({
        where: {
          tenantId,
          ...(effectiveOutletId ? { outletId: effectiveOutletId } : {}),
          orderStatus: { notIn: ['COMPLETED', 'VOIDED', 'CANCELLED'] },
          laundryDetail: {
            rackCode: { not: null },
            currentStage: { in: ['READY', 'RACK_STORAGE', 'PENGEMASAN', 'READY_FOR_PICKUP'] },
          },
          updatedAt: { lte: threeDaysAgo },
        },
        include: {
          customer: true,
          laundryDetail: true,
          customerDebts: true,
        },
        orderBy: { updatedAt: 'asc' },
        take: 15,
      });

      const staleRackOrders = staleOrders.map((o) => {
        const daysOnRack = Math.max(3, Math.floor((Date.now() - o.updatedAt.getTime()) / (24 * 3600_000)));
        const debtRem = o.customerDebts?.reduce((acc, d) => acc + Number(d.remainingAmount || 0), 0) || 0;
        const totalAmt = Number(o.totalAmount || 0);
        const paidAmt = Number(o.paidAmount || 0);
        const remainingAmount = debtRem > 0 ? debtRem : Math.max(0, totalAmt - paidAmt);

        return {
          id: o.id,
          invoiceNumber: o.invoiceNumber,
          customerName: o.customer?.name || 'Pelanggan',
          customerPhone: o.customer?.phone || null,
          rackCode: o.laundryDetail?.rackCode || 'RAK',
          daysOnRack,
          remainingAmount,
          isPaid: o.paymentStatus === 'PAID',
        };
      });

      return res.status(200).json({
        status: 'success',
        data: {
          roleMode: 'CASHIER',
          outletId: effectiveOutletId || null,
          activeShift: shiftSummary,
          readyForPickupOrders,
          todayDeliveriesCount,
          staleRackOrders,
        },
      });
    }

    // =========================================================================
    // B. JALUR ROLE PRODUKSI (WORKSHOP) — ZERO NOMINAL RUPIAH
    // =========================================================================
    if (roleMode === 'PRODUCTION') {
      // 1. Beban Kerja Stasiun & Antrean Aktual (Tanpa Uang)
      const activeLaundryOrders = await prisma.order.findMany({
        where: {
          tenantId,
          ...(effectiveOutletId ? { outletId: effectiveOutletId } : {}),
          orderStatus: { notIn: ['COMPLETED', 'VOIDED', 'CANCELLED'] },
          laundryDetail: { isNot: null },
        },
        include: {
          laundryDetail: true,
        },
      });

      let sortingCount = 0;
      let sortingKg = 0;
      let washingDryingCount = 0;
      let washingDryingKg = 0;
      let ironingFoldingCount = 0;
      let ironingFoldingKg = 0;
      let readyCount = 0;
      let readyKg = 0;
      let overdueCount = 0;
      let dueTodayCount = 0;

      const nowTime = Date.now();
      for (const ord of activeLaundryOrders) {
        const det = ord.laundryDetail;
        if (!det) continue;
        const stg = (det.currentStage || '').toUpperCase();
        const kg = Number(det.totalWeightKg || 0);

        if (['DROP_OFF', 'LABEL', 'TAGGING', 'SORTIR', 'SORTING', 'RECEIVED'].includes(stg)) {
          sortingCount++;
          sortingKg += kg;
        } else if (['CUCI', 'WASHING', 'KERING', 'DRYING'].includes(stg)) {
          washingDryingCount++;
          washingDryingKg += kg;
        } else if (['SETRIKA', 'IRONING', 'LIPAT', 'FOLDING', 'PACKING', 'IRONING_PACKING'].includes(stg)) {
          ironingFoldingCount++;
          ironingFoldingKg += kg;
        } else if (['READY', 'RACK_STORAGE', 'PENGEMASAN', 'READY_FOR_PICKUP'].includes(stg)) {
          readyCount++;
          readyKg += kg;
        }

        if (det.estimatedReadyAt) {
          const estTime = new Date(det.estimatedReadyAt).getTime();
          if (estTime < nowTime) {
            overdueCount++;
          } else if (estTime >= todayStartWib.getTime() && estTime <= todayEndWib.getTime()) {
            dueTodayCount++;
          }
        }
      }

      const pipelineCounts = {
        sorting: { orderCount: sortingCount, totalKg: Number(sortingKg.toFixed(1)) },
        washingDrying: { orderCount: washingDryingCount, totalKg: Number(washingDryingKg.toFixed(1)) },
        ironingFolding: { orderCount: ironingFoldingCount, totalKg: Number(ironingFoldingKg.toFixed(1)) },
        readyForPickup: { orderCount: readyCount, totalKg: Number(readyKg.toFixed(1)) },
        overdueCount,
        dueTodayCount,
      };

      // 2. Antrean Prioritas SLA (Overdue, Due Today, Rewash)
      const urgentOrders = await prisma.order.findMany({
        where: {
          tenantId,
          ...(effectiveOutletId ? { outletId: effectiveOutletId } : {}),
          orderStatus: { notIn: ['COMPLETED', 'VOIDED', 'CANCELLED'] },
          laundryDetail: {
            currentStage: { notIn: ['READY', 'RACK_STORAGE', 'PENGEMASAN', 'READY_FOR_PICKUP', 'HANDOVER'] },
            OR: [
              { defectNotes: { contains: 'REWASH' } },
              { estimatedReadyAt: { lte: todayEndWib } },
            ],
          },
        },
        include: {
          customer: true,
          laundryDetail: true,
          items: true,
        },
        orderBy: [
          { laundryDetail: { estimatedReadyAt: 'asc' } },
        ],
        take: 15,
      });

      const urgentQueue = urgentOrders.map((o) => {
        const isOverdue = Boolean(o.laundryDetail?.estimatedReadyAt && new Date(o.laundryDetail.estimatedReadyAt).getTime() < nowTime);
        const isRewash = Boolean(o.laundryDetail?.defectNotes?.includes('REWASH'));
        const serviceName = o.items?.[0]?.productName || 'Layanan Laundry';

        return {
          id: o.id,
          invoiceNumber: o.invoiceNumber,
          customerName: o.customer?.name || 'Pelanggan',
          serviceName,
          weightKg: o.laundryDetail?.totalWeightKg ? Number(o.laundryDetail.totalWeightKg) : null,
          totalPieces: o.laundryDetail?.totalPieces || 0,
          perfumeVariant: o.laundryDetail?.perfumeVariant,
          currentStage: o.laundryDetail?.currentStage,
          machineName: null,
          estimatedReadyAt: o.laundryDetail?.estimatedReadyAt,
          isRewash,
          isOverdue,
        };
      });

      // 3. Status Mesin Aktif (Log Riil)
      const unfinishedIds = activeLaundryOrders.map((o) => o.id);
      let activeMachines: any[] = [];
      if (unfinishedIds.length > 0) {
        const stageLogs = await prisma.laundryStageLog.findMany({
          where: {
            orderId: { in: unfinishedIds },
            machineName: { not: null },
          },
          include: {
            operator: { select: { id: true, name: true } },
            order: { select: { invoiceNumber: true, laundryDetail: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });

        // Dedup per machineName
        const seenMachines = new Set<string>();
        for (const log of stageLogs) {
          if (log.machineName && !seenMachines.has(log.machineName)) {
            seenMachines.add(log.machineName);
            activeMachines.push({
              machineName: log.machineName,
              stage: log.stage,
              invoiceNumber: log.order?.invoiceNumber,
              weightKg: log.order?.laundryDetail?.totalWeightKg ? Number(log.order.laundryDetail.totalWeightKg) : null,
              operatorName: log.operator?.name || log.operatorName || 'Operator',
              startedAt: log.createdAt,
            });
          }
        }
      }

      // 4. Bahan Cuci Menipis (Hanya Nama, Sisa Stok & UoM — Tanpa Harga)
      const inventoryItems = await prisma.inventoryItem.findMany({
        where: {
          tenantId,
          isActive: true,
          OR: [
            { laundryBomItems: { some: {} } },
            { reorderPoint: { gt: 0 } },
          ],
        },
        include: {
          balances: {
            where: effectiveOutletId ? { storageLocation: { outletId: effectiveOutletId } } : {},
          },
        },
        take: 8,
      });

      const lowStockSupplies = inventoryItems.map((item) => {
        const totalStock = item.balances.reduce((acc, b) => acc + Number(b.quantityOnHand), 0);
        const reorderPoint = Number(item.reorderPoint || 0);
        return {
          name: item.name,
          uom: item.canonicalUom,
          quantityOnHand: totalStock,
          reorderPoint,
          isLow: reorderPoint > 0 && totalStock <= reorderPoint,
        };
      });

      // 5. Output Saya Hari Ini
      const myLogs = await prisma.laundryStageLog.findMany({
        where: {
          tenantId,
          operatorId: userId,
          createdAt: { gte: todayStartWib, lte: todayEndWib },
        },
        include: {
          order: {
            select: {
              laundryDetail: { select: { totalWeightKg: true } },
            },
          },
        },
      });

      const myUniqueOrders = new Set(myLogs.map((l) => l.orderId)).size;
      const myTotalKg = myLogs.reduce((acc, l) => acc + Number(l.order?.laundryDetail?.totalWeightKg || 0), 0);

      const myOutputToday = {
        orderCount: myUniqueOrders,
        totalKg: Number(myTotalKg.toFixed(1)),
        stageActionsCount: myLogs.length,
      };

      return res.status(200).json({
        status: 'success',
        data: {
          roleMode: 'PRODUCTION',
          outletId: effectiveOutletId || null,
          pipelineCounts,
          urgentQueue,
          activeMachines,
          lowStockSupplies,
          myOutputToday,
        },
      });
    }

    // =========================================================================
    // C. JALUR ROLE OWNER / ADMIN / SUPERVISOR (MODE LENGKAP)
    // =========================================================================

    // 1. Agregasi Highlights Keuangan & Performa Utama
    const currentOrdersAgg = await prisma.order.aggregate({
      where: {
        tenantId,
        ...(effectiveOutletId ? { outletId: effectiveOutletId } : {}),
        orderStatus: { notIn: ['VOIDED', 'CANCELLED'] },
        createdAt: { gte: startDateTime, lte: endDateTime },
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    });
    const totalOmzet = Number(currentOrdersAgg._sum.totalAmount || 0);
    const totalTransactions = currentOrdersAgg._count.id;
    const avgOrderValue = totalTransactions > 0 ? Math.round(totalOmzet / totalTransactions) : 0;

    // Omzet Periode Sebelumnya
    const prevOrdersAgg = await prisma.order.aggregate({
      where: {
        tenantId,
        ...(effectiveOutletId ? { outletId: effectiveOutletId } : {}),
        orderStatus: { notIn: ['VOIDED', 'CANCELLED'] },
        createdAt: { gte: prevStartDateTime, lte: prevEndDateTime },
      },
      _sum: { totalAmount: true },
    });
    const prevOmzet = Number(prevOrdersAgg._sum.totalAmount || 0);
    const omzetGrowthPercent = prevOmzet > 0
      ? Number((((totalOmzet - prevOmzet) / prevOmzet) * 100).toFixed(1))
      : 0;

    // Breakdown Omzet: Kiloan vs Satuan
    const splitResult: any = await prisma.$queryRawUnsafe(`
      SELECT 
        COALESCE(SUM(CASE WHEN (
          COALESCE(oi.pricing_basis, CASE WHEN UPPER(COALESCE(oi.unit, ls.unit, '')) IN ('KG', 'PER_KG') THEN 'KILOAN' ELSE 'SATUAN' END) = 'KILOAN'
        ) THEN oi.subtotal ELSE 0 END), 0) AS "kiloanOmzet",
        COALESCE(SUM(CASE WHEN (
          COALESCE(oi.pricing_basis, CASE WHEN UPPER(COALESCE(oi.unit, ls.unit, '')) IN ('KG', 'PER_KG') THEN 'KILOAN' ELSE 'SATUAN' END) = 'SATUAN'
        ) THEN oi.subtotal ELSE 0 END), 0) AS "satuanOmzet"
      FROM "order_items" oi
      JOIN "orders" o ON o.id = oi.order_id
      LEFT JOIN LATERAL (
        SELECT unit
        FROM "laundry_services"
        WHERE tenant_id = o.tenant_id AND LOWER(name) = LOWER(oi.product_name)
        ORDER BY is_active DESC, updated_at DESC
        LIMIT 1
      ) ls ON true
      WHERE o.tenant_id = $1
        AND o.order_status NOT IN ('VOIDED', 'CANCELLED')
        AND o.created_at >= $2 AND o.created_at <= $3
        AND ($4::text IS NULL OR o.outlet_id = $4::text)
    `, tenantId, startDateTime, endDateTime, effectiveOutletId || null);

    const totalOmzetKiloan = Number(splitResult[0]?.kiloanOmzet || 0);
    const totalOmzetSatuan = Number(splitResult[0]?.satuanOmzet || 0);

    // Kas Masuk Riil (Payment Transactions CAPTURED)
    const cashInRes: any = await prisma.$queryRawUnsafe(`
      SELECT COALESCE(SUM(amount), 0) AS "cashIn"
      FROM "payment_transactions"
      WHERE tenant_id = $1
        AND status = 'CAPTURED'
        AND created_at >= $2 AND created_at <= $3
        AND ($4::text IS NULL OR outlet_id = $4::text)
    `, tenantId, startDateTime, endDateTime, effectiveOutletId || null);
    const cashIn = Number(cashInRes[0]?.cashIn || 0);

    // Sisa Piutang Aktif (CustomerDebt UNPAID / PARTIAL)
    const receivablesRes: any = await prisma.$queryRawUnsafe(`
      SELECT COALESCE(SUM(remaining_amount), 0) AS "receivables"
      FROM "customer_debts"
      WHERE tenant_id = $1
        AND status IN ('UNPAID', 'PARTIAL')
        AND ($2::text IS NULL OR outlet_id = $2::text)
    `, tenantId, effectiveOutletId || null);
    const outstandingReceivables = Number(receivablesRes[0]?.receivables || 0);

    // Estimasi HPP BoM (InventoryLedger PRODUCTION_CONSUMPTION)
    const bomRes: any = await prisma.$queryRawUnsafe(`
      SELECT COALESCE(SUM(ABS(il.quantity_delta) * il.unit_cost), 0) AS "bomCost"
      FROM "inventory_ledgers" il
      LEFT JOIN "storage_locations" sl ON sl.id = il.storage_location_id
      WHERE il.tenant_id = $1
        AND il.movement_type = 'PRODUCTION_CONSUMPTION'
        AND il.created_at >= $2 AND il.created_at <= $3
        AND ($4::text IS NULL OR sl.outlet_id = $4::text)
    `, tenantId, startDateTime, endDateTime, effectiveOutletId || null);
    const estimatedBomCost = Number(bomRes[0]?.bomCost || 0);

    // Pengeluaran Kas Operasional / Kas Keluar Shift
    const cashOutRes: any = await prisma.$queryRawUnsafe(`
      SELECT 
        COALESCE(SUM(amount), 0) AS "totalCashOut",
        COALESCE(SUM(CASE WHEN category = 'STAFF_COMMISSION' THEN amount ELSE 0 END), 0) AS "commissionPaid"
      FROM "cash_movements"
      WHERE tenant_id = $1
        AND type = 'CASH_OUT'
        AND created_at >= $2 AND created_at <= $3
        AND ($4::text IS NULL OR outlet_id = $4::text)
    `, tenantId, startDateTime, endDateTime, effectiveOutletId || null);
    const totalCashOut = Number(cashOutRes[0]?.totalCashOut || 0);
    const paidCommissions = Number(cashOutRes[0]?.commissionPaid || 0);

    // Estimasi Komisi Staf/Kurir: gunakan paidCommissions jika ada, atau estimasi 10% omzet bila belum dicairkan
    const estimatedCommissions = paidCommissions;
    const shiftCashOut = Math.max(0, totalCashOut - paidCommissions);

    // Laba Operasional & Margin
    const estimatedOperatingProfit = totalOmzet - estimatedBomCost - shiftCashOut - estimatedCommissions;
    const operatingMarginPercent = totalOmzet > 0
      ? Number(((estimatedOperatingProfit / totalOmzet) * 100).toFixed(1))
      : 0;

    // Total Tonase (Kg) & Helai Satuan
    const tonaseRes: any = await prisma.$queryRawUnsafe(`
      SELECT 
        COALESCE(SUM(lod.total_weight_kg), 0) AS "totalKg",
        COALESCE(SUM(lod.total_pieces), 0) AS "totalPcs"
      FROM "orders" o
      JOIN "laundry_order_details" lod ON lod.order_id = o.id
      WHERE o.tenant_id = $1
        AND o.order_status NOT IN ('VOIDED', 'CANCELLED')
        AND o.created_at >= $2 AND o.created_at <= $3
        AND ($4::text IS NULL OR o.outlet_id = $4::text)
    `, tenantId, startDateTime, endDateTime, effectiveOutletId || null);
    const totalWeightKg = Number(Number(tonaseRes[0]?.totalKg || 0).toFixed(1));
    const totalPieces = Number(tonaseRes[0]?.totalPcs || 0);

    // Analisis Pelanggan Aktif: Total, Baru, dan Repeat
    const custAggRes: any = await prisma.$queryRawUnsafe(`
      WITH customer_orders AS (
        SELECT 
          o.customer_id,
          MIN(o.created_at) AS first_order_date
        FROM "orders" o
        WHERE o.tenant_id = $1
          AND o.order_status NOT IN ('VOIDED', 'CANCELLED')
          AND o.customer_id IS NOT NULL
        GROUP BY o.customer_id
      ),
      period_customers AS (
        SELECT DISTINCT o.customer_id
        FROM "orders" o
        WHERE o.tenant_id = $1
          AND o.order_status NOT IN ('VOIDED', 'CANCELLED')
          AND o.customer_id IS NOT NULL
          AND o.created_at >= $2 AND o.created_at <= $3
          AND ($4::text IS NULL OR o.outlet_id = $4::text)
      )
      SELECT 
        COUNT(pc.customer_id) AS "total",
        COUNT(CASE WHEN co.first_order_date >= $2 AND co.first_order_date <= $3 THEN 1 END) AS "newCustomers",
        COUNT(CASE WHEN co.first_order_date < $2 THEN 1 END) AS "repeatCustomers"
      FROM period_customers pc
      JOIN customer_orders co ON co.customer_id = pc.customer_id
    `, tenantId, startDateTime, endDateTime, effectiveOutletId || null);

    const activeCustomers = {
      total: Number(custAggRes[0]?.total || 0),
      newCustomers: Number(custAggRes[0]?.newCustomers || 0),
      repeatCustomers: Number(custAggRes[0]?.repeatCustomers || 0),
    };

    // 2. Pembentukan revenueSeries (Grafik Garis Kiloan vs Satuan)
    // Pre-populate seluruh bucket dalam rentang tanggal agar garis kontinu mulus tanpa loncatan
    const bucketMap = new Map<string, { key: string; label: string; kiloanOmzet: number; satuanOmzet: number; totalOmzet: number; orderCount: number }>();

    if (granularity === 'MONTH') {
      const [startYear, startMonth] = startDateStr.split('-').map(Number);
      const [endYear, endMonth] = endDateStr.split('-').map(Number);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

      let y = startYear;
      let m = startMonth;
      while (y < endYear || (y === endYear && m <= endMonth)) {
        const mStr = String(m).padStart(2, '0');
        const bKey = `${y}-${mStr}`;
        const bLabel = monthNames[m - 1] || mStr;
        if (!bucketMap.has(bKey)) {
          bucketMap.set(bKey, { key: bKey, label: bLabel, kiloanOmzet: 0, satuanOmzet: 0, totalOmzet: 0, orderCount: 0 });
        }
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
    } else {
      // Loop tiap hari dari startDateStr hingga endDateStr secara UTC calendar murni
      const [sy, sm, sd] = startDateStr.split('-').map(Number);
      const [ey, em, ed] = endDateStr.split('-').map(Number);
      const cur = new Date(Date.UTC(sy, sm - 1, sd));
      const end = new Date(Date.UTC(ey, em - 1, ed));

      while (cur <= end) {
        const y = cur.getUTCFullYear();
        const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
        const d = String(cur.getUTCDate()).padStart(2, '0');
        const bKey = `${y}-${m}-${d}`;
        const bLabel = `${d}/${m}`;
        if (!bucketMap.has(bKey)) {
          bucketMap.set(bKey, { key: bKey, label: bLabel, kiloanOmzet: 0, satuanOmzet: 0, totalOmzet: 0, orderCount: 0 });
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    // Query agregasi time-series aktual
    const seriesSql = `
      SELECT 
        CASE 
          WHEN $5 = 'MONTH' THEN TO_CHAR(o.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM')
          ELSE TO_CHAR(o.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')
        END AS "bucketKey",
        COUNT(DISTINCT o.id) AS "orderCount",
        COALESCE(SUM(CASE WHEN (
          COALESCE(oi.pricing_basis, CASE WHEN UPPER(COALESCE(oi.unit, ls.unit, '')) IN ('KG', 'PER_KG') THEN 'KILOAN' ELSE 'SATUAN' END) = 'KILOAN'
        ) THEN oi.subtotal ELSE 0 END), 0) AS "kiloanOmzet",
        COALESCE(SUM(CASE WHEN (
          COALESCE(oi.pricing_basis, CASE WHEN UPPER(COALESCE(oi.unit, ls.unit, '')) IN ('KG', 'PER_KG') THEN 'KILOAN' ELSE 'SATUAN' END) = 'SATUAN'
        ) THEN oi.subtotal ELSE 0 END), 0) AS "satuanOmzet",
        COALESCE(SUM(oi.subtotal), 0) AS "totalOmzet"
      FROM "orders" o
      JOIN "order_items" oi ON oi.order_id = o.id
      LEFT JOIN LATERAL (
        SELECT unit
        FROM "laundry_services"
        WHERE tenant_id = o.tenant_id AND LOWER(name) = LOWER(oi.product_name)
        ORDER BY is_active DESC, updated_at DESC
        LIMIT 1
      ) ls ON true
      WHERE o.tenant_id = $1
        AND o.order_status NOT IN ('VOIDED', 'CANCELLED')
        AND o.created_at >= $2 AND o.created_at <= $3
        AND ($4::text IS NULL OR o.outlet_id = $4::text)
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const dbSeries: any = await prisma.$queryRawUnsafe(
      seriesSql,
      tenantId,
      startDateTime,
      endDateTime,
      effectiveOutletId || null,
      granularity
    );

    for (const row of dbSeries) {
      const bKey = String(row.bucketKey);
      if (bucketMap.has(bKey)) {
        const item = bucketMap.get(bKey)!;
        item.kiloanOmzet = Number(row.kiloanOmzet || 0);
        item.satuanOmzet = Number(row.satuanOmzet || 0);
        item.totalOmzet = Number(row.totalOmzet || 0);
        item.orderCount = Number(row.orderCount || 0);
      } else {
        bucketMap.set(bKey, {
          key: bKey,
          label: bKey,
          kiloanOmzet: Number(row.kiloanOmzet || 0),
          satuanOmzet: Number(row.satuanOmzet || 0),
          totalOmzet: Number(row.totalOmzet || 0),
          orderCount: Number(row.orderCount || 0),
        });
      }
    }

    const revenueSeries = Array.from(bucketMap.values());

    // 3. Panel Operasional Nyata (Kasir + Produksi + Rak + Mesin)
    // Pipeline order aktif
    const activeOrders = await prisma.order.findMany({
      where: {
        tenantId,
        ...(effectiveOutletId ? { outletId: effectiveOutletId } : {}),
        orderStatus: { notIn: ['COMPLETED', 'VOIDED', 'CANCELLED'] },
        laundryDetail: { isNot: null },
      },
      include: {
        laundryDetail: true,
      },
    });

    let sCount = 0;
    let wdCount = 0;
    let ipCount = 0;
    let rdyCount = 0;
    let odCount = 0;
    let dtCount = 0;
    const nowMs = Date.now();

    for (const ord of activeOrders) {
      const det = ord.laundryDetail;
      if (!det) continue;
      const stg = (det.currentStage || '').toUpperCase();
      if (['DROP_OFF', 'LABEL', 'TAGGING', 'SORTIR', 'SORTING', 'RECEIVED'].includes(stg)) sCount++;
      else if (['CUCI', 'WASHING', 'KERING', 'DRYING'].includes(stg)) wdCount++;
      else if (['SETRIKA', 'IRONING', 'LIPAT', 'FOLDING', 'PACKING', 'IRONING_PACKING'].includes(stg)) ipCount++;
      else if (['READY', 'RACK_STORAGE', 'PENGEMASAN', 'READY_FOR_PICKUP'].includes(stg)) rdyCount++;

      if (det.estimatedReadyAt) {
        const estTime = new Date(det.estimatedReadyAt).getTime();
        if (estTime < nowMs) odCount++;
        else if (estTime >= todayStartWib.getTime() && estTime <= todayEndWib.getTime()) dtCount++;
      }
    }

    const pipelineCounts = {
      sorting: sCount,
      washingDrying: wdCount,
      ironingFolding: ipCount,
      readyForPickup: rdyCount,
      overdueCount: odCount,
      dueTodayCount: dtCount,
    };

    // Shift Aktif
    const curShift = await prisma.shift.findFirst({
      where: {
        tenantId,
        status: 'OPEN',
        ...(effectiveOutletId ? { outletId: effectiveOutletId } : {}),
      },
      include: {
        user: { select: { id: true, name: true } },
        paymentTransactions: { where: { status: 'CAPTURED' } },
      },
      orderBy: { startTime: 'desc' },
    });

    let activeShiftData = null;
    if (curShift) {
      const cashIn = curShift.paymentTransactions.filter((p) => p.paymentMethod === 'CASH').reduce((acc, p) => acc + Number(p.amount), 0);
      const qrisIn = curShift.paymentTransactions.filter((p) => p.paymentMethod !== 'CASH').reduce((acc, p) => acc + Number(p.amount), 0);
      activeShiftData = {
        id: curShift.id,
        cashierName: curShift.user?.name || 'Kasir',
        startingCash: Number(curShift.startingCash || 0),
        cashInDrawer: Number(curShift.startingCash || 0) + cashIn,
        nonCashIn: qrisIn,
        startTime: curShift.startTime,
      };
    }

    // Setoran Kas Menunggu Verifikasi
    const pendingDepositsList = await prisma.shiftCashDeposit.findMany({
      where: {
        tenantId,
        status: 'PENDING',
        ...(effectiveOutletId ? { outletId: effectiveOutletId } : {}),
      },
      include: {
        cashier: { select: { id: true, name: true } },
        shift: { select: { id: true, startTime: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const pendingDeposits = {
      count: pendingDepositsList.length,
      totalAmount: pendingDepositsList.reduce((acc, d) => acc + Number(d.amount), 0),
      items: pendingDepositsList.slice(0, 3).map((d) => ({
        id: d.id,
        cashierName: d.cashier?.name || 'Kasir',
        amount: Number(d.amount),
        targetAccount: d.targetAccount,
        submittedAt: d.createdAt,
        notes: d.notes,
      })),
    };

    // Cucian Mengendap di Rak
    const threeDaysAgoTime = new Date(Date.now() - 3 * 24 * 3600_000);
    const sevenDaysAgoTime = new Date(Date.now() - 7 * 24 * 3600_000);

    const staleInRack = await prisma.order.findMany({
      where: {
        tenantId,
        ...(effectiveOutletId ? { outletId: effectiveOutletId } : {}),
        orderStatus: { notIn: ['COMPLETED', 'VOIDED', 'CANCELLED'] },
        laundryDetail: {
          rackCode: { not: null },
          currentStage: { in: ['READY', 'RACK_STORAGE', 'PENGEMASAN', 'READY_FOR_PICKUP'] },
        },
        updatedAt: { lte: threeDaysAgoTime },
      },
      select: { id: true, updatedAt: true },
    });

    const staleRack = {
      over3DaysCount: staleInRack.length,
      over7DaysCount: staleInRack.filter((o) => o.updatedAt <= sevenDaysAgoTime).length,
    };

    // Okupansi Rak (Dihitung dari data aktual laundry_order_details per rack_code)
    const racks = await prisma.laundryRack.findMany({
      where: {
        tenantId,
        ...(effectiveOutletId ? { outletId: effectiveOutletId } : {}),
      },
    });

    const occupiedRackCounts = await prisma.laundryOrderDetail.groupBy({
      by: ['rackCode'],
      where: {
        tenantId,
        ...(effectiveOutletId ? { outletId: effectiveOutletId } : {}),
        rackCode: { not: null },
        order: { orderStatus: { notIn: ['COMPLETED', 'VOIDED', 'CANCELLED'] } },
      },
      _count: { id: true },
    });

    const rackCountMap = new Map<string, number>();
    occupiedRackCounts.forEach((rc) => {
      if (rc.rackCode) rackCountMap.set(rc.rackCode, rc._count.id);
    });

    const totalCapacity = racks.reduce((acc, r) => acc + r.capacity, 0);
    const occupiedSlots = Array.from(rackCountMap.values()).reduce((acc, c) => acc + c, 0);

    const rackOccupancy = {
      occupiedSlots,
      totalCapacity,
      racks: racks.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        category: r.category,
        capacity: r.capacity,
        occupied: rackCountMap.get(r.code) || 0,
      })),
    };

    // Mesin Aktif Riil
    const activeOrderIds = activeOrders.map((o) => o.id);
    let activeMachines: any[] = [];
    if (activeOrderIds.length > 0) {
      const logs = await prisma.laundryStageLog.findMany({
        where: {
          orderId: { in: activeOrderIds },
          machineName: { not: null },
        },
        include: {
          operator: { select: { id: true, name: true } },
          order: { select: { invoiceNumber: true, laundryDetail: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const seen = new Set<string>();
      for (const log of logs) {
        if (log.machineName && !seen.has(log.machineName)) {
          seen.add(log.machineName);
          activeMachines.push({
            machineName: log.machineName,
            stage: log.stage,
            invoiceNumber: log.order?.invoiceNumber,
            weightKg: log.order?.laundryDetail?.totalWeightKg ? Number(log.order.laundryDetail.totalWeightKg) : null,
            operatorName: log.operator?.name || log.operatorName || 'Operator',
            startedAt: log.createdAt,
          });
        }
      }
    }

    // Bahan Cuci Menipis
    const rawInvItems = await prisma.inventoryItem.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { laundryBomItems: { some: {} } },
          { reorderPoint: { gt: 0 } },
        ],
      },
      include: {
        balances: {
          where: effectiveOutletId ? { storageLocation: { outletId: effectiveOutletId } } : {},
        },
      },
      take: 6,
    });

    const lowStockSupplies = rawInvItems.map((item) => {
      const qoh = item.balances.reduce((acc, b) => acc + Number(b.quantityOnHand), 0);
      const rp = Number(item.reorderPoint || 0);
      return {
        id: item.id,
        name: item.name,
        uom: item.canonicalUom,
        quantityOnHand: qoh,
        reorderPoint: rp,
        isLow: rp > 0 && qoh <= rp,
      };
    });

    return res.status(200).json({
      status: 'success',
      data: {
        roleMode: 'OWNER',
        outletId: effectiveOutletId || null,
        period: {
          startDate: startDateStr,
          endDate: endDateStr,
          granularity,
        },
        highlights: {
          totalOmzet,
          prevOmzet,
          omzetGrowthPercent,
          totalOmzetKiloan,
          totalOmzetSatuan,
          cashIn,
          outstandingReceivables,
          estimatedBomCost,
          shiftCashOut,
          estimatedCommissions,
          estimatedOperatingProfit,
          operatingMarginPercent,
          totalTransactions,
          totalWeightKg,
          totalPieces,
          avgOrderValue,
          activeCustomers,
        },
        revenueSeries,
        operations: {
          pipelineCounts,
          activeShift: activeShiftData,
          pendingDeposits,
          staleRack,
          rackOccupancy,
          activeMachines,
          lowStockSupplies,
        },
      },
    });
  } catch (error: any) {
    console.error('Error in getLaundryDashboardSummary:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memuat ringkasan dashboard laundry',
      error: error?.message,
    });
  }
};

// ==========================================
// 17. FEEDBACK & RATING GOOGLE REVIEW (FASE A)
// ==========================================

const submitLaundryFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  category: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});

const resolveLaundryFeedbackSchema = z.object({
  status: z.enum(['IN_REVIEW', 'RESOLVED']),
  resolutionNotes: z.string().optional().nullable(),
});

export const submitPublicLaundryFeedback = async (req: Request, res: Response) => {
  try {
    const { invoiceNumber } = req.params;
    if (!invoiceNumber) {
      return res.status(400).json({ status: 'error', message: 'Nomor nota invoice wajib diisi' });
    }

    const parseResult = submitLaundryFeedbackSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi form feedback gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { rating, category, comment, photoUrl } = parseResult.data;

    const order = await prisma.order.findFirst({
      where: {
        invoiceNumber: { equals: invoiceNumber.trim(), mode: 'insensitive' },
      },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            googleReviewUrl: true,
          },
        },
        laundryDetail: true,
        laundryFeedback: true,
      },
    });

    if (!order || !order.laundryDetail) {
      return res.status(404).json({ status: 'error', message: 'Nota pesanan laundry tidak ditemukan' });
    }

    // Validasi status: harus READY_FOR_PICKUP atau COMPLETED
    const allowedStages = ['READY', 'RACK_STORAGE', 'PENGEMASAN', 'READY_FOR_PICKUP', 'HANDOVER', 'COMPLETED'];
    const currentStage = (order.laundryDetail.currentStage || '').toUpperCase();
    const orderStatus = (order.orderStatus || '').toUpperCase();
    const detailStatus = (order.laundryDetail.status || '').toUpperCase();

    const isEligible =
      allowedStages.includes(currentStage) ||
      detailStatus === 'READY_FOR_PICKUP' ||
      detailStatus === 'COMPLETED' ||
      orderStatus === 'COMPLETED';

    if (!isEligible) {
      return res.status(400).json({
        status: 'error',
        message: 'Ulasan hanya dapat dikirim setelah cucian selesai diproses atau siap diambil.',
      });
    }

    // Tolak duplikat feedback untuk order yang sama
    if (order.laundryFeedback) {
      return res.status(409).json({
        status: 'error',
        message: 'Ulasan untuk pesanan ini sudah pernah dikirim sebelumnya.',
      });
    }

    const isComplaint = rating <= 3;

    const createdFeedback = await prisma.laundryCustomerFeedback.create({
      data: {
        tenantId: order.tenantId,
        outletId: order.outletId,
        orderId: order.id,
        customerId: order.customerId,
        rating,
        category: category || null,
        comment: comment?.trim() || null,
        photoUrl: photoUrl?.trim() || null,
        isComplaint,
        redirectedToGoogle: false,
        status: 'OPEN',
      },
    });

    const googleReviewUrl = order.outlet?.googleReviewUrl || null;
    const shouldRedirectToGoogle = rating >= 4 && Boolean(googleReviewUrl);

    return res.status(201).json({
      status: 'success',
      message:
        rating >= 4
          ? 'Terima kasih atas ulasan bintang 5 Anda!'
          : 'Terima kasih atas masukannya. Keluhan Anda telah kami catat untuk ditindaklanjuti oleh manajemen.',
      data: {
        feedback: createdFeedback,
        shouldRedirectToGoogle,
        googleReviewUrl,
      },
    });
  } catch (error: any) {
    console.error('Error submitPublicLaundryFeedback:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengirim ulasan/feedback laundry' });
  }
};

export const trackGoogleReviewClick = async (req: Request, res: Response) => {
  try {
    const { invoiceNumber } = req.params;
    if (!invoiceNumber) {
      return res.status(400).json({ status: 'error', message: 'Nomor invoice wajib diisi' });
    }

    const order = await prisma.order.findFirst({
      where: {
        invoiceNumber: { equals: invoiceNumber.trim(), mode: 'insensitive' },
      },
      include: {
        laundryFeedback: true,
      },
    });

    if (!order || !order.laundryFeedback) {
      return res.status(404).json({ status: 'error', message: 'Feedback pesanan tidak ditemukan' });
    }

    await prisma.laundryCustomerFeedback.update({
      where: { id: order.laundryFeedback.id },
      data: { redirectedToGoogle: true },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Klik Google Review berhasil dicatat',
    });
  } catch (error: any) {
    console.error('Error trackGoogleReviewClick:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mencatat klik Google Review' });
  }
};

export const getLaundryFeedbacks = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan' });
    }

    const {
      outletId,
      status,
      onlyComplaints,
      minRating,
      maxRating,
      startDate,
      endDate,
    } = req.query;

    const where: any = { tenantId };

    if (outletId && outletId !== 'ALL') {
      where.outletId = String(outletId);
    }
    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status.toUpperCase();
    }
    if (String(onlyComplaints) === 'true') {
      where.isComplaint = true;
    }
    if (minRating || maxRating) {
      where.rating = {};
      if (minRating) where.rating.gte = Number(minRating);
      if (maxRating) where.rating.lte = Number(maxRating);
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(`${startDate}T00:00:00.000+07:00`);
      if (endDate) where.createdAt.lte = new Date(`${endDate}T23:59:59.999+07:00`);
    }

    const feedbacks = await prisma.laundryCustomerFeedback.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            paidAmount: true,
            createdAt: true,
            items: {
              select: {
                productName: true,
                quantity: true,
                unit: true,
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        outlet: {
          select: {
            id: true,
            name: true,
          },
        },
        handledBy: {
          select: {
            id: true,
            name: true,
            userCode: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalCount = feedbacks.length;
    const totalRatingSum = feedbacks.reduce((acc, f) => acc + f.rating, 0);
    const averageRating = totalCount > 0 ? Number((totalRatingSum / totalCount).toFixed(1)) : 0;
    const totalComplaints = feedbacks.filter((f) => f.isComplaint).length;
    const openComplaints = feedbacks.filter((f) => f.isComplaint && f.status !== 'RESOLVED').length;
    const resolvedComplaints = feedbacks.filter((f) => f.isComplaint && f.status === 'RESOLVED').length;
    const googleRedirectCount = feedbacks.filter((f) => f.redirectedToGoogle).length;

    return res.status(200).json({
      status: 'success',
      data: {
        feedbacks,
        summary: {
          totalCount,
          averageRating,
          totalComplaints,
          openComplaints,
          resolvedComplaints,
          googleRedirectCount,
        },
      },
    });
  } catch (error: any) {
    console.error('Error getLaundryFeedbacks:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat data feedback & komplain' });
  }
};

export const resolveLaundryFeedback = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!tenantId || !userId) {
      return res.status(401).json({ status: 'error', message: 'Konteks autentikasi tidak ditemukan' });
    }

    const parseResult = resolveLaundryFeedbackSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi form tindak lanjut komplain gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { status, resolutionNotes } = parseResult.data;

    const feedback = await prisma.laundryCustomerFeedback.findFirst({
      where: { id, tenantId },
    });

    if (!feedback) {
      return res.status(404).json({ status: 'error', message: 'Data komplain / feedback tidak ditemukan' });
    }

    const updated = await prisma.laundryCustomerFeedback.update({
      where: { id },
      data: {
        status,
        resolutionNotes: resolutionNotes?.trim() || null,
        handledById: userId,
        resolvedAt: status === 'RESOLVED' ? new Date() : null,
      },
      include: {
        handledBy: { select: { id: true, name: true } },
      },
    });

    return res.status(200).json({
      status: 'success',
      message: status === 'RESOLVED' ? 'Komplain berhasil diselesaikan' : 'Status komplain diperbarui ke peninjauan',
      data: updated,
    });
  } catch (error: any) {
    console.error('Error resolveLaundryFeedback:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui status komplain' });
  }
};

// ==========================================
// 18. PELANGGAN PASIF (WIN-BACK WA) (FASE A)
// ==========================================

const sendCustomerWinbackSchema = z.object({
  outletId: z.string().uuid().optional(),
  promoId: z.string().uuid().optional().nullable(),
  customMessage: z.string().optional().nullable(),
  force: z.boolean().optional().default(false),
});

export const getDormantLaundryCustomers = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan' });
    }

    const days = Math.max(1, parseInt(req.query.inactiveDays as string) || 30);
    const effectiveOutletId =
      req.query.outletId && req.query.outletId !== 'ALL'
        ? String(req.query.outletId)
        : (req.user?.outletId || null);

    const cutoffDate = new Date(Date.now() - days * 24 * 3600_000);

    const rows: any = await prisma.$queryRawUnsafe(`
      SELECT 
        c.id AS "customerId",
        c.name,
        c.phone,
        c.last_winback_sent_at AS "lastWinbackSentAt",
        MAX(o.created_at) AS "lastOrderAt",
        COUNT(DISTINCT o.id)::int AS "totalOrders",
        COALESCE(SUM(o.grand_total), 0)::float AS "totalSpent"
      FROM "customers" c
      JOIN "orders" o ON o.customer_id = c.id
      JOIN "laundry_order_details" lod ON lod.order_id = o.id
      WHERE c.tenant_id = $1
        AND c.phone IS NOT NULL AND TRIM(c.phone) <> ''
        AND o.order_status NOT IN ('VOIDED', 'CANCELLED')
        AND ($2::text IS NULL OR o.outlet_id = $2::text)
      GROUP BY c.id, c.name, c.phone, c.last_winback_sent_at
      HAVING MAX(o.created_at) <= $3
      ORDER BY MAX(o.created_at) ASC
      LIMIT 100
    `, tenantId, effectiveOutletId, cutoffDate);

    const nowTime = Date.now();
    const customers = rows.map((r: any) => {
      const lastOrderTime = new Date(r.lastOrderAt).getTime();
      const daysSinceLastOrder = Math.max(days, Math.floor((nowTime - lastOrderTime) / (24 * 3600_000)));
      const recentlyContacted = Boolean(
        r.lastWinbackSentAt &&
        (nowTime - new Date(r.lastWinbackSentAt).getTime()) < 7 * 24 * 3600_000
      );
      const daysSinceContact = r.lastWinbackSentAt
        ? Math.floor((nowTime - new Date(r.lastWinbackSentAt).getTime()) / (24 * 3600_000))
        : null;

      return {
        customerId: r.customerId,
        name: r.name,
        phone: r.phone,
        lastOrderAt: r.lastOrderAt,
        daysSinceLastOrder,
        totalOrders: Number(r.totalOrders),
        totalSpent: Number(r.totalSpent),
        lastWinbackSentAt: r.lastWinbackSentAt,
        recentlyContacted,
        daysSinceContact,
      };
    });

    return res.status(200).json({
      status: 'success',
      data: {
        customers,
        totalDormant: customers.length,
        inactiveDays: days,
      },
    });
  } catch (error: any) {
    console.error('Error getDormantLaundryCustomers:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil daftar pelanggan pasif' });
  }
};

export const sendCustomerWinback = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const { customerId } = req.params;

    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks autentikasi tidak ditemukan' });
    }

    const parseResult = sendCustomerWinbackSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Data kirim sapaan win-back tidak valid',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { outletId: reqOutletId, promoId, customMessage, force } = parseResult.data;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      return res.status(404).json({ status: 'error', message: 'Pelanggan tidak ditemukan' });
    }

    if (!customer.phone || !customer.phone.trim()) {
      return res.status(400).json({ status: 'error', message: 'Pelanggan tidak memiliki nomor telepon / WhatsApp yang valid' });
    }

    // Anti-Spam Protection: cegah spam jika baru disapa dalam 7 hari terakhir (kecuali force === true)
    if (customer.lastWinbackSentAt && !force) {
      const daysSince = Math.floor((Date.now() - customer.lastWinbackSentAt.getTime()) / (24 * 3600_000));
      if (daysSince < 7) {
        return res.status(409).json({
          status: 'error',
          code: 'RECENTLY_CONTACTED',
          message: `Pelanggan ini baru saja disapa ${daysSince === 0 ? 'hari ini' : daysSince + ' hari yang lalu'}. Untuk mencegah komplain spam, sapaan hanya dapat dikirim kembali setelah 7 hari.`,
          daysSinceContact: daysSince,
        });
      }
    }

    // Ambil info outlet
    const resolvedOutletId = reqOutletId || req.user?.outletId;
    const outlet = await prisma.outlet.findFirst({
      where: {
        tenantId,
        ...(resolvedOutletId ? { id: resolvedOutletId } : {}),
      },
      select: {
        name: true,
        phone: true,
        address: true,
        receiptConfig: true,
      },
    });

    // Ambil info promo jika dipilih
    let promoCode: string | null = null;
    let promoDescription: string | null = null;
    if (promoId) {
      const promo = await prisma.promotion.findFirst({
        where: { id: promoId, tenantId, isActive: true },
      });
      if (promo) {
        promoCode = promo.code;
        promoDescription =
          promo.description ||
          `Diskon spesial ${
            promo.discountType === 'PERCENTAGE'
              ? promo.discountValue + '%'
              : 'Rp ' + Number(promo.discountValue).toLocaleString('id-ID')
          }`;
      }
    }

    const cleanPhone = whatsAppService.normalizePhone(customer.phone);
    const winbackParams = {
      customerName: customer.name,
      outletName: outlet?.name || 'Well Laundry',
      outletPhone: outlet?.phone || null,
      promoCode,
      promoDescription,
      customMessage: customMessage || null,
      receiptConfig: outlet?.receiptConfig,
    };

    const messageText = whatsAppService.formatLaundryWinbackText(winbackParams);
    const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;

    // Coba kirim via gateway jika aktif
    let sendResult: any = null;
    try {
      sendResult = await whatsAppService.sendLaundryWinbackNotification(customer.phone, winbackParams);
    } catch (waErr: any) {
      sendResult = {
        status: 'error',
        message: waErr?.message || 'Gateway WA offline',
        isMock: true,
      };
    }

    // Catat timestamp last_winback_sent_at
    const now = new Date();
    await prisma.customer.update({
      where: { id: customer.id },
      data: { lastWinbackSentAt: now },
    });

    return res.status(200).json({
      status: 'success',
      message:
        sendResult?.status === 'success'
          ? `Sapaan berhasil dikirim via WhatsApp ke ${customer.name}`
          : `Tautan WhatsApp siap dikirimkan untuk ${customer.name}`,
      data: {
        sendResult,
        waLink,
        lastWinbackSentAt: now,
      },
    });
  } catch (error: any) {
    console.error('Error sendCustomerWinback:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengirim sapaan win-back pelanggan' });
  }
};

// ==========================================
// 19. MANAJEMEN INSIDEN PRODUKSI (FASE B)
// ==========================================

export const createLaundryIncident = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const reportedById = req.user?.id;
    if (!tenantId || !reportedById) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const {
      outletId,
      orderId,
      incidentType,
      itemDescription,
      stage,
      machineName,
      responsibleStaffId,
      notes,
      photoUrls,
      estimatedCompensation,
    } = req.body;

    if (!orderId || !incidentType || !itemDescription) {
      return res.status(400).json({
        status: 'error',
        message: 'orderId, incidentType, dan itemDescription wajib diisi',
      });
    }

    // Validasi orderId milik tenant & outlet terkait
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
        ...(outletId ? { outletId } : {}),
      },
      include: {
        customer: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Pesanan laundry tidak ditemukan di outlet ini',
      });
    }

    const targetOutletId = outletId || order.outletId;

    // Hitung saran otomatis estimatedCompensation sesuai klausul nota (default: Math.min(Number(order.totalAmount) * 5, 100000), atau nominal yang diisi user jika > 0)
    let finalEstimatedComp = 0;
    if (estimatedCompensation !== undefined && estimatedCompensation !== null && Number(estimatedCompensation) > 0) {
      finalEstimatedComp = Number(estimatedCompensation);
    } else {
      finalEstimatedComp = Math.min(Number(order.totalAmount) * 5, 100000);
    }

    const incident = await prisma.laundryIncident.create({
      data: {
        tenantId,
        outletId: targetOutletId,
        orderId,
        incidentType,
        itemDescription: String(itemDescription).trim(),
        stage: stage ? String(stage).trim() : null,
        machineName: machineName ? String(machineName).trim() : null,
        responsibleStaffId: responsibleStaffId || null,
        reportedById,
        notes: notes ? String(notes).trim() : '',
        photoUrls: Array.isArray(photoUrls) ? photoUrls : [],
        estimatedCompensation: finalEstimatedComp,
        approvedCompensation: 0,
        status: 'OPEN',
      },
      include: {
        order: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
        reportedBy: { select: { id: true, name: true, role: true } },
        responsibleStaff: { select: { id: true, name: true, role: true } },
      },
    });

    return res.status(201).json({
      status: 'success',
      message: 'Laporan insiden berhasil dicatat',
      data: incident,
    });
  } catch (error: any) {
    console.error('Error createLaundryIncident:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal mencatat laporan insiden' });
  }
};

export const getLaundryIncidents = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const { outletId, status, incidentType, responsibleStaffId, orderId, startDate, endDate } = req.query;

    const where: any = { tenantId };
    if (outletId && typeof outletId === 'string') {
      where.outletId = outletId;
    }
    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }
    if (incidentType && typeof incidentType === 'string' && incidentType !== 'ALL') {
      where.incidentType = incidentType;
    }
    if (responsibleStaffId && typeof responsibleStaffId === 'string') {
      where.responsibleStaffId = responsibleStaffId;
    }
    if (orderId && typeof orderId === 'string') {
      where.orderId = orderId;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate && typeof startDate === 'string') {
        where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate && typeof endDate === 'string') {
        where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    const incidents = await prisma.laundryIncident.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            orderStatus: true,
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
        reportedBy: { select: { id: true, name: true, role: true } },
        responsibleStaff: { select: { id: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      status: 'success',
      data: incidents,
    });
  } catch (error: any) {
    console.error('Error getLaundryIncidents:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil daftar insiden' });
  }
};

export const updateLaundryIncident = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!tenantId || !userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    // Role check: Only OWNER, ADMIN, SUPERVISOR can approve/update incident status and compensation
    if (userRole !== Role.OWNER && userRole !== Role.ADMIN && userRole !== Role.SUPERVISOR) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Hanya Owner, Admin, atau Supervisor yang dapat menyetujui atau memperbarui insiden',
      });
    }

    const { id } = req.params;
    const { status, approvedCompensation, resolutionNotes } = req.body;

    const incident = await prisma.laundryIncident.findFirst({
      where: { id, tenantId },
    });

    if (!incident) {
      return res.status(404).json({ status: 'error', message: 'Insiden tidak ditemukan' });
    }

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === 'RESOLVED' || status === 'COMPENSATED') {
        updateData.resolvedAt = new Date();
        updateData.approvedById = userId;
      }
    }
    if (approvedCompensation !== undefined && approvedCompensation !== null) {
      updateData.approvedCompensation = Number(approvedCompensation);
      updateData.approvedById = userId;
    }
    if (resolutionNotes !== undefined) {
      updateData.resolutionNotes = resolutionNotes ? String(resolutionNotes).trim() : null;
    }

    const updated = await prisma.laundryIncident.update({
      where: { id },
      data: updateData,
      include: {
        order: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
        reportedBy: { select: { id: true, name: true, role: true } },
        responsibleStaff: { select: { id: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
      },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Status insiden berhasil diperbarui',
      data: updated,
    });
  } catch (error: any) {
    console.error('Error updateLaundryIncident:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui insiden' });
  }
};

// ==========================================
// 20. EVALUASI PERFORMA KARYAWAN (FASE B)
// ==========================================

export const getStaffPerformance = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userRole = req.user?.role;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    // Role check: Only OWNER, ADMIN, SUPERVISOR
    if (userRole !== Role.OWNER && userRole !== Role.ADMIN && userRole !== Role.SUPERVISOR) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Hanya Owner, Admin, atau Supervisor yang dapat melihat evaluasi performa',
      });
    }

    const { outletId, startDate, endDate, role } = req.query;

    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const startDateStr = (typeof startDate === 'string' && startDate) ? startDate : defaultStart;
    const endDateStr = (typeof endDate === 'string' && endDate) ? endDate : defaultEnd;

    const staffWhere: any = {
      tenantId,
      isActive: true,
    };
    if (outletId && typeof outletId === 'string') {
      staffWhere.OR = [
        { outletId },
        { outletId: null },
      ];
    }
    if (role && typeof role === 'string' && role !== 'ALL') {
      staffWhere.role = role;
    }

    const staffMembers = await prisma.user.findMany({
      where: staffWhere,
      select: {
        id: true,
        name: true,
        role: true,
        userCode: true,
        outletId: true,
      },
      orderBy: { name: 'asc' },
    });

    const evaluations = await Promise.all(
      staffMembers.map(async (staff) => {
        // --- 1. Kedisiplinan (25%) ---
        const attendances = await prisma.attendance.findMany({
          where: {
            tenantId,
            ...(outletId && typeof outletId === 'string' ? { outletId } : {}),
            userId: staff.id,
            workDate: { gte: startDateStr, lte: endDateStr },
          },
        });

        const schedules = await prisma.staffWorkSchedule.findMany({
          where: {
            tenantId,
            ...(outletId && typeof outletId === 'string' ? { outletId } : {}),
            userId: staff.id,
            scheduleDate: { gte: startDateStr, lte: endDateStr },
            isOffDay: false,
          },
        });

        const attendedDays = attendances.length;
        const scheduledDays = schedules.length;
        const lateAttendances = attendances.filter((a) => a.status === 'LATE');
        const lateCount = lateAttendances.length;
        const totalLateMinutes = attendances.reduce((acc, a) => acc + (a.lateMinutes || 0), 0);

        let attendanceRate = 80;
        if (scheduledDays > 0) {
          attendanceRate = Math.min(100, Math.round((attendedDays / scheduledDays) * 100));
        } else if (attendedDays > 0) {
          attendanceRate = 100;
        }

        let disciplineScore = 80;
        if (scheduledDays > 0 || attendedDays > 0) {
          disciplineScore = Math.max(0, Math.min(100, attendanceRate - (lateCount * 5) - Math.round(totalLateMinutes / 10)));
        }

        // --- 2. Produktivitas (35%) ---
        const cashierOrders = await prisma.order.findMany({
          where: {
            tenantId,
            ...(outletId && typeof outletId === 'string' ? { outletId } : {}),
            userId: staff.id,
            createdAt: {
              gte: new Date(`${startDateStr}T00:00:00.000Z`),
              lte: new Date(`${endDateStr}T23:59:59.999Z`),
            },
            orderStatus: { notIn: [OrderStatus.CANCELLED, OrderStatus.VOIDED] },
          },
          select: { id: true, totalAmount: true },
        });

        const cashierOrderCount = cashierOrders.length;
        const cashierOmzet = cashierOrders.reduce((acc, o) => acc + Number(o.totalAmount), 0);

        const stageLogs = await prisma.laundryStageLog.findMany({
          where: {
            tenantId,
            ...(outletId && typeof outletId === 'string' ? { order: { outletId } } : {}),
            operatorId: staff.id,
            createdAt: {
              gte: new Date(`${startDateStr}T00:00:00.000Z`),
              lte: new Date(`${endDateStr}T23:59:59.999Z`),
            },
          },
          select: {
            id: true,
            stage: true,
            durationMinutes: true,
            orderId: true,
          },
        });

        const stagesCompleted = stageLogs.length;
        const logsWithDuration = stageLogs.filter((l) => l.durationMinutes && l.durationMinutes > 0);
        const avgDurationMinutes =
          logsWithDuration.length > 0
            ? Math.round(logsWithDuration.reduce((acc, l) => acc + (l.durationMinutes || 0), 0) / logsWithDuration.length)
            : 0;

        const orderIdsFromStages = Array.from(new Set(stageLogs.map((l) => l.orderId)));
        let totalProcessedKg = 0;
        if (orderIdsFromStages.length > 0) {
          const stageDetails = await prisma.laundryOrderDetail.findMany({
            where: { orderId: { in: orderIdsFromStages } },
            select: { totalWeightKg: true },
          });
          totalProcessedKg = stageDetails.reduce((acc, d) => acc + Number(d.totalWeightKg || 0), 0);
        }

        let productivityScore = 75;
        if (staff.role === Role.CASHIER) {
          productivityScore = cashierOrderCount >= 30 ? 100 : Math.round((cashierOrderCount / 30) * 100);
        } else if (staff.role === Role.KITCHEN || (staff.role as any) === 'PRODUCTION') {
          productivityScore = stagesCompleted >= 30 ? 100 : Math.round((stagesCompleted / 30) * 100);
        } else {
          const cashierScore = cashierOrderCount >= 30 ? 100 : Math.round((cashierOrderCount / 30) * 100);
          const prodScore = stagesCompleted >= 30 ? 100 : Math.round((stagesCompleted / 30) * 100);
          productivityScore = Math.max(cashierScore, prodScore, 75);
        }
        productivityScore = Math.min(100, Math.max(0, productivityScore));

        // --- 3. Kualitas Kerja (20%) ---
        let rewashCount = 0;
        if (orderIdsFromStages.length > 0) {
          const stageRewash = await prisma.laundryStageLog.count({
            where: {
              tenantId,
              orderId: { in: orderIdsFromStages },
              stage: 'REWASH',
            },
          });
          const defectRewash = await prisma.laundryOrderDetail.count({
            where: {
              tenantId,
              orderId: { in: orderIdsFromStages },
              defectNotes: { contains: 'REWASH' },
            },
          });
          rewashCount = Math.max(stageRewash, defectRewash);
        }

        const staffIncidents = await prisma.laundryIncident.findMany({
          where: {
            tenantId,
            ...(outletId && typeof outletId === 'string' ? { outletId } : {}),
            responsibleStaffId: staff.id,
            createdAt: {
              gte: new Date(`${startDateStr}T00:00:00.000Z`),
              lte: new Date(`${endDateStr}T23:59:59.999Z`),
            },
          },
          select: { id: true, incidentType: true, status: true },
        });

        const damagedCount = staffIncidents.filter((i) => i.incidentType === 'DAMAGED').length;
        const lostCount = staffIncidents.filter((i) => i.incidentType === 'LOST').length;
        const otherIncidents = staffIncidents.length - damagedCount - lostCount;
        const qualityScore = Math.max(0, 100 - (rewashCount * 10) - (damagedCount * 15) - (lostCount * 20) - (otherIncidents * 5));

        // --- 4. Kepuasan Pelanggan (20%) ---
        const feedbackOrders = Array.from(new Set([...cashierOrders.map((o) => o.id), ...orderIdsFromStages]));
        let customerScore = 80;
        let ratingCount = 0;
        let avgRating = 0;

        if (feedbackOrders.length > 0) {
          const feedbacks = await prisma.laundryCustomerFeedback.findMany({
            where: {
              tenantId,
              orderId: { in: feedbackOrders },
              createdAt: {
                gte: new Date(`${startDateStr}T00:00:00.000Z`),
                lte: new Date(`${endDateStr}T23:59:59.999Z`),
              },
            },
            select: { rating: true },
          });

          if (feedbacks.length > 0) {
            ratingCount = feedbacks.length;
            avgRating = Math.round((feedbacks.reduce((acc, f) => acc + f.rating, 0) / feedbacks.length) * 10) / 10;
            customerScore = Math.min(100, Math.round((avgRating / 5) * 100));
          }
        }

        // --- Nilai Akhir & Grade ---
        const overallScore = Math.round((0.25 * disciplineScore + 0.35 * productivityScore + 0.20 * qualityScore + 0.20 * customerScore) * 10) / 10;
        const grade = overallScore >= 85 ? 'A' : overallScore >= 70 ? 'B' : overallScore >= 55 ? 'C' : 'D';

        const latestReview = await prisma.staffPerformanceReview.findFirst({
          where: {
            tenantId,
            ...(outletId && typeof outletId === 'string' ? { outletId } : {}),
            userId: staff.id,
            periodStart: startDateStr,
            periodEnd: endDateStr,
          },
          include: {
            reviewedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        return {
          user: {
            id: staff.id,
            name: staff.name,
            role: staff.role,
            userCode: staff.userCode,
          },
          scores: {
            discipline: disciplineScore,
            productivity: productivityScore,
            quality: qualityScore,
            customer: customerScore,
            overall: overallScore,
            grade,
          },
          metrics: {
            attendedDays,
            scheduledDays,
            lateCount,
            totalLateMinutes,
            cashierOrderCount,
            cashierOmzet,
            stagesCompleted,
            totalProcessedKg,
            avgDurationMinutes,
            rewashCount,
            damagedCount,
            lostCount,
            ratingCount,
            avgRating,
          },
          latestReview: latestReview || null,
        };
      })
    );

    // Urutkan leaderboard berdasarkan skor overall tertinggi
    evaluations.sort((a, b) => b.scores.overall - a.scores.overall);

    return res.status(200).json({
      status: 'success',
      data: {
        period: {
          startDate: startDateStr,
          endDate: endDateStr,
        },
        evaluations,
      },
    });
  } catch (error: any) {
    console.error('Error getStaffPerformance:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal mengambil evaluasi performa staf' });
  }
};

export const createStaffPerformanceReview = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const reviewedById = req.user?.id;
    const userRole = req.user?.role;
    if (!tenantId || !reviewedById) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    if (userRole !== Role.OWNER && userRole !== Role.ADMIN && userRole !== Role.SUPERVISOR) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Hanya Owner, Admin, atau Supervisor yang dapat menyimpan review performa',
      });
    }

    const {
      outletId,
      userId,
      periodStart,
      periodEnd,
      disciplineScore,
      productivityScore,
      qualityScore,
      customerScore,
      overallScore,
      grade,
      reviewerNotes,
    } = req.body;

    if (!outletId || !userId || !periodStart || !periodEnd) {
      return res.status(400).json({
        status: 'error',
        message: 'outletId, userId, periodStart, dan periodEnd wajib diisi',
      });
    }

    const review = await prisma.staffPerformanceReview.create({
      data: {
        tenantId,
        outletId,
        userId,
        periodStart: String(periodStart).slice(0, 10),
        periodEnd: String(periodEnd).slice(0, 10),
        disciplineScore: Number(disciplineScore || 0),
        productivityScore: Number(productivityScore || 0),
        qualityScore: Number(qualityScore || 0),
        customerScore: Number(customerScore || 0),
        overallScore: Number(overallScore || 0),
        grade: String(grade || 'B'),
        reviewerNotes: reviewerNotes ? String(reviewerNotes).trim() : null,
        reviewedById,
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json({
      status: 'success',
      message: 'Catatan evaluasi performa berhasil disimpan',
      data: review,
    });
  } catch (error: any) {
    console.error('Error createStaffPerformanceReview:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal menyimpan review performa' });
  }
};

export const getStaffPerformanceReviews = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userRole = req.user?.role;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    if (userRole !== Role.OWNER && userRole !== Role.ADMIN && userRole !== Role.SUPERVISOR) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Hanya Owner, Admin, atau Supervisor yang dapat melihat riwayat review performa',
      });
    }

    const { outletId, userId } = req.query;

    const where: any = { tenantId };
    if (outletId && typeof outletId === 'string') {
      where.outletId = outletId;
    }
    if (userId && typeof userId === 'string') {
      where.userId = userId;
    }

    const reviews = await prisma.staffPerformanceReview.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, role: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      status: 'success',
      data: reviews,
    });
  } catch (error: any) {
    console.error('Error getStaffPerformanceReviews:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil riwayat review performa' });
  }
};
