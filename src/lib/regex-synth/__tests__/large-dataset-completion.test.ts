import { describe, it, expect } from "vitest";
import { synthesize } from "../engine";

describe("Complétion robuste sur grands jeux de données et exemples distants", () => {
  it("synthétise et complète 100% des lignes même si les exemples sont saisis au-delà de la ligne 2000", () => {
    const N = 8_000;
    const inputs = new Array<string>(N);
    for (let i = 0; i < N; i++) {
      inputs[i] = `LOG_${i} | CODE: ABC-${String(i).padStart(5, "0")} | STATUS: OK`;
    }

    const expected = new Array<string | null>(N).fill(null);
    // Exemples saisis sur des lignes éloignées (au-delà du seuil d'échantillonnage de 2000)
    expected[50] = "ABC-00050";
    expected[2500] = "ABC-02500";
    expected[6200] = "ABC-06200";

    const res = synthesize(inputs, expected);

    expect(res.rule).not.toBeNull();
    // Doit avoir une règle valide
    expect(res.values.length).toBe(N);
    expect(res.matched).toBe(N);
    // Vérification sur des lignes variées
    expect(res.values[0]).toBe("ABC-00000");
    expect(res.values[50]).toBe("ABC-00050");
    expect(res.values[2500]).toBe("ABC-02500");
    expect(res.values[6200]).toBe("ABC-06200");
    expect(res.values[7999]).toBe("ABC-07999");
  });

  it("gère les données clairsemées où seulement 30% des lignes contiennent le motif (sans rejet arbitraire)", () => {
    const N = 5_000;
    const inputs = new Array<string>(N);
    for (let i = 0; i < N; i++) {
      if (i % 3 === 0) {
        inputs[i] = `EVENT user <agent_${i}@entreprise.fr> connected`;
      } else {
        inputs[i] = `SYSTEM ping server heartbeat`;
      }
    }

    const expected = new Array<string | null>(N).fill(null);
    expected[0] = "agent_0@entreprise.fr";
    expected[300] = "agent_300@entreprise.fr";
    expected[2100] = "agent_2100@entreprise.fr";

    const res = synthesize(inputs, expected);

    expect(res.rule).not.toBeNull();
    expect(res.values.length).toBe(N);
    expect(res.values[0]).toBe("agent_0@entreprise.fr");
    expect(res.values[1]).toBeNull();
    expect(res.values[300]).toBe("agent_300@entreprise.fr");
    expect(res.values[2100]).toBe("agent_2100@entreprise.fr");
    expect(res.values[2103]).toBe("agent_2103@entreprise.fr");
    // Environ 1667 lignes doivent matcher
    expect(res.matched).toBeGreaterThanOrEqual(1600);
  });
});
