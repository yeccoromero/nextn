import { StateCreator } from 'zustand';
import { SvgObject } from '@/types/editor';
import { EditorStore } from '../index';

export interface ObjectsSlice {
    // Actions
    updateObjects: (ids: string[], updates: Partial<SvgObject>) => void;
    deleteObjects: (ids: string[]) => void;
    clearSelection: () => void;
    // ... we will add more as we migrate
}

export const createObjectsSlice: StateCreator<
    EditorStore,
    [['zustand/immer', never]],
    [],
    ObjectsSlice
> = (set) => ({
    updateObjects: (ids, updates) =>
        set((state) => {
            ids.forEach((id) => {
                const obj = state.present.objects[id];
                if (obj && !obj.locked) {
                    Object.assign(obj, updates);
                }
            });
        }),

    deleteObjects: (ids) =>
        set((state) => {
            ids.forEach((id) => {
                delete state.present.objects[id];
                delete state.present.timeline.layers[id];
                state.present.zStack = state.present.zStack.filter(zid => zid !== id);
                state.present.selectedObjectIds = state.present.selectedObjectIds.filter(sid => sid !== id);
            });
        }),

    clearSelection: () =>
        set((state) => {
            state.present.selectedObjectIds = [];
        }),
});
