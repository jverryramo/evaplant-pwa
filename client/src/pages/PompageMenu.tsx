// ============================================================
// PompageMenu — Liste et gestion des tests de pompage
// ============================================================

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Plus, Trash2, Archive, Lock, LockOpen, Droplets, ChevronRight, FileDown, RefreshCw } from "lucide-react";
import Layout from "@/components/Layout";
import { useApp } from "@/contexts/AppContext";
import type { PompageTest, ReportStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { generatePompagePDF } from "@/lib/pdfExport";
import { downloadCumulativeExcel, autoAddPompageToExcel } from "@/lib/excelExport";
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

export default function PompageMenu() {
  const [, navigate] = useLocation();
  const { pompageTests, savePompage, deletePompage, activeContext } = useApp();
  const [activeTab, setActiveTab] = useState<ReportStatus | "all">("all");
  const [modeFilter, setModeFilter] = useState<"all" | "irrigation" | "lavage">("all");
  const [deleteTarget, setDeleteTarget] = useState<PompageTest | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<PompageTest | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<PompageTest | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeContext) {
      navigate("/");
    }
  }, [activeContext, navigate]);

  if (!activeContext) {
    return null;
  }

  const filtered = pompageTests.filter((t) => {
    const matchContext =
      t.context.client === activeContext.client &&
      t.context.site === activeContext.site &&
      t.context.systeme === activeContext.systeme;
    const matchStatus = activeTab === "all" || t.status === activeTab;
    const matchMode = modeFilter === "all" || t.modeOperation === modeFilter;
    return matchContext && matchStatus && matchMode;
  });

  // Compter les tests par mode pour afficher les badges
  const contextTests = pompageTests.filter(
    (t) =>
      t.context.client === activeContext.client &&
      t.context.site === activeContext.site &&
      t.context.systeme === activeContext.systeme
  );
  const countIrrigation = contextTests.filter((t) => t.modeOperation === "irrigation").length;
  const countLavage = contextTests.filter((t) => t.modeOperation === "lavage").length;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deletePompage(deleteTarget.id);
    setDeleteTarget(null);
    toast.success("Test supprimé");
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    await savePompage({ ...archiveTarget, status: "archived" });
    setArchiveTarget(null);
    toast.success("Test archivé");
  };

  const handleLock = async (test: PompageTest) => {
    await savePompage({ ...test, locked: true });
    toast.success("Test verrouillé");
  };

  const handleUnlock = async () => {
    if (!unlockTarget) return;
    await savePompage({ ...unlockTarget, locked: false });
    setUnlockTarget(null);
    toast.success("Test déverrouillé — modifications possibles");
  };

  const handleRetrySync = async (test: PompageTest) => {
    setSyncingId(test.id);
    try {
      const { sheetsOk, sheetsError } = await autoAddPompageToExcel(test);
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

  const handleDownloadPDF = async (test: PompageTest) => {
    try {
      await generatePompagePDF(test);
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
    <Layout title="(1.2) Tests de pompage" showBack onBack={() => navigate("/operations")}>
      <div className="px-4 pt-4">
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => navigate("/pompage/nouveau")}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-sm transition-all active:scale-95"
            style={{ background: "#003D39", color: "#DCF21E" }}
          >
            <Plus size={18} />
            Nouveau test
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

        {/* Filtre par mode : Tous / Irrigation / Lavage */}
        <div className="flex gap-2 mb-3">
          {([
            { key: "all" as const, label: "Tous les modes", count: countIrrigation + countLavage },
            { key: "irrigation" as const, label: "Irrigation", count: countIrrigation },
            { key: "lavage" as const, label: "Lavage", count: countLavage },
          ]).map((m) => (
            <button
              key={m.key}
              onClick={() => setModeFilter(m.key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 border-2"
              style={{
                background: modeFilter === m.key ? "#003D39" : "transparent",
                color: modeFilter === m.key ? "#DCF21E" : "#003D39",
                borderColor: modeFilter === m.key ? "#003D39" : "#DDCCBF",
              }}
            >
              <span>{m.label}</span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: modeFilter === m.key ? "#DCF21E" : "#DDCCBF",
                  color: modeFilter === m.key ? "#003D39" : "#5a3e28",
                }}
              >
                {m.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filtre par statut */}
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

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Droplets size={40} color="#DDCCBF" className="mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">Aucun test trouvé</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((test) => (
              <div key={test.id} className="terrain-card overflow-hidden">
                <div
                  className="h-1"
                  style={{
                    background:
                      test.status === "completed"
                        ? "#003D39"
                        : test.status === "in_progress"
                        ? "#DCF21E"
                        : test.status === "archived"
                        ? "#8A7049"
                        : "#DDCCBF",
                  }}
                />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-gray-900">
                          Test #{test.testNumber}
                        </span>
                        <StatusBadge status={test.status} />
                        {test.locked && <Lock size={12} color="#8A7049" />}
                      </div>
                      <div className="text-xs text-gray-500">
                        {test.date} · {test.testedBy}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Zone {test.zoneTeste} · Mode{" "}
                        {test.modeOperation === "irrigation" ? "Irrigation" : "Lavage"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {test.status === "completed" && (
                        <button
                          onClick={() => handleDownloadPDF(test)}
                          className="p-2 rounded-lg hover:bg-gray-100"
                          title="Télécharger le PDF"
                        >
                          <FileDown size={15} color="#003D39" />
                        </button>
                      )}
                      {test.status === "completed" && (
                        <button
                          onClick={() => handleRetrySync(test)}
                          disabled={syncingId === test.id}
                          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                          title="Réessayer la synchronisation Google Sheets"
                        >
                          <RefreshCw
                            size={15}
                            color="#003D39"
                            className={syncingId === test.id ? "animate-spin" : ""}
                          />
                        </button>
                      )}
                      {/* Verrouiller / Déverrouiller */}
                      {test.status === "completed" && !test.locked && (
                        <button
                          onClick={() => handleLock(test)}
                          className="p-2 rounded-lg hover:bg-gray-100"
                          title="Verrouiller le test"
                        >
                          <Lock size={15} color="#8A7049" />
                        </button>
                      )}
                      {test.locked && (
                        <button
                          onClick={() => setUnlockTarget(test)}
                          className="p-2 rounded-lg hover:bg-gray-100"
                          title="Déverrouiller le test"
                        >
                          <LockOpen size={15} color="#003D39" />
                        </button>
                      )}
                      {!test.locked && (
                        <>
                          <button
                            onClick={() => setArchiveTarget(test)}
                            className="p-2 rounded-lg hover:bg-gray-100"
                          >
                            <Archive size={15} color="#8A7049" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(test)}
                            className="p-2 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 size={15} color="#ef4444" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/pompage/${test.id}`)}
                    className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95"
                    style={{
                      background: test.locked ? "#F5F0EA" : "#003D39",
                      color: test.locked ? "#8A7049" : "#DCF21E",
                    }}
                  >
                    <span>
                      {test.locked
                        ? "Consulter le test"
                        : test.status === "draft"
                        ? "Débuter le test"
                        : "Poursuivre le test"}
                    </span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le test ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le test #{deleteTarget?.testNumber} sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!archiveTarget} onOpenChange={() => setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver le test ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le test #{archiveTarget?.testNumber} sera archivé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archiver</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog déverrouillage */}
      <AlertDialog open={!!unlockTarget} onOpenChange={() => setUnlockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Déverrouiller le test ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le test #{unlockTarget?.testNumber} sera déverrouillé et pourra à nouveau être modifié.
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
