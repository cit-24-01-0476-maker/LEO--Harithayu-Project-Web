import webpush from 'web-push';
export function validateSubscription(value){
 if(!value||typeof value.endpoint!=='string'||value.endpoint.length>4096)throw Error('Invalid push subscription');
 const u=new URL(value.endpoint),host=u.hostname;
 const allowed=['fcm.googleapis.com','android.googleapis.com','updates.push.services.mozilla.com','updates-autopush.stage.mozaws.net','web.push.apple.com'].includes(host)||host.endsWith('.push.services.mozilla.com')||host.endsWith('.notify.windows.com');
 if(u.protocol!=='https:'||u.username||u.password||u.hash||(u.port&&u.port!=='443')||!allowed)throw Error('Unsupported push service');
 const {p256dh,auth}=value.keys||{};if(!/^[A-Za-z0-9_-]{86,88}$/.test(p256dh||'')||!(/^[A-Za-z0-9_-]{22,24}$/).test(auth||'')||Buffer.from(p256dh,'base64url').length!==65||Buffer.from(auth,'base64url').length!==16)throw Error('Invalid push encryption keys');
 return {endpoint:value.endpoint,keys:{p256dh,auth}};
}
export function donationPush(d){return {id:d.id,name:(d.publicName===true||d.public_name===1)?String(d.name).slice(0,100):'Anonymous',amount:Number(d.amount),seedlings:Math.floor(Number(d.amount)/100),submitted:d.autoAccepted===true||d.auto_accepted===1};}
export function notificationMessage(d,language='en'){
 if(d.kind==='welcome')return {title:'Harithayu 🌱',body:language==='si'?'ඔබ දැනුම්දීම් සමඟ සම්බන්ධයි. අලුත් දායකත්වයන් මෙතැනින් දැනගන්න.':'You’re connected. New donation updates will appear here. Thank you for growing with us!',tag:'harithayu-welcome',url:'/#community',icon:'/assets/harithayu-logo.png'};
 const amount=Number(d.amount).toLocaleString('en-LK'),name=d.name==='Anonymous'?(language==='si'?'නිර්නාමික දායකයෙක්':'An anonymous supporter'):d.name;
 return {title:language==='si'?'හරිතායු · අලුත් දායකත්වයක් 🌱':'Harithayu · A new contribution 🌱',body:language==='si'?`${name} වෙතින් රු. ${amount}ක ${d.submitted?'යැවූ දායකත්වයක්':'තහවුරු කළ දායකත්වයක්'}. පැළ ${d.seedlings}කට හරිත හෙටක්!`:`${name} ${d.submitted?'submitted':'contributed'} LKR ${amount} towards ${d.seedlings} mangrove seedling${d.seedlings===1?'':'s'}. A greener tomorrow grows!`,tag:'donation-'+d.id,url:'/#community',icon:'/assets/harithayu-logo.png',badge:'/assets/notification-badge.svg'};
}
export function createPushService(store,env={},sender=webpush){
 if(!store?.pushKeys)return null;let keysPromise;
 const keys=()=>keysPromise||(keysPromise=store.pushKeys(sender.generateVAPIDKeys()).catch(e=>{keysPromise=null;throw e;}));
 let draining;
 return {async publicKey(){return (await keys()).publicKey;},async subscribe(sub,lang){const saved=await store.savePush(validateSubscription(sub),lang==='si'?'si':'en');if(saved.created)await store.enqueuePushFor(saved.id,'welcome-'+saved.id,{kind:'welcome'});},async unsubscribe(sub){await store.removePush(validateSubscription(sub).endpoint);},async enqueue(d){await store.enqueuePush(d.id,donationPush(d));},
 drain(){if(draining)return draining;draining=(async()=>{const k=await keys(),start=Date.now();while(Date.now()-start<210000){const rows=await store.claimPush();if(!rows.length)break;for(let i=0;i<rows.length;i+=5)await Promise.all(rows.slice(i,i+5).map(async row=>{try{await sender.sendNotification(JSON.parse(row.subscription),JSON.stringify(notificationMessage(JSON.parse(row.payload),row.language)),{vapidDetails:{subject:'mailto:'+(env.CONTACT_EMAIL||'oshadhaperera500@gmail.com'),publicKey:k.publicKey,privateKey:k.privateKey},TTL:86400,urgency:'normal',timeout:10000});await store.finishPush(row);}catch(error){if([404,410].includes(error.statusCode)){await store.removePush(JSON.parse(row.subscription).endpoint);}else await store.finishPush(row,true);}}));}})().finally(()=>{draining=null;});return draining;}
 };
}

