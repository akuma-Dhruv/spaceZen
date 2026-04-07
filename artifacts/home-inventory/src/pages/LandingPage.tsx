import { Link } from "wouter";
import { Package, Search, Layers, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg tracking-tight">Inventory</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link href="/sign-up">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center py-24">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-8 border border-primary/20">
            <Shield className="w-3.5 h-3.5" />
            Home inventory made simple
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-6 leading-tight">
            Know where everything is,{" "}
            <span className="text-primary">always</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
            Organise your home into rooms, cupboards, and drawers. Add items, tag them, and find anything in seconds. Built for homes, hotels, Airbnbs, and warehouses.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="px-8">Create free account</Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="px-8">Sign in</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-3xl w-full">
          {[
            {
              icon: Layers,
              title: "Nested storage",
              desc: "Create unlimited levels of hierarchy — rooms, cupboards, drawers, boxes.",
            },
            {
              icon: Search,
              title: "Instant search",
              desc: "Find any item by name, category, tag, or custom field in milliseconds.",
            },
            {
              icon: Package,
              title: "Rich item data",
              desc: "Add categories, tags, descriptions, and any custom fields you need.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-card border border-border rounded-xl p-6 text-left">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
