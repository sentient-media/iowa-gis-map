import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const data = JSON.parse(await readFile(new URL('../static/data/cafos.geojson', import.meta.url)));
const zips = JSON.parse(await readFile(new URL('../static/data/zip-index.json', import.meta.url)));

test('repeated DNR IDs retain separate, unique row identities for lists and map selection', () => {
  const ids = data.features.map((f) => f.properties.recordId);
  assert.ok(ids.every((id) => typeof id === 'string' && id.length > 0));
  assert.equal(new Set(ids).size, ids.length);
  const hamilton = data.features.filter((f) => f.properties.stfacid === '310664196');
  assert.equal(hamilton.length, 2, 'both source rows must survive');
  assert.deepEqual(hamilton.map((f) => f.properties.type).sort(), ['Cattle (Beef)', 'Pig']);
  assert.notEqual(hamilton[0].properties.recordId, hamilton[1].properties.recordId);
});

test('ZIP aggregates agree with the rendered source rows', () => {
  for (const [zip, summary] of Object.entries(zips)) {
    const rows = data.features.filter((f) => f.properties.zip === zip);
    assert.equal(summary.count, rows.length, zip);
    assert.equal(summary.totalAnimals, rows.reduce((n, f) => n + f.properties.animals, 0), zip);
    assert.equal(summary.totalManure, rows.reduce((n, f) => n + f.properties.manure, 0), zip);
  }
});
