// ============================================================
// DB — IndexedDB via idb
// Stockage local offline pour Evaplant
// ============================================================

import { openDB, type IDBPDatabase } from "idb";
import type {
  SuiviReport,
  PompageTest,
  ClientContact,
  AppConfig,
} from "./types";
import { DEFAULT_CONFIG } from "./types";

const DB_NAME = "evaplant-db";
const DB_VERSION = 2;

export interface ExcelRow {
  id: string;         // UUID unique
  type: "suivi" | "pompage";
  reportId: string;   // ID du rapport source
  addedAt: string;    // ISO
  data: Record<string, unknown>;
}

export interface EvaplantDB {
  suivi: {
    key: string;
    value: SuiviReport;
    indexes: { "by-status": string; "by-date": string };
  };
  pompage: {
    key: string;
    value: PompageTest;
    indexes: { "by-status": string; "by-date": string };
  };
  contacts: {
    key: string;
    value: ClientContact;
    indexes: { "by-client": string };
  };
  config: {
    key: string;
    value: { id: string; data: AppConfig };
  };
  counters: {
    key: string;
    value: { id: string; value: number };
  };
  excelRows: {
    key: string;
    value: ExcelRow;
    indexes: { "by-type": string; "by-report": string };
  };
}

let dbPromise: Promise<IDBPDatabase<EvaplantDB>> | null = null;

export async function closeDB(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const storeNames = Array.from(db.objectStoreNames) as Array<keyof EvaplantDB>;
  const tx = db.transaction(storeNames, "readwrite");
  for (const name of storeNames) {
    tx.objectStore(name).clear();
  }
  await tx.done;
}

export function getDB(): Promise<IDBPDatabase<EvaplantDB>> {
  if (!dbPromise) {
    dbPromise = openDB<EvaplantDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Suivi reports
        if (!db.objectStoreNames.contains("suivi")) {
          const suivi = db.createObjectStore("suivi", { keyPath: "id" });
          suivi.createIndex("by-status", "status");
          suivi.createIndex("by-date", "config.date");
        }
        // Pompage tests
        if (!db.objectStoreNames.contains("pompage")) {
          const pompage = db.createObjectStore("pompage", { keyPath: "id" });
          pompage.createIndex("by-status", "status");
          pompage.createIndex("by-date", "date");
        }
        // Contacts
        if (!db.objectStoreNames.contains("contacts")) {
          const contacts = db.createObjectStore("contacts", { keyPath: "id" });
          contacts.createIndex("by-client", "clientName");
        }
        // Config
        if (!db.objectStoreNames.contains("config")) {
          db.createObjectStore("config", { keyPath: "id" });
        }
        // Counters
        if (!db.objectStoreNames.contains("counters")) {
          db.createObjectStore("counters", { keyPath: "id" });
        }
        // Excel rows cumulatifs
        if (!db.objectStoreNames.contains("excelRows")) {
          const excelStore = db.createObjectStore("excelRows", { keyPath: "id" });
          excelStore.createIndex("by-type", "type");
          excelStore.createIndex("by-report", "reportId");
        }
      },
    });
  }
  return dbPromise;
}

// ============================================================
// SUIVI REPORTS
// ============================================================

export async function getAllSuiviReports(): Promise<SuiviReport[]> {
  const db = await getDB();
  const all = await db.getAll("suivi");
  return all.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getSuiviReport(id: string): Promise<SuiviReport | undefined> {
  const db = await getDB();
  return db.get("suivi", id);
}

export async function saveSuiviReport(report: SuiviReport): Promise<void> {
  const db = await getDB();
  report.updatedAt = new Date().toISOString();
  await db.put("suivi", report);
}

export async function deleteSuiviReport(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("suivi", id);
}

// ============================================================
// POMPAGE TESTS
// ============================================================

export async function getAllPompageTests(): Promise<PompageTest[]> {
  const db = await getDB();
  const all = await db.getAll("pompage");
  return all.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getPompageTest(id: string): Promise<PompageTest | undefined> {
  const db = await getDB();
  return db.get("pompage", id);
}

export async function savePompageTest(test: PompageTest): Promise<void> {
  const db = await getDB();
  test.updatedAt = new Date().toISOString();
  await db.put("pompage", test);
}

export async function deletePompageTest(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("pompage", id);
}

// ============================================================
// CONTACTS
// ============================================================

export async function getAllContacts(): Promise<ClientContact[]> {
  const db = await getDB();
  return db.getAll("contacts");
}

export async function saveContact(contact: ClientContact): Promise<void> {
  const db = await getDB();
  await db.put("contacts", contact);
}

export async function deleteContact(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("contacts", id);
}

// ============================================================
// CONFIG
// ============================================================

export async function getConfig(): Promise<AppConfig> {
  const db = await getDB();
  const stored = await db.get("config", "app-config");
  return stored?.data ?? DEFAULT_CONFIG;
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const db = await getDB();
  await db.put("config", { id: "app-config", data: config });
}

// ============================================================
// COUNTERS (numérotation séquentielle SÉPARÉE par type)
// ============================================================

export async function getNextSuiviNumber(): Promise<string> {
  const db = await getDB();
  const counter = await db.get("counters", "suivi-counter");
  const next = (counter?.value ?? 0) + 1;
  await db.put("counters", { id: "suivi-counter", value: next });
  return String(next);
}

export async function getNextPompageNumber(): Promise<string> {
  const db = await getDB();
  const counter = await db.get("counters", "pompage-counter");
  const next = (counter?.value ?? 0) + 1;
  await db.put("counters", { id: "pompage-counter", value: next });
  return String(next);
}

// ============================================================
// EXCEL CUMULATIF
// ============================================================

export async function addExcelRow(row: ExcelRow): Promise<void> {
  const db = await getDB();
  await db.put("excelRows", row);
}

export async function getExcelRowsByType(type: "suivi" | "pompage"): Promise<ExcelRow[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("excelRows", "by-type", type);
  return all.sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
}

export async function hasExcelRow(reportId: string): Promise<boolean> {
  const db = await getDB();
  const rows = await db.getAllFromIndex("excelRows", "by-report", reportId);
  return rows.length > 0;
}
