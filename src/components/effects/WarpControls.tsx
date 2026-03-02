'use client';

import React, { useCallback } from 'react';
import { SliderInput } from '@/components/editor/slider-input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { PropertyId, WarpEffect, WarpStyle } from '@/types/editor';

const WARP_STYLES: { value: WarpStyle; label: string }[] = [
    { value: 'arc', label: 'Arc' },
    { value: 'arc-lower', label: 'Arc Lower' },
    { value: 'arc-upper', label: 'Arc Upper' },
    { value: 'arch', label: 'Arch' },
    { value: 'bulge', label: 'Bulge' },
    { value: 'shell-lower', label: 'Shell Lower' },
    { value: 'shell-upper', label: 'Shell Upper' },
    { value: 'flag', label: 'Flag' },
    { value: 'wave', label: 'Wave' },
    { value: 'fish', label: 'Fish' },
    { value: 'rise', label: 'Rise' },
    { value: 'fish-eye', label: 'FishEye' },
    { value: 'inflate', label: 'Inflate' },
    { value: 'twist', label: 'Twist' },
    { value: 'squeeze', label: 'Squeeze' },
];

export type WarpControlsProps = {
    params: WarpEffect;
    onChange: (params: WarpEffect) => void;
    onCommit?: (propId?: PropertyId) => void;
    isAnimated?: (prop: PropertyId) => boolean;
    onToggleAnimation?: (prop: PropertyId) => void;
};

export function WarpControls({
    params,
    onChange,
    onCommit,
    isAnimated,
    onToggleAnimation,
}: WarpControlsProps) {
    const update = useCallback(
        (partial: Partial<WarpEffect>) => onChange({ ...params, ...partial }),
        [params, onChange]
    );

    return (
        <div className="space-y-3">
            <p className="text-xs font-bold">Warp</p>

            {/* Warp Style */}
            <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Warp Style</p>
                <Select
                    value={params.style}
                    onValueChange={(v) => {
                        update({ style: v as WarpStyle });
                        onCommit?.('warpStyle' as PropertyId);
                    }}
                >
                    <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {WARP_STYLES.map(({ value, label }) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Warp Axis */}
            <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Warp Axis</p>
                <Select
                    value={params.axis}
                    onValueChange={(v) => {
                        update({ axis: v as WarpEffect['axis'] });
                        onCommit?.('warpAxis' as PropertyId);
                    }}
                >
                    <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="horizontal">Horizontal</SelectItem>
                        <SelectItem value="vertical">Vertical</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Bend */}
            <SliderInput
                tooltip="Bend (-100 to 100)"
                prefix="Bend"
                id="warp-bend"
                name="warp-bend"
                value={Math.round(params.bend)}
                onChange={(v) => update({ bend: v })}
                onCommit={() => onCommit?.('warpBend' as PropertyId)}
                min={-100}
                max={100}
                onToggleAnimation={() => onToggleAnimation?.('warpBend' as PropertyId)}
                isAnimated={isAnimated?.('warpBend' as PropertyId)}
            />

            {/* Horizontal Distortion */}
            <SliderInput
                tooltip="Horizontal Distortion (-100 to 100)"
                prefix="H"
                id="warp-hdist"
                name="warp-hdist"
                value={Math.round(params.hDist)}
                onChange={(v) => update({ hDist: v })}
                onCommit={() => onCommit?.('warpHDist' as PropertyId)}
                min={-100}
                max={100}
                onToggleAnimation={() => onToggleAnimation?.('warpHDist' as PropertyId)}
                isAnimated={isAnimated?.('warpHDist' as PropertyId)}
            />

            {/* Vertical Distortion */}
            <SliderInput
                tooltip="Vertical Distortion (-100 to 100)"
                prefix="V"
                id="warp-vdist"
                name="warp-vdist"
                value={Math.round(params.vDist)}
                onChange={(v) => update({ vDist: v })}
                onCommit={() => onCommit?.('warpVDist' as PropertyId)}
                min={-100}
                max={100}
                onToggleAnimation={() => onToggleAnimation?.('warpVDist' as PropertyId)}
                isAnimated={isAnimated?.('warpVDist' as PropertyId)}
            />
        </div>
    );
}
