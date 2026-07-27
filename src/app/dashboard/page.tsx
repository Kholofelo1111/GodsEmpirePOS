import Link from "next/link";
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
} from "lucide-react";

import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import { getDashboardStats, getRecentSales, getLowStockProducts } from "@/lib/queries";
import { money, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [stats, recentSales, lowStock] = await Promise.all([
    getDashboardStats(),
    getRecentSales(5),
    getLowStockProducts(5),
  ]);

  const today = new Date().toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

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

        <StatCard
          label="Profit"
          value={money(stats.todayProfit)}
          tone="gold"
          icon={<DollarSign className="text-yellow-400" />}
        />

        <StatCard
          label="Stock Value"
          value={money(stats.stockValue)}
          tone="blue"
          icon={<Boxes className="text-blue-400" />}
        />

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

        <StatCard
          label="Customers"
          value={String(stats.customerCount)}
          tone="cyan"
          icon={<Users className="text-cyan-400" />}
        />

        <StatCard
          label="Retail Value"
          value={money(stats.stockRetailValue)}
          tone="gold"
          icon={<Receipt className="text-yellow-400" />}
        />

      </section>


      {/* Quick Actions */}

      <section>
        <h2 className="text-lg font-semibold text-white mb-3">
          Quick Actions
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

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


          <Link
            href="/products"
            className="glass-card rounded-2xl p-5"
          >
            <PlusCircle className="text-purple-400 mb-3" />
            <p className="font-semibold text-white">Add Product</p>
            <p className="text-xs text-dark-400">
              Create item
            </p>
          </Link>

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

    </main>
  );
}
