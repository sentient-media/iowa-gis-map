/** Compact number formatting helpers for the editorial UI. */

const NF = new Intl.NumberFormat('en-US');

/** 1234567 -> "1,234,567" */
export const commas = (n: number): string => NF.format(Math.round(n || 0));

/** Compact: 946080000 -> "946M", 13800000 -> "13.8M", 1900000000 -> "1.9B". */
export function compact(n: number): string {
  n = n || 0;
  const abs = Math.abs(n);
  if (abs >= 1e9) return trim(n / 1e9) + 'B';
  if (abs >= 1e6) return trim(n / 1e6) + 'M';
  if (abs >= 1e3) return trim(n / 1e3) + 'K';
  return String(Math.round(n));
}

function trim(v: number): string {
  // One decimal, but drop a trailing ".0".
  return v.toFixed(1).replace(/\.0$/, '');
}

/** Manure value (lbs) -> "187.7B lbs" / "13.8M lbs". */
export const manure = (lbs: number): string => `${compact(lbs)} lbs`;
