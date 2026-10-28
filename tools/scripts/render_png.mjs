// Usage: node render_png.mjs <in.svg> <out.png> [width]
import fs from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
const [inp, out, width] = process.argv.slice(2);
const r = new Resvg(fs.readFileSync(inp, 'utf8'), {
  fitTo: { mode: 'width', value: Number(width || 2000) },
  font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' },
  background: '#ffffff',
});
fs.writeFileSync(out, r.render().asPng());
console.log('png written', out);
