import { Suspense } from "react"
import { OrdersView } from "@/components/orders-view"

export const instant = false

export default function ControllerOrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersView role="stock_controller" />
    </Suspense>
  )
}