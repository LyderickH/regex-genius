export type CodeLocale = "fr" | "en";

export interface Dialect {
  id: string;
  label: string;
  /** rendu de l'expression seule */
  pattern: (source: string) => string;
  /** formule prête à coller (supporte français / anglais) */
  snippet: (source: string, field?: string, locale?: CodeLocale) => string;
  note?: string | ((locale?: CodeLocale) => string);
}

const dq = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const sq = (s: string) => s.replace(/'/g, "''");
const excelQ = (s: string) => s.replace(/"/g, '""');
/** chaîne brute (r"...") : seules les guillemets sont échappées */
const rawQ = (s: string) => s.replace(/"/g, '\\"');

export const DIALECTS: Dialect[] = [
  {
    id: "excel",
    label: "Excel 365",
    pattern: (s) => `"${excelQ(s)}"`,
    snippet: (s, _f, loc = "fr") =>
      loc === "fr"
        ? `=REGEX.EXTRAIRE(A2; "${excelQ(s)}"; 1)`
        : `=REGEXEXTRACT(A2, "${excelQ(s)}", 1)`,
    note: (loc = "fr") =>
      loc === "fr"
        ? "REGEX.EXTRAIRE est la formule officielle pour Excel 365 en français (séparateur point-virgule « ; »). Si votre Excel utilise les noms anglais, basculez sur l'onglet EN pour =REGEXEXTRACT."
        : "REGEXEXTRACT requires Excel 365 (comma delimiter ','). The 3rd argument '1' returns the 1st capture group.",
  },
  {
    id: "gsheets",
    label: "Google Sheets",
    pattern: (s) => `"${excelQ(s)}"`,
    snippet: (s, _f, loc = "fr") =>
      loc === "fr"
        ? `=REGEXEXTRACT(A2; "${excelQ(s)}")`
        : `=REGEXEXTRACT(A2, "${excelQ(s)}")`,
    note: (loc = "fr") =>
      loc === "fr"
        ? "Google Sheets avec paramètres régionaux français (séparateur point-virgule « ; »)."
        : "Google Sheets with US/UK regional settings (comma delimiter ',').",
  },
  {
    id: "alteryx",
    label: "Alteryx",
    pattern: (s) => `"${dq(s)}"`,
    snippet: (s, f, loc = "fr") => {
      const fieldName = f || (loc === "fr" ? "Champ" : "Field");
      return `REGEX_Replace([${fieldName}], ".*?${dq(s)}.*", "$1")`;
    },
    note: (loc = "fr") =>
      loc === "fr"
        ? "Formule pour l'outil Formula dans Alteryx, ou outil RegEx en mode Parse."
        : "Expression for Alteryx Formula tool, or RegEx tool in Parse mode.",
  },
  {
    id: "knime",
    label: "KNIME",
    pattern: (s) => `"${dq(s)}"`,
    snippet: (s, f, loc = "fr") => {
      const colName = f || (loc === "fr" ? "colonne" : "column");
      return `regexReplace($${colName}$, ".*?${dq(s)}.*", "$1")`;
    },
    note: (loc = "fr") =>
      loc === "fr"
        ? "Expression pour le nœud String Manipulation dans KNIME (ou nœud Regex Split)."
        : "Expression for KNIME String Manipulation node (or Regex Split node).",
  },
  {
    id: "powerquery",
    label: "Power Query (M)",
    pattern: (s) => `"${dq(s)}"`,
    snippet: (s, _f, loc = "fr") =>
      loc === "fr"
        ? `= Table.AddColumn(Source; "Extrait"; each let t = Text.From([Colonne1]) in Text.BetweenDelimiters(t; ""; "")) // motif : ${s}`
        : `= Table.AddColumn(Source, "Extracted", each let t = Text.From([Column1]) in Text.BetweenDelimiters(t, "", "")) // pattern: ${s}`,
    note: (loc = "fr") =>
      loc === "fr"
        ? "Power Query n'a pas de moteur regex natif ; utilisez Text.BetweenDelimiters ou une fonction R/Python."
        : "Power Query has no native regex engine; use Text.BetweenDelimiters or an R/Python step.",
  },
  {
    id: "python",
    label: "Python",
    pattern: (s) => `r"${rawQ(s)}"`,
    snippet: (s, f, loc = "fr") => {
      const varName = f || (loc === "fr" ? "texte" : "text");
      const outVar = loc === "fr" ? "valeur" : "value";
      return `import re\nm = re.search(r"${rawQ(s)}", ${varName})\n${outVar} = m.group(1) if m else None`;
    },
  },
  {
    id: "javascript",
    label: "JavaScript / TypeScript",
    pattern: (s) => `/${s}/`,
    snippet: (s, f, loc = "fr") => {
      const varName = f || (loc === "fr" ? "texte" : "text");
      const outVar = loc === "fr" ? "valeur" : "value";
      return `const m = ${varName}.match(/${s}/);\nconst ${outVar} = m ? m[1] : null;`;
    },
  },
  {
    id: "postgres",
    label: "SQL — PostgreSQL",
    pattern: (s) => `'${sq(s)}'`,
    snippet: (s, f, loc = "fr") => {
      const col = f || (loc === "fr" ? "ma_colonne" : "my_column");
      const alias = loc === "fr" ? "valeur" : "value";
      const table = loc === "fr" ? "ma_table" : "my_table";
      return `SELECT (regexp_match(${col}, '${sq(s)}'))[1] AS ${alias} FROM ${table};`;
    },
  },
  {
    id: "tsql",
    label: "SQL — T-SQL / Oracle",
    pattern: (s) => `'${sq(s)}'`,
    snippet: (s, f, loc = "fr") => {
      const col = f || (loc === "fr" ? "ma_colonne" : "my_column");
      const alias = loc === "fr" ? "valeur" : "value";
      const table = loc === "fr" ? "ma_table" : "my_table";
      return `SELECT REGEXP_SUBSTR(${col}, '${sq(s)}', 1, 1, 'c', 1) AS ${alias} FROM ${table};`;
    },
    note: (loc = "fr") =>
      loc === "fr" ? "REGEXP_SUBSTR : Oracle ou SQL Server 2025+." : "REGEXP_SUBSTR: Oracle, or SQL Server 2025+.",
  },
  {
    id: "dotnet",
    label: ".NET / C#",
    pattern: (s) => `@"${s.replace(/"/g, '""')}"`,
    snippet: (s, f, loc = "fr") => {
      const varName = f || (loc === "fr" ? "texte" : "text");
      const outVar = loc === "fr" ? "valeur" : "value";
      return `var m = Regex.Match(${varName}, @"${s.replace(/"/g, '""')}");\nvar ${outVar} = m.Success ? m.Groups[1].Value : null;`;
    },
  },
  {
    id: "pcre",
    label: "grep / PCRE",
    pattern: (s) => s,
    snippet: (s, _f, loc = "fr") =>
      loc === "fr" ? `grep -oP '${sq(s)}' fichier.txt` : `grep -oP '${sq(s)}' file.txt`,
  },
];
