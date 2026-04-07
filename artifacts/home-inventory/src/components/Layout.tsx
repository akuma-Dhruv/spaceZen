import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Package, LayoutDashboard, Box, Search, Plus, Moon, Sun, Home, Settings, LogOut } from "lucide-react";
import { useHousehold } from "@/context/HouseholdContext";
import { useListHouseholds, useCreateHousehold } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { getListHouseholdsQueryKey } from "@workspace/api-client-react";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { householdId, setHouseholdId } = useHousehold();
  const { data: households } = useListHouseholds();
  const createHousehold = useCreateHousehold();
  const queryClient = useQueryClient();

  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [isHouseholdDialogOpen, setIsHouseholdDialogOpen] = useState(false);

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

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Package className="w-6 h-6 text-primary mr-3" />
          <h1 className="font-bold text-lg tracking-tight">Inventory</h1>
        </div>

        <div className="p-4 border-b border-border">
          <Label className="text-xs text-muted-foreground uppercase font-semibold mb-2 block">Household</Label>
          <div className="flex gap-2">
            <Select 
              value={householdId?.toString() || ""} 
              onValueChange={(val) => setHouseholdId(Number(val))}
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
                    <Label htmlFor="name">Name</Label>
                    <Input 
                      id="name" 
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

        <nav className="flex-1 p-4 space-y-1">
          <Link href="/" className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${location === "/" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </Link>
          <Link href="/storages" className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${location.startsWith("/storages") ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
            <Home className="w-5 h-5" />
            Storage Spaces
          </Link>
          <Link href="/items" className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${location.startsWith("/items") ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
            <Box className="w-5 h-5" />
            All Items
          </Link>
        </nav>

        <div className="p-4 border-t border-border text-sm text-muted-foreground flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
            U1
          </div>
          <div className="flex-1 truncate">user1</div>
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none opacity-[0.015] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
        
        <div className="h-16 flex items-center justify-end px-8 border-b border-border bg-card/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" className="hidden md:flex gap-2 text-muted-foreground">
              <Search className="w-4 h-4" />
              <span className="text-xs">Search...</span>
              <kbd className="inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto z-10 p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
