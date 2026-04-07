import { useState, useMemo } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { 
  useListItemsByHousehold, 
  useCreateItem, 
  useDeleteItem,
  useSearchItems,
  useListStoragesByHousehold,
  getListItemsByHouseholdQueryKey,
  getSearchItemsQueryKey,
  Item
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Box, Trash2, Filter, Info, AlertCircle, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useState(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  });
  return debouncedValue;
}

export default function Items() {
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = [searchQuery]; // simple manual debounce could be used, or just raw search if it's fine
  
  // Data fetching
  const { data: allItems, isLoading: isLoadingAll } = useListItemsByHousehold(householdId!, {
    query: {
      enabled: !!householdId && !searchQuery.trim(),
      queryKey: householdId ? getListItemsByHouseholdQueryKey(householdId) : ["items", "none"]
    }
  });

  const { data: searchResults, isLoading: isLoadingSearch } = useSearchItems(
    { householdId: householdId!, q: searchQuery },
    {
      query: {
        enabled: !!householdId && !!searchQuery.trim(),
        queryKey: householdId ? getSearchItemsQueryKey({ householdId, q: searchQuery }) : ["items", "search", "none"]
      }
    }
  );

  const { data: storages } = useListStoragesByHousehold(householdId!, {
    query: {
      enabled: !!householdId,
      queryKey: householdId ? ["storages", householdId] : ["storages", "none"]
    }
  });

  const createItem = useCreateItem();
  const deleteItem = useDeleteItem();

  const items = searchQuery.trim() ? searchResults : allItems;
  const isLoading = searchQuery.trim() ? isLoadingSearch : isLoadingAll;

  // Form State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newStorageId, setNewStorageId] = useState<string>("");
  const [customFields, setCustomFields] = useState<Array<{key: string, value: string}>>([]);

  const [filterStorageId, setFilterStorageId] = useState<string>("all");

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (filterStorageId === "all") return items;
    return items.filter(i => i.storageId === Number(filterStorageId));
  }, [items, filterStorageId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId || !newName.trim() || !newStorageId) return;

    const tagsArray = newTags.split(",").map(t => t.trim()).filter(Boolean);
    const customFieldsRecord: Record<string, any> = {};
    customFields.forEach(f => {
      if (f.key.trim()) customFieldsRecord[f.key.trim()] = f.value;
    });

    createItem.mutate({
      data: {
        householdId,
        storageId: Number(newStorageId),
        name: newName,
        category: newCategory || null,
        description: newDescription || null,
        tags: tagsArray,
        customFields: customFieldsRecord,
        createdBy: "user1"
      }
    }, {
      onSuccess: () => {
        setIsAddOpen(false);
        resetForm();
        queryClient.invalidateQueries({ queryKey: getListItemsByHouseholdQueryKey(householdId) });
        if (searchQuery) {
          queryClient.invalidateQueries({ queryKey: getSearchItemsQueryKey({ householdId, q: searchQuery }) });
        }
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!householdId || !confirm("Delete this item?")) return;
    
    deleteItem.mutate({ id }, {
      onSuccess: () => {
        setIsDetailOpen(false);
        queryClient.invalidateQueries({ queryKey: getListItemsByHouseholdQueryKey(householdId) });
        if (searchQuery) {
          queryClient.invalidateQueries({ queryKey: getSearchItemsQueryKey({ householdId, q: searchQuery }) });
        }
      }
    });
  };

  const resetForm = () => {
    setNewName("");
    setNewCategory("");
    setNewDescription("");
    setNewTags("");
    setNewStorageId("");
    setCustomFields([]);
  };

  const openDetail = (item: Item) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
  };

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

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Items</h1>
          <p className="text-muted-foreground">Manage and find everything in your home.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsAddOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Item</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Item Name *</Label>
                    <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="storage">Storage Location *</Label>
                    <Select value={newStorageId} onValueChange={setNewStorageId} required>
                      <SelectTrigger id="storage">
                        <SelectValue placeholder="Select location..." />
                      </SelectTrigger>
                      <SelectContent>
                        {storages?.map(s => (
                          <SelectItem key={s.id} value={s.id.toString()}>
                            {s.pathNames.length > 0 ? s.pathNames.join(" > ") : s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input id="category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Electronics" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags (comma separated)</Label>
                    <Input id="tags" value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder="e.g. fragile, warranty, summer" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={3} />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex justify-between items-center">
                      Custom Fields
                      <Button type="button" variant="ghost" size="sm" onClick={() => setCustomFields([...customFields, {key: "", value: ""}])} className="h-6 px-2 text-xs">
                        + Add Field
                      </Button>
                    </Label>
                    <div className="space-y-2">
                      {customFields.map((field, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <Input placeholder="Key (e.g. Serial #)" value={field.key} onChange={(e) => {
                            const newFields = [...customFields];
                            newFields[idx].key = e.target.value;
                            setCustomFields(newFields);
                          }} className="flex-1" />
                          <Input placeholder="Value" value={field.value} onChange={(e) => {
                            const newFields = [...customFields];
                            newFields[idx].value = e.target.value;
                            setCustomFields(newFields);
                          }} className="flex-1" />
                          <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => {
                            const newFields = [...customFields];
                            newFields.splice(idx, 1);
                            setCustomFields(newFields);
                          }}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      {customFields.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No custom fields added.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createItem.isPending || !newName.trim() || !newStorageId}>
                  {createItem.isPending ? "Saving..." : "Save Item"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border/50 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search items by name, category, or tags..." 
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full md:w-64 flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select value={filterStorageId} onValueChange={setFilterStorageId}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {storages?.map(s => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.pathNames.length > 0 ? s.pathNames.join(" > ") : s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-lg overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Box className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-medium mb-1">No items found</h3>
            <p className="text-sm">
              {searchQuery || filterStorageId !== "all" 
                ? "Try adjusting your search or filters." 
                : "Add your first item to start organizing."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredItems.map(item => (
              <div 
                key={item.id} 
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => openDetail(item)}
              >
                <div className="flex items-center gap-4 flex-1 overflow-hidden">
                  <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Box className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground truncate">{item.name}</p>
                      {item.category && <Badge variant="secondary" className="text-[10px] py-0">{item.category}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {item.locationPathNames.length > 0 ? item.locationPathNames.join(" > ") : "Unknown Location"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {item.tags.slice(0, 2).map((tag, idx) => (
                    <Badge key={idx} variant="outline" className="hidden sm:inline-flex font-normal">{tag}</Badge>
                  ))}
                  {item.tags.length > 2 && (
                    <Badge variant="outline" className="hidden sm:inline-flex font-normal">+{item.tags.length - 2}</Badge>
                  )}
                  <ChevronRight className="w-5 h-5 text-muted-foreground ml-2" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-xl">
          {selectedItem && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between pr-6">
                  <div>
                    <DialogTitle className="text-2xl flex items-center gap-3">
                      {selectedItem.name}
                      {selectedItem.category && <Badge>{selectedItem.category}</Badge>}
                    </DialogTitle>
                    <p className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
                      <Box className="w-4 h-4" />
                      {selectedItem.locationPathNames.length > 0 ? selectedItem.locationPathNames.join(" > ") : "Unknown Location"}
                    </p>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="space-y-6 pt-4 pb-2">
                {selectedItem.description && (
                  <div className="text-sm bg-muted/30 p-4 rounded-lg border border-border/50">
                    <p className="font-medium mb-1 text-xs uppercase text-muted-foreground">Description</p>
                    <p className="text-foreground leading-relaxed">{selectedItem.description}</p>
                  </div>
                )}

                {selectedItem.tags.length > 0 && (
                  <div>
                    <p className="font-medium mb-2 text-xs uppercase text-muted-foreground">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(selectedItem.customFields || {}).length > 0 && (
                  <div>
                    <p className="font-medium mb-2 text-xs uppercase text-muted-foreground">Additional Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {Object.entries(selectedItem.customFields).map(([key, value]) => (
                        <div key={key} className="bg-card border border-border/50 rounded p-3">
                          <p className="text-xs text-muted-foreground">{key}</p>
                          <p className="font-medium text-sm mt-0.5 truncate">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground flex items-center gap-2 pt-4 border-t border-border/50">
                  <Info className="w-4 h-4" />
                  Added {new Date(selectedItem.createdAt).toLocaleDateString()}
                </div>
              </div>

              <DialogFooter className="border-t border-border/50 pt-4 flex sm:justify-between flex-row">
                <Button variant="destructive" className="gap-2" onClick={() => handleDelete(selectedItem.id)}>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
