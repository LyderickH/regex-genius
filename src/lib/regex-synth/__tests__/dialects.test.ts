import { describe, it, expect } from "vitest";
import { DIALECTS } from "../dialects";

describe("DIALECTS - French & English modes", () => {
  it("fournit la formule Excel 365 en français (REGEX.EXTRAIRE avec point-virgule) et en anglais (REGEXEXTRACT avec virgule)", () => {
    const excel = DIALECTS.find((d) => d.id === "excel")!;
    expect(excel).toBeDefined();

    // Mode français avec groupe de capture -> return_mode = 2
    const frSnippet = excel.snippet("([A-Z0-9]+)", "texte", "fr");
    expect(frSnippet).toBe('=REGEX.EXTRAIRE(A2; "([A-Z0-9]+)"; 2)');
    expect(typeof excel.note === "function" ? excel.note("fr") : excel.note).toContain("REGEX.EXTRAIRE");

    // Mode anglais avec groupe de capture -> return_mode = 2
    const enSnippet = excel.snippet("([A-Z0-9]+)", "text", "en");
    expect(enSnippet).toBe('=REGEXEXTRACT(A2, "([A-Z0-9]+)", 2)');
    expect(typeof excel.note === "function" ? excel.note("en") : excel.note).toContain("REGEXEXTRACT");

    // Motif sans groupe de capture -> return_mode = 0
    expect(excel.snippet("[A-Z0-9]+", "texte", "fr")).toBe('=REGEX.EXTRAIRE(A2; "[A-Z0-9]+"; 0)');
  });

  it("gère Google Sheets avec séparateur point-virgule pour FR et virgule pour EN", () => {
    const gsheets = DIALECTS.find((d) => d.id === "gsheets")!;
    expect(gsheets).toBeDefined();

    const frSnippet = gsheets.snippet("([0-9]+)", "texte", "fr");
    expect(frSnippet).toBe('=REGEXEXTRACT(A2; "([0-9]+)")');

    const enSnippet = gsheets.snippet("([0-9]+)", "text", "en");
    expect(enSnippet).toBe('=REGEXEXTRACT(A2, "([0-9]+)")');
  });

  it("adapte les noms de variables et colonnes pour Alteryx et KNIME en FR et EN", () => {
    const alteryx = DIALECTS.find((d) => d.id === "alteryx")!;
    expect(alteryx.snippet("pat", undefined, "fr")).toContain("[Champ]");
    expect(alteryx.snippet("pat", undefined, "en")).toContain("[Field]");

    const knime = DIALECTS.find((d) => d.id === "knime")!;
    expect(knime.snippet("pat", undefined, "fr")).toContain("$colonne$");
    expect(knime.snippet("pat", undefined, "en")).toContain("$column$");
  });

  it("adapte Python et JavaScript en FR (valeur) et EN (value)", () => {
    const py = DIALECTS.find((d) => d.id === "python")!;
    expect(py.snippet("pat", undefined, "fr")).toContain("valeur =");
    expect(py.snippet("pat", undefined, "en")).toContain("value =");

    const js = DIALECTS.find((d) => d.id === "javascript")!;
    expect(js.snippet("pat", undefined, "fr")).toContain("valeur =");
    expect(js.snippet("pat", undefined, "en")).toContain("value =");
  });

  it("génère le contournement Web.Page pour Power Query M avec virgules", () => {
    const pq = DIALECTS.find((d) => d.id === "powerquery")!;
    expect(pq).toBeDefined();
    const snip = pq.snippet("([0-9]+)", "MaCol", "fr");
    expect(snip).toContain("Table.AddColumn(Source, \"Resultat\"");
    expect(snip).toContain("Web.Page(");
    expect(snip).toContain("[MaCol]");
    expect(snip).not.toContain("; each"); // M syntax uses commas
  });

  it("génère les formules de remplacement (REGEX.REMPLACER, REGEXREPLACE, re.sub, replace) quand replacement est fourni", () => {
    const excel = DIALECTS.find((d) => d.id === "excel")!;
    const frExcelRepl = excel.snippet("^([a-z]).*([a-z])$", "texte", "fr", "$1$2");
    expect(frExcelRepl).toBe('=REGEX.REMPLACER(A2; "^([a-z]).*([a-z])$"; "$1$2")');

    const enExcelRepl = excel.snippet("^([a-z]).*([a-z])$", "text", "en", "$1$2");
    expect(enExcelRepl).toBe('=REGEXREPLACE(A2, "^([a-z]).*([a-z])$", "$1$2")');

    const gsheets = DIALECTS.find((d) => d.id === "gsheets")!;
    const gsheetsRepl = gsheets.snippet("^([a-z]).*([a-z])$", "texte", "fr", "$1$2");
    expect(gsheetsRepl).toBe('=REGEXREPLACE(A2; "^([a-z]).*([a-z])$"; "$1$2")');

    const py = DIALECTS.find((d) => d.id === "python")!;
    const pyRepl = py.snippet("^([a-z]).*([a-z])$", "texte", "fr", "$1$2");
    expect(pyRepl).toContain("re.sub(");
    expect(pyRepl).toContain("\\\\g<1>\\\\g<2>");

    const js = DIALECTS.find((d) => d.id === "javascript")!;
    const jsRepl = js.snippet("^([a-z]).*([a-z])$", "texte", "fr", "$1$2");
    expect(jsRepl).toContain('.replace(/^([a-z]).*([a-z])$/g, "$1$2")');
  });

  it("génère les dialectes SQL spécialisés (Snowflake, BigQuery, PostgreSQL)", () => {
    const sf = DIALECTS.find((d) => d.id === "snowflake")!;
    expect(sf).toBeDefined();
    expect(sf.snippet("([0-9]+)", "col", "fr")).toContain("REGEXP_SUBSTR(col, '([0-9]+)', 1, 1, 'e', 1)");

    const bq = DIALECTS.find((d) => d.id === "bigquery")!;
    expect(bq).toBeDefined();
    expect(bq.snippet("([0-9]+)", "col", "fr")).toContain("REGEXP_EXTRACT(col, r'([0-9]+)')");
  });
});
