import { upload } from '@vercel/blob/client';
export async function uploadPrivateProof(file,onProgress){
  const r=await fetch('/api/slip-upload-ticket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mime:file.type,size:file.size})});
  const claim=await r.json();if(!r.ok)throw Error(claim.error||'Unable to start private upload.');
  await upload(claim.path,file,{access:'private',contentType:file.type,handleUploadUrl:'/api/slip-upload',clientPayload:JSON.stringify(claim),multipart:true,onUploadProgress:onProgress});
  return claim;
}
