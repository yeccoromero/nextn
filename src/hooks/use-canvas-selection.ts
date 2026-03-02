import { useCallback, useRef } from 'react';
import { useEditorStore } from '@/store';
import { SvgObject, BoundingBox } from '@/types/editor';

type MarqueeRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export function useCanvasSelection(
    svgRef: React.RefObject<SVGSVGElement>,
    setMarqueeRect: (rect: MarqueeRect | null) => void,
    zoom: number
) {
    const dispatch = useEditorStore(state => state.dispatch);
    const marqueeStartRef = useRef<{ x: number, y: number } | null>(null);
    const marqueeRafRef = useRef<number | null>(null);

    const startMarquee = useCallback((x: number, y: number, shiftKey: boolean) => {
        if (!shiftKey) {
            dispatch({ type: 'CLEAR_SELECTION' });
        }
        marqueeStartRef.current = { x, y };
        setMarqueeRect({ x, y, width: 0, height: 0 });
    }, [dispatch, setMarqueeRect]);

    const updateMarquee = useCallback((x: number, y: number) => {
        if (!marqueeStartRef.current) return;

        if (marqueeRafRef.current) {
            cancelAnimationFrame(marqueeRafRef.current);
        }

        marqueeRafRef.current = requestAnimationFrame(() => {
            if (!marqueeStartRef.current) return;
            const sx = marqueeStartRef.current.x;
            const sy = marqueeStartRef.current.y;
            setMarqueeRect({
                x: Math.min(x, sx),
                y: Math.min(y, sy),
                width: Math.abs(x - sx),
                height: Math.abs(y - sy)
            });
            marqueeRafRef.current = null;
        });
    }, [setMarqueeRect]);

    const finishMarquee = useCallback((
        rect: MarqueeRect | null,
        objects: Record<string, SvgObject>,
        getVisualBoundingBox: (obj: SvgObject) => BoundingBox,
        shiftKey: boolean
    ) => {
        if (marqueeRafRef.current) {
            cancelAnimationFrame(marqueeRafRef.current);
            marqueeRafRef.current = null;
        }
        setMarqueeRect(null);
        marqueeStartRef.current = null;

        if (!rect || rect.width < 5 || rect.height < 5) return;

        // Find objects intersecting with marquee
        const newSelection: string[] = [];
        for (const obj of Object.values(objects)) {
            if (obj.locked) continue;

            const box = getVisualBoundingBox(obj);
            const intersects = !(
                box.x > rect.x + rect.width ||
                box.x + box.width < rect.x ||
                box.y > rect.y + rect.height ||
                box.y + box.height < rect.y
            );

            if (intersects) {
                newSelection.push(obj.id);
            }
        }

        if (newSelection.length > 0) {
            dispatch({ type: 'SELECT_MULTIPLE_OBJECTS', payload: { ids: newSelection, shiftKey } });
        }
    }, [dispatch, setMarqueeRect]);

    return {
        startMarquee,
        updateMarquee,
        finishMarquee
    };
}
