import Papa from "papaparse";
import * as XLSX from "xlsx";

export type Matrix = string[][];

/** Texte collé : TSV (Excel), CSV point-virgule, ou lignes simples. */
export function parsePastedText(text: string): Matrix {
  const clean = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (!clean) return [];
  const lines = clean.split("\n");
  if (clean.includes("\t")) {
    const parsed = Papa.parse<string[]>(clean, { delimiter: "\t", skipEmptyLines: true });
    if (parsed.data.length)
      return (parsed.data as Matrix).map((r) => r.map((c) => (c == null ? "" : String(c))));
  }
  // point-virgule uniquement : la virgule est trop souvent un séparateur décimal
  const sample = lines.length > 200 ? lines.slice(0, 200) : lines;
  if (sample.length > 0 && sample.every((l) => l.includes(";"))) {
    const parsed = Papa.parse<string[]>(clean, { delimiter: ";", skipEmptyLines: true });
    if (parsed.data.length) return parsed.data as Matrix;
  }
  return lines.map((l) => [l]);
}

/** Cellules seules au format tabulations (copie d'une plage). */
export function cellsToTsv(rows: Matrix): string {
  const cell = (v: string) => (/[\t\n"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return rows.map((r) => r.map(cell).join("\t")).join("\n");
}

/** Tableau au format tabulations : collable directement dans Excel. */
export function toTsv(header: string[], rows: Matrix): string {
  return cellsToTsv([header, ...rows]);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}


export async function parseFile(file: File): Promise<Matrix> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, raw: false });
    return rows.map((r) => (r as unknown[]).map((c) => (c == null ? "" : String(c))));
  }
  const text = await file.text();
  if (name.endsWith(".csv")) {
    const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
    return (parsed.data as Matrix).map((r) => r.map((c) => (c == null ? "" : String(c))));
  }
  return parsePastedText(text);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCsv(header: string[], rows: Matrix, filename = "resultats.csv") {
  const csv = Papa.unparse([header, ...rows], { delimiter: ";" });
  download(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), filename);
}

export function exportXlsx(header: string[], rows: Matrix, filename = "resultats.xlsx") {
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Résultats");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  download(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename,
  );
}
