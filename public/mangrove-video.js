// User-supplied film; playback begins directly from the visitor's gesture.
export function createMangroveIntro(video,{reducedMotion=false,onStage=()=>{}}={}) {
  let complete=null,active=false;
  const progress=document.querySelector('.intro-growth-track>span');
  video.muted=true;video.playsInline=true;
  function update(){if(!active)return;const p=Number.isFinite(video.duration)&&video.duration?video.currentTime/video.duration:0;if(progress)progress.style.transform=`scaleX(${p})`;onStage(p<.23?0:p<.48?1:p<.83?2:3);}
  video.addEventListener('timeupdate',update);
  video.addEventListener('ended',()=>{if(!active)return;active=false;const done=complete;complete=null;done?.();});
  video.addEventListener('error',()=>{if(active){onStage(-2);document.querySelector('#skip-intro')?.focus();}});
  return {
    reset(){active=false;complete=null;video.pause();video.currentTime=0;if(progress)progress.style.transform='scaleX(0)';},
    start(done){if(reducedMotion){done();return;}complete=done;active=true;onStage(-1);video.play().catch(()=>{onStage(-2);const b=document.querySelector('#enter-text');b.disabled=false;b.textContent=document.documentElement.lang==='si'?'වීඩියෝව නැවත අරඹන්න →':'Retry film →';document.querySelector('#intro').classList.remove('growing');});},
    stop(){active=false;complete=null;video.pause();}
  };
}
