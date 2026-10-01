import { Request, Response } from 'express';
import { z } from 'zod';
import { StockMovementType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { catalogDualWriteService } from '../services/dual_write';
import { catalogReadAdapter, isReadFromTargetEnabled } from '../services/read_adapters';

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
  barcode: z.string().min(3).optional().nullable(),
  sku: z.string().min(3).optional().nullable(),
  name: z.string().min(2).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  costPrice: z.number().min(0).optional(),
  basePrice: z.number().min(0).optional(),
  unit: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
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

    // Fix T1: Hapus req.query.tenantId — user input tidak boleh override JWT context
    let userTenantId: string | undefined = req.user?.tenantId || req.tenantId || (req.headers['x-tenant-id'] as string);

    // Tentukan outlet yang menjadi konteks stok
    let targetOutletId = (queryOutletId as string) || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = userTenantId
        ? await prisma.outlet.findFirst({
            where: { tenantId: userTenantId },
            select: { id: true },
          })
        : null;
      targetOutletId = defaultOutlet?.id;
    }

    // Fix K3: Jika tenantId masih kosong, tolak request dengan 401 — jangan fallback ke tenant pertama
    if (!userTenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    // Fix T1 & Cross-Tenant Isolation: Pastikan outlet yang diminta adalah milik tenant yang sedang login
    if (targetOutletId) {
      const outletBelongsToTenant = await prisma.outlet.findFirst({
        where: { id: targetOutletId, tenantId: userTenantId },
        select: { id: true },
      });
      if (!outletBelongsToTenant) {
        return res.status(403).json({
          status: 'error',
          message: 'Akses outlet ditolak: Cabang toko tidak terdaftar di bawah akun bisnis Anda',
        });
      }
    }

    const result = await catalogReadAdapter.getProducts({
      tenantId: userTenantId || '',
      outletId: targetOutletId,
      categoryId: categoryId as string,
      search: search as string,
      isActive: isActive as string,
    });
    return res.status(200).json({
      status: 'success',
      data: result.data,
      meta: result.meta,
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
    // Fix T1: Hapus req.query.tenantId
    let userTenantId: string | undefined = req.user?.tenantId || req.tenantId || (req.headers['x-tenant-id'] as string);
    // Fix B4: Jika tidak ada outletId di query param, fallback ke outletId dari JWT (req.user.outletId).
    // Mencegah kasir outlet A membaca detail produk outlet B secara lintas-outlet.
    const queryOutletId = (req.query.outletId as string) || req.user?.outletId || undefined;

    if (!userTenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    if (queryOutletId) {
      const outletBelongsToTenant = await prisma.outlet.findFirst({
        where: { id: queryOutletId, tenantId: userTenantId },
        select: { id: true },
      });
      if (!outletBelongsToTenant) {
        return res.status(403).json({
          status: 'error',
          message: 'Akses outlet ditolak: Cabang toko tidak terdaftar di bawah akun bisnis Anda',
        });
      }
    }

    const item = await catalogReadAdapter.getProductById(userTenantId || '', id, queryOutletId);
    if (!item) {
      return res.status(404).json({
        status: 'error',
        message: 'Produk tidak ditemukan',
      });
    }
    return res.status(200).json({
      status: 'success',
      data: item,
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

    let userTenantId = req.user?.tenantId || req.tenantId;

    // Tentukan outlet target
    let targetOutletId = outletId || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = userTenantId
        ? await prisma.outlet.findFirst({
            where: { tenantId: userTenantId },
            select: { id: true },
          })
        : null;
      targetOutletId = defaultOutlet?.id;
    }

    if (!userTenantId && targetOutletId) {
      const outlet = await prisma.outlet.findUnique({
        where: { id: targetOutletId },
        select: { tenantId: true },
      });
      userTenantId = outlet?.tenantId;
    }
    // Fix K3: Jangan fallback ke findFirst() — return 401 jika tenantId masih kosong
    if (!userTenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    // Cek duplikasi barcode atau SKU untuk tenant ini
    const existingSku = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "products" WHERE sku = $1 AND ($2::text IS NULL OR tenant_id = $2) LIMIT 1;`,
      sku,
      userTenantId || null
    );
    if (existingSku.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `SKU "${sku}" sudah digunakan oleh produk lain di toko Anda`,
      });
    }

    const existingBarcode = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "product_variants" WHERE barcode = $1 AND ($2::text IS NULL OR tenant_id = $2) LIMIT 1;`,
      barcode,
      userTenantId || null
    );
    if (existingBarcode.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Barcode "${barcode}" sudah digunakan oleh produk lain di toko Anda`,
      });
    }

    if (!targetOutletId) {
      return res.status(400).json({
        status: 'error',
        message: 'Outlet cabang tidak ditemukan untuk alokasi stok produk',
      });
    }

    // Gunakan Dual-Write Service untuk sinkronisasi atomik ke target schema
    const result = await prisma.$transaction(async (tx) => {
      const dwResult = await catalogDualWriteService.createProduct(
        {
          name,
          sku,
          barcode,
          categoryId,
          costPrice,
          basePrice,
          unit,
          description: description || null,
          imageUrl: imageUrl || null,
          initialStock,
          minStockAlert,
          outletId: targetOutletId,
        },
        { tx, tenantId: userTenantId!, actorUserId: req.user?.id }
      );

      // Alokasikan produk otomatis ke outlet target (EPIC-19)
      await tx.outletProduct.upsert({
        where: {
          outletId_productId: {
            outletId: targetOutletId,
            productId: dwResult.legacyData.id,
          },
        },
        update: { isAvailable: true },
        create: {
          tenantId: userTenantId!,
          outletId: targetOutletId,
          productId: dwResult.legacyData.id,
          isAvailable: true,
        },
      });

      const balanceRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(ib.quantity_on_hand, 0) as stock, COALESCE(ii.reorder_point, 5) as "minStockAlert"
         FROM "product_variants" pv
         JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id
         JOIN "storage_locations" sl ON sl.outlet_id = $1 AND sl.is_default = true
         LEFT JOIN "inventory_balances" ib ON ib.inventory_item_id = ii.id AND ib.storage_location_id = sl.id
         WHERE pv.product_id = $2 AND pv.is_active = true LIMIT 1;`,
        targetOutletId,
        dwResult.legacyData.id
      );
      const outletStock = balanceRows && balanceRows.length > 0
        ? { stock: Number(balanceRows[0].stock), minStockAlert: Number(balanceRows[0].minStockAlert) }
        : { stock: initialStock, minStockAlert };

      return {
        product: dwResult.legacyData,
        outletStock,
      };
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

    let userTenantId = req.user?.tenantId || req.tenantId;
    if (!userTenantId) {
      const prodRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT tenant_id FROM "products" WHERE id = $1 LIMIT 1;`,
        id
      );
      userTenantId = prodRows[0]?.tenant_id;
    }

    const existingRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT p.id, pv.barcode, p.sku 
       FROM "products" p
       LEFT JOIN "product_variants" pv ON pv.product_id = p.id AND pv.is_active = true
       WHERE p.id = $1 AND ($2::text IS NULL OR p.tenant_id = $2) 
       LIMIT 1;`,
      id,
      userTenantId || null
    );
    if (!existingRows || existingRows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Produk tidak ditemukan',
      });
    }
    const existing = existingRows[0];

    // Cek duplikasi jika barcode / sku diubah untuk tenant ini
    if (sku && sku !== existing.sku) {
      const dupRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM "products" WHERE sku = $1 AND id != $2 AND ($3::text IS NULL OR tenant_id = $3) LIMIT 1;`,
        sku,
        id,
        userTenantId || null
      );
      if (dupRows.length > 0) {
        return res.status(400).json({ status: 'error', message: `SKU "${sku}" sudah digunakan` });
      }
    }

    if (barcode && barcode !== existing.barcode) {
      const dupRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM "product_variants" WHERE barcode = $1 AND product_id != $2 AND ($3::text IS NULL OR tenant_id = $3) LIMIT 1;`,
        barcode,
        id,
        userTenantId || null
      );
      if (dupRows.length > 0) {
        return res.status(400).json({ status: 'error', message: `Barcode "${barcode}" sudah digunakan` });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await catalogDualWriteService.updateProduct(
        id,
        {
          name,
          sku: sku || undefined,
          barcode: barcode || undefined,
          categoryId: categoryId || undefined,
          costPrice,
          basePrice,
          unit: unit || undefined,
          description: description || null,
          imageUrl: imageUrl || null,
          isActive,
        },
        { tx, tenantId: userTenantId!, actorUserId: req.user?.id }
      );

      // Update minStockAlert jika disertakan (target: inventory_items.reorder_point)
      if (minStockAlert !== undefined) {
        await tx.$queryRawUnsafe(
          `UPDATE "inventory_items" ii
           SET "reorder_point" = $1, "updated_at" = CURRENT_TIMESTAMP
           FROM "product_variants" pv
           WHERE pv.product_id = $2 AND ii.id = pv.inventory_item_id;`,
          minStockAlert,
          id
        );
      }

      const prodRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT p.id, p.category_id as "categoryId", pv.barcode, p.sku, p.name, p.description,
                COALESCE(ii.average_cost, 0) as "costPrice", COALESCE(pv.price, 0) as "basePrice", p.unit,
                p.image_url as "imageUrl", p.is_active as "isActive", p.created_at as "createdAt",
                p.updated_at as "updatedAt", p.tenant_id as "tenantId", p.type
         FROM "products" p
         LEFT JOIN "product_variants" pv ON pv.product_id = p.id AND pv.is_active = true
         LEFT JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id
         WHERE p.id = $1
         LIMIT 1;`,
        id
      );
      return prodRows[0];
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

      const balanceRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(ib.quantity_on_hand, 0) as stock
         FROM "product_variants" pv
         JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id
         JOIN "storage_locations" sl ON sl.outlet_id = $1 AND sl.is_default = true
         LEFT JOIN "inventory_balances" ib ON ib.inventory_item_id = ii.id AND ib.storage_location_id = sl.id
         WHERE pv.product_id = $2 AND pv.is_active = true
         LIMIT 1;`,
        outletId,
        id
      );
      currentStock = Number(balanceRows[0]?.stock ?? 0);

      const countRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT count(*)::int as count 
         FROM "order_items" oi
         JOIN "orders" o ON o.id = oi.order_id
         JOIN "product_variants" pv ON pv.id = oi.product_variant_id
         WHERE pv.product_id = $1 AND o.outlet_id = $2;`,
        id,
        outletId
      );
      transactionCount = countRows[0]?.count ?? 0;
    } else {
      const countRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT count(*)::int as count 
         FROM "order_items" oi
         JOIN "product_variants" pv ON pv.id = oi.product_variant_id
         WHERE pv.product_id = $1;`,
        id
      );
      transactionCount = countRows[0]?.count ?? 0;
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

    let userTenantId = req.user?.tenantId || req.tenantId;
    if (!userTenantId) {
      const prodRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT tenant_id FROM "products" WHERE id = $1 LIMIT 1;`,
        id
      );
      userTenantId = prodRows[0]?.tenant_id;
    }

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

      // Target schema: Hapus record saldo dari inventory_balances untuk outlet ini
      await prisma.$queryRawUnsafe(
        `DELETE FROM "inventory_balances" ib
         USING "product_variants" pv, "storage_locations" sl
         WHERE pv.product_id = $1
           AND ib.inventory_item_id = pv.inventory_item_id
           AND ib.storage_location_id = sl.id
           AND sl.outlet_id = $2;`,
        id,
        outletId
      );

      return res.status(200).json({
        status: 'success',
        message: `Produk "${existing.name}" berhasil dilepas dari ${outlet?.name || 'cabang ini'}. Riwayat transaksi masa lalu tetap aman.`,
      });
    }

    // Jika tanpa outletId: Soft-delete global via Dual-Write
    await prisma.$transaction(async (tx) => {
      return await catalogDualWriteService.deleteProduct(id, {
        tx,
        tenantId: userTenantId!,
        actorUserId: req.user?.id,
      });
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
        const deletedBalances = await prisma.$queryRawUnsafe<any[]>(
          `DELETE FROM "inventory_balances" ib
           USING "product_variants" pv, "storage_locations" sl
           WHERE pv.product_id = ANY($1::text[])
             AND ib.inventory_item_id = pv.inventory_item_id
             AND ib.storage_location_id = sl.id
             AND sl.outlet_id = $2
           RETURNING ib.id;`,
          productIds,
          outletId
        );

        return res.status(200).json({
          status: 'success',
          message: `Berhasil melepas ${deletedBalances.length} produk dari cabang ini. Riwayat transaksi masa lalu tetap aman.`,
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

    const user = (req as any).user;
    const tenantId = user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({
        status: 'error',
        message: 'Konteks tenant tidak ditemukan',
      });
    }

    const searchFilter = (search && typeof search === 'string') ? search : null;
    const products = await prisma.$queryRawUnsafe<any[]>(
      `SELECT p.id, p.name, pv.barcode, pv.sku, pv.price as "basePrice", COALESCE(ii.average_cost, 0) as "costPrice",
              p.unit, p.image_url as "imageUrl", json_build_object('id', c.id, 'name', c.name) as category
       FROM "products" p
       JOIN "product_variants" pv ON pv.product_id = p.id AND pv.is_active = true
       LEFT JOIN "categories" c ON c.id = p.category_id
       LEFT JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id
       WHERE p.is_active = true
         AND p.tenant_id = $3
         AND NOT EXISTS (
           SELECT 1 FROM "outlet_products" op
           WHERE op.outlet_id = $1 AND op.product_id = p.id AND op.is_available = true
         )
         AND ($2::text IS NULL OR p.name ILIKE '%' || $2 || '%' OR pv.sku ILIKE '%' || $2 || '%' OR pv.barcode ILIKE '%' || $2 || '%')
       ORDER BY p.name ASC;`,
      outletId,
      searchFilter,
      tenantId
    );

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
    const userTenantId = req.user?.tenantId || (req as any).tenantId;

    const slRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, tenant_id FROM "storage_locations" WHERE outlet_id = $1 AND is_default = true LIMIT 1;`,
      outletId
    );
    const storageLocation = slRows[0];
    const tenantIdToUse = storageLocation ? storageLocation.tenant_id : userTenantId;

    for (const item of assignments) {
      // 1. Hubungkan produk ke outlet toko via outlet_products (EPIC-19)
      await prisma.outletProduct.upsert({
        where: {
          outletId_productId: {
            outletId,
            productId: item.productId,
          },
        },
        update: {
          isAvailable: true,
          priceOverride: item.customPrice || null,
        },
        create: {
          tenantId: tenantIdToUse,
          outletId,
          productId: item.productId,
          isAvailable: true,
          priceOverride: item.customPrice || null,
        },
      });

      // 2. Alokasikan saldo stok awal di storage location jika ada
      if (storageLocation) {
        const variantRows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id, inventory_item_id, tenant_id FROM "product_variants" WHERE product_id = $1 AND is_active = true LIMIT 1;`,
          item.productId
        );
        if (variantRows.length > 0 && variantRows[0].inventory_item_id) {
          const iiId = variantRows[0].inventory_item_id;
          const tenantId = variantRows[0].tenant_id;
          const balanceId = crypto.randomUUID();
          await prisma.$queryRawUnsafe(
            `INSERT INTO "inventory_balances" (
               id, tenant_id, inventory_item_id, storage_location_id, inventory_batch_id,
               quantity_on_hand, quantity_reserved, updated_at
             ) VALUES ($1, $2, $3, $4, null, $5, 0, CURRENT_TIMESTAMP)
             ON CONFLICT ("tenant_id", "inventory_item_id", "storage_location_id") WHERE "inventory_batch_id" IS NULL
             DO UPDATE SET "quantity_on_hand" = EXCLUDED."quantity_on_hand", "updated_at" = CURRENT_TIMESTAMP;`,
            balanceId,
            tenantId,
            iiId,
            storageLocation.id,
            item.initialStock || 0
          );
        }
      }
    }

    // Pastikan master product juga aktif ketika dihubungkan ke cabang
    await prisma.product.updateMany({
      where: { id: { in: assignments.map((a) => a.productId) } },
      data: { isActive: true },
    });

    return res.status(200).json({
      status: 'success',
      message: `Berhasil menambahkan ${assignments.length} produk ke cabang ini`,
    });
  } catch (error) {
    console.error('Error saat menghubungkan produk ke outlet:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghubungkan produk ke cabang',
    });
  }
};

const bulkImportItemSchema = z.object({
  name: z.string().min(1, 'Nama produk wajib diisi'),
  sku: z.string().min(1, 'SKU wajib diisi'),
  barcode: z.string().optional().nullable(),
  categoryName: z.string().optional().nullable(),
  costPrice: z.number().min(0).default(0),
  basePrice: z.number().min(0).default(0),
  unit: z.string().default('Pcs'),
  description: z.string().optional().nullable(),
  initialStock: z.number().min(0).default(0),
  minStockAlert: z.number().min(0).default(5),
});

const bulkImportProductsSchema = z.object({
  outletId: z.string().uuid().optional(),
  items: z.array(bulkImportItemSchema).min(1, 'Minimal 1 produk untuk diimpor'),
});

/**
 * Controller: Impor massal katalog produk dari spreadsheet / CSV
 * @route POST /api/products/bulk-import
 */
export const bulkImportProducts = async (req: Request, res: Response) => {
  try {
    const parseResult = bulkImportProductsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi data impor gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { items, outletId } = parseResult.data;
    let userTenantId = req.user?.tenantId || req.tenantId;

    if (!userTenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Silakan login kembali.' });
    }

    // Resolusi Outlet Cabang
    let targetOutletId = outletId || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = await prisma.outlet.findFirst({
        where: { tenantId: userTenantId },
        select: { id: true },
      });
      targetOutletId = defaultOutlet?.id;
    }

    if (!targetOutletId) {
      return res.status(400).json({ status: 'error', message: 'Outlet cabang tidak ditemukan untuk alokasi produk' });
    }

    // Cache kategori yang ada untuk tenant ini
    const existingCategories = await prisma.category.findMany({
      where: { tenantId: userTenantId },
    });
    const categoryMap = new Map<string, string>();
    for (const c of existingCategories) {
      categoryMap.set(c.name.trim().toLowerCase(), c.id);
    }

    // Default category jika kategori kosong
    let defaultCategoryId = categoryMap.get('umum') || categoryMap.get('general');
    if (!defaultCategoryId && existingCategories.length > 0) {
      defaultCategoryId = existingCategories[0].id;
    } else if (!defaultCategoryId) {
      const newGeneral = await prisma.category.create({
        data: {
          tenantId: userTenantId,
          name: 'Umum',
          slug: `umum-${userTenantId.slice(0, 6)}`,
        },
      });
      defaultCategoryId = newGeneral.id;
      categoryMap.set('umum', defaultCategoryId);
    }

    let createdCount = 0;
    let updatedCount = 0;
    const errors: Array<{ sku: string; name: string; error: string }> = [];

    // Proses setiap item secara sekuensial
    for (const item of items) {
      try {
        const skuTrimmed = item.sku.trim();
        const nameTrimmed = item.name.trim();
        const barcodeTrimmed = (item.barcode && item.barcode.trim()) || skuTrimmed;

        // Resolusi Kategori
        let categoryId = defaultCategoryId!;
        if (item.categoryName && item.categoryName.trim()) {
          const catNameClean = item.categoryName.trim();
          const catNameLower = catNameClean.toLowerCase();
          if (categoryMap.has(catNameLower)) {
            categoryId = categoryMap.get(catNameLower)!;
          } else {
            const catSlug = catNameLower.replace(/[^a-z0-9]+/g, '-') || 'kategori';
            const createdCat = await prisma.category.create({
              data: {
                tenantId: userTenantId,
                name: catNameClean,
                slug: `${catSlug}-${userTenantId.slice(0, 6)}`,
              },
            });
            categoryId = createdCat.id;
            categoryMap.set(catNameLower, categoryId);
          }
        }

        // Cek apakah produk dengan SKU ini sudah ada
        const existingProduct = await prisma.product.findFirst({
          where: {
            tenantId: userTenantId,
            sku: skuTrimmed,
          },
          include: {
            variants: true,
          },
        });

        if (existingProduct) {
          // Update data produk, varian, dan inventory item yang sudah ada
          await prisma.$transaction(async (tx) => {
            await tx.product.update({
              where: { id: existingProduct.id },
              data: {
                name: nameTrimmed,
                categoryId,
                unit: item.unit || 'Pcs',
                description: item.description || existingProduct.description,
                isActive: true,
              },
            });

            if (existingProduct.variants && existingProduct.variants.length > 0) {
              const primaryVariant = existingProduct.variants[0];
              await tx.productVariant.update({
                where: { id: primaryVariant.id },
                data: {
                  name: nameTrimmed,
                  barcode: barcodeTrimmed,
                  price: item.basePrice,
                  isActive: true,
                },
              });

              if (primaryVariant.inventoryItemId) {
                await tx.inventoryItem.update({
                  where: { id: primaryVariant.inventoryItemId },
                  data: {
                    name: nameTrimmed,
                    averageCost: item.costPrice,
                    reorderPoint: item.minStockAlert,
                  },
                });
              }
            }

            // Pastikan produk teralokasi ke outlet
            await tx.outletProduct.upsert({
              where: {
                outletId_productId: {
                  outletId: targetOutletId!,
                  productId: existingProduct.id,
                },
              },
              update: { isAvailable: true },
              create: {
                tenantId: userTenantId,
                outletId: targetOutletId!,
                productId: existingProduct.id,
                isAvailable: true,
              },
            });
          });
          updatedCount++;
        } else {
          // Cek apakah barcode bentrok dengan varian produk lain
          const barcodeConflict = await prisma.productVariant.findFirst({
            where: {
              tenantId: userTenantId,
              barcode: barcodeTrimmed,
            },
          });

          const finalBarcode = barcodeConflict ? `${skuTrimmed}-${Date.now().toString().slice(-4)}` : barcodeTrimmed;

          // Buat produk baru via dual-write service
          await prisma.$transaction(async (tx) => {
            const dwResult = await catalogDualWriteService.createProduct(
              {
                name: nameTrimmed,
                sku: skuTrimmed,
                barcode: finalBarcode,
                categoryId,
                costPrice: item.costPrice,
                basePrice: item.basePrice,
                unit: item.unit || 'Pcs',
                description: item.description || null,
                initialStock: item.initialStock,
                minStockAlert: item.minStockAlert,
                outletId: targetOutletId!,
              },
              { tx, tenantId: userTenantId, actorUserId: req.user?.id }
            );

            // Alokasikan ke outlet
            await tx.outletProduct.upsert({
              where: {
                outletId_productId: {
                  outletId: targetOutletId!,
                  productId: dwResult.legacyData.id,
                },
              },
              update: { isAvailable: true },
              create: {
                tenantId: userTenantId,
                outletId: targetOutletId!,
                productId: dwResult.legacyData.id,
                isAvailable: true,
              },
            });
          });
          createdCount++;
        }
      } catch (err: any) {
        console.error(`Gagal mengimpor item SKU ${item.sku}:`, err);
        errors.push({
          sku: item.sku,
          name: item.name,
          error: err.message || 'Gagal menyimpan ke database',
        });
      }
    }

    return res.status(200).json({
      status: 'success',
      message: `Impor produk selesai: ${createdCount} baru dibuat, ${updatedCount} diperbarui${errors.length > 0 ? `, ${errors.length} gagal` : ''}`,
      data: {
        total: items.length,
        created: createdCount,
        updated: updatedCount,
        failed: errors.length,
        errors,
      },
    });
  } catch (error: any) {
    console.error('Error saat bulk import products:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan sistem saat memproses impor produk massal',
    });
  }
};
