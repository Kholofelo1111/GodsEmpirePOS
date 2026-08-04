import "dotenv/config";
import { db } from "./src/db";
import {
  salePayments,
  saleItems,
  sales,
  stockIn,
  inventoryLogs,
  invoiceItems,
  invoices,
  customerDebtSettlements,
  products,
  categories,
  customers,
  suppliers,
  notifications,
  settings,
} from "./src/db/schema";

async function reset() {
  console.log("Clearing transaction data...");

  await db.delete(salePayments);
  await db.delete(saleItems);
  await db.delete(sales);

  await db.delete(stockIn);
  await db.delete(inventoryLogs);

  await db.delete(invoiceItems);
  await db.delete(invoices);

  await db.delete(customerDebtSettlements);

  await db.delete(products);
  await db.delete(categories);

  await db.delete(customers);
  await db.delete(suppliers);

  await db.delete(notifications);
  await db.delete(settings);

  console.log("Database reset complete.");
  process.exit(0);
}

reset();
