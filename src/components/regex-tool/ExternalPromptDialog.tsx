import { useMemo, useState } from "react";
import {
  X,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Bot,
  Layers,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/data-io";
import { generateExternalAIPrompt } from "@/lib/prompt-generator";
import type { OutputColumn } from "./types";

interface ExternalPromptDialogProps {
  open: boolean;
  onClose: () => void;
  column: OutputColumn | null;
  rows: string[];
}

export function ExternalPromptDialog({
  open,
  onClose,
  column,
  rows,
}: ExternalPromptDialogProps) {
  const [copied, setCopied] = useState(false);
  const [includeSamples, setIncludeSamples] = useState(true);
  const [dialect, setDialect] = useState("JavaScript / PCRE / Python");

  const promptText = useMemo(() => {
    if (!column) return "";
    return generateExternalAIPrompt({
      colName: column.name,
      rows,
      userExamples: column.user,
      includeSamples,
      sampleCount: 5,
      targetDialect: dialect,
    });
  }, [column, rows, includeSamples, dialect]);

  if (!open || !column) return null;

  const exampleCount = column.user.filter((v) => v != null && v !== "").length;

  const handleCopy = async () => {
    const ok = await copyToClipboard(promptText);
    if (ok) {
      setCopied(true);
      toast.success("Prompt copié dans le presse-papier !");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Impossible de copier automatiquement");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-surface shadow-2xl overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-surface-2/40">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <Bot className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Prompt pour votre propre IA
                </h3>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Claude · ChatGPT · Gemini
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Quand l'algorithme ne suffit pas, donnez ce prompt pré-rempli à votre IA préférée.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Statistiques et options */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/60 p-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <FileText className="size-3.5 text-primary" />
                <span>Colonne : <strong>{column.name}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Layers className="size-3.5" />
                <span>
                  <strong>{exampleCount}</strong> exemple{exampleCount > 1 ? "s" : ""} renseigné{exampleCount > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-muted-foreground cursor-pointer hover:text-foreground">
                <input
                  type="checkbox"
                  checked={includeSamples}
                  onChange={(e) => setIncludeSamples(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary size-3.5"
                />
                <span>Ajouter 5 lignes de contexte</span>
              </label>
            </div>
          </div>

          {/* Zone de texte du Prompt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Prompt prêt à être copié :</span>
              <span>{promptText.length} caractères</span>
            </div>
            <textarea
              readOnly
              value={promptText}
              rows={11}
              className="w-full resize-none rounded-lg border border-border bg-background p-3.5 font-mono text-[12px] leading-relaxed text-foreground outline-none focus:ring-1 focus:ring-primary shadow-inner selection:bg-primary/20"
            />
          </div>

          {/* Liens rapides vers les IA externes */}
          <div className="rounded-lg border border-border/50 bg-surface-2/30 p-3 space-y-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Ouvrir directement votre IA :
            </span>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://chatgpt.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:border-emerald-500 hover:text-emerald-400 transition"
              >
                <span>ChatGPT</span>
                <ExternalLink className="size-3 text-muted-foreground" />
              </a>
              <a
                href="https://claude.ai"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:border-amber-500 hover:text-amber-400 transition"
              >
                <span>Claude</span>
                <ExternalLink className="size-3 text-muted-foreground" />
              </a>
              <a
                href="https://gemini.google.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:border-blue-500 hover:text-blue-400 transition"
              >
                <span>Google Gemini</span>
                <ExternalLink className="size-3 text-muted-foreground" />
              </a>
            </div>
          </div>
        </div>

        {/* Pied de page */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3 bg-surface-2/40">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground transition cursor-pointer"
          >
            Fermer
          </button>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:opacity-90 transition cursor-pointer active:scale-95"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            <span>{copied ? "Prompt copié !" : "Copier le prompt"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
