// Unit and scientific regression tests for HRMS Calc (run: node --test unit.test.mjs)
// Masses below are typed in from NIST "Atomic Weights and Isotopic Compositions" and CODATA 2022,
// independently of hrms-calc/constants.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
// site root: SITE_DIR, otherwise the nearest parent folder that contains hrms-calc/
const findSite = () => { let d = import.meta.dirname; for (let i = 0; i < 5; i++) { if (fs.existsSync(path.join(d, 'hrms-calc', 'core.js'))) return d; d = path.dirname(d); } throw Error('set SITE_DIR'); };
const SITE = process.env.SITE_DIR || findSite();
const core = await import(pathToFileURL(path.join(SITE, 'hrms-calc', 'core.js')).href);
const { ion, parseFormula, search, ppm, IONS, ELEMENTS, ELECTRON_MASS } = core;

const M = { C: 12, H: 1.00782503223, N: 14.00307400443, O: 15.99491461957, S: 31.9720711744,
            Na: 22.9897692820, K: 38.9637064864, Cl: 34.968852682, Li: 7.0160034366 };
const ME = 0.0005485799090441;
const close = (a, b, tol = 1e-9, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('constants used by the tool agree with the reference values typed in this test', () => {
  for (const [e, m] of Object.entries(M)) close(Number(ELEMENTS[e].mass), m, 1e-12, e);
  close(ELECTRON_MASS, ME, 0, 'electron');
  assert.equal(Object.keys(ELEMENTS).length, 84);
  assert.equal(Object.keys(IONS).length, 19);
});

test('C6H12O6: independent expected values', () => {
  const expected = { neutral: 180.06338810418, '[M+H]+': 181.0706645565009559, '[M+Na]+': 203.0526088062709559,
    '[M-H]-': 179.0561116518590441, '[M+2H]2+': 91.0389705044109559, '[M-2H]2-': 89.0244175997690441,
    '[2M+H]+': 361.1340526606809559, '[M+NH4]+': 198.0972136576209559 };
  const c = parseFormula('C6H12O6');
  for (const [k, v] of Object.entries(expected)) {
    if (k === 'neutral') close(ion(c, '[M+H]+').neutral, v, 1e-9, k);
    else close(ion(c, k).mz, v, 1e-9, k);
  }
});

test('all 19 ion types against an independent formula', () => {
  const ions = { '[M]+': [1, 1, {}], '[M+H]+': [1, 1, { H: 1 }], '[M+Na]+': [1, 1, { Na: 1 }], '[M+K]+': [1, 1, { K: 1 }],
    '[M+NH4]+': [1, 1, { N: 1, H: 4 }], '[M]-': [1, -1, {}], '[M-H]-': [1, -1, { H: -1 }], '[M+Cl]-': [1, -1, { Cl: 1 }],
    '[M+2H]2+': [1, 2, { H: 2 }], '[M-2H]2-': [1, -2, { H: -2 }], '[2M]+': [2, 1, {}], '[2M+H]+': [2, 1, { H: 1 }],
    '[2M+Na]+': [2, 1, { Na: 1 }], '[2M]-': [2, -1, {}], '[2M-H]-': [2, -1, { H: -1 }],
    '[M+Li]+': [1, 1, { Li: 1 }], '[M+H-H2O]+': [1, 1, { H: -1, O: -1 }],
    '[M+HCOO]-': [1, -1, { H: 1, C: 1, O: 2 }], '[M+CH3COO]-': [1, -1, { C: 2, H: 3, O: 2 }] };
  assert.deepEqual(Object.keys(ions).sort(), Object.keys(IONS).sort());
  const neutral = 9 * M.C + 11 * M.H + M.N + 2 * M.O; // C9H11NO2 (phenylalanine)
  for (const [k, [mult, z, d]] of Object.entries(ions)) {
    let m = mult * neutral; for (const [e, n] of Object.entries(d)) m += n * M[e];
    close(ion(parseFormula('C9H11NO2'), k).mz, (m - z * ME) / Math.abs(z), 1e-9, k);
  }
});

test('ions without atoms are rejected (calculator and search)', () => {
  assert.throws(() => ion(parseFormula('H'), '[M-H]-'), /composition/);
  assert.throws(() => ion(parseFormula('H2'), '[M-2H]2-'), /composition/);
  assert.throws(() => ion(parseFormula('O'), '[M-H]-'), /composition/);
  for (const [adduct, found] of [['[M-H]-', ME], ['[M-2H]2-', ME]]) {
    const r = search({ found, tolerance: 1, unit: 'mDa', adduct, ranges: [['H', 0, 4]] });
    assert.equal(r.results.length, 0, adduct);
  }
  // normal deprotonation and multiple charges still work
  close(ion(parseFormula('H2O'), '[M-H]-').mz, (M.O + M.H + ME), 1e-9, 'OH-');
  close(ion(parseFormula('H2O'), '[M-2H]2-').mz, (M.O + 2 * ME) / 2, 1e-9, 'O2-');
});

test('ppm / mDa and tolerance boundaries', () => {
  close(ppm(181.0707, 181.0706645565), (181.0707 - 181.0706645565) / 181.0706645565 * 1e6, 1e-12);
  const calc = 181.0706645565009559, ranges = [['C', 0, 10], ['H', 0, 20], ['O', 0, 8]];
  const has = r => r.results.some(x => x.formula === 'C6H12O6');
  // ppm: exactly on the boundary is included, slightly outside is not
  const at = calc * (1 + 5e-6);
  assert.ok(has(search({ found: at, tolerance: 5, unit: 'ppm', adduct: '[M+H]+', ranges })));
  assert.ok(!has(search({ found: calc * (1 + 5.01e-6), tolerance: 5, unit: 'ppm', adduct: '[M+H]+', ranges })));
  // mDa
  assert.ok(has(search({ found: calc + 0.002, tolerance: 2, unit: 'mDa', adduct: '[M+H]+', ranges })));
  assert.ok(!has(search({ found: calc + 0.00201, tolerance: 2, unit: 'mDa', adduct: '[M+H]+', ranges })));
});

test('input validation for searches and ranges', () => {
  const base = { found: 181.0707, tolerance: 5, unit: 'ppm', adduct: '[M+H]+' };
  assert.throws(() => search({ ...base, ranges: [['C', 5, 3]] }), /range/);
  assert.throws(() => search({ ...base, ranges: [['C', 0, 1001]] }), /range/);
  assert.throws(() => search({ ...base, ranges: [['C', -1, 3]] }), /range/);
  assert.throws(() => search({ ...base, ranges: [['C', 0, 0]] }), /range/);
  assert.throws(() => search({ ...base, tolerance: 1e6, ranges: [['C', 0, 3]] }), /search/);
  assert.throws(() => search({ ...base, unit: 'Da', ranges: [['C', 0, 3]] }), /search/);
  assert.throws(() => parseFormula('C6H12O6+'), /formula/);
  assert.throws(() => parseFormula('C(H2)2'), /formula/);
  // element minimums are respected
  const r = search({ ...base, ranges: [['C', 6, 6], ['H', 12, 12], ['O', 0, 8]] });
  assert.ok(r.results.every(x => x.formula.startsWith('C6H12')));
});

test('search limit gives an incomplete flag', () => {
  const r = search({ found: 500, tolerance: 1000, unit: 'mDa', adduct: '[M+H]+',
    ranges: [['C', 0, 60], ['H', 0, 120], ['N', 0, 20], ['O', 0, 30]] }, { maxNodes: 5000 });
  assert.equal(r.complete, false);
  const r2 = search({ found: 500, tolerance: 1000, unit: 'mDa', adduct: '[M+H]+',
    ranges: [['C', 0, 60], ['H', 0, 120], ['N', 0, 20], ['O', 0, 30]] }, { maxResults: 3 });
  assert.equal(r2.complete, false); assert.equal(r2.results.length, 3);
});

test('pruned search equals an independent brute-force search on small ranges', () => {
  const R = { C: [0, 12], H: [0, 24], N: [0, 3], O: [0, 6], S: [0, 1], Cl: [0, 1] };
  const cases = [[181.0707, '[M+H]+', 10, 'ppm'], [203.0526, '[M+Na]+', 5, 'mDa'], [179.0561, '[M-H]-', 20, 'ppm'],
                 [91.039, '[M+2H]2+', 3, 'mDa'], [215.0327, '[M+Cl]-', 15, 'ppm'], [361.1341, '[2M+H]+', 10, 'ppm']];
  const ionDef = { '[M+H]+': [1, 1, { H: 1 }], '[M+Na]+': [1, 1, { Na: 1 }], '[M-H]-': [1, -1, { H: -1 }],
                   '[M+2H]2+': [1, 2, { H: 2 }], '[M+Cl]-': [1, -1, { Cl: 1 }], '[2M+H]+': [2, 1, { H: 1 }] };
  const els = Object.keys(R);
  for (const [found, adduct, tol, unit] of cases) {
    const [mult, z, d] = ionDef[adduct]; const brute = [];
    const rec = (i, counts) => {
      if (i === els.length) {
        if (!Object.values(counts).some(n => n > 0)) return;
        const ionCounts = {}; for (const e of els) ionCounts[e] = counts[e] * mult;
        for (const [e, n] of Object.entries(d)) ionCounts[e] = (ionCounts[e] || 0) + n;
        if (Object.values(ionCounts).some(n => n < 0) || !Object.values(ionCounts).some(n => n > 0)) return;
        let m = 0; for (const [e, n] of Object.entries(ionCounts)) m += n * M[e];
        const mz = (m - z * ME) / Math.abs(z);
        const err = unit === 'ppm' ? (found - mz) / mz * 1e6 : (found - mz) * 1000;
        if (Math.abs(err) <= tol) brute.push(els.map(e => e + counts[e]).join(''));
        return;
      }
      const [lo, hi] = R[els[i]];
      for (let n = lo; n <= hi; n++) rec(i + 1, { ...counts, [els[i]]: n });
    };
    rec(0, {});
    const res = search({ found, tolerance: tol, unit, adduct, ranges: els.map(e => [e, ...R[e]]) });
    assert.equal(res.complete, true);
    const key = f => { const c = parseFormula(f); return els.map(e => e + (c[e] || 0)).join(''); };
    assert.ok(brute.length > 0, `no reference hits for ${adduct}`);
    assert.deepEqual(res.results.map(r => key(r.formula)).sort(), brute.sort(), `${adduct} ${found}`);
  }
});

test('candidate filters: integer DBE (nitrogen rule) and element ratios (Kind & Fiehn 2007, common range)', () => {
  const { dbeRule, ratioRule } = core;
  // rules on single compositions
  assert.equal(dbeRule(parseFormula('C6H12O6')), true);
  assert.equal(dbeRule(parseFormula('C6H11O6')), false);              // DBE 1.5
  assert.equal(dbeRule(parseFormula('C2H8')), false);                 // DBE −1
  assert.equal(dbeRule(parseFormula('C5H5N')), true);                 // pyridine
  assert.equal(dbeRule(parseFormula('C5H6N')), false);                // breaks the nitrogen rule
  assert.equal(dbeRule(parseFormula('C3H9O4P')), null);               // P: DBE not defined here, so not judged
  assert.equal(ratioRule(parseFormula('C15H10O7')), true);            // quercetin
  assert.equal(ratioRule(parseFormula('C82H54O52')), true);           // a large ellagitannin
  assert.equal(ratioRule(parseFormula('CH4')), false);                // H/C 4 > 3.1
  assert.equal(ratioRule(parseFormula('C2O5')), false);               // O/C 2.5 > 1.2
  assert.equal(ratioRule(parseFormula('C10H2')), true);               // H/C 0.2: on the boundary, kept
  assert.equal(ratioRule(parseFormula('C20H3')), false);              // H/C 0.15 < 0.2
  assert.equal(ratioRule(parseFormula('H2O')), null);                 // no carbon: not judged
  // search: filtered results = unfiltered results that pass the rules; excluded counts the rest
  const q = { found: 301.0354, tolerance: 10, unit: 'ppm', adduct: '[M-H]-', ranges: [['C', 0, 40], ['H', 0, 80], ['N', 0, 6], ['O', 0, 20], ['S', 0, 2], ['P', 0, 2]] };
  const all = search(q).results;
  for (const filters of [{ dbe: true }, { ratio: true }, { dbe: true, ratio: true }]) {
    const res = search({ ...q, filters });
    const keep = all.filter(r => { const c = parseFormula(r.formula); return !(filters.dbe && dbeRule(c) === false) && !(filters.ratio && ratioRule(c) === false); });
    assert.deepEqual(res.results.map(r => r.formula), keep.map(r => r.formula), JSON.stringify(filters));
    assert.equal(res.excluded, all.length - keep.length);
    assert.ok(res.results.some(r => r.formula === 'C15H10O7'), 'quercetin stays');
  }
  assert.ok(search({ ...q, filters: { dbe: true } }).results.every(r => r.dbe === null || (r.dbe >= 0 && Number.isInteger(r.dbe))));
  assert.equal(search(q).excluded, 0);
  assert.throws(() => search({ ...q, filters: null }), /search/);
});
