/**
 * Address suggestions, via the U.S. Census Bureau geocoder.
 *
 * Chosen over the OSM-based services because it's the only free, key-less one
 * that reliably resolves *rural* Iowa addresses to the house number — exactly
 * where CAFOs are. (Spot-checked against addresses from our own dataset:
 * Census matched them exactly; Photon/Nominatim returned the town or the
 * wrong street.) It's public-domain, needs no signup, and has no quota.
 *
 * The catch: the endpoint sends no Access-Control-Allow-Origin header, so a
 * plain fetch() is blocked by CORS. It does officially support JSONP, which is
 * what we use here — that keeps the whole site static, with no proxy to run.
 *
 * It has no dedicated typeahead endpoint, but it doesn't need one: a partial
 * address returns *every* candidate that matches (up to 50), each with its own
 * coordinates, in ~150-270ms. That's the suggestion list, and picking one costs
 * no further request.
 */

const ENDPOINT = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
const BENCHMARK = 'Public_AR_Current';
const TIMEOUT_MS = 12000;

export interface GeocodeResult {
  lat: number;
  lon: number;
  /** "1200 Grand Ave, Des Moines" — street + town, for the suggestion row. */
  line: string;
  /** Town, used to order suggestions from several queries into one list. */
  city: string;
  zip: string;
  /** Full matched address, shown once the search is applied. */
  label: string;
}

/**
 * Street types tried when the user hasn't named one.
 *
 * Census matches whole street names, never prefixes, and it rejects a bare name
 * whenever the type is ambiguous: "2300 Grand" finds nothing while "2300 Grand
 * Ave" finds six, and "500 Main" finds one where "500 Main St" finds fifty. In
 * our own dataset Street and Avenue account for ~92% of addresses and Road for
 * another ~5%, so these four cover nearly everything. They cost one extra
 * round-trip each and only fire when the query names no type itself.
 */
const STREET_TYPES = ['St', 'Ave', 'Rd', 'Dr'];

const TYPE_RE =
  /\b(st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|ct|court|cir|circle|pl|place|ter|terrace|trl|trail|way|hwy|highway|pkwy|parkway)\b/i;

/** The street portion of a query — everything before the town. */
const streetPart = (q: string) => {
  const i = q.indexOf(',');
  return i === -1 ? q : q.slice(0, i);
};

/** Insert a street type after the street name, not at the end of the query. */
function withType(query: string, type: string): string {
  const i = query.indexOf(',');
  return i === -1 ? `${query} ${type}` : `${query.slice(0, i)} ${type}${query.slice(i)}`;
}

/** Thrown when the lookup itself fails (offline, blocked, timeout, outage). */
export class GeocodeError extends Error {}

/**
 * A state or ZIP only ever ends an address, so anchor the test there. The
 * anchoring is load-bearing: rural Iowa house numbers are routinely five digits
 * ("53020 Hitchcock Ave"), and an unanchored \d{5} reads that as a ZIP, skips
 * the bias below, and then matches nothing at all.
 */
const ENDS_WITH_LOCALE = /(?:\b(?:ia|iowa)\b|\b\d{5}(?:-\d{4})?)[\s,]*$/i;

/**
 * This map is Iowa-only, so an address with no state or ZIP is assumed to be in
 * Iowa. That assumption is what makes short queries useful: "2143 215th Rd"
 * alone matches nothing, while "2143 215th Rd, IA" returns every Iowa street
 * with that number for the user to pick from.
 */
function biasToIowa(query: string): string {
  return ENDS_WITH_LOCALE.test(query) ? query : `${query}, IA`;
}

let seq = 0;

/**
 * Candidate addresses for a partial query, best-effort and capped at `limit`.
 * Returns [] when the geocoder ran fine but recognised nothing — callers should
 * treat that as "no match", not as a failure.
 */
export async function suggestAddresses(query: string, limit = 8): Promise<GeocodeResult[]> {
  const variants = [query];
  if (!TYPE_RE.test(streetPart(query))) {
    for (const type of STREET_TYPES) variants.push(withType(query, type));
  }

  const settled = await Promise.allSettled(variants.map((v) => jsonp(biasToIowa(v))));
  // Only a total failure is an error; if one variant times out we still have
  // the others, and a rejected variant just contributes nothing.
  const replies = settled.filter((r) => r.status === 'fulfilled');
  if (!replies.length) throw (settled[0] as PromiseRejectedResult).reason;

  const out: GeocodeResult[] = [];
  const seen = new Set<string>();
  for (const r of replies) {
    const matches =
      (r.value as { result?: { addressMatches?: unknown[] } })?.result?.addressMatches ?? [];
    for (const m of matches) {
      const hit = toResult(m);
      // The geocoder returns the same address from both sides of a street, and
      // the variants above overlap by design.
      if (!hit || seen.has(hit.label)) continue;
      seen.add(hit.label);
      out.push(hit);
    }
  }

  // Merged results arrive grouped by variant, which is meaningless to a reader
  // scanning for their town — order by town instead.
  out.sort((a, b) => a.city.localeCompare(b.city) || a.label.localeCompare(b.label));
  return out.slice(0, limit);
}

function toResult(match: unknown): GeocodeResult | null {
  const m = match as
    | {
        coordinates?: { x?: number; y?: number };
        matchedAddress?: string;
        addressComponents?: { zip?: string };
      }
    | undefined;

  const x = m?.coordinates?.x;
  const y = m?.coordinates?.y;
  if (typeof x !== 'number' || typeof y !== 'number') return null;

  const label = titleCase(m?.matchedAddress ?? '');
  // "1200 Grand Ave, Des Moines, IA, 50309" -> street + town, dropping the
  // state and ZIP, which the row shows separately (or not at all).
  const parts = label.split(', ');
  return {
    lat: y,
    lon: x,
    line: parts.length > 2 ? parts.slice(0, -2).join(', ') : label,
    city: parts.length > 2 ? parts[parts.length - 3] : '',
    zip: m?.addressComponents?.zip ?? '',
    label
  };
}

/**
 * Census echoes our callback name back as executable JS, so it has to be a
 * fresh, syntactically safe identifier we control — never user input.
 */
function jsonp(address: string): Promise<unknown> {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const name = `__cafoGeocode${++seq}`;
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      delete (window as unknown as Record<string, unknown>)[name];
      script.remove();
    };
    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new GeocodeError(msg));
    };

    const timer = setTimeout(() => fail('The address lookup timed out.'), TIMEOUT_MS);

    (window as unknown as Record<string, unknown>)[name] = (payload: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(payload);
    };

    script.onerror = () => fail("Couldn't reach the address lookup service.");
    script.src =
      `${ENDPOINT}?address=${encodeURIComponent(address)}` +
      `&benchmark=${BENCHMARK}&format=jsonp&callback=${name}`;
    document.head.appendChild(script);
  });
}

/**
 * Census returns "1200 GRAND AVE, DES MOINES, IA, 50309". Title-case the
 * street and city, and leave the trailing state code and ZIP untouched.
 */
function titleCase(matched: string): string {
  const parts = matched.split(', ');
  return parts
    .map((part, i) => {
      if (i >= parts.length - 2) return part;
      return part
        .split(' ')
        // Words starting with a digit are house numbers or ordinal street
        // names ("215TH"), which read better fully lowercased after the digits.
        .map((w) => (/^\d/.test(w) ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase()))
        .join(' ');
    })
    .join(', ');
}
