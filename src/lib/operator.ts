import type { SessionUser } from "./auth";

export async function ensureOperator(_user: SessionUser): Promise<number> {
  return 1;
}
