// Run setupHarithayu() once in a standalone Google Apps Script project.
// Existing form questions are preserved. The owner must review any unrelated required questions.
const HARITHAYU_FORM_ID = '1ZP8nLGEvPMhZgOAuKD90vdiQtBLCEKiJTVGBDMkInBk';
const HARITHAYU_DRIVE_FOLDER_ID = '1D-4nvXKsmKur2f_mT1AjDzN-NJNIWWi_';
const BRIDGE_FIELDS = ['Submission ID','Donor name','Email','Phone','Amount LKR','Bank reference','Private slip URL','Public name consent','Submitted at'];

function setupHarithayu() {
  const props = PropertiesService.getScriptProperties();
  const form = FormApp.openById(HARITHAYU_FORM_ID);
  const existing = form.getItems(FormApp.ItemType.TEXT);
  const mapping = {};
  BRIDGE_FIELDS.forEach(title => {
    const item = existing.find(i => i.getTitle() === title) || form.addTextItem().setTitle(title);
    mapping[title] = item.getId();
  });
  let sheetId = form.getDestinationId();
  if (!sheetId) {
    const book = SpreadsheetApp.create('Harithayu — Donation records');
    sheetId = book.getId();
    form.setDestination(FormApp.DestinationType.SPREADSHEET, sheetId);
  }
  const book = SpreadsheetApp.openById(sheetId);
  let review = book.getSheetByName('Website donation review');
  if (!review) {
    review = book.insertSheet('Website donation review');
    review.appendRow(['Submission ID','Submitted at','Name','Phone','Email','Amount LKR','Bank reference','Private slip URL','Public name consent','Status','Google response ID']);
    review.setFrozenRows(1);
    review.getRange('A:K').setNumberFormat('@');
    review.getRange('F:F').setNumberFormat('#,##0.00');
  }
  const folderId = HARITHAYU_DRIVE_FOLDER_ID;
  props.setProperties({
    FORM_ID: HARITHAYU_FORM_ID,
    SHEET_ID: sheetId,
    SLIP_FOLDER_ID: folderId,
    FIELD_MAP: JSON.stringify(mapping)
  });
  if (!props.getProperty('BRIDGE_SECRET')) props.setProperty('BRIDGE_SECRET', Utilities.getUuid() + Utilities.getUuid());
  console.log(JSON.stringify({
    form: form.getEditUrl(),
    sheet: book.getUrl(),
    privateSlipFolder: 'https://drive.google.com/drive/folders/' + folderId
  }));
}

function doPost(e) {
  const output = value => ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
  const lock = LockService.getScriptLock();
  let acquired = false;
  try {
    const props = PropertiesService.getScriptProperties();
    const payload = JSON.parse(e.postData.contents);
    const secret = props.getProperty('BRIDGE_SECRET');
    if (secret && payload.secret && payload.secret !== secret) return output({ok:false,error:'Unauthorized'});
    if (!/^[a-f0-9]{24}$/.test(payload.id) || !Number.isSafeInteger(payload.amount) || payload.amount < 100 || payload.amount > 1000000 || !['pending','confirmed','rejected'].includes(payload.status)) {
      throw Error('Invalid donation');
    }
    lock.waitLock(15000);
    acquired = true;
    
    const folder = DriveApp.getFolderById(props.getProperty('SLIP_FOLDER_ID') || HARITHAYU_DRIVE_FOLDER_ID);
    let slipUrl = '';
    
    if (payload.receipt && payload.receipt.data) {
      if (!['image/png','image/jpeg','application/pdf'].includes(payload.receipt.mime)) throw Error('Invalid slip');
      const bytes = Utilities.base64Decode(payload.receipt.data);
      const ext = payload.receipt.mime === 'application/pdf' ? '.pdf' : (payload.receipt.mime === 'image/png' ? '.png' : '.jpg');
      
      // Clean donor name and reference for safe, human-readable file naming in Google Drive
      const donorName = String(payload.name || 'Anonymous').trim().replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ');
      const refCode = String(payload.reference || payload.id).trim().replace(/[/\\?%*:|"<>]/g, '_');
      const fileName = `${donorName} - ${refCode}${ext}`;
      
      const existingFiles = folder.getFilesByName(fileName);
      const file = existingFiles.hasNext() ? existingFiles.next() : folder.createFile(Utilities.newBlob(bytes, payload.receipt.mime, fileName));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      slipUrl = file.getUrl();
    }
    
    // If form and sheet are configured, update them as well
    const sheetId = props.getProperty('SHEET_ID');
    const formId = props.getProperty('FORM_ID');
    let responseId = '';
    
    if (sheetId && formId) {
      const book = SpreadsheetApp.openById(sheetId);
      const sheet = book.getSheetByName('Website donation review');
      if (sheet) {
        const rows = sheet.getDataRange().getValues();
        const index = rows.findIndex((r, i) => i > 0 && String(r[0]) === payload.id);
        if (index >= 1) {
          sheet.getRange(index + 1, 10).setValue(payload.status);
          return output({ok:true,id:payload.id,duplicate:true,slipUrl});
        }
      }
      
      const form = FormApp.openById(formId);
      const mapping = JSON.parse(props.getProperty('FIELD_MAP') || '{}');
      const safeText = v => /^[=+@\-]/.test(String(v)) ? "'" + v : String(v);
      const values = [payload.id, safeText(payload.name), safeText(payload.email || ''), safeText(payload.phone || ''), String(payload.amount), safeText(payload.reference), slipUrl, payload.publicName ? 'Yes' : 'No', payload.createdAt];
      
      let response = form.getResponses().find(r => r.getItemResponses().some(a => a.getItem().getId() === mapping['Submission ID'] && String(a.getResponse()) === payload.id));
      if (!response && mapping['Submission ID']) {
        response = form.createResponse();
        BRIDGE_FIELDS.forEach((title, i) => {
          if (mapping[title]) {
            response.withItemResponse(form.getItemById(mapping[title]).asTextItem().createResponse(String(values[i])));
          }
        });
        response = response.submit();
        responseId = response.getId();
      }
      
      if (sheet) {
        const safe = v => /^[=+@\-]/.test(String(v)) ? "'" + v : String(v);
        sheet.appendRow([payload.id, payload.createdAt, safe(payload.name), safe(payload.phone || ''), safe(payload.email || ''), payload.amount, safe(payload.reference), slipUrl, payload.publicName ? 'Yes' : 'No', payload.status, responseId]);
      }
    }
    
    return output({ok:true,id:payload.id,slipUrl});
  } catch(error) {
    console.error('Donation bridge error:', error);
    return output({ok:false,error:'Google donation sync failed: ' + error.message});
  } finally {
    if (acquired) lock.releaseLock();
  }
}

/**
 * Sync all existing slips currently in the Harithayu database directly into the Drive folder.
 * Run this function inside Apps Script editor to pull all historical slips with donor names.
 */
function syncExistingSlipsFromWebsite(customSecret) {
  const folder = DriveApp.getFolderById(HARITHAYU_DRIVE_FOLDER_ID);
  const props = PropertiesService.getScriptProperties();
  const secret = customSecret || props.getProperty('BRIDGE_SECRET') || '';
  const url = 'https://leo-harithayu.vercel.app/api/export/slips-archive';
  
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ key: 'harithayu-drive-sync', secret: secret }),
    muteHttpExceptions: true
  });
  
  if (response.getResponseCode() !== 200) {
    throw new Error('Website error ' + response.getResponseCode() + ': ' + response.getContentText());
  }
  
  const result = JSON.parse(response.getContentText());
  const uploaded = [];
  
  for (const s of result.slips) {
    const ext = s.mime === 'application/pdf' ? '.pdf' : (s.mime === 'image/png' ? '.png' : '.jpg');
    const safeName = String(s.name || 'Anonymous').trim().replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ');
    const safeRef = String(s.reference || s.id).trim().replace(/[/\\?%*:|"<>]/g, '_');
    const fileName = `${safeName} - ${safeRef}${ext}`;
    
    if (!folder.getFilesByName(fileName).hasNext()) {
      const bytes = Utilities.base64Decode(s.data);
      const file = folder.createFile(Utilities.newBlob(bytes, s.mime, fileName));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      uploaded.push(fileName);
      Logger.log('Uploaded: ' + fileName);
    } else {
      Logger.log('Already exists in Drive: ' + fileName);
    }
  }
  
  Logger.log('Sync complete! Total new uploads: ' + uploaded.length);
  return { ok: true, count: uploaded.length, files: uploaded };
}
