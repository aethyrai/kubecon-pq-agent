/** Three presentations of the same pages: full, low-bandwidth text, screen-reader optimized. */
export const MODES = ['full', 'text', 'reader'] as const;
export type Mode = (typeof MODES)[number];

export function parseMode(v: string | string[] | undefined): Mode {
  const s = Array.isArray(v) ? v[0] : v;
  return MODES.find((m) => m === s) ?? 'full';
}
