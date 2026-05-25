// ============================================================
// Layout — Structure principale de l'application
// Header Ramo + Navigation bas + Zone de contenu
// Design: Minimalisme Structuré (terrain professionnel)
// ============================================================

import { useLocation, Link } from "wouter";
import { Home, FileText, Droplets, Users, Settings, ChevronLeft, RefreshCw, WifiOff, CloudOff, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { useState, useEffect } from "react";
import { SyncStatusBadge } from "./SyncStatusBadge";

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  return isOnline;
}

const RAMO_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663321843879/nHzuf69SdfQPLwa7tmLvVH/Logo-Ramo-Foret_316edc68.webp";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  hideNav?: boolean;
  headerRight?: React.ReactNode;
}

const NAV_ITEMS = [
  { path: "/", label: "Accueil", icon: Home },
  { path: "/suivi", label: "Suivi", icon: FileText },
  { path: "/pompage", label: "Pompage", icon: Droplets },
  { path: "/contacts", label: "Contacts", icon: Users },
  { path: "/parametres", label: "Paramètres", icon: Settings },
];

export default function Layout({
  children,
  title,
  showBack = false,
  onBack,
  hideNav = false,
  headerRight,
}: LayoutProps) {
  const [location, navigate] = useLocation();
  const { activeContext, syncStatus } = useApp();
  const isOnline = useOnlineStatus();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  return (
    <div className="flex flex-col min-h-screen max-w-2xl mx-auto" style={{ background: "#F5F0EA" }}>
      {/* Header Ramo */}
      <header
        className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3 shadow-md"
        style={{ background: "#003D39", minHeight: 56 }}
      >
        {showBack && (
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
            style={{ color: "#DCF21E" }}
            aria-label="Retour"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        <div className="flex-1 min-w-0">
          {title ? (
            <h1
              className="font-semibold text-base leading-tight truncate"
              style={{ color: "#F5F0EA", fontFamily: "'DM Sans', sans-serif" }}
            >
              {title}
            </h1>
          ) : (
            <div>
              <div
                className="font-bold text-base leading-tight"
                style={{ color: "#DCF21E", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.02em" }}
              >
                <img src={RAMO_LOGO} alt="Ramo" className="h-6 w-auto" style={{ filter: "brightness(0) invert(1) sepia(1) saturate(3) hue-rotate(50deg)" }} />
              </div>
              <div
                className="text-xs leading-tight opacity-80"
                style={{ color: "#F5F0EA" }}
              >
                Evaplant — Opérations Terrain
              </div>
            </div>
          )}
        </div>

        {/* Contexte actif */}
        {activeContext && !title && (
          <div className="text-right hidden sm:block">
            <div className="text-xs font-medium" style={{ color: "#DCF21E" }}>
              {activeContext.client}
            </div>
            <div className="text-xs opacity-70" style={{ color: "#F5F0EA" }}>
              {activeContext.site}
            </div>
          </div>
        )}

        {/* Bouton changer de contexte (visible quand contexte actif) */}
        {activeContext && (
          <Link href="/">
            <button
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
              style={{ color: "rgba(220,242,30,0.7)" }}
              title="Changer de client / site / système"
            >
              <RefreshCw size={16} />
            </button>
          </Link>
        )}

        {headerRight && (
          <div style={{ color: "#DCF21E" }}>{headerRight}</div>
        )}
      </header>

      {/* Bandeau hors ligne */}
      {!isOnline && (
        <div
          className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold"
          style={{ background: "#8A7049", color: "#DDCCBF" }}
        >
          <WifiOff size={13} />
          <span>Hors ligne — la synchronisation Google Sheets sera effectuée au retour de la connectivité</span>
        </div>
      )}

      {/* Bandeau synchronisation Google Sheets */}
      {isOnline && syncStatus === "syncing" && (
        <div
          className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs"
          style={{ background: "#004d47", color: "#DCF21E" }}
        >
          <Cloud size={12} className="animate-pulse" />
          <span>Synchronisation des rapports en cours…</span>
        </div>
      )}
      {isOnline && syncStatus === "error" && (
        <div
          className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs"
          style={{ background: "#5c3a1e", color: "#DDCCBF" }}
        >
          <CloudOff size={12} />
          <span>Synchronisation impossible — les données locales sont à jour</span>
        </div>
      )}

      {/* Contexte actif — bandeau sous le header (cliquable pour changer) */}
      {activeContext && (
        <div
          className="px-4 py-1.5 flex items-center gap-2 text-xs font-medium"
          style={{ background: "#004d47", color: "#DCF21E" }}
        >
          <Link href="/" className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" title="Toucher pour changer de contexte">
            <span>{activeContext.client}</span>
            <span className="opacity-50">·</span>
            <span className="opacity-80 text-white truncate">{activeContext.site}</span>
            <span className="opacity-50">·</span>
            <span className="opacity-70 text-white">{activeContext.systeme}</span>
            <RefreshCw size={10} className="opacity-50 flex-shrink-0" />
          </Link>
          <div className="flex-shrink-0">
            <SyncStatusBadge />
          </div>
        </div>
      )}

      {/* Contenu principal */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Navigation bas */}
      {!hideNav && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 bottom-nav"
          style={{ maxWidth: "672px", margin: "0 auto", left: "50%", transform: "translateX(-50%)", width: "100%" }}
        >
          <div className="flex items-center justify-around px-2 py-1">
            {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
              const isActive = path === "/"
                ? location === "/"
                : location.startsWith(path);
              return (
                <Link key={path} href={path}>
                  <button
                    className={cn(
                      "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[56px]",
                      isActive
                        ? "text-[#003D39]"
                        : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-lg transition-all",
                        isActive ? "bg-[#DCF21E]" : "bg-transparent"
                      )}
                    >
                      <Icon
                        size={18}
                        strokeWidth={isActive ? 2.5 : 1.8}
                        color={isActive ? "#003D39" : "#9ca3af"}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-medium leading-none",
                        isActive ? "text-[#003D39]" : "text-gray-400"
                      )}
                    >
                      {label}
                    </span>
                  </button>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
