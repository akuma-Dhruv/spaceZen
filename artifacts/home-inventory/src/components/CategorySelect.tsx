import { useState, useRef, useEffect } from "react";
import { Plus, Check, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  categories: string[];
  placeholder?: string;
}

const CREATE_NEW = "__create_new__";

export function CategorySelect({
  value,
  onChange,
  categories,
  placeholder = "Select or create a category...",
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  const handleSelect = (cat: string) => {
    if (cat === CREATE_NEW) {
      setIsCreating(true);
      setNewCategoryName("");
      return;
    }
    onChange(cat);
    setOpen(false);
    setIsCreating(false);
  };

  const handleCreateConfirm = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setOpen(false);
    setIsCreating(false);
    setNewCategoryName("");
  };

  const handleCreateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateConfirm();
    }
    if (e.key === "Escape") {
      setIsCreating(false);
      setNewCategoryName("");
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsCreating(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setIsCreating(false); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground"
          )}
        >
          <span className="flex items-center gap-2 truncate">
            {value ? (
              <>
                <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{value}</span>
              </>
            ) : (
              <span>{placeholder}</span>
            )}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {value && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => e.key === "Enter" && handleClear(e as any)}
                className="text-muted-foreground hover:text-foreground text-xs px-1 rounded hover:bg-muted"
              >
                ✕
              </span>
            )}
            <svg className="w-4 h-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="flex flex-col">
          {isCreating ? (
            <div className="p-3 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">New category name</p>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={handleCreateKeyDown}
                  placeholder="e.g. Electronics"
                  className="h-8 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={handleCreateConfirm}
                  disabled={!newCategoryName.trim()}
                >
                  Add
                </Button>
              </div>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setIsCreating(false)}
              >
                ← Back to list
              </button>
            </div>
          ) : (
            <>
              {/* Create new option — always at top */}
              <button
                type="button"
                onClick={() => handleSelect(CREATE_NEW)}
                className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors border-b border-border"
              >
                <Plus className="w-4 h-4" />
                Create new category
              </button>

              {/* Existing categories */}
              <div className="max-h-52 overflow-y-auto">
                {categories.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No categories yet
                  </p>
                ) : (
                  categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleSelect(cat)}
                      className={cn(
                        "flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-left",
                        value === cat && "bg-primary/5 text-primary font-medium"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 opacity-40 shrink-0" />
                        {cat}
                      </span>
                      {value === cat && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
