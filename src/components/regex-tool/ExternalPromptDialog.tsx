import { useMemo, useState } from "react";
import { X, Copy, Check, ExternalLink, Bot, FileText, Sliders, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/data-io";
import { generateExternalAIPrompt } from "@/lib/prompt-generator";
import type { OutputColumn } from "./types";

interface ExternalPromptDialogProps {
  open: boolean;
  onClose: () => void;
  column: OutputColumn | null;
  rows: string[];
}

export function ExternalPromptDialog({ open, onClose, column, rows }: ExternalPromptDialogProps) {
  const [copied, setCopied] = useState(false);
  const [includeSamples, setIncludeSamples] = useState(true);
  const [sampleCount, setSampleCount] = useState(10);
  const [dialect, setDialect] = useState("JavaScript / PCRE / Python");

  // Calcule tous les exemples utilisateur réels
  const userExamplesCount = useMemo(() => {
    if (!column) return 0;
    return column.user.filter((v) => v != null && String(v).trim() !== "").length;
  }, [column]);

  const promptText = useMemo(() => {
    if (!column) return "";
    return generateExternalAIPrompt({
      colName: column.name,
      rows,
      userExamples: column.user,
      includeSamples,
      sampleCount,
      targetDialect: dialect,
      currentRule: column.rule,
      failures: column.failures,
    });
  }, [column, rows, includeSamples, sampleCount, dialect]);

  if (!open || !column) return null;

  const handleCopy = async () => {
    const ok = await copyToClipboard(promptText);
    if (ok) {
      setCopied(true);
      toast.success("Prompt copié dans le presse-papiers !");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Impossible de copier automatiquement");
    }
  };

  const handleOpenAI = async (provider: "chatgpt" | "claude" | "gemini") => {
    // 1. Toujours copier automatiquement dans le presse-papier pour sécurité maximale
    await copyToClipboard(promptText);

    // 2. Ouvrir avec l'URL adaptée
    // Note technique : Les navigateurs et pare-feu (Cloudflare / OpenAI) tronquent ou ignorent les paramètres ?q=
    // dès que le prompt dépasse 1.5 - 2 Ko (notre prompt fait 4+ Ko avec les exemples structurés).
    // La copie immédiate dans le presse-papier + Ctrl+V assure 100% de fiabilité sans perte de données.
    if (provider === "chatgpt") {
      window.open("https://chatgpt.com/", "_blank");
      toast.success("Prompt copié dans le presse-papiers ! Faites simplement Ctrl+V dans ChatGPT.");
    } else if (provider === "claude") {
      window.open("https://claude.ai/new", "_blank");
      toast.success("Prompt copié dans le presse-papiers ! Faites simplement Ctrl+V dans Claude.");
    } else if (provider === "gemini") {
      window.open("https://gemini.google.com/app", "_blank");
      toast.success("Prompt copié dans le presse-papiers ! Faites simplement Ctrl+V dans Gemini.");
    }
  };

  const providers = [
    { id: "chatgpt", label: "ChatGPT" },
    { id: "claude", label: "Claude" },
    { id: "gemini", label: "Gemini" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="external-prompt-title"
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
      >
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-derived/25 bg-derived-soft text-derived">
              <Bot className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  id="external-prompt-title"
                  className="text-base font-semibold leading-tight text-foreground"
                >
                  Prompt pour votre propre IA
                </h3>
                <span className="rounded-md border border-derived/25 bg-derived-soft px-1.5 py-0.5 text-[11px] font-medium text-derived">
                  ChatGPT · Claude · Gemini
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Génère un prompt d'ingénierie contenant tous vos exemples et ouvre directement votre
                IA avec le prompt pré-rempli.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 cursor-pointer rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* BOUTONS D'OUVERTURE DIRECTE */}
          <div className="space-y-3 rounded-lg border border-border bg-surface-2/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <ExternalLink className="size-3.5" />
                Ouvrir directement votre IA
              </span>
              <span className="text-[11px] text-muted-foreground">
                Le prompt est copié automatiquement · Faites Ctrl+V
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleOpenAI(p.id)}
                  className="group flex cursor-pointer flex-col items-start gap-1 rounded-md border border-border bg-surface p-2.5 text-left transition hover:border-derived/50 hover:bg-surface-3 active:scale-98"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">{p.label}</span>
                    <ExternalLink className="size-3 text-muted-foreground group-hover:text-derived" />
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Copié · Prêt à coller (Ctrl+V)
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Statistiques et options */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/60 p-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <FileText className="size-3.5 text-primary" />
                <span>
                  Colonne : <strong>{column.name}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-medium text-derived">
                <CheckCheck className="size-3.5" />
                <span>
                  <strong>{userExamplesCount}</strong> exemple{userExamplesCount > 1 ? "s" : ""}{" "}
                  utilisateur (tous inclus)
                </span>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
              <div className="flex items-center gap-1.5">
                <Sliders className="size-3 text-muted-foreground" />
                <span className="text-muted-foreground">Contexte :</span>
                <select
                  value={sampleCount}
                  onChange={(e) => setSampleCount(Number(e.target.value))}
                  className="cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={10}>10 lignes min.</option>
                  <option value={20}>20 lignes</option>
                  <option value={50}>50 lignes</option>
                  <option value={100}>100 lignes</option>
                </select>
              </div>

              <select
                value={dialect}
                onChange={(e) => setDialect(e.target.value)}
                aria-label="Dialecte regex cible"
                className="min-w-0 max-w-full flex-1 cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary sm:flex-none"
              >
                <option value="Excel 365 (=REGEX.EXTRAIRE / =REGEXEXTRACT)">
                  Excel 365 (=REGEX.EXTRAIRE / =REGEXEXTRACT)
                </option>
                <option value="Alteryx (Outil RegEx / Formula)">
                  Alteryx (Outil RegEx / Formula)
                </option>
                <option value="KNIME (regexReplace / Regex Split)">
                  KNIME (regexReplace / Split)
                </option>
                <option value="Power Query (M) / Excel">Power Query (M) / Excel</option>
                <option value="JavaScript / PCRE / Python">JavaScript / PCRE / Python</option>
                <option value="Python (re)">Python (re)</option>
                <option value="JavaScript / TypeScript (RegExp)">JavaScript / TS</option>
                <option value="Google Sheets (REGEXEXTRACT)">Google Sheets</option>
                <option value="PostgreSQL / SQL">PostgreSQL / SQL</option>
              </select>
            </div>
          </div>

          {/* Zone de texte du Prompt */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs">
              <span className="font-semibold text-muted-foreground">
                Aperçu du prompt optimisé pour LLM (tableau Markdown + schéma JSON)
              </span>
              <span className="tabular-nums text-muted-foreground">
                {promptText.length} caractères
              </span>
            </div>
            <textarea
              readOnly
              value={promptText}
              rows={11}
              className="w-full resize-none rounded-lg border border-border bg-background p-3.5 font-mono text-[12px] leading-relaxed text-foreground outline-none selection:bg-primary/20 focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Pied de page */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Fermer
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleOpenAI("chatgpt")}>
            <ExternalLink className="size-3.5" />
            <span>Ouvrir ChatGPT (Ctrl+V)</span>
          </Button>
          <Button size="sm" onClick={handleCopy}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            <span>{copied ? "Prompt copié !" : "Copier le prompt"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
