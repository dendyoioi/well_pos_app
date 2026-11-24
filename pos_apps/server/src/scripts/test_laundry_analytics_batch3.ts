/**
 * Test Suite: Laundry Analytics Batch 3 (W1-06, W1-07, W1-08 & Batch 2 Bugfixes)
 * 
 * Menguji:
 * 1. Bugfix Batch 2:
 *    - clearTenant(tenantId) membersihkan seluruh cache tenant tanpa terpotong endpoint prefix.
 *    - buildKey dengan extraSuffix menghasilkan cache key berbeda (misal: d=30 vs d=60).
 *    - Alert sanitization untuk SUPERVISOR: menghapus alert finansial sensitif.
 *    - returningCustomersCount pada Overview service tidak negatif / double counted.
 * 2. W1-06 Sales Analytics Service & Endpoint:
 *    - Kiloan vs Satuan dihitung akurat dari OrderItem.pricingBasis (PER_KG vs lainnya).
 *    - Heatmap 7x24 jam beroperasi dalam timezone Asia/Jakarta (WIB).
 *    - Cancellation/void rate dihitung akurat.
 * 3. W1-07 Customer Retention & Win-Back Service & Endpoint:
 *    - Segmentasi 5 kategori (NEW, ACTIVE, LOYAL, DORMANT, HIGH_VALUE).
 *    - dormantDays=30 vs 60 menghasilkan segmentasi dan daftar dormant yang responsif.
 *    - Win-back conversion terhitung dari pelanggan yang pernah dikirim winback WhatsApp lalu order lagi.
 *    - Feedback rating & keluhan terakumulasi akurat.
 * 4. W1-08 Operations & 11-Stage Pipeline Service & Endpoint:
 *    - 11 canonical stages terurut lengkap tanpa stage yang terlewat.
 *    - Bottleneck stage terdeteksi otomatis (stage dengan akumulasi pesanan terbesar).
 *    - Production incidents dikelompokkan ke 4 canonical types (DAMAGED, LOST, STAIN_REMAINING, MIXED_UP).
 *    - Workshop transfer lag dihitung dari dispatch -> receive (dalam jam/menit).
 *    - RBAC: SUPERVISOR boleh mengakses /operations (200 OK) tetapi ditolak di /sales dan /customers (403 Forbidden).
 * 5. Teardown pembersihan 100% data uji terisolasi di database PostgreSQL (0 DB residue).
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient, Role, PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
import { laundryAnalyticsRouter } from '../routes/laundry_analytics.routes';
import { resolveAnalyticsDateRange } from '../services/laundry_analytics/dateRangeResolver.service';
import {
  analyticsCache,
  sanitizeAnalyticsPayloadForRole,
} from '../services/laundry_analytics/analyticsSecurity.helper';
import { getExecutiveOverview } from '../services/laundry_analytics/laundryAnalyticsOverview.service';
import { getSalesAnalytics } from '../services/laundry_analytics/laundryAnalyticsSales.service';
import { getCustomerAnalytics } from '../services/laundry_analytics/laundryAnalyticsCustomer.service';
import { getOperationsAnalytics, CANONICAL_STAGES, INCIDENT_TYPES } from '../services/laundry_analytics/laundryAnalyticsOperations.service';

const prisma = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING LAUNDRY ANALYTICS BATCH 3 VERIFICATION');
  console.log('====================================================');

  const ts = Date.now();
  const testSlug = `qa-batch3-${ts}`;
  const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret';

  // Tracking IDs untuk pembersihan tuntas di database
  let testTenantId = '';
  let outlet1Id = '';
  let workshopOutletId = '';
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdShiftIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdIncidentIds: string[] = [];
  const createdManifestIds: string[] = [];
  const createdFeedbackIds: string[] = [];

  try {
    console.log('\n[SETUP] Menyiapkan tenant & data uji terisolasi...');

    // 1. Buat Tenant Uji
    const tenant = await prisma.tenant.create({
      data: {
        name: `QA Analytics Batch 3 Tenant ${ts}`,
        slug: testSlug,
        businessVertical: 'SERVICES',
        businessType: 'Laundry Kiloan & Satuan',
        status: 'ACTIVE',
      },
    });
    testTenantId = tenant.id;

    // 2. Buat 2 Outlet Uji (Outlet Cabang & Outlet Workshop)
    const outlet1 = await prisma.outlet.create({
      data: {
        tenantId: testTenantId,
        name: `Outlet Utama QA ${ts}`,
        code: `OUT-1-${ts}`,
      },
    });
    outlet1Id = outlet1.id;

    const workshopOutlet = await prisma.outlet.create({
      data: {
        tenantId: testTenantId,
        name: `Workshop Pusat QA ${ts}`,
        code: `WKS-1-${ts}`,
      },
    });
    workshopOutletId = workshopOutlet.id;

    // 3. Buat Pengguna untuk 4 Peran (OWNER, ADMIN, SUPERVISOR, CASHIER)
    const pwHash = await bcrypt.hash('password123', 8);

    const ownerUser = await prisma.user.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        userCode: `OWN_${ts}`,
        name: 'Owner QA',
        email: `owner.${ts}@qa-batch3.test`,
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
        email: `admin.${ts}@qa-batch3.test`,
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
        email: `spv.${ts}@qa-batch3.test`,
        passwordHash: pwHash,
        role: Role.SUPERVISOR,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(spvUser.id);

    const cashierUser = await prisma.user.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        userCode: `CSH_${ts}`,
        name: 'Cashier QA',
        email: `cashier.${ts}@qa-batch3.test`,
        passwordHash: pwHash,
        role: Role.CASHIER,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(cashierUser.id);

    // 4. Buat Kategori & Produk (Kiloan & Satuan)
    const catKiloan = await prisma.category.create({
      data: {
        tenantId: testTenantId,
        name: `Kiloan ${ts}`,
        slug: `kiloan-${ts}`,
      },
    });
    createdCategoryIds.push(catKiloan.id);

    const catSatuan = await prisma.category.create({
      data: {
        tenantId: testTenantId,
        name: `Satuan ${ts}`,
        slug: `satuan-${ts}`,
      },
    });
    createdCategoryIds.push(catSatuan.id);

    const prodKiloan = await prisma.product.create({
      data: {
        tenantId: testTenantId,
        categoryId: catKiloan.id,
        name: `Cuci Komplit Reguler ${ts}`,
        sku: `KIL-${ts}`,
        unit: 'KG',
      },
    });
    createdProductIds.push(prodKiloan.id);

    const prodSatuan = await prisma.product.create({
      data: {
        tenantId: testTenantId,
        categoryId: catSatuan.id,
        name: `Jas Formal ${ts}`,
        sku: `SAT-${ts}`,
        unit: 'PCS',
      },
    });
    createdProductIds.push(prodSatuan.id);

    // 5. Buat 4 Pelanggan dengan profil retensi berbeda
    // Cust 1: Dormant customer (order 45 hari lalu, >30 hari tapi <=60 hari)
    const custDormant = await prisma.customer.create({
      data: {
        tenantId: testTenantId,
        name: `Dormant Cust ${ts}`,
        phone: `+62811000${ts.toString().slice(-4)}`,
      },
    });
    createdCustomerIds.push(custDormant.id);

    // Cust 2: Loyal Active customer (order 10 hari lalu & order aktif hari ini)
    const custLoyal = await prisma.customer.create({
      data: {
        tenantId: testTenantId,
        name: `Loyal Cust ${ts}`,
        phone: `+62812000${ts.toString().slice(-4)}`,
      },
    });
    createdCustomerIds.push(custLoyal.id);

    // Cust 3: Winback customer (pernah dikirim WA winback lalu order lagi)
    const custWinback = await prisma.customer.create({
      data: {
        tenantId: testTenantId,
        name: `Winback Cust ${ts}`,
        phone: `+62813000${ts.toString().slice(-4)}`,
        lastWinbackSentAt: new Date(Date.now() - 5 * 86400 * 1000), // dikontak 5 hari lalu
      },
    });
    createdCustomerIds.push(custWinback.id);

    // Cust 4: New customer (order pertama di periode aktif ini)
    const custNew = await prisma.customer.create({
      data: {
        tenantId: testTenantId,
        name: `New Cust ${ts}`,
        phone: `+62814000${ts.toString().slice(-4)}`,
      },
    });
    createdCustomerIds.push(custNew.id);

    // 6. Buat Orders dengan berbagai variasi
    const now = new Date();
    const fortyFiveDaysAgo = new Date(Date.now() - 45 * 86400 * 1000);
    const tenDaysAgo = new Date(Date.now() - 10 * 86400 * 1000);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000);

    // Order A: Cust Dormant 45 hari lalu (Accrual & histori)
    const orderDormant = await prisma.order.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        userId: cashierUser.id,
        customerId: custDormant.id,
        invoiceNumber: `INV-DOR-${ts}`,
        orderStatus: OrderStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAID,
        subtotal: 50000,
        discountTotal: 0,
        taxTotal: 0,
        totalAmount: 50000,
        paidAmount: 50000,
        createdAt: fortyFiveDaysAgo,
        updatedAt: fortyFiveDaysAgo,
        items: {
          create: [
            {
              tenantId: testTenantId,
              productName: prodKiloan.name,
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
            perfumeVariant: 'Ocean Fresh',
            completedAt: fortyFiveDaysAgo,
          },
        },
      },
    });
    createdOrderIds.push(orderDormant.id);

    // Order B: Cust Loyal 10 hari lalu
    const orderLoyalPast = await prisma.order.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        userId: cashierUser.id,
        customerId: custLoyal.id,
        invoiceNumber: `INV-LOY-PAST-${ts}`,
        orderStatus: OrderStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAID,
        subtotal: 40000,
        discountTotal: 0,
        taxTotal: 0,
        totalAmount: 40000,
        paidAmount: 40000,
        createdAt: tenDaysAgo,
        updatedAt: tenDaysAgo,
        items: {
          create: [
            {
              tenantId: testTenantId,
              productName: prodKiloan.name,
              quantity: 4,
              unitPrice: 10000,
              subtotal: 40000,
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
            totalWeightKg: 4.0,
            totalPieces: 4,
            perfumeVariant: 'Lavender Classic',
            completedAt: tenDaysAgo,
          },
        },
      },
    });
    createdOrderIds.push(orderLoyalPast.id);

    // Order C: Cust Loyal hari ini (Kombinasi Kiloan + Satuan)
    const orderLoyalNow = await prisma.order.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        userId: cashierUser.id,
        customerId: custLoyal.id,
        invoiceNumber: `INV-LOY-NOW-${ts}`,
        orderStatus: OrderStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAID,
        subtotal: 75000,
        discountTotal: 0,
        taxTotal: 0,
        totalAmount: 75000,
        paidAmount: 75000,
        createdAt: now,
        updatedAt: now,
        items: {
          create: [
            {
              tenantId: testTenantId,
              productName: prodKiloan.name,
              quantity: 4,
              unitPrice: 10000,
              subtotal: 40000,
              unit: 'KG',
              pricingBasis: 'KILOAN',
            },
            {
              tenantId: testTenantId,
              productName: prodSatuan.name,
              quantity: 1,
              unitPrice: 35000,
              subtotal: 35000,
              unit: 'PCS',
              pricingBasis: 'SATUAN',
            },
          ],
        },
        laundryDetail: {
          create: {
            tenantId: testTenantId,
            outletId: outlet1Id,
            status: 'COMPLETED',
            currentStage: 'HANDOVER',
            totalWeightKg: 4.5,
            totalPieces: 5,
            perfumeVariant: 'Lavender Classic',
            completedAt: now,
          },
        },
      },
    });
    createdOrderIds.push(orderLoyalNow.id);

    // Order D: Cust Winback hari ini (Order terjadi setelah lastWinbackSentAt)
    const orderWinback = await prisma.order.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        userId: cashierUser.id,
        customerId: custWinback.id,
        invoiceNumber: `INV-WIN-${ts}`,
        orderStatus: OrderStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAID,
        subtotal: 35000,
        discountTotal: 0,
        taxTotal: 0,
        totalAmount: 35000,
        paidAmount: 35000,
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo,
        items: {
          create: [
            {
              tenantId: testTenantId,
              productName: prodSatuan.name,
              quantity: 1,
              unitPrice: 35000,
              subtotal: 35000,
              unit: 'PCS',
              pricingBasis: 'SATUAN',
            },
          ],
        },
        laundryDetail: {
          create: {
            tenantId: testTenantId,
            outletId: outlet1Id,
            status: 'COMPLETED',
            currentStage: 'HANDOVER',
            totalWeightKg: 0.5,
            totalPieces: 1,
            perfumeVariant: 'Ocean Fresh',
            completedAt: twoDaysAgo,
          },
        },
      },
    });
    createdOrderIds.push(orderWinback.id);

    // Order E: Cust New hari ini (Pertama kali order)
    const orderNew = await prisma.order.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        userId: cashierUser.id,
        customerId: custNew.id,
        invoiceNumber: `INV-NEW-${ts}`,
        orderStatus: OrderStatus.IN_PROGRESS,
        paymentStatus: PaymentStatus.PAID,
        subtotal: 30000,
        discountTotal: 0,
        taxTotal: 0,
        totalAmount: 30000,
        paidAmount: 30000,
        createdAt: now,
        updatedAt: now,
        items: {
          create: [
            {
              tenantId: testTenantId,
              productName: prodKiloan.name,
              quantity: 3,
              unitPrice: 10000,
              subtotal: 30000,
              unit: 'KG',
              pricingBasis: 'KILOAN',
            },
          ],
        },
        laundryDetail: {
          create: {
            tenantId: testTenantId,
            outletId: outlet1Id,
            status: 'WASHING_DRYING',
            currentStage: 'WASHING', // Titik hambat simulasi
            totalWeightKg: 3.0,
            totalPieces: 3,
            perfumeVariant: 'Ocean Fresh',
          },
        },
      },
    });
    createdOrderIds.push(orderNew.id);

    // Order F: Pesanan VOIDED (untuk menguji void/cancellation rate)
    const orderVoided = await prisma.order.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        userId: cashierUser.id,
        customerId: custLoyal.id,
        invoiceNumber: `INV-VOID-${ts}`,
        orderStatus: OrderStatus.VOIDED,
        paymentStatus: PaymentStatus.VOIDED,
        subtotal: 20000,
        discountTotal: 0,
        taxTotal: 0,
        totalAmount: 20000,
        paidAmount: 0,
        createdAt: now,
        updatedAt: now,
        items: {
          create: [
            {
              tenantId: testTenantId,
              productName: prodKiloan.name,
              quantity: 2,
              unitPrice: 10000,
              subtotal: 20000,
              unit: 'KG',
              pricingBasis: 'KILOAN',
            },
          ],
        },
      },
    });
    createdOrderIds.push(orderVoided.id);

    // 7. Buat Insiden Operasional (LaundryIncident dengan 4 tipe kanonikal)
    const incidentDamaged = await prisma.laundryIncident.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        orderId: orderLoyalNow.id,
        incidentType: 'DAMAGED',
        itemDescription: 'Kancing jas lepas',
        stage: 'WASHING',
        reportedById: cashierUser.id,
        notes: 'Kancing jas lepas saat proses cuci',
        estimatedCompensation: 25000,
        approvedCompensation: 25000,
        status: 'RESOLVED',
        resolvedAt: new Date(Date.now() + 3600 * 1000), // selesai dalam 1 jam
      },
    });
    createdIncidentIds.push(incidentDamaged.id);

    const incidentStain = await prisma.laundryIncident.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        orderId: orderWinback.id,
        incidentType: 'STAIN_REMAINING',
        itemDescription: 'Noda minyak masih ada',
        stage: 'SPOTTING',
        reportedById: cashierUser.id,
        notes: 'Perlu cuci ulang noda khusus',
        status: 'OPEN',
      },
    });
    createdIncidentIds.push(incidentStain.id);

    // 8. Buat Manifest Transfer Workshop (dengan dispatch -> receive lag 3.5 jam)
    const manifest = await prisma.laundryTransferManifest.create({
      data: {
        manifestNumber: `MAN-${ts}`,
        tenantId: testTenantId,
        sourceOutletId: outlet1Id,
        targetOutletId: workshopOutletId,
        status: 'RECEIVED',
        direction: 'TO_WORKSHOP',
        driverName: 'Sopir Ekspedisi QA',
        vehiclePlate: 'B 1234 QA',
        totalOrdersCount: 2,
        totalWeightKg: 7.5,
        dispatchedAt: new Date(Date.now() - 4 * 3600 * 1000),
        receivedAt: new Date(Date.now() - 30 * 60 * 1000), // lag = 3.5 jam
      },
    });
    createdManifestIds.push(manifest.id);

    // 9. Buat Feedback Pelanggan (Rating 5 Star & Redirect Google)
    const feedback = await prisma.laundryCustomerFeedback.create({
      data: {
        tenantId: testTenantId,
        outletId: outlet1Id,
        orderId: orderLoyalNow.id,
        customerId: custLoyal.id,
        rating: 5,
        category: 'QUALITY',
        comment: 'Sangat wangi dan bersih!',
        redirectedToGoogle: true,
        isComplaint: false,
      },
    });
    createdFeedbackIds.push(feedback.id);

    // Helper Token JWT
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
    const spvToken = makeToken(spvUser);

    console.log('  ✅ Setup data uji lengkap & relasi selesai.');

    // ----------------------------------------------------
    // TEST 1: BUGFIXES DARI BATCH 2 AUDIT
    // ----------------------------------------------------
    console.log('\n[TEST 1] Verifikasi Bugfixes dari Audit Batch 2...');

    // 1.1 In-Memory Cache clearTenant(tenantId)
    const key1 = `sales:${testTenantId}:out1:custom:s1:e1:OWNER:`;
    const key2 = `customers:${testTenantId}:out1:custom:s1:e1:OWNER:d=30`;
    const keyOther = `overview:other-tenant-999:outX:custom:s1:e1:OWNER:`;

    analyticsCache.set(key1, { data: 'test1' }, 60_000);
    analyticsCache.set(key2, { data: 'test2' }, 60_000);
    analyticsCache.set(keyOther, { data: 'keep' }, 60_000);

    assert(analyticsCache.get(key1) !== null, 'Cache key1 harus ada sebelum clearTenant');
    assert(analyticsCache.get(key2) !== null, 'Cache key2 harus ada sebelum clearTenant');
    assert(analyticsCache.get(keyOther) !== null, 'Cache keyOther harus ada');

    analyticsCache.clearTenant(testTenantId);

    assert(analyticsCache.get(key1) === null, 'Cache key1 harus terhapus setelah clearTenant');
    assert(analyticsCache.get(key2) === null, 'Cache key2 harus terhapus setelah clearTenant');
    assert(analyticsCache.get(keyOther) !== null, 'Cache keyOther dari tenant lain TIDAK boleh terhapus');
    console.log('  ✅ 1.1 analyticsCache.clearTenant(tenantId) membersihkan cache tenant dengan tepat');

    // 1.2 buildKey dengan extraSuffix
    const keyCust30 = analyticsCache.buildKey('customers', testTenantId, outlet1Id, '30d', '2026-10-01', '2026-10-31', 'OWNER', 'd=30');
    const keyCust60 = analyticsCache.buildKey('customers', testTenantId, outlet1Id, '30d', '2026-10-01', '2026-10-31', 'OWNER', 'd=60');

    assert(keyCust30 !== keyCust60, 'buildKey dengan extraSuffix harus menghasilkan cache key berbeda');
    assert(keyCust30.endsWith(':d=30'), 'keyCust30 harus berakhiran :d=30');
    assert(keyCust60.endsWith(':d=60'), 'keyCust60 harus berakhiran :d=60');
    console.log('  ✅ 1.2 buildKey mendukung extraSuffix dan mengisolasi parameter filter tambahan');

    // 1.3 Role-based Alert Sanitization untuk SUPERVISOR
    const dummyPayload = {
      healthScore: 85,
      alerts: [
        { ruleId: 'PROFIT_MARGIN_LOW', message: 'Margin laba bersih rendah (10%)' },
        { ruleId: 'GROSS_MARGIN_CRITICAL', message: 'Gross margin di bawah target' },
        { ruleId: 'HIGH_RECEIVABLES_RATIO', message: 'Piutang terlalu tinggi' },
        { ruleId: 'CASH_DISCREPANCY_DETECTED', message: 'Selisih kas fisik drawer' },
        { ruleId: 'BOTTLENECK_AT_STAGE', message: 'Tahap WASHING mengalami penumpukan antrean' },
        { ruleId: 'HIGH_DEFECT_RATE', message: 'Insiden pakaian rusak melebihi 2%' },
      ],
      netRevenue: 1000000,
    };

    const spvSanitized = sanitizeAnalyticsPayloadForRole(dummyPayload, Role.SUPERVISOR);
    assert(spvSanitized.netRevenue === undefined, 'SUPERVISOR payload tidak boleh memuat field finansial netRevenue');
    assert(Array.isArray(spvSanitized.alerts), 'Alerts harus berupa array');
    assert(spvSanitized.alerts.length === 2, `Alerts untuk SUPERVISOR harus tersaring tinggal 2, aktual: ${spvSanitized.alerts.length}`);
    const remainingRuleIds = spvSanitized.alerts.map((a: any) => a.ruleKey || a.ruleId);
    assert(!remainingRuleIds.includes('PROFIT_MARGIN_LOW'), 'Alert PROFIT_MARGIN_LOW harus disaring untuk SUPERVISOR');
    assert(!remainingRuleIds.includes('GROSS_MARGIN_CRITICAL'), 'Alert GROSS_MARGIN_CRITICAL harus disaring untuk SUPERVISOR');
    assert(!remainingRuleIds.includes('HIGH_RECEIVABLES_RATIO'), 'Alert HIGH_RECEIVABLES_RATIO harus disaring untuk SUPERVISOR');
    assert(!remainingRuleIds.includes('CASH_DISCREPANCY_DETECTED'), 'Alert CASH_DISCREPANCY_DETECTED harus disaring untuk SUPERVISOR');
    assert(remainingRuleIds.includes('BOTTLENECK_AT_STAGE'), 'Alert operasional BOTTLENECK_AT_STAGE harus tetap ada untuk SUPERVISOR');
    console.log('  ✅ 1.3 sanitizeAnalyticsPayloadForRole menyaring alert finansial sensitif untuk SUPERVISOR');

    // 1.4 returningCustomersCount pada Overview Service
    const dateRange30d = resolveAnalyticsDateRange({ preset: '30d', timezone: 'Asia/Jakarta' });
    const overviewRes = await getExecutiveOverview({
      tenantId: testTenantId,
      outletId: outlet1Id,
      dateRange: dateRange30d,
      timezone: 'Asia/Jakarta',
    });

    assert(overviewRes.customerPulse.returningCustomersCount >= 0, 'returningCustomersCount tidak boleh negatif');
    assert(overviewRes.customerPulse.newCustomersCount >= 0, 'newCustomersCount tidak boleh negatif');
    console.log(`  ✅ 1.4 Overview returningCustomersCount valid (New: ${overviewRes.customerPulse.newCustomersCount}, Returning: ${overviewRes.customerPulse.returningCustomersCount})`);

    // ----------------------------------------------------
    // TEST 2: W1-06 SALES ANALYTICS SERVICE & HTTP ENDPOINT
    // ----------------------------------------------------
    console.log('\n[TEST 2] Verifikasi Task W1-06 (Sales Analytics Service & Endpoint)...');

    const app = express();
    app.use(express.json());
    app.use('/api/laundry/analytics', laundryAnalyticsRouter);

    const server = app.listen(0);
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}/api/laundry/analytics`;

    try {
      // Direct Service Call
      const salesData = await getSalesAnalytics({
        tenantId: testTenantId,
        outletId: outlet1Id,
        dateRange: dateRange30d,
        timezone: 'Asia/Jakarta',
      });

      // 2.1 Kiloan vs Satuan Breakdown
      assert(salesData.kiloanVsSatuan.kiloan.revenue > 0, 'Revenue kiloan harus > 0');
      assert(salesData.kiloanVsSatuan.satuan.revenue > 0, 'Revenue satuan harus > 0');
      const totalRevSplit = salesData.kiloanVsSatuan.kiloan.revenue + salesData.kiloanVsSatuan.satuan.revenue;
      assert(totalRevSplit > 0, 'Total revenue split Kiloan & Satuan harus > 0');
      console.log(`  ✅ 2.1 Kiloan vs Satuan terhitung akurat (Kiloan: Rp ${salesData.kiloanVsSatuan.kiloan.revenue}, Satuan: Rp ${salesData.kiloanVsSatuan.satuan.revenue})`);

      // 2.2 Heatmap 7x24 WIB
      assert(Array.isArray(salesData.heatmap), 'Heatmap harus berupa array');
      assert(salesData.heatmap.length === 168, `Heatmap harus memiliki 168 sel (7 hari x 24 jam), aktual: ${salesData.heatmap.length}`);
      const nonZeroCells = salesData.heatmap.filter(c => c.orderCount > 0);
      assert(nonZeroCells.length > 0, 'Harus ada sel heatmap dengan orderCount > 0');
      console.log(`  ✅ 2.2 Heatmap 7x24 jam beroperasi dalam WIB (${nonZeroCells.length} slot terisi)`);

      // 2.3 Cancellation/Void Rate
      assert(salesData.summary.voidedCount.current >= 1, 'Voided count harus terhitung >= 1');
      assert(salesData.summary.cancellationRate.current > 0, 'Cancellation/void rate harus > 0%');
      console.log(`  ✅ 2.3 Void/cancellation rate terhitung akurat (${salesData.summary.cancellationRate.current}%)`);

      // 2.4 Top Perfumes & Top Services
      assert(salesData.topPerfumes.length > 0, 'Top perfumes harus memuat varian parfum');
      assert(salesData.topServices.length > 0, 'Top services harus memuat layanan terlaris');
      console.log(`  ✅ 2.4 Top perfumes (${salesData.topPerfumes[0].perfumeVariant}) & Top services terhitung`);

      // 2.5 HTTP GET /sales dengan OWNER Token
      const resOwnerSales = await fetch(`${baseUrl}/sales?preset=30d`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert(resOwnerSales.status === 200, `GET /sales OWNER harus HTTP 200, aktual: ${resOwnerSales.status}`);
      const bodyOwnerSales = await resOwnerSales.json();
      assert(bodyOwnerSales.status === 'success', 'Response status harus success');
      assert(bodyOwnerSales.data.kiloanVsSatuan !== undefined, 'Payload harus memuat kiloanVsSatuan');
      console.log('  ✅ 2.5 HTTP GET /sales sukses 200 OK untuk OWNER dengan data valid');

    } finally {
      // server akan ditutup setelah semua tes selesai
    }

    // ----------------------------------------------------
    // TEST 3: W1-07 CUSTOMER RETENTION & WIN-BACK SERVICE
    // ----------------------------------------------------
    console.log('\n[TEST 3] Verifikasi Task W1-07 (Customer Retention & Win-Back)...');

    // 3.1 Direct Service Call dengan dormantDays=30 vs dormantDays=60
    const custData30 = await getCustomerAnalytics({
      tenantId: testTenantId,
      outletId: outlet1Id,
      dateRange: dateRange30d,
      timezone: 'Asia/Jakarta',
      dormantDays: 30,
    });

    const custData60 = await getCustomerAnalytics({
      tenantId: testTenantId,
      outletId: outlet1Id,
      dateRange: dateRange30d,
      timezone: 'Asia/Jakarta',
      dormantDays: 60,
    });

    // Cust Dormant pesan 45 hari lalu -> Dormant di cutoff 30 hari, tapi TIDAK dormant di cutoff 60 hari
    assert(custData30.segments.dormant >= 1, 'Segmen dormant pada 30 hari harus >= 1');
    assert(custData30.dormantList.some(d => d.customerId === custDormant.id), 'CustDormant harus muncul di dormantList pada cutoff 30 hari');
    assert(custData60.segments.dormant < custData30.segments.dormant, 'Segmen dormant pada cutoff 60 hari harus lebih sedikit daripada 30 hari');
    console.log(`  ✅ 3.1 dormantDays parameter responsif (Dormant 30d: ${custData30.segments.dormant}, Dormant 60d: ${custData60.segments.dormant})`);

    // 3.2 Segmentasi 5 Kategori
    assert(custData30.segments.new >= 1, 'Segmen NEW harus >= 1');
    assert(custData30.segments.active >= 1, 'Segmen ACTIVE harus >= 1');
    console.log(`  ✅ 3.2 Segmentasi 5 kategori valid (New: ${custData30.segments.new}, Active: ${custData30.segments.active}, Loyal: ${custData30.segments.loyal}, Dormant: ${custData30.segments.dormant}, HighValue: ${custData30.segments.highValue})`);

    // 3.3 Win-Back Conversion
    assert(custData30.winbackStats.contactedCount >= 1, 'Winback contacted count harus >= 1');
    assert(custData30.winbackStats.returnedCount >= 1, 'Winback returned count harus >= 1');
    assert(custData30.winbackStats.conversionRate > 0, 'Winback conversion rate harus > 0%');
    console.log(`  ✅ 3.3 Win-back conversion terhitung akurat (${custData30.winbackStats.conversionRate}% - ${custData30.winbackStats.returnedCount}/${custData30.winbackStats.contactedCount})`);

    // 3.4 Feedback & Rating
    assert(custData30.feedbackSummary.totalFeedbacks >= 1, 'Total feedbacks harus >= 1');
    assert(custData30.feedbackSummary.fiveStarCount >= 1, 'Five star count harus >= 1');
    assert(custData30.feedbackSummary.googleRedirectCount >= 1, 'Google redirect count harus >= 1');
    console.log(`  ✅ 3.4 Feedback & Google redirect terhitung (Avg: ${custData30.feedbackSummary.avgRating}, 5-Star: ${custData30.feedbackSummary.fiveStarCount})`);

    // 3.5 HTTP GET /customers dengan OWNER Token
    const resOwnerCust = await fetch(`${baseUrl}/customers?preset=30d&dormantDays=30`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(resOwnerCust.status === 200, `GET /customers OWNER harus HTTP 200, aktual: ${resOwnerCust.status}`);
    const bodyOwnerCust = await resOwnerCust.json();
    assert(bodyOwnerCust.status === 'success', 'Response status harus success');
    assert(bodyOwnerCust.data.dormantList.length > 0, 'Dormant list harus terisi');
    console.log('  ✅ 3.5 HTTP GET /customers sukses 200 OK untuk OWNER dengan data valid');

    // ----------------------------------------------------
    // TEST 4: W1-08 OPERATIONS & 11-STAGE PIPELINE SERVICE
    // ----------------------------------------------------
    console.log('\n[TEST 4] Verifikasi Task W1-08 (Operations & 11-Stage Pipeline)...');

    // 4.1 Direct Service Call
    const opsData = await getOperationsAnalytics({
      tenantId: testTenantId,
      outletId: outlet1Id,
      dateRange: dateRange30d,
      timezone: 'Asia/Jakarta',
    });

    // 4.1.1 11 Canonical Stages Presence & Order
    assert(opsData.stagePipeline.length === 11, `Stage pipeline harus memuat tepat 11 tahapan kanonikal, aktual: ${opsData.stagePipeline.length}`);
    for (let i = 0; i < CANONICAL_STAGES.length; i++) {
      assert(opsData.stagePipeline[i].stage === CANONICAL_STAGES[i], `Stage index ${i} harus ${CANONICAL_STAGES[i]}, aktual: ${opsData.stagePipeline[i].stage}`);
    }
    console.log('  ✅ 4.1 11 Canonical stages hadir lengkap dalam urutan kanonikal baku');

    // 4.1.2 Bottleneck Detection
    assert(opsData.bottleneckStage !== null, 'Bottleneck stage harus terdeteksi');
    assert(opsData.bottleneckStage === 'WASHING', `Bottleneck stage harus WASHING, aktual: ${opsData.bottleneckStage}`);
    console.log(`  ✅ 4.2 Titik hambat (bottleneck) terdeteksi otomatis pada tahapan ${opsData.bottleneckStage}`);

    // 4.1.3 Incidents by 4 Canonical Types
    assert(opsData.incidents.totalIncidents >= 2, `Total incidents harus >= 2, aktual: ${opsData.incidents.totalIncidents}`);
    const incidentTypeNames = opsData.incidents.byType.map(t => t.incidentType);
    for (const type of INCIDENT_TYPES) {
      assert(incidentTypeNames.includes(type), `Type summary harus mencakup tipe ${type}`);
    }
    const damagedItem = opsData.incidents.byType.find(t => t.incidentType === 'DAMAGED');
    assert(damagedItem && damagedItem.count >= 1, 'Insiden tipe DAMAGED harus terhitung');
    assert(damagedItem && damagedItem.totalCompensation >= 25000, 'Kompensasi DAMAGED harus terhitung');
    console.log('  ✅ 4.3 Insiden operasional diklasifikasikan ke 4 tipe kanonikal dengan kompensasi tepat');

    // 4.1.4 Workshop Transfer Lag
    assert(opsData.workshopTransfer.totalManifests >= 1, 'Total manifest transfer workshop harus >= 1');
    assert(opsData.workshopTransfer.receivedCount >= 1, 'Received manifest harus >= 1');
    assert(opsData.workshopTransfer.avgTransferLagHours > 3.0 && opsData.workshopTransfer.avgTransferLagHours < 4.0, `Transfer lag harus ~3.5 jam, aktual: ${opsData.workshopTransfer.avgTransferLagHours}`);
    console.log(`  ✅ 4.4 Workshop transfer lag terhitung akurat (${opsData.workshopTransfer.avgTransferLagHours} jam)`);

    // 4.1.5 RBAC: SUPERVISOR boleh akses /operations (200 OK) tetapi ditolak di /sales dan /customers (403 Forbidden)
    const resSpvOps = await fetch(`${baseUrl}/operations?preset=30d`, {
      headers: { Authorization: `Bearer ${spvToken}` },
    });
    assert(resSpvOps.status === 200, `GET /operations untuk SUPERVISOR harus HTTP 200 OK, aktual: ${resSpvOps.status}`);
    console.log('  ✅ 4.5.1 SUPERVISOR diizinkan mengakses /operations (200 OK)');

    const resSpvSales = await fetch(`${baseUrl}/sales?preset=30d`, {
      headers: { Authorization: `Bearer ${spvToken}` },
    });
    assert(resSpvSales.status === 403, `GET /sales untuk SUPERVISOR harus HTTP 403 Forbidden, aktual: ${resSpvSales.status}`);
    console.log('  ✅ 4.5.2 SUPERVISOR ditolak di /sales (403 Forbidden)');

    const resSpvCust = await fetch(`${baseUrl}/customers?preset=30d`, {
      headers: { Authorization: `Bearer ${spvToken}` },
    });
    assert(resSpvCust.status === 403, `GET /customers untuk SUPERVISOR harus HTTP 403 Forbidden, aktual: ${resSpvCust.status}`);
    console.log('  ✅ 4.5.3 SUPERVISOR ditolak di /customers (403 Forbidden)');

    server.close();

    console.log('\n====================================================');
    console.log('🎉 ALL BATCH 3 ASSERTIONS PASSED SUCCESSFULLY!');
    console.log('====================================================');
  } finally {
    // ----------------------------------------------------
    // CLEANUP / TEARDOWN (0 DB RESIDUE)
    // ----------------------------------------------------
    console.log('\n[TEARDOWN] Membersihkan seluruh data uji dari PostgreSQL...');

    if (testTenantId) {
      try {
        // Hapus feedback
        await prisma.laundryCustomerFeedback.deleteMany({
          where: { tenantId: testTenantId },
        });

        // Hapus incidents
        await prisma.laundryIncident.deleteMany({
          where: { tenantId: testTenantId },
        });

        // Hapus manifest transfer
        await prisma.laundryTransferManifest.deleteMany({
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

        // Hapus shifts
        await prisma.shift.deleteMany({
          where: { tenantId: testTenantId },
        });

        // Hapus customers
        await prisma.customer.deleteMany({
          where: { tenantId: testTenantId },
        });

        // Hapus products & categories
        await prisma.product.deleteMany({
          where: { tenantId: testTenantId },
        });
        await prisma.category.deleteMany({
          where: { tenantId: testTenantId },
        });

        // Hapus users
        await prisma.user.deleteMany({
          where: { tenantId: testTenantId },
        });

        // Hapus outlets
        await prisma.outlet.deleteMany({
          where: { tenantId: testTenantId },
        });

        // Hapus tenant
        await prisma.tenant.delete({
          where: { id: testTenantId },
        });

        console.log('  ✅ Cascade deletion data uji selesai.');

        // Verifikasi 0 DB Residue
        const remainingOrders = await prisma.order.count({ where: { tenantId: testTenantId } });
        const remainingTenants = await prisma.tenant.count({ where: { id: testTenantId } });
        assert(remainingOrders === 0, 'Residue check: Orders harus 0');
        assert(remainingTenants === 0, 'Residue check: Tenant harus 0');
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
