# Refonte du design

Critère de « terminé » : `npm run build` passe, la page s'affiche sans débordement horizontal
(accueil + vue de travail, 1440 px et 390 px), vérifié par captures Playwright.

## Règles communes
- Pas de boutons/badges en pilule (`rounded-full`) : `rounded-md`. Seuls les points d'état et spinners restent ronds.
- Pas d'étiquettes en monospace / majuscules espacées : titres de section en sans-serif, `text-xs font-semibold text-muted-foreground`.
  Le monospace reste réservé au contenu technique (regex, données, code, `<kbd>`).
- Pas d'italique décoratif, pas de texte en dégradé, pas de halo décoratif, pas d'effet « soulèvement » au survol.
- Couleurs via tokens (`primary`, `derived`, `success`, `warn`, `destructive`, `surface-*`) plutôt que la palette Tailwind brute.
- Taille de texte minimale 11 px.

## Tâches
- [x] Tokens `styles.css` : ajouter `surface-3` (utilisé mais non défini), `success`, focus visible
- [x] En-tête : responsive (plus de débordement mobile), boutons sur une ligne, liens secondaires regroupés
- [x] Mise en page vue de travail : panneau sous la grille sur mobile
- [x] Toast aux couleurs du thème sombre
- [x] Corriger l'erreur d'hydratation (nom du modèle IA différent serveur / client)
- [x] Accueil (`WelcomeHero.tsx`) : hiérarchie simplifiée, retrait des doublons
- [x] Panneau de motif + grille (`PatternPanel.tsx`, `DataGrid.tsx`)
- [x] Dialogues (`*Dialog.tsx`, `FileLoadingModal.tsx`)
- [x] Vérification : build, lint, tests, captures desktop/mobile

## Découvert en route
- [x] Tests : vitest absent du projet (25 fichiers de tests jamais exécutables) — ajouté en devDependency + script `npm test`
- [x] Bug : bouton « Copier la formule Excel » de l'en-tête de colonne passait `rule.pattern` (inexistant) → formule avec `undefined`
- [x] Perf : parse 1M lignes 1,5 s → ~0,27 s (détection du délimiteur sur un préfixe, sortie identique sur 336 cas)
- [ ] `ui/dialog.tsx` : largeur de base sans marge mobile (chaque dialogue doit surcharger)
- [ ] Lint : `index.tsx` comptait déjà ~219 erreurs Prettier avant la refonte (fichier jamais formaté) — non corrigé pour garder le diff lisible
- [ ] TypeScript : 95 erreurs préexistantes (`exactOptionalPropertyTypes`, indices possiblement `undefined`) — inchangé
- [x] Carte « Importer » de l'accueil : `<label>` imbriqués (HTML invalide) remplacés par une `div` + ref
- [ ] Prop `canInstall` de `WelcomeHero` jamais utilisée

# Audit du code et de l'algorithme
- [x] Moteur de synthèse (`engine.ts`) : audité (48 cas réalistes, 18 en échec)
- [ ] Dialectes (formules Excel/Sheets/Python…) et pipeline IA locale (sécurité ReDoS, modèle par défaut)
- [x] Import/export (`data-io.ts`) : audité (369 sondes, 28 bugs prouvés)
- [ ] Synthèse + corrections des bugs confirmés

## Corrigé (prouvé par sonde avant/après)
- [x] `explain()` : boucle infinie sur « { » sans « } » (regex saisie à la main → onglet figé)
- [x] ReDoS : motif IBAN `(?:[ \t]*\d+)+` (2,7 s à 25 chiffres, 71 s à 30) → `(?:[ \t]?\d)+`
- [x] Regex combinée : couverture vérifiée valeur par valeur, colonnes à remplacement / multi-motifs exclues, anti-ReDoS
- [x] Champ délimité vide (« |  | ») renvoyait « » au lieu de vide
- [x] Constante de remplacement contenant « $ » mal échappée
- [x] Export CSV : injection de formules (= + - @) neutralisée, montants négatifs préservés
- [x] Fichiers Windows-1252 / Latin-1 : accents relus correctement
- [x] .csv à « ; » avec montants « 1,5 » : « ; » prioritaire sur « , »
- [x] Export XLSX : refus explicite au-delà de 1 048 576 lignes, cellules > 32 767 caractères tronquées
- [x] Export complet : caractères invisibles retirés comme à l'import
- [x] Ctrl+Z : annule l'éventuelle synthèse différée ; annulation native conservée hors grille
- [x] Copie vers Excel : « \r » seul protégé par des guillemets

## Reste à décider (voir compte rendu)
- [ ] Score de sélection du moteur (faux positifs silencieux, constantes littérales en multi-motifs)
- [ ] Export complet : re-parse CSV correct, en-tête promu, source XLSX
- [ ] Historique : compteur de révision, une entrée par saisie (aujourd'hui une par frappe)
- [ ] Collage Ctrl+V : traiter le presse-papier comme du TSV
