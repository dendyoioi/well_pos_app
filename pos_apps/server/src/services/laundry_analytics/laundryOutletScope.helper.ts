/**
 * Laundry Outlet Scope Helper
 * Laundry Outlet Performance Intelligence (Well POS)
 *
 * Mengisolasi scope outlet untuk query Laundry Analytics saat konsolidasi (outletId === 'ALL')
 * agar data order/omzet/mesin/staf dari bisnis non-Laundry (F&B / Retail) tidak bocor
 * pada tenant multi-bisnis.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

export interface LaundryOutletScope {
  isAll: boolean;
  targetOutletId?: string;
  laundryOutletIds: string[];

  /**
   * Bangun klausa SQL `AND <column> = $id` (jika single outlet)
   * atau `AND <column> IN ($id1, $id2)` (jika ALL)
   */
  sqlFilter: (column: string) => Prisma.Sql;

  /**
   * Bangun JOIN storage_locations khusus untuk query inventory COGS / OpEx
   */
  storageLocationJoin: (storageLocationIdColumn: string) => Prisma.Sql;
}

// In-memory short-TTL cache untuk query laundry outlet IDs (TTL 60 detik)
const outletScopeCache = new Map<string, { ids: string[]; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

/**
 * Mengambil daftar ID outlet bertipe Laundry untuk tenant tertentu
 */
export async function getTenantLaundryOutletIds(tenantId: string): Promise<string[]> {
  const now = Date.now();
  const cached = outletScopeCache.get(tenantId);
  if (cached && cached.expiresAt > now) {
    return cached.ids;
  }

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT o.id
    FROM outlets o
    LEFT JOIN businesses b ON o.business_id = b.id
    WHERE o.tenant_id = ${tenantId}
      AND (
        b.vertical = 'LAUNDRY'
        OR o.industries::text ILIKE '%LAUNDRY%'
      )
  `;

  const ids = rows.map((r) => r.id);
  outletScopeCache.set(tenantId, { ids, expiresAt: now + CACHE_TTL_MS });
  return ids;
}

export function clearLaundryOutletScopeCache(tenantId?: string) {
  if (tenantId) {
    outletScopeCache.delete(tenantId);
  } else {
    outletScopeCache.clear();
  }
}

/**
 * Menyelesaikan scope Laundry untuk service analitik.
 */
export async function resolveLaundryOutletScope(
  tenantId: string,
  outletId?: string
): Promise<LaundryOutletScope> {
  const isAll = !outletId || outletId === 'ALL';
  const laundryOutletIds = await getTenantLaundryOutletIds(tenantId);

  return {
    isAll,
    targetOutletId: isAll ? undefined : outletId,
    laundryOutletIds,

    sqlFilter: (column: string): Prisma.Sql => {
      if (!isAll && outletId) {
        return Prisma.sql`AND ${Prisma.raw(column)} = ${outletId}`;
      }
      if (laundryOutletIds.length === 0) {
        return Prisma.sql`AND 1 = 0`;
      }
      return Prisma.sql`AND ${Prisma.raw(column)} IN (${Prisma.join(laundryOutletIds)})`;
    },

    storageLocationJoin: (storageLocationIdColumn: string): Prisma.Sql => {
      if (!isAll && outletId) {
        return Prisma.sql`JOIN storage_locations sl ON ${Prisma.raw(storageLocationIdColumn)} = sl.id AND sl.outlet_id = ${outletId}`;
      }
      if (laundryOutletIds.length === 0) {
        return Prisma.sql`JOIN storage_locations sl ON ${Prisma.raw(storageLocationIdColumn)} = sl.id AND 1 = 0`;
      }
      return Prisma.sql`JOIN storage_locations sl ON ${Prisma.raw(storageLocationIdColumn)} = sl.id AND sl.outlet_id IN (${Prisma.join(laundryOutletIds)})`;
    },
  };
}
