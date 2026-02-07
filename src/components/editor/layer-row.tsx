// @ts-nocheck

'use client';

import { useEditor } from "@/context/editor-context";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import {
    Eye, EyeOff, Lock, Unlock,
    Square, Circle, Star, Type, Hexagon, GripVertical, Pencil,
    Scissors, Copy, ClipboardPaste, Trash2, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Group, Ungroup, CopyPlus, ArrowLeftRight, ArrowUpDown, ChevronDown, ChevronRight
} from 'lucide-react';
import type { GroupObject, SvgObject } from "@/types/editor";
import { useState, useRef, useEffect } from "react";
import { clipboard } from "@/lib/clipboard";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger, ContextMenuShortcut } from '../ui/context-menu';
import { Input } from "../ui/input";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface LayerRowProps {
    objectId: string;
    level: number;
    isOverlay?: boolean;
}


export const LayerRow = ({ objectId, level, isOverlay }: LayerRowProps) => {
    const { state, dispatch } = useEditor();
    const { selectedObjectIds, objects, zStack, editingLayerId, ui } = state;

    const [tempName, setTempName] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: objectId, disabled: isOverlay });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const object = objects[objectId];

    const getDisplayName = (obj: SvgObject) => {
        if (obj.name) return obj.name;
        if (obj.type === 'group') return `Group (${(obj as GroupObject).children?.length || 0})`;
        return obj.type.charAt(0).toUpperCase() + obj.type.slice(1);
    };

    useEffect(() => {
        if (editingLayerId === objectId) {
            setTempName(getDisplayName(object));
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [editingLayerId, objectId, object]);

    if (!object) return null;

    const isSelected = selectedObjectIds.includes(objectId);
    const isGroup = object.type === 'group';
    const group = isGroup ? object as GroupObject : null;
    const hasChildren = group && group.children.length > 0;
    const isCollapsed = group?.collapsed ?? false;

    const getCommonBooleanValue = (property: 'visible' | 'locked'): boolean => {
        const relevantObjects = selectedObjectIds.map(id => objects[id]).filter(Boolean);
        if (relevantObjects.length === 0 && object) {
            return object[property] ?? (property === 'visible');
        }
        if (relevantObjects.length === 0) return property === 'visible';

        const firstValue = relevantObjects[0]?.[property];
        return relevantObjects.every(obj => obj?.[property] === firstValue) ? !!firstValue : false;
    };

    const isSelectionLocked = getCommonBooleanValue('locked');
    const isSelectionVisible = getCommonBooleanValue('visible');


    const handleSelect = (e: React.MouseEvent) => {
        dispatch({ type: 'SELECT_OBJECT', payload: { id: objectId, shiftKey: e.shiftKey } })
    }

    const handleContextMenuTrigger = (e: React.MouseEvent) => {
        if (!isSelected) {
            dispatch({ type: 'SELECT_OBJECT', payload: { id: objectId, shiftKey: false } });
        }
    }

    const getIcon = () => {
        switch (object.type) {
            case 'rectangle': return <Square className="h-4 w-4" />;
            case 'ellipse': return <Circle className="h-4 w-4" />;
            case 'star': return <Star className="h-4 w-4" />;
            case 'polygon': return <Hexagon className="h-4 w-4" />;
            case 'text': return <Type className="h-4 w-4" />;
            case 'path': return <Pencil className="h-4 w-4" />;
            case 'group': return <Group className="h-4 w-4" />;
            default: return <div className="w-4 h-4" />;
        }
    };

    const handleRename = () => {
        dispatch({ type: 'UPDATE_OBJECTS', payload: { ids: [objectId], updates: { name: tempName.trim() } } });
        dispatch({ type: 'FINISH_RENAME_LAYER' });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleRename();
        } else if (e.key === 'Escape') {
            dispatch({ type: 'FINISH_RENAME_LAYER' });
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            e.stopPropagation();
        }
    }

    const canGroup = selectedObjectIds.length >= 2;
    const canUngroup = selectedObjectIds.some(id => objects[id]?.type === 'group');

    return (
        <div ref={setNodeRef} style={style} className={cn("relative select-none touch-none", isDragging && "opacity-50")}>
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <div
                        id={`layer-row-${objectId}`}
                        onClick={handleSelect}
                        onContextMenu={handleContextMenuTrigger}
                        onDoubleClick={() => dispatch({ type: 'START_RENAME_LAYER', payload: { id: objectId } })}
                        className={cn(
                            "relative flex items-center text-sm py-0.5 pr-2 rounded-md group hover:bg-accent",
                            isSelected && !isOverlay && "bg-primary/20 hover:bg-primary/30",
                            ui.dropTarget?.id === objectId && ui.dropTarget.type === 'group-reparent' && "ring-1 ring-primary",
                            ui.dropTarget?.id === objectId && ui.dropTarget.type === 'reorder-before' && 'drop-indicator-top',
                            ui.dropTarget?.id === objectId && ui.dropTarget.type === 'reorder-after' && 'drop-indicator-bottom',
                            object.locked && "cursor-not-allowed"
                        )}
                        style={{ paddingLeft: `${8 + level * 16}px` }}
                    >
                        <button {...listeners} {...attributes} className="h-6 w-6 flex items-center justify-center text-muted-foreground/50 shrink-0 cursor-grab active:cursor-grabbing focus:outline-none">
                            <GripVertical className="h-4 w-4" />
                        </button>

                        {isGroup ? (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_LAYER_COLLAPSE', payload: { id: objectId } }) }}>
                                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                        ) : <div className="w-0 h-6 shrink-0" />}


                        <div className="flex items-center truncate gap-[10px]">
                            <div className="shrink-0">{getIcon()}</div>
                            {editingLayerId === objectId ? (
                                <Input
                                    ref={inputRef}
                                    type="text"
                                    value={tempName}
                                    onChange={(e) => setTempName(e.target.value)}
                                    onBlur={handleRename}
                                    onKeyDown={handleKeyDown}
                                    className="h-6 px-1 py-0 text-xs ml-1"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <span className="truncate">{getDisplayName(object)}</span>
                            )}
                        </div>

                        <div className="flex-1" />

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_LOCK', payload: { ids: [objectId] } }); }}>
                                {object.locked ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Unlock className="h-4 w-4 text-muted-foreground/50" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_VISIBILITY', payload: { ids: [objectId] } }); }}>
                                {object.visible !== false ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground/50" />}
                            </Button>
                        </div>
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem onSelect={() => {
                        const selected = selectedObjectIds.map(id => objects[id]);
                        clipboard.copy(selected);
                        dispatch({ type: 'DELETE_SELECTED' });
                    }}
                        disabled={selectedObjectIds.length === 0 || isSelectionLocked}
                    >
                        <Scissors className="mr-2 h-4 w-4" /> Cut <ContextMenuShortcut>⌘+X</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => clipboard.copy(selectedObjectIds.map(id => objects[id]))} disabled={selectedObjectIds.length === 0}>
                        <Copy className="mr-2 h-4 w-4" /> Copy <ContextMenuShortcut>⌘+C</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => dispatch({ type: 'PASTE_OBJECTS', payload: clipboard.paste() })}>
                        <ClipboardPaste className="mr-2 h-4 w-4" /> Paste <ContextMenuShortcut>⌘+V</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => {
                        const selected = selectedObjectIds.map(id => objects[id]);
                        dispatch({ type: 'PASTE_OBJECTS', payload: selected });
                    }} disabled={selectedObjectIds.length === 0}>
                        <CopyPlus className="mr-2 h-4 w-4" /> Duplicate <ContextMenuShortcut>⌘+D</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => dispatch({ type: 'START_RENAME_LAYER', payload: { id: objectId } })}>
                        <Pencil className="mr-2 h-4 w-4" /> Rename
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onSelect={() => dispatch({ type: 'DELETE_SELECTED' })} disabled={selectedObjectIds.length === 0 || isSelectionLocked}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete <ContextMenuShortcut>Supr</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuSub>
                        <ContextMenuSubTrigger disabled={selectedObjectIds.length === 0 || isSelectionLocked}>Order</ContextMenuSubTrigger>
                        <ContextMenuSubContent>
                            <ContextMenuItem onSelect={() => dispatch({ type: 'BRING_FORWARD', payload: { ids: selectedObjectIds } })}>
                                <ArrowUp className="mr-2 h-4 w-4" /> Bring Forward
                            </ContextMenuItem>
                            <ContextMenuItem onSelect={() => dispatch({ type: 'SEND_BACKWARDS', payload: { ids: selectedObjectIds } })}>
                                <ArrowDown className="mr-2 h-4 w-4" /> Send Backward
                            </ContextMenuItem>
                            <ContextMenuItem onSelect={() => dispatch({ type: 'BRING_TO_FRONT', payload: { ids: selectedObjectIds } })}>
                                <ChevronsUp className="mr-2 h-4 w-4" /> Bring to Front
                            </ContextMenuItem>
                            <ContextMenuItem onSelect={() => dispatch({ type: 'SEND_TO_BACK', payload: { ids: selectedObjectIds } })}>
                                <ChevronsDown className="mr-2 h-4 w-4" /> Send to Back
                            </ContextMenuItem>
                        </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSub>
                        <ContextMenuSubTrigger disabled={selectedObjectIds.length === 0 || isSelectionLocked}>Flip</ContextMenuSubTrigger>
                        <ContextMenuSubContent>
                            <ContextMenuItem onSelect={() => dispatch({ type: 'TOGGLE_FLIP', payload: { ids: selectedObjectIds, axis: 'x' } })}>
                                <ArrowLeftRight className="mr-2 h-4 w-4" /> Flip Horizontal
                            </ContextMenuItem>
                            <ContextMenuItem onSelect={() => dispatch({ type: 'TOGGLE_FLIP', payload: { ids: selectedObjectIds, axis: 'y' } })}>
                                <ArrowUpDown className="mr-2 h-4 w-4" /> Flip Vertical
                            </ContextMenuItem>
                        </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSeparator />
                    <ContextMenuItem onSelect={() => dispatch({ type: 'GROUP_OBJECTS' })} disabled={!canGroup || isSelectionLocked}>
                        <Group className="mr-2 h-4 w-4" /> Group <ContextMenuShortcut>⌘+G</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => dispatch({ type: 'UNGROUP_OBJECTS' })} disabled={!canUngroup || isSelectionLocked}>
                        <Ungroup className="mr-2 h-4 w-4" /> Ungroup <ContextMenuShortcut>⌘+Shift+G</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onSelect={() => dispatch({ type: 'TOGGLE_LOCK', payload: { ids: selectedObjectIds } })} disabled={selectedObjectIds.length === 0}>
                        {isSelectionLocked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                        {isSelectionLocked ? 'Unlock' : 'Lock'}
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => dispatch({ type: 'TOGGLE_VISIBILITY', payload: { ids: selectedObjectIds } })} disabled={selectedObjectIds.length === 0}>
                        {isSelectionVisible ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {isSelectionVisible ? 'Hide' : 'Show'}
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        </div>
    )
}
