// Construit la carte SVG (projection de Mollweide) à partir du jeu de données.
// Usage : node carte.mjs <donnees.json> <admin1_sous_ensemble.geojson> <sortie.svg> [zones.geojson]
// <donnees.json> est donnees/irresponsabilite_penale.json. Les comptes de la légende sont recalculés à partir des entités.
import fs from 'node:fs';
import * as d3 from 'd3-geo';
import { geoMollweide } from 'd3-geo-projection';
import * as topojson from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import isoCountries from 'i18n-iso-countries';

const [cheminDonnees, cheminAdmin1, cheminSortie] = process.argv.slice(2);
const lireJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const nm = (p) => new URL(`../node_modules/${p}`, import.meta.url);
isoCountries.registerLocale(lireJSON(nm('i18n-iso-countries/langs/fr.json')));

const COULEURS = ['vert', 'jaune', 'violet', 'bleu', 'noir', 'blanc'];
const data = lireJSON(cheminDonnees);
for (const e of data.entites) {
  if (!COULEURS.includes(e.couleur)) throw new Error(`${e.code} : couleur invalide ${e.couleur}`);
}
const entrees = new Map(data.entites.map((e) => [e.code, e]));
const cats = data.categories;
const exclus = new Map(data.perimetre.exclus.map((e) => [e.code, e.raison]));

// ---------------------------------------------------------------- géométrie
const monde = lireJSON(nm('world-atlas/countries-50m.json'));
const mondeS = simplify(presimplify(monde), quantile(presimplify(monde), 0.55));
const SPECIAL = { Somaliland: 'SO-SL', Kosovo: 'XK', 'N. Cyprus': 'CY-N',
  'Indian Ocean Ter.': 'AU-IOT', 'Siachen Glacier': 'IN-SIA' };
const NOMS_SPECIAUX = { 'SO-SL': 'Somaliland', XK: 'Kosovo', 'CY-N': 'Chypre du Nord',
  'AU-IOT': 'Territoires australiens de l’océan Indien', 'IN-SIA': 'Glacier de Siachen' };
const pays = topojson.feature(mondeS, mondeS.objects.countries).features
  .map((f) => {
    const code = f.id ? isoCountries.numericToAlpha2(f.id) : SPECIAL[f.properties.name];
    return { code, nom: isoCountries.getName(code, 'fr') || NOMS_SPECIAUX[code] || f.properties.name, geo: f };
  })
  .filter((c) => c.code !== 'AQ'); // Antarctique retirée

const admin1 = lireJSON(cheminAdmin1);
const aTopo = presimplify(topology({ a: admin1 }, 1e6));
const aTopoS = simplify(aTopo, quantile(aTopo, 0.93));
const unitesParPays = new Map();
{
  const geoms = aTopoS.objects.a.geometries;
  const parCode = new Map();
  for (const g of geoms) {
    const k = g.properties.code;
    if (!parCode.has(k)) parCode.set(k, []);
    parCode.get(k).push(g);
  }
  for (const [code, gs] of parCode) {
    const parent = gs[0].properties.parent;
    const geo = { type: 'Feature', properties: {}, geometry: topojson.merge(aTopoS, gs) };
    if (!unitesParPays.has(parent)) unitesParPays.set(parent, []);
    unitesParPays.get(parent).push({ code, nom: gs[0].properties.nom, parent, geo });
  }
}
// Un pays est dessiné par unité infranationale dès que les données contiennent une entrée pour l'une d'elles.
const paysParUnites = new Set(
  data.entites.filter((e) => e.niveau === 'subdivision' && e.parent && unitesParPays.has(e.parent)
    && unitesParPays.get(e.parent).some((s) => s.code === e.code)).map((e) => e.parent));

// Zones dessinées en blanc par-dessus leur pays, avec la raison de l'exclusion (Ukraine occupée, Transnistrie).
const cheminZones = process.argv[5] || new URL('../geo/zones_exclues.geojson', import.meta.url).pathname;
const zones = fs.existsSync(cheminZones)
  ? lireJSON(cheminZones).features.map((f) => ({ code: f.properties.code, nom: f.properties.nom,
    parent: f.properties.parent, geo: f }))
  : [];

// Territoires colorés comme leur pays de rattachement quand ils n'ont pas d'entrée propre (même procédure pénale).
const TERRITOIRES = data.perimetre.territoires_rattaches || {};

// ---------------------------------------------------------------- projection
const W = 2000, HAUT_CARTE = 118, H_CARTE = 1000, H = HAUT_CARTE + H_CARTE + 315;
const projection = geoMollweide().fitExtent([[6, HAUT_CARTE], [W - 6, HAUT_CARTE + H_CARTE]], { type: 'Sphere' });
const path = d3.geoPath(projection).digits(1);

// ---------------------------------------------------------------- outils
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const entreePour = (code, parent) => entrees.get(code) || (parent && entrees.get(parent))
  || (TERRITOIRES[code] && entrees.get(TERRITOIRES[code])) || null;
function couleurDe(code, parent) {
  if (exclus.has(code)) return 'blanc';
  const e = entreePour(code, parent);
  return e ? e.couleur : 'blanc';
}
function infobulle(code, nom, parent) {
  if (exclus.has(code)) return `${nom} — non coloré : ${exclus.get(code)}`;
  const e = entreePour(code, parent);
  if (!e) return `${nom} — hors périmètre`;
  if (e.couleur === 'blanc') {
    const hyp = e.couleur_hypothese && cats[e.couleur_hypothese]
      ? `\nHypothèse non retenue faute de texte lisible : « ${cats[e.couleur_hypothese].libelle} »` : '';
    return `${nom} — données insuffisantes\n${e.note || ''}${hyp}`;
  }
  const herite = e.code !== code ? `\n(règle de ${e.nom})` : '';
  const conf = e.confiance ? `\nConfiance : ${e.confiance}` : '';
  const ctl = e.controle_independant && e.controle_independant.verdict
    ? `\nContrôle indépendant : ${e.controle_independant.verdict}` : '';
  return `${nom} — ${cats[e.couleur].libelle}${herite}\n${e.bases_legales || ''}\n${e.note || ''}${conf}${ctl}`;
}

// ---------------------------------------------------------------- formes
const formes = []; // {code, nom, parent, d, couleur, sub, fond}
for (const c of pays) {
  if (paysParUnites.has(c.code)) {
    // le pays est rempli d'abord (masque les fins interstices), puis ses unités par-dessus
    formes.push({ code: c.code, nom: c.nom, d: path(c.geo), couleur: couleurDe(c.code), fond: true });
    for (const s of unitesParPays.get(c.code)) {
      formes.push({ code: s.code, nom: s.nom, parent: c.code, d: path(s.geo),
        couleur: couleurDe(s.code, c.code), sub: true, geo: s.geo });
    }
  } else {
    formes.push({ code: c.code, nom: c.nom, d: path(c.geo), couleur: couleurDe(c.code), geo: c.geo });
  }
}

// les petites entités du périmètre reçoivent un cercle
const MARQUEURS_MANUELS = data.perimetre.marqueurs || {}; // code -> [lon, lat]
const marqueurs = [];
for (const s of formes) {
  if (s.fond || s.couleur === 'blanc' || TERRITOIRES[s.code]) continue;
  // une petite unité fédérée n'a de cercle que si sa couleur diffère de celle de son pays
  if (s.sub && s.couleur === couleurDe(s.parent)) continue;
  const aire = s.geo ? path.area(s.geo) : 0;
  if (aire < 60 || MARQUEURS_MANUELS[s.code]) {
    const ll = MARQUEURS_MANUELS[s.code];
    const [x, y] = ll ? projection(ll) : path.centroid(s.geo);
    marqueurs.push({ code: s.code, nom: s.nom, parent: s.parent, x, y, couleur: s.couleur });
  }
}
for (const [code, ll] of Object.entries(MARQUEURS_MANUELS)) {
  if (marqueurs.some((m) => m.code === code) || !entrees.has(code)) continue;
  const e = entrees.get(code);
  if (e.couleur === 'blanc') continue;
  const [x, y] = projection(ll);
  marqueurs.push({ code, nom: e.nom, x, y, couleur: e.couleur });
}

// ---------------------------------------------------------------- comptes de la légende
// Un État fédéral dont les unités diffèrent compte par ses unités ; un pays à règle unique compte une fois ;
// les entrées infranationales non dessinées comme unités (territoires autonomes : Groenland, Porto Rico…)
// comptent comme subdivisions.
const COMPTES = (() => {
  const unites = new Map([...unitesParPays].map(([par, subs]) => [par, [...new Set(subs.map((s) => s.code))]]));
  const dessinee = (e) => e.niveau === 'subdivision' && e.parent && unites.has(e.parent) && unites.get(e.parent).includes(e.code);
  const varie = new Set();
  const parUnite = {};
  for (const par of new Set(data.entites.filter(dessinee).map((e) => e.parent))) {
    const cols = unites.get(par).map((code) => (entrees.get(code) || entrees.get(par))?.couleur || 'blanc');
    if (new Set(cols).size > 1) {
      varie.add(par);
      for (const c of cols) parUnite[c] = (parUnite[c] || 0) + 1;
    }
  }
  const nPays = {}, nSubs = {};
  for (const k of COULEURS) {
    nPays[k] = data.entites.filter((e) => e.niveau === 'pays' && !varie.has(e.code) && e.couleur === k).length;
    nSubs[k] = (parUnite[k] || 0) + data.entites.filter((e) => e.niveau === 'subdivision' && !dessinee(e) && e.couleur === k).length;
  }
  return { pays: nPays, subs: nSubs };
})();
const texteCompte = (p, s) => ` — ${p} pays${s ? ` et ${s} ${s > 1 ? 'subdivisions ou territoires' : 'subdivision ou territoire'}` : ''}`;

// ---------------------------------------------------------------- svg
const L = [];
const t = (s) => L.push(s);
t('<?xml version="1.0" encoding="UTF-8"?>');
t(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="titre desc" xml:lang="fr">`);
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
for (const k of COULEURS) t(`    .${k} { fill: ${cats[k].couleur}; }`);
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
for (const s of formes) {
  if (!s.d) continue;
  const cls = `${s.sub ? 'sub' : 'pays'} ${s.couleur}${exclus.has(s.code) && s.code.includes('-') ? ' zone-exclue' : ''}`;
  t(`    <path id="${esc(s.code)}${s.fond ? '-fond' : ''}" data-code="${esc(s.code)}" class="${cls}" d="${s.d}"><title>${esc(infobulle(s.code, s.nom, s.parent))}</title></path>`);
}
t('  </g>');
// frontières nationales des pays dessinés par unité
t('  <g id="contours-nationaux" fill="none" stroke="#6f7883" stroke-width="0.6">');
for (const c of pays) if (paysParUnites.has(c.code)) t(`    <path d="${path(c.geo)}"/>`);
t('  </g>');
t('  <g id="zones-exclues">');
for (const z of zones) {
  const raison = exclus.get(z.code) || 'écarté du périmètre';
  t(`    <path id="${esc(z.code)}" data-code="${esc(z.code)}" class="blanc zone-exclue" d="${path(z.geo)}"><title>${esc(`${z.nom} — non coloré : ${raison}`)}</title></path>`);
}
t('  </g>');
t('  <g id="petits-etats">');
for (const m of marqueurs) {
  t(`    <circle class="repere ${m.couleur}" data-code="${esc(m.code)}" cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="4.2"><title>${esc(infobulle(m.code, m.nom, m.parent))}</title></circle>`);
}
t('  </g>');
t(`  <path class="contour" d="${path({ type: 'Sphere' })}"/>`);

// légende
const LEG_Y = HAUT_CARTE + H_CARTE + 34;
t('  <g id="legende">');
t(`    <text class="leg-titre" x="40" y="${LEG_Y}">Abolition totale du discernement au moment des faits : que se passe-t-il ?</text>`);
COULEURS.forEach((k, i) => {
  const col = i % 2, ligne = Math.floor(i / 2);
  const x = 40 + col * 980, y = LEG_Y + 24 + ligne * 58;
  const c = cats[k];
  t(`    <rect class="${k}" x="${x}" y="${y}" width="30" height="20" rx="2" stroke="#6f7883" stroke-width="0.8"/>`);
  const n = k === 'blanc' ? '' : texteCompte(COMPTES.pays[k], COMPTES.subs[k]);
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
fs.writeFileSync(cheminSortie, L.join('\n') + '\n');
console.log('comptes', JSON.stringify(COMPTES));
console.log('formes', formes.length, 'cercles', marqueurs.length, 'pays par unités', [...paysParUnites].join(','),
  'octets', fs.statSync(cheminSortie).size);
