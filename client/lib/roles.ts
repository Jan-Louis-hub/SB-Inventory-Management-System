
export const ROLES = {
  inventory_manager: { label: "Inventory Manager", home: "/manager" },
  stock_controller: { label: "Stock Controller", home: "/controller" },
  staff_member: { label: "Staff Member", home: "/staff" },
} as const

export type Role = keyof typeof ROLES

export const accountTypes = (
  Object.entries(ROLES) as [Role, (typeof ROLES)[Role]][]
).map(([value, { label }]) => ({ value, label }))