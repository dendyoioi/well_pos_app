import { PrismaClient } from '@prisma/client';
import { ParityCheckResult } from './reconcile_tenant_integrity';

/**
 * Reconciles User Model B Identity & Credentials (C-02 & OD-13.3-03)
 * Verifies active users have userCode != NULL, PIN-holding users have pinHash != NULL,
 * PIN-less users retain pinHash = NULL per OD-13.3-03, and unique userCode per tenant.
 * Fully parameterized SQL: zero string interpolation.
 */
export async function reconcileUserCredentials(
  prisma: PrismaClient,
  tenantId?: string
): Promise<ParityCheckResult[]> {
  const results: ParityCheckResult[] = [];

  // Check 1: Active users without user_code OR users with legacy PIN lacking valid bcrypt pin_hash
  const missingCredsQuery = tenantId
    ? `SELECT count(*)::int as count 
       FROM "users" 
       WHERE is_active = true 
         AND (user_code IS NULL OR (pin IS NOT NULL AND pin != '' AND (pin_hash IS NULL OR pin_hash NOT LIKE '$2%')))
         AND tenant_id = $1;`
    : `SELECT count(*)::int as count 
       FROM "users" 
       WHERE is_active = true 
         AND (user_code IS NULL OR (pin IS NOT NULL AND pin != '' AND (pin_hash IS NULL OR pin_hash NOT LIKE '$2%')));`;

  const missingCreds: any[] = tenantId
    ? await prisma.$queryRawUnsafe(missingCredsQuery, tenantId)
    : await prisma.$queryRawUnsafe(missingCredsQuery);

  const missingCount = missingCreds[0]?.count || 0;

  results.push({
    suiteName: 'IAM: Active Users Model B Credential Coverage',
    passed: missingCount === 0,
    discrepancyCount: missingCount,
    details: missingCount === 0
      ? '100% of active users possess valid userCode, and legacy PINs are securely hashed into pinHash (bcrypt).'
      : `${missingCount} active users lack userCode or lack valid bcrypt pinHash for legacy PIN!`,
  });

  // Check 2: userCode uniqueness per tenant
  const userCodeDuplicatesQuery = tenantId
    ? `SELECT tenant_id, user_code, count(*)::int as count 
       FROM "users" 
       WHERE user_code IS NOT NULL AND tenant_id = $1 
       GROUP BY tenant_id, user_code 
       HAVING count(*) > 1;`
    : `SELECT tenant_id, user_code, count(*)::int as count 
       FROM "users" 
       WHERE user_code IS NOT NULL 
       GROUP BY tenant_id, user_code 
       HAVING count(*) > 1;`;

  const userCodeDuplicates: any[] = tenantId
    ? await prisma.$queryRawUnsafe(userCodeDuplicatesQuery, tenantId)
    : await prisma.$queryRawUnsafe(userCodeDuplicatesQuery);

  results.push({
    suiteName: 'IAM: UserCode Uniqueness per Tenant',
    passed: userCodeDuplicates.length === 0,
    discrepancyCount: userCodeDuplicates.length,
    details: userCodeDuplicates.length === 0
      ? '0 duplicate user codes detected.'
      : `${userCodeDuplicates.length} userCode duplicate collisions detected!`,
  });

  // Check 3: OD-13.3-03 Invariant: PIN-less users retain pin_hash = NULL
  const pinlessUsersQuery = tenantId
    ? `SELECT count(*)::int as count
       FROM "users"
       WHERE (pin IS NULL OR pin = '') AND pin_hash IS NOT NULL AND tenant_id = $1;`
    : `SELECT count(*)::int as count
       FROM "users"
       WHERE (pin IS NULL OR pin = '') AND pin_hash IS NOT NULL;`;

  const pinlessUsers: any[] = tenantId
    ? await prisma.$queryRawUnsafe(pinlessUsersQuery, tenantId)
    : await prisma.$queryRawUnsafe(pinlessUsersQuery);

  const pinlessViolationCount = pinlessUsers[0]?.count || 0;

  results.push({
    suiteName: 'IAM: OD-13.3-03 Invariant (PIN-less users retain pin_hash = NULL)',
    passed: pinlessViolationCount === 0,
    discrepancyCount: pinlessViolationCount,
    details: pinlessViolationCount === 0
      ? '100% compliant with OD-13.3-03: PIN-less users retain pin_hash = NULL (zero synthetic credentials).'
      : `${pinlessViolationCount} PIN-less users received unexpected synthetic pin_hash!`,
  });

  return results;
}
