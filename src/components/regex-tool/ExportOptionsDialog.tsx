import { useState } from "react";
import { X, Download, Sparkles, Layers, FileSpreadsheet, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import type { OutputColumn } from "./types";

interface ExportOptionsDialogProps {
  open: boolean;
  onClose: () => void;
  totalLines: number;
  interactiveLines: number;
  columns: OutputColumn[];
  format: "csv" | "xlsx";
  onExportSample: () => void;
  onExportFull: (onProgress: (percent: number) => void) => Promise<void>;
}

export function ExportOptionsDialog({
  open,
  onClose,
  totalLines,
  interactiveLines,
  columns,
  format,
  onExportSample,
  onExportFull,
}: ExportOptionsDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!open) return null;

  const validRulesCount = columns.filter((c) => c.rule != null).length;

  const handleFull = async () => {
    setIsProcessing(true);
    setProgress(0);
    try {
      await onExportFull((p) => setProgress(p));
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative flex w-full max-w-xl flex-col rounded-xl border border-border bg-surface shadow-2xl overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-surface-2/40">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <Download className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Exporter vos données ({format.toUpperCase()})
              </h3>
              <p className="text-xs text-muted-foreground">
                Choisissez le périmètre d'application de vos expressions régulières.
              </p>
            </div>
          </div>
          {!isProcessing && (
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition cursor-pointer"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Corps */}
        <div className="p-5 space-y-4 text-xs">
          {/* Bannière de contexte */}
          <div className="rounded-lg border border-border bg-background p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="size-3.5 text-primary" />
                Grand volume détecté
              </span>
              <span className="rounded bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium">
                {totalLines.toLocaleString("fr-FR")} lignes au total
              </span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Pour garantir une fluidité totale de travail, vous avez interagi avec un échantillon de{" "}
              <strong className="text-foreground">{interactiveLines.toLocaleString("fr-FR")} lignes</strong>.
              Vos <strong>{validRulesCount}</strong> règle{validRulesCount > 1 ? "s" : ""} Regex sont prêtes.
            </p>
          </div>

          {/* Si en cours de traitement */}
          {isProcessing ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center space-y-3">
              <Loader2 className="size-8 text-primary animate-spin mx-auto" />
              <div className="space-y-1">
                <div className="font-semibold text-foreground text-sm">
                  Application des regex sur l'ensemble du fichier...
                </div>
                <div className="text-muted-foreground text-[11px]">
                  Traitement de {totalLines.toLocaleString("fr-FR")} lignes : {progress}%
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {/* Option 1 : Appliquer aux 100% du fichier */}
              <button
                type="button"
                onClick={handleFull}
                className="group relative flex flex-col items-start gap-1.5 rounded-xl border-2 border-primary/60 bg-primary/5 hover:bg-primary/10 p-4 text-left transition cursor-pointer shadow-sm active:scale-98"
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                    <Sparkles className="size-4 text-primary" />
                    <span>Appliquer et exporter l'intégralité ({totalLines.toLocaleString("fr-FR")} lignes)</span>
                  </div>
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground uppercase tracking-wider">
                    Recommandé
                  </span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Applique vos regex à 100% des lignes de votre fichier source d'origine en streaming haute performance
                  sans saturer la mémoire du navigateur, et télécharge le fichier complet.
                </p>
                <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-primary group-hover:underline">
                  <span>Lancer l'export complet</span>
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>

              {/* Option 2 : Exporter uniquement l'échantillon */}
              <button
                type="button"
                onClick={() => {
                  onExportSample();
                  onClose();
                }}
                className="flex flex-col items-start gap-1 rounded-xl border border-border bg-background hover:bg-surface-2 p-3.5 text-left transition cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <FileSpreadsheet className="size-3.5 text-muted-foreground" />
                  <span>Exporter uniquement l'échantillon ({interactiveLines.toLocaleString("fr-FR")} lignes)</span>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Télécharge instantanément les lignes actuellement visibles et chargées dans votre studio.
                </p>
              </button>
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div className="flex items-center justify-end border-t border-border px-5 py-3 bg-surface-2/40">
          <button
            disabled={isProcessing}
            onClick={onClose}
            className="rounded-md border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground transition cursor-pointer disabled:opacity-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
