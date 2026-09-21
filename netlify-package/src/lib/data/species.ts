/**
 * Species palette + labels. Colors are a brightened take on the Sentient
 * survey app's CAFO map scale — the darkest hues (beef, dairy, sheep) were
 * lifted so they read on the muted basemap at 0.9 opacity.
 * The `key` values are the raw `AnimalType` strings from the source data.
 */
export interface Species {
  key: string;
  label: string;
  color: string;
}

export const SPECIES: Species[] = [
  { key: 'Pig', label: 'Hogs', color: '#ff5c00' },
  { key: 'Cattle (Beef)', label: 'Beef cattle', color: '#B8301A' },
  { key: 'Cattle (Dairy)', label: 'Dairy cattle', color: '#C97A3E' },
  { key: 'Chickens', label: 'Chickens', color: '#FFA300' },
  { key: 'Turkeys', label: 'Turkeys', color: '#FFC96A' },
  { key: 'Sheep/Goat', label: 'Sheep & goats', color: '#3D9AAB' },
  { key: 'Other', label: 'Other', color: '#8A8A8A' }
];

const BY_KEY = new Map(SPECIES.map((s) => [s.key, s]));

export const speciesColor = (key: string): string =>
  BY_KEY.get(key)?.color ?? '#8A8A8A';

export const speciesLabel = (key: string): string =>
  BY_KEY.get(key)?.label ?? key;

/** Flat [value, color, value, color, …] expression input for MapLibre `match`. */
export const speciesMatchExpression = (): (string | string[])[] =>
  SPECIES.flatMap((s) => [s.key, s.color]);
