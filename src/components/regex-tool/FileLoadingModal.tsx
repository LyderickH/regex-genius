import { FileText, Loader2 } from "lucide-react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative flex w-full max-w-md flex-col rounded-xl border border-primary/30 bg-surface p-6 shadow-2xl space-y-4">
        {/* En-tête */}
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <FileText className="size-6 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground truncate" title={progress.filename}>
              {progress.filename}
            </h3>
            <p className="text-xs text-muted-foreground">
              {progress.size} • Lecture et analyse en cours...
            </p>
          </div>
          <span className="font-mono text-base font-bold text-primary">
            {progress.percent}%
          </span>
        </div>

        {/* Barre de progression */}
        <div className="space-y-1.5">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2 border border-border">
            <div
              className="h-full bg-gradient-to-r from-primary to-amber-500 transition-all duration-150 rounded-full"
              style={{ width: `${Math.max(3, progress.percent)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 truncate">
              <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
              <span className="truncate">{progress.step}</span>
            </div>
          </div>
        </div>

        {/* Info optimisation */}
        <div className="rounded-lg bg-surface-2/60 border border-border/60 p-2.5 text-[11px] text-muted-foreground leading-relaxed">
          ⚡ <strong>Optimisation automatique :</strong> Un échantillon interactif (jusqu'à 50 000 lignes) est extrait pour garantir une fluidité parfaite à 60 fps. L'intégralité du fichier pourra être traitée lors de l'export.
        </div>
      </div>
    </div>
  );
}
