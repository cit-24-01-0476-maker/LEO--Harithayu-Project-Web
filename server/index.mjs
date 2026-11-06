import http from 'node:http';
import { resolve } from 'node:path';
import { createHandler } from './service.mjs';
const port=Number(process.env.PORT || 3000);
const store=process.env.TURSO_DATABASE_URL
  ? await (await import('./turso-store.mjs')).createTursoStore(process.env)
  : (await import('./store.mjs')).createStore(process.env.DB_PATH || resolve('data/harithayu.sqlite'));
const server=http.createServer(createHandler({store}));
server.listen(port,process.env.HOST || '127.0.0.1',()=>console.log('Harithayu is ready at '+(process.env.PUBLIC_ORIGIN || 'http://localhost:'+port)));
process.on('SIGTERM',()=>server.close(()=>{store.close();process.exit(0);}));
