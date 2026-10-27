import { Suspense } from "react"

import { RequestsView } from "@/components/requests-view"

export const instant = false

export default function RequestsPage() {
  return (
    <Suspense fallback={null}>
      <RequestsView />
    </Suspense>
  )
}
