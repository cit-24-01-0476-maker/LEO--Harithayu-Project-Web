import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createStore } from '../server/store.mjs';
import { createHandler } from '../server/service.mjs';
test('slip uploads stay private and only approved funds enter the public tree',async()=>{
 const store=createStore(':memory:');const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 server.on('request',createHandler({store,env:{PUBLIC_ORIGIN:origin,DONATIONS_ENABLED:'true',BANK_NAME:'Bank',BANK_ACCOUNT_NAME:'Club',BANK_ACCOUNT_NUMBER:'123',BANK_BRANCH:'Branch',CONTACT_EMAIL:'club@example.com',ADMIN_PASSWORD:'long-test-password-only'}}));
 const post=(path,d,cookie)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(d)});
 try{
 const payload={name:'Leaf Donor',phone:'0771234567',email:'',amount:300,reference:'SLIP-001',publicName:true,consent:true,slip:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII='};
 assert.equal((await post('/api/slip-donations',{...payload,slip:'data:image/png;base64,ZmFrZQ=='})).status,400);
 const submitted=await post('/api/slip-donations',payload);assert.equal(submitted.status,201);const {id}=await submitted.json();assert.equal(store.summary().amount,0);
 assert.equal((await fetch(origin+'/api/admin/slips/'+id)).status,401);
 const login=await post('/api/admin/login',{password:'long-test-password-only'});const cookie=login.headers.get('set-cookie').split(';')[0];
 const slip=await fetch(origin+'/api/admin/slips/'+id,{headers:{Cookie:cookie}});assert.equal(slip.status,200);assert.equal(slip.headers.get('content-type'),'image/png');
 assert.equal((await (await fetch(origin+'/api/admin/donations',{headers:{Cookie:cookie}})).json()).donations[0].phone,payload.phone);
 assert.equal((await post('/api/admin/review',{id,status:'confirmed'},cookie)).status,200);
 const summary=await (await fetch(origin+'/api/summary')).json();assert.equal(summary.amount,300);assert.equal(summary.donors[0].name,'Leaf Donor');assert.ok(!JSON.stringify(summary).includes(payload.phone));assert.ok(!JSON.stringify(summary).includes('base64'));assert.equal((await post('/api/slip-donations',payload)).status,409);
 }finally{await new Promise(r=>server.close(r));store.close();}
});
