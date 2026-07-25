import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";

export async function GET() {
  try {
    const allCustomers = await db.select().from(customers).orderBy(customers.name);
    return NextResponse.json(allCustomers);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, address } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const [customer] = await db.insert(customers).values({ name, email, phone, address }).returning();
    return NextResponse.json(customer);
  } catch (error) {
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
