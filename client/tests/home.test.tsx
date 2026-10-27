import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import Home from "@/app/page"

describe("home page", () => {
  it("introduces the inventory app and links to account actions", () => {
    render(<Home />)

    expect(
      screen.getByRole("heading", {
        name: "Know what you have. Keep business moving.",
      })
    ).toBeInTheDocument()
    const navigation = within(
      screen.getByRole("navigation", { name: "Main navigation" })
    )
    expect(navigation.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login"
    )
    expect(
      screen.getByRole("link", { name: "Create your account" })
    ).toHaveAttribute("href", "/register")
  })
})
