import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole, hashPassword, type UserRole } from "@/lib/auth";
import { getStaffPerformance } from "@/lib/queries";

/**
 * Staff Management API.
 *
 * There is no separate "staff"/"cashier" table — this operates on the same
 * `users` table already used by authentication (see Phase 10: reuse, don't
 * duplicate). Performance figures come from `sales.userId`, the existing
 * link between a sale and the staff member who made it.
 *
 * Read access (GET): owner or manager.
 * All mutations (POST/PUT/PATCH): owner only. Managers can see staff and
 * performance, but cannot create, edit, or (de)activate anyone — matching
 * the "Managers must NOT automatically receive owner-level permissions"
 * requirement.
 */

const ASSIGNABLE_ROLES: UserRole[] = ["cashier", "manager"];

function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "23505";
}

export async function GET() {
  try {
    await requireRole(["owner", "manager"]);

    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        displayName: users.displayName,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.createdAt);

    const performance = await getStaffPerformance();

    const staff = rows.map((row) => {
      const perf = performance.get(row.id);
      return {
        ...row,
        performance: {
          totalSales: perf?.totalSales ?? 0,
          totalRevenue: perf?.totalRevenue ?? 0,
          todaySales: perf?.todaySales ?? 0,
          todayRevenue: perf?.todayRevenue ?? 0,
        },
      };
    });

    return NextResponse.json(staff);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: "You do not have permission to view staff." }, { status: 403 });
    }
    console.error("GET /api/staff failed:", err);
    return NextResponse.json({ error: "Failed to load staff." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(["owner"]);

    const body = await req.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const fullName = String(body.fullName || "").trim();
    const displayName = body.displayName ? String(body.displayName).trim() : null;
    const role = body.role as UserRole;

    if (!username || !password || !fullName) {
      return NextResponse.json({ error: "Full name, username and password are required." }, { status: 400 });
    }
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return NextResponse.json({ error: "Role must be 'cashier' or 'manager'." }, { status: 400 });
    }

    const [created] = await db
      .insert(users)
      .values({
        username,
        password: await hashPassword(password),
        fullName,
        displayName,
        role,
        isActive: true,
      })
      .returning({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        displayName: users.displayName,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: "Only the owner can create staff accounts." }, { status: 403 });
    }
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    console.error("POST /api/staff failed:", err);
    return NextResponse.json({ error: "Failed to create staff member." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireRole(["owner"]);

    const body = await req.json();
    const id = Number(body.id);
    if (!id) {
      return NextResponse.json({ error: "A valid staff id is required." }, { status: 400 });
    }

    const [target] = await db.select().from(users).where(eq(users.id, id));
    if (!target) {
      return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    }
    if (target.role === "owner") {
      return NextResponse.json({ error: "The owner account cannot be edited here." }, { status: 403 });
    }

    const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };

    if (typeof body.fullName === "string" && body.fullName.trim()) {
      patch.fullName = body.fullName.trim();
    }
    if (typeof body.displayName === "string") {
      patch.displayName = body.displayName.trim() || null;
    }
    if (typeof body.password === "string" && body.password) {
      patch.password = await hashPassword(body.password);
    }
    // Role is intentionally not editable here — changing a staff member's
    // role is a bigger decision than "edit staff", and this keeps a
    // cashier/manager from ever being able to influence their own role
    // even indirectly, per the "no arbitrary role modification" rule.

    const [updated] = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        displayName: users.displayName,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: "Only the owner can edit staff accounts." }, { status: 403 });
    }
    console.error("PUT /api/staff failed:", err);
    return NextResponse.json({ error: "Failed to update staff member." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await requireRole(["owner"]);

    const body = await req.json();
    const id = Number(body.id);
    if (!id || typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "A valid staff id and isActive flag are required." }, { status: 400 });
    }

    const [target] = await db.select().from(users).where(eq(users.id, id));
    if (!target) {
      return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    }
    if (target.role === "owner") {
      return NextResponse.json({ error: "The owner account cannot be deactivated." }, { status: 403 });
    }
    if (id === currentUser.id) {
      return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
    }

    const [updated] = await db
      .update(users)
      .set({ isActive: body.isActive, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        displayName: users.displayName,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: "Only the owner can activate or deactivate staff." }, { status: 403 });
    }
    console.error("PATCH /api/staff failed:", err);
    return NextResponse.json({ error: "Failed to update staff status." }, { status: 500 });
  }
}
