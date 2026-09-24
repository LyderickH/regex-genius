import { describe, it, expect } from "vitest";
import { synthesize, applyRule } from "../engine";

describe("Performance & Robustesse sur grands volumes (1 000 000 lignes)", () => {
  it("synthétise et applique une règle sur 1 000 000 lignes sans dépasser la pile d'appels ni exploser la mémoire", () => {
    const N = 1_000_000;
    
    // Génération rapide de 1 000 000 de lignes
    const rows = new Array<string>(N);
    for (let i = 0; i < N; i++) {
      rows[i] = `LOG_${i} [INFO] Client_${(i % 500) + 1} processed`;
    }

    // L'utilisateur a fourni 3 exemples au début
    const user = new Array<string | null>(N).fill(null);
    user[0] = "Client_1";
    user[1] = "Client_2";
    user[2] = "Client_3";

    const t0 = performance.now();
    const result = synthesize(rows, user);
    const synthTime = performance.now() - t0;

    expect(result).not.toBeNull();
    expect(result?.rule).toBeDefined();
    // La synthèse doit être très rapide grâce à l'échantillonnage représentatif (< 1000ms même sur machine chargée)
    expect(synthTime).toBeLessThan(1000);

    // Application de la règle sur les 1 000 000 lignes
    const t1 = performance.now();
    const evaluated = applyRule(result!.rule, rows, user);
    const evalTime = performance.now() - t1;

    expect(evaluated.matched).toBe(N);
    expect(evaluated.failures.length).toBeLessThanOrEqual(50);
    // L'évaluation directe par regex précompilée sur 1M lignes prend généralement < 500ms
    expect(evalTime).toBeLessThan(1500);
  });
});
