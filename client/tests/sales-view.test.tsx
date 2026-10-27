import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { listInventory } from "@/lib/inventory-api"
import { listSales, recordSale, type SaleRecord } from "@/lib/sales-api"
import { SalesView } from "@/components/sales-view"

vi.mock("@/lib/inventory-api", () => ({
  listInventory: vi.fn(),
}))

vi.mock("@/lib/sales-api", () => ({
  listSales: vi.fn(),
  recordSale: vi.fn(),
}))

const product = {
  id: "17",
  sku: "TEE-001",
  name: "Blue Tee",
  category: "Tops",
  location: "A1",
  unit: "units",
  stock: 8,
  min: 2,
  supplier: "",
  cost: 5,
}

const sale: SaleRecord = {
  id: 1,
  sale_number: "SALE-TEST-1",
  status: "completed",
  subtotal: "20.00",
  discount_amount: "0.00",
  tax_amount: "0.00",
  total_amount: "20.00",
  sold_at: "2026-10-27T10:00:00+00:00",
  items: [
    {
      product_id: 17,
      product_name: "Blue Tee",
      sku: "TEE-001",
      quantity: 2,
      unit_price: "10.00",
      line_total: "20.00",
    },
  ],
}

beforeEach(() => {
  vi.mocked(listInventory).mockResolvedValue({
    products: [product],
    categories: [],
    suppliers: [],
  })
  vi.mocked(listSales).mockResolvedValue([])
  vi.mocked(recordSale).mockResolvedValue(sale)
})

describe("sales view", () => {
  it("records a sale and refreshes the sales history", async () => {
    vi.mocked(listSales).mockResolvedValueOnce([]).mockResolvedValue([sale])
    render(<SalesView />)

    fireEvent.change(await screen.findByLabelText("Product"), {
      target: { value: product.id },
    })
    fireEvent.change(screen.getByLabelText("Quantity"), {
      target: { value: "2" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add product" }))
    expect(screen.getByText("Blue Tee").closest("li")).toHaveTextContent("× 2")

    fireEvent.click(screen.getByRole("button", { name: "Record sale" }))

    await waitFor(() => {
      expect(recordSale).toHaveBeenCalledWith({
        items: [{ product_id: 17, quantity: 2 }],
      })
    })
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Sale SALE-TEST-1 was recorded."
    )
    expect(await screen.findByText("SALE-TEST-1")).toBeInTheDocument()
  })

  it("rejects quantities exceeding available stock", async () => {
    render(<SalesView />)

    fireEvent.change(await screen.findByLabelText("Product"), {
      target: { value: product.id },
    })
    fireEvent.change(screen.getByLabelText("Quantity"), {
      target: { value: "9" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add product" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only 8 units of Blue Tee are in stock."
    )
    expect(recordSale).not.toHaveBeenCalled()
  })

  it("reports inventory loading errors", async () => {
    vi.mocked(listInventory).mockRejectedValueOnce(new Error("Backend unavailable"))
    render(<SalesView />)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Backend unavailable"
    )
  })
})
