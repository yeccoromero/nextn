import { type StateCreator } from 'zustand';
import { type EditorStore } from '../index';
import { type Tool } from '@/types/editor';

export interface UISlice {
    // Actions
    setTool: (tool: Tool) => void;
    setZoom: (zoom: number) => void;
    setPan: (pan: { x: number; y: number }) => void;
    setCanvasBackground: (bg: string) => void;
    setConstrainTransform: (constrain: boolean) => void;
    setEditingGradient: (editing: boolean) => void;
    setEditingLayerId: (id: string | null) => void;
    toggleSnapToGrid: () => void;
    setGridSize: (size: number) => void;
    setCanvasDimensions: (width: number, height: number) => void;
    // ... we will add more as we migrate
}

export const createUISlice: StateCreator<
    EditorStore,
    [['zustand/immer', never]],
    [],
    UISlice
> = (set) => ({
    setTool: (tool) =>
        set((state) => {
            const apply = (s: any) => {
                s.currentTool = tool;
                if (tool !== 'select' && tool !== 'pan' && tool !== 'path-edit') {
                    s.lastCreationTool = tool;
                }
            };
            apply(state.present);
            if (state.transientPresent) apply(state.transientPresent);
        }),

    setZoom: (zoom) =>
        set((state) => {
            state.present.canvas.zoom = zoom;
            if (state.transientPresent) state.transientPresent.canvas.zoom = zoom;
        }),

    setPan: (pan) =>
        set((state) => {
            state.present.canvas.pan = pan;
            if (state.transientPresent) state.transientPresent.canvas.pan = pan;
        }),

    setCanvasBackground: (bg) =>
        set((state) => {
            state.present.canvas.background = bg;
            if (state.transientPresent) state.transientPresent.canvas.background = bg;
        }),

    setConstrainTransform: (constrain) =>
        set((state) => {
            state.present.constrainTransform = constrain;
            if (state.transientPresent) state.transientPresent.constrainTransform = constrain;
        }),

    setEditingGradient: (editing) =>
        set((state) => {
            state.present.ui.isEditingGradient = editing;
            if (state.transientPresent) state.transientPresent.ui.isEditingGradient = editing;
        }),

    setEditingLayerId: (id) =>
        set((state) => {
            state.present.editingLayerId = id;
            if (state.transientPresent) state.transientPresent.editingLayerId = id;
        }),

    toggleSnapToGrid: () =>
        set((state) => {
            const active = !state.present.canvas.snapToGrid;
            state.present.canvas.snapToGrid = active;
            if (state.transientPresent) state.transientPresent.canvas.snapToGrid = active;
        }),

    setGridSize: (size) =>
        set((state) => {
            const gs = Math.max(5, Math.min(100, Math.floor(size)));
            state.present.canvas.gridSize = gs;
            if (state.transientPresent) state.transientPresent.canvas.gridSize = gs;
        }),

    setCanvasDimensions: (width, height) =>
        set((state) => {
            const w = Math.max(10, Math.floor(width));
            const h = Math.max(10, Math.floor(height));
            state.present.canvas.width = w;
            state.present.canvas.height = h;
            if (state.transientPresent) {
                state.transientPresent.canvas.width = w;
                state.transientPresent.canvas.height = h;
            }
        }),
});
