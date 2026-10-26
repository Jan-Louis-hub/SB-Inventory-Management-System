import { Suspense } from "react"

import { ReportsView } from "@/components/reports-view"

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsView />
    </Suspense>
  )
}
