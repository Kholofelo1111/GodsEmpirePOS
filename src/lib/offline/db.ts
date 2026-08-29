"use client";

/**
 * Offline data layer (POS + Inventory only, single-device — no
 * multi-device conflict resolution, per explicit decision).
 *
 * This is scoped to what was asked: it keeps the till and stock usable
 * when a device that already has the app open loses connectivity mid-
 * session. It does NOT solve a fully offline cold start (Capacitor still
 * loads the app shell from the live server.url — a device with zero
 * signal at launch cannot open the app at all yet). See the project
 * README/report for that remaining, larger piece of work.
 *
 * Uses IndexedDB directly (native browser/WebView API) rather than a
 * library, per "avoid unnecessary dependencies".
 */

const DB_NAME = "godsempire_offline";
// Bumped to 2 to add the local_sessions store (see localAuth.ts). Both
// modules must agree on one version number and one upgrade path — see
// openDb(), which is now exported so localAuth.ts reuses this exact
// connection logic instead of opening the same database separately.
const DB_VERSION = 2;

export const STORES = {
  products: "cached_products",
  pendingSales: "pending_sales",
  pendingStockAdjustments: "pending_stock_adjustments",
  localSessions: "local_sessions",
} as const;

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.products)) {
        db.createObjectStore(STORES.products, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.pendingSales)) {
        db.createObjectStore(STORES.pendingSales, { keyPath: "localId" });
      }
      if (!db.objectStoreNames.contains(STORES.pendingStockAdjustments)) {
        db.createObjectStore(STORES.pendingStockAdjustments, { keyPath: "localId" });
      }
      if (!db.objectStoreNames.contains(STORES.localSessions)) {
        db.createObjectStore(STORES.localSessions, { keyPath: "username" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAll<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

// ---- Product cache (for offline reads: prices, stock, barcodes) ----

export async function cacheProducts(products: unknown[]): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORES.products, "readwrite");
    const store = tx.objectStore(STORES.products);
    store.clear();
    for (const p of products) store.put(p);
  } catch {
    // Non-critical — worst case, offline reads fall back to whatever was
    // already in memory for this session.
  }
}

export async function getCachedProducts<T>(): Promise<T[]> {
  return getAll<T>(STORES.products);
}

// ---- Pending sales queue ----

export interface PendingSale {
  localId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export async function queueSale(payload: Record<string, unknown>): Promise<PendingSale> {
  const operationId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const entry: PendingSale = {
    localId: operationId,
    payload: { ...payload, operationId },
    createdAt: new Date().toISOString(),
  };
  await withStore(STORES.pendingSales, "readwrite", (s) => s.put(entry));
  return entry;
}

export async function getPendingSales(): Promise<PendingSale[]> {
  return getAll<PendingSale>(STORES.pendingSales);
}

export async function removePendingSale(localId: string): Promise<void> {
  await withStore(STORES.pendingSales, "readwrite", (s) => s.delete(localId));
}

// ---- Pending stock adjustments queue ----

export interface PendingStockAdjustment {
  localId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export async function queueStockAdjustment(payload: Record<string, unknown>): Promise<PendingStockAdjustment> {
  const operationId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const entry: PendingStockAdjustment = {
    localId: operationId,
    payload: { ...payload, operationId },
    createdAt: new Date().toISOString(),
  };
  await withStore(STORES.pendingStockAdjustments, "readwrite", (s) => s.put(entry));
  return entry;
}

export async function getPendingStockAdjustments(): Promise<PendingStockAdjustment[]> {
  return getAll<PendingStockAdjustment>(STORES.pendingStockAdjustments);
}

export async function removePendingStockAdjustment(localId: string): Promise<void> {
  await withStore(STORES.pendingStockAdjustments, "readwrite", (s) => s.delete(localId));
}

export async function pendingCount(): Promise<number> {
  const [sales, adjustments] = await Promise.all([getPendingSales(), getPendingStockAdjustments()]);
  return sales.length + adjustments.length;
}
