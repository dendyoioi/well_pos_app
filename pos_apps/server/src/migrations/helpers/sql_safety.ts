import { PrismaClient } from '@prisma/client';
import { BackfillContext } from '../backfill/types';

/**
 * Executes a mutating raw SQL query with strict dry-run fail-closed protection.
 * If called during dry-run, immediately throws a fatal invariant violation error.
 */
export async function executeWriteRaw(
  prisma: any,
  context: BackfillContext,
  sql: string,
  ...params: any[]
): Promise<number> {
  if (context.isDryRun) {
    throw new Error(
      `CRITICAL DRY-RUN INVARIANT VIOLATION: Accidental write detected during dry-run execution! Statement: ${sql.trim().substring(0, 80)}`
    );
  }
  return await prisma.$executeRawUnsafe(sql, ...params);
}
