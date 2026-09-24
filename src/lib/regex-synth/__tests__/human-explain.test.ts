import { describe, expect, it } from "vitest";
import { explainRegexHuman } from "../human-explain";

describe("explainRegexHuman", () => {
  it("explains chevron delimited text", () => {
    const text = explainRegexHuman({
      source: "<([^>]+)>",
      pattern: "<([^>]+)>",
      flags: "g",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
    });
    expect(text).toContain("chevrons");
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
    expect(text).toContain("utm_campaign");
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
});
