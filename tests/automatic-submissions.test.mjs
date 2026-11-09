import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createStore} from '../server/store.mjs';
import {createHandler} from '../server/service.mjs';
import {createGoogleBridge} from '../server/google-bridge.mjs';

test('a valid proof appears automatically without admin login, while status stays explicitly unverified',async()=>{
 const store=createStore(':memory:'),server=http.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`;
 server.on('request',createHandler({store,env:{PUBLIC_ORIGIN:origin,DONATIONS_ENABLED:'true',AUTO_ACCEPT_SUBMISSIONS:'true',ADMIN_PASSWORD:'test-only-password-long',BANK_NAME:'TEST',BANK_ACCOUNT_NAME:'TEST',BANK_ACCOUNT_NUMBER:'TEST',BANK_BRANCH:'TEST',CONTACT_EMAIL:'test@example.test'}}));
 const post=(path,data)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
 try{
  const payload={name:'Automatic Test',phone:'0770000000',email:'',amount:300,reference:'AUTO-TEST-001',publicName:true,consent:true,slip:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII='};
  const response=await post('/api/slip-donations',payload);assert.equal(response.status,201);const d=await response.json();assert.equal(d.status,'accepted');
  const summary=await (await fetch(origin+'/api/summary')).json();assert.equal(summary.amount,300);assert.equal(summary.seedlings,3);assert.equal(summary.donors[0].auto_accepted,1);
  const own=await (await fetch(origin+'/api/donations/'+d.id,{headers:{Authorization:'Bearer '+d.token}})).json();assert.equal(own.status,'accepted');
  assert.equal((await post('/api/slip-donations',payload)).status,409);
  assert.equal((await post('/api/donations',{...payload,reference:'NO-PROOF'})).status,400);
  assert.ok(!JSON.stringify(summary).includes('0770000000'));
  const cutoff=new Date().toISOString(),archived=store.archiveBefore(cutoff);assert.equal(archived.length,1);assert.equal(store.summary().amount,0);assert.equal(store.pending().length,0);assert.equal(store.archiveBefore(cutoff).length,0);assert.ok(store.find(d.id).archived_at);assert.ok(store.receipt(d.id));
  assert.equal((await fetch(origin+'/api/donations/'+d.id,{headers:{Authorization:'Bearer '+d.token}})).status,404);
 }finally{await new Promise(r=>server.close(r));store.close();}
});

test('automatic acceptance is not reported to Google as a verified bank payment',async()=>{
 const bridge=createGoogleBridge({GOOGLE_BRIDGE_URL:'https://script.google.com/macros/s/test/exec',GOOGLE_BRIDGE_SECRET:'x'.repeat(48)},async(url,options)=>{
  const d=JSON.parse(options.body);assert.equal(d.status,'pending');return Response.json({ok:true,id:d.id});
 });
 await bridge({id:'a'.repeat(24),name:'Test',amount:100,status:'confirmed',autoAccepted:true});
});
