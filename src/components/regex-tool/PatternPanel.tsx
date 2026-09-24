import { useEffect, useMemo, useState } from "react";
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
  Info,
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
import { localLLM, type DecryptedPatternResult } from "@/lib/llm/webllm-service";

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

  const [llmDecrypted, setLlmDecrypted] = useState<DecryptedPatternResult | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [showUnexpectedOptions, setShowUnexpectedOptions] = useState(false);

  useEffect(() => {
    setLlmDecrypted(null);
    setShowUnexpectedOptions(false);
  }, [column?.rule?.source]);

  const handleDecryptWithLocalLLM = async () => {
    if (!rule) return;
    setIsDecrypting(true);
    try {
      const examples: Array<{ input: string; output: string }> = [];
      if (column?.user && rows) {
        for (let i = 0; i < rows.length; i++) {
          const u = column.user[i];
          const inp = rows[i];
          if (u && inp) {
            examples.push({ input: inp, output: u });
            if (examples.length >= 6) break;
          }
        }
      }
      const res = await localLLM.explainPattern(rule.source, examples);
      if (res) {
        setLlmDecrypted(res);
        toast.success("Motif décrypté par l'IA locale (angles technique & humain) !");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de décryptage IA");
    } finally {
      setIsDecrypting(false);
    }
  };

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
            ) : null}

            {/* RISQUE DE SÉCURITÉ REDOS (affiché uniquement en cas de risque réel) */}
            {rule.llmMetadata?.securityRisk &&
              rule.llmMetadata.securityRisk !== "low" &&
              rule.llmMetadata.securityRisk !== "none" && (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                    rule.llmMetadata.securityRisk === "high"
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-300",
                  )}
                >
                  <ShieldAlert className="size-4 shrink-0 text-rose-400" />
                  <div className="text-[11px]">
                    <span>Sécurité ReDoS : </span>
                    <strong className="uppercase">{rule.llmMetadata.securityRisk}</strong>
                    <span> — Risque de backtracking catastrophique</span>
                  </div>
                </div>
              )}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
                    Expression
                  </span>
                  {!isLLMRule && (
                    <span className="text-[10px] text-muted-foreground bg-surface-2 px-1.5 py-0.5 rounded border border-border/80 flex items-center gap-1">
                      <Settings2 className="size-2.5 text-primary" />
                      <span>Déduit automatiquement</span>
                    </span>
                  )}
                </div>
                <button
                  onClick={() => copy(rule.source, "raw")}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-primary cursor-pointer"
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

            <div className="rounded-md border border-border bg-surface-2 p-2.5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {column.failures.length === 0 ? (
                    <CircleCheck className="size-4 text-derived shrink-0" />
                  ) : (
                    <CircleAlert className="size-4 text-warn shrink-0" />
                  )}
                  <span>
                    <span className="font-mono font-semibold text-foreground">{column.matched}</span> / {rowCount}{" "}
                    lignes couvertes
                    {column.failures.length > 0 && (
                      <span className="text-warn font-semibold"> · {column.failures.length} en échec</span>
                    )}
                  </span>
                </div>
                {column.failures.length === 0 && onTriggerLLM && (
                  <button
                    type="button"
                    onClick={() => setShowUnexpectedOptions((prev) => !prev)}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition cursor-pointer flex items-center gap-1"
                  >
                    <span>Pas tout à fait ça ?</span>
                    <ChevronDown className={cn("size-3 transition-transform", showUnexpectedOptions && "rotate-180")} />
                  </button>
                )}
              </div>

              {column.failures.length === 0 && onTriggerLLM && showUnexpectedOptions && (
                <div className="pt-2 border-t border-border/60 space-y-2 text-[11px] text-muted-foreground">
                  <p className="leading-snug">
                    L'algorithme couvre toutes les lignes, mais si l'expression ne reflète pas votre règle métier :
                  </p>
                  {isLLMRunning ? (
                    <div className="flex items-center gap-2 text-xs text-amber-300 py-1">
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>{llmReport?.text || "Recherche d'une alternative..."}</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={onTriggerLLM}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 py-1.5 px-2 text-xs font-medium text-amber-300 transition cursor-pointer"
                        title="Demander à l'IA locale de déduire une autre regex"
                      >
                        <Sparkles className="size-3 text-amber-400" />
                        <span>Alternative IA locale</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExternalPromptOpen(true)}
                        className="inline-flex items-center justify-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 py-1.5 px-2.5 text-xs font-medium text-purple-300 transition cursor-pointer"
                        title="Générer un prompt optimisé pour ChatGPT / Claude"
                      >
                        <Bot className="size-3 text-purple-400" />
                        <span>Prompt IA externe</span>
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 italic">
                    💡 Astuce : saisir un exemple supplémentaire dans une autre cellule affine aussi directement la règle.
                  </p>
                </div>
              )}
            </div>

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

            {column.failures.length > 0 && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                    <Sparkles className="size-3.5 text-amber-400" />
                    <span>Résoudre les {column.failures.length} échec{column.failures.length > 1 ? "s" : ""}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Assistance IA</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  L'algorithme classique ne couvre pas ces lignes. Sollicitez l'IA locale (privée) ou générez un prompt pour votre IA externe :
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
                  <div className="flex gap-2 pt-0.5">
                    {onTriggerLLM && (
                      <button
                        type="button"
                        onClick={onTriggerLLM}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 px-2 py-1.5 text-xs font-semibold transition cursor-pointer"
                        title="Demander à l'IA locale (WebGPU) de chercher une regex couvrant toutes les lignes"
                      >
                        <Sparkles className="size-3.5" />
                        <span>IA locale (WebGPU)</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setExternalPromptOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer"
                      title="Générer un prompt complet prêt à coller pour ChatGPT, Claude ou Gemini"
                    >
                      <Bot className="size-3.5 text-purple-400" />
                      <span>Prompt externe</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
                  Lecture & Raisonnement du motif
                </span>
                <button
                  type="button"
                  onClick={handleDecryptWithLocalLLM}
                  disabled={isDecrypting}
                  className="flex items-center gap-1.5 rounded-md border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-1 text-[11px] text-purple-300 font-semibold transition cursor-pointer disabled:opacity-50 shadow-xs"
                  title="Demander à l'IA locale (WebLLM / WebGPU) d'expliquer chaque token sous un angle technique et humain"
                >
                  <Sparkles className={cn("size-3 text-purple-400", isDecrypting && "animate-spin text-purple-300")} />
                  <span>{isDecrypting ? (llmReport?.text || "Décryptage IA...") : "Décrypter avec l'IA locale"}</span>
                </button>
              </div>

              {isDecrypting && llmReport && (llmReport.status === "downloading" || llmReport.status === "loading") && (
                <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-purple-300">
                    <span className="truncate">{llmReport.text || "Chargement du modèle..."}</span>
                    <span className="font-mono font-semibold">{Math.round(llmReport.progressPercent)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full bg-purple-500 transition-all duration-300"
                      style={{ width: `${llmReport.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 1. En langage humain (clair et immédiat) */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
                <div className="flex items-center justify-between font-semibold text-primary text-xs">
                  <div className="flex items-center gap-1.5">
                    <Lightbulb className="size-3.5 text-primary" />
                    <span>En langage humain :</span>
                  </div>
                  {(llmDecrypted || rule.llmMetadata?.explanation) && (
                    <span className="text-[10px] text-purple-300 bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                      <Sparkles className="size-2.5" />
                      Rédigé par IA locale
                    </span>
                  )}
                </div>
                <p className="text-xs text-foreground leading-relaxed font-normal">
                  {llmDecrypted?.summary || analysis.human}
                </p>
              </div>

              {/* 2. Décryptage détaillé des tokens (angles technique & humain) */}
              <div className="rounded-lg border border-border bg-surface-2/60 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Cpu className="size-3.5 text-amber-400" />
                    <span>Explication détaillée des tokens :</span>
                  </span>
                  {llmDecrypted ? (
                    <span className="text-[10px] text-purple-300 bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                      <Sparkles className="size-2.5" />
                      Analysé par IA locale
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono rounded bg-surface px-1.5 py-0.5 border border-border text-muted-foreground">
                      {analysis.technical.mechanism}
                    </span>
                  )}
                </div>

                <div className="space-y-2.5">
                  {(llmDecrypted?.steps && llmDecrypted.steps.length > 0 ? llmDecrypted.steps : analysis.technical.steps).map((st, i) => (
                    <div
                      key={i}
                      className="bg-background/85 p-3 rounded-lg border border-border text-xs space-y-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {st.token && (
                          <code className="shrink-0 font-mono text-[11px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/25">
                            {st.token}
                          </code>
                        )}
                        <span className="text-[11px] font-semibold text-foreground truncate">{st.label}</span>
                      </div>

                      <div className="space-y-1.5 pt-1.5 border-t border-border/50 text-[11px]">
                        <div className="text-muted-foreground flex items-start gap-1.5 leading-relaxed">
                          <span className="font-semibold text-foreground/90 shrink-0">⚙️ D'un pdv technique :</span>
                          <span>{st.technical || st.detail}</span>
                        </div>
                        {st.human && (
                          <div className="text-emerald-400/90 flex items-start gap-1.5 leading-relaxed">
                            <span className="font-semibold text-emerald-400 shrink-0">💡 D'un pdv humain :</span>
                            <span>{st.human}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {rule.replacement !== undefined && (
                    <div className="bg-cyan-500/5 p-3 rounded-lg border border-cyan-500/20 text-xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <code className="shrink-0 font-mono text-[11px] font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/25">
                          ➜ {rule.replacement}
                        </code>
                        <span className="text-[11px] font-semibold text-cyan-300">Formule de substitution</span>
                      </div>
                      <div className="space-y-1.5 pt-1.5 border-t border-cyan-500/20 text-[11px]">
                        <div className="text-muted-foreground flex items-start gap-1.5 leading-relaxed">
                          <span className="font-semibold text-foreground/90 shrink-0">⚙️ D'un pdv technique :</span>
                          <span>Recompose le texte en substituant la chaîne par les groupes capturés selon le schéma « {rule.replacement} ».</span>
                        </div>
                        <div className="text-cyan-400/90 flex items-start gap-1.5 leading-relaxed">
                          <span className="font-semibold text-cyan-400 shrink-0">💡 D'un pdv humain :</span>
                          <span>Réordonne les fragments extraits pour produire le format cible demandé.</span>
                        </div>
                      </div>
                    </div>
                  )}
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
                    {/* Alerte compatibilité concise pour utilisateurs Excel */}
                    {dialectId === "excel" && (
                      <div className="mt-2.5 rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5 text-xs text-muted-foreground space-y-1.5">
                        <div className="flex items-center gap-1.5 font-semibold text-amber-300 text-[11px]">
                          <AlertTriangle className="size-3.5 text-amber-400 shrink-0" />
                          <span>Compatibilité : Requiert Microsoft 365 ou Excel Web</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          La formule renvoie <code className="rounded bg-rose-500/15 border border-rose-500/30 px-1 py-0.5 font-mono text-rose-300 font-semibold">#NOM?</code> sur Excel 2016, 2019 ou 2021.
                        </p>
                        <p className="text-[11px] leading-relaxed pt-1 border-t border-border/40 text-muted-foreground/90">
                          💡 <strong>Sans Office 365 :</strong> {onCopyTable ? (
                            <button
                              type="button"
                              onClick={onCopyTable}
                              className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80 cursor-pointer"
                            >
                              Copier le tableau calculé
                            </button>
                          ) : "Copiez le tableau calculé"} ou basculez sur l'option <button
                            type="button"
                            onClick={() => setDialectId("excel-vba")}
                            className="font-semibold text-amber-300 underline underline-offset-2 hover:text-amber-200 cursor-pointer"
                          >
                            Excel VBA
                          </button>.
                        </p>
                      </div>
                    )}
                    {note && (
                      <div className="mt-2.5 flex items-start gap-1.5 text-[11px] text-muted-foreground/80 leading-relaxed pt-1.5 border-t border-border/40">
                        <Info className="size-3.5 shrink-0 mt-0.5 text-muted-foreground/60" />
                        <span>{note}</span>
                      </div>
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
