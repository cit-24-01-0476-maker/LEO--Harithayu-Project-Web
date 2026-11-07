import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleBridge} from '../server/google-bridge.mjs';
test('Google sync is optional and requires an authenticated matching acknowledgement',async()=>{
 assert.equal(createGoogleBridge({}),null);assert.throws(()=>createGoogleBridge({GOOGLE_BRIDGE_URL:'https://evil.example/exec',GOOGLE_BRIDGE_SECRET:'x'.repeat(40)}));
 const env={GOOGLE_BRIDGE_URL:'https://script.google.com/macros/s/test/exec',GOOGLE_BRIDGE_SECRET:'s'.repeat(40)};
 const donation={id:'a'.repeat(24),name:'Test',amount:100,publicName:true,receipt:{phone:'0771234567',mime:'image/png',data:'private'}};
 const bridge=createGoogleBridge(env,async(url,opts)=>{assert.equal(url.hostname,'script.google.com');const sent=JSON.parse(opts.body);assert.equal(sent.secret,env.GOOGLE_BRIDGE_SECRET);assert.equal(sent.phone,donation.receipt.phone);assert.equal(sent.status,'pending');return Response.json({ok:true,id:donation.id});});
 assert.deepEqual(await bridge(donation),{synced:true});
 await assert.rejects(createGoogleBridge(env,async()=>Response.json({ok:true,id:'wrong'}))(donation),/not acknowledged/);
 await assert.rejects(createGoogleBridge(env,async()=>Response.json({ok:false}))(donation),/not acknowledged/);
});
