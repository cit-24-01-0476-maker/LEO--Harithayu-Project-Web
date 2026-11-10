import {PUSH_SCHEMA,createPushStore} from './push-store.mjs';
import {ANALYTICS_SCHEMA,createAnalyticsStore} from './analytics-store.mjs';
// Turso's public SQL-over-HTTP protocol. No database driver is required.
// https://github.com/tursodatabase/turso/blob/main/serverless/PROTOCOL.md
export function createSqlClient(env,fetcher=fetch) {
  const raw=env.TURSO_DATABASE_URL?.replace(/^libsql:/,'https:');
  if(!raw || !env.TURSO_AUTH_TOKEN)throw Error('Both Turso database URL and token are required.');
  const url=new URL(raw);
  if(url.protocol!=='https:' || !url.hostname.endsWith('.turso.io') || url.username || url.password)throw Error('Use an HTTPS Turso database hostname.');
  return async function execute(sql,args=[]) {
    const value=v=>v===null?{type:'null'}:typeof v==='number'?{type:'integer',value:String(v)}:{type:'text',value:String(v)};
    const r=await fetcher(new URL('/v2/pipeline',url),{method:'POST',headers:{Authorization:`Bearer ${env.TURSO_AUTH_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({requests:[{type:'execute',stmt:{sql,args:args.map(value),want_rows:true}},{type:'close'}]}),signal:AbortSignal.timeout(12000)});
    if(!r.ok)throw Error(`Database service unavailable (${r.status}).`);
    const data=await r.json(),first=data.results?.[0];
    if(first?.type!=='ok')throw Error(first?.error?.message || 'Database query failed.');
    const result=first.response.result;
    const decode=v=>v.type==='null'?null:v.type==='integer'||v.type==='float'?Number(v.value):v.value;
    return {rows:(result.rows || []).map(row=>Object.fromEntries(result.cols.map((c,i)=>[c.name,decode(row[i])]))),changes:result.affected_row_count || 0};
  };
}

export async function createTursoStore(env,fetcher) {
  const sql=createSqlClient(env,fetcher);
  await sql("CREATE TABLE IF NOT EXISTS donation_receipts (donation_id TEXT PRIMARY KEY REFERENCES donations(id), phone TEXT NOT NULL, mime TEXT NOT NULL, data TEXT NOT NULL)");
  const columns=(await sql('PRAGMA table_info(donations)')).rows.map(c=>c.name);
  if(!columns.includes('auto_accepted'))await sql('ALTER TABLE donations ADD COLUMN auto_accepted INTEGER NOT NULL DEFAULT 0');
  if(!columns.includes('archived_at'))await sql('ALTER TABLE donations ADD COLUMN archived_at TEXT');
  if(!columns.includes('audit_json'))await sql("ALTER TABLE donations ADD COLUMN audit_json TEXT NOT NULL DEFAULT '{}'");
  for(const text of ANALYTICS_SCHEMA)await sql(text);
  const analytics=createAnalyticsStore(async(text,args)=>(await sql(text,args)).rows,async statements=>{for(const [text,args] of statements)await sql(text,args);});
  for(const statement of PUSH_SCHEMA)await sql(statement);
  const push=createPushStore(async(text,args)=>(await sql(text,args)).rows,async statements=>{for(const [text,args] of statements)await sql(text,args);});
  return {
    ...analytics,
    ...push,
    async archiveBefore(cutoff){const rows=(await sql('SELECT * FROM donations WHERE archived_at IS NULL AND created_at<=?',[cutoff])).rows;await sql('UPDATE donations SET archived_at=? WHERE archived_at IS NULL AND created_at<=?',[cutoff,cutoff]);return rows;},
    async insert(d) {if(d.receipt){await sql("INSERT INTO donations (id,token,name,email,amount,reference,public_name,created_at,status,auto_accepted,confirmed_at,audit_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",[d.id,d.token,d.name,d.email,d.amount,d.reference,d.publicName?1:0,d.createdAt,d.autoAccepted?'confirmed':'pending',d.autoAccepted?1:0,d.autoAccepted?d.createdAt:null,JSON.stringify(d.requestDetails||{})]);try{await sql('INSERT INTO donation_receipts (donation_id,phone,mime,data) VALUES (?,?,?,?)',[d.id,d.receipt.phone,d.receipt.mime,d.receipt.data]);}catch(e){await sql("DELETE FROM donations WHERE id=?",[d.id]);throw e;}return;}return sql('INSERT INTO donations (id,token,name,email,amount,reference,public_name,created_at,status,auto_accepted,confirmed_at,audit_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[d.id,d.token,d.name,d.email,d.amount,d.reference,d.publicName?1:0,d.createdAt,d.autoAccepted?'confirmed':'pending',d.autoAccepted?1:0,d.autoAccepted?d.createdAt:null,JSON.stringify(d.requestDetails||{})]);},
    async receipt(id) {return (await sql('SELECT phone,mime,data FROM donation_receipts WHERE donation_id=?',[id])).rows[0];},
    async find(id) {return (await sql('SELECT * FROM donations WHERE id=?',[id])).rows[0];},
    async confirm(id,status) {return (await sql("UPDATE donations SET status=?,confirmed_at=? WHERE id=? AND status='pending' AND archived_at IS NULL",[status,status==='confirmed'?new Date().toISOString():null,id])).changes;},
    async pending() {return (await sql('SELECT d.id,name,email,amount,reference,status,created_at,r.phone,CASE WHEN r.donation_id IS NULL THEN 0 ELSE 1 END has_slip FROM donations d LEFT JOIN donation_receipts r ON r.donation_id=d.id WHERE d.archived_at IS NULL ORDER BY created_at DESC LIMIT 200')).rows;},
    async summary() {
      const totals=(await sql("SELECT COALESCE(SUM(amount),0) amount,COUNT(*) contributions FROM donations WHERE status='confirmed' AND archived_at IS NULL")).rows[0];
      const donors=(await sql("SELECT id,CASE WHEN public_name=1 THEN name ELSE 'Anonymous' END name,amount,confirmed_at,auto_accepted FROM donations WHERE status='confirmed' AND archived_at IS NULL ORDER BY confirmed_at DESC,id DESC")).rows;
      return {amount:totals.amount,contributions:totals.contributions,seedlings:Math.floor(totals.amount/100),target:500,donors};
    },
    async createSession(id,expires) {await sql('DELETE FROM admin_sessions WHERE expires<?',[Date.now()]);await sql('INSERT INTO admin_sessions (id,expires) VALUES (?,?)',[id,expires]);},
    async sessionValid(id,now) {return Boolean((await sql('SELECT id FROM admin_sessions WHERE id=? AND expires>?',[id,now])).rows.length);},
    deleteSession(id) {return sql('DELETE FROM admin_sessions WHERE id=?',[id]);},
    async allowRate(id,max,now) {
      await sql('DELETE FROM rate_limits WHERE expires<?',[now]);
      const result=await sql('INSERT INTO rate_limits (id,count,expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count',[id,now+600000]);
      return result.rows[0].count<=max;
    },
    close() {}
  };
}


