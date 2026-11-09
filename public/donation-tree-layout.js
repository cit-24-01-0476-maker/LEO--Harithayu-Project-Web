// Place readable cards within the displayed tree image, rather than viewport %.
export function donationTreeLayout(width,height,count){
  const mobile=width<650,gap=mobile?10:16;
  const imageWidth=Math.min(width,height*4/3),imageHeight=imageWidth*.75;
  const area={x:(width-imageWidth)/2+imageWidth*.05,y:(height-imageHeight)/2+imageHeight*.05,width:imageWidth*.9,height:imageHeight*.7};
  const density=count>(mobile?6:18)?'compact':count>(mobile?3:8)?'balanced':'roomy';
  const sizes=mobile?{roomy:[106,104],balanced:[92,82],compact:[80,66]}:{roomy:[146,126],balanced:[120,100],compact:[96,76]};
  let [cardWidth,cardHeight]=sizes[density];cardWidth=Math.min(cardWidth,area.width);cardHeight=Math.min(cardHeight,area.height);
  const maxColumns=Math.max(1,Math.floor((area.width+gap)/(cardWidth+gap))),maxRows=Math.max(1,Math.floor((area.height+gap)/(cardHeight+gap)));
  const visible=Math.min(count,maxColumns*maxRows),columns=Math.min(maxColumns,Math.max(1,visible)),rows=Math.ceil(visible/columns);
  const positions=Array.from({length:visible},(_,i)=>{
    const row=Math.floor(i/columns),rowCount=Math.min(columns,visible-row*columns),column=i%columns;
    return {x:area.x+area.width/2+(column-(rowCount-1)/2)*(cardWidth+gap),y:area.y+area.height/2+(row-(rows-1)/2)*(cardHeight+gap)};
  });
  return {density,cardWidth,cardHeight,positions,visible};
}
