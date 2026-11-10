// Donation notifications never cache pages or private contribution data.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{let value;try{value=event.data?.json();}catch{return;}if(!value||typeof value.title!=='string'||typeof value.body!=='string')return;
 event.waitUntil(self.registration.showNotification(value.title.slice(0,100),{body:value.body.slice(0,400),icon:'/assets/harithayu-logo.png',badge:'/assets/notification-badge.svg',tag:String(value.tag||'harithayu').slice(0,100),data:{url:'/#community'},renotify:false}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const url=new URL('/#community',self.location.origin).href;const pages=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const page of pages){if(new URL(page.url).origin===self.location.origin){await page.navigate(url);return page.focus();}}return self.clients.openWindow(url);})());});

