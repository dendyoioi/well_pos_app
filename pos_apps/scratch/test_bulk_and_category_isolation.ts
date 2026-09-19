const API_URL = 'http://localhost:5001/api';

async function test() {
  console.log('--- STARTING BULK ACTION & CATEGORY ISOLATION TESTS ---');

  // 1. Dapatkan Token Login Owner (Minimarket Maju Jaya)
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'owner.pro@wellpos.id',
      password: 'pro123',
    }),
  });
  const loginData = await loginRes.json();
  if (loginData.status !== 'success' || !loginData.data?.token) {
    throw new Error('Login failed: ' + JSON.stringify(loginData));
  }
  const token = loginData.data.token;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  console.log('✅ Logged in successfully as Owner PRO');

  // Outlet Menteng
  const outletId = '22222222-2222-2222-2222-222222222222';

  // 2. Buat 2 Kategori Uji
  const cat1Res = await fetch(`${API_URL}/categories`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Kategori Uji Alpha ' + Date.now().toString().slice(-4) }),
  });
  const cat1Data = await cat1Res.json();
  const cat1Id = cat1Data.data.id;
  const cat1Name = cat1Data.data.name;

  const cat2Res = await fetch(`${API_URL}/categories`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Kategori Uji Beta ' + Date.now().toString().slice(-4) }),
  });
  const cat2Data = await cat2Res.json();
  const cat2Id = cat2Data.data.id;
  const cat2Name = cat2Data.data.name;
  console.log(`✅ Created test categories: "${cat1Name}" & "${cat2Name}"`);

  // 3. Buat 2 Produk di Kategori Alpha
  const p1Res = await fetch(`${API_URL}/products`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      barcode: 'TEST-BARCODE-1-' + Date.now().toString().slice(-4),
      sku: 'SKU-TEST-1-' + Date.now().toString().slice(-4),
      name: 'Produk Alpha 1',
      categoryId: cat1Id,
      costPrice: 5000,
      basePrice: 10000,
      initialStock: 20,
      outletId,
    }),
  });
  const p1Data = await p1Res.json();
  const p1Id = p1Data.data.id;

  const p2Res = await fetch(`${API_URL}/products`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      barcode: 'TEST-BARCODE-2-' + Date.now().toString().slice(-4),
      sku: 'SKU-TEST-2-' + Date.now().toString().slice(-4),
      name: 'Produk Alpha 2',
      categoryId: cat1Id,
      costPrice: 6000,
      basePrice: 12000,
      initialStock: 15,
      outletId,
    }),
  });
  const p2Data = await p2Res.json();
  const p2Id = p2Data.data.id;
  console.log('✅ Created 2 products in Category Alpha:', p1Id, p2Id);

  // 4. Verifikasi Hitungan Kategori
  const catsRes = await fetch(`${API_URL}/categories?outletId=${outletId}`, { headers });
  const catsData = await catsRes.json();
  const foundCat1 = catsData.data.find((c: any) => c.id === cat1Id);
  console.log(`🔍 Product count in "${cat1Name}":`, foundCat1?.productCount);
  if (foundCat1?.productCount !== 2) {
    throw new Error(`Expected productCount 2, got ${foundCat1?.productCount}`);
  }
  console.log('✅ Accurate productCount verified for active products!');

  // 5. Coba Hapus Kategori Alpha (Harus DITOLAK karena ada 2 produk aktif)
  console.log('Testing deleteCategory with active products (should be rejected)...');
  const deleteFailRes = await fetch(`${API_URL}/categories/${cat1Id}`, {
    method: 'DELETE',
    headers,
  });
  const deleteFailData = await deleteFailRes.json();
  console.log('Delete response:', deleteFailRes.status, deleteFailData);
  if (deleteFailRes.status !== 400 || !deleteFailData.message.includes('terhubung')) {
    throw new Error('Category deletion with active products was not properly blocked!');
  }
  console.log('✅ Deletion properly blocked with helpful message!');

  // 6. Test Bulk Action: Ubah Kategori (Pindahkan p1 dan p2 ke Kategori Beta)
  console.log('Testing bulk CHANGE_CATEGORY to Beta...');
  const bulkMoveRes = await fetch(`${API_URL}/products/bulk-action`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'CHANGE_CATEGORY',
      productIds: [p1Id, p2Id],
      categoryId: cat2Id,
    }),
  });
  const bulkMoveData = await bulkMoveRes.json();
  console.log('Bulk move response:', bulkMoveData);
  if (bulkMoveData.status !== 'success') {
    throw new Error('Bulk move failed: ' + JSON.stringify(bulkMoveData));
  }

  // 7. Cek Kembali Hitungan Kategori Alpha vs Beta
  const catsAfterMoveRes = await fetch(`${API_URL}/categories?outletId=${outletId}`, { headers });
  const catsAfterMove = await catsAfterMoveRes.json();
  const checkCat1 = catsAfterMove.data.find((c: any) => c.id === cat1Id);
  const checkCat2 = catsAfterMove.data.find((c: any) => c.id === cat2Id);
  console.log(`🔍 After Move - "${cat1Name}" count:`, checkCat1?.productCount, `| "${cat2Name}" count:`, checkCat2?.productCount);
  if (checkCat1?.productCount !== 0 || checkCat2?.productCount !== 2) {
    throw new Error('Product counts did not update accurately after bulk move');
  }
  console.log('✅ Product counts updated accurately after bulk move!');

  // 8. Hapus Kategori Alpha sekarang (Harus SUKSES karena sudah 0 produk aktif)
  console.log('Testing deleteCategory now that it has 0 active products...');
  const deleteSuccessRes = await fetch(`${API_URL}/categories/${cat1Id}`, {
    method: 'DELETE',
    headers,
  });
  const deleteSuccessData = await deleteSuccessRes.json();
  console.log('Delete success response:', deleteSuccessData);
  if (deleteSuccessData.status !== 'success') {
    throw new Error('Category deletion failed: ' + JSON.stringify(deleteSuccessData));
  }
  console.log('✅ Empty category deleted successfully!');

  // 9. Test Bulk Action: SET_STATUS (Nonaktifkan produk di Beta)
  console.log('Testing bulk SET_STATUS: inactive...');
  const bulkDeactivateRes = await fetch(`${API_URL}/products/bulk-action`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'SET_STATUS',
      productIds: [p1Id, p2Id],
      isActive: false,
    }),
  });
  const bulkDeactivateData = await bulkDeactivateRes.json();
  console.log('Bulk deactivate response:', bulkDeactivateData);

  // 10. Test getCategories: setelah produk nonaktif, hitungan di Kategori Beta harus kembali 0
  const catsAfterDeactivate = await fetch(`${API_URL}/categories?outletId=${outletId}`, { headers });
  const catsDeactivated = await catsAfterDeactivate.json();
  const checkCat2After = catsDeactivated.data.find((c: any) => c.id === cat2Id);
  console.log(`🔍 After Deactivate - "${cat2Name}" count:`, checkCat2After?.productCount);
  if (checkCat2After?.productCount !== 0) {
    throw new Error(`Expected count 0 for deactivated products, got ${checkCat2After?.productCount}`);
  }
  console.log('✅ Inactive products properly excluded from category count!');

  // 11. Test Bulk Action: SET_STATUS kembali aktif untuk 1 produk
  console.log('Testing bulk SET_STATUS: active for p1...');
  await fetch(`${API_URL}/products/bulk-action`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'SET_STATUS',
      productIds: [p1Id],
      isActive: true,
    }),
  });

  const catsAfterReactivate = await fetch(`${API_URL}/categories?outletId=${outletId}`, { headers });
  const catsReactivated = await catsAfterReactivate.json();
  const checkCat2Reactivated = catsReactivated.data.find((c: any) => c.id === cat2Id);
  console.log(`🔍 After Reactivating 1 item - "${cat2Name}" count:`, checkCat2Reactivated?.productCount);
  if (checkCat2Reactivated?.productCount !== 1) {
    throw new Error(`Expected count 1, got ${checkCat2Reactivated?.productCount}`);
  }
  console.log('✅ Category count accurately incremented to 1!');

    console.log('🎉 ALL BACKEND LOGIC AND BULK ACTION TESTS PASSED PERFECTLY!');
  } finally {
    const { cleanAuditResidues } = await import('./clean_test_residues');
    await cleanAuditResidues();
  }
}

test().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
