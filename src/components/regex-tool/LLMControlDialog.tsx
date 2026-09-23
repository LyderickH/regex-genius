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
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Moteur IA Locale (Fallback)</h2>
            <p className="text-xs text-muted-foreground">
              Exécuté 100% dans votre navigateur via {device === "webgpu" ? "WebGPU" : "WASM / CPU"}
            </p>
          </div>
        </div>

        {/* Badge confidentialité */}
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-400">
          <ShieldCheck className="size-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Confidentialité garantie :</span> Vos données,
            colonnes et exemples ne quittent jamais votre machine. Aucun appel serveur n'est
            effectué.
          </div>
        </div>

        {/* Sélection du modèle */}
        <div className="mt-5 space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Sélectionner un modèle
          </label>
          <div className="grid gap-2">
            {AVAILABLE_MODELS.map((model) => {
              const isSelected = model.id === selectedModelId;
              return (
                <div
                  key={model.id}
                  onClick={() => handleSelectModel(model)}
                  className={`flex cursor-pointer items-start justify-between rounded-lg border p-3 transition ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-surface-2/40 hover:border-border/80 hover:bg-surface-2"
                  }`}
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{model.name}</span>
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border">
                        {model.size}
                      </span>
                      {model.recommended === "balanced" && (
                        <span className="rounded bg-amber-500/10 text-amber-500 px-1.5 py-0.5 text-[10px] font-medium border border-amber-500/20">
                          Recommandé
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{model.description}</p>
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
        <div className="mt-5 rounded-lg border border-border bg-surface-2 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-medium">
              <Cpu className="size-3.5 text-muted-foreground" />
              <span>Statut :</span>
              <span
                className={
                  report.status === "ready"
                    ? "text-emerald-400"
                    : report.status === "downloading" || report.status === "loading"
                    ? "text-amber-400"
                    : report.status === "error"
                    ? "text-rose-400"
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
              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
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
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                <span>{report.text}</span>
                <span>{report.progressPercent}%</span>
              </div>
            </div>
          )}

          {report.status === "error" && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span>{report.text}</span>
            </div>
          )}
        </div>

        {/* Boutons d'actions */}
        <div className="mt-5 flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground">
            Le LLM s'active uniquement si l'algorithme échoue.
          </div>
          <div className="flex items-center gap-2">
            {!localLLM.isLoaded() && (
              <button
                onClick={handlePreload}
                disabled={isLoading || report.status === "downloading"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary disabled:opacity-50 transition"
              >
                {isLoading ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <DownloadCloud className="size-3.5" />
                )}
                Télécharger / Pré-charger
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
