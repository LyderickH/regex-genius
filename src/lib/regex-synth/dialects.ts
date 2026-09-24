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
        ? `Pour Excel 2010/2013/2016/2019/2021 (sans fonction REGEX native) :
1. Faites Alt + F11 dans Excel, puis "Insertion > Module".
2. Collez la macro UDF ci-dessous.
⚠️ Limites du moteur VBScript.RegExp : pas de lookbehind (?<=...), pas de classes Unicode (\\p{L}), fonctionnalités limitées à ECMAScript 3.
Comportement de l'UDF : avec grp=1, extrait le premier groupe capturant (...), ou le match complet s'il n'y a pas de groupe de capture.

Function REGEX_EXTRAIRE(c As Range, pat As String, Optional grp As Integer = 1) As String
    Dim reg As Object, m As Object
    Set reg = CreateObject("VBScript.RegExp")
    reg.Global = False: reg.Pattern = pat
    If reg.Test(c.Value) Then
        Set m = reg.Execute(c.Value)
        If m(0).SubMatches.Count >= grp Then
            REGEX_EXTRAIRE = m(0).SubMatches(grp - 1)
        Else
            REGEX_EXTRAIRE = m(0).Value
        End If
    End If
End Function

Function REGEX_REMPLACER(c As Range, pat As String, repl As String) As String
    Dim reg As Object
    Set reg = CreateObject("VBScript.RegExp")
    reg.Global = True: reg.Pattern = pat
    REGEX_REMPLACER = reg.Replace(c.Value, repl)
End Function`
        : `For older Excel versions (2010-2021 without native REGEX):
Press Alt + F11, "Insert > Module", and paste the VBA UDF.
Note: VBScript.RegExp engine lacks lookbehind (?<=...) and Unicode categories (\\p{L}). Returns capture group if defined, else full match.`,
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
        ? "Google Sheets utilise le moteur RE2 (séparateur point-virgule « ; » en français). Attention : RE2 ne supporte pas les lookarounds (?<=...) ni le backtracking. REGEXEXTRACT n'a pas d'argument d'index de groupe : s'il y a un groupe capturant, il est renvoyé ; s'il y en a plusieurs, ils se déversent (spill) automatiquement sur les colonnes adjacentes."
        : "Google Sheets uses the RE2 engine (comma delimiter ','). Note: RE2 does not support lookarounds or backtracking. REGEXEXTRACT does not have a group index argument: multiple capture groups automatically spill into adjacent columns.";
    },
  },
  {
    id: "powerquery",
    label: "Power Query (M)",
    pattern: (s) => `"${dq(s)}"`,
    snippet: (s, f, loc = "fr", replacement) => {
      const col = f || (loc === "fr" ? "Colonne1" : "Column1");
      const outCol = loc === "fr" ? "Resultat" : "Result";
      if (replacement !== undefined) {
        return `// Recommandé en Power Query M (sans regex native) :
// Utilisez l'interface 'Colonne à partir d'exemples' ou Text.Replace :
= Table.AddColumn(Source, "${outCol}", each Text.Replace([${col}], "ancien", "nouveau"))

// Optionnel / Hack hérité (Excel Windows uniquement, basé sur Web.Page / Trident) :
// = Table.AddColumn(Source, "${outCol}", each Web.Page("<script>var s = Text.From([${col}]).replace(new RegExp('" & "${dq(s)}" & "', 'g'), '" & "${dq(replacement)}" & "'); document.write(s);</script>")[Data]{0}[Children]{0}[Children]{1}[Text]{0})`;
      }
      return `// Recommandé en Power Query M (sans regex native) :
// Utilisez 'Colonne à partir d'exemples' ou les fonctions natives selon vos délimiteurs :
= Table.AddColumn(Source, "${outCol}", each Text.BetweenDelimiters([${col}], "debut", "fin"))
// Exemples : Text.Select([${col}], {"0".."9"}) pour les chiffres, Text.BeforeDelimiter, Text.AfterDelimiter

// Optionnel / Hack hérité (Excel Windows Desktop uniquement via Web.Page / JS) :
// = Table.AddColumn(Source, "${outCol}", each Web.Page("<script>var m = new RegExp('" & "${dq(s)}" & "').exec('" & Text.From([${col}]) & "'); document.write(m ? m[1] || m[0] : '');</script>")[Data]{0}[Children]{0}[Children]{1}[Text]{0})`;
    },
    note: (loc = "fr") =>
      loc === "fr"
        ? "Power Query (M) ne possède AUCUN moteur Regex natif. Le moyen le plus fiable est d'utiliser la fonctionnalité native 'Colonne à partir d'exemples' directement dans l'éditeur Power Query, ou des fonctions texte comme Text.BetweenDelimiters / Text.Select. La fonction Web.Page (JavaScript) est un hack historique dépendant d'Internet Explorer (mshtml), non supporté sur Mac, Linux ou le service Power BI cloud."
        : "Power Query (M) has NO native regex engine. Use the 'Column From Examples' UI feature in Power Query, or native M functions like Text.BetweenDelimiters / Text.Select. The Web.Page hack relies on legacy IE/mshtml and does not work on Mac, Linux, or Power BI Service in the cloud.",
  },
  {
    id: "python",
    label: "Python",
    pattern: (s) => `r"${rawQ(s)}"`,
    snippet: (s, f, loc = "fr", replacement) => {
      const varName = f || (loc === "fr" ? "texte" : "text");
      const outVar = loc === "fr" ? "valeur" : "value";
      if (replacement !== undefined) {
        // En Python re.sub, la syntaxe recommandée et non ambiguë pour les groupes est \g<1>
        const pyRepl = replacement.replace(/\$(\d+)/g, "\\\\g<$1>");
        return `import re\n${outVar} = re.sub(r"${rawQ(s)}", r"${rawQ(pyRepl)}", ${varName})`;
      }
      return `import re\nm = re.search(r"${rawQ(s)}", ${varName})\n${outVar} = m.group(1) if (m and m.lastindex) else (m.group(0) if m else None)`;
    },
    note: (loc = "fr") =>
      loc === "fr"
        ? "En Python re.sub, la syntaxe officielle et non ambiguë pour référencer les groupes de capture est \\g<1>, \\g<2> (ou \\1, \\2). La syntaxe $1 n'est pas supportée par Python."
        : "In Python re.sub, use \\g<1>, \\g<2> (or \\1, \\2) for capture group backreferences ($1 is JavaScript/C# syntax).",
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
      return `const m = ${varName}.match(/${s}/);\nconst ${outVar} = m ? (m[1] ?? m[0]) : null;`;
    },
    note: (loc = "fr") =>
      loc === "fr"
        ? "En JS, match() sans le drapeau 'g' renvoie le match complet en [0] et les groupes capturants en [1], [2]... Avec le drapeau 'g', match() ne renvoie que les correspondances complètes sans les groupes (utilisez matchAll() pour capturer les groupes en boucle)."
        : "In JS, match() without 'g' returns full match in [0] and capture groups in [1], [2]... With 'g', match() only returns full matches (use matchAll() to iterate capture groups).",
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
    note: (loc = "fr") =>
      loc === "fr"
        ? "PostgreSQL utilise les expressions régulières POSIX ERE. regexp_match() renvoie un tableau text[] des groupes capturants (indexé à 1). Pour le remplacement, les références de groupe s'écrivent \\1, \\2."
        : "PostgreSQL uses POSIX ERE regular expressions. regexp_match() returns a text[] array of captured groups (1-indexed). In regexp_replace, backreferences are \\1, \\2.",
  },
  {
    id: "snowflake",
    label: "SQL — Snowflake",
    pattern: (s) => `'${sq(s)}'`,
    snippet: (s, f, loc = "fr", replacement) => {
      const col = f || (loc === "fr" ? "ma_colonne" : "my_column");
      const alias = loc === "fr" ? "valeur" : "value";
      const table = loc === "fr" ? "ma_table" : "my_table";
      if (replacement !== undefined) {
        const sfRepl = replacement.replace(/\$(\d+)/g, "\\\\$1");
        return `SELECT REGEXP_REPLACE(${col}, '${sq(s)}', '${sq(sfRepl)}') AS ${alias} FROM ${table};`;
      }
      // Paramètre 'e' = extract group (spécifique à Snowflake)
      return `SELECT REGEXP_SUBSTR(${col}, '${sq(s)}', 1, 1, 'e', 1) AS ${alias} FROM ${table};`;
    },
    note: (loc = "fr") =>
      loc === "fr"
        ? "Dans Snowflake, le paramètre 'e' de REGEXP_SUBSTR spécifie l'extraction d'un groupe de capture particulier (le 6e argument indique le numéro du groupe)."
        : "In Snowflake, the 'e' parameter in REGEXP_SUBSTR specifies extracting a capture group (the 6th argument is the group index).",
  },
  {
    id: "bigquery",
    label: "SQL — Google BigQuery",
    pattern: (s) => `r'${sq(s)}'`,
    snippet: (s, f, loc = "fr", replacement) => {
      const col = f || (loc === "fr" ? "ma_colonne" : "my_column");
      const alias = loc === "fr" ? "valeur" : "value";
      const table = loc === "fr" ? "ma_table" : "my_table";
      if (replacement !== undefined) {
        const bqRepl = replacement.replace(/\$(\d+)/g, "\\\\$1");
        return `SELECT REGEXP_REPLACE(${col}, r'${sq(s)}', r'${sq(bqRepl)}') AS ${alias} FROM ${table};`;
      }
      return `SELECT REGEXP_EXTRACT(${col}, r'${sq(s)}') AS ${alias} FROM ${table};`;
    },
    note: (loc = "fr") =>
      loc === "fr"
        ? "BigQuery utilise le moteur Google RE2. REGEXP_EXTRACT extrait le premier groupe de capture (...) s'il est présent, sinon l'intégralité du motif. Préfixez les chaînes avec r'' pour éviter les doubles échappements."
        : "BigQuery uses Google RE2. REGEXP_EXTRACT extracts the first capture group (...) if present, otherwise the full match. Use raw string literals r'' to avoid double backslash escaping.",
  },
  {
    id: "tsql",
    label: "SQL — Oracle / SQL Server 2025+",
    pattern: (s) => `'${sq(s)}'`,
    snippet: (s, f, loc = "fr", replacement) => {
      const col = f || (loc === "fr" ? "ma_colonne" : "my_column");
      const alias = loc === "fr" ? "valeur" : "value";
      const table = loc === "fr" ? "ma_table" : "my_table";
      if (replacement !== undefined) {
        const oraRepl = replacement.replace(/\$(\d+)/g, "\\$1");
        return `SELECT REGEXP_REPLACE(${col}, '${sq(s)}', '${sq(oraRepl)}') AS ${alias} FROM ${table};`;
      }
      // 6e argument = subexpression group (Oracle 11gR2+, SQL Server 2025+)
      return `SELECT REGEXP_SUBSTR(${col}, '${sq(s)}', 1, 1, 'c', 1) AS ${alias} FROM ${table};`;
    },
    note: (loc = "fr") =>
      loc === "fr"
        ? "Oracle (depuis 11gR2) et SQL Server 2025+ supportent le 6e argument 'subexpression' de REGEXP_SUBSTR pour cibler un groupe capturant précis (le paramètre 'c' active la sensibilité à la casse)."
        : "Oracle (11gR2+) and SQL Server 2025+ support the 6th 'subexpression' argument in REGEXP_SUBSTR to target a specific capture group ('c' enables case-sensitivity).",
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
      return `var m = Regex.Match(${varName}, @"${s.replace(/"/g, '""')}");\nvar ${outVar} = m.Success ? (m.Groups.Count > 1 ? m.Groups[1].Value : m.Value) : null;`;
    },
    note: (loc = "fr") =>
      loc === "fr"
        ? "En C#, @\"...\" représente une chaîne verbatim. Dans Regex.Replace, les références de groupes capturants s'écrivent $1, $2."
        : "In C#, @\"...\" is a verbatim string. In Regex.Replace, capture groups are referenced as $1, $2.",
  },
  {
    id: "alteryx",
    label: "Alteryx",
    pattern: (s) => `"${dq(s)}"`,
    snippet: (s, f, loc = "fr", replacement) => {
      const fieldName = f || (loc === "fr" ? "Champ" : "Field");
      if (replacement !== undefined) {
        return `// Outil Formula (Remplacement) :\nREGEX_Replace([${fieldName}], "${dq(s)}", "${dq(replacement)}")`;
      }
      return `// Recommandé dans Alteryx : Utilisez l'outil 'RegEx' en mode 'Parse'.\n// Le mode Parse extrait chaque groupe (...) directement dans une nouvelle colonne dédiée.\n// Formule alternative (outil Formula, nécessite un motif capturant englobé) :\nREGEX_Replace([${fieldName}], "^.*?${dq(s)}.*$", "$1")`;
    },
    note: (loc = "fr") =>
      loc === "fr"
        ? "Dans Alteryx, la méthode recommandée pour extraire des données est d'utiliser le 'RegEx Tool' configuré en méthode de sortie 'Parse' : chaque groupe entre parenthèses (...) génère automatiquement un nouveau champ. Pour l'outil Formula, REGEX_Replace nécessite d'englober toute la ligne avec ^.*? et .*$ pour ne renvoyer que $1."
        : "In Alteryx, the recommended method for extraction is the 'RegEx' tool in 'Parse' mode, which automatically creates output columns for each capture group (...). In the Formula tool, REGEX_Replace requires wrapping the pattern with ^.*? and .*$ to return $1.",
  },
  {
    id: "knime",
    label: "KNIME Analytics Platform",
    pattern: (s) => `"${dq(s)}"`,
    snippet: (s, f, loc = "fr", replacement) => {
      const colName = f || (loc === "fr" ? "colonne" : "column");
      if (replacement !== undefined) {
        return `// Nœud String Manipulation (Remplacement) :\nregexReplace($${colName}$, "${dq(s)}", "${dq(replacement)}")`;
      }
      return `// Recommandé dans KNIME pour l'extraction : Nœud 'Regex Split'\n// Configurez le nœud Regex Split avec le motif complet : chaque groupe (...) crée une colonne 'split_0', 'split_1'...\n// Alternative dans le nœud String Manipulation :\nregexReplace($${colName}$, "^.*?${dq(s)}.*$", "$1")`;
    },
    note: (loc = "fr") =>
      loc === "fr"
        ? "Dans KNIME, distinguez : (1) Le nœud 'Regex Split' qui extrait chaque groupe capturant (...) dans de nouvelles colonnes ; (2) Le nœud 'String Manipulation' qui permet les remplacements via regexReplace()."
        : "In KNIME, distinguish: (1) 'Regex Split' node to extract capture groups (...) into separate columns; (2) 'String Manipulation' node for substitutions using regexReplace().",
  },
  {
    id: "pcre",
    label: "GNU grep & sed (Linux / Bash)",
    pattern: (s) => s,
    snippet: (s, _f, loc = "fr", replacement) => {
      if (replacement !== undefined) {
        const file = loc === "fr" ? "fichier.txt" : "file.txt";
        return `sed -E 's/${sq(s)}/${sq(replacement.replace(/\$(\d+)/g, "\\$1"))}/g' ${file}`;
      }
      return loc === "fr"
        ? `# GNU grep avec extension PCRE (Linux / Git Bash) :\ngrep -oP '${sq(s)}' fichier.txt\n\n# Alternative universelle (macOS / BSD / Linux sans GNU grep) :\nperl -nle 'print $1 if /${sq(s)}/' fichier.txt`
        : `# GNU grep with PCRE (Linux / Git Bash):\ngrep -oP '${sq(s)}' file.txt\n\n# Portable alternative (macOS / BSD / Linux without GNU grep):\nperl -nle 'print $1 if /${sq(s)}/' file.txt`;
    },
    note: (loc = "fr") =>
      loc === "fr"
        ? "Attention : 'grep -oP' requiert GNU grep avec support PCRE. Il n'est pas disponible sur le grep BSD natif de macOS (utilisez 'pcregrep' ou la commande 'perl' fournie en alternative). 'sed -E' active les expressions régulières étendues (ERE)."
        : "Note: 'grep -oP' requires GNU grep with PCRE support and is not available on native macOS BSD grep (use 'pcregrep' or the portable 'perl' command provided). 'sed -E' enables Extended Regular Expressions (ERE).",
  },
];
