import { PrismaClient } from '@prisma/client';
import { BackfillContext, BackfillResult } from './types';
import { generateDeterministicUuid } from '../helpers/deterministic_uuid';
import { executeWriteRaw } from '../helpers/sql_safety';

/**
 * Worker 02: Default StorageLocation Provisioning
 * Ensures every Outlet has exactly 1 default StorageLocation with deterministic UUID.
 * Uses parameterized raw SQL (no target Prisma delegates).
 */
export async function runStorageLocationProvisioning(
  prisma: any,
  context: BackfillContext
): Promise<BackfillResult> {
  const result: BackfillResult = {
    workerName: '02_storage_locations',
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

  const query = context.tenantId
    ? `SELECT id, tenant_id, name FROM "outlets" WHERE tenant_id = $1;`
    : `SELECT id, tenant_id, name FROM "outlets";`;

  const outlets: any[] = context.tenantId
    ? await prisma.$queryRawUnsafe(query, context.tenantId)
    : await prisma.$queryRawUnsafe(query);

  result.processedCount = outlets.length;

  for (const outlet of outlets) {
    try {
      const deterministicId = generateDeterministicUuid(`${outlet.id}:default_location`);

      // Check if location already exists via parameterized raw SQL
      const existing: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM "storage_locations" WHERE id = $1 LIMIT 1;`,
        deterministicId
      );

      if (existing.length > 0) {
        result.skippedCount++;
        continue;
      }

      // Legacy outlets are storefront retail operations
      const locationName = `Storefront - ${outlet.name}`;
      const locationType = 'STOREFRONT';

      if (!context.isDryRun) {
        await executeWriteRaw(
          prisma,
          context,
          `INSERT INTO "storage_locations" (
            "id", "tenant_id", "outlet_id", "name", "type", "is_default", "allow_negative_stock", "is_active", "created_at", "updated_at"
          ) VALUES ($1, $2, $3, $4, $5::"StorageLocationType", $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT ("id") DO NOTHING;`,
          deterministicId,
          outlet.tenant_id,
          outlet.id,
          locationName,
          locationType,
          true,
          null, // allow_negative_stock: null (inherits tenant policy per ADR-002)
          true
        );
      }

      result.plannedIds!.push(deterministicId);
      result.createdCount++;
    } catch (err: any) {
      context.logger.error(`Error provisioning StorageLocation for outlet ${outlet.id}`, err);
      result.errorCount++;
      result.exceptions.push({
        recordId: outlet.id,
        reason: err.message,
      });
      if (!context.isDryRun) {
        throw err;
      }
    }
  }

  context.logger.info(
    `Finished ${result.workerName}: Created=${result.createdCount}, Skipped=${result.skippedCount}, Errors=${result.errorCount}`
  );
  return result;
}
