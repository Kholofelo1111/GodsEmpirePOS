import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Users,
  Truck,
  Warehouse,
  Settings,
  ScanLine,
  ArrowDownCircle,
  Receipt,
  FileText,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  roles: ("owner" | "manager" | "cashier")[];
}

export const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard, roles: ["owner", "manager"] },
  { href: "/pos", label: "Point of Sale", short: "Sell", icon: ShoppingCart, roles: ["owner", "manager", "cashier"] },
  { href: "/scanner", label: "Barcode Scanner", short: "Scan", icon: ScanLine, roles: ["owner", "manager", "cashier"] },
  { href: "/products", label: "Products", short: "Items", icon: Package, roles: ["owner", "manager"] },
  { href: "/inventory", label: "Inventory", short: "Stock", icon: Warehouse, roles: ["owner", "manager"] },
  { href: "/stock-in", label: "Stock In", short: "Receive", icon: ArrowDownCircle, roles: ["owner", "manager"] },
  { href: "/receipts", label: "Receipts", short: "Sales", icon: Receipt, roles: ["owner", "manager", "cashier"] },
  { href: "/invoices", label: "Invoices", short: "Invoice", icon: FileText, roles: ["owner", "manager"] },
  { href: "/reports", label: "Reports", short: "Reports", icon: BarChart3, roles: ["owner", "manager"] },
  { href: "/customers", label: "Customers", short: "Clients", icon: Users, roles: ["owner", "manager", "cashier"] },
  { href: "/suppliers", label: "Suppliers", short: "Vendors", icon: Truck, roles: ["owner", "manager"] },
  { href: "/settings", label: "Settings", short: "Setup", icon: Settings, roles: ["owner"] },
];

/** Items shown in the mobile bottom bar (the 5th slot is a "More" button). */
export const mobileNavItems: NavItem[] = [
  navItems[0], // Dashboard
  navItems[1], // POS
  navItems[2], // Scanner
  navItems[3], // Products
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
