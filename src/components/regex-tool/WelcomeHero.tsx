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
  Database,
  HelpCircle,
  Plane,
  WifiOff,
  Download,
  Laptop,
  Receipt,
  Users,
  Globe,
  Landmark,
} from "lucide-react";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import { BUSINESS_PRESETS, type BusinessPreset } from "@/lib/datasets/business-presets";

interface WelcomeHeroProps {
  onLoadSample1?: () => void;
  onLoadSample2?: () => void;
  onLoadSample?: () => void;
  onLoadPreset?: (preset: BusinessPreset) => void;
  onImportFile: (file: File) => void;
  onOpenPaste: () => void;
  onStartBlank: () => void;
  isOffline?: boolean;
  canInstall?: boolean;
  isInstalled?: boolean;
  onInstall?: () => void;
}

export function WelcomeHero({
  onLoadSample1,
  onLoadSample2,
  onLoadSample,
  onImportFile,
  onOpenPaste,
  onStartBlank,
  isOffline = false,
  canInstall = false,
  isInstalled = false,
  onInstall,
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

  const handleSample1 = onLoadSample1 || onLoadSample || (() => {});
  const handleSample2 = onLoadSample2 || onLoadSample || (() => {});

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
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl text-foreground max-w-4xl leading-tight">
          Extrayez vos données,{" "}
          <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-cyan-400 bg-clip-text text-transparent">
            sans écrire de Regex
          </span>
        </h1>

        {/* Mini-badge d'explication interactif C'est quoi une Regex ? */}
        <div className="mt-3.5 flex items-center justify-center">
          <HoverCard openDelay={80} closeDelay={150}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className="group inline-flex items-center gap-2 rounded-full border border-primary/30 bg-surface/80 px-3.5 py-1 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur-sm transition-all hover:border-primary/60 hover:bg-surface-2 hover:text-foreground cursor-help"
              >
                <HelpCircle className="size-3.5 text-primary transition-transform group-hover:scale-110" />
                <span>
                  C'est quoi une <strong className="text-foreground">Regex</strong> ?
                </span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                  Explication 30s
                </span>
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              align="center"
              side="bottom"
              sideOffset={10}
              className="z-50 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-border/90 bg-surface/98 p-5 text-foreground shadow-2xl backdrop-blur-2xl text-left tracking-normal font-sans"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-cyan-500 text-slate-950 font-bold shadow-sm">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    C'est quoi une « Regex » ?
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    Expression Régulière · Regular Expression
                  </p>
                </div>
              </div>

              <div className="mt-3.5 space-y-3 text-xs leading-relaxed text-muted-foreground">
                <p className="text-foreground/90 leading-normal">
                  C'est une <strong>formule de recherche textuelle avancée</strong> permettant de détecter, extraire ou vérifier des motifs précis (emails, dates, montants, numéros de facture) perdus dans des blocs de texte brut.
                </p>

                <div className="rounded-xl border border-border/80 bg-surface-2/80 p-3">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground mb-1.5">
                    <span>Syntaxe manuelle classique :</span>
                    <span className="text-[10px] text-amber-400 font-medium">Complexe & cryptique</span>
                  </div>
                  <code className="block rounded bg-background/90 px-2.5 py-1.5 font-mono text-[11px] text-amber-300 break-all select-all border border-border/50">
                    (?&lt;=FAC-)\d&#123;4&#125;-[A-Z0-9]+(?=\s*\|)
                  </code>
                </div>

                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-foreground">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary mb-1">
                    <CheckCircle2 className="size-3.5 text-primary" />
                    <span>La solution Regex Genius :</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-normal">
                    <strong>Vous n'avez rien à apprendre.</strong> Saisissez simplement 1 ou 2 exemples attendus dans votre colonne, et l'outil calcule la formule optimale instantanément pour Excel, Google Sheets, Power Query ou Python !
                  </p>
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>

        {/* Sous-titre */}
        <p className="mt-4 max-w-2xl text-sm sm:text-base text-muted-foreground leading-relaxed">
          À la manière de la « Colonne à partir d'exemples » de Power Query et Excel :
          donnez 1 ou 2 exemples attendus, Regex Genius déduit instantanément l'expression régulière
          optimale et remplit tout votre tableau.
        </p>

        {/* Grille des 2 actions principales d'ingestion */}
        <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 text-left">
          {/* Action 1 : Importer un fichier */}
          <label className="group relative flex cursor-pointer flex-col justify-between rounded-2xl border border-primary/30 bg-surface/90 p-6 shadow-md transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:bg-surface hover:shadow-primary/10">
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
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/20 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Upload className="size-6" />
              </div>
              <h2 className="mt-4 text-base font-bold text-foreground">Importer vos données</h2>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Glissez-déposez ou parcourez un fichier <strong>.xlsx</strong>, <strong>.csv</strong>,{" "}
                <strong>.tsv</strong> ou <strong>.txt</strong> (jusqu'à 1M+ de lignes).
              </p>
            </div>
            <div className="mt-5 flex items-center text-xs font-semibold text-primary">
              <span>Parcourir mes fichiers</span>
              <ArrowRight className="ml-1.5 size-4 transition-transform group-hover:translate-x-1" />
            </div>
          </label>

          {/* Action 2 : Tableau vierge / Coller du texte */}
          <div
            onClick={onStartBlank}
            className="group relative flex flex-col justify-between rounded-2xl border border-border bg-surface/80 p-6 transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:bg-surface hover:shadow-md text-left cursor-pointer"
          >
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-surface-2 text-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                  <ClipboardPaste className="size-6" />
                </div>
                <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-surface-2 text-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                  <Plus className="size-6" />
                </div>
              </div>
              <h2 className="mt-4 text-base font-bold text-foreground">Coller du texte ou Grille vierge</h2>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Collez directement vos cellules copiées depuis Excel (Ctrl + V) ou démarrez sur une grille vide.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPaste();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
              >
                <ClipboardPaste className="size-3.5" />
                <span>Coller du texte</span>
                <kbd className="text-[10px] font-mono text-primary/80">Ctrl+V</kbd>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartBlank();
                }}
                className="inline-flex items-center rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-3 transition"
              >
                <span>Grille vide</span>
              </button>
            </div>
          </div>
        </div>

        {/* Séparateur & En-tête des modèles métiers */}
        <div className="mt-10 flex w-full items-center justify-between gap-4 border-t border-border/60 pt-6 text-left">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Sparkles className="size-3.5 text-primary" />
              <span>Ou essayez en 1 clic sur un cas d'usage métier :</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Ces modèles chargent des données réelles et déduisent les expressions immédiatement.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSample2}
            className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-cyan-400 hover:underline cursor-pointer"
            title="Charger le dataset volumétrique de 1 138 logs d'audit"
          >
            <Database className="size-3" />
            <span>Grand dataset (1 138 logs) →</span>
          </button>
        </div>

        {/* Grille des 4 cas d'usage métiers */}
        <div className="mt-3 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 text-left">
          {BUSINESS_PRESETS.map((preset) => {
            const Icon =
              preset.id === "fec"
                ? Receipt
                : preset.id === "rh"
                ? Users
                : preset.id === "web"
                ? Globe
                : Landmark;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  if (onLoadPreset) {
                    onLoadPreset(preset);
                  } else {
                    handleSample1();
                  }
                }}
                className="group relative flex flex-col justify-between rounded-xl border border-border/70 bg-surface/60 p-4 transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:bg-surface hover:shadow-md text-left cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-surface-2 text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                      <Icon className="size-4.5" />
                    </div>
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {preset.category}
                    </span>
                  </div>
                  <h3 className="mt-3 text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    {preset.title}
                  </h3>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-normal line-clamp-2">
                    {preset.description}
                  </p>
                </div>
                <div className="mt-3 flex items-center text-[11px] font-semibold text-primary">
                  <span>Essayer ce cas</span>
                  <ArrowRight className="ml-1 size-3 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Bannière Défi Mode Avion & Installation Locale PWA */}
        <div
          className={`mt-8 w-full rounded-2xl border p-5 backdrop-blur-md transition-all duration-300 text-left ${
            isOffline
              ? "border-emerald-500/70 bg-gradient-to-r from-emerald-950/40 via-surface to-emerald-950/30 shadow-xl shadow-emerald-950/50"
              : "border-primary/30 bg-gradient-to-r from-amber-500/10 via-surface/80 to-cyan-500/10 shadow-md"
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  isOffline
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-primary/20 text-primary"
                }`}
              >
                {isOffline ? (
                  <WifiOff className="size-6 animate-pulse" />
                ) : (
                  <Plane className="size-6" />
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    {isOffline
                      ? "✈️ Défi relevé : Mode avion actif !"
                      : "✈️ Défi Confidentialité : Testez en Mode Avion"}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
                      isOffline
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-surface-2 text-muted-foreground border border-border"
                    }`}
                  >
                    <span
                      className={`size-2 rounded-full ${
                        isOffline
                          ? "bg-emerald-400 animate-ping"
                          : "bg-amber-400"
                      }`}
                    />
                    <span>
                      {isOffline ? "0 Réseau · 100% Local en RAM" : "En ligne (Prêt pour le test)"}
                    </span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-2xl">
                  {isOffline ? (
                    <span className="text-foreground">
                      <strong>Zéro octet ne quitte votre machine.</strong> Toutes les déductions
                      s'exécutent strictement dans la mémoire vive de votre processeur. Même sans
                      Wi-Fi ni 4G, le site est pleinement opérationnel.
                    </span>
                  ) : (
                    <span>
                      <strong>Vous avez un doute sur la confidentialité ?</strong> Coupez votre Wi-Fi
                      ou activez le mode avion sur votre PC : le site continue de fonctionner à 100%
                      à l'identique grâce au Service Worker PWA embarqué.
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onInstall}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 hover:scale-102 cursor-pointer"
                title="Installer Regex Genius comme une application locale autonome sur votre PC"
              >
                {isInstalled ? (
                  <>
                    <Laptop className="size-4" />
                    <span>Application installée</span>
                  </>
                ) : (
                  <>
                    <Download className="size-4" />
                    <span>Installer sur mon PC</span>
                  </>
                )}
              </button>
            </div>
          </div>
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
