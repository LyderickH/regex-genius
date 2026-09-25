import { describe, it, expect } from "vitest";
import { synthesize, applyRule } from "../engine";

describe("Protocole d'évaluation : 3 exemples d'apprentissage -> 6 cas de généralisation", () => {
  it("Test 1 : Identifiant entre délimiteurs fixes (longueur variable)", () => {
    const rows = [
      "Commande [CMD-12] validée",
      "Commande [CMD-458] validée",
      "Commande [CMD-9] validée",
      "Commande [CMD-88741] validée",
      "Commande [CMD-00] en attente",
      "Commande [CMD-554] annulée",
      "Commande [CMD-712399] validée",
      "Commande [CMD-3] archivée",
      "Commande [CMD-1002] validée",
    ];

    const examples = [
      "CMD-12",
      "CMD-458",
      "CMD-9",
      null, null, null, null, null, null,
    ];

    const expectedAll = [
      "CMD-12",
      "CMD-458",
      "CMD-9",
      "CMD-88741",
      "CMD-00",
      "CMD-554",
      "CMD-712399",
      "CMD-3",
      "CMD-1002",
    ];

    const res = synthesize(rows, examples);
    console.log("TEST 1 SYNTH:", res.rule?.source);

    expect(res.rule).toBeDefined();
    for (let i = 0; i < rows.length; i++) {
      expect(res.values[i]).toBe(expectedAll[i]);
    }
  });

  it("Test 2 : Extraction d'adresses e-mail (domaines et formats hétérogènes)", () => {
    const rows = [
      "Contact: lucas.martin@corp.fr (CDI)",
      "Contact: sophie.dubois@corp.fr (CDD)",
      "Contact: t.bernard@corp.fr (Stage)",
      "Contact: alexandre.r@gmail.com (CDI)",
      "Contact: info-client@service.org (Prestataire)",
      "Contact: jean_michel@pro.net (CDD)",
      "Contact: contact@startup.io (Alternance)",
      "Contact: marie.claude.d@groupe.eu (CDI)",
      "Contact: a@b.fr (Interim)",
    ];

    const examples = [
      "lucas.martin@corp.fr",
      "sophie.dubois@corp.fr",
      "t.bernard@corp.fr",
      null, null, null, null, null, null,
    ];

    const expectedAll = [
      "lucas.martin@corp.fr",
      "sophie.dubois@corp.fr",
      "t.bernard@corp.fr",
      "alexandre.r@gmail.com",
      "info-client@service.org",
      "jean_michel@pro.net",
      "contact@startup.io",
      "marie.claude.d@groupe.eu",
      "a@b.fr",
    ];

    const res = synthesize(rows, examples);
    console.log("TEST 2 SYNTH:", res.rule?.source);

    expect(res.rule).toBeDefined();
    for (let i = 0; i < rows.length; i++) {
      expect(res.values[i]).toBe(expectedAll[i]);
    }
  });

  it("Test 3 : Montant monétaire en fin de chaîne (variations de chiffres et décimales)", () => {
    const rows = [
      "Règlement facture 125 €",
      "Règlement facture 80 €",
      "Règlement facture 1450 €",
      "Règlement facture 9 €",
      "Règlement facture 12500 €",
      "Règlement facture 42,50 €",
      "Règlement facture 0 €",
      "Règlement facture 880 €",
      "Règlement facture 100000 €",
    ];

    const examples = [
      "125",
      "80",
      "1450",
      null, null, null, null, null, null,
    ];

    const res = synthesize(rows, examples);
    console.log("TEST 3 SYNTH:", res.rule?.source);

    expect(res.rule).toBeDefined();
    const expectedPrefix = [
      "125",
      "80",
      "1450",
      "9",
      "12500",
      ["42,50", "42"],
      "0",
      "880",
      "100000",
    ];

    for (let i = 0; i < rows.length; i++) {
      const exp = expectedPrefix[i];
      if (Array.isArray(exp)) {
        expect(exp).toContain(res.values[i]);
      } else {
        expect(res.values[i]).toBe(exp);
      }
    }
  });

  it("Test 4 : Concurrence de nombres (ignorer les données parasites)", () => {
    const rows = [
      "Dossier n° 458 reçu le 12/01/2026",
      "Dossier n° 9012 reçu le 15/01/2026",
      "Dossier n° 77 reçu le 18/01/2026",
      "Dossier n° 604 reçu le 22/01/2026",
      "Dossier n° 12055 reçu le 01/02/2026",
      "Dossier n° 3 reçu le 05/02/2026",
      "Dossier n° 98112 reçu le 10/02/2026",
      "Dossier n° 4401 reçu le 14/02/2026",
      "Dossier n° 890 reçu le 28/02/2026",
    ];

    const examples = [
      "458",
      "9012",
      "77",
      null, null, null, null, null, null,
    ];

    const expectedAll = [
      "458",
      "9012",
      "77",
      "604",
      "12055",
      "3",
      "98112",
      "4401",
      "890",
    ];

    const res = synthesize(rows, examples);
    console.log("TEST 4 SYNTH:", res.rule?.source);

    expect(res.rule).toBeDefined();
    for (let i = 0; i < rows.length; i++) {
      expect(res.values[i]).toBe(expectedAll[i]);
    }
  });

  it("Test 5 : Numéro structuré avec format strict (cas NIR / Sécurité Sociale avec 2A/2B Corse)", () => {
    const rows = [
      "NIR: 1 85 05 75 112 345 67",
      "NIR: 2 92 11 69 456 789 01",
      "NIR: 1 78 03 33 890 123 45",
      "NIR: 2 01 07 13 234 567 89",
      "NIR: 1 95 12 59 678 901 23",
      "NIR: 2 88 09 92 345 678 90",
      "NIR: 1 65 04 2A 123 456 78",
      "NIR: 2 00 10 99 876 543 21",
      "NIR: 1 99 08 31 111 222 33",
    ];

    const examples = [
      "1 85 05 75 112 345 67",
      "2 92 11 69 456 789 01",
      "1 78 03 33 890 123 45",
      null, null, null, null, null, null,
    ];

    const expectedAll = [
      "1 85 05 75 112 345 67",
      "2 92 11 69 456 789 01",
      "1 78 03 33 890 123 45",
      "2 01 07 13 234 567 89",
      "1 95 12 59 678 901 23",
      "2 88 09 92 345 678 90",
      "1 65 04 2A 123 456 78",
      "2 00 10 99 876 543 21",
      "1 99 08 31 111 222 33",
    ];

    const res = synthesize(rows, examples);
    console.log("TEST 5 SYNTH:", res.rule?.source);

    expect(res.rule).toBeDefined();
    for (let i = 0; i < rows.length; i++) {
      expect(res.values[i]).toBe(expectedAll[i]);
    }
  });
});
