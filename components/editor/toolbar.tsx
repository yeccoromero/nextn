
'use client';

import { 
  MousePointer2, 
  Square,
  Circle, 
  Star, 
  Type, 
  ChevronDown,
  Hand,
  Hexagon,
  PenTool,
  Minus,
} from 'lucide-react';
import { useEditor } from '@/context/editor-context';
import type { Tool } from '@/types/editor';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '../ui/separator';
import { ZoomControls } from './zoom-controls';
import { cn } from '@/lib/utils';
import { DirectSelectionIcon, PenToolAddIcon, PenToolRemoveIcon } from '../icons';

const shapeTools: { name: Tool, icon: React.ElementType, label: string }[] = [
  { name: 'rectangle', icon: Square, label: 'Rectangle' },
  { name: 'ellipse', icon: Circle, label: 'Ellipse' },
  { name: 'star', icon: Star, label: 'Star' },
  { name: 'polygon', icon: Hexagon, label: 'Polygon' },
  { name: 'line', icon: Minus, label: 'Line' },
];

const penTools: { name: Tool, icon: React.ElementType, label: string }[] = [
    { name: 'pen', icon: PenTool, label: 'Pen Tool' },
    { name: 'add-node', icon: PenToolAddIcon, label: 'Add Node Tool' },
    { name: 'remove-node', icon: PenToolRemoveIcon, label: 'Remove Node Tool' },
];

export default function Toolbar() {
  const { state, dispatch } = useEditor();
  
  if (!state) {
    return (
        <div className="flex items-center gap-1 h-full p-1 rounded-lg border bg-background/80 backdrop-blur-sm shadow-md animate-pulse">
            <div className="h-8 w-48 bg-muted rounded-md" />
        </div>
    );
  }

  const { currentTool, lastCreationTool } = state;

  const setTool = (tool: Tool) => {
    dispatch({ type: 'SET_TOOL', payload: tool });
  }

  const ActiveShapeIcon = shapeTools.find(t => t.name === lastCreationTool)?.icon || Square;
  const isShapeToolActive = shapeTools.some(t => t.name === currentTool);
  
  const isPenToolActive = penTools.some(t => t.name === currentTool);
  const ActivePenIcon = penTools.find(t => t.name === currentTool)?.icon || PenTool;

  const selectionTools: { name: Tool, icon: React.ElementType, label: string }[] = [
    { name: 'select', icon: MousePointer2, label: 'Select' },
    { name: 'path-edit', icon: DirectSelectionIcon, label: 'Edit Path' },
  ];
  const isSelectionToolActive = selectionTools.some(t => t.name === currentTool);
  const ActiveSelectionIcon = selectionTools.find(t => t.name === currentTool)?.icon || MousePointer2;


  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 h-full p-1 rounded-lg border bg-background/80 backdrop-blur-sm shadow-md">
        <div className="flex items-center gap-1">

            <DropdownMenu>
              <Tooltip>
                  <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                          <Button variant={isSelectionToolActive ? 'secondary' : 'ghost'} className="px-2">
                            <ActiveSelectionIcon className="h-5 w-5" />
                            <ChevronDown className="h-4 w-4 ml-1 text-muted-foreground" />
                          </Button>
                      </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                      <p>Selection Tools</p>
                  </TooltipContent>
              </Tooltip>
              <DropdownMenuContent>
                  {selectionTools.map(({ name, icon: Icon, label }) => (
                      <DropdownMenuItem key={name} onSelect={() => setTool(name)} className={cn(currentTool === name && 'bg-accent')}>
                          <Icon className="h-4 w-4 mr-2" />
                          <span>{label}</span>
                      </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
              <TooltipTrigger asChild>
                  <Button
                      variant={currentTool === 'pan' ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => setTool('pan')}
                  >
                      <Hand className="h-5 w-5" />
                  </Button>
              </TooltipTrigger>
              <TooltipContent>
                  <p>Pan</p>
              </TooltipContent>
          </Tooltip>
          
          <DropdownMenu>
              <Tooltip>
                  <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                          <Button variant={isShapeToolActive ? 'secondary' : 'ghost'} className="px-2">
                            <ActiveShapeIcon className="h-5 w-5" />
                            <ChevronDown className="h-4 w-4 ml-1 text-muted-foreground" />
                          </Button>
                      </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                      <p>Shapes</p>
                  </TooltipContent>
              </Tooltip>
              <DropdownMenuContent>
                  {shapeTools.map(({ name, icon: Icon, label }) => (
                      <DropdownMenuItem key={name} onSelect={() => setTool(name)} className={cn(currentTool === name && 'bg-accent')}>
                          <Icon className="h-4 w-4 mr-2" />
                          <span>{label}</span>
                      </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
          </DropdownMenu>

            <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button variant={isPenToolActive ? 'secondary' : 'ghost'} className="px-2">
                                <ActivePenIcon className="h-5 w-5" />
                                <ChevronDown className="h-4 w-4 ml-1 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Pen Tools</p>
                    </TooltipContent>
                </Tooltip>
                <DropdownMenuContent>
                    {penTools.map(({ name, icon: Icon, label }) => (
                        <DropdownMenuItem key={name} onSelect={() => setTool(name)} className={cn(currentTool === name && 'bg-accent')}>
                            <Icon className="h-4 w-4 mr-2" />
                            <span>{label}</span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

          <Tooltip>
              <TooltipTrigger asChild>
                  <Button
                      variant={currentTool === 'text' ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => setTool('text')}
                  >
                      <Type className="h-5 w-5" />
                  </Button>
              </TooltipTrigger>
              <TooltipContent>
                  <p>Text</p>
              </TooltipContent>
          </Tooltip>
        </div>
        <Separator orientation="vertical" className="h-6" />
        <ZoomControls />
      </div>
    </TooltipProvider>
  );
}
