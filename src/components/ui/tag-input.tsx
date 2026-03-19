import { useState, useEffect, KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";

interface TagInputProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (idx: number) => void;
  placeholder: string;
  flushRef?: React.MutableRefObject<(() => string) | null>;
  showAddButton?: boolean;
  helperText?: string;
}

export function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder,
  flushRef,
  showAddButton = false,
  helperText = "Press Enter or comma to add",
}: TagInputProps) {
  const [input, setInput] = useState("");

  const commitInput = (): string => {
    const val = input.trim();
    if (val) {
      onAdd(val);
      setInput("");
    }
    return val;
  };

  useEffect(() => {
    if (flushRef) flushRef.current = commitInput;
    return () => {
      if (flushRef) flushRef.current = null;
    };
  });

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      commitInput();
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag, i) => (
          <Badge key={i} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="ml-1 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          className="flex-1"
        />
        {showAddButton && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => commitInput()}
            disabled={!input.trim()}
            className="shrink-0 gap-1"
          >
            <Plus className="h-3 w-3" /> Add
          </Button>
        )}
      </div>
      {helperText && (
        <p className="text-xs text-muted-foreground mt-1">{helperText}</p>
      )}
    </div>
  );
}
