import type { Rule } from "./regex-synth/engine";
import { analyzeRegexFull } from "./regex-synth/human-explain";

export interface PromptOptions {
  colName: string;
  rows: string[];
  userExamples: (string | null)[];
  includeSamples?: boolean;
  sampleCount?: number;
  targetDialect?: string;
  currentRule?: Rule | null;
  failures?: number[];
}

export function generateExternalAIPrompt({
  colName,
  rows,
  userExamples,
  includeSamples = true,
  sampleCount = 10,
  targetDialect = "JavaScript / PCRE / Python",
  currentRule,
  failures,
}: PromptOptions): string {
  // 1. Extraire TOUS les exemples saisis par l'utilisateur (sans omission)
  const maxLen = Math.max(rows.length, userExamples.length);
  const examples: { row: number; input: string; output: string }[] = [];

  for (let i = 0; i < maxLen; i++) {
    const out = userExamples[i];
    if (out != null && String(out).trim() !== "") {
      examples.push({
        row: i + 1,
        input: rows[i] ?? "",
        output: String(out),
      });
    }
  }

  // 2. Extraire les lignes d'échantillons sans exemple (minimum 10 lignes si disponibles)
  const effectiveSampleCount = Math.max(10, sampleCount);
  const samples: { row: number; input: string }[] = [];

  if (includeSamples) {
    const usedRows = new Set(examples.map((e) => e.row - 1));
    for (let i = 0; i < rows.length && samples.length < effectiveSampleCount; i++) {
      if (!usedRows.has(i) && rows[i]?.trim()) {
        samples.push({ row: i + 1, input: rows[i]! });
      }
    }
  }

  const promptParts: string[] = [];

  // En-tête & Rôle
  promptParts.push(
    `# MISSION : DÉDUCTION D'EXPRESSION RÉGULIÈRE OPTIMISÉE`,
    ``,
    `Tu es un expert mondial en Expressions Régulières (Regex) et en extraction de données textuelles (à la manière de la fonction « Colonne à partir d'exemples » dans Power Query / Excel).`,
    ``,
    `Ta tâche est d'analyser les données réelles ci-dessous et de concevoir la Regex la plus précise, robuste et élégante pour extraire la colonne « ${colName || "Résultat"} ».`,
    ``,
  );

  // Section 1 : Exemples d'entraînement
  promptParts.push(`---`);
  promptParts.push(`## 1. EXEMPLES D'ENTRAÎNEMENT OBLIGATOIRES (Ground Truth)`);
  promptParts.push(
    `L'expression régulière DOIT impérativement matcher et extraire correctement la valeur attendue sur CHACUN de ces ${examples.length} exemple(s) :`,
  );
  promptParts.push(``);

  if (examples.length === 0) {
    promptParts.push(`*(Aucun exemple spécifique fourni pour le moment)*`);
    promptParts.push(``);
  } else {
    // Tableau Markdown pour lisibilité visuelle
    promptParts.push(`| N° | Ligne source brute (Input) | Valeur attendue exacte (Output) |`);
    promptParts.push(`|:---|:---|:---|`);
    examples.forEach((ex, idx) => {
      // Échappement des pipes pour ne pas casser le tableau markdown
      const safeInput = ex.input.replace(/\|/g, "\\|").replace(/\n/g, " ");
      const safeOutput = ex.output.replace(/\|/g, "\\|").replace(/\n/g, " ");
      promptParts.push(`| ${idx + 1} (l.${ex.row}) | \`${safeInput}\` | \`${safeOutput}\` |`);
    });
    promptParts.push(``);

    // Format JSON structuré pour injection sans aucune ambiguïté de caractères spéciaux ou d'espaces
    promptParts.push(`### Format structuré (JSON) pour éliminer toute ambiguïté de délimiteurs :`);
    promptParts.push(`\`\`\`json`);
    promptParts.push(
      JSON.stringify(
        examples.map((ex, idx) => ({
          exemple_id: idx + 1,
          ligne: ex.row,
          input: ex.input,
          expected_output: ex.output,
        })),
        null,
        2,
      ),
    );
    promptParts.push(`\`\`\``);
    promptParts.push(``);
  }

  // Section 2 : Motif actuellement déduit et analyse technique / raisonnement (si disponible)
  if (currentRule) {
    const analysis = analyzeRegexFull(currentRule, colName);
    promptParts.push(
      `---`,
      `## 2. MOTIF ACTUELLEMENT DÉDUIT PAR L'ALGORITHME & ANALYSE DU RAISONNEMENT`,
      ``,
      `L'algorithme automatique de Regex Genius a actuellement proposé le motif suivant :`,
      `\`\`\`regex`,
      currentRule.source,
      `\`\`\``,
    );

    if (currentRule.replacement !== undefined) {
      promptParts.push(`Formule de remplacement / substitution : \`${currentRule.replacement}\``, ``);
    }

    promptParts.push(
      `### A. Ce que fait le motif techniquement :`,
      `- **Mécanisme sous le capot** : ${analysis.technical.mechanism}`,
      `- **Résumé technique** : ${analysis.technical.summary}`,
      `- **Décomposition étape par étape** :`,
    );
    analysis.technical.steps.forEach((s) => {
      promptParts.push(`  - \`${s.token || ""}\` [${s.label}] : ${s.detail}`);
    });
    promptParts.push(``);

    if (analysis.technical.assumptions.length > 0) {
      promptParts.push(`### B. Hypothèses techniques & Risques de raisonnement identifiés :`);
      analysis.technical.assumptions.forEach((a) => {
        promptParts.push(`  - ⚠️ ${a}`);
      });
      promptParts.push(``);
    }

    promptParts.push(
      `### C. En langage humain (ce que l'utilisateur cherche à faire) :`,
      `> ${analysis.human}`,
      ``,
      `### D. Problème constaté & Mission :`,
      `Ce motif actuel est imparfait ou comporte une erreur de raisonnement sur les données réelles (surajustement, mauvais séparateur, ou échec sur certaines variations de lignes).`,
      `**MISSION POUR TOI** : Analyse où se situe l'erreur de raisonnement technique de ce motif, puis propose la Regex corrigée et optimale respectant 100% des exemples !`,
      ``,
    );
  }

  // Section 3 : Échantillons de validation (minimum 10 lignes si disponibles)
  if (samples.length > 0) {
    promptParts.push(`---`);
    promptParts.push(
      `## ${currentRule ? "3" : "2"}. ÉCHANTILLONS DE VALIDATION DU FICHIER (${samples.length} lignes sans résultat défini)`,
    );
    promptParts.push(
      `Voici d'autres lignes réelles issues du même fichier pour que tu puisses observer la structure globale, les délimiteurs et éviter tout surapprentissage :`,
    );
    promptParts.push(``);
    promptParts.push(`\`\`\`text`);
    samples.forEach((s) => {
      promptParts.push(`[Ligne ${s.row}] ${s.input}`);
    });
    promptParts.push(`\`\`\``);
    promptParts.push(``);
  }

  // Section 3 : Directives et contraintes
  promptParts.push(`---`);
  promptParts.push(`## 3. DIRECTIVES STRICTES & LIVRABLES ATTENDUS`);

  const isDiscontinuous = examples.some((ex) => !ex.input.includes(ex.output));
  if (isDiscontinuous) {
    promptParts.push(
      `⚠️ **ATTENTION PARTICULIÈRE (Extraction discontinue / Remplacement / Composition)** :`,
      `La valeur attendue n'est PAS une sous-chaîne continue de l'entrée (ex: première et dernière lettre, morceaux assemblés, réarrangement ou substitution).`,
      `Tu DOIS concevoir une Regex avec plusieurs groupes de capture \`(...)\` et fournir la formule de substitution correspondante (ex: \`$1$2\`, \`$2 $1\`, etc.).`,
      `Pour Excel : formule \`=REGEX.REMPLACER(A2; "motif"; "$1$2")\` en FR et \`=REGEXREPLACE(A2, "motif", "$1$2")\` en EN.`,
      ``,
    );
  }

  promptParts.push(
    `1. **Groupe capturant principal** : La Regex doit contenir un groupe capturant principal \`(...)\` isolant la valeur attendue, ou plusieurs groupes si la valeur combine plusieurs fragments discontinus.`,
    `2. **Dialecte / Outil ciblé** : **${targetDialect}**.`,
    `3. **Anti-surapprentissage (Généralisation)** : Ne code JAMAIS en dur les valeurs des exemples dans la regex (ex: n'écris pas \`(alice|bob)\` si la colonne extrait un prénom ou un email). La regex doit s'appuyer sur la structure (délimiteurs, formats, ancres, classes de caractères).`,
    `4. **Sécurité ReDoS** : La regex doit être exempte de tout backtracking catastrophique (pas de quantificateurs imbriqués ambigus).`,
  );

  // Instructions spécifiques selon l'outil ou le dialecte
  const dLower = targetDialect.toLowerCase();
  if (dLower.includes("excel")) {
    promptParts.push(
      `5. **Spécificités Excel 365 / Tableur (Versions Française et Anglaise)** :`,
      `   - Fournis la formule Excel 365 en **version française** : \`=REGEX.EXTRAIRE(A2; "motif"; 2)\` (séparateur point-virgule \`;\`, mode 2 pour extraire les groupes de capture \`(...)\`, ou mode 0 pour la correspondance complète).`,
      `   - Fournis également la formule en **version anglaise** : \`=REGEXEXTRACT(A2, "motif", 2)\` (séparateur virgule \`,\`).`,
      `   - Échappe correctement les guillemets dans la formule Excel en les doublant (\`""\`).`,
      `   - Si une formule native sans regex convient (ex: \`=TEXTE.AVANT(...)\` en FR / \`=TEXTBEFORE(...)\` en EN), mentionne les deux versions.`,
    );
  } else if (dLower.includes("alteryx")) {
    promptParts.push(
      `5. **Spécificités Alteryx** :`,
      `   - Fournis la configuration pour l'outil **RegEx Tool** en mode **Parse** (avec le motif et le groupe capturant).`,
      `   - Fournis aussi la formule pour l'outil **Formula** : \`REGEX_Replace([Champ], ".*?(motif).*", "$1")\` ou \`REGEX_Match([Champ], ...)\`.`,
    );
  } else if (dLower.includes("knime")) {
    promptParts.push(
      `5. **Spécificités KNIME Analytics Platform** :`,
      `   - Fournis l'expression pour le nœud **String Manipulation** : \`regexReplace($colonne$, ".*?(motif).*", "$1")\`.`,
      `   - Indique la configuration pour le nœud **Regex Split** (expression avec groupes capturants).`,
    );
  } else if (dLower.includes("power query")) {
    promptParts.push(
      `5. **Spécificités Power Query (M)** :`,
      `   - Rappel important : le langage M n'a AUCUNE fonction Regex native (et sa syntaxe n'est pas traduite, toujours avec des virgules \`,\`).`,
      `   - Fournis soit le contournement JavaScript standard via \`Web.Page\`, soit une étape \`Python.Execute\` pour Power BI, soit une combinaison de fonctions M natives sans regex (\`Text.BetweenDelimiters\`, \`Text.Select\`, \`Text.Split\`).`,
    );
  } else {
    promptParts.push(
      `5. **Validation étape par étape** :`,
      `   - Démontre que ton motif matche et extrait avec succès 100% des exemples de la section 1.`,
      `   - Indique ce que ton motif extrairait sur les premières lignes de la section 2.`,
    );
  }

  promptParts.push(
    `6. **Réponse finale** : Fournis la Regex et la formule/code prêt(e) à l'emploi dans un bloc de code dédié \`\`\`regex ... \`\`\`.`,
  );

  return promptParts.join("\n");
}
