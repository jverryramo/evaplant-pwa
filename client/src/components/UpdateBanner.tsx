// ============================================================
// UpdateBanner — Bannière de mise à jour PWA
// S'affiche quand une nouvelle version est disponible
// ============================================================

import { useState, useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw } from "lucide-react";

export function UpdateBanner() {
  const [show, setShow] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh() {
      setShow(true);
    },
    onOfflineReady() {
      console.log("[PWA] App prête en mode hors ligne");
    },
  });

  useEffect(() => {
    if (needRefresh) setShow(true);
  }, [needRefresh]);

  if (!show) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-3"
      style={{
        background: "#003D39",
        borderBottom: "3px solid #DCF21E",
      }}
    >
      <div className="flex items-center gap-2">
        <RefreshCw size={16} color="#DCF21E" />
        <span className="text-sm font-semibold" style={{ color: "#F5F0EA" }}>
          Nouvelle version disponible
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShow(false)}
          className="text-xs px-2 py-1 rounded-lg"
          style={{ color: "#8A7049" }}
        >
          Plus tard
        </button>
        <button
          onClick={() => updateServiceWorker(true)}
          className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
          style={{ background: "#DCF21E", color: "#003D39" }}
        >
          Mettre à jour
        </button>
      </div>
    </div>
  );
}
