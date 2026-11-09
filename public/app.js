import { donationTreeLayout } from './donation-tree-layout.js';
import { uploadPrivateProof } from './proof-upload.js';
import { createSoundscape } from './lagoon-audio.js';
import { islandPolygons } from './sri-lanka-map.js';
import { provinces } from './sri-lanka-provinces.js';
import { seedlingOwners } from './donation-map.js';
import { createMangroveIntro } from './mangrove-video.js';

let language=localStorage.getItem('harithayu-ui-language')==='si'?'si':'en';
let config={enabled:false,price:100,target:500},summary={amount:0,seedlings:0,contributions:0,donors:[]},summaryLoaded=false;
let toastTimer,pendingTimer;
const demoLeaves=[];
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const t=(si,en)=>language==='si'?si:en;
const money=n=>`${language==='si'?'රු.':'LKR'} ${Number(n).toLocaleString('en-LK')}`;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const intro=$('#intro');
const welcome=$('#welcome-screen');
const soundscape=createSoundscape();
const introVisitKey='harithayu-film-v1';
let enterTimer,closeTimer,revealTimer,introAnimation;
const introPhases=[['මුල් බැසගනී. බලාපොරොත්තු වැඩෙයි.','Roots take hold. Hope begins.'],['මුලින් කඳක්. ඉන්පසු හරිත හෙටක්.','A living trunk. A greener tomorrow.'],['අතු විහිදෙයි. ජීවිතයට ඉඩ සැදෙයි.','Branches unfold. Life finds a home.'],['අපේ හරිත ගමන මෙතැනින් ඇරඹෙයි.','Your greener tomorrow starts here.']];
function introInert(value){$$('header.site-header,main#main,body>footer').forEach(el=>el.inert=value);}
function prepareIntro(){soundscape.intro();clearTimeout(revealTimer);document.body.classList.remove('page-arriving');intro.hidden=false;intro.classList.remove('growing','leaving','film-error');$('#enter-site').disabled=false;$('#enter-text').disabled=false;$('#intro-phase').textContent=t('එක් ස්පර්ශයකින්, ජීවිතයට ඇරඹුමක්.','One touch. A new beginning.');document.body.classList.add('intro-open');introInert(true);if(!introAnimation)introAnimation=createMangroveIntro($('#mangrove-scene'),{reducedMotion:reduced,onStage:phase=>{intro.classList.toggle('film-error',phase===-2);$('#intro-phase').textContent=phase===-2?t('වීඩියෝව පූරණය කළ නොහැක. Skip භාවිත කරන්න.','Film unavailable. You can skip to the website.'):phase<0?t('අපේ හරිත කතාව ඇරඹෙයි…','Every coastline has a story.'):t(...introPhases[phase]);}});introAnimation.reset();intro.hidden=true;welcome.hidden=false;$('#welcome-enter').focus({preventScroll:true});}
function finishIntro(immediate=false){
  if(intro.hidden||intro.classList.contains('leaving'))return;
  clearTimeout(enterTimer);clearTimeout(revealTimer);
  const animated=!immediate&&!reduced;
  soundscape.page();
  window.scrollTo({top:0,behavior:'instant'});
  document.body.classList.toggle('page-arriving',animated);
  intro.classList.add('leaving');
  closeTimer=setTimeout(()=>{
    intro.hidden=true;introAnimation?.stop();document.body.classList.remove('intro-open');introInert(false);
    $('#main').setAttribute('tabindex','-1');$('#main').focus({preventScroll:true});
  },animated?1450:0);
  if(animated)revealTimer=setTimeout(()=>document.body.classList.remove('page-arriving'),2600);
  sessionStorage.setItem(introVisitKey,'1');
}
function enter(skip=false){if(intro.hidden)return;if(skip){soundscape.start('page',true);finishIntro(true);return;}if(intro.classList.contains('growing'))return;soundscape.start('intro',true);intro.classList.add('growing');$('#enter-site').disabled=true;$('#enter-text').disabled=true;intro.setAttribute('tabindex','-1');intro.focus({preventScroll:true});introAnimation?.start(()=>{enterTimer=setTimeout(()=>finishIntro(),reduced?0:550);});}
prepareIntro();
$('#welcome-enter').addEventListener('click',()=>{welcome.hidden=true;intro.hidden=false;enter();});
welcome.addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();$('#welcome-enter').focus();}});
$('#enter-site').addEventListener('click',()=>enter());$('#enter-text').addEventListener('click',()=>enter());$('#skip-intro').addEventListener('click',()=>enter(true));
intro.addEventListener('keydown',e=>{if(e.key==='Escape'){enter(true);return;}if(e.key==='Tab'){const buttons=[...intro.querySelectorAll('button'),$('#sound-toggle')].filter(b=>!b.disabled);if(e.shiftKey && document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1).focus();}else if(!e.shiftKey && document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0].focus();}}});
$('#replay-intro').addEventListener('click',()=>{clearTimeout(enterTimer);clearTimeout(closeTimer);prepareIntro();});
function translate(){document.documentElement.lang=language;$$('[data-en]').forEach(el=>{el.textContent=language==='si'?(el.dataset.si||el.dataset.en):el.dataset.en;if(language==='en'&&el.dataset.meaning){const meaning=document.createElement('small');meaning.className='si-meaning';meaning.lang='si';meaning.textContent=' ('+el.dataset.meaning+')';el.append(meaning);}});$('#language-toggle').textContent=language==='si'?'English':'සිංහල';$('#language-toggle').setAttribute('aria-pressed',language==='si');updateAmount();renderSummary();renderAvailability();}
$('#language-toggle').addEventListener('click',()=>{language=language==='si'?'en':'si';localStorage.setItem('harithayu-ui-language',language);translate();if(!config.enabled)$('#contribute').click();});
function amount(){return Number($('#custom-amount').value);}
function updateAmount(){const n=amount(),valid=Number.isSafeInteger(n)&&n>=100&&n<=1000000;$('#seed-equivalent').textContent=valid?t(`🌱 පැළ ${Math.floor(n/100)}ක රෝපණයට දායකත්වයක්`,`🌱 Supports ${Math.floor(n/100)} seedling${Math.floor(n/100)===1?'':'s'}`):t('රු.100 සිට රු.1,000,000 දක්වා මුදලක් ඇතුළත් කරන්න.','Enter an amount between LKR 100 and LKR 1,000,000.');$('#contribute').disabled=!valid;$$('.amount-option').forEach(b=>{b.classList.toggle('selected',Number(b.dataset.amount)===n);b.setAttribute('aria-pressed',Number(b.dataset.amount)===n);});}
$$('.amount-option').forEach(b=>b.addEventListener('click',()=>{$('#custom-amount').value=b.dataset.amount;updateAmount();}));$('#custom-amount').addEventListener('input',updateAmount);
// The coastline and seedling mask use the same projected Natural Earth geometry.
function inRing(ring,x,y){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [a,b]=ring[i],[c,d]=ring[j];if(((b>y)!==(d>y))&&(x<(c-a)*(y-b)/(d-b)+a))yes=!yes;}return yes;}
function inside(x,y){return islandPolygons.some(([outer,...holes])=>inRing(outer,x,y)&&!holes.some(h=>inRing(h,x,y)));}
const points=[];for(let y=55;y<468;y+=9)for(let x=108;x<390;x+=9)if(inside(x,y)&&inside(x-4,y)&&inside(x+4,y)&&inside(x,y-10)&&inside(x,y+4))points.push([x,y]);
// Stable interleaving spreads new contributions over the symbolic island.
points.sort((a,b)=>((a[0]*7919+a[1]*104729)%100003)-((b[0]*7919+b[1]*104729)%100003));
function sprout(point,size=12){const el=document.createElementNS('http://www.w3.org/2000/svg','use');el.setAttribute('href','#sprout');el.setAttribute('x',point[0]-size/2);el.setAttribute('y',point[1]-size);el.setAttribute('width',size);el.setAttribute('height',size*1.17);return el;}
function renderSummary(){if(summaryLoaded){$('#total-raised').textContent=money(summary.amount);$('#seed-count').textContent=summary.seedlings.toLocaleString('en-LK');$('#donor-count').textContent=summary.contributions.toLocaleString('en-LK');const percent=Math.min(100,summary.seedlings/500*100);$('#progress-percent').textContent=`${Math.floor(percent)}%`;$('#progress-fill').style.width=`${percent}%`;$('#progress').setAttribute('aria-valuenow',Math.min(500,summary.seedlings));}renderVerifiedMap();renderDonationLedger();renderGivingTree();renderDemoJourney();}

function renderVerifiedMap(){
  const host=$('#map-seedlings'),oldCount=host.children.length;
  const owners=seedlingOwners(summary.donors,points.length);
  host.replaceChildren(...points.slice(0,Math.min(points.length,summary.seedlings)).map((point,i)=>{
    const plant=sprout(point),donor=owners[i];
    if(donor){const title=document.createElementNS(plant.namespaceURI,'title');title.textContent=`${donor.name==='Anonymous'?t('නිර්නාමික','Anonymous'):donor.name} · ${money(donor.amount)}`;plant.append(title);plant.setAttribute('aria-label',title.textContent);plant.setAttribute('role','img');}
    if(summaryLoaded&&oldCount>0&&i>=oldCount)plant.classList.add('new-sprout');
    return plant;
  }));
}

let visibleDonations=20;
function renderDonationLedger(){
  const list=$('#donation-ledger');if(!list)return;
  $('#ledger-count').textContent=summaryLoaded?`${summary.contributions.toLocaleString('en-LK')} ${t('දායකත්ව','contributions')} · ${money(summary.amount)}`:'';
  $('#ledger-empty').hidden=summary.donors.length>0;
  $('#ledger-empty').textContent=t('තහවුරු කළ දායකත්ව මෙහි දිස්වේ.','Submitted donations will appear here.');
  list.replaceChildren(...summary.donors.slice(0,visibleDonations).map(d=>{
    const row=document.createElement('li');row.className='donation-ledger-row';row.dataset.donationId=d.id;
    const icon=document.createElement('span');icon.className='ledger-leaf';icon.textContent='❧';icon.setAttribute('aria-hidden','true');
    const name=document.createElement('strong');name.textContent=d.name==='Anonymous'?t('නිර්නාමික','Anonymous'):d.name;
    const value=document.createElement('span');value.className='ledger-amount';value.textContent=money(d.amount);
    const date=document.createElement('time');date.dateTime=d.confirmed_at;date.textContent=new Date(d.confirmed_at).toLocaleDateString(language==='si'?'si-LK':'en-LK',{year:'numeric',month:'short',day:'numeric'});
    row.append(icon,name,value,date);return row;
  }));
  $('#more-donations').hidden=visibleDonations>=summary.donors.length;
  $('#more-donations').textContent=t('තවත් දායකත්ව බලන්න ↓','Show more donations ↓');
}
async function refreshSummary(){try{const r=await fetch('/api/summary');if(!r.ok)throw Error();const previous=summary.seedlings;const next=await r.json();if(summaryLoaded&&JSON.stringify(next)===JSON.stringify(summary)){document.querySelector('#data-status').textContent='';return;}summary=next;summaryLoaded=true;renderSummary();$('#data-status').textContent='';if(summary.seedlings>previous && previous>0)notifyMap(t('තවත් දායකත්වයක් සමඟ අපේ සිතියම වැඩෙනවා!','Our map is growing with another submitted donation!'));}catch{$('#data-status').textContent=t('දායකත්ව දත්ත ලබාගත නොහැකි විය. නැවත උත්සාහ කරමින් පවතී.','Contribution data could not be loaded. Retrying shortly.');if(!summaryLoaded){$('#total-raised').textContent='—';$('#seed-count').textContent='—';$('#donor-count').textContent='—';}}}
function renderAvailability(){if(config.enabled&&config.autoAccept){$('#availability p').textContent=t('රිසිට්පත සමඟ යැවූ දායකත්වය ස්වයංක්‍රීයව එකතුවට හා සිතියමට එක් වේ. බැංකු ගෙවීම වෙනම තහවුරු කර නැහැ.','Your proof submission appears automatically in the total and map. Bank payment is not independently verified.');$('#contribute span:first-child').textContent=t('බැංකු විස්තර ලබාගන්න','Get bank transfer details');$('#payment-note').textContent=t('ස්වයංක්‍රීය දායකත්ව සටහන් · බැංකු ගෙවීම තහවුරු කර නැහැ','Automatic submissions · Not bank-verified');return;}if(!config.enabled){$('#availability p').textContent=t('Demo bank details සහ slip form එක බලන්න. මේවා සැබෑ ගිණුම් විස්තර නොවේ. මුදල් මාරු නොකරන්න.','Explore the demo bank details and slip form. These are not real account details. Do not transfer money.');$('#contribute span:first-child').textContent=t('Demo දායකත්ව form එක බලන්න','Explore the donation form');$('#payment-note').textContent=t('DEMO පමණයි · මුදල් හෝ slips භාර නොගනී','DEMO ONLY · No payments or slips accepted');}if(config.enabled){$('#availability p').textContent=t('බැංකු මාරුවකින් දායක වන්න. Club එකෙන් තහවුරු වූ පසු සිතියමේ ඔබේ පැළය වැඩෙනවා.','Contribute by bank transfer. Your seedling grows after the club verifies your transfer.');$('#contribute span:first-child').textContent=t('බැංකු විස්තර ලබාගන්න','Get bank transfer details');$('#payment-note').textContent=t('බැංකු මාරුව · Club එකෙන් පරීක්ෂා කර තහවුරු කෙරේ','Bank transfer · Manually verified by the club');}}
function notifyMap(text){clearTimeout(toastTimer);$('#map-toast').textContent=text;$('#map-toast').hidden=false;toastTimer=setTimeout(()=>$('#map-toast').hidden=true,5000);}
function preview(){const index=Math.min(summary.seedlings,points.length-1);const tree=sprout(points[index] || [232,300],36);tree.classList.add('new-sprout');$('#preview-sprout').replaceChildren(tree);$('.map-panel').scrollIntoView({behavior:reduced?'instant':'smooth',block:'center'});notifyMap(t('🌱 මෙන්න ඔබේ පුංචි පැළය! මෙය preview එකක් පමණයි.','🌱 Your little seedling! This is a preview only.'));setTimeout(()=>tree.remove(),9000);}
$('#preview-tree').addEventListener('click',preview);
$('#contribute').addEventListener('click',()=>{if(!config.enabled){$('#transfer-amount').textContent=t('DEMO පමණයි — මුදල් මාරු නොකරන්න.','DEMO ONLY — Do not transfer money.');$('#bank-details').replaceChildren(...['Bank: Sample Bank (DEMO)','Account name: Harithayu Demo — Not a real account','Account number: DEMO-NOT-A-REAL-ACCOUNT','Branch: Sample Branch (DEMO)'].map(text=>{const row=document.createElement('div');row.textContent=text;return row;}));$('#transfer-form [name=amount]').value=amount();const submit=$('#transfer-form [type=submit]');submit.disabled=false;submit.textContent=t('Demo කොළය වවන්න ↗','Grow my demo leaf ↗');$('#transfer-form [name=reference]').required=false;$('#transfer-form [name=phone]').required=false;openContributionForm();return;}$('#transfer-amount').textContent=t(`ඔබ තෝරාගත් දායකත්වය: ${money(amount())}`,`Your selected contribution: ${money(amount())}`);const fields=[[t('බැංකුව','Bank'),config.bank.name],[t('ගිණුමේ නම','Account name'),config.bank.accountName],[t('ගිණුම් අංකය','Account number'),config.bank.accountNumber],[t('ශාඛාව','Branch'),config.bank.branch]];$('#bank-details').replaceChildren(...fields.map(([k,v])=>{const p=document.createElement('div');p.textContent=`${k}: ${v}`;return p;}));$('#transfer-form [name=amount]').value=amount();openContributionForm();});
function showFilm(){soundscape.duck(true);const slot=$('#film-content');slot.replaceChildren();if(config.videoUrl){const v=document.createElement('video');v.src=config.videoUrl;v.controls=true;v.playsInline=true;v.preload='metadata';slot.append(v);}else{const scene=document.createElement('div');scene.className='film-placeholder';const h=document.createElement('h2');h.textContent=t('වෙරළට රැකවරණයක්. හෙටට හුස්මක්.','Shelter for the coast. Life for tomorrow.');scene.append(h);const p=document.createElement('p');p.textContent=t('හරිතායු ව්‍යාපෘතියේ වීඩියෝව ඉදිරියේදී එක් කෙරේ. දැනට ශ්‍රී ලංකාවේ කඩොලාන ගැන UNEP කෙටි වාර්තා වැඩසටහන බලන්න.','The Harithayu project film will be added here. Meanwhile, explore UNEP’s short documentary on Sri Lanka’s mangroves.');const a=document.createElement('a');a.href='https://www.unep.org/news-and-stories/video/how-sri-lankas-bet-mangroves-paying';a.target='_blank';a.rel='noopener';a.className='text-link';a.textContent=t('UNEP වීඩියෝව බලන්න ↗','Watch the UNEP documentary ↗');slot.append(scene,p,a);}$('#film-dialog').showModal();}
$('#watch-film').addEventListener('click',showFilm);$$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));$$('dialog').forEach(d=>{d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});d.addEventListener('close',()=>d.querySelectorAll('video').forEach(v=>v.pause()));});
const policies={privacy:{si:['පෞද්ගලිකත්වය','ඔබ දායකත්වයක් තහවුරු කිරීමට යැවූ විට ඔබේ නම, දුරකථන අංකය, ඊමේල් ලිපිනය, මුදල, පෞද්ගලික බැංකු රිසිට්පත සහ බැංකු transaction reference එක club එකේ ආරක්ෂිත සටහන්වල තබාගනී. ගෙවීම තහවුරු කිරීමට සහ ඒ ගැන ඔබ අමතන්නට පමණක් ඒවා භාවිත කෙරේ.','ඔබ කැමැත්ත ලබා දුන්නොත් පමණක් ඔබේ නම පොදු ලැයිස්තුවේ පෙන්වයි. ඔබේ ඊමේල් ලිපිනය හෝ බැංකු reference එක ප්‍රසිද්ධ නොකෙරේ. Card හෝ බැංකු login විස්තර අපි ලබා නොගනිමු.','භාෂා කැමැත්ත හා දායකත්ව තත්ත්වය මේ උපාංගයේ browser storage තුළ තබාගනී. Admin login සඳහා පමණක් ආරක්ෂිත session cookie එකක් යොදාගනී. Google Fonts භාවිත කිරීමෙන් එම සේවාවට සාමාන්‍ය connection තොරතුරු යැවේ.','ඔබේ සටහන් පිළිබඳ විමසීමට හෝ නම ඉවත් කිරීමට පහත club සම්බන්ධතා භාවිත කරන්න.'],en:['Privacy','When you submit a contribution for verification, the club stores your name, phone number, optional email, amount, private bank slip and transfer reference. These are used to verify the transfer and contact you about it.','Your name appears publicly only with your consent. Phone numbers, slips, email addresses and bank references are never published. Submission details are recorded in the club’s private Google Form and Sheet. Proofs are stored privately in Google Drive or Vercel private storage and can be opened only by authorized reviewers. We do not collect card details or bank login credentials.','Visitor analytics store a first-party session ID, page views, IP address and approximate IP location for up to 90 days. IP location is not GPS and may reflect a VPN. Privacy opt-outs omit saved IP/location. Donation submissions also record IP/location for club administration; that metadata is cleared after 90 days. Only authorized admins can view or export these details. Language preferences and pending contribution status are stored in this browser. Admin access uses a session cookie. Google Fonts receives normal connection information when fonts load.','Use the club contact details below to ask about your records or request removal of your public name.']},terms:{si:['දායකත්ව කොන්දේසි','හරිතායු යනු Leo Club of SLTC මගින් මන්නාරමේ කඩොලාන පැළ 500ක් රෝපණය සඳහා සැලසුම් කරන ව්‍යාපෘතියකි. එක් පැළයකට නියමිත දායකත්වය රු.100කි. නිශ්චිත ස්ථානය සහ දිනය තහවුරු වූ පසු පළ කෙරේ.','සිතියමේ පැළ සංකේතාත්මක දායකත්ව නිරූපණයකි. දායකත්වයක් තහවුරු වීමෙන් පැළයක් දැනටමත් රෝපණය කර ඇති බව හෝ එහි ජීවිත කාලය සහතික වන බව නොකියවේ.','රිසිට්පත සමඟ යැවූ දායකත්ව ස්වයංක්‍රීයව website එකතුවට එක් වේ. ඒවා බැංකු ගෙවීම් ලෙස වෙනම තහවුරු කර නැහැ. රිසිට්පතක් යැවීම පමණක් මුදල් ලැබුණු බවට සහතිකයක් නොවේ.','වැරදි හෝ දෙවරක් සිදු වූ මාරු හා මුදල් ආපසු ඉල්ලීම් සඳහා club එක අමතන්න. Club එක ගනුදෙනුව පරීක්ෂා කර පිළිතුරු ලබා දේ. අදාළ බැංකු ගාස්තු තිබිය හැකියි.','බැංකු හා club සම්බන්ධතා තහවුරු කර දායකත්ව භාරගැනීම විවෘත කරනතුරු මෙම අඩවිය මුදල් භාර නොගනී.'],en:['Contribution terms','Harithayu is a Leo Club of SLTC initiative planning to support 500 mangrove seedlings in Mannar. The contribution per seedling is LKR 100. The exact site and date will be announced once confirmed.','Map seedlings symbolise contributions. Confirmation does not mean a seedling has already been planted or guarantee its lifetime survival.','Proof submissions are included in the website total automatically. These are reported donations, not independently verified bank receipts. Uploading a proof does not guarantee that money has reached the club account.','Contact the club about mistaken or duplicate transfers and refund requests. The club will review the transaction and respond. Your bank may apply transfer charges.','The website accepts no funds until bank information and club contact details are verified and contributions are opened.']}};
function showPolicy(type){const slot=$('#info-content');slot.replaceChildren();if(type==='contact'){const h=document.createElement('h2');h.textContent=t('අප අමතන්න','Contact the club');const p=document.createElement('p');p.textContent='Leo Club of SLTC · Harithayu';slot.append(h,p);if(config.contactEmail){const a=document.createElement('a');a.href=`mailto:${config.contactEmail}`;a.className='text-link';a.textContent=config.contactEmail;slot.append(a);}else{const p=document.createElement('p');p.textContent=t('නිල ඊමේල් සහ දුරකථන විස්තර තහවුරු වූ පසු මෙහි එක් කෙරේ. එතෙක් මෙම අඩවිය හරහා මුදල් භාර නොගනී.','Official email and phone details will be added after confirmation. Contributions remain closed until then.');slot.append(p);}if(config.contactPhone){const p=document.createElement('p');p.textContent=config.contactPhone;slot.append(p);}}else{policies[type][language].forEach((text,i)=>{const el=document.createElement(i?'p':'h2');el.textContent=text;slot.append(el);});const contact=document.createElement('button');contact.className='text-link';contact.textContent=t('Club සම්බන්ධතා ↗','Club contact details ↗');contact.addEventListener('click',()=>showPolicy('contact'));slot.append(contact);}if(!$('#info-dialog').open)$('#info-dialog').showModal();}
$$('[data-policy]').forEach(b=>b.addEventListener('click',()=>showPolicy(b.dataset.policy)));
function pendingRecord(){try{return JSON.parse(localStorage.getItem('harithayu-pending')||'null');}catch{return null;}}
async function checkPending(){const record=pendingRecord();if(!record)return;const box=$('#payment-status');box.hidden=false;try{const r=await fetch(`/api/donations/${record.id}`,{headers:{Authorization:`Bearer ${record.token}`}});if(!r.ok){box.textContent=t('ඔබේ දායකත්ව තත්ත්වය ලබාගත නොහැකි විය. පසුව නැවත පරීක්ෂා කෙරේ.','Unable to load your contribution status. We will retry shortly.');return;}const d=await r.json();if(['confirmed','accepted'].includes(d.status)){localStorage.removeItem('harithayu-pending');clearInterval(pendingTimer);await refreshSummary();box.textContent=d.status==='accepted'?t('ස්තුතියි! ඔබේ දායකත්වය එකතුවට එක් කළා. බැංකු ගෙවීම වෙනම තහවුරු කර නැහැ.','Thank you! Your submission is included in the total. Bank payment is not independently verified.'):t('ස්තුතියි! ඔබේ දායකත්වය තහවුරු කර ඇත. ඔබේ පැළය දැන් අපේ හරිත සිතියමේ කොටසක්.','Thank you! Your contribution is verified. Your seedling is now part of our green map.');$('.map-panel').scrollIntoView({behavior:reduced?'instant':'smooth',block:'center'});const index=Math.min(Math.max(summary.seedlings-1,0),points.length-1);const tree=sprout(points[index],25);tree.classList.add('new-sprout');$('#preview-sprout').replaceChildren(tree);setTimeout(()=>tree.remove(),8000);notifyMap(t('🌱 ස්තුතියි! ඔබේ දායකත්වයෙන් අපේ හෙට හරිත වුණා.','🌱 Thank you for helping our tomorrow grow greener.'));}else if(d.status==='rejected'){localStorage.removeItem('harithayu-pending');clearInterval(pendingTimer);box.textContent=t('මෙම දායකත්වය තහවුරු කළ නොහැකි විය. කරුණාකර club එක අමතන්න.','This contribution could not be verified. Please contact the club.');}else box.textContent=t('ඔබේ බැංකු මාරුව club එකෙන් තහවුරු කරන තෙක් රැඳී ඇත. තහවුරු වූ පසු සිතියම ස්වයංක්‍රීයව යාවත්කාලීන වේ.','Your transfer is awaiting verification by the club. The map will update automatically after confirmation.');}catch{box.textContent=t('සම්බන්ධතාව අසාර්ථකයි. ඔබේ යොමුව සුරක්ෂිතයි; නැවත පරීක්ෂා කෙරේ.','Connection interrupted. Your submission is saved; we will retry.');}}
$('#transfer-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,submit=form.querySelector('[type=submit]');submit.disabled=true;$('#form-error').textContent='';const data=new FormData(form);try{const file=data.get('slip');if(!file?.size||file.size>(config.maxSlipBytes||104857600))throw Error(t('100 MB දක්වා JPEG හෝ PNG රිසිට්පතක් තෝරන්න.','Choose a JPEG or PNG bank slip up to 100 MB.'));if(!['image/jpeg','image/png'].includes(file.type))throw Error(t('JPEG හෝ PNG රිසිට්පතක් තෝරන්න.','Choose a JPEG or PNG slip.'));if(!config.enabled){const demoAmount=Number(data.get('amount'));if(!Number.isSafeInteger(demoAmount)||demoAmount<100||demoAmount>1000000)throw Error('Enter an amount between LKR 100 and LKR 1,000,000.');demoLeaves.unshift({name:String(data.get('name')).trim(),amount:demoAmount,demo:true,confirmed_at:new Date().toISOString()});if(demoLeaves.length>20)demoLeaves.pop();closeContributionForm();form.reset();updateAmount();renderSummary();$('.map-panel').scrollIntoView({behavior:reduced?'instant':'smooth',block:'center'});notifyMap(t('DEMO · ඔබේ දායකත්වයෙන් පැළයක් මතුවුණා!','DEMO · A little mangrove grows with your contribution!'));const box=$('#payment-status');box.hidden=false;box.textContent=t('Demo කොළය වැඩුණා! නම හා මුදල මේ browser tab එකේ පමණයි. රිසිට්පත upload හෝ save කළේ නැහැ. සැබෑ මුළු මුදල වෙනස් නොවේ.','Your demo leaf has grown! Name and amount are visible only in this tab. The slip was not uploaded or saved. Real donation totals are unchanged.');return;}let receiptBlob;const uploadStatus=$('#upload-progress');uploadStatus.hidden=false;uploadStatus.textContent=t('රිසිට්පත upload කරමින්…','Uploading proof…');if(file.size>1048576)receiptBlob=await uploadPrivateProof(file,progress=>{uploadStatus.textContent=t('Upload කරමින්: ','Uploading proof: ')+Math.floor(progress.percentage)+'%';});const slip=receiptBlob?undefined:await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Unable to read slip.'));reader.readAsDataURL(file);});const r=await fetch('/api/slip-donations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:data.get('name'),email:data.get('email'),phone:data.get('phone'),slip,receiptBlob,reference:data.get('reference'),amount:Number(data.get('amount')),publicName:data.has('publicName'),consent:data.has('consent')})});const result=await r.json();if(!r.ok)throw Error(result.error || 'Please try again.');localStorage.setItem('harithayu-pending',JSON.stringify({id:result.id,token:result.token}));closeContributionForm();form.reset();await checkPending();$('#payment-status').scrollIntoView({behavior:'smooth'});if(!pendingTimer)pendingTimer=setInterval(checkPending,12000);}catch(err){$('#form-error').textContent=err.message;}finally{submit.disabled=false;$('#upload-progress').hidden=true;}});
$('#year').textContent=new Date().getFullYear();translate();
fetch('/api/config').then(r=>{if(!r.ok)throw Error();return r.json();}).then(c=>{config=c;renderAvailability();$('#contribute').click();}).catch(()=>{$('#availability p').textContent=t('සම්බන්ධතාව පරීක්ෂා කළ නොහැකි නිසා දායකත්ව භාරගැනීම වසා ඇත. Preview එක භාවිත කළ හැකියි.','Contributions are closed because connection status could not be verified. The preview is available.');});
refreshSummary();setInterval(()=>{if(!document.hidden)refreshSummary();},10000);if(pendingRecord()){checkPending();pendingTimer=setInterval(checkPending,12000);}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshSummary();});
window.addEventListener('focus',()=>refreshSummary());
$('#more-donations').addEventListener('click',()=>{visibleDonations+=20;renderDonationLedger();});

$('#film-dialog').addEventListener('close',()=>soundscape.duck(false));

function renderGivingTree(){
 const host=$('#donor-leaves');if(!host)return;
 const scene=host.closest('.tree-scene'),leaves=[...demoLeaves,...summary.donors],bounds=scene.getBoundingClientRect();
 const layout=donationTreeLayout(Math.max(bounds.width,240),Math.max(bounds.height,320),leaves.length);
 host.dataset.density=layout.density;host.style.setProperty('--card-width',layout.cardWidth+'px');host.style.setProperty('--card-height',layout.cardHeight+'px');
 let overflow=$('#donor-overflow');if(!overflow){overflow=document.createElement('div');overflow.id='donor-overflow';overflow.className='donor-overflow';overflow.setAttribute('role','list');overflow.setAttribute('aria-label','More donation leaves');scene.after(overflow);}
 const cards=leaves.map((d,i)=>{
  const leaf=document.createElement('article');leaf.className='giving-leaf receipt-leaf';leaf.setAttribute('role','listitem');
  leaf.style.setProperty('--leaf-delay',`${i%8*.06}s`);leaf.style.setProperty('--leaf-tilt',`${i%2?1:-1}deg`);leaf.style.setProperty('--sway-delay',`${-(i%7)*.8}s`);leaf.style.setProperty('--sway-duration',`${5+i%4}s`);
  if(i<layout.visible){leaf.style.setProperty('--leaf-x',layout.positions[i].x+'px');leaf.style.setProperty('--leaf-y',layout.positions[i].y+'px');}else leaf.classList.add('overflow-leaf');
  const icon=document.createElement('span');icon.className='receipt-leaf-icon';icon.textContent='❧';icon.setAttribute('aria-hidden','true');
  const name=document.createElement('strong');name.textContent=d.name==='Anonymous'?t('නිර්නාමික','Anonymous'):d.name;
  const value=document.createElement('span');value.className='leaf-amount';value.textContent=money(d.amount);
  const detail=document.createElement('small');detail.textContent=d.demo?t('DEMO · ඔබට පමණයි','DEMO · Only you'):t('යැවූ දායකත්වය','Donation submitted');
  leaf.title=name.textContent+' · '+value.textContent;leaf.setAttribute('aria-label',leaf.title);leaf.append(icon,name,value,detail);if(d.demo)leaf.classList.add('demo-leaf');return leaf;
 });
 host.replaceChildren(...cards.slice(0,layout.visible));overflow.replaceChildren(...cards.slice(layout.visible));overflow.hidden=leaves.length<=layout.visible;
 host.setAttribute('role','list');host.setAttribute('aria-label','Donation leaves on the tree');$('#clear-demo-leaves').hidden=!demoLeaves.length;
 if(!leaves.length){const p=document.createElement('p');p.className='tree-empty';p.textContent=t('ඔබේ කරුණාවෙන් පළමු කොළය වැඩේවි.','The first leaf is waiting for a little kindness.');host.append(p);}
}

function renderDemoJourney(){const panel=$('#demo-journey');panel.hidden=!demoLeaves.length;const total=demoLeaves.reduce((n,d)=>n+d.amount,0);$('#demo-total').textContent=money(total);$('#demo-count').textContent=demoLeaves.length;$('#demo-seedlings').textContent=Math.floor(total/100);$('#demo-real-total').textContent=money(summary.amount);const group=$('#demo-map-seedlings');group.replaceChildren(...points.slice(Math.min(summary.seedlings,500),Math.min(500,summary.seedlings+Math.floor(total/100))).map(p=>{const seed=sprout(p,17);seed.classList.add('demo-map-sprout');return seed;}));}
function renderProvinces(){const host=$('#province-boundaries');if(!host)return;host.replaceChildren(...provinces.map((province,i)=>{const g=document.createElementNS('http://www.w3.org/2000/svg','g');const path=document.createElementNS(g.namespaceURI,'path');path.setAttribute('d',province.path);path.setAttribute('class','province-area');path.style.setProperty('--province-fill',i%2?'#d2dfc7':'#e4ebdb');const title=document.createElementNS(g.namespaceURI,'title');title.textContent=province.name+' / '+province.si;path.append(title);g.append(path);return g;}));}
renderProvinces();
$('#view-donation-leaf').addEventListener('click',()=>$('.giving-tree').scrollIntoView({behavior:reduced?'instant':'smooth',block:'center'}));
function openContributionForm(){$('#transfer-dialog').hidden=false;}
function closeContributionForm(){/* The unified inline form remains available for the next contribution. */}
$('#contribution-close').addEventListener('click',()=>{closeContributionForm();$('#contribute').focus();});
$('#clear-demo-leaves').addEventListener('click',()=>{demoLeaves.length=0;renderSummary();$('#payment-status').hidden=true;});

matchMedia('(max-width:650px)').addEventListener('change',renderGivingTree);

// Freeze canopy effects outside the viewport and respect reduced-motion preferences.
const livingTrees=[...document.querySelectorAll('.living-mangrove')];
const treeMotionPreference=matchMedia('(prefers-reduced-motion: reduce)');
const treeVisibility=new Map();
function updateLivingTrees(){for(const tree of livingTrees){const rest=treeMotionPreference.matches||document.hidden||treeVisibility.get(tree)===false;tree.classList.toggle('is-resting',rest);if(rest)tree.pauseAnimations();else tree.unpauseAnimations();}}
const treeObserver=new IntersectionObserver(entries=>{for(const entry of entries)treeVisibility.set(entry.target,entry.isIntersecting);updateLivingTrees();},{rootMargin:'100px'});
livingTrees.forEach(tree=>treeObserver.observe(tree));treeMotionPreference.addEventListener('change',updateLivingTrees);document.addEventListener('visibilitychange',updateLivingTrees);updateLivingTrees();



const donationTreeResize=new ResizeObserver(()=>renderGivingTree());donationTreeResize.observe(document.querySelector('.tree-scene'));

// Silent hero film only runs while the main website and hero are visible.
const heroVideo=document.querySelector('#hero-video');
if(heroVideo){
 let heroVisible=true;
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 const syncHero=()=>{if(!document.hidden&&!document.body.classList.contains('intro-open')&&heroVisible&&!motion.matches){heroVideo.muted=true;heroVideo.play().catch(()=>{});}else heroVideo.pause();};
 new IntersectionObserver(entries=>{heroVisible=entries[0].isIntersecting;syncHero();},{threshold:.05}).observe(heroVideo);
 new MutationObserver(syncHero).observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',syncHero);motion.addEventListener('change',syncHero);
}

