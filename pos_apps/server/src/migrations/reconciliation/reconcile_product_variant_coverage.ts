import { PrismaClient } from '@prisma/client';
import { ParityCheckResult } from './reconcile_tenant_integrity';

/**
 * Reconciles Product, Variant, and InventoryItem Coverage & Uniqueness
 * Fully parameterized SQL: zero string interpolation.
 */
export async function reconcileProductVariantCoverage(
  prisma: PrismaClient,
  tenantId?: string
): Promise<ParityCheckResult[]> {
  const results: ParityCheckResult[] = [];

  // Check 1: Unmapped products
  const unmappedProductsQuery = tenantId
    ? `SELECT count(*)::int as count 
       FROM "products" p 
       LEFT JOIN "product_variants" pv ON pv.product_id = p.id AND pv.tenant_id = p.tenant_id 
       WHERE pv.id IS NULL AND p.tenant_id = $1;`
    : `SELECT count(*)::int as count 
       FROM "products" p 
       LEFT JOIN "product_variants" pv ON pv.product_id = p.id AND pv.tenant_id = p.tenant_id 
       WHERE pv.id IS NULL;`;

  const unmappedProducts: any[] = tenantId
    ? await prisma.$queryRawUnsafe(unmappedProductsQuery, tenantId)
    : await prisma.$queryRawUnsafe(unmappedProductsQuery);

  const unmappedCount = unmappedProducts[0]?.count || 0;

  results.push({
    suiteName: 'Catalog: Product -> ProductVariant Coverage',
    passed: unmappedCount === 0,
    discrepancyCount: unmappedCount,
    details: unmappedCount === 0 
      ? '100% of products mapped to ProductVariant.' 
      : `${unmappedCount} products lack a ProductVariant!`,
  });

  // Check 2: Unmapped variants to InventoryItem
  const unmappedVariantsQuery = tenantId
    ? `SELECT count(*)::int as count 
       FROM "product_variants" pv 
       LEFT JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id AND ii.tenant_id = pv.tenant_id 
       WHERE ii.id IS NULL AND pv.tenant_id = $1;`
    : `SELECT count(*)::int as count 
       FROM "product_variants" pv 
       LEFT JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id AND ii.tenant_id = pv.tenant_id 
       WHERE ii.id IS NULL;`;

  const unmappedVariants: any[] = tenantId
    ? await prisma.$queryRawUnsafe(unmappedVariantsQuery, tenantId)
    : await prisma.$queryRawUnsafe(unmappedVariantsQuery);

  const unmappedVarCount = unmappedVariants[0]?.count || 0;

  results.push({
    suiteName: 'Catalog: ProductVariant -> InventoryItem Linkage',
    passed: unmappedVarCount === 0,
    discrepancyCount: unmappedVarCount,
    details: unmappedVarCount === 0 
      ? '100% of variants linked to valid InventoryItem.' 
      : `${unmappedVarCount} variants have missing InventoryItem!`,
  });

  // Check 3: SKU duplicate check
  const skuDuplicatesQuery = tenantId
    ? `SELECT tenant_id, sku, count(*)::int as count 
       FROM "product_variants" 
       WHERE sku IS NOT NULL AND sku != '' AND tenant_id = $1 
       GROUP BY tenant_id, sku 
       HAVING count(*) > 1;`
    : `SELECT tenant_id, sku, count(*)::int as count 
       FROM "product_variants" 
       WHERE sku IS NOT NULL AND sku != '' 
       GROUP BY tenant_id, sku 
       HAVING count(*) > 1;`;

  const skuDuplicates: any[] = tenantId
    ? await prisma.$queryRawUnsafe(skuDuplicatesQuery, tenantId)
    : await prisma.$queryRawUnsafe(skuDuplicatesQuery);

  results.push({
    suiteName: 'Catalog: SKU Uniqueness per Tenant',
    passed: skuDuplicates.length === 0,
    discrepancyCount: skuDuplicates.length,
    details: skuDuplicates.length === 0 
      ? '0 duplicate SKUs detected.' 
      : `${skuDuplicates.length} duplicate SKU collisions found!`,
  });

  return results;
}
