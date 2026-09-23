export interface Segment {
  text: string;
  kind: "literal" | "class" | "quant" | "anchor" | "group";
  label: string;
}

const CLASS_LABELS: Record<string, string> = {
  "\\d": "un chiffre",
  "\\w": "un caractère de mot",
  "\\s": "une espace",
  "\\S": "tout sauf une espace",
  ".": "n'importe quel caractère",
};

/** Découpe une expression régulière en segments expliqués en clair. */
export function explain(source: string): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  const push = (text: string, kind: Segment["kind"], label: string) => out.push({ text, kind, label });

  while (i < source.length) {
    const c = source[i];

    if (c === "^") {
      push("^", "anchor", "début de la ligne");
      i++;
    } else if (c === "$") {
      push("$", "anchor", "fin de la ligne");
      i++;
    } else if (c === "(") {
      push("(", "group", "début de la valeur extraite");
      i++;
    } else if (c === ")") {
      push(")", "group", "fin de la valeur extraite");
      i++;
    } else if (c === "[") {
      let j = i + 1;
      while (j < source.length && (source[j] !== "]" || source[j - 1] === "\\")) j++;
      const text = source.slice(i, j + 1);
      const neg = text.startsWith("[^");
      push(
        text,
        "class",
        neg ? `tout caractère sauf ${text.slice(2, -1)}` : `un caractère parmi ${text.slice(1, -1)}`,
      );
      i = j + 1;
    } else if (c === "\\") {
      const text = source.slice(i, i + 2);
      if (CLASS_LABELS[text]) push(text, "class", CLASS_LABELS[text]);
      else push(text, "literal", `le caractère « ${text[1]} »`);
      i += 2;
    } else if (c === "{") {
      const j = source.indexOf("}", i);
      const text = source.slice(i, j + 1);
      const n = text.slice(1, -1);
      push(text, "quant", `répété ${n} fois`);
      i = j + 1;
    } else if (c === "+" || c === "*" || c === "?") {
      const lazy = source[i + 1] === "?" && c !== "?";
      const text = lazy ? c + "?" : c;
      push(
        text,
        "quant",
        c === "+"
          ? lazy
            ? "une fois ou plus, au plus court"
            : "une fois ou plus"
          : c === "*"
            ? "zéro fois ou plus"
            : "optionnel",
      );
      i += text.length;
    } else if (c === ".") {
      push(".", "class", "n'importe quel caractère");
      i++;
    } else {
      let j = i;
      while (j < source.length && !"^$()[]\\{}+*?.".includes(source.charAt(j))) j++;
      const text = source.slice(i, j);
      push(text, "literal", `le texte exact « ${text} »`);
      i = j;
    }
  }
  return out;
}
