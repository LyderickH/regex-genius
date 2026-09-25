import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, AlertTriangle, Sparkles, ArrowLeftToLine, AlertCircle, ClipboardCopy, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { cellValue, type OutputColumn } from "./types";
import { DIALECTS } from "@/lib/regex-synth/dialects";
import { copyToClipboard } from "@/lib/data-io";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ROW_H = 34;
const NUM_W = 56;
const ADD_W = 52;
const MIN_W = 100;
const DEFAULT_SOURCE_W = 460;
const DEFAULT_OUT_W = 280;
/** Identifiant fictif de la colonne « Données source ». */
export const SOURCE_COL = "__source__";


/** Sélection façon Excel : ancre (ac,ar) + coin opposé (cc,cr). Colonne 0 = source. */
export interface GridSel {
  ac: number;
  ar: number;
  cc: number;
  cr: number;
}

/** Largeur approximative d'une chaîne en police mono/sans 13px (avec marge pour en-têtes bold). */
function measure(text: string): number {
  return Math.max(MIN_W, text.length * 9.5 + 40);
}

interface Props {
  rows: string[];
  columns: OutputColumn[];
  displayIndices?: number[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onChangeCell: (colId: string, row: number, value: string) => void;
  onChangeSource?: (row: number, value: string) => void;
  onAddRow?: () => void;
  onRemoveRows?: (r0: number, r1: number) => void;
  onFocusCell?: (colId: string, row: number) => void;

  onRename: (colId: string, name: string) => void;
  onAddColumn: () => void;
  onRemoveColumn: (colId: string) => void;
  onMoveColumn?: (colId: string, direction: "left" | "right") => void;
  selection: GridSel | null;
  onSelectionChange: (s: GridSel | null) => void;
  sourceName?: string;
  onSetAsSource?: (colId: string) => void;
}

export function DataGrid({
  rows,
  columns,
  displayIndices,
  activeId,
  onSelect,
  onChangeCell,
  onChangeSource,
  onAddRow,
  onRemoveRows,
  onFocusCell,

  onRename,
  onAddColumn,
  onRemoveColumn,
  onMoveColumn,
  selection,
  onSelectionChange,
  sourceName,
  onSetAsSource,
}: Props) {
  const displayCount = displayIndices ? displayIndices.length : rows.length;
  const getRealRow = useCallback(
    (visualRow: number): number =>
      displayIndices ? displayIndices[visualRow] ?? visualRow : visualRow,
    [displayIndices],
  );

  const scroller = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(600);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [sourceSelection, setSourceSelection] = useState<{ row: number; text: string } | null>(null);
  // widths[0] = colonne source, widths[1..n] = colonnes de résultat
  const [widths, setWidths] = useState<number[]>([]);
  const resizing = useRef<{ index: number; startX: number; startW: number } | null>(null);
  const manuallyResized = useRef(new Set<string>());
  const anchor = useRef<{ c: number; r: number } | null>(null);
  const dragging = useRef(false);

  const updateScrollRight = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 2;
    const isAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
    setCanScrollRight(hasOverflow && !isAtEnd);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setHeight(el.clientHeight);
      updateScrollRight();
    });
    ro.observe(el);
    setHeight(el.clientHeight);
    updateScrollRight();
    return () => ro.disconnect();
  }, [updateScrollRight]);

  useEffect(() => {
    updateScrollRight();
  }, [widths, columns, rows.length, updateScrollRight]);

  // Synchronise les largeurs et les agrandit automatiquement pour que le
  // contenu le plus long reste entièrement visible. Un réglage manuel plus
  // large est conservé.
  useEffect(() => {
    setWidths((w) => {
      const need = columns.length + 1;
      const next = w.slice(0, need);
      while (next.length < need) next.push(next.length === 0 ? DEFAULT_SOURCE_W : DEFAULT_OUT_W);

      const sampleLimit = Math.min(displayCount, 100);
      if (!manuallyResized.current.has(SOURCE_COL)) {
        let maxSource = measure("Données source");
        for (let r = 0; r < sampleLimit; r++) {
          const realR = getRealRow(r);
          const l = rows[realR]?.length ?? 0;
          if (l * 8.2 + 32 > maxSource) maxSource = Math.min(800, l * 8.2 + 32);
        }
        next[0] = rows.length ? maxSource : DEFAULT_SOURCE_W;
      }
      for (let c = 0; c < columns.length; c++) {
        const col = columns[c];
        if (!col) continue;
        if (manuallyResized.current.has(col.id)) continue;
        let required = Math.max(260, measure(col.name) + 120);
        for (let r = 0; r < sampleLimit; r++) {
          const realR = getRealRow(r);
          const v = cellValue(col, realR);
          if (v) required = Math.max(required, measure(v) + 24);
        }
        next[c + 1] = rows.length ? Math.min(700, required) : DEFAULT_OUT_W;
      }

      return next.some((value, index) => value !== w[index]) || w.length !== need ? next : w;
    });
  }, [rows, columns, displayCount, getRealRow]);

  useEffect(() => {
    const up = () => (dragging.current = false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  useEffect(() => {
    if (!selection) anchor.current = null;
  }, [selection]);

  const wFor = (i: number) => widths[i] ?? (i === 0 ? DEFAULT_SOURCE_W : DEFAULT_OUT_W);

  const startResize = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const key = index === 0 ? SOURCE_COL : columns[index - 1]?.id;
    if (key) manuallyResized.current.add(key);
    resizing.current = { index, startX: e.clientX, startW: wFor(index) };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const r = resizing.current;
      if (!r) return;
      const w = Math.max(MIN_W, r.startW + (e.clientX - r.startX));
      setWidths((ws) => {
        const next = ws.slice();
        next[r.index] = w;
        return next;
      });
    };
    const up = () => {
      if (!resizing.current) return;
      resizing.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  /** Double-clic sur la poignée : ajuste la colonne à son contenu (échantillon optimisé). */
  const autoFit = useCallback(
    (index: number) => {
      const key = index === 0 ? SOURCE_COL : columns[index - 1]?.id;
      if (key) manuallyResized.current.add(key);
      const sampleLimit = Math.min(rows.length, 300);
      setWidths((ws) => {
        const next = ws.slice();
        if (index === 0) {
          let max = DEFAULT_SOURCE_W;
          for (let i = 0; i < sampleLimit; i++) max = Math.max(max, measure(rows[i] ?? ""));
          next[0] = Math.min(900, max);
        } else {
          const col = columns[index - 1];
          if (!col) return next;
          let max = Math.max(260, measure(col.name) + 120);
          for (let i = 0; i < sampleLimit; i++) max = Math.max(max, measure(cellValue(col, i)));
          next[index] = Math.min(700, max);
        }
        return next;
      });
    },
    [rows, columns],
  );

  // Mise à l'échelle du conteneur de défilement pour les très grands volumes (1M+ lignes)
  // afin de ne pas dépasser la limite de hauteur de pixel imposée par les moteurs de rendu navigateur.
  const MAX_DOM_HEIGHT = 10_000_000;
  const totalVirtualHeight = displayCount * ROW_H;
  const isScaled = totalVirtualHeight > MAX_DOM_HEIGHT;
  const scrollContainerHeight = isScaled ? MAX_DOM_HEIGHT : totalVirtualHeight;

  const virtualScrollTop = isScaled && scrollContainerHeight > height
    ? (scrollTop / (scrollContainerHeight - height)) * (totalVirtualHeight - height)
    : scrollTop;

  const start = Math.max(0, Math.floor(virtualScrollTop / ROW_H) - 8);
  const end = Math.min(displayCount, Math.ceil((virtualScrollTop + height) / ROW_H) + 8);
  const topOffset = isScaled
    ? Math.max(0, scrollTop - ((virtualScrollTop / ROW_H - start) * ROW_H))
    : start * ROW_H;

  const template = `${NUM_W}px ${wFor(0)}px ${columns.map((_, i) => `${wFor(i + 1)}px`).join(" ")} ${ADD_W}px`;

  const ResizeHandle = ({ index }: { index: number }) => (
    <span
      onMouseDown={(e) => startResize(index, e)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        autoFit(index);
      }}
      title="Glisser pour redimensionner · double-clic pour ajuster"
      className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize transition-colors hover:bg-primary/50"
    />
  );

  // ===== Sélection façon Excel =====

  /** Met à jour la sélection ; colonne 0 = source. */
  const select = (c: number, r: number, extend: boolean) => {
    r = Math.max(0, Math.min(displayCount - 1, r));
    c = Math.max(0, Math.min(columns.length, c));
    if (!extend || !anchor.current) anchor.current = { c, r };
    const a = anchor.current;
    onSelectionChange({ ac: a.c, ar: a.r, cc: c, cr: r });
    const realR = getRealRow(r);
    const col = c >= 1 ? columns[c - 1] : null;
    if (col) {
      onSelect(col.id);
      onFocusCell?.(col.id, realR);
    } else {
      onFocusCell?.(SOURCE_COL, realR);
    }
  };

  const onCellMouseDown = (c: number, row: number, e: React.MouseEvent) => {
    if (e.button !== 0 || resizing.current) return;
    // cellule déjà active : on laisse l'input prendre le focus (mode édition)
    const s = selection;
    if (s && s.ac === s.cc && s.ar === s.cr && s.ac === c && s.ar === row) return;
    e.preventDefault();
    dragging.current = true;
    select(c, row, e.shiftKey);
    // le conteneur porte le focus : flèches, Ctrl+C, Suppr… marchent comme sous Excel
    container.current?.focus({ preventScroll: true });
  };

  const onCellMouseEnter = (c: number, row: number) => {
    if (dragging.current) select(c, row, true);
  };

  /** Place le focus dans l'input d'une cellule (mode édition), en la faisant défiler. */
  const focusInput = (c: number, row: number) => {
    const el = scroller.current;
    if (!el) return;
    const top = row * ROW_H;
    if (top < el.scrollTop || top + ROW_H > el.scrollTop + el.clientHeight)
      el.scrollTop = Math.max(0, top - el.clientHeight / 2);
    setTimeout(() => {
      el.querySelector<HTMLInputElement>(`input[data-cell="${c}:${row}"]`)?.focus();
    }, 40);
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const el = document.activeElement;
    if (el instanceof HTMLInputElement && scroller.current?.contains(el)) {
      if (e.key === "Escape") {
        el.blur();
        container.current?.focus({ preventScroll: true }); // quitter l'édition, garder la sélection
      }
      return; // édition en cours : navigation texte normale
    }
    if (!selection) return;
    const a = anchor.current ?? { c: selection.ac, r: selection.ar };
    const c0 = Math.min(selection.ac, selection.cc);
    const c1 = Math.max(selection.ac, selection.cc);
    const r0 = Math.min(selection.ar, selection.cr);
    const r1 = Math.max(selection.ar, selection.cr);
    const nav: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const d = nav[e.key];
    if (d) {
      e.preventDefault();
      const base = e.shiftKey ? { c: selection.cc, r: selection.cr } : a;
      select(base.c + d[0], base.r + d[1], e.shiftKey);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      select(a.c + (e.shiftKey ? -1 : 1), a.r, false);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      select(a.c, a.r + (e.shiftKey ? -1 : 1), false);
      return;
    }
    if (e.key === "F2") {
      e.preventDefault();
      focusInput(a.c, a.r);
      return;
    }
    // Ctrl+« - » : supprime les lignes de la sélection (comme sous Excel)
    if ((e.ctrlKey || e.metaKey) && e.key === "-" && onRemoveRows) {
      e.preventDefault();
      onRemoveRows(getRealRow(r0), getRealRow(r1));
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      for (let c = c0; c <= c1; c++) {
        if (c === 0) {
          for (let r = r0; r <= r1; r++) onChangeSource?.(getRealRow(r), "");
          continue;
        }
        const col = columns[c - 1];
        if (!col) continue;
        for (let r = r0; r <= r1; r++) onChangeCell(col.id, getRealRow(r), "");
      }
      return;
    }
    // saisie directe : remplace le contenu de la cellule active puis passe en édition
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && a.r < displayCount) {
      const realR = getRealRow(a.r);
      if (a.c === 0) {
        if (!onChangeSource) return;
        e.preventDefault();
        onChangeSource(realR, e.key);
        focusInput(0, a.r);
        return;
      }
      const col = columns[a.c - 1];
      if (col) {
        e.preventDefault();
        onChangeCell(col.id, realR, e.key);
        focusInput(a.c, a.r);
      }
    }

  };

  const sb = selection
    ? {
        c0: Math.min(selection.ac, selection.cc),
        c1: Math.max(selection.ac, selection.cc),
        r0: Math.min(selection.ar, selection.cr),
        r1: Math.max(selection.ar, selection.cr),
      }
    : null;
  const inSel = (c: number, r: number) =>
    !!sb && r >= sb.r0 && r <= sb.r1 && c >= sb.c0 && c <= sb.c1;

  /** Décalage horizontal (px) du bord gauche de la colonne d'index c. */
  const colLeft = (c: number) => {
    let x = NUM_W;
    for (let k = 0; k < c; k++) x += wFor(k);
    return x;
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={container}
      tabIndex={-1}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden outline-none"
      onKeyDown={onGridKeyDown}
    >
      {/* corps (l'en-tête défile avec lui, en restant collé en haut) */}
      <div
        ref={scroller}
        onScroll={(e) => {
          setScrollTop(e.currentTarget.scrollTop);
          updateScrollRight();
        }}
        className="min-h-0 flex-1 overflow-auto custom-scrollbar"
      >
      <div
        className="sticky top-0 z-30 grid w-max border-b border-grid-line bg-surface-2 text-xs"
        style={{ gridTemplateColumns: template }}
      >
        <div className="grid-cell sticky left-0 z-40 bg-surface-2 px-2 py-2 text-center font-mono text-muted-foreground">
          #
        </div>
        <div className="grid-cell relative flex items-center justify-between px-3 py-1.5 font-semibold tracking-wide text-foreground">
          <div className="flex items-center gap-1.5 min-w-0 pr-2">
            <span className="truncate" title={sourceName || "Données source"}>
              {sourceName || "Données source"}
            </span>
            <span className="shrink-0 rounded bg-primary/20 px-1 py-0.5 text-[9px] font-mono text-primary font-bold uppercase tracking-wider">
              Source
            </span>
          </div>
          <ResizeHandle index={0} />
        </div>
        {columns.map((col) => (
          <div
            key={col.id}
            onClick={() => onSelect(col.id)}
            className={cn(
              "grid-cell group relative flex cursor-pointer items-center gap-1 px-2 py-1.5",
              activeId === col.id && "bg-primary/10 ring-1 ring-inset ring-primary/40",
            )}
          >
            <input
              value={col.name}
              title={col.name}
              onChange={(e) => onRename(col.id, e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-semibold text-foreground outline-none"
            />
            {col.pending ? (
              <Sparkles className="size-3.5 shrink-0 animate-pulse text-primary" />
            ) : col.rule ? (
              col.matched === rows.length ? (
                <span
                  className="shrink-0 inline-flex items-center gap-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400 font-medium"
                  title={`100% de complétude : les ${rows.length} lignes sont reconnues`}
                >
                  <CheckCircle2 className="size-2.5" />
                  100%
                </span>
              ) : (
                <span
                  className="shrink-0 inline-flex items-center gap-0.5 rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 font-mono text-[10px] text-amber-400 font-medium"
                  title={`${col.matched}/${rows.length} lignes reconnues (${rows.length - col.matched} non reconnues)`}
                >
                  {Math.round((col.matched / rows.length) * 100)}%
                </span>
              )
            ) : null}

            {/* Actions regroupées : apparaissent proprement au survol */}
            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 animate-in fade-in duration-100">
              {col.rule && (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const excelDialect = DIALECTS.find((d) => d.id === "excel");
                    if (excelDialect && col.rule) {
                      const snippet = excelDialect.snippet(col.rule.pattern, col.name, "fr", col.rule.replacement);
                      await copyToClipboard(snippet);
                      toast.success("Formule Excel 365 copiée !");
                    }
                  }}
                  className="rounded p-1 text-muted-foreground transition hover:bg-primary/20 hover:text-primary cursor-pointer"
                  title="Copier directement la formule Excel (=REGEX.EXTRAIRE...)"
                  aria-label="Copier la formule Excel"
                >
                  <ClipboardCopy className="size-3.5" />
                </button>
              )}
              {onSetAsSource && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetAsSource(col.id);
                  }}
                  className="rounded p-1 text-muted-foreground transition hover:bg-primary/20 hover:text-primary cursor-pointer"
                  title={`Définir « ${col.name} » comme colonne de données source (pour extraire depuis celle-ci)`}
                  aria-label="Définir comme source"
                >
                  <ArrowLeftToLine className="size-3.5" />
                </button>
              )}
              {onMoveColumn && columns.length > 1 && (
                <div className="flex items-center">
                  {columns.indexOf(col) > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveColumn(col.id, "left");
                      }}
                      className="rounded p-0.5 text-muted-foreground hover:bg-primary/20 hover:text-primary transition cursor-pointer"
                      title="Déplacer la colonne vers la gauche"
                      aria-label="Déplacer vers la gauche"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                  )}
                  {columns.indexOf(col) < columns.length - 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveColumn(col.id, "right");
                      }}
                      className="rounded p-0.5 text-muted-foreground hover:bg-primary/20 hover:text-primary transition cursor-pointer"
                      title="Déplacer la colonne vers la droite"
                      aria-label="Déplacer vers la droite"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveColumn(col.id);
                }}
                className="rounded p-1 text-muted-foreground transition hover:bg-destructive/20 hover:text-destructive cursor-pointer"
                aria-label="Supprimer la colonne"
                title="Supprimer la colonne"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <ResizeHandle index={columns.indexOf(col) + 1} />
          </div>
        ))}
        <TooltipProvider delayDuration={50}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onAddColumn}
                className="grid-cell flex items-center justify-center text-muted-foreground transition hover:bg-primary/10 hover:text-primary cursor-pointer group"
                aria-label="Ajouter une colonne"
                title="Ajouter une colonne"
              >
                <Plus className="size-4 transition-transform group-hover:scale-125" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              sideOffset={4}
              className="z-50 bg-popover text-foreground border border-border shadow-lg text-xs font-semibold py-1 px-2.5"
            >
              Ajouter une colonne
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
        <div style={{ height: scrollContainerHeight, position: "relative" }}>
          <div style={{ position: "absolute", top: topOffset, left: 0, right: 0 }}>
            {Array.from({ length: Math.max(0, end - start) }, (_, k) => {
              const visualRow = start + k;
              const realRow = getRealRow(visualRow);
              const source = rows[realRow] ?? "";
              return (
                <div
                  key={realRow}
                  className="grid hover:bg-surface/60"
                  style={{ gridTemplateColumns: template, height: ROW_H }}
                >
                  <div className="group/row grid-cell sticky left-0 z-10 relative flex items-center justify-center bg-background">
                    <span
                      className="font-mono text-[11px] text-muted-foreground group-hover/row:opacity-0"
                      title={`Ligne ${realRow + 1} du fichier source`}
                    >
                      {realRow + 1}
                    </span>
                    {onRemoveRows && (
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveRows(realRow, realRow);
                        }}
                        title="Supprimer cette ligne"
                        aria-label="Supprimer cette ligne"
                        className="absolute inset-y-0 flex w-full items-center justify-center text-muted-foreground opacity-0 transition hover:text-destructive group-hover/row:opacity-100"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <div
                    onMouseDown={(e) => onCellMouseDown(0, visualRow, e)}
                    onMouseEnter={() => onCellMouseEnter(0, visualRow)}
                    className={cn(
                      "grid-cell flex cursor-cell items-center",
                      inSel(0, visualRow) && "bg-primary/10",
                    )}
                    title={source}
                  >
                    <input
                      data-cell={`0:${visualRow}`}
                      value={source}
                      onFocus={() => onFocusCell?.(SOURCE_COL, realRow)}
                      onChange={(e) => onChangeSource?.(realRow, e.target.value)}
                      onSelect={(e) => {
                        const target = e.currentTarget;
                        const start = target.selectionStart ?? 0;
                        const end = target.selectionEnd ?? 0;
                        if (end > start) {
                          const selected = target.value.slice(start, end);
                          if (selected.trim().length > 0) {
                            setSourceSelection({ row: realRow, text: selected });
                            return;
                          }
                        }
                        setSourceSelection(null);
                      }}
                      onMouseUp={(e) => {
                        const target = e.currentTarget;
                        const start = target.selectionStart ?? 0;
                        const end = target.selectionEnd ?? 0;
                        if (end > start) {
                          const selected = target.value.slice(start, end);
                          if (selected.trim().length > 0) {
                            setSourceSelection({ row: realRow, text: selected });
                          }
                        }
                      }}
                      readOnly={!onChangeSource}
                      placeholder="donnée source…"
                      className="h-full w-full bg-transparent px-3 font-mono text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50 focus:bg-primary/15"
                    />
                  </div>

                  {columns.map((col) => {
                    const cIdx = columns.indexOf(col) + 1;
                    const isUser = col.user[realRow] != null && col.user[realRow] !== "";
                    const userVal = col.user[realRow] ?? "";
                    const isTypoWarning =
                      isUser &&
                      userVal.trim() !== "" &&
                      !source.includes(userVal) &&
                      !col.rule?.replacement;
                    const failed = !isUser && col.rule != null && col.derived[realRow] == null && source !== "";
                    return (
                      <div
                        key={col.id}
                        onMouseDown={(e) => onCellMouseDown(cIdx, visualRow, e)}
                        onMouseEnter={() => onCellMouseEnter(cIdx, visualRow)}
                        className={cn(
                          "grid-cell relative flex items-center",
                          activeId === col.id && !inSel(cIdx, visualRow) && "bg-primary/[0.04]",
                          inSel(cIdx, visualRow) && "bg-primary/10",
                          failed && "bg-destructive/10",
                          isTypoWarning && "bg-amber-500/10",
                        )}
                      >
                        <input
                          data-cell={`${cIdx}:${visualRow}`}
                          value={cellValue(col, realRow)}
                          onFocus={() => {
                            onSelect(col.id);
                            onFocusCell?.(col.id, realRow);
                          }}
                          onChange={(e) => onChangeCell(col.id, realRow, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (e.shiftKey) {
                                if (visualRow > 0) focusInput(cIdx, visualRow - 1);
                              } else {
                                if (visualRow + 1 < displayCount) focusInput(cIdx, visualRow + 1);
                              }
                            }
                          }}
                          placeholder={
                            col.rule
                              ? ""
                              : visualRow === 0
                                ? "1er exemple attendu…"
                                : visualRow === 1
                                  ? "(Optionnel) 2e exemple…"
                                  : "✨ Sera calculé par la Regex…"
                          }
                          className={cn(
                            "h-full w-full bg-transparent px-2.5 font-mono text-[13px] outline-none placeholder:text-muted-foreground/50 focus:bg-primary/15",
                            isUser ? "font-medium text-primary" : "text-derived",
                          )}
                        />
                        {isTypoWarning && (
                          <span
                            title="Attention : cette valeur saisie n'apparaît pas telle quelle dans la cellule source. Vérifiez qu'il n'y a pas de faute de frappe ou d'espace en trop."
                            className="absolute right-1.5 z-10 cursor-help text-amber-400"
                          >
                            <AlertCircle className="size-3.5" />
                          </span>
                        )}
                        {failed && !isTypoWarning && (
                          <AlertTriangle className="pointer-events-none absolute right-1.5 size-3.5 text-destructive" />
                        )}
                      </div>
                    );
                  })}
                  <div className="grid-cell" />
                </div>
              );
            })}
          </div>
          {/* cadre de sélection */}
          {sb && sb.r0 < displayCount && (
            <div
              className="pointer-events-none absolute z-20 ring-2 ring-inset ring-primary/80"
              style={{
                left: colLeft(sb.c0),
                top: sb.r0 * ROW_H,
                width: colLeft(sb.c1 + 1) - colLeft(sb.c0),
                height: (Math.min(sb.r1, displayCount - 1) - sb.r0 + 1) * ROW_H,
              }}
            />
          )}
        </div>
        {rows.length > 0 && onAddRow && (
          <button
            onClick={onAddRow}
            className="flex w-full items-center gap-2 border-t border-grid-line px-3 py-2 text-left text-xs text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
          >
            <Plus className="size-3.5" />
            Ajouter une ligne
          </button>
        )}
      </div>

      {/* Barre flottante d'exemple rapide sur surlignage souris */}
      {sourceSelection && activeId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-full border border-primary/40 bg-surface-2/95 px-4 py-2 text-xs shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2">
          <Sparkles className="size-4 text-primary animate-pulse shrink-0" />
          <span className="text-muted-foreground">
            Sélection : <strong className="font-mono text-foreground font-semibold">"{sourceSelection.text}"</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              onChangeCell(activeId, sourceSelection.row, sourceSelection.text);
              setSourceSelection(null);
            }}
            className="ml-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition cursor-pointer active:scale-95"
            title="Remplir la colonne active avec le texte surligné sans risquer d'erreur de frappe"
          >
            ✨ Définir comme exemple (Ligne {sourceSelection.row + 1})
          </button>
          <button
            type="button"
            onClick={() => setSourceSelection(null)}
            className="rounded-full p-1 text-muted-foreground hover:text-foreground transition cursor-pointer"
            title="Fermer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Dégradé d'estompement et ombre interne sur le bord droit : signale visuellement qu'il reste du contenu masqué */}
      <div
        className={cn(
          "pointer-events-none absolute top-0 bottom-0 right-0 z-30 w-16 transition-opacity duration-300",
          "bg-gradient-to-l from-background/95 via-background/40 to-transparent",
          "shadow-[inset_-14px_0_18px_-8px_rgba(0,0,0,0.85)]",
          canScrollRight ? "opacity-100" : "opacity-0"
        )}
        aria-hidden="true"
      />
    </div>
  );
}
