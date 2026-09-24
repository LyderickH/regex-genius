export interface PromptOptions {
  colName: string;
  rows: string[];
  userExamples: (string | null)[];
  includeSamples?: boolean;
  sampleCount?: number;
  targetDialect?: string;
}

export function generateExternalAIPrompt({
  colName,
  rows,
  userExamples,
  includeSamples = true,
  sampleCount = 5,
  targetDialect = "JavaScript / PCRE / Python",
}: PromptOptions): string {
  // 1. Extraire les exemples saisis
  const examples: { row: number; input: string; output: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const out = userExamples[i];
    if (out != null && out !== "") {
      examples.push({ row: i + 1, input: rows[i] ?? "", output: out });
    }
  }

  // 2. Extraire quelques lignes échantillons sans exemple pour donner du contexte au LLM
  const samples: { row: number; input: string }[] = [];
  if (includeSamples) {
    const usedRows = new Set(examples.map((e) => e.row - 1));
    for (let i = 0; i < rows.length && samples.length < sampleCount; i++) {
      if (!usedRows.has(i) && rows[i]?.trim()) {
        samples.push({ row: i + 1, input: rows[i]! });
      }
    }
  }

  const promptParts: string[] = [];

  promptParts.push(
    `Tu es un expert d'élite en Expressions Régulières (Regex) et en extraction de données textuelles (à la manière de la fonction « Colonne à partir d'exemples » dans Power Query / Excel).`,
    ``,
    `Je souhaite extraire la colonne « ${colName || "Résultat"} » à partir de mes données textuelles.`,
    ``,
    `### Exemples d'extraction que j'ai complétés :`,
  );

  if (examples.length === 0) {
    promptParts.push(`(Aucun exemple spécifique fourni pour le moment)`);
  } else {
    examples.forEach((ex, idx) => {
      promptParts.push(`Exemple ${idx + 1} (ligne ${ex.row}) :`);
      promptParts.push(`- Ligne source : ${JSON.stringify(ex.input)}`);
      promptParts.push(`- Valeur attendue : ${JSON.stringify(ex.output)}`);
      promptParts.push(``);
    });
  }

  if (samples.length > 0) {
    promptParts.push(`### Autres lignes types issues du fichier (sans résultat spécifié) pour observer le contexte :`);
    samples.forEach((s) => {
      promptParts.push(`- Ligne ${s.row} : ${JSON.stringify(s.input)}`);
    });
    promptParts.push(``);
  }

  promptParts.push(
    `### Tes objectifs et contraintes :`,
    `1. Fournis une Expression Régulière compatible ${targetDialect}.`,
    `2. Utilise un **groupe capturant principal \`(...)\`** pour isoler la valeur à extraire.`,
    `3. Le motif doit être **robuste** : évite le surapprentissage sur les seuls exemples, et prévois les légères variations (espaces, ponctuations, longueurs).`,
    `4. Le motif doit être **sûr et exempt de ReDoS** (pas de backtracking catastrophique).`,
    `5. Explique brièvement la décomposition de ton motif et pourquoi il correspond parfaitement aux exemples fournis.`,
    ``,
    `Réponds avec le motif regex clairement mis en évidence dans un bloc de code.`,
  );

  return promptParts.join("\n");
}
