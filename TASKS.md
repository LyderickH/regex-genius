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
- [ ] Perf : `million-rows-loading.test.ts` échoue même isolé (~1,6 s pour 1,2 s) — en cours d'audit
- [ ] `ui/dialog.tsx` : largeur de base sans marge mobile (chaque dialogue doit surcharger)
- [ ] Lint : `index.tsx` comptait déjà ~219 erreurs Prettier avant la refonte (fichier jamais formaté) — non corrigé pour garder le diff lisible
- [ ] TypeScript : 95 erreurs préexistantes (`exactOptionalPropertyTypes`, indices possiblement `undefined`) — inchangé
- [x] Carte « Importer » de l'accueil : `<label>` imbriqués (HTML invalide) remplacés par une `div` + ref
- [ ] Prop `canInstall` de `WelcomeHero` jamais utilisée

# Audit du code et de l'algorithme
- [ ] Moteur de synthèse (`engine.ts`) : exactitude, sur-apprentissage, robustesse, performance
- [ ] Dialectes (formules Excel/Sheets/Python…) et pipeline IA locale (sécurité ReDoS, modèle par défaut)
- [ ] Import/export (`data-io.ts`) : CSV, injection de formules, performance 1M lignes
- [ ] Synthèse + corrections des bugs confirmés
