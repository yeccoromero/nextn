import { useEffect, MutableRefObject, RefObject } from 'react';
import { useEditorStore } from '@/store';

export interface ZoomActions {
    zoomIn: () => void;
    zoomOut: () => void;
    zoomToFit: () => void;
    setZoom: (zoom: number) => void;
}

export function useCanvasZoom(
    containerRef: RefObject<HTMLDivElement | null>,
    zoomActionsRef: MutableRefObject<ZoomActions | null>
) {
    const store = useEditorStore();
    const canvas = store.present.canvas;
    const dispatch = store.dispatch;

    useEffect(() => {
        if (!zoomActionsRef) return;

        const getViewport = () => containerRef.current?.getBoundingClientRect() || null;

        zoomActionsRef.current = {
            zoomIn: () => {
                const nextZoom = [0.5, 1, 1.5, 2].find(level => level > canvas.zoom);
                zoomActionsRef.current?.setZoom(nextZoom || canvas.zoom * 2);
            },
            zoomOut: () => {
                const nextZoom = [...[0.5, 1, 1.5, 2]].reverse().find(level => level < canvas.zoom);
                zoomActionsRef.current?.setZoom(nextZoom || canvas.zoom / 2);
            },
            setZoom: (newZoom: number) => {
                const viewport = getViewport();
                if (!viewport) return;

                const { zoom: oldZoom, pan: oldPan } = canvas;

                const canvasPointAtCenter = {
                    x: (viewport.width / 2 - (oldPan?.x || 0)) / oldZoom,
                    y: (viewport.height / 2 - (oldPan?.y || 0)) / oldZoom,
                };

                const newPanX = viewport.width / 2 - canvasPointAtCenter.x * newZoom;
                const newPanY = viewport.height / 2 - canvasPointAtCenter.y * newZoom;

                dispatch({
                    type: 'UPDATE_CANVAS',
                    payload: {
                        zoom: newZoom,
                        pan: { x: newPanX, y: newPanY },
                    }
                });
            },
            zoomToFit: () => {
                const viewport = getViewport();
                if (!viewport) return;

                const PADDING = 80;
                const { width: canvasWidth, height: canvasHeight } = canvas;

                const scaleX = (viewport.width - PADDING) / canvasWidth;
                const scaleY = (viewport.height - PADDING) / canvasHeight;

                const newZoom = Math.max(0.01, Math.min(scaleX, scaleY));

                const newPanX = (viewport.width - canvasWidth * newZoom) / 2;
                const newPanY = (viewport.height - canvasHeight * newZoom) / 2;

                dispatch({
                    type: 'UPDATE_CANVAS',
                    payload: {
                        zoom: newZoom,
                        pan: { x: newPanX, y: newPanY },
                    },
                });
            }
        };

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const newZoom = Math.max(0.01, canvas.zoom - e.deltaY * 0.005);

                const viewport = getViewport();
                if (!viewport || !containerRef.current) return;

                const mousePos = { x: e.clientX - viewport.left, y: e.clientY - viewport.top };

                const { zoom: oldZoom, pan: oldPan } = canvas;

                const canvasPointAtMouse = {
                    x: (mousePos.x - (oldPan?.x || 0)) / oldZoom,
                    y: (mousePos.y - (oldPan?.y || 0)) / oldZoom,
                };

                const newPanX = mousePos.x - canvasPointAtMouse.x * newZoom;
                const newPanY = mousePos.y - canvasPointAtMouse.y * newZoom;

                dispatch({
                    type: 'UPDATE_CANVAS',
                    payload: {
                        zoom: newZoom,
                        pan: { x: newPanX, y: newPanY },
                    },
                });
            } else {
                const { pan } = canvas;
                dispatch({
                    type: 'UPDATE_CANVAS',
                    payload: {
                        pan: {
                            x: (pan?.x || 0) - e.deltaX,
                            y: (pan?.y || 0) - e.deltaY,
                        }
                    }
                });
            }
        };

        const container = containerRef.current;
        container?.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            container?.removeEventListener('wheel', handleWheel);
        };
    }, [canvas.zoom, dispatch, zoomActionsRef, canvas, canvas.pan, containerRef]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case '=':
                    case '+':
                        e.preventDefault();
                        zoomActionsRef.current?.zoomIn();
                        break;
                    case '-':
                        e.preventDefault();
                        zoomActionsRef.current?.zoomOut();
                        break;
                    case '0':
                        e.preventDefault();
                        zoomActionsRef.current?.zoomToFit();
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [zoomActionsRef]);
}
