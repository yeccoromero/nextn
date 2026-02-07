
'use client';

export function EmptyTrackRow({ height = 28 }: { height?: number }) {
  return (
    <div className="relative w-full select-none" style={{ height }}>
      <div className="absolute inset-0 bg-[rgba(34,34,37,0.55)]" />
      <div className="absolute left-0 right-0 bottom-0 h-px bg-black/40" />
    </div>
  );
}
