// Browser checks for HRMS Calc and the personal site (run with an HTTP server; see README.txt)
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8765';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const page = async (opts = {}) => { const ctx = await browser.newContext(opts); const p = await ctx.newPage(); p.ctx = ctx; return p; };
  // choose an ion type with the ion picker (button that opens a table of ion types)
  // HRMS Calc keeps inputs after "#": #calculator?f=...&ion=...
  const hashOf = url => { const h = new URL(url).hash.slice(1), i = h.indexOf('?'); return { tab: i < 0 ? h : h.slice(0, i), q: new URLSearchParams(i < 0 ? '' : h.slice(i + 1)) }; };
  const pickIon = async (p, id, key) => { await p.click(`#${id}-picker .ion-current`); await p.click(`#${id}-panel button[data-ion="${key}"]`); };

  // 1. language survives reload, other query parameters and the hash are kept
  for (const [from, to, btn] of [['ja', 'en', '#langEn'], ['en', 'ja', '#langJa']]) {
    const p = await page(); await p.goto(`${BASE}/hrms-calc/index.html?lang=${from}&x=1#finder`);
    await p.click(btn); const u = new URL(p.url());
    ok(u.searchParams.get('lang') === to && u.searchParams.get('x') === '1' && u.hash === '#finder', `URL updated ${from}->${to} (${p.url()})`);
    await p.reload(); ok(await p.evaluate(() => document.documentElement.lang) === to, `reload keeps ${to}`);
    await p.ctx.close();
  }
  // 2. personal page -> HRMS -> personal page, with and without localStorage
  for (const blocked of [false, true]) {
    const p = await page();
    if (blocked) await p.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }));
    await p.goto(`${BASE}/index.html`); await p.click('[data-language="en"]');
    await p.click('a[href^="./tools.html"]:visible'); await p.waitForLoadState();
    await p.click('a[href^="./hrms-calc/index.html"]:visible'); await p.waitForLoadState();
    ok(await p.evaluate(() => document.documentElement.lang) === 'en', `HRMS opens in English (localStorage ${blocked ? 'blocked' : 'available'})`);
    ok((await p.getAttribute('header a.home-link', 'href')) === '../tools.html?lang=en' && (await p.textContent('header a.home-link')) === '← Tools' && (await p.getAttribute('footer a[href^="../tools.html"]', 'href')) === '../tools.html?lang=en',
      'HRMS header and footer links to the tools page keep the language');
    await p.click('#langJa'); await p.click('footer a[href^="../index.html"]'); await p.waitForLoadState();
    ok(await p.evaluate(() => document.documentElement.lang) === 'ja', `back on personal page in Japanese (localStorage ${blocked ? 'blocked' : 'available'})`);
    await p.ctx.close();
  }
  // 3. invalid values in the closed "More elements" box
  for (const bad of ['', '-1', '1.5', '1001']) {
    const p = await page(); await p.goto(`${BASE}/hrms-calc/index.html?lang=ja#finder`);
    await p.click('#extraElements summary'); await p.fill('#extraRanges input[data-element="Fe"][data-bound="max"]', bad);
    await p.click('#extraElements summary'); await p.click('#searchButton');
    const st = await p.textContent('#searchStatus'); const open = await p.evaluate(() => document.querySelector('#extraElements').open);
    const focus = await p.evaluate(() => document.activeElement.dataset.element + '/' + document.activeElement.dataset.bound);
    ok(open && focus === 'Fe/max' && st.includes('Fe'), `invalid Fe max "${bad}" -> box opened, field focused, message: ${st}`);
    await p.ctx.close();
  }
  // 4. worker search, cancel, clearing on change, copy notice separate from the status
  {
    const p = await page({ permissions: ['clipboard-read', 'clipboard-write'] });
    // searches finish in well under a second; deliver results 3 s late so the cancel check is not a race
    await p.addInitScript(() => { const W = window.Worker; window.Worker = class extends W { set onmessage(f) { super.onmessage = e => setTimeout(() => f(e), 3000); } get onmessage() { return super.onmessage; } }; });
    await p.goto(`${BASE}/hrms-calc/index.html?lang=ja`); await p.click('#tab-finder');
    ok(new URL(p.url()).hash === '#finder' && await p.isVisible('#searchForm') && !(await p.isVisible('#calcForm')), 'finder tab opens and is kept in the address');
    await p.click('#searchButton'); await p.waitForFunction(() => !document.querySelector('#searchButton').disabled);
    ok((await p.$$('#results tbody tr')).length > 0, 'worker search returns rows');
    await p.fill('#found', '181.0708'); ok((await p.$$('#results tbody tr')).length === 0 && (await p.textContent('#searchStatus')) === '', 'changing a condition clears old results');
    // wide search -> cancel
    for (const [e, max] of [['C', 400], ['H', 800], ['N', 100], ['O', 200], ['S', 50]]) await p.fill(`#ranges input[data-element="${e}"][data-bound="max"]`, String(max));
    await p.fill('#tolerance', '1000'); await p.selectOption('#unit', 'mDa'); await p.fill('#found', '3000');
    await p.click('#searchButton'); await p.click('#cancel');
    ok((await p.textContent('#searchStatus')).includes('中止') && !(await p.isDisabled('#searchButton')), 'cancel stops the worker');
    // incomplete result -> copy keeps the status
    await p.fill('#found', '500'); await p.click('#searchButton');
    await p.waitForFunction(() => !document.querySelector('#searchButton').disabled, null, { timeout: 120000 });
    const st = await p.textContent('#searchStatus');
    ok(st.includes('一部の結果') && st.includes('誤差順'), `incomplete status shown: ${st}`);
    await p.click('#copy'); await p.waitForTimeout(200);
    ok((await p.textContent('#searchStatus')) === st, 'status unchanged after copying');
    ok((await p.textContent('#copyStatus')).includes('コピー'), `copy notice: ${await p.textContent('#copyStatus')}`);
    const clip = await p.evaluate(() => navigator.clipboard.readText());
    ok(clip.split('\n')[0].includes('一部の結果'), 'copied text keeps the completeness status');
    await p.ctx.close();
  }
  // 5. layout: every tab with results shown; no horizontal scroll, controls do not overlap
  for (const w of [360, 390, 1280]) for (const l of ['ja', 'en']) {
    const p = await page({ viewport: { width: w, height: 800 } }); await p.goto(`${BASE}/hrms-calc/index.html?lang=${l}`);
    await p.fill('#formula', 'C15H14O6'); await p.fill('#calcFound', '291.0860');
    const results = [];
    for (const tab of ['calculator', 'finder', 'batch', 'checker']) {
      await p.click(`#tab-${tab}`);
      if (tab === 'batch') await p.click('#batchExample');
      if (tab === 'checker') await p.click('#checkExample');
      results.push(tab + ' ' + JSON.stringify(await p.evaluate(() => {
        const sel = '.brand, .language-switch button, .tabs button, form button, .actions button, .range, form label, .si-options label, .result-ion, .result-mz, .result-facts div, .check-head, .check-values';
        const els = [...document.querySelectorAll(sel)].filter(e => e.checkVisibility());
        const r = els.map(e => e.getBoundingClientRect()); let overlaps = [];
        for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
          if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
          const a = r[i], b = r[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlaps.push(els[i].className + '/' + els[j].className);
        }
        return { overflow: document.documentElement.scrollWidth - innerWidth, overlaps };
      })));
    }
    ok(results.every(x => x.includes('"overflow":0') && x.includes('"overlaps":[]')), `layout ${w}px ${l}: ${results.join('; ')}`);
    await p.ctx.close();
  }
  // 6. pages (Japanese and English): internal links resolve; every shown image loads after scrolling through (lazy images included)
  for (const lang of ['ja', 'en']) for (const path of ['/index.html', '/research.html', '/publications.html', '/tools.html', '/hrms-calc/index.html', '/404.html']) {
    const p = await page(); const r = await p.goto(`${BASE}${path}?lang=${lang}`); await p.waitForLoadState('networkidle');
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); } });
    await p.waitForFunction(() => [...document.images].filter(i => i.getAttribute('src') && i.checkVisibility()).every(i => i.complete), null, { timeout: 15000 }).catch(() => {});
    const links = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => h.startsWith(location.origin)));
    let broken = [];
    for (const h of [...new Set(links.map(x => x.split('#')[0]))]) { const resp = await p.request.get(h); if (resp.status() !== 200) broken.push(h); }
    const shown = await p.evaluate(() => [...document.images].filter(i => i.getAttribute('src') && i.checkVisibility()).map(i => [i.src, i.complete && i.naturalWidth > 0]));
    const bad = shown.filter(x => !x[1]).map(x => x[0]);
    ok((path === '/404.html' || r.status() === 200) && !broken.length && !bad.length, `${path} (${lang}): links ${links.length}, broken ${broken.length}, images shown ${shown.length}, not loaded ${bad.join(' ')}`);
    await p.ctx.close();
  }
  // 7. image dialog on the publications page (role, name, focus trap, Esc / × / background click, focus return)
  for (const [l, name, close] of [['ja', '画像の拡大表示', '閉じる'], ['en', 'Enlarged image', 'Close']]) {
    const p = await page({ viewport: { width: 1280, height: 800 } }); await p.goto(`${BASE}/publications.html?lang=${l}`);
    const link = p.locator('.toc-link:visible').nth(1); const dlg = p.getByRole('dialog', { name });
    const isLink = () => link.evaluate(a => document.activeElement === a);
    const focusInDialog = () => p.evaluate(() => !!document.activeElement.closest('dialog[open]'));
    // open with the keyboard, Tab / Shift+Tab stay inside, Esc closes
    await link.focus(); await p.keyboard.press('Enter');
    ok(await dlg.isVisible() && await p.evaluate(() => document.querySelector('dialog.lightbox').matches(':modal')), `${l}: dialog "${name}" opens as a modal dialog`);
    ok(await p.getByRole('button', { name: close }).evaluate(b => b === document.activeElement), `${l}: focus on close button "${close}"`);
    let inside = true; for (const k of ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) { await p.keyboard.press(k); inside = inside && await focusInDialog(); }
    ok(inside, `${l}: Tab / Shift+Tab stay inside the dialog`);
    await p.keyboard.press('Escape'); ok(!(await dlg.isVisible()) && await isLink(), `${l}: Esc closes, focus back on the image link`);
    // close button
    await link.click(); await p.getByRole('button', { name: close }).click();
    ok(!(await dlg.isVisible()) && await isLink(), `${l}: close button closes, focus back on the image link`);
    // clicking the image keeps it open, clicking the background closes
    await link.click(); await p.waitForFunction(() => { const i = document.querySelector('dialog.lightbox img'); return i.complete && i.naturalWidth > 0; });
    await p.locator('dialog.lightbox img').click(); const stillOpen = await dlg.isVisible();
    await p.mouse.click(8, 790);
    ok(stillOpen && !(await dlg.isVisible()) && await isLink() && !(await p.evaluate(() => document.body.classList.contains('lb-open'))), `${l}: image click keeps it open; background click closes, focus back, page scroll restored`);
    await p.ctx.close();
  }
  // 8. publications: only images near the first screen are fetched on load
  for (const w of [390, 1280]) {
    const p = await page({ viewport: { width: w, height: 844 } }); let n = 0;
    p.on('request', r => { if (/\/images\/(toc|cover)\//.test(r.url())) n++; });
    await p.goto(`${BASE}/publications.html`, { waitUntil: 'networkidle' });
    const attrs = await p.evaluate(() => [...document.querySelectorAll('.toc-wrap img')].every((i, k) => i.width && i.getAttribute('width') && i.getAttribute('height') && i.decoding === 'async' && (k === 0 || i.loading === 'lazy')));
    ok(n < 15 && attrs, `publications ${w}px: ${n} of 15 images fetched on load; width/height/decoding/lazy set`);
    await p.ctx.close();
  }
  // 9. HRMS Calc: calculator result box, statement, isotope pattern, tabs, batch, checker
  {
    const p = await page({ permissions: ['clipboard-read', 'clipboard-write'] });
    await p.goto(`${BASE}/hrms-calc/index.html?lang=ja`);
    ok(await p.isVisible('#calcPlaceholder') && (await p.textContent('#calcMain')) === '' && !(await p.isVisible('#calcSi')) && await p.isVisible('.electron-note'),
      'calculator: empty box with a placeholder before calculating; electron note shown at the top');
    await p.fill('#formula', 'C6H12O6');
    ok((await p.textContent('.result-mz strong')) === '181.0707' && !(await p.isVisible('#calcPlaceholder')), 'calculator: result appears in the box while typing ([M+H]+ 181.0707, 4 decimal places by default)');
    await pickIon(p, 'calcIon', '[M+HCOO]-'); await p.fill('#calcFound', '225.0614');
    const facts = await p.textContent('.result-facts');
    ok((await p.textContent('.result-mz strong')) === '225.0616' && facts.includes('−0.85 ppm'), `calculator: formate adduct 225.0616 and error shown (${facts})`);
    const si = await p.textContent('#siText');
    ok(si === 'HRMS m/z: [M + HCOO]− Calcd for C7H13O8 225.0616; Found 225.0614.' && !(await p.$('[data-si=method]')), `statement without ionization method: ${si}`);
    const guide = await p.$eval('#calcSi .si-source a', a => [a.href, a.target]);
    ok(guide[0].includes('author_guidelines') && guide[0].includes('joceah') && guide[1] === '_blank' && !(await p.$('select[data-si]')), 'statement: one format, with a link to the J. Org. Chem. guidelines');
    await p.click('#siCopy'); await p.waitForTimeout(150);
    ok((await p.evaluate(() => navigator.clipboard.readText())).startsWith('HRMS m/z: [M + HCOO]−') && (await p.textContent('#siCopyStatus')).includes('コピー'), 'statement copied');
    const iso = await p.$$eval('#isoTable tbody tr', rs => rs.map(r => r.textContent));
    ok(iso.length >= 3 && iso[0].startsWith('M225.0616') && (await p.$$('#isoChart rect')).length === iso.length, `isotope table and chart: ${iso.join(' | ')}`);
    await p.fill('#formula', 'C6H12Q6'); await p.press('#formula', 'Enter');
    ok((await p.textContent('#calcMain')).includes('分子式を確認') && await p.evaluate(() => document.querySelector('#calcResult').classList.contains('error')), 'calculator: invalid formula explained after pressing Enter');
    await p.fill('#formula', 'C6H12O6'); await p.click('#langEn');
    ok((await p.textContent('.result-mz')).includes('Calculated m/z') && (await p.textContent('.tabs')).includes('Check SI text'), 'calculator: result kept and translated when switching to English');
    // tabs: keyboard and address
    await p.focus('#tab-calculator'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
    ok(await p.evaluate(() => document.activeElement.id) === 'tab-batch' && await p.isVisible('#batchForm') && new URL(p.url()).hash === '#batch', 'tabs: arrow keys move between tools and the address follows');
    // batch
    await p.click('#batchExample');
    const rows = await p.$$eval('#batchResults tbody tr', rs => rs.map(r => [...r.cells].map(c => c.textContent)));
    ok(rows.length === 4 && rows[2][3] === '[M − 2H]2−' && rows[2][5] === '541.0260' && rows[0][7] === '-1.03', `batch: ${rows.map(r => r.slice(1, 8).join(' ')).join(' | ')}`);
    await p.click('#batchCopyTsv'); await p.waitForTimeout(150);
    const tsv = await p.evaluate(() => navigator.clipboard.readText());
    ok(tsv.split('\n').length === 5 && tsv.split('\n')[1].split('\t')[5] === '203.0526', 'batch: table copied as tab-separated text');
    await p.click('#batchCopySi'); await p.waitForTimeout(150);
    const sis = (await p.evaluate(() => navigator.clipboard.readText())).split('\n');
    ok(sis.length === 4 && sis[0] === 'Glucose: HRMS m/z: [M + Na]+ Calcd for C6H12O6Na 203.0526; Found 203.0524.', `batch: statements copied (${sis[0]})`);
    await p.fill('#batchInput', 'C6H12O6 [M+Q]+\nfoo'); await p.click('#batchForm button.primary');
    ok((await p.$$('#batchResults tr.row-error')).length === 2 && (await p.textContent('#batchResults')).includes('[M+Q]+'), 'batch: unreadable lines are marked with the reason');
    // checker
    await p.click('#tab-checker'); await p.click('#checkExample');
    const st = await p.$$eval('#checkResults .badge', bs => bs.map(b => b.className.replace('badge ', '')));
    ok(st.join() === 'ok,error,ok,warn' && (await p.textContent('#checkResults')).includes('without the electron mass'), `checker: example verdicts ${st.join()}`);
    await p.fill('#checkInput', 'no HRMS data here'); await p.click('#checkForm button.primary');
    ok((await p.textContent('#checkSummary')).includes('No statement'), 'checker: message when nothing is found');
    await p.ctx.close();
  }
  // 10. HRMS Calc opened with a tool in the address
  {
    const p = await page(); await p.goto(`${BASE}/hrms-calc/index.html?lang=ja#checker`);
    ok(await p.isVisible('#checkForm') && await p.evaluate(() => document.querySelector('#tab-checker').getAttribute('aria-selected')) === 'true', 'address #checker opens the checker');
    const vis = async () => p.$$eval('#method [data-tabs]', ps => ps.filter(x => !x.hidden).map(x => x.dataset.t || x.querySelector('[data-t]').dataset.t).join());
    const onChecker = await vis(); await p.click('#tab-finder'); const onFinder = await vis();
    ok(onChecker === 'checkMethod' && onFinder === 'dbe,filterMethod,urlMethod' && await p.isVisible('#method [data-t=definition]') && await p.$('a[href="#method"]') === null,
      `method notes only for the open tool (checker: ${onChecker}; finder: ${onFinder}); no “Details” link`);
    const text = await p.textContent('main');
    ok(!text.includes('結合エネルギー') && !text.includes('最も多いと報告') && (await p.textContent('.journals-note')).trim() === '※ 計算値（calcd）は原文のままです。', 'removed notes are gone; journal note is one sentence');
    await p.ctx.close();
  }
  // 10b. decimal places of calculated values: shared by the calculator, finder and batch, saved in this browser
  {
    const p = await page(); await p.goto(`${BASE}/hrms-calc/index.html?lang=ja`);
    await p.fill('#formula', 'C6H12O6'); await p.press('#formula', 'Enter');
    const def = await p.textContent('.result-mz strong');
    await p.selectOption('#calculator [data-digits]', '6');
    const mz4 = await p.textContent('.result-mz strong'), fd = await p.$eval('#finder [data-digits]', s => s.value);
    await p.reload(); await p.fill('#formula', 'C6H12O6'); await p.press('#formula', 'Enter');
    const after = await p.textContent('.result-mz strong');
    await p.click('#tab-batch'); await p.fill('#batchInput', 'C6H12O6'); await p.click('#batchForm button.primary');
    await p.selectOption('#batch [data-digits]', '8');
    const b8 = await p.$eval('#batchResults tbody tr', tr => tr.cells[5].textContent);
    ok(def === '181.0707' && mz4 === '181.070665' && fd === '6' && after === '181.070665' && b8 === '181.07066456', `decimal places: default ${def}, 6 → ${mz4}, finder ${fd}, after reload ${after}, batch ${b8}`);
    await p.ctx.close();
  }
  // 11. typography: formulas with subscripts, charges as superscripts, italic m/z, external links in a new tab
  {
    const p = await page(); await p.goto(`${BASE}/hrms-calc/index.html?lang=ja`);
    await p.fill('#formula', 'C15H14O6'); await pickIon(p, 'calcIon', '[M+NH4]+');
    const opt = await p.$eval('#calcIon', s => [...s.options].map(o => o.text).join(' '));
    ok(opt.includes('[M + NH₄]⁺') && opt.includes('[M − 2H]²⁻') && opt.includes('[M + H − H₂O]⁺'), `ion options use super/subscripts: ${opt.slice(0, 80)}…`);
    const main = await p.innerHTML('#calcMain');
    ok(main.includes('C<sub>15</sub>H<sub>18</sub>NO<sub>6</sub>') && main.includes('NH<sub>4</sub>]<sup>+</sup>') && main.includes('<i>m</i>/<i>z</i>'), 'result: formula subscripts, charge superscript, italic m/z');
    ok((await p.innerHTML('.equation')).startsWith('<i>m</i>/<i>z</i>') && (await p.innerHTML('#constants tbody')).includes('<sup>12</sup>C'), 'equation italic; isotopes written as ¹²C');
    await p.click('#tab-batch'); await p.click('#batchExample');
    const bt = await p.innerHTML('#batchResults');
    ok(bt.includes('C<sub>48</sub>H<sub>28</sub>O<sub>30</sub>') && bt.includes('[M − 2H]<sup>2−</sup>') && bt.includes('<th>計算 <i>m</i>/<i>z</i></th>'), 'batch table: subscripts, superscripts, italic header');
    await p.click('#tab-checker'); await p.click('#checkExample');
    ok((await p.innerHTML('#checkResults')).includes('C<sub>6</sub>H<sub>12</sub>O<sub>6</sub>Na') && (await p.innerHTML('#checkResults')).includes('[M + Na]<sup>+</sup>'), 'checker: quoted text with subscripts and superscripts');
    ok((await p.innerHTML('#calcSi [data-t=siAppend]')).includes('C<sub>6</sub>H<sub>12</sub>O<sub>6</sub>Na') && (await p.inputValue('#formula')) === 'C15H14O6', 'help text subscripts; input field unchanged');
    const ext = await p.$$eval('a[href^="http"]', as => as.map(a => a.target === '_blank' && a.rel.includes('noopener')));
    ok(ext.length === 19 && ext.every(Boolean), `external links open in a new tab (${ext.length})`);
    await p.ctx.close();
  }
  // 11. inputs kept in the address, shareable links, saved settings, candidate filters
  {
    const p = await page({ permissions: ['clipboard-read', 'clipboard-write'] });
    await p.goto(`${BASE}/hrms-calc/index.html?lang=ja`);
    await p.fill('#formula', 'C6H12O6'); await pickIon(p, 'calcIon', '[M+Na]+'); await p.fill('#calcFound', '203.0524');
    let u = new URL(p.url()), hu = hashOf(p.url());
    ok(hu.tab === 'calculator' && hu.q.get('f') === 'C6H12O6' && hu.q.get('ion') === '[M+Na]+' && hu.q.get('found') === '203.0524' && u.searchParams.get('lang') === 'ja' && !u.searchParams.has('f'), `calculator inputs after # in the address, not in the query (${p.url()})`);
    // moving to another tab and back (or clicking the open tab) keeps the inputs in the address
    await p.click('#tab-finder'); await p.click('#tab-calculator'); await p.click('#tab-calculator');
    hu = hashOf(p.url());
    ok(hu.tab === 'calculator' && hu.q.get('f') === 'C6H12O6' && hu.q.get('found') === '203.0524', `inputs kept in the address after tab clicks (${p.url()})`);
    await p.click('#calcLink'); await p.waitForTimeout(200);
    const link = await p.evaluate(() => navigator.clipboard.readText());
    const lu = new URL(link), lh = hashOf(link);
    ok(lh.q.get('f') === 'C6H12O6' && !lu.searchParams.has('lang') && lh.tab === 'calculator' && (await p.textContent('#calcLinkStatus')).includes('コピー'), `link copied without the language (${link})`);
    const q = await page(); await q.goto(link);
    ok((await q.inputValue('#formula')) === 'C6H12O6' && (await q.inputValue('#calcIon')) === '[M+Na]+' && (await q.textContent('#calcMain')).includes('203.0526'), 'opening the link restores the calculator and its result');
    await q.ctx.close();
    await p.fill('#formula', ''); ok(!hashOf(p.url()).q.has('f') && await p.isHidden('#calcLinkRow'), 'emptying the formula removes it from the address');
    // finder link with ranges and filters runs the search
    const fl = `${BASE}/hrms-calc/index.html?lang=ja&mz=301.0354&ion=${encodeURIComponent('[M-H]-')}&tol=10&unit=ppm&r=C0-40,H0-80,N0-6,O0-20,S0-2,P0-2&filter=dbe,ratio`;
    const f = await page(); await f.goto(fl);
    await f.waitForFunction(() => !document.querySelector('#searchButton').disabled && document.querySelectorAll('#results tbody tr').length > 0);
    const fst = await f.textContent('#searchStatus');
    ok(hashOf(f.url()).tab === 'finder' && hashOf(f.url()).q.get('mz') === '301.0354' && !new URL(f.url()).searchParams.has('mz') && await f.isChecked('#filterDbe') && await f.isChecked('#filterRatio') && (await f.inputValue('#ranges input[data-element="P"][data-bound="max"]')) === '2' && fst.includes('除外 23 件') && fst.includes('候補 24 件'), `earlier ?mz= link restores conditions, searches and moves the inputs after #: ${fst}`);
    ok((await f.textContent('#results tbody tr:first-child')).includes('C15H10O7'), 'quercetin first after filtering');
    await f.uncheck('#filterRatio'); await f.click('#searchButton'); await f.waitForFunction(() => !document.querySelector('#searchButton').disabled && document.querySelectorAll('#results tbody tr').length > 0);
    ok((await f.textContent('#searchStatus')).includes('候補 36 件') && hashOf(f.url()).q.get('filter') === 'dbe', `filter change reflected in results and address: ${await f.textContent('#searchStatus')}`);
    // settings saved in this browser (same context = same storage)
    await f.selectOption('#unit', 'mDa'); await f.fill('#tolerance', '2'); await f.dispatchEvent('#tolerance', 'change');
    await f.click('#tab-calculator'); await pickIon(f, 'calcIon', '[M-H]-'); await f.click('#tab-batch'); await pickIon(f, 'batchIon', '[M+Na]+');
    ok(await f.isHidden('#batchTableActions'), 'batch copy button hidden before calculating');
    const g = await f.ctx.newPage(); await g.goto(`${BASE}/hrms-calc/index.html?lang=ja#finder`);
    ok((await g.inputValue('#unit')) === 'mDa' && (await g.inputValue('#tolerance')) === '2' && (await g.inputValue('#searchIon')) === '[M-H]-' && await g.isChecked('#filterDbe') && !(await g.isChecked('#filterRatio')) &&
      (await g.inputValue('#ranges input[data-element="P"][data-bound="max"]')) === '2' && (await g.inputValue('#calcIon')) === '[M-H]-' && (await g.inputValue('#batchIon')) === '[M+Na]+' && (await g.inputValue('#found')) === '181.0707',
      'settings restored on a new visit (measured m/z not stored)');
    await g.click('#resetSearch');
    ok((await g.inputValue('#unit')) === 'ppm' && (await g.inputValue('#tolerance')) === '5' && (await g.inputValue('#searchIon')) === '[M+H]+' && !(await g.isChecked('#filterDbe')) &&
      (await g.inputValue('#ranges input[data-element="C"][data-bound="max"]')) === '30' && (await g.inputValue('#ranges input[data-element="P"][data-bound="max"]')) === '0', 'reset restores the finder defaults');
    const h = await f.ctx.newPage(); await h.goto(`${BASE}/hrms-calc/index.html?lang=ja#finder`);
    ok((await h.inputValue('#tolerance')) === '5' && (await h.inputValue('#calcIon')) === '[M-H]-', 'reset is saved; other settings kept');
    await f.ctx.close(); await p.ctx.close();
    // storage blocked: the page still works
    const b = await page(); await b.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }));
    await b.goto(`${BASE}/hrms-calc/index.html?lang=ja&f=C6H12O6&ion=${encodeURIComponent('[M+H]+')}`);
    ok((await b.textContent('#calcMain')).includes('181.0707'), 'link works when storage is blocked');
    await b.ctx.close();
  }
  // 14. journal formats only in the calculator tab; the link in the statement area reaches them
  {
    const p = await page(); await p.goto(`${BASE}/hrms-calc/index.html?lang=ja`);
    const inCalc = await p.isVisible('#journals') && await p.evaluate(() => !!document.querySelector('#calculator #journals'));
    await p.click('#tab-finder'); const hiddenElsewhere = await p.isHidden('#journals');
    await p.click('#tab-calculator'); await p.fill('#formula', 'C6H12O6'); await p.click('#calcSi a[href="#journals"]');
    ok(inCalc && hiddenElsewhere && new URL(p.url()).hash === '#journals' && await p.isVisible('#calcForm') && (await p.$$('#journals dt')).length === 5,
      'journal formats shown only in the calculator tab; the link jumps there without changing the tool');
    await p.ctx.close();
  }
  // 15. review fixes: negative ion after the value, Wiley format and an unreadable line, batch labels and values, SVG enlargement
  {
    const p = await page(); await p.goto(`${BASE}/hrms-calc/index.html?lang=ja#checker`);
    await p.fill('#checkInput', 'HRMS (ESI) m/z calcd for C15H13O6 289.0718 [M-H]-; found 289.0716.\nHRMS (ESI) m/z calcd for C32H47NO5+Na+: 548.3352 [M+Na]+; found: 548.3331.\nHRMS (ESI) m/z 289.0716 [M - H]- (calcd for, 289.0718).');
    await p.click('#checkForm button.primary');
    const st = await p.$$eval('#checkResults .badge', b => b.map(x => x.className.replace('badge ', '')));
    const sum = await p.textContent('#checkSummary');
    ok(st.join() === 'ok,error,unparsed' && sum.includes('読み取れなかった記載 1 件'), `checker: negative ion ok, Wiley value flagged, unreadable line counted (${st}; ${sum})`);
    await p.click('#tab-batch');
    await p.fill('#batchInput', 'A\tC6H12O6\t[M+H]+\t181.0707\nB\tC6H12O6\t[M+H]+\t181.0707\nC\tC6H12O6\t[M+H]+\t0\nB');
    await p.click('#batchForm button.primary');
    const rows = await p.$$eval('#batchResults tbody tr', trs => trs.map(tr => [...tr.cells].map(c => c.textContent)));
    ok(rows.length === 4 && rows[1][1] === 'B' && rows[1][2] === 'C6H12O6' && rows[1][5] === '181.0707' && rows[2][9].includes('正の数') && rows[3][2] === 'B' && rows[3][1] === '',
      `batch: label B kept as a name, measured 0 rejected on its row, B alone is boron (${rows.map(r => r[1] + '/' + r[2] + '/' + r[9]).join(' | ')})`);
    await p.ctx.close();
    const q = await page({ viewport: { width: 1280, height: 900 } }); await q.goto(`${BASE}/publications.html?lang=ja`);
    await q.click('a.toc-link[href$="10.1021_acs.jnatprod.5c01064.svg"]');
    const w = await q.$eval('.lightbox img', i => Math.round(i.getBoundingClientRect().width));
    const inside = await q.$eval('.lightbox img', i => { const b = i.getBoundingClientRect(); return b.right <= innerWidth && b.bottom <= innerHeight; });
    await q.keyboard.press('Escape');
    const back = await q.evaluate(() => document.activeElement.classList.contains('toc-link'));
    ok(w > 900 && inside && back, `SVG figure enlarged to ${w}px within the screen; Esc returns focus to the link`);
    await q.ctx.close();
  }
  // 13. every text on the page and the window title exist in both languages (no "undefined"); HRMS Calc files carry one version
  for (const lang of ['ja', 'en']) {
    const p = await page(); await p.goto(`${BASE}/hrms-calc/index.html?lang=${lang}`);
    const bad = await p.evaluate(() => [document.title, ...[...document.querySelectorAll('[data-t]')].map(n => n.textContent)].filter(x => /undefined/.test(x)));
    const h1 = await p.textContent('h1');
    ok(!bad.length && h1 === (lang === 'ja' ? 'HRMS Calc（HRMS精密質量計算ツール）' : 'HRMS Calc (HRMS Exact Mass Calculator)') && (await p.title()) === h1, `${lang}: title and texts complete (${h1})`);
    await p.ctx.close();
  }
  {
    const fs = require('fs'), path = require('path'), dir = path.join(__dirname, '..', '..', 'hrms-calc');
    const re = /(?:from '\.\/|href="|src="|URL\('\.\/)([\w.-]+\.(?:js|css))(\?v=[\w-]+)?/g;
    const refs = ['index.html', 'app.js', 'core.js', 'si.js', 'worker.js'].flatMap(f => [...fs.readFileSync(path.join(dir, f), 'utf8').matchAll(re)].map(m => m[2] || 'none'));
    const versions = new Set(refs);
    ok(refs.length >= 9 && versions.size === 1 && !versions.has('none'), `HRMS Calc files carry one version (${[...versions]}, ${refs.length} references)`);
  }
  // 16. personal pages: one version of styles.css / app.js, the same footer, structured data, description and sharing tags follow the language
  {
    const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..', '..');
    const pages = ['index.html', 'research.html', 'publications.html', 'tools.html', '404.html'];
    const refs = pages.flatMap(f => [...fs.readFileSync(path.join(root, f), 'utf8').matchAll(/(?:href|src)="\.?\/(?:styles\.css|app\.js)(\?v=[\w-]+)?"/g)].map(m => m[1] || 'none'));
    const vs = new Set(refs);
    ok(refs.length === 10 && vs.size === 1 && !vs.has('none'), `personal pages load styles.css and app.js with one version (${[...vs]}, ${refs.length})`);
    const feet = new Set(pages.map(f => /<footer>[\s\S]*?<\/footer>/.exec(fs.readFileSync(path.join(root, f), 'utf8'))[0]));
    ok(feet.size === 1 && [...feet][0].includes('最終更新'), 'every personal page has the same footer with the last update');
    for (const [f, type] of [['index.html', 'Person'], ['hrms-calc/index.html', 'WebApplication']]) {
      const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(fs.readFileSync(path.join(root, f), 'utf8'));
      let d = null; try { d = JSON.parse(m[1]); } catch (e) {}
      ok(d && d['@type'] === type && (type !== 'Person' || d.sameAs.length === 4), `${f}: structured data ${type} parses`);
    }
    for (const url of ['index.html', 'tools.html', 'hrms-calc/index.html']) {
      const p = await page(); await p.goto(`${BASE}/${url}?lang=en`);
      const m = await p.evaluate(() => ['meta[name=description]', 'meta[property="og:description"]', 'meta[property="og:title"]', 'meta[property="og:locale"]'].map(s => document.querySelector(s).content));
      ok(!/[\u3040-\u30ff\u4e00-\u9fff]/.test(m[0] + m[1]) && m[2] === await p.title() && m[3] === 'en_US', `${url}: description and sharing tags in English (${m[0].slice(0, 30)}…)`);
      await p.click(url.startsWith('hrms') ? '#langJa' : '[data-language="ja"]');
      const j = await p.evaluate(() => [document.querySelector('meta[name=description]').content, document.querySelector('meta[property="og:locale"]').content]);
      ok(/[\u3040-\u30ff]/.test(j[0]) && j[1] === 'ja_JP', `${url}: back to Japanese`);
      await p.ctx.close();
    }
  }
  // 17. sharing image, titles, email alt, page jump, back to top, language button lang, sitemap lastmod, image sizes, noscript
  {
    const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..', '..');
    const read = f => fs.readFileSync(path.join(root, f), 'utf8');
    const png = f => { const b = fs.readFileSync(path.join(root, f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
    const og = png('images/og-image.png');
    const withOg = ['index.html', 'research.html', 'publications.html', 'tools.html', 'hrms-calc/index.html'];
    ok(og[0] === 1200 && og[1] === 630 && withOg.every(f => { const s = read(f); return s.includes('content="https://yosuke-matsuo.github.io/images/og-image.png"') && s.includes('og:image:width" content="1200"') && s.includes('og:image:height" content="630"') && s.includes('name="twitter:card" content="summary_large_image"'); }),
      `og-image.png is 1200×630 and declared on ${withOg.length} pages`);
    const bad = [...read('publications.html').matchAll(/<img src="\.\/(images\/[^"]+\.png)"[^>]*width="(\d+)" height="(\d+)"/g)].filter(m => { const [w, h] = png(m[1]); return w !== +m[2] || h !== +m[3]; }).map(m => m[1]);
    const big = fs.readdirSync(path.join(root, 'images/toc')).filter(f => f.endsWith('.png') && png('images/toc/' + f)[0] > 1600);
    ok(!bad.length && !big.length, `publication PNGs: width/height match the files, none wider than 1600px (${bad.concat(big)})`);
    ok((read('sitemap.xml').match(/<lastmod>\d{4}-\d\d-\d\d<\/lastmod>/g) || []).length === 5, 'sitemap: every URL has lastmod');
    ok(read('hrms-calc/index.html').includes('<noscript>') && read('hrms-calc/index.html').includes('This tool requires JavaScript.'), 'HRMS Calc: message without JavaScript');
    for (const lang of ['ja', 'en']) {
      const p = await page(); await p.goto(`${BASE}/index.html?lang=${lang}`);
      const t = await p.title(), ogt = await p.getAttribute('meta[property="og:title"]', 'content'), alt = await p.getAttribute('.about-mail img', 'alt');
      const btn = await p.$$eval('.language-switch button', bs => bs.map(b => b.lang).join());
      ok(t === (lang === 'ja' ? '松尾洋介（Yosuke Matsuo）｜九州医療科学大学 薬学部' : 'Yosuke Matsuo | Kyushu University of Medical Science') && ogt === t && alt === (lang === 'ja' ? 'メールアドレス（画像）' : 'Email address (image)') && btn === 'ja,en',
        `${lang}: top title, og:title, email alt, language buttons (${t} / ${alt})`);
      await p.goto(`${BASE}/publications.html?lang=${lang}`);
      const jump = await p.$$eval('.page-jump a', as => as.map(a => a.getAttribute('href')).join());
      const top = await p.textContent('.back-to-top a');
      ok((await p.title()) === (lang === 'ja' ? '業績 — 松尾洋介（Yosuke Matsuo）' : 'Publications — Yosuke Matsuo') && jump === '#papers,#reviews,#presentations' && top === (lang === 'ja' ? 'ページ上部へ戻る' : 'Back to top'),
        `${lang}: publications title, page jump with reviews, back to top`);
      await p.ctx.close();
    }
  }
  // 18. HRMS Calc: privacy note below the tools (before the method), formula input on the first screen of a small phone
  for (const lang of ['ja', 'en']) {
    const p = await page({ viewport: { width: 375, height: 667 } }); await p.goto(`${BASE}/hrms-calc/index.html?lang=${lang}`);
    const r = await p.evaluate(() => ({ note: document.querySelector('.privacy-note').textContent, before: !!(document.querySelector('.privacy-note').compareDocumentPosition(document.querySelector('#method')) & Node.DOCUMENT_POSITION_FOLLOWING), formulaBottom: document.querySelector('#formula').getBoundingClientRect().bottom, lead: !!document.querySelector('.lead') }));
    ok(r.note === (lang === 'ja' ? '計算はすべてブラウザー内で行い、入力した内容はどこにも送信しません。' : 'Everything runs in your browser; nothing you enter is sent anywhere.') && r.before && !r.lead && r.formulaBottom <= 667,
      `${lang}: privacy note before the method; formula input within the first screen at 375×667 (bottom ${Math.round(r.formulaBottom)}px)`);
    await p.ctx.close();
  }
  // 19. checker: tolerance in ppm or mDa, kept in this browser
  {
    const p = await page(); await p.goto(`${BASE}/hrms-calc/index.html?lang=ja#checker`);
    await p.fill('#checkInput', 'HRMS (ESI) m/z: [M + H]+ Calcd for C6H13O6 181.0707; Found 181.0710.');
    // +0.34 mDa = +1.85 ppm: within ±1 mDa, outside ±1 ppm
    await p.fill('#checkTol', '1'); await p.selectOption('#checkUnit', 'mDa'); await p.click('#checkForm button.primary');
    const headMDa = await p.textContent('#checkResults .check-head'), vals = await p.textContent('#checkResults .check-values');
    await p.selectOption('#checkUnit', 'ppm'); const head = await p.textContent('#checkResults .check-head');
    await p.selectOption('#checkUnit', 'mDa'); await p.reload();
    const kept = await p.$eval('#checkUnit', s => s.value);
    ok(!headMDa.includes('超えて') && head.includes('±1 ppm') && vals.includes('mDa') && vals.includes('ppm') && kept === 'mDa',
      `checker: +0.34 mDa is within ±1 mDa but outside ±1 ppm; unit kept after reload (${head.trim()})`);
    await p.ctx.close();
  }
  // 20. formula finder: the measured m/z field has no spin buttons
  {
    const p = await page(); await p.goto(`${BASE}/hrms-calc/index.html?lang=ja#finder`);
    const ap = await p.$eval('#found', i => getComputedStyle(i).appearance);
    ok(ap === 'textfield', `measured m/z without spin buttons (appearance ${ap})`);
    await p.ctx.close();
  }
  // 12. ion picker: every ion type once, open/close, keyboard, choice, panel inside the screen
  {
    const p = await page(); await p.goto(`${BASE}/hrms-calc/index.html?lang=ja`);
    for (const id of ['calcIon', 'searchIon', 'batchIon']) {
      const same = await p.evaluate(id => { const opts = [...document.querySelectorAll(`#${id} option`)].map(o => o.value).sort(); const btns = [...document.querySelectorAll(`#${id}-panel button[data-ion]`)].map(b => b.dataset.ion).sort(); return opts.length > 0 && JSON.stringify(opts) === JSON.stringify(btns); }, id);
      ok(same, `${id}: the table has every ion type exactly once`);
    }
    await p.fill('#formula', 'C6H12O6');
    await p.click('#calcIon-picker .ion-current');
    ok(await p.isVisible('#calcIon-panel') && (await p.getAttribute('#calcIon-picker .ion-current', 'aria-expanded')) === 'true' && await p.evaluate(() => document.activeElement.dataset.ion) === '[M+H]+', 'picker opens with focus on the current ion');
    await p.keyboard.press('Escape');
    ok(await p.isHidden('#calcIon-panel') && await p.evaluate(() => document.activeElement.classList.contains('ion-current')), 'Esc closes the table, focus back on the button');
    await p.click('#calcIon-picker .ion-current'); await p.click('h1');
    ok(await p.isHidden('#calcIon-panel'), 'a click outside closes the table');
    await pickIon(p, 'calcIon', '[2M+Na]+');
    ok((await p.inputValue('#calcIon')) === '[2M+Na]+' && (await p.textContent('#calcIon-current')) === '[2M + Na]⁺' && (await p.textContent('#calcMain')).includes('383.1160') &&
      (await p.getAttribute('#calcIon-panel button[data-ion="[2M+Na]+"]', 'aria-pressed')) === 'true' && await p.isHidden('#calcIon-panel'), `choosing an ion updates the button and the result (${await p.textContent('.result-mz')})`);
    await p.click('#langEn');
    ok((await p.textContent('#calcIon-panel caption')) === 'Positive ions' && (await p.textContent('#calcIon-current')) === '[2M + Na]⁺', 'table captions follow the language');
    await p.ctx.close();
    for (const w of [360, 1280]) {
      const q = await page({ viewport: { width: w, height: 800 } }); await q.goto(`${BASE}/hrms-calc/index.html?lang=ja`);
      const boxes = [];
      for (const [tab, id] of [['calculator', 'calcIon'], ['finder', 'searchIon'], ['batch', 'batchIon']]) {
        await q.click(`#tab-${tab}`); await q.click(`#${id}-picker .ion-current`);
        const r = await q.$eval(`#${id}-panel`, e => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; });
        boxes.push(`${id} ${r}`); ok(r[0] >= 0 && r[1] <= w, `${w}px: ${id} table inside the screen (${r})`);
        await q.keyboard.press('Escape');
      }
      await q.ctx.close();
    }
  }
  await browser.close(); console.log(fails ? `${fails} check(s) failed` : 'all browser checks passed'); process.exit(fails ? 1 : 0);
})();
