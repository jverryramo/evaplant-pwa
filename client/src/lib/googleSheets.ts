// ============================================================
// googleSheets.ts — Synchronisation bidirectionnelle Google Sheets
// Via Google Apps Script Web App (Option B — aucune clé API)
//
// STRATÉGIE D'UPSERT :
// On envoie DEUX identifiants dans le payload :
//   - reportId  : UUID interne stable (jamais modifié après création)
//                 → utilisé par Apps Script pour retrouver la ligne existante
//   - reportNumber : numéro visible (ex: "0001") → affiché dans le Sheet
//
// Le script Apps Script cherche d'abord dans la colonne "ID" (reportId).
// Si trouvé → UPDATE. Sinon → INSERT.
// Cela garantit l'absence de doublon même si le numéro visible change.
// ============================================================

const APPS_SCRIPT_URL =
  import.meta.env.VITE_APPS_SCRIPT_URL ??
  "https://script.google.com/macros/s/AKfycbyVIkNEFUN3xtdmjlGGoyNlYvtFTHYF_LkrZCbRo_ac0DEqTt2BOjMclyzD5IQhw5aA/exec";

export type SheetsResult =
  | { success: true; message: string; action?: "updated" | "inserted"; debugInfo?: SheetsDebugInfo }
  | { success: false; error: string; debugInfo?: SheetsDebugInfo };

export interface SheetsDebugInfo {
  reportNumber: string;
  reportId: string;
  action: string;
  sheet: string;
}

// Noms des onglets Google Sheets
export const SHEET_NAMES = {
  suivi: "Suivi terrain",
  pompage: "Tests de pompage",
} as const;

/**
 * Envoie ou met à jour une ligne dans Google Sheets.
 *
 * UPSERT par reportId (UUID interne stable) :
 * - Apps Script cherche la colonne "ID" dans le Sheet
 * - Si une ligne avec le même reportId existe → UPDATE
 * - Sinon → INSERT
 *
 * Payload envoyé :
 * {
 *   type: "suivi" | "pompage",
 *   reportId: string,      ← UUID stable, clé d'upsert principale
 *   reportNumber: string,  ← numéro visible (ex: "0001")
 *   data: { [colonne]: valeur }  ← inclut "ID" et "Numéro" en premières colonnes
 * }
 */
export async function sendToGoogleSheets(payload: {
  type: "suivi" | "pompage";
  reportId: string;
  reportNumber?: string;
  data: Record<string, unknown>;
}): Promise<SheetsResult> {
  if (!APPS_SCRIPT_URL) {
    return { success: false, error: "URL Apps Script non configurée" };
  }

  const reportNum = payload.reportNumber ?? payload.reportId;
  const reportId = payload.reportId;

  // Déterminer le nom de l'onglet cible
  const sheetTarget =
    payload.type === "suivi"
      ? SHEET_NAMES.suivi
      : SHEET_NAMES.pompage;

  // Injecter "ID" en première position dans data (clé d'upsert stable)
  // et s'assurer que "Numéro" est aussi présent
  const dataWithId: Record<string, unknown> = {
    "ID": reportId,
    "Numéro": reportNum,
    ...payload.data,
  };

  const body = JSON.stringify({
    type: payload.type,
    sheetName: sheetTarget,    // nom exact de l'onglet cible
    reportId: reportId,        // clé d'upsert principale (UUID stable)
    reportNumber: reportNum,   // numéro visible (pour info)
    data: dataWithId,
  });

  console.log(
    "[GoogleSheets] ▶ Upsert →",
    sheetTarget,
    "| ID:", reportId,
    "| N°:", reportNum,
    "| Colonnes:", Object.keys(dataWithId).length
  );

  // Tentative 1 : mode cors standard
  // Tentative 2 : mode no-cors (iOS Safari fallback) — on ne peut pas lire la réponse
  //               mais si la requête passe sans exception, on considère que c'est un succès
  const attemptFetch = async (useFallback: boolean): Promise<SheetsResult> => {
    if (useFallback) {
      // Mode no-cors : contourne le preflight iOS Safari
      // On encode les données dans un FormData pour éviter le preflight
      const form = new FormData();
      form.append('payload', body);
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: form,
      });
      // En mode no-cors on ne peut pas lire la réponse — on suppose succès
      console.log("[GoogleSheets] ✓ Envoi no-cors (iOS fallback) — supposé succès");
      return {
        success: true,
        message: `Rapport synchronisé — reportNumber: ${reportNum}`,
        action: undefined,
        debugInfo: { reportNumber: reportNum, reportId, action: "inserted", sheet: sheetTarget }
      };
    }

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("[GoogleSheets] ✗ HTTP", response.status, errText);
      return {
        success: false,
        error: `Erreur HTTP ${response.status}`,
        debugInfo: { reportNumber: reportNum, reportId, action: "error", sheet: payload.type }
      };
    }

    let json: { status?: string; action?: string; message?: string; sheet?: string } = {};
    try {
      json = await response.json();
    } catch {
      console.warn("[GoogleSheets] ⚠ Réponse non-JSON (status 200)");
      return {
        success: true,
        message: "Rapport synchronisé (réponse non-JSON)",
        debugInfo: { reportNumber: reportNum, reportId, action: "unknown", sheet: payload.type }
      };
    }

    const action = json.action as "updated" | "inserted" | undefined;
    const sheetName = json.sheet ?? sheetTarget;
    const debugInfo: SheetsDebugInfo = {
      reportNumber: reportNum,
      reportId,
      action: action ?? "unknown",
      sheet: sheetName,
    };

    console.log(
      "[GoogleSheets] ✓ Réponse →",
      "status:", json.status,
      "| action:", action ?? "?",
      "| N°:", reportNum,
      "| ID:", reportId,
      "| onglet:", sheetName
    );

    if (json.status === "success" || json.status === "ok") {
      const msg = action === "updated"
        ? `Sync réussie — action: updated — reportNumber: ${reportNum}`
        : action === "inserted"
        ? `Sync réussie — action: inserted — reportNumber: ${reportNum}`
        : `Rapport synchronisé — reportNumber: ${reportNum}`;
      return { success: true, message: msg, action, debugInfo };
    }

    return {
      success: false,
      error: json.message ?? "Erreur inconnue du script",
      debugInfo
    };
  };

  try {
    return await attemptFetch(false);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn("[GoogleSheets] ⚠ Erreur cors, tentative no-cors:", errorMsg);
    // Fallback no-cors pour iOS Safari
    try {
      return await attemptFetch(true);
    } catch (err2) {
      const errorMsg2 = err2 instanceof Error ? err2.message : String(err2);
      console.error("[GoogleSheets] ✗ Erreur réseau (no-cors):", errorMsg2);
      return {
        success: false,
        error: `Erreur réseau: ${errorMsg2}`,
        debugInfo: { reportNumber: reportNum, reportId, action: "error", sheet: payload.type }
      };
    }
  }
}

/**
 * Lit les rapports depuis Google Sheets pour la synchronisation multi-utilisateurs.
 */
export async function fetchFromGoogleSheets(
  type: "suivi" | "pompage"
): Promise<{ success: boolean; rows: Record<string, string>[] }> {
  if (!APPS_SCRIPT_URL) {
    return { success: false, rows: [] };
  }

  console.log("[GoogleSheets] Lecture →", type);

  try {
    const url = `${APPS_SCRIPT_URL}?action=list&type=${type}`;
    const response = await fetch(url, { method: "GET", mode: "cors" });

    if (!response.ok) {
      console.error("[GoogleSheets] ✗ Erreur lecture HTTP:", response.status);
      return { success: false, rows: [] };
    }

    const json = await response.json();
    if (json.status === "ok" && Array.isArray(json.rows)) {
      console.log("[GoogleSheets] ✓ Lecture:", json.rows.length, "lignes");
      return { success: true, rows: json.rows };
    }

    return { success: false, rows: [] };
  } catch (err) {
    console.error("[GoogleSheets] ✗ Erreur lecture:", err);
    return { success: false, rows: [] };
  }
}
