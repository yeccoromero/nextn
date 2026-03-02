// @ts-nocheck
// src/lib/anim/group-clip.ts
import type { EditorState } from "@/types/editor";
import { unionClips, EMPTY_CLIP, type Clip } from "./clip";

export function getLayerClipSafe(state: EditorState, objectId: string): Clip {
  const track = state.timeline.layers[objectId];
  // Convert from old format to new format
  if (track && track.clip && !track.clip.segments) {
    const oldClip = track.clip as any;
    return {
      id: track.clip.id,
      segments: [{ startMs: oldClip.startSec * 1000, endMs: oldClip.endSec * 1000 }],
      selected: oldClip.selected,
      color: oldClip.color
    };
  }
  return track?.clip ?? { ...EMPTY_CLIP, id: objectId };
}

/**
 * Devuelve el "clip compuesto" para un grupo:
 *   union( clip propio del grupo, clips de todos sus descendientes )
 */
export function getCompositeGroupClip(state: EditorState, groupId: string): Clip {
  const { objects } = state;
  const group = objects[groupId];
  if (!group || group.type !== "group") {
    // Fallback: si no es grupo, devuelve su propio clip
    return getLayerClipSafe(state, groupId);
  }

  let acc: Clip = getLayerClipSafe(state, groupId);

  const children: string[] = (group as any).children ?? [];
  for (const childId of children) {
    const child = objects[childId];
    if (!child) continue;

    if (child.type === "group") {
      acc = unionClips(acc, getCompositeGroupClip(state, childId));
    } else {
      acc = unionClips(acc, getLayerClipSafe(state, childId));
    }
  }

  return { ...acc, id: groupId };
}
