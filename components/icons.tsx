

import type { SVGProps } from "react";

export function VectoriaLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g transform="translate(2, 2) scale(0.8333)">
        <g clipPath="url(#clip0_3261_13887)">
          <path d="M19.26 6.78005L18.08 7.05005C17.24 7.24005 16.57 7.90005 16.38 8.75005L16.11 9.93005C16.08 10.05 15.9 10.05 15.87 9.93005L15.6 8.75005C15.41 7.91005 14.75 7.24005 13.9 7.05005L12.72 6.78005C12.6 6.75005 12.6 6.57005 12.72 6.54005L13.9 6.27005C14.74 6.08005 15.41 5.42005 15.6 4.57005L15.87 3.39005C15.9 3.27005 16.08 3.27005 16.11 3.39005L16.38 4.57005C16.57 5.41005 17.23 6.08005 18.08 6.27005L19.26 6.54005C19.38 6.57005 19.38 6.75005 19.26 6.78005Z" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" />
          <path d="M12.11 3.00005C10.59 2.96005 9.04003 3.71005 8.22003 5.26005H8.23003L3.19003 14.7101C1.67003 17.5601 3.73003 21.0001 6.96003 21.0001H17.03C20.26 21.0001 22.32 17.5601 20.8 14.7101L19.12 11.5501" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
      <defs>
      <clipPath id="clip0_3261_13887">
      <rect width="24" height="24" fill="white"/>
      </clipPath>
      </defs>
    </svg>
  );
}


export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

export function PenCurveIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            <path d="m15 5 3 3" />
            <path d="M3 21c4-4 8-4 12 0" opacity="0.5" />
        </svg>
    )
}

export function DirectSelectionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
    </svg>
  );
}

export function NodeToolIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            {...props}
        >
           <path d="M14.5 14.5 22 22" />
            <path d="m21 3-6.5 18a.55.55 0 0 1-1 0L10 14l-7-3.5a.55.55 0 0 1 0-1L21 3z" />
            <circle cx="9.5" cy="9.5" r="1.5" fill="currentColor"/>
            <path d="M9.5 8v-5" strokeWidth="1" />
            <path d="M9.5 11v5" strokeWidth="1" />
            <path d="M8 9.5h-5" strokeWidth="1" />
            <path d="M11 9.5h5" strokeWidth="1" />
        </svg>
    );
}

export function PenToolAddIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
        <g clipPath="url(#clip0_4418_9557)">
            <path d="M21.19 8.04039L18.0099 4.8604C16.8099 3.6604 15.16 3.72042 14.35 5.01042L12.58 7.81041L18.25 13.4804L21.05 11.7104C22.26 10.9404 22.33 9.17039 21.19 8.04039Z" />
            <path d="M18.25 13.4697L18.49 17.5897C18.72 19.8897 17.92 20.6897 15.74 20.9497L7.01999 21.9797C5.17999 22.1897 3.85999 20.8698 4.07999 19.0398L5.05998 10.7598" />
            <path d="M12.58 7.81116L10.83 7.70117" />
            <path d="M5.28003 20.7799L8.46004 17.5898" />
            <path d="M11 6.5C11 6.91 10.94 7.32001 10.83 7.70001C10.72 8.10001 10.56 8.47001 10.35 8.82001C10.11 9.22001 9.81001 9.58 9.46001 9.88C8.67001 10.58 7.64 11 6.5 11C5.99 11 5.51 10.92 5.06 10.76C4.04 10.42 3.18999 9.72001 2.64999 8.82001C2.23999 8.14001 2 7.34 2 6.5C2 5.08 2.65 3.80999 3.69 2.98999C4.46 2.36999 5.44 2 6.5 2C8.99 2 11 4.01 11 6.5Z" strokeMiterlimit="10" />
            <path d="M6.52002 8.1803V4.82031" strokeMiterlimit="10" />
            <path d="M8.16005 6.5H4.80005" strokeMiterlimit="10" />
        </g>
        <defs>
            <clipPath id="clip0_4418_9557">
                <rect width="24" height="24" fill="white"/>
            </clipPath>
        </defs>
    </svg>
  );
}


export function PenToolRemoveIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <path d="M21.19 8.04039L18.01 4.8604C16.81 3.6604 15.16 3.72042 14.35 5.01042L12.58 7.81041L18.25 13.4804L21.05 11.7104C22.26 10.9404 22.33 9.17039 21.19 8.04039Z"/>
            <path d="M18.25 13.4697L18.49 17.5897C18.72 19.8897 17.92 20.6897 15.74 20.9497L7.01999 21.9797C5.17999 22.1897 3.85999 20.8698 4.07999 19.0398L5.06 10.7598"/>
            <path d="M12.58 7.81116L10.83 7.70117"/>
            <path d="M5.28003 20.7799L8.46002 17.5898"/>
            <path d="M11 6.5C11 6.91 10.94 7.32001 10.83 7.70001C10.72 8.10001 10.56 8.47001 10.35 8.82001C10.11 9.22001 9.80999 9.58 9.45999 9.88C8.66999 10.58 7.64 11 6.5 11C5.99 11 5.51 10.92 5.06 10.76C4.04 10.42 3.18999 9.72001 2.64999 8.82001C2.23999 8.14001 2 7.34 2 6.5C2 5.08 2.65 3.80999 3.69 2.98999C4.46 2.36999 5.44 2 6.5 2C8.99 2 11 4.01 11 6.5Z" strokeMiterlimit="10"/>
            <path d="M8.16006 6.5H4.80005" strokeMiterlimit="10"/>
        </svg>
    );
}

export function CustomLayersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g transform="translate(4 4) scale(0.666)">
        <path d="M13.01 2.92031L18.91 5.54031C20.61 6.29031 20.61 7.53031 18.91 8.28031L13.01 10.9003C12.34 11.2003 11.24 11.2003 10.57 10.9003L4.67002 8.28031C2.97002 7.53031 2.97002 6.29031 4.67002 5.54031L10.57 2.92031C11.24 2.62031 12.34 2.62031 13.01 2.92031Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 11C3 11.84 3.63 12.81 4.4 13.15L11.19 16.17C11.71 16.4 12.3 16.4 12.81 16.17L19.6 13.15C20.37 12.81 21 11.84 21 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 16C3 16.93 3.55 17.77 4.4 18.15L11.19 21.17C11.71 21.4 12.3 21.4 12.81 21.17L19.6 18.15C20.45 17.77 21 16.93 21 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function FourCornersIcon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        <path d="M4 2H2V4" />
        <path d="M12 2H14V4" />
        <path d="M4 14H2V12" />
        <path d="M12 14H14V12" />
      </svg>
    );
}

export function CornerTopLeft(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}><path d="M9 0.5H5C2.51472 0.5 0.5 2.51472 0.5 5V9.5" /></svg>;
}
export function CornerTopRight(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}><path d="M1 0.5H5C7.48528 0.5 9.5 2.51472 9.5 5V9.5" /></svg>;
}
export function CornerBottomLeft(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}><path d="M9 9.5H5C2.51472 9.5 0.5 7.48528 0.5 5V0.5" /></svg>;
}
export function CornerBottomRight(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}><path d="M1 9.5H5C7.48528 9.5 9.5 7.48528 9.5 5V0.5" /></svg>;
}

export function FilledDiamond(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            fill="currentColor"
            {...props}
        >
            <path d="M12 2L2 12l10 10 10-10L12 2z" />
        </svg>
    );
}

export function AlignLeftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props}>
      <path d="M2 2V14" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5" y="4" width="6" height="2.5" rx="1" fill="currentColor" />
      <rect x="5" y="9.5" width="9" height="2.5" rx="1" fill="currentColor" />
    </svg>
  );
}

export function AlignCenterHorizontalIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props}>
      <path d="M8 2V14" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="4" width="8" height="2.5" rx="1" fill="currentColor" />
      <rect x="2" y="9.5" width="12" height="2.5" rx="1" fill="currentColor" />
    </svg>
  );
}

export function AlignRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props}>
      <path d="M14 2V14" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5" y="4" width="6" height="2.5" rx="1" fill="currentColor" />
      <rect x="2" y="9.5" width="9" height="2.5" rx="1" fill="currentColor" />
    </svg>
  );
}

export function AlignTopIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props}>
      <path d="M2 2H14" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="5" width="2.5" height="6" rx="1" fill="currentColor" />
      <rect x="9.5" y="5" width="2.5" height="9" rx="1" fill="currentColor" />
    </svg>
  );
}

export function AlignCenterVerticalIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props}>
      <path d="M2 8H14" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="4" width="2.5" height="8" rx="1" fill="currentColor" />
      <rect x="9.5" y="2" width="2.5" height="12" rx="1" fill="currentColor" />
    </svg>
  );
}

export function AlignBottomIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props}>
      <path d="M2 14H14" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="5" width="2.5" height="6" rx="1" fill="currentColor" />
      <rect x="9.5" y="2" width="2.5" height="9" rx="1" fill="currentColor" />
    </svg>
  );
}


export function DistributeHorizontalIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props}>
      <path d="M2 2V14" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 2V14" stroke="currentColor" strokeWidth="1.5" />
      <rect x="6.5" y="5" width="3" height="6" rx="1" fill="currentColor" />
    </svg>
  );
}


export function DistributeVerticalIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props}>
      <path d="M2 2H14" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 14H14" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5" y="6.5" width="6" height="3" rx="1" fill="currentColor" />
    </svg>
  );
}

