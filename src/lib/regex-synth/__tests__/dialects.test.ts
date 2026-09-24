import { describe, it, expect } from "vitest";
import { DIALECTS } from "../dialects";

describe("DIALECTS - French & English modes", () => {
  it("fournit la formule Excel 365 en français (REGEX.EXTRAIRE avec point-virgule) et en anglais (REGEXEXTRACT avec virgule)", () => {
    const excel = DIALECTS.find((d) => d.id === "excel")!;
    expect(excel).toBeDefined();

    // Mode français (par défaut)
    const frSnippet = excel.snippet("([A-Z0-9]+)", "texte", "fr");
    expect(frSnippet).toBe('=REGEX.EXTRAIRE(A2; "([A-Z0-9]+)"; 1)');
    expect(typeof excel.note === "function" ? excel.note("fr") : excel.note).toContain("REGEX.EXTRAIRE");

    // Mode anglais
    const enSnippet = excel.snippet("([A-Z0-9]+)", "text", "en");
    expect(enSnippet).toBe('=REGEXEXTRACT(A2, "([A-Z0-9]+)", 1)');
    expect(typeof excel.note === "function" ? excel.note("en") : excel.note).toContain("REGEXEXTRACT");
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
});
