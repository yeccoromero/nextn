// @ts-nocheck

'use client';

import { useEditor } from "@/context/editor-context";
import { LayerRow } from './layer-row';
import { VectoriaLogo, CustomLayersIcon } from "../icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Button } from "../ui/button";
import { Undo2, Redo2, Trash2, Download, Upload, FolderKanban } from "lucide-react";
import { SidebarHeader, SidebarContent, SidebarSeparator, SidebarTrigger, useSidebar } from "../ui/sidebar";
import { importSvgString } from "@/lib/importer";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  UniqueIdentifier,
  DragOverEvent,
  pointerWithin,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { produce } from "immer";
import { useRef, useState } from "react";
import type { SvgObject, DropTarget, GroupObject } from "@/types/editor";
import { useRouter } from "next/navigation";

export const LayersPanel = () => {
  const { state, dispatch, canUndo, canRedo } = useEditor();
  const router = useRouter();

  // Add a guard clause to handle the case where state might not be initialized yet.
  if (!state) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Loading Layers...</div>
    );
  }

  const { ui, selectedObjectIds, zStack, objects } = state;
  const { toggleSidebar } = useSidebar();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleGoToProjects = () => router.push('/');

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const svgString = await file.text();
    const importedObjects = await importSvgString(svgString);

    if (importedObjects.length > 0) {
      dispatch({ type: 'IMPORT_OBJECTS', payload: { objects: importedObjects } });
    }

    if (importInputRef.current) {
      importInputRef.current.value = '';
    }
  };

  const handleExport = () => {
    console.log('Exporting...');
  };

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
    dispatch({ type: 'SET_IS_DRAGGING_LAYER', payload: true });
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      dispatch({ type: 'SET_DROP_TARGET', payload: null });
      return;
    }

    const overEl = document.getElementById(`layer-row-${over.id}`);
    if (!overEl) return;

    const rect = overEl.getBoundingClientRect();

    const activeRect = active.rect.current.translated ?? active.rect.current;
    const pointerY = activeRect.top + activeRect.height / 2;

    const y = pointerY - rect.top;

    const targetObject = objects[over.id as string];
    const isGroup = targetObject?.type === 'group';

    if (isGroup && y > rect.height * 0.25 && y < rect.height * 0.75) {
      dispatch({
        type: 'SET_DROP_TARGET',
        payload: { id: over.id as string, type: 'group-reparent' }
      });
    } else {
      const dropPosition = y < rect.height / 2 ? 'reorder-before' : 'reorder-after';
      dispatch({
        type: 'SET_DROP_TARGET',
        payload: { id: over.id as string, type: dropPosition }
      });
    }
  }


  function handleDragEnd(event: DragEndEvent) {
    dispatch({ type: 'SET_IS_DRAGGING_LAYER', payload: false });

    const { active, over } = event;
    const draggedId = active.id as string;
    const targetId = (over?.id as string) ?? ui.dropTarget?.id ?? null;

    if (!ui.dropTarget && !over) {
      // Dropped in an empty space, move to the end of the current context
      const draggedObject = objects[draggedId];
      const parentId = draggedObject.parentId;
      const siblings = parentId ? (objects[parentId] as GroupObject).children : zStack.filter(id => !objects[id].parentId);
      const lastSiblingId = siblings[siblings.length - 1];

      if (lastSiblingId && lastSiblingId !== draggedId) {
        dispatch({
          type: 'MOVE_OBJECTS',
          payload: {
            draggedId,
            targetId: lastSiblingId,
            dropTarget: { id: lastSiblingId, type: 'reorder-after' },
          }
        });
      }
    } else if (targetId && draggedId !== targetId && ui.dropTarget) {
      dispatch({
        type: 'MOVE_OBJECTS',
        payload: {
          draggedId,
          targetId,
          dropTarget: ui.dropTarget,
        }
      });
    }

    dispatch({ type: 'COMMIT_DRAG' });
    dispatch({ type: 'SET_DROP_TARGET', payload: null });
    setActiveId(null);
  }

  function handleDragCancel() {
    setActiveId(null);
    dispatch({ type: 'SET_IS_DRAGGING_LAYER', payload: false });
    dispatch({ type: 'SET_DROP_TARGET', payload: null });
  }

  const flattenedTree = (rootIds: string[]): string[] => {
    const result: string[] = [];

    const zIndex = (id: string) => {
      const i = zStack.indexOf(id);
      return i === -1 ? -Infinity : i;
    };

    const traverse = (ids: string[]) => {
      ids.forEach(id => {
        if (result.includes(id)) return;
        result.push(id);
        const obj = objects[id];
        if (obj && obj.type === 'group' && !obj.collapsed) {
          const group = obj as SvgObject & { children: string[] };
          const sortedChildren = [...(group.children || [])].filter(c => objects[c]).sort((a, b) => zIndex(b) - zIndex(a));
          traverse(sortedChildren);
        }
      });
    };
    const topLevelIds = rootIds.filter(id => !objects[id]?.parentId);
    traverse(topLevelIds.sort((a, b) => zIndex(b) - zIndex(a)));
    return result;
  };

  const sortedRootObjects = zStack.filter(id => objects[id] && !objects[id].parentId).reverse();
  const itemsToRender = flattenedTree(sortedRootObjects);


  return (
    <>
      <SidebarHeader>
        <div className="p-2 flex items-center gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:py-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                <VectoriaLogo className="h-8 w-8" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={handleGoToProjects}>
                <FolderKanban className="h-4 w-4 mr-2" />
                Back to Projects
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleImportClick}>
                <Upload className="h-4 w-4 mr-2" />
                Import SVG
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export SVG
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => dispatch({ type: 'UNDO' })} disabled={!canUndo}>
                <Undo2 className="h-4 w-4 mr-2" />
                Undo
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => dispatch({ type: 'REDO' })} disabled={!canRedo}>
                <Redo2 className="h-4 w-4 mr-2" />
                Redo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => dispatch({ type: 'DELETE_SELECTED' })} disabled={!selectedObjectIds || selectedObjectIds.length === 0}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <h3 className="text-sm font-semibold group-data-[collapsible=icon]:hidden">Vectoria</h3>
          <span className="text-xs text-muted-foreground font-mono group-data-[collapsible=icon]:hidden">v0.2.0</span>
          <div className="flex-1" />
          <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarHeader>
      <input
        type="file"
        ref={importInputRef}
        className="hidden"
        accept=".svg"
        onChange={handleFileChange}
      />
      <SidebarSeparator />
      <button
        className="w-full p-2 flex items-center gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:py-2"
        onClick={toggleSidebar}
      >
        <div className="w-10 h-10 flex items-center justify-center">
          <CustomLayersIcon className="h-5 w-5" />
        </div>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">Layers</h4>
      </button>
      <SidebarContent
        className="p-2 pt-0 group-data-[collapsible=icon]:hidden overflow-x-hidden"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={itemsToRender}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {itemsToRender.map((id) => {
                const obj = objects[id];
                if (!obj) return null;
                let level = 0;
                let current = obj;
                while (current.parentId && objects[current.parentId]) {
                  level++;
                  current = objects[current.parentId];
                }
                return <LayerRow key={id} objectId={id} level={level} />;
              })}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeId ? (
              <div className="bg-accent rounded-md">
                <LayerRow objectId={activeId} level={0} isOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </SidebarContent>
    </>
  )
}
