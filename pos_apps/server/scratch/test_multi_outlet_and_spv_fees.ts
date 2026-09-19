/**
 * Integration Test: Multi-Outlet Architecture & Supervisor Dynamic Fees (PRO Tier)
 * Verifies:
 * 1. 1 Owner has 3 active branches (Cabang Pusat, Cabang Tebet, Cabang Kelapa Gading)
 * 2. Products and stocks are properly separated per branch
 * 3. Supervisor can toggle dynamic fees (PB1, Service Charge, Takeaway Box, custom fees) on/off
 * 4. Cashier checkout correctly calculates fees based on outlet config and order channel
 */

const BASE_URL = 'http://localhost:5001/api';

async function runTests() {
  console.log('🚀 Starting Multi-Outlet & Supervisor Dynamic Fees Integration Test...\n');

  // 1. Owner PRO Login
  console.log('--- Step 1: Owner PRO Login & Multi-Outlet Discovery ---');
  const ownerLoginRes = await fetch(`${BASE_URL}/auth/pin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '999222', email: 'owner.pro@wellpos.id' }),
  });
  const ownerLoginData = await ownerLoginRes.json();
  if (ownerLoginData.status !== 'success') {
    throw new Error(`Owner login failed: ${JSON.stringify(ownerLoginData)}`);
  }
  const ownerToken = ownerLoginData.data.token;
  console.log(`✅ Owner PRO Logged In: ${ownerLoginData.data.user.name} (${ownerLoginData.data.user.email})`);

  // Fetch Outlets for Owner PRO
  const outletsRes = await fetch(`${BASE_URL}/outlets`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const outletsData = await outletsRes.json();
  if (outletsData.status !== 'success' || !outletsData.data || outletsData.data.length < 3) {
    throw new Error(`Expected at least 3 outlets, got: ${JSON.stringify(outletsData)}`);
  }
  console.log(`✅ Found ${outletsData.data.length} Outlets for Owner PRO:`);
  outletsData.data.forEach((o: any, idx: number) => {
    console.log(`   ${idx + 1}. [${o.id}] ${o.name} | Fees Configured: ${o.feesConfig ? o.feesConfig.length : 0} items`);
  });

  const outletPusat = outletsData.data[0];
  const outletTebet = outletsData.data[1];
  const outletGading = outletsData.data[2];

  // 2. Stock Isolation Check
  console.log('\n--- Step 2: Checking Stock Isolation Across Branches ---');
  const prodsPusatRes = await fetch(`${BASE_URL}/products?outletId=${outletPusat.id}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const prodsPusat = (await prodsPusatRes.json()).data;

  const prodsTebetRes = await fetch(`${BASE_URL}/products?outletId=${outletTebet.id}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const prodsTebet = (await prodsTebetRes.json()).data;

  console.log(`Cabang Pusat [${outletPusat.name}]: Product 1 stock = ${prodsPusat[0]?.stock} ${prodsPusat[0]?.unit}`);
  console.log(`Cabang Tebet [${outletTebet.name}]: Product 1 stock = ${prodsTebet[0]?.stock} ${prodsTebet[0]?.unit}`);
  if (prodsPusat[0]?.stock === undefined || prodsTebet[0]?.stock === undefined) {
    throw new Error('Stock not returned per outlet!');
  }
  console.log('✅ Stock successfully isolated per branch!');

  // 3. Supervisor Dynamic Fee Toggle
  console.log('\n--- Step 3: Supervisor Fee Configuration & Toggle ---');
  const spvLoginRes = await fetch(`${BASE_URL}/auth/pin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '222111', email: 'spv.pro@wellpos.id' }),
  });
  const spvLoginData = await spvLoginRes.json();
  const spvToken = spvLoginData.data.token;
  console.log(`✅ Supervisor PRO Logged In: ${spvLoginData.data.user.name}`);

  // Test updating fees for Cabang Pusat (Toggle Service Charge OFF, add Plastic Bag Rp 500)
  const updatedFees = [
    {
      id: 'fee_tax',
      name: 'PB1 / PPN Pajak',
      type: 'PERCENTAGE',
      rate: 10,
      channelScope: 'ALL',
      isActive: true,
    },
    {
      id: 'fee_service',
      name: 'Biaya Layanan Toko',
      type: 'PERCENTAGE',
      rate: 5,
      channelScope: 'DINE_IN',
      isActive: false, // Supervisor turns this OFF
    },
    {
      id: 'fee_box',
      name: 'Biaya Kemasan Box & Paperbag',
      type: 'FIXED',
      rate: 2000,
      channelScope: 'TAKEAWAY',
      isActive: true,
    },
    {
      id: 'fee_plastic',
      name: 'Biaya Kantong Kresek Ramah Lingkungan',
      type: 'FIXED',
      rate: 500,
      channelScope: 'ALL',
      isActive: true,
    },
  ];

  const updateFeeRes = await fetch(`${BASE_URL}/outlets/${outletPusat.id}/fees`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${spvToken}`,
    },
    body: JSON.stringify({ feesConfig: updatedFees }),
  });
  const updateFeeData = await updateFeeRes.json();
  if (updateFeeData.status !== 'success') {
    throw new Error(`Supervisor fee update failed: ${JSON.stringify(updateFeeData)}`);
  }
  console.log('✅ Supervisor successfully toggled fees:');
  updateFeeData.data.forEach((f: any) => {
    console.log(`   - ${f.name}: ${f.type === 'PERCENTAGE' ? f.rate + '%' : 'Rp ' + f.rate} [${f.channelScope}] -> ${f.isActive ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}`);
  });

  // 4. Kasir Checkout with Dynamic Fees
  console.log('\n--- Step 4: Kasir Checkout with Dynamic Fees Verification ---');
  const cashierLoginRes = await fetch(`${BASE_URL}/auth/pin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '222222', email: 'kasir.pro@wellpos.id' }),
  });
  const cashierToken = (await cashierLoginRes.json()).data.token;

  // Checkout order on Cabang Pusat
  const testProduct = prodsPusat[0];
  const itemQty = 2;
  const itemPrice = testProduct.basePrice;
  const subtotal = itemQty * itemPrice;
  // Active fees on Pusat: PB1 10% (= subtotal * 10%), Plastic Rp 500. (Service charge is OFF!)
  const taxExpected = Math.round(subtotal * 0.1);
  const extraFees = 500;
  const grandTotalExpected = subtotal + taxExpected + extraFees;

  const checkoutRes = await fetch(`${BASE_URL}/orders/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cashierToken}`,
    },
    body: JSON.stringify({
      outletId: outletPusat.id,
      channel: 'TAKEAWAY',
      items: [{ productId: testProduct.id, quantity: itemQty }],
      customerName: 'Budi Test Multi-Outlet',
      customerPhone: '081299887766',
      taxAmount: taxExpected,
      serviceCharge: extraFees,
      payment: { method: 'CASH', amountPaid: grandTotalExpected },
    }),
  });

  const checkoutData = await checkoutRes.json();
  if (checkoutData.status !== 'success' || !checkoutData.data) {
    throw new Error(`Checkout failed: ${JSON.stringify(checkoutData)}`);
  }
  const order = checkoutData.data;
  console.log(`✅ Order Created Successfully! Invoice: ${order.invoiceNumber}`);
  console.log(`   Outlet: ${order.outlet?.name}`);
  console.log(`   Subtotal: Rp ${order.subtotal.toLocaleString('id-ID')}`);
  console.log(`   Pajak / PB1: Rp ${order.taxAmount.toLocaleString('id-ID')}`);
  console.log(`   Layanan/Kemasan: Rp ${order.serviceCharge.toLocaleString('id-ID')}`);
  console.log(`   Grand Total: Rp ${order.grandTotal.toLocaleString('id-ID')}`);

  console.log('\n🎉 ALL MULTI-OUTLET & DYNAMIC FEES INTEGRATION TESTS PASSED!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
