'use strict';
const buttons = [...document.querySelectorAll('[data-language]')];
function setLanguage(lang) {
  const sel = lang === 'en' ? 'en' : 'ja';
  document.documentElement.lang = sel;
  document.querySelectorAll('[data-ja][data-en]').forEach(n => { if (n.tagName !== 'IMG') n.textContent = n.dataset[sel]; });
  document.querySelectorAll('[data-lang]').forEach(n => { n.hidden = n.dataset.lang !== sel; });
  const title = document.querySelector('title'); if (title) document.title = title.dataset[sel];
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

// lightbox: open TOC / cover images over the page; close with background click, × or Esc
const lb = document.createElement('div');
lb.className = 'lightbox'; lb.hidden = true;
lb.innerHTML = '<button type="button" class="lightbox-close" aria-label="Close">×</button><img alt=""/>';
document.body.appendChild(lb);
const lbImg = lb.querySelector('img');
let lastLink = null;
function closeLb() { lb.hidden = true; lbImg.removeAttribute('src'); document.body.classList.remove('lb-open'); if (lastLink) lastLink.focus(); }
document.querySelectorAll('.toc-link').forEach(a => a.addEventListener('click', e => {
  const img = a.querySelector('img'); if (!img) return;
  e.preventDefault(); lastLink = a;
  lbImg.src = img.getAttribute('src'); lbImg.alt = img.alt;
  lb.hidden = false; document.body.classList.add('lb-open'); lb.querySelector('button').focus();
}));
lb.addEventListener('click', e => { if (e.target !== lbImg) closeLb(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !lb.hidden) closeLb(); });
