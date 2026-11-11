import {search} from './core.js?v=20261111-1';
onmessage=({data})=>{try{postMessage(search(data));}catch(e){postMessage({error:e.message});}};
