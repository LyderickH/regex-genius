# Regex Genius

> **Créateur d'expressions régulières à partir d'exemples**, inspiré de la fonctionnalité *« Colonne à partir d'exemples »* de Power Query et Microsoft Excel.

Déduisez automatiquement des expressions régulières fiables sans avoir à les écrire à la main : saisissez ou importez vos données textuelles, fournissez quelques exemples de résultats attendus, et Regex Genius génère l'expression régulière optimale. Tout s'exécute **100% localement dans votre navigateur**, garantissant la confidentialité totale de vos données.

---

## ✨ Fonctionnalités

- **Déduction automatique par l'exemple** : Renseignez 1 ou 2 exemples attendus pour qu'une expression régulière optimale soit déduite et appliquée sur l'ensemble de votre jeu de données.
- **Support multi-colonnes** : Découpez ou extrayez plusieurs colonnes de résultats à partir d'une même chaîne source (séparateurs, motifs multiples, regex combinée).
- **Import / Export polyvalent** :
  - Copier / coller direct depuis et vers Excel / tableurs (Ctrl+C / Ctrl+V, sélection de plages).
  - Import de fichiers `.txt`, `.csv`, `.tsv`, `.xlsx`, `.xls`.
- **Nettoyage & transformations intégrées** :
  - Dates (JJ/MM/AAAA, ISO, AAAAMMJJ vers AAAA/MM/JJ, jour de la semaine...).
  - Nettoyage de nombres, suppression d'espaces, gestion des décimales et des signes.
  - Casse (majuscules, minuscules, capitales).
- **Interface tableur fluide** : Navigation au clavier (flèches, Tab, Entrée, Suppr), sélection de cellules et plages, annuler / rétablir (Ctrl+Z / Ctrl+Y), panneau d'analyse repliable.

---

## 🚀 Démarrage en local

### Prérequis

- [Node.js](https://nodejs.org/) (version 18 ou supérieure recommandée, v20+ / v22+)
- [npm](https://www.npmjs.com/) (inclus avec Node.js)

### Installation

Clonez ce dépôt puis installez les dépendances :

```bash
git clone <url-du-depot>
cd regex-genius
npm install
```

### Lancement du serveur de développement

Pour démarrer l'application en mode développement local :

```bash
npm run dev
```

L'application sera accessible sur **`http://localhost:3000`** (ou le port indiqué dans le terminal).

### Commandes utiles

- `npm run dev` : Démarre le serveur Vite de développement avec rechargement à chaud (HMR).
- `npm run build` : Compile l'application pour la production (client SSR + serveur Nitro).
- `npm run preview` : Prévisualise localement le build de production.
- `npm run lint` : Vérifie le code avec ESLint.
- `npm run format` : Formate le code avec Prettier.

---

## 🛠️ Stack technique

- **Framework & Routing** : [TanStack Start](https://tanstack.com/start) / [TanStack Router](https://tanstack.com/router)
- **UI & Rendu** : [React 19](https://react.dev/), [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/)
- **Style** : [Tailwind CSS v4](https://tailwindcss.com/)
- **Gestion d'état** : [TanStack Query](https://tanstack.com/query)
- **Parsing de données** : [PapaParse](https://www.papaparse.com/) (CSV), [SheetJS XLSX](https://sheetjs.com/) (Excel)
- **Bundler & Serveur** : [Vite](https://vite.dev/), [Nitro](https://nitro.unjs.io/)
