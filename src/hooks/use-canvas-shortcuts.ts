import { useEffect } from 'react';
import { useEditorStore } from '@/store';
import { PathObject } from '@/types/editor';

export function useCanvasShortcuts() {
    const store = useEditorStore();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            // Prevent shortcuts if typing in an input
            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
                return;
            }

            // Always get the latest state directly from the store to avoid stale closures
            const state = useEditorStore.getState().present;
            const dispatch = useEditorStore.getState().dispatch;

            const {
                objects,
                selectedObjectIds,
                selectedPathNodes,
                currentTool,
                ui,
                timeline
            } = state;

            // --- Play/Pause ---
            if (e.key === ' ') {
                e.preventDefault();
                dispatch({ type: 'SET_TIMELINE_PLAYING', payload: !timeline.playing });
                return;
            }

            // --- Nudge (Arrows) ---
            const isArrowKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
            if (isArrowKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                if (timeline.playing) {
                    dispatch({ type: 'SET_TIMELINE_PLAYING', payload: false });
                }
                const step = 1;
                let dx = 0, dy = 0;
                if (e.key === 'ArrowUp') dy = -step;
                if (e.key === 'ArrowDown') dy = step;
                if (e.key === 'ArrowLeft') dx = -step;
                if (e.key === 'ArrowRight') dx = step;

                let draggingHandled = false;

                if (selectedPathNodes.length > 0) {
                    selectedPathNodes.forEach(({ pathId, pointIndex }: { pathId: string; pointIndex: number }) => {
                        const path = objects[pathId] as PathObject;
                        if (path && !path.locked) {
                            const originalPoint = path.points[pointIndex];
                            const newPoint = { ...originalPoint, x: originalPoint.x + dx, y: originalPoint.y + dy };
                            if (originalPoint.handleIn) {
                                newPoint.handleIn = { x: originalPoint.handleIn.x + dx, y: originalPoint.handleIn.y + dy };
                            }
                            if (originalPoint.handleOut) {
                                newPoint.handleOut = { x: originalPoint.handleOut.x + dx, y: originalPoint.handleOut.y + dy };
                            }
                            dispatch({ type: 'UPDATE_PATH_POINT', payload: { pathId, pointIndex, newPoint } });
                            draggingHandled = true;
                        }
                    });

                } else if (selectedObjectIds.length > 0) {
                    selectedObjectIds.forEach((id: string) => {
                        const obj = objects[id];
                        if (obj && !obj.locked) {
                            dispatch({ type: 'UPDATE_OBJECTS', payload: { ids: [id], updates: { x: obj.x + dx, y: obj.y + dy } } });
                            draggingHandled = true;
                        }
                    });
                }

                if (draggingHandled) {
                    dispatch({ type: 'COMMIT_DRAG' });
                }
                return;
            }

            // --- Global Modifiers (Ctrl/Cmd) ---
            if (e.ctrlKey || e.metaKey) {
                if (e.key.toLowerCase() === 'z') {
                    if (e.shiftKey) {
                        useEditorStore.getState().redo();
                    } else {
                        useEditorStore.getState().undo();
                    }
                    e.preventDefault();
                    return;
                }
                if (e.key.toLowerCase() === 'c') {
                    dispatch({ type: 'COPY_SELECTION' });
                } else if (e.key.toLowerCase() === 'x') {
                    dispatch({ type: 'CUT_SELECTION' });
                } else if (e.key.toLowerCase() === 'v') {
                    dispatch({ type: 'PASTE_OBJECTS' });
                } else if (e.key.toLowerCase() === 'd') {
                    e.preventDefault();
                    dispatch({ type: 'DUPLICATE_SELECTED_OBJECTS' });
                }
            }

            // --- Tool switching ---
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                switch (e.key.toLowerCase()) {
                    case 'v':
                        dispatch({ type: 'SET_TOOL', payload: 'select' });
                        break;
                    case 'a':
                        dispatch({ type: 'SET_TOOL', payload: 'path-edit' });
                        break;
                }
            }

            // --- Esc (Cancel Selection) ---
            if (e.key === 'Escape' && (currentTool === 'path-edit' || ui.isEditingGradient)) {
                dispatch({ type: 'CLEAR_SELECTED_PATH_NODES' });
                dispatch({ type: 'CLEAR_SELECTION' });
                dispatch({ type: 'SET_EDITING_GRADIENT', payload: false });
                e.preventDefault();
            }

            // --- Delete / Backspace ---
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (timeline.selection.keyIds && timeline.selection.keyIds.length > 0) {
                    dispatch({ type: 'DELETE_SELECTED_KEYFRAMES' });
                } else if (selectedObjectIds.length > 0) {
                    dispatch({ type: 'DELETE_SELECTED' });
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);
}
