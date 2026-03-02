'use client';

import { createContext, useContext, type ReactNode, useEffect, useRef, MutableRefObject, useState } from 'react';
import type { EditorState, EditorCanvas, AnchorPosition, AlignmentType, Layer, PathObject, GroupObject, TimelineSpec, ApplyPatch } from '@/types/editor';
import { AnimeRuntimeApply } from '@/lib/anim/runtime';
import { useUser } from '@/lib/auth';
import { useAeKeyboardNudge } from '@/hooks/use-ae-keyboard-nudge';
import { useEditorStore } from '@/store';
import { EditorAction, initialState } from '@/store/legacyReducer';

interface ZoomActions {
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  setZoom: (zoom: number) => void;
}

const EditorContext = createContext<{
  state: EditorState;
  dispatch: (action: EditorAction) => void;
  canUndo: boolean;
  canRedo: boolean;
  zoomActionsRef: MutableRefObject<ZoomActions | null>;
} | null>(null);

export function EditorProvider({ children, projectId }: { children: ReactNode, projectId: string }) {
  const store = useEditorStore();
  const { present: state, past, future, pendingBatches, latestGroupId, dispatch } = store;

  // We need transientPresent state if it exists, otherwise use present.
  const activeState = store.transientPresent ?? state;
  const stateRef = useRef(activeState);
  stateRef.current = activeState;

  const { user } = useUser();
  const [isLoaded, setIsLoaded] = useState(false);

  useAeKeyboardNudge({
    fps: activeState.timeline.fps,
    getTimeMs: () => stateRef.current.timeline.playheadMs,
    setTimeMs: (ms) => dispatch({ type: 'SET_TIMELINE_PLAYHEAD', payload: ms, transient: true }),
    getDurationMs: () => stateRef.current.timeline.durationMs,
    isPlaying: () => stateRef.current.timeline.playing,
    setPlaying: (playing) => dispatch({ type: 'SET_TIMELINE_PLAYING', payload: playing }),
  });

  const hasLoadedRef = useRef(isLoaded);
  hasLoadedRef.current = isLoaded;

  const canUndo = past.length > 0 || !!latestGroupId;
  const canRedo = future.length > 0;

  const zoomActionsRef = useRef<ZoomActions | null>(null);
  const runtimeRef = useRef<AnimeRuntimeApply | null>(null);

  // Load project from localStorage only
  useEffect(() => {
    if (!projectId) return;

    setIsLoaded(false);
    const localBackupJson = localStorage.getItem(`vectoria-editor-state-${projectId}`);
    if (localBackupJson) {
      try {
        const localState = JSON.parse(localBackupJson);
        dispatch({ type: 'LOAD_STATE', payload: localState });
      } catch {
        dispatch({ type: 'LOAD_STATE', payload: initialState });
      }
    } else {
      dispatch({ type: 'LOAD_STATE', payload: initialState });
    }
    setIsLoaded(true);
  }, [projectId, dispatch]);

  // Local storage save (debounced)
  useEffect(() => {
    if (!isLoaded || !projectId) return;
    const handler = setTimeout(() => {
      try {
        const stateToSave = JSON.stringify(activeState);
        localStorage.setItem(`vectoria-editor-state-${projectId}`, stateToSave);
      } catch (error) {
        console.error("Failed to save to local storage:", error);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [activeState, projectId, isLoaded]);

  useEffect(() => {
    runtimeRef.current = new AnimeRuntimeApply({
      apply: (patches: ApplyPatch[]) => {
        dispatch({ type: 'OBJECTS/UPDATE_FROM_ANIMATION', payload: patches, transient: true });
      },
      getObjects: () => stateRef.current.objects,
      onUpdate: ({ currentTimeMs }) => {
        dispatch({ type: 'SET_TIMELINE_PLAYHEAD', payload: currentTimeMs, transient: true });
      }
    });

    return () => {
      runtimeRef.current?.dispose();
    };
  }, [dispatch]);

  useEffect(() => {
    if (!runtimeRef.current) return;
    const spec: TimelineSpec = {
      durationMs: activeState.timeline.durationMs,
      tracks: Object.values(activeState.timeline.layers).flatMap(lt =>
        (lt?.properties || []).map(p => ({
          objectId: lt.objectId,
          propertyId: p.id,
          keyframes: p.keyframes,
          startMs: lt.startMs,
        }))
      )
    };
    runtimeRef.current.load(spec);
  }, [activeState.timeline.durationMs, activeState.timeline.layers]);

  useEffect(() => {
    if (!runtimeRef.current) return;
    runtimeRef.current.setWorkArea(activeState.timeline.workArea);
  }, [activeState.timeline.workArea]);

  useEffect(() => {
    if (!runtimeRef.current) return;
    runtimeRef.current.setLoop(activeState.timeline.loop);
  }, [activeState.timeline.loop]);

  useEffect(() => {
    if (!runtimeRef.current) return;
    runtimeRef.current.setRate(activeState.timeline.playbackRate);
  }, [activeState.timeline.playbackRate]);

  useEffect(() => {
    if (!runtimeRef.current) return;
    if (activeState.timeline.playing) {
      runtimeRef.current.play();
    } else {
      runtimeRef.current.pause();
    }
  }, [activeState.timeline.playing]);

  useEffect(() => {
    if (runtimeRef.current && !activeState.timeline.playing) {
      runtimeRef.current.seek(activeState.timeline.playheadMs);
    }
  }, [activeState.timeline.playheadMs, activeState.timeline.playing]);

  const contextValue = {
    state: activeState,
    dispatch,
    canUndo,
    canRedo,
    zoomActionsRef,
  };

  return <EditorContext.Provider value={contextValue}>{children}</EditorContext.Provider>;
}

export const useEditor = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
};
