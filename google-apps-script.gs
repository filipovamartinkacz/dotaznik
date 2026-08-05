// Vlož do Google Sheetu: Rozšíření → Apps Script → nahradit obsah Code.gs tímto kódem.
// Poté nasadit jako Web App (Nasadit → Nová nasazená verze → Web App, přístup: Kdokoli).
// Vygenerovanou URL vlož do .env.local jako GOOGLE_SCRIPT_URL.

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(data.headers);
  }

  sheet.appendRow(data.values);

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
