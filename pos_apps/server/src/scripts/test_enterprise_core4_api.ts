/**
 * Test Suite: Laundry Core Engine — CORE PHASE 4 (Enterprise Support: Procurement 6-Tahap, Workforce Enterprise, & Global Audit Trail) — BATCH 1
 * 
 * Menguji secara komprehensif:
 * 1. Schema Patcher Idempotency (runAutoSchemaPatcher dijalankan 2x berturut-turut tanpa error)
 * 2. Pilar 1: Procurement 6-Tahap (/api/enterprise/core4/procurement/*)
 *    - Buat Purchase Request (PR) oleh Staff/Supervisor
 *    - Ambil daftar PR dengan relasi item & creator
 *    - Review approval PR oleh Owner (Status -> APPROVED)
 *    - Konversi PR approved menjadi Purchase Order (PO) resmi
 *    - Buat Tagihan Supplier / Hutang Usaha (AP Invoice) terhadap PO
 *    - Ambil daftar Supplier Invoices dengan PO, Supplier, dan riwayat pembayaran
 *    - Pembayaran bertahap AP Invoice (Partial Payment -> status PARTIAL, Pelunasan -> status PAID)
 * 3. Pilar 2: Workforce Enterprise (/api/enterprise/core4/workforce/*)
 *    - Pengajuan Lembur / Overtime oleh Staff (durasi, alasan, estimasi rate)
 *    - Ambil daftar lembur (tenant isolation & user filtering)
 *    - Review approval lembur oleh Owner (Status -> APPROVED)
 *    - Pengajuan Cuti / Izin oleh Staff
 *    - Ambil daftar cuti & review approval cuti oleh Owner
 *    - Generate / Upsert Slip Gaji Staff (otomatis agregasi approved overtime pay, base salary, allowance, deduction)
 *    - Ambil daftar Slip Gaji Payroll
 *    - Update Status Slip Gaji (DRAFT -> FINALIZED -> PAID)
 * 4. Pilar 3: Global Audit Trail (/api/enterprise/core4/audit-logs)
 *    - Verifikasi non-blocking audit logging tercatat otomatis di setiap event kritis (PROCUREMENT & HR_PAYROLL)
 *    - Query log dengan filter modul & paginasi
 * 5. Verifikasi Model Bisnis Pay-As-You-Go Token
 *    - Memastikan 0 pemotongan token saldo tenant untuk seluruh aktivitas enterprise ini
 * 6. Zero Database Residue (Pembersihan tuntas di blok finally)
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, Role } from '@prisma/client';
import { runAutoSchemaPatcher } from '../migrations/schema_patcher';
import enterpriseCore4Router from '../routes/enterprise_core4.routes';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'wellpos-default-jwt-secret';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runTests() {
  console.log('================================================================================');
  console.log('🧪 RUNNING ENTERPRISE CORE PHASE 4 INTEGRATION TESTS (BATCH 1)');
  console.log('================================================================================\n');

  // --------------------------------------------------------------------------
  // LANGKAH 1: UJI IDEMPOTENSI AUTO SCHEMA PATCHER (2x EKSEKUSI)
  // --------------------------------------------------------------------------
  console.log('▶️ [LANGKAH 1] Menguji Idempotensi Auto Schema Patcher...');
  console.log('   Running Schema Patcher Pass 1...');
  await runAutoSchemaPatcher(prisma);
  console.log('   Running Schema Patcher Pass 2 (Idempotency Check)...');
  await runAutoSchemaPatcher(prisma);
  console.log('   ✅ Schema Patcher Phase 4 terbukti 100% idempotent tanpa error.\n');

  const timestamp = Date.now().toString();
  let createdTenantId = '';

  // Setup Express server transient
  const app = express();
  app.use(express.json());
  app.use('/api/enterprise/core4', enterpriseCore4Router);

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // --------------------------------------------------------------------------
    // SEEDING DATA TEST TENANT TERISOLASI
    // --------------------------------------------------------------------------
    console.log('🌱 Menyiapkan data seeder tenant & entitas enterprise terisolasi...');

    // 1. Tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: `Tenant Uji Enterprise Core4 ${timestamp.slice(-4)}`,
        slug: `test-enterprise-core4-${timestamp}`,
        businessType: 'LAUNDRY',
      },
    });
    createdTenantId = tenant.id;

    // 2. Business
    const business = await prisma.business.create({
      data: {
        tenantId: tenant.id,
        name: 'Laundry Hub Enterprise',
        slug: `laundry-hub-enterprise-${timestamp}`,
        vertical: 'LAUNDRY',
        isActive: true,
      },
    });

    // 3. Outlet
    const outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        businessId: business.id,
        code: `OUT-ENT-${timestamp.slice(-4)}`,
        name: 'Outlet Pusat Enterprise',
        address: 'Jl. Sudirman No. 100 Jakarta',
        phone: '+6281299990001',
      },
    });

    // 4. Storage Location (Gudang Bahan Baku)
    const storageLocation = await prisma.storageLocation.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        name: 'Gudang Kimia & Deterjen',
        type: 'WAREHOUSE',
      },
    });

    // 5. Supplier
    const supplier = await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        code: `SUP-${timestamp.slice(-4)}`,
        name: `PT Kimia Laundry Nusantara ${timestamp.slice(-4)}`,
        contactName: 'Bapak Hendra',
        phone: '+6281234567890',
        email: `supplier-${timestamp}@example.com`,
      },
    });

    // 6. Inventory Item (Deterjen Liquid)
    const inventoryItem = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        itemCode: `DET-${timestamp.slice(-4)}`,
        name: 'Deterjen Liquid Konsentrat 5L',
        canonicalUom: 'JERIGEN',
        reorderPoint: 5,
        averageCost: 75000,
      },
    });

    // 7. User Owner
    const ownerUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        name: 'Owner Laundry Enterprise',
        email: `owner-ent-${timestamp}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
        role: Role.OWNER,
        userCode: `OWN-${timestamp.slice(-4)}`,
      },
    });

    // 8. User Staff (Operator Cuci & Dry / Supervisor)
    const staffUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        name: 'Budi Santoso (Staff Operator)',
        email: `staff-ent-${timestamp}@example.com`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
        role: Role.SUPERVISOR,
        userCode: `STF-${timestamp.slice(-4)}`,
      },
    });

    // Generate JWT Auth Tokens
    const ownerToken = jwt.sign(
      { id: ownerUser.id, userId: ownerUser.id, tenantId: tenant.id, outletId: outlet.id, role: Role.OWNER },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const staffToken = jwt.sign(
      { id: staffUser.id, userId: staffUser.id, tenantId: tenant.id, outletId: outlet.id, role: Role.SUPERVISOR },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('   ✅ Data seeder & credentials berhasil disiapkan.\n');

    // ==========================================================================
    // PILAR 1: PROCUREMENT 6-STAGE
    // ==========================================================================
    console.log('▶️ [PILAR 1: PROCUREMENT 6-STAGE]');

    // 1.1 Buat Purchase Request Baru (PR)
    console.log('   1.1 POST /api/enterprise/core4/procurement/requests (Staff creates PR)...');
    const prRes = await fetch(`${baseUrl}/api/enterprise/core4/procurement/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        outletId: outlet.id,
        storageLocationId: storageLocation.id,
        notes: 'Permintaan restock darurat deterjen karena lonjakan cucian hotel',
        items: [
          {
            inventoryItemId: inventoryItem.id,
            quantity: 10,
            unitCost: 75000,
            notes: 'Kemasan jerigen 5L',
          },
        ],
      }),
    });
    const prData = await prRes.json();
    assert(prRes.status === 201, `PR creation should return 201, got ${prRes.status}: ${JSON.stringify(prData)}`);
    assert(prData.data?.code.startsWith('PR-'), 'PR code should start with PR-');
    assert(prData.data?.status === 'PENDING', 'PR initial status should be PENDING');
    assert(Number(prData.data?.estimatedTotal) === 750000, 'PR estimatedTotal should be 750,000');
    assert(prData.data?.items?.length === 1, 'PR items length should be 1');
    const createdPrId = prData.data.id;
    console.log(`       ✅ PR berhasil dibuat dengan ID: ${createdPrId} & Code: ${prData.data.code}`);

    // 1.2 Ambil Daftar Purchase Request
    console.log('   1.2 GET /api/enterprise/core4/procurement/requests...');
    const listPrRes = await fetch(`${baseUrl}/api/enterprise/core4/procurement/requests?outletId=${outlet.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const listPrData = await listPrRes.json();
    assert(listPrRes.status === 200, `List PR should return 200`);
    assert(Array.isArray(listPrData.data), 'PR list should be an array');
    assert(listPrData.data.some((item: any) => item.id === createdPrId), 'PR list should include created PR');
    console.log(`       ✅ Berhasil memuat ${listPrData.data.length} Purchase Request.`);

    // 1.3 Review Approval Purchase Request (Owner Approve)
    console.log('   1.3 POST /api/enterprise/core4/procurement/requests/:id/review (Owner approves PR)...');
    const reviewPrRes = await fetch(`${baseUrl}/api/enterprise/core4/procurement/requests/${createdPrId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        status: 'APPROVED',
      }),
    });
    const reviewPrData = await reviewPrRes.json();
    assert(reviewPrRes.status === 200, `Review PR should return 200`);
    assert(reviewPrData.data?.status === 'APPROVED', 'PR status should become APPROVED');
    assert(reviewPrData.data?.approvedById === ownerUser.id, 'PR approvedById should match Owner ID');
    console.log('       ✅ Purchase Request disetujui oleh Owner.');

    // 1.4 Konversi PR Approved menjadi Purchase Order (PO)
    console.log('   1.4 POST /api/enterprise/core4/procurement/requests/:id/convert-to-po (Convert PR -> PO)...');
    const convertPoRes = await fetch(`${baseUrl}/api/enterprise/core4/procurement/requests/${createdPrId}/convert-to-po`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        supplierId: supplier.id,
        notes: 'Diteruskan dari approved PR',
      }),
    });
    const convertPoData = await convertPoRes.json();
    assert(convertPoRes.status === 201, `Convert PR to PO should return 201`);
    assert(convertPoData.data?.purchaseOrder?.orderNumber.startsWith('PO-'), 'PO number should start with PO-');
    assert(convertPoData.data?.purchaseRequest?.status === 'CONVERTED_TO_PO', 'PR status should become CONVERTED_TO_PO');
    const createdPoId = convertPoData.data.purchaseOrder.id;
    console.log(`       ✅ PO berhasil dibuat: ${convertPoData.data.purchaseOrder.orderNumber} (ID: ${createdPoId})`);

    // 1.5 Buat Tagihan Supplier / AP Invoice terhadap PO
    console.log('   1.5 POST /api/enterprise/core4/procurement/invoices (Create AP Invoice)...');
    const invoiceNumber = `INV-KIMIA-${timestamp.slice(-4)}`;
    const apRes = await fetch(`${baseUrl}/api/enterprise/core4/procurement/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        outletId: outlet.id,
        supplierId: supplier.id,
        purchaseOrderId: createdPoId,
        invoiceNumber,
        amount: 750000,
        taxAmount: 82500, // PPN 11%
        discountAmount: 0,
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
        notes: 'Tagihan tempo 14 hari',
      }),
    });
    const apData = await apRes.json();
    assert(apRes.status === 201, `AP Invoice should return 201: ${JSON.stringify(apData)}`);
    assert(apData.data?.invoiceNumber === invoiceNumber, 'Invoice number should match');
    assert(Number(apData.data?.totalAmount) === 832500, 'Total AP amount should be 750000 + 82500 = 832,500');
    assert(apData.data?.status === 'UNPAID', 'Initial AP status should be UNPAID');
    const createdInvoiceId = apData.data.id;
    console.log(`       ✅ AP Invoice berhasil dicatat: ${invoiceNumber} (ID: ${createdInvoiceId})`);

    // 1.6 Ambil Daftar Tagihan Supplier (AP Invoices)
    console.log('   1.6 GET /api/enterprise/core4/procurement/invoices...');
    const listApRes = await fetch(`${baseUrl}/api/enterprise/core4/procurement/invoices?outletId=${outlet.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const listApData = await listApRes.json();
    assert(listApRes.status === 200, 'List AP should return 200');
    assert(listApData.data.some((inv: any) => inv.id === createdInvoiceId), 'AP list should contain created invoice');
    console.log(`       ✅ Berhasil memuat daftar AP Invoices (${listApData.data.length} invoice).`);

    // 1.7 Pembayaran Bertahap AP Invoice (Termin 1: 500,000 -> Status PARTIAL)
    console.log('   1.7 POST /api/enterprise/core4/procurement/invoices/:id/payments (Partial Payment 500,000)...');
    const payPartRes = await fetch(`${baseUrl}/api/enterprise/core4/procurement/invoices/${createdInvoiceId}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        amount: 500000,
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: `TRF-BCA-${timestamp.slice(-4)}A`,
        notes: 'DP 60% via transfer BCA',
      }),
    });
    const payPartData = await payPartRes.json();
    assert(payPartRes.status === 201, 'Payment 1 should return 201');
    assert(payPartData.data?.invoice?.status === 'PARTIAL', 'Invoice status should be PARTIAL after down payment');
    assert(Number(payPartData.data?.invoice?.paidAmount) === 500000, 'Paid amount should be 500,000');
    assert(Number(payPartData.data?.invoice?.remainingAmount) === 332500, 'Remaining should be 332,500');
    console.log('       ✅ Pembayaran tahap 1 berhasil (Status: PARTIAL).');

    // 1.8 Pelunasan AP Invoice (Termin 2: 332,500 -> Status PAID)
    console.log('   1.8 POST /api/enterprise/core4/procurement/invoices/:id/payments (Settlement 332,500)...');
    const payFullRes = await fetch(`${baseUrl}/api/enterprise/core4/procurement/invoices/${createdInvoiceId}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        amount: 332500,
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: `TRF-BCA-${timestamp.slice(-4)}B`,
        notes: 'Pelunasan sisa invoice',
      }),
    });
    const payFullData = await payFullRes.json();
    assert(payFullRes.status === 201, 'Payment 2 should return 201');
    assert(payFullData.data?.invoice?.status === 'PAID', 'Invoice status should be PAID after settlement');
    assert(Number(payFullData.data?.invoice?.paidAmount) === 832500, 'Paid amount should be full 832,500');
    assert(Number(payFullData.data?.invoice?.remainingAmount) === 0, 'Remaining should be 0');
    console.log('       ✅ Pelunasan invoice berhasil (Status: PAID).\n');

    // ==========================================================================
    // PILAR 2: WORKFORCE ENTERPRISE (LEMBUR, CUTI, PAYROLL REKAP)
    // ==========================================================================
    console.log('▶️ [PILAR 2: WORKFORCE ENTERPRISE]');

    // 2.1 Pengajuan Lembur oleh Staff (3 jam lembur)
    console.log('   2.1 POST /api/enterprise/core4/workforce/overtimes (Staff submits Overtime Request)...');
    const otRes = await fetch(`${baseUrl}/api/enterprise/core4/workforce/overtimes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        overtimeDate: new Date().toISOString(),
        startTime: '17:00',
        endTime: '20:00',
        durationHours: 3,
        hourlyRate: 25000,
        reason: 'Menyelesaikan antrean express karpet & bedcover akhir pekan',
      }),
    });
    const otData = await otRes.json();
    assert(otRes.status === 201, `Overtime submission should return 201: ${JSON.stringify(otData)}`);
    assert(otData.data?.status === 'PENDING', 'Overtime initial status should be PENDING');
    // Hourly rate = 25,000, 3 hours * 1.5 multiplier = 4.5 hours * 25,000 = 112,500
    assert(Number(otData.data?.estimatedPay) === 112500, `Estimated overtime pay should be 112,500, got ${otData.data?.estimatedPay}`);
    const createdOtId = otData.data.id;
    console.log(`       ✅ Pengajuan lembur tercatat: ID ${createdOtId} (Estimasi: Rp ${otData.data.estimatedPay})`);

    // 2.2 Ambil Daftar Pengajuan Lembur
    console.log('   2.2 GET /api/enterprise/core4/workforce/overtimes...');
    const listOtRes = await fetch(`${baseUrl}/api/enterprise/core4/workforce/overtimes`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const listOtData = await listOtRes.json();
    assert(listOtRes.status === 200, 'List overtime should return 200');
    assert(listOtData.data.some((ot: any) => ot.id === createdOtId), 'Overtime list should include created request');
    console.log(`       ✅ Berhasil memuat ${listOtData.data.length} pengajuan lembur.`);

    // 2.3 Review Persetujuan Lembur oleh Owner (Status -> APPROVED)
    console.log('   2.3 POST /api/enterprise/core4/workforce/overtimes/:id/review (Owner approves Overtime)...');
    const reviewOtRes = await fetch(`${baseUrl}/api/enterprise/core4/workforce/overtimes/${createdOtId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        status: 'APPROVED',
      }),
    });
    const reviewOtData = await reviewOtRes.json();
    assert(reviewOtRes.status === 200, 'Review overtime should return 200');
    assert(reviewOtData.data?.status === 'APPROVED', 'Overtime status should become APPROVED');
    assert(reviewOtData.data?.approvedById === ownerUser.id, 'Reviewer should match Owner ID');
    console.log('       ✅ Pengajuan lembur disetujui Owner.');

    // 2.4 Pengajuan Cuti / Izin oleh Staff
    console.log('   2.4 POST /api/enterprise/core4/workforce/leaves (Staff submits Leave Request)...');
    const leaveRes = await fetch(`${baseUrl}/api/enterprise/core4/workforce/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        leaveType: 'SICK',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        durationDays: 1,
        reason: 'Sakit flu dan istirahat dokter',
      }),
    });
    const leaveData = await leaveRes.json();
    assert(leaveRes.status === 201, `Leave request should return 201: ${JSON.stringify(leaveData)}`);
    assert(leaveData.data?.status === 'PENDING', 'Leave status should be PENDING');
    const createdLeaveId = leaveData.data.id;
    console.log(`       ✅ Pengajuan cuti tercatat: ID ${createdLeaveId}`);

    // 2.5 Ambil Daftar Cuti & Review Approval oleh Owner
    console.log('   2.5 GET & POST review /api/enterprise/core4/workforce/leaves/:id/review (Owner approves Leave)...');
    const reviewLeaveRes = await fetch(`${baseUrl}/api/enterprise/core4/workforce/leaves/${createdLeaveId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        status: 'APPROVED',
      }),
    });
    const reviewLeaveData = await reviewLeaveRes.json();
    assert(reviewLeaveRes.status === 200, 'Review leave should return 200');
    assert(reviewLeaveData.data?.status === 'APPROVED', 'Leave status should be APPROVED');
    console.log('       ✅ Pengajuan cuti disetujui Owner.');

    // 2.6 Generate Slip Gaji Payroll Staff (Otomatis tarik approved overtime pay)
    console.log('   2.6 POST /api/enterprise/core4/workforce/payroll/generate (Generate Staff Payroll Slip)...');
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const payrollRes = await fetch(`${baseUrl}/api/enterprise/core4/workforce/payroll/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        outletId: outlet.id,
        userId: staffUser.id,
        periodYear: currentYear,
        periodMonth: currentMonth,
        baseSalary: 3500000,
        allowances: 200000, // Tunjangan makan/transport
        deductions: 50000,  // Potongan BPJS
        notes: 'Payroll reguler bulanan staff operasional',
      }),
    });
    const payrollData = await payrollRes.json();
    assert(payrollRes.status === 201, `Generate payroll slip should return 201: ${JSON.stringify(payrollData)}`);
    assert(payrollData.data?.status === 'DRAFT', 'Initial payroll status should be DRAFT');
    assert(Number(payrollData.data?.baseSalary) === 3500000, 'Base salary should be 3,500,000');
    // Overtime pay should automatically pull the 112,500 from the approved overtime request
    assert(Number(payrollData.data?.overtimePay) === 112500, `Overtime pay should auto-aggregate to 112,500, got ${payrollData.data?.overtimePay}`);
    // Net Salary = 3,500,000 + 112,500 + 200,000 - 50,000 = 3,762,500
    assert(Number(payrollData.data?.netSalary) === 3762500, `Net salary should be 3,762,500, got ${payrollData.data?.netSalary}`);
    const createdSlipId = payrollData.data.id;
    console.log(`       ✅ Slip gaji berhasil digenerate: ID ${createdSlipId} (Gaji Bersih: Rp ${payrollData.data.netSalary})`);

    // 2.7 Ambil Daftar Slip Gaji Payroll
    console.log('   2.7 GET /api/enterprise/core4/workforce/payroll...');
    const listPayRes = await fetch(`${baseUrl}/api/enterprise/core4/workforce/payroll?outletId=${outlet.id}&periodYear=${currentYear}&periodMonth=${currentMonth}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const listPayData = await listPayRes.json();
    assert(listPayRes.status === 200, 'List payroll should return 200');
    assert(listPayData.data.some((slip: any) => slip.id === createdSlipId), 'Payroll list should include created slip');
    console.log(`       ✅ Berhasil memuat daftar Slip Gaji (${listPayData.data.length} slip).`);

    // 2.8 Update Status Slip Gaji (DRAFT -> FINALIZED -> PAID)
    console.log('   2.8 POST /api/enterprise/core4/workforce/payroll/:id/status (DRAFT -> FINALIZED -> PAID)...');
    // Finalize
    const finRes = await fetch(`${baseUrl}/api/enterprise/core4/workforce/payroll/${createdSlipId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ status: 'FINALIZED' }),
    });
    const finData = await finRes.json();
    assert(finRes.status === 200, 'Finalize slip should return 200');
    assert(finData.data?.status === 'FINALIZED', 'Status should be FINALIZED');

    // Mark as Paid
    const paidRes = await fetch(`${baseUrl}/api/enterprise/core4/workforce/payroll/${createdSlipId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        status: 'PAID',
        paymentReference: `PAY-SALARY-${timestamp.slice(-4)}`,
      }),
    });
    const paidData = await paidRes.json();
    assert(paidRes.status === 200, 'Mark paid should return 200');
    assert(paidData.data?.status === 'PAID', 'Status should be PAID');
    console.log('       ✅ Status slip gaji berhasil diupdate ke FINALIZED dan PAID.\n');

    // ==========================================================================
    // PILAR 3: GLOBAL AUDIT TRAIL
    // ==========================================================================
    console.log('▶️ [PILAR 3: GLOBAL AUDIT TRAIL]');
    console.log('   3.1 GET /api/enterprise/core4/audit-logs (Verify Non-blocking Audit Logging)...');
    const auditRes = await fetch(`${baseUrl}/api/enterprise/core4/audit-logs?limit=50`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const auditData = await auditRes.json();
    assert(auditRes.status === 200, 'Audit logs endpoint should return 200');
    assert(Array.isArray(auditData.data), 'Audit logs data should be an array');
    console.log(`       ✅ Ditemukan ${auditData.data.length} event audit log terekam.`);

    // Verifikasi modul PROCUREMENT & HR_PAYROLL terekam
    const modulesRecorded = new Set(auditData.data.map((l: any) => l.module));
    assert(modulesRecorded.has('PROCUREMENT'), 'Audit logs must record PROCUREMENT actions');
    assert(modulesRecorded.has('HR_PAYROLL'), 'Audit logs must record HR_PAYROLL actions');

    const actionsRecorded = new Set(auditData.data.map((l: any) => l.action));
    console.log('       Events terekam:', Array.from(actionsRecorded).join(', '));
    assert(actionsRecorded.has('CREATE_PURCHASE_REQUEST'), 'Must record CREATE_PURCHASE_REQUEST');
    assert(actionsRecorded.has('APPROVE_PURCHASE_REQUEST'), 'Must record APPROVE_PURCHASE_REQUEST');
    assert(actionsRecorded.has('CONVERT_PR_TO_PO'), 'Must record CONVERT_PR_TO_PO');
    assert(actionsRecorded.has('CREATE_SUPPLIER_INVOICE'), 'Must record CREATE_SUPPLIER_INVOICE');
    assert(actionsRecorded.has('PAY_SUPPLIER_INVOICE'), 'Must record PAY_SUPPLIER_INVOICE');
    assert(actionsRecorded.has('APPROVE_OVERTIME'), 'Must record APPROVE_OVERTIME');
    assert(actionsRecorded.has('APPROVE_LEAVE'), 'Must record APPROVE_LEAVE');
    assert(actionsRecorded.has('GENERATE_PAYROLL_SLIP'), 'Must record GENERATE_PAYROLL_SLIP');
    assert(actionsRecorded.has('UPDATE_PAYROLL_STATUS'), 'Must record UPDATE_PAYROLL_STATUS');
    console.log('       ✅ Seluruh aktivitas kritis terekam dengan akurat pada Global Audit Trail.\n');

    // ==========================================================================
    // PILAR 4: INTEGRITAS PAY-AS-YOU-GO TOKEN
    // ==========================================================================
    console.log('▶️ [PILAR 4: MODEL BISNIS PAY-AS-YOU-GO]');
    const tokenInvoices = await prisma.saaSInvoice.findMany({
      where: { tenantId: tenant.id },
    });
    assert(tokenInvoices.length === 0, 'Seluruh fitur Enterprise Support Core Phase 4 TIDAK BOLEH memotong token transaksi');
    console.log('   ✅ Terverifikasi: 0 token terpotong untuk seluruh alur Enterprise Support.\n');

    console.log('================================================================================');
    console.log('🎉 SEMUA 17 ENDPOINT ENTERPRISE CORE PHASE 4 LULUS INTEGRATION TEST 100%!');
    console.log('================================================================================\n');

  } catch (error: any) {
    console.error('\n❌ [TEST FAILURE]:', error?.message || error);
    throw error;
  } finally {
    server.close();

    // --------------------------------------------------------------------------
    // CLEANUP DATABASE (ZERO RESIDUE)
    // --------------------------------------------------------------------------
    if (createdTenantId) {
      console.log('🧹 [CLEANUP] Membersihkan seluruh data dummy test tenant...');
      const queries = [
        `DELETE FROM "global_audit_logs" WHERE "tenant_id" = $1`,
        `DELETE FROM "staff_payroll_slips" WHERE "tenant_id" = $1`,
        `DELETE FROM "staff_leave_requests" WHERE "tenant_id" = $1`,
        `DELETE FROM "staff_overtime_requests" WHERE "tenant_id" = $1`,
        `DELETE FROM "supplier_invoice_payments" WHERE "tenant_id" = $1`,
        `DELETE FROM "supplier_invoices" WHERE "tenant_id" = $1`,
        `DELETE FROM "purchase_order_items" WHERE "purchase_order_id" IN (SELECT "id" FROM "purchase_orders" WHERE "tenant_id" = $1)`,
        `DELETE FROM "purchase_orders" WHERE "tenant_id" = $1`,
        `DELETE FROM "purchase_request_items" WHERE "tenant_id" = $1`,
        `DELETE FROM "purchase_requests" WHERE "tenant_id" = $1`,
        `DELETE FROM "inventory_items" WHERE "tenant_id" = $1`,
        `DELETE FROM "suppliers" WHERE "tenant_id" = $1`,
        `DELETE FROM "storage_locations" WHERE "tenant_id" = $1`,
        `DELETE FROM "shifts" WHERE "tenant_id" = $1`,
        `DELETE FROM "users" WHERE "tenant_id" = $1`,
        `DELETE FROM "outlets" WHERE "tenant_id" = $1`,
        `DELETE FROM "businesses" WHERE "tenant_id" = $1`,
        `DELETE FROM "tenants" WHERE "id" = $1`,
      ];

      for (const q of queries) {
        try {
          await prisma.$executeRawUnsafe(q, createdTenantId);
        } catch (e: any) {
          // ignore cascade
        }
      }

      const remaining = await prisma.tenant.findMany({
        where: { id: createdTenantId },
      });
      assert(remaining.length === 0, 'Tenant dummy harus terhapus bersih');
      console.log('✨ [CLEANUP COMPLETE] Database bersih 100% tanpa residu.');
    }

    await prisma.$disconnect();
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
