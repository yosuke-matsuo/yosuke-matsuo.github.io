'use strict';
// English text that contains markup is kept in <template data-lang="en"> so the initial HTML (what search engines read) is Japanese only; put it in place first
document.querySelectorAll('template[data-lang]').forEach(t => t.replaceWith(t.content));
const buttons = [...document.querySelectorAll('[data-language]')];
function setLanguage(lang) {
  const sel = lang === 'en' ? 'en' : 'ja';
  document.documentElement.lang = sel;
  document.querySelectorAll('[data-ja][data-en]').forEach(n => { if (n.tagName === 'META') n.content = n.dataset[sel]; else if (n.tagName === 'IMG') n.alt = n.dataset[sel]; else n.textContent = n.dataset[sel]; });
  document.querySelectorAll('[data-lang]').forEach(n => { n.hidden = n.dataset.lang !== sel; });
  const title = document.querySelector('title'); if (title) document.title = title.dataset[sel];
  // page title and locale for sharing follow the language as well (the description has data-ja / data-en)
  const og = p => document.querySelector(`meta[property="og:${p}"]`);
  if (og('title') && title) og('title').content = title.dataset[sel];
  if (og('locale')) og('locale').content = sel === 'en' ? 'en_US' : 'ja_JP';
  buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.language === sel)));
  try { localStorage.setItem('ym-language', sel); } catch (e) {}
  document.querySelectorAll('a[href]').forEach(a => {
    const h = a.getAttribute('href');
    if (!h || /^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith('#')) return;
    const [pathq, frag] = h.split('#'); const [path, q] = pathq.split('?');
    if (!/\.html$/.test(path)) return;
    const ps = new URLSearchParams(q || ''); ps.set('lang', sel);
    a.setAttribute('href', `${path}?${ps}${frag ? '#' + frag : ''}`);
  });
}
buttons.forEach(b => b.addEventListener('click', () => {
  setLanguage(b.dataset.language);
  // keep ?lang= in the address bar in sync so reload/sharing keeps the chosen language
  try { const u = new URL(location.href); u.searchParams.set('lang', b.dataset.language === 'en' ? 'en' : 'ja'); history.replaceState(null, '', u); } catch (e) {}
}));
let stored; try { stored = localStorage.getItem('ym-language'); } catch (e) {}
const req = new URLSearchParams(location.search).get('lang');
setLanguage(['ja', 'en'].includes(req) ? req : stored || (navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en'));

// lightbox: enlarge TOC / cover images in a modal dialog; close with ×, Esc or a click outside the image
const lbText = { ja: { name: '画像の拡大表示', close: '閉じる' }, en: { name: 'Enlarged image', close: 'Close' } };
const lb = document.createElement('dialog');
lb.className = 'lightbox';
lb.innerHTML = '<button type="button" class="lightbox-close">×</button><img alt=""/>';
document.body.appendChild(lb);
const lbImg = lb.querySelector('img'), lbClose = lb.querySelector('button');
let lastLink = null;
function afterClose() {
  lbImg.removeAttribute('src'); lbImg.removeAttribute('style'); document.body.classList.remove('lb-open');
  if (lastLink) lastLink.focus(); lastLink = null;
}
lb.addEventListener('close', afterClose); // Esc
function closeLb() { if (lb.open) lb.close(); afterClose(); }
document.querySelectorAll('.toc-link').forEach(a => {
  a.setAttribute('aria-haspopup', 'dialog');
  a.addEventListener('click', e => {
    const img = a.querySelector('img');
    if (!img || typeof lb.showModal !== 'function') return; // without <dialog> support the link opens the image itself
    e.preventDefault(); lastLink = a;
    const t = lbText[document.documentElement.lang === 'en' ? 'en' : 'ja'];
    lb.setAttribute('aria-label', t.name); lbClose.setAttribute('aria-label', t.close);
    lbImg.src = img.getAttribute('src'); lbImg.alt = img.alt;
    // an SVG scales without loss: show it as large as the screen allows, keeping the aspect ratio
    if (/\.svg(?:[?#]|$)/i.test(img.getAttribute('src')) && img.width && img.height) {
      const w = Math.min(window.innerWidth - 32, (window.innerHeight - 64) * img.width / img.height);
      lbImg.style.width = `${Math.max(w, img.width)}px`;
    }
    document.body.classList.add('lb-open'); lb.showModal(); lbClose.focus();
  });
});
lb.addEventListener('click', e => { if (e.target !== lbImg) closeLb(); });
// the close button is the only control: Tab / Shift+Tab stay on it
lb.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); lbClose.focus(); } });
