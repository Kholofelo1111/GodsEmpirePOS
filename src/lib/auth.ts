import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

/**
 * ============================================================================
 * GOD'S EMPIRE POS — MASTER AUTHENTICATION & ROLE PERMISSION MODULE
 * ============================================================================
 *
 * This file is a self-contained, drop-in authentication and role permission
 * engine for God's Empire POS. It implements full JWT session signing, password
 * hashing, fine-grained role permissions, route access verification, and data
 * sanitization (e.g. stripping cost prices from Cashiers).
 *
 * Supported Roles:
 *   1. "owner"   — Store Owner / Administrator (Full Access)
 *   2. "manager" — Store Operator / Manager (Operational & Stock Access)
 *   3. "cashier" — Cashier (Checkout & POS Access Only)
 * ============================================================================
 */

export type UserRole = "owner" | "manager" | "cashier";

export interface SessionUser {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
}

export const SESSION_COOKIE_NAME = "auth_token";

export const DEFAULT_USER: SessionUser = {
  id: 1,
  username: "owner",
  fullName: "Store Owner",
  role: "owner",
};

/**
 * ============================================================================
 * 1. ROLE PERMISSION MATRIX & FINE-GRAINED CHECKERS
 * ============================================================================
 */

export interface RolePermissions {
  // Dashboard & Analytics
  canSeeAnalytics: boolean;      // Owner only (Dashboard financial overview)
  canSeeProfit: boolean;         // Owner, Manager
  canSeeStockValue: boolean;     // Owner, Manager
  canSeeCostPrice: boolean;      // Owner, Manager (Cashier MUST NOT see buying price)
  
  // Sales & Checkout (POS)
  canAccessPOS: boolean;         // Owner, Manager, Cashier
  canDeleteSales: boolean;       // Owner only (Refunds / Voiding completed sales)
  canRefund: boolean;            // Owner only
  canReprintReceipts: boolean;   // Owner, Manager, Cashier

  // Inventory & Catalogue
  canManageProducts: boolean;    // Owner, Manager (Create / Edit catalogue items)
  canDeleteProducts: boolean;    // Owner only (Delete products from DB)
  canStockIn: boolean;           // Owner, Manager (Receive stock deliveries)
  canAdjustInventory: boolean;   // Owner, Manager (Stock adjustments & logs)

  // Contacts & Reporting
  canManageCustomers: boolean;   // Owner, Manager, Cashier (Customer profiles & debt)
  canManageSuppliers: boolean;   // Owner, Manager (Supplier directory & history)
  canSeeReports: boolean;        // Owner, Manager (Sales, inventory, profit reports)

  // System Administration
  canManageUsers: boolean;       // Owner only (Add/remove cashiers & managers)
  canManageSettings: boolean;    // Owner only (Business info, VAT rate, receipt footer)
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  owner: {
    canSeeAnalytics: true,
    canSeeProfit: true,
    canSeeStockValue: true,
    canSeeCostPrice: true,
    canAccessPOS: true,
    canDeleteSales: true,
    canRefund: true,
    canReprintReceipts: true,
    canManageProducts: true,
    canDeleteProducts: true,
    canStockIn: true,
    canAdjustInventory: true,
    canManageCustomers: true,
    canManageSuppliers: true,
    canSeeReports: true,
    canManageUsers: true,
    canManageSettings: true,
  },
  manager: {
    canSeeAnalytics: false,
    canSeeProfit: true,
    canSeeStockValue: true,
    canSeeCostPrice: true,
    canAccessPOS: true,
    canDeleteSales: false,
    canRefund: false,
    canReprintReceipts: true,
    canManageProducts: true,
    canDeleteProducts: false,
    canStockIn: true,
    canAdjustInventory: true,
    canManageCustomers: true,
    canManageSuppliers: true,
    canSeeReports: true,
    canManageUsers: false,
    canManageSettings: false,
  },
  cashier: {
    canSeeAnalytics: false,
    canSeeProfit: false,
    canSeeStockValue: false,
    canSeeCostPrice: false,
    canAccessPOS: true,
    canDeleteSales: false,
    canRefund: false,
    canReprintReceipts: true,
    canManageProducts: false,
    canDeleteProducts: false,
    canStockIn: false,
    canAdjustInventory: false,
    canManageCustomers: true,
    canManageSuppliers: false,
    canSeeReports: false,
    canManageUsers: false,
    canManageSettings: false,
  },
};

/** Returns the complete permission set for a given role. */
export function getPermissions(role: UserRole = "cashier"): RolePermissions {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.cashier;
}

// Individual permission helper functions for UI components & API routes:
export function canSeeCostPrice(role?: UserRole): boolean {
  return getPermissions(role).canSeeCostPrice;
}

export function canSeeProfit(role?: UserRole): boolean {
  return getPermissions(role).canSeeProfit;
}

export function canSeeStockValue(role?: UserRole): boolean {
  return getPermissions(role).canSeeStockValue;
}

export function canSeeReports(role?: UserRole): boolean {
  return getPermissions(role).canSeeReports;
}

export function canSeeAnalytics(role?: UserRole): boolean {
  return getPermissions(role).canSeeAnalytics;
}

export function canDeleteProducts(role?: UserRole): boolean {
  return getPermissions(role).canDeleteProducts;
}

export function canDeleteSales(role?: UserRole): boolean {
  return getPermissions(role).canDeleteSales;
}

export function canRefund(role?: UserRole): boolean {
  return getPermissions(role).canRefund;
}

export function canManageUsers(role?: UserRole): boolean {
  return getPermissions(role).canManageUsers;
}

export function canManageSettings(role?: UserRole): boolean {
  return getPermissions(role).canManageSettings;
}

export function canManageSuppliers(role?: UserRole): boolean {
  return getPermissions(role).canManageSuppliers;
}

export function canManageProducts(role?: UserRole): boolean {
  return getPermissions(role).canManageProducts;
}

export function canStockIn(role?: UserRole): boolean {
  return getPermissions(role).canStockIn;
}

/**
 * ============================================================================
 * 2. ROUTE ACCESS VERIFICATION
 * ============================================================================
 * Verifies whether a user role is permitted to access a given URL pathname.
 */
export function canAccessRoute(role: UserRole, pathname: string): boolean {
  // Public routes
  if (pathname === "/login" || pathname.startsWith("/api/auth/login")) {
    return true;
  }

  const p = getPermissions(role);

  // Owner-only routes
  if (pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/dashboard")) {
    return p.canSeeAnalytics;
  }
  if (pathname === "/settings" || pathname.startsWith("/settings")) {
    return p.canManageSettings || p.canManageUsers;
  }
  if (pathname === "/users" || pathname.startsWith("/users")) {
    return p.canManageUsers;
  }

  // Manager & Owner routes
  if (pathname === "/reports" || pathname.startsWith("/reports")) {
    return p.canSeeReports;
  }
  if (pathname === "/inventory" || pathname.startsWith("/inventory")) {
    return p.canSeeStockValue || p.canAdjustInventory;
  }
  if (pathname === "/stock-in" || pathname.startsWith("/stock-in")) {
    return p.canStockIn;
  }
  if (pathname === "/suppliers" || pathname.startsWith("/suppliers")) {
    return p.canManageSuppliers;
  }
  if (
    pathname === "/products/new" ||
    pathname.startsWith("/products/new") ||
    pathname.includes("/edit")
  ) {
    return p.canManageProducts;
  }

  // Routes open to all roles (POS, Scanner, Receipts/Invoices, Customers, Products catalogue view)
  if (
    pathname === "/pos" ||
    pathname.startsWith("/pos") ||
    pathname === "/scanner" ||
    pathname.startsWith("/scanner") ||
    pathname === "/receipts" ||
    pathname.startsWith("/receipts") ||
    pathname === "/invoices" ||
    pathname.startsWith("/invoices") ||
    pathname === "/customers" ||
    pathname.startsWith("/customers") ||
    pathname === "/products" ||
    pathname.startsWith("/products")
  ) {
    return true;
  }

  return true;
}

/**
 * ============================================================================
 * 3. PRODUCT COST PRICE SANITIZATION
 * ============================================================================
 * Cashiers MUST NEVER see the store's buying price ("costPrice").
 * These helpers strip `costPrice` from product objects when sent to cashiers.
 */
export function sanitizeProductForRole<T extends Record<string, any>>(
  product: T,
  role?: UserRole
): T {
  if (role === "cashier") {
    const { costPrice, ...rest } = product;
    return { ...rest, costPrice: undefined } as unknown as T;
  }
  return product;
}

export function sanitizeProductsForRole<T extends Record<string, any>>(
  products: T[],
  role?: UserRole
): T[] {
  if (role === "cashier") {
    return products.map((p) => sanitizeProductForRole(p, role));
  }
  return products;
}

/**
 * ============================================================================
 * 4. PASSWORD HASHING & VERIFICATION (BCRYPTJS)
 * ============================================================================
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * ============================================================================
 * 5. JWT TOKEN SIGNING & VERIFICATION (JOSE)
 * ============================================================================
 */
function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(
    process.env.JWT_SECRET || "2df15539fc1002b30987f5573304401315d39068384f2bbcd186a352264b4b38"
  );
}

/**
 * Creates a signed HS256 JWT session token.
 * If rememberMe is checked, expires in 30 days; otherwise expires in 12 hours.
 */
export async function createToken(user: SessionUser, rememberMe = false): Promise<string> {
  const expiresIn = rememberMe ? "30d" : "12h";
  return await new SignJWT({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretKey());
}

/** Verifies a JWT and returns the SessionUser payload, or null if invalid/expired. */
export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.id === "number" &&
      typeof payload.username === "string" &&
      typeof payload.fullName === "string" &&
      (payload.role === "owner" || payload.role === "manager" || payload.role === "cashier")
    ) {
      return {
        id: payload.id,
        username: payload.username,
        fullName: payload.fullName,
        role: payload.role as UserRole,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * ============================================================================
 * 6. SERVER-SIDE CURRENT USER FETCHER (APP ROUTER / COOKIES)
 * ============================================================================
 */

/**
 * Reads the active session cookie in Next.js Server Components / API routes,
 * verifies the JWT token, and returns the SessionUser.
 *
 * In local development, if no session cookie is present, it returns DEFAULT_USER
 * so development testing continues seamlessly without requiring repeated logins.
 */
export async function getCurrentUser(): Promise<SessionUser> {
  if (typeof window === "undefined") {
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      if (token) {
        const user = await verifyToken(token);
        if (user) {
          return user;
        }
      }
    } catch {
      // Cookie store unavailable outside server component request context
    }
  }

  if (process.env.NEXT_PHASE === "phase-production-build") {
    return DEFAULT_USER;
  }

  throw new Error("Unauthorized: login required.");
}

/**
 * Ensures the active user has one of the allowed roles, throwing an Error if forbidden.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized: login required.");
  }

  if (!allowedRoles.includes(user.role)) {
    throw new Error(`Forbidden: requires one of [${allowedRoles.join(", ")}], but user is '${user.role}'.`);
  }
  return user;
}
