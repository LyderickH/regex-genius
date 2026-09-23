import { describe, it, expect } from "vitest";
import { synthesize } from "../engine";

const inputs = [
  "VIR SEPA RECU 15/01/2026 DE CLIENT ACME CORP - FACT F2026-0892 - REF CPT 411100 - MONTANT: 15420.50 EUR",
  "PRLV FOURN 28/01/2026 ORANGE BUSINESS FACT INV-99412 MONTANT 1250.00 EUR (COMPTE 401200)",
  "OD CLOTURE 31/01/2026 : PROV CHARGES A PAYER SUR CPT 408100 - PIECE 00-2026-014 - TOTAL 8400.00 EUR",
  "VIR EMIS 05/02/2026 FOURNISSEUR TECH CONSULTING - PIECE FACT-45120 - CPT 401100 - MONTANT 6300.00 EUR",
  "REGLEMENT SALAIRES JANVIER LE 30/01/2026 VIA CPT 421000 - REF PAYE-0126 - SOMME: 45890.12 EUR",
  "AVOIR RECU 12/02/2026 FOURN PAPETERIE LYON CPT 401300 - AV-8821 MONTANT 420.00 EUR",
  "ENCAISSEMENT CARTE 18/02/2026 VENTE COMMERCE - TICKET T-90812 SUR COMPTE 511500 - 325.80 EUR",
  "AVANCE DEPLACEMENT 22/02/2026 CPT 425000 AGENT DUPONT - NOTE NDF-2026-03 - 500.00 EUR",
  "REGLEMENT NOTE FRAIS 25/02/2026 SUR CPT 425100 - PIECE NF-7741 - MONTANT DE 1140.90 EUR",
  "VIR INTERNATIONAL RECU 27/02/2026 GLOBAL TRADING - INV-2026-104 - COMPTE 411200 - 28950.00 USD",
];

const expected = [
  "15,420.50",
  "1,250.00",
  "8,400.00",
  null,
  null,
  null,
  null,
  null,
  null,
  null,
];

describe("Synthèse montants avec séparateur de milliers", () => {
  it("extrait les nombres décimaux et applique le formatage de milliers US", () => {
    const res = synthesize(inputs, expected);
    expect(res.rule).not.toBeNull();
    expect(res.matched).toBe(10);
    expect(res.values[0]).toBe("15,420.50");
    expect(res.values[1]).toBe("1,250.00");
    expect(res.values[2]).toBe("8,400.00");
    expect(res.values[3]).toBe("6,300.00");
    expect(res.values[4]).toBe("45,890.12");
  });
});
