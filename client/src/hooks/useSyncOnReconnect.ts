// ============================================================
// useSyncOnReconnect — Synchronisation automatique au retour d'internet
// Détecte la reconnexion et re-tente la synchro des rapports non synchronisés
// ============================================================

import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { getAllSuiviReports, getAllPompageTests } from "../lib/db";
import { autoAddSuiviToExcel, autoAddPompageToExcel } from "../lib/excelExport";

export function useSyncOnReconnect() {
  const isSyncing = useRef(false);

  const syncPendingReports = useCallback(async () => {
    if (isSyncing.current) return;
    if (!navigator.onLine) return;

    isSyncing.current = true;

    try {
      // Récupérer tous les rapports complétés non synchronisés
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

      const totalPending = pendingSuivi.length + pendingPompage.length;

      if (totalPending === 0) {
        isSyncing.current = false;
        return;
      }

      console.log(
        `[SyncOnReconnect] ${totalPending} rapport(s) en attente de synchronisation`
      );

      toast.info(
        `Connexion rétablie — synchronisation de ${totalPending} rapport(s) en attente…`,
        { duration: 4000 }
      );

      let successCount = 0;
      let errorCount = 0;

      // Synchroniser les rapports de suivi en attente
      for (const report of pendingSuivi) {
        try {
          const { sheetsOk } = await autoAddSuiviToExcel(report);
          if (sheetsOk) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          console.error(`[SyncOnReconnect] Erreur suivi ${report.reportNumber}:`, err);
          errorCount++;
        }
      }

      // Synchroniser les tests de pompage en attente
      for (const test of pendingPompage) {
        try {
          const { sheetsOk } = await autoAddPompageToExcel(test);
          if (sheetsOk) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          console.error(`[SyncOnReconnect] Erreur pompage ${test.testNumber}:`, err);
          errorCount++;
        }
      }

      // Afficher le résultat
      if (successCount > 0 && errorCount === 0) {
        toast.success(
          `✓ ${successCount} rapport(s) synchronisé(s) vers Google Sheets`,
          { duration: 6000 }
        );
      } else if (successCount > 0 && errorCount > 0) {
        toast.warning(
          `${successCount} rapport(s) synchronisé(s), ${errorCount} échec(s)`,
          { duration: 6000 }
        );
      } else if (errorCount > 0) {
        toast.error(
          `Échec de synchronisation pour ${errorCount} rapport(s)`,
          { duration: 6000 }
        );
      }
    } catch (err) {
      console.error("[SyncOnReconnect] Erreur générale:", err);
    } finally {
      isSyncing.current = false;
    }
  }, []);

  useEffect(() => {
    // Tenter une synchro au montage si on est en ligne
    if (navigator.onLine) {
      // Délai court pour laisser l'app s'initialiser
      const timer = setTimeout(() => {
        syncPendingReports();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [syncPendingReports]);

  useEffect(() => {
    // Écouter les événements de reconnexion
    const handleOnline = () => {
      console.log("[SyncOnReconnect] Connexion rétablie — déclenchement synchro");
      // Petit délai pour s'assurer que la connexion est stable
      setTimeout(() => {
        syncPendingReports();
      }, 1500);
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [syncPendingReports]);
}
