// ============================================================
// googleDrive.ts — Upload automatique de PDF vers Google Drive
// Via le même Google Apps Script que la synchronisation Sheets
// Dossier parent fixe dans Drive, sous-dossier automatique par site
// ============================================================

const APPS_SCRIPT_URL =
  import.meta.env.VITE_APPS_SCRIPT_URL ??
  "https://script.google.com/macros/s/AKfycbyVIkNEFUN3xtdmjlGGoyNlYvtFTHYF_LkrZCbRo_ac0DEqTt2BOjMclyzD5IQhw5aA/exec";

export type DriveUploadResult =
  | { success: true; fileId: string; fileUrl: string; folderName: string }
  | { success: false; error: string };

/**
 * Envoie un PDF en base64 vers Google Drive via Apps Script.
 * Le script dépose le fichier dans un sous-dossier portant le nom du site,
 * créé automatiquement dans le dossier parent Evaplant sur Drive.
 */
export async function uploadPdfToDrive(
  base64: string,
  filename: string,
  site: string
): Promise<DriveUploadResult> {
  if (!APPS_SCRIPT_URL) {
    return { success: false, error: "URL Apps Script non configurée" };
  }

  console.log("[GoogleDrive] ▶ Upload PDF →", filename, "→ dossier:", site);

  try {
    const body = JSON.stringify({
      action: "uploadPdf",
      filename,
      base64,
      site, // Nom du site → sous-dossier dans Drive
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

    let json: { status?: string; fileId?: string; fileUrl?: string; folderName?: string; message?: string } = {};
    try {
      json = await response.json();
    } catch {
      console.warn("[GoogleDrive] ⚠ Réponse non-JSON");
      return { success: false, error: "Réponse inattendue du serveur" };
    }

    if (json.status === "success" && json.fileId) {
      console.log("[GoogleDrive] ✓ PDF uploadé →", json.fileUrl);
      return {
        success: true,
        fileId: json.fileId,
        fileUrl: json.fileUrl ?? "",
        folderName: json.folderName ?? site,
      };
    }

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
