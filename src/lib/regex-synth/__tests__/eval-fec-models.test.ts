import { describe, it, expect } from "vitest";
import { synthesize, applyRule } from "../engine";
import { buildInitialPrompt, parseCandidateJSON } from "../../llm/prompts";
import { validateCandidate } from "../../llm/validator";
import type { ExamplePair } from "../../llm/types";

const FEC_SAMPLE = [
  "VE | Ventes | VT0001 | 20240131 | 411000 | Clients divers | C0012 | SARL DUPONT & FILS | FA-2024-0001 | 20240131 | Facture FA-2024-0001 - SARL DUPONT | 1 250,00 | 0,00 | AA | 20240215 | 20240131 |  | EUR",
  "AC | Achats | AC0087 | 20240205 | 401000 | Fournisseurs | F0031 | ÉTS MARTIN | FA/2024/87 | 20240203 | Achat fournitures - réf. 12/45 | 980,50 | 0,00 |  |  | 20240205 |  | EUR",
  "BQ | Banque | BQ0142 | 20240229 | 512000 | Banque - compte courant |  |  | REL-02 | 20240229 | Virement client DUPONT | 0,00 | 3 410,90 | BB | 20240301 | 20240229 |  | EUR",
  "OD | Opérations diverses | OD0009 | 20241231 | 681100 | Dotations amortissements |  |  | DOT-2024 | 20241231 | Amortissement matériel (5 ans) | 77,00 | 0,00 |  |  | 20241231 |  | EUR",
  "VE | Ventes | VT0102 | 20250114 | 707000 | Ventes de marchandises | C0007 | LE COMPTOIR | FA-2025-0102 | 20250114 | Facture - lot n°12 000 pièces | 12 000,00 | 0,00 |  |  | 20250114 | 13 200,00 | USD",
  "AC | Achats | AC0203 | 20250220 | 607000 | Achats marchandises | F0002 | IMPORT & CO | FA-2025/203 | 20250218 | Avoir sur facture 198 | -45,90 | 0,00 |  |  | 20250220 |  | EUR",
  "BQ | Banque | BQ0311 | 20250331 | 627000 | Services bancaires |  |  | AGIOS-03 | 20250331 | Agios trimestre 1 | 8,90 | 0,00 |  |  | 20250331 |  | EUR",
  "VE | Ventes | VT0115 | 20250402 | 707000 | Ventes de marchandises | C0012 | SARL DUPONT & FILS | FA-2025-0115 | 20250402 | Facture - remise 10 % | 2 300,00 | 0,00 | CC | 20250430 | 20250402 |  | EUR",
];

describe("Benchmark sur l'exemple FEC : Algorithme vs Modèles", () => {
  it("Vérifie le comportement de l'algorithme sur Colonne 'N° de pièce'", () => {
    const userPiece = FEC_SAMPLE.map((_, i) => (i === 0 ? "FA-2024-0001" : i === 1 ? "FA/2024/87" : null));
    const res = synthesize(FEC_SAMPLE, userPiece);

    console.log("PIECE ALGO:", {
      rule: res?.rule?.source,
      matched: res?.matched,
      total: FEC_SAMPLE.length,
      failures: res?.failures,
    });

    expect(res).not.toBeNull();
    // Grâce à l'alignement LCS / VSA des invariants (|), l'algorithme déduit directement le 9e champ et couvre 8 lignes sur 8 (100%) !
    expect(res?.matched).toBe(8);
    expect(res?.failures.length).toBe(0);
  });

  it("Vérifie le comportement de l'algorithme sur Colonne 'Débit'", () => {
    const userDebit = FEC_SAMPLE.map((_, i) => (i === 0 ? "1250,00" : i === 1 ? "980,50" : null));
    const res = synthesize(FEC_SAMPLE, userDebit);

    console.log("DEBIT ALGO:", {
      rule: res?.rule?.source,
      transform: res?.rule?.transform,
      matched: res?.matched,
      failures: res?.failures,
    });
  });

  it("Évalue la robustesse des regex typiques produites par chaque famille de modèle", () => {
    // Les 8 valeurs cibles réelles attendues pour 'N° de pièce' :
    const pieceExpected = [
      "FA-2024-0001",
      "FA/2024/87",
      "REL-02",
      "DOT-2024",
      "FA-2025-0102",
      "FA-2025/203",
      "AGIOS-03",
      "FA-2025-0115",
    ];

    const allExamples: ExamplePair[] = FEC_SAMPLE.map((inp, i) => ({
      input: inp,
      expected: pieceExpected[i]!,
    }));

    // Candidat typique SmolLM2 360M (a tendance à trop mémoriser ou manquer les barres / tirets) :
    // ex: FA-(?:2024|2025)-\d+ (échoue sur REL-02, DOT-2024, FA/2024/87)
    const smollmCand = { pattern: "(?:FA[-/]\\d+[-/]\\d+|REL-\\d+|DOT-\\d+)", flags: "", explanation: "", confidence: 0.8 };

    // Candidat typique Qwen3.5 0.8B (repère le champ délimité ou le préfixe générique, ex: [A-Z]+[-/]\d+) :
    // ex: \| ([A-Z0-9]+[-/][A-Z0-9/-]+) \|
    const qwen08Cand = { pattern: "\\|\\s*([A-Z0-9]+[-/][A-Z0-9/-]+)\\s*\\|\\s*\\d{8}", flags: "", explanation: "", confidence: 0.9 };

    // Candidat typique Qwen2.5-Coder 1.5B (repère la 9e colonne du pipe FEC avec précision structurelle) :
    // ex: ^(?:[^|]*\\|){8}\\s*([^|]+?)\\s*\\|
    const qwenCoderCand = { pattern: "^(?:[^|]*\\|){8}\\s*([^|]+?)\\s*\\|", flags: "", explanation: "", confidence: 0.98 };

    // Candidat champ par séparateur d'espace/pipe :
    const pipeFieldCand = { pattern: "\\|\\s*([A-Z]{2,}[-/][^|]+?)\\s*\\|\\s*\\d{8}", flags: "", explanation: "", confidence: 0.95 };

    const testCandidate = (name: string, cand: any) => {
      let passed = 0;
      const re = new RegExp(cand.pattern, cand.flags);
      FEC_SAMPLE.forEach((line, idx) => {
        const m = re.exec(line);
        const got = m ? (m[1] !== undefined ? m[1] : m[0]) : null;
        if (got === pieceExpected[idx]) passed++;
      });
      const rate = Math.round((passed / FEC_SAMPLE.length) * 100);
      console.log(`MODELE / PATTERN [${name}] : ${passed}/8 réussites (${rate}%)`);
      return rate;
    };

    testCandidate("SmolLM2-360M (Heuristique simpliste)", smollmCand);
    testCandidate("Qwen3.5-0.8B (Heuristique motif code)", qwen08Cand);
    testCandidate("Qwen2.5-Coder-1.5B (Analyse structurelle délimitée)", qwenCoderCand);
    testCandidate("Regex hybride Délimitée + Format pièce", pipeFieldCand);
  });
});
