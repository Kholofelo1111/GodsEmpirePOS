import Link from "next/link";
import {
  ShoppingCart,
  TrendingUp,
  Package,
  Warehouse,
  Receipt,
  ScanLine,
  ArrowDownCircle,
  AlertTriangle,
  Users,
  ArrowRight,
  PackageX,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import { getDashboardStats, getRecentSales, getLowStockProducts } from "@/lib/queries";
import { money, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let stats = {
    todayTransactions: 0,
    todayRevenue: 0,
    todayProfit: 0,
    stockValue: 0,
    stockRetailValue: 0,
    productCount: 0,
    customerCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  };
  let recentSales: Awaited<ReturnType<typeof getRecentSales>> = [];
  let lowStock: Awaited<ReturnType<typeof getLowStockProducts>> = [];
  let failed = false;

  try {
    [stats, recentSales, lowStock] = await Promise.all([
      getDashboardStats(),
      getRecentSales(6),
      getLowStockProducts(6),
    ]);
  } catch (error) {
    console.error("Dashboard load failed:", error);
    failed = true;
  }

  const margin =
    stats.todayRevenue > 0 ? Math.round((stats.todayProfit / stats.todayRevenue) * 100) : 0;

  const quickActions = [
    { href: "/pos", label: "New Sale", desc: "Open the till", icon: ShoppingCart, tone: "bg-gold-400/10 text-gold-400" },
    { href: "/scanner", label: "Scan Barcode", desc: "Find a product", icon: ScanLine, tone: "bg-green-400/10 text-green-400" },
    { href: "/stock-in", label: "Stock In", desc: "Receive delivery", icon: ArrowDownCircle, tone: "bg-purple-400/10 text-purple-400" },
    { href: "/products/new", label: "Add Product", desc: "Create an item", icon: Package, tone: "bg-blue-400/10 text-blue-400" },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-dark-400 mt-1">
          {new Date().toLocaleDateString("en-ZA", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {failed && (
        <div className="bg-orange-400/10 border border-orange-400/30 rounded-xl p-4 text-orange-300 text-sm">
          Could not reach the database. Figures below may be incomplete.
        </div>
      )}

      {/* Primary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Today's Sales"
          value={String(stats.todayTransactions)}
          hint={stats.todayTransactions === 1 ? "transaction" : "transactions"}
          tone="cyan"
          icon={<ShoppingCart className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />}
        />
        <StatCard
          label="Revenue"
          value={money(stats.todayRevenue)}
          hint="Today, incl. VAT"
          tone="green"
          icon={<TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-green-400" />}
        />
        <StatCard
          label="Profit"
          value={money(stats.todayProfit)}
          hint={`${margin}% margin today`}
          tone="gold"
          icon={<Receipt className="w-5 h-5 md:w-6 md:h-6 text-gold-400" />}
        />
        <StatCard
          label="Stock Value"
          value={money(stats.stockValue)}
          hint={`${money(stats.stockRetailValue)} at retail`}
          tone="purple"
          icon={<Warehouse className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />}
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Products"
          value={String(stats.productCount)}
          tone="blue"
          icon={<Package className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />}
        />
        <StatCard
          label="Low Stock"
          value={String(stats.lowStockCount)}
          tone="orange"
          icon={<AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-orange-400" />}
        />
        <StatCard
          label="Out of Stock"
          value={String(stats.outOfStockCount)}
          tone="red"
          icon={<PackageX className="w-5 h-5 md:w-6 md:h-6 text-red-400" />}
        />
        <StatCard
          label="Customers"
          value={String(stats.customerCount)}
          tone="purple"
          icon={<Users className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />}
        />
      </div>

      {/* Quick actions */}
      <section>
        <h2 className="text-sm font-semibold text-dark-300 uppercase tracking-wide mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="glass-card rounded-2xl p-4 md:p-5 hover:border-gold-400/30 transition-all group"
            >
              <div
                className={`w-11 h-11 rounded-xl ${action.tone} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}
              >
                <action.icon className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-white">{action.label}</p>
              <p className="text-xs text-dark-400 mt-0.5">{action.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent sales + low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <section className="glass-card rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Sales</h2>
            <Link
              href="/receipts"
              className="text-sm text-gold-400 hover:text-gold-300 flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentSales.length === 0 ? (
            <EmptyState
              icon={<Receipt className="w-6 h-6 text-dark-500" />}
              title="No sales yet"
              message="Completed sales will appear here."
              action={
                <Link
                  href="/pos"
                  className="inline-flex items-center gap-2 px-4 py-2 gold-gradient text-dark-950 text-sm font-semibold rounded-xl"
                >
                  <ShoppingCart className="w-4 h-4" /> Start selling
                </Link>
              }
            />
          ) : (
            <div className="divide-y divide-dark-800">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{sale.receiptNumber}</p>
                    <p className="text-xs text-dark-400">
                      {sale.itemCount} item{sale.itemCount === 1 ? "" : "s"} ·{" "}
                      {formatTime(sale.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge tone={sale.paymentMethod === "cash" ? "success" : "info"}>
                      {sale.paymentMethod}
                    </Badge>
                    <span className="text-sm font-semibold text-gold-400">
                      {money(sale.total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass-card rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Low Stock Products</h2>
            <Link
              href="/inventory"
              className="text-sm text-gold-400 hover:text-gold-300 flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {lowStock.length === 0 ? (
            <EmptyState
              icon={<Package className="w-6 h-6 text-dark-500" />}
              title="Everything is stocked"
              message="No products are below their minimum level."
            />
          ) : (
            <div className="divide-y divide-dark-800">
              {lowStock.map((product) => (
                <Link href={`/products/${product.id}/edit`} key={product.id} className="flex items-center justify-between gap-3 py-3 hover:bg-dark-800/40 rounded-xl px-2 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{product.name}</p>
                    <p className="text-xs text-dark-400">
                      Minimum {product.minStockLevel} · {money(product.sellingPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge tone={product.stock === 0 ? "danger" : "warning"}>
                      {product.stock === 0 ? "Out of stock" : `${product.stock} left`}
                    </Badge>
                    <span
                      className="text-xs text-gold-400 whitespace-nowrap"
                    >
                      Restock →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
