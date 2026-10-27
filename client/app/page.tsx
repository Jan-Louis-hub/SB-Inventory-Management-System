import Link from "next/link"
import { ArrowRight, BarChart3, Boxes, ClipboardCheck, Package } from "lucide-react"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="size-5" aria-hidden="true" />
          </span>
          SB Inventory
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-3">
          <Link href="/login" className="rounded-sm px-3 py-2 text-sm font-medium hover:bg-muted">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-[1.2fr_0.8fr] md:items-center md:py-28">
        <div className="flex flex-col items-start gap-6">
          <p className="rounded-full border px-3 py-1 text-sm text-muted-foreground">
            Inventory, made manageable
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Know what you have. Keep business moving.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-muted-foreground">
            Track stock, coordinate your team, and stay on top of orders from one
            straightforward workspace built for small businesses.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Create your account <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/login"
              className="rounded-sm border px-5 py-3 text-sm font-medium hover:bg-muted"
            >
              Sign in
            </Link>
          </div>
        </div>

        <div className="grid gap-3">
          {[
            { icon: Package, title: "Inventory at a glance", detail: "See stock levels and what needs attention." },
            { icon: ClipboardCheck, title: "Team workflows", detail: "Coordinate requests, counts, and receiving." },
            { icon: BarChart3, title: "Clear business reports", detail: "Review movements and understand stock value." },
          ].map(({ icon: Icon, title, detail }) => (
            <div key={title} className="flex items-start gap-4 rounded-md border bg-card p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-muted">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-medium">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
