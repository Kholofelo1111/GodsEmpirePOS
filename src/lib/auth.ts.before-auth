import { SignJWT, jwtVerify } from "jose";

export type UserRole = "owner" | "manager" | "cashier";

export interface SessionUser {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
}

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "change-this-secret-in-production"
);

export async function createToken(user: SessionUser) {
  return await new SignJWT({ id: user.id, username: user.username, fullName: user.fullName, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export const DEFAULT_USER: SessionUser = {
  id: 1,
  username: "owner",
  fullName: "Store Owner",
  role: "owner",
};

export async function getCurrentUser(): Promise<SessionUser> {
  return DEFAULT_USER;
}
