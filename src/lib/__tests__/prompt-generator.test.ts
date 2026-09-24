import { describe, it, expect } from "vitest";
import { generateExternalAIPrompt } from "../prompt-generator";

describe("generateExternalAIPrompt", () => {
  it("formats user examples and context rows correctly for an external AI", () => {
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
      sampleCount: 2,
      targetDialect: "Python (re)",
    });

    expect(prompt).toContain("Tu es un expert d'élite en Expressions Régulières");
    expect(prompt).toContain('colonne « Email »');
    expect(prompt).toContain('Exemple 1 (ligne 1) :');
    expect(prompt).toContain('- Ligne source : "user_123: john.doe@example.com (active)"');
    expect(prompt).toContain('- Valeur attendue : "john.doe@example.com"');
    expect(prompt).toContain('Exemple 2 (ligne 2) :');
    expect(prompt).toContain('- Valeur attendue : "alice.smith@corp.org"');
    expect(prompt).toContain('compatible Python (re)');
    expect(prompt).toContain('Autres lignes types issues du fichier');
    expect(prompt).toContain('user_789: bob.brown@univ.edu (inactive)');
    expect(prompt).toContain('exempt de ReDoS');
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
    expect(prompt).toContain("compatible JavaScript / TypeScript (RegExp)");
    expect(prompt).toContain("2026-09-24 [ERROR] failed connection");
  });

  it("avoids duplicate context rows when rows are already part of examples", () => {
    const rows = ["sample1", "sample2"];
    const userExamples = ["out1", "out2"];

    const prompt = generateExternalAIPrompt({
      colName: "Test",
      rows,
      userExamples,
      sampleCount: 5,
    });

    expect(prompt).toContain("Exemple 1 (ligne 1) :");
    expect(prompt).toContain("Exemple 2 (ligne 2) :");
    // No context rows left that aren't examples
    expect(prompt).not.toContain("Autres lignes types issues du fichier");
  });
});
