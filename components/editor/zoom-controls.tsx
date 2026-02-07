
'use client';

import { useEditor } from '@/context/editor-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Minus, Plus, Frame } from 'lucide-react';

const ZOOM_LEVELS = [0.5, 1, 1.5, 2];

export function ZoomControls() {
  const { state, zoomActionsRef } = useEditor();
  const { canvas } = state;
  
  const handleZoomIn = () => zoomActionsRef.current?.zoomIn();
  const handleZoomOut = () => zoomActionsRef.current?.zoomOut();
  const handleZoomToFit = () => zoomActionsRef.current?.zoomToFit();
  const setZoom = (zoom: number) => zoomActionsRef.current?.setZoom(zoom);

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
        <Minus className="h-4 w-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-24">
            {Math.round(canvas.zoom * 100)}%
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={handleZoomToFit}>
            <Frame className="h-4 w-4 mr-2" />
            Zoom to fit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {ZOOM_LEVELS.map(level => (
            <DropdownMenuItem key={level} onSelect={() => setZoom(level)}>
              {level * 100}%
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
