export function initDonationNotifications(language=()=>document.documentElement.lang){
 const enter=document.querySelector('#welcome-enter'),enable=document.querySelector('#enable-notifications'),status=document.querySelector('#notification-status'),settings=document.querySelector('#notification-settings');
 const si=()=>language()==='si';const say=(a,b)=>status.textContent=si()?a:b;
 let registration,publicKey,active=false;
 const supported=window.isSecureContext&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
 const installed=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const bounded=(promise,ms=30000)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Connection timed out')),ms);})]).finally(()=>clearTimeout(timer));};
 const preferenceOff=()=>{try{return localStorage.getItem('harithayu-push-off')==='true';}catch{return false;}};
 const unlock=()=>{enter.hidden=false;enable.hidden=true;};
 const labels=()=>{settings.textContent=active?(si()?'දැනුම්දීම් සක්‍රීයයි · නවත්වන්න':'Notifications on · Turn off'):(si()?'දායකත්ව දැනුම්දීම්':'Donation notifications');settings.setAttribute('aria-pressed',String(active));};
 const post=(url,value)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value),signal:AbortSignal.timeout(20000)}).then(async r=>{if(!r.ok)throw Error('Subscription unavailable');return r.json();});
 const keyBytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
 async function subscribe(){registration=registration||await bounded(navigator.serviceWorker.ready);let subscription=await bounded(registration.pushManager.getSubscription());if(!subscription)subscription=await bounded(registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(publicKey)}));await post('/api/push/subscribe',{subscription:subscription.toJSON(),language:si()?'si':'en'});active=true;try{localStorage.removeItem('harithayu-push-off');}catch{}labels();unlock();say('දායකත්ව දැනුම්දීම් සක්‍රීයයි. හරිත ගමනට පිවිසෙන්න.','Donation updates are on. Welcome to our growing community.');}
 let ready;
 async function request(){if(!supported||ios&&!installed){say('iPhone එකේ Share → Add to Home Screen තෝරා එතැනින් විවෘත කරන්න.','On iPhone, use Share → Add to Home Screen, then open the app.');unlock();return;}enable.disabled=true;say('Browser එකේ පෙන්වන popup එකෙන් Allow තෝරන්න.','Choose Allow in your browser’s permission popup.');try{
  // Call permission directly in the click handler before awaiting network work.
  const permission=Notification.permission==='granted'?'granted':await bounded(Notification.requestPermission(),90000);await ready;
  if(permission!=='granted'){say('දැනුම්දීම් අවසරය browser site settings වලින් Allow කර නැවත උත්සාහ කරන්න.','Allow notifications in your browser’s site settings, then try again.');return;}
  unlock();if(!publicKey)return;await subscribe();
 }catch{say('දැනුම්දීම් සම්බන්ධ කළ නොහැකි විය. නැවත උත්සාහ කරන්න.','Notifications could not connect. Please try again.');}finally{enable.disabled=false;}}
 enable.addEventListener('click',request);
 settings.addEventListener('click',async()=>{if(!active){request();return;}settings.disabled=true;try{const subscription=await registration?.pushManager.getSubscription();if(subscription){await post('/api/push/unsubscribe',{subscription:subscription.toJSON()});await subscription.unsubscribe();}active=false;try{localStorage.setItem('harithayu-push-off','true');}catch{}labels();say('දැනුම්දීම් නතර කළා.','Donation notifications are off.');}catch{say('දැනුම්දීම් වෙනස් කළ නොහැකි විය. නැවත උත්සාහ කරන්න.','Could not update notification settings. Please retry.');}finally{settings.disabled=false;}});
 enter.hidden=true;labels();
 ready=(async()=>{if(!supported||ios&&!installed){unlock();say(ios?'දැනුම්දීම් සඳහා iPhone එකේ Share → Add to Home Screen භාවිත කරන්න.':'මේ browser එකේ push notifications සහාය නැහැ. Website එකට පිවිසිය හැක. ',ios?'For iPhone notifications, use Share → Add to Home Screen.':'This browser does not support push notifications. You can still enter the website.');return;}
 try{const r=await fetch('/api/push/config',{signal:AbortSignal.timeout(20000)});const config=await r.json();if(!r.ok||!config.enabled){unlock();say('දැනුම්දීම් දැනට ලබාගත නොහැක.','Notifications are temporarily unavailable.');return;}publicKey=config.publicKey;registration=await bounded(navigator.serviceWorker.register('/sw.js',{scope:'/'}));await bounded(navigator.serviceWorker.ready);if(preferenceOff()){unlock();enable.hidden=false;say('ඔබ දැනුම්දීම් නතර කර ඇත. නැවත සක්‍රීය කළ හැකියි.','You turned notifications off. You can enable them again anytime.');}else if(Notification.permission==='granted'){unlock();await subscribe();}else{enable.hidden=false;say('අලුත් දායකත්වයක් සමඟ නම සහ මුදල දැනගන්න. Allow notifications තෝරන්න.','Get each new contribution’s public donor name and amount. Choose Allow notifications.');enable.focus({preventScroll:true});}}
 catch{unlock();say('දැනුම්දීම් දැනට ලබාගත නොහැක.','Notifications are temporarily unavailable.');}})();
 new MutationObserver(labels).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 return {ready};
}

