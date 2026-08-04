import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });



import { db } from "../src/db";

import {
  invoiceItems,
  invoices,
  customerDebtSettlements,
  salePayments,
  saleItems,
  sales,
  inventoryLogs,
  stockIn,
  products,
  categories,
  customers,
  suppliers,
  notifications,
} from "@/db/schema";

async function resetDatabase() {
  console.log("Resetting POS database...");

  await db.delete(invoiceItems);
  console.log("✓ Invoice items cleared");

  await db.delete(invoices);
  console.log("✓ Invoices cleared");

  await db.delete(customerDebtSettlements);
  console.log("✓ Debt settlements cleared");

  await db.delete(salePayments);
  console.log("✓ Sale payments cleared");

  await db.delete(saleItems);
  console.log("✓ Sale items cleared");

  await db.delete(sales);
  console.log("✓ Sales cleared");

  await db.delete(inventoryLogs);
  console.log("✓ Inventory logs cleared");

  await db.delete(stockIn);
  console.log("✓ Stock in cleared");

  await db.delete(products);
  console.log("✓ Products cleared");

  await db.delete(categories);
  console.log("✓ Categories cleared");

  await db.delete(customers);
  console.log("✓ Customers cleared");

  await db.delete(suppliers);
  console.log("✓ Suppliers cleared");

  await db.delete(notifications);
  console.log("✓ Notifications cleared");

  console.log("✅ Database reset complete");
  process.exit(0);
}

resetDatabase();
