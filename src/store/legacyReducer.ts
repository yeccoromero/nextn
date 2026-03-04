
'use client';

import { produce, enablePatches, produceWithPatches, applyPatches, Patch } from 'immer';
import type { EditorState, Tool, SvgObject, EditorCanvas, EllipseObject, RectangleObject, AnchorPosition, AlignmentType, Layer, PathObject, BezierPoint, GroupObject, SnapLine, Clip, ClipSegment, DropTarget, PropertyId, LayerTrack, TimelineState, Keyframe, ApplyPatch, TimelineSpec, TimelineRow, KeyframeMove, ClipboardEnvelope, CopiedKeyframe, KeyValue, History, HistoryEntry, Focus, PropertyTrack, EasingId, ClipboardKeyframes, InterpolationType } from '@/types/editor';
import { getOverallBBox, getObjectCenter, rotatePoint, getVisualBoundingBox, flipObjectAroundAnchor, localToWorld, isSelectionConstrained, worldToLocal, getWorldAnchor, getSmartSnap, ungroup, reparentPreservingWorld, getWorldRotation, getLocalScale, getOrientedBBox } from '@/lib/editor-utils';
import { nanoid } from 'nanoid';
import { normalizePath } from '@/lib/normalizePath';
import { transformObjectByResize, rotateAroundWorldPivot } from '@/lib/geometry';
import { AnimeRuntimeApply, getValueAtTime } from '@/lib/anim/runtime';
import { buildTimelineRows } from '@/lib/anim/timeline-rows';
import { clipboard } from '@/lib/clipboard';

enablePatches();

export type EditorAction = (
  | { type: 'CREATE_OBJECT', payload: { type: Tool, x: number, y: number } }
  | { type: 'SET_TOOL'; payload: Tool }
  | { type: 'ADD_OBJECT'; payload: SvgObject, transient?: boolean }
  | { type: 'IMPORT_OBJECTS'; payload: { objects: SvgObject[] } }
  | { type: 'SELECT_OBJECT'; payload: { id: string; shiftKey: boolean }, transient?: boolean }
  | { type: 'SELECT_MULTIPLE_OBJECTS'; payload: { ids: string[]; shiftKey: boolean } }
  | { type: 'UPDATE_OBJECTS'; payload: { ids: string[]; updates: Partial<SvgObject> }; transient?: boolean, fromAnimation?: boolean, originalValues?: Record<string, any> }
  | { type: 'OBJECTS/UPDATE_FROM_ANIMATION'; payload: ApplyPatch[], transient?: boolean }
  | { type: 'ALIGN_OBJECTS'; payload: { type: AlignmentType } }
  | { type: 'ROTATE_OBJECTS'; payload: { ids: string[]; angle: number, center?: { x: number, y: number } }, transient?: boolean }
  | { type: 'UPDATE_CANVAS'; payload: Partial<EditorCanvas>; transient?: boolean }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'DELETE_SELECTED' }
  | { type: 'TOGGLE_CONSTRAINED'; payload: { ids: string[] } }
  | { type: 'TOGGLE_CANVAS_CONSTRAINED' }
  | { type: 'LOAD_STATE'; payload: EditorState }
  | { type: 'NORMALIZE_OBJECTS'; payload: { ids: string[] }; transient?: boolean }
  | { type: 'TOGGLE_CONSTRAIN_TRANSFORM'; payload?: boolean }
  | { type: 'SET_ANCHOR_POSITION'; payload: AnchorPosition }
  | { type: 'TOGGLE_FLIP'; payload: { ids: string[]; axis: 'x' | 'y' } }
  | { type: 'SET_ZOOM', payload: { zoom: number } }
  | { type: 'COMMIT_DRAG', payload?: { propertyId?: PropertyId, startValue?: any } }
  | { type: 'PASTE_OBJECTS' }
  | { type: 'ADD_LAYER', payload: { name: string, parentId: string | null } }
  | { type: 'DELETE_LAYER', payload: string }
  | { type: 'UPDATE_LAYER', payload: { id: string, updates: Partial<Layer> } }
  | { type: 'SELECT_LAYER', payload: { id: string; shiftKey: boolean } }
  | { type: 'START_RENAME_LAYER', payload: { id: string } }
  | { type: 'FINISH_RENAME_LAYER' }
  | { type: 'MOVE_OBJECTS'; payload: { draggedId: string; targetId: string; dropTarget: DropTarget } }
  | { type: 'MOVE_TO'; payload: { id: string; toIndex: number } }
  | { type: 'BRING_FORWARD'; payload: { ids: string[]; steps?: number } }
  | { type: 'SEND_BACKWARDS'; payload: { ids: string[]; steps?: number } }
  | { type: 'BRING_TO_FRONT'; payload: { ids: string[] } }
  | { type: 'SEND_TO_BACK'; payload: { ids: string[] } }
  | { type: 'START_DRAWING_PATH'; payload: { point: { x: number; y: number }; isLine?: boolean } }
  | { type: 'UPDATE_DRAWING_PATH'; payload: { point: { x: number; y: number }; isDrag?: boolean } }
  | { type: 'DRAW_PATH_ADD_POINT'; payload: { point: { x: number; y: number } } }
  | { type: 'HOVER_DRAWING_PATH'; payload: { point: { x: number, y: number } }, transient?: boolean }
  | { type: 'FINISH_DRAWING_PATH', payload: { closed: boolean } }
  | { type: 'UPDATE_PATH_POINT'; payload: { pathId: string; pointIndex: number; newPoint: Partial<BezierPoint> }; transient?: boolean }
  | { type: 'ADD_PATH_NODE'; payload: { pathId: string; segmentIndex: number; point: { x: number; y: number } } }
  | { type: 'REMOVE_PATH_NODE'; payload: { pathId: string; pointIndex: number } }
  | { type: 'SELECT_PATH_NODE'; payload: { pathId: string; pointIndex: number }, additive?: boolean }
  | { type: 'SET_SELECTED_PATH_NODES'; payload: { nodes: Array<{ pathId: string; pointIndex: number }> } }
  | { type: 'CLEAR_SELECTED_PATH_NODES' }
  | { type: 'SET_ZSTACK_FROM_VIEW'; payload: string[] }
  | { type: 'SET_IS_DRAGGING_LAYER'; payload: boolean }
  | { type: 'SET_DROP_TARGET', payload: DropTarget | null }
  | { type: 'SET_EDITING_GRADIENT'; payload: boolean }
  | { type: 'SET_SNAP_LINES', payload: SnapLine[], transient?: boolean }
  | { type: 'GROUP_OBJECTS' }
  | { type: 'UNGROUP_OBJECTS' }
  | { type: 'TOGGLE_VISIBILITY', payload: { ids: string[] } }
  | { type: 'TOGGLE_LOCK', payload: { ids: string[] } }
  | { type: 'TOGGLE_LAYER_COLLAPSE'; payload: { id: string } }
  | { type: 'REPARENT_OBJECTS', payload: { objectIds: string[], newParentId: string | null } }
  // Timeline Actions
  | { type: 'SET_TIMELINE_PLAYHEAD'; payload: number, transient?: boolean }
  | { type: 'SET_TIMELINE_PLAYING'; payload: boolean }
  | { type: 'SET_TIMELINE_PLAYBACK_RATE'; payload: number }
  | { type: 'SET_WORK_AREA'; payload: { startMs: number, endMs: number } | null, transient?: boolean }
  | { type: 'ADD_KEYFRAME_TO_PROPERTY'; payload: { objectId: string; propertyId: PropertyId; timeMs?: number; value?: any; startValue?: any; useEvaluated?: boolean; } }
  | { type: 'SET_PROPERTY_VALUE_AT_PLAYHEAD'; payload: { objectId: string; propertyId: PropertyId; value: KeyValue; timeMs?: number; source?: 'timeline' | 'inspector' } }
  | { type: 'MOVE_TIMELINE_KEYFRAME'; payload: KeyframeMove; transient?: boolean }
  | { type: 'MOVE_TIMELINE_KEYFRAMES'; payload: { moves: KeyframeMove[] }; transient?: boolean }
  | { type: 'DELETE_TIMELINE_KEYFRAME'; payload: { objectId: string; propertyId: PropertyId; keyframeId: string } }
  | { type: 'DELETE_KEYFRAME'; payload: { objectId: string; propertyId: PropertyId; keyframeId: string } }
  | { type: 'SET_KEYFRAME_INTERPOLATION'; payload: { objectId: string; propertyId: PropertyId; keyframeId: string; interpolationType: InterpolationType } }
  | { type: 'SET_TIMELINE_DURATION'; payload: number }
  | { type: 'SET_TIMELINE_FPS'; payload: number }
  | { type: 'SET_TIMELINE_ZOOM'; payload: number }
  | { type: 'TOGGLE_TIMELINE_SNAP' }
  | { type: 'MOVE_CLIP'; payload: { clipId: string; dMs: number }, transient?: boolean }
  | { type: 'SLIDE_LAYER_TRACKS', payload: { objectIds: string[], dMs: number }, transient?: boolean }
  | { type: 'RESIZE_CLIP_START'; payload: { clipId: string; dMs: number }, transient?: boolean }
  | { type: 'RESIZE_CLIP_END'; payload: { clipId: string; dMs: number }, transient?: boolean }
  | { type: 'TOGGLE_PROPERTY_ANIMATION'; payload: { objectId: string, propertyId: PropertyId } }
  | { type: 'SELECT_KEYFRAME'; payload: { objectId: string; propertyId: PropertyId; keyframeId: string; additive?: boolean; } }
  | { type: 'DELETE_SELECTED_KEYFRAMES' }
  | { type: 'TOGGLE_TRACK_EXPANDED'; payload: { objectId: string; value?: boolean } }
  | { type: 'TOGGLE_LAYER_SOLO'; payload: { objectId: string } }
  | { type: 'TOGGLE_PROPERTY_SOLO'; payload: { objectId: string, propertyId: PropertyId } }
  | { type: 'SELECT_KEYFRAMES_IN_RECT', payload: { keys: { objectId: string, propertyId: PropertyId, keyframeId: string }[], additive: boolean } }
  | { type: 'CLEAR_KEYFRAME_SELECTION' }
  | { type: 'POSITION_SELECT_KEYFRAME'; payload: { objectId: string; timeMs: number; additive?: boolean } }
  | { type: 'POSITION_MOVE_KEYFRAME'; payload: { objectId: string; fromTimeMs: number; toTimeMs: number }, transient?: boolean }
  | { type: 'POSITION_DELETE_KEYFRAME'; payload: { objectId: string; timeMs: number } }
  | { type: 'PASTE_KEYFRAMES'; payload: { keyframes: CopiedKeyframe[]; sourceAnchorMs: number; targetTimeMs: number; targetObjectIds: string[]; collision: 'replace' | 'skip'; selectNew?: boolean } }
  | { type: 'HISTORY_COMMIT_BATCH'; payload: { groupId: string } }
  | { type: 'COPY_SELECTION' }
  | { type: 'CUT_SELECTION' }
  | { type: 'DUPLICATE_SELECTED_OBJECTS' }
  | { type: 'UPDATE_KEYFRAME_CONTROL_POINTS'; payload: { objectId: string; propertyId: PropertyId; keyframeId: string; controlPoints: { x1: number; y1: number; x2: number; y2: number } } }
  | { type: 'SET_KEYFRAME_TANGENT_MODE'; payload: { objectId: string; propertyId: PropertyId; keyframeId: string; mode: 'broken' | 'smooth' | 'auto' } }
  | { type: 'SELECT_PROPERTY_TRACK'; payload: { objectId: string; propertyId: PropertyId; additive?: boolean } }
  | { type: 'SET_KEYFRAME_EASING'; payload: { objectId: string; propertyId: PropertyId; keyframeId: string; easing: EasingId } }
) & { meta?: { history?: "ignore" | { groupId: string } }; transient?: boolean };




export const ROOT_LAYER_ID = 'root';

export const initialState: EditorState = {
  objects: {},
  layers: {
    [ROOT_LAYER_ID]: {
      id: ROOT_LAYER_ID,
      name: 'Root',
      parentId: null,
      children: [],
      objectIds: [],
      visible: true,
      locked: false,
      collapsed: false,
    }
  },
  layerOrder: [ROOT_LAYER_ID],
  selectedObjectIds: [],
  selectedLayerIds: [],
  currentTool: 'select',
  lastCreationTool: 'rectangle',
  canvas: {
    width: 1920,
    height: 1080,
    background: '#ffffff',
    pan: { x: 0, y: 0 },
    zoom: 1,
    isConstrained: false,
    snapToGrid: false,
    gridSize: 20,
  },
  constrainTransform: false,
  editingLayerId: null,
  drawingPath: null,
  zStack: [],
  ui: {
    focus: { type: "selection", payload: { objectIds: [] } },
    isDraggingLayer: false,
    isEditingGradient: false,
    snapLines: [],
    dropTarget: null,
  },
  selectedPathNodes: [],
  timeline: {
    durationMs: 5000,
    fps: 30,
    playheadMs: 0,
    playing: false,
    loop: true,
    playbackRate: 1,
    workArea: null,
    layers: {},
    selection: {
      properties: []
    },
    ui: {
      zoom: 1,
      snap: true,
      snapStepMs: 1000 / 30,
      armedPosition: undefined,
    },
  },
  timelineRows: [],
};

const dedupNodes = (nodes: Array<{ pathId: string; pointIndex: number }>) => {
  const seen = new Set<string>();
  return nodes.filter(n => {
    const k = `${n.pathId}:${n.pointIndex}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function coerceToPosition(pid: PropertyId): PropertyId {
  return (pid === 'x' || pid === 'y' || pid === 'position') ? 'position' : pid;
}

const coerceToScale = (pid: PropertyId): PropertyId =>
  (pid === 'scaleX' || pid === 'scaleY' || pid === 'scale') ? 'scale' : pid;

function getPos(obj: any) {
  return { x: obj?.x ?? 0, y: obj?.y ?? 0 };
}

function migrateScaleXScaleYToScale(layerTrack: LayerTrack) {
  if (!layerTrack?.properties?.length) return;
  const xTr = layerTrack.properties.find(p => p.id === 'scaleX');
  const yTr = layerTrack.properties.find(p => p.id === 'scaleY');
  if (!xTr && !yTr) return;

  const scaleMap = new Map<number, { x?: number, y?: number, easing?: any }>();
  if (xTr) xTr.keyframes.forEach(k => {
    const entry = scaleMap.get(k.timeMs) ?? {};
    entry.x = k.value as number;
    entry.easing = entry.easing ?? k.easing;
    scaleMap.set(k.timeMs, entry);
  });
  if (yTr) yTr.keyframes.forEach(k => {
    const entry = scaleMap.get(k.timeMs) ?? {};
    entry.y = k.value as number;
    entry.easing = entry.easing ?? k.easing;
    scaleMap.set(k.timeMs, entry);
  });

  const merged: Keyframe[] = Array.from(scaleMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([timeMs, v]) => ({
      id: nanoid(),
      timeMs,
      value: { x: v.x ?? 1, y: v.y ?? 1 },
      easing: v.easing ?? 'linear'
    }));

  layerTrack.properties = layerTrack.properties.filter(p => p.id !== 'scaleX' && p.id !== 'scaleY' && p.id !== 'scale');
  if (merged.length > 0) {
    layerTrack.properties.push({ id: 'scale', keyframes: merged });
  }
}


function migrateXYtoPosition(layerTrack: LayerTrack, objects: Record<string, SvgObject>, objectId: string) {
  if (!layerTrack?.properties?.length) return;
  const xTr = layerTrack.properties.find(p => p.id === 'x');
  const yTr = layerTrack.properties.find(p => p.id === 'y');
  if (!xTr && !yTr) return;

  const posMap = new Map<number, { id?: string; x?: number; y?: number; easing?: any }>();
  const addFrom = (tr: { keyframes: Keyframe[] }, axis: 'x' | 'y') => {
    tr.keyframes.forEach(k => {
      const key = k.timeMs;
      const entry = posMap.get(key) ?? {};
      entry[axis] = k.value as number;
      entry.easing = entry.easing ?? k.easing;
      posMap.set(key, entry);
    });
  };
  if (xTr) addFrom(xTr, 'x');
  if (yTr) addFrom(yTr, 'y');

  const merged: Keyframe[] = Array.from(posMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([timeMs, v]) => ({
      id: nanoid(),
      timeMs,
      value: { x: v.x ?? objects[objectId].x, y: v.y ?? objects[objectId].y },
      easing: v.easing ?? 'linear'
    }));

  layerTrack.properties = layerTrack.properties.filter(p => p.id !== 'x' && p.id !== 'y' && p.id !== 'position');
  if (merged.length > 0) {
    layerTrack.properties.push({ id: 'position' as PropertyId, keyframes: merged });
  }
}


const getStep = (draft: EditorState) =>
  draft.timeline.ui?.snapStepMs ?? (1000 / (draft.timeline.fps || 30));

const quantize = (draft: EditorState, x: number) => {
  const step = getStep(draft);
  if (step <= 0) return x;
  return Math.round(x / step) * step;
};

const eq = (draft: EditorState, a: number, b: number) =>
  Math.abs(a - b) <= getStep(draft) / 4;

function ensureTrack(layer: LayerTrack, pid: PropertyId): PropertyTrack {
  if (!layer.properties) layer.properties = [];
  let tr = layer.properties.find(p => p.id === pid);
  if (!tr) {
    tr = { id: pid, keyframes: [] };
    layer.properties.push(tr);
    layer.expanded = true;
  }
  return tr;
}

function findPosKeyAtTime(tr: { keyframes: Keyframe[] } | undefined, draft: EditorState, t: number) {
  if (!tr) return undefined;
  const i = tr.keyframes.findIndex(k => eq(draft, k.timeMs, t));
  return i >= 0 ? tr.keyframes[i] : undefined;
}

const expandAlias = (p: PropertyId): PropertyId[] =>
  p === 'position' ? ['position'] :
    p === 'scale' ? ['scale'] :
      [p];

const toNum = (v: any, fallback: number) =>
  Number.isFinite(v) ? v : fallback;

function sanitizeGeom(obj: SvgObject, updates: Partial<SvgObject>) {
  if ('x' in updates) updates.x = toNum((updates as any).x, obj.x ?? 0);
  if ('y' in updates) updates.y = toNum((updates as any).y, obj.y ?? 0);
  if ('rotation' in updates) updates.rotation = toNum((updates as any).rotation, obj.rotation ?? 0);
  if ('scaleX' in updates) updates.scaleX = toNum((updates as any).scaleX, obj.scaleX ?? 1);
  if ('scaleY' in updates) updates.scaleY = toNum((updates as any).scaleY, obj.scaleY ?? 1);
}

function applyToObjectBase(obj: SvgObject, propertyId: PropertyId, value: any) {
  if (!obj) return;
  if (propertyId === 'position') {
    obj.x = value?.x ?? obj.x;
    obj.y = value?.y ?? obj.y;
    return;
  }
  if (propertyId === 'scale') {
    obj.scaleX = value?.x ?? obj.scaleX ?? 1;
    obj.scaleY = value?.y ?? obj.scaleY ?? 1;
    return;
  }
  (obj as any)[propertyId] = value;
}

function getExistingPropTrack(draft: EditorState, objectId: string, propertyId: PropertyId): PropertyTrack | null {
  const layer = draft.timeline.layers[objectId];
  if (!layer || !layer.properties) return null;
  const resolvedPropId = propertyId === 'scaleX' || propertyId === 'scaleY' ? 'scale' : propertyId;
  return layer.properties?.find(p => p.id === resolvedPropId) ?? null;
}

function upsertKeyframe(track: PropertyTrack, timeMs: number, value: any, options: { easing?: EasingId, interpolation?: InterpolationType, tangentMode?: 'broken' | 'smooth' | 'auto', controlPoints?: { x1: number; y1: number; x2: number; y2: number }, spatialTangentIn?: { x: number; y: number }, spatialTangentOut?: { x: number; y: number } } = {}): string {
  const clonedValue = structuredClone(value);

  const existingIndex = track.keyframes.findIndex(k => Math.abs(k.timeMs - timeMs) < 0.5);

  if (existingIndex !== -1) {
    const existingKf = track.keyframes[existingIndex];
    existingKf.value = clonedValue;
    existingKf.timeMs = timeMs;
    if (options.easing) existingKf.easing = options.easing;
    if (options.interpolation) existingKf.interpolation = options.interpolation;
    if (options.tangentMode) existingKf.tangentMode = options.tangentMode;
    if (options.controlPoints) existingKf.controlPoints = options.controlPoints;
    if (options.spatialTangentIn) existingKf.spatialTangentIn = options.spatialTangentIn;
    if (options.spatialTangentOut) existingKf.spatialTangentOut = options.spatialTangentOut;

    track.keyframes.sort((a, b) => a.timeMs - b.timeMs);
    return existingKf.id;
  } else {
    const kf: Keyframe = {
      id: nanoid(),
      timeMs,
      value: clonedValue,
      easing: options.easing || 'linear',
      interpolation: options.interpolation || 'linear',
      tangentMode: options.tangentMode,
      controlPoints: options.controlPoints,
      spatialTangentIn: options.spatialTangentIn,
      spatialTangentOut: options.spatialTangentOut
    };
    track.keyframes.push(kf);
    track.keyframes.sort((a, b) => a.timeMs - b.timeMs);
    return kf.id;
  }
}

const editorRecipe = (draft: EditorState, action: EditorAction) => {
  const timelineRowsChanged = () => draft.timelineRows = buildTimelineRows(draft);

  switch (action.type) {
    case 'COPY_SELECTION': {
      if ((draft.timeline.selection?.keyIds?.length ?? 0) > 0) {
        const keyIds = draft.timeline.selection?.keyIds ?? [];
        const allKeyframes: CopiedKeyframe[] = [];

        Object.values(draft.timeline.layers).forEach(layer => {
          if (!layer) return;
          (layer.properties || []).forEach(propTrack => {
            (propTrack.keyframes || []).forEach(kf => {
              if (keyIds.includes(kf.id)) {
                allKeyframes.push({
                  relativeTimeMs: kf.timeMs,
                  value: kf.value,
                  easing: kf.easing,
                  interpolation: kf.interpolation,
                  tangentMode: kf.tangentMode,
                  controlPoints: kf.controlPoints ? { ...kf.controlPoints } : undefined,
                  spatialTangentIn: kf.spatialTangentIn ? { ...kf.spatialTangentIn } : undefined,
                  spatialTangentOut: kf.spatialTangentOut ? { ...kf.spatialTangentOut } : undefined,
                  propertyId: propTrack.id,
                  objectId: layer.objectId,
                });
              }
            });
          });
        });

        if (allKeyframes.length === 0) return;

        const sourceAnchorMs = Math.min(...allKeyframes.map(kf => kf.relativeTimeMs));

        allKeyframes.forEach(kf => {
          kf.relativeTimeMs -= sourceAnchorMs;
        });

        const payload: ClipboardKeyframes = {
          schema: 'comware/vectoria',
          version: 1,
          type: 'keyframes',
          sourceAnchorMs,
          payload: allKeyframes,
        };
        clipboard.copy(payload);
        return;
      }

      const selectedObjects = draft.selectedObjectIds.map(id => draft.objects[id]).filter(Boolean);
      if (selectedObjects.length === 0) return;

      const objectsToCopy = new Set<SvgObject>();
      const timelineLayersToCopy: Record<string, LayerTrack> = {};

      const addChildrenRecursively = (obj: SvgObject) => {
        objectsToCopy.add(obj);
        if (draft.timeline.layers[obj.id]) {
          timelineLayersToCopy[obj.id] = JSON.parse(JSON.stringify(draft.timeline.layers[obj.id]));
        }
        if (obj.type === 'group') {
          (obj as GroupObject).children.forEach(childId => {
            const child = draft.objects[childId];
            if (child) addChildrenRecursively(child);
          });
        }
      };

      selectedObjects.forEach(addChildrenRecursively);

      const payload: ClipboardEnvelope = {
        schema: 'comware/vectoria',
        version: 1,
        type: 'objects-with-timeline',
        payload: {
          objects: Array.from(objectsToCopy),
          timelineLayers: timelineLayersToCopy
        }
      };
      clipboard.copy(payload);
      return;
    }
    case 'CUT_SELECTION': {
      // Logic for copying
      const selectedObjects = draft.selectedObjectIds.map(id => draft.objects[id]).filter(Boolean);
      if (selectedObjects.length === 0) return;

      const objectsToCopy = new Set<SvgObject>();
      const timelineLayersToCopy: Record<string, LayerTrack> = {};
      const addChildrenRecursively = (obj: SvgObject) => {
        objectsToCopy.add(obj);
        if (draft.timeline.layers[obj.id]) {
          timelineLayersToCopy[obj.id] = JSON.parse(JSON.stringify(draft.timeline.layers[obj.id]));
        }
        if (obj.type === 'group') {
          (obj as GroupObject).children.forEach(childId => {
            const child = draft.objects[childId];
            if (child) addChildrenRecursively(child);
          });
        }
      };
      selectedObjects.forEach(addChildrenRecursively);

      const payload: ClipboardEnvelope = {
        schema: 'comware/vectoria',
        version: 1,
        type: 'objects-with-timeline',
        payload: {
          objects: Array.from(objectsToCopy),
          timelineLayers: timelineLayersToCopy
        }
      };
      clipboard.copy(payload);

      // Logic for deleting
      const toDelete = new Set(draft.selectedObjectIds);
      draft.selectedObjectIds.forEach(id => {
        const obj = draft.objects[id];
        if (obj?.type === 'group') {
          (obj as GroupObject).children.forEach(childId => toDelete.add(childId));
        }
      });

      toDelete.forEach(id => {
        delete draft.objects[id];
        delete draft.timeline.layers[id];
        draft.zStack = draft.zStack.filter(zid => zid !== id);
      });
      for (const objId in draft.objects) {
        const obj = draft.objects[objId];
        if (obj.type === 'group') {
          (obj as GroupObject).children = (obj as GroupObject).children.filter(childId => !toDelete.has(childId));
        }
      }

      draft.selectedObjectIds = [];
      draft.ui.focus = { type: 'selection', payload: { objectIds: [] } };
      draft.selectedPathNodes = [];
      timelineRowsChanged();
      return;
    }
    case 'DUPLICATE_SELECTED_OBJECTS': {
      const selectedObjects = draft.selectedObjectIds.map(id => draft.objects[id]).filter(Boolean);
      if (selectedObjects.length === 0) return;

      const objectsToCopy = new Set<SvgObject>();
      const timelineLayersToCopy: Record<string, LayerTrack> = {};
      const addChildrenRecursively = (obj: SvgObject) => {
        objectsToCopy.add(obj);
        if (draft.timeline.layers[obj.id]) {
          timelineLayersToCopy[obj.id] = JSON.parse(JSON.stringify(draft.timeline.layers[obj.id]));
        }
        if (obj.type === 'group') {
          (obj as GroupObject).children.forEach(childId => {
            const child = draft.objects[childId];
            if (child) addChildrenRecursively(child);
          });
        }
      };
      selectedObjects.forEach(addChildrenRecursively);

      const idMap: Record<string, string> = {};
      const newObjects: SvgObject[] = [];
      const newTimelineLayers: Record<string, LayerTrack> = {};

      objectsToCopy.forEach(obj => {
        idMap[obj.id] = nanoid();
      });

      objectsToCopy.forEach(obj => {
        const newId = idMap[obj.id];
        const isTopLevel = !obj.parentId || !idMap[obj.parentId];

        const newObj: SvgObject = {
          ...JSON.parse(JSON.stringify(obj)),
          id: newId,
          parentId: obj.parentId ? idMap[obj.parentId] : undefined,
          x: obj.x + (isTopLevel ? 10 : 0),
          y: obj.y + (isTopLevel ? 10 : 0),
        };
        if (newObj.type === 'group') {
          (newObj as GroupObject).children = (newObj as GroupObject).children.map(childId => idMap[childId]);
        }
        newObjects.push(newObj);

        if (timelineLayersToCopy[obj.id]) {
          const originalLayer = timelineLayersToCopy[obj.id];
          const newLayer: LayerTrack = {
            ...JSON.parse(JSON.stringify(originalLayer)),
            objectId: newId,
            clip: {
              ...(originalLayer.clip || { id: obj.id, segments: [] }),
              id: newId,
            },
            properties: (originalLayer.properties || []).map(propTrack => ({
              ...propTrack,
              keyframes: (propTrack.keyframes || []).map(kf => ({
                ...kf,
                id: nanoid(),
              })),
            })),
          };
          newTimelineLayers[newId] = newLayer;
        }
      });

      const topLevelNewObjects = newObjects.filter(obj => !obj.parentId || !idMap[obj.parentId]);

      newObjects.forEach(obj => {
        draft.objects[obj.id] = obj;
      });
      Object.assign(draft.timeline.layers, newTimelineLayers);

      const highestZIndexOfOriginals = Math.max(...draft.selectedObjectIds.map(id => draft.zStack.indexOf(id)));
      const newZStack = [...draft.zStack];
      newZStack.splice(highestZIndexOfOriginals + 1, 0, ...topLevelNewObjects.map(o => o.id));
      draft.zStack = newZStack;

      draft.selectedObjectIds = topLevelNewObjects.map(obj => obj.id);
      draft.selectedPathNodes = [];
      draft.timeline.selection = {}; // Clear keyframe selection
      timelineRowsChanged();
      return;
    }
    case 'PASTE_OBJECTS': {
      const envelope = clipboard.paste();
      if (!envelope) return;

      if (envelope.type === 'keyframes') {
        const { payload: keyframesToPaste } = envelope;
        const targetObjectIds = draft.selectedObjectIds;
        const targetTimeMs = draft.timeline.playheadMs;

        if (targetObjectIds.length === 0 || keyframesToPaste.length === 0) {
          return;
        }

        targetObjectIds.forEach(targetId => {
          const object = draft.objects[targetId];
          if (!object || object.locked) return;

          let layerTrack = draft.timeline.layers[targetId];
          if (!layerTrack) {
            layerTrack = draft.timeline.layers[targetId] = {
              objectId: targetId,
              properties: [],
              clip: { id: targetId, segments: [{ startMs: 0, endMs: draft.timeline.durationMs }] },
            };
          }
          if (!layerTrack.properties) {
            layerTrack.properties = [];
          }

          keyframesToPaste.forEach(kfToPaste => {
            let propTrack = layerTrack.properties.find(p => p.id === kfToPaste.propertyId);
            if (!propTrack) {
              propTrack = { id: kfToPaste.propertyId, keyframes: [] };
              layerTrack.properties.push(propTrack);
              layerTrack.expanded = true;
            }

            const newTimeMs = targetTimeMs + kfToPaste.relativeTimeMs;

            upsertKeyframe(propTrack, newTimeMs, kfToPaste.value, {
              easing: kfToPaste.easing,
              interpolation: kfToPaste.interpolation,
              tangentMode: kfToPaste.tangentMode,
              controlPoints: kfToPaste.controlPoints ? structuredClone(kfToPaste.controlPoints) : undefined,
              spatialTangentIn: kfToPaste.spatialTangentIn ? structuredClone(kfToPaste.spatialTangentIn) : undefined,
              spatialTangentOut: kfToPaste.spatialTangentOut ? structuredClone(kfToPaste.spatialTangentOut) : undefined
            });
          });
        });

        timelineRowsChanged();
        return;
      }

      let objectsToPaste: SvgObject[];
      let timelineLayersToPaste: Record<string, LayerTrack> | undefined;

      if (envelope.type === 'objects-with-timeline') {
        objectsToPaste = envelope.payload.objects;
        timelineLayersToPaste = envelope.payload.timelineLayers;
      } else {
        objectsToPaste = envelope.payload;
        timelineLayersToPaste = {};
      }

      if (objectsToPaste.length === 0) return;

      const idMap: Record<string, string> = {};
      objectsToPaste.forEach(obj => {
        idMap[obj.id] = nanoid();
      });

      const newObjects: SvgObject[] = [];
      const newTimelineLayers: Record<string, LayerTrack> = {};

      objectsToPaste.forEach(obj => {
        const newId = idMap[obj.id];
        const isTopLevel = !obj.parentId || !idMap[obj.parentId];

        const newObj: SvgObject = {
          ...JSON.parse(JSON.stringify(obj)),
          id: newId,
          parentId: obj.parentId ? idMap[obj.parentId] : undefined,
          x: obj.x,
          y: obj.y,
        };

        if (newObj.type === 'group') {
          (newObj as GroupObject).children = (newObj as GroupObject).children.map(childId => idMap[childId]);
        }
        newObjects.push(newObj);

        if (timelineLayersToPaste && timelineLayersToPaste[obj.id]) {
          const originalLayer = timelineLayersToPaste[obj.id];
          const newLayer: LayerTrack = {
            ...JSON.parse(JSON.stringify(originalLayer)),
            objectId: newId,
            clip: {
              ...(originalLayer.clip || { id: obj.id, segments: [] }),
              id: newId,
            },
            properties: (originalLayer.properties || []).map(propTrack => ({
              ...propTrack,
              keyframes: (propTrack.keyframes || []).map(kf => ({
                ...kf,
                id: nanoid(),
              })),
            })),
          };
          newTimelineLayers[newId] = newLayer;
        }
      });

      const topLevelNewObjects = newObjects.filter(obj => !obj.parentId || !idMap[obj.parentId]);

      newObjects.forEach(obj => {
        draft.objects[obj.id] = obj;
      });

      Object.assign(draft.timeline.layers, newTimelineLayers);

      const highestZIndexOfSelection = draft.selectedObjectIds.length > 0
        ? Math.max(...draft.selectedObjectIds.map(id => draft.zStack.indexOf(id)))
        : draft.zStack.length - 1;

      const newZStack = [...draft.zStack];
      newZStack.splice(highestZIndexOfSelection + 1, 0, ...topLevelNewObjects.map(o => o.id));
      draft.zStack = newZStack;

      draft.selectedObjectIds = topLevelNewObjects.map(obj => obj.id);
      draft.selectedPathNodes = [];
      draft.timeline.selection = {}; // Clear keyframe selection
      timelineRowsChanged();
      return;
    }
    case 'SET_PROPERTY_VALUE_AT_PLAYHEAD': {
      const { objectId, propertyId, value } = action.payload;
      const obj = draft.objects[objectId];
      if (!obj || obj.locked) return;

      applyToObjectBase(obj, propertyId, value);

      const track = getExistingPropTrack(draft, objectId, propertyId);
      if (!track) return; // Only keyframe if property is already animated

      const t0 = action.payload.timeMs ?? draft.timeline.playheadMs;
      const t = draft.timeline.ui.snap ? quantize(draft, t0) : t0;

      upsertKeyframe(track, Math.max(0, t), value);

      return;
    }
    case 'OBJECTS/UPDATE_FROM_ANIMATION': {
      for (const { objectId, patch } of action.payload) {
        const obj = draft.objects[objectId];
        if (obj) {
          // --- 🚨 LIVE NAN TRAP 🚨 ---
          // Prevent any math calculation from crashing the DOM renderer during playback
          for (const key in patch) {
            const v = (patch as any)[key];
            if (typeof v === 'number' && !Number.isFinite(v)) {
              (patch as any)[key] = 0;
            } else if (v && typeof v === 'object') {
              if (typeof v.x === 'number' && !Number.isFinite(v.x)) v.x = 0;
              if (typeof v.y === 'number' && !Number.isFinite(v.y)) v.y = 0;
            }
          }
          Object.assign(obj, patch);
        }
      }
      return;
    }
    case 'SET_KEYFRAME_TANGENT_MODE': {
      const { objectId, propertyId, keyframeId, mode } = action.payload;
      const layerTrack = draft.timeline.layers[objectId];
      if (!layerTrack) return;

      const propTrack = layerTrack.properties.find(p => p.id === propertyId);
      if (!propTrack) return;

      const kf = propTrack.keyframes.find(k => k.id === keyframeId);
      if (kf) {
        kf.tangentMode = mode;
      }
      return;
    }
    case 'CLEAR_KEYFRAME_SELECTION': {
      draft.timeline.selection.keyIds = [];
      return;
    }
    case 'SELECT_KEYFRAMES_IN_RECT': {
      const { keys, additive } = action.payload;
      const pickedKeyIds = keys.map(k => k.keyframeId);
      // Get unique object IDs from the selected keyframes
      const pickedObjectIds = Array.from(new Set(keys.map(k => k.objectId)));

      if (additive) {
        // Add unique keyframes to selection
        const newKeyIds = Array.from(new Set([...(draft.timeline.selection.keyIds || []), ...pickedKeyIds]));
        draft.timeline.selection.keyIds = newKeyIds;

        // Add unique objects to selection? (Optional, maybe keep focus on keyframes)
        // For now, let's keep object selection separate or additive if desired.
        // But crucially, let's update property isolation:

        if (!draft.timeline.selection.properties) draft.timeline.selection.properties = [];

        keys.forEach(k => {
          // Normalize Property ID (scaleX/scaleY -> scale) for track lookup
          const normalizedPid = (k.propertyId === 'scaleX' || k.propertyId === 'scaleY') ? 'scale' : k.propertyId;

          const exists = draft.timeline.selection.properties!.some(p => p.objectId === k.objectId && p.propertyId === normalizedPid);
          if (!exists) {
            draft.timeline.selection.properties!.push({ objectId: k.objectId, propertyId: normalizedPid as PropertyId });
          }
        });

      } else {
        // Replace selection
        draft.timeline.selection.keyIds = pickedKeyIds;

        // Also update object selection to reflect the layers these keys belong to?
        // Often good for context, but let's stick to requested behavior: Property Isolation.

        // Isolate properties of selected keyframes
        const newProps: { objectId: string, propertyId: PropertyId }[] = [];
        keys.forEach(k => {
          // Normalize Property ID (scaleX/scaleY -> scale) for track lookup
          const normalizedPid = (k.propertyId === 'scaleX' || k.propertyId === 'scaleY') ? 'scale' : k.propertyId;

          const exists = newProps.some(p => p.objectId === k.objectId && p.propertyId === normalizedPid);
          if (!exists) {
            newProps.push({ objectId: k.objectId, propertyId: normalizedPid as PropertyId });
          }
        });
        draft.timeline.selection.properties = newProps;
      }
      return;
    }


    case 'DELETE_SELECTED_KEYFRAMES': {
      const { keyIds } = draft.timeline.selection;
      if (!keyIds || keyIds.length === 0) return;

      for (const objectId in draft.timeline.layers) {
        const layerTrack = draft.timeline.layers[objectId];
        if (!layerTrack || !layerTrack.properties) continue;

        layerTrack.properties.forEach(propTrack => {
          propTrack.keyframes = propTrack.keyframes.filter(kf => !keyIds.includes(kf.id));
        });

        layerTrack.properties = layerTrack.properties.filter(p => p.keyframes.length > 0);
      }

      draft.timeline.selection = {};
      timelineRowsChanged();
      return;
    }
    case 'SELECT_KEYFRAME': {
      const { objectId, propertyId, keyframeId, additive } = action.payload;
      const sel = draft.timeline.selection;

      const isSameTrack = sel.objectId === objectId && sel.propertyId === propertyId;
      const currentKeyIds = sel.keyIds ?? [];
      const alreadySelected = currentKeyIds.includes(keyframeId);

      let newKeyIds: string[];
      let newObjectIds: string[];

      if (additive) {
        const currentObjectIds = new Set(draft.selectedObjectIds);
        if (alreadySelected) {
          newKeyIds = currentKeyIds.filter(id => id !== keyframeId);
          const remainingForObject = Object.values(draft.timeline.layers).some(layer =>
            layer.objectId === objectId &&
            layer.properties.some(prop =>
              prop.keyframes.some(kf => newKeyIds.includes(kf.id))
            )
          );
          if (!remainingForObject) {
            currentObjectIds.delete(objectId);
          }
        } else {
          newKeyIds = [...currentKeyIds, keyframeId];
          currentObjectIds.add(objectId);
        }
        newObjectIds = Array.from(currentObjectIds);
      } else {
        newKeyIds = [keyframeId];
        newObjectIds = [objectId];
      }

      draft.selectedObjectIds = newObjectIds;

      // Normalize propery ID for isolation
      const normalizedPid = (propertyId === 'scaleX' || propertyId === 'scaleY') ? 'scale' : propertyId;

      draft.timeline.selection = {
        objectId: newObjectIds.length > 0 ? objectId : undefined,
        propertyId: newObjectIds.length > 0 ? propertyId : undefined,
        keyIds: newKeyIds,
        properties: draft.timeline.selection.properties || []
      };

      if (!additive) {
        // Exclusive selection

        // CHECK PERSISTENCE: Is the property ALREADY visible?
        const isAlreadyVisible = (draft.timeline.selection.properties || []).some(
          p => p.objectId === objectId && p.propertyId === normalizedPid
        );

        if (isAlreadyVisible) {
          // 1. If visible, KEEP current view (don't hide others)
          // This allows editing a keyframe in a multi-prop view without losing context
        } else {
          // 2. If NOT visible, switch context to this property (Standard exclusive behavior)
          if (newObjectIds.length > 0) {
            draft.timeline.selection.properties = [{ objectId, propertyId: normalizedPid as PropertyId }];
          } else {
            draft.timeline.selection.properties = [];
          }
        }
      } else {
        // Additive: Ensure property is visible if we selected a key
        if (!draft.timeline.selection.properties) draft.timeline.selection.properties = [];

        // If we just added a key (not removed), ensure property is listed
        if (!alreadySelected && newObjectIds.length > 0) {
          const exists = draft.timeline.selection.properties.some(p => p.objectId === objectId && p.propertyId === normalizedPid);
          if (!exists) {
            draft.timeline.selection.properties.push({ objectId, propertyId: normalizedPid as PropertyId });
          }
        }
      }

      return;
    }
    case 'TOGGLE_TRACK_EXPANDED': {
      const { objectId, value } = action.payload;
      if (!draft.timeline.layers[objectId]) return;
      const curr = !!draft.timeline.layers[objectId].expanded;
      draft.timeline.layers[objectId].expanded = value ?? !curr;
      timelineRowsChanged();
      return;
    }
    case 'TOGGLE_PROPERTY_ANIMATION': {
      const { objectId, propertyId } = action.payload;
      const obj = draft.objects[objectId];
      if (!obj) return;

      let layer = draft.timeline.layers[objectId];
      if (!layer) {
        layer = {
          objectId,
          clip: { id: objectId, segments: [{ startMs: 0, endMs: draft.timeline.durationMs }] },
          properties: [],
          expanded: true
        };
        draft.timeline.layers[objectId] = layer;
      }

      const existingTrackIndex = layer.properties?.findIndex(p => p.id === propertyId);

      if (existingTrackIndex !== undefined && existingTrackIndex !== -1) {
        // Remove track
        layer.properties!.splice(existingTrackIndex, 1);
        return;
      }

      // Add track
      let initialValue: any = (obj as any)[propertyId];

      // Special handling for Bend It "virtual" properties
      if (propertyId === 'bendAmount') {
        const bend = (obj as any).bend;
        // Default to current value if exists, else 0 (radians) because runtime uses radians for theta
        // But wait, the slider sends DEGREES.
        // Let's check runtime.ts again.
        // runtime.ts: patch.bend = { theta: val }
        // bend-math.ts: theta is radians.
        // BendItControls: displays degrees, converts to/from radians for onChange.
        // So the OBJECT state (obj.bend.theta) is RADIANS.
        // The KEYFRAME should store RADIANS to match the object state.
        // The SLIDER input reads the keyframe value. If the keyframe value is radians, the slider needs to handle it?
        // Let's check SliderInput usage in BendItControls.
        // It does `value={Math.round(bendDeg)}`. params.theta is radians.
        // If animation is active, `getValueAtTime` returns the interpolated value.
        // If that value is plugged into `params`, it flows into `BendItControls`.
        // So keyframes MUST be RADIANS.
        initialValue = bend?.theta ?? 0;
      } else if (propertyId === 'bendStart') {
        const bend = (obj as any).bend;
        initialValue = bend?.start ?? { x: 0, y: 0 };
      } else if (propertyId === 'bendEnd') {
        const bend = (obj as any).bend;
        initialValue = bend?.end ?? { x: 0, y: 0 };

        // Warp "virtual" properties — map from obj.warp
      } else if (propertyId === 'warpBend') {
        initialValue = (obj as any).warp?.bend ?? 0;
      } else if (propertyId === 'warpHDist') {
        initialValue = (obj as any).warp?.hDist ?? 0;
      } else if (propertyId === 'warpVDist') {
        initialValue = (obj as any).warp?.vDist ?? 0;
      } else if (propertyId === 'warpStyle') {
        // Hold interpolation — store string as-is
        initialValue = (obj as any).warp?.style ?? 'arc';
      } else if (propertyId === 'warpAxis') {
        // Hold interpolation — store string as-is
        initialValue = (obj as any).warp?.axis ?? 'horizontal';

      } else if (propertyId === 'position') {
        initialValue = { x: obj.x ?? 0, y: obj.y ?? 0 };
      } else if (propertyId === 'scale') {
        initialValue = { x: obj.scaleX ?? 1, y: obj.scaleY ?? 1 };
      }

      if (initialValue === undefined && propertyId === 'opacity') initialValue = 1;
      if (initialValue === undefined && (propertyId === 'scaleX' || propertyId === 'scaleY')) initialValue = 1;
      if (initialValue === undefined) initialValue = 0;

      const isEnumProp = propertyId === 'warpStyle' || propertyId === 'warpAxis';

      const newTrack: PropertyTrack = {
        id: propertyId,
        keyframes: [
          {
            id: nanoid(),
            timeMs: draft.timeline.playheadMs,
            value: initialValue,
            easing: 'linear',
            // Enum properties must always use Hold — they can't be interpolated numerically
            interpolation: isEnumProp ? 'hold' : undefined,
          }
        ]
      };

      if (!layer.properties) layer.properties = [];
      layer.properties.push(newTrack);
      layer.expanded = true;
      timelineRowsChanged();
      return;
    }
    case 'SET_WORK_AREA': {
      if (action.payload) {
        const { startMs, endMs } = action.payload;
        if (endMs > startMs) {
          draft.timeline.workArea = { startMs, endMs };
        } else {
          draft.timeline.workArea = { startMs: endMs, endMs: startMs };
        }
      } else {
        draft.timeline.workArea = null;
      }
      return;
    }
    case 'SLIDE_LAYER_TRACKS': {
      const { objectIds, dMs } = action.payload;
      for (const objectId of objectIds) {
        const layerTrack = draft.timeline.layers[objectId];
        if (!layerTrack) continue;

        const newStartMs = (layerTrack.startMs || 0) + dMs;

        // This is a simple slide, in a full implementation we'd need to check boundaries
        layerTrack.startMs = newStartMs;
      }
      return;
    }
    case 'RESIZE_CLIP_START': {
      const { clipId, dMs } = action.payload;
      const layerTrack = draft.timeline.layers[clipId];
      if (!layerTrack || !layerTrack.clip) return;
      const firstSeg = layerTrack.clip.segments[0];
      if (!firstSeg) return;

      const newStart = Math.max(0, firstSeg.startMs + dMs);
      if (newStart < firstSeg.endMs - 100) { // minimum clip duration
        const delta = newStart - firstSeg.startMs;
        firstSeg.startMs = newStart;
        // Move keyframes
        layerTrack.properties.forEach(prop => {
          prop.keyframes.forEach(kf => {
            kf.timeMs += delta;
          })
        })
      }
      return;
    }
    case 'RESIZE_CLIP_END': {
      const { clipId, dMs } = action.payload;
      const layerTrack = draft.timeline.layers[clipId];
      if (!layerTrack || !layerTrack.clip) return;
      const lastSeg = layerTrack.clip.segments[layerTrack.clip.segments.length - 1];
      if (!lastSeg) return;

      const newEnd = Math.min(draft.timeline.durationMs, lastSeg.endMs + dMs);
      if (newEnd > lastSeg.startMs + 100) {
        lastSeg.endMs = newEnd;
      }
      return;
    }
    case 'MOVE_CLIP': {
      const { clipId, dMs } = action.payload;
      const layerTrack = draft.timeline.layers[clipId];
      if (!layerTrack || !layerTrack.clip) return;

      // Prevent moving outside timeline boundaries
      let actualDelta = dMs;
      const minStart = Math.min(...layerTrack.clip.segments.map(s => s.startMs));
      const maxEnd = Math.max(...layerTrack.clip.segments.map(s => s.endMs));

      if (minStart + dMs < 0) {
        actualDelta = -minStart;
      }
      if (maxEnd + dMs > draft.timeline.durationMs) {
        actualDelta = draft.timeline.durationMs - maxEnd;
      }

      // Move clip segments
      layerTrack.clip.segments.forEach(seg => {
        seg.startMs += actualDelta;
        seg.endMs += actualDelta;
      });

      // Move keyframes
      layerTrack.properties.forEach(prop => {
        prop.keyframes.forEach(kf => {
          kf.timeMs += actualDelta;
        })
      })
      return;
    }
    case 'MOVE_OBJECTS': {
      const { draggedId, targetId, dropTarget } = action.payload;
      const draggedObject = draft.objects[draggedId];
      const targetObject = draft.objects[targetId];

      if (!draggedObject || !targetObject || !dropTarget) return;

      if (draggedObject.parentId) {
        const oldParent = draft.objects[draggedObject.parentId] as GroupObject;
        if (oldParent?.children) {
          oldParent.children = oldParent.children.filter(id => id !== draggedId);
        }
      }

      const removeFromZ = () => {
        // quitar todas las ocurrencias del id arrastrado
        draft.zStack = draft.zStack.filter(zid => zid !== draggedId);
      };
      const insertInZ = (index: number) => {
        if (index < 0 || index > draft.zStack.length) {
          draft.zStack.push(draggedId);
        } else {
          draft.zStack.splice(index, 0, draggedId);
        }
      };

      if (dropTarget.type === 'group-reparent') {
        reparentPreservingWorld(draggedId, targetId, draft.objects);
        const newParent = draft.objects[targetId] as GroupObject;
        if (newParent) {
          if (!newParent.children) newParent.children = [];
          newParent.children.push(draggedId);
        }

        removeFromZ();
        const groupIndex = draft.zStack.indexOf(targetId);
        insertInZ(groupIndex + 1);

      } else {
        const newParentId = targetObject.parentId ?? null;

        reparentPreservingWorld(draggedId, newParentId, draft.objects);

        removeFromZ();
        const toIndex = draft.zStack.indexOf(targetId);
        const offset = dropTarget.type === 'reorder-after' ? 1 : 0;
        insertInZ(toIndex + offset);
      }
      timelineRowsChanged();
      return;
    }
    case 'SET_DROP_TARGET': {
      draft.ui.dropTarget = action.payload;
      return;
    }
    case 'SET_TIMELINE_PLAYHEAD': {
      let timeMs = action.payload;
      if (draft.timeline.ui.snap) {
        timeMs = quantize(draft, timeMs);
      }
      draft.timeline.playheadMs = Math.max(0, Math.min(timeMs, draft.timeline.durationMs));
      break;
    }
    case 'SET_TIMELINE_PLAYING':
      draft.timeline.playing = action.payload;
      break;
    case 'SET_TIMELINE_PLAYBACK_RATE':
      draft.timeline.playbackRate = action.payload;
      break;
    case 'ADD_KEYFRAME_TO_PROPERTY': {
      const { objectId, propertyId: rawPropId, timeMs: explicitTimeMs, value: explicitValue, startValue, useEvaluated } = action.payload;
      const object = draft.objects[objectId];

      // COHERENCE CHECK: Ensure we don't accidentally animate Position if rawPropId is unrelated
      if (coerceToPosition(rawPropId) === 'position' && rawPropId !== 'position' && rawPropId !== 'x' && rawPropId !== 'y') {
        return;
      }
      if (!object) return;

      const propertyId = coerceToScale(coerceToPosition(rawPropId));
      const layerTrack = draft.timeline.layers[objectId];

      if (!layerTrack?.properties?.some(p => p.id === propertyId)) {
        return;
      }

      const t = draft.timeline.ui?.snap ? quantize(draft, explicitTimeMs ?? draft.timeline.playheadMs) : (explicitTimeMs ?? draft.timeline.playheadMs);
      const t0 = draft.timeline.ui?.snap ? quantize(draft, 0) : 0;

      const upsertAt = (track: PropertyTrack, tm: number, val: any) => {
        const existingIndex = track.keyframes.findIndex(k => eq(draft, k.timeMs, tm));
        if (existingIndex !== -1) {
          track.keyframes[existingIndex].value = val;
        } else {
          track.keyframes.push({ id: nanoid(), timeMs: tm, value: val, easing: 'linear', interpolation: 'linear' });
          track.keyframes.sort((a, b) => a.timeMs - b.timeMs);
        }
      };

      const propTrack = ensureTrack(layerTrack, propertyId);

      let valueToUse = explicitValue;
      if (valueToUse === undefined) {

        // 1) Evaluate the current animation track to preserve the visual state IF REQUESTED
        let evaluatedValue: any = undefined;
        if (useEvaluated && propTrack.keyframes.length > 0) {
          evaluatedValue = getValueAtTime(propTrack.keyframes, t, undefined);
        }

        if (evaluatedValue !== undefined) {
          valueToUse = evaluatedValue;
        } else {
          // 2) Fallback to base object property if no track or undefined
          if (propertyId === 'position') {
            valueToUse = { x: object.x, y: object.y };
          } else if (propertyId === 'scale') {
            valueToUse = { x: object.scaleX ?? 1, y: object.scaleY ?? 1 };
          } else if (propertyId === 'bendAmount') {
            const bend = (object as any).bend;
            valueToUse = bend?.theta ?? 0;
          } else if (propertyId === 'bendStart') {
            const bend = (object as any).bend;
            valueToUse = bend?.start ?? { x: 0, y: 0 };
          } else if (propertyId === 'bendEnd') {
            const bend = (object as any).bend;
            valueToUse = bend?.end ?? { x: 0, y: 0 };
          } else {
            valueToUse = (object as any)[propertyId];
          }
        }
      }

      // --- NaN Trap ---
      if (typeof valueToUse === 'number' && !Number.isFinite(valueToUse)) {
        valueToUse = 0;
      } else if (typeof valueToUse === 'object' && valueToUse !== null) {
        if (typeof valueToUse.x === 'number' && !Number.isFinite(valueToUse.x)) valueToUse.x = 0;
        if (typeof valueToUse.y === 'number' && !Number.isFinite(valueToUse.y)) valueToUse.y = 0;
      }

      if (propTrack.keyframes.length === 0 && startValue !== undefined && !eq(draft, t, t0)) {
        upsertAt(propTrack, t0, startValue);
      }
      upsertAt(propTrack, t, valueToUse);

      return;
    }
    case 'MOVE_TIMELINE_KEYFRAMES': {
      const { moves } = action.payload;
      for (const move of moves) {
        const { objectId, propertyId, keyframeId, timeMs } = move;
        const propTrack = draft.timeline.layers[objectId]?.properties.find(p => p.id === propertyId);
        if (propTrack) {
          const keyframe = propTrack.keyframes.find(k => k.id === keyframeId);
          if (keyframe) {
            keyframe.timeMs = timeMs;
          }
        }
      }
      // Sort all affected tracks after moving
      const affectedTracks = new Set(moves.map(m => `${m.objectId}:${m.propertyId}`));
      for (const trackId of affectedTracks) {
        const [objId, propId] = trackId.split(':');
        const propTrack = draft.timeline.layers[objId]?.properties.find(p => p.id === propId);
        if (propTrack) {
          propTrack.keyframes.sort((a, b) => a.timeMs - b.timeMs);
        }
      }
      return;
    }
    case 'MOVE_TIMELINE_KEYFRAME': {
      const { objectId, propertyId, keyframeId, timeMs } = action.payload;
      const propTrack = draft.timeline.layers[objectId]?.properties.find(p => p.id === propertyId);
      if (propTrack) {
        const keyframe = propTrack.keyframes.find(k => k.id === keyframeId);
        if (keyframe) {
          keyframe.timeMs = timeMs;
          propTrack.keyframes.sort((a, b) => a.timeMs - b.timeMs);
        }
      }
      break;
    }
    case 'DELETE_TIMELINE_KEYFRAME': {
      const { objectId, propertyId, keyframeId } = action.payload;
      const layerTrack = draft.timeline.layers[objectId];
      if (!layerTrack) break;

      const propTrack = layerTrack.properties.find(p => p.id === propertyId);
      if (propTrack) {
        propTrack.keyframes = propTrack.keyframes.filter(k => k.id !== keyframeId);
        if (propTrack.keyframes.length === 0) {
          layerTrack.properties = layerTrack.properties.filter(p => p.id !== propertyId);
        }
      }
      timelineRowsChanged();
      break;
    }


    case 'UPDATE_KEYFRAME_CONTROL_POINTS': {
      const { objectId, propertyId, keyframeId, controlPoints } = action.payload;
      const layer = draft.timeline.layers[objectId];
      if (layer) {
        const track = layer.properties.find(p => p.id === propertyId);
        if (track) {
          // SORT first to ensure index logic works (though find by ID is robust)
          track.keyframes.sort((a, b) => a.timeMs - b.timeMs);
          const kf = track.keyframes.find(k => k.id === keyframeId);

          if (kf) {
            const oldCp = kf.controlPoints || { x1: 0.33, y1: 0, x2: 0.67, y2: 1 };

            // Merge partial updates with existing values
            kf.controlPoints = {
              ...oldCp,
              ...controlPoints
            };


            // Preserve original interpolation type (ease, bezier, etc.)
            // Only update if it was 'linear' or 'hold' (no control points)
            if (kf.interpolation === 'linear' || kf.interpolation === 'hold') {
              kf.interpolation = 'bezier';
            }
          }
        }
      }
      return;
    }
    case 'SELECT_PROPERTY_TRACK': {
      let { objectId, propertyId, additive } = action.payload;

      // Normalize scaleX/scaleY -> scale
      if (propertyId === 'scaleX' || propertyId === 'scaleY') propertyId = 'scale';

      // Ensure properties array exists
      if (!draft.timeline.selection.properties) {
        draft.timeline.selection.properties = [];
      }

      const existingIndex = draft.timeline.selection.properties.findIndex(
        p => p.objectId === objectId && p.propertyId === propertyId
      );

      if (additive) {
        if (existingIndex !== -1) {
          // Toggle OFF
          draft.timeline.selection.properties.splice(existingIndex, 1);
        } else {
          // Toggle ON
          draft.timeline.selection.properties.push({ objectId, propertyId });
        }
      } else {
        // Exclusive Select
        if (existingIndex !== -1 && draft.timeline.selection.properties.length === 1) {
          // Already exclusively selected, do nothing or deselect? Usually do nothing.
        } else {
          // Replace selection
          draft.timeline.selection.properties = [{ objectId, propertyId }];
        }
      }
      return;
    }
    case 'DELETE_KEYFRAME': {
      const { objectId, propertyId, keyframeId } = action.payload;
      const layerTrack = draft.timeline.layers[objectId];
      if (!layerTrack) break;

      const propTrack = layerTrack.properties.find((p: PropertyTrack) => p.id === propertyId);
      if (propTrack) {
        propTrack.keyframes = propTrack.keyframes.filter((k: Keyframe) => k.id !== keyframeId);
        if (propTrack.keyframes.length === 0) {
          layerTrack.properties = layerTrack.properties.filter((p: PropertyTrack) => p.id !== propertyId);
        }
      }
      timelineRowsChanged();
      break;
    }

    case 'SET_KEYFRAME_EASING': {
      const { objectId, propertyId, keyframeId, easing } = action.payload;
      const layerTrack = draft.timeline.layers[objectId];
      if (!layerTrack) break;

      const propTrack = layerTrack.properties.find((p: PropertyTrack) => p.id === propertyId);
      if (!propTrack) break;

      const keyframe = propTrack.keyframes.find((k: Keyframe) => k.id === keyframeId);
      if (keyframe) {
        keyframe.easing = easing;
      }
      break;
    }

    case 'SET_KEYFRAME_INTERPOLATION': {
      const { objectId, propertyId, keyframeId, interpolationType } = action.payload;
      const layerTrack = draft.timeline.layers[objectId];
      if (!layerTrack) break;

      const propTrack = layerTrack.properties.find((p: PropertyTrack) => p.id === propertyId);
      if (!propTrack) break;

      const keyframe = propTrack.keyframes.find((k: Keyframe) => k.id === keyframeId);
      if (keyframe) {
        keyframe.interpolation = interpolationType;

        // Set appropriate controlPoints for each interpolation type
        // so the speed graph and animation engine use correct curves
        switch (interpolationType) {
          case 'ease':
            keyframe.controlPoints = { x1: 0.42, y1: 0, x2: 0.58, y2: 1 }; // Symmetric ease-in-out (bell curve)
            break;
          case 'ease-in':
            keyframe.controlPoints = { x1: 0.42, y1: 0, x2: 1.0, y2: 1.0 };
            break;
          case 'ease-out':
            keyframe.controlPoints = { x1: 0, y1: 0, x2: 0.58, y2: 1.0 };
            break;
          case 'linear':
          case 'hold':
            keyframe.controlPoints = undefined;
            break;
          // 'bezier' keeps existing controlPoints untouched
        }
      }
      break;
    }

    case 'SET_TIMELINE_DURATION':
      draft.timeline.durationMs = action.payload;
      break;
    case 'SET_TIMELINE_FPS':
      draft.timeline.fps = action.payload;
      draft.timeline.ui.snapStepMs = 1000 / action.payload;
      break;
    case 'SET_TIMELINE_ZOOM':
      draft.timeline.ui.zoom = action.payload;
      break;
    case 'TOGGLE_TIMELINE_SNAP':
      draft.timeline.ui.snap = !draft.timeline.ui.snap;
      break;

    case 'IMPORT_OBJECTS': {
      const { objects: newObjects } = action.payload;
      if (newObjects.length === 0) return;

      const tempObjects = { ...draft.objects };
      newObjects.forEach(obj => {
        tempObjects[obj.id] = obj;
      });

      const topLevelImported = newObjects.filter(obj => !obj.parentId);
      const importBBox = getOverallBBox(topLevelImported, tempObjects);

      const canvasCenter = {
        x: draft.canvas.width / 2,
        y: draft.canvas.height / 2,
      };

      const offset = {
        x: importBBox ? canvasCenter.x - importBBox.cx : 0,
        y: importBBox ? canvasCenter.y - importBBox.cy : 0,
      };

      newObjects.forEach(obj => {
        const newObj = { ...obj };
        if (!newObj.parentId) {
          newObj.x += offset.x;
          newObj.y += offset.y;
        }
        draft.objects[newObj.id] = newObj;
        draft.zStack.push(newObj.id);
        if (!draft.timeline.layers[newObj.id]) {
          const lt = draft.timeline.layers[newObj.id] = {
            objectId: newObj.id,
            properties: [],
            clip: { id: newObj.id, segments: [{ startMs: 0, endMs: draft.timeline.durationMs }] },
          };
          migrateXYtoPosition(lt as any, draft.objects, newObj.id);
          if (lt.properties) lt.properties = lt.properties.filter((p: any) => p.id !== 'x' && p.id !== 'y');
        }
      });

      draft.selectedObjectIds = topLevelImported.map(obj => obj.id);
      draft.ui.focus = { type: 'selection', payload: { objectIds: draft.selectedObjectIds } };
      draft.selectedPathNodes = [];
      timelineRowsChanged();
      return;
    }

    case 'CREATE_OBJECT': {
      const newId = nanoid();
      let newObject: SvgObject;

      const commonProps = {
        id: newId, ...action.payload, layerId: ROOT_LAYER_ID, isConstrained: false,
        anchorPosition: 'center' as AnchorPosition, rotation: 0, scaleX: 1, scaleY: 1,
        visible: true, locked: false, parentId: null, fill: '#cccccc', stroke: '#333333', strokeWidth: 1
      };

      switch (action.payload.type) {
        case 'rectangle': newObject = { ...commonProps, type: 'rectangle', width: 100, height: 100, isPillShape: false, corners: { tl: 0, tr: 0, br: 0, bl: 0 }, cornersLinked: true }; break;
        case 'ellipse': newObject = { ...commonProps, type: 'ellipse', rx: 50, ry: 50 }; break;
        case 'star': newObject = { ...commonProps, type: 'star', points: 5, outerRadius: 50, innerRadius: 25 }; break;
        case 'polygon': newObject = { ...commonProps, type: 'polygon', sides: 6, radius: 50 }; break;
        case 'text': newObject = { ...commonProps, type: 'text', text: 'Hello', fontSize: 48, fontWeight: 'normal' }; break;
        case 'line':
          newObject = { ...commonProps, type: 'path', isLine: true, points: [{ x: 0, y: 0, mode: 'corner' }, { x: 50, y: 0, mode: 'corner' }], closed: false, strokeLineCap: 'butt' };
          break;
        default: return;
      }

      draft.objects[newId] = newObject;
      draft.zStack.push(newId);
      draft.selectedObjectIds = [newId];
      draft.currentTool = 'select';

      if (!draft.timeline.layers[newId]) {
        draft.timeline.layers[newId] = {
          objectId: newId,
          properties: [],
          clip: { id: newId, segments: [{ startMs: 0, endMs: draft.timeline.durationMs }] },
          expanded: true,
        };
      }
      draft.ui.focus = { type: 'selection', payload: { objectIds: draft.selectedObjectIds } };
      draft.selectedPathNodes = [];
      timelineRowsChanged();
      return;
    }

    case 'SET_TOOL': {
      const newTool = action.payload;
      const isCreationTool = ['rectangle', 'ellipse', 'star', 'polygon', 'text', 'pen', 'line'].includes(newTool);

      if (draft.drawingPath && draft.currentTool !== newTool) {
        const dp = draft.drawingPath;
        if (dp.points.length >= 2) {
          const normalized = normalizePath(dp);
          draft.objects[normalized.id] = normalized;
          draft.zStack.push(normalized.id);
          draft.selectedObjectIds = [normalized.id];
          draft.ui.focus = { type: 'selection', payload: { objectIds: draft.selectedObjectIds } };
          timelineRowsChanged();
        }
        draft.drawingPath = null;
      }

      const pathTools: Tool[] = ['path-edit', 'add-node', 'remove-node'];
      if (!pathTools.includes(newTool) && draft.selectedPathNodes.length > 0) {
        draft.selectedPathNodes = [];
        draft.ui.focus = { type: 'selection', payload: { objectIds: draft.selectedObjectIds } };
      }

      draft.currentTool = newTool;
      draft.ui.isEditingGradient = false;
      if (isCreationTool) {
        draft.lastCreationTool = newTool;
      }
      return;
    }

    case 'ADD_OBJECT': {
      console.log("---- ADD_OBJECT RECIPE ----");
      const incoming = (action as any).payload;
      const newObjectWithDefaults: SvgObject = {
        ...(incoming as SvgObject),
        layerId: ROOT_LAYER_ID,
        isConstrained: false,
        anchorPosition: 'center',
        scaleX: 1,
        scaleY: 1,
        visible: true,
        locked: false,
        parentId: null,
      };

      draft.objects[newObjectWithDefaults.id] = newObjectWithDefaults;
      draft.zStack.push(newObjectWithDefaults.id);

      if (!draft.timeline.layers[newObjectWithDefaults.id]) {
        draft.timeline.layers[newObjectWithDefaults.id] = {
          objectId: newObjectWithDefaults.id,
          properties: [],
          clip: { id: newObjectWithDefaults.id, segments: [{ startMs: 0, endMs: draft.timeline.durationMs }] },
        };
      }
      timelineRowsChanged();
      return;
    }

    case 'ROTATE_OBJECTS': {
      const { ids, angle, center } = action.payload;
      ids.forEach(id => {
        const obj = draft.objects[id];
        if (!obj || obj.locked) return;
        const a = toNum(angle, 0);
        const pivot = center ?? getWorldAnchor(obj, draft.objects);
        const updates = rotateAroundWorldPivot(obj, a, pivot, draft.objects);
        sanitizeGeom(obj, updates);
        Object.assign(obj, updates);
      });
      return;
    }

    case 'UPDATE_OBJECTS': {
      const { ids, updates } = action.payload;
      const fromAnimation = !!(action.payload as any).fromAnimation;
      const t = draft.timeline.ui?.snap ? quantize(draft, draft.timeline.playheadMs) : draft.timeline.playheadMs;

      const isScalingLike =
        'scale' in updates ||
        'scaleX' in updates || 'scaleY' in updates ||
        'width' in updates || 'height' in updates ||
        'rx' in updates || 'ry' in updates ||
        'radius' in updates || 'outerRadius' in updates || 'innerRadius' in updates;

      ids.forEach(id => {
        const obj = draft.objects[id];
        if (obj && (!obj.locked || fromAnimation)) {

          if (!fromAnimation && !(action as any).transient) {
            const layerTrack = draft.timeline.layers[id];
            if (layerTrack) {

              const upsertAt = (track: PropertyTrack, tm: number, val: any) => {
                const existingIndex = track.keyframes.findIndex(k => eq(draft, k.timeMs, tm));
                if (existingIndex !== -1) {
                  track.keyframes[existingIndex].value = val;
                } else {
                  track.keyframes.push({ id: nanoid(), timeMs: tm, value: val, easing: 'linear', interpolation: 'linear' });
                  track.keyframes.sort((a, b) => a.timeMs - b.timeMs);
                }
              };

              const propsToUpdate = Object.keys(updates) as PropertyId[];
              for (const prop of propsToUpdate) {
                const animProp = coerceToScale(coerceToPosition(prop));

                // Special handling for Bend It properties
                if (animProp === 'bend' as any) {
                  const bendUpdate = (updates as any).bend;
                  if (bendUpdate) {
                    // Check for bendAmount (angle)
                    const amountTrack = layerTrack.properties.find(p => p.id === 'bendAmount');
                    if (amountTrack && bendUpdate.theta !== undefined) {
                      upsertAt(amountTrack, t, bendUpdate.theta);
                    }
                    // Check for bendStart
                    const startTrack = layerTrack.properties.find(p => p.id === 'bendStart');
                    if (startTrack && bendUpdate.start !== undefined) {
                      upsertAt(startTrack, t, bendUpdate.start);
                    }
                    // Check for bendEnd
                    const endTrack = layerTrack.properties.find(p => p.id === 'bendEnd');
                    if (endTrack && bendUpdate.end !== undefined) {
                      upsertAt(endTrack, t, bendUpdate.end);
                    }
                  }
                  continue;
                }

                const track = layerTrack.properties.find(p => p.id === animProp);
                if (!track) continue;

                if (animProp === 'position') {
                  // Defensive check: ensure we are actually updating position-related properties
                  if (prop !== 'x' && prop !== 'y' && prop !== 'position') continue;

                  if (isScalingLike) continue;

                  const newObjState = { ...obj, ...updates };
                  upsertAt(track, t, { x: newObjState.x, y: newObjState.y });
                } else if (animProp === 'scale') {
                  const v = {
                    x: (updates as any).scaleX ?? obj.scaleX ?? 1,
                    y: (updates as any).scaleY ?? obj.scaleY ?? 1
                  };
                  upsertAt(track, t, v);
                } else {
                  upsertAt(track, t, (updates as any)[prop]);
                }
              }
            }
          }

          const safe = { ...updates };
          sanitizeGeom(obj, safe);
          Object.assign(obj, safe);
        }
      });
      return;
    }

    case 'ALIGN_OBJECTS': {
      const { type } = action.payload;
      const selected = draft.selectedObjectIds.map(id => draft.objects[id]).filter(Boolean);
      if (selected.length < 1) return;

      const overallBBox = getOverallBBox(selected, draft.objects);
      if (!overallBBox) return;

      const containerBBox = selected.length > 1 ? overallBBox : { x: 0, y: 0, width: draft.canvas.width, height: draft.canvas.height };

      if (type === 'h-distribute' || type === 'v-distribute') {
        if (selected.length < 3) return;

        const bboxes = selected.map(obj => ({ obj, bbox: getVisualBoundingBox(obj, draft.objects) }));

        if (type === 'h-distribute') {
          bboxes.sort((a, b) => a.bbox.x - b.bbox.x);
          const first = bboxes[0];
          const last = bboxes[bboxes.length - 1];
          const totalWidth = bboxes.reduce((sum, item) => sum + item.bbox.width, 0);
          const totalSpace = (last.bbox.x + last.bbox.width) - first.bbox.x;
          const availableSpace = totalSpace - totalWidth;
          const gap = availableSpace / (selected.length - 1);

          let currentX = first.bbox.x + first.bbox.width;
          for (let i = 1; i < bboxes.length - 1; i++) {
            const item = bboxes[i];
            const targetX = currentX + gap;
            item.obj.x += targetX - item.bbox.x;
            currentX = targetX + item.bbox.width;
          }
        } else { // v-distribute
          bboxes.sort((a, b) => a.bbox.y - b.bbox.y);
          const first = bboxes[0];
          const last = bboxes[bboxes.length - 1];
          const totalHeight = bboxes.reduce((sum, item) => sum + item.bbox.height, 0);
          const totalSpace = (last.bbox.y + last.bbox.height) - first.bbox.y;
          const availableSpace = totalSpace - totalHeight;
          const gap = availableSpace / (selected.length - 1);

          let currentY = first.bbox.y + first.bbox.height;
          for (let i = 1; i < bboxes.length - 1; i++) {
            const item = bboxes[i];
            const targetY = currentY + gap;
            item.obj.y += targetY - item.bbox.y;
            currentY = targetY + item.bbox.height;
          }
        }
      } else {
        selected.forEach(obj => {
          const objBBox = getVisualBoundingBox(obj, draft.objects);
          let dx = 0;
          let dy = 0;

          switch (type) {
            case 'left':
              dx = containerBBox.x - objBBox.x;
              break;
            case 'right':
              dx = (containerBBox.x + containerBBox.width) - (objBBox.x + objBBox.width);
              break;
            case 'h-center':
              dx = (containerBBox.x + containerBBox.width / 2) - (objBBox.x + objBBox.width / 2);
              break;
            case 'top':
              dy = containerBBox.y - objBBox.y;
              break;
            case 'bottom':
              dy = (containerBBox.y + containerBBox.height) - (objBBox.y + objBBox.height);
              break;
            case 'v-center':
              dy = (containerBBox.y + containerBBox.height / 2) - (objBBox.y + objBBox.height / 2);
              break;
          }

          if (dx !== 0) obj.x += dx;
          if (dy !== 0) obj.y += dy;
        });
      }
      return;
    }

    case 'UPDATE_CANVAS':
      draft.canvas = { ...draft.canvas, ...action.payload };
      return;

    case 'TOGGLE_CONSTRAINED': {
      const { ids } = action.payload;

      if (ids.length > 0) {
        const firstObject = draft.objects[ids[0]];
        if (!firstObject || firstObject.locked) return;
        const newConstrainedState = !firstObject.isConstrained;
        ids.forEach(id => {
          const obj = draft.objects[id];
          if (obj && !obj.locked) {
            obj.isConstrained = newConstrainedState;
          }
        });
      }
      return;
    }

    case 'TOGGLE_CANVAS_CONSTRAINED': {
      draft.canvas.isConstrained = !draft.canvas.isConstrained;
      return;
    }

    case 'TOGGLE_CONSTRAIN_TRANSFORM': {
      draft.constrainTransform = action.payload ?? !draft.constrainTransform;
      return;
    }

    case 'SELECT_OBJECT': {
      const { id, shiftKey } = action.payload;
      const { selectedObjectIds } = draft;
      let newSelectedIds: string[];

      if (draft.objects[id]?.locked) return;

      if (shiftKey) {
        if (selectedObjectIds.includes(id)) {
          newSelectedIds = selectedObjectIds.filter(selectedId => selectedId !== id);
        } else {
          newSelectedIds = [...selectedObjectIds, id];
        }
      } else {
        newSelectedIds = selectedObjectIds.includes(id) ? selectedObjectIds : [id];
      }
      draft.selectedObjectIds = newSelectedIds;
      draft.selectedLayerIds = [];
      draft.ui.isEditingGradient = false;
      draft.ui.focus = { type: 'selection', payload: { objectIds: newSelectedIds } };
      draft.selectedPathNodes = [];
      if (!shiftKey) {
        if (draft.timeline.selection) draft.timeline.selection.properties = [];
      }
      return;
    }

    case 'SELECT_MULTIPLE_OBJECTS': {
      const { ids, shiftKey } = action.payload;
      const selectableIds = ids.filter(id => !draft.objects[id]?.locked);

      if (shiftKey) {
        const currentSelection = new Set(draft.selectedObjectIds);
        selectableIds.forEach(id => {
          if (currentSelection.has(id)) {
            currentSelection.delete(id);
          } else {
            currentSelection.add(id);
          }
        });
        draft.selectedObjectIds = Array.from(currentSelection);
      } else {
        draft.selectedObjectIds = selectableIds;
      }
      draft.ui.isEditingGradient = false;
      draft.ui.focus = { type: 'selection', payload: { objectIds: draft.selectedObjectIds } };
      draft.selectedPathNodes = [];
      if (!shiftKey) {
        if (draft.timeline.selection) draft.timeline.selection.properties = [];
      }
      return;
    }

    case 'CLEAR_SELECTION':
      draft.selectedObjectIds = [];
      draft.selectedLayerIds = [];
      draft.selectedPathNodes = [];
      draft.ui.isEditingGradient = false;
      draft.ui.focus = { type: 'selection', payload: { objectIds: [] } };
      if (draft.timeline.selection) draft.timeline.selection.properties = [];
      return;

    case 'DELETE_SELECTED': {
      if (draft.selectedPathNodes && draft.selectedPathNodes.length > 0) {
        // Group nodes by path
        const nodesByPath = draft.selectedPathNodes.reduce((acc, node) => {
          if (!acc[node.pathId]) acc[node.pathId] = [];
          acc[node.pathId].push(node.pointIndex);
          return acc;
        }, {} as Record<string, number[]>);

        let deletingWholeObjects: string[] = [];

        Object.keys(nodesByPath).forEach(pathId => {
          const path = draft.objects[pathId] as PathObject;
          if (path && path.type === 'path') {
            const indicesToRemove = new Set(nodesByPath[pathId]);
            const newPoints = path.points.filter((_, i) => !indicesToRemove.has(i));

            if (newPoints.length < 2) {
              deletingWholeObjects.push(pathId);
            } else {
              path.points = newPoints;
            }
          }
        });

        draft.selectedPathNodes = [];

        // If we are left with paths that have < 2 points, they are degenerate, delete the whole object.
        if (deletingWholeObjects.length === 0) {
          return;
        } else {
          draft.selectedObjectIds = deletingWholeObjects;
        }
      }

      const toDelete = new Set(draft.selectedObjectIds);
      draft.selectedObjectIds.forEach(id => {
        const obj = draft.objects[id];
        if (obj?.type === 'group') {
          (obj as GroupObject).children.forEach(childId => toDelete.add(childId));
        }
      });

      toDelete.forEach(id => {
        delete draft.objects[id];
        delete draft.timeline.layers[id];
        draft.zStack = draft.zStack.filter(zid => zid !== id);
      });
      for (const objId in draft.objects) {
        const obj = draft.objects[objId];
        if (obj.type === 'group') {
          (obj as GroupObject).children = (obj as GroupObject).children.filter(childId => !toDelete.has(childId));
        }
      }

      draft.selectedObjectIds = [];
      draft.ui.focus = { type: 'selection', payload: { objectIds: [] } };
      draft.selectedPathNodes = [];
      timelineRowsChanged();
      return;
    }


    case 'NORMALIZE_OBJECTS': {
      const { ids } = action.payload;
      ids.forEach(id => {
        const obj = draft.objects[id];
        if (obj && !obj.locked) {
          if (obj.type === 'rectangle' && obj.width < 0) {
            obj.scaleX = (obj.scaleX ?? 1) * -1;
            obj.width = Math.abs(obj.width);
          }
          if (obj.type === 'rectangle' && obj.height < 0) {
            obj.scaleY = (obj.scaleY ?? 1) * -1;
            obj.height = Math.abs(obj.height);
          }
          if (obj.type === 'ellipse' && obj.rx < 0) {
            obj.scaleX = (obj.scaleX ?? 1) * -1;
            obj.rx = Math.abs(obj.rx);
          }
          if (obj.type === 'ellipse' && obj.ry < 0) {
            obj.scaleY = (obj.scaleY ?? 1) * -1;
            obj.ry = Math.abs(obj.ry);
          }
        }
      });
      return;
    }

    case 'SET_ANCHOR_POSITION': {
      draft.selectedObjectIds.forEach(id => {
        const obj = draft.objects[id];
        if (obj && !obj.locked) {
          obj.anchorPosition = action.payload;
        }
      });
      return;
    }

    case 'TOGGLE_FLIP': {
      const { ids, axis } = action.payload;
      ids.forEach(id => {
        const obj = draft.objects[id];
        if (!obj || obj.locked) return;

        const updates = flipObjectAroundAnchor(obj, axis, draft.objects);
        Object.assign(obj, updates);
      });
      return;
    }

    case 'SET_ZOOM':
      draft.canvas.zoom = action.payload.zoom;
      return;

    case 'COMMIT_DRAG': {
      // No-op for state change, just commits transient state.
      return;
    }


    case 'ADD_LAYER': {
      const { name, parentId } = action.payload;
      const newId = nanoid();
      draft.layers[newId] = {
        id: newId,
        name,
        parentId: parentId ?? ROOT_LAYER_ID,
        children: [],
        objectIds: [],
        visible: true,
        locked: false,
        collapsed: false,
      };
      draft.layers[parentId ?? ROOT_LAYER_ID].children.unshift(newId);
      draft.selectedLayerIds = [newId];
      return;
    }

    case 'DELETE_LAYER': {
      const layerId = action.payload;
      if (layerId === ROOT_LAYER_ID) return;
      const layer = draft.layers[layerId];
      if (!layer) return;
      layer.objectIds.forEach(objId => {
        delete draft.objects[objId];
        delete draft.timeline.layers[objId];
        draft.zStack = draft.zStack.filter(zid => zid !== objId);
      });
      const parent = draft.layers[layer.parentId!];
      if (parent) parent.children = parent.children.filter(id => id !== layerId);
      delete draft.layers[layerId];
      if (draft.selectedLayerIds.includes(layerId)) draft.selectedLayerIds = draft.selectedLayerIds.filter(id => id !== layerId);
      return;
    }

    case 'UPDATE_LAYER': {
      const { id, updates } = action.payload;
      if (draft.layers[id]) Object.assign(draft.layers[id], updates);
      return;
    }

    case 'START_RENAME_LAYER': {
      draft.editingLayerId = action.payload.id;
      return;
    }
    case 'FINISH_RENAME_LAYER': {
      draft.editingLayerId = null;
      return;
    }

    case 'BRING_FORWARD': {
      const group = [...action.payload.ids].sort((a, b) => draft.zStack.indexOf(a) - draft.zStack.indexOf(b));
      if (group.length === 0) return;
      const highestIndex = draft.zStack.indexOf(group[group.length - 1]);
      if (highestIndex >= draft.zStack.length - 1) return;

      const nextElement = draft.zStack[highestIndex + 1];
      const otherElements = draft.zStack.filter(id => !group.includes(id));
      const insertIndex = otherElements.indexOf(nextElement) + 1;

      otherElements.splice(insertIndex, 0, ...group);
      draft.zStack = otherElements;
      timelineRowsChanged();
      return;
    }
    case 'SEND_BACKWARDS': {
      const group = [...action.payload.ids].sort((a, b) => draft.zStack.indexOf(a) - draft.zStack.indexOf(b));
      if (group.length === 0) return;
      const lowestIndex = draft.zStack.indexOf(group[0]);
      if (lowestIndex <= 0) return;

      const prevElement = draft.zStack[lowestIndex - 1];
      const otherElements = draft.zStack.filter(id => !group.includes(id));
      const insertIndex = otherElements.indexOf(prevElement);

      otherElements.splice(insertIndex, 0, ...group);
      draft.zStack = otherElements;
      timelineRowsChanged();
      return;
    }
    case 'BRING_TO_FRONT': {
      const { ids } = action.payload;
      if (ids.length === 0) return;
      const group = [...ids].sort((a, b) => draft.zStack.indexOf(a) - draft.zStack.indexOf(b));
      const otherElements = draft.zStack.filter(id => !group.includes(id));
      draft.zStack = [...otherElements, ...group];
      timelineRowsChanged();
      return;
    }
    case 'SEND_TO_BACK': {
      const { ids } = action.payload;
      if (ids.length === 0) return;
      const group = [...ids].sort((a, b) => draft.zStack.indexOf(a) - draft.zStack.indexOf(b));
      const otherElements = draft.zStack.filter(id => !group.includes(id));
      draft.zStack = [...group, ...otherElements];
      timelineRowsChanged();
      return;
    }

    case 'START_DRAWING_PATH': {
      draft.selectedObjectIds = [];
      draft.selectedLayerIds = [];
      const { point, isLine } = action.payload;
      const rel0 = { x: 0, y: 0, mode: 'corner' as const };
      // For lines: [start, end]. For paths: [committed_anchor, preview_cursor].
      // The preview cursor is the second point - it will be overwritten by UPDATE_DRAWING_PATH
      // on every mouse move, while the first anchor stays fixed.
      const points = isLine ? [rel0, { x: 0, y: 0, mode: 'corner' as const }] : [rel0, { x: 0, y: 0, mode: 'corner' as const }];
      draft.drawingPath = {
        id: nanoid(), type: 'path',
        isLine,
        points,
        x: point.x, y: point.y, closed: false, stroke: '#000000',
        strokeWidth: 2, fill: 'transparent', layerId: draft.selectedLayerIds[0] || ROOT_LAYER_ID, rotation: 0, scaleX: 1, scaleY: 1, anchorPosition: 'center',
        visible: true, locked: false, parentId: null
      };
      draft.ui.focus = { type: 'selection', payload: { objectIds: [] } };
      draft.selectedPathNodes = [];
      return;
    }

    case 'UPDATE_DRAWING_PATH': {
      const dp = draft.drawingPath;
      if (!dp) return;
      const { point: p, isDrag } = action.payload;
      const rel = { x: p.x - dp.x, y: p.y - dp.y, mode: 'corner' as const as 'corner' | 'free' | 'aligned' | 'mirror' };
      if (dp.isLine) {
        dp.points[1] = rel;
      } else {
        // En lugar de solo agregar el punto final (que es para previsualizar el siguiente segmento),
        // Si hay drag desde el ancla, debemos modificar handleOut del punto anterior y handleIn del "cursor".
        // Para simplificar, la pluma clásica funciona así: click=anchor, drag=bezier para el ancla recién puesta.

        // El último elemento es el cursor que persigue el mouse
        // El penúltimo es el ancla real que pusimos antes.
        if (dp.points.length >= 2 && isDrag) {
          const anchorIdx = dp.points.length - 2;
          const anchor = dp.points[anchorIdx];
          const dist = Math.hypot(rel.x - anchor.x, rel.y - anchor.y);

          if (dist > 2) {
            // Estamos arrastrando desde el último ancla puesta
            anchor.mode = 'mirror';
            anchor.handleOut = { x: rel.x, y: rel.y };
            // simétrico
            anchor.handleIn = { x: anchor.x - (rel.x - anchor.x), y: anchor.y - (rel.y - anchor.y) };
          }
        }

        // Reemplazar la previsualización final
        dp.points[dp.points.length - 1] = rel;
      }
      return;
    }

    case 'DRAW_PATH_ADD_POINT': {
      const dp = draft.drawingPath;
      if (!dp) return;
      const p = action.payload.point;
      const rel = { x: p.x - dp.x, y: p.y - dp.y, mode: 'corner' as const };

      // La previsualización actual se convierte en el ancla definitiva
      dp.points[dp.points.length - 1] = rel;

      // Y pusheamos un nuevo punto de previsualización que perseguirá al cursor
      dp.points.push({ ...rel });
      return;
    }

    case 'FINISH_DRAWING_PATH': {
      const dp = draft.drawingPath;
      if (!dp) break;

      dp.closed = action.payload.closed;

      if (!dp.isLine && dp.points.length >= 2) {
        dp.points.pop(); // Remove the trailing preview cursor node
      }

      if (dp.points.length >= 2) {
        const normalized = normalizePath(dp);
        if (dp.isLine) {
          const len = Math.hypot(dp.points[1].x, dp.points[1].y);
          if (len < 5) {
            delete draft.objects[dp.id];
          } else {
            draft.objects[normalized.id] = normalized;
            draft.zStack.push(normalized.id);
            if (!draft.timeline.layers[normalized.id]) {
              draft.timeline.layers[normalized.id] = {
                objectId: normalized.id,
                properties: [],
                clip: { id: normalized.id, segments: [{ startMs: 0, endMs: draft.timeline.durationMs }] },
              };
            }
            draft.selectedObjectIds = [normalized.id];
            draft.ui.focus = { type: 'selection', payload: { objectIds: draft.selectedObjectIds } };
            draft.selectedPathNodes = [];
          }
        } else {
          draft.objects[normalized.id] = normalized;
          draft.zStack.push(normalized.id);
          if (!draft.timeline.layers[normalized.id]) {
            draft.timeline.layers[normalized.id] = {
              objectId: normalized.id,
              properties: [],
              clip: { id: normalized.id, segments: [{ startMs: 0, endMs: draft.timeline.durationMs }] },
            };
          }
          draft.selectedObjectIds = [normalized.id];
          draft.ui.focus = { type: 'selection', payload: { objectIds: draft.selectedObjectIds } };

          // Select all nodes so we can see the handles immediately
          draft.selectedPathNodes = normalized.points.map((_, i) => ({ pathId: normalized.id, pointIndex: i }));
        }
      }
      draft.drawingPath = null;
      draft.currentTool = 'path-edit';
      timelineRowsChanged();
      return;
    }

    case 'UPDATE_PATH_POINT': {
      const { pathId, pointIndex, newPoint } = action.payload;
      const path = draft.objects[pathId] as PathObject;
      if (path && path.points[pointIndex] && !path.locked) {
        Object.assign(path.points[pointIndex], newPoint);
      }
      return;
    }

    case 'ADD_PATH_NODE': {
      const { pathId, segmentIndex, point } = action.payload;
      const path = draft.objects[pathId] as PathObject;
      if (path && !path.locked) {
        path.points.splice(segmentIndex + 1, 0, { ...point, mode: 'corner' });
      }
      return;
    }

    case 'REMOVE_PATH_NODE': {
      const { pathId, pointIndex } = action.payload;
      const path = draft.objects[pathId] as PathObject;
      if (path && !path.locked) {
        if (path.points.length > 0) {
          path.points.splice(pointIndex, 1);
        }

        draft.selectedPathNodes = draft.selectedPathNodes.filter(n => !(n.pathId === pathId && n.pointIndex === pointIndex));

        if (path.points.length < 2) {
          delete draft.objects[pathId];
          draft.zStack = draft.zStack.filter(id => id !== pathId);
          draft.selectedObjectIds = draft.selectedObjectIds.filter(id => id !== pathId);
          draft.selectedPathNodes = [];
          draft.currentTool = 'select';
          timelineRowsChanged();
        }
      }
      return;
    }

    case 'SELECT_PATH_NODE': {
      const node = action.payload;
      if (action.additive) {
        draft.selectedPathNodes = dedupNodes([...(draft.selectedPathNodes || []), node]);
      } else {
        draft.selectedPathNodes = [node];
      }
      const objectIdsToSelect = new Set(draft.selectedPathNodes.map(n => n.pathId));
      if (action.additive) {
        draft.selectedObjectIds.forEach(id => objectIdsToSelect.add(id));
      }
      draft.selectedObjectIds = Array.from(objectIdsToSelect);
      draft.ui.focus = { type: 'path-edit', payload: { nodes: draft.selectedPathNodes } };
      return;
    }

    case 'SET_SELECTED_PATH_NODES': {
      const newNodes = dedupNodes(action.payload.nodes);
      draft.selectedPathNodes = newNodes;
      const objectIdsToSelect = new Set(newNodes.map(n => n.pathId));
      draft.selectedObjectIds = Array.from(objectIdsToSelect);
      draft.ui.focus = { type: 'path-edit', payload: { nodes: newNodes } };
      return;
    }

    case 'CLEAR_SELECTED_PATH_NODES': {
      draft.selectedPathNodes = [];
      draft.ui.focus = { type: 'selection', payload: { objectIds: draft.selectedObjectIds } };
      return;
    }

    case 'SET_ZSTACK_FROM_VIEW': {
      draft.zStack = [...action.payload].reverse();
      return;
    }

    case 'SET_IS_DRAGGING_LAYER': {
      draft.ui.isDraggingLayer = action.payload;
      return;
    }

    case 'SET_EDITING_GRADIENT': {
      draft.ui.isEditingGradient = action.payload;
      if (action.payload) {
        if (draft.selectedObjectIds.length === 1) {
          draft.ui.focus = { type: 'gradient-edit', payload: { objectId: draft.selectedObjectIds[0] } };
        }
      } else {
        draft.ui.focus = { type: 'selection', payload: { objectIds: draft.selectedObjectIds } };
      }
      return;
    }

    case 'SET_SNAP_LINES': {
      draft.ui.snapLines = action.payload;
      return;
    }

    case 'GROUP_OBJECTS': {
      const selected = draft.selectedObjectIds
        .map(id => draft.objects[id])
        .filter(obj => obj && !obj.locked && !obj.parentId);

      if (selected.length < 2) return;

      const bbox = getOverallBBox(selected, draft.objects);
      if (!bbox) return;

      const groupId = nanoid();
      const group: GroupObject = {
        id: groupId,
        type: 'group',
        name: `Group ${groupId.substring(0, 4)}`,
        x: bbox.cx,
        y: bbox.cy,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        children: selected.sort((a, b) => {
          const zA = draft.zStack.indexOf(a.id);
          const zB = draft.zStack.indexOf(b.id);
          return zA - zB; // Sort Bottom-to-Top (Z-Order)
        }).map(o => o.id),
        fill: '', stroke: '', strokeWidth: 0, layerId: ROOT_LAYER_ID, anchorPosition: 'center',
        visible: true, locked: false,
        collapsed: false,
        parentId: undefined,
      };

      selected.forEach(obj => {
        const oldParent = obj.parentId ? draft.objects[obj.parentId] as GroupObject : null;
        if (oldParent) {
          oldParent.children = oldParent.children.filter(id => id !== obj.id);
        }

        const newCoords = worldToLocal(group, obj, draft.objects);
        obj.x = newCoords.x;
        obj.y = newCoords.y;
        obj.parentId = groupId;
      });

      draft.objects[groupId] = group;

      const oldZStack = draft.zStack;
      const selectedIdsSet = new Set(draft.selectedObjectIds);
      const filteredZStack = oldZStack.filter(id => !selectedIdsSet.has(id));
      const highestIndex = Math.max(...draft.selectedObjectIds.map(id => oldZStack.indexOf(id)));

      let insertIndex = filteredZStack.length;
      for (let i = 0; i < filteredZStack.length; i++) {
        if (oldZStack.indexOf(filteredZStack[i]) > highestIndex) {
          insertIndex = i;
          break;
        }
      }
      filteredZStack.splice(insertIndex, 0, groupId);

      draft.zStack = filteredZStack;
      draft.selectedObjectIds = [groupId];

      if (!draft.timeline.layers[groupId]) {
        draft.timeline.layers[groupId] = {
          objectId: groupId,
          properties: [],
          clip: {
            id: groupId,
            segments: [{ startMs: 0, endMs: draft.timeline.durationMs }],
          }
        };
      }
      draft.ui.focus = { type: 'selection', payload: { objectIds: [groupId] } };
      draft.selectedPathNodes = [];
      timelineRowsChanged();
      return;
    }

    case 'UNGROUP_OBJECTS': {
      const newSelection: string[] = [];
      draft.selectedObjectIds.forEach(id => {
        const group = draft.objects[id];
        if (!group || group.type !== 'group') {
          newSelection.push(id);
          return;
        }

        const { removedGroup, movedChildren } = ungroup(id, draft.objects, draft);
        if (removedGroup) {
          // Limpiar timeline del grupo eliminado
          delete draft.timeline.layers[id];

          // Limpiar referencias de capas
          for (const L of Object.values(draft.layers)) {
            L.objectIds = L.objectIds.filter(oid => oid !== id);
          }

          // CRÍTICO: Asegurar que cada hijo tiene su propia capa de timeline
          // pero sin duplicar las existentes
          movedChildren.forEach(childId => {
            if (!draft.timeline.layers[childId]) {
              draft.timeline.layers[childId] = {
                objectId: childId,
                properties: [],
                clip: {
                  id: childId,
                  segments: [{ startMs: 0, endMs: draft.timeline.durationMs }]
                },
                expanded: false,
              };
            }
          });

          newSelection.push(...movedChildren);
        } else {
          newSelection.push(id);
        }
      });

      // Validar integridad del timeline después del desagrupado
      // Eliminar capas huérfanas (objetos que ya no existen)
      Object.keys(draft.timeline.layers).forEach(layerId => {
        if (!draft.objects[layerId]) {
          delete draft.timeline.layers[layerId];
        }
      });

      draft.selectedObjectIds = newSelection;
      draft.ui.focus = { type: 'selection', payload: { objectIds: newSelection } };
      draft.selectedPathNodes = [];
      timelineRowsChanged();
      return;
    }

    case 'TOGGLE_VISIBILITY': {
      const { ids } = action.payload;
      if (ids.length === 0) return;
      const firstObject = draft.objects[ids[0]];
      const newVisibility = !(firstObject.visible ?? true);
      ids.forEach(id => {
        if (draft.objects[id]) draft.objects[id].visible = newVisibility;
      });
      return;
    }
    case 'TOGGLE_LOCK': {
      const { ids } = action.payload;
      if (ids.length === 0) return;
      const firstObject = draft.objects[ids[0]];
      const newLockState = !firstObject.locked;
      ids.forEach(id => {
        if (draft.objects[id]) draft.objects[id].locked = newLockState;
      });
      return;
    }

    case 'TOGGLE_LAYER_COLLAPSE': {
      const { id } = action.payload;
      const obj = draft.objects[id];
      if (obj && obj.type === 'group') {
        (obj as GroupObject).collapsed = !(obj as GroupObject).collapsed;
      }
      timelineRowsChanged();
      return;
    }

    case 'REPARENT_OBJECTS': {
      const { objectIds, newParentId } = action.payload;
      objectIds.forEach(id => {
        reparentPreservingWorld(id, newParentId, draft.objects);
      });
      return;
    }

    case 'POSITION_SELECT_KEYFRAME': {
      const { objectId, timeMs, additive } = action.payload;
      const layer = draft.timeline.layers[objectId];
      if (!layer) return;
      migrateXYtoPosition(layer, draft.objects, objectId);
      const posTr = layer.properties.find(p => p.id === 'position');
      const k = findPosKeyAtTime(posTr, draft, timeMs);
      const id = k?.id;
      const prev = draft.timeline.selection.keyIds ?? [];
      let keyIds = id ? [id] : [];
      if (additive && id) {
        const set = new Set(prev);
        set.has(id) ? set.delete(id) : set.add(id);
        keyIds = Array.from(set);
      }
      draft.timeline.selection = { objectId, propertyId: 'position' as PropertyId, keyIds };
      draft.selectedObjectIds = keyIds.length ? [objectId] : [];
      return;
    }

    case 'POSITION_MOVE_KEYFRAME': {
      const { objectId, fromTimeMs, toTimeMs } = action.payload;
      const layer = draft.timeline.layers[objectId];
      if (!layer) return;
      migrateXYtoPosition(layer, draft.objects, objectId);
      const posTr = layer.properties.find(p => p.id === 'position');
      if (!posTr) return;
      const k = findPosKeyAtTime(posTr, draft, fromTimeMs);
      if (!k) return;
      k.timeMs = draft.timeline.ui?.snap ? quantize(draft, Math.max(0, toTimeMs)) : Math.max(0, toTimeMs);
      posTr.keyframes.sort((a, b) => a.timeMs - b.timeMs);
      // de-dup por tolerancia
      const cleaned: Keyframe[] = [];
      for (const kk of posTr.keyframes) {
        if (!cleaned.length || !eq(draft, cleaned[cleaned.length - 1].timeMs, kk.timeMs)) cleaned.push(kk);
        else cleaned[cleaned.length - 1].value = kk.value;
      }
      posTr.keyframes = cleaned;
      return;
    }

    case 'POSITION_DELETE_KEYFRAME': {
      const { objectId, timeMs } = action.payload;
      const layer = draft.timeline.layers[objectId];
      if (!layer) return;
      migrateXYtoPosition(layer, draft.objects, objectId);
      const posTr = layer.properties.find(p => p.id === 'position');
      if (!posTr) return;
      posTr.keyframes = posTr.keyframes.filter(k => !eq(draft, k.timeMs, timeMs));
      if (posTr.keyframes.length === 0) {
        layer.properties = layer.properties.filter(p => p.id !== 'position');
      }
      return;
    }

      return;
  }
};

const MAX_HISTORY = 200;

export const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
  return produce(state, draft => editorRecipe(draft, action));
}

const historyReducer = produce((state: History<EditorState>, action: EditorAction) => {
  const currentState = state.transientPresent ?? state.present;
  const { past, present, future } = state;

  console.log("---- HISTORY REDUCER START ----", action.type);

  const commitBatch = (groupId: string) => {
    const batchEntry = state.pendingBatches[groupId];
    if (batchEntry && (batchEntry.patches.length > 0 || batchEntry.inversePatches.length > 0)) {
      state.past.push(batchEntry);
      if (state.past.length > MAX_HISTORY) {
        state.past.splice(0, state.past.length - MAX_HISTORY);
      }
      state.future = [];
    }
    delete state.pendingBatches[groupId];
    if (state.latestGroupId === groupId) {
      state.latestGroupId = undefined;
    }
  };

  if (action.type === 'SET_TIMELINE_PLAYING') {
    const wasPlaying = currentState.timeline.playing;
    const willBePlaying = action.payload;

    if (!wasPlaying && willBePlaying) { // PLAY
      if (state.transientPresent && state.transientEntry) {
        state.past.push(state.transientEntry);
        if (state.past.length > MAX_HISTORY) state.past.shift();
        state.future = [];
        state.present = state.transientPresent;
      }
      state.present.timeline.playing = true;
      state.transientPresent = undefined;
      state.transientEntry = undefined;
    } else if (wasPlaying && !willBePlaying) { // PAUSE
      const pausedAtMs = state.transientPresent?.timeline.playheadMs ?? currentState.timeline.playheadMs;

      state.transientPresent = undefined;
      state.transientEntry = undefined;
      state.present.timeline.playing = false;
      state.present.timeline.playheadMs = pausedAtMs;
    }
    return;
  }

  switch (action.type) {
    case 'LOAD_STATE': {
      const stateToLoad = produce(action.payload, draft => {
        // --- 🚨 NAN CORRUPTION SANITIZER 🚨 ---
        // If the user's project was saved with NaN values due to the internal Spring bug
        // we must scrub them so the Canvas doesn't crash on load.
        for (const objectId in draft.objects) {
          const obj = draft.objects[objectId] as any;
          if (!obj) continue;
          if (typeof obj.x === 'number' && !Number.isFinite(obj.x)) obj.x = 0;
          if (typeof obj.y === 'number' && !Number.isFinite(obj.y)) obj.y = 0;
          if (typeof obj.width === 'number' && !Number.isFinite(obj.width)) obj.width = 100;
          if (typeof obj.height === 'number' && !Number.isFinite(obj.height)) obj.height = 100;
          if (typeof obj.rotation === 'number' && !Number.isFinite(obj.rotation)) obj.rotation = 0;
          if (typeof obj.scaleX === 'number' && !Number.isFinite(obj.scaleX)) obj.scaleX = 1;
          if (typeof obj.scaleY === 'number' && !Number.isFinite(obj.scaleY)) obj.scaleY = 1;
        }

        for (const objectId in draft.timeline.layers) {
          const layer = draft.timeline.layers[objectId];
          if (!layer) continue;

          // Sanitize NaN from poisoned keyframes
          if (layer.properties) {
            for (const track of layer.properties) {
              for (const kf of track.keyframes) {
                if (typeof kf.value === 'number' && !Number.isFinite(kf.value)) kf.value = 0;
                if (typeof kf.value === 'object' && kf.value !== null) {
                  if (typeof kf.value.x === 'number' && !Number.isFinite(kf.value.x)) kf.value.x = 0;
                  if (typeof kf.value.y === 'number' && !Number.isFinite(kf.value.y)) kf.value.y = 0;
                }
              }
            }
          }

          migrateXYtoPosition(layer as any, draft.objects, objectId);
          migrateScaleXScaleYToScale(layer as any);
          if (layer.properties) {
            layer.properties = layer.properties.filter((p: any) => p.id !== 'x' && p.id !== 'y' && p.id !== 'scaleX' && p.id !== 'scaleY');
          }
        }
        draft.timelineRows = buildTimelineRows(draft);
      });

      state.past = [];
      state.future = [];
      state.present = stateToLoad;
      state.transientPresent = undefined;
      state.transientEntry = undefined;
      state.pendingBatches = {};
      state.latestGroupId = undefined;
      return;
    }
    case 'HISTORY_COMMIT_BATCH': {
      commitBatch(action.payload.groupId);
      return;
    }

    case "COMMIT_DRAG": {
      // If no transient state, nothing to commit
      if (!state.transientPresent) return;

      // If we have a history entry (patches), record it
      if (state.transientEntry) {
        const groupId = (action.meta?.history as any)?.groupId;

        if (groupId) {
          if (!state.pendingBatches[groupId]) {
            state.pendingBatches[groupId] = { patches: [], inversePatches: [], label: `Batch: ${groupId}` };
          }
          state.pendingBatches[groupId].patches.push(...state.transientEntry.patches);
          state.pendingBatches[groupId].inversePatches.unshift(...state.transientEntry.inversePatches);
          state.latestGroupId = groupId;
        } else {
          state.past.push(state.transientEntry);
          if (state.past.length > MAX_HISTORY) {
            state.past.splice(0, state.past.length - MAX_HISTORY);
          }
        }
      }

      // Always promote the transient state to present
      state.present = state.transientPresent;
      state.future = [];

      state.transientPresent = undefined;
      state.transientEntry = undefined;
      return;
    }

    default: {
      const baseState = state.transientPresent ?? currentState;
      const [nextPresent, patches, inversePatches] = produceWithPatches(baseState, (draft) => {
        editorRecipe(draft, action);
      });

      const historyMeta = action.meta?.history;
      const isIgnored = historyMeta === "ignore" || (action as any).transient === true;
      const newGroupId = typeof historyMeta === 'object' ? historyMeta.groupId : undefined;

      if (isIgnored) {
        state.transientPresent = nextPresent;
        if ((patches?.length ?? 0) > 0 || (inversePatches?.length ?? 0) > 0) {
          if (!state.transientEntry) {
            state.transientEntry = { patches: patches ?? [], inversePatches: inversePatches ?? [], label: action.type };
          } else {
            state.transientEntry.patches.push(...(patches ?? []));
            state.transientEntry.inversePatches.unshift(...(inversePatches ?? []));
          }
        }
        return;
      }

      if (state.latestGroupId && state.latestGroupId !== newGroupId) {
        commitBatch(state.latestGroupId);
      }

      const changed = patches.length > 0 || inversePatches.length > 0;
      if (!changed) {
        state.present = nextPresent;
        state.transientPresent = undefined;
        state.transientEntry = undefined;
        return;
      }

      const entry: HistoryEntry = { patches, inversePatches, label: action.type };

      if (newGroupId) {
        if (!state.pendingBatches[newGroupId]) {
          state.pendingBatches[newGroupId] = { patches: [], inversePatches: [], label: `Batch: ${newGroupId}` };
        }
        state.pendingBatches[newGroupId].patches.push(...entry.patches);
        state.pendingBatches[newGroupId].inversePatches.unshift(...entry.inversePatches);
        state.latestGroupId = newGroupId;
      } else {
        state.past.push(entry);
        if (state.past.length > MAX_HISTORY) {
          state.past.splice(0, state.past.length - MAX_HISTORY);
        }
        state.future = [];
      }

      state.present = nextPresent;
      state.transientPresent = undefined;
      state.transientEntry = undefined;
      return;
    }
  }
});

export { historyReducer };
