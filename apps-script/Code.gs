// ============================================================
// GOOGLE APPS SCRIPT — Evaplant Opérations Terrain
// Version 5 : Drive REST API via UrlFetchApp (ANYONE_ANONYMOUS fix)
// ============================================================
//
// CORRECTIONS v5 :
// - Remplace DriveApp par Drive REST API via UrlFetchApp + ScriptApp.getOAuthToken()
//   (DriveApp ne fonctionne pas en mode ANYONE_ANONYMOUS)
// - Même logique de dossiers et nomenclature que v4
//
// STRATÉGIE D'UPSERT :
//   - reportId  : UUID interne stable → colonne "ID" → clé d'upsert
//   - reportNumber : numéro visible (ex: "0001") → colonne "Numéro"
//
// ============================================================

// ── IDs fixes ──────────────────────────────────────────────
var SPREADSHEET_ID         = "15pGaqvCHdl7hS_fgVa-QVCt0aDk52lX-1zjskwnnysQ";
var EVAPLANT_FOLDER_ID     = "1dDkJXMtAB5Y5u8zpw3qFCObQM74GEbrj"; // Dossier Evaplant (Mon Drive)
var RAPPORTS_FOLDER_NAME   = "RAPPORTS_EVAPLANT_V2"; // Sous-dossier créé automatiquement

// ── Noms des onglets ────────────────────────────────────────
var SHEET_SUIVI   = "Suivi terrain";
var SHEET_POMPAGE = "Tests de pompage";

// ── Colonnes clés ───────────────────────────────────────────
var ID_COLUMN  = "ID";      // UUID interne — clé d'upsert
var NUM_COLUMN = "Numéro";  // Numéro visible

// ============================================================
// doGet — Test de connectivité + lecture des rapports
// ============================================================
function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : null;
  var type   = e && e.parameter ? e.parameter.type   : null;

  if (action === "list" && type) {
    try {
      var sheetName = (type === "suivi") ? SHEET_SUIVI : SHEET_POMPAGE;
      var rows = listRows(sheetName);
      return jsonResponse({ status: "ok", rows: rows });
    } catch (err) {
      return jsonResponse({ status: "error", message: err.toString() });
    }
  }

  return jsonResponse({
    status: "ok",
    message: "Evaplant Apps Script v5 actif — Drive REST API + ANYONE_ANONYMOUS",
    spreadsheetId: SPREADSHEET_ID,
    timestamp: new Date().toISOString()
  });
}

// ============================================================
// doPost — Upsert Sheets + Upload PDF
// ============================================================
function doPost(e) {
  try {
    var rawBody = e.postData ? e.postData.contents : null;
    if (!rawBody) {
      return jsonResponse({ status: "error", message: "Corps de requête vide" });
    }

    var payload = JSON.parse(rawBody);

    // ── Upload PDF ──
    if (payload.action === "uploadPdf") {
      return handleUploadPdf(payload);
    }

    // ── Upsert Sheets ──
    var type         = payload.type;
    var data         = payload.data;
    var reportId     = payload.reportId;
    var reportNumber = payload.reportNumber;

    if (!type || !data) {
      return jsonResponse({ status: "error", message: "Champs 'type' et 'data' requis" });
    }

    // Déterminer l'onglet cible
    var sheetName;
    if (payload.sheetName) {
      if (payload.sheetName === "Tests de pompage — Irrigation" ||
          payload.sheetName === "Tests de pompage — Lavage") {
        sheetName = SHEET_POMPAGE;
      } else {
        sheetName = payload.sheetName;
      }
    } else if (type === "suivi") {
      sheetName = SHEET_SUIVI;
    } else {
      sheetName = SHEET_POMPAGE;
    }

    var result = upsertRow(sheetName, reportId, reportNumber, data);

    return jsonResponse({
      status: "success",
      action: result.action,
      reportNumber: reportNumber,
      reportId: reportId,
      sheet: sheetName,
      message: "Rapport " + (reportNumber || reportId || "") + " " +
        (result.action === "updated" ? "mis à jour" : "ajouté") + " dans : " + sheetName,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

// ============================================================
// upsertRow — Ajoute ou met à jour une ligne par UUID
// ============================================================
function upsertRow(sheetName, reportId, reportNumber, data) {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  var headers = getOrCreateHeaders(sheet, data);

  // Chercher une ligne existante avec le même UUID
  var targetRow = -1;
  if (reportId) {
    var idColIdx = headers.indexOf(ID_COLUMN);
    if (idColIdx >= 0 && sheet.getLastRow() > 1) {
      var idValues = sheet.getRange(2, idColIdx + 1, sheet.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < idValues.length; i++) {
        if (String(idValues[i][0]).trim() === String(reportId).trim()) {
          targetRow = i + 2;
          break;
        }
      }
    }
  }

  var rowData = headers.map(function(h) {
    var v = data[h];
    return (v !== null && v !== undefined) ? String(v) : "";
  });

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    applyRowStyle(sheet, targetRow, rowData.length);
    return { action: "updated" };
  } else {
    var newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);
    applyRowStyle(sheet, newRow, rowData.length);
    return { action: "inserted" };
  }
}

// ============================================================
// getOrCreateHeaders — En-têtes dynamiques (ID toujours en 1er)
// ============================================================
function getOrCreateHeaders(sheet, data) {
  var keys = Object.keys(data);
  var orderedKeys = [ID_COLUMN, NUM_COLUMN].concat(
    keys.filter(function(k) { return k !== ID_COLUMN && k !== NUM_COLUMN; })
  );

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, orderedKeys.length).setValues([orderedKeys]);
    var headerRange = sheet.getRange(1, 1, 1, orderedKeys.length);
    headerRange.setBackground("#003D39");
    headerRange.setFontColor("#DCF21E");
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(9);
    sheet.setFrozenRows(1);
    return orderedKeys;
  }

  var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var cleanHeaders = existingHeaders.filter(function(h) { return h.trim() !== ""; });

  var newKeys = orderedKeys.filter(function(k) { return cleanHeaders.indexOf(k) === -1; });
  if (newKeys.length > 0) {
    var startCol = cleanHeaders.length + 1;
    newKeys.forEach(function(k, i) {
      var cell = sheet.getRange(1, startCol + i);
      cell.setValue(k);
      cell.setBackground("#003D39");
      cell.setFontColor("#DCF21E");
      cell.setFontWeight("bold");
      cell.setFontSize(9);
    });
    cleanHeaders = cleanHeaders.concat(newKeys);
  }

  return cleanHeaders;
}

// ============================================================
// applyRowStyle — Style alterné
// ============================================================
function applyRowStyle(sheet, rowNum, numCols) {
  var rowRange = sheet.getRange(rowNum, 1, 1, numCols);
  rowRange.setBackground(rowNum % 2 === 0 ? "#F5F0EA" : "#FFFFFF");
  rowRange.setFontSize(8);
  var colsToResize = Math.min(sheet.getLastColumn(), 20);
  if (colsToResize > 0) {
    try { sheet.autoResizeColumns(1, colsToResize); } catch(e) {}
  }
}

// ============================================================
// handleUploadPdf — Upload PDF vers Drive via REST API
// Utilise UrlFetchApp + ScriptApp.getOAuthToken() pour contourner
// la limitation DriveApp en mode ANYONE_ANONYMOUS
// Nomenclature : YYYYMMDD_Site_Client_Createur_Type.pdf
// Dossier : EVAPLANT_FOLDER_ID / RAPPORTS_EVAPLANT_V2 / <site>
// ============================================================
function handleUploadPdf(payload) {
  try {
    var base64     = payload.base64;
    var site       = payload.site       || "Autres";
    var client     = payload.client     || "";
    var operator   = payload.operator   || "";
    var date       = payload.date       || Utilities.formatDate(new Date(), "America/Toronto", "yyyyMMdd");
    var reportType = payload.reportType || "Suivi";

    if (!base64) {
      return jsonResponse({ status: "error", message: "Champ 'base64' requis" });
    }

    // ── Construire le nom de fichier normalisé ──
    function sanitize(s) {
      return String(s || "").replace(/[^a-zA-Z0-9\-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
    }
    var datePart     = sanitize(date).replace(/-/g, "");
    var sitePart     = sanitize(site);
    var clientPart   = sanitize(client);
    var operatorPart = sanitize(operator);
    var typePart     = sanitize(reportType);

    var parts = [datePart, sitePart];
    if (clientPart)   parts.push(clientPart);
    if (operatorPart) parts.push(operatorPart);
    parts.push(typePart);
    var filename = parts.join("_") + ".pdf";

    // ── Token OAuth de l'utilisateur déployant ──
    var token = ScriptApp.getOAuthToken();

    // ── Trouver ou créer le dossier RAPPORTS_EVAPLANT_V2 dans EVAPLANT_FOLDER_ID ──
    var parentFolderId = driveGetOrCreateFolder(RAPPORTS_FOLDER_NAME, EVAPLANT_FOLDER_ID, token);

    // ── Trouver ou créer le sous-dossier par site ──
    var siteFolderId = driveGetOrCreateFolder(sitePart, parentFolderId, token);

    // ── Supprimer l'ancien fichier si même nom ──
    driveDeleteFileByName(filename, siteFolderId, token);

    // ── Uploader le PDF ──
    var pdfBytes = Utilities.base64Decode(base64);
    var fileId   = driveUploadFile(filename, "application/pdf", pdfBytes, siteFolderId, token);

    // ── Rendre le fichier accessible via lien ──
    driveSetPublicLink(fileId, token);

    var fileUrl = "https://drive.google.com/file/d/" + fileId + "/view";

    return jsonResponse({
      status: "success",
      fileId: fileId,
      fileUrl: fileUrl,
      filename: filename,
      folderName: sitePart,
      message: "PDF \"" + filename + "\" sauvegardé dans \"" + sitePart + "\""
    });

  } catch (err) {
    return jsonResponse({ status: "error", message: "Erreur upload PDF : " + err.toString() });
  }
}

// ── Helpers Drive REST API ──────────────────────────────────

function driveGetOrCreateFolder(name, parentId, token) {
  // Chercher un dossier existant
  var query = "mimeType='application/vnd.google-apps.folder' and name='" + name.replace(/'/g, "\\'") + "' and '" + parentId + "' in parents and trashed=false";
  var searchUrl = "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(query) + "&fields=files(id,name)";
  var searchResp = UrlFetchApp.fetch(searchUrl, {
    method: "GET",
    headers: { "Authorization": "Bearer " + token },
    muteHttpExceptions: true
  });
  var searchData = JSON.parse(searchResp.getContentText());
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }
  // Créer le dossier
  var createResp = UrlFetchApp.fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify({
      name: name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId]
    }),
    muteHttpExceptions: true
  });
  var createData = JSON.parse(createResp.getContentText());
  if (!createData.id) {
    throw new Error("Impossible de créer le dossier '" + name + "': " + createResp.getContentText());
  }
  return createData.id;
}

function driveDeleteFileByName(filename, folderId, token) {
  var query = "name='" + filename.replace(/'/g, "\\'") + "' and '" + folderId + "' in parents and trashed=false";
  var searchUrl = "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(query) + "&fields=files(id)";
  var resp = UrlFetchApp.fetch(searchUrl, {
    method: "GET",
    headers: { "Authorization": "Bearer " + token },
    muteHttpExceptions: true
  });
  var data = JSON.parse(resp.getContentText());
  if (data.files && data.files.length > 0) {
    data.files.forEach(function(f) {
      UrlFetchApp.fetch("https://www.googleapis.com/drive/v3/files/" + f.id + "?supportsAllDrives=true", {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + token },
        muteHttpExceptions: true
      });
    });
  }
}

function driveUploadFile(filename, mimeType, bytes, folderId, token) {
  // Multipart upload
  var boundary = "-------evaplant_boundary_" + new Date().getTime();
  var metadata = JSON.stringify({ name: filename, parents: [folderId] });

  var bodyParts = [
    "--" + boundary + "\r\n",
    "Content-Type: application/json; charset=UTF-8\r\n\r\n",
    metadata + "\r\n",
    "--" + boundary + "\r\n",
    "Content-Type: " + mimeType + "\r\n\r\n"
  ];

  // Construire le body en bytes
  var bodyStart = Utilities.newBlob(bodyParts.join("")).getBytes();
  var bodyEnd   = Utilities.newBlob("\r\n--" + boundary + "--").getBytes();
  var fullBody  = bodyStart.concat(bytes).concat(bodyEnd);

  var uploadResp = UrlFetchApp.fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "multipart/related; boundary=" + boundary
    },
    payload: Utilities.newBlob(fullBody).getBytes(),
    muteHttpExceptions: true
  });

  var uploadData = JSON.parse(uploadResp.getContentText());
  if (!uploadData.id) {
    throw new Error("Upload échoué: " + uploadResp.getContentText());
  }
  return uploadData.id;
}

function driveSetPublicLink(fileId, token) {
  UrlFetchApp.fetch("https://www.googleapis.com/drive/v3/files/" + fileId + "/permissions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify({ role: "reader", type: "anyone" }),
    muteHttpExceptions: true
  });
}

// ============================================================
// listRows — Lecture pour synchro multi-utilisateurs
// ============================================================
function listRows(sheetName) {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var headers  = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var dataRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  return dataRows.map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = String(row[i] !== undefined ? row[i] : ""); });
    return obj;
  });
}

// ============================================================
// jsonResponse
// ============================================================
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// testScript — Test manuel dans Apps Script Editor
// ============================================================
function testScript() {
  var testId = "test-uuid-v5-001";
  var testData = {
    "ID": testId,
    "Numéro": "TEST-V5",
    "Statut": "Complété",
    "Client": "WM",
    "Site": "P2519_Saint-Nicephore",
    "Date": "2026-05-26",
    "Opérateur": "Jerome"
  };

  var r1 = upsertRow(SHEET_SUIVI, testId, "TEST-V5", testData);
  Logger.log("Test 1 (insertion) : " + r1.action + " — attendu : inserted");

  testData["Statut"] = "Mis à jour";
  var r2 = upsertRow(SHEET_SUIVI, testId, "TEST-V5", testData);
  Logger.log("Test 2 (update) : " + r2.action + " — attendu : updated");

  var rows = listRows(SHEET_SUIVI);
  var testRows = rows.filter(function(r) { return r["ID"] === testId; });
  Logger.log("Test 3 (pas de doublon) : " + testRows.length + " ligne(s) — attendu : 1");

  if (r2.action === "updated" && testRows.length === 1) {
    Logger.log("✓ Tous les tests passent — v5 Drive REST API fonctionnel");
  } else {
    Logger.log("✗ Échec des tests");
  }
}
