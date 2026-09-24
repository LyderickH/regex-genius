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
  Bot,
  Layers,
  Plane,
  Download,
  Laptop,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Home,
} from "lucide-react";
import { usePwa } from "@/hooks/usePwa";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DataGrid, type GridSel } from "@/components/regex-tool/DataGrid";
import { PatternPanel } from "@/components/regex-tool/PatternPanel";
import { BUSINESS_PRESETS, type BusinessPreset } from "@/lib/datasets/business-presets";
import { WelcomeHero } from "@/components/regex-tool/WelcomeHero";
import { LLMControlDialog } from "@/components/regex-tool/LLMControlDialog";
import { ExternalPromptDialog } from "@/components/regex-tool/ExternalPromptDialog";
import { ExportOptionsDialog } from "@/components/regex-tool/ExportOptionsDialog";
import { FileLoadingModal, type FileLoadingState } from "@/components/regex-tool/FileLoadingModal";
import { localLLM } from "@/lib/llm/webllm-service";
import { runSynthesisPipeline } from "@/lib/llm/pipeline";
import type { ModelProgressReport } from "@/lib/llm/types";
import { emptyColumn, cellValue, type OutputColumn } from "@/components/regex-tool/types";
import { combineColumns, type SynthResult } from "@/lib/regex-synth/engine";
import {
  parseFile,
  parseFileDataset,
  parsePastedText,
  parsePastedDataset,
  exportCsv,
  exportXlsx,
  exportFullDatasetStreaming,
  toTsv,
  cellsToTsv,
  copyToClipboard,
  type Matrix,
} from "@/lib/data-io";
import { AUDIT_LOGS_SAMPLE } from "@/lib/datasets/sample-audit-logs";

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

export type DisplayMode = "all" | "failures_only" | "first_1000";

function Index() {
  const [rows, setRows] = useState<string[]>([]);
  const [columns, setColumns] = useState<OutputColumn[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sel, setSel] = useState<GridSel | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [sourceName, setSourceName] = useState<string>("Données source");
  const [headerAsk, setHeaderAsk] = useState<{ matrix: Matrix; defaultSourceIdx: number } | null>(null);
  const [selectedSourceColIdx, setSelectedSourceColIdx] = useState<number>(0);
  const [fileLoading, setFileLoading] = useState<FileLoadingState | null>(null);

  // --- Modes d'affichage des lignes (par défaut : toutes les lignes consécutives)
  const [displayMode, setDisplayMode] = useState<DisplayMode>("all");
  const [extraCount, setExtraCount] = useState(0);

  // --- IA Locale (Fallback WebLLM / WebGPU)
  const [llmReport, setLlmReport] = useState<ModelProgressReport>({
    status: "idle",
    progressPercent: 0,
    text: "En attente",
  });
  const [isLLMRunning, setIsLLMRunning] = useState(false);
  const [llmControlOpen, setLlmControlOpen] = useState(false);
  const [externalPromptOpen, setExternalPromptOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("csv");
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const fullSourceRef = useRef<{ file?: File; rawText?: string; totalLines: number } | null>(null);

  // --- Statut PWA, Mode Avion et Installation Locale
  const { isOffline, canInstall, isInstalled, installApp } = usePwa();

  useEffect(() => {
    return localLLM.subscribe(setLlmReport);
  }, []);

  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, string>());
  const latestReqForCol = useRef(new Map<string, number>());
  const lastInputsSent = useRef<string[] | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const reqId = useRef(0);
  const focus = useRef<{ colId: string; row: number } | null>(null);

  const activeCol = columns.find((c) => c.id === activeId);

  const activeFailures = useMemo(() => {
    if (!activeCol || !activeCol.rule) return [];
    const fails: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      const val = activeCol.user[i] ?? activeCol.derived[i];
      if (val == null || val === "") {
        fails.push(i);
      }
    }
    return fails;
  }, [activeCol, rows]);

  // Calcul mémoïsé des index de lignes à afficher (garantit la fluidité 60fps et la séquence 1..N sans trous)
  const displayedIndices = useMemo(() => {
    if (rows.length === 0) return [];
    if (displayMode === "failures_only") {
      return activeFailures;
    }
    if (displayMode === "first_1000") {
      const limit = Math.min(rows.length, 1000 + extraCount);
      const set = new Set<number>();
      for (let i = 0; i < limit; i++) set.add(i);
      const activeCol = columns.find((c) => c.id === activeId);
      if (activeCol) {
        for (const k of Object.keys(activeCol.user)) {
          const r = Number(k);
          if (activeCol.user[r] != null && activeCol.user[r] !== "") {
            set.add(r);
          }
        }
      }
      return Array.from(set).sort((a, b) => a - b);
    }
    // "all" : toutes les lignes consécutives 0 à N-1
    return rows.map((_, i) => i);
  }, [rows, displayMode, extraCount, columns, activeId, activeFailures]);

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
      // Ignore les réponses obsolètes si une requête plus récente a été lancée
      if (latestReqForCol.current.get(colId) !== id) return;

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
    latestReqForCol.current.set(colId, id);
    const needInputs = lastInputsSent.current !== inputs;
    if (needInputs) lastInputsSent.current = inputs;
    w.postMessage({ id, inputs: needInputs ? inputs : undefined, expected });
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
    (rs: string[], cols: OutputColumn[]): Snap => {
      const isHuge = rs.length > 20_000;
      let rsKey = "";
      if (isHuge) {
        rsKey = `${rs.length}:${rs[0] ?? ""}:${rs[1] ?? ""}:${rs[rs.length - 1] ?? ""}`;
      } else {
        rsKey = rs.join("\u0000");
      }

      const colsKey = cols
        .map((c) => {
          if (isHuge) {
            const keys = Object.keys(c.user);
            let sample = "";
            for (let i = 0; i < Math.min(keys.length, 8); i++) {
              const k = Number(keys[i]);
              sample += `${k}:${c.user[k]};`;
            }
            return `${c.id}:${c.name}:${keys.length}:${sample}`;
          }
          return `${c.id}:${c.name}:${c.user.join("\u0001")}`;
        })
        .join("\u0002");

      return {
        rows: isHuge ? rs : rs.slice(),
        columns: cols.map((c) => {
          if (isHuge) {
            const userCopy = new Array(c.user.length);
            for (const k of Object.keys(c.user)) {
              const idx = Number(k);
              userCopy[idx] = c.user[idx];
            }
            return { ...c, user: userCopy, derived: c.derived };
          }
          return { ...c, user: c.user.slice(), derived: c.derived };
        }),
        key: `${rsKey}||${colsKey}`,
      };
    },
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
      const maxHistory = rows.length > 50_000 ? 5 : 120;
      if (past.current.length > maxHistory) past.current.shift();
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

function detectBestSourceCol(matrix: Matrix): number {
  if (!matrix || matrix.length < 2) return 0;
  const numCols = matrix[0]?.length ?? 0;
  if (numCols <= 1) return 0;

  const firstColHeader = String(matrix[0][0] ?? "").toLowerCase().trim();
  const sampleRows = Math.min(matrix.length, 30);

  let col0AllNumbers = true;
  for (let r = 1; r < sampleRows; r++) {
    const val = String(matrix[r]?.[0] ?? "").trim();
    if (val && !/^\d+$/.test(val)) {
      col0AllNumbers = false;
      break;
    }
  }

  const isCol0Index =
    firstColHeader === "#" ||
    firstColHeader === "id" ||
    firstColHeader === "n°" ||
    firstColHeader === "num" ||
    firstColHeader === "index" ||
    col0AllNumbers;

  if (isCol0Index && numCols > 1) {
    let bestCol = 1;
    let maxAvgLen = 0;
    for (let c = 1; c < numCols; c++) {
      let totalLen = 0;
      let count = 0;
      for (let r = 1; r < sampleRows; r++) {
        const v = String(matrix[r]?.[c] ?? "");
        totalLen += v.length;
        count++;
      }
      const avg = count > 0 ? totalLen / count : 0;
      if (avg > maxAvgLen) {
        maxAvgLen = avg;
        bestCol = c;
      }
    }
    return bestCol;
  }

  return 0;
}

  const loadMatrix = (matrix: Matrix, names?: string[], sourceColIndex?: number) => {
    if (!matrix.length) {
      toast.error("Aucune donnée détectée");
      return;
    }
    const len = matrix.length;
    const firstRowLen = matrix[0]?.length ?? 1;
    let maxCols = firstRowLen;
    const sampleLimit = Math.min(len, 300);
    for (let i = 0; i < sampleLimit; i++) {
      if (matrix[i].length > maxCols) maxCols = matrix[i].length;
    }

    const effectiveSourceIdx =
      sourceColIndex !== undefined
        ? Math.min(Math.max(0, sourceColIndex), maxCols - 1)
        : detectBestSourceCol(matrix);

    const source: string[] = new Array(len);
    for (let i = 0; i < len; i++) {
      source[i] = (matrix[i][effectiveSourceIdx] ?? "").toString();
    }

    const sName = names?.[effectiveSourceIdx]?.trim() || "Données source";
    setSourceName(sName);

    const cols: OutputColumn[] = [];
    for (let c = 0; c < maxCols; c++) {
      if (c === effectiveSourceIdx) continue;
      const colName = names?.[c]?.trim() || `Résultat ${cols.length + 1}`;
      const col = emptyColumn(colName, len);
      for (let i = 0; i < len; i++) {
        const v = matrix[i][c];
        if (v != null && v !== "") col.user[i] = String(v);
      }
      cols.push(col);
    }

    if (cols.length === 0) {
      cols.push(emptyColumn("Résultat 1", len));
    }

    setRows(source);
    setColumns(cols);

    // Sélectionne la colonne active avec des exemples si existante
    const firstWithUserExamples = cols.find((c) =>
      c.user.some((v) => v != null && String(v).trim() !== ""),
    );
    setActiveId(firstWithUserExamples ? firstWithUserExamples.id : cols[0]?.id ?? null);
    setSel(null);
    setDisplayMode("all");
    setExtraCount(0);

    cols.forEach((c) => {
      if (c.user.some((v) => v != null && String(v).trim() !== "")) {
        runSynth(c.id, source, c.user);
      }
    });

    toast.success(
      `${source.length.toLocaleString("fr-FR")} lignes chargées (Source : « ${sName} »)`,
    );
  };

  /** Définit ou échange une colonne comme la colonne de données source. */
  const setColumnAsSource = (colId: string) => {
    const colIndex = columns.findIndex((c) => c.id === colId);
    if (colIndex < 0) return;
    const targetCol = columns[colIndex];

    const newRows: string[] = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) {
      newRows[i] = targetCol.user[i] ?? targetCol.derived[i] ?? "";
    }

    const formerSourceName = sourceName || "Données source";
    const newSourceName = targetCol.name || "Données source";

    // L'ancienne source devient une colonne normale de résultat
    const formerCol = emptyColumn(formerSourceName, rows.length);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] != null && rows[i] !== "") formerCol.user[i] = rows[i];
    }

    const nextCols = columns.map((c, idx) => (idx === colIndex ? formerCol : c));

    setRows(newRows);
    setSourceName(newSourceName);
    setColumns(nextCols);

    // Sélectionner une colonne de résultat active
    const nextActive =
      nextCols.find((c, idx) => idx !== colIndex && c.user.some((v) => v != null && v !== "")) ??
      nextCols.find((c, idx) => idx !== colIndex) ??
      nextCols[0];
    if (nextActive) setActiveId(nextActive.id);

    // Relancer la synthèse sur toutes les colonnes avec la nouvelle source
    nextCols.forEach((c) => {
      if (c.user.some((v) => v != null && v !== "")) {
        scheduleSynth(c.id, newRows, c.user);
      }
    });

    toast.success(`« ${newSourceName} » est désormais la colonne de données source !`);
  };

  const handleFile = async (file: File) => {
    try {
      const sizeStr =
        file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} Mo`
          : `${Math.round(file.size / 1024)} Ko`;

      setFileLoading({
        filename: file.name,
        size: sizeStr,
        percent: 2,
        step: "Démarrage de la lecture...",
      });

      const parsed = await parseFileDataset(file, 50_000, (report) => {
        setFileLoading({
          filename: file.name,
          size: sizeStr,
          percent: report.percent,
          step: report.step,
        });
      });

      // Petite temporisation pour laisser l'utilisateur apercevoir le 100%
      await new Promise((r) => setTimeout(r, 200));
      setFileLoading(null);

      if (parsed.isSampled) {
        fullSourceRef.current = { file, totalLines: parsed.totalLines };
        toast.info(
          `Échantillon interactif de ${parsed.matrix.length.toLocaleString("fr-FR")} lignes chargé (sur ${parsed.totalLines.toLocaleString("fr-FR")} lignes au total). L'export pourra traiter l'intégralité du fichier.`,
          { duration: 6000 },
        );
      } else {
        fullSourceRef.current = null;
      }

      // Ne demander la confirmation d'en-tête QUE s'il y a plusieurs colonnes
      if (parsed.matrix.length > 1 && (parsed.matrix[0]?.length ?? 0) > 1) {
        const bestCol = detectBestSourceCol(parsed.matrix);
        setSelectedSourceColIdx(bestCol);
        setHeaderAsk({ matrix: parsed.matrix, defaultSourceIdx: bestCol });
      } else {
        loadMatrix(parsed.matrix);
      }
    } catch {
      setFileLoading(null);
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

  const loadBusinessPreset = (preset: BusinessPreset) => {
    const source = preset.rows.slice();
    const cols = preset.columns.map((pc) => {
      const col = emptyColumn(pc.name, source.length);
      Object.entries(pc.examples).forEach(([rStr, val]) => {
        col.user[Number(rStr)] = val;
      });
      return col;
    });

    setRows(source);
    setSourceName(preset.sourceName);
    setColumns(cols);
    setActiveId(cols[0]?.id ?? null);
    setSel(null);
    setDisplayMode("all");
    setExtraCount(0);
    fullSourceRef.current = null;

    cols.forEach((c) => {
      runSynth(c.id, source, c.user);
    });

    toast.success(`Modèle « ${preset.title} » chargé avec succès !`);
  };

  const loadSample1 = () => {
    const p = BUSINESS_PRESETS[0];
    if (p) loadBusinessPreset(p);
  };
  const loadSample = loadSample1;

  /** Réinitialise le tableau et revient à l'écran d'accueil */
  const returnToWelcome = () => {
    if (rows.length > 0) {
      const ok = window.confirm(
        "Voulez-vous fermer le tableau en cours et revenir au menu d'accueil ?",
      );
      if (!ok) return;
    }
    setRows([]);
    setColumns([]);
    setActiveId(null);
    setSel(null);
    fullSourceRef.current = null;
    setDisplayMode("all");
    setExtraCount(0);
  };

  const loadSample2 = () => {
    const source = AUDIT_LOGS_SAMPLE.slice();
    const fill = (vals: (string | null)[]) =>
      source.map((_, i) => vals[i] ?? null) as (string | null)[];

    const emailCol = emptyColumn("Email", source.length);
    emailCol.user = fill(["admin.1@sub.network-2.net", "service.worker_2@cloud-3.io"]);

    const dateCol = emptyColumn("Horodatage ISO", source.length);
    dateCol.user = fill(["2026-02-02 01:01:01", "2026-03-03T02:02:02+02:00"]);

    const tokenCol = emptyColumn("Token Sécurisé", source.length);
    tokenCol.user = fill(["TK#4b-1E_1!w&42", "TK#7c-8D_2!z%11"]);

    setRows(source);
    setSourceName("Logs d'audit");
    setColumns([emailCol, dateCol, tokenCol]);
    setActiveId(emailCol.id);
    setSel(null);
    setDisplayMode("all");
    setExtraCount(0);
    fullSourceRef.current = null;
    runSynth(emailCol.id, source, emailCol.user);
    runSynth(dateCol.id, source, dateCol.user);
    runSynth(tokenCol.id, source, tokenCol.user);
    toast.success("Exemple 2 (1 138 logs d'audit) chargé avec succès !");
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
    setDisplayMode("all");
    setExtraCount(0);
  };

  /** Colle un bloc Excel/TSV à partir de la cellule sélectionnée, en créant les lignes manquantes. */
  const pasteBlock = (text: string) => {
    const parsed = parsePastedDataset(text, 50_000);
    if (parsed.isSampled) {
      fullSourceRef.current = { rawText: text, totalLines: parsed.totalLines };
      toast.info(
        `Échantillon interactif de ${parsed.matrix.length.toLocaleString("fr-FR")} lignes chargé sur ${parsed.totalLines.toLocaleString("fr-FR")} au total.`,
        { duration: 6000 },
      );
    } else if (rows.length === 0) {
      fullSourceRef.current = null;
    }
    const matrix = parsed.matrix;
    if (!matrix.length) return;
    if (rows.length === 0) {
      loadMatrix(matrix);
      return;
    }
    let startCol = 0;
    let startRow = 0;
    if (sel) {
      startCol = Math.min(sel.ac, sel.cc);
      const visualRow = Math.min(sel.ar, sel.cr);
      startRow = displayedIndices[visualRow] ?? visualRow;
    } else if (focus.current) {
      const idx = columns.findIndex((c) => c.id === focus.current!.colId);
      startCol = idx < 0 ? 0 : idx + 1;
      startRow = focus.current.row;
    }
    let width = 0;
    for (let i = 0; i < matrix.length; i++) {
      if (matrix[i].length > width) width = matrix[i].length;
    }
    const needRows = Math.max(rows.length, startRow + matrix.length);
    const nextRows = rows.slice();
    if (nextRows.length < needRows) {
      const curLen = nextRows.length;
      nextRows.length = needRows;
      nextRows.fill("", curLen);
    }
    const pad = <T,>(a: T[], v: T): T[] => {
      if (a.length >= needRows) return a.slice();
      const out = new Array<T>(needRows);
      for (let i = 0; i < a.length; i++) out[i] = a[i];
      for (let i = a.length; i < needRows; i++) out[i] = v;
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
    const header = [sourceName || "Source", ...columns.map((c) => c.name)];
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

  const moveColumn = (id: string, direction: "left" | "right") => {
    setColumns((cols) => {
      const idx = cols.findIndex((c) => c.id === id);
      if (idx === -1) return cols;
      const targetIdx = direction === "left" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= cols.length) return cols;
      const next = cols.slice();
      const [moved] = next.splice(idx, 1);
      if (moved) next.splice(targetIdx, 0, moved);
      return next;
    });
  };

  const executeDirectExport = (kind: "csv" | "xlsx") => {
    const header = [sourceName || "Source", ...columns.map((c) => c.name)];
    const matrix = rows.map((src, i) => [src, ...columns.map((c) => cellValue(c, i))]);
    if (kind === "csv") exportCsv(header, matrix);
    else exportXlsx(header, matrix);
  };

  const doExport = (kind: "csv" | "xlsx") => {
    if (fullSourceRef.current && fullSourceRef.current.totalLines > rows.length) {
      setExportFormat(kind);
      setExportDialogOpen(true);
      return;
    }
    executeDirectExport(kind);
  };

  const handleExportFull = async (onProgress: (percent: number) => void) => {
    if (!fullSourceRef.current) return;
    const header = ["Source", ...columns.map((c) => c.name)];
    await exportFullDatasetStreaming({
      file: fullSourceRef.current.file,
      rawText: fullSourceRef.current.rawText,
      totalLines: fullSourceRef.current.totalLines,
      header,
      columns: columns.map((c) => ({ name: c.name, rule: c.rule })),
      filename: `resultats_complet_${fullSourceRef.current.totalLines}_lignes.csv`,
      onProgress,
    });
    toast.success(
      `✓ ${fullSourceRef.current.totalLines.toLocaleString("fr-FR")} lignes traitées et exportées avec succès !`,
    );
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
      for (let r = r0; r <= r1 && r < displayedIndices.length; r++) {
        const realR = displayedIndices[r] ?? r;
        const row: string[] = [];
        for (let c = c0; c <= c1; c++)
          row.push(c === 0 ? (rows[realR] ?? "") : cellValue(columns[c - 1]!, realR));
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
        <button
          type="button"
          onClick={returnToWelcome}
          className="flex items-center gap-2 text-left hover:opacity-85 transition cursor-pointer group"
          title="Revenir au menu d'accueil"
        >
          <Regex className="size-5 text-primary transition-transform group-hover:scale-105" />
          <div className="leading-tight">
            <div className="text-sm font-semibold group-hover:text-primary transition-colors">Regex par l'exemple</div>
            <div className="text-[11px] text-muted-foreground">
              Tout reste dans votre navigateur
            </div>
          </div>
        </button>

        <div className="ml-4 flex items-center gap-1.5">
          {rows.length > 0 && (
            <ToolbarButton
              icon={Home}
              label="Menu"
              onClick={returnToWelcome}
            />
          )}

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
              <ToolbarButton
                icon={ArrowUpToLine}
                label="1re ligne en en-tête"
                onClick={promoteHeader}
              />

              {/* Bouton Exporter unique avec choix de format */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setExportDropdownOpen((prev) => !prev)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary"
                  title="Exporter vos données nettoyées et calculées"
                >
                  <Download className="size-3.5 text-primary" />
                  <span>Exporter</span>
                  <ChevronDown className="size-3 text-muted-foreground" />
                </button>
                {exportDropdownOpen && (
                  <div className="absolute left-0 mt-1 z-50 w-44 rounded-lg border border-border bg-surface p-1 shadow-xl animate-in fade-in duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        setExportDropdownOpen(false);
                        doExport("csv");
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-2 transition text-left cursor-pointer"
                    >
                      <FileText className="size-3.5 text-primary" />
                      <span>Fichier CSV (.csv)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExportDropdownOpen(false);
                        doExport("xlsx");
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-2 transition text-left cursor-pointer"
                    >
                      <FileSpreadsheet className="size-3.5 text-emerald-400" />
                      <span>Classeur Excel (.xlsx)</span>
                    </button>
                  </div>
                )}
              </div>

              <ToolbarButton icon={ClipboardCopy} label="Copier le tableau" onClick={copyTable} />

              <ToolbarButton
                icon={Bot}
                label="Prompt ChatGPT / Claude"
                onClick={() => setExternalPromptOpen(true)}
              />
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* IA locale WebGPU mise en valeur */}
          <button
            onClick={() => setLlmControlOpen(true)}
            className="relative flex items-center gap-2 rounded-full border border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-orange-500/15 px-3 py-1 text-xs font-semibold text-amber-300 hover:border-amber-400 hover:bg-amber-500/25 transition shadow-xs cursor-pointer group"
            title="IA locale embarquée dans votre navigateur (WebGPU) : 0 octet envoyé sur Internet, 100% privé et sécurisé"
          >
            <span className="relative flex size-2">
              <span className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75",
                isLLMRunning ? "animate-ping bg-amber-400" : llmReport.status === "ready" ? "bg-emerald-400 animate-pulse" : "bg-amber-500"
              )} />
              <span className={cn(
                "relative inline-flex size-2 rounded-full",
                llmReport.status === "ready" ? "bg-emerald-400" : "bg-amber-400"
              )} />
            </span>
            <Sparkles className="size-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
            <span>IA locale (WebGPU)</span>
            <span className="hidden xl:inline text-[10px] font-mono opacity-80 text-amber-200">
              · {localLLM.getCurrentModelConfig().name}
            </span>
          </button>

          {/* Badge Confidentialité & Rassurance 100% Locale */}
          <div
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400"
            title="100% Local : Aucune donnée ne quitte votre ordinateur. Tout le traitement s'exécute localement dans votre navigateur (compatible secret bancaire/médical)."
          >
            <ShieldCheck className="size-3.5 text-emerald-400" />
            <span>100% Local & Privé</span>
          </div>

          {/* Badge Mode Avion / Hors-ligne en direct */}
          {isOffline && (
            <div
              className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 animate-pulse"
              title="Mode avion actif : aucune connexion Internet, calculs 100% locaux dans votre RAM"
            >
              <Plane className="size-3" />
              <span>Mode Avion (0 réseau)</span>
            </div>
          )}

          {/* Bouton d'installation PWA dans le header */}
          {!isInstalled && (
            <button
              type="button"
              onClick={installApp}
              className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-primary hover:text-primary transition cursor-pointer"
              title="Installer Regex Genius sur votre PC (PWA autonome utilisable hors-ligne)"
            >
              <Download className="size-3 text-primary" />
              <span>Installer sur PC</span>
            </button>
          )}

          {isInstalled && (
            <div
              className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground"
              title="Application locale installée sur votre ordinateur"
            >
              <Laptop className="size-3.5 text-primary" />
              <span>App locale</span>
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex items-center gap-2 font-mono text-[11px]">
              {fullSourceRef.current && fullSourceRef.current.totalLines > rows.length ? (
                <div
                  className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-medium text-primary shadow-xs"
                  title="Échantillon interactif de 50 000 lignes pour une fluidité maximale. L'export traitera l'intégralité du fichier."
                >
                  <Layers className="size-3" />
                  <span>
                    Échantillon : {rows.length.toLocaleString("fr-FR")} /{" "}
                    {fullSourceRef.current.totalLines.toLocaleString("fr-FR")} lignes · {columns.length} col.
                  </span>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  {rows.length.toLocaleString("fr-FR")} lignes · {columns.length} colonne{columns.length > 1 ? "s" : ""}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {rows.length === 0 ? (
          <WelcomeHero
            onLoadPreset={loadBusinessPreset}
            onLoadSample1={loadSample1}
            onLoadSample2={loadSample2}
            onImportFile={handleFile}
            onOpenPaste={() => setPasteOpen(true)}
            onStartBlank={startBlank}
            isOffline={isOffline}
            canInstall={canInstall}
            isInstalled={isInstalled}
            onInstall={installApp}
          />
        ) : (
          <div className="flex flex-1 flex-col min-w-0">
            {rows.length > 0 && (activeFailures.length > 0 || rows.length > 5000) && (
              <div className={cn(
                "flex shrink-0 items-center justify-between border-b px-4 py-1 text-xs backdrop-blur-xs",
                activeFailures.length > 0
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-grid-line bg-surface/70"
              )}>
                <div className="flex items-center gap-2">
                  {activeFailures.length > 0 ? (
                    <>
                      <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="size-3.5" />
                        <span>{activeFailures.length} ligne{activeFailures.length > 1 ? "s" : ""} non reconnue{activeFailures.length > 1 ? "s" : ""}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDisplayMode((m) =>
                            m === "failures_only" ? "all" : "failures_only",
                          )
                        }
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition cursor-pointer",
                          displayMode === "failures_only"
                            ? "bg-amber-500 text-amber-950 font-bold shadow-xs"
                            : "border border-amber-500/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30",
                        )}
                      >
                        {displayMode === "failures_only"
                          ? "Afficher toutes les lignes"
                          : "Filtrer uniquement les échecs"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const targetRow = activeFailures[0];
                          if (targetRow != null) {
                            const colIdx = columns.findIndex((c) => c.id === activeId) + 1;
                            setSel({ ac: colIdx, ar: targetRow, cc: colIdx, cr: targetRow });
                            toast.info(`Ligne ${targetRow + 1} ciblée`);
                          }
                        }}
                        className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary transition cursor-pointer"
                        title="Sauter à la première ligne non reconnue"
                      >
                        ↓ 1er échec
                      </button>
                    </>
                  ) : rows.length > 5000 ? (
                    <>
                      <span className="text-[11px] font-medium text-muted-foreground">Affichage :</span>
                      <select
                        value={displayMode}
                        onChange={(e) => setDisplayMode(e.target.value as any)}
                        className="rounded border border-border bg-surface px-2 py-0.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none cursor-pointer"
                      >
                        <option value="all">Toutes les lignes ({rows.length.toLocaleString("fr-FR")})</option>
                        <option value="first_1000">1 000 premières lignes</option>
                      </select>
                    </>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <span>
                    {displayedIndices.length.toLocaleString("fr-FR")} lignes affichées sur {rows.length.toLocaleString("fr-FR")}
                  </span>
                  {displayMode === "first_1000" && rows.length > displayedIndices.length && (
                    <button
                      type="button"
                      onClick={() => setExtraCount((c) => c + 1000)}
                      className="rounded border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:border-primary hover:text-primary transition cursor-pointer"
                    >
                      + 1 000 lignes
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="relative flex min-h-0 flex-1">
              <DataGrid
                rows={rows}
                columns={columns}
                displayIndices={displayedIndices}
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
                onMoveColumn={moveColumn}
                sourceName={sourceName}
                onSetAsSource={setColumnAsSource}
              />
              <PatternPanel
                combined={combined}
                hasMultipleRules={columns.filter((c) => c.rule).length >= 2}
                column={active}
                rowCount={rows.length}
                rows={rows}
                onGoToRow={(row) => {
                  const idx = columns.findIndex((c) => c.id === activeId);
                  if (idx < 0) return;
                  if (!displayedIndices.includes(row)) {
                    setDisplayMode("all");
                  }
                  const visualIndex = displayedIndices.indexOf(row);
                  const targetRow = visualIndex >= 0 ? visualIndex : row;
                  setSel({ ac: idx + 1, ar: targetRow, cc: idx + 1, cr: targetRow });
                }}
                onTriggerLLM={() => activeId && triggerLLMFallback(activeId)}
                isLLMRunning={isLLMRunning}
                llmReport={llmReport}
              />
            </div>
          </div>
        )}
      </div>

      <LLMControlDialog open={llmControlOpen} onClose={() => setLlmControlOpen(false)} />
      <ExternalPromptDialog
        open={externalPromptOpen}
        onClose={() => setExternalPromptOpen(false)}
        column={active}
        rows={rows}
      />
      <ExportOptionsDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        totalLines={fullSourceRef.current?.totalLines ?? rows.length}
        interactiveLines={rows.length}
        columns={columns}
        format={exportFormat}
        onExportSample={() => executeDirectExport(exportFormat)}
        onExportFull={handleExportFull}
      />

      <FileLoadingModal progress={fileLoading} />

      {headerAsk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-xl border border-border bg-surface p-5 shadow-2xl space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Configuration de l'importation
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Vérifiez les en-têtes et sélectionnez la colonne contenant le texte source brut à analyser.
              </p>
            </div>

            {/* Sélecteur de la colonne source */}
            <div className="rounded-lg border border-border/80 bg-surface-2/40 p-3 space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <span>Colonne source (texte brut à découper) :</span>
              </label>
              <select
                value={selectedSourceColIdx}
                onChange={(e) => setSelectedSourceColIdx(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                {(headerAsk.matrix[0] ?? []).map((colHeader, idx) => {
                  const sampleVal = headerAsk.matrix[1]?.[idx] ?? "";
                  const isRecommended = idx === headerAsk.defaultSourceIdx;
                  return (
                    <option key={idx} value={idx}>
                      Col. {idx + 1} : {colHeader || `Colonne ${idx + 1}`}
                      {sampleVal ? ` (ex: "${sampleVal.length > 35 ? sampleVal.slice(0, 35) + "..." : sampleVal}")` : ""}
                      {isRecommended ? " ★ Recommandé" : ""}
                    </option>
                  );
                })}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Les autres colonnes seront traitées comme des résultats ou des exemples à déduire.
              </p>
            </div>

            {/* Aperçu de la première ligne */}
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground">
                Aperçu de la première ligne :
              </div>
              <div className="truncate rounded-md border border-border bg-background p-2 font-mono text-[11px] text-muted-foreground">
                {(headerAsk.matrix[0] ?? []).join("  |  ")}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">
                La 1re ligne est-elle un en-tête ?
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const m = headerAsk.matrix;
                    const srcIdx = selectedSourceColIdx;
                    setHeaderAsk(null);
                    loadMatrix(m, undefined, srcIdx);
                  }}
                  className="rounded-md border border-border px-3.5 py-1.5 text-xs font-medium hover:bg-surface-2 transition cursor-pointer"
                >
                  Non (données brutes)
                </button>
                <button
                  onClick={() => {
                    const m = headerAsk.matrix;
                    const srcIdx = selectedSourceColIdx;
                    setHeaderAsk(null);
                    loadMatrix(m.slice(1), m[0], srcIdx);
                  }}
                  className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 shadow transition cursor-pointer"
                >
                  Oui, ce sont des en-têtes
                </button>
              </div>
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
                  const parsed = parsePastedDataset(pasteText, 50_000);
                  if (parsed.isSampled) {
                    fullSourceRef.current = { rawText: pasteText, totalLines: parsed.totalLines };
                    toast.info(
                      `Échantillon interactif de ${parsed.matrix.length.toLocaleString("fr-FR")} lignes chargé sur ${parsed.totalLines.toLocaleString("fr-FR")} au total.`,
                      { duration: 6000 },
                    );
                  } else {
                    fullSourceRef.current = null;
                  }
                  loadMatrix(parsed.matrix);
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

