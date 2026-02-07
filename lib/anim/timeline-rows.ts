

import type { EditorState, SvgObject, TimelineRow, PropertyId, LayerTrack, PropertyTrack } from '@/types/editor';

const PROPERTY_ORDER: PropertyId[] = ['position', 'rotation', 'scaleX', 'opacity', 'fill', 'stroke', 'strokeWidth'];

function* walkObjectsDFS(rootIds: string[], objects: Record<string, SvgObject>, zStack: string[], depth = 0): Generator<{ id: string; depth: number }> {
  const sortedRootIds = [...rootIds].sort((a, b) => {
    const zA = zStack.indexOf(a);
    const zB = zStack.indexOf(b);
    return zB - zA;
  });

  for (const id of sortedRootIds) {
    const o = objects[id];
    if (!o) continue;
    yield { id, depth };
    if (o.type === 'group' && (o as any).children?.length && !(o as any).collapsed) {
      yield* walkObjectsDFS((o as any).children, objects, zStack, depth + 1);
    }
  }
}

function getTopLevelIdsFromZ(zStack: string[], objects: Record<string, SvgObject>) {
  return zStack.filter(id => objects[id] && !objects[id].parentId);
}

const getVisibleProperties = (layerTrack: LayerTrack | undefined): PropertyId[] => {
    if (!layerTrack) return [];
    const props = new Set<string>();
    const result: PropertyId[] = [];
    for (const p of layerTrack.properties) {
        if (p.id === 'position') {
            if (!props.has('position')) {
                props.add('position');
                result.push('position');
            }
        } else if (p.id === 'scale') {
            if (!props.has('scale')) {
                props.add('scale');
                result.push('scaleX');
            }
        } else {
            if (!props.has(p.id)) {
                props.add(p.id);
                result.push(p.id);
            }
        }
    }
    return result;
}


export function buildTimelineRows(state: EditorState): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const top = getTopLevelIdsFromZ(state.zStack, state.objects);

  // Before building rows, ensure every object has a timeline layer entry.
  for (const id of Object.keys(state.objects)) {
    if (!state.timeline.layers[id]) {
      state.timeline.layers[id] = {
        objectId: id,
        properties: [],
        clip: { id, segments: [{ startMs: 0, endMs: state.timeline.durationMs }] },
        expanded: false, // Default to collapsed
      };
    } else {
      const seen = new Set<string>();
      state.timeline.layers[id].properties = state.timeline.layers[id].properties.filter(p => {
        const k = p.id as string;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
  }

  for (const { id, depth } of walkObjectsDFS(top, state.objects, state.zStack, 0)) {
    const headerRow: TimelineRow = { key: `hdr:${id}`, kind: 'header', objectId: id, depth, height: 28 };
    rows.push(headerRow);
    
    const lt = state.timeline.layers[id];
    if (!lt || !lt.expanded) continue;

    const visibleProps = getVisibleProperties(lt);

    const sortedProps = [...visibleProps].sort((a, b) => {
        const ia = PROPERTY_ORDER.indexOf(a);
        const ib = PROPERTY_ORDER.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b as string);
    });

    for (const pId of sortedProps) {
      rows.push({ key: `trk:${id}:${pId}`, kind: 'track', objectId: id, propertyId: pId, depth: depth + 1, height: 28 });
    }
  }
  return rows;
}

