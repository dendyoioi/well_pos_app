import { prisma } from '../config/prisma';
import { resolveDateRange, toWibDateStr } from '../utils/date.utils';

export interface DateRangeOptions {
  startDate?: string;
  endDate?: string;
  outletId?: string;
}

export interface FinancialPnlDTO {
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    grossSales: number;
    discounts: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
    profitMarginPercent: number;
    tax: number;
    serviceCharge: number;
    grandTotal: number;
    orderCount: number;
    averageOrderValue: number;
  };
  tenderBreakdown: Array<{
    method: string;
    amount: number;
    count: number;
    percentage: number;
  }>;
  dailyTrends: Array<{
    date: string;
    grossSales: number;
    discounts: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
    profitMarginPercent: number;
    orderCount: number;
  }>;
}

export interface ShiftDiscrepancyDTO {
  summary: {
    totalShiftsAudited: number;
    matchCount: number;
    overCount: number;
    shortCount: number;
    totalOverAmount: number;
    totalShortAmount: number;
    netDifference: number;
    discrepancyRatePercent: number;
  };
  shifts: Array<{
    id: string;
    cashierName: string;
    cashierEmail?: string;
    outletName: string;
    startTime: Date;
    endTime: Date | null;
    startingCash: number;
    expectedEnding: number;
    actualEnding: number;
    cashDifference: number;
    status: 'MATCH' | 'OVER' | 'SHORT';
    isSevere: boolean;
    notes?: string | null;
  }>;
}

export interface ProductPerformanceDTO {
  topByVolume: Array<{
    productId: string;
    productName: string;
    sku: string;
    categoryName: string;
    quantitySold: number;
    revenue: number;
  }>;
  topByRevenue: Array<{
    productId: string;
    productName: string;
    sku: string;
    categoryName: string;
    quantitySold: number;
    revenue: number;
    grossProfit: number;
    profitMarginPercent: number;
  }>;
  topByMargin: Array<{
    productId: string;
    productName: string;
    sku: string;
    categoryName: string;
    quantitySold: number;
    revenue: number;
    cogs: number;
    grossProfit: number;
    profitMarginPercent: number;
  }>;
  categoryBreakdown: Array<{
    categoryName: string;
    quantitySold: number;
    revenue: number;
    percentage: number;
  }>;
}

export interface DeadStockDTO {
  summary: {
    totalDeadStockItems: number;
    totalFrozenStockQty: number;
    totalFrozenCapital: number;
  };
  items: Array<{
    itemId: string;
    itemCode: string;
    name: string;
    canonicalUom: string;
    averageCost: number;
    quantityOnHand: number;
    frozenCapital: number;
    lastSoldDate: Date | null;
  }>;
}

export class AnalyticsService {
  /**
   * Helper: Resolves start and end Date objects in WIB (+07:00)
   */
  private resolveDates(startDate?: string, endDate?: string): { start: Date; end: Date } {
    return resolveDateRange(startDate, endDate);
  }

  /**
   * Task 9.1: Real-Time Gross Profit & COGS Calculator
   */
  async getFinancialPnl(tenantId: string, options: DateRangeOptions): Promise<FinancialPnlDTO> {
    const { start, end } = this.resolveDates(options.startDate, options.endDate);
    const targetOutletId = options.outletId === 'ALL' ? undefined : options.outletId;

    // 1. Fetch orders
    const params: any[] = [tenantId, start, end];
    let outletClause = '';
    if (targetOutletId) {
      params.push(targetOutletId);
      outletClause = `AND o.outlet_id = $${params.length}`;
    }

    const ordersSql = `
      SELECT 
        o.id,
        COALESCE(o.subtotal, 0) as subtotal,
        COALESCE(o.discount_amount, 0) as discount_amount,
        COALESCE(o.tax_amount, 0) as tax_amount,
        COALESCE(o.service_charge, 0) as service_charge,
        COALESCE(o.grand_total, 0) as grand_total,
        o.created_at
      FROM "orders" o
      WHERE o.tenant_id = $1
        AND o.payment_status = 'PAID'
        AND o.created_at >= $2
        AND o.created_at <= $3
        ${outletClause}
      ORDER BY o.created_at ASC;
    `;
    const orders: any[] = await prisma.$queryRawUnsafe(ordersSql, ...params);
    const orderIds = orders.map((o) => o.id);

    // 2. Fetch order items (including cost_price snapshot)
    let orderItems: any[] = [];
    if (orderIds.length > 0) {
      const itemsSql = `
        SELECT 
          oi.id,
          oi.order_id,
          oi.quantity,
          oi.unit_price,
          oi.cost_price,
          oi.discount_amount,
          oi.subtotal
        FROM "order_items" oi
        WHERE oi.order_id = ANY($1::text[]);
      `;
      orderItems = await prisma.$queryRawUnsafe(itemsSql, orderIds);
    }

    // 3. Fetch payment transactions
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
      paymentTxs = await prisma.$queryRawUnsafe(paymentsSql, orderIds);
    }

    // Accumulators
    let totalGrossSales = 0;
    let totalDiscounts = 0;
    let totalTax = 0;
    let totalService = 0;
    let totalGrandTotal = 0;
    let totalCOGS = 0;

    // Daily breakdown map
    const dailyMap = new Map<
      string,
      {
        date: string;
        grossSales: number;
        discounts: number;
        netSales: number;
        cogs: number;
        grossProfit: number;
        profitMarginPercent: number;
        orderCount: number;
      }
    >();

    // Map order items cost to orderId
    const orderCogsMap = new Map<string, number>();
    for (const item of orderItems) {
      const cogs = Number(item.cost_price || 0) * Number(item.quantity || 0);
      totalCOGS += cogs;
      orderCogsMap.set(item.order_id, (orderCogsMap.get(item.order_id) || 0) + cogs);
    }

    for (const order of orders) {
      const subtotal = Number(order.subtotal || 0);
      const discount = Number(order.discount_amount || 0);
      const tax = Number(order.tax_amount || 0);
      const service = Number(order.service_charge || 0);
      const grand = Number(order.grand_total || 0);
      const net = subtotal - discount;
      const cogs = orderCogsMap.get(order.id) || 0;
      const profit = net - cogs;

      totalGrossSales += subtotal;
      totalDiscounts += discount;
      totalTax += tax;
      totalService += service;
      totalGrandTotal += grand;

      const dateKey = toWibDateStr(new Date(order.created_at));
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: dateKey,
          grossSales: 0,
          discounts: 0,
          netSales: 0,
          cogs: 0,
          grossProfit: 0,
          profitMarginPercent: 0,
          orderCount: 0,
        });
      }
      const day = dailyMap.get(dateKey)!;
      day.grossSales += subtotal;
      day.discounts += discount;
      day.netSales += net;
      day.cogs += cogs;
      day.grossProfit += profit;
      day.orderCount += 1;
    }

    // Calculate profit margins for daily trends
    const dailyTrends = Array.from(dailyMap.values()).map((d) => ({
      ...d,
      profitMarginPercent: d.netSales > 0 ? Number(((d.grossProfit / d.netSales) * 100).toFixed(2)) : 0,
    }));

    const totalNetSales = totalGrossSales - totalDiscounts;
    const totalGrossProfit = totalNetSales - totalCOGS;
    const overallMargin =
      totalNetSales > 0 ? Number(((totalGrossProfit / totalNetSales) * 100).toFixed(2)) : 0;
    const averageOrderValue =
      orders.length > 0 ? Math.round(totalGrandTotal / orders.length) : 0;

    // Tender breakdown
    const tenderMap = new Map<string, { amount: number; count: number }>();
    let totalTenderAmount = 0;
    for (const pt of paymentTxs) {
      const amt = Number(pt.amount || 0);
      const method = pt.payment_method || 'CASH';
      if (!tenderMap.has(method)) {
        tenderMap.set(method, { amount: 0, count: 0 });
      }
      const entry = tenderMap.get(method)!;
      entry.amount += amt;
      entry.count += 1;
      totalTenderAmount += amt;
    }

    const tenderBreakdown = Array.from(tenderMap.entries()).map(([method, data]) => ({
      method,
      amount: data.amount,
      count: data.count,
      percentage:
        totalTenderAmount > 0
          ? Number(((data.amount / totalTenderAmount) * 100).toFixed(1))
          : 0,
    }));

    return {
      period: {
        startDate: toWibDateStr(start),
        endDate: toWibDateStr(end),
      },
      summary: {
        grossSales: totalGrossSales,
        discounts: totalDiscounts,
        netSales: totalNetSales,
        cogs: totalCOGS,
        grossProfit: totalGrossProfit,
        profitMarginPercent: overallMargin,
        tax: totalTax,
        serviceCharge: totalService,
        grandTotal: totalGrandTotal,
        orderCount: orders.length,
        averageOrderValue,
      },
      tenderBreakdown,
      dailyTrends,
    };
  }

  /**
   * Task 9.2: Cashier Discrepancy & Shift Audit Dashboard
   */
  async getShiftDiscrepancies(
    tenantId: string,
    options: DateRangeOptions
  ): Promise<ShiftDiscrepancyDTO> {
    const { start, end } = this.resolveDates(options.startDate, options.endDate);
    const targetOutletId = options.outletId === 'ALL' ? undefined : options.outletId;

    const params: any[] = [tenantId, start, end];
    let outletClause = '';
    if (targetOutletId) {
      params.push(targetOutletId);
      outletClause = `AND s.outlet_id = $${params.length}`;
    }

    const sql = `
      SELECT 
        s.id,
        s.start_time as "startTime",
        s.end_time as "endTime",
        COALESCE(s.starting_cash, 0) as "startingCash",
        COALESCE(s.expected_cash, 0) as "expectedEnding",
        COALESCE(s.actual_cash, 0) as "actualEnding",
        COALESCE(s.difference, 0) as "cashDifference",
        s.notes,
        u.name as "cashierName",
        u.email as "cashierEmail",
        o.name as "outletName"
      FROM "shifts" s
      JOIN "users" u ON u.id = s.cashier_id
      JOIN "outlets" o ON o.id = s.outlet_id
      WHERE s.tenant_id = $1
        AND s.status = 'CLOSED'
        AND s.start_time >= $2
        AND s.start_time <= $3
        ${outletClause}
      ORDER BY s.start_time DESC;
    `;

    const rawShifts: any[] = await prisma.$queryRawUnsafe(sql, ...params);

    let matchCount = 0;
    let overCount = 0;
    let shortCount = 0;
    let totalOverAmount = 0;
    let totalShortAmount = 0;

    const shifts = rawShifts.map((s) => {
      const diff = Number(s.cashDifference || 0);
      let status: 'MATCH' | 'OVER' | 'SHORT' = 'MATCH';
      if (diff > 0) {
        status = 'OVER';
        overCount++;
        totalOverAmount += diff;
      } else if (diff < 0) {
        status = 'SHORT';
        shortCount++;
        totalShortAmount += Math.abs(diff);
      } else {
        matchCount++;
      }

      // Flag severe discrepancies: >= Rp 50.000 or negative >= Rp 20.000
      const isSevere = Math.abs(diff) >= 50000;

      return {
        id: s.id,
        cashierName: s.cashierName,
        cashierEmail: s.cashierEmail,
        outletName: s.outletName,
        startTime: s.startTime,
        endTime: s.endTime,
        startingCash: Number(s.startingCash || 0),
        expectedEnding: Number(s.expectedEnding || 0),
        actualEnding: Number(s.actualEnding || 0),
        cashDifference: diff,
        status,
        isSevere,
        notes: s.notes,
      };
    });

    const totalAudited = shifts.length;
    const discrepancyCount = overCount + shortCount;
    const discrepancyRatePercent =
      totalAudited > 0 ? Number(((discrepancyCount / totalAudited) * 100).toFixed(1)) : 0;
    const netDifference = totalOverAmount - totalShortAmount;

    return {
      summary: {
        totalShiftsAudited: totalAudited,
        matchCount,
        overCount,
        shortCount,
        totalOverAmount,
        totalShortAmount,
        netDifference,
        discrepancyRatePercent,
      },
      shifts,
    };
  }

  /**
   * Task 9.3: Sales Performance & Product Matrix BI Charts (Pareto 80/20)
   */
  async getProductPerformance(
    tenantId: string,
    options: DateRangeOptions & { limit?: number }
  ): Promise<ProductPerformanceDTO> {
    const { start, end } = this.resolveDates(options.startDate, options.endDate);
    const targetOutletId = options.outletId === 'ALL' ? undefined : options.outletId;
    const limit = options.limit || 10;

    const params: any[] = [tenantId, start, end];
    let outletClause = '';
    if (targetOutletId) {
      params.push(targetOutletId);
      outletClause = `AND o.outlet_id = $${params.length}`;
    }

    const sql = `
      SELECT 
        p.id as "productId",
        p.name as "productName",
        COALESCE(pv.sku, 'NO-SKU') as "sku",
        COALESCE(c.name, 'Uncategorized') as "categoryName",
        SUM(oi.quantity)::int as "quantitySold",
        SUM(oi.subtotal)::numeric as "revenue",
        SUM(oi.cost_price * oi.quantity)::numeric as "cogs"
      FROM "order_items" oi
      JOIN "orders" o ON o.id = oi.order_id
      JOIN "product_variants" pv ON pv.id = oi.product_variant_id
      JOIN "products" p ON p.id = pv.product_id
      LEFT JOIN "categories" c ON c.id = p.category_id
      WHERE o.tenant_id = $1
        AND o.payment_status = 'PAID'
        AND o.created_at >= $2
        AND o.created_at <= $3
        ${outletClause}
      GROUP BY p.id, p.name, pv.sku, c.name;
    `;

    const rawRows: any[] = await prisma.$queryRawUnsafe(sql, ...params);

    const enriched = rawRows.map((r) => {
      const revenue = Number(r.revenue || 0);
      const cogs = Number(r.cogs || 0);
      const grossProfit = revenue - cogs;
      const profitMarginPercent =
        revenue > 0 ? Number(((grossProfit / revenue) * 100).toFixed(2)) : 0;

      return {
        productId: r.productId,
        productName: r.productName,
        sku: r.sku,
        categoryName: r.categoryName,
        quantitySold: Number(r.quantitySold || 0),
        revenue,
        cogs,
        grossProfit,
        profitMarginPercent,
      };
    });

    // Top by Volume
    const topByVolume = [...enriched]
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, limit)
      .map(({ productId, productName, sku, categoryName, quantitySold, revenue }) => ({
        productId,
        productName,
        sku,
        categoryName,
        quantitySold,
        revenue,
      }));

    // Top by Revenue
    const topByRevenue = [...enriched]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)
      .map(
        ({
          productId,
          productName,
          sku,
          categoryName,
          quantitySold,
          revenue,
          grossProfit,
          profitMarginPercent,
        }) => ({
          productId,
          productName,
          sku,
          categoryName,
          quantitySold,
          revenue,
          grossProfit,
          profitMarginPercent,
        })
      );

    // Top by Margin
    const topByMargin = [...enriched]
      .filter((a) => a.revenue > 0)
      .sort((a, b) => b.profitMarginPercent - a.profitMarginPercent || b.grossProfit - a.grossProfit)
      .slice(0, limit);

    // Category Breakdown
    const catMap = new Map<string, { qty: number; rev: number }>();
    let grandRevenue = 0;
    for (const r of enriched) {
      if (!catMap.has(r.categoryName)) {
        catMap.set(r.categoryName, { qty: 0, rev: 0 });
      }
      const cat = catMap.get(r.categoryName)!;
      cat.qty += r.quantitySold;
      cat.rev += r.revenue;
      grandRevenue += r.revenue;
    }

    const categoryBreakdown = Array.from(catMap.entries())
      .map(([categoryName, val]) => ({
        categoryName,
        quantitySold: val.qty,
        revenue: val.rev,
        percentage:
          grandRevenue > 0 ? Number(((val.rev / grandRevenue) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      topByVolume,
      topByRevenue,
      topByMargin,
      categoryBreakdown,
    };
  }

  /**
   * Task 9.3: Dead Stock Detection & Frozen Capital Valuation
   * Identifies items that had ZERO sales in the period and computes locked inventory value.
   */
  async getDeadStock(
    tenantId: string,
    options: { daysThreshold?: number; outletId?: string }
  ): Promise<DeadStockDTO> {
    const days = options.daysThreshold || 30;
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const targetOutletId = options.outletId === 'ALL' ? undefined : options.outletId;

    const params: any[] = [tenantId, sinceDate];
    let outletFilter = '';
    if (targetOutletId) {
      params.push(targetOutletId);
      outletFilter = `AND sl.outlet_id = $${params.length}`;
    }

    const sql = `
      SELECT 
        ii.id as "itemId",
        ii.item_code as "itemCode",
        ii.name as "name",
        ii.canonical_uom as "canonicalUom",
        COALESCE(ii.average_cost, 0)::numeric as "averageCost",
        COALESCE(SUM(ib.quantity_on_hand), 0)::numeric as "quantityOnHand",
        MAX(o.created_at) as "lastSoldDate"
      FROM "inventory_items" ii
      LEFT JOIN "storage_locations" sl ON sl.tenant_id = ii.tenant_id ${outletFilter}
      LEFT JOIN "inventory_balances" ib ON ib.inventory_item_id = ii.id AND ib.storage_location_id = sl.id
      LEFT JOIN "product_variants" pv ON pv.inventory_item_id = ii.id
      LEFT JOIN "order_items" oi ON oi.product_variant_id = pv.id
      LEFT JOIN "orders" o ON o.id = oi.order_id AND o.payment_status = 'PAID'
      WHERE ii.tenant_id = $1
        AND ii.is_active = true
      GROUP BY ii.id, ii.item_code, ii.name, ii.canonical_uom, ii.average_cost
      HAVING MAX(o.created_at) IS NULL OR MAX(o.created_at) < $2
      ORDER BY (COALESCE(SUM(ib.quantity_on_hand), 0) * COALESCE(ii.average_cost, 0)) DESC;
    `;

    const rows: any[] = await prisma.$queryRawUnsafe(sql, ...params);

    let totalFrozenStockQty = 0;
    let totalFrozenCapital = 0;

    const items = rows.map((r) => {
      const qty = Number(r.quantityOnHand || 0);
      const cost = Number(r.averageCost || 0);
      const frozenCapital = qty * cost;

      totalFrozenStockQty += qty;
      totalFrozenCapital += frozenCapital;

      return {
        itemId: r.itemId,
        itemCode: r.itemCode,
        name: r.name,
        canonicalUom: r.canonicalUom,
        averageCost: cost,
        quantityOnHand: qty,
        frozenCapital,
        lastSoldDate: r.lastSoldDate ? new Date(r.lastSoldDate) : null,
      };
    });

    return {
      summary: {
        totalDeadStockItems: items.length,
        totalFrozenStockQty,
        totalFrozenCapital,
      },
      items,
    };
  }

  /**
   * Task 9.4: Multi-Format CSV Export Engine (Excel & Google Sheets Compatible)
   */
  async exportCsv(
    type: 'financial' | 'products' | 'shifts' | 'dead-stock',
    tenantId: string,
    options: DateRangeOptions & { daysThreshold?: number }
  ): Promise<{ filename: string; csvContent: string }> {
    const BOM = '\uFEFF'; // UTF-8 Byte Order Mark for Excel
    let filename = '';
    let rows: string[][] = [];

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    if (type === 'financial') {
      filename = `Laporan_Keuangan_P_and_L_${new Date().toISOString().slice(0, 10)}.csv`;
      const data = await this.getFinancialPnl(tenantId, options);

      rows.push(['LAPORAN LABA RUGI (PROFIT & LOSS) - WELL POS']);
      rows.push(['Periode', `${data.period.startDate} s.d ${data.period.endDate}`]);
      rows.push([]);
      rows.push(['RINGKASAN EKSEKUTIF']);
      rows.push(['Penjualan Kotor (Gross Sales)', `Rp ${data.summary.grossSales.toLocaleString('id-ID')}`]);
      rows.push(['Potongan / Diskon', `Rp ${data.summary.discounts.toLocaleString('id-ID')}`]);
      rows.push(['Penjualan Bersih (Net Sales)', `Rp ${data.summary.netSales.toLocaleString('id-ID')}`]);
      rows.push(['Harga Pokok Penjualan (COGS / HPP)', `Rp ${data.summary.cogs.toLocaleString('id-ID')}`]);
      rows.push(['Laba Kotor (Gross Profit)', `Rp ${data.summary.grossProfit.toLocaleString('id-ID')}`]);
      rows.push(['Margin Laba Kotor', `${data.summary.profitMarginPercent}%`]);
      rows.push(['Pajak Restoran (PB1 / PPN)', `Rp ${data.summary.tax.toLocaleString('id-ID')}`]);
      rows.push(['Service Charge', `Rp ${data.summary.serviceCharge.toLocaleString('id-ID')}`]);
      rows.push(['Grand Total Pendapatan', `Rp ${data.summary.grandTotal.toLocaleString('id-ID')}`]);
      rows.push(['Total Transaksi', `${data.summary.orderCount}`]);
      rows.push(['Rata-Rata Belanja (AOV)', `Rp ${data.summary.averageOrderValue.toLocaleString('id-ID')}`]);
      rows.push([]);
      rows.push(['TREN LABA RUGI HARIAN']);
      rows.push([
        'Tanggal',
        'Penjualan Kotor',
        'Diskon',
        'Penjualan Bersih',
        'HPP (COGS)',
        'Laba Kotor',
        'Margin (%)',
        'Jumlah Pesanan',
      ]);

      for (const d of data.dailyTrends) {
        rows.push([
          d.date,
          String(d.grossSales),
          String(d.discounts),
          String(d.netSales),
          String(d.cogs),
          String(d.grossProfit),
          `${d.profitMarginPercent}%`,
          String(d.orderCount),
        ]);
      }
    } else if (type === 'products') {
      filename = `Laporan_Performa_Produk_${new Date().toISOString().slice(0, 10)}.csv`;
      const data = await this.getProductPerformance(tenantId, { ...options, limit: 100 });

      rows.push(['LAPORAN PERFORMA PENJUALAN PRODUK - WELL POS']);
      rows.push([]);
      rows.push([
        'SKU',
        'Nama Produk',
        'Kategori',
        'Kuantitas Terjual',
        'Total Pendapatan (Rp)',
        'Total HPP (Rp)',
        'Laba Kotor (Rp)',
        'Margin (%)',
      ]);

      for (const p of data.topByRevenue) {
        rows.push([
          p.sku,
          p.productName,
          p.categoryName,
          String(p.quantitySold),
          String(p.revenue),
          String(p.revenue - p.grossProfit),
          String(p.grossProfit),
          `${p.profitMarginPercent}%`,
        ]);
      }
    } else if (type === 'shifts') {
      filename = `Laporan_Rekap_Shift_Kasir_${new Date().toISOString().slice(0, 10)}.csv`;
      const data = await this.getShiftDiscrepancies(tenantId, options);

      rows.push(['AUDIT REKAPITULASI SHIFT & SELISIH KAS KASIR - WELL POS']);
      rows.push(['Total Shift Diaudit', String(data.summary.totalShiftsAudited)]);
      rows.push(['Total Shift Pas (Match)', String(data.summary.matchCount)]);
      rows.push(['Total Shift Lebih (Over)', String(data.summary.overCount)]);
      rows.push(['Total Shift Kurang (Short)', String(data.summary.shortCount)]);
      rows.push(['Total Uang Lebih', `Rp ${data.summary.totalOverAmount.toLocaleString('id-ID')}`]);
      rows.push(['Total Uang Kurang', `Rp ${data.summary.totalShortAmount.toLocaleString('id-ID')}`]);
      rows.push(['Selisih Bersih (Net Variance)', `Rp ${data.summary.netDifference.toLocaleString('id-ID')}`]);
      rows.push(['Tingkat Anomali Selisih', `${data.summary.discrepancyRatePercent}%`]);
      rows.push([]);
      rows.push([
        'ID Shift',
        'Kasir',
        'Outlet',
        'Waktu Mulai',
        'Waktu Selesai',
        'Kas Awal (Rp)',
        'Kas Diharapkan (Rp)',
        'Kas Fisik Aktual (Rp)',
        'Selisih Kas (Rp)',
        'Status',
        'Anomali Berat',
        'Catatan',
      ]);

      for (const s of data.shifts) {
        rows.push([
          s.id,
          s.cashierName,
          s.outletName,
          new Date(s.startTime).toLocaleString('id-ID'),
          s.endTime ? new Date(s.endTime).toLocaleString('id-ID') : '-',
          String(s.startingCash),
          String(s.expectedEnding),
          String(s.actualEnding),
          String(s.cashDifference),
          s.status,
          s.isSevere ? 'YA' : 'TIDAK',
          s.notes || '',
        ]);
      }
    } else if (type === 'dead-stock') {
      filename = `Laporan_Dead_Stock_Inventory_${new Date().toISOString().slice(0, 10)}.csv`;
      const data = await this.getDeadStock(tenantId, options);

      rows.push(['LAPORAN DEAD STOCK & MODAL KERJA TERTINGGAL - WELL POS']);
      rows.push(['Ambang Batas Waktu', `${options.daysThreshold || 30} Hari Terakhir Tanpa Penjualan`]);
      rows.push(['Jumlah Item Dead Stock', String(data.summary.totalDeadStockItems)]);
      rows.push(['Total Unit Fisik Mengendap', String(data.summary.totalFrozenStockQty)]);
      rows.push(['Total Modal Kerja Tertahan', `Rp ${data.summary.totalFrozenCapital.toLocaleString('id-ID')}`]);
      rows.push([]);
      rows.push([
        'Kode Item',
        'Nama Barang Persediaan',
        'Satuan (UOM)',
        'HPP Rata-Rata (Rp)',
        'Sisa Stok Fisik',
        'Modal Tertahan (Rp)',
        'Terakhir Terjual',
      ]);

      for (const item of data.items) {
        rows.push([
          item.itemCode,
          item.name,
          item.canonicalUom,
          String(item.averageCost),
          String(item.quantityOnHand),
          String(item.frozenCapital),
          item.lastSoldDate ? item.lastSoldDate.toISOString().slice(0, 10) : 'Belum Pernah Terjual',
        ]);
      }
    }

    const csvContent =
      BOM +
      rows
        .map((row) => row.map(escapeCsv).join(','))
        .join('\r\n');

    return { filename, csvContent };
  }
}

export const analyticsService = new AnalyticsService();
