import {ELEMENTS,IONS,parseFormula,ion,ionCounts,ppm,dbe,isotopePattern} from './core.js?v=20261111-2';
import {ionLabel,formulaHtml,siFormula,siSentence,checkText,parseBatch,readFound} from './si.js?v=20261111-2';
import {strings,rich} from './text.js?v=20261111-2';
const $=id=>document.getElementById(id);
const EXAMPLES={
 batch:'Glucose\tC6H12O6\t[M+Na]+\t203.0524\nCatechin\tC15H14O6\t[M-H]-\t289.0716\nPunicalagin\tC48H28O30\t[M-2H]2-\t541.0263\nCaffeine C8H10N4O2 [M+H]+ 195.0877',
 check:'HRMS (ESI) m/z: [M + Na]+ Calcd for C6H12O6Na 203.0526; Found 203.0524.\nHRMS (ESI) m/z: [M + H]+ Calcd for C8H11N4O2 195.0882; Found 195.0877.\nHRESIMS m/z 289.0716 [M − H]− (calcd for C15H13O6, 289.0718).\nHRMS (ESI) m/z: [M + Na]+ Calcd for C15H14O6 313.0683; Found 313.0679.'
};
// The language is that of the page: hrms-calc/ (Japanese) or hrms-calc/en/ (English, made by _dev/build_hrms_en.mjs).
// ?lang= of earlier links opens the other page; the inputs after "#" go along.
const pageLang=document.documentElement.lang==='en'?'en':'ja';
function otherPage(l){const u=new URL(l==='en'?'en/':'../',location.href);const q=new URLSearchParams(location.search);q.delete('lang');u.search=q.toString();u.hash=location.hash;return u.href;}
function initialLang(){const q=new URLSearchParams(location.search).get('lang');if((q==='ja'||q==='en')&&q!==pageLang)location.replace(otherPage(q));try{localStorage.setItem('ym-language',pageLang);}catch(e){}return pageLang;}
let lang=initialLang(),worker=null,last=null,calcState=null,batchRows=null,checkRecords=null;
const t=k=>strings[lang][k];
const el=(tag,props={},...kids)=>{const e=document.createElement(tag);Object.assign(e,props);e.append(...kids);return e;};
const html=(tag,markup,cls)=>{const e=document.createElement(tag);e.innerHTML=markup;if(cls)e.className=cls;return e;};
const signed=(x,d)=>(x>0?'+':x<0?'−':'')+Math.abs(x).toFixed(d);
const say=(node,text)=>{node.innerHTML=rich(text);};
const H=h=>({h});
// plain text for <option>: Unicode sub- and superscripts, e.g. [M + NH₄]⁺
const SUBS='₀₁₂₃₄₅₆₇₈₉',SUPS='⁰¹²³⁴⁵⁶⁷⁸⁹';
function ionOption(key){const m=/^(\[.*\])(\d*)([+−])$/.exec(ionLabel(key).text);
 return m[1].replace(/([A-Za-z])(\d+)/g,(x,a,d)=>a+[...d].map(c=>SUBS[c]).join(''))+[...m[2]].map(c=>SUPS[c]).join('')+(m[3]==='+'?'⁺':'⁻');}
function tableHead(table,labels){const tr=el('tr');for(const s of labels)tr.append(html('th',s==='z'?'<i>z</i>':rich(s,false)));table.querySelector('thead').replaceChildren(tr);}
function row(table,values){const tr=el('tr');for(const s of values){const td=el('td');if(s&&s.h!==undefined)td.innerHTML=s.h;else td.textContent=s;tr.append(td);}table.querySelector('tbody').append(tr);return tr;}
async function copyRich(text,markup,status){
 try{
  if(markup&&window.ClipboardItem&&navigator.clipboard.write)await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([text],{type:'text/plain'}),'text/html':new Blob([markup],{type:'text/html'})})]);
  else await navigator.clipboard.writeText(text);
  status.textContent=t('copyOk');
 }catch{try{await navigator.clipboard.writeText(text);status.textContent=t('copyOk');}catch{status.textContent=t('copyFail');}}
}
function errorText(code){return t({formula:'errorFormula',composition:'errorComposition',range:'errorRange',search:'errorSearch',found:'errorFound',lines:'errorLines'}[code]||'errorGeneric');}

// ---------- ion selects ----------
const POS=Object.keys(IONS).filter(k=>IONS[k][1]>0),NEG=Object.keys(IONS).filter(k=>IONS[k][1]<0);
for(const id of ['calcIon','searchIon','batchIon']){
 for(const [lab,keys] of [['posIons',POS],['negIons',NEG]]){const g=el('optgroup');g.dataset.t=lab;for(const k of keys)g.append(new Option(ionOption(k),k));$(id).append(g);}
 $(id).value='[M+H]+';
}
// ion picker: a button shows the current ion; it opens a table of all ion types (positive / negative;
// rows = atoms added or removed, columns = M, 2M, doubly charged). The hidden <select> keeps the value.
const ION_GRID={
 posIons:[['+H',['[M+H]+','[2M+H]+','[M+2H]2+']],['+Na',['[M+Na]+','[2M+Na]+',null]],['+K',['[M+K]+',null,null]],['+NH4',['[M+NH4]+',null,null]],
  ['+Li',['[M+Li]+',null,null]],['+H −H2O',['[M+H-H2O]+',null,null]],[null,['[M]+','[2M]+',null]]],
 negIons:[['−H',['[M-H]-','[2M-H]-','[M-2H]2-']],['+HCOO',['[M+HCOO]-',null,null]],['+CH3COO',['[M+CH3COO]-',null,null]],['+Cl',['[M+Cl]-',null,null]],
  [null,['[M]-','[2M]-',null]]]
};
const pickers=[];
function syncPickers(){for(const pk of pickers)pk.sync();}
function makePicker(id){
 const sel=$(id),wrap=el('div',{className:'ion-picker',id:id+'-picker'});
 const btn=el('button',{type:'button',className:'ion-current'}),cur=el('span',{id:id+'-current'}),panel=el('div',{className:'ion-panel',id:id+'-panel',hidden:true});
 btn.setAttribute('aria-haspopup','true');btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls',panel.id);btn.setAttribute('aria-labelledby',`${id}-label ${id}-current`);btn.append(cur);
 for(const [cap,rows] of Object.entries(ION_GRID)){
  const table=el('table'),caption=el('caption'),head=el('tr',{},el('td')),body=el('tbody');caption.dataset.t=cap;
  for(const k of ['ionColM','ionCol2M','ionColZ2']){const th=el('th',{scope:'col'});th.dataset.t=k;head.append(th);}
  for(const [lab,keys] of rows){
   const tr=el('tr'),th=el('th',{scope:'row'});if(lab)th.innerHTML=rich(lab);else th.dataset.t='ionNone';tr.append(th);
   for(const k of keys){const td=el('td');if(k){const b=el('button',{type:'button',textContent:ionOption(k)});b.dataset.ion=k;b.onclick=()=>choose(k);td.append(b);}tr.append(td);}
   body.append(tr);
  }
  table.append(caption,el('thead',{},head),body);panel.append(table);
 }
 wrap.append(btn,panel);sel.after(wrap);
 function open(){panel.hidden=false;btn.setAttribute('aria-expanded','true');panel.style.left='0px';
  const over=panel.getBoundingClientRect().right-(document.documentElement.clientWidth-12);if(over>0)panel.style.left=`${-over}px`;
  (panel.querySelector('button[aria-pressed=true]')||panel.querySelector('td button')).focus();}
 function close(focus){if(panel.hidden)return;panel.hidden=true;btn.setAttribute('aria-expanded','false');if(focus)btn.focus();}
 function sync(){cur.textContent=ionOption(sel.value);for(const b of panel.querySelectorAll('td button'))b.setAttribute('aria-pressed',String(b.dataset.ion===sel.value));}
 function choose(k){sel.value=k;sync();close(true);sel.dispatchEvent(new Event('input',{bubbles:true}));sel.dispatchEvent(new Event('change',{bubbles:true}));}
 btn.onclick=()=>panel.hidden?open():close(false);
 wrap.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();close(true);}});
 document.addEventListener('click',e=>{if(!wrap.contains(e.target))close(false);});
 document.addEventListener('focusin',e=>{if(!wrap.contains(e.target))close(false);});
 sync();pickers.push({sync,close});
}
for(const id of ['calcIon','searchIon','batchIon'])makePicker(id);

// ---------- tabs ----------
const tabs=[...document.querySelectorAll('[role=tab]')];
// inputs of each tab, kept in the address when moving between tabs
const tabInputs={};
function selectTab(tab,focus,updateHash=true){
 for(const x of tabs){const on=x===tab;x.setAttribute('aria-selected',String(on));x.tabIndex=on?0:-1;$(x.getAttribute('aria-controls')).hidden=!on;}
  if(focus)tab.focus();
 for(const p of document.querySelectorAll('#method [data-tabs]'))p.hidden=!p.dataset.tabs.split(' ').includes(tab.getAttribute('aria-controls'));
 if(updateHash)setUrl(tabInputs[tab.getAttribute('aria-controls')],tab.getAttribute('aria-controls'));
}
tabs.forEach((tab,i)=>{
 tab.onclick=()=>selectTab(tab);
 tab.onkeydown=e=>{const k={ArrowRight:i+1,ArrowLeft:i-1,Home:0,End:tabs.length-1}[e.key];if(k===undefined)return;e.preventDefault();selectTab(tabs[(k+tabs.length)%tabs.length],true);};
});
function tabFromHash(){const h=location.hash.slice(1).split('?')[0];return tabs.find(x=>x.getAttribute('aria-controls')===h);}
selectTab(tabFromHash()||tabs[0],false,false);
// keep the address bar as it was opened when the hash is not a tab (e.g. #method)
window.addEventListener('hashchange',()=>{const tab=tabFromHash();if(tab)selectTab(tab,false,false);});

// ---------- decimal places of calculated m/z (calculator, finder, batch) ----------
let digits=4;
for(const s of document.querySelectorAll('[data-digits]'))for(const d of [4,5,6,7,8])s.append(el('option',{value:String(d),textContent:String(d),selected:d===4}));
function setDigits(d){digits=d;for(const s of document.querySelectorAll('[data-digits]'))s.value=String(d);if(calcState&&!calcState.error)renderCalc();renderResults();if(batchRows)renderBatch();}

// ---------- statement settings (shared by the calculator and the batch) ----------
const si={append:true};
for(const c of document.querySelectorAll('[data-si]')){
 c.addEventListener(c.type==='checkbox'?'change':'input',()=>{
  si[c.dataset.si]=c.type==='checkbox'?c.checked:c.value;
  for(const d of document.querySelectorAll(`[data-si=${c.dataset.si}]`))if(d!==c){if(d.type==='checkbox')d.checked=c.checked;else d.value=c.value;}
  renderSi();$('siCopyStatus').textContent='';$('batchCopyStatus').textContent='';
 });
}
function sentence(counts,key,mz,found){return siSentence({key,ionFormula:siFormula(counts,key,si.append),calcd:mz,found});}

// ---------- calculator ----------
function calculate(showErrors){
 const fRaw=$('formula').value.trim();
 if(!fRaw){calcState=null;renderCalc();clearCalcUrl();return;}
 try{
  const counts=parseFormula(fRaw),key=$('calcIon').value,r=ion(counts,key),found=readFound($('calcFound').value);
  calcState={counts,key,r,found,pattern:isotopePattern(ionCounts(counts,key),r.z)};
  setUrl({f:fRaw,ion:key,found},'calculator');
 }catch(e){calcState=showErrors?{error:e.message}:null;}
 renderCalc();
}
function renderCalc(){
 const box=$('calcResult'),main=$('calcMain');
 box.classList.toggle('error',!!(calcState&&calcState.error));
 $('calcPlaceholder').hidden=!!calcState;$('calcSi').hidden=$('calcIso').hidden=!(calcState&&!calcState.error);
 main.replaceChildren();$('siCopyStatus').textContent='';$('calcLinkStatus').textContent='';
 $('calcLinkRow').hidden=!(calcState&&!calcState.error);
 if(!calcState)return;
 if(calcState.error){main.append(html('p',rich(errorText(calcState.error)),'error'));return;}
 const {counts,key,r,found}=calcState;
 main.append(html('p',`${ionLabel(key).html} <span class="sep">·</span> ${t('ionFormula')} ${formulaHtml(r.ionFormula)}${r.z>0?'<sup>'+(r.z>1?r.z:'')+'+</sup>':'<sup>'+(r.z<-1?-r.z:'')+'−</sup>'}`,'result-ion'));
 main.append(html('p',`<span>${rich(t('mz'),false)}</span> <strong>${r.mz.toFixed(digits)}</strong>`,'result-mz'));
 const facts=el('dl',{className:'result-facts'});
 const fact=(k,v)=>facts.append(el('div',{},html('dt',rich(k,false)),html('dd',v)));
 fact(t('neutral'),`${formulaHtml(r.formula)} · ${r.neutral.toFixed(digits)} Da`);
 const d=dbe(counts);fact('DBE',d===null?'—':String(d));
 if(found){const f=Number(found);fact(t('measured'),`${found}（${t('diff')} ${signed(ppm(f,r.mz),2)} ppm, ${signed((f-r.mz)*1000,3)} mDa）`.replace(/[（）]/g,c=>lang==='ja'?c:c==='（'?' (':')'));}
 main.append(facts);
 renderSi();renderIso();
}
function renderSi(){
 if(calcState&&!calcState.error){
  const {counts,key,r,found}=calcState,s=sentence(counts,key,r.mz,found),p=$('siText');
  p.replaceChildren();$('siCopy').disabled=!s;
  if(s)p.innerHTML=s.html;
  const need=found?'':t('siNeedFound');
  if(need)p.append(el('span',{className:'hint need',textContent:(s?' ':'')+need}));
 }
 if(batchRows)renderBatchSiState();
}
function renderIso(){
 const peaks=calcState.pattern,table=$('isoTable');
 tableHead(table,[t('peak'),'m/z',t('relative')]);table.querySelector('tbody').replaceChildren();
 const name=s=>s===0?'M':`M${s>0?'+':'−'}${Math.abs(s)}`;
 for(const p of peaks)row(table,[name(p.shift),p.mz.toFixed(4),p.relative>=10?p.relative.toFixed(1):p.relative.toFixed(2)]);
 // bar chart
 const w=46,h=120,pad=18,W=Math.max(peaks.length*w,200);
 let svg=`<svg viewBox="0 0 ${W} ${h+34}" width="${W}" height="${h+34}" role="img"><line x1="0" y1="${h+pad}" x2="${W}" y2="${h+pad}" class="axis"/>`;
 peaks.forEach((p,i)=>{const bh=Math.max(p.relative/100*h,1),x=i*w+w/2;
  svg+=`<rect x="${x-9}" y="${h+pad-bh}" width="18" height="${bh}" class="bar${p.shift===0?' mono':''}"/>`+
   `<text x="${x}" y="${h+pad-bh-4}" class="val">${p.relative>=10?p.relative.toFixed(0):p.relative.toFixed(1)}</text>`+
   `<text x="${x}" y="${h+pad+14}" class="lab">${name(p.shift)}</text>`;});
 $('isoChart').innerHTML=svg+'</svg>';
}
$('calcForm').addEventListener('input',()=>calculate(false));
$('calcForm').addEventListener('change',()=>calculate(true));
$('calcForm').onsubmit=e=>{e.preventDefault();calculate(true);if(!$('formula').value.trim())$('formula').focus();};
$('siCopy').onclick=()=>{if(!calcState||calcState.error)return;const {counts,key,r,found}=calcState,s=sentence(counts,key,r.mz,found);if(s)copyRich(s.text,s.html,$('siCopyStatus'));};

// ---------- formula finder ----------
function headers(){return [t('formula'),t('ionFormula'),'z',t('mz'),'Δ ppm','Δ mDa','DBE'];}
function resultValues(r){return [r.formula,r.ionFormula,r.z,r.mz.toFixed(digits),r.ppm.toFixed(3),r.mDa.toFixed(3),r.dbe??'—'];}
function renderResults(){const table=$('results');tableHead(table,headers());table.querySelector('tbody').replaceChildren();if(last){for(const r of last.results){const v=resultValues(r);v[0]=H(formulaHtml(r.formula));v[1]=H(formulaHtml(r.ionFormula));row(table,v);}$('searchStatus').textContent=`${last.complete?t('complete'):t('incomplete')} · ${t('countFmt')(last.results.length)}`+(last.excluded?` · ${t('excludedFmt')(last.excluded)}`:'');}}
for(const [e,v]of Object.entries(ELEMENTS)){
 const div=el('div',{className:'range'},el('b',{textContent:e}));
 for(const bound of ['min','max']){const input=el('input',{type:'number',min:0,max:1000,step:1,required:true,value:bound==='min'?0:({C:30,H:60,O:20}[e]||0)});input.dataset.element=e;input.dataset.bound=bound;div.append(input);if(bound==='min')div.append(el('span',{textContent:'–'}));}
 const common=['C','H','N','O','F','P','S','Cl','Br','I','B','Si','Na','K'];
 $(common.includes(e)?'ranges':'extraRanges').append(div);row($('constants'),[e,H(`<sup>${v.isotope}</sup>${e}`),v.mass]);
}
{const order=['C','H','N','O','S','P','F','Cl','Br','I','B','Si','Na','K'];const box=$('ranges');[...box.children].sort((x,y)=>order.indexOf(x.querySelector('b').textContent)-order.indexOf(y.querySelector('b').textContent)).forEach(n=>box.append(n));}
function cancel(){if(worker){worker.terminate();worker=null;}$('cancel').disabled=true;$('searchButton').disabled=false;}
function clearSearch(){cancel();last=null;$('searchStatus').textContent='';$('copyStatus').textContent='';$('copy').disabled=$('searchLink').disabled=true;renderResults();}
$('searchForm').oninput=event=>{if(event.target.matches('[data-digits]'))return;clearSearch();if(event.target.closest('#extraRanges'))$('extraElements').open=true;};
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
  worker=new Worker(new URL('./worker.js?v=20261111-2',import.meta.url),{type:'module'});$('cancel').disabled=false;$('searchButton').disabled=true;$('searchStatus').textContent=t('running');
  worker.onmessage=({data})=>{cancel();if(data.error){say($('searchStatus'),errorText(data.error));return;}last=data;renderResults();$('copy').disabled=!data.results.length;$('searchLink').disabled=false;};
  worker.onerror=()=>{cancel();$('searchStatus').textContent=t('errorGeneric');};
  worker.postMessage({found:Number($('found').value),tolerance:Number($('tolerance').value),unit:$('unit').value,adduct:$('searchIon').value,ranges,filters:{dbe:$('filterDbe').checked,ratio:$('filterRatio').checked}});
  setUrl(finderParams(),'finder');
 }catch(e){cancel();say($('searchStatus'),errorText(e.message));}};
$('cancel').onclick=()=>{cancel();$('searchStatus').textContent=t('stopped');};
$('copy').onclick=async()=>{if(!last)return;const fl=[$('filterDbe').checked&&'DBE',$('filterRatio').checked&&(lang==='ja'?'元素比':'element ratios')].filter(Boolean).join(', ');const context=`${t('found')}: ${$('found').value}\t${$('searchIon').value}\t±${$('tolerance').value} ${$('unit').value}\t${last.complete?t('complete'):t('incomplete')}`+(fl?`\t${lang==='ja'?'絞り込み':'Filters'}: ${fl}`:'')+(last.excluded?`\t${t('excludedFmt')(last.excluded)}`:'');try{await navigator.clipboard.writeText([context,headers().join('\t'),...last.results.map(r=>resultValues(r).join('\t'))].join('\n'));$('copyStatus').textContent=t('copyOk');}catch{$('copyStatus').textContent=t('copyFail');}};

// ---------- batch ----------
function batchHeaders(){return [t('line'),t('label'),t('formula'),t('ion'),t('ionFormula'),t('mz'),t('measured'),'Δ ppm','DBE',t('note')];}
function batchValues(b){
 if(b.error)return [b.line,b.label,b.formula,b.error==='formula'?'':b.key,'','','','','',b.message];
 return [b.line,b.label,b.r.formula,b.key,b.r.ionFormula,b.r.mz.toFixed(digits),b.found,b.found?ppm(Number(b.found),b.r.mz).toFixed(2):'',b.dbe??'—',''];
}
function runBatch(){
 $('batchCopyStatus').textContent='';
 let rows;try{rows=parseBatch($('batchInput').value,$('batchIon').value);}catch(e){batchRows=null;renderBatch();say($('batchStatus'),errorText(e.message));return;}
 batchRows=rows.map(b=>{
  if(b.error)return {...b,code:b.error};
  try{const r=ion(b.counts,b.key);return {...b,r,dbe:dbe(b.counts)};}catch(e){return {...b,error:e.message,code:e.message};}
 });
 renderBatch();
}
function renderBatch(){
 const table=$('batchResults');tableHead(table,batchHeaders());table.querySelector('tbody').replaceChildren();
 $('batchSi').hidden=$('batchTableActions').hidden=!(batchRows&&batchRows.some(b=>!b.error));$('batchTableStatus').textContent='';
 if(!batchRows){$('batchStatus').textContent='';return;}
 if(!batchRows.length){$('batchStatus').textContent=t('batchEmpty');return;}
 for(const b of batchRows){
  if(b.error)b.message=b.code==='token'?t('errToken')(b.bad):b.code==='ion'?t('errIon')(b.bad):b.code==='ionConflict'?t('errIonConflict')(b.bad):errorText(b.code);
  const v=batchValues(b);if(b.formula&&(!b.error||b.counts))v[2]=H(formulaHtml(b.error?b.formula:b.r.formula));if(v[3])v[3]=H(ionLabel(v[3]).html);if(v[4])v[4]=H(formulaHtml(v[4]));
  const tr=row(table,v);if(b.error)tr.className='row-error';
 }
 const bad=batchRows.filter(b=>b.error).length;
 $('batchStatus').textContent=t('batchCount')(batchRows.length-bad,bad);
 renderBatchSiState();
}
function renderBatchSiState(){
 $('batchCopySi').disabled=!(batchRows||[]).some(b=>!b.error);
}
$('batchForm').onsubmit=e=>{e.preventDefault();runBatch();};
$('batchInput').addEventListener('input',()=>{if(batchRows){batchRows=null;renderBatch();}});
$('batchIon').addEventListener('change',()=>{if(batchRows)runBatch();});
$('batchExample').onclick=()=>{$('batchInput').value=EXAMPLES.batch;runBatch();};
$('batchCopyTsv').onclick=()=>{if(!batchRows)return;copyRich([batchHeaders().join('\t'),...batchRows.map(b=>batchValues(b).join('\t'))].join('\n'),null,$('batchTableStatus'));};
$('batchCopySi').onclick=()=>{
 if(!batchRows)return;const text=[],marks=[];
 for(const b of batchRows){if(b.error)continue;const s=sentence(b.counts,b.key,b.r.mz,b.found);if(!s)continue;
  const lab=b.label?`${b.label}: `:'';text.push(lab+s.text);marks.push(`<p>${lab.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}${s.html}</p>`);}
 copyRich(text.join('\n'),marks.join(''),$('batchCopyStatus'));
};

// ---------- checker ----------
const CODE_TEXT={ok:'cOk',rounding:'cRounding',electron:'cElectron',electronSign:'cElectronSign',neutralFormula:'cNeutralFormula',neutralFormulaElectron:'cNeutralFormulaElectron',mismatch:'cMismatch',chargeAssumed:'cChargeAssumed',chargeConflict:'cChargeConflict',noFormula:'cNoFormula',noValue:'cNoValue',fewDigits:'cFewDigits',formula:'cFormula'};
const STATUS_TEXT={ok:'stOk',warn:'stWarn',error:'stError',unparsed:'stUnparsed'};
function tolValue(){const v=Number($('checkTol').value);return Number.isFinite(v)&&v>=0?v:5;}
const unitValue=()=>$('checkUnit').value==='mDa'?'mDa':'ppm';
function codeText(c){return c==='foundOff'?t('cFoundOff')(tolValue(),unitValue()):t(CODE_TEXT[c]);}
function runCheck(){checkRecords=checkText($('checkInput').value,{tolerance:tolValue(),toleranceUnit:unitValue()});renderCheck();}
function renderCheck(){
 const list=$('checkResults');list.replaceChildren();$('checkCopyStatus').textContent='';
 $('checkActions').hidden=!(checkRecords&&checkRecords.length);
 if(!checkRecords){$('checkSummary').textContent='';return;}
 if(!checkRecords.length){say($('checkSummary'),t('checkNone'));return;}
 const n=s=>checkRecords.filter(r=>r.status===s).length;
 $('checkSummary').textContent=t('checkSummary')(checkRecords.length,n('ok'),n('warn'),n('error'),n('unparsed'));
 for(const r of checkRecords){
  const li=el('li',{className:`check-item ${r.status}`});
  li.append(el('p',{className:'check-head'},el('span',{className:`badge ${r.status}`,textContent:t(STATUS_TEXT[r.status])}),' ',html('span',rich(r.codes.map(codeText).filter(Boolean).join(' ')))));
  li.append(html('p',rich(r.snippet),'check-snippet'));
  if(r.recalculated!==null){
   const parts=[`${t('stated')} ${r.stated}`,`${t('recalc')} ${r.recalculated.toFixed(4)} (${signed(r.diffMDa,2)} mDa)`];
   if(r.found!==null)parts.push(`${t('measured')} ${r.found} (${signed(r.ppm,2)} ppm, ${signed(r.foundMDa,2)} mDa)`);
   li.append(html('p',rich(parts.join(' · ')),'check-values'));
  }
  list.append(li);
 }
}
$('checkForm').onsubmit=e=>{e.preventDefault();runCheck();};
$('checkInput').addEventListener('input',()=>{if(checkRecords){checkRecords=null;renderCheck();}});
$('checkTol').addEventListener('input',()=>{if(checkRecords)runCheck();});
$('checkUnit').addEventListener('change',()=>{if(checkRecords)runCheck();});
$('checkExample').onclick=()=>{$('checkInput').value=EXAMPLES.check;runCheck();};
$('checkCopy').onclick=()=>{
 if(!checkRecords)return;
 const lines=[[ '#','status','message','ion','formula','z',t('stated'),t('recalc'),'Δ mDa',t('measured'),'Δ ppm','text'].join('\t')];
 checkRecords.forEach((r,i)=>lines.push([i+1,t(STATUS_TEXT[r.status]),r.codes.map(codeText).filter(Boolean).join(' '),r.ion,r.formula,r.z??'',r.stated,r.recalculated?.toFixed(4)??'',r.diffMDa?.toFixed(2)??'',r.found??'',r.ppm?.toFixed(2)??'',r.snippet].join('\t')));
 copyRich(lines.join('\n'),null,$('checkCopyStatus'));
};

// ---------- language ----------
function translate(){
 document.documentElement.lang=lang;if(t('title'))document.title=t('title');
 // description, page title and locale for sharing follow the language
 const meta=(sel,v)=>{const m=document.querySelector(sel);if(m)m.content=v;};
 meta('meta[name=description]',t('metaDescription'));meta('meta[property="og:description"]',t('metaDescription'));meta('meta[property="og:title"]',t('title'));meta('meta[property="og:locale"]',lang==='en'?'en_US':'ja_JP');
 for(const n of document.querySelectorAll('[data-t]')){if(t(n.dataset.t)===undefined)continue; // a missing string keeps the text written in the HTML
  if(n.tagName==='OPTGROUP')n.label=t(n.dataset.t);else if(n.tagName==='OPTION')n.textContent=t(n.dataset.t);else n.innerHTML=rich(t(n.dataset.t),false);}
 $('langJa').setAttribute('aria-pressed',String(lang==='ja'));$('langEn').setAttribute('aria-pressed',String(lang==='en'));
 $('tabs').setAttribute('aria-label',lang==='ja'?'機能':'Tools');
 for(const input of document.querySelectorAll('.range input'))input.setAttribute('aria-label',`${input.dataset.element} ${t(input.dataset.bound==='min'?'minimum':'maximum')}`);
 tableHead($('constants'),[t('element'),t('isotope'),t('mass')]);
 $('batchInput').placeholder=lang==='ja'?'例）Glucose\tC6H12O6\t[M+Na]+\t203.0524':'e.g. Glucose\tC6H12O6\t[M+Na]+\t203.0524';
 $('checkInput').placeholder='HRMS (ESI) m/z: [M + Na]+ Calcd for C6H12O6Na 203.0526; Found 203.0524.';
 renderResults();renderCalc();renderBatch();renderCheck();
}
function setLanguage(value){if(value===lang)return;try{localStorage.setItem('ym-language',value);}catch(e){}location.href=otherPage(value);}
$('langJa').onclick=()=>setLanguage('ja');$('langEn').onclick=()=>setLanguage('en');
translate();

// ---------- saved settings (this browser only) and inputs kept in the address ----------
const STORE='hrms-calc-settings',DEFAULT_MAX={C:30,H:60,O:20};
const isIon=k=>typeof k==='string'&&Object.hasOwn(IONS,k);
const validTol=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<1e6;
const validRange=v=>Array.isArray(v)&&v.length===2&&v.every(n=>Number.isInteger(n)&&n>=0&&n<=1000)&&v[0]<=v[1];
function loadSettings(){try{const v=JSON.parse(localStorage.getItem(STORE)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch(e){return {};}}
let settings=loadSettings();
function saveSettings(){try{localStorage.setItem(STORE,JSON.stringify(settings));}catch(e){}}
function rangeInputs(){return [...document.querySelectorAll('.range')].map(div=>div.querySelectorAll('input'));}
function readRanges(){const o={};for(const [a,b] of rangeInputs())o[a.dataset.element]=[Number(a.value),Number(b.value)];return o;}
function writeRanges(o){for(const [a,b] of rangeInputs()){const v=o[a.dataset.element];[a.value,b.value]=validRange(v)?v:[0,0];}
 if([...document.querySelectorAll('#extraRanges input[data-bound=max]')].some(i=>Number(i.value)>0))$('extraElements').open=true;}
function defaultRanges(){const o={};for(const e of Object.keys(ELEMENTS))o[e]=[0,DEFAULT_MAX[e]||0];return o;}
function finderSettings(){return {ion:$('searchIon').value,tol:Number($('tolerance').value),unit:$('unit').value,ranges:readRanges(),dbe:$('filterDbe').checked,ratio:$('filterRatio').checked};}
function applyFinder(f){
 if(isIon(f.ion))$('searchIon').value=f.ion;if(validTol(f.tol))$('tolerance').value=String(f.tol);if(['ppm','mDa'].includes(f.unit))$('unit').value=f.unit;
 if(f.ranges&&typeof f.ranges==='object')writeRanges(f.ranges);$('filterDbe').checked=f.dbe===true;$('filterRatio').checked=f.ratio===true;syncPickers();
}
if(isIon(settings.calcIon))$('calcIon').value=settings.calcIon;
if(isIon(settings.batchIon))$('batchIon').value=settings.batchIon;
if(settings.finder&&typeof settings.finder==='object')applyFinder(settings.finder);
if([4,5,6,7,8].includes(settings.digits))setDigits(settings.digits);
for(const s of document.querySelectorAll('[data-digits]'))s.addEventListener('change',()=>{setDigits(Number(s.value));settings.digits=digits;saveSettings();});
if(validTol(settings.checkTol))$('checkTol').value=String(settings.checkTol);
if(['ppm','mDa'].includes(settings.checkUnit))$('checkUnit').value=settings.checkUnit;
if(typeof settings.siAppend==='boolean'){si.append=settings.siAppend;for(const c of document.querySelectorAll('[data-si=append]'))c.checked=si.append;}
$('calcIon').addEventListener('change',()=>{settings.calcIon=$('calcIon').value;saveSettings();});
$('batchIon').addEventListener('change',()=>{settings.batchIon=$('batchIon').value;saveSettings();});
$('checkTol').addEventListener('change',()=>{const v=Number($('checkTol').value);if(validTol(v)){settings.checkTol=v;saveSettings();}});
$('checkUnit').addEventListener('change',()=>{settings.checkUnit=unitValue();saveSettings();});
for(const c of document.querySelectorAll('[data-si=append]'))c.addEventListener('change',()=>{settings.siAppend=c.checked;saveSettings();});
$('searchForm').addEventListener('change',()=>{const f=finderSettings();if(validTol(f.tol)&&Object.values(f.ranges).every(validRange)){settings.finder=f;saveSettings();}});
$('resetSearch').onclick=()=>{
 applyFinder({ion:'[M+H]+',tol:5,unit:'ppm',ranges:defaultRanges(),dbe:false,ratio:false});$('extraElements').open=false;
 for(const input of document.querySelectorAll('.range input'))input.removeAttribute('aria-invalid');
 delete settings.finder;saveSettings();clearSearch();
};

// address: #calculator?f=&ion=&found= or #finder?mz=&ion=&tol=&unit=&r=C0-30,H0-60&filter=dbe,ratio
// The inputs go after "#", which browsers do not send to the server. ?f= / ?mz= (earlier links) are still read.
const URL_KEYS=['f','ion','found','mz','tol','unit','r','filter'];
const query=params=>new URLSearchParams(Object.entries(params||{}).filter(([,v])=>v!==''&&v!==undefined&&v!==null)).toString();
function hashParams(){const h=location.hash.slice(1),i=h.indexOf('?');return new URLSearchParams(i<0?'':h.slice(i+1));}
function addressWith(params,tab,keepLang=true){const u=new URL(location.href);for(const k of URL_KEYS)u.searchParams.delete(k);if(!keepLang)u.searchParams.delete('lang');
 const q=query(params);u.hash=tab+(q?'?'+q:'');return u;}
function setUrl(params,tab){tabInputs[tab]=params;try{history.replaceState(null,'',addressWith(params,tab));}catch(e){}}
function clearCalcUrl(){if(hashParams().has('f'))setUrl(null,'calculator');}
function finderParams(){
 const r=Object.entries(readRanges()).filter(([,v])=>v[1]>0).map(([e,v])=>`${e}${v[0]}-${v[1]}`).join(',');
 return {mz:$('found').value.trim(),ion:$('searchIon').value,tol:$('tolerance').value.trim(),unit:$('unit').value,r,filter:[$('filterDbe').checked&&'dbe',$('filterRatio').checked&&'ratio'].filter(Boolean).join(',')};
}
const calcParams=()=>({f:$('formula').value.trim(),ion:$('calcIon').value,found:$('calcFound').value.trim()});
$('calcLink').onclick=()=>copyRich(addressWith(calcParams(),'calculator',false).href,null,$('calcLinkStatus'));
$('searchLink').onclick=()=>copyRich(addressWith(finderParams(),'finder',false).href,null,$('copyStatus'));
{
 const h=hashParams(),old=new URLSearchParams(location.search);
 const q=h.has('mz')||h.has('f')?h:old;
 if(q.has('mz')){
  const f={ion:q.get('ion'),tol:q.has('tol')?Number(q.get('tol')):NaN,unit:q.get('unit')},fl=(q.get('filter')||'').split(',');
  if(q.has('r')){f.ranges={};for(const part of q.get('r').split(',')){const m=/^([A-Z][a-z]?)(\d{1,4})-(\d{1,4})$/.exec(part.trim());if(m&&Object.hasOwn(ELEMENTS,m[1]))f.ranges[m[1]]=[Number(m[2]),Number(m[3])];}}
  f.dbe=fl.includes('dbe');f.ratio=fl.includes('ratio');applyFinder(f);
  $('found').value=q.get('mz').slice(0,40);
  if(!tabFromHash())selectTab(tabs.find(x=>x.getAttribute('aria-controls')==='finder'),false);
  $('searchForm').requestSubmit();
 }else if(q.has('f')){
  $('formula').value=q.get('f').slice(0,500);if(isIon(q.get('ion')))$('calcIon').value=q.get('ion');$('calcFound').value=(q.get('found')||'').slice(0,40);
  calculate(true);
 }
}
syncPickers();
