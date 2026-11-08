/**
 * INTEGRATION TEST SUITE: EPIC-30 DIRECT THERMAL PRINTER ESC/POS & HARDWARE HUB
 * Validates ESC/POS binary command generator, combo slot snapshot printing,
 * auto paper cutting, cash drawer 24V pulse, and Rule 13 pure X/Z-Report compliance.
 */

import {
  EscPosBuilder,
  buildReceiptEscPos,
  buildTestPrintEscPos,
  buildXZReportEscPos,
} from '../../../../client/src/utils/escpos';

async function runEpic30ThermalPrinterTests() {
  console.log('===================================================================');
  console.log('🖨️  WELL POS — EPIC-30 THERMAL PRINTER & HARDWARE HUB TEST SUITE');
  console.log('===================================================================\n');

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

  // 1. EscPosBuilder Core Commands
  console.log('▶️ TEST 1: Binary ESC/POS Builder Fundamental Commands');
  const builder58 = new EscPosBuilder('58mm');
  builder58.init().align('center').bold(true).line('TEST SHOP').kickDrawer().cut();
  const rawBytes58 = builder58.toUint8Array();

  // Check ESC @ (0x1B, 0x40)
  assert(rawBytes58[0] === 0x1b && rawBytes58[1] === 0x40, '1.1 Inisialisasi Printer ESC @ (0x1B 0x40)');
  // Check Drawer Kick ESC p 0 25 250 (0x1B 0x70 0x00 0x19 0xFA)
  const drawerSubseq = [0x1b, 0x70, 0x00, 0x19, 0xfa];
  const hasDrawer = drawerSubseq.every((b, idx) => rawBytes58.includes(b));
  assert(hasDrawer, '1.2 Cash Drawer Kick Pulse 24V RJ11 (ESC p 0 25 250)');
  // Check Cut Paper GS V 65 3 (0x1D 0x56 0x41 0x03)
  const cutSubseq = [0x1d, 0x56, 0x41, 0x03];
  const hasCut = cutSubseq.every((b) => rawBytes58.includes(b));
  assert(hasCut, '1.3 Auto Paper Cut Command GS V (0x1D 0x56 0x41 0x03)');

  // 2. Receipt ESC/POS with Combo Slots Snapshot
  console.log('\n▶️ TEST 2: Struk Belanja dengan Snapshot Dynamic Combo Slots');
  const mockOrder = {
    invoiceNumber: 'INV/20261108/TST/0001',
    createdAt: new Date().toISOString(),
    cashierName: 'Budi Kasir',
    customerName: 'Pelanggan VIP',
    queueNumber: 7,
    outlet: {
      name: 'Smoke Roastery Flagship',
      address: 'Jl. Senopati No. 88, Jakarta Selatan',
      phone: '081234567890',
    },
    orderItems: [
      {
        productName: 'Paket Bento Kombo',
        quantity: 2,
        unitPrice: 38000,
        subtotal: 76000,
        modifiersSnapshot: [
          { group_name: 'Lauk Pilihan', name: 'Beef Yakiniku (+Rp 5.000)', price_adjustment: 5000 },
          { group_name: 'Minuman Segar', name: 'Lemon Tea Dingin (+Rp 3.000)', price_adjustment: 3000 },
        ],
      },
    ],
    subtotal: 76000,
    grandTotal: 76000,
    payments: [
      { method: 'CASH', amountPaid: 100000, changeGiven: 24000 },
    ],
  };

  const receiptBytes58 = buildReceiptEscPos(mockOrder, { paperSize: '58mm', showQueueNumber: true });
  const receiptStr = new TextDecoder('utf-8').decode(receiptBytes58);

  assert(receiptBytes58.length > 100, '2.1 Binary Receipt ESC/POS Terkompilasi (58mm)', `${receiptBytes58.length} bytes`);
  assert(receiptStr.includes('Smoke Roastery Flagship'), '2.2 Kop Outlet Toko Tersemat');
  assert(receiptStr.includes('NO. ANTREAN: #07'), '2.3 Nomor Antrean Kasir Tersemat');
  assert(receiptStr.includes('Paket Bento Kombo'), '2.4 Nama Produk Komposit Muncul');
  assert(receiptStr.includes('[Lauk Pilihan]'), '2.5 Group Label Slot Kombo 1 Tersemat');
  assert(receiptStr.includes('[Minuman Segar]'), '2.6 Group Label Slot Kombo 2 Tersemat');
  assert(receiptStr.includes('Beef Yakiniku'), '2.7 Opsi Slot Kombo Pilihan Kasir Muncul');
  assert(receiptStr.includes('Bayar (CASH):'), '2.8 Metode Pembayaran Tunai Tertera');
  assert(receiptStr.includes('Kembalian:'), '2.9 Kembalian Tunai Terhitung');

  // 3. Test Print Brief Receipt
  console.log('\n▶️ TEST 3: Struk Uji Coba Kertas Thermal (Test Print)');
  const testPrintBytes = buildTestPrintEscPos('58mm', 'Bluetooth (MPT-II)');
  const testPrintStr = new TextDecoder('utf-8').decode(testPrintBytes);
  assert(testPrintStr.includes('TEST PRINT THERMAL OK!'), '3.1 Struk Test Print Berhasil Dibuat');
  assert(testPrintStr.includes('Bluetooth (MPT-II)'), '3.2 Label Perangkat Tertera');

  // 4. Pure Summary X-Report (Rule 13 Conformance)
  console.log('\n▶️ TEST 4: Slip Murni X-Report (Kebijakan Rule 13 - Pure Financial Summary)');
  const mockXReport = {
    reportType: 'X-REPORT',
    shiftId: 'shf-88991122',
    cashier: 'Budi Kasir',
    startTime: new Date().toISOString(),
    generatedAt: new Date().toISOString(),
    outlet: {
      name: 'Smoke Roastery Flagship',
      address: 'Jl. Senopati No. 88',
    },
    cashDrawer: {
      startingCash: 200000,
      cashSales: 350000,
      totalCashIn: 50000,
      totalCashOut: 20000,
      expectedCashInDrawer: 580000,
    },
    paymentSummary: {
      cashSales: 350000,
      qrisSales: 150000,
      netRevenue: 500000,
    },
    transactionSummary: {
      totalOrders: 15,
      totalGrossSales: 500000,
      totalDiscounts: 0,
      totalTax: 0,
      totalService: 0,
    },
    recentOrders: [
      { invoiceNumber: 'INV/SHOULD_NOT_APPEAR/01', grandTotal: 25000, paymentMethod: 'CASH', createdAt: new Date().toISOString() },
    ],
  };

  const xReportBytes = buildXZReportEscPos(mockXReport, 'X', { paperSize: '58mm' });
  const xReportStr = new TextDecoder('utf-8').decode(xReportBytes);

  assert(xReportStr.includes('LAPORAN BERJALAN (X-REPORT)'), '4.1 Judul Resmi X-Report Muncul');
  assert(xReportStr.includes('Modal Awal (Cash):'), '4.2 Posisi Modal Awal Kasir Tertera');
  assert(xReportStr.includes('Total Kas Sistem:'), '4.3 Rekonsiliasi Kas Diharapkan Terhitung');
  assert(xReportStr.includes('TOTAL OMSET (NET):'), '4.4 Total Omset Bersih Terakumulasi');
  assert(xReportStr.includes('LEMBAR PENGESAHAN:'), '4.5 Kolom Tanda Tangan Kasir & Supervisor Siap');
  assert(!xReportStr.includes('INV/SHOULD_NOT_APPEAR'), '4.6 Rule 13 Conformance: Nol Rincian Nota Invoice pada Slip X-Report');

  // 5. Pure Summary Z-Report (Rule 13 Conformance)
  console.log('\n▶️ TEST 5: Slip Murni Z-Report Tutup Shift (Kebijakan Rule 13 - Rekonsiliasi Kas)');
  const mockZReport = {
    reportType: 'Z-REPORT',
    shiftId: 'shf-88991122',
    cashier: 'Budi Kasir',
    startTime: new Date(Date.now() - 28800000).toISOString(),
    endTime: new Date().toISOString(),
    outlet: 'Smoke Roastery Flagship',
    cashDrawer: {
      startingCash: 200000,
      totalCashSales: 500000,
      totalCashIn: 0,
      totalCashOut: 50000,
      expectedCash: 650000,
      actualCash: 650000,
      difference: 0,
      differenceLabel: 'SEIMBANG',
    },
    nonCashSummary: {
      totalQrisSales: 300000,
      totalRevenue: 800000,
    },
    totalTransactions: 28,
    orders: [
      { invoiceNumber: 'INV/Z_SHOULD_NOT_APPEAR/01', grandTotal: 50000 },
    ],
  };

  const zReportBytes = buildXZReportEscPos(mockZReport, 'Z', { paperSize: '80mm' });
  const zReportStr = new TextDecoder('utf-8').decode(zReportBytes);

  assert(zReportStr.includes('LAPORAN TUTUP SHIFT (Z-REPORT)'), '5.1 Judul Resmi Z-Report Muncul');
  assert(zReportStr.includes('Kas Fisik Aktual:'), '5.2 Uang Fisik Aktual di Laci Tertera');
  assert(zReportStr.includes('Status Selisih:'), '5.3 Status Selisih Kas Seimbang Terverifikasi');
  assert(zReportStr.includes('Jumlah Transaksi:'), '5.4 Total Nota Terakumulasi (28 Nota)');
  assert(!zReportStr.includes('INV/Z_SHOULD_NOT_APPEAR'), '5.5 Rule 13 Conformance: Nol Rincian Nota Invoice pada Slip Z-Report');

  console.log('\n===================================================================');
  console.log(`🏁 HASIL AKHIR: ${passed}/${total} (${Math.round((passed / total) * 100)}%) LULUS`);
  console.log('===================================================================');

  if (passed === total) {
    console.log('🎉 INTEGRASI HARDWARE THERMAL PRINTER HUB ESC/POS & CASH DRAWER SEMPURNA!\n');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runEpic30ThermalPrinterTests().catch((e) => {
  console.error('Fatal Test Runner Error:', e);
  process.exit(1);
});

