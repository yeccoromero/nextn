'use client';

import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { useEditor } from '@/context/editor-context';
import type { InterpolationType, PropertyId } from '@/types/editor';

export function KeyframeContextMenu({
    children,
    keyframeId,
    objectId,
    propertyId
}: {
    children: React.ReactNode;
    keyframeId: string;
    objectId: string;
    propertyId: PropertyId;
}) {
    const { dispatch } = useEditor();

    const handleSetInterpolation = (type: InterpolationType) => {
        console.log('Setting interpolation to:', type, { keyframeId, objectId, propertyId });
        dispatch({
            type: 'SET_KEYFRAME_INTERPOLATION',
            payload: { keyframeId, objectId, propertyId, interpolationType: type }
        });
    };

    const handleDelete = () => {
        console.log('Deleting keyframe:', { keyframeId, objectId, propertyId });
        dispatch({ type: 'DELETE_KEYFRAME', payload: { keyframeId, objectId, propertyId } });
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                {children}
            </ContextMenuTrigger>
            <ContextMenuContent className="w-48 z-[99999]" style={{ pointerEvents: 'auto' }}>
                <ContextMenuItem
                    onSelect={() => handleSetInterpolation('linear')}
                    onClick={() => handleSetInterpolation('linear')}
                    className="gap-2 cursor-pointer"
                    style={{ pointerEvents: 'auto' }}
                >
                    <span className="w-2 h-2 bg-current transform rotate-45 pointer-events-none" />
                    Linear
                </ContextMenuItem>
                <ContextMenuItem
                    onSelect={() => handleSetInterpolation('hold')}
                    onClick={() => handleSetInterpolation('hold')}
                    className="gap-2 cursor-pointer"
                    style={{ pointerEvents: 'auto' }}
                >
                    <span className="w-2 h-2 bg-current rounded-none pointer-events-none" />
                    Hold
                </ContextMenuItem>
                <ContextMenuItem
                    onSelect={() => handleSetInterpolation('ease')}
                    onClick={() => handleSetInterpolation('ease')}
                    className="gap-2 cursor-pointer"
                    style={{ pointerEvents: 'auto' }}
                >
                    <span className="w-2 h-2 bg-current pointer-events-none" style={{ clipPath: 'polygon(50% 0%, 100% 0%, 50% 50%, 100% 100%, 0% 100%, 50% 50%, 0% 0%)' }} />
                    Ease
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                    onSelect={handleDelete}
                    onClick={handleDelete}
                    className="text-destructive cursor-pointer"
                    style={{ pointerEvents: 'auto' }}
                >
                    Delete Keyframe
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}
