import {isIP} from 'node:net';
export function requestDetails(req,env,optOut=false){
 if(optOut||req.headers['sec-gpc']==='1'||req.headers.dnt==='1')return {ip:'',country:'',region:'',city:'',latitude:'',longitude:'',locationSource:'Privacy preference'};
 const clean=(value,max=100)=>String(value||'').replace(/[\x00-\x1f\x7f]/g,'').slice(0,max);
 const decode=value=>{try{return clean(decodeURIComponent(value||''));}catch{return '';}};
 const trusted=env.VERCEL==='1',raw=String(trusted?req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress:req.socket?.remoteAddress).split(',')[0].trim();
 const coordinate=(value,max)=>{const number=Number(value);return value!==undefined&&value!==''&&Number.isFinite(number)&&Math.abs(number)<=max?number.toFixed(2):'';};
 return {ip:isIP(raw)?raw:'',country:trusted?clean(req.headers['x-vercel-ip-country'],3):'',region:trusted?decode(req.headers['x-vercel-ip-country-region']):'',city:trusted?decode(req.headers['x-vercel-ip-city']):'',latitude:trusted?coordinate(req.headers['x-vercel-ip-latitude'],90):'',longitude:trusted?coordinate(req.headers['x-vercel-ip-longitude'],180):'',locationSource:'Approximate IP location'};
}
