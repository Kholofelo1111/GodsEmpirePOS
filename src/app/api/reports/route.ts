import { NextRequest, NextResponse } from "next/server";
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

const PERIODS = {
  daily: { label: "Today", days: 1 },
  weekly: { label: "This Week", days: 7 },
  monthly: { label: "This Month", days: 30 },
} as const;

type PeriodKey = keyof typeof PERIODS;

export async function GET(req: NextRequest) {
  try {
    const periodParam = req.nextUrl.searchParams.get("period");
    const period: PeriodKey =
      periodParam === "weekly" || periodParam === "monthly" ? periodParam : "daily";
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

    return NextResponse.json({ period, label, summary, trend, best, slow, stats, customerActivity });
  } catch (error) {
    console.error("GET /api/reports failed:", error);
    return NextResponse.json({ error: "Failed to load reports." }, { status: 500 });
  }
}
