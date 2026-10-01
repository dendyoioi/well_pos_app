import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { locationDualWriteService } from '../services/dual_write';

// Skema Biaya Dinamis Outlet
const feeItemSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1, 'Nama biaya tidak boleh kosong'),
    type: z.enum(['PERCENTAGE', 'FIXED']),
    rate: z.number().min(0, 'Nilai biaya tidak boleh negatif'),
    channelScope: z
      .enum([
        'ALL',
        'DINE_IN',
        'TAKEAWAY',
        'GOFOOD',
        'GRABFOOD',
        'SHOPEEFOOD',
        'DELIVERY',
        'ONLINE_DELIVERY',
      ])
      .default('ALL'),
    isActive: z.boolean().default(true),
    category: z.enum(['DEFAULT_TAX_SERVICE', 'ON_DEMAND_PACKAGING']).optional(),
    isQuickAccess: z.boolean().optional(),
  })
  .passthrough();

const updateFeesSchema = z.object({
  feesConfig: z.array(feeItemSchema),
  supervisorPin: z.string().optional(),
});

const createOutletSchema = z.object({
  name: z.string().min(2, 'Nama cabang minimal 2 karakter'),
  address: z.string().optional(),
  phone: z.string().optional(),
  isWarehouse: z.boolean().optional(),
  warehouseId: z.string().uuid().nullable().optional(),
  feesConfig: z.array(feeItemSchema).optional(),
});

const updateOutletSchema = z.object({
  name: z.string().min(2, 'Nama cabang minimal 2 karakter').optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  isWarehouse: z.boolean().optional(),
  warehouseId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  receiptConfig: z.object({
    paperSize: z.enum(['58mm', '80mm']).default('58mm'),
    footerText: z.string().optional(),
    showQueueNumber: z.boolean().optional(),
  }).optional(),
  loyaltyConfig: z.object({
    isActive: z.boolean().default(false),
    pointsPerSpend: z.number().int().min(1).default(10000),
    pointValueIdr: z.number().int().min(1).default(100),
    minPointsToRedeem: z.number().int().min(1).default(10),
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
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }

    const outlet = await prisma.outlet.findFirst({
      where: { id, tenantId },
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

    if (userRole !== Role.ADMIN && userRole !== Role.OWNER) {
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

    const { name, address, phone, isWarehouse, warehouseId, feesConfig } = parseResult.data;

    // Cek kuota outlet dari langganan aktif
    let maxOutlets = 100;
    let planName = 'Aktif';
    try {
      const activeSubs = await prisma.$queryRawUnsafe<any[]>(
        `SELECT sp.max_outlets, sp.name as plan_name 
         FROM tenant_subscriptions ts 
         JOIN subscription_plans sp ON ts.plan_id = sp.id 
         WHERE ts.tenant_id = $1 AND ts.is_active = true 
         ORDER BY ts.created_at DESC LIMIT 1`,
        tenantId
      );
      if (activeSubs.length > 0) {
        maxOutlets = activeSubs[0].max_outlets ?? 100;
        planName = activeSubs[0].plan_name ?? 'Aktif';
      }
    } catch {
      maxOutlets = 100;
    }

    const currentOutletCount = await prisma.outlet.count({ where: { tenantId } });

    if (currentOutletCount >= maxOutlets) {
      return res.status(403).json({
        status: 'error',
        message: `Batas cabang untuk paket ${planName} telah tercapai (Maksimal ${maxOutlets} cabang). Silakan upgrade paket untuk menambah cabang.`,
      });
    }

    // Default Fees Config jika tidak disediakan (default belum tersetting / non-aktif)
    const defaultFees = feesConfig || [
      {
        id: 'fee_tax',
        name: 'PPN / PB1 Pajak',
        type: 'PERCENTAGE',
        rate: 10,
        channelScope: 'ALL',
        isActive: false,
      },
      {
        id: 'fee_service',
        name: 'Biaya Layanan (Service Charge)',
        type: 'PERCENTAGE',
        rate: 5,
        channelScope: 'DINE_IN',
        isActive: false,
      },
      {
        id: 'fee_box',
        name: 'Biaya Kemasan Box / Takeaway',
        type: 'FIXED',
        rate: 2000,
        channelScope: 'TAKEAWAY',
        isActive: false,
      },
    ];

    const newOutlet = await prisma.$transaction(async (tx) => {
      const dwResult = await locationDualWriteService.createOutlet(
        {
          name,
          address: address || undefined,
          phone: phone || undefined,
          isWarehouse: isWarehouse ?? false,
          feesConfig: defaultFees,
        },
        { tx, tenantId, actorUserId: req.user?.id }
      );

      const outlet = dwResult.legacyData;

      if (warehouseId) {
        await tx.outlet.update({
          where: { id: outlet.id },
          data: { warehouseId },
        });
        outlet.warehouseId = warehouseId;
      }

      // Duplikasi master produk ke OutletProduct cabang baru (stok awal 0)
      // serta sinkronisasi inventory_balances (0) di default storage location
      const tenantProducts = await tx.$queryRawUnsafe<any[]>(
        `SELECT p.id, p.base_price, ii.id as "inventoryItemId"
         FROM "products" p
         LEFT JOIN "product_variants" pv ON pv.product_id = p.id AND pv.tenant_id = $1
         LEFT JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id AND ii.tenant_id = $1
         WHERE p.tenant_id = $1 AND p.is_active = true;`,
        tenantId
      );

      const slRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT id FROM "storage_locations" WHERE outlet_id = $1 AND is_default = true LIMIT 1;`,
        outlet.id
      );
      const defaultStorageLocId = slRows[0]?.id;

      for (const p of tenantProducts) {

        if (defaultStorageLocId && p.inventoryItemId) {
          const balanceId = locationDualWriteService.generateDeterministicUuid(
            `${p.inventoryItemId}:${defaultStorageLocId}:unbatched_balance`
          );
          await tx.$queryRawUnsafe(
            `INSERT INTO "inventory_balances" (
               id, tenant_id, inventory_item_id, storage_location_id, inventory_batch_id,
               quantity_on_hand, quantity_reserved, updated_at
             ) VALUES ($1, $2, $3, $4, null, 0, 0, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO NOTHING;`,
            balanceId,
            tenantId,
            p.inventoryItemId,
            defaultStorageLocId
          );
        }
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

    // Hanya OWNER, ADMIN atau SUPERVISOR yang diizinkan mengubah biaya langsung,
    // Kasir wajib menyertakan PIN Supervisor
    if (userRole !== Role.OWNER && userRole !== Role.ADMIN && userRole !== Role.SUPERVISOR) {
      if (!req.body.supervisorPin) {
        return res.status(403).json({
          status: 'error',
          message: 'Hanya Supervisor atau Owner yang memiliki hak akses mengelola biaya toko, atau masukkan PIN Supervisor yang valid',
        });
      }
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

    // Jika diakses oleh kasir yang meminta otorisasi PIN Supervisor atau jika PIN disertakan
    if (supervisorPin) {
      const spvCandidates = await prisma.user.findMany({
        where: {
          tenantId: tenantId || undefined,
          role: { in: [Role.SUPERVISOR, Role.ADMIN, Role.OWNER] },
          isActive: true,
          pinHash: { not: null },
        },
        select: { id: true, pinHash: true },
      });

      let spvValid = false;
      for (const spv of spvCandidates) {
        if (spv.pinHash && (await bcrypt.compare(supervisorPin, spv.pinHash))) {
          spvValid = true;
          break;
        }
      }

      if (!spvValid) {
        return res.status(401).json({
          status: 'error',
          message: 'PIN Supervisor tidak valid atau akun dinonaktifkan',
        });
      }
    }

    if (tenantId) {
      await prisma.$executeRawUnsafe(
        `UPDATE "outlets" SET fees_config = $1::jsonb, updated_at = NOW() WHERE id = $2 AND tenant_id = $3;`,
        JSON.stringify(feesConfig),
        id,
        tenantId
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE "outlets" SET fees_config = $1::jsonb, updated_at = NOW() WHERE id = $2;`,
        JSON.stringify(feesConfig),
        id
      );
    }

    return res.status(200).json({
      status: 'success',
      message: 'Konfigurasi biaya & pajak berhasil diperbarui',
      data: feesConfig,
    });
  } catch (error) {
    console.error('Error saat memperbarui biaya outlet:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui biaya outlet' });
  }
};

/**
 * Update Sales Channels Configuration (Kanal Penjualan & Mitra Online)
 * PUT /api/outlets/:id/channels
 */
export const updateOutletChannels = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;

    // Hanya OWNER, ADMIN atau SUPERVISOR yang diizinkan mengubah kanal penjualan
    if (userRole !== Role.OWNER && userRole !== Role.ADMIN && userRole !== Role.SUPERVISOR) {
      return res.status(403).json({
        status: 'error',
        message: 'Hanya Owner, Admin, atau Supervisor yang memiliki hak akses mengelola kanal penjualan',
      });
    }

    const { channelsConfig } = req.body;
    if (!Array.isArray(channelsConfig)) {
      return res.status(400).json({
        status: 'error',
        message: 'Format channelsConfig harus berupa array',
      });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "outlets" SET channels_config = $1::jsonb, updated_at = NOW() WHERE id = $2;`,
      JSON.stringify(channelsConfig),
      id
    );

    return res.status(200).json({
      status: 'success',
      message: 'Konfigurasi kanal penjualan berhasil diperbarui',
      data: channelsConfig,
    });
  } catch (error) {
    console.error('Error saat memperbarui kanal outlet:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui kanal penjualan' });
  }
};

/**
 * Update Payment Configuration (QRIS Statis, dsb)
 * PUT /api/outlets/:id/payment-config
 */
export const updateOutletPaymentConfig = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;

    if (userRole !== Role.OWNER && userRole !== Role.ADMIN && userRole !== Role.SUPERVISOR) {
      return res.status(403).json({
        status: 'error',
        message: 'Hanya Owner, Admin, atau Supervisor yang memiliki hak akses mengelola pengaturan pembayaran',
      });
    }

    const { paymentConfig } = req.body;
    if (!paymentConfig || typeof paymentConfig !== 'object') {
      return res.status(400).json({
        status: 'error',
        message: 'Format paymentConfig tidak valid',
      });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "outlets" SET payment_config = $1::jsonb, updated_at = NOW() WHERE id = $2;`,
      JSON.stringify(paymentConfig),
      id
    );

    return res.status(200).json({
      status: 'success',
      message: 'Pengaturan pembayaran berhasil diperbarui',
      data: paymentConfig,
    });
  } catch (error) {
    console.error('Error saat memperbarui pengaturan pembayaran outlet:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui pengaturan pembayaran' });
  }
};

