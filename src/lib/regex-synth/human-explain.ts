import { explain } from "./explain";
import type { Rule } from "./engine";

/**
 * Nettoie une chaîne de regex (retire les échappements superflus) pour un affichage lisible.
 */
function cleanLiteral(str: string): string {
  return str
    .replace(/\\s[+*]?/g, " ")                // convertit \s+ ou \s* en espace
    .replace(/\\([\[\](){}.*+?^$|\\])/g, "$1") // dé-échappe les caractères réservés
    .replace(/^\^|\$$/g, "")                  // retire les ancres ^ et $
    .replace(/^(\.\*|\.\*\?|\.\+)/, "")       // retire les jokers initiaux .* ou .*?
    .replace(/(\.\*|\.\*\?|\.\+)$/, "")       // retire les jokers finaux .* ou .*?
    .trim();
}

/**
 * Produit une explication humaine concise et fidèle aux tokens réels de la regex.
 */
export function explainRegexHuman(
  rule: Rule | null,
  columnName?: string,
): string {
  if (!rule) return "Aucun motif défini.";

  if (rule.llmMetadata?.explanation) {
    return rule.llmMetadata.explanation;
  }

  const p = rule.pattern || rule.source;

  // 1. Délimités par champs (ex: FEC ou CSV : ^(?:[^|]*\|){k}\s*([^|]+?)\s*(?:\||$))
  const delimitedMatch = p.match(/\{\s*(\d+)\s*\}/);
  if (delimitedMatch && (p.includes("|") || p.includes(";") || p.includes("\t") || p.includes(","))) {
    const index = Number(delimitedMatch[1]) + 1;
    const sep = p.includes("|") ? "|" : p.includes(";") ? ";" : p.includes("\t") ? "tabulation" : ",";
    return `Extrait le ${index}ᵉ champ délimité par « ${sep} »${columnName ? ` (correspondant à « ${columnName} »)` : ""}.`;
  }

  // 2. Découpage fidèle grâce au parser de tokens explain()
  const segments = explain(p);

  // Recherche du groupe de capture principal '(' et ')'
  const openIdx = segments.findIndex((s) => s.text === "(");
  const closeIdx = segments.findLastIndex ? segments.findLastIndex((s) => s.text === ")") : segments.map(s => s.text).lastIndexOf(")");

  if (openIdx !== -1 && closeIdx !== -1 && closeIdx > openIdx) {
    // Préfixe : tous les segments avant '('
    const rawPrefix = segments.slice(0, openIdx).map((s) => s.text).join("");
    const cleanPrefix = cleanLiteral(rawPrefix);

    // Contenu capturé : entre '(' et ')'
    const rawCapture = segments.slice(openIdx + 1, closeIdx).map((s) => s.text).join("");

    let what = "le texte";
    let accord = "situé";

    if (/\\d|\d|0-9/.test(rawCapture) && !/[a-zA-Z]/.test(rawCapture)) {
      what = "les chiffres";
      accord = "situés";
    } else if (/€|\$|EUR|USD/.test(p) || /montant|prix|debit|credit/i.test(columnName ?? "")) {
      what = "le montant numérique";
      accord = "situé";
    } else if (/@/.test(p) || /email|courriel/i.test(columnName ?? "")) {
      what = "l'adresse e-mail";
      accord = "située";
    } else if (/\d{2}[./-]\d{2}[./-]\d{4}/.test(p)) {
      what = "la date";
      accord = "située";
    }

    // Suffixe : tous les segments après ')'
    const rawSuffix = segments.slice(closeIdx + 1).map((s) => s.text).join("");
    const cleanSuffix = cleanLiteral(rawSuffix);

    if (cleanPrefix && cleanSuffix) {
      return `Extrait ${what} ${accord} après « ${cleanPrefix} » et avant « ${cleanSuffix} ».`;
    }
    if (cleanPrefix) {
      return `Extrait ${what} ${accord} immédiatement après « ${cleanPrefix} ».`;
    }
    if (cleanSuffix) {
      return `Extrait ${what} ${accord} juste avant « ${cleanSuffix} ».`;
    }
    if (what !== "le texte") {
      return `Extrait ${what} correspondant au motif.`;
    }
  }

  // 3. Substitution / Remplacement
  if (rule.replacement !== undefined) {
    return `Reconnaît le motif et le remplace par « ${rule.replacement} ».`;
  }

  return `Extrait automatiquement le motif correspondant à « ${columnName || "la colonne"} ».`;
}
