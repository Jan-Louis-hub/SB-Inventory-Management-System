import { Suspense } from "react"
import { InventoryView } from "@/components/inventory/inventory-view"

export default function StaffInventoryPage() {
  return (
    <Suspense fallback={null}>
      <InventoryView role="staff_member" />
    </Suspense>
  )
}