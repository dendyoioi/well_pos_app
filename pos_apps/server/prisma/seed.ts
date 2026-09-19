import {
  PrismaClient,
  Role,
  PlatformRole,
  TenantStatus,
  BillingCycle,
  StockMovementType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('===================================================================');
  console.log('🌱 MEMULAI SEEDING DATA WELL POS (FREE VS PRO FEATURE GUARDING)');
  console.log('===================================================================\n');

  // ----------------------------------------------------
  // 0. Pembersihan data audit & akun testing lama
  // ----------------------------------------------------
  console.log('🧹 Membersihkan seluruh data sisa audit dan akun testing lama...');
  const staleTenants = await prisma.tenant.findMany({
    where: {
      slug: { notIn: ['warung-kopi-berkah', 'minimarket-maju-jaya'] },
    },
    select: { id: true, businessName: true },
  });

  for (const st of staleTenants) {
    console.log(`   🗑️ Menghapus tenant audit/lama: "${st.businessName}"`);
    await prisma.stockMovement.deleteMany({ where: { outlet: { tenantId: st.id } } });
    await prisma.payment.deleteMany({ where: { order: { tenantId: st.id } } });
    await prisma.orderItem.deleteMany({ where: { order: { tenantId: st.id } } });
    await prisma.order.deleteMany({ where: { tenantId: st.id } });
    await prisma.holdOrder.deleteMany({ where: { tenantId: st.id } });
    await prisma.customer.deleteMany({ where: { tenantId: st.id } });
    await prisma.shift.deleteMany({ where: { outlet: { tenantId: st.id } } });
    await prisma.outletProduct.deleteMany({ where: { outlet: { tenantId: st.id } } });
    await prisma.product.deleteMany({ where: { tenantId: st.id } });
    await prisma.category.deleteMany({ where: { tenantId: st.id } });
    await prisma.tenantSubscription.deleteMany({ where: { tenantId: st.id } });
    await prisma.saaSInvoice.deleteMany({ where: { tenantId: st.id } });
    await prisma.user.deleteMany({ where: { tenantId: st.id } });
    await prisma.outlet.deleteMany({ where: { tenantId: st.id } });
    await prisma.tenant.delete({ where: { id: st.id } });
  }

  // Hapus user lama yang tidak bertautan atau berakhiran @pos.com / audit
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { in: ['admin@pos.com', 'spv@pos.com', 'gudang@pos.com', 'kasir@pos.com'] } },
        { email: { contains: 'audit' } },
        { email: { contains: 'test.com' } },
        { email: { contains: 'kedaiaroma' } },
      ],
    },
  });

  // Hapus kategori yang tersisa tanpa tenant atau tidak valid
  await prisma.category.deleteMany({
    where: {
      OR: [
        { tenantId: null },
        { name: { contains: '(' } },
      ],
    },
  });
  console.log('   ✅ Pembersihan database selesai! Hanya menyisakan data resmi.\n');

  // ----------------------------------------------------
  // 0. Master Paket Langganan SaaS (FREE vs PRO)
  // ----------------------------------------------------
  console.log('💎 0. Menyiapkan Master Paket Langganan SaaS (FREE vs PRO)...');
  const plansData = [
    {
      code: 'FREE',
      name: 'Well POS Free (Selamanya)',
      price: 0,
      billingCycle: BillingCycle.MONTHLY,
      maxOutlets: 1,
      maxCashiers: 2,
      features: ['BASIC_POS', 'RECEIPT_WATERMARK'],
    },
    {
      code: 'PRO',
      name: 'Well POS Pro Bisnis',
      price: 129000,
      billingCycle: BillingCycle.MONTHLY,
      maxOutlets: 5,
      maxCashiers: 99,
      features: ['ALL_FEATURES', 'SPLIT_PAYMENT', 'HOLD_ORDER', 'HPP_REPORT', 'CLEAN_RECEIPT'],
    },
    {
      code: 'ENTERPRISE',
      name: 'Well POS Enterprise',
      price: 699000,
      billingCycle: BillingCycle.MONTHLY,
      maxOutlets: 999,
      maxCashiers: 999,
      features: ['ALL_FEATURES', 'SPLIT_PAYMENT', 'HOLD_ORDER', 'HPP_REPORT', 'CLEAN_RECEIPT', 'CUSTOM_DOMAIN', 'API_ACCESS'],
    },
  ];

  const planMap: Record<string, any> = {};
  for (const p of plansData) {
    const plan = await prisma.subscriptionPlan.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        price: p.price,
        billingCycle: p.billingCycle,
        maxOutlets: p.maxOutlets,
        maxCashiers: p.maxCashiers,
        features: p.features,
      },
      create: {
        code: p.code,
        name: p.name,
        price: p.price,
        billingCycle: p.billingCycle,
        maxOutlets: p.maxOutlets,
        maxCashiers: p.maxCashiers,
        features: p.features,
      },
    });
    planMap[p.code] = plan;
    console.log(`   ✅ Paket: [${p.code}] ${p.name} - Rp ${p.price.toLocaleString('id-ID')}/bln (Max ${p.maxOutlets} Outlet, Fitur: ${p.features.join(', ')})`);
  }

  // ----------------------------------------------------
  // 0.5 Akun Superadmin Platform SaaS (Internal Well POS)
  // ----------------------------------------------------
  console.log('\n👑 0.5 Menyiapkan Akun Superadmin Platform SaaS...');
  const superadminEmail = 'superadmin@wellpos.id';
  const superadminPasswordRaw = 'superadmin123';
  const superadminHash = await bcrypt.hash(superadminPasswordRaw, 10);

  const superadmin = await prisma.platformUser.upsert({
    where: { email: superadminEmail },
    update: {
      name: 'Superadmin Well POS Platform',
      passwordHash: superadminHash,
      role: PlatformRole.SUPER_ADMIN,
    },
    create: {
      email: superadminEmail,
      name: 'Superadmin Well POS Platform',
      passwordHash: superadminHash,
      role: PlatformRole.SUPER_ADMIN,
    },
  });
  console.log(`   ✅ Superadmin: ${superadmin.email} | Pass: ${superadminPasswordRaw} | Role: ${superadmin.role}`);

  // ----------------------------------------------------
  // 1. TENANT 1: "Warung Kopi Berkah" (Paket: FREE)
  // ----------------------------------------------------
  console.log('\n☕ 1. Menyiapkan Tenant 1: "Warung Kopi Berkah" (Paket: FREE)...');
  const freeTenant = await prisma.tenant.upsert({
    where: { slug: 'warung-kopi-berkah' },
    update: {
      businessName: 'Warung Kopi Berkah',
      businessType: 'F&B / Warung Kopi',
      phone: '081211112222',
      status: TenantStatus.ACTIVE,
      trialEndsAt: null,
    },
    create: {
      businessName: 'Warung Kopi Berkah',
      slug: 'warung-kopi-berkah',
      businessType: 'F&B / Warung Kopi',
      phone: '081211112222',
      status: TenantStatus.ACTIVE,
      trialEndsAt: null,
    },
  });

  // Tautkan subscription FREE aktif
  await prisma.tenantSubscription.updateMany({
    where: { tenantId: freeTenant.id, isActive: true },
    data: { isActive: false },
  });
  await prisma.tenantSubscription.create({
    data: {
      tenantId: freeTenant.id,
      planId: planMap['FREE'].id,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 tahun gratis
      isActive: true,
    },
  });

  const defaultFreeFees = [
    { id: 'fee_tax', name: 'PPN / PB1 (10%)', type: 'PERCENTAGE', rate: 10, channelScope: 'ALL', isActive: false },
    { id: 'fee_service', name: 'Biaya Layanan (5%)', type: 'PERCENTAGE', rate: 5, channelScope: 'DINE_IN', isActive: false },
    { id: 'fee_box', name: 'Biaya Kemasan Box', type: 'FIXED', rate: 1000, channelScope: 'TAKEAWAY', isActive: true },
  ];

  // Outlet Tenant 1
  const freeOutlet = await prisma.outlet.upsert({
    where: { id: '11111111-1111-1111-1111-111111111111' },
    update: {
      tenantId: freeTenant.id,
      name: 'Warung Kopi Berkah - Cabang Utama',
      address: 'Jl. Pasar Baru No. 12, Jakarta',
      phone: '081211112222',
      feesConfig: defaultFreeFees,
      isActive: true,
    },
    create: {
      id: '11111111-1111-1111-1111-111111111111',
      tenantId: freeTenant.id,
      name: 'Warung Kopi Berkah - Cabang Utama',
      address: 'Jl. Pasar Baru No. 12, Jakarta',
      phone: '081211112222',
      feesConfig: defaultFreeFees,
      isActive: true,
    },
  });

  // Users Tenant 1: Owner & Kasir
  const freePassHash = await bcrypt.hash('free123', 10);
  const freeOwner = await prisma.user.upsert({
    where: { email: 'owner.free@wellpos.id' },
    update: {
      name: 'Pak Berkah (Owner FREE)',
      passwordHash: freePassHash,
      pin: '999111',
      role: Role.ADMIN,
      outletId: freeOutlet.id,
      tenantId: freeTenant.id,
      isActive: true,
    },
    create: {
      email: 'owner.free@wellpos.id',
      name: 'Pak Berkah (Owner FREE)',
      passwordHash: freePassHash,
      pin: '999111',
      role: Role.ADMIN,
      outletId: freeOutlet.id,
      tenantId: freeTenant.id,
      isActive: true,
    },
  });

  const freeCashier = await prisma.user.upsert({
    where: { email: 'kasir.free@wellpos.id' },
    update: {
      name: 'Kasir Berkah (FREE)',
      passwordHash: freePassHash,
      pin: '111111',
      role: Role.CASHIER,
      outletId: freeOutlet.id,
      tenantId: freeTenant.id,
      isActive: true,
    },
    create: {
      email: 'kasir.free@wellpos.id',
      name: 'Kasir Berkah (FREE)',
      passwordHash: freePassHash,
      pin: '111111',
      role: Role.CASHIER,
      outletId: freeOutlet.id,
      tenantId: freeTenant.id,
      isActive: true,
    },
  });

  const freeSupervisor = await prisma.user.upsert({
    where: { email: 'spv.free@wellpos.id' },
    update: {
      name: 'Siti Supervisor (FREE)',
      passwordHash: freePassHash,
      pin: '111222',
      role: Role.SUPERVISOR,
      outletId: freeOutlet.id,
      tenantId: freeTenant.id,
      isActive: true,
    },
    create: {
      email: 'spv.free@wellpos.id',
      name: 'Siti Supervisor (FREE)',
      passwordHash: freePassHash,
      pin: '111222',
      role: Role.SUPERVISOR,
      outletId: freeOutlet.id,
      tenantId: freeTenant.id,
      isActive: true,
    },
  });

  const freeWarehouse = await prisma.user.upsert({
    where: { email: 'gudang.free@wellpos.id' },
    update: {
      name: 'Joko Gudang (FREE)',
      passwordHash: freePassHash,
      pin: '111333',
      role: Role.WAREHOUSE,
      outletId: freeOutlet.id,
      tenantId: freeTenant.id,
      isActive: true,
    },
    create: {
      email: 'gudang.free@wellpos.id',
      name: 'Joko Gudang (FREE)',
      passwordHash: freePassHash,
      pin: '111333',
      role: Role.WAREHOUSE,
      outletId: freeOutlet.id,
      tenantId: freeTenant.id,
      isActive: true,
    },
  });

  console.log(`   ✅ Tenant FREE: "${freeTenant.businessName}" | Paket: FREE`);
  console.log(`   ✅ Owner: ${freeOwner.email} (Password: free123)`);
  console.log(`   ✅ Kasir: ${freeCashier.email} (PIN: 111111)`);
  console.log(`   ✅ Supervisor: ${freeSupervisor.email} (PIN: 111222)`);
  console.log(`   ✅ Gudang: ${freeWarehouse.email} (PIN: 111333)`);

  // Kategori & Produk Tenant 1
  const freeCat = await prisma.category.upsert({
    where: { id: '11111111-2222-0000-0000-000000000001' },
    update: { name: 'Kopi & Teh Tradisional', tenantId: freeTenant.id },
    create: { id: '11111111-2222-0000-0000-000000000001', name: 'Kopi & Teh Tradisional', tenantId: freeTenant.id },
  });

  const freeProducts = [
    {
      sku: 'WKB-KP-01',
      name: 'Kopi Hitam Tubruk',
      cost: 2000,
      price: 5000,
      stock: 50,
      barcode: '89900010001',
      imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80',
    },
    {
      sku: 'WKB-TEH-02',
      name: 'Teh Manis Hangat',
      cost: 1000,
      price: 4000,
      stock: 80,
      barcode: '89900010002',
      imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80',
    },
    {
      sku: 'WKB-GORG-03',
      name: 'Pisang Goreng Wijen',
      cost: 1500,
      price: 3000,
      stock: 40,
      barcode: '89900010003',
      imageUrl: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400&auto=format&fit=crop&q=80',
    },
  ];

  for (const fp of freeProducts) {
    const p = await prisma.product.upsert({
      where: { sku: fp.sku },
      update: {
        tenantId: freeTenant.id,
        categoryId: freeCat.id,
        name: fp.name,
        barcode: fp.barcode,
        costPrice: fp.cost,
        basePrice: fp.price,
        imageUrl: fp.imageUrl,
        unit: 'Pcs',
        isActive: true,
      },
      create: {
        tenantId: freeTenant.id,
        categoryId: freeCat.id,
        sku: fp.sku,
        name: fp.name,
        barcode: fp.barcode,
        costPrice: fp.cost,
        basePrice: fp.price,
        imageUrl: fp.imageUrl,
        unit: 'Pcs',
        isActive: true,
      },
    });

    await prisma.outletProduct.upsert({
      where: { outletId_productId: { outletId: freeOutlet.id, productId: p.id } },
      update: { stock: fp.stock, minStockAlert: 5 },
      create: { outletId: freeOutlet.id, productId: p.id, stock: fp.stock, minStockAlert: 5 },
    });
  }

  // Data Pelanggan Tenant 1 (FREE)
  console.log('   👥 Menyiapkan Master Data Pelanggan Warung Kopi Berkah...');
  const freeCustomers = [
    { code: 'MBR-2609-0001', name: 'Budi Santoso', phone: '081234567001', email: 'budi.santoso@gmail.com', address: 'Jl. Melati No. 5, Jakarta', totalSpent: 75000, visitCount: 3 },
    { code: 'MBR-2609-0002', name: 'Siti Rahma', phone: '081234567002', email: 'siti.rahma@gmail.com', address: 'Jl. Kenanga No. 12, Jakarta', totalSpent: 28000, visitCount: 1 },
    { code: 'MBR-2609-0003', name: 'Andi Wijaya', phone: '081234567003', email: null, address: 'Jl. Mawar No. 8, Jakarta', totalSpent: 145000, visitCount: 5 },
  ];
  for (const fc of freeCustomers) {
    const existing = await prisma.customer.findFirst({
      where: { tenantId: freeTenant.id, phone: fc.phone },
    });
    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: fc,
      });
    } else {
      await prisma.customer.create({
        data: { ...fc, tenantId: freeTenant.id },
      });
    }
  }

  // ----------------------------------------------------
  // 2. TENANT 2: "Minimarket Maju Jaya" (Paket: PRO)
  // ----------------------------------------------------
  console.log('\n🛒 2. Menyiapkan Tenant 2: "Minimarket Maju Jaya" (Paket: PRO)...');
  const proTenant = await prisma.tenant.upsert({
    where: { slug: 'minimarket-maju-jaya' },
    update: {
      businessName: 'Minimarket Maju Jaya',
      businessType: 'Retail & Minimarket',
      phone: '081233334444',
      status: TenantStatus.ACTIVE,
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    create: {
      businessName: 'Minimarket Maju Jaya',
      slug: 'minimarket-maju-jaya',
      businessType: 'Retail & Minimarket',
      phone: '081233334444',
      status: TenantStatus.ACTIVE,
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Tautkan subscription PRO aktif
  await prisma.tenantSubscription.updateMany({
    where: { tenantId: proTenant.id, isActive: true },
    data: { isActive: false },
  });
  await prisma.tenantSubscription.create({
    data: {
      tenantId: proTenant.id,
      planId: planMap['PRO'].id,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  });

  const defaultProFees = [
    { id: 'fee_tax', name: 'PB1 / PPN Pajak', type: 'PERCENTAGE', rate: 10, channelScope: 'ALL', isActive: true },
    { id: 'fee_service', name: 'Biaya Layanan Toko', type: 'PERCENTAGE', rate: 5, channelScope: 'DINE_IN', isActive: true },
    { id: 'fee_box', name: 'Biaya Kemasan Box & Paperbag', type: 'FIXED', rate: 2000, channelScope: 'TAKEAWAY', isActive: true },
  ];

  // Outlet Tenant 2 (PRO) - Cabang 1 (Pusat - Menteng)
  const proOutlet = await prisma.outlet.upsert({
    where: { id: '22222222-2222-2222-2222-222222222222' },
    update: {
      tenantId: proTenant.id,
      name: 'Minimarket Maju Jaya - Cabang Pusat (Menteng)',
      address: 'Jl. Ahmad Yani No. 88, Menteng, Jakarta Pusat',
      phone: '081233334444',
      feesConfig: defaultProFees,
      isActive: true,
    },
    create: {
      id: '22222222-2222-2222-2222-222222222222',
      tenantId: proTenant.id,
      name: 'Minimarket Maju Jaya - Cabang Pusat (Menteng)',
      address: 'Jl. Ahmad Yani No. 88, Menteng, Jakarta Pusat',
      phone: '081233334444',
      feesConfig: defaultProFees,
      isActive: true,
    },
  });

  // Outlet Tenant 2 (PRO) - Cabang 2 (Tebet)
  const proOutletTebet = await prisma.outlet.upsert({
    where: { id: '22222222-2222-2222-2222-222222222223' },
    update: {
      tenantId: proTenant.id,
      name: 'Minimarket Maju Jaya - Cabang Tebet',
      address: 'Jl. Tebet Barat Raya No. 45, Jakarta Selatan',
      phone: '081233335555',
      feesConfig: defaultProFees,
      isActive: true,
    },
    create: {
      id: '22222222-2222-2222-2222-222222222223',
      tenantId: proTenant.id,
      name: 'Minimarket Maju Jaya - Cabang Tebet',
      address: 'Jl. Tebet Barat Raya No. 45, Jakarta Selatan',
      phone: '081233335555',
      feesConfig: defaultProFees,
      isActive: true,
    },
  });

  // Outlet Tenant 2 (PRO) - Cabang 3 (Kelapa Gading)
  const proOutletGading = await prisma.outlet.upsert({
    where: { id: '22222222-2222-2222-2222-222222222224' },
    update: {
      tenantId: proTenant.id,
      name: 'Minimarket Maju Jaya - Cabang Kelapa Gading',
      address: 'Boulevard Barat Raya Blok A3, Jakarta Utara',
      phone: '081233336666',
      feesConfig: defaultProFees,
      isActive: true,
    },
    create: {
      id: '22222222-2222-2222-2222-222222222224',
      tenantId: proTenant.id,
      name: 'Minimarket Maju Jaya - Cabang Kelapa Gading',
      address: 'Boulevard Barat Raya Blok A3, Jakarta Utara',
      phone: '081233336666',
      feesConfig: defaultProFees,
      isActive: true,
    },
  });

  // Users Tenant 2: Owner & Kasir
  const proPassHash = await bcrypt.hash('pro123', 10);
  const proOwner = await prisma.user.upsert({
    where: { email: 'owner.pro@wellpos.id' },
    update: {
      name: 'Budi Hartono (Owner PRO)',
      passwordHash: proPassHash,
      pin: '999222',
      role: Role.ADMIN,
      outletId: proOutlet.id,
      tenantId: proTenant.id,
      isActive: true,
    },
    create: {
      email: 'owner.pro@wellpos.id',
      name: 'Budi Hartono (Owner PRO)',
      passwordHash: proPassHash,
      pin: '999222',
      role: Role.ADMIN,
      outletId: proOutlet.id,
      tenantId: proTenant.id,
      isActive: true,
    },
  });

  const proCashier = await prisma.user.upsert({
    where: { email: 'kasir.pro@wellpos.id' },
    update: {
      name: 'Rian Kasir (PRO)',
      passwordHash: proPassHash,
      pin: '222222',
      role: Role.CASHIER,
      outletId: proOutlet.id,
      tenantId: proTenant.id,
      isActive: true,
    },
    create: {
      email: 'kasir.pro@wellpos.id',
      name: 'Rian Kasir (PRO)',
      passwordHash: proPassHash,
      pin: '222222',
      role: Role.CASHIER,
      outletId: proOutlet.id,
      tenantId: proTenant.id,
      isActive: true,
    },
  });

  const proSupervisor = await prisma.user.upsert({
    where: { email: 'spv.pro@wellpos.id' },
    update: {
      name: 'Maya Supervisor (PRO)',
      passwordHash: proPassHash,
      pin: '222111',
      role: Role.SUPERVISOR,
      outletId: proOutlet.id,
      tenantId: proTenant.id,
      isActive: true,
    },
    create: {
      email: 'spv.pro@wellpos.id',
      name: 'Maya Supervisor (PRO)',
      passwordHash: proPassHash,
      pin: '222111',
      role: Role.SUPERVISOR,
      outletId: proOutlet.id,
      tenantId: proTenant.id,
      isActive: true,
    },
  });

  const proWarehouse = await prisma.user.upsert({
    where: { email: 'gudang.pro@wellpos.id' },
    update: {
      name: 'Bambang Gudang (PRO)',
      passwordHash: proPassHash,
      pin: '222333',
      role: Role.WAREHOUSE,
      outletId: proOutlet.id,
      tenantId: proTenant.id,
      isActive: true,
    },
    create: {
      email: 'gudang.pro@wellpos.id',
      name: 'Bambang Gudang (PRO)',
      passwordHash: proPassHash,
      pin: '222333',
      role: Role.WAREHOUSE,
      outletId: proOutlet.id,
      tenantId: proTenant.id,
      isActive: true,
    },
  });

  console.log(`   ✅ Tenant PRO: "${proTenant.businessName}" | Paket: PRO`);
  console.log(`   ✅ Owner: ${proOwner.email} (Password: pro123)`);
  console.log(`   ✅ Kasir: ${proCashier.email} (PIN: 222222)`);
  console.log(`   ✅ Supervisor: ${proSupervisor.email} (PIN: 222111)`);
  console.log(`   ✅ Gudang: ${proWarehouse.email} (PIN: 222333)`);

  // Kategori & Produk Tenant 2
  const proCat = await prisma.category.upsert({
    where: { id: '22222222-3333-0000-0000-000000000001' },
    update: { name: 'Sembako & Minuman Kemasan', tenantId: proTenant.id },
    create: { id: '22222222-3333-0000-0000-000000000001', name: 'Sembako & Minuman Kemasan', tenantId: proTenant.id },
  });

  const proProducts = [
    {
      sku: 'MMJ-MNM-01',
      name: 'Kopi Susu Aren Botol 250ml',
      cost: 8000,
      price: 18000,
      stock: 60,
      barcode: '89911122201',
      imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=400&auto=format&fit=crop&q=80',
    },
    {
      sku: 'MMJ-MNM-02',
      name: 'Air Mineral 600ml',
      cost: 2000,
      price: 4000,
      stock: 120,
      barcode: '89911122202',
      imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&auto=format&fit=crop&q=80',
    },
    {
      sku: 'MMJ-SNK-03',
      name: 'Keripik Kentang Balado',
      cost: 7000,
      price: 14000,
      stock: 45,
      barcode: '89911122203',
      imageUrl: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&auto=format&fit=crop&q=80',
    },
  ];

  for (const pp of proProducts) {
    const p = await prisma.product.upsert({
      where: { sku: pp.sku },
      update: {
        tenantId: proTenant.id,
        categoryId: proCat.id,
        name: pp.name,
        barcode: pp.barcode,
        costPrice: pp.cost,
        basePrice: pp.price,
        imageUrl: pp.imageUrl,
        unit: 'Pcs',
        isActive: true,
      },
      create: {
        tenantId: proTenant.id,
        categoryId: proCat.id,
        sku: pp.sku,
        name: pp.name,
        barcode: pp.barcode,
        costPrice: pp.cost,
        basePrice: pp.price,
        imageUrl: pp.imageUrl,
        unit: 'Pcs',
        isActive: true,
      },
    });

    // Stok Cabang Pusat
    await prisma.outletProduct.upsert({
      where: { outletId_productId: { outletId: proOutlet.id, productId: p.id } },
      update: { stock: pp.stock, minStockAlert: 10 },
      create: { outletId: proOutlet.id, productId: p.id, stock: pp.stock, minStockAlert: 10 },
    });

    // Stok Cabang Tebet
    await prisma.outletProduct.upsert({
      where: { outletId_productId: { outletId: proOutletTebet.id, productId: p.id } },
      update: { stock: Math.round(pp.stock * 0.7), minStockAlert: 10 },
      create: { outletId: proOutletTebet.id, productId: p.id, stock: Math.round(pp.stock * 0.7), minStockAlert: 10 },
    });

    // Stok Cabang Kelapa Gading
    await prisma.outletProduct.upsert({
      where: { outletId_productId: { outletId: proOutletGading.id, productId: p.id } },
      update: { stock: Math.round(pp.stock * 0.85), minStockAlert: 10 },
      create: { outletId: proOutletGading.id, productId: p.id, stock: Math.round(pp.stock * 0.85), minStockAlert: 10 },
    });
  }

  // Data Pelanggan Tenant 2 (PRO)
  console.log('   👥 Menyiapkan Master Data Pelanggan Minimarket Maju Jaya...');
  const proCustomers = [
    { code: 'MBR-2609-0101', name: 'Hendra Gunawan', phone: '081987654001', email: 'hendra.g@gmail.com', address: 'Jl. Sudirman Kav. 21, Jakarta', totalSpent: 450000, visitCount: 8 },
    { code: 'MBR-2609-0102', name: 'Dewi Lestari', phone: '081987654002', email: 'dewi.lestari@gmail.com', address: 'Apartemen Menteng Park Lt. 12, Jakarta', totalSpent: 195000, visitCount: 4 },
    { code: 'MBR-2609-0103', name: 'Agus Setiawan', phone: '081987654003', email: null, address: 'Jl. Thamrin No. 90, Jakarta', totalSpent: 85000, visitCount: 2 },
  ];
  for (const pc of proCustomers) {
    const existing = await prisma.customer.findFirst({
      where: { tenantId: proTenant.id, phone: pc.phone },
    });
    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: pc,
      });
    } else {
      await prisma.customer.create({
        data: { ...pc, tenantId: proTenant.id },
      });
    }
  }

  console.log('\n===================================================================');
  console.log('✨ SEEDING AKUN UJI COBA FREE & PRO BERHASIL 100%!');
  console.log('===================================================================');
  console.log('1. Akun FREE (Warung Kopi Berkah):');
  console.log('   - Owner: owner.free@wellpos.id | Password: free123');
  console.log('   - Kasir: kasir.free@wellpos.id | PIN: 111111');
  console.log('   - Fitur: BASIC_POS, RECEIPT_WATERMARK');
  console.log('2. Akun PRO (Minimarket Maju Jaya):');
  console.log('   - Owner: owner.pro@wellpos.id  | Password: pro123');
  console.log('   - Kasir: kasir.pro@wellpos.id  | PIN: 222222');
  console.log('   - Fitur: ALL_FEATURES, SPLIT_PAYMENT, HOLD_ORDER, HPP_REPORT, CLEAN_RECEIPT');
  console.log('3. Akun Superadmin Platform:');
  console.log('   - Superadmin: superadmin@wellpos.id | Password: superadmin123');
  console.log('===================================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Terjadi kesalahan saat seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
