// A real tree cutout, revealed in botanical stages over a procedural lagoon.
// Animation is decorative; all navigation remains in ordinary HTML buttons.
export function createMangroveIntro(canvas,{reducedMotion=false,onStage=()=>{}}={}) {
  const ctx=canvas.getContext('2d',{alpha:false});
  const treeLayer=document.createElement('canvas'),treeCtx=treeLayer.getContext('2d');
  const image=new Image();image.decoding='async';image.src='/assets/mangrove-intro.webp';
  const forest=new Image();forest.decoding='async';forest.src='/assets/mangroves.jpg';
  const ready=new Promise(resolve=>{image.onload=()=>resolve(true);image.onerror=()=>resolve(false);});
  let width=0,height=0,ground=0,frame=0,lastFrame=0,started=0,active=false,growing=false,complete=null,phase=-1;
  let loaded=false;ready.then(value=>loaded=value);
  const clamp=n=>Math.min(1,Math.max(0,n));
  const ease=n=>{n=clamp(n);return n*n*(3-2*n);};
  function resize(){
    width=canvas.clientWidth;height=canvas.clientHeight;ground=height*.625;
    const dpr=Math.min(window.devicePixelRatio || 1,1.5);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx?.setTransform(dpr,0,0,dpr,0,0);
    treeLayer.width=Math.ceil(width);treeLayer.height=Math.ceil(height);
  }
  function background(time){
    const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#061d1c');sky.addColorStop(.58,'#153c33');sky.addColorStop(.64,'#163e35');sky.addColorStop(1,'#041919');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
    const light=ctx.createRadialGradient(width*.53,ground*.56,0,width*.53,ground*.56,width*.56);light.addColorStop(0,'#bbce8f1b');light.addColorStop(.45,'#87aa6a0b');light.addColorStop(1,'#87aa6a00');ctx.fillStyle=light;ctx.fillRect(0,0,width,ground);
    // Faint photographic texture supplies depth without competing with the tree.
    if(forest.complete&&forest.naturalWidth){ctx.save();ctx.globalAlpha=.12;ctx.filter='blur(8px)';const cover=Math.max(width/forest.naturalWidth,ground/forest.naturalHeight);ctx.drawImage(forest,(width-forest.naturalWidth*cover)/2,(ground-forest.naturalHeight*cover)/2,forest.naturalWidth*cover,forest.naturalHeight*cover);ctx.restore();}
    const water=ctx.createLinearGradient(0,ground,0,height);water.addColorStop(0,'#1a4136');water.addColorStop(.24,'#102f2b');water.addColorStop(1,'#03191a');ctx.fillStyle=water;ctx.fillRect(0,ground,width,height-ground);
    ctx.strokeStyle='#b6ccb4';ctx.lineWidth=.6;
    for(let line=0;line<24;line++){const y=ground+6+line*line*.48;ctx.globalAlpha=.035+(line%3)*.01;ctx.beginPath();for(let x=0;x<=width;x+=10){const yy=y+Math.sin(x*.015+time*.0007+line*1.8)*(1+line*.045);if(x===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);}ctx.stroke();}
    ctx.globalAlpha=1;
    // Sparse, slow fireflies. Fixed positions avoid random layout flicker.
    for(let i=0;i<13;i++){const x=width*(.13+((i*37)%73)/100)+Math.sin(time*.00025+i)*8,y=ground*(.25+((i*19)%60)/100)+Math.cos(time*.0003+i*2)*8;ctx.globalAlpha=(.18+Math.sin(time*.001+i*2)*.12);ctx.fillStyle='#d8e4a8';ctx.beginPath();ctx.arc(x,y,i%3===0?1.5:.8,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
  }
  function seedling(time,opacity=1){
    ctx.save();ctx.globalAlpha=opacity;ctx.translate(width/2,ground-2);ctx.rotate(Math.sin(time*.0008)*.018);
    ctx.strokeStyle='#91ae6d';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,3);ctx.bezierCurveTo(-6,-15,6,-35,2,-62);ctx.stroke();
    const leaf=ctx.createLinearGradient(-30,-60,25,-95);leaf.addColorStop(0,'#416a3b');leaf.addColorStop(.5,'#94b66c');leaf.addColorStop(1,'#d5d99c');ctx.fillStyle=leaf;
    ctx.beginPath();ctx.moveTo(2,-47);ctx.bezierCurveTo(-8,-71,-30,-70,-31,-85);ctx.bezierCurveTo(-4,-93,7,-67,2,-47);ctx.fill();
    ctx.beginPath();ctx.moveTo(3,-62);ctx.bezierCurveTo(8,-92,30,-100,34,-95);ctx.bezierCurveTo(38,-72,13,-60,3,-62);ctx.fill();
    ctx.strokeStyle='#c4d69b';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(1,-49);ctx.lineTo(-24,-80);ctx.moveTo(4,-62);ctx.lineTo(29,-90);ctx.stroke();ctx.restore();
  }
  function tree(time,elapsed){
    const roots=ease(elapsed/1100),trunk=ease((elapsed-650)/1750),canopy=ease((elapsed-1800)/1950),settle=ease((elapsed-3400)/650);
    const treeHeight=Math.min(height*.52,width*1.18,650),treeWidth=treeHeight*image.naturalWidth/image.naturalHeight;
    const growthScale=.74+.26*ease(elapsed/4000),drawH=treeHeight*growthScale,drawW=treeWidth*growthScale;
    const sway=reducedMotion?0:Math.sin(time*.00065)*.002;
    const x=(width-drawW)/2,y=ground-drawH*.995;
    treeCtx.clearRect(0,0,width,height);
    treeCtx.save();treeCtx.translate(width/2,ground);treeCtx.rotate(sway);treeCtx.translate(-width/2,-ground);
    treeCtx.drawImage(image,x,y,drawW,drawH);
    treeCtx.globalCompositeOperation='destination-in';treeCtx.fillStyle='#fff';
    if(settle===1)treeCtx.fillRect(x,y,drawW,drawH);
    else {
      // Wide prop roots unfold outward before the trunk climbs from the water.
      const masks=new Path2D();
      masks.ellipse(width/2,ground-drawH*.19,Math.max(.01,drawW*.52*roots),Math.max(.01,drawH*.27*roots),0,0,Math.PI*2);
      const trunkTop=ground-drawH*(.19+.48*trunk);
      masks.rect(x+drawW*.33,trunkTop,drawW*.32,Math.max(1,ground-drawH*.14-trunkTop));
      if(canopy>0)masks.ellipse(width/2,y+drawH*.30,drawW*.61*canopy,drawH*.48*canopy,0,0,Math.PI*2);
      treeCtx.fill(masks);
      if(settle>0){treeCtx.globalCompositeOperation='destination-over';treeCtx.globalAlpha=settle;treeCtx.drawImage(image,x,y,drawW,drawH);treeCtx.globalAlpha=1;}
    }
    treeCtx.globalCompositeOperation='source-over';treeCtx.restore();
    // A distorted reflection is drawn in thin horizontal bands, fading with depth.
    const depth=Math.min(height*.19,150);
    for(let dy=0;dy<depth;dy+=3){const sourceY=Math.max(0,ground-dy*2-3);ctx.globalAlpha=.20*(1-dy/depth);ctx.drawImage(treeLayer,0,sourceY,width,4,Math.sin(time*.001+dy*.1)*2.2,ground+dy,width,3);}
    ctx.globalAlpha=1;ctx.drawImage(treeLayer,0,0);
    seedling(time,1-ease(elapsed/900));
    // Expanding water rings make the initial touch feel anchored in the lagoon.
    for(let i=0;i<3;i++){const p=clamp((elapsed-i*350)/2000);if(p>0&&p<1){ctx.globalAlpha=(1-p)*.22;ctx.strokeStyle='#c9d6b0';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(width/2,ground+5,20+p*130,3+p*17,0,0,Math.PI*2);ctx.stroke();}}ctx.globalAlpha=1;
  }
  function draw(time){
    if(!active||!ctx)return;
    frame=requestAnimationFrame(draw);if(time-lastFrame<32&&!reducedMotion)return;lastFrame=time;
    background(time);
    if(growing&&loaded){const elapsed=reducedMotion?4500:time-started;tree(time,elapsed);const next=elapsed<1100?0:elapsed<2200?1:elapsed<3900?2:3;if(next!==phase){phase=next;onStage(next);}
      if(elapsed>4900||reducedMotion){growing=false;const done=complete;complete=null;done?.();}
    }else if(!growing&&phase===3&&loaded)tree(time,4500);
    else seedling(time);
  }
  function reset(){cancelAnimationFrame(frame);active=true;growing=false;phase=-1;lastFrame=0;resize();frame=requestAnimationFrame(draw);}
  async function start(done){
    complete=done;onStage(-1);const ok=await ready;if(!active)return;
    if(!ok||!ctx){done();return;}
    started=performance.now();growing=true;phase=-1;
  }
  function stop(){active=false;growing=false;complete=null;cancelAnimationFrame(frame);}
  const observer=new ResizeObserver(()=>{if(active)resize();});observer.observe(canvas);
  return {reset,start,stop};
}
