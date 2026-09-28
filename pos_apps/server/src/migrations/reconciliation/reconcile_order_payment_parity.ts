import { PrismaClient } from '@prisma/client';
import { ParityCheckResult } from './reconcile_tenant_integrity';

/**
 * Reconciles Order Items and Payment Transactions Parity
 * Fully parameterized SQL: zero string interpolation.
 */
export async function reconcileOrderPaymentParity(
  prisma: PrismaClient,
  tenantId?: string
): Promise<ParityCheckResult[]> {
  const results: ParityCheckResult[] = [];

  // Check 1: Order items without product_variant_id
  const unmappedQuery = tenantId
    ? `SELECT count(*)::int as count 
       FROM "order_items" oi 
       JOIN "orders" o ON o.id = oi.order_id 
       WHERE oi.product_variant_id IS NULL AND o.tenant_id = $1;`
    : `SELECT count(*)::int as count 
       FROM "order_items" oi 
       JOIN "orders" o ON o.id = oi.order_id 
       WHERE oi.product_variant_id IS NULL;`;

  const unmappedItems: any[] = tenantId
    ? await prisma.$queryRawUnsafe(unmappedQuery, tenantId)
    : await prisma.$queryRawUnsafe(unmappedQuery);

  const unmappedCount = unmappedItems[0]?.count || 0;

  results.push({
    suiteName: 'Sales: OrderItem -> ProductVariant Coverage',
    passed: unmappedCount === 0,
    discrepancyCount: unmappedCount,
    details: unmappedCount === 0
      ? '100% of order items resolved to valid ProductVariant.'
      : `${unmappedCount} order items lack product_variant_id!`,
  });

  // Check 2: Paid orders vs captured payment transactions equality
  const paymentDriftsQuery = tenantId
    ? `SELECT 
          o.tenant_id,
          o.id AS order_id,
          o.invoice_number,
          o.grand_total AS total_amount,
          COALESCE(SUM(pt.amount), 0) AS total_captured,
          (o.grand_total - COALESCE(SUM(pt.amount), 0)) AS payment_drift
       FROM "orders" o
       LEFT JOIN "payment_transactions" pt 
          ON pt.order_id = o.id 
          AND pt.tenant_id = o.tenant_id 
          AND pt.status = 'CAPTURED'
       WHERE o.payment_status = 'PAID' AND o.tenant_id = $1
       GROUP BY o.tenant_id, o.id, o.invoice_number, o.grand_total
       HAVING o.grand_total != COALESCE(SUM(pt.amount), 0);`
    : `SELECT 
          o.tenant_id,
          o.id AS order_id,
          o.invoice_number,
          o.grand_total AS total_amount,
          COALESCE(SUM(pt.amount), 0) AS total_captured,
          (o.grand_total - COALESCE(SUM(pt.amount), 0)) AS payment_drift
       FROM "orders" o
       LEFT JOIN "payment_transactions" pt 
          ON pt.order_id = o.id 
          AND pt.tenant_id = o.tenant_id 
          AND pt.status = 'CAPTURED'
       WHERE o.payment_status = 'PAID'
       GROUP BY o.tenant_id, o.id, o.invoice_number, o.grand_total
       HAVING o.grand_total != COALESCE(SUM(pt.amount), 0);`;

  const paymentDrifts: any[] = tenantId
    ? await prisma.$queryRawUnsafe(paymentDriftsQuery, tenantId)
    : await prisma.$queryRawUnsafe(paymentDriftsQuery);

  results.push({
    suiteName: 'Financial: Paid Order Total vs Captured Transactions Parity',
    passed: paymentDrifts.length === 0,
    discrepancyCount: paymentDrifts.length,
    details: paymentDrifts.length === 0
      ? '100% payment parity: all paid orders match captured payment sums.'
      : `${paymentDrifts.length} orders show drift against captured payments!`,
  });

  // Check 3: OrderStatus and PaymentStatus Decoupling Parity (Correction B)
  const statusInconsistenciesQuery = tenantId
    ? `SELECT count(*)::int as count
       FROM "orders"
       WHERE ((payment_status = 'PAID' AND order_status NOT IN ('COMPLETED', 'IN_PROGRESS', 'CONFIRMED'))
          OR (order_status = 'CANCELLED' AND payment_status = 'PAID'))
         AND tenant_id = $1;`
    : `SELECT count(*)::int as count
       FROM "orders"
       WHERE ((payment_status = 'PAID' AND order_status NOT IN ('COMPLETED', 'IN_PROGRESS', 'CONFIRMED'))
          OR (order_status = 'CANCELLED' AND payment_status = 'PAID'));`;

  const statusInconsistencies: any[] = tenantId
    ? await prisma.$queryRawUnsafe(statusInconsistenciesQuery, tenantId)
    : await prisma.$queryRawUnsafe(statusInconsistenciesQuery);

  const statusMismatchCount = statusInconsistencies[0]?.count || 0;

  results.push({
    suiteName: 'Sales: OrderStatus & PaymentStatus Decoupling Parity',
    passed: statusMismatchCount === 0,
    discrepancyCount: statusMismatchCount,
    details: statusMismatchCount === 0
      ? '100% order/payment status decoupled parity.'
      : `${statusMismatchCount} orders show invalid order_status / payment_status combination!`,
  });

  return results;
}
