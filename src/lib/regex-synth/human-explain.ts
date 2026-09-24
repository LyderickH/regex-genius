import type { Rule } from "./engine";

/**
 * Produit une explication humaine concise (1 phrase) de ce que la regex extrait ou transforme.
 */
export function explainRegexHuman(
  rule: Rule | null,
  columnName?: string,
): string {
  if (!rule) return "Aucun motif défini.";

  // Si le LLM a déjà fourni une explication courte
  if (rule.llmMetadata?.explanation) {
    return rule.llmMetadata.explanation;
  }

  const p = rule.pattern || rule.source;

  // Délimités par champs (ex: FEC ou CSV : ^(?:[^|]*\|){k}\s*([^|]+?)\s*(?:\||$))
  const delimitedMatch = p.match(/\{\s*(\d+)\s*\}/);
  if (delimitedMatch && (p.includes("|") || p.includes(";") || p.includes("\t") || p.includes(","))) {
    const index = Number(delimitedMatch[1]) + 1;
    const sep = p.includes("|") ? "|" : p.includes(";") ? ";" : p.includes("\t") ? "tabulation" : ",";
    return `Extrait le ${index}ᵉ champ délimité par « ${sep} »${columnName ? ` (correspondant à « ${columnName} »)` : ""}.`;
  }

  // Paramètre d'URL (ex: utm_campaign=([A-Za-z0-9/_-]+))
  const urlParamMatch = p.match(/([a-zA-Z0-9_-]+)=/);
  if (urlParamMatch) {
    return `Extrait la valeur associée au paramètre d'URL « ${urlParamMatch[1]} ».`;
  }

  // Délimiteurs chevrons < ... >
  if (/<([^>]+)>/.test(p)) {
    return "Extrait le texte situé entre les chevrons « < » et « > » (adresse e-mail ou identifiant).";
  }

  // Délimiteurs crochets doubles [[ ... ]]
  if (/\[\[|\\\[\\\[/.test(p)) {
    return "Extrait le texte contenu entre les doubles crochets « [[ » et « ]] ».";
  }

  // Délimiteurs crochets simples échappés \[ ... \]
  if (/\\\[([^\\\]]+)\\\]/.test(p)) {
    return "Extrait le texte contenu entre les crochets « [ » et « ] ».";
  }

  // Délimiteurs guillemets " ... "
  if (/"([^"]+)"/.test(p)) {
    return "Extrait le texte situé entre guillemets.";
  }

  // Format date JJ/MM/AAAA ou AAAA-MM-JJ
  if (/\d{2}[./-]\d{2}[./-]\d{4}/.test(p) || /\d{4}-\d{2}-\d{2}/.test(p)) {
    return "Extrait une date calendaire standard (jour, mois, année).";
  }

  // Format IBAN
  if (/FR\d{2}/i.test(p) || /iban/i.test(columnName ?? "")) {
    return "Extrait un numéro de compte bancaire IBAN (structure normalisée).";
  }

  // Format NIR / Numéro de Sécurité Sociale
  if (/NIR/i.test(p) || /securite/i.test(columnName ?? "") || /nir/i.test(columnName ?? "")) {
    return "Extrait le numéro d'immatriculation de Sécurité Sociale (NIR).";
  }

  // Format Montant / Devise
  if (/€|\$|EUR|USD/i.test(p) || /montant|prix|debit|credit/i.test(columnName ?? "")) {
    return "Extrait le montant numérique avec ses séparateurs de milliers et décimales.";
  }

  // Format code postal
  if (/\b\d{5}\b/.test(p)) {
    return "Extrait un code postal à 5 chiffres.";
  }

  // Format Email
  if (/@/.test(p)) {
    return "Extrait une adresse e-mail valide.";
  }

  // Substitution / Remplacement
  if (rule.replacement !== undefined) {
    return `Capture les éléments correspondants et les reformate selon le modèle « ${rule.replacement} ».`;
  }

  // Recherche d'un préfixe et d'un suffixe
  const capIdx = p.indexOf("(");
  const endCapIdx = p.lastIndexOf(")");
  if (capIdx > 0 && endCapIdx > capIdx) {
    const rawPrefix = p.slice(0, capIdx).replace(/\\/g, "").replace(/\^/g, "").trim();
    const rawSuffix = p.slice(endCapIdx + 1).replace(/\\/g, "").replace(/\$/g, "").trim();
    if (rawPrefix && rawSuffix) {
      return `Extrait la valeur située après « ${rawPrefix} » et avant « ${rawSuffix} ».`;
    }
    if (rawPrefix) {
      return `Extrait la valeur située immédiatement après « ${rawPrefix} ».`;
    }
    if (rawSuffix) {
      return `Extrait la valeur située juste avant « ${rawSuffix} ».`;
    }
  }

  return `Extrait automatiquement le motif textuel correspondant à « ${columnName || "la colonne"} ».`;
}
