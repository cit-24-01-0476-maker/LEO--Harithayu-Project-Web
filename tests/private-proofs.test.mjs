import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateProofs,MAX_PROOF_BYTES } from '../server/private-proofs.mjs';
import { createGoogleBridge } from '../server/google-bridge.mjs';

const env={BLOB_READ_WRITE_TOKEN:'test-only',ADMIN_PASSWORD:'a-long-test-only-password'};
test('100 MB private uploads enforce signed paths, expiry, MIME and server-side size limits',async()=>{
  let size=MAX_PROOF_BYTES,seen;
  const sdk={
    async head(path){return {pathname:path,contentType:'image/png',size};},
    async get(){return {statusCode:200,stream:new ReadableStream({start(c){c.enqueue(new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0]));c.close();}})};},
    async handleUpload(options){seen=await options.onBeforeGenerateToken(options.body.path,options.body.payload,true);return {type:'blob.generate-client-token'};}
  };
  const proofs=createPrivateProofs(env,sdk),claim=proofs.ticket('image/png',MAX_PROOF_BYTES);
  const pdfClaim=proofs.ticket('application/pdf',1000);
  assert.ok(pdfClaim.path.endsWith('.pdf'));
  assert.throws(()=>proofs.ticket('image/png',MAX_PROOF_BYTES+1));assert.throws(()=>proofs.ticket('text/html',100));
  await proofs.handle({}, {path:claim.path,payload:JSON.stringify(claim)});
  assert.equal(seen.maximumSizeInBytes,104857600);assert.equal(seen.allowOverwrite,false);
  const receipt=await proofs.verify(claim,'0770000000');assert.equal(receipt.data,'blob:'+claim.path);assert.equal(receipt.mime,'image/png');
  await assert.rejects(proofs.verify({...claim,path:claim.path.replace('slips/','other/')},''));
  await assert.rejects(proofs.verify({...claim,signature:'0'.repeat(64)},''));
  await assert.rejects(proofs.verify({...claim,expires:Date.now()-1},''));
  size=MAX_PROOF_BYTES+1;await assert.rejects(proofs.verify(claim,''));
});

test('large proof Google sync sends only an authenticated admin link and requires acknowledgement',async()=>{
  let payload;
  const settings={GOOGLE_BRIDGE_URL:'https://script.google.com/macros/s/test/exec',GOOGLE_BRIDGE_SECRET:'x'.repeat(48),PUBLIC_ORIGIN:'https://leo-harithayu.vercel.app'};
  const donation={id:'a'.repeat(24),name:'Test',amount:100,receipt:{phone:'0770000000',mime:'image/png',data:'blob:slips/private.png'}};
  const bridge=createGoogleBridge(settings,async(url,options)=>{payload=JSON.parse(options.body);return Response.json({ok:true,id:donation.id,proofLinkStored:true});});
  await bridge(donation);assert.equal(payload.receipt,undefined);assert.equal(payload.receiptLink,'https://leo-harithayu.vercel.app/admin?slip='+donation.id);assert.equal(payload.phone,'0770000000');assert.ok(!JSON.stringify(payload).includes('blob:'));
  const oldBridge=createGoogleBridge(settings,async()=>Response.json({ok:true,id:donation.id}));await assert.rejects(oldBridge(donation),/private proof link update/);
});
