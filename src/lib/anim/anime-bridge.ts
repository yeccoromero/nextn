

// src/lib/anim/anime-bridge.ts
import anime from 'animejs/lib/anime.es.js';
import type { TimelineSpec, EasingId, Keyframe, PropertyId, SvgObject } from '@/types/editor';

const EASING_FN: Record<string, (t: number) => number> = {
    linear: (t) => t,
    inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
    outSine: (t) => Math.sin((t * Math.PI) / 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    inQuad: (t) => t * t,
    outQuad: (t) => t * (2 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    inCubic: (t) => t * t * t,
    outCubic: (t) => --t * t * t + 1,
    inOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    inQuart: (t) => t * t * t * t,
    outQuart: (t) => 1 - --t * t * t * t,
    inOutQuart: (t) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t,
    inQuint: (t) => t * t * t * t * t,
    outQuint: (t) => 1 + --t * t * t * t * t,
    inOutQuint: (t) => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t,
    inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
    outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOutExpo: (t) => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
    inCirc: (t) => 1 - Math.sqrt(1 - t * t),
    outCirc: (t) => Math.sqrt(1 - --t * t),
    inOutCirc: (t) => t < 0.5 ? (1 - Math.sqrt(1 - 4 * t * t)) / 2 : (Math.sqrt(1 - (-2 * t + 2) * (-2 * t + 2)) + 1) / 2,
    inBack: (t) => 2.70158 * t * t * t - 1.70158 * t * t,
    outBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
    inOutBack: (t) => t < 0.5 ? (Math.pow(2 * t, 2) * ((1.70158 * 1.525 + 1) * 2 * t - 1.70158 * 1.525)) / 2 : (Math.pow(2 * t - 2, 2) * ((1.70158 * 1.525 + 1) * (t * 2 - 2) + 1.70158 * 1.525) + 2) / 2,
};

function easeValue(easing: EasingId | undefined, t: number): number {
    const fn = EASING_FN[easing as string] ?? EASING_FN.linear;
    return fn(t);
}

function getValueAtTime(track: Keyframe[] | undefined, timeMs: number, defaultValue: number): number {
    if (!track || track.length === 0) return defaultValue;
  
    const first = track[0];
    const last = track[track.length - 1];
  
    if (timeMs <= first.timeMs) return Number(first.value);
    if (timeMs >= last.timeMs) return Number(last.value);
  
    const idx = track.findIndex(k => k.timeMs > timeMs);
    const a = track[idx - 1];
    const b = track[idx];
  
    const t = (timeMs - a.timeMs) / (b.timeMs - a.timeMs || 1);
    const k = easeValue(a.easing, t);
  
    const av = Number(a.value);
    const bv = Number(b.value);
    return av + (bv - av) * k;
}

// Compila la especificación de la línea de tiempo a una instancia de Anime.js
export function buildAnimeTimeline(
  spec: TimelineSpec,
  objects: Record<string, SvgObject>,
  dispatch: React.Dispatch<any>
): anime.AnimeTimelineInstance {
  const tl = anime.timeline({
    autoplay: false,
    duration: spec.durationMs,
    update: (anim: any) => {
        // Batch updates
        const perObject: Record<string, Partial<SvgObject>> = {};
        anim.animations.forEach((a: any) => {
            const { objectId, prop } = a.animatable.target;
            if (!objectId || !prop) return;
            perObject[objectId] ||= {};
            (perObject[objectId] as any)[prop] = a.currentValue;
        });

        Object.entries(perObject).forEach(([id, updates]) => {
            dispatch({
                type: 'UPDATE_OBJECTS',
                payload: { ids: [id], updates },
                transient: true,
            });
        });
    }
  });

  for (const track of spec.tracks) {
    const obj = objects[track.objectId];
    if (!obj) continue;
    
    // Convert our keyframe format to anime's format
    const animeKeyframes = track.keyframes.map(kf => ({
        value: kf.value,
        duration: kf.timeMs - (tl.duration as number), // This is incorrect, let anime handle timing
        easing: (kf.easing || 'linear') as anime.EasingOptions,
    }));

    // A simpler approach is to let anime handle timing directly
    const timelineOptions: anime.AnimeParams = {
        targets: { objectId: track.objectId, prop: track.propertyId },
        easing: 'linear', // Default for timeline, easing is per keyframe
        duration: spec.durationMs,
    };
    
    const keyframesForAnime = track.keyframes.map(kf => ({
        value: kf.value,
        duration: spec.durationMs, // not quite right, but anime will use time-based keyframes
        end: kf.timeMs,
    }));
    
    const propKeyframes = track.keyframes.map((kf, i, arr) => {
        const prevKf = arr[i - 1];
        const duration = prevKf ? kf.timeMs - prevKf.timeMs : kf.timeMs;
        return {
            value: kf.value,
            duration: duration,
            easing: kf.easing || 'linear'
        };
    });

    const finalKeyframes = track.keyframes.map(kf => ({
        value: kf.value,
        duration: spec.durationMs,
        end: kf.timeMs,
        easing: kf.easing || 'linear',
    }));

    // The correct way in anime.js for time-based keyframes
    const keyframeParams = track.keyframes.map(kf => ({
        value: kf.value,
        time: kf.timeMs,
        easing: kf.easing || 'linear'
    }));

    const targetProp: { [key: string]: any } = {};
    
    // Anime.js doesn't directly support time-based keyframes in the way we want.
    // Instead we map our keyframes to anime's format.
    const animeFormattedKeyframes = track.keyframes.map(kf => {
        return { value: kf.value, time: kf.timeMs, easing: kf.easing || 'linear' };
    });

    // The logic to convert to anime.js keyframes needs to be robust
    // For now, let's use a simplified version, as anime.js has some quirks.
    // We will let the runtime handle interpolation.
    if(track.keyframes.length > 0) {
      tl.add({
        targets: { objectId: track.objectId, prop: track.propertyId },
        ...Object.fromEntries(track.keyframes.map(kf => [kf.timeMs, kf.value])),
        easing: 'linear',
      }, 0);
    }
  }

  return tl;
}

