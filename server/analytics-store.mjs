export const ANALYTICS_SCHEMA=[
 `CREATE TABLE IF NOT EXISTS site_visitors (id TEXT PRIMARY KEY,first_seen BIGINT NOT NULL,last_seen BIGINT NOT NULL,ip TEXT NOT NULL,country TEXT NOT NULL,region TEXT NOT NULL,city TEXT NOT NULL,latitude TEXT NOT NULL,longitude TEXT NOT NULL,path TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS site_page_views (id TEXT PRIMARY KEY,visitor_id TEXT NOT NULL,seen_at BIGINT NOT NULL,path TEXT NOT NULL,ip TEXT NOT NULL,country TEXT NOT NULL,region TEXT NOT NULL,city TEXT NOT NULL,latitude TEXT NOT NULL,longitude TEXT NOT NULL)`,
 'CREATE INDEX IF NOT EXISTS site_visitors_seen ON site_visitors(last_seen)',
 'CREATE INDEX IF NOT EXISTS site_views_seen ON site_page_views(seen_at)'
];
export function createAnalyticsStore(query,batch){
 const retention=90*86400000;
 return {
  async recordVisit(v){
   const location=[v.ip,v.country,v.region,v.city,v.latitude,v.longitude];
   await batch([
    ['INSERT INTO site_visitors (id,first_seen,last_seen,ip,country,region,city,latitude,longitude,path) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen,ip=excluded.ip,country=excluded.country,region=excluded.region,city=excluded.city,latitude=excluded.latitude,longitude=excluded.longitude,path=excluded.path',[v.visitorId,v.now,v.now,...location,v.path]],
    ['INSERT INTO site_page_views (id,visitor_id,seen_at,path,ip,country,region,city,latitude,longitude) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',[v.pageId,v.visitorId,v.now,v.path,...location]],
    ['DELETE FROM site_visitors WHERE last_seen<?',[v.now-retention]],
    ['DELETE FROM site_page_views WHERE seen_at<?',[v.now-retention]],
    ["UPDATE donations SET audit_json='{}' WHERE created_at<? AND audit_json<>'{}'",[new Date(v.now-retention).toISOString()]]
   ]);
  },
  async trafficSummary(now=Date.now()){
   const today=Date.parse(new Date(now+19800000).toISOString().slice(0,10)+'T00:00:00+05:30');
   const [row]=await query('SELECT (SELECT COUNT(*) FROM site_visitors WHERE last_seen>?) active,(SELECT COUNT(*) FROM site_visitors WHERE last_seen>?) visitors,(SELECT COUNT(*) FROM site_page_views WHERE seen_at>?) views,(SELECT COUNT(*) FROM site_page_views WHERE seen_at>=?) today_views',[now-90000,now-retention,now-retention,today]);
   return {active:Number(row.active),visitors:Number(row.visitors),views:Number(row.views),todayViews:Number(row.today_views),retentionDays:90,activeWindowSeconds:90};
  },
  async trafficDetails(now=Date.now()){
   await batch([['DELETE FROM site_visitors WHERE last_seen<?',[now-retention]],['DELETE FROM site_page_views WHERE seen_at<?',[now-retention]],["UPDATE donations SET audit_json='{}' WHERE created_at<? AND audit_json<>'{}'",[new Date(now-retention).toISOString()]]]);
   const visitors=await query('SELECT * FROM site_visitors WHERE last_seen>? ORDER BY last_seen DESC',[now-retention]);
   const views=await query('SELECT * FROM site_page_views WHERE seen_at>? ORDER BY seen_at DESC',[now-retention]);
   return {visitors,views};
  },
  async adminDetails(){return query('SELECT d.id,d.name,d.email,d.amount,d.reference,d.public_name,d.status,d.auto_accepted,d.created_at,d.confirmed_at,d.archived_at,d.audit_json,r.phone,r.mime,CASE WHEN r.donation_id IS NULL THEN 0 ELSE 1 END has_slip FROM donations d LEFT JOIN donation_receipts r ON r.donation_id=d.id ORDER BY d.created_at DESC,d.id DESC',[]);}
 };
}
