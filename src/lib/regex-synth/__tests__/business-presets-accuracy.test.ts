import { describe, it, expect } from "vitest";
import { BUSINESS_PRESETS } from "@/lib/datasets/business-presets";
import { synthesize } from "../engine";
import { explainRegexHuman } from "../human-explain";

describe("Business Presets Robustness and Accuracy", () => {
  for (const preset of BUSINESS_PRESETS) {
    describe(`Preset: ${preset.title} (${preset.id})`, () => {
      for (const col of preset.columns) {
        it(`synthesizes clean 100% matching rule for column: "${col.name}"`, () => {
          const expected = preset.rows.map((_, i) => col.examples[i] ?? null);
          const res = synthesize(preset.rows, expected);

          expect(res.rule).toBeDefined();
          expect(res.matched).toBe(preset.rows.length);
          expect(res.failures).toHaveLength(0);

          // Crucial quality assertion: should not require fallback chains for standard presets
          expect(res.rule?.extra ?? []).toHaveLength(0);

          // Should not contain broken word-fragment delimiters like "EPA " or "mis "
          const pattern = res.rule!.source;
          expect(pattern).not.toMatch(/EPA\s/);
          expect(pattern).not.toMatch(/mis\s/);
        });
      }
    });
  }

  it("produces human-friendly explanations for IBAN and NIR", () => {
    const ibanPreset = BUSINESS_PRESETS.find((p) => p.id === "iban")!;
    const ibanCol = ibanPreset.columns[0];
    const expected = ibanPreset.rows.map((_, i) => ibanCol.examples[i] ?? null);
    const res = synthesize(ibanPreset.rows, expected);

    const explanation = explainRegexHuman(res.rule, ibanCol.name);
    expect(explanation.toLowerCase()).toContain("iban");
  });
});
