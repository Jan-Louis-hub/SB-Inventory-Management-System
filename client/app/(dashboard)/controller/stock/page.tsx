import { Suspense } from "react"
import { InventoryView } from "@/components/inventory/inventory-view"

export default function ControllerStockPage() {
  return (
    <Suspense fallback={null}>
      <InventoryView role="stock_controller" />
    </Suspense>
  )
}