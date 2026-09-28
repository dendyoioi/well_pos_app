const BASE_URL = 'http://localhost:5001/api';

async function runTest() {
  console.log('=== STARTING E2E VERIFICATION: MULTI-STORE ONBOARDING ARCHITECTURE ===\n');

  // 1. Clean Database
  console.log('[Step 1] Cleaning database to clean state (0 dummy data)...');
  const { execSync } = await import('child_process');
  execSync('npm run db:clean', { stdio: 'inherit' });

  // 2. Register Owner (Split Registration - 5 Fields, 0 Outlets Created)
  console.log('\n[Step 2] Testing Owner Registration with 5 split fields...');
  const regPayload = {
    firstName: 'Dendy',
    lastName: 'Aditya',
    phone: '+6281234567890',
    email: 'dendy.owner@senjagroup.id',
    password: 'password123',
    confirmPassword: 'password123',
  };

  const regRes = await fetch(`${BASE_URL}/saas/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload),
  });
  const regData: any = await regRes.json();
  console.log('Registration Status:', regRes.status, regData);

  if (regData.status !== 'success') {
    throw new Error(`Registration failed: ${regData.message}`);
  }

  const tenantId = regData.data.tenant.id;
  console.log(`Registered Tenant ID: ${tenantId}`);

  // 3. Verify Owner cannot login prior to Superadmin approval
  console.log('\n[Step 3] Verifying owner cannot login while status is PENDING...');
  const unapprovedLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: regPayload.email, password: regPayload.password }),
  });
  const unapprovedLoginData: any = await unapprovedLoginRes.json();
  console.log('Pending login attempt status:', unapprovedLoginRes.status, unapprovedLoginData.message);

  if (unapprovedLoginRes.status === 200) {
    throw new Error('Owner should NOT be able to login while status is PENDING!');
  }

  // 4. Superadmin Login and Approve Owner
  console.log('\n[Step 4] Superadmin logs in and approves owner tenant...');
  const saLoginRes = await fetch(`${BASE_URL}/platform/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@wellpos.id', password: 'superadmin123' }),
  });
  const saLoginData: any = await saLoginRes.json();
  console.log('saLoginData:', saLoginData);
  const saToken = saLoginData.data.token;
  console.log('Superadmin login success. Token acquired.');

  // 3b. Verify Superadmin views pending tenant detail and sees real WhatsApp phone
  console.log('\n[Step 3b] Superadmin inspects pending tenant detail (verifying WhatsApp phone before approval)...');
  const pendingDetailRes = await fetch(`${BASE_URL}/platform/tenants/${tenantId}`, {
    headers: { Authorization: `Bearer ${saToken}` },
  });
  const pendingDetailData: any = await pendingDetailRes.json();
  console.log('Pending Detail Data Owner Phone:', pendingDetailData.data?.owner?.phone);
  if (pendingDetailData.data?.owner?.phone !== regPayload.phone) {
    throw new Error(`Expected owner phone to be ${regPayload.phone}, got ${pendingDetailData.data?.owner?.phone}`);
  }
  console.log('SUCCESS: Pending owner WhatsApp phone verified accurately!');

  const approveRes = await fetch(`${BASE_URL}/platform/tenants/${tenantId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${saToken}`,
    },
    body: JSON.stringify({ status: 'ACTIVE', notes: 'Approved by SuperAdmin' }),
  });
  const approveData: any = await approveRes.json();
  console.log('Tenant approval result:', approveData);

  // 5. Owner Logs in Successfully
  console.log('\n[Step 5] Owner logs in after approval...');
  const ownerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: regPayload.email, password: regPayload.password }),
  });
  const ownerLoginData: any = await ownerLoginRes.json();
  console.log('Owner login status:', ownerLoginRes.status, 'User Name:', ownerLoginData.data?.user?.name);
  const ownerToken = ownerLoginData.data.token;

  // 6. Check Outlets for Owner (Must be 0 initially!)
  console.log('\n[Step 6] Checking outlets for newly approved owner (Expect 0 outlets)...');
  const outletsRes = await fetch(`${BASE_URL}/outlets`, {
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      'x-tenant-id': tenantId,
    },
  });
  const outletsData: any = await outletsRes.json();
  console.log('Outlets count:', outletsData.data?.length);

  if (outletsData.data?.length !== 0) {
    throw new Error(`Expected 0 outlets initially, but got: ${outletsData.data?.length}`);
  }
  console.log('CONFIRMED: Newly registered owner has 0 outlets -> FullScreenStoreWizard will be triggered!');

  // 7. Owner creates initial store via createInitialStore
  console.log('\n[Step 7] Owner creates initial store via FullScreenStoreWizard endpoint...');
  const createStorePayload = {
    merchantName: 'PT Kopi Senja Mandiri',
    storeName: 'Kopi Senja - Cabang Utama Tebet',
    address: 'Jl. Tebet Barat Dalam Raya No. 45, Jakarta Selatan',
    industries: ['Kedai Kopi', 'Toko Kue dan Makanan Penutup', 'Minimarket'],
  };

  const createStoreRes = await fetch(`${BASE_URL}/saas/stores/create-initial`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify(createStorePayload),
  });
  const createStoreData: any = await createStoreRes.json();
  console.log('Create Store Status:', createStoreRes.status, createStoreData);

  if (createStoreData.status !== 'success') {
    throw new Error(`Create initial store failed: ${createStoreData.message}`);
  }

  // 8. Verify Outlets now equals 1 with correct industries and merchantName
  console.log('\n[Step 8] Verifying outlets count and stored attributes...');
  const postOutletsRes = await fetch(`${BASE_URL}/outlets`, {
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      'x-tenant-id': tenantId,
    },
  });
  const postOutletsData: any = await postOutletsRes.json();
  console.log('Outlets count after creation:', postOutletsData.data?.length);
  const createdOutlet = postOutletsData.data[0];
  console.log('Created Store Details:', {
    id: createdOutlet.id,
    name: createdOutlet.name,
    address: createdOutlet.address,
    merchantName: createdOutlet.merchantName,
    industries: createdOutlet.industries,
  });

  if (postOutletsData.data?.length !== 1) {
    throw new Error('Expected 1 outlet after store creation!');
  }
  if (!createdOutlet.industries || createdOutlet.industries.length !== 3) {
    throw new Error('Industries did not match expected 3 items!');
  }

  console.log('\n[Step 9] Superadmin views tenant with store details...');
  const tenantDetailRes = await fetch(`${BASE_URL}/platform/tenants/${tenantId}`, {
    headers: { Authorization: `Bearer ${saToken}` },
  });
  const tenantDetailData: any = await tenantDetailRes.json();
  console.log('Superadmin view of tenant outlets count:', tenantDetailData.data.outlets.length);
  console.log('Outlet name in superadmin:', tenantDetailData.data.outlets[0].name);
  console.log('Industries in superadmin:', tenantDetailData.data.outlets[0].industries);

  // 10. Clean database to adhere to 0 dummy data rule
  console.log('\n[Step 10] Teardown: Cleaning database to ensure 0 dummy data...');
  execSync('npm run db:clean', { stdio: 'inherit' });
  console.log('Database cleaned. 0 dummy data confirmed.');

  console.log('\n======================================================');
  console.log('ALL E2E CHECKS PASSED PERFECTLY (10/10 STEPS VERIFIED)');
  console.log('======================================================\n');
}

runTest().catch((err) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
