// Background recording extracted from the user-supplied WhatsApp video.
// No scroll, bird, touch or generated sound effects are registered.
export function createSoundscape(){
 const button=document.querySelector('#sound-toggle');
 const audio=document.createElement('audio');audio.id='harithayu-background-audio';audio.src='/assets/harithayu-background-voice.mp3';audio.loop=true;audio.preload='auto';audio.volume=0;audio.hidden=true;document.body.append(audio);
 let armed=false,mode='intro',muted=localStorage.getItem('harithayu-muted')==='true',ducked=false,fade,attempt;
 function label(){const on=!audio.paused&&!muted&&!document.hidden;button.textContent=on?'♫ Sound on':'◌ Sound off';button.setAttribute('aria-pressed',String(on));button.setAttribute('aria-label',on?'Mute background recording':'Play background recording');button.dataset.state=on?'playing':'paused';}
 function mix(){clearInterval(fade);const target=muted||document.hidden||!['page','intro'].includes(mode)?0:ducked?.08:mode==='intro'?.36:.42;fade=setInterval(()=>{audio.volume+=(target-audio.volume)*.15;if(Math.abs(target-audio.volume)<.002){audio.volume=target;clearInterval(fade);}},40);label();}
 function start(next=mode,enableSound=false){mode=next;if(enableSound){armed=true;muted=false;localStorage.setItem('harithayu-muted','false');}if(!armed||!['page','intro'].includes(mode)||muted||document.hidden){audio.pause();mix();return;}if(attempt)return;if(audio.paused)audio.volume=mode==='intro'?.36:.42;attempt=audio.play().then(()=>{mix();}).catch(()=>{label();}).finally(()=>{attempt=null;});}
 button.addEventListener('click',()=>{armed=true;muted=!muted;localStorage.setItem('harithayu-muted',String(muted));if(muted){audio.pause();mix();}else start();});
 function unlock(event){if(event.target.closest?.('#sound-toggle'))return;if(!document.querySelector('#intro:not([hidden]):not(.growing)')&&!muted&&audio.paused)start();}
 document.addEventListener('pointerdown',unlock,{passive:true});document.addEventListener('keydown',event=>{if(['Enter',' ','Tab'].includes(event.key))unlock(event);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.pause();mix();}else start();});
 audio.addEventListener('play',label);audio.addEventListener('pause',label);audio.addEventListener('error',label);
 window.addEventListener('pagehide',()=>{audio.pause();clearInterval(fade);});label();
 return {start,page(){mode='page';start();},intro(){armed=false;mode='intro';audio.pause();audio.currentTime=0;mix();},duck(value){ducked=value;mix();}};
}
