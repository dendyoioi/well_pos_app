import { Request, Response } from 'express';
import { z } from 'zod';
import { StockMovementType } from '@prisma/client';
import { prisma } from '../config/prisma';

// Skema validasi pembuatan produk baru
const createProductSchema = z.object({
  barcode: z.string().min(3, 'Barcode minimal 3 karakter'),
  sku: z.string().min(3, 'SKU minimal 3 karakter'),
  name: z.string().min(2, 'Nama produk minimal 2 karakter'),
  categoryId: z.string().uuid('Kategori tidak valid'),
  costPrice: z.number().min(0, 'Harga modal tidak boleh negatif'),
  basePrice: z.number().min(0, 'Harga jual tidak boleh negatif'),
  unit: z.string().default('Pcs'),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  initialStock: z.number().int().min(0).default(0),
  minStockAlert: z.number().int().min(0).default(5),
  outletId: z.string().uuid().optional(),
});

// Skema validasi update produk
const updateProductSchema = z.object({
  barcode: z.string().min(3).optional(),
  sku: z.string().min(3).optional(),
  name: z.string().min(2).optional(),
  categoryId: z.string().uuid().optional(),
  costPrice: z.number().min(0).optional(),
  basePrice: z.number().min(0).optional(),
  unit: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  minStockAlert: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Controller: Mendapatkan katalog produk dengan pencarian & filter stok cabang
 * @route GET /api/products
 */
export const getProducts = async (req: Request, res: Response) => {
  try {
    const { search, categoryId, outletId: queryOutletId, isActive } = req.query;

    // Tentukan outlet yang menjadi konteks stok
    let targetOutletId = (queryOutletId as string) || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = await prisma.outlet.findFirst({ select: { id: true } });
      targetOutletId = defaultOutlet?.id;
    }

    const currentOutlet = targetOutletId
      ? await prisma.outlet.findUnique({
          where: { id: targetOutletId },
          select: { id: true, isWarehouse: true, warehouseId: true, tenantId: true },
        })
      : null;

    let warehouseId: string | null = null;
    if (currentOutlet && !currentOutlet.isWarehouse) {
      if (currentOutlet.warehouseId) {
        warehouseId = currentOutlet.warehouseId;
      } else if (currentOutlet.tenantId) {
        const wh = await prisma.outlet.findFirst({
          where: { tenantId: currentOutlet.tenantId, isWarehouse: true },
          select: { id: true },
        });
        warehouseId = wh?.id || null;
      }
    }

    const outletIdsToQuery = [targetOutletId, warehouseId].filter(Boolean) as string[];

    const userTenantId = req.user?.tenantId;
    const where: any = {};
    if (userTenantId) {
      where.tenantId = userTenantId;
    }

    // Filter aktif/nonaktif: 'all' menampilkan semua, 'true' hanya aktif, 'false' hanya nonaktif
    if (isActive === 'all') {
      // Tidak ada filter isActive
    } else if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    } else {
      where.isActive = true;
    }

    // Filter cabang / outlet jika diberikan
    if (queryOutletId && typeof queryOutletId === 'string') {
      where.outletProducts = {
        some: { outletId: queryOutletId },
      };
    }

    // Filter kategori
    if (categoryId && typeof categoryId === 'string') {
      where.categoryId = categoryId;
    }

    // Pencarian realtime (Nama, Barcode, atau SKU)
    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true },
        },
        outletProducts: outletIdsToQuery.length > 0
          ? {
              where: { outletId: { in: outletIdsToQuery } },
              select: { outletId: true, stock: true, minStockAlert: true, price: true },
            }
          : false,
      },
      orderBy: { name: 'asc' },
    });

    const formattedProducts = products.map((p) => {
      const outletStock = p.outletProducts?.find((op) => op.outletId === targetOutletId);
      const whStock = warehouseId ? p.outletProducts?.find((op) => op.outletId === warehouseId) : null;
      return {
        id: p.id,
        barcode: p.barcode,
        sku: p.sku,
        name: p.name,
        description: p.description,
        costPrice: Number(p.costPrice),
        basePrice: Number(p.basePrice),
        price: outletStock?.price ? Number(outletStock.price) : Number(p.basePrice),
        unit: p.unit,
        imageUrl: p.imageUrl,
        isActive: p.isActive,
        category: p.category,
        stock: outletStock?.stock ?? 0,
        warehouseStock: whStock ? whStock.stock : null,
        minStockAlert: outletStock?.minStockAlert ?? 5,
        isLowStock: (outletStock?.stock ?? 0) <= (outletStock?.minStockAlert ?? 5),
        createdAt: p.createdAt,
      };
    });

    return res.status(200).json({
      status: 'success',
      data: formattedProducts,
      meta: {
        total: formattedProducts.length,
        outletId: targetOutletId,
      },
    });
  } catch (error) {
    console.error('Error saat mengambil data produk:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memuat katalog produk',
    });
  }
};

/**
 * Controller: Detail 1 produk berdasarkan ID
 * @route GET /api/products/:id
 */
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const userTenantId = req.user?.tenantId;
    const product = await prisma.product.findFirst({
      where: {
        id,
        ...(userTenantId ? { tenantId: userTenantId } : {}),
      },
      include: {
        category: true,
        outletProducts: {
          include: { outlet: { select: { id: true, name: true } } },
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Produk tidak ditemukan',
      });
    }

    const outletStock = product.outletProducts?.[0];

    return res.status(200).json({
      status: 'success',
      data: {
        ...product,
        costPrice: Number(product.costPrice),
        basePrice: Number(product.basePrice),
        stock: outletStock?.stock ?? 0,
        minStockAlert: outletStock?.minStockAlert ?? 5,
        isLowStock: (outletStock?.stock ?? 0) <= (outletStock?.minStockAlert ?? 5),
      },
    });
  } catch (error) {
    console.error('Error saat mengambil detail produk:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memuat detail produk',
    });
  }
};

/**
 * Controller: Membuat master produk baru beserta stok cabang awal
 * @route POST /api/products
 */
export const createProduct = async (req: Request, res: Response) => {
  try {
    const parseResult = createProductSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const {
      barcode,
      sku,
      name,
      categoryId,
      costPrice,
      basePrice,
      unit,
      description,
      imageUrl,
      initialStock,
      minStockAlert,
      outletId,
    } = parseResult.data;

    const userTenantId = req.user?.tenantId;

    // Cek duplikasi barcode atau SKU untuk tenant ini
    const existingSku = await prisma.product.findFirst({
      where: {
        sku,
        ...(userTenantId ? { tenantId: userTenantId } : {}),
      },
    });
    if (existingSku) {
      return res.status(400).json({
        status: 'error',
        message: `SKU "${sku}" sudah digunakan oleh produk lain di toko Anda`,
      });
    }

    const existingBarcode = await prisma.product.findFirst({
      where: {
        barcode,
        ...(userTenantId ? { tenantId: userTenantId } : {}),
      },
    });
    if (existingBarcode) {
      return res.status(400).json({
        status: 'error',
        message: `Barcode "${barcode}" sudah digunakan oleh produk lain di toko Anda`,
      });
    }

    // Tentukan outlet target
    let targetOutletId = outletId || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = await prisma.outlet.findFirst({
        where: req.user?.tenantId ? { tenantId: req.user.tenantId } : undefined,
        select: { id: true },
      });
      targetOutletId = defaultOutlet?.id;
    }

    if (!targetOutletId) {
      return res.status(400).json({
        status: 'error',
        message: 'Outlet cabang tidak ditemukan untuk alokasi stok produk',
      });
    }

    // Gunakan Prisma transaction untuk menjaga integritas data
    const result = await prisma.$transaction(async (tx) => {
      // 1. Buat master produk
      const newProduct = await tx.product.create({
        data: {
          tenantId: req.user?.tenantId || undefined,
          barcode,
          sku,
          name,
          categoryId,
          costPrice,
          basePrice,
          unit,
          description,
          imageUrl,
          isActive: true,
        },
      });

      // 2. Alokasikan stok cabang
      const outletStock = await tx.outletProduct.create({
        data: {
          outletId: targetOutletId,
          productId: newProduct.id,
          stock: initialStock,
          minStockAlert,
        },
      });

      // 3. Jika ada stok awal, catat mutasi kartu stok
      if (initialStock > 0 && req.user?.id) {
        await tx.stockMovement.create({
          data: {
            outletId: targetOutletId,
            productId: newProduct.id,
            userId: req.user.id,
            type: StockMovementType.PURCHASE_IN,
            quantity: initialStock,
            notes: 'Saldo stok awal pembuatan produk',
          },
        });
      }

      return { product: newProduct, outletStock };
    });

    return res.status(201).json({
      status: 'success',
      message: 'Produk berhasil ditambahkan',
      data: {
        ...result.product,
        costPrice: Number(result.product.costPrice),
        basePrice: Number(result.product.basePrice),
        stock: result.outletStock.stock,
        minStockAlert: result.outletStock.minStockAlert,
      },
    });
  } catch (error) {
    console.error('Error saat membuat produk:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal membuat produk baru',
    });
  }
};

/**
 * Controller: Update produk
 * @route PUT /api/products/:id
 */
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = updateProductSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const {
      barcode,
      sku,
      name,
      categoryId,
      costPrice,
      basePrice,
      unit,
      description,
      imageUrl,
      minStockAlert,
      isActive,
    } = parseResult.data;

    const userTenantId = req.user?.tenantId;
    const existing = await prisma.product.findFirst({
      where: {
        id,
        ...(userTenantId ? { tenantId: userTenantId } : {}),
      },
    });
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Produk tidak ditemukan',
      });
    }

    // Cek duplikasi jika barcode / sku diubah untuk tenant ini
    if (sku && sku !== existing.sku) {
      const dup = await prisma.product.findFirst({
        where: {
          sku,
          id: { not: id },
          ...(userTenantId ? { tenantId: userTenantId } : {}),
        },
      });
      if (dup) {
        return res.status(400).json({ status: 'error', message: `SKU "${sku}" sudah digunakan` });
      }
    }

    if (barcode && barcode !== existing.barcode) {
      const dup = await prisma.product.findFirst({
        where: {
          barcode,
          id: { not: id },
          ...(userTenantId ? { tenantId: userTenantId } : {}),
        },
      });
      if (dup) {
        return res.status(400).json({ status: 'error', message: `Barcode "${barcode}" sudah digunakan` });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id },
        data: {
          barcode,
          sku,
          name,
          categoryId,
          costPrice,
          basePrice,
          unit,
          description,
          imageUrl,
          isActive,
        },
      });

      // Update minStockAlert jika disertakan
      if (minStockAlert !== undefined) {
        const targetOutletId = req.user?.outletId;
        if (targetOutletId) {
          await tx.outletProduct.updateMany({
            where: { productId: id, outletId: targetOutletId },
            data: { minStockAlert },
          });
        }
      }

      return p;
    });

    return res.status(200).json({
      status: 'success',
      message: 'Produk berhasil diperbarui',
      data: {
        ...updated,
        costPrice: Number(updated.costPrice),
        basePrice: Number(updated.basePrice),
      },
    });
  } catch (error) {
    console.error('Error saat update produk:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui data produk',
    });
  }
};

/**
 * Controller: Soft-delete produk (isActive = false)
 * @route DELETE /api/products/:id
/**
 * Controller: Mendapatkan info audit sebelum menghapus produk (Smart Delete Check)
 * @route GET /api/products/:id/delete-info
 */
export const getProductDeleteInfo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { outletId } = req.query;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { name: true } },
      },
    });

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Produk tidak ditemukan',
      });
    }

    let outletName = 'Seluruh Sistem';
    let currentStock = 0;
    let transactionCount = 0;

    if (outletId && typeof outletId === 'string') {
      const outlet = await prisma.outlet.findUnique({
        where: { id: outletId },
        select: { name: true },
      });
      if (outlet) outletName = outlet.name;

      const outletProd = await prisma.outletProduct.findUnique({
        where: {
          outletId_productId: {
            outletId,
            productId: id,
          },
        },
      });
      currentStock = outletProd?.stock ?? 0;

      transactionCount = await prisma.orderItem.count({
        where: {
          productId: id,
          order: { outletId },
        },
      });
    } else {
      transactionCount = await prisma.orderItem.count({
        where: { productId: id },
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        id: product.id,
        name: product.name,
        categoryName: product.category?.name,
        outletName,
        currentStock,
        transactionCount,
        hasTransactions: transactionCount > 0,
      },
    });
  } catch (error) {
    console.error('Error saat cek info delete produk:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil informasi produk',
    });
  }
};

/**
 * Controller: Menghapus / melepas produk dari katalog cabang atau master
 * @route DELETE /api/products/:id
 */
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const outletId = (req.query.outletId as string) || (req.body.outletId as string);

    const userTenantId = req.user?.tenantId;
    const existing = await prisma.product.findFirst({
      where: {
        id,
        ...(userTenantId ? { tenantId: userTenantId } : {}),
      },
    });
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Produk tidak ditemukan',
      });
    }

    // Jika diberikan outletId: Lepas produk dari cabang ini (Unlink per outlet)
    if (outletId && typeof outletId === 'string') {
      const outlet = await prisma.outlet.findUnique({
        where: { id: outletId },
        select: { name: true },
      });

      const deletedOutletProduct = await prisma.outletProduct.deleteMany({
        where: {
          outletId,
          productId: id,
        },
      });

      if (deletedOutletProduct.count === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Produk tidak terhubung dengan cabang ini',
        });
      }

      return res.status(200).json({
        status: 'success',
        message: `Produk "${existing.name}" berhasil dilepas dari ${outlet?.name || 'cabang ini'}. Riwayat transaksi masa lalu tetap aman.`,
      });
    }

    // Jika tanpa outletId: Soft-delete global
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Produk berhasil dinonaktifkan secara global',
    });
  } catch (error) {
    console.error('Error saat menghapus produk:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal melepas/menghapus produk',
    });
  }
};

const bulkActionSchema = z.object({
  action: z.enum(['DELETE', 'SET_STATUS', 'CHANGE_CATEGORY']),
  productIds: z.array(z.string().uuid()).min(1, 'Pilih minimal 1 produk'),
  isActive: z.boolean().optional(),
  categoryId: z.string().uuid().optional(),
  outletId: z.string().uuid().optional(),
});

/**
 * Controller: Aksi Massal (Bulk Actions) untuk Produk
 * - DELETE: Hapus / lepas produk dari cabang (atau nonaktifkan massal jika tanpa outletId)
 * - SET_STATUS: Ubah status aktif/nonaktif massal
 * - CHANGE_CATEGORY: Pindahkan kategori massal
 * @route POST /api/products/bulk-action
 */
export const bulkProductAction = async (req: Request, res: Response) => {
  try {
    const parseResult = bulkActionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi bulk action gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { action, productIds, isActive, categoryId, outletId } = parseResult.data;

    if (action === 'DELETE') {
      if (outletId) {
        const deleted = await prisma.outletProduct.deleteMany({
          where: {
            outletId,
            productId: { in: productIds },
          },
        });

        return res.status(200).json({
          status: 'success',
          message: `Berhasil melepas ${deleted.count} produk dari cabang ini. Riwayat transaksi masa lalu tetap aman.`,
        });
      }

      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { isActive: false },
      });

      return res.status(200).json({
        status: 'success',
        message: `Berhasil menghapus/menonaktifkan ${productIds.length} produk terpilih`,
      });
    }

    if (action === 'SET_STATUS') {
      if (isActive === undefined) {
        return res.status(400).json({
          status: 'error',
          message: 'Status isActive wajib disertakan untuk aksi SET_STATUS',
        });
      }

      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { isActive },
      });

      return res.status(200).json({
        status: 'success',
        message: `Berhasil mengubah status ${productIds.length} produk menjadi ${isActive ? 'Aktif' : 'Nonaktif'}`,
      });
    }

    if (action === 'CHANGE_CATEGORY') {
      if (!categoryId) {
        return res.status(400).json({
          status: 'error',
          message: 'Kategori tujuan wajib dipilih',
        });
      }

      const targetCategory = await prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!targetCategory) {
        return res.status(404).json({
          status: 'error',
          message: 'Kategori tujuan tidak ditemukan',
        });
      }

      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { categoryId },
      });

      return res.status(200).json({
        status: 'success',
        message: `Berhasil memindahkan ${productIds.length} produk ke kategori "${targetCategory.name}"`,
      });
    }

    return res.status(400).json({
      status: 'error',
      message: 'Aksi tidak dikenali',
    });
  } catch (error) {
    console.error('Error saat bulk action produk:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memproses aksi massal produk',
    });
  }
};

/**
 * Controller: Mendapatkan produk dari master katalog yang BELUM terhubung ke outlet ini
 * @route GET /api/products/available-for-outlet
 */
export const getAvailableProductsForOutlet = async (req: Request, res: Response) => {
  try {
    const { outletId, search } = req.query;
    if (!outletId || typeof outletId !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'outletId wajib disertakan',
      });
    }

    const where: any = {
      outletProducts: {
        none: { outletId },
      },
    };

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      status: 'success',
      data: products.map((p) => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        sku: p.sku,
        basePrice: Number(p.basePrice),
        costPrice: Number(p.costPrice),
        category: p.category,
        unit: p.unit,
        imageUrl: p.imageUrl,
      })),
    });
  } catch (error) {
    console.error('Error saat mengambil produk katalog untuk outlet:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memuat produk katalog yang tersedia',
    });
  }
};

const assignProductsSchema = z.object({
  outletId: z.string().uuid('ID Cabang tidak valid'),
  assignments: z.array(
    z.object({
      productId: z.string().uuid('ID Produk tidak valid'),
      initialStock: z.number().int().min(0).default(0),
      customPrice: z.number().min(0).optional(),
    })
  ).min(1, 'Pilih minimal 1 produk'),
});

/**
 * Controller: Menghubungkan produk katalog yang sudah ada ke cabang
 * @route POST /api/products/assign-to-outlet
 */
export const assignProductsToOutlet = async (req: Request, res: Response) => {
  try {
    const parseResult = assignProductsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { outletId, assignments } = parseResult.data;

    const created = await prisma.$transaction(
      assignments.map((item) =>
        prisma.outletProduct.upsert({
          where: {
            outletId_productId: {
              outletId,
              productId: item.productId,
            },
          },
          update: {
            stock: item.initialStock,
            price: item.customPrice,
          },
          create: {
            outletId,
            productId: item.productId,
            stock: item.initialStock,
            price: item.customPrice,
          },
        })
      )
    );

    // Pastikan master product juga aktif ketika dihubungkan ke cabang
    await prisma.product.updateMany({
      where: { id: { in: assignments.map((a) => a.productId) } },
      data: { isActive: true },
    });

    return res.status(200).json({
      status: 'success',
      message: `Berhasil menambahkan ${created.length} produk ke cabang ini`,
    });
  } catch (error) {
    console.error('Error saat menghubungkan produk ke outlet:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghubungkan produk ke cabang',
    });
  }
};
