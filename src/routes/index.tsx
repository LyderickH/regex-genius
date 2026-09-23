import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardPaste,
  Upload,
  FileSpreadsheet,
  FileText,
  Trash2,
  Regex,
  Wand2,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { DataGrid } from "@/components/regex-tool/DataGrid";
import { PatternPanel } from "@/components/regex-tool/PatternPanel";
import { emptyColumn, cellValue, type OutputColumn } from "@/components/regex-tool/types";
import type { SynthResult } from "@/lib/regex-synth/engine";
import { parseFile, parsePastedText, exportCsv, exportXlsx, type Matrix } from "@/lib/data-io";

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

const SAMPLE = `FR-2024-00123 / Paris — 1 250,00 EUR
DE-2023-00987 / Berlin — 980,50 EUR
ES-2024-00455 / Madrid — 3 410,90 EUR
IT-2022-00042 / Milan — 77,00 EUR
FR-2025-01890 / Lyon — 12 000,00 EUR`;

function Index() {
  const [rows, setRows] = useState<string[]>([]);
  const [columns, setColumns] = useState<OutputColumn[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, string>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const reqId = useRef(0);

  useEffect(() => {
    const w = new Worker(new URL("../lib/regex-synth/synth.worker.ts", import.meta.url), {
      type: "module",
    });
    w.onmessage = (e: MessageEvent) => {
      const { id, result } = e.data as { id: number; result: SynthResult };
      const colId = pending.current.get(id);
      pending.current.delete(id);
      if (!colId) return;
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

  const handleChangeCell = (colId: string, row: number, value: string) => {
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

  const loadMatrix = (matrix: Matrix) => {
    if (!matrix.length) {
      toast.error("Aucune donnée détectée");
      return;
    }
    const source = matrix.map((r) => (r[0] ?? "").toString());
    const extra = Math.max(0, ...matrix.map((r) => r.length)) - 1;
    const cols: OutputColumn[] = [];
    const count = Math.max(1, extra);
    for (let c = 0; c < count; c++) {
      const col = emptyColumn(`Résultat ${c + 1}`, source.length);
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
    cols.forEach((c) => {
      if (c.user.some((v) => v != null)) runSynth(c.id, source, c.user);
    });
    toast.success(`${source.length} lignes chargées`);
  };

  const handleFile = async (file: File) => {
    try {
      loadMatrix(await parseFile(file));
    } catch {
      toast.error("Impossible de lire ce fichier");
    }
  };

  const addColumn = () => {
    const col = emptyColumn(`Résultat ${columns.length + 1}`, rows.length);
    setColumns((c) => [...c, col]);
    setActiveId(col.id);
  };

  const removeColumn = (id: string) => {
    setColumns((cols) => cols.filter((c) => c.id !== id));
    setActiveId((a) => (a === id ? null : a));
  };

  const doExport = (kind: "csv" | "xlsx") => {
    const header = ["Source", ...columns.map((c) => c.name)];
    const matrix = rows.map((src, i) => [src, ...columns.map((c) => cellValue(c, i))]);
    if (kind === "csv") exportCsv(header, matrix);
    else exportXlsx(header, matrix);
  };

  const active = columns.find((c) => c.id === activeId) ?? null;

  return (
    <div className="flex h-screen flex-col bg-background">
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
                }}
              />
            </>
          )}
        </div>

        {rows.length > 0 && (
          <div className="ml-auto font-mono text-[11px] text-muted-foreground">
            {rows.length} lignes · {columns.length} colonnes de sortie
          </div>
        )}
      </header>

      {rows.length === 0 ? (
        <EmptyState
          onLoadSample={() => loadMatrix(parsePastedText(SAMPLE))}
          onPaste={(text) => loadMatrix(parsePastedText(text))}
          onFile={handleFile}
        />
      ) : (
        <div className="flex min-h-0 flex-1">
          <DataGrid
            rows={rows}
            columns={columns}
            activeId={activeId}
            onSelect={setActiveId}
            onChangeCell={handleChangeCell}
            onRename={(id, name) =>
              setColumns((cols) => cols.map((c) => (c.id === id ? { ...c, name } : c)))
            }
            onAddColumn={addColumn}
            onRemoveColumn={removeColumn}
          />
          <PatternPanel column={active} rowCount={rows.length} />
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

function EmptyState({
  onLoadSample,
  onPaste,
  onFile,
}: {
  onLoadSample: () => void;
  onPaste: (text: string) => void;
  onFile: (file: File) => void;
}) {
  const [text, setText] = useState("");
  const [over, setOver] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="w-full max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Vos données d'un côté, le résultat attendu de l'autre.
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
          Remplissez deux ou trois lignes à la main : le motif est déduit localement et appliqué à
          tout le reste. L'expression régulière s'exporte vers Excel, Python, SQL, Alteryx, KNIME…
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          className={`mt-6 rounded-lg border border-dashed p-1 transition ${
            over ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const t = e.clipboardData.getData("text");
              if (t) {
                e.preventDefault();
                onPaste(t);
              }
            }}
            rows={9}
            placeholder={"Collez ici vos lignes, ou déposez un fichier TXT / CSV / Excel…"}
            className="w-full resize-none rounded-md bg-background p-4 font-mono text-[13px] outline-none placeholder:text-muted-foreground/60"
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => onPaste(text)}
            disabled={!text.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            <Wand2 className="size-3.5" /> Charger les données
          </button>
          <button
            onClick={onLoadSample}
            className="rounded-md border border-border px-3 py-1.5 text-xs transition hover:border-primary hover:text-primary"
          >
            Essayer avec un exemple
          </button>
        </div>
      </div>
    </div>
  );
}
