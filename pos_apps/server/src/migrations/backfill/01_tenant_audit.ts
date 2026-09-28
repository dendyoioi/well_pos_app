import { PrismaClient } from '@prisma/client';
import { BackfillContext, BackfillResult } from './types';

/**
 * Worker 01: Tenant Normalization Audit
 * Scans legacy operational tables for NULL tenant_id and attempts deterministic resolution.
 */
export async function runTenantAudit(
  prisma: any,
  context: BackfillContext
): Promise<BackfillResult> {
  const result: BackfillResult = {
    workerName: '01_tenant_audit',
    processedCount: 0,
    createdCount: 0,
    skippedCount: 0,
    errorCount: 0,
    exceptions: [],
    plannedIds: [],
  };

  context.logger.info(`Starting Worker: ${result.workerName} (DryRun: ${context.isDryRun})`);

  if (context.failureInjectionWorker === result.workerName) {
    throw new Error(`FAILURE_INJECTION_TRIGGERED: Injected fatal error in worker ${result.workerName}`);
  }

  const tablesToAudit = [
    'outlets',
    'users',
    'categories',
    'products',
    'orders',
    'shifts',
    'customers',
  ];

  for (const table of tablesToAudit) {
    try {
      // Raw query to check null tenant_id count on table
      const countResult: any[] = await prisma.$queryRawUnsafe(
        `SELECT count(*)::int as count FROM "${table}" WHERE tenant_id IS NULL;`
      );
      const nullCount = countResult[0]?.count || 0;
      result.processedCount += nullCount;

      if (nullCount > 0) {
        context.logger.warn(`Found ${nullCount} records in "${table}" with NULL tenant_id`);
        result.exceptions.push({
          recordId: table,
          reason: `${nullCount} rows with NULL tenant_id require resolution`,
        });
      } else {
        context.logger.info(`Table "${table}": 0 NULL tenant_id records (Clean)`);
        result.skippedCount++;
      }
    } catch (err: any) {
      context.logger.error(`Failed auditing table "${table}"`, err);
      result.errorCount++;
      if (!context.isDryRun) {
        throw err;
      }
    }
  }

  return result;
}
