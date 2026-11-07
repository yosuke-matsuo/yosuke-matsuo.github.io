import {ELEMENTS,ELECTRON_MASS} from './constants.js';
export {ELEMENTS,ELECTRON_MASS};
export const IONS = {
 '[M]+': [1,1,{}], '[M+H]+': [1,1,{H:1}], '[M+Na]+': [1,1,{Na:1}],
 '[M+K]+': [1,1,{K:1}], '[M+NH4]+': [1,1,{N:1,H:4}],
 '[M]-': [1,-1,{}], '[M-H]-': [1,-1,{H:-1}], '[M+Cl]-': [1,-1,{Cl:1}],
 '[M+2H]2+': [1,2,{H:2}], '[M-2H]2-': [1,-2,{H:-2}],
 '[2M]+': [2,1,{}], '[2M+H]+': [2,1,{H:1}], '[2M+Na]+': [2,1,{Na:1}],
 '[2M]-': [2,-1,{}], '[2M-H]-': [2,-1,{H:-1}]
};
export function parseFormula(input) {
 if(typeof input!=='string'||!input.length||input.length>500) throw Error('formula');
 const s=input.trim(); const out={}; const re=/([A-Z][a-z]?)([0-9]*)/gy;let pos=0,m;
 while((m=re.exec(s))){
  const n=m[2]===''?1:Number(m[2]);
  if(!Object.hasOwn(ELEMENTS,m[1])||!Number.isSafeInteger(n)||n<1||n>10000)throw Error('formula');
  out[m[1]]=(out[m[1]]||0)+n;if(out[m[1]]>10000)throw Error('formula');pos=re.lastIndex;
 }
 if(pos!==s.length||!pos)throw Error('formula');return out;
}
export function formula(c) {
 const keys=Object.keys(c).filter(k=>c[k]>0).sort();
 if(c.C){keys.splice(keys.indexOf('C'),1);if(c.H)keys.splice(keys.indexOf('H'),1);keys.unshift(...(c.H?['C','H']:['C']));}
 return keys.map(k=>k+(c[k]===1?'':c[k])).join('');
}
export function mass(c){
 let result=0;
 for(const [e,n] of Object.entries(c)){
  if(!Object.hasOwn(ELEMENTS,e)||!Number.isSafeInteger(n)||n<0||n>100000)throw Error('formula');
  result+=Number(ELEMENTS[e].mass)*n;
 }
 return result;
}
export function ion(c,key){
 if(!Object.hasOwn(IONS,key))throw Error('ion');
 const [mult,z,delta]=IONS[key];const counts={};
 for(const [e,n] of Object.entries(c))counts[e]=n*mult;
 for(const [e,n] of Object.entries(delta))counts[e]=(counts[e]||0)+n;
 if(Object.values(counts).some(n=>n<0))throw Error('composition');
 if(!Object.values(counts).some(n=>n>0))throw Error('composition');
 const neutral=mass(c); if(!(neutral>0))throw Error('formula');
 const mz=(mass(counts)-z*ELECTRON_MASS)/Math.abs(z);
 if(!(mz>0))throw Error('composition');
 return {formula:formula(c),ionFormula:formula(counts),z,neutral,mz};
}
export const ppm=(found,calculated)=>(found-calculated)/calculated*1e6;
export function dbe(c){
 if(Object.keys(c).some(k=>c[k]&&!['C','H','N','O','S','F','Cl','Br','I'].includes(k)))return null;
 return 1+(c.C||0)+(c.N||0)/2-((c.H||0)+(c.F||0)+(c.Cl||0)+(c.Br||0)+(c.I||0))/2;
}
export function search({found,tolerance,unit,adduct,ranges},limits={}){
 if(!Number.isFinite(found)||found<=0||found>100000||!Number.isFinite(tolerance)||tolerance<0||
 !['ppm','mDa'].includes(unit)||(unit==='ppm'&&tolerance>=1e6)||!Object.hasOwn(IONS,adduct))throw Error('search');
 const [mult,z,delta]=IONS[adduct];
 if(!Array.isArray(ranges)||!ranges.length||ranges.length>Object.keys(ELEMENTS).length)throw Error('range');
 const seen=new Set();let rows=ranges.map(([e,min,max])=>{
  if(!Object.hasOwn(ELEMENTS,e)||seen.has(e)||!Number.isInteger(min)||!Number.isInteger(max)||min<0||max<min||max>1000)throw Error('range');
  seen.add(e);return {e,min,max,w:Number(ELEMENTS[e].mass)};
 }).filter(r=>r.max>0).sort((a,b)=>b.w-a.w);
 if(!rows.length)throw Error('range');
 let offset=0;for(const [e,n]of Object.entries(delta))offset+=Number(ELEMENTS[e].mass)*n;
 offset-=z*ELECTRON_MASS;
 const lowMz=unit==='ppm'?found/(1+tolerance/1e6):found-tolerance/1000;
 const highMz=unit==='ppm'?found/(1-tolerance/1e6):found+tolerance/1000;
 const low=(lowMz*Math.abs(z)-offset)/mult,high=(highMz*Math.abs(z)-offset)/mult;
 const mins=Array(rows.length+1).fill(0),maxs=[...mins];
 for(let i=rows.length-1;i>=0;i--){mins[i]=mins[i+1]+rows[i].min*rows[i].w;maxs[i]=maxs[i+1]+rows[i].max*rows[i].w;}
 const results=[],counts={};let nodes=0,complete=true;
 const maxNodes=limits.maxNodes??2000000,maxResults=limits.maxResults??5000;
 function visit(i,sum){
  if(!complete)return;if(++nodes>maxNodes){complete=false;return;}
  if(sum+mins[i]>high+1e-9||sum+maxs[i]<low-1e-9)return;
  if(i===rows.length){
   let r;try{r=ion(counts,adduct);}catch(e){if(['composition','formula'].includes(e.message))return;throw e;}
   const error=ppm(found,r.mz),md=(found-r.mz)*1000;
   if(Math.abs(unit==='ppm'?error:md)<=tolerance+1e-8){
    if(results.length>=maxResults){complete=false;return;}
    results.push({...r,ppm:error,mDa:md,dbe:dbe(counts)});
   }return;
  }
  const r=rows[i];
  const from=Math.max(r.min,Math.ceil((low-sum-maxs[i+1]-1e-9)/r.w));
  const to=Math.min(r.max,Math.floor((high-sum-mins[i+1]+1e-9)/r.w));
  for(let n=from;n<=to&&complete;n++){counts[r.e]=n;visit(i+1,sum+n*r.w);}
  delete counts[r.e];
 }
 visit(0,0);results.sort((a,b)=>Math.abs(a.ppm)-Math.abs(b.ppm)||a.formula.localeCompare(b.formula));
 return {results,complete,nodes};
}
