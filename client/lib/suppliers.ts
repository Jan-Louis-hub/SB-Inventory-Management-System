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

// Wholesalers Harbour Lane buys clothing from.
export const SUPPLIERS: Supplier[] = [
  {
    id: "SUP-01",
    name: "Cape Cloth Co.",
    contact: "Nomsa Jacobs",
    email: "orders@capecloth.co.za",
    phone: "+27 21 461 2200",
    city: "Cape Town",
    leadDays: 7,
    categories: "Tops and dresses",
  },
  {
    id: "SUP-02",
    name: "Highveld Denim",
    contact: "Pieter van Wyk",
    email: "sales@highvelddenim.co.za",
    phone: "+27 11 883 4410",
    city: "Johannesburg",
    leadDays: 10,
    categories: "Bottoms and outerwear",
  },
  {
    id: "SUP-03",
    name: "Karoo Knitwear",
    contact: "Anri Botha",
    email: "hello@karooknit.co.za",
    phone: "+27 44 874 1190",
    city: "George",
    leadDays: 14,
    categories: "Knitwear",
  },
  {
    id: "SUP-04",
    name: "Sole & Stitch",
    contact: "Fatima Essop",
    email: "wholesale@soleandstitch.co.za",
    phone: "+27 31 304 7788",
    city: "Durban",
    leadDays: 8,
    categories: "Footwear and accessories",
  },
  {
    id: "SUP-05",
    name: "Little Thread",
    contact: "Busi Mthembu",
    email: "orders@littlethread.co.za",
    phone: "+27 12 346 9021",
    city: "Pretoria",
    leadDays: 6,
    categories: "Kidswear",
  },
]

export function getSuppliers() {
  return SUPPLIERS.map((supplier) => ({ ...supplier }))
}
