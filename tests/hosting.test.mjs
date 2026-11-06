import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createStore } from '../server/store.mjs';
import { createTursoStore } from '../server/turso-store.mjs';
import { createHandler } from '../server/service.mjs';

test('Turso protocol preserves verification, shared login sessions and atomic rate limits',async()=>{
  const local=createStore(':memory:');
  const fetcher=async(url,options)=>{
    assert.equal(new URL(url).pathname,'/v2/pipeline');
    assert.equal(options.headers.Authorization,'Bearer test-only');
    const pipeline=JSON.parse(options.body);assert.equal(pipeline.requests[1].type,'close');
    const stmt=pipeline.requests[0].stmt,args=stmt.args.map(a=>a.type==='integer'?Number(a.value):a.type==='null'?null:a.value);
    try {
      const query=local.db.prepare(stmt.sql),cols=query.columns();
      const rows=cols.length?query.all(...args):[];if(!cols.length)query.run(...args);
      const values=rows.map(r=>cols.map(c=>r[c.name]===null?{type:'null'}:typeof r[c.name]==='number'?{type:'integer',value:String(r[c.name])}:{type:'text',value:r[c.name]}));
      return Response.json({results:[{type:'ok',response:{result:{cols:cols.map(c=>({name:c.name})),rows:values,affected_row_count:local.db.prepare('SELECT changes() value').get().value}}},{type:'ok'}]});
    } catch(error) {return Response.json({results:[{type:'error',error:{message:error.message}}]});}
  };
  try {
    const a=await createTursoStore({TURSO_DATABASE_URL:'libsql://test.turso.io',TURSO_AUTH_TOKEN:'test-only'},fetcher);
    const b=await createTursoStore({TURSO_DATABASE_URL:'https://test.turso.io',TURSO_AUTH_TOKEN:'test-only'},fetcher);
    await a.insert({id:'one',token:'private',name:'Hidden Name',email:'hidden@example.com',amount:500,reference:'TRANSFER-ONE',publicName:false,createdAt:new Date().toISOString()});
    assert.equal((await b.summary()).amount,0);assert.equal(await b.confirm('one','confirmed'),1);assert.equal(await a.confirm('one','confirmed'),0);
    assert.equal((await a.summary()).amount,500);assert.equal((await a.summary()).donors[0].name,'Anonymous');
    const now=Date.now();await a.createSession('shared-session',now+60000);assert.equal(await b.sessionValid('shared-session',now),true);await b.deleteSession('shared-session');assert.equal(await a.sessionValid('shared-session',now),false);
    assert.equal(await a.allowRate('login:test',1,now),true);assert.equal(await b.allowRate('login:test',1,now),false);
    assert.equal(await a.allowRate('login:test',1,now+600001),true);
  } finally {local.close();}
});

test('hosted preview keeps contributions and admin closed without a persistent database',async()=>{
  const server=http.createServer(createHandler({store:null,env:{PUBLIC_ORIGIN:'https://harithayu.example',DONATIONS_ENABLED:'true',BANK_NAME:'Test',BANK_ACCOUNT_NAME:'Test',BANK_ACCOUNT_NUMBER:'Test',BANK_BRANCH:'Test',CONTACT_EMAIL:'test@example.com'}}));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try {
    const origin=`http://127.0.0.1:${server.address().port}`;
    const config=await (await fetch(origin+'/api/config')).json();assert.equal(config.enabled,false);assert.equal(config.bank,null);
    const summary=await (await fetch(origin+'/api/summary')).json();assert.equal(summary.preview,true);assert.equal(summary.amount,0);
    for(const path of ['/api/admin/login','/api/donations']) {const r=await fetch(origin+path,{method:'POST',headers:{Origin:'https://harithayu.example','Content-Type':'application/json'},body:'{}'});assert.equal(r.status,503);}
  } finally {await new Promise(r=>server.close(r));}
});
