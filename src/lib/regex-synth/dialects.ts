export type CodeLocale = "fr" | "en";

export interface Dialect {
  id: string;
  label: string;
  /** rendu de l'expression seule */
  pattern: (source: string) => string;
  /** formule prête à coller (supporte français / anglais et remplacement) */
  snippet: (source: string, field?: string, locale?: CodeLocale, replacement?: string) => string;
  note?: string | ((locale?: CodeLocale, replacement?: string) => string);
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
    snippet: (s, _f, loc = "fr", replacement) => {
      if (replacement !== undefined) {
        return loc === "fr"
          ? `=REGEX.REMPLACER(A2; "${excelQ(s)}"; "${excelQ(replacement)}")`
          : `=REGEXREPLACE(A2, "${excelQ(s)}", "${excelQ(replacement)}")`;
      }
      // Si la regex contient un groupe de capture (...), le mode 2 d'Excel extrait ce qui est dans les parenthèses.
      // Sans groupe de capture, le mode 0 (défaut) extrait la correspondance complète.
      const hasCapture = /(?<!\\)\((?!\?)/.test(s);
      const mode = hasCapture ? "2" : "0";
      return loc === "fr"
        ? `=REGEX.EXTRAIRE(A2; "${excelQ(s)}"; ${mode})`
        : `=REGEXEXTRACT(A2, "${excelQ(s)}", ${mode})`;
    },
    note: (loc = "fr", replacement) => {
      if (replacement !== undefined) {
        return loc === "fr"
          ? "REGEX.REMPLACER est la formule officielle pour Excel 365 en français (séparateur point-virgule « ; ») pour la substitution/composition. Si votre Excel utilise les noms anglais, basculez sur l'onglet EN pour =REGEXREPLACE."
          : "REGEXREPLACE requires Excel 365 (comma delimiter ',') for replacement patterns.";
      }
      return loc === "fr"
        ? "REGEX.EXTRAIRE dans Excel 365 (séparateur point-virgule « ; »). Le 3e argument est le mode de retour : 0 = première correspondance complète, 1 = toutes les correspondances, 2 = extrait le contenu des groupes de capture (...)."
        : "REGEXEXTRACT in Excel 365 (comma delimiter ','). The 3rd argument is return_mode: 0 = first full match, 1 = all matches, 2 = extract capture groups (...).";
    },
  },
  {
    id: "excel-vba",
    label: "Excel 2010 - 2021 (Sans REGEX.EXTRAIRE / VBA)",
    pattern: (s) => `"${excelQ(s)}"`,
    snippet: (s, _f, loc = "fr", replacement) => {
      if (replacement !== undefined) {
        return loc === "fr"
          ? `=REGEX_REMPLACER(A2; "${excelQ(s)}"; "${excelQ(replacement)}")`
          : `=REGEX_REPLACE(A2, "${excelQ(s)}", "${excelQ(replacement)}")`;
      }
      return loc === "fr"
        ? `=REGEX_EXTRAIRE(A2; "${excelQ(s)}"; 1)`
        : `=REGEX_EXTRACT(A2, "${excelQ(s)}", 1)`;
    },
    note: (loc = "fr") =>
      loc === "fr"
        ? `Pour Excel 2016/2019/2021 (qui n'ont pas encore les fonctions REGEX natives d'Office 365) :
1. Faites Alt + F11 dans Excel, puis "Insertion > Module".
2. Collez la macro UDF universelle :

Function REGEX_EXTRAIRE(c As Range, pat As String, Optional grp As Integer = 1) As String
    Dim reg As Object, m As Object
    Set reg = CreateObject("VBScript.RegExp")
    reg.Global = False: reg.Pattern = pat
    If reg.Test(c.Value) Then
        Set m = reg.Execute(c.Value)
        If m(0).SubMatches.Count >= grp Then REGEX_EXTRAIRE = m(0).SubMatches(grp - 1) Else REGEX_EXTRAIRE = m(0).Value
    End If
End Function

Function REGEX_REMPLACER(c As Range, pat As String, repl As String) As String
    Dim reg As Object
    Set reg = CreateObject("VBScript.RegExp")
    reg.Global = True: reg.Pattern = pat
    REGEX_REMPLACER = reg.Replace(c.Value, repl)
End Function`
        : `For older Excel versions (2016/2019/2021):
Press Alt + F11, click "Insert > Module", and paste the VBA UDF functions REGEX_EXTRACT and REGEX_REPLACE.`,
  },
  {
    id: "gsheets",
    label: "Google Sheets",
    pattern: (s) => `"${excelQ(s)}"`,
    snippet: (s, _f, loc = "fr", replacement) => {
      if (replacement !== undefined) {
        return loc === "fr"
          ? `=REGEXREPLACE(A2; "${excelQ(s)}"; "${excelQ(replacement)}")`
          : `=REGEXREPLACE(A2, "${excelQ(s)}", "${excelQ(replacement)}")`;
      }
      return loc === "fr"
        ? `=REGEXEXTRACT(A2; "${excelQ(s)}")`
        : `=REGEXEXTRACT(A2, "${excelQ(s)}")`;
    },
    note: (loc = "fr", replacement) => {
      if (replacement !== undefined) {
        return loc === "fr"
          ? "REGEXREPLACE dans Google Sheets remplace les correspondances selon le modèle (ex: $1$2)."
          : "REGEXREPLACE in Google Sheets performs regex substitutions with capture group backreferences.";
      }
      return loc === "fr"
        ? "Google Sheets avec paramètres régionaux français (séparateur point-virgule « ; »)."
        : "Google Sheets with US/UK regional settings (comma delimiter ',').";
    },
  },
  {
    id: "alteryx",
    label: "Alteryx",
    pattern: (s) => `"${dq(s)}"`,
    snippet: (s, f, loc = "fr", replacement) => {
      const fieldName = f || (loc === "fr" ? "Champ" : "Field");
      if (replacement !== undefined) {
        return `REGEX_Replace([${fieldName}], "${dq(s)}", "${dq(replacement)}")`;
      }
      return `REGEX_Replace([${fieldName}], ".*?${dq(s)}.*", "$1")`;
    },
    note: (loc = "fr") =>
      loc === "fr"
        ? "Formule pour l'outil Formula dans Alteryx, ou outil RegEx en mode Parse / Replace."
        : "Expression for Alteryx Formula tool, or RegEx tool in Parse / Replace mode.",
  },
  {
    id: "knime",
    label: "KNIME",
    pattern: (s) => `"${dq(s)}"`,
    snippet: (s, f, loc = "fr", replacement) => {
      const colName = f || (loc === "fr" ? "colonne" : "column");
      if (replacement !== undefined) {
        return `regexReplace($${colName}$, "${dq(s)}", "${dq(replacement)}")`;
      }
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
    snippet: (s, f, loc = "fr", replacement) => {
      const col = f || (loc === "fr" ? "Colonne1" : "Column1");
      const outCol = loc === "fr" ? "Resultat" : "Result";
      if (replacement !== undefined) {
        return `= Table.AddColumn(Source, "${outCol}", each Web.Page("<script>var s = Text.From([${col}]).replace(new RegExp('" & "${dq(s)}" & "', 'g'), '" & "${dq(replacement)}" & "'); document.write(s);</script>")[Data]{0}[Children]{0}[Children]{1}[Text]{0})`;
      }
      return `= Table.AddColumn(Source, "${outCol}", each Web.Page("<script>var m = new RegExp('" & "${dq(s)}" & "').exec('" & Text.From([${col}]) & "'); document.write(m ? m[1] || m[0] : '');</script>")[Data]{0}[Children]{0}[Children]{1}[Text]{0})`;
    },
    note: (loc = "fr") =>
      loc === "fr"
        ? "Power Query (M) n'a aucune fonction Regex native (le langage M n'est pas traduit et utilise toujours des virgules « , »). Ce snippet utilise le contournement standard Web.Page (JavaScript) pour Excel Desktop. Sur Power BI Desktop / Service, utilisez une étape Python.Execute ou des fonctions natives (Text.BetweenDelimiters, Text.Select)."
        : "Power Query (M) has no native Regex engine (M syntax always uses commas ','). This snippet uses the standard Web.Page (JavaScript) hack for Excel Desktop. On Power BI, use Python.Execute or native M functions (Text.BetweenDelimiters, Text.Select).",
  },
  {
    id: "python",
    label: "Python",
    pattern: (s) => `r"${rawQ(s)}"`,
    snippet: (s, f, loc = "fr", replacement) => {
      const varName = f || (loc === "fr" ? "texte" : "text");
      const outVar = loc === "fr" ? "valeur" : "value";
      if (replacement !== undefined) {
        const pyRepl = replacement.replace(/\$(\d+)/g, "\\\\$1");
        return `import re\n${outVar} = re.sub(r"${rawQ(s)}", r"${rawQ(pyRepl)}", ${varName})`;
      }
      return `import re\nm = re.search(r"${rawQ(s)}", ${varName})\n${outVar} = m.group(1) if m else None`;
    },
  },
  {
    id: "javascript",
    label: "JavaScript / TypeScript",
    pattern: (s) => `/${s}/`,
    snippet: (s, f, loc = "fr", replacement) => {
      const varName = f || (loc === "fr" ? "texte" : "text");
      const outVar = loc === "fr" ? "valeur" : "value";
      if (replacement !== undefined) {
        return `const ${outVar} = ${varName}.replace(/${s}/g, "${dq(replacement)}");`;
      }
      return `const m = ${varName}.match(/${s}/);\nconst ${outVar} = m ? m[1] : null;`;
    },
  },
  {
    id: "postgres",
    label: "SQL — PostgreSQL",
    pattern: (s) => `'${sq(s)}'`,
    snippet: (s, f, loc = "fr", replacement) => {
      const col = f || (loc === "fr" ? "ma_colonne" : "my_column");
      const alias = loc === "fr" ? "valeur" : "value";
      const table = loc === "fr" ? "ma_table" : "my_table";
      if (replacement !== undefined) {
        const pgRepl = replacement.replace(/\$(\d+)/g, "\\$1");
        return `SELECT regexp_replace(${col}, '${sq(s)}', '${sq(pgRepl)}', 'g') AS ${alias} FROM ${table};`;
      }
      return `SELECT (regexp_match(${col}, '${sq(s)}'))[1] AS ${alias} FROM ${table};`;
    },
  },
  {
    id: "tsql",
    label: "SQL — T-SQL / Oracle",
    pattern: (s) => `'${sq(s)}'`,
    snippet: (s, f, loc = "fr", replacement) => {
      const col = f || (loc === "fr" ? "ma_colonne" : "my_column");
      const alias = loc === "fr" ? "valeur" : "value";
      const table = loc === "fr" ? "ma_table" : "my_table";
      if (replacement !== undefined) {
        const oraRepl = replacement.replace(/\$(\d+)/g, "\\$1");
        return `SELECT REGEXP_REPLACE(${col}, '${sq(s)}', '${sq(oraRepl)}') AS ${alias} FROM ${table};`;
      }
      return `SELECT REGEXP_SUBSTR(${col}, '${sq(s)}', 1, 1, 'c', 1) AS ${alias} FROM ${table};`;
    },
    note: (loc = "fr") =>
      loc === "fr" ? "REGEXP_SUBSTR / REGEXP_REPLACE : Oracle ou SQL Server 2025+." : "REGEXP_SUBSTR / REGEXP_REPLACE: Oracle, or SQL Server 2025+.",
  },
  {
    id: "dotnet",
    label: ".NET / C#",
    pattern: (s) => `@"${s.replace(/"/g, '""')}"`,
    snippet: (s, f, loc = "fr", replacement) => {
      const varName = f || (loc === "fr" ? "texte" : "text");
      const outVar = loc === "fr" ? "valeur" : "value";
      if (replacement !== undefined) {
        return `var ${outVar} = Regex.Replace(${varName}, @"${s.replace(/"/g, '""')}", "${replacement.replace(/"/g, '""')}");`;
      }
      return `var m = Regex.Match(${varName}, @"${s.replace(/"/g, '""')}");\nvar ${outVar} = m.Success ? m.Groups[1].Value : null;`;
    },
  },
  {
    id: "pcre",
    label: "grep / PCRE",
    pattern: (s) => s,
    snippet: (s, _f, loc = "fr", replacement) => {
      if (replacement !== undefined) {
        const file = loc === "fr" ? "fichier.txt" : "file.txt";
        return `sed -E 's/${sq(s)}/${sq(replacement.replace(/\$(\d+)/g, "\\$1"))}/g' ${file}`;
      }
      return loc === "fr" ? `grep -oP '${sq(s)}' fichier.txt` : `grep -oP '${sq(s)}' file.txt`;
    },
  },
];
