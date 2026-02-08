
// @ts-nocheck
'use client';

import {
  Undo2, Redo2, Trash2, Download
} from 'lucide-react';
import { useEditor } from '@/context/editor-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Logo } from '../icons';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';

export default function Header() {
  const { dispatch, canUndo, canRedo, selectedObjectIds } = useEditor();

  const handleExport = () => {
    // This is a placeholder for the actual export logic
    console.log("Exporting...");
  };

  const handleDelete = () => {
    if (selectedObjectIds && selectedObjectIds.length > 0) {
      dispatch({ type: 'DELETE_SELECTED' });
    }
  };

  const handleUndo = () => dispatch({ type: 'UNDO' });
  const handleRedo = () => dispatch({ type: 'REDO' });

  return (
    <header className="flex h-16 items-center justify-between border-b px-4 shrink-0">
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Logo className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={handleUndo} disabled={!canUndo}>
              <Undo2 className="h-4 w-4 mr-2" />
              Undo
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleRedo} disabled={!canRedo}>
              <Redo2 className="h-4 w-4 mr-2" />
              Redo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleDelete} disabled={!selectedObjectIds || selectedObjectIds.length === 0}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="font-semibold text-lg">Vectoria</span>
        <span className="text-sm text-muted-foreground font-mono ml-2">v0.2.0</span>
        {process.env.NODE_ENV === 'development' && (
          <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 ml-1 border-yellow-500/50 text-yellow-500 bg-yellow-500/10">
            DEV
          </Badge>
        )}
        {/* Vercel Preview Environment Detection */}
        {process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview' && (
          <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 ml-1 border-blue-500/50 text-blue-500 bg-blue-500/10">
            BETA
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Avatar>
          <AvatarImage src="https://i.pravatar.cc/32" alt="User" />
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
