

"use client"

import * as React from "react"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"
import { Toggle } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    value?: string | string[];
    onValueChange: (value: string) => void;
  }
>({
  size: "default",
  variant: "default",
  onValueChange: () => {},
});


const ToggleGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof toggleVariants> & {
      type: 'single' | 'multiple';
      value?: string | string[];
      onValueChange?: (value: string | string[]) => void;
    }
>(({ className, variant, size, children, type, value, onValueChange, ...props }, ref) => {
    const handleItemClick = (itemValue: string) => {
        if (!onValueChange) return;

        if (type === 'single') {
            onValueChange(value === itemValue ? "" : itemValue);
        } else {
            const currentValue = Array.isArray(value) ? value : [];
            const newValue = currentValue.includes(itemValue)
                ? currentValue.filter((v) => v !== itemValue)
                : [...currentValue, itemValue];
            onValueChange(newValue);
        }
    };

    return (
        <div
            ref={ref}
            className={cn("flex items-center justify-center gap-1", className)}
            {...props}
        >
            <ToggleGroupContext.Provider value={{ variant, size, value, onValueChange: handleItemClick }}>
                {children}
            </ToggleGroupContext.Provider>
        </div>
    )
})
ToggleGroup.displayName = "ToggleGroup"

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof Toggle>,
  React.ComponentPropsWithoutRef<typeof Toggle> & {
      value: string;
  }
>(({ className, children, variant, size, value, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext)
  const isSelected = Array.isArray(context.value) 
    ? context.value.includes(value) 
    : context.value === value;

  return (
    <Toggle
      ref={ref}
      pressed={isSelected}
      onPressedChange={() => context.onValueChange(value)}
      variant={context.variant || variant}
      size={context.size || size}
      className={cn(className)}
      {...props}
    >
      {children}
    </Toggle>
  )
})
ToggleGroupItem.displayName = "ToggleGroupItem"

export { ToggleGroup, ToggleGroupItem }
