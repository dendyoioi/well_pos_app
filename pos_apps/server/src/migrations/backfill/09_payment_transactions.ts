import { PrismaClient } from '@prisma/client';
import { BackfillContext, BackfillResult } from './types';
import { generateDeterministicUuid } from '../helpers/deterministic_uuid';
import { executeWriteRaw } from '../helpers/sql_safety';

/**
 * Worker 09: Payment to PaymentTransaction Transformation
 * Migrates legacy payments into multi-tender PaymentTransaction records.
 * Uses parameterized raw SQL (no target Prisma delegates).
 */
export async function runPaymentTransactionsBackfill(
  prisma: any,
  context: BackfillContext
): Promise<BackfillResult> {
  const result: BackfillResult = {
    workerName: '09_payment_transactions',
    processedCount: 0,
    createdCount: 0,
    skippedCount: 0,
    errorCount: 0,
    exceptions: [],
    plannedIds: [],
  };

  context.logger.info(`Starting Worker: ${result.workerName} (DryRun: ${context.isDryRun})`);

  if (context.failureInjectionWorker === result.workerName) {
    throw new Error(`FAILURE_INJECTION_TRIGGERED: Injected fatal mutation error in worker ${result.workerName}`);
  }

  // Query legacy payments joined with orders to obtain tenant_id
  const query = context.tenantId
    ? `SELECT p.id, p.order_id, p.method as payment_method, p.amount_paid, p.change_given, p.qris_reference, p.created_at, o.tenant_id 
       FROM "payments" p 
       JOIN "orders" o ON o.id = p.order_id 
       WHERE o.tenant_id = $1;`
    : `SELECT p.id, p.order_id, p.method as payment_method, p.amount_paid, p.change_given, p.qris_reference, p.created_at, o.tenant_id 
       FROM "payments" p 
       JOIN "orders" o ON o.id = p.order_id;`;

  const payments: any[] = context.tenantId
    ? await prisma.$queryRawUnsafe(query, context.tenantId)
    : await prisma.$queryRawUnsafe(query);

  result.processedCount = payments.length;

  for (const payment of payments) {
    try {
      const txId = generateDeterministicUuid(`${payment.id}:tx`);

      const existing: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM "payment_transactions" WHERE id = $1 LIMIT 1;`,
        txId
      );

      if (existing.length > 0) {
        result.skippedCount++;
        continue;
      }

      // Net amount paid (excluding change given)
      const amountPaid = Number(payment.amount_paid || 0);
      const changeGiven = Number(payment.change_given || 0);
      const netAmount = Math.max(0, amountPaid - changeGiven);

      const paymentMethod = payment.payment_method || 'CASH';

      if (!context.isDryRun) {
        await executeWriteRaw(
          prisma,
          context,
          `INSERT INTO "payment_transactions" (
            "id", "tenant_id", "order_id", "payment_method", "amount",
            "reference_number", "gateway_provider", "status", "metadata", "paid_at", "created_at"
          ) VALUES (
            $1, $2, $3, $4::"PaymentMethod", $5,
            $6, $7, $8::"PaymentTxStatus", $9, $10, $11
          )
          ON CONFLICT ("id") DO NOTHING;`,
          txId,
          payment.tenant_id,
          payment.order_id,
          paymentMethod,
          netAmount,
          `LEGACY-PAY-${payment.id.substring(0, 8)}`,
          paymentMethod === 'QRIS' ? 'STATIC_QRIS' : null,
          'CAPTURED',
          null,
          payment.created_at || new Date(),
          payment.created_at || new Date()
        );
      }

      result.plannedIds!.push(txId);
      result.createdCount++;
    } catch (err: any) {
      context.logger.error(`Error transforming payment ${payment.id}`, err);
      result.errorCount++;
      result.exceptions.push({
        recordId: payment.id,
        reason: err.message,
      });
      if (!context.isDryRun) {
        throw err;
      }
    }
  }

  context.logger.info(
    `Finished ${result.workerName}: Created=${result.createdCount}, Skipped=${result.skippedCount}`
  );
  return result;
}
