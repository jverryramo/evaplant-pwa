// ============================================================
// Home — Écran d'accueil
// Sélection Client / Site / Système en cascade + Code d'accès
// Design: Minimalisme Structuré Ramo
// ============================================================

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronDown, ArrowRight, Leaf, Lock } from "lucide-react";
import { useApp } from "@/contexts/AppContext";

const RAMO_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663321843879/nHzuf69SdfQPLwa7tmLvVH/Logo-Ramo-Foret_316edc68.webp";
const ACCESS_CODE = "evaplant";
const ACCESS_CODE_KEY = "evaplant_access_granted";
const ACCESS_LAST_ACTIVE_KEY = "evaplant_last_active";
const ACCESS_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 heures

function isAccessValid(): boolean {
  if (localStorage.getItem(ACCESS_CODE_KEY) !== "1") return false;
  const lastActive = parseInt(localStorage.getItem(ACCESS_LAST_ACTIVE_KEY) ?? "0", 10);
  if (!lastActive) return false;
  return Date.now() - lastActive < ACCESS_EXPIRY_MS;
}

function touchLastActive() {
  localStorage.setItem(ACCESS_LAST_ACTIVE_KEY, String(Date.now()));
}

// ── Données clients / sites en cascade ──────────────────────
const CLIENT_SITES: Record<string, string[]> = {
  WM: [
    "P2519 — Saint-Nicéphore",
    "P2520 — Sainte-Sophie Sud",
    "P2520 — Sainte-Sophie Nord",
  ],
  GFL: [
    "P2539 — MooseCreek",
  ],
  RRGMRP: [
    "P2521 — Neuville",
  ],
  RIGDCC: [
    "P2521 — Saint-Lambert-de-Lauzon",
  ],
};

const CLIENTS = Object.keys(CLIENT_SITES);
const DEFAULT_SYSTEME = "Evaplant";

export default function Home() {
  const [, navigate] = useLocation();
  const { activeContext, setActiveContext, loading } = useApp();

  // Code d'accès
  const [accessGranted, setAccessGranted] = useState(() => isAccessValid());

  // Mettre à jour le timestamp d'activité à chaque rendu
  useEffect(() => {
    if (accessGranted) touchLastActive();
  }, [accessGranted]);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");

  const handleCodeSubmit = () => {
    if (codeInput.trim().toLowerCase() === ACCESS_CODE) {
      localStorage.setItem(ACCESS_CODE_KEY, "1");
      touchLastActive();
      setAccessGranted(true);
      setCodeError("");
    } else {
      setCodeError("Code incorrect. Veuillez réessayer.");
      setCodeInput("");
    }
  };

  // Contexte de travail
  const [client, setClient] = useState(activeContext?.client ?? "");
  const [site, setSite] = useState(activeContext?.site ?? "");
  const [systeme] = useState(DEFAULT_SYSTEME);
  const [error, setError] = useState("");

  // Sites disponibles selon le client sélectionné
  const availableSites = client ? (CLIENT_SITES[client] ?? []) : [];

  // Réinitialiser le site si le client change
  // Auto-sélectionner si un seul site disponible
  const handleClientChange = (newClient: string) => {
    setClient(newClient);
    const sites = CLIENT_SITES[newClient] ?? [];
    setSite(sites.length === 1 ? sites[0] : "");
  };

  useEffect(() => {
    if (activeContext) {
      setClient(activeContext.client);
      setSite(activeContext.site);
    }
  }, [activeContext]);

  const handleContinue = () => {
    if (!client || !site) {
      setError("Veuillez sélectionner un client et un site.");
      return;
    }
    setError("");
    setActiveContext({ client, site, systeme });
    navigate("/operations");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "#003D39" }}>
        <div className="text-center">
          <Leaf size={40} color="#DCF21E" className="mx-auto mb-3 animate-pulse" />
          <div className="text-white text-sm font-medium">Chargement...</div>
        </div>
      </div>
    );
  }

  // ── Écran de code d'accès ──────────────────────────────────
  if (!accessGranted) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#003D39" }}>
        <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-5">
              <img
                src={RAMO_LOGO}
                alt="Ramo"
                className="h-16 w-auto"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </div>
            <div className="text-sm font-medium opacity-70" style={{ color: "#F5F0EA" }}>
              Evaplant — Opérations Terrain
            </div>
          </div>

          {/* Carte code d'accès */}
          <div
            className="w-full max-w-sm rounded-2xl p-6 shadow-xl"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <div className="flex items-center gap-2 mb-5">
              <Lock size={18} color="#DCF21E" />
              <h2 className="text-base font-semibold" style={{ color: "#F5F0EA" }}>
                Code d'accès requis
              </h2>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#DCF21E" }}>
                Code
              </label>
              <input
                type="password"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCodeSubmit()}
                placeholder="Entrez le code d'accès"
                className="w-full rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  color: "#F5F0EA",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
                autoFocus
                autoComplete="off"
                autoCapitalize="none"
              />
            </div>

            {codeError && (
              <p className="mt-3 text-xs font-medium" style={{ color: "#ff8a80" }}>
                {codeError}
              </p>
            )}

            <button
              onClick={handleCodeSubmit}
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-sm transition-all active:scale-95"
              style={{ background: "#DCF21E", color: "#003D39" }}
            >
              Accéder
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pb-8">
          <p className="text-xs opacity-40" style={{ color: "#F5F0EA" }}>
            Une propriété de Groupe Ramo Inc.
          </p>
        </div>
      </div>
    );
  }

  // ── Écran principal ────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#003D39" }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
        {/* Logo Ramo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-5">
            <img
              src={RAMO_LOGO}
              alt="Ramo"
              className="h-16 w-auto"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </div>
          <div className="text-sm font-medium opacity-70" style={{ color: "#F5F0EA" }}>
            Evaplant — Opérations Terrain
          </div>
        </div>

        {/* Carte de sélection */}
        <div
          className="w-full max-w-sm rounded-2xl p-6 shadow-xl"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <h2 className="text-base font-semibold mb-5" style={{ color: "#F5F0EA" }}>
            Sélectionnez votre contexte de travail
          </h2>

          <div className="space-y-4">
            {/* Client */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#DCF21E" }}>
                Client
              </label>
              <div className="relative">
                <select
                  value={client}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="w-full appearance-none rounded-xl px-4 py-3 pr-10 text-sm font-medium focus:outline-none focus:ring-2"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    color: client ? "#F5F0EA" : "rgba(245,240,234,0.5)",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  <option value="" style={{ background: "#003D39", color: "#F5F0EA" }}>
                    Sélectionner un client...
                  </option>
                  {CLIENTS.map((c) => (
                    <option key={c} value={c} style={{ background: "#003D39", color: "#F5F0EA" }}>
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" color="#DCF21E" />
              </div>
            </div>

            {/* Site — filtré selon le client */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#DCF21E" }}>
                Site
              </label>
              {availableSites.length === 1 ? (
                // Site unique : affichage fixe (pas de sélection nécessaire)
                <div
                  className="w-full rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2"
                  style={{
                    background: "rgba(220,242,30,0.1)",
                    border: "1px solid rgba(220,242,30,0.3)",
                    color: "#DCF21E",
                  }}
                >
                  <Leaf size={14} />
                  {availableSites[0]}
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    disabled={!client}
                    className="w-full appearance-none rounded-xl px-4 py-3 pr-10 text-sm font-medium focus:outline-none disabled:opacity-50"
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      color: site ? "#F5F0EA" : "rgba(245,240,234,0.5)",
                      border: "1px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    <option value="" style={{ background: "#003D39", color: "#F5F0EA" }}>
                      {client ? "Sélectionner un site..." : "Choisir un client d'abord"}
                    </option>
                    {availableSites.map((s) => (
                      <option key={s} value={s} style={{ background: "#003D39", color: "#F5F0EA" }}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" color="#DCF21E" />
                </div>
              )}
            </div>

            {/* Système — prédéfini Evaplant */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#DCF21E" }}>
                Système
              </label>
              <div
                className="w-full rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2"
                style={{
                  background: "rgba(220,242,30,0.1)",
                  border: "1px solid rgba(220,242,30,0.3)",
                  color: "#DCF21E",
                }}
              >
                <Leaf size={14} />
                {DEFAULT_SYSTEME}
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs font-medium" style={{ color: "#ff8a80" }}>
              {error}
            </p>
          )}

          <button
            onClick={handleContinue}
            className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-sm transition-all active:scale-95"
            style={{ background: "#DCF21E", color: "#003D39" }}
          >
            Accéder aux opérations
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-8">
        <p className="text-xs opacity-40" style={{ color: "#F5F0EA" }}>
          Une propriété de Groupe Ramo Inc.
        </p>
      </div>
    </div>
  );
}
