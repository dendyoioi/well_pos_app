import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';

// Skema Validasi Input Resep
const recipeItemSchema = z.object({
  inventoryItemId: z.string().uuid('ID bahan baku tidak valid'),
  quantity: z.number().positive('Jumlah bahan baku harus positif'),
  costRatio: z.number().min(0).max(1).optional().default(1.0),
});

const upsertRecipeSchema = z.object({
  productVariantId: z.string().uuid('ID varian produk tidak valid'),
  instructions: z.string().optional().nullable(),
  yieldQuantity: z.number().positive('Yield quantity harus positif').optional().default(1.0),
  items: z.array(recipeItemSchema).min(1, 'Resep minimal harus memiliki 1 bahan baku'),
});

/**
 * Mengambil daftar resep F&B per tenant
 * @route GET /api/recipes
 */
export const getRecipes = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenantId;
    const outletId = (req.query.outletId as string) || undefined;

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Konteks tenant tidak ditemukan' });
    }

    const whereClause: any = { tenantId };
    if (outletId) {
      whereClause.productVariant = {
        product: {
          outletProducts: {
            some: {
              outletId,
              isAvailable: true,
            },
          },
        },
      };
    }

    const recipes = await prisma.recipe.findMany({
      where: whereClause,
      include: {
        productVariant: {
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            product: {
              select: {
                id: true,
                name: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
        items: {
          include: {
            inventoryItem: {
              select: {
                id: true,
                itemCode: true,
                name: true,
                canonicalUom: true,
                averageCost: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      status: 'success',
      data: recipes,
    });
  } catch (error: any) {
    console.error('Error saat mengambil daftar resep:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat daftar resep' });
  }
};

/**
 * Mengambil detail resep berdasarkan ID varian produk
 * @route GET /api/recipes/variant/:variantId
 */
export const getRecipeByVariantId = async (req: Request, res: Response) => {
  try {
    const { variantId } = req.params;
    const user = (req as any).user;
    const tenantId = user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Konteks tenant tidak ditemukan' });
    }

    const recipe = await prisma.recipe.findFirst({
      where: {
        tenantId,
        productVariantId: variantId,
      },
      include: {
        productVariant: {
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            product: { select: { id: true, name: true } },
          },
        },
        items: {
          include: {
            inventoryItem: {
              select: {
                id: true,
                itemCode: true,
                name: true,
                canonicalUom: true,
                averageCost: true,
              },
            },
          },
        },
      },
    });

    if (!recipe) {
      return res.status(404).json({
        status: 'error',
        message: 'Resep untuk varian produk ini belum dikonfigurasi',
      });
    }

    // Hitung estimasi HPP resep dari bahan baku
    const calculatedCogs = recipe.items.reduce((total, item) => {
      const avgCost = Number(item.inventoryItem.averageCost || 0);
      return total + avgCost * Number(item.quantity);
    }, 0);

    return res.status(200).json({
      status: 'success',
      data: {
        ...recipe,
        estimatedCogs: calculatedCogs,
      },
    });
  } catch (error: any) {
    console.error('Error saat mengambil resep varian:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat resep varian' });
  }
};

/**
 * Membuat atau memperbarui resep untuk varian produk (BOM)
 * @route POST /api/recipes
 */
export const upsertRecipe = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Konteks tenant tidak ditemukan' });
    }

    const parseResult = upsertRecipeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi data resep gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { productVariantId, instructions, yieldQuantity, items } = parseResult.data;

    // Pastikan varian produk ada dan milik tenant
    const variant = await prisma.productVariant.findFirst({
      where: { id: productVariantId, tenantId },
    });
    if (!variant) {
      return res.status(404).json({
        status: 'error',
        message: 'Varian produk tidak ditemukan atau berada di luar tenant',
      });
    }

    // Pastikan seluruh inventory items ada dan milik tenant
    const itemIds = items.map((i) => i.inventoryItemId);
    const existingInventoryItems = await prisma.inventoryItem.findMany({
      where: { id: { in: itemIds }, tenantId },
      select: { id: true, name: true },
    });

    if (existingInventoryItems.length !== itemIds.length) {
      return res.status(400).json({
        status: 'error',
        message: 'Satu atau lebih bahan baku tidak valid atau tidak ditemukan dalam tenant',
      });
    }

    // Eksekusi upsert atomik
    const result = await prisma.$transaction(async (tx) => {
      // 1. Cek atau buat Recipe induk
      const recipe = await tx.recipe.upsert({
        where: { productVariantId },
        create: {
          tenantId,
          productVariantId,
          instructions: instructions || null,
          yieldQuantity,
        },
        update: {
          instructions: instructions || null,
          yieldQuantity,
        },
      });

      // 2. Refresh daftar item resep: hapus item lama, insert item baru
      await tx.recipeItem.deleteMany({
        where: { recipeId: recipe.id },
      });

      await tx.recipeItem.createMany({
        data: items.map((item) => ({
          tenantId,
          recipeId: recipe.id,
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
          costRatio: item.costRatio,
        })),
      });

      // 3. Ambil resep lengkap setelah disimpan
      return await tx.recipe.findUnique({
        where: { id: recipe.id },
        include: {
          items: {
            include: {
              inventoryItem: {
                select: {
                  id: true,
                  name: true,
                  canonicalUom: true,
                  averageCost: true,
                },
              },
            },
          },
        },
      });
    });

    return res.status(201).json({
      status: 'success',
      message: 'Resep bahan baku berhasil disimpan',
      data: result,
    });
  } catch (error: any) {
    console.error('Error saat menyimpan resep:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menyimpan resep' });
  }
};

/**
 * Menghapus resep varian produk
 * @route DELETE /api/recipes/:id
 */
export const deleteRecipe = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Konteks tenant tidak ditemukan' });
    }

    const recipe = await prisma.recipe.findFirst({
      where: { id, tenantId },
    });

    if (!recipe) {
      return res.status(404).json({ status: 'error', message: 'Resep tidak ditemukan' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.recipeItem.deleteMany({ where: { recipeId: id } });
      await tx.recipe.delete({ where: { id } });
    });

    return res.status(200).json({
      status: 'success',
      message: 'Resep berhasil dihapus',
    });
  } catch (error: any) {
    console.error('Error saat menghapus resep:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menghapus resep' });
  }
};

/**
 * Mengambil daftar bahan baku mentah (inventory items) untuk pilihan racikan resep
 * @route GET /api/recipes/inventory-items
 */
export const getInventoryItemsForRecipe = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Konteks tenant tidak ditemukan' });
    }

    let items = await prisma.inventoryItem.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        itemCode: true,
        name: true,
        canonicalUom: true,
        averageCost: true,
        reorderPoint: true,
      },
      orderBy: { name: 'asc' },
    });

    const outletId = (req.query.outletId as string) || undefined;
    const scope = (req.query.scope as string) || 'outlet'; // 'outlet' | 'all'
    const balancesMap = new Map<string, number>();
    const warehouseBalancesMap = new Map<string, number>();

    let outletInfo: { id: string; name: string; isWarehouse: boolean; warehouseId: string | null } | null = null;
    let warehouseInfo: { id: string; name: string } | null = null;

    if (outletId) {
      const outlet = await prisma.outlet.findFirst({
        where: { id: outletId, tenantId },
        select: { id: true, name: true, isWarehouse: true, warehouseId: true },
      });

      if (outlet) {
        outletInfo = {
          id: outlet.id,
          name: outlet.name,
          isWarehouse: !!outlet.isWarehouse,
          warehouseId: outlet.warehouseId,
        };

        // 1. Ambil saldo stok di outlet toko
        const storageLocation = await prisma.storageLocation.findFirst({
          where: { tenantId, outletId, isActive: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          select: { id: true },
        });

        if (storageLocation) {
          const balances = await prisma.inventoryBalance.findMany({
            where: {
              tenantId,
              storageLocationId: storageLocation.id,
              inventoryItemId: { in: items.map((it) => it.id) },
            },
            select: { inventoryItemId: true, quantityOnHand: true },
          });

          balances.forEach((b) => {
            balancesMap.set(b.inventoryItemId, Number(b.quantityOnHand || 0));
          });
        }

        // 2. Jika toko memiliki Gudang Sumber Pasokan (warehouseId), ambil stok gudang pusat
        if (outlet.warehouseId) {
          const wh = await prisma.outlet.findFirst({
            where: { id: outlet.warehouseId, tenantId, isActive: true },
            select: {
              id: true,
              name: true,
              storageLocations: {
                where: { isActive: true },
                orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
                take: 1,
                select: { id: true },
              },
            },
          });

          if (wh) {
            warehouseInfo = { id: wh.id, name: wh.name };
            const whLocationId = wh.storageLocations[0]?.id;
            if (whLocationId) {
              const whBalances = await prisma.inventoryBalance.findMany({
                where: {
                  tenantId,
                  storageLocationId: whLocationId,
                  inventoryItemId: { in: items.map((it) => it.id) },
                },
                select: { inventoryItemId: true, quantityOnHand: true },
              });

              whBalances.forEach((b) => {
                warehouseBalancesMap.set(b.inventoryItemId, Number(b.quantityOnHand || 0));
              });
            }
          }
        }

        // 3. Jika scope === 'outlet' dan bukan gudang, filter hanya bahan baku yang relevan untuk toko
        if (scope !== 'all' && !outlet.isWarehouse) {
          // Cari bahan baku dari resep menu yang aktif dialokasikan di toko ini
          const outletRecipeItems = await prisma.recipeItem.findMany({
            where: {
              tenantId,
              recipe: {
                productVariant: {
                  product: {
                    outletProducts: {
                      some: {
                        outletId,
                        isAvailable: true,
                      },
                    },
                  },
                },
              },
            },
            select: { inventoryItemId: true },
          });

          const relevantItemIds = new Set<string>();
          outletRecipeItems.forEach((ri) => relevantItemIds.add(ri.inventoryItemId));

          // Tambahkan bahan baku yang memiliki saldo stok fisik di toko
          balancesMap.forEach((qty, itemId) => {
            if (qty > 0) relevantItemIds.add(itemId);
          });

          // Saring item hanya yang relevan dengan outlet ini
          items = items.filter((it) => relevantItemIds.has(it.id));
        }
      }
    }

    return res.status(200).json({
      status: 'success',
      data: items.map((it) => ({
        id: it.id,
        itemCode: it.itemCode,
        name: it.name,
        canonicalUom: it.canonicalUom,
        averageCost: Number(it.averageCost || 0),
        reorderPoint: Number((it as any).reorderPoint || 0),
        stock: balancesMap.get(it.id) ?? 0,
        warehouseStock: warehouseBalancesMap.get(it.id) ?? 0,
        warehouseId: outletInfo?.warehouseId ?? null,
        warehouseName: warehouseInfo?.name ?? null,
        supplySource: outletInfo?.warehouseId ? 'WAREHOUSE' : 'OUTLET_LOCAL',
      })),
      meta: {
        outlet: outletInfo,
        warehouse: warehouseInfo,
        totalItems: items.length,
      },
    });
  } catch (error: any) {
    console.error('Error saat mengambil bahan baku resep:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat bahan baku resep' });
  }
};

const createInventoryItemSchema = z.object({
  name: z.string().min(2, 'Nama bahan baku minimal 2 karakter'),
  itemCode: z.string().optional(),
  canonicalUom: z.string().min(1, 'Satuan ukur wajib diisi'),
  averageCost: z.number().min(0).default(0),
  reorderPoint: z.number().min(0).default(0),
  initialStock: z.number().min(0).default(0),
  outletId: z.string().uuid().optional(),
});

/**
 * Mendaftarkan master bahan baku baru untuk tenant
 * @route POST /api/recipes/inventory-items
 */
export const createInventoryItem = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Konteks tenant tidak ditemukan' });
    }

    const parseResult = createInventoryItemSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { name, canonicalUom, averageCost, reorderPoint, initialStock, outletId } = parseResult.data;

    let itemCode = parseResult.data.itemCode?.trim();
    if (!itemCode) {
      const count = await prisma.inventoryItem.count({ where: { tenantId } });
      itemCode = `RAW-${String(count + 1).padStart(3, '0')}`;
    }

    const newItem = await prisma.inventoryItem.create({
      data: {
        tenantId,
        itemCode,
        name,
        canonicalUom: canonicalUom.toUpperCase(),
        averageCost,
        reorderPoint,
        isActive: true,
      },
    });

    if (initialStock > 0 && outletId) {
      let loc = await prisma.storageLocation.findFirst({
        where: { tenantId, outletId, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });

      if (!loc) {
        loc = await prisma.storageLocation.create({
          data: {
            tenantId,
            outletId,
            name: 'Gudang Utama & Dapur',
            isDefault: true,
          },
        });
      }

      await prisma.inventoryBalance.create({
        data: {
          tenantId,
          inventoryItemId: newItem.id,
          storageLocationId: loc.id,
          quantityOnHand: initialStock,
          quantityReserved: 0,
        },
      });

      await prisma.inventoryLedger.create({
        data: {
          tenantId,
          inventoryItemId: newItem.id,
          storageLocationId: loc.id,
          quantityDelta: initialStock,
          balanceBefore: 0,
          balanceAfter: initialStock,
          unitCost: averageCost,
          movementType: 'PURCHASE',
          referenceType: 'MANUAL',
          referenceId: newItem.id,
          actorType: 'USER',
          actorUserId: user.id || null,
          notes: 'Saldo awal pendaftaran bahan baku baru',
        },
      });
    }

    return res.status(201).json({
      status: 'success',
      data: {
        id: newItem.id,
        itemCode: newItem.itemCode,
        name: newItem.name,
        canonicalUom: newItem.canonicalUom,
        averageCost: Number(newItem.averageCost),
        reorderPoint: Number(newItem.reorderPoint),
        stock: initialStock,
      },
      message: 'Bahan baku berhasil didaftarkan',
    });
  } catch (error: any) {
    console.error('Error saat membuat master bahan baku:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal mendaftarkan bahan baku' });
  }
};
