import type { Role } from "@/lib/roles"

export type OrderRole = Exclude<Role, "staff_member">
