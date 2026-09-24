import { describe, expect, it } from "vitest";
import { explainRegexHuman } from "../human-explain";

describe("explainRegexHuman", () => {
  it("explains contextual prefix and suffix around brackets (audit log case)", () => {
    const text = explainRegexHuman({
      source: "at timestamp \\[\\[([^\\r\\n]+?)\\]\\] with context",
      pattern: "at timestamp \\[\\[([^\\r\\n]+?)\\]\\] with context",
      flags: "g",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
    });
    expect(text).toContain("at timestamp [[");
    expect(text).toContain("]] with context");
  });

  it("explains chevron delimited text", () => {
    const text = explainRegexHuman({
      source: "<([^>]+)>",
      pattern: "<([^>]+)>",
      flags: "g",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
    });
    expect(text).toContain("<");
    expect(text).toContain(">");
  });

  it("explains delimited field structure (FEC)", () => {
    const text = explainRegexHuman(
      {
        source: "^(?:[^\\|]*\\|){8}\\s*([^\\|]+?)\\s*(?:\\||$)",
        pattern: "^(?:[^\\|]*\\|){8}\\s*([^\\|]+?)\\s*(?:\\||$)",
        flags: "m",
        transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
      },
      "N° de pièce",
    );
    expect(text).toContain("9ᵉ champ");
    expect(text).toContain("N° de pièce");
  });

  it("explains URL parameter", () => {
    const text = explainRegexHuman({
      source: "utm_campaign=([A-Za-z0-9/_-]+)",
      pattern: "utm_campaign=([A-Za-z0-9/_-]+)",
      flags: "g",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
    });
    expect(text).toContain("utm_campaign=");
  });

  it("uses LLM explanation if available", () => {
    const text = explainRegexHuman({
      source: "foo",
      pattern: "foo",
      flags: "g",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
      llmMetadata: {
        modelName: "test",
        runtime: "webgpu",
        promptTokens: 0,
        completionTokens: 0,
        generationTimeMs: 0,
        explanation: "Explication LLM spécifique personnalisée.",
        attemptsCount: 1,
      },
    });
    expect(text).toBe("Explication LLM spécifique personnalisée.");
  });

  it("explains replacement with inversion of two elements ($2 $1)", () => {
    const text = explainRegexHuman({
      source: "^([^,]+),\\s*(.+)$",
      flags: "",
      replacement: "$2 $1",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
    });
    expect(text).toContain("Inverse l'ordre des deux éléments");
    expect(text).toContain("$2 puis $1");
  });

  it("explains replacement with prefix addition (REF-$1)", () => {
    const text = explainRegexHuman({
      source: "^(.*)$",
      flags: "",
      replacement: "REF-$1",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
    });
    expect(text).toContain("Ajoute le préfixe « REF- »");
  });

  it("explains replacement with suffix addition ($1-SUF)", () => {
    const text = explainRegexHuman({
      source: "^(.*)$",
      flags: "",
      replacement: "$1-SUF",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
    });
    expect(text).toContain("Ajoute le suffixe « -SUF »");
  });

  it("explains replacement with date swap ($3/$2/$1)", () => {
    const text = explainRegexHuman({
      source: "^(\\d{4})[-/](\\d{2})[-/](\\d{2})$",
      flags: "",
      replacement: "$3/$2/$1",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
    });
    expect(text).toContain("Reformate la date");
    expect(text).toContain("inversant l'année et le jour");
  });

  it("explains replacement with combination of first and last ($1-$2)", () => {
    const text = explainRegexHuman({
      source: "^([A-Z]).*([0-9])$",
      flags: "",
      replacement: "$1-$2",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
    });
    expect(text).toContain("Conserve le début ($1) et la fin ($2)");
  });

  it("explains empty replacement as suppression", () => {
    const text = explainRegexHuman({
      source: "\\s+",
      flags: "g",
      replacement: "",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
    });
    expect(text).toContain("Supprime les occurrences");
  });

  it("appends transform explanation when transform is active", () => {
    const text = explainRegexHuman({
      source: "^([^,]+),\\s*(.+)$",
      flags: "",
      replacement: "$2 $1",
      transform: { strip: "trim", dec: "none", casing: "upper", fmt: "none" },
    });
    expect(text).toContain("Inverse l'ordre des deux éléments");
    expect(text).toContain("suppression des espaces de début et de fin");
    expect(text).toContain("mise en MAJUSCULES");
  });
});
