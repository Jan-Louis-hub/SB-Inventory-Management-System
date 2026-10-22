"use client"

import { useSearchParams } from "next/navigation"

// The header search adds ?q=... to the URL. Pages read it with this.
export function useSearchQuery(param = "q") {
  return (useSearchParams().get(param) ?? "").trim().toLowerCase()
}