/**
 * INTEGRATION TEST SUITE: EPIC-30 CUP LABEL PRINTER & TSPL GENERATOR
 * Validates:
 * 1. Beverage filter & Cup Items unrolling (Quantity N -> N individual stickers [1/N], [2/N], [3/N])
 * 2. TSPL binary command generation (SIZE, GAP, DIRECTION, CLS, TEXT, PRINT)
 * 3. ESC/POS label fallback binary generation
 * 4. Test cup label sticker generator
 * 5. Formatting with custom headers, modifiers, and customer names
 */

async function runEpic30CupLabelTests() {
  console.log('===================================================================');
  console.log('🏷️  WELL POS — EPIC-30 CUP LABEL PRINTER & TSPL GENERATOR TESTS');
  console.log('===================================================================\n');

  // Dynamic import of client ESM module
  const {
    getCupItemsFromOrder,
    buildCupLabelsTspl,
    buildCupLabelsEscPos,
    buildTestCupLabelTspl,
  } = await import('../../../../client/src/utils/cupLabel.js' as any).catch(async () => {
    return await import('../../../../client/src/utils/cupLabel' as any);
  });

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${testName}${detail ? ` -> ${detail}` : ''}`);
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      process.exitCode = 1;
    }
  }

  // Sample Mixed Order (Beverages + Food)
  const mockOrder = {
    id: 'ord-cup-999',
    invoiceNumber: 'INV/20261108/CUP01',
    tableNumber: '04',
    orderChannel: 'DINE_IN',
    queueNumber: 7,
    customerName: 'Dimas Aditya',
    createdAt: new Date().toISOString(),
    outlet: {
      name: 'Well POS Cafe & Roastery',
    },
    orderItems: [
      {
        productName: 'Kopi Susu Gula Aren',
        quantity: 2,
        variantName: 'Large',
        product: { category: { name: 'Kopi & Espresso' } },
        modifiers: [
          { name: 'Less Sugar 50%', priceAdjustment: 0 },
          { name: 'Oatmilk Base', priceAdjustment: 5000 },
        ],
        notes: 'Less ice please',
      },
      {
        productName: 'Matcha Latte Ice',
        quantity: 1,
        variantName: 'Regular',
        product: { category: { name: 'Non-Coffee' } },
        modifiers: ['Ekstra Espresso Shot (+Rp 5.000)'],
        notes: 'Gelas kertas',
      },
      {
        productName: 'Nasi Goreng Spesial',
        quantity: 2,
        variantName: 'Pedas Sedang',
        product: { category: { name: 'Makanan Berat' } },
        modifiers: [],
        notes: 'Tanpa acar',
      },
    ],
  };

  // TEST 1: Beverage Filtering & Quantity Expansion (Unrolling)
  console.log('▶️ TEST 1: Beverage Filtering & Quantity Expansion (Unrolling)');
  const beverageCups = getCupItemsFromOrder(mockOrder, true);

  assert(
    beverageCups.length === 3,
    '1.1 Saring kategori minuman mengecualikan makanan berat',
    `2 Kopi + 1 Matcha = 3 Stiker (Nasi Goreng dikeluarkan)`
  );

  assert(
    beverageCups[0].cupNumber === 1 && beverageCups[0].totalCupsInOrder === 3,
    '1.2 Penanda indeks stiker pertama: Cup [1/3]'
  );
  assert(
    beverageCups[1].cupNumber === 2 && beverageCups[1].totalCupsInOrder === 3,
    '1.3 Penanda indeks stiker kedua: Cup [2/3]'
  );
  assert(
    beverageCups[2].cupNumber === 3 && beverageCups[2].totalCupsInOrder === 3,
    '1.4 Penanda indeks stiker ketiga: Cup [3/3]'
  );

  assert(
    beverageCups[0].productName === 'Kopi Susu Gula Aren' && beverageCups[0].variantName === 'Large',
    '1.5 Metadata nama produk & varian tercatat di stiker cup'
  );

  assert(
    beverageCups[0].modifiers.length === 2 && beverageCups[0].modifiers[1].includes('Oatmilk Base'),
    '1.6 Modifiers racikan (Less Sugar, Oatmilk) tercatat di stiker cup'
  );

  assert(
    beverageCups[0].customerName === 'Dimas Aditya' && beverageCups[0].tableNumber === '04',
    '1.7 Nama pelanggan dan nomor meja tercatat di stiker cup'
  );

  // TEST 2: All Items Unrolling (without beverage filter)
  console.log('\n▶️ TEST 2: All Items Unrolling (onlyBeverages = false)');
  const allCups = getCupItemsFromOrder(mockOrder, false);
  assert(
    allCups.length === 5,
    '2.1 Jika filter minuman dimatikan, seluruh item (2 Kopi + 1 Matcha + 2 Nasi Goreng = 5) dicetak',
    `Total: ${allCups.length}`
  );
  assert(
    allCups[4].productName === 'Nasi Goreng Spesial' && allCups[4].cupNumber === 5,
    '2.2 Item makanan tercatat pada stiker nomor 5'
  );

  // TEST 3: TSPL Binary Generation (Standard 40x30mm)
  console.log('\n▶️ TEST 3: TSPL Binary Generator Formatting');
  const tsplBytes = buildCupLabelsTspl(beverageCups, { paperSize: '40x30mm' });
  const tsplString = new TextDecoder().decode(tsplBytes);

  assert(tsplBytes.length > 0, '3.1 TSPL generator menghasilkan byte array tidak kosong');
  assert(tsplString.includes('SIZE 40 mm, 30 mm'), '3.2 Perintah SIZE 40 mm, 30 mm terpasang di TSPL');
  assert(tsplString.includes('GAP 2 mm, 0'), '3.3 Perintah GAP 2 mm, 0 sensor label terpasang di TSPL');
  assert(tsplString.includes('DIRECTION 1'), '3.4 Perintah DIRECTION 1 terpasang');
  assert(tsplString.includes('CLS'), '3.5 Perintah CLS pembersih buffer terpasang');
  assert(tsplString.includes('KOPI SUSU GULA AREN'), '3.6 Nama produk KOPI SUSU GULA AREN tercetak kapital');
  assert(tsplString.includes('PRINT 1,1'), '3.7 Perintah PRINT 1,1 per stiker terpasang');

  const printCommandCount = (tsplString.match(/PRINT 1,1/g) || []).length;
  assert(
    printCommandCount === 3,
    '3.8 Jumlah perintah cetak fisik (PRINT 1,1) tepat 3 kali untuk 3 stiker',
    `Total print: ${printCommandCount}`
  );

  // TEST 4: TSPL 50x30mm Sizing
  console.log('\n▶️ TEST 4: TSPL 50x30mm Sizing');
  const tsplBytes50 = buildCupLabelsTspl(beverageCups.slice(0, 1), { paperSize: '50x30mm' });
  const tsplString50 = new TextDecoder().decode(tsplBytes50);
  assert(tsplString50.includes('SIZE 50 mm, 30 mm'), '4.1 Ukuran kertas 50x30mm menghasilkan SIZE 50 mm, 30 mm');

  // TEST 5: ESC/POS Label Fallback Generation
  console.log('\n▶️ TEST 5: ESC/POS Label Fallback');
  const escposBytes = buildCupLabelsEscPos(beverageCups.slice(0, 1), { paperSize: '40x30mm' });
  assert(escposBytes.length > 0, '5.1 ESC/POS label generator menghasilkan byte array tidak kosong');
  assert(escposBytes[0] === 0x1b && escposBytes[1] === 0x40, '5.2 Inisialisasi ESC @ (0x1B 0x40)');

  // TEST 6: Barista Test Cup Sticker
  console.log('\n▶️ TEST 6: Barista Test Cup Sticker');
  const testCupBytes = buildTestCupLabelTspl('40x30mm');
  const testCupString = new TextDecoder().decode(testCupBytes);
  assert(testCupString.includes('KOPI SUSU AREN (TEST)'), '6.1 Stiker uji coba memuat teks KOPI SUSU AREN (TEST)');
  assert(testCupString.includes('Barista Test'), '6.2 Stiker uji coba memuat nama pelanggan Barista Test');

  console.log('\n===================================================================');
  console.log(`📊 RINGKASAN: ${passed} DARI ${total} PENGUJIAN LABEL CUP BERHASIL!`);
  console.log('===================================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runEpic30CupLabelTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
