import { describe, it, expect } from "vitest";
import { validateCandidate, extractMatch } from "../validator";
import { analyzeSecurity } from "../security";
import { parseCandidateJSON, buildCorrectionPrompt } from "../prompts";
import type { ExamplePair, NegativeExample, RegexCandidate } from "../types";
import { synthesize } from "../../regex-synth/engine";

describe("Preservation du moteur algorithmique existant", () => {
  it("conserve la deduction algorithmique instantanee sur les exemples standards", () => {
    const inputs = [
      "VE | Ventes | VT0001 | 20240131 | 1 250,00 | EUR",
      "AC | Achats | AC0087 | 20240205 | 980,50 | EUR",
      "BQ | Banque | BQ0142 | 20240229 | 3 410,90 | EUR",
    ];
    const expected = ["1 250,00", "980,50", null];

    const result = synthesize(inputs, expected);
    expect(result.rule).not.toBeNull();
    expect(result.rule?.origin).toBe("algorithmic");
    expect(result.values[0]).toBe("1 250,00");
    expect(result.values[1]).toBe("980,50");
  });
});

describe("Validation algorithmique independante (Le LLM propose, les algorithmes verifient)", () => {
  const positives: ExamplePair[] = [
    { input: "INV-2024-001 [FR]", expected: "2024-001" },
    { input: "INV-2025-042 [US]", expected: "2025-042" },
  ];

  const negatives: NegativeExample[] = [
    { input: "REF-2024-999" },
    { input: "ORDER-ABC" },
  ];

  it("valide avec succes une regex candidate correcte avec groupe de capture", () => {
    const candidate: RegexCandidate = {
      pattern: "INV-(\\d{4}-\\d{3})",
      flags: "",
      explanation: "Capture le format annee-numero apres INV-",
      confidence: 0.95,
    };

    const validation = validateCandidate(candidate, positives, negatives);
    expect(validation.isValid).toBe(true);
    expect(validation.syntaxValid).toBe(true);
    expect(validation.positivePassed).toBe(2);
    expect(validation.negativePassed).toBe(2);
    expect(validation.security.risk).toBe("low");
    expect(validation.errors).toHaveLength(0);
  });

  it("rejette une regex dont la syntaxe RegExp est invalide", () => {
    const candidate: RegexCandidate = {
      pattern: "INV-([0-9+", // Parenthese non fermee
      flags: "",
      explanation: "Motif syntaxiquement casse",
      confidence: 0.5,
    };

    const validation = validateCandidate(candidate, positives, negatives);
    expect(validation.isValid).toBe(false);
    expect(validation.syntaxValid).toBe(false);
    expect(validation.errors[0]).toContain("Erreur de syntaxe RegExp");
  });

  it("rejette une regex qui echoue sur l'un des exemples positifs", () => {
    const candidate: RegexCandidate = {
      pattern: "INV-(\\d{4}-001)", // Ne capture que 001, echouera sur 042
      flags: "",
      explanation: "Trop restrictif",
      confidence: 0.8,
    };

    const validation = validateCandidate(candidate, positives, negatives);
    expect(validation.isValid).toBe(false);
    expect(validation.positivePassed).toBe(1);
    expect(validation.errors.some((e) => e.includes("Échec sur exemple positif"))).toBe(true);
  });

  it("rejette une regex qui accepte a tort un exemple negatif", () => {
    const candidate: RegexCandidate = {
      pattern: "(\\d{4}-\\d{3})", // Trop large, correspondra aussi a REF-2024-999 !
      flags: "",
      explanation: "Trop permissif",
      confidence: 0.8,
    };

    const validation = validateCandidate(candidate, positives, negatives);
    expect(validation.isValid).toBe(false);
    expect(validation.negativePassed).toBe(1); // REF a ete matche a tort
    expect(validation.errors.some((e) => e.includes("Échec sur exemple négatif"))).toBe(true);
  });
});

describe("Analyse de securite ReDoS", () => {
  it("detecte les quantificateurs imbriques a haut risque de backtracking catastrophique", () => {
    const catastrophicPatterns = [
      "(a+)+",
      "(a*)*",
      "([0-9]+)+",
      "(.+)+",
      "(.*)*",
    ];

    for (const pat of catastrophicPatterns) {
      const sec = analyzeSecurity(pat);
      expect(sec.risk).toBe("high");
      expect(sec.hasCatastrophicBacktracking).toBe(true);
    }
  });

  it("accorde un risque faible aux expressions regulieres saines", () => {
    const safePatterns = [
      "FA-(\\d{4})-\\d+",
      "[A-Z]{2,4}\\s*\\|\\s*\\d+",
      "^user_([a-z0-9_]+)@domain\\.com$",
    ];

    for (const pat of safePatterns) {
      const sec = analyzeSecurity(pat);
      expect(sec.risk).toBe("low");
      expect(sec.hasCatastrophicBacktracking).toBe(false);
    }
  });
});

describe("Parsing JSON strict et boucle de retroaction", () => {
  it("parse correctement un JSON propre", () => {
    const raw = JSON.stringify({
      pattern: "\\d{4}",
      flags: "i",
      explanation: "4 chiffres",
      confidence: 0.9,
    });
    const parsed = parseCandidateJSON(raw);
    expect(parsed?.pattern).toBe("\\d{4}");
    expect(parsed?.flags).toBe("i");
  });

  it("nettoie les balises markdown ```json et /.../", () => {
    const raw = "```json\n{\n  \"pattern\": \"/([A-Z]{3})/\",\n  \"flags\": \"\",\n  \"explanation\": \"code\"\n}\n```";
    const parsed = parseCandidateJSON(raw);
    expect(parsed?.pattern).toBe("([A-Z]{3})");
  });

  it("construit un prompt de correction contenant les contre-exemples precis", () => {
    const candidate: RegexCandidate = {
      pattern: "\\d+",
      flags: "",
      explanation: "chiffres",
      confidence: 0.5,
    };
    const validation = validateCandidate(
      candidate,
      [{ input: "ABC 123", expected: "123" }],
      [{ input: "FORBIDDEN 456" }],
    );

    const prompt = buildCorrectionPrompt(candidate, validation, [
      { input: "ABC 123", expected: "123" },
    ]);
    expect(prompt).toContain("Ta proposition précédente a échoué");
    expect(prompt).toContain("Échec sur exemple négatif");
  });
});
