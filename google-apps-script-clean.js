// ============================================================
// GOOGLE APPS SCRIPT - Evaplant Operations Terrain
// Version : Upsert robuste par ID interne (UUID stable)
// ============================================================
//
// STRATEGIE D'UPSERT :
// L'application envoie deux identifiants :
//   - reportId  : UUID interne stable (jamais modifie apres creation)
//                 -> stocke dans la colonne "ID" du Sheet
//                 -> utilise pour retrouver la ligne existante (UPDATE)
//   - reportNumber : numero visible (ex: "0001") -> colonne "Numero"
//
// Avantage : meme si le numero visible change ou a un format different,
// l'UUID garantit qu'aucun doublon n'est cree.
//
// INSTRUCTIONS DE DEPLOIEMENT :
// 1. Ouvrez votre Google Sheet
// 2. Cliquez sur Extensions > Apps Script
// 3. Remplacez TOUT le code par ce fichier
// 4. Cliquez Enregistrer (icone disquette)
// 5. Cliquez Deployer > Gerer les deploiements
// 6. Cliquez l'icone crayon (modifier) sur le deploiement actif
// 7. Dans "Version", selectionnez "Nouvelle version"
// 8. Cliquez Deployer (l'URL reste la meme)
// ============================================================

var SHEET_SUIVI = "Suivi terrain";
var SHEET_POMPAGE = "Tests de pompage"; // Onglet unique (Irrigation + Lavage, colonne Mode)
var ID_COLUMN = "ID";       // Colonne UUID interne - cle d'upsert principale
var NUM_COLUMN = "Numero";  // Colonne numero visible

// ============================================================
// doGet - Test de connectivite + lecture des rapports partages
// ============================================================
function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : null;
  var type = e && e.parameter ? e.parameter.type : null;

  if (action === "list" && type) {
    try {
      var sheetName;
      if (type === "suivi") {
        sheetName = SHEET_SUIVI;
      } else {
        // "pompage", "pompage-irrigation", "pompage-lavage" -> onglet unique
        sheetName = SHEET_POMPAGE;
      }
      var rows = listRows(sheetName);
      return jsonResponse({ status: "ok", rows: rows });
    } catch (err) {
      return jsonResponse({ status: "error", message: err.toString() });
    }
  }

  return jsonResponse({
    status: "ok",
    message: "Evaplant Apps Script actif - upsert par ID interne (UUID stable)",
    timestamp: new Date().toISOString()
  });
}

// ============================================================
// doPost - Recoit les donnees de l'application (upsert sans doublon + upload PDF)
// ============================================================
function doPost(e) {
  try {
    var rawBody = e.postData ? e.postData.contents : null;
    if (!rawBody) {
      return jsonResponse({ status: "error", message: "Corps de requete vide - e.postData est null" });
    }

    var payload = JSON.parse(rawBody);

    // -- Action : upload PDF vers Google Drive --
    if (payload.action === "uploadPdf") {
      return handleUploadPdf(payload);
    }

    var type = payload.type;
    var data = payload.data;
    var reportId = payload.reportId;       // UUID stable - cle d'upsert
    var reportNumber = payload.reportNumber; // Numero visible

    if (!type || !data) {
      return jsonResponse({ status: "error", message: "Champs 'type' et 'data' requis" });
    }

    // Determiner l'onglet cible
    var sheetName;
    if (payload.sheetName) {
      // Si le payload fournit explicitement le nom de l'onglet, l'utiliser
      // (compatibilite avec les anciennes versions)
      // Mais si c'est un ancien onglet separe, rediriger vers l'onglet unique
      if (payload.sheetName === "Tests de pompage - Irrigation" ||
          payload.sheetName === "Tests de pompage - Lavage") {
        sheetName = SHEET_POMPAGE;
      } else {
        sheetName = payload.sheetName;
      }
    } else if (type === "suivi") {
      sheetName = SHEET_SUIVI;
    } else {
      // "pompage", "pompage-irrigation", "pompage-lavage" -> onglet unique
      sheetName = SHEET_POMPAGE;
    }
    var result = upsertRow(sheetName, reportId, reportNumber, data);

    return jsonResponse({
      status: "success",
      action: result.action,       // "updated" ou "inserted"
      reportNumber: reportNumber,
      reportId: reportId,
      sheet: sheetName,
      message: "Rapport " + (reportNumber || reportId || "") + " " +
        (result.action === "updated" ? "mis a jour" : "ajoute") + " dans : " + sheetName,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

// ============================================================
// upsertRow - Ajoute ou met a jour une ligne par UUID interne
// GARANTIT qu'aucun doublon n'est cree
// Retourne { action: "updated" | "inserted" }
// ============================================================
function upsertRow(sheetName, reportId, reportNumber, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // Obtenir les en-tetes (cree la feuille si vide, avec ID en premiere colonne)
  var headers = getOrCreateHeaders(sheet, data);

  // Chercher une ligne existante avec le meme UUID interne
  var targetRow = -1;
  if (reportId) {
    var idColIdx = headers.indexOf(ID_COLUMN);
    if (idColIdx >= 0 && sheet.getLastRow() > 1) {
      var idValues = sheet.getRange(2, idColIdx + 1, sheet.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < idValues.length; i++) {
        var cellVal = String(idValues[i][0]).trim();
        var searchVal = String(reportId).trim();
        if (cellVal === searchVal) {
          targetRow = i + 2; // ligne 1 = en-tetes
          break;
        }
      }
    }
  }

  // Construire la ligne dans l'ordre des en-tetes
  var rowData = headers.map(function(h) {
    var v = data[h];
    return (v !== null && v !== undefined) ? String(v) : "";
  });

  if (targetRow > 0) {
    // Mise a jour de la ligne existante - PAS de nouvelle ligne
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    applyRowStyle(sheet, targetRow, rowData.length);
    return { action: "updated" };
  } else {
    // Nouvelle ligne a la fin
    var newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);
    applyRowStyle(sheet, newRow, rowData.length);
    return { action: "inserted" };
  }
}

// ============================================================
// getOrCreateHeaders - Gere les en-tetes dynamiquement
// "ID" est toujours en premiere colonne, "Numero" en deuxieme
// ============================================================
function getOrCreateHeaders(sheet, data) {
  // Ordonner les cles : ID en premier, Numero en deuxieme, reste apres
  var keys = Object.keys(data);
  var orderedKeys = [ID_COLUMN, NUM_COLUMN].concat(
    keys.filter(function(k) { return k !== ID_COLUMN && k !== NUM_COLUMN; })
  );

  if (sheet.getLastRow() === 0) {
    // Feuille vide - creer les en-tetes
    sheet.getRange(1, 1, 1, orderedKeys.length).setValues([orderedKeys]);
    var headerRange = sheet.getRange(1, 1, 1, orderedKeys.length);
    headerRange.setBackground("#003D39");
    headerRange.setFontColor("#DCF21E");
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(9);
    sheet.setFrozenRows(1);
    return orderedKeys;
  }

  // En-tetes existants
  var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var cleanHeaders = existingHeaders.filter(function(h) { return h.trim() !== ""; });

  // Ajouter les nouvelles colonnes manquantes (a la fin)
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
// applyRowStyle - Applique le style alterne aux lignes
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
// handleUploadPdf - Upload d'un PDF en base64 vers Google Drive
// Dossier racine Evaplant : 1dDkJXMtAB5Y5u8zpw3qFCObQM74GEbrj
// Sous-dossier RAPPORTS_EVAPLANT_V2 cree automatiquement si absent
// Sous-dossier par site cree automatiquement
// ============================================================
var DRIVE_ROOT_FOLDER_ID = "1dDkJXMtAB5Y5u8zpw3qFCObQM74GEbrj";
var RAPPORTS_FOLDER_NAME = "RAPPORTS_EVAPLANT_V2";

function handleUploadPdf(payload) {
  try {
    var filename = payload.filename;
    var base64 = payload.base64;
    var siteName = payload.site || "Autres";

    if (!filename || !base64) {
      return jsonResponse({ status: "error", message: "Champs 'filename' et 'base64' requis" });
    }

    var token = ScriptApp.getOAuthToken();
    var apiBase = "https://www.googleapis.com/drive/v3";
    var uploadBase = "https://www.googleapis.com/upload/drive/v3";
    var headers = { "Authorization": "Bearer " + token };

    // Fonction interne: trouver ou creer un dossier
    function getOrCreateFolder(name, parentId) {
      var q = "mimeType='application/vnd.google-apps.folder' and name='" + name + "' and '" + parentId + "' in parents and trashed=false";
      var searchResp = UrlFetchApp.fetch(apiBase + "/files?q=" + encodeURIComponent(q) + "&fields=files(id,name)", {
        headers: headers, muteHttpExceptions: true
      });
      var searchData = JSON.parse(searchResp.getContentText());
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
      // Creer le dossier
      var createResp = UrlFetchApp.fetch(apiBase + "/files", {
        method: "post",
        headers: Object.assign({}, headers, { "Content-Type": "application/json" }),
        payload: JSON.stringify({ name: name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
        muteHttpExceptions: true
      });
      var createData = JSON.parse(createResp.getContentText());
      return createData.id;
    }

    // Trouver ou creer RAPPORTS_EVAPLANT_V2
    var rapportsFolderId = getOrCreateFolder(RAPPORTS_FOLDER_NAME, DRIVE_ROOT_FOLDER_ID);

    // Trouver ou creer le sous-dossier par site
    var siteFolderId = getOrCreateFolder(siteName, rapportsFolderId);

    // Verifier si un fichier avec le meme nom existe deja (remplacement)
    var qFile = "name='" + filename + "' and '" + siteFolderId + "' in parents and trashed=false";
    var existResp = UrlFetchApp.fetch(apiBase + "/files?q=" + encodeURIComponent(qFile) + "&fields=files(id)", {
      headers: headers, muteHttpExceptions: true
    });
    var existData = JSON.parse(existResp.getContentText());
    if (existData.files && existData.files.length > 0) {
      UrlFetchApp.fetch(apiBase + "/files/" + existData.files[0].id, {
        method: "delete", headers: headers, muteHttpExceptions: true
      });
    }

    // Uploader le PDF via multipart
    var pdfBytes = Utilities.base64Decode(base64);
    var boundary = "-------evaplant_boundary";
    var metaStr = JSON.stringify({ name: filename, parents: [siteFolderId] });
    var metaBytes = Utilities.newBlob(metaStr).getBytes();
    var nl = Utilities.newBlob("\r\n").getBytes();
    var sep = Utilities.newBlob("--" + boundary + "\r\n").getBytes();
    var endSep = Utilities.newBlob("\r\n--" + boundary + "--").getBytes();
    var metaHeader = Utilities.newBlob("Content-Type: application/json; charset=UTF-8\r\n\r\n").getBytes();
    var pdfHeader = Utilities.newBlob("Content-Type: application/pdf\r\n\r\n").getBytes();

    var body = sep.concat(metaHeader).concat(metaBytes).concat(nl).concat(sep).concat(pdfHeader).concat(pdfBytes).concat(endSep);

    var uploadResp = UrlFetchApp.fetch(uploadBase + "/files?uploadType=multipart&fields=id,webViewLink", {
      method: "post",
      headers: Object.assign({}, headers, { "Content-Type": "multipart/related; boundary=\"" + boundary + "\"" }),
      payload: body,
      muteHttpExceptions: true
    });

    var uploadData = JSON.parse(uploadResp.getContentText());

    if (!uploadData.id) {
      return jsonResponse({ status: "error", message: "Erreur upload: " + uploadResp.getContentText() });
    }

    // Rendre le fichier accessible a quiconque possede le lien
    UrlFetchApp.fetch(apiBase + "/files/" + uploadData.id + "/permissions", {
      method: "post",
      headers: Object.assign({}, headers, { "Content-Type": "application/json" }),
      payload: JSON.stringify({ role: "reader", type: "anyone" }),
      muteHttpExceptions: true
    });

    return jsonResponse({
      status: "success",
      fileId: uploadData.id,
      fileUrl: uploadData.webViewLink || "https://drive.google.com/file/d/" + uploadData.id + "/view",
      folderName: siteName,
      message: "PDF \"" + filename + "\" sauvegarde dans \"" + siteName + "\""
    });

  } catch (err) {
    return jsonResponse({ status: "error", message: "Erreur upload PDF : " + err.toString() });
  }
}

// ============================================================
// listRows - Retourne toutes les lignes pour la lecture multi-utilisateurs
// ============================================================
function listRows(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var dataRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  return dataRows.map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = String(row[i] !== undefined ? row[i] : ""); });
    return obj;
  });
}

// ============================================================
// Reponse JSON
// ============================================================
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// Fonction de test manuel (Executer > testScript dans Apps Script)
// ============================================================
function testScript() {
  var testId = "test-uuid-stable-001";
  var testData = {
    "ID": testId,
    "Numero": "TEST-001",
    "Statut": "Complete",
    "Client": "WM",
    "Site": "P25-19_Saint-Nicephore",
    "Date": new Date().toLocaleDateString("fr-CA")
  };

  testData["Mode"] = "Irrigation";

  // Test 1 : Insertion dans l'onglet pompage
  var r1 = upsertRow(SHEET_POMPAGE, testId, "TEST-001", testData);
  Logger.log("OK Test 1 (insertion) : " + r1.action + " - attendu : inserted");

  // Test 2 : Mise a jour (meme UUID, donnees differentes)
  testData["Statut"] = "Mis a jour";
  var r2 = upsertRow(SHEET_POMPAGE, testId, "TEST-001", testData);
  Logger.log("OK Test 2 (mise a jour) : " + r2.action + " - attendu : updated");

  // Test 3 : Verification qu'il n'y a qu'une seule ligne avec cet UUID
  var rows = listRows(SHEET_POMPAGE);
  var testRows = rows.filter(function(r) { return r["ID"] === testId; });
  Logger.log("OK Test 3 (pas de doublon) : " + testRows.length + " ligne(s) - attendu : 1");

  if (r2.action !== "updated") {
    Logger.log("ERREUR ERREUR : L'upsert n'a pas mis a jour la ligne existante !");
  } else if (testRows.length !== 1) {
    Logger.log("ERREUR ERREUR : Doublon detecte !");
  } else {
    Logger.log("OK Tous les tests passent - upsert par UUID fonctionnel");
  }
}
