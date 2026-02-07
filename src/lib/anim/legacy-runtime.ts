
// src/lib/anim/legacy-runtime.ts
import anime, { type AnimeTimelineInstance } from 'animejs';
import type { EasingId, PropertyId, TimelineSpec, SvgObject, Keyframe as AnimKeyframe, ApplyPatch, Clip } from '@/types/editor';
import { rotateAroundWorldPivot, scaleAroundWorldPivot } from '@/lib/geometry';
import { getWorldAnchor, localToWorld, worldToLocal, getWorldRotation, getWorldScale, getLocalAnchor } from '@/lib/editor-utils';
import { interpColor } from '@/lib/color-utils';

export type { ApplyPatch, TimelineSpec } from '@/types/editor';

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

const HANDLED_TRANSFORM_PROPS = new Set(['position', 'x', 'y', 'scale', 'scaleX', 'scaleY', 'rotation']);

function getDepth(objectId: string, objects: Record<string, SvgObject>): number {
    let depth = 0;
    let current = objects[objectId];
    while (current?.parentId && objects[current.parentId]) {
        depth++;
        current = objects[current.parentId];
    }
    return depth;
}

export function easeValueLegacy(easing: EasingId | undefined, t: number): number {
    const fn = EASING_FN[easing as string] ?? EASING_FN.linear;
    return fn(t);
}

export function getValueAtTimeLegacy<T>(keyframes: AnimKeyframe[] | undefined, timeMs: number, defaultValue: T): T {
    if (!keyframes || keyframes.length === 0) return defaultValue;

    const first = keyframes[0];
    if (timeMs <= first.timeMs) return first.value as T;

    const last = keyframes[keyframes.length - 1];
    if (timeMs >= last.timeMs) return last.value as T;

    // Binary search to find the correct segment
    let low = 0;
    let high = keyframes.length - 1;
    let segmentStartIndex = 0;

    while (low <= high) {
        const mid = Math.floor(low + (high - low) / 2);
        if (keyframes[mid].timeMs <= timeMs) {
            segmentStartIndex = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    const a = keyframes[segmentStartIndex];
    const b = keyframes[segmentStartIndex + 1];

    if (!a || !b) return defaultValue;

    const segmentDuration = b.timeMs - a.timeMs;
    // Clamp duration to prevent division by zero or issues with negative time
    if (segmentDuration <= 0) return a.value as T;

    // Handle HOLD interpolation (Step)
    if (a.interpolation === 'hold') {
        return a.value as T;
    }

    const t = (timeMs - a.timeMs) / segmentDuration;

    let k = t;
    // Handle EASE interpolation
    if (a.interpolation === 'ease') {
        // Use specified easing or default to inOutQuad for smoothness
        k = easeValueLegacy(a.easing || 'inOutQuad', t);
    }
    // Handle LINEAR (dEfault)
    else {
        k = t; // linear is default
    }

    // Color interpolation
    if (typeof a.value === 'string' && typeof b.value === 'string') {
        // interpColor is designed to be safe and fallback to black on parse error
        return interpColor(a.value, b.value, k) as T;
    }

    // Number interpolation
    if (typeof a.value === 'number' && typeof b.value === 'number') {
        return (a.value + (b.value - a.value) * k) as T;
    }

    // Vector ({x, y}) interpolation
    const isPointA = typeof a.value === 'object' && a.value !== null && typeof (a.value as any).x === 'number' && typeof (a.value as any).y === 'number';
    const isPointB = typeof b.value === 'object' && b.value !== null && typeof (b.value as any).x === 'number' && typeof (b.value as any).y === 'number';

    if (isPointA && isPointB) {
        const valA = a.value as { x: number, y: number };
        const valB = b.value as { x: number, y: number };
        return {
            x: valA.x + (valB.x - valA.x) * k,
            y: valA.y + (valB.y - valA.y) * k
        } as T;
    }

    // Fallback: If types mismatch or are not interpolatable, return the start value of the segment (step interpolation).
    return a.value as T;
}


export type RuntimeOptions = {
    apply: (batch: ApplyPatch[]) => void;
    onUpdate?: (t: { currentTimeMs: number; durationMs: number; progress: number }) => void;
    onComplete?: () => void;
    getObjects: () => Record<string, SvgObject>;
    defaults?: { ease?: EasingId; loop?: boolean | number };
};

export class AnimeRuntimeApplyLegacy {
    private tl: AnimeTimelineInstance | null = null;
    private spec: TimelineSpec | null = null;
    public opts: RuntimeOptions;
    private workArea: { startMs: number, endMs: number } | null = null;
    private isLooping = false;
    private lastDisplayTime = 0;
    private internalDurationMs = 0;

    constructor(opts: RuntimeOptions) {
        this.opts = opts;
        this.isLooping = !!this.opts.defaults?.loop;
    }

    private toInternalTime(displayMs: number, duration: number): number {
        const useWA = !!this.workArea;
        if (!useWA) return Math.max(0, Math.min(displayMs, duration));
        const { startMs, endMs } = this.workArea!;
        const len = Math.max(1, endMs - startMs);
        return Math.max(0, Math.min(displayMs - startMs, len));
    }

    private fromInternalTime(internalMs: number): number {
        const useWA = !!this.workArea;
        if (!useWA) return internalMs;
        const { startMs } = this.workArea!;
        return startMs + internalMs;
    }

    load(spec: TimelineSpec, preserveTime = true) {
        const wasPlaying = this.tl ? !this.tl.paused : false;
        const prevDisplay = this.lastDisplayTime;

        this.dispose();
        this.spec = spec;

        const fullDuration = Math.max(1, spec.durationMs | 0);
        const useWA = !!this.workArea;
        const waLen = useWA ? Math.max(1, this.workArea!.endMs - this.workArea!.startMs) : fullDuration;
        this.internalDurationMs = waLen;

        const driver = { t: 0 };

        this.tl = anime.timeline({
            autoplay: false,
            loop: this.isLooping, // use the internal looping state
            duration: waLen,
            update: (self: any) => {
                const raw = (self.currentTime as number) || 0;
                const internal = raw % waLen;
                const display = this.fromInternalTime(internal);
                this.updateFrame(display);
            },
            complete: () => {
                if (!this.isLooping) {
                    this.opts.onComplete?.();
                }
            }
        });

        this.tl.add({ targets: driver, t: 1, duration: waLen, easing: 'linear' }, 0);

        const startDisplay = preserveTime ? prevDisplay : (this.workArea?.startMs ?? 0);
        const safeStart = this.workArea
            ? Math.min(Math.max(startDisplay, this.workArea.startMs), this.workArea.endMs - 1)
            : startDisplay;

        this.seek(safeStart);

        if (wasPlaying) this.tl.play();
    }

    updateFrame(timeMs: number) {
        if (!this.spec) return;

        this.lastDisplayTime = timeMs;

        this.opts.onUpdate?.({
            currentTimeMs: timeMs,
            durationMs: this.spec.durationMs,
            progress: this.workArea
                ? (timeMs - this.workArea.startMs) / (this.workArea.endMs - this.workArea.startMs || 1)
                : (timeMs / (this.spec.durationMs || 1)),
        });

        const objects = this.opts.getObjects();
        const batch: ApplyPatch[] = [];

        const animatedObjectIds = new Set<string>();
        const tracksByObject: Record<string, Record<string, any>> = {};
        for (const track of this.spec.tracks) {
            animatedObjectIds.add(track.objectId);
            if (!tracksByObject[track.objectId]) tracksByObject[track.objectId] = {};
            tracksByObject[track.objectId][track.propertyId] = track;
        }

        if (animatedObjectIds.size === 0) {
            return;
        }

        const animatedSnapshot: Record<string, Partial<SvgObject>> = {};
        animatedObjectIds.forEach(objId => {
            const obj = objects[objId];
            if (!obj) return;
            const snapshot = animatedSnapshot[objId] ?? (animatedSnapshot[objId] = {});
            const objTracks = tracksByObject[objId] ?? {};
            for (const propId in objTracks) {
                const track = objTracks[propId];
                const timeForTrack = timeMs - (track.startMs || 0);

                let defaultValue: any = (obj as any)[propId];
                if (propId === 'position' && defaultValue === undefined) {
                    defaultValue = { x: obj.x ?? 0, y: obj.y ?? 0 };
                } else if (propId === 'scale' && defaultValue === undefined) {
                    defaultValue = { x: obj.scaleX ?? 1, y: obj.scaleY ?? 1 };
                }
                (snapshot as any)[propId] = getValueAtTimeLegacy(track.keyframes, timeForTrack, defaultValue);
            }
        });

        const frameObjects: Record<string, SvgObject> = {};
        const orderedObjectIds = Array.from(animatedObjectIds).sort((a, b) => getDepth(a, objects) - getDepth(b, objects));

        for (const objectId of orderedObjectIds) {
            const obj = objects[objectId];
            if (!obj) continue;

            const base = animatedSnapshot[objectId]!;

            const objectsPrime = { ...objects, ...frameObjects };
            const parentFrame = obj.parentId ? objectsPrime[obj.parentId] : null;

            let state: SvgObject = { ...obj };
            let patch: Partial<SvgObject> = {};

            const objTracks = tracksByObject[objectId] ?? {};

            // --- Start of transform calculations ---

            // 1. Scale (`scale` has precedence over `scaleX`/`scaleY`)
            const scaleProp = objTracks.scale ? 'scale' : (objTracks.scaleX || objTracks.scaleY ? 'scaleX/Y' : null);
            if (scaleProp) {
                const targetScaleX = scaleProp === 'scale' ? (base.scale as { x: number, y: number }).x : (objTracks.scaleX ? base.scaleX as number : state.scaleX ?? 1);
                const targetScaleY = scaleProp === 'scale' ? (base.scale as { x: number, y: number }).y : (objTracks.scaleY ? base.scaleY as number : state.scaleY ?? 1);
                const pivotWorld = getWorldAnchor(state, objectsPrime);
                const sUpdates = scaleAroundWorldPivot(state, targetScaleX, targetScaleY, pivotWorld, objectsPrime);
                patch = { ...patch, ...sUpdates };
                state = { ...state, ...sUpdates };
            }

            // 2. Rotation
            if (objTracks.rotation) {
                const targetRot = (base.rotation ?? state.rotation ?? 0) as number;
                const pivotWorld = getWorldAnchor(state, objectsPrime); // uses updated state from scale
                const rUpdates = rotateAroundWorldPivot(state, targetRot, pivotWorld, objectsPrime);
                patch = { ...patch, ...rUpdates };
                state = { ...state, ...rUpdates }; // Update state for subsequent calculations
            }

            // 3. Position (`position` track has precedence)
            if (objTracks.position) {
                const posLocal = base.position as { x: number; y: number };
                (patch as SvgObject).x = posLocal.x;
                (patch as SvgObject).y = posLocal.y;
            } else {
                // legacy support (optional)
                if (objTracks.x) (patch as SvgObject).x = (base as any).x as number;
                if (objTracks.y) (patch as SvgObject).y = (base as any).y as number;
            }

            // --- End of transform calculations ---

            // 4. Other animatable properties
            for (const propId in objTracks) {
                if (!HANDLED_TRANSFORM_PROPS.has(propId)) {
                    (patch as any)[propId] = (base as any)[propId];
                }
            }

            frameObjects[objectId] = { ...state, ...patch };

            if (Object.keys(patch).length) {
                batch.push({ objectId, patch });
            }
        }

        if (batch.length > 0) this.opts.apply(batch);
    }


    play() {
        if (!this.tl) return;
        this.tl.play();
    }

    pause() {
        if (!this.tl) return;
        this.tl.pause();
    }

    stop() {
        if (!this.tl) return;
        this.tl.pause();
        this.seek(this.workArea?.startMs ?? 0);
    }

    seek(displayMs: number) {
        if (this.tl) {
            const fullDuration = this.spec?.durationMs ?? 0;
            const internal = this.toInternalTime(displayMs, fullDuration);
            this.tl.seek(internal);
        }
        this.updateFrame(displayMs);
    }

    setWorkArea(range: { startMs: number; endMs: number } | null) {
        this.workArea = range && range.endMs > range.startMs ? range : null;
        if (this.spec) this.load(this.spec, true);
    }

    setLoop(loop: boolean) {
        this.isLooping = !!loop;
        if (this.tl) {
            this.tl.loop = this.isLooping;
        }
    }

    setRate(rate: number) {
        if (this.tl) {
            this.tl.speed = rate;
        }
    }

    get currentTime() {
        return this.lastDisplayTime;
    }

    get duration() { return this.spec?.durationMs ?? 0; }
    get isPlaying() { return this.tl ? !this.tl.paused : false; }
    dispose() { try { (this.tl as any)?.pause?.(); } catch { } this.tl = null; }
}
