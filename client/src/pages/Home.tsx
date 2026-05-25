// ============================================================
// Home — Écran d'accueil
// Sélection Client / Site / Système
// Design: Minimalisme Structuré Ramo
// ============================================================

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronDown, ArrowRight, Leaf } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import Layout from "@/components/Layout";

const RAMO_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663321843879/nHzuf69SdfQPLwa7tmLvVH/Logo-Ramo-Foret_316edc68.webp";

export default function Home() {
  const [, navigate] = useLocation();
  const { activeContext, setActiveContext, config, loading } = useApp();

  const [client, setClient] = useState(activeContext?.client ?? "");
  const [site, setSite] = useState(activeContext?.site ?? "");
  const [systeme, setSysteme] = useState(activeContext?.systeme ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (activeContext) {
      setClient(activeContext.client);
      setSite(activeContext.site);
      setSysteme(activeContext.systeme);
    }
  }, [activeContext]);

  const handleContinue = () => {
    if (!client || !site || !systeme) {
      setError("Veuillez sélectionner un client, un site et un système.");
      return;
    }
    setError("");
    setActiveContext({ client, site, systeme });
    navigate("/operations");
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "#003D39" }}>
        <div className="text-center">
          <Leaf size={40} color="#DCF21E" className="mx-auto mb-3 animate-pulse" />
          <div className="text-white text-sm font-medium">Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#003D39" }}>
      {/* En-tête splash */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
        {/* Logo Ramo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-5">
            <img
              src={RAMO_LOGO}
              alt="Ramo"
              className="h-16 w-auto"
              style={{ filter: "brightness(0) invert(1) sepia(1) saturate(3) hue-rotate(50deg)" }}
            />
          </div>
          <div
            className="text-sm font-medium opacity-70"
            style={{ color: "#F5F0EA" }}
          >
            Evaplant — Opérations Terrain
          </div>
        </div>

        {/* Carte de sélection */}
        <div
          className="w-full max-w-sm rounded-2xl p-6 shadow-xl"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <h2
            className="text-base font-semibold mb-5"
            style={{ color: "#F5F0EA" }}
          >
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
                  onChange={(e) => setClient(e.target.value)}
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
                  {config.clients.map((c) => (
                    <option key={c} value={c} style={{ background: "#003D39", color: "#F5F0EA" }}>
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  color="#DCF21E"
                />
              </div>
            </div>

            {/* Site */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#DCF21E" }}>
                Site
              </label>
              <div className="relative">
                <select
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                  className="w-full appearance-none rounded-xl px-4 py-3 pr-10 text-sm font-medium focus:outline-none"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    color: site ? "#F5F0EA" : "rgba(245,240,234,0.5)",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  <option value="" style={{ background: "#003D39", color: "#F5F0EA" }}>
                    Sélectionner un site...
                  </option>
                  {config.sites.map((s) => (
                    <option key={s} value={s} style={{ background: "#003D39", color: "#F5F0EA" }}>
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  color="#DCF21E"
                />
              </div>
            </div>

            {/* Système */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#DCF21E" }}>
                Système
              </label>
              <div className="relative">
                <select
                  value={systeme}
                  onChange={(e) => setSysteme(e.target.value)}
                  className="w-full appearance-none rounded-xl px-4 py-3 pr-10 text-sm font-medium focus:outline-none"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    color: systeme ? "#F5F0EA" : "rgba(245,240,234,0.5)",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  <option value="" style={{ background: "#003D39", color: "#F5F0EA" }}>
                    Sélectionner un système...
                  </option>
                  {config.systemes.map((s) => (
                    <option key={s} value={s} style={{ background: "#003D39", color: "#F5F0EA" }}>
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  color="#DCF21E"
                />
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
          Ramo Environnement — Application terrain v1.0
        </p>
      </div>
    </div>
  );
}
