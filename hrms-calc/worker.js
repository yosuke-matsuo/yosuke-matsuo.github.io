import {search} from './core.js?v=20261108-3';
onmessage=({data})=>{try{postMessage(search(data));}catch(e){postMessage({error:e.message});}};
