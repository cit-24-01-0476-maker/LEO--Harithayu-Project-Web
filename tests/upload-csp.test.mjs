import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHandler} from '../server/service.mjs';
test('page and API CSP permit the Blob SDK upload endpoint without opening arbitrary connections',async()=>{
 const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
 const page=config.headers.flatMap(x=>x.headers).find(x=>x.key==='Content-Security-Policy').value;
 let api;await createHandler({store:null,env:{}})({url:'/api/config',method:'GET',headers:{}},{setHeader(k,v){if(k==='Content-Security-Policy')api=v;},writeHead(){},end(){}});
 const bundle=await readFile(new URL('../public/proof-upload.js',import.meta.url),'utf8');
 const sdkEndpoint=bundle.match(/defaultVercelBlobApiUrl = "([^"]+)"/)[1];
 for(const policy of [page,api]){
   const sources=policy.split(';').find(x=>x.trim().startsWith('connect-src ')).trim().split(/\s+/).slice(1);
   assert.ok(sources.includes(sdkEndpoint),'Blob SDK root must be permitted');
   assert.ok(sources.includes(sdkEndpoint+'/'),'Multipart child endpoints must be permitted');
   assert.ok(!sources.includes('*'));assert.ok(!sources.includes('https:'));
 }
});
