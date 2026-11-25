import {search} from './core.js?v=20261125-1';
onmessage=({data})=>{try{postMessage(search(data));}catch(e){postMessage({error:e.message});}};
