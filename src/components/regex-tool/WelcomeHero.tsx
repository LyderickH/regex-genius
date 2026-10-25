import { useState } from "react";
import {
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
  Github,
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
  onImportFile: (file: File, mode?: "with_delimiter" | "without_delimiter") => void;
  onOpenPaste: (initialMode?: "with_delimiter" | "without_delimiter") => void;
  onStartBlank: () => void;
  onOpenCheatSheet?: () => void;
  onOpenFormatsGuide?: () => void;
  isOffline?: boolean;
  canInstall?: boolean;
  isInstalled?: boolean;
  onInstall?: () => void;
}

export function WelcomeHero({
  onLoadSample1,
  onLoadSample2,
  onLoadSample,
  onLoadPreset,
  onImportFile,
  onOpenPaste,
  onStartBlank,
  onOpenFormatsGuide,
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
      className={`relative flex min-h-full flex-1 flex-col overflow-y-auto px-4 py-8 sm:px-6 sm:py-12 transition-colors ${
        isDragging ? "bg-primary/5 border-2 border-dashed border-primary" : "bg-background"
      }`}
    >
      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-start text-left">
        {/* Titre principal */}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-[2.5rem] text-foreground max-w-4xl leading-tight">
          Extrayez vos données, sans écrire de Regex
        </h1>

        {/* Sous-titre */}
        <p className="mt-4 max-w-2xl text-base text-muted-foreground leading-relaxed">
          À la manière de la « Colonne à partir d'exemples » de Power Query et Excel :
          donnez 1 ou 2 exemples attendus, Regex Genius déduit instantanément l'expression régulière
          optimale et remplit tout votre tableau.
        </p>

        {/* Lien d'aide : C'est quoi une Regex (le Cheat Sheet est dans l'en-tête) */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <HoverCard openDelay={80} closeDelay={150}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className="group inline-flex items-center gap-1.5 font-medium text-primary cursor-help"
              >
                <HelpCircle className="size-4" />
                <span className="underline underline-offset-4 decoration-primary/40 group-hover:decoration-primary">
                  C'est quoi une <strong>Regex</strong> ?
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  (Explication 30s)
                </span>
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              align="start"
              side="bottom"
              sideOffset={10}
              className="z-50 w-96 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover p-5 text-foreground shadow-md text-left tracking-normal font-sans"
            >
              <div className="flex items-start gap-3">
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

                <div className="rounded-md border border-border bg-surface-2 p-3">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground mb-1.5">
                    <span>Syntaxe manuelle classique :</span>
                    <span className="text-[10px] text-amber-400 font-medium">Complexe & cryptique</span>
                  </div>
                  <code className="block rounded bg-background px-2.5 py-1.5 font-mono text-[11px] text-foreground break-all select-all border border-border">
                    (?&lt;=FAC-)\d&#123;4&#125;-[A-Z0-9]+(?=\s*\|)
                  </code>
                </div>

                <div className="rounded-md border border-border p-3 text-foreground">
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

        {/* Grille des 2 actions principales d'ingestion */}
        <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 text-left">
          {/* Action 1 : Importer un fichier */}
          <label className="group relative flex cursor-pointer flex-col justify-between rounded-md border border-input bg-surface p-6 transition-colors hover:border-primary">
            <input
              type="file"
              accept=".txt,.csv,.tsv,.xlsx,.xls,.log"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportFile(file);
              }}
            />
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Upload className="size-4 text-muted-foreground" />
                Importer vos données
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                Glissez-déposez ou parcourez un fichier, jusqu'à 1M+ de lignes.
              </p>

              {/* Formats acceptés, listés une seule fois ; chaque format ouvre le guide */}
              <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground">Formats :</span>
                {[".xlsx", ".csv", ".tsv", ".txt", ".log"].map((ext) => (
                  <span
                    key={ext}
                    onClick={(e) => {
                      if (!onOpenFormatsGuide) return;
                      e.preventDefault();
                      e.stopPropagation();
                      onOpenFormatsGuide();
                    }}
                    className={`rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground ${
                      onOpenFormatsGuide ? "hover:border-primary hover:text-primary transition cursor-pointer" : ""
                    }`}
                    title={onOpenFormatsGuide ? `Voir les détails et structure pour le format ${ext}` : undefined}
                  >
                    {ext}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <span className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground group-hover:bg-primary/90">
                <span>Parcourir mes fichiers</span>
                <ArrowRight className="ml-1.5 size-4" />
              </span>
              <div className="flex items-center gap-1.5 text-[11px]" onClick={(e) => e.stopPropagation()}>
                <label className="cursor-pointer rounded-md border border-border px-2 py-0.5 text-muted-foreground hover:border-input hover:text-foreground transition font-medium">
                  Avec délimiteur
                  <input
                    type="file"
                    accept=".txt,.csv,.tsv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onImportFile(file, "with_delimiter");
                      e.target.value = "";
                    }}
                  />
                </label>
                <label className="cursor-pointer rounded-md border border-border px-2 py-0.5 text-muted-foreground hover:border-input hover:text-foreground transition font-medium">
                  Sans délimiteur
                  <input
                    type="file"
                    accept=".txt,.csv,.tsv,.xlsx,.xls,.log"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onImportFile(file, "without_delimiter");
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          </label>

          {/* Action 2 : Tableau vierge / Coller du texte */}
          <div
            onClick={onStartBlank}
            className="group relative flex flex-col justify-between rounded-md border border-border bg-surface p-6 transition-colors hover:border-input text-left cursor-pointer"
          >
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <ClipboardPaste className="size-4 text-muted-foreground" />
                Coller du texte ou Grille vierge
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                Faites <strong>Ctrl+V</strong> n'importe où sur l'écran pour importer vos données instantanément (depuis Excel, CSV ou bloc-notes), ou démarrez sur une grille vide.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPaste();
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5 transition"
              >
                <ClipboardPaste className="size-3.5" />
                <span>Coller du texte</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartBlank();
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:border-input transition"
              >
                <Plus className="size-3.5" />
                <span>Grille vide</span>
              </button>
            </div>
          </div>
        </div>

        {/* Encart explicatif rapide des formats et structure attendue */}
        <div className="mt-4 flex w-full flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-md bg-surface-2 p-4 text-left">
          <div className="flex items-start gap-3">
            <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <div className="text-sm font-semibold text-foreground">Structure attendue</div>
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                Une colonne <strong>Source</strong> avec vos lignes brutes (logs, factures, exports), et une colonne résultat où vous saisissez vos exemples.
              </p>
            </div>
          </div>
          {onOpenFormatsGuide && (
            <button
              type="button"
              onClick={onOpenFormatsGuide}
              className="inline-flex items-center gap-1.5 shrink-0 rounded-md border border-input bg-surface px-3 py-1.5 text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition cursor-pointer self-stretch sm:self-auto justify-center"
            >
              <span>Explication des formats</span>
              <ArrowRight className="size-3.5" />
            </button>
          )}
        </div>

        {/* Séparateur & En-tête des modèles métiers */}
        <div className="mt-12 flex w-full items-end justify-between gap-4 text-left">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Ou essayez en 1 clic sur un cas d'usage métier :
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Ces modèles chargent des données réelles et déduisent les expressions immédiatement.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSample2}
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline cursor-pointer"
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
                className="group relative flex flex-col rounded-md border border-border bg-surface p-4 transition-colors hover:border-primary text-left cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <Icon className="size-4" />
                    <span className="font-medium">
                      {preset.category}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {preset.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-normal line-clamp-2 group-hover:line-clamp-none group-focus-visible:line-clamp-none">
                    {preset.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bannière Défi Mode Avion (Hors-ligne immédiat dans le navigateur) */}
        <div
          className={`mt-10 w-full rounded-md border p-5 transition-colors text-left ${
            isOffline
              ? "border-emerald-500 bg-emerald-950"
              : "border-border bg-surface"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              {isOffline ? (
                <WifiOff className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              ) : (
                <Plane className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {isOffline
                    ? "Défi relevé : Mode avion actif !"
                    : "Défi Confidentialité : Testez en Mode Avion"}
                </div>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  {isOffline ? (
                    <span className="text-foreground">
                      <strong>Zéro octet ne quitte votre machine.</strong> Toutes les déductions
                      s'exécutent strictement dans la mémoire vive de votre ordinateur. Même sans
                      Wi-Fi ni 4G, le site est pleinement opérationnel.
                    </span>
                  ) : (
                    <span>
                      <strong>Inutile d'installer quoi que ce soit :</strong> coupez simplement votre Wi-Fi
                      ou activez le mode avion sur votre PC. Grâce au Service Worker, cette page continue
                      immédiatement de fonctionner à 100% dans cet onglet, sans aucun accès réseau.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Bouton d'installation facultatif clairement séparé */}
            {!isInstalled && (
              <div className="flex shrink-0 sm:flex-col sm:items-end justify-between items-center gap-1 border-t sm:border-t-0 sm:border-l border-border pt-3 sm:pt-0 sm:pl-4">
                <span className="text-[10px] text-muted-foreground">Optionnel :</span>
                <button
                  type="button"
                  onClick={onInstall}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:border-primary hover:text-primary transition cursor-pointer"
                  title="Installer comme application autonome sur votre bureau Windows"
                >
                  <Download className="size-3.5 text-primary" />
                  <span>Installer sur PC</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Badges de garanties & caractéristiques */}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4" />
            <span>100% privé dans votre navigateur</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="size-4" />
            <span>Calcul instantané multithreadé</span>
          </div>
          <div className="flex items-center gap-2">
            <Split className="size-4" />
            <span>Extraction multi-colonnes</span>
          </div>
        </div>

        {/* Pied de page : liens Portfolio & Repo GitHub */}
        <footer className="mt-12 flex w-full flex-wrap items-center gap-4 sm:gap-6 border-t border-border pt-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span>Créé par</span>
            <a
              href="https://lyderickh.github.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>Lydérick Henry</span>
            </a>
          </div>
          <span className="text-border hidden sm:inline">•</span>
          <a
            href="https://github.com/LyderickH/regex-genius"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-foreground/80 hover:text-foreground transition"
          >
            <Github className="size-3.5" />
            <span>Code source GitHub (open source)</span>
          </a>
        </footer>
      </div>
    </div>
  );
}
