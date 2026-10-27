import { Suspense } from "react"
import { InventoryView } from "@/components/inventory/inventory-view"

export const instant = false

export default function StaffInventoryPage() {
  return (
    <Suspense fallback={null}>
      <InventoryView role="staff_member" />
    </Suspense>
  )
}