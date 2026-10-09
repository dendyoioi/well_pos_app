import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { StockMovementType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { inventoryDualWriteService } from '../services/dual_write';
import { inventoryReadAdapter, isReadFromTargetEnabled } from '../services/read_adapters';

const stockChangeSchema = z
  .object({
    productId: z.string().uuid('ID Produk tidak valid').optional(),
    inventoryItemId: z.string().uuid('ID Bahan Baku tidak valid').optional(),
    quantity: z.number().int().positive('Jumlah harus berupa angka bulat positif'),
    notes: z.string().optional(),
    outletId: z.string().uuid().optional(),
    poNumber: z.string().optional(),
    supplierName: z.string().optional(),
    newCostPrice: z.number().min(0).optional(),
  })
  .refine((data) => data.productId || data.inventoryItemId, {
    message: 'Wajib menyertakan productId atau inventoryItemId',
  });

const stockAdjustmentSchema = z
  .object({
    productId: z.string().uuid('ID Produk tidak valid').optional(),
    inventoryItemId: z.string().uuid('ID Bahan Baku tidak valid').optional(),
    actualStock: z.number().min(0, 'Stok fisik tidak boleh negatif'),
    notes: z.string().min(1, 'Catatan penyesuaian/alasan opname wajib diisi'),
    outletId: z.string().uuid().optional(),
  })
  .refine((data) => data.productId || data.inventoryItemId, {
    message: 'Wajib menyertakan productId atau inventoryItemId',
  });

const bulkAdjustmentItemSchema = z
  .object({
    productId: z.string().uuid('ID Produk tidak valid').optional(),
    inventoryItemId: z.string().uuid('ID Bahan Baku tidak valid').optional(),
    actualStock: z.number().min(0, 'Stok fisik tidak boleh negatif'),
    notes: z.string().optional(),
  })
  .refine((data) => data.productId || data.inventoryItemId, {
    message: 'Wajib menyertakan productId atau inventoryItemId',
  });

const bulkStockAdjustmentSchema = z.object({
  outletId: z.string().uuid('ID Toko / Outlet tidak valid').optional(),
  generalNotes: z.string().optional(),
  items: z.array(bulkAdjustmentItemSchema).min(1, 'Minimal 1 item untuk stock opname massal'),
});

const bulkStockInItemSchema = z
  .object({
    productId: z.string().uuid('ID Produk tidak valid').optional(),
    inventoryItemId: z.string().uuid('ID Bahan Baku tidak valid').optional(),
    quantity: z.number().positive('Jumlah masuk harus berupa angka positif'),
    newCostPrice: z.number().min(0).optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.productId || data.inventoryItemId, {
    message: 'Wajib menyertakan productId atau inventoryItemId',
  });

const bulkStockInSchema = z.object({
  outletId: z.string().uuid('ID Toko / Outlet tidak valid').optional(),
  supplierName: z.string().optional(),
  poNumber: z.string().optional(),
  generalNotes: z.string().optional(),
  items: z.array(bulkStockInItemSchema).min(1, 'Minimal 1 item untuk stok masuk massal'),
});

const bulkStockOutItemSchema = z
  .object({
    productId: z.string().uuid('ID Produk tidak valid').optional(),
    inventoryItemId: z.string().uuid('ID Bahan Baku tidak valid').optional(),
    quantity: z.number().positive('Jumlah keluar harus berupa angka positif'),
    reason: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.productId || data.inventoryItemId, {
    message: 'Wajib menyertakan productId atau inventoryItemId',
  });

const bulkStockOutSchema = z.object({
  outletId: z.string().uuid('ID Toko / Outlet tidak valid').optional(),
  generalReason: z.string().optional(),
  generalNotes: z.string().optional(),
  items: z.array(bulkStockOutItemSchema).min(1, 'Minimal 1 item untuk stok keluar massal'),
});

const bulkTransferItemSchema = z
  .object({
    productId: z.string().uuid('ID Produk tidak valid').optional(),
    inventoryItemId: z.string().uuid('ID Bahan Baku tidak valid').optional(),
    quantity: z.number().positive('Jumlah transfer harus berupa angka positif'),
    notes: z.string().optional(),
  })
  .refine((data) => data.productId || data.inventoryItemId, {
    message: 'Wajib menyertakan productId atau inventoryItemId',
  });

const bulkTransferSchema = z
  .object({
    sourceOutletId: z.string().uuid('ID Toko / Outlet Asal tidak valid'),
    targetOutletId: z.string().uuid('ID Toko / Outlet Tujuan tidak valid'),
    transferNumber: z.string().optional(),
    generalNotes: z.string().optional(),
    items: z.array(bulkTransferItemSchema).min(1, 'Minimal 1 item untuk transfer massal'),
  })
  .refine((data) => data.sourceOutletId !== data.targetOutletId, {
    message: 'Toko / Outlet asal dan tujuan tidak boleh sama',
  });

const transferStockSchema = z.object({
  productId: z.string().uuid('ID Produk tidak valid').optional(),
  inventoryItemId: z.string().uuid('ID Bahan Baku / Item tidak valid').optional(),
  sourceOutletId: z.string().uuid('ID Toko/Gudang Asal tidak valid'),
  targetOutletId: z.string().uuid('ID Toko/Gudang Tujuan tidak valid'),
  quantity: z.number().positive('Jumlah transfer harus berupa angka positif'),
  notes: z.string().optional(),
}).refine((data) => data.productId || data.inventoryItemId, {
  message: 'Wajib menyertakan productId atau inventoryItemId',
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

    const { productId, inventoryItemId, quantity, notes, outletId, poNumber, supplierName, newCostPrice } = parseResult.data;

    let tenantId = req.user?.tenantId || req.tenantId;
    let targetOutletId = outletId || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = tenantId
        ? await prisma.outlet.findFirst({
            where: { tenantId },
            select: { id: true },
          })
        : null;
      targetOutletId = defaultOutlet?.id;
    }

    if (!targetOutletId) {
      return res.status(400).json({ status: 'error', message: 'Outlet tidak ditemukan' });
    }

    if (!tenantId && targetOutletId) {
      const outlet = await prisma.outlet.findUnique({
        where: { id: targetOutletId },
        select: { tenantId: true },
      });
      tenantId = outlet?.tenantId;
    }
    // Fix K3: Jangan fallback ke tenant pertama di DB — return 401
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
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

    // Penanganan Stok Masuk untuk Bahan Baku Mentah (Raw Ingredient)
    if (inventoryItemId) {
      const invItem = await prisma.inventoryItem.findFirst({
        where: { id: inventoryItemId, tenantId: tenantId! },
      });
      if (!invItem) {
        return res.status(404).json({ status: 'error', message: 'Bahan baku tidak ditemukan' });
      }

      let storageLoc = await prisma.storageLocation.findFirst({
        where: { tenantId: tenantId!, outletId: targetOutletId!, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      if (!storageLoc) {
        storageLoc = await prisma.storageLocation.create({
          data: {
            tenantId: tenantId!,
            outletId: targetOutletId!,
            name: 'Gudang Utama & Dapur',
            isDefault: true,
          },
        });
      }

      const rawResult = await prisma.$transaction(async (tx) => {
        let bal = await tx.inventoryBalance.findFirst({
          where: {
            tenantId: tenantId!,
            storageLocationId: storageLoc!.id,
            inventoryItemId: invItem.id,
          },
        });

        const balanceBefore = Number(bal?.quantityOnHand || 0);
        const balanceAfter = balanceBefore + quantity;

        if (bal) {
          await tx.inventoryBalance.update({
            where: { id: bal.id },
            data: { quantityOnHand: balanceAfter },
          });
        } else {
          await tx.inventoryBalance.create({
            data: {
              tenantId: tenantId!,
              storageLocationId: storageLoc!.id,
              inventoryItemId: invItem.id,
              quantityOnHand: balanceAfter,
              quantityReserved: 0,
            },
          });
        }

        if (newCostPrice !== undefined && newCostPrice > 0) {
          await tx.inventoryItem.update({
            where: { id: invItem.id },
            data: { averageCost: newCostPrice },
          });
        }

        const ledger = await tx.inventoryLedger.create({
          data: {
            tenantId: tenantId!,
            storageLocationId: storageLoc!.id,
            inventoryItemId: invItem.id,
            quantityDelta: quantity,
            balanceBefore,
            balanceAfter,
            unitCost: newCostPrice !== undefined ? newCostPrice : invItem.averageCost,
            movementType: 'PURCHASE',
            referenceType: 'MANUAL',
            referenceId: poNumber || invItem.id,
            actorType: 'USER',
            actorUserId: userId,
            notes: finalNotes,
          },
        });

        return { newStock: balanceAfter, unit: invItem.canonicalUom, name: invItem.name, movement: ledger };
      });

      return res.status(200).json({
        status: 'success',
        message: `Berhasil mencatat penerimaan ${quantity} ${rawResult.unit} untuk "${rawResult.name}"`,
        data: {
          newStock: rawResult.newStock,
          movement: rawResult.movement,
        },
      });
    }

    if (!productId) {
      return res.status(400).json({ status: 'error', message: 'productId wajib jika bukan bahan baku' });
    }

    const targetProdIn = await prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true, name: true, type: true, unit: true },
    });

    if (!targetProdIn) {
      return res.status(404).json({ status: 'error', message: 'Produk tidak ditemukan di akun bisnis ini' });
    }

    if (targetProdIn.type === 'COMPOSITE') {
      return res.status(400).json({
        status: 'error',
        message: `Produk "${targetProdIn.name}" adalah menu olahan dapur F&B (Resep BOM) tanpa kartu stok fisik mandiri. Penerimaan stok masuk (kulakan) harus dicatat pada Bahan Baku pembuatnya di tab Bahan Baku.`,
      });
    }

    // Eksekusi atomik menggunakan Dual-Write Service
    const result = await prisma.$transaction(async (tx) => {
      await inventoryDualWriteService.recordStockIn(
        {
          outletId: targetOutletId!,
          productId,
          quantity,
          poNumber: poNumber || null,
          supplierName: supplierName || null,
          newCostPrice: newCostPrice !== undefined ? newCostPrice : null,
          notes: finalNotes,
        },
        { tx, tenantId: tenantId!, actorUserId: userId }
      );

      const balanceRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(ib.quantity_on_hand, 0) as stock, pv.price, COALESCE(ii.reorder_point, 5) as min_stock_alert,
                p.name as product_name, pv.sku, p.unit, COALESCE(ii.average_cost, 0) as "costPrice"
         FROM "products" p
         JOIN "product_variants" pv ON pv.product_id = p.id AND pv.is_active = true
         JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id
         JOIN "storage_locations" sl ON sl.outlet_id = $1 AND sl.is_default = true
         LEFT JOIN "inventory_balances" ib ON ib.inventory_item_id = ii.id AND ib.storage_location_id = sl.id
         WHERE p.id = $2 LIMIT 1;`,
        targetOutletId,
        productId
      );
      const b = balanceRows[0] || { stock: 0, price: 0, min_stock_alert: 5, product_name: 'Product', sku: '', unit: 'Pcs', costPrice: 0 };

      const movementRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT il.id, il.movement_type::text as type, il.quantity_delta as quantity, il.balance_after as stock, il.notes, il.created_at
         FROM "inventory_ledgers" il
         JOIN "storage_locations" sl ON sl.id = il.storage_location_id
         JOIN "inventory_items" ii ON ii.id = il.inventory_item_id
         JOIN "product_variants" pv ON pv.inventory_item_id = ii.id
         WHERE sl.outlet_id = $1 AND pv.product_id = $2
         ORDER BY il.created_at DESC LIMIT 1;`,
        targetOutletId,
        productId
      );

      const outletProduct = {
        id: productId,
        stock: Number(b.stock),
        price: Number(b.price || 0),
        minStockAlert: Number(b.min_stock_alert || 5),
        product: {
          name: b.product_name,
          sku: b.sku,
          unit: b.unit,
          costPrice: Number(b.costPrice || 0),
        },
      };

      return { outletProduct, movement: movementRows[0] || null };
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

    let tenantId = req.user?.tenantId || req.tenantId;
    let targetOutletId = outletId || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = tenantId
        ? await prisma.outlet.findFirst({
            where: { tenantId },
            select: { id: true },
          })
        : null;
      targetOutletId = defaultOutlet?.id;
    }

    if (!tenantId && targetOutletId) {
      const outlet = await prisma.outlet.findUnique({
        where: { id: targetOutletId },
        select: { tenantId: true },
      });
      tenantId = outlet?.tenantId;
    }
    // Fix K3: Jangan fallback ke tenant pertama di DB — return 401
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'User belum terautentikasi' });
    }

    if (!productId) {
      return res.status(400).json({ status: 'error', message: 'productId wajib diisi untuk stok keluar' });
    }

    const targetProd = await prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true, name: true, type: true, unit: true },
    });

    if (!targetProd) {
      return res.status(404).json({ status: 'error', message: 'Produk tidak ditemukan di akun bisnis ini' });
    }

    if (targetProd.type === 'COMPOSITE') {
      return res.status(400).json({
        status: 'error',
        message: `Produk "${targetProd.name}" adalah menu olahan dapur F&B (Resep BOM) tanpa kartu stok fisik mandiri. Pengurangan atau pembuangan persediaan (rusak/basi) harus dicatat pada Bahan Baku pembuatnya di tab Bahan Baku.`,
      });
    }

    const opPreRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(ib.quantity_on_hand, 0) as stock, pv.price, p.name as product_name, p.unit
       FROM "products" p
       JOIN "product_variants" pv ON pv.product_id = p.id AND pv.is_active = true
       JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id
       JOIN "storage_locations" sl ON sl.outlet_id = $1 AND sl.is_default = true
       LEFT JOIN "inventory_balances" ib ON ib.inventory_item_id = ii.id AND ib.storage_location_id = sl.id
       WHERE p.id = $2 LIMIT 1;`,
      targetOutletId,
      productId
    );

    if (!opPreRows || opPreRows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Produk tidak ditemukan di outlet ini' });
    }

    const outletProduct = {
      stock: Number(opPreRows[0].stock),
      price: Number(opPreRows[0].price || 0),
      product: {
        name: opPreRows[0].product_name,
        unit: opPreRows[0].unit,
      },
    };

    if (outletProduct.stock < quantity) {
      return res.status(400).json({
        status: 'error',
        message: `Stok tidak mencukupi. Stok saat ini: ${outletProduct.stock} ${outletProduct.product.unit}, permintaan keluar: ${quantity}`,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      await inventoryDualWriteService.recordStockOut(
        {
          outletId: targetOutletId!,
          productId: productId!,
          quantity,
          reason: notes || 'Barang rusak / kadaluarsa dikeluarkan dari rak',
          notes: notes || 'Barang rusak / kadaluarsa dikeluarkan dari rak',
        },
        { tx, tenantId: tenantId!, actorUserId: userId }
      );

      const updatedRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(ib.quantity_on_hand, 0) as stock
         FROM "products" p
         JOIN "product_variants" pv ON pv.product_id = p.id AND pv.is_active = true
         JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id
         JOIN "storage_locations" sl ON sl.outlet_id = $1 AND sl.is_default = true
         LEFT JOIN "inventory_balances" ib ON ib.inventory_item_id = ii.id AND ib.storage_location_id = sl.id
         WHERE p.id = $2 LIMIT 1;`,
        targetOutletId,
        productId
      );

      const movementRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT il.id, il.movement_type::text as type, il.quantity_delta as quantity, il.balance_after as stock, il.notes, il.created_at
         FROM "inventory_ledgers" il
         JOIN "storage_locations" sl ON sl.id = il.storage_location_id
         JOIN "inventory_items" ii ON ii.id = il.inventory_item_id
         JOIN "product_variants" pv ON pv.inventory_item_id = ii.id
         WHERE sl.outlet_id = $1 AND pv.product_id = $2
         ORDER BY il.created_at DESC LIMIT 1;`,
        targetOutletId,
        productId
      );

      return { updated: updatedRows[0] || { stock: 0 }, movement: movementRows[0] || null };
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

    const { productId, inventoryItemId, actualStock, notes, outletId } = parseResult.data;

    let tenantId = req.user?.tenantId || req.tenantId;
    let targetOutletId = outletId || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = tenantId
        ? await prisma.outlet.findFirst({
            where: { tenantId },
            select: { id: true },
          })
        : null;
      targetOutletId = defaultOutlet?.id;
    }

    if (!tenantId && targetOutletId) {
      const outlet = await prisma.outlet.findUnique({
        where: { id: targetOutletId },
        select: { tenantId: true },
      });
      tenantId = outlet?.tenantId;
    }
    // Fix K3: Jangan fallback ke tenant pertama di DB — return 401
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'User belum terautentikasi' });
    }

    // Penanganan Penyesuaian / Stock Opname Bahan Baku Mentah
    if (inventoryItemId) {
      const invItem = await prisma.inventoryItem.findFirst({
        where: { id: inventoryItemId, tenantId: tenantId! },
      });
      if (!invItem) {
        return res.status(404).json({ status: 'error', message: 'Bahan baku tidak ditemukan' });
      }

      let storageLoc = await prisma.storageLocation.findFirst({
        where: { tenantId: tenantId!, outletId: targetOutletId!, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      if (!storageLoc) {
        storageLoc = await prisma.storageLocation.create({
          data: {
            tenantId: tenantId!,
            outletId: targetOutletId!,
            name: 'Gudang Utama & Dapur',
            isDefault: true,
          },
        });
      }

      const rawResult = await prisma.$transaction(async (tx) => {
        let bal = await tx.inventoryBalance.findFirst({
          where: {
            tenantId: tenantId!,
            storageLocationId: storageLoc!.id,
            inventoryItemId: invItem.id,
          },
        });

        const balanceBefore = Number(bal?.quantityOnHand || 0);
        const delta = actualStock - balanceBefore;

        if (bal) {
          await tx.inventoryBalance.update({
            where: { id: bal.id },
            data: { quantityOnHand: actualStock },
          });
        } else {
          await tx.inventoryBalance.create({
            data: {
              tenantId: tenantId!,
              storageLocationId: storageLoc!.id,
              inventoryItemId: invItem.id,
              quantityOnHand: actualStock,
              quantityReserved: 0,
            },
          });
        }

        const ledger = await tx.inventoryLedger.create({
          data: {
            tenantId: tenantId!,
            storageLocationId: storageLoc!.id,
            inventoryItemId: invItem.id,
            quantityDelta: delta,
            balanceBefore,
            balanceAfter: actualStock,
            unitCost: invItem.averageCost,
            movementType: 'OPNAME_ADJUSTMENT',
            referenceType: 'STOCK_OPNAME',
            referenceId: invItem.id,
            actorType: 'USER',
            actorUserId: userId,
            notes: `Opname Bahan Baku: dari ${balanceBefore} ke ${actualStock}. Catatan: ${notes}`,
          },
        });

        return { newStock: actualStock, unit: invItem.canonicalUom, name: invItem.name, movement: ledger, balanceBefore };
      });

      return res.status(200).json({
        status: 'success',
        message: `Berhasil menyesuaikan stok fisik "${rawResult.name}" menjadi ${actualStock} ${rawResult.unit}`,
        data: {
          previousStock: rawResult.balanceBefore,
          actualStock: rawResult.newStock,
          newStock: rawResult.newStock,
          difference: actualStock - rawResult.balanceBefore,
          movement: rawResult.movement,
        },
      });
    }

    if (!productId) {
      return res.status(400).json({ status: 'error', message: 'productId wajib jika bukan bahan baku' });
    }

    const targetProdAdj = await prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true, name: true, type: true, unit: true },
    });

    if (!targetProdAdj) {
      return res.status(404).json({ status: 'error', message: 'Produk tidak ditemukan di akun bisnis ini' });
    }

    if (targetProdAdj.type === 'COMPOSITE') {
      return res.status(400).json({
        status: 'error',
        message: `Produk "${targetProdAdj.name}" adalah menu olahan dapur F&B (Resep BOM) tanpa kartu stok fisik mandiri. Opname fisik persediaan harus dilakukan melalui tab Bahan Baku.`,
      });
    }

    const opAdjRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(ib.quantity_on_hand, 0) as stock, p.name as product_name, p.unit
       FROM "products" p
       JOIN "product_variants" pv ON pv.product_id = p.id AND pv.is_active = true
       JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id
       JOIN "storage_locations" sl ON sl.outlet_id = $1 AND sl.is_default = true
       LEFT JOIN "inventory_balances" ib ON ib.inventory_item_id = ii.id AND ib.storage_location_id = sl.id
       WHERE p.id = $2 LIMIT 1;`,
      targetOutletId,
      productId
    );

    const existing = opAdjRows && opAdjRows.length > 0 ? opAdjRows[0] : null;
    const currentStock = Number(existing?.stock ?? 0);
    const difference = actualStock - currentStock;

    const result = await prisma.$transaction(async (tx) => {
      await inventoryDualWriteService.recordStockAdjustment(
        {
          outletId: targetOutletId!,
          productId,
          actualStock,
          notes: `Stock Opname: dari ${currentStock} ke ${actualStock}. Alasan: ${notes}`,
        },
        { tx, tenantId: tenantId!, actorUserId: userId }
      );

      const updatedRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(ib.quantity_on_hand, 0) as stock
         FROM "products" p
         JOIN "product_variants" pv ON pv.product_id = p.id AND pv.is_active = true
         JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id
         JOIN "storage_locations" sl ON sl.outlet_id = $1 AND sl.is_default = true
         LEFT JOIN "inventory_balances" ib ON ib.inventory_item_id = ii.id AND ib.storage_location_id = sl.id
         WHERE p.id = $2 LIMIT 1;`,
        targetOutletId,
        productId
      );

      const movementRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT il.id, il.movement_type::text as type, il.quantity_delta as quantity, il.balance_after as stock, il.notes, il.created_at
         FROM "inventory_ledgers" il
         JOIN "storage_locations" sl ON sl.id = il.storage_location_id
         JOIN "inventory_items" ii ON ii.id = il.inventory_item_id
         JOIN "product_variants" pv ON pv.inventory_item_id = ii.id
         WHERE sl.outlet_id = $1 AND pv.product_id = $2
         ORDER BY il.created_at DESC LIMIT 1;`,
        targetOutletId,
        productId
      );

      return { updated: updatedRows[0] || { stock: actualStock }, movement: movementRows[0] || null };
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

    // Fix T1: Hapus req.query.tenantId — user input tidak boleh override JWT context
    let userTenantId: string | undefined = req.user?.tenantId || req.tenantId || (req.headers['x-tenant-id'] as string);

    if (!userTenantId && outletId) {
      const outlet = await prisma.outlet.findUnique({
        where: { id: outletId as string },
        select: { tenantId: true },
      });
      userTenantId = outlet?.tenantId;
    }

    // Fix K3: Jangan fallback ke tenant pertama — return 401
    if (!userTenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    const movements = await inventoryReadAdapter.getStockMovements(userTenantId || '', {
      productId: productId as string,
      outletId: outletId as string,
      type: type as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string, 10) : 100,
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
    let userTenantId: string | undefined = req.user?.tenantId || req.tenantId;
    let targetOutletId = (req.query.outletId as string) || req.user?.outletId;
    if (!userTenantId) {
      if (targetOutletId) {
        const outlet = await prisma.outlet.findUnique({
          where: { id: targetOutletId },
          select: { tenantId: true },
        });
        userTenantId = outlet?.tenantId;
      } else {
        // Fix K3: Jangan fallback ke tenant pertama — tolak dengan 401
        return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
      }
    }
    if (!targetOutletId && userTenantId) {
      const defaultOutlet = await prisma.outlet.findFirst({
        where: { tenantId: userTenantId },
        select: { id: true },
      });
      targetOutletId = defaultOutlet?.id;
    }

    const items = await inventoryReadAdapter.getLowStock(userTenantId || '', targetOutletId || undefined);
    return res.status(200).json({
      status: 'success',
      data: items,
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

    const { productId, inventoryItemId, sourceOutletId, targetOutletId, quantity, notes } = parseResult.data;

    if (sourceOutletId === targetOutletId) {
      return res.status(400).json({
        status: 'error',
        message: 'Toko / Outlet asal dan tujuan tidak boleh sama',
      });
    }

    const userId = req.user?.id;
    let tenantId = req.user?.tenantId || req.tenantId;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'User belum terautentikasi' });
    }

    // Ambil info cabang/gudang asal & tujuan dengan isolasi tenant
    const [sourceRows, targetRows] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name FROM "outlets" WHERE id = $1 AND ($2::text IS NULL OR tenant_id = $2) LIMIT 1;`,
        sourceOutletId,
        tenantId || null
      ),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name FROM "outlets" WHERE id = $1 AND ($2::text IS NULL OR tenant_id = $2) LIMIT 1;`,
        targetOutletId,
        tenantId || null
      ),
    ]);

    const sourceOutlet = sourceRows[0];
    const targetOutlet = targetRows[0];

    if (!sourceOutlet || !targetOutlet) {
      return res.status(404).json({ status: 'error', message: 'Data toko/gudang tidak ditemukan atau bukan milik tenant Anda' });
    }

    let itemName = '';
    let itemUnit = 'Pcs';
    let targetInventoryItemId = inventoryItemId;

    if (inventoryItemId) {
      // Transfer Bahan Baku / Inventory Item langsung dengan isolasi tenant
      const itemRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name, canonical_uom FROM "inventory_items" WHERE id = $1 AND ($2::text IS NULL OR tenant_id = $2) LIMIT 1;`,
        inventoryItemId,
        tenantId || null
      );
      if (!itemRows || itemRows.length === 0) {
        return res.status(404).json({ status: 'error', message: 'Data bahan baku/inventori tidak ditemukan atau bukan milik tenant Anda' });
      }
      itemName = itemRows[0].name;
      itemUnit = itemRows[0].canonical_uom;

      // Cek stok asal di storage location asal
      const balanceRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(ib.quantity_on_hand, 0) as stock
         FROM "storage_locations" sl
         LEFT JOIN "inventory_balances" ib ON ib.inventory_item_id = $1 AND ib.storage_location_id = sl.id
         WHERE sl.outlet_id = $2 AND sl.is_default = true
         LIMIT 1;`,
        inventoryItemId,
        sourceOutletId
      );

      const currentStock = Number(balanceRows && balanceRows.length > 0 ? balanceRows[0].stock : 0);
      if (currentStock < quantity) {
        return res.status(400).json({
          status: 'error',
          message: `Stok di "${sourceOutlet.name}" tidak mencukupi! Tersedia: ${currentStock} ${itemUnit}, diminta: ${quantity} ${itemUnit}.`,
        });
      }
    } else if (productId) {
      // Transfer Produk Retail
      const productRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name, sku, unit FROM "products" WHERE id = $1 LIMIT 1;`,
        productId
      );
      const product = productRows[0];
      if (!product) {
        return res.status(404).json({ status: 'error', message: 'Produk tidak ditemukan' });
      }
      itemName = product.name;
      itemUnit = product.unit || 'Pcs';

      // Periksa stok cabang asal dari target inventory_balances
      const sopRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(ib.quantity_on_hand, 0) as stock
         FROM "products" p
         JOIN "product_variants" pv ON pv.product_id = p.id AND pv.is_active = true
         JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id
         JOIN "storage_locations" sl ON sl.outlet_id = $1 AND sl.is_default = true
         LEFT JOIN "inventory_balances" ib ON ib.inventory_item_id = ii.id AND ib.storage_location_id = sl.id
         WHERE p.id = $2 LIMIT 1;`,
        sourceOutletId,
        productId
      );

      const currentStock = Number(sopRows && sopRows.length > 0 ? sopRows[0].stock : 0);
      if (currentStock < quantity) {
        return res.status(400).json({
          status: 'error',
          message: `Stok di "${sourceOutlet.name}" tidak mencukupi! Tersedia: ${currentStock} ${itemUnit}, diminta: ${quantity} ${itemUnit}.`,
        });
      }
    }

    if (!tenantId && sourceOutletId) {
      const outlet = await prisma.outlet.findUnique({
        where: { id: sourceOutletId },
        select: { tenantId: true },
      });
      tenantId = outlet?.tenantId;
    }
    // Fix K3: Jangan fallback ke tenant pertama — tolak dengan 401
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    // Eksekusi atomik menggunakan Dual-Write Service
    const result = await prisma.$transaction(async (tx) => {
      const transferNotes = notes
        ? `Transfer dari ${sourceOutlet.name} ke ${targetOutlet.name} | ${notes}`
        : `Transfer dari ${sourceOutlet.name} ke ${targetOutlet.name}`;

      await inventoryDualWriteService.recordStockTransfer(
        {
          sourceOutletId,
          targetOutletId,
          productId,
          inventoryItemId: targetInventoryItemId,
          quantity,
          notes: transferNotes,
        },
        { tx, tenantId: tenantId!, actorUserId: userId }
      );

      return {
        itemName,
        quantity,
        unit: itemUnit,
        sourceOutlet: sourceOutlet.name,
        targetOutlet: targetOutlet.name,
      };
    });

    return res.status(200).json({
      status: 'success',
      message: `Berhasil mentransfer ${quantity} ${itemUnit} ${itemName} dari ${sourceOutlet.name} ke ${targetOutlet.name}`,
      data: result,
    });
  } catch (error) {
    console.error('Error saat mentransfer stok:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memproses transfer stok' });
  }
};

/**
 * Controller: Mendapatkan peringatan batch bahan baku yang mendekati kadaluarsa / sudah kadaluarsa
 * @route GET /api/inventory/expiry-alerts
 */
export const getExpiryAlerts = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant context is required' });
    }

    const { days = '30', outletId } = req.query;
    const thresholdDays = parseInt(days as string, 10) || 30;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + thresholdDays);

    const where: any = {
      tenantId,
      expirationDate: {
        lte: targetDate,
      },
      isActive: true,
      balances: {
        some: {
          quantityOnHand: {
            gt: 0,
          },
          ...(outletId ? { storageLocation: { outletId: outletId as string } } : {}),
        },
      },
    };

    const batches = await prisma.inventoryBatch.findMany({
      where,
      orderBy: { expirationDate: 'asc' },
      include: {
        inventoryItem: true,
        balances: {
          where: {
            quantityOnHand: { gt: 0 },
            ...(outletId ? { storageLocation: { outletId: outletId as string } } : {}),
          },
          include: {
            storageLocation: {
              include: { outlet: true },
            },
          },
        },
      },
    });

    const formatted = batches.map((b) => {
      const totalOnHand = b.balances.reduce((acc, curr) => acc + Number(curr.quantityOnHand), 0);
      const isExpired = b.expirationDate ? b.expirationDate < new Date() : false;
      const daysUntilExpiry = b.expirationDate
        ? Math.ceil((b.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        batchId: b.id,
        batchNumber: b.batchNumber,
        expirationDate: b.expirationDate,
        isExpired,
        daysUntilExpiry,
        costPrice: b.costPrice,
        inventoryItem: {
          id: b.inventoryItem.id,
          name: b.inventoryItem.name,
          itemCode: b.inventoryItem.itemCode,
          canonicalUom: b.inventoryItem.canonicalUom,
        },
        totalOnHand,
        locations: b.balances.map((bal) => ({
          storageLocationId: bal.storageLocationId,
          locationName: bal.storageLocation.name,
          outletName: bal.storageLocation.outlet.name,
          quantityOnHand: Number(bal.quantityOnHand),
        })),
      };
    });

    return res.status(200).json({
      status: 'success',
      data: formatted,
      thresholdDays,
    });
  } catch (error: any) {
    console.error('Error in getExpiryAlerts:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil peringatan masa kadaluarsa batch', error: error.message });
  }
};

/**
 * Controller: Stock Opname Massal (Bulk Physical Count Adjustment)
 * Mendukung penyesuaian massal baik produk retail jadi maupun bahan baku mentah dalam 1 transaksi atomik
 * @route POST /api/inventory/bulk-adjustment
 */
export const recordBulkStockAdjustment = async (req: Request, res: Response) => {
  try {
    const parseResult = bulkStockAdjustmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input stock opname massal gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { outletId, generalNotes, items } = parseResult.data;

    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'User belum terautentikasi' });
    }

    let targetOutletId = outletId || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = await prisma.outlet.findFirst({
        where: { tenantId },
        select: { id: true },
      });
      targetOutletId = defaultOutlet?.id;
    }

    // Verifikasi mutlak: Outlet WAJIB terdaftar pada tenant user yang sedang login
    const verifiedOutlet = await prisma.outlet.findFirst({
      where: { id: targetOutletId, tenantId },
      select: { id: true },
    });
    if (!verifiedOutlet) {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak: Outlet tidak ditemukan atau bukan milik tenant Anda' });
    }

    const opnameSessionId = crypto.randomUUID();
    const results: any[] = [];

    await prisma.$transaction(async (tx) => {
      // 1. Dapatkan atau inisialisasi lokasi gudang/area toko default
      let storageLoc = await tx.storageLocation.findFirst({
        where: { tenantId: tenantId!, outletId: targetOutletId!, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      if (!storageLoc) {
        storageLoc = await tx.storageLocation.create({
          data: {
            tenantId: tenantId!,
            outletId: targetOutletId!,
            name: 'Gudang Utama & Dapur',
            isDefault: true,
          },
        });
      }

      for (const item of items) {
        if (item.inventoryItemId) {
          // Penanganan Bahan Baku Mentah Dapur
          const invItem = await tx.inventoryItem.findFirst({
            where: { id: item.inventoryItemId, tenantId: tenantId! },
          });
          if (!invItem) continue;

          let bal = await tx.inventoryBalance.findFirst({
            where: {
              tenantId: tenantId!,
              storageLocationId: storageLoc!.id,
              inventoryItemId: invItem.id,
            },
          });

          const balanceBefore = Number(bal?.quantityOnHand || 0);
          const delta = item.actualStock - balanceBefore;

          if (bal) {
            await tx.inventoryBalance.update({
              where: { id: bal.id },
              data: { quantityOnHand: item.actualStock },
            });
          } else {
            await tx.inventoryBalance.create({
              data: {
                tenantId: tenantId!,
                storageLocationId: storageLoc!.id,
                inventoryItemId: invItem.id,
                quantityOnHand: item.actualStock,
                quantityReserved: 0,
              },
            });
          }

          // Catat buku besar mutasi audit jika terdapat selisih
          if (delta !== 0) {
            await tx.inventoryLedger.create({
              data: {
                tenantId: tenantId!,
                storageLocationId: storageLoc!.id,
                inventoryItemId: invItem.id,
                quantityDelta: delta,
                balanceBefore,
                balanceAfter: item.actualStock,
                unitCost: invItem.averageCost,
                movementType: 'OPNAME_ADJUSTMENT',
                referenceType: 'STOCK_OPNAME',
                referenceId: opnameSessionId,
                actorType: 'USER',
                actorUserId: userId,
                notes: item.notes || generalNotes || `Opname Massal: dari ${balanceBefore} ke ${item.actualStock}`,
              },
            });
          }

          results.push({
            id: invItem.id,
            type: 'INGREDIENT',
            name: invItem.name,
            unit: invItem.canonicalUom,
            previousStock: balanceBefore,
            actualStock: item.actualStock,
            delta,
          });
        } else if (item.productId) {
          // Penanganan Produk Retail Jadi
          const prod = await tx.product.findFirst({
            where: { id: item.productId, tenantId },
            select: { id: true, name: true, type: true, unit: true },
          });

          if (!prod) {
            throw new Error(`Produk dengan ID "${item.productId}" tidak ditemukan.`);
          }

          if (prod.type === 'COMPOSITE') {
            throw new Error(
              `Produk "${prod.name}" adalah menu olahan dapur F&B (Resep BOM) tanpa saldo fisik mandiri. Opname fisik persediaan harus dilakukan melalui tab Bahan Baku.`
            );
          }

          const res = await inventoryDualWriteService.recordStockAdjustment(
            {
              outletId: targetOutletId!,
              productId: item.productId,
              actualStock: item.actualStock,
              notes: item.notes || generalNotes || `Stock Opname Massal ke ${item.actualStock}`,
            },
            { tx, tenantId: tenantId!, actorUserId: userId }
          );

          results.push({
            id: item.productId,
            type: 'PRODUCT',
            name: prod.name,
            unit: prod.unit || 'Unit',
            actualStock: item.actualStock,
            delta: 0,
          });
        }
      }
    });

    const adjustedItemsCount = results.filter((r) => r.delta !== 0).length;

    return res.status(200).json({
      status: 'success',
      message: `Stock Opname Massal berhasil diterapkan (${results.length} item diproses, ${adjustedItemsCount} item disesuaikan).`,
      data: {
        opnameSessionId,
        totalProcessed: results.length,
        adjustedCount: adjustedItemsCount,
        items: results,
      },
    });
  } catch (error: any) {
    console.error('Error saat stock opname massal:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Gagal memproses stock opname massal',
    });
  }
};

/**
 * Controller: Stok Masuk Massal (Bulk Stock In / PO / Belanja)
 * @route POST /api/inventory/bulk-stock-in
 */
export const recordBulkStockIn = async (req: Request, res: Response) => {
  try {
    const parseResult = bulkStockInSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input stok masuk massal gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { outletId, supplierName, poNumber, generalNotes, items } = parseResult.data;

    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'User belum terautentikasi' });
    }

    let targetOutletId = outletId || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = await prisma.outlet.findFirst({
        where: { tenantId },
        select: { id: true },
      });
      targetOutletId = defaultOutlet?.id;
    }

    const verifiedOutlet = await prisma.outlet.findFirst({
      where: { id: targetOutletId, tenantId },
      select: { id: true },
    });
    if (!verifiedOutlet) {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak: Outlet tidak ditemukan atau bukan milik tenant Anda' });
    }

    const batchSessionId = crypto.randomUUID();
    const results: any[] = [];

    await prisma.$transaction(async (tx) => {
      let storageLoc = await tx.storageLocation.findFirst({
        where: { tenantId: tenantId!, outletId: targetOutletId!, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      if (!storageLoc) {
        storageLoc = await tx.storageLocation.create({
          data: {
            tenantId: tenantId!,
            outletId: targetOutletId!,
            name: 'Gudang Utama & Dapur',
            isDefault: true,
          },
        });
      }

      for (const item of items) {
        if (item.quantity <= 0) continue;

        if (item.inventoryItemId) {
          const invItem = await tx.inventoryItem.findFirst({
            where: { id: item.inventoryItemId, tenantId: tenantId! },
          });
          if (!invItem) continue;

          let bal = await tx.inventoryBalance.findFirst({
            where: {
              tenantId: tenantId!,
              storageLocationId: storageLoc!.id,
              inventoryItemId: invItem.id,
            },
          });

          const balanceBefore = Number(bal?.quantityOnHand || 0);
          const balanceAfter = balanceBefore + item.quantity;

          if (bal) {
            await tx.inventoryBalance.update({
              where: { id: bal.id },
              data: { quantityOnHand: balanceAfter },
            });
          } else {
            await tx.inventoryBalance.create({
              data: {
                tenantId: tenantId!,
                storageLocationId: storageLoc!.id,
                inventoryItemId: invItem.id,
                quantityOnHand: balanceAfter,
                quantityReserved: 0,
              },
            });
          }

          if (item.newCostPrice !== undefined && item.newCostPrice > 0) {
            await tx.inventoryItem.update({
              where: { id: invItem.id },
              data: { averageCost: item.newCostPrice },
            });
          }

          const noteParts: string[] = [];
          if (poNumber) noteParts.push(`PO: ${poNumber}`);
          if (supplierName) noteParts.push(`Supplier: ${supplierName}`);
          if (item.notes) noteParts.push(item.notes);
          if (generalNotes) noteParts.push(generalNotes);
          const finalNote = noteParts.length > 0 ? noteParts.join(' | ') : 'Penerimaan stok masuk massal';

          await tx.inventoryLedger.create({
            data: {
              tenantId: tenantId!,
              storageLocationId: storageLoc!.id,
              inventoryItemId: invItem.id,
              quantityDelta: item.quantity,
              balanceBefore,
              balanceAfter,
              unitCost: item.newCostPrice !== undefined && item.newCostPrice > 0 ? item.newCostPrice : invItem.averageCost,
              movementType: 'PURCHASE',
              referenceType: 'MANUAL',
              referenceId: poNumber || batchSessionId,
              actorType: 'USER',
              actorUserId: userId,
              notes: finalNote,
            },
          });

          results.push({
            id: invItem.id,
            type: 'INGREDIENT',
            name: invItem.name,
            quantity: item.quantity,
            newStock: balanceAfter,
          });
        } else if (item.productId) {
          const prod = await tx.product.findFirst({
            where: { id: item.productId, tenantId },
            select: { id: true, name: true, type: true, unit: true },
          });
          if (!prod) {
            throw new Error(`Produk dengan ID "${item.productId}" tidak ditemukan.`);
          }

          if (prod.type === 'COMPOSITE') {
            throw new Error(
              `Produk "${prod.name}" adalah menu olahan dapur (Resep BOM). Penerimaan stok masuk (kulakan) harus dicatat pada Bahan Baku pembuatnya.`
            );
          }

          const noteParts: string[] = [];
          if (poNumber) noteParts.push(`PO: ${poNumber}`);
          if (supplierName) noteParts.push(`Supplier: ${supplierName}`);
          if (item.notes) noteParts.push(item.notes);
          if (generalNotes) noteParts.push(generalNotes);
          const finalNote = noteParts.length > 0 ? noteParts.join(' | ') : 'Penerimaan stok masuk massal';

          await inventoryDualWriteService.recordStockIn(
            {
              outletId: targetOutletId!,
              productId: item.productId,
              quantity: item.quantity,
              notes: finalNote,
              poNumber,
              supplierName,
              newCostPrice: item.newCostPrice,
            },
            { tx, tenantId: tenantId!, actorUserId: userId }
          );

          results.push({
            id: item.productId,
            type: 'PRODUCT',
            name: prod.name,
            quantity: item.quantity,
            newStock: undefined,
          });
        }
      }
    });

    return res.status(200).json({
      status: 'success',
      message: `Berhasil mencatat stok masuk massal untuk ${results.length} item.`,
      data: {
        batchSessionId,
        totalItems: results.length,
        items: results,
      },
    });
  } catch (error: any) {
    console.error('Error saat stok masuk massal:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal memproses stok masuk massal' });
  }
};

/**
 * Controller: Stok Keluar Massal (Bulk Stock Out / Rusak / Basi / Internal)
 * @route POST /api/inventory/bulk-stock-out
 */
export const recordBulkStockOut = async (req: Request, res: Response) => {
  try {
    const parseResult = bulkStockOutSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input stok keluar massal gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { outletId, generalReason, generalNotes, items } = parseResult.data;

    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'User belum terautentikasi' });
    }

    let targetOutletId = outletId || req.user?.outletId;
    if (!targetOutletId) {
      const defaultOutlet = await prisma.outlet.findFirst({
        where: { tenantId },
        select: { id: true },
      });
      targetOutletId = defaultOutlet?.id;
    }

    const verifiedOutlet = await prisma.outlet.findFirst({
      where: { id: targetOutletId, tenantId },
      select: { id: true },
    });
    if (!verifiedOutlet) {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak: Outlet tidak ditemukan atau bukan milik tenant Anda' });
    }

    const batchSessionId = crypto.randomUUID();
    const results: any[] = [];

    await prisma.$transaction(async (tx) => {
      let storageLoc = await tx.storageLocation.findFirst({
        where: { tenantId: tenantId!, outletId: targetOutletId!, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      if (!storageLoc) {
        throw new Error('Lokasi gudang/toko tidak ditemukan');
      }

      for (const item of items) {
        if (item.quantity <= 0) continue;

        if (item.inventoryItemId) {
          const invItem = await tx.inventoryItem.findFirst({
            where: { id: item.inventoryItemId, tenantId: tenantId! },
          });
          if (!invItem) continue;

          let bal = await tx.inventoryBalance.findFirst({
            where: {
              tenantId: tenantId!,
              storageLocationId: storageLoc!.id,
              inventoryItemId: invItem.id,
            },
          });

          const currentStock = Number(bal?.quantityOnHand || 0);
          if (currentStock < item.quantity) {
            throw new Error(`Stok bahan baku "${invItem.name}" tidak mencukupi! Tersedia: ${currentStock} ${invItem.canonicalUom}, diminta keluar: ${item.quantity}.`);
          }

          const balanceAfter = currentStock - item.quantity;
          await tx.inventoryBalance.update({
            where: { id: bal!.id },
            data: { quantityOnHand: balanceAfter },
          });

          const reasonText = item.reason || generalReason || 'Rusak/Kadaluarsa';
          const finalNote = item.notes ? `${reasonText} | ${item.notes}` : (generalNotes ? `${reasonText} | ${generalNotes}` : reasonText);

          await tx.inventoryLedger.create({
            data: {
              tenantId: tenantId!,
              storageLocationId: storageLoc!.id,
              inventoryItemId: invItem.id,
              quantityDelta: -item.quantity,
              balanceBefore: currentStock,
              balanceAfter,
              unitCost: invItem.averageCost,
              movementType: 'WASTE',
              referenceType: 'MANUAL',
              referenceId: batchSessionId,
              actorType: 'USER',
              actorUserId: userId,
              notes: finalNote,
            },
          });

          results.push({
            id: invItem.id,
            type: 'INGREDIENT',
            name: invItem.name,
            quantity: item.quantity,
            remainingStock: balanceAfter,
          });
        } else if (item.productId) {
          const prod = await tx.product.findFirst({
            where: { id: item.productId, tenantId },
            select: { id: true, name: true, type: true, unit: true },
          });

          if (!prod) {
            throw new Error(`Produk dengan ID "${item.productId}" tidak ditemukan.`);
          }

          if (prod.type === 'COMPOSITE') {
            throw new Error(
              `Produk "${prod.name}" adalah menu olahan dapur F&B (Resep BOM) tanpa saldo fisik mandiri. Pengurangan persediaan harus dilakukan melalui tab Bahan Baku.`
            );
          }

          const reasonText = item.reason || generalReason || 'Barang Rusak / Kadaluarsa';
          const finalNote = item.notes ? `${reasonText} | ${item.notes}` : (generalNotes ? `${reasonText} | ${generalNotes}` : reasonText);

          await inventoryDualWriteService.recordStockOut(
            {
              outletId: targetOutletId!,
              productId: item.productId,
              quantity: item.quantity,
              reason: reasonText,
              notes: finalNote,
            },
            { tx, tenantId: tenantId!, actorUserId: userId }
          );

          results.push({
            id: item.productId,
            type: 'PRODUCT',
            name: prod.name,
            quantity: item.quantity,
            remainingStock: undefined,
          });
        }
      }
    });

    return res.status(200).json({
      status: 'success',
      message: `Berhasil mencatat pengeluaran stok massal untuk ${results.length} item.`,
      data: {
        batchSessionId,
        totalItems: results.length,
        items: results,
      },
    });
  } catch (error: any) {
    console.error('Error saat stok keluar massal:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal memproses stok keluar massal' });
  }
};

/**
 * Controller: Transfer Stok Antar Cabang / Gudang Massal (Bulk Transfer)
 * @route POST /api/inventory/bulk-transfer
 */
export const recordBulkTransfer = async (req: Request, res: Response) => {
  try {
    const parseResult = bulkTransferSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input transfer massal gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { sourceOutletId, targetOutletId, transferNumber, generalNotes, items } = parseResult.data;

    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'User belum terautentikasi' });
    }

    const [sourceOutlet, targetOutlet] = await Promise.all([
      prisma.outlet.findFirst({
        where: { id: sourceOutletId, tenantId },
        select: { id: true, name: true },
      }),
      prisma.outlet.findFirst({
        where: { id: targetOutletId, tenantId },
        select: { id: true, name: true },
      }),
    ]);

    if (!sourceOutlet || !targetOutlet) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Toko/gudang asal atau tujuan tidak ditemukan atau bukan milik tenant Anda',
      });
    }

    const effectiveTransferNumber = transferNumber || `TRF-${Date.now().toString().slice(-6)}`;
    const results: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (item.quantity <= 0) continue;

        if (item.productId) {
          const prod = await tx.product.findFirst({
            where: { id: item.productId, tenantId },
            select: { id: true },
          });
          if (!prod) continue;
        } else if (item.inventoryItemId) {
          const inv = await tx.inventoryItem.findFirst({
            where: { id: item.inventoryItemId, tenantId },
            select: { id: true },
          });
          if (!inv) continue;
        }

        const transferNotes = item.notes || generalNotes || `Transfer Massal ${sourceOutlet.name} ke ${targetOutlet.name}`;

        await inventoryDualWriteService.recordStockTransfer(
          {
            sourceOutletId,
            targetOutletId,
            productId: item.productId,
            inventoryItemId: item.inventoryItemId,
            quantity: item.quantity,
            notes: transferNotes,
          },
          { tx, tenantId: tenantId!, actorUserId: userId }
        );

        results.push({
          id: item.productId || item.inventoryItemId,
          quantity: item.quantity,
        });
      }
    });

    return res.status(200).json({
      status: 'success',
      message: `Berhasil mentransfer ${results.length} jenis item dari "${sourceOutlet.name}" ke "${targetOutlet.name}".`,
      data: {
        transferNumber: effectiveTransferNumber,
        sourceOutletName: sourceOutlet.name,
        targetOutletName: targetOutlet.name,
        totalItems: results.length,
        items: results,
      },
    });
  } catch (error: any) {
    console.error('Error saat transfer massal:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Gagal memproses transfer stok massal' });
  }
};


