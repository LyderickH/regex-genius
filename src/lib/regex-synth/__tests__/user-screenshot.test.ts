import { describe, it, expect } from "vitest";
import { synthesize } from "../engine";

describe("Test User Screenshot Case on 1M rows", () => {
  it("extrait les emails entre chevrons <...> sur 1 000 000 lignes", () => {
    const N = 1_000_000;
    const inputs = new Array<string>(N);
    for (let i = 0; i < N; i++) {
      inputs[i] = `[AUDIT_LOG #${String(i + 1).padStart(7, "0")}] - Initiated by user <user_${i}@domain.com> at timestamp 2026-01-01 00:00:00`;
    }

    const expected = new Array<string | null>(N).fill(null);
    for (let i = 0; i < 10; i++) {
      expected[i] = `user_${i}@domain.com`;
    }

    const t0 = performance.now();
    const res = synthesize(inputs, expected);
    const time = performance.now() - t0;

    console.log("1M AUDIT LOG SYNTH:", {
      timeMs: time,
      rule: res.rule?.source,
      matched: res.matched,
      failures: res.failures.length,
      val500: res.values[500],
    });

    expect(res.rule).not.toBeNull();
    expect(res.values[500]).toBe("user_500@domain.com");
    expect(res.matched).toBe(N);
  });
});
