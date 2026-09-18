/**
 * The facility detail card, as an HTML string.
 *
 * Two surfaces render it: the desktop MapLibre popup (which only accepts HTML,
 * not a component) and the mobile bottom sheet. Building it here keeps them a
 * single source of truth. Layout and type live in `.fac-popup *` rules in
 * app.css — only values that vary per facility (species colour, status, tone,
 * permit marks) stay inline.
 */
import { speciesLabel, speciesColor } from './species';
import { commas, compact } from './format';
import type { FacilityProps } from './types';

const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!
  );

/** Color-coded summary of a facility's enforcement record. */
export function complianceSummary(p: FacilityProps): {
  tone: 'clean' | 'issues' | 'unknown';
  text: string;
} {
  const enf = [
    { n: p.novs, one: 'NOV', many: 'NOVs' },
    { n: p.lncs, one: 'LNC', many: 'LNCs' },
    { n: p.orders, one: 'order', many: 'orders' },
    { n: p.spills, one: 'spill', many: 'spills' }
  ];
  const known = enf.filter((e) => e.n != null);
  if (known.length === 0) return { tone: 'unknown', text: 'Enforcement record unavailable' };
  const issues = known.filter((e) => (e.n ?? 0) > 0);
  if (issues.length === 0) {
    return known.length === enf.length
      ? { tone: 'clean', text: 'No violations on record' }
      : { tone: 'unknown', text: 'No violations in available records; some history unavailable' };
  }
  return {
    tone: 'issues',
    text: issues.map((e) => `${e.n} ${e.n === 1 ? e.one : e.many}`).join(' · ')
  };
}

const TONES = {
  clean: { bg: '#E7F4EC', fg: '#0B7A33', icon: '✓' },
  issues: { bg: '#FCEAE0', fg: '#C7400E', icon: '⚠' },
  unknown: { bg: '#F0F0F0', fg: '#666666', icon: '–' }
};

/**
 * @param variant 'popup' for the anchored desktop popup (fixed card width),
 *                'sheet' for the mobile bottom sheet (fills its container).
 */
export function facilityCardHTML(p: FacilityProps, variant: 'popup' | 'sheet' = 'popup'): string {
  const sheet = variant === 'sheet';
  // --- 1. Header (identity) ---
  const typeLine = [speciesLabel(p.type), p.optype].filter(Boolean).join(' · ');
  const locLine = [p.city, p.county ? `${p.county} County` : ''].filter(Boolean).join(' · ');
  const active = p.status.toLowerCase() === 'active';
  const statusPill = p.status
    ? `<span class="fp-status" style="background:${active ? '#0DA440' : '#9A9A9A'}">${esc(p.status)}</span>`
    : '';
  const header = `
    <div class="fp-hd">
      <div class="fp-title">
        <span class="fp-dot" style="background:${speciesColor(p.type)}"></span>
        <div class="fp-name">${esc(p.name) || 'Unnamed facility'}</div>
      </div>
      <div class="fp-type">${esc(typeLine)}</div>
      <div class="fp-loc">
        <span>${esc(locLine)}</span>
        ${statusPill}
      </div>
    </div>`;

  // --- 2. Production (hero stats) ---
  const stat = (value: string, label: string) => `
    <div class="fp-stat">
      <div class="fp-stat-val">${value}</div>
      <div class="fp-stat-lbl">${label}</div>
    </div>`;
  const multiSpecies = p.breakdown.includes('·');
  const production = `
    <div class="fp-prod">
      <div class="fp-stats">
        ${stat(commas(p.animals), 'Est. head')}
        ${stat(commas(p.units), 'Animal units')}
        ${stat(compact(p.manure), 'lbs manure/yr')}
      </div>
      ${multiSpecies ? `<div class="fp-breakdown">${esc(p.breakdown)} <span class="fp-au">AU</span></div>` : ''}
    </div>`;

  // --- 3. Compliance (the hook) ---
  const c = complianceSummary(p);
  const tone = TONES[c.tone];
  const permit = (label: string, v: string) => {
    const mark = v === 'Y' ? '✓' : v === 'N' ? '✗' : '—';
    const col = v === 'Y' ? '#0DA440' : v === 'N' ? '#9A9A9A' : '#C8C8C8';
    return `<span class="fp-permit"><span class="fp-permit-lbl">${label}</span> <span style="color:${col}">${mark}</span></span>`;
  };
  const permits = `
    <div class="fp-permits">
      <span class="fp-permits-lbl">Permits</span>
      ${permit('Construction', p.cons)}
      ${permit('NPDES', p.npdes)}
      ${permit('MMP', p.mmp)}
      ${permit('Pindex MMP', p.pindexMmp)}
      ${permit('NMP', p.nmp)}
    </div>`;
  const compliance = `
    <div class="fp-comp">
      <div class="fp-banner" style="background:${tone.bg};color:${tone.fg}">
        <span class="fp-banner-icon">${tone.icon}</span>
        <span>${esc(c.text)}</span>
      </div>
      ${c.tone === 'issues' && p.lastNov ? `<div class="fp-lastnov">Last violation: ${esc(p.lastNov)}</div>` : ''}
      ${sheet ? '' : permits}
    </div>`;

  // --- 4. Footer (resources) ---
  const link = (href: string, label: string) => {
    try {
      const url = new URL(href);
      if (!['https:', 'http:'].includes(url.protocol)) return '';
      return `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
    } catch {
      return '';
    }
  };
  const links = [
    p.dnrUrl ? link(p.dnrUrl, 'Full DNR report') : '',
    p.compUrl ? link(p.compUrl, 'Compliance') : ''
  ]
    .filter(Boolean)
    .join('<span class="fp-sep">·</span>');
  const disclaimer = `<div class="fp-disclaimer">Head counts estimated from animal units (DNR Form 542-0020).${p.stfacid ? ` Facility ID ${esc(p.stfacid)}.` : ''}</div>`;

  // On a phone the permits grid and the estimation note are the two tallest
  // blocks and the two least likely reason for the tap, so they fold away
  // behind a disclosure. The anchored desktop popup has the room and keeps
  // everything open.
  const footer = `
    <div class="fp-ft">
      ${links ? `<div class="fp-links">${links}</div>` : ''}
      ${
        sheet
          ? `<details class="fp-more"><summary>Permits &amp; sources</summary>${permits}${disclaimer}</details>`
          : disclaimer
      }
    </div>`;

  return `<div class="fac-popup${sheet ? ' in-sheet' : ''}">
    ${header}${production}${compliance}${footer}
  </div>`;
}
