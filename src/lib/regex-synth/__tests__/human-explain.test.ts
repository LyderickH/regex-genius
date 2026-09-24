import { describe, expect, it } from "vitest";
import { explainRegexHuman, explainRegexTechnical, analyzeRegexFull } from "../human-explain";

describe("explainRegexHuman", () => {
  it("explains contextual prefix and suffix around brackets (audit log case)", () => {
    const text = explainRegexHuman({
      source: "at timestamp \\[\\[([^\\r\\n]+?)\\]\\] with context",
      flags: "g",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
    });
    expect(text).toContain("at timestamp [[");
    expect(text).toContain("]] with context");
  });

  it("explains chevron delimited text", () => {
    const text = explainRegexHuman({
      source: "<([^>]+)>",
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
      flags: "g",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
    });
    expect(text).toContain("utm_campaign=");
  });

  it("uses LLM explanation if available", () => {
    const text = explainRegexHuman({
      source: "foo",
      flags: "g",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
      llmMetadata: {
        modelName: "test",
        runtime: "webgpu",
        explanation: "Explication LLM spécifique personnalisée.",
        verified: true,
        securityRisk: "low",
        positivePassed: 1,
        positiveTotal: 1,
        negativePassed: 0,
        negativeTotal: 0,
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

  it("explains IPv4 address pattern without hardcoded column name", () => {
    const text = explainRegexHuman({
      source: "(\\d+\\.\\d+\\.\\d+\\.\\d+)",
      flags: "g",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
    });
    expect(text).toContain("adresse IP");
    expect(text).toContain("4 blocs de chiffres séparés par des points");
  });

  it("explains date and time patterns directly", () => {
    const dateText = explainRegexHuman({
      source: "(\\d{2}/\\d{2}/\\d{4})",
      flags: "g",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
    });
    expect(dateText).toContain("date au format JJ/MM/AAAA");

    const timeText = explainRegexHuman({
      source: "(\\d{2}:\\d{2})",
      flags: "g",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
    });
    expect(timeText).toContain("horaire (heures et minutes)");
  });
});

describe("explainRegexTechnical & analyzeRegexFull", () => {
  it("details technical steps and reasoning assumptions for delimited column patterns", () => {
    const tech = explainRegexTechnical(
      {
        source: "^(?:[^\\|]*\\|){8}\\s*([^\\|]+?)\\s*(?:\\||$)",
        flags: "m",
        transform: { strip: "trim", dec: "none", casing: "none", fmt: "none" },
      },
      "N° de pièce",
    );

    expect(tech.mechanism).toContain("Indexation de colonne");
    expect(tech.steps.length).toBeGreaterThanOrEqual(4);
    expect(tech.assumptions.length).toBeGreaterThanOrEqual(2);
    expect(tech.assumptions.some((a) => a.includes("9ᵉ colonne"))).toBe(true);
    expect(tech.assumptions.some((a) => a.includes("délimiteur"))).toBe(true);
  });

  it("details technical steps and prefix dependencies for contextual patterns", () => {
    const tech = explainRegexTechnical({
      source: "event_id=([^&]+)&status=",
      flags: "g",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
    });

    expect(tech.mechanism).toContain("Extraction contextuelle");
    expect(tech.steps.some((s) => s.token?.includes("event_id="))).toBe(true);
    expect(tech.steps.some((s) => s.token?.includes("([^&]+)"))).toBe(true);
    expect(tech.assumptions.some((a) => a.includes("event_id="))).toBe(true);
  });

  it("produces both technical breakdown and human explanation in analyzeRegexFull", () => {
    const full = analyzeRegexFull({
      source: "^([^,]+),\\s*(.+)$",
      flags: "",
      replacement: "$2 $1",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
    });

    expect(full.technical.mechanism).toContain("Substitution");
    expect(full.technical.steps.some((s) => s.label.includes("substitution"))).toBe(true);
    expect(full.human).toContain("Inverse l'ordre");
  });
});
