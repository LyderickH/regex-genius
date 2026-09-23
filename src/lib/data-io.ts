import Papa from "papaparse";
import * as XLSX from "xlsx";

export type Matrix = string[][];

/** Texte collé : TSV (Excel), CSV, ou lignes simples. */
export function parsePastedText(text: string): Matrix {
  const clean = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (!clean) return [];
  const lines = clean.split("\n");
  if (lines.some((l) => l.includes("\t"))) return lines.map((l) => l.split("\t"));
  // point-virgule uniquement : la virgule est trop souvent un séparateur décimal
  if (lines.every((l) => l.includes(";"))) {
    const parsed = Papa.parse<string[]>(clean, { delimiter: ";", skipEmptyLines: true });
    if (parsed.data.length) return parsed.data as Matrix;
  }
  return lines.map((l) => [l]);
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
