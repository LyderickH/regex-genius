import { useState } from "react";
import {
  Sparkles,
  Upload,
  ClipboardPaste,
  Plus,
  ShieldCheck,
  Zap,
  Split,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

interface WelcomeHeroProps {
  onLoadSample: () => void;
  onImportFile: (file: File) => void;
  onOpenPaste: () => void;
  onStartBlank: () => void;
}

export function WelcomeHero({
  onLoadSample,
  onImportFile,
  onOpenPaste,
  onStartBlank,
}: WelcomeHeroProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onImportFile(file);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex min-h-full flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8 transition-colors ${
        isDragging ? "bg-primary/5 border-2 border-dashed border-primary" : "bg-background"
      }`}
    >
      {/* Halo lumineux décoratif en arrière-plan */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[800px] rounded-full bg-gradient-to-b from-amber-500/15 via-cyan-500/10 to-transparent blur-3xl opacity-70" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        {/* Badge technologique */}
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-surface px-3.5 py-1.5 text-xs font-medium text-primary shadow-sm backdrop-blur-sm">
          <Sparkles className="size-3.5 text-primary animate-pulse" />
          <span>Synthèse d'expressions régulières par l'exemple</span>
        </div>

        {/* Titre principal */}
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl text-foreground max-w-3xl leading-tight">
          Extrayez vos données,{" "}
          <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-cyan-400 bg-clip-text text-transparent">
            sans écrire de Regex
          </span>
        </h1>

        {/* Sous-titre */}
        <p className="mt-4 max-w-2xl text-sm sm:text-base text-muted-foreground leading-relaxed">
          À la manière de la « Colonne à partir d'exemples » de Power Query et Excel :
          donnez 1 ou 2 exemples attendus, Regex Genius déduit instantanément l'expression régulière
          optimale et remplit tout votre tableau.
        </p>

        {/* Grille des 4 cartes d'action principales */}
        <div className="mt-10 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-left">
          {/* Carte 1 : Essayer avec un exemple (Mise en avant) */}
          <button
            type="button"
            onClick={onLoadSample}
            className="group relative flex flex-col justify-between rounded-xl border border-primary/40 bg-surface/90 p-5 shadow-lg shadow-primary/5 transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:bg-surface hover:shadow-primary/20 text-left"
          >
            <div className="absolute -top-2.5 right-4 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground uppercase tracking-wider">
              Recommandé
            </div>
            <div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/20 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Sparkles className="size-5" />
              </div>
              <h2 className="mt-3.5 text-sm font-semibold text-foreground">Tester un exemple</h2>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Charge un extrait de journal comptable avec montants décimaux, dates et pièces
                piégeuses.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-primary">
              <span>Lancer la démo</span>
              <ArrowRight className="ml-1.5 size-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          {/* Carte 2 : Importer un fichier */}
          <label className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-border bg-surface/80 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:bg-surface hover:shadow-md">
            <input
              type="file"
              accept=".txt,.csv,.tsv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportFile(file);
              }}
            />
            <div>
              <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface-2 text-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                <Upload className="size-5" />
              </div>
              <h2 className="mt-3.5 text-sm font-semibold text-foreground">Importer un fichier</h2>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Glissez-déposez un fichier <strong>.xlsx</strong>, <strong>.csv</strong>,{" "}
                <strong>.tsv</strong> ou <strong>.txt</strong>.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-muted-foreground group-hover:text-primary">
              <span>Parcourir</span>
              <ArrowRight className="ml-1.5 size-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </label>

          {/* Carte 3 : Coller du texte */}
          <button
            type="button"
            onClick={onOpenPaste}
            className="group relative flex flex-col justify-between rounded-xl border border-border bg-surface/80 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:bg-surface hover:shadow-md text-left"
          >
            <div>
              <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface-2 text-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                <ClipboardPaste className="size-5" />
              </div>
              <h2 className="mt-3.5 text-sm font-semibold text-foreground">Coller du texte</h2>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Collez directement des lignes brutes ou un tableau copié depuis Excel ou le Web.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground group-hover:text-primary">
              <span className="font-medium">Ouvrir la boîte</span>
              <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                Ctrl + V
              </kbd>
            </div>
          </button>

          {/* Carte 4 : Tableau vierge */}
          <button
            type="button"
            onClick={onStartBlank}
            className="group relative flex flex-col justify-between rounded-xl border border-border bg-surface/80 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:bg-surface hover:shadow-md text-left"
          >
            <div>
              <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface-2 text-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                <Plus className="size-5" />
              </div>
              <h2 className="mt-3.5 text-sm font-semibold text-foreground">Tableau vierge</h2>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Démarrez sur une grille vide pour saisir manuellement vos données cellule par cellule.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-muted-foreground group-hover:text-primary">
              <span>Créer</span>
              <ArrowRight className="ml-1.5 size-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        </div>

        {/* Aperçu interactif explicatif : Comment ça marche */}
        <div className="mt-10 w-full rounded-xl border border-grid-line bg-surface/60 p-4 backdrop-blur-sm sm:p-5">
          <div className="flex items-center justify-between border-b border-grid-line pb-3 text-left">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Principe en action
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-primary">
              <CheckCircle2 className="size-3.5" />
              <span>100% automatique</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 text-left text-xs font-mono">
            {/* Étape 1 */}
            <div className="rounded-lg border border-border/80 bg-surface-2/60 p-3">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-sans mb-1.5">
                <span className="font-semibold text-foreground">1. Données brutes</span>
                <span className="text-[10px] text-amber-400">Entrée</span>
              </div>
              <div className="truncate text-foreground font-medium">
                FAC-2024-001 | 1 250,00 EUR
              </div>
              <div className="truncate text-muted-foreground text-[11px] mt-0.5">
                FAC-2024-002 | 980,50 EUR
              </div>
            </div>

            {/* Étape 2 */}
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
              <div className="flex items-center justify-between text-[11px] text-primary font-sans mb-1.5">
                <span className="font-semibold text-foreground">2. Votre exemple (1 seule ligne)</span>
                <span className="text-[10px] text-primary font-bold">Vous</span>
              </div>
              <div className="truncate text-primary font-bold">
                1250,00
              </div>
              <div className="truncate text-muted-foreground text-[11px] mt-0.5 italic font-sans">
                (vous saisissez juste la 1re valeur)
              </div>
            </div>

            {/* Étape 3 */}
            <div className="rounded-lg border border-border/80 bg-surface-2/60 p-3">
              <div className="flex items-center justify-between text-[11px] text-cyan-400 font-sans mb-1.5">
                <span className="font-semibold text-foreground">3. Regex déduite & résultat</span>
                <span className="text-[10px] text-cyan-400 font-bold">Moteur</span>
              </div>
              <div className="truncate text-cyan-400 font-medium">
                980,50 <span className="text-[10px] text-muted-foreground">(complété !)</span>
              </div>
              <div className="truncate text-muted-foreground text-[10px] mt-0.5">
                Regex : <code className="text-foreground">\|\s*([\d\s,]+)\s*EUR</code>
              </div>
            </div>
          </div>
        </div>

        {/* Badges de garanties & caractéristiques */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-400" />
            <span>100% privé dans votre navigateur</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-amber-400" />
            <span>Calcul instantané multithreadé</span>
          </div>
          <div className="flex items-center gap-2">
            <Split className="size-4 text-cyan-400" />
            <span>Extraction multi-colonnes</span>
          </div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-emerald-400" />
            <span>Copier-coller Excel fluide</span>
          </div>
        </div>
      </div>
    </div>
  );
}
