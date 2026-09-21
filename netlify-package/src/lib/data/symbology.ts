/**
 * Map symbology modes — shared by the switcher control, the MapLibre paint
 * expressions, and the legend so they never drift apart.
 */
import { speciesMatchExpression, SPECIES } from './species';
import { compact } from './format';

export type Mode = 'type' | 'manure';

export const MODES: { id: Mode; label: string }[] = [
  { id: 'type', label: 'Animal type' },
  { id: 'manure', label: 'Manure' }
];

// Sequential ramp for the one graduated metric, drawn from the Sentient palette
// (brightened: the upper classes were lifted out of the near-black browns).
const MANURE_RAMP = ['#FFE4C4', '#FFC06A', '#FF9430', '#F25A10', '#B02A0A'];

/** Graduated class breaks. `breaks` has ramp.length - 1 thresholds. */
interface Graduated {
  prop: 'manure';
  ramp: string[];
  breaks: number[];
  unit: string;
  // radius domain [min, mid, max] for the zoom-aware size ramp
  sizeDomain: [number, number, number];
}

const MANURE: Graduated = {
  prop: 'manure',
  ramp: MANURE_RAMP,
  breaks: [1e6, 5e6, 20e6, 100e6],
  unit: 'lbs',
  sizeDomain: [0, 10e6, 200e6]
};

// Animal count is no longer a color mode, but still sizes the circles in
// 'type' mode.
const ANIMALS_SIZE_DOMAIN: [number, number, number] = [0, 5000, 100000];

/**
 * Zoom-aware circle radius that scales with `prop` over [min, mid, max].
 * `scale`/`pad` are baked into the output sizes (radius = base*scale + pad) so
 * the result stays a valid top-level zoom interpolate — MapLibre forbids
 * wrapping a zoom expression in arithmetic like ['*', …].
 */
export function radiusExpr(
  prop: 'animals' | 'manure',
  domain: [number, number, number],
  scale = 1,
  pad = 0
): unknown[] {
  const [d0, dMid, dMax] = domain;
  const s = (v: number) => v * scale + pad;
  const at = (r0: number, rMid: number, rMax: number) => [
    'interpolate', ['linear'], ['get', prop], d0, s(r0), dMid, s(rMid), dMax, s(rMax)
  ];
  return [
    'interpolate', ['linear'], ['zoom'],
    5, at(1.6, 4, 7),
    9, at(3, 7, 14),
    13, at(5, 12, 24)
  ];
}

/** circle-color expression for the active mode. */
export function colorExpr(mode: Mode): unknown {
  if (mode === 'type') return ['match', ['get', 'type'], ...speciesMatchExpression(), '#8A8A8A'];
  const stops: unknown[] = ['step', ['get', MANURE.prop], MANURE.ramp[0]];
  MANURE.breaks.forEach((b, i) => stops.push(b, MANURE.ramp[i + 1]));
  return stops;
}

/** circle-radius expression for the active mode (optionally scaled/padded). */
export function radiusForMode(mode: Mode, scale = 1, pad = 0): unknown {
  if (mode === 'manure') return radiusExpr('manure', MANURE.sizeDomain, scale, pad);
  return radiusExpr('animals', ANIMALS_SIZE_DOMAIN, scale, pad);
}

// ----- Legend descriptors -----
export type LegendDescriptor =
  | { kind: 'categorical'; items: { color: string; label: string }[]; note: string }
  | { kind: 'ramp'; items: { color: string; label: string }[]; title: string; note: string };

function rampItems(g: Graduated): { color: string; label: string }[] {
  const u = g.unit ? ` ${g.unit}` : '';
  return g.ramp.map((color, i) => {
    const lo = i === 0 ? null : g.breaks[i - 1];
    const hi = g.breaks[i] ?? null;
    let label: string;
    if (lo === null) label = `< ${compact(hi!)}${u}`;
    else if (hi === null) label = `≥ ${compact(lo)}${u}`;
    else label = `${compact(lo)}–${compact(hi)}${u}`;
    return { color, label };
  });
}

export function legendFor(mode: Mode): LegendDescriptor {
  if (mode === 'type') {
    return {
      kind: 'categorical',
      items: SPECIES.map((s) => ({ color: s.color, label: s.label })),
      note: 'Circle size ≈ number of animals'
    };
  }
  return {
    kind: 'ramp',
    title: 'Manure / yr',
    items: rampItems(MANURE),
    note: 'Circle size ≈ manure output'
  };
}
