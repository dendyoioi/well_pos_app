import { Request, Response } from 'express';
import { z } from 'zod';
import { qrMenuService } from '../services/qr_menu.service';

// Validation Schemas
const createTableSchema = z.object({
  outletId: z.string().uuid('Format outlet ID tidak valid'),
  tableNumber: z.string().min(1, 'Nomor meja wajib diisi').max(20),
  name: z.string().max(50).optional(),
  section: z.string().max(30).optional(),
  capacity: z.number().int().min(1).max(100).optional(),
});

const updateTableSchema = z.object({
  tableNumber: z.string().min(1).max(20).optional(),
  name: z.string().max(50).optional(),
  section: z.string().max(30).optional(),
  capacity: z.number().int().min(1).max(100).optional(),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED']).optional(),
});

const updateSettingsSchema = z.object({
  outletId: z.string().uuid(),
  selfOrderingEnabled: z.boolean().optional(),
  welcomeTitle: z.string().max(100).optional(),
  welcomeSubtitle: z.string().max(255).optional(),
  wifiEnabled: z.boolean().optional(),
  wifiName: z.string().max(50).optional(),
  wifiPassword: z.string().max(50).optional(),
  showEstimatedTime: z.boolean().optional(),
  estimatedPrepMinutes: z.number().int().min(1).max(120).optional(),
  bannerUrl: z.string().optional(),
});

const submitOrderSchema = z.object({
  outletId: z.string().uuid('Format outlet ID tidak valid'),
  tableNumber: z.string().min(1, 'Nomor meja wajib diisi'),
  customerName: z.string().min(1, 'Nama pelanggan wajib diisi').max(50),
  customerPhone: z.string().max(25).optional(),
  notes: z.string().max(255).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional(),
        productName: z.string().min(1),
        variantName: z.string().optional(),
        quantity: z.number().int().min(1),
        unitPrice: z.number().min(0),
        notes: z.string().max(100).optional(),
        modifiers: z
          .array(
            z.object({
              groupName: z.string(),
              option: z.object({
                id: z.string(),
                name: z.string(),
                priceDelta: z.number(),
              }),
            })
          )
          .optional(),
      })
    )
    .min(1, 'Keranjang belanja tidak boleh kosong'),
});

export const qrMenuController = {
  // ==========================================
  // PUBLIC ENDPOINTS (UNTUK PELANGGAN)
  // ==========================================

  async getPublicMenu(req: Request, res: Response) {
    try {
      const { outletId } = req.params;
      const tableCode = (req.query.table as string) || null;

      if (!outletId) {
        return res.status(400).json({ status: 'error', message: 'Parameter outletId wajib ada.' });
      }

      const menuData = await qrMenuService.getPublicMenu(outletId, tableCode);
      return res.json({ status: 'success', data: menuData });
    } catch (err: any) {
      console.error('Error in getPublicMenu:', err);
      return res.status(404).json({ status: 'error', message: err.message || 'Menu tidak ditemukan.' });
    }
  },

  async submitPublicOrder(req: Request, res: Response) {
    try {
      const parseResult = submitOrderSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          status: 'error',
          message: parseResult.error.errors[0]?.message || 'Data pesanan tidak valid',
        });
      }

      const orderResult = await qrMenuService.submitPublicOrder(parseResult.data);
      return res.status(201).json({ status: 'success', data: orderResult });
    } catch (err: any) {
      console.error('Error in submitPublicOrder:', err);
      return res.status(400).json({ status: 'error', message: err.message || 'Gagal mengirim pesanan' });
    }
  },

  // ==========================================
  // PROTECTED BACKOFFICE ENDPOINTS (UNTUK OWNER/KASIR)
  // ==========================================

  async getTables(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const outletId = (req.query.outletId as string) || req.user?.outletId || null;

      if (!tenantId) {
        return res.status(401).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
      }

      const tables = await qrMenuService.getTables(tenantId, outletId);
      return res.json({ status: 'success', data: tables });
    } catch (err: any) {
      return res.status(500).json({ status: 'error', message: err.message || 'Gagal memuat meja' });
    }
  },

  async createTable(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      if (!tenantId) {
        return res.status(401).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
      }

      const parseResult = createTableSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          status: 'error',
          message: parseResult.error.errors[0]?.message || 'Input data meja tidak valid',
        });
      }

      const created = await qrMenuService.createTable(tenantId, parseResult.data);
      return res.status(201).json({ status: 'success', data: created });
    } catch (err: any) {
      return res.status(400).json({ status: 'error', message: err.message || 'Gagal membuat meja' });
    }
  },

  async updateTable(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(401).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
      }

      const parseResult = updateTableSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          status: 'error',
          message: parseResult.error.errors[0]?.message || 'Input data meja tidak valid',
        });
      }

      const updated = await qrMenuService.updateTable(tenantId, id, parseResult.data);
      return res.json({ status: 'success', data: updated });
    } catch (err: any) {
      return res.status(400).json({ status: 'error', message: err.message || 'Gagal mengubah meja' });
    }
  },

  async deleteTable(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(401).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
      }

      const deleted = await qrMenuService.deleteTable(tenantId, id);
      if (!deleted) {
        return res.status(404).json({ status: 'error', message: 'Meja tidak ditemukan' });
      }
      return res.json({ status: 'success', message: 'Meja berhasil dihapus' });
    } catch (err: any) {
      return res.status(500).json({ status: 'error', message: err.message || 'Gagal menghapus meja' });
    }
  },

  async getSettings(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const outletId = (req.query.outletId as string) || req.user?.outletId;

      if (!tenantId || !outletId) {
        return res.status(400).json({ status: 'error', message: 'Tenant ID dan Outlet ID wajib disertakan' });
      }

      const settings = await qrMenuService.getSettings(tenantId, outletId);
      return res.json({ status: 'success', data: settings });
    } catch (err: any) {
      return res.status(500).json({ status: 'error', message: err.message || 'Gagal memuat pengaturan' });
    }
  },

  async updateSettings(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      if (!tenantId) {
        return res.status(401).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
      }

      const parseResult = updateSettingsSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          status: 'error',
          message: parseResult.error.errors[0]?.message || 'Input pengaturan tidak valid',
        });
      }

      const { outletId, ...rest } = parseResult.data;
      const updated = await qrMenuService.updateSettings(tenantId, outletId, rest);
      return res.json({ status: 'success', data: updated });
    } catch (err: any) {
      return res.status(400).json({ status: 'error', message: err.message || 'Gagal menyimpan pengaturan' });
    }
  },

  async getQrOrders(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const outletId = (req.query.outletId as string) || req.user?.outletId || null;

      if (!tenantId) {
        return res.status(401).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
      }

      const orders = await qrMenuService.getQrOrders(tenantId, outletId);
      return res.json({ status: 'success', data: orders });
    } catch (err: any) {
      return res.status(500).json({ status: 'error', message: err.message || 'Gagal memuat pesanan QR' });
    }
  },

  async updateOrderStatus(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;
      const { status } = req.body;

      if (!tenantId) {
        return res.status(401).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
      }
      if (!status) {
        return res.status(400).json({ status: 'error', message: 'Status baru wajib disertakan' });
      }

      const result = await qrMenuService.updateOrderStatus(tenantId, id, status);
      return res.json({ status: 'success', data: result });
    } catch (err: any) {
      return res.status(400).json({ status: 'error', message: err.message || 'Gagal memperbarui status' });
    }
  },
};
