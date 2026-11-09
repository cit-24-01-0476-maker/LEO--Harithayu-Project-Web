import { createHandler } from '../server/service.mjs';
let handler;
export default async function vercelHandler(req,res) {
  try {
    if(!handler) {
      const store=process.env.DATABASE_URL
        ? await (await import('../server/neon-store.mjs')).createNeonStore(process.env)
        : process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN
        ? await (await import('../server/turso-store.mjs')).createTursoStore(process.env)
        : null;
      handler=createHandler({store});
    }
    const route=new URL(req.url,'https://localhost').searchParams.get('route');
    if(route!==null)req.url='/api/'+route.replace(/^\/+/, '');
    return handler(req,res);
  } catch {
    res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({error:'The database connection is unavailable. Contributions remain closed.'}));
  }
}
