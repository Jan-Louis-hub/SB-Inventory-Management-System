import { Suspense } from "react"
import { InventoryView } from "@/components/inventory/inventory-view"

export default function ManagerInventoryPage() {
  return (
    <Suspense fallback={null}>
      <InventoryView role="inventory_manager" />
    </Suspense>
  )
}