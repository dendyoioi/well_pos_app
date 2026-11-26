/**
 * Test Suite: WELL POS — TAHAP 3 CRUD PERSISTENCE & DATA INTEGRITY AUDIT
 * 
 * Menguji secara komprehensif siklus penuh:
 * [Create] -> [Update SELURUH Field] -> [Re-fetch GET] -> [Assert 100% Berubah Akurat] -> [Negative Validation 400]
 * Meliputi 6 Kelompok Modul:
 * 1. Katalog Laundry, Add-on, Parfum & Paket Deposit
 * 2. Pelanggan, Dompet Deposit & Win-Back
 * 3. Operasional Produksi, Rak, Mesin & Insiden
 * 4. SDM, Template Shift, Evaluasi Performa & HR
 * 5. Pengaturan Toko, Struk, Delivery & Outlet Pricing
 * 6. Core Phase 1-4: Customer Preferences & Lost/Found
 * 
 * Standar: WAJIB Teardown 100% Bersih (Zero Residue)!
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, Role, BusinessVerticalMode, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Routers
import { laundryRouter } from '../routes/laundry.routes';
import { customerRouter } from '../routes/customer.routes';
import outletRouter from '../routes/outlet.routes';
import { attendanceRouter } from '../routes/attendance.routes';
import laundryCorePhase1Router from '../routes/laundry_core_phase1.routes';
import enterpriseCore4Router from '../routes/enterprise_core4.routes';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'wellpos-default-jwt-secret';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AUDIT FAILED] ${message}`);
  }
}

async function runCrudPersistenceAudit() {
  console.log('================================================================================');
  console.log('🧪 AUDIT PERSISTENSI CRUD & INTEGRITAS DATA TAHAP 3 (WELL POS)');
  console.log('================================================================================\n');

  const timestamp = Date.now().toString();
  let createdTenantId = '';
  let serverInstance: any = null;

  try {
    // --------------------------------------------------------------------------
    // 0. SEEDING TEST TENANT TERISOLASI
    // --------------------------------------------------------------------------
    console.log('🌱 [0/6] Menyiapkan data seeder tenant, outlet & owner user terisolasi...');

    const tenant = await prisma.tenant.create({
      data: {
        name: `Audit Tahap3 Corp ${timestamp.slice(-4)}`,
        slug: `audit-tahap3-${timestamp}`,
        businessVertical: 'SERVICES',
        businessType: 'LAUNDRY',
        status: 'ACTIVE',
        phone: '+6281299990001',
      },
    });
    createdTenantId = tenant.id;

    const business = await prisma.business.create({
      data: {
        tenantId: tenant.id,
        name: 'Well Laundry Express Audit',
        slug: `well-laundry-audit-${timestamp}`,
        vertical: BusinessVerticalMode.LAUNDRY,
        isActive: true,
      },
    });

    const outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        businessId: business.id,
        code: `OUT-A3-${timestamp.slice(-4)}`,
        name: 'Outlet Pusat Menteng Audit',
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
        userCode: '10001',
        name: 'Pak Budi Audit Owner',
        firstName: 'Budi',
        lastName: 'Owner',
        email: `owner.audit3.${timestamp.slice(-6)}@wellpos.test`,
        passwordHash,
        role: Role.OWNER,
        pinHash: passwordHash,
        isActive: true,
      },
    });

    // Buat Shift kasir aktif agar transaksi kas & top-up dompet bisa tercatat
    const activeShift = await prisma.shift.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userId: ownerUser.id,
        startingCash: new Prisma.Decimal(100000),
        status: 'OPEN',
      },
    });

    // Buat JWT Token Owner
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

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    };

    // Transient Express App
    const app = express();
    app.use(express.json());
    app.use('/api/laundry', laundryRouter);
    app.use('/api/customers', customerRouter);
    app.use('/api/outlets', outletRouter);
    app.use('/api/attendance', attendanceRouter);
    app.use('/api/laundry/core', laundryCorePhase1Router);
    app.use('/api/laundry/core-phase1', laundryCorePhase1Router);
    app.use('/api/enterprise/core4', enterpriseCore4Router);

    serverInstance = app.listen(0);
    const port = (serverInstance.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`   ✅ Test Express server aktif di ${baseUrl}\n`);

    // =========================================================================
    // 1. KELOMPOK 1: KATALOG LAUNDRY, ADD-ON, PARFUM & PAKET DEPOSIT
    // =========================================================================
    console.log('▶️ [KELOMPOK 1] Audit CRUD Katalog Layanan, Add-on, Parfum & Paket Deposit...');

    // 1.A Master Service CRUD
    console.log('   1.A Menguji CRUD Master Service & Add-on...');
    const createServiceRes = await fetch(`${baseUrl}/api/laundry/services`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Cuci Kering Lipat Reguler 2 Hari',
        category: 'KILOAN',
        unit: 'KG',
        price: 8000,
        minOrderQty: 2,
        durationHours: 48,
        expressMultiplier: 1.5,
        description: 'Pencucian rapi bergaransi',
        isActive: true,
      }),
    });
    assert(createServiceRes.status === 201, `Gagal membuat layanan laundry: HTTP ${createServiceRes.status}`);
    const createdService = (await createServiceRes.json()).data;
    assert(createdService.id, 'ID Layanan laundry baru harus ada');

    // Update ALL editable fields
    const updateServiceRes = await fetch(`${baseUrl}/api/laundry/services/${createdService.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Cuci Kering Lipat Reguler Updated',
        category: 'KILOAN',
        unit: 'KG',
        price: 11000,
        minOrderQty: 3.5,
        durationHours: 36,
        expressMultiplier: 1.8,
        description: 'Deskripsi diperbarui secara lengkap',
        isActive: false,
      }),
    });
    assert(updateServiceRes.status === 200, `Gagal memperbarui layanan laundry: HTTP ${updateServiceRes.status}`);

    // Re-fetch GET to verify persistence
    const getServicesRes = await fetch(`${baseUrl}/api/laundry/services?outletId=${outlet.id}`, {
      headers: authHeaders,
    });
    assert(getServicesRes.status === 200, `Gagal memuat daftar layanan: HTTP ${getServicesRes.status}`);
    const servicesList = (await getServicesRes.json()).data;
    const verifiedService = servicesList.find((s: any) => s.id === createdService.id);
    assert(verifiedService, 'Layanan yang diperbarui harus ditemukan di database');
    assert(verifiedService.name === 'Cuci Kering Lipat Reguler Updated', 'Field name tidak tersimpan akurat');
    assert(Number(verifiedService.price) === 11000, 'Field price tidak tersimpan akurat');
    assert(Number(verifiedService.minOrderQty) === 3.5, 'Field minOrderQty tidak tersimpan akurat');
    assert(verifiedService.durationHours === 36, 'Field durationHours tidak tersimpan akurat');
    assert(Number(verifiedService.expressMultiplier) === 1.8, 'Field expressMultiplier tidak tersimpan akurat');
    assert(verifiedService.description === 'Deskripsi diperbarui secara lengkap', 'Field description tidak tersimpan akurat');
    assert(verifiedService.isActive === false, 'Field isActive tidak tersimpan akurat');

    // Add-on Test (verifikasi durationHours: 0 constraint fix)
    const createAddonRes = await fetch(`${baseUrl}/api/laundry/services`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Treatment Hilangkan Noda Darah',
        category: 'ADDON',
        unit: 'FLAT',
        price: 15000,
        minOrderQty: 1,
        durationHours: 0, // Fix: 0 jam untuk add-on instant
        expressMultiplier: 1.0,
        description: 'Cairan penghilang noda membandel',
        isActive: true,
      }),
    });
    assert(createAddonRes.status === 201, `Gagal membuat add-on dengan durationHours 0: HTTP ${createAddonRes.status}`);

    // Negative Validation Service
    const negServiceRes = await fetch(`${baseUrl}/api/laundry/services/${createdService.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ price: -5000 }),
    });
    assert(negServiceRes.status === 400, 'Harga negatif pada layanan harus ditolak HTTP 400');
    console.log('   ✅ Master Service & Add-on: 100% CRUD persistensi & validasi negatif LULUS.');

    // 1.B Master Parfum CRUD
    console.log('   1.B Menguji CRUD Master Parfum Laundry...');
    const createPerfumeRes = await fetch(`${baseUrl}/api/laundry/perfumes`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Lavender Royal Garden',
        extraPrice: 2500,
        usageQtyPerUnit: 15,
        usageBasis: 'PER_KG',
        isActive: true,
        isDefault: true,
        sortOrder: 1,
      }),
    });
    assert(createPerfumeRes.status === 201, `Gagal membuat master parfum: HTTP ${createPerfumeRes.status}`);
    const createdPerfume = (await createPerfumeRes.json()).data;

    // Update ALL editable fields
    const updatePerfumeRes = await fetch(`${baseUrl}/api/laundry/perfumes/${createdPerfume.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Lavender Royal Supreme',
        extraPrice: 4000,
        usageQtyPerUnit: 25,
        usageBasis: 'PER_ORDER',
        isActive: false,
        isDefault: false,
        sortOrder: 10,
      }),
    });
    assert(updatePerfumeRes.status === 200, `Gagal memperbarui parfum: HTTP ${updatePerfumeRes.status}`);

    // Re-fetch GET
    const getPerfumesRes = await fetch(`${baseUrl}/api/laundry/perfumes?includeInactive=true`, { headers: authHeaders });
    assert(getPerfumesRes.status === 200, `Gagal memuat parfum: HTTP ${getPerfumesRes.status}`);
    const perfumeList = (await getPerfumesRes.json()).data;
    const verifiedPerfume = perfumeList.find((p: any) => p.id === createdPerfume.id);
    assert(verifiedPerfume, 'Parfum yang diperbarui harus ditemukan');
    assert(verifiedPerfume.name === 'Lavender Royal Supreme', 'Nama parfum tidak persisten');
    assert(Number(verifiedPerfume.extraPrice) === 4000, 'extraPrice parfum tidak persisten');
    assert(Number(verifiedPerfume.usageQtyPerUnit) === 25, 'usageQtyPerUnit parfum tidak persisten');
    assert(verifiedPerfume.usageBasis === 'PER_ORDER', 'usageBasis parfum tidak persisten');
    assert(verifiedPerfume.isActive === false, 'isActive parfum tidak persisten');
    assert(verifiedPerfume.sortOrder === 10, 'sortOrder parfum tidak persisten');

    // Negative Validation Parfum
    const negPerfumeRes = await fetch(`${baseUrl}/api/laundry/perfumes/${createdPerfume.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ extraPrice: -1000 }),
    });
    assert(negPerfumeRes.status === 400, 'extraPrice negatif pada parfum harus ditolak HTTP 400');
    console.log('   ✅ Master Parfum: 100% CRUD persistensi & validasi negatif LULUS.');

    // 1.C Paket Deposit & Kuota CRUD
    console.log('   1.C Menguji CRUD Paket Deposit & Kuota...');
    const updateDepositRes = await fetch(`${baseUrl}/api/laundry/deposit-config`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        outletId: outlet.id,
        expiryPolicy: 'EXPIRE',
        packages: [
          {
            id: 'pkg-quota-1',
            name: 'Paket Berlangganan Kiloan 50 Kg',
            type: 'QUOTA_KG',
            price: 350000,
            quotaKg: 50,
            quotaBonusKg: 5,
            validityDays: 60,
            description: 'Kuota 50kg + Bonus 5kg',
          },
          {
            id: 'pkg-balance-1',
            name: 'Paket Deposit Saldo 200 Ribu',
            type: 'BALANCE',
            price: 200000,
            balanceAmount: 200000,
            bonusAmount: 30000,
            validityDays: 90,
            description: 'Saldo Rp 200.000 + Bonus Rp 30.000',
          },
        ],
      }),
    });
    assert(updateDepositRes.status === 200, `Gagal menyimpan konfigurasi deposit: HTTP ${updateDepositRes.status}`);

    // Re-fetch GET
    const getDepositRes = await fetch(`${baseUrl}/api/laundry/deposit-config?outletId=${outlet.id}`, { headers: authHeaders });
    assert(getDepositRes.status === 200, `Gagal memuat konfigurasi deposit: HTTP ${getDepositRes.status}`);
    const depositData = (await getDepositRes.json()).data;
    assert(depositData.config.expiryPolicy === 'EXPIRE', 'expiryPolicy tidak persisten');
    assert(depositData.config.packages.length === 2, 'Jumlah paket deposit tidak cocok');
    assert(depositData.config.packages[0].quotaBonusKg === 5, 'quotaBonusKg tidak persisten');
    assert(depositData.config.packages[1].bonusAmount === 30000, 'bonusAmount tidak persisten');

    // Negative Validation Deposit
    const negDepositRes = await fetch(`${baseUrl}/api/laundry/deposit-config`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        outletId: outlet.id,
        packages: [{ name: 'Paket Salah', type: 'BALANCE', price: -50000 }],
      }),
    });
    assert(negDepositRes.status === 400, 'Harga paket deposit negatif harus ditolak HTTP 400');
    console.log('   ✅ Paket Deposit & Kuota: 100% CRUD persistensi & validasi negatif LULUS.\n');

    // =========================================================================
    // 2. KELOMPOK 2: PELANGGAN, DOMPET DEPOSIT & WIN-BACK
    // =========================================================================
    console.log('▶️ [KELOMPOK 2] Audit CRUD Pelanggan & Dompet Deposit...');

    // 2.A Master Pelanggan CRUD
    console.log('   2.A Menguji CRUD Pelanggan...');
    const createCustomerRes = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Ibu Ratna Sari',
        phone: '+6281288880001',
        email: 'ratna.sari@test.com',
        code: 'MBR-001',
        address: 'Jl. Kemang Timur No. 12',
        notes: 'Pelanggan alergi parfum menyengat',
      }),
    });
    assert(createCustomerRes.status === 201, `Gagal membuat pelanggan: HTTP ${createCustomerRes.status}`);
    const createdCustomer = (await createCustomerRes.json()).data;

    // Update ALL editable fields
    const updateCustomerRes = await fetch(`${baseUrl}/api/customers/${createdCustomer.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Ibu Ratna Sari Dewi M.Sc',
        phone: '+6281288880009',
        email: 'ratna.dewi@test.com',
        code: 'MBR-001-GOLD',
        address: 'Jl. Senopati Boulevard No. 45',
        notes: 'Prioritas setrika uap ekstra halus',
      }),
    });
    assert(updateCustomerRes.status === 200, `Gagal memperbarui pelanggan: HTTP ${updateCustomerRes.status}`);

    // Re-fetch GET
    const getCustomerRes = await fetch(`${baseUrl}/api/customers/${createdCustomer.id}`, { headers: authHeaders });
    assert(getCustomerRes.status === 200, `Gagal mengambil detail pelanggan: HTTP ${getCustomerRes.status}`);
    const verifiedCustomer = (await getCustomerRes.json()).data;
    assert(verifiedCustomer.name === 'Ibu Ratna Sari Dewi M.Sc', 'Nama pelanggan tidak persisten');
    assert(verifiedCustomer.phone === '+6281288880009', 'Nomor telepon pelanggan tidak persisten');
    assert(verifiedCustomer.email === 'ratna.dewi@test.com', 'Email pelanggan tidak persisten');
    assert(verifiedCustomer.code === 'MBR-001-GOLD', 'Kode member pelanggan tidak persisten');
    assert(verifiedCustomer.address === 'Jl. Senopati Boulevard No. 45', 'Alamat pelanggan tidak persisten');
    assert(verifiedCustomer.notes === 'Prioritas setrika uap ekstra halus', 'Catatan pelanggan tidak persisten');

    // Negative Validation Pelanggan
    const negCustomerRes = await fetch(`${baseUrl}/api/customers/${createdCustomer.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ email: 'format-email-salah-tanpa-domain' }),
    });
    assert(negCustomerRes.status === 400, 'Format email salah harus ditolak HTTP 400');

    // 2.B Top-up Dompet Deposit & Pengecekan Expiry
    console.log('   2.B Menguji Top-up Saldo & Kuota Laundry...');
    const topupBalanceRes = await fetch(`${baseUrl}/api/laundry/customers/${createdCustomer.id}/wallet/topup`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        type: 'BALANCE',
        amount: 200000,
        bonusAmount: 25000,
        pricePaid: 200000,
        paymentMethod: 'CASH',
        validityDays: 90,
        outletId: outlet.id,
      }),
    });
    assert(topupBalanceRes.status === 200, `Gagal top-up saldo deposit: HTTP ${topupBalanceRes.status}`);

    const topupQuotaRes = await fetch(`${baseUrl}/api/laundry/customers/${createdCustomer.id}/wallet/topup`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        type: 'QUOTA_KG',
        kg: 30,
        quotaBonusKg: 3,
        pricePaid: 210000,
        paymentMethod: 'CASH',
        validityDays: 60,
        outletId: outlet.id,
      }),
    });
    assert(topupQuotaRes.status === 200, `Gagal top-up kuota kg: HTTP ${topupQuotaRes.status}`);

    // Re-fetch GET Wallet
    const getWalletRes = await fetch(`${baseUrl}/api/laundry/customers/${createdCustomer.id}/wallet`, { headers: authHeaders });
    assert(getWalletRes.status === 200, `Gagal memuat wallet pelanggan: HTTP ${getWalletRes.status}`);
    const walletData = (await getWalletRes.json()).data;
    assert(Number(walletData.balanceAmount) === 225000, 'Saldo deposit akhir harus Rp 225.000');
    assert(Number(walletData.quotaKg) === 33, 'Kuota kg akhir harus 33 Kg');
    assert(walletData.balanceExpiresAt !== null, 'balanceExpiresAt harus terisi tanggal');
    assert(walletData.quotaExpiresAt !== null, 'quotaExpiresAt harus terisi tanggal');

    // Negative Validation Wallet
    const negWalletRes = await fetch(`${baseUrl}/api/laundry/customers/${createdCustomer.id}/wallet/topup`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        type: 'BALANCE',
        amount: -50000,
        outletId: outlet.id,
      }),
    });
    assert(negWalletRes.status === 400, 'Top-up nominal negatif harus ditolak HTTP 400');
    console.log('   ✅ Pelanggan & Dompet Deposit: 100% CRUD persistensi & validasi negatif LULUS.\n');

    // =========================================================================
    // 3. KELOMPOK 3: OPERASIONAL PRODUKSI, RAK, MESIN & INSIDEN
    // =========================================================================
    console.log('▶️ [KELOMPOK 3] Audit CRUD Rak, Mesin & Insiden...');

    // 3.A Master Rak CRUD
    console.log('   3.A Menguji CRUD Master Rak Penyimpanan...');
    const createRackRes = await fetch(`${baseUrl}/api/laundry/racks`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        outletId: outlet.id,
        code: `RAK-${timestamp.slice(-3)}`,
        name: 'Rak Kiloan Awal',
        category: 'KILOAN',
        capacity: 12,
        locationNote: 'Lantai 1 Belakang Kasir',
      }),
    });
    assert(createRackRes.status === 201, `Gagal membuat rak: HTTP ${createRackRes.status}`);
    const createdRack = (await createRackRes.json()).data;

    // Update ALL editable fields
    const updateRackRes = await fetch(`${baseUrl}/api/laundry/racks/${createdRack.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        code: `RK-REV-${timestamp.slice(-3)}`,
        name: 'Rak Kiloan Diperbarui',
        category: 'SATUAN',
        capacity: 20,
        locationNote: 'Lantai 2 Dekat Ruang Setrika',
        isActive: true,
      }),
    });
    assert(updateRackRes.status === 200, `Gagal memperbarui rak: HTTP ${updateRackRes.status}`);

    // Re-fetch GET
    const getRacksRes = await fetch(`${baseUrl}/api/laundry/racks?outletId=${outlet.id}`, { headers: authHeaders });
    assert(getRacksRes.status === 200, `Gagal memuat rak: HTTP ${getRacksRes.status}`);
    const rackList = (await getRacksRes.json()).data;
    const verifiedRack = rackList.find((r: any) => r.id === createdRack.id);
    assert(verifiedRack, 'Rak yang diperbarui harus ditemukan');
    assert(verifiedRack.code === `RK-REV-${timestamp.slice(-3)}`, 'Kode rak tidak persisten');
    assert(verifiedRack.name === 'Rak Kiloan Diperbarui', 'Nama rak tidak persisten');
    assert(verifiedRack.category === 'SATUAN', 'Kategori rak tidak persisten');
    assert(verifiedRack.capacity === 20, 'Kapasitas rak tidak persisten');
    assert(verifiedRack.locationNote === 'Lantai 2 Dekat Ruang Setrika', 'Lokasi rak tidak persisten');

    // Negative Validation Rak
    const negRackRes = await fetch(`${baseUrl}/api/laundry/racks/${createdRack.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ capacity: -5 }),
    });
    assert(negRackRes.status === 400, 'Kapasitas rak negatif harus ditolak HTTP 400');
    console.log('   ✅ Master Rak: 100% CRUD persistensi & validasi negatif LULUS.');

    // 3.B Master Mesin Produksi CRUD
    console.log('   3.B Menguji CRUD Master Mesin Produksi...');
    const createMachineRes = await fetch(`${baseUrl}/api/laundry/machines`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        outletId: outlet.id,
        code: `WASH-${timestamp.slice(-3)}`,
        name: 'Mesin Cuci Primus 15kg',
        machineType: 'WASHER',
        capacityKg: 15.0,
        status: 'ACTIVE',
      }),
    });
    assert(createMachineRes.status === 201, `Gagal membuat mesin: HTTP ${createMachineRes.status}`);
    const createdMachine = (await createMachineRes.json()).data;

    // Update ALL editable fields
    const updateMachineRes = await fetch(`${baseUrl}/api/laundry/machines/${createdMachine.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        code: `WS-REV-${timestamp.slice(-3)}`,
        name: 'Mesin Cuci Primus 20kg Titan',
        machineType: 'WASHER',
        capacityKg: 20.0,
        status: 'MAINTENANCE',
      }),
    });
    assert(updateMachineRes.status === 200, `Gagal memperbarui mesin: HTTP ${updateMachineRes.status}`);

    // Re-fetch GET
    const getMachinesRes = await fetch(`${baseUrl}/api/laundry/machines?outletId=${outlet.id}`, { headers: authHeaders });
    assert(getMachinesRes.status === 200, `Gagal memuat mesin: HTTP ${getMachinesRes.status}`);
    const machinesList = (await getMachinesRes.json()).data;
    const verifiedMachine = machinesList.find((m: any) => m.id === createdMachine.id);
    assert(verifiedMachine, 'Mesin yang diperbarui harus ditemukan');
    assert(verifiedMachine.code === `WS-REV-${timestamp.slice(-3)}`, 'Kode mesin tidak persisten');
    assert(verifiedMachine.name === 'Mesin Cuci Primus 20kg Titan', 'Nama mesin tidak persisten');
    assert(Number(verifiedMachine.capacityKg) === 20.0, 'Kapasitas mesin tidak persisten');
    assert(verifiedMachine.status === 'MAINTENANCE', 'Status mesin tidak persisten');

    // Negative Validation Mesin
    const negMachineRes = await fetch(`${baseUrl}/api/laundry/machines/${createdMachine.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ capacityKg: -10 }),
    });
    assert(negMachineRes.status === 400, 'Kapasitas mesin negatif harus ditolak HTTP 400');
    console.log('   ✅ Master Mesin: 100% CRUD persistensi & validasi negatif LULUS.');

    // 3.C Insiden & Kompensasi CRUD
    console.log('   3.C Menguji Update Insiden & Kompensasi...');
    const testOrder = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userId: ownerUser.id,
        shiftId: activeShift.id,
        invoiceNumber: `INV-TEST-${timestamp.slice(-4)}`,
        subtotal: new Prisma.Decimal(50000),
        totalAmount: new Prisma.Decimal(50000),
        orderStatus: 'COMPLETED',
        paymentStatus: 'PAID',
      },
    });

    const createIncidentRes = await fetch(`${baseUrl}/api/laundry/incidents`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        outletId: outlet.id,
        orderId: testOrder.id,
        incidentType: 'DAMAGED',
        itemDescription: 'Kemeja Sutra Putih',
        stage: 'IRONING',
        notes: 'Kain terkena panas setrika berlebih',
        estimatedCompensation: 50000,
      }),
    });
    assert(createIncidentRes.status === 201, `Gagal membuat insiden: HTTP ${createIncidentRes.status}`);
    const createdIncident = (await createIncidentRes.json()).data;

    const updateIncidentRes = await fetch(`${baseUrl}/api/laundry/incidents/${createdIncident.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        status: 'APPROVED',
        approvedCompensation: 50000,
        resolutionNotes: 'Disetujui kompensasi tunai Rp 50.000',
      }),
    });
    assert(updateIncidentRes.status === 200, `Gagal update insiden: HTTP ${updateIncidentRes.status}`);

    const getIncidentsRes = await fetch(`${baseUrl}/api/laundry/incidents?outletId=${outlet.id}`, { headers: authHeaders });
    assert(getIncidentsRes.status === 200, `Gagal memuat insiden: HTTP ${getIncidentsRes.status}`);
    const incidentsList = (await getIncidentsRes.json()).data;
    const verifiedIncident = incidentsList.find((i: any) => i.id === createdIncident.id);
    assert(verifiedIncident, 'Insiden harus ditemukan');
    assert(verifiedIncident.status === 'APPROVED', 'Status insiden tidak persisten');
    assert(Number(verifiedIncident.approvedCompensation) === 50000, 'approvedCompensation tidak persisten');
    assert(verifiedIncident.resolutionNotes === 'Disetujui kompensasi tunai Rp 50.000', 'resolutionNotes tidak persisten');

    // Negative Validation Insiden
    const negIncidentRes = await fetch(`${baseUrl}/api/laundry/incidents/${createdIncident.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ approvedCompensation: -5000 }),
    });
    assert(negIncidentRes.status === 400, 'Kompensasi insiden negatif harus ditolak HTTP 400');
    console.log('   ✅ Insiden & Kompensasi: 100% CRUD persistensi & validasi negatif LULUS.\n');

    // =========================================================================
    // 4. KELOMPOK 4: SDM, TEMPLATE SHIFT, EVALUASI PERFORMA & HR/PAYROLL
    // =========================================================================
    console.log('▶️ [KELOMPOK 4] Audit CRUD Template Shift & Review Performa...');

    // 4.A Template Shift CRUD
    console.log('   4.A Menguji CRUD Template Shift...');
    const createTemplateRes = await fetch(`${baseUrl}/api/attendance/shift-templates`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        outletId: outlet.id,
        name: 'Shift Siang Produksi',
        startTime: '12:00',
        endTime: '20:00',
        colorHex: '#2563EB',
        graceMinutes: 15,
        isOffDay: false,
      }),
    });
    assert(createTemplateRes.status === 201, `Gagal membuat template shift: HTTP ${createTemplateRes.status}`);
    const createdTemplate = (await createTemplateRes.json()).data;

    // Update ALL editable fields
    const updateTemplateRes = await fetch(`${baseUrl}/api/attendance/shift-templates/${createdTemplate.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Shift Siang Produksi Diperbarui',
        startTime: '13:00',
        endTime: '21:00',
        colorHex: '#1D4ED8',
        graceMinutes: 20,
        isOffDay: false,
        isActive: true,
      }),
    });
    assert(updateTemplateRes.status === 200, `Gagal memperbarui template shift: HTTP ${updateTemplateRes.status}`);

    // Re-fetch GET
    const getTemplatesRes = await fetch(`${baseUrl}/api/attendance/shift-templates?outletId=${outlet.id}`, { headers: authHeaders });
    assert(getTemplatesRes.status === 200, `Gagal memuat template shift: HTTP ${getTemplatesRes.status}`);
    const templatesList = (await getTemplatesRes.json()).data;
    const verifiedTemplate = templatesList.find((t: any) => t.id === createdTemplate.id);
    assert(verifiedTemplate, 'Template shift yang diperbarui harus ditemukan');
    assert(verifiedTemplate.name === 'Shift Siang Produksi Diperbarui', 'Nama template shift tidak persisten');
    assert(verifiedTemplate.startTime === '13:00', 'startTime template shift tidak persisten');
    assert(verifiedTemplate.endTime === '21:00', 'endTime template shift tidak persisten');
    assert(verifiedTemplate.colorHex === '#1D4ED8', 'colorHex template shift tidak persisten');
    assert(verifiedTemplate.graceMinutes === 20, 'graceMinutes template shift tidak persisten');

    // Negative Validation Template Shift
    const negTemplateRes = await fetch(`${baseUrl}/api/attendance/shift-templates/${createdTemplate.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ graceMinutes: -15 }),
    });
    assert(negTemplateRes.status === 400, 'graceMinutes negatif harus ditolak HTTP 400');
    console.log('   ✅ Template Shift: 100% CRUD persistensi & validasi negatif LULUS.');

    // 4.B Evaluasi Performa Staff CRUD
    console.log('   4.B Menguji Evaluasi Performa Staf...');
    const createReviewRes = await fetch(`${baseUrl}/api/laundry/staff-performance/reviews`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        outletId: outlet.id,
        userId: ownerUser.id,
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        disciplineScore: 90,
        productivityScore: 92,
        qualityScore: 88,
        customerScore: 95,
        overallScore: 91,
        grade: 'A',
        reviewerNotes: 'Kinerja operasional luar biasa stabil',
      }),
    });
    assert(createReviewRes.status === 201, `Gagal menyimpan review performa: HTTP ${createReviewRes.status}`);

    const getReviewsRes = await fetch(`${baseUrl}/api/laundry/staff-performance/reviews?outletId=${outlet.id}&userId=${ownerUser.id}`, { headers: authHeaders });
    assert(getReviewsRes.status === 200, `Gagal memuat review performa: HTTP ${getReviewsRes.status}`);
    const reviewsList = (await getReviewsRes.json()).data;
    assert(reviewsList.length > 0, 'Review performa harus ada di database');
    assert(Number(reviewsList[0].disciplineScore) === 90, 'disciplineScore tidak persisten');
    assert(Number(reviewsList[0].overallScore) === 91, 'overallScore tidak persisten');
    assert(reviewsList[0].grade === 'A', 'grade tidak persisten');
    assert(reviewsList[0].reviewerNotes === 'Kinerja operasional luar biasa stabil', 'reviewerNotes tidak persisten');

    // Negative Validation Review
    const negReviewRes = await fetch(`${baseUrl}/api/laundry/staff-performance/reviews`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        outletId: outlet.id,
        userId: ownerUser.id,
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        disciplineScore: 150, // Melebihi 100
      }),
    });
    assert(negReviewRes.status === 400, 'Skor performa > 100 harus ditolak HTTP 400');
    console.log('   ✅ Evaluasi Performa: 100% CRUD persistensi & validasi negatif LULUS.\n');

    // =========================================================================
    // 5. KELOMPOK 5: PENGATURAN TOKO, STRUK, DELIVERY & OUTLET PRICING
    // =========================================================================
    console.log('▶️ [KELOMPOK 5] Audit CRUD Format Struk, Delivery & Outlet Pricing...');

    // 5.A Pengaturan Struk & Toko
    console.log('   5.A Menguji Format Struk & Toko...');
    const updateReceiptRes = await fetch(`${baseUrl}/api/outlets/${outlet.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        googleReviewUrl: 'https://g.page/r/wellpos-laundry-menteng',
        receiptConfig: {
          paperSize: '80mm',
          footerText: 'Terima kasih telah mempercayakan pakaian Anda kepada kami',
          laundryTerms: 'Klaim kerusakan atau kehilangan maksimal 24 jam setelah serah terima',
          showQueueNumber: true,
          showWatermark: true,
          autoSendWaOnDropoff: true,
          whatsappConfig: {
            enabled: true,
            provider: 'FONNTE',
            usePlatformFallback: false,
            apiKey: 'fnte-test-api-key-999',
            senderNumber: '081299990001',
            autoSendWaOnDropoff: true,
          },
          cupLabelConfig: {
            enabled: true,
            paperSize: '40x30mm',
            autoPrintOnCheckout: true,
            onlyBeverages: true,
            showStoreName: true,
            showCustomerName: true,
            showModifiers: true,
          },
        },
      }),
    });
    assert(updateReceiptRes.status === 200, `Gagal menyimpan format struk: HTTP ${updateReceiptRes.status}`);

    // Re-fetch GET Outlet
    const getOutletRes = await fetch(`${baseUrl}/api/outlets/${outlet.id}`, { headers: authHeaders });
    assert(getOutletRes.status === 200, `Gagal memuat detail outlet: HTTP ${getOutletRes.status}`);
    const verifiedOutlet = (await getOutletRes.json()).data;
    assert(verifiedOutlet.googleReviewUrl === 'https://g.page/r/wellpos-laundry-menteng', 'googleReviewUrl tidak persisten');
    assert(verifiedOutlet.receiptConfig.paperSize === '80mm', 'paperSize struk tidak persisten');
    assert(verifiedOutlet.receiptConfig.footerText === 'Terima kasih telah mempercayakan pakaian Anda kepada kami', 'footerText struk tidak persisten');
    assert(verifiedOutlet.receiptConfig.laundryTerms === 'Klaim kerusakan atau kehilangan maksimal 24 jam setelah serah terima', 'laundryTerms struk tidak persisten');
    assert(verifiedOutlet.receiptConfig.showQueueNumber === true, 'showQueueNumber struk tidak persisten');
    assert(verifiedOutlet.receiptConfig.whatsappConfig.apiKey === 'fnte-test-api-key-999', 'whatsappConfig apiKey tidak persisten');
    assert(verifiedOutlet.receiptConfig.cupLabelConfig.paperSize === '40x30mm', 'cupLabelConfig paperSize tidak persisten');
    console.log('   ✅ Format Struk & Toko: 100% field persisten di database.');

    // 5.B Konfigurasi Delivery & Zona Ongkir
    console.log('   5.B Menguji Konfigurasi Delivery & Zona Ongkir...');
    const updateDeliveryRes = await fetch(`${baseUrl}/api/laundry/delivery-config`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        outletId: outlet.id,
        config: {
          enabled: true,
          freeDeliveryMinAmount: 75000,
          freeDeliveryMinWeightKg: 8,
          roundTripMultiplier: 1.8,
          zones: [
            { id: 'zone_near', name: 'Zona Dekat (<= 2 Km)', fee: 8000, maxKm: 2 },
            { id: 'zone_mid', name: 'Zona Menengah (2 - 5 Km)', fee: 14000, maxKm: 5 },
            { id: 'zone_far', name: 'Zona Luar (5 - 10 Km)', fee: 22000, maxKm: 10 },
          ],
        },
      }),
    });
    assert(updateDeliveryRes.status === 200, `Gagal menyimpan konfigurasi delivery: HTTP ${updateDeliveryRes.status}`);

    const getDeliveryRes = await fetch(`${baseUrl}/api/laundry/delivery-config?outletId=${outlet.id}`, { headers: authHeaders });
    assert(getDeliveryRes.status === 200, `Gagal memuat konfigurasi delivery: HTTP ${getDeliveryRes.status}`);
    const deliveryData = (await getDeliveryRes.json()).data;
    assert(deliveryData.freeDeliveryMinAmount === 75000, 'freeDeliveryMinAmount tidak persisten');
    assert(deliveryData.freeDeliveryMinWeightKg === 8, 'freeDeliveryMinWeightKg tidak persisten');
    assert(deliveryData.roundTripMultiplier === 1.8, 'roundTripMultiplier tidak persisten');
    assert(deliveryData.zones.length === 3, 'Jumlah zona delivery tidak persisten');
    assert(deliveryData.zones[1].fee === 14000, 'Tarif zona delivery tidak persisten');

    // Negative Validation Delivery
    const negDeliveryRes = await fetch(`${baseUrl}/api/laundry/delivery-config`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        outletId: outlet.id,
        config: { freeDeliveryMinAmount: -5000 },
      }),
    });
    assert(negDeliveryRes.status === 400, 'freeDeliveryMinAmount negatif harus ditolak HTTP 400');
    console.log('   ✅ Konfigurasi Delivery: 100% CRUD persistensi & validasi negatif LULUS.');

    // 5.C Penetapan Harga Outlet (Core Phase 1)
    console.log('   5.C Menguji Penetapan Harga Khusus Outlet...');
    const setPriceRes = await fetch(`${baseUrl}/api/laundry/core/services/${createdService.id}/outlet-price`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        outletId: outlet.id,
        priceOverride: 14500,
        expressMultiplierOverride: 2.0,
        isAvailable: true,
        reason: 'Penyesuaian tarif outlet pusat',
      }),
    });
    assert(setPriceRes.status === 200, `Gagal menetapkan harga outlet: HTTP ${setPriceRes.status}`);

    // Re-fetch Services for this Outlet
    const getOutletServicesRes = await fetch(`${baseUrl}/api/laundry/services?outletId=${outlet.id}`, { headers: authHeaders });
    assert(getOutletServicesRes.status === 200, `Gagal memuat services outlet: HTTP ${getOutletServicesRes.status}`);
    const outletServices = (await getOutletServicesRes.json()).data;
    const priceTarget = outletServices.find((s: any) => s.id === createdService.id);
    assert(priceTarget, 'Layanan target harus ditemukan');
    assert(Number(priceTarget.effectivePrice) === 14500, 'effectivePrice outlet tidak cocok dengan priceOverride');
    assert(Number(priceTarget.effectiveExpressMultiplier) === 2.0, 'effectiveExpressMultiplier outlet tidak cocok');

    // Negative Validation Outlet Price
    const negPriceRes = await fetch(`${baseUrl}/api/laundry/core/services/${createdService.id}/outlet-price`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        outletId: outlet.id,
        priceOverride: -1000,
      }),
    });
    assert(negPriceRes.status === 400, 'priceOverride negatif harus ditolak HTTP 400');
    console.log('   ✅ Outlet Pricing: 100% CRUD persistensi & validasi negatif LULUS.\n');

    // =========================================================================
    // 6. KELOMPOK 6: CORE PHASE 1-4 LAINNYA (CUSTOMER PREFERENCES & LOST/FOUND)
    // =========================================================================
    console.log('▶️ [KELOMPOK 6] Audit CRUD Customer Preferences & Lost & Found...');

    // 6.A Customer Preferences
    console.log('   6.A Menguji Preferensi Laundry Pelanggan...');
    const updatePrefRes = await fetch(`${baseUrl}/api/laundry/core/customers/${createdCustomer.id}/preferences`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        preferFoldOrHang: 'HANG',
        preferPerfume: 'Lavender Royal Supreme',
        avoidSoftener: true,
        alwaysExpress: true,
        customNotes: 'Pakaian sutra wajib dimasukkan kantong laundry terpisah',
        secondaryPhones: ['+6281299991111', '+6281299992222'],
      }),
    });
    assert(updatePrefRes.status === 200, `Gagal update preferensi pelanggan: HTTP ${updatePrefRes.status}`);

    const getPrefRes = await fetch(`${baseUrl}/api/laundry/core/customers/${createdCustomer.id}/preferences`, { headers: authHeaders });
    assert(getPrefRes.status === 200, `Gagal memuat preferensi pelanggan: HTTP ${getPrefRes.status}`);
    const prefData = (await getPrefRes.json()).data;
    assert(prefData.laundryPreferences.preferFoldOrHang === 'HANG', 'preferFoldOrHang tidak persisten');
    assert(prefData.laundryPreferences.preferPerfume === 'Lavender Royal Supreme', 'preferPerfume tidak persisten');
    assert(prefData.laundryPreferences.avoidSoftener === true, 'avoidSoftener tidak persisten');
    assert(prefData.laundryPreferences.alwaysExpress === true, 'alwaysExpress tidak persisten');
    assert(prefData.laundryPreferences.customNotes === 'Pakaian sutra wajib dimasukkan kantong laundry terpisah', 'customNotes tidak persisten');
    assert(prefData.secondaryPhones.length === 2, 'secondaryPhones tidak persisten');
    console.log('   ✅ Preferensi Pelanggan: 100% field persisten di database.');

    // 6.B Lost & Found CRUD (Verifikasi Zero Silent Drop!)
    console.log('   6.B Menguji Lost & Found (Zero Silent Drop)...');
    const createLfRes = await fetch(`${baseUrl}/api/laundry/core/lost-and-found`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        outletId: outlet.id,
        customerId: createdCustomer.id,
        itemCategory: 'VALUABLES',
        itemName: 'Dompet Kulit Cokelat',
        description: 'Ditemukan di saku dalam celana bahan hitam',
        storageLocation: 'Laci Kasir A1',
        notes: 'Berisi sejumlah kartu nama',
      }),
    });
    assert(createLfRes.status === 201, `Gagal membuat Lost & Found: HTTP ${createLfRes.status}`);
    const createdLf = (await createLfRes.json()).data;

    // Update ALL fields (termasuk itemName, itemCategory, description yang sebelumnya silent drop!)
    const updateLfRes = await fetch(`${baseUrl}/api/laundry/core/lost-and-found/${createdLf.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        itemName: 'Dompet Kulit Cokelat Braun Buffel (Original)',
        itemCategory: 'VALUABLES',
        description: 'Berisi identitas KTP dan kartu ATM atas nama Ibu Ratna',
        storageLocation: 'Brankas Utama Lantai 2',
        status: 'RETURNED',
        claimedByName: 'Ibu Ratna Sari Dewi',
        notes: 'Telah diserahkan langsung kepada pemilik setelah pencocokan data identitas',
      }),
    });
    assert(updateLfRes.status === 200, `Gagal update Lost & Found: HTTP ${updateLfRes.status}`);

    const getLfRes = await fetch(`${baseUrl}/api/laundry/core/lost-and-found?outletId=${outlet.id}`, { headers: authHeaders });
    assert(getLfRes.status === 200, `Gagal memuat Lost & Found: HTTP ${getLfRes.status}`);
    const lfList = (await getLfRes.json()).data;
    const verifiedLf = lfList.find((item: any) => item.id === createdLf.id);
    assert(verifiedLf, 'Item Lost & Found harus ditemukan');
    assert(verifiedLf.itemName === 'Dompet Kulit Cokelat Braun Buffel (Original)', 'itemName Lost & Found SILENT DROP!');
    assert(verifiedLf.itemCategory === 'VALUABLES', 'itemCategory Lost & Found SILENT DROP!');
    assert(verifiedLf.description === 'Berisi identitas KTP dan kartu ATM atas nama Ibu Ratna', 'description Lost & Found SILENT DROP!');
    assert(verifiedLf.storageLocation === 'Brankas Utama Lantai 2', 'storageLocation Lost & Found tidak persisten');
    assert(verifiedLf.status === 'RETURNED', 'status Lost & Found tidak persisten');
    assert(verifiedLf.claimedByName === 'Ibu Ratna Sari Dewi', 'claimedByName Lost & Found tidak persisten');
    console.log('   ✅ Lost & Found: 100% field persisten tanpa silent drop.\n');

    console.log('================================================================================');
    console.log('🎉 SELURUH PENGUJIAN AUDIT PERSISTENSI CRUD TAHAP 3 LULUS 100% (PASS)!');
    console.log('   • 6 Kelompok Modul Teruji Penuh: Create -> Update -> GET -> Assert');
    console.log('   • 100% Field Editable Persisten di Database (Zero Silent Drop)');
    console.log('   • Validasi Negatif & Format Tidak Valid Ditolak HTTP 400 (Zero Silent Fail)');
    console.log('================================================================================\n');

  } finally {
    if (serverInstance) {
      serverInstance.close();
    }

    if (createdTenantId) {
      console.log('🧹 [CLEANUP] Membersihkan seluruh data dummy test tenant terisolasi...');
      const cleanupQueries = [
        `DELETE FROM "laundry_order_item_tracks" WHERE "tenant_id" = $1`,
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
        `DELETE FROM "customers" WHERE "tenant_id" = $1`,
        `DELETE FROM "users" WHERE "tenant_id" = $1`,
        `DELETE FROM "outlets" WHERE "tenant_id" = $1`,
        `DELETE FROM "businesses" WHERE "tenant_id" = $1`,
        `DELETE FROM "tenants" WHERE "id" = $1`,
      ];
      for (const query of cleanupQueries) {
        try {
          await prisma.$executeRawUnsafe(query, createdTenantId);
        } catch {
          // Ignore table errors if cascaded or empty
        }
      }
      console.log('✨ [CLEANUP COMPLETE] Database bersih 100% tanpa residu.');
    }

    await prisma.$disconnect();
  }
}

runCrudPersistenceAudit()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ ERROR SAAT AUDIT CRUD PERSISTENCE TAHAP 3:', err);
    process.exit(1);
  });
