// ============================================================
// Parametres — Panneau de configuration
// Gestion des listes Client/Site/Système + Export Excel
// ============================================================

import { useState, useEffect } from "react";
import { Plus, Trash2, Download, Settings, ChevronDown, ChevronRight, AlertTriangle, RefreshCw } from "lucide-react";
import Layout from "@/components/Layout";
import { useApp } from "@/contexts/AppContext";
import type { AppConfig } from "@/lib/types";
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
import { clearAllData } from "@/lib/db";

type ListKey = "clients" | "sites" | "systemes";

const LIST_CONFIG: { key: ListKey; label: string; icon: string }[] = [
  { key: "clients", label: "Clients", icon: "🏢" },
  { key: "sites", label: "Sites", icon: "📍" },
  { key: "systemes", label: "Systèmes", icon: "⚙️" },
];

function EditableList({
  label,
  icon,
  items,
  onChange,
}: {
  label: string;
  icon: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newItem, setNewItem] = useState("");

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    if (items.includes(trimmed)) {
      toast.error("Cet élément existe déjà");
      return;
    }
    onChange([...items, trimmed]);
    setNewItem("");
  };

  const handleRemove = (item: string) => {
    onChange(items.filter((i) => i !== item));
  };

  return (
    <div className="terrain-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4"
      >
        <span className="text-xl">{icon}</span>
        <div className="flex-1 text-left">
          <div className="font-semibold text-sm text-gray-900">{label}</div>
          <div className="text-xs text-gray-500">{items.length} élément(s)</div>
        </div>
        {expanded ? (
          <ChevronDown size={16} color="#8A7049" />
        ) : (
          <ChevronRight size={16} color="#8A7049" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t" style={{ borderColor: "#DDCCBF" }}>
          <div className="pt-3 space-y-1.5">
            {items.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: "#F5F0EA" }}
              >
                <span className="flex-1 text-sm text-gray-700">{item}</span>
                <button
                  onClick={() => handleRemove(item)}
                  className="p-1 rounded hover:bg-red-50"
                >
                  <Trash2 size={13} color="#ef4444" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={`Ajouter un ${label.toLowerCase().slice(0, -1)}...`}
              className="flex-1 rounded-lg px-3 py-2 text-sm border focus:outline-none"
              style={{ borderColor: "#DDCCBF" }}
            />
            <button
              onClick={handleAdd}
              className="px-3 py-2 rounded-lg font-semibold text-sm transition-all active:scale-95"
              style={{ background: "#003D39", color: "#DCF21E" }}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Parametres() {
  const { config, updateConfig, suiviReports, pompageTests } = useApp();
  const [localConfig, setLocalConfig] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      // Vider tous les stores IndexedDB (fonctionne même avec connexion ouverte)
      await clearAllData();
      // Vider le localStorage
      localStorage.clear();
      // Vider le sessionStorage
      sessionStorage.clear();
      // Flag pour empêcher la re-sync depuis Sheets au prochain démarrage
      localStorage.setItem("evaplant-skip-sync", String(Date.now()));
      toast.success("App réinitialisée — rechargement...");
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      toast.error("Erreur lors de la réinitialisation");
      setResetting(false);
    }
    setShowResetConfirm(false);
  };

  useEffect(() => {
    if (config) setLocalConfig({ ...config });
  }, [config]);

  const handleSaveConfig = async () => {
    if (!localConfig) return;
    setSaving(true);
    try {
      await updateConfig(localConfig);
      toast.success("Configuration sauvegardée");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      // ── Feuille Rapports de suivi ──
      const suiviRows: Record<string, unknown>[] = [];
      for (const r of suiviReports) {
        const baseRow: Record<string, unknown> = {
          "Type": "Suivi terrain",
          "Numéro": r.reportNumber,
          "Statut": r.status,
          "Client": r.context.client,
          "Site": r.context.site,
          "Système": r.context.systeme,
          "Date": r.config.date,
          "Créé par": r.config.createdBy,
          "Nb zones": r.config.nombreZones,
          "Nb tensiomètres": r.config.nombreTensiometres,
          "Poste pompage — Alarmes VFD": r.postePompage.alarmesVFD,
          "Poste pompage — Commentaires": r.postePompage.commentaires,
          "Poste contrôle — Fuites": r.posteControle.presenceFuites,
          "Poste contrôle — Commentaires": r.posteControle.commentaires,
          "PLC Alarmes": r.plcAlarmes.alarmesPresentes,
          "Débitmètre — Volume cumulatif (m³)": r.debitmetre.volumeCumulActuel,
          "Pluviomètre — Nettoyage requis": r.pluviometre.nettoyageRequis,
          "Santé saules — Score": r.santeSaules.score ?? "",
          "Santé saules — Commentaires": r.santeSaules.commentaires,
          "Inspection pourtour — Ruissellement": r.inspectionPourtour.ruissellement,
          "Autres entretiens": r.autresEntretiens.commentaires,
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
          "Créé le": r.createdAt,
          "Modifié le": r.updatedAt,
        };

        // Lectures tensiomètres PLC
        r.plcTensiometres.lectures.forEach((l) => {
          baseRow[`PLC T${l.tensiometre} Z${l.zone} (kPa)`] = l.valeur;
        });

        // Entretiens tensiomètres
        r.entretiensTensiometres.forEach((t) => {
          baseRow[`Entretien T${t.tensiometreNum} — Manomètre (kPa)`] = t.tensionManometre;
          baseRow[`Entretien T${t.tensiometreNum} — PLC (kPa)`] = t.tensionPLC;
          baseRow[`Entretien T${t.tensiometreNum} — Algicide`] = t.algicideRequis;
          baseRow[`Entretien T${t.tensiometreNum} — Bulles`] = t.presenceBulles;
        });

        // Vannes irrigation
        r.vannesIrrigation.forEach((v) => {
          baseRow[`Vanne irrigation Z${v.zoneNum} — Fonctionne`] = v.fonctionne;
        });

        // Vannes lavage
        r.vannesLavage.forEach((v) => {
          baseRow[`Vanne lavage Z${v.zoneNum} — Fonctionne`] = v.fonctionne;
        });

        suiviRows.push(baseRow);
      }

      // ── Feuille Tests de pompage ──
      const pompageRows: Record<string, unknown>[] = pompageTests.map((t) => ({
        "Type": "Test de pompage",
        "Numéro": t.testNumber,
        "Statut": t.status,
        "Client": t.context.client,
        "Site": t.context.site,
        "Système": t.context.systeme,
        "Date": t.date,
        "Effectué par": t.testedBy,
        "Zone testée": t.zoneTeste,
        "Mode opération": t.modeOperation,
        "Résultats conformes": t.resultatsConformes,
        "Filtre Y — Pression amont mesurée (PSI)": t.filtreY.amontMesuree,
        "Filtre Y — Pression amont attendue (PSI)": t.filtreY.amontAttendue,
        "Filtre Y — Pression aval mesurée (PSI)": t.filtreY.avalMesuree,
        "Filtre Y — Pression aval attendue (PSI)": t.filtreY.avalAttendue,
        "Filtre Y — Différentiel (PSI)": t.filtreY.diffPression,
        "Filtre Y — Nettoyage requis": t.filtreY.nettoyageRequis,
        "Débitmètre — Pression aval mesurée (PSI)": t.debitmetre.avalMesuree,
        "Débitmètre — Débit PLC mesuré (m³/h)": t.debitmetre.plcDebitMesure,
        "Débitmètre — Débit PLC attendu (m³/h)": t.debitmetre.plcDebitAttendu,
        "Débitmètre — Valeurs conformes": t.debitmetre.valeursConformes,
        "Gicleurs — Défectueux": t.gicleurs.gicleursDefectueux,
        "Gicleurs — Fuites": t.gicleurs.fuites,
        "Temps stabilisation": t.demarrage.tempsStabilisation,
        "Nb photos (total)": [
          t.preparation.photos.length,
          t.demarrage.photos.length,
          t.poste.photos.length,
          t.filtreY.photos.length,
          t.debitmetre.photos.length,
          t.gicleurs.photos.length,
          t.conduiteLavage.photos.length,
          t.finalisation.photos.length,
        ].reduce((a, b) => a + b, 0),
        "Créé le": t.createdAt,
        "Modifié le": t.updatedAt,
      }));

      // Créer les feuilles
      if (suiviRows.length > 0) {
        const wsSuivi = XLSX.utils.json_to_sheet(suiviRows);
        XLSX.utils.book_append_sheet(wb, wsSuivi, "Suivi terrain");
      }
      if (pompageRows.length > 0) {
        const wsPompage = XLSX.utils.json_to_sheet(pompageRows);
        XLSX.utils.book_append_sheet(wb, wsPompage, "Tests de pompage");
      }
      if (suiviRows.length === 0 && pompageRows.length === 0) {
        const wsVide = XLSX.utils.json_to_sheet([{ Message: "Aucune donnée à exporter" }]);
        XLSX.utils.book_append_sheet(wb, wsVide, "Données");
      }

      const date = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `Evaplant_Export_${date}.xlsx`);
      toast.success("Export Excel téléchargé");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  if (!localConfig) {
    return (
      <Layout title="Paramètres">
        <div className="flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Chargement...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Paramètres">
      <div className="px-4 pt-4 pb-6 space-y-4">
        {/* Section Export */}
        <div
          className="rounded-xl p-4"
          style={{ background: "#003D39" }}
        >
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#DCF21E" }}>
            Export des données
          </div>
          <div className="text-sm mb-3" style={{ color: "#F5F0EA" }}>
            Exporter tous les rapports et tests en fichier Excel (.xlsx).
          </div>
          <div className="text-xs mb-3" style={{ color: "rgba(245,240,234,0.6)" }}>
            {suiviReports.length} rapport(s) de suivi · {pompageTests.length} test(s) de pompage
          </div>
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60"
            style={{ background: "#DCF21E", color: "#003D39" }}
          >
            <Download size={15} />
            {exporting ? "Export en cours..." : "Exporter en Excel"}
          </button>
        </div>

        {/* Section Configuration des listes */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Settings size={16} color="#8A7049" />
            <span className="text-sm font-semibold text-gray-700">
              Configuration des listes
            </span>
          </div>

          <div className="space-y-3">
            {LIST_CONFIG.map(({ key, label, icon }) => (
              <EditableList
                key={key}
                label={label}
                icon={icon}
                items={localConfig[key]}
                onChange={(items) =>
                  setLocalConfig((prev) => prev ? { ...prev, [key]: items } : prev)
                }
              />
            ))}
          </div>
        </div>

        {/* Bouton sauvegarder */}
        <button
          onClick={handleSaveConfig}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-sm transition-all active:scale-95 disabled:opacity-60"
          style={{ background: "#003D39", color: "#DCF21E" }}
        >
          {saving ? "Sauvegarde..." : "Sauvegarder la configuration"}
        </button>

        {/* Mise à jour de l'app */}
        <div
          className="rounded-xl p-4"
          style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold" style={{ color: "#166534" }}>Mettre à jour l'app</div>
              <div className="text-xs mt-0.5" style={{ color: "#15803D" }}>Evaplant — v1.6.0</div>
            </div>
            <button
              onClick={async () => {
                try {
                  // 1. Vider tous les caches du navigateur (Workbox inclus)
                  if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map((k) => caches.delete(k)));
                  }
                  // 2. Désinscrire tous les Service Workers
                  if ('serviceWorker' in navigator) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(regs.map((r) => r.unregister()));
                  }
                } catch (e) {
                  console.warn('Update cleanup error:', e);
                }
                // 3. Recharger en vidant le cache HTTP
                window.location.reload();
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
              style={{ background: "#003D39", color: "#DCF21E" }}
            >
              <RefreshCw size={15} />
              Mettre à jour
            </button>
          </div>
        </div>

        {/* Section Réinitialisation */}
        <div
          className="rounded-xl p-4"
          style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} color="#DC2626" />
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#DC2626" }}>
              Zone dangereuse
            </div>
          </div>
          <div className="text-sm mb-3" style={{ color: "#7F1D1D" }}>
            Efface toutes les données locales de l'app (rapports, tests, configuration). Les données déjà synchronisées dans Google Sheets et Drive ne seront pas affectées.
          </div>
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={resetting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60"
            style={{ background: "#DC2626", color: "#fff" }}
          >
            <Trash2 size={15} />
            {resetting ? "Réinitialisation..." : "Réinitialiser l'app"}
          </button>
        </div>

        {/* Infos version */}
        <div className="text-center pt-4">
          <p className="text-xs text-gray-400">
            Evaplant Opérations Terrain — v1.6.0
          </p>
          <p className="text-xs text-gray-300 mt-0.5">
            Données stockées localement sur cet appareil
          </p>
        </div>
      </div>

      {/* Dialog confirmation réinitialisation */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réinitialiser l'app ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera <strong>toutes les données locales</strong> : rapports de suivi, tests de pompage, configuration. Cette action est <strong>irréversible</strong>.
              <br /><br />
              Les données déjà synchronisées dans Google Sheets et Google Drive resteront intactes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              style={{ background: "#DC2626", color: "#fff" }}
            >
              Oui, tout effacer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
