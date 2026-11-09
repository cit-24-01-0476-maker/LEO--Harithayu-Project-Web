export function presentDonation(d){
 let audit={};try{const parsed=JSON.parse(d.audit_json||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&Date.parse(d.created_at)>Date.now()-90*86400000)audit=parsed;}catch{}
 return {...d,audit_json:undefined,requestDetails:audit,displayStatus:d.archived_at?'Archived':d.auto_accepted===1&&d.status==='confirmed'?'Accepted automatically':d.status};
}
export async function createAdminReport(donations,traffic,origin){
 const {default:ExcelJS}=await import('exceljs');const book=new ExcelJS.Workbook();book.creator='Leo Club of SLTC';book.created=new Date();
 function sheet(name,headers,rows,widths){
  const s=book.addWorksheet(name,{views:[{state:'frozen',ySplit:4}]});s.mergeCells(1,1,1,Math.min(headers.length,6));s.getCell('A1').value='Harithayu · '+name;s.getCell('A1').font={size:18,bold:true,color:{argb:'FF204B38'}};
  s.mergeCells(2,1,2,Math.min(headers.length,8));s.getCell('A2').value='PRIVATE ADMIN EXPORT · Times in UTC · IP location is approximate · Visitor retention: 90 days';s.getCell('A2').font={size:10,color:{argb:'FF667365'}};
  s.addTable({name:name.replace(/[^a-z]/gi,'')+'Data',ref:'A4',headerRow:true,style:{theme:'TableStyleMedium4',showRowStripes:true},columns:headers.map(name=>({name})),rows:rows.length?rows:[headers.map(()=>null)]});
  s.columns.forEach((c,i)=>{c.width=widths?.[i]||22;});s.getRow(4).height=30;s.getRow(4).alignment={vertical:'middle',wrapText:true};s.autoFilter={from:{row:4,column:1},to:{row:4,column:headers.length}};
  return s;
 }
 const rows=donations.map(presentDonation);
 sheet('Donations',['Submission ID','Name','Amount LKR','Phone','Email','Bank reference','Status','Submitted UTC','Accepted UTC','Public name consent','Archived UTC','IP address','City','Region','Country','Approx latitude','Approx longitude','Private proof'],rows.map(d=>[d.id,d.name,d.amount,d.phone||'',d.email,d.reference,d.displayStatus,d.created_at,d.confirmed_at||'',d.public_name===1?'Yes':'No',d.archived_at||'',d.requestDetails.ip||'',d.requestDetails.city||'',d.requestDetails.region||'',d.requestDetails.country||'',d.requestDetails.latitude||'',d.requestDetails.longitude||'',d.has_slip?{text:'Open private proof (admin sign-in)',hyperlink:origin+'/admin?slip='+d.id}:null]));
 book.getWorksheet('Donations').getColumn(3).numFmt='#,##0.00';
 for(const name of ['Visitors','Page views']){
  const data=name==='Visitors'?traffic.visitors:traffic.views;
  sheet(name,['Session ID','First seen UTC','Last seen UTC','Path','IP address','City','Region','Country','Approx latitude','Approx longitude'],data.map(v=>[v.visitor_id||v.id,new Date(Number(v.first_seen||v.seen_at)).toISOString(),new Date(Number(v.last_seen||v.seen_at)).toISOString(),v.path,v.ip,v.city,v.region,v.country,v.latitude,v.longitude]));
 }
 return book.xlsx.writeBuffer();
}
