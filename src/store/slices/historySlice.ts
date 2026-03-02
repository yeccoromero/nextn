import { StateCreator } from 'zustand';
import { applyPatches } from 'immer';
import { EditorStore } from '../index';

export interface HistorySlice {
    undo: () => void;
    redo: () => void;
    commitState: (message?: string) => void;
}

export const createHistorySlice: StateCreator<
    EditorStore,
    [['zustand/immer', never]],
    [],
    HistorySlice
> = (set, get) => ({
    undo: () =>
        set((state) => {
            const { past, present, future } = state;
            if (past.length === 0) return;

            const entry = past[past.length - 1];
            state.past.pop();

            state.present = applyPatches(present, entry.inversePatches);
            state.future.unshift(entry);
        }),

    redo: () =>
        set((state) => {
            const { past, present, future } = state;
            if (future.length === 0) return;

            const entry = future[0];
            state.future.shift();

            state.present = applyPatches(present, entry.patches);
            state.past.push(entry);
        }),

    commitState: (message = 'Update state') =>
        set((state) => {
            // Future feature: if we start creating patches for Zustand direct actions
            // we will need to capture them here. For now, historyReducer does this.
        }),
});
