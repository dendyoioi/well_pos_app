import { BaseReadAdapter } from './base.read_adapter';
import { prisma } from '../../config/prisma';
import {
  GetProductsQueryOptions,
  FormattedProductDTO,
  FormattedCategoryDTO,
} from './types';

/**
 * CatalogReadAdapter
 * Target read adapter for catalog domains reading directly from:
 * - products
 * - product_variants
 * - inventory_items
 * - inventory_balances
 * - storage_locations
 * - categories
 */
export class CatalogReadAdapter extends BaseReadAdapter {
  /**
   * Reads product catalog from the target schema with physical stock from inventory_balances.
   */
  public async getProducts(options: GetProductsQueryOptions): Promise<{
    data: FormattedProductDTO[];
    meta: { total: number; outletId?: string };
  }> {
    const { tenantId, outletId, categoryId, search, isActive } = options;

    // 1. Resolve storage locations for outlet and warehouse
    let outletStorageLocationId: string | null = null;
    let warehouseStorageLocationId: string | null = null;

    if (outletId) {
      outletStorageLocationId = await this.resolveDefaultStorageLocation(tenantId, outletId);
    }
    warehouseStorageLocationId = await this.resolveWarehouseStorageLocation(tenantId);

    // 2. Query target catalog with join to primary variant, item, and storage location balances
    const params: any[] = [tenantId];
    let whereClauses = [`p.tenant_id = $1`];

    if (categoryId && typeof categoryId === 'string') {
      params.push(categoryId);
      whereClauses.push(`p.category_id = $${params.length}`);
    }

    if (isActive === 'all') {
      // no filter
    } else if (isActive !== undefined) {
      params.push(isActive === 'true' || isActive === true);
      whereClauses.push(`p.is_active = $${params.length}`);
    } else {
      params.push(true);
      whereClauses.push(`p.is_active = $${params.length}`);
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      params.push(`%${search.trim().toLowerCase()}%`);
      const searchIdx = params.length;
      whereClauses.push(`(
        LOWER(p.name) LIKE $${searchIdx} 
        OR LOWER(pv.sku) LIKE $${searchIdx} 
        OR LOWER(COALESCE(pv.barcode, '')) LIKE $${searchIdx}
        OR LOWER(COALESCE(c.name, '')) LIKE $${searchIdx}
        OR LOWER(COALESCE(pv.name, '')) LIKE $${searchIdx}
        OR LOWER(COALESCE(p.description, '')) LIKE $${searchIdx}
      )`);
    }

    // Scoping Alokasi Outlet: Hanya tampilkan produk yang dialokasikan ke outlet ini (EPIC-19)
    if (outletId) {
      params.push(outletId);
      const outletIdx = params.length;
      whereClauses.push(`EXISTS (
        SELECT 1 FROM "outlet_products" op 
        WHERE op.product_id = p.id 
          AND op.outlet_id = $${outletIdx} 
          AND op.is_available = true
      )`);
    }

    // Add storage location parameters if resolved
    let outletLocParam = 'NULL::text';
    if (outletStorageLocationId) {
      params.push(outletStorageLocationId);
      outletLocParam = `$${params.length}::text`;
    }

    let whLocParam = 'NULL::text';
    if (warehouseStorageLocationId) {
      params.push(warehouseStorageLocationId);
      whLocParam = `$${params.length}::text`;
    }

    const sql = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.image_url,
        p.is_active,
        p.unit,
        p.type as product_type,
        p.created_at,
        c.id as category_id,
        c.name as category_name,
        pv.id as variant_id,
        pv.name as variant_name,
        pv.sku,
        pv.barcode,
        pv.price as variant_price,
        r.id as recipe_id,
        COALESCE(pbi_sub.bundle_count, 0) as bundle_items_count,
        COALESCE(rc.recipe_cogs, ii.average_cost, 0) as cost_price,
        COALESCE(ib_outlet.quantity_on_hand, 0) as outlet_stock,
        COALESCE(ib_wh.quantity_on_hand, NULL) as warehouse_stock,
        COALESCE(ii.reorder_point, 5) as min_stock_alert
      FROM "products" p
      LEFT JOIN "categories" c ON c.id = p.category_id
      JOIN "product_variants" pv ON pv.product_id = p.id AND pv.is_active = true
      LEFT JOIN "recipes" r ON r.product_variant_id = pv.id
      LEFT JOIN (
        SELECT bundle_product_id, COUNT(*) as bundle_count
        FROM "product_bundle_items"
        GROUP BY bundle_product_id
      ) pbi_sub ON pbi_sub.bundle_product_id = p.id
      LEFT JOIN (
        SELECT 
          r_sub.product_variant_id,
          SUM(ri.quantity * ii_sub.average_cost) as recipe_cogs
        FROM "recipes" r_sub
        JOIN "recipe_items" ri ON ri.recipe_id = r_sub.id
        JOIN "inventory_items" ii_sub ON ii_sub.id = ri.inventory_item_id
        GROUP BY r_sub.product_variant_id
      ) rc ON rc.product_variant_id = pv.id
      LEFT JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id
      LEFT JOIN "inventory_balances" ib_outlet 
        ON ib_outlet.inventory_item_id = ii.id 
        AND ib_outlet.storage_location_id = ${outletLocParam}
      LEFT JOIN "inventory_balances" ib_wh 
        ON ib_wh.inventory_item_id = ii.id 
        AND ib_wh.storage_location_id = ${whLocParam}
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY p.name ASC;
    `;

    const rows = await this.queryRaw<any>(sql, ...params);

    // Group or dedup by product id (matching multi-variant / single-variant product view)
    const productMap = new Map<string, FormattedProductDTO>();
    for (const r of rows) {
      const isComposite = r.product_type === 'COMPOSITE' || Boolean(r.recipe_id);
      const stock = isComposite ? 99999 : Number(r.outlet_stock || 0);
      const minAlert = Number(r.min_stock_alert || 5);
      const variantObj = {
        id: r.variant_id,
        sku: r.sku,
        name: r.variant_name || 'Standar',
        price: Number(r.variant_price || 0),
        costPrice: Number(r.cost_price || 0),
      };

      if (!productMap.has(r.id)) {
        productMap.set(r.id, {
          id: r.id,
          name: r.name,
          description: r.description || null,
          sku: r.sku,
          barcode: r.barcode || null,
          unit: r.unit || 'PCS',
          basePrice: Number(r.variant_price || 0),
          price: Number(r.variant_price || 0),
          costPrice: Number(r.cost_price || 0),
          imageUrl: r.image_url || null,
          isActive: Boolean(r.is_active),
          category: r.category_id ? { id: r.category_id, name: r.category_name } : null,
          stock,
          warehouseStock: r.warehouse_stock !== null ? Number(r.warehouse_stock) : null,
          minStockAlert: minAlert,
          isLowStock: isComposite ? false : stock <= minAlert,
          productType: r.product_type || (isComposite ? 'COMPOSITE' : 'STANDARD'),
          hasStock: !isComposite,
          hasRecipe: Boolean(r.recipe_id),
          recipeId: r.recipe_id || null,
          isBundle: Number(r.bundle_items_count || 0) > 0,
          variants: [variantObj],
          createdAt: new Date(r.created_at),
        });
      } else {
        const existing = productMap.get(r.id)!;
        if (!existing.variants) {
          existing.variants = [];
        }
        if (!existing.variants.some((v) => v.id === r.variant_id)) {
          existing.variants.push(variantObj);
        }
      }
    }

    // Ambil modifier relasional untuk seluruh produk yang ditemukan
    const productIds = Array.from(productMap.keys());
    if (productIds.length > 0) {
      try {
        const pmgRows = await prisma.productModifierGroup.findMany({
          where: {
            productId: { in: productIds },
            tenantId,
          },
          include: {
            modifierGroup: {
              include: {
                items: {
                  orderBy: { createdAt: 'asc' },
                },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        });

        for (const pmg of pmgRows) {
          const prod = productMap.get(pmg.productId);
          if (prod && pmg.modifierGroup) {
            if (!prod.modifiers) {
              prod.modifiers = [];
            }
            prod.modifiers.push({
              id: pmg.modifierGroup.id,
              name: pmg.modifierGroup.name,
              type: pmg.modifierGroup.selectionType,
              required: pmg.modifierGroup.isRequired,
              options: pmg.modifierGroup.items.map((it: any) => ({
                id: it.id,
                name: it.name,
                priceDelta: Number(it.priceAdjustment) || 0,
                isDefault: it.isDefault,
              })),
            });
          }
        }

        // Ambil Price Tiers & Bundle Items untuk seluruh produk
        const [priceTierRows, bundleItemRows] = await Promise.all([
          prisma.productPriceTier.findMany({
            where: { productId: { in: productIds }, tenantId },
            orderBy: { minQuantity: 'asc' },
          }),
          prisma.productBundleItem.findMany({
            where: { bundleProductId: { in: productIds }, tenantId },
            select: {
              id: true,
              bundleProductId: true,
              quantity: true,
              childProductId: true,
              childVariantId: true,
              slotName: true,
              priceAdjustment: true,
              isDefault: true,
              childProduct: {
                select: {
                  id: true,
                  name: true,
                  unit: true,
                  type: true,
                  variants: {
                    where: { isActive: true },
                    select: {
                      id: true,
                      name: true,
                      recipe: { select: { id: true } },
                      inventoryItem: {
                        select: {
                          id: true,
                          balances: outletStorageLocationId
                            ? {
                                where: { storageLocationId: outletStorageLocationId },
                                select: { quantityOnHand: true },
                              }
                            : {
                                select: { quantityOnHand: true },
                              },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
        ]);

        for (const pt of priceTierRows) {
          const prod = productMap.get(pt.productId);
          if (prod) {
            if (!prod.priceTiers) prod.priceTiers = [];
            prod.priceTiers.push({
              id: pt.id,
              variantId: pt.variantId,
              minQuantity: pt.minQuantity,
              tierPrice: Number(pt.tierPrice),
            });
          }
        }

        // Kelompokkan bundle items per produk induk dan kalkulasi dynamic stock bottleneck
        const bundleItemsByProduct = new Map<string, any[]>();
        for (const bi of bundleItemRows) {
          if (!bundleItemsByProduct.has(bi.bundleProductId)) {
            bundleItemsByProduct.set(bi.bundleProductId, []);
          }
          bundleItemsByProduct.get(bi.bundleProductId)!.push(bi);
        }

        for (const [prodId, items] of bundleItemsByProduct.entries()) {
          const prod = productMap.get(prodId);
          if (!prod) continue;

          const {
            items: processedItems,
            limitStock,
            bottleneckItem,
            hasStock,
            bundleSlots,
            bundleSlotsCount,
          } = this.processBundleBottleneck(items, outletStorageLocationId);

          prod.bundleItems = processedItems;
          prod.bundleLimitStock = limitStock;
          prod.bundleBottleneckItem = bottleneckItem;
          prod.bundleSlots = bundleSlots;
          prod.bundleSlotsCount = bundleSlotsCount;

          if (limitStock !== null) {
            prod.stock = limitStock;
            prod.hasStock = hasStock;
            prod.isOutOfStock = limitStock <= 0;
            prod.isLowStock = limitStock <= prod.minStockAlert;
          }
        }
      } catch (err) {
        console.error('Error fetching relational product modifiers, price tiers, or bundles:', err);
      }
    }

    const formattedProducts = Array.from(productMap.values());
    return {
      data: formattedProducts,
      meta: {
        total: formattedProducts.length,
        outletId,
      },
    };
  }

  /**
   * Reads a single product detail from target schema.
   */
  public async getProductById(
    tenantId: string,
    productId: string,
    outletId?: string
  ): Promise<FormattedProductDTO | null> {
    let outletStorageLocationId: string | null = null;
    let warehouseStorageLocationId: string | null = null;

    if (outletId) {
      outletStorageLocationId = await this.resolveDefaultStorageLocation(tenantId, outletId);
    }
    warehouseStorageLocationId = await this.resolveWarehouseStorageLocation(tenantId);

    const params: any[] = [tenantId, productId];
    let outletLocParam = 'NULL::text';
    if (outletStorageLocationId) {
      params.push(outletStorageLocationId);
      outletLocParam = `$${params.length}::text`;
    }
    let whLocParam = 'NULL::text';
    if (warehouseStorageLocationId) {
      params.push(warehouseStorageLocationId);
      whLocParam = `$${params.length}::text`;
    }

    const sql = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.image_url,
        p.is_active,
        p.unit,
        p.type as product_type,
        p.created_at,
        c.id as category_id,
        c.name as category_name,
        pv.id as variant_id,
        pv.name as variant_name,
        pv.sku,
        pv.barcode,
        pv.price as variant_price,
        r.id as recipe_id,
        COALESCE(rc.recipe_cogs, ii.average_cost, 0) as cost_price,
        COALESCE(ib_outlet.quantity_on_hand, 0) as outlet_stock,
        COALESCE(ib_wh.quantity_on_hand, NULL) as warehouse_stock,
        COALESCE(ii.reorder_point, 5) as min_stock_alert
      FROM "products" p
      LEFT JOIN "categories" c ON c.id = p.category_id
      JOIN "product_variants" pv ON pv.product_id = p.id
      LEFT JOIN "recipes" r ON r.product_variant_id = pv.id
      LEFT JOIN (
        SELECT 
          r_sub.product_variant_id,
          SUM(ri.quantity * ii_sub.average_cost) as recipe_cogs
        FROM "recipes" r_sub
        JOIN "recipe_items" ri ON ri.recipe_id = r_sub.id
        JOIN "inventory_items" ii_sub ON ii_sub.id = ri.inventory_item_id
        GROUP BY r_sub.product_variant_id
      ) rc ON rc.product_variant_id = pv.id
      LEFT JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id
      LEFT JOIN "inventory_balances" ib_outlet 
        ON ib_outlet.inventory_item_id = ii.id 
        AND ib_outlet.storage_location_id = ${outletLocParam}
      LEFT JOIN "inventory_balances" ib_wh 
        ON ib_wh.inventory_item_id = ii.id 
        AND ib_wh.storage_location_id = ${whLocParam}
      WHERE p.tenant_id = $1 AND p.id = $2
      LIMIT 1;
    `;

    const rows = await this.queryRaw<any>(sql, ...params);
    if (!rows || rows.length === 0) return null;

    const r = rows[0];
    const isComposite = r.product_type === 'COMPOSITE' || Boolean(r.recipe_id);
    const stock = isComposite ? 99999 : Number(r.outlet_stock || 0);
    const minAlert = Number(r.min_stock_alert || 5);

    let modifiers: any[] = [];
    try {
      const pmgRows = await prisma.productModifierGroup.findMany({
        where: {
          productId: r.id,
          tenantId,
        },
        include: {
          modifierGroup: {
            include: {
              items: {
                orderBy: { createdAt: 'asc' },
              },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      });

      modifiers = pmgRows.map((pmg) => ({
        id: pmg.modifierGroup.id,
        name: pmg.modifierGroup.name,
        type: pmg.modifierGroup.selectionType,
        required: pmg.modifierGroup.isRequired,
        options: pmg.modifierGroup.items.map((it) => ({
          id: it.id,
          name: it.name,
          priceDelta: Number(it.priceAdjustment) || 0,
          isDefault: it.isDefault,
        })),
      }));
    } catch (err) {
      console.error('Error fetching relational product modifiers in getProductById:', err);
    }

    const variants = [
      {
        id: r.variant_id,
        sku: r.sku,
        name: r.variant_name || 'Standar',
        price: Number(r.variant_price || 0),
        costPrice: Number(r.cost_price || 0),
      },
    ];

    // Ambil price tiers & bundle items jika ada
    let priceTiers: { id: string; variantId?: string | null; minQuantity: number; tierPrice: number }[] = [];
    let bundleItems: any[] = [];
    let bundleSlots: any[] = [];
    let bundleSlotsCount = 0;
    let bundleLimitStock: number | null = null;
    let bundleBottleneckItem: string | null = null;
    let finalStock = stock;
    let finalHasStock = !isComposite;
    let finalIsOutOfStock = isComposite ? false : stock <= 0;
    let finalIsLowStock = isComposite ? false : stock <= minAlert;

    try {
      const [ptRows, biRows] = await Promise.all([
        prisma.productPriceTier.findMany({
          where: { productId: r.id, tenantId },
          orderBy: { minQuantity: 'asc' },
        }),
        prisma.productBundleItem.findMany({
          where: { bundleProductId: r.id, tenantId },
          select: {
            id: true,
            bundleProductId: true,
            quantity: true,
            childProductId: true,
            childVariantId: true,
            slotName: true,
            priceAdjustment: true,
            isDefault: true,
            childProduct: {
              select: {
                id: true,
                name: true,
                unit: true,
                type: true,
                variants: {
                  where: { isActive: true },
                  select: {
                    id: true,
                    name: true,
                    recipe: { select: { id: true } },
                    inventoryItem: {
                      select: {
                        id: true,
                        balances: outletStorageLocationId
                          ? {
                              where: { storageLocationId: outletStorageLocationId },
                              select: { quantityOnHand: true },
                            }
                          : {
                              select: { quantityOnHand: true },
                            },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      ]);
      priceTiers = ptRows.map((pt) => ({
        id: pt.id,
        variantId: pt.variantId,
        minQuantity: pt.minQuantity,
        tierPrice: Number(pt.tierPrice),
      }));

      if (biRows.length > 0) {
        const bottleneckRes = this.processBundleBottleneck(biRows, outletStorageLocationId);
        bundleItems = bottleneckRes.items;
        bundleLimitStock = bottleneckRes.limitStock;
        bundleBottleneckItem = bottleneckRes.bottleneckItem;
        bundleSlots = bottleneckRes.bundleSlots;
        bundleSlotsCount = bottleneckRes.bundleSlotsCount;

        if (bundleLimitStock !== null) {
          finalStock = bundleLimitStock;
          finalHasStock = bottleneckRes.hasStock;
          finalIsOutOfStock = bundleLimitStock <= 0;
          finalIsLowStock = bundleLimitStock <= minAlert;
        }
      }
    } catch (e) {
      console.error('Error fetching tiers/bundle in getProductById:', e);
    }

    return {
      id: r.id,
      name: r.name,
      description: r.description || null,
      sku: r.sku,
      barcode: r.barcode || null,
      unit: r.unit || 'PCS',
      basePrice: Number(r.variant_price || 0),
      price: Number(r.variant_price || 0),
      costPrice: Number(r.cost_price || 0),
      imageUrl: r.image_url || null,
      isActive: Boolean(r.is_active),
      category: r.category_id ? { id: r.category_id, name: r.category_name } : null,
      stock: finalStock,
      warehouseStock: r.warehouse_stock !== null ? Number(r.warehouse_stock) : null,
      minStockAlert: minAlert,
      isLowStock: finalIsLowStock,
      productType: r.product_type || (isComposite ? 'COMPOSITE' : 'STANDARD'),
      hasStock: finalHasStock,
      hasRecipe: Boolean(r.recipe_id),
      recipeId: r.recipe_id || null,
      isBundle: bundleItems.length > 0,
      bundleLimitStock,
      bundleBottleneckItem,
      bundleSlotsCount,
      bundleSlots,
      modifiers,
      variants,
      priceTiers,
      bundleItems,
      createdAt: new Date(r.created_at),
    };
  }

  /**
   * Helper internal untuk memproses dynamic stock bottleneck dari produk komposit bundle.
   */
  private processBundleBottleneck(
    bundleItems: any[],
    outletStorageLocationId: string | null
  ): {
    items: {
      id: string;
      childProductId: string;
      childProductName: string;
      childUnit: string;
      quantity: number;
      slotName?: string | null;
      priceAdjustment?: number;
      isDefault?: boolean;
      childStock?: number;
      isRecipe: boolean;
      maxBundleUnits: number;
      isBottleneck: boolean;
    }[];
    limitStock: number | null;
    bottleneckItem: string | null;
    hasStock: boolean;
    bundleSlotsCount: number;
    bundleSlots: {
      slotName: string;
      items: {
        id: string;
        childProductId: string;
        childProductName: string;
        childUnit: string;
        quantity: number;
        priceAdjustment: number;
        isDefault: boolean;
        childStock?: number;
        isRecipe?: boolean;
        isOutOfStock?: boolean;
      }[];
    }[];
  } {
    const processedItems: {
      id: string;
      childProductId: string;
      childProductName: string;
      childUnit: string;
      quantity: number;
      slotName?: string | null;
      priceAdjustment?: number;
      isDefault?: boolean;
      childStock?: number;
      isRecipe: boolean;
      maxBundleUnits: number;
      isBottleneck: boolean;
    }[] = [];

    for (const bi of bundleItems) {
      const child = bi.childProduct;
      const childVariants = child?.variants || [];
      const matchedVariant = bi.childVariantId
        ? childVariants.find((v: any) => v.id === bi.childVariantId)
        : childVariants[0];

      const isRecipe = Boolean(matchedVariant?.recipe?.id);
      let childStock = 0;
      let maxBundleUnits = 99999;

      if (!isRecipe) {
        const balances = matchedVariant?.inventoryItem?.balances || [];
        childStock = balances.reduce((sum: number, b: any) => sum + Number(b.quantityOnHand || 0), 0);
        const ratio = Math.max(0.0001, Number(bi.quantity || 1));
        maxBundleUnits = Math.floor(Math.max(0, childStock) / ratio);
      }

      processedItems.push({
        id: bi.id,
        childProductId: bi.childProductId,
        childProductName: child?.name || 'Komponen',
        childUnit: child?.unit || 'Pcs',
        quantity: Number(bi.quantity),
        slotName: bi.slotName || null,
        priceAdjustment: Number(bi.priceAdjustment || 0),
        isDefault: Boolean(bi.isDefault),
        childStock: isRecipe ? undefined : childStock,
        isRecipe,
        maxBundleUnits,
        isBottleneck: false,
      });
    }

    // Kelompokkan slot dinamis (mix & match)
    const slotsMap = new Map<string, any[]>();
    for (const it of processedItems) {
      if (it.slotName && it.slotName.trim() !== '') {
        const sName = it.slotName.trim();
        if (!slotsMap.has(sName)) slotsMap.set(sName, []);
        slotsMap.get(sName)!.push({
          id: it.id,
          childProductId: it.childProductId,
          childProductName: it.childProductName,
          childUnit: it.childUnit,
          quantity: it.quantity,
          priceAdjustment: it.priceAdjustment || 0,
          isDefault: Boolean(it.isDefault),
          childStock: it.childStock,
          isRecipe: it.isRecipe,
          isOutOfStock: !it.isRecipe && (it.childStock !== undefined && it.childStock < it.quantity),
        });
      }
    }

    const bundleSlots = Array.from(slotsMap.entries()).map(([slotName, slotItems]) => ({
      slotName,
      items: slotItems,
    }));
    const bundleSlotsCount = bundleSlots.length;

    // Evaluasi bottleneck fisik (fixed vs slot)
    const fixedPhysicalItems = processedItems.filter((it) => !it.isRecipe && (!it.slotName || it.slotName.trim() === ''));
    const slotPhysicalGroups = Array.from(slotsMap.values()).map((slotGroup) =>
      slotGroup.filter((item) => !item.isRecipe)
    );

    // Jika seluruh komponen (fixed maupun slot) adalah resep masakan, stock limit = null
    const allPhysical = processedItems.filter((it) => !it.isRecipe);
    if (allPhysical.length === 0) {
      return {
        items: processedItems,
        limitStock: null,
        bottleneckItem: null,
        hasStock: false,
        bundleSlotsCount,
        bundleSlots,
      };
    }

    let minUnits = 99999;
    let bottleneckItem: string | null = null;

    // 1. Cek fixed components bottleneck
    for (const fp of fixedPhysicalItems) {
      if (fp.maxBundleUnits < minUnits) {
        minUnits = fp.maxBundleUnits;
        bottleneckItem = fp.childProductName;
      }
    }

    // 2. Cek slot components bottleneck (kapasitas slot = opsi max tersedia dalam slot tsb)
    for (const slotGroup of slotPhysicalGroups) {
      if (slotGroup.length > 0) {
        const slotMaxUnits = Math.max(...slotGroup.map((it) => {
          const matchingProcessed = processedItems.find((p) => p.id === it.id);
          return matchingProcessed ? matchingProcessed.maxBundleUnits : 0;
        }));
        if (slotMaxUnits < minUnits) {
          minUnits = slotMaxUnits;
          bottleneckItem = `Pilihan Slot`;
        }
      }
    }

    if (minUnits === 99999) {
      minUnits = 0;
    }

    // Tandai isBottleneck pada item yang membatasi
    const bottleneck = fixedPhysicalItems.find((it) => it.maxBundleUnits === minUnits);
    if (bottleneck) {
      bottleneck.isBottleneck = true;
    }

    return {
      items: processedItems,
      limitStock: Math.max(0, minUnits),
      bottleneckItem,
      hasStock: true,
      bundleSlotsCount,
      bundleSlots,
    };
  }

  /**
   * Reads categories with active product counts from target schema.
   */
  public async getCategories(
    tenantId: string,
    outletId?: string,
    isActive?: string | boolean,
    hasProductsOnly?: boolean
  ): Promise<FormattedCategoryDTO[]> {
    const params: any[] = [tenantId];
    let productFilter = `p.tenant_id = $1`;

    if (isActive === 'true' || isActive === true) {
      params.push(true);
      productFilter += ` AND p.is_active = $${params.length}`;
    } else if (isActive === 'false' || isActive === false) {
      params.push(false);
      productFilter += ` AND p.is_active = $${params.length}`;
    }

    let outletCategoryFilter = '';
    if (outletId) {
      params.push(outletId);
      const outletIdx = params.length;
      productFilter += ` AND EXISTS (
        SELECT 1 FROM "outlet_products" op 
        WHERE op.product_id = p.id 
          AND op.outlet_id = $${outletIdx} 
          AND op.is_available = true
      )`;
      if (hasProductsOnly) {
        outletCategoryFilter = ` AND EXISTS (
          SELECT 1 FROM "products" p_cat
          JOIN "outlet_products" op_cat ON op_cat.product_id = p_cat.id AND op_cat.outlet_id = $${outletIdx} AND op_cat.is_available = true
          WHERE p_cat.category_id = c.id AND p_cat.is_active = true
        )`;
      }
    }

    const sql = `
      SELECT 
        c.id,
        c.name,
        COUNT(DISTINCT p.id) as product_count
      FROM "categories" c
      LEFT JOIN "products" p ON p.category_id = c.id AND ${productFilter}
      WHERE c.tenant_id = $1 ${outletCategoryFilter}
      GROUP BY c.id, c.name
      ORDER BY c.name ASC;
    `;

    const rows = await this.queryRaw<any>(sql, ...params);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      productCount: Number(r.product_count || 0),
    }));
  }
}

export const catalogReadAdapter = new CatalogReadAdapter();
