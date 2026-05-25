// ============================================================
// pdfExport.ts — Génération PDF par rapport (jsPDF)
// Logo Ramo proportionnel + photos intégrées par section
// ============================================================

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SuiviReport, PompageTest, AnnotatedPhoto } from "./types";

// Logo Ramo — version blanche pour fond vert foncé
// On utilise le logo vert foncé et on applique un filtre CSS via canvas pour le rendre blanc
const RAMO_LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663321843879/nHzuf69SdfQPLwa7tmLvVH/Logo-Ramo-Foret_316edc68.webp";

// Couleurs charte Ramo
const GREEN_DARK = [0, 61, 57] as [number, number, number];
const GREEN_LIGHT = [220, 242, 30] as [number, number, number];
const SAND_LIGHT = [245, 240, 234] as [number, number, number];
const SAND_MID = [221, 204, 191] as [number, number, number];
const BROWN = [138, 112, 73] as [number, number, number];

// Traductions
const YESNO_FR: Record<string, string> = {
  oui: "Oui",
  non: "Non",
  na: "N/A",
  "": "—",
};
const STATUS_FR: Record<string, string> = {
  draft: "Brouillon",
  in_progress: "En cours",
  completed: "Complété",
  archived: "Archivé",
};

function fr(val: string | undefined | null): string {
  if (!val) return "—";
  return YESNO_FR[val] ?? val;
}

// ============================================================
// Chargement d'image avec dimensions naturelles
// ============================================================
type LogoData = { data: string; width: number; height: number } | null;

// Charge le logo et le convertit en blanc via canvas (pour fond vert foncé)
async function loadImageBase64(url: string): Promise<LogoData> {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const originalData = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    // Charger l'image et la rendre blanche via canvas
    const result = await new Promise<LogoData>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d")!;
          // Dessiner l'image originale
          ctx.drawImage(img, 0, 0);
          // Appliquer le filtre blanc : remplacer tous les pixels non-transparents par blanc
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imageData.data;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] > 10) { // pixel non transparent
              d[i] = 255;     // R
              d[i + 1] = 255; // G
              d[i + 2] = 255; // B
              // conserver alpha
            }
          }
          ctx.putImageData(imageData, 0, 0);
          const whiteData = canvas.toDataURL("image/png");
          resolve({ data: whiteData, width: img.naturalWidth, height: img.naturalHeight });
        } catch {
          resolve({ data: originalData, width: img.naturalWidth, height: img.naturalHeight });
        }
      };
      img.onerror = () => resolve(null);
      img.src = originalData;
    });
    return result;
  } catch {
    return null;
  }
}

// ============================================================
// En-tête du document
// ============================================================
async function drawHeader(
  doc: jsPDF,
  logoBase64: LogoData,
  title: string,
  subtitle: string,
  reportNumber: string,
  date: string,
  client: string,
  site: string,
  systeme: string
) {
  const pageW = doc.internal.pageSize.getWidth();

  // Fond header vert foncé
  doc.setFillColor(...GREEN_DARK);
  doc.rect(0, 0, pageW, 28, "F");

  // Logo — proportions respectées
  if (logoBase64) {
    try {
      const maxH = 14;
      const ratio = logoBase64.width / logoBase64.height;
      const logoW = maxH * ratio;
      const logoY = (28 - maxH) / 2;
      doc.addImage(logoBase64.data, "WEBP", 10, logoY, logoW, maxH);
    } catch {
      doc.setFontSize(14);
      doc.setTextColor(...GREEN_LIGHT);
      doc.setFont("helvetica", "bold");
      doc.text("RAMO", 12, 17);
    }
  } else {
    doc.setFontSize(14);
    doc.setTextColor(...GREEN_LIGHT);
    doc.setFont("helvetica", "bold");
    doc.text("RAMO", 12, 17);
  }

  // Titre rapport (centré)
  doc.setFontSize(11);
  doc.setTextColor(...GREEN_LIGHT);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageW / 2, 10, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(245, 240, 234);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, pageW / 2, 16, { align: "center" });

  // Numéro rapport (droite)
  doc.setFontSize(10);
  doc.setTextColor(...GREEN_LIGHT);
  doc.setFont("helvetica", "bold");
  doc.text(`N° ${reportNumber}`, pageW - 12, 10, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(245, 240, 234);
  doc.text(date, pageW - 12, 16, { align: "right" });

  // Bandeau contexte
  doc.setFillColor(...SAND_LIGHT);
  doc.rect(0, 28, pageW, 10, "F");
  doc.setFontSize(8);
  doc.setTextColor(...BROWN);
  doc.setFont("helvetica", "normal");
  doc.text(`Client : ${client}   |   Site : ${site}   |   Système : ${systeme}`, 10, 34);
}

// ============================================================
// Pied de page
// ============================================================
function drawFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...SAND_MID);
  doc.rect(0, pageH - 8, pageW, 8, "F");
  doc.setFontSize(7);
  doc.setTextColor(...BROWN);
  doc.text("Evaplant — Opérations Terrain | Ramo", 10, pageH - 3);
  doc.text(`Page ${pageNum} / ${totalPages}`, pageW - 10, pageH - 3, { align: "right" });
}

// ============================================================
// Titre de section
// ============================================================
function sectionTitle(doc: jsPDF, title: string, y: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...GREEN_DARK);
  doc.rect(0, y, pageW, 7, "F");
  doc.setFontSize(8);
  doc.setTextColor(...GREEN_LIGHT);
  doc.setFont("helvetica", "bold");
  doc.text(title, 10, y + 5);
  return y + 10;
}

// ============================================================
// Tableau de données
// ============================================================
function dataTable(doc: jsPDF, rows: [string, string][], startY: number): number {
  autoTable(doc, {
    startY,
    head: [],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 70, fillColor: SAND_LIGHT, textColor: BROWN },
      1: { cellWidth: "auto", textColor: [30, 30, 30] },
    },
    margin: { left: 10, right: 10 },
    theme: "plain",
  });
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
}

// ============================================================
// Insérer les photos d'une section dans le PDF
// Retourne le nouveau y
// ============================================================
async function insertPhotos(
  doc: jsPDF,
  photos: AnnotatedPhoto[],
  y: number,
  addHeaderFooterFn: () => Promise<void>
): Promise<number> {
  if (!photos || photos.length === 0) return y;

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const photoMaxW = (pageW - margin * 2 - 4) / 2; // 2 photos par ligne
  const photoMaxH = 60; // hauteur max par photo en mm
  const captionH = 6;

  // Titre "Photos"
  if (y + 10 > pageH - 20) {
    doc.addPage();
    await addHeaderFooterFn();
    y = 42;
  }
  doc.setFontSize(7.5);
  doc.setTextColor(...BROWN);
  doc.setFont("helvetica", "bold");
  doc.text("Photos :", margin, y + 4);
  y += 8;

  for (let i = 0; i < photos.length; i += 2) {
    // Vérifier si on a besoin d'une nouvelle page
    if (y + photoMaxH + captionH + 4 > pageH - 20) {
      doc.addPage();
      await addHeaderFooterFn();
      y = 42;
    }

    const photosInRow = photos.slice(i, i + 2);
    for (let j = 0; j < photosInRow.length; j++) {
      const photo = photosInRow[j];
      const xOffset = margin + j * (photoMaxW + 4);

      try {
        // Déterminer les dimensions réelles de l'image pour conserver les proportions
        const imgDims = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.onerror = () => resolve({ width: 1, height: 1 });
          img.src = photo.dataUrl;
        });

        const ratio = imgDims.width / imgDims.height;
        let drawW = photoMaxW;
        let drawH = drawW / ratio;
        if (drawH > photoMaxH) {
          drawH = photoMaxH;
          drawW = drawH * ratio;
        }

        // Image sans cadre, alignée à gauche de sa colonne, taille adaptée aux proportions
        const xImg = xOffset;
        const yImg = y;

        // Les photos sont déjà converties en JPEG à la capture (PhotoGallery)
        // Insertion directe dans jsPDF
        doc.addImage(photo.dataUrl, "JPEG", xImg, yImg, drawW, drawH);
      } catch (photoErr) {
        console.warn("[PDF] Erreur chargement photo:", photoErr);
        // Placeholder si l'image ne charge pas
        doc.setFillColor(230, 230, 230);
        doc.rect(xOffset, y, photoMaxW, photoMaxH, "F");
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text("Image non disponible", xOffset + photoMaxW / 2, y + photoMaxH / 2, { align: "center" });
      }

      // Légende
      if (photo.caption) {
        doc.setFontSize(7);
        doc.setTextColor(80, 80, 80);
        doc.setFont("helvetica", "italic");
        const captionLines = doc.splitTextToSize(photo.caption, photoMaxW);
        doc.text(captionLines[0], xOffset, y + photoMaxH + 4);
      }
    }

    y += photoMaxH + captionH + 4;
  }

  return y + 4;
}

// ============================================================
// Générer le PDF d'un rapport de suivi terrain
// ============================================================
export interface PdfResult {
  base64: string;
  filename: string;
}

export async function generateSuiviPDF(report: SuiviReport): Promise<PdfResult> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logoBase64 = await loadImageBase64(RAMO_LOGO_URL);
  const pageH = doc.internal.pageSize.getHeight();

  const addHeaderFooter = async () => {
    await drawHeader(
      doc,
      logoBase64,
      "Rapport de suivi terrain",
      `Rapport N° ${report.reportNumber} — ${STATUS_FR[report.status] ?? report.status}`,
      report.reportNumber,
      report.config.date,
      report.context.client,
      report.context.site,
      report.context.systeme
    );
    drawFooter(doc, doc.getCurrentPageInfo().pageNumber, 1); // sera mis à jour
  };

  // Vérifier si on a besoin d'une nouvelle page
  const checkPage = async (y: number, needed = 30): Promise<number> => {
    if (y + needed > pageH - 20) {
      doc.addPage();
      await addHeaderFooter();
      return 42;
    }
    return y;
  };

  await addHeaderFooter();
  let y = 42;

  // ── Informations générales ──
  y = sectionTitle(doc, "Informations générales", y);
  y = dataTable(doc, [
    ["Date", report.config.date],
    ["Créé par", report.config.createdBy],
    ["Nombre de zones", String(report.config.nombreZones)],
    ["Nombre de tensiomètres", String(report.config.nombreTensiometres)],
    ["Statut", STATUS_FR[report.status] ?? report.status],
  ], y);

  // ── 1.1.1.3 Poste de pompage ──
  y = await checkPage(y, 40);
  y = sectionTitle(doc, "1.1.1.3 — Poste de pompage", y);
  y = dataTable(doc, [
    ["Alarmes VFD", fr(report.postePompage.alarmesVFD)],
    ["Description alarmes", report.postePompage.descriptionAlarmes || "—"],
    ["Alarmes acquittées", fr(report.postePompage.alarmesAcquittees)],
    ["Commentaires", report.postePompage.commentaires || "—"],
  ], y);
  y = await insertPhotos(doc, report.postePompage.photos, y, addHeaderFooter);

  // ── 1.1.1.4 Poste de contrôle ──
  y = await checkPage(y, 40);
  y = sectionTitle(doc, "1.1.1.4 — Poste de contrôle", y);
  y = dataTable(doc, [
    ["État équipements", report.posteControle.etatEquipements || "—"],
    ["Présence fuites", fr(report.posteControle.presenceFuites)],
    ["Alarmes acquittées", fr(report.posteControle.alarmesAcquittees)],
    ["Commentaires", report.posteControle.commentaires || "—"],
  ], y);
  y = await insertPhotos(doc, report.posteControle.photos, y, addHeaderFooter);

  // ── 1.1.1.5 Interface PLC — Alarmes ──
  y = await checkPage(y, 40);
  y = sectionTitle(doc, "1.1.1.5 — Interface PLC — Alarmes", y);
  y = dataTable(doc, [
    ["Alarmes présentes", fr(report.plcAlarmes.alarmesPresentes)],
    ["Description alarmes", report.plcAlarmes.descriptionAlarmes || "—"],
    ["Alarmes acquittées", fr(report.plcAlarmes.alarmesAcquittees)],
    ["Commentaires", report.plcAlarmes.commentaires || "—"],
  ], y);
  y = await insertPhotos(doc, report.plcAlarmes.photos, y, addHeaderFooter);

  // ── 1.1.1.6 Interface PLC — Tensiomètres ──
  y = await checkPage(y, 40);
  y = sectionTitle(doc, "1.1.1.6 — Interface PLC — Tensiomètres", y);
  const tensioRows: [string, string][] = report.plcTensiometres.lectures.map((l) => [
    `Zone ${l.zone} — Tensiomètre ${l.tensiometre}`,
    l.valeur ? `${l.valeur} kPa` : "—",
  ]);
  if (report.plcTensiometres.commentaires) tensioRows.push(["Commentaires", report.plcTensiometres.commentaires]);
  y = dataTable(doc, tensioRows, y);
  y = await insertPhotos(doc, report.plcTensiometres.photos, y, addHeaderFooter);

  // ── 1.1.1.7 Débitmètre ──
  y = await checkPage(y, 40);
  y = sectionTitle(doc, "1.1.1.7 — Débitmètre", y);
  y = dataTable(doc, [
    ["Messages erreur", fr(report.debitmetre.messagesErreur)],
    ["Volume cumulatif", report.debitmetre.volumeCumulActuel ? `${report.debitmetre.volumeCumulActuel} m³` : "—"],
    ["Commentaires", report.debitmetre.commentaires || "—"],
  ], y);
  y = await insertPhotos(doc, report.debitmetre.photos, y, addHeaderFooter);

  // ── 1.1.1.8 Pluviomètre ──
  y = await checkPage(y, 40);
  y = sectionTitle(doc, "1.1.1.8 — Pluviomètre", y);
  y = dataTable(doc, [
    ["Nettoyage requis", fr(report.pluviometre.nettoyageRequis)],
    ["Nettoyage effectué", report.pluviometre.nettoyageEffectue ? "Oui" : "Non"],
    ["Commentaires", report.pluviometre.commentaires || "—"],
  ], y);
  y = await insertPhotos(doc, report.pluviometre.photos, y, addHeaderFooter);

  // ── 1.1.1.9 Entretien tensiomètres ──
  for (const t of report.entretiensTensiometres) {
    y = await checkPage(y, 50);
    y = sectionTitle(doc, `1.1.1.9 — Entretien Tensiomètre ${t.tensiometreNum} — Zone ${t.zoneNum}`, y);
    y = dataTable(doc, [
      ["Tension manomètre", t.tensionManometre ? `${t.tensionManometre} kPa` : "—"],
      ["Tension PLC", t.tensionPLC ? `${t.tensionPLC} kPa` : "—"],
      ["Algicide requis", fr(t.algicideRequis)],
      ["Présence bulles", fr(t.presenceBulles)],
      ["Commentaires", t.commentaires || "—"],
    ], y);
    y = await insertPhotos(doc, t.photos, y, addHeaderFooter);
  }

  // ── 1.1.1.10 Vannes irrigation ──
  for (const v of report.vannesIrrigation) {
    y = await checkPage(y, 35);
    y = sectionTitle(doc, `1.1.1.10 — Vanne d'irrigation — Zone ${v.zoneNum}`, y);
    y = dataTable(doc, [
      ["Fonctionne", fr(v.fonctionne)],
      ["Commentaires", v.commentaires || "—"],
    ], y);
    y = await insertPhotos(doc, v.photos, y, addHeaderFooter);
  }

  // ── 1.1.1.11 Vannes lavage ──
  for (const v of report.vannesLavage) {
    y = await checkPage(y, 35);
    y = sectionTitle(doc, `1.1.1.11 — Vanne de lavage — Zone ${v.zoneNum}`, y);
    y = dataTable(doc, [
      ["Fonctionne", fr(v.fonctionne)],
      ["Commentaires", v.commentaires || "—"],
    ], y);
    y = await insertPhotos(doc, v.photos, y, addHeaderFooter);
  }

  // ── 1.1.1.12 Santé saules ──
  y = await checkPage(y, 40);
  y = sectionTitle(doc, "1.1.1.12 — Santé générale des saules", y);
  y = dataTable(doc, [
    ["Score", report.santeSaules.score ? `${report.santeSaules.score} / 3` : "—"],
    ["Commentaires", report.santeSaules.commentaires || "—"],
  ], y);
  y = await insertPhotos(doc, report.santeSaules.photos, y, addHeaderFooter);

  // ── 1.1.1.13 Inspection pourtour ──
  y = await checkPage(y, 35);
  y = sectionTitle(doc, "1.1.1.13 — Inspection pourtour plantation", y);
  y = dataTable(doc, [
    ["Ruissellement", fr(report.inspectionPourtour.ruissellement)],
    ["Commentaires", report.inspectionPourtour.commentaires || "—"],
  ], y);
  y = await insertPhotos(doc, report.inspectionPourtour.photos, y, addHeaderFooter);

  // ── 1.1.1.14 Autres entretiens ──
  y = await checkPage(y, 30);
  y = sectionTitle(doc, "1.1.1.14 — Autres entretiens", y);
  y = dataTable(doc, [["Commentaires", report.autresEntretiens.commentaires || "—"]], y);
  y = await insertPhotos(doc, report.autresEntretiens.photos, y, addHeaderFooter);

  // ── 1.1.1.15 Photos mensuelles ──
  if (report.photosMensuelles.photos.length > 0) {
    y = await checkPage(y, 30);
    y = sectionTitle(doc, "1.1.1.15 — Photos rapports mensuels", y);
    y = await insertPhotos(doc, report.photosMensuelles.photos, y, addHeaderFooter);
  }

  // ── 1.1.1.16 Présence Ramo ──
  y = await checkPage(y, 35);
  y = sectionTitle(doc, "1.1.1.16 — Présence Ramo", y);
  if (report.presenceRamo.employes.length > 0) {
    y = dataTable(doc, report.presenceRamo.employes.map((e) => [
      e.name,
      `${e.titleRole} | Arrivée : ${e.heureArrivee} | Départ : ${e.heureDepart}`,
    ]), y);
  } else {
    y = dataTable(doc, [["Employés", "—"]], y);
  }

  // ── 1.1.1.17 Autres intervenants ──
  y = await checkPage(y, 35);
  y = sectionTitle(doc, "1.1.1.17 — Autres intervenants", y);
  if (report.presenceAutres.intervenants.length > 0) {
    y = dataTable(doc, report.presenceAutres.intervenants.map((e) => [
      e.name,
      `${e.titleRole} | Arrivée : ${e.heureArrivee} | Départ : ${e.heureDepart}`,
    ]), y);
  } else {
    y = dataTable(doc, [["Intervenants", "—"]], y);
  }

  // Mise à jour des pieds de page avec le total réel
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, i, totalPages);
  }

  const filename = `Rapport_Suivi_${report.reportNumber}_${report.context.site.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  doc.save(filename);
  return {
    base64: doc.output("datauristring").split(",")[1],
    filename,
  };
}

// ============================================================
// Générer le PDF d'un test de pompage
// ============================================================
export async function generatePompagePDF(test: PompageTest): Promise<PdfResult> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logoBase64 = await loadImageBase64(RAMO_LOGO_URL);
  const pageH = doc.internal.pageSize.getHeight();

  const addHeaderFooter = async () => {
    await drawHeader(
      doc,
      logoBase64,
      "Test de pompage",
      `Test N° ${test.testNumber} — Mode : ${test.modeOperation === "irrigation" ? "Irrigation" : "Lavage"}`,
      test.testNumber,
      test.date,
      test.context.client,
      test.context.site,
      test.context.systeme
    );
    drawFooter(doc, doc.getCurrentPageInfo().pageNumber, 1);
  };

  const checkPage = async (y: number, needed = 30): Promise<number> => {
    if (y + needed > pageH - 20) {
      doc.addPage();
      await addHeaderFooter();
      return 42;
    }
    return y;
  };

  await addHeaderFooter();
  let y = 42;

  // ── Informations générales ──
  y = sectionTitle(doc, "Informations générales", y);
  y = dataTable(doc, [
    ["Date", test.date],
    ["Effectué par", test.testedBy],
    ["Zone testée", test.zoneTeste],
    ["Mode opération", test.modeOperation === "irrigation" ? "Irrigation" : "Lavage"],
    ["Statut", STATUS_FR[test.status] ?? test.status],
    ["Résultats conformes", fr(test.resultatsConformes)],
  ], y);
  y = await insertPhotos(doc, test.preparation.photos, y, addHeaderFooter);

  // ── 1.2.2 Poste de pompage ──
  y = await checkPage(y, 35);
  y = sectionTitle(doc, "1.2.2 — Poste de pompage", y);
  y = dataTable(doc, [["Commentaires", test.poste.commentaires || "—"]], y);
  y = await insertPhotos(doc, test.poste.photos, y, addHeaderFooter);

  // ── 1.2.3 Démarrage ──
  y = await checkPage(y, 35);
  y = sectionTitle(doc, "1.2.3 — Démarrage de la pompe", y);
  y = dataTable(doc, [
    ["Temps de stabilisation", test.demarrage.tempsStabilisation || "—"],
    ["Commentaires", test.demarrage.commentaires || "—"],
  ], y);
  y = await insertPhotos(doc, test.demarrage.photos, y, addHeaderFooter);

  // ── 1.2.4 Filtre en Y ──
  y = await checkPage(y, 50);
  y = sectionTitle(doc, "1.2.4 — Filtre en Y", y);
  y = dataTable(doc, [
    ["Pression amont mesurée", test.filtreY.amontMesuree ? `${test.filtreY.amontMesuree} PSI` : "—"],
    ["Pression amont attendue", test.filtreY.amontAttendue ? `${test.filtreY.amontAttendue} PSI` : "—"],
    ["Pression aval mesurée", test.filtreY.avalMesuree ? `${test.filtreY.avalMesuree} PSI` : "—"],
    ["Pression aval attendue", test.filtreY.avalAttendue ? `${test.filtreY.avalAttendue} PSI` : "—"],
    ["Différentiel de pression", test.filtreY.diffPression ? `${test.filtreY.diffPression} PSI` : "—"],
    ["Nettoyage requis", fr(test.filtreY.nettoyageRequis)],
    ["Nettoyage effectué", test.filtreY.nettoyageEffectue ? "Oui" : "Non"],
    ["Commentaires", test.filtreY.commentaires || "—"],
  ], y);
  y = await insertPhotos(doc, test.filtreY.photos, y, addHeaderFooter);

  // ── 1.2.5 Débitmètre ──
  y = await checkPage(y, 50);
  y = sectionTitle(doc, "1.2.5 — Débitmètre", y);
  y = dataTable(doc, [
    ["Pression aval mesurée", test.debitmetre.avalMesuree ? `${test.debitmetre.avalMesuree} PSI` : "—"],
    ["Pression aval attendue", test.debitmetre.avalAttendue ? `${test.debitmetre.avalAttendue} PSI` : "—"],
    ["Pression PLC mesurée", test.debitmetre.plcPressionMesuree ? `${test.debitmetre.plcPressionMesuree} PSI` : "—"],
    ["Débit PLC mesuré", test.debitmetre.plcDebitMesure ? `${test.debitmetre.plcDebitMesure} m³/h` : "—"],
    ["Débit PLC attendu", test.debitmetre.plcDebitAttendu ? `${test.debitmetre.plcDebitAttendu} m³/h` : "—"],
    ["Valeurs conformes", fr(test.debitmetre.valeursConformes)],
    ["Commentaires", test.debitmetre.commentaires || "—"],
  ], y);
  y = await insertPhotos(doc, test.debitmetre.photos, y, addHeaderFooter);

  // ── 1.2.6 Gicleurs ──
  y = await checkPage(y, 40);
  y = sectionTitle(doc, "1.2.6 — Gicleurs et latéraux", y);
  y = dataTable(doc, [
    ["Gicleurs défectueux", fr(test.gicleurs.gicleursDefectueux)],
    ["Gicleurs remplacés", test.gicleurs.gicleursRemplaces ? "Oui" : "Non"],
    ["Fuites", fr(test.gicleurs.fuites)],
    ["Fuites réparées", test.gicleurs.fuitesReparees ? "Oui" : "Non"],
    ["Commentaires", test.gicleurs.commentaires || "—"],
  ], y);
  y = await insertPhotos(doc, test.gicleurs.photos, y, addHeaderFooter);

  // ── 1.2.7 Conduite de lavage (mode lavage uniquement) ──
  if (test.modeOperation === "lavage") {
    y = await checkPage(y, 35);
    y = sectionTitle(doc, "1.2.7 — Conduite de lavage", y);
    y = dataTable(doc, [
      ["Fuites", fr(test.conduiteLavage.fuites)],
      ["Fuites réparées", test.conduiteLavage.fuitesReparees ? "Oui" : "Non"],
      ["Commentaires", test.conduiteLavage.commentaires || "—"],
    ], y);
    y = await insertPhotos(doc, test.conduiteLavage.photos, y, addHeaderFooter);
  }

  // ── 1.2.8 Finalisation ──
  y = await checkPage(y, 40);
  y = sectionTitle(doc, "1.2.8 — Finalisation", y);
  y = dataTable(doc, [
    ["Arrêt pompe", test.finalisation.arretPompe ? "Oui" : "Non"],
    ["Fermeture vanne irrigation", test.finalisation.fermetureVanneIrrigation ? "Oui" : "Non"],
    ["Fermeture vanne lavage", test.finalisation.fermetureVanneLavage ? "Oui" : "Non"],
    ["Remise en auto", test.finalisation.remiseAuto ? "Oui" : "Non"],
    ["Commentaires", test.finalisation.commentaires || "—"],
  ], y);
  y = await insertPhotos(doc, test.finalisation.photos, y, addHeaderFooter);

  // Mise à jour des pieds de page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, i, totalPages);
  }

  const filename = `Test_Pompage_${test.testNumber}_${test.context.site.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  doc.save(filename);
  return {
    base64: doc.output("datauristring").split(",")[1],
    filename,
  };
}
