"use client"

import { useRouter } from "next/navigation"
import {
  BellRing,
  CircleHelp,
  History,
  LogOut,
  User,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function UserMenu({
  home,
  roleLabel,
  name = "Jane Doe",
  email = "jane@example.com",
}: {
  home: string // e.g. "/manager"
  roleLabel: string
  name?: string
  email?: string
}) {
  const router = useRouter()

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open user menu"
        className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="size-9 cursor-pointer">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">{email}</span>
            <span className="mt-1 w-fit rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">
              {roleLabel}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => router.push(`${home}/profile`)}>
          <User />
          My profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`${home}/activity`)}>
          <History />
          My activity
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push(`${home}/notification-preferences`)}
        >
          <BellRing />
          Notification preferences
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => router.push("/help")}>
          <CircleHelp />
          Help and support
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}