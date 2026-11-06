// User-supplied nature recording with original interactive sound effects.
export function createSoundscape(){
 const buffers={};
 const button=document.querySelector('#sound-toggle'),audio=new Audio('/assets/lagoon-ambience.mp3');audio.loop=true;audio.preload='metadata';audio.volume=0;
 let ctx,bus,noise,active=false,muted=localStorage.getItem('harithayu-muted')==='true',mode='intro',ducked=false,fade,restore,lastWave=0,lastBird=0;
 function label(){const on=active&&!muted&&!document.hidden;button.textContent=(on?'♫ Sound on':'◌ Sound off');button.setAttribute('aria-pressed',String(on));button.setAttribute('aria-label',on?'Mute ambient sound':'Enable ambient sound');button.dataset.state=ctx?.state||'locked';}
 function mix(){clearInterval(fade);const target=muted||ducked||document.hidden?0:mode==='intro'?.55:0;fade=setInterval(()=>{audio.volume+=(target-audio.volume)*.13;if(Math.abs(target-audio.volume)<.002){audio.volume=target;clearInterval(fade);}},40);if(ctx)bus.gain.setTargetAtTime(muted||ducked?0:.22,ctx.currentTime,.2);label();}
 function setup(){if(ctx)return;const Engine=window.AudioContext||window.webkitAudioContext;if(!Engine)return;ctx=new Engine();bus=ctx.createGain();bus.gain.value=0;bus.connect(ctx.destination);noise=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);let brown=0;const data=noise.getChannelData(0);for(let i=0;i<data.length;i++){brown=(brown+Math.random()*.04-.02)/1.02;data[i]=brown*4;}ctx.onstatechange=label;for(const [name,path] of [['wave','water-flow-scroll.mp3'],['bird','bird-touch.mp3']])fetch('/assets/'+path).then(r=>{if(!r.ok)throw Error();return r.arrayBuffer();}).then(b=>ctx.decodeAudioData(b)).then(b=>buffers[name]=b).catch(()=>{});}
 function dip(){clearTimeout(restore);clearInterval(fade);audio.volume=Math.min(audio.volume,.09);restore=setTimeout(mix,1200);}
 function effect(name,volume){if(mode!=='page'||!active||muted||ducked||!ctx||ctx.state!=='running'||!buffers[name])return;dip();const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffers[name];gain.gain.value=volume;source.connect(gain);gain.connect(bus);source.start();source.onended=()=>{source.disconnect();gain.disconnect();};}
 function wave(){if(Date.now()-lastWave<3100)return;lastWave=Date.now();effect('wave',.7);}
 function bird(){if(Date.now()-lastBird<2400)return;lastBird=Date.now();effect('bird',.6);}
 function start(next=mode){mode=next;if(muted)return;setup();
  if(ctx)ctx.resume().then(()=>{active=true;mix();}).catch(()=>{});
  if(mode==='intro'){audio.volume=ducked?0:.55;audio.play().then(()=>{active=true;mix();}).catch(()=>{label();});}
  else {audio.pause();active=Boolean(ctx);mix();}
 }
 button.addEventListener('click',()=>{muted=active?!muted:false;localStorage.setItem('harithayu-muted',String(muted));if(muted){audio.pause();ctx?.suspend();active=false;mix();}else start();});
 function unlock(event){if(event.target.closest?.('#sound-toggle'))return;if(!muted&&(!active||ctx?.state!=='running'))start(mode);}
 document.addEventListener('pointerdown',unlock,{passive:true});document.addEventListener('keydown',e=>{if(['Enter',' ','Tab'].includes(e.key))unlock(e);});
 document.addEventListener('pointerup',e=>{if(!e.target.closest?.('#sound-toggle')&&mode==='page'){unlock(e);setTimeout(bird,70);}});document.addEventListener('click',e=>{if(e.detail===0&&e.target.closest?.('button,a'))bird();});
 let previous=scrollY;document.addEventListener('scroll',()=>{if(Math.abs(scrollY-previous)>30){wave();previous=scrollY;}},{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.pause();ctx?.suspend();active=false;label();}else if(!muted)start(mode);});
 window.addEventListener('pagehide',()=>{audio.pause();ctx?.suspend();clearInterval(fade);clearTimeout(restore);});
 label();
 return {start,page(){mode='page';audio.pause();audio.currentTime=0;clearTimeout(restore);mix();},intro(){mode='intro';audio.currentTime=0;mix();},duck(value){ducked=value;mix();}};
}
