'use strict';
const buttons = [...document.querySelectorAll('[data-language]')];
function setLanguage(lang) {
  const sel = lang === 'en' ? 'en' : 'ja';
  document.documentElement.lang = sel;
  document.querySelectorAll('[data-ja][data-en]').forEach(n => { if (n.tagName !== 'IMG') n.textContent = n.dataset[sel]; });
  document.querySelectorAll('[data-lang]').forEach(n => { n.hidden = n.dataset.lang !== sel; });
  document.querySelectorAll('.toc-missing').forEach(n => { n.textContent = n.dataset[sel + 'Missing']; });
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
buttons.forEach(b => b.addEventListener('click', () => setLanguage(b.dataset.language)));
// TOC graphics: show a labelled placeholder until the image file is added
document.querySelectorAll('img.toc-img').forEach(img => {
  const miss = () => { const d = document.createElement('div'); d.className = 'toc-missing';
    d.dataset.jaMissing = img.dataset.jaMissing; d.dataset.enMissing = img.dataset.enMissing;
    d.textContent = img.dataset[(document.documentElement.lang === 'en' ? 'en' : 'ja') + 'Missing']; img.replaceWith(d); };
  // try .png first, then .svg, then show the placeholder
  const onErr = () => { if (img.src.endsWith('.png')) { img.src = img.src.replace(/\.png$/, '.svg'); } else { miss(); } };
  img.addEventListener('error', onErr);
  if (img.complete && img.naturalWidth === 0) onErr();
});
(() => { const links = [...document.querySelectorAll('.side-toc a')]; if (!links.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-10% 0px -70% 0px' });
  links.forEach(a => { const s = document.getElementById(a.getAttribute('href').slice(1)); if (s) io.observe(s); }); })();
let stored; try { stored = localStorage.getItem('ym-language'); } catch (e) {}
const req = new URLSearchParams(location.search).get('lang');
setLanguage(['ja', 'en'].includes(req) ? req : stored || (navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en'));
