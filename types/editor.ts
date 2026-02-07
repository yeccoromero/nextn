

'use client';

import type { Patch } from 'immer';

export type EasingId = 'linear' | 'inSine' | 'outSine' | 'inOutSine' | 'inQuad' | 'outQuad' | 'inOutQuad' | 'inCubic' | 'outCubic' | 'inOutCubic' | 'inQuart' | 'outQuart' | 'inOutQuart' | 'inQuint' | 'outQuint' | 'inOutQuint' | 'inExpo' | 'outExpo' | 'inOutExpo' | 'inCirc' | 'outCirc' | 'inOutCirc' | 'inBack' | 'outBack' | 'inOutBack';

export type Tool = 'select' | 'rectangle' | 'ellipse' | 'star' | 'polygon' | 'text' | 'pan' | 'pen' | 'path-edit' | 'line' | 'add-node' | 'remove-node';

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type AlignmentType = 
  | 'left' | 'h-center' | 'right' 
  | 'top' | 'v-center' | 'bottom' 
  | 'h-distribute' | 'v-distribute';


export type AnchorPosition = 
  | 'top-left' | 'top-center' | 'top-right' 
  | 'middle-left' | 'center' | 'middle-right' 
  | 'bottom-left' | 'bottom-center' | 'bottom-right'
  | 'origin';

export type GradientStop = {
  id: string;
  offset: number; // 0 to 1
  color: string;
  opacity?: number;
};

export type LinearGradientFill = {
  type: 'linear-gradient';
  stops: GradientStop[];
  start: { x: number; y: number };
  end: { x: number; y: number };
  angle?: number;
};

export type RadialGradientFill = {
    type: 'radial-gradient';
    stops: GradientStop[];
    cx: number; // 0 to 1
    cy: number; // 0 to 1
    r: number;  // 0 to 1
};


export type Fill = string | LinearGradientFill | RadialGradientFill;

export interface SvgBase {
  id: string;
  name?: string;
  layerId: string;
  parentId?: string | null;
  x: number;
  y: number;
  fill: Fill;
  stroke: string;
  strokeWidth: number;
  rotation: number;
  isConstrained?: boolean;
  anchorPosition: AnchorPosition;
  scaleX?: number;
  scaleY?: number;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
}

export interface RectangleObject extends SvgBase {
  type: 'rectangle';
  width: number;
  height: number;
  rx?: number;
  ry?: number;
  corners?: { tl: number; tr: number; br: number; bl: number };
  cornersLinked?: boolean;
  isPillShape?: boolean;
}

export interface EllipseObject extends SvgBase {
  type: 'ellipse';
  rx: number;
  ry: number;
}

export interface StarObject extends SvgBase {
  type: 'star';
  points: number;
  outerRadius: number; 
  innerRadius: number; 
}

export interface PolygonObject extends SvgBase {
    type: 'polygon';
    sides: number;
    radius: number;
}

export interface TextObject extends SvgBase {
  type: 'text';
  text: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
}

export interface BezierPoint {
  x: number;
  y: number;
  mode: 'corner' | 'smooth' | 'symmetrical' | 'free' | 'mirror' | 'aligned';
  handleIn?: { x: number; y: number } | null;
  handleOut?: { x: number; y: number } | null;
}

export interface PathObject extends SvgBase {
  type: 'path';
  points: BezierPoint[];
  closed: boolean;
  isLine?: boolean; // Flag to identify straight lines
  svgPathD?: string;
  strokeLineCap?: 'butt' | 'round' | 'square';
}

export interface GroupObject extends SvgBase {
  type: 'group';
  children: string[];
  collapsed?: boolean;
}


export type SvgObject = RectangleObject | EllipseObject | StarObject | PolygonObject | TextObject | PathObject | GroupObject;

export interface Layer {
  id: string;
  name: string;
  parentId: string | null;
  children: string[];
  objectIds: string[];
  visible: boolean;
  locked: boolean;
  collapsed: boolean;
  editing?: boolean;
}

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MarqueeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SnapLine = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export type DropTarget = {
    id: string;
    type: 'group-reparent' | 'reorder-before' | 'reorder-after';
};


export interface EditorCanvas {
    width: number;
    height: number;
    background: string;
    pan: { x: number; y: number };
    zoom: number;
    isConstrained?: boolean;
    snapToGrid?: boolean;
    gridSize?: number;
}

export type Focus =
  | { type: "selection"; payload: { objectIds: string[] } }
  | { type: "path-edit"; payload: { nodes: Array<{ pathId: string; pointIndex: number }> } }
  | { type: "gradient-edit"; payload: { objectId: string } };

export type Keyframe = {
  id: string;
  timeMs: number; // For properties, this is LOCAL to the clip. For global things, it's global.
  value: any;
  easing?: EasingId;
};

export type TrackId = string;
export type ClipId = string;

export type ClipSegment = {
  startMs: number;
  endMs: number;
};

export type Clip = {
  id: ClipId;
  segments: ClipSegment[];
  selected?: boolean;
  color?: string;
  disabled?: boolean;
  name?: string;
};


export type PropertyId = 'x' | 'y' | 'position' | 'rotation' | 'scaleX' | 'scaleY' | 'scale' | 'opacity' | 'fill' | 'stroke' | 'pathD' | 'width' | 'height' | 'rx' | 'ry' | 'outerRadius' | 'innerRadius' | 'radius' | 'sides' | 'points' | 'fontSize' | 'corners' | 'strokeWidth' | 'strokeLineCap';

export interface PropertyTrack {
  id: PropertyId;
  keyframes: Keyframe[];
}

export interface LayerTrack {
  objectId: string;
  startMs?: number;
  properties: PropertyTrack[];
  clip: Clip; 
  muted?: boolean;
  locked?: boolean;
  expanded?: boolean;
}

export type TimelineRow =
  | { key: string; kind: 'header'; objectId: string; depth: number; height: number, propertyId?: undefined; }
  | { key: string; kind: 'track'; objectId: string; propertyId: PropertyId; depth: number; height: number };

export interface TimelineState {
  durationMs: number;
  fps: number;
  playheadMs: number;
  playing: boolean;
  loop: boolean;
  playbackRate: number;
  workArea: { startMs: number; endMs: number } | null;
  layers: Record<string, LayerTrack>;
  selection: {
    clipIds?: ClipId[];
    keyIds?: string[];
    objectId?: string;
    propertyId?: PropertyId;
  };
  ui: { 
    zoom: number; 
    snap: boolean; 
    snapStepMs: number;
    armedPosition?: { objectId: string; timeMs: number; x: number; y: number; start?: { x:number; y:number } }
  };
}

export type ApplyPatch = { objectId: string; patch: Partial<SvgObject> };

export interface TimelineSpec {
  durationMs: number;
  tracks: Array<{
    objectId: string;
    propertyId: PropertyId;
    keyframes: Keyframe[];
    startMs?: number;
  }>;
}

export type RootState = {
  objects: Record<string, SvgObject>;
  timeline: TimelineState;
}

export type KeyframeMove = {
  objectId: string;
  propertyId: PropertyId;
  keyframeId: string;
  timeMs: number;
};

export type KeyValue = number | { x:number; y:number } | string | { r:number; g:number; b:number; a?:number };

export type CopiedKeyframe = {
  relativeTimeMs: number;
  value: KeyValue;
  easing?: EasingId;
  propertyId: PropertyId;
  objectId: string;
};

export type ClipboardObjects = {
    schema: 'comware/vectoria';
    version: 1;
    type: 'objects';
    payload: SvgObject[];
};

export type ClipboardObjectsWithTimeline = {
    schema: 'comware/vectoria';
    version: 1;
    type: 'objects-with-timeline';
    payload: {
        objects: SvgObject[];
        timelineLayers: Record<string, LayerTrack>;
    };
};

export type ClipboardKeyframes = {
    schema: 'comware/vectoria';
    version: 1;
    type: 'keyframes';
    sourceAnchorMs: number;
    payload: CopiedKeyframe[];
};

export type ClipboardEnvelope = ClipboardObjects | ClipboardObjectsWithTimeline | ClipboardKeyframes;

export type HistoryEntry = {
  patches: Patch[];
  inversePatches: Patch[];
  label?: string;
};

export type History<T> = {
  past: HistoryEntry[];
  present: T;
  future: HistoryEntry[];
  transientPresent?: T;
  transientEntry?: HistoryEntry;
  pendingBatches: Record<string, HistoryEntry>;
  latestGroupId?: string;
};

export interface EditorState {
  objects: Record<string, SvgObject>;
  layers: Record<string, Layer>;
  layerOrder: string[]; // Root layer children order
  selectedObjectIds: string[];
  selectedLayerIds: string[];
  currentTool: Tool;
  lastCreationTool: Tool;
  canvas: EditorCanvas;
  constrainTransform: boolean;
  editingLayerId: string | null;
  drawingPath: PathObject | null;
  zStack: string[];
  ui: {
    focus?: Focus;
    isDraggingLayer: boolean;
    isEditingGradient: boolean;
    snapLines: SnapLine[];
    dropTarget: DropTarget | null;
  },
  selectedPathNodes: Array<{ pathId: string; pointIndex: number }>,
  timeline: TimelineState;
  timelineRows: TimelineRow[];
}

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
  | { type: 'ROTATE_OBJECTS'; payload: { ids: string[]; angle: number, center?: {x:number, y:number} }, transient?: boolean }
  | { type: 'UPDATE_CANVAS'; payload: Partial<EditorCanvas> ; transient?: boolean }
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
  | { type: 'UNDO' }
  | { type: 'REDO' }
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
  | { type: 'UPDATE_DRAWING_PATH'; payload: { point: { x: number; y: number } } }
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
  | { type: 'ADD_KEYFRAME_TO_PROPERTY'; payload: { objectId: string; propertyId: PropertyId; timeMs?: number; value?: any; startValue?: any; } }
  | { type: 'SET_PROPERTY_VALUE_AT_PLAYHEAD'; payload: { objectId: string; propertyId: PropertyId; value: KeyValue; timeMs?: number; source?: 'timeline' | 'inspector' } }
  | { type: 'MOVE_TIMELINE_KEYFRAME'; payload: KeyframeMove; transient?: boolean }
  | { type: 'MOVE_TIMELINE_KEYFRAMES'; payload: { moves: KeyframeMove[] }; transient?: boolean }
  | { type: 'DELETE_TIMELINE_KEYFRAME'; payload: { objectId: string; propertyId: PropertyId; keyframeId: string } }
  | { type: 'SET_TIMELINE_DURATION'; payload: number }
  | { type: 'SET_TIMELINE_FPS'; payload: number }
  | { type: 'SET_TIMELINE_ZOOM'; payload: number }
  | { type: 'TOGGLE_TIMELINE_SNAP' }
  | { type: 'MOVE_CLIP'; payload: { clipId: string; dMs: number }, transient?: boolean }
  | { type: 'SLIDE_LAYER_TRACKS', payload: { objectIds: string[], dMs: number }, transient?: boolean }
  | { type: 'RESIZE_CLIP_START'; payload: { clipId: string; dMs: number }, transient?: boolean }
  | { type: 'RESIZE_CLIP_END'; payload: { clipId: string; dMs: number }, transient?: boolean }
  | { type: 'TOGGLE_PROPERTY_ANIMATION'; payload: { objectId: string, propertyId: PropertyId }}
  | { type: 'SELECT_KEYFRAME'; payload: { objectId: string; propertyId: PropertyId; keyframeId: string; additive?: boolean; } }
  | { type: 'DELETE_SELECTED_KEYFRAMES' }
  | { type: 'TOGGLE_TRACK_EXPANDED'; payload: { objectId: string; value?: boolean } }
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
) & { meta?: { history?: "ignore" | { groupId: string } } };
