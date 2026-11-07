// Tests for the isotope pattern, statements for papers/SI, the SI checker and batch input
// (run: SITE_DIR=<site root> node --test features.test.mjs).
// Isotope masses and abundances below are typed in from NIST "Atomic Weights and Isotopic Compositions",
// independently of hrms-calc/isotopes.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
// site root: SITE_DIR, otherwise the nearest parent folder that contains hrms-calc/
const findSite = () => { let d = import.meta.dirname; for (let i = 0; i < 5; i++) { if (fs.existsSync(path.join(d, 'hrms-calc', 'core.js'))) return d; d = path.dirname(d); } throw Error('set SITE_DIR'); };
const SITE = process.env.SITE_DIR || findSite();
const load = f => import(pathToFileURL(path.join(SITE, 'hrms-calc', f)).href);
const { parseFormula, ion, ionCounts, isotopePattern, ELECTRON_MASS } = await load('core.js');
const { siSentence, siFormula, ionLabel, checkText, parseBatch, ionKeyFrom } = await load('si.js');

const ME = 0.0005485799090441;
const ISO = {
  C: [[12, 12, 0.9893], [13, 13.00335483507, 0.0107]],
  H: [[1, 1.00782503223, 0.999885], [2, 2.01410177812, 0.000115]],
  N: [[14, 14.00307400443, 0.99636], [15, 15.00010889888, 0.00364]],
  O: [[16, 15.99491461957, 0.99757], [17, 16.99913175650, 0.00038], [18, 17.99915961286, 0.00205]],
  S: [[32, 31.9720711744, 0.9499], [33, 32.9714589098, 0.0075], [34, 33.967867004, 0.0425], [36, 35.96708071, 0.0001]],
  Cl: [[35, 34.968852682, 0.7576], [37, 36.965902602, 0.2424]],
  Na: [[23, 22.9897692820, 1]]
};
const mono = c => Object.entries(c).reduce((s, [e, n]) => s + n * ISO[e].reduce((a, b) => (b[2] > a[2] ? b : a))[1], 0);
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

// brute force: every way of distributing each element's atoms over its isotopes (multinomial)
function bruteForce(counts, z) {
  const fact = n => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };
  let peaks = new Map([[0, [1, 0]]]); // nominal mass -> [probability, probability × mass]
  for (const [e, n] of Object.entries(counts)) {
    const iso = ISO[e], next = new Map();
    const parts = (k, left) => (k === iso.length - 1 ? [[left]] : Array.from({ length: left + 1 }, (_, i) => parts(k + 1, left - i).map(r => [i, ...r])).flat());
    const options = parts(0, n).map(ks => {
      let p = fact(n), m = 0, a = 0;
      ks.forEach((k, i) => { p *= iso[i][2] ** k / fact(k); m += k * iso[i][1]; a += k * iso[i][0]; });
      return [a, p, m];
    });
    for (const [A, [P, PM]] of peaks) for (const [a, p, m] of options) {
      const cur = next.get(A + a) || [0, 0]; cur[0] += P * p; cur[1] += PM * p + P * p * m; next.set(A + a, cur);
    }
    peaks = next;
  }
  const max = Math.max(...[...peaks.values()].map(v => v[0]));
  return [...peaks.entries()].sort((x, y) => x[0] - y[0])
    .map(([A, [P, PM]]) => ({ A, relative: P / max * 100, mz: (PM / P - z * ME) / Math.abs(z) }))
    .filter(p => p.relative >= 0.1);
}

test('isotope pattern equals a brute-force enumeration (C6H12O6 [M+H]+, C9H11NO2S [M-H]-, CH2Cl2 [M+Na]+)', () => {
  for (const [f, key] of [['C6H12O6', '[M+H]+'], ['C9H11NO2S', '[M-H]-'], ['CH2Cl2', '[M+Na]+']]) {
    const counts = ionCounts(parseFormula(f), key), z = key.endsWith('-') ? -1 : 1;
    const got = isotopePattern(counts, z), want = bruteForce(counts, z);
    assert.equal(got.length, want.length, f);
    const monoA = Object.entries(counts).reduce((s, [e, n]) => s + n * ISO[e].reduce((a, b) => (b[2] > a[2] ? b : a))[0], 0);
    got.forEach((p, i) => {
      assert.equal(p.shift, want[i].A - monoA, `${f} shift`);
      close(p.relative, want[i].relative, 1e-9, `${f} M+${p.shift} intensity`);
      close(p.mz, want[i].mz, 1e-9, `${f} M+${p.shift} m/z`);
    });
    close(got.find(p => p.shift === 0).mz, ion(parseFormula(f), key).mz, 1e-9, `${f} monoisotopic peak`);
  }
});

test('isotope pattern: textbook checks (Cl2 binomial, C60 M+1, doubly charged spacing)', () => {
  const cl2 = isotopePattern({ Cl: 2 }, 1), r = 0.2424 / 0.7576;
  close(cl2[1].relative, 2 * r * 100, 1e-9, 'Cl2 M+2'); close(cl2[2].relative, r * r * 100, 1e-9, 'Cl2 M+4');
  const c60 = isotopePattern({ C: 60 }, 1);
  close(c60[1].relative, 60 * 0.0107 / 0.9893 * 100, 1e-9, 'C60 M+1');
  const z2 = isotopePattern(ionCounts(parseFormula('C20H30O10'), '[M+2H]2+'), 2);
  close(z2[1].mz - z2[0].mz, (13.00335483507 - 12) / 2, 2e-4, 'z=2 spacing about 0.5');
});

test('statements for papers and SI', () => {
  const c = parseFormula('C6H12O6');
  const mz = (6 * 12 + 12 * 1.00782503223 + 6 * 15.99491461957 + 22.9897692820 - ME); // independent [M+Na]+
  const s = (o) => siSentence({ key: '[M+Na]+', calcd: mz, ...o });
  assert.equal(s({ ionFormula: siFormula(c, '[M+Na]+'), found: '203.0524' }).text, 'HRMS m/z: [M + Na]+ Calcd for C6H12NaO6 203.0526; Found 203.0524.');
  assert.equal(s({ ionFormula: siFormula(c, '[M+Na]+', true), found: '203.0524' }).text, 'HRMS m/z: [M + Na]+ Calcd for C6H12O6Na 203.0526; Found 203.0524.');
  assert.equal(s({ ionFormula: 'C6H12O6Na' }).text, 'HRMS m/z: [M + Na]+ Calcd for C6H12O6Na 203.0526.');
  assert.match(s({ ionFormula: 'C6H12O6Na', found: '203.0524' }).html, /^HRMS <i>m<\/i>\/<i>z<\/i>: \[M \+ Na\]<sup>\+<\/sup> Calcd for C<sub>6<\/sub>H<sub>12<\/sub>O<sub>6<\/sub>Na/);
  assert.throws(() => s({ ionFormula: 'C6H12O6Na', found: '203,05' }), /found/);
  assert.deepEqual(ionLabel('[M-2H]2-'), { text: '[M − 2H]2−', html: '[M − 2H]<sup>2−</sup>' });
  assert.equal(ionLabel('[M+NH4]+').html, '[M + NH<sub>4</sub>]<sup>+</sup>');
  assert.equal(siFormula(c, '[2M+Na]+', true), 'C12H24O12Na');
  assert.equal(siFormula(c, '[M+NH4]+', true), 'C6H16NO6', 'NH4 is merged into the formula');
  assert.equal(siFormula(c, '[M+HCOO]-', true), 'C7H13O8');
});

test('SI checker: verdicts', () => {
  const cases = [
    ['HRMS (ESI) m/z: [M + Na]+ Calcd for C6H12O6Na 203.0526; Found 203.0524.', 'ok', ['ok'], '203.0524', 1],
    ['HRMS (ESI) m/z: [M + H]+ calcd for C6H13O6 181.0712; found 181.0709.', 'error', ['electron'], '181.0709', 1],
    ['HRESIMS m/z 179.0559 [M − H]− (calcd for C6H11O6, 179.0556).', 'error', ['electron'], '179.0559', -1],
    ['HRMS (ESI) m/z: [M - H]- Calcd for C6H11O6 179.0550; Found 179.0560.', 'error', ['electronSign'], '179.0560', -1],
    ['HRMS (ESI) m/z: [M + Na]+ Calcd for C6H12O6 203.0526; Found 203.0524.', 'warn', ['neutralFormula'], '203.0524', 1],
    ['HRMS (ESI) m/z: [M + Na]+ Calcd for C6H12O6 203.0532; Found 203.0524.', 'error', ['neutralFormulaElectron'], '203.0524', 1],
    ['HRMS m/z [M+H]+ calcd for C6H13O6 181.0750.', 'error', ['mismatch'], null, 1],
    ['HRMS m/z [M+H]+ calcd for C6H13O6: 181.0707, found: 181.0750.', 'warn', ['ok', 'foundOff'], '181.0750', 1],
    ['calcd for C6H13O6 181.0707', 'warn', ['ok', 'chargeAssumed'], null, 1],
    ['calcd for C6H13O6+ 181.0707', 'ok', ['ok'], null, 1],
    ['HRMS m/z [M+H]+ calcd for C6H13O6 181.071', 'ok', ['ok', 'fewDigits'], null, 1],
    ['HRMS m/z [M+H]+ calcd for C6H13O6 181.0706', 'ok', ['rounding'], null, 1],
    ['HRMS m/z [M + 2H]2+ calcd for C6H14O6 91.0390', 'ok', ['ok'], null, 2],
    ['実測値 m/z 225.0614 [M+HCOO]- 計算値 C7H13O8 225.0616', 'ok', ['ok'], '225.0614', -1],
    ['HRMS m/z [M−H]⁻ calcd for C₆H₁₁O₆ 179.0561', 'ok', ['ok'], null, -1],
    ['HRMS m/z [M+H]+ calcd for C6D12O6 193.1', 'unparsed', ['formula'], null, null],
  ];
  for (const [text, status, codes, found, z] of cases) {
    const r = checkText(text);
    assert.equal(r.length, 1, text);
    assert.equal(r[0].status, status, text); assert.deepEqual(r[0].codes, codes, text);
    assert.equal(r[0].found, found, text); assert.equal(r[0].z, z, text);
  }
  // the recalculated value is independent of the tool's constants
  const r = checkText('[M + H]+ calcd for C6H13O6 181.0707')[0];
  close(r.recalculated, 6 * 12 + 13 * 1.00782503223 + 6 * 15.99491461957 - ME, 1e-9, 'recalculated');
});

test('SI checker: reading many compounds', () => {
  assert.equal(checkText('Anal. Calcd for C6H12O6: C, 40.00; H, 6.71. Found: C, 39.95; H, 6.75.').length, 0, 'elemental analysis is ignored');
  assert.equal(checkText('The calculated ECD spectrum of 1 matched the experimental one.').length, 0);
  const text = `HRMS (ESI) m/z: [M + Na]+ Calcd for C15H14O6Na 313.0683;
Found 313.0679. Compound 5b: HRMS (ESI) m/z: [M + Na]+ Calcd for C15H14O6Na 313.0683; Found 313.0690.
HRESIMS m/z 291.0860 [M + H]+ (calcd for C15H15O6, 291.0863). HRESIMS m/z 291.0871 [M + H]+ (calcd for C15H15O6, 291.0863).
HRESIMS m/z 361.1338 [2M + H]+ (calcd for C12H25O12, 361.1341)
実測値 m/z 225.0614 [M+HCOO]- 計算値 C7H13O8 225.0616`;
  const r = checkText(text);
  assert.deepEqual(r.map(x => x.found), ['313.0679', '313.0690', '291.0860', '291.0871', '361.1338', '225.0614']);
  assert.ok(r.every(x => x.status === 'ok'), r.map(x => x.codes).join('|'));
});

test('batch input', () => {
  const rows = parseBatch(`# comment
C6H12O6
Glucose\tC6H12O6\t[M + Na]+\t203.0524
化合物 1  C15H14O6 [M - H]- 289.0718
Compound 2, C6H12O6, (M+HCOO)-, 225.0614
C6H12O6 [M+OAc]-
not a formula
X C6H12O6 [M+Q]+
C6H12O6 [M+H]+ 181.0707 extra`, '[M+H]+');
  const v = rows.map(r => [r.line, r.label, r.formula, r.key, r.found, r.error]);
  assert.deepEqual(v, [
    [2, '', 'C6H12O6', '[M+H]+', '', null],
    [3, 'Glucose', 'C6H12O6', '[M+Na]+', '203.0524', null],
    [4, '化合物 1', 'C15H14O6', '[M-H]-', '289.0718', null],
    [5, 'Compound 2', 'C6H12O6', '[M+HCOO]-', '225.0614', null],
    [6, '', 'C6H12O6', '[M+CH3COO]-', '', null],
    [7, 'not a formula', '', '[M+H]+', '', 'formula'],
    [8, 'X', 'C6H12O6', '[M+H]+', '', 'ion'],
    [9, '', 'C6H12O6', '[M+H]+', '181.0707', 'token'],
  ]);
  assert.equal(ionKeyFrom('[M − H]⁻'), '[M-H]-');
  assert.equal(ionKeyFrom('M+Na'), '[M+Na]+');
  assert.equal(ionKeyFrom('[M]'), null);
  assert.equal(ionKeyFrom('M'), null, '[M]+ and [M]- are ambiguous without a charge');
  assert.throws(() => parseBatch('C6H12O6\n'.repeat(1001)), /lines/);
});
