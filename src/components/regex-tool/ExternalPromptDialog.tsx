import { useMemo, useState } from "react";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Bot,
  Layers,
  FileText,
  Sliders,
  CheckCheck,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-surface shadow-2xl overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-surface-2/40">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400">
              <Bot className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Prompt pour votre propre IA
                </h3>
                <span className="rounded-full bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[10px] font-medium text-purple-300">
                  ChatGPT · Claude · Gemini
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Génère un prompt d'ingénierie contenant tous vos exemples et ouvre directement votre IA avec le prompt pré-rempli.
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
          {/* BOUTONS D'OUVERTURE DIRECTE */}
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <ExternalLink className="size-3.5" />
                Ouvrir directement votre IA :
              </span>
              <span className="text-[11px] text-muted-foreground">
                Le prompt est copié automatiquement · Faites Ctrl+V
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                onClick={() => handleOpenAI("chatgpt")}
                className="group flex flex-col items-start gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 p-2.5 text-left transition cursor-pointer active:scale-98"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400">ChatGPT</span>
                  <ExternalLink className="size-3 text-emerald-400 opacity-70 group-hover:opacity-100" />
                </div>
                <span className="text-[10px] text-emerald-300/80">
                  Copié · Prêt à coller (Ctrl+V)
                </span>
              </button>

              <button
                onClick={() => handleOpenAI("claude")}
                className="group flex flex-col items-start gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 p-2.5 text-left transition cursor-pointer active:scale-98"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-semibold text-amber-400">Claude</span>
                  <ExternalLink className="size-3 text-amber-400 opacity-70 group-hover:opacity-100" />
                </div>
                <span className="text-[10px] text-amber-300/80">
                  Copié · Prêt à coller (Ctrl+V)
                </span>
              </button>

              <button
                onClick={() => handleOpenAI("gemini")}
                className="group flex flex-col items-start gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 p-2.5 text-left transition cursor-pointer active:scale-98"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-semibold text-blue-400">Gemini</span>
                  <ExternalLink className="size-3 text-blue-400 opacity-70 group-hover:opacity-100" />
                </div>
                <span className="text-[10px] text-blue-300/80">
                  Copié · Prêt à coller (Ctrl+V)
                </span>
              </button>
            </div>
          </div>

          {/* Statistiques et options */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/60 p-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <FileText className="size-3.5 text-primary" />
                <span>Colonne : <strong>{column.name}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-purple-400 font-medium">
                <CheckCheck className="size-3.5" />
                <span>
                  <strong>{userExamplesCount}</strong> exemple{userExamplesCount > 1 ? "s" : ""} utilisateur (tous inclus)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Sliders className="size-3 text-muted-foreground" />
                <span className="text-muted-foreground">Contexte :</span>
                <select
                  value={sampleCount}
                  onChange={(e) => setSampleCount(Number(e.target.value))}
                  className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary cursor-pointer"
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
                className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="Excel 365 (=REGEX.EXTRAIRE / =REGEXEXTRACT)">Excel 365 (=REGEX.EXTRAIRE / =REGEXEXTRACT)</option>
                <option value="Alteryx (Outil RegEx / Formula)">Alteryx (Outil RegEx / Formula)</option>
                <option value="KNIME (regexReplace / Regex Split)">KNIME (regexReplace / Split)</option>
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
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Aperçu du prompt optimisé pour LLM (Tableau Markdown + Schéma JSON) :</span>
              <span>{promptText.length} caractères</span>
            </div>
            <textarea
              readOnly
              value={promptText}
              rows={11}
              className="w-full resize-none rounded-lg border border-border bg-background p-3.5 font-mono text-[12px] leading-relaxed text-foreground outline-none focus:ring-1 focus:ring-primary shadow-inner selection:bg-primary/20"
            />
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenAI("chatgpt")}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow transition cursor-pointer active:scale-95"
            >
              <ExternalLink className="size-3.5" />
              <span>Ouvrir ChatGPT (Ctrl+V)</span>
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
    </div>
  );
}
