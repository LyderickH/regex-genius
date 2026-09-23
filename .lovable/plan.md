# Générateur d'expressions régulières à partir d'exemples

Un outil « à la Power Query » : vous collez vos données, vous écrivez le résultat
attendu sur quelques lignes, l'outil devine la règle et l'applique à tout le reste.

## L'écran principal

Une grille à colonnes :

```text
┌─────────────────────────────┬──────────────┬──────────────┬─────┐
│ Données source              │ Résultat 1   │ Résultat 2   │  +  │
├─────────────────────────────┼──────────────┼──────────────┼─────┤
│ FR-2024-00123 / Paris       │ 2024         │ Paris        │     │  ← vous remplissez
│ FR-2023-00987 / Lyon        │ 2023         │ Lyon         │     │  ← vous remplissez
│ DE-2024-00455 / Berlin      │ 2024 ✓auto   │ Berlin ✓auto │     │  ← deviné
└─────────────────────────────┴──────────────┴──────────────┴─────┘
```

- Colonne 1 : vos données (collage, TXT, CSV, Excel .xlsx).
- Colonnes 2, 3, 4… : un résultat attendu par colonne. Vous pouvez ajouter
  autant de colonnes de sortie que nécessaire, chacune avec sa propre règle.
- Dès 2 ou 3 exemples remplis, les lignes restantes se complètent automatiquement,
  en distinguant visuellement ce qui est déduit de ce que vous avez saisi.
- Une ligne corrigée à la main relance la déduction et affine la règle.
- Les lignes où aucune règle ne s'applique sont signalées pour correction.

## La déduction (100 % locale, dans le navigateur)

Aucun envoi de données vers un service externe. Le moteur procède par étapes,
de la règle la plus simple à la plus complexe :

1. Découpe du texte en « jetons » typés (chiffres, lettres, séparateurs, dates,
   emails, URLs, montants, codes).
2. Génération de règles candidates : position fixe, avant/après un délimiteur,
   n-ième jeton, classe de caractères, capture entre deux ancres, préfixes/suffixes.
3. Scoring de chaque candidate sur TOUS vos exemples : on garde la plus simple
   qui explique 100 % des exemples fournis (généralisation, pas apprentissage par cœur).
4. Combinaison de règles (concaténation, conditionnel selon la forme de la ligne)
   quand aucune règle unique ne suffit.

Le traitement gros volumes se fait par lots avec un worker de fond, pour garder
l'interface fluide sur des dizaines de milliers de lignes.

## Le panneau « Expression régulière »

Pour chaque colonne de sortie :

- L'expression générée, avec explication en clair de chaque partie.
- Le nombre de lignes couvertes / en échec.
- Conversion dans les dialectes : Excel, Python, SQL (Postgres / T-SQL), Alteryx,
  KNIME, JavaScript, .NET, PCRE — avec, quand c'est pertinent, la formule complète
  prête à coller (ex. `REGEXEXTRACT(...)`, `re.search(...)`, `REGEXP_SUBSTR(...)`).
- Bouton copier par dialecte.

## Export

- Tableau complet (source + toutes les colonnes générées) en CSV et Excel.
- Les expressions régulières seules, dans le dialecte choisi.

## Étapes de réalisation

1. Trois propositions de design à choisir avant de construire.
2. Grille éditable + import collage / TXT / CSV / Excel.
3. Moteur de déduction local + worker de fond.
4. Panneau expression régulière et convertisseur de dialectes.
5. Exports CSV / Excel.

## Détails techniques

- 100 % client : aucune base de données ni backend, rien ne quitte le navigateur.
- Parsing Excel via SheetJS, CSV via PapaParse, export xlsx via SheetJS.
- Moteur de synthèse maison (tokenisation + recherche de programme par énumération
  guidée et scoring, façon FlashFill), exécuté dans un Web Worker, avec traitement
  incrémental par lots et annulation.
- Traducteur de motif : représentation interne indépendante du dialecte, puis
  sérialisation par cible (échappement, syntaxe des groupes nommés, lookarounds
  non supportés remplacés par une stratégie équivalente quand possible).
- Virtualisation de la grille pour les gros volumes.
