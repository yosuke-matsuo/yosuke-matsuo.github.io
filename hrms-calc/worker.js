import {search} from './core.js?v=20261127-8';
onmessage=({data})=>{try{postMessage(search(data));}catch(e){postMessage({error:e.message});}};
