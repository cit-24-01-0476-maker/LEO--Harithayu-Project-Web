import {createPushService} from './push-service.mjs';
import { createGoogleBridge } from './google-bridge.mjs';
import { createPrivateProofs,MAX_PROOF_BYTES } from './private-proofs.mjs';
import { requestDetails } from './request-details.mjs';
import { presentDonation } from './admin-report.mjs';
import { readFile } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function createHandler({store,env=process.env,proofs=createPrivateProofs(env),background=task=>task.catch(()=>{})}) {
const port=Number(env.PORT || 3000);
const googleBridge=createGoogleBridge(env);
const autoAccept=env.AUTO_ACCEPT_SUBMISSIONS==='true';
const push=createPushService(store,env);
function drainPush(){if(push)background(push.drain().catch(()=>{console.error('Push delivery retry pending.');}));}
async function syncStoredDonation(id){const d=await store.find(id);if(!d)return false;const receipt=await store.receipt(d.id);await googleBridge({id:d.id,name:d.name,email:d.email,amount:d.amount,reference:d.reference,publicName:d.public_name===1,createdAt:d.created_at,status:d.status,autoAccepted:d.auto_accepted===1,receipt:receipt||null});return true;}
const origin=env.PUBLIC_ORIGIN || (env.VERCEL_PROJECT_PRODUCTION_URL?`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`:`http://localhost:${port}`);
const defaultBank={ name:'Bank of Ceylon (BOC) - Padukka', accountName:'Leo Club of Sri Lanka Technology Campus', accountNumber:'80824610', branch:'Padukka (Branch Code: 678)' };
const bank={ name:env.BANK_NAME || defaultBank.name, accountName:env.BANK_ACCOUNT_NAME || defaultBank.accountName, accountNumber:env.BANK_ACCOUNT_NUMBER || defaultBank.accountNumber, branch:env.BANK_BRANCH || defaultBank.branch };
const enabled=Boolean(store) && env.DONATIONS_ENABLED==='true' && Object.values(bank).every(Boolean) && Boolean(env.CONTACT_EMAIL) && (env.ADMIN_PASSWORD || '').length>=16;
const equal=(a,b)=>{ const x=Buffer.from(String(a || '')),y=Buffer.from(String(b || '')); return x.length===y.length && timingSafeEqual(x,y); };
function json(res,status,data) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); }
async function body(req) { if(req.body!==undefined){const value=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(Buffer.byteLength(value)>1500000)throw new Error('Request too large');return JSON.parse(value);}let data=''; for await (const chunk of req) { data+=chunk; if(Buffer.byteLength(data)>1500000) throw new Error('Request too large'); } return JSON.parse(data || '{}'); }
async function rate(req,key,max) {return store.allowRate(`${key}:${req.headers['x-vercel-forwarded-for'] || req.socket.remoteAddress}`,max,Date.now());}
async function admin(req) { const sid=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('harithayu_admin='))?.slice(16); return Boolean(sid && store && await store.sessionValid(sid,Date.now())); }
const mime={'.mp3':'audio/mpeg','.mp4':'video/mp4','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
return async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self' https://blob.vercel-storage.com https://*.blob.vercel-storage.com; media-src 'self' https:; frame-src https://www.youtube-nocookie.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  try {
    const url=new URL(req.url,origin), path=url.pathname;
    // Private Google migration channel: shared-secret header, never a public receipt URL.
    if(path==='/api/integrations/drive-proofs'&&req.method==='GET'){
      if(!env.GOOGLE_BRIDGE_SECRET||!equal(req.headers['x-harithayu-bridge'],env.GOOGLE_BRIDGE_SECRET))return json(res,401,{error:'Unauthorized'});
      if(!store)return json(res,503,{error:'Storage unavailable'});
      const id=url.searchParams.get('id');
      if(!id){const offset=Number(url.searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0)return json(res,400,{error:'Invalid offset'});
        const all=(await store.adminDetails()).filter(d=>Number(d.has_slip));return json(res,200,{donations:all.slice(offset,offset+25).map(d=>({id:d.id,name:d.name})),next:offset+25<all.length?offset+25:null,total:all.length});}
      if(!/^[a-f0-9]{24}$/.test(id))return json(res,400,{error:'Invalid donation'});
      const offset=Number(url.searchParams.get('offset')||0),length=3*1024*1024;
      if(!Number.isSafeInteger(offset)||offset<0||offset>MAX_PROOF_BYTES)return json(res,400,{error:'Invalid offset'});
      const slip=await store.receipt(id);if(!slip)return json(res,404,{error:'Proof not found'});
      const part=slip.data.startsWith('blob:')?await proofs.chunk(slip.data.slice(5),offset,length):(()=>{const all=Buffer.from(slip.data,'base64');return {bytes:all.subarray(offset,offset+length),total:all.length,mime:slip.mime};})();
      res.writeHead(200,{'Content-Type':part.mime,'Content-Length':part.bytes.length,'X-Proof-Total-Bytes':part.total,'Cache-Control':'private, no-store'});return res.end(part.bytes);
    }
    if(path==='/api/push/config'&&req.method==='GET')return json(res,200,{enabled:Boolean(push),publicKey:push?await push.publicKey():null});
    if(path==='/api/slip-upload'&&req.method==='POST'){
      if(!enabled||!proofs)return json(res,503,{error:'Private uploads are not available.'});
      const input=await body(req);
      if(input.type!=='blob.upload-completed'){
        if(req.headers.origin!==origin)return json(res,403,{error:'Request origin is not allowed.'});
        if(!await rate(req,'upload',4))return json(res,429,{error:'Too many uploads. Please try again later.'});
      }
      try{return json(res,200,await proofs.handle(req,input));}catch{return json(res,400,{error:'Upload permission could not be verified.'});}
    }
    if(['POST','PUT','DELETE'].includes(req.method) && req.headers.origin!==origin) return json(res,403,{error:'Request origin is not allowed.'});
    if(['/api/push/subscribe','/api/push/unsubscribe'].includes(path)&&req.method==='POST'){
      if(!push)return json(res,503,{error:'Notifications are temporarily unavailable.'});
      if(!await rate(req,'push',20))return json(res,429,{error:'Please try again later.'});
      const input=await body(req);try{if(path.endsWith('/unsubscribe'))await push.unsubscribe(input.subscription);else await push.subscribe(input.subscription,input.language);}catch{return json(res,400,{error:'A valid browser push subscription is required.'});}
      drainPush();return json(res,200,{ok:true});
    }
    if(path==='/api/visit'&&req.method==='POST'){
      if(!store?.recordVisit)return json(res,503,{error:'Visitor statistics unavailable.'});
      if(!await rate(req,'visitor',300))return json(res,429,{error:'Please try later.'});
      const input=await body(req),uuid=/^[a-f0-9-]{36}$/i;
      if(!uuid.test(input.visitorId||'')||!uuid.test(input.pageId||'')||input.path!=='/')return json(res,400,{error:'Invalid visitor session.'});
      await store.recordVisit({...requestDetails(req,env,input.privacyOptOut===true),visitorId:input.visitorId,pageId:input.pageId,path:'/',now:Date.now()});
      drainPush();return json(res,200,await store.trafficSummary());
    }
    if(path==='/api/config' && req.method==='GET') return json(res,200,{enabled,autoAccept,bank:enabled?bank:null,maxSlipBytes:proofs?MAX_PROOF_BYTES:1048576,contactEmail:env.CONTACT_EMAIL || '',contactPhone:env.CONTACT_PHONE || '',videoUrl:/^https:\/\//.test(env.PROJECT_VIDEO_URL || '')?env.PROJECT_VIDEO_URL:null,price:100,target:500});
    if(path==='/api/slip-upload-ticket'&&req.method==='POST'){
      if(!enabled||!proofs)return json(res,503,{error:'Private uploads are not available.'});
      if(!await rate(req,'upload-ticket',4))return json(res,429,{error:'Too many uploads. Please try again later.'});
      const input=await body(req);try{return json(res,200,proofs.ticket(input.mime,input.size));}catch(e){return json(res,400,{error:e.message});}
    }
    if(path==='/api/summary' && req.method==='GET') return json(res,200,store?await store.summary():{amount:0,seedlings:0,contributions:0,target:500,donors:[],preview:true});
    if(['/api/donations','/api/slip-donations'].includes(path) && req.method==='POST') {
      if(!enabled) return json(res,503,{error:'Contributions have not opened yet. Please try the clearly marked preview.'});
      if(!await rate(req,'donation',8)) return json(res,429,{error:'Too many submissions. Please try again later.'});
      const d=await body(req);
      const name=String(d.name || '').trim(),email=String(d.email || '').trim(),reference=String(d.reference || '').trim();
      if(name.length<2 || name.length>100 || email.length>254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || !Number.isSafeInteger(d.amount) || d.amount<100 || d.amount>1000000 || reference.length<3 || reference.length>100 || d.consent!==true) return json(res,400,{error:'Please check your name, email, amount, transfer reference and consent.'});
      let receipt=null;
      if(path==='/api/slip-donations') {
        const phone=String(d.phone||'').trim();
        if(d.receiptBlob){
          if(!proofs||!(/^[+0-9 ()-]{9,25}$/).test(phone))return json(res,400,{error:'Enter a valid phone number.'});
          try{receipt=await proofs.verify(d.receiptBlob,phone);}catch(e){return json(res,400,{error:e.message});}
        }else{
        const match=/^data:(image\/(?:png|jpeg)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(d.slip||'');
        if(!/^[+0-9 ()-]{9,25}$/.test(phone)||!match)return json(res,400,{error:'Enter a valid phone number and upload a JPEG, PNG or PDF bank slip.'});
        const mimeType=match[1];
        const bytes=Buffer.from(match[2],'base64');
        let valid=false;
        if(mimeType==='image/png')valid=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
        else if(mimeType==='image/jpeg')valid=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
        else if(mimeType==='application/pdf')valid=bytes.subarray(0,4).toString()==='%PDF';
        if(!valid||bytes.length>1048576||bytes.length<20)return json(res,400,{error:'Upload a valid JPEG, PNG or PDF slip, up to 1 MB.'});
        receipt={phone,mime:mimeType,data:match[2]};
        }
      }
      if(autoAccept&&!receipt)return json(res,400,{error:'Upload your proof before submitting a donation.'});
      const donation={id:randomBytes(12).toString('hex'),token:randomBytes(24).toString('hex'),name,email,amount:d.amount,reference,publicName:d.publicName===true,createdAt:new Date().toISOString(),receipt};
      donation.autoAccepted=autoAccept;donation.status=autoAccept?'confirmed':'pending';
      donation.requestDetails=requestDetails(req,env);
      try {await store.insert(donation);} catch(e) {if(e.message.includes('UNIQUE')) return json(res,409,{error:'This transfer reference was already submitted. Please contact the club if you need help.'}); throw e;}
      if(push&&donation.autoAccepted){try{await push.enqueue(donation);drainPush();}catch{console.error('Donation notification queue unavailable.');}}
      let sheetSync='not-configured';if(googleBridge){try{await googleBridge(donation);sheetSync='synced';}catch{sheetSync='pending';console.error('Google donation sync needs an admin retry.');}}
      return json(res,201,{id:donation.id,token:donation.token,status:autoAccept?'accepted':'pending',sheetSync});
    }
    if(path.startsWith('/api/donations/') && req.method==='GET') {
      const d=store?await store.find(path.split('/').pop()):null;
      if(!d || d.archived_at || !equal(req.headers.authorization,`Bearer ${d.token}`)) return json(res,404,{error:'Contribution not found.'});
      return json(res,200,{id:d.id,status:d.status==='confirmed'&&d.auto_accepted===1?'accepted':d.status,amount:d.amount});
    }
    if(path==='/api/admin/login' && req.method==='POST') {
      if(!store)return json(res,503,{error:'Connect the persistent database before enabling administration.'});
      if(!await rate(req,'login',5)) return json(res,429,{error:'Please wait ten minutes before trying again.'});
      if(!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length<16) return json(res,503,{error:'Set ADMIN_PASSWORD to at least 16 characters on the server first.'});
      const d=await body(req); if(!equal(d.password,env.ADMIN_PASSWORD)) return json(res,401,{error:'Incorrect password.'});
      const sid=randomBytes(32).toString('hex'); await store.createSession(sid,Date.now()+3600000);
      res.setHeader('Set-Cookie',`harithayu_admin=${sid}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=3600${origin.startsWith('https:')?'; Secure':''}`);
      return json(res,200,{ok:true});
    }
    if(path.startsWith('/api/admin/')) {
      if(!await admin(req)) return json(res,401,{error:'Please sign in.'});
      if(path==='/api/admin/logout' && req.method==='POST') { const sid=req.headers.cookie?.match(/harithayu_admin=([^;]+)/)?.[1]; await store.deleteSession(sid); res.setHeader('Set-Cookie','harithayu_admin=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0'); return json(res,200,{ok:true}); }
      if(path.startsWith('/api/admin/slips/') && req.method==='GET') {
        const slip=await store.receipt(path.split('/').pop());
        if(!slip)return json(res,404,{error:'Slip not found.'});
        if(slip.data.startsWith('blob:')){if(!proofs||!await proofs.stream(slip.data.slice(5),res))return json(res,404,{error:'Slip not found.'});return;}
        res.writeHead(200,{'Content-Type':slip.mime,'Content-Disposition':'inline','Cache-Control':'no-store'});return res.end(Buffer.from(slip.data,'base64'));
      }
      if(path==='/api/admin/google-sync' && req.method==='POST') {
        if(!googleBridge)return json(res,503,{error:'Google sync is not configured.'});
        const input=await body(req);if(!await syncStoredDonation(input.id))return json(res,404,{error:'Contribution not found.'});
        return json(res,200,{ok:true});
      }
      if(path==='/api/admin/donations' && req.method==='GET') return json(res,200,{donations:await store.pending()});
      if(path==='/api/admin/dashboard'&&req.method==='GET'){
        const [donations,traffic,metrics]=await Promise.all([store.adminDetails(),store.trafficDetails(),store.trafficSummary()]);
        return json(res,200,{donations:donations.map(presentDonation),...traffic,metrics});
      }
      if(path==='/api/admin/export.xlsx'&&req.method==='GET'){
        const [donations,traffic]=await Promise.all([store.adminDetails(),store.trafficDetails()]);
        const bytes=await (await import('./admin-report.mjs')).createAdminReport(donations,traffic,origin);
        res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="Harithayu-admin-report.xlsx"','Cache-Control':'private, no-store'});return res.end(Buffer.from(bytes));
      }
      if(path==='/api/admin/review' && req.method==='POST') { const d=await body(req); if(!['confirmed','rejected'].includes(d.status)) return json(res,400,{error:'Invalid review.'}); const changed=await store.confirm(d.id,d.status); if(changed&&d.status==='confirmed'&&push){try{await push.enqueue(await store.find(d.id));drainPush();}catch{console.error('Donation notification queue unavailable.');}} if(changed&&googleBridge){try{await syncStoredDonation(d.id);}catch{console.error('Google review sync needs an admin retry.');}} return json(res,changed?200:409,{ok:Boolean(changed),error:changed?undefined:'Already reviewed or not found.'}); }
      return json(res,404,{error:'Not found.'});
    }
    if(path.startsWith('/api/')) return json(res,404,{error:'Not found.'});
    if(!['GET','HEAD'].includes(req.method)) return json(res,405,{error:'Method not allowed.'});
    const file=resolve(root,'public',path==='/'?'index.html':path==='/admin'?'admin.html':'.'+decodeURIComponent(path));
    if(!file.startsWith(resolve(root,'public')+'\\') && !file.startsWith(resolve(root,'public')+'/')) return json(res,403,{error:'Forbidden'});
    try { const bytes=await readFile(file); res.writeHead(200,{'Content-Type':mime[extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'}); res.end(req.method==='HEAD'?undefined:bytes); }
    catch {json(res,404,{error:'Not found.'});}
  } catch(e) { if(res.headersSent){res.destroy();return;}if(e instanceof SyntaxError || e.message==='Request too large') return json(res,400,{error:'Invalid request.'}); console.error('Request failed:',e.message); json(res,500,{error:'Something went wrong. Please try again.'}); }
};
}

