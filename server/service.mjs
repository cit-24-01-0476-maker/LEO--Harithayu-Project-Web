import { readFile } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function createHandler({store,env=process.env}) {
const port=Number(env.PORT || 3000);
const origin=env.PUBLIC_ORIGIN || (env.VERCEL_PROJECT_PRODUCTION_URL?`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`:`http://localhost:${port}`);
const bank={ name:env.BANK_NAME || '', accountName:env.BANK_ACCOUNT_NAME || '', accountNumber:env.BANK_ACCOUNT_NUMBER || '', branch:env.BANK_BRANCH || '' };
const enabled=Boolean(store) && env.DONATIONS_ENABLED==='true' && Object.values(bank).every(Boolean) && Boolean(env.CONTACT_EMAIL);
const equal=(a,b)=>{ const x=Buffer.from(String(a || '')),y=Buffer.from(String(b || '')); return x.length===y.length && timingSafeEqual(x,y); };
function json(res,status,data) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); }
async function body(req) { if(req.body!==undefined){const value=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(Buffer.byteLength(value)>8192)throw new Error('Request too large');return JSON.parse(value);}let data=''; for await (const chunk of req) { data+=chunk; if(Buffer.byteLength(data)>8192) throw new Error('Request too large'); } return JSON.parse(data || '{}'); }
async function rate(req,key,max) {return store.allowRate(`${key}:${req.headers['x-vercel-forwarded-for'] || req.socket.remoteAddress}`,max,Date.now());}
async function admin(req) { const sid=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('harithayu_admin='))?.slice(16); return Boolean(sid && store && await store.sessionValid(sid,Date.now())); }
const mime={'.mp4':'video/mp4','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
return async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; media-src 'self' https:; frame-src https://www.youtube-nocookie.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  try {
    const url=new URL(req.url,origin), path=url.pathname;
    if(['POST','PUT','DELETE'].includes(req.method) && req.headers.origin!==origin) return json(res,403,{error:'Request origin is not allowed.'});
    if(path==='/api/config' && req.method==='GET') return json(res,200,{enabled,bank:enabled?bank:null,contactEmail:env.CONTACT_EMAIL || '',contactPhone:env.CONTACT_PHONE || '',videoUrl:/^https:\/\//.test(env.PROJECT_VIDEO_URL || '')?env.PROJECT_VIDEO_URL:null,price:100,target:500});
    if(path==='/api/summary' && req.method==='GET') return json(res,200,store?await store.summary():{amount:0,seedlings:0,contributions:0,target:500,donors:[],preview:true});
    if(path==='/api/donations' && req.method==='POST') {
      if(!enabled) return json(res,503,{error:'Contributions have not opened yet. Please try the clearly marked preview.'});
      if(!await rate(req,'donation',8)) return json(res,429,{error:'Too many submissions. Please try again later.'});
      const d=await body(req);
      const name=String(d.name || '').trim(),email=String(d.email || '').trim(),reference=String(d.reference || '').trim();
      if(name.length<2 || name.length>100 || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !Number.isSafeInteger(d.amount) || d.amount<100 || d.amount>1000000 || reference.length<3 || reference.length>100 || d.consent!==true) return json(res,400,{error:'Please check your name, email, amount, transfer reference and consent.'});
      const donation={id:randomBytes(12).toString('hex'),token:randomBytes(24).toString('hex'),name,email,amount:d.amount,reference,publicName:d.publicName===true,createdAt:new Date().toISOString()};
      try {await store.insert(donation);} catch(e) {if(e.message.includes('UNIQUE')) return json(res,409,{error:'This transfer reference was already submitted. Please contact the club if you need help.'}); throw e;}
      return json(res,201,{id:donation.id,token:donation.token,status:'pending'});
    }
    if(path.startsWith('/api/donations/') && req.method==='GET') {
      const d=store?await store.find(path.split('/').pop()):null;
      if(!d || !equal(req.headers.authorization,`Bearer ${d.token}`)) return json(res,404,{error:'Contribution not found.'});
      return json(res,200,{id:d.id,status:d.status,amount:d.amount});
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
      if(path==='/api/admin/donations' && req.method==='GET') return json(res,200,{donations:await store.pending()});
      if(path==='/api/admin/review' && req.method==='POST') { const d=await body(req); if(!['confirmed','rejected'].includes(d.status)) return json(res,400,{error:'Invalid review.'}); const changed=await store.confirm(d.id,d.status); return json(res,changed?200:409,{ok:Boolean(changed),error:changed?undefined:'Already reviewed or not found.'}); }
      return json(res,404,{error:'Not found.'});
    }
    if(path.startsWith('/api/')) return json(res,404,{error:'Not found.'});
    if(!['GET','HEAD'].includes(req.method)) return json(res,405,{error:'Method not allowed.'});
    const file=resolve(root,'public',path==='/'?'index.html':path==='/admin'?'admin.html':'.'+decodeURIComponent(path));
    if(!file.startsWith(resolve(root,'public')+'\\') && !file.startsWith(resolve(root,'public')+'/')) return json(res,403,{error:'Forbidden'});
    try { const bytes=await readFile(file); res.writeHead(200,{'Content-Type':mime[extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'}); res.end(req.method==='HEAD'?undefined:bytes); }
    catch {json(res,404,{error:'Not found.'});}
  } catch(e) { if(e instanceof SyntaxError || e.message==='Request too large') return json(res,400,{error:'Invalid request.'}); console.error('Request failed:',e.message); json(res,500,{error:'Something went wrong. Please try again.'}); }
};
}
