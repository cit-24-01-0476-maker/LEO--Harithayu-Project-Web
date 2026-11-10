import {test} from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';import webpush from 'web-push';import {createStore} from '../server/store.mjs';import {createPushService,donationPush,notificationMessage,validateSubscription} from '../server/push-service.mjs';
const sub=(id='one')=>({endpoint:'https://fcm.googleapis.com/fcm/send/'+id,keys:{p256dh:webpush.generateVAPIDKeys().publicKey,auth:randomBytes(16).toString('base64url')}});
test('persistent push queue sends consent-safe donation messages once per subscription, cleans expired endpoints and retries temporary errors',async()=>{
 const store=createStore(':memory:'),sent=[],subscription=sub();let mode='ok';const sender={generateVAPIDKeys:webpush.generateVAPIDKeys,async sendNotification(s,p,options){assert.ok(options.vapidDetails.privateKey);if(mode==='gone')throw {statusCode:410};if(mode==='retry')throw {statusCode:503};sent.push({s,p:JSON.parse(p)});}};
 const push=createPushService(store,{},sender);try{
 const publicKey=await push.publicKey();assert.equal(publicKey.length,87);assert.equal(await push.publicKey(),publicKey);
 await push.subscribe(subscription,'en');await push.drain();assert.equal(sent.length,1);assert.match(sent[0].p.body,/connected/);
 await push.subscribe(subscription,'en');await push.drain();assert.equal(sent.length,1);
 const donation={id:'a'.repeat(24),name:'PRIVATE NAME',amount:500,publicName:false,autoAccepted:true};await push.enqueue(donation);await push.enqueue(donation);await push.drain();assert.equal(sent.length,2);assert.match(sent[1].p.body,/anonymous supporter submitted LKR 500/);assert.ok(!JSON.stringify(sent).includes('PRIVATE NAME'));assert.equal(sent[1].p.url,'/#community');assert.equal(sent[1].p.tag,'donation-'+donation.id);
 await push.drain();assert.equal(sent.length,2);
 mode='retry';await push.enqueue({...donation,id:'b'.repeat(24)});await push.drain();const due=await store.claimPush(Date.now()+180000);assert.equal(due.length,1);await store.finishPush(due[0]);
 mode='gone';await push.enqueue({...donation,id:'c'.repeat(24)});await push.drain();assert.equal((await store.claimPush(Date.now()+180000)).length,0);
 await push.unsubscribe(subscription);assert.equal((await store.claimPush()).length,0);
 }finally{store.close();}
});
test('push subscription validation prevents arbitrary outbound requests and messages respect name consent',()=>{
 const good=sub();assert.deepEqual(validateSubscription(good),good);for(const endpoint of ['http://fcm.googleapis.com/a','https://127.0.0.1/x','https://fcm.googleapis.com.evil.com/a','https://user:pass@fcm.googleapis.com/a','https://fcm.googleapis.com:8443/a'])assert.throws(()=>validateSubscription({...good,endpoint}));assert.throws(()=>validateSubscription({...good,keys:{p256dh:'x',auth:'bad'}}));
 assert.equal(donationPush({id:'id',name:'Secret',amount:100,public_name:0}).name,'Anonymous');const message=notificationMessage(donationPush({id:'id',name:'A Donor',amount:100,public_name:1,auto_accepted:1}),'en');assert.match(message.body,/A Donor submitted LKR 100/);assert.ok(!message.body.includes('verified'));
});

