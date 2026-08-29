import { NextResponse } from "next/server";
import { getCurrentUser, getPermissions } from "@/lib/auth";
import {
  getDashboardStats,
  getRecentSales,
  getLowStockProducts,
  getCustomerActivityStats,
  getDailyTrend,
} from "@/lib/queries";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const permissions = getPermissions(user.role);

    const [stats, recentSales, lowStock, customerActivity, trend] = await Promise.all([
      getDashboardStats(),
      getRecentSales(5),
      getLowStockProducts(5),
      getCustomerActivityStats(),
      getDailyTrend(7),
    ]);

    return NextResponse.json({ user, permissions, stats, recentSales, lowStock, customerActivity, trend });
  } catch (error) {
    console.error("GET /api/dashboard failed:", error);
    return NextResponse.json({ error: "Failed to load dashboard." }, { status: 500 });
  }
}
