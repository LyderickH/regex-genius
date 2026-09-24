export interface Segment {
  text: string;
  kind: "literal" | "class" | "quant" | "anchor" | "group";
  label: string;
  categoryLabel?: string;
  detail?: string;
}

const CLASS_DESCRIPTIONS: Record<string, { label: string; category: string; detail: string }> = {
  "\\d": {
    label: "Un chiffre (0-9)",
    category: "Classe de caractères",
    detail: "Correspond à n'importe quel caractère numérique compris entre 0 et 9.",
  },
  "\\D": {
    label: "Tout sauf un chiffre",
    category: "Classe inversée",
    detail: "Correspond à n'importe quel caractère qui n'est pas un chiffre (inverse de \\d).",
  },
  "\\w": {
    label: "Caractère de mot alphanumérique",
    category: "Classe de caractères",
    detail: "Correspond à une lettre (a-z, A-Z), un chiffre (0-9) ou un tiret bas (_).",
  },
  "\\W": {
    label: "Caractère non-alphanumérique",
    category: "Classe inversée",
    detail: "Correspond aux espaces, signes de ponctuation ou caractères spéciaux.",
  },
  "\\s": {
    label: "Caractère d'espacement",
    category: "Classe de caractères",
    detail: "Correspond à une espace, une tabulation ou un saut de ligne.",
  },
  "\\S": {
    label: "Tout sauf une espace",
    category: "Classe inversée",
    detail: "Correspond à tout caractère visible ou imprimable (non-blanc).",
  },
  "\\b": {
    label: "Frontière de mot",
    category: "Ancre de limite",
    detail: "Marque la limite entre un mot et un caractère non-alphanumérique (évite de matcher au milieu d'un mot).",
  },
  "\\B": {
    label: "Non-frontière de mot",
    category: "Ancre de limite",
    detail: "Exige que la correspondance se situe à l'intérieur d'un mot et non à sa frontière.",
  },
  ".": {
    label: "N'importe quel caractère (joker)",
    category: "Caractère générique",
    detail: "Correspond à n'importe quel caractère unique à l'exception des sauts de ligne.",
  },
};

/** Découpe une expression régulière en segments expliqués en clair avec leur rôle technique et pédagogique. */
export function explain(source: string, replacement?: string): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  const push = (
    text: string,
    kind: Segment["kind"],
    label: string,
    categoryLabel?: string,
    detail?: string,
  ) => out.push({ text, kind, label, categoryLabel, detail });

  // Compter le nombre de groupes capturants pour adapter les libellés ($1, $2...)
  let totalCapturing = 0;
  for (let k = 0; k < source.length; k++) {
    if (source[k] === "(" && !source.startsWith("(?:", k) && (k === 0 || source[k - 1] !== "\\")) {
      totalCapturing++;
    }
  }

  const multiGroup = totalCapturing > 1 || replacement !== undefined;
  let openCount = 0;
  const groupStack: number[] = [];

  while (i < source.length) {
    const c = source[i];

    if (c === "^") {
      push(
        "^",
        "anchor",
        "Début de la ligne (^)",
        "Ancre de position",
        "Oblige la regex à chercher la correspondance dès le tout début de la chaîne textuelle.",
      );
      i++;
    } else if (c === "$") {
      push(
        "$",
        "anchor",
        "Fin de la ligne ($)",
        "Ancre de position",
        "Oblige la règle à correspondre jusqu'au tout dernier caractère de la ligne.",
      );
      i++;
    } else if (source.startsWith("(?:", i)) {
      push(
        "(?:",
        "group",
        "Début de groupe non-capturant (?:)",
        "Groupe contextuel",
        "Isole une suite d'éléments pour lui appliquer un quantificateur ou un OU sans extraire sa valeur.",
      );
      i += 3;
    } else if (c === "(") {
      openCount++;
      groupStack.push(openCount);
      push(
        "(",
        "group",
        multiGroup ? `Début du groupe de capture $${openCount}` : "Début de la valeur extraite",
        "Groupe de capture",
        "Ouvre la zone dont la valeur sera extraite et renvoyée dans votre colonne de résultat.",
      );
      i++;
    } else if (c === ")") {
      const num = groupStack.pop();
      push(
        ")",
        "group",
        multiGroup && num ? `Fin du groupe de capture $${num}` : "Fin de la valeur extraite",
        "Groupe de capture",
        "Ferme la zone de valeur capturée.",
      );
      i++;
    } else if (c === "[") {
      let j = i + 1;
      while (j < source.length && (source[j] !== "]" || source[j - 1] === "\\")) j++;
      const text = source.slice(i, j + 1);
      const neg = text.startsWith("[^");
      const inner = neg ? text.slice(2, -1) : text.slice(1, -1);
      push(
        text,
        "class",
        neg ? `Tout caractère sauf ${inner}` : `Un caractère parmi ${inner}`,
        neg ? "Classe de caractères inversée" : "Classe de caractères",
        neg
          ? `Correspond à tout caractère à l'exception stricte de : ${inner}.`
          : `Correspond à un unique caractère figurant dans la liste autorisée : ${inner}.`,
      );
      i = j + 1;
    } else if (c === "\\") {
      const text = source.slice(i, i + 2);
      if (CLASS_DESCRIPTIONS[text]) {
        const desc = CLASS_DESCRIPTIONS[text];
        push(text, "class", desc.label, desc.category, desc.detail);
      } else {
        const escapedChar = text[1] ?? "";
        push(
          text,
          "literal",
          `Caractère littéral « ${escapedChar} »`,
          "Symbole échappé",
          `L'antislash retire le pouvoir spécial du symbole pour chercher le vrai caractère « ${escapedChar} » dans le texte.`,
        );
      }
      i += 2;
    } else if (c === "{") {
      const j = source.indexOf("}", i);
      const text = source.slice(i, j + 1);
      const n = text.slice(1, -1);
      push(
        text,
        "quant",
        `Répété ${n} fois`,
        "Quantificateur de répétition",
        `Exige la répétition du motif précédent exactement ${n} fois d'affilée.`,
      );
      i = j + 1;
    } else if (c === "+" || c === "*" || c === "?") {
      const lazy = source[i + 1] === "?" && c !== "?";
      const text = lazy ? c + "?" : c;
      if (c === "+") {
        push(
          text,
          "quant",
          lazy ? "Au moins 1 fois (au plus court / lazy)" : "Au moins 1 fois (gourmand)",
          lazy ? "Quantificateur paresseux" : "Quantificateur obligatoire",
          lazy
            ? "Répète 1 ou plusieurs fois, mais s'arrête dès la première correspondance trouvée."
            : "Répète 1 ou plusieurs fois en consommant le maximum de caractères consécutifs.",
        );
      } else if (c === "*") {
        push(
          text,
          "quant",
          lazy ? "0, 1 ou plusieurs fois (au plus court)" : "0, 1 ou plusieurs fois",
          lazy ? "Quantificateur paresseux" : "Quantificateur optionnel répété",
          lazy
            ? "Peut être absent ou se répéter, en prenant le minimum de caractères nécessaire."
            : "Peut être absent ou se répéter autant de fois que possible.",
        );
      } else {
        push(
          text,
          "quant",
          "Optionnel (0 ou 1 fois)",
          "Quantificateur optionnel",
          "Rend l'élément immédiatement précédent facultatif dans la ligne.",
        );
      }
      i += text.length;
    } else if (c === ".") {
      const desc = CLASS_DESCRIPTIONS["."];
      push(".", "class", desc.label, desc.category, desc.detail);
      i++;
    } else if (c === "|") {
      push(
        "|",
        "literal",
        "OU logique (|)",
        "Alternative logique",
        "Correspond soit au motif situé à gauche, soit au motif situé à droite.",
      );
      i++;
    } else {
      let j = i;
      while (j < source.length && !"^$()[]\\{}+*?.|".includes(source.charAt(j))) j++;
      const text = source.slice(i, j);
      const isSpace = text.trim() === "";
      push(
        text,
        "literal",
        isSpace
          ? text.length === 1
            ? "Une espace"
            : `${text.length} espaces`
          : `Texte exact « ${text} »`,
        "Texte littéral (repère)",
        isSpace
          ? `Espace fixe servant de séparateur dans la ligne.`
          : `Doit être présent mot pour mot dans la chaîne pour servir de repère d'extraction.`,
      );
      i = j;
    }
  }
  return out;
}
