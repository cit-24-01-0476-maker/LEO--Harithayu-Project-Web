import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import ExcelJS from 'exceljs';
import {createStore} from '../server/store.mjs';
import {createHandler} from '../server/service.mjs';
import {requestDetails} from '../server/request-details.mjs';

test('visitor heartbeats deduplicate views, respect privacy preferences and expire location logs',async()=>{
 const store=createStore(':memory:'),now=Date.now(),base={visitorId:'a'.repeat(36),pageId:'b'.repeat(36),ip:'203.0.113.7',country:'LK',region:'1',city:'Colombo',latitude:'6.90',longitude:'79.85',path:'/',now};
 try{
  await store.recordVisit(base);await store.recordVisit({...base,now:now+1000});let metrics=await store.trafficSummary(now+1000);assert.equal(metrics.views,1);assert.equal(metrics.visitors,1);assert.equal(metrics.active,1);
  await store.recordVisit({...base,pageId:'c'.repeat(36),now:now+2000});assert.equal((await store.trafficSummary(now+2000)).views,2);assert.equal((await store.trafficSummary(now+100000)).active,0);
  const future=now+91*86400000;await store.recordVisit({...base,visitorId:'d'.repeat(36),pageId:'e'.repeat(36),now:future});assert.equal((await store.trafficDetails(future)).views.length,1);
  const req={headers:{'x-vercel-forwarded-for':'203.0.113.7','x-vercel-ip-city':'Colombo','x-vercel-ip-country':'LK','x-vercel-ip-latitude':'6.9271','x-vercel-ip-longitude':'79.8612'},socket:{remoteAddress:'127.0.0.1'}};
  assert.equal(requestDetails(req,{}).city,'');assert.equal(requestDetails(req,{}).ip,'127.0.0.1');assert.equal(requestDetails(req,{VERCEL:'1'}).latitude,'6.93');assert.equal(requestDetails(req,{VERCEL:'1'},true).ip,'');
 }finally{store.close();}
});

test('admin dashboard and real Excel export keep IPs, donor details and proof links private',async()=>{
 const store=createStore(':memory:'),server=http.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 server.on('request',createHandler({store,env:{PUBLIC_ORIGIN:origin,VERCEL:'1',ADMIN_PASSWORD:'dashboard-test-password-only',AUTO_ACCEPT_SUBMISSIONS:'true',DONATIONS_ENABLED:'true',BANK_NAME:'TEST',BANK_ACCOUNT_NAME:'TEST',BANK_ACCOUNT_NUMBER:'TEST',BANK_BRANCH:'TEST',CONTACT_EMAIL:'test@example.test'}}));
 const post=(path,input,cookie)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','x-vercel-forwarded-for':'203.0.113.7','x-vercel-ip-city':'Colombo','x-vercel-ip-country':'LK',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(input)});
 try{
  for(const path of ['/api/admin/dashboard','/api/admin/export.xlsx'])assert.equal((await fetch(origin+path)).status,401);
  const visit=await post('/api/visit',{visitorId:'a'.repeat(36),pageId:'b'.repeat(36),path:'/'});assert.equal(visit.status,200);const stats=await visit.json();assert.equal(stats.active,1);assert.ok(!JSON.stringify(stats).includes('203.0.113.7'));
  const donor=await post('/api/slip-donations',{name:'=1+1',phone:'0770000000',email:'private@example.test',amount:100,reference:'ADMIN-TEST',publicName:false,consent:true,slip:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII='});assert.equal(donor.status,201);
  const publicData=await (await fetch(origin+'/api/summary')).text();assert.ok(!publicData.includes('203.0.113.7'));assert.ok(!publicData.includes('private@example.test'));
  const login=await post('/api/admin/login',{password:'dashboard-test-password-only'});const cookie=login.headers.get('set-cookie').split(';')[0];
  const dashboard=await (await fetch(origin+'/api/admin/dashboard',{headers:{Cookie:cookie}})).json();assert.equal(dashboard.donations[0].requestDetails.ip,'203.0.113.7');assert.equal(dashboard.donations[0].has_slip,1);assert.equal(dashboard.visitors[0].city,'Colombo');assert.ok(!JSON.stringify(dashboard).includes('base64'));assert.ok(!JSON.stringify(dashboard).includes('"token"'));
  const report=await fetch(origin+'/api/admin/export.xlsx',{headers:{Cookie:cookie}});assert.equal(report.status,200);assert.match(report.headers.get('content-type'),/spreadsheetml/);const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(await report.arrayBuffer()));assert.deepEqual(book.worksheets.map(s=>s.name),['Donations','Visitors','Page views']);assert.equal(book.worksheets[0].getCell('B5').value,'=1+1');assert.equal(book.worksheets[0].getCell('L5').value,'203.0.113.7');assert.ok(book.worksheets[0].getCell('R5').value.hyperlink.includes('/admin?slip='));
  await post('/api/admin/logout',{},cookie);assert.equal((await fetch(origin+'/api/admin/export.xlsx',{headers:{Cookie:cookie}})).status,401);
 }finally{await new Promise(r=>server.close(r));store.close();}
});
