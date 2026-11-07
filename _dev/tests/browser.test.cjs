// Browser checks for HRMS Calc and the personal site (run with an HTTP server; see README.txt)
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8765';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const page = async (opts = {}) => { const ctx = await browser.newContext(opts); const p = await ctx.newPage(); p.ctx = ctx; return p; };

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
    await p.click('a[href^="./software.html"]:visible'); await p.waitForLoadState();
    await p.click('a[href^="./hrms-calc/index.html"]:visible'); await p.waitForLoadState();
    ok(await p.evaluate(() => document.documentElement.lang) === 'en', `HRMS opens in English (localStorage ${blocked ? 'blocked' : 'available'})`);
    ok(!(await p.$('header a')), 'HRMS header has no link to the personal page');
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
  for (const lang of ['ja', 'en']) for (const path of ['/index.html', '/research.html', '/publications.html', '/software.html', '/hrms-calc/index.html', '/404.html']) {
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
    ok((await p.textContent('.result-mz strong')) === '181.070665' && !(await p.isVisible('#calcPlaceholder')), 'calculator: result appears in the box while typing ([M+H]+ 181.070665)');
    await p.selectOption('#calcIon', '[M+HCOO]-'); await p.fill('#calcFound', '225.0614');
    const facts = await p.textContent('.result-facts');
    ok((await p.textContent('.result-mz strong')) === '225.061591' && facts.includes('−0.85 ppm'), `calculator: formate adduct 225.061591 and error shown (${facts})`);
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
    ok(rows.length === 4 && rows[2][3] === '[M − 2H]2−' && rows[2][5] === '541.025993' && rows[0][7] === '-1.03', `batch: ${rows.map(r => r.slice(1, 8).join(' ')).join(' | ')}`);
    await p.click('#batchCopyTsv'); await p.waitForTimeout(150);
    const tsv = await p.evaluate(() => navigator.clipboard.readText());
    ok(tsv.split('\n').length === 5 && tsv.split('\n')[1].split('\t')[5] === '203.052609', 'batch: table copied as tab-separated text');
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
    await p.click('.electron-note a[href="#method"]'); ok(await p.isVisible('#checkForm') && new URL(p.url()).hash === '#method', '“Details” jumps to the method without changing the tool');
    await p.ctx.close();
  }
  // 11. typography: formulas with subscripts, charges as superscripts, italic m/z, external links in a new tab
  {
    const p = await page(); await p.goto(`${BASE}/hrms-calc/index.html?lang=ja`);
    await p.fill('#formula', 'C15H14O6'); await p.selectOption('#calcIon', '[M+NH4]+');
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
    ok(ext.length === 8 && ext.every(Boolean), `external links open in a new tab (${ext.length})`);
    await p.ctx.close();
  }
  await browser.close(); console.log(fails ? `${fails} check(s) failed` : 'all browser checks passed'); process.exit(fails ? 1 : 0);
})();
