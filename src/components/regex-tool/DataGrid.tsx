import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { cellValue, type OutputColumn } from "./types";

const ROW_H = 34;

interface Props {
  rows: string[];
  columns: OutputColumn[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onChangeCell: (colId: string, row: number, value: string) => void;
  onRename: (colId: string, name: string) => void;
  onAddColumn: () => void;
  onRemoveColumn: (colId: string) => void;
}

export function DataGrid({
  rows,
  columns,
  activeId,
  onSelect,
  onChangeCell,
  onRename,
  onAddColumn,
  onRemoveColumn,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - 8);
  const end = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_H) + 8);
  const visible = rows.slice(start, end);

  const template = `56px minmax(260px, 1.6fr) ${columns.map(() => "minmax(150px, 1fr)").join(" ")} 52px`;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* en-têtes */}
      <div
        className="grid shrink-0 border-b border-grid-line bg-surface-2 text-xs"
        style={{ gridTemplateColumns: template }}
      >
        <div className="grid-cell px-2 py-2 text-center font-mono text-muted-foreground">#</div>
        <div className="grid-cell px-3 py-2 font-semibold tracking-wide text-foreground">
          Données source
        </div>
        {columns.map((col) => (
          <div
            key={col.id}
            onClick={() => onSelect(col.id)}
            className={cn(
              "grid-cell group flex cursor-pointer items-center gap-1 px-2 py-1.5",
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
                    className="grid-cell flex items-center truncate px-3 font-mono text-[13px] text-foreground"
                    title={source}
                  >
                    {source}
                  </div>
                  {columns.map((col) => {
                    const isUser = col.user[i] != null && col.user[i] !== "";
                    const failed = !isUser && col.rule != null && col.derived[i] == null && source !== "";
                    return (
                      <div
                        key={col.id}
                        className={cn(
                          "grid-cell relative flex items-center",
                          activeId === col.id && "bg-primary/[0.04]",
                          failed && "bg-destructive/10",
                        )}
                      >
                        <input
                          value={cellValue(col, i)}
                          onFocus={() => onSelect(col.id)}
                          onChange={(e) => onChangeCell(col.id, i, e.target.value)}
                          placeholder={col.rule ? "" : "résultat attendu…"}
                          className={cn(
                            "h-full w-full bg-transparent px-2.5 font-mono text-[13px] outline-none placeholder:text-muted-foreground/50 focus:bg-primary/10",
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
        </div>
      </div>
    </div>
  );
}
