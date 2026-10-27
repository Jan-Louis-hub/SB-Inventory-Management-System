export type Supplier = {
  id: number
  name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  lead_days: number
  categories: string | null
}

export async function getSuppliers(): Promise<Supplier[]> {
  const response = await fetch("/api/inventory/suppliers", { cache: "no-store" })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error ?? "Could not load suppliers")
  return result.suppliers
}

export async function addSupplier(input: Omit<Supplier, "id">) {
  const response = await fetch("/api/inventory/suppliers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error ?? "Could not save supplier")
  return result.supplier as Supplier
}
