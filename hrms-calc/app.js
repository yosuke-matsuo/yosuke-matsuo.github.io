import {ELEMENTS,IONS,ELECTRON_MASS,parseFormula,ion,ppm} from './core.js';
const $=id=>document.getElementById(id);
const strings={
 ja:{skip:'本文へ移動',
  lead:'分子式からHRMSの精密質量（m/z）を計算し、実測 m/z から分子式の候補を探します。計算はブラウザー内で行い、入力した値はどこにも送信しません。',
  calcTitle:'精密質量を計算',searchTitle:'分子式候補を検索',method:'計算方法',sources:'出典・参考文献',
  formula:'分子式（中性分子 M）',ion:'イオンの種類',optionalFound:'実測 m/z（任意）',
  syntax:'例：C6H12O6。H・Na などの付加や脱離は「イオンの種類」で選びます。括弧・同位体の指定・電荷を含む式は入力できません。',
  calculate:'計算する',found:'実測 m/z',tolerance:'許容誤差 ±',
  rangeHelp:'中性分子 M に含める元素ごとに、原子数の範囲（最小〜最大）を指定します。使わない元素は最大を 0 にします。付加イオンの原子は自動で加わります。',
  moreElements:'その他の元素（金属・希土類など）',search:'候補を検索',cancel:'検索を中止',
  candidateNote:'質量が許容誤差に入る組成を、誤差の小さい順に表示します。不飽和度（DBE）では絞り込んでいないので、DBEの列も確認してください。化合物として妥当かどうかは、ほかのデータと合わせて判断します。',
  copy:'結果をコピー',
  definition:'nᵢ は付加・脱離後のイオンに含まれる原子数、mᵢ は各元素の同位体質量、z は符号付きの電荷数です。2価以上のイオンは |z| で割ります。',
  electron:'電子の質量は自動で補正します。正電荷1つにつき電子1個分を引き、負電荷1つにつき足します（mₑ = 0.0005485799090441 Da）。',
  precision:'結合エネルギーやイオン化エネルギーに相当する質量は含めません（HRMSの組成計算で通常使われる扱いです）。表示は小数点以下6桁で、候補の判定には丸める前の値を使います。',
  ppm:'誤差（ppm）=（実測値 − 計算値）/ 計算値 × 10⁶。誤差（mDa）=（実測値 − 計算値）× 1000。許容誤差は ± の範囲として使います。',
  dbe:'DBE = 1 + C + N/2 − (H + F + Cl + Br + I)/2。中性分子 M の値を、小数もそのまま表示します。C・H・N・O・S・ハロゲン以外の元素を含む組成では「—」とします。スルホンなど硫黄の酸化数が高い化合物では、値の解釈に注意してください。',
  isotopes:'84元素に対応し、各元素で天然存在比が最も高い同位体の質量を使います（例：B は ¹¹B、Fe は ⁵⁶Fe、Se は ⁸⁰Se）。最も軽い同位体や、スペクトルで最も強いピークとは一致しないことがあります。Tc・Pm など天然の同位体組成がない元素は使えません。',
  constants:'使用する同位体と質量を表示',
  isotopeSource:'同位体質量',electronSource:'電子質量',paperIntro:'HRMSデータの報告で起こりやすい誤り（電子質量やイオン組成の扱いなど）',
  accessDate:'データ参照日：2026年11月7日',
  privacy:'計算はすべてブラウザー内で行い、入力した分子式や実測値はどこにも送信しません。',
  electronWhy:'HRMSの理論値は、電子の質量を考慮して計算する必要があります。中性分子の質量のまま比べると、数ppmの差が生じます。論文のSupporting Informationの精密質量データでは、この扱いの誤りが最も多く見られたと報告されています。',
  sourceCode:'ソースコード',codeLicense:'HRMS Calcのプログラム：',
  rangeEmpty:'空欄です',rangeInt:'整数で入力してください',rangeBounds:'0〜1000の範囲で入力してください',rangeOrder:'最小が最大より大きくなっています',rangeNone:'少なくとも1つの元素で、最大を1以上にしてください。',
  minimum:'最小',maximum:'最大',neutral:'中性分子 M の質量',ionFormula:'イオンの組成',mz:'計算 m/z',
  running:'検索中…',complete:'検索完了',incomplete:'探索の上限に達したため、一部の結果です（見つかった候補の中での誤差順）。範囲を狭めて検索し直してください。',stopped:'検索を中止しました。',
  countFmt:n=>`候補 ${n} 件`,copyOk:'コピーしました',copyFail:'コピーできませんでした。表を選択してコピーしてください。',
  element:'元素',isotope:'同位体',mass:'質量 / Da',
  errorFormula:'分子式を確認してください。元素記号と正の整数だけを使えます。',
  errorComposition:'この組成では指定したイオンになりません（脱プロトン化するHがない、など）。',
  errorRange:'原子数は0〜1000の整数で、最小 ≦ 最大にしてください。少なくとも1つの元素の最大を1以上にします。',
  errorSearch:'実測 m/z と許容誤差を確認してください（ppm は 0 以上、100万未満）。',
  errorGeneric:'計算できませんでした。入力を確認してください。',
  title:'HRMS Calc — 精密質量と分子式候補'},
 en:{skip:'Skip to content',
  lead:'Calculates exact HRMS masses (m/z) from molecular formulas and finds candidate formulas for a measured m/z. Everything runs in your browser; nothing you enter is sent anywhere.',
  calcTitle:'Calculate exact mass',searchTitle:'Find candidate formulas',method:'Method',sources:'Sources and references',
  formula:'Molecular formula (neutral M)',ion:'Ion type',optionalFound:'Measured m/z (optional)',
  syntax:'Example: C6H12O6. Choose adducts and losses such as H or Na under “Ion type”. Parentheses, isotope labels and charges cannot be entered in the formula.',
  calculate:'Calculate',found:'Measured m/z',tolerance:'Tolerance ±',
  rangeHelp:'For each element in the neutral M, set the range of atom counts (minimum–maximum). Set the maximum to 0 for elements you do not need. Adduct atoms are added automatically.',
  moreElements:'More elements (metals, rare earths and others)',search:'Find formulas',cancel:'Cancel search',
  candidateNote:'Compositions within the tolerance are listed from the smallest error. They are not filtered by double-bond equivalents (DBE), so check the DBE column as well. Judge whether a candidate is chemically reasonable together with your other data.',
  copy:'Copy results',
  definition:'nᵢ is the number of atoms in the final ion, mᵢ the isotope mass of each element and z the signed charge. Ions with two or more charges are divided by |z|.',
  electron:'The electron mass is corrected automatically: one electron is subtracted per positive charge and added per negative charge (mₑ = 0.0005485799090441 Da).',
  precision:'Mass equivalents of binding and ionization energies are not included, as is usual for HRMS composition calculations. Values are shown to six decimal places; candidates are judged with unrounded values.',
  ppm:'Error (ppm) = (measured − calculated) / calculated × 10⁶. Error (mDa) = (measured − calculated) × 1000. The tolerance is applied as a ± range.',
  dbe:'DBE = 1 + C + N/2 − (H + F + Cl + Br + I)/2, for the neutral M, shown with any fraction. Compositions containing elements other than C, H, N, O, S and halogens show —. Interpret the value with care for compounds with high-valent sulfur, such as sulfones.',
  isotopes:'84 elements are supported, each with the mass of its most naturally abundant isotope (for example ¹¹B for B, ⁵⁶Fe for Fe and ⁸⁰Se for Se). This may differ from the lightest isotope or the most intense peak in a spectrum. Elements without a natural isotope composition, such as Tc and Pm, cannot be used.',
  constants:'Show isotopes and masses used',
  isotopeSource:'Isotope masses',electronSource:'Electron mass',paperIntro:'Common errors in reporting HRMS data (electron mass, ion composition and more)',
  accessDate:'Data accessed: 7 November 2026',
  privacy:'All calculations run in your browser; formulas and measured values are never sent anywhere.',
  electronWhy:'Theoretical HRMS values must account for the electron mass; comparing with the mass of the neutral molecule gives an error of a few ppm. In accurate-mass data from Supporting Information files, this was reported as the most frequent error.',
  sourceCode:'Source code',codeLicense:'HRMS Calc code: ',
  rangeEmpty:'is empty',rangeInt:'must be a whole number',rangeBounds:'must be between 0 and 1000',rangeOrder:'minimum is larger than maximum',rangeNone:'Set a maximum of 1 or more for at least one element.',
  minimum:'Minimum',maximum:'Maximum',neutral:'Mass of neutral M',ionFormula:'Ion composition',mz:'Calculated m/z',
  running:'Searching…',complete:'Search complete',incomplete:'The search limit was reached, so the results are partial (sorted by error among the candidates found). Narrow the ranges and search again.',stopped:'Search canceled.',
  countFmt:n=>`${n} candidate${n===1?'':'s'}`,copyOk:'Copied',copyFail:'Could not copy. Select the table and copy it manually.',
  element:'Element',isotope:'Isotope',mass:'Mass / Da',
  errorFormula:'Check the formula. Use element symbols and positive integers only.',
  errorComposition:'This composition cannot form the selected ion (for example, no H to remove for deprotonation).',
  errorRange:'Atom counts must be integers from 0 to 1000 with minimum ≤ maximum, and at least one element needs a maximum of 1 or more.',
  errorSearch:'Check the measured m/z and the tolerance (ppm must be at least 0 and below one million).',
  errorGeneric:'The calculation failed. Check your input.',
  title:'HRMS Calc — exact masses and candidate formulas'}
};
function initialLang(){const q=new URLSearchParams(location.search).get('lang');if(q==='ja'||q==='en')return q;try{const s=localStorage.getItem('ym-language');if(s==='ja'||s==='en')return s;}catch(e){}return (navigator.language||'').startsWith('ja')?'ja':'en';}
let lang=initialLang(),worker=null,last=null;
const t=k=>strings[lang][k];
function headers(){return [t('formula'),t('ionFormula'),'z',t('mz'),'Δ ppm','Δ mDa','DBE'];}
function tableHead(table,labels){table.querySelector('thead').replaceChildren();const tr=document.createElement('tr');for(const s of labels){const th=document.createElement('th');th.textContent=s;tr.append(th);}table.querySelector('thead').append(tr);}
function row(table,values){const tr=document.createElement('tr');for(const s of values){const td=document.createElement('td');td.textContent=s;tr.append(td);}table.querySelector('tbody').append(tr);}
function resultValues(r){return [r.formula,r.ionFormula,r.z,r.mz.toFixed(6),r.ppm.toFixed(3),r.mDa.toFixed(3),r.dbe??'—'];}
function renderResults(){const table=$('results');tableHead(table,headers());table.querySelector('tbody').replaceChildren();if(last){for(const r of last.results)row(table,resultValues(r));$('searchStatus').textContent=`${last.complete?t('complete'):t('incomplete')} · ${t('countFmt')(last.results.length)}`;}}
function translate(){document.documentElement.lang=lang;document.title=t('title');for(const el of document.querySelectorAll('[data-t]'))el.textContent=t(el.dataset.t);$('langJa').setAttribute('aria-pressed',String(lang==='ja'));$('langEn').setAttribute('aria-pressed',String(lang==='en'));for(const input of document.querySelectorAll('.range input'))input.setAttribute('aria-label',`${input.dataset.element} ${t(input.dataset.bound==='min'?'minimum':'maximum')}`);tableHead($('constants'),[t('element'),t('isotope'),t('mass')]);renderResults();}
for(const id of ['calcIon','searchIon']){for(const key of Object.keys(IONS))$(id).add(new Option(key,key));$(id).value='[M+H]+';}
for(const [e,v]of Object.entries(ELEMENTS)){
 const div=document.createElement('div');div.className='range';const b=document.createElement('b');b.textContent=e;div.append(b);
 for(const bound of ['min','max']){const input=document.createElement('input');input.type='number';input.min=0;input.max=1000;input.step=1;input.required=true;input.value=bound==='min'?0:({C:30,H:60,O:20}[e]||0);input.dataset.element=e;input.dataset.bound=bound;div.append(input);if(bound==='min'){const span=document.createElement('span');span.textContent='–';div.append(span);}}
 const common=['C','H','N','O','F','P','S','Cl','Br','I','B','Si','Na','K'];
 $(common.includes(e)?'ranges':'extraRanges').append(div);row($('constants'),[e,`${v.isotope}${e}`,v.mass]);
}
{const order=['C','H','N','O','S','P','F','Cl','Br','I','B','Si','Na','K'];const box=$('ranges');[...box.children].sort((x,y)=>order.indexOf(x.querySelector('b').textContent)-order.indexOf(y.querySelector('b').textContent)).forEach(el=>box.append(el));}
function errorText(code){return t({formula:'errorFormula',composition:'errorComposition',range:'errorRange',search:'errorSearch'}[code]||'errorGeneric');}
function cancel(){if(worker){worker.terminate();worker=null;}$('cancel').disabled=true;$('searchButton').disabled=false;}
function clearSearch(){cancel();last=null;$('searchStatus').textContent='';$('copyStatus').textContent='';$('copy').disabled=true;renderResults();}
$('calcForm').oninput=()=>{$('calcResult').replaceChildren();};
$('searchForm').oninput=event=>{clearSearch();if(event.target.closest('#extraRanges'))$('extraElements').open=true;};
function syncLangLinks(){for(const a of document.querySelectorAll('a[href]')){const h=a.getAttribute('href');if(!h||/^[a-z][a-z0-9+.-]*:/i.test(h)||h.startsWith('#'))continue;const [pq,frag]=h.split('#');const [path,q]=pq.split('?');if(!/\.html$/.test(path))continue;const ps=new URLSearchParams(q||'');ps.set('lang',lang);a.setAttribute('href',`${path}?${ps}${frag?'#'+frag:''}`);}}
function setLanguage(value){cancel();lang=value;try{localStorage.setItem('ym-language',value);}catch(e){}try{const u=new URL(location.href);u.searchParams.set('lang',value);history.replaceState(null,'',u);}catch(e){}syncLangLinks();$('calcResult').replaceChildren();$('searchStatus').textContent='';translate();}
$('langJa').onclick=()=>setLanguage('ja');$('langEn').onclick=()=>setLanguage('en');
$('calcForm').onsubmit=event=>{event.preventDefault();const out=$('calcResult');out.replaceChildren();out.className='';try{
 const r=ion(parseFormula($('formula').value),$('calcIon').value);const p=document.createElement('p');p.textContent=`${r.formula} · ${t('neutral')}: ${r.neutral.toFixed(6)} Da`;out.append(p);
 const p2=document.createElement('p');p2.textContent=`${$('calcIon').value} · ${t('ionFormula')}: ${r.ionFormula} (z = ${r.z}) · ${t('mz')}: `;const strong=document.createElement('strong');strong.textContent=r.mz.toFixed(6);p2.append(strong);out.append(p2);
 if($('calcFound').value!==''){const f=Number($('calcFound').value);if(!Number.isFinite(f)||f<=0)throw Error('search');const p3=document.createElement('p');p3.textContent=`Δ ${ppm(f,r.mz).toFixed(3)} ppm / ${((f-r.mz)*1000).toFixed(3)} mDa`;out.append(p3);}
 }catch(e){out.textContent=errorText(e.message);out.className='error';}};
function checkRanges(){for(const input of document.querySelectorAll('.range input'))input.removeAttribute('aria-invalid');
 for(const div of document.querySelectorAll('.range')){const [a,b]=div.querySelectorAll('input');for(const input of [a,b]){const v=input.value.trim();let why=null;
  if(v==='')why='rangeEmpty';else if(!/^-?\d+$/.test(v))why='rangeInt';else if(Number(v)<0||Number(v)>1000)why='rangeBounds';
  if(!why&&input===b&&Number(a.value)>Number(b.value))why='rangeOrder';
  if(why){const bound=t(input.dataset.bound==='min'?'minimum':'maximum');const label=lang==='ja'?`${input.dataset.element}（${bound}）：`:`${input.dataset.element} (${bound}): `;return {input,text:label+t(why)};}}}
 if(![...document.querySelectorAll('.range input')].some(i=>i.dataset.bound==='max'&&Number(i.value)>0))return {input:document.querySelector('.range input[data-bound=max]'),text:t('rangeNone')};
 return null;}
$('searchForm').onsubmit=event=>{event.preventDefault();clearSearch();
 const bad=checkRanges();if(bad){if(bad.input.closest('details'))bad.input.closest('details').open=true;bad.input.setAttribute('aria-invalid','true');bad.input.focus();$('searchStatus').textContent=bad.text;return;}
 try{
 const ranges=[...document.querySelectorAll('.range')].map(div=>{const inputs=div.querySelectorAll('input');return [inputs[0].dataset.element,Number(inputs[0].value),Number(inputs[1].value)];});
 worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});$('cancel').disabled=false;$('searchButton').disabled=true;$('searchStatus').textContent=t('running');
 worker.onmessage=({data})=>{cancel();if(data.error){$('searchStatus').textContent=errorText(data.error);return;}last=data;renderResults();$('copy').disabled=!data.results.length;};
 worker.onerror=()=>{cancel();$('searchStatus').textContent=t('errorGeneric');};
 worker.postMessage({found:Number($('found').value),tolerance:Number($('tolerance').value),unit:$('unit').value,adduct:$('searchIon').value,ranges});
 }catch(e){cancel();$('searchStatus').textContent=errorText(e.message);}};
$('cancel').onclick=()=>{cancel();$('searchStatus').textContent=t('stopped');};
$('copy').onclick=async()=>{if(!last)return;const context=`${t('found')}: ${$('found').value}\t${$('searchIon').value}\t±${$('tolerance').value} ${$('unit').value}\t${last.complete?t('complete'):t('incomplete')}`;try{await navigator.clipboard.writeText([context,headers().join('\t'),...last.results.map(r=>resultValues(r).join('\t'))].join('\n'));$('copyStatus').textContent=t('copyOk');}catch{$('copyStatus').textContent=t('copyFail');}};
translate();syncLangLinks();
