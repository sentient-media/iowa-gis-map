import assert from 'node:assert/strict';
import { readdir, stat } from 'node:fs/promises';

// A missing MapLibre worker leaves a working basemap but no facility markers.
const directory = new URL('../build/_app/immutable/workers/', import.meta.url);
const workers = (await readdir(directory)).filter((name) => /^maplibre-gl-worker-.*\.js$/.test(name));
assert.ok(workers.length > 0, 'Production build is missing the MapLibre worker');
for (const name of workers) {
  assert.ok((await stat(new URL(name, directory))).size > 0, 'MapLibre worker is empty');
}
console.log('Verified bundled MapLibre worker in the static build.');
