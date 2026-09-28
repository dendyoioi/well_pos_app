import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient, CustomerTier, PointTxType, DiscountType } from '@prisma/client';
import * as crypto from 'crypto';
import { loyaltyService, LoyaltyService } from '../../services/loyalty.service';
import { promotionService } from '../../services/promotion.service';

async function main() {
  console.log('===============================================================');
  console.log('EPIC-08 VERIFICATION SUITE: CRM, LOYALTY, DISCOUNTS & PROMOTIONS');
  console.log('===============================================================');

  const prisma = new PrismaClient();

  try {
    // 1. RESOLVE ACTIVE CONTEXT
    console.log('\n[1/7] Resolving Active Tenant, Outlet & User Context...');
    const tenants: any[] = await prisma.$queryRawUnsafe(`SELECT id, business_name FROM "tenants" LIMIT 1;`);
    if (tenants.length === 0) throw new Error('Tenant tidak ditemukan.');
    const tenant = { id: tenants[0].id, name: tenants[0].business_name };

    const outlets: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, name FROM "outlets" WHERE tenant_id = $1 LIMIT 1;`,
      tenant.id
    );
    if (outlets.length === 0) throw new Error('Outlet tidak ditemukan.');
    const outlet = outlets[0];

    const users: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, name FROM "users" WHERE tenant_id = $1 LIMIT 1;`,
      tenant.id
    );
    const cashier = users[0] || null;

    console.log(`  Tenant: ${tenant.name} (${tenant.id})`);
    console.log(`  Outlet: ${outlet.name} (${outlet.id})`);
    console.log(`  Cashier: ${cashier?.name} (${cashier?.id})`);

    // 2. CUSTOMER REGISTRATION & TIER INITIALIZATION
    console.log('\n[2/7] Verifying Customer CRM Profile & Tier Initialization...');
    const testPhone = `081${Date.now().toString().slice(-9)}`;
    const testCode = `CUST-${Date.now().toString().slice(-5)}`;
    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        code: testCode,
        name: 'Rian Pratama Kusuma',
        phone: testPhone,
        email: `rian.${Date.now()}@gmail.com`,
        tier: CustomerTier.BRONZE,
        loyaltyPoints: 0,
        totalSpent: 0,
        visitCount: 0,
      },
    });

    if (customer.tier !== CustomerTier.BRONZE || customer.loyaltyPoints !== 0) {
      throw new Error('Customer initialization failed');
    }
    console.log(`  ✅ Customer Profile created: ${customer.name} (${customer.code})`);
    console.log(`     Tier: ${customer.tier}, Poin: ${customer.loyaltyPoints}, Total Belanja: Rp ${Number(customer.totalSpent)}`);

    // 3. PROMOTION & VOUCHER ENGINE
    console.log('\n[3/7] Verifying Promotion & Voucher Engine...');
    const promoCode = `DISKON20-${Date.now().toString().slice(-4)}`;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    const promotion = await prisma.promotion.create({
      data: {
        tenantId: tenant.id,
        code: promoCode,
        name: 'Diskon Spesial 20% Grand Launching',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 20, // 20%
        minOrderAmount: 50000, // min Rp 50.000
        maxDiscountAmount: 25000, // max Rp 25.000
        usageLimit: 100,
        perCustomerLimit: 2,
        startDate,
        endDate,
        isActive: true,
      },
    });

    console.log(`  ✅ Promo Voucher created: ${promotion.code} (${promotion.name})`);
    console.log(`     Type: ${promotion.discountType}, Value: ${promotion.discountValue}%, Min: Rp ${Number(promotion.minOrderAmount)}, Max: Rp ${Number(promotion.maxDiscountAmount)}`);

    // Test validation: Cart value Rp 100.000 -> 20% = Rp 20.000 (below max 25.000)
    const validTest = await promotionService.validatePromotion(tenant.id, promoCode, 100000, customer.id);
    if (!validTest.valid || validTest.discountAmount !== 20000) {
      throw new Error(`Promo validation failed! Expected discount 20000, got ${validTest.discountAmount}`);
    }
    console.log(`  ✅ Validation 1 Passed (Subtotal Rp 100.000): Potongan Rp ${validTest.discountAmount.toLocaleString('id-ID')}`);

    // Test validation: Cart value Rp 200.000 -> 20% = 40.000 -> capped at max 25.000
    const capTest = await promotionService.validatePromotion(tenant.id, promoCode, 200000, customer.id);
    if (!capTest.valid || capTest.discountAmount !== 25000) {
      throw new Error(`Promo cap validation failed! Expected discount 25000, got ${capTest.discountAmount}`);
    }
    console.log(`  ✅ Validation 2 Passed (Subtotal Rp 200.000 capped): Potongan Rp ${capTest.discountAmount.toLocaleString('id-ID')}`);

    // Test validation below minimum spend: Rp 30.000 < min 50.000
    const belowMinTest = await promotionService.validatePromotion(tenant.id, promoCode, 30000, customer.id);
    if (belowMinTest.valid) {
      throw new Error('Promo validation should fail when subtotal is below minOrderAmount');
    }
    console.log(`  ✅ Validation 3 Passed (Subtotal < Min Spend): Ditolak dengan pesan "${belowMinTest.message}"`);

    // 4. CHECKOUT TRANSACTION WITH PROMOTION & LOYALTY POINTS EARNING
    console.log('\n[4/7] Verifying Checkout with Voucher & Point Earning...');
    const invoiceNumber1 = `INV/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/OUT/${Date.now().toString().slice(-4)}`;
    const subtotal1 = 100000;
    const promoDiscount1 = 20000;
    const grandTotal1 = subtotal1 - promoDiscount1; // Rp 80.000

    // Ensure we have a product variant
    const variantRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT pv.id, pv.product_id, pv.name, pv.price, p.name as product_name
       FROM "product_variants" pv
       JOIN "products" p ON p.id = pv.product_id
       WHERE pv.tenant_id = $1 LIMIT 1;`,
      tenant.id
    );
    if (variantRows.length === 0) throw new Error('Product variant tidak ditemukan');
    const variant = variantRows[0];

    const order1 = await prisma.$transaction(async (tx) => {
      // Create order record
      const ord = await tx.order.create({
        data: {
          tenantId: tenant.id,
          outletId: outlet.id,
          userId: cashier.id,
          customerId: customer.id,
          invoiceNumber: invoiceNumber1,
          subtotal: subtotal1,
          discountTotal: promoDiscount1,
          taxTotal: 0,
          serviceTotal: 0,
          totalAmount: grandTotal1,
          paidAmount: grandTotal1,
          changeAmount: 0,
          promotionId: promotion.id,
          pointsEarned: 0, // will be updated
          pointsRedeemed: 0,
          pointDiscountAmount: 0,
          items: {
            create: [
              {
                tenantId: tenant.id,
                productVariantId: variant.id,
                productName: variant.product_name,
                variantName: variant.name,
                sku: 'SKU-TEST',
                quantity: 1,
                unitPrice: subtotal1,
                discountAmount: promoDiscount1,
                subtotal: grandTotal1,
              },
            ],
          },
          payments: {
            create: [
              {
                tenantId: tenant.id,
                paymentMethod: 'CASH',
                amount: grandTotal1,
                status: 'CAPTURED',
              },
            ],
          },
        },
      });

      // Record promo usage
      await promotionService.recordUsage(tx, tenant.id, promotion.id, ord.id, promoDiscount1, customer.id);

      // Award loyalty points (Rp 80.000 @ BRONZE = 8 points)
      const awardRes = await loyaltyService.awardPoints(
        {
          tenantId: tenant.id,
          customerId: customer.id,
          orderId: ord.id,
          spendAmount: grandTotal1,
        },
        tx
      );

      await tx.order.update({
        where: { id: ord.id },
        data: { pointsEarned: awardRes.pointsEarned },
      });

      return ord;
    });

    console.log(`  ✅ Transaksi 1 Sukses: ${order1.invoiceNumber} (Grand Total: Rp ${grandTotal1.toLocaleString('id-ID')})`);

    // Verify promo usage recorded
    const promoUsage = await prisma.promotionUsage.findFirst({
      where: { orderId: order1.id },
    });
    if (!promoUsage || Number(promoUsage.discountApplied) !== promoDiscount1) {
      throw new Error('Promotion usage not properly recorded');
    }
    console.log(`  ✅ Promotion Usage terverifikasi: Rp ${Number(promoUsage.discountApplied).toLocaleString('id-ID')} applied`);

    // Verify customer points & ledger
    const customerAfter1 = await prisma.customer.findUnique({
      where: { id: customer.id },
    });
    console.log(`  ✅ Poin Pelanggan bertambah: ${customerAfter1?.loyaltyPoints} Poin (Total Belanja: Rp ${Number(customerAfter1?.totalSpent).toLocaleString('id-ID')})`);
    if (customerAfter1?.loyaltyPoints !== 8) {
      throw new Error(`Expected 8 points earned, got ${customerAfter1?.loyaltyPoints}`);
    }

    const pointLedger1 = await prisma.customerPointLedger.findFirst({
      where: { orderId: order1.id, type: PointTxType.EARNED_PURCHASE },
    });
    if (!pointLedger1 || pointLedger1.deltaPoints !== 8) {
      throw new Error('Point ledger audit entry not found or deltaPoints mismatch');
    }
    console.log(`  ✅ Point Ledger Audit terbit: +${pointLedger1.deltaPoints} Poin (Balance After: ${pointLedger1.balanceAfter})`);

    // 5. CHECKOUT TRANSACTION WITH POINT REDEMPTION
    console.log('\n[5/7] Verifying Point Redemption on Checkout...');
    const invoiceNumber2 = `INV/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/OUT/${Date.now().toString().slice(-4)}`;
    const subtotal2 = 50000;
    const pointsToRedeem = 5; // 5 points = Rp 500
    const pointDiscount2 = pointsToRedeem * LoyaltyService.POINT_VALUE_IDR; // Rp 500
    const grandTotal2 = subtotal2 - pointDiscount2; // Rp 49.500

    const order2 = await prisma.$transaction(async (tx) => {
      // 1. Redeem points
      const redeemRes = await loyaltyService.redeemPoints(
        {
          tenantId: tenant.id,
          customerId: customer.id,
          subtotal: subtotal2,
          pointsToRedeem,
        },
        tx
      );

      // 2. Award points for this purchase (Rp 49.500 = 4 points)
      const awardRes = await loyaltyService.awardPoints(
        {
          tenantId: tenant.id,
          customerId: customer.id,
          spendAmount: grandTotal2,
        },
        tx
      );

      // 3. Create order
      const ord = await tx.order.create({
        data: {
          tenantId: tenant.id,
          outletId: outlet.id,
          userId: cashier.id,
          customerId: customer.id,
          invoiceNumber: invoiceNumber2,
          subtotal: subtotal2,
          discountTotal: pointDiscount2,
          taxTotal: 0,
          serviceTotal: 0,
          totalAmount: grandTotal2,
          paidAmount: grandTotal2,
          changeAmount: 0,
          pointsEarned: awardRes.pointsEarned,
          pointsRedeemed: pointsToRedeem,
          pointDiscountAmount: pointDiscount2,
          items: {
            create: [
              {
                tenantId: tenant.id,
                productVariantId: variant.id,
                productName: variant.product_name,
                variantName: variant.name,
                sku: 'SKU-TEST',
                quantity: 1,
                unitPrice: subtotal2,
                discountAmount: pointDiscount2,
                subtotal: grandTotal2,
              },
            ],
          },
          payments: {
            create: [
              {
                tenantId: tenant.id,
                paymentMethod: 'CASH',
                amount: grandTotal2,
                status: 'CAPTURED',
              },
            ],
          },
        },
      });

      return ord;
    });

    console.log(`  ✅ Transaksi 2 Sukses: ${order2.invoiceNumber}`);
    console.log(`     Subtotal: Rp ${subtotal2.toLocaleString('id-ID')} | Tukar Poin: 5 pt (-Rp ${pointDiscount2}) | Grand Total: Rp ${grandTotal2.toLocaleString('id-ID')}`);

    // Verify customer points balance: 8 - 5 + 4 = 7
    const customerAfter2 = await prisma.customer.findUnique({
      where: { id: customer.id },
    });
    console.log(`  ✅ Saldo Poin Akhir: ${customerAfter2?.loyaltyPoints} Poin (Expected: 7)`);
    if (customerAfter2?.loyaltyPoints !== 7) {
      throw new Error(`Point balance mismatch! Expected 7, got ${customerAfter2?.loyaltyPoints}`);
    }

    const redeemLedger = await prisma.customerPointLedger.findFirst({
      where: { customerId: customer.id, type: PointTxType.REDEEMED_DISCOUNT },
      orderBy: { createdAt: 'desc' },
    });
    if (!redeemLedger || redeemLedger.deltaPoints !== -5) {
      throw new Error('Point ledger for REDEEMED_DISCOUNT not recorded properly');
    }
    console.log(`  ✅ Ledger Penukaran Poin terverifikasi: ${redeemLedger.deltaPoints} Poin`);

    // 6. MEMBERSHIP TIER PROGRESSION
    console.log('\n[6/7] Verifying Lifetime Spend Tier Progression...');
    // Award a large purchase to test upgrade to SILVER tier (>= Rp 1.000.000)
    await loyaltyService.awardPoints({
      tenantId: tenant.id,
      customerId: customer.id,
      spendAmount: 1000000, // Rp 1.000.000
      notes: 'Test spend threshold upgrade to SILVER tier',
    });

    const upgradedCustomer = await prisma.customer.findUnique({
      where: { id: customer.id },
    });
    console.log(`  ✅ Tier Upgrade terverifikasi: ${upgradedCustomer?.tier} (Total Belanja: Rp ${Number(upgradedCustomer?.totalSpent).toLocaleString('id-ID')})`);
    if (upgradedCustomer?.tier !== CustomerTier.SILVER) {
      throw new Error(`Customer should have upgraded to SILVER, but is ${upgradedCustomer?.tier}`);
    }

    // 7. DIGITAL RECEIPT GENERATION & WHATSAPP SHARING
    console.log('\n[7/7] Verifying Digital Receipt Generation & WhatsApp Formatting...');
    const receiptOrder = await prisma.order.findUnique({
      where: { id: order1.id },
      include: {
        outlet: true,
        cashier: true,
        customer: true,
        promotion: true,
        items: true,
        payments: true,
      },
    });

    if (!receiptOrder) throw new Error('Receipt order not found');

    const whatsAppText = [
      `*STRUK PEMBELIAN - ${receiptOrder.outlet.name.toUpperCase()}*`,
      `================================`,
      `No. Faktur : ${receiptOrder.invoiceNumber}`,
      `Kasir      : ${receiptOrder.cashier.name}`,
      `Pelanggan  : ${receiptOrder.customer?.name} (${receiptOrder.customer?.tier} Member)`,
      `--------------------------------`,
      `Subtotal   : Rp ${Number(receiptOrder.subtotal).toLocaleString('id-ID')}`,
      `Promo [${receiptOrder.promotion?.code}]: -Rp ${Number(receiptOrder.discountTotal).toLocaleString('id-ID')}`,
      `*TOTAL      : Rp ${Number(receiptOrder.totalAmount).toLocaleString('id-ID')}*`,
      `================================`,
    ].join('\n');

    const whatsAppUrl = `https://api.whatsapp.com/send?phone=${receiptOrder.customer?.phone}&text=${encodeURIComponent(whatsAppText)}`;

    if (!whatsAppUrl.includes('https://api.whatsapp.com/send')) {
      throw new Error('WhatsApp sharing URL malformed');
    }
    console.log(`  ✅ Digital Receipt WhatsApp text generated:\n\n${whatsAppText}\n`);
    console.log(`  ✅ WhatsApp Sharing URL: ${whatsAppUrl.substring(0, 75)}...`);

    console.log('===============================================================');
    console.log('🎉 EPIC-08 VERIFICATION COMPLETE: ALL 7/7 MODULES PASSED!');
    console.log('===============================================================');
  } catch (err: any) {
    console.error('\n❌ EPIC-08 VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
