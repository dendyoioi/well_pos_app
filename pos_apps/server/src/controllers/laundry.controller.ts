import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { PaymentStatus, OrderStatus, PaymentMethod, PaymentTxStatus, ShiftStatus, Prisma } from '@prisma/client';
import { whatsAppService, LaundryNotificationData } from '../services/whatsapp.service';

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
  deliveryType: z.enum(['SELF_PICKUP', 'DELIVERY']).optional().default('SELF_PICKUP'),
  deliveryDistanceKm: z.number().min(0).optional().default(0),
  deliveryFeePerKm: z.number().min(0).optional().default(0),
  deliveryFee: z.number().min(0).optional().default(0),
  items: z.array(
    z.object({
      serviceId: z.string().optional(),
      name: z.string().min(1),
      category: z.string().optional().default('KILOAN'),
      quantity: z.number().min(0.01, 'Kuantitas/bobot minimal 0.01'),
      unit: z.string().default('KG'),
      unitPrice: z.number().min(0),
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
        orderBy: [{ isActive: 'desc' }, { category: 'asc' }, { name: 'asc' }],
      });
    }

    return res.status(200).json({
      status: 'success',
      data: services,
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
        { code: 'RAK-A1', name: 'Rak Kiloan A1', type: 'SHELF', capacity: 10 },
        { code: 'RAK-A2', name: 'Rak Kiloan A2', type: 'SHELF', capacity: 10 },
        { code: 'RAK-A3', name: 'Rak Kiloan A3', type: 'SHELF', capacity: 10 },
        { code: 'RAK-B1', name: 'Rak Bed Cover B1', type: 'SHELF', capacity: 6 },
        { code: 'RAK-B2', name: 'Rak Bed Cover B2', type: 'SHELF', capacity: 6 },
        { code: 'HGR-01', name: 'Gantungan Hanger Jas 01', type: 'HANGER', capacity: 15 },
        { code: 'HGR-02', name: 'Gantungan Hanger Gaun 02', type: 'HANGER', capacity: 15 },
        { code: 'SPT-01', name: 'Rak Khusus Sepatu / Tas', type: 'BIN', capacity: 8 },
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
        status: { not: 'COMPLETED' },
      },
      include: {
        order: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
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
        activeOrders: ordersInThisRack.map((o) => ({
          orderId: o.orderId,
          orderNumber: o.order.invoiceNumber,
          customerName: o.order.customer?.name || 'Pelanggan Walk-In',
          customerPhone: o.order.customer?.phone || null,
          totalWeightKg: o.totalWeightKg ? Number(o.totalWeightKg) : null,
          totalPieces: o.totalPieces,
          paymentStatus: o.order.paymentStatus,
          status: o.status,
          readyAt: o.estimatedReadyAt,
        })),
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

    const details = await prisma.laundryOrderDetail.findMany({
      where,
      include: {
        order: {
          include: {
            items: true,
            customer: true,
            cashier: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    const formattedQueue = details.map((detail) => ({
      id: detail.id,
      orderId: detail.orderId,
      invoiceNumber: detail.order.invoiceNumber,
      status: detail.status,
      customerName: detail.order.customer?.name || 'Pelanggan Walk-In',
      customerPhone: detail.order.customer?.phone || null,
      customerAddress: detail.order.customer?.address || null,
      serviceName: detail.order.items[0]?.productName || 'Layanan Laundry',
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
      estimatedReadyAt: detail.estimatedReadyAt,
      completedAt: detail.completedAt,
      pickedUpAt: detail.pickedUpAt,
      createdAt: detail.createdAt,
    }));

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

export const createLaundryOrder = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ status: 'error', message: 'Konteks autentikasi kasir tidak ditemukan' });
    }

    const parseResult = createLaundryOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
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
      deliveryType,
      deliveryDistanceKm,
      deliveryFeePerKm,
      deliveryFee,
      items,
      totalPieces,
      perfumeVariant,
      estimatedReadyHours,
      depositAmount,
      discountAmount,
      paymentMethod,
      customerNotes,
    } = parseResult.data;

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
    if (effectiveCustomerId && customerAddress && customerAddress.trim()) {
      await prisma.customer.updateMany({
        where: { id: effectiveCustomerId, tenantId },
        data: { address: customerAddress.trim() },
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
            address: customerAddress?.trim() || null,
          },
        });
      } else if (customerAddress && customerAddress.trim() && !cust.address) {
        await prisma.customer.update({
          where: { id: cust.id },
          data: { address: customerAddress.trim() },
        });
      }
      effectiveCustomerId = cust.id;
    }

    // 2. Hitung Grand Total Subtotal dari items & addons
    let subtotal = 0;
    let totalWeightKg = 0;
    const orderItemsData = items.map((item) => {
      const baseLineTotal = Math.round(item.quantity * item.unitPrice);
      const addonsTotal = (item.addons || []).reduce((acc, a) => {
        if (a.total !== undefined) return acc + a.total;
        const isPerUnit = ['PER_KG', 'PER_UNIT', 'KG'].includes((a.unit || '').toUpperCase());
        return acc + (isPerUnit ? Math.round(a.price * item.quantity) : a.price);
      }, 0);
      const lineTotal = baseLineTotal + addonsTotal;
      subtotal += lineTotal;
      if (item.unit === 'KG') {
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
      };
    });

    // Ongkos Kirim Antar-Jemput
    const effectiveDeliveryFee = deliveryType === 'DELIVERY' ? Number(deliveryFee || 0) : 0;
    const effectiveDiscount = discountAmount ? Math.min(subtotal + effectiveDeliveryFee, discountAmount) : 0;
    const grandTotal = Math.max(0, subtotal + effectiveDeliveryFee - effectiveDiscount);
    const paidAmount = paymentMethod === 'UNPAID' ? 0 : Math.min(grandTotal, depositAmount || grandTotal);

    // Keterangan Pengantaran & Catatan
    let formattedNotes = customerNotes?.trim() || '';
    if (deliveryType === 'DELIVERY') {
      const distInfo = deliveryDistanceKm ? `${deliveryDistanceKm} km` : 'Kurir';
      const feeInfo = effectiveDeliveryFee > 0 ? ` (Ongkir: Rp ${effectiveDeliveryFee.toLocaleString('id-ID')})` : ' (Gratis Ongkir)';
      const addrInfo = customerAddress?.trim() ? `Alamat: ${customerAddress.trim()}` : '';
      const deliveryHeader = `🛵 [Antar-Jemput ${distInfo}${feeInfo}] ${addrInfo}`;
      formattedNotes = formattedNotes ? `${deliveryHeader} | Patokan: ${formattedNotes}` : deliveryHeader;
    } else {
      formattedNotes = formattedNotes ? `🧺 [Ambil di Toko] ${formattedNotes}` : '🧺 [Ambil di Toko]';
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
          orderType: deliveryType === 'DELIVERY' ? 'DELIVERY' : 'SERVICES',
          channel: deliveryType === 'DELIVERY' ? 'DELIVERY' : 'DIRECT_STORE',
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
          totalPieces,
          perfumeVariant,
          estimatedReadyAt,
          customerNotes: formattedNotes || null,
        },
      });

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

    return res.status(201).json({
      status: 'success',
      message: 'Nota penerimaan laundry berhasil dibuat',
      data: createdOrder,
    });
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

    if (status === 'READY_FOR_PICKUP' && !detail.completedAt) {
      updatePayload.completedAt = new Date();
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

    const { nextStage, operatorId, operatorName, notes, rackCode, pickedUpBy, paymentMethod } = req.body;
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

    if (nextStage === 'RACK_STORAGE') {
      detailUpdate.rackCode = rackCode ? rackCode.toUpperCase().trim() : detail.rackCode || 'RAK-A1';
      if (!detail.completedAt) detailUpdate.completedAt = now;
    }

    if (nextStage === 'HANDOVER') {
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
    }

    const logs = await prisma.laundryStageLog.findMany({
      where,
      orderBy: { completedAt: 'desc' },
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
      if (log.stage === 'WASHING') op.totalWashingKg += kg;
      if (log.stage === 'DRYING') op.totalDryingKg += kg;
      if (log.stage === 'IRONING') op.totalIroningKg += kg;
      if (log.stage === 'PACKING') op.totalPackingOrders += 1;
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
          },
        },
        items: true,
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
        items: order.items.map((oi) => ({
          name: oi.productName || 'Layanan Laundry',
          quantity: oi.quantity,
          unitPrice: oi.unitPrice,
          totalPrice: oi.subtotal,
        })),
        stages: allStages,
        stageLogs: order.laundryDetail.stageLogs.map((log) => ({
          stage: log.stage,
          completedAt: log.completedAt || log.startedAt,
          notes: log.notes,
        })),
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

    // Buat direktori static uploads/laundry/<tenantId>
    const tenantUploadDir = path.join(__dirname, '../../uploads/laundry', tenantId);
    if (!fs.existsSync(tenantUploadDir)) {
      fs.mkdirSync(tenantUploadDir, { recursive: true });
    }

    const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
    const filePath = path.join(tenantUploadDir, filename);
    await fs.promises.writeFile(filePath, buffer);

    const relativeUrl = `/uploads/laundry/${tenantId}/${filename}`;

    return res.status(200).json({
      status: 'success',
      message: 'Foto kondisi pakaian berhasil diunggah',
      data: {
        url: relativeUrl,
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
      kg, // kuota kg jika type QUOTA_KG
      pricePaid, // uang yang dibayar pelanggan
      paymentMethod = 'CASH', // 'CASH' | 'QRIS' | 'BANK_TRANSFER' | 'TRANSFER'
      shiftId,
      outletId,
      notes,
      quotaExpiresAt,
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

    const paidNominal = type === 'BALANCE' ? Number(amount) : Number(pricePaid || 0);

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

      if (type === 'BALANCE') {
        deltaAmount = Number(amount);
        balanceAfter = balanceBefore + deltaAmount;
        ledgerType = 'TOPUP_BALANCE';
      } else {
        deltaKg = Number(kg);
        kgAfter = kgBefore + deltaKg;
        ledgerType = 'TOPUP_QUOTA_KG';
      }

      // Update wallet
      const updatedWallet = await tx.customerLaundryWallet.update({
        where: { id: wallet.id },
        data: {
          balanceAmount: balanceAfter,
          quotaKg: kgAfter,
          ...(quotaExpiresAt ? { quotaExpiresAt: new Date(quotaExpiresAt) } : {}),
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
