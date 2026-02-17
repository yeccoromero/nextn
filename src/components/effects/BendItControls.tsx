"use client";

import React, { useState, useCallback } from "react";
import { SliderInput } from "@/components/editor/slider-input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { degToRad, radToDeg } from "@/lib/effects/bend-math";
import type { BendParams, Vec2 } from "@/lib/effects/bend-math";

export type BendItControlsProps = {
    params: BendParams;
    onChange: (params: BendParams) => void;
    onCommit?: () => void;
};

/**
 * UI Controls for CC Bend It effect.
 * Matches existing editor panel design (SliderInput, Select, etc.)
 */
export function BendItControls({
    params,
    onChange,
    onCommit,
}: BendItControlsProps) {
    const bendDeg = radToDeg(params.theta);

    const update = useCallback(
        (partial: Partial<BendParams>) => {
            onChange({ ...params, ...partial });
        },
        [params, onChange]
    );

    const handleBendChange = useCallback(
        (v: number) => update({ theta: degToRad(v) }),
        [update]
    );

    const handleStartX = useCallback(
        (v: number) => update({ start: { ...params.start, x: v } }),
        [update, params.start]
    );

    const handleStartY = useCallback(
        (v: number) => update({ start: { ...params.start, y: v } }),
        [update, params.start]
    );

    const handleEndX = useCallback(
        (v: number) => update({ end: { ...params.end, x: v } }),
        [update, params.end]
    );

    const handleEndY = useCallback(
        (v: number) => update({ end: { ...params.end, y: v } }),
        [update, params.end]
    );

    return (
        <div className="space-y-4">
            <div>
                <p className="text-xs font-bold mb-2">Bend It</p>
                <div className="space-y-2">
                    {/* Bend Amount */}
                    <SliderInput
                        tooltip="Bend Amount (degrees)"
                        prefix="B"
                        id="bend-amount"
                        name="bend-amount"
                        value={Math.round(bendDeg)}
                        onChange={handleBendChange}
                        onCommit={onCommit}
                        min={-360}
                        max={360}
                    />

                    {/* Start Point */}
                    <p className="text-[10px] text-muted-foreground mt-2">Start Point</p>
                    <div className="grid grid-cols-2 gap-1">
                        <SliderInput
                            tooltip="Start X"
                            prefix="SX"
                            value={Math.round(params.start.x)}
                            onChange={handleStartX}
                            onCommit={onCommit}
                            min={-2000}
                            max={4000}
                        />
                        <SliderInput
                            tooltip="Start Y"
                            prefix="SY"
                            value={Math.round(params.start.y)}
                            onChange={handleStartY}
                            onCommit={onCommit}
                            min={-2000}
                            max={4000}
                        />
                    </div>

                    {/* End Point */}
                    <p className="text-[10px] text-muted-foreground mt-2">End Point</p>
                    <div className="grid grid-cols-2 gap-1">
                        <SliderInput
                            tooltip="End X"
                            prefix="EX"
                            value={Math.round(params.end.x)}
                            onChange={handleEndX}
                            onCommit={onCommit}
                            min={-2000}
                            max={4000}
                        />
                        <SliderInput
                            tooltip="End Y"
                            prefix="EY"
                            value={Math.round(params.end.y)}
                            onChange={handleEndY}
                            onCommit={onCommit}
                            min={-2000}
                            max={4000}
                        />
                    </div>

                    {/* Render Prestart */}
                    <div className="mt-2">
                        <p className="text-[10px] text-muted-foreground mb-1">Prestart</p>
                        <Select
                            value={params.prestart}
                            onValueChange={(v) =>
                                update({
                                    prestart: v as BendParams["prestart"],
                                })
                            }
                        >
                            <SelectTrigger className="w-full h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="static">Static</SelectItem>
                                <SelectItem value="bend">Bend</SelectItem>
                                <SelectItem value="mirror">Mirror</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Post End */}
                    <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Post End</p>
                        <Select
                            value={params.postEnd}
                            onValueChange={(v) =>
                                update({
                                    postEnd: v as BendParams["postEnd"],
                                })
                            }
                        >
                            <SelectTrigger className="w-full h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="legal">Legal</SelectItem>
                                <SelectItem value="extended">Extended</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        </div>
    );
}
