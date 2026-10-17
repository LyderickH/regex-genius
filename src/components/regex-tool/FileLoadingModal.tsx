import { FileText, Info, Loader2 } from "lucide-react";

export interface FileLoadingState {
  filename: string;
  size: string;
  percent: number;
  step: string;
}

interface FileLoadingModalProps {
  progress: FileLoadingState | null;
}

export function FileLoadingModal({ progress }: FileLoadingModalProps) {
  if (!progress) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-loading-title"
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
      >
        {/* En-tête */}
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary-soft text-primary">
            <FileText className="size-5 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h3
              id="file-loading-title"
              className="truncate text-base font-semibold leading-tight text-foreground"
              title={progress.filename}
            >
              {progress.filename}
            </h3>
            <p className="text-sm text-muted-foreground">
              {progress.size} • Lecture et analyse en cours...
            </p>
          </div>
          <span className="shrink-0 text-base font-semibold tabular-nums text-primary">
            {progress.percent}%
          </span>
        </div>

        {/* Corps */}
        <div className="space-y-4 px-5 py-4">
          {/* Barre de progression */}
          <div className="space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-surface-2">
              <div
                className="h-full rounded-full bg-primary transition-all duration-150"
                style={{ width: `${Math.max(3, progress.percent)}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
              <span className="truncate">{progress.step}</span>
            </div>
          </div>

          {/* Info optimisation */}
          <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-2/40 p-3 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <p>
              <strong className="text-foreground">Optimisation automatique :</strong> un échantillon
              interactif (jusqu'à 50 000 lignes) est extrait pour garantir une fluidité parfaite à
              60 fps. L'intégralité du fichier pourra être traitée lors de l'export.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
