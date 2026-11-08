// Sentences for papers / Supporting Information, a checker for reported HRMS values, and batch input.
import {IONS,ELECTRON_MASS,parseFormula,formula,mass,ionCounts} from './core.js?v=20261108-5';
const MINUS='−';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// '[M+Na]+' -> {text:'[M + Na]+', html:'[M + Na]<sup>+</sup>'}
export function ionLabel(key){
 const m=/^\[(.+)\](\d*)([+-])$/.exec(key);if(!m)throw Error('ion');
 const inner=m[1].split(/([+-])/).map(s=>s==='+'?' + ':s==='-'?` ${MINUS} `:s).join('');
 const charge=(m[2]||'')+(m[3]==='+'?'+':MINUS);
 return {text:`[${inner}]${charge}`,html:`[${esc(inner).replace(/([A-Za-z])(\d+)/g,'$1<sub>$2</sub>')}]<sup>${charge}</sup>`};
}
export const formulaHtml=f=>esc(f).replace(/(\d+)/g,'<sub>$1</sub>');

// formula of the ion as written in a paper; with appendMetal, Na/K/Li/Cl adducts are written last (C6H12O6Na)
export function siFormula(counts,key,appendMetal=false){
 const ionF=formula(ionCounts(counts,key));
 if(!appendMetal)return ionF;
 const [mult,,delta]=IONS[key];const keys=Object.keys(delta);
 if(!keys.length||!keys.every(e=>['Na','K','Li','Cl'].includes(e)&&delta[e]>0))return ionF;
 const m={};for(const [e,n] of Object.entries(counts))m[e]=n*mult;
 return formula(m)+keys.map(e=>e+(delta[e]===1?'':delta[e])).join('');
}

// Format of the example in the J. Org. Chem. (ACS) author guidelines:
//   HRMS m/z: [M + Na]+ Calcd for C6H12O6Na 203.0526; Found 203.0524.
// (the ionization method, which the guidelines also ask for, is left out)
export function siSentence({key,ionFormula,calcd,found=''}){
 const lab=ionLabel(key),calc=calcd.toFixed(4),f=String(found).trim();
 if(f&&!/^\d+(\.\d+)?$/.test(f))throw Error('found');
 return {text:`HRMS m/z: ${lab.text} Calcd for ${ionFormula} ${calc}${f?`; Found ${f}`:''}.`,
  html:`HRMS <i>m</i>/<i>z</i>: ${lab.html} Calcd for ${formulaHtml(ionFormula)} ${calc}${f?`; Found ${f}`:''}.`};
}

// ---------- reading pasted text ----------
const SUP='⁰¹²³⁴⁵⁶⁷⁸⁹',SUB='₀₁₂₃₄₅₆₇₈₉',FULL='０１２３４５６７８９';
export function normalize(s){
 return String(s).replace(/[−‐‑‒–—﹣－⁻₋]/g,'-').replace(/[＋⁺₊]/g,'+')
  .replace(/[·•∙⋅]/g,'').replace(/[   　]/g,' ').replace(/／/g,'/')
  .replace(/：/g,':').replace(/，/g,',').replace(/．/g,'.').replace(/；/g,';').replace(/[（]/g,'(').replace(/[）]/g,')')
  .replace(/[⁰-⁹₀-₉０-９¹²³]/g,c=>{for(const t of [SUP,SUB,FULL]){const i=t.indexOf(c);if(i>=0)return String(i);}return c;});
}
const BRACKET=/[\[(]\s*(\d*)\s*M\s*((?:[+-]\s*\d*\s*(?:[A-Z][a-z]?\d*)+\s*)*)[\])]\s*(\d*)\s*([+-])/g;
// '[M+HCOO]-' style notation -> {mult, z, delta, text}
export function parseIonNotation(s){
 const m=new RegExp(BRACKET).exec(normalize(s));if(!m)return null;return bracketInfo(m);
}
function bracketInfo(m){
 const mult=m[1]?Number(m[1]):1,z=(m[3]?Number(m[3]):1)*(m[4]==='+'?1:-1),delta={};
 for(const t of m[2].matchAll(/([+-])\s*(\d*)\s*((?:[A-Z][a-z]?\d*)+)/g)){
  let c;try{c=parseFormula(t[3]);}catch{return null;}
  const k=(t[2]?Number(t[2]):1)*(t[1]==='+'?1:-1);for(const [e,n] of Object.entries(c))delta[e]=(delta[e]||0)+k*n;
 }
 if(!mult||!z)return null;
 return {mult,z,delta,text:m[0].replace(/\s+/g,'')};
}
const CALC=/(?:\bcalc(?:ulated|d\.?|'d|\.)?|\btheor(?:etical|\.)?|計算値)(?![a-z])/gi;
const FOUND_AFTER=/(?:\bfound|\bobs(?:d|erved)?\.?|実測値)\s*[:=]?\s*(?:m\/z\s*[:=]?\s*)?(\d+\.\d+)/i;
const MZ_BEFORE=/(?:(?:\bfound|\bobs(?:d|erved)?\.?|実測値)\s*[:=]?\s*|m\/z\s*[:=]?\s*)(\d+\.\d+)/gi;

/* Check every "calcd for <formula> <value>" in the text.
   The written formula is taken as the formula of the ion (the usual convention);
   "C32H47NO5+Na+" (neutral formula plus an added ion) is read as the ion C32H47NO5Na with charge +1.
   The charge comes from the ion notation of the same record ([M+Na]+ before "calcd", next to the formula,
   or right after the value) or from a charge sign on the formula. When no charge is written, both signs
   are tried and the best match is kept (marked "to review"); conflicting charges are marked "to review".
   A "calcd" whose formula or value cannot be read is returned as status "unparsed" (not as correct). */
const RANK=['ok','rounding','neutralFormula','electron','electronSign','neutralFormulaElectron','mismatch'];
export function checkText(text,{tolerancePpm=5}={}){
 const s=normalize(text);const records=[];const hits=[...s.matchAll(CALC)];let prevEnd=0;
 hits.forEach((h,hi)=>{
  if(h.index<prevEnd)return;
  // elemental analysis ("Anal. Calcd for C19H21NO3: C, 73.29; ...") is not an accurate mass
  if(/(?:\banal(?:ysis|\.)?|elemental|元素分析)[^.;\n]{0,25}$/i.test(s.slice(Math.max(prevEnd,h.index-40),h.index)))return;
  const nextKw=hi+1<hits.length?hits[hi+1].index:s.length;
  let p=h.index+h[0].length;const take=re=>{re.lastIndex=p;const m=re.exec(s);if(m)p=re.lastIndex;return m;};
  // only statements that look like accurate-mass data are reported as unreadable (not prose such as "calculated ECD")
  const msLike=/m\/z|HR|\bMS\b|質量/.test(s.slice(Math.max(prevEnd,h.index-120),h.index));
  const unparsed=code=>{
   if(!msLike&&!forWord)return;
   let e=Math.min(nextKw,h.index+160);const stop=/[.;。](?=\s|$)|\n/.exec(s.slice(h.index+h[0].length,e));if(stop)e=h.index+h[0].length+stop.index;
   const from=Math.max(prevEnd,h.index-60);
   records.push({snippet:s.slice(from,e).replace(/\s+/g,' ').trim().slice(0,240),formula:'',ion:'',stated:'',found:null,z:null,
    recalculated:null,diffMDa:null,ppm:null,status:'unparsed',codes:[code]});
   prevEnd=e;
  };
  const fw=take(/\s*(?:\.\s*)?(for|as)?\s*:?\s*/y);const forWord=!!(fw&&fw[1]);
  const ionBefore=take(/\(?\s*(\[[^\]\n]{1,30}\]\s*\d*\s*[+-])\s*\)?\s*/y);
  // formula, optionally "+ added ion" (C32H47NO5+Na+), optionally a charge sign (C15H13O6-)
  const fm=take(/[\[(]?\s*((?:[A-Z][a-z]?\d*)+)(?:\s*\+\s*((?:[A-Z][a-z]?\d*)+)(?=\s*[+\])\s:]))?\s*[\])]?\s*(\d*[+-](?![\d.]))?/y);
  if(!fm){unparsed('noFormula');return;}
  const ionAfter=take(/\s*\(?\s*(\[[^\]\n]{1,30}\]\s*\d*\s*[+-])\s*\)?/y);
  const vm=take(/[\s,:;=]*(?:m\/z\s*[:=]?\s*)?(\d+\.\d+)/y);
  if(!vm){unparsed('noValue');return;}
  const ionAfterValue=take(/\s*\(?\s*(\[[^\]\n]{1,30}\]\s*\d*\s*[+-])\s*\)?/y);
  const valueEnd=p;
  // measured value: after ("found 203.0524") or before ("m/z 203.0524 ... (calcd for")
  // (same sentence only, and close to the calculated value, so the next compound's value is not taken)
  let found=null,start=h.index,end=valueEnd;const near=v=>Math.abs(Number(v)-Number(vm[1]))<=0.5;
  let after=s.slice(valueEnd,Math.min(nextKw,valueEnd+250));const stop=/[.。](?=\s|$)|\n\s*\n/.exec(after);if(stop)after=after.slice(0,stop.index);
  const fa=FOUND_AFTER.exec(after);
  if(fa&&near(fa[1])){found=fa[1];end=valueEnd+fa.index+fa[0].length;}
  const from=Math.max(prevEnd,h.index-250),before=s.slice(from,h.index);
  if(!found){const all=[...before.matchAll(MZ_BEFORE)].filter(b=>near(b[1]));if(all.length){const b=all[all.length-1];found=b[1];start=Math.min(start,from+b.index);}}
  // ion notations of this record: next to the formula, right after the value, otherwise the last one before "calcd"
  const notes=[];
  for(const cand of [ionAfter&&ionAfter[1],ionBefore&&ionBefore[1],ionAfterValue&&ionAfterValue[1]]){if(cand){const info=parseIonNotation(cand);if(info)notes.push(info);}}
  // the last one before "calcd" is also read, so a notation that contradicts it is not missed
  {const all=[...before.matchAll(BRACKET)];for(let i=all.length-1;i>=0;i--){const info=bracketInfo(all[i]);if(info){notes.push(info);start=Math.min(start,from+all[i].index);break;}}}
  const br=notes[0]||null;
  prevEnd=end;
  const written=fm[1]+(fm[2]||'');
  const rec={snippet:s.slice(start,end).replace(/\s+/g,' ').trim().slice(0,240),formula:written,ion:br?br.text:'',stated:vm[1],found,z:null,
   recalculated:null,diffMDa:null,ppm:null,status:'unparsed',codes:[]};
  records.push(rec);
  let F;try{F=parseFormula(written);}catch{rec.codes.push('formula');return;}
  // every charge written for this record
  const charges=notes.map(n=>n.z);
  if(fm[3]){const q=/(\d*)([+-])/.exec(fm[3]);charges.push((q[1]?Number(q[1]):1)*(q[2]==='+'?1:-1));}
  else if(fm[2])charges.push(1);
  const conflict=new Set(charges).size>1;
  const S=Number(vm[1]),d=(vm[1].split('.')[1]||'').length,unit=10**-d,tol=unit/2+1e-9;
  const evaluate=z=>{
   const az=Math.abs(z),ok=(mass(F)-z*ELECTRON_MASS)/az;
   if(Math.abs(S-ok)<=tol)return {z,code:'ok',ref:ok,shown:ok};
   if(Math.abs(S-ok)<=unit+1e-9)return {z,code:'rounding',ref:ok,shown:ok};
   if(Math.abs(S-mass(F)/az)<=tol)return {z,code:'electron',ref:ok,shown:ok};
   if(Math.abs(S-(mass(F)+z*ELECTRON_MASS)/az)<=tol)return {z,code:'electronSign',ref:ok,shown:ok};
   const nb=notes.find(n=>n.z===z);
   if(nb&&!fm[2]){
    const Fi={};for(const [e,n] of Object.entries(F))Fi[e]=n*nb.mult;for(const [e,n] of Object.entries(nb.delta))Fi[e]=(Fi[e]||0)+n;
    if(Object.values(Fi).every(n=>n>=0)&&Object.values(Fi).some(n=>n>0)){
     const ionOk=(mass(Fi)-z*ELECTRON_MASS)/az;
     if(Math.abs(S-ionOk)<=unit+1e-9)return {z,code:'neutralFormula',ref:ionOk,shown:ionOk};
     if(Math.abs(S-mass(Fi)/az)<=tol)return {z,code:'neutralFormulaElectron',ref:ionOk,shown:ionOk};
    }
   }
   return {z,code:'mismatch',ref:ok,shown:ok};
  };
  // a written charge is used as given; with no charge (or conflicting charges) every candidate is tried
  const candidates=charges.length&&!conflict?[charges[0]]:charges.length?[...new Set(charges)]:[1,-1];
  const r=candidates.map(evaluate).sort((a,b)=>RANK.indexOf(a.code)-RANK.indexOf(b.code))[0];
  if(!charges.length)rec.codes.push('chargeAssumed');
  if(conflict)rec.codes.push('chargeConflict');
  rec.z=r.z;rec.recalculated=r.shown;rec.diffMDa=(S-r.shown)*1000;rec.codes.unshift(r.code);
  if(d<4&&['ok','rounding'].includes(r.code))rec.codes.push('fewDigits');
  if(found!==null){rec.ppm=(Number(found)-r.ref)/r.ref*1e6;if(Math.abs(rec.ppm)>tolerancePpm+1e-9)rec.codes.push('foundOff');}
  const errors=['electron','electronSign','neutralFormulaElectron','mismatch'];
  rec.status=rec.codes.some(c=>errors.includes(c))?'error':rec.codes.some(c=>['neutralFormula','foundOff','chargeAssumed','chargeConflict'].includes(c))?'warn':'ok';
 });
 return records;
}

// ---------- batch input ----------
const ION_ALIASES=new Map();
for(const k of Object.keys(IONS)){ION_ALIASES.set(k,k);const inner=/^\[(.+)\]/.exec(k)[1];
 const same=Object.keys(IONS).filter(j=>/^\[(.+)\]/.exec(j)[1]===inner);if(same.length===1)ION_ALIASES.set(inner,k);}
for(const [a,k] of [['[M+HCO2]-','[M+HCOO]-'],['[M+FA-H]-','[M+HCOO]-'],['[M+CH3CO2]-','[M+CH3COO]-'],['[M+OAc]-','[M+CH3COO]-'],['[M-H2O+H]+','[M+H-H2O]+']])ION_ALIASES.set(a,k);
export function ionKeyFrom(token){
 const s=normalize(token).replace(/\s+/g,'').replace(/^\((.*)\)([+-]?\d*[+-]?)$/,'[$1]$2');
 return ION_ALIASES.get(s)||null;
}
// a measured m/z: empty, or a positive finite number written with digits (shared by the calculator and the batch)
export function readFound(raw){
 const v=normalize(raw).trim();if(v==='')return '';
 if(!/^\d+(\.\d+)?$/.test(v)||!(Number(v)>0)||!Number.isFinite(Number(v)))throw Error('found');
 return v;
}
const isFormula=c=>{if(!/^(?:[A-Z][a-z]?\d*)+$/.test(c))return false;try{parseFormula(c);return true;}catch{return false;}};
const isNumberLike=c=>/^[+-]?\d*\.?\d+(?:e[+-]?\d+)?$/i.test(c);
/* One compound per line: [label] formula [ion] [measured m/z], separated by tabs (Excel), spaces or commas.
   Lines starting with # are ignored. The formula is the cell after which only an ion and a measured m/z
   follow, so a label such as "B" or "C1" is not taken for a formula when a formula comes later
   ("B  C6H12O6  [M+H]+  181.0707"); "B  [M+H]+" alone still means boron. */
export function parseBatch(text,defaultKey){
 const rows=[];const lines=String(text).split(/\r?\n/);
 if(lines.length>1000)throw Error('lines');
 lines.forEach((raw,i)=>{
  const line=normalize(raw).trim();if(!line||line.startsWith('#'))return;
  let cells;
  if(line.includes('\t'))cells=line.split('\t').map(c=>c.trim()).filter(Boolean);
  else cells=line.replace(/[\[(][^\])]*[\])]\s*\d*[+-]?/g,m=>m.replace(/\s+/g,'')).split(/[\s,;]+/).filter(Boolean);
  const row={line:i+1,label:'',formula:'',counts:null,key:defaultKey,found:'',error:null};
  // the cells after the formula: ion types and at most one measured value
  const tail=from=>{
   const keys=[],nums=[];let bad=null;
   for(const c of cells.slice(from)){const key=ionKeyFrom(c);if(key){keys.push(key);continue;}if(isNumberLike(c)){nums.push(c);continue;}bad=c;break;}
   return {keys,nums,bad};
  };
  const fits=[];for(let fi=0;fi<cells.length;fi++)if(isFormula(cells[fi])&&!tail(fi+1).bad)fits.push(fi);
  if(!fits.length){
   const any=cells.findIndex(isFormula);
   if(any<0){row.label=cells.join(' ');row.error='formula';rows.push(row);return;}
   const last=cells.map((c,j)=>j).filter(j=>isFormula(cells[j])).pop();
   row.label=cells.slice(0,last).join(' ');row.formula=cells[last];
   const {keys,nums,bad}=tail(last+1);if(keys.length)row.key=keys[0];if(nums.length)row.found=nums[0];
   row.error=/M/.test(bad)?'ion':'token';row.bad=bad;rows.push(row);return;
  }
  // the formula is the last formula-like cell that only an ion and a value follow (labels come first)
  const fi=fits[fits.length-1];
  row.label=cells.slice(0,fi).join(' ');row.formula=cells[fi];row.counts=parseFormula(cells[fi]);
  const {keys,nums}=tail(fi+1);
  const distinct=[...new Set(keys)];
  if(distinct.length>1){row.error='ionConflict';row.bad=distinct.join(', ');rows.push(row);return;}
  if(distinct.length)row.key=distinct[0];
  if(nums.length>1){row.error='token';row.bad=nums[1];rows.push(row);return;}
  if(nums.length){try{row.found=readFound(nums[0]);}catch{row.error='found';row.bad=nums[0];}}
  rows.push(row);
 });
 return rows;
}
