import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient, PurchaseOrderStatus, StockTransferStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { purchasingService } from '../../services/purchasing.service';
import { stockTransferService } from '../../services/stock_transfer.service';

async function main() {
  console.log('===============================================================');
  console.log('EPIC-07 VERIFICATION SUITE: SUPPLY CHAIN, PURCHASING & LOGISTICS');
  console.log('===============================================================');

  const prisma = new PrismaClient();

  try {
    // 1. RESOLVE ACTIVE TENANT, OUTLETS & USERS
    console.log('\n[1/6] Resolving Active Tenant, Outlets & User Context...');
    const tenants: any[] = await prisma.$queryRawUnsafe(`SELECT id, business_name FROM "tenants" LIMIT 1;`);
    if (tenants.length === 0) throw new Error('Tenant tidak ditemukan.');
    const tenant = { id: tenants[0].id, name: tenants[0].business_name };

    const outlets: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, name FROM "outlets" WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 2;`,
      tenant.id
    );
    if (outlets.length === 0) throw new Error('Outlet tidak ditemukan.');

    const outletA = outlets[0];
    let outletB = outlets[1];

    // Ensure we have a second outlet for transfer testing
    if (!outletB) {
      console.log('  Creating second outlet for Inter-Outlet Transfer verification...');
      const createdOutlet = await prisma.outlet.create({
        data: {
          tenantId: tenant.id,
          code: `OUT-B-${Date.now().toString().slice(-4)}`,
          name: 'Cabang Kopi Selatan (Store B)',
          address: 'Jl. Selatan No. 88',
        },
      });
      outletB = { id: createdOutlet.id, name: createdOutlet.name };
    }

    const users: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, name FROM "users" WHERE tenant_id = $1 LIMIT 1;`,
      tenant.id
    );
    const actorUser = users[0] || null;

    console.log(`  Tenant: ${tenant.name} (${tenant.id})`);
    console.log(`  Outlet A (Warehouse/Main): ${outletA.name} (${outletA.id})`);
    console.log(`  Outlet B (Branch): ${outletB.name} (${outletB.id})`);

    // Ensure default storage locations exist for both outlets
    let locA = await prisma.storageLocation.findFirst({
      where: { tenantId: tenant.id, outletId: outletA.id, isDefault: true },
    });
    if (!locA) {
      locA = await prisma.storageLocation.create({
        data: {
          tenantId: tenant.id,
          outletId: outletA.id,
          name: 'Gudang Pusat A',
          isDefault: true,
          type: 'WAREHOUSE',
        },
      });
    }

    let locB = await prisma.storageLocation.findFirst({
      where: { tenantId: tenant.id, outletId: outletB.id, isDefault: true },
    });
    if (!locB) {
      locB = await prisma.storageLocation.create({
        data: {
          tenantId: tenant.id,
          outletId: outletB.id,
          name: 'Gudang Cabang B',
          isDefault: true,
          type: 'WAREHOUSE',
        },
      });
    }

    // 2. MASTER SUPPLIER CREATION & VERIFICATION
    console.log('\n[2/6] Verifying Master Supplier Lifecycle...');
    const supplierCode = `SUPP-${Date.now().toString().slice(-6)}`;
    const supplier = await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        code: supplierCode,
        name: 'PT Biji Kopi Nusantara',
        contactName: 'Pak Hendra',
        phone: '081234567890',
        email: 'hendra@bijikopi.co.id',
        address: 'Kawasan Industri Kopi, Bandung',
        paymentTermsDays: 30,
        isActive: true,
      },
    });

    if (!supplier || supplier.code !== supplierCode) {
      throw new Error('Gagal memverifikasi pembuatan supplier');
    }
    console.log(`  ✅ Supplier dibuat: ${supplier.name} (${supplier.code}) - ID: ${supplier.id}`);

    // Create Test Inventory Item
    const itemCode = `RAW-BEAN-${Date.now().toString().slice(-5)}`;
    const inventoryItem = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        itemCode,
        name: 'Biji Kopi Arabica Gayo',
        canonicalUom: 'KG',
        purchaseUom: 'SACK',
        reorderPoint: 10,
        targetLevel: 100,
        averageCost: 90000, // Initial average cost: 90,000 IDR/kg
        isBatched: true,
        isActive: true,
      },
    });

    // Seed initial balance: 20 KG @ 90,000 IDR in Outlet A
    const initialBalance = await prisma.inventoryBalance.create({
      data: {
        tenantId: tenant.id,
        inventoryItemId: inventoryItem.id,
        storageLocationId: locA.id,
        quantityOnHand: 20, // 20 kg
        quantityReserved: 0,
      },
    });

    console.log(`  ✅ Inventory Item disiapkan: ${inventoryItem.name} (${inventoryItem.itemCode})`);
    console.log(`     Initial Stock: 20 KG @ Rp 90.000 / KG (Total Value = Rp 1.800.000)`);

    // 3. PURCHASE ORDER CREATION & ISSUANCE
    console.log('\n[3/6] Verifying Purchase Order (PO) Creation & Issuance...');
    const po = await purchasingService.createPurchaseOrder({
      tenantId: tenant.id,
      outletId: outletA.id,
      storageLocationId: locA.id,
      supplierId: supplier.id,
      createdByUserId: actorUser?.id,
      notes: 'PO Pengadaan Biji Kopi Batch 1',
      items: [
        {
          inventoryItemId: inventoryItem.id,
          quantityOrdered: 30, // 30 kg ordered
          unitCost: 100000,    // 100,000 IDR/kg
          notes: 'Arabica Grade A',
        },
      ],
    });

    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new Error(`Expected PO status DRAFT, got ${po.status}`);
    }
    if (Number(po.totalAmount) !== 3000000) {
      throw new Error(`Expected PO totalAmount 3000000, got ${po.totalAmount}`);
    }
    console.log(`  ✅ Purchase Order dibuat: ${po.poNumber} (Status: ${po.status}, Total: Rp ${Number(po.totalAmount).toLocaleString()})`);

    const issuedPo = await purchasingService.issuePurchaseOrder(po.id, tenant.id);
    if (issuedPo.status !== PurchaseOrderStatus.ISSUED) {
      throw new Error(`Expected PO status ISSUED, got ${issuedPo.status}`);
    }
    console.log(`  ✅ Purchase Order di-issue: ${issuedPo.poNumber} (Status: ${issuedPo.status})`);

    // 4. GOODS RECEIVING & MOVING AVERAGE COST RECALCULATION
    console.log('\n[4/6] Verifying Goods Receiving & Moving Average Cost Recalculation...');
    const batchNumber = `LOT-${Date.now().toString().slice(-6)}`;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 45); // Expires in 45 days

    const poItemId = po.items[0].id;
    const receivedPo = await purchasingService.receivePurchaseOrder({
      purchaseOrderId: po.id,
      tenantId: tenant.id,
      actorUserId: actorUser?.id,
      items: [
        {
          purchaseOrderItemId: poItemId,
          quantityReceived: 30, // Full receipt
          unitCost: 100000,
          batchNumber,
          expirationDate: expiryDate,
        },
      ],
    });

    if (receivedPo.status !== PurchaseOrderStatus.RECEIVED) {
      throw new Error(`Expected PO status RECEIVED, got ${receivedPo.status}`);
    }
    console.log(`  ✅ Goods Received processed for PO: ${receivedPo.poNumber} (Status: ${receivedPo.status})`);

    // Verify Recalculated Moving Average Cost:
    // Initial: 20 KG @ 90,000 = 1,800,000
    // Incoming: 30 KG @ 100,000 = 3,000,000
    // Expected new average cost: (1,800,000 + 3,000,000) / 50 = 4,800,000 / 50 = 96,000 IDR/KG
    const updatedInvItem = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItem.id },
    });
    const computedAvgCost = Number(updatedInvItem?.averageCost || 0);
    console.log(`  ✅ Moving Average Cost terverifikasi:`);
    console.log(`     Sebelumnya: Rp 90.000 | Penerimaan: 30 KG @ Rp 100.000`);
    console.log(`     Formula: ( (20 * 90.000) + (30 * 100.000) ) / 50 = Rp 96.000`);
    console.log(`     Hasil di Database: Rp ${computedAvgCost.toLocaleString()}`);

    if (Math.abs(computedAvgCost - 96000) > 0.01) {
      throw new Error(`Moving Average Cost mismatch! Expected 96000, got ${computedAvgCost}`);
    }

    // Verify Inventory Ledgers row
    const purchaseLedger = await prisma.inventoryLedger.findFirst({
      where: {
        tenantId: tenant.id,
        referenceId: po.id,
        movementType: 'PURCHASE',
      },
    });
    if (!purchaseLedger) {
      throw new Error('Inventory ledger for PURCHASE movement not found');
    }
    console.log(`  ✅ Inventory Ledger audit terverifikasi: ID ${purchaseLedger.id}, Delta: +${purchaseLedger.quantityDelta}, Balance After: ${purchaseLedger.balanceAfter}`);

    // 5. INTER-OUTLET STOCK TRANSFER (DISPATCH -> IN_TRANSIT -> RECEIVED)
    console.log('\n[5/6] Verifying Inter-Outlet Stock Transfer Workflow...');
    // Transfer 15 KG of Biji Kopi from Outlet A to Outlet B
    const transfer = await stockTransferService.createTransfer({
      tenantId: tenant.id,
      sourceOutletId: outletA.id,
      sourceLocationId: locA.id,
      targetOutletId: outletB.id,
      targetLocationId: locB.id,
      createdByUserId: actorUser?.id,
      notes: 'Transfer 15 KG Biji Kopi ke Cabang Selatan',
      items: [
        {
          inventoryItemId: inventoryItem.id,
          quantityDispatched: 15, // 15 KG
        },
      ],
    });

    if (transfer.status !== StockTransferStatus.DRAFT) {
      throw new Error(`Expected Transfer status DRAFT, got ${transfer.status}`);
    }
    console.log(`  ✅ Stock Transfer dibuat: ${transfer.transferNumber} (Status: ${transfer.status})`);

    // Check Outlet A balance before dispatch
    const balanceABefore = await prisma.inventoryBalance.findFirst({
      where: {
        tenantId: tenant.id,
        inventoryItemId: inventoryItem.id,
        storageLocationId: locA.id,
        inventoryBatchId: null,
      },
    });
    const qtyABefore = Number(balanceABefore?.quantityOnHand || 0);

    // Dispatch Transfer
    const dispatched = await stockTransferService.dispatchTransfer(transfer.id, tenant.id, actorUser?.id);
    if (dispatched.status !== StockTransferStatus.IN_TRANSIT) {
      throw new Error(`Expected Transfer status IN_TRANSIT, got ${dispatched.status}`);
    }

    const balanceAAfter = await prisma.inventoryBalance.findFirst({
      where: {
        tenantId: tenant.id,
        inventoryItemId: inventoryItem.id,
        storageLocationId: locA.id,
        inventoryBatchId: null,
      },
    });
    const qtyAAfter = Number(balanceAAfter?.quantityOnHand || 0);
    console.log(`  ✅ Stock Transfer di-dispatch: ${dispatched.transferNumber} (Status: ${dispatched.status})`);
    console.log(`     Outlet A Balance: ${qtyABefore} KG -> ${qtyAAfter} KG (Deducted 15 KG)`);

    if (qtyAAfter !== qtyABefore - 15) {
      throw new Error(`Outlet A stock deduction mismatch! Expected ${qtyABefore - 15}, got ${qtyAAfter}`);
    }

    // Verify TRANSFER_OUT Ledger entry
    const transferOutLedger = await prisma.inventoryLedger.findFirst({
      where: {
        tenantId: tenant.id,
        referenceId: transfer.id,
        movementType: 'TRANSFER_OUT',
      },
    });
    if (!transferOutLedger) {
      throw new Error('Inventory ledger for TRANSFER_OUT not found');
    }
    console.log(`  ✅ TRANSFER_OUT Ledger terverifikasi: ID ${transferOutLedger.id}, Delta: ${transferOutLedger.quantityDelta}`);

    // Receive Transfer at Outlet B
    const receivedTransfer = await stockTransferService.receiveTransfer({
      transferId: transfer.id,
      tenantId: tenant.id,
      actorUserId: actorUser?.id,
    });

    if (receivedTransfer.status !== StockTransferStatus.RECEIVED) {
      throw new Error(`Expected Transfer status RECEIVED, got ${receivedTransfer.status}`);
    }

    const balanceBAfter = await prisma.inventoryBalance.findFirst({
      where: {
        tenantId: tenant.id,
        inventoryItemId: inventoryItem.id,
        storageLocationId: locB.id,
      },
    });
    const qtyBAfter = Number(balanceBAfter?.quantityOnHand || 0);
    console.log(`  ✅ Stock Transfer diterima di Outlet B: ${receivedTransfer.transferNumber} (Status: ${receivedTransfer.status})`);
    console.log(`     Outlet B Balance: ${qtyBAfter} KG (Received 15 KG)`);

    if (qtyBAfter !== 15) {
      throw new Error(`Outlet B stock receipt mismatch! Expected 15, got ${qtyBAfter}`);
    }

    // Verify TRANSFER_IN Ledger entry
    const transferInLedger = await prisma.inventoryLedger.findFirst({
      where: {
        tenantId: tenant.id,
        referenceId: transfer.id,
        movementType: 'TRANSFER_IN',
      },
    });
    if (!transferInLedger) {
      throw new Error('Inventory ledger for TRANSFER_IN not found');
    }
    console.log(`  ✅ TRANSFER_IN Ledger terverifikasi: ID ${transferInLedger.id}, Delta: +${transferInLedger.quantityDelta}`);

    // 6. BATCH & EXPIRY ALERT VERIFICATION
    console.log('\n[6/6] Verifying Batch Expiry Alert System...');
    // Create an expiring batch: 5 days from now
    const nearExpiryBatch = await prisma.inventoryBatch.create({
      data: {
        tenantId: tenant.id,
        inventoryItemId: inventoryItem.id,
        batchNumber: `EXP-NEAR-${Date.now().toString().slice(-4)}`,
        expirationDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
        costPrice: 96000,
      },
    });

    // Add balance to this expiring batch
    await prisma.inventoryBalance.create({
      data: {
        tenantId: tenant.id,
        inventoryItemId: inventoryItem.id,
        storageLocationId: locA.id,
        inventoryBatchId: nearExpiryBatch.id,
        quantityOnHand: 10,
        quantityReserved: 0,
      },
    });

    // Query batches expiring within 14 days
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 14);

    const alertBatches = await prisma.inventoryBatch.findMany({
      where: {
        tenantId: tenant.id,
        expirationDate: { lte: targetDate },
        isActive: true,
        balances: { some: { quantityOnHand: { gt: 0 } } },
      },
      include: {
        inventoryItem: true,
        balances: true,
      },
    });

    const foundExpiring = alertBatches.find((b) => b.id === nearExpiryBatch.id);
    if (!foundExpiring) {
      throw new Error('Expiring batch not captured in expiry alert query!');
    }
    console.log(`  ✅ Expiry Alert mendeteksi batch yang akan kadaluarsa:`);
    console.log(`     Batch: ${foundExpiring.batchNumber}, Item: ${foundExpiring.inventoryItem.name}, Exp: ${foundExpiring.expirationDate?.toISOString().slice(0, 10)}`);

    console.log('\n===============================================================');
    console.log('🎉 EPIC-07 VERIFICATION COMPLETE: ALL 6/6 MODULES PASSED!');
    console.log('===============================================================');
  } catch (err: any) {
    console.error('\n❌ EPIC-07 VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
