import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';

// =========================================================================
// ZOD SCHEMAS
// =========================================================================

const bundleItemInputSchema = z.object({
  childProductId: z.string().uuid('ID produk anak tidak valid'),
  childVariantId: z.string().uuid('ID varian anak tidak valid').optional().nullable(),
  quantity: z.number().positive('Jumlah produk anak harus lebih dari 0').default(1),
  costAllocationPercent: z.number().min(0).max(100).optional().nullable(),
});

const updateBundleItemsSchema = z.object({
  bundleItems: z.array(bundleItemInputSchema),
});

const priceTierInputSchema = z.object({
  variantId: z.string().uuid('ID varian tidak valid').optional().nullable(),
  minQuantity: z.number().int().min(2, 'Minimal kuantitas grosir harus minimal 2 unit'),
  tierPrice: z.number().min(0, 'Harga grosir tidak boleh negatif'),
});

const updatePriceTiersSchema = z.object({
  priceTiers: z.array(priceTierInputSchema),
});

/**
 * Helper: Ekstrak tenantId dari request secara aman
 */
const getTenantId = (req: Request): string | undefined => {
  return (req as any).tenantId || req.user?.tenantId || (req.headers['x-tenant-id'] as string);
};

// =========================================================================
// 1. PRODUCT BUNDLE ITEMS (PAKET KOMPOSIT)
// =========================================================================

/**
 * Controller: Mengambil daftar item penyusun paket komposit (bundle items)
 * @route GET /api/products/:id/bundle-items
 */
export const getBundleItems = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak valid' });
    }

    const product = await prisma.product.findFirst({
      where: { id, tenantId },
      select: { id: true, name: true, type: true, sku: true, unit: true },
    });

    if (!product) {
      return res.status(404).json({ status: 'error', message: 'Produk paket tidak ditemukan' });
    }

    const bundleItems = await prisma.productBundleItem.findMany({
      where: { bundleProductId: id, tenantId },
      include: {
        childProduct: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
            imageUrl: true,
            type: true,
          },
        },
        childVariant: {
          select: {
            id: true,
            name: true,
            sku: true,
            barcode: true,
            price: true,
            inventoryItem: {
              select: {
                averageCost: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formatted = bundleItems.map((bi) => ({
      id: bi.id,
      childProductId: bi.childProductId,
      childVariantId: bi.childVariantId,
      childProductName: bi.childProduct.name,
      childProductType: bi.childProduct.type,
      childUnit: bi.childProduct.unit || 'Pcs',
      childImageUrl: bi.childProduct.imageUrl,
      childVariantName: bi.childVariant?.name || 'Default',
      childSku: bi.childVariant?.sku || bi.childProduct.sku,
      childBarcode: bi.childVariant?.barcode || null,
      childBasePrice: bi.childVariant ? Number(bi.childVariant.price) : 0,
      childAverageCost: bi.childVariant?.inventoryItem?.averageCost ? Number(bi.childVariant.inventoryItem.averageCost) : 0,
      quantity: Number(bi.quantity),
      costAllocationPercent: bi.costAllocationPercent ? Number(bi.costAllocationPercent) : null,
    }));

    // Hitung total estimasi HPP komposit dari akumulasi produk anak
    const estimatedHpp = formatted.reduce((acc, curr) => acc + (curr.childAverageCost * curr.quantity), 0);

    return res.status(200).json({
      status: 'success',
      data: {
        productId: product.id,
        productName: product.name,
        productType: product.type,
        estimatedHpp,
        bundleItems: formatted,
      },
    });
  } catch (error: any) {
    console.error('[getBundleItems] Error:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal memuat item paket' });
  }
};

/**
 * Controller: Memperbarui daftar item penyusun paket komposit (atomic replace)
 * @route PUT /api/products/:id/bundle-items
 */
export const updateBundleItems = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak valid' });
    }

    const parsed = updateBundleItemsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        status: 'error',
        message: parsed.error.issues[0]?.message || 'Format data item paket tidak valid',
      });
    }

    const { bundleItems } = parsed.data;

    // 1. Validasi produk induk
    const parentProduct = await prisma.product.findFirst({
      where: { id, tenantId },
      select: { id: true, name: true, type: true },
    });

    if (!parentProduct) {
      return res.status(404).json({ status: 'error', message: 'Produk induk tidak ditemukan' });
    }

    // 2. Validasi Anti-Circular & Integritas Produk Anak
    for (const item of bundleItems) {
      // Tidak boleh mereferensikan dirinya sendiri
      if (item.childProductId === id) {
        return res.status(400).json({
          status: 'error',
          message: 'Paket komposit tidak boleh membundel dirinya sendiri (self-reference)',
        });
      }

      // Validasi produk anak ada dan milik tenant yang sama
      const child = await prisma.product.findFirst({
        where: { id: item.childProductId, tenantId },
        select: { id: true, name: true, type: true },
      });

      if (!child) {
        return res.status(404).json({
          status: 'error',
          message: `Produk anak dengan ID ${item.childProductId} tidak ditemukan di toko Anda`,
        });
      }

      // Anti-Circular: Anak dilarang berupa COMPOSITE (Paket di dalam paket dilarang demi integritas stok)
      if (child.type === 'COMPOSITE') {
        return res.status(400).json({
          status: 'error',
          message: `Produk "${child.name}" adalah paket komposit. Paket komposit dilarang membundel paket komposit lain untuk mencegah loop stok berantai.`,
        });
      }

      // Jika ada variantId, pastikan varian milik produk anak tersebut
      if (item.childVariantId) {
        const v = await prisma.productVariant.findFirst({
          where: { id: item.childVariantId, productId: item.childProductId, tenantId },
          select: { id: true },
        });
        if (!v) {
          return res.status(400).json({
            status: 'error',
            message: `Varian ID ${item.childVariantId} tidak cocok dengan produk "${child.name}"`,
          });
        }
      }
    }

    // 3. Simpan perubahan secara atomik
    await prisma.$transaction(async (tx) => {
      // A. Jika produk memiliki bundle items, pastikan type produk diubah ke 'COMPOSITE'
      if (bundleItems.length > 0 && parentProduct.type !== 'COMPOSITE') {
        await tx.product.update({
          where: { id },
          data: { type: 'COMPOSITE' },
        });
      } else if (bundleItems.length === 0 && parentProduct.type === 'COMPOSITE') {
        // Jika bundle items dikosongkan, kembalikan ke STANDARD
        await tx.product.update({
          where: { id },
          data: { type: 'STANDARD' },
        });
      }

      // B. Hapus item bundle eksisting
      await tx.productBundleItem.deleteMany({
        where: { bundleProductId: id, tenantId },
      });

      // C. Buat entri bundle item baru
      if (bundleItems.length > 0) {
        await tx.productBundleItem.createMany({
          data: bundleItems.map((bi) => ({
            tenantId,
            bundleProductId: id,
            bundleVariantId: null,
            childProductId: bi.childProductId,
            childVariantId: bi.childVariantId || null,
            quantity: bi.quantity,
            costAllocationPercent: bi.costAllocationPercent || null,
          })),
        });
      }
    });

    return res.status(200).json({
      status: 'success',
      message: `Komposisi isi paket "${parentProduct.name}" berhasil disimpan (${bundleItems.length} komponen)`,
    });
  } catch (error: any) {
    console.error('[updateBundleItems] Error:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal menyimpan item paket' });
  }
};

// =========================================================================
// 2. PRODUCT PRICE TIERS (HARGA GROSIR BERTINGKAT)
// =========================================================================

/**
 * Controller: Mengambil daftar struktur harga grosir bertingkat (price tiers)
 * @route GET /api/products/:id/price-tiers
 */
export const getPriceTiers = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak valid' });
    }

    const product = await prisma.product.findFirst({
      where: { id, tenantId },
      select: { id: true, name: true, sku: true },
    });

    if (!product) {
      return res.status(404).json({ status: 'error', message: 'Produk tidak ditemukan' });
    }

    const priceTiers = await prisma.productPriceTier.findMany({
      where: { productId: id, tenantId },
      include: {
        variant: {
          select: { id: true, name: true, sku: true, price: true },
        },
      },
      orderBy: { minQuantity: 'asc' },
    });

    const formatted = priceTiers.map((pt) => ({
      id: pt.id,
      variantId: pt.variantId,
      variantName: pt.variant?.name || 'Semua Varian',
      minQuantity: pt.minQuantity,
      tierPrice: Number(pt.tierPrice),
      basePrice: pt.variant ? Number(pt.variant.price) : null,
    }));

    return res.status(200).json({
      status: 'success',
      data: {
        productId: product.id,
        productName: product.name,
        priceTiers: formatted,
      },
    });
  } catch (error: any) {
    console.error('[getPriceTiers] Error:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal memuat harga grosir' });
  }
};

/**
 * Controller: Memperbarui daftar harga grosir bertingkat (atomic replace)
 * @route PUT /api/products/:id/price-tiers
 */
export const updatePriceTiers = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak valid' });
    }

    const parsed = updatePriceTiersSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        status: 'error',
        message: parsed.error.issues[0]?.message || 'Format data harga grosir tidak valid',
      });
    }

    const { priceTiers } = parsed.data;

    // 1. Validasi produk
    const product = await prisma.product.findFirst({
      where: { id, tenantId },
      select: { id: true, name: true },
    });

    if (!product) {
      return res.status(404).json({ status: 'error', message: 'Produk tidak ditemukan' });
    }

    // 2. Validasi unik minQuantity per variant
    const seenCombos = new Set<string>();
    for (const pt of priceTiers) {
      const key = `${pt.variantId || 'null'}:${pt.minQuantity}`;
      if (seenCombos.has(key)) {
        return res.status(400).json({
          status: 'error',
          message: `Duplikasi kuantitas minimum ${pt.minQuantity} untuk varian yang sama`,
        });
      }
      seenCombos.add(key);

      if (pt.variantId) {
        const v = await prisma.productVariant.findFirst({
          where: { id: pt.variantId, productId: id, tenantId },
          select: { id: true },
        });
        if (!v) {
          return res.status(400).json({
            status: 'error',
            message: `Varian ID ${pt.variantId} tidak ditemukan pada produk ini`,
          });
        }
      }
    }

    // 3. Simpan perubahan secara atomik
    await prisma.$transaction(async (tx) => {
      await tx.productPriceTier.deleteMany({
        where: { productId: id, tenantId },
      });

      if (priceTiers.length > 0) {
        await tx.productPriceTier.createMany({
          data: priceTiers.map((pt) => ({
            tenantId,
            productId: id,
            variantId: pt.variantId || null,
            minQuantity: pt.minQuantity,
            tierPrice: pt.tierPrice,
          })),
        });
      }
    });

    return res.status(200).json({
      status: 'success',
      message: `Skema harga grosir produk "${product.name}" berhasil disimpan (${priceTiers.length} tingkat kuantitas)`,
    });
  } catch (error: any) {
    console.error('[updatePriceTiers] Error:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal menyimpan harga grosir' });
  }
};

