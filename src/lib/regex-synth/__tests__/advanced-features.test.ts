import { describe, it, expect } from "vitest";
import { synthesizeStructuredAnchorRule, synthesize } from "../engine";
import { sanitizeReDoS, analyzeSecurity, sanitizeAndCheckReDoS } from "../../llm/security";
import { AVAILABLE_MODELS } from "../../llm/types";

describe("Fonctionnalités avancées : Alignement LCS, VSA/FlashFill, ReDoS & Modèles", () => {
  describe("1. Alignement de séparateurs & Invariants (LCS / Needleman-Wunsch & VSA)", () => {
    it("détecte instantanément la colonne délimitée dans des logs avec point-virgule sans heuristique lourde", () => {
      const inputs = [
        "2026-03-01;INFO;AUTH_SERVICE;user_412;SUCCESS",
        "2026-03-01;WARN;BILLING;corp_99;FAILED_CARD",
        "2026-03-01;ERROR;GATEWAY;guest_1;TIMEOUT",
      ];
      // L'utilisateur veut extraire l'identifiant (4e colonne, index 3)
      const examples = [
        { index: 0, input: inputs[0]!, output: "user_412" },
        { index: 1, input: inputs[1]!, output: "corp_99" },
      ];

      const rule = synthesizeStructuredAnchorRule(examples, inputs);
      expect(rule).not.toBeNull();
      // Doit produire une règle ancrée sur l'index 3 avec séparateur ;
      expect(rule?.source).toContain(";){3}");

      // Évaluation sur l'ensemble
      const res = synthesize(inputs, [examples[0]!.output, examples[1]!.output, null]);
      expect(res.values[2]).toBe("guest_1");
      expect(res.matched).toBe(3);
    });

    it("détecte l'ancrage contextuel VSA (Left/Right Anchor) sur des balises ou délimiteurs invariants", () => {
      const inputs = [
        "Status: [OK] code=200 latency=12ms",
        "Status: [PENDING] code=202 latency=45ms",
        "Status: [FAILED] code=500 latency=120ms",
      ];
      const examples = [
        { index: 0, input: inputs[0]!, output: "OK" },
        { index: 1, input: inputs[1]!, output: "PENDING" },
      ];

      const rule = synthesizeStructuredAnchorRule(examples, inputs);
      expect(rule).not.toBeNull();
      expect(rule?.source).toContain("\\[");

      const res = synthesize(inputs, [examples[0]!.output, examples[1]!.output, null]);
      expect(res.values[2]).toBe("FAILED");
      expect(res.matched).toBe(3);
    });
  });

  describe("2. Prévention ReDoS (FlashRegex)", () => {
    it("neutralise et aplatit automatiquement les quantificateurs imbriqués dangereux", () => {
      const evil1 = "([a-z]+)+";
      const sanitized1 = sanitizeReDoS(evil1);
      expect(sanitized1).toBe("([a-z]+)");

      const evil2 = "(?:.*)*";
      const sanitized2 = sanitizeReDoS(evil2);
      expect(sanitized2).toBe("(?:.*)");

      const evil3 = ".*.*.*";
      const sanitized3 = sanitizeReDoS(evil3);
      expect(sanitized3).toBe(".*");
    });

    it("signale un risque élevé sur les motifs à risque de backtracking sans bloquer les expressions saines", () => {
      const bad = analyzeSecurity("((a+)+)");
      expect(bad.hasCatastrophicBacktracking).toBe(true);
      expect(bad.risk).toBe("high");

      const safe = analyzeSecurity("^(?:[^|]*\\|){8}\\s*([^|]+?)\\s*\\|");
      expect(safe.hasCatastrophicBacktracking).toBe(false);
      expect(safe.risk).toBe("low");
    });
  });

  describe("3. Configuration Qwen2.5-Coder par défaut", () => {
    it("définit Qwen 2.5-Coder 1.5B comme modèle recommandé", () => {
      const defaultModel = AVAILABLE_MODELS.find((m) => m.id === "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC");
      expect(defaultModel).toBeDefined();
      expect(defaultModel?.recommended).toBe("balanced");
      expect(defaultModel?.family).toBe("qwen");

      const fastModel = AVAILABLE_MODELS.find((m) => m.id === "Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC");
      expect(fastModel).toBeDefined();
    });
  });
});
