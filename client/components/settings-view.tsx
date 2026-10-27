"use client"

import * as React from "react"

import { PageHeader } from "@/components/data/page-header"
import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type BusinessSettings = {
  name: string
  address: string
  phone: string
  email: string
  currency: string
  default_min: number
  low_stock_alerts: boolean
  order_alerts: boolean
  weekly_summary: boolean
}

async function requestSettings(
  method: "GET" | "PATCH",
  settings?: BusinessSettings
): Promise<BusinessSettings> {
  const response = await fetch("/api/inventory/settings", {
    method,
    headers: settings ? { "Content-Type": "application/json" } : undefined,
    body: settings ? JSON.stringify(settings) : undefined,
    cache: "no-store",
  })
  const result = (await response.json().catch(() => ({}))) as {
    settings?: BusinessSettings
    error?: string
  }
  if (!response.ok || !result.settings) {
    throw new Error(result.error ?? "Unable to load or save business settings")
  }
  return result.settings
}

export function SettingsView() {
  const [settings, setSettings] = React.useState<BusinessSettings | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    let active = true
    requestSettings("GET")
      .then((result) => {
        if (active) setSettings(result)
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Unable to load settings")
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  function update<K extends keyof BusinessSettings>(
    field: K,
    value: BusinessSettings[K]
  ) {
    setSettings((current) => current ? { ...current, [field]: value } : current)
    setSaved(false)
    setError("")
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!settings) return
    setSaving(true)
    setSaved(false)
    setError("")
    try {
      setSettings(await requestSettings("PATCH", settings))
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <PageHeader
        title="Settings"
        description="Business profile and notification preferences."
        actions={
          <div className="flex items-center gap-3">
            {saved && (
              <span role="status" className="text-xs text-green-600 dark:text-green-400">
                Saved
              </span>
            )}
            <Button type="submit" className="rounded-sm" disabled={!settings || loading || saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      />

      {loading && <p role="status" className="text-sm text-muted-foreground">Loading settings…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {settings && (
        <>
          <Panel
            title="Business profile"
            description="Used on purchase orders and exported reports."
          >
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <Field
                id="business-name"
                label="Business name"
                value={settings.name}
                onChange={(value) => update("name", value)}
                required
              />
              <Field
                id="business-email"
                label="Email"
                type="email"
                value={settings.email}
                onChange={(value) => update("email", value)}
              />
              <Field
                id="business-address"
                label="Address"
                value={settings.address}
                onChange={(value) => update("address", value)}
                className="sm:col-span-2"
              />
              <Field
                id="business-phone"
                label="Phone"
                value={settings.phone}
                onChange={(value) => update("phone", value)}
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="business-currency">Currency</Label>
                <Input id="business-currency" value={settings.currency} disabled />
              </div>
            </div>
          </Panel>

          <Panel
            title="Alerts and reorders"
            description="Saved preferences for inventory notifications."
          >
            <div className="flex flex-col gap-3 p-4">
              <div className="flex max-w-xs flex-col gap-1.5">
                <Label htmlFor="default-min">Default minimum for a new product</Label>
                <Input
                  id="default-min"
                  type="number"
                  min={0}
                  step={1}
                  value={settings.default_min}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    if (Number.isSafeInteger(value) && value >= 0) {
                      update("default_min", value)
                    }
                  }}
                  disabled={saving}
                />
              </div>
              <Toggle
                checked={settings.low_stock_alerts}
                title="Low stock"
                description="Preference for alerts when stock reaches its minimum."
                disabled={saving}
                onChange={(value) => update("low_stock_alerts", value)}
              />
              <Toggle
                checked={settings.order_alerts}
                title="Orders waiting"
                description="Preference for alerts when a purchase order needs attention."
                disabled={saving}
                onChange={(value) => update("order_alerts", value)}
              />
              <Toggle
                checked={settings.weekly_summary}
                title="Monday summary"
                description="Preference for a weekly summary of recorded sales."
                disabled={saving}
                onChange={(value) => update("weekly_summary", value)}
              />
              <p className="text-xs text-muted-foreground">
                Preferences are stored with your business settings. Email delivery is not configured.
              </p>
            </div>
          </Panel>
        </>
      )}
    </form>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  className,
  required = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: React.HTMLInputTypeAttribute
  className?: string
  required?: boolean
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </div>
  )
}

function Toggle({
  checked,
  title,
  description,
  disabled,
  onChange,
}: {
  checked: boolean
  title: string
  description: string
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 rounded-sm border px-3 py-3">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
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
