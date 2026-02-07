'use client';

import { cn } from "@/lib/utils";
import type { AnchorPosition } from "@/types/editor";
import { Button } from "../ui/button";

interface AnchorPointSelectorProps {
  value: AnchorPosition | null;
  onChange: (position: AnchorPosition) => void;
}

const positions: AnchorPosition[] = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right'
];

export const AnchorPointSelector = ({ value, onChange }: AnchorPointSelectorProps) => {
  return (
    <div className="grid grid-cols-3 gap-1 w-24 h-24 p-1 rounded-md bg-muted/50 border">
      {positions.map((pos) => (
        <Button
          key={pos}
          variant="ghost"
          size="icon"
          className={cn(
            "w-full h-full rounded-sm transition-colors",
            "hover:bg-accent",
            value === pos ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted/80"
          )}
          onClick={() => onChange(pos)}
        >
          <div className="w-2 h-2 rounded-full bg-current" />
        </Button>
      ))}
    </div>
  );
};
