
'use client';

import { useEditor } from "@/context/editor-context";
import { Button } from "../ui/button";
import { Play, Pause, SkipBack } from "lucide-react";

export const formatTime = (ms: number, fps: number) => {
    const totalFrames = Math.floor((ms / 1000) * fps);
    return `${totalFrames}`;
};

export default function Transport() {
  const { state, dispatch } = useEditor();
  
  if (!state) {
    return (
        <div className="flex items-center gap-2 h-7 w-40 animate-pulse">
            <div className="h-7 w-7 bg-muted rounded-full" />
            <div className="h-7 w-7 bg-muted rounded-full" />
            <div className="h-4 w-24 bg-muted rounded-md" />
        </div>
    );
  }

  const { timeline } = state;
  const { playing, playheadMs, durationMs, fps } = timeline;

  const handlePlayPause = () => {
    dispatch({ type: 'SET_TIMELINE_PLAYING', payload: !playing });
  };

  const handleSkipBack = () => {
    dispatch({ type: 'SET_TIMELINE_PLAYHEAD', payload: 0, transient: true });
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSkipBack}>
        <SkipBack className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePlayPause}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="text-xs font-mono w-24 text-muted-foreground tabular-nums text-center">
        {formatTime(playheadMs, fps)}
      </div>
    </div>
  );
}
