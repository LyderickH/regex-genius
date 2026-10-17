import { useEffect, useState } from "react";
import {
  Sparkles,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  DownloadCloud,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { localLLM } from "@/lib/llm/webllm-service";
import {
  AVAILABLE_MODELS,
  type LocalModelConfig,
  type ModelProgressReport,
  type RuntimeDevice,
} from "@/lib/llm/types";

interface LLMControlDialogProps {
  open: boolean;
  onClose: () => void;
}

export function LLMControlDialog({ open, onClose }: LLMControlDialogProps) {
  const [report, setReport] = useState<ModelProgressReport>({
    status: "idle",
    progressPercent: 0,
    text: "En attente",
  });
  const [device, setDevice] = useState<RuntimeDevice>("webgpu");
  const [selectedModelId, setSelectedModelId] = useState<string>(localLLM.getCurrentModelId());
  const [isCached, setIsCached] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const unsub = localLLM.subscribe(setReport);
    setDevice(localLLM.getDevice());
    setSelectedModelId(localLLM.getCurrentModelId());

    localLLM.isModelCached(localLLM.getCurrentModelId()).then(setIsCached);

    return () => unsub();
  }, [open]);

  const handleSelectModel = async (model: LocalModelConfig) => {
    setSelectedModelId(model.id);
    localLLM.setModel(model.id);
    const cached = await localLLM.isModelCached(model.id);
    setIsCached(cached);
  };

  const handlePreload = async () => {
    setIsLoading(true);
    try {
      await localLLM.load(selectedModelId);
      const cached = await localLLM.isModelCached(selectedModelId);
      setIsCached(cached);
    } catch {
      // Le rapport d'erreur est déjà notifié
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="llm-control-title"
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
      >
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary-soft text-primary">
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <h2
                id="llm-control-title"
                className="text-base font-semibold leading-tight text-foreground"
              >
                Moteur IA locale (fallback)
              </h2>
              <p className="text-sm text-muted-foreground">
                Exécuté 100% dans votre navigateur via{" "}
                {device === "webgpu" ? "WebGPU" : "WASM / CPU"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 cursor-pointer rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Badge confidentialité */}
          <div className="flex items-start gap-2.5 rounded-lg border border-success/25 bg-success-soft p-3 text-xs text-success">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <div>
              <span className="font-semibold">Confidentialité garantie :</span> Vos données,
              colonnes et exemples ne quittent jamais votre machine. Aucun appel serveur n'est
              effectué.
            </div>
          </div>

          {/* Sélection du modèle */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">
              Sélectionner un modèle
            </div>
            <div className="grid grid-cols-1 gap-2">
              {AVAILABLE_MODELS.map((model) => {
                const isSelected = model.id === selectedModelId;
                return (
                  <div
                    key={model.id}
                    onClick={() => handleSelectModel(model)}
                    className={`flex cursor-pointer items-start justify-between rounded-lg border p-3 transition ${
                      isSelected
                        ? "border-primary bg-primary-soft"
                        : "border-border bg-surface-2/40 hover:bg-surface-2"
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-foreground">{model.name}</span>
                        <span className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                          {model.size}
                        </span>
                        {model.id === "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC" && (
                          <span className="rounded-md border border-success/25 bg-success-soft px-1.5 py-0.5 text-[11px] font-semibold text-success">
                            Recommandé par défaut
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{model.description}</p>
                    </div>
                    <div className="shrink-0 pt-0.5">
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => handleSelectModel(model)}
                        className="accent-primary"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Statut actuel et barre de progression */}
          <div className="space-y-2.5 rounded-lg border border-border bg-surface-2 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                <Cpu className="size-3.5 text-muted-foreground" />
                <span>Statut :</span>
                <span
                  className={
                    report.status === "ready"
                      ? "text-success"
                      : report.status === "downloading" || report.status === "loading"
                        ? "text-primary"
                        : report.status === "error"
                          ? "text-destructive"
                          : "text-muted-foreground"
                  }
                >
                  {report.status === "ready"
                    ? "Modèle chargé en mémoire"
                    : report.status === "downloading"
                      ? "Téléchargement en cache..."
                      : report.status === "loading"
                        ? "Initialisation..."
                        : report.status === "generating"
                          ? "Synthèse en cours..."
                          : isCached
                            ? "Disponible dans le cache local (prêt)"
                            : "Non téléchargé (se charge au besoin)"}
                </span>
              </div>
              {isCached && report.status !== "downloading" && (
                <span className="flex items-center gap-1 text-[11px] text-success">
                  <CheckCircle2 className="size-3" /> En cache
                </span>
              )}
            </div>

            {(report.status === "downloading" || report.status === "loading") && (
              <div className="space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${report.progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between gap-2 text-[11px] tabular-nums text-muted-foreground">
                  <span className="min-w-0 truncate">{report.text}</span>
                  <span className="shrink-0">{report.progressPercent}%</span>
                </div>
              </div>
            )}

            {report.status === "error" && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span>{report.text}</span>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Le LLM s'active uniquement si l'algorithme échoue.
            </p>
          </div>
        </div>

        {/* Pied : actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          {!localLLM.isLoaded() && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreload}
              disabled={isLoading || report.status === "downloading"}
            >
              {isLoading ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <DownloadCloud className="size-3.5" />
              )}
              Télécharger / Pré-charger
            </Button>
          )}
          <Button size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
