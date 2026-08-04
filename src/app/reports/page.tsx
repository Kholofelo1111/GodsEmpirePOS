import Link from "next/link";
import { TrendingUp, Receipt, ShoppingBag, BarChart3, Package, Snail, Users, CreditCard } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import {
  getPeriodSummary,
  getDailyTrend,
  getBestSellers,
  getSlowMovers,
  getDashboardStats,
  getCustomerActivityStats,
  startOfToday,
  daysAgo,
} from "@/lib/queries";
import { money, compactMoney } from "@/lib/format";
import ReportExportActions from "@/components/ReportExportActions";

export const dynamic = "force-dynamic";

const PERIODS = {
  daily: { label: "Today", days: 1 },
  weekly: { label: "This Week", days: 7 },
  monthly: { label: "This Month", days: 30 },
} as const;

type PeriodKey = keyof typeof PERIODS;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period: PeriodKey =
    params.period === "weekly" || params.period === "monthly" ? params.period : "daily";
  const { days, label } = PERIODS[period];
  const since = days === 1 ? startOfToday() : daysAgo(days - 1);

  const [summary, trend, best, slow, stats, customerActivity] = await Promise.all([
    getPeriodSummary(since),
    getDailyTrend(days === 1 ? 7 : days === 7 ? 7 : 14),
    getBestSellers(since, 5),
    getSlowMovers(since, 5),
    getDashboardStats(),
    getCustomerActivityStats(),
  ]);

  const maxTrend = Math.max(...trend.map((t) => t.total), 1);
  const margin = summary.revenue > 0 ? Math.round((summary.profit / summary.revenue) * 100) : 0;

  return (
    <div className="animate-fadeIn space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Reports</h1>
          <p className="text-sm text-dark-400 mt-1">Sales, profit, customers, and inventory performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ReportExportActions
            summary={summary}
            periodLabel={label}
            stockValue={stats.stockValue}
            stockRetailValue={stats.stockRetailValue}
            outstandingBalance={stats.totalOutstandingBalance}
            bestSellers={best}
          />
          <div className="flex gap-2">
            {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
              <Link
                key={key}
                href={`/reports?period=${key}`}
                className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
                  period === key
                    ? "gold-gradient text-dark-950"
                    : "bg-dark-800 text-dark-300 hover:text-white"
                }`}
              >
                {key}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={`Revenue · ${label}`}
          value={money(summary.revenue)}
          tone="green"
          icon={<TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-green-400" />}
        />
        <StatCard
          label={`Profit · ${label}`}
          value={money(summary.profit)}
          hint={`${margin}% margin`}
          tone="gold"
          icon={<Receipt className="w-5 h-5 md:w-6 md:h-6 text-gold-400" />}
        />
        <StatCard
          label="Transactions"
          value={String(summary.transactions)}
          hint={`${summary.itemsSold} items sold`}
          tone="cyan"
          icon={<ShoppingBag className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />}
        />
        <StatCard
          label="Average Basket"
          value={money(summary.averageBasket)}
          tone="purple"
          icon={<BarChart3 className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />}
        />
      </div>

      {/* Trend chart */}
      <section className="glass-card rounded-2xl p-5 md:p-6">
        <h2 className="text-lg font-semibold text-white mb-1">Sales Trend</h2>
        <p className="text-xs text-dark-400 mb-5">Revenue per day</p>

        {summary.transactions === 0 && trend.every((t) => t.total === 0) ? (
          <EmptyState
            icon={<BarChart3 className="w-6 h-6 text-dark-500" />}
            title="No sales data yet"
            message="Complete a sale to populate this chart."
          />
        ) : (
          <div className="flex items-end justify-between gap-1.5 sm:gap-3 h-48">
            {trend.map((point) => (
              <div key={point.day} className="flex-1 flex flex-col items-center gap-2 h-full">
                <div className="flex-1 w-full flex items-end">
                  <div
                    className="w-full gold-gradient rounded-t-lg transition-all hover:opacity-80 min-h-[3px] relative group"
                    style={{ height: `${Math.max((point.total / maxTrend) * 100, 1)}%` }}
                  >
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-gold-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {compactMoney(point.total)}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs text-dark-400">{point.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <section className="glass-card rounded-2xl p-5 md:p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Best Selling Products</h2>
          {best.length === 0 ? (
            <EmptyState
              icon={<Package className="w-6 h-6 text-dark-500" />}
              title="No sales in this period"
            />
          ) : (
            <div className="divide-y divide-dark-800">
              {best.map((item, i) => (
                <div key={item.productId} className="flex items-center gap-3 py-3">
                  <span className="w-7 h-7 rounded-full bg-gold-400/10 flex items-center justify-center text-xs font-bold text-gold-400 flex-shrink-0">
                    {i + 1}
                  </span>
                  <p className="flex-1 text-sm text-white truncate">{item.name}</p>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gold-400">{money(item.revenue)}</p>
                    <p className="text-xs text-dark-400">{item.quantity} sold</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass-card rounded-2xl p-5 md:p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Slow Moving Stock</h2>
          {slow.length === 0 ? (
            <EmptyState
              icon={<Snail className="w-6 h-6 text-dark-500" />}
              title="Nothing sitting still"
            />
          ) : (
            <div className="divide-y divide-dark-800">
              {slow.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{item.name}</p>
                    <p className="text-xs text-dark-400">{item.stock} units on hand</p>
                  </div>
                  <Badge tone={item.sold === 0 ? "danger" : "warning"}>
                    {item.sold} sold
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Customers & Outstanding Balances Report */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <section className="glass-card rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" /> Customer Activity Report
            </h2>
            <Link href="/customers" className="text-xs text-gold-400 hover:underline">
              View Clients →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-dark-900 rounded-xl p-4">
              <p className="text-xs text-dark-400">Total Registered</p>
              <p className="text-lg font-bold text-white mt-1">{stats.customerCount}</p>
            </div>
            <div className="bg-dark-900 rounded-xl p-4">
              <p className="text-xs text-dark-400">Active Today</p>
              <p className="text-lg font-bold text-cyan-400 mt-1">{customerActivity.todayCustomers}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-dark-400">Most Active Customers</p>
            <div className="divide-y divide-dark-800 max-h-48 overflow-y-auto">
              {customerActivity.mostActiveCustomers.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-white truncate">{c.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-dark-400">{c.visitCount} visits</span>
                    <Badge tone="gold">{c.loyaltyPoints} pts</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="glass-card rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-red-400" /> Outstanding Balances Report
            </h2>
            <Link href="/customers/outstanding" className="text-xs text-gold-400 hover:underline">
              Settle Accounts →
            </Link>
          </div>
          <div className="bg-dark-900 rounded-xl p-5 mb-4 flex items-center justify-between border-l-4 border-red-500">
            <div>
              <p className="text-xs text-dark-400">Total Customer Debt</p>
              <p className="text-2xl font-bold text-red-500 mt-1">{money(stats.totalOutstandingBalance)}</p>
            </div>
            <Link
              href="/customers/outstanding"
              className="px-3.5 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-semibold rounded-xl transition-colors"
            >
              Receive Payment
            </Link>
          </div>
          <p className="text-xs text-dark-400">
            Includes unpaid store credit, partial payments, and account balances across all registered customer accounts.
          </p>
        </section>
      </div>

      {/* Inventory report */}
      <section className="glass-card rounded-2xl p-5 md:p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Inventory Report</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-dark-900 rounded-xl p-4">
            <p className="text-xs text-dark-400">Stock value at cost</p>
            <p className="text-lg font-bold text-white mt-1">{money(stats.stockValue)}</p>
          </div>
          <div className="bg-dark-900 rounded-xl p-4">
            <p className="text-xs text-dark-400">Value at retail</p>
            <p className="text-lg font-bold text-green-400 mt-1">{money(stats.stockRetailValue)}</p>
          </div>
          <div className="bg-dark-900 rounded-xl p-4">
            <p className="text-xs text-dark-400">Low stock items</p>
            <p className="text-lg font-bold text-orange-400 mt-1">{stats.lowStockCount}</p>
          </div>
          <div className="bg-dark-900 rounded-xl p-4">
            <p className="text-xs text-dark-400">Out of stock</p>
            <p className="text-lg font-bold text-red-400 mt-1">{stats.outOfStockCount}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
