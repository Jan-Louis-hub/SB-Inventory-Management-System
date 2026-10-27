import { Suspense } from "react"
import { OrdersView } from "@/components/orders-view"

export const instant = false

export default function ManagerOrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersView role="inventory_manager" />
    </Suspense>
  )
}