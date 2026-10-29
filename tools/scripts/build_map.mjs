// Build the Mollweide SVG map from the dataset.
// Usage: node build_map.mjs <data.json> <admin1_subset.geojson> <out.svg> [zones.geojson]
// <data.json> is data/insanity_procedure_map.json. Legend counts are recomputed from the entities.
import fs from 'node:fs';
import * as d3 from 'd3-geo';
import { geoMollweide } from 'd3-geo-projection';
import * as topojson from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import isoCountries from 'i18n-iso-countries';

const [dataPath, admin1Path, outPath] = process.argv.slice(2);
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const nm = (p) => new URL(`../node_modules/${p}`, import.meta.url);
isoCountries.registerLocale(readJSON(nm('i18n-iso-countries/langs/en.json')));

const COLOURS = ['green', 'yellow', 'purple', 'blue', 'black', 'white'];
const data = readJSON(dataPath);
for (const e of data.entities) {
  if (!COLOURS.includes(e.colour)) throw new Error(`${e.code}: invalid colour ${e.colour}`);
}
const entries = new Map(data.entities.map((e) => [e.code, e]));
const cats = data.categories;
const excluded = new Map((data.scope.excluded || []).map((e) => [e.code, e.reason]));

// ---------------------------------------------------------------- geometry
const world = readJSON(nm('world-atlas/countries-50m.json'));
const worldS = simplify(presimplify(world), quantile(presimplify(world), 0.55));
const SPECIAL = { Somaliland: 'SO-SL', Kosovo: 'XK', 'N. Cyprus': 'CY-N',
  'Indian Ocean Ter.': 'AU-IOT', 'Siachen Glacier': 'IN-SIA' };
const SPECIAL_NAMES = { 'SO-SL': 'Somaliland', XK: 'Kosovo', 'CY-N': 'Northern Cyprus',
  'AU-IOT': 'Australian Indian Ocean Territories', 'IN-SIA': 'Siachen Glacier' };
// Short names where the ISO library gives a formal one.
const SHORT_NAMES = { TW: 'Taiwan', MD: 'Moldova', FM: 'Micronesia', IR: 'Iran', RU: 'Russia', TZ: 'Tanzania',
  SY: 'Syria', LA: 'Laos', BN: 'Brunei', VA: 'Vatican City', FK: 'Falkland Islands', MK: 'North Macedonia',
  CZ: 'Czechia', US: 'United States', PS: 'Palestine', CI: 'Côte d’Ivoire', KR: 'South Korea', TR: 'Turkey',
  CN: 'China', CV: 'Cabo Verde', VN: 'Vietnam' };
// A jurisdiction with its own entry takes the (curated) name of that entry.
const displayName = (code, geoName) => entries.get(code)?.name || geoName;
const countries = topojson.feature(worldS, worldS.objects.countries).features
  .map((f) => {
    const code = f.id ? isoCountries.numericToAlpha2(f.id) : SPECIAL[f.properties.name];
    const geoName = SHORT_NAMES[code] || isoCountries.getName(code, 'en') || SPECIAL_NAMES[code] || f.properties.name;
    return { code, name: displayName(code, geoName), geo: f };
  })
  .filter((c) => c.code !== 'AQ'); // Antarctica dropped

const admin1 = readJSON(admin1Path);
const aTopo = presimplify(topology({ a: admin1 }, 1e6));
const aTopoS = simplify(aTopo, quantile(aTopo, 0.93));
const subByParent = new Map();
{
  const geoms = aTopoS.objects.a.geometries;
  const byCode = new Map();
  for (const g of geoms) {
    const k = g.properties.code;
    if (!byCode.has(k)) byCode.set(k, []);
    byCode.get(k).push(g);
  }
  for (const [code, gs] of byCode) {
    const parent = gs[0].properties.parent;
    const geo = { type: 'Feature', properties: {}, geometry: topojson.merge(aTopoS, gs) };
    if (!subByParent.has(parent)) subByParent.set(parent, []);
    subByParent.get(parent).push({ code, name: displayName(code, gs[0].properties.name), parent, geo });
  }
}
// A parent is drawn by sub-national unit when the data holds at least one entry for it.
const parentsWithSubs = new Set(
  data.entities.filter((e) => e.level === 'subdivision' && e.parent && subByParent.has(e.parent)
    && subByParent.get(e.parent).some((s) => s.code === e.code)).map((e) => e.parent));

// Areas drawn white on top of their country, with the exclusion reason (occupied Ukraine, Transnistria).
const zonesPath = process.argv[5] || new URL('../geo/zones_excluded.geojson', import.meta.url).pathname;
const zones = fs.existsSync(zonesPath)
  ? readJSON(zonesPath).features.map((f) => ({ code: f.properties.code, name: f.properties.name,
    parent: f.properties.parent, geo: f }))
  : [];

// Territories coloured with their parent when they have no entry of their own (same criminal procedure).
const ATTACHED = data.scope.attached_territories || {};

// ---------------------------------------------------------------- projection
const W = 2000, MAP_TOP = 118, MAP_H = 1000, H = MAP_TOP + MAP_H + 315;
const projection = geoMollweide().fitExtent([[6, MAP_TOP], [W - 6, MAP_TOP + MAP_H]], { type: 'Sphere' });
const path = d3.geoPath(projection).digits(1);

// ---------------------------------------------------------------- helpers
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const entryFor = (code, parent) => entries.get(code) || (parent && entries.get(parent))
  || (ATTACHED[code] && entries.get(ATTACHED[code])) || null;
function colourOf(code, parent) {
  if (excluded.has(code)) return 'white';
  const e = entryFor(code, parent);
  return e ? e.colour : 'white';
}
function tooltip(code, name, parent) {
  if (excluded.has(code)) return `${name} — not coloured: ${excluded.get(code)}`;
  const e = entryFor(code, parent);
  if (!e) return `${name} — outside the scope`;
  if (e.colour === 'white') {
    const hyp = e.hypothetical_colour && cats[e.hypothetical_colour]
      ? `\nHypothesis not retained for lack of a readable text: “${cats[e.hypothetical_colour].label}”` : '';
    return `${name} — insufficient data\n${e.note || ''}${hyp}`;
  }
  const inherited = e.code !== code ? `\n(rule of ${e.name})` : '';
  const conf = e.confidence ? `\nConfidence: ${e.confidence}` : '';
  const check = e.independent_check && e.independent_check.verdict
    ? `\nIndependent check: ${e.independent_check.verdict}` : '';
  return `${name} — ${cats[e.colour].label}${inherited}\n${e.legal_bases || ''}\n${e.note || ''}${conf}${check}`;
}

// ---------------------------------------------------------------- shapes
const shapes = []; // {code, name, parent, d, colour, sub, background}
for (const c of countries) {
  if (parentsWithSubs.has(c.code)) {
    // parent filled first (hides hairline gaps), then its units on top
    shapes.push({ code: c.code, name: c.name, d: path(c.geo), colour: colourOf(c.code), background: true });
    for (const s of subByParent.get(c.code)) {
      shapes.push({ code: s.code, name: s.name, parent: c.code, d: path(s.geo),
        colour: colourOf(s.code, c.code), sub: true, geo: s.geo });
    }
  } else {
    shapes.push({ code: c.code, name: c.name, d: path(c.geo), colour: colourOf(c.code), geo: c.geo });
  }
}

// small entities in scope get a circle marker
const MANUAL_MARKERS = data.scope.markers || {}; // code -> [lon, lat]
const markers = [];
for (const s of shapes) {
  if (s.background || s.colour === 'white' || ATTACHED[s.code]) continue;
  // a small federated unit only gets a marker when its colour differs from its country's
  if (s.sub && s.colour === colourOf(s.parent)) continue;
  const area = s.geo ? path.area(s.geo) : 0;
  if (area < 60 || MANUAL_MARKERS[s.code]) {
    const ll = MANUAL_MARKERS[s.code];
    const [x, y] = ll ? projection(ll) : path.centroid(s.geo);
    markers.push({ code: s.code, name: s.name, parent: s.parent, x, y, colour: s.colour });
  }
}
for (const [code, ll] of Object.entries(MANUAL_MARKERS)) {
  if (markers.some((m) => m.code === code) || !entries.has(code)) continue;
  const e = entries.get(code);
  if (e.colour === 'white') continue;
  const [x, y] = projection(ll);
  markers.push({ code, name: e.name, x, y, colour: e.colour });
}

// ---------------------------------------------------------------- legend counts
// A federal country whose units differ counts through its units; a country ruled uniformly counts once;
// sub-national entries not drawn as admin units (stand-alone territories: Greenland, Puerto Rico…) count as
// subdivisions.
const COUNTS = (() => {
  const units = new Map([...subByParent].map(([par, subs]) => [par, [...new Set(subs.map((s) => s.code))]]));
  const drawn = (e) => e.level === 'subdivision' && e.parent && units.has(e.parent) && units.get(e.parent).includes(e.code);
  const varies = new Set();
  const byUnit = {};
  const uniform = {};
  for (const par of new Set(data.entities.filter(drawn).map((e) => e.parent))) {
    const cols = units.get(par).map((code) => (entries.get(code) || entries.get(par))?.colour || 'white');
    if (new Set(cols).size > 1) {
      varies.add(par);
      for (const c of cols) byUnit[c] = (byUnit[c] || 0) + 1;
    } else if (!entries.has(par)) {
      uniform[cols[0]] = (uniform[cols[0]] || 0) + 1; // country without a national entry whose units share one colour
    }
  }
  const countries = {}, subdivisions = {};
  for (const k of COLOURS) {
    countries[k] = data.entities.filter((e) => e.level === 'country' && !varies.has(e.code) && e.colour === k).length + (uniform[k] || 0);
    subdivisions[k] = (byUnit[k] || 0) + data.entities.filter((e) => e.level === 'subdivision' && !drawn(e) && e.colour === k).length;
  }
  return { countries, subdivisions };
})();
const countText = (p, s) => ` — ${p} ${p === 1 ? 'country' : 'countries'}`
  + (s ? ` and ${s} ${s > 1 ? 'subdivisions or territories' : 'subdivision or territory'}` : '');

// ---------------------------------------------------------------- svg
const L = [];
const t = (s) => L.push(s);
t('<?xml version="1.0" encoding="UTF-8"?>');
t(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="title desc" xml:lang="en">`);
t(`  <title id="title">${esc(data.title)}</title>`);
t(`  <desc id="desc">${esc(data.description)}</desc>`);
t('  <style>');
t('    svg { background: #ffffff; }');
t('    text { font-family: "Helvetica Neue", Arial, "DejaVu Sans", sans-serif; fill: #1f2328; }');
t('    .sea { fill: #dfe5ec; }');
t('    .graticule { fill: none; stroke: #ffffff; stroke-width: 0.6; stroke-opacity: 0.8; }');
t('    .outline { fill: none; stroke: #8f9aa6; stroke-width: 1; }');
t('    .country { stroke: #7d8691; stroke-width: 0.4; stroke-linejoin: round; }');
t('    .sub { stroke: #ffffff; stroke-width: 0.45; stroke-linejoin: round; }');
t('    .sub.white, .sub.yellow { stroke: #9aa3ad; }');
t('    .country:hover, .sub:hover, .marker:hover { stroke: #000000; stroke-width: 1.2; }');
for (const k of COLOURS) t(`    .${k} { fill: ${cats[k].colour}; }`);
t('    .marker { stroke: #222222; stroke-width: 0.8; }');
t('    .excluded-zone { stroke: #59626c; stroke-width: 0.7; stroke-dasharray: 3 1.6; stroke-linejoin: round; }');
t('    .excluded-zone:hover { stroke: #000000; stroke-width: 1.2; }');
t('    .title { font-size: 34px; font-weight: 700; }');
t('    .subtitle { font-size: 17px; fill: #4a525b; }');
t('    .legend-title { font-size: 17px; font-weight: 700; }');
t('    .legend-item { font-size: 15px; }');
t('    .legend-text { font-size: 13px; fill: #4a525b; }');
t('    .footer { font-size: 12px; fill: #5b636c; }');
t('  </style>');
t(`  <text class="title" x="${W / 2}" y="46" text-anchor="middle">${esc(data.title)}</text>`);
t(`  <text class="subtitle" x="${W / 2}" y="78" text-anchor="middle">${esc(data.subtitle)}</text>`);
t(`  <text class="subtitle" x="${W / 2}" y="101" text-anchor="middle">${esc(data.subtitle_2 || '')}</text>`);
t('  <g id="background">');
t(`    <path class="sea" d="${path({ type: 'Sphere' })}"/>`);
t(`    <path class="graticule" d="${path(d3.geoGraticule().step([30, 30])())}"/>`);
t('  </g>');
t('  <g id="countries">');
for (const s of shapes) {
  if (!s.d) continue;
  const cls = `${s.sub ? 'sub' : 'country'} ${s.colour}${excluded.has(s.code) && s.code.includes('-') ? ' excluded-zone' : ''}`;
  t(`    <path id="${esc(s.code)}${s.background ? '-background' : ''}" data-code="${esc(s.code)}" class="${cls}" d="${s.d}"><title>${esc(tooltip(s.code, s.name, s.parent))}</title></path>`);
}
t('  </g>');
// national outlines of countries drawn by unit
t('  <g id="national-outlines" fill="none" stroke="#6f7883" stroke-width="0.6">');
for (const c of countries) if (parentsWithSubs.has(c.code)) t(`    <path d="${path(c.geo)}"/>`);
t('  </g>');
t('  <g id="excluded-zones">');
for (const z of zones) {
  const reason = excluded.get(z.code) || 'excluded from the scope';
  t(`    <path id="${esc(z.code)}" data-code="${esc(z.code)}" class="white excluded-zone" d="${path(z.geo)}"><title>${esc(`${z.name} — not coloured: ${reason}`)}</title></path>`);
}
t('  </g>');
t('  <g id="small-states">');
for (const m of markers) {
  t(`    <circle class="marker ${m.colour}" data-code="${esc(m.code)}" cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="4.2"><title>${esc(tooltip(m.code, m.name, m.parent))}</title></circle>`);
}
t('  </g>');
t(`  <path class="outline" d="${path({ type: 'Sphere' })}"/>`);

// legend
const LEG_Y = MAP_TOP + MAP_H + 34;
t('  <g id="legend">');
t(`    <text class="legend-title" x="40" y="${LEG_Y}">Discernment totally abolished at the time of the act: what happens next?</text>`);
COLOURS.forEach((k, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = 40 + col * 980, y = LEG_Y + 24 + row * 58;
  const c = cats[k];
  t(`    <rect class="${k}" x="${x}" y="${y}" width="30" height="20" rx="2" stroke="#6f7883" stroke-width="0.8"/>`);
  const n = k === 'white' ? '' : countText(COUNTS.countries[k], COUNTS.subdivisions[k]);
  t(`    <text class="legend-item" x="${x + 42}" y="${y + 15}"><tspan font-weight="700">${esc(c.label)}</tspan>${esc(n)}</text>`);
  const lines = Array.isArray(c.legend) ? c.legend : [c.legend];
  lines.forEach((ln, j) => t(`    <text class="legend-text" x="${x + 42}" y="${y + 33 + j * 16}">${esc(ln)}</text>`));
});
const YR = LEG_Y + 24 + 3 * 58 + 4;
t(`    <circle class="marker white" cx="${55}" cy="${YR}" r="4.2"/>`);
t(`    <text class="legend-text" x="82" y="${YR + 4}">${esc(data.marker_note)}</text>`);
t('  </g>');
(Array.isArray(data.footer) ? data.footer : [data.footer]).forEach((ln, j, arr) =>
  t(`  <text class="footer" x="40" y="${H - 14 - (arr.length - 1 - j) * 15}">${esc(ln)}</text>`));
t('</svg>');
fs.writeFileSync(outPath, L.join('\n') + '\n');
console.log('counts', JSON.stringify(COUNTS));
console.log('shapes', shapes.length, 'markers', markers.length, 'subdivided', [...parentsWithSubs].join(','),
  'bytes', fs.statSync(outPath).size);
