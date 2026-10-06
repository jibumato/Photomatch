// Cache busting for the static site (no bundler, no build step on Cloudflare
// Pages). Run this after changing any file under css/ or js/:
//
//     node scripts/stamp-assets.mjs
//
// It gives every CSS/JS URL a ?v=<content hash> in all *.html files:
//   - <link rel="stylesheet" href="css/x.css?v=…">
//   - the page's entry <script type="module" src="js/…?v=…">
//   - an import map, so modules imported from other modules ("../i18n.js")
//     also load with their hash.
// A file's URL only changes when its content does, so browsers keep using a
// cached copy until the file actually changes — and never mix a new page with
// an old stylesheet or translation file (which showed raw keys like
// "top.hero.cta" after a deploy).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const hashOf = (file) => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10);
const assets = [...walk(join(ROOT, 'js')), ...walk(join(ROOT, 'css'))]
  .filter((f) => /\.(js|css)$/.test(f))
  .map((f) => ({ path: relative(ROOT, f).split('\\').join('/'), hash: hashOf(f) }));
const hashFor = Object.fromEntries(assets.map((a) => [a.path, a.hash]));

const importMap = JSON.stringify({
  imports: Object.fromEntries(assets.filter((a) => a.path.startsWith('js/')).map((a) => [`/${a.path}`, `/${a.path}?v=${a.hash}`])),
}, null, 2);
const MAP_START = '<!-- asset-versions:start (scripts/stamp-assets.mjs) -->';
const MAP_END = '<!-- asset-versions:end -->';
const mapBlock = `${MAP_START}\n<script type="importmap">\n${importMap}\n</script>\n${MAP_END}`;

let changed = 0;
for (const name of readdirSync(ROOT).filter((n) => n.endsWith('.html'))) {
  const file = join(ROOT, name);
  const before = readFileSync(file, 'utf8');
  let html = before.replace(/(href|src)="((?:css|js)\/[^"?]+\.(?:css|js))(?:\?v=[^"]*)?"/g, (m, attr, path) => (
    hashFor[path] ? `${attr}="${path}?v=${hashFor[path]}"` : m
  ));
  // 何度実行しても1つだけになるよう、既存のブロックはすべて取り除く（括弧を含むので文字列で探す）。
  while (html.includes(MAP_START) && html.includes(MAP_END)) {
    const a = html.indexOf(MAP_START);
    const b = html.indexOf(MAP_END, a) + MAP_END.length;
    html = html.slice(0, a) + html.slice(html[b] === '\n' ? b + 1 : b);
  }
  if (html.includes('type="module"')) {
    // The import map must come before the first module script.
    html = html.replace('</head>', `${mapBlock}\n</head>`);
  }
  if (html !== before) {
    writeFileSync(file, html);
    changed += 1;
  }
}
console.log(`asset versions stamped (${assets.length} files, ${changed} pages updated)`);
