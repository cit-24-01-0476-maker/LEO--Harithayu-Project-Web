// Run setupHarithayu() once in a standalone Google Apps Script project.
// Existing form questions are preserved. The owner must review any unrelated required questions.
const HARITHAYU_FORM_ID='1ZP8nLGEvPMhZgOAuKD90vdiQtBLCEKiJTVGBDMkInBk';
const BRIDGE_FIELDS=['Submission ID','Donor name','Email','Phone','Amount LKR','Bank reference','Private slip URL','Public name consent','Submitted at'];
function setupHarithayu(){
 const props=PropertiesService.getScriptProperties();
 const form=FormApp.openById(HARITHAYU_FORM_ID);
 const existing=form.getItems(FormApp.ItemType.TEXT);
 const mapping={};
 BRIDGE_FIELDS.forEach(title=>{const item=existing.find(i=>i.getTitle()===title)||form.addTextItem().setTitle(title);mapping[title]=item.getId();});
 let sheetId=form.getDestinationId();
 if(!sheetId){const book=SpreadsheetApp.create('Harithayu — Donation records');sheetId=book.getId();form.setDestination(FormApp.DestinationType.SPREADSHEET,sheetId);}
 const book=SpreadsheetApp.openById(sheetId);
 let review=book.getSheetByName('Website donation review');
 if(!review){review=book.insertSheet('Website donation review');review.appendRow(['Submission ID','Submitted at','Name','Phone','Email','Amount LKR','Bank reference','Private slip URL','Public name consent','Status','Google response ID']);review.setFrozenRows(1);review.getRange('A:K').setNumberFormat('@');review.getRange('F:F').setNumberFormat('#,##0.00');}
 let folderId=props.getProperty('SLIP_FOLDER_ID');if(!folderId)folderId=DriveApp.createFolder('Harithayu — Private bank slips').getId();
 props.setProperties({FORM_ID:HARITHAYU_FORM_ID,SHEET_ID:sheetId,SLIP_FOLDER_ID:folderId,FIELD_MAP:JSON.stringify(mapping)});
 if(!props.getProperty('BRIDGE_SECRET'))props.setProperty('BRIDGE_SECRET',Utilities.getUuid()+Utilities.getUuid());
 console.log(JSON.stringify({form:form.getEditUrl(),sheet:book.getUrl(),privateSlipFolder:'https://drive.google.com/drive/folders/'+folderId}));
 // BRIDGE_SECRET stays in Script Properties; configure it privately in Vercel.
}
function doPost(e){
 const output=value=>ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
 const lock=LockService.getScriptLock();let acquired=false;
 try{
 const props=PropertiesService.getScriptProperties();
 const payload=JSON.parse(e.postData.contents);
 const secret=props.getProperty('BRIDGE_SECRET');
 if(!secret||payload.secret!==secret)return output({ok:false,error:'Unauthorized'});
 if(!/^[a-f0-9]{24}$/.test(payload.id)||!Number.isSafeInteger(payload.amount)||payload.amount<100||payload.amount>1000000||!['pending','confirmed','rejected'].includes(payload.status))throw Error('Invalid donation');
 lock.waitLock(15000);acquired=true;
 const book=SpreadsheetApp.openById(props.getProperty('SHEET_ID')),sheet=book.getSheetByName('Website donation review');
 const rows=sheet.getDataRange().getValues();const index=rows.findIndex((r,i)=>i>0&&String(r[0])===payload.id);
 if(index>=1){sheet.getRange(index+1,10).setValue(payload.status);return output({ok:true,id:payload.id,duplicate:true});}
 const form=FormApp.openById(props.getProperty('FORM_ID')),mapping=JSON.parse(props.getProperty('FIELD_MAP'));
 const folder=DriveApp.getFolderById(props.getProperty('SLIP_FOLDER_ID'));
 let slipUrl='';
 if(payload.receipt){if(!['image/png','image/jpeg','application/pdf'].includes(payload.receipt.mime))throw Error('Invalid slip');const bytes=Utilities.base64Decode(payload.receipt.data);if(bytes.length>1048576)throw Error('Slip too large');const ext=payload.receipt.mime==='application/pdf'?'.pdf':(payload.receipt.mime==='image/png'?'.png':'.jpg');const name=payload.id+ext;const files=folder.getFilesByName(name);const file=files.hasNext()?files.next():folder.createFile(Utilities.newBlob(bytes,payload.receipt.mime,name));file.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.VIEW);slipUrl=file.getUrl();}
 const safeText=v=>/^[=+@\-]/.test(String(v))?"'"+v:String(v);
 const values=[payload.id,safeText(payload.name),safeText(payload.email||''),safeText(payload.phone||''),String(payload.amount),safeText(payload.reference),slipUrl,payload.publicName?'Yes':'No',payload.createdAt];
 // Recover an existing form response if a previous request stopped before recording the review row.
 let response=form.getResponses().find(r=>r.getItemResponses().some(a=>a.getItem().getId()===mapping['Submission ID']&&String(a.getResponse())===payload.id));
 if(!response){response=form.createResponse();BRIDGE_FIELDS.forEach((title,i)=>response.withItemResponse(form.getItemById(mapping[title]).asTextItem().createResponse(String(values[i]))));response=response.submit();}
 // Prefix spreadsheet formula-like text so donor input is never executed as a formula.
 const safe=v=>/^[=+@\-]/.test(String(v))?"'"+v:String(v);
 sheet.appendRow([payload.id,payload.createdAt,safe(payload.name),safe(payload.phone||''),safe(payload.email||''),payload.amount,safe(payload.reference),slipUrl,payload.publicName?'Yes':'No',payload.status,response.getId()]);
 return output({ok:true,id:payload.id});
 }catch(error){console.error('Donation bridge failed');return output({ok:false,error:'Google donation sync failed. Check the Apps Script execution log and form configuration.'});}
 finally{if(acquired)lock.releaseLock();}
}
