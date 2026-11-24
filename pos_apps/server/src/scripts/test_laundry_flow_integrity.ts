import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { PrismaClient, Role, PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:5001';
const JWT_SECRET = process.env.JWT_SECRET || 'pos-secret-jwt-key-2026';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

function assertEq(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`[ASSERTION FAILED] ${message} — Expected: ${expected}, Got: ${actual}`);
  }
}

async function runLaundryFlowIntegrityTest() {
  console.log('========================================================================');
  console.log('🧪 E2E QA TEST: INTEGRITAS 9 FLOW MODUL LAUNDRY, PARFUM & MASTER MESIN');
  console.log(`Target Backend: ${API_BASE}`);
  console.log('========================================================================\n');

  // Track created entities for 100% clean teardown
  const createdOrderIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdPerfumeIds: string[] = [];
  const createdMachineIds: string[] = [];
  const createdServiceIds: string[] = [];
  const createdItemIds: string[] = [];
  const createdUserIds: string[] = [];

  let outletId = '';
  let tenantId = '';
  let initialCommissionConfig: any = null;

  try {
    // 0. Ambil Tenant Laundry & Outlet
    const tenant = await prisma.tenant.findFirst({
      where: { businessType: { contains: 'Laundry', mode: 'insensitive' } },
      include: { outlets: true },
    });
    if (!tenant || tenant.outlets.length === 0) {
      throw new Error('Tenant Laundry aktif tidak ditemukan di database lokal.');
    }
    tenantId = tenant.id;
    const outlet = tenant.outlets[0];
    outletId = outlet.id;
    initialCommissionConfig = outlet.laundryCommissionConfig;

    // Ambil atau buat User OWNER untuk auth header
    let ownerUser = await prisma.user.findFirst({
      where: { tenantId, role: { in: [Role.OWNER, Role.ADMIN] }, isActive: true },
    });
    if (!ownerUser) {
      const pwHash = await bcrypt.hash('password123', 10);
      ownerUser = await prisma.user.create({
        data: {
          tenantId,
          outletId,
          userCode: 'OWN_INTEGRITY_QA',
          name: 'Owner Integrity QA',
          email: 'qa.owner.integrity@wellpos-test.com',
          passwordHash: pwHash,
          role: Role.OWNER,
          isActive: true,
          tokenVersion: 1,
        },
      });
      createdUserIds.push(ownerUser.id);
    }

    const token = jwt.sign(
      {
        userId: ownerUser.id,
        tenantId,
        outletId,
        role: ownerUser.role,
        tokenVersion: ownerUser.tokenVersion || 1,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    console.log(`✓ Tenant & Outlet OK: ${tenant.name} | Outlet: ${outlet.name}`);
    console.log(`✓ Authenticated as: ${ownerUser.name} (${ownerUser.role})\n`);

    // =========================================================================
    // MODUL 1: MASTER PARFUM CRUD & BOM AUTO-DEDUCTION
    // =========================================================================
    console.log('--- [1] PENGUJIAN MASTER PARFUM CRUD & BOM AUTO-DEDUCTION ---');

    // 1.1 Verifikasi Auto-Seed 6 Parfum Standar
    const perfumesGetRes = await fetch(`${API_BASE}/api/laundry/perfumes`, {
      method: 'GET',
      headers: authHeaders,
    });
    const perfumesGetData = await perfumesGetRes.json();
    assertEq(perfumesGetData.status, 'success', 'GET /api/laundry/perfumes status');
    assert(Array.isArray(perfumesGetData.data) && perfumesGetData.data.length >= 6, 'Minimal 6 parfum ter-seed otomatis');
    console.log(`✓ Terverifikasi ${perfumesGetData.data.length} varian parfum terdaftar (termasuk 6 aroma standar)`);

    const runSuffix = Date.now().toString().slice(-6);

    // 1.2 Buat Bahan Baku Bibit Parfum di InventoryItem
    const rawPerfumeItem = await prisma.inventoryItem.create({
      data: {
        tenantId,
        itemCode: `BBT-GLD-${runSuffix}`,
        name: `Bibit Parfum Royal Gold QA ${runSuffix}`,
        canonicalUom: 'ML',
        averageCost: 150,
      },
    });
    createdItemIds.push(rawPerfumeItem.id);

    // Ambil atau buat StorageLocation outlet
    let storageLoc = await prisma.storageLocation.findFirst({
      where: { tenantId, outletId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    if (!storageLoc) {
      storageLoc = await prisma.storageLocation.create({
        data: {
          tenantId,
          outletId,
          name: 'Gudang Utama & Dapur QA',
          isDefault: true,
        },
      });
    }

    // Set saldo awal 5000 ML di outlet
    await prisma.inventoryBalance.create({
      data: {
        tenantId,
        storageLocationId: storageLoc.id,
        inventoryItemId: rawPerfumeItem.id,
        quantityOnHand: 5000,
        quantityReserved: 0,
      },
    });

    const mainServiceName = `Cuci Kering Lipat BoM QA ${runSuffix}`;
    const addonTreatmentName = `Spotting Noda Membandel QA ${runSuffix}`;
    const perfumeName = `Royal Gold QA ${runSuffix}`;

    // 1.3 Create Master Parfum Baru via API
    const createPerfumeRes = await fetch(`${API_BASE}/api/laundry/perfumes`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: perfumeName,
        description: 'Aroma mewah elegan dengan bibit premium',
        extraPrice: 3000,
        inventoryItemId: rawPerfumeItem.id,
        dosageMl: 25,
        dosageUnit: 'PER_ORDER',
        isActive: true,
        sortOrder: 1,
      }),
    });
    const createPerfumeData = await createPerfumeRes.json();
    assertEq(createPerfumeData.status, 'success', 'POST /api/laundry/perfumes status');
    assert(Boolean(createPerfumeData.data?.id), 'Parfum ID dihasilkan');
    const createdPerfumeId = createPerfumeData.data.id;
    createdPerfumeIds.push(createdPerfumeId);
    console.log(`✓ Berhasil membuat Master Parfum: ${createPerfumeData.data.name} (+Rp ${createPerfumeData.data.extraPrice}) linked to ${rawPerfumeItem.itemCode}`);

    // 1.4 Update Master Parfum
    const updatePerfumeRes = await fetch(`${API_BASE}/api/laundry/perfumes/${createdPerfumeId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        extraPrice: 3500,
        dosageMl: 30,
      }),
    });
    const updatePerfumeData = await updatePerfumeRes.json();
    assertEq(updatePerfumeData.status, 'success', 'PUT /api/laundry/perfumes/:id status');
    assertEq(Number(updatePerfumeData.data.extraPrice), 3500, 'extraPrice terupdate ke 3500');
    assertEq(Number(updatePerfumeData.data.dosageMl), 30, 'dosageMl terupdate ke 30');
    console.log('✓ Master Parfum berhasil di-update (extraPrice: Rp 3.500, dosage: 30 ML)');

    // =========================================================================
    // MODUL 2: BOM MAIN SERVICE (laundryServiceId) & ADD-ON BOM (addonsSnapshot)
    // =========================================================================
    console.log('\n--- [2] PENGUJIAN BOM MAIN SERVICE & ADD-ON BOM DEDUCTION ---');

    // 2.1 Buat 2 Bahan Baku (Deterjen Cair & Anti-Noda)
    const rawDeterjen = await prisma.inventoryItem.create({
      data: {
        tenantId,
        itemCode: `DET-CR-${runSuffix}`,
        name: `Deterjen Cair Super QA ${runSuffix}`,
        canonicalUom: 'ML',
        averageCost: 50,
      },
    });
    createdItemIds.push(rawDeterjen.id);

    const rawAntiNoda = await prisma.inventoryItem.create({
      data: {
        tenantId,
        itemCode: `ANTI-NDA-${runSuffix}`,
        name: `Cairan Anti Noda Darah QA ${runSuffix}`,
        canonicalUom: 'ML',
        averageCost: 200,
      },
    });
    createdItemIds.push(rawAntiNoda.id);

    // Initial balances
    await prisma.inventoryBalance.create({
      data: {
        tenantId,
        storageLocationId: storageLoc.id,
        inventoryItemId: rawDeterjen.id,
        quantityOnHand: 5000,
        quantityReserved: 0,
      },
    });
    await prisma.inventoryBalance.create({
      data: {
        tenantId,
        storageLocationId: storageLoc.id,
        inventoryItemId: rawAntiNoda.id,
        quantityOnHand: 2000,
        quantityReserved: 0,
      },
    });

    // 2.2 Buat Layanan Utama dengan BoM (50 ML per Kg)
    const mainService = await prisma.laundryService.create({
      data: {
        tenantId,
        name: mainServiceName,
        category: 'KILOAN',
        unit: 'Kg',
        price: 15000,
        minOrderQty: 1,
        durationHours: 24,
        isActive: true,
      },
    });
    createdServiceIds.push(mainService.id);

    await prisma.laundryServiceBomItem.create({
      data: {
        tenantId,
        laundryServiceId: mainService.id,
        inventoryItemId: rawDeterjen.id,
        quantityPerUnit: 50,
        consumptionBasis: 'PER_UNIT',
      },
    });

    // 2.3 Buat Layanan Add-on dengan BoM (20 ML per Order)
    const addonTreatment = await prisma.laundryService.create({
      data: {
        tenantId,
        name: addonTreatmentName,
        category: 'TREATMENT',
        unit: 'PER_ORDER',
        price: 10000,
        minOrderQty: 1,
        durationHours: 0,
        isActive: true,
      },
    });
    createdServiceIds.push(addonTreatment.id);

    await prisma.laundryServiceBomItem.create({
      data: {
        tenantId,
        laundryServiceId: addonTreatment.id,
        inventoryItemId: rawAntiNoda.id,
        quantityPerUnit: 20,
        consumptionBasis: 'PER_ORDER',
      },
    });
    console.log(`✓ Layanan Utama & Add-on BoM siap: ${mainService.name} & ${addonTreatment.name}`);

    // 2.4 Buat Transaksi Laundry Menggunakan Layanan + Add-on + Parfum
    // Bobot: 3.0 Kg
    // Ekspektasi konsumsi:
    // - Deterjen: 3 * 50 = 150 ML
    // - Anti Noda: 20 ML
    // - Bibit Parfum: 30 ML (dosage 30 ML per order)
    const createOrderRes = await fetch(`${API_BASE}/api/laundry/orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        outletId,
        customerName: 'Bpk. Hendra BoM QA',
        customerPhone: '081299887766',
        items: [
          {
            laundryServiceId: mainService.id,
            name: mainService.name,
            category: 'KILOAN',
            quantity: 3.0,
            unit: 'Kg',
            unitPrice: 15000,
            perfumeVariant: perfumeName,
            addons: [
              {
                id: addonTreatment.id,
                name: addonTreatment.name,
                price: 10000,
                unit: 'PER_ORDER',
                total: 10000,
              },
            ],
          },
        ],
        perfumeVariant: perfumeName,
        paymentMethod: 'CASH',
        paymentChoice: 'PAID',
        paidAmount: 55000,
      }),
    });
    const createOrderData = await createOrderRes.json();
    assertEq(createOrderData.status, 'success', 'POST /api/laundry/orders status');
    assert(Boolean(createOrderData.data?.id), 'Order ID dihasilkan');
    const orderId = createOrderData.data.id;
    createdOrderIds.push(orderId);

    // Verifikasi snapshot pada OrderItem di DB
    const savedOrderItem = await prisma.orderItem.findFirst({
      where: { orderId },
    });
    assert(Boolean(savedOrderItem), 'OrderItem tersimpan di DB');
    assertEq(savedOrderItem?.laundryServiceId, mainService.id, 'OrderItem.laundryServiceId tersimpan');
    assert(Boolean(savedOrderItem?.addonsSnapshot), 'OrderItem.addonsSnapshot tersimpan');
    console.log(`✓ Transaksi Nota ${createOrderData.data.invoiceNumber} berhasil dibuat dengan snapshot laundryServiceId & addonsSnapshot`);

    // 2.5 Eksekusi Maju Tahap ke WASHING untuk Memicu deductLaundryOrderBom
    const advanceStageRes = await fetch(`${API_BASE}/api/laundry/orders/${orderId}/advance-stage`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        nextStage: 'WASHING',
        machineName: 'W-01',
        notes: 'Mulai proses pencucian di mesin W-01',
      }),
    });
    const advanceStageData = await advanceStageRes.json();
    assertEq(advanceStageData.status, 'success', 'advance-stage ke WASHING status');

    // 2.6 Verifikasi Pemotongan Stok Akurat di Database
    const balanceDeterjen = await prisma.inventoryBalance.findFirst({
      where: { storageLocationId: storageLoc.id, inventoryItemId: rawDeterjen.id },
    });
    const balanceAntiNoda = await prisma.inventoryBalance.findFirst({
      where: { storageLocationId: storageLoc.id, inventoryItemId: rawAntiNoda.id },
    });
    const balancePerfume = await prisma.inventoryBalance.findFirst({
      where: { storageLocationId: storageLoc.id, inventoryItemId: rawPerfumeItem.id },
    });

    // 5000 - 150 = 4850 ML
    assertEq(Number(balanceDeterjen?.quantityOnHand), 4850, 'Stok Deterjen terpotong 150 ML');
    // 2000 - 20 = 1980 ML
    assertEq(Number(balanceAntiNoda?.quantityOnHand), 1980, 'Stok Anti-Noda terpotong 20 ML');
    // 5000 - 30 = 4970 ML
    assertEq(Number(balancePerfume?.quantityOnHand), 4970, 'Stok Bibit Parfum terpotong 30 ML');

    // Verifikasi InventoryLedger
    const ledgers = await prisma.inventoryLedger.findMany({
      where: {
        tenantId,
        movementType: 'PRODUCTION_CONSUMPTION',
        referenceId: orderId,
      },
    });
    assert(ledgers.length >= 3, 'Minimal 3 mutasi ledger dicatat (Layanan Utama, Add-on, Parfum)');
    console.log('✓ Verifikasi BoM Auto-Deduction 100% SUKSES:');
    console.log(`  - Deterjen: 5.000 ML -> ${balanceDeterjen?.quantityOnHand} ML (-150 ML)`);
    console.log(`  - Anti-Noda: 2.000 ML -> ${balanceAntiNoda?.quantityOnHand} ML (-20 ML)`);
    console.log(`  - Bibit Parfum: 5.000 ML -> ${balancePerfume?.quantityOnHand} ML (-30 ML)`);

    // =========================================================================
    // MODUL 3: MASTER MESIN CRUD & FILTER ACTIVE VS MAINTENANCE
    // =========================================================================
    console.log('\n--- [3] PENGUJIAN MASTER MESIN CRUD & STATUS MAINTENANCE ---');

    // 3.1 Verifikasi Auto-Seed 8 Mesin Standar (W-01..W-04 & D-01..D-04)
    const machinesRes = await fetch(`${API_BASE}/api/laundry/machines?outletId=${outletId}`, {
      method: 'GET',
      headers: authHeaders,
    });
    const machinesData = await machinesRes.json();
    assertEq(machinesData.status, 'success', 'GET /api/laundry/machines status');
    assert(Array.isArray(machinesData.data) && machinesData.data.length >= 8, 'Minimal 8 mesin standar terdaftar');
    console.log(`✓ Terverifikasi ${machinesData.data.length} unit mesin terdaftar di outlet`);

    // 3.2 Tambah Mesin Baru
    const testMachineCode = `W-${runSuffix.slice(-2)}`;
    const createMachineRes = await fetch(`${API_BASE}/api/laundry/machines`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        outletId,
        code: testMachineCode,
        name: `Washer Heavy Duty 20 Kg QA ${runSuffix}`,
        machineType: 'WASHER',
        capacityKg: 20,
        status: 'ACTIVE',
      }),
    });
    const createMachineData = await createMachineRes.json();
    assertEq(createMachineData.status, 'success', 'POST /api/laundry/machines status');
    assert(Boolean(createMachineData.data?.id), 'Machine ID dihasilkan');
    const machineId = createMachineData.data.id;
    createdMachineIds.push(machineId);
    console.log(`✓ Berhasil membuat mesin baru: ${createMachineData.data.code} (${createMachineData.data.name})`);

    // 3.3 Update Status Mesin ke MAINTENANCE
    const updateMachineRes = await fetch(`${API_BASE}/api/laundry/machines/${machineId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        status: 'MAINTENANCE',
        name: `Washer Heavy Duty 20 Kg QA ${runSuffix} (Under Repair)`,
      }),
    });
    const updateMachineData = await updateMachineRes.json();
    assertEq(updateMachineData.status, 'success', 'PATCH /api/laundry/machines/:id status');
    assertEq(updateMachineData.data.status, 'MAINTENANCE', 'Status mesin berubah ke MAINTENANCE');
    console.log(`✓ Berhasil mengubah status mesin ${testMachineCode} menjadi MAINTENANCE`);

    // =========================================================================
    // MODUL 4: PRESERVASI KONFIGURASI KOMISI KASIR
    // =========================================================================
    console.log('\n--- [4] PENGUJIAN PRESERVASI KONFIGURASI KOMISI KASIR ---');

    // 4.1 Set konfigurasi komisi kasir awal
    const initialConfigPayload = {
      productionCommissionEnabled: true,
      washPerKg: 300,
      dryPerKg: 200,
      ironPerKg: 400,
      cashierCommissionEnabled: true,
      cashierCommissionBasis: 'NET_SALES',
      cashierCommissionTiers: [
        { minSales: 500000, ratePercent: 2.5 },
        { minSales: 1500000, ratePercent: 5.0 },
      ],
    };
    await prisma.outlet.update({
      where: { id: outletId },
      data: { laundryCommissionConfig: initialConfigPayload },
    });

    // 4.2 Update komisi produksi via API endpoint
    const updateCommRes = await fetch(`${API_BASE}/api/laundry/commission-config`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        outletId,
        productionCommissionEnabled: true,
        washPerKg: 450,
        dryPerKg: 250,
        ironPerKg: 550,
      }),
    });
    const updateCommData = await updateCommRes.json();
    assertEq(updateCommData.status, 'success', 'PUT /api/laundry/commission-config status');

    // 4.3 Verifikasi DB bahwa cashierCommissionEnabled & tiers tetap utuh
    const refreshedOutlet = await prisma.outlet.findUnique({
      where: { id: outletId },
    });
    const cfg = refreshedOutlet?.laundryCommissionConfig as any;
    assertEq(cfg.washPerKg, 450, 'washPerKg terupdate ke 450');
    assertEq(cfg.cashierCommissionEnabled, true, 'cashierCommissionEnabled tetap TRUE (tidak ter-wipe)');
    assertEq(cfg.cashierCommissionBasis, 'NET_SALES', 'cashierCommissionBasis tetap NET_SALES');
    assert(Array.isArray(cfg.cashierCommissionTiers) && cfg.cashierCommissionTiers.length === 2, 'Tiers komisi kasir tetap utuh');
    console.log('✓ Preservasi Komisi Kasir TERVERIFIKASI UTUH (zero data wipe saat save produksi)');

    // =========================================================================
    // MODUL 5: FULL CUSTOMER DEPOSIT & QUOTA WALLET LIFECYCLE
    // =========================================================================
    console.log('\n--- [5] PENGUJIAN FULL DEPOSIT, KUOTA & EXPIRED BALANCE GUARD ---');

    // 5.1 Buat Pelanggan Baru
    const customer = await prisma.customer.create({
      data: {
        tenantId,
        name: `Ibu Ratna Dompet QA ${runSuffix}`,
        phone: `+62813${runSuffix}44`,
      },
    });
    createdCustomerIds.push(customer.id);

    // 5.2 Top-up Saldo Pertama (Deposit Paket)
    // Beli Rp 90.000 -> dapat saldo 100.000 + bonus 10.000 = 110.000, masa aktif 30 hari
    const topup1Res = await fetch(`${API_BASE}/api/laundry/wallet/${customer.id}/topup`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        type: 'BALANCE',
        amount: 100000,
        bonusAmount: 10000,
        pricePaid: 90000,
        paymentMethod: 'CASH',
        outletId,
        validityDays: 30,
        expiryPolicy: 'ACCUMULATE',
      }),
    });
    const topup1Data = await topup1Res.json();
    assertEq(topup1Data.status, 'success', 'Top-up saldo 1 status');
    assertEq(Number(topup1Data.data.wallet.balanceAmount), 110000, 'Saldo dompet 110.000');
    assert(Boolean(topup1Data.data.wallet.balanceExpiresAt), 'balanceExpiresAt terisi');
    const initialBalanceExp = new Date(topup1Data.data.wallet.balanceExpiresAt);
    console.log(`✓ Top-up Saldo 1 Berhasil: Saldo Rp ${topup1Data.data.wallet.balanceAmount} (Exp: ${initialBalanceExp.toLocaleDateString('id-ID')})`);

    // 5.3 Top-up Saldo Kedua (Verifikasi Policy ACCUMULATE)
    // Tambah 30 hari lagi -> masa aktif harus bertambah ~30 hari dari expiry sebelumnya
    const topup2Res = await fetch(`${API_BASE}/api/laundry/wallet/${customer.id}/topup`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        type: 'BALANCE',
        amount: 50000,
        pricePaid: 50000,
        paymentMethod: 'QRIS',
        outletId,
        validityDays: 30,
        expiryPolicy: 'ACCUMULATE',
      }),
    });
    const topup2Data = await topup2Res.json();
    assertEq(topup2Data.status, 'success', 'Top-up saldo 2 status');
    assertEq(Number(topup2Data.data.wallet.balanceAmount), 160000, 'Saldo dompet terakumulasi ke 160.000');
    const accumulatedBalanceExp = new Date(topup2Data.data.wallet.balanceExpiresAt);
    const diffDays = Math.round((accumulatedBalanceExp.getTime() - initialBalanceExp.getTime()) / (1000 * 3600 * 24));
    assert(diffDays >= 28 && diffDays <= 32, `Masa aktif terakumulasi ~30 hari tambahan (got ${diffDays} hari)`);
    console.log(`✓ Policy ACCUMULATE Berhasil: Saldo Rp 160.000, masa aktif bertambah +${diffDays} hari`);

    // 5.4 Top-up Kuota Kiloan (Verifikasi Pemisahan Expired Date)
    const topupQuotaRes = await fetch(`${API_BASE}/api/laundry/wallet/${customer.id}/topup`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        type: 'QUOTA_KG',
        kg: 10,
        quotaBonusKg: 2,
        pricePaid: 70000,
        paymentMethod: 'CASH',
        outletId,
        validityDays: 45,
      }),
    });
    const topupQuotaData = await topupQuotaRes.json();
    assertEq(topupQuotaData.status, 'success', 'Top-up kuota status');
    assertEq(Number(topupQuotaData.data.wallet.quotaKg), 12, 'Kuota kiloan 12 Kg');
    assertEq(Number(topupQuotaData.data.wallet.balanceAmount), 160000, 'Saldo rupiah tidak terganggu');
    assert(Boolean(topupQuotaData.data.wallet.quotaExpiresAt), 'quotaExpiresAt terisi');
    console.log(`✓ Top-up Kuota Kiloan Berhasil: ${topupQuotaData.data.wallet.quotaKg} Kg (Saldo Rp 160.000 tetap aman)`);

    // 5.5 Uji Guard Saldo Expired
    // Ubah balanceExpiresAt secara paksa ke 3 hari yang lalu di DB
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 3);
    await prisma.customerLaundryWallet.update({
      where: { customerId: customer.id },
      data: { balanceExpiresAt: expiredDate },
    });

    // Coba checkout pesanan menggunakan CUSTOMER_DEPOSIT
    const expiredOrderRes = await fetch(`${API_BASE}/api/laundry/orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        outletId,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        items: [
          {
            name: 'Cuci Kering Lipat',
            category: 'KILOAN',
            quantity: 2.0,
            unit: 'Kg',
            unitPrice: 10000,
          },
        ],
        paymentMethod: 'CUSTOMER_DEPOSIT',
        paymentChoice: 'PAID',
        paidAmount: 20000,
      }),
    });
    const expiredOrderData = await expiredOrderRes.json();
    assertEq(expiredOrderData.status, 'error', 'Checkout saldo expired wajib ditolak (HTTP 400)');
    assert(
      (expiredOrderData.message || '').toLowerCase().includes('kedaluwarsa') ||
        (expiredOrderData.message || '').toLowerCase().includes('expired'),
      'Pesan penolakan memuat indikasi saldo kedaluwarsa'
    );
    console.log(`✓ Guard Saldo Expired Berhasil Menolak Transaksi: "${expiredOrderData.message}"`);

    console.log('\n========================================================================');
    console.log('🎉 SELURUH SKENARIO INTEGRITAS MODUL LAUNDRY LULUS 100%!');
    console.log('========================================================================');
  } catch (err: any) {
    console.error('\n❌ TEST GAGAL DENGAN ERROR:', err);
    throw err;
  } finally {
    console.log('\n🧹 Menjalankan Teardown Pembersihan Data QA...');

    // Restore commission config
    if (outletId && initialCommissionConfig !== null) {
      await prisma.outlet.update({
        where: { id: outletId },
        data: { laundryCommissionConfig: initialCommissionConfig },
      }).catch(() => {});
    }

    // Clean up created orders
    if (createdOrderIds.length > 0) {
      try {
        await prisma.inventoryLedger.deleteMany({
          where: { referenceId: { in: createdOrderIds } },
        });
      } catch (_) {}
      try {
        await prisma.laundryStageLog.deleteMany({
          where: { orderId: { in: createdOrderIds } },
        });
      } catch (_) {}
      try {
        await prisma.laundryOrderDetail.deleteMany({
          where: { orderId: { in: createdOrderIds } },
        });
      } catch (_) {}
      try {
        await prisma.orderItem.deleteMany({
          where: { orderId: { in: createdOrderIds } },
        });
      } catch (_) {}
      try {
        await prisma.order.deleteMany({
          where: { id: { in: createdOrderIds } },
        });
      } catch (_) {}
    }

    // Clean up customer & wallet
    if (createdCustomerIds.length > 0) {
      try {
        await prisma.customerLaundryWalletLedger.deleteMany({
          where: { wallet: { customerId: { in: createdCustomerIds } } },
        });
      } catch (_) {}
      try {
        await prisma.customerLaundryWallet.deleteMany({
          where: { customerId: { in: createdCustomerIds } },
        });
      } catch (_) {}
      try {
        await prisma.customer.deleteMany({
          where: { id: { in: createdCustomerIds } },
        });
      } catch (_) {}
    }

    // Clean up test perfumes & machines
    if (createdPerfumeIds.length > 0) {
      await prisma.laundryPerfume.deleteMany({
        where: { id: { in: createdPerfumeIds } },
      }).catch(() => {});
    }
    if (createdMachineIds.length > 0) {
      await prisma.laundryMachine.deleteMany({
        where: { id: { in: createdMachineIds } },
      }).catch(() => {});
    }

    // Clean up test services
    if (createdServiceIds.length > 0) {
      await prisma.laundryService.deleteMany({
        where: { id: { in: createdServiceIds } },
      }).catch(() => {});
    }

    // Clean up test inventory items & balances
    if (createdItemIds.length > 0) {
      await prisma.inventoryLedger.deleteMany({
        where: { inventoryItemId: { in: createdItemIds } },
      }).catch(() => {});
      await prisma.inventoryBalance.deleteMany({
        where: { inventoryItemId: { in: createdItemIds } },
      }).catch(() => {});
      await prisma.inventoryItem.deleteMany({
        where: { id: { in: createdItemIds } },
      }).catch(() => {});
    }

    // Clean up test users
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      }).catch(() => {});
    }

    await prisma.$disconnect();
    console.log('✓ Teardown data pengujian berhasil dibersihkan secara tuntas.\n');
  }
}

runLaundryFlowIntegrityTest().catch(() => process.exit(1));
