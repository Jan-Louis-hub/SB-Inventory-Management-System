import { Suspense } from "react"
import { InventoryView } from "@/components/inventory/inventory-view"

export const instant = false

export default function ControllerStockPage() {
  return (
    <Suspense fallback={null}>
      <InventoryView role="stock_controller" />
    </Suspense>
  )
}