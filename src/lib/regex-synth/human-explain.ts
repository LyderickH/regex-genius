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

  // 6. Paramètre de campagne d'URL (ex: utm_campaign)
  if (/utm_campaign|campaign|campagne/i.test(fullPattern) || /campagne|campaign/i.test(columnName ?? "")) {
    return {
      what: "le nom de campagne",
      accord: "situé",
      standalone: "Extrait le nom de campagne à partir du paramètre d'URL.",
    };
  }

  // 7. Statut HTTP ou code serveur
  if (/HTTP|status/i.test(fullPattern) || /statut|code_http/i.test(columnName ?? "")) {
    return {
      what: "le code de statut",
      accord: "situé",
      standalone: "Extrait le code de statut numérique de la requête.",
    };
  }

  // 8. Chiffres uniquement (ex: \d+, [0-9]+, [0-9]{3}, etc.)
  const noRegexMetas = rawCapture.replace(/\\d|\[0-9\]|\+|-|\*|\?|\{|\}|\d|\\s|\s/g, "");
  if (noRegexMetas.length === 0 && /(\\d|\[0-9\]|\d)/.test(rawCapture)) {
    return {
      what: "les chiffres",
      accord: "situés",
      standalone: "Extrait la séquence de chiffres correspondante.",
    };
  }

  // 9. Lettres uniquement (ex: [a-zA-Z]+)
  if (/^\[?[a-zA-Z\s-]+\]?[\+*]?$/.test(rawCapture)) {
    return {
      what: "les lettres ou mots",
      accord: "situés",
      standalone: "Extrait la séquence alphabétique (lettres et mots).",
    };
  }

  // 10. Alphanumérique / Identifiant (ex: [A-Za-z0-9_-]+)
  if (/0-9.*a-z|a-z.*0-9|\\w/i.test(rawCapture) && /\[.*\]/.test(rawCapture)) {
    const isNamedCol = columnName && !/^col\s*\d+$/i.test(columnName.trim()) && !/^colonne\s*\d+$/i.test(columnName.trim());
    return {
      what: isNamedCol ? `la valeur « ${columnName} » (identifiant alphanumérique)` : "l'identifiant alphanumérique",
      accord: "situé",
      standalone: "Extrait l'identifiant composé de lettres, chiffres ou tirets.",
    };
  }

  // 11. Négation de délimiteur (ex: [^,]+, [^|]+, [^\r\n]+, [^>]+)
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

  const isNamedCol = columnName && !/^col\s*\d+$/i.test(columnName.trim()) && !/^colonne\s*\d+$/i.test(columnName.trim());
  return {
    what: isNamedCol ? `la valeur « ${columnName} »` : "le texte",
    accord: "situé",
  };
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

  const transformDesc = rule.transform ? describeTransform(rule.transform) : null;
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

export interface TechnicalStep {
  label: string;
  detail: string;
  token?: string;
  technical?: string;
  human?: string;
}

export interface TechnicalExplanation {
  mechanism: string;
  steps: TechnicalStep[];
  assumptions: string[];
  summary: string;
}

export interface RegexFullAnalysis {
  technical: TechnicalExplanation;
  human: string;
}

/**
 * Analyse technique approfondie du motif : détaille le mécanisme,
 * les étapes pas-à-pas et les hypothèses de raisonnement pour identifier
 * où l'algorithme a pu se tromper et permettre une correction ciblée (par une autre IA ou un humain).
 */
export function explainRegexTechnical(
  rule: Rule | null,
  columnName?: string,
): TechnicalExplanation {
  if (!rule) {
    return {
      mechanism: "Aucun motif",
      steps: [],
      assumptions: [],
      summary: "Aucune expression régulière active.",
    };
  }

  const p = rule.source;
  const transformDesc = rule.transform ? describeTransform(rule.transform) : null;
  const steps: TechnicalStep[] = [];
  const assumptions: string[] = [];

  // 1. Cas Substitution / Remplacement multi-groupes
  if (rule.replacement !== undefined) {
    const repl = rule.replacement;
    const segments = explain(p, repl);

    let groupIdx = 0;
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].text === "(") {
        groupIdx++;
        let end = i + 1;
        let depth = 1;
        while (end < segments.length && depth > 0) {
          if (segments[end].text === "(") depth++;
          else if (segments[end].text === ")") depth--;
          end++;
        }
        const inner = segments.slice(i + 1, end - 1).map((s) => s.text).join("");
        steps.push({
          token: `(${inner})`,
          label: `Groupe capturant $${groupIdx}`,
          detail: `Capture la sous-chaîne pour la réinjecter dans la formule de substitution via $${groupIdx}.`,
          technical: `Groupe de capture parenthésé ($${groupIdx}) contenant « ${inner} ».`,
          human: `Isole le fragment numéro ${groupIdx} pour le repositionner lors du remplacement.`,
        });
      }
    }

    steps.push({
      token: repl,
      label: "Formule de substitution",
      detail: `Réassemble les groupes capturés selon le schéma : « ${repl} ».`,
      technical: `Gabarit de remplacement réinjectant les variables $1, $2... selon le motif « ${repl} ».`,
      human: `Recompose la chaîne finale en agençant les fragments capturés dans l'ordre voulu.`,
    });

    if (transformDesc) {
      steps.push({
        token: "Post-traitement",
        label: "Normalisation finale",
        detail: `Applique la transformation : ${transformDesc}.`,
        technical: `Fonction de transformation javascript appliquée après l'extraction regex.`,
        human: `Nettoie ou formate la valeur extraite (${transformDesc}).`,
      });
    }

    assumptions.push("Structure ordonnée stricte : suppose que chaque ligne respecte la disposition exacte de tous les groupes.");
    if (p.includes(",") || p.includes(";") || p.includes("-") || p.includes("/")) {
      assumptions.push("Dépendance aux séparateurs : suppose que les délimiteurs de substitution sont rigoureusement présents sur chaque ligne.");
    }

    return {
      mechanism: "Substitution et recomposition multi-groupes (input.replace)",
      steps,
      assumptions,
      summary: `Découpe la chaîne en ${groupIdx} fragments via des groupes de capture () et les réassemble selon « ${repl} ».`,
    };
  }

  // 2. Cas Délimité par colonnes répétitives (FEC, TSV, CSV)
  const delimitedMatch = p.match(/\{\s*(\d+)\s*\}/);
  if (delimitedMatch && (p.includes("|") || p.includes(";") || p.includes("\t") || p.includes(","))) {
    const n = Number(delimitedMatch[1]);
    const sep = p.includes("|") ? "|" : p.includes(";") ? ";" : p.includes("\t") ? "\t" : ",";
    const sepName = sep === "|" ? "barre verticale « | »" : sep === ";" ? "point-virgule « ; »" : sep === "\t" ? "tabulation" : "virgule « , »";

    steps.push({
      token: "^",
      label: "Ancrage initial",
      detail: "La recherche commence impérativement au tout premier caractère de la ligne.",
      technical: "Ancre début de ligne (^)",
      human: "Garantit le comptage des colonnes depuis le début absolu de la ligne",
    });

    steps.push({
      token: `(?:[^\\${sep}]*\\${sep}){${n}}`,
      label: "Saut des colonnes initiales",
      detail: `Consomme et ignore les ${n} premières colonnes délimitées par une ${sepName}.`,
      technical: `Répétition de ${n} groupes non-capturants pour passer les délimiteurs ${sep}`,
      human: `Passe les ${n} premières colonnes sans les enregistrer pour arriver à la colonne voulue`,
    });

    if (p.includes("\\s*")) {
      steps.push({
        token: "\\s*",
        label: "Espaces ignorés",
        detail: "Ignore les espaces ou blancs facultatifs au début de la colonne ciblée.",
        technical: "Classe \\s avec quantificateur * (0 ou plusieurs espaces)",
        human: "Nettoie les éventuels espaces de marge avant la valeur",
      });
    }

    steps.push({
      token: `([^\\${sep}]+?)`,
      label: "Capture de la colonne (Groupe 1)",
      detail: `Capture de façon non-gourmande (+?) tout le texte de la ${n + 1}ᵉ colonne jusqu'au délimiteur suivant.`,
      technical: `Négation de classe [^${sep}]+? (lecture non-gloutonne jusqu'au ${sep})`,
      human: `Extrait la valeur complète de la ${n + 1}ᵉ colonne`,
    });

    steps.push({
      token: `(?:\\${sep}|$)`,
      label: "Clôture de la cellule",
      detail: `Vérifie que la valeur est immédiatement suivie d'une ${sepName} ou de la fin de ligne.`,
      technical: `Alternative non-capturante entre délimiteur ${sep} ou fin de ligne $`,
      human: "S'assure que la cellule est bien terminée",
    });

    if (transformDesc) {
      steps.push({
        token: "Post-traitement",
        label: "Normalisation finale",
        detail: `Applique la transformation : ${transformDesc}.`,
      });
    }

    assumptions.push(`Position fixe de colonne : Suppose que l'information recherchée est TOUJOURS située dans la ${n + 1}ᵉ colonne.`);
    assumptions.push(`Sensibilité au délimiteur : Échouera immédiatement si une ligne contient moins de ${n + 1} colonnes ou un séparateur différent.`);
    assumptions.push(`Absence de délimiteur interne : Si une colonne précédente contient une ${sepName} à l'intérieur d'un texte entre guillemets, le comptage des colonnes sera faussé.`);

    return {
      mechanism: `Indexation de colonne par délimiteur répétitif (${n + 1}ᵉ champ)`,
      steps,
      assumptions,
      summary: `Compte ${n} occurrences du délimiteur ${sepName} depuis le début de ligne, puis extrait le contenu de la colonne suivante.`,
    };
  }

  // 3. Cas Contextuel classique (Préfixe -> Capture Groupe 1 -> Suffixe)
  const segments = explain(p);
  const openIdx = segments.findIndex((s) => s.text === "(");
  let closeIdx = -1;
  for (let idx = segments.length - 1; idx >= 0; idx--) {
    if (segments[idx]?.text === ")") {
      closeIdx = idx;
      break;
    }
  }

  if (p.startsWith("^")) {
    steps.push({
      token: "^",
      label: "Ancrage de début de ligne",
      detail: "La correspondance doit démarrer obligatoirement au début de la ligne.",
      technical: "Ancre début de chaîne (^)",
      human: "Oblige la détection à s'aligner sur le tout premier caractère de la ligne",
    });
  }

  if (openIdx > (p.startsWith("^") ? 1 : 0)) {
    const rawPrefix = segments.slice(p.startsWith("^") ? 1 : 0, openIdx).map((s) => s.text).join("");
    const cleanP = cleanLiteral(rawPrefix);
    steps.push({
      token: rawPrefix,
      label: "Texte repère avant la valeur (préfixe)",
      detail: `Repère « ${cleanP || rawPrefix} » situé juste avant la valeur à extraire.`,
      technical: `Correspondance littérale avec le motif « ${cleanP || rawPrefix} »`,
      human: `Sert d'ancre de départ pour situer où commence l'information cible`,
    });
    if (cleanP) {
      assumptions.push(`Dépendance au préfixe : Suppose que la valeur est précédée de « ${cleanP} » sur chaque ligne.`);
    }
  }

  if (openIdx !== -1 && closeIdx > openIdx) {
    const rawCapture = segments.slice(openIdx + 1, closeIdx).map((s) => s.text).join("");
    const { what } = describeCaptureContent(rawCapture, p, columnName);

    let captureDetail = `Extrait ${what}.`;
    let technical = "Groupe de capture parenthésé (...) constituant le résultat $1.";
    let human = `Isole et extrait la donnée cible (${what}).`;

    if (/\\d\+/.test(rawCapture)) {
      captureDetail = "Extrait une suite continue de chiffres (nombre, identifiant ou code).";
      technical = "Classe numérique \\d avec quantificateur + (au moins un chiffre décimal).";
      human = "Capture les chiffres constituant le nombre, l'identifiant ou le code statut.";
      assumptions.push("Hypothèse numérique : Suppose que la valeur cible est composée uniquement de chiffres.");
    } else if (rawCapture.includes("[^")) {
      const excluded = rawCapture.match(/\[\^([^\]]+)\]/)?.[1] ?? "";
      captureDetail = `Extrait tous les caractères jusqu'au délimiteur « ${excluded} ».`;
      technical = `Négation de classe [^${excluded}]+ : capture sans déborder sur le délimiteur « ${excluded} ».`;
      human = `Prend l'intégralité du texte de la cellule jusqu'au séparateur suivant.`;
      assumptions.push(`Arrêt au délimiteur : La capture s'arrête au premier caractère « ${excluded} ».`);
    } else if (rawCapture === ".*" || rawCapture === ".+") {
      captureDetail = "Extrait le texte jusqu'au repère suivant.";
      technical = "Quantificateur glouton prenant tous les caractères intermédiaires.";
      human = "Prend tout le contenu textuel situé entre le préfixe et le suffixe.";
      assumptions.push("Quantificateur gourmand : Le motif '.*' prend tout le texte possible jusqu'au suffixe.");
    } else {
      technical = `Classe de caractères [${rawCapture.replace(/[[\]()]/g, "")}] répétée avec le quantificateur +.`;
      human = `Extrait la séquence alphanumérique correspondante.`;
    }

    steps.push({
      token: `(${rawCapture})`,
      label: "Valeur extraite (Groupe 1)",
      detail: captureDetail,
      technical,
      human,
    });
  }

  if (closeIdx !== -1 && closeIdx < segments.length - 1) {
    const rawSuffix = segments.slice(closeIdx + 1, p.endsWith("$") ? segments.length - 1 : segments.length).map((s) => s.text).join("");
    const cleanS = cleanLiteral(rawSuffix);
    if (rawSuffix.trim()) {
      steps.push({
        token: rawSuffix,
        label: "Texte repère après la valeur (suffixe)",
        detail: `S'arrête dès qu'il rencontre « ${cleanS || rawSuffix} » juste après la valeur.`,
        technical: `Correspondance littérale avec le délimiteur « ${cleanS || rawSuffix} »`,
        human: `Marque la borne d'arrêt pour ne pas capturer le reste de la ligne`,
      });
      if (cleanS) {
        assumptions.push(`Dépendance au suffixe : Suppose la présence de « ${cleanS} » immédiatement après la valeur.`);
      }
    }
  }

  if (p.endsWith("$")) {
    steps.push({
      token: "$",
      label: "Fin de ligne ($)",
      detail: "La correspondance doit aller jusqu'au bout de la ligne.",
      technical: "Ancre fin de chaîne ($)",
      human: "Exige que la règle corresponde jusqu'à la fin de la ligne",
    });
  }

  if (transformDesc) {
    steps.push({
      token: "Post-traitement",
      label: "Normalisation finale",
      detail: `Applique la transformation : ${transformDesc}.`,
    });
  }

  if (!p.startsWith("^") && !p.endsWith("$") && steps.length <= 2) {
    assumptions.push("Recherche flottante : Extrait la première occurrence correspondant au motif dans la ligne.");
  }

  return {
    mechanism: "Extraction contextuelle (repères de texte)",
    steps,
    assumptions: assumptions.length > 0 ? assumptions : ["Suppose que la structure observée sur les exemples est identique sur toutes les lignes."],
    summary: `Isole la valeur cible via son contexte immédiat dans la ligne textuelle.`,
  };
}

/**
 * Analyse complète d'une règle regex : technique détaillée + résumé humain.
 */
export function analyzeRegexFull(
  rule: Rule | null,
  columnName?: string,
): RegexFullAnalysis {
  return {
    technical: explainRegexTechnical(rule, columnName),
    human: explainRegexHuman(rule, columnName),
  };
}
