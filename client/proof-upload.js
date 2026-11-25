import { upload } from '@vercel/blob/client';
export async function uploadPrivateProof(file,onProgress){
  const r=await fetch('/api/slip-upload-ticket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mime:file.type,size:file.size}),signal:AbortSignal.timeout(25000)});
  const claim=await r.json();if(!r.ok)throw Error(claim.error||'Unable to start private upload.');
  const controller=new AbortController();
  let stalled;const touch=()=>{clearTimeout(stalled);stalled=setTimeout(()=>controller.abort(),90000);};
  const deadline=setTimeout(()=>controller.abort(),10*60*1000);touch();
  try{
    await upload(claim.path,file,{access:'private',contentType:file.type,handleUploadUrl:'/api/slip-upload',clientPayload:JSON.stringify(claim),multipart:file.size>5*1024*1024,abortSignal:controller.signal,onUploadProgress:progress=>{touch();onProgress?.(progress);}});
    return claim;
  }catch(error){
    if(controller.signal.aborted)throw Error('Upload connection timed out. Your form is still filled in. Check your connection and try again.');
    throw error;
  }finally{clearTimeout(stalled);clearTimeout(deadline);}
}
