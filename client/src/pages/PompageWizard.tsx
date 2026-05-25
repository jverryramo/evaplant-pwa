// ============================================================
// PompageWizard — Wizard complet du test de pompage
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { Save, Calendar, User, Droplets, ArrowRight } from "lucide-react";
import Layout from "@/components/Layout";
import { useApp } from "@/contexts/AppContext";
import type { PompageTest } from "@/lib/types";
import {
  WizardStep,
  YesNoRadio,
  CheckboxField,
  ValueInput,
  TextAreaField,
  PhotoGallery,
} from "@/components/WizardStep";
import { toast } from "sonner";
import { autoAddPompageToExcel } from "@/lib/excelExport";
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

function buildPompageSteps(modeOperation: "irrigation" | "lavage") {
  const steps = [
    { id: 1, title: "(1.2.1) Préparation du test", key: "preparation" },
    { id: 2, title: "(1.2.2) Démarrage de la pompe", key: "demarrage" },
    { id: 3, title: "(1.2.3) Inspection poste de pompage", key: "poste" },
    { id: 4, title: "(1.2.4) Filtre en Y", key: "filtreY" },
    { id: 5, title: "(1.2.5) Débitmètre", key: "debitmetre" },
    { id: 6, title: "(1.2.6) Gicleurs et latéraux", key: "gicleurs" },
  ];

  if (modeOperation === "lavage") {
    steps.push({ id: 7, title: "(1.2.7) Conduite de lavage", key: "conduiteLavage" });
  }

  steps.push({ id: steps.length + 1, title: "(1.2.8) Finalisation du test", key: "finalisation" });

  return steps;
}

export default function PompageWizard() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { pompageTests, savePompage } = useApp();

  const [test, setTest] = useState<PompageTest | null>(null);
  // currentStep = 0 → page de configuration, 1..N → étapes du wizard
  const [currentStep, setCurrentStep] = useState(1);
  const [steps, setSteps] = useState<{ id: number; title: string; key: string }[]>([]);
  const [showFinalDialog, setShowFinalDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  // Champs de la page de configuration
  const [configDate, setConfigDate] = useState("");
  const [configTestedBy, setConfigTestedBy] = useState("");
  const [configZone, setConfigZone] = useState("");

  useEffect(() => {
    const found = pompageTests.find((t) => t.id === params.id);
    if (found) {
      setTest(found);
      setSteps(buildPompageSteps(found.modeOperation));
    }
  }, [params.id, pompageTests]);

  // Ouvrir la page de configuration (step 0) avec les valeurs actuelles
  const openConfigPage = () => {
    if (!test) return;
    setConfigDate(test.date);
    setConfigTestedBy(test.testedBy);
    setConfigZone(test.zoneTeste);
    setCurrentStep(0);
  };

  // Sauvegarder la configuration et revenir à l'étape 1
  const handleSaveConfig = async () => {
    if (!test) return;
    if (!configTestedBy.trim()) { toast.error("Veuillez indiquer le nom de l'intervenant"); return; }
    if (!configZone.trim()) { toast.error("Veuillez indiquer la zone testée"); return; }
    if (!configDate) { toast.error("Veuillez sélectionner une date"); return; }
    const updated = { ...test, date: configDate, testedBy: configTestedBy.trim(), zoneTeste: configZone.trim() };
    setTest(updated);
    await savePompage(updated);
    setCurrentStep(1);
    toast.success("Configuration mise à jour");
  };

  const update = useCallback((updater: (t: PompageTest) => PompageTest) => {
    setTest((prev) => (prev ? updater(prev) : prev));
  }, []);

  const handleSave = async (status?: PompageTest["status"]) => {
    if (!test) return;
    setSaving(true);
    try {
      const toSave = status ? { ...test, status } : test;
      await savePompage(toSave);
      toast.success("Test sauvegardé");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!test) return;
    setSaving(true);
    try {
      const finalized = { ...test, status: "completed" as const };
      await savePompage(finalized);

      const { sheetsOk, sheetsError, sheetsAction, debugInfo } = await autoAddPompageToExcel(finalized);

      if (sheetsOk) {
        const actionLabel = sheetsAction === "updated" ? "updated" : sheetsAction === "inserted" ? "inserted" : "?";
        const debugMsg = debugInfo
          ? `Sync réussie — action: ${actionLabel} — reportNumber: ${debugInfo.reportNumber} — ID: ${debugInfo.reportId.substring(0, 8)}... — onglet: ${debugInfo.sheet}`
          : "✓ Test finalisé et synchronisé dans Google Sheets";
        toast.success(debugMsg, { duration: 8000 });
      } else {
        toast.warning(
          `Test finalisé localement, mais la synchronisation Google Sheets a échoué : ${sheetsError ?? "erreur inconnue"}`,
          { duration: 8000 }
        );
        console.error("[PompageWizard] Erreur synchro Sheets:", sheetsError);
      }

      navigate("/pompage");
    } catch (err) {
      console.error("[PompageWizard] Erreur finalisation:", err);
      toast.error("Erreur lors de la finalisation");
    } finally {
      setSaving(false);
      setShowFinalDialog(false);
    }
  };

  if (!test) {
    return (
      <Layout title="Test de pompage" showBack onBack={() => navigate("/pompage")}>
        <div className="flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Chargement...</p>
        </div>
      </Layout>
    );
  }

  const isLocked = test.locked;
  const totalSteps = steps.length;
  const isFirst = currentStep === 1;
  const isLast = currentStep === totalSteps;
  const currentStepData = steps[currentStep - 1];

  const renderContent = () => {
    if (!currentStepData) return null;
    const key = currentStepData.key;

    // ── Préparation ──
    if (key === "preparation") {
      return (
        <div className="space-y-4">
          <CheckboxField
            label="Mettre le contrôleur en mode manuel ✓"
            checked={test.preparation.controleurModeManuel}
            onChange={(v) => update((t) => ({ ...t, preparation: { ...t.preparation, controleurModeManuel: v } }))}
            disabled={isLocked}
          />
          <CheckboxField
            label="Vérifier l'arrêt de la pompe et la fermeture des vannes d'irrigation et de lavage ✓"
            checked={test.preparation.verificationArret}
            onChange={(v) => update((t) => ({ ...t, preparation: { ...t.preparation, verificationArret: v } }))}
            disabled={isLocked}
          />
          <CheckboxField
            label="Inspection visuelle du poste de pompage ✓"
            checked={test.preparation.inspectionVisuelle}
            onChange={(v) => update((t) => ({ ...t, preparation: { ...t.preparation, inspectionVisuelle: v } }))}
            disabled={isLocked}
          />
          <TextAreaField
            label="Commentaires"
            value={test.preparation.commentaires}
            onChange={(v) => update((t) => ({ ...t, preparation: { ...t.preparation, commentaires: v } }))}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={test.preparation.photos}
            onChange={(photos) => update((t) => ({ ...t, preparation: { ...t.preparation, photos } }))}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Démarrage ──
    if (key === "demarrage") {
      return (
        <div className="space-y-4">
          <CheckboxField
            label="Ouverture de la vanne d'irrigation ✓"
            checked={test.demarrage.ouvertureVanneIrrigation}
            onChange={(v) => update((t) => ({ ...t, demarrage: { ...t.demarrage, ouvertureVanneIrrigation: v } }))}
            disabled={isLocked}
          />
          <ValueInput
            label="Zone d'irrigation testée"
            value={test.demarrage.zoneIrrigation}
            onChange={(v) => update((t) => ({ ...t, demarrage: { ...t.demarrage, zoneIrrigation: v } }))}
            placeholder="Ex: Zone 3"
            disabled={isLocked}
          />
          {test.modeOperation === "lavage" && (
            <>
              <CheckboxField
                label="Ouverture de la vanne de lavage ✓"
                checked={test.demarrage.ouvertureVanneLavage}
                onChange={(v) => update((t) => ({ ...t, demarrage: { ...t.demarrage, ouvertureVanneLavage: v } }))}
                disabled={isLocked}
              />
              <ValueInput
                label="Zone de lavage testée"
                value={test.demarrage.zoneLavage}
                onChange={(v) => update((t) => ({ ...t, demarrage: { ...t.demarrage, zoneLavage: v } }))}
                placeholder="Ex: Zone 3"
                disabled={isLocked}
              />
            </>
          )}
          <CheckboxField
            label="Démarrage de la pompe ✓"
            checked={test.demarrage.demarragePompe}
            onChange={(v) => update((t) => ({ ...t, demarrage: { ...t.demarrage, demarragePompe: v } }))}
            disabled={isLocked}
          />
          <ValueInput
            label="Temps de stabilisation"
            value={test.demarrage.tempsStabilisation}
            onChange={(v) => update((t) => ({ ...t, demarrage: { ...t.demarrage, tempsStabilisation: v } }))}
            unit="mm:ss"
            placeholder="Ex: 02:30"
            disabled={isLocked}
          />
          <TextAreaField
            label="Commentaires"
            value={test.demarrage.commentaires}
            onChange={(v) => update((t) => ({ ...t, demarrage: { ...t.demarrage, commentaires: v } }))}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={test.demarrage.photos}
            onChange={(photos) => update((t) => ({ ...t, demarrage: { ...t.demarrage, photos } }))}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Poste de pompage ──
    if (key === "poste") {
      return (
        <div className="space-y-4">
          <CheckboxField
            label="Inspection visuelle du poste de pompage ✓"
            checked={test.poste.inspectionVisuelle}
            onChange={(v) => update((t) => ({ ...t, poste: { ...t.poste, inspectionVisuelle: v } }))}
            disabled={isLocked}
          />
          <YesNoRadio
            label="Anomalies observées ?"
            value={test.poste.anomaliesObservees}
            onChange={(v) => update((t) => ({ ...t, poste: { ...t.poste, anomaliesObservees: v } }))}
            disabled={isLocked}
          />
          {test.poste.anomaliesObservees === "oui" && (
            <TextAreaField
              label="Description des anomalies"
              value={test.poste.descriptionAnomalies}
              onChange={(v) => update((t) => ({ ...t, poste: { ...t.poste, descriptionAnomalies: v } }))}
              disabled={isLocked}
            />
          )}
          <TextAreaField
            label="Commentaires"
            value={test.poste.commentaires}
            onChange={(v) => update((t) => ({ ...t, poste: { ...t.poste, commentaires: v } }))}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={test.poste.photos}
            onChange={(photos) => update((t) => ({ ...t, poste: { ...t.poste, photos } }))}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Filtre en Y ──
    if (key === "filtreY") {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ValueInput
              label="Pression mesurée en amont du préfiltre"
              value={test.filtreY.amontMesuree}
              onChange={(v) => update((t) => ({ ...t, filtreY: { ...t.filtreY, amontMesuree: v } }))}
              unit="PSI"
              type="number"
              disabled={isLocked}
            />
            <ValueInput
              label="Pression attendue en amont du préfiltre"
              value={test.filtreY.amontAttendue}
              onChange={(v) => update((t) => ({ ...t, filtreY: { ...t.filtreY, amontAttendue: v } }))}
              unit="PSI"
              type="number"
              disabled={isLocked}
            />
            <ValueInput
              label="Pression mesurée en aval du préfiltre"
              value={test.filtreY.avalMesuree}
              onChange={(v) => update((t) => ({ ...t, filtreY: { ...t.filtreY, avalMesuree: v } }))}
              unit="PSI"
              type="number"
              disabled={isLocked}
            />
            <ValueInput
              label="Pression attendue en aval du préfiltre"
              value={test.filtreY.avalAttendue}
              onChange={(v) => update((t) => ({ ...t, filtreY: { ...t.filtreY, avalAttendue: v } }))}
              unit="PSI"
              type="number"
              disabled={isLocked}
            />
          </div>
          {/* Différentiel de pression — calcul automatique : aval mesurée − amont mesurée */}
          {(() => {
            const amont = parseFloat(test.filtreY.amontMesuree);
            const aval = parseFloat(test.filtreY.avalMesuree);
            const diff = !isNaN(amont) && !isNaN(aval) ? (aval - amont).toFixed(2) : "";
            // Mettre à jour le store si la valeur calculée a changé
            if (diff !== "" && diff !== test.filtreY.diffPression) {
              update((t) => ({ ...t, filtreY: { ...t.filtreY, diffPression: diff } }));
            }
            return (
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-700">
                  Différentiel de pression
                  <span className="ml-2 text-xs font-normal" style={{ color: "#8A7049" }}>
                    (calculé automatiquement : aval − amont)
                  </span>
                </div>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "#F5F0EA", border: "1px solid #DDCCBF" }}
                >
                  <span className="flex-1 text-sm font-semibold" style={{ color: "#003D39" }}>
                    {diff !== "" ? diff : <span className="text-gray-400 font-normal">— (saisir amont et aval d'abord)</span>}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "#8A7049" }}>PSI</span>
                </div>
              </div>
            );
          })()}
          <YesNoRadio
            label="Nettoyage du filtre requis ?"
            value={test.filtreY.nettoyageRequis}
            onChange={(v) => update((t) => ({ ...t, filtreY: { ...t.filtreY, nettoyageRequis: v } }))}
            disabled={isLocked}
          />
          {test.filtreY.nettoyageRequis === "oui" && (
            <CheckboxField
              label="Nettoyage du filtre effectué ✓"
              checked={test.filtreY.nettoyageEffectue}
              onChange={(v) => update((t) => ({ ...t, filtreY: { ...t.filtreY, nettoyageEffectue: v } }))}
              disabled={isLocked}
            />
          )}
          <TextAreaField
            label="Commentaires"
            value={test.filtreY.commentaires}
            onChange={(v) => update((t) => ({ ...t, filtreY: { ...t.filtreY, commentaires: v } }))}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={test.filtreY.photos}
            onChange={(photos) => update((t) => ({ ...t, filtreY: { ...t.filtreY, photos } }))}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Débitmètre ──
    if (key === "debitmetre") {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ValueInput
              label="Pression mesurée en aval du préfiltre"
              value={test.debitmetre.avalMesuree}
              onChange={(v) => update((t) => ({ ...t, debitmetre: { ...t.debitmetre, avalMesuree: v } }))}
              unit="PSI"
              type="number"
              disabled={isLocked}
            />
            <ValueInput
              label="Pression attendue en aval du préfiltre"
              value={test.debitmetre.avalAttendue}
              onChange={(v) => update((t) => ({ ...t, debitmetre: { ...t.debitmetre, avalAttendue: v } }))}
              unit="PSI"
              type="number"
              disabled={isLocked}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ValueInput
              label="Pression PLC mesurée"
              value={test.debitmetre.plcPressionMesuree}
              onChange={(v) => update((t) => ({ ...t, debitmetre: { ...t.debitmetre, plcPressionMesuree: v } }))}
              unit="PSI"
              type="number"
              disabled={isLocked}
            />
            <ValueInput
              label="Pression PLC attendue"
              value={test.debitmetre.plcPressionAttendue}
              onChange={(v) => update((t) => ({ ...t, debitmetre: { ...t.debitmetre, plcPressionAttendue: v } }))}
              unit="PSI"
              type="number"
              disabled={isLocked}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ValueInput
              label="Débit PLC mesuré"
              value={test.debitmetre.plcDebitMesure}
              onChange={(v) => update((t) => ({ ...t, debitmetre: { ...t.debitmetre, plcDebitMesure: v } }))}
              unit="m³/h"
              type="number"
              disabled={isLocked}
            />
            <ValueInput
              label="Débit PLC attendu"
              value={test.debitmetre.plcDebitAttendu}
              onChange={(v) => update((t) => ({ ...t, debitmetre: { ...t.debitmetre, plcDebitAttendu: v } }))}
              unit="m³/h"
              type="number"
              disabled={isLocked}
            />
          </div>
          <YesNoRadio
            label="Valeurs conformes aux attentes ?"
            value={test.debitmetre.valeursConformes}
            onChange={(v) => update((t) => ({ ...t, debitmetre: { ...t.debitmetre, valeursConformes: v } }))}
            disabled={isLocked}
          />
          <TextAreaField
            label="Commentaires"
            value={test.debitmetre.commentaires}
            onChange={(v) => update((t) => ({ ...t, debitmetre: { ...t.debitmetre, commentaires: v } }))}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={test.debitmetre.photos}
            onChange={(photos) => update((t) => ({ ...t, debitmetre: { ...t.debitmetre, photos } }))}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Gicleurs et latéraux ──
    if (key === "gicleurs") {
      return (
        <div className="space-y-4">
          <CheckboxField
            label="Inspection visuelle des gicleurs et latéraux ✓"
            checked={test.gicleurs.inspectionVisuelle}
            onChange={(v) => update((t) => ({ ...t, gicleurs: { ...t.gicleurs, inspectionVisuelle: v } }))}
            disabled={isLocked}
          />
          <YesNoRadio
            label="Gicleurs défectueux ?"
            value={test.gicleurs.gicleursDefectueux}
            onChange={(v) => update((t) => ({ ...t, gicleurs: { ...t.gicleurs, gicleursDefectueux: v } }))}
            disabled={isLocked}
          />
          {test.gicleurs.gicleursDefectueux === "oui" && (
            <CheckboxField
              label="Gicleurs remplacés ✓"
              checked={test.gicleurs.gicleursRemplaces}
              onChange={(v) => update((t) => ({ ...t, gicleurs: { ...t.gicleurs, gicleursRemplaces: v } }))}
              disabled={isLocked}
            />
          )}
          <YesNoRadio
            label="Fuites détectées ?"
            value={test.gicleurs.fuites}
            onChange={(v) => update((t) => ({ ...t, gicleurs: { ...t.gicleurs, fuites: v } }))}
            disabled={isLocked}
          />
          {test.gicleurs.fuites === "oui" && (
            <CheckboxField
              label="Fuites réparées ✓"
              checked={test.gicleurs.fuitesReparees}
              onChange={(v) => update((t) => ({ ...t, gicleurs: { ...t.gicleurs, fuitesReparees: v } }))}
              disabled={isLocked}
            />
          )}
          <TextAreaField
            label="Commentaires"
            value={test.gicleurs.commentaires}
            onChange={(v) => update((t) => ({ ...t, gicleurs: { ...t.gicleurs, commentaires: v } }))}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={test.gicleurs.photos}
            onChange={(photos) => update((t) => ({ ...t, gicleurs: { ...t.gicleurs, photos } }))}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Conduite de lavage (mode lavage seulement) ──
    if (key === "conduiteLavage") {
      return (
        <div className="space-y-4">
          <CheckboxField
            label="Inspection visuelle de la conduite de lavage ✓"
            checked={test.conduiteLavage.inspectionVisuelle}
            onChange={(v) => update((t) => ({ ...t, conduiteLavage: { ...t.conduiteLavage, inspectionVisuelle: v } }))}
            disabled={isLocked}
          />
          <CheckboxField
            label="Vérification du point de rejet ✓"
            checked={test.conduiteLavage.pointRejet}
            onChange={(v) => update((t) => ({ ...t, conduiteLavage: { ...t.conduiteLavage, pointRejet: v } }))}
            disabled={isLocked}
          />
          <YesNoRadio
            label="Fuites détectées ?"
            value={test.conduiteLavage.fuites}
            onChange={(v) => update((t) => ({ ...t, conduiteLavage: { ...t.conduiteLavage, fuites: v } }))}
            disabled={isLocked}
          />
          {test.conduiteLavage.fuites === "oui" && (
            <CheckboxField
              label="Fuites réparées ✓"
              checked={test.conduiteLavage.fuitesReparees}
              onChange={(v) => update((t) => ({ ...t, conduiteLavage: { ...t.conduiteLavage, fuitesReparees: v } }))}
              disabled={isLocked}
            />
          )}
          <TextAreaField
            label="Commentaires"
            value={test.conduiteLavage.commentaires}
            onChange={(v) => update((t) => ({ ...t, conduiteLavage: { ...t.conduiteLavage, commentaires: v } }))}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={test.conduiteLavage.photos}
            onChange={(photos) => update((t) => ({ ...t, conduiteLavage: { ...t.conduiteLavage, photos } }))}
            disabled={isLocked}
          />
        </div>
      );
    }

    // ── Finalisation ──
    if (key === "finalisation") {
      return (
        <div className="space-y-4">
          <CheckboxField
            label="Arrêt de la pompe ✓"
            checked={test.finalisation.arretPompe}
            onChange={(v) => update((t) => ({ ...t, finalisation: { ...t.finalisation, arretPompe: v } }))}
            disabled={isLocked}
          />
          <CheckboxField
            label="Fermeture de la vanne d'irrigation ✓"
            checked={test.finalisation.fermetureVanneIrrigation}
            onChange={(v) => update((t) => ({ ...t, finalisation: { ...t.finalisation, fermetureVanneIrrigation: v } }))}
            disabled={isLocked}
          />
          {test.modeOperation === "lavage" && (
            <CheckboxField
              label="Fermeture de la vanne de lavage ✓"
              checked={test.finalisation.fermetureVanneLavage}
              onChange={(v) => update((t) => ({ ...t, finalisation: { ...t.finalisation, fermetureVanneLavage: v } }))}
              disabled={isLocked}
            />
          )}
          <CheckboxField
            label="Remise en mode automatique du contrôleur ✓"
            checked={test.finalisation.remiseAuto}
            onChange={(v) => update((t) => ({ ...t, finalisation: { ...t.finalisation, remiseAuto: v } }))}
            disabled={isLocked}
          />
          <TextAreaField
            label="Commentaires"
            value={test.finalisation.commentaires}
            onChange={(v) => update((t) => ({ ...t, finalisation: { ...t.finalisation, commentaires: v } }))}
            disabled={isLocked}
          />
          <PhotoGallery
            photos={test.finalisation.photos}
            onChange={(photos) => update((t) => ({ ...t, finalisation: { ...t.finalisation, photos } }))}
            disabled={isLocked}
          />

          <div className="pt-2">
            <div className="text-sm font-medium text-gray-700 mb-3">Résultats du test conformes ?</div>
            <div className="flex gap-3">
              {(["oui", "non"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={isLocked}
                  onClick={() => update((t) => ({ ...t, resultatsConformes: opt }))}
                  className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    background: test.resultatsConformes === opt
                      ? (opt === "oui" ? "#003D39" : "#ef4444")
                      : "#F5F0EA",
                    color: test.resultatsConformes === opt ? (opt === "oui" ? "#DCF21E" : "white") : "#8A7049",
                    border: `2px solid ${test.resultatsConformes === opt ? (opt === "oui" ? "#003D39" : "#ef4444") : "#DDCCBF"}`,
                  }}
                >
                  {opt === "oui" ? "OUI — Conforme" : "NON — Non conforme"}
                </button>
              ))}
            </div>
          </div>

        </div>
      );
    }

    return <div className="text-gray-400 text-sm">Section non disponible</div>;
  };

  return (
    <Layout
      title={`Test #${test.testNumber}`}
      showBack
      onBack={() => {
        handleSave();
        navigate("/pompage");
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
        {/* Page de configuration (step 0) */}
        {currentStep === 0 && (
          <div className="px-4 pt-6 pb-6 space-y-4 overflow-y-auto flex-1">
            {/* En-tête */}
            <div className="rounded-xl p-4" style={{ background: "#003D39" }}>
              <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#DCF21E" }}>
                Configuration du test
              </div>
              <div className="text-sm" style={{ color: "#F5F0EA" }}>
                Test #{test.testNumber} — modifiez les paramètres ci-dessous.
              </div>
            </div>
            {/* Date */}
            <div className="terrain-card p-4">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A7049" }}>
                <Calendar size={12} className="inline mr-1" />
                Date du test
              </label>
              <input
                type="date"
                value={configDate}
                onChange={(e) => setConfigDate(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none"
                style={{ borderColor: "#DDCCBF" }}
              />
            </div>
            {/* Effectué par */}
            <div className="terrain-card p-4">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A7049" }}>
                <User size={12} className="inline mr-1" />
                Test effectué par
              </label>
              <input
                type="text"
                value={configTestedBy}
                onChange={(e) => setConfigTestedBy(e.target.value)}
                placeholder="Nom de l'intervenant..."
                className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none"
                style={{ borderColor: "#DDCCBF" }}
              />
            </div>
            {/* Zone testée */}
            <div className="terrain-card p-4">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A7049" }}>
                <Droplets size={12} className="inline mr-1" />
                Zone testée
              </label>
              <input
                type="text"
                value={configZone}
                onChange={(e) => setConfigZone(e.target.value)}
                placeholder="Ex: Zone 3, Zone 1-2..."
                className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none"
                style={{ borderColor: "#DDCCBF" }}
              />
            </div>
            {/* Info mode opération (non modifiable) */}
            <div
              className="px-3 py-2 rounded-lg text-xs"
              style={{ background: "#F5F0EA", color: "#8A7049", border: "1px solid #DDCCBF" }}
            >
              Mode d'opération : <strong>{test.modeOperation === "irrigation" ? "Irrigation" : "Lavage"}</strong> (non modifiable après création)
            </div>
            {/* Bouton Enregistrer et continuer */}
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-4 font-semibold text-sm transition-all active:scale-95 disabled:opacity-60"
              style={{ background: "#003D39", color: "#DCF21E" }}
            >
              {saving ? "Enregistrement..." : "Enregistrer et continuer"}
              <ArrowRight size={16} />
            </button>
          </div>
        )}
        {currentStep > 0 && steps.length > 0 && currentStepData && (
          <WizardStep
            steps={steps}
            currentStep={currentStep}
            onStepChange={setCurrentStep}
            onPrevious={() => {
              if (isFirst && !isLocked) {
                openConfigPage();
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
            {/* Badge de mode visible sur toutes les pages */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg mb-3 text-xs font-semibold"
              style={{
                background: test.modeOperation === "irrigation" ? "rgba(0,61,57,0.08)" : "rgba(138,112,73,0.12)",
                color: test.modeOperation === "irrigation" ? "#003D39" : "#8A7049",
                border: `1px solid ${test.modeOperation === "irrigation" ? "rgba(0,61,57,0.2)" : "rgba(138,112,73,0.3)"}`,
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: test.modeOperation === "irrigation" ? "#003D39" : "#8A7049" }}
              />
              Mode : {test.modeOperation === "irrigation" ? "Irrigation" : "Lavage"}
            </div>
            {renderContent()}
          </WizardStep>
        )}
      </div>

      <AlertDialog open={showFinalDialog} onOpenChange={setShowFinalDialog}>
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Récapitulatif avant finalisation</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3 text-sm">Test #{test.testNumber} — vérifiez les sections avant de finaliser.</p>
                <div className="space-y-1.5">
                  {steps.slice(0, -1).map((step) => {
                    const key = step.key;
                    let isComplete = false;
                    // Règle : cochée uniquement si tous les champs obligatoires sont remplis
                    // Exceptions : commentaires et photos (non obligatoires)
                    if (key === "preparation") {
                      isComplete = test.preparation.controleurModeManuel &&
                        test.preparation.verificationArret &&
                        test.preparation.inspectionVisuelle;
                    } else if (key === "demarrage") {
                      isComplete = test.demarrage.demarragePompe && !!test.demarrage.tempsStabilisation;
                    } else if (key === "poste") {
                      isComplete = test.poste.inspectionVisuelle && !!test.poste.anomaliesObservees;
                    } else if (key === "filtreY") {
                      isComplete = !!test.filtreY.amontMesuree && !!test.filtreY.avalMesuree && !!test.filtreY.nettoyageRequis;
                    } else if (key === "debitmetre") {
                      isComplete = !!test.debitmetre.avalMesuree && !!test.debitmetre.valeursConformes;
                    } else if (key === "gicleurs") {
                      isComplete = test.gicleurs.inspectionVisuelle && !!test.gicleurs.gicleursDefectueux && !!test.gicleurs.fuites;
                    } else if (key === "conduiteLavage") {
                      isComplete = test.conduiteLavage?.inspectionVisuelle && !!test.conduiteLavage?.fuites;
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
            <AlertDialogCancel>Retour au test</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinalize}
              style={{ background: "#003D39", color: "#DCF21E" }}
            >
              Confirmer et finaliser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
