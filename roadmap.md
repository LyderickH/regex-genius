# Roadmap

- [x] Exemple FEC avec séparateur « | » et cas piégeux (montants avec espaces, négatifs, champs vides, séparateurs mixtes)
- [x] Nettoyage post-extraction (trim, espaces, chiffres, décimal, casse)
- [x] Préfixes de champ pour extraire le Nième champ d'une ligne délimitée
- [x] Signes +/- pris en charge dans les nombres
- [x] Choix du candidat couvrant le plus de lignes (pas seulement les exemples)
- [x] Copier le tableau vers Excel (bouton + Ctrl+C)
- [x] Coller depuis Excel (Ctrl+V à partir de la cellule active, ou tableau entier)
- [x] Vérification typecheck + Playwright
- [x] Panneau « Motif déduit » repliable (bouton dans l'en-tête + bandeau vertical pour rouvrir)
- [x] Exemple FEC plus lisible (espaces autour des « | »)
- [x] Sélection de cellules façon Excel (clic = sélection, maj+clic/glisser = plage, Ctrl+C = plage, flèches/Tab/Entrée, Suppr = vider, double-clic = édition)
- [x] Transformations classiques après extraction : date JJ/MM/AAAA, date ISO, jour de la semaine, heure, ÷100 (centimes), ×1000
- [x] Collage : création automatique des lignes manquantes, sans effacer les lignes précédentes
- [x] Bouton « Ajouter une ligne » + option « Tableau vierge » au démarrage ; colonne source éditable
- [x] Transformation de date AAAAMMJJ vers AAAA/MM/JJ

- [x] Multi-motifs : ne pas dégrader la regex simple, éviter de partir en exceptions (max 3 motifs, on ne découpe que si le gain est réel)

- [x] Ctrl+Z / Ctrl+Y : annuler et rétablir les modifications du tableau
- [ ] Regex combinée : une seule expression qui extrait toutes les colonnes d'un coup
- [ ] Moteur — 4 principes : pénaliser les motifs littéraux, qualifier les délimiteurs (pas de mots de liaison), pivots avant/après, ordre strict des règles multiples
