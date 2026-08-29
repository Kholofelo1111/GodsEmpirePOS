import "dotenv/config";
import { db } from "./src/db";
import { users } from "./src/db/schema";
import { hashPassword } from "./src/lib/auth";

/**
 * Adds a second cashier account, using the exact same role/permission
 * structure as the existing cashier (role: "cashier"). Does not touch or
 * modify any existing users. Run once with:
 *
 *   npx tsx create-cashier-2.ts
 *
 * Update the username/password/fullName below once real details are ready.
 */
async function run() {
  await db.insert(users).values({
    username: "cashier2",
    password: await hashPassword("cashier123"),
    fullName: "Cashier 2",
    role: "cashier",
  });

  console.log("Cashier 2 created");
  process.exit();
}

run();
