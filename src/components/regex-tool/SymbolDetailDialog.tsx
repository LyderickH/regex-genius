import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sparkles, Copy, Check, BookOpen, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-surface border-border shadow-2xl">
        {/* En-tête de la mini-boîte */}
        <DialogHeader className="p-4 border-b border-border/80 bg-surface-2/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <code className="font-mono text-sm font-bold text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-md border border-amber-500/30 shrink-0 shadow-2xs">
                {detail.symbol}
              </code>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-bold text-foreground truncate">
                  {detail.title}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] uppercase font-semibold text-primary bg-primary/10 border border-primary/25 px-1.5 py-0.2 rounded">
                    {detail.categoryLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Contenu autonome de la mini-boîte */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
          {/* Explication synthétique */}
          <div className="rounded-lg border border-border/80 bg-surface-2/40 p-3 text-xs text-foreground/90 leading-relaxed">
            {detail.summary}
          </div>

          {/* Grille d'exemples concrets */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-400">
              <Sparkles className="size-3 text-amber-400" />
              <span>Exemples concrets d'utilisation :</span>
            </div>

            <div className="space-y-2">
              {detail.detailedExamples.map((ex, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-border bg-background/80 p-3 space-y-1.5 text-xs hover:border-amber-500/40 transition-colors shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-xs">
                      {ex.pattern}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyPattern(ex.pattern)}
                      className="text-[10px] text-muted-foreground hover:text-amber-300 flex items-center gap-1 cursor-pointer transition px-1.5 py-0.5 rounded hover:bg-surface-2"
                      title="Copier ce motif"
                    >
                      {copiedPattern === ex.pattern ? (
                        <Check className="size-3 text-emerald-400" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      <span>copier</span>
                    </button>
                  </div>

                  <div className="font-medium text-foreground text-xs">{ex.description}</div>

                  {ex.context && (
                    <div className="text-[11px] text-muted-foreground italic leading-tight">
                      {ex.context}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs font-mono">
                    <span className="text-muted-foreground text-[10px] font-sans">Trouve :</span>
                    <span className="bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/25 font-bold">
                      {ex.found}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Astuce si disponible */}
          {detail.tip && (
            <div className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 flex items-start gap-2 leading-relaxed">
              <span className="font-bold text-xs shrink-0">💡</span>
              <span>{detail.tip}</span>
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div className="flex items-center justify-between p-3 border-t border-border/80 bg-surface-2/40 text-xs">
          {onOpenFullCheatSheet ? (
            <button
              type="button"
              onClick={onOpenFullCheatSheet}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-amber-300 transition cursor-pointer"
            >
              <BookOpen className="size-3.5 text-amber-400" />
              <span>Voir toute la Cheat Sheet</span>
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-border bg-surface px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-2 transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
