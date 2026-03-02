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
        // Run the history reducer against the raw current state (NOT a draft)
        // to avoid nested Immer produce tracking issues.
        const currentState = get();
        const historyState = {
            past: currentState.past,
            present: currentState.present,
            future: currentState.future,
            transientPresent: currentState.transientPresent,
            transientEntry: currentState.transientEntry,
            pendingBatches: currentState.pendingBatches,
            latestGroupId: currentState.latestGroupId,
        };

        const nextState = historyReducer(historyState, action);

        set((draft) => {
            draft.past = nextState.past as any;
            draft.present = nextState.present as any;
            draft.future = nextState.future as any;
            draft.transientPresent = nextState.transientPresent as any;
            draft.transientEntry = nextState.transientEntry as any;
            draft.pendingBatches = nextState.pendingBatches as any;
            draft.latestGroupId = nextState.latestGroupId as any;
        });
    },

    // Slices (Direct Actions)
    ...createHistorySlice(set, get, store),
    ...createUISlice(set, get, store),
    ...createTimelineSlice(set, get, store),
    ...createObjectsSlice(set, get, store),
})));
