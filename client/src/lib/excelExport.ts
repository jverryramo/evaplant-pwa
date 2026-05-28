// ============================================================
// excelExport.ts — Gestion de l'Excel cumulatif automatique
// Chaque rapport finalisé est ajouté automatiquement au fichier
// ============================================================

import { generateId } from "./types";
import type { SuiviReport, PompageTest } from "./types";
import { addExcelRow, hasExcelRow, getExcelRowsByType, getAllSuiviReports, getAllPompageTests } from "./db";

// Lazy-loaded XLSX (chargé uniquement lors de l'export Excel)
let XLSX: typeof import("xlsx");

async function loadXLSX() {
  if (!XLSX) {
    XLSX = await import("xlsx");
  }
}

// Traduction des statuts (jamais de valeur brute en anglais dans l'Excel)
const STATUS_FR: Record<string, string> = {
  draft: "Brouillon",
  in_progress: "En cours",
  completed: "Complété",
  archived: "Archivé",
};

const YESNO_FR: Record<string, string> = {
  oui: "Oui",
  non: "Non",
  na: "N/A",
  "": "",
};

function fr(val: string | undefined | null): string {
  if (!val) return "";
  return YESNO_FR[val] ?? val;
}

// Formater une date ISO en format simple lisible (AAAA-MM-JJ HH:MM)
function formatDate(isoString: string | undefined | null): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString; // Si pas parseable, retourner tel quel
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

function frStatus(val: string | undefined | null): string {
  if (!val) return "";
  return STATUS_FR[val] ?? val;
}

// ============================================================
// Construire la ligne Excel pour un rapport de suivi
// ============================================================
export function buildSuiviRow(r: SuiviReport): Record<string, unknown> {
  const row: Record<string, unknown> = {
    // ── Identité ─────────────────────────────────────────────
    "ID": r.id,
    "Numéro": r.reportNumber,
    "Statut": frStatus(r.status),
    "Verrouillé": r.locked ? "Oui" : "Non",
    // ── Contexte ─────────────────────────────────────────────
    "Client": r.context.client,
    "Site": r.context.site,
    "Système": r.context.systeme,
    "Date": r.config.date,
    "Créé par": r.config.createdBy,
    "Nb zones": r.config.nombreZones,
    "Nb tensiomètres": r.config.nombreTensiometres,
    // ── 1.1.1.1 Poste de pompage ────────────────────────────
    "1.1.1.1 Poste pompage — Alarmes VFD": fr(r.postePompage.alarmesVFD),
    "1.1.1.1 Poste pompage — Alarmes acquittées": fr(r.postePompage.alarmesAcquittees),
    "1.1.1.1 Poste pompage — Commentaires": r.postePompage.commentaires,
    "1.1.1.1 Poste pompage — Nb photos": r.postePompage.photos.length,
    // ── 1.1.1.2 Poste de contrôle ───────────────────────────
    "1.1.1.2 Poste contrôle — Fuites": fr(r.posteControle.presenceFuites),
    "1.1.1.2 Poste contrôle — Alarmes acquittées": fr(r.posteControle.alarmesAcquittees),
    "1.1.1.2 Poste contrôle — Commentaires": r.posteControle.commentaires,
    "1.1.1.2 Poste contrôle — Nb photos": r.posteControle.photos.length,
    // ── 1.1.1.3 PLC — Alarmes ───────────────────────────────
    "1.1.1.3 PLC — Alarmes présentes": fr(r.plcAlarmes.alarmesPresentes),
    "1.1.1.3 PLC — Alarmes acquittées": fr(r.plcAlarmes.alarmesAcquittees),
    "1.1.1.3 PLC — Commentaires": r.plcAlarmes.commentaires,
    "1.1.1.3 PLC — Nb photos": r.plcAlarmes.photos.length,
    // ── 1.1.1.4 PLC — Tensiomètres (lectures) ──────────────────
    "1.1.1.4 PLC Tensiomètres — Nb photos": r.plcTensiometres.photos.length,
    // ── 1.1.1.5 Débitmètre ──────────────────────────────────
    "1.1.1.5 Débitmètre — Messages erreur": fr(r.debitmetre.messagesErreur),
    "1.1.1.5 Débitmètre — Volume cumulatif (m³)": r.debitmetre.volumeCumulActuel,
    "1.1.1.5 Débitmètre — Commentaires": r.debitmetre.commentaires,
    "1.1.1.5 Débitmètre — Nb photos": r.debitmetre.photos.length,
    // ── 1.1.1.6 Pluviomètre ─────────────────────────────────
    "1.1.1.6 Pluviomètre — Nettoyage requis": fr(r.pluviometre.nettoyageRequis),
    "1.1.1.6 Pluviomètre — Commentaires": r.pluviometre.commentaires,
    "1.1.1.6 Pluviomètre — Nb photos": r.pluviometre.photos.length,
    // ── 1.1.1.7 Santé des saules ────────────────────────────
    "1.1.1.7 Santé saules — Score": r.santeSaules.score ?? "",
    "1.1.1.7 Santé saules — Commentaires": r.santeSaules.commentaires,
    "1.1.1.7 Santé saules — Nb photos": r.santeSaules.photos.length,
    // ── 1.1.1.8 Inspection pourtour ───────────────────────────
    "1.1.1.8 Pourtour — Ruissellement": fr(r.inspectionPourtour.ruissellement),
    "1.1.1.8 Pourtour — Commentaires": r.inspectionPourtour.commentaires,
    "1.1.1.8 Pourtour — Nb photos": r.inspectionPourtour.photos.length,
    // ── 1.1.1.9 Autres entretiens ────────────────────────────
    "1.1.1.9 Autres entretiens — Commentaires": r.autresEntretiens.commentaires,
    "1.1.1.9 Autres entretiens — Nb photos": r.autresEntretiens.photos.length,
    // ── 1.1.1.10 Photos mensuelles ───────────────────────────
    "1.1.1.10 Photos mensuelles — Nb photos": r.photosMensuelles.photos.length,
    // ── Métadonnées ──────────────────────────────────────────
    "Nb photos (total)": [
      r.postePompage.photos.length,
      r.posteControle.photos.length,
      r.plcAlarmes.photos.length,
      r.plcTensiometres.photos.length,
      r.debitmetre.photos.length,
      r.pluviometre.photos.length,
      r.santeSaules.photos.length,
      r.inspectionPourtour.photos.length,
      r.autresEntretiens.photos.length,
      r.photosMensuelles.photos.length,
    ].reduce((a, b) => a + b, 0),
    "Créé le": formatDate(r.createdAt),
    "Modifié le": formatDate(r.updatedAt),
  };

  // 1.1.1.4 Lectures tensiomètres PLC (colonnes dynamiques par T et Z)
  r.plcTensiometres.lectures.forEach((l) => {
    row[`1.1.1.4 PLC T${l.tensiometre} Z${l.zone} (kPa)`] = l.valeur;
  });

  // 1.1.1.4 Entretiens tensiomètres (colonnes dynamiques par numéro)
  r.entretiensTensiometres.forEach((t) => {
    row[`1.1.1.4 Entretien T${t.tensiometreNum} — Tension manometère (kPa)`] = t.tensionManometre;
    row[`1.1.1.4 Entretien T${t.tensiometreNum} — Tension PLC (kPa)`] = t.tensionPLC;
    row[`1.1.1.4 Entretien T${t.tensiometreNum} — Algicide requis`] = fr(t.algicideRequis);
    row[`1.1.1.4 Entretien T${t.tensiometreNum} — Bulles`] = fr(t.presenceBulles);
  });

  // 1.1.1.11 Vannes irrigation (colonnes dynamiques par zone)
  r.vannesIrrigation.forEach((v) => {
    row[`1.1.1.11 Vanne irrigation Z${v.zoneNum} — Fonctionne`] = fr(v.fonctionne);
  });

  // 1.1.1.12 Vannes lavage (colonnes dynamiques par zone)
  r.vannesLavage.forEach((v) => {
    row[`1.1.1.12 Vanne lavage Z${v.zoneNum} — Fonctionne`] = fr(v.fonctionne);
  });

  return row;
}

// ============================================================
// Construire la ligne Excel pour un test de pompage
// Structure unique (irrigation + lavage) avec N/A pour les champs non applicables
// Règles N/A :
//   - Mode irrigation : 1.2.2 Ouverture vanne lavage + Zone lavage = N/A
//   - Mode irrigation : toute la section 1.2.7 Conduite de lavage = N/A
//   - Mode irrigation : 1.2.8 Fermeture vanne lavage = N/A (autres colonnes 1.2.8 remplies normalement)
// ============================================================
export function buildPompageRow(t: PompageTest): Record<string, unknown> {
  const isIrrigation = t.modeOperation === "irrigation";
  const NA = "N/A";

  const nbPhotos = [
    t.preparation.photos.length,
    t.demarrage.photos.length,
    t.poste.photos.length,
    t.filtreY.photos.length,
    t.debitmetre.photos.length,
    t.gicleurs.photos.length,
    t.conduiteLavage.photos.length,
    t.finalisation.photos.length,
  ].reduce((a, b) => a + b, 0);

  return {
    // ── Identité ────────────────────────────────────────────
    "ID": t.id,
    "Numéro": t.testNumber,
    "Statut": frStatus(t.status),
    "Verrouillé": t.locked ? "Oui" : "Non",

    // ── Contexte ────────────────────────────────────────────
    "Client": t.context.client,
    "Site": t.context.site,
    "Système": t.context.systeme,
    "Date": t.date,
    "Effectué par": t.testedBy,
    "Zone testée": t.zoneTeste,
    "Mode": t.modeOperation === "irrigation" ? "Irrigation" : "Lavage",
    "Résultats conformes": fr(t.resultatsConformes),

    // ── 1.2.1 Préparation du test ─────────────────────────────
    "1.2.1 Préparation — Contrôleur mode manuel": t.preparation.controleurModeManuel ? "Oui" : "Non",
    "1.2.1 Préparation — Vérification arrêt pompe et vannes": t.preparation.verificationArret ? "Oui" : "Non",
    "1.2.1 Préparation — Inspection visuelle": t.preparation.inspectionVisuelle ? "Oui" : "Non",
    "1.2.1 Préparation — Commentaires": t.preparation.commentaires,
    "1.2.1 Préparation — Nb photos": t.preparation.photos.length,

    // ── 1.2.2 Démarrage de la pompe ──────────────────────────
    "1.2.2 Démarrage — Ouverture vanne irrigation": t.demarrage.ouvertureVanneIrrigation ? "Oui" : "Non",
    "1.2.2 Démarrage — Zone irrigation": t.demarrage.zoneIrrigation,
    // Mode irrigation : vanne lavage et zone lavage = N/A
    "1.2.2 Démarrage — Ouverture vanne lavage": isIrrigation ? NA : (t.demarrage.ouvertureVanneLavage ? "Oui" : "Non"),
    "1.2.2 Démarrage — Zone lavage": isIrrigation ? NA : t.demarrage.zoneLavage,
    "1.2.2 Démarrage — Démarrage pompe": t.demarrage.demarragePompe ? "Oui" : "Non",
    "1.2.2 Démarrage — Temps stabilisation (mm:ss)": t.demarrage.tempsStabilisation,
    "1.2.2 Démarrage — Commentaires": t.demarrage.commentaires,
    "1.2.2 Démarrage — Nb photos": t.demarrage.photos.length,

    // ── 1.2.3 Inspection poste de pompage ─────────────────────
    "1.2.3 Poste — Inspection visuelle": t.poste.inspectionVisuelle ? "Oui" : "Non",
    "1.2.3 Poste — Anomalies observées": fr(t.poste.anomaliesObservees),
    "1.2.3 Poste — Description anomalies": t.poste.descriptionAnomalies,
    "1.2.3 Poste — Commentaires": t.poste.commentaires,
    "1.2.3 Poste — Nb photos": t.poste.photos.length,

    // ── 1.2.4 Filtre en Y ───────────────────────────────────
    "1.2.4 Filtre Y — Pression mesurée en amont du préfiltre (PSI)": t.filtreY.amontMesuree,
    "1.2.4 Filtre Y — Pression attendue en amont du préfiltre (PSI)": t.filtreY.amontAttendue,
    "1.2.4 Filtre Y — Pression mesurée en aval du préfiltre (PSI)": t.filtreY.avalMesuree,
    "1.2.4 Filtre Y — Pression attendue en aval du préfiltre (PSI)": t.filtreY.avalAttendue,
    "1.2.4 Filtre Y — Différentiel de pression (PSI)": t.filtreY.diffPression,
    "1.2.4 Filtre Y — Nettoyage requis": fr(t.filtreY.nettoyageRequis),
    "1.2.4 Filtre Y — Nettoyage effectué": t.filtreY.nettoyageEffectue ? "Oui" : "Non",
    "1.2.4 Filtre Y — Commentaires": t.filtreY.commentaires,
    "1.2.4 Filtre Y — Nb photos": t.filtreY.photos.length,

    // ── 1.2.5 Débitmètre ───────────────────────────────────
    "1.2.5 Débitmètre — Pression mesurée en aval du préfiltre (PSI)": t.debitmetre.avalMesuree,
    "1.2.5 Débitmètre — Pression attendue en aval du préfiltre (PSI)": t.debitmetre.avalAttendue,
    "1.2.5 Débitmètre — Pression PLC mesurée (PSI)": t.debitmetre.plcPressionMesuree,
    "1.2.5 Débitmètre — Pression PLC attendue (PSI)": t.debitmetre.plcPressionAttendue,
    "1.2.5 Débitmètre — Débit PLC mesuré (m³/h)": t.debitmetre.plcDebitMesure,
    "1.2.5 Débitmètre — Débit PLC attendu (m³/h)": t.debitmetre.plcDebitAttendu,
    "1.2.5 Débitmètre — Valeurs conformes": fr(t.debitmetre.valeursConformes),
    "1.2.5 Débitmètre — Commentaires": t.debitmetre.commentaires,
    "1.2.5 Débitmètre — Nb photos": t.debitmetre.photos.length,

    // ── 1.2.6 Gicleurs et latéraux ───────────────────────────
    "1.2.6 Gicleurs — Inspection visuelle": t.gicleurs.inspectionVisuelle ? "Oui" : "Non",
    "1.2.6 Gicleurs — Défectueux": fr(t.gicleurs.gicleursDefectueux),
    "1.2.6 Gicleurs — Remplacés": t.gicleurs.gicleursRemplaces ? "Oui" : "Non",
    "1.2.6 Gicleurs — Fuites": fr(t.gicleurs.fuites),
    "1.2.6 Gicleurs — Fuites réparées": t.gicleurs.fuitesReparees ? "Oui" : "Non",
    "1.2.6 Gicleurs — Commentaires": t.gicleurs.commentaires,
    "1.2.6 Gicleurs — Nb photos": t.gicleurs.photos.length,

    // ── 1.2.7 Conduite de lavage ──────────────────────────────
    // Mode irrigation : toute la section = N/A
    "1.2.7 Conduite lavage — Inspection visuelle": isIrrigation ? NA : (t.conduiteLavage.inspectionVisuelle ? "Oui" : "Non"),
    "1.2.7 Conduite lavage — Point de rejet OK": isIrrigation ? NA : (t.conduiteLavage.pointRejet ? "Oui" : "Non"),
    "1.2.7 Conduite lavage — Fuites": isIrrigation ? NA : fr(t.conduiteLavage.fuites),
    "1.2.7 Conduite lavage — Fuites réparées": isIrrigation ? NA : (t.conduiteLavage.fuitesReparees ? "Oui" : "Non"),
    "1.2.7 Conduite lavage — Commentaires": isIrrigation ? NA : t.conduiteLavage.commentaires,
    "1.2.7 Conduite lavage — Nb photos": isIrrigation ? NA : t.conduiteLavage.photos.length,

    // ── 1.2.8 Finalisation du test ────────────────────────────
    "1.2.8 Finalisation — Arrêt pompe": t.finalisation.arretPompe ? "Oui" : "Non",
    "1.2.8 Finalisation — Fermeture vanne irrigation": t.finalisation.fermetureVanneIrrigation ? "Oui" : "Non",
    // Mode irrigation : fermeture vanne lavage = N/A (autres colonnes 1.2.8 remplies normalement)
    "1.2.8 Finalisation — Fermeture vanne lavage": isIrrigation ? NA : (t.finalisation.fermetureVanneLavage ? "Oui" : "Non"),
    "1.2.8 Finalisation — Remise en mode auto": t.finalisation.remiseAuto ? "Oui" : "Non",
    "1.2.8 Finalisation — Commentaires": t.finalisation.commentaires,
    "1.2.8 Finalisation — Nb photos": t.finalisation.photos.length,

    // ── Métadonnées ──────────────────────────────────────────
    "Nb photos (total)": nbPhotos,
    "Créé le": formatDate(t.createdAt),
    "Modifié le": formatDate(t.updatedAt),
  };
}

// ============================================================
// Ajouter automatiquement un rapport finalisé à l'Excel cumulatif
// ET synchroniser vers Google Sheets
// ============================================================
import { sendToGoogleSheets } from "./googleSheets";

export async function autoAddSuiviToExcel(report: SuiviReport): Promise<{ sheetsOk: boolean; sheetsError?: string; sheetsAction?: string; debugInfo?: import('./googleSheets').SheetsDebugInfo }> {
  const already = await hasExcelRow(report.id);
  const row = buildSuiviRow(report);
  if (!already) {
    await addExcelRow({
      id: generateId(),
      type: "suivi",
      reportId: report.id,
      addedAt: new Date().toISOString(),
      data: row,
    });
  }
  const result = await sendToGoogleSheets({ type: "suivi", reportId: report.id, reportNumber: report.reportNumber, data: row });
  // NE PAS sauvegarder ici — l'appelant (SuiviWizard/SuiviMenu) s'en charge
  // pour éviter d'écraser syncedToDrive avec un objet incomplet
  return {
    sheetsOk: result.success,
    sheetsError: result.success ? undefined : result.error,
    sheetsAction: result.success ? result.action : undefined,
    debugInfo: result.debugInfo,
  };
}

export async function autoAddPompageToExcel(test: PompageTest): Promise<{ sheetsOk: boolean; sheetsError?: string; sheetsAction?: string; debugInfo?: import('./googleSheets').SheetsDebugInfo }> {
  const already = await hasExcelRow(test.id);
  const row = buildPompageRow(test);
  if (!already) {
    await addExcelRow({
      id: generateId(),
      type: "pompage",
      reportId: test.id,
      addedAt: new Date().toISOString(),
      data: row,
    });
  }
  const result = await sendToGoogleSheets({ type: "pompage", reportId: test.id, reportNumber: test.testNumber, data: row });
  // NE PAS sauvegarder ici — l'appelant (PompageWizard/PompageMenu) s'en charge
  // pour éviter d'écraser syncedToDrive avec un objet incomplet
  return {
    sheetsOk: result.success,
    sheetsError: result.success ? undefined : result.error,
    sheetsAction: result.success ? result.action : undefined,
    debugInfo: result.debugInfo,
  };
}

// ============================================================
// Télécharger le fichier Excel cumulatif
// 2 feuilles : Suivi terrain | Tests de pompage (irrigation + lavage, colonne Mode)
//
// IMPORTANT : On reconstruit les lignes directement depuis les rapports sources
// (getAllSuiviReports / getAllPompageTests) plutôt que depuis le cache IndexedDB,
// afin de garantir que les numéros de sections et les noms de colonnes sont
// toujours à jour, même pour les rapports créés avant une mise à jour de l'app.
// ============================================================
export async function downloadCumulativeExcel(): Promise<void> {
  await loadXLSX();
  const [allSuivi, allPompage] = await Promise.all([
    getAllSuiviReports(),
    getAllPompageTests(),
  ]);

  // Filtrer uniquement les rapports finalisés (status = completed ou archived)
  const suiviFinalized = allSuivi.filter(
    (r) => r.status === "completed" || r.status === "archived"
  );
  const pompageFinalized = allPompage.filter(
    (t) => t.status === "completed" || t.status === "archived"
  );

  // Reconstruire les lignes avec les noms de colonnes actuels (numéros de sections inclus)
  const suiviData = suiviFinalized
    .sort((a, b) => a.reportNumber.localeCompare(b.reportNumber))
    .map((r) => buildSuiviRow(r));

  // Tous les tests de pompage dans une seule feuille, triés par numéro
  // La colonne "Mode" (Irrigation / Lavage) permet de filtrer dans Excel
  // Les champs non applicables selon le mode sont remplis avec N/A
  const pompageData = pompageFinalized
    .sort((a, b) => a.testNumber.localeCompare(b.testNumber))
    .map((t) => buildPompageRow(t));

  const wb = XLSX.utils.book_new();

  // Feuille 1 : Suivi terrain
  if (suiviData.length > 0) {
    const ws = XLSX.utils.json_to_sheet(suiviData);
    XLSX.utils.book_append_sheet(wb, ws, "Suivi terrain");
  } else {
    const ws = XLSX.utils.json_to_sheet([{ Message: "Aucun rapport de suivi finalisé" }]);
    XLSX.utils.book_append_sheet(wb, ws, "Suivi terrain");
  }

  // Feuille 2 : Tests de pompage (irrigation + lavage unifiés)
  if (pompageData.length > 0) {
    const ws = XLSX.utils.json_to_sheet(pompageData);
    XLSX.utils.book_append_sheet(wb, ws, "Tests de pompage");
  } else {
    const ws = XLSX.utils.json_to_sheet([{ Message: "Aucun test de pompage finalisé" }]);
    XLSX.utils.book_append_sheet(wb, ws, "Tests de pompage");
  }

  const date = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `Evaplant_Rapports_${date}.xlsx`);
}
