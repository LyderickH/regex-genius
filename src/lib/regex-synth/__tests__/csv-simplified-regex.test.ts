import { describe, it, expect } from "vitest";
import { synthesize } from "../engine";

describe("Synthèse simplifiée & élégante sur CSV (anti-verbiage)", () => {
  it("extrait le Customer ID sans générer une regex inutilement complexe", () => {
    const inputs = [
      "1,DD37Cf93aecA6Dc,Sheryl,Baxter,Rasmussen Group,East Leonard,Chile,229.077.5154,397.884.0519x718,zui",
      "2,1Ef7b82A4CAAD10,Preston,Lozano,Vega-Gentry,East Jimmychester,Djibouti,5153435776,686-620-1820x944",
      "3,6F94879bDAFE5a6,Roy,Berry,Murillo-Perry,Isabelborough,Antigua and Barbuda,+1-539-402-0259,(496)97",
      "4,5Cef88FA16c5e3c,Linda,Olsen,Dominguez,Bensonview,Dominican Republic,001-8",
      "5,053d585Ab6b3159,Joanna,Bender,Martin,West Priscilla,Slovakia",
    ];
    const expected = [
      "DD37Cf93aecA6Dc",
      null,
      null,
      null,
      null,
    ];

    const res = synthesize(inputs, expected);
    expect(res.rule).not.toBeNull();
    // Ne doit PAS contenir de quantificateur verbeux inutile comme {1} ou lazy non nécessaire
    expect(res.rule?.source).not.toContain("{1}");
    expect(res.rule?.source).not.toContain("(?:,|$)");

    // Doit correspondre à une expression naturelle et concise
    expect(res.rule?.source).toMatch(/,([^,]+),|,(\w+)|^[^,]+,([^,]+)/);

    // Vérifie que toutes les lignes sont correctement extraites
    expect(res.values[1]).toBe("1Ef7b82A4CAAD10");
    expect(res.values[2]).toBe("6F94879bDAFE5a6");
    expect(res.values[3]).toBe("5Cef88FA16c5e3c");
    expect(res.values[4]).toBe("053d585Ab6b3159");
    expect(res.matched).toBe(5);
  });
});
