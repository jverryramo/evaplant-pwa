// ============================================================
// SuiviWizard — Wizard complet du rapport de suivi terrain
// Navigation dynamique selon la configuration (zones/tensiomètres)
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { Save, CheckCircle, Plus, Trash2 } from "lucide-react";
import Layout from "@/components/Layout";
import { useApp } from "@/contexts/AppContext";
import type { SuiviReport } from "@/lib/types";
import { generateId } from "@/lib/types";
import {
  WizardStep,
  YesNoRadio,
  CheckboxField,
  ValueInput,
  TextAreaField,
  SectionDivider,
  PhotoGallery,
} from "@/components/WizardStep";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { autoAddSuiviToExcel } from "@/lib/excelExport";
import { generateSuiviPDF } from "@/lib/pdfExport";
import { uploadPdfToDrive } from "@/lib/googleDrive";

// Générer les étapes dynamiquement selon la configuration
function buildSteps(nombreZones: number, nombreTensiometres: number) {
  const steps = [
    { id: 1, title: "(1.1.1.3) Poste de pompage", key: "postePompage" },
    { id: 2, title: "(1.1.1.4) Poste de contrôle", key: "posteControle" },
    { id: 3, title: "(1.1.1.5) Interface PLC — Alarmes", key: "plcAlarmes" },
    { id: 4, title: "(1.1.1.6) Interface PLC — Tensiomètres", key: "plcTensiometres" },
    { id: 5, title: "(1.1.1.7) Débitmètre", key: "debitmetre" },
    { id: 6, title: "(1.1.1.8) Pluviomètre", key: "pluviometre" },
  ];

  let nextId = 7;

  // Pages entretien tensiomètres (1 par tensiomètre)
  for (let t = 1; t <= nombreTensiometres; t++) {
    const zone = Math.ceil(t / 2);
    steps.push({
      id: nextId++,
      title: `(1.1.1.9) Entretien Tensiomètre ${t} — Zone ${zone}`,
      key: `entretienTensiometre_${t - 1}`,
    });
  }

  // Pages vannes irrigation (1 par zone)
  for (let z = 1; z <= nombreZones; z++) {
    steps.push({
      id: nextId++,
      title: `(1.1.1.10) Vanne d'irrigation — Zone ${z}`,
      key: `vanneIrrigation_${z - 1}`,
    });
  }

  // Pages vannes lavage (1 par zone)
  for (let z = 1; z <= nombreZones; z++) {
    steps.push({
      id: nextId++,
      title: `(1.1.1.11) Vanne de lavage — Zone ${z}`,
      key: `vanneLavage_${z - 1}`,
    });
  }

  // Pages finales
  steps.push(
    { id: nextId++, title: "(1.1.1.12) Santé générale des saules", key: "santeSaules" },
    { id: nextId++, title: "(1.1.1.13) Inspection pourtour plantation", key: "inspectionPourtour" },
    { id: nextId++, title: "(1.1.1.14) Autres entretiens", key: "autresEntretiens" },
    { id: nextId++, title: "(1.1.1.15) Photos rapports mensuels", key: "photosMensuelles" },
    { id: nextId++, title: "(1.1.1.16) Présence — Employés Ramo", key: "presenceRamo" },
    { id: nextId++, title: "(1.1.1.17) Présence — Autres intervenants", key: "presenceAutres" },
    { id: nextId++, title: "(1.1.1.18) Finalisation", key: "finalisation" }
  );

  return steps;
}

export default function SuiviWizard() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { suiviReports, saveSuivi } = useApp();

  const [report, setReport] = useState<SuiviReport | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [steps, setSteps] = useState<{ id: number; title: string; key: string }[]>([]);
  const [showFinalDialog, setShowFinalDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  // Étape 0 : écran de configuration modifiable
  const [showConfig, setShowConfig] = useState(false);
  const [configZones, setConfigZones] = useState(4);
  const [configDate, setConfigDate] = useState("");
  const [configCreatedBy, setConfigCreatedBy] = useState("");

  useEffect(() => {
    const found = suiviReports.find((r) => r.id === params.id);
    if (found) {
      setReport(found);
      setSteps(buildSteps(found.config.nombreZones, found.config.nombreTensiometres));
      setConfigZones(found.config.nombreZones);
      setConfigDate(found.config.date);
      setConfigCreatedBy(found.config.createdBy);
    }
  }, [params.id, suiviReports]);

  const update = useCallback((updater: (r: SuiviReport) => SuiviReport) => {
    setReport((prev) => (prev ? updater(prev) : prev));
  }, []);

  const handleSave = async (status?: SuiviReport["status"]) => {
    if (!report) return;
    setSaving(true);
    try {
      const toSave = status ? { ...report, status } : report;
      await saveSuivi(toSave);
      toast.success("Rapport sauvegardé");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!report) return;
    setSaving(true);
    try {
      const finalized = { ...report, status: "completed" as const };
      await saveSuivi(finalized);

      // 1. Synchronisation Google Sheets
      const { sheetsOk, sheetsError } = await autoAddSuiviToExcel(finalized);
      if (sheetsOk) {
        toast.success("✓ Rapport finalisé et synchronisé dans Google Sheets", { duration: 5000 });
      } else {
        toast.warning(
          `Rapport finalisé localement — synchro Sheets échouée : ${sheetsError ?? "erreur inconnue"}`,
          { duration: 6000 }
        );
      }

      // 2. Génération PDF + upload automatique vers Google Drive
      try {
        const pdfResult = await generateSuiviPDF(finalized);
        const siteName = finalized.context?.site ?? "Autres";
        const driveResult = await uploadPdfToDrive(pdfResult.base64, pdfResult.filename, siteName);
        if (driveResult.success) {
          toast.success(`☁️ PDF sauvegardé dans Google Drive (${driveResult.folderName})`, { duration: 5000 });
        } else {
          console.warn("[SuiviWizard] Upload Drive échoué:", driveResult.error);
        }
      } catch (pdfErr) {
        console.warn("[SuiviWizard] Erreur PDF/Drive:", pdfErr);
        // Non bloquant
      }

      navigate("/suivi");
    } catch (err) {
      console.error("[SuiviWizard] Erreur finalisation:", err);
      toast.error("Erreur lors de la finalisation");
    } finally {
      setSaving(false);
      setShowFinalDialog(false);
    }
  };

  if (!report) {
    return (
      <Layout title="Rapport de suivi" showBack onBack={() => navigate("/suivi")}>
        <div className="flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Chargement...</p>
        </div>
      </Layout>
    );
  }

  const isLocked = report.locked;
  const totalSteps = steps.length;
  const isFirst = currentStep === 1;
  const isLast = currentStep === totalSteps;
  const currentStepData = steps[currentStep - 1];

  // Sauvegarder la configuration modifiée et regénérer les étapes
  const handleSaveConfig = async () => {
    if (!report) return;
    const newTensiometres = configZones * 2;
    const updatedReport: SuiviReport = {
      ...report,
      config: {
        ...report.config,
        nombreZones: configZones,
        nombreTensiometres: newTensiometres,
        date: configDate,
        createdBy: configCreatedBy,
      },
    };
    setReport(updatedReport);
    setSteps(buildSteps(configZones, newTensiometres));
    await saveSuivi(updatedReport);
    setShowConfig(false);
    setCurrentStep(1);
    toast.success("Configuration mise à jour");
  };

  // Écran de configuration modifiable (accessible via Précédent depuis l'étape 1)
  if (showConfig && !isLocked) {
    return (
      <Layout title={`Rapport #${report.reportNumber}`} showBack onBack={() => setShowConfig(false)} hideNav>
        <div className="px-4 pt-6 pb-6 space-y-4">
          <div className="rounded-xl p-4" style={{ background: "#003D39" }}>
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#DCF21E" }}>
              Modifier la configuration
            </div>
            <div className="text-sm" style={{ color: "#F5F0EA" }}>
              Modifiez les paramètres du rapport. Les étapes seront régénérées automatiquement.
            </div>
          </div>

          {/* Date */}
          <div className="terrain-card p-4">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A7049" }}>
              Date des travaux
            </label>
            <input
              type="date"
              value={configDate}
              onChange={(e) => setConfigDate(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none"
              style={{ borderColor: "#DDCCBF" }}
            />
          </div>

          {/* Créé par */}
          <div className="terrain-card p-4">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A7049" }}>
              Rapport créé par
            </label>
            <input
              type="text"
              value={configCreatedBy}
              onChange={(e) => setConfigCreatedBy(e.target.value)}
              placeholder="Nom de l'intervenant..."
              className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none"
              style={{ borderColor: "#DDCCBF" }}
            />
          </div>

          {/* Nombre de zones */}
          <div className="terrain-card p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="font-semibold text-sm text-gray-900">(1.1.1.1) Nombre de zones</div>
                <div className="text-xs text-gray-500 mt-0.5">Génère 1 page vanne irrigation + 1 page vanne lavage par zone</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setConfigZones((z) => Math.max(1, z - 1))}
                  disabled={configZones <= 1}
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all active:scale-90 disabled:opacity-30"
                  style={{ background: "#DDCCBF", color: "#003D39" }}
                >
                  −
                </button>
                <span className="w-10 text-center font-bold text-xl" style={{ color: "#003D39" }}>{configZones}</span>
                <button
                  onClick={() => setConfigZones((z) => Math.min(20, z + 1))}
                  disabled={configZones >= 20}
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all active:scale-90 disabled:opacity-30"
                  style={{ background: "#003D39", color: "#DCF21E" }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Tensiomètres (calculé) */}
          <div className="terrain-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-gray-900">(1.1.1.2) Nombre de tensiomètres</div>
                <div className="text-xs text-gray-500 mt-0.5">Calculé automatiquement (2 par zone)</div>
              </div>
              <div className="w-16 h-10 rounded-xl flex items-center justify-center font-bold text-xl" style={{ background: "#F5F0EA", color: "#003D39", border: "2px solid #DDCCBF" }}>
                {configZones * 2}
              </div>
            </div>
          </div>

          <div
            className="rounded-xl p-3 text-xs"
            style={{ background: "#FFF8E1", border: "1px solid #DCF21E", color: "#5a3e28" }}
          >
            ⚠️ Modifier le nombre de zones régénère les étapes du rapport. Les données déjà saisies dans les sections de vannes et tensiomètres seront réinitialisées si le nombre de zones change.
          </div>

          <button
            onClick={handleSaveConfig}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-4 font-semibold text-sm transition-all active:scale-95"
            style={{ background: "#003D39", color: "#DCF21E" }}
          >
            Appliquer les modifications
          </button>
        </div>
      </Layout>
    );
  }

  const renderStepContent = () => {
    if (!currentStepData) return null;
    const key = currentStepData.key;

    // ── Poste de pompage ──
    if (key === "postePompage") {
      return (
        <div className="space-y-4">
          <CheckboxField
            label="Inspection visuelle du poste de pompage ✓"
            checked={report.postePompage.inspectionVisuelle}
            onChange={(v) => update((r) => ({ ...r, postePompage: { ...r.postePompage, inspectionVisuelle: v } }))}
            disabled={isLocked}
          />
          <YesNoRadio
            label="Alarmes à l'interface de la VFD ?"
            value={report.postePompage.alarmesVFD}
            onChange={(v) => update((r) => ({ ...r, postePompage: { ...r.postePompage, alarmesVFD: v } }))}
            disabled={isLocked}
          />
          {report.postePompage.alarmesVFD === "oui" && (
            <TextAreaField
              label="Description des alarmes"
              value={report.postePompage.descriptionAlarmes}
              onChange={(v) => update((r) => ({ ...r, postePompage: { ...r.postePompage, descriptionAlarmes: v } }))}
              disabled={isLocked}
            />
          )}
          <YesNoRadio
            label="Alarmes acquittées ?"
            value={report.postePompage.alarmesAcquittees}
            onChange={(v) => update((r) => ({ ...r, postePompage: { ...r.postePompage, alarmesAcquittees: v } }))}
            disabled={isLocked}
            showNA={true}
          />
          <TextAreaField
            label="Commentaires"
            value={report.postePompage.commentaires}
            onChange={(v) => update((r) => ({ ...r, postePompage: { ...r.postePompage, commentaires: v } }))}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={report.postePompage.photos}
            onChange={(photos) => update((r) => ({ ...r, postePompage: { ...r.postePompage, photos } }))}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Poste de contrôle ──
    if (key === "posteControle") {
      return (
        <div className="space-y-4">
          <CheckboxField
            label="Inspection visuelle du poste de contrôle ✓"
            checked={report.posteControle.inspectionVisuelle}
            onChange={(v) => update((r) => ({ ...r, posteControle: { ...r.posteControle, inspectionVisuelle: v } }))}
            disabled={isLocked}
          />
          <TextAreaField
            label="État physique des équipements, sécurité, propreté"
            value={report.posteControle.etatEquipements}
            onChange={(v) => update((r) => ({ ...r, posteControle: { ...r.posteControle, etatEquipements: v } }))}
            disabled={isLocked}
          />
          <YesNoRadio
            label="Présence de fuites ?"
            value={report.posteControle.presenceFuites}
            onChange={(v) => update((r) => ({ ...r, posteControle: { ...r.posteControle, presenceFuites: v } }))}
            disabled={isLocked}
          />
          <TextAreaField
            label="Commentaires"
            value={report.posteControle.commentaires}
            onChange={(v) => update((r) => ({ ...r, posteControle: { ...r.posteControle, commentaires: v } }))}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={report.posteControle.photos}
            onChange={(photos) => update((r) => ({ ...r, posteControle: { ...r.posteControle, photos } }))}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Interface PLC Alarmes ──
    if (key === "plcAlarmes") {
      return (
        <div className="space-y-4">
          <YesNoRadio
            label="Alarmes à l'interface du PLC ?"
            value={report.plcAlarmes.alarmesPresentes}
            onChange={(v) => update((r) => ({ ...r, plcAlarmes: { ...r.plcAlarmes, alarmesPresentes: v } }))}
            disabled={isLocked}
          />
          {report.plcAlarmes.alarmesPresentes === "oui" && (
            <TextAreaField
              label="Description des alarmes"
              value={report.plcAlarmes.descriptionAlarmes}
              onChange={(v) => update((r) => ({ ...r, plcAlarmes: { ...r.plcAlarmes, descriptionAlarmes: v } }))}
              disabled={isLocked}
            />
          )}
          <YesNoRadio
            label="Alarmes acquittées ?"
            value={report.plcAlarmes.alarmesAcquittees}
            onChange={(v) => update((r) => ({ ...r, plcAlarmes: { ...r.plcAlarmes, alarmesAcquittees: v } }))}
            disabled={isLocked}
            showNA={true}
          />
          <TextAreaField
            label="Commentaires"
            value={report.plcAlarmes.commentaires}
            onChange={(v) => update((r) => ({ ...r, plcAlarmes: { ...r.plcAlarmes, commentaires: v } }))}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={report.plcAlarmes.photos}
            onChange={(photos) => update((r) => ({ ...r, plcAlarmes: { ...r.plcAlarmes, photos } }))}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Interface PLC Tensiomètres ──
    if (key === "plcTensiometres") {
      return (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Saisissez les lectures de tension au PLC pour chaque tensiomètre.
          </p>
          <div className="space-y-3">
            {report.plcTensiometres.lectures.map((lecture, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "#F5F0EA", border: "1px solid #DDCCBF" }}
              >
                <div className="flex-1 text-sm font-medium text-gray-700">
                  Zone {lecture.zone} — Tensiomètre {lecture.tensiometre}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={lecture.valeur}
                    onChange={(e) => {
                      const newLectures = [...report.plcTensiometres.lectures];
                      newLectures[idx] = { ...lecture, valeur: e.target.value };
                      update((r) => ({ ...r, plcTensiometres: { ...r.plcTensiometres, lectures: newLectures } }));
                    }}
                    placeholder="—"
                    disabled={isLocked}
                    className="w-20 rounded-lg px-2 py-1.5 text-sm text-center border focus:outline-none disabled:opacity-50"
                    style={{ borderColor: "#DDCCBF" }}
                  />
                  <span className="text-xs font-semibold" style={{ color: "#8A7049" }}>kPa</span>
                </div>
              </div>
            ))}
          </div>
          <TextAreaField
            label="Commentaires"
            value={report.plcTensiometres.commentaires}
            onChange={(v) => update((r) => ({ ...r, plcTensiometres: { ...r.plcTensiometres, commentaires: v } }))}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={report.plcTensiometres.photos}
            onChange={(photos) => update((r) => ({ ...r, plcTensiometres: { ...r.plcTensiometres, photos } }))}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Débitmètre ──
    if (key === "debitmetre") {
      return (
        <div className="space-y-4">
          <YesNoRadio
            label="Messages d'erreur à l'interface du débitmètre ?"
            value={report.debitmetre.messagesErreur}
            onChange={(v) => update((r) => ({ ...r, debitmetre: { ...r.debitmetre, messagesErreur: v } }))}
            disabled={isLocked}
          />
          <ValueInput
            label="Volume cumulatif actuel"
            value={report.debitmetre.volumeCumulActuel}
            onChange={(v) => update((r) => ({ ...r, debitmetre: { ...r.debitmetre, volumeCumulActuel: v } }))}
            unit="m³"
            type="number"
            disabled={isLocked}
          />
          <TextAreaField
            label="Commentaires"
            value={report.debitmetre.commentaires}
            onChange={(v) => update((r) => ({ ...r, debitmetre: { ...r.debitmetre, commentaires: v } }))}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={report.debitmetre.photos}
            onChange={(photos) => update((r) => ({ ...r, debitmetre: { ...r.debitmetre, photos } }))}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Pluviomètre ──
    if (key === "pluviometre") {
      return (
        <div className="space-y-4">
          <CheckboxField
            label="Inspection visuelle du pluviomètre ✓"
            checked={report.pluviometre.inspectionVisuelle}
            onChange={(v) => update((r) => ({ ...r, pluviometre: { ...r.pluviometre, inspectionVisuelle: v } }))}
            disabled={isLocked}
          />
          <YesNoRadio
            label="Nettoyage du pluviomètre requis ?"
            value={report.pluviometre.nettoyageRequis}
            onChange={(v) => update((r) => ({ ...r, pluviometre: { ...r.pluviometre, nettoyageRequis: v } }))}
            disabled={isLocked}
          />
          {report.pluviometre.nettoyageRequis === "oui" && (
            <CheckboxField
              label="Nettoyage du pluviomètre effectué ✓"
              checked={report.pluviometre.nettoyageEffectue}
              onChange={(v) => update((r) => ({ ...r, pluviometre: { ...r.pluviometre, nettoyageEffectue: v } }))}
              disabled={isLocked}
            />
          )}
          <TextAreaField
            label="Commentaires"
            value={report.pluviometre.commentaires}
            onChange={(v) => update((r) => ({ ...r, pluviometre: { ...r.pluviometre, commentaires: v } }))}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={report.pluviometre.photos}
            onChange={(photos) => update((r) => ({ ...r, pluviometre: { ...r.pluviometre, photos } }))}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Entretien Tensiomètre (dynamique) ──
    if (key.startsWith("entretienTensiometre_")) {
      const idx = parseInt(key.split("_")[1]);
      const t = report.entretiensTensiometres[idx];
      if (!t) return null;
      return (
        <div className="space-y-4">
          <div
            className="px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "#F5F0EA", color: "#003D39" }}
          >
            Zone {t.zoneNum} — Tensiomètre {t.tensiometreNum}
          </div>
          <CheckboxField
            label="Inspection visuelle du tensiomètre ✓"
            checked={t.inspectionVisuelle}
            onChange={(v) => {
              const arr = [...report.entretiensTensiometres];
              arr[idx] = { ...t, inspectionVisuelle: v };
              update((r) => ({ ...r, entretiensTensiometres: arr }));
            }}
            disabled={isLocked}
          />
          <ValueInput
            label="Tension au manomètre"
            value={t.tensionManometre}
            onChange={(v) => {
              const arr = [...report.entretiensTensiometres];
              arr[idx] = { ...t, tensionManometre: v };
              update((r) => ({ ...r, entretiensTensiometres: arr }));
            }}
            unit="kPa"
            type="number"
            disabled={isLocked}
          />
          {/* Tension au PLC — valeur automatique depuis section 1.1.1.6 */}
          {(() => {
            const plcLecture = report.plcTensiometres.lectures.find(
              (l) => l.tensiometre === t.tensiometreNum
            );
            const plcVal = plcLecture?.valeur ?? "";
            return (
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-700">
                  Tension au PLC
                  <span className="ml-2 text-xs font-normal" style={{ color: "#8A7049" }}>
                    (rempli automatiquement depuis 1.1.1.6)
                  </span>
                </div>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "#F5F0EA", border: "1px solid #DDCCBF" }}
                >
                  <span className="flex-1 text-sm font-semibold" style={{ color: "#003D39" }}>
                    {plcVal !== "" ? plcVal : <span className="text-gray-400 font-normal">— (non saisi en 1.1.1.6)</span>}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "#8A7049" }}>kPa</span>
                </div>
              </div>
            );
          })()}
          <YesNoRadio
            label="Ajout d'algicide requis ?"
            value={t.algicideRequis}
            onChange={(v) => {
              const arr = [...report.entretiensTensiometres];
              arr[idx] = { ...t, algicideRequis: v };
              update((r) => ({ ...r, entretiensTensiometres: arr }));
            }}
            disabled={isLocked}
          />
          {t.algicideRequis === "oui" && (
            <CheckboxField
              label="Ajout d'algicide effectué ✓"
              checked={t.algicideEffectue}
              onChange={(v) => {
                const arr = [...report.entretiensTensiometres];
                arr[idx] = { ...t, algicideEffectue: v };
                update((r) => ({ ...r, entretiensTensiometres: arr }));
              }}
              disabled={isLocked}
            />
          )}
          <CheckboxField
            label="Pompage du tensiomètre ✓"
            checked={t.pompage}
            onChange={(v) => {
              const arr = [...report.entretiensTensiometres];
              arr[idx] = { ...t, pompage: v };
              update((r) => ({ ...r, entretiensTensiometres: arr }));
            }}
            disabled={isLocked}
          />
          <YesNoRadio
            label="Présence de bulles lors du pompage ?"
            value={t.presenceBulles}
            onChange={(v) => {
              const arr = [...report.entretiensTensiometres];
              arr[idx] = { ...t, presenceBulles: v };
              update((r) => ({ ...r, entretiensTensiometres: arr }));
            }}
            disabled={isLocked}
          />
          <TextAreaField
            label="Commentaires"
            value={t.commentaires}
            onChange={(v) => {
              const arr = [...report.entretiensTensiometres];
              arr[idx] = { ...t, commentaires: v };
              update((r) => ({ ...r, entretiensTensiometres: arr }));
            }}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={t.photos}
            onChange={(photos) => {
              const arr = [...report.entretiensTensiometres];
              arr[idx] = { ...t, photos };
              update((r) => ({ ...r, entretiensTensiometres: arr }));
            }}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Vanne d'irrigation (dynamique) ──
    if (key.startsWith("vanneIrrigation_")) {
      const idx = parseInt(key.split("_")[1]);
      const v = report.vannesIrrigation[idx];
      if (!v) return null;
      return (
        <div className="space-y-4">
          <div
            className="px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "#F5F0EA", color: "#003D39" }}
          >
            Zone {v.zoneNum}
          </div>
          <CheckboxField
            label="Ouverture et fermeture en mode manuel de la vanne ✓"
            checked={v.ouvertureFermetureManuelle}
            onChange={(val) => {
              const arr = [...report.vannesIrrigation];
              arr[idx] = { ...v, ouvertureFermetureManuelle: val };
              update((r) => ({ ...r, vannesIrrigation: arr }));
            }}
            disabled={isLocked}
          />
          <CheckboxField
            label="Inspection de la vanne lors de son opération ✓"
            checked={v.inspectionOperation}
            onChange={(val) => {
              const arr = [...report.vannesIrrigation];
              arr[idx] = { ...v, inspectionOperation: val };
              update((r) => ({ ...r, vannesIrrigation: arr }));
            }}
            disabled={isLocked}
          />
          <YesNoRadio
            label="La vanne fonctionne bien ?"
            value={v.fonctionne}
            onChange={(val) => {
              const arr = [...report.vannesIrrigation];
              arr[idx] = { ...v, fonctionne: val };
              update((r) => ({ ...r, vannesIrrigation: arr }));
            }}
            disabled={isLocked}
          />
          <TextAreaField
            label="Commentaires"
            value={v.commentaires}
            onChange={(val) => {
              const arr = [...report.vannesIrrigation];
              arr[idx] = { ...v, commentaires: val };
              update((r) => ({ ...r, vannesIrrigation: arr }));
            }}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={v.photos}
            onChange={(photos) => {
              const arr = [...report.vannesIrrigation];
              arr[idx] = { ...v, photos };
              update((r) => ({ ...r, vannesIrrigation: arr }));
            }}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Vanne de lavage (dynamique) ──
    if (key.startsWith("vanneLavage_")) {
      const idx = parseInt(key.split("_")[1]);
      const v = report.vannesLavage[idx];
      if (!v) return null;
      return (
        <div className="space-y-4">
          <div
            className="px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "#F5F0EA", color: "#003D39" }}
          >
            Zone {v.zoneNum}
          </div>
          <CheckboxField
            label="Ouverture et fermeture en mode manuel de la vanne ✓"
            checked={v.ouvertureFermetureManuelle}
            onChange={(val) => {
              const arr = [...report.vannesLavage];
              arr[idx] = { ...v, ouvertureFermetureManuelle: val };
              update((r) => ({ ...r, vannesLavage: arr }));
            }}
            disabled={isLocked}
          />
          <CheckboxField
            label="Inspection de la vanne lors de son opération ✓"
            checked={v.inspectionOperation}
            onChange={(val) => {
              const arr = [...report.vannesLavage];
              arr[idx] = { ...v, inspectionOperation: val };
              update((r) => ({ ...r, vannesLavage: arr }));
            }}
            disabled={isLocked}
          />
          <YesNoRadio
            label="La vanne fonctionne bien ?"
            value={v.fonctionne}
            onChange={(val) => {
              const arr = [...report.vannesLavage];
              arr[idx] = { ...v, fonctionne: val };
              update((r) => ({ ...r, vannesLavage: arr }));
            }}
            disabled={isLocked}
          />
          <TextAreaField
            label="Commentaires"
            value={v.commentaires}
            onChange={(val) => {
              const arr = [...report.vannesLavage];
              arr[idx] = { ...v, commentaires: val };
              update((r) => ({ ...r, vannesLavage: arr }));
            }}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={v.photos}
            onChange={(photos) => {
              const arr = [...report.vannesLavage];
              arr[idx] = { ...v, photos };
              update((r) => ({ ...r, vannesLavage: arr }));
            }}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Santé générale des saules ──
    if (key === "santeSaules") {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">Score de santé des saules (1 à 3)</div>
            <div className="space-y-2">
              {([
                { score: 1 as const, label: "1 — Mauvaise santé", color: "#ef4444" },
                { score: 2 as const, label: "2 — Santé moyenne", color: "#f59e0b" },
                { score: 3 as const, label: "3 — Bonne santé", color: "#003D39" },
              ]).map(({ score, label, color }) => (
                <button
                  key={score}
                  type="button"
                  disabled={isLocked}
                  onClick={() => update((r) => ({ ...r, santeSaules: { ...r.santeSaules, score } }))}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    background: report.santeSaules.score === score ? color : "#F5F0EA",
                    color: report.santeSaules.score === score ? "white" : "#374151",
                    border: `2px solid ${report.santeSaules.score === score ? color : "#DDCCBF"}`,
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                    style={{
                      borderColor: report.santeSaules.score === score ? "white" : "#DDCCBF",
                    }}
                  >
                    {report.santeSaules.score === score && (
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    )}
                  </div>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <TextAreaField
            label="Commentaires"
            value={report.santeSaules.commentaires}
            onChange={(v) => update((r) => ({ ...r, santeSaules: { ...r.santeSaules, commentaires: v } }))}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={report.santeSaules.photos}
            onChange={(photos) => update((r) => ({ ...r, santeSaules: { ...r.santeSaules, photos } }))}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Inspection pourtour plantation ──
    if (key === "inspectionPourtour") {
      return (
        <div className="space-y-4">
          <YesNoRadio
            label="Présence de ruissellement sur le pourtour de la plantation ?"
            value={report.inspectionPourtour.ruissellement}
            onChange={(v) => update((r) => ({ ...r, inspectionPourtour: { ...r.inspectionPourtour, ruissellement: v } }))}
            disabled={isLocked}
          />
          <TextAreaField
            label="Commentaires"
            value={report.inspectionPourtour.commentaires}
            onChange={(v) => update((r) => ({ ...r, inspectionPourtour: { ...r.inspectionPourtour, commentaires: v } }))}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={report.inspectionPourtour.photos}
            onChange={(photos) => update((r) => ({ ...r, inspectionPourtour: { ...r.inspectionPourtour, photos } }))}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Autres entretiens ──
    if (key === "autresEntretiens") {
      return (
        <div className="space-y-4">
          <TextAreaField
            label="Commentaires / Description des autres entretiens effectués"
            value={report.autresEntretiens.commentaires}
            onChange={(v) => update((r) => ({ ...r, autresEntretiens: { ...r.autresEntretiens, commentaires: v } }))}
            disabled={isLocked}
            rows={5}
          />
          <PhotoGallery
            photos={report.autresEntretiens.photos}
            onChange={(photos) => update((r) => ({ ...r, autresEntretiens: { ...r.autresEntretiens, photos } }))}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Photos rapports mensuels ──
    if (key === "photosMensuelles") {
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Ajoutez les photos esthétiques pour les rapports mensuels.
          </p>
          <PhotoGallery
            photos={report.photosMensuelles.photos}
            onChange={(photos) => update((r) => ({ ...r, photosMensuelles: { photos } }))}
            disabled={isLocked}
            label="Photos rapports mensuels"
          />
        </div>
      );
    }

    // ── Présence Ramo ──
    if (key === "presenceRamo") {
      return (
        <PresenceSection
          title="Employés de Ramo"
          entries={report.presenceRamo.employes}
          onChange={(employes) => update((r) => ({ ...r, presenceRamo: { ...r.presenceRamo, employes } }))}
          commentaires={report.presenceRamo.commentaires}
          onCommentairesChange={(v) => update((r) => ({ ...r, presenceRamo: { ...r.presenceRamo, commentaires: v } }))}
          photos={report.presenceRamo.photos}
          onPhotosChange={(photos) => update((r) => ({ ...r, presenceRamo: { ...r.presenceRamo, photos } }))}
          disabled={isLocked}
        />
      );
    }

    // ── Présence Autres ──
    if (key === "presenceAutres") {
      return (
        <PresenceSection
          title="Autres intervenants"
          entries={report.presenceAutres.intervenants}
          onChange={(intervenants) => update((r) => ({ ...r, presenceAutres: { ...r.presenceAutres, intervenants } }))}
          commentaires={report.presenceAutres.commentaires}
          onCommentairesChange={(v) => update((r) => ({ ...r, presenceAutres: { ...r.presenceAutres, commentaires: v } }))}
          photos={report.presenceAutres.photos}
          onPhotosChange={(photos) => update((r) => ({ ...r, presenceAutres: { ...r.presenceAutres, photos } }))}
          disabled={isLocked}
        />
      );
    }

    // ── Finalisation ──
    if (key === "finalisation") {
      return (
        <div className="space-y-4">
          <div
            className="rounded-xl p-4"
            style={{ background: "#F5F0EA", border: "1px solid #DDCCBF" }}
          >
            <div className="text-sm font-semibold text-gray-900 mb-3">Résumé du rapport</div>
            <div className="space-y-1.5 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Rapport</span>
                <span className="font-semibold">#{report.reportNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date</span>
                <span className="font-semibold">{report.config.date}</span>
              </div>
              <div className="flex justify-between">
                <span>Créé par</span>
                <span className="font-semibold">{report.config.createdBy}</span>
              </div>
              <div className="flex justify-between">
                <span>Client</span>
                <span className="font-semibold">{report.context.client}</span>
              </div>
              <div className="flex justify-between">
                <span>Site</span>
                <span className="font-semibold">{report.context.site}</span>
              </div>
              <div className="flex justify-between">
                <span>Zones</span>
                <span className="font-semibold">{report.config.nombreZones}</span>
              </div>
            </div>
          </div>

          {/* Sauvegarder au-dessus, Finaliser en bas via navigation */}
          <button
            onClick={() => handleSave("in_progress")}
            disabled={saving || isLocked}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
            style={{ background: "#8A7049", color: "white" }}
          >
            <Save size={16} />
            Sauvegarder comme rapport en cours
          </button>
        </div>
      );
    }

    return <div className="text-gray-400 text-sm">Section en cours de développement</div>;
  };

  return (
    <Layout
      title={`Rapport #${report.reportNumber}`}
      showBack
      onBack={() => {
        handleSave();
        navigate("/suivi");
      }}
      hideNav
      headerRight={
        !isLocked ? (
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "rgba(220,242,30,0.15)", color: "#DCF21E" }}
          >
            <Save size={13} />
            {saving ? "..." : "Sauvegarder"}
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col h-full" style={{ minHeight: "calc(100vh - 112px)" }}>
        {steps.length > 0 && currentStepData && (
          <WizardStep
            steps={steps}
            currentStep={currentStep}
            onStepChange={setCurrentStep}
            onPrevious={() => {
              if (currentStep === 1 && !isLocked) {
                setShowConfig(true);
              } else {
                setCurrentStep((s) => Math.max(1, s - 1));
              }
            }}
            onNext={() => {
              if (isLast) {
                setShowFinalDialog(true);
              } else {
                handleSave();
                setCurrentStep((s) => Math.min(totalSteps, s + 1));
              }
            }}
            isFirst={isFirst}
            isLast={isLast}
            onFinalize={() => {
              handleSave();
              setCurrentStep(totalSteps);
            }}
            title={currentStepData.title.split(") ").slice(1).join(") ")}
            sectionNumber={currentStepData.title.split(")")[0] + ")"}
            locked={isLocked}
            showConfigOnFirst={true}
          >
            {renderStepContent()}
          </WizardStep>
        )}
      </div>

      {/* Dialog finalisation avec récapitulatif */}
      <AlertDialog open={showFinalDialog} onOpenChange={setShowFinalDialog}>
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Récapitulatif avant finalisation</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3 text-sm">Rapport #{report.reportNumber} — vérifiez les sections avant de finaliser.</p>
                <div className="space-y-1.5">
                  {steps.slice(0, -1).map((step) => {
                    const key = step.key;
                    let isComplete = false;
                    // Règle : cochée uniquement si tous les champs obligatoires sont remplis
                    // Exceptions : commentaires et photos (non obligatoires)
                    if (key === "postePompage") {
                      isComplete = report.postePompage.inspectionVisuelle && !!report.postePompage.alarmesVFD;
                    } else if (key === "posteControle") {
                      isComplete = report.posteControle.inspectionVisuelle && !!report.posteControle.presenceFuites;
                    } else if (key === "plcAlarmes") {
                      isComplete = !!report.plcAlarmes.alarmesPresentes;
                    } else if (key === "plcTensiometres") {
                      // Toutes les lectures doivent avoir une valeur
                      isComplete = report.plcTensiometres.lectures.length > 0 &&
                        report.plcTensiometres.lectures.every((l) => !!l.valeur);
                    } else if (key === "debitmetre") {
                      isComplete = !!report.debitmetre.messagesErreur && !!report.debitmetre.volumeCumulActuel;
                    } else if (key === "pluviometre") {
                      isComplete = report.pluviometre.inspectionVisuelle && !!report.pluviometre.nettoyageRequis;
                    } else if (key.startsWith("entretienTensiometre_")) {
                      const idx = parseInt(key.split("_")[1]);
                      const t = report.entretiensTensiometres?.[idx];
                      isComplete = !!t && !!t.tensionManometre && !!t.algicideRequis && !!t.presenceBulles;
                    } else if (key.startsWith("vanneIrrigation_")) {
                      const idx = parseInt(key.split("_")[1]);
                      const v = report.vannesIrrigation?.[idx];
                      isComplete = !!v && !!v.fonctionne;
                    } else if (key.startsWith("vanneLavage_")) {
                      const idx = parseInt(key.split("_")[1]);
                      const v = report.vannesLavage?.[idx];
                      isComplete = !!v && !!v.fonctionne;
                    } else if (key === "santeSaules") {
                      isComplete = report.santeSaules?.score !== null && report.santeSaules?.score !== undefined;
                    } else if (key === "inspectionPourtour") {
                      isComplete = !!report.inspectionPourtour?.ruissellement;
                    } else if (key === "autresEntretiens") {
                      // Optionnel — toujours considéré comme non-obligatoire
                      isComplete = false;
                    } else if (key === "photosMensuelles") {
                      // Optionnel — coché si au moins une photo ajoutée
                      isComplete = (report.photosMensuelles?.photos?.length ?? 0) > 0;
                    } else if (key === "presenceRamo") {
                      isComplete = (report.presenceRamo?.employes?.length ?? 0) > 0;
                    } else if (key === "presenceAutres") {
                      // Optionnel — coché si au moins un intervenant ajouté
                      isComplete = (report.presenceAutres?.intervenants?.length ?? 0) > 0;
                    }
                    return (
                      <div key={step.id} className="flex items-center gap-2 text-xs py-1 border-b border-gray-100">
                        <span className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                          isComplete ? "bg-[#003D39] text-[#DCF21E]" : "bg-[#DDCCBF] text-[#8A7049]"
                        }`}>
                          {isComplete ? "✓" : "!"}
                        </span>
                        <span className={isComplete ? "text-gray-700" : "text-[#8A7049] font-medium"}>
                          {step.title.split(") ").slice(1).join(") ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour au rapport</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinalize}
              style={{ background: "#003D39", color: "#DCF21E" }}
            >
              Confirmer et publier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

// ── Composant Présence au site ──
function PresenceSection({
  title,
  entries,
  onChange,
  commentaires,
  onCommentairesChange,
  photos,
  onPhotosChange,
  disabled,
}: {
  title: string;
  entries: import("@/lib/types").PersonEntry[];
  onChange: (entries: import("@/lib/types").PersonEntry[]) => void;
  commentaires: string;
  onCommentairesChange: (v: string) => void;
  photos: import("@/lib/types").AnnotatedPhoto[];
  onPhotosChange: (photos: import("@/lib/types").AnnotatedPhoto[]) => void;
  disabled?: boolean;
}) {
  const addEntry = () => {
    onChange([
      ...entries,
      { id: generateId(), name: "", titleRole: "", heureArrivee: "", heureDepart: "" },
    ]);
  };

  const updateEntry = (id: string, field: string, value: string) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const removeEntry = (id: string) => {
    onChange(entries.filter((e) => e.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {entries.map((entry, i) => (
          <div
            key={entry.id}
            className="rounded-xl p-3 space-y-2"
            style={{ background: "#F5F0EA", border: "1px solid #DDCCBF" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: "#8A7049" }}>
                Intervenant {i + 1}
              </span>
              {!disabled && (
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="p-1 rounded"
                >
                  <Trash2 size={13} color="#ef4444" />
                </button>
              )}
            </div>
            <input
              type="text"
              value={entry.name}
              onChange={(e) => updateEntry(entry.id, "name", e.target.value)}
              placeholder="Nom..."
              disabled={disabled}
              className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none disabled:opacity-50"
              style={{ borderColor: "#DDCCBF" }}
            />
            <input
              type="text"
              value={entry.titleRole}
              onChange={(e) => updateEntry(entry.id, "titleRole", e.target.value)}
              placeholder="Titre / Rôle..."
              disabled={disabled}
              className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none disabled:opacity-50"
              style={{ borderColor: "#DDCCBF" }}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Heure arrivée</label>
                <input
                  type="time"
                  value={entry.heureArrivee}
                  onChange={(e) => updateEntry(entry.id, "heureArrivee", e.target.value)}
                  disabled={disabled}
                  className="w-full rounded-lg px-2 py-2 text-sm border focus:outline-none disabled:opacity-50"
                  style={{ borderColor: "#DDCCBF" }}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Heure départ</label>
                <input
                  type="time"
                  value={entry.heureDepart}
                  onChange={(e) => updateEntry(entry.id, "heureDepart", e.target.value)}
                  disabled={disabled}
                  className="w-full rounded-lg px-2 py-2 text-sm border focus:outline-none disabled:opacity-50"
                  style={{ borderColor: "#DDCCBF" }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {!disabled && (
        <button
          onClick={addEntry}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: "#F5F0EA", color: "#003D39", border: "2px dashed #DDCCBF" }}
        >
          <Plus size={15} />
          Ajouter un intervenant
        </button>
      )}

      <TextAreaField
        label="Commentaires"
        value={commentaires}
        onChange={onCommentairesChange}
        disabled={disabled}
      />
      <PhotoGallery
        photos={photos}
        onChange={onPhotosChange}
        disabled={disabled}
      />
    </div>
  );
}


