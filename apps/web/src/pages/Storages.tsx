import { useState, useMemo } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { 
  useListStoragesByHousehold, 
  useCreateStorage, 
  useDeleteStorage,
  useUpdateStorage,
  getListStoragesByHouseholdQueryKey,
  Storage
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Folder, ChevronRight, ChevronDown, Trash2, Plus, AlertCircle, Image, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ImageUpload, imageServingUrl } from "@/components/ImageUpload";

interface StorageNode extends Storage {
  children: StorageNode[];
}

function buildStorageTree(storages: Storage[]): StorageNode[] {
  const map = new Map<number, StorageNode>();
  const roots: StorageNode[] = [];
  storages.forEach(s => map.set(s.id, { ...s, children: [] }));
  storages.forEach(s => {
    if (s.parentId === null) {
      roots.push(map.get(s.id)!);
    } else {
      const parent = map.get(s.parentId);
      if (parent) parent.children.push(map.get(s.id)!);
      else roots.push(map.get(s.id)!);
    }
  });
  return roots;
}

function StorageTreeNode({ 
  node, level = 0, onDelete, onRename
}: { 
  node: StorageNode; level?: number; 
  onDelete: (id: number) => void;
  onRename: (storage: Storage) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div className="w-full">
      <div 
        className="flex items-center group py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
        style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}
      >
        <div className="w-6 flex items-center justify-center mr-1 shrink-0">
          {hasChildren ? (
            <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-muted rounded-sm text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-4 h-4" />
          )}
        </div>
        {node.imageUrl ? (
          <img src={imageServingUrl(node.imageUrl)} alt={node.name} className="w-6 h-6 rounded object-cover mr-2 shrink-0" />
        ) : (
          <Folder className="w-4 h-4 text-primary mr-3 shrink-0" />
        )}
        <span className="flex-1 font-medium text-sm truncate">{node.name}</span>
        
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={(e) => { e.stopPropagation(); onRename(node); }}
            title="Rename"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      
      {expanded && hasChildren && (
        <div className="w-full">
          {node.children.map(child => (
            <StorageTreeNode key={child.id} node={child} level={level + 1} onDelete={onDelete} onRename={onRename} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Storages() {
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();
  
  const { data: storages, isLoading } = useListStoragesByHousehold(householdId!, {
    query: {
      enabled: !!householdId,
      queryKey: householdId ? getListStoragesByHouseholdQueryKey(householdId) : ["storages", "none"]
    }
  });

  const createStorage = useCreateStorage();
  const deleteStorage = useDeleteStorage();
  const updateStorage = useUpdateStorage();

  // Add form state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);

  // Rename dialog state
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renamingStorage, setRenamingStorage] = useState<Storage | null>(null);
  const [renameName, setRenameName] = useState("");

  const tree = useMemo(() => storages ? buildStorageTree(storages) : [], [storages]);

  const invalidate = () => {
    if (householdId) queryClient.invalidateQueries({ queryKey: getListStoragesByHouseholdQueryKey(householdId) });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId || !newName.trim()) return;
    const parent = parentId !== "none" ? Number(parentId) : null;
    createStorage.mutate({
      data: { householdId, name: newName, parentId: parent, imageUrl: newImageUrl }
    }, {
      onSuccess: () => { setIsAddOpen(false); setNewName(""); setParentId("none"); setNewImageUrl(null); invalidate(); }
    });
  };

  const handleDelete = (id: number) => {
    if (!householdId || !confirm("Delete this storage location?")) return;
    deleteStorage.mutate({ id }, { onSuccess: () => invalidate() });
  };

  const openRename = (storage: Storage) => {
    setRenamingStorage(storage);
    setRenameName(storage.name);
    setIsRenameOpen(true);
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingStorage || !renameName.trim()) return;
    updateStorage.mutate({
      id: renamingStorage.id,
      data: { name: renameName }
    }, {
      onSuccess: () => { setIsRenameOpen(false); setRenamingStorage(null); invalidate(); }
    });
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
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">Storage Spaces</h1>
          <p className="text-muted-foreground text-sm">Organize your home into rooms, shelves, and containers.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              Add Storage
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Storage Space</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input 
                  id="name" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  placeholder="e.g. Kitchen Pantry" 
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parent">Parent Location (Optional)</Label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger id="parent">
                    <SelectValue placeholder="None (Root Level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Root Level)</SelectItem>
                    {storages?.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {[...s.pathNames, s.name].join(" > ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Image className="w-4 h-4" /> Photo (Optional)</Label>
                <ImageUpload value={newImageUrl} onChange={setNewImageUrl} />
              </div>
              <DialogFooter className="pt-2">
                <Button type="submit" disabled={createStorage.isPending || !newName.trim()}>
                  {createStorage.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border/50 rounded-lg p-4 md:p-6 shadow-sm">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : tree.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed rounded-lg border-border/50">
            <FolderPlus className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-medium mb-1">No storage spaces yet</h3>
            <p className="text-sm">Create your first room or container to start organizing.</p>
            <Button variant="outline" className="mt-4" onClick={() => setIsAddOpen(true)}>
              Add Storage Space
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {tree.map(node => (
              <StorageTreeNode key={node.id} node={node} onDelete={handleDelete} onRename={openRename} />
            ))}
          </div>
        )}
      </div>

      {/* Rename dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Storage Space</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="rename">New Name</Label>
              <Input
                id="rename"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateStorage.isPending || !renameName.trim()}>
                {updateStorage.isPending ? "Saving..." : "Rename"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
