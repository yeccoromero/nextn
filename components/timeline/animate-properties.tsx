// @ts-nocheck


'use client';

import { useEditor } from "@/context/editor-context";
import { Button } from "../ui/button";
import { X, Link2 } from 'lucide-react';
import { PropertyId } from "@/types/editor";
import { cn } from "@/lib/utils";

const ALL_PROPERTIES: { group: string; props: { id: PropertyId; name: string; shortcut: string }[] }[] = [
    {
        group: 'Transform',
        props: [
            { id: 'position', name: 'Position', shortcut: 'P' },
            { id: 'scale', name: 'Scale', shortcut: 'S' },
            { id: 'rotation', name: 'Rotation', shortcut: 'R' },
        ]
    },
    {
        group: 'Appearance',
        props: [
            { id: 'opacity', name: 'Opacity', shortcut: 'T' },
        ]
    }
]

export default function AnimateProperties({ objectId, onClose }: { objectId: string, onClose: () => void }) {
    const { state, dispatch } = useEditor();
    const { timeline, objects } = state;
    const object = objects[objectId];
    const layerTrack = timeline.layers[objectId];

    if (!object) return null;

    const isPropertyAnimated = (propId: PropertyId) => {
        if (!layerTrack) return false;
        if (propId === 'position') {
            return layerTrack.properties.some(p => p.id === 'position');
        }
        if (propId === 'scale') {
            return layerTrack.properties.some(p => p.id === 'scale' || p.id === 'scaleX' || p.id === 'scaleY');
        }
        return layerTrack.properties.some(p => p.id === propId);
    };

    const toggleProperty = (propId: PropertyId, e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch({
            type: 'TOGGLE_PROPERTY_ANIMATION',
            payload: { objectId, propertyId: propId }
        });
    }

    return (
        <div className="bg-popover text-popover-foreground rounded-lg shadow-xl w-full">
            <div className="flex items-center justify-between p-2 border-b">
                <h3 className="text-sm font-semibold">Animate Properties</h3>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
            <div className="p-2 space-y-2">
                {ALL_PROPERTIES.map(group => (
                    <div key={group.group}>
                        <div className="flex items-center justify-between px-2 py-1">
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground">{group.group}</h4>
                            <Button variant="ghost" size="icon" className="h-5 w-5">
                                <Link2 className="h-3 w-3" />
                            </Button>
                        </div>
                        <div className="space-y-1">
                            {group.props.map(prop => (
                                <button
                                    key={prop.id}
                                    onClick={(e) => toggleProperty(prop.id, e)}
                                    className={cn(
                                        "w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-md text-left hover:bg-accent",
                                        isPropertyAnimated(prop.id) && "bg-accent/50"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={cn(
                                                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                                                isPropertyAnimated(prop.id) ? "border-primary bg-primary/20" : "border-muted-foreground/50"
                                            )}
                                        >
                                            {isPropertyAnimated(prop.id) && <div className="w-2 h-2 rounded-full bg-primary" />}
                                        </div>
                                        <span>{prop.name}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">{prop.shortcut}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
