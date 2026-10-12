import { prisma } from '../../config/prisma';
import { toWibDateStr } from '../../utils/date.utils';

const BASE_URL = process.env.API_URL || 'http://localhost:5001';

interface TestResult {
  step: string;
  passed: boolean;
  details?: string;
  error?: any;
}

const results: TestResult[] = [];

function record(step: string, passed: boolean, details?: string, error?: any) {
  results.push({ step, passed, details, error });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${passed ? 'PASS' : 'FAIL'}] ${step}${details ? ` -> ${details}` : ''}`);
  if (error) {
    console.error('   Detail Error:', error);
  }
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { status: response.status, ok: response.ok, data: json };
}

export async function runSupplyChainSuite() {
  console.log('===================================================================');
  console.log('📦 WELL POS — SUPPLY CHAIN & MULTI-OUTLET SUITE (PHASE 2 CONTRACTS)');
  console.log(`Target Backend   : ${BASE_URL}`);
  console.log(`Current WIB Date : ${toWibDateStr()}`);
  console.log('===================================================================\n');

  try {
    // 0. Autentikasi Owner Sandbox (Ura Coffee)
    console.log('🔐 [Setup] Autentikasi Merchant Sandbox Ura Coffee...');
    let ownerLoginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@uracoffee.id', password: 'Owner123!' }),
    });

    if (ownerLoginRes.status !== 200) {
      ownerLoginRes = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'owner@uracoffee.id', password: 'Admin123!' }),
      });
    }

    if (!ownerLoginRes.ok || !ownerLoginRes.data?.data?.token) {
      throw new Error(`Gagal login sandbox: ${JSON.stringify(ownerLoginRes.data)}`);
    }

    const ownerToken = ownerLoginRes.data.data.token;
    const tenantId = ownerLoginRes.data.data.user.tenantId;
    const authHeaders = { Authorization: `Bearer ${ownerToken}` };

    // Dapatkan Outlet Kemang dan Outlet Sudirman
    const outletsRes = await request('/api/outlets', { headers: authHeaders });
    const outlets = outletsRes.data?.data || [];
    const outletKemang = outlets.find((o: any) => o.name?.includes('Kemang')) || outlets[0];
    const outletSudirman = outlets.find((o: any) => o.name?.includes('Sudirman')) || outlets[1] || outlets[0];

    if (!outletKemang || !outletSudirman || outletKemang.id === outletSudirman.id) {
      throw new Error('Dibutuhkan minimal 2 outlet berbeda (Kemang & Sudirman) untuk pengujian transfer multi-outlet');
    }

    console.log(`📍 Toko Asal (Source) : ${outletKemang.name} (ID: ${outletKemang.id})`);
    console.log(`📍 Toko Tujuan (Target): ${outletSudirman.name} (ID: ${outletSudirman.id})`);
    console.log(`🏢 Tenant ID           : ${tenantId}\n`);

    // Dapatkan Inventory Item untuk bahan baku PO & Transfer
    let invItem = await prisma.inventoryItem.findFirst({
      where: { tenantId, name: { contains: 'Arabika', mode: 'insensitive' } },
    });

    if (!invItem) {
      invItem = await prisma.inventoryItem.findFirst({
        where: { tenantId },
      });
    }

    if (!invItem) {
      throw new Error('Tidak ditemukan inventory item untuk pengujian rantai pasok');
    }

    console.log(`📦 Item Inventory Uji : ${invItem.name} (ID: ${invItem.id}, AvgCost: Rp ${invItem.averageCost})\n`);

    const timestamp = Date.now().toString().slice(-6);

    // =========================================================================
    // FLOW 15: Manajemen Supplier & Siklus Purchase Order (PO)
    // =========================================================================
    console.log('--- [FLOW 15] Manajemen Supplier & Siklus Purchase Order (PO) ---');

    // 15.1 Create Supplier Baru
    const supplierCode = `SUP-${timestamp}`;
    const supplierName = `PT Mitra Roastery Nusantara ${timestamp}`;
    const createSupRes = await request('/api/suppliers', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: supplierCode,
        name: supplierName,
        contactName: 'Budi Santoso',
        phone: '+6281234567890',
        email: `supplier.${timestamp}@roastery.co.id`,
        address: 'Kawasan Industri Roastery No. 45, Bandung',
        paymentTermsDays: 30,
      }),
    });

    const supplierId = createSupRes.data?.data?.id;
    record(
      'FLOW 15.1: Create Supplier Pengadaan Baru',
      createSupRes.status === 201 && !!supplierId,
      `Supplier ID: ${supplierId} (${supplierName})`
    );

    // 15.2 Create Purchase Order (Draft)
    const orderQty = 50;
    const poUnitCost = 275;
    const createPoRes = await request('/api/purchasing/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        outletId: outletKemang.id,
        supplierId,
        expectedDeliveryDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
        notes: `PO Pengadaan Stok Uji Rantai Pasok #${timestamp}`,
        items: [
          {
            inventoryItemId: invItem.id,
            quantityOrdered: orderQty,
            unitCost: poUnitCost,
            notes: 'Batch Arabika Single Origin',
          },
        ],
      }),
    });

    const poData = createPoRes.data?.data;
    const poId = poData?.id;
    const poItemId = poData?.items?.[0]?.id;
    record(
      'FLOW 15.2: Create Purchase Order (Status DRAFT)',
      createPoRes.status === 201 && poData?.status === 'DRAFT' && !!poItemId,
      `PO ID: ${poId}, Nomor: ${poData?.poNumber}, Total: Rp ${poData?.totalAmount}`
    );

    // 15.3 Issue Purchase Order (DRAFT -> ISSUED)
    const issuePoRes = await request(`/api/purchasing/orders/${poId}/issue`, {
      method: 'POST',
      headers: authHeaders,
    });

    record(
      'FLOW 15.3: Issue Purchase Order (Status ISSUED)',
      issuePoRes.status === 200 && issuePoRes.data?.data?.status === 'ISSUED',
      `PO ${poData?.poNumber} resmi di-issue ke supplier`
    );

    // Hitung saldo stok Kemang sebelum penerimaan barang
    const initialKemangBalance = await prisma.inventoryBalance.aggregate({
      where: { tenantId, inventoryItemId: invItem.id, storageLocation: { outletId: outletKemang.id } },
      _sum: { quantityOnHand: true },
    });
    const kemangStockBeforeReceive = Number(initialKemangBalance._sum.quantityOnHand || 0);

    // 15.4 Goods Receiving (Penerimaan Barang dengan Batch Tracking & Expiry)
    const batchNumber = `BATCH-ARA-${timestamp}`;
    const expiryDate = new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10); // 14 hari ke depan

    const receivePoRes = await request(`/api/purchasing/orders/${poId}/receive`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        items: [
          {
            purchaseOrderItemId: poItemId,
            quantityReceived: orderQty,
            unitCost: poUnitCost,
            batchNumber,
            expirationDate: expiryDate,
          },
        ],
      }),
    });

    // Verifikasi saldo stok Kemang setelah penerimaan
    const postReceiveKemangBalance = await prisma.inventoryBalance.aggregate({
      where: { tenantId, inventoryItemId: invItem.id, storageLocation: { outletId: outletKemang.id } },
      _sum: { quantityOnHand: true },
    });
    const kemangStockAfterReceive = Number(postReceiveKemangBalance._sum.quantityOnHand || 0);

    // Verifikasi Batch dan Ledger
    const batchCreated = await prisma.inventoryBatch.findFirst({
      where: { tenantId, inventoryItemId: invItem.id, batchNumber },
    });
    const purchaseLedger = await prisma.inventoryLedger.findFirst({
      where: { tenantId, inventoryItemId: invItem.id, movementType: 'PURCHASE', referenceId: poId },
    });

    record(
      'FLOW 15.4: Goods Receiving & Audit Mutasi Fisik',
      receivePoRes.status === 200 &&
        receivePoRes.data?.data?.status === 'RECEIVED' &&
        kemangStockAfterReceive === kemangStockBeforeReceive + orderQty &&
        !!batchCreated &&
        !!purchaseLedger,
      `Stok Kemang: ${kemangStockBeforeReceive} -> ${kemangStockAfterReceive} (+${orderQty}), Batch: ${batchNumber}`
    );

    // 15.5 Verifikasi Pembaruan Moving Average Cost (HPP)
    const updatedInvItem = await prisma.inventoryItem.findUnique({
      where: { id: invItem.id },
    });
    record(
      'FLOW 15.5: Pembaruan Moving Average Cost (HPP Otomatis)',
      Number(updatedInvItem?.averageCost) > 0,
      `Moving Average Cost aktif: Rp ${updatedInvItem?.averageCost?.toFixed(2)} / unit`
    );

    // =========================================================================
    // FLOW 16: Alokasi & Transfer Stok Antar Toko (Kemang ke Sudirman)
    // =========================================================================
    console.log('\n--- [FLOW 16] Alokasi & Transfer Stok Antar Toko Kemang -> Sudirman ---');

    const transferQty = 15;

    // Catat stok awal Sudirman
    const initialSudirmanBalance = await prisma.inventoryBalance.aggregate({
      where: { tenantId, inventoryItemId: invItem.id, storageLocation: { outletId: outletSudirman.id } },
      _sum: { quantityOnHand: true },
    });
    const sudirmanStockBefore = Number(initialSudirmanBalance._sum.quantityOnHand || 0);

    // 16.1 Create Stock Transfer (DRAFT)
    const createTransferRes = await request('/api/transfers', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        sourceOutletId: outletKemang.id,
        targetOutletId: outletSudirman.id,
        notes: `Transfer Alokasi Biji Kopi Kemang ke Sudirman #${timestamp}`,
        items: [
          {
            inventoryItemId: invItem.id,
            inventoryBatchId: batchCreated?.id,
            quantityDispatched: transferQty,
            unitCost: poUnitCost,
          },
        ],
      }),
    });

    const transferData = createTransferRes.data?.data;
    const transferId = transferData?.id;
    const transferItemId = transferData?.items?.[0]?.id;

    record(
      'FLOW 16.1: Create Stock Transfer (Status DRAFT)',
      createTransferRes.status === 201 && transferData?.status === 'DRAFT' && !!transferId,
      `Transfer ID: ${transferId}, Nomor: ${transferData?.transferNumber}, Qty: ${transferQty}`
    );

    // 16.2 Dispatch Transfer (DRAFT -> IN_TRANSIT)
    const dispatchRes = await request(`/api/transfers/${transferId}/dispatch`, {
      method: 'POST',
      headers: authHeaders,
    });

    // Verifikasi stok Kemang berkurang saat IN_TRANSIT
    const postDispatchKemangBalance = await prisma.inventoryBalance.aggregate({
      where: { tenantId, inventoryItemId: invItem.id, storageLocation: { outletId: outletKemang.id } },
      _sum: { quantityOnHand: true },
    });
    const kemangStockAfterDispatch = Number(postDispatchKemangBalance._sum.quantityOnHand || 0);

    const transferOutLedger = await prisma.inventoryLedger.findFirst({
      where: { tenantId, inventoryItemId: invItem.id, movementType: 'TRANSFER_OUT', referenceId: transferId },
    });

    record(
      'FLOW 16.2: Dispatch Transfer (IN_TRANSIT & Potong Stok Asal)',
      dispatchRes.status === 200 &&
        dispatchRes.data?.data?.status === 'IN_TRANSIT' &&
        kemangStockAfterDispatch === kemangStockAfterReceive - transferQty &&
        !!transferOutLedger,
      `Stok Kemang: ${kemangStockAfterReceive} -> ${kemangStockAfterDispatch} (-${transferQty}), Ledger TRANSFER_OUT valid`
    );

    // 16.3 Receive Transfer di Toko Tujuan Sudirman (IN_TRANSIT -> RECEIVED)
    const receiveTransferRes = await request(`/api/transfers/${transferId}/receive`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        items: [
          {
            transferItemId,
            quantityReceived: transferQty,
          },
        ],
      }),
    });

    // Verifikasi stok Sudirman bertambah saat RECEIVED
    const postReceiveSudirmanBalance = await prisma.inventoryBalance.aggregate({
      where: { tenantId, inventoryItemId: invItem.id, storageLocation: { outletId: outletSudirman.id } },
      _sum: { quantityOnHand: true },
    });
    const sudirmanStockAfter = Number(postReceiveSudirmanBalance._sum.quantityOnHand || 0);

    const transferInLedger = await prisma.inventoryLedger.findFirst({
      where: { tenantId, inventoryItemId: invItem.id, movementType: 'TRANSFER_IN', referenceId: transferId },
    });

    record(
      'FLOW 16.3: Receive Transfer di Toko Tujuan (RECEIVED & Tambah Stok Target)',
      receiveTransferRes.status === 200 &&
        receiveTransferRes.data?.data?.status === 'RECEIVED' &&
        sudirmanStockAfter === sudirmanStockBefore + transferQty &&
        !!transferInLedger,
      `Stok Sudirman: ${sudirmanStockBefore} -> ${sudirmanStockAfter} (+${transferQty}), Ledger TRANSFER_IN valid`
    );

    // =========================================================================
    // FLOW 17: Audit Peringatan Kedaluwarsa (Batch Expiry Alerts)
    // =========================================================================
    console.log('\n--- [FLOW 17] Audit Peringatan Kedaluwarsa (Batch Expiry Alerts) ---');

    // 17.1 Query Expiry Alerts dalam rentang 30 hari ke depan
    const expiryRes = await request(`/api/inventory/expiry-alerts?days=30`, {
      headers: authHeaders,
    });

    const alertBatches = expiryRes.data?.data || [];
    const createdBatchAlert = alertBatches.find((b: any) => b.batchNumber === batchNumber);

    record(
      'FLOW 17.1: Deteksi Batch Mendekati Kedaluwarsa (Expiry Alerts)',
      expiryRes.status === 200 && !!createdBatchAlert,
      `Batch ${batchNumber} terdeteksi: Expiry ${expiryDate}, Sisa hari: ${createdBatchAlert?.daysUntilExpiry} hari`
    );

    // 17.2 Filter Expiry Alerts spesifik Outlet Kemang & Outlet Sudirman
    const expiryKemangRes = await request(`/api/inventory/expiry-alerts?days=30&outletId=${outletKemang.id}`, {
      headers: authHeaders,
    });
    const expirySudirmanRes = await request(`/api/inventory/expiry-alerts?days=30&outletId=${outletSudirman.id}`, {
      headers: authHeaders,
    });

    const kemangBatchFound = (expiryKemangRes.data?.data || []).some((b: any) => b.batchNumber === batchNumber);
    const sudirmanBatchFound = (expirySudirmanRes.data?.data || []).some((b: any) => b.batchNumber === batchNumber);

    record(
      'FLOW 17.2: Isolasi Peringatan Kedaluwarsa Per Outlet',
      expiryKemangRes.status === 200 &&
        expirySudirmanRes.status === 200 &&
        kemangBatchFound &&
        sudirmanBatchFound,
      `Batch ${batchNumber} terdistribusi & terdeteksi aktif di Toko Kemang (sisa ${kemangStockAfterDispatch}) dan Toko Sudirman (masuk ${transferQty})`
    );

    // =========================================================================
    // RINGKASAN HASIL PENGUJIAN FASE 2
    // =========================================================================
    console.log('\n===================================================================');
    console.log('📊 REKAPITULASI PENGUJIAN RANTAI PASOK & MULTI-OUTLET (FASE 2)');
    console.log('===================================================================');

    const totalTests = results.length;
    const passedTests = results.filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;

    console.log(`Total Skenario : ${totalTests}`);
    console.log(`Lulus (PASS)   : ${passedTests}`);
    console.log(`Gagal (FAIL)   : ${failedTests}`);
    console.log(`Tingkat Lulus  : ${((passedTests / totalTests) * 100).toFixed(1)}%\n`);

    if (failedTests > 0) {
      console.error('❌ Terdapat skenario yang gagal:');
      results.filter((r) => !r.passed).forEach((r) => console.error(` - ${r.step}: ${r.details || r.error}`));
      process.exit(1);
    } else {
      console.log('🎉 SELURUH SKENARIO FASE 2 (FLOW 15 - 17) BERHASIL 100%!');
      process.exit(0);
    }
  } catch (err: any) {
    console.error('💥 FATAL ERROR saat menjalankan test suite rantai pasok:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runSupplyChainSuite();
}
