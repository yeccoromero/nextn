'use client';

import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { cn } from '@/lib/utils';
import { Play, Pause, Anchor, Lock, Unlock } from 'lucide-react';

interface Point { x: number; y: number }

interface BezierEditorProps {
    value?: { x1: number; y1: number; x2: number; y2: number };
    onChange?: (val: { x1: number; y1: number; x2: number; y2: number }) => void;
    onClose?: () => void;
    className?: string; // Additional classes
    style?: React.CSSProperties; // Position
}

// Cubic Bezier Derivative (Velocity)
function getVelocity(p1: Point, p2: Point, t: number): number {
    const dx = 3 * Math.pow(1 - t, 2) * p1.x +
        6 * (1 - t) * t * (p2.x - p1.x) +
        3 * Math.pow(t, 2) * (1 - p2.x);

    const dy = 3 * Math.pow(1 - t, 2) * p1.y +
        6 * (1 - t) * t * (p2.y - p1.y) +
        3 * Math.pow(t, 2) * (1 - p2.y);

    if (dx === 0) return 0;
    return dy / dx;
}

// Value Solver
function solveCubicBezier(p1: Point, p2: Point, t: number): number {
    const cx = 3 * p1.x;
    const bx = 3 * (p2.x - p1.x) - cx;
    const ax = 1 - cx - bx;

    const cy = 3 * p1.y;
    const by = 3 * (p2.y - p1.y) - cy;
    const ay = 1 - cy - by;

    const solveX = (x: number) => {
        let t2 = x;
        for (let i = 0; i < 8; i++) {
            const x2 = ((ax * t2 + bx) * t2 + cx) * t2;
            const d = (3 * ax * t2 + 2 * bx) * t2 + cx;
            if (Math.abs(d) < 1e-6) break;
            t2 -= (x2 - x) / d;
        }
        return t2;
    };

    const time = solveX(t);
    return ((ay * time + by) * time + cy) * time;
}

export function BezierEditor({ value, onChange, onClose, className, style }: BezierEditorProps) {
    const [p1, setP1] = useState<Point>(value ? { x: value.x1, y: value.y1 } : { x: 0.25, y: 0.1 });
    const [p2, setP2] = useState<Point>(value ? { x: value.x2, y: value.y2 } : { x: 0.25, y: 1.0 });
    const [isPlaying, setIsPlaying] = useState(false);
    const [previewT, setPreviewT] = useState(0);
    const [showSpeed, setShowSpeed] = useState(true);

    // Default to Horizontal Lock enabled for "Easy Ease" workflow
    // Unless we detect "Broken" curve on load
    const [lockHorizontal, setLockHorizontal] = useState(true);

    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const draggingRef = useRef<'p1' | 'p2' | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [hoveredHandle, setHoveredHandle] = useState<'p1' | 'p2' | null>(null);

    const rafRef = useRef<number>();

    const [safeStyle, setSafeStyle] = useState<React.CSSProperties>(style || {});

    useEffect(() => {
        if (value) {
            setP1({ x: value.x1, y: value.y1 });
            setP2({ x: value.x2, y: value.y2 });

            // Auto-detect if broken
            const isFlatStart = Math.abs(value.y1 - 0) < 0.05;
            const isFlatEnd = Math.abs(value.y2 - 1) < 0.05;
            if (!isFlatStart || !isFlatEnd) {
                setLockHorizontal(false);
            }
        }
    }, [value]);

    useLayoutEffect(() => {
        if (!containerRef.current || !style) return;
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width === 0) return;

        const pad = 12;
        let left = parseFloat(style.left as string) || 0;
        let top = parseFloat(style.top as string) || 0;

        if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
        if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
        if (left < pad) left = pad;
        if (top < pad) top = pad;

        setSafeStyle({ ...style, left, top });
    }, [style?.left, style?.top]);

    // Preview Loop
    useEffect(() => {
        if (!isPlaying) {
            cancelAnimationFrame(rafRef.current!);
            return;
        }
        let start = performance.now();
        const duration = 1500;

        const frame = (now: number) => {
            const elapsed = now - start;
            let t = elapsed / duration;
            if (t > 1) {
                t = 0;
                start = now + 500;
            }
            setPreviewT(Math.min(1, Math.max(0, t)));
            rafRef.current = requestAnimationFrame(frame);
        };
        rafRef.current = requestAnimationFrame(frame);
        return () => cancelAnimationFrame(rafRef.current!);
    }, [isPlaying]);

    const handlePointerDown = (e: React.PointerEvent, handle: 'p1' | 'p2') => {
        e.stopPropagation();
        e.preventDefault();
        (e.target as Element).setPointerCapture(e.pointerId);
        draggingRef.current = handle;
        setIsDragging(true);
        setHoveredHandle(handle); // Force hover state during drag
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!draggingRef.current || !svgRef.current) return;
        e.stopPropagation();

        const rect = svgRef.current.getBoundingClientRect();
        const svgW = rect.width;
        const svgH = rect.height;

        const pad = 40;
        const w = 220;
        const h = 220;
        const viewBoxSize = 300;

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const vbX = mouseX * (viewBoxSize / svgW);
        const vbY = mouseY * (viewBoxSize / svgH);

        let x = (vbX - pad) / w;
        let y = 1 - ((vbY - pad) / h);

        x = Math.max(0, Math.min(1, x));

        // Y Logic: If Locked, force flat.
        if (lockHorizontal) {
            if (draggingRef.current === 'p1') y = 0;
            else y = 1;
        }

        // Snapping
        if (Math.abs(x - 0) < 0.05) x = 0;
        if (Math.abs(x - 1) < 0.05) x = 1;
        if (!lockHorizontal) {
            if (Math.abs(y - 0.5) < 0.05) y = 0.5;
            if (Math.abs(y - 0) < 0.05) y = 0;
            if (Math.abs(y - 1) < 0.05) y = 1;
        }

        const newVal = { x, y };

        if (draggingRef.current === 'p1') {
            setP1(newVal);
            onChange?.({ x1: newVal.x, y1: newVal.y, x2: p2.x, y2: p2.y });
        } else {
            setP2(newVal);
            onChange?.({ x1: p1.x, y1: p1.y, x2: newVal.x, y2: newVal.y });
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        e.stopPropagation();
        draggingRef.current = null;
        setIsDragging(false);
        (e.target as Element).releasePointerCapture(e.pointerId);
    };

    // SVG Coords
    const pad = 40;
    const w = 220;
    const h = 220;
    const baselineY = pad + h;

    const toSvg = (pt: Point) => ({
        x: pad + pt.x * w,
        y: pad + h - (pt.y * h)
    });

    const start = toSvg({ x: 0, y: 0 });
    const end = toSvg({ x: 1, y: 1 });
    const cp1 = toSvg(p1);
    const cp2 = toSvg(p2);
    const easedVal = solveCubicBezier(p1, p2, previewT);

    // Speed Path Calc
    const speedPath = React.useMemo(() => {
        let d = `M ${pad} ${baselineY}`;
        const steps = 50;
        let maxV = 0;
        const points = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const v = getVelocity(p1, p2, t);
            const cx = 3 * p1.x;
            const bx = 3 * (p2.x - p1.x) - cx;
            const ax = 1 - cx - bx;
            const xVal = ((ax * t + bx) * t + cx) * t;
            points.push({ x: xVal, v });
            if (v > maxV) maxV = v;
        }
        const scaleY = maxV > 0.1 ? (1 / Math.max(2.5, maxV)) : 1;
        points.forEach(pt => {
            const sx = pad + pt.x * w;
            const sy = baselineY - (pt.v * scaleY * h);
            d += ` L ${sx} ${sy}`;
        });
        d += ` L ${pad + w} ${baselineY} Z`;
        return d;
    }, [p1, p2]);

    const presets = [
        { label: 'Linear', p1: { x: 0, y: 0 }, p2: { x: 1, y: 1 } },
        { label: 'Ease In', p1: { x: 0.42, y: 0 }, p2: { x: 1, y: 1 } },
        { label: 'Ease Out', p1: { x: 0, y: 0 }, p2: { x: 0.58, y: 1 } },
        { label: 'Ease InOut', p1: { x: 0.42, y: 0 }, p2: { x: 0.58, y: 1 } },
    ];

    return (
        <div
            ref={containerRef}
            className={cn("bg-[#1e1e1e] border border-[#333] rounded-lg shadow-2xl flex flex-col w-[350px] overflow-hidden select-none font-sans fixed", className)}
            style={safeStyle}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div className="flex justify-between items-center px-3 py-2 border-b border-[#333] bg-[#252525] draggable cursor-move">
                <div className="flex flex-col">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-0.5">SEGMENT</h4>
                    <span className="text-xs font-bold text-gray-200">Keyframe A ➞ Keyframe B</span>
                </div>

                <div className="flex gap-2 items-center">
                    {lockHorizontal && <span className="text-[9px] bg-yellow-400/10 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-400/20 font-mono tracking-tighter">EASY EASE</span>}

                    <div className="h-4 w-px bg-[#444] mx-1"></div>

                    <button
                        title={lockHorizontal ? "Unlock Handles (Break Curves)" : "Lock Handles (Easy Ease)"}
                        onClick={() => {
                            const newLock = !lockHorizontal;
                            setLockHorizontal(newLock);
                            // If locking, snap to nearest flat
                            if (newLock) {
                                setP1(curr => ({ ...curr, y: 0 }));
                                setP2(curr => ({ ...curr, y: 1 }));
                                onChange?.({ x1: p1.x, y1: 0, x2: p2.x, y2: 1 });
                            }
                        }}
                        className={cn("hover:text-white px-1", lockHorizontal ? "text-yellow-400" : "text-gray-500")}
                    >
                        {lockHorizontal ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                    <button onClick={() => setIsPlaying(!isPlaying)} className={cn("hover:text-white px-1", isPlaying ? "text-green-400" : "text-gray-400")}>
                        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                    </button>
                    <button onClick={onClose} className="hover:text-red-400 text-gray-500 hover:bg-white/5 rounded-sm p-0.5 ml-1 transition-colors">✕</button>
                </div>
            </div>

            <div className="relative p-2 bg-[#111]">
                {/* Top track */}
                <div className="h-1 w-full bg-[#333] rounded-full mb-2 overflow-hidden relative">
                    <div
                        className="absolute top-0 bottom-0 left-0 bg-green-500 w-2 h-full rounded-full transition-none shadow-[0_0_10px_#22c55e]"
                        style={{ left: `${easedVal * 100}%` }}
                    />
                </div>

                <svg
                    className="w-full aspect-square cursor-crosshair touch-none bg-[#1a1a1a] rounded border border-[#333]"
                    viewBox="0 0 300 300"
                    ref={svgRef}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                >
                    <defs>
                        <pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse">
                            <path d="M 22 0 L 0 0 0 22" fill="none" stroke="#333" strokeWidth="0.5" />
                        </pattern>
                    </defs>
                    <rect x={pad} y={pad} width={w} height={h} fill="url(#grid)" />

                    {/* Speed Graph Overlay */}
                    {showSpeed && (
                        <path d={speedPath} fill="white" fillOpacity="0.05" stroke="white" strokeWidth="1" strokeOpacity="0.2" />
                    )}

                    {/* Frame/Axes */}
                    <line x1={pad} y1={pad + h} x2={pad + w} y2={pad + h} stroke="#666" strokeWidth="2" />
                    <line x1={pad} y1={pad + h} x2={pad} y2={pad} stroke="#666" strokeWidth="2" />

                    {/* Linear Reference */}
                    <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#444" strokeDasharray="4 4" opacity="0.5" />

                    {/* Start/End Square Anchors */}
                    <rect x={start.x - 5} y={start.y - 5} width="10" height="10" fill="#eab308" stroke="#000" strokeWidth="1" />
                    <rect x={end.x - 5} y={end.y - 5} width="10" height="10" fill="#eab308" stroke="#000" strokeWidth="1" />

                    {/* Labels for KF */}
                    <text x={start.x - 15} y={start.y + 5} fill="#666" fontSize="9" fontFamily="monospace" textAnchor="end">A</text>
                    <text x={end.x + 15} y={end.y + 5} fill="#666" fontSize="9" fontFamily="monospace" textAnchor="start">B</text>

                    {/* Handles Lines */}
                    <line x1={start.x} y1={start.y} x2={cp1.x} y2={cp1.y} stroke="#eab308" strokeWidth="1" opacity="0.8" />
                    <line x1={end.x} y1={end.y} x2={cp2.x} y2={cp2.y} stroke="#eab308" strokeWidth="1" opacity="0.8" />

                    {/* Value Path - Draw Last to be on top of speed graph */}
                    <path
                        d={`M ${start.x},${start.y} C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${end.x},${end.y}`}
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="3"
                    //   strokeLinecap="round"
                    />

                    {/* Playhead Ball */}
                    {isPlaying && (
                        <circle
                            cx={pad + previewT * w}
                            cy={pad + h - (easedVal * h)}
                            r="4"
                            fill="white"
                            stroke="#22c55e" strokeWidth="2"
                            className="shadow-glow"
                        />
                    )}

                    {/* Interactive Handles Layer */}
                    {/* Visual P1 */}
                    <circle
                        cx={cp1.x} cy={cp1.y} r="5"
                        fill="#1e1e1e" stroke="#eab308" strokeWidth="2"
                        className={cn(
                            "pointer-events-none transition-transform duration-100 origin-center",
                            (hoveredHandle === 'p1' || draggingRef.current === 'p1') && "scale-150 border-white"
                        )}
                        style={{ transformBox: 'fill-box' }}
                    />
                    {/* Hit P1 */}
                    <circle
                        cx={cp1.x} cy={cp1.y} r="15"
                        fill="transparent"
                        className="cursor-pointer"
                        onPointerDown={(e) => handlePointerDown(e, 'p1')}
                        onPointerEnter={() => setHoveredHandle('p1')}
                        onPointerLeave={() => setHoveredHandle(null)}
                    />

                    {/* Visual P2 */}
                    <circle
                        cx={cp2.x} cy={cp2.y} r="5"
                        fill="#1e1e1e" stroke="#eab308" strokeWidth="2"
                        className={cn(
                            "pointer-events-none transition-transform duration-100 origin-center",
                            (hoveredHandle === 'p2' || draggingRef.current === 'p2') && "scale-150"
                        )}
                        style={{ transformBox: 'fill-box' }}
                    />
                    {/* Hit P2 */}
                    <circle
                        cx={cp2.x} cy={cp2.y} r="15"
                        fill="transparent"
                        className="cursor-pointer"
                        onPointerDown={(e) => handlePointerDown(e, 'p2')}
                        onPointerEnter={() => setHoveredHandle('p2')}
                        onPointerLeave={() => setHoveredHandle(null)}
                    />

                    {/* INFLUENCE LABELS */}
                    {/* Outgoing (Bottom Left) */}
                    <text x={pad + 10} y={pad + h - 10} fill="#eab308" fontSize="10" fontFamily="monospace" opacity="0.8">
                        OUT: {(p1.x * 100).toFixed(0)}%
                    </text>

                    {/* Incoming (Top Right) */}
                    <text x={pad + w - 50} y={pad + 20} fill="#eab308" fontSize="10" fontFamily="monospace" opacity="0.8">
                        IN: {((1 - p2.x) * 100).toFixed(0)}%
                    </text>
                </svg>
            </div>

            <div className="bg-[#252525] border-t border-[#333] p-2 flex gap-2 overflow-x-auto">
                {presets.map(pre => (
                    <button
                        key={pre.label}
                        onClick={() => {
                            setP1(pre.p1);
                            setP2(pre.p2);
                            setLockHorizontal(pre.label !== 'Linear'); // Auto-lock for eases
                            onChange?.({ x1: pre.p1.x, y1: pre.p1.y, x2: pre.p2.x, y2: pre.p2.y });
                        }}
                        className="px-2 py-1 bg-[#333] hover:bg-[#444] text-[10px] text-gray-300 rounded whitespace-nowrap"
                    >
                        {pre.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
