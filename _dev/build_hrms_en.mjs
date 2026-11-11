// Write the text of HRMS Calc into its HTML and make the English page.
//
//   node _dev/build_hrms_en.mjs           fill hrms-calc/index.html (Japanese) and write hrms-calc/en/index.html
//   node _dev/build_hrms_en.mjs --check   exit 1 if either file is out of date (used by the tests)
//
// The strings are in hrms-calc/text.js. Every element with data-t="key" gets the text the page script would
// put in (rich(), as in translate() of app.js), so the initial HTML that search engines read is complete
// in each language. Edit hrms-calc/index.html (structure) and text.js (text), then run this script.
// Do not edit hrms-calc/en/index.html by hand.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'hrms-calc');
const { strings, rich } = await import(pathToFileURL(path.join(dir, 'text.js')).href);
const BASE = 'https://yosuke-matsuo.github.io/hrms-calc/';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// end of the element whose start tag ends at `from` (same tag name nested inside is counted)
function closeOf(html, tag, from) {
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'gi');
  re.lastIndex = from; let depth = 1, m;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') { if (--depth === 0) return m.index; } else depth++;
  }
  throw new Error(`no </${tag}> after ${from}`);
}

function fillText(html, lang) {
  const re = /<(\w+)\b[^>]*\sdata-t="(\w+)"[^>]*>/g; let out = '', last = 0, m;
  while ((m = re.exec(html))) {
    const [open, tag, key] = m, start = m.index + open.length, end = closeOf(html, tag, start);
    const v = strings[lang][key];
    out += html.slice(last, start) + (typeof v === 'string' ? (tag.toLowerCase() === 'option' ? esc(v) : rich(v, false)) : html.slice(start, end));
    last = end; re.lastIndex = end;
  }
  return out + html.slice(last);
}

function page(lang) {
  const src = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const t = strings[lang], en = lang === 'en';
  let h = fillText(src, lang);
  const set = (re, value) => { if (!re.test(h)) throw new Error(`not found: ${re}`); h = h.replace(re, (m0, a, b) => a + value + b); };
  set(/(<html lang=")[a-z]+(">)/, lang);
  set(/(<title>)[^<]*(<\/title>)/, esc(t.title));
  set(/(<meta name="description" content=")[^"]*(">)/, esc(t.metaDescription));
  set(/(<meta property="og:title" content=")[^"]*(">)/, esc(t.title));
  set(/(<meta property="og:description" content=")[^"]*(">)/, esc(t.metaDescription));
  set(/(<meta property="og:locale" content=")[^"]*(">)/, en ? 'en_US' : 'ja_JP');
  set(/(<link rel="canonical" href=")[^"]*(">)/, BASE + (en ? 'en/' : ''));
  set(/(<meta property="og:url" content=")[^"]*(">)/, BASE + (en ? 'en/' : ''));
  set(/(<button type="button" id="langJa" lang="ja" aria-pressed=")[a-z]+(")/, String(!en));
  set(/(<button type="button" id="langEn" lang="en" aria-pressed=")[a-z]+(")/, String(en));
  if (en) {
    h = h.replace('<!doctype html>\n', '<!doctype html>\n<!-- English page generated from ../index.html and ../text.js by _dev/build_hrms_en.mjs. Do not edit by hand. -->\n');
    h = h.replace(`"url": "${BASE}",`, `"url": "${BASE}en/",`);
    h = h.replace('このツールはJavaScriptが必要です。 / This tool requires JavaScript.', 'This tool requires JavaScript.');
    h = h.replace(/("description": ")[^"]*(",)/, (m0, a, b) => a + t.metaDescription.replace(/"/g, '\\"') + b);
    // one folder deeper: files of HRMS Calc are in ../, the personal pages in ../../en/
    h = h.replace(/\b(href|src)="(?!https?:|#|\.\.\/|\/)([^"]+)"/g, (m0, a, v) => `${a}="../${v}"`);
    h = h.replace(/\bhref="\.\.\/(index|research|publications|tools)\.html"/g, (m0, f) => `href="../../en/${f}.html"`);
  }
  return h;
}

const check = process.argv.includes('--check');
fs.mkdirSync(path.join(dir, 'en'), { recursive: true });
const stale = [];
for (const [lang, file] of [['ja', 'index.html'], ['en', 'en/index.html']]) {
  const out = page(lang), dest = path.join(dir, file);
  if (check) { if (!fs.existsSync(dest) || fs.readFileSync(dest, 'utf8') !== out) stale.push('hrms-calc/' + file); }
  else fs.writeFileSync(dest, out);
}
if (stale.length) { console.log(`out of date: ${stale.join(', ')} (run node _dev/build_hrms_en.mjs)`); process.exit(1); }
console.log(check ? 'HRMS Calc pages are up to date' : 'wrote hrms-calc/index.html and hrms-calc/en/index.html');
