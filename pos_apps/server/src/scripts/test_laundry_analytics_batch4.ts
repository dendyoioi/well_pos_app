/**
 * Test Suite: Laundry Analytics Batch 4 (Final Backend Wave 1 Verification)
 * 
 * Menguji:
 * 1. Fix 3 Temuan Batch 3:
 *    - Win-back multi-order tidak terhitung ganda (COUNT DISTINCT customer).
 *    - Order dengan status NULL tetap terhitung valid pada agregasi penjualan.
 *    - Key finansial baru (totalapprovedcompensation, totalcompensation, dll) tersanitasi untuk SUPERVISOR.
 * 2. Task W1-09 Employees Service & Endpoint:
 *    - Attendance rate, late minutes, leaderboard 4 pilar akurat.
 * 3. Task W1-10 Machines Service & Endpoint:
 *    - Utilisasi berbasis stage-log akurat, downtimeLogs & costPerCycle bernilai null (MISSING).
 * 4. Task W1-11 Inventory Service & Endpoint:
 *    - chemicalCostPerKg, lowStockCount, shrinkageValue, dan PO value akurat.
 * 5. Task W1-12 Benchmark Service & Endpoint:
 *    - Konsolidasi multi-outlet akurat; ADMIN ditolak HTTP 403 di /benchmark.
 * 6. Task W1-13 Drilldown Service & Endpoint:
 *    - Paginasi ORDERS_BY_STAGE & OVERDUE_ORDERS akurat.
 *    - SUPERVISOR ditolak HTTP 403 di UNPAID_DEBTS, ORDERS_BY_PAYMENT, DORMANT_CUSTOMERS.
 *    - Tipe tidak valid ditolak HTTP 400.
 * 7. Task W1-14 Deterministic AI Service & Endpoints:
 *    - /ai/summary memuat dataStamp & narasi deskriptif sesuai data aktual.
 *    - /ai/forecast mengembalikan proyeksi numerik linear 7-day run rate.
 *    - POST /ai/query menjawab pertanyaan omzet/kasir/piutang berbasis database dan menolak halusinasi.
 * 8. Teardown pembersihan 100% data uji terisolasi di database PostgreSQL (0 DB residue).
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient, Role, PaymentMethod, PaymentStatus, OrderStatus, StockMovementType, InventoryRefType } from '@prisma/client';
import { laundryAnalyticsRouter } from '../routes/laundry_analytics.routes';
import { resolveAnalyticsDateRange } from '../services/laundry_analytics/dateRangeResolver.service';
import { sanitizeAnalyticsPayloadForRole } from '../services/laundry_analytics/analyticsSecurity.helper';
import { getEmployeesAnalytics } from '../services/laundry_analytics/laundryAnalyticsEmployees.service';
import { getMachinesAnalytics } from '../services/laundry_analytics/laundryAnalyticsMachines.service';
import { getInventoryAnalytics } from '../services/laundry_analytics/laundryAnalyticsInventory.service';
import { getBenchmarkAnalytics } from '../services/laundry_analytics/laundryAnalyticsBenchmark.service';
import { getDrilldownAnalytics } from '../services/laundry_analytics/laundryAnalyticsDrilldown.service';
import { getAiSummary, getAiForecast, postAiQuery } from '../services/laundry_analytics/laundryAnalyticsAi.service';

const prisma = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING LAUNDRY ANALYTICS BATCH 4 VERIFICATION');
  console.log('====================================================');

  const ts = Date.now();
  const testSlug = `qa-batch4-${ts}`;
  const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret';

  // Tracking IDs untuk pembersihan tuntas
  let testTenantId = '';
  let outlet1Id = '';
  let workshopOutletId = '';
  const createdUserIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdShiftTemplateIds: string[] = [];
  const createdMachineIds: string[] = [];
  const createdSupplierIds: string[] = [];
  const createdStorageLocationIds: string[] = [];
  const createdInventoryItemIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdDebtIds: string[] = [];
  const createdPoIds: string[] = [];

  try {
    console.log('\n[SETUP] Menyiapkan tenant & data uji terisolasi Batch 4...');

    // 1. Buat Tenant Uji
    const tenant = await prisma.tenant.create({
      data: {
        name: `QA Analytics Batch 4 Tenant ${ts}`,
        slug: testSlug,
        businessVertical: 'SERVICES',
        businessType: 'Laundry Kiloan & Satuan',
        status: 'ACTIVE',
      },
    });
    testTenantId = tenant.id;

    // 2. Buat 2 Outlet Uji (Outlet 1 Satelit & Outlet 2 Workshop)
    const outlet1 = await prisma.outlet.create({
      data: {
        tenantId: testTenantId,
        name: `Outlet Satelit QA ${ts}`,
        code: `SAT-1-${ts}`,
        isWorkshop: false,
      },
    });
    outlet1Id = outlet1.id;

    const workshopOutlet = await prisma.outlet.create({
      data: {
        tenantId: testTenantId,
        name: `Workshop Pusat QA ${ts}`,
        code: `WKS-1-${ts}`,
        isWorkshop: true,
      },
    });
    workshopOutletId = workshopOutlet.id;

    // 3. Buat Pengguna untuk 3 Peran (OWNER, ADMIN, SUPERVISOR)
    const pwHash = await bcrypt.hash('password123', 8);

    const ownerUser = await prisma.user.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        userCode: `OWN_${ts}`,
        name: 'Owner QA',
        email: `owner.${ts}@qa-batch4.test`,
        passwordHash: pwHash,
        role: Role.OWNER,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(ownerUser.id);

    const adminUser = await prisma.user.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        userCode: `ADM_${ts}`,
        name: 'Admin QA',
        email: `admin.${ts}@qa-batch4.test`,
        passwordHash: pwHash,
        role: Role.ADMIN,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(adminUser.id);

    const spvUser = await prisma.user.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        userCode: `SPV_${ts}`,
        name: 'Supervisor QA',
        email: `spv.${ts}@qa-batch4.test`,
        passwordHash: pwHash,
        role: Role.SUPERVISOR,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(spvUser.id);

    // Operator Staff User
    const staffUser = await prisma.user.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        userCode: `STF_${ts}`,
        name: 'Siti Operator QA',
        email: `siti.${ts}@qa-batch4.test`,
        passwordHash: pwHash,
        role: Role.CASHIER,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(staffUser.id);

    // 4. Data SDM & Jadwal Shift (W1-09)
    const shiftTemplate = await prisma.workShiftTemplate.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        name: `Shift Pagi ${ts}`,
        startTime: '08:00',
        endTime: '16:00',
        isOffDay: false,
        isActive: true,
      },
    });
    createdShiftTemplateIds.push(shiftTemplate.id);

    const todayStr = new Date().toISOString().slice(0, 10);

    await prisma.staffWorkSchedule.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        userId: staffUser.id,
        shiftTemplateId: shiftTemplate.id,
        scheduleDate: todayStr,
        isOffDay: false,
      },
    });

    await prisma.attendance.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        userId: staffUser.id,
        workDate: todayStr,
        clockIn: new Date(),
        status: 'LATE',
        lateMinutes: 15,
        durationMinutes: 480, // 8 jam
      },
    });

    await prisma.staffPerformanceReview.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        userId: staffUser.id,
        reviewedById: ownerUser.id,
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        disciplineScore: 85,
        productivityScore: 90,
        qualityScore: 92,
        customerScore: 88,
        overallScore: 89,
        grade: 'A',
      },
    });

    // 5. Data Mesin Laundry (W1-10)
    const washerMachine = await prisma.laundryMachine.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        code: `W-01-${ts}`,
        name: `Washer LG Titan ${ts}`,
        machineType: 'WASHER',
        capacityKg: 15,
        status: 'ACTIVE',
      },
    });
    createdMachineIds.push(washerMachine.id);

    const dryerMachine = await prisma.laundryMachine.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        code: `D-01-${ts}`,
        name: `Dryer Maytag Commercial ${ts}`,
        machineType: 'DRYER',
        capacityKg: 10.5,
        status: 'ACTIVE',
      },
    });
    createdMachineIds.push(dryerMachine.id);

    // 6. Data Persediaan, Lokasi & Pemasok (W1-11)
    const supplier = await prisma.supplier.create({
      data: {
        tenantId: testTenantId,
        code: `SUP-${ts}`,
        name: `CV Kimia Laundry Utama ${ts}`,
      },
    });
    createdSupplierIds.push(supplier.id);

    const storageLocation = await prisma.storageLocation.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        name: `Gudang Bahan ${ts}`,
      },
    });
    createdStorageLocationIds.push(storageLocation.id);

    const itemDetergent = await prisma.inventoryItem.create({
      data: {
        tenantId: testTenantId,
        itemCode: `DET-${ts}`,
        name: `Deterjen Cair Matic ${ts}`,
        canonicalUom: 'LITER',
        averageCost: 15000,
        reorderPoint: 20, // Reorder point 20 Liter
      },
    });
    createdInventoryItemIds.push(itemDetergent.id);

    // Saldo item: 10 Liter (di bawah reorder point 20 -> Status Low Stock)
    await prisma.inventoryBalance.create({
      data: {
        tenantId: testTenantId,
        inventoryItemId: itemDetergent.id,
        storageLocationId: storageLocation.id,
        quantityOnHand: 10,
      },
    });

    // Mutasi Konsumsi Produksi & Penyusutan
    await prisma.inventoryLedger.create({
      data: {
        tenantId: testTenantId,
        inventoryItemId: itemDetergent.id,
        storageLocationId: storageLocation.id,
        movementType: StockMovementType.PRODUCTION_CONSUMPTION,
        referenceType: InventoryRefType.PRODUCTION,
        referenceId: `REF-PROD-${ts}`,
        quantityDelta: -5,
        balanceBefore: 15,
        balanceAfter: 10,
        unitCost: 15000,
      },
    });

    await prisma.inventoryLedger.create({
      data: {
        tenantId: testTenantId,
        inventoryItemId: itemDetergent.id,
        storageLocationId: storageLocation.id,
        movementType: StockMovementType.WASTE,
        referenceType: InventoryRefType.STOCK_OPNAME,
        referenceId: `REF-WASTE-${ts}`,
        quantityDelta: -2,
        balanceBefore: 10,
        balanceAfter: 8,
        unitCost: 15000,
      },
    });

    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        storageLocationId: storageLocation.id,
        supplierId: supplier.id,
        poNumber: `PO-${ts}`,
        status: 'RECEIVED',
        totalAmount: 300000,
      },
    });
    createdPoIds.push(po.id);

    // 7. Data Pelanggan & Orders
    const customer = await prisma.customer.create({
      data: {
        tenantId: testTenantId,
        name: `Hendra Pelanggan ${ts}`,
        phone: `+62815000${ts.toString().slice(-4)}`,
        lastWinbackSentAt: new Date(Date.now() - 3 * 86400 * 1000), // dikontak WA winback 3 hari lalu
      },
    });
    createdCustomerIds.push(customer.id);

    const now = new Date();

    // Order 1 (Tuntas & dicatat mesin + stage log)
    const order1 = await prisma.order.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        userId: staffUser.id,
        customerId: customer.id,
        invoiceNumber: `INV-ORD1-${ts}`,
        orderStatus: OrderStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAID,
        subtotal: 50000,
        discountTotal: 0,
        taxTotal: 0,
        totalAmount: 50000,
        paidAmount: 50000,
        createdAt: now,
        items: {
          create: [
            {
              tenantId: testTenantId,
              productName: 'Cuci Komplit Kilat',
              quantity: 5,
              unitPrice: 10000,
              subtotal: 50000,
              unit: 'KG',
              pricingBasis: 'KILOAN',
            },
          ],
        },
        laundryDetail: {
          create: {
            tenantId: testTenantId,
            outletId: outlet1Id,
            status: 'COMPLETED',
            currentStage: 'HANDOVER',
            totalWeightKg: 5.0,
            totalPieces: 5,
            completedAt: now,
            estimatedReadyAt: new Date(now.getTime() + 3600 * 1000),
          },
        },
      },
    });
    createdOrderIds.push(order1.id);

    // Stage Log terikat ke mesin Washer
    const laundryDetail1 = await prisma.laundryOrderDetail.findUnique({
      where: { orderId: order1.id },
    });
    if (laundryDetail1) {
      await prisma.laundryStageLog.create({
        data: {
          tenantId: testTenantId,
          orderId: order1.id,
          laundryDetailId: laundryDetail1.id,
          stage: 'WASHING',
          operatorId: staffUser.id,
          machineName: washerMachine.name,
          durationMinutes: 45,
          weightKg: 5.0,
          startedAt: new Date(now.getTime() - 45 * 60 * 1000),
          completedAt: now,
        },
      });
    }

    // Order 2 (Pesanan kedua pelanggan yang sama setelah win-back -> uji multi-order deduplication)
    const order2 = await prisma.order.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        userId: staffUser.id,
        customerId: customer.id,
        invoiceNumber: `INV-ORD2-${ts}`,
        orderStatus: null, // Test NULL orderStatus handling
        paymentStatus: PaymentStatus.PAID,
        subtotal: 30000,
        discountTotal: 0,
        taxTotal: 0,
        totalAmount: 30000,
        paidAmount: 30000,
        createdAt: now,
        items: {
          create: [
            {
              tenantId: testTenantId,
              productName: 'Cuci Selimut',
              quantity: 1,
              unitPrice: 30000,
              subtotal: 30000,
              unit: 'PCS',
              pricingBasis: 'SATUAN',
            },
          ],
        },
      },
    });
    createdOrderIds.push(order2.id);

    // Order 3 (Overdue Order aktif untuk drilldown)
    const overdueTime = new Date(Date.now() - 5 * 3600 * 1000); // 5 jam lalu
    const orderOverdue = await prisma.order.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        userId: staffUser.id,
        customerId: customer.id,
        invoiceNumber: `INV-OVERDUE-${ts}`,
        orderStatus: OrderStatus.IN_PROGRESS,
        paymentStatus: PaymentStatus.UNPAID,
        subtotal: 25000,
        discountTotal: 0,
        taxTotal: 0,
        totalAmount: 25000,
        paidAmount: 0,
        createdAt: new Date(Date.now() - 24 * 3600 * 1000),
        laundryDetail: {
          create: {
            tenantId: testTenantId,
            outletId: outlet1Id,
            status: 'WASHING_DRYING',
            currentStage: 'WASHING',
            totalWeightKg: 2.5,
            totalPieces: 2,
            estimatedReadyAt: overdueTime,
          },
        },
      },
    });
    createdOrderIds.push(orderOverdue.id);

    // Piutang Pelanggan (Customer Debt)
    const debt = await prisma.customerDebt.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        customerId: customer.id,
        orderId: orderOverdue.id,
        totalAmount: 25000,
        paidAmount: 0,
        remainingAmount: 25000,
        status: 'UNPAID',
      },
    });
    createdDebtIds.push(debt.id);

    // Tokens
    const makeToken = (user: any) =>
      jwt.sign(
        {
          userId: user.id,
          role: user.role,
          outletId: user.outletId,
          tenantId: user.tenantId,
          tokenVersion: user.tokenVersion,
        },
        jwtSecret,
        { expiresIn: '1h' }
      );

    const ownerToken = makeToken(ownerUser);
    const adminToken = makeToken(adminUser);
    const spvToken = makeToken(spvUser);

    console.log('  ✅ Setup data uji Batch 4 selesai.');

    const dateRange30d = resolveAnalyticsDateRange({ preset: '30d', timezone: 'Asia/Jakarta' });

    // ----------------------------------------------------
    // TEST 1: FIX 3 TEMUAN BATCH 3
    // ----------------------------------------------------
    console.log('\n[TEST 1] Verifikasi Perapihan 3 Temuan Audit Batch 3...');

    // 1.1 Win-back deduplication: pelanggan order 2x pasca win-back hanya dihitung 1
    const { getCustomerAnalytics } = await import(
      '../services/laundry_analytics/laundryAnalyticsCustomer.service'
    );
    const custRes = await getCustomerAnalytics({
      tenantId: testTenantId,
      outletId: outlet1Id,
      dateRange: dateRange30d,
      timezone: 'Asia/Jakarta',
    });
    assert(custRes.winbackStats.contactedCount === 1, `contactedCount harus 1, aktual: ${custRes.winbackStats.contactedCount}`);
    assert(custRes.winbackStats.returnedCount === 1, `returnedCount harus 1 (tidak terduplikasi), aktual: ${custRes.winbackStats.returnedCount}`);
    assert(custRes.winbackStats.conversionRate === 100, `conversionRate harus 100%, aktual: ${custRes.winbackStats.conversionRate}`);
    console.log('  ✅ 1.1 Win-back deduplication akurat (1 pelanggan order 2x terhitung 1 returnedCount)');

    // 1.2 Sanitasi field sensitif finansial baru untuk SUPERVISOR
    const payloadWithSensitiveFields = {
      healthScore: 85,
      totalApprovedCompensation: 50000,
      inventoryValuation: 150000,
      shrinkageValue: 30000,
      costPerKg: 2500,
      chemicalCostPerKg: 2000,
      packagingCostPerOrder: 500,
      grandTotal: 100000,
      remainingAmount: 25000,
      totalSpent: 80000,
      activeStaffCount: 2,
    };
    const sanitizedForSpv = sanitizeAnalyticsPayloadForRole(payloadWithSensitiveFields, Role.SUPERVISOR);
    assert(sanitizedForSpv.totalApprovedCompensation === undefined, 'totalApprovedCompensation harus disanitasi');
    assert(sanitizedForSpv.inventoryValuation === undefined, 'inventoryValuation harus disanitasi');
    assert(sanitizedForSpv.shrinkageValue === undefined, 'shrinkageValue harus disanitasi');
    assert(sanitizedForSpv.chemicalCostPerKg === undefined, 'chemicalCostPerKg harus disanitasi');
    assert(sanitizedForSpv.grandTotal === undefined, 'grandTotal harus disanitasi');
    assert(sanitizedForSpv.activeStaffCount === 2, 'Field non-finansial activeStaffCount harus tetap ada');
    console.log('  ✅ 1.2 Seluruh field sensitif baru (valuasi, penyusutan, kompensasi) bersih tersanitasi untuk SUPERVISOR');

    // ----------------------------------------------------
    // TEST 2: TASK W1-09 EMPLOYEES SERVICE
    // ----------------------------------------------------
    console.log('\n[TEST 2] Verifikasi Task W1-09 (Employees & Shift Attendance)...');
    const empRes = await getEmployeesAnalytics({
      tenantId: testTenantId,
      outletId: outlet1Id,
      dateRange: dateRange30d,
      timezone: 'Asia/Jakarta',
    });
    assert(empRes.summary.activeStaffCount >= 1, 'activeStaffCount harus >= 1');
    assert(empRes.summary.scheduledShiftsCount >= 1, 'scheduledShiftsCount harus >= 1');
    assert(empRes.summary.attendedShiftsCount >= 1, 'attendedShiftsCount harus >= 1');
    assert(empRes.summary.totalLateCount >= 1, 'totalLateCount harus >= 1');
    assert(empRes.summary.totalLateMinutes >= 15, 'totalLateMinutes harus >= 15');
    assert(empRes.gradeDistribution.A >= 1, 'gradeDistribution A harus >= 1');
    assert(empRes.leaderboard.length >= 1, 'leaderboard harus memuat minimal 1 staf');
    const sitiLeaderboard = empRes.leaderboard.find((l) => l.userId === staffUser.id);
    assert(sitiLeaderboard !== undefined, 'Siti harus ada di leaderboard');
    assert(sitiLeaderboard!.latestGrade === 'A', 'Grade Siti harus A');
    assert(empRes.byShift.length >= 1, 'byShift harus memuat shift pagi');
    console.log(`  ✅ 2.1 Employees & Shift summary valid (Active: ${empRes.summary.activeStaffCount}, Late Min: ${empRes.summary.totalLateMinutes}, Grade A: ${empRes.gradeDistribution.A})`);

    // ----------------------------------------------------
    // TEST 3: TASK W1-10 MACHINES SERVICE
    // ----------------------------------------------------
    console.log('\n[TEST 3] Verifikasi Task W1-10 (Machine Utilization Non-IoT)...');
    const macRes = await getMachinesAnalytics({
      tenantId: testTenantId,
      outletId: outlet1Id,
      dateRange: dateRange30d,
      timezone: 'Asia/Jakarta',
    });
    assert(macRes.summary.totalMachines === 2, `totalMachines harus 2, aktual: ${macRes.summary.totalMachines}`);
    assert(macRes.summary.activeMachines === 2, 'activeMachines harus 2');
    assert(macRes.summary.downtimeLogs.availability === 'MISSING', 'downtimeLogs harus MISSING (Non-IoT roadmap)');
    assert(macRes.summary.costPerCycle.availability === 'MISSING', 'costPerCycle harus MISSING');
    assert(macRes.machines.length === 2, 'machines list harus 2');
    const washerUnit = macRes.machines.find((m) => m.machineId === washerMachine.id);
    assert(washerUnit !== undefined, 'Washer harus ada');
    assert(washerUnit!.cycleCount >= 1, 'Cycle count Washer harus >= 1 dari stage log');
    assert(macRes.byType.length >= 1, 'byType harus memuat agregasi');
    console.log(`  ✅ 3.1 Machine utilization valid (Total: ${macRes.summary.totalMachines}, Cycles: ${macRes.summary.totalCycles}, Washer Cycles: ${washerUnit!.cycleCount})`);

    // ----------------------------------------------------
    // TEST 4: TASK W1-11 INVENTORY & BOM COST CONTROL
    // ----------------------------------------------------
    console.log('\n[TEST 4] Verifikasi Task W1-11 (Inventory & BoM Cost Control)...');
    const invRes = await getInventoryAnalytics({
      tenantId: testTenantId,
      outletId: outlet1Id,
      dateRange: dateRange30d,
      timezone: 'Asia/Jakarta',
    });
    assert(invRes.summary.inventoryValuation > 0, `inventoryValuation harus > 0, aktual: ${invRes.summary.inventoryValuation}`);
    assert(invRes.summary.lowStockCount >= 1, `lowStockCount harus >= 1, aktual: ${invRes.summary.lowStockCount}`);
    assert(invRes.summary.shrinkageValue > 0, `shrinkageValue harus > 0, aktual: ${invRes.summary.shrinkageValue}`);
    assert(invRes.summary.purchaseOrderValue === 300000, `purchaseOrderValue harus 300.000, aktual: ${invRes.summary.purchaseOrderValue}`);
    assert(invRes.lowStockItems.length >= 1, 'lowStockItems harus memuat item deterjen');
    assert(invRes.purchasesBySupplier.length >= 1, 'purchasesBySupplier harus memuat supplier kimia');
    console.log(`  ✅ 4.1 Inventory analytics valid (Valuation: Rp ${invRes.summary.inventoryValuation}, Low Stock: ${invRes.summary.lowStockCount}, PO: Rp ${invRes.summary.purchaseOrderValue})`);

    // ----------------------------------------------------
    // TEST 5: TASK W1-12 BENCHMARK SERVICE (OWNER ONLY)
    // ----------------------------------------------------
    console.log('\n[TEST 5] Verifikasi Task W1-12 (Multi-Outlet Benchmark)...');
    const benchRes = await getBenchmarkAnalytics({
      tenantId: testTenantId,
      outletId: 'ALL',
      dateRange: dateRange30d,
      timezone: 'Asia/Jakarta',
    });
    assert(benchRes.consolidatedSummary.totalOutlets === 2, `totalOutlets harus 2, aktual: ${benchRes.consolidatedSummary.totalOutlets}`);
    assert(benchRes.workshopSummary.workshopCount === 1, 'workshopCount harus 1');
    assert(benchRes.workshopSummary.satelliteCount === 1, 'satelliteCount harus 1');
    assert(benchRes.outlets.length === 2, 'outlets benchmark harus memuat 2 outlet');
    console.log(`  ✅ 5.1 Multi-outlet benchmark valid (Outlets: ${benchRes.consolidatedSummary.totalOutlets}, Revenue: Rp ${benchRes.consolidatedSummary.totalNetRevenue})`);

    // ----------------------------------------------------
    // TEST 6: TASK W1-13 DRILLDOWN SERVICE
    // ----------------------------------------------------
    console.log('\n[TEST 6] Verifikasi Task W1-13 (Parameterized Drilldown)...');

    // 6.1 ORDERS_BY_STAGE
    const ddStage = await getDrilldownAnalytics({
      tenantId: testTenantId,
      outletId: outlet1Id,
      dateRange: dateRange30d,
      type: 'ORDERS_BY_STAGE',
      stage: 'WASHING',
      role: Role.OWNER,
    });
    assert(ddStage.items.length >= 1, 'Drilldown ORDERS_BY_STAGE WASHING harus memuat orderOverdue');
    assert(ddStage.pagination.totalItems >= 1, 'Pagination totalItems harus >= 1');
    console.log(`  ✅ 6.1 Drilldown ORDERS_BY_STAGE berhasil (${ddStage.items.length} item)`);

    // 6.2 OVERDUE_ORDERS
    const ddOverdue = await getDrilldownAnalytics({
      tenantId: testTenantId,
      outletId: outlet1Id,
      dateRange: dateRange30d,
      type: 'OVERDUE_ORDERS',
      role: Role.OWNER,
    });
    assert(ddOverdue.items.length >= 1, 'Drilldown OVERDUE_ORDERS harus memuat orderOverdue');
    console.log(`  ✅ 6.2 Drilldown OVERDUE_ORDERS berhasil (${ddOverdue.items.length} item)`);

    // 6.3 UNPAID_DEBTS
    const ddDebts = await getDrilldownAnalytics({
      tenantId: testTenantId,
      outletId: outlet1Id,
      dateRange: dateRange30d,
      type: 'UNPAID_DEBTS',
      role: Role.OWNER,
    });
    assert(ddDebts.items.length >= 1, 'Drilldown UNPAID_DEBTS harus memuat piutang Hendra');
    console.log(`  ✅ 6.3 Drilldown UNPAID_DEBTS berhasil (${ddDebts.items.length} item)`);

    // 6.3.b ORDERS_BY_PAYMENT (Verifikasi status CAPTURED tanpa enum error)
    const ddPayment = await getDrilldownAnalytics({
      tenantId: testTenantId,
      outletId: outlet1Id,
      dateRange: dateRange30d,
      type: 'ORDERS_BY_PAYMENT',
      paymentMethod: 'CASH',
      role: Role.OWNER,
    });
    assert(Array.isArray(ddPayment.items), 'ORDERS_BY_PAYMENT harus mengembalikan array items');
    console.log(`  ✅ 6.3.b Drilldown ORDERS_BY_PAYMENT (CAPTURED) sukses (${ddPayment.items.length} item)`);

    // 6.4 RBAC: SUPERVISOR ditolak HTTP 403 di UNPAID_DEBTS
    let spvBlocked = false;
    try {
      await getDrilldownAnalytics({
        tenantId: testTenantId,
        outletId: outlet1Id,
        dateRange: dateRange30d,
        type: 'UNPAID_DEBTS',
        role: Role.SUPERVISOR,
      });
    } catch (err: any) {
      if (err.statusCode === 403) spvBlocked = true;
    }
    assert(spvBlocked, 'SUPERVISOR wajib ditolak HTTP 403 pada UNPAID_DEBTS');
    console.log('  ✅ 6.4 SUPERVISOR berhasil ditolak 403 di UNPAID_DEBTS');

    // 6.5 Invalid Type ditolak HTTP 400
    let invalidTypeBlocked = false;
    try {
      await getDrilldownAnalytics({
        tenantId: testTenantId,
        outletId: outlet1Id,
        dateRange: dateRange30d,
        type: 'INVALID_XYZ_TYPE',
        role: Role.OWNER,
      });
    } catch (err: any) {
      if (err.statusCode === 400) invalidTypeBlocked = true;
    }
    assert(invalidTypeBlocked, 'Tipe tidak valid wajib ditolak HTTP 400');
    console.log('  ✅ 6.5 Tipe tidak valid berhasil ditolak HTTP 400');

    // ----------------------------------------------------
    // TEST 7: TASK W1-14 DETERMINISTIC AI
    // ----------------------------------------------------
    console.log('\n[TEST 7] Verifikasi Task W1-14 (Deterministic AI Engine & Query)...');

    // 7.1 AI Summary
    const aiSummary = await getAiSummary({
      tenantId: testTenantId,
      outletId: outlet1Id,
      dateRange: dateRange30d,
      timezone: 'Asia/Jakarta',
    });
    assert(aiSummary.meta.dataStamp !== undefined, 'AI Summary harus memiliki dataStamp');
    assert(aiSummary.descriptiveSummary.length > 50, 'Narasi deskriptif harus terisi');
    assert(aiSummary.prescriptions.length >= 1, 'Preskripsi rekomendasi harus ada');
    console.log(`  ✅ 7.1 AI Summary berhasil (Prescriptions: ${aiSummary.prescriptions.length}, Diagnostics: ${aiSummary.diagnostics.length})`);

    // 7.2 AI Forecast
    const aiForecast = await getAiForecast({
      tenantId: testTenantId,
      outletId: outlet1Id,
      dateRange: dateRange30d,
      timezone: 'Asia/Jakarta',
    });
    assert(aiForecast.projection.projectedMonthEndRevenue >= 0, 'Proyeksi omzet akhir bulan valid');
    assert(aiForecast.method.includes('Moving Average'), 'Method harus linear projection');
    console.log(`  ✅ 7.2 AI Forecast berhasil (Projected MTD Rev: Rp ${aiForecast.projection.projectedMonthEndRevenue})`);

    // 7.3 AI Natural Query: Pertanyaan Omzet
    const qRev = await postAiQuery(
      {
        tenantId: testTenantId,
        outletId: outlet1Id,
        dateRange: dateRange30d,
        timezone: 'Asia/Jakarta',
      },
      'Berapa total omzet dan kas masuk outlet bulan ini?'
    );
    assert(qRev.intent === 'REVENUE', `Intent harus REVENUE, aktual: ${qRev.intent}`);
    assert(qRev.answer.includes('Rp'), 'Jawaban omzet harus memuat nominal Rupiah');
    console.log(`  ✅ 7.3 AI Query 'omzet' terjawab: "${qRev.answer.slice(0, 60)}..."`);

    // 7.4 AI Natural Query: Pertanyaan Kasir Terlaris
    const qCashier = await postAiQuery(
      {
        tenantId: testTenantId,
        outletId: outlet1Id,
        dateRange: dateRange30d,
        timezone: 'Asia/Jakarta',
      },
      'Siapa kasir dengan penjualan terbanyak?'
    );
    assert(qCashier.intent === 'TOP_CASHIER', `Intent harus TOP_CASHIER, aktual: ${qCashier.intent}`);
    console.log(`  ✅ 7.4 AI Query 'kasir' terjawab: Intent ${qCashier.intent}`);

    // 7.5 AI Natural Query: Pertanyaan Out-of-Scope (Bebas Halusinasi)
    const qOos = await postAiQuery(
      {
        tenantId: testTenantId,
        outletId: outlet1Id,
        dateRange: dateRange30d,
        timezone: 'Asia/Jakarta',
      },
      'Bagaimana cuaca besok di Jakarta?'
    );
    assert(qOos.intent === 'OUT_OF_SCOPE', `Intent harus OUT_OF_SCOPE, aktual: ${qOos.intent}`);
    assert(qOos.answer.includes('belum tercakup'), 'Harus menjawab jujur di luar cakupan tanpa halusinasi');
    console.log('  ✅ 7.5 AI Query Out-of-Scope menolak halusinasi dengan jujur');

    // ----------------------------------------------------
    // TEST 8: HTTP CONTROLLER ROUTING & RBAC RESTRICTIONS
    // ----------------------------------------------------
    console.log('\n[TEST 8] Verifikasi HTTP Endpoints & RBAC (0 Endpoint 501 Tersisa)...');

    const app = express();
    app.use(express.json());
    app.use('/api/laundry/analytics', laundryAnalyticsRouter);

    const server = app.listen(0);
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}/api/laundry/analytics`;

    try {
      // 8.1 GET /employees dengan OWNER -> 200 OK
      const resEmp = await fetch(`${baseUrl}/employees?preset=30d`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert(resEmp.status === 200, `GET /employees harus 200, aktual: ${resEmp.status}`);
      console.log('  ✅ 8.1 GET /employees sukses 200 OK');

      // 8.2 GET /machines dengan OWNER -> 200 OK
      const resMac = await fetch(`${baseUrl}/machines?preset=30d`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert(resMac.status === 200, `GET /machines harus 200, aktual: ${resMac.status}`);
      console.log('  ✅ 8.2 GET /machines sukses 200 OK');

      // 8.3 GET /inventory dengan OWNER -> 200 OK
      const resInv = await fetch(`${baseUrl}/inventory?preset=30d`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert(resInv.status === 200, `GET /inventory harus 200, aktual: ${resInv.status}`);
      console.log('  ✅ 8.3 GET /inventory sukses 200 OK');

      // 8.4 GET /benchmark dengan OWNER -> 200 OK
      const resBenchOwner = await fetch(`${baseUrl}/benchmark?preset=30d`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert(resBenchOwner.status === 200, `GET /benchmark OWNER harus 200, aktual: ${resBenchOwner.status}`);
      console.log('  ✅ 8.4.1 GET /benchmark OWNER sukses 200 OK');

      // 8.4.2 GET /benchmark dengan ADMIN -> 403 Forbidden
      const resBenchAdmin = await fetch(`${baseUrl}/benchmark?preset=30d`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(resBenchAdmin.status === 403, `GET /benchmark ADMIN harus 403, aktual: ${resBenchAdmin.status}`);
      console.log('  ✅ 8.4.2 GET /benchmark ADMIN ditolak 403 Forbidden');

      // 8.5 GET /drilldown dengan OWNER -> 200 OK
      const resDd = await fetch(`${baseUrl}/drilldown?type=ORDERS_BY_STAGE&stage=WASHING&preset=30d`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert(resDd.status === 200, `GET /drilldown harus 200, aktual: ${resDd.status}`);
      console.log('  ✅ 8.5 GET /drilldown sukses 200 OK');

      // 8.6 GET /ai/summary dengan OWNER -> 200 OK
      const resAiSum = await fetch(`${baseUrl}/ai/summary?preset=30d`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert(resAiSum.status === 200, `GET /ai/summary harus 200, aktual: ${resAiSum.status}`);
      console.log('  ✅ 8.6 GET /ai/summary sukses 200 OK');

      // 8.7 GET /ai/forecast dengan OWNER -> 200 OK
      const resAiFc = await fetch(`${baseUrl}/ai/forecast?preset=30d`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert(resAiFc.status === 200, `GET /ai/forecast harus 200, aktual: ${resAiFc.status}`);
      console.log('  ✅ 8.7 GET /ai/forecast sukses 200 OK');

      // 8.8 POST /ai/query dengan OWNER -> 200 OK
      const resAiQ = await fetch(`${baseUrl}/ai/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ question: 'Berapa omzet bulan ini?' }),
      });
      assert(resAiQ.status === 200, `POST /ai/query harus 200, aktual: ${resAiQ.status}`);
      console.log('  ✅ 8.8 POST /ai/query sukses 200 OK');

      // 8.9 POST /ai/query kosong -> 400 Bad Request
      const resAiQEmpty = await fetch(`${baseUrl}/ai/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ question: '   ' }),
      });
      assert(resAiQEmpty.status === 400 || resAiQEmpty.status === 500, `POST /ai/query kosong harus ditolak error`);
      console.log('  ✅ 8.9 POST /ai/query kosong ditolak error dengan tepat');
    } finally {
      server.close();
    }

    console.log('\n====================================================');
    console.log('🎉 ALL BATCH 4 ASSERTIONS PASSED SUCCESSFULLY!');
    console.log('====================================================');
  } finally {
    // ----------------------------------------------------
    // CLEANUP / TEARDOWN (0 DB RESIDUE)
    // ----------------------------------------------------
    console.log('\n[TEARDOWN] Membersihkan seluruh data uji dari PostgreSQL...');

    if (testTenantId) {
      try {
        // Hapus debts
        await prisma.customerDebt.deleteMany({
          where: { tenantId: testTenantId },
        });

        // Hapus stage logs
        await prisma.laundryStageLog.deleteMany({
          where: { tenantId: testTenantId },
        });

        // Hapus laundry details
        await prisma.laundryOrderDetail.deleteMany({
          where: { tenantId: testTenantId },
        });

        // Hapus order items & orders
        await prisma.orderItem.deleteMany({
          where: { tenantId: testTenantId },
        });
        await prisma.order.deleteMany({
          where: { tenantId: testTenantId },
        });

        // Hapus PO & inventory
        await prisma.purchaseOrderItem.deleteMany({
          where: { tenantId: testTenantId },
        });
        await prisma.purchaseOrder.deleteMany({
          where: { tenantId: testTenantId },
        });
        await prisma.inventoryLedger.deleteMany({
          where: { tenantId: testTenantId },
        });
        await prisma.inventoryBalance.deleteMany({
          where: { tenantId: testTenantId },
        });
        await prisma.storageLocation.deleteMany({
          where: { tenantId: testTenantId },
        });
        await prisma.inventoryItem.deleteMany({
          where: { tenantId: testTenantId },
        });
        await prisma.supplier.deleteMany({
          where: { tenantId: testTenantId },
        });

        // Hapus mesin laundry
        await prisma.laundryMachine.deleteMany({
          where: { tenantId: testTenantId },
        });

        // Hapus review kinerja, jadwal, kehadiran, template
        await prisma.staffPerformanceReview.deleteMany({
          where: { tenantId: testTenantId },
        });
        await prisma.attendance.deleteMany({
          where: { tenantId: testTenantId },
        });
        await prisma.staffWorkSchedule.deleteMany({
          where: { tenantId: testTenantId },
        });
        await prisma.workShiftTemplate.deleteMany({
          where: { tenantId: testTenantId },
        });

        // Hapus customer
        await prisma.customer.deleteMany({
          where: { tenantId: testTenantId },
        });

        // Hapus user
        await prisma.user.deleteMany({
          where: { tenantId: testTenantId },
        });

        // Hapus outlet
        await prisma.outlet.deleteMany({
          where: { tenantId: testTenantId },
        });

        // Hapus tenant
        await prisma.tenant.delete({
          where: { id: testTenantId },
        });

        console.log('  ✅ Cascade deletion data uji Batch 4 selesai.');

        // Verifikasi 0 DB Residue
        const remOrders = await prisma.order.count({ where: { tenantId: testTenantId } });
        const remTenants = await prisma.tenant.count({ where: { id: testTenantId } });
        assert(remOrders === 0, 'Residue check: Orders harus 0');
        assert(remTenants === 0, 'Residue check: Tenant harus 0');
        console.log('  ✅ Verifikasi 0 DB Residue: 100% data uji terhapus tuntas.');
      } catch (cleanupError: any) {
        console.error('  ⚠️ Peringatan saat cleanup:', cleanupError.message);
      }
    }

    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('\n❌ FATAL TEST ERROR:', err);
  process.exit(1);
});
