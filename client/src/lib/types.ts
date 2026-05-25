// ============================================================
// TYPES — Evaplant Opérations Terrain
// Modèle de données complet pour IndexedDB
// ============================================================

export type ReportStatus = "draft" | "in_progress" | "completed" | "archived";

export interface AnnotatedPhoto {
  id: string;
  dataUrl: string; // base64
  caption: string;
  takenAt: string; // ISO
}

export interface PersonEntry {
  id: string;
  name: string;
  titleRole: string;
  heureArrivee: string;
  heureDepart: string;
}

export interface ClientContact {
  id: string;
  name: string;
  titre: string;
  email: string;
  telephone: string;
  clientName: string;
}

// ============================================================
// CONFIGURATION (Écran d'accueil)
// ============================================================

export interface AppConfig {
  clients: string[];
  sites: string[];
  systemes: string[];
}

export const DEFAULT_CONFIG: AppConfig = {
  clients: ["WM", "RIGDCC", "RRGMRP", "GFL"],
  sites: [
    "P25-19_Saint-Nicéphore",
    "P25-20_Sainte-Sophie Sud",
    "P25-20_Sainte-Sophie Nord",
    "P25-23_Neuville",
    "P25-21_Saint-Lambert-de-Lauzon",
    "P25-39_MooseCreek",
  ],
  systemes: ["Evaplant", "Autre"],
};

// ============================================================
// RAPPORT DE SUIVI TERRAIN
// ============================================================

export interface SuiviConfig {
  nombreZones: number;
  nombreTensiometres: number; // toujours = 2 × nombreZones
  createdBy: string;
  date: string;
}

// Type commun pour les réponses Oui/Non/N-A
export type YesNoNA = "oui" | "non" | "na" | "";

// Section 1.1.1.3 — Poste de pompage
export interface PostePompage {
  inspectionVisuelle: boolean;
  alarmesVFD: YesNoNA;
  descriptionAlarmes: string;
  alarmesAcquittees: YesNoNA;
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.1.1.4 — Poste de contrôle
export interface PosteControle {
  inspectionVisuelle: boolean;
  etatEquipements: string;
  presenceFuites: YesNoNA;
  alarmesAcquittees: YesNoNA;
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.1.1.5 — Interface PLC Alarmes
export interface PLCAlarmes {
  alarmesPresentes: YesNoNA;
  descriptionAlarmes: string;
  alarmesAcquittees: YesNoNA;
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.1.1.6 — Interface PLC Tensiomètres (dynamique)
export interface TensiometreReading {
  zone: number;
  tensiometre: number; // numéro global
  valeur: string; // kPa
}

export interface PLCTensiometres {
  lectures: TensiometreReading[]; // générées dynamiquement
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.1.1.7 — Débitmètre
export interface Debitmetre {
  messagesErreur: YesNoNA;
  volumeCumulActuel: string; // m³
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.1.1.8 — Pluviomètre
export interface Pluviometre {
  inspectionVisuelle: boolean;
  nettoyageRequis: YesNoNA;
  nettoyageEffectue: boolean;
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.1.1.9 — Entretien Tensiomètre (par tensiomètre, dynamique)
export interface EntretienTensiometre {
  tensiometreNum: number;
  zoneNum: number;
  inspectionVisuelle: boolean;
  tensionManometre: string; // kPa
  tensionPLC: string; // kPa
  algicideRequis: YesNoNA;
  algicideEffectue: boolean;
  pompage: boolean;
  presenceBulles: YesNoNA;
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.1.1.10 — Vanne d'irrigation (par zone, dynamique)
export interface VanneIrrigation {
  zoneNum: number;
  ouvertureFermetureManuelle: boolean;
  inspectionOperation: boolean;
  fonctionne: YesNoNA;
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.1.1.11 — Vanne de lavage (par zone, dynamique)
export interface VanneLavage {
  zoneNum: number;
  ouvertureFermetureManuelle: boolean;
  inspectionOperation: boolean;
  fonctionne: YesNoNA;
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.1.1.12 — Santé générale des saules
export interface SanteSaules {
  score: 1 | 2 | 3 | null;
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.1.1.13 — Inspection pourtour plantation
export interface InspectionPourtour {
  ruissellement: YesNoNA;
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.1.1.14 — Autres entretiens
export interface AutresEntretiens {
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.1.1.15 — Photos rapports mensuels
export interface PhotosMensuelles {
  photos: AnnotatedPhoto[];
}

// Section 1.1.1.16 — Présence au site (Employés Ramo)
export interface PresenceRamo {
  employes: PersonEntry[];
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.1.1.17 — Présence au site (Autres intervenants)
export interface PresenceAutres {
  intervenants: PersonEntry[];
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Rapport de suivi complet
export interface SuiviReport {
  id: string;
  reportNumber: string; // ex: "0001"
  status: ReportStatus;
  locked: boolean;
  context: {
    client: string;
    site: string;
    systeme: string;
  };
  config: SuiviConfig;
  // Étapes
  postePompage: PostePompage;
  posteControle: PosteControle;
  plcAlarmes: PLCAlarmes;
  plcTensiometres: PLCTensiometres;
  debitmetre: Debitmetre;
  pluviometre: Pluviometre;
  entretiensTensiometres: EntretienTensiometre[]; // 1 par tensiomètre
  vannesIrrigation: VanneIrrigation[]; // 1 par zone
  vannesLavage: VanneLavage[]; // 1 par zone
  santeSaules: SanteSaules;
  inspectionPourtour: InspectionPourtour;
  autresEntretiens: AutresEntretiens;
  photosMensuelles: PhotosMensuelles;
  presenceRamo: PresenceRamo;
  presenceAutres: PresenceAutres;
  // Méta
  createdAt: string;
  updatedAt: string;
  syncedToSheets?: boolean; // true si synchronisé avec succès vers Google Sheets
}

// ============================================================
// TEST DE POMPAGE
// ============================================================

export type ModeOperation = "irrigation" | "lavage";

// Section 1.2.1 — Préparation
export interface PompagePreparation {
  controleurModeManuel: boolean;
  verificationArret: boolean;
  inspectionVisuelle: boolean;
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.2.2 — Démarrage
export interface PommageDemarrage {
  ouvertureVanneIrrigation: boolean;
  zoneIrrigation: string;
  ouvertureVanneLavage: boolean; // lavage seulement
  zoneLavage: string; // lavage seulement
  demarragePompe: boolean;
  tempsStabilisation: string; // mm:ss
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.2.3 — Poste de pompage
export interface PompagePoste {
  inspectionVisuelle: boolean;
  anomaliesObservees: YesNoNA;
  descriptionAnomalies: string;
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.2.4 — Filtre en Y
export interface PommageFiltreY {
  amontMesuree: string; // PSI
  amontAttendue: string;
  avalMesuree: string;
  avalAttendue: string;
  diffPression: string;
  nettoyageRequis: YesNoNA;
  nettoyageEffectue: boolean;
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.2.5 — Débitmètre
export interface PompageDebitmetre {
  avalMesuree: string; // PSI
  avalAttendue: string;
  plcPressionMesuree: string; // PSI
  plcPressionAttendue: string; // PSI — nouveau champ
  plcDebitMesure: string; // m³/h
  plcDebitAttendu: string;
  valeursConformes: YesNoNA;
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.2.6 — Gicleurs et latéraux
export interface PompageGicleurs {
  inspectionVisuelle: boolean;
  gicleursDefectueux: YesNoNA;
  gicleursRemplaces: boolean;
  fuites: YesNoNA;
  fuitesReparees: boolean;
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.2.7 — Conduite de lavage (mode lavage seulement)
export interface PompageConduiteLavage {
  inspectionVisuelle: boolean;
  pointRejet: boolean;
  fuites: YesNoNA;
  fuitesReparees: boolean;
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Section 1.2.8 — Finalisation du test
export interface PompageFinalisation {
  arretPompe: boolean;
  fermetureVanneIrrigation: boolean;
  fermetureVanneLavage: boolean;
  remiseAuto: boolean;
  commentaires: string;
  photos: AnnotatedPhoto[];
}

// Test de pompage complet
export interface PompageTest {
  id: string;
  testNumber: string; // ex: "0001"
  status: ReportStatus;
  locked: boolean;
  context: {
    client: string;
    site: string;
    systeme: string;
  };
  zoneTeste: string;
  modeOperation: ModeOperation;
  testedBy: string;
  date: string;
  // Sections
  preparation: PompagePreparation;
  demarrage: PommageDemarrage;
  poste: PompagePoste;
  filtreY: PommageFiltreY;
  debitmetre: PompageDebitmetre;
  gicleurs: PompageGicleurs;
  conduiteLavage: PompageConduiteLavage; // seulement si mode lavage
  finalisation: PompageFinalisation;
  resultatsConformes: YesNoNA;
  // Méta
  createdAt: string;
  updatedAt: string;
  syncedToSheets?: boolean; // true si synchronisé avec succès vers Google Sheets
}

// ============================================================
// HELPERS
// ============================================================

export function generateId(): string {
  const chars = "abcdef0123456789";
  const segments = [8, 4, 4, 4, 12];
  return segments
    .map((len) => {
      let s = "";
      for (let i = 0; i < len; i++) {
        s += chars[Math.floor(Math.random() * chars.length)];
      }
      return s;
    })
    .join("-");
}

export function formatReportNumber(n: number): string {
  return String(n).padStart(4, "0");
}

export function createSuiviReport(
  context: { client: string; site: string; systeme: string },
  config: SuiviConfig,
  reportNumber: string
): SuiviReport {
  const now = new Date().toISOString();
  const emptyPhotos: AnnotatedPhoto[] = [];

  // Générer les lectures tensiomètres dynamiquement (2 par zone)
  const lectures: TensiometreReading[] = [];
  for (let z = 1; z <= config.nombreZones; z++) {
    lectures.push({ zone: z, tensiometre: (z - 1) * 2 + 1, valeur: "" });
    lectures.push({ zone: z, tensiometre: (z - 1) * 2 + 2, valeur: "" });
  }

  // Générer les entretiens tensiomètres
  const entretiensTensiometres: EntretienTensiometre[] = [];
  for (let z = 1; z <= config.nombreZones; z++) {
    for (let t = 1; t <= 2; t++) {
      entretiensTensiometres.push({
        tensiometreNum: (z - 1) * 2 + t,
        zoneNum: z,
        inspectionVisuelle: false,
        tensionManometre: "",
        tensionPLC: "",
        algicideRequis: "",
        algicideEffectue: false,
        pompage: false,
        presenceBulles: "",
        commentaires: "",
        photos: [],
      });
    }
  }

  // Générer les vannes par zone
  const vannesIrrigation: VanneIrrigation[] = Array.from(
    { length: config.nombreZones },
    (_, i) => ({
      zoneNum: i + 1,
      ouvertureFermetureManuelle: false,
      inspectionOperation: false,
      fonctionne: "",
      commentaires: "",
      photos: [],
    })
  );

  const vannesLavage: VanneLavage[] = Array.from(
    { length: config.nombreZones },
    (_, i) => ({
      zoneNum: i + 1,
      ouvertureFermetureManuelle: false,
      inspectionOperation: false,
      fonctionne: "",
      commentaires: "",
      photos: [],
    })
  );

  return {
    id: generateId(),
    reportNumber,
    status: "draft",
    locked: false,
    context,
    config,
    postePompage: {
      inspectionVisuelle: false,
      alarmesVFD: "",
      descriptionAlarmes: "",
      alarmesAcquittees: "",
      commentaires: "",
      photos: emptyPhotos,
    },
    posteControle: {
      inspectionVisuelle: false,
      etatEquipements: "",
      presenceFuites: "",
      alarmesAcquittees: "",
      commentaires: "",
      photos: emptyPhotos,
    },
    plcAlarmes: {
      alarmesPresentes: "",
      descriptionAlarmes: "",
      alarmesAcquittees: "",
      commentaires: "",
      photos: emptyPhotos,
    },
    plcTensiometres: {
      lectures,
      commentaires: "",
      photos: emptyPhotos,
    },
    debitmetre: {
      messagesErreur: "",
      volumeCumulActuel: "",
      commentaires: "",
      photos: emptyPhotos,
    },
    pluviometre: {
      inspectionVisuelle: false,
      nettoyageRequis: "",
      nettoyageEffectue: false,
      commentaires: "",
      photos: emptyPhotos,
    },
    entretiensTensiometres,
    vannesIrrigation,
    vannesLavage,
    santeSaules: { score: null, commentaires: "", photos: emptyPhotos },
    inspectionPourtour: { ruissellement: "", commentaires: "", photos: emptyPhotos },
    autresEntretiens: { commentaires: "", photos: emptyPhotos },
    photosMensuelles: { photos: emptyPhotos },
    presenceRamo: { employes: [], commentaires: "", photos: emptyPhotos },
    presenceAutres: { intervenants: [], commentaires: "", photos: emptyPhotos },
    createdAt: now,
    updatedAt: now,
  };
}

export function createPompageTest(
  context: { client: string; site: string; systeme: string },
  zoneTeste: string,
  modeOperation: ModeOperation,
  testedBy: string,
  date: string,
  testNumber: string
): PompageTest {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    testNumber,
    status: "draft",
    locked: false,
    context,
    zoneTeste,
    modeOperation,
    testedBy,
    date,
    preparation: {
      controleurModeManuel: false,
      verificationArret: false,
      inspectionVisuelle: false,
      commentaires: "",
      photos: [],
    },
    demarrage: {
      ouvertureVanneIrrigation: false,
      zoneIrrigation: zoneTeste,
      ouvertureVanneLavage: false,
      zoneLavage: zoneTeste,
      demarragePompe: false,
      tempsStabilisation: "",
      commentaires: "",
      photos: [],
    },
    poste: {
      inspectionVisuelle: false,
      anomaliesObservees: "",
      descriptionAnomalies: "",
      commentaires: "",
      photos: [],
    },
    filtreY: {
      amontMesuree: "",
      amontAttendue: "",
      avalMesuree: "",
      avalAttendue: "",
      diffPression: "",
      nettoyageRequis: "",
      nettoyageEffectue: false,
      commentaires: "",
      photos: [],
    },
    debitmetre: {
      avalMesuree: "",
      avalAttendue: "",
      plcPressionMesuree: "",
      plcPressionAttendue: "",
      plcDebitMesure: "",
      plcDebitAttendu: "",
      valeursConformes: "",
      commentaires: "",
      photos: [],
    },
    gicleurs: {
      inspectionVisuelle: false,
      gicleursDefectueux: "",
      gicleursRemplaces: false,
      fuites: "",
      fuitesReparees: false,
      commentaires: "",
      photos: [],
    },
    conduiteLavage: {
      inspectionVisuelle: false,
      pointRejet: false,
      fuites: "",
      fuitesReparees: false,
      commentaires: "",
      photos: [],
    },
    finalisation: {
      arretPompe: false,
      fermetureVanneIrrigation: false,
      fermetureVanneLavage: false,
      remiseAuto: false,
      commentaires: "",
      photos: [],
    },
    resultatsConformes: "",
    createdAt: now,
    updatedAt: now,
  };
}

// Labels statuts
export const STATUS_LABELS: Record<ReportStatus, string> = {
  draft: "Brouillon",
  in_progress: "En cours",
  completed: "Finalisé",
  archived: "Archivé",
};
