export type Supplier = {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  city: string
  leadDays: number
  categories: string
}

const SUPPLIERS: Supplier[] = []

export function getSuppliers() {
  return SUPPLIERS.map((supplier) => ({ ...supplier }))
}
