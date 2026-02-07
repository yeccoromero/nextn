
import { Clip } from "@/types/editor";

export type Easing = 'linear' | 'easeInOutQuad' | 'easeInOutCubic' | 'easeInOutQuart' | 'easeInOutQuint' | 'easeInOutSine' | 'easeInOutExpo' | 'easeInOutCirc' | 'easeOutBounce' | 'easeOutElastic';

export type Keyframe = {
  id: string;
  timeMs: number;
  value: number | string;
  easing?: Easing;
};

export type PropertyId = 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity' | 'fill' | 'stroke' | 'pathD' | 'width' | 'height' | 'rx' | 'ry' | 'outerRadius' | 'innerRadius' | 'radius' | 'sides' | 'points' | 'fontSize' | 'corners' | 'strokeWidth' | 'strokeLineCap';

export type PropertyTrack = {
  id: PropertyId;
  keyframes: Keyframe[];
};

export type LayerTrack = {
  objectId: string;
  properties: PropertyTrack[];
  clip: Clip;
  muted?: boolean;
  locked?: boolean;
  expanded?: boolean;
};

export type TimelineModel = {
  durationMs: number;
  fps: number;
  layers: LayerTrack[];
  loop: boolean;
  playbackRate: number;
};
