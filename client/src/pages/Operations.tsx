// ============================================================
// Operations — Menu principal des opérations Evaplant
// ============================================================

import { useLocation } from "wouter";
import { FileText, Droplets, Users, ChevronRight } from "lucide-react";
import Layout from "@/components/Layout";
import { useApp } from "@/contexts/AppContext";

const MODULES = [
  {
    id: "suivi",
    path: "/suivi",
    label: "Rapports de suivi des travaux de terrain",
    description: "Créer, poursuivre ou consulter des rapports de suivi",
    icon: FileText,
    color: "#003D39",
    accent: "#DCF21E",
    number: "1.1",
  },
  {
    id: "pompage",
    path: "/pompage",
    label: "Tests de pompage",
    description: "Gérer les tests de pompage et consulter l'historique",
    icon: Droplets,
    color: "#003D39",
    accent: "#DCF21E",
    number: "1.2",
  },
  {
    id: "contacts",
    path: "/contacts",
    label: "Contacts client",
    description: "Répertoire des contacts associés au site",
    icon: Users,
    color: "#8A7049",
    accent: "#DDCCBF",
    number: "1.3",
  },
];

export default function Operations() {
  const [, navigate] = useLocation();
  const { activeContext } = useApp();

  if (!activeContext) {
    navigate("/");
    return null;
  }

  return (
    <Layout title="Opérations Evaplant">
      <div className="px-4 pt-6 pb-4">
        <p className="text-sm text-gray-500 mb-6">
          Sélectionnez un module pour commencer.
        </p>

        <div className="space-y-3">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => navigate(mod.path)}
                className="w-full terrain-card p-4 flex items-center gap-4 transition-all active:scale-[0.98] hover:shadow-md text-left"
              >
                {/* Numéro de section */}
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xs"
                  style={{ background: mod.color, color: mod.accent }}
                >
                  {mod.number}
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-900 leading-snug">
                    {mod.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 leading-snug">
                    {mod.description}
                  </div>
                </div>

                <ChevronRight size={18} color="#DDCCBF" className="flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
