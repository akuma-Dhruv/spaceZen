import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Package, LayoutDashboard, Box, Menu, X, Plus, Home, LogOut } from "lucide-react";
import { useHousehold } from "@/context/HouseholdContext";
import { useListHouseholds, useCreateHousehold, getListHouseholdsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { useClerk, useUser } from "@clerk/react";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { householdId, setHouseholdId } = useHousehold();
  const { data: households } = useListHouseholds();
  const createHousehold = useCreateHousehold();
  const queryClient = useQueryClient();
  const { signOut } = useClerk();
  const { user } = useUser();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [isHouseholdDialogOpen, setIsHouseholdDialogOpen] = useState(false);

  const displayName = user?.firstName || user?.username || user?.emailAddresses?.[0]?.emailAddress || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHouseholdName.trim()) return;
    createHousehold.mutate({ data: { name: newHouseholdName } }, {
      onSuccess: (newHousehold) => {
        setNewHouseholdName("");
        setIsHouseholdDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: getListHouseholdsQueryKey() });
        setHouseholdId(newHousehold.id);
      }
    });
  };

  const handleSignOut = () => {
    signOut({ redirectUrl: "/" });
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/storages", label: "Storage Spaces", icon: Home },
    { href: "/items", label: "All Items", icon: Box },
  ];

  const sidebarContent = (
    <>
      <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
        <Package className="w-6 h-6 text-primary mr-3" />
        <h1 className="font-bold text-lg tracking-tight">SpaceZen</h1>
        <button
          className="ml-auto md:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 border-b border-border shrink-0">
        <Label className="text-xs text-muted-foreground uppercase font-semibold mb-2 block">Household</Label>
        <div className="flex gap-2">
          <Select
            value={householdId?.toString() || ""}
            onValueChange={(val) => { setHouseholdId(Number(val)); setSidebarOpen(false); }}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select Household" />
            </SelectTrigger>
            <SelectContent>
              {households?.map((h) => (
                <SelectItem key={h.id} value={h.id.toString()}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={isHouseholdDialogOpen} onOpenChange={setIsHouseholdDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Household</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateHousehold} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="household-name">Name</Label>
                  <Input
                    id="household-name"
                    value={newHouseholdName}
                    onChange={(e) => setNewHouseholdName(e.target.value)}
                    placeholder="e.g. My Apartment"
                    autoFocus
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createHousehold.isPending || !newHouseholdName.trim()}>
                    {createHousehold.isPending ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/dashboard" ? location === "/dashboard" || location === "/" : location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.emailAddresses?.[0]?.emailAddress}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={handleSignOut}
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border bg-card flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 bg-card border-r border-border flex flex-col z-50">
            {sidebarContent}
          </aside>
        </div>
      )}

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="h-16 flex items-center px-4 md:px-8 border-b border-border bg-card/50 backdrop-blur-sm z-10 shrink-0">
          <button
            className="md:hidden mr-3 text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center md:hidden gap-2">
            <Package className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">SpaceZen</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto z-10 p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
