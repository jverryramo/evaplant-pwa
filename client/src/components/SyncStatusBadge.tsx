// ============================================================
// SyncStatusBadge — Indicateur de statut de synchronisation
// Affiche le nombre de rapports en attente et la dernière synchro
// ============================================================

import { useEffect, useState } from "react";
import { Cloud, CloudOff, CloudUpload, RefreshCw } from "lucide-react";
import { getAllSuiviReports, getAllPompageTests } from "@/lib/db";

interface SyncStatus {
  pendingCount: number;
  lastSyncAt: string | null;
  isOnline: boolean;
}

export function SyncStatusBadge() {
  const [status, setStatus] = useState<SyncStatus>({
    pendingCount: 0,
    lastSyncAt: null,
    isOnline: navigator.onLine,
  });
  const [loading, setLoading] = useState(true);

  const refreshStatus = async () => {
    try {
      const [suiviReports, pompageTests] = await Promise.all([
        getAllSuiviReports(),
        getAllPompageTests(),
      ]);

      const pendingSuivi = suiviReports.filter(
        (r) => r.status === "completed" && !r.syncedToSheets
      );
      const pendingPompage = pompageTests.filter(
        (t) => t.status === "completed" && !t.syncedToSheets
      );

      // Trouver la date de la dernière synchro réussie
      const allSynced = [
        ...suiviReports.filter((r) => r.syncedToSheets && r.updatedAt),
        ...pompageTests.filter((t) => t.syncedToSheets && t.updatedAt),
      ];
      const lastSync = allSynced.length > 0
        ? allSynced.reduce((latest, r) => {
            const d = r.updatedAt ?? "";
            return d > latest ? d : latest;
          }, "")
        : null;

      setStatus({
        pendingCount: pendingSuivi.length + pendingPompage.length,
        lastSyncAt: lastSync || null,
        isOnline: navigator.onLine,
      });
    } catch {
      // Silencieux
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus();

    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(refreshStatus, 30_000);

    const handleOnline = () => setStatus((s) => ({ ...s, isOnline: true }));
    const handleOffline = () => setStatus((s) => ({ ...s, isOnline: false }));
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (loading) return null;

  // Formater la date de dernière synchro
  const formatLastSync = (iso: string | null): string => {
    if (!iso) return "Jamais synchronisé";
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffH < 24) return `Il y a ${diffH}h`;
    if (diffD === 1) return "Hier";
    return `Il y a ${diffD} jours`;
  };

  // Déterminer l'état visuel
  const hasPending = status.pendingCount > 0;
  const isOffline = !status.isOnline;

  let bgColor: string;
  let textColor: string;
  let borderColor: string;
  let Icon: React.ElementType;
  let label: string;

  if (isOffline) {
    bgColor = "#FEF3C7";
    textColor = "#92400E";
    borderColor = "#FCD34D";
    Icon = CloudOff;
    label = hasPending
      ? `Hors ligne — ${status.pendingCount} en attente`
      : "Hors ligne";
  } else if (hasPending) {
    bgColor = "#FEF3C7";
    textColor = "#92400E";
    borderColor = "#FCD34D";
    Icon = RefreshCw;
    label = `${status.pendingCount} rapport${status.pendingCount > 1 ? "s" : ""} en attente`;
  } else {
    bgColor = "#ECFDF5";
    textColor = "#065F46";
    borderColor = "#6EE7B7";
    Icon = CloudUpload;
    label = formatLastSync(status.lastSyncAt);
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
      style={{
        background: bgColor,
        color: textColor,
        border: `1px solid ${borderColor}`,
      }}
      title="Statut de synchronisation Google Sheets"
    >
      <Icon size={12} className={hasPending && !isOffline ? "animate-spin" : ""} />
      <span>{label}</span>
    </div>
  );
}
