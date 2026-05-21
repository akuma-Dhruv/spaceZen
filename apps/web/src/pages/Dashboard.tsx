import { useHousehold } from "@/context/HouseholdContext";
import { useGetHouseholdStats, getGetHouseholdStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Box, Layers, Clock, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { householdId } = useHousehold();
  
  const { data: stats, isLoading, isError } = useGetHouseholdStats(householdId!, { 
    query: { 
      enabled: !!householdId, 
      queryKey: householdId ? getGetHouseholdStatsQueryKey(householdId) : ["stats", "none"] 
    } 
  });

  if (!householdId) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">No Household Selected</h2>
          <p className="text-muted-foreground">Please select or create a household from the sidebar to continue.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-10 w-16" /></CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-[400px] w-full mt-6" />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-lg text-destructive">
        Failed to load household statistics.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your inventory across all spaces.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-card hover:bg-accent/5 transition-colors border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
            <Box className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">{stats.totalItems}</div>
            <p className="text-xs text-muted-foreground mt-1">Items tracked across all spaces</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card hover:bg-accent/5 transition-colors border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Storage Spaces</CardTitle>
            <Layers className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">{stats.totalStorages}</div>
            <p className="text-xs text-muted-foreground mt-1">Rooms, shelves, and containers</p>
          </CardContent>
        </Card>

        <Card className="bg-card hover:bg-accent/5 transition-colors border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Categories</CardTitle>
            <Box className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">{stats.categoryCounts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Distinct item categories</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="col-span-2 border-border/50">
          <CardHeader>
            <CardTitle>Recently Added Items</CardTitle>
            <CardDescription>The newest items added to your inventory.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                <Box className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p>No items added yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.recentItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center text-primary">
                        <Box className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{item.locationPathNames.join(" > ")}</span>
                          {item.category && (
                            <>
                              <span>•</span>
                              <span>{item.category}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>Breakdown of items by category.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.categoryCounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No categories yet.
              </div>
            ) : (
              <div className="space-y-4">
                {stats.categoryCounts.map((cat) => (
                  <div key={cat.category || "uncategorized"} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-sm font-medium">{cat.category || "Uncategorized"}</span>
                    </div>
                    <Badge variant="secondary">{cat.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
