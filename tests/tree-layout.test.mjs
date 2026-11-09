import {test} from 'node:test';
import assert from 'node:assert/strict';
import {donationTreeLayout} from '../public/donation-tree-layout.js';

test('tree labels shrink with donation count and stay separated inside mobile and desktop stages',()=>{
 for(const width of [280,350,390,600,900,1080]){
  const height=Math.max(320,Math.min(760,width*.75));
  const roomy=donationTreeLayout(width,height,2),dense=donationTreeLayout(width,height,100);
  assert.ok(dense.cardWidth<roomy.cardWidth);assert.ok(dense.visible>0);
  for(const count of [0,1,2,4,6,12,30,100,500]){
   const layout=donationTreeLayout(width,height,count);assert.equal(layout.positions.length,layout.visible);assert.ok(layout.visible<=count);
   for(const p of layout.positions){assert.ok(p.x-layout.cardWidth/2>=-1);assert.ok(p.x+layout.cardWidth/2<=width+1);assert.ok(p.y-layout.cardHeight/2>=-1);assert.ok(p.y+layout.cardHeight/2<=height+1);}
   for(let i=0;i<layout.positions.length;i++)for(let j=i+1;j<layout.positions.length;j++){
    const a=layout.positions[i],b=layout.positions[j];assert.ok(Math.abs(a.x-b.x)>=layout.cardWidth+8||Math.abs(a.y-b.y)>=layout.cardHeight+8,'labels must not overlap, including sway space');
   }
  }
 }
});
