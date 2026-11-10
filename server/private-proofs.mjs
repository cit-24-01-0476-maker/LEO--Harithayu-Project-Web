import { createHmac,randomBytes,timingSafeEqual } from 'node:crypto';
import { head,get } from '@vercel/blob';
import { handleUpload } from '@vercel/blob/client';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const MAX_PROOF_BYTES=100*1024*1024;
export function createPrivateProofs(env,sdk={head,get,handleUpload}) {
  if(!env.BLOB_READ_WRITE_TOKEN || !env.ADMIN_PASSWORD)return null;
  const token=env.BLOB_READ_WRITE_TOKEN;
  const sign=value=>createHmac('sha256',env.ADMIN_PASSWORD).update('harithayu-proof-v1:'+value).digest('hex');
  function validate(claim){
    if(!claim||!/^slips\/[a-f0-9]{48}\.(png|jpg|pdf)$/.test(claim.path)||!Number.isSafeInteger(claim.expires)||claim.expires<Date.now()||claim.expires>Date.now()+3600000||!(/^[a-f0-9]{64}$/).test(claim.signature||''))throw Error('Upload permission expired or invalid. Please upload again.');
    const expected=sign(claim.path+':'+claim.expires);
    if(!timingSafeEqual(Buffer.from(expected),Buffer.from(claim.signature)))throw Error('Invalid upload permission.');
  }
  return {
    ticket(mime,size){
      if(!['image/png','image/jpeg','application/pdf'].includes(mime)||!Number.isSafeInteger(size)||size<20||size>MAX_PROOF_BYTES)throw Error('Choose a JPEG, PNG or PDF proof up to 100 MB.');
      const path='slips/'+randomBytes(24).toString('hex')+(mime==='image/png'?'.png':(mime==='application/pdf'?'.pdf':'.jpg')),expires=Date.now()+3599000;
      return {path,expires,signature:sign(path+':'+expires)};
    },
    handle(request,body){return sdk.handleUpload({token,request,body,onBeforeGenerateToken:async(path,payload)=>{
      const claim=JSON.parse(payload||'{}');validate(claim);if(path!==claim.path)throw Error('Upload path mismatch.');
      return {allowedContentTypes:['image/png','image/jpeg','application/pdf'],maximumSizeInBytes:MAX_PROOF_BYTES,validUntil:claim.expires,addRandomSuffix:false,allowOverwrite:false};
    }});},
    async verify(claim,phone){
      validate(claim);const metadata=await sdk.head(claim.path,{token});
      if(metadata.pathname!==claim.path||!['image/png','image/jpeg','application/pdf'].includes(metadata.contentType)||metadata.size<20||metadata.size>MAX_PROOF_BYTES)throw Error('Invalid proof file or file too large.');
      const partial=await sdk.get(claim.path,{access:'private',token,useCache:false,headers:{Range:'bytes=0-15'}});
      if(!partial||!partial.stream)throw Error('Proof upload could not be read.');
      const reader=partial.stream.getReader();let bytes=Buffer.alloc(0);
      try{while(bytes.length<8){const chunk=await reader.read();if(chunk.done)break;bytes=Buffer.concat([bytes,Buffer.from(chunk.value)]).subarray(0,16);}}finally{await reader.cancel();}
      let valid=false;
      if(metadata.contentType==='image/png')valid=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      else if(metadata.contentType==='image/jpeg')valid=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
      else if(metadata.contentType==='application/pdf')valid=bytes.subarray(0,4).toString()==='%PDF';
      if(!valid)throw Error('Upload a valid JPEG, PNG or PDF proof.');
      return {phone,mime:metadata.contentType,data:'blob:'+claim.path};
    },
    async stream(path,res){
      if(!/^slips\/[a-f0-9]{48}\.(png|jpg|pdf)$/.test(path))throw Error('Invalid private proof path.');
      const file=await sdk.get(path,{access:'private',token,useCache:false});
      if(!file||file.statusCode!==200)return false;
      res.writeHead(200,{'Content-Type':file.blob.contentType,'Content-Length':file.blob.size,'Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
      await pipeline(Readable.fromWeb(file.stream),res);return true;
    }
  };
}
