import {createHash,randomBytes} from 'node:crypto';
export const PUSH_SCHEMA=[
 `CREATE TABLE IF NOT EXISTS push_settings (id TEXT PRIMARY KEY,public_key TEXT NOT NULL,private_key TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY,subscription TEXT NOT NULL,language TEXT NOT NULL,updated_at BIGINT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS push_deliveries (event_id TEXT NOT NULL,subscription_id TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_attempt BIGINT NOT NULL,updated_at BIGINT NOT NULL,expires_at BIGINT NOT NULL,claim TEXT,PRIMARY KEY(event_id,subscription_id))`,
 'CREATE INDEX IF NOT EXISTS push_delivery_pending ON push_deliveries(state,next_attempt)'
];
export const subscriptionId=endpoint=>createHash('sha256').update(endpoint).digest('hex');
export function createPushStore(query,batch){return {
 async pushKeys(candidate){await query('INSERT INTO push_settings(id,public_key,private_key) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING',['v1',candidate.publicKey,candidate.privateKey]);const [row]=await query('SELECT public_key,private_key FROM push_settings WHERE id=?',['v1']);return {publicKey:row.public_key,privateKey:row.private_key};},
 async savePush(subscription,language,now=Date.now()){const id=subscriptionId(subscription.endpoint),existing=await query('SELECT id FROM push_subscriptions WHERE id=?',[id]);await query('INSERT INTO push_subscriptions(id,subscription,language,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET subscription=excluded.subscription,language=excluded.language,updated_at=excluded.updated_at',[id,JSON.stringify(subscription),language,now]);return {id,created:existing.length===0};},
 async removePush(endpoint){const id=subscriptionId(endpoint);await batch([['DELETE FROM push_deliveries WHERE subscription_id=?',[id]],['DELETE FROM push_subscriptions WHERE id=?',[id]]]);},
 async enqueuePushFor(id,eventId,payload,now=Date.now()){await query("INSERT INTO push_deliveries(event_id,subscription_id,payload,next_attempt,updated_at,expires_at) SELECT ?,id,?,?,?,? FROM push_subscriptions WHERE id=? ON CONFLICT(event_id,subscription_id) DO NOTHING",[eventId,JSON.stringify(payload),now,now,now+86400000,id]);},
 async enqueuePush(eventId,payload,now=Date.now()){await query("INSERT INTO push_deliveries(event_id,subscription_id,payload,next_attempt,updated_at,expires_at) SELECT ?,id,?,?,?,? FROM push_subscriptions WHERE 1=1 ON CONFLICT(event_id,subscription_id) DO NOTHING",[eventId,JSON.stringify(payload),now,now,now+86400000]);},
 async claimPush(now=Date.now()){
 await batch([['DELETE FROM push_deliveries WHERE expires_at<?',[now]],['DELETE FROM push_subscriptions WHERE updated_at<?',[now-180*86400000]],["UPDATE push_deliveries SET state='pending',claim=NULL WHERE state='sending' AND updated_at<?",[now-120000]]]);
 const claim=randomBytes(12).toString('hex');
 const rows=await query("UPDATE push_deliveries SET state='sending',claim=?,attempts=attempts+1,updated_at=? WHERE (event_id,subscription_id) IN (SELECT event_id,subscription_id FROM push_deliveries WHERE state='pending' AND next_attempt<=? AND attempts<5 ORDER BY next_attempt LIMIT 20) AND state='pending' RETURNING event_id,subscription_id,payload,attempts",[claim,now,now]);
 const result=[];for(const row of rows){const [sub]=await query('SELECT subscription,language FROM push_subscriptions WHERE id=?',[row.subscription_id]);if(sub)result.push({...row,...sub,claim});else await query('DELETE FROM push_deliveries WHERE event_id=? AND subscription_id=?',[row.event_id,row.subscription_id]);}return result;
 },
 async finishPush(row,retry=false,now=Date.now()){if(retry)await query("UPDATE push_deliveries SET state='pending',next_attempt=?,updated_at=?,claim=NULL WHERE event_id=? AND subscription_id=? AND claim=?",[now+Math.min(3600000,30000*2**row.attempts),now,row.event_id,row.subscription_id,row.claim]);else await query("UPDATE push_deliveries SET state='sent',claim=NULL WHERE event_id=? AND subscription_id=? AND claim=?",[row.event_id,row.subscription_id,row.claim]);}
};}

