/** Compact number formatting helpers for the editorial UI. */

const NF = new Intl.NumberFormat('en-US');

/** 1234567 -> "1,234,567" */
export const commas = (n: number): string => NF.format(Math.round(n || 0));

/** Compact: 946080000 -> "946M", 13800000 -> "13.8M", 1900000000 -> "1.9B".
 *  `decimals` is the most kept; trailing zeros go ("1.70M" -> "1.7M"). */
export function compact(n: number, decimals = 1): string {
  n = n || 0;
  const abs = Math.abs(n);
  if (abs >= 1e9) return trim(n / 1e9, decimals) + 'B';
  if (abs >= 1e6) return trim(n / 1e6, decimals) + 'M';
  if (abs >= 1e3) return trim(n / 1e3, decimals) + 'K';
  return String(Math.round(n));
}

function trim(v: number, decimals: number): string {
  // Round to `decimals`, then let Number drop the trailing zeros.
  return String(Number(v.toFixed(decimals)));
}

/** A stat-tile figure: commas up to the hundreds of thousands, then compact
 *  with two decimals ("4.96M") — the tiles are narrow, and a seven-digit head
 *  count spills into its neighbours. Two decimals rather than the manure
 *  tile's one because a single facility's head count sits between 1M and 5M,
 *  where one decimal rounds 4,960,000 to "5M" and reads as a round figure. */
export const statNum = (n: number): string => (Math.abs(n || 0) >= 1e6 ? compact(n, 2) : commas(n));

/** Manure value (lbs) -> "187.7B lbs" / "13.8M lbs". */
export const manure = (lbs: number): string => `${compact(lbs)} lbs`;
