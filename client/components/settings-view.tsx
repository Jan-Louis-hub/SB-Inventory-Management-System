"use client"

import * as React from "react"

import { PageHeader } from "@/components/data/page-header"
import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SHOP } from "@/lib/shop"

export function SettingsView() {
  const [name, setName] = React.useState(SHOP.name)
  const [address, setAddress] = React.useState(SHOP.address)
  const [phone, setPhone] = React.useState(SHOP.phone)
  const [email, setEmail] = React.useState(SHOP.email)
  const [defaultMin, setDefaultMin] = React.useState("8")
  const [lowStock, setLowStock] = React.useState(true)
  const [orderEmails, setOrderEmails] = React.useState(true)
  const [weeklySummary, setWeeklySummary] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [error, setError] = React.useState("")

  function touch() {
    setSaved(false)
    setError("")
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    const minimum = Number.parseInt(defaultMin, 10)
    if (!name.trim() || !email.trim()) {
      setError("Shop name and email are required.")
      return
    }
    if (!Number.isInteger(minimum) || minimum < 0) {
      setError("Default minimum has to be zero or more.")
      return
    }
    setError("")
    setSaved(true)
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <PageHeader
        title="Settings"
        description="Shop profile and the alerts this shop sends."
        actions={
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-xs text-green-600 dark:text-green-400">
                Saved
              </span>
            )}
            <Button type="submit" className="rounded-sm">
              Save changes
            </Button>
          </div>
        }
      />

      <Panel
        title="Shop profile"
        description="Used on purchase orders and exported reports."
      >
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shop-name">Shop name</Label>
            <Input
              id="shop-name"
              value={name}
              onChange={(event) => {
                touch()
                setName(event.target.value)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shop-email">Email</Label>
            <Input
              id="shop-email"
              type="email"
              value={email}
              onChange={(event) => {
                touch()
                setEmail(event.target.value)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="shop-address">Address</Label>
            <Input
              id="shop-address"
              value={address}
              onChange={(event) => {
                touch()
                setAddress(event.target.value)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shop-phone">Phone</Label>
            <Input
              id="shop-phone"
              value={phone}
              onChange={(event) => {
                touch()
                setPhone(event.target.value)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Currency</Label>
            <p className="flex h-8 items-center text-sm">{SHOP.currency}</p>
          </div>
        </div>
      </Panel>

      <Panel
        title="Alerts and reorders"
        description="What the inventory manager hears about."
      >
        <div className="flex flex-col gap-3 p-4">
          <div className="flex max-w-xs flex-col gap-1.5">
            <Label htmlFor="default-min">Default minimum for a new style</Label>
            <Input
              id="default-min"
              type="number"
              min={0}
              value={defaultMin}
              onChange={(event) => {
                touch()
                setDefaultMin(event.target.value)
              }}
            />
          </div>

          <Toggle
            checked={lowStock}
            title="Low stock"
            description="Email when a style falls under its minimum."
            onChange={(checked) => {
              touch()
              setLowStock(checked)
            }}
          />
          <Toggle
            checked={orderEmails}
            title="Orders waiting"
            description="Email when a purchase order needs approval."
            onChange={(checked) => {
              touch()
              setOrderEmails(checked)
            }}
          />
          <Toggle
            checked={weeklySummary}
            title="Monday summary"
            description="A short note of what sold over the weekend."
            onChange={(checked) => {
              touch()
              setWeeklySummary(checked)
            }}
          />

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </Panel>
    </form>
  )
}

function Toggle({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean
  title: string
  description: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 rounded-sm border px-3 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 accent-foreground"
      />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  )
}
