// ============================================================
// AppContext — État global de l'application Evaplant
// ============================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { SuiviReport, PompageTest, ClientContact, AppConfig } from "@/lib/types";
import {
  getAllSuiviReports,
  getAllPompageTests,
  getAllContacts,
  getConfig,
  saveConfig,
  saveSuiviReport,
  deleteSuiviReport,
  savePompageTest,
  deletePompageTest,
  saveContact,
  deleteContact,
} from "@/lib/db";
import { fetchFromGoogleSheets } from "@/lib/googleSheets";
import { buildSuiviRow, buildPompageRow } from "@/lib/excelExport";

interface ActiveContext {
  client: string;
  site: string;
  systeme: string;
}

interface AppContextType {
  // Contexte actif (sélection écran d'accueil)
  activeContext: ActiveContext | null;
  setActiveContext: (ctx: ActiveContext) => void;

  // Rapports de suivi
  suiviReports: SuiviReport[];
  saveSuivi: (report: SuiviReport) => Promise<void>;
  deleteSuivi: (id: string) => Promise<void>;

  // Tests de pompage
  pompageTests: PompageTest[];
  savePompage: (test: PompageTest) => Promise<void>;
  deletePompage: (id: string) => Promise<void>;

  // Contacts
  contacts: ClientContact[];
  saveContactEntry: (contact: ClientContact) => Promise<void>;
  deleteContactEntry: (id: string) => Promise<void>;

  // Configuration
  config: AppConfig | null;
  updateConfig: (config: AppConfig) => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;
  loading: boolean;
  // Synchronisation multi-utilisateurs
  syncStatus: "idle" | "syncing" | "done" | "error";
  syncFromSheets: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeContext, setActiveContextState] = useState<ActiveContext | null>(null);
  const [suiviReports, setSuiviReports] = useState<SuiviReport[]>([]);
  const [pompageTests, setPompageTests] = useState<PompageTest[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [suivi, pompage, ctcts, cfg] = await Promise.all([
        getAllSuiviReports(),
        getAllPompageTests(),
        getAllContacts(),
        getConfig(),
      ]);
      setSuiviReports(suivi);
      setPompageTests(pompage);
      setContacts(ctcts);
      setConfig(cfg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Synchronisation depuis Google Sheets — charge les rapports partagés au démarrage
  const syncFromSheets = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const [suiviRows, pompageRows] = await Promise.all([
        fetchFromGoogleSheets("suivi"),
        fetchFromGoogleSheets("pompage"),
      ]);

      // Fusionner les rapports suivi depuis Sheets avec les données locales
      if (suiviRows.success && suiviRows.rows.length > 0) {
        const localReports = await getAllSuiviReports();
        const localIds = new Set(localReports.map((r) => r.reportNumber));
        let added = 0;
        for (const row of suiviRows.rows) {
          const num = row["Numéro"];
          if (num && !localIds.has(num)) {
            // Créer un rapport minimal depuis les données Sheets (sans photos)
            const sheetReport: SuiviReport = {
              id: `sheets-${num}`,
              reportNumber: num,
              status: "completed" as const,
              context: {
                client: row["Client"] ?? "",
                site: row["Site"] ?? "",
                systeme: row["Système"] ?? "",
              },
              config: {
                date: row["Date"] ?? "",
                createdBy: row["Créé par"] ?? "",
                nombreZones: parseInt(row["Nb zones"] ?? "0") || 0,
                nombreTensiometres: parseInt(row["Nb tensiomètres"] ?? "0") || 0,
              },
              locked: true,
              createdAt: row["Créé le"] ?? new Date().toISOString(),
              updatedAt: row["Modifié le"] ?? new Date().toISOString(),
              // Sections vides (photos non disponibles depuis Sheets)
              postePompage: { inspectionVisuelle: false, alarmesVFD: "", descriptionAlarmes: "", alarmesAcquittees: "", commentaires: "", photos: [] },
              posteControle: { inspectionVisuelle: false, etatEquipements: "", presenceFuites: "", alarmesAcquittees: "", commentaires: "", photos: [] },
              plcAlarmes: { alarmesPresentes: "", descriptionAlarmes: "", alarmesAcquittees: "", commentaires: "", photos: [] },
              plcTensiometres: { lectures: [], commentaires: "", photos: [] },
              entretiensTensiometres: [],
              vannesIrrigation: [],
              vannesLavage: [],
              debitmetre: { messagesErreur: "", volumeCumulActuel: "", commentaires: "", photos: [] },
              pluviometre: { inspectionVisuelle: false, nettoyageRequis: "", nettoyageEffectue: false, commentaires: "", photos: [] },
              santeSaules: { score: null, commentaires: "", photos: [] },
              inspectionPourtour: { ruissellement: "", commentaires: "", photos: [] },
              autresEntretiens: { commentaires: "", photos: [] },
              photosMensuelles: { photos: [] },
              presenceRamo: { employes: [], commentaires: "", photos: [] },
              presenceAutres: { intervenants: [], commentaires: "", photos: [] },
            } satisfies SuiviReport;
            await saveSuiviReport(sheetReport);
            added++;
          }
        }
        if (added > 0) console.log(`[Sync] ${added} rapports suivi importés depuis Google Sheets`);
      }

      // Fusionner les tests de pompage depuis Sheets
      if (pompageRows.success && pompageRows.rows.length > 0) {
        const localTests = await getAllPompageTests();
        const localNums = new Set(localTests.map((t) => t.testNumber));
        let added = 0;
        for (const row of pompageRows.rows) {
          const num = row["Numéro"];
          if (num && !localNums.has(num)) {
            const sheetTest: PompageTest = {
              id: `sheets-${num}`,
              testNumber: num,
              status: "completed" as const,
              context: {
                client: row["Client"] ?? "",
                site: row["Site"] ?? "",
                systeme: row["Système"] ?? "",
              },
              date: row["Date"] ?? "",
              testedBy: row["Effectué par"] ?? "",
              zoneTeste: row["Zone testée"] ?? "",
              modeOperation: (row["Mode opération"] === "Lavage" ? "lavage" : "irrigation") as "irrigation" | "lavage",
              resultatsConformes: "",
              locked: true,
              createdAt: row["Créé le"] ?? new Date().toISOString(),
              updatedAt: row["Modifié le"] ?? new Date().toISOString(),
              preparation: { controleurModeManuel: false, verificationArret: false, inspectionVisuelle: false, commentaires: "", photos: [] },
              demarrage: { ouvertureVanneIrrigation: false, zoneIrrigation: "", ouvertureVanneLavage: false, zoneLavage: "", demarragePompe: false, tempsStabilisation: "", commentaires: "", photos: [] },
              poste: { inspectionVisuelle: false, anomaliesObservees: "", descriptionAnomalies: "", commentaires: "", photos: [] },
              filtreY: { amontMesuree: "", amontAttendue: "", avalMesuree: "", avalAttendue: "", diffPression: row["Filtre Y — Différentiel (PSI)"] ?? "", nettoyageRequis: "", nettoyageEffectue: false, commentaires: "", photos: [] },
              debitmetre: { avalMesuree: "", avalAttendue: "", plcPressionMesuree: "", plcPressionAttendue: "", plcDebitMesure: "", plcDebitAttendu: "", valeursConformes: "", commentaires: "", photos: [] },
              gicleurs: { inspectionVisuelle: false, gicleursDefectueux: "", gicleursRemplaces: false, fuites: "", fuitesReparees: false, commentaires: "", photos: [] },
              conduiteLavage: { inspectionVisuelle: false, pointRejet: false, fuites: "", fuitesReparees: false, commentaires: "", photos: [] },
              finalisation: { arretPompe: false, fermetureVanneIrrigation: false, fermetureVanneLavage: false, remiseAuto: false, commentaires: "", photos: [] },
            } satisfies PompageTest;
            await savePompageTest(sheetTest);
            added++;
          }
        }
        if (added > 0) console.log(`[Sync] ${added} tests pompage importés depuis Google Sheets`);
      }

      await refresh();
      setSyncStatus("done");
    } catch (err) {
      console.error("[Sync] Erreur synchronisation:", err);
      setSyncStatus("error");
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
    // Restaurer le contexte actif depuis sessionStorage
    const saved = sessionStorage.getItem("evaplant-active-context");
    if (saved) {
      try {
        setActiveContextState(JSON.parse(saved));
      } catch {}
    }
    // Synchronisation depuis Google Sheets au démarrage (si en ligne)
    if (navigator.onLine) {
      syncFromSheets();
    }
  }, [refresh, syncFromSheets]);

  const setActiveContext = useCallback((ctx: ActiveContext) => {
    setActiveContextState(ctx);
    sessionStorage.setItem("evaplant-active-context", JSON.stringify(ctx));
  }, []);

  const saveSuivi = useCallback(
    async (report: SuiviReport) => {
      await saveSuiviReport(report);
      await refresh();
    },
    [refresh]
  );

  const deleteSuivi = useCallback(
    async (id: string) => {
      await deleteSuiviReport(id);
      await refresh();
    },
    [refresh]
  );

  const savePompage = useCallback(
    async (test: PompageTest) => {
      await savePompageTest(test);
      await refresh();
    },
    [refresh]
  );

  const deletePompage = useCallback(
    async (id: string) => {
      await deletePompageTest(id);
      await refresh();
    },
    [refresh]
  );

  const saveContactEntry = useCallback(
    async (contact: ClientContact) => {
      await saveContact(contact);
      await refresh();
    },
    [refresh]
  );

  const deleteContactEntry = useCallback(
    async (id: string) => {
      await deleteContact(id);
      await refresh();
    },
    [refresh]
  );

  const updateConfig = useCallback(
    async (cfg: AppConfig) => {
      await saveConfig(cfg);
      setConfig(cfg);
    },
    []
  );

  return (
    <AppContext.Provider
      value={{
        activeContext,
        setActiveContext,
        suiviReports,
        saveSuivi,
        deleteSuivi,
        pompageTests,
        savePompage,
        deletePompage,
        contacts,
        saveContactEntry,
        deleteContactEntry,
        config,
        updateConfig,
        refresh,
        loading,
        syncStatus,
        syncFromSheets,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
