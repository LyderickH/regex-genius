import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { applyRule, type Rule } from "../regex-synth/engine";
import { PatternPanel } from "../../components/regex-tool/PatternPanel";

describe("Manual Regex Editing and Reverting", () => {
  const sampleRows = [
    "POST /api/v1/users 200 45ms",
    "GET /api/v1/products 404 12ms",
    "PUT /api/v1/orders 500 80ms",
  ];

  const autoRule: Rule = {
    source: " ([0-9]{3}) ",
    flags: "u",
    transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
    origin: "algorithmic",
  };

  it("applies original deduced rule correctly", () => {
    const res = applyRule(autoRule, sampleRows);
    expect(res.matched).toBe(3);
    expect(res.values).toEqual(["200", "404", "500"]);
    expect(res.failures).toHaveLength(0);
  });

  it("applies a manually edited rule and preserves originalAutoRule", () => {
    const manualRule: Rule = {
      ...autoRule,
      source: "([A-Z]{3,4}) ",
      origin: "manual",
      originalAutoRule: autoRule,
    };

    const res = applyRule(manualRule, sampleRows);
    expect(res.matched).toBe(3);
    expect(res.values).toEqual(["POST", "GET", "PUT"]);

    // Reverting using originalAutoRule restores initial behavior
    expect(manualRule.originalAutoRule).toBeDefined();
    const restored = applyRule(manualRule.originalAutoRule!, sampleRows);
    expect(restored.values).toEqual(["200", "404", "500"]);
  });

  it("renders PatternPanel with manual badge, pencil button and return/reset button", () => {
    const manualRule: Rule = {
      source: "([A-Z]{3,4}) ",
      flags: "u",
      transform: { strip: "none", dec: "none", casing: "none", fmt: "none" },
      origin: "manual",
      originalAutoRule: autoRule,
    };

    const onUpdateRule = vi.fn();
    const onResetRule = vi.fn();

    const html = renderToString(
      React.createElement(PatternPanel, {
        column: {
          id: "col1",
          name: "Méthode HTTP",
          user: ["POST", "GET", "PUT"],
          derived: ["POST", "GET", "PUT"],
          failures: [],
          rule: manualRule,
        },
        rowCount: 3,
        rows: sampleRows,
        onUpdateRule,
        onResetRule,
      })
    );

    // Verify presence of manual badge, pencil action and revert button
    expect(html).toContain("Modifiée manuellement");
    expect(html).toContain("Modifier");
    expect(html).toContain("Revenir");
    expect(html).toContain("origine");
  });
});
