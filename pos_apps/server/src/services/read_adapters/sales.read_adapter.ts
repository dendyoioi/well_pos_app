import { BaseReadAdapter } from './base.read_adapter';
import { GetOrdersQueryOptions, OrderListItemDTO } from './types';
import { parseDateBoundary } from '../../utils/date.utils';

/**
 * SalesReadAdapter
 * Target read adapter for sales and orders querying directly from:
 * - orders (with decoupled order_status & payment_status)
 * - order_items (with variant_id snapshot)
 * - payment_transactions (multi-tender captures)
 * - product_variants
 * - users (cashier)
 * - outlets
 * - customers
 */
export class SalesReadAdapter extends BaseReadAdapter {
  /**
   * Retrieves paginated orders from target schema.
   */
  public async getOrders(options: GetOrdersQueryOptions): Promise<{
    data: OrderListItemDTO[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const { tenantId, outletId, cashierId, channel, search, startDate, endDate, limit = 20, page = 1 } = options;

    const params: any[] = [tenantId];
    const whereClauses: string[] = [`o.tenant_id = $1`];

    if (outletId) {
      params.push(outletId);
      whereClauses.push(`o.outlet_id = $${params.length}`);
    }

    if (cashierId) {
      params.push(cashierId);
      whereClauses.push(`o.user_id = $${params.length}`);
    }

    if (channel && channel !== 'ALL') {
      params.push(channel);
      whereClauses.push(`COALESCE(o.channel, o.order_type) = $${params.length}`);
    }

    if (startDate) {
      params.push(parseDateBoundary(startDate, false));
      whereClauses.push(`o.created_at >= $${params.length}`);
    }

    if (endDate) {
      params.push(parseDateBoundary(endDate, true));
      whereClauses.push(`o.created_at <= $${params.length}`);
    }

    if (search && search.trim() !== '') {
      params.push(`%${search.trim().toLowerCase()}%`);
      const sIdx = params.length;
      whereClauses.push(`(
        LOWER(o.invoice_number) LIKE $${sIdx} 
        OR LOWER(COALESCE(c.name, '')) LIKE $${sIdx}
      )`);
    }

    const whereStr = whereClauses.join(' AND ');

    // 1. Total count query
    const countSql = `
      SELECT COUNT(DISTINCT o.id) as count
      FROM "orders" o
      LEFT JOIN "customers" c ON c.id = o.customer_id
      WHERE ${whereStr};
    `;
    const countRows = await this.queryRaw<any>(countSql, ...params);
    const total = Number(countRows[0]?.count || 0);

    const take = limit;
    const skip = (page - 1) * take;

    // 2. Fetch order headers
    params.push(take);
    const takeIdx = params.length;
    params.push(skip);
    const skipIdx = params.length;

    const ordersSql = `
      SELECT 
        o.id,
        o.tenant_id,
        o.outlet_id,
        o.cashier_id as user_id,
        o.customer_id,
        o.invoice_number,
        o.order_status::text as order_status,
        o.payment_status::text as payment_status,
        o.order_type,
        COALESCE(o.channel, 'DINE_IN') as channel,
        o.subtotal,
        COALESCE(o.discount_amount, 0) as discount_total,
        COALESCE(o.tax_amount, 0) as tax_total,
        COALESCE(o.service_total, o.service_charge, 0) as service_total,
        COALESCE(o.grand_total, 0) as total_amount,
        COALESCE(o.paid_amount, 0) as paid_amount,
        COALESCE(o.change_amount, 0) as change_amount,
        COALESCE(o.notes, '') as notes,
        o.created_at,
        o.updated_at,
        u.name as cashier_name,
        out.name as outlet_name,
        c.name as customer_name,
        c.phone as customer_phone,
        c.code as customer_code
      FROM "orders" o
      JOIN "users" u ON u.id = o.cashier_id
      JOIN "outlets" out ON out.id = o.outlet_id
      LEFT JOIN "customers" c ON c.id = o.customer_id
      WHERE ${whereStr}
      ORDER BY o.created_at DESC
      LIMIT $${takeIdx} OFFSET $${skipIdx};
    `;

    const orderRows = await this.queryRaw<any>(ordersSql, ...params);
    if (orderRows.length === 0) {
      return {
        data: [],
        meta: {
          total,
          page,
          limit: take,
          totalPages: Math.ceil(total / take),
        },
      };
    }

    const orderIds = orderRows.map((r) => r.id);

    // 3. Batch fetch order items
    const itemsSql = `
      SELECT 
        oi.id,
        oi.order_id,
        oi.product_name,
        oi.variant_name,
        oi.sku,
        oi.quantity,
        oi.unit_price,
        oi.subtotal,
        pv.product_id,
        p.unit,
        c.name as category_name
      FROM "order_items" oi
      JOIN "product_variants" pv ON pv.id = oi.product_variant_id
      JOIN "products" p ON p.id = pv.product_id
      LEFT JOIN "categories" c ON c.id = p.category_id
      WHERE oi.order_id = ANY($1::text[]);
    `;
    const itemRows = await this.queryRaw<any>(itemsSql, orderIds);

    // 4. Batch fetch payment transactions
    const paymentsSql = `
      SELECT 
        pt.id,
        pt.order_id,
        pt.payment_method::text as payment_method,
        pt.amount,
        pt.status::text as status,
        pt.reference_number
      FROM "payment_transactions" pt
      WHERE pt.order_id = ANY($1::text[])
      ORDER BY pt.created_at ASC;
    `;
    const paymentRows = await this.queryRaw<any>(paymentsSql, orderIds);

    // Group items & payments by orderId
    const itemsByOrder = new Map<string, any[]>();
    for (const item of itemRows) {
      if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
      itemsByOrder.get(item.order_id)!.push({
        id: item.id,
        productName: item.product_name,
        variantName: item.variant_name,
        sku: item.sku,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unit_price || 0),
        subtotal: Number(item.subtotal || 0),
        categoryName: item.category_name || 'Lainnya',
        product: {
          name: item.product_name,
          unit: item.unit || 'PCS',
          category: {
            name: item.category_name || 'Lainnya',
          },
        },
      });
    }

    const paymentsByOrder = new Map<string, any[]>();
    for (const p of paymentRows) {
      if (!paymentsByOrder.has(p.order_id)) paymentsByOrder.set(p.order_id, []);
      paymentsByOrder.get(p.order_id)!.push({
        id: p.id,
        paymentMethod: p.payment_method,
        method: p.payment_method,
        amount: Number(p.amount || 0),
        amountPaid: Number(p.amount || 0),
        status: p.status,
        referenceNumber: p.reference_number || null,
      });
    }

    const formattedOrders: OrderListItemDTO[] = orderRows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      outletId: r.outlet_id,
      userId: r.user_id,
      customerId: r.customer_id || null,
      invoiceNumber: r.invoice_number,
      orderStatus: r.order_status,
      paymentStatus: r.payment_status,
      orderType: r.order_type,
      channel: r.channel || r.order_type || 'DINE_IN',
      subtotal: Number(r.subtotal || 0),
      discountTotal: Number(r.discount_total || 0),
      discountAmount: Number(r.discount_total || 0),
      taxTotal: Number(r.tax_total || 0),
      taxAmount: Number(r.tax_total || 0),
      serviceTotal: Number(r.service_total || 0),
      serviceCharge: Number(r.service_total || 0),
      totalAmount: Number(r.total_amount || 0),
      grandTotal: Number(r.total_amount || 0),
      paidAmount: Number(r.paid_amount || 0),
      changeAmount: Number(r.change_amount || 0),
      notes: r.notes || null,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
      orderItems: itemsByOrder.get(r.id) || [],
      payments: paymentsByOrder.get(r.id) || [],
      cashier: {
        id: r.user_id,
        name: r.cashier_name || 'Cashier',
      },
      outlet: {
        id: r.outlet_id,
        name: r.outlet_name || 'Outlet',
      },
      customer: r.customer_id
        ? {
            id: r.customer_id,
            name: r.customer_name || 'Customer',
            phone: r.customer_phone || null,
            code: r.customer_code || null,
          }
        : null,
    }));

    return {
      data: formattedOrders,
      meta: {
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Retrieves single order detail from target schema.
   */
  public async getOrderById(tenantId: string, orderId: string): Promise<OrderListItemDTO | null> {
    const res = await this.getOrders({
      tenantId,
      limit: 1,
      page: 1,
      search: orderId,
    });

    if (res.data.length > 0 && res.data[0].id === orderId) {
      return res.data[0];
    }

    // Direct fetch fallback if search didn't match UUID
    const sql = `
      SELECT 
        o.id,
        o.tenant_id,
        o.outlet_id,
        o.cashier_id as user_id,
        o.customer_id,
        o.invoice_number,
        o.order_status::text as order_status,
        o.payment_status::text as payment_status,
        o.order_type,
        COALESCE(o.channel, 'DINE_IN') as channel,
        o.subtotal,
        COALESCE(o.discount_amount, 0) as discount_total,
        COALESCE(o.tax_amount, 0) as tax_total,
        COALESCE(o.service_total, o.service_charge, 0) as service_total,
        COALESCE(o.grand_total, 0) as total_amount,
        COALESCE(o.paid_amount, 0) as paid_amount,
        COALESCE(o.change_amount, 0) as change_amount,
        COALESCE(o.notes, '') as notes,
        o.created_at,
        o.updated_at,
        u.name as cashier_name,
        out.name as outlet_name,
        c.name as customer_name,
        c.phone as customer_phone,
        c.code as customer_code
      FROM "orders" o
      JOIN "users" u ON u.id = o.cashier_id
      JOIN "outlets" out ON out.id = o.outlet_id
      LEFT JOIN "customers" c ON c.id = o.customer_id
      WHERE o.tenant_id = $1 AND o.id = $2
      LIMIT 1;
    `;
    const rows = await this.queryRaw<any>(sql, tenantId, orderId);
    if (rows.length === 0) return null;

    const r = rows[0];

    const itemsSql = `
      SELECT 
        oi.id,
        oi.order_id,
        oi.product_name,
        oi.variant_name,
        oi.sku,
        oi.quantity,
        oi.unit_price,
        oi.subtotal,
        pv.product_id,
        p.unit,
        c.name as category_name
      FROM "order_items" oi
      JOIN "product_variants" pv ON pv.id = oi.product_variant_id
      JOIN "products" p ON p.id = pv.product_id
      LEFT JOIN "categories" c ON c.id = p.category_id
      WHERE oi.order_id = $1;
    `;
    const items = await this.queryRaw<any>(itemsSql, r.id);

    const paymentsSql = `
      SELECT 
        pt.id,
        pt.order_id,
        pt.payment_method::text as payment_method,
        pt.amount,
        pt.status::text as status,
        pt.reference_number
      FROM "payment_transactions" pt
      WHERE pt.order_id = $1
      ORDER BY pt.created_at ASC;
    `;
    const payments = await this.queryRaw<any>(paymentsSql, r.id);

    return {
      id: r.id,
      tenantId: r.tenant_id,
      outletId: r.outlet_id,
      userId: r.user_id,
      customerId: r.customer_id || null,
      invoiceNumber: r.invoice_number,
      orderStatus: r.order_status,
      paymentStatus: r.payment_status,
      orderType: r.order_type,
      channel: r.channel || r.order_type || 'DINE_IN',
      subtotal: Number(r.subtotal || 0),
      discountTotal: Number(r.discount_total || 0),
      discountAmount: Number(r.discount_total || 0),
      taxTotal: Number(r.tax_total || 0),
      taxAmount: Number(r.tax_total || 0),
      serviceTotal: Number(r.service_total || 0),
      serviceCharge: Number(r.service_total || 0),
      totalAmount: Number(r.total_amount || 0),
      grandTotal: Number(r.total_amount || 0),
      paidAmount: Number(r.paid_amount || 0),
      changeAmount: Number(r.change_amount || 0),
      notes: r.notes || null,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
      orderItems: items.map((i) => ({
        id: i.id,
        productName: i.product_name,
        variantName: i.variant_name,
        sku: i.sku,
        quantity: Number(i.quantity || 0),
        unitPrice: Number(i.unit_price || 0),
        subtotal: Number(i.subtotal || 0),
        categoryName: i.category_name || 'Lainnya',
        product: {
          name: i.product_name,
          unit: i.unit || 'PCS',
          category: {
            name: i.category_name || 'Lainnya',
          },
        },
      })),
      payments: payments.map((p) => ({
        id: p.id,
        paymentMethod: p.payment_method,
        method: p.payment_method,
        amount: Number(p.amount || 0),
        amountPaid: Number(p.amount || 0),
        status: p.status,
        referenceNumber: p.reference_number || null,
      })),
      cashier: {
        id: r.user_id,
        name: r.cashier_name || 'Cashier',
      },
      outlet: {
        id: r.outlet_id,
        name: r.outlet_name || 'Outlet',
      },
      customer: r.customer_id
        ? {
            id: r.customer_id,
            name: r.customer_name || 'Customer',
            phone: r.customer_phone || null,
            code: r.customer_code || null,
          }
        : null,
    };
  }
}

export const salesReadAdapter = new SalesReadAdapter();
