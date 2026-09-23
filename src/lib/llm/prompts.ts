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
   Dans la chaîne JSON "pattern", double les barres obliques inverses si nécessaire (ex: "\\\\d+" ou classes comme "[0-9]+").
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
  unlabeledInputs: string[] = [],
): string {
  // Limiter à max 12 exemples représentatifs pour économiser le contexte
  const sampledPositives = positiveExamples.slice(0, 12);
  const sampledNegatives = negativeExamples.slice(0, 8);
  const sampledUnlabeled = unlabeledInputs.slice(0, 6);

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

  if (sampledUnlabeled.length > 0) {
    prompt += `\nAUTRES LIGNES DU FICHIER (la regex doit idéalement être assez générale pour extraire la même entité sur ces lignes) :\n`;
    sampledUnlabeled.forEach((line, idx) => {
      prompt += `  ${idx + 1}. Ligne: "${line}"\n`;
    });
  }

  prompt += `\nOBJECTIF :
Trouve l'expression régulière JavaScript la plus propre et générale possible qui extrait exactement la valeur attendue pour chaque exemple positif (idéalement via le groupe de capture 1).
Réponds UNIQUEMENT par l'objet JSON requis.`;

  return prompt;
}

/**
 * Construit le prompt de correction formel CEGIS (Counter-Example Guided Inductive Synthesis)
 * pour guider le LLM vers une résolution neuro-symbolique ciblée.
 */
export function buildCorrectionPrompt(
  candidate: RegexCandidate | null,
  validation: RegexValidation,
  positiveExamples: ExamplePair[],
  negativeExamples: NegativeExample[] = [],
): string {
  let prompt = `BOUCLE DE SYNTHÈSE GUIDÉE PAR CONTRE-EXEMPLES (CEGIS) :\n`;
  prompt += `La proposition précédente a été réfutée par le vérificateur algorithmique.\n\n`;

  if (candidate) {
    prompt += `HYPOTHÈSE PRÉCÉDENTE :
  pattern: "${candidate.pattern}"
  flags: "${candidate.flags}"\n\n`;
  }

  // 1. Isoler le contre-exemple minimal clé
  const firstFail = validation.failedExamples?.[0];
  if (firstFail) {
    prompt += `CONTRE-EXEMPLE MINIMAL À RÉSOUDRE EN PRIORITÉ :\n`;
    if (firstFail.type === "positive") {
      prompt += `  - Entrée : "${firstFail.input}"\n`;
      prompt += `  - Valeur attendue : "${firstFail.expected}"\n`;
      prompt += `  - Valeur obtenue avec ton motif : ${
        firstFail.got === null ? "null (aucun match)" : `"${firstFail.got}"`
      }\n`;
      prompt += `  -> DIAGNOSTIC : Ton motif est soit trop spécifique (ne matche pas cette variante), soit capture une mauvaise position.\n\n`;
    } else {
      prompt += `  - Entrée interdite qui a matché à tort : "${firstFail.input}"\n`;
      prompt += `  -> DIAGNOSTIC : Ton motif est trop laxiste et déborde sur des données indésirables.\n\n`;
    }
  }

  if (validation.security?.hasCatastrophicBacktracking) {
    prompt += `ALERTE SÉCURITÉ (ReDoS) :\n`;
    prompt += `  Ton motif précédent contient des quantifications imbriquées ou ambigües ((a+)+, (.*)*) provoquant un freeze du moteur.\n`;
    prompt += `  Utilise des quantificateurs déterministes et bornés.\n\n`;
  }

  if (validation.failedExamples && validation.failedExamples.length > 1) {
    prompt += `AUTRES CONTRE-EXEMPLES DÉTECTÉS :\n`;
    validation.failedExamples.slice(1, 5).forEach((fail) => {
      if (fail.type === "positive") {
        prompt += `  * Entrée: "${fail.input}" | Attendu: "${fail.expected}" | Obtenu: ${
          fail.got === null ? "aucun match" : `"${fail.got}"`
        }\n`;
      } else {
        prompt += `  * Entrée interdite acceptée à tort: "${fail.input}"\n`;
      }
    });
    prompt += `\n`;
  }

  prompt += `DIRECTIVE DE REFORMULATION :
1. Généralise ou ré-ancre la regex pour englober ce contre-exemple tout en maintenant la validité sur les autres exemples.
2. N'énumère pas de disjonctions de valeurs littérales (ex: ne pas faire (VALEUR1|VALEUR2)). Trouve la règle structurelle (séparateurs, classes de caractères).
3. Réponds UNIQUEMENT avec l'objet JSON requis.`;

  return prompt;
}

/**
 * Parse avec robustesse la réponse JSON du LLM, en gérant le cas où le modèle
 * omet d'échapper les barres obliques inverses regex (\d, \w...), ajoute des balises
 * markdown, ou répond sous une forme textuelle.
 */
export function parseCandidateJSON(raw: string): RegexCandidate | null {
  if (!raw || typeof raw !== "string") return null;

  let text = raw.trim();

  // 1. Nettoyage des balises markdown éventuelles
  if (text.includes("```")) {
    text = text.replace(/```(?:json)?([\s\S]*?)```/gi, "$1").trim();
  }

  const sanitizeCandidate = (
    pattern: string,
    flags = "",
    explanation = "Motif synthétisé",
    confidence = 0.8,
  ): RegexCandidate | null => {
    let pat = pattern.trim();
    if (!pat) return null;
    // Supprimer les délimiteurs /.../ si le modèle les a inclus
    if (pat.startsWith("/") && pat.length > 2) {
      const lastSlash = pat.lastIndexOf("/");
      if (lastSlash > 0) {
        flags = flags || pat.slice(lastSlash + 1);
        pat = pat.slice(1, lastSlash);
      }
    }
    const cleanFlags = flags.replace(/[^gimsuy]/g, "");
    return {
      pattern: pat,
      flags: cleanFlags,
      explanation,
      confidence: Math.max(0, Math.min(1, confidence)),
    };
  };

  // 2. Extraction du bloc JSON {...}
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonBlock = text.slice(firstBrace, lastBrace + 1);

    // Essai 2.1: JSON.parse direct
    try {
      const parsed = JSON.parse(jsonBlock);
      if (parsed && typeof parsed.pattern === "string") {
        const res = sanitizeCandidate(parsed.pattern, parsed.flags, parsed.explanation, parsed.confidence);
        if (res) return res;
      }
    } catch {}

    // Essai 2.2: Réparation des barres obliques inverses non échappées dans le JSON (\d, \s, \w, etc.)
    try {
      const sanitized = jsonBlock.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, "\\\\");
      const parsed = JSON.parse(sanitized);
      if (parsed && typeof parsed.pattern === "string") {
        const res = sanitizeCandidate(parsed.pattern, parsed.flags, parsed.explanation, parsed.confidence);
        if (res) return res;
      }
    } catch {}
  }

  // 3. Extraction par RegExp si le JSON est malformé mais contient "pattern": "..."
  const patMatch = text.match(/["']?pattern["']?\s*:\s*["']([^"'\r\n]+)["']/i);
  if (patMatch && patMatch[1]) {
    const flagsMatch = text.match(/["']?flags["']?\s*:\s*["']([gimsuy]*)["']/i);
    const explMatch = text.match(/["']?explanation["']?\s*:\s*["']([^"'\r\n]+)["']/i);
    const res = sanitizeCandidate(
      patMatch[1],
      flagsMatch ? flagsMatch[1] : "",
      explMatch ? explMatch[1] : "Motif synthétisé",
    );
    if (res) return res;
  }

  // 4. Extraction directe si le modèle a renvoyé un motif brut
  const rawPatMatch = text.match(/(?:pattern|regex)\s*[:=]\s*[`"']?([^\r\n`"']+)[`"']?/i);
  if (rawPatMatch && rawPatMatch[1]) {
    const res = sanitizeCandidate(rawPatMatch[1]);
    if (res) return res;
  }

  return null;
}
