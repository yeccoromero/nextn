import type { TimelineModel, SvgObject, Keyframe as AnimKeyframe, LayerTrack, PropertyTrack, PropertyId } from '@/types/editor';

// Lottie-like types (simplified)
type LottieKeyframe = {
  t: number; // in-frame
  s: number[]; // start value
  e?: number[]; // end value
  h?: number; // hold
  // No easing for this stub
};

type LottieProperty<T> = {
  k: T | LottieKeyframe[];
};

type LottieTransform = {
  o: LottieProperty<number>; // opacity (0-100)
  r: LottieProperty<number>; // rotation (degrees)
  p: LottieProperty<number[]>; // position [x, y]
  s: LottieProperty<number[]>; // scale [x, y]
  // anchor point (a) is usually static
  a: LottieProperty<number[]>;
};

type LottieLayer = {
  nm: string;
  ty: 4; // Shape layer type
  ks: LottieTransform;
  ip: number; // in-point (frame)
  op: number; // out-point (frame)
  st: number; // start time (frame)
  sr: 1; // time stretch
  // shapes property would go here for geometry
};

export type LottieDraft = {
  fr: number; // frame rate
  ip: number; // in-point (frames)
  op: number; // out-point (frames)
  w: number;
  h: number;
  layers: LottieLayer[];
};

const toLottieFrames = (ms: number, fps: number) => (ms / 1000) * fps;

function propertyToLottie(
    property: PropertyId,
    track: PropertyTrack,
    fps: number,
    defaultValue: number | number[]
): LottieProperty<any> {
    if (track.keyframes.length === 0) {
        return { k: defaultValue };
    }
    if (track.keyframes.length === 1) {
        return { k: track.keyframes[0].value };
    }

    const keyframes: LottieKeyframe[] = [];
    for (let i = 0; i < track.keyframes.length; i++) {
        const kf = track.keyframes[i];
        const nextKf = track.keyframes[i + 1];

        const key: LottieKeyframe = {
            t: toLottieFrames(kf.timeMs, fps),
            s: Array.isArray(kf.value) ? kf.value : [kf.value],
        };

        if (nextKf) {
            key.e = Array.isArray(nextKf.value) ? nextKf.value : [nextKf.value];
            // easing would be handled here
        }
        
        keyframes.push(key);
    }
    
    // Lottie requires a final keyframe without an end value
    if (keyframes.length > 0) {
      delete keyframes[keyframes.length - 1].e;
    }

    return { k: keyframes };
}


export function toLottieDraft(
  model: TimelineModel,
  objects: Record<string, SvgObject>,
  canvasSize: { width: number, height: number }
): LottieDraft {
  const op = toLottieFrames(model.durationMs, model.fps);
  const lottieLayers: LottieLayer[] = [];

  for (const layerTrack of model.layers) {
    const obj = objects[layerTrack.objectId];
    if (!obj) continue;

    const findTrack = (id: PropertyId): PropertyTrack => 
        layerTrack.properties.find(p => p.id === id) || { id, keyframes: [] };

    const positionKeys: {x?: PropertyTrack, y?: PropertyTrack} = {
        x: findTrack('x'),
        y: findTrack('y'),
    };
    
    // This is a simplified position conversion. Lottie handles separated x/y dimensions.
    // For this stub, we'll just use the keyframes from 'x' and 'y' if they exist.
    // A full implementation would need to combine these tracks.
    const posKeyframes: LottieKeyframe[] = [];
    const pTrack = positionKeys.x?.keyframes.length > positionKeys.y?.keyframes.length ? positionKeys.x : positionKeys.y;

    for (let i = 0; i < pTrack.keyframes.length; i++) {
        const kfX = positionKeys.x?.keyframes[i] || { value: obj.x, timeMs: pTrack.keyframes[i].timeMs };
        const kfY = positionKeys.y?.keyframes[i] || { value: obj.y, timeMs: pTrack.keyframes[i].timeMs };
        posKeyframes.push({
            t: toLottieFrames(kfX.timeMs, model.fps),
            s: [Number(kfX.value), Number(kfY.value)]
        });
    }

    const lottieLayer: LottieLayer = {
        nm: obj.name || obj.id,
        ty: 4, // Shape layer
        ip: 0,
        op: op,
        st: 0,
        sr: 1,
        ks: {
            // Anchor point needs to be converted to pixels and relative to layer
            a: { k: [0, 0] }, 
            // Position
            p: posKeyframes.length > 1 ? { k: posKeyframes } : { k: [obj.x, obj.y] },
            // Scale
            s: { k: [ (obj.scaleX ?? 1) * 100, (obj.scaleY ?? 1) * 100] }, // Lottie scale is percentage
             // Rotation
            r: propertyToLottie('rotation', findTrack('rotation'), model.fps, obj.rotation),
            // Opacity
            o: propertyToLottie('opacity', findTrack('opacity'), model.fps, (obj.opacity ?? 1) * 100),
        },
    };
    lottieLayers.push(lottieLayer);
  }

  return {
    fr: model.fps,
    ip: 0,
    op: op,
    w: canvasSize.width,
    h: canvasSize.height,
    layers: lottieLayers,
  };
}
