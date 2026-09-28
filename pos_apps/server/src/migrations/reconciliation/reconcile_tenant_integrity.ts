import { PrismaClient } from '@prisma/client';

export interface ParityCheckResult {
  suiteName: string;
  passed: boolean;
  discrepancyCount: number;
  details: string;
}

/**
 * Reconciles Tenant Boundary Integrity
 * Verifies 0 NULL tenant_ids and 0 cross-tenant parent/child references.
 * Correctly validates tenant inheritance via the schema:
 * order_items -> orders -> tenant, and order_items -> product_variants / products -> tenant.
 * (Defect fix: order_items has no tenant_id column; check cross-tenant linkages).
 * Fully parameterized SQL: zero string interpolation.
 */
export async function reconcileTenantIntegrity(
  prisma: PrismaClient,
  tenantId?: string
): Promise<ParityCheckResult[]> {
  const results: ParityCheckResult[] = [];

  // Check 1: Cross-tenant references between order_items -> orders and order_items -> product_variants / products
  const crossTenantItems: any[] = tenantId
    ? await prisma.$queryRawUnsafe(
        `SELECT count(*)::int as count 
         FROM "order_items" oi 
         JOIN "orders" o ON o.id = oi.order_id 
         LEFT JOIN "product_variants" pv ON pv.id = oi.product_variant_id
         LEFT JOIN "products" p ON p.id = pv.product_id
         WHERE ((pv.tenant_id IS NOT NULL AND pv.tenant_id != o.tenant_id)
            OR (p.tenant_id IS NOT NULL AND p.tenant_id != o.tenant_id))
           AND o.tenant_id = $1;`,
        tenantId
      )
    : await prisma.$queryRawUnsafe(
        `SELECT count(*)::int as count 
         FROM "order_items" oi 
         JOIN "orders" o ON o.id = oi.order_id 
         LEFT JOIN "product_variants" pv ON pv.id = oi.product_variant_id
         LEFT JOIN "products" p ON p.id = pv.product_id
         WHERE ((pv.tenant_id IS NOT NULL AND pv.tenant_id != o.tenant_id)
            OR (p.tenant_id IS NOT NULL AND p.tenant_id != o.tenant_id));`
      );
  const crossCount = crossTenantItems[0]?.count || 0;

  results.push({
    suiteName: 'Tenant Boundary: Cross-Tenant References',
    passed: crossCount === 0,
    discrepancyCount: crossCount,
    details: crossCount === 0 
      ? '0 cross-tenant references detected across order_items, orders, variants, and products.' 
      : `${crossCount} order items have cross-tenant catalog or order reference mismatches!`,
  });

  // Check 2: NULL tenant_id across key operational entities
  const nullTenantCheck: any[] = await prisma.$queryRawUnsafe(
    `SELECT (
      (SELECT count(*)::int FROM "outlets" WHERE tenant_id IS NULL) +
      (SELECT count(*)::int FROM "users" WHERE tenant_id IS NULL) +
      (SELECT count(*)::int FROM "products" WHERE tenant_id IS NULL) +
      (SELECT count(*)::int FROM "orders" WHERE tenant_id IS NULL)
    ) as null_count;`
  );
  const nullCount = nullTenantCheck[0]?.null_count || 0;

  results.push({
    suiteName: 'Tenant Boundary: Zero NULL Tenant ID Audit',
    passed: nullCount === 0,
    discrepancyCount: nullCount,
    details: nullCount === 0
      ? '100% tenant-scoped rows: 0 NULL tenant_id detected across operational tables.'
      : `${nullCount} operational rows found with NULL tenant_id!`,
  });

  return results;
}
