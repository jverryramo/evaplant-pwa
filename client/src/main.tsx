import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

// Enregistrer le Service Worker avec prompt de mise à jour
// Sur iOS Safari, autoUpdate ne recharge pas la page — on force un confirm()
registerSW({
  onNeedRefresh() {
    if (confirm("✨ Nouvelle version d'Evaplant disponible. Recharger maintenant ?")) {
      window.location.reload();
    }
  },
  onOfflineReady() {
    console.log("[PWA] App prête en mode hors ligne");
  },
});

createRoot(document.getElementById("root")!).render(<App />);
