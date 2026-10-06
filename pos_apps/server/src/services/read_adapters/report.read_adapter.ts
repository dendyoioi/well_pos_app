import { BaseReadAdapter } from './base.read_adapter';
import { FinancialReportDTO } from './types';
import { resolveDateRange, toWibDateStr } from '../../utils/date.utils';

/**
 * ReportReadAdapter
 * Target read adapter for financial, profit-loss, and stock velocity reports querying:
 * - orders (where payment_status = 'PAID')
 * - order_items
 * - payment_transactions
 * - product_variants
 * - products
 * - categories
 * - inventory_balances
 * - storage_locations
 */
export class ReportReadAdapter extends BaseReadAdapter {
  public async getFinancialSummary(
    tenantId: string,
    options: {
      startDate?: string;
      endDate?: string;
      outletId?: string;
    }
  ): Promise<FinancialReportDTO> {
    const { startDate, endDate, outletId } = options;
    const targetOutletId = outletId === 'ALL' ? undefined : outletId;

    // Date range resolution with standard WIB (+07:00) boundaries
    const { start, end } = resolveDateRange(startDate, endDate);

    // 1. Fetch completed orders in date range
    const params: any[] = [tenantId, start, end];
    let outletCondition = '';
    if (targetOutletId) {
      params.push(targetOutletId);
      outletCondition = `AND o.outlet_id = $${params.length}`;
    }

    const ordersSql = `
      SELECT 
        o.id,
        o.subtotal,
        COALESCE(o.discount_amount, 0) as discount_total,
        COALESCE(o.tax_amount, 0) as tax_total,
        COALESCE(o.service_total, 0) as service_total,
        COALESCE(o.grand_total, 0) as total_amount,
        COALESCE(o.channel, 'DINE_IN') as channel,
        o.created_at
      FROM "orders" o
      WHERE o.tenant_id = $1 
        AND o.payment_status = 'PAID'
        AND o.created_at >= ($2 AT TIME ZONE 'UTC') 
        AND o.created_at <= ($3 AT TIME ZONE 'UTC')
        ${outletCondition}
      ORDER BY o.created_at DESC;
    `;
    const orders = await this.queryRaw<any>(ordersSql, ...params);

    const orderIds = orders.map((o) => o.id);

    // 2. Fetch order items for these orders
    let orderItems: any[] = [];
    if (orderIds.length > 0) {
      const itemsSql = `
        SELECT 
          oi.id,
          oi.order_id,
          oi.quantity,
          oi.unit_price,
          oi.cost_price,
          oi.subtotal,
          p.id as product_id,
          p.name as product_name,
          pv.sku,
          c.id as category_id,
          COALESCE(c.name, 'Lainnya') as category_name
        FROM "order_items" oi
        JOIN "product_variants" pv ON pv.id = oi.product_variant_id
        JOIN "products" p ON p.id = pv.product_id
        LEFT JOIN "categories" c ON c.id = p.category_id
        WHERE oi.order_id = ANY($1::text[]);
      `;
      orderItems = await this.queryRaw<any>(itemsSql, orderIds);
    }

    // 3. Fetch payment transactions for cash flow breakdown
    let paymentTxs: any[] = [];
    if (orderIds.length > 0) {
      const paymentsSql = `
        SELECT 
          pt.order_id,
          pt.payment_method::text as payment_method,
          pt.amount
        FROM "payment_transactions" pt
        WHERE pt.order_id = ANY($1::text[]) 
          AND pt.status = 'CAPTURED';
      `;
      paymentTxs = await this.queryRaw<any>(paymentsSql, orderIds);
    }

    // Accumulators
    let totalGrossSales = 0;
    let totalDiscounts = 0;
    let totalTax = 0;
    let totalService = 0;
    let totalNetRevenue = 0;
    let totalCOGS = 0;

    let cashSalesTotal = 0;
    let cashSalesCount = 0;
    let qrisSalesTotal = 0;
    let qrisSalesCount = 0;

    const orderCashMap = new Map<string, number>();
    const orderQrisMap = new Map<string, number>();

    for (const pt of paymentTxs) {
      const amt = Number(pt.amount || 0);
      if (pt.payment_method === 'CASH') {
        cashSalesTotal += amt;
        cashSalesCount++;
        orderCashMap.set(pt.order_id, (orderCashMap.get(pt.order_id) || 0) + amt);
      } else if (pt.payment_method === 'QRIS') {
        qrisSalesTotal += amt;
        qrisSalesCount++;
        orderQrisMap.set(pt.order_id, (orderQrisMap.get(pt.order_id) || 0) + amt);
      }
    }

    const productStatsMap = new Map<
      string,
      { id: string; name: string; sku: string; categoryName: string; qtySold: number; revenue: number; cost: number }
    >();

    const categoryStatsMap = new Map<
      string,
      { id: string; name: string; qtySold: number; revenue: number }
    >();

    const orderCogsMap = new Map<string, number>();

    for (const item of orderItems) {
      const itemSubtotal = Number(item.subtotal || 0);
      const itemCost = Number(item.cost_price || 0) * Number(item.quantity || 0);
      const qty = Number(item.quantity || 0);
      const prodId = item.product_id;
      const catId = item.category_id || 'unassigned';

      totalCOGS += itemCost;
      orderCogsMap.set(item.order_id, (orderCogsMap.get(item.order_id) || 0) + itemCost);

      // Product stats
      if (!productStatsMap.has(prodId)) {
        productStatsMap.set(prodId, {
          id: prodId,
          name: item.product_name,
          sku: item.sku,
          categoryName: item.category_name,
          qtySold: 0,
          revenue: 0,
          cost: 0,
        });
      }
      const pStat = productStatsMap.get(prodId)!;
      pStat.qtySold += qty;
      pStat.revenue += itemSubtotal;
      pStat.cost += itemCost;

      // Category stats
      if (!categoryStatsMap.has(catId)) {
        categoryStatsMap.set(catId, {
          id: catId,
          name: item.category_name,
          qtySold: 0,
          revenue: 0,
        });
      }
      const cStat = categoryStatsMap.get(catId)!;
      cStat.qtySold += qty;
      cStat.revenue += itemSubtotal;
    }

    const dailyMap = new Map<
      string,
      { date: string; ordersCount: number; revenue: number; cogs: number; grossProfit: number; cashRevenue: number; qrisRevenue: number }
    >();

    const channelMap = new Map<
      string,
      { channel: string; name: string; amount: number; count: number; percentage: number }
    >();

    const CHANNEL_NAMES: Record<string, string> = {
      DINE_IN: 'Makan di Tempat (Dine In)',
      TAKEAWAY: 'Bawa Pulang (Take Away)',
      DELIVERY: 'Kurir Toko (Delivery)',
      GOFOOD: 'GoFood',
      GRABFOOD: 'GrabFood',
      SHOPEEFOOD: 'ShopeeFood',
      QR_MENU: 'Pesan Mandiri QR Meja',
    };

    // Map order totals and daily trends
    for (const order of orders) {
      const gross = Number(order.subtotal || 0);
      const disc = Number(order.discount_total || 0);
      const tax = Number(order.tax_total || 0);
      const svc = Number(order.service_total || 0);
      const net = Number(order.total_amount || 0);

      totalGrossSales += gross;
      totalDiscounts += disc;
      totalTax += tax;
      totalService += svc;
      totalNetRevenue += net;

      // Track channel
      const ch = order.channel || 'DINE_IN';
      if (!channelMap.has(ch)) {
        channelMap.set(ch, {
          channel: ch,
          name: CHANNEL_NAMES[ch] || ch,
          amount: 0,
          count: 0,
          percentage: 0,
        });
      }
      const chEntry = channelMap.get(ch)!;
      chEntry.amount += net;
      chEntry.count += 1;

      const dateKey = toWibDateStr(new Date(order.created_at));
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: dateKey,
          ordersCount: 0,
          revenue: 0,
          cogs: 0,
          grossProfit: 0,
          cashRevenue: 0,
          qrisRevenue: 0,
        });
      }
      const d = dailyMap.get(dateKey)!;
      const orderCogs = orderCogsMap.get(order.id) || 0;
      d.ordersCount += 1;
      d.revenue += net;
      d.cogs += orderCogs;
      d.grossProfit += (net - tax - orderCogs);
      d.cashRevenue += (orderCashMap.get(order.id) || 0);
      d.qrisRevenue += (orderQrisMap.get(order.id) || 0);
    }

    // 3b. Fetch operating cash expenses (CASH_OUT from shifts)
    const expParams: any[] = [tenantId, start, end];
    let expOutletCondition = '';
    if (targetOutletId) {
      expParams.push(targetOutletId);
      expOutletCondition = `AND cm.outlet_id = $${expParams.length}`;
    }

    const expensesSql = `
      SELECT COALESCE(SUM(cm.amount), 0) as total_expenses
      FROM "cash_movements" cm
      WHERE cm.tenant_id = $1
        AND cm.type = 'CASH_OUT'
        AND cm.created_at >= ($2 AT TIME ZONE 'UTC')
        AND cm.created_at <= ($3 AT TIME ZONE 'UTC')
        ${expOutletCondition};
    `;
    const expenseRows = await this.queryRaw<any>(expensesSql, ...expParams);
    const totalOperatingExpenses = Number(expenseRows[0]?.total_expenses || 0);

    const netSalesExTax = Math.max(0, totalNetRevenue - totalTax);
    const grossProfit = netSalesExTax - totalCOGS;
    const grossProfitMargin =
      netSalesExTax > 0 ? Number(((grossProfit / netSalesExTax) * 100).toFixed(2)) : 0;
    const netOperatingProfit = grossProfit - totalOperatingExpenses;
    const netOperatingProfitMargin =
      netSalesExTax > 0 ? Number(((netOperatingProfit / netSalesExTax) * 100).toFixed(2)) : 0;

    const totalTransactions = orders.length;
    const averageOrderValue =
      totalTransactions > 0 ? Math.round(totalNetRevenue / totalTransactions) : 0;

    // Hourly Distribution & Peak Hour calculation (WIB = UTC + 7)
    const hourlyMap = new Map<number, { ordersCount: number; revenue: number }>();
    for (let h = 0; h < 24; h++) {
      hourlyMap.set(h, { ordersCount: 0, revenue: 0 });
    }

    for (const order of orders) {
      const d = new Date(order.created_at);
      const wibHour = (d.getUTCHours() + 7) % 24;
      const hData = hourlyMap.get(wibHour)!;
      hData.ordersCount += 1;
      hData.revenue += Number(order.total_amount || 0);
    }

    let peakHourNum = 12;
    let peakHourMaxOrders = 0;
    const hourlyDistribution = Array.from(hourlyMap.entries()).map(([hour, val]) => {
      if (val.ordersCount > peakHourMaxOrders) {
        peakHourMaxOrders = val.ordersCount;
        peakHourNum = hour;
      }
      return {
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        ordersCount: val.ordersCount,
        revenue: val.revenue,
      };
    });

    const peakHourLabel = `${String(peakHourNum).padStart(2, '0')}:00 - ${String((peakHourNum + 1) % 24).padStart(2, '0')}:00`;

    const topProducts = Array.from(productStatsMap.values())
      .map((p) => ({
        ...p,
        profit: p.revenue - p.cost,
        profitMargin: p.revenue > 0 ? Number((((p.revenue - p.cost) / p.revenue) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.qtySold - a.qtySold)
      .slice(0, 10);

    let profitHealthStatus: 'SEHAT' | 'WASPADA' | 'KRITIS' = 'SEHAT';
    if (grossProfitMargin < 20) {
      profitHealthStatus = 'KRITIS';
    } else if (grossProfitMargin < 40) {
      profitHealthStatus = 'WASPADA';
    }

    const highMarginChampion =
      topProducts.length > 0
        ? topProducts.reduce((prev, curr) => (curr.profitMargin > prev.profitMargin ? curr : prev)).name
        : undefined;

    const marginKiller =
      topProducts.length > 0
        ? topProducts.reduce((prev, curr) => (curr.profitMargin < prev.profitMargin ? curr : prev)).name
        : undefined;

    // 4. Slow moving items using inventory_balances
    let outletLocId: string | null = null;
    if (targetOutletId) {
      outletLocId = await this.resolveDefaultStorageLocation(tenantId, targetOutletId);
    }

    const smParams: any[] = [tenantId];
    let smLocParam = 'NULL::text';
    if (outletLocId) {
      smParams.push(outletLocId);
      smLocParam = `$${smParams.length}::text`;
    }

    const slowSql = `
      SELECT 
        p.id,
        p.name,
        pv.sku,
        COALESCE(c.name, 'Lainnya') as category_name,
        COALESCE(ib.quantity_on_hand, 0) as current_stock,
        COALESCE(ii.average_cost, 0) as cost_price,
        pv.price as base_price
      FROM "products" p
      JOIN "product_variants" pv ON pv.product_id = p.id AND pv.is_active = true
      LEFT JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id
      LEFT JOIN "categories" c ON c.id = p.category_id
      LEFT JOIN "inventory_balances" ib 
        ON ib.inventory_item_id = ii.id 
        AND ib.storage_location_id = ${smLocParam}
      WHERE p.tenant_id = $1 AND p.is_active = true;
    `;
    const allProductRows = await this.queryRaw<any>(slowSql, ...smParams);

    const slowMovingProducts = allProductRows
      .map((p) => {
        const soldStat = productStatsMap.get(p.id);
        const qtySold = soldStat?.qtySold || 0;
        const currentStock = Number(p.current_stock || 0);
        const costPrice = Number(p.cost_price || 0);
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          categoryName: p.category_name,
          currentStock,
          costPrice,
          basePrice: Number(p.base_price || 0),
          qtySold,
          revenue: soldStat?.revenue || 0,
          deadStockValue: qtySold === 0 ? currentStock * costPrice : 0,
        };
      })
      .filter((p) => p.qtySold <= 2 && p.currentStock > 0)
      .sort((a, b) => a.qtySold - b.qtySold || b.currentStock - a.currentStock)
      .slice(0, 10);

    const salesByCategory = Array.from(categoryStatsMap.values())
      .map((c) => ({
        ...c,
        percentage:
          totalGrossSales > 0 ? Number(((c.revenue / totalGrossSales) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const dailyTrends = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const channelSales = Array.from(channelMap.values())
      .map((c) => ({
        ...c,
        percentage:
          totalNetRevenue > 0 ? Number(((c.amount / totalNetRevenue) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      filter: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        outletId: targetOutletId,
      },
      financialSummary: {
        totalGrossSales,
        totalDiscounts,
        totalService,
        totalTax,
        totalNetRevenue,
        totalCOGS,
        netSalesExTax,
        grossProfit,
        grossProfitMargin,
        totalTransactions,
        averageOrderValue,
        totalOperatingExpenses,
        netOperatingProfit,
        netOperatingProfitMargin,
      },
      cashFlow: {
        cash: {
          amount: cashSalesTotal,
          count: cashSalesCount,
          percentage:
            totalNetRevenue > 0
              ? Number(((cashSalesTotal / totalNetRevenue) * 100).toFixed(2))
              : 0,
        },
        qris: {
          amount: qrisSalesTotal,
          count: qrisSalesCount,
          percentage:
            totalNetRevenue > 0
              ? Number(((qrisSalesTotal / totalNetRevenue) * 100).toFixed(2))
              : 0,
        },
      },
      topProducts,
      slowMovingProducts,
      salesByCategory,
      dailyTrends,
      channelSales,
      hourlyDistribution,
      insights: {
        peakHour: peakHourLabel,
        peakHourOrdersCount: peakHourMaxOrders,
        averageBasketSize: averageOrderValue,
        highMarginChampion,
        marginKiller,
        profitHealthStatus,
      },
    };
  }
}

export const reportReadAdapter = new ReportReadAdapter();
