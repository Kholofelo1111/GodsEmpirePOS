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
import { sql, gte, desc, eq, asc, and } from "drizzle-orm";

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
    .select({ count: sql<number>`COUNT(*)::int` })
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
