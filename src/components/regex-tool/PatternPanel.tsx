import { useMemo, useState } from "react";
import { Check, Copy, CircleAlert, CircleCheck, ChevronRight, PanelLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { explain } from "@/lib/regex-synth/explain";
import { DIALECTS } from "@/lib/regex-synth/dialects";
import { describeTransform } from "@/lib/regex-synth/engine";
import type { OutputColumn } from "./types";

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
}: {
  column: OutputColumn | null;
  rowCount: number;
  rows?: string[];
  onGoToRow?: (row: number) => void;
}) {
  const [dialectId, setDialectId] = useState("python");
  const [copied, setCopied] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
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

  return (
    <aside className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-l border-grid-line bg-surface">
      <div className="flex items-center justify-between border-b border-grid-line px-4 py-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Motif déduit</div>
          <div className="mt-0.5 truncate text-sm font-semibold">{column.name}</div>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          title="Replier le panneau"
          className="ml-2 shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-surface-2 hover:text-primary"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {!rule ? (
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <div className="flex items-start gap-2 rounded-md border border-border bg-surface-2 p-3">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
            <p>
              {examples === 0
                ? "Saisissez le résultat attendu sur 2 ou 3 lignes : le motif se déduit tout seul."
                : "Aucune règle unique n'explique tous vos exemples. Corrigez un exemple, ou ajoutez-en un plus représentatif."}
            </p>
          </div>
          <p className="text-xs">Exemples fournis : {examples}</p>
        </div>
      ) : (
        <div className="space-y-5 p-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                Expression
              </span>
              <button
                onClick={() => copy(rule.source, "raw")}
                className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-primary"
              >
                {copied === "raw" ? <Check className="size-3" /> : <Copy className="size-3" />} copier
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
                        {copied === `alt${i}` ? <Check className="size-3" /> : <Copy className="size-3" />} copier
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
              <span className="font-mono text-foreground">{column.matched}</span> / {rowCount} lignes
              couvertes
              {column.failures.length > 0 && (
                <span className="text-warn"> · {column.failures.length} en échec</span>
              )}
            </span>
          </div>

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
          </div>
        </div>
      )}
    </aside>
  );
}
