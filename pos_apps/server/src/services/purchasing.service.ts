import { PrismaClient, PurchaseOrderStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { prisma } from '../config/prisma';

export interface CreatePOItemInput {
  inventoryItemId: string;
  quantityOrdered: number;
  unitCost: number;
  notes?: string;
}

export interface CreatePOInput {
  tenantId: string;
  outletId: string;
  storageLocationId?: string;
  supplierId: string;
  expectedDeliveryDate?: Date;
  notes?: string;
  createdByUserId?: string;
  items: CreatePOItemInput[];
}

export interface ReceivePOItemInput {
  purchaseOrderItemId: string;
  quantityReceived: number;
  unitCost?: number; // Optional override if actual invoice cost differs
  batchNumber?: string; // Optional batch tracking
  expirationDate?: Date; // Optional expiration date for batch
}

export interface ReceivePOInput {
  purchaseOrderId: string;
  tenantId: string;
  actorUserId?: string;
  items: ReceivePOItemInput[];
}

export class PurchasingService {
  /**
   * Generate sequential or timestamped PO number: PO-YYYYMMDD-XXXX
   */
  private generatePONumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `PO-${dateStr}-${rand}`;
  }

  /**
   * Resolve default storage location if not explicitly provided
   */
  private async resolveStorageLocation(
    tx: any,
    tenantId: string,
    outletId: string,
    locationId?: string
  ): Promise<string> {
    if (locationId) {
      const loc = await tx.storageLocation.findFirst({
        where: { id: locationId, tenantId, outletId },
      });
      if (loc) return loc.id;
    }

    const defaultLoc = await tx.storageLocation.findFirst({
      where: { tenantId, outletId, isDefault: true },
    });
    if (defaultLoc) return defaultLoc.id;

    const anyLoc = await tx.storageLocation.findFirst({
      where: { tenantId, outletId },
    });
    if (anyLoc) return anyLoc.id;

    // Auto-create default storage location if missing
    const newLoc = await tx.storageLocation.create({
      data: {
        tenantId,
        outletId,
        name: 'Gudang Utama',
        type: 'WAREHOUSE',
        isDefault: true,
      },
    });
    return newLoc.id;
  }

  /**
   * Create Purchase Order in DRAFT status
   */
  async createPurchaseOrder(input: CreatePOInput) {
    return await prisma.$transaction(async (tx) => {
      const storageLocationId = await this.resolveStorageLocation(
        tx,
        input.tenantId,
        input.outletId,
        input.storageLocationId
      );

      // Verify supplier
      const supplier = await tx.supplier.findFirst({
        where: { id: input.supplierId, tenantId: input.tenantId },
      });
      if (!supplier) {
        throw new Error('Supplier tidak ditemukan atau tidak valid');
      }

      // Compute subtotals
      let subtotal = 0;
      const poItemsData = [];

      for (const item of input.items) {
        if (item.quantityOrdered <= 0) {
          throw new Error('Jumlah pesanan barang harus lebih besar dari 0');
        }
        if (item.unitCost < 0) {
          throw new Error('Harga satuan barang tidak boleh negatif');
        }

        const invItem = await tx.inventoryItem.findFirst({
          where: { id: item.inventoryItemId, tenantId: input.tenantId },
        });
        if (!invItem) {
          throw new Error(`Inventory item ${item.inventoryItemId} tidak ditemukan`);
        }

        const itemSubtotal = item.quantityOrdered * item.unitCost;
        subtotal += itemSubtotal;

        poItemsData.push({
          tenantId: input.tenantId,
          inventoryItemId: item.inventoryItemId,
          quantityOrdered: item.quantityOrdered,
          quantityReceived: 0,
          unitCost: item.unitCost,
          subtotal: itemSubtotal,
          notes: item.notes || null,
        });
      }

      const totalAmount = subtotal; // Can extend with tax/discount calculation
      const poNumber = this.generatePONumber();

      const po = await tx.purchaseOrder.create({
        data: {
          tenantId: input.tenantId,
          outletId: input.outletId,
          storageLocationId,
          supplierId: input.supplierId,
          poNumber,
          status: PurchaseOrderStatus.DRAFT,
          orderDate: new Date(),
          expectedDeliveryDate: input.expectedDeliveryDate || null,
          subtotal,
          taxAmount: 0,
          totalAmount,
          notes: input.notes || null,
          createdByUserId: input.createdByUserId || null,
          items: {
            create: poItemsData,
          },
        },
        include: {
          supplier: true,
          outlet: true,
          storageLocation: true,
          items: {
            include: {
              inventoryItem: true,
            },
          },
        },
      });

      return po;
    });
  }

  /**
   * Issue Purchase Order (transition from DRAFT to ISSUED)
   */
  async issuePurchaseOrder(purchaseOrderId: string, tenantId: string) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, tenantId },
    });
    if (!po) {
      throw new Error('Purchase Order tidak ditemukan');
    }
    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new Error(`PO tidak dapat di-issue karena status saat ini adalah ${po.status}`);
    }

    return await prisma.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: PurchaseOrderStatus.ISSUED },
      include: { items: true, supplier: true },
    });
  }

  /**
   * Receive Goods against a Purchase Order
   * - Atomically updates PO line quantity_received
   * - Recalculates Moving Average Cost on inventory_items
   * - Increments physical inventory_balances (batched or unbatched)
   * - Appends immutable audit entry in inventory_ledgers (movement_type = 'PURCHASE')
   * - Updates PO status (PARTIALLY_RECEIVED or RECEIVED)
   */
  async receivePurchaseOrder(input: ReceivePOInput) {
    return await prisma.$transaction(async (tx) => {
      // 1. Lock and validate PO
      const po = await tx.purchaseOrder.findFirst({
        where: { id: input.purchaseOrderId, tenantId: input.tenantId },
        include: {
          items: true,
          storageLocation: true,
        },
      });

      if (!po) {
        throw new Error('Purchase Order tidak ditemukan');
      }

      if (po.status === PurchaseOrderStatus.CANCELLED) {
        throw new Error('Tidak dapat menerima barang untuk PO yang telah dibatalkan');
      }
      if (po.status === PurchaseOrderStatus.RECEIVED) {
        throw new Error('PO sudah berstatus RECEIVED lengkap');
      }

      const poItemMap = new Map(po.items.map((i) => [i.id, i]));

      for (const receivedItem of input.items) {
        const poItem = poItemMap.get(receivedItem.purchaseOrderItemId);
        if (!poItem) {
          throw new Error(`Item PO ${receivedItem.purchaseOrderItemId} tidak terdaftar pada PO ini`);
        }

        if (receivedItem.quantityReceived <= 0) {
          continue; // Skip zero/negative quantity
        }

        const effectiveUnitCost =
          receivedItem.unitCost !== undefined && receivedItem.unitCost !== null
            ? Number(receivedItem.unitCost)
            : Number(poItem.unitCost);

        // 2. Fetch inventory_item to calculate Moving Average Cost
        const invItem = await tx.inventoryItem.findUnique({
          where: { id: poItem.inventoryItemId },
        });
        if (!invItem) {
          throw new Error(`Inventory item ${poItem.inventoryItemId} tidak ditemukan`);
        }

        // Sum current on-hand stock across all locations in this tenant
        const totalOnHandAgg = await tx.inventoryBalance.aggregate({
          where: {
            tenantId: input.tenantId,
            inventoryItemId: invItem.id,
          },
          _sum: {
            quantityOnHand: true,
          },
        });

        const currentTotalStock = Number(totalOnHandAgg._sum.quantityOnHand || 0);
        const currentAvgCost = Number(invItem.averageCost || 0);
        const receivedQty = Number(receivedItem.quantityReceived);

        // Moving Average Cost Formula:
        // newAvgCost = ( (currentTotalStock * currentAvgCost) + (receivedQty * effectiveUnitCost) ) / (currentTotalStock + receivedQty)
        let newAvgCost = effectiveUnitCost;
        if (currentTotalStock + receivedQty > 0) {
          const totalValueBefore = Math.max(0, currentTotalStock) * currentAvgCost;
          const incomingValue = receivedQty * effectiveUnitCost;
          newAvgCost = (totalValueBefore + incomingValue) / (Math.max(0, currentTotalStock) + receivedQty);
        }

        // Update Moving Average Cost on inventory_items
        await tx.inventoryItem.update({
          where: { id: invItem.id },
          data: {
            averageCost: newAvgCost,
            updatedAt: new Date(),
          },
        });

        // 3. Handle Batch Tracking if applicable
        let batchId: string | null = null;
        if (receivedItem.batchNumber) {
          let batch = await tx.inventoryBatch.findUnique({
            where: {
              tenantId_inventoryItemId_batchNumber: {
                tenantId: input.tenantId,
                inventoryItemId: invItem.id,
                batchNumber: receivedItem.batchNumber,
              },
            },
          });

          if (!batch) {
            batch = await tx.inventoryBatch.create({
              data: {
                tenantId: input.tenantId,
                inventoryItemId: invItem.id,
                batchNumber: receivedItem.batchNumber,
                expirationDate: receivedItem.expirationDate || null,
                costPrice: effectiveUnitCost,
                receivedDate: new Date(),
              },
            });
          }
          batchId = batch.id;
        }

        // 4. Update or Insert Inventory Balance
        let balance = await tx.inventoryBalance.findFirst({
          where: {
            tenantId: input.tenantId,
            inventoryItemId: invItem.id,
            storageLocationId: po.storageLocationId,
            inventoryBatchId: batchId,
          },
        });

        if (!balance) {
          balance = await tx.inventoryBalance.create({
            data: {
              tenantId: input.tenantId,
              inventoryItemId: invItem.id,
              storageLocationId: po.storageLocationId,
              inventoryBatchId: batchId,
              quantityOnHand: 0,
              quantityReserved: 0,
            },
          });
        }

        // Lock balance row
        const lockedBalance = await tx.$queryRawUnsafe<any[]>(
          `SELECT quantity_on_hand FROM "inventory_balances" WHERE id = $1 FOR UPDATE;`,
          balance.id
        );

        const balanceBefore = Number(lockedBalance[0]?.quantity_on_hand || balance.quantityOnHand);
        const balanceAfter = balanceBefore + receivedQty;

        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: {
            quantityOnHand: balanceAfter,
            updatedAt: new Date(),
          },
        });

        // 5. Append immutable audit ledger
        await tx.inventoryLedger.create({
          data: {
            tenantId: input.tenantId,
            inventoryItemId: invItem.id,
            storageLocationId: po.storageLocationId,
            inventoryBatchId: batchId,
            quantityDelta: receivedQty,
            balanceBefore,
            balanceAfter,
            unitCost: effectiveUnitCost,
            movementType: 'PURCHASE',
            referenceType: 'PURCHASE_ORDER',
            referenceId: po.id,
            actorType: input.actorUserId ? 'USER' : 'SYSTEM',
            actorUserId: input.actorUserId || null,
            isNegativeBalance: balanceAfter < 0,
            notes: `Penerimaan Barang PO: ${po.poNumber}${batchId ? ` [Batch: ${receivedItem.batchNumber}]` : ''}`,
          },
        });

        // 6. Update PO Item received quantity
        const updatedQtyReceived = Number(poItem.quantityReceived) + receivedQty;
        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: {
            quantityReceived: updatedQtyReceived,
            updatedAt: new Date(),
          },
        });
      }

      // 7. Check overall PO completion status
      const refetchedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: po.id },
      });

      const allFulfilled = refetchedItems.every(
        (item) => Number(item.quantityReceived) >= Number(item.quantityOrdered)
      );
      const someFulfilled = refetchedItems.some((item) => Number(item.quantityReceived) > 0);

      const finalStatus = allFulfilled
        ? PurchaseOrderStatus.RECEIVED
        : someFulfilled
        ? PurchaseOrderStatus.PARTIALLY_RECEIVED
        : po.status;

      const updatedPo = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: finalStatus,
          updatedAt: new Date(),
        },
        include: {
          items: {
            include: { inventoryItem: true },
          },
          supplier: true,
          outlet: true,
          storageLocation: true,
        },
      });

      return updatedPo;
    });
  }
}

export const purchasingService = new PurchasingService();
