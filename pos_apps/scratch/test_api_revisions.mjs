const API_BASE = 'http://localhost:5001';

async function testBackendRevisions() {
  console.log('Testing Backend API Revisions...');

  // 1. Register new tenant
  const email = `test.api.revisi.${Date.now()}@kedai.com`;
  const regRes = await fetch(`${API_BASE}/api/saas/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: 'Kedai Verifikasi Revisi',
      ownerName: 'Budi Revi',
      email,
      phone: '+6281234567890',
      password: 'password123',
    }),
  });
  const regData = await regRes.json();
  console.log('1. Register result:', regData.status, regData.message);

  // 2. Try login with PENDING status
  const loginPendingRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'password123',
    }),
  });
  const loginPendingData = await loginPendingRes.json();
  console.log('2. Login pending status code:', loginPendingRes.status);
  console.log('2. Login pending code payload:', loginPendingData.code);
  console.log('2. Login pending message:', loginPendingData.message);

  if (loginPendingData.code !== 'TENANT_PENDING_APPROVAL') {
    throw new Error('Expected TENANT_PENDING_APPROVAL code!');
  }

  // 3. Superadmin approves tenant
  const saLoginRes = await fetch(`${API_BASE}/api/platform/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'superadmin@wellpos.id',
      password: 'superadmin123',
    }),
  });
  const saLoginData = await saLoginRes.json();
  const saToken = saLoginData.data.token;

  // Get tenant id
  const tenantsRes = await fetch(`${API_BASE}/api/platform/tenants`, {
    headers: { Authorization: `Bearer ${saToken}` },
  });
  const tenantsData = await tenantsRes.json();
  const targetTenant = tenantsData.data.find((t) => t.email === email || t.businessName === 'Kedai Verifikasi Revisi');
  console.log('3. Found tenant id:', targetTenant.id, 'Status:', targetTenant.status);

  // Approve tenant
  const approveRes = await fetch(`${API_BASE}/api/platform/tenants/${targetTenant.id}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${saToken}`,
    },
    body: JSON.stringify({
      status: 'TRIAL',
      reason: 'Disetujui oleh Super Admin',
    }),
  });
  const approveData = await approveRes.json();
  console.log('3. Approve result message:', approveData.message);
  console.log('3. Email notification payload:', approveData.emailNotification);

  if (!approveData.emailNotification || !approveData.emailNotification.sent) {
    throw new Error('Email notification was not generated!');
  }

  // 4. Login after approval
  const loginApprovedRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'password123',
    }),
  });
  const loginApprovedData = await loginApprovedRes.json();
  console.log('4. Login after approval result:', loginApprovedData.status, 'User:', loginApprovedData.data?.user.name);
  const clientToken = loginApprovedData.data.token;
  const outletId = loginApprovedData.data.user.outletId || loginApprovedData.data.user.outlet?.id;

  // 5. Test Onboarding with 1 guided product and receiptConfig
  const onboardRes = await fetch(`${API_BASE}/api/saas/onboarding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientToken}`,
    },
    body: JSON.stringify({
      outletId,
      address: 'Jl. Sudirman No. 88, Jakarta',
      phone: '+6281234567890',
      receiptSize: '80mm',
      receiptFooter: 'Terima kasih atas kunjungan Anda!',
      cashierName: 'Kasir Budi',
      cashierPin: '123456',
      initialProduct: {
        name: 'Kopi Susu Mantap',
        categoryName: 'Minuman Kopi',
        unit: 'Cup',
        costPrice: 8000,
        basePrice: 18000,
        initialStock: 45,
        isUnlimited: false,
      },
    }),
  });
  const onboardData = await onboardRes.json();
  console.log('5. Onboarding result message:', onboardData.message);
  console.log('5. Created initial product:', onboardData.data?.createdProduct);
  console.log('5. Saved receiptConfig:', onboardData.data?.receiptConfig);

  if (onboardData.data?.receiptConfig?.paperSize !== '80mm') {
    throw new Error('receiptConfig paperSize was not saved as 80mm!');
  }
  if (!onboardData.data?.createdProduct || onboardData.data.createdProduct.name !== 'Kopi Susu Mantap') {
    throw new Error('Guided initial product was not created properly!');
  }

  // 6. Test updating outlet receiptConfig
  const updateOutletRes = await fetch(`${API_BASE}/api/outlets/${outletId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientToken}`,
    },
    body: JSON.stringify({
      receiptConfig: {
        paperSize: '58mm',
        footerText: 'Default diubah fleksibel!',
      },
    }),
  });
  const updateOutletData = await updateOutletRes.json();
  console.log('6. Update outlet receiptConfig result:', updateOutletData.status, updateOutletData.data?.receiptConfig);

  if (updateOutletData.data?.receiptConfig?.paperSize !== '58mm') {
    throw new Error('Failed to update outlet receiptConfig to 58mm!');
  }

  console.log('\n🎉 SEMUA TES BACKEND API REVISI 1 - 5 BERHASIL SEMPURNA!');
}

testBackendRevisions().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
