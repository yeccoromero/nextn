
'use client';

import { useEditor } from "@/context/editor-context";
import { Button } from "../ui/button";
import { Play, Pause, SkipBack } from "lucide-react";

export function TransportControls() {
  const { state, dispatch } = useEditor();
  const { timeline } = state;
  const { playing, playheadMs, durationMs, fps } = timeline;

  const handlePlayPause = () => {
    dispatch({ type: 'SET_TIMELINE_PLAYING', payload: !playing });
  };

  const handleSkipBack = () => {
    dispatch({ type: 'SET_TIMELINE_PLAYHEAD', payload: 0 });
  };

  const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const frame = Math.floor((totalSeconds - Math.floor(totalSeconds)) * fps);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frame).padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 px-2">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSkipBack}>
        <SkipBack className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePlayPause}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="text-xs font-mono w-24 text-muted-foreground tabular-nums">
        {formatTime(playheadMs)}
      </div>
    </div>
  );
}
