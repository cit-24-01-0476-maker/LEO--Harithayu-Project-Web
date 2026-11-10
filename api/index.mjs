import {waitUntil} from '@vercel/functions';
import { createHandler } from '../server/service.mjs';
import { createGoogleBridge } from '../server/google-bridge.mjs';
let handler;
export default async function vercelHandler(req,res) {
  try {
    if(!handler) {
      const store=process.env.DATABASE_URL
        ? await (await import('../server/neon-store.mjs')).createNeonStore(process.env)
        : process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN
        ? await (await import('../server/turso-store.mjs')).createTursoStore(process.env)
        : null;
      const cutoff=process.env.ARCHIVE_DONATIONS_BEFORE;
      if(store&&cutoff){
        if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(cutoff))throw Error('Invalid archive cutoff');
        const archived=await store.archiveBefore(cutoff),bridge=createGoogleBridge(process.env);
        if(bridge)for(const d of archived){try{await bridge({id:d.id,name:d.name,email:d.email,amount:d.amount,reference:d.reference,publicName:d.public_name===1,createdAt:d.created_at,status:'rejected'});}catch{console.error('Archived donation Google status needs a retry.');}}
      }
      handler=createHandler({store,background:task=>waitUntil(task)});
    }
    const routed=new URL(req.url,'https://localhost'),route=routed.searchParams.get('route');
    if(route!==null){routed.searchParams.delete('route');req.url='/api/'+route.replace(/^\/+/, '')+(routed.searchParams.size?'?'+routed.searchParams.toString():'');}
    return handler(req,res);
  } catch {
    res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({error:'The database connection is unavailable. Contributions remain closed.'}));
  }
}

