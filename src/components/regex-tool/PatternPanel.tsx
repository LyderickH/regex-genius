import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  CircleAlert,
  CircleCheck,
  ChevronRight,
  PanelLeft,
  Sparkles,
  Settings2,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Bot,
  Lightbulb,
  ChevronDown,
  HelpCircle,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { explain } from "@/lib/regex-synth/explain";
import { analyzeRegexFull } from "@/lib/regex-synth/human-explain";
import { DIALECTS, type CodeLocale } from "@/lib/regex-synth/dialects";
import { describeTransform } from "@/lib/regex-synth/engine";
import type { OutputColumn } from "./types";
import { LLMControlDialog } from "./LLMControlDialog";
import { ExternalPromptDialog } from "./ExternalPromptDialog";
import type { ModelProgressReport } from "@/lib/llm/types";

const TOK_COLOR: Record<string, string> = {
  literal: "text-tok-literal",
  class: "text-tok-class",
  quant: "text-tok-quant",
  anchor: "text-tok-anchor",
  group: "text-tok-group",
};

export function PatternPanel({
  column,
  rowCount,
  rows = [],
  onGoToRow,
  combined,
  hasMultipleRules,
  onTriggerLLM,
  isLLMRunning,
  llmReport,
  onCopyTable,
}: {
  column: OutputColumn | null;
  rowCount: number;
  rows?: string[];
  onGoToRow?: (row: number) => void;
  combined?: { source: string; names: string[]; covered: number; total: number } | null;
  hasMultipleRules?: boolean;
  onTriggerLLM?: () => void;
  isLLMRunning?: boolean;
  llmReport?: ModelProgressReport;
  onCopyTable?: () => void;
}) {
  const [dialectId, setDialectId] = useState("excel");
  const [codeLocale, setCodeLocale] = useState<CodeLocale>("fr");
  const [copied, setCopied] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [showCombined, setShowCombined] = useState(false);
  const [llmDialogOpen, setLlmDialogOpen] = useState(false);
  const [externalPromptOpen, setExternalPromptOpen] = useState(false);

  const dialect = DIALECTS.find((d) => d.id === dialectId) ?? DIALECTS[0]!;
  const segments = useMemo(
    () => (column?.rule ? explain(column.rule.source, column.rule.replacement) : []),
    [column?.rule],
  );
  const rule = column?.rule;
  const analysis = useMemo(
    () => analyzeRegexFull(rule ?? null, column?.name),
    [rule, column?.name],
  );
  const humanExplanation = analysis.human;

  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    toast.success("Copié dans le presse-papiers");
    setTimeout(() => setCopied(null), 1400);
  };

  if (collapsed) {
    return (
      <aside className="flex w-9 shrink-0 flex-col items-center border-l border-grid-line bg-surface py-3">
        <button
          onClick={() => setCollapsed(false)}
          title="Afficher le motif déduit"
          className="rounded-md p-1 text-muted-foreground transition hover:bg-surface-2 hover:text-primary"
        >
          <PanelLeft className="size-4" />
        </button>
        <div className="mt-3 flex-1 [writing-mode:vertical-rl]">
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            Motif déduit{column ? ` — ${column.name}` : ""}
          </span>
        </div>
      </aside>
    );
  }

  if (!column) {
    return (
      <aside className="flex w-[380px] shrink-0 items-center justify-center border-l border-grid-line bg-surface p-6 text-center text-sm text-muted-foreground">
        Sélectionnez une colonne de résultat pour voir son expression régulière.
      </aside>
    );
  }

  const examples = column.user.filter((v) => v != null && v !== "").length;
  const isLLMRule = rule?.origin === "llm";

  return (
    <>
      <aside className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-l border-grid-line bg-surface">
        <div className="flex items-center justify-between border-b border-grid-line px-4 py-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              Motif déduit
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold">{column.name}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setLlmDialogOpen(true)}
              title="Configurer l'IA locale (Fallback)"
              className="rounded-md p-1 text-muted-foreground transition hover:bg-surface-2 hover:text-primary"
            >
              <Cpu className="size-4" />
            </button>
            <button
              onClick={() => setCollapsed(true)}
              title="Replier le panneau"
              className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-surface-2 hover:text-primary"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {combined ? (
          <div className="border-b border-grid-line p-3 bg-surface-2/30">
            <button
              onClick={() => setShowCombined((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="size-3.5 text-primary" />
                <span>Obtenir la regex pour toutes les colonnes ({combined.names.length})</span>
              </div>
              <ChevronDown className={cn("size-3.5 transition-transform", showCombined && "rotate-180")} />
            </button>
            {showCombined && (
              <div className="mt-2.5 rounded-lg border border-border bg-background p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    1 seul passage extrait {combined.names.length} colonnes
                  </span>
                  <button
                    onClick={() => copy(combined.source, "combined")}
                    className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                  >
                    {copied === "combined" ? <Check className="size-3" /> : <Copy className="size-3" />}
                    <span>Copier</span>
                  </button>
                </div>
                <div className="break-all rounded border border-border bg-surface-2/50 p-2.5 font-mono text-[11px] leading-relaxed text-derived">
                  {combined.source}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Groupes de capture : {combined.names.map((n, idx) => `$${idx + 1} = ${n}`).join(", ")}. Couvre {combined.covered}/{combined.total} lignes.
                </p>
              </div>
            )}
          </div>
        ) : hasMultipleRules ? (
          <div className="border-b border-grid-line p-2 bg-surface-2/20 text-center">
            <span className="text-[10px] text-muted-foreground">
              Regex combinée non disponible (colonnes incompatibles sur les mêmes lignes)
            </span>
          </div>
        ) : null}

        {!rule ? (
          <div className="space-y-4 p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-2 rounded-md border border-border bg-surface-2 p-3">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
              <div className="space-y-1">
                <p>
                  {examples === 0
                    ? "Saisissez le résultat attendu sur 2 ou 3 lignes : le motif se déduit tout seul."
                    : "Aucune règle algorithmique classique n'explique tous vos exemples."}
                </p>
                {examples > 0 && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    💡 <strong>Astuce :</strong> Vérifiez que la colonne à gauche marquée <strong>[Source]</strong> contient bien le texte à découper. Si le texte brut se trouve dans une autre colonne, cliquez sur le bouton <span className="font-mono text-primary">⭰</span> sur son en-tête pour la définir comme source.
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Exemples fournis : {examples}</span>
              <button
                onClick={() => setLlmDialogOpen(true)}
                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Gérer l'IA locale
              </button>
            </div>

            {/* Déclencheur Fallback IA Locale */}
            {examples > 0 && onTriggerLLM && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                  <Sparkles className="size-4" />
                  <span>Activer le fallback IA locale</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Le moteur algorithmique n'a pas suffi. Vous pouvez solliciter le LLM local (WebGPU)
                  pour proposer une expression qui sera validée algorithmiquement.
                </p>

                {isLLMRunning ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-2 text-xs text-amber-300">
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>{llmReport?.text || "Synthèse LLM locale en cours..."}</span>
                    </div>
                    {llmReport && (llmReport.status === "downloading" || llmReport.status === "loading") && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full bg-amber-500 transition-all duration-300"
                          style={{ width: `${llmReport.progressPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={onTriggerLLM}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 px-3 py-2 text-xs font-semibold transition"
                  >
                    <Sparkles className="size-3.5" />
                    Synthétiser avec le LLM local (privé)
                  </button>
                )}
              </div>
            )}

            {/* Fallback ultime : Prompt pour votre propre IA (ChatGPT, Claude, Gemini) */}
            {examples > 0 && (
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-purple-400">
                    <Bot className="size-4" />
                    <span>Prompt pour votre propre IA</span>
                  </div>
                  <span className="text-[10px] text-purple-300/80 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                    Claude · GPT · Gemini
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Quand rien ne marche ou pour les cas complexes : générez en 1 clic un prompt ultra-optimisé avec tous vos exemples complétés, prêt à coller dans votre IA.
                </p>
                <button
                  onClick={() => setExternalPromptOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 px-3 py-2 text-xs font-semibold transition cursor-pointer shadow-sm"
                >
                  <Bot className="size-3.5" />
                  Générer le prompt pour votre propre IA
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {/* BADGE D'ORIGINE DU RÉSULTAT */}
            {isLLMRule ? (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-semibold text-amber-400">
                    <Sparkles className="size-3.5" /> ✦ Généré par IA locale
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                    <CheckCircle2 className="size-3" /> ✓ Regex vérifiée
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {rule.llmMetadata?.modelName ?? "LLM local"} ·{" "}
                    {rule.llmMetadata?.runtime?.toUpperCase() ?? "WEBGPU"}
                  </span>
                  <span>
                    {rule.llmMetadata?.positivePassed}/{rule.llmMetadata?.positiveTotal} validés
                    {rule.llmMetadata?.attemptsCount ? ` (${rule.llmMetadata.attemptsCount} essais)` : ""}
                  </span>
                </div>
                {rule.llmMetadata?.explanation && (
                  <p className="border-t border-amber-500/10 pt-1 text-[11px] italic text-muted-foreground">
                    « {rule.llmMetadata.explanation} »
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Settings2 className="size-3.5 text-primary" />
                  <span>⚙ Déduit automatiquement</span>
                </span>
                <span className="text-[11px] text-muted-foreground">Moteur algorithmique</span>
              </div>
            )}

            {/* RISQUE DE SÉCURITÉ REDOS */}
            {rule.llmMetadata?.securityRisk && (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                  rule.llmMetadata.securityRisk === "high"
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                    : rule.llmMetadata.securityRisk === "medium"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                )}
              >
                {rule.llmMetadata.securityRisk === "high" ? (
                  <ShieldAlert className="size-4 shrink-0 text-rose-400" />
                ) : (
                  <ShieldCheck className="size-4 shrink-0 text-emerald-400" />
                )}
                <div className="text-[11px]">
                  <span>Sécurité ReDoS : </span>
                  <strong className="uppercase">{rule.llmMetadata.securityRisk}</strong>
                  {rule.llmMetadata.securityRisk === "high"
                    ? " — Risque de backtracking catastrophique"
                    : " — Aucun risque détecté"}
                </div>
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                  Expression
                </span>
                <button
                  onClick={() => copy(rule.source, "raw")}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-primary"
                >
                  {copied === "raw" ? <Check className="size-3" /> : <Copy className="size-3" />}{" "}
                  copier
                </button>
              </div>
              <div className="break-all rounded-md border border-border bg-background p-3 font-mono text-[13px] leading-relaxed">
                {segments.map((s, i) => (
                  <span key={i} className={TOK_COLOR[s.kind]} title={s.label}>
                    {s.text}
                  </span>
                ))}
              </div>
              {rule.replacement !== undefined && (
                <div className="mt-2 flex items-center justify-between rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-300">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-muted-foreground">Formule de remplacement :</span>
                    <code className="font-mono font-bold bg-background/80 px-1.5 py-0.5 rounded border border-cyan-500/20 text-cyan-300">
                      {rule.replacement}
                    </code>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/90 bg-cyan-500/20 px-1.5 py-0.5 rounded">
                    Substitution
                  </span>
                </div>
              )}
              {describeTransform(rule.transform) && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Puis, sur la valeur extraite : {describeTransform(rule.transform)}. Cette étape
                  n'est pas incluse dans l'expression ci-dessous.
                </p>
              )}
              {rule.extra && rule.extra.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Vos lignes contiennent plusieurs motifs. Les expressions suivantes sont essayées
                    dans l'ordre quand la première ne s'applique pas :
                  </p>
                  {rule.extra.map((alt, i) => (
                    <div key={i}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                          Motif {i + 2}
                        </span>
                        <button
                          onClick={() => copy(alt.source, `alt${i}`)}
                          className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-primary"
                        >
                          {copied === `alt${i}` ? (
                            <Check className="size-3" />
                          ) : (
                            <Copy className="size-3" />
                          )}{" "}
                          copier
                        </button>
                      </div>
                      <div className="break-all rounded-md border border-border bg-background p-2.5 font-mono text-[12px] leading-relaxed">
                        {alt.source}
                      </div>
                      {describeTransform(alt.transform) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Puis : {describeTransform(alt.transform)}.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs">
              {column.failures.length === 0 ? (
                <CircleCheck className="size-4 text-derived" />
              ) : (
                <CircleAlert className="size-4 text-warn" />
              )}
              <span>
                <span className="font-mono text-foreground">{column.matched}</span> / {rowCount}{" "}
                lignes couvertes
                {column.failures.length > 0 && (
                  <span className="text-warn"> · {column.failures.length} en échec</span>
                )}
              </span>
            </div>

            {column.failures.length === 0 && onTriggerLLM && (
              <div className="rounded-lg border border-border/80 bg-surface-2/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Sparkles className="size-3.5 text-amber-400" />
                    <span>Résultat inattendu ?</span>
                  </div>
                  <button
                    onClick={() => setLlmDialogOpen(true)}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer"
                  >
                    Gérer l'IA
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  L'algorithme couvre 100 % des lignes. Si le motif déduit ne correspond pas exactement à votre intention :
                </p>

                {isLLMRunning ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-2 text-xs text-amber-300">
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>{llmReport?.text || "Recherche d'une alternative par l'IA..."}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={onTriggerLLM}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1.5 text-xs font-medium text-amber-300 transition cursor-pointer"
                      title="Forcer l'IA locale (WebGPU) à chercher une expression régulière alternative"
                    >
                      <Sparkles className="size-3 text-amber-400" />
                      <span>Forcer une alternative par l'IA locale</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExternalPromptOpen(true)}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 px-2.5 py-1 text-[11px] font-medium text-purple-300 transition cursor-pointer"
                    >
                      <Bot className="size-3 text-purple-400" />
                      <span>Prompt ChatGPT / Claude</span>
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground/80 italic pt-0.5">
                  💡 Conseil : Vous pouvez aussi saisir le résultat attendu sur une autre ligne du tableau pour corriger directement l'algorithme.
                </p>
              </div>
            )}

            {column.failures.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] uppercase tracking-[0.15em] text-warn">
                  Pourquoi ces lignes échouent
                </div>
                <p className="mb-2 text-xs text-muted-foreground">
                  Le motif ci-dessus ne retrouve pas son contexte dans ces lignes. Saisissez le
                  résultat attendu sur l'une d'elles pour aider la déduction.
                </p>
                <ul className="space-y-1">
                  {column.failures.slice(0, 6).map((r) => (
                    <li key={r}>
                      <button
                        onClick={() => onGoToRow?.(r)}
                        className="flex w-full gap-2 rounded-md border border-border bg-background px-2 py-1 text-left text-[11px] transition hover:border-warn"
                      >
                        <span className="shrink-0 font-mono text-muted-foreground">{r + 1}</span>
                        <span className="truncate font-mono text-foreground">{rows[r] ?? ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {column.failures.length > 6 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    et {column.failures.length - 6} autre(s).
                  </p>
                )}
              </div>
            )}

            {column.failures.length > 0 && onTriggerLLM && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                    <Sparkles className="size-4" />
                    <span>Compléter avec l'IA locale (Fallback)</span>
                  </div>
                  <button
                    onClick={() => setLlmDialogOpen(true)}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    Gérer l'IA
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Le motif classique n'extrait rien sur {column.failures.length} ligne{column.failures.length > 1 ? "s" : ""}.
                  Vous pouvez solliciter le LLM local (WebGPU) pour analyser l'ensemble des lignes et déduire une regex plus générale.
                </p>

                {isLLMRunning ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-2 text-xs text-amber-300">
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>{llmReport?.text || "Synthèse LLM locale en cours..."}</span>
                    </div>
                    {llmReport && (llmReport.status === "downloading" || llmReport.status === "loading") && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full bg-amber-500 transition-all duration-300"
                          style={{ width: `${llmReport.progressPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={onTriggerLLM}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 px-3 py-2 text-xs font-semibold transition"
                  >
                    <Sparkles className="size-3.5" />
                    ✦ Résoudre les échecs avec le LLM local (privé)
                  </button>
                )}
              </div>
            )}

            {column.failures.length > 0 && (
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
                    <Bot className="size-3.5" />
                    <span>Besoin d'aide externe ?</span>
                  </div>
                  <span className="text-[10px] text-purple-300/80">Claude / ChatGPT / Gemini</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Générez un prompt complet incluant vos exemples et les lignes en échec pour votre IA.
                </p>
                <button
                  onClick={() => setExternalPromptOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 px-2.5 py-1.5 text-xs font-medium transition cursor-pointer"
                >
                  <Bot className="size-3.5" />
                  Prompt ChatGPT / Claude
                </button>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
                  Lecture & Raisonnement du motif
                </span>
              </div>

              {/* 1. En langage humain (clair et immédiat) */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-primary text-xs">
                  <Lightbulb className="size-3.5 text-primary" />
                  <span>En langage humain :</span>
                </div>
                <p className="text-xs text-foreground leading-relaxed font-normal">
                  {analysis.human}
                </p>
              </div>

              {/* 2. Ce que fait le motif techniquement (analyse du mécanisme & hypothèses de raisonnement) */}
              <div className="rounded-lg border border-border bg-surface-2/60 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Cpu className="size-3.5 text-amber-400" />
                    <span>Ce que fait le motif techniquement :</span>
                  </span>
                  <span className="text-[10px] font-mono rounded bg-surface px-1.5 py-0.5 border border-border text-muted-foreground">
                    {analysis.technical.mechanism}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {analysis.technical.steps.map((st, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 bg-background/60 p-1.5 rounded border border-border/60 text-xs"
                    >
                      {st.token && (
                        <code className="shrink-0 font-mono text-[11px] font-bold text-amber-300 bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20">
                          {st.token}
                        </code>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-foreground text-[11px]">{st.label}</div>
                        <div className="text-muted-foreground text-[11px] leading-tight">{st.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Hypothèses & Risques de raisonnement (masqué par défaut, dépliable) */}
                {analysis.technical.assumptions.length > 0 && (
                  <details className="group/assumptions pt-2 border-t border-border/70 text-xs">
                    <summary className="cursor-pointer text-[11px] font-medium text-amber-400 hover:text-amber-300 transition list-none flex items-center justify-between select-none py-0.5">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="size-3 text-amber-400" />
                        <span>Hypothèses & Risques de raisonnement ({analysis.technical.assumptions.length})</span>
                      </span>
                      <ChevronDown className="size-3 transition-transform group-open/assumptions:rotate-180" />
                    </summary>
                    <ul className="mt-2 space-y-1.5 pl-2 text-[11px] text-muted-foreground">
                      {analysis.technical.assumptions.map((ass, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-amber-400 shrink-0">•</span>
                          <span>{ass}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>

              {/* 3. Détail des tokens syntaxiques (dépliable) */}
              <details className="group/tokens text-xs">
                <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground transition list-none flex items-center gap-1.5 select-none py-0.5">
                  <ChevronDown className="size-3 transition-transform group-open/tokens:rotate-180" />
                  <span>Détail syntaxique des tokens ({segments.length})</span>
                </summary>
                <ul className="mt-2 space-y-1 pl-4 border-l border-border/60">
                  {segments.map((s, i) => (
                    <li key={i} className="flex gap-2 text-xs">
                      <code className={cn("shrink-0 font-mono", TOK_COLOR[s.kind])}>{s.text}</code>
                      <span className="text-muted-foreground">{s.label}</span>
                    </li>
                  ))}
                  {rule.replacement !== undefined && (
                    <li className="flex items-center gap-2 text-xs pt-1.5 mt-1 border-t border-border/50 text-cyan-400">
                      <code className="shrink-0 font-mono font-bold bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20 text-cyan-300">
                        ➜ {rule.replacement}
                      </code>
                      <span className="text-muted-foreground">
                        formule de remplacement appliquée aux groupes
                      </span>
                    </li>
                  )}
                </ul>
              </details>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
                  Pour votre outil
                </div>
                {/* Sélecteur FR / EN */}
                <div className="flex items-center rounded-md border border-border bg-surface-2 p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setCodeLocale("fr")}
                    className={cn(
                      "rounded px-2 py-0.5 font-medium transition cursor-pointer",
                      codeLocale === "fr"
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    title="Formules adaptées aux versions françaises (ex: REGEX.EXTRAIRE avec séparateur point-virgule ;)"
                  >
                    🇫🇷 FR
                  </button>
                  <button
                    type="button"
                    onClick={() => setCodeLocale("en")}
                    className={cn(
                      "rounded px-2 py-0.5 font-medium transition cursor-pointer",
                      codeLocale === "en"
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    title="English formulas & comma separators (e.g. REGEXEXTRACT with comma ,)"
                  >
                    🇬🇧 EN
                  </button>
                </div>
              </div>

              <select
                value={dialectId}
                onChange={(e) => setDialectId(e.target.value)}
                className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              >
                {DIALECTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>

              {(() => {
                const snippet = dialect.snippet(
                  rule.source,
                  codeLocale === "fr" ? "texte" : "text",
                  codeLocale,
                  rule.replacement,
                );
                const note =
                  typeof dialect.note === "function"
                    ? dialect.note(codeLocale, rule.replacement)
                    : dialect.note;
                return (
                  <>
                    <div className="rounded-md border border-border bg-background p-3 shadow-inner">
                      <pre className="whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-foreground">
                        {snippet}
                      </pre>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        onClick={() => copy(snippet, "snippet")}
                        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium transition hover:border-primary hover:text-primary cursor-pointer active:scale-95"
                      >
                        {copied === "snippet" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}{" "}
                        Copier la formule ({codeLocale.toUpperCase()})
                      </button>
                      <button
                        onClick={() => copy(dialect.pattern(rule.source), "pattern")}
                        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium transition hover:border-primary hover:text-primary cursor-pointer active:scale-95"
                      >
                        {copied === "pattern" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}{" "}
                        Copier le motif
                      </button>
                    </div>
                    {/* Alerte rouge clignotante pour utilisateurs Excel hors Office 365 */}
                    {dialectId === "excel" && (
                      <div className="mt-3 rounded-lg border-2 border-red-500/60 bg-red-950/25 p-3 text-xs space-y-2 shadow-sm">
                        <div className="flex items-center gap-2">
                          <span className="relative flex size-2.5 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
                          </span>
                          <span className="font-bold text-red-400 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                            <AlertTriangle className="size-3.5 text-red-400" />
                            Alerte compatibilité : Nécessite Office 365 / Excel 2024+
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-red-200/90 font-medium">
                          La fonction <code className="rounded bg-red-950/80 px-1 py-0.5 font-mono text-red-300 font-semibold">{codeLocale === "fr" ? "REGEX.EXTRAIRE" : "REGEXEXTRACT"}</code> n'existe <strong>que</strong> dans Microsoft 365 et Excel Web.
                        </p>
                        <div className="rounded bg-red-900/40 border border-red-500/40 p-2 text-[11px] text-red-200 leading-normal">
                          ⚠️ <strong>Pour les dinosaures sur Excel 2016, 2019 ou 2021 :</strong> cette formule provoquera l'erreur <span className="font-mono font-bold text-white bg-red-600 px-1 py-0.5 rounded">#NOM?</span> !
                        </div>
                        <div className="text-[11px] text-red-200/90 space-y-1.5 pt-0.5">
                          <div className="font-semibold text-red-300">💡 Solutions simples sans Office 365 :</div>
                          <ul className="pl-1 space-y-1.5 text-muted-foreground list-none">
                            <li className="flex items-start gap-1.5">
                              <span className="text-primary font-bold">1.</span>
                              <div>
                                <strong className="text-foreground">Recommandé :</strong> Cliquez sur {onCopyTable ? (
                                  <button
                                    type="button"
                                    onClick={onCopyTable}
                                    className="font-bold text-primary underline underline-offset-2 hover:text-primary/80 cursor-pointer"
                                  >
                                    « Copier le tableau »
                                  </button>
                                ) : "« Copier le tableau »"} en haut pour coller directement les résultats déjà calculés !
                              </div>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span className="text-amber-400 font-bold">2.</span>
                              <div>
                                <strong className="text-foreground">Option Macro VBA :</strong> Basculez sur <button type="button" onClick={() => setDialectId("excel-vba")} className="font-semibold text-amber-300 underline underline-offset-2 hover:text-amber-200 cursor-pointer">« Excel 2010 - 2021 (Sans REGEX.EXTRAIRE / VBA) »</button> pour générer le code VBA compatible.
                              </div>
                            </li>
                          </ul>
                        </div>
                      </div>
                    )}
                    {note && (
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                        {note}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </aside>

      <LLMControlDialog open={llmDialogOpen} onClose={() => setLlmDialogOpen(false)} />
      <ExternalPromptDialog
        open={externalPromptOpen}
        onClose={() => setExternalPromptOpen(false)}
        column={column}
        rows={rows}
      />
    </>
  );
}
