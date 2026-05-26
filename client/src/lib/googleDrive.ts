// ============================================================
// googleDrive.ts — Upload automatique de PDF vers Google Drive
// Via le même Google Apps Script que la synchronisation Sheets
//
// Nomenclature : YYYYMMDD_Site_Client_Createur_Type.pdf
// Dossier Drive : RAPPORTS_EVAPLANT_V2 / <site> (un dossier par site)
// ============================================================

const APPS_SCRIPT_URL =
  import.meta.env.VITE_APPS_SCRIPT_URL ??
  "https://script.google.com/macros/s/AKfycbyVIkNEFUN3xtdmjlGGoyNlYvtFTHYF_LkrZCbRo_ac0DEqTt2BOjMclyzD5IQhw5aA/exec";

export type DriveUploadResult =
  | { success: true; fileId: string; fileUrl: string; filename: string; folderName: string }
  | { success: false; error: string };

export interface DriveUploadOptions {
  base64: string;
  site: string;
  client?: string;
  operator?: string;
  date?: string;
  reportType?: "Suivi" | "Pompage";
}

/**
 * Envoie un PDF en base64 vers Google Drive via Apps Script.
 *
 * Le script Apps Script :
 * 1. Construit le nom de fichier : YYYYMMDD_Site_Client_Createur_Type.pdf
 * 2. Trouve ou crée le sous-dossier <site> dans RAPPORTS_EVAPLANT_V2
 * 3. Dépose le fichier dans ce sous-dossier
 */
export async function uploadPdfToDrive(
  options: DriveUploadOptions
): Promise<DriveUploadResult> {
  if (!APPS_SCRIPT_URL) {
    return { success: false, error: "URL Apps Script non configurée" };
  }

  const { base64, site, client = "", operator = "", date = "", reportType = "Suivi" } = options;

  console.log("[GoogleDrive] ▶ Upload PDF →", site, "|", client, "|", operator, "|", date, "|", reportType);

  try {
    const body = JSON.stringify({
      action: "uploadPdf",
      base64,
      site,
      client,
      operator,
      date,
      reportType,
    });

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("[GoogleDrive] ✗ HTTP", response.status, errText);
      return { success: false, error: `Erreur HTTP ${response.status}` };
    }

    let json: {
      status?: string;
      fileId?: string;
      fileUrl?: string;
      filename?: string;
      folderName?: string;
      message?: string;
    } = {};

    try {
      json = await response.json();
    } catch {
      console.warn("[GoogleDrive] ⚠ Réponse non-JSON");
      return { success: false, error: "Réponse inattendue du serveur" };
    }

    if (json.status === "success" && json.fileId) {
      console.log("[GoogleDrive] ✓ PDF uploadé →", json.filename, "→", json.fileUrl);
      return {
        success: true,
        fileId: json.fileId,
        fileUrl: json.fileUrl ?? "",
        filename: json.filename ?? "",
        folderName: json.folderName ?? site,
      };
    }

    console.error("[GoogleDrive] ✗ Erreur Apps Script:", json.message);
    return {
      success: false,
      error: json.message ?? "Erreur inconnue lors de l'upload",
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[GoogleDrive] ✗ Erreur réseau:", errorMsg);
    return { success: false, error: `Erreur réseau: ${errorMsg}` };
  }
}
