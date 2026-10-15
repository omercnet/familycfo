/**
 * Motion constants for `motion` (JS) animations. Mirror of the CSS tokens in index.css
 * (--ease-*, --duration-*), so JS and CSS transitions move alike; change both together.
 * Durations are in seconds, as `motion` expects. Existing call sites still hardcode their own
 * values (0.45s entrances, 0.06s stagger); moving them here is a later phase.
 */
export const ease = {
  /** --ease-out */
  out: [0.22, 1, 0.36, 1],
  /** --ease-spring (slight overshoot) */
  spring: [0.34, 1.4, 0.64, 1],
  /** --ease-in-out */
  inOut: [0.65, 0, 0.35, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export const duration = {
  /** --duration-fast (140ms) */
  fast: 0.14,
  /** --duration-base (220ms) */
  base: 0.22,
  /** --duration-slow (320ms) */
  slow: 0.32,
} as const;
