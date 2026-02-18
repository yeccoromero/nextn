// @ts-nocheck


'use client';

import { useEditor } from "@/context/editor-context";
import type { SvgObject, GroupObject, DropTarget, PropertyId, Keyframe as KeyframeType, EditorState, TimelineRow, PropertyTrack, EasingId, KeyValue, LayerTrack } from "@/types/editor";
import {
  Square, Circle, Star, Type, Hexagon, Pencil, Group, ChevronDown, ChevronRight,
  Scissors, Copy, ClipboardPaste, Trash2, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Ungroup, CopyPlus, ArrowLeftRight, ArrowUpDown, Lock, Unlock, Eye, EyeOff, GripVertical, RefreshCw, Diamond
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger, ContextMenuShortcut } from '../ui/context-menu';
import { clipboard } from "@/lib/clipboard";
import { Button } from "../ui/button";
import { useState, useRef, useEffect, RefObject, useMemo } from "react";
import { Input } from "../ui/input";
import { useVirtualizer } from '@tanstack/react-virtual';
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, PointerSensor, pointerWithin, useSensor, useSensors, DragOverlay } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import AnimateProperties from "./animate-properties";
import { getWorldAnchor } from "@/lib/editor-utils";
import { FilledDiamond } from "../icons";

const getIcon = (objType: SvgObject['type']) => {
  switch (objType) {
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

const getDisplayName = (obj: SvgObject) => {
  if (obj.name) return obj.name;
  if (obj.type === 'group') return `Group (${(obj as GroupObject).children?.length || 0})`;
  return obj.type.charAt(0).toUpperCase() + obj.type.slice(1);
};

const INDENT_PX = 14;
const BASE_PAD_PX = 10;
const GUIDE_X_OFFSET = 8;

function fmt(n: number, digits = 1) {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function formatPropLabel(propertyId: PropertyId) {
  switch (propertyId) {
    case 'position': return 'Position';
    case 'scaleX': return 'Scale';
    case 'rotation': return 'Rotation';
    case 'opacity': return 'Opacity';
    default: return String(propertyId);
  }
}

const EditableValueInput = ({ initialValue, onCommit, onCancel }: { initialValue: string, onCommit: (val: string) => void, onCancel: () => void }) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleConfirm = () => {
    onCommit(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleConfirm}
      onKeyDown={handleKeyDown}
      className="h-5 p-0 m-0 text-xs bg-background/50 border-0 focus-visible:ring-0 text-right w-12"
    />
  );
};

const PropertyRowUI = ({
  objectId,
  propertyId,
  level,
  rowHeight,
}: {
  objectId: string;
  propertyId: PropertyId;
  level: number;
  rowHeight: number;
}) => {
  const { state, dispatch } = useEditor();
  const { objects, timeline } = state;
  const object = objects[objectId];
  const [editingField, setEditingField] = useState<string | null>(null);

  if (!object) return null;

  if (!object) return null;
  const isSelected = timeline.selection.properties?.some(
    p => p.objectId === objectId && p.propertyId === propertyId
  );

  const layerTrack = timeline.layers[objectId];

  const getPropertyTrack = (pid: PropertyId): PropertyTrack | undefined => {
    if (!layerTrack) return undefined;
    const resolvedPropId = (pid === 'scaleX' || pid === 'scaleY') ? 'scale' : pid;
    return layerTrack.properties.find(p => p.id === resolvedPropId);
  };

  const propTrack = getPropertyTrack(propertyId);
  const hasAnyKeyframes = !!propTrack && propTrack.keyframes.length > 0;

  const stepMs = timeline.ui.snapStepMs ?? (1000 / timeline.fps);
  const snappedPlayheadMs = Math.round(timeline.playheadMs / stepMs) * stepMs;

  const hasKeyframeHere = hasAnyKeyframes && propTrack.keyframes.some(k =>
    Math.abs(k.timeMs - snappedPlayheadMs) < 0.1
  );

  const padLeft = BASE_PAD_PX + level * INDENT_PX;

  const handleScrub = (
    e: React.PointerEvent<HTMLSpanElement | HTMLDivElement>,
    field: 'x' | 'y' | 'value'
  ) => {
    if (e.button !== 0 || object.locked) return;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();

    if (timeline.playing) {
      dispatch({ type: 'SET_TIMELINE_PLAYING', payload: false });
    }

    document.body.style.cursor = 'ew-resize';

    const initialObjState = { ...object };
    const startX = e.clientX;
    const sensitivityFactor = 0.5;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - startX;
      let change = dx * sensitivityFactor;
      if (moveEvent.shiftKey) change *= 0.1;
      if (moveEvent.altKey) change *= 10;

      let valueToCommit: any;
      let propIdToCommit: PropertyId = propertyId;

      if (propertyId === 'position') {
        valueToCommit = {
          x: field === 'x' ? initialObjState.x + change : initialObjState.x,
          y: field === 'y' ? initialObjState.y + change : initialObjState.y,
        }
      } else if (propertyId === 'scaleX') {
        propIdToCommit = 'scale';
        const initialScaleX = initialObjState.scaleX ?? 1;
        const initialScaleY = initialObjState.scaleY ?? 1;
        valueToCommit = {
          x: field === 'x' ? (initialScaleX * 100 + change) / 100 : initialScaleX,
          y: field === 'y' ? (initialScaleY * 100 + change) / 100 : initialScaleY,
        }
      } else if (propertyId === 'rotation') {
        valueToCommit = (initialObjState.rotation ?? 0) + change;
      } else if (propertyId === 'opacity') {
        valueToCommit = Math.max(0, Math.min(1, ((initialObjState.opacity ?? 1) * 100 + change) / 100));
      } else {
        return;
      }

      dispatch({
        type: 'SET_PROPERTY_VALUE_AT_PLAYHEAD',
        payload: {
          objectId,
          propertyId: propIdToCommit,
          value: valueToCommit
        },
        meta: { history: 'ignore' }
      });
    };

    const handlePointerUp = () => {
      document.body.style.cursor = 'default';
      target.releasePointerCapture(e.pointerId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      dispatch({ type: 'COMMIT_DRAG' });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };


  const handleAddKeyframe = (e: React.MouseEvent) => {
    e.stopPropagation();
    let pid: PropertyId = propertyId;
    if (propertyId === 'scaleX') pid = 'scale';

    dispatch({
      type: 'ADD_KEYFRAME_TO_PROPERTY',
      payload: { objectId, propertyId: pid, timeMs: timeline.playheadMs },
    });
  };

  const handleCommitEdit = (field: string, newValue: string) => {
    const numValue = parseFloat(newValue);
    if (isNaN(numValue)) {
      setEditingField(null);
      return;
    }

    let payloadValue: KeyValue;
    let finalPropertyId = propertyId;

    if (propertyId === 'position') {
      payloadValue = {
        x: field === 'x' ? numValue : object.x,
        y: field === 'y' ? numValue : object.y,
      };
    } else if (propertyId === 'scaleX') { // Alias for scale
      finalPropertyId = 'scale';
      payloadValue = {
        x: field === 'x' ? numValue / 100 : (object.scaleX ?? 1),
        y: field === 'y' ? numValue / 100 : (object.scaleY ?? 1),
      };
    } else if (propertyId === 'rotation') {
      payloadValue = numValue;
    } else { // opacity
      payloadValue = numValue / 100;
    }

    dispatch({
      type: 'SET_PROPERTY_VALUE_AT_PLAYHEAD',
      payload: { objectId, propertyId: finalPropertyId, value: payloadValue }
    });

    setEditingField(null);
  };

  const handleDoubleClick = (field: string) => {
    if (timeline.playing) {
      dispatch({ type: 'SET_TIMELINE_PLAYING', payload: false });
    }
    setEditingField(field);
  };

  const renderValues = () => {
    if (propertyId === 'position') {
      const pos = { x: object.x, y: object.y };
      return (
        <div className="flex items-center gap-3 text-xs text-blue-400 font-medium tabular-nums">
          <div className="flex items-center gap-1" onDoubleClick={() => handleDoubleClick('x')}>
            <span className="opacity-50 cursor-ew-resize hover:text-blue-300" onPointerDown={(e) => handleScrub(e, 'x')}>X</span>
            {editingField === 'x' ? (
              <EditableValueInput initialValue={fmt(pos.x, 1)} onCommit={(v) => handleCommitEdit('x', v)} onCancel={() => setEditingField(null)} />
            ) : <span className="w-12 text-right cursor-ew-resize hover:text-blue-300" onPointerDown={(e) => handleScrub(e, 'x')}>{fmt(pos.x, 1)}</span>}
          </div>
          <div className="flex items-center gap-1" onDoubleClick={() => handleDoubleClick('y')}>
            <span className="opacity-50 cursor-ew-resize hover:text-blue-300" onPointerDown={(e) => handleScrub(e, 'y')}>Y</span>
            {editingField === 'y' ? (
              <EditableValueInput initialValue={fmt(pos.y, 1)} onCommit={(v) => handleCommitEdit('y', v)} onCancel={() => setEditingField(null)} />
            ) : <span className="w-12 text-right cursor-ew-resize hover:text-blue-300" onPointerDown={(e) => handleScrub(e, 'y')}>{fmt(pos.y, 1)}</span>}
          </div>
        </div>
      );
    }
    if (propertyId === 'scaleX') { // Alias for 'scale'
      const sx = (object.scaleX ?? 1) * 100;
      const sy = (object.scaleY ?? 1) * 100;
      return (
        <div className="flex items-center gap-3 text-xs text-blue-400 font-medium tabular-nums">
          <div className="flex items-center gap-1" onDoubleClick={() => handleDoubleClick('x')}>
            <span className="opacity-50 cursor-ew-resize hover:text-blue-300" onPointerDown={(e) => handleScrub(e, 'x')}>X</span>
            {editingField === 'x' ? (
              <EditableValueInput initialValue={fmt(sx, 1)} onCommit={(v) => handleCommitEdit('x', v)} onCancel={() => setEditingField(null)} />
            ) : <span className="w-12 text-right cursor-ew-resize hover:text-blue-300" onPointerDown={(e) => handleScrub(e, 'x')}>{fmt(sx, 1)}%</span>}
          </div>
          <div className="flex items-center gap-1" onDoubleClick={() => handleDoubleClick('y')}>
            <span className="opacity-50 cursor-ew-resize hover:text-blue-300" onPointerDown={(e) => handleScrub(e, 'y')}>Y</span>
            {editingField === 'y' ? (
              <EditableValueInput initialValue={fmt(sy, 1)} onCommit={(v) => handleCommitEdit('y', v)} onCancel={() => setEditingField(null)} />
            ) : <span className="w-12 text-right cursor-ew-resize hover:text-blue-300" onPointerDown={(e) => handleScrub(e, 'y')}>{fmt(sy, 1)}%</span>}
          </div>
        </div>
      );
    }
    if (propertyId === 'rotation') {
      const r = object.rotation ?? 0;
      return (
        <div className="flex justify-end tabular-nums text-xs text-blue-400 font-medium" onDoubleClick={() => handleDoubleClick('value')}>
          {editingField === 'value' ? (
            <EditableValueInput initialValue={fmt(r, 1)} onCommit={(v) => handleCommitEdit('value', v)} onCancel={() => setEditingField(null)} />
          ) : <span className="w-12 text-right cursor-ew-resize hover:text-blue-300" onPointerDown={(e) => handleScrub(e, 'value')}>{fmt(r, 1)}°</span>}
        </div>
      );
    }
    if (propertyId === 'opacity') {
      const o = (object.opacity ?? 1) * 100;
      return (
        <div className="flex justify-end tabular-nums text-xs text-blue-400 font-medium" onDoubleClick={() => handleDoubleClick('value')}>
          {editingField === 'value' ? (
            <EditableValueInput initialValue={fmt(o, 0)} onCommit={(v) => handleCommitEdit('value', v)} onCancel={() => setEditingField(null)} />
          ) : <span className="w-12 text-right cursor-ew-resize hover:text-blue-300" onPointerDown={(e) => handleScrub(e, 'value')}>{fmt(o, 0)}%</span>}
        </div>
      );
    }
    return <div className="text-xs text-muted-foreground text-right pr-2">—</div>;
  };

  const handleJumpKeyframe = (direction: 'prev' | 'next') => {
    if (!hasAnyKeyframes || !propTrack) return;

    // Tolerance for floating point
    const tolerance = 0.01;
    const current = timeline.playheadMs;

    const sorted = [...propTrack.keyframes].sort((a, b) => a.timeMs - b.timeMs);

    let targetTime: number | null = null;

    if (direction === 'prev') {
      // Find last keyframe strictly less than current (minus tolerance)
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].timeMs < current - tolerance) {
          targetTime = sorted[i].timeMs;
          break;
        }
      }
    } else {
      // Find first keyframe strictly greater than current
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].timeMs > current + tolerance) {
          targetTime = sorted[i].timeMs;
          break;
        }
      }
    }

    if (targetTime !== null) {
      dispatch({ type: 'SET_TIMELINE_PLAYHEAD', payload: targetTime });
    }
  };

  return (
    <div
      className="relative"
      style={{ height: `${rowHeight}px` }}
    >
      {level > 0 && (
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: `${BASE_PAD_PX + (level - 1) * INDENT_PX + GUIDE_X_OFFSET}px`,
            width: 1,
            background: 'rgba(255,255,255,0.08)',
          }}
        />
      )}

      <div
        className={cn(
          "h-full w-full",
          "grid grid-cols-[1fr_auto_auto] items-center gap-2", // Adjusted grid
          "bg-transparent hover:bg-accent/30",
          isSelected && "bg-primary/10",
          "px-2",
          "cursor-pointer"
        )}
        style={{ paddingLeft: `${padLeft}px` }}
        onClick={(e) => {
          e.stopPropagation();
          dispatch({
            type: 'SELECT_PROPERTY_TRACK',
            payload: { objectId, propertyId, additive: e.shiftKey || e.metaKey }
          });
        }}
      >
        <div className="min-w-0" onDoubleClick={(e) => e.stopPropagation()}>
          <div className="text-[11px] leading-none text-muted-foreground/70">
            {formatPropLabel(propertyId)}
          </div>
        </div>

        <div className="justify-self-end pr-2">
          {renderValues()}
        </div>

        {/* Keyframe Controls */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => handleJumpKeyframe('prev')}
            disabled={!hasAnyKeyframes}
            className="h-6 w-4 flex items-center justify-center text-muted-foreground/50 hover:text-foreground disabled:opacity-20"
            title="Previous Keyframe"
          >
            <ChevronLeftIcon className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={handleAddKeyframe}
            className={cn(
              "h-6 w-6 rounded-sm flex items-center justify-center transition-colors",
              "hover:bg-accent/40"
            )}
            title={hasKeyframeHere ? "Remove keyframe" : "Add keyframe"}
          >
            <Diamond className={cn(
              "h-3.5 w-3.5 transform rotate-45",
              hasKeyframeHere ? "fill-blue-500 text-blue-500" : "text-muted-foreground/40"
            )} />
          </button>

          <button
            type="button"
            onClick={() => handleJumpKeyframe('next')}
            disabled={!hasAnyKeyframes}
            className="h-6 w-4 flex items-center justify-center text-muted-foreground/50 hover:text-foreground disabled:opacity-20"
            title="Next Keyframe"
          >
            <ChevronRightIcon className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ... (Helper component for icons)
function ChevronLeftIcon(props: any) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M8.84182 3.13514C9.04327 3.32401 9.05348 3.64042 8.86462 3.84188L5.43521 7.49991L8.86462 11.1579C9.05348 11.3594 9.04327 11.6758 8.84182 11.8647C8.64036 12.0535 8.32394 12.0433 8.13508 11.8419L4.38508 7.84188C4.20477 7.64955 4.20477 7.35027 4.38508 7.15794L8.13508 3.15794C8.32394 2.95648 8.64036 2.94628 8.84182 3.13514Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
    </svg>
  )
}

function ChevronRightIcon(props: any) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M6.1584 3.13508C6.35985 2.94621 6.67627 2.95642 6.86514 3.15788L10.6151 7.15788C10.7954 7.3502 10.7954 7.64949 10.6151 7.84182L6.86514 11.8418C6.67627 12.0433 6.35985 12.0535 6.1584 11.8646C5.95694 11.6757 5.94673 11.3593 6.1356 11.1579L9.56496 7.49985L6.1356 3.84182C5.94673 3.64036 5.95694 3.32394 6.1584 3.13508Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
    </svg>
  )
}


const LayerRowSortable = ({ rowKey, objectId, level, isOverlay, rowHeight }: { rowKey: string, objectId: string, level: number, isOverlay?: boolean, rowHeight: number }) => {
  const { state } = useEditor();
  const { ui } = state;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rowKey, disabled: isOverlay });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("relative select-none touch-none", isDragging && "opacity-50")}>
      <LayerRowUI
        objectId={objectId}
        level={level}
        isOverlay={isOverlay}
        dndAttributes={attributes}
        dndListeners={listeners}
        dropTarget={ui.dropTarget}
        rowHeight={rowHeight}
      />
    </div>
  );
};

const LayerRowUI = ({
  objectId,
  level,
  isOverlay,
  dndAttributes,
  dndListeners,
  dropTarget,
  rowHeight
}: {
  objectId: string;
  level: number;
  isOverlay?: boolean;
  dndAttributes?: any;
  dndListeners?: any;
  dropTarget: DropTarget | null;
  rowHeight: number;
}) => {
  const { state, dispatch } = useEditor();
  const { selectedObjectIds, objects, editingLayerId, timeline } = state;
  const object = objects[objectId];

  const [tempName, setTempName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

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
  const isCollapsed = isGroup ? (object as any).collapsed : false;
  const layerTrack = timeline.layers[objectId];
  const isExpanded = !!layerTrack?.expanded;

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
  const canGroup = selectedObjectIds.length >= 2;
  const canUngroup = selectedObjectIds.some(id => objects[id]?.type === 'group');

  const handleSelect = (e: React.MouseEvent) => {
    dispatch({ type: 'SELECT_OBJECT', payload: { id: objectId, shiftKey: e.shiftKey } });
  }

  const handleContextMenuTrigger = (e: React.MouseEvent) => {
    if (!isSelected) {
      dispatch({ type: 'SELECT_OBJECT', payload: { id: objectId, shiftKey: false } });
    }
  }

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

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          id={`timeline-layer-row-${objectId}`}
          className={cn(
            "relative flex items-center text-sm group hover:bg-accent/50",
            isSelected && !isOverlay && "bg-primary/20 hover:bg-primary/30",
            dropTarget?.id === objectId && dropTarget.type === 'group-reparent' && "ring-1 ring-primary",
            dropTarget?.id === objectId && dropTarget.type === 'reorder-before' && 'drop-indicator-top',
            dropTarget?.id === objectId && dropTarget.type === 'reorder-after' && 'drop-indicator-bottom',
            object.locked && "cursor-not-allowed"
          )}
          onClick={handleSelect}
          onContextMenu={handleContextMenuTrigger}
          onDoubleClick={() => dispatch({ type: 'START_RENAME_LAYER', payload: { id: objectId } })}
          style={{ paddingLeft: `${8 + level * 16}px`, height: `${rowHeight - 2}px`, marginTop: '1px' }}
        >

          {/* Label Color Indicator */}
          <div className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-[70%] rounded-r-sm",
            objectId.charCodeAt(0) % 5 === 0 ? "bg-red-500" :
              objectId.charCodeAt(0) % 5 === 1 ? "bg-blue-500" :
                objectId.charCodeAt(0) % 5 === 2 ? "bg-green-500" :
                  objectId.charCodeAt(0) % 5 === 3 ? "bg-yellow-500" :
                    "bg-purple-500"
          )} style={{ left: 2 }} />

          <button {...dndListeners} {...dndAttributes} className="h-6 w-6 flex items-center justify-center text-muted-foreground/50 shrink-0 cursor-grab active:cursor-grabbing focus:outline-none">
            <GripVertical className="h-4 w-4" />
          </button>
          {isGroup ? (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_LAYER_COLLAPSE', payload: { id: objectId } }) }}>
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                if (!timeline.layers[objectId]) {
                  dispatch({ type: 'TOGGLE_PROPERTY_ANIMATION', payload: { objectId, propertyId: 'opacity' as PropertyId } });
                } else {
                  dispatch({ type: 'TOGGLE_TRACK_EXPANDED', payload: { objectId } });
                }
              }}
              title={isExpanded ? 'Collapse tracks' : 'Expand tracks'}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
          <div className="flex items-center truncate gap-[10px]">
            <div className="shrink-0">{getIcon(object.type)}</div>
            {editingLayerId === objectId ? (
              <Input
                ref={inputRef}
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={handleKeyDown}
                className="h-6 px-1 py-0 text-xs bg-background/50"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate text-xs">{getDisplayName(object)}</span>
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
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPopoverOpen(true); }}>
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" onOpenAutoFocus={(e) => e.preventDefault()} onPointerDownOutside={() => setPopoverOpen(false)}>
                <AnimateProperties objectId={objectId} onClose={() => setPopoverOpen(false)} />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() => dispatch({ type: 'CUT_SELECTION' })}
          disabled={selectedObjectIds.length === 0 || isSelectionLocked}
        >
          <Scissors className="mr-2 h-4 w-4" /> Cut <ContextMenuShortcut>⌘+X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => dispatch({ type: 'COPY_SELECTION' })}
          disabled={selectedObjectIds.length === 0}>
          <Copy className="mr-2 h-4 w-4" /> Copy <ContextMenuShortcut>⌘+C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => dispatch({ type: 'PASTE_OBJECTS' })}
          disabled={clipboard.isEmpty()}
        >
          <ClipboardPaste className="mr-2 h-4 w-4" /> Paste <ContextMenuShortcut>⌘+V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => dispatch({ type: 'DUPLICATE_SELECTED_OBJECTS' })}
          disabled={selectedObjectIds.length === 0}
        >
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
        <ContextMenuItem onSelect={() => dispatch({ type: 'TOGGLE_LOCK', payload: { ids: [objectId] } })} disabled={selectedObjectIds.length === 0}>
          {isSelectionLocked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
          {isSelectionLocked ? 'Unlock' : 'Lock'}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => dispatch({ type: 'TOGGLE_VISIBILITY', payload: { ids: [objectId] } })} disabled={selectedObjectIds.length === 0}>
          {isSelectionVisible ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {isSelectionVisible ? 'Hide' : 'Show'}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu >
  );
};


export default function LayersTree({ scrollRef }: { scrollRef: RefObject<HTMLDivElement>; }) {
  const { state, dispatch } = useEditor();
  const { timelineRows, objects, zStack, ui } = state;
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const sortableIds = useMemo(() => timelineRows.filter(r => r.kind === 'header').map(r => r.key), [timelineRows]);

  const rowVirtualizer = useVirtualizer({
    count: timelineRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => timelineRows[index].height,
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

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

    const overIdMatch = (over.id as string).match(/^hdr:(.*)$/);
    if (!overIdMatch) {
      dispatch({ type: 'SET_DROP_TARGET', payload: null });
      return;
    }
    const overObjectId = overIdMatch[1];
    const overEl = document.getElementById(`timeline-layer-row-${overObjectId}`);
    if (!overEl) return;

    const rect = overEl.getBoundingClientRect();

    const activeRect = active.rect.current.translated ?? active.rect.current;
    const pointerY = activeRect.top + activeRect.height / 2;

    const y = pointerY - rect.top;

    const targetObject = objects[overObjectId as string];
    const isGroup = targetObject?.type === 'group';

    if (isGroup && y > rect.height * 0.25 && y < rect.height * 0.75) {
      dispatch({
        type: 'SET_DROP_TARGET',
        payload: { id: overObjectId as string, type: 'group-reparent' }
      });
    } else {
      const dropPosition = y < rect.height / 2 ? 'reorder-before' : 'reorder-after';
      dispatch({
        type: 'SET_DROP_TARGET',
        payload: { id: overObjectId as string, type: dropPosition }
      });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    dispatch({ type: 'SET_IS_DRAGGING_LAYER', payload: false });

    const activeIdMatch = (event.active.id as string).match(/^hdr:(.*)$/);
    if (!activeIdMatch) {
      dispatch({ type: 'SET_DROP_TARGET', payload: null });
      setActiveId(null);
      return;
    }
    const draggedId = activeIdMatch[1];
    const targetId = ui.dropTarget?.id ?? null;

    if (!ui.dropTarget && !event.over) {
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className="relative w-full"
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
        }}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {virtualItems.map((virtualItem) => {
            const row = timelineRows[virtualItem.index];
            if (!row) return null;
            return (
              <div
                key={row.key}
                className="absolute top-0 left-0 w-full"
                style={{
                  height: `${row.height}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {row.kind === 'header' ? (
                  <LayerRowSortable rowKey={row.key} objectId={row.objectId} level={row.depth} rowHeight={row.height} />
                ) : (
                  <PropertyRowUI objectId={row.objectId} propertyId={row.propertyId!} level={row.depth} rowHeight={row.height} />
                )}
              </div>
            );
          })}
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <div className="bg-accent rounded-md">
              {(() => {
                const activeRow = timelineRows.find(r => r.key === activeId);
                if (!activeRow || activeRow.kind !== 'header') return null;
                return <LayerRowSortable rowKey={activeRow.key} objectId={activeRow.objectId} level={activeRow.depth} rowHeight={activeRow.height} isOverlay />;
              })()}
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
