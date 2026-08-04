import "dotenv/config";
import { db } from "./src/db";
import { users } from "./src/db/schema";
import { hashPassword } from "./src/lib/auth";

async function run() {
  await db.insert(users).values([
    {
      username: "manager",
      password: await hashPassword("manager123"),
      fullName: "Store Manager",
      role: "manager",
    },
    {
      username: "cashier",
      password: await hashPassword("cashier123"),
      fullName: "Cashier User",
      role: "cashier",
    },
  ]);

  console.log("Users created");
  process.exit();
}

run();
