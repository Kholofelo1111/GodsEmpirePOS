import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { suppliers } from "@/db/schema";

export async function GET() {
  try {
    const allSuppliers = await db.select().from(suppliers).orderBy(suppliers.name);
    return NextResponse.json(allSuppliers);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, contactPerson, email, phone, address } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const [supplier] = await db.insert(suppliers).values({ name, contactPerson, email, phone, address }).returning();
    return NextResponse.json(supplier);
  } catch (error) {
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}
