import type { OrderStatus } from "../order-status";

export type Role = "owner" | "manager" | "writer" | "fulfilment";
export const ROLES: Role[] = ["owner", "manager", "writer", "fulfilment"];
export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner", manager: "Manager", writer: "Letter writer", fulfilment: "Packing & delivery",
};

export type Permission =
  | "orders.view" | "orders.status" | "orders.assign" | "orders.notes" | "orders.export" | "orders.quote"
  | "customers.pii" | "letters.view" | "letters.edit"
  | "payments.view" | "payments.refund" | "payments.manual"
  | "products.edit" | "inventory.edit" | "delivery.edit"
  | "nfc.edit" | "nfc.write" | "messages.view" | "analytics.view"
  | "staff.manage" | "settings.edit" | "audit.view";

const ALL: Permission[] = [
  "orders.view", "orders.status", "orders.assign", "orders.notes", "orders.export", "orders.quote",
  "customers.pii", "letters.view", "letters.edit", "payments.view", "payments.refund", "payments.manual",
  "products.edit", "inventory.edit", "delivery.edit", "nfc.edit", "nfc.write", "messages.view",
  "analytics.view", "staff.manage", "settings.edit", "audit.view",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL,
  manager: ALL.filter((p) => p !== "staff.manage"),
  // Writers see the letter brief but not addresses, phone numbers or payments.
  writer: ["orders.view", "orders.status", "orders.notes", "letters.view", "letters.edit", "nfc.edit", "messages.view"],
  // Packing & delivery see addresses but not the private letter brief or payments.
  fulfilment: ["orders.view", "orders.status", "orders.notes", "customers.pii", "inventory.edit", "nfc.write", "messages.view"],
};

/** Which statuses each role may move an order into. */
export const ROLE_TARGET_STATUSES: Record<Role, OrderStatus[] | "all"> = {
  owner: "all",
  manager: "all",
  writer: ["drafting", "awaiting_approval", "in_production"],
  fulfilment: ["in_production", "packed", "dispatched", "delivered", "delivery_failed"],
};

export function can(role: Role, p: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(p) ?? false;
}

export function canMoveTo(role: Role, to: OrderStatus): boolean {
  const t = ROLE_TARGET_STATUSES[role];
  return t === "all" || t.includes(to);
}

/** Owners and managers must use two-factor sign-in. */
export function mfaRequired(role: Role) {
  return role === "owner" || role === "manager";
}
