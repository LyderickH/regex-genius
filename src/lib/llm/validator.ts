/**
 * Validation algorithmique indépendante des regex candidates produites par le LLM.
 * « Le LLM propose, les algorithmes vérifient. »
 */

import { analyzeSecurity, sanitizeReDoS } from "./security";
import type { ExamplePair, NegativeExample, RegexCandidate, RegexValidation } from "./types";

/**
 * Extrait la valeur d'une correspondance :
 * - Si le groupe 1 existe (capture), on utilise match[1].
 * - Sinon on utilise match[0] (correspondance totale).
 */
export function extractMatch(re: RegExp, input: string): string | null {
  const m = re.exec(input);
  if (!m) return null;
  return m[1] !== undefined ? m[1] : m[0];
}

/**
 * Valide rigoureusement une regex candidate contre :
 * 1. La syntaxe RegExp JS
 * 2. 100% des exemples positifs
 * 3. 100% des exemples négatifs (ne doivent pas correspondre)
 * 4. Les cas limites (détection du sur-ajustement et des valeurs vides)
 * 5. L'analyse de sécurité ReDoS
 */
export function validateCandidate(
  candidate: RegexCandidate,
  positiveExamples: ExamplePair[],
  negativeExamples: NegativeExample[] = [],
): RegexValidation {
  const errors: string[] = [];
  const failedExamples: RegexValidation["failedExamples"] = [];

  // Pré-nettoyage ReDoS automatique (FlashRegex)
  candidate.pattern = sanitizeReDoS(candidate.pattern);

  // Étape 1 : Compilation de la RegExp
  let re: RegExp;
  try {
    re = new RegExp(candidate.pattern, candidate.flags || undefined);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Erreur de syntaxe RegExp : ${msg}`);
    return {
      isValid: false,
      syntaxValid: false,
      positivePassed: 0,
      positiveTotal: positiveExamples.length,
      negativePassed: 0,
      negativeTotal: negativeExamples.length,
      edgeCasesPassed: 0,
      edgeCasesTotal: 0,
      security: { risk: "low", warnings: [], hasCatastrophicBacktracking: false },
      errors,
    };
  }

  // Étape 2 : Exemples positifs
  let positivePassed = 0;
  for (const ex of positiveExamples) {
    const extracted = extractMatch(re, ex.input);
    if (extracted === ex.expected) {
      positivePassed++;
    } else {
      failedExamples.push({
        type: "positive",
        input: ex.input,
        expected: ex.expected,
        got: extracted,
      });
      errors.push(
        `Échec sur exemple positif : pour l'entrée "${ex.input}", attendu "${ex.expected}" mais obtenu ${
          extracted === null ? "null (aucun match)" : `"${extracted}"`
        }`,
      );
    }
  }

  // Étape 3 : Exemples négatifs
  let negativePassed = 0;
  for (const neg of negativeExamples) {
    const matched = re.test(neg.input);
    if (!matched) {
      negativePassed++;
    } else {
      failedExamples.push({
        type: "negative",
        input: neg.input,
        got: extractMatch(re, neg.input),
      });
      errors.push(`Échec sur exemple négatif : l'entrée interdite "${neg.input}" a été reconnue à tort.`);
    }
  }

  // Étape 4 : Tests de cas limites (robustesse & sur-ajustement)
  let edgeCasesPassed = 0;
  let edgeCasesTotal = 0;

  // Cas limite A : Chaîne vide (ne doit pas extraire de fausse valeur sauf si attendu vide)
  edgeCasesTotal++;
  const emptyMatch = extractMatch(re, "");
  if (emptyMatch === null || positiveExamples.some((p) => p.input === "" && p.expected === emptyMatch)) {
    edgeCasesPassed++;
  } else {
    failedExamples.push({ type: "edge", input: "", got: emptyMatch });
    errors.push("Cas limite échoué : la chaîne vide '' a produit une extraction non souhaitée.");
  }

  // Cas limite B : Test de sur-ajustement (mémorisation littérale exacte)
  // Si le pattern est une chaîne littérale brute sans aucune classe de caractères, token ou quantification,
  // alors qu'il y a plusieurs exemples différents, c'est du sur-ajustement.
  const hasGeneralizationTokens = /[\d\w[\]+*?{}\\^$|]/.test(candidate.pattern);
  if (!hasGeneralizationTokens && positiveExamples.length > 1) {
    errors.push("Sur-ajustement détecté : le motif ne semble pas généraliser les cas.");
  }

  // Étape 5 : Analyse de sécurité ReDoS
  const security = analyzeSecurity(candidate.pattern);
  if (security.hasCatastrophicBacktracking) {
    errors.push("Rejet de sécurité : motif sujet à un backtracking catastrophique (ReDoS).");
  }

  const isValid =
    errors.length === 0 &&
    positivePassed === positiveExamples.length &&
    negativePassed === negativeExamples.length &&
    !security.hasCatastrophicBacktracking;

  return {
    isValid,
    syntaxValid: true,
    positivePassed,
    positiveTotal: positiveExamples.length,
    negativePassed,
    negativeTotal: negativeExamples.length,
    edgeCasesPassed,
    edgeCasesTotal,
    security,
    errors,
    failedExamples,
  };
}
