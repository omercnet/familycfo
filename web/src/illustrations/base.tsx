import type { ReactNode, SVGProps } from 'react';
import { cn } from '@/lib/utils';
import './illustrations.css';

/** Illustration palette, as CSS variables (values and dark mode in illustrations.css). */
export const ILL = {
  ink: 'var(--ill-ink)',
  blue: 'var(--ill-blue)',
  blue2: 'var(--ill-blue-2)',
  yellow: 'var(--ill-yellow)',
  paper: 'var(--ill-paper)',
  cloud: 'var(--ill-cloud)',
  free: 'var(--ill-free-line)',
} as const;

export type IllustrationProps = Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'children'>;

/**
 * The svg every illustration renders: decorative (hidden from screen readers), drawn left to right
 * whatever the page direction, and as wide as its container. Size it with a width class.
 */
// React renders `dir` on an svg (a global attribute), but its SVG types don't list it
const LTR = { dir: 'ltr' } as object;

export function IllustrationSvg({ viewBox, className, children, ...rest }: IllustrationProps & { viewBox: string; children: ReactNode }) {
  return (
    <svg viewBox={viewBox} {...LTR} aria-hidden="true" focusable="false" className={cn('ill', className)} {...rest}>
      {children}
    </svg>
  );
}

/** "+" sparkle centered on (x, y); drawn straight on the panel, so it uses the free-line color. */
export function Sparkle({ x, y, size = 14 }: { x: number; y: number; size?: number }) {
  const h = size / 2;
  return <path d={`M${x} ${y - h}v${size}M${x - h} ${y}h${size}`} stroke={ILL.free} />;
}

/** Cloud without an outline; (x, y) is the left end of its flat base, `w` its width. */
export function Cloud({ x, y, w = 78 }: { x: number; y: number; w?: number }) {
  const s = w / 78;
  return (
    <path
      d="M0 0c0-14 12-24 26-22 5-12 24-14 32-2 12-2 22 8 20 24z"
      transform={`translate(${x} ${y}) scale(${s})`}
      fill={ILL.cloud}
      stroke="none"
    />
  );
}

/**
 * A path with a solid offset shadow: an ink copy shifted down (and optionally sideways) under
 * the shape, in place of a blur.
 */
export function Shadowed({ d, fill, dx = 0, dy = 6 }: { d: string; fill: string; dx?: number; dy?: number }) {
  return (
    <>
      <path d={d} fill={ILL.ink} transform={`translate(${dx} ${dy})`} />
      <path d={d} fill={fill} />
    </>
  );
}

/** Path data for a rectangle, rounded when `r` is set (so Shadowed can draw it twice). */
export function rect(x: number, y: number, w: number, h: number, r = 0) {
  if (!r) return `M${x} ${y}h${w}v${h}h${-w}z`;
  const a = (dx: number, dy: number) => `a${r} ${r} 0 0 1 ${dx} ${dy}`;
  return `M${x + r} ${y}h${w - 2 * r}${a(r, r)}v${h - 2 * r}${a(-r, r)}h${2 * r - w}${a(-r, -r)}v${2 * r - h}${a(r, -r)}z`;
}

/** Path data for a circle. */
export function circle(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}
