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
 * Analyse le contenu de la capture regex pour déterminer précisément sa nature sémantique.
 */
function describeCaptureContent(
  rawCapture: string,
  fullPattern: string,
  columnName?: string,
): { what: string; accord: string; standalone?: string } {
  // 1. Adresse IP IPv4 : 4 blocs de chiffres séparés par des points
  const dotParts = rawCapture.split(/\\?\./);
  if (dotParts.length === 4 && dotParts.every((p) => /\\d|\[0-9\]|\d/.test(p))) {
    return {
      what: "l'adresse IP",
      accord: "située",
      standalone: "Extrait une adresse IP (4 blocs de chiffres séparés par des points).",
    };
  }

  // 2. Date : 3 blocs de chiffres séparés par / ou - ou .
  const dateParts = rawCapture.split(/[\/\-]|\\?\./);
  if (dateParts.length === 3 && dateParts.every((p) => /\\d|\[0-9\]|\d/.test(p))) {
    const isIso = rawCapture.includes("-");
    const fmt = isIso ? "AAAA-MM-JJ" : "JJ/MM/AAAA";
    return {
      what: "la date",
      accord: "située",
      standalone: `Extrait une date au format ${fmt}.`,
    };
  }

  // 3. Horaire : 2 ou 3 blocs de chiffres séparés par :
  const timeParts = rawCapture.split(/:/);
  if ((timeParts.length === 2 || timeParts.length === 3) && timeParts.every((p) => /\\d|\[0-9\]|\d/.test(p))) {
    return {
      what: "l'horaire",
      accord: "situé",
      standalone: "Extrait l'horaire (heures et minutes).",
    };
  }

  // 4. Adresse e-mail
  if (/@/.test(rawCapture) || (/@/.test(fullPattern) && /email|courriel|mail/i.test(columnName ?? ""))) {
    return {
      what: "l'adresse e-mail",
      accord: "située",
      standalone: "Extrait l'adresse e-mail correspondant au format standard (utilisateur@domaine).",
    };
  }

  // 5. Montant monétaire
  if (/€|\$|EUR|USD/.test(fullPattern) || /montant|prix|debit|credit|solde/i.test(columnName ?? "")) {
    return {
      what: "le montant numérique",
      accord: "situé",
      standalone: "Extrait le montant numérique et sa devise.",
    };
  }

  // 6. Chiffres uniquement (ex: \d+, [0-9]+, [0-9]{3}, etc.)
  const noRegexMetas = rawCapture.replace(/\\d|\[0-9\]|\+|-|\*|\?|\{|\}|\d|\\s|\s/g, "");
  if (noRegexMetas.length === 0 && /(\\d|\[0-9\]|\d)/.test(rawCapture)) {
    return {
      what: "les chiffres",
      accord: "situés",
      standalone: "Extrait la séquence de chiffres correspondante.",
    };
  }

  // 7. Lettres uniquement (ex: [a-zA-Z]+)
  if (/^\[?[a-zA-Z\s-]+\]?[\+*]?$/.test(rawCapture)) {
    return {
      what: "les lettres ou mots",
      accord: "situés",
      standalone: "Extrait la séquence alphabétique (lettres et mots).",
    };
  }

  // 8. Alphanumérique / Identifiant (ex: [A-Za-z0-9_-]+)
  if (/0-9.*a-z|a-z.*0-9|\\w/i.test(rawCapture) && /\[.*\]/.test(rawCapture)) {
    return {
      what: "l'identifiant alphanumérique",
      accord: "situé",
      standalone: "Extrait l'identifiant composé de lettres, chiffres ou tirets.",
    };
  }

  // 9. Négation de délimiteur (ex: [^,]+, [^|]+, [^\r\n]+, [^>]+)
  const negMatch = rawCapture.match(/\[\^([^\]]+)\]/);
  if (negMatch) {
    const excluded = negMatch[1]?.replace(/\\r|\\n/g, "").replace(/\\/g, "");
    if (excluded && excluded.length > 0 && excluded !== "\r\n") {
      return {
        what: `le texte jusqu'au délimiteur « ${excluded} »`,
        accord: "situé",
        standalone: `Extrait la valeur textuelle jusqu'au prochain « ${excluded} ».`,
      };
    }
  }

  return { what: "le texte", accord: "situé" };
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
    const clean = text.endsWith(".") ? text.slice(0, -1) : text;
    return `${clean}, puis applique : ${transformDesc}.`;
  };

  const p = rule.source;

  // 1. Remplacement / Substitution explicite
  if (rule.replacement !== undefined) {
    const repl = rule.replacement;
    let base = "";

    if (repl === "") {
      base = "Supprime les occurrences correspondant au motif dans le texte.";
    } else if (/^(.*?)\$1$/.test(repl) && !repl.slice(0, -2).includes("$")) {
      const prefix = repl.slice(0, -2);
      base = `Ajoute le préfixe « ${prefix} » au début du texte.`;
    } else if (/^\$1(.*?)$/.test(repl) && !repl.slice(2).includes("$")) {
      const suffix = repl.slice(2);
      base = `Ajoute le suffixe « ${suffix} » à la fin du texte.`;
    } else if (/^\$2(\s*[,;/ -]?\s*)\$1$/.test(repl)) {
      const sep = repl.match(/^\$2(\s*[,;/ -]?\s*)\$1$/)?.[1] ?? " ";
      const sepLabel = sep === " " ? "une espace" : sep === "" ? "aucun séparateur" : `« ${sep} »`;
      base = `Inverse l'ordre des deux éléments ($2 puis $1) séparés par ${sepLabel} (ex : « Nom, Prénom » devient « Prénom Nom »).`;
    } else if (/^\$3([/.-])\$2\1\$1$/.test(repl)) {
      const sep = repl[2] ?? "/";
      base = `Reformate la date sous le format JJ${sep}MM${sep}AAAA ($3${sep}$2${sep}$1) en inversant l'année et le jour.`;
    } else if (/^\$1(.*?)\$2$/.test(repl) && !repl.slice(2, -2).includes("$")) {
      const sep = repl.slice(2, -2);
      const sepText = sep ? ` reliés par « ${sep} »` : "";
      base = `Conserve le début ($1) et la fin ($2) du texte${sepText}.`;
    } else {
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
  let closeIdx = -1;
  for (let idx = segments.length - 1; idx >= 0; idx--) {
    if (segments[idx]?.text === ")") {
      closeIdx = idx;
      break;
    }
  }

  if (openIdx !== -1 && closeIdx !== -1 && closeIdx > openIdx) {
    // Préfixe : tous les segments avant '('
    const rawPrefix = segments.slice(0, openIdx).map((s) => s.text).join("");
    const cleanPrefix = cleanLiteral(rawPrefix);

    // Contenu capturé : entre '(' et ')'
    const rawCapture = segments.slice(openIdx + 1, closeIdx).map((s) => s.text).join("");

    // Analyse du contenu capturé
    const { what, accord, standalone } = describeCaptureContent(rawCapture, p, columnName);

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
    if (standalone) {
      return appendTransform(standalone);
    }
    if (what !== "le texte") {
      return appendTransform(`Extrait ${what} correspondant au motif.`);
    }
  }

  return appendTransform(`Extrait la séquence de texte correspondant au motif exact.`);
}
