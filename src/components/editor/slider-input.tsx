

'use client';

import { Input } from '@/components/ui/input';
import { type PointerEvent, useRef, useState, useEffect } from 'react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { coerceNumber } from '@/lib/utils';
import { Slider } from '../ui/slider';

import { Diamond, MoreHorizontal } from 'lucide-react';
import { FilledDiamond } from '../icons';

interface SliderInputProps {
  tooltip: string;
  prefix: string | React.ReactNode;
  id?: string;
  name?: string;
  value: number | string | null | undefined;
  onChange: (value: number) => void;
  onCommit?: (startValue: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  variant?: 'default' | 'compact' | 'icon';
  onPrefixClick?: () => void;
  onToggleAnimation?: () => void;
  isAnimated?: boolean;
}

export const SliderInput = ({
  tooltip,
  prefix,
  id,
  name,
  value,
  onChange,
  onCommit,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  placeholder,
  className,
  variant = 'default',
  onPrefixClick,
  onToggleAnimation,
  isAnimated,
}: SliderInputProps) => {
  const dragStartRef = useRef<{ x: number, value: number } | null>(null);

  const safeValue = coerceNumber(value, min, { min, max });
  const [internalValue, setInternalValue] = useState(String(safeValue));

  useEffect(() => {
    // Sincroniza el estado interno solo si el valor externo cambia Y no estamos arrastrando
    if (dragStartRef.current === null) {
      setInternalValue(String(coerceNumber(value, min, { min, max })));
    }
  }, [value, min, max]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    const target = e.target as HTMLElement;
    target.setPointerCapture(e.pointerId);
    e.preventDefault();
    document.body.style.cursor = 'ew-resize';
    dragStartRef.current = {
      x: e.clientX,
      value: coerceNumber(value, min, { min, max }),
    };

    const handlePointerMove = (e: globalThis.PointerEvent) => {
      if (!dragStartRef.current) return;

      const dx = e.clientX - dragStartRef.current.x;
      const change = Math.round(dx / (5 / step)) * step;
      let newValue = dragStartRef.current.value + change;

      newValue = coerceNumber(newValue, min, { min, max });

      setInternalValue(String(newValue));
      onChange(newValue);
    };

    const handlePointerUp = (e: globalThis.PointerEvent) => {
      document.body.style.cursor = 'default';
      target.releasePointerCapture(e.pointerId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      if (onCommit && dragStartRef.current) {
        onCommit(dragStartRef.current.value);
      }
      dragStartRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInternalValue(e.target.value);
    const numValue = parseFloat(e.target.value);
    if (!isNaN(numValue)) {
      onChange(coerceNumber(numValue, min, { min, max }));
    }
  };

  const handleInputBlur = () => {
    const numValue = parseFloat(internalValue);
    const finalValue = coerceNumber(numValue, safeValue, { min, max });
    setInternalValue(String(finalValue));
    if (finalValue !== value) {
      onChange(finalValue);
    }
    if (onCommit) {
      onCommit(safeValue);
    }
  };

  const handleSliderChange = (values: number[]) => {
    if (values.length > 0) {
      onChange(values[0]);
    }
  };

  if (variant === 'icon') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center h-8 rounded-md border border-input bg-transparent focus-within:ring-1 focus-within:ring-ring hover:bg-accent/50 data-[disabled=true]:opacity-50" data-disabled={disabled}>
              <div
                onPointerDown={handlePointerDown}
                className={cn("px-2 text-xs font-medium text-zinc-400 h-full flex items-center data-[disabled=true]:cursor-not-allowed cursor-ew-resize", !prefix && "hidden")}
                data-disabled={disabled}
                onClick={onPrefixClick}
              >
                {prefix}
              </div>
              <Input
                id={id}
                name={name}
                type="number"
                value={internalValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    handleInputBlur();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className={cn(
                  "w-full h-full text-xs bg-transparent border-0 shadow-none focus-visible:ring-0 p-0 pr-2",
                  prefix && "px-2",
                  placeholder && "placeholder:text-muted-foreground/70 placeholder:italic"
                )}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                placeholder={placeholder}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-2 h-full", className)}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onPrefixClick}
                className="p-1 rounded-sm hover:bg-accent"
              >
                {prefix}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Input
          id={id}
          name={name}
          type="number"
          value={internalValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={(e) => e.key === 'Enter' && handleInputBlur()}
          className="w-10 h-6 p-1 text-center bg-transparent border-0 shadow-none focus-visible:ring-0"
          disabled={disabled}
        />
        <Slider
          value={[safeValue]}
          onValueChange={handleSliderChange}
          onValueCommit={([v]) => onCommit?.(v)}
          min={min}
          max={max}
          step={step}
          className="flex-1"
        />
      </div>
    );
  }

  return (
    <div className={cn("min-w-0 flex items-center gap-1", className)}>
      {onToggleAnimation && (
        <button
          onClick={onToggleAnimation}
          className={cn(
            "h-8 w-6 flex items-center justify-center rounded-sm hover:bg-accent shrink-0",
            isAnimated ? "text-blue-500" : "text-muted-foreground"
          )}
          title="Toggle Animation"
        >
          {isAnimated ? <FilledDiamond className="h-3 w-3" /> : <Diamond className="h-3 w-3" />}
        </button>
      )}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex-1 flex items-center h-8 rounded-md border border-input bg-transparent focus-within:ring-1 focus-within:ring-ring hover:bg-accent/50 data-[disabled=true]:opacity-50 min-w-0" data-disabled={disabled}>
              <div
                onPointerDown={handlePointerDown}
                className={cn("px-2 text-xs font-medium text-zinc-400 h-full flex items-center data-[disabled=true]:cursor-not-allowed cursor-ew-resize", !prefix && "hidden")}
                data-disabled={disabled}
                onClick={onPrefixClick}
              >
                {prefix}
              </div>
              <Input
                id={id}
                name={name}
                type="number"
                value={internalValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    handleInputBlur();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className={cn(
                  "w-full h-full text-xs bg-transparent border-0 shadow-none focus-visible:ring-0 p-0 pr-2",
                  prefix && "px-2",
                  placeholder && "placeholder:text-muted-foreground/70 placeholder:italic"
                )}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                placeholder={placeholder}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
