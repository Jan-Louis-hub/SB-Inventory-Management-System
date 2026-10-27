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

const TEAM: TeamMember[] = []

export function getTeam() {
  return TEAM.map((member) => ({ ...member }))
}
