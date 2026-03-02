import { StateCreator } from 'zustand';
import { EditorStore } from '../index';

export interface TimelineSlice {
    // Actions
    setTimelinePlaying: (playing: boolean) => void;
    setPlayhead: (ms: number) => void;
    setTimelineZoom: (zoom: number) => void;
    setTimelineDuration: (duration: number) => void;
    toggleTimelineSnap: () => void;
    // ... we will add more as we migrate
}

export const createTimelineSlice: StateCreator<
    EditorStore,
    [['zustand/immer', never]],
    [],
    TimelineSlice
> = (set) => ({
    setTimelinePlaying: (playing) =>
        set((state) => {
            state.present.timeline.playing = playing;
        }),

    setPlayhead: (ms) =>
        set((state) => {
            state.present.timeline.playheadMs = Math.max(0, Math.min(ms, state.present.timeline.durationMs || 5000));
        }),

    setTimelineZoom: (zoom) =>
        set((state) => {
            state.present.timeline.ui.zoom = Math.max(0.1, Math.min(zoom, 10));
        }),

    setTimelineDuration: (duration) =>
        set((state) => {
            state.present.timeline.durationMs = Math.max(100, duration);
            if (state.present.timeline.playheadMs > state.present.timeline.durationMs) {
                state.present.timeline.playheadMs = state.present.timeline.durationMs;
            }
        }),

    toggleTimelineSnap: () =>
        set((state) => {
            state.present.timeline.ui.snap = !state.present.timeline.ui.snap;
        }),
});
