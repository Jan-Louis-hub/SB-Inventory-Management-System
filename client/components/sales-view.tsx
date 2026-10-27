"use client"

import * as React from "react"
import { PageHeader } from "@/components/data/page-header"
import { Button } from "@/components/ui/button"
import { money } from "@/lib/format"
import { listInventory } from "@/lib/inventory-api"
import type { Product } from "@/lib/inventory"
import { listSales, recordSale, type SaleRecord } from "@/lib/sales-api"

type CartLine = { product: Product; quantity: number }

export function SalesView() {
  const [products, setProducts] = React.useState<Product[]>([])
  const [sales, setSales] = React.useState<SaleRecord[]>([])
  const [cart, setCart] = React.useState<CartLine[]>([])
  const [productId, setProductId] = React.useState("")
  const [quantity, setQuantity] = React.useState("1")
  const [search, setSearch] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")
  const [notice, setNotice] = React.useState("")

  React.useEffect(() => {
    let active = true
    Promise.all([listInventory(), listSales()])
      .then(([inventory, saleRows]) => {
        if (!active) return
        setProducts(inventory.products)
        setSales(saleRows)
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Could not load sales")
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  function addToCart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const product = products.find((item) => item.id === productId)
    const amount = Number(quantity)
    if (!product || !Number.isInteger(amount) || amount < 1) {
      setError("Select a product and enter a whole quantity greater than zero.")
      return
    }
    const inCart = cart.find((line) => line.product.id === product.id)?.quantity ?? 0
    if (inCart + amount > product.stock) {
      setError(`Only ${product.stock} ${product.unit} of ${product.name} are in stock.`)
      return
    }
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id)
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: line.quantity + amount }
            : line
        )
      }
      return [...current, { product, quantity: amount }]
    })
    setProductId("")
    setQuantity("1")
    setError("")
  }

  async function submitSale() {
    if (!cart.length) {
      setError("Add at least one product before recording the sale.")
      return
    }
    setSaving(true)
    setError("")
    setNotice("")
    let sale: SaleRecord
    try {
      sale = await recordSale({
        items: cart.map(({ product, quantity: amount }) => ({
          product_id: Number(product.id),
          quantity: amount,
        })),
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record sale")
      setSaving(false)
      return
    }

    setCart([])
    setNotice(`Sale ${sale.sale_number} was recorded.`)
    try {
      const [inventory, saleRows] = await Promise.all([listInventory(), listSales()])
      setProducts(inventory.products)
      setSales(saleRows)
    } catch {
      setError("The sale was recorded, but the latest inventory and sales could not be refreshed.")
    } finally {
      setSaving(false)
    }
  }

  const filteredSales = sales.filter((sale) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return [
      sale.sale_number,
      sale.status,
      ...sale.items.flatMap((item) => [item.product_name, item.sku]),
    ].some((value) => value.toLowerCase().includes(query))
  })

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Sales"
        description="Record customer sales and review recent completed transactions."
      />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-4 rounded-sm border bg-card p-4">
          <div>
            <h2 className="font-semibold">New sale</h2>
            <p className="text-sm text-muted-foreground">Stock is deducted when the sale is saved.</p>
          </div>
          <form onSubmit={addToCart} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Product
              <select
                required
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                className="h-9 rounded-sm border bg-background px-2"
                disabled={loading}
              >
                <option value="">Select a product</option>
                {products.filter((product) => product.stock > 0).map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} · {product.name} ({product.stock} {product.unit})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Quantity
              <input
                required
                min="1"
                step="1"
                type="number"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="h-9 rounded-sm border bg-background px-2"
              />
            </label>
            <Button type="submit" variant="outline" className="self-start rounded-sm" disabled={loading}>
              Add product
            </Button>
          </form>

          <div className="border-t pt-3">
            <h3 className="text-sm font-medium">Sale items</h3>
            {cart.length ? (
              <ul className="mt-2 divide-y">
                {cart.map(({ product, quantity: amount }) => (
                  <li key={product.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>{product.name} <span className="text-muted-foreground">× {amount}</span></span>
                    <button
                      type="button"
                      aria-label={`Remove ${product.name}`}
                      className="text-sm text-destructive hover:underline"
                      onClick={() => setCart((current) => current.filter((line) => line.product.id !== product.id))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No products added.</p>
            )}
          </div>
          <Button
            type="button"
            className="self-start rounded-sm"
            disabled={saving || loading || cart.length === 0}
            onClick={() => void submitSale()}
          >
            {saving ? "Recording…" : "Record sale"}
          </Button>
        </div>

        <div className="flex min-w-0 flex-col gap-3 rounded-sm border bg-card p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-semibold">Sales history</h2>
              <p className="text-sm text-muted-foreground">Latest completed transactions.</p>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              Search sales
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Sale number, product, or SKU"
                className="h-9 rounded-sm border bg-background px-2"
              />
            </label>
          </div>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading sales…</p>
          ) : filteredSales.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">Sale</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Items</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Date</th>
                    <th scope="col" className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="py-3 pr-3 font-mono text-xs">{sale.sale_number}</td>
                      <td className="max-w-56 py-3 pr-3">
                        {sale.items.map((item) => `${item.product_name} × ${item.quantity}`).join(", ")}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-3 text-muted-foreground">
                        {new Date(sale.sold_at).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap py-3 text-right font-medium tabular-nums">
                        {money.format(Number(sale.total_amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search ? "No sales match your search." : "No sales recorded yet."}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
