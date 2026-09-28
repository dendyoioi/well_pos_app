import {
  PrismaClient,
  Role,
  PlatformRole,
  TenantStatus,
  BusinessVertical,
  BillingCycle,
  Prisma,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function runTestbedSeed() {
  console.log('===================================================================');
  console.log('🌱 MEMULAI SEEDER TESTBED STATUS SUPERADMIN (5 SKENARIO STATUS)');
  console.log('===================================================================\n');

  // Bersihkan data dummy tenant sebelumnya
  console.log('🧹 Membersihkan data tenant dummy lama...');
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventoryLedger.deleteMany();
  await prisma.inventoryBalance.deleteMany();
  await prisma.inventoryBatch.deleteMany();
  await prisma.stockTransferItem.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.recipeItem.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.user.deleteMany();
  await prisma.storageLocation.deleteMany();
  await prisma.outlet.deleteMany();
  await prisma.saaSPayment.deleteMany();
  await prisma.saaSInvoice.deleteMany();
  await prisma.tenantSubscription.deleteMany();
  await prisma.tenant.deleteMany();

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password123!', salt);
  const superAdminPassHash = await bcrypt.hash('SuperAdmin123!', salt);

  // 1. Subscription Plans
  console.log('📦 1. Memastikan Master Subscription Plans...');
  const planFree = await prisma.subscriptionPlan.upsert({
    where: { code: 'FREE' },
    update: {},
    create: {
      code: 'FREE',
      name: 'Well POS Free',
      price: new Prisma.Decimal(0),
      billingCycle: BillingCycle.MONTHLY,
      maxOutlets: 1,
      maxCashiers: 2,
      features: ['BASIC_POS'],
    },
  });

  const planStarter = await prisma.subscriptionPlan.upsert({
    where: { code: 'STARTER' },
    update: {},
    create: {
      code: 'STARTER',
      name: 'Well POS Starter',
      price: new Prisma.Decimal(59000),
      billingCycle: BillingCycle.MONTHLY,
      maxOutlets: 2,
      maxCashiers: 5,
      features: ['BASIC_POS', 'INVENTORY_TRACKING'],
    },
  });

  const planPro = await prisma.subscriptionPlan.upsert({
    where: { code: 'PRO' },
    update: {},
    create: {
      code: 'PRO',
      name: 'Well POS Pro Bisnis',
      price: new Prisma.Decimal(129000),
      billingCycle: BillingCycle.MONTHLY,
      maxOutlets: 10,
      maxCashiers: 99,
      features: ['ALL_FEATURES', 'SPLIT_PAYMENT', 'HPP_REPORT', 'MULTI_OUTLET'],
    },
  });

  // 2. Platform Superadmin
  console.log('👑 2. Menyiapkan Akun Superadmin Platform...');
  await prisma.platformUser.upsert({
    where: { email: 'admin@wellpos.com' },
    update: { passwordHash: superAdminPassHash },
    create: {
      email: 'admin@wellpos.com',
      passwordHash: superAdminPassHash,
      name: 'Super Admin Well POS',
      role: PlatformRole.SUPER_ADMIN,
    },
  });

  // -------------------------------------------------------------------------
  // SKENARIO 1: Owner PENDING (Calon Owner Baru, 0 Toko)
  // -------------------------------------------------------------------------
  console.log('⏳ 3. Membuat Skenario 1: Owner PENDING (Budi Santoso - 0 Toko)...');
  const tenant1 = await prisma.tenant.create({
    data: {
      name: 'Kuliner Jogja Mandiri',
      slug: 'kuliner-jogja',
      businessVertical: BusinessVertical.FNB,
      status: TenantStatus.PENDING,
      phone: '+6281234567801',
      users: {
        create: {
          userCode: 'OWNER001',
          name: 'Budi Santoso',
          firstName: 'Budi',
          lastName: 'Santoso',
          email: 'budi.santoso@kulinerjogja.com',
          phone: '+6281234567801',
          passwordHash,
          role: Role.ADMIN,
          isActive: false,
        },
      },
    },
  });

  // -------------------------------------------------------------------------
  // SKENARIO 2: Owner ACTIVE Fresh (Siti Rahmawati, Disetujui tapi 0 Toko)
  // -------------------------------------------------------------------------
  console.log('🆕 4. Membuat Skenario 2: Owner ACTIVE Fresh (Siti Rahmawati - 0 Toko)...');
  const tenant2 = await prisma.tenant.create({
    data: {
      name: 'Siti Fashion Boutique',
      slug: 'siti-fashion',
      businessVertical: BusinessVertical.RETAIL,
      status: TenantStatus.ACTIVE,
      phone: '+6281234567802',
      users: {
        create: {
          userCode: 'OWNER002',
          name: 'Siti Rahmawati',
          firstName: 'Siti',
          lastName: 'Rahmawati',
          email: 'siti.rahmawati@fashionboutique.id',
          phone: '+6281234567802',
          passwordHash,
          role: Role.ADMIN,
          isActive: true,
        },
      },
    },
  });

  // -------------------------------------------------------------------------
  // SKENARIO 3: Owner ACTIVE dengan 1 Toko (Dendy Aditya - Toko TRIAL 14H)
  // -------------------------------------------------------------------------
  console.log('🏪 5. Membuat Skenario 3: Owner ACTIVE 1 Toko (Dendy Aditya - Toko TRIAL)...');
  const trialExpiry = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000); // 12 hari tersisa
  const tenant3 = await prisma.tenant.create({
    data: {
      name: 'PT Kopi Senja Mandiri',
      slug: 'kopi-senja',
      businessVertical: BusinessVertical.FNB,
      status: TenantStatus.ACTIVE,
      trialEndsAt: trialExpiry,
      phone: '+6281292828299',
      users: {
        create: {
          userCode: 'OWNER003',
          name: 'Dendy Aditya',
          firstName: 'Dendy',
          lastName: 'Aditya',
          email: 'dendy@kopisenja.com',
          phone: '+6281292828299',
          passwordHash,
          role: Role.ADMIN,
          isActive: true,
        },
      },
      outlets: {
        create: {
          code: 'OUT001',
          name: 'Kopi Senja - Tebet',
          merchantName: 'PT Kopi Senja Mandiri',
          address: 'Jl. Tebet Raya No. 42, Jakarta Selatan',
          phone: '+6281292828299',
          industries: ['Kedai Kopi', 'Toko Kue dan Makanan Penutup'],
          isActive: true,
        },
      },
      subscriptions: {
        create: {
          planId: planPro.id,
          startedAt: new Date(),
          expiresAt: trialExpiry,
          isActive: true,
        },
      },
    },
  });

  // -------------------------------------------------------------------------
  // SKENARIO 4: Owner ACTIVE Multi-Store Mix Status (Hendrawan Pratama - 3 Toko)
  // -------------------------------------------------------------------------
  console.log('🏢 6. Membuat Skenario 4: Owner ACTIVE Multi-Store (Hendrawan Pratama - 3 Toko)...');
  const yearEndExpiry = new Date('2026-12-31T23:59:59Z');
  const tenant4 = await prisma.tenant.create({
    data: {
      name: 'Pratama Group Retailindo',
      slug: 'pratama-group',
      businessVertical: BusinessVertical.RETAIL,
      status: TenantStatus.ACTIVE,
      phone: '+6281234567804',
      users: {
        create: {
          userCode: 'OWNER004',
          name: 'Hendrawan Pratama',
          firstName: 'Hendrawan',
          lastName: 'Pratama',
          email: 'hendra@pratamagroup.id',
          phone: '+6281234567804',
          passwordHash,
          role: Role.ADMIN,
          isActive: true,
        },
      },
      outlets: {
        create: [
          {
            code: 'PRT001',
            name: 'Pratama Mart - Sudirman',
            merchantName: 'Pratama Group Retailindo',
            address: 'Sudirman Center Lt. 1, Jakarta Pusat',
            phone: '+6281234567804',
            industries: ['Minimarket', 'Toko Kelontong'],
            isActive: true,
          },
          {
            code: 'PRT002',
            name: 'Pratama Bakery - Senopati',
            merchantName: 'Pratama Group Retailindo',
            address: 'Jl. Senopati No. 18, Jakarta Selatan',
            phone: '+6281234567804',
            industries: ['Toko Roti dan Kue', 'Kedai Kopi'],
            isActive: true,
          },
          {
            code: 'PRT003',
            name: 'Pratama Vape - Kemang',
            merchantName: 'Pratama Group Retailindo',
            address: 'Jl. Kemang Raya No. 10, Jakarta Selatan',
            phone: '+6281234567804',
            industries: ['Toko Elektronik'],
            isActive: true, // Toko aktif
          },
        ],
      },
      subscriptions: {
        create: {
          planId: planPro.id,
          startedAt: new Date(),
          expiresAt: yearEndExpiry,
          isActive: true,
        },
      },
    },
  });

  // -------------------------------------------------------------------------
  // SKENARIO 5: Owner INACTIVE Cascade (Reza Mahendra - 2 Toko Semua Inactive)
  // -------------------------------------------------------------------------
  console.log('🚫 7. Membuat Skenario 5: Owner INACTIVE Cascade (Reza Mahendra - 2 Toko Inactive)...');
  const tenant5 = await prisma.tenant.create({
    data: {
      name: 'PT GadgetZone Nusantara',
      slug: 'gadget-zone',
      businessVertical: BusinessVertical.RETAIL,
      status: TenantStatus.SUSPENDED, // Akun Owner Inactive / Dibekukan
      phone: '+6281234567805',
      users: {
        create: {
          userCode: 'OWNER005',
          name: 'Reza Mahendra',
          firstName: 'Reza',
          lastName: 'Mahendra',
          email: 'reza@gadgetzone.com',
          phone: '+6281234567805',
          passwordHash,
          role: Role.ADMIN,
          isActive: false, // Owner inactive
        },
      },
      outlets: {
        create: [
          {
            code: 'GDZ001',
            name: 'GadgetZone - Grand Indonesia',
            merchantName: 'PT GadgetZone Nusantara',
            address: 'West Mall Lt. 3, Jakarta Pusat',
            phone: '+6281234567805',
            industries: ['Toko Elektronik', 'Pusat Perbaikan Elektronik'],
            isActive: false, // Inactive karena kaskade
          },
          {
            code: 'GDZ002',
            name: 'GadgetZone - Mall Kelapa Gading',
            merchantName: 'PT GadgetZone Nusantara',
            address: 'MKG 3 Lt. Ground, Jakarta Utara',
            phone: '+6281234567805',
            industries: ['Toko Elektronik'],
            isActive: false, // Inactive karena kaskade
          },
        ],
      },
    },
  });

  console.log('\n===================================================================');
  console.log('✅ TESTBED SEEDER BERHASIL DIJALANKAN!');
  console.log('   1. Budi Santoso      - PENDING (0 Toko)');
  console.log('   2. Siti Rahmawati    - ACTIVE Fresh (0 Toko)');
  console.log('   3. Dendy Aditya      - ACTIVE (1 Toko - TRIAL PRO 14H)');
  console.log('   4. Hendrawan Pratama - ACTIVE Multi-Store (3 Toko - Mix Status)');
  console.log('   5. Reza Mahendra     - INACTIVE (2 Toko - Kaskade Inactive)');
  console.log('===================================================================\n');
}

if (require.main === module) {
  runTestbedSeed()
    .catch((e) => {
      console.error('❌ Gagal menjalankan testbed seed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
