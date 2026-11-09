export function createGoogleBridge(env,fetcher=fetch){
 const endpoint=env.GOOGLE_BRIDGE_URL,secret=env.GOOGLE_BRIDGE_SECRET;
 if(!endpoint&&!secret)return null;
 if(!endpoint||!secret||secret.length<32)throw Error('Google bridge configuration is incomplete.');
 const url=new URL(endpoint);
 if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)||url.search||url.username||url.password)throw Error('Use the deployed Google Apps Script exec URL.');
 return async function sync(d){
  const linked=d.receipt?.data?.startsWith('blob:');
  const receiptLink=linked?`${env.PUBLIC_ORIGIN||'https://leo-harithayu.vercel.app'}/admin?slip=${d.id}`:undefined;
  const response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret,id:d.id,name:d.name,email:d.email,phone:d.receipt?.phone||'',amount:d.amount,reference:d.reference,publicName:d.publicName===true,createdAt:d.createdAt,status:d.status||'pending',receipt:linked?undefined:d.receipt,receiptLink}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Google sync service unavailable.');
  const data=await response.json();if(data.ok!==true||data.id!==d.id)throw Error('Google sync was not acknowledged.');
  if(linked&&data.proofLinkStored!==true)throw Error('Google bridge needs the private proof link update.');
  return {synced:true};
 };
}
