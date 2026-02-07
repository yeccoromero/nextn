import { useEffect, useRef } from 'react';

type ScrollSyncOptions = {
    horizontal?: boolean;
    vertical?: boolean;
};

/**
 * Synchronizes scrolling between multiple elements.
 * 
 * @param refs List of refs to synchronize
 * @param options configuration for axis
 */
export function useScrollSync(
    refs: React.RefObject<HTMLElement>[],
    options: ScrollSyncOptions = { horizontal: true, vertical: true }
) {
    const isSyncing = useRef<boolean>(false);
    const rafId = useRef<number>(0);

    useEffect(() => {
        const elements = refs.map(r => r.current).filter(Boolean) as HTMLElement[];

        if (elements.length < 2) return;

        const handleScroll = (e: Event) => {
            if (isSyncing.current) return;

            const target = e.target as HTMLElement;
            isSyncing.current = true;

            cancelAnimationFrame(rafId.current);

            rafId.current = requestAnimationFrame(() => {
                elements.forEach(el => {
                    if (el === target) return;

                    if (options.vertical) {
                        el.scrollTop = target.scrollTop;
                    }
                    if (options.horizontal) {
                        el.scrollLeft = target.scrollLeft;
                    }
                });

                // Small timeout to allow the other elements to fire their scroll events
                // which will be ignored because isSyncing is true
                setTimeout(() => {
                    isSyncing.current = false;
                }, 10);
            });
        };

        elements.forEach(el => {
            el.addEventListener('scroll', handleScroll, { passive: true });
        });

        return () => {
            cancelAnimationFrame(rafId.current);
            elements.forEach(el => {
                el.removeEventListener('scroll', handleScroll);
            });
        };
    }, [refs, options.horizontal, options.vertical]);
}
