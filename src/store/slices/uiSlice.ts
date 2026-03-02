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
            state.present.currentTool = tool;
            if (tool !== 'select' && tool !== 'pan' && tool !== 'path-edit') {
                state.present.lastCreationTool = tool;
            }
        }),

    setZoom: (zoom) =>
        set((state) => {
            state.present.canvas.zoom = zoom;
        }),

    setPan: (pan) =>
        set((state) => {
            state.present.canvas.pan = pan;
        }),

    setCanvasBackground: (bg) =>
        set((state) => {
            state.present.canvas.background = bg;
        }),

    setConstrainTransform: (constrain) =>
        set((state) => {
            state.present.constrainTransform = constrain;
        }),

    setEditingGradient: (editing) =>
        set((state) => {
            state.present.ui.isEditingGradient = editing;
        }),

    setEditingLayerId: (id) =>
        set((state) => {
            state.present.editingLayerId = id;
        }),

    toggleSnapToGrid: () =>
        set((state) => {
            state.present.canvas.snapToGrid = !state.present.canvas.snapToGrid;
        }),

    setGridSize: (size) =>
        set((state) => {
            state.present.canvas.gridSize = Math.max(5, Math.min(100, Math.floor(size)));
        }),

    setCanvasDimensions: (width, height) =>
        set((state) => {
            state.present.canvas.width = Math.max(10, Math.floor(width));
            state.present.canvas.height = Math.max(10, Math.floor(height));
        }),
});
