import {search} from './core.js';
onmessage=({data})=>{try{postMessage(search(data));}catch(e){postMessage({error:e.message});}};
