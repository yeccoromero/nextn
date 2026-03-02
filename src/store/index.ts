import { create, type StateCreator } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { EditorState, HistoryEntry, Focus, SvgObject, Layer, TimelineState } from '@/types/editor';
import { EditorAction, historyReducer, initialState } from './legacyReducer';
import { createUISlice, UISlice } from './slices/uiSlice';
import { createTimelineSlice, TimelineSlice } from './slices/timelineSlice';
import { createObjectsSlice, ObjectsSlice } from './slices/objectsSlice';
import { createHistorySlice, HistorySlice } from './slices/historySlice';

export interface EditorStoreConfig {
    past: HistoryEntry[];
    present: EditorState;
    future: HistoryEntry[];
    transientPresent?: EditorState;
    transientEntry?: HistoryEntry;
    pendingBatches: Record<string, HistoryEntry>;
    latestGroupId?: string;
}

export interface EditorStoreActions {
    dispatch: (action: EditorAction) => void;
}

export type EditorStore = EditorStoreConfig & EditorStoreActions & UISlice & TimelineSlice & ObjectsSlice & HistorySlice;

export const useEditorStore = create<EditorStore>()(immer((set, get, store) => ({
    past: [],
    present: initialState,
    future: [],
    pendingBatches: {},

    // Legacy Reducer Dispatch Engine
    dispatch: (action: EditorAction) => {
        set((state) => {
            // historyReducer uses Immer internally, so we expect it to return a new state
            // but because we are inside a Zustand non-immer setter, we need to pass the whole History
            // object and merge the result back.
            const historyState = {
                past: state.past,
                present: state.present,
                future: state.future,
                transientPresent: state.transientPresent,
                transientEntry: state.transientEntry,
                pendingBatches: state.pendingBatches,
                latestGroupId: state.latestGroupId,
            };

            const nextState = historyReducer(historyState, action);

            return {
                ...nextState
            };
        });
    },

    // Slices (Direct Actions)
    ...createHistorySlice(set, get, store),
    ...createUISlice(set, get, store),
    ...createTimelineSlice(set, get, store),
    ...createObjectsSlice(set, get, store),
})));
