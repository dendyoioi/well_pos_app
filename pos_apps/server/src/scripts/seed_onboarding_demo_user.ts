import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { Role, TenantStatus, BusinessVertical, InvoiceStatus, Prisma } from '@prisma/client';

async function main() {
  console.log('🚀 Memulai pembuatan akun demo untuk testing Setup Wizard Onboarding...');

  const email = 'owner.laundry@wellpos.id';
  const password = 'pastiwell789';
  const ownerName = 'Budi Laundry';
  const businessName = 'Well Laundry Express';
  const phone = '+6281234567890';
  const slug = `WLE-${Math.floor(100000 + Math.random() * 900000)}`;

  // 1. Bersihkan jika pernah ada user / tenant lama dengan email ini
  const existingUser = await prisma.user.findFirst({
    where: { email },
    include: { tenant: true },
  });

  if (existingUser) {
    console.log(`Menghapus data lama untuk email: ${email}`);
    await prisma.user.delete({ where: { id: existingUser.id } });
    if (existingUser.tenantId) {
      await prisma.saaSInvoice.deleteMany({ where: { tenantId: existingUser.tenantId } });
      await prisma.tenantSubscription.deleteMany({ where: { tenantId: existingUser.tenantId } });
      await prisma.tenant.delete({ where: { id: existingUser.tenantId } });
    }
  }

  // 2. Cari atau buat Subscription Plan PRO
  let plan = await prisma.subscriptionPlan.findFirst({
    where: { code: 'PRO' },
  });

  if (!plan) {
    plan = await prisma.subscriptionPlan.create({
      data: {
        code: 'PRO',
        name: 'Paket Profesional',
        price: new Prisma.Decimal(199000),
        maxOutlets: 5,
        maxCashiers: 20,
        features: { tokenQuota: 2000 },
      },
    });
  }

  // 3. Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // 4. Eksekusi transaksi pembuatan Tenant, Subscription, Invoice Kuota, dan User Owner
  const result = await prisma.$transaction(async (tx) => {
    // a. Buat Tenant dengan status ACTIVE (Approved oleh Superadmin)
    const tenant = await tx.tenant.create({
      data: {
        name: businessName,
        slug,
        phone,
        businessVertical: BusinessVertical.SERVICES,
        businessType: 'Laundry & Dry Clean',
        status: TenantStatus.ACTIVE, // <--- SUDAH DI-APPROVE OLEH SUPERADMIN
        allowNegativeStock: false,
        enableBatchTracking: true,
      },
    });

    // b. Buat User Owner (Role ADMIN), outletId: null (belum ada outlet!)
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        outletId: null, // <--- Wajib null agar langsung masuk ke Setup Wizard Onboarding
        userCode: '00001',
        name: ownerName,
        firstName: 'Budi',
        lastName: 'Laundry',
        email,
        phone,
        passwordHash,
        pinHash: null,
        role: Role.ADMIN,
        isActive: true,
        tokenVersion: 1,
      },
    });

    // c. Buat Tenant Subscription Aktif
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 Tahun
    await tx.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan!.id,
        startedAt: now,
        expiresAt,
        isActive: true,
      },
    });

    // d. Buat Invoice Registrasi & Bonus 200 Token Kuota Transaksi berstatus PAID
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const invoiceNumber = `INV-REG-${todayStr}-${Math.floor(1000 + Math.random() * 9000)}`;

    const invoice = await tx.saaSInvoice.create({
      data: {
        invoiceNumber,
        tenantId: tenant.id,
        planId: plan!.id,
        amount: new Prisma.Decimal(99000),
        tokenAmount: 200, // <--- Bonus 200 Token Transaksi
        discountAmount: new Prisma.Decimal(0),
        notes: 'Aktivasi Registrasi Pendaftaran Pemilik Toko & Bonus 200 Token (Approved by Superadmin)',
        status: InvoiceStatus.PAID, // <--- Lunas
        paidAt: now,
        dueDate: now,
        paymentGateway: 'SUPERADMIN_MANUAL_APPROVAL',
      },
    });

    return { tenant, user, invoice };
  });

  console.log('✅ Akun demo berhasil dibuat!');
  console.log('==============================================');
  console.log(`Email       : ${result.user.email}`);
  console.log(`Password    : ${password}`);
  console.log(`Role        : ${result.user.role} (Owner)`);
  console.log(`Tenant Name : ${result.tenant.name} (${result.tenant.slug})`);
  console.log(`Status      : ${result.tenant.status} (SUDAH DI-APPROVE SUPERADMIN)`);
  console.log(`Outlet Count: 0 (Akan langsung dialihkan ke Setup Wizard Onboarding)`);
  console.log(`Token Kuota : ${result.invoice.tokenAmount} Token Aktif`);
  console.log('==============================================');
}

main()
  .catch((err) => {
    console.error('❌ Gagal membuat akun demo:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
