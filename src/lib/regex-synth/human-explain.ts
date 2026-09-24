import { explain } from "./explain";
import { type Rule, describeTransform } from "./engine";

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

  const transformDesc = describeTransform(rule.transform);
  const appendTransform = (text: string) => {
    if (!transformDesc) return text;
    // Harmonisation ponctuation
    const clean = text.endsWith(".") ? text.slice(0, -1) : text;
    return `${clean}, puis applique : ${transformDesc}.`;
  };

  const p = rule.pattern || rule.source;

  // 1. Remplacement / Substitution explicite
  if (rule.replacement !== undefined) {
    const repl = rule.replacement;
    let base = "";

    // 1.1 Remplacement vide (suppression)
    if (repl === "") {
      base = "Supprime les occurrences correspondant au motif dans le texte.";
    }
    // 1.2 Ajout de préfixe constant (ex: "REF-$1")
    else if (/^(.*?)\$1$/.test(repl) && !repl.slice(0, -2).includes("$")) {
      const prefix = repl.slice(0, -2);
      base = `Ajoute le préfixe « ${prefix} » au début du texte.`;
    }
    // 1.3 Ajout de suffixe constant (ex: "$1-SUF")
    else if (/^\$1(.*?)$/.test(repl) && !repl.slice(2).includes("$")) {
      const suffix = repl.slice(2);
      base = `Ajoute le suffixe « ${suffix} » à la fin du texte.`;
    }
    // 1.4 Inversion de 2 éléments (ex: "$2 $1", "$2$1", "$2, $1")
    else if (/^\$2(\s*[,;/ -]?\s*)\$1$/.test(repl)) {
      const sep = repl.match(/^\$2(\s*[,;/ -]?\s*)\$1$/)?.[1] ?? " ";
      const sepLabel = sep === " " ? "une espace" : sep === "" ? "aucun séparateur" : `« ${sep} »`;
      base = `Inverse l'ordre des deux éléments ($2 puis $1) séparés par ${sepLabel} (ex : « Nom, Prénom » devient « Prénom Nom »).`;
    }
    // 1.5 Inversion de date / 3 éléments (ex: "$3/$2/$1", "$3-$2-$1")
    else if (/^\$3([/.-])\$2\1\$1$/.test(repl)) {
      const sep = repl[2] ?? "/";
      base = `Reformate la date sous le format JJ${sep}MM${sep}AAAA ($3${sep}$2${sep}$1) en inversant l'année et le jour.`;
    }
    // 1.6 Combinaison 1ère et dernière partie (ex: "$1$2", "$1-$2")
    else if (/^\$1(.*?)\$2$/.test(repl) && !repl.slice(2, -2).includes("$")) {
      const sep = repl.slice(2, -2);
      const sepText = sep ? ` reliés par « ${sep} »` : "";
      base = `Conserve le début ($1) et la fin ($2) du texte${sepText}.`;
    }
    // 1.7 Substitution générale avec formule
    else {
      base = `Remplace les correspondances du motif par la formule de substitution « ${repl} ».`;
    }

    return appendTransform(base);
  }

  // 2. Délimités par champs (ex: FEC ou CSV : ^(?:[^|]*\|){k}\s*([^|]+?)\s*(?:\||$))
  const delimitedMatch = p.match(/\{\s*(\d+)\s*\}/);
  if (delimitedMatch && (p.includes("|") || p.includes(";") || p.includes("\t") || p.includes(","))) {
    const index = Number(delimitedMatch[1]) + 1;
    const sep = p.includes("|") ? "|" : p.includes(";") ? ";" : p.includes("\t") ? "tabulation" : ",";
    const base = `Extrait le ${index}ᵉ champ délimité par « ${sep} »${columnName ? ` (correspondant à « ${columnName} »)` : ""}.`;
    return appendTransform(base);
  }

  // 3. Découpage fidèle grâce au parser de tokens explain()
  const segments = explain(p, rule.replacement);

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
      return appendTransform(`Extrait ${what} ${accord} après « ${cleanPrefix} » et avant « ${cleanSuffix} ».`);
    }
    if (cleanPrefix) {
      return appendTransform(`Extrait ${what} ${accord} immédiatement après « ${cleanPrefix} ».`);
    }
    if (cleanSuffix) {
      return appendTransform(`Extrait ${what} ${accord} juste avant « ${cleanSuffix} ».`);
    }
    if (what !== "le texte") {
      return appendTransform(`Extrait ${what} correspondant au motif.`);
    }
  }

  return appendTransform(`Extrait automatiquement le motif correspondant à « ${columnName || "la colonne"} ».`);
}
