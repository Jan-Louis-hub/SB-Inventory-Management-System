"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"

export function HeaderSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = React.useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname)
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        aria-label="Search"
        className="h-9 pl-8"
      />
    </form>
  )
}