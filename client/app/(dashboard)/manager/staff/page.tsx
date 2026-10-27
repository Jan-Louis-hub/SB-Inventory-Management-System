import { Suspense } from "react"

import { StaffView } from "@/components/staff-view"

export const instant = false

export default function StaffPage() {
  return (
    <Suspense fallback={null}>
      <StaffView />
    </Suspense>
  )
}
