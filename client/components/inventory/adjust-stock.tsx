"use client"

import * as React from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { Product } from "@/lib/inventory"

export function AdjustStock({
  product,
  onAdjust,
}: {
  product: Product
  onAdjust: (delta: number, reason: string) => Promise<void>
}) {
  const [open, setOpen] = React.useState(false)
  const [qty, setQty] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const n = Number.parseInt(qty, 10)
  const valid = Number.isInteger(n) && n > 0 && reason.trim().length > 0
  const tooMany = Number.isInteger(n) && n > product.stock

  async function apply(sign: 1 | -1) {
    if (!valid) return
    setSaving(true)
    setError("")
    try {
      await onAdjust(sign * n, reason.trim())
      setQty("")
      setReason("")
      setOpen(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record stock movement")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-8 rounded-sm px-3"
        )}
      >
        Adjust
      </PopoverTrigger>

      <PopoverContent align="end" className="flex w-64 flex-col gap-3 p-3">
        <div>
          <p className="text-sm font-medium">{product.name}</p>
          <p className="text-xs text-muted-foreground">
            Currently {product.stock} {product.unit}
          </p>
        </div>

        <Input
          type="number"
          min={1}
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Quantity"
          aria-label="Quantity"
        />
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason"
          aria-label="Reason"
          maxLength={255}
        />
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

        {tooMany && (
          <p className="text-xs text-destructive">
            Only {product.stock} in stock, so you can&apos;t remove more.
          </p>
        )}

        <div className="flex gap-2">
          <Button 
            size="sm"
            className="flex-1 rounded-sm"
            disabled={!valid || saving}
            onClick={() => apply(1)}
          >
            Stock in
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 rounded-sm"
            disabled={!valid || tooMany || saving}
            onClick={() => apply(-1)}
          >
            Stock out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}