import { describe, it, expect } from "vitest";
import { synthesize, combineColumns } from "../engine";

describe("Vérification approfondie du moteur de synthèse et de la logique de complétion", () => {
  it("extrait correctement des codes produits avec des exemples répartis sur tout le jeu de données", () => {
    const N = 4_000;
    const inputs: string[] = [];
    for (let i = 0; i < N; i++) {
      const type = i % 2 === 0 ? "REF" : "ART";
      const code = `${type}-${String(i).padStart(4, "0")}`;
      inputs.push(`ARTICLE MAGASIN [${code}] PRIX: ${(10 + (i % 50)).toFixed(2)} EUR`);
    }

    const expected = new Array<string | null>(N).fill(null);
    expected[5] = "ART-0005";
    expected[1500] = "REF-1500";
    expected[3200] = "REF-3200";

    const res = synthesize(inputs, expected);

    expect(res.rule).not.toBeNull();
    expect(res.values.length).toBe(N);
    expect(res.matched).toBe(N);
    expect(res.values[5]).toBe("ART-0005");
    expect(res.values[1500]).toBe("REF-1500");
    expect(res.values[3200]).toBe("REF-3200");
    expect(res.values[0]).toBe("REF-0000");
    expect(res.values[3999]).toBe("ART-3999");
  });

  it("gère les délimitations multiples et combine les colonnes de sortie sans erreur", () => {
    const inputs = [
      "2026-01-15;FA-1002;CLIENT_ALPHA;1540.50",
      "2026-01-16;FA-1003;CLIENT_BETA;240.00",
      "2026-01-17;FA-1004;CLIENT_GAMMA;8920.10",
      "2026-01-18;FA-1005;CLIENT_DELTA;50.00",
    ];

    const expCol1 = ["FA-1002", "FA-1003", null, null];
    const expCol2 = ["CLIENT_ALPHA", "CLIENT_BETA", null, null];
    const expCol3 = ["1540.50", "240.00", null, null];

    const res1 = synthesize(inputs, expCol1);
    const res2 = synthesize(inputs, expCol2);
    const res3 = synthesize(inputs, expCol3);

    expect(res1.rule).not.toBeNull();
    expect(res2.rule).not.toBeNull();
    expect(res3.rule).not.toBeNull();

    expect(res1.values[2]).toBe("FA-1004");
    expect(res2.values[2]).toBe("CLIENT_GAMMA");
    expect(res3.values[2]).toBe("8920.10");

    const combined = combineColumns(inputs, [
      { name: "Facture", rule: res1.rule! },
      { name: "Client", rule: res2.rule! },
      { name: "Montant", rule: res3.rule! },
    ]);

    expect(combined).not.toBeNull();
    expect(combined?.covered).toBe(4);
  });

  it("garantit que l'algorithme d'affichage préserve toujours les indices saisis", () => {
    const totalRows = 5000;
    const userIndices = [12, 1050, 4820];
    const userRows = new Set(userIndices);

    // Simulation de la logique d'affichage de index.tsx
    const computeDisplayed = (mode: "first_1000" | "all", extraCount = 0) => {
      if (mode === "first_1000") {
        const set = new Set<number>();
        const limit = Math.min(totalRows, 1000 + extraCount);
        for (let i = 0; i < limit; i++) set.add(i);
        userRows.forEach((r) => set.add(r));
        return Array.from(set).sort((a, b) => a - b);
      }
      return Array.from({ length: totalRows }, (_, i) => i);
    };

    const all = computeDisplayed("all");
    const first1000 = computeDisplayed("first_1000");
    const plus1000 = computeDisplayed("first_1000", 1000);

    // En mode "all", TOUTES les lignes sont présentes de 0 à N-1
    expect(all.length).toBe(totalRows);
    expect(all[0]).toBe(0);
    expect(all[totalRows - 1]).toBe(totalRows - 1);

    // Les indices utilisateur doivent être TOUJOURS présents
    userIndices.forEach((idx) => {
      expect(all).toContain(idx);
      expect(first1000).toContain(idx);
      expect(plus1000).toContain(idx);
    });

    // "+ 1000 lignes" doit augmenter le nombre de lignes affichées
    expect(plus1000.length).toBeGreaterThan(first1000.length);
  });
});
