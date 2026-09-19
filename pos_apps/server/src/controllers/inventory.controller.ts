import { Request, Response } from 'express';
import { z } from 'zod';
import { StockMovementType } from '@prisma/client';
import { prisma } from '../config/prisma';

const stockChangeSchema = z.object({
  productId: z.string().uuid('ID Produk tidak valid'),
  quantity: z.number().int().positive('Jumlah harus berupa angka bulat positif'),
  notes: z.string().optional(),
  outletId: z.string().uuid().optional(),
  poNumber: z.string().optional(),
  supplierName: z.string().optional(),
  newCostPrice: z.number().min(0).optional(),
});

const stockAdjustmentSchema = z.object({
  productId: z.string().uuid('ID Produk tidak valid'),
  actualStock: z.number().int().min(0, 'Stok fisik tidak boleh negatif'),
  notes: z.string().min(1, 'Catatan penyesuaian/alasan opname wajib diisi'),
  outletId: z.string().uuid().optional(),
});

const transferStockSchema = z.object({
  productId: z.string().uuid('ID Produk tidak valid'),
  sourceOutletId: z.string().uuid('ID Cabang Asal tidak valid'),
  targetOutletId: z.string().uuid('ID Cabang Tujuan tidak valid'),
  quantity: z.number().int().positive('Jumlah transfer harus berupa angka bulat positif'),
  notes: z.string().optional(),
});

/**
 * Controller: Mencatat Stok Masuk dari Pembelian / Supplier (Stock-In)
 * @route POST /api/inventory/stock-in
 */
export const recordStockIn = async (req: Request, res: Response) => {
  try {
    const parseResult = stockChangeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { productId, quantity, notes, outletId, poNumber, supplierName, newCostPrice } = parseResult.data;

    let targetOutletId = outletId || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = await prisma.outlet.findFirst({ select: { id: true } });
      targetOutletId = defaultOutlet?.id;
    }

    if (!targetOutletId) {
      return res.status(400).json({ status: 'error', message: 'Outlet tidak ditemukan' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'User belum terautentikasi' });
    }

    // Bangun catatan mutasi informatif
    const noteParts: string[] = [];
    if (poNumber) noteParts.push(`No. PO: ${poNumber}`);
    if (supplierName) noteParts.push(`Supplier: ${supplierName}`);
    if (notes) noteParts.push(notes);
    const finalNotes = noteParts.length > 0 ? noteParts.join(' | ') : 'Penerimaan stok masuk (PO / Pembelian)';

    // Eksekusi atomik menggunakan Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update stok di cabang
      const outletProduct = await tx.outletProduct.upsert({
        where: {
          outletId_productId: {
            outletId: targetOutletId!,
            productId,
          },
        },
        update: {
          stock: { increment: quantity },
        },
        create: {
          outletId: targetOutletId!,
          productId,
          stock: quantity,
          minStockAlert: 5,
        },
        include: { product: { select: { name: true, sku: true, unit: true, costPrice: true } } },
      });

      // Update harga modal (HPP) jika ada revisi harga beli dari supplier
      if (newCostPrice !== undefined && newCostPrice >= 0) {
        await tx.product.update({
          where: { id: productId },
          data: { costPrice: newCostPrice },
        });
      }

      // 2. Catat kartu stok (Stock Movement)
      const movement = await tx.stockMovement.create({
        data: {
          outletId: targetOutletId!,
          productId,
          userId,
          type: StockMovementType.PURCHASE_IN,
          quantity: quantity,
          notes: finalNotes,
        },
      });

      return { outletProduct, movement };
    });

    return res.status(200).json({
      status: 'success',
      message: `Berhasil mencatat penerimaan ${quantity} ${result.outletProduct.product.unit} untuk "${result.outletProduct.product.name}"`,
      data: {
        newStock: result.outletProduct.stock,
        movement: result.movement,
      },
    });
  } catch (error) {
    console.error('Error saat mencatat stok masuk:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memproses stok masuk' });
  }
};

/**
 * Controller: Mencatat Stok Keluar Barang Rusak / Kadaluarsa (Stock-Out)
 * @route POST /api/inventory/stock-out
 */
export const recordStockOut = async (req: Request, res: Response) => {
  try {
    const parseResult = stockChangeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { productId, quantity, notes, outletId } = parseResult.data;

    let targetOutletId = outletId || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = await prisma.outlet.findFirst({ select: { id: true } });
      targetOutletId = defaultOutlet?.id;
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'User belum terautentikasi' });
    }

    const outletProduct = await prisma.outletProduct.findUnique({
      where: {
        outletId_productId: {
          outletId: targetOutletId!,
          productId,
        },
      },
      include: { product: { select: { name: true, unit: true } } },
    });

    if (!outletProduct) {
      return res.status(404).json({ status: 'error', message: 'Produk belum dialokasikan di outlet ini' });
    }

    if (outletProduct.stock < quantity) {
      return res.status(400).json({
        status: 'error',
        message: `Stok tidak mencukupi. Stok saat ini: ${outletProduct.stock} ${outletProduct.product.unit}, permintaan keluar: ${quantity}`,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.outletProduct.update({
        where: {
          outletId_productId: {
            outletId: targetOutletId!,
            productId,
          },
        },
        data: {
          stock: { decrement: quantity },
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          outletId: targetOutletId!,
          productId,
          userId,
          type: StockMovementType.DAMAGE_OUT,
          quantity: -quantity,
          notes: notes || 'Barang rusak / kadaluarsa dikeluarkan dari rak',
        },
      });

      return { updated, movement };
    });

    return res.status(200).json({
      status: 'success',
      message: `Berhasil mengeluarkan ${quantity} ${outletProduct.product.unit} stok`,
      data: {
        newStock: result.updated.stock,
        movement: result.movement,
      },
    });
  } catch (error) {
    console.error('Error saat mencatat stok keluar:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memproses stok keluar' });
  }
};

/**
 * Controller: Penyesuaian Stok Fisik / Stock Opname (Stock Adjustment)
 * @route POST /api/inventory/adjustment
 */
export const recordStockAdjustment = async (req: Request, res: Response) => {
  try {
    const parseResult = stockAdjustmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { productId, actualStock, notes, outletId } = parseResult.data;

    let targetOutletId = outletId || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = await prisma.outlet.findFirst({ select: { id: true } });
      targetOutletId = defaultOutlet?.id;
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'User belum terautentikasi' });
    }

    const existing = await prisma.outletProduct.findUnique({
      where: {
        outletId_productId: {
          outletId: targetOutletId!,
          productId,
        },
      },
      include: { product: { select: { name: true, unit: true } } },
    });

    const currentStock = existing?.stock ?? 0;
    const difference = actualStock - currentStock;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.outletProduct.upsert({
        where: {
          outletId_productId: {
            outletId: targetOutletId!,
            productId,
          },
        },
        update: { stock: actualStock },
        create: {
          outletId: targetOutletId!,
          productId,
          stock: actualStock,
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          outletId: targetOutletId!,
          productId,
          userId,
          type: StockMovementType.ADJUSTMENT,
          quantity: difference,
          notes: `Stock Opname: dari ${currentStock} ke ${actualStock}. Alasan: ${notes}`,
        },
      });

      return { updated, movement };
    });

    return res.status(200).json({
      status: 'success',
      message: 'Stok berhasil disesuaikan dengan fisik toko',
      data: {
        previousStock: currentStock,
        actualStock: result.updated.stock,
        newStock: result.updated.stock,
        difference,
        movement: result.movement,
      },
    });
  } catch (error) {
    console.error('Error saat stock opname:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memproses penyesuaian stok' });
  }
};

/**
 * Controller: Mendapatkan riwayat mutasi kartu stok
 * @route GET /api/inventory/movements
 */
export const getStockMovements = async (req: Request, res: Response) => {
  try {
    const { productId, type, outletId, limit, search, startDate, endDate } = req.query;

    const userTenantId = req.user?.tenantId;
    const where: any = {};
    if (userTenantId) {
      where.outlet = { tenantId: userTenantId };
    }
    if (productId && typeof productId === 'string') where.productId = productId;
    if (outletId && typeof outletId === 'string') {
      where.outletId = outletId;
      if (userTenantId) where.outlet = { id: outletId, tenantId: userTenantId };
    }
    if (type && typeof type === 'string') where.type = type;

    if (search && typeof search === 'string') {
      where.OR = [
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { product: { sku: { contains: search, mode: 'insensitive' } } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true, costPrice: true, basePrice: true } },
        user: { select: { id: true, name: true, role: true } },
        outlet: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string, 10) : 100,
    });

    return res.status(200).json({
      status: 'success',
      data: movements,
    });
  } catch (error) {
    console.error('Error saat mengambil riwayat kartu stok:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat kartu stok' });
  }
};

/**
 * Controller: Mendapatkan daftar produk yang stoknya menipis (Low Stock Alert)
 * @route GET /api/inventory/low-stock
 */
export const getLowStockProducts = async (req: Request, res: Response) => {
  try {
    const userTenantId = req.user?.tenantId;
    let targetOutletId = (req.query.outletId as string) || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = await prisma.outlet.findFirst({
        where: userTenantId ? { tenantId: userTenantId } : {},
        select: { id: true },
      });
      targetOutletId = defaultOutlet?.id;
    }

    const lowStockItems = await prisma.outletProduct.findMany({
      where: {
        outletId: targetOutletId,
        ...(userTenantId ? { outlet: { tenantId: userTenantId } } : {}),
        stock: { lte: prisma.outletProduct.fields.minStockAlert },
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, barcode: true, unit: true, basePrice: true },
        },
      },
      orderBy: { stock: 'asc' },
    });

    return res.status(200).json({
      status: 'success',
      data: lowStockItems.map((item) => ({
        productId: item.productId,
        name: item.product.name,
        sku: item.product.sku,
        barcode: item.product.barcode,
        unit: item.product.unit,
        stock: item.stock,
        minStockAlert: item.minStockAlert,
      })),
    });
  } catch (error) {
    console.error('Error saat memeriksa low stock:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat alert stok menipis' });
  }
};

/**
 * Controller: Mutasi Transfer Stok Antar Cabang (Multi-Outlet)
 * @route POST /api/inventory/transfer
 */
export const transferStock = async (req: Request, res: Response) => {
  try {
    const parseResult = transferStockSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input transfer gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { productId, sourceOutletId, targetOutletId, quantity, notes } = parseResult.data;

    if (sourceOutletId === targetOutletId) {
      return res.status(400).json({
        status: 'error',
        message: 'Cabang asal dan cabang tujuan tidak boleh sama',
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'User belum terautentikasi' });
    }

    // Ambil info cabang asal & cabang tujuan
    const [sourceOutlet, targetOutlet, product] = await Promise.all([
      prisma.outlet.findUnique({ where: { id: sourceOutletId }, select: { id: true, name: true } }),
      prisma.outlet.findUnique({ where: { id: targetOutletId }, select: { id: true, name: true } }),
      prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true, sku: true, unit: true } }),
    ]);

    if (!sourceOutlet || !targetOutlet) {
      return res.status(404).json({ status: 'error', message: 'Data cabang tidak ditemukan' });
    }

    if (!product) {
      return res.status(404).json({ status: 'error', message: 'Produk tidak ditemukan' });
    }

    // Periksa stok cabang asal
    const sourceOutletProduct = await prisma.outletProduct.findUnique({
      where: {
        outletId_productId: {
          outletId: sourceOutletId,
          productId,
        },
      },
    });

    const currentStock = sourceOutletProduct?.stock || 0;
    if (currentStock < quantity) {
      return res.status(400).json({
        status: 'error',
        message: `Stok di cabang "${sourceOutlet.name}" tidak mencukupi! Tersedia: ${currentStock} ${product.unit}, diminta: ${quantity} ${product.unit}.`,
      });
    }

    // Eksekusi atomik menggunakan Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Kurangi stok di cabang asal
      await tx.outletProduct.update({
        where: {
          outletId_productId: {
            outletId: sourceOutletId,
            productId,
          },
        },
        data: {
          stock: { decrement: quantity },
        },
      });

      // 2. Tambah stok di cabang tujuan
      await tx.outletProduct.upsert({
        where: {
          outletId_productId: {
            outletId: targetOutletId,
            productId,
          },
        },
        update: {
          stock: { increment: quantity },
        },
        create: {
          outletId: targetOutletId,
          productId,
          stock: quantity,
          minStockAlert: 5,
        },
      });

      // 3. Catat kartu stok TRANSFER_OUT di cabang asal
      const outNote = notes
        ? `Transfer keluar ke ${targetOutlet.name} | ${notes}`
        : `Transfer keluar ke ${targetOutlet.name}`;
      await tx.stockMovement.create({
        data: {
          outletId: sourceOutletId,
          productId,
          userId,
          type: StockMovementType.TRANSFER_OUT,
          quantity: -quantity,
          notes: outNote,
        },
      });

      // 4. Catat kartu stok TRANSFER_IN di cabang tujuan
      const inNote = notes
        ? `Transfer masuk dari ${sourceOutlet.name} | ${notes}`
        : `Transfer masuk dari ${sourceOutlet.name}`;
      await tx.stockMovement.create({
        data: {
          outletId: targetOutletId,
          productId,
          userId,
          type: StockMovementType.TRANSFER_IN,
          quantity: quantity,
          notes: inNote,
        },
      });

      return {
        productName: product.name,
        quantity,
        sourceOutlet: sourceOutlet.name,
        targetOutlet: targetOutlet.name,
      };
    });

    return res.status(200).json({
      status: 'success',
      message: `Berhasil mentransfer ${quantity} ${product.unit} ${product.name} dari ${sourceOutlet.name} ke ${targetOutlet.name}`,
      data: result,
    });
  } catch (error) {
    console.error('Error saat mentransfer stok:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memproses transfer stok' });
  }
};

