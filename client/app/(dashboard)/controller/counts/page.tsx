import { Suspense } from "react"

import { CountsView } from "@/components/counts-view"

export default function CountsPage() {
  return (
    <Suspense fallback={null}>
      <CountsView />
    </Suspense>
  )
}
