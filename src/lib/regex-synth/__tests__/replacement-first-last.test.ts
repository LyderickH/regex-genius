import { describe, it, expect } from "vitest";
import { synthesize } from "../engine";

describe("Synthèse par remplacement (Multi-fragments / Première et dernière lettre)", () => {
  it("déduit la règle de première et dernière lettre pour cacar -> cr", () => {
    const inputs = [
      "cacar",
      "ezfdfg",
      "sfdsfdsf",
      "sfdsfsdf",
      "gdfgre",
      "zefezfez",
      "sfdsfsd",
      "dfdsfzef",
      "dfsdfdsf",
      "ersdfsd",
    ];

    const expected = [
      "cr",
      "eg",
      "sf",
      "sf",
      "ge",
      "zz",
      "sd",
      "df",
      null, // Ligne à compléter automatiquement
      null, // Ligne à compléter automatiquement
    ];

    const res = synthesize(inputs, expected);

    expect(res.rule).not.toBeNull();
    expect(res.rule?.replacement).toBeDefined();
    expect(res.rule?.replacement).toBe("$1$2");
    expect(res.values[0]).toBe("cr");
    expect(res.values[1]).toBe("eg");
    expect(res.values[4]).toBe("ge");
    expect(res.values[5]).toBe("zz");

    // Doit avoir complété automatiquement les lignes 8 et 9 !
    // dfsdfdsf -> df
    expect(res.values[8]).toBe("df");
    // ersdfsd -> ed
    expect(res.values[9]).toBe("ed");

    expect(res.matched).toBe(10);
    expect(res.failures.length).toBe(0);
  });

  it("déduit la règle de première et dernière lettre avec séparateur constant cacar -> c:r", () => {
    const inputs = ["cacar", "ezfdfg", "gdfgre", "ersdfsd"];
    const expected = ["c:r", "e:g", null, null];

    const res = synthesize(inputs, expected);

    expect(res.rule).not.toBeNull();
    expect(res.rule?.replacement).toBe("$1:$2");
    expect(res.values[2]).toBe("g:e");
    expect(res.values[3]).toBe("e:d");
  });

  it("déduit l'inversion de tokens délimités (Nom, Prénom -> Prénom Nom)", () => {
    const inputs = ["Doe, John", "Smith, Alice", "Dupont, Jean"];
    const expected = ["John Doe", "Alice Smith", null];

    const res = synthesize(inputs, expected);

    expect(res.rule).not.toBeNull();
    expect(res.rule?.replacement).toBe("$2 $1");
    expect(res.values[2]).toBe("Jean Dupont");
  });

  it("déduit la conversion de date YYYY-MM-DD -> DD/MM/YYYY par capture et remplacement", () => {
    const inputs = ["2024-05-18", "2023-11-02", "2022-01-30"];
    const expected = ["18/05/2024", "02/11/2023", null];

    const res = synthesize(inputs, expected);

    expect(res.rule).not.toBeNull();
    expect(res.rule?.replacement).toBe("$3/$2/$1");
    expect(res.values[2]).toBe("30/01/2022");
  });
});
