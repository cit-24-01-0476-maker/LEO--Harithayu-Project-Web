import { neon } from '@neondatabase/serverless';

// All values use query parameters. Slips and donor contact details stay server-side.
export async function createNeonStore(env, client) {
  const sql=client || neon(env.DATABASE_URL);
  await sql.transaction([
    sql.query(`CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY, token TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount BETWEEN 100 AND 1000000), reference TEXT NOT NULL UNIQUE,
      public_name INTEGER NOT NULL DEFAULT 0 CHECK(public_name IN (0,1)),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected')),
      created_at TEXT NOT NULL, confirmed_at TEXT)`),
    sql.query(`CREATE TABLE IF NOT EXISTS donation_receipts (
      donation_id TEXT PRIMARY KEY REFERENCES donations(id) ON DELETE CASCADE,
      phone TEXT NOT NULL, mime TEXT NOT NULL, data TEXT NOT NULL)`),
    sql.query('CREATE TABLE IF NOT EXISTS admin_sessions (id TEXT PRIMARY KEY, expires BIGINT NOT NULL)'),
    sql.query('CREATE TABLE IF NOT EXISTS rate_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires BIGINT NOT NULL)')
  ]);
  return {
    async insert(d) {
      try {
        const queries=[sql.query('INSERT INTO donations (id,token,name,email,amount,reference,public_name,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',[d.id,d.token,d.name,d.email,d.amount,d.reference,d.publicName?1:0,d.createdAt])];
        if(d.receipt)queries.push(sql.query('INSERT INTO donation_receipts (donation_id,phone,mime,data) VALUES ($1,$2,$3,$4)',[d.id,d.receipt.phone,d.receipt.mime,d.receipt.data]));
        await sql.transaction(queries);
      } catch(error) {if(error.code==='23505')throw Error('UNIQUE transfer reference');throw error;}
    },
    async receipt(id) {return (await sql.query('SELECT phone,mime,data FROM donation_receipts WHERE donation_id=$1',[id]))[0];},
    async find(id) {return (await sql.query('SELECT * FROM donations WHERE id=$1',[id]))[0];},
    async confirm(id,status) {return (await sql.query("UPDATE donations SET status=$1,confirmed_at=$2 WHERE id=$3 AND status='pending' RETURNING id",[status,status==='confirmed'?new Date().toISOString():null,id])).length;},
    async pending() {return sql.query('SELECT d.id,name,email,amount,reference,status,created_at,r.phone,CASE WHEN r.donation_id IS NULL THEN 0 ELSE 1 END has_slip FROM donations d LEFT JOIN donation_receipts r ON r.donation_id=d.id ORDER BY created_at DESC LIMIT 200');},
    async summary() {
      const [totals,donors]=await sql.transaction([
        sql.query("SELECT COALESCE(SUM(amount),0)::integer amount,COUNT(*)::integer contributions FROM donations WHERE status='confirmed'"),
        sql.query("SELECT id,CASE WHEN public_name=1 THEN name ELSE 'Anonymous' END name,amount,confirmed_at FROM donations WHERE status='confirmed' ORDER BY confirmed_at DESC LIMIT 50")
      ],{isolationLevel:'RepeatableRead',readOnly:true});
      return {...totals[0],seedlings:Math.floor(totals[0].amount/100),target:500,donors};
    },
    async createSession(id,expires) {await sql.transaction([sql.query('DELETE FROM admin_sessions WHERE expires<$1',[Date.now()]),sql.query('INSERT INTO admin_sessions (id,expires) VALUES ($1,$2)',[id,expires])]);},
    async sessionValid(id,now) {return Boolean((await sql.query('SELECT id FROM admin_sessions WHERE id=$1 AND expires>$2',[id,now])).length);},
    async deleteSession(id) {await sql.query('DELETE FROM admin_sessions WHERE id=$1',[id]);},
    async allowRate(id,max,now) {
      const [row]=await sql.query(`INSERT INTO rate_limits (id,count,expires) VALUES ($1,1,$2)
        ON CONFLICT(id) DO UPDATE SET count=CASE WHEN rate_limits.expires<$3 THEN 1 ELSE rate_limits.count+1 END,
        expires=CASE WHEN rate_limits.expires<$3 THEN $2 ELSE rate_limits.expires END RETURNING count`,[id,now+600000,now]);
      return row.count<=max;
    },
    close() {}
  };
}
