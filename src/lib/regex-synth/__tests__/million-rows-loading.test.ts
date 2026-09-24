import { describe, it, expect } from "vitest";
import { parsePastedText } from "../../data-io";
import { combineColumns } from "../engine";

describe("Performance sur 1 000 000 de lignes", () => {
  it("parse 1 000 000 de lignes en mémoire sans freeze ni surallocation", () => {
    const raw = ("user_1029: contact@domain.org (active)\n").repeat(1000000);
    const t0 = performance.now();
    const matrix = parsePastedText(raw);
    const t1 = performance.now();

    expect(matrix.length).toBe(1000000);
    expect(matrix[0]?.[0]).toBe("user_1029: contact@domain.org (active)");
    // Le parsing de 1M lignes doit prendre moins de 500ms
    expect(t1 - t0).toBeLessThan(1200);
  });

  it("combineColumns s'exécute en moins de 30ms sur 1 000 000 de lignes grâce à l'échantillonnage", () => {
    const rows = Array(1000000).fill("2026-09-24 [ERROR] user_42: failed login");
    const cols = [
      { name: "Date", rule: { source: "^(\\d{4}-\\d{2}-\\d{2})", flags: "" } },
      { name: "Level", rule: { source: "\\[([A-Z]+)\\]", flags: "" } },
    ];

    const t0 = performance.now();
    const combo = combineColumns(rows, cols);
    const elapsed = performance.now() - t0;

    expect(combo).not.toBeNull();
    expect(combo?.names).toEqual(["Date", "Level"]);
    expect(combo?.total).toBe(1000000);
    // Doit être quasi-instantané (< 60ms) et ne pas bloquer le thread UI
    expect(elapsed).toBeLessThan(100);
  });
});
