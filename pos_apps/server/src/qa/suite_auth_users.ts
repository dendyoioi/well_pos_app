import {
  assert,
  createIsolatedQATenant,
  createTransientQAServer,
  cleanupQATenant,
  printSuiteSummary,
  TestScenarioResult,
} from './qa_helpers';

export async function runAuthUsersSuite(): Promise<boolean> {
  console.log('================================================================================');
  console.log('🔐 [SUITE 1/4] QA: AUTH, USERS, 5-DIGIT STAFF ID & CUSTOM ROLE RBAC');
  console.log('================================================================================\n');

  const results: TestScenarioResult[] = [];
  let tenantData: any = null;
  let serverInstance: any = null;

  try {
    console.log('🌱 Menyiapkan data seeder tenant & transient Express server...');
    tenantData = await createIsolatedQATenant('QA_AUTH');
    serverInstance = await createTransientQAServer();
    const { baseUrl } = serverInstance;
    const { tenantId, outletId, authHeaders } = tenantData;

    let createdStaffId = '';
    let customRoleId = '';

    // -------------------------------------------------------------------------
    // 1. Happy Path: Create Staff User dengan ID 5-Digit
    // -------------------------------------------------------------------------
    const t0 = Date.now();
    try {
      console.log('▶️ [1/10] Membuat akun staf kasir baru dengan ID 5-digit (10002)...');
      const createRes = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'Staf Kasir Utama QA',
          email: `kasir.${tenantData.timestamp.slice(-6)}@wellpos.qa`,
          userCode: '10002',
          pin: '123456',
          role: 'CASHIER',
          outletId,
          canCashOut: true,
        }),
      });
      assert(createRes.status === 201, `Gagal membuat user kasir: HTTP ${createRes.status}`);
      const body: any = await createRes.json();
      assert(body.data?.userCode === '10002', `userCode harus 10002, didapat: ${body.data?.userCode}`);
      createdStaffId = body.data.id;
      results.push({ name: 'Create Staff User dengan 5-Digit ID (10002)', status: 'PASS', durationMs: Date.now() - t0 });
    } catch (err: any) {
      results.push({ name: 'Create Staff User dengan 5-Digit ID (10002)', status: 'FAIL', durationMs: Date.now() - t0, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 2. Happy Path: Login Cepat Kasir menggunakan ID 5-Digit + PIN 6-Digit
    // -------------------------------------------------------------------------
    const t1 = Date.now();
    try {
      console.log('▶️ [2/10] Login cepat kasir dengan ID 5-digit (10002) + PIN 6-digit...');
      const loginRes = await fetch(`${baseUrl}/api/auth/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          userCode: '10002',
          pin: '123456',
        }),
      });
      assert(loginRes.status === 200, `Gagal login kasir PIN: HTTP ${loginRes.status}`);
      const loginBody: any = await loginRes.json();
      assert(!!loginBody.data?.token, 'Token JWT otentikasi wajib dikembalikan saat login PIN');
      assert(loginBody.data?.user?.userCode === '10002', 'userCode pada response login harus 10002');
      results.push({ name: 'Login Cepat Kasir via PIN (userCode: 10002)', status: 'PASS', durationMs: Date.now() - t1 });
    } catch (err: any) {
      results.push({ name: 'Login Cepat Kasir via PIN (userCode: 10002)', status: 'FAIL', durationMs: Date.now() - t1, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 3. Happy Path: Edit ID Staf (userCode) ke 5-Digit Baru (10005)
    // -------------------------------------------------------------------------
    const t2 = Date.now();
    try {
      console.log('▶️ [3/10] Memperbarui ID Staf dari 10002 ke 10005...');
      const updateRes = await fetch(`${baseUrl}/api/users/${createdStaffId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'Staf Kasir Utama QA (Updated)',
          userCode: '10005',
        }),
      });
      assert(updateRes.status === 200, `Gagal update userCode: HTTP ${updateRes.status}`);
      results.push({ name: 'Edit ID Staf (10002 -> 10005)', status: 'PASS', durationMs: Date.now() - t2 });
    } catch (err: any) {
      results.push({ name: 'Edit ID Staf (10002 -> 10005)', status: 'FAIL', durationMs: Date.now() - t2, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 4. Persistence Reload Check: Re-fetch dari API / Simpanan Database
    // -------------------------------------------------------------------------
    const t3 = Date.now();
    try {
      console.log('▶️ [4/10] Verifikasi persistensi edit ID Staf (Zero Silent Drop)...');
      const getRes = await fetch(`${baseUrl}/api/users`, { headers: authHeaders });
      assert(getRes.status === 200, `Gagal memuat list users: HTTP ${getRes.status}`);
      const list = (await getRes.json() as any).data;
      const verified = list.find((u: any) => u.id === createdStaffId);
      assert(verified, 'User kasir harus ditemukan di list users');
      assert(verified.userCode === '10005', `userCode gagal persisten (Silent Drop terdeteksi! Ditemukan: ${verified.userCode})`);
      assert(verified.name === 'Staf Kasir Utama QA (Updated)', 'Nama user gagal persisten');
      results.push({ name: 'Verifikasi Persistensi Reload ID Staf (Zero Silent Drop)', status: 'PASS', durationMs: Date.now() - t3 });
    } catch (err: any) {
      results.push({ name: 'Verifikasi Persistensi Reload ID Staf (Zero Silent Drop)', status: 'FAIL', durationMs: Date.now() - t3, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 5. Auth Invalidation Check: Login PIN ID Baru vs ID Lama
    // -------------------------------------------------------------------------
    const t4 = Date.now();
    try {
      console.log('▶️ [5/10] Verifikasi login PIN dengan ID baru (10005) & penolakan ID lama (10002)...');
      const loginNewRes = await fetch(`${baseUrl}/api/auth/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, userCode: '10005', pin: '123456' }),
      });
      assert(loginNewRes.status === 200, 'Login dengan ID baru 10005 harus berhasil');

      const loginOldRes = await fetch(`${baseUrl}/api/auth/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, userCode: '10002', pin: '123456' }),
      });
      assert(loginOldRes.status === 401 || loginOldRes.status === 404, 'Login dengan ID lama 10002 harus ditolak (401/404)');
      results.push({ name: 'Validasi Login ID Baru (200) & Penolakan ID Lama (401)', status: 'PASS', durationMs: Date.now() - t4 });
    } catch (err: any) {
      results.push({ name: 'Validasi Login ID Baru (200) & Penolakan ID Lama (401)', status: 'FAIL', durationMs: Date.now() - t4, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 6. Auto-Generate Next Staff ID
    // -------------------------------------------------------------------------
    const t5 = Date.now();
    try {
      console.log('▶️ [6/10] Menguji auto-generate nomor ID Staf berikutnya...');
      const nextCodeRes = await fetch(`${baseUrl}/api/users/next-code?role=CASHIER`, { headers: authHeaders });
      assert(nextCodeRes.status === 200, `Gagal memuat next user code: HTTP ${nextCodeRes.status}`);
      const nextCodeData = (await nextCodeRes.json() as any).data;
      assert(!!nextCodeData?.userCode, 'userCode hasil auto-generate harus ada');
      assert(/^\d{5}$/.test(nextCodeData.userCode), `userCode harus berupa 5 digit angka murni: ${nextCodeData.userCode}`);

      // Gunakan ID hasil auto-generate untuk membuat user baru
      const createAutoRes = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'Staf Auto Code QA',
          email: `auto.${tenantData.timestamp.slice(-6)}@wellpos.qa`,
          userCode: nextCodeData.userCode,
          pin: '654321',
          role: 'CASHIER',
          outletId,
        }),
      });
      assert(createAutoRes.status === 201, `Gagal membuat user dengan auto-code: HTTP ${createAutoRes.status}`);
      results.push({ name: 'Auto-Generate Next Staff ID & Create Persistence', status: 'PASS', durationMs: Date.now() - t5 });
    } catch (err: any) {
      results.push({ name: 'Auto-Generate Next Staff ID & Create Persistence', status: 'FAIL', durationMs: Date.now() - t5, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 7. Custom Role RBAC Management & Assignment
    // -------------------------------------------------------------------------
    const t6 = Date.now();
    try {
      console.log('▶️ [7/10] Menguji pembuatan Custom Role & penugasan hak akses ke staf...');
      const createRoleRes = await fetch(`${baseUrl}/api/users/roles`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'KASIR_SENIOR_AUDIT',
          description: 'Peran kustom kasir senior dengan izin cash drawer',
          permissions: ['orders.create', 'orders.read', 'cash.drawer'],
        }),
      });
      assert(createRoleRes.status === 201, `Gagal membuat custom role: HTTP ${createRoleRes.status}`);
      const roleData = (await createRoleRes.json() as any).data;
      customRoleId = roleData.id;

      // Assign role ke user kasir
      const assignRes = await fetch(`${baseUrl}/api/users/${createdStaffId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ customRoleId }),
      });
      assert(assignRes.status === 200, `Gagal assign custom role: HTTP ${assignRes.status}`);

      // Re-fetch dan pastikan peran tersimpan
      const getStaffRes = await fetch(`${baseUrl}/api/users`, { headers: authHeaders });
      const staffList = (await getStaffRes.json() as any).data;
      const targetStaff = staffList.find((u: any) => u.id === createdStaffId);
      assert(targetStaff?.customRoleId === customRoleId, 'customRoleId gagal persisten pada user');
      results.push({ name: 'Custom Role RBAC Create, Assignment & Persistence', status: 'PASS', durationMs: Date.now() - t6 });
    } catch (err: any) {
      results.push({ name: 'Custom Role RBAC Create, Assignment & Persistence', status: 'FAIL', durationMs: Date.now() - t6, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 8. Negative Validation: ID Staf Non-5-Digit & Non-Numeric
    // -------------------------------------------------------------------------
    const t7 = Date.now();
    try {
      console.log('▶️ [8/10] Validasi Negatif: Penolakan ID Staf != 5 digit atau non-angka...');
      // 4 digit
      const res4d = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: 'X', email: 'x4@qa.test', userCode: '1234', pin: '1234', role: 'CASHIER' }),
      });
      assert(res4d.status === 400, 'ID Staf 4-digit harus ditolak HTTP 400');

      // 6 digit
      const res6d = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: 'X', email: 'x6@qa.test', userCode: '123456', pin: '1234', role: 'CASHIER' }),
      });
      assert(res6d.status === 400, 'ID Staf 6-digit harus ditolak HTTP 400');

      // Huruf / Alphanumeric
      const resAlpha = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: 'X', email: 'xa@qa.test', userCode: '1000A', pin: '1234', role: 'CASHIER' }),
      });
      assert(resAlpha.status === 400, 'ID Staf memuat huruf harus ditolak HTTP 400');

      results.push({ name: 'Negative Assertion: Reject ID Staf != 5 digit / non-angka (400)', status: 'PASS', durationMs: Date.now() - t7 });
    } catch (err: any) {
      results.push({ name: 'Negative Assertion: Reject ID Staf != 5 digit / non-angka (400)', status: 'FAIL', durationMs: Date.now() - t7, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 9. Negative Validation: Duplikat ID Staf dalam Tenant Sama
    // -------------------------------------------------------------------------
    const t8 = Date.now();
    try {
      console.log('▶️ [9/10] Validasi Negatif: Penolakan duplikasi ID Staf pada tenant yang sama...');
      const resDup = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'Staf Duplikat QA',
          email: `dup.${tenantData.timestamp.slice(-6)}@wellpos.qa`,
          userCode: '10005', // Sudah dipakai oleh createdStaffId
          pin: '123456',
          role: 'CASHIER',
        }),
      });
      assert(resDup.status === 400 || resDup.status === 409, `ID Staf duplikat harus ditolak HTTP 400/409, didapat: ${resDup.status}`);
      results.push({ name: 'Negative Assertion: Reject Duplicate Staff ID (400/409)', status: 'PASS', durationMs: Date.now() - t8 });
    } catch (err: any) {
      results.push({ name: 'Negative Assertion: Reject Duplicate Staff ID (400/409)', status: 'FAIL', durationMs: Date.now() - t8, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 10. Negative Validation: Format PIN & Nama Custom Role Kosong
    // -------------------------------------------------------------------------
    const t9 = Date.now();
    try {
      console.log('▶️ [10/10] Validasi Negatif: Penolakan format PIN tidak valid & role nama kosong...');
      // PIN 2 digit
      const resPinShort = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: 'X', email: 'xp@qa.test', userCode: '99991', pin: '12', role: 'CASHIER' }),
      });
      assert(resPinShort.status === 400, 'PIN < 4 digit harus ditolak HTTP 400');

      // Custom Role nama kosong
      const resRoleEmpty = await fetch(`${baseUrl}/api/users/roles`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: '', permissions: [] }),
      });
      assert(resRoleEmpty.status === 400, 'Custom role dengan nama kosong harus ditolak HTTP 400');

      results.push({ name: 'Negative Assertion: Reject Invalid PIN & Empty Role Name (400)', status: 'PASS', durationMs: Date.now() - t9 });
    } catch (err: any) {
      results.push({ name: 'Negative Assertion: Reject Invalid PIN & Empty Role Name (400)', status: 'FAIL', durationMs: Date.now() - t9, error: err.message });
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

  return printSuiteSummary('qa:auth-users', results);
}

// Eksekusi langsung jika dipanggil via CLI
if (require.main === module) {
  runAuthUsersSuite()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((err) => {
      console.error('Fatal Suite Error:', err);
      process.exit(1);
    });
}
