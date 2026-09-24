import { describe, it, expect } from "vitest";
import { synthesize } from "../engine";
import { DIALECTS } from "../dialects";

describe("Programme Crash-Tests (Robustesse aux variations extrêmes)", () => {
  const excel = DIALECTS.find((d) => d.id === "excel")!;

  // -------------------------------------------------------------------------
  // 1. Les pièges de saisie humaine
  // -------------------------------------------------------------------------
  describe("1. Les pièges de saisie humaine", () => {
    it("gère les espaces multiples ou insécables (double espace, nbsp)", () => {
      const inputs = [
        "Facture   1042  -  urgent",
        "Facture 1043 - normal",
        "Facture\u00a0\u00a01044\u00a0-\u00a0urgent",
        "Facture   1045  -  différé", // Ligne de test
      ];
      const expected = ["1042", "1043", "1044", null];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      expect(res.values[3]).toBe("1045");
      expect(res.matched).toBe(4);
    });

    it("gère la casse aléatoire (IBAN/Codes minuscules vs majuscules)", () => {
      const inputs = [
        "iban: fr76 3000 6000 0112 3456 7890 189 pour loyer",
        "IBAN: FR76 3000 6000 0112 3456 7890 189 pour loyer",
        "Iban: Fr76 1000 2000 0112 3456 7890 189 virement",
        "IBAN: fr76 9999 8888 0112 3456 7890 189 test", // Ligne de test
      ];
      const expected = [
        "fr76 3000 6000 0112 3456 7890 189",
        "FR76 3000 6000 0112 3456 7890 189",
        "Fr76 1000 2000 0112 3456 7890 189",
        null,
      ];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      expect(res.values[3]).toBe("fr76 9999 8888 0112 3456 7890 189");
      expect(res.matched).toBe(4);
    });

    it("gère les espaces en début/fin de sélection utilisateur (nettoyage/trim)", () => {
      const inputs = [
        "Ref: [ VALEUR_ALPHA ] fin",
        "Ref: [ VALEUR_BETA ] fin",
        "Ref: [ VALEUR_GAMMA ] fin",
        "Ref: [ VALEUR_DELTA ] fin", // Ligne de test
      ];
      // L'utilisateur a sélectionné sans les espaces de marge
      const expected = ["VALEUR_ALPHA", "VALEUR_BETA", "VALEUR_GAMMA", null];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      expect(res.values[3]).toBe("VALEUR_DELTA");
      expect(res.matched).toBe(4);
    });

    it("gère les séparateurs de date mixtes (point, tiret, slash)", () => {
      const inputs = [
        "Date: 01.02-2026 fin",
        "Date: 15/03/2026 fin",
        "Date: 28-04.2026 fin",
        "Date: 09/05-2026 fin", // Ligne de test
      ];
      const expected = ["01.02-2026", "15/03/2026", "28-04.2026", null];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      expect(res.values[3]).toBe("09/05-2026");
      expect(res.matched).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Les formats numériques sales
  // -------------------------------------------------------------------------
  describe("2. Les formats numériques sales", () => {
    it("gère les nombres négatifs ou entre parenthèses comptables (1 250,00 €)", () => {
      const inputs = [
        "Résultat : (1 250,00 €) validé",
        "Résultat : (320,50 €) validé",
        "Résultat : (45,00 €) validé",
        "Résultat : (980,10 €) validé", // Ligne de test
      ];
      const expected = ["(1 250,00 €)", "(320,50 €)", "(45,00 €)", null];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      expect(res.values[3]).toBe("(980,10 €)");
      expect(res.matched).toBe(4);
    });

    it("gère l'alternance point vs virgule décimale", () => {
      const inputs = [
        "Prix: 12.50 EUR",
        "Prix: 14,80 EUR",
        "Prix: 9.99 EUR",
        "Prix: 105,25 EUR", // Ligne de test
      ];
      const expected = ["12.50", "14,80", "9.99", null];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      expect(res.values[3]).toBe("105,25");
      expect(res.matched).toBe(4);
    });

    it("gère les pourcentages collés ou avec espace optionnel (15% vs 20 %)", () => {
      const inputs = [
        "Remise de 15% appliquée",
        "Remise de 20 % appliquée",
        "Remise de 5% appliquée",
        "Remise de 30 % appliquée", // Ligne de test
      ];
      const expected = ["15%", "20 %", "5%", null];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      expect(res.values[3]).toBe("30 %");
      expect(res.matched).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Les caractères réservés et le texte exotique
  // -------------------------------------------------------------------------
  describe("3. Les caractères réservés et le texte exotique", () => {
    it("gère les caractères réservés regex dans la donnée ([PROD]+#12)", () => {
      const inputs = [
        "Ref: [PROD]+#12 (v2)",
        "Ref: [TEST]+#45 (v1)",
        "Ref: [DEV]+#99 (v3)",
        "Ref: [STAGE]+#08 (v2)", // Ligne de test
      ];
      const expected = ["[PROD]+#12", "[TEST]+#45", "[DEV]+#99", null];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      expect(res.values[3]).toBe("[STAGE]+#08");
      expect(res.matched).toBe(4);
    });

    it("gère les accents, cédilles et prénoms composés français (Éléonore-François)", () => {
      const inputs = [
        "Prénom : Éléonore-François (Validé)",
        "Prénom : Jean-Noël (Validé)",
        "Prénom : Françoise-Hélène (Validé)",
        "Prénom : Benoît-Marie (Validé)", // Ligne de test
      ];
      const expected = ["Éléonore-François", "Jean-Noël", "Françoise-Hélène", null];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      expect(res.values[3]).toBe("Benoît-Marie");
      expect(res.matched).toBe(4);
    });

    it("gère les apostrophes typographiques courbes vs droites (l'accord vs l’accord)", () => {
      const inputs = [
        "Titre: l’accord de paix",
        "Titre: l'accord d'entreprise",
        "Titre: l’accord cadre",
        "Titre: l'accord final", // Ligne de test
      ];
      const expected = ["l’accord", "l'accord", "l’accord", null];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      expect(res.values[3]).toBe("l'accord");
      expect(res.matched).toBe(4);
    });

    it("gère les guillemets imbriqués et la formule Excel correspondante", () => {
      const inputs = [
        'Livre "L\'Étranger" lu',
        'Livre "Le Petit Prince" lu',
        'Livre "Germinal" lu',
        'Livre "Les Misérables" lu', // Ligne de test
      ];
      const expected = ["L'Étranger", "Le Petit Prince", "Germinal", null];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      expect(res.values[3]).toBe("Les Misérables");
      expect(res.matched).toBe(4);

      // Vérification que les guillemets dans la formule Excel sont bien doublés
      const formula = excel.snippet(res.rule!.source, "texte", "fr");
      expect(formula).toContain('""');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Les tentatives de « hack » et cas limites
  // -------------------------------------------------------------------------
  describe("4. Les tentatives de « hack » et cas limites", () => {
    it("tolère les lignes où la cible est absente (retourne null sans planter)", () => {
      const inputs = [
        "ID: #1001 valide",
        "Ligne de commentaire sans id",
        "ID: #1002 valide",
        "Autre texte",
      ];
      const expected = ["1001", null, "1002", null];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      expect(res.values[0]).toBe("1001");
      expect(res.values[1]).toBeNull();
      expect(res.values[2]).toBe("1002");
      expect(res.values[3]).toBeNull();
    });

    it("extrait un segment sans délimiteur évident au milieu d'une chaîne (ABC123XYZ456 -> 123)", () => {
      const inputs = [
        "ABC123XYZ456",
        "DEF789XYZ123",
        "GHI456XYZ999",
        "JKL042XYZ777", // Ligne de test
      ];
      const expected = ["123", "789", "456", null];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      expect(res.values[3]).toBe("042");
      expect(res.matched).toBe(4);
    });

    it("neutralise les injections regex dans les exemples sans exécuter de métacaractères", () => {
      const inputs = [
        "Code: .* test",
        "Code: (\\d+) test",
        "Code: [a-z]+ test",
        "Code: ^.*$ test", // Ligne de test
      ];
      // L'utilisateur sélectionne exactement la chaîne de métacaractères regex
      const expected = [".*", "(\\d+)", "[a-z]+", null];

      const res = synthesize(inputs, expected);
      expect(res.rule).not.toBeNull();
      expect(res.values[3]).toBe("^.*$");
      expect(res.matched).toBe(4);
    });
  });
});
