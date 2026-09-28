import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { BackfillContext, BackfillResult } from './types';
import { executeWriteRaw } from '../helpers/sql_safety';

/**
 * Generates a deterministic, collision-safe user code for a tenant.
 */
export function resolveDeterministicUserCode(
  user: { id: string; role?: string; name?: string },
  existingCodes: Set<string>
): string {
  // 1. Preserved approved baseline codes
  if ((user.role === 'OWNER' || user.id === 'user_nusantara_owner') && !existingCodes.has('USR-OWNER1')) {
    return 'USR-OWNER1';
  }
  if ((user.role === 'CASHIER' || user.id === 'user_nusantara_kasir') && !existingCodes.has('USR-KASIR1')) {
    return 'USR-KASIR1';
  }

  // 2. Deterministic candidate from sanitized user id
  const cleanId = user.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const primaryCandidate = `USR-${cleanId.substring(0, 6).padEnd(6, 'X')}`;
  if (!existingCodes.has(primaryCandidate)) {
    return primaryCandidate;
  }

  // 3. Collision resolution: deterministic SHA-256 slice derivation
  for (let attempt = 1; attempt <= 100; attempt++) {
    const hash = crypto
      .createHash('sha256')
      .update(`${user.id}:user_code_salt:${attempt}`)
      .digest('hex')
      .toUpperCase();
    const candidate = `USR-${hash.substring(0, 6)}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Failed to deterministically allocate unique userCode for user ${user.id} in tenant`);
}

/**
 * Worker 07: User Model B Identity & Credential Backfill
 * Generates tenant-scoped userCode and hashes plaintext pin into pinHash using Bcrypt.
 * (Safety Invariant: pin IS NULL follows OD-13.3-03; pin_hash remains NULL; NO synthetic schema flags added).
 * Uses parameterized raw SQL (no target Prisma delegates).
 */
export async function runUserModelBBackfill(
  prisma: any,
  context: BackfillContext
): Promise<BackfillResult> {
  const result: BackfillResult = {
    workerName: '07_user_model_b',
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

  // Raw query to read legacy user fields including plaintext pin and role
  const query = context.tenantId
    ? `SELECT id, tenant_id, name, email, role, pin, user_code, pin_hash, is_active FROM "users" WHERE tenant_id = $1;`
    : `SELECT id, tenant_id, name, email, role, pin, user_code, pin_hash, is_active FROM "users";`;

  const users: any[] = context.tenantId
    ? await prisma.$queryRawUnsafe(query, context.tenantId)
    : await prisma.$queryRawUnsafe(query);

  result.processedCount = users.length;

  // Track allocated user codes per tenant to prevent duplicate collisions
  const tenantAllocatedCodes = new Map<string, Set<string>>();

  // Preload existing non-null user_code in database to avoid collisions on rerun
  const existingCodeRows: any[] = context.tenantId
    ? await prisma.$queryRawUnsafe(`SELECT tenant_id, user_code FROM "users" WHERE user_code IS NOT NULL AND tenant_id = $1;`, context.tenantId)
    : await prisma.$queryRawUnsafe(`SELECT tenant_id, user_code FROM "users" WHERE user_code IS NOT NULL;`);

  for (const row of existingCodeRows) {
    if (!tenantAllocatedCodes.has(row.tenant_id)) {
      tenantAllocatedCodes.set(row.tenant_id, new Set<string>());
    }
    tenantAllocatedCodes.get(row.tenant_id)!.add(row.user_code);
  }

  for (const user of users) {
    try {
      const tenantId = user.tenant_id;
      if (!tenantAllocatedCodes.has(tenantId)) {
        tenantAllocatedCodes.set(tenantId, new Set<string>());
      }
      const tenantCodeSet = tenantAllocatedCodes.get(tenantId)!;

      // Check if already migrated:
      if (user.user_code && (user.pin_hash || (user.pin === null && user.pin_hash === null))) {
        tenantCodeSet.add(user.user_code);
        result.skippedCount++;
        continue;
      }

      // Allocate deterministic, collision-safe user_code
      let userCode = user.user_code;
      if (!userCode) {
        userCode = resolveDeterministicUserCode(user, tenantCodeSet);
      }
      tenantCodeSet.add(userCode);

      let pinHash = user.pin_hash;

      if (user.pin && user.pin.trim() !== '') {
        // Case A: Legacy PIN exists -> Hash securely via Bcrypt
        pinHash = await bcrypt.hash(user.pin.trim(), 10);
      } else {
        // Case B: OD-13.3-03: PIN is NULL -> retain pin_hash = NULL, emit operational notice
        pinHash = null;
        context.logger.warn(
          `Operational Notice: User ${user.id} (${user.name}, role=${user.role}) has NULL PIN. pin_hash retained as NULL per OD-13.3-03. Operational credential provisioning required before cashier terminal login.`
        );
        result.exceptions.push({
          recordId: user.id,
          reason: 'Operational Notice: Legacy PIN is NULL. pin_hash retained as NULL per OD-13.3-03. Operational POS PIN provisioning required before cashier terminal login.',
        });
      }

      if (!context.isDryRun) {
        await executeWriteRaw(
          prisma,
          context,
          `UPDATE "users" 
           SET "user_code" = $1, "pin_hash" = $2, "updated_at" = CURRENT_TIMESTAMP 
           WHERE "id" = $3;`,
          userCode,
          pinHash,
          user.id
        );
      }

      result.plannedIds!.push(`${user.id}:${userCode}:${pinHash !== null ? 'PIN_HASHED' : 'PIN_NULL'}`);
      result.createdCount++;
    } catch (err: any) {
      context.logger.error(`Error migrating Model B credentials for user ${user.id}`, err);
      result.errorCount++;
      result.exceptions.push({
        recordId: user.id,
        reason: err.message,
      });
      if (!context.isDryRun) {
        throw err;
      }
    }
  }

  context.logger.info(
    `Finished ${result.workerName}: Migrated=${result.createdCount}, Skipped=${result.skippedCount}, Exceptions=${result.exceptions.length}`
  );
  return result;
}
