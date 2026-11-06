// Original procedural lagoon ambience and a quiet pentatonic score.
// No recordings, external audio requests, or changes to the supplied video.
export function createSoundscape(){
  let context,master,water,pad,mode='intro',timer,muted=localStorage.getItem('harithayu-muted')==='true',ducked=false;
  const button=document.querySelector('#sound-toggle');
  function label(){const si=document.documentElement.lang==='si';button.textContent=(muted||!context)?'◌ '+(si?'හඬ අක්‍රියයි':'Sound off'):'♫ '+(si?'හඬ සක්‍රියයි':'Sound on');button.setAttribute('aria-pressed',String(!muted&&Boolean(context)));button.setAttribute('aria-label',(muted||!context)?'Enable ambient sound':'Mute ambient sound');}
  function gain(){if(!context)return;master.gain.cancelScheduledValues(context.currentTime);master.gain.setTargetAtTime(muted||ducked?0:mode==='intro'?.19:.11,context.currentTime,.5);}
  function note(frequency,at,length=6,volume=.1){const oscillator=context.createOscillator(),voice=context.createGain(),filter=context.createBiquadFilter();oscillator.type='sine';oscillator.frequency.value=frequency;filter.type='lowpass';filter.frequency.value=1100;voice.gain.setValueAtTime(0,at);voice.gain.linearRampToValueAtTime(volume,at+1.1);voice.gain.exponentialRampToValueAtTime(.0001,at+length);oscillator.connect(filter);filter.connect(voice);voice.connect(pad);oscillator.start(at);oscillator.stop(at+length+.1);oscillator.onended=()=>{oscillator.disconnect();filter.disconnect();voice.disconnect();};}
  function phrase(){if(!context||context.state!=='running'||muted||ducked)return;const now=context.currentTime;const tones=[146.83,174.61,220,261.63,293.66];const n=phrase.index++%tones.length;note(tones[n],now,8,.10);note(tones[(n+2)%tones.length]*2,now+1.8,5,.025);}
  phrase.index=0;
  function setup(){if(context)return;const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;context=new Audio();master=context.createGain();master.gain.value=0;master.connect(context.destination);water=context.createGain();water.gain.value=.15;water.connect(master);pad=context.createGain();pad.gain.value=.55;pad.connect(master);
    const buffer=context.createBuffer(1,context.sampleRate*8,context.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){last=(last+Math.random()*.04-.02)/1.02;data[i]=last*3;}
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),swell=context.createOscillator(),depth=context.createGain();source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=650;source.connect(filter);filter.connect(water);swell.frequency.value=.13;depth.gain.value=.045;swell.connect(depth);depth.connect(water.gain);source.start();swell.start();timer=setInterval(phrase,4200);
    context.onstatechange=()=>{button.dataset.state=context.state;};
  }
  function start(next='intro'){mode=next;setup();if(!context)return;context.resume().then(()=>{gain();phrase();}).catch(()=>{});label();}
  button.addEventListener('click',()=>{muted=context?!muted:false;localStorage.setItem('harithayu-muted',String(muted));if(!muted)start(mode);gain();label();});
  document.addEventListener('visibilitychange',()=>{if(!context)return;if(document.hidden)context.suspend();else if(!muted)context.resume().catch(()=>{});});
  window.addEventListener('pagehide',()=>{clearInterval(timer);context?.close();});
  new MutationObserver(label).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});label();
  return {start,page(){mode='page';gain();},intro(){mode='intro';gain();},duck(value){ducked=value;gain();}};
}
