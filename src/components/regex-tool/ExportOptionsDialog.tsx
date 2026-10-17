import { useState } from "react";
import { X, Download, Sparkles, Layers, FileSpreadsheet, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-options-title"
        className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
      >
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary-soft text-primary">
              <Download className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <h3
                id="export-options-title"
                className="text-base font-semibold leading-tight text-foreground"
              >
                Exporter vos données ({format.toUpperCase()})
              </h3>
              <p className="text-sm text-muted-foreground">
                Choisissez le périmètre d'application de vos expressions régulières.
              </p>
            </div>
          </div>
          {!isProcessing && (
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="shrink-0 cursor-pointer rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Corps */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-xs">
          {/* Bannière de contexte */}
          <div className="space-y-2 rounded-lg border border-border bg-background p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <Layers className="size-3.5 text-primary" />
                Grand volume détecté
              </span>
              <span className="rounded-md bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                {totalLines.toLocaleString("fr-FR")} lignes au total
              </span>
            </div>
            <p className="leading-relaxed text-muted-foreground">
              Pour garantir une fluidité totale de travail, vous avez interagi avec un échantillon
              de{" "}
              <strong className="text-foreground">
                {interactiveLines.toLocaleString("fr-FR")} lignes
              </strong>
              . Vos <strong>{validRulesCount}</strong> règle{validRulesCount > 1 ? "s" : ""} Regex
              sont prêtes.
            </p>
          </div>

          {/* Si en cours de traitement */}
          {isProcessing ? (
            <div className="space-y-3 rounded-lg border border-primary/30 bg-primary-soft p-6 text-center">
              <Loader2 className="mx-auto size-8 animate-spin text-primary" />
              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground">
                  Application des regex sur l'ensemble du fichier...
                </div>
                <div className="text-[11px] tabular-nums text-muted-foreground">
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
                className="group relative flex cursor-pointer flex-col items-start gap-1.5 rounded-lg border border-primary/60 bg-primary-soft p-4 text-left transition hover:border-primary active:scale-98"
              >
                <div className="flex w-full flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2 text-sm font-semibold text-foreground">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      Appliquer et exporter l'intégralité ({totalLines.toLocaleString("fr-FR")}{" "}
                      lignes)
                    </span>
                  </div>
                  <span className="shrink-0 rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    Recommandé
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Applique vos regex à 100% des lignes de votre fichier source d'origine en
                  streaming haute performance sans saturer la mémoire du navigateur, et télécharge
                  le fichier complet.
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
                className="flex cursor-pointer flex-col items-start gap-1 rounded-lg border border-border bg-background p-3.5 text-left transition hover:bg-surface-2 active:scale-98"
              >
                <div className="flex items-start gap-2 font-medium text-foreground">
                  <FileSpreadsheet className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span>
                    Exporter uniquement l'échantillon ({interactiveLines.toLocaleString("fr-FR")}{" "}
                    lignes)
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Télécharge instantanément les lignes actuellement visibles et chargées dans votre
                  studio.
                </p>
              </button>
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" size="sm" disabled={isProcessing} onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
