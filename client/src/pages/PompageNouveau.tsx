// ============================================================
// PompageNouveau — Configuration d'un nouveau test de pompage
// ============================================================

import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Calendar, User, Droplets } from "lucide-react";
import Layout from "@/components/Layout";
import { useApp } from "@/contexts/AppContext";
import { createPompageTest } from "@/lib/types";
import type { ModeOperation } from "@/lib/types";
import { getNextPompageNumber } from "@/lib/db";
import { toast } from "sonner";

export default function PompageNouveau() {
  const [, navigate] = useLocation();
  const { activeContext, savePompage } = useApp();

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [testedBy, setTestedBy] = useState("");
  const [zoneTeste, setZoneTeste] = useState("");
  const [modeOperation, setModeOperation] = useState<ModeOperation>("irrigation");
  const [loading, setLoading] = useState(false);

  if (!activeContext) {
    navigate("/");
    return null;
  }

  const handleCreate = async () => {
    if (!testedBy.trim()) {
      toast.error("Veuillez indiquer le nom de l'intervenant");
      return;
    }
    if (!zoneTeste.trim()) {
      toast.error("Veuillez indiquer la zone testée");
      return;
    }
    if (!date) {
      toast.error("Veuillez sélectionner une date");
      return;
    }

    setLoading(true);
    try {
      const testNumber = await getNextPompageNumber();
      const test = createPompageTest(
        activeContext,
        zoneTeste.trim(),
        modeOperation,
        testedBy.trim(),
        date,
        testNumber
      );
      test.status = "in_progress";
      await savePompage(test);
      toast.success(`Test #${testNumber} créé`);
      navigate(`/pompage/${test.id}`);
    } catch {
      toast.error("Erreur lors de la création du test");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Nouveau test de pompage" showBack onBack={() => navigate("/pompage")}>
      <div className="px-4 pt-6 pb-6 space-y-4">
        {/* Titre section */}
        <div className="rounded-xl p-4" style={{ background: "#003D39" }}>
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#DCF21E" }}>
            Configuration du test
          </div>
          <div className="text-sm" style={{ color: "#F5F0EA" }}>
            Définissez les paramètres du test avant de commencer.
          </div>
        </div>

        {/* Date */}
        <div className="terrain-card p-4">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A7049" }}>
            <Calendar size={12} className="inline mr-1" />
            Date du test
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none"
            style={{ borderColor: "#DDCCBF" }}
          />
        </div>

        {/* Effectué par */}
        <div className="terrain-card p-4">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A7049" }}>
            <User size={12} className="inline mr-1" />
            Test effectué par
          </label>
          <input
            type="text"
            value={testedBy}
            onChange={(e) => setTestedBy(e.target.value)}
            placeholder="Nom de l'intervenant..."
            className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none"
            style={{ borderColor: "#DDCCBF" }}
          />
        </div>

        {/* Zone testée */}
        <div className="terrain-card p-4">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A7049" }}>
            <Droplets size={12} className="inline mr-1" />
            Zone testée
          </label>
          <input
            type="text"
            value={zoneTeste}
            onChange={(e) => setZoneTeste(e.target.value)}
            placeholder="Ex: Zone 3, Zone 1-2..."
            className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none"
            style={{ borderColor: "#DDCCBF" }}
          />
        </div>

        {/* Mode d'opération */}
        <div className="terrain-card p-4">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#8A7049" }}>
            Mode d'opération
          </label>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: "irrigation" as const, label: "Irrigation", icon: "💧" },
              { value: "lavage" as const, label: "Lavage", icon: "🔄" },
            ]).map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setModeOperation(value)}
                className="flex flex-col items-center gap-2 py-4 rounded-xl font-semibold text-sm transition-all active:scale-95"
                style={{
                  background: modeOperation === value ? "#003D39" : "#F5F0EA",
                  color: modeOperation === value ? "#DCF21E" : "#374151",
                  border: `2px solid ${modeOperation === value ? "#003D39" : "#DDCCBF"}`,
                }}
              >
                <span className="text-2xl">{icon}</span>
                {label}
              </button>
            ))}
          </div>
          {modeOperation === "lavage" && (
            <div
              className="mt-3 px-3 py-2 rounded-lg text-xs"
              style={{ background: "#F5F0EA", color: "#8A7049", border: "1px solid #DDCCBF" }}
            >
              La section "Conduite de lavage" sera incluse dans le test.
            </div>
          )}
        </div>

        {/* Bouton créer */}
        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-4 font-semibold text-sm transition-all active:scale-95 disabled:opacity-60"
          style={{ background: "#003D39", color: "#DCF21E" }}
        >
          {loading ? "Création en cours..." : "Débuter le test de pompage"}
          <ArrowRight size={16} />
        </button>
      </div>
    </Layout>
  );
}
