import {neon} from '@neondatabase/serverless';
import {del} from '@vercel/blob';
// One-time cleanup explicitly approved by the project owner on 2026-11-10.
const targets=[['20a7343711dab4d07fadc462','Ayesh'],['01ab49a345e6c8442e8026bd','Hasindu sadeepa'],['dc29be611a2671ed412ab4af','Oshadha']];
export async function cleanupApprovedTests(env,client,removeBlob=del){
 if(!env.DATABASE_URL&&!client)return {deleted:0};
 const sql=client||neon(env.DATABASE_URL),ids=targets.map(t=>t[0]);
 const rows=await sql.query('SELECT d.id,d.name,d.amount,r.data FROM donations d LEFT JOIN donation_receipts r ON r.donation_id=d.id WHERE d.id IN ($1,$2,$3)',ids);
 for(const row of rows){if(!targets.some(([id,name])=>id===row.id&&name===row.name)||Number(row.amount)!==100)throw Error('Approved test cleanup identity mismatch');}
 for(const row of rows){if(row.data?.startsWith('blob:')){if(!env.BLOB_READ_WRITE_TOKEN)throw Error('Private proof storage unavailable');await removeBlob(row.data.slice(5),{token:env.BLOB_READ_WRITE_TOKEN});}}
 const deleted=await sql.query('DELETE FROM donations WHERE (id=$1 AND name=$2 AND amount=100) OR (id=$3 AND name=$4 AND amount=100) OR (id=$5 AND name=$6 AND amount=100) RETURNING id',targets.flat());
 return {deleted:deleted.length};
}

