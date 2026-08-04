import Link from "next/link";
import { redirect } from "next/navigation";
import {
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  ShoppingCart,
  Users,
  Boxes,
  ScanLine,
  PlusCircle,
  ArrowDownCircle,
  Receipt,
  AlertCircle,
  BarChart3,
  CreditCard,
} from "lucide-react";

import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import {
  getDashboardStats,
  getRecentSales,
  getLowStockProducts,
  getCustomerActivityStats,
  getDailyTrend,
} from "@/lib/queries";
import { money, formatTime } from "@/lib/format";
import { getCurrentUser, getPermissions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const permissions = getPermissions(user.role);


  const [stats, recentSales, lowStock, customerActivity, trend] = await Promise.all([
    getDashboardStats(),
    getRecentSales(5),
    getLowStockProducts(5),
    getCustomerActivityStats(),
    getDailyTrend(7),
  ]);

  const today = new Date().toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const maxDayVal = Math.max(...trend.map((t) => t.total), 1);

  return (
    <main className="space-y-6 animate-fadeIn">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Dashboard
          </h1>
          <p className="text-sm text-dark-400 mt-1">
            {today}
          </p>
        </div>

        <Link
          href="/pos"
          className="gold-gradient text-dark-950 px-4 py-2 rounded-xl font-semibold flex items-center gap-2"
        >
          <ShoppingCart size={18} />
          New Sale
        </Link>
      </div>


      {/* Statistics */}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        <StatCard
          label="Today's Sales"
          value={money(stats.todayRevenue)}
          hint={`${stats.todayTransactions} transactions`}
          tone="green"
          icon={<TrendingUp className="text-green-400" />}
        />
        {permissions.canSeeProfit && (
          <StatCard
            label="Profit"
            value={money(stats.todayProfit)}
            tone="gold"
            icon={<DollarSign className="text-yellow-400" />}
          />
        )}

        {permissions.canSeeStockValue && (
          <StatCard
            label="Stock Value"
            value={money(stats.stockValue)}
            tone="blue"
            icon={<Boxes className="text-blue-400" />}
          />
        )}

        <StatCard
          label="Products"
          value={String(stats.productCount)}
          tone="purple"
          icon={<Package className="text-purple-400" />}
        />

        <StatCard
          label="Low Stock"
          value={String(stats.lowStockCount)}
          tone="orange"
          icon={<AlertTriangle className="text-orange-400" />}
        />

        <StatCard
          label="Out of Stock"
          value={String(stats.outOfStockCount)}
          tone="red"
          icon={<AlertTriangle className="text-red-400" />}
        />

        {permissions.canSeeReports && (
        <StatCard
          label="Outstanding Balances"
          value={money(stats.totalOutstandingBalance)}
          hint="Unpaid customer debt"
          tone="red"
          icon={<AlertCircle className="text-red-400" />}
        />
        )}

        <StatCard
          label="Customers"
          value={String(stats.customerCount)}
          tone="cyan"
          icon={<Users className="text-cyan-400" />}
        />


        <StatCard
          label="Today's Customers"
          value={String(customerActivity.todayCustomers)}
          tone="cyan"
          icon={<Users className="text-cyan-400" />}
        />

        {permissions.canSeeStockValue && (
          <StatCard
            label="Retail Value"
            value={money(stats.stockRetailValue)}
            tone="gold"
            icon={<Receipt className="text-yellow-400" />}
          />
        )}
      </section>

      {/* Interactive Alerts */}
      {(stats.lowStockCount > 0 ||
        stats.outOfStockCount > 0 ||
        stats.totalOutstandingBalance > 0) && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {stats.lowStockCount > 0 && (
            <Link
              href="/inventory"
              className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-2xl flex items-center justify-between hover:bg-orange-500/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {stats.lowStockCount} Low Stock Item{stats.lowStockCount === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-orange-300">Minimum threshold reached</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-orange-400">View →</span>
            </Link>
          )}

          {stats.outOfStockCount > 0 && (
            <Link
              href="/inventory"
              className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-center justify-between hover:bg-red-500/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {stats.outOfStockCount} Out of Stock
                  </p>
                  <p className="text-xs text-red-300">0 quantity remaining</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-red-400">View →</span>
            </Link>
          )}

          {permissions.canSeeReports && stats.totalOutstandingBalance > 0 && (
            <Link
              href="/customers/outstanding"
              className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-center justify-between hover:bg-red-500/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {money(stats.totalOutstandingBalance)} Debt
                  </p>
                  <p className="text-xs text-red-300">Unpaid customer accounts</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-red-400">Settle →</span>
            </Link>          )}
        </section>

      )}

      
      {permissions.canSeeReports && (
      <>
      {/* 7-Day Sales Trend Chart */}
      <section className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gold-400" /> 7-Day Revenue Trend
          </h2>
          <span className="text-xs text-dark-400">Last 7 Days</span>
        </div>
        <div className="grid grid-cols-7 gap-2 items-end h-36 pt-4 border-b border-dark-800 pb-2">
          {trend.map((t, idx) => {
            const heightPct = Math.max(8, Math.round((t.total / maxDayVal) * 100));
            return (
              <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                <span className="text-[10px] text-dark-300 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                  {money(t.total)}
                </span>
                <div
                  style={{ height: `${heightPct}%` }}
                  className="w-full max-w-[28px] rounded-t-md gold-gradient transition-all duration-300 group-hover:opacity-90"
                />
                <span className="text-xs text-dark-400 font-medium">{t.label}</span>
              </div>
            );
          })}
        </div>
      </section>


      </>
      )}

      {/* Quick Actions */}

      <section>
        <h2 className="text-lg font-semibold text-white mb-3">
          Quick Actions
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

          <Link
            href="/pos"
            className="glass-card rounded-2xl p-5 hover:border-gold-400/30"
          >
            <ShoppingCart className="text-gold-400 mb-3" />
            <p className="font-semibold text-white">New Sale</p>
            <p className="text-xs text-dark-400">
              Start transaction
            </p>
          </Link>


          <Link
            href="/scanner"
            className="glass-card rounded-2xl p-5"
          >
            <ScanLine className="text-blue-400 mb-3" />
            <p className="font-semibold text-white">Scan Barcode</p>
            <p className="text-xs text-dark-400">
              Find products
            </p>
          </Link>


          {permissions.canManageProducts && (
          <Link
            href="/stock-in"
            className="glass-card rounded-2xl p-5"
          >
            <ArrowDownCircle className="text-green-400 mb-3" />
            <p className="font-semibold text-white">Stock In</p>
            <p className="text-xs text-dark-400">
              Receive stock
            </p>
          </Link>
          )}


          {permissions.canManageProducts && (
          <Link
            href="/products/new"
            className="glass-card rounded-2xl p-5"
          >
            <PlusCircle className="text-purple-400 mb-3" />
            <p className="font-semibold text-white">Add Product</p>
            <p className="text-xs text-dark-400">
              Create item
            </p>
          </Link>
          )}

          <Link
            href="/customers/outstanding"
            className="glass-card rounded-2xl p-5"
          >
            <CreditCard className="text-red-400 mb-3" />
            <p className="font-semibold text-white">Settle Debt</p>
            <p className="text-xs text-dark-400">
              Receive payments
            </p>
          </Link>

          {permissions.canSeeReports && (
          <Link
            href="/reports"
            className="glass-card rounded-2xl p-5"
          >
            <BarChart3 className="text-cyan-400 mb-3" />
            <p className="font-semibold text-white">Reports</p>
            <p className="text-xs text-dark-400">
              Sales & profit
            </p>
          </Link>
          )}

        </div>
      </section>



      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">


        {/* Recent Sales */}

        <section className="glass-card rounded-2xl p-5">

          <div className="flex justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Recent Sales
            </h2>

            <Link
              href="/receipts"
              className="text-sm text-gold-400"
            >
              View all →
            </Link>
          </div>


          {recentSales.length === 0 ? (
            <p className="text-dark-400 text-sm">
              No sales yet
            </p>
          ) : (

            <div className="space-y-3">

              {recentSales.map((sale) => (

                <div
                  key={sale.id}
                  className="flex items-center justify-between bg-dark-900 rounded-xl p-3"
                >

                  <div>
                    <p className="text-white font-medium">
                      {sale.receiptNumber}
                    </p>

                    <p className="text-xs text-dark-400">
                      {sale.itemCount} item(s) • {formatTime(sale.createdAt)}
                    </p>
                  </div>


                  <div className="text-right">

                    <Badge tone="success">
                      {sale.paymentMethod}
                    </Badge>

                    <p className="text-white font-semibold mt-1">
                      {money(sale.total)}
                    </p>

                  </div>


                </div>
              ))}

            </div>

          )}

        </section>



        {/* Low Stock */}

        <section className="glass-card rounded-2xl p-5">

          <div className="flex justify-between mb-4">

            <h2 className="text-lg font-semibold text-white">
              Low Stock Products
            </h2>

            <Link
              href="/inventory"
              className="text-sm text-gold-400"
            >
              View all →
            </Link>

          </div>


          {lowStock.length === 0 ? (

            <p className="text-dark-400 text-sm">
              No low stock items
            </p>

          ) : (

            <div className="space-y-3">

              {lowStock.map((product) => (

                <div
                  key={product.id}
                  className="flex justify-between items-center bg-dark-900 rounded-xl p-3"
                >

                  <div>

                    <p className="text-white font-medium">
                      {product.name}
                    </p>

                    <p className="text-xs text-dark-400">
                      Minimum {product.minStockLevel}
                    </p>

                  </div>


                  <div className="text-right">

                    <Badge
                      tone={product.stock <= 0 ? "danger" : "warning"}
                    >
                      {product.stock <= 0
                        ? "Out of stock"
                        : `${product.stock} left`}
                    </Badge>

                  </div>


                </div>

              ))}

            </div>

          )}

        </section>


      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">


        {permissions.canSeeReports && (
          <>
            {/* Recent Customers */}
            <section className="glass-card rounded-2xl p-5">
              <div className="flex justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Recent Customers</h2>
                <Link href="/customers" className="text-sm text-gold-400">
                  View all →
                </Link>
              </div>

              {customerActivity.recentCustomers.length === 0 ? (
                <p className="text-dark-400 text-sm">No customer visits yet</p>
              ) : (
                <div className="space-y-3">
                  {customerActivity.recentCustomers.map((c) => (
                    <div key={c.id} className="flex items-center justify-between bg-dark-900 rounded-xl p-3">
                      <div>
                        <p className="text-white font-medium">{c.name}</p>
                        <p className="text-xs text-dark-400">
                          {c.lastVisitAt ? formatTime(c.lastVisitAt) : "—"}
                        </p>
                      </div>
                      {c.isWalkIn && <Badge tone="warning">Walk-in</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Most Active Customers */}
            <section className="glass-card rounded-2xl p-5">
              <div className="flex justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Most Active Customers</h2>
                <Link href="/customers" className="text-sm text-gold-400">
                  View all →
                </Link>
              </div>

              {customerActivity.mostActiveCustomers.length === 0 ? (
                <p className="text-dark-400 text-sm">No customer activity yet</p>
              ) : (
                <div className="space-y-3">
                  {customerActivity.mostActiveCustomers.map((c) => (
                    <div key={c.id} className="flex items-center justify-between bg-dark-900 rounded-xl p-3">
                      <div>
                        <p className="text-white font-medium">{c.name}</p>
                        <p className="text-xs text-dark-400">{c.loyaltyPoints} loyalty points</p>
                      </div>
                      <Badge tone="success">
                        {c.visitCount} visit{c.visitCount === 1 ? "" : "s"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}



      </div>
    </main>
  );
}
