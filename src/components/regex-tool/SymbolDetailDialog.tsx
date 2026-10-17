import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sparkles, Copy, Check, BookOpen, Lightbulb } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { findSymbolDetail } from "@/lib/regex-synth/symbol-examples";

export function SymbolDetailDialog({
  symbol,
  open,
  onOpenChange,
  onOpenFullCheatSheet,
}: {
  symbol: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFullCheatSheet?: () => void;
}) {
  const [copiedPattern, setCopiedPattern] = useState<string | null>(null);

  if (!symbol) return null;
  const detail = findSymbolDetail(symbol);
  if (!detail) return null;

  const copyPattern = async (pat: string) => {
    await navigator.clipboard.writeText(pat);
    setCopiedPattern(pat);
    toast.success(`Motif ${pat} copié`);
    setTimeout(() => setCopiedPattern(null), 1400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[70] flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-lg border-border bg-surface p-0">
        {/* En-tête de la mini-boîte */}
        <DialogHeader className="space-y-0 border-b border-border px-5 py-4 text-left">
          <div className="flex items-start gap-3 pr-8">
            <code className="shrink-0 rounded-md border border-primary/25 bg-primary-soft px-2.5 py-1 font-mono text-sm font-semibold text-primary">
              {detail.symbol}
            </code>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-base font-semibold leading-tight text-foreground">
                {detail.title}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {detail.categoryLabel}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Contenu autonome de la mini-boîte */}
        <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Explication synthétique */}
          <div className="rounded-lg border border-border bg-surface-2/40 p-3 text-sm leading-relaxed text-foreground/90">
            {detail.summary}
          </div>

          {/* Grille d'exemples concrets */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              <span>Exemples concrets d'utilisation</span>
            </div>

            <div className="space-y-2">
              {detail.detailedExamples.map((ex, idx) => (
                <div
                  key={idx}
                  className="space-y-1.5 rounded-lg border border-border bg-background/80 p-3 text-xs transition-colors hover:border-primary/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <code className="min-w-0 break-all rounded-md border border-primary/20 bg-primary-soft px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                      {ex.pattern}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyPattern(ex.pattern)}
                      className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                      title="Copier ce motif"
                    >
                      {copiedPattern === ex.pattern ? (
                        <Check className="size-3 text-success" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      <span>Copier</span>
                    </button>
                  </div>

                  <div className="text-xs font-medium text-foreground">{ex.description}</div>

                  {ex.context && (
                    <div className="text-[11px] leading-snug text-muted-foreground">
                      {ex.context}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-1.5">
                    <span className="text-[11px] text-muted-foreground">Trouve :</span>
                    <span className="min-w-0 break-all rounded-md border border-success/25 bg-success-soft px-2 py-0.5 font-mono text-xs font-semibold text-success">
                      {ex.found}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Astuce si disponible */}
          {detail.tip && (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-2/40 p-3 text-xs leading-relaxed text-muted-foreground">
              <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span>{detail.tip}</span>
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          {onOpenFullCheatSheet && (
            <Button type="button" variant="ghost" size="sm" onClick={onOpenFullCheatSheet}>
              <BookOpen className="size-3.5" />
              <span>Voir tout le pense-bête</span>
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
