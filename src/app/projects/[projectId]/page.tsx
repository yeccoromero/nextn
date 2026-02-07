'use client';

import { EditorProvider } from '@/context/editor-context';
import { useEffect, useRef, useState } from 'react';
import Toolbar from '@/components/editor/toolbar';
import Canvas from '@/components/editor/canvas';
import PropertiesPanel from '@/components/editor/properties-panel';
import { LayersPanel } from '@/components/editor/layers-panel';
import { SidebarProvider } from '@/components/ui/sidebar';
import TimelinePanel from '@/components/timeline/timeline-panel';
import Transport from '@/components/timeline/transport';
import { useUser } from '@/firebase';
import { useRouter, useParams } from 'next/navigation';

function EditorLayout() {
  const [timelineHeight, setTimelineHeight] = useState(240);
  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHRef = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const dy = startYRef.current - e.clientY;
      setTimelineHeight(Math.max(140, Math.min(520, startHRef.current + dy)));
    };
    const onUp = () => (resizingRef.current = false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const startResize = (e: React.MouseEvent) => {
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startHRef.current = timelineHeight;
  };

  return (
    <SidebarProvider>
      <div className="relative flex h-screen w-screen bg-background font-sans text-foreground overflow-hidden">
        <aside className="w-[16rem] flex-shrink-0 border-r bg-sidebar z-10">
          <LayersPanel />
        </aside>

        <main className="flex-1 overflow-hidden relative h-full w-full">
          <Canvas />
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
            <Toolbar />
          </div>
        </main>

        <aside className="w-[20rem] flex-shrink-0 border-l bg-background z-10">
          <PropertiesPanel />
        </aside>

        <div
          className="fixed left-0 right-0 bottom-0 z-40 pointer-events-none"
          style={{ height: timelineHeight }}
        >
          <div
            onMouseDown={startResize}
            className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize z-50 pointer-events-auto"
          />
          <div className="h-full bg-background/95 backdrop-blur border-t pointer-events-auto shadow-2xl">
            <TimelinePanel />
          </div>
        </div>

        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          style={{ bottom: timelineHeight + 12 }}
        >
          <div className="pointer-events-auto rounded-full border bg-background/95 backdrop-blur px-3 py-2 shadow-xl">
            <Transport />
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function ProjectPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const params = useParams();
  const projectId = (Array.isArray(params.projectId) ? params.projectId[0] : params.projectId) as string;
  
  // Here you would also fetch the project data and check for permissions
  // For now, we'll just protect the route
  
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/login');
    }
  }, [isUserLoading, user, router]);

  if (isUserLoading || !user || !projectId) {
    return <div className="flex h-screen w-screen items-center justify-center bg-canvas">Loading Editor...</div>;
  }

  return (
    <EditorProvider projectId={projectId}>
      <EditorLayout />
    </EditorProvider>
  );
}
