import { describe, it, expect } from "vitest";
import { synthesize, combineColumns } from "../engine";

const SAMPLE = `VE | Ventes | VT0001 | 20240131 | 411000 | Clients divers | C0012 | SARL DUPONT & FILS | FA-2024-0001 | 20240131 | Facture FA-2024-0001 - SARL DUPONT | 1 250,00 | 0,00 | AA | 20240215 | 20240131 |  | EUR
AC | Achats | AC0087 | 20240205 | 401000 | Fournisseurs | F0031 | ÉTS MARTIN | FA/2024/87 | 20240203 | Achat fournitures - réf. 12/45 | 980,50 | 0,00 |  |  | 20240205 |  | EUR
BQ | Banque | BQ0142 | 20240229 | 512000 | Banque - compte courant |  |  | REL-02 | 20240229 | Virement client DUPONT | 0,00 | 3 410,90 | BB | 20240301 | 20240229 |  | EUR
OD | Opérations diverses | OD0009 | 20241231 | 681100 | Dotations amortissements |  |  | DOT-2024 | 20241231 | Amortissement matériel (5 ans) | 77,00 | 0,00 |  |  | 20241231 |  | EUR
VE | Ventes | VT0102 | 20250114 | 707000 | Ventes de marchandises | C0007 | LE COMPTOIR | FA-2025-0102 | 20250114 | Facture - lot n°12 000 pièces | 12 000,00 | 0,00 |  |  | 20250114 | 13 200,00 | USD
AC | Achats | AC0203 | 20250220 | 607000 | Achats marchandises | F0002 | IMPORT & CO | FA-2025/203 | 20250218 | Avoir sur facture 198 | -45,90 | 0,00 |  |  | 20250220 |  | EUR
BQ | Banque | BQ0311 | 20250331 | 627000 | Services bancaires |  |  | AGIOS-03 | 20250331 | Agios trimestre 1 | 8,90 | 0,00 |  |  | 20250331 |  | EUR
VE | Ventes | VT0115 | 20250402 | 707000 | Ventes de marchandises | C0012 | SARL DUPONT & FILS | FA-2025-0115 | 20250402 | Facture - remise 10 % | 2 300,00 | 0,00 | CC | 20250430 | 20250402 |  | EUR`;

describe("Synthèse générale sur données délimitées (anti-surajustement)", () => {
  it("privilégie les règles de champs délimités plutôt que d'énumérer les noms propres", () => {
    const inputs = SAMPLE.split("\n");
    const expectedPiece = [
      "FA-2024-0001",
      "FA/2024/87",
      "REL-02",
      null,
      null,
      null,
      null,
      null,
    ];

    const resPiece = synthesize(inputs, expectedPiece);
    expect(resPiece.rule).not.toBeNull();
    // Doit utiliser l'indexation de champ plutôt qu'une énumération de mots
    expect(resPiece.rule?.source).toContain("^(?:[^|]*\\|){8}");
    expect(resPiece.rule?.source).not.toContain("COMPTOIR");
    expect(resPiece.rule?.source).not.toContain("MARTIN");
    expect(resPiece.rule?.source).not.toContain("FILS");

    // Ligne 5 doit extraire le N° de pièce exact et non la date
    expect(resPiece.values[5]).toBe("FA-2025/203");
    expect(resPiece.matched).toBe(8);

    // Débit
    const expectedDebit = ["1250,00", "980,50", "0,00", null, null, null, null, null];
    const resDebit = synthesize(inputs, expectedDebit);
    expect(resDebit.rule).not.toBeNull();
    expect(resDebit.matched).toBe(8);

    // Regex combinée
    const combined = combineColumns(inputs, [
      { name: "N° de pièce", rule: resPiece.rule! },
      { name: "Débit", rule: resDebit.rule! },
    ]);
    expect(combined).not.toBeNull();
    expect(combined?.source).toContain("^(?:[^|]*\\|){8}");
    expect(combined?.covered).toBe(8);
  });

  it("autorise les alternances pertinentes sur des mots-clés légitimes (ex: Facture|Avoir)", () => {
    const inputs = [
      "Facture n° 1024 du 01/01",
      "Avoir n° 5012 du 02/01",
      "Devis n° 9081 du 03/01",
    ];
    const expected = ["1024", "5012", "9081"];

    const res = synthesize(inputs, expected);
    expect(res.rule).not.toBeNull();
    expect(res.matched).toBe(3);
    expect(res.values).toEqual(["1024", "5012", "9081"]);
  });
});
