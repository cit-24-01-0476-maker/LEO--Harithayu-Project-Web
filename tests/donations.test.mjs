import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../server/store.mjs';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('only verified transfers count; repeat review is idempotent and private names stay private',()=>{
  const s=createStore(':memory:');try{
    s.insert({id:'one',token:'secret',name:'Private Name',email:'private@example.com',amount:500,reference:'BANK-001',publicName:false,createdAt:new Date().toISOString()});
    assert.equal(s.summary().amount,0);assert.equal(s.confirm('one','confirmed'),1);assert.equal(s.confirm('one','confirmed'),0);
    const result=s.summary();assert.equal(result.amount,500);assert.equal(result.seedlings,5);assert.equal(result.contributions,1);assert.equal(result.donors[0].name,'Anonymous');assert.ok(!JSON.stringify(result).includes('private@example.com'));assert.ok(!JSON.stringify(result).includes('BANK-001'));assert.ok(!JSON.stringify(result).includes('secret'));
    s.insert({id:'two',token:'other',name:'Public Supporter',email:'public@example.com',amount:100,reference:'BANK-002',publicName:true,createdAt:new Date().toISOString()});s.confirm('two','rejected');assert.equal(s.summary().amount,500);
    assert.throws(()=>s.insert({id:'three',token:'third',name:'Duplicate',email:'x@example.com',amount:100,reference:'BANK-001',publicName:true,createdAt:new Date().toISOString()}),/UNIQUE/);
  }finally{s.close();}
});

test('HTTP flow protects admin and donor status, validates origin, and confirms against persistent storage',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'harithayu-test-')),port=33921,origin=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port),PUBLIC_ORIGIN:origin,DB_PATH:join(directory,'test.sqlite'),ADMIN_PASSWORD:'test-only-password-for-integration',DONATIONS_ENABLED:'true',BANK_NAME:'Test bank',BANK_ACCOUNT_NAME:'Test club',BANK_ACCOUNT_NUMBER:'TEST-ONLY',BANK_BRANCH:'Test branch',CONTACT_EMAIL:'test@example.com'},stdio:['ignore','pipe','pipe']});
  try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server did not start')),7000);child.stdout.on('data',b=>{if(String(b).includes('ready')){clearTimeout(timer);resolve();}});child.on('error',reject);});
    const post=(path,data,cookie)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});
    assert.equal((await fetch(origin+'/')).status,200);
    assert.equal((await fetch(origin+'/api/admin/donations')).status,401);
    assert.equal((await fetch(origin+'/api/admin/login',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'})).status,403);
    assert.equal((await post('/api/donations',{name:'X',email:'bad',amount:100})).status,400);
    const response=await post('/api/donations',{name:'Test Donor',email:'donor@example.com',amount:500,reference:'TEST-REFERENCE',publicName:true,consent:true});assert.equal(response.status,201);const d=await response.json();
    assert.equal((await fetch(origin+'/api/donations/'+d.id)).status,404);
    const own=await fetch(origin+'/api/donations/'+d.id,{headers:{Authorization:`Bearer ${d.token}`}});assert.equal((await own.json()).status,'pending');assert.equal((await (await fetch(origin+'/api/summary')).json()).amount,0);
    assert.equal((await post('/api/admin/login',{password:'wrong'})).status,401);
    const login=await post('/api/admin/login',{password:'test-only-password-for-integration'});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal((await post('/api/admin/review',{id:d.id,status:'confirmed'},cookie)).status,200);
    assert.equal((await post('/api/admin/review',{id:d.id,status:'confirmed'},cookie)).status,409);
    const summary=await (await fetch(origin+'/api/summary')).json();assert.equal(summary.amount,500);assert.equal(summary.seedlings,5);assert.equal(summary.donors[0].name,'Test Donor');assert.ok(!JSON.stringify(summary).includes('donor@example.com'));
    assert.equal((await post('/api/admin/logout',{},cookie)).status,200);assert.equal((await fetch(origin+'/api/admin/donations',{headers:{Cookie:cookie}})).status,401);
  }finally{child.kill();await new Promise(r=>child.once('exit',r));await rm(directory,{recursive:true,force:true});}
});
