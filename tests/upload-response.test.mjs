import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../server/service.mjs';

test('a slow Google sync does not hold the saved donation response open',async()=>{
  const originalFetch=globalThis.fetch;
  let finishSync,inserted,response,job;
  globalThis.fetch=()=>new Promise(resolve=>{finishSync=()=>resolve(Response.json({ok:true,id:inserted.id}));});
  try{
    const handler=createHandler({
      env:{PUBLIC_ORIGIN:'https://example.test',DONATIONS_ENABLED:'true',AUTO_ACCEPT_SUBMISSIONS:'true',ADMIN_PASSWORD:'test-password-long-enough',CONTACT_EMAIL:'test@example.test',GOOGLE_BRIDGE_URL:'https://script.google.com/macros/s/test/exec',GOOGLE_BRIDGE_SECRET:'s'.repeat(40)},
      store:{allowRate:async()=>true,insert:async d=>{inserted=d;}},
      background:task=>{job=task;}
    });
    const req={url:'/api/slip-donations',method:'POST',headers:{origin:'https://example.test'},socket:{remoteAddress:'127.0.0.1'},body:{name:'Test Donor',phone:'0770000000',amount:100,reference:'TEST-UPLOAD',slip:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII='}};
    const res={setHeader(){},writeHead(status){this.status=status;},end(value){response=JSON.parse(value);}};
    await handler(req,res);
    assert.equal(res.status,201);assert.equal(response.id,inserted.id);assert.equal(response.sheetSync,'pending');assert.ok(job);
    finishSync();await job;
  }finally{globalThis.fetch=originalFetch;}
});

