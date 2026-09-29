import * as crypto from 'crypto';
import { BaseDualWriteService } from './base.dual_write.service';
import {
  CheckoutOrderDTO,
  DualWriteContext,
  DualWriteResult,
} from './types';

/**
 * SalesDualWriteService
 * Orchestrates checkout transactions across Legacy (orders, order_items, payments, outlet_products, stock_movements)
 * and Target (order_items.product_variant_id, payment_transactions, inventory_balances, inventory_ledgers).
 * Adheres to OD-14.1-01 (Atomic Transaction with Emergency Drift Logger fallback)
 * and OD-14.1-02 (Parameterized Raw SQL data access - Zero prisma generate).
 */
export class SalesDualWriteService extends BaseDualWriteService {
  /**
   * Processes POS checkout in an atomic multi-table transaction with ADR-003 packaging multipliers.
   */
  public async processCheckout(
    dto: CheckoutOrderDTO,
    ctx: DualWriteContext
  ): Promise<DualWriteResult<any>> {
    const { tx, tenantId } = ctx;

    try {
      const orderId = dto.existingOrderId || crypto.randomUUID();
      let invoiceNumber = dto.invoiceNumber || `INV-${Date.now()}`;
      // EPIC-22: Cek konfigurasi outlet untuk nomor antrean (queue_number) & warehouse routing
      const outletRows = await this.queryRaw<{
        name: string;
        is_warehouse: boolean;
        warehouse_id: string | null;
        receipt_config: any;
      }>(
        tx,
        `SELECT name, is_warehouse, warehouse_id, receipt_config FROM "outlets" WHERE id = $1 AND tenant_id = $2 LIMIT 1;`,
        dto.targetOutletId,
        tenantId
      );
      const outletConfig = outletRows[0]?.receipt_config;
      const isQueueEnabled = outletConfig?.showQueueNumber !== false;

      let queueNumber: number | null = null;
      let hasQueueColumn = true;

      if (dto.existingOrderId) {
        try {
          const existingOrderRows = await this.queryRaw<{ invoice_number: string; queue_number: number | null }>(
            tx,
            `SELECT invoice_number, queue_number FROM "orders" WHERE id = $1;`,
            dto.existingOrderId
          );
          if (existingOrderRows[0]?.invoice_number) {
            invoiceNumber = existingOrderRows[0].invoice_number;
          }
          if (existingOrderRows[0]?.queue_number) {
            queueNumber = existingOrderRows[0].queue_number;
          }
        } catch (err: any) {
          if (err.message && err.message.includes('queue_number')) {
            hasQueueColumn = false;
            const existingOrderRows = await this.queryRaw<{ invoice_number: string }>(
              tx,
              `SELECT invoice_number FROM "orders" WHERE id = $1;`,
              dto.existingOrderId
            );
            if (existingOrderRows[0]?.invoice_number) {
              invoiceNumber = existingOrderRows[0].invoice_number;
            }
          } else {
            throw err;
          }
        }
      }

      if (isQueueEnabled && !queueNumber && hasQueueColumn) {
        try {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          const queueRes = await this.queryRaw<{ next_queue: number }>(
            tx,
            `SELECT (COALESCE(MAX(queue_number), 0) + 1)::int as next_queue 
             FROM "orders" 
             WHERE tenant_id = $1 AND outlet_id = $2 AND created_at >= $3;`,
            tenantId,
            dto.targetOutletId,
            todayStart
          );
          queueNumber = queueRes[0]?.next_queue || 1;
        } catch (err: any) {
          if (err.message && err.message.includes('queue_number')) {
            hasQueueColumn = false;
            queueNumber = null;
          } else {
            throw err;
          }
        }
      }

      const channel = dto.channel || 'DINE_IN';
      const orderType = dto.orderType || channel || 'DINE_IN';
      const tableNumber = dto.tableNumber || null;
      let orderNotes = dto.notes || (tableNumber ? `Meja ${tableNumber}` : null);
      if (dto.customerName && (!orderNotes || !orderNotes.includes(dto.customerName))) {
        orderNotes = orderNotes ? `${orderNotes} (Pelanggan: ${dto.customerName})` : `Pelanggan: ${dto.customerName}`;
      }
      const actorUserId = await this.resolveActorUserId(tx, tenantId, ctx.actorUserId || dto.cashierId);

      // 1. ORDERS MUTATION VIA PARAMETERIZED RAW SQL (Enriched with F&B fields & queue_number fallback)
      if (dto.existingOrderId) {
        if (hasQueueColumn) {
          try {
            await this.executeRaw(
              tx,
              `UPDATE "orders" SET
                "cashier_id" = $2,
                "customer_id" = $3,
                "shift_id" = $4,
                "subtotal" = $5,
                "discount_amount" = $6,
                "tax_amount" = $7,
                "service_total" = $8,
                "grand_total" = $9,
                "payment_status" = 'PAID'::"PaymentStatus",
                "order_status" = 'COMPLETED'::"OrderStatus",
                "channel" = COALESCE($10, "channel"),
                "order_type" = COALESCE($11, "order_type"),
                "table_number" = COALESCE($12, "table_number"),
                "notes" = COALESCE($13, "notes"),
                "queue_number" = COALESCE("queue_number", $14),
                "updated_at" = (NOW() AT TIME ZONE 'UTC')
               WHERE "id" = $1;`,
              orderId,
              dto.cashierId,
              dto.customerId || null,
              dto.shiftId || null,
              dto.subtotal,
              dto.globalDiscount || 0,
              dto.taxAmount || 0,
              dto.serviceCharge || 0,
              dto.grandTotal,
              channel,
              orderType,
              tableNumber,
              orderNotes,
              queueNumber
            );
          } catch (err: any) {
            if (err.message && err.message.includes('queue_number')) {
              hasQueueColumn = false;
              await this.executeRaw(
                tx,
                `UPDATE "orders" SET
                  "cashier_id" = $2,
                  "customer_id" = $3,
                  "shift_id" = $4,
                  "subtotal" = $5,
                  "discount_amount" = $6,
                  "tax_amount" = $7,
                  "service_total" = $8,
                  "grand_total" = $9,
                  "payment_status" = 'PAID'::"PaymentStatus",
                  "order_status" = 'COMPLETED'::"OrderStatus",
                  "channel" = COALESCE($10, "channel"),
                  "order_type" = COALESCE($11, "order_type"),
                  "table_number" = COALESCE($12, "table_number"),
                  "notes" = COALESCE($13, "notes"),
                  "updated_at" = (NOW() AT TIME ZONE 'UTC')
                 WHERE "id" = $1;`,
                orderId,
                dto.cashierId,
                dto.customerId || null,
                dto.shiftId || null,
                dto.subtotal,
                dto.globalDiscount || 0,
                dto.taxAmount || 0,
                dto.serviceCharge || 0,
                dto.grandTotal,
                channel,
                orderType,
                tableNumber,
                orderNotes
              );
            } else {
              throw err;
            }
          }
        } else {
          await this.executeRaw(
            tx,
            `UPDATE "orders" SET
              "cashier_id" = $2,
              "customer_id" = $3,
              "shift_id" = $4,
              "subtotal" = $5,
              "discount_amount" = $6,
              "tax_amount" = $7,
              "service_total" = $8,
              "grand_total" = $9,
              "payment_status" = 'PAID'::"PaymentStatus",
              "order_status" = 'COMPLETED'::"OrderStatus",
              "channel" = COALESCE($10, "channel"),
              "order_type" = COALESCE($11, "order_type"),
              "table_number" = COALESCE($12, "table_number"),
              "notes" = COALESCE($13, "notes"),
              "updated_at" = (NOW() AT TIME ZONE 'UTC')
             WHERE "id" = $1;`,
            orderId,
            dto.cashierId,
            dto.customerId || null,
            dto.shiftId || null,
            dto.subtotal,
            dto.globalDiscount || 0,
            dto.taxAmount || 0,
            dto.serviceCharge || 0,
            dto.grandTotal,
            channel,
            orderType,
            tableNumber,
            orderNotes
          );
        }

        // Bersihkan order_items sebelumnya agar snapshot produk terbaru disimpan bersih
        await this.executeRaw(tx, `DELETE FROM "order_items" WHERE "order_id" = $1;`, orderId);
      } else {
        // Hitung total amount paid dan total change untuk kolom orders
        const totalAmountPaidForOrder = dto.payments.reduce((s, p) => s + Number(p.amountPaid || 0), 0);
        const totalChangeGivenForOrder = dto.payments.reduce((s, p) => s + Number(p.changeGiven || 0), 0);

        if (hasQueueColumn) {
          try {
            await this.executeRaw(
              tx,
              `INSERT INTO "orders" (
                "id", "tenant_id", "outlet_id", "cashier_id", "invoice_number", "queue_number",
                "customer_id", "shift_id",
                "subtotal", "discount_amount", "tax_amount", "service_total", "grand_total",
                "paid_amount", "change_amount",
                "payment_status", "channel", "order_type", "table_number", "notes", "order_status", "created_at", "updated_at"
              ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8,
                $9, $10, $11, $12, $13,
                $14, $15,
                'PAID'::"PaymentStatus", $16, $17, $18, $19, 'CONFIRMED'::"OrderStatus", (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC')
              );`,
              orderId,
              tenantId,
              dto.targetOutletId,
              dto.cashierId,
              invoiceNumber,
              queueNumber,
              dto.customerId || null,
              dto.shiftId || null,
              dto.subtotal,
              dto.globalDiscount || 0,
              dto.taxAmount || 0,
              dto.serviceCharge || 0,
              dto.grandTotal,
              totalAmountPaidForOrder,
              totalChangeGivenForOrder,
              channel,
              orderType,
              tableNumber,
              orderNotes
            );
          } catch (err: any) {
            if (err.message && err.message.includes('queue_number')) {
              hasQueueColumn = false;
              await this.executeRaw(
                tx,
                `INSERT INTO "orders" (
                  "id", "tenant_id", "outlet_id", "cashier_id", "invoice_number",
                  "customer_id", "shift_id",
                  "subtotal", "discount_amount", "tax_amount", "service_total", "grand_total",
                  "paid_amount", "change_amount",
                  "payment_status", "channel", "order_type", "table_number", "notes", "order_status", "created_at", "updated_at"
                ) VALUES (
                  $1, $2, $3, $4, $5,
                  $6, $7,
                  $8, $9, $10, $11, $12,
                  $13, $14,
                  'PAID'::"PaymentStatus", $15, $16, $17, $18, 'CONFIRMED'::"OrderStatus", (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC')
                );`,
                orderId,
                tenantId,
                dto.targetOutletId,
                dto.cashierId,
                invoiceNumber,
                dto.customerId || null,
                dto.shiftId || null,
                dto.subtotal,
                dto.globalDiscount || 0,
                dto.taxAmount || 0,
                dto.serviceCharge || 0,
                dto.grandTotal,
                totalAmountPaidForOrder,
                totalChangeGivenForOrder,
                channel,
                orderType,
                tableNumber,
                orderNotes
              );
            } else {
              throw err;
            }
          }
        } else {
          await this.executeRaw(
            tx,
            `INSERT INTO "orders" (
              "id", "tenant_id", "outlet_id", "cashier_id", "invoice_number",
              "customer_id", "shift_id",
              "subtotal", "discount_amount", "tax_amount", "service_total", "grand_total",
              "paid_amount", "change_amount",
              "payment_status", "channel", "order_type", "table_number", "notes", "order_status", "created_at", "updated_at"
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7,
              $8, $9, $10, $11, $12,
              $13, $14,
              'PAID'::"PaymentStatus", $15, $16, $17, $18, 'CONFIRMED'::"OrderStatus", (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC')
            );`,
            orderId,
            tenantId,
            dto.targetOutletId,
            dto.cashierId,
            invoiceNumber,
            dto.customerId || null,
            dto.shiftId || null,
            dto.subtotal,
            dto.globalDiscount || 0,
            dto.taxAmount || 0,
            dto.serviceCharge || 0,
            dto.grandTotal,
            totalAmountPaidForOrder,
            totalChangeGivenForOrder,
            channel,
            orderType,
            tableNumber,
            orderNotes
          );
        }
      }

      // Update CRM Customer if assigned
      if (dto.customerId) {
        await this.executeRaw(
          tx,
          `UPDATE "customers" 
           SET "visit_count" = "visit_count" + 1, 
               "total_spent" = "total_spent" + $1, 
               "updated_at" = (NOW() AT TIME ZONE 'UTC') 
           WHERE "id" = $2;`,
          dto.grandTotal,
          dto.customerId
        );
      }

      // Process order_items and target inventory balances
      const storageLocationId = await this.resolveDefaultStorageLocation(tx, tenantId, dto.targetOutletId);

      // EPIC-21 (Fase 3): Dynamic Warehouse Backflushing Routing
      // Cek apakah outlet toko pemroses order disuplai oleh Gudang Logistik (warehouse_id)
      const outletName = outletRows[0]?.name || 'Outlet';
      const assignedWarehouseId = outletRows[0]?.warehouse_id;


      let warehouseStorageLocationId: string | null = null;
      let warehouseName: string | null = null;
      if (assignedWarehouseId) {
        const whRows = await this.queryRaw<{ name: string }>(
          tx,
          `SELECT name FROM "outlets" WHERE id = $1 AND tenant_id = $2 AND is_active = true LIMIT 1;`,
          assignedWarehouseId,
          tenantId
        );
        if (whRows.length > 0) {
          warehouseName = whRows[0].name;
          warehouseStorageLocationId = await this.resolveDefaultStorageLocation(tx, tenantId, assignedWarehouseId);
        }
      }

      let targetRecordsAffected = 0;
      const createdOrderItems: Array<{
        id: string;
        productId: string;
        quantity: number;
        costPrice: number;
        unitPrice: number;
      }> = [];

      for (let idx = 0; idx < dto.items.length; idx++) {
        const item = dto.items[idx];
        const orderItemId = crypto.randomUUID();
        let defaultVariantId = item.variantId || this.generateDeterministicUuid(`${item.productId}:variant`);

        // Fetch variant and packaging multiplier
        const variantRows = await this.queryRaw<{
          id: string;
          inventory_item_id: string;
          inventory_quantity_multiplier: string | number;
          sku: string;
        }>(
          tx,
          // Resolve variant: cari berdasarkan variantId (prioritas) atau product_id.
          // Tidak difilter tenant_id karena product sudah divalidasi tenant-nya di checkout controller.
          // Ini mencegah false-miss saat data variant terseimpan di tenant berbeda namun product sah.
          `SELECT id, inventory_item_id, inventory_quantity_multiplier, sku 
           FROM "product_variants" 
           WHERE (id = $1) OR (product_id = $2 AND is_active = true)
           ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END, created_at ASC
           LIMIT 1;`,
          defaultVariantId,
          item.productId
        );

        if (variantRows[0]?.id) {
          defaultVariantId = variantRows[0].id;
        }
        let inventoryItemId = variantRows[0]?.inventory_item_id;
        let multiplier = Number(variantRows[0]?.inventory_quantity_multiplier || 1.000);
        let prodSku = variantRows[0]?.sku || null;
        let prodName = 'Product';

        if (!inventoryItemId) {
          inventoryItemId = this.generateDeterministicUuid(`${item.productId}:inventory_item`);
          const prodRows = await this.queryRaw<{ name: string; sku: string; unit: string }>(
            tx,
            `SELECT name, sku, unit FROM "products" WHERE id = $1;`,
            item.productId
          );
          const p = prodRows[0];
          prodName = p?.name || 'Product';
          const sku = (p?.sku && p.sku.trim() !== '') ? p.sku.trim() : `SKU-${item.productId.substring(0, 8).toUpperCase()}`;
          prodSku = sku;
          const itemCode = `${sku}-INV`;
          const barcode = null;
          const cost = Number(item.costPrice || 0);
          const price = Number(item.unitPrice || 0);
          const unit = p?.unit || 'Pcs';

          await this.executeRaw(
            tx,
            `INSERT INTO "inventory_items" (
              "id", "tenant_id", "item_code", "name", "description", "canonical_uom", "purchase_uom",
              "reorder_point", "target_level", "average_cost", "allow_negative_stock", "is_batched", "is_active",
              "created_at", "updated_at"
            ) VALUES ($1, $2, $3, $4, null, $5, null, 5, 0, $6, null, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT ("id") DO NOTHING;`,
            inventoryItemId,
            tenantId,
            itemCode,
            prodName,
            unit,
            cost
          );

          if (variantRows[0]?.id) {
            await this.executeRaw(
              tx,
              `UPDATE "product_variants" SET inventory_item_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
              inventoryItemId,
              defaultVariantId
            );
          } else {
            await this.executeRaw(
              tx,
              `INSERT INTO "product_variants" (
                "id", "tenant_id", "product_id", "inventory_item_id", "sku", "barcode", "name",
                "price", "inventory_quantity_multiplier", "is_active", "created_at", "updated_at"
              ) VALUES ($1, $2, $3, $4, $5, $6, 'Default', $7, 1.000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT ("id") DO UPDATE SET inventory_item_id = $4;`,
              defaultVariantId,
              tenantId,
              item.productId,
              inventoryItemId,
              sku,
              barcode,
              price
            );
          }

          multiplier = 1.000;
        } else {
          const pRows = await this.queryRaw<{ name: string }>(tx, `SELECT name FROM "products" WHERE id = $1;`, item.productId);
          prodName = pRows[0]?.name || 'Product';
        }

        // Resolusi Modifiers Snapshot jika ada
        let modifiersSnapshotJson: string | null = null;
        if (item.modifierItemIds && item.modifierItemIds.length > 0) {
          const modRows = await this.queryRaw<{ id: string; name: string; price_adjustment: string | number; group_name: string }>(
            tx,
            `SELECT mi.id, mi.name, mi.price_adjustment, mg.name as group_name
             FROM "modifier_items" mi
             JOIN "modifier_groups" mg ON mg.id = mi.modifier_group_id
             WHERE mi.id = ANY($1::text[]) AND mi.tenant_id = $2;`,
            item.modifierItemIds,
            tenantId
          );
          if (modRows.length > 0) {
            modifiersSnapshotJson = JSON.stringify(modRows);
          }
        }

        // Insert target order_items (termasuk modifiers_snapshot & notes)
        await this.executeRaw(
          tx,
          `INSERT INTO "order_items" (
            "id", "tenant_id", "order_id", "product_variant_id", "quantity", "cost_price",
            "unit_price", "discount_amount", "subtotal", "product_name", "variant_name", "sku", "notes", "modifiers_snapshot"
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, 'Default', $11, $12, $13::jsonb
          );`,
          orderItemId,
          tenantId,
          orderId,
          defaultVariantId,
          item.quantity,
          item.costPrice,
          item.unitPrice,
          item.discountAmount || 0,
          item.subtotal,
          prodName,
          prodSku,
          item.notes || null,
          modifiersSnapshotJson
        );
        targetRecordsAffected++;

        createdOrderItems.push({
          id: orderItemId,
          productId: item.productId,
          quantity: item.quantity,
          costPrice: item.costPrice,
          unitPrice: item.unitPrice,
        });

        // 2. RECIPE (BOM) & MODIFIER STOCK DEDUCTION OR DIRECT RETAIL FALLBACK
        const recipeRows = await this.queryRaw<{ id: string; yield_quantity: string | number }>(
          tx,
          `SELECT id, yield_quantity FROM "recipes" WHERE product_variant_id = $1 AND tenant_id = $2 LIMIT 1;`,
          defaultVariantId,
          tenantId
        );

        if (recipeRows.length > 0) {
          // A. F&B BOM RECIPE DEDUCTION
          const recipe = recipeRows[0];
          const yieldQty = Math.max(0.001, Number(recipe.yield_quantity || 1.000));
          const recipeItems = await this.queryRaw<{
            inventory_item_id: string;
            quantity: string | number;
            cost_ratio: string | number;
            ingredient_name: string;
            canonical_uom: string;
            average_cost: string | number;
          }>(
            tx,
            `SELECT ri.inventory_item_id, ri.quantity, ri.cost_ratio, ii.name as ingredient_name, ii.canonical_uom, ii.average_cost
             FROM "recipe_items" ri
             JOIN "inventory_items" ii ON ii.id = ri.inventory_item_id
             WHERE ri.recipe_id = $1 AND ri.tenant_id = $2;`,
            recipe.id,
            tenantId
          );

          for (const ri of recipeItems) {
            const rawNeededQty = (Number(ri.quantity) / yieldQty) * item.quantity;
            
            // EPIC-21 (Fase 3): Dynamic Warehouse Backflushing Routing
            // Jika toko memiliki Gudang Sumber Pasokan yang ditunjuk, kurangi stok bahan baku langsung di Gudang.
            // Jika toko mandiri (tanpa gudang), potong di storage location toko lokal.
            const targetRawLocId = warehouseStorageLocationId || storageLocationId;
            const targetRawLocName = warehouseName ? `Gudang [${warehouseName}]` : `Toko [${outletName}]`;

            const existingBalRows = await this.queryRaw<{ id: string; quantity_on_hand: string | number }>(
              tx,
              `SELECT id, quantity_on_hand 
               FROM "inventory_balances" 
               WHERE tenant_id = $1 AND inventory_item_id = $2 AND storage_location_id = $3 AND inventory_batch_id IS NULL 
               FOR UPDATE;`,
              tenantId,
              ri.inventory_item_id,
              targetRawLocId
            );

            let ingBalanceId: string;
            let ingBalBefore: number;

            if (existingBalRows.length > 0) {
              ingBalanceId = existingBalRows[0].id;
              ingBalBefore = Number(existingBalRows[0].quantity_on_hand || 0);
            } else {
              ingBalanceId = this.generateDeterministicUuid(`${ri.inventory_item_id}:${targetRawLocId}:unbatched_balance`);
              await this.executeRaw(
                tx,
                `INSERT INTO "inventory_balances" (
                  "id", "tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id",
                  "quantity_on_hand", "quantity_reserved", "updated_at"
                ) VALUES ($1, $2, $3, $4, null, 0, 0, CURRENT_TIMESTAMP)
                ON CONFLICT ("id") DO NOTHING;`,
                ingBalanceId,
                tenantId,
                ri.inventory_item_id,
                targetRawLocId
              );
              const lockedRows = await this.queryRaw<{ id: string; quantity_on_hand: string | number }>(
                tx,
                `SELECT id, quantity_on_hand FROM "inventory_balances" 
                 WHERE tenant_id = $1 AND inventory_item_id = $2 AND storage_location_id = $3 AND inventory_batch_id IS NULL 
                 FOR UPDATE;`,
                tenantId,
                ri.inventory_item_id,
                targetRawLocId
              );
              ingBalanceId = lockedRows[0]?.id || ingBalanceId;
              ingBalBefore = Number(lockedRows[0]?.quantity_on_hand || 0);
            }

            const ingBalAfter = ingBalBefore - rawNeededQty;

            if (ingBalAfter < 0) {
              const allowNeg = await this.checkNegativeStockAllowed(tx, tenantId, targetRawLocId, ri.inventory_item_id);
              if (!allowNeg) {
                throw new Error(
                  `Stok bahan baku "${ri.ingredient_name}" di ${targetRawLocName} tidak mencukupi untuk menu "${prodName}". Tersedia: ${ingBalBefore} ${ri.canonical_uom}, Dibutuhkan: ${rawNeededQty} ${ri.canonical_uom}.`
                );
              }
            }

            await this.executeRaw(
              tx,
              `UPDATE "inventory_balances" 
               SET "quantity_on_hand" = $1, "updated_at" = CURRENT_TIMESTAMP 
               WHERE "id" = $2;`,
              ingBalAfter,
              ingBalanceId
            );
            targetRecordsAffected++;

            const ingLedgerId = this.generateDeterministicUuid(`${ingBalanceId}:${orderId}:${idx}:${ri.inventory_item_id}:bom`);
            const notes = warehouseName
              ? `BOM Resep: ${prodName} (${item.quantity}x) via Kasir [${outletName}] disuplai oleh [${warehouseName}]`
              : `BOM Resep: ${prodName} (${item.quantity}x) di [${outletName}]`;

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
                'SALE'::"StockMovementType", 'ORDER'::"InventoryRefType", $9,
                'USER'::"ActorType", $10, $11, $12, CURRENT_TIMESTAMP
              )
              ON CONFLICT ("id") DO NOTHING;`,
              ingLedgerId,
              tenantId,
              ri.inventory_item_id,
              targetRawLocId,
              -rawNeededQty,
              ingBalBefore,
              ingBalAfter,
              Number(ri.average_cost || 0),
              orderId,
              actorUserId,
              ingBalAfter < 0,
              notes
            );
            targetRecordsAffected++;
          }

          // B. MODIFIER RECIPE EFFECTS (JIKA ADA MODIFIER YANG DIPILIH)
          if (item.modifierItemIds && item.modifierItemIds.length > 0) {
            const effectRows = await this.queryRaw<{
              modifier_item_id: string;
              inventory_item_id: string;
              quantity_delta: string | number;
              modifier_name: string;
              ingredient_name: string;
              canonical_uom: string;
              average_cost: string | number;
            }>(
              tx,
              `SELECT mre.modifier_item_id, mre.inventory_item_id, mre.quantity_delta,
                      mi.name as modifier_name, ii.name as ingredient_name, ii.canonical_uom, ii.average_cost
               FROM "modifier_recipe_effects" mre
               JOIN "modifier_items" mi ON mi.id = mre.modifier_item_id
               JOIN "inventory_items" ii ON ii.id = mre.inventory_item_id
               WHERE mre.modifier_item_id = ANY($1::text[]) AND mre.tenant_id = $2;`,
              item.modifierItemIds,
              tenantId
            );

            for (const eff of effectRows) {
              const effectConsumption = Number(eff.quantity_delta) * item.quantity;
              if (effectConsumption !== 0) {
                const targetModLocId = warehouseStorageLocationId || storageLocationId;
                const targetModLocName = warehouseName ? `Gudang [${warehouseName}]` : `Toko [${outletName}]`;

                const existingEffRows = await this.queryRaw<{ id: string; quantity_on_hand: string | number }>(
                  tx,
                  `SELECT id, quantity_on_hand 
                   FROM "inventory_balances" 
                   WHERE tenant_id = $1 AND inventory_item_id = $2 AND storage_location_id = $3 AND inventory_batch_id IS NULL 
                   FOR UPDATE;`,
                  tenantId,
                  eff.inventory_item_id,
                  targetModLocId
                );

                let effBalId: string;
                let effBalBefore: number;

                if (existingEffRows.length > 0) {
                  effBalId = existingEffRows[0].id;
                  effBalBefore = Number(existingEffRows[0].quantity_on_hand || 0);
                } else {
                  effBalId = this.generateDeterministicUuid(`${eff.inventory_item_id}:${targetModLocId}:unbatched_balance`);
                  await this.executeRaw(
                    tx,
                    `INSERT INTO "inventory_balances" (
                      "id", "tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id",
                      "quantity_on_hand", "quantity_reserved", "updated_at"
                    ) VALUES ($1, $2, $3, $4, null, 0, 0, CURRENT_TIMESTAMP)
                    ON CONFLICT ("id") DO NOTHING;`,
                    effBalId,
                    tenantId,
                    eff.inventory_item_id,
                    targetModLocId
                  );
                  const lockedEffRows = await this.queryRaw<{ id: string; quantity_on_hand: string | number }>(
                    tx,
                    `SELECT id, quantity_on_hand FROM "inventory_balances" 
                     WHERE tenant_id = $1 AND inventory_item_id = $2 AND storage_location_id = $3 AND inventory_batch_id IS NULL 
                     FOR UPDATE;`,
                    tenantId,
                    eff.inventory_item_id,
                    targetModLocId
                  );
                  effBalId = lockedEffRows[0]?.id || effBalId;
                  effBalBefore = Number(lockedEffRows[0]?.quantity_on_hand || 0);
                }

                const effBalAfter = effBalBefore - effectConsumption;

                if (effBalAfter < 0) {
                  const allowNeg = await this.checkNegativeStockAllowed(tx, tenantId, targetModLocId, eff.inventory_item_id);
                  if (!allowNeg) {
                    throw new Error(
                      `Stok bahan modifier "${eff.ingredient_name}" (${eff.modifier_name}) di ${targetModLocName} tidak mencukupi. Tersedia: ${effBalBefore}, Dibutuhkan: ${effectConsumption}.`
                    );
                  }
                }

                await this.executeRaw(
                  tx,
                  `UPDATE "inventory_balances" 
                   SET "quantity_on_hand" = $1, "updated_at" = CURRENT_TIMESTAMP 
                   WHERE "id" = $2;`,
                  effBalAfter,
                  effBalId
                );
                targetRecordsAffected++;

                const effLedgerId = this.generateDeterministicUuid(`${effBalId}:${orderId}:${idx}:${eff.modifier_item_id}:mod`);
                const modNotes = warehouseName
                  ? `Modifier "${eff.modifier_name}" untuk ${prodName} via Kasir [${outletName}] disuplai oleh [${warehouseName}]`
                  : `Modifier "${eff.modifier_name}" untuk ${prodName} di [${outletName}]`;

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
                    'SALE'::"StockMovementType", 'ORDER'::"InventoryRefType", $9,
                    'USER'::"ActorType", $10, $11, $12, CURRENT_TIMESTAMP
                  )
                  ON CONFLICT ("id") DO NOTHING;`,
                  effLedgerId,
                  tenantId,
                  eff.inventory_item_id,
                  targetModLocId,
                  -effectConsumption,
                  effBalBefore,
                  effBalAfter,
                  Number(eff.average_cost || 0),
                  orderId,
                  actorUserId,
                  effBalAfter < 0,
                  modNotes
                );
                targetRecordsAffected++;
              }
            }
          }
        } else {
          // C. STANDARD RETAIL FALLBACK DEDUCTION (Non-Recipe Items)
          const deductedCanonicalQty = item.quantity * multiplier;

          const existingRetailRows = await this.queryRaw<{ id: string; quantity_on_hand: string | number }>(
            tx,
            `SELECT id, quantity_on_hand 
             FROM "inventory_balances" 
             WHERE tenant_id = $1 AND inventory_item_id = $2 AND storage_location_id = $3 AND inventory_batch_id IS NULL 
             FOR UPDATE;`,
            tenantId,
            inventoryItemId,
            storageLocationId
          );

          let balanceId: string;
          let balanceBefore: number;

          if (existingRetailRows.length > 0) {
            balanceId = existingRetailRows[0].id;
            balanceBefore = Number(existingRetailRows[0].quantity_on_hand || 0);
          } else {
            balanceId = this.generateDeterministicUuid(`${inventoryItemId}:${storageLocationId}:unbatched_balance`);
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
            const lockedRetailRows = await this.queryRaw<{ id: string; quantity_on_hand: string | number }>(
              tx,
              `SELECT id, quantity_on_hand FROM "inventory_balances" 
               WHERE tenant_id = $1 AND inventory_item_id = $2 AND storage_location_id = $3 AND inventory_batch_id IS NULL 
               FOR UPDATE;`,
              tenantId,
              inventoryItemId,
              storageLocationId
            );
            balanceId = lockedRetailRows[0]?.id || balanceId;
            balanceBefore = Number(lockedRetailRows[0]?.quantity_on_hand || 0);
          }
          const balanceAfter = balanceBefore - deductedCanonicalQty;

          // Negative stock check per ADR-002
          if (balanceAfter < 0) {
            const allowNegative = await this.checkNegativeStockAllowed(
              tx,
              tenantId,
              storageLocationId,
              inventoryItemId
            );
            if (!allowNegative) {
              throw new Error(
                `Stok barang (ID: ${item.productId}) tidak mencukupi untuk transaksi retail ini. Tersedia: ${balanceBefore}, Dibutuhkan: ${deductedCanonicalQty}.`
              );
            }
          }

          // Deduct balance
          await this.executeRaw(
            tx,
            `UPDATE "inventory_balances" 
             SET "quantity_on_hand" = $1, "updated_at" = CURRENT_TIMESTAMP 
             WHERE "id" = $2;`,
            balanceAfter,
            balanceId
          );
          targetRecordsAffected++;

          // Unit cost
          const itemRows = await this.queryRaw<{ average_cost: string | number }>(
            tx,
            `SELECT average_cost FROM "inventory_items" WHERE "id" = $1;`,
            inventoryItemId
          );
          const unitCost = Number(item.costPrice || itemRows[0]?.average_cost || 0);

          // Append target inventory ledger
          const ledgerId = this.generateDeterministicUuid(`${balanceId}:${orderId}:${idx}:sale`);
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
              'SALE'::"StockMovementType", 'ORDER'::"InventoryRefType", $9,
              'USER'::"ActorType", $10, $11, $12, CURRENT_TIMESTAMP
            )
            ON CONFLICT ("id") DO NOTHING;`,
            ledgerId,
            tenantId,
            inventoryItemId,
            storageLocationId,
            -deductedCanonicalQty,
            balanceBefore,
            balanceAfter,
            unitCost,
            orderId,
            actorUserId,
            balanceAfter < 0,
            `Penjualan kasir faktur: ${invoiceNumber}`
          );
          targetRecordsAffected++;
        }
      }

      // Payments processing -> payment_transactions
      const createdPayments: Array<{
        id: string;
        method: string;
        amountPaid: number;
        changeGiven: number;
        qrisReference?: string | null;
      }> = [];

      for (const p of dto.payments) {
        const paymentId = crypto.randomUUID();
        const amountPaid = Number(p.amountPaid || 0);
        const changeGiven = Number(p.changeGiven || 0);
        // netAmount = uang yang masuk sebagai omset (maksimal grand total, tidak boleh lebih)
        const netAmount = Math.min(dto.grandTotal, Math.max(0, amountPaid - changeGiven));

        await this.executeRaw(
          tx,
          `INSERT INTO "payment_transactions" (
            "id", "tenant_id", "order_id", "payment_method", "amount",
            "reference_number", "gateway_provider", "status", "metadata", "paid_at", "created_at"
          ) VALUES (
            $1, $2, $3, $4::"PaymentMethod", $5,
            $6, $7, $8::"PaymentTxStatus", null, (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC')
          )
          ON CONFLICT ("id") DO NOTHING;`,
          paymentId,
          tenantId,
          orderId,
          p.method,
          netAmount,
          p.qrisReference || `PAY-${paymentId.substring(0, 8)}`,
          p.method === 'QRIS' ? 'STATIC_QRIS' : null,
          p.status || 'CAPTURED'
        );
        targetRecordsAffected++;

        createdPayments.push({
          id: paymentId,
          method: p.method,
          amountPaid: p.amountPaid,
          changeGiven: p.changeGiven || 0,
          qrisReference: p.qrisReference || null,
        });
      }

      return {
        legacyData: {
          id: orderId,
          invoiceNumber,
          queueNumber,
          outletId: dto.targetOutletId,
          cashierId: dto.cashierId,
          grandTotal: dto.grandTotal,
          orderItems: createdOrderItems,
          payments: createdPayments,
        },
        targetSynced: true,
        targetRecordsAffected,
        targetDetails: {
          orderId,
          invoiceNumber,
          queueNumber,
          storageLocationId,
          itemsProcessed: createdOrderItems.length,
          paymentsProcessed: createdPayments.length,
        },
      };
    } catch (err: any) {
      // OD-14.1-01: Emergency Drift Logging
      await this.logEmergencyDrift({
        domain: 'SALES',
        operation: 'processCheckout',
        tenantId,
        payload: dto,
        errorMessage: err.message,
        errorStack: err.stack,
        occurredAt: new Date(),
      });

      // Strict fail-closed atomic rollback if strictAtomic is true (default)
      if (ctx.strictAtomic !== false) {
        throw err;
      }

      throw err;
    }
  }
}
