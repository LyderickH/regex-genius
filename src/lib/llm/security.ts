/**
 * Analyse statique de sécurité des expressions régulières (ReDoS / Catastrophic Backtracking)
 * Inspiré des principes de FlashRegex et de l'analyse d'automates finis déterministes.
 * Détecte et neutralise les motifs à quantification imbriquée ou alternance chevauchante.
 */

import type { SecurityAnalysis, SecurityRiskLevel } from "./types";

/**
 * Nettoie et neutralise les motifs ReDoS évidents sans altérer la sémantique de capture.
 * Ex: `(?:[^|]+)+` -> `(?:[^|]+)`
 * Ex: `(?:.*)*` -> `(?:.*)`
 */
export function sanitizeReDoS(pattern: string): string {
  let sanitized = pattern;

  // 1. Aplatir les quantificateurs imbriqués simples : ((X+)+) -> (X+)
  sanitized = sanitized.replace(/\(([^()]+[+*])\)[+*]/g, "($1)");

  // 2. Éliminer les jokers gloutons répétés consécutifs : .*.* -> .*
  sanitized = sanitized.replace(/(?:\.\*){2,}/g, ".*");
  sanitized = sanitized.replace(/(?:\.\+){2,}/g, ".+");

  return sanitized;
}

export function analyzeSecurity(pattern: string): SecurityAnalysis {
  const warnings: string[] = [];
  let risk: SecurityRiskLevel = "low";
  let hasCatastrophicBacktracking = false;

  // 1. Détection des quantificateurs imbriqués directs : (X+)+, (X*)*, (X+)*, (X+){1,}
  // Attention : une répétition fixe telle que {8} ou {2} n'est pas variable et ne produit pas de backtracking exponentiel.
  const nestedQuantifiers = [
    /\((?:[^()]*[+*]|\\[dswDSW][+*])[^()]*\)(?:[+*]|{\s*\d+\s*,\s*(?:\d+)?\s*})/,
    /\((?:[^()]|\([^()]*\))*[+*]\)[+*]/,
    /\((?:[a-zA-Z0-9_.-]+|[.\\][a-zA-Z]?)[+*]\)[+*]/,
    /\((?:[^()|]+[+*]){2,}\)(?:[+*]|{\s*\d+\s*,\s*(?:\d+)?\s*})/,
  ];

  for (const regex of nestedQuantifiers) {
    if (regex.test(pattern)) {
      warnings.push("Quantification imbriquée détectée (ex: (a+)+ ou (.*)*), risque élevé de backtracking catastrophique.");
      risk = "high";
      hasCatastrophicBacktracking = true;
      break;
    }
  }

  // 2. Détection de quantificateurs avides non ancrés multiples avec points : .*.* ou .+.*
  if (/(?:\.\*|\.\+){2,}/.test(pattern)) {
    warnings.push("Multiples jokers gloutons consécutifs (.*.*) pouvant causer une dégradation des performances.");
    if (risk === "low") risk = "medium";
  }

  // 3. Détection d'alternances chevauchantes quantifiées : (a|a)+ ou (\d|[0-9])+
  const overlappingPattern = /\((?:([a-zA-Z0-9])\|\1)\)[+*]/;
  if (overlappingPattern.test(pattern)) {
    warnings.push("Alternance redondante quantifiée pouvant provoquer un dédoublement des branches d'exploration.");
    if (risk !== "high") risk = "medium";
  }

  // 4. Test d'exécution rapide avec timeout pour vérifier la résistance au backtracking
  if (risk === "high" || risk === "medium") {
    try {
      const re = new RegExp(pattern);
      const evilInput = "a".repeat(30) + "!";
      const start = performance.now();
      re.test(evilInput);
      const elapsed = performance.now() - start;
      if (elapsed > 50) {
        risk = "high";
        warnings.push(`Temps d'exécution suspect sur chaîne adverse (${Math.round(elapsed)}ms).`);
      }
    } catch {
      // Ignorer si l'entrée adverse n'est pas applicable
    }
  }

  return {
    risk,
    warnings,
    hasCatastrophicBacktracking,
  };
}

export function sanitizeAndCheckReDoS(pattern: string): {
  pattern: string;
  analysis: SecurityAnalysis;
} {
  const sanitized = sanitizeReDoS(pattern);
  const analysis = analyzeSecurity(sanitized);
  return { pattern: sanitized, analysis };
}
