import type { EditorState, SvgObject } from "@/types/editor";
import { getOverallBBox, getWorldRotation } from "@/lib/editor-utils";

export function createSelectSelectedObjects() {
  let lastObjectsRef: EditorState["objects"] | null = null;
  let lastIdsRef: string[] | null = null;
  let lastResult: SvgObject[] = [];

  return (state: EditorState) => {
    if (state.objects === lastObjectsRef && state.selectedObjectIds === lastIdsRef) {
      return lastResult;
    }
    lastObjectsRef = state.objects;
    lastIdsRef = state.selectedObjectIds;
    lastResult = state.selectedObjectIds.map(id => state.objects[id]).filter(Boolean) as SvgObject[];
    return lastResult;
  };
}

export function createSelectOverallBBox() {
  const selectSelectedObjects = createSelectSelectedObjects();
  let lastObjectsRef: EditorState["objects"] | null = null;
  let lastSelectedRef: any[] | null = null;
  let lastBBox: any = null;

  return (state: EditorState) => {
    const selected = selectSelectedObjects(state);
    if (state.objects === lastObjectsRef && selected === lastSelectedRef) return lastBBox;

    lastObjectsRef = state.objects;
    lastSelectedRef = selected;
    lastBBox = getOverallBBox(selected, state.objects);
    return lastBBox;
  };
}

export function createSelectWorldRotation() {
  let lastObjectsRef: EditorState["objects"] | null = null;
  const cache = new Map<string, number>();

  return (state: EditorState, objectId: string) => {
    if (state.objects !== lastObjectsRef) {
      lastObjectsRef = state.objects;
      cache.clear();
    }
    const hit = cache.get(objectId);
    if (hit !== undefined) return hit;

    const obj = state.objects[objectId];
    if (!obj) return 0;
    
    const rot = getWorldRotation(obj, state.objects);
    cache.set(objectId, rot);
    return rot;
  };
}
