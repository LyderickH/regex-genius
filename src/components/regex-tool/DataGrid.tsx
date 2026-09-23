import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { cellValue, type OutputColumn } from "./types";

const ROW_H = 34;
const NUM_W = 56;
const ADD_W = 52;
const MIN_W = 100;
const DEFAULT_SOURCE_W = 460;
const DEFAULT_OUT_W = 190;
/** Identifiant fictif de la colonne « Données source ». */
export const SOURCE_COL = "__source__";


/** Sélection façon Excel : ancre (ac,ar) + coin opposé (cc,cr). Colonne 0 = source. */
export interface GridSel {
  ac: number;
  ar: number;
  cc: number;
  cr: number;
}

/** Largeur approximative d'une chaîne en police mono 13px. */
function measure(text: string): number {
  return Math.min(1200, Math.max(MIN_W, text.length * 7.8 + 28));
}

interface Props {
  rows: string[];
  columns: OutputColumn[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onChangeCell: (colId: string, row: number, value: string) => void;
  onChangeSource?: (row: number, value: string) => void;
  onAddRow?: () => void;
  onFocusCell?: (colId: string, row: number) => void;

  onRename: (colId: string, name: string) => void;
  onAddColumn: () => void;
  onRemoveColumn: (colId: string) => void;
  selection: GridSel | null;
  onSelectionChange: (s: GridSel | null) => void;
}

export function DataGrid({
  rows,
  columns,
  activeId,
  onSelect,
  onChangeCell,
  onChangeSource,
  onAddRow,
  onFocusCell,

  onRename,
  onAddColumn,
  onRemoveColumn,
  selection,
  onSelectionChange,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(600);
  // widths[0] = colonne source, widths[1..n] = colonnes de résultat
  const [widths, setWidths] = useState<number[]>([]);
  const resizing = useRef<{ index: number; startX: number; startW: number } | null>(null);
  const anchor = useRef<{ c: number; r: number } | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // Synchronise le nombre de largeurs avec le nombre de colonnes.
  useEffect(() => {
    setWidths((w) => {
      const need = columns.length + 1;
      if (w.length === need) return w;
      const next = w.slice(0, need);
      while (next.length < need) next.push(next.length === 0 ? DEFAULT_SOURCE_W : DEFAULT_OUT_W);
      return next;
    });
  }, [columns.length]);

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

  /** Double-clic sur la poignée : ajuste la colonne à son contenu le plus long. */
  const autoFit = useCallback(
    (index: number) => {
      setWidths((ws) => {
        const next = ws.slice();
        if (index === 0) {
          next[0] = rows.reduce((m, r) => Math.max(m, measure(r)), DEFAULT_SOURCE_W);
        } else {
          const col = columns[index - 1];
          if (!col) return next;
          let max = measure(col.name);
          for (let i = 0; i < rows.length; i++) max = Math.max(max, measure(cellValue(col, i)));
          next[index] = max;
        }
        return next;
      });
    },
    [rows, columns],
  );

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - 8);
  const end = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_H) + 8);
  const visible = rows.slice(start, end);

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
    r = Math.max(0, Math.min(rows.length - 1, r));
    c = Math.max(0, Math.min(columns.length, c));
    if (!extend || !anchor.current) anchor.current = { c, r };
    const a = anchor.current;
    onSelectionChange({ ac: a.c, ar: a.r, cc: c, cr: r });
    const col = c >= 1 ? columns[c - 1] : null;
    if (col) {
      onSelect(col.id);
      onFocusCell?.(col.id, r);
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
      if (a.c >= 1) focusInput(a.c, a.r);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      for (let c = Math.max(1, c0); c <= c1; c++) {
        const col = columns[c - 1];
        if (!col) continue;
        for (let r = r0; r <= r1; r++) onChangeCell(col.id, r, "");
      }
      return;
    }
    // saisie directe : remplace le contenu de la cellule active puis passe en édition
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && a.c >= 1) {
      const col = columns[a.c - 1];
      if (col && a.r < rows.length) {
        e.preventDefault();
        onChangeCell(col.id, a.r, e.key);
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
      className="flex min-h-0 flex-1 flex-col overflow-hidden outline-none"
      onKeyDown={onGridKeyDown}
    >
      {/* en-têtes */}
      <div
        className="grid shrink-0 border-b border-grid-line bg-surface-2 text-xs"
        style={{ gridTemplateColumns: template }}
      >
        <div className="grid-cell px-2 py-2 text-center font-mono text-muted-foreground">#</div>
        <div className="grid-cell relative px-3 py-2 font-semibold tracking-wide text-foreground">
          Données source
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
              onChange={(e) => onRename(col.id, e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-semibold text-foreground outline-none"
            />
            {col.pending ? (
              <Sparkles className="size-3.5 shrink-0 animate-pulse text-primary" />
            ) : col.rule ? (
              <span className="shrink-0 rounded bg-derived-soft px-1 font-mono text-[10px] text-derived">
                {col.matched}/{rows.length}
              </span>
            ) : null}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveColumn(col.id);
              }}
              className="shrink-0 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
              aria-label="Supprimer la colonne"
            >
              <Trash2 className="size-3.5" />
            </button>
            <ResizeHandle index={columns.indexOf(col) + 1} />
          </div>
        ))}
        <button
          onClick={onAddColumn}
          className="grid-cell flex items-center justify-center text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
          aria-label="Ajouter une colonne de résultat"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {/* corps */}
      <div
        ref={scroller}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="min-h-0 flex-1 overflow-auto"
      >
        <div style={{ height: rows.length * ROW_H, position: "relative" }}>
          <div style={{ position: "absolute", top: start * ROW_H, left: 0, right: 0 }}>
            {visible.map((source, k) => {
              const i = start + k;
              return (
                <div
                  key={i}
                  className="grid hover:bg-surface/60"
                  style={{ gridTemplateColumns: template, height: ROW_H }}
                >
                  <div className="grid-cell flex items-center justify-end px-2 font-mono text-[11px] text-muted-foreground">
                    {i + 1}
                  </div>
                  <div
                    onMouseDown={(e) => onCellMouseDown(0, i, e)}
                    onMouseEnter={() => onCellMouseEnter(0, i)}
                    className={cn(
                      "grid-cell flex cursor-cell items-center",
                      inSel(0, i) && "bg-primary/10",
                    )}
                    title={source}
                  >
                    <input
                      data-cell={`0:${i}`}
                      value={source}
                      onFocus={() => onFocusCell?.(SOURCE_COL, i)}
                      onChange={(e) => onChangeSource?.(i, e.target.value)}
                      readOnly={!onChangeSource}
                      placeholder="donnée source…"
                      className="h-full w-full bg-transparent px-3 font-mono text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50 focus:bg-primary/15"
                    />
                  </div>

                  {columns.map((col) => {
                    const cIdx = columns.indexOf(col) + 1;
                    const isUser = col.user[i] != null && col.user[i] !== "";
                    const failed = !isUser && col.rule != null && col.derived[i] == null && source !== "";
                    return (
                      <div
                        key={col.id}
                        onMouseDown={(e) => onCellMouseDown(cIdx, i, e)}
                        onMouseEnter={() => onCellMouseEnter(cIdx, i)}
                        className={cn(
                          "grid-cell relative flex items-center",
                          activeId === col.id && !inSel(cIdx, i) && "bg-primary/[0.04]",
                          inSel(cIdx, i) && "bg-primary/10",
                          failed && "bg-destructive/10",
                        )}
                      >
                        <input
                          data-cell={`${cIdx}:${i}`}
                          value={cellValue(col, i)}
                          onFocus={() => {
                            onSelect(col.id);
                            onFocusCell?.(col.id, i);
                          }}
                          onChange={(e) => onChangeCell(col.id, i, e.target.value)}
                          placeholder={col.rule ? "" : "résultat attendu…"}
                          className={cn(
                            "h-full w-full bg-transparent px-2.5 font-mono text-[13px] outline-none placeholder:text-muted-foreground/50 focus:bg-primary/15",
                            isUser ? "font-medium text-primary" : "text-derived",
                          )}
                        />
                        {failed && (
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
          {sb && sb.r0 < rows.length && (
            <div
              className="pointer-events-none absolute z-20 ring-2 ring-inset ring-primary/80"
              style={{
                left: colLeft(sb.c0),
                top: sb.r0 * ROW_H,
                width: colLeft(sb.c1 + 1) - colLeft(sb.c0),
                height: (Math.min(sb.r1, rows.length - 1) - sb.r0 + 1) * ROW_H,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
