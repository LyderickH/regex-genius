export interface SymbolExampleEntry {
  pattern: string;
  description: string;
  found: string;
  context?: string;
}

export interface SymbolDetail {
  symbol: string;
  title: string;
  category: "classes" | "quantifiers" | "anchors" | "groups" | "advanced";
  categoryLabel: string;
  summary: string;
  quickExample: string;
  detailedExamples: SymbolExampleEntry[];
  tip?: string;
}

export const SYMBOL_DETAILS: Record<string, SymbolDetail> = {
  "\\d": {
    symbol: "\\d",
    title: "Chiffre décimal (0 à 9)",
    category: "classes",
    categoryLabel: "Classe de caractères",
    summary: "Correspond à un unique caractère numérique compris entre 0 et 9 (équivalent de [0-9]).",
    quickExample: "\\d\\d trouve 42",
    detailedExamples: [
      {
        pattern: "\\d",
        description: "Un seul chiffre isolé",
        context: 'Dans le texte "Ligne 7 terminée"',
        found: "7",
      },
      {
        pattern: "\\d\\d (ou \\d{2})",
        description: "Exactement 2 chiffres consécutifs d'affilée",
        context: 'Dans le texte "Le résultat est 42 pour le client"',
        found: "42",
      },
      {
        pattern: "\\d{4}",
        description: "Exactement 4 chiffres consécutifs (ex: une année)",
        context: 'Dans le texte "Facture exercice 2026 validée"',
        found: "2026",
      },
      {
        pattern: "\\d+",
        description: "Un nombre entier complet (1 ou plusieurs chiffres)",
        context: 'Dans le texte "Commande n° 10450 en cours"',
        found: "10450",
      },
      {
        pattern: "\\d+,\\d{2}",
        description: "Un montant décimal avec virgule",
        context: 'Dans le texte "Montant total : 42,50 € TTC"',
        found: "42,50",
      },
    ],
    tip: "Astuce : \\d vient de l'anglais 'digit'. Pour extraire tout un nombre sans vous soucier de sa longueur, écrivez toujours \\d+ avec un plus.",
  },

  "\\D": {
    symbol: "\\D",
    title: "Tout sauf un chiffre (inverse de \\d)",
    category: "classes",
    categoryLabel: "Classe inversée",
    summary: "Correspond à n'importe quel caractère qui n'est pas un chiffre (lettres, espaces, symboles).",
    quickExample: "\\D+ trouve du texte sans chiffres",
    detailedExamples: [
      {
        pattern: "\\D",
        description: "Un seul caractère non-numérique",
        context: 'Dans le texte "A1"',
        found: "A",
      },
      {
        pattern: "\\D+",
        description: "Une suite de caractères sans aucun chiffre",
        context: 'Dans le texte "Facture 1042"',
        found: "Facture ",
      },
      {
        pattern: "^\\D+",
        description: "La partie textuelle initiale avant les chiffres",
        context: 'Dans le texte "CMD-88741"',
        found: "CMD-",
      },
    ],
    tip: "La lettre majuscule représente souvent l'inverse de la minuscule (ex: \\D inverse de \\d, \\W inverse de \\w).",
  },

  "\\w": {
    symbol: "\\w",
    title: "Caractère de mot (alphanumérique)",
    category: "classes",
    categoryLabel: "Classe de caractères",
    summary: "Correspond à une lettre (a-z, A-Z), un chiffre (0-9) ou un tiret bas (_).",
    quickExample: "\\w+ trouve un mot standard",
    detailedExamples: [
      {
        pattern: "\\w",
        description: "Une seule lettre ou chiffre isolé",
        context: 'Dans le texte "ID: X9"',
        found: "I",
      },
      {
        pattern: "\\w+",
        description: "Un mot, nom d'utilisateur ou code continu",
        context: 'Dans le texte "Utilisateur user_42 connecté"',
        found: "user_42",
      },
      {
        pattern: "\\w+-\\w+",
        description: "Deux identifiants reliés par un tiret",
        context: 'Dans le texte "Code REF-901"',
        found: "REF-901",
      },
    ],
    tip: "Attention : \\w n'inclut pas les espaces ni les tirets normaux (-). Pour inclure le tiret, utilisez [\\w-].",
  },

  "\\W": {
    symbol: "\\W",
    title: "Caractère non-alphanumérique",
    category: "classes",
    categoryLabel: "Classe inversée",
    summary: "Correspond à tout ce qui n'est pas une lettre/chiffre (espaces, ponctuation, symboles).",
    quickExample: "\\W+ trouve les séparateurs",
    detailedExamples: [
      {
        pattern: "\\W",
        description: "Un séparateur isolé",
        context: 'Dans le texte "A:B"',
        found: ":",
      },
      {
        pattern: "\\W+",
        description: "Un séparateur complexe avec ponctuation et espaces",
        context: 'Dans le texte "Titre - Sous-titre"',
        found: " - ",
      },
    ],
  },

  "\\s": {
    symbol: "\\s",
    title: "Caractère d'espacement (blanc)",
    category: "classes",
    categoryLabel: "Classe de caractères",
    summary: "Correspond à une espace classique, une tabulation (\\t) ou un saut de ligne (\\n).",
    quickExample: "prénom\\snom trouve 'prénom nom'",
    detailedExamples: [
      {
        pattern: "\\s",
        description: "Une seule espace",
        context: 'Dans le texte "Jean Dupont"',
        found: " ",
      },
      {
        pattern: "\\s+",
        description: "Un ou plusieurs espaces consécutifs (espacement variable)",
        context: 'Dans le texte "Facture     1042"',
        found: "     ",
      },
      {
        pattern: ":\\s*",
        description: "Deux-points suivis d'espaces facultatives",
        context: 'Dans le texte "REF: 42" ou "REF:42"',
        found: ": ",
      },
    ],
    tip: "Idéal pour tolérer les fichiers aux alignements irréguliers avec \\s+.",
  },

  "\\S": {
    symbol: "\\S",
    title: "Caractère visible (non-blanc)",
    category: "classes",
    categoryLabel: "Classe inversée",
    summary: "Correspond à tout caractère imprimable qui n'est pas un espace ou une tabulation.",
    quickExample: "\\S+ isole les mots sans espaces",
    detailedExamples: [
      {
        pattern: "\\S+",
        description: "Une URL ou chemin complet sans espace",
        context: 'Dans le texte "Visitez https://example.com/api svp"',
        found: "https://example.com/api",
      },
      {
        pattern: "\\S+",
        description: "Un code composé de lettres, chiffres et symboles",
        context: 'Dans le texte "Ticket #TK-992/B clôturé"',
        found: "#TK-992/B",
      },
    ],
  },

  ".": {
    symbol: ".",
    title: "Caractère générique (joker)",
    category: "classes",
    categoryLabel: "Caractère générique",
    summary: "Correspond à n'importe quel caractère unique à l'exception des sauts de ligne.",
    quickExample: "a.c trouve abc, a1c, a-c",
    detailedExamples: [
      {
        pattern: "a.c",
        description: "N'importe quel caractère entre 'a' et 'c'",
        context: 'Trouve "abc", "a1c", "a-c", "a c"',
        found: "abc",
      },
      {
        pattern: ".{3}",
        description: "Exactement 3 caractères quelconques",
        context: 'Dans le texte "CODE-123"',
        found: "COD",
      },
      {
        pattern: "\\[(.*?)\\]",
        description: "Tout le texte situé entre deux crochets",
        context: 'Dans le texte "Commande [CMD-12] validée"',
        found: "CMD-12",
      },
    ],
    tip: "Pour chercher un vrai point dans du texte (ex: un nom de fichier .pdf), échappez-le avec un antislash : \\.",
  },

  "[a-z]": {
    symbol: "[a-z]",
    title: "Lettre minuscule",
    category: "classes",
    categoryLabel: "Classe de caractères",
    summary: "Correspond à une unique lettre minuscule de l'alphabet (a à z).",
    quickExample: "[a-z] trouve e",
    detailedExamples: [
      {
        pattern: "[a-z]",
        description: "Une seule lettre minuscule",
        context: 'Dans le texte "Facture"',
        found: "a",
      },
      {
        pattern: "[a-z]+",
        description: "Un mot entier en minuscules",
        context: 'Dans le texte "Total en euros : 42"',
        found: "euros",
      },
    ],
  },

  "[A-Z]": {
    symbol: "[A-Z]",
    title: "Lettre majuscule",
    category: "classes",
    categoryLabel: "Classe de caractères",
    summary: "Correspond à une unique lettre majuscule de l'alphabet (A à Z).",
    quickExample: "[A-Z] trouve E",
    detailedExamples: [
      {
        pattern: "[A-Z]",
        description: "Une seule lettre majuscule",
        context: 'Dans le texte "Facture F2026"',
        found: "F",
      },
      {
        pattern: "[A-Z]{2}",
        description: "Un code pays ou préfixe de 2 lettres majuscules",
        context: 'Dans le texte "IBAN : FR76 3000..."',
        found: "FR",
      },
      {
        pattern: "[A-Z]{3}",
        description: "Une devise ou code aéroport à 3 lettres",
        context: 'Dans le texte "Prix : 150 EUR"',
        found: "EUR",
      },
      {
        pattern: "[A-Z]+",
        description: "Un mot ou acronyme entièrement en majuscules",
        context: 'Dans le texte "Dossier CLIENT prioritaire"',
        found: "CLIENT",
      },
    ],
  },

  "[0-9]": {
    symbol: "[0-9]",
    title: "Chiffre de 0 à 9",
    category: "classes",
    categoryLabel: "Classe de caractères",
    summary: "Équivalent strict de \\d, sélectionne n'importe quel chiffre unique.",
    quickExample: "Identique à \\d",
    detailedExamples: [
      {
        pattern: "[0-9]",
        description: "Un seul chiffre",
        context: 'Dans le texte "Code 5"',
        found: "5",
      },
      {
        pattern: "[0-9]{2}",
        description: "2 chiffres consécutifs",
        context: 'Dans le texte "Résultat 42"',
        found: "42",
      },
      {
        pattern: "[0-9]+",
        description: "Nombre entier",
        context: 'Dans le texte "Année 2026"',
        found: "2026",
      },
    ],
  },

  "[^abc]": {
    symbol: "[^abc]",
    title: "Négation de classe (tout sauf)",
    category: "classes",
    categoryLabel: "Classe inversée",
    summary: "Le chapeau ^ au tout début des crochets signifie 'tout caractère SAUF ceux listés'.",
    quickExample: "[^0-9] exclut les chiffres",
    detailedExamples: [
      {
        pattern: "[^0-9]+",
        description: "Tout ce qui n'est pas un chiffre",
        context: 'Dans le texte "75001 Paris"',
        found: " Paris",
      },
      {
        pattern: "[^/]+",
        description: "Tout jusqu'au prochain slash (isole un nom de fichier)",
        context: 'Dans le texte "dossier/sous-dossier/facture.pdf"',
        found: "dossier",
      },
      {
        pattern: "[^;]+",
        description: "Tout jusqu'au prochain point-virgule (colonne CSV)",
        context: 'Dans le texte "FR76;150.00;VALIDE"',
        found: "FR76",
      },
    ],
    tip: "Idéal pour découper des colonnes délimitées sans se soucier du format interne.",
  },

  "?": {
    symbol: "?",
    title: "Quantificateur optionnel (0 ou 1 fois)",
    category: "quantifiers",
    categoryLabel: "Quantificateur",
    summary: "Rend l'élément immédiatement précédent facultatif dans la ligne.",
    quickExample: "https? trouve http et https",
    detailedExamples: [
      {
        pattern: "https?",
        description: "Le 's' est optionnel (0 ou 1 fois)",
        context: 'Trouve à la fois "http" et "https"',
        found: "https",
      },
      {
        pattern: "-?\\d+",
        description: "Signe moins optionnel pour nombres positifs ou négatifs",
        context: 'Trouve "-42" comme "42"',
        found: "-42",
      },
      {
        pattern: "colou?r",
        description: "Tolère les variantes d'orthographe US et UK",
        context: 'Trouve "color" et "colour"',
        found: "colour",
      },
    ],
  },

  "*": {
    symbol: "*",
    title: "0, 1 ou plusieurs fois",
    category: "quantifiers",
    categoryLabel: "Quantificateur",
    summary: "Peut être totalement absent ou se répéter un nombre illimité de fois.",
    quickExample: "\\s* pour espaces facultatives",
    detailedExamples: [
      {
        pattern: "\\s*",
        description: "Espaces facultatives (0, 1 ou plusieurs)",
        context: 'Dans "A:B" ou "A : B" ou "A   :   B"',
        found: " : ",
      },
      {
        pattern: ".*",
        description: "N'importe quel texte jusqu'au bout de la ligne",
        context: 'Dans "Note : ceci est un commentaire libre"',
        found: " ceci est un commentaire libre",
      },
    ],
  },

  "+": {
    symbol: "+",
    title: "Au moins 1 fois (1 ou plusieurs)",
    category: "quantifiers",
    categoryLabel: "Quantificateur",
    summary: "Oblige l'élément précédent à apparaître au moins une fois, sans limite haute.",
    quickExample: "\\d+ trouve un nombre complet",
    detailedExamples: [
      {
        pattern: "\\d+",
        description: "Un ou plusieurs chiffres (chiffre unique, dizaine, millier)",
        context: 'Trouve "7", "42", "10450", "999999"',
        found: "42",
      },
      {
        pattern: "[A-Z]+",
        description: "Une ou plusieurs lettres majuscules d'affilée",
        context: 'Dans le texte "Code FACTURE"',
        found: "FACTURE",
      },
      {
        pattern: "\\s+",
        description: "Une suite d'espaces (au moins une)",
        context: 'Dans le texte "Mot1    Mot2"',
        found: "    ",
      },
    ],
    tip: "C'est le quantificateur le plus utilisé pour extraire des valeurs de longueur variable.",
  },

  "{3}": {
    symbol: "{3}",
    title: "Répétition exacte (n fois)",
    category: "quantifiers",
    categoryLabel: "Quantificateur",
    summary: "Exige que l'élément précédent se répète un nombre précis et fixe de fois.",
    quickExample: "\\d{4} pour une année (ex: 2026)",
    detailedExamples: [
      {
        pattern: "\\d{2}",
        description: "Exactement 2 chiffres (ex: jour, mois, département)",
        context: 'Dans le texte "Code 42"',
        found: "42",
      },
      {
        pattern: "\\d{4}",
        description: "Exactement 4 chiffres (ex: année)",
        context: 'Dans le texte "2026-09-25"',
        found: "2026",
      },
      {
        pattern: "[A-Z]{3}",
        description: "Exactement 3 lettres majuscules (ex: devise)",
        context: 'Dans le texte "150 EUR"',
        found: "EUR",
      },
      {
        pattern: "[0-9]{5}",
        description: "Exactement 5 chiffres (ex: code postal français)",
        context: 'Dans le texte "75008 Paris"',
        found: "75008",
      },
    ],
  },

  "{2,5}": {
    symbol: "{2,5}",
    title: "Répétition bornée (min à max)",
    category: "quantifiers",
    categoryLabel: "Quantificateur",
    summary: "Définit une borne minimale et maximale de répétitions autorisées.",
    quickExample: "\\d{2,4} pour 2 à 4 chiffres",
    detailedExamples: [
      {
        pattern: "\\d{2,4}",
        description: "Entre 2 et 4 chiffres d'affilée",
        context: 'Trouve "42", "128", "2026"',
        found: "42",
      },
      {
        pattern: "[A-Z]{2,3}",
        description: "Code pays ou acronyme de 2 à 3 lettres",
        context: 'Trouve "FR" ou "FRA"',
        found: "FR",
      },
    ],
  },

  "+?": {
    symbol: "+?",
    title: "Quantificateur paresseux (au plus court / lazy)",
    category: "quantifiers",
    categoryLabel: "Quantificateur paresseux",
    summary: "S'arrête dès la toute première correspondance trouvée au lieu d'avaler tout le texte.",
    quickExample: "<.*?> s'arrête à la première balise",
    detailedExamples: [
      {
        pattern: "<.*?>",
        description: "Capture une seule balise HTML sans déborder sur les suivantes",
        context: 'Dans "<b>texte 1</b> et <b>texte 2</b>"',
        found: "<b>",
      },
      {
        pattern: '"(.*?)"',
        description: "Capture le contenu entre guillemets sans englober les guillemets suivants",
        context: 'Dans \'"client 1" et "client 2"\'',
        found: "client 1",
      },
    ],
    tip: "Par défaut, les quantificateurs (+, *) sont 'gourmands'. Ajouter un point d'interrogation après les rend paresseux.",
  },

  "^": {
    symbol: "^",
    title: "Ancre de début de chaîne / début de ligne",
    category: "anchors",
    categoryLabel: "Ancre de position",
    summary: "Oblige la règle à correspondre dès le tout premier caractère de la ligne.",
    quickExample: "^[A-Z] commence par une majuscule",
    detailedExamples: [
      {
        pattern: "^CMD",
        description: "La chaîne doit impérativement commencer par 'CMD'",
        context: 'Valide "CMD-12", mais rejette "Ref CMD-12"',
        found: "CMD",
      },
      {
        pattern: "^\\d+",
        description: "Extrait le numéro situé au tout début de la ligne",
        context: 'Dans le texte "1042 - Facture Dupont"',
        found: "1042",
      },
    ],
  },

  "$": {
    symbol: "$",
    title: "Ancre de fin de chaîne / fin de ligne",
    category: "anchors",
    categoryLabel: "Ancre de position",
    summary: "Oblige la règle à correspondre jusqu'au tout dernier caractère de la ligne.",
    quickExample: "\\.pdf$ vérifie la terminaison .pdf",
    detailedExamples: [
      {
        pattern: "\\.pdf$",
        description: "Vérifie que la ligne se termine impérativement par .pdf",
        context: 'Valide "contrat.pdf", mais rejette "contrat.pdf.bak"',
        found: ".pdf",
      },
      {
        pattern: "\\d+$",
        description: "Extrait le nombre situé à la toute fin de la ligne",
        context: 'Dans le texte "Montant en euros : 42"',
        found: "42",
      },
    ],
  },

  "\\b": {
    symbol: "\\b",
    title: "Frontière de mot",
    category: "anchors",
    categoryLabel: "Ancre de limite",
    summary: "Marque la limite entre un mot et un caractère non-alphanumérique (espace, ponctuation).",
    quickExample: "\\bchat\\b trouve 'chat' mais pas 'achat'",
    detailedExamples: [
      {
        pattern: "\\bchat\\b",
        description: "Trouve le mot exact 'chat' isolé",
        context: 'Trouve dans "un chat noir", mais ignore "achat" et "château"',
        found: "chat",
      },
      {
        pattern: "\\b\\d{4}\\b",
        description: "Isole une année à 4 chiffres sans matcher dans un long code",
        context: 'Trouve "2026" dans "Année 2026", mais ignore "REF202699"',
        found: "2026",
      },
      {
        pattern: "\\b[A-Z]{2}\\b",
        description: "Isole un code pays à 2 lettres",
        context: 'Trouve "FR" dans "FR / PARIS", mais ignore "FRA"',
        found: "FR",
      },
    ],
    tip: "Essentiel pour éviter les faux positifs au milieu de mots plus longs.",
  },

  "\\B": {
    symbol: "\\B",
    title: "Non-frontière de mot",
    category: "anchors",
    categoryLabel: "Ancre de limite",
    summary: "Exige que la correspondance se situe à l'intérieur d'un mot et non à sa frontière.",
    quickExample: "\\Bchat trouve 'achat' mais pas 'chat'",
    detailedExamples: [
      {
        pattern: "\\Bchat",
        description: "Correspond à 'chat' s'il est précédé d'autres lettres",
        context: 'Dans le texte "achat groupé"',
        found: "chat",
      },
    ],
  },

  "( ... )": {
    symbol: "( ... )",
    title: "Groupe de capture",
    category: "groups",
    categoryLabel: "Groupe de capture",
    summary: "Ouvre et ferme la zone dont la valeur sera extraite et renvoyée dans votre colonne de résultat.",
    quickExample: "Ref: (\\w+) extrait uniquement le code",
    detailedExamples: [
      {
        pattern: "Ref: (\\w+)",
        description: "Extrait la référence sans inclure le texte 'Ref:'",
        context: 'Dans le texte "Ref: CMD42 validée"',
        found: "CMD42",
      },
      {
        pattern: "(\\d{2})/(\\d{2})/(\\d{4})",
        description: "Capture séparément le jour ($1), le mois ($2) et l'année ($3)",
        context: 'Dans le texte "Date: 25/09/2026"',
        found: "25, 09, 2026",
      },
      {
        pattern: "Montant : ([\\d,]+) €",
        description: "Isole uniquement la somme numérique",
        context: 'Dans le texte "Montant : 42,50 € TTC"',
        found: "42,50",
      },
    ],
    tip: "C'est ce qui permet à Regex Genius d'extraire la bonne valeur sans garder les repères environnants.",
  },

  "(?: ... )": {
    symbol: "(?: ... )",
    title: "Groupe non-capturant (contexte)",
    category: "groups",
    categoryLabel: "Groupe contextuel",
    summary: "Isole une suite d'éléments pour lui appliquer un quantificateur ou un OU sans extraire sa valeur.",
    quickExample: "(?:\\+33|0)[1-9]\\d{8}",
    detailedExamples: [
      {
        pattern: "(?:\\+33|0)[1-9]\\d{8}",
        description: "Applique l'alternative OU sans polluer les numéros de groupes de capture",
        context: 'Valide "+33612345678" ou "0612345678"',
        found: "0612345678",
      },
      {
        pattern: "(?:[ \\t]*\\d+)+",
        description: "Répète un bloc de chiffres avec séparateurs sans extraire chaque bloc",
        context: 'Dans un IBAN "FR76 1001 2002 3004"',
        found: "1001 2002 3004",
      },
    ],
  },

  "\\": {
    symbol: "\\",
    title: "Antislash d'échappement",
    category: "groups",
    categoryLabel: "Symbole échappé",
    summary: "Retire la signification spéciale d'un symbole réservé pour chercher son vrai caractère dans le texte.",
    quickExample: "\\. pour un vrai point, \\[ pour un vrai crochet",
    detailedExamples: [
      {
        pattern: "\\.",
        description: "Cherche un vrai point littéral (au lieu du joker universel)",
        context: 'Dans une adresse IP "192.168.1.1" ou un fichier ".pdf"',
        found: ".",
      },
      {
        pattern: "\\[CMD-\\d+\\]",
        description: "Cherche les vrais crochets [ et ] entourant le code",
        context: 'Dans le texte "Commande [CMD-42] validée"',
        found: "[CMD-42]",
      },
      {
        pattern: "\\?",
        description: "Cherche un vrai point d'interrogation (au lieu du quantificateur optionnel)",
        context: 'Dans le texte "Pourquoi ce statut ?"',
        found: "?",
      },
      {
        pattern: "\\$",
        description: "Cherche le symbole dollar $ (au lieu de l'ancre de fin de ligne)",
        context: 'Dans le texte "Prix : 42 $ US"',
        found: "$",
      },
    ],
    tip: "Symboles à toujours échapper pour les chercher tels quels : . * + ? ^ $ ( ) [ ] { } | \\",
  },

  "|": {
    symbol: "|",
    title: "Alternative logique OU",
    category: "groups",
    categoryLabel: "Alternative logique",
    summary: "Correspond soit au motif situé à gauche, soit au motif situé à droite.",
    quickExample: "EUR|USD trouve l'une des deux devises",
    detailedExamples: [
      {
        pattern: "EUR|USD|GBP",
        description: "Trouve n'importe laquelle des 3 devises spécifiées",
        context: 'Trouve "EUR" dans "150 EUR" ou "USD" dans "80 USD"',
        found: "EUR",
      },
      {
        pattern: "(M\\.|Mme|Mlle)",
        description: "Capture l'une des civilités possibles",
        context: 'Dans le texte "Mme Martin"',
        found: "Mme",
      },
    ],
  },
};

/**
 * Retrouve la fiche d'exemples détaillée pour n'importe quel segment ou texte de token regex.
 */
export function findSymbolDetail(rawText: string): SymbolDetail | undefined {
  if (!rawText) return undefined;
  const t = rawText.trim();

  // Correspondance directe
  if (SYMBOL_DETAILS[t]) return SYMBOL_DETAILS[t];

  // Gestion des classes
  if (t === "\\d" || t === "\\d+" || t === "\\d*" || t === "\\d?") return SYMBOL_DETAILS["\\d"];
  if (t === "\\D" || t === "\\D+") return SYMBOL_DETAILS["\\D"];
  if (t === "\\w" || t === "\\w+") return SYMBOL_DETAILS["\\w"];
  if (t === "\\W" || t === "\\W+") return SYMBOL_DETAILS["\\W"];
  if (t === "\\s" || t === "\\s+" || t === "\\s*") return SYMBOL_DETAILS["\\s"];
  if (t === "\\S" || t === "\\S+") return SYMBOL_DETAILS["\\S"];
  if (t === "." || t === ".*" || t === ".+") return SYMBOL_DETAILS["."];

  // Classes entre crochets
  if (t === "[A-Z]" || t.startsWith("[A-Z")) return SYMBOL_DETAILS["[A-Z]"];
  if (t === "[a-z]" || t.startsWith("[a-z")) return SYMBOL_DETAILS["[a-z]"];
  if (t === "[0-9]" || t.startsWith("[0-9")) return SYMBOL_DETAILS["[0-9]"];
  if (t.startsWith("[^")) return SYMBOL_DETAILS["[^abc]"];

  // Quantificateurs
  if (t.startsWith("{") && t.endsWith("}")) {
    if (t.includes(",")) return SYMBOL_DETAILS["{2,5}"];
    return SYMBOL_DETAILS["{3}"];
  }
  if (t === "+?" || t === "*?" || t === "??") return SYMBOL_DETAILS["+?"];
  if (t === "+") return SYMBOL_DETAILS["+"];
  if (t === "*") return SYMBOL_DETAILS["*"];
  if (t === "?") return SYMBOL_DETAILS["?"];

  // Ancres
  if (t === "^") return SYMBOL_DETAILS["^"];
  if (t === "$") return SYMBOL_DETAILS["$"];
  if (t === "\\b") return SYMBOL_DETAILS["\\b"];
  if (t === "\\B") return SYMBOL_DETAILS["\\B"];

  // Groupes
  if (t === "(?:" || t.startsWith("(?:")) return SYMBOL_DETAILS["(?: ... )"];
  if (t === "(" || t === ")") return SYMBOL_DETAILS["( ... )"];
  if (t === "|") return SYMBOL_DETAILS["|"];

  // Échappements
  if (t.startsWith("\\") && t.length === 2) {
    if (t === "\\d" || t === "\\w" || t === "\\s" || t === "\\b" || t === "\\D" || t === "\\W" || t === "\\S" || t === "\\B") {
      return SYMBOL_DETAILS[t];
    }
    return SYMBOL_DETAILS["\\"];
  }

  return undefined;
}
