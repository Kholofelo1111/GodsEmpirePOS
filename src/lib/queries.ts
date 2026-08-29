import { db } from "@/db";
import {
  products,
  sales,
  saleItems,
  customers,
  inventoryLogs,
  users,
  settings,
} from "@/db/schema";
import { sql, gte, lt, desc, eq, asc, and } from "drizzle-orm";

/** Server-side data access shared by dashboard, reports and inventory pages. */

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface DashboardStats {
  todayTransactions: number;
  todayRevenue: number;
  todayProfit: number;
  stockValue: number;
  stockRetailValue: number;
  productCount: number;
  customerCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalOutstandingBalance: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const since = startOfToday();

  const [todayRow] = await db
    .select({
      revenue: sql<string>`COALESCE(SUM(${sales.total}), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(sales)
    .where(gte(sales.createdAt, since));

  const [profitRow] = await db
    .select({
      profit: sql<string>`COALESCE(SUM((${saleItems.unitPrice} - ${products.costPrice}) * ${saleItems.quantity}), 0)`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(gte(sales.createdAt, since));

  const [stockRow] = await db
    .select({
      cost: sql<string>`COALESCE(SUM(${products.costPrice} * ${products.stock}), 0)`,
      retail: sql<string>`COALESCE(SUM(${products.sellingPrice} * ${products.stock}), 0)`,
      total: sql<number>`COUNT(*)::int`,
      low: sql<number>`COUNT(*) FILTER (WHERE ${products.stock} > 0 AND ${products.stock} <= ${products.minStockLevel})::int`,
      out: sql<number>`COUNT(*) FILTER (WHERE ${products.stock} <= 0)::int`,
    })
    .from(products)
    .where(eq(products.isActive, true));

  const [custRow] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
      debt: sql<string>`COALESCE(SUM(${customers.outstandingBalance}), 0)`,
    })
    .from(customers);

  return {
    todayTransactions: todayRow?.count ?? 0,
    todayRevenue: Number(todayRow?.revenue ?? 0),
    todayProfit: Number(profitRow?.profit ?? 0),
    stockValue: Number(stockRow?.cost ?? 0),
    stockRetailValue: Number(stockRow?.retail ?? 0),
    productCount: stockRow?.total ?? 0,
    lowStockCount: stockRow?.low ?? 0,
    outOfStockCount: stockRow?.out ?? 0,
    customerCount: custRow?.count ?? 0,
    totalOutstandingBalance: Number(custRow?.debt ?? 0),
  };
}

export async function getCustomerActivityStats() {
  const since = startOfToday();

  const [todayRow] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${sales.customerId})::int` })
    .from(sales)
    .where(gte(sales.createdAt, since));

  const recentCustomers = await db
    .select({
      id: customers.id,
      name: customers.name,
      isWalkIn: customers.isWalkIn,
      lastVisitAt: customers.lastVisitAt,
      visitCount: customers.visitCount,
    })
    .from(customers)
    .where(sql`${customers.lastVisitAt} IS NOT NULL`)
    .orderBy(desc(customers.lastVisitAt))
    .limit(6);

  const mostActiveCustomers = await db
    .select({
      id: customers.id,
      name: customers.name,
      isWalkIn: customers.isWalkIn,
      visitCount: customers.visitCount,
      loyaltyPoints: customers.loyaltyPoints,
    })
    .from(customers)
    .where(sql`${customers.visitCount} > 0`)
    .orderBy(desc(customers.visitCount))
    .limit(6);

  return {
    todayCustomers: todayRow?.count ?? 0,
    recentCustomers,
    mostActiveCustomers,
  };
}

export async function getRecentSales(limit = 6) {
  return db
    .select({
      id: sales.id,
      receiptNumber: sales.receiptNumber,
      total: sales.total,
      paymentMethod: sales.paymentMethod,
      createdAt: sales.createdAt,
      cashier: users.fullName,
      itemCount: sql<number>`(SELECT COALESCE(SUM(si.quantity), 0)::int FROM sale_items si WHERE si.sale_id = ${sales.id})`,
    })
    .from(sales)
    .leftJoin(users, eq(sales.userId, users.id))
    .orderBy(desc(sales.createdAt))
    .limit(limit);
}

export async function getLowStockProducts(limit = 6) {
  return db
    .select()
    .from(products)
    .where(sql`${products.isActive} = true AND ${products.stock} <= ${products.minStockLevel}`)
    .orderBy(asc(products.stock))
    .limit(limit);
}

/* ------------------------------- reports -------------------------------- */

export interface PeriodSummary {
  revenue: number;
  profit: number;
  transactions: number;
  itemsSold: number;
  averageBasket: number;
}

export async function getPeriodSummary(since: Date): Promise<PeriodSummary> {
  const [row] = await db
    .select({
      revenue: sql<string>`COALESCE(SUM(${sales.total}), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(sales)
    .where(gte(sales.createdAt, since));

  const [itemRow] = await db
    .select({
      profit: sql<string>`COALESCE(SUM((${saleItems.unitPrice} - ${products.costPrice}) * ${saleItems.quantity}), 0)`,
      items: sql<number>`COALESCE(SUM(${saleItems.quantity}), 0)::int`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(gte(sales.createdAt, since));

  const revenue = Number(row?.revenue ?? 0);
  const transactions = row?.count ?? 0;

  return {
    revenue,
    profit: Number(itemRow?.profit ?? 0),
    transactions,
    itemsSold: itemRow?.items ?? 0,
    averageBasket: transactions > 0 ? revenue / transactions : 0,
  };
}

export async function getDailyTrend(days: number) {
  const rows = await db
    .select({
      day: sql<string>`to_char(${sales.createdAt}, 'YYYY-MM-DD')`,
      total: sql<string>`COALESCE(SUM(${sales.total}), 0)`,
    })
    .from(sales)
    .where(gte(sales.createdAt, daysAgo(days - 1)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const map = new Map(rows.map((r) => [r.day, Number(r.total)]));
  const out: { day: string; label: string; total: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({
      day: key,
      label: d.toLocaleDateString("en-ZA", { weekday: "short" }),
      total: map.get(key) ?? 0,
    });
  }
  return out;
}

export async function getBestSellers(since: Date, limit = 5) {
  return db
    .select({
      productId: saleItems.productId,
      name: products.name,
      quantity: sql<number>`SUM(${saleItems.quantity})::int`,
      revenue: sql<string>`SUM(${saleItems.totalPrice})`,
    })
    .from(saleItems)
    .innerJoin(products, eq(saleItems.productId, products.id))
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(gte(sales.createdAt, since))
    .groupBy(saleItems.productId, products.name)
    .orderBy(desc(sql`SUM(${saleItems.quantity})`))
    .limit(limit);
}

export async function getSlowMovers(since: Date, limit = 5) {
  // Left-join sales that fall inside the period so products with no sales
  // still appear with a zero count.
  const soldExpr = sql<number>`COALESCE(SUM(CASE WHEN ${sales.id} IS NOT NULL THEN ${saleItems.quantity} ELSE 0 END), 0)::int`;

  return db
    .select({
      id: products.id,
      name: products.name,
      stock: products.stock,
      sold: soldExpr,
    })
    .from(products)
    .leftJoin(saleItems, eq(saleItems.productId, products.id))
    .leftJoin(sales, and(eq(sales.id, saleItems.saleId), gte(sales.createdAt, since)))
    .where(and(eq(products.isActive, true), sql`${products.stock} > 0`))
    .groupBy(products.id, products.name, products.stock)
    .orderBy(asc(soldExpr), desc(products.stock))
    .limit(limit);
}

export async function getRecentMovements(limit = 20) {
  return db
    .select({
      id: inventoryLogs.id,
      productName: products.name,
      movementType: inventoryLogs.movementType,
      quantity: inventoryLogs.quantity,
      previousStock: inventoryLogs.previousStock,
      newStock: inventoryLogs.newStock,
      reference: inventoryLogs.reference,
      createdAt: inventoryLogs.createdAt,
    })
    .from(inventoryLogs)
    .leftJoin(products, eq(inventoryLogs.productId, products.id))
    .orderBy(desc(inventoryLogs.createdAt))
    .limit(limit);
}

/* ------------------------------- settings -------------------------------- */

export interface BusinessInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  vatRate: number;
  receiptFooter: string;
  logoUrl?: string;
}

export const DEFAULT_BUSINESS: BusinessInfo = {
  name: "God's Empire",
  address: "123 Main Street, Johannesburg, 2001",
  phone: "+27 11 123 4567",
  email: "info@godsempire.co.za",
  currency: "ZAR",
  vatRate: 15,
  receiptFooter: "Thank you for shopping at God's Empire!",
  logoUrl: "",
};

export async function getBusinessInfo(): Promise<BusinessInfo> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, "business_info"));
    if (!row) return DEFAULT_BUSINESS;
    return { ...DEFAULT_BUSINESS, ...(row.value as Partial<BusinessInfo>) };
  } catch {
    return DEFAULT_BUSINESS;
  }
}

export interface ExpirySettings {
  /** Days before expiryDate that a product should count as "Expiring Soon". */
  warningDays: number;
}

// Default warning period of 30 days ("1 month before expiry"), per the
// requested example. Stored the same way as business_info so it can later
// be exposed as a configurable setting from the same Settings screen.
export const DEFAULT_EXPIRY_SETTINGS: ExpirySettings = {
  warningDays: 30,
};

export async function getExpirySettings(): Promise<ExpirySettings> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, "expiry_warning"));
    if (!row) return DEFAULT_EXPIRY_SETTINGS;
    return { ...DEFAULT_EXPIRY_SETTINGS, ...(row.value as Partial<ExpirySettings>) };
  } catch {
    return DEFAULT_EXPIRY_SETTINGS;
  }
}

export interface StaffPerformance {
  userId: number;
  totalSales: number;
  totalRevenue: number;
  todaySales: number;
  todayRevenue: number;
}

/**
 * One grouped query for all-time totals and one for today's totals — not a
 * per-staff-member query loop — so this stays cheap regardless of headcount.
 * Keyed by sales.userId, which is how sales are already linked to the
 * staff member who made them (no separate "cashier" concept/table exists).
 */
export async function getStaffPerformance(): Promise<Map<number, StaffPerformance>> {
  const since = startOfToday();

  const totals = await db
    .select({
      userId: sales.userId,
      count: sql<number>`COUNT(*)::int`,
      revenue: sql<string>`COALESCE(SUM(${sales.total}), 0)`,
    })
    .from(sales)
    .groupBy(sales.userId);

  const todayTotals = await db
    .select({
      userId: sales.userId,
      count: sql<number>`COUNT(*)::int`,
      revenue: sql<string>`COALESCE(SUM(${sales.total}), 0)`,
    })
    .from(sales)
    .where(gte(sales.createdAt, since))
    .groupBy(sales.userId);

  const result = new Map<number, StaffPerformance>();

  for (const row of totals) {
    result.set(row.userId, {
      userId: row.userId,
      totalSales: row.count,
      totalRevenue: Number(row.revenue),
      todaySales: 0,
      todayRevenue: 0,
    });
  }

  for (const row of todayTotals) {
    const existing = result.get(row.userId);
    if (existing) {
      existing.todaySales = row.count;
      existing.todayRevenue = Number(row.revenue);
    } else {
      result.set(row.userId, {
        userId: row.userId,
        totalSales: 0,
        totalRevenue: 0,
        todaySales: row.count,
        todayRevenue: Number(row.revenue),
      });
    }
  }

  return result;
}

export interface CashUpPayment {
  method: string;
  amount: number;
}

export interface CashUpProductSold {
  productId: number;
  name: string;
  quantity: number;
  revenue: number;
}

export interface CashUpCashierRow {
  userId: number;
  name: string;
  role: string;
  transactions: number;
  revenue: number;
  cash: number;
  card: number;
  other: number;
}

export interface CashUpDay {
  total: number;
  transactions: number;
  payments: CashUpPayment[];
  productsSold: CashUpProductSold[];
  cashierBreakdown: CashUpCashierRow[];
}

/**
 * Register/cash-up summary for a single calendar day (server local time,
 * consistent with startOfToday()/getPeriodSummary() elsewhere in this
 * file). Reuses sales/saleItems/users directly — no separate cash-up
 * table — and uses grouped SQL rather than a query per cashier/product.
 */
export async function getCashUpDay(dateStr: string): Promise<CashUpDay> {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const range = and(gte(sales.createdAt, start), lt(sales.createdAt, end));

  const [totals] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${sales.total}), 0)`,
      transactions: sql<number>`COUNT(*)::int`,
    })
    .from(sales)
    .where(range);

  const paymentRows = await db
    .select({
      method: sales.paymentMethod,
      amount: sql<string>`COALESCE(SUM(${sales.total}), 0)`,
    })
    .from(sales)
    .where(range)
    .groupBy(sales.paymentMethod);

  const productRows = await db
    .select({
      productId: saleItems.productId,
      name: products.name,
      quantity: sql<number>`COALESCE(SUM(${saleItems.quantity}), 0)::int`,
      revenue: sql<string>`COALESCE(SUM(${saleItems.totalPrice}), 0)`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(range)
    .groupBy(saleItems.productId, products.name)
    .orderBy(desc(sql`SUM(${saleItems.totalPrice})`));

  const cashierRows = await db
    .select({
      userId: sales.userId,
      name: users.fullName,
      displayName: users.displayName,
      role: users.role,
      transactions: sql<number>`COUNT(*)::int`,
      revenue: sql<string>`COALESCE(SUM(${sales.total}), 0)`,
      cash: sql<string>`COALESCE(SUM(${sales.total}) FILTER (WHERE ${sales.paymentMethod} = 'cash'), 0)`,
      card: sql<string>`COALESCE(SUM(${sales.total}) FILTER (WHERE ${sales.paymentMethod} = 'card'), 0)`,
      other: sql<string>`COALESCE(SUM(${sales.total}) FILTER (WHERE ${sales.paymentMethod} NOT IN ('cash', 'card')), 0)`,
    })
    .from(sales)
    .innerJoin(users, eq(sales.userId, users.id))
    .where(range)
    .groupBy(sales.userId, users.fullName, users.displayName, users.role);

  return {
    total: Number(totals?.total ?? 0),
    transactions: Number(totals?.transactions ?? 0),
    payments: paymentRows.map((r) => ({ method: r.method, amount: Number(r.amount) })),
    productsSold: productRows.map((r) => ({
      productId: r.productId,
      name: r.name,
      quantity: r.quantity,
      revenue: Number(r.revenue),
    })),
    cashierBreakdown: cashierRows.map((r) => ({
      userId: r.userId,
      name: r.displayName || r.name,
      role: r.role,
      transactions: r.transactions,
      revenue: Number(r.revenue),
      cash: Number(r.cash),
      card: Number(r.card),
      other: Number(r.other),
    })),
  };
}
