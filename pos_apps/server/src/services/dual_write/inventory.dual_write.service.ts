import * as crypto from 'crypto';
import { BaseDualWriteService } from './base.dual_write.service';
import {
  StockInDTO,
  StockOutDTO,
  StockAdjustmentDTO,
  StockTransferDTO,
  DualWriteContext,
  DualWriteResult,
} from './types';

/**
 * InventoryDualWriteService
 * Handles Stock In, Stock Out, Stock Opname, and Stock Transfer mutations.
 * Enforces row-level locking concurrency and ADR-002 Negative Stock policy.
 * Adheres to OD-14.1-01 (Strict Fail-Closed for Inventory Movements)
 * and OD-14.1-02 (Parameterized Raw SQL data access).
 */
export class InventoryDualWriteService extends BaseDualWriteService {
  /**
   * Records incoming stock (penerimaan barang / PO) in legacy and target ledgers.
   */
  public async recordStockIn(
    dto: StockInDTO,
    ctx: DualWriteContext
  ): Promise<DualWriteResult<any>> {
    const { tx, tenantId } = ctx;

    try {
      const actorUserId = await this.resolveActorUserId(tx, tenantId, ctx.actorUserId);

      // 1. LEGACY MUTATION VIA PARAMETERIZED RAW SQL (Skipped in TARGET_ONLY mode)
      let movementId: string | null = null;
      if (!this.isTargetOnlyWrite()) {
        const outletProductId = crypto.randomUUID();
        await this.executeRaw(
          tx,
          `INSERT INTO "outlet_products" (
            "id", "outlet_id", "product_id", "stock", "price", "min_stock_alert", "created_at", "updated_at"
          ) VALUES (
            $1, $2, $3, $4, 0, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT ("outlet_id", "product_id") DO UPDATE SET
            "stock" = "outlet_products"."stock" + EXCLUDED."stock",
            "updated_at" = CURRENT_TIMESTAMP;`,
          outletProductId,
          dto.outletId,
          dto.productId,
          dto.quantity
        );

        if (dto.newCostPrice !== undefined && dto.newCostPrice !== null) {
          await this.executeRaw(
            tx,
            `UPDATE "products" SET "cost_price" = $1, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $2;`,
            Number(dto.newCostPrice),
            dto.productId
          );
        }

        movementId = crypto.randomUUID();
        await this.executeRaw(
          tx,
          `INSERT INTO "stock_movements" (
            "id", "outlet_id", "product_id", "user_id", "type", "quantity", "notes", "created_at"
          ) VALUES (
            $1, $2, $3, $4, 'PURCHASE'::"StockMovementType", $5, $6, CURRENT_TIMESTAMP
          );`,
          movementId,
          dto.outletId,
          dto.productId,
          actorUserId,
          dto.quantity,
          dto.notes || `Stock In via PO: ${dto.poNumber || 'N/A'}`
        );
      }

      // 2. TARGET MUTATION (Concurrency Lock & Ledger Append)
      const inventoryItemId = this.generateDeterministicUuid(`${dto.productId}:inventory_item`);
      const storageLocationId = await this.resolveDefaultStorageLocation(tx, tenantId, dto.outletId);
      const balanceId = this.generateDeterministicUuid(`${inventoryItemId}:${storageLocationId}:unbatched_balance`);

      // Ensure target inventory_item exists
      const itemCheck = await this.queryRaw<{ id: string }>(
        tx,
        `SELECT id FROM "inventory_items" WHERE id = $1;`,
        inventoryItemId
      );
      if (itemCheck.length === 0) {
        const pRows = await this.queryRaw<{ name: string; sku: string; unit: string; cost_price: string }>(
          tx,
          `SELECT name, sku, unit, cost_price FROM "products" WHERE id = $1;`,
          dto.productId
        );
        const p = pRows[0];
        const sku = p?.sku || `SKU-${dto.productId.substring(0, 8).toUpperCase()}`;
        await this.executeRaw(
          tx,
          `INSERT INTO "inventory_items" (
            "id", "tenant_id", "item_code", "name", "canonical_uom", "average_cost", "allow_negative_stock", "is_batched", "is_active", "created_at", "updated_at"
          ) VALUES ($1, $2, $3, $4, $5, $6, null, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT ("id") DO NOTHING;`,
          inventoryItemId,
          tenantId,
          `${sku}-INV`,
          p?.name || 'Item',
          p?.unit || 'Pcs',
          Number(dto.newCostPrice ?? p?.cost_price ?? 0)
        );
      }

      // Ensure balance row exists
      await this.executeRaw(
        tx,
        `INSERT INTO "inventory_balances" (
          "id", "tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id",
          "quantity_on_hand", "quantity_reserved", "updated_at"
        ) VALUES ($1, $2, $3, $4, null, 0, 0, CURRENT_TIMESTAMP)
        ON CONFLICT ("id") DO NOTHING;`,
        balanceId,
        tenantId,
        inventoryItemId,
        storageLocationId
      );

      // Pessimistic Row Lock
      const balanceRows = await this.queryRaw<{ quantity_on_hand: string | number }>(
        tx,
        `SELECT quantity_on_hand FROM "inventory_balances" WHERE "id" = $1 FOR UPDATE;`,
        balanceId
      );

      const balanceBefore = Number(balanceRows[0]?.quantity_on_hand || 0);
      const balanceAfter = balanceBefore + dto.quantity;

      // Update balance
      await this.executeRaw(
        tx,
        `UPDATE "inventory_balances"
         SET "quantity_on_hand" = $1, "updated_at" = CURRENT_TIMESTAMP
         WHERE "id" = $2;`,
        balanceAfter,
        balanceId
      );

      if (dto.newCostPrice !== undefined && dto.newCostPrice !== null) {
        await this.executeRaw(
          tx,
          `UPDATE "inventory_items"
           SET "average_cost" = $1, "updated_at" = CURRENT_TIMESTAMP
           WHERE "id" = $2 AND "tenant_id" = $3;`,
          Number(dto.newCostPrice),
          inventoryItemId,
          tenantId
        );
      }

      // Fetch unit cost
      const itemRows = await this.queryRaw<{ average_cost: string | number }>(
        tx,
        `SELECT average_cost FROM "inventory_items" WHERE "id" = $1;`,
        inventoryItemId
      );
      const unitCost = Number(dto.newCostPrice ?? itemRows[0]?.average_cost ?? 0);

      // Append ledger entry
      const ledgerId = this.generateDeterministicUuid(`${balanceId}:${Date.now()}:stock_in`);
      await this.executeRaw(
        tx,
        `INSERT INTO "inventory_ledgers" (
          "id", "tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id",
          "quantity_delta", "balance_before", "balance_after", "unit_cost",
          "movement_type", "reference_type", "reference_id",
          "actor_type", "actor_user_id", "is_negative_balance", "notes", "created_at"
        ) VALUES (
          $1, $2, $3, $4, null,
          $5, $6, $7, $8,
          'PURCHASE'::"StockMovementType", 'PURCHASE_ORDER'::"InventoryRefType", $9,
          'USER'::"ActorType", $10, false, $11, CURRENT_TIMESTAMP
        );`,
        ledgerId,
        tenantId,
        inventoryItemId,
        storageLocationId,
        dto.quantity,
        balanceBefore,
        balanceAfter,
        unitCost,
        dto.poNumber || 'STOCK-IN',
        actorUserId,
        dto.notes || 'Penerimaan stok barang baru'
      );

      return {
        legacyData: { productId: dto.productId, quantity: dto.quantity, movementId },
        targetSynced: true,
        targetRecordsAffected: 2,
        targetDetails: { balanceId, balanceBefore, balanceAfter, ledgerId },
      };
    } catch (err: any) {
      if (ctx.strictAtomic !== false) {
        throw err;
      }
      await this.logEmergencyDrift({
        domain: 'INVENTORY',
        operation: 'recordStockIn',
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
   * Records outgoing stock (damage, wastage, disposal) with ADR-002 Negative Stock verification.
   */
  public async recordStockOut(
    dto: StockOutDTO,
    ctx: DualWriteContext
  ): Promise<DualWriteResult<any>> {
    const { tx, tenantId } = ctx;

    try {
      const actorUserId = await this.resolveActorUserId(tx, tenantId, ctx.actorUserId);
      const inventoryItemId = this.generateDeterministicUuid(`${dto.productId}:inventory_item`);
      const storageLocationId = await this.resolveDefaultStorageLocation(tx, tenantId, dto.outletId);
      const balanceId = this.generateDeterministicUuid(`${inventoryItemId}:${storageLocationId}:unbatched_balance`);

      // Ensure target inventory_item exists
      const itemCheck = await this.queryRaw<{ id: string }>(
        tx,
        `SELECT id FROM "inventory_items" WHERE id = $1;`,
        inventoryItemId
      );
      if (itemCheck.length === 0) {
        const pRows = await this.queryRaw<{ name: string; sku: string; unit: string; cost_price: string }>(
          tx,
          `SELECT name, sku, unit, cost_price FROM "products" WHERE id = $1;`,
          dto.productId
        );
        const p = pRows[0];
        const sku = p?.sku || `SKU-${dto.productId.substring(0, 8).toUpperCase()}`;
        await this.executeRaw(
          tx,
          `INSERT INTO "inventory_items" (
            "id", "tenant_id", "item_code", "name", "canonical_uom", "average_cost", "allow_negative_stock", "is_batched", "is_active", "created_at", "updated_at"
          ) VALUES ($1, $2, $3, $4, $5, $6, null, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT ("id") DO NOTHING;`,
          inventoryItemId,
          tenantId,
          `${sku}-INV`,
          p?.name || 'Item',
          p?.unit || 'Pcs',
          Number(p?.cost_price || 0)
        );
      }

      // Ensure balance row exists
      await this.executeRaw(
        tx,
        `INSERT INTO "inventory_balances" (
          "id", "tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id",
          "quantity_on_hand", "quantity_reserved", "updated_at"
        ) VALUES ($1, $2, $3, $4, null, 0, 0, CURRENT_TIMESTAMP)
        ON CONFLICT ("id") DO NOTHING;`,
        balanceId,
        tenantId,
        inventoryItemId,
        storageLocationId
      );

      // Pessimistic Row Lock
      const balanceRows = await this.queryRaw<{ quantity_on_hand: string | number }>(
        tx,
        `SELECT quantity_on_hand FROM "inventory_balances" WHERE "id" = $1 FOR UPDATE;`,
        balanceId
      );

      const balanceBefore = Number(balanceRows[0]?.quantity_on_hand || 0);
      const balanceAfter = balanceBefore - dto.quantity;

      // ADR-002 Hierarchy Check if balance drops below zero
      if (balanceAfter < 0) {
        const allowNegative = await this.checkNegativeStockAllowed(
          tx,
          tenantId,
          storageLocationId,
          inventoryItemId
        );
        if (!allowNegative) {
          throw new Error(
            `Stok tidak mencukupi untuk stock-out. Tersedia: ${balanceBefore}, diminta keluar: ${dto.quantity}. Kebijakan stok negatif melarang saldo minus.`
          );
        }
      }

      // 1. LEGACY MUTATION (Skipped in TARGET_ONLY mode)
      let movementId: string | null = null;
      if (!this.isTargetOnlyWrite()) {
        await this.executeRaw(
          tx,
          `UPDATE "outlet_products"
           SET "stock" = "stock" - $1, "updated_at" = CURRENT_TIMESTAMP
           WHERE "outlet_id" = $2 AND "product_id" = $3;`,
          dto.quantity,
          dto.outletId,
          dto.productId
        );

        movementId = crypto.randomUUID();
        await this.executeRaw(
          tx,
          `INSERT INTO "stock_movements" (
            "id", "outlet_id", "product_id", "user_id", "type", "quantity", "notes", "created_at"
          ) VALUES (
            $1, $2, $3, $4, 'WASTE'::"StockMovementType", $5, $6, CURRENT_TIMESTAMP
          );`,
          movementId,
          dto.outletId,
          dto.productId,
          actorUserId,
          -dto.quantity,
          dto.notes || `Stock Out: ${dto.reason || 'Damage/Disposal'}`
        );
      }

      // 2. TARGET MUTATION
      await this.executeRaw(
        tx,
        `UPDATE "inventory_balances"
         SET "quantity_on_hand" = $1, "updated_at" = CURRENT_TIMESTAMP
         WHERE "id" = $2;`,
        balanceAfter,
        balanceId
      );

      const itemRows = await this.queryRaw<{ average_cost: string | number }>(
        tx,
        `SELECT average_cost FROM "inventory_items" WHERE "id" = $1;`,
        inventoryItemId
      );
      const unitCost = Number(itemRows[0]?.average_cost || 0);

      const ledgerId = this.generateDeterministicUuid(`${balanceId}:${Date.now()}:stock_out`);
      await this.executeRaw(
        tx,
        `INSERT INTO "inventory_ledgers" (
          "id", "tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id",
          "quantity_delta", "balance_before", "balance_after", "unit_cost",
          "movement_type", "reference_type", "reference_id",
          "actor_type", "actor_user_id", "is_negative_balance", "notes", "created_at"
        ) VALUES (
          $1, $2, $3, $4, null,
          $5, $6, $7, $8,
          'WASTE'::"StockMovementType", 'MANUAL'::"InventoryRefType", 'MANUAL-STOCK-OUT',
          'USER'::"ActorType", $9, $10, $11, CURRENT_TIMESTAMP
        );`,
        ledgerId,
        tenantId,
        inventoryItemId,
        storageLocationId,
        -dto.quantity,
        balanceBefore,
        balanceAfter,
        unitCost,
        actorUserId,
        balanceAfter < 0,
        dto.notes || `Stock Out: ${dto.reason || 'Damage/Disposal'}`
      );

      return {
        legacyData: { productId: dto.productId, quantity: -dto.quantity, movementId },
        targetSynced: true,
        targetRecordsAffected: 2,
        targetDetails: { balanceId, balanceBefore, balanceAfter, ledgerId },
      };
    } catch (err: any) {
      if (ctx.strictAtomic !== false) {
        throw err;
      }
      await this.logEmergencyDrift({
        domain: 'INVENTORY',
        operation: 'recordStockOut',
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
   * Records stock opname / physical adjustment, calibrating balances and appending audit ledger.
   */
  public async recordStockAdjustment(
    dto: StockAdjustmentDTO,
    ctx: DualWriteContext
  ): Promise<DualWriteResult<any>> {
    const { tx, tenantId } = ctx;

    try {
      const actorUserId = await this.resolveActorUserId(tx, tenantId, ctx.actorUserId);
      const inventoryItemId = this.generateDeterministicUuid(`${dto.productId}:inventory_item`);
      const storageLocationId = await this.resolveDefaultStorageLocation(tx, tenantId, dto.outletId);
      const balanceId = this.generateDeterministicUuid(`${inventoryItemId}:${storageLocationId}:unbatched_balance`);

      // Ensure target inventory_item exists
      const itemCheck = await this.queryRaw<{ id: string }>(
        tx,
        `SELECT id FROM "inventory_items" WHERE id = $1;`,
        inventoryItemId
      );
      if (itemCheck.length === 0) {
        const pRows = await this.queryRaw<{ name: string; sku: string; unit: string; cost_price: string }>(
          tx,
          `SELECT name, sku, unit, cost_price FROM "products" WHERE id = $1;`,
          dto.productId
        );
        const p = pRows[0];
        const sku = p?.sku || `SKU-${dto.productId.substring(0, 8).toUpperCase()}`;
        await this.executeRaw(
          tx,
          `INSERT INTO "inventory_items" (
            "id", "tenant_id", "item_code", "name", "canonical_uom", "average_cost", "allow_negative_stock", "is_batched", "is_active", "created_at", "updated_at"
          ) VALUES ($1, $2, $3, $4, $5, $6, null, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT ("id") DO NOTHING;`,
          inventoryItemId,
          tenantId,
          `${sku}-INV`,
          p?.name || 'Item',
          p?.unit || 'Pcs',
          Number(p?.cost_price || 0)
        );
      }

      // Ensure balance row exists
      await this.executeRaw(
        tx,
        `INSERT INTO "inventory_balances" (
          "id", "tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id",
          "quantity_on_hand", "quantity_reserved", "updated_at"
        ) VALUES ($1, $2, $3, $4, null, 0, 0, CURRENT_TIMESTAMP)
        ON CONFLICT ("id") DO NOTHING;`,
        balanceId,
        tenantId,
        inventoryItemId,
        storageLocationId
      );

      // Lock row
      const balanceRows = await this.queryRaw<{ quantity_on_hand: string | number }>(
        tx,
        `SELECT quantity_on_hand FROM "inventory_balances" WHERE "id" = $1 FOR UPDATE;`,
        balanceId
      );

      const balanceBefore = Number(balanceRows[0]?.quantity_on_hand || 0);
      const quantityDelta = dto.actualStock - balanceBefore;

      // 1. LEGACY MUTATION (Skipped in TARGET_ONLY mode)
      let movementId: string | null = null;
      if (!this.isTargetOnlyWrite()) {
        const outletProductId = crypto.randomUUID();
        await this.executeRaw(
          tx,
          `INSERT INTO "outlet_products" (
            "id", "outlet_id", "product_id", "stock", "price", "min_stock_alert", "created_at", "updated_at"
          ) VALUES (
            $1, $2, $3, $4, 0, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT ("outlet_id", "product_id") DO UPDATE SET
            "stock" = $4,
            "updated_at" = CURRENT_TIMESTAMP;`,
          outletProductId,
          dto.outletId,
          dto.productId,
          dto.actualStock
        );

        movementId = crypto.randomUUID();
        await this.executeRaw(
          tx,
          `INSERT INTO "stock_movements" (
            "id", "outlet_id", "product_id", "user_id", "type", "quantity", "notes", "created_at"
          ) VALUES (
            $1, $2, $3, $4, 'OPNAME_ADJUSTMENT'::"StockMovementType", $5, $6, CURRENT_TIMESTAMP
          );`,
          movementId,
          dto.outletId,
          dto.productId,
          actorUserId,
          quantityDelta,
          dto.notes || 'Stock Opname / Penyesuaian Saldo Fisik'
        );
      }

      // 2. TARGET MUTATION
      await this.executeRaw(
        tx,
        `UPDATE "inventory_balances"
         SET "quantity_on_hand" = $1, "updated_at" = CURRENT_TIMESTAMP
         WHERE "id" = $2;`,
        dto.actualStock,
        balanceId
      );

      const itemRows = await this.queryRaw<{ average_cost: string | number }>(
        tx,
        `SELECT average_cost FROM "inventory_items" WHERE "id" = $1;`,
        inventoryItemId
      );
      const unitCost = Number(itemRows[0]?.average_cost || 0);

      const ledgerId = this.generateDeterministicUuid(`${balanceId}:${Date.now()}:adjustment`);
      await this.executeRaw(
        tx,
        `INSERT INTO "inventory_ledgers" (
          "id", "tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id",
          "quantity_delta", "balance_before", "balance_after", "unit_cost",
          "movement_type", "reference_type", "reference_id",
          "actor_type", "actor_user_id", "is_negative_balance", "notes", "created_at"
        ) VALUES (
          $1, $2, $3, $4, null,
          $5, $6, $7, $8,
          'OPNAME_ADJUSTMENT'::"StockMovementType", 'STOCK_OPNAME'::"InventoryRefType", $9,
          'USER'::"ActorType", $10, $11, $12, CURRENT_TIMESTAMP
        );`,
        ledgerId,
        tenantId,
        inventoryItemId,
        storageLocationId,
        quantityDelta,
        balanceBefore,
        dto.actualStock,
        unitCost,
        `OPNAME-${Date.now()}`,
        actorUserId,
        dto.actualStock < 0,
        dto.notes || 'Penyesuaian stok opname fisik'
      );

      return {
        legacyData: { productId: dto.productId, actualStock: dto.actualStock, movementId },
        targetSynced: true,
        targetRecordsAffected: 2,
        targetDetails: { balanceId, balanceBefore, actualStock: dto.actualStock, quantityDelta, ledgerId },
      };
    } catch (err: any) {
      if (ctx.strictAtomic !== false) {
        throw err;
      }
      await this.logEmergencyDrift({
        domain: 'INVENTORY',
        operation: 'recordStockAdjustment',
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
   * Transfers stock between two branches with atomic dual-ledger emission.
   */
  public async transferStock(
    dto: StockTransferDTO,
    ctx: DualWriteContext
  ): Promise<DualWriteResult<any>> {
    const { tx, tenantId } = ctx;

    try {
      const actorUserId = await this.resolveActorUserId(tx, tenantId, ctx.actorUserId);
      const inventoryItemId = dto.inventoryItemId || (dto.productId ? this.generateDeterministicUuid(`${dto.productId}:inventory_item`) : null);
      if (!inventoryItemId) {
        throw new Error('Transfer stok membutuhkan inventoryItemId atau productId yang valid');
      }
      const sourceLocId = await this.resolveDefaultStorageLocation(tx, tenantId, dto.sourceOutletId);
      const targetLocId = await this.resolveDefaultStorageLocation(tx, tenantId, dto.targetOutletId);

      // 1. Ambil atau inisialisasi saldo di lokasi asal
      const existingSrcRows = await this.queryRaw<{ id: string; quantity_on_hand: string | number }>(
        tx,
        `SELECT id, quantity_on_hand FROM "inventory_balances"
         WHERE tenant_id = $1 AND inventory_item_id = $2 AND storage_location_id = $3 AND inventory_batch_id IS NULL
         FOR UPDATE;`,
        tenantId,
        inventoryItemId,
        sourceLocId
      );

      let sourceBalanceId: string;
      let srcBefore: number;
      if (existingSrcRows.length > 0) {
        sourceBalanceId = existingSrcRows[0].id;
        srcBefore = Number(existingSrcRows[0].quantity_on_hand || 0);
      } else {
        sourceBalanceId = this.generateDeterministicUuid(`${inventoryItemId}:${sourceLocId}:unbatched_balance`);
        srcBefore = 0;
        await this.executeRaw(
          tx,
          `INSERT INTO "inventory_balances" (
            "id", "tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id",
            "quantity_on_hand", "quantity_reserved", "updated_at"
          ) VALUES ($1, $2, $3, $4, null, 0, 0, CURRENT_TIMESTAMP);`,
          sourceBalanceId,
          tenantId,
          inventoryItemId,
          sourceLocId
        );
      }

      // 2. Ambil atau inisialisasi saldo di lokasi tujuan
      const existingTgtRows = await this.queryRaw<{ id: string; quantity_on_hand: string | number }>(
        tx,
        `SELECT id, quantity_on_hand FROM "inventory_balances"
         WHERE tenant_id = $1 AND inventory_item_id = $2 AND storage_location_id = $3 AND inventory_batch_id IS NULL
         FOR UPDATE;`,
        tenantId,
        inventoryItemId,
        targetLocId
      );

      let targetBalanceId: string;
      let tgtBefore: number;
      if (existingTgtRows.length > 0) {
        targetBalanceId = existingTgtRows[0].id;
        tgtBefore = Number(existingTgtRows[0].quantity_on_hand || 0);
      } else {
        targetBalanceId = this.generateDeterministicUuid(`${inventoryItemId}:${targetLocId}:unbatched_balance`);
        tgtBefore = 0;
        await this.executeRaw(
          tx,
          `INSERT INTO "inventory_balances" (
            "id", "tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id",
            "quantity_on_hand", "quantity_reserved", "updated_at"
          ) VALUES ($1, $2, $3, $4, null, 0, 0, CURRENT_TIMESTAMP);`,
          targetBalanceId,
          tenantId,
          inventoryItemId,
          targetLocId
        );
      }

      const srcAfter = srcBefore - dto.quantity;
      const tgtAfter = tgtBefore + dto.quantity;

      // Check negative stock on source outlet
      if (srcAfter < 0) {
        const allowNegative = await this.checkNegativeStockAllowed(tx, tenantId, sourceLocId, inventoryItemId);
        if (!allowNegative) {
          throw new Error(
            `Stok cabang asal tidak mencukupi untuk transfer. Tersedia: ${srcBefore}, transfer: ${dto.quantity}.`
          );
        }
      }

      // 1. LEGACY MUTATIONS (Skipped in TARGET_ONLY mode)
      let movOutId: string | null = null;
      let movInId: string | null = null;
      if (!this.isTargetOnlyWrite()) {
        await this.executeRaw(
          tx,
          `UPDATE "outlet_products" SET "stock" = "stock" - $1, "updated_at" = CURRENT_TIMESTAMP WHERE "outlet_id" = $2 AND "product_id" = $3;`,
          dto.quantity,
          dto.sourceOutletId,
          dto.productId
        );

        const targetOutletProductId = crypto.randomUUID();
        await this.executeRaw(
          tx,
          `INSERT INTO "outlet_products" (
            "id", "outlet_id", "product_id", "stock", "price", "min_stock_alert", "created_at", "updated_at"
          ) VALUES (
            $1, $2, $3, $4, 0, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT ("outlet_id", "product_id") DO UPDATE SET
            "stock" = "outlet_products"."stock" + EXCLUDED."stock",
            "updated_at" = CURRENT_TIMESTAMP;`,
          targetOutletProductId,
          dto.targetOutletId,
          dto.productId,
          dto.quantity
        );

        movOutId = crypto.randomUUID();
        await this.executeRaw(
          tx,
          `INSERT INTO "stock_movements" (
            "id", "outlet_id", "product_id", "user_id", "type", "quantity", "notes", "created_at"
          ) VALUES (
            $1, $2, $3, $4, 'TRANSFER_OUT'::"StockMovementType", $5, $6, CURRENT_TIMESTAMP
          );`,
          movOutId,
          dto.sourceOutletId,
          dto.productId,
          actorUserId,
          -dto.quantity,
          dto.notes || `Transfer Out ke cabang ${dto.targetOutletId}`
        );

        movInId = crypto.randomUUID();
        await this.executeRaw(
          tx,
          `INSERT INTO "stock_movements" (
            "id", "outlet_id", "product_id", "user_id", "type", "quantity", "notes", "created_at"
          ) VALUES (
            $1, $2, $3, $4, 'TRANSFER_IN'::"StockMovementType", $5, $6, CURRENT_TIMESTAMP
          );`,
          movInId,
          dto.targetOutletId,
          dto.productId,
          actorUserId,
          dto.quantity,
          dto.notes || `Transfer In dari cabang ${dto.sourceOutletId}`
        );
      }

      // 2. TARGET MUTATIONS
      await this.executeRaw(
        tx,
        `UPDATE "inventory_balances" SET "quantity_on_hand" = $1, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $2;`,
        srcAfter,
        sourceBalanceId
      );

      await this.executeRaw(
        tx,
        `UPDATE "inventory_balances" SET "quantity_on_hand" = $1, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $2;`,
        tgtAfter,
        targetBalanceId
      );

      const itemRows = await this.queryRaw<{ average_cost: string | number }>(
        tx,
        `SELECT average_cost FROM "inventory_items" WHERE "id" = $1;`,
        inventoryItemId
      );
      const unitCost = Number(itemRows[0]?.average_cost || 0);
      const transferRef = `TRANSFER-${Date.now()}`;

      // Ledger Out
      const ledgerOutId = this.generateDeterministicUuid(`${sourceBalanceId}:${Date.now()}:transfer_out`);
      await this.executeRaw(
        tx,
        `INSERT INTO "inventory_ledgers" (
          "id", "tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id",
          "quantity_delta", "balance_before", "balance_after", "unit_cost",
          "movement_type", "reference_type", "reference_id",
          "actor_type", "actor_user_id", "is_negative_balance", "notes", "created_at"
        ) VALUES (
          $1, $2, $3, $4, null,
          $5, $6, $7, $8,
          'TRANSFER_OUT'::"StockMovementType", 'TRANSFER'::"InventoryRefType", $9,
          'USER'::"ActorType", $10, $11, $12, CURRENT_TIMESTAMP
        );`,
        ledgerOutId,
        tenantId,
        inventoryItemId,
        sourceLocId,
        -dto.quantity,
        srcBefore,
        srcAfter,
        unitCost,
        transferRef,
        actorUserId,
        srcAfter < 0,
        dto.notes || `Transfer Out ke lokasi ${targetLocId}`
      );

      // Ledger In
      const ledgerInId = this.generateDeterministicUuid(`${targetBalanceId}:${Date.now()}:transfer_in`);
      await this.executeRaw(
        tx,
        `INSERT INTO "inventory_ledgers" (
          "id", "tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id",
          "quantity_delta", "balance_before", "balance_after", "unit_cost",
          "movement_type", "reference_type", "reference_id",
          "actor_type", "actor_user_id", "is_negative_balance", "notes", "created_at"
        ) VALUES (
          $1, $2, $3, $4, null,
          $5, $6, $7, $8,
          'TRANSFER_IN'::"StockMovementType", 'TRANSFER'::"InventoryRefType", $9,
          'USER'::"ActorType", $10, false, $11, CURRENT_TIMESTAMP
        );`,
        ledgerInId,
        tenantId,
        inventoryItemId,
        targetLocId,
        dto.quantity,
        tgtBefore,
        tgtAfter,
        unitCost,
        transferRef,
        actorUserId,
        dto.notes || `Transfer In dari lokasi ${sourceLocId}`
      );

      return {
        legacyData: { movOutId, movInId, quantity: dto.quantity },
        targetSynced: true,
        targetRecordsAffected: 4,
        targetDetails: { sourceBalanceId, targetBalanceId, srcAfter, tgtAfter, transferRef },
      };
    } catch (err: any) {
      if (ctx.strictAtomic !== false) {
        throw err;
      }
      await this.logEmergencyDrift({
        domain: 'INVENTORY',
        operation: 'transferStock',
        tenantId,
        payload: dto,
        errorMessage: err.message,
        errorStack: err.stack,
        occurredAt: new Date(),
      });
      throw err;
    }
  }

  public recordStockTransfer = this.transferStock.bind(this);
}
