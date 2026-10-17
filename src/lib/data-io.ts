import Papa from "papaparse";
import * as XLSX from "xlsx";
import { type Rule, ruleChain, firstGroup, applyTransform } from "./regex-synth/engine";

export type Matrix = string[][];

export const MAX_INTERACTIVE_ROWS = 50_000;

export type DelimiterMode = "with_delimiter" | "without_delimiter";

export interface ParseOptions {
  delimiterMode?: DelimiterMode;
  delimiter?: string;
}

export interface ParsedDataset {
  matrix: Matrix;
  totalLines: number;
  isSampled: boolean;
  file?: File;
  rawText?: string;
  rawLinesMatrix?: Matrix;
  delimiterMode?: DelimiterMode;
}

/** Supprime les caractères invisibles parasites : BOM UTF-8, zero-width space, soft-hyphen */
export function sanitizeInvisibleChars(text: string): string {
  if (!text) return "";
  return text.replace(/^\uFEFF/, "").replace(/[\u200B\u200C\u200D\u00AD]/g, "");
}

/** Texte collé : TSV (Excel), CSV point-virgule, ou lignes simples (avec ou sans délimiteur). */
/** Texte nettoyé et découpé en lignes (sans la dernière ligne vide). */
function splitLines(text: string): { cleanText: string; lines: string[] } {
  const cleanText = sanitizeInvisibleChars(text);
  const lines = cleanText.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return { cleanText, lines };
}

/** PapaParse ne lit que le 1er Mo pour deviner le saut de ligne et 10 lignes pour le délimiteur. */
const GUESS_WINDOW = 1024 * 1024;

/**
 * Même décision que « Papa.parse(texte complet) donne-t-il au moins 70 % de lignes
 * multi-colonnes parmi les 50 premières ? », mais calculée sur un préfixe borné :
 * le texte n'est analysé en entier que s'il est réellement multi-colonnes.
 */
function autoDetectIsMultiColumn(cleanText: string): boolean {
  let prefixLen = Math.min(cleanText.length, 2 * GUESS_WINDOW);
  let preview = 64;
  for (;;) {
    const isWhole = prefixLen >= cleanText.length;
    const input = isWhole ? cleanText : cleanText.slice(0, prefixLen);
    const res = Papa.parse<string[]>(input, { skipEmptyLines: true, preview });
    const data = res.data;
    // fiable si tout le texte a été vu, ou si l'analyse s'est arrêtée sur `preview`
    // (toutes les lignes retenues sont alors complètes)
    const reliable = isWhole || res.meta.truncated;
    if (reliable) {
      const exhausted = isWhole && !res.meta.truncated;
      if (data.length >= 50 || exhausted) {
        if (!data.length || (data[0]?.length ?? 0) <= 1) return false;
        const multiColCount = data.slice(0, 50).filter((r) => r.length > 1).length;
        return multiColCount >= Math.min(data.length, 50) * 0.7;
      }
      // trop de lignes vides filtrées : élargir la prévisualisation
      preview *= 4;
    } else {
      // lignes très longues ou champ multi-ligne : agrandir le préfixe
      prefixLen = Math.min(cleanText.length, prefixLen * 2);
    }
  }
}

export function parsePastedText(text: string, options?: ParseOptions): Matrix {
  if (!text) return [];
  const { cleanText, lines } = splitLines(text);
  return parseLines(cleanText, lines, options);
}

function parseLines(cleanText: string, lines: string[], options?: ParseOptions): Matrix {
  if (lines.length === 0) return [];

  // Mode explicite sans délimiteur : texte brut conservé intact ligne par ligne
  if (options?.delimiterMode === "without_delimiter") {
    return lines.map((l) => [l]);
  }

  // Délimiteur explicite spécifié par l'utilisateur
  if (options?.delimiter && options.delimiter !== "auto") {
    const parsed = Papa.parse<string[]>(cleanText, {
      delimiter: options.delimiter,
      skipEmptyLines: true,
    });
    if (parsed.data.length) {
      return (parsed.data as Matrix).map((r) => r.map((c) => (c == null ? "" : String(c))));
    }
  }

  // Détection rapide sur les 200 premières lignes
  const sampleLimit = Math.min(lines.length, 200);
  let hasTab = false;
  let hasSemi = true;
  let hasPipe = true;
  let hasComma = true;
  for (let i = 0; i < sampleLimit; i++) {
    if (lines[i].includes("\t")) hasTab = true;
    if (!lines[i].includes(";")) hasSemi = false;
    if (!lines[i].includes("|")) hasPipe = false;
    if (!lines[i].includes(",")) hasComma = false;
  }

  if (hasTab) {
    const parsed = Papa.parse<string[]>(cleanText, { delimiter: "\t", skipEmptyLines: true });
    if (parsed.data.length)
      return (parsed.data as Matrix).map((r) => r.map((c) => (c == null ? "" : String(c))));
  }
  if (hasSemi && sampleLimit > 0) {
    const parsed = Papa.parse<string[]>(cleanText, { delimiter: ";", skipEmptyLines: true });
    if (parsed.data.length)
      return (parsed.data as Matrix).map((r) => r.map((c) => (c == null ? "" : String(c))));
  }
  if (hasPipe && sampleLimit > 0) {
    const parsed = Papa.parse<string[]>(cleanText, { delimiter: "|", skipEmptyLines: true });
    if (parsed.data.length)
      return (parsed.data as Matrix).map((r) => r.map((c) => (c == null ? "" : String(c))));
  }
  if (hasComma && sampleLimit > 0) {
    const parsed = Papa.parse<string[]>(cleanText, { delimiter: ",", skipEmptyLines: true });
    if (parsed.data.length)
      return (parsed.data as Matrix).map((r) => r.map((c) => (c == null ? "" : String(c))));
  }

  // Si détection incertaine ou lignes hétérogènes, détection automatique de PapaParse
  if (autoDetectIsMultiColumn(cleanText)) {
    const parsed = Papa.parse<string[]>(cleanText, { skipEmptyLines: true });
    return (parsed.data as Matrix).map((r) => r.map((c) => (c == null ? "" : String(c))));
  }

  // Pour un fichier à colonne unique (ex: 1M lignes de log/texte brut)
  return lines.map((l) => [l]);
}

/** Analyse un texte collé et retourne un échantillon interactif si le volume dépasse 50k lignes */
export function parsePastedDataset(
  text: string,
  maxInteractive = MAX_INTERACTIVE_ROWS,
  options?: ParseOptions,
): ParsedDataset {
  const { cleanText, lines: rawLines } = splitLines(text ?? "");
  const fullMatrix = text ? parseLines(cleanText, rawLines, options) : [];
  const totalLines = fullMatrix.length;
  const isSampled = totalLines > maxInteractive;
  const matrix = isSampled ? fullMatrix.slice(0, maxInteractive) : fullMatrix;

  // Échantillon brut non découpé (raw lines) pour bascule rapide sans délimiteur
  const rawLimit = isSampled ? Math.min(rawLines.length, maxInteractive) : rawLines.length;
  const rawLinesMatrix = rawLines.slice(0, rawLimit).map((l) => [l]);

  return {
    matrix,
    totalLines,
    isSampled,
    rawText: isSampled ? text : undefined,
    rawLinesMatrix,
    delimiterMode:
      options?.delimiterMode ?? (matrix[0]?.length > 1 ? "with_delimiter" : "without_delimiter"),
  };
}

/** Cellules seules au format tabulations (copie d'une plage). */
export function cellsToTsv(rows: Matrix): string {
  const cell = (v: string) => (/[\t\r\n"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
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
  options?: ParseOptions,
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
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      raw: false,
    });
    onProgress?.({ percent: 90, step: "Conversion de l'échantillon interactif..." });

    const rawRows = rows.map((r) => (r as unknown[]).map((c) => (c == null ? "" : String(c))));
    const rawLines = rawRows.map((r) => [r.join("\t")]);

    const isWithout = options?.delimiterMode === "without_delimiter";
    const full = isWithout ? rawLines : rawRows;
    const isSampled = full.length > maxInteractive;
    onProgress?.({ percent: 100, step: "Chargement terminé !" });
    return {
      matrix: isSampled ? full.slice(0, maxInteractive) : full,
      totalLines: full.length,
      isSampled,
      file: isSampled ? file : undefined,
      rawLinesMatrix: isSampled ? rawLines.slice(0, maxInteractive) : rawLines,
      delimiterMode: isWithout ? "without_delimiter" : "with_delimiter",
    };
  }

  // Lecture des fichiers texte (CSV, TSV, TXT, LOG)
  let text = "";
  if (typeof file.stream === "function") {
    onProgress?.({ percent: 5, step: `Lecture du fichier (${sizeMb} Mo)...` });
    const reader = file.stream().getReader();
    // fatal : un octet invalide en UTF-8 signale un fichier Windows-1252 / Latin-1
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let bytesRead = 0;
    const chunks: string[] = [];

    try {
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
    } catch (err) {
      if (!(err instanceof TypeError)) throw err;
      onProgress?.({ percent: 80, step: "Encodage Windows-1252 détecté, relecture..." });
      text = new TextDecoder("windows-1252").decode(await file.arrayBuffer());
    }
  } else {
    onProgress?.({ percent: 40, step: `Lecture du fichier (${sizeMb} Mo)...` });
    text = await file.text();
  }

  onProgress?.({ percent: 82, step: "Analyse de la structure et des délimiteurs..." });
  await new Promise((r) => setTimeout(r, 0));

  const clean = sanitizeInvisibleChars(text);
  const rawLines = clean.split(/\r?\n/);
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") rawLines.pop();
  const rawTotalLines = rawLines.length;
  const isSampledRaw = rawTotalLines > maxInteractive;
  const rawLinesSample: Matrix = (isSampledRaw ? rawLines.slice(0, maxInteractive) : rawLines).map(
    (l) => [l],
  );

  if (options?.delimiterMode === "without_delimiter") {
    onProgress?.({ percent: 100, step: "Chargement en texte brut (sans délimiteur)..." });
    return {
      matrix: rawLinesSample,
      totalLines: rawTotalLines,
      isSampled: isSampledRaw,
      file: isSampledRaw ? file : undefined,
      rawText: isSampledRaw ? text : undefined,
      rawLinesMatrix: rawLinesSample,
      delimiterMode: "without_delimiter",
    };
  }

  if (
    name.endsWith(".csv") ||
    name.endsWith(".tsv") ||
    options?.delimiterMode === "with_delimiter"
  ) {
    const firstChunk = text.slice(0, 4000);
    const hasDelimiter =
      options?.delimiter !== undefined ||
      firstChunk.includes(";") ||
      firstChunk.includes(",") ||
      firstChunk.includes("\t") ||
      firstChunk.includes("|");

    if (hasDelimiter) {
      onProgress?.({ percent: 88, step: "Découpage CSV structuré..." });
      // « ; » avant « , » : les montants français (1,5) ne doivent pas faire choisir la virgule
      const papaConfig: Papa.ParseConfig = {
        skipEmptyLines: true,
        delimitersToGuess: [";", "\t", "|", ","],
      };
      if (options?.delimiter && options.delimiter !== "auto") {
        papaConfig.delimiter = options.delimiter;
      }
      const parsed = Papa.parse<string[]>(text, papaConfig);
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
          rawText: isSampled ? text : undefined,
          rawLinesMatrix: rawLinesSample,
          delimiterMode: "with_delimiter",
        };
      }
    }
  }

  onProgress?.({ percent: 92, step: "Découpage des lignes..." });
  const parsed = parsePastedDataset(text, maxInteractive, options);
  onProgress?.({ percent: 100, step: "Chargement terminé !" });
  return {
    ...parsed,
    file: parsed.isSampled ? file : undefined,
    rawLinesMatrix: rawLinesSample,
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

/** Seuls les nombres (montants négatifs compris) peuvent commencer par « + » ou « - » sans risque. */
const NUMBER_RE = /^[-+]?[\d \u00a0\u202f]*\d([.,]\d+)?$/;

/**
 * Neutralise l'injection de formules dans un export CSV : une cellule commençant par
 * = + - @ (ou tabulation / retour chariot) serait exécutée par Excel à l'ouverture.
 */
export function neutralizeFormula(s: string): string {
  return /^[=+\-@\t\r]/.test(s) && !NUMBER_RE.test(s) ? `'${s}` : s;
}

/** Nombre maximal de lignes d'une feuille Excel (en-tête compris). */
export const XLSX_MAX_ROWS = 1_048_576;
const XLSX_MAX_CELL_LENGTH = 32_767;

export function exportCsv(header: string[], rows: Matrix, filename = "resultats.csv") {
  const safe = [header, ...rows].map((r) => r.map((c) => neutralizeFormula(c ?? "")));
  const csv = Papa.unparse(safe, { delimiter: ";" });
  download(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), filename);
}

export function exportXlsx(header: string[], rows: Matrix, filename = "resultats.xlsx") {
  if (rows.length + 1 > XLSX_MAX_ROWS) {
    // au-delà, SheetJS écrit silencieusement une feuille tronquée à 2 lignes
    throw new Error(
      `Excel est limité à ${XLSX_MAX_ROWS.toLocaleString("fr-FR")} lignes : utilisez l'export CSV.`,
    );
  }
  const clip = (c: string) =>
    c && c.length > XLSX_MAX_CELL_LENGTH ? c.slice(0, XLSX_MAX_CELL_LENGTH - 1) + "…" : c;
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows].map((r) => r.map(clip)));
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
  delimiterMode = "with_delimiter",
  sourceColIndex = 0,
  onProgress,
}: {
  file?: File | null;
  rawText?: string | null;
  totalLines: number;
  header: string[];
  columns: { name: string; rule: Rule | null }[];
  filename?: string;
  delimiterMode?: DelimiterMode;
  sourceColIndex?: number;
  onProgress?: (percent: number) => void;
}): Promise<void> {
  const sep = ";";
  const escapeCell = (raw: string): string => {
    const s = neutralizeFormula(raw);
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

  const sourceText = sanitizeInvisibleChars(rawText ?? (file ? await file.text() : ""));
  const lines = sourceText.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  const total = lines.length;
  let batchStr = "";
  const BATCH_SIZE = 25_000;

  for (let i = 0; i < total; i++) {
    const rawLine = lines[i]!;
    let src = rawLine;
    if (delimiterMode !== "without_delimiter") {
      const candDelims = [";", ",", "\t", "|"].filter((d) => rawLine.includes(d));
      if (candDelims.length > 0) {
        const delim = candDelims[0]!;
        const parts = rawLine.split(delim);
        if (parts.length > 1) {
          const colIdx = Math.min(Math.max(0, sourceColIndex ?? 0), parts.length - 1);
          src = parts[colIdx] ?? rawLine;
        }
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
