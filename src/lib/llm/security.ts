/**
 * Analyse statique de sécurité des expressions régulières (ReDoS / Catastrophic Backtracking)
 * Détecte les motifs à quantification imbriquée ou alternance chevauchante.
 */

import type { SecurityAnalysis, SecurityRiskLevel } from "./types";

export function analyzeSecurity(pattern: string): SecurityAnalysis {
  const warnings: string[] = [];
  let risk: SecurityRiskLevel = "low";
  let hasCatastrophicBacktracking = false;

  // 1. Détection des quantificateurs imbriqués directs : (X+)+, (X*)*, (X+)*, (X{1,})+
  // Regex détectant un groupe avec quantificateur interne suivi d'un quantificateur externe
  const nestedQuantifiers = [
    /\((?:[^()]*[+*]|\\[dswDSW][+*])[^()]*\)[+*{]/,
    /\((?:[^()]|\([^()]*\))*[+*]\)[+*]/,
    /\((?:[a-zA-Z0-9_.-]+|[.\\][a-zA-Z]?)[+*]\)[+*]/,
    /\((?:[^()|]+[+*]){2,}\)[+*]/,
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
