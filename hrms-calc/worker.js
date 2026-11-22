import {search} from './core.js?v=20261122-2';
onmessage=({data})=>{try{postMessage(search(data));}catch(e){postMessage({error:e.message});}};
