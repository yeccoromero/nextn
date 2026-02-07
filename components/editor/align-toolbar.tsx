

'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import type { AlignmentType } from '@/types/editor';
import { Button } from '../ui/button';
import {
    AlignLeftIcon,
    AlignCenterHorizontalIcon,
    AlignRightIcon,
    AlignTopIcon,
    AlignCenterVerticalIcon,
    AlignBottomIcon,
    DistributeHorizontalIcon,
    DistributeVerticalIcon
} from '@/components/icons';
import { TooltipPortal } from '@radix-ui/react-tooltip';

const alignmentTools: { type: AlignmentType; icon: React.ElementType; tooltip: string; group: string }[] = [
    { type: 'left', icon: AlignLeftIcon, tooltip: 'Align Left', group: 'align' },
    { type: 'h-center', icon: AlignCenterHorizontalIcon, tooltip: 'Align Horizontal Center', group: 'align' },
    { type: 'right', icon: AlignRightIcon, tooltip: 'Align Right', group: 'align' },
    { type: 'top', icon: AlignTopIcon, tooltip: 'Align Top', group: 'align' },
    { type: 'v-center', icon: AlignCenterVerticalIcon, tooltip: 'Align Vertical Center', group: 'align' },
    { type: 'bottom', icon: AlignBottomIcon, tooltip: 'Align Bottom', group: 'align' },
    { type: 'h-distribute', icon: DistributeHorizontalIcon, tooltip: 'Distribute Horizontally', group: 'distribute' },
    { type: 'v-distribute', icon: DistributeVerticalIcon, tooltip: 'Distribute Vertically', group: 'distribute' },
];

interface AlignToolbarProps {
  onAlign: (type: AlignmentType) => void;
}

export const AlignToolbar = ({ onAlign }: AlignToolbarProps) => {
  return (
    <div className="p-4 border-b">
        <div className="flex items-center justify-start gap-1">
            <TooltipProvider>
            {alignmentTools.map(({ type, icon: Icon, tooltip }) => (
                <Tooltip key={type}>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => onAlign(type)}>
                        <Icon className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipPortal>
                        <TooltipContent>
                            <p>{tooltip}</p>
                        </TooltipContent>
                    </TooltipPortal>
                </Tooltip>
            ))}
            </TooltipProvider>
        </div>
    </div>
  );
};
