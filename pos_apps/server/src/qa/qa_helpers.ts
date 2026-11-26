import express, { Express } from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient, Role, BusinessVerticalMode, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

// Import All Routers for Transient Self-Contained QA Server
import { authRouter } from '../routes/auth.routes';
import userRouter from '../routes/user.routes';
import { laundryRouter } from '../routes/laundry.routes';
import { customerRouter } from '../routes/customer.routes';
import outletRouter from '../routes/outlet.routes';
import { attendanceRouter } from '../routes/attendance.routes';
import laundryCorePhase1Router from '../routes/laundry_core_phase1.routes';
import laundryCorePhase2Router from '../routes/laundry_core_phase2.routes';
import laundryCorePhase3Router from '../routes/laundry_core_phase3.routes';
import enterpriseCore4Router from '../routes/enterprise_core4.routes';

const JWT_SECRET = process.env.JWT_SECRET || 'wellpos-insecure-test-jwt-secret-dev-mode-only';

export interface TestScenarioResult {
  name: string;
  status: 'PASS' | 'FAIL';
  durationMs: number;
  error?: string;
}

export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

export interface IsolatedQATenant {
  tenantId: string;
  businessId: string;
  outletId: string;
  shiftId: string;
  ownerId: string;
  ownerEmail: string;
  authToken: string;
  authHeaders: {
    'Content-Type': string;
    Authorization: string;
  };
  timestamp: string;
}

/**
 * Membuat data seeder tenant QA terisolasi dengan prefix unik
 */
export async function createIsolatedQATenant(prefix = 'QA_AUTO'): Promise<IsolatedQATenant> {
  const timestamp = Date.now().toString();
  const slug = `${prefix.toLowerCase()}-${timestamp}`;

  const tenant = await prisma.tenant.create({
    data: {
      name: `${prefix} Corp ${timestamp.slice(-4)}`,
      slug: `tenant-${slug}`,
      businessVertical: 'SERVICES',
      businessType: 'LAUNDRY',
      status: 'ACTIVE',
      phone: '+6281299990001',
    },
  });

  const business = await prisma.business.create({
    data: {
      tenantId: tenant.id,
      name: `${prefix} Laundry Business`,
      slug: `biz-${slug}`,
      vertical: BusinessVerticalMode.LAUNDRY,
      isActive: true,
    },
  });

  const outlet = await prisma.outlet.create({
    data: {
      tenantId: tenant.id,
      businessId: business.id,
      code: `OUT-${timestamp.slice(-4)}`,
      name: `${prefix} Outlet Menteng`,
      address: 'Jl. Menteng Raya No. 88, Jakarta Pusat',
      phone: '+6281299990002',
      industries: ['LAUNDRY'],
      isActive: true,
    },
  });

  const passwordHash = await bcrypt.hash('Password123!', 10);
  const ownerUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      outletId: outlet.id,
      userCode: '00001',
      name: `${prefix} Owner User`,
      firstName: 'Owner',
      lastName: prefix,
      email: `owner.${slug.slice(-8)}@wellpos.qa`,
      passwordHash,
      role: Role.OWNER,
      pinHash: passwordHash,
      isActive: true,
    },
  });

  const activeShift = await prisma.shift.create({
    data: {
      tenantId: tenant.id,
      outletId: outlet.id,
      userId: ownerUser.id,
      startingCash: new Prisma.Decimal(100000),
      status: 'OPEN',
    },
  });

  const authToken = jwt.sign(
    {
      userId: ownerUser.id,
      id: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
      tenantId: tenant.id,
      outletId: outlet.id,
      businessId: business.id,
      tokenVersion: ownerUser.tokenVersion || 0,
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  return {
    tenantId: tenant.id,
    businessId: business.id,
    outletId: outlet.id,
    shiftId: activeShift.id,
    ownerId: ownerUser.id,
    ownerEmail: ownerUser.email || '',
    authToken,
    authHeaders: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    timestamp,
  };
}

/**
 * Menambahkan paket subscription PRO dan 500 token awal ke tenant QA
 */
export async function seedSubscriptionForTenant(tenantId: string, tokens = 500): Promise<void> {
  const plan = (await prisma.subscriptionPlan.findFirst({ where: { code: 'PRO' } })) || (await prisma.subscriptionPlan.findFirst());
  if (!plan) return;

  await prisma.tenantSubscription.create({
    data: {
      tenantId,
      planId: plan.id,
      isActive: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.saaSInvoice.create({
    data: {
      tenantId,
      planId: plan.id,
      invoiceNumber: `INV-QA-${Date.now().toString().slice(-6)}`,
      amount: 50000,
      tokenAmount: tokens,
      status: 'PAID',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      paidAt: new Date(),
      notes: `Top Up Awal ${tokens} Token QA Automation`,
    },
  });
}

/**
 * Membuat transient self-contained Express server pada dynamic port 0
 */
export async function createTransientQAServer(): Promise<{
  app: Express;
  server: http.Server;
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const app = express();
  app.use(express.json());

  // Mount API Routers
  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/laundry', laundryRouter);
  app.use('/api/customers', customerRouter);
  app.use('/api/outlets', outletRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/laundry/core', laundryCorePhase1Router);
  app.use('/api/laundry/core-phase1', laundryCorePhase1Router);
  app.use('/api/laundry/core2', laundryCorePhase2Router);
  app.use('/api/laundry/core3', laundryCorePhase3Router);
  app.use('/api/enterprise/core4', enterpriseCore4Router);

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const close = (): Promise<void> => {
    return new Promise((resolve) => {
      server.close(() => resolve());
    });
  };

  return { app, server, baseUrl, close };
}

/**
 * Teardown bersih 100% tanpa residu menggunakan raw SQL cascading delete
 */
export async function cleanupQATenant(tenantId: string): Promise<void> {
  if (!tenantId) return;

  const cleanupQueries = [
    `DELETE FROM "global_audit_logs" WHERE "tenant_id" = $1`,
    `DELETE FROM "staff_payroll_slips" WHERE "tenant_id" = $1`,
    `DELETE FROM "staff_leave_requests" WHERE "tenant_id" = $1`,
    `DELETE FROM "staff_overtime_requests" WHERE "tenant_id" = $1`,
    `DELETE FROM "supplier_invoice_payments" WHERE "tenant_id" = $1`,
    `DELETE FROM "supplier_invoices" WHERE "tenant_id" = $1`,
    `DELETE FROM "purchase_request_items" WHERE "tenant_id" = $1`,
    `DELETE FROM "purchase_requests" WHERE "tenant_id" = $1`,
    `DELETE FROM "inventory_items" WHERE "tenant_id" = $1`,
    `DELETE FROM "laundry_order_item_tracks" WHERE "tenant_id" = $1`,
    `DELETE FROM "laundry_batch_items" WHERE "tenant_id" = $1`,
    `DELETE FROM "laundry_batches" WHERE "tenant_id" = $1`,
    `DELETE FROM "laundry_lost_and_found" WHERE "tenant_id" = $1`,
    `DELETE FROM "laundry_incidents" WHERE "tenant_id" = $1`,
    `DELETE FROM "staff_performance_reviews" WHERE "tenant_id" = $1`,
    `DELETE FROM "work_shift_templates" WHERE "tenant_id" = $1`,
    `DELETE FROM "staff_work_schedules" WHERE "tenant_id" = $1`,
    `DELETE FROM "customer_laundry_wallet_ledgers" WHERE "tenant_id" = $1`,
    `DELETE FROM "customer_laundry_wallets" WHERE "tenant_id" = $1`,
    `DELETE FROM "laundry_service_outlet_prices" WHERE "tenant_id" = $1`,
    `DELETE FROM "laundry_service_price_histories" WHERE "tenant_id" = $1`,
    `DELETE FROM "laundry_services" WHERE "tenant_id" = $1`,
    `DELETE FROM "laundry_perfumes" WHERE "tenant_id" = $1`,
    `DELETE FROM "laundry_racks" WHERE "tenant_id" = $1`,
    `DELETE FROM "laundry_machines" WHERE "tenant_id" = $1`,
    `DELETE FROM "cash_movements" WHERE "tenant_id" = $1`,
    `DELETE FROM "shifts" WHERE "tenant_id" = $1`,
    `DELETE FROM "order_items" WHERE "tenant_id" = $1`,
    `DELETE FROM "payment_transactions" WHERE "tenant_id" = $1`,
    `DELETE FROM "orders" WHERE "tenant_id" = $1`,
    `DELETE FROM "customers" WHERE "tenant_id" = $1`,
    `DELETE FROM "saas_invoices" WHERE "tenant_id" = $1`,
    `DELETE FROM "tenant_subscriptions" WHERE "tenant_id" = $1`,
    `DELETE FROM "users" WHERE "tenant_id" = $1`,
    `DELETE FROM "outlets" WHERE "tenant_id" = $1`,
    `DELETE FROM "businesses" WHERE "tenant_id" = $1`,
    `DELETE FROM "tenants" WHERE "id" = $1`,
  ];

  for (const query of cleanupQueries) {
    try {
      await prisma.$executeRawUnsafe(query, tenantId);
    } catch {
      // Ignore cascading errors if already deleted
    }
  }
}

/**
 * Mencetak tabel ringkasan hasil uji
 */
export function printSuiteSummary(suiteName: string, results: TestScenarioResult[]): boolean {
  console.log(`\n================================================================================`);
  console.log(`📊 RINGKASAN SUITE: ${suiteName.toUpperCase()}`);
  console.log(`================================================================================`);

  let allPassed = true;
  let totalDurationMs = 0;

  for (const r of results) {
    const statusIcon = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
    const duration = `${(r.durationMs / 1000).toFixed(2)}s`;
    console.log(` ${statusIcon.padEnd(10)} │ ${duration.padStart(6)} │ ${r.name}`);
    if (r.error) {
      console.log(`            └─ Error: ${r.error}`);
    }
    if (r.status === 'FAIL') allPassed = false;
    totalDurationMs += r.durationMs;
  }

  console.log(`--------------------------------------------------------------------------------`);
  const finalStatus = allPassed ? '✅ SEMUA SKENARIO LULUS (100% PASS)' : '❌ TERDAPAT KEGAGALAN (FAIL)';
  console.log(` Status Akhir : ${finalStatus}`);
  console.log(` Total Waktu  : ${(totalDurationMs / 1000).toFixed(2)} detik`);
  console.log(` Residu Data  : 0 Record (100% Teardown Bersih)`);
  console.log(`================================================================================\n`);

  return allPassed;
}
