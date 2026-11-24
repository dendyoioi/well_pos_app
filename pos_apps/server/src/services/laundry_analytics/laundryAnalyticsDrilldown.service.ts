/**
 * Laundry Parameterized Drill-Down Inspection Drawer Service
 * Laundry Outlet Performance Intelligence (Well POS)
 * 
 * Mengimplementasikan pengambilan data rinci per transaksi/pelanggan/piutang
 * dengan paginasi baku dan verifikasi tipe drill-down sesuai spesifikasi Task W1-13.
 */

import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { FinancialAnalyticsParams } from './laundryAnalyticsFinancial.service';

export const DRILLDOWN_TYPES = [
  'ORDERS_BY_DATE',
  'ORDERS_BY_STAGE',
  'ORDERS_BY_PAYMENT',
  'ORDERS_BY_HOUR',
  'UNPAID_DEBTS',
  'OVERDUE_ORDERS',
  'DORMANT_CUSTOMERS',
] as const;

export type DrilldownType = (typeof DRILLDOWN_TYPES)[number];

const RESTRICTED_TYPES_FOR_SUPERVISOR = new Set<DrilldownType>([
  'ORDERS_BY_PAYMENT',
  'UNPAID_DEBTS',
  'DORMANT_CUSTOMERS',
]);

export interface DrilldownParams extends FinancialAnalyticsParams {
  type: string;
  role: string;
  page?: number;
  limit?: number;
  targetDate?: string;
  stage?: string;
  paymentMethod?: string;
  dayOfWeek?: number;
  hour?: number;
  dormantDays?: number;
}

export interface DrilldownResult {
  type: DrilldownType;
  items: any[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

const toNum = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

export async function getDrilldownAnalytics(
  params: DrilldownParams
): Promise<DrilldownResult> {
  const { tenantId, outletId, dateRange, role } = params;
  const rawType = String(params.type || '').toUpperCase() as DrilldownType;

  // 1. Validasi Whitelist Tipe Drilldown
  if (!DRILLDOWN_TYPES.includes(rawType)) {
    const error: any = new Error(
      `Tipe drill-down '${params.type}' tidak valid. Pilihan valid: ${DRILLDOWN_TYPES.join(', ')}`
    );
    error.statusCode = 400;
    throw error;
  }

  // 2. Validasi RBAC untuk Tipe Tertentu
  if (role === Role.SUPERVISOR && RESTRICTED_TYPES_FOR_SUPERVISOR.has(rawType)) {
    const error: any = new Error(
      `Peran SUPERVISOR tidak memiliki hak akses untuk inspeksi data '${rawType}'`
    );
    error.statusCode = 403;
    throw error;
  }

  // Paginasi Baku
  const rawPage = Number(params.page) || 1;
  const rawLimit = Number(params.limit) || 10;
  const page = Math.max(1, Math.floor(rawPage));
  const limit = Math.min(100, Math.max(1, Math.floor(rawLimit)));
  const offset = (page - 1) * limit;

  const timezone = params.timezone || dateRange.timezone || 'Asia/Jakarta';
  const outletOrderFilter =
    outletId !== 'ALL' ? Prisma.sql`AND o.outlet_id = ${outletId}` : Prisma.empty;
  const outletLodFilter =
    outletId !== 'ALL' ? Prisma.sql`AND lod.outlet_id = ${outletId}` : Prisma.empty;
  const outletDebtFilter =
    outletId !== 'ALL' ? Prisma.sql`AND cd.outlet_id = ${outletId}` : Prisma.empty;

  let totalItems = 0;
  let items: any[] = [];

  switch (rawType) {
    case 'ORDERS_BY_DATE': {
      let dateFilter = Prisma.sql`AND o.created_at >= ${dateRange.startDate} AND o.created_at <= ${dateRange.endDate}`;
      if (params.targetDate) {
        dateFilter = Prisma.sql`AND (o.created_at AT TIME ZONE ${timezone})::date = ${params.targetDate}::date`;
      }

      const countRows = await prisma.$queryRaw<any[]>`
        SELECT COUNT(o.id)::int as total
        FROM orders o
        WHERE o.tenant_id = ${tenantId}
          ${outletOrderFilter}
          ${dateFilter}
          AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
      `;
      totalItems = Number(countRows[0]?.total || 0);

      const rows = await prisma.$queryRaw<any[]>`
        SELECT 
          o.id as order_id,
          o.invoice_number,
          o.grand_total,
          o.order_status,
          o.payment_status,
          o.created_at,
          COALESCE(c.name, 'Pelanggan Walk-in') as customer_name,
          COALESCE(u.name, 'Kasir') as cashier_name,
          COALESCE(lod.current_stage, 'DROP_OFF') as current_stage,
          lod.total_weight_kg
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN users u ON o.cashier_id = u.id
        LEFT JOIN laundry_order_details lod ON o.id = lod.order_id
        WHERE o.tenant_id = ${tenantId}
          ${outletOrderFilter}
          ${dateFilter}
          AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
        ORDER BY o.created_at DESC
        LIMIT ${limit} OFFSET ${offset};
      `;

      items = rows.map((r) => ({
        orderId: String(r.order_id),
        invoiceNumber: String(r.invoice_number),
        grandTotal: toNum(r.grand_total),
        orderStatus: String(r.order_status || 'CONFIRMED'),
        paymentStatus: String(r.payment_status || 'UNPAID'),
        createdAt: new Date(r.created_at).toISOString(),
        customerName: String(r.customer_name),
        cashierName: String(r.cashier_name),
        currentStage: String(r.current_stage),
        totalWeightKg: toNum(r.total_weight_kg),
      }));
      break;
    }

    case 'ORDERS_BY_STAGE': {
      const stageCond = params.stage
        ? Prisma.sql`AND UPPER(COALESCE(lod.current_stage, 'DROP_OFF')) = ${params.stage.toUpperCase()}`
        : Prisma.empty;

      const countRows = await prisma.$queryRaw<any[]>`
        SELECT COUNT(lod.id)::int as total
        FROM laundry_order_details lod
        JOIN orders o ON lod.order_id = o.id
        WHERE lod.tenant_id = ${tenantId}
          ${outletLodFilter}
          ${stageCond}
          AND (lod.current_stage IS NULL OR lod.current_stage NOT IN ('COMPLETED'))
          AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
      `;
      totalItems = Number(countRows[0]?.total || 0);

      const rows = await prisma.$queryRaw<any[]>`
        SELECT 
          o.id as order_id,
          o.invoice_number,
          o.grand_total,
          lod.current_stage,
          lod.total_weight_kg,
          lod.total_pieces,
          lod.perfume_variant,
          lod.estimated_ready_at,
          o.created_at,
          COALESCE(c.name, 'Pelanggan Walk-in') as customer_name
        FROM laundry_order_details lod
        JOIN orders o ON lod.order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE lod.tenant_id = ${tenantId}
          ${outletLodFilter}
          ${stageCond}
          AND (lod.current_stage IS NULL OR lod.current_stage NOT IN ('COMPLETED'))
          AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
        ORDER BY o.created_at ASC
        LIMIT ${limit} OFFSET ${offset};
      `;

      items = rows.map((r) => ({
        orderId: String(r.order_id),
        invoiceNumber: String(r.invoice_number),
        grandTotal: toNum(r.grand_total),
        currentStage: String(r.current_stage || 'DROP_OFF'),
        totalWeightKg: toNum(r.total_weight_kg),
        totalPieces: Number(r.total_pieces || 0),
        perfumeVariant: r.perfume_variant ? String(r.perfume_variant) : null,
        estimatedReadyAt: r.estimated_ready_at ? new Date(r.estimated_ready_at).toISOString() : null,
        createdAt: new Date(r.created_at).toISOString(),
        customerName: String(r.customer_name),
      }));
      break;
    }

    case 'ORDERS_BY_PAYMENT': {
      const methodCond = params.paymentMethod
        ? Prisma.sql`AND pt.payment_method = ${params.paymentMethod.toUpperCase()}::"PaymentMethod"`
        : Prisma.empty;

      const countRows = await prisma.$queryRaw<any[]>`
        SELECT COUNT(pt.id)::int as total
        FROM payment_transactions pt
        JOIN orders o ON pt.order_id = o.id
        WHERE pt.tenant_id = ${tenantId}
          ${outletId !== 'ALL' ? Prisma.sql`AND pt.outlet_id = ${outletId}` : Prisma.empty}
          ${methodCond}
          AND pt.created_at >= ${dateRange.startDate}
          AND pt.created_at <= ${dateRange.endDate}
          AND pt.status = 'CAPTURED';
      `;
      totalItems = Number(countRows[0]?.total || 0);

      const rows = await prisma.$queryRaw<any[]>`
        SELECT 
          pt.id as transaction_id,
          pt.payment_method,
          pt.amount,
          pt.created_at,
          o.id as order_id,
          o.invoice_number,
          o.grand_total,
          COALESCE(c.name, 'Pelanggan Walk-in') as customer_name
        FROM payment_transactions pt
        JOIN orders o ON pt.order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE pt.tenant_id = ${tenantId}
          ${outletId !== 'ALL' ? Prisma.sql`AND pt.outlet_id = ${outletId}` : Prisma.empty}
          ${methodCond}
          AND pt.created_at >= ${dateRange.startDate}
          AND pt.created_at <= ${dateRange.endDate}
          AND pt.status = 'CAPTURED'
        ORDER BY pt.created_at DESC
        LIMIT ${limit} OFFSET ${offset};
      `;

      items = rows.map((r) => ({
        transactionId: String(r.transaction_id),
        paymentMethod: String(r.payment_method),
        amount: toNum(r.amount),
        createdAt: new Date(r.created_at).toISOString(),
        orderId: String(r.order_id),
        invoiceNumber: String(r.invoice_number),
        grandTotal: toNum(r.grand_total),
        customerName: String(r.customer_name),
      }));
      break;
    }

    case 'ORDERS_BY_HOUR': {
      let dowCond = Prisma.empty;
      if (params.dayOfWeek !== undefined && params.dayOfWeek !== null) {
        dowCond = Prisma.sql`AND EXTRACT(DOW FROM o.created_at AT TIME ZONE ${timezone})::int = ${Number(params.dayOfWeek)}`;
      }
      let hrCond = Prisma.empty;
      if (params.hour !== undefined && params.hour !== null) {
        hrCond = Prisma.sql`AND EXTRACT(HOUR FROM o.created_at AT TIME ZONE ${timezone})::int = ${Number(params.hour)}`;
      }

      const countRows = await prisma.$queryRaw<any[]>`
        SELECT COUNT(o.id)::int as total
        FROM orders o
        WHERE o.tenant_id = ${tenantId}
          ${outletOrderFilter}
          AND o.created_at >= ${dateRange.startDate}
          AND o.created_at <= ${dateRange.endDate}
          ${dowCond}
          ${hrCond}
          AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
      `;
      totalItems = Number(countRows[0]?.total || 0);

      const rows = await prisma.$queryRaw<any[]>`
        SELECT 
          o.id as order_id,
          o.invoice_number,
          o.grand_total,
          o.created_at,
          COALESCE(c.name, 'Pelanggan Walk-in') as customer_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.tenant_id = ${tenantId}
          ${outletOrderFilter}
          AND o.created_at >= ${dateRange.startDate}
          AND o.created_at <= ${dateRange.endDate}
          ${dowCond}
          ${hrCond}
          AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
        ORDER BY o.created_at DESC
        LIMIT ${limit} OFFSET ${offset};
      `;

      items = rows.map((r) => ({
        orderId: String(r.order_id),
        invoiceNumber: String(r.invoice_number),
        grandTotal: toNum(r.grand_total),
        createdAt: new Date(r.created_at).toISOString(),
        customerName: String(r.customer_name),
      }));
      break;
    }

    case 'UNPAID_DEBTS': {
      const countRows = await prisma.$queryRaw<any[]>`
        SELECT COUNT(cd.id)::int as total
        FROM customer_debts cd
        WHERE cd.tenant_id = ${tenantId}
          ${outletDebtFilter}
          AND cd.status IN ('UNPAID', 'PARTIAL');
      `;
      totalItems = Number(countRows[0]?.total || 0);

      const rows = await prisma.$queryRaw<any[]>`
        SELECT 
          cd.id as debt_id,
          cd.total_amount,
          cd.paid_amount,
          cd.remaining_amount,
          cd.status,
          cd.due_date,
          cd.created_at,
          o.invoice_number,
          c.id as customer_id,
          c.name as customer_name,
          c.phone as customer_phone
        FROM customer_debts cd
        JOIN orders o ON cd.order_id = o.id
        JOIN customers c ON cd.customer_id = c.id
        WHERE cd.tenant_id = ${tenantId}
          ${outletDebtFilter}
          AND cd.status IN ('UNPAID', 'PARTIAL')
        ORDER BY cd.remaining_amount DESC, cd.created_at ASC
        LIMIT ${limit} OFFSET ${offset};
      `;

      items = rows.map((r) => ({
        debtId: String(r.debt_id),
        totalAmount: toNum(r.total_amount),
        paidAmount: toNum(r.paid_amount),
        remainingAmount: toNum(r.remaining_amount),
        status: String(r.status),
        dueDate: r.due_date ? new Date(r.due_date).toISOString() : null,
        createdAt: new Date(r.created_at).toISOString(),
        invoiceNumber: String(r.invoice_number),
        customerId: String(r.customer_id),
        customerName: String(r.customer_name),
        customerPhone: r.customer_phone ? String(r.customer_phone) : null,
      }));
      break;
    }

    case 'OVERDUE_ORDERS': {
      const countRows = await prisma.$queryRaw<any[]>`
        SELECT COUNT(lod.id)::int as total
        FROM laundry_order_details lod
        JOIN orders o ON lod.order_id = o.id
        WHERE lod.tenant_id = ${tenantId}
          ${outletLodFilter}
          AND lod.estimated_ready_at IS NOT NULL
          AND lod.estimated_ready_at < NOW()
          AND lod.completed_at IS NULL
          AND (o.order_status IS NULL OR o.order_status NOT IN ('COMPLETED', 'VOIDED', 'CANCELLED'));
      `;
      totalItems = Number(countRows[0]?.total || 0);

      const rows = await prisma.$queryRaw<any[]>`
        SELECT 
          o.id as order_id,
          o.invoice_number,
          o.grand_total,
          lod.current_stage,
          lod.estimated_ready_at,
          lod.total_weight_kg,
          ROUND(EXTRACT(EPOCH FROM (NOW() - lod.estimated_ready_at)) / 3600)::int as overdue_hours,
          COALESCE(c.name, 'Pelanggan Walk-in') as customer_name,
          c.phone as customer_phone
        FROM laundry_order_details lod
        JOIN orders o ON lod.order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE lod.tenant_id = ${tenantId}
          ${outletLodFilter}
          AND lod.estimated_ready_at IS NOT NULL
          AND lod.estimated_ready_at < NOW()
          AND lod.completed_at IS NULL
          AND (o.order_status IS NULL OR o.order_status NOT IN ('COMPLETED', 'VOIDED', 'CANCELLED'))
        ORDER BY lod.estimated_ready_at ASC
        LIMIT ${limit} OFFSET ${offset};
      `;

      items = rows.map((r) => ({
        orderId: String(r.order_id),
        invoiceNumber: String(r.invoice_number),
        grandTotal: toNum(r.grand_total),
        currentStage: String(r.current_stage || 'DROP_OFF'),
        estimatedReadyAt: r.estimated_ready_at ? new Date(r.estimated_ready_at).toISOString() : null,
        overdueHours: Number(r.overdue_hours || 0),
        totalWeightKg: toNum(r.total_weight_kg),
        customerName: String(r.customer_name),
        customerPhone: r.customer_phone ? String(r.customer_phone) : null,
      }));
      break;
    }

    case 'DORMANT_CUSTOMERS': {
      const dormantDays = Math.max(7, Math.min(365, Number(params.dormantDays) || 30));

      const countRows = await prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int as total
        FROM (
          SELECT c.id
          FROM customers c
          JOIN orders o ON c.id = o.customer_id
          WHERE c.tenant_id = ${tenantId}
            ${outletOrderFilter}
            AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
          GROUP BY c.id
          HAVING MAX(o.created_at) < NOW() - (${dormantDays} * INTERVAL '1 day')
        ) dormant_sub;
      `;
      totalItems = Number(countRows[0]?.total || 0);

      const rows = await prisma.$queryRaw<any[]>`
        SELECT 
          c.id as customer_id,
          c.name,
          c.phone,
          MAX(o.created_at) as last_order_at,
          ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(o.created_at))) / 86400)::int as days_since_last_order,
          COUNT(o.id)::int as total_orders,
          COALESCE(SUM(o.grand_total), 0) as total_spent,
          c.last_winback_sent_at
        FROM customers c
        JOIN orders o ON c.id = o.customer_id
        WHERE c.tenant_id = ${tenantId}
          ${outletOrderFilter}
          AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
        GROUP BY c.id, c.name, c.phone, c.last_winback_sent_at
        HAVING MAX(o.created_at) < NOW() - (${dormantDays} * INTERVAL '1 day')
        ORDER BY total_spent DESC, days_since_last_order DESC
        LIMIT ${limit} OFFSET ${offset};
      `;

      items = rows.map((r) => ({
        customerId: String(r.customer_id),
        name: String(r.name),
        phone: r.phone ? String(r.phone) : null,
        lastOrderAt: r.last_order_at ? new Date(r.last_order_at).toISOString() : null,
        daysSinceLastOrder: Number(r.days_since_last_order || 0),
        totalOrders: Number(r.total_orders || 0),
        totalSpent: toNum(r.total_spent),
        lastWinbackSentAt: r.last_winback_sent_at ? new Date(r.last_winback_sent_at).toISOString() : null,
      }));
      break;
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  return {
    type: rawType,
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
    },
  };
}
