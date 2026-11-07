// Sentences for papers / Supporting Information, a checker for reported HRMS values, and batch input.
import {IONS,ELECTRON_MASS,parseFormula,formula,mass,ionCounts} from './core.js?v=20261107-2';
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
 BRACKET.lastIndex=0;const m=BRACKET.exec(normalize(s));if(!m)return null;return bracketInfo(m);
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
   The written formula is taken as the formula of the ion (the usual convention). */
export function checkText(text,{tolerancePpm=5}={}){
 const s=normalize(text);const records=[];const hits=[...s.matchAll(CALC)];let prevEnd=0;
 hits.forEach((h,hi)=>{
  if(h.index<prevEnd)return;
  const nextKw=hi+1<hits.length?hits[hi+1].index:s.length;
  let p=h.index+h[0].length;const take=re=>{re.lastIndex=p;const m=re.exec(s);if(m)p=re.lastIndex;return m;};
  take(/\s*(?:\.\s*)?(?:for|as)?\s*:?\s*/y);
  const ionBefore=take(/\(?\s*(\[[^\]\n]{1,30}\]\s*\d*\s*[+-])\s*\)?\s*/y);
  const fm=take(/[\[(]?\s*((?:[A-Z][a-z]?\d*)+)\s*[\])]?\s*(\d*[+-](?![\d.]))?/y);
  if(!fm)return;
  const ionAfter=take(/\s*\(?\s*(\[[^\]\n]{1,30}\]\s*\d*\s*[+-])\s*\)?/y);
  const vm=take(/[\s,:;=]*(?:m\/z\s*[:=]?\s*)?(\d+\.\d+)/y);
  if(!vm)return;
  const valueEnd=p;
  // measured value: after ("found 203.0524") or before ("m/z 203.0524 ... (calcd for")
  // (same sentence only, and close to the calculated value, so the next compound's value is not taken)
  let found=null,start=h.index,end=valueEnd;const near=v=>Math.abs(Number(v)-Number(vm[1]))<=0.5;
  let after=s.slice(valueEnd,Math.min(nextKw,valueEnd+250));const stop=/[.。](?=\s|$)|\n\s*\n/.exec(after);if(stop)after=after.slice(0,stop.index);
  const fa=FOUND_AFTER.exec(after);
  if(fa&&near(fa[1])){found=fa[1];end=valueEnd+fa.index+fa[0].length;}
  const from=Math.max(prevEnd,h.index-250),before=s.slice(from,h.index);
  if(!found){const all=[...before.matchAll(MZ_BEFORE)].filter(b=>near(b[1]));if(all.length){const b=all[all.length-1];found=b[1];start=Math.min(start,from+b.index);}}
  // ion notation: next to the formula, otherwise the last one before "calcd"
  let br=null;
  for(const cand of [ionAfter&&ionAfter[1],ionBefore&&ionBefore[1]]){if(cand&&!br){const info=parseIonNotation(cand);if(info)br=info;}}
  if(!br){const all=[...before.matchAll(BRACKET)];for(let i=all.length-1;i>=0&&!br;i--){br=bracketInfo(all[i]);if(br)start=Math.min(start,from+all[i].index);}}
  prevEnd=end;
  const rec={snippet:s.slice(start,end).replace(/\s+/g,' ').trim().slice(0,240),formula:fm[1],ion:br?br.text:'',stated:vm[1],found,z:null,
   recalculated:null,diffMDa:null,ppm:null,status:'unparsed',codes:[]};
  records.push(rec);
  let F;try{F=parseFormula(fm[1]);}catch{rec.codes.push('formula');return;}
  let z=br?br.z:null;
  if(z===null&&fm[2]){const q=/(\d*)([+-])/.exec(fm[2]);z=(q[1]?Number(q[1]):1)*(q[2]==='+'?1:-1);}
  const S=Number(vm[1]),d=(vm[1].split('.')[1]||'').length,unit=10**-d,tol=unit/2+1e-9;
  const evaluate=z=>{
   const az=Math.abs(z),ok=(mass(F)-z*ELECTRON_MASS)/az;
   if(Math.abs(S-ok)<=tol)return {code:'ok',ref:ok,shown:ok};
   if(Math.abs(S-ok)<=unit+1e-9)return {code:'rounding',ref:ok,shown:ok};
   if(Math.abs(S-mass(F)/az)<=tol)return {code:'electron',ref:ok,shown:ok};
   if(Math.abs(S-(mass(F)+z*ELECTRON_MASS)/az)<=tol)return {code:'electronSign',ref:ok,shown:ok};
   if(br&&br.z===z){
    const Fi={};for(const [e,n] of Object.entries(F))Fi[e]=n*br.mult;for(const [e,n] of Object.entries(br.delta))Fi[e]=(Fi[e]||0)+n;
    if(Object.values(Fi).every(n=>n>=0)&&Object.values(Fi).some(n=>n>0)){
     const ionOk=(mass(Fi)-z*ELECTRON_MASS)/az;
     if(Math.abs(S-ionOk)<=unit+1e-9)return {code:'neutralFormula',ref:ionOk,shown:ionOk};
     if(Math.abs(S-mass(Fi)/az)<=tol)return {code:'neutralFormulaElectron',ref:ionOk,shown:ionOk};
    }
   }
   return {code:'mismatch',ref:ok,shown:ok};
  };
  let r;
  if(z!==null)r=evaluate(z);
  else{const a=evaluate(1),b=evaluate(-1);r=a.code!=='mismatch'?a:b.code!=='mismatch'?b:a;z=r===b?-1:1;rec.codes.push('chargeAssumed');}
  rec.z=z;rec.recalculated=r.shown;rec.diffMDa=(S-r.shown)*1000;rec.codes.unshift(r.code);
  if(d<4&&['ok','rounding'].includes(r.code))rec.codes.push('fewDigits');
  if(found!==null){rec.ppm=(Number(found)-r.ref)/r.ref*1e6;if(Math.abs(rec.ppm)>tolerancePpm+1e-9)rec.codes.push('foundOff');}
  const errors=['electron','electronSign','neutralFormulaElectron','mismatch'];
  rec.status=rec.codes.some(c=>errors.includes(c))?'error':rec.codes.some(c=>['neutralFormula','foundOff','chargeAssumed'].includes(c))?'warn':'ok';
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
/* One compound per line: [label] formula [ion] [measured m/z], separated by tabs (Excel), spaces or commas.
   Lines starting with # are ignored. */
export function parseBatch(text,defaultKey){
 const rows=[];const lines=String(text).split(/\r?\n/);
 if(lines.length>1000)throw Error('lines');
 lines.forEach((raw,i)=>{
  const line=normalize(raw).trim();if(!line||line.startsWith('#'))return;
  let cells;
  if(line.includes('\t'))cells=line.split('\t').map(c=>c.trim()).filter(Boolean);
  else cells=line.replace(/[\[(][^\])]*[\])]\s*\d*[+-]?/g,m=>m.replace(/\s+/g,'')).split(/[\s,;]+/).filter(Boolean);
  const row={line:i+1,label:'',formula:'',counts:null,key:defaultKey,found:'',error:null};
  const fi=cells.findIndex(c=>{if(!/^(?:[A-Z][a-z]?\d*)+$/.test(c))return false;try{parseFormula(c);return true;}catch{return false;}});
  if(fi<0){row.label=cells.join(' ');row.error='formula';rows.push(row);return;}
  row.label=cells.slice(0,fi).join(' ');row.formula=cells[fi];row.counts=parseFormula(cells[fi]);
  for(const c of cells.slice(fi+1)){
   const key=ionKeyFrom(c);
   if(key){row.key=key;continue;}
   if(/^\d+(\.\d+)?$/.test(c)&&!row.found){row.found=c;continue;}
   row.error=/M/.test(c)?'ion':'token';row.bad=c;break;
  }
  rows.push(row);
 });
 return rows;
}
