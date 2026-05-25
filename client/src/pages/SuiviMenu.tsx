// ============================================================
// SuiviMenu — Liste et gestion des rapports de suivi terrain
// ============================================================

import { useState } from "react";
import { useLocation } from "wouter";
import { Plus, Archive, Trash2, Lock, LockOpen, FileText, ChevronRight, FileDown, RefreshCw } from "lucide-react";
import Layout from "@/components/Layout";
import { useApp } from "@/contexts/AppContext";
import type { SuiviReport, ReportStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { generateSuiviPDF } from "@/lib/pdfExport";
import { downloadCumulativeExcel, autoAddSuiviToExcel } from "@/lib/excelExport";
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
import { toast } from "sonner";

const STATUS_TABS: { key: ReportStatus | "all"; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "draft", label: "Brouillons" },
  { key: "in_progress", label: "En cours" },
  { key: "completed", label: "Finalisés" },
  { key: "archived", label: "Archivés" },
];

function StatusBadge({ status }: { status: ReportStatus }) {
  const styles: Record<ReportStatus, { bg: string; text: string }> = {
    draft: { bg: "#DDCCBF", text: "#5a3e28" },
    in_progress: { bg: "#DCF21E", text: "#003D39" },
    completed: { bg: "#003D39", text: "#DCF21E" },
    archived: { bg: "#8A7049", text: "#fff" },
  };
  const s = styles[status];
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.text }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function SuiviMenu() {
  const [, navigate] = useLocation();
  const { suiviReports, saveSuivi, deleteSuivi, activeContext } = useApp();
  const [activeTab, setActiveTab] = useState<ReportStatus | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<SuiviReport | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<SuiviReport | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<SuiviReport | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  if (!activeContext) {
    navigate("/");
    return null;
  }

  const filtered = suiviReports.filter((r) => {
    const matchContext =
      r.context.client === activeContext.client &&
      r.context.site === activeContext.site &&
      r.context.systeme === activeContext.systeme;
    const matchStatus = activeTab === "all" || r.status === activeTab;
    return matchContext && matchStatus;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteSuivi(deleteTarget.id);
    setDeleteTarget(null);
    toast.success("Rapport supprimé");
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    await saveSuivi({ ...archiveTarget, status: "archived" });
    setArchiveTarget(null);
    toast.success("Rapport archivé");
  };

  const handleLock = async (report: SuiviReport) => {
    await saveSuivi({ ...report, locked: true });
    toast.success("Rapport verrouillé");
  };

  const handleUnlock = async () => {
    if (!unlockTarget) return;
    await saveSuivi({ ...unlockTarget, locked: false });
    setUnlockTarget(null);
    toast.success("Rapport déverrouillé — modifications possibles");
  };

  const handleRetrySync = async (report: SuiviReport) => {
    setSyncingId(report.id);
    try {
      const { sheetsOk, sheetsError } = await autoAddSuiviToExcel(report);
      if (sheetsOk) {
        toast.success("✓ Synchronisation réussie dans Google Sheets");
      } else {
        toast.error(`Échec de la synchronisation : ${sheetsError ?? "erreur inconnue"}`, { duration: 6000 });
      }
    } catch {
      toast.error("Erreur lors de la synchronisation");
    } finally {
      setSyncingId(null);
    }
  };

  const handleDownloadPDF = async (report: SuiviReport) => {
    try {
      await generateSuiviPDF(report);
      toast.success("PDF généré avec succès");
    } catch {
      toast.error("Erreur lors de la génération du PDF");
    }
  };

  const handleDownloadExcel = async () => {
    try {
      await downloadCumulativeExcel();
      toast.success("Fichier Excel téléchargé");
    } catch {
      toast.error("Erreur lors de l'export Excel");
    }
  };

  return (
    <Layout title="(1.1) Rapports de suivi" showBack onBack={() => navigate("/operations")}>
      <div className="px-4 pt-4">
        {/* Boutons actions */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => navigate("/suivi/nouveau")}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-sm transition-all active:scale-95"
            style={{ background: "#003D39", color: "#DCF21E" }}
          >
            <Plus size={18} />
            Nouveau rapport
          </button>
          <button
            onClick={handleDownloadExcel}
            className="flex items-center justify-center gap-2 px-4 rounded-xl py-3.5 font-semibold text-sm transition-all active:scale-95"
            style={{ background: "#F5F0EA", color: "#003D39", border: "2px solid #DDCCBF" }}
            title="Télécharger l'Excel cumulatif"
          >
            <FileDown size={18} />
          </button>
        </div>

        {/* Onglets de filtre */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: activeTab === tab.key ? "#003D39" : "#DDCCBF",
                color: activeTab === tab.key ? "#DCF21E" : "#5a3e28",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Liste des rapports */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText size={40} color="#DDCCBF" className="mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">Aucun rapport trouvé</p>
            <p className="text-xs text-gray-300 mt-1">
              Créez un nouveau rapport pour commencer
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((report) => (
              <div
                key={report.id}
                className="terrain-card overflow-hidden"
              >
                {/* Indicateur de statut */}
                <div
                  className="h-1"
                  style={{
                    background:
                      report.status === "completed"
                        ? "#003D39"
                        : report.status === "in_progress"
                        ? "#DCF21E"
                        : report.status === "archived"
                        ? "#8A7049"
                        : "#DDCCBF",
                  }}
                />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-gray-900">
                          Rapport #{report.reportNumber}
                        </span>
                        <StatusBadge status={report.status} />
                        {report.locked && (
                          <Lock size={12} color="#8A7049" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {report.config.date} · {report.config.createdBy}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {report.config.nombreZones} zone(s) · {report.config.nombreTensiometres} tensiomètre(s)
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {report.status === "completed" && (
                        <button
                          onClick={() => handleDownloadPDF(report)}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Télécharger le PDF"
                        >
                          <FileDown size={15} color="#003D39" />
                        </button>
                      )}
                      {report.status === "completed" && (
                        <button
                          onClick={() => handleRetrySync(report)}
                          disabled={syncingId === report.id}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                          title="Réessayer la synchronisation Google Sheets"
                        >
                          <RefreshCw
                            size={15}
                            color="#003D39"
                            className={syncingId === report.id ? "animate-spin" : ""}
                          />
                        </button>
                      )}
                      {/* Verrouiller / Déverrouiller */}
                      {report.status === "completed" && !report.locked && (
                        <button
                          onClick={() => handleLock(report)}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Verrouiller le rapport"
                        >
                          <Lock size={15} color="#8A7049" />
                        </button>
                      )}
                      {report.locked && (
                        <button
                          onClick={() => setUnlockTarget(report)}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Déverrouiller le rapport"
                        >
                          <LockOpen size={15} color="#003D39" />
                        </button>
                      )}
                      {!report.locked && (
                        <>
                          <button
                            onClick={() => setArchiveTarget(report)}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            title="Archiver"
                          >
                            <Archive size={15} color="#8A7049" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(report)}
                            className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={15} color="#ef4444" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bouton ouvrir */}
                  <button
                    onClick={() => navigate(`/suivi/${report.id}`)}
                    className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95"
                    style={{
                      background: report.locked ? "#F5F0EA" : "#003D39",
                      color: report.locked ? "#8A7049" : "#DCF21E",
                    }}
                  >
                    <span>
                      {report.locked
                        ? "Consulter le rapport"
                        : report.status === "draft"
                        ? "Débuter le rapport"
                        : "Poursuivre le rapport"}
                    </span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog suppression */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le rapport ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le rapport #{deleteTarget?.reportNumber} sera définitivement supprimé. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog archivage */}
      <AlertDialog open={!!archiveTarget} onOpenChange={() => setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver le rapport ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le rapport #{archiveTarget?.reportNumber} sera archivé. Vous pourrez le consulter dans l'onglet "Archivés".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>
              Archiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog déverrouillage */}
      <AlertDialog open={!!unlockTarget} onOpenChange={() => setUnlockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Déverrouiller le rapport ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le rapport #{unlockTarget?.reportNumber} sera déverrouillé et pourra à nouveau être modifié.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlock}
              style={{ background: "#003D39", color: "#DCF21E" }}
            >
              Déverrouiller
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
