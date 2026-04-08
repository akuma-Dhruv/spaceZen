import { useState, useMemo } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { 
  useListItemsByHousehold, 
  useCreateItem, 
  useDeleteItem,
  useUpdateItem,
  useSearchItems,
  useListStoragesByHousehold,
  getListItemsByHouseholdQueryKey,
  getSearchItemsQueryKey,
  Item
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Box, Trash2, Filter, Info, AlertCircle, X, ChevronRight, Pencil, MoveRight, Image } from "lucide-react";
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
import { ImageUpload, imageServingUrl } from "@/components/ImageUpload";

export default function Items() {
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");
  
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
  const updateItem = useUpdateItem();

  const items = searchQuery.trim() ? searchResults : allItems;
  const isLoading = searchQuery.trim() ? isLoadingSearch : isLoadingAll;

  // Derive unique categories
  const categories = useMemo(() => {
    const all = (allItems ?? []).map(i => i.category).filter(Boolean) as string[];
    return Array.from(new Set(all)).sort();
  }, [allItems]);

  // Form state (add)
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newStorageId, setNewStorageId] = useState<string>("");
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<Array<{key: string, value: string}>>([]);

  // Detail / edit state
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [editCustomFields, setEditCustomFields] = useState<Array<{key: string, value: string}>>([]);
  const [isRelocateMode, setIsRelocateMode] = useState(false);
  const [relocateStorageId, setRelocateStorageId] = useState<string>("");

  // Filter
  const [filterStorageId, setFilterStorageId] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const filteredItems = useMemo(() => {
    if (!items) return [];
    let result = items;
    if (filterStorageId !== "all") result = result.filter(i => i.storageId === Number(filterStorageId));
    if (filterCategory !== "all") result = result.filter(i => i.category === filterCategory);
    return result;
  }, [items, filterStorageId, filterCategory]);

  const invalidate = () => {
    if (!householdId) return;
    queryClient.invalidateQueries({ queryKey: getListItemsByHouseholdQueryKey(householdId) });
    if (searchQuery) queryClient.invalidateQueries({ queryKey: getSearchItemsQueryKey({ householdId, q: searchQuery }) });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId || !newName.trim() || !newStorageId) return;
    const tagsArray = newTags.split(",").map(t => t.trim()).filter(Boolean);
    const customFieldsRecord: Record<string, any> = {};
    customFields.forEach(f => { if (f.key.trim()) customFieldsRecord[f.key.trim()] = f.value; });
    createItem.mutate({
      data: {
        householdId,
        storageId: Number(newStorageId),
        name: newName,
        imageUrl: newImageUrl,
        category: newCategory || null,
        description: newDescription || null,
        tags: tagsArray,
        customFields: customFieldsRecord,
      }
    }, {
      onSuccess: () => { setIsAddOpen(false); resetForm(); invalidate(); }
    });
  };

  const handleDelete = (id: number) => {
    if (!householdId || !confirm("Delete this item?")) return;
    deleteItem.mutate({ id }, {
      onSuccess: () => { setIsDetailOpen(false); invalidate(); }
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    const tagsArray = editTags.split(",").map(t => t.trim()).filter(Boolean);
    const customFieldsRecord: Record<string, any> = {};
    editCustomFields.forEach(f => { if (f.key.trim()) customFieldsRecord[f.key.trim()] = f.value; });
    updateItem.mutate({
      id: selectedItem.id,
      data: {
        name: editName,
        imageUrl: editImageUrl,
        category: editCategory || null,
        description: editDescription || null,
        tags: tagsArray,
        customFields: customFieldsRecord,
      }
    }, {
      onSuccess: (updated) => {
        setSelectedItem(updated);
        setIsEditMode(false);
        invalidate();
      }
    });
  };

  const handleRelocate = () => {
    if (!selectedItem || !relocateStorageId) return;
    updateItem.mutate({
      id: selectedItem.id,
      data: { storageId: Number(relocateStorageId) }
    }, {
      onSuccess: (updated) => {
        setSelectedItem(updated);
        setIsRelocateMode(false);
        setRelocateStorageId("");
        invalidate();
      }
    });
  };

  const resetForm = () => {
    setNewName(""); setNewCategory(""); setNewDescription(""); setNewTags("");
    setNewStorageId(""); setNewImageUrl(null); setCustomFields([]);
  };

  const openDetail = (item: Item) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
    setIsEditMode(false);
    setIsRelocateMode(false);
    setRelocateStorageId("");
  };

  const startEdit = () => {
    if (!selectedItem) return;
    setEditName(selectedItem.name);
    setEditCategory(selectedItem.category ?? "");
    setEditDescription(selectedItem.description ?? "");
    setEditTags(selectedItem.tags.join(", "));
    setEditImageUrl(selectedItem.imageUrl ?? null);
    setEditCustomFields(Object.entries(selectedItem.customFields ?? {}).map(([key, value]) => ({ key, value: String(value) })));
    setIsEditMode(true);
    setIsRelocateMode(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">Items</h1>
          <p className="text-muted-foreground text-sm">Manage and find everything in your home.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsAddOpen(open); }}>
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
                            {[...s.pathNames, s.name].join(" > ")}
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
                    <Input id="tags" value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder="e.g. fragile, warranty" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Image className="w-4 h-4" /> Photo (Optional)</Label>
                    <ImageUpload value={newImageUrl} onChange={setNewImageUrl} />
                  </div>
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
                          <Input placeholder="Key" value={field.key} onChange={(e) => {
                            const nf = [...customFields]; nf[idx].key = e.target.value; setCustomFields(nf);
                          }} className="flex-1" />
                          <Input placeholder="Value" value={field.value} onChange={(e) => {
                            const nf = [...customFields]; nf[idx].value = e.target.value; setCustomFields(nf);
                          }} className="flex-1" />
                          <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => {
                            const nf = [...customFields]; nf.splice(idx, 1); setCustomFields(nf);
                          }}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      {customFields.length === 0 && <p className="text-xs text-muted-foreground italic">No custom fields added.</p>}
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

      {/* Search + Filters */}
      <div className="bg-card border border-border/50 rounded-lg p-3 md:p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search items by name, category, or tags..." 
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={filterStorageId} onValueChange={setFilterStorageId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {storages?.map(s => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {[...s.pathNames, s.name].join(" > ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-muted-foreground shrink-0">Category</span>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Items list */}
      <div className="bg-card border border-border/50 rounded-lg overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Box className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-medium mb-1">No items found</h3>
            <p className="text-sm">
              {searchQuery || filterStorageId !== "all" || filterCategory !== "all"
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
                <div className="flex items-center gap-3 flex-1 overflow-hidden">
                  <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0 overflow-hidden">
                    {item.imageUrl ? (
                      <img src={imageServingUrl(item.imageUrl)} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Box className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground truncate">{item.name}</p>
                      {item.category && <Badge variant="secondary" className="text-[10px] py-0 shrink-0">{item.category}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {item.locationPathNames.length > 0 ? item.locationPathNames.join(" > ") : "Unknown Location"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {item.tags.slice(0, 1).map((tag, idx) => (
                    <Badge key={idx} variant="outline" className="hidden sm:inline-flex font-normal text-xs">{tag}</Badge>
                  ))}
                  {item.tags.length > 1 && (
                    <Badge variant="outline" className="hidden sm:inline-flex font-normal text-xs">+{item.tags.length - 1}</Badge>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-1" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail / Edit dialog */}
      <Dialog open={isDetailOpen} onOpenChange={(open) => { setIsDetailOpen(open); if (!open) { setIsEditMode(false); setIsRelocateMode(false); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {selectedItem && !isEditMode && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between pr-6">
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-xl flex items-center gap-2 flex-wrap">
                      <span className="truncate">{selectedItem.name}</span>
                      {selectedItem.category && <Badge>{selectedItem.category}</Badge>}
                    </DialogTitle>
                    <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                      <Box className="w-4 h-4 shrink-0" />
                      {selectedItem.locationPathNames.length > 0 ? selectedItem.locationPathNames.join(" > ") : "Unknown Location"}
                    </p>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="space-y-5 pt-2 pb-2">
                {selectedItem.imageUrl && (
                  <div className="rounded-lg overflow-hidden border border-border/50 aspect-video bg-muted">
                    <img src={imageServingUrl(selectedItem.imageUrl)} alt={selectedItem.name} className="w-full h-full object-cover" />
                  </div>
                )}

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
                      {selectedItem.tags.map((tag, idx) => <Badge key={idx} variant="secondary">{tag}</Badge>)}
                    </div>
                  </div>
                )}

                {Object.keys(selectedItem.customFields || {}).length > 0 && (
                  <div>
                    <p className="font-medium mb-2 text-xs uppercase text-muted-foreground">Additional Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(selectedItem.customFields).map(([key, value]) => (
                        <div key={key} className="bg-card border border-border/50 rounded p-3">
                          <p className="text-xs text-muted-foreground">{key}</p>
                          <p className="font-medium text-sm mt-0.5 truncate">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Relocate section */}
                {isRelocateMode ? (
                  <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border/50">
                    <p className="text-sm font-medium">Move to a different location</p>
                    <Select value={relocateStorageId} onValueChange={setRelocateStorageId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select new location..." />
                      </SelectTrigger>
                      <SelectContent>
                        {storages?.filter(s => s.id !== selectedItem.storageId).map(s => (
                          <SelectItem key={s.id} value={s.id.toString()}>
                            {[...s.pathNames, s.name].join(" > ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleRelocate} disabled={!relocateStorageId || updateItem.isPending}>
                        {updateItem.isPending ? "Moving..." : "Confirm Move"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setIsRelocateMode(false); setRelocateStorageId(""); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
                
                <div className="text-xs text-muted-foreground flex items-center gap-2 pt-2 border-t border-border/50">
                  <Info className="w-3.5 h-3.5" />
                  Added {new Date(selectedItem.createdAt).toLocaleDateString()}
                </div>
              </div>

              <DialogFooter className="border-t border-border/50 pt-4 flex sm:justify-between gap-2 flex-row flex-wrap">
                <Button variant="destructive" size="sm" className="gap-2" onClick={() => handleDelete(selectedItem.id)}>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
                <div className="flex gap-2">
                  {!isRelocateMode && (
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsRelocateMode(true)}>
                      <MoveRight className="w-4 h-4" />
                      Relocate
                    </Button>
                  )}
                  <Button size="sm" className="gap-2" onClick={startEdit}>
                    <Pencil className="w-4 h-4" />
                    Edit
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}

          {selectedItem && isEditMode && (
            <>
              <DialogHeader>
                <DialogTitle>Edit Item</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Item Name *</Label>
                      <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} required autoFocus />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-category">Category</Label>
                      <Input id="edit-category" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} placeholder="e.g. Electronics" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-tags">Tags (comma separated)</Label>
                      <Input id="edit-tags" value={editTags} onChange={(e) => setEditTags(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-desc">Description</Label>
                      <Textarea id="edit-desc" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1"><Image className="w-4 h-4" /> Photo</Label>
                      <ImageUpload value={editImageUrl} onChange={setEditImageUrl} />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex justify-between items-center">
                        Custom Fields
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditCustomFields([...editCustomFields, {key: "", value: ""}])} className="h-6 px-2 text-xs">
                          + Add
                        </Button>
                      </Label>
                      <div className="space-y-2">
                        {editCustomFields.map((field, idx) => (
                          <div key={idx} className="flex gap-1 items-center">
                            <Input placeholder="Key" value={field.key} onChange={(e) => {
                              const nf = [...editCustomFields]; nf[idx].key = e.target.value; setEditCustomFields(nf);
                            }} className="flex-1 h-8 text-sm" />
                            <Input placeholder="Value" value={field.value} onChange={(e) => {
                              const nf = [...editCustomFields]; nf[idx].value = e.target.value; setEditCustomFields(nf);
                            }} className="flex-1 h-8 text-sm" />
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => {
                              const nf = [...editCustomFields]; nf.splice(idx, 1); setEditCustomFields(nf);
                            }}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                        {editCustomFields.length === 0 && <p className="text-xs text-muted-foreground italic">No custom fields.</p>}
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter className="gap-2 flex-wrap">
                  <Button type="button" variant="outline" onClick={() => setIsEditMode(false)}>Cancel</Button>
                  <Button type="submit" disabled={updateItem.isPending || !editName.trim()}>
                    {updateItem.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
