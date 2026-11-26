import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import {
  assert,
  createIsolatedQATenant,
  createTransientQAServer,
  cleanupQATenant,
  printSuiteSummary,
  TestScenarioResult,
} from './qa_helpers';

export async function runLaundryCoreSuite(): Promise<boolean> {
  console.log('================================================================================');
  console.log('🧺 [SUITE 2/4] QA: LAUNDRY CORE, SERVICES, RACKS, MACHINES & E2E ORDER FLOW');
  console.log('================================================================================\n');

  const results: TestScenarioResult[] = [];
  let tenantData: any = null;
  let serverInstance: any = null;

  try {
    console.log('🌱 Menyiapkan data seeder tenant & transient Express server...');
    tenantData = await createIsolatedQATenant('QA_LND');
    serverInstance = await createTransientQAServer();
    const { baseUrl } = serverInstance;
    const { tenantId, outletId, shiftId, ownerId, authHeaders, timestamp } = tenantData;

    let createdServiceId = '';
    let createdPerfumeId = '';
    let createdRackId = '';
    let createdMachineId = '';
    let createdCustomerId = '';

    // -------------------------------------------------------------------------
    // 1. Master Layanan & Add-on (Preservasi expressMultiplier & durationHours: 0)
    // -------------------------------------------------------------------------
    const t0 = Date.now();
    try {
      console.log('▶️ [1/9] Menguji CRUD Master Layanan & Add-on (durasi 0 jam & expressMultiplier)...');
      // Buat Layanan Utama Kiloan
      const createServiceRes = await fetch(`${baseUrl}/api/laundry/services`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          outletId,
          name: 'Cuci Komplit Reguler QA',
          pricingType: 'PER_KG',
          unit: 'KG',
          price: 10000,
          durationHours: 24,
          expressMultiplier: 1.5,
          minimumOrderQty: 3.0,
          isActive: true,
        }),
      });
      assert(createServiceRes.status === 201, `Gagal membuat layanan: HTTP ${createServiceRes.status}`);
      createdServiceId = (await createServiceRes.json() as any).data.id;

      // Buat Add-on (Treatment Noda) dengan durationHours: 0
      const createAddonRes = await fetch(`${baseUrl}/api/laundry/services`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          outletId,
          name: 'Spotting Treatment Noda Berat',
          pricingType: 'ADDON',
          unit: 'PCS',
          price: 5000,
          durationHours: 0,
          isActive: true,
        }),
      });
      assert(createAddonRes.status === 201, `Gagal membuat add-on durasi 0 jam: HTTP ${createAddonRes.status}`);

      // Update Layanan Utama (Edit & Re-fetch Persistence)
      const updateServiceRes = await fetch(`${baseUrl}/api/laundry/services/${createdServiceId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'Cuci Komplit Reguler QA (Premium)',
          price: 12000,
          durationHours: 12,
          expressMultiplier: 2.0,
          minimumOrderQty: 4.0,
        }),
      });
      assert(updateServiceRes.status === 200, `Gagal update layanan: HTTP ${updateServiceRes.status}`);

      // Re-fetch dan Assert
      const getServicesRes = await fetch(`${baseUrl}/api/laundry/services?outletId=${outletId}`, { headers: authHeaders });
      const servicesList = (await getServicesRes.json() as any).data;
      const verified = servicesList.find((s: any) => s.id === createdServiceId);
      assert(verified, 'Layanan yang diperbarui harus ditemukan');
      assert(verified.name === 'Cuci Komplit Reguler QA (Premium)', 'Nama layanan tidak persisten');
      assert(Number(verified.price) === 12000, 'Harga layanan tidak persisten');
      assert(Number(verified.expressMultiplier) === 2.0, 'expressMultiplier gagal persisten (kembali ke default)');

      results.push({ name: 'Master Layanan & Add-on (Duration: 0 & Express Multiplier Persistence)', status: 'PASS', durationMs: Date.now() - t0 });
    } catch (err: any) {
      results.push({ name: 'Master Layanan & Add-on (Duration: 0 & Express Multiplier Persistence)', status: 'FAIL', durationMs: Date.now() - t0, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 2. Master Parfum Laundry CRUD & Persistence
    // -------------------------------------------------------------------------
    const t1 = Date.now();
    try {
      console.log('▶️ [2/9] Menguji CRUD Master Parfum Laundry...');
      const createPerfumeRes = await fetch(`${baseUrl}/api/laundry/perfumes`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'Ocean Breeze QA',
          extraPrice: 2000,
          usageQtyPerUnit: 10,
          usageBasis: 'PER_KG',
          isActive: true,
          isDefault: true,
          sortOrder: 1,
        }),
      });
      assert(createPerfumeRes.status === 201, `Gagal membuat parfum: HTTP ${createPerfumeRes.status}`);
      createdPerfumeId = (await createPerfumeRes.json() as any).data.id;

      // Update ALL fields
      const updatePerfumeRes = await fetch(`${baseUrl}/api/laundry/perfumes/${createdPerfumeId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'Ocean Breeze Supreme QA',
          extraPrice: 3500,
          usageQtyPerUnit: 20,
          usageBasis: 'PER_ORDER',
          isActive: true,
          sortOrder: 5,
        }),
      });
      assert(updatePerfumeRes.status === 200, `Gagal update parfum: HTTP ${updatePerfumeRes.status}`);

      // Re-fetch dan Assert
      const getPerfumeRes = await fetch(`${baseUrl}/api/laundry/perfumes?includeInactive=true`, { headers: authHeaders });
      const perfumeList = (await getPerfumeRes.json() as any).data;
      const verifiedPerfume = perfumeList.find((p: any) => p.id === createdPerfumeId);
      assert(verifiedPerfume?.name === 'Ocean Breeze Supreme QA', 'Nama parfum tidak persisten');
      assert(Number(verifiedPerfume?.extraPrice) === 3500, 'extraPrice parfum tidak persisten');
      assert(verifiedPerfume?.usageBasis === 'PER_ORDER', 'usageBasis parfum tidak persisten');

      results.push({ name: 'Master Parfum Laundry CRUD & Persistence', status: 'PASS', durationMs: Date.now() - t1 });
    } catch (err: any) {
      results.push({ name: 'Master Parfum Laundry CRUD & Persistence', status: 'FAIL', durationMs: Date.now() - t1, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 3. Paket Deposit & Kuota Laundry CRUD & Persistence
    // -------------------------------------------------------------------------
    const t2 = Date.now();
    try {
      console.log('▶️ [3/9] Menguji Konfigurasi Paket Deposit & Kuota...');
      const updateDepositRes = await fetch(`${baseUrl}/api/laundry/deposit-config`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          outletId,
          expiryPolicy: 'EXPIRE',
          packages: [
            {
              id: 'pkg-quota-qa',
              name: 'Paket Berlangganan 50 Kg QA',
              type: 'QUOTA_KG',
              price: 350000,
              quotaKg: 50,
              quotaBonusKg: 5,
              validityDays: 60,
            },
          ],
        }),
      });
      assert(updateDepositRes.status === 200, `Gagal menyimpan paket deposit: HTTP ${updateDepositRes.status}`);

      const getDepositRes = await fetch(`${baseUrl}/api/laundry/deposit-config?outletId=${outletId}`, { headers: authHeaders });
      const depositData = (await getDepositRes.json() as any).data;
      assert(depositData.config.packages.length === 1, 'Jumlah paket deposit harus 1');
      assert(depositData.config.packages[0].quotaBonusKg === 5, 'quotaBonusKg tidak persisten');

      results.push({ name: 'Paket Deposit & Kuota Config Persistence', status: 'PASS', durationMs: Date.now() - t2 });
    } catch (err: any) {
      results.push({ name: 'Paket Deposit & Kuota Config Persistence', status: 'FAIL', durationMs: Date.now() - t2, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 4. Master Rak Laundry: Create, Edit, Proteksi Order Aktif & Delete
    // -------------------------------------------------------------------------
    const t3 = Date.now();
    try {
      console.log('▶️ [4/9] Menguji Master Rak Laundry: Create, Edit, Proteksi Order Aktif, dan Delete...');
      const createRackRes = await fetch(`${baseUrl}/api/laundry/racks`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          outletId,
          code: `RK-QA-${timestamp.slice(-4)}`,
          name: 'Rak Transit Produksi',
          category: 'KILOAN',
          capacity: 10,
          locationNote: 'Lantai 1 Belakang Kasir',
        }),
      });
      assert(createRackRes.status === 201, `Gagal membuat rak: HTTP ${createRackRes.status}`);
      createdRackId = (await createRackRes.json() as any).data.id;

      // Edit Rak
      const updateRackRes = await fetch(`${baseUrl}/api/laundry/racks/${createdRackId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          code: `RK-QA-MOD-${timestamp.slice(-4)}`,
          name: 'Rak Transit Produksi VIP',
          category: 'SATUAN',
          capacity: 25,
          locationNote: 'Lantai 2 Dekat Ruang Setrika',
        }),
      });
      assert(updateRackRes.status === 200, `Gagal edit rak: HTTP ${updateRackRes.status}`);

      // Re-fetch dan assert
      const getRacksRes = await fetch(`${baseUrl}/api/laundry/racks?outletId=${outletId}`, { headers: authHeaders });
      const rackList = (await getRacksRes.json() as any).data;
      const verifiedRack = rackList.find((r: any) => r.id === createdRackId);
      assert(verifiedRack?.name === 'Rak Transit Produksi VIP', 'Nama rak tidak persisten');
      assert(verifiedRack?.capacity === 25, 'Kapasitas rak tidak persisten');

      // Proteksi Order Aktif: Buat order dan simpan pakaian di rak ini
      const activeOrder = await prisma.order.create({
        data: {
          tenantId,
          outletId,
          userId: ownerId,
          shiftId,
          invoiceNumber: `INV-RK-PROT-${timestamp.slice(-4)}`,
          subtotal: new Prisma.Decimal(30000),
          totalAmount: new Prisma.Decimal(30000),
          orderStatus: 'IN_PROGRESS',
          paymentStatus: 'PAID',
        },
      });

      await prisma.laundryOrderDetail.create({
        data: {
          tenantId,
          outletId,
          orderId: activeOrder.id,
          rackCode: verifiedRack?.code || `RK-QA-MOD-${timestamp.slice(-4)}`,
          status: 'RECEIVED',
        },
      });

      // Percobaan HAPUS rak yang memiliki order aktif -> WAJIB DITOLAK HTTP 400!
      const deleteBlockedRes = await fetch(`${baseUrl}/api/laundry/racks/${createdRackId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      assert(deleteBlockedRes.status === 400, `Penghapusan rak dengan order aktif harus ditolak HTTP 400, didapat: ${deleteBlockedRes.status}`);

      // Pindahkan cucian / ubah order menjadi COMPLETED dan lepas dari rak
      await prisma.laundryOrderDetail.updateMany({
        where: { orderId: activeOrder.id },
        data: { rackCode: null },
      });
      await prisma.order.update({
        where: { id: activeOrder.id },
        data: { orderStatus: 'COMPLETED' },
      });

      // Sekarang HAPUS rak -> WAJIB BERHASIL HTTP 200!
      const deleteSuccessRes = await fetch(`${baseUrl}/api/laundry/racks/${createdRackId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      assert(deleteSuccessRes.status === 200, `Gagal menghapus rak yang sudah bersih: HTTP ${deleteSuccessRes.status}`);

      results.push({ name: 'Master Rak Laundry (CRUD + Proteksi Order Aktif Sebelum Hapus)', status: 'PASS', durationMs: Date.now() - t3 });
    } catch (err: any) {
      results.push({ name: 'Master Rak Laundry (CRUD + Proteksi Order Aktif Sebelum Hapus)', status: 'FAIL', durationMs: Date.now() - t3, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 5. Master Mesin Produksi CRUD & Persistence
    // -------------------------------------------------------------------------
    const t4 = Date.now();
    try {
      console.log('▶️ [5/9] Menguji CRUD Master Mesin Produksi...');
      const createMachineRes = await fetch(`${baseUrl}/api/laundry/machines`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          outletId,
          code: `WS-QA-${timestamp.slice(-4)}`,
          name: 'Washer Primus 15kg QA',
          machineType: 'WASHER',
          capacityKg: 15.0,
          status: 'ACTIVE',
        }),
      });
      assert(createMachineRes.status === 201, `Gagal membuat mesin: HTTP ${createMachineRes.status}`);
      createdMachineId = (await createMachineRes.json() as any).data.id;

      // Update Mesin
      const updateMachineRes = await fetch(`${baseUrl}/api/laundry/machines/${createdMachineId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'Washer Primus 20kg Titan QA',
          capacityKg: 20.0,
          status: 'MAINTENANCE',
        }),
      });
      assert(updateMachineRes.status === 200, `Gagal update mesin: HTTP ${updateMachineRes.status}`);

      // Re-fetch dan assert
      const getMachinesRes = await fetch(`${baseUrl}/api/laundry/machines?outletId=${outletId}`, { headers: authHeaders });
      const machineList = (await getMachinesRes.json() as any).data;
      const verifiedMachine = machineList.find((m: any) => m.id === createdMachineId);
      assert(verifiedMachine?.name === 'Washer Primus 20kg Titan QA', 'Nama mesin tidak persisten');
      assert(Number(verifiedMachine?.capacityKg) === 20.0, 'Kapasitas mesin tidak persisten');
      assert(verifiedMachine?.status === 'MAINTENANCE', 'Status mesin tidak persisten');

      results.push({ name: 'Master Mesin Produksi CRUD & Persistence', status: 'PASS', durationMs: Date.now() - t4 });
    } catch (err: any) {
      results.push({ name: 'Master Mesin Produksi CRUD & Persistence', status: 'FAIL', durationMs: Date.now() - t4, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 6. Lost & Found (Zero Silent Drop on Update)
    // -------------------------------------------------------------------------
    const t5 = Date.now();
    try {
      console.log('▶️ [6/9] Menguji Lost & Found: Zero Silent Drop pada Update...');
      const createLfRes = await fetch(`${baseUrl}/api/laundry/core/lost-and-found`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          outletId,
          itemCategory: 'POCKET_ITEM',
          itemName: 'Kunci Motor Honda',
          description: 'Ditemukan di saku celana jeans biru',
          storageLocation: 'Laci Kasir A1',
          notes: 'Gantungan kunci merah',
        }),
      });
      assert(createLfRes.status === 201, `Gagal membuat Lost & Found: HTTP ${createLfRes.status}`);
      const lfId = (await createLfRes.json() as any).data.id;

      // Update ALL fields (memastikan itemName, itemCategory, description, storageLocation tidak silent drop)
      const updateLfRes = await fetch(`${baseUrl}/api/laundry/core/lost-and-found/${lfId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          itemName: 'Kunci Motor Honda Smart Key (Vario 160)',
          itemCategory: 'VALUABLES',
          description: 'Kunci kontak smart key remote warna hitam',
          storageLocation: 'Brankas Utama',
          status: 'RETURNED',
          claimedByName: 'Bpk. Ahmad Subarjo',
          notes: 'Diserahkan langsung dengan verifikasi STNK',
        }),
      });
      assert(updateLfRes.status === 200, `Gagal update Lost & Found: HTTP ${updateLfRes.status}`);

      // Re-fetch dan assert
      const getLfRes = await fetch(`${baseUrl}/api/laundry/core/lost-and-found?outletId=${outletId}`, { headers: authHeaders });
      const lfList = (await getLfRes.json() as any).data;
      const verifiedLf = lfList.find((item: any) => item.id === lfId);
      assert(verifiedLf?.itemName === 'Kunci Motor Honda Smart Key (Vario 160)', 'itemName Lost & Found SILENT DROP!');
      assert(verifiedLf?.itemCategory === 'VALUABLES', 'itemCategory Lost & Found SILENT DROP!');
      assert(verifiedLf?.storageLocation === 'Brankas Utama', 'storageLocation Lost & Found tidak persisten');
      assert(verifiedLf?.status === 'RETURNED', 'status Lost & Found tidak persisten');

      results.push({ name: 'Lost & Found Update (Zero Silent Drop on All Fields)', status: 'PASS', durationMs: Date.now() - t5 });
    } catch (err: any) {
      results.push({ name: 'Lost & Found Update (Zero Silent Drop on All Fields)', status: 'FAIL', durationMs: Date.now() - t5, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 7. Customer Laundry Preferences (Dual Payload Adapter)
    // -------------------------------------------------------------------------
    const t6 = Date.now();
    try {
      console.log('▶️ [7/9] Menguji Customer Laundry Preferences (Dual Payload Adapter)...');
      const createCustRes = await fetch(`${baseUrl}/api/customers`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'Ibu Melani QA',
          phone: `+62812${timestamp.slice(-8)}`,
        }),
      });
      assert(createCustRes.status === 201, `Gagal membuat pelanggan: HTTP ${createCustRes.status}`);
      createdCustomerId = (await createCustRes.json() as any).data.id;

      // Update preferensi format flat
      const updatePrefRes = await fetch(`${baseUrl}/api/laundry/core/customers/${createdCustomerId}/preferences`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          preferFoldOrHang: 'HANG',
          preferPerfume: 'Ocean Breeze Supreme QA',
          avoidSoftener: true,
          alwaysExpress: true,
          customNotes: 'Pakaian sutra wajib kantong jaring',
          secondaryPhones: ['+6281299998888'],
        }),
      });
      assert(updatePrefRes.status === 200, `Gagal update preferensi: HTTP ${updatePrefRes.status}`);

      // Re-fetch dan assert
      const getPrefRes = await fetch(`${baseUrl}/api/laundry/core/customers/${createdCustomerId}/preferences`, { headers: authHeaders });
      const prefData = (await getPrefRes.json() as any).data;
      assert(prefData.laundryPreferences.preferFoldOrHang === 'HANG', 'preferFoldOrHang tidak persisten');
      assert(prefData.laundryPreferences.preferPerfume === 'Ocean Breeze Supreme QA', 'preferPerfume tidak persisten');
      assert(prefData.laundryPreferences.avoidSoftener === true, 'avoidSoftener tidak persisten');
      assert(prefData.secondaryPhones.length === 1, 'secondaryPhones tidak persisten');

      results.push({ name: 'Customer Laundry Preferences (Dual-Payload Persistence)', status: 'PASS', durationMs: Date.now() - t6 });
    } catch (err: any) {
      results.push({ name: 'Customer Laundry Preferences (Dual-Payload Persistence)', status: 'FAIL', durationMs: Date.now() - t6, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 8. End-to-End Laundry Order Flow (Drop-off -> Stage Progression -> Completed)
    // -------------------------------------------------------------------------
    const t7 = Date.now();
    try {
      console.log('▶️ [8/9] Menguji End-to-End Laundry Order Flow & Stage Progression...');
      const order = await prisma.order.create({
        data: {
          tenantId,
          outletId,
          userId: ownerId,
          shiftId,
          customerId: createdCustomerId,
          invoiceNumber: `INV-FLOW-${timestamp.slice(-4)}`,
          subtotal: new Prisma.Decimal(36000),
          totalAmount: new Prisma.Decimal(36000),
          orderStatus: 'CONFIRMED',
          paymentStatus: 'PAID',
        },
      });

      await prisma.laundryOrderDetail.create({
        data: {
          tenantId,
          outletId,
          orderId: order.id,
          perfumeVariant: 'Ocean Breeze Supreme QA',
          initialWeightKg: new Prisma.Decimal(3.0),
        },
      });

      // Update Berat Final
      const weightRes = await fetch(`${baseUrl}/api/laundry/core/orders/${order.id}/weight`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ finalWeightKg: 3.2, weightDiffReason: 'Penambahan pelembut' }),
      });
      assert(weightRes.status === 200, `Gagal update berat final: HTTP ${weightRes.status}`);

      // Progress Stages: WASHING -> DRYING -> IRONING -> PACKING -> RACK_STORAGE
      const stages = ['WASHING', 'DRYING', 'IRONING', 'PACKING', 'RACK_STORAGE'];
      for (const st of stages) {
        const stageRes = await fetch(`${baseUrl}/api/laundry/orders/${order.id}/advance-stage`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ nextStage: st, notes: `Pindah ke tahap ${st}` }),
        });
        assert(stageRes.status === 200, `Gagal progress ke tahap ${st}: HTTP ${stageRes.status}`);
      }

      // Final Handover / Completed
      const completeRes = await fetch(`${baseUrl}/api/laundry/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: 'COMPLETED', pickedUpBy: 'Ibu Melani' }),
      });
      assert(completeRes.status === 200, `Gagal menyelesaikan pesanan laundry: HTTP ${completeRes.status}`);

      // Re-fetch dan verifikasi status akhir di database
      const finalOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { laundryDetail: true },
      });
      assert(finalOrder?.orderStatus === 'COMPLETED', `Order harus berstatus COMPLETED, didapat: ${finalOrder?.orderStatus}`);
      assert(Number(finalOrder?.laundryDetail?.finalWeightKg) === 3.2, 'Berat final cucian tidak cocok');

      results.push({ name: 'End-to-End Laundry Order Flow (Drop-off -> Stage Progression -> Complete)', status: 'PASS', durationMs: Date.now() - t7 });
    } catch (err: any) {
      results.push({ name: 'End-to-End Laundry Order Flow (Drop-off -> Stage Progression -> Complete)', status: 'FAIL', durationMs: Date.now() - t7, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 9. Negative & Boundary Validations
    // -------------------------------------------------------------------------
    const t8 = Date.now();
    try {
      console.log('▶️ [9/9] Validasi Negatif: Penolakan harga minus, kapasitas mesin <= 0, dan rak invalid...');
      // Harga layanan negatif
      const resNegPrice = await fetch(`${baseUrl}/api/laundry/services`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ outletId, name: 'X', pricingType: 'PER_KG', price: -5000, durationHours: 12 }),
      });
      assert(resNegPrice.status === 400, 'Harga layanan negatif harus ditolak HTTP 400');

      // Extra price parfum negatif
      const resNegPerfume = await fetch(`${baseUrl}/api/laundry/perfumes`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: 'X', extraPrice: -1000 }),
      });
      assert(resNegPerfume.status === 400, 'extraPrice parfum negatif harus ditolak HTTP 400');

      // Kapasitas mesin <= 0
      const resNegMachine = await fetch(`${baseUrl}/api/laundry/machines`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ outletId, code: 'WS-0', name: 'X', machineType: 'WASHER', capacityKg: 0 }),
      });
      assert(resNegMachine.status === 400, 'Kapasitas mesin 0 harus ditolak HTTP 400');

      // Kapasitas rak negatif
      const resNegRack = await fetch(`${baseUrl}/api/laundry/racks`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ outletId, code: 'RK-0', name: 'X', category: 'KILOAN', capacity: -5 }),
      });
      assert(resNegRack.status === 400, 'Kapasitas rak negatif harus ditolak HTTP 400');

      results.push({ name: 'Negative Assertion: Reject Negative Prices, Zero Machine Capacity & Invalid Racks (400)', status: 'PASS', durationMs: Date.now() - t8 });
    } catch (err: any) {
      results.push({ name: 'Negative Assertion: Reject Negative Prices, Zero Machine Capacity & Invalid Racks (400)', status: 'FAIL', durationMs: Date.now() - t8, error: err.message });
      throw err;
    }

  } finally {
    if (serverInstance) {
      await serverInstance.close();
    }
    if (tenantData?.tenantId) {
      await cleanupQATenant(tenantData.tenantId);
    }
  }

  return printSuiteSummary('qa:laundry-core', results);
}

// Eksekusi langsung jika dipanggil via CLI
if (require.main === module) {
  runLaundryCoreSuite()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((err) => {
      console.error('Fatal Suite Error:', err);
      process.exit(1);
    });
}
