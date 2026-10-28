// Build the Mollweide SVG map from the research JSON.
// Usage: node build_map.mjs <data.json> <admin1_subset.geojson> <out.svg> [zones.geojson]
// <data.json> is either the English edition (English keys: title, categories.green, entities…) or the French
// working edition (French keys: titre, categories.vert, entites…). The interface language follows the file
// (override with MAP_LANG=en|fr). Legend counts are always recomputed from the entities.
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

// English-schema file -> internal (French-keyed) structure used below.
const C_EN = { green: 'vert', yellow: 'jaune', purple: 'violet', blue: 'bleu', black: 'noir', white: 'blanc' };
function depuisAnglais(d) {
  const categories = {};
  for (const [k, c] of Object.entries(d.categories)) {
    categories[C_EN[k]] = { libelle: c.label, couleur: c.colour, legende: c.legend, definition: c.definition };
  }
  return {
    titre: d.title, description: d.description, sous_titre: d.subtitle, sous_titre_2: d.subtitle_2,
    legende_reperes: d.marker_note, pied: d.footer, categories,
    perimetre: {
      exclus: (d.scope.excluded || []).map((x) => ({ code: x.code, nom: x.name, raison: x.reason })),
      marqueurs: d.scope.markers || {}, territoires_rattaches: d.scope.attached_territories || {},
    },
    entites: d.entities.map((e) => ({
      code: e.code, nom: e.name, niveau: e.level === 'country' ? 'pays' : 'subdivision', parent: e.parent,
      couleur: C_EN[e.colour], couleur_hypothese: e.hypothetical_colour ? C_EN[e.hypothetical_colour] : undefined,
      confiance: e.confidence, note: e.note, bases_legales: e.legal_bases,
      controle_independant: e.independent_check ? { verdict: e.independent_check.verdict } : undefined,
    })),
  };
}
const brut = readJSON(dataPath);
const anglais = Array.isArray(brut.entities);
for (const e of anglais ? brut.entities : brut.entites) {
  const c = anglais ? C_EN[e.colour] : e.couleur;
  if (!['vert', 'jaune', 'violet', 'bleu', 'noir', 'blanc'].includes(c)) throw new Error(`${e.code}: invalid colour ${e.colour ?? e.couleur}`);
}

// Interface language: English for the English edition (or MAP_LANG=en with a French-keyed file whose texts are in English).
const LANG = process.env.MAP_LANG ? (process.env.MAP_LANG === 'en' ? 'en' : 'fr') : (anglais ? 'en' : 'fr');
isoCountries.registerLocale(readJSON(nm(`i18n-iso-countries/langs/${LANG}.json`)));
const UI = {
  fr: {
    nonColore: 'non coloré :', horsPerimetre: 'hors périmètre', insuffisant: 'données insuffisantes',
    hypothese: (l) => `Hypothèse non retenue faute de texte lisible : « ${l} »`, regleDe: (n) => `(règle de ${n})`,
    confiance: 'Confiance : ', controle: 'Contrôle indépendant : ', ecarte: 'écarté du périmètre',
    legTitre: 'Abolition totale du discernement au moment des faits : que se passe-t-il ?',
    compte: (p, s) => ` — ${p} pays${s ? ` et ${s} ${s > 1 ? 'subdivisions ou territoires' : 'subdivision ou territoire'}` : ''}`,
  },
  en: {
    nonColore: 'not coloured:', horsPerimetre: 'outside the scope', insuffisant: 'insufficient data',
    hypothese: (l) => `Hypothesis not retained for lack of a readable text: “${l}”`, regleDe: (n) => `(rule of ${n})`,
    confiance: 'Confidence: ', controle: 'Independent check: ', ecarte: 'excluded from the scope',
    legTitre: 'Discernment totally abolished at the time of the act: what happens next?',
    compte: (p, s) => ` — ${p} ${p === 1 ? 'country' : 'countries'}${s ? ` and ${s} ${s > 1 ? 'subdivisions or territories' : 'subdivision or territory'}` : ''}`,
  },
}[LANG];

const data = anglais ? depuisAnglais(brut) : brut;
const entries = new Map(data.entites.map((e) => [e.code, e]));
const cats = data.categories;
const exclus = new Map(data.perimetre.exclus.map((e) => [e.code, e.raison]));

// ---------------------------------------------------------------- geometry
const world = readJSON(nm('world-atlas/countries-50m.json'));
const worldS = simplify(presimplify(world), quantile(presimplify(world), 0.55));
const SPECIAL = { Somaliland: 'SO-SL', Kosovo: 'XK', 'N. Cyprus': 'CY-N',
  'Indian Ocean Ter.': 'AU-IOT', 'Siachen Glacier': 'IN-SIA' };
const NOMS_SPECIAUX = LANG === 'en'
  ? { 'SO-SL': 'Somaliland', XK: 'Kosovo', 'CY-N': 'Northern Cyprus',
    'AU-IOT': 'Australian Indian Ocean Territories', 'IN-SIA': 'Siachen Glacier' }
  : { 'SO-SL': 'Somaliland', XK: 'Kosovo', 'CY-N': 'Chypre du Nord',
    'AU-IOT': 'Territoires australiens de l’océan Indien', 'IN-SIA': 'Glacier de Siachen' };
// Short English names where the ISO library gives a formal one.
const EN_COURTS = { TW: 'Taiwan', MD: 'Moldova', FM: 'Micronesia', IR: 'Iran', RU: 'Russia', TZ: 'Tanzania',
  SY: 'Syria', LA: 'Laos', BN: 'Brunei', VA: 'Vatican City', FK: 'Falkland Islands', MK: 'North Macedonia',
  CZ: 'Czechia', US: 'United States', PS: 'Palestine', CI: 'Côte d’Ivoire', KR: 'South Korea', TR: 'Turkey',
  CN: 'China', CV: 'Cabo Verde', VN: 'Vietnam' };
// In the English edition, a jurisdiction with its own entry takes the (curated) name of that entry.
const nomAffiche = (code, nomGeo) => (LANG === 'en' && entries.get(code)?.nom) || nomGeo;
const countries = topojson.feature(worldS, worldS.objects.countries).features
  .map((f) => {
    const code = f.id ? isoCountries.numericToAlpha2(f.id) : SPECIAL[f.properties.name];
    const nomGeo = (LANG === 'en' && EN_COURTS[code]) || isoCountries.getName(code, LANG) || NOMS_SPECIAUX[code] || f.properties.name;
    return { code, nom: nomAffiche(code, nomGeo), geo: f };
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
    const nomGeo = LANG === 'en' ? (gs[0].properties.nom_en || gs[0].properties.nom) : gs[0].properties.nom;
    subByParent.get(parent).push({ code, nom: nomAffiche(code, nomGeo), parent, geo });
  }
}
// A parent is drawn by sub-national unit when the data holds at least one entry for it.
const parentsWithSubs = new Set(
  data.entites.filter((e) => e.niveau === 'subdivision' && e.parent && subByParent.has(e.parent)
    && subByParent.get(e.parent).some((s) => s.code === e.code)).map((e) => e.parent));

// Areas drawn white on top of their country, with the exclusion reason (occupied Ukraine, Transnistria).
const zonesPath = process.argv[5] || ['../geo/zones_excluded.geojson', '../../geo/zones_exclues.geojson']
  .map((p) => new URL(p, import.meta.url).pathname).find((p) => fs.existsSync(p)) || '';
const zones = fs.existsSync(zonesPath)
  ? readJSON(zonesPath).features.map((f) => ({ code: f.properties.code,
    nom: (LANG === 'en' && f.properties.nom_en) || f.properties.nom, parent: f.properties.parent, geo: f }))
  : [];

// Territories coloured with their parent when no own entry exists (same criminal procedure).
const TERRITOIRES = data.perimetre.territoires_rattaches || {};

// ---------------------------------------------------------------- projection
const W = 2000, MAP_TOP = 118, MAP_H = 1000, H = MAP_TOP + MAP_H + 315;
const projection = geoMollweide().fitExtent([[6, MAP_TOP], [W - 6, MAP_TOP + MAP_H]], { type: 'Sphere' });
const path = d3.geoPath(projection).digits(1);

// ---------------------------------------------------------------- helpers
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const entryFor = (code, parent) => entries.get(code) || (parent && entries.get(parent))
  || (TERRITOIRES[code] && entries.get(TERRITOIRES[code])) || null;
function couleurDe(code, parent) {
  if (exclus.has(code)) return 'blanc';
  const e = entryFor(code, parent);
  return e ? e.couleur : 'blanc';
}
function infobulle(code, nom, parent) {
  if (exclus.has(code)) return `${nom} — ${UI.nonColore} ${exclus.get(code)}`;
  const e = entryFor(code, parent);
  if (!e) return `${nom} — ${UI.horsPerimetre}`;
  if (e.couleur === 'blanc') {
    const hyp = e.couleur_hypothese && cats[e.couleur_hypothese]
      ? `\n${UI.hypothese(cats[e.couleur_hypothese].libelle)}` : '';
    return `${nom} — ${UI.insuffisant}\n${e.note || ''}${hyp}`;
  }
  const herite = e.code !== code ? `\n${UI.regleDe(e.nom)}` : '';
  const conf = e.confiance ? `\n${UI.confiance}${e.confiance}` : '';
  const ctl = e.controle_independant && e.controle_independant.verdict
    ? `\n${UI.controle}${e.controle_independant.verdict}` : '';
  return `${nom} — ${cats[e.couleur].libelle}${herite}\n${e.bases_legales || ''}\n${e.note || ''}${conf}${ctl}`;
}

// ---------------------------------------------------------------- shapes
const shapes = []; // {code, nom, parent, d, couleur, sub}
for (const c of countries) {
  if (parentsWithSubs.has(c.code)) {
    // parent filled first (hides hairline gaps), then its units on top
    shapes.push({ code: c.code, nom: c.nom, d: path(c.geo), couleur: couleurDe(c.code), fond: true });
    for (const s of subByParent.get(c.code)) {
      shapes.push({ code: s.code, nom: s.nom, parent: c.code, d: path(s.geo),
        couleur: couleurDe(s.code, c.code), sub: true, geo: s.geo });
    }
  } else {
    shapes.push({ code: c.code, nom: c.nom, d: path(c.geo), couleur: couleurDe(c.code), geo: c.geo });
  }
}

// small entities in scope get a circle marker
const MARQUEURS_MANUELS = data.perimetre.marqueurs || {}; // code -> [lon, lat]
const RATTACHES_M = data.perimetre.territoires_rattaches || {}; // pieces of another unit: no marker of their own
const marqueurs = [];
for (const s of shapes) {
  if (s.fond || s.couleur === 'blanc' || RATTACHES_M[s.code]) continue;
  // a small federated unit only gets a marker when its colour differs from its country's
  if (s.sub && s.couleur === couleurDe(s.parent)) continue;
  const area = s.geo ? path.area(s.geo) : 0;
  if (area < 60 || MARQUEURS_MANUELS[s.code]) {
    const ll = MARQUEURS_MANUELS[s.code];
    const [x, y] = ll ? projection(ll) : path.centroid(s.geo);
    marqueurs.push({ code: s.code, nom: s.nom, parent: s.parent, x, y, couleur: s.couleur });
  }
}
for (const [code, ll] of Object.entries(MARQUEURS_MANUELS)) {
  if (marqueurs.some((m) => m.code === code) || !entries.has(code)) continue;
  const e = entries.get(code);
  if (e.couleur === 'blanc') continue;
  const [x, y] = projection(ll);
  marqueurs.push({ code, nom: e.nom, x, y, couleur: e.couleur });
}

// ---------------------------------------------------------------- svg
const L = [];
const t = (s) => L.push(s);
// Legend counts (same rule as the merge script): a federal country whose units differ counts through its units;
// a country ruled uniformly counts once; sub-national entries not drawn as admin units (stand-alone territories:
// Greenland, Puerto Rico…) count as subdivisions.
const COMPTES = (() => {
  const unites = new Map([...subByParent].map(([par, subs]) => [par, [...new Set(subs.map((s) => s.code))]]));
  const dessinee = (e) => e.niveau === 'subdivision' && e.parent && unites.has(e.parent) && unites.get(e.parent).includes(e.code);
  const varie = new Set();
  const parUnite = {};
  for (const par of new Set(data.entites.filter(dessinee).map((e) => e.parent))) {
    const cols = unites.get(par).map((code) => (entries.get(code) || entries.get(par))?.couleur || 'blanc');
    if (new Set(cols).size > 1) {
      varie.add(par);
      for (const c of cols) parUnite[c] = (parUnite[c] || 0) + 1;
    }
  }
  const pays = {}, subs = {};
  for (const k of Object.keys(cats)) {
    pays[k] = data.entites.filter((e) => e.niveau === 'pays' && !varie.has(e.code) && e.couleur === k).length;
    subs[k] = (parUnite[k] || 0) + data.entites.filter((e) => e.niveau === 'subdivision' && !dessinee(e) && e.couleur === k).length;
  }
  return { pays, subs };
})();
t('<?xml version="1.0" encoding="UTF-8"?>');
t(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="titre desc" xml:lang="${LANG}">`);
t(`  <title id="titre">${esc(data.titre)}</title>`);
t(`  <desc id="desc">${esc(data.description)}</desc>`);
t('  <style>');
t('    svg { background: #ffffff; }');
t('    text { font-family: "Helvetica Neue", Arial, "DejaVu Sans", sans-serif; fill: #1f2328; }');
t('    .mer { fill: #dfe5ec; }');
t('    .graticule { fill: none; stroke: #ffffff; stroke-width: 0.6; stroke-opacity: 0.8; }');
t('    .contour { fill: none; stroke: #8f9aa6; stroke-width: 1; }');
t('    .pays { stroke: #7d8691; stroke-width: 0.4; stroke-linejoin: round; }');
t('    .sub { stroke: #ffffff; stroke-width: 0.45; stroke-linejoin: round; }');
t('    .sub.blanc, .sub.jaune { stroke: #9aa3ad; }');
t('    .pays:hover, .sub:hover, .repere:hover { stroke: #000000; stroke-width: 1.2; }');
for (const [k, c] of Object.entries(cats)) t(`    .${k} { fill: ${c.couleur}; }`);
t('    .repere { stroke: #222222; stroke-width: 0.8; }');
t('    .zone-exclue { stroke: #59626c; stroke-width: 0.7; stroke-dasharray: 3 1.6; stroke-linejoin: round; }');
t('    .zone-exclue:hover { stroke: #000000; stroke-width: 1.2; }');
t('    .titre { font-size: 34px; font-weight: 700; }');
t('    .soustitre { font-size: 17px; fill: #4a525b; }');
t('    .leg-titre { font-size: 17px; font-weight: 700; }');
t('    .leg { font-size: 15px; }');
t('    .leg-def { font-size: 13px; fill: #4a525b; }');
t('    .pied { font-size: 12px; fill: #5b636c; }');
t('  </style>');
t(`  <text class="titre" x="${W / 2}" y="46" text-anchor="middle">${esc(data.titre)}</text>`);
t(`  <text class="soustitre" x="${W / 2}" y="78" text-anchor="middle">${esc(data.sous_titre)}</text>`);
t(`  <text class="soustitre" x="${W / 2}" y="101" text-anchor="middle">${esc(data.sous_titre_2 || '')}</text>`);
t('  <g id="fond">');
t(`    <path class="mer" d="${path({ type: 'Sphere' })}"/>`);
t(`    <path class="graticule" d="${path(d3.geoGraticule().step([30, 30])())}"/>`);
t('  </g>');
t('  <g id="pays">');
for (const s of shapes) {
  if (!s.d) continue;
  const cls = `${s.sub ? 'sub' : 'pays'} ${s.couleur}`;
  t(`    <path id="${esc(s.code)}${s.fond ? '-fond' : ''}" data-code="${esc(s.code)}" class="${cls}" d="${s.d}"><title>${esc(infobulle(s.code, s.nom, s.parent))}</title></path>`);
}
t('  </g>');
// national outlines of countries drawn by unit
t('  <g id="contours-nationaux" fill="none" stroke="#6f7883" stroke-width="0.6">');
for (const c of countries) if (parentsWithSubs.has(c.code)) t(`    <path d="${path(c.geo)}"/>`);
t('  </g>');
t('  <g id="zones-exclues">');
for (const z of zones) {
  const raison = exclus.get(z.code) || UI.ecarte;
  t(`    <path id="${esc(z.code)}" data-code="${esc(z.code)}" class="blanc zone-exclue" d="${path(z.geo)}"><title>${esc(`${z.nom} — ${UI.nonColore} ${raison}`)}</title></path>`);
}
t('  </g>');
t('  <g id="petits-etats">');
for (const m of marqueurs) {
  t(`    <circle class="repere ${m.couleur}" data-code="${esc(m.code)}" cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="4.2"><title>${esc(infobulle(m.code, m.nom, m.parent))}</title></circle>`);
}
t('  </g>');
t(`  <path class="contour" d="${path({ type: 'Sphere' })}"/>`);

// legend
const LEG_Y = MAP_TOP + MAP_H + 34;
t('  <g id="legende">');
t(`    <text class="leg-titre" x="40" y="${LEG_Y}">${esc(UI.legTitre)}</text>`);
const ordre = ['vert', 'jaune', 'violet', 'bleu', 'noir', 'blanc'];
ordre.forEach((k, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = 40 + col * 980, y = LEG_Y + 24 + row * 58;
  const c = cats[k];
  t(`    <rect class="${k}" x="${x}" y="${y}" width="30" height="20" rx="2" stroke="#6f7883" stroke-width="0.8"/>`);
  const n = k === 'blanc' ? '' : UI.compte(COMPTES.pays[k], COMPTES.subs[k]);
  t(`    <text class="leg" x="${x + 42}" y="${y + 15}"><tspan font-weight="700">${esc(c.libelle)}</tspan>${esc(n)}</text>`);
  const lignes = Array.isArray(c.legende) ? c.legende : [c.legende];
  lignes.forEach((ln, j) => t(`    <text class="leg-def" x="${x + 42}" y="${y + 33 + j * 16}">${esc(ln)}</text>`));
});
const YR = LEG_Y + 24 + 3 * 58 + 4;
t(`    <circle class="repere blanc" cx="${55}" cy="${YR}" r="4.2"/>`);
t(`    <text class="leg-def" x="82" y="${YR + 4}">${esc(data.legende_reperes)}</text>`);
t('  </g>');
(Array.isArray(data.pied) ? data.pied : [data.pied]).forEach((ln, j, arr) =>
  t(`  <text class="pied" x="40" y="${H - 14 - (arr.length - 1 - j) * 15}">${esc(ln)}</text>`));
t('</svg>');
fs.writeFileSync(outPath, L.join('\n') + '\n');
console.log('counts', JSON.stringify(COMPTES));
console.log('shapes', shapes.length, 'markers', marqueurs.length, 'subdivided', [...parentsWithSubs].join(','),
  'bytes', fs.statSync(outPath).size);
