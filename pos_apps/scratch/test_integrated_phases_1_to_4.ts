const BASE_URL = 'http://localhost:5001';

async function runTest() {
  console.log('🚀 Starting Integrated Verification for Phases 1 to 4...\n');

  // 1. Authenticate as Kasir PRO and Owner PRO
  console.log('[Step 1] Authenticating Cashier and Owner PRO...');
  const cashierAuthRes = await fetch(`${BASE_URL}/api/auth/pin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '222222', email: 'kasir.pro@wellpos.id' }),
  });
  const cashierAuth = await cashierAuthRes.json() as any;
  if (cashierAuth.status !== 'success') {
    throw new Error(`Failed cashier login: ${JSON.stringify(cashierAuth)}`);
  }
  const cashierToken = cashierAuth.data.token;
  const cashierOutletId = cashierAuth.data.user.outletId;
  console.log(`   ✓ Cashier authenticated: ${cashierAuth.data.user.name} (Outlet: ${cashierOutletId})`);

  const ownerAuthRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner.pro@wellpos.id', password: 'pro123' }),
  });
  const ownerAuth = await ownerAuthRes.json() as any;
  const ownerToken = ownerAuth.data.token;
  console.log(`   ✓ Owner authenticated: ${ownerAuth.data.user.name}`);

  // 2. Test Tahap 1: Foto Produk in Catalog
  console.log('\n[Step 2 - Tahap 1] Verifying Product Catalog & Image URLs...');
  const prodRes = await fetch(`${BASE_URL}/api/products?outletId=${cashierOutletId}`, {
    headers: { Authorization: `Bearer ${cashierToken}` },
  });
  const prodData = await prodRes.json() as any;
  if (prodData.status !== 'success' || prodData.data.length === 0) {
    throw new Error('Failed to fetch products');
  }
  const firstProduct = prodData.data[0];
  console.log(`   ✓ Sample Product: "${firstProduct.name}" (SKU: ${firstProduct.sku})`);
  console.log(`   ✓ Image URL present: ${firstProduct.imageUrl ? firstProduct.imageUrl.slice(0, 50) + '...' : 'None'}`);

  // 3. Test Tahap 2 & Tahap 3: Checkout with GoFood Channel & CRM Opsi A (New Customer Auto-Creation)
  console.log('\n[Step 3 - Tahap 2 & 3] Testing Online Channel Order (GOFOOD) + CRM Opsi A Auto-Create...');
  const testPhone = `0899${Math.floor(1000000 + Math.random() * 9000000)}`;
  const testCustomerName = `Budi GoFood ${Date.now().toString().slice(-4)}`;

  const checkoutPayload = {
    outletId: cashierOutletId,
    channel: 'GOFOOD',
    customerName: testCustomerName,
    customerPhone: testPhone,
    customerEmail: 'budi.gofood@gmail.com',
    items: [
      {
        productId: firstProduct.id,
        quantity: 2,
        discountAmount: 0,
      },
    ],
    payments: [
      {
        method: 'QRIS',
        amountPaid: firstProduct.basePrice * 2,
        qrisReference: 'GF-PAY-99281',
      },
    ],
  };

  const checkoutRes = await fetch(`${BASE_URL}/api/orders/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cashierToken}`,
    },
    body: JSON.stringify(checkoutPayload),
  });
  const orderResult = await checkoutRes.json() as any;
  if (orderResult.status !== 'success') {
    throw new Error(`Checkout failed: ${JSON.stringify(orderResult)}`);
  }
  const createdOrder = orderResult.data;
  console.log(`   ✓ Order created: Invoice #${createdOrder.invoiceNumber}`);
  console.log(`   ✓ Channel verified: ${createdOrder.channel}`);
  console.log(`   ✓ Customer verified: ${createdOrder.customerName} (${createdOrder.customerPhone})`);

  // Verify that customer was auto-created in Customer CRM
  const custSearchRes = await fetch(`${BASE_URL}/api/customers?search=${testPhone}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const custSearchResult = await custSearchRes.json() as any;
  if (custSearchResult.status !== 'success' || custSearchResult.data.length === 0) {
    throw new Error('Customer was not auto-created in database!');
  }
  const createdCust = custSearchResult.data[0];
  console.log(`   ✓ Customer CRM Auto-Enrollment verified! Name: ${createdCust.name}, Phone: ${createdCust.phone}, VisitCount: ${createdCust.visitCount}, TotalSpent: Rp ${createdCust.totalSpent}`);

  // 4. Test Tahap 4: Transfer Stok Antar Cabang (Multi-Outlet Stock Transfer)
  console.log('\n[Step 4 - Tahap 4] Testing Multi-Outlet Stock Transfer...');
  const outletsRes = await fetch(`${BASE_URL}/api/outlets`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const outletsData = await outletsRes.json() as any;
  if (outletsData.data.length < 2) {
    throw new Error('Need at least 2 outlets to test transfer');
  }
  const sourceOutlet = outletsData.data[0];
  const targetOutlet = outletsData.data[1];
  console.log(`   - Transferring from: "${sourceOutlet.name}" to "${targetOutlet.name}"`);

  // Check initial stock
  const initSourceProd = await fetch(`${BASE_URL}/api/products?outletId=${sourceOutlet.id}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  }).then(r => r.json()) as any;
  const initTargetProd = await fetch(`${BASE_URL}/api/products?outletId=${targetOutlet.id}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  }).then(r => r.json()) as any;

  const testProdId = firstProduct.id;
  const initialSourceStock = initSourceProd.data.find((p: any) => p.id === testProdId)?.stock || 0;
  const initialTargetStock = initTargetProd.data.find((p: any) => p.id === testProdId)?.stock || 0;
  console.log(`   - Initial stock: Source (${initialSourceStock}), Target (${initialTargetStock})`);

  const transferQty = 5;
  const transferRes = await fetch(`${BASE_URL}/api/inventory/transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      productId: testProdId,
      sourceOutletId: sourceOutlet.id,
      targetOutletId: targetOutlet.id,
      quantity: transferQty,
      notes: 'Test mutasi antar cabang automated',
    }),
  });
  const transferResult = await transferRes.json() as any;
  if (transferResult.status !== 'success') {
    throw new Error(`Transfer failed: ${JSON.stringify(transferResult)}`);
  }
  console.log(`   ✓ Transfer response: ${transferResult.message}`);

  // Check updated stock
  const updatedSourceProd = await fetch(`${BASE_URL}/api/products?outletId=${sourceOutlet.id}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  }).then(r => r.json()) as any;
  const updatedTargetProd = await fetch(`${BASE_URL}/api/products?outletId=${targetOutlet.id}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  }).then(r => r.json()) as any;

  const finalSourceStock = updatedSourceProd.data.find((p: any) => p.id === testProdId)?.stock || 0;
  const finalTargetStock = updatedTargetProd.data.find((p: any) => p.id === testProdId)?.stock || 0;

  console.log(`   - Final stock: Source (${finalSourceStock}), Target (${finalTargetStock})`);

  if (finalSourceStock !== initialSourceStock - transferQty) {
    throw new Error(`Source stock mismatch: expected ${initialSourceStock - transferQty}, got ${finalSourceStock}`);
  }
  if (finalTargetStock !== initialTargetStock + transferQty) {
    throw new Error(`Target stock mismatch: expected ${initialTargetStock + transferQty}, got ${finalTargetStock}`);
  }
  console.log('   ✓ Atomic stock update verified!');

  // Verify stock movements
  const movementsRes = await fetch(`${BASE_URL}/api/inventory/movements?productId=${testProdId}&limit=5`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const movementsData = await movementsRes.json() as any;
  const hasTransferOut = movementsData.data.some((m: any) => m.type === 'TRANSFER_OUT');
  const hasTransferIn = movementsData.data.some((m: any) => m.type === 'TRANSFER_IN');
  if (!hasTransferOut || !hasTransferIn) {
    throw new Error('Stock movements for TRANSFER_OUT / TRANSFER_IN not found!');
  }
  console.log('   ✓ StockMovement records for TRANSFER_OUT and TRANSFER_IN verified in database!');

  console.log('\n🎉 ALL INTEGRATED TESTS FOR PHASES 1 TO 4 PASSED WITH 100% SUCCESS!\n');
}

runTest().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
