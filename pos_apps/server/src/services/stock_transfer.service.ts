import { PrismaClient, StockTransferStatus } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface CreateTransferItemInput {
  inventoryItemId: string;
  inventoryBatchId?: string;
  quantityDispatched: number;
  unitCost?: number;
}

export interface CreateTransferInput {
  tenantId: string;
  sourceOutletId: string;
  sourceLocationId?: string;
  targetOutletId: string;
  targetLocationId?: string;
  notes?: string;
  createdByUserId?: string;
  items: CreateTransferItemInput[];
}

export interface ReceiveTransferItemInput {
  transferItemId: string;
  quantityReceived: number;
}

export interface ReceiveTransferInput {
  transferId: string;
  tenantId: string;
  actorUserId?: string;
  items?: ReceiveTransferItemInput[]; // If omitted or partial, defaults to full quantityDispatched
}

export class StockTransferService {
  private generateTransferNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `TRF-${dateStr}-${rand}`;
  }

  private async resolveDefaultLocation(
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

  async createTransfer(input: CreateTransferInput) {
    if (input.sourceOutletId === input.targetOutletId) {
      throw new Error('Outlet asal dan outlet tujuan transfer tidak boleh sama');
    }

    return await prisma.$transaction(async (tx) => {
      const sourceLocationId = await this.resolveDefaultLocation(
        tx,
        input.tenantId,
        input.sourceOutletId,
        input.sourceLocationId
      );
      const targetLocationId = await this.resolveDefaultLocation(
        tx,
        input.tenantId,
        input.targetOutletId,
        input.targetLocationId
      );

      const itemsData = [];
      for (const item of input.items) {
        if (item.quantityDispatched <= 0) {
          throw new Error('Jumlah barang yang dikirim harus > 0');
        }

        const invItem = await tx.inventoryItem.findFirst({
          where: { id: item.inventoryItemId, tenantId: input.tenantId },
        });
        if (!invItem) {
          throw new Error(`Inventory item ${item.inventoryItemId} tidak ditemukan`);
        }

        const effectiveUnitCost =
          item.unitCost !== undefined && item.unitCost !== null
            ? item.unitCost
            : Number(invItem.averageCost || 0);

        itemsData.push({
          tenantId: input.tenantId,
          inventoryItemId: item.inventoryItemId,
          inventoryBatchId: item.inventoryBatchId || null,
          quantityDispatched: item.quantityDispatched,
          quantityReceived: 0,
          unitCost: effectiveUnitCost,
        });
      }

      const transferNumber = this.generateTransferNumber();

      const transfer = await tx.stockTransfer.create({
        data: {
          tenantId: input.tenantId,
          transferNumber,
          sourceOutletId: input.sourceOutletId,
          sourceLocationId,
          targetOutletId: input.targetOutletId,
          targetLocationId,
          status: StockTransferStatus.DRAFT,
          notes: input.notes || null,
          dispatchedByUserId: input.createdByUserId || null,
          items: {
            create: itemsData,
          },
        },
        include: {
          sourceOutlet: true,
          targetOutlet: true,
          sourceLocation: true,
          targetLocation: true,
          items: {
            include: { inventoryItem: true, inventoryBatch: true },
          },
        },
      });

      return transfer;
    });
  }

  /**
   * Dispatch Transfer (DRAFT -> IN_TRANSIT)
   * Decrements source stock balance & appends TRANSFER_OUT ledger entry
   */
  async dispatchTransfer(transferId: string, tenantId: string, actorUserId?: string) {
    return await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findFirst({
        where: { id: transferId, tenantId },
        include: {
          items: {
            include: { inventoryItem: true },
          },
          sourceOutlet: true,
          targetOutlet: true,
        },
      });

      if (!transfer) {
        throw new Error('Data Stock Transfer tidak ditemukan');
      }

      if (transfer.status !== StockTransferStatus.DRAFT) {
        throw new Error(`Transfer tidak dapat di-dispatch karena status saat ini adalah ${transfer.status}`);
      }

      // Check tenant policy for negative stock
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      const allowNegative = tenant?.allowNegativeStock ?? false;

      for (const item of transfer.items) {
        const qtyToDeduct = Number(item.quantityDispatched);

        // Find or create source balance
        let balance = await tx.inventoryBalance.findFirst({
          where: {
            tenantId,
            inventoryItemId: item.inventoryItemId,
            storageLocationId: transfer.sourceLocationId,
            inventoryBatchId: item.inventoryBatchId || null,
          },
        });

        if (!balance) {
          balance = await tx.inventoryBalance.create({
            data: {
              tenantId,
              inventoryItemId: item.inventoryItemId,
              storageLocationId: transfer.sourceLocationId,
              inventoryBatchId: item.inventoryBatchId || null,
              quantityOnHand: 0,
              quantityReserved: 0,
            },
          });
        }

        // Lock source balance row
        const lockedBalance = await tx.$queryRawUnsafe<any[]>(
          `SELECT quantity_on_hand FROM "inventory_balances" WHERE id = $1 FOR UPDATE;`,
          balance.id
        );

        const balanceBefore = Number(lockedBalance[0]?.quantity_on_hand || balance.quantityOnHand);
        const balanceAfter = balanceBefore - qtyToDeduct;

        if (balanceAfter < 0 && !allowNegative && !item.inventoryItem.allowNegativeStock) {
          throw new Error(
            `Stok tidak mencukupi untuk item "${item.inventoryItem.name}". Tersedia: ${balanceBefore}, diminta: ${qtyToDeduct}`
          );
        }

        // Update source balance
        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: {
            quantityOnHand: balanceAfter,
            updatedAt: new Date(),
          },
        });

        // Append TRANSFER_OUT ledger
        await tx.inventoryLedger.create({
          data: {
            tenantId,
            inventoryItemId: item.inventoryItemId,
            storageLocationId: transfer.sourceLocationId,
            inventoryBatchId: item.inventoryBatchId || null,
            quantityDelta: -qtyToDeduct,
            balanceBefore,
            balanceAfter,
            unitCost: item.unitCost,
            movementType: 'TRANSFER_OUT',
            referenceType: 'TRANSFER',
            referenceId: transfer.id,
            actorType: actorUserId ? 'USER' : 'SYSTEM',
            actorUserId: actorUserId || null,
            isNegativeBalance: balanceAfter < 0,
            notes: `Dispatch Transfer ${transfer.transferNumber} ke ${transfer.targetOutlet.name}`,
          },
        });
      }

      // Update transfer status to IN_TRANSIT
      const updated = await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          status: StockTransferStatus.IN_TRANSIT,
          dispatchedAt: new Date(),
          dispatchedByUserId: actorUserId || transfer.dispatchedByUserId,
          updatedAt: new Date(),
        },
        include: {
          items: { include: { inventoryItem: true, inventoryBatch: true } },
          sourceOutlet: true,
          targetOutlet: true,
          sourceLocation: true,
          targetLocation: true,
        },
      });

      return updated;
    });
  }

  /**
   * Receive Transfer (IN_TRANSIT -> RECEIVED)
   * Increments target stock balance & appends TRANSFER_IN ledger entry
   */
  async receiveTransfer(input: ReceiveTransferInput) {
    return await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findFirst({
        where: { id: input.transferId, tenantId: input.tenantId },
        include: {
          items: {
            include: { inventoryItem: true },
          },
          sourceOutlet: true,
          targetOutlet: true,
        },
      });

      if (!transfer) {
        throw new Error('Data Stock Transfer tidak ditemukan');
      }

      if (transfer.status !== StockTransferStatus.IN_TRANSIT) {
        throw new Error(`Transfer tidak dalam status pengiriman (status saat ini: ${transfer.status})`);
      }

      const receivedQtyMap = new Map<string, number>();
      if (input.items && input.items.length > 0) {
        for (const item of input.items) {
          receivedQtyMap.set(item.transferItemId, item.quantityReceived);
        }
      }

      for (const item of transfer.items) {
        const qtyReceived = receivedQtyMap.has(item.id)
          ? Number(receivedQtyMap.get(item.id))
          : Number(item.quantityDispatched);

        if (qtyReceived <= 0) continue;

        // Upsert target inventory balance
        let targetBalance = await tx.inventoryBalance.findFirst({
          where: {
            tenantId: input.tenantId,
            inventoryItemId: item.inventoryItemId,
            storageLocationId: transfer.targetLocationId,
            inventoryBatchId: item.inventoryBatchId || null,
          },
        });

        if (!targetBalance) {
          targetBalance = await tx.inventoryBalance.create({
            data: {
              tenantId: input.tenantId,
              inventoryItemId: item.inventoryItemId,
              storageLocationId: transfer.targetLocationId,
              inventoryBatchId: item.inventoryBatchId || null,
              quantityOnHand: 0,
              quantityReserved: 0,
            },
          });
        }

        // Lock target balance row
        const lockedBalance = await tx.$queryRawUnsafe<any[]>(
          `SELECT quantity_on_hand FROM "inventory_balances" WHERE id = $1 FOR UPDATE;`,
          targetBalance.id
        );

        const balanceBefore = Number(lockedBalance[0]?.quantity_on_hand || targetBalance.quantityOnHand);
        const balanceAfter = balanceBefore + qtyReceived;

        await tx.inventoryBalance.update({
          where: { id: targetBalance.id },
          data: {
            quantityOnHand: balanceAfter,
            updatedAt: new Date(),
          },
        });

        // Append TRANSFER_IN ledger
        await tx.inventoryLedger.create({
          data: {
            tenantId: input.tenantId,
            inventoryItemId: item.inventoryItemId,
            storageLocationId: transfer.targetLocationId,
            inventoryBatchId: item.inventoryBatchId || null,
            quantityDelta: qtyReceived,
            balanceBefore,
            balanceAfter,
            unitCost: item.unitCost,
            movementType: 'TRANSFER_IN',
            referenceType: 'TRANSFER',
            referenceId: transfer.id,
            actorType: input.actorUserId ? 'USER' : 'SYSTEM',
            actorUserId: input.actorUserId || null,
            isNegativeBalance: balanceAfter < 0,
            notes: `Penerimaan Transfer ${transfer.transferNumber} dari ${transfer.sourceOutlet.name}`,
          },
        });

        // Update item quantityReceived
        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: {
            quantityReceived: qtyReceived,
            updatedAt: new Date(),
          },
        });
      }

      // Mark transfer as RECEIVED
      const updated = await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          status: StockTransferStatus.RECEIVED,
          receivedAt: new Date(),
          receivedByUserId: input.actorUserId || null,
          updatedAt: new Date(),
        },
        include: {
          items: { include: { inventoryItem: true, inventoryBatch: true } },
          sourceOutlet: true,
          targetOutlet: true,
          sourceLocation: true,
          targetLocation: true,
        },
      });

      return updated;
    });
  }
}

export const stockTransferService = new StockTransferService();
