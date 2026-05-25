// ============================================================
// SuiviNouveau — Configuration d'un nouveau rapport de suivi
// Étape 1 : Nombre de zones, tensiomètres, date, créé par
// ============================================================

import { useState } from "react";
import { useLocation } from "wouter";
import { Minus, Plus, Calendar, User, ArrowRight } from "lucide-react";
import Layout from "@/components/Layout";
import { useApp } from "@/contexts/AppContext";
import { createSuiviReport } from "@/lib/types";
import { getNextSuiviNumber as dbGetNextSuiviNumber } from "@/lib/db";
import { toast } from "sonner";

function NumericStepper({
  label,
  value,
  onChange,
  min = 1,
  max = 20,
  description,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  description?: string;
}) {
  return (
    <div className="terrain-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="font-semibold text-sm text-gray-900">{label}</div>
          {description && (
            <div className="text-xs text-gray-500 mt-0.5">{description}</div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onChange(Math.max(min, value - 1))}
            disabled={value <= min}
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all active:scale-90 disabled:opacity-30"
            style={{ background: "#DDCCBF", color: "#003D39" }}
          >
            <Minus size={16} />
          </button>
          <span
            className="w-10 text-center font-bold text-xl"
            style={{ color: "#003D39", fontFamily: "'DM Sans', sans-serif" }}
          >
            {value}
          </span>
          <button
            onClick={() => onChange(Math.min(max, value + 1))}
            disabled={value >= max}
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all active:scale-90 disabled:opacity-30"
            style={{ background: "#003D39", color: "#DCF21E" }}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuiviNouveau() {
  const [, navigate] = useLocation();
  const { activeContext, saveSuivi } = useApp();

  const today = new Date().toISOString().split("T")[0];
  const [nombreZones, setNombreZones] = useState(4);
  const [date, setDate] = useState(today);
  const [createdBy, setCreatedBy] = useState("");
  const [loading, setLoading] = useState(false);

  const nombreTensiometres = nombreZones * 2;

  if (!activeContext) {
    navigate("/");
    return null;
  }

  const handleCreate = async () => {
    if (!createdBy.trim()) {
      toast.error("Veuillez indiquer le nom de l'intervenant");
      return;
    }
    if (!date) {
      toast.error("Veuillez sélectionner une date");
      return;
    }

    setLoading(true);
    try {
      const reportNumber = await dbGetNextSuiviNumber();
      const report = createSuiviReport(
        activeContext,
        {
          nombreZones,
          nombreTensiometres,
          createdBy: createdBy.trim(),
          date,
        },
        reportNumber
      );
      report.status = "in_progress";
      await saveSuivi(report);
      toast.success(`Rapport #${reportNumber} créé`);
      navigate(`/suivi/${report.id}`);
    } catch (e) {
      toast.error("Erreur lors de la création du rapport");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Nouveau rapport de suivi" showBack onBack={() => navigate("/suivi")}>
      <div className="px-4 pt-6 pb-6 space-y-4">
        {/* Titre section */}
        <div
          className="rounded-xl p-4"
          style={{ background: "#003D39" }}
        >
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#DCF21E" }}>
            Étape 1 — Configuration
          </div>
          <div className="text-sm" style={{ color: "#F5F0EA" }}>
            Définissez la structure du rapport avant de commencer les inspections.
          </div>
        </div>

        {/* Date */}
        <div className="terrain-card p-4">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A7049" }}>
            <Calendar size={12} className="inline mr-1" />
            Date des travaux
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:ring-2"
            style={{ borderColor: "#DDCCBF", focusRingColor: "#003D39" } as React.CSSProperties}
          />
        </div>

        {/* Créé par */}
        <div className="terrain-card p-4">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A7049" }}>
            <User size={12} className="inline mr-1" />
            Rapport créé par
          </label>
          <input
            type="text"
            value={createdBy}
            onChange={(e) => setCreatedBy(e.target.value)}
            placeholder="Nom de l'intervenant..."
            className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:ring-2"
            style={{ borderColor: "#DDCCBF" }}
          />
        </div>

        {/* Nombre de zones */}
        <NumericStepper
          label="(1.1.1.1) Nombre de zones"
          value={nombreZones}
          onChange={setNombreZones}
          min={1}
          max={20}
          description="Génère 1 page vanne irrigation + 1 page vanne lavage par zone"
        />

        {/* Nombre de tensiomètres (calculé automatiquement) */}
        <div className="terrain-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm text-gray-900">
                (1.1.1.2) Nombre de tensiomètres
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Calculé automatiquement (2 par zone)
              </div>
            </div>
            <div
              className="w-16 h-10 rounded-xl flex items-center justify-center font-bold text-xl"
              style={{ background: "#F5F0EA", color: "#003D39", border: "2px solid #DDCCBF" }}
            >
              {nombreTensiometres}
            </div>
          </div>
        </div>

        {/* Résumé de la structure */}
        <div
          className="rounded-xl p-4"
          style={{ background: "#F5F0EA", border: "1px solid #DDCCBF" }}
        >
          <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#8A7049" }}>
            Structure du rapport
          </div>
          <div className="space-y-1.5 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Pages fixes (pompage, contrôle, PLC, etc.)</span>
              <span className="font-semibold">7</span>
            </div>
            <div className="flex justify-between">
              <span>Pages tensiomètres (entretien)</span>
              <span className="font-semibold">{nombreTensiometres}</span>
            </div>
            <div className="flex justify-between">
              <span>Pages vannes d'irrigation</span>
              <span className="font-semibold">{nombreZones}</span>
            </div>
            <div className="flex justify-between">
              <span>Pages vannes de lavage</span>
              <span className="font-semibold">{nombreZones}</span>
            </div>
            <div className="flex justify-between">
              <span>Pages finales (santé, présence, etc.)</span>
              <span className="font-semibold">6</span>
            </div>
            <div
              className="flex justify-between font-bold pt-2 border-t"
              style={{ borderColor: "#DDCCBF", color: "#003D39" }}
            >
              <span>Total des étapes</span>
              <span>{7 + nombreTensiometres + nombreZones + nombreZones + 6}</span>
            </div>
          </div>
        </div>

        {/* Bouton créer */}
        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-4 font-semibold text-sm transition-all active:scale-95 disabled:opacity-60"
          style={{ background: "#003D39", color: "#DCF21E" }}
        >
          {loading ? "Création en cours..." : "Débuter le rapport de suivi"}
          <ArrowRight size={16} />
        </button>
      </div>
    </Layout>
  );
}
