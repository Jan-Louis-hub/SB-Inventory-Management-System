import type { Role } from "@/lib/roles"

export type TeamStatus = "active" | "leave"

export type TeamMember = {
  id: string
  name: string
  email: string
  role: Role
  area: string
  status: TeamStatus
}

// People who run Harbour Lane. The signed-in demo account is separate.
export const TEAM: TeamMember[] = [
  {
    id: "TM-01",
    name: "Thandi Mahlangu",
    email: "thandi@harbourlane.co.za",
    role: "inventory_manager",
    area: "Office",
    status: "active",
  },
  {
    id: "TM-02",
    name: "James Nkosi",
    email: "james@harbourlane.co.za",
    role: "stock_controller",
    area: "Back room",
    status: "active",
  },
  {
    id: "TM-03",
    name: "Amahle Dlamini",
    email: "amahle@harbourlane.co.za",
    role: "staff_member",
    area: "Women's floor",
    status: "active",
  },
  {
    id: "TM-04",
    name: "Lerato Molefe",
    email: "lerato@harbourlane.co.za",
    role: "staff_member",
    area: "Men's floor",
    status: "active",
  },
  {
    id: "TM-05",
    name: "Sipho Khumalo",
    email: "sipho@harbourlane.co.za",
    role: "staff_member",
    area: "Window",
    status: "leave",
  },
]

export function getTeam() {
  return TEAM.map((member) => ({ ...member }))
}
