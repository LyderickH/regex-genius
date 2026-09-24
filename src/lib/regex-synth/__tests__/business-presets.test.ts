import { describe, it, expect } from "vitest";
import { BUSINESS_PRESETS } from "@/lib/datasets/business-presets";
import { synthesize } from "../engine";

describe("BUSINESS_PRESETS synthesis validity", () => {
  for (const preset of BUSINESS_PRESETS) {
    it(`synthesizes all columns for preset ${preset.id} (${preset.title})`, () => {
      expect(preset.rows.length).toBeGreaterThan(0);
      for (const col of preset.columns) {
        const expected = preset.rows.map((_, i) => col.examples[i] ?? null);
        const res = synthesize(preset.rows, expected);
        expect(res.rule, `Failed on col ${col.name} in preset ${preset.id}`).not.toBeNull();
        expect(res.matched).toBeGreaterThanOrEqual(Object.keys(col.examples).length);
      }
    });
  }
});
