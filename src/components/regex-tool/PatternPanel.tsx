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
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { explain } from "@/lib/regex-synth/explain";
import { DIALECTS } from "@/lib/regex-synth/dialects";
import { describeTransform } from "@/lib/regex-synth/engine";
import type { OutputColumn } from "./types";
import { LLMControlDialog } from "./LLMControlDialog";
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
  onTriggerLLM,
  isLLMRunning,
  llmReport,
}: {
  column: OutputColumn | null;
  rowCount: number;
  rows?: string[];
  onGoToRow?: (row: number) => void;
  combined?: { source: string; names: string[]; covered: number; total: number } | null;
  onTriggerLLM?: () => void;
  isLLMRunning?: boolean;
  llmReport?: ModelProgressReport;
}) {
  const [dialectId, setDialectId] = useState("python");
  const [copied, setCopied] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [llmDialogOpen, setLlmDialogOpen] = useState(false);

  const dialect = DIALECTS.find((d) => d.id === dialectId)!;
  const segments = useMemo(() => (column?.rule ? explain(column.rule.source) : []), [column?.rule]);

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

  const rule = column.rule;
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

        {combined && (
          <div className="border-b border-grid-line bg-surface-2/40 p-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                Regex combinée — toutes les colonnes
              </span>
              <button
                onClick={() => copy(combined.source, "combined")}
                className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-primary"
              >
                {copied === "combined" ? <Check className="size-3" /> : <Copy className="size-3" />}{" "}
                copier
              </button>
            </div>
            <div className="break-all rounded-md border border-border bg-background p-3 font-mono text-[12px] leading-relaxed text-derived">
              {combined.source}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Un seul passage extrait {combined.names.length} valeurs : groupe 1 ={" "}
              {combined.names.join(", groupe suivant = ")}. Couvre {combined.covered}/{combined.total}{" "}
              lignes.
            </p>
          </div>
        )}

        {!rule ? (
          <div className="space-y-4 p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-2 rounded-md border border-border bg-surface-2 p-3">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
              <p>
                {examples === 0
                  ? "Saisissez le résultat attendu sur 2 ou 3 lignes : le motif se déduit tout seul."
                  : "Aucune règle algorithmique classique n'explique tous vos exemples."}
              </p>
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

            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                Lecture du motif
              </div>
              <ul className="space-y-1">
                {segments.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <code className={cn("shrink-0 font-mono", TOK_COLOR[s.kind])}>{s.text}</code>
                    <span className="text-muted-foreground">{s.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                Pour votre outil
              </div>
              <select
                value={dialectId}
                onChange={(e) => setDialectId(e.target.value)}
                className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              >
                {DIALECTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <div className="rounded-md border border-border bg-background p-3">
                <pre className="whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-foreground">
                  {dialect.snippet(rule.source, "texte")}
                </pre>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  onClick={() => copy(dialect.snippet(rule.source, "texte"), "snippet")}
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs transition hover:border-primary hover:text-primary"
                >
                  {copied === "snippet" ? <Check className="size-3" /> : <Copy className="size-3" />}{" "}
                  Copier la formule
                </button>
                <button
                  onClick={() => copy(dialect.pattern(rule.source), "pattern")}
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs transition hover:border-primary hover:text-primary"
                >
                  {copied === "pattern" ? <Check className="size-3" /> : <Copy className="size-3" />}{" "}
                  Copier le motif
                </button>
              </div>
              {dialect.note && <p className="mt-2 text-xs text-muted-foreground">{dialect.note}</p>}

              {!isLLMRule && onTriggerLLM && column.failures.length === 0 && (
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Besoin d'une alternative ?</span>
                  <button
                    onClick={onTriggerLLM}
                    disabled={isLLMRunning}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition"
                  >
                    <Sparkles className="size-3.5" />
                    <span>Synthétiser avec l'IA locale</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>

      <LLMControlDialog open={llmDialogOpen} onClose={() => setLlmDialogOpen(false)} />
    </>
  );
}
