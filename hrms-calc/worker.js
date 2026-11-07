import {search} from './core.js?v=20261107-5';
onmessage=({data})=>{try{postMessage(search(data));}catch(e){postMessage({error:e.message});}};
