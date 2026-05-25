// ============================================================
// GOOGLE APPS SCRIPT — Evaplant Opérations Terrain
// Version : Upsert robuste par ID interne (UUID stable)
// ============================================================
//
// STRATÉGIE D'UPSERT :
// L'application envoie deux identifiants :
//   - reportId  : UUID interne stable (jamais modifié après création)
//                 → stocké dans la colonne "ID" du Sheet
//                 → utilisé pour retrouver la ligne existante (UPDATE)
//   - reportNumber : numéro visible (ex: "0001") → colonne "Numéro"
//
// Avantage : même si le numéro visible change ou a un format différent,
// l'UUID garantit qu'aucun doublon n'est créé.
//
// INSTRUCTIONS DE DÉPLOIEMENT :
// 1. Ouvrez votre Google Sheet
// 2. Cliquez sur Extensions > Apps Script
// 3. Remplacez TOUT le code par ce fichier
// 4. Cliquez Enregistrer (icône disquette)
// 5. Cliquez Déployer > Gérer les déploiements
// 6. Cliquez l'icône crayon (modifier) sur le déploiement actif
// 7. Dans "Version", sélectionnez "Nouvelle version"
// 8. Cliquez Déployer (l'URL reste la même)
// ============================================================

var SHEET_SUIVI = "Suivi terrain";
var SHEET_POMPAGE = "Tests de pompage"; // Onglet unique (Irrigation + Lavage, colonne Mode)
var ID_COLUMN = "ID";       // Colonne UUID interne — clé d'upsert principale
var NUM_COLUMN = "Numéro";  // Colonne numéro visible

// ============================================================
// doGet — Test de connectivité + lecture des rapports partagés
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
        // "pompage", "pompage-irrigation", "pompage-lavage" → onglet unique
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
    message: "Evaplant Apps Script actif — upsert par ID interne (UUID stable)",
    timestamp: new Date().toISOString()
  });
}

// ============================================================
// doPost — Reçoit les données de l'application (upsert sans doublon)
// ============================================================
function doPost(e) {
  try {
    var rawBody = e.postData ? e.postData.contents : null;
    if (!rawBody) {
      return jsonResponse({ status: "error", message: "Corps de requête vide — e.postData est null" });
    }

    var payload = JSON.parse(rawBody);
    var type = payload.type;
    var data = payload.data;
    var reportId = payload.reportId;       // UUID stable — clé d'upsert
    var reportNumber = payload.reportNumber; // Numéro visible

    if (!type || !data) {
      return jsonResponse({ status: "error", message: "Champs 'type' et 'data' requis" });
    }

    // Déterminer l'onglet cible
    var sheetName;
    if (payload.sheetName) {
      // Si le payload fournit explicitement le nom de l'onglet, l'utiliser
      // (compatibilité avec les anciennes versions)
      // Mais si c'est un ancien onglet séparé, rediriger vers l'onglet unique
      if (payload.sheetName === "Tests de pompage — Irrigation" ||
          payload.sheetName === "Tests de pompage — Lavage") {
        sheetName = SHEET_POMPAGE;
      } else {
        sheetName = payload.sheetName;
      }
    } else if (type === "suivi") {
      sheetName = SHEET_SUIVI;
    } else {
      // "pompage", "pompage-irrigation", "pompage-lavage" → onglet unique
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
        (result.action === "updated" ? "mis à jour" : "ajouté") + " dans : " + sheetName,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

// ============================================================
// upsertRow — Ajoute ou met à jour une ligne par UUID interne
// GARANTIT qu'aucun doublon n'est créé
// Retourne { action: "updated" | "inserted" }
// ============================================================
function upsertRow(sheetName, reportId, reportNumber, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // Obtenir les en-têtes (crée la feuille si vide, avec ID en première colonne)
  var headers = getOrCreateHeaders(sheet, data);

  // Chercher une ligne existante avec le même UUID interne
  var targetRow = -1;
  if (reportId) {
    var idColIdx = headers.indexOf(ID_COLUMN);
    if (idColIdx >= 0 && sheet.getLastRow() > 1) {
      var idValues = sheet.getRange(2, idColIdx + 1, sheet.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < idValues.length; i++) {
        var cellVal = String(idValues[i][0]).trim();
        var searchVal = String(reportId).trim();
        if (cellVal === searchVal) {
          targetRow = i + 2; // ligne 1 = en-têtes
          break;
        }
      }
    }
  }

  // Construire la ligne dans l'ordre des en-têtes
  var rowData = headers.map(function(h) {
    var v = data[h];
    return (v !== null && v !== undefined) ? String(v) : "";
  });

  if (targetRow > 0) {
    // Mise à jour de la ligne existante — PAS de nouvelle ligne
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    applyRowStyle(sheet, targetRow, rowData.length);
    return { action: "updated" };
  } else {
    // Nouvelle ligne à la fin
    var newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);
    applyRowStyle(sheet, newRow, rowData.length);
    return { action: "inserted" };
  }
}

// ============================================================
// getOrCreateHeaders — Gère les en-têtes dynamiquement
// "ID" est toujours en première colonne, "Numéro" en deuxième
// ============================================================
function getOrCreateHeaders(sheet, data) {
  // Ordonner les clés : ID en premier, Numéro en deuxième, reste après
  var keys = Object.keys(data);
  var orderedKeys = [ID_COLUMN, NUM_COLUMN].concat(
    keys.filter(function(k) { return k !== ID_COLUMN && k !== NUM_COLUMN; })
  );

  if (sheet.getLastRow() === 0) {
    // Feuille vide — créer les en-têtes
    sheet.getRange(1, 1, 1, orderedKeys.length).setValues([orderedKeys]);
    var headerRange = sheet.getRange(1, 1, 1, orderedKeys.length);
    headerRange.setBackground("#003D39");
    headerRange.setFontColor("#DCF21E");
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(9);
    sheet.setFrozenRows(1);
    return orderedKeys;
  }

  // En-têtes existants
  var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var cleanHeaders = existingHeaders.filter(function(h) { return h.trim() !== ""; });

  // Ajouter les nouvelles colonnes manquantes (à la fin)
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
// applyRowStyle — Applique le style alterné aux lignes
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
// listRows — Retourne toutes les lignes pour la lecture multi-utilisateurs
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
// Réponse JSON
// ============================================================
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// Fonction de test manuel (Exécuter > testScript dans Apps Script)
// ============================================================
function testScript() {
  var testId = "test-uuid-stable-001";
  var testData = {
    "ID": testId,
    "Numéro": "TEST-001",
    "Statut": "Complété",
    "Client": "WM",
    "Site": "P25-19_Saint-Nicéphore",
    "Date": new Date().toLocaleDateString("fr-CA")
  };

  testData["Mode"] = "Irrigation";

  // Test 1 : Insertion dans l'onglet pompage
  var r1 = upsertRow(SHEET_POMPAGE, testId, "TEST-001", testData);
  Logger.log("✓ Test 1 (insertion) : " + r1.action + " — attendu : inserted");

  // Test 2 : Mise à jour (même UUID, données différentes)
  testData["Statut"] = "Mis à jour";
  var r2 = upsertRow(SHEET_POMPAGE, testId, "TEST-001", testData);
  Logger.log("✓ Test 2 (mise à jour) : " + r2.action + " — attendu : updated");

  // Test 3 : Vérification qu'il n'y a qu'une seule ligne avec cet UUID
  var rows = listRows(SHEET_POMPAGE);
  var testRows = rows.filter(function(r) { return r["ID"] === testId; });
  Logger.log("✓ Test 3 (pas de doublon) : " + testRows.length + " ligne(s) — attendu : 1");

  if (r2.action !== "updated") {
    Logger.log("✗ ERREUR : L'upsert n'a pas mis à jour la ligne existante !");
  } else if (testRows.length !== 1) {
    Logger.log("✗ ERREUR : Doublon détecté !");
  } else {
    Logger.log("✓ Tous les tests passent — upsert par UUID fonctionnel");
  }
}
