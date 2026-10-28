// Rendu PNG d'un SVG.  Usage : node rendu_png.mjs <entree.svg> <sortie.png> [largeur]
import fs from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
const [entree, sortie, largeur] = process.argv.slice(2);
const r = new Resvg(fs.readFileSync(entree, 'utf8'), {
  fitTo: { mode: 'width', value: Number(largeur || 2000) },
  font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' },
  background: '#ffffff',
});
fs.writeFileSync(sortie, r.render().asPng());
console.log('png écrit', sortie);
