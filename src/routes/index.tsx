import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardPaste,
  ClipboardCopy,
  Upload,
  FileSpreadsheet,
  FileText,
  Trash2,
  Regex,
  Sparkles,
  Plus,
  ArrowUpToLine,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { DataGrid, type GridSel } from "@/components/regex-tool/DataGrid";
import { PatternPanel } from "@/components/regex-tool/PatternPanel";
import { WelcomeHero } from "@/components/regex-tool/WelcomeHero";
import { LLMControlDialog } from "@/components/regex-tool/LLMControlDialog";
import { localLLM } from "@/lib/llm/webllm-service";
import { runSynthesisPipeline } from "@/lib/llm/pipeline";
import type { ModelProgressReport } from "@/lib/llm/types";
import { emptyColumn, cellValue, type OutputColumn } from "@/components/regex-tool/types";
import { combineColumns, type SynthResult } from "@/lib/regex-synth/engine";
import {
  parseFile,
  parsePastedText,
  exportCsv,
  exportXlsx,
  toTsv,
  cellsToTsv,
  copyToClipboard,
  type Matrix,
} from "@/lib/data-io";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Regex par l'exemple — déduire un motif depuis vos données" },
      {
        name: "description",
        content:
          "Collez vos données, saisissez le résultat attendu sur quelques lignes : l'outil déduit l'expression régulière et remplit le reste. Export CSV, Excel, Python, SQL.",
      },
      { property: "og:title", content: "Regex par l'exemple" },
      {
        property: "og:description",
        content:
          "Générez une expression régulière à partir d'exemples, comme une colonne par l'exemple dans Power Query.",
      },
    ],
  }),
  component: Index,
});

/** Extrait de FEC (séparateur « | »), avec des cas volontairement piégeux. */
const SAMPLE = `VE | Ventes | VT0001 | 20240131 | 411000 | Clients divers | C0012 | SARL DUPONT & FILS | FA-2024-0001 | 20240131 | Facture FA-2024-0001 - SARL DUPONT | 1 250,00 | 0,00 | AA | 20240215 | 20240131 |  | EUR
AC | Achats | AC0087 | 20240205 | 401000 | Fournisseurs | F0031 | ÉTS MARTIN | FA/2024/87 | 20240203 | Achat fournitures - réf. 12/45 | 980,50 | 0,00 |  |  | 20240205 |  | EUR
BQ | Banque | BQ0142 | 20240229 | 512000 | Banque - compte courant |  |  | REL-02 | 20240229 | Virement client DUPONT | 0,00 | 3 410,90 | BB | 20240301 | 20240229 |  | EUR
OD | Opérations diverses | OD0009 | 20241231 | 681100 | Dotations amortissements |  |  | DOT-2024 | 20241231 | Amortissement matériel (5 ans) | 77,00 | 0,00 |  |  | 20241231 |  | EUR
VE | Ventes | VT0102 | 20250114 | 707000 | Ventes de marchandises | C0007 | LE COMPTOIR | FA-2025-0102 | 20250114 | Facture - lot n°12 000 pièces | 12 000,00 | 0,00 |  |  | 20250114 | 13 200,00 | USD
AC | Achats | AC0203 | 20250220 | 607000 | Achats marchandises | F0002 | IMPORT & CO | FA-2025/203 | 20250218 | Avoir sur facture 198 | -45,90 | 0,00 |  |  | 20250220 |  | EUR
BQ | Banque | BQ0311 | 20250331 | 627000 | Services bancaires |  |  | AGIOS-03 | 20250331 | Agios trimestre 1 | 8,90 | 0,00 |  |  | 20250331 |  | EUR
VE | Ventes | VT0115 | 20250402 | 707000 | Ventes de marchandises | C0012 | SARL DUPONT & FILS | FA-2025-0115 | 20250402 | Facture - remise 10 % | 2 300,00 | 0,00 | CC | 20250430 | 20250402 |  | EUR`;

function Index() {
  const [rows, setRows] = useState<string[]>([]);
  const [columns, setColumns] = useState<OutputColumn[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sel, setSel] = useState<GridSel | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [headerAsk, setHeaderAsk] = useState<Matrix | null>(null);

  // --- IA Locale (Fallback WebLLM / WebGPU)
  const [llmReport, setLlmReport] = useState<ModelProgressReport>({
    status: "idle",
    progressPercent: 0,
    text: "En attente",
  });
  const [isLLMRunning, setIsLLMRunning] = useState(false);
  const [llmControlOpen, setLlmControlOpen] = useState(false);

  useEffect(() => {
    return localLLM.subscribe(setLlmReport);
  }, []);

  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, string>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const reqId = useRef(0);
  const focus = useRef<{ colId: string; row: number } | null>(null);

  // --- historique (Ctrl+Z / Ctrl+Y) : on ne retient que les saisies, pas les déductions
  type Snap = { rows: string[]; columns: OutputColumn[]; key: string };
  const past = useRef<Snap[]>([]);
  const futureSnaps = useRef<Snap[]>([]);
  const lastSnap = useRef<Snap | null>(null);
  const restoring = useRef(false);


  const colsRef = useRef(columns);
  colsRef.current = columns;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const triggerLLMFallbackRef = useRef<((colId: string) => Promise<void>) | null>(null);

  useEffect(() => {
    const w = new Worker(new URL("../lib/regex-synth/synth.worker.ts", import.meta.url), {
      type: "module",
    });
    w.onmessage = (e: MessageEvent) => {
      const { id, result } = e.data as { id: number; result: SynthResult };
      const colId = pending.current.get(id);
      pending.current.delete(id);
      if (!colId) return;

      if (result.rule) {
        setColumns((cols) =>
          cols.map((c) =>
            c.id === colId
              ? {
                  ...c,
                  pending: false,
                  rule: result.rule,
                  derived: result.values,
                  matched: result.matched,
                  failures: result.failures,
                }
              : c,
          ),
        );
      } else {
        const col = colsRef.current.find((c) => c.id === colId);
        const hasExamples = col && col.user.some((v) => v != null && v !== "");
        if (hasExamples) {
          // Déclencher AUTOMATIQUEMENT le fallback IA locale lorsque l'algorithme échoue !
          triggerLLMFallbackRef.current?.(colId);
        } else {
          setColumns((cols) =>
            cols.map((c) =>
              c.id === colId
                ? {
                    ...c,
                    pending: false,
                    rule: null,
                    derived: result.values,
                    matched: 0,
                    failures: [],
                  }
                : c,
            ),
          );
        }
      }
    };
    workerRef.current = w;
    return () => w.terminate();
  }, []);

  const runSynth = useCallback((colId: string, inputs: string[], expected: (string | null)[]) => {
    const w = workerRef.current;
    if (!w) return;
    const id = ++reqId.current;
    pending.current.set(id, colId);
    w.postMessage({ id, inputs, expected });
  }, []);

  const scheduleSynth = useCallback(
    (colId: string, inputs: string[], expected: (string | null)[]) => {
      const existing = timers.current.get(colId);
      if (existing) clearTimeout(existing);
      setColumns((cols) => cols.map((c) => (c.id === colId ? { ...c, pending: true } : c)));
      timers.current.set(
        colId,
        setTimeout(() => runSynth(colId, inputs, expected), 250),
      );
    },
    [runSynth],
  );

  const triggerLLMFallback = useCallback(
    async (colId: string) => {
      const col = colsRef.current.find((c) => c.id === colId);
      if (!col) return;
      setIsLLMRunning(true);
      setColumns((cols) =>
        cols.map((c) => (c.id === colId ? { ...c, pending: true } : c)),
      );
      toast.info("Moteur classique insuffisant : activation de l'IA locale (WebGPU)...", { id: "llm-status" });
      try {
        const outcome = await runSynthesisPipeline(rowsRef.current, col.user, {
          colName: col.name,
          forceLLM: true,
        });

        if (outcome.origin === "llm") {
          setColumns((cols) =>
            cols.map((c) =>
              c.id === colId
                ? {
                    ...c,
                    pending: false,
                    rule: outcome.result.rule,
                    derived: outcome.result.values,
                    matched: outcome.result.matched,
                    failures: outcome.result.failures,
                  }
                : c,
            ),
          );
          toast.success("✓ Regex déduite par IA locale et vérifiée par les algorithmes !", {
            id: "llm-status",
          });
        } else if (outcome.origin === "algorithmic") {
          setColumns((cols) =>
            cols.map((c) =>
              c.id === colId
                ? {
                    ...c,
                    pending: false,
                    rule: outcome.result.rule,
                    derived: outcome.result.values,
                    matched: outcome.result.matched,
                    failures: outcome.result.failures,
                  }
                : c,
            ),
          );
          toast.success("⚙ Règle déduite par le moteur algorithmique.", { id: "llm-status" });
        } else {
          setColumns((cols) =>
            cols.map((c) => (c.id === colId ? { ...c, pending: false } : c)),
          );
          toast.error(outcome.error, { id: "llm-status" });
        }
      } catch (err) {
        setColumns((cols) =>
          cols.map((c) => (c.id === colId ? { ...c, pending: false } : c)),
        );
        toast.error(`Erreur IA locale : ${err instanceof Error ? err.message : String(err)}`, {
          id: "llm-status",
        });
      } finally {
        setIsLLMRunning(false);
      }
    },
    [],
  );
  triggerLLMFallbackRef.current = triggerLLMFallback;

  const snapshot = useCallback(
    (rs: string[], cols: OutputColumn[]): Snap => ({
      rows: rs.slice(),
      columns: cols.map((c) => ({ ...c, user: c.user.slice(), derived: c.derived.slice() })),
      key: `${rs.join("\u0000")}||${cols
        .map((c) => `${c.id}:${c.name}:${c.user.join("\u0001")}`)
        .join("\u0002")}`,
    }),
    [],
  );

  useEffect(() => {
    const snap = snapshot(rows, columns);
    if (restoring.current) {
      restoring.current = false;
      lastSnap.current = snap;
      return;
    }
    if (lastSnap.current && lastSnap.current.key !== snap.key) {
      past.current.push(lastSnap.current);
      if (past.current.length > 120) past.current.shift();
      futureSnaps.current = [];
    }
    lastSnap.current = snap;
  }, [rows, columns, snapshot]);

  /** Restaure un état du tableau et relance la déduction. */
  const restore = useCallback(
    (snap: Snap) => {
      restoring.current = true;
      setRows(snap.rows);
      setColumns(snap.columns);
      setSel(null);
      snap.columns.forEach((c) => {
        if (c.user.some((v) => v != null)) runSynth(c.id, snap.rows, c.user);
      });
    },
    [runSynth],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) {
      toast("Rien à annuler");
      return;
    }
    if (lastSnap.current) futureSnaps.current.push(lastSnap.current);
    restore(prev);
    toast.success("Annulé");
  }, [restore]);

  const redo = useCallback(() => {
    const next = futureSnaps.current.pop();
    if (!next) return;
    if (lastSnap.current) past.current.push(lastSnap.current);
    restore(next);
    toast.success("Rétabli");
  }, [restore]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const handleChangeCell = (colId: string, row: number, value: string) => {
    setActiveId(colId);
    setColumns((cols) =>
      cols.map((c) => {
        if (c.id !== colId) return c;
        const user = c.user.slice();
        user[row] = value === "" ? null : value;
        scheduleSynth(c.id, rows, user);
        return { ...c, user };
      }),
    );
  };

  const loadMatrix = (matrix: Matrix, names?: string[]) => {
    if (!matrix.length) {
      toast.error("Aucune donnée détectée");
      return;
    }
    const source = matrix.map((r) => (r[0] ?? "").toString());
    const extra = Math.max(0, ...matrix.map((r) => r.length)) - 1;
    const cols: OutputColumn[] = [];
    const count = Math.max(1, extra);
    for (let c = 0; c < count; c++) {
      const given = names?.[c + 1]?.trim();
      const col = emptyColumn(given ? given : `Résultat ${c + 1}`, source.length);
      if (c < extra) {
        col.user = matrix.map((r) => {
          const v = r[c + 1];
          return v == null || v === "" ? null : String(v);
        });
      }
      cols.push(col);
    }
    setRows(source);
    setColumns(cols);
    setActiveId(cols[0]?.id ?? null);
    setSel(null);
    cols.forEach((c) => {
      if (c.user.some((v) => v != null)) runSynth(c.id, source, c.user);
    });
    toast.success(`${source.length} lignes chargées`);
  };

  const handleFile = async (file: File) => {
    try {
      const matrix = await parseFile(file);
      if (matrix.length > 1) setHeaderAsk(matrix);
      else loadMatrix(matrix);
    } catch {
      toast.error("Impossible de lire ce fichier");
    }
  };

  /** Utilise la 1re ligne du tableau comme noms de colonnes. */
  const promoteHeader = () => {
    if (rows.length < 2) return;
    setColumns((cols) =>
      cols.map((c) => ({
        ...c,
        name: (c.user[0] ?? "").trim() || c.name,
        user: c.user.slice(1),
        derived: c.derived.slice(1),
      })),
    );
    const next = rows.slice(1);
    setRows(next);
    setSel(null);
    columns.forEach((c) => {
      const user = c.user.slice(1);
      if (user.some((v) => v != null)) scheduleSynth(c.id, next, user);
    });
    toast.success("Première ligne promue en en-tête");
  };

  const loadSample = () => {
    const source = SAMPLE.split("\n");
    const fill = (vals: (string | null)[]) =>
      source.map((_, i) => vals[i] ?? null) as (string | null)[];
    const debit = emptyColumn("Débit", source.length);
    debit.user = fill(["1250,00", "980,50"]);
    const piece = emptyColumn("N° de pièce", source.length);
    piece.user = fill(["FA-2024-0001", "FA/2024/87"]);
    setRows(source);
    setColumns([debit, piece]);
    setActiveId(debit.id);
    setSel(null);
    runSynth(debit.id, source, debit.user);
    runSynth(piece.id, source, piece.user);
  };

  /** Change une ligne de données source. */
  const handleChangeSource = (row: number, value: string) => {
    setRows((rs) => {
      const next = rs.slice();
      next[row] = value;
      columns.forEach((c) => scheduleSynth(c.id, next, c.user));
      return next;
    });
  };

  /** Ajoute une ligne vide en bas du tableau. */
  const addRow = () => {
    setRows((rs) => [...rs, ""]);
    setColumns((cols) =>
      cols.map((c) => ({ ...c, user: [...c.user, null], derived: [...c.derived, null] })),
    );
  };

  /** Supprime les lignes r0 à r1 (incluses), puis relance la déduction. */
  const removeRows = (r0: number, r1: number) => {
    const keep = (i: number) => i < r0 || i > r1;
    const next = rows.filter((_, i) => keep(i));
    if (!next.length) {
      // plus aucune ligne : retour à l'écran d'accueil
      setRows([]);
      setColumns([]);
      setActiveId(null);
      setSel(null);
      return;
    }
    setRows(next);
    setColumns((cols) =>
      cols.map((c) => {
        const user = c.user.filter((_, i) => keep(i));
        if (user.some((v) => v != null)) scheduleSynth(c.id, next, user);
        return { ...c, user, derived: c.derived.filter((_, i) => keep(i)) };
      }),
    );
    setSel(null);
    toast.success(
      r0 === r1 ? "Ligne supprimée" : `${r1 - r0 + 1} lignes supprimées`,
    );
  };

  /** Démarre avec un tableau vierge. */
  const startBlank = () => {
    const src = Array.from({ length: 5 }, () => "");
    const col = emptyColumn("Résultat 1", src.length);
    setRows(src);
    setColumns([col]);
    setActiveId(col.id);
    setSel(null);
  };

  /** Colle un bloc Excel/TSV à partir de la cellule sélectionnée, en créant les lignes manquantes. */
  const pasteBlock = (text: string) => {
    const matrix = parsePastedText(text);
    if (!matrix.length) return;
    if (rows.length === 0) {
      loadMatrix(matrix);
      return;
    }
    let startCol = 0;
    let startRow = 0;
    if (sel) {
      startCol = Math.min(sel.ac, sel.cc);
      startRow = Math.min(sel.ar, sel.cr);
    } else if (focus.current) {
      const idx = columns.findIndex((c) => c.id === focus.current!.colId);
      startCol = idx < 0 ? 0 : idx + 1;
      startRow = focus.current.row;
    }
    const width = Math.max(...matrix.map((r) => r.length));
    const needRows = Math.max(rows.length, startRow + matrix.length);
    const nextRows = rows.slice();
    while (nextRows.length < needRows) nextRows.push("");
    const pad = <T,>(a: T[], v: T) => {
      const out = a.slice();
      while (out.length < needRows) out.push(v);
      return out;
    };
    const next: OutputColumn[] = columns.map((c) => ({
      ...c,
      user: pad(c.user, null),
      derived: pad(c.derived, null),
    }));
    while (next.length < startCol + width - 1)
      next.push(emptyColumn(`Résultat ${next.length + 1}`, needRows));
    matrix.forEach((r, ri) => {
      r.forEach((v, ci) => {
        const c = startCol + ci;
        const row = startRow + ri;
        const s = v == null ? "" : String(v);
        if (c === 0) {
          nextRows[row] = s;
          return;
        }
        const col = next[c - 1];
        if (col) col.user[row] = s === "" ? null : s;
      });
    });
    setRows(nextRows);
    setColumns(next);
    next.forEach((col) => {
      if (col.user.some((v) => v != null)) {
        col.pending = true;
        runSynth(col.id, nextRows, col.user);
      }
    });
    toast.success(`${matrix.length} lignes collées`);
  };


  const copyTable = async () => {
    if (!rows.length) return;
    const header = ["Source", ...columns.map((c) => c.name)];
    const matrix = rows.map((src, i) => [src, ...columns.map((c) => cellValue(c, i))]);
    const ok = await copyToClipboard(toTsv(header, matrix));
    if (ok) toast.success("Tableau copié — collez-le dans Excel");
    else toast.error("Copie impossible");
  };


  const addColumn = () => {
    const col = emptyColumn(`Résultat ${columns.length + 1}`, rows.length);
    setColumns((c) => [...c, col]);
    setActiveId(col.id);
  };

  const removeColumn = (id: string) => {
    setColumns((cols) => cols.filter((c) => c.id !== id));
    setActiveId((a) => (a === id ? null : a));
    setSel(null);
  };

  const doExport = (kind: "csv" | "xlsx") => {
    const header = ["Source", ...columns.map((c) => c.name)];
    const matrix = rows.map((src, i) => [src, ...columns.map((c) => cellValue(c, i))]);
    if (kind === "csv") exportCsv(header, matrix);
    else exportXlsx(header, matrix);
  };

  const active = columns.find((c) => c.id === activeId) ?? null;
  const combined = useMemo(
    () =>
      combineColumns(
        rows,
        columns.filter((c) => c.rule).map((c) => ({ name: c.name, rule: c.rule! })),
      ),
    [rows, columns],
  );

  const handleRootPaste = (e: React.ClipboardEvent) => {
    if (pasteOpen) return;
    const text = e.clipboardData.getData("text");
    if (!text) return;
    if (!text.includes("\t") && !text.includes("\n")) return; // valeur simple : collage normal
    e.preventDefault();
    pasteBlock(text);
  };

  const handleRootCopy = (e: React.ClipboardEvent) => {
    if (pasteOpen || !rows.length) return;
    const el = document.activeElement as HTMLInputElement | null;
    const inField =
      el?.tagName === "INPUT" && el.selectionStart !== el.selectionEnd;
    if (inField || window.getSelection()?.toString()) return;
    // plage sélectionnée façon Excel : on copie uniquement les cellules choisies
    if (sel) {
      const c0 = Math.max(0, Math.min(sel.ac, sel.cc));
      const c1 = Math.min(columns.length, Math.max(sel.ac, sel.cc));
      const r0 = Math.min(sel.ar, sel.cr);
      const r1 = Math.max(sel.ar, sel.cr);
      const matrix: string[][] = [];
      for (let r = r0; r <= r1 && r < rows.length; r++) {
        const row: string[] = [];
        for (let c = c0; c <= c1; c++)
          row.push(c === 0 ? (rows[r] ?? "") : cellValue(columns[c - 1]!, r));
        matrix.push(row);
      }
      e.preventDefault();
      e.clipboardData.setData("text/plain", cellsToTsv(matrix));
      toast.success(
        matrix.length * (matrix[0]?.length ?? 0) > 1
          ? "Plage copiée — collez-la dans Excel"
          : "Cellule copiée",
      );
      return;
    }
    e.preventDefault();
    const header = ["Source", ...columns.map((c) => c.name)];
    const matrix = rows.map((src, i) => [src, ...columns.map((c) => cellValue(c, i))]);
    e.clipboardData.setData("text/plain", toTsv(header, matrix));
    toast.success("Tableau copié — collez-le dans Excel");
  };

  return (
    <div
      className="flex h-screen flex-col bg-background"
      onPaste={handleRootPaste}
      onCopy={handleRootCopy}
    >
      <Toaster position="bottom-right" />


      <header className="flex shrink-0 items-center gap-3 border-b border-grid-line bg-surface px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Regex className="size-5 text-primary" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Regex par l'exemple</div>
            <div className="text-[11px] text-muted-foreground">
              Tout reste dans votre navigateur
            </div>
          </div>
        </div>

        <div className="ml-4 flex items-center gap-1.5">
          <ToolbarButton icon={ClipboardPaste} label="Coller" onClick={() => setPasteOpen(true)} />
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs transition hover:border-primary hover:text-primary">
            <Upload className="size-3.5" />
            Importer
            <input
              type="file"
              accept=".txt,.csv,.tsv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
          {rows.length > 0 && (
            <>
              <ToolbarButton icon={ClipboardCopy} label="Copier le tableau" onClick={copyTable} />
              <ToolbarButton
                icon={ArrowUpToLine}
                label="1re ligne en en-tête"
                onClick={promoteHeader}
              />
              <ToolbarButton icon={FileText} label="CSV" onClick={() => doExport("csv")} />
              <ToolbarButton
                icon={FileSpreadsheet}
                label="Excel"
                onClick={() => doExport("xlsx")}
              />

              <ToolbarButton
                icon={Trash2}
                label="Vider"
                onClick={() => {
                  setRows([]);
                  setColumns([]);
                  setActiveId(null);
                  setSel(null);
                }}
              />
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setLlmControlOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
            title="IA locale (WebGPU/WASM) — Aucune donnée envoyée sur serveur"
          >
            <Sparkles className="size-3" />
            <span>IA locale : {localLLM.getCurrentModelConfig().name}</span>
            {llmReport.status === "ready" && (
              <span className="size-1.5 rounded-full bg-emerald-400" title="Modèle chargé" />
            )}
          </button>

          {rows.length > 0 && (
            <div className="font-mono text-[11px] text-muted-foreground">
              {rows.length} lignes · {columns.length} colonnes de sortie
            </div>
          )}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {rows.length === 0 ? (
          <WelcomeHero
            onLoadSample={loadSample}
            onImportFile={handleFile}
            onOpenPaste={() => setPasteOpen(true)}
            onStartBlank={startBlank}
          />
        ) : (
          <>
            <DataGrid
              rows={rows}
              columns={columns}
              activeId={activeId}
              selection={sel}
              onSelectionChange={setSel}
              onSelect={setActiveId}
              onChangeCell={handleChangeCell}
              onChangeSource={handleChangeSource}
              onAddRow={addRow}
              onRemoveRows={removeRows}
              onFocusCell={(colId, row) => {
                focus.current = { colId, row };
              }}
              onRename={(id, name) =>
                setColumns((cols) => cols.map((c) => (c.id === id ? { ...c, name } : c)))
              }
              onAddColumn={addColumn}
              onRemoveColumn={removeColumn}
            />
            <PatternPanel
              combined={combined}
              column={active}
              rowCount={rows.length}
              rows={rows}
              onGoToRow={(row) => {
                const idx = columns.findIndex((c) => c.id === activeId);
                if (idx < 0) return;
                setSel({ ac: idx + 1, ar: row, cc: idx + 1, cr: row });
              }}
              onTriggerLLM={() => activeId && triggerLLMFallback(activeId)}
              isLLMRunning={isLLMRunning}
              llmReport={llmReport}
            />
          </>
        )}
      </div>

      <LLMControlDialog open={llmControlOpen} onClose={() => setLlmControlOpen(false)} />

      {headerAsk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6">
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-4 shadow-2xl">
            <div className="mb-2 text-sm font-semibold">
              La première ligne contient-elle des en-têtes ?
            </div>
            <div className="mb-3 truncate rounded-md border border-border bg-background p-2 font-mono text-[12px] text-muted-foreground">
              {(headerAsk[0] ?? []).join("  |  ")}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  const m = headerAsk;
                  setHeaderAsk(null);
                  loadMatrix(m);
                }}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
              >
                Non, ce sont des données
              </button>
              <button
                onClick={() => {
                  const m = headerAsk;
                  setHeaderAsk(null);
                  loadMatrix(m.slice(1), m[0]);
                }}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                Oui, ce sont des en-têtes
              </button>
            </div>
          </div>
        </div>
      )}


      {pasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-surface p-4 shadow-2xl">
            <div className="mb-2 text-sm font-semibold">Coller vos données</div>
            <p className="mb-3 text-xs text-muted-foreground">
              Une ligne par enregistrement. Si vous collez plusieurs colonnes depuis Excel, la
              première devient la source et les suivantes vos exemples de résultat.
            </p>
            <textarea
              autoFocus
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={12}
              className="w-full rounded-md border border-border bg-background p-3 font-mono text-[13px] outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setPasteOpen(false)}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  loadMatrix(parsePastedText(pasteText));
                  setPasteOpen(false);
                  setPasteText("");
                }}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                Charger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Upload;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs transition hover:border-primary hover:text-primary"
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

