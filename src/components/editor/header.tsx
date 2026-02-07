
'use client';

import {
  Undo2, Redo2, Trash2, Download
} from 'lucide-react';
import { useEditor } from '@/context/editor-context';
import { Button } from '@/components/ui/button';
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
