import { describe, it, expect } from "vitest";
import { synthesize } from "../engine";
import { DIALECTS } from "../dialects";

describe("Programme complet de banc d'essai métier (9 cas réels)", () => {
  const excel = DIALECTS.find((d) => d.id === "excel")!;

  // -------------------------------------------------------------------------
  // 1. Finance & Comptabilité
  // -------------------------------------------------------------------------
  describe("1. Finance & Comptabilité", () => {
    it("Cas F1 : Extraction d'IBAN (formatage hétérogène)", () => {
      const inputs = [
        "Virement FR76 3000 6000 0112 3456 7890 189 pour loyer",
        "Rbt FR7630006000011234567890189 SEPA",
        "DE89 3704 0044 0532 0130 00 fact 441",
        "Prelevement FR76 1001 2002 3004 5006 7008 901 EDF", // Généralisation
      ];
      const expected = [
        "FR76 3000 6000 0112 3456 7890 189",
        "FR7630006000011234567890189",
        "DE89 3704 0044 0532 0130 00",
        null,
      ];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      console.log("BENCHMARK F1:", {
        rule: res.rule?.source,
        extra: res.rule?.extra?.map((e) => e.source),
        excelFR: excel.snippet(res.rule!.source, "texte", "fr", res.rule?.replacement),
        genVal: res.values[3],
      });
      expect(res.values[3]).toBe("FR76 1001 2002 3004 5006 7008 901");
      expect(res.matched).toBe(4);
    });

    it("Cas F2 : Extraction de montants avec devises et séparateurs FR/EN", () => {
      const inputs = [
        "Facture n°102 : 12 450,50 € TTC",
        "Solde débiteur : 320,00 € à régler",
        "Avoir client : 1 200,99 € (validé)",
        "Total à payer : 89,10 € TTC", // Généralisation
      ];
      const expected = [
        "12 450,50 €",
        "320,00 €",
        "1 200,99 €",
        null,
      ];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      console.log("BENCHMARK F2:", {
        rule: res.rule?.source,
        excelFR: excel.snippet(res.rule!.source, "texte", "fr", res.rule?.replacement),
        genVal: res.values[3],
      });
      expect(res.values[3]).toBe("89,10 €");
      expect(res.matched).toBe(4);
    });

    it("Cas F3 : Numéros de factures avec préfixes variables", () => {
      const inputs = [
        "CMD-4412 / FACT-2026-00481 / CLIENT-9",
        "CMD-108 / FACT-2025-01290 / CLIENT-12",
        "CMD-9901 / FACT-2026-00003 / CLIENT-3",
        "CMD-8812 / FACT-2024-09811 / CLIENT-1", // Généralisation
      ];
      const expected = [
        "FACT-2026-00481",
        "FACT-2025-01290",
        "FACT-2026-00003",
        null,
      ];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      console.log("BENCHMARK F3:", {
        rule: res.rule?.source,
        excelFR: excel.snippet(res.rule!.source, "texte", "fr", res.rule?.replacement),
        genVal: res.values[3],
      });
      expect(res.values[3]).toBe("FACT-2024-09811");
      expect(res.matched).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Domaine RH & Paie
  // -------------------------------------------------------------------------
  describe("2. Domaine RH & Paie", () => {
    it("Cas R1 : Numéro de Sécurité Sociale (NIR français)", () => {
      const inputs = [
        "Dossier Dupont NIR: 1 85 03 75 112 045 88 reçu",
        "Dossier Martin NIR: 2 92 11 69 452 101 42 reçu",
        "Dossier Bernard NIR: 1 78 08 13 021 349 19 reçu",
        "Dossier Petit NIR: 2 01 05 33 210 541 63 reçu", // Généralisation
      ];
      const expected = [
        "1 85 03 75 112 045 88",
        "2 92 11 69 452 101 42",
        "1 78 08 13 021 349 19",
        null,
      ];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      console.log("BENCHMARK R1:", {
        rule: res.rule?.source,
        excelFR: excel.snippet(res.rule!.source, "texte", "fr", res.rule?.replacement),
        genVal: res.values[3],
      });
      expect(res.values[3]).toBe("2 01 05 33 210 541 63");
      expect(res.matched).toBe(4);
    });

    it("Cas R2 : Parsing d'adresse email professionnelle", () => {
      const inputs = [
        "Contact : jean-pierre.dupont@entreprise.fr (Directeur)",
        "Contact : marie.curie@lab-recherche.org (RH)",
        "Contact : a.le-gall@holding.co.uk (Externe)",
        "Contact : lucas.martin-pecheur@startup.io (Dev)", // Généralisation
      ];
      const expected = [
        "jean-pierre.dupont@entreprise.fr",
        "marie.curie@lab-recherche.org",
        "a.le-gall@holding.co.uk",
        null,
      ];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      console.log("BENCHMARK R2:", {
        rule: res.rule?.source,
        excelFR: excel.snippet(res.rule!.source, "texte", "fr", res.rule?.replacement),
        genVal: res.values[3],
      });
      expect(res.values[3]).toBe("lucas.martin-pecheur@startup.io");
      expect(res.matched).toBe(4);
    });

    it("Cas R3 : Période de paie / Dates contractuelles", () => {
      const inputs = [
        "Bulletin de paie du 01/01/2026 au 31/01/2026 - Cadre",
        "Bulletin de paie du 15/02/2026 au 28/02/2026 - Non cadre",
        "Bulletin de paie du 01/03/2026 au 15/03/2026 - Stagiaire",
        "Bulletin de paie du 01/09/2026 au 30/09/2026 - CDD", // Généralisation
      ];
      const expected = [
        "01/01/2026 au 31/01/2026",
        "15/02/2026 au 28/02/2026",
        "01/03/2026 au 15/03/2026",
        null,
      ];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      console.log("BENCHMARK R3:", {
        rule: res.rule?.source,
        excelFR: excel.snippet(res.rule!.source, "texte", "fr", res.rule?.replacement),
        genVal: res.values[3],
      });
      expect(res.values[3]).toBe("01/09/2026 au 30/09/2026");
      expect(res.matched).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Domaine Data & Web Ops
  // -------------------------------------------------------------------------
  describe("3. Domaine Data & Web Ops", () => {
    it("Cas D1 : Logs serveur (Code statut HTTP)", () => {
      const inputs = [
        '192.168.1.1 - - [24/Sep/2026:12:00:01] "GET /api/v1/users" 200 4521',
        '10.0.0.15 - - [24/Sep/2026:12:00:02] "POST /auth/login" 401 128',
        '172.16.254.1 - - [24/Sep/2026:12:00:03] "GET /health" 200 12',
        '192.168.0.50 - - [24/Sep/2026:12:00:04] "DELETE /api/items/8" 500 892', // Généralisation
      ];
      const expected = ["200", "401", "200", null];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      console.log("BENCHMARK D1:", {
        rule: res.rule?.source,
        excelFR: excel.snippet(res.rule!.source, "texte", "fr", res.rule?.replacement),
        genVal: res.values[3],
      });
      expect(res.values[3]).toBe("500");
      expect(res.matched).toBe(4);
    });

    it("Cas D2 : UUID v4", () => {
      const inputs = [
        "event_id=4a3b8c12-9e21-4f1a-8b9a-112233445566&status=ok",
        "event_id=987fcdeb-51a2-4321-ba98-fedcba098765&status=error",
        "event_id=f47ac10b-58cc-4372-a567-0e02b2c3d479&status=retry",
        "event_id=c9a646d3-9c61-4cd7-9f51-7521e69f6449&status=ok", // Généralisation
      ];
      const expected = [
        "4a3b8c12-9e21-4f1a-8b9a-112233445566",
        "987fcdeb-51a2-4321-ba98-fedcba098765",
        "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        null,
      ];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      console.log("BENCHMARK D2:", {
        rule: res.rule?.source,
        excelFR: excel.snippet(res.rule!.source, "texte", "fr", res.rule?.replacement),
        genVal: res.values[3],
      });
      expect(res.values[3]).toBe("c9a646d3-9c61-4cd7-9f51-7521e69f6449");
      expect(res.matched).toBe(4);
    });

    it("Cas D3 : Paramètres d'URL (utm_campaign)", () => {
      const inputs = [
        "https://site.fr/page?utm_source=google&utm_campaign=black_friday_26&ref=4",
        "https://site.fr/page?utm_campaign=summer_sale&utm_medium=cpc",
        "https://site.fr/page?lang=fr&utm_campaign=retargeting_q3",
        "https://site.fr/page?utm_campaign=newsletter_sept26&user=88", // Généralisation
      ];
      const expected = [
        "black_friday_26",
        "summer_sale",
        "retargeting_q3",
        null,
      ];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      console.log("BENCHMARK D3:", {
        rule: res.rule?.source,
        excelFR: excel.snippet(res.rule!.source, "texte", "fr", res.rule?.replacement),
        genVal: res.values[3],
      });
      expect(res.values[3]).toBe("newsletter_sept26");
      expect(res.matched).toBe(4);
    });
  });
});
