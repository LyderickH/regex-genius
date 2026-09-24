import { describe, it, expect } from "vitest";
import { generateExternalAIPrompt } from "../prompt-generator";

describe("generateExternalAIPrompt", () => {
  it("formats user examples and context rows correctly for an external AI with markdown table and JSON", () => {
    const rows = [
      "user_123: john.doe@example.com (active)",
      "user_456: alice.smith@corp.org (pending)",
      "user_789: bob.brown@univ.edu (inactive)",
      "user_999: no-email (unknown)",
    ];
    // userExamples array is (string | null)[] aligned with rows
    const userExamples = [
      "john.doe@example.com",
      "alice.smith@corp.org",
      null,
      null,
    ];

    const prompt = generateExternalAIPrompt({
      colName: "Email",
      rows,
      userExamples,
      sampleCount: 10,
      targetDialect: "Python (re)",
    });

    expect(prompt).toContain("DÉDUCTION D'EXPRESSION RÉGULIÈRE OPTIMISÉE");
    expect(prompt).toContain('colonne « Email »');
    expect(prompt).toContain('| 1 (l.1) | `user_123: john.doe@example.com (active)` | `john.doe@example.com` |');
    expect(prompt).toContain('| 2 (l.2) | `user_456: alice.smith@corp.org (pending)` | `alice.smith@corp.org` |');
    expect(prompt).toContain('```json');
    expect(prompt).toContain('"expected_output": "john.doe@example.com"');
    expect(prompt).toContain('ÉCHANTILLONS DE VALIDATION DU FICHIER');
    expect(prompt).toContain('[Ligne 3] user_789: bob.brown@univ.edu (inactive)');
    expect(prompt).toContain('Python (re)');
    expect(prompt).toContain('ReDoS');
  });

  it("handles case where no examples were provided yet", () => {
    const rows = ["2026-09-24 [ERROR] failed connection", "2026-09-25 [INFO] ok"];
    const prompt = generateExternalAIPrompt({
      colName: "Code",
      rows,
      userExamples: [null, null],
      targetDialect: "JavaScript / TypeScript (RegExp)",
    });

    expect(prompt).toContain("(Aucun exemple spécifique fourni pour le moment)");
    expect(prompt).toContain("JavaScript / TypeScript (RegExp)");
    expect(prompt).toContain("[Ligne 1] 2026-09-24 [ERROR] failed connection");
  });

  it("ensures all user examples are included without truncation", () => {
    // 5 examples
    const rows = ["r1", "r2", "r3", "r4", "r5", "r6"];
    const userExamples = ["v1", "v2", "v3", "v4", "v5", null];

    const prompt = generateExternalAIPrompt({
      colName: "AllExamples",
      rows,
      userExamples,
      sampleCount: 10,
    });

    expect(prompt).toContain("CHACUN de ces 5 exemple(s)");
    expect(prompt).toContain("| 1 (l.1) | `r1` | `v1` |");
    expect(prompt).toContain("| 5 (l.5) | `r5` | `v5` |");
    expect(prompt).toContain("[Ligne 6] r6");
  });

  it("customizes directives specifically for Excel 365, Alteryx, and KNIME", () => {
    const excelPrompt = generateExternalAIPrompt({
      colName: "ExcelCol",
      rows: ["A-100", "B-200"],
      userExamples: ["100", "200"],
      targetDialect: "Excel 365 (=REGEXEXTRACT)",
    });
    expect(excelPrompt).toContain("Spécificités Excel 365 / Tableur");
    expect(excelPrompt).toContain("REGEX.EXTRAIRE");
    expect(excelPrompt).toContain("REGEXEXTRACT");

    const alteryxPrompt = generateExternalAIPrompt({
      colName: "AlteryxCol",
      rows: ["A-100", "B-200"],
      userExamples: ["100", "200"],
      targetDialect: "Alteryx (Outil RegEx / Formula)",
    });
    expect(alteryxPrompt).toContain("Spécificités Alteryx");
    expect(alteryxPrompt).toContain("REGEX_Replace");

    const knimePrompt = generateExternalAIPrompt({
      colName: "KnimeCol",
      rows: ["A-100", "B-200"],
      userExamples: ["100", "200"],
      targetDialect: "KNIME (regexReplace / Regex Split)",
    });
    expect(knimePrompt).toContain("Spécificités KNIME Analytics Platform");
    expect(knimePrompt).toContain("regexReplace");
  });
});
