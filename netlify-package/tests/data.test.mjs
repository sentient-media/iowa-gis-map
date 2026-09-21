import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import test, { after } from 'node:test';
import ts from 'typescript';

const data = JSON.parse(await readFile(new URL('../static/data/cafos.geojson', import.meta.url)));
const zips = JSON.parse(await readFile(new URL('../static/data/zip-index.json', import.meta.url)));

// Exercise the actual card formatter without starting Svelte or a browser.
const compiled = await mkdtemp(join(tmpdir(), 'iowa-card-test-'));
after(() => rm(compiled, { recursive: true, force: true }));
for (const name of ['species', 'format', 'facility-card']) {
  const source = await readFile(new URL(`../src/lib/data/${name}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  });
  await writeFile(join(compiled, `${name}.js`), outputText);
}
const { complianceSummary, facilityCardHTML } = createRequire(import.meta.url)(join(compiled, 'facility-card.js'));

test('repeated DNR IDs retain separate, unique row identities for lists and map selection', () => {
  const ids = data.features.map((f) => f.properties.uid);
  assert.ok(ids.every((id) => typeof id === 'string' && id.length > 0));
  assert.equal(new Set(ids).size, ids.length);
  const hamilton = data.features.filter((f) => f.properties.stfacid === '310664196');
  assert.equal(hamilton.length, 2, 'both source rows must survive');
  assert.deepEqual(hamilton.map((f) => f.properties.type).sort(), ['Cattle (Beef)', 'Pig']);
  assert.notEqual(hamilton[0].properties.uid, hamilton[1].properties.uid);
});

test('ZIP aggregates agree with the rendered source rows', () => {
  for (const [zip, summary] of Object.entries(zips)) {
    const rows = data.features.filter((f) => f.properties.zip === zip);
    assert.equal(summary.count, rows.length, zip);
    assert.equal(summary.totalAnimals, rows.reduce((n, f) => n + f.properties.animals, 0), zip);
    assert.equal(summary.totalManure, rows.reduce((n, f) => n + f.properties.manure, 0), zip);
  }
});

test('annotated cattle and unsupported species remain accessible through species filters', () => {
  const allowed = new Set(['Pig', 'Cattle (Beef)', 'Cattle (Dairy)', 'Chickens', 'Turkeys', 'Sheep/Goat', 'Other']);
  assert.ok(data.features.every((f) => allowed.has(f.properties.type)));
  assert.equal(data.features.filter((f) => f.properties.type === 'Cattle (Beef)').length, 1641);
  assert.equal(data.features.filter((f) => f.properties.type === 'Other').length, 3);
});

test('ZIPs without facilities retain valid map extents and zero totals', () => {
  const empty = Object.values(zips).filter((entry) => entry.count === 0);
  assert.equal(empty.length, 195);
  for (const entry of empty) {
    assert.equal(typeof entry.place, 'string');
    assert.equal(entry.totalAnimals, 0);
    assert.equal(entry.totalManure, 0);
    const [west, south, east, north] = entry.bounds;
    assert.ok([west, south, east, north].every(Number.isFinite));
    assert.ok(west < east && south < north);
    assert.ok(entry.center[0] >= west && entry.center[0] <= east);
    assert.ok(entry.center[1] >= south && entry.center[1] <= north);
  }
});

const daybreak = data.features.find((f) => f.properties.name === 'Daybreak Foods Vincent Complex').properties;
test('Daybreak desktop copy is expanded on separate lines and mobile labels stay expanded', () => {
  assert.equal(complianceSummary(daybreak, true).text,
    '34 Notices of Violation\n4 Letters of Noncompliance\n2 Administrative Orders\n2 Manure spills');
  const popup = facilityCardHTML(daybreak);
  assert.ok(popup.includes('class="fp-enforcement"'));
  assert.ok(popup.includes('6.04M'));
  const mobile = facilityCardHTML(daybreak, 'sheet');
  assert.ok(mobile.includes('34 notices of violation · 4 letters of noncompliance'));
});

test('enforcement copy handles singular, zero and missing counts honestly', () => {
  const p = { ...daybreak, novs: 1, lncs: 0, orders: 0, spills: 0 };
  assert.equal(complianceSummary(p, true).text, '1 Notice of Violation');
  assert.equal(complianceSummary({ ...p, novs: 0 }).tone, 'clean');
  assert.equal(complianceSummary({ ...p, novs: null }).tone, 'unknown');
  assert.equal(complianceSummary({ ...p, novs: null, lncs: null, orders: null, spills: null }).text,
    'Enforcement record unavailable');
});

test('facility resource links reject executable URLs while preserving web links', () => {
  const card = facilityCardHTML({ ...daybreak, dnrUrl: 'javascript:alert(1)', compUrl: 'https://example.com/report' });
  assert.ok(!card.includes('javascript:'));
  assert.ok(card.includes('href="https://example.com/report"'));
});
