// ============================================================
// UpdateBanner — Rechargement automatique quand SW mis à jour
// skipWaiting + clientsClaim force l'activation immédiate
// On recharge la page dès que le nouveau SW prend le contrôle
// ============================================================

import { useEffect } from "react";

export function UpdateBanner() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Quand le SW prend le contrôle (après skipWaiting + clientsClaim),
    // recharger la page pour charger le nouveau code
    const handleControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  return null;
}
