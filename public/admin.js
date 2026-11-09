const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let data={donations:[],visitors:[],views:[],metrics:{}},signedIn=false,busy=false,page=0,selection,requestedOpened=false;
const money=n=>'LKR '+Number(n||0).toLocaleString('en-LK');
const date=v=>v?new Date(typeof v==='number'||/^\d+$/.test(String(v))?Number(v):v).toLocaleString('en-LK',{timeZone:'Asia/Colombo'}):'—';
const text=(tag,value,className)=>{const n=document.createElement(tag);n.textContent=value??'—';if(className)n.className=className;return n;};
async function api(path,options={}){const r=await fetch(path,options),d=await r.json();if(!r.ok){const e=Error(d.error||'Request failed.');e.status=r.status;throw e;}return d;}
function filtered(){const query=$('#admin-search').value.trim().toLowerCase();return data.donations.filter(d=>($('#include-archived').checked||!d.archived_at)&&JSON.stringify([d.name,d.email,d.phone,d.reference,d.id,d.requestDetails]).toLowerCase().includes(query));}
function openProof(d){const url='/api/admin/slips/'+encodeURIComponent(d.id);$('#slip-title').textContent=d.name+' · '+money(d.amount);$('#slip-info').textContent=d.reference+' · '+date(d.created_at);$('#slip-image').src=url;$('#slip-download').href=url;$('#slip-download').download='Harithayu-proof-'+d.id+(d.mime==='image/png'?'.png':'.jpg');$('#slip-dialog').showModal();}
function proofButton(d){const b=text('button','Open private proof');b.type='button';b.addEventListener('click',()=>openProof(d));return b;}
function renderDonations(){
 const rows=filtered(),pages=Math.max(1,Math.ceil(rows.length/40));page=Math.min(page,pages-1);
 $('#admin-rows').replaceChildren(...rows.slice(page*40,(page+1)*40).map(d=>{
  const tr=document.createElement('tr'),audit=d.requestDetails||{};
  const cells=[date(d.created_at),d.name,`${d.phone||'No phone'}\n${d.email||'No email'}`,money(d.amount),d.reference,d.displayStatus,`${audit.ip||'Not captured'}\n${[audit.city,audit.region,audit.country].filter(Boolean).join(', ')||'Location unavailable'}`];
  for(const value of cells)tr.append(text('td',value));tr.children[1].append(text('small',d.id));tr.children[5].append(text('small','Public name: '+(d.public_name===1?'Yes':'No')));if(d.archived_at)tr.children[5].append(text('small','Archived '+date(d.archived_at)));
  const actions=document.createElement('td');if(d.has_slip)actions.append(proofButton(d));else actions.append(text('small','No attached proof'));
  if(d.status==='pending'&&!d.archived_at)for(const status of ['confirmed','rejected']){const b=text('button',status==='confirmed'?'Confirm bank transfer':'Reject');b.addEventListener('click',()=>{selection={id:d.id,status};$('#review-title').textContent=status==='confirmed'?'Confirm bank transfer?':'Reject submission?';$('#review-details').textContent=d.name+' · '+money(d.amount)+' · '+d.reference;$('#review-dialog').showModal();});actions.append(b);}
  const sync=text('button','Sync to Google');sync.addEventListener('click',async()=>{sync.disabled=true;try{await api('/api/admin/google-sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id})});$('#admin-message').textContent='Google sync completed.';}catch(e){$('#admin-message').textContent=e.message;}finally{sync.disabled=false;}});actions.append(sync);tr.append(actions);return tr;
 }));
 $('#donation-page').textContent=rows.length?`${page*40+1}–${Math.min((page+1)*40,rows.length)} of ${rows.length} records`:'No donation records';$('#previous-page').disabled=page===0;$('#next-page').disabled=page>=pages-1;
 $('#slips-gallery').replaceChildren(...rows.filter(d=>d.has_slip).map(d=>{const card=text('article','', 'slip-card');card.append(text('h3',d.name),text('p',money(d.amount)+' · '+d.displayStatus),text('p',d.reference),text('p',date(d.created_at)),proofButton(d));return card;}));
 if(!rows.some(d=>d.has_slip))$('#slips-gallery').append(text('p','No attached proofs match this filter.'));
}
function renderVisitors(){
 const query=$('#admin-search').value.toLowerCase();$('#visitor-rows').replaceChildren(...data.visitors.filter(v=>JSON.stringify(v).toLowerCase().includes(query)).map(v=>{
  const row=document.createElement('tr'),live=Date.now()-Number(v.last_seen)<90000,status=text('td',live?'Online':'Offline'),dot=text('span','', 'live-indicator'+(live?' online':''));status.prepend(dot);row.append(status);
  for(const value of [date(v.last_seen),v.id,v.ip||'Not captured',[v.city,v.region,v.country].filter(Boolean).join(', ')||'Unavailable',[v.latitude,v.longitude].filter(Boolean).join(', ')||'Unavailable',date(v.first_seen)])row.append(text('td',value));return row;
 }));
}
function renderExcel(){
 const source=$('#excel-source').value;let headers,rows;
 if(source==='donations'){headers=['Name','LKR','Phone','Email','Reference','Status','Submitted','IP','Approx location','Public name'];rows=data.donations.map(d=>[d.name,d.amount,d.phone||'',d.email,d.reference,d.displayStatus,date(d.created_at),d.requestDetails?.ip||'',[d.requestDetails?.city,d.requestDetails?.region,d.requestDetails?.country].filter(Boolean).join(', '),d.public_name===1?'Yes':'No']);}
 else{headers=['Session','Seen','IP','City','Region','Country','Approx coordinates','Path'];rows=data[source].map(v=>[v.visitor_id||v.id,date(v.last_seen||v.seen_at),v.ip,v.city,v.region,v.country,[v.latitude,v.longitude].filter(Boolean).join(', '),v.path]);}
 const head=document.createElement('tr');headers.forEach(h=>head.append(text('th',h)));$('#excel-head').replaceChildren(head);$('#excel-rows').replaceChildren(...rows.slice(0,200).map(values=>{const row=document.createElement('tr');values.forEach(v=>row.append(text('td',v)));return row;}));
}
function render(){
 const m=data.metrics;$('#metric-active').textContent=m.active??0;$('#metric-today').textContent=m.todayViews??0;$('#metric-views').textContent=m.views??0;$('#metric-visitors').textContent=(m.visitors??0)+' visitor sessions · 90 days';const active=data.donations.filter(d=>!d.archived_at);$('#metric-donations').textContent=active.length;$('#metric-amount').textContent=money(active.filter(d=>d.status==='confirmed').reduce((n,d)=>n+d.amount,0));renderDonations();renderVisitors();renderExcel();$('#admin-updated').textContent='Updated '+date(Date.now())+' · refreshes every 15s';
 const requested=new URLSearchParams(location.search).get('slip');if(!requestedOpened&&/^[a-f0-9]{24}$/.test(requested||'')){const d=data.donations.find(d=>d.id===requested&&d.has_slip);if(d){requestedOpened=true;openProof(d);}}
}
async function load(){if(busy)return;busy=true;try{data=await api('/api/admin/dashboard');signedIn=true;$('#admin-login').hidden=true;$('#admin-records').hidden=false;render();}catch(e){$('#admin-message').textContent=e.message;if(e.status===401){signedIn=false;data={donations:[],visitors:[],views:[],metrics:{}};$('#admin-records').hidden=true;$('#admin-login').hidden=false;$('#slip-dialog').close();$('#slip-image').removeAttribute('src');}}finally{busy=false;}}
$('#admin-login').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#admin-password').value})});$('#admin-password').value='';$('#admin-message').textContent='';await load();}catch(e){$('#admin-message').textContent=e.message;}});
$('#refresh-records').addEventListener('click',load);$('#admin-logout').addEventListener('click',async()=>{try{await api('/api/admin/logout',{method:'POST'});signedIn=false;location.reload();}catch(e){$('#admin-message').textContent=e.message;}});
$$('[data-tab]').forEach(button=>button.addEventListener('click',()=>{$$('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',b===button));$$('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==button.dataset.tab);}));
$('#admin-search').addEventListener('input',()=>{page=0;renderDonations();renderVisitors();});$('#include-archived').addEventListener('change',()=>{page=0;renderDonations();});$('#excel-source').addEventListener('change',renderExcel);$('#previous-page').addEventListener('click',()=>{page--;renderDonations();});$('#next-page').addEventListener('click',()=>{page++;renderDonations();});
$('#close-slip').addEventListener('click',()=>$('#slip-dialog').close());$('#slip-dialog').addEventListener('close',()=>$('#slip-image').removeAttribute('src'));$('#review-cancel').addEventListener('click',()=>$('#review-dialog').close());$('#review-confirm').addEventListener('click',async()=>{const b=$('#review-confirm');b.disabled=true;try{await api('/api/admin/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(selection)});$('#review-dialog').close();$('#admin-message').textContent='Review saved.';await load();}catch(e){$('#admin-message').textContent=e.message;}finally{b.disabled=false;}});
load();setInterval(()=>{if(signedIn&&!document.hidden)load();},15000);document.addEventListener('visibilitychange',()=>{if(signedIn&&!document.hidden)load();});
