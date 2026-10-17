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
  Plus,
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
  onOpenCheatSheet,
  onOpenSymbolDetail,
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
  onOpenCheatSheet?: (symbol?: string) => void;
  onOpenSymbolDetail?: (symbol: string) => void;
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
  const isAllFilledWithExamples = examples >= 3 && examples >= Math.min(rowCount, 20);

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
      return {
        isValid: false,
        syntaxError: "L'expression ne peut pas être vide.",
        liveCoverage: null,
      };
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
      <aside className="flex h-9 w-full shrink-0 flex-row items-center gap-2 border-t border-grid-line bg-surface px-3 md:h-auto md:w-9 md:flex-col md:gap-0 md:border-t-0 md:border-l md:px-0 md:py-3">
        <button
          onClick={() => setCollapsed(false)}
          title="Afficher le motif déduit"
          className="rounded-md p-1 text-muted-foreground transition hover:bg-surface-2 hover:text-primary"
        >
          <PanelLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1 truncate md:mt-3 md:[writing-mode:vertical-rl]">
          <span className="text-xs font-semibold text-muted-foreground">
            Motif déduit{column ? ` — ${column.name}` : ""}
          </span>
        </div>
      </aside>
    );
  }

  if (!column) {
    return (
      <aside className="flex max-h-[50vh] w-full shrink-0 items-center justify-center border-t border-grid-line bg-surface p-6 text-center text-sm text-muted-foreground md:max-h-none md:w-[380px] md:border-t-0 md:border-l">
        Sélectionnez une colonne de résultat pour voir son expression régulière.
      </aside>
    );
  }

  const isLLMRule = rule?.origin === "llm";
  const isManualRule = rule?.origin === "manual";
  const hasOriginalAuto = Boolean(rule?.originalAutoRule);
  const activeIndex = hoveredIndex ?? selectedIndex;
  const activeSegment =
    activeIndex !== null && segments[activeIndex] ? segments[activeIndex] : null;

  /** Libellé de section : casse normale, pas de monospace. */
  const LABEL = "text-xs font-semibold text-muted-foreground";
  /** Bouton secondaire (contour neutre). */
  const BTN_SECONDARY =
    "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/50 hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50";
  /** Bouton primaire (un seul par section). */
  const BTN_PRIMARY =
    "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40";
  /** Bouton discret (icône + texte). */
  const BTN_GHOST =
    "inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition hover:bg-surface-2 hover:text-primary";
  /** Badge informatif. */
  const BADGE =
    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium";
  const SECTION = "px-4 py-4";

  return (
    <>
      <aside className="flex max-h-[50vh] w-full shrink-0 flex-col overflow-y-auto border-t border-grid-line bg-surface custom-scrollbar md:max-h-none md:w-[380px] md:border-t-0 md:border-l">
        <div className="flex items-center justify-between border-b border-grid-line px-4 py-3">
          <div className="min-w-0">
            <div className={LABEL}>Motif déduit</div>
            <div className="mt-0.5 truncate text-sm font-semibold text-foreground">
              {column.name}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLlmDialogOpen(true)}
              title="Configurer l'IA locale (Fallback)"
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-2 hover:text-primary"
            >
              <Cpu className="size-4" />
            </button>
            <button
              onClick={() => setCollapsed(true)}
              title="Replier le panneau"
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-2 hover:text-primary"
            >
              <ChevronDown className="size-4 md:hidden" />
              <ChevronRight className="hidden size-4 md:block" />
            </button>
          </div>
        </div>

        <div className="divide-y divide-grid-line">
          {combined ? (
            <section className={SECTION}>
              <button
                onClick={() => setShowCombined((prev) => !prev)}
                className="flex w-full cursor-pointer items-center justify-between rounded-md border border-primary/30 bg-primary-soft px-3 py-2 text-xs font-semibold text-primary transition hover:border-primary/50"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="size-3.5" />
                  <span>Obtenir la regex pour toutes les colonnes ({combined.names.length})</span>
                </div>
                <ChevronDown
                  className={cn("size-3.5 transition-transform", showCombined && "rotate-180")}
                />
              </button>
              {showCombined && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={LABEL}>
                      1 seul passage extrait {combined.names.length} colonnes
                    </span>
                    <button onClick={() => copy(combined.source, "combined")} className={BTN_GHOST}>
                      {copied === "combined" ? (
                        <Check className="size-3" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      <span>Copier</span>
                    </button>
                  </div>
                  <div className="break-all rounded-md border border-border bg-background p-2.5 font-mono text-[12px] leading-relaxed text-derived">
                    {combined.source}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Groupes de capture :{" "}
                    {combined.names.map((n, idx) => `$${idx + 1} = ${n}`).join(", ")}. Couvre{" "}
                    {combined.covered}/{combined.total} lignes.
                  </p>
                </div>
              )}
            </section>
          ) : null}

          {!rule ? (
            <>
              {/* Cas où les valeurs n'existent pas dans la source (ex: CSV découpé avec délimiteur par erreur) */}
              {valuesNotInSource && onSwitchToRawLines && (
                <section className={cn(SECTION, "space-y-2.5 animate-in fade-in duration-200")}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-warn">
                    <CircleAlert className="size-4 shrink-0" />
                    <span>Pourquoi aucune regex n'est trouvée ?</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Vos valeurs attendues ne figurent pas dans la colonne source{" "}
                    <strong className="text-foreground">
                      « {sourceName || "Données source"} »
                    </strong>
                    . Votre fichier CSV a très probablement été découpé par délimiteur, ce qui a
                    fragmenté la ligne brute !
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button type="button" onClick={onSwitchToRawLines} className={BTN_PRIMARY}>
                      <FileText className="size-3.5" />
                      <span>Basculer en lignes brutes complètes (sans délimiteur)</span>
                    </button>
                    {onOpenFormatsGuide && (
                      <button type="button" onClick={onOpenFormatsGuide} className={BTN_SECONDARY}>
                        <FileSpreadsheet className="size-3.5 text-muted-foreground" />
                        <span>Formats attendus</span>
                      </button>
                    )}
                  </div>
                </section>
              )}

              {/* Cas où toutes les lignes sont déjà remplies d'exemples */}
              {isAllFilledWithExamples && onKeepOnlyTwoExamples && (
                <section className={cn(SECTION, "space-y-2.5 animate-in fade-in duration-200")}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Sparkles className="size-4 shrink-0" />
                    <span>Toutes vos lignes sont remplies ({examples} exemples) !</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Regex Genius n'a besoin que de 1 ou 2 exemples pour déduire la formule. Laissez
                    la machine calculer le reste !
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button type="button" onClick={onKeepOnlyTwoExamples} className={BTN_PRIMARY}>
                      <Sparkles className="size-3.5" />
                      <span>Ne garder que 2 exemples et auto-compléter</span>
                    </button>
                    {onOpenFormatsGuide && (
                      <button type="button" onClick={onOpenFormatsGuide} className={BTN_SECONDARY}>
                        <FileSpreadsheet className="size-3.5 text-muted-foreground" />
                        <span>Formats attendus</span>
                      </button>
                    )}
                  </div>
                </section>
              )}

              <section className={cn(SECTION, "space-y-3 text-sm text-muted-foreground")}>
                <div className="flex items-start gap-2 rounded-md border border-border bg-surface-2 p-3">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
                  <div className="space-y-1.5">
                    <p className="text-foreground">
                      {examples === 0
                        ? "Saisissez le résultat attendu sur 2 ou 3 lignes : le motif se déduit tout seul."
                        : "Aucune règle algorithmique classique n'explique tous vos exemples."}
                    </p>
                    {examples > 0 && !valuesNotInSource && (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        <Lightbulb className="mr-1 inline size-3.5 -translate-y-px text-primary" />
                        <strong>Astuce :</strong> Vérifiez que la colonne à gauche marquée{" "}
                        <strong>[Source]</strong> contient bien le texte à découper. Si le texte
                        brut se trouve dans une autre colonne, cliquez sur le bouton{" "}
                        <span className="font-mono text-primary">⭰</span> sur son en-tête pour la
                        définir comme source.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Exemples fournis : {examples}</span>
                  <button
                    onClick={() => setLlmDialogOpen(true)}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Gérer l'IA locale
                  </button>
                </div>
              </section>

              {/* Déclencheur Fallback IA Locale */}
              {examples > 0 && onTriggerLLM && (
                <section className={cn(SECTION, "space-y-2.5")}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sparkles className="size-4 text-primary" />
                    <span>Activer le fallback IA locale</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Le moteur algorithmique n'a pas suffi. Vous pouvez solliciter le LLM local
                    (WebGPU) pour proposer une expression qui sera validée algorithmiquement.
                  </p>

                  {isLLMRunning ? (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center gap-2 text-xs text-primary">
                        <RefreshCw className="size-3.5 animate-spin" />
                        <span>{llmReport?.text || "Synthèse LLM locale en cours..."}</span>
                      </div>
                      {llmReport &&
                        (llmReport.status === "downloading" || llmReport.status === "loading") && (
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${llmReport.progressPercent}%` }}
                            />
                          </div>
                        )}
                    </div>
                  ) : (
                    <button onClick={onTriggerLLM} className={cn(BTN_PRIMARY, "w-full py-2")}>
                      <Sparkles className="size-3.5" />
                      Synthétiser avec le LLM local (privé)
                    </button>
                  )}
                </section>
              )}

              {/* Fallback ultime : Prompt pour votre propre IA (ChatGPT, Claude, Gemini) */}
              {examples > 0 && (
                <section className={cn(SECTION, "space-y-2.5")}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Bot className="size-4 text-muted-foreground" />
                      <span>Prompt pour votre propre IA</span>
                    </div>
                    <span className={cn(BADGE, "border-border bg-surface-2 text-muted-foreground")}>
                      Claude · GPT · Gemini
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Quand rien ne marche ou pour les cas complexes : générez en 1 clic un prompt
                    ultra-optimisé avec tous vos exemples complétés, prêt à coller dans votre IA.
                  </p>
                  <button
                    onClick={() => setExternalPromptOpen(true)}
                    className={cn(BTN_SECONDARY, "w-full py-2")}
                  >
                    <Bot className="size-3.5" />
                    Générer le prompt pour votre propre IA
                  </button>
                </section>
              )}
            </>
          ) : (
            <>
              {/* ===== Section : Expression ===== */}
              <section className={cn(SECTION, "space-y-3")}>
                {/* BADGE D'ORIGINE DU RÉSULTAT */}
                {isLLMRule ? (
                  <div className="space-y-2 rounded-md border border-primary/25 bg-primary-soft p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-semibold text-primary">
                        <Sparkles className="size-3.5" /> Généré par IA locale
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-success">
                        <CheckCircle2 className="size-3.5" /> Regex vérifiée
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {rule.llmMetadata?.modelName ?? "LLM local"} ·{" "}
                        {rule.llmMetadata?.runtime?.toUpperCase() ?? "WEBGPU"}
                      </span>
                      <span>
                        {rule.llmMetadata?.positivePassed}/{rule.llmMetadata?.positiveTotal} validés
                        {rule.llmMetadata?.attemptsCount
                          ? ` (${rule.llmMetadata.attemptsCount} essais)`
                          : ""}
                      </span>
                    </div>
                    {rule.llmMetadata?.explanation && (
                      <p className="border-t border-primary/15 pt-2 text-xs text-muted-foreground">
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
                        "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
                        rule.llmMetadata.securityRisk === "high"
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-warn/30 bg-warn/10 text-warn",
                      )}
                    >
                      <ShieldAlert className="size-4 shrink-0" />
                      <div className="text-xs">
                        <span>Sécurité ReDoS : </span>
                        <strong className="font-semibold capitalize">
                          {rule.llmMetadata.securityRisk}
                        </strong>
                        <span> — Risque de backtracking catastrophique</span>
                      </div>
                    </div>
                  )}

                <div className="flex flex-wrap items-center justify-between gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={LABEL}>Expression</span>
                    {isManualRule ? (
                      <span className={cn(BADGE, "border-warn/30 bg-warn/10 text-warn")}>
                        <Pencil className="size-3" />
                        <span>Modifiée manuellement</span>
                      </span>
                    ) : isLLMRule ? null : (
                      <span
                        className={cn(BADGE, "border-border bg-surface-2 text-muted-foreground")}
                      >
                        <Settings2 className="size-3 text-primary" />
                        <span>Déduit automatiquement</span>
                      </span>
                    )}
                    {(isManualRule || hasOriginalAuto) && (
                      <button
                        type="button"
                        onClick={handleRevertToAuto}
                        className={cn(
                          BADGE,
                          "cursor-pointer border-border bg-surface-2 text-foreground transition hover:border-primary/50 hover:text-primary",
                        )}
                        title="Revenir au motif initial déduit par le moteur"
                      >
                        <RotateCcw className="size-3" />
                        <span>Revenir à l'origine</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isEditing) {
                          setEditedSource(rule.source);
                        }
                        setIsEditing((v) => !v);
                      }}
                      className={cn(
                        BTN_GHOST,
                        isEditing &&
                          "bg-primary-soft font-semibold text-primary hover:bg-primary-soft",
                      )}
                      title={
                        isEditing
                          ? "Fermer l'éditeur de regex"
                          : "Modifier et tester la regex manuellement"
                      }
                    >
                      <Pencil className="size-3" />
                      <span>{isEditing ? "Fermer" : "Modifier"}</span>
                    </button>
                    <button onClick={() => copy(rule.source, "raw")} className={BTN_GHOST}>
                      {copied === "raw" ? (
                        <Check className="size-3" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      <span>Copier</span>
                    </button>
                  </div>
                </div>

                {/* Panneau interactif d'édition et test direct de la Regex */}
                {isEditing && (
                  <div className="space-y-2.5 rounded-md border border-primary/40 bg-surface-2 p-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Pencil className="size-3.5 text-primary" />
                        <span>Tester & modifier l'expression</span>
                      </div>
                      {(isManualRule || hasOriginalAuto) && (
                        <button
                          type="button"
                          onClick={handleRevertToAuto}
                          className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
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
                      <div className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                        <AlertTriangle className="size-3.5 shrink-0" />
                        <span className="font-mono text-[11px]">{syntaxError}</span>
                      </div>
                    )}

                    {!syntaxError && liveCoverage && (
                      <div
                        className={cn(
                          "flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs",
                          liveCoverage.matched === rowCount && rowCount > 0
                            ? "border-success/30 bg-success-soft text-success"
                            : liveCoverage.matched > 0
                              ? "border-warn/30 bg-warn/10 text-warn"
                              : "border-destructive/30 bg-destructive/10 text-destructive",
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          {liveCoverage.matched === rowCount && rowCount > 0 ? (
                            <CheckCircle2 className="size-3.5" />
                          ) : (
                            <Info className="size-3.5" />
                          )}
                          <span className="font-medium tabular-nums">
                            {liveCoverage.matched} / {rowCount} lignes couvertes (
                            {rowCount > 0 ? Math.round((liveCoverage.matched / rowCount) * 100) : 0}
                            %)
                          </span>
                        </div>
                        {liveCoverage.failures.length > 0 && (
                          <span className="text-xs opacity-80">
                            {liveCoverage.failures.length} non reconnue
                            {liveCoverage.failures.length > 1 ? "s" : ""}
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
                        className={BTN_SECONDARY}
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        disabled={!isValid || editedSource.trim() === rule.source.trim()}
                        onClick={handleApplyCustomRule}
                        className={BTN_PRIMARY}
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
                        onClick={() => {
                          setSelectedIndex(i);
                          if (onOpenSymbolDetail) onOpenSymbolDetail(s.text);
                          else onOpenCheatSheet?.(s.text);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedIndex(i);
                            if (onOpenSymbolDetail) onOpenSymbolDetail(s.text);
                            else onOpenCheatSheet?.(s.text);
                          }
                        }}
                        className={cn(
                          TOK_COLOR[s.kind],
                          "inline-block cursor-pointer select-none rounded-sm px-0.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                          isActive
                            ? "bg-primary-soft ring-1 ring-primary/70"
                            : "hover:bg-surface-2 hover:ring-1 hover:ring-border",
                        )}
                        title={`Cliquez pour voir les exemples concrets de ce symbole : ${s.text}`}
                      >
                        {s.text}
                      </span>
                    );
                  })}
                </div>

                {/* Barre dynamique d'explication interactive du token survolé / sélectionné */}
                <div className="flex min-h-[64px] flex-col justify-center gap-1.5 rounded-md border border-border bg-surface-2 p-2.5 text-xs">
                  {activeSegment ? (
                    <div className="w-full space-y-1">
                      {/* Ligne 1 : Symbole + Catégorie + Bouton + d'ex + Désélectionner */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <code className="shrink-0 rounded-md border border-primary/30 bg-primary-soft px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
                            {activeSegment.text}
                          </code>
                          <span className="truncate text-xs font-semibold text-muted-foreground">
                            {activeSegment.categoryLabel || activeSegment.kind}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {(onOpenSymbolDetail || onOpenCheatSheet) && (
                            <button
                              type="button"
                              onClick={() => {
                                if (onOpenSymbolDetail) onOpenSymbolDetail(activeSegment.text);
                                else onOpenCheatSheet?.(activeSegment.text);
                              }}
                              className={cn(BTN_SECONDARY, "px-2 py-0.5")}
                              title="Ouvrir la boîte d'exemples de ce symbole"
                            >
                              <Plus className="size-3" />
                              <span>Exemples</span>
                            </button>
                          )}
                          {selectedIndex !== null && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedIndex(null);
                                setHoveredIndex(null);
                              }}
                              className="cursor-pointer rounded-md p-1 text-muted-foreground transition hover:bg-surface-3 hover:text-foreground"
                              title="Désélectionner"
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Ligne 2 : Libellé humain */}
                      <div className="text-xs font-semibold text-foreground">
                        {activeSegment.label}
                      </div>

                      {/* Ligne 3 : Explication détaillée */}
                      {activeSegment.detail && activeSegment.detail !== activeSegment.label && (
                        <p className="text-xs leading-snug text-muted-foreground">
                          {activeSegment.detail}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Info className="size-3.5 shrink-0 text-muted-foreground" />
                      <span>
                        Survolez un élément pour voir son rôle, ou cliquez dessus pour ouvrir sa
                        boîte d'exemples concrets.
                      </span>
                    </p>
                  )}
                </div>

                {rule.replacement !== undefined && (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-derived/30 bg-derived-soft px-3 py-1.5 text-xs">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="font-medium text-muted-foreground">
                        Formule de remplacement :
                      </span>
                      <code className="rounded-md border border-derived/20 bg-background px-1.5 py-0.5 font-mono font-semibold text-derived">
                        {rule.replacement}
                      </code>
                    </div>
                    <span className={cn(BADGE, "shrink-0 border-derived/30 text-derived")}>
                      Substitution
                    </span>
                  </div>
                )}
                {describeTransform(rule.transform) && (
                  <p className="text-xs text-muted-foreground">
                    Puis, sur la valeur extraite : {describeTransform(rule.transform)}. Cette étape
                    n'est pas incluse dans l'expression ci-dessous.
                  </p>
                )}
                {rule.extra && rule.extra.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Vos lignes contiennent plusieurs motifs. Les expressions suivantes sont
                      essayées dans l'ordre quand la première ne s'applique pas :
                    </p>
                    {rule.extra.map((alt, i) => (
                      <div key={i}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className={LABEL}>Motif {i + 2}</span>
                          <button onClick={() => copy(alt.source, `alt${i}`)} className={BTN_GHOST}>
                            {copied === `alt${i}` ? (
                              <Check className="size-3" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                            <span>Copier</span>
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
              </section>

              {/* ===== Section : Couverture ===== */}
              <section className={cn(SECTION, "space-y-3")}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    {column.failures.length === 0 ? (
                      <CircleCheck className="size-4 shrink-0 text-success" />
                    ) : (
                      <CircleAlert className="size-4 shrink-0 text-warn" />
                    )}
                    <span className="text-muted-foreground">
                      <span className="font-semibold tabular-nums text-foreground">
                        {column.matched}
                      </span>{" "}
                      / {rowCount} lignes couvertes
                      {column.failures.length > 0 && (
                        <span className="font-semibold text-warn">
                          {" "}
                          · {column.failures.length} en échec
                        </span>
                      )}
                    </span>
                  </div>
                  {column.failures.length === 0 && onTriggerLLM && (
                    <button
                      type="button"
                      onClick={() => setShowUnexpectedOptions((prev) => !prev)}
                      className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
                    >
                      <span>Pas tout à fait ça ?</span>
                      <ChevronDown
                        className={cn(
                          "size-3 transition-transform",
                          showUnexpectedOptions && "rotate-180",
                        )}
                      />
                    </button>
                  )}
                </div>

                {column.failures.length === 0 && onTriggerLLM && showUnexpectedOptions && (
                  <div className="space-y-2 rounded-md border border-border bg-surface-2 p-3 text-xs text-muted-foreground">
                    <p className="leading-snug">
                      L'algorithme couvre toutes les lignes, mais si l'expression ne reflète pas
                      votre règle métier :
                    </p>
                    {isLLMRunning ? (
                      <div className="flex items-center gap-2 py-1 text-xs text-primary">
                        <RefreshCw className="size-3.5 animate-spin" />
                        <span>{llmReport?.text || "Recherche d'une alternative..."}</span>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={onTriggerLLM}
                          className={cn(BTN_SECONDARY, "flex-1")}
                          title="Demander à l'IA locale de déduire une autre regex"
                        >
                          <Sparkles className="size-3 text-primary" />
                          <span>Alternative IA locale</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setExternalPromptOpen(true)}
                          className={BTN_SECONDARY}
                          title="Générer un prompt optimisé pour ChatGPT / Claude"
                        >
                          <Bot className="size-3 text-muted-foreground" />
                          <span>Prompt IA externe</span>
                        </button>
                      </div>
                    )}
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Lightbulb className="mt-px size-3.5 shrink-0 text-primary" />
                      <span>
                        Astuce : saisir un exemple supplémentaire dans une autre cellule affine
                        aussi directement la règle.
                      </span>
                    </p>
                  </div>
                )}

                {column.failures.length > 0 && (
                  <div>
                    <div className={cn(LABEL, "mb-1.5")}>Pourquoi ces lignes échouent</div>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Le motif ci-dessus ne retrouve pas son contexte dans ces lignes. Saisissez le
                      résultat attendu sur l'une d'elles pour aider la déduction.
                    </p>
                    <ul className="space-y-1">
                      {column.failures.slice(0, 6).map((r) => (
                        <li key={r}>
                          <button
                            onClick={() => onGoToRow?.(r)}
                            className="flex w-full gap-2 rounded-md border border-border bg-background px-2 py-1 text-left text-xs transition hover:border-warn"
                          >
                            <span className="shrink-0 font-mono text-muted-foreground">
                              {r + 1}
                            </span>
                            <span className="truncate font-mono text-foreground">
                              {rows[r] ?? ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {column.failures.length > 6 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        et {column.failures.length - 6} autre(s).
                      </p>
                    )}
                  </div>
                )}

                {column.failures.length > 0 && (
                  <div className="space-y-2.5 rounded-md border border-border bg-surface-2 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Sparkles className="size-3.5 text-primary" />
                        <span>
                          Résoudre les {column.failures.length} échec
                          {column.failures.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">Assistance IA</span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      L'algorithme classique ne couvre pas ces lignes. Sollicitez l'IA locale
                      (privée) ou générez un prompt pour votre IA externe :
                    </p>

                    {isLLMRunning ? (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-2 text-xs text-primary">
                          <RefreshCw className="size-3.5 animate-spin" />
                          <span>{llmReport?.text || "Synthèse LLM locale en cours..."}</span>
                        </div>
                        {llmReport &&
                          (llmReport.status === "downloading" ||
                            llmReport.status === "loading") && (
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                              <div
                                className="h-full bg-primary transition-all duration-300"
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
                            className={cn(BTN_PRIMARY, "flex-1")}
                            title="Demander à l'IA locale (WebGPU) de chercher une regex couvrant toutes les lignes"
                          >
                            <Sparkles className="size-3.5" />
                            <span>IA locale (WebGPU)</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExternalPromptOpen(true)}
                          className={BTN_SECONDARY}
                          title="Générer un prompt complet prêt à coller pour ChatGPT, Claude ou Gemini"
                        >
                          <Bot className="size-3.5 text-muted-foreground" />
                          <span>Prompt externe</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* ===== Section : Lecture du motif ===== */}
              <section className={cn(SECTION, "space-y-3")}>
                <div className="flex items-center justify-between">
                  <span className={LABEL}>Lecture du motif</span>
                  {!llmDecrypted && (
                    <button
                      type="button"
                      onClick={handleDecryptWithLocalLLM}
                      disabled={isDecrypting}
                      className={cn(BTN_SECONDARY, "px-2 py-1")}
                      title="Demander à l'IA locale (WebLLM / WebGPU) d'analyser le motif"
                    >
                      <Sparkles
                        className={cn("size-3 text-primary", isDecrypting && "animate-spin")}
                      />
                      <span>
                        {isDecrypting ? llmReport?.text || "Analyse IA..." : "Expliquer avec l'IA"}
                      </span>
                    </button>
                  )}
                </div>

                {isDecrypting &&
                  llmReport &&
                  (llmReport.status === "downloading" || llmReport.status === "loading") && (
                    <div className="space-y-1 rounded-md border border-border bg-surface-2 p-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="truncate">
                          {llmReport.text || "Chargement du modèle..."}
                        </span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {Math.round(llmReport.progressPercent)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${llmReport.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                {/* En langage humain (clair et immédiat en une seule phrase percutante) */}
                <div className="space-y-1.5 rounded-md border border-primary/25 bg-primary-soft p-3">
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-primary">
                    <div className="flex items-center gap-1.5">
                      <Lightbulb className="size-4" />
                      <span>En langage humain :</span>
                    </div>
                    {(llmDecrypted || rule.llmMetadata?.explanation) && (
                      <span
                        className={cn(BADGE, "border-border bg-surface-2 text-muted-foreground")}
                      >
                        <Sparkles className="size-3 text-primary" />
                        Rédigé par IA locale
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">
                    {llmDecrypted?.summary || humanExplanation}
                  </p>
                </div>

                {/* À vérifier si problème regex (masqué par défaut, dépliable) */}
                {analysis.technical.assumptions.length > 0 && (
                  <details className="group/assumptions rounded-md border border-border bg-surface-2 p-2.5 text-xs">
                    <summary className="flex cursor-pointer select-none list-none items-center justify-between py-0.5 text-xs font-semibold text-warn transition hover:text-foreground">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="size-3.5" />
                        <span>
                          À vérifier si problème regex ({analysis.technical.assumptions.length})
                        </span>
                      </span>
                      <ChevronDown className="size-3.5 transition-transform group-open/assumptions:rotate-180" />
                    </summary>
                    <ul className="mt-2 space-y-1 border-t border-border pt-2 pl-1 text-xs text-muted-foreground">
                      {analysis.technical.assumptions.map((ass, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="shrink-0 text-warn">•</span>
                          <span>{ass}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>

              {/* ===== Section : Pour votre outil ===== */}
              <section className={cn(SECTION, "space-y-3")}>
                <div className="flex items-center justify-between">
                  <span className={LABEL}>Pour votre outil</span>
                  {/* Sélecteur FR / EN */}
                  <div className="flex items-center rounded-md border border-border bg-surface-2 p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCodeLocale("fr")}
                      className={cn(
                        "cursor-pointer rounded-sm px-2 py-0.5 font-medium transition",
                        codeLocale === "fr"
                          ? "bg-surface-3 font-semibold text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      title="Formules adaptées aux versions françaises (ex: REGEX.EXTRAIRE avec séparateur point-virgule ;)"
                    >
                      FR
                    </button>
                    <button
                      type="button"
                      onClick={() => setCodeLocale("en")}
                      className={cn(
                        "cursor-pointer rounded-sm px-2 py-0.5 font-medium transition",
                        codeLocale === "en"
                          ? "bg-surface-3 font-semibold text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      title="English formulas & comma separators (e.g. REGEXEXTRACT with comma ,)"
                    >
                      EN
                    </button>
                  </div>
                </div>

                <select
                  value={dialectId}
                  onChange={(e) => setDialectId(e.target.value)}
                  className="h-8 w-full cursor-pointer rounded-md border border-border bg-surface-2 px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
                      <div className="rounded-md border border-border bg-background p-3">
                        <pre className="whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-foreground">
                          {snippet}
                        </pre>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => copy(snippet, "snippet")}
                          className={cn(BTN_PRIMARY, "active:scale-95")}
                        >
                          {copied === "snippet" ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                          Copier la formule ({codeLocale.toUpperCase()})
                        </button>
                        <button
                          onClick={() => copy(dialect.pattern(rule.source), "pattern")}
                          className={cn(BTN_SECONDARY, "active:scale-95")}
                        >
                          {copied === "pattern" ? (
                            <Check className="size-3.5 text-success" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                          Copier le motif
                        </button>
                      </div>
                      {/* Alerte compatibilité concise pour utilisateurs Excel */}
                      {dialectId === "excel" && (
                        <div className="space-y-1.5 rounded-md border border-warn/25 bg-warn/5 p-2.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-warn">
                            <AlertTriangle className="size-3.5 shrink-0" />
                            <span>Compatibilité : Requiert Microsoft 365 ou Excel Web</span>
                          </div>
                          <p className="text-xs leading-relaxed">
                            La formule renvoie{" "}
                            <code className="rounded-sm border border-destructive/30 bg-destructive/10 px-1 py-0.5 font-mono font-semibold text-destructive">
                              #NOM?
                            </code>{" "}
                            sur Excel 2016, 2019 ou 2021.
                          </p>
                          <p className="border-t border-border pt-1.5 text-xs leading-relaxed text-muted-foreground">
                            <strong className="text-foreground">Sans Office 365 :</strong>{" "}
                            {onCopyTable ? (
                              <button
                                type="button"
                                onClick={onCopyTable}
                                className="cursor-pointer font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                              >
                                Copier le tableau calculé
                              </button>
                            ) : (
                              "Copiez le tableau calculé"
                            )}{" "}
                            ou basculez sur l'option{" "}
                            <button
                              type="button"
                              onClick={() => setDialectId("excel-vba")}
                              className="cursor-pointer font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                            >
                              Excel VBA
                            </button>
                            .
                          </p>
                        </div>
                      )}
                      {note && (
                        <div className="flex items-start gap-1.5 border-t border-grid-line pt-2.5 text-xs leading-relaxed text-muted-foreground">
                          <Info className="mt-0.5 size-3.5 shrink-0" />
                          <span>{note}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </section>
            </>
          )}
        </div>
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
