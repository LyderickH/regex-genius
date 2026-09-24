import Papa from "papaparse";
import * as XLSX from "xlsx";
import { type Rule, ruleChain, firstGroup, applyTransform } from "./regex-synth/engine";

export type Matrix = string[][];

export const MAX_INTERACTIVE_ROWS = 50_000;

export interface ParsedDataset {
  matrix: Matrix;
  totalLines: number;
  isSampled: boolean;
  file?: File;
  rawText?: string;
}

/** Supprime les caractères invisibles parasites : BOM UTF-8, zero-width space, soft-hyphen */
export function sanitizeInvisibleChars(text: string): string {
  if (!text) return "";
  return text
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B\u200C\u200D\u00AD]/g, "");
}

/** Texte collé : TSV (Excel), CSV point-virgule, ou lignes simples. */
export function parsePastedText(text: string): Matrix {
  if (!text) return [];
  const cleanText = sanitizeInvisibleChars(text);
  const lines = cleanText.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  if (lines.length === 0) return [];

  // Détection rapide sur les 200 premières lignes
  const sampleLimit = Math.min(lines.length, 200);
  let hasTab = false;
  let hasSemi = true;
  for (let i = 0; i < sampleLimit; i++) {
    if (lines[i].includes("\t")) hasTab = true;
    if (!lines[i].includes(";")) hasSemi = false;
  }

  if (hasTab) {
    const parsed = Papa.parse<string[]>(cleanText, { delimiter: "\t", skipEmptyLines: true });
    if (parsed.data.length)
      return (parsed.data as Matrix).map((r) => r.map((c) => (c == null ? "" : String(c))));
  }
  if (hasSemi && sampleLimit > 0) {
    const parsed = Papa.parse<string[]>(cleanText, { delimiter: ";", skipEmptyLines: true });
    if (parsed.data.length) return parsed.data as Matrix;
  }

  // Pour un fichier à colonne unique (ex: 1M lignes de log/texte brut)
  return lines.map((l) => [l]);
}

/** Analyse un texte collé et retourne un échantillon interactif si le volume dépasse 50k lignes */
export function parsePastedDataset(text: string, maxInteractive = MAX_INTERACTIVE_ROWS): ParsedDataset {
  const fullMatrix = parsePastedText(text);
  const totalLines = fullMatrix.length;
  const isSampled = totalLines > maxInteractive;
  const matrix = isSampled ? fullMatrix.slice(0, maxInteractive) : fullMatrix;
  return {
    matrix,
    totalLines,
    isSampled,
    rawText: isSampled ? text : undefined,
  };
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
  const res = await parseFileDataset(file, Infinity);
  return res.matrix;
}

/**
 * Analyse un fichier et extrait un échantillon interactif de 50 000 lignes
 * pour que le studio de Regex reste ultra-fluide, tout en conservant la référence
 * au fichier source pour appliquer les regex à 100% des lignes lors de l'export.
 */
export interface FileLoadProgress {
  percent: number;
  step: string;
}

export async function parseFileDataset(
  file: File,
  maxInteractive = MAX_INTERACTIVE_ROWS,
  onProgress?: (progress: FileLoadProgress) => void,
): Promise<ParsedDataset> {
  const name = file.name.toLowerCase();
  const totalBytes = file.size || 1;
  const sizeMb = (totalBytes / (1024 * 1024)).toFixed(1);

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    onProgress?.({ percent: 15, step: `Lecture du fichier Excel (${sizeMb} Mo)...` });
    const buf = await file.arrayBuffer();
    onProgress?.({ percent: 50, step: "Décodage du classeur Excel..." });
    await new Promise((r) => setTimeout(r, 0));
    const wb = XLSX.read(buf, { type: "array" });
    onProgress?.({ percent: 75, step: "Extraction des données tabulaires..." });
    const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
    if (!sheet) return { matrix: [], totalLines: 0, isSampled: false };
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, raw: false });
    onProgress?.({ percent: 90, step: "Conversion de l'échantillon interactif..." });
    const full = rows.map((r) => (r as unknown[]).map((c) => (c == null ? "" : String(c))));
    const isSampled = full.length > maxInteractive;
    onProgress?.({ percent: 100, step: "Chargement terminé !" });
    return {
      matrix: isSampled ? full.slice(0, maxInteractive) : full,
      totalLines: full.length,
      isSampled,
      file: isSampled ? file : undefined,
    };
  }

  // Lecture des fichiers texte (CSV, TSV, TXT, LOG)
  let text = "";
  if (typeof file.stream === "function") {
    onProgress?.({ percent: 5, step: `Lecture du fichier (${sizeMb} Mo)...` });
    const reader = file.stream().getReader();
    const decoder = new TextDecoder("utf-8");
    let bytesRead = 0;
    const chunks: string[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.length;
      chunks.push(decoder.decode(value, { stream: true }));
      const readMb = (bytesRead / (1024 * 1024)).toFixed(1);
      const pct = Math.min(80, Math.round((bytesRead / totalBytes) * 75) + 5);
      onProgress?.({
        percent: pct,
        step: `Lecture : ${readMb} Mo / ${sizeMb} Mo (${pct}%)`,
      });
      // Permettre le rafraîchissement régulier de l'affichage
      if (chunks.length % 4 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    chunks.push(decoder.decode());
    text = chunks.join("");
  } else {
    onProgress?.({ percent: 40, step: `Lecture du fichier (${sizeMb} Mo)...` });
    text = await file.text();
  }

  onProgress?.({ percent: 82, step: "Analyse de la structure et des délimiteurs..." });
  await new Promise((r) => setTimeout(r, 0));

  if (name.endsWith(".csv")) {
    const firstChunk = text.slice(0, 4000);
    const hasDelimiter = firstChunk.includes(";") || firstChunk.includes(",") || firstChunk.includes("\t");
    if (hasDelimiter) {
      onProgress?.({ percent: 88, step: "Découpage CSV structuré..." });
      const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
      if (parsed.data.length) {
        onProgress?.({ percent: 95, step: "Préparation de l'échantillon interactif..." });
        const full = (parsed.data as Matrix).map((r) => r.map((c) => (c == null ? "" : String(c))));
        const isSampled = full.length > maxInteractive;
        onProgress?.({ percent: 100, step: "Chargement terminé !" });
        return {
          matrix: isSampled ? full.slice(0, maxInteractive) : full,
          totalLines: full.length,
          isSampled,
          file: isSampled ? file : undefined,
        };
      }
    }
  }

  onProgress?.({ percent: 92, step: "Découpage des lignes..." });
  const parsed = parsePastedDataset(text, maxInteractive);
  onProgress?.({ percent: 100, step: "Chargement terminé !" });
  return {
    ...parsed,
    file: parsed.isSampled ? file : undefined,
  };
}

function download(blob: Blob, filename: string) {
  if (typeof document === "undefined") return;
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

/**
 * Applique toutes les regex déduites à l'intégralité du fichier d'origine (1M+ lignes)
 * en streaming par blocs sans saturer la mémoire vive du navigateur.
 */
export async function exportFullDatasetStreaming({
  file,
  rawText,
  totalLines,
  header,
  columns,
  filename = "resultats_complet.csv",
  onProgress,
}: {
  file?: File | null;
  rawText?: string | null;
  totalLines: number;
  header: string[];
  columns: { name: string; rule: Rule | null }[];
  filename?: string;
  onProgress?: (percent: number) => void;
}): Promise<void> {
  const sep = ";";
  const escapeCell = (s: string): string => {
    if (s.includes(sep) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  // Compiler les règles une seule fois
  const compiled = columns.map((col) => {
    if (!col.rule) return null;
    const chain = ruleChain(col.rule).map((r) => ({
      re: new RegExp(r.source, r.flags),
      transform: r.transform,
      replacement: r.replacement,
    }));
    return (input: string): string => {
      for (const { re, transform, replacement } of chain) {
        if (replacement !== undefined) {
          if (re.test(input)) {
            return applyTransform(input.replace(re, replacement), transform);
          }
        } else {
          const m = re.exec(input);
          if (m) {
            const g = firstGroup(m);
            if (g !== undefined) return applyTransform(g, transform);
          }
        }
      }
      return "";
    };
  });

  const headerLine = header.map(escapeCell).join(sep) + "\r\n";
  const chunks: string[] = ["\uFEFF", headerLine];

  const sourceText = rawText ?? (file ? await file.text() : "");
  const lines = sourceText.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  const total = lines.length;
  let batchStr = "";
  const BATCH_SIZE = 25_000;

  for (let i = 0; i < total; i++) {
    const rawLine = lines[i]!;
    let src = rawLine;
    if (rawLine.includes(sep) || rawLine.includes(",")) {
      const delim = rawLine.includes(sep) ? sep : ",";
      const endIdx = rawLine.indexOf(delim);
      if (endIdx > 0 && !rawLine.startsWith('"')) {
        src = rawLine.slice(0, endIdx);
      }
    }
    let rowCsv = escapeCell(src);
    for (let c = 0; c < compiled.length; c++) {
      const fn = compiled[c];
      const val = fn ? fn(src) : "";
      rowCsv += sep + escapeCell(val);
    }
    batchStr += rowCsv + "\r\n";

    if ((i + 1) % BATCH_SIZE === 0 || i === total - 1) {
      chunks.push(batchStr);
      batchStr = "";
      if (onProgress) {
        onProgress(Math.round(((i + 1) / total) * 100));
      }
      // Laisser respirer le thread UI
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const blob = new Blob(chunks, { type: "text/csv;charset=utf-8" });
  download(blob, filename);
}
