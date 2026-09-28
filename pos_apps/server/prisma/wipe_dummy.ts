import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Membersihkan seluruh data dummy tenant...');

  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventoryLedger.deleteMany();
  await prisma.inventoryBalance.deleteMany();
  await prisma.inventoryBatch.deleteMany();
  await prisma.stockTransferItem.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.recipeItem.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.user.deleteMany();
  await prisma.storageLocation.deleteMany();
  await prisma.outlet.deleteMany();
  await prisma.saaSPayment.deleteMany();
  await prisma.saaSInvoice.deleteMany();
  await prisma.tenantSubscription.deleteMany();
  await prisma.tenant.deleteMany();

  const tenants = await prisma.tenant.count();
  const users = await prisma.user.count();
  const outlets = await prisma.outlet.count();
  const platformUsers = await prisma.platformUser.count();
  const plans = await prisma.subscriptionPlan.count();

  console.log('✅ Basis data bersih (0 dummy):', {
    tenants,
    users,
    outlets,
    platformUsers,
    subscriptionPlans: plans,
  });
}

main()
  .catch((err) => {
    console.error('❌ Gagal membersihkan data dummy:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
