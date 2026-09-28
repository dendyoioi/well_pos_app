import * as crypto from 'crypto';
import { BaseDualWriteService } from './base.dual_write.service';
import {
  CreateProductDTO,
  UpdateProductDTO,
  DualWriteContext,
  DualWriteResult,
} from './types';

/**
 * CatalogDualWriteService
 * Synchronizes Catalog mutations (Product, Category, Variant, InventoryItem)
 * between legacy and target schemas using Parameterized Raw SQL (OD-14.1-02).
 * Adheres to OD-14.1-01 (Strict Fail-Closed for Master Data).
 */
export class CatalogDualWriteService extends BaseDualWriteService {
  /**
   * Creates a product in both legacy and target schemas inside the active transaction.
   */
  public async createProduct(
    dto: CreateProductDTO,
    ctx: DualWriteContext
  ): Promise<DualWriteResult<any>> {
    const { tx, tenantId } = ctx;

    try {
      const actorUserId = await this.resolveActorUserId(tx, tenantId, ctx.actorUserId);
      const productId = crypto.randomUUID();

      const sku = (dto.sku && dto.sku.trim() !== '')
        ? dto.sku.trim()
        : `SKU-${productId.substring(0, 8).toUpperCase()}`;

      const barcode = (dto.barcode && dto.barcode.trim() !== '')
        ? dto.barcode.trim()
        : `BC-${productId.substring(0, 8).toUpperCase()}`;
      const unit = dto.unit || 'Pcs';
      const costPrice = Number(dto.costPrice) || 0;
      const basePrice = Number(dto.basePrice) || 0;
      const initialStock = Number(dto.initialStock) || 0;
      const minStockAlert = Number(dto.minStockAlert) || 5;

      // 1. MUTATION VIA PARAMETERIZED RAW SQL (Adaptive to Cutover / Contract Target-Only)
      if (this.isTargetOnlyWrite()) {
        await this.executeRaw(
          tx,
          `INSERT INTO "products" (
            "id", "tenant_id", "category_id", "name", "sku", "description", "image_url",
            "unit", "is_active", "created_at", "updated_at"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          );`,
          productId,
          tenantId,
          dto.categoryId,
          dto.name,
          sku,
          dto.description || null,
          dto.imageUrl || null,
          unit
        );
      } else {
        await this.executeRaw(
          tx,
          `INSERT INTO "products" (
            "id", "tenant_id", "category_id", "name", "sku", "barcode", "description", "image_url",
            "cost_price", "base_price", "unit", "is_active", "created_at", "updated_at"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          );`,
          productId,
          tenantId,
          dto.categoryId,
          dto.name,
          sku,
          barcode,
          dto.description || null,
          dto.imageUrl || null,
          costPrice,
          basePrice,
          unit
        );
      }

      // Legacy outlet_products allocation (Skipped in TARGET_ONLY / Contract Phase)
      if (!this.isTargetOnlyWrite()) {
        const outletProductId = crypto.randomUUID();
        await this.executeRaw(
          tx,
          `INSERT INTO "outlet_products" (
            "id", "outlet_id", "product_id", "stock", "price", "min_stock_alert", "created_at", "updated_at"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT ("outlet_id", "product_id") DO UPDATE SET
            "stock" = EXCLUDED."stock",
            "price" = EXCLUDED."price",
            "min_stock_alert" = EXCLUDED."min_stock_alert",
            "updated_at" = CURRENT_TIMESTAMP;`,
          outletProductId,
          dto.outletId,
          productId,
          initialStock,
          basePrice,
          minStockAlert
        );
      }

      // Legacy stock_movements if initialStock > 0 (Skipped in TARGET_ONLY / Contract Phase)
      if (!this.isTargetOnlyWrite() && initialStock > 0) {
        const movementId = crypto.randomUUID();
        await this.executeRaw(
          tx,
          `INSERT INTO "stock_movements" (
            "id", "outlet_id", "product_id", "user_id", "type", "quantity", "notes", "created_at"
          ) VALUES (
            $1, $2, $3, $4, 'PURCHASE'::"StockMovementType", $5, $6, CURRENT_TIMESTAMP
          );`,
          movementId,
          dto.outletId,
          productId,
          actorUserId,
          initialStock,
          'Saldo stok awal pembuatan produk'
        );
      }

      // 2. TARGET SCHEMA MUTATION (Deterministic UUIDs & Core Logistics)
      const inventoryItemId = this.generateDeterministicUuid(`${productId}:inventory_item`);
      const variantId = this.generateDeterministicUuid(`${productId}:variant`);
      const storageLocationId = await this.resolveDefaultStorageLocation(tx, tenantId, dto.outletId);
      const balanceId = this.generateDeterministicUuid(`${inventoryItemId}:${storageLocationId}:unbatched_balance`);
      const itemCode = `${sku}-INV`;

      // A. Insert target inventory_items
      await this.executeRaw(
        tx,
        `INSERT INTO "inventory_items" (
          "id", "tenant_id", "item_code", "name", "description", "canonical_uom", "purchase_uom",
          "reorder_point", "target_level", "average_cost", "allow_negative_stock", "is_batched", "is_active",
          "created_at", "updated_at"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, null,
          $7, 0, $8, null, false, true,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("id") DO UPDATE SET
          "name" = EXCLUDED."name",
          "canonical_uom" = EXCLUDED."canonical_uom",
          "average_cost" = EXCLUDED."average_cost",
          "is_active" = EXCLUDED."is_active",
          "updated_at" = CURRENT_TIMESTAMP;`,
        inventoryItemId,
        tenantId,
        itemCode,
        dto.name,
        dto.description || null,
        unit,
        minStockAlert,
        costPrice
      );

      // B. Insert target product_variants (ADR-003 Multiplier = 1.000)
      await this.executeRaw(
        tx,
        `INSERT INTO "product_variants" (
          "id", "tenant_id", "product_id", "inventory_item_id", "sku", "barcode", "name",
          "price", "inventory_quantity_multiplier", "is_active", "created_at", "updated_at"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 'Default',
          $7, 1.000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("id") DO UPDATE SET
          "sku" = EXCLUDED."sku",
          "barcode" = EXCLUDED."barcode",
          "price" = EXCLUDED."price",
          "is_active" = EXCLUDED."is_active",
          "updated_at" = CURRENT_TIMESTAMP;`,
        variantId,
        tenantId,
        productId,
        inventoryItemId,
        sku,
        barcode,
        basePrice
      );

      // C. Insert target inventory_balances
      await this.executeRaw(
        tx,
        `INSERT INTO "inventory_balances" (
          "id", "tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id",
          "quantity_on_hand", "quantity_reserved", "updated_at"
        ) VALUES ($1, $2, $3, $4, null, $5, 0, CURRENT_TIMESTAMP)
        ON CONFLICT ("id") DO UPDATE SET
          "quantity_on_hand" = EXCLUDED."quantity_on_hand",
          "updated_at" = CURRENT_TIMESTAMP;`,
        balanceId,
        tenantId,
        inventoryItemId,
        storageLocationId,
        initialStock
      );

      // D. Insert target inventory_ledgers if initialStock > 0
      let ledgerAffected = 0;
      if (initialStock > 0) {
        const ledgerId = this.generateDeterministicUuid(`${balanceId}:opening_ledger`);
        await this.executeRaw(
          tx,
          `INSERT INTO "inventory_ledgers" (
            "id", "tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id",
            "quantity_delta", "balance_before", "balance_after", "unit_cost",
            "movement_type", "reference_type", "reference_id",
            "actor_type", "actor_user_id", "is_negative_balance", "notes", "created_at"
          ) VALUES (
            $1, $2, $3, $4, null,
            $5, 0, $5, $6,
            'PURCHASE'::"StockMovementType", 'STOCK_OPNAME'::"InventoryRefType", $7,
            'USER'::"ActorType", $8, false, $9, CURRENT_TIMESTAMP
          )
          ON CONFLICT ("id") DO NOTHING;`,
          ledgerId,
          tenantId,
          inventoryItemId,
          storageLocationId,
          initialStock,
          costPrice,
          productId,
          actorUserId,
          'Saldo stok awal pembuatan produk'
        );
        ledgerAffected = 1;
      }

      return {
        legacyData: { id: productId, name: dto.name, sku, barcode, basePrice, costPrice, unit, initialStock },
        targetSynced: true,
        targetRecordsAffected: 3 + ledgerAffected,
        targetDetails: {
          productId,
          inventoryItemId,
          variantId,
          balanceId,
          storageLocationId,
        },
      };
    } catch (err: any) {
      if (ctx.strictAtomic !== false) {
        throw err;
      }
      await this.logEmergencyDrift({
        domain: 'CATALOG',
        operation: 'createProduct',
        tenantId,
        payload: dto,
        errorMessage: err.message,
        errorStack: err.stack,
        occurredAt: new Date(),
      });
      throw err;
    }
  }

  /**
   * Updates an existing product and synchronizes target variant and inventory item.
   */
  public async updateProduct(
    productId: string,
    dto: UpdateProductDTO,
    ctx: DualWriteContext
  ): Promise<DualWriteResult<any>> {
    const { tx, tenantId } = ctx;

    try {
      // 1. UPDATE VIA PARAMETERIZED RAW SQL (Adaptive to Cutover / Contract Target-Only)
      if (this.isTargetOnlyWrite()) {
        await this.executeRaw(
          tx,
          `UPDATE "products"
           SET "name" = COALESCE($1, "name"),
               "sku" = COALESCE($2, "sku"),
               "category_id" = COALESCE($3, "category_id"),
               "unit" = COALESCE($4, "unit"),
               "description" = COALESCE($5, "description"),
               "image_url" = COALESCE($6, "image_url"),
               "is_active" = COALESCE($7, "is_active"),
               "updated_at" = CURRENT_TIMESTAMP
           WHERE "id" = $8 AND "tenant_id" = $9;`,
          dto.name ?? null,
          dto.sku ?? null,
          dto.categoryId ?? null,
          dto.unit ?? null,
          dto.description ?? null,
          dto.imageUrl ?? null,
          dto.isActive ?? null,
          productId,
          tenantId
        );
      } else {
        await this.executeRaw(
          tx,
          `UPDATE "products"
           SET "name" = COALESCE($1, "name"),
               "barcode" = COALESCE($2, "barcode"),
               "sku" = COALESCE($3, "sku"),
               "category_id" = COALESCE($4, "category_id"),
               "cost_price" = COALESCE($5, "cost_price"),
               "base_price" = COALESCE($6, "base_price"),
               "unit" = COALESCE($7, "unit"),
               "description" = COALESCE($8, "description"),
               "image_url" = COALESCE($9, "image_url"),
               "is_active" = COALESCE($10, "is_active"),
               "updated_at" = CURRENT_TIMESTAMP
           WHERE "id" = $11 AND "tenant_id" = $12;`,
          dto.name ?? null,
          dto.barcode ?? null,
          dto.sku ?? null,
          dto.categoryId ?? null,
          dto.costPrice !== undefined ? Number(dto.costPrice) : null,
          dto.basePrice !== undefined ? Number(dto.basePrice) : null,
          dto.unit ?? null,
          dto.description ?? null,
          dto.imageUrl ?? null,
          dto.isActive ?? null,
          productId,
          tenantId
        );
      }

      if (!this.isTargetOnlyWrite() && dto.basePrice !== undefined) {
        await this.executeRaw(
          tx,
          `UPDATE "outlet_products"
           SET "price" = $1, "updated_at" = CURRENT_TIMESTAMP
           WHERE "product_id" = $2;`,
          Number(dto.basePrice),
          productId
        );
      }

      // 2. TARGET SYNCHRONIZATION
      const inventoryItemId = this.generateDeterministicUuid(`${productId}:inventory_item`);
      const variantId = this.generateDeterministicUuid(`${productId}:variant`);

      let targetUpdates = 0;

      targetUpdates += await this.executeRaw(
        tx,
        `UPDATE "inventory_items"
         SET "name" = COALESCE($1, "name"),
             "canonical_uom" = COALESCE($2, "canonical_uom"),
             "average_cost" = COALESCE($3, "average_cost"),
             "is_active" = COALESCE($4, "is_active"),
             "updated_at" = CURRENT_TIMESTAMP
         WHERE "id" = $5 AND "tenant_id" = $6;`,
        dto.name ?? null,
        dto.unit ?? null,
        dto.costPrice !== undefined ? Number(dto.costPrice) : null,
        dto.isActive ?? null,
        inventoryItemId,
        tenantId
      );

      targetUpdates += await this.executeRaw(
        tx,
        `UPDATE "product_variants"
         SET "sku" = COALESCE($1, "sku"),
             "barcode" = COALESCE($2, "barcode"),
             "price" = COALESCE($3, "price"),
             "is_active" = COALESCE($4, "is_active"),
             "updated_at" = CURRENT_TIMESTAMP
         WHERE "id" = $5 AND "tenant_id" = $6;`,
        dto.sku ?? null,
        dto.barcode ?? null,
        dto.basePrice !== undefined ? Number(dto.basePrice) : null,
        dto.isActive ?? null,
        variantId,
        tenantId
      );

      return {
        legacyData: { id: productId, ...dto },
        targetSynced: true,
        targetRecordsAffected: targetUpdates,
        targetDetails: { inventoryItemId, variantId },
      };
    } catch (err: any) {
      if (ctx.strictAtomic !== false) {
        throw err;
      }
      await this.logEmergencyDrift({
        domain: 'CATALOG',
        operation: 'updateProduct',
        tenantId,
        entityId: productId,
        payload: dto,
        errorMessage: err.message,
        errorStack: err.stack,
        occurredAt: new Date(),
      });
      throw err;
    }
  }

  /**
   * Soft-deletes a product and deactivates target entities.
   */
  public async deleteProduct(
    productId: string,
    ctx: DualWriteContext
  ): Promise<DualWriteResult<any>> {
    const { tx, tenantId } = ctx;

    try {
      // 1. LEGACY SOFT DELETE
      await this.executeRaw(
        tx,
        `UPDATE "products" SET "is_active" = false, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $1 AND "tenant_id" = $2;`,
        productId,
        tenantId
      );

      // 2. TARGET DEACTIVATION
      const inventoryItemId = this.generateDeterministicUuid(`${productId}:inventory_item`);
      const variantId = this.generateDeterministicUuid(`${productId}:variant`);

      await this.executeRaw(
        tx,
        `UPDATE "product_variants" SET "is_active" = false, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $1 AND "tenant_id" = $2;`,
        variantId,
        tenantId
      );

      await this.executeRaw(
        tx,
        `UPDATE "inventory_items" SET "is_active" = false, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $1 AND "tenant_id" = $2;`,
        inventoryItemId,
        tenantId
      );

      return {
        legacyData: { id: productId, isActive: false },
        targetSynced: true,
        targetRecordsAffected: 2,
        targetDetails: { inventoryItemId, variantId },
      };
    } catch (err: any) {
      if (ctx.strictAtomic !== false) {
        throw err;
      }
      await this.logEmergencyDrift({
        domain: 'CATALOG',
        operation: 'deleteProduct',
        tenantId,
        entityId: productId,
        payload: { productId },
        errorMessage: err.message,
        errorStack: err.stack,
        occurredAt: new Date(),
      });
      throw err;
    }
  }
}
