/**
 * Construction des prompts système et utilisateur pour le LLM local,
 * et parsing strict de la réponse JSON.
 */

import type { ExamplePair, NegativeExample, RegexCandidate, RegexValidation } from "./types";

export const SYSTEM_PROMPT = `Tu es un moteur de synthèse d'expressions régulières JavaScript de haute précision.
Ta tâche est de déduire une expression régulière (compatible JavaScript RegExp) capable d'extraire la valeur attendue pour chaque exemple positif, tout en rejetant les exemples négatifs.

RÈGLES FONDAMENTALES :
1. Cherche une règle générale qui explique la structure des exemples plutôt que de mémoriser individuellement les valeurs.
2. Si une extraction précise est demandée, utilise des parenthèses de capture () autour de la sous-chaîne cible (Groupe 1).
3. Utilise une syntaxe purement compatible JavaScript RegExp (par exemple \\d, \\w, [A-Z], etc.).
4. N'entoure JAMAIS le champ "pattern" de délimiteurs /.../. Fournis uniquement l'intérieur de la regex.
5. Respecte TOUS les exemples positifs sans exception.
6. Rejette TOUS les exemples négatifs.
7. Évite les quantificateurs imbriqués dangereux (ex: (a+)+, (.*)*) pour prévenir le backtracking catastrophique (ReDoS).

FORMAT STRICT DE SORTIE :
Tu dois répondre UNIQUEMENT par un objet JSON valide, sans aucune balise Markdown (pas de \`\`\`json), sans texte avant ni après.

Structure JSON obligatoire :
{
  "pattern": "votre_regex_ici",
  "flags": "",
  "explanation": "explication concise de la règle en français",
  "confidence": 0.95
}`;

/**
 * Construit le message utilisateur initial à partir des exemples
 */
export function buildInitialPrompt(
  positiveExamples: ExamplePair[],
  negativeExamples: NegativeExample[] = [],
  contextName?: string,
): string {
  // Limiter à max 12 exemples représentatifs pour économiser le contexte
  const sampledPositives = positiveExamples.slice(0, 12);
  const sampledNegatives = negativeExamples.slice(0, 8);

  let prompt = `CONTEXTE DE SYNTHÈSE${contextName ? ` (Colonne: ${contextName})` : ""} :\n\n`;

  prompt += `EXEMPLES POSITIFS (l'expression doit capturer ou correspondre à la valeur cible) :\n`;
  sampledPositives.forEach((ex, idx) => {
    prompt += `  ${idx + 1}. Entrée: "${ex.input}"  -->  Valeur attendue: "${ex.expected}"\n`;
  });

  if (sampledNegatives.length > 0) {
    prompt += `\nEXEMPLES NÉGATIFS (l'expression ne doit PAS correspondre à ces lignes) :\n`;
    sampledNegatives.forEach((neg, idx) => {
      prompt += `  ${idx + 1}. Entrée interdite: "${neg.input}"\n`;
    });
  }

  prompt += `\nOBJECTIF :
Trouve l'expression régulière JavaScript la plus propre et générale possible qui extrait exactement la valeur attendue pour chaque exemple positif (idéalement via le groupe de capture 1).
Réponds UNIQUEMENT par l'objet JSON requis.`;

  return prompt;
}

/**
 * Construit le prompt de correction pour la boucle de rétroaction
 */
export function buildCorrectionPrompt(
  candidate: RegexCandidate | null,
  validation: RegexValidation,
  positiveExamples: ExamplePair[],
  negativeExamples: NegativeExample[] = [],
): string {
  let prompt = `Ta proposition précédente a échoué aux tests algorithmiques automatisés.\n\n`;

  if (candidate) {
    prompt += `REGEX TESTÉE :
  pattern: "${candidate.pattern}"
  flags: "${candidate.flags}"\n\n`;
  }

  prompt += `ERREURS DÉTECTÉES PAR LE VALIDATEUR :\n`;
  validation.errors.forEach((err, idx) => {
    prompt += `  - ${err}\n`;
  });

  if (validation.failedExamples && validation.failedExamples.length > 0) {
    prompt += `\nDÉTAIL DES ÉCHECS SUR LES DONNÉES :\n`;
    validation.failedExamples.slice(0, 5).forEach((fail) => {
      if (fail.type === "positive") {
        prompt += `  * Entrée: "${fail.input}" | Attendu: "${fail.expected}" | Obtenu: ${
          fail.got === null ? "aucun match" : `"${fail.got}"`
        }\n`;
      } else {
        prompt += `  * Entrée interdite reconnue à tort: "${fail.input}"\n`;
      }
    });
  }

  prompt += `\nINSTRUCTION DE CORRECTION :
Corrige l'expression régulière en tenant compte précisément de ces erreurs.
Assure-toi que la nouvelle expression fonctionne pour TOUS les exemples positifs et rejette les exemples négatifs.
Réponds UNIQUEMENT avec l'objet JSON corrigé (aucun Markdown).`;

  return prompt;
}

/**
 * Parse strictement la réponse JSON du LLM, en gérant le cas où le modèle
 * encapsule dans des blocs de code markdown ```json ... ```.
 */
export function parseCandidateJSON(raw: string): RegexCandidate | null {
  if (!raw || typeof raw !== "string") return null;

  // Nettoyage des balises markdown éventuelles
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  // Trouver le premier { et le dernier }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== "object") return null;

    let pattern = parsed.pattern;
    if (typeof pattern !== "string" || pattern.length === 0) return null;

    // Supprimer les délimiteurs /.../ si le modèle les a inclus par erreur
    if (pattern.startsWith("/") && pattern.endsWith("/")) {
      pattern = pattern.slice(1, -1);
    }

    const flags = typeof parsed.flags === "string" ? parsed.flags.replace(/[^gimsuy]/g, "") : "";
    const explanation = typeof parsed.explanation === "string" ? parsed.explanation : "Motif synthétisé";
    const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.8;

    return {
      pattern,
      flags,
      explanation,
      confidence,
    };
  } catch {
    return null;
  }
}
