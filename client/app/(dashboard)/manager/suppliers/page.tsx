import { Suspense } from "react"

import { SuppliersView } from "@/components/suppliers-view"

export default function SuppliersPage() {
  return (
    <Suspense fallback={null}>
      <SuppliersView />
    </Suspense>
  )
}
