/**
 * Inline SVG icon set — replaces lucide-react (a ~40MB package for 7 icons).
 * All icons inherit `currentColor` and default to 20px, matching the design system.
 */
import type { CSSProperties } from 'react';

interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}

const base = (size: number, strokeWidth: number, className?: string, style?: CSSProperties) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
  style,
  'aria-hidden': true,
});

export const IconFileText = ({ size = 20, strokeWidth = 2, className, style }: IconProps) => (
  <svg {...base(size, strokeWidth, className, style)}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

export const IconBriefcase = ({ size = 20, strokeWidth = 2, className, style }: IconProps) => (
  <svg {...base(size, strokeWidth, className, style)}>
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

export const IconCheckCircle = ({ size = 20, strokeWidth = 2, className, style }: IconProps) => (
  <svg {...base(size, strokeWidth, className, style)}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export const IconAlertTriangle = ({ size = 20, strokeWidth = 2, className, style }: IconProps) => (
  <svg {...base(size, strokeWidth, className, style)}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export const IconTrendingUp = ({ size = 20, strokeWidth = 2, className, style }: IconProps) => (
  <svg {...base(size, strokeWidth, className, style)}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

export const IconDollarSign = ({ size = 20, strokeWidth = 2, className, style }: IconProps) => (
  <svg {...base(size, strokeWidth, className, style)}>
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

export const IconX = ({ size = 20, strokeWidth = 2, className, style }: IconProps) => (
  <svg {...base(size, strokeWidth, className, style)}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const IconPlus = ({ size = 20, strokeWidth = 2, className, style }: IconProps) => (
  <svg {...base(size, strokeWidth, className, style)}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const IconTrash = ({ size = 20, strokeWidth = 2, className, style }: IconProps) => (
  <svg {...base(size, strokeWidth, className, style)}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
