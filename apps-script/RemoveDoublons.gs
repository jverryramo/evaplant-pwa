// ============================================================
// removeDuplicates — Nettoyage des doublons dans les onglets Evaplant
//
// À exécuter UNE SEULE FOIS depuis l'éditeur Apps Script :
//   1. Ouvre script.google.com → ton projet
//   2. Colle ce fichier (ou ajoute la fonction)
//   3. Sélectionne "removeDuplicates" dans le menu déroulant
//   4. Clique ▶ Exécuter
//
// Logique : pour chaque onglet, garde la DERNIÈRE ligne par UUID (colonne "ID").
// Les lignes en double (plus anciennes) sont supprimées.
// ============================================================

function removeDuplicates() {
  var ss = SpreadsheetApp.openById("15pGaqvCHdl7hS_fgVa-QVCt0aDk52lX-1zjskwnnysQ");
  var sheetNames = ["Suivi terrain", "Tests de pompage"];
  var totalRemoved = 0;

  sheetNames.forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log("Onglet introuvable : " + sheetName);
      return;
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    if (lastRow <= 1) {
      Logger.log(sheetName + " : aucune donnée.");
      return;
    }

    // Lire toutes les données (headers + lignes)
    var allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = allData[0].map(String);
    var idColIdx = headers.indexOf("ID");

    if (idColIdx < 0) {
      Logger.log(sheetName + " : colonne ID introuvable, onglet ignoré.");
      return;
    }

    // Parcourir les lignes et garder la DERNIÈRE occurrence de chaque UUID
    // On parcourt de bas en haut pour marquer les doublons (les premières occurrences)
    var seen = {};
    var rowsToDelete = [];

    for (var i = lastRow - 1; i >= 1; i--) {
      var uuid = String(allData[i][idColIdx]).trim();
      if (!uuid || uuid === "") continue; // ignorer lignes sans UUID

      if (seen[uuid]) {
        // Doublon — marquer pour suppression (ligne i+1 car 1-indexed)
        rowsToDelete.push(i + 1);
      } else {
        seen[uuid] = true;
      }
    }

    // Supprimer les lignes de bas en haut pour ne pas décaler les indices
    rowsToDelete.sort(function(a, b) { return b - a; });
    rowsToDelete.forEach(function(rowNum) {
      sheet.deleteRow(rowNum);
    });

    Logger.log(sheetName + " : " + rowsToDelete.length + " doublon(s) supprimé(s).");
    totalRemoved += rowsToDelete.length;
  });

  Logger.log("✓ Nettoyage terminé — " + totalRemoved + " doublon(s) supprimé(s) au total.");

  // Afficher un message dans l'UI
  SpreadsheetApp.getUi().alert(
    "Nettoyage terminé ✓\n\n" + totalRemoved + " doublon(s) supprimé(s).\nConsulte les logs pour le détail."
  );
}
