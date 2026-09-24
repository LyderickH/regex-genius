import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function usePwa() {
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return !window.navigator.onLine;
    }
    return false;
  });

  const [canInstall, setCanInstall] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Détection du statut en ligne / hors-ligne
    const handleOnline = () => {
      setIsOffline(false);
      toast.success("Connexion Internet rétablie", { id: "network-status" });
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.info("✈️ Mode avion / Hors-ligne détecté : l'application fonctionne à 100% sans aucun réseau !", {
        id: "network-status",
        duration: 8000,
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 2. Détection si déjà installé en PWA (Standalone)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
    }

    // 3. Capture de l'événement d'installation PWA
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      deferredPrompt = e;
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      deferredPrompt = null;
      setCanInstall(false);
      setIsInstalled(true);
      toast.success("Regex Genius a été installé sur votre ordinateur !", { id: "pwa-installed" });
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // 4. Enregistrement du Service Worker
    if ("serviceWorker" in navigator && process.env.NODE_ENV !== "test") {
      const basePath = import.meta.env.BASE_URL || "/";
      const swUrl = `${basePath.endsWith("/") ? basePath : basePath + "/"}sw.js`;
      navigator.serviceWorker
        .register(swUrl)
        .then((reg) => {
          // Mise à jour automatique si un nouveau SW est trouvé
          reg.onupdatefound = () => {
            const installing = reg.installing;
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === "installed" && navigator.serviceWorker.controller) {
                  toast.info("Nouvelle version de Regex Genius disponible !", {
                    id: "pwa-update",
                    duration: 10000,
                    action: {
                      label: "Mettre à jour",
                      onClick: () => window.location.reload(),
                    },
                  });
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn("PWA Service Worker registration warning:", err);
        });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installApp = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      // Si l'événement natif n'est pas disponible (ex. Firefox ou déjà installé)
      toast.info(
        "Pour installer l'application : cliquez sur l'icône d'installation dans la barre d'adresse de votre navigateur (Chrome/Edge/Brave).",
        { duration: 6000 },
      );
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        deferredPrompt = null;
        setCanInstall(false);
        setIsInstalled(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  return {
    isOffline,
    canInstall,
    isInstalled,
    installApp,
  };
}
