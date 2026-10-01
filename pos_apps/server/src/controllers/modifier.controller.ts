import { Request, Response } from 'express';
import { z } from 'zod';
import { SelectionType } from '@prisma/client';
import { prisma } from '../config/prisma';

// Skema Validasi Input Modifier Item
const modifierItemInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Nama pilihan modifier wajib diisi'),
  priceAdjustment: z.number().min(0).default(0),
  isDefault: z.boolean().default(false),
  inventoryEffect: z
    .object({
      inventoryItemId: z.string().uuid(),
      quantityDelta: z.number(), // positif = takaran pemotongan stok bahan baku
    })
    .optional()
    .nullable(),
});

// Skema Validasi Grup Modifier
const upsertModifierGroupSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Nama grup modifier wajib diisi'),
  selectionType: z.enum(['SINGLE', 'MULTIPLE']).default('SINGLE'),
  minSelection: z.number().int().min(0).default(0),
  maxSelection: z.number().int().min(1).default(1),
  isRequired: z.boolean().default(false),
  items: z.array(modifierItemInputSchema).min(1, 'Minimal harus ada 1 opsi pilihan modifier'),
});

// Skema Hubungkan Modifier ke Produk
const linkProductModifierSchema = z.object({
  productId: z.string().uuid('ID produk tidak valid'),
  modifierGroupIds: z.array(z.string().uuid()).default([]),
});

/**
 * Mengambil daftar grup modifier per tenant
 * @route GET /api/modifiers
 */
export const getModifierGroups = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Konteks tenant tidak ditemukan' });
    }

    const groups = await prisma.modifierGroup.findMany({
      where: { tenantId },
      include: {
        items: {
          include: {
            recipeEffects: {
              include: {
                inventoryItem: {
                  select: {
                    id: true,
                    name: true,
                    canonicalUom: true,
                  },
                },
              },
            },
          },
        },
        products: {
          include: {
            product: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      status: 'success',
      data: groups,
    });
  } catch (error: any) {
    console.error('Error saat mengambil grup modifier:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat grup modifier' });
  }
};

/**
 * Membuat atau memperbarui grup modifier beserta opsi-opsinya
 * @route POST /api/modifiers
 */
export const upsertModifierGroup = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Konteks tenant tidak ditemukan' });
    }

    const parseResult = upsertModifierGroupSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi data modifier gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { id, name, selectionType, minSelection, maxSelection, isRequired, items } = parseResult.data;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Upsert ModifierGroup induk
      let group;
      if (id) {
        group = await tx.modifierGroup.update({
          where: { id },
          data: {
            name,
            selectionType: selectionType as SelectionType,
            minSelection,
            maxSelection,
            isRequired,
          },
        });
      } else {
        group = await tx.modifierGroup.create({
          data: {
            tenantId,
            name,
            selectionType: selectionType as SelectionType,
            minSelection,
            maxSelection,
            isRequired,
          },
        });
      }

      // 2. Sinkronisasi ModifierItems
      // Ambil ID item yang sudah ada dalam request
      const incomingItemIds = items.filter((i) => i.id).map((i) => i.id as string);

      // Hapus item lama yang tidak lagi ada di request
      await tx.modifierItem.deleteMany({
        where: {
          modifierGroupId: group.id,
          id: { notIn: incomingItemIds },
        },
      });

      // Proses setiap item (update jika ada ID, create jika baru)
      for (const item of items) {
        let modifierItem;
        if (item.id) {
          modifierItem = await tx.modifierItem.update({
            where: { id: item.id },
            data: {
              name: item.name,
              priceAdjustment: item.priceAdjustment,
              isDefault: item.isDefault,
            },
          });
        } else {
          modifierItem = await tx.modifierItem.create({
            data: {
              tenantId,
              modifierGroupId: group.id,
              name: item.name,
              priceAdjustment: item.priceAdjustment,
              isDefault: item.isDefault,
            },
          });
        }

        // Kelola efek bahan baku persediaan (ModifierRecipeEffect)
        if (item.inventoryEffect && item.inventoryEffect.inventoryItemId && Number(item.inventoryEffect.quantityDelta) > 0) {
          await tx.modifierRecipeEffect.deleteMany({
            where: { modifierItemId: modifierItem.id },
          });
          await tx.modifierRecipeEffect.create({
            data: {
              tenantId,
              modifierItemId: modifierItem.id,
              inventoryItemId: item.inventoryEffect.inventoryItemId,
              quantityDelta: item.inventoryEffect.quantityDelta,
            },
          });
        } else {
          await tx.modifierRecipeEffect.deleteMany({
            where: { modifierItemId: modifierItem.id },
          });
        }
      }

      return await tx.modifierGroup.findUnique({
        where: { id: group.id },
        include: {
          items: {
            include: {
              recipeEffects: {
                include: {
                  inventoryItem: { select: { id: true, name: true, canonicalUom: true } },
                },
              },
            },
          },
        },
      });
    });

    return res.status(201).json({
      status: 'success',
      message: 'Grup modifier berhasil disimpan',
      data: result,
    });
  } catch (error: any) {
    console.error('Error saat menyimpan grup modifier:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menyimpan grup modifier' });
  }
};

/**
 * Menghubungkan satu atau lebih grup modifier ke produk
 * @route POST /api/modifiers/link-product
 */
export const linkProductModifiers = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Konteks tenant tidak ditemukan' });
    }

    const parseResult = linkProductModifierSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi link produk gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { productId, modifierGroupIds } = parseResult.data;

    // Pastikan produk milik tenant
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) {
      return res.status(404).json({ status: 'error', message: 'Produk tidak ditemukan' });
    }

    await prisma.$transaction(async (tx) => {
      // Hapus link lama
      await tx.productModifierGroup.deleteMany({
        where: { productId },
      });

      // Buat link baru jika ada grup modifier terpilih
      if (modifierGroupIds.length > 0) {
        await tx.productModifierGroup.createMany({
          data: modifierGroupIds.map((groupId, idx) => ({
            tenantId,
            productId,
            modifierGroupId: groupId,
            sortOrder: idx,
          })),
        });
      }
    });

    return res.status(200).json({
      status: 'success',
      message: 'Modifier berhasil dihubungkan ke produk',
    });
  } catch (error: any) {
    console.error('Error saat menghubungkan modifier ke produk:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menghubungkan modifier ke produk' });
  }
};

/**
 * Menghapus grup modifier
 * @route DELETE /api/modifiers/:id
 */
export const deleteModifierGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Konteks tenant tidak ditemukan' });
    }

    const group = await prisma.modifierGroup.findFirst({
      where: { id, tenantId },
    });

    if (!group) {
      return res.status(404).json({ status: 'error', message: 'Grup modifier tidak ditemukan' });
    }

    await prisma.$transaction(async (tx) => {
      // Cascade delete handles items, product links, and recipe effects
      await tx.productModifierGroup.deleteMany({ where: { modifierGroupId: id } });
      await tx.modifierGroup.delete({ where: { id } });
    });

    return res.status(200).json({
      status: 'success',
      message: 'Grup modifier berhasil dihapus',
    });
  } catch (error: any) {
    console.error('Error saat menghapus grup modifier:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menghapus grup modifier' });
  }
};
