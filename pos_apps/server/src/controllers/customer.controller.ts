import { Request, Response } from 'express';
import { z } from 'zod';
import { PaymentStatus, PointTxType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { loyaltyService } from '../services/loyalty.service';

// Skema validasi input tambah/edit pelanggan
const customerSchema = z.object({
  name: z.string().min(1, 'Nama pelanggan wajib diisi').max(150, 'Nama terlalu panjang'),
  phone: z.string().max(30, 'Nomor telepon terlalu panjang').optional().nullable(),
  email: z.string().email('Format email tidak valid').optional().nullable().or(z.literal('')),
  address: z.string().max(500, 'Alamat terlalu panjang').optional().nullable(),
  notes: z.string().max(1000, 'Catatan terlalu panjang').optional().nullable(),
  code: z.string().max(50, 'Kode member terlalu panjang').optional().nullable(),
});

/**
 * Helper: Generate kode pelanggan unik (misal: MBR-2609-001)
 */
const generateCustomerCode = async (tenantId: string | null): Promise<string> => {
  const count = await prisma.customer.count({
    where: tenantId ? { tenantId } : {},
  });
  const seq = String(count + 1).padStart(4, '0');
  const yearMonth = new Date().toISOString().slice(2, 7).replace('-', ''); // 2609
  return `MBR-${yearMonth}-${seq}`;
};

/**
 * Controller: Mengambil daftar pelanggan (dengan pencarian, sorting, dan metrik analitik)
 * @route GET /api/customers
 */
export const getCustomers = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenantId;

    const search = (req.query.search as string)?.trim();
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string)?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    // Filter tenant isolation
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant ID tidak ditemukan' });
    }
    const whereClause: any = { tenantId };

    // Filter pencarian
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Tentukan kolom pengurutan yang aman
    const validSortFields = ['name', 'points', 'createdAt'];
    const resolvedSortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderBy: any = { [resolvedSortField]: sortOrder };

    // Ambil data pelanggan dan total hitungan secara paralel
    const [customers, totalRecords, totalCustomers, ordersAgg, repeatMembersCount] = await Promise.all([
      prisma.customer.findMany({
        where: whereClause,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.customer.count({ where: whereClause }),
      prisma.customer.count({ where: tenantId ? { tenantId } : {} }),
      prisma.order.aggregate({
        where: {
          ...(tenantId ? { tenantId } : {}),
          customerId: { not: null },
          paymentStatus: PaymentStatus.PAID,
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT customer_id FROM "orders" 
         WHERE customer_id IS NOT NULL ${tenantId ? 'AND tenant_id = $1' : ''} 
         GROUP BY customer_id 
         HAVING COUNT(id) > 1;`,
        ...(tenantId ? [tenantId] : [])
      ),
    ]);

    const totalRevenueFromCustomers = Number(ordersAgg._sum.totalAmount || 0);
    const totalVisits = ordersAgg._count.id || 0;
    const activeRepeatMembers = Array.isArray(repeatMembersCount) ? repeatMembersCount.length : 0;
    const avgSpendPerCustomer = totalCustomers > 0 ? Math.round(totalRevenueFromCustomers / totalCustomers) : 0;

    return res.status(200).json({
      status: 'success',
      data: customers,
      summary: {
        totalCustomers,
        totalRevenueFromCustomers,
        totalVisits,
        activeRepeatMembers,
        avgSpendPerCustomer,
      },
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
      },
    });
  } catch (error) {
    console.error('Error saat memuat daftar pelanggan:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memuat daftar pelanggan',
    });
  }
};

/**
 * Controller: Mengambil detail pelanggan tunggal beserta riwayat transaksi
 * @route GET /api/customers/:id
 */
export const getCustomerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user?.tenantId;

    const customer = await prisma.customer.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {}),
      },
      include: {
        orders: {
          take: 15,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            paymentStatus: true,
            createdAt: true,
            outlet: { select: { name: true } },
          },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'Data pelanggan tidak ditemukan',
      });
    }

    return res.status(200).json({
      status: 'success',
      data: customer,
    });
  } catch (error) {
    console.error('Error saat mengambil detail pelanggan:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memuat detail pelanggan',
    });
  }
};

/**
 * Controller: Menambah pelanggan baru
 * @route POST /api/customers
 */
export const createCustomer = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenantId;

    const parseResult = customerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { name, phone, email, address, notes, code } = parseResult.data;

    // Cek duplikasi nomor telepon pada tenant yang sama jika nomor diisi
    if (phone && phone.trim()) {
      const existingPhone = await prisma.customer.findFirst({
        where: {
          phone: phone.trim(),
          ...(tenantId ? { tenantId } : {}),
        },
      });

      if (existingPhone) {
        return res.status(400).json({
          status: 'error',
          message: `Nomor telepon "${phone}" sudah terdaftar atas nama ${existingPhone.name}`,
        });
      }
    }

    // Fix K3: Jangan fallback ke tenant pertama — tolak dengan 401
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    const finalCode = code?.trim() || (await generateCustomerCode(tenantId));

    const newCustomer = await prisma.customer.create({
      data: {
        tenantId: tenantId,
        code: finalCode,
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
      },
    });

    return res.status(201).json({
      status: 'success',
      message: 'Pelanggan baru berhasil ditambahkan',
      data: newCustomer,
    });
  } catch (error) {
    console.error('Error saat menambah pelanggan:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menyimpan data pelanggan baru',
    });
  }
};

/**
 * Controller: Memperbarui data pelanggan
 * @route PUT /api/customers/:id
 */
export const updateCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user?.tenantId;

    const parseResult = customerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    // Pastikan pelanggan ada
    const existing = await prisma.customer.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {}),
      },
    });

    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Data pelanggan tidak ditemukan',
      });
    }

    const { name, phone, email, address, notes, code } = parseResult.data;

    // Cek duplikasi nomor telepon jika diubah
    if (phone && phone.trim() && phone.trim() !== existing.phone) {
      const duplicatePhone = await prisma.customer.findFirst({
        where: {
          id: { not: id },
          phone: phone.trim(),
          ...(tenantId ? { tenantId } : {}),
        },
      });

      if (duplicatePhone) {
        return res.status(400).json({
          status: 'error',
          message: `Nomor telepon "${phone}" sudah digunakan oleh ${duplicatePhone.name}`,
        });
      }
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        code: code !== undefined ? (code?.trim() || null) : existing.code,
        name: name.trim(),
        phone: phone !== undefined ? (phone?.trim() || null) : existing.phone,
        email: email !== undefined ? (email?.trim() || null) : existing.email,
        address: address !== undefined ? (address?.trim() || null) : existing.address,
      },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Data pelanggan berhasil diperbarui',
      data: updated,
    });
  } catch (error) {
    console.error('Error saat memperbarui data pelanggan:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui data pelanggan',
    });
  }
};

/**
 * Controller: Menghapus pelanggan
 * @route DELETE /api/customers/:id
 */
export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user?.tenantId;

    const existing = await prisma.customer.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {}),
      },
      include: {
        _count: { select: { orders: true } },
      },
    });

    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Data pelanggan tidak ditemukan',
      });
    }

    // Jika pelanggan memiliki transaksi, lepaskan relasi order (set customerId = null) agar histori audit penjualan tetap utuh
    if (existing._count.orders > 0) {
      await prisma.order.updateMany({
        where: { customerId: id },
        data: { customerId: null },
      });
    }

    await prisma.customer.delete({
      where: { id },
    });

    return res.status(200).json({
      status: 'success',
      message: `Pelanggan "${existing.name}" berhasil dihapus`,
    });
  } catch (error) {
    console.error('Error saat menghapus data pelanggan:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus data pelanggan',
    });
  }
};

/**
 * Controller: Riwayat mutasi poin loyalitas pelanggan
 * @route GET /api/customers/:id/points-history
 */
export const getCustomerPointsHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const customer = await prisma.customer.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        code: true,
        tier: true,
        loyaltyPoints: true,
        totalSpent: true,
        visitCount: true,
      },
    });

    if (!customer) {
      return res.status(404).json({ status: 'error', message: 'Pelanggan tidak ditemukan' });
    }

    const ledgers = await prisma.customerPointLedger.findMany({
      where: { customerId: id, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        order: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
          },
        },
      },
    });

    return res.status(200).json({
      status: 'success',
      customer,
      data: ledgers,
    });
  } catch (error: any) {
    console.error('Error in getCustomerPointsHistory:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat riwayat poin pelanggan', error: error.message });
  }
};

/**
 * Controller: Penyesuaian poin loyalitas manual oleh manajer/admin
 * @route POST /api/customers/:id/adjust-points
 */
export const adjustCustomerPoints = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const adjustSchema = z.object({
      deltaPoints: z.number().int().refine((val) => val !== 0, 'Perubahan poin tidak boleh 0'),
      notes: z.string().min(1, 'Catatan penyesuaian wajib diisi'),
      type: z.nativeEnum(PointTxType).optional().default(PointTxType.MANUAL_ADJUSTMENT),
    });

    const { deltaPoints, notes, type } = adjustSchema.parse(req.body);

    const result = await loyaltyService.adjustPoints(tenantId, id, deltaPoints, notes, type);

    return res.status(200).json({
      status: 'success',
      message: `Poin pelanggan berhasil disesuaikan (${deltaPoints > 0 ? '+' : ''}${deltaPoints} poin)`,
      data: result,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: error.errors[0].message, errors: error.errors });
    }
    console.error('Error in adjustCustomerPoints:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal menyesuaikan poin pelanggan' });
  }
};

