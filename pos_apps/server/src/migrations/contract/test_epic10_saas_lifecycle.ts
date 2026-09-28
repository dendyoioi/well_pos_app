import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma';
import { app } from '../../index';
import { TenantStatus, Role, InvoiceStatus } from '@prisma/client';
import { licenseWorkerService } from '../../services/licenseWorker.service';
import { Server } from 'http';

const JWT_SECRET = process.env.JWT_SECRET || 'rahasia_super_aman_pos_12345';

async function runEpic10Verification() {
  console.log('===============================================================');
  console.log('EPIC-10 VERIFICATION SUITE: SAAS SUPERADMIN & BILLING LIFECYCLE');
  console.log('===============================================================\n');

  let server: Server | null = null;

  try {
    // Start temporary test server on random port
    server = app.listen(0);
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    // -----------------------------------------------------------------
    // [1/7] Platform SuperAdmin Authentication & Token Verification
    // -----------------------------------------------------------------
    console.log('[1/7] Verifying SuperAdmin Platform Authentication...');
    
    // Ensure SuperAdmin platform user exists
    let superAdmin = await prisma.platformUser.findUnique({
      where: { email: 'superadmin@wellpos.id' },
    });

    if (!superAdmin) {
      const passwordHash = await bcrypt.hash('SuperAdmin123!', 10);
      superAdmin = await prisma.platformUser.create({
        data: {
          email: 'superadmin@wellpos.id',
          name: 'Superadmin Well POS Platform',
          passwordHash,
          role: 'SUPER_ADMIN',
        },
      });
    }

    // Generate SuperAdmin platform token
    const superAdminToken = jwt.sign(
      {
        platformUserId: superAdmin.id,
        email: superAdmin.email,
        name: superAdmin.name,
        role: superAdmin.role,
        isPlatformAdmin: true,
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    const testLoginRes = await fetch(`${baseUrl}/api/platform/dashboard`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    const testLoginJson: any = await testLoginRes.json();
    if (testLoginRes.status !== 200) {
      throw new Error(`Platform SuperAdmin auth failed with status ${testLoginRes.status}: ${JSON.stringify(testLoginJson)}`);
    }

    console.log(`  ✅ SuperAdmin Token Verified: ${superAdmin.name} (${superAdmin.email})`);
    console.log(`  Role: ${superAdmin.role} | Auth Status: 200 OK\n`);

    // -----------------------------------------------------------------
    // [2/7] SuperAdmin KPI & Oversight Metrics Verification
    // -----------------------------------------------------------------
    console.log('[2/7] Verifying SuperAdmin SaaS Metrics & Plans...');
    const metrics = testLoginJson.data.metrics;
    console.log(`  Total Tenants     : ${metrics.totalTenants}`);
    console.log(`  Active Tenants    : ${metrics.activeTenants}`);
    console.log(`  Trial Tenants     : ${metrics.trialTenants}`);
    console.log(`  Total Outlets     : ${metrics.totalOutlets}`);
    console.log(`  Total Orders      : ${metrics.totalOrders}`);
    console.log(`  Projected MRR     : Rp ${Number(metrics.projectedMRR).toLocaleString('id-ID')}`);

    const plansRes = await fetch(`${baseUrl}/api/platform/plans`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const plansJson: any = await plansRes.json();

    if (plansRes.status !== 200 || !Array.isArray(plansJson.data)) {
      throw new Error(`Failed to fetch platform plans: ${JSON.stringify(plansJson)}`);
    }

    console.log(`  Available Plans   : ${plansJson.data.map((p: any) => `${p.code} (Rp ${p.price.toLocaleString('id-ID')})`).join(', ')}`);
    console.log('  ✅ SuperAdmin KPI & Master Plans verified!\n');

    // -----------------------------------------------------------------
    // [3/7] Self-Service Tenant Onboarding Wizard
    // -----------------------------------------------------------------
    console.log('[3/7] Verifying Self-Service Tenant Registration...');
    const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
    const testEmail = `owner.senja.${uniqueSuffix}@kopi.id`;
    const testBusinessName = `Kopi Senja Bahagia ${uniqueSuffix}`;

    const regRes = await fetch(`${baseUrl}/api/saas/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: testBusinessName,
        businessType: 'F&B Kafe',
        ownerName: 'Budi Santoso',
        email: testEmail,
        phone: '081234567890',
        password: 'Password123!',
        pin: '123456',
      }),
    });

    const regJson: any = await regRes.json();
    if (regRes.status !== 201) {
      throw new Error(`Tenant registration failed with status ${regRes.status}: ${JSON.stringify(regJson)}`);
    }

    const newTenant = regJson.data.tenant;
    const newOwner = regJson.data.user;
    const newOutlet = regJson.data.outlet;

    console.log(`  ✅ Tenant Registered: ${newTenant.businessName} (Slug: ${newTenant.slug})`);
    console.log(`     Tenant Status: ${newTenant.status} (Awaiting SuperAdmin Approval)`);
    console.log(`     Owner User   : ${newOwner.name} (${newOwner.email})`);
    console.log(`     Default Store: ${newOutlet.name}\n`);

    // -----------------------------------------------------------------
    // [4/7] SuperAdmin Approval & Impersonation
    // -----------------------------------------------------------------
    console.log('[4/7] Verifying SuperAdmin Approval & Impersonation...');
    const approveRes = await fetch(`${baseUrl}/api/platform/tenants/${newTenant.id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    const approveJson: any = await approveRes.json();

    if (approveRes.status !== 200 || approveJson.data.status !== 'ACTIVE') {
      throw new Error(`Tenant approval failed: ${JSON.stringify(approveJson)}`);
    }

    console.log(`  ✅ Tenant Approved by SuperAdmin! Status: ${approveJson.data.status}`);
    if (approveJson.emailNotification) {
      console.log(`     Simulated Email to Client: "${approveJson.emailNotification.subject}"`);
    }

    // Impersonate Tenant
    const impersonateRes = await fetch(`${baseUrl}/api/platform/tenants/${newTenant.id}/impersonate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const impersonateJson: any = await impersonateRes.json();

    if (impersonateRes.status !== 200 || !impersonateJson.data.token) {
      throw new Error(`Tenant impersonation failed: ${JSON.stringify(impersonateJson)}`);
    }

    console.log(`  ✅ Tenant Impersonation Successful! Token issued for: ${impersonateJson.data.user.name}`);
    console.log(`     Impersonated By: ${impersonateJson.data.user.impersonatedBy}\n`);

    // -----------------------------------------------------------------
    // [5/7] Subscription Invoice Generation (Upgrade to Pro)
    // -----------------------------------------------------------------
    console.log('[5/7] Verifying SaaS Invoice Generation (Upgrade to PRO)...');
    // Owner token
    const ownerToken = jwt.sign(
      {
        userId: newOwner.id,
        role: newOwner.role,
        tenantId: newTenant.id,
        outletId: newOutlet.id,
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    const invoiceRes = await fetch(`${baseUrl}/api/saas/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        planCode: 'PRO',
        durationMonths: 1,
      }),
    });
    const invoiceJson: any = await invoiceRes.json();

    if (invoiceRes.status !== 201) {
      throw new Error(`Create invoice failed: ${JSON.stringify(invoiceJson)}`);
    }

    const invoiceData = invoiceJson.data;
    console.log(`  ✅ SaaS Invoice Generated: ${invoiceData.invoiceNumber}`);
    console.log(`     Plan: ${invoiceData.planName} (${invoiceData.planCode})`);
    console.log(`     Amount: Rp ${invoiceData.amount.toLocaleString('id-ID')}`);
    console.log(`     Status: ${invoiceData.status}`);
    console.log(`     Payment URL: ${invoiceData.paymentUrl}\n`);

    // -----------------------------------------------------------------
    // [6/7] Payment Gateway Webhook Simulation (Auto-Activation)
    // -----------------------------------------------------------------
    console.log('[6/7] Verifying Payment Gateway Webhook & Auto-Activation...');
    const webhookRes = await fetch(`${baseUrl}/api/saas/billing/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber: invoiceData.invoiceNumber,
        amount: invoiceData.amount,
        paymentChannel: 'QRIS_GOPAY',
        transactionStatus: 'settlement',
      }),
    });
    const webhookJson: any = await webhookRes.json();

    if (webhookRes.status !== 200) {
      throw new Error(`Webhook failed: ${JSON.stringify(webhookJson)}`);
    }

    console.log(`  ✅ Payment Webhook Processed: ${webhookJson.message}`);
    console.log(`     Invoice Status: ${webhookJson.data.status}`);
    console.log(`     New Expiration: ${webhookJson.data.subscriptionExpiresAt}`);

    // Verify Idempotency: second call
    const idempotentRes = await fetch(`${baseUrl}/api/saas/billing/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber: invoiceData.invoiceNumber,
        amount: invoiceData.amount,
        paymentChannel: 'QRIS_GOPAY',
        transactionStatus: 'settlement',
      }),
    });
    const idempotentJson: any = await idempotentRes.json();

    if (idempotentRes.status !== 200) {
      throw new Error(`Idempotent webhook call failed: ${JSON.stringify(idempotentJson)}`);
    }
    console.log(`  ✅ Idempotency Verified: ${idempotentJson.message}`);

    // Verify Subscription Status via Client API
    const subStatusRes = await fetch(`${baseUrl}/api/saas/subscription`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const subStatusJson: any = await subStatusRes.json();

    if (subStatusRes.status !== 200 || !subStatusJson.data.subscription.isPro) {
      throw new Error(`Subscription status check failed: ${JSON.stringify(subStatusJson)}`);
    }

    console.log(`  ✅ Client License Confirmed: ${subStatusJson.data.subscription.planName} (Active: ${!subStatusJson.data.isExpired}, Days Remaining: ${subStatusJson.data.daysRemaining})\n`);

    // -----------------------------------------------------------------
    // [7/7] Automated License Lifecycle Worker & Auto-Suspension
    // -----------------------------------------------------------------
    console.log('[7/7] Verifying Automated License Lifecycle Worker & Auto-Suspension...');
    
    // Scenario A: Normal active evaluation
    const evalActive = await licenseWorkerService.evaluateSubscriptionLifecycles();
    console.log(`  Lifecycle Run 1 (Current Time): ${evalActive.activeCount} Active, ${evalActive.gracePeriodCount} Grace, ${evalActive.suspendedCount} Suspended`);

    // Scenario B: Time-Travel Simulation (+45 days: 1 day past expiration -> Grace Period)
    const graceDate = new Date();
    graceDate.setDate(graceDate.getDate() + 45);

    const evalGrace = await licenseWorkerService.evaluateSubscriptionLifecycles({ simulatedDate: graceDate });
    console.log(`  Lifecycle Run 2 (Simulated Future +45 Days):`);
    console.log(`    Grace Period Count: ${evalGrace.gracePeriodCount}`);
    const graceEntry = evalGrace.details.find((d) => d.tenantId === newTenant.id);
    if (!graceEntry || !graceEntry.reason.includes('Grace period')) {
      throw new Error(`Expected tenant ${newTenant.id} to be in grace period, got: ${JSON.stringify(graceEntry)}`);
    }
    console.log(`    ✅ Tenant ${newTenant.businessName} entered Grace Period: "${graceEntry.reason}"`);

    // Scenario C: Time-Travel Simulation (+55 days: >3 days past grace period -> Auto-Suspension)
    const suspensionDate = new Date();
    suspensionDate.setDate(suspensionDate.getDate() + 55);

    const evalSuspended = await licenseWorkerService.evaluateSubscriptionLifecycles({ simulatedDate: suspensionDate });
    console.log(`  Lifecycle Run 3 (Simulated Future +55 Days):`);
    console.log(`    Suspended Count: ${evalSuspended.suspendedCount}`);
    const suspendedEntry = evalSuspended.details.find((d) => d.tenantId === newTenant.id);
    if (!suspendedEntry || suspendedEntry.newStatus !== TenantStatus.SUSPENDED) {
      throw new Error(`Expected tenant ${newTenant.id} to be suspended, got: ${JSON.stringify(suspendedEntry)}`);
    }
    console.log(`    ✅ Tenant ${newTenant.businessName} auto-suspended: "${suspendedEntry.reason}"`);

    // Verify POS Access Blocked (verifyTenantLicense)
    const checkTenantInDb = await prisma.tenant.findUnique({ where: { id: newTenant.id } });
    if (checkTenantInDb?.status !== TenantStatus.SUSPENDED) {
      throw new Error(`Database tenant status expected SUSPENDED, found: ${checkTenantInDb?.status}`);
    }

    // Try making a POS request as the suspended tenant
    const posRes = await fetch(`${baseUrl}/api/orders/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        outletId: newOutlet.id,
        cashierId: newOwner.id,
        paymentMethod: 'CASH',
        items: [],
      }),
    });
    const posJson: any = await posRes.json();

    if (posRes.status !== 403 || posJson.code !== 'SUBSCRIPTION_LOCKED') {
      throw new Error(`Expected 403 SUBSCRIPTION_LOCKED, got ${posRes.status}: ${JSON.stringify(posJson)}`);
    }

    console.log(`    ✅ POS Access Successfully Blocked: HTTP 403 Forbidden [${posJson.code}]`);
    console.log(`       Message: "${posJson.message}"\n`);

    console.log('===============================================================');
    console.log('🎉 EPIC-10 VERIFICATION COMPLETE: ALL 7/7 MODULES PASSED!');
    console.log('===============================================================');
  } catch (error) {
    console.error('\n❌ EPIC-10 VERIFICATION SUITE FAILED:', error);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
    process.exit(0);
  }
}

runEpic10Verification();
