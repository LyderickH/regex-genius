export interface Dialect {
  id: string;
  label: string;
  /** rendu de l'expression seule */
  pattern: (source: string) => string;
  /** formule prête à coller */
  snippet: (source: string, field: string) => string;
  note?: string;
}

const dq = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const sq = (s: string) => s.replace(/'/g, "''");
const excelQ = (s: string) => s.replace(/"/g, '""');

export const DIALECTS: Dialect[] = [
  {
    id: "javascript",
    label: "JavaScript",
    pattern: (s) => `/${s}/`,
    snippet: (s, f) => `const m = ${f}.match(/${s}/);\nconst value = m ? m[1] : null;`,
  },
  {
    id: "python",
    label: "Python",
    pattern: (s) => `r"${dq(s)}"`,
    snippet: (s, f) =>
      `import re\nm = re.search(r"${dq(s)}", ${f})\nvalue = m.group(1) if m else None`,
  },
  {
    id: "excel",
    label: "Excel 365",
    pattern: (s) => `"${excelQ(s)}"`,
    snippet: (s) => `=REGEXEXTRACT(A2;"${excelQ(s)}";1)`,
    note: "REGEXEXTRACT requiert Excel 365. Le 3e argument renvoie le groupe capturé.",
  },
  {
    id: "powerquery",
    label: "Power Query (M)",
    pattern: (s) => `"${dq(s)}"`,
    snippet: (s) =>
      `= Table.AddColumn(Source, "Extrait", each\n    let t = Text.From([Colonne1]) in\n    Text.BetweenDelimiters(t, "", "") // motif : ${s}\n  )`,
    note: "Power Query n'a pas de moteur regex natif ; utilisez Text.BetweenDelimiters ou une fonction R/Python.",
  },
  {
    id: "postgres",
    label: "SQL — PostgreSQL",
    pattern: (s) => `'${sq(s)}'`,
    snippet: (s, f) => `SELECT (regexp_match(${f}, '${sq(s)}'))[1] AS valeur FROM ma_table;`,
  },
  {
    id: "tsql",
    label: "SQL — T-SQL / Oracle",
    pattern: (s) => `'${sq(s)}'`,
    snippet: (s, f) => `SELECT REGEXP_SUBSTR(${f}, '${sq(s)}', 1, 1, 'c', 1) AS valeur FROM ma_table;`,
    note: "REGEXP_SUBSTR : Oracle, ou SQL Server 2025+.",
  },
  {
    id: "alteryx",
    label: "Alteryx",
    pattern: (s) => `"${dq(s)}"`,
    snippet: (s, f) => `REGEX_Replace([${f}], ".*?${dq(s)}.*", "$1")`,
    note: "Ou l'outil RegEx en mode Parse avec le même motif.",
  },
  {
    id: "knime",
    label: "KNIME",
    pattern: (s) => `"${dq(s)}"`,
    snippet: (s, f) => `regexReplace($${f}$, ".*?${dq(s)}.*", "$1")`,
  },
  {
    id: "dotnet",
    label: ".NET / C#",
    pattern: (s) => `@"${s.replace(/"/g, '""')}"`,
    snippet: (s, f) =>
      `var m = Regex.Match(${f}, @"${s.replace(/"/g, '""')}");\nvar value = m.Success ? m.Groups[1].Value : null;`,
  },
  {
    id: "pcre",
    label: "grep / PCRE",
    pattern: (s) => s,
    snippet: (s) => `grep -oP '${sq(s)}' fichier.txt`,
  },
];
