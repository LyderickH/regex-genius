import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Pencil,
  RotateCcw,
  X,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { explain, type Segment } from "@/lib/regex-synth/explain";
import { analyzeRegexFull } from "@/lib/regex-synth/human-explain";
import { DIALECTS, type CodeLocale } from "@/lib/regex-synth/dialects";
import { describeTransform, applyRule, type Rule } from "@/lib/regex-synth/engine";
import type { OutputColumn } from "./types";
import { LLMControlDialog } from "./LLMControlDialog";
import { ExternalPromptDialog } from "./ExternalPromptDialog";
import type { ModelProgressReport } from "@/lib/llm/types";
import {
  localLLM,
  type DecryptedPatternResult,
  type KnownPatternStep,
} from "@/lib/llm/webllm-service";

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
  onUpdateRule,
  onResetRule,
  sourceName,
  onSwitchToRawLines,
  onKeepOnlyTwoExamples,
  isDelimitedMode,
  onOpenFormatsGuide,
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
  onUpdateRule?: (newRule: Rule) => void;
  onResetRule?: () => void;
  sourceName?: string;
  onSwitchToRawLines?: () => void;
  onKeepOnlyTwoExamples?: () => void;
  isDelimitedMode?: boolean;
  onOpenFormatsGuide?: () => void;
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const isDecryptingRef = useRef(false);
  const lastAnalyzedPatternRef = useRef<string | null>(null);

  const examples = column ? column.user.filter((v) => v != null && v !== "").length : 0;

  // Détecter si les exemples saisis ne figurent pas dans la colonne source (ex: CSV découpé avec délimiteur)
  const valuesNotInSource = useMemo(() => {
    if (!column || examples === 0 || rows.length === 0) return false;
    let notFound = 0;
    const sample = column.user.filter((v) => v != null && v !== "").slice(0, 20);
    if (sample.length === 0) return false;
    for (const val of sample) {
      if (!rows.some((r) => r.includes(val))) notFound++;
    }
    return notFound >= Math.min(sample.length, 2);
  }, [column, examples, rows]);

  // Détecter si toutes les lignes ont été saisies comme exemples (Cas où tout le CSV a été importé comme résultats)
  const isAllFilledWithExamples =
    examples >= 3 && examples >= Math.min(rowCount, 20);

  // --- État de modification manuelle de la regex
  const [isEditing, setIsEditing] = useState(false);
  const [editedSource, setEditedSource] = useState(rule?.source ?? "");

  useEffect(() => {
    if (!isEditing) {
      setEditedSource(rule?.source ?? "");
    }
  }, [rule?.source, isEditing]);

  const { isValid, syntaxError, liveCoverage } = useMemo(() => {
    if (!editedSource.trim()) {
      return { isValid: false, syntaxError: "L'expression ne peut pas être vide.", liveCoverage: null };
    }
    try {
      new RegExp(editedSource, rule?.flags || "u");
    } catch (e) {
      return {
        isValid: false,
        syntaxError: e instanceof Error ? e.message : "Erreur de syntaxe regex",
        liveCoverage: null,
      };
    }

    if (!rule) {
      return { isValid: true, syntaxError: null, liveCoverage: null };
    }

    try {
      const tempRule: Rule = {
        ...rule,
        source: editedSource,
      };
      const res = applyRule(tempRule, rows ?? []);
      return { isValid: true, syntaxError: null, liveCoverage: res };
    } catch (e) {
      return {
        isValid: false,
        syntaxError: e instanceof Error ? e.message : "Erreur d'exécution de la regex",
        liveCoverage: null,
      };
    }
  }, [editedSource, rule, rows]);

  const handleApplyCustomRule = useCallback(() => {
    if (!rule || !isValid || !onUpdateRule) return;
    const updatedRule: Rule = {
      ...rule,
      source: editedSource.trim(),
      origin: "manual",
      originalAutoRule: rule.originalAutoRule ?? rule,
    };
    onUpdateRule(updatedRule);
    setIsEditing(false);
  }, [rule, isValid, onUpdateRule, editedSource]);

  const handleRevertToAuto = useCallback(() => {
    if (onResetRule) {
      onResetRule();
    } else if (rule?.originalAutoRule && onUpdateRule) {
      onUpdateRule(rule.originalAutoRule);
    }
    setIsEditing(false);
  }, [onResetRule, onUpdateRule, rule]);

  const handleDecryptWithLocalLLM = useCallback(async () => {
    if (!rule || isDecryptingRef.current) return;
    isDecryptingRef.current = true;
    setIsDecrypting(true);
    try {
      const examples: Array<{ input: string; output: string }> = [];
      if (rows && rows.length > 0) {
        for (let i = 0; i < rows.length; i++) {
          const u = column?.user?.[i] ?? column?.derived?.[i];
          const inp = rows[i];
          if (u && inp) {
            examples.push({ input: inp, output: u });
            if (examples.length >= 5) break;
          }
        }
      }

      const knownSteps: KnownPatternStep[] = (analysis.technical?.steps ?? []).map((s) => ({
        token: s.token,
        label: s.label,
        technical: s.technical || s.detail,
        human: s.human,
      }));

      const res = await localLLM.explainPattern(rule.source, examples, knownSteps);
      if (res && res.steps && res.steps.length > 0) {
        setLlmDecrypted(res);
        lastAnalyzedPatternRef.current = rule.source;
        toast.success("Explication IA générée !");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de décryptage IA");
    } finally {
      setIsDecrypting(false);
      isDecryptingRef.current = false;
    }
  }, [rule, column, rows, analysis]);

  const decryptFnRef = useRef(handleDecryptWithLocalLLM);
  decryptFnRef.current = handleDecryptWithLocalLLM;

  const currentRuleSource = column?.rule?.source;

  useEffect(() => {
    setShowUnexpectedOptions(false);
    setHoveredIndex(null);
    setSelectedIndex(null);
    if (!currentRuleSource) {
      setLlmDecrypted(null);
      lastAnalyzedPatternRef.current = null;
      return;
    }

    // Réinitialiser uniquement si le motif a changé par rapport au motif analysé
    if (currentRuleSource !== lastAnalyzedPatternRef.current) {
      setLlmDecrypted(null);
      // Auto-décryptage UNIQUEMENT si le modèle est DÉJÀ chargé en mémoire
      // et qu'aucune analyse n'est déjà en cours.
      if (localLLM.isLoaded() && !isDecryptingRef.current) {
        lastAnalyzedPatternRef.current = currentRuleSource;
        void decryptFnRef.current();
      }
    }
  }, [currentRuleSource]);

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

  const isLLMRule = rule?.origin === "llm";
  const isManualRule = rule?.origin === "manual";
  const hasOriginalAuto = Boolean(rule?.originalAutoRule);
  const activeIndex = hoveredIndex ?? selectedIndex;
  const activeSegment = activeIndex !== null && segments[activeIndex] ? segments[activeIndex] : null;

  return (
    <>
      <aside className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-l border-grid-line bg-surface custom-scrollbar">
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
            {/* Cas où les valeurs n'existent pas dans la source (ex: CSV découpé avec délimiteur par erreur) */}
            {valuesNotInSource && onSwitchToRawLines && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5 space-y-2.5 text-left animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <CircleAlert className="size-4 shrink-0 text-amber-400" />
                  <span>Pourquoi aucune regex n'est trouvée ?</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Vos valeurs attendues ne figurent pas dans la colonne source <strong className="text-foreground">« {sourceName || "Données source"} »</strong>. Votre fichier CSV a très probablement été découpé par délimiteur, ce qui a fragmenté la ligne brute !
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onSwitchToRawLines}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition shadow"
                  >
                    <FileText className="size-3.5" />
                    <span>Basculer en lignes brutes complètes (sans délimiteur)</span>
                  </button>
                  {onOpenFormatsGuide && (
                    <button
                      type="button"
                      onClick={onOpenFormatsGuide}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-amber-500/30 bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-amber-300 hover:bg-surface-3 transition"
                    >
                      <FileSpreadsheet className="size-3.5 text-amber-400" />
                      <span>Formats attendus</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Cas où toutes les lignes sont déjà remplies d'exemples */}
            {isAllFilledWithExamples && onKeepOnlyTwoExamples && (
              <div className="rounded-lg border border-primary/40 bg-primary/10 p-3.5 space-y-2 text-left animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                  <Sparkles className="size-4 shrink-0" />
                  <span>Toutes vos lignes sont remplies ({examples} exemples) !</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Regex Genius n'a besoin que de 1 ou 2 exemples pour déduire la formule. Laissez la machine calculer le reste !
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onKeepOnlyTwoExamples}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition shadow"
                  >
                    <Sparkles className="size-3.5" />
                    <span>Ne garder que 2 exemples et auto-compléter</span>
                  </button>
                  {onOpenFormatsGuide && (
                    <button
                      type="button"
                      onClick={onOpenFormatsGuide}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-primary/30 bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-surface-3 transition"
                    >
                      <FileSpreadsheet className="size-3.5 text-primary" />
                      <span>Formats attendus</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-md border border-border bg-surface-2 p-3">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
              <div className="space-y-1">
                <p>
                  {examples === 0
                    ? "Saisissez le résultat attendu sur 2 ou 3 lignes : le motif se déduit tout seul."
                    : "Aucune règle algorithmique classique n'explique tous vos exemples."}
                </p>
                {examples > 0 && !valuesNotInSource && (
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
              <div className="mb-2 flex items-center justify-between gap-1 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
                    Expression
                  </span>
                  {isManualRule ? (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1 font-medium">
                      <Pencil className="size-2.5 text-amber-400" />
                      <span>Modifiée manuellement</span>
                    </span>
                  ) : isLLMRule ? null : (
                    <span className="text-[10px] text-muted-foreground bg-surface-2 px-1.5 py-0.5 rounded border border-border/80 flex items-center gap-1">
                      <Settings2 className="size-2.5 text-primary" />
                      <span>Déduit automatiquement</span>
                    </span>
                  )}
                  {(isManualRule || hasOriginalAuto) && (
                    <button
                      type="button"
                      onClick={handleRevertToAuto}
                      className="inline-flex items-center gap-1 rounded bg-amber-500/10 hover:bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/30 transition cursor-pointer"
                      title="Revenir au motif initial déduit par le moteur"
                    >
                      <RotateCcw className="size-2.5" />
                      <span>Revenir à l'origine</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isEditing) {
                        setEditedSource(rule.source);
                      }
                      setIsEditing((v) => !v);
                    }}
                    className={cn(
                      "flex items-center gap-1 text-xs transition cursor-pointer px-1.5 py-0.5 rounded",
                      isEditing
                        ? "bg-primary/20 text-primary font-semibold border border-primary/30"
                        : "text-muted-foreground hover:text-primary hover:bg-surface-2",
                    )}
                    title={isEditing ? "Fermer l'éditeur de regex" : "Modifier et tester la regex manuellement"}
                  >
                    <Pencil className="size-3" />
                    <span>{isEditing ? "Fermer" : "Modifier"}</span>
                  </button>
                  <button
                    onClick={() => copy(rule.source, "raw")}
                    className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-primary cursor-pointer px-1.5 py-0.5 rounded hover:bg-surface-2"
                  >
                    {copied === "raw" ? <Check className="size-3" /> : <Copy className="size-3" />}{" "}
                    copier
                  </button>
                </div>
              </div>

              {/* Panneau interactif d'édition et test direct de la Regex */}
              {isEditing && (
                <div className="mb-3 rounded-lg border border-primary/40 bg-surface-2/80 p-3 shadow-md space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <Pencil className="size-3.5" />
                      <span>Tester & modifier l'expression</span>
                    </div>
                    {(isManualRule || hasOriginalAuto) && (
                      <button
                        type="button"
                        onClick={handleRevertToAuto}
                        className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 hover:underline cursor-pointer"
                        title="Rétablir l'expression initiale calculée par le moteur"
                      >
                        <RotateCcw className="size-3" />
                        <span>Rétablir l'origine</span>
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <textarea
                      value={editedSource}
                      onChange={(e) => setEditedSource(e.target.value)}
                      placeholder="Saisissez ou adaptez votre expression régulière..."
                      rows={2}
                      spellCheck={false}
                      className="w-full resize-y rounded-md border border-border bg-background p-2.5 font-mono text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {syntaxError && (
                    <div className="flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
                      <AlertTriangle className="size-3.5 shrink-0 text-rose-400" />
                      <span className="font-mono text-[11px]">{syntaxError}</span>
                    </div>
                  )}

                  {!syntaxError && liveCoverage && (
                    <div
                      className={cn(
                        "flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs",
                        liveCoverage.matched === rowCount && rowCount > 0
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : liveCoverage.matched > 0
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                            : "border-rose-500/30 bg-rose-500/10 text-rose-300",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        {liveCoverage.matched === rowCount && rowCount > 0 ? (
                          <CheckCircle2 className="size-3.5 text-emerald-400" />
                        ) : (
                          <Info className="size-3.5" />
                        )}
                        <span className="font-medium">
                          {liveCoverage.matched} / {rowCount} lignes couvertes (
                          {rowCount > 0 ? Math.round((liveCoverage.matched / rowCount) * 100) : 0}%)
                        </span>
                      </div>
                      {liveCoverage.failures.length > 0 && (
                        <span className="text-[11px] opacity-80">
                          {liveCoverage.failures.length} non reconnue{liveCoverage.failures.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditedSource(rule.source);
                        setIsEditing(false);
                      }}
                      className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground transition cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      disabled={!isValid || editedSource.trim() === rule.source.trim()}
                      onClick={handleApplyCustomRule}
                      className="flex items-center gap-1.5 rounded-md bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm transition cursor-pointer"
                    >
                      <Check className="size-3.5" />
                      <span>Appliquer au tableau</span>
                    </button>
                  </div>
                </div>
              )}
              <div
                className="break-all rounded-md border border-border bg-background p-3 font-mono text-[13px] leading-relaxed select-none"
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {segments.map((s, i) => {
                  const isActive = activeIndex === i;
                  return (
                    <span
                      key={i}
                      role="button"
                      tabIndex={0}
                      onMouseEnter={() => setHoveredIndex(i)}
                      onClick={() => setSelectedIndex((curr) => (curr === i ? null : i))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedIndex((curr) => (curr === i ? null : i));
                        }
                      }}
                      className={cn(
                        TOK_COLOR[s.kind],
                        "cursor-pointer transition-all duration-150 rounded px-0.5 inline-block select-none",
                        isActive
                          ? "bg-amber-400/25 ring-1 ring-amber-400/70 shadow-xs font-bold scale-105"
                          : "hover:bg-surface-2 hover:ring-1 hover:ring-border",
                      )}
                      title={`Cliquez pour figer l'explication : ${s.label}`}
                    >
                      {s.text}
                    </span>
                  );
                })}
              </div>

              {/* Barre dynamique d'explication interactive du token survolé / sélectionné */}
              <div className="mt-2 rounded-lg border border-border/80 bg-surface-2/40 p-2.5 transition-all text-xs min-h-[58px] flex items-center">
                {activeSegment ? (
                  <div className="w-full space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <code className="font-mono text-xs font-bold text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30 shrink-0">
                          {activeSegment.text}
                        </code>
                        <span className="text-[11px] font-semibold text-foreground truncate">
                          {activeSegment.label}
                        </span>
                        {selectedIndex === activeIndex && (
                          <span className="text-[10px] text-amber-400/80 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20 shrink-0">
                            figé
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-primary bg-primary/10 border border-primary/25 px-1.5 py-0.5 rounded">
                          {activeSegment.categoryLabel || activeSegment.kind}
                        </span>
                        {selectedIndex !== null && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIndex(null);
                              setHoveredIndex(null);
                            }}
                            className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-surface-2 transition cursor-pointer"
                            title="Désélectionner"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {activeSegment.detail || activeSegment.label}
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground/75 italic flex items-center gap-1.5">
                    <Info className="size-3.5 text-primary/70 shrink-0" />
                    <span>Survolez ou cliquez sur un élément de l'expression ci-dessus pour comprendre son rôle dans la regex.</span>
                  </p>
                )}
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

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
                  Lecture du motif
                </span>
                {!llmDecrypted && (
                  <button
                    type="button"
                    onClick={handleDecryptWithLocalLLM}
                    disabled={isDecrypting}
                    className="flex items-center gap-1.5 rounded-md border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-0.5 text-[10px] text-purple-300 font-semibold transition cursor-pointer disabled:opacity-50 shadow-xs"
                    title="Demander à l'IA locale (WebLLM / WebGPU) d'analyser le motif"
                  >
                    <Sparkles className={cn("size-2.5 text-purple-400", isDecrypting && "animate-spin text-purple-300")} />
                    <span>{isDecrypting ? (llmReport?.text || "Analyse IA...") : "Expliquer avec l'IA"}</span>
                  </button>
                )}
              </div>

              {isDecrypting && llmReport && (llmReport.status === "downloading" || llmReport.status === "loading") && (
                <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-purple-300">
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

              {/* En langage humain (clair et immédiat en une seule phrase percutante) */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
                <div className="flex items-center justify-between font-semibold text-primary text-xs">
                  <div className="flex items-center gap-1.5">
                    <Lightbulb className="size-4 text-primary" />
                    <span className="font-bold text-xs">En langage humain :</span>
                  </div>
                  {(llmDecrypted || rule.llmMetadata?.explanation) && (
                    <span className="text-[10px] text-purple-300 bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.2 rounded font-medium flex items-center gap-1">
                      <Sparkles className="size-2.5" />
                      Rédigé par IA locale
                    </span>
                  )}
                </div>
                <p className="text-xs text-foreground leading-relaxed font-normal">
                  {llmDecrypted?.summary || humanExplanation}
                </p>
              </div>

              {/* À vérifier si problème regex (masqué par défaut, dépliable) */}
              {analysis.technical.assumptions.length > 0 && (
                <details className="group/assumptions rounded-lg border border-border/70 bg-surface-2/30 p-2.5 text-xs">
                  <summary className="cursor-pointer text-[11px] font-medium text-amber-400 hover:text-amber-300 transition list-none flex items-center justify-between select-none py-0.5">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="size-3 text-amber-400" />
                      <span>À vérifier si problème regex ({analysis.technical.assumptions.length})</span>
                    </span>
                    <ChevronDown className="size-3 transition-transform group-open/assumptions:rotate-180" />
                  </summary>
                  <ul className="mt-2 space-y-1 pl-1 text-[11px] text-muted-foreground border-t border-border/50 pt-2">
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
