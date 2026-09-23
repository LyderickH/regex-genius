import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardPaste,
  Upload,
  FileSpreadsheet,
  FileText,
  Trash2,
  Regex,
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

/** Extrait de FEC (séparateur « | »), avec des cas volontairement piégeux. */
const SAMPLE = `VE|Ventes|VT0001|20240131|411000|Clients divers|C0012|SARL DUPONT & FILS|FA-2024-0001|20240131|Facture FA-2024-0001 - SARL DUPONT|1 250,00|0,00|AA|20240215|20240131||EUR
AC|Achats|AC0087|20240205|401000|Fournisseurs|F0031|ÉTS MARTIN|FA/2024/87|20240203|Achat fournitures - réf. 12/45| 980,50 |0,00|||20240205||EUR
BQ|Banque|BQ0142|20240229|512000|Banque - compte courant|||REL-02|20240229|Virement client DUPONT|0,00|3 410,90|BB|20240301|20240229||EUR
OD|Opérations diverses|OD0009|20241231|681100|Dotations amortissements|||DOT-2024|20241231|Amortissement matériel (5 ans)|77,00|0,00|||20241231||EUR
VE|Ventes|VT0102|20250114|707000|Ventes de marchandises|C0007|LE COMPTOIR|FA-2025-0102|20250114|Facture - lot n°12 000 pièces|12 000,00|0,00|||20250114|13 200,00|USD
AC|Achats|AC0203|20250220|607000|Achats marchandises|F0002|IMPORT & CO|FA-2025/203|20250218|Avoir sur facture 198|-45,90|0,00|||20250220||EUR
BQ|Banque|BQ0311|20250331|627000|Services bancaires|||AGIOS-03|20250331|Agios trimestre 1|8,90|0,00|||20250331||EUR
VE|Ventes|VT0115|20250402|707000|Ventes de marchandises|C0012|SARL DUPONT & FILS|FA-2025-0115|20250402|Facture - remise 10 %|2 300,00|0,00|CC|20250430|20250402||EUR`;

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

  const loadSample = () => {
    const source = SAMPLE.split("\n");
    const col = emptyColumn("Résultat 1", source.length);
    col.user = ["1250,00", "980,50", null, null, null];
    setRows(source);
    setColumns([col]);
    setActiveId(col.id);
    runSynth(col.id, source, col.user);
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

      <div className="relative flex min-h-0 flex-1">
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
        {rows.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
            <button
              onClick={loadSample}
              className="rounded-md border border-border px-3 py-1.5 text-xs transition hover:border-primary hover:text-primary"
            >
              Essayer avec un exemple
            </button>
          </div>
        )}
      </div>

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

