import { useRef, useState } from "react";
import {
  Sparkles,
  Upload,
  ClipboardPaste,
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
  Receipt,
  Users,
  Globe,
  Landmark,
  Github,
  BookOpen,
} from "lucide-react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

const ACCEPTED_FORMATS = [".xlsx", ".csv", ".tsv", ".txt", ".log"];

export function WelcomeHero({
  onLoadSample1,
  onLoadSample2,
  onLoadSample,
  onLoadPreset,
  onImportFile,
  onOpenPaste,
  onStartBlank,
  onOpenCheatSheet,
  onOpenFormatsGuide,
  isOffline = false,
  canInstall = false,
  isInstalled = false,
  onInstall,
}: WelcomeHeroProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const openFormatsGuide = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenFormatsGuide?.();
  };

  return (
    <div
      data-welcome-hero
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex min-h-full min-w-0 flex-1 flex-col items-center overflow-x-hidden overflow-y-auto px-4 py-8 transition-colors sm:px-6 sm:py-12 ${
        isDragging ? "border-2 border-dashed border-primary bg-primary-soft" : "bg-background"
      }`}
    >
      <div className="mx-auto my-auto flex w-full min-w-0 max-w-5xl flex-col items-center text-center">
        {/* Badge du haut */}
        <div className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5 shrink-0 text-primary" />
          <span>Synthèse d'expressions régulières par l'exemple</span>
        </div>

        {/* Titre principal */}
        <h1 className="mt-5 max-w-4xl text-3xl font-bold leading-tight tracking-tight text-foreground text-balance sm:text-4xl md:text-5xl">
          Extrayez vos données, sans écrire de <span className="text-primary">Regex</span>
        </h1>

        {/* Sous-titre */}
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          À la manière de la « Colonne à partir d'exemples » de Power Query et Excel : donnez 1 ou 2
          exemples attendus, Regex Genius déduit instantanément l'expression régulière optimale et
          remplit tout votre tableau.
        </p>

        {/* Aide : C'est quoi une Regex + pense-bête */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
          <HoverCard openDelay={80} closeDelay={150}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className="inline-flex cursor-help items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-surface-2 hover:text-foreground"
              >
                <HelpCircle className="size-3.5 text-primary" />
                <span>
                  C'est quoi une <strong className="text-foreground">Regex</strong> ?
                </span>
                <span className="text-muted-foreground/80">· explication en 30 s</span>
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              align="center"
              side="bottom"
              sideOffset={10}
              className="z-50 w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-5 text-left font-sans tracking-normal text-foreground shadow-xl"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    C'est quoi une « Regex » ?
                  </h3>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Expression Régulière · Regular Expression
                  </p>
                </div>
              </div>

              <div className="mt-3.5 space-y-3 text-xs leading-relaxed text-muted-foreground">
                <p className="leading-normal text-foreground/90">
                  C'est une <strong>formule de recherche textuelle avancée</strong> permettant de
                  détecter, extraire ou vérifier des motifs précis (emails, dates, montants, numéros
                  de facture) perdus dans des blocs de texte brut.
                </p>

                <div className="rounded-md border border-border bg-surface-2 p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold text-muted-foreground">
                    <span>Syntaxe manuelle classique :</span>
                    <span className="font-medium text-warn">Complexe et cryptique</span>
                  </div>
                  <code className="block select-all break-all rounded border border-border bg-background px-2.5 py-1.5 font-mono text-[11px] text-primary">
                    (?&lt;=FAC-)\d&#123;4&#125;-[A-Z0-9]+(?=\s*\|)
                  </code>
                </div>

                <div className="rounded-md border border-primary/30 bg-primary-soft p-3 text-foreground">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                    <CheckCircle2 className="size-3.5" />
                    <span>La solution Regex Genius :</span>
                  </div>
                  <p className="text-xs leading-normal text-muted-foreground">
                    <strong className="text-foreground">Vous n'avez rien à apprendre.</strong>{" "}
                    Saisissez simplement 1 ou 2 exemples attendus dans votre colonne, et l'outil
                    calcule la formule optimale instantanément pour Excel, Google Sheets, Power
                    Query ou Python.
                  </p>
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>

          {onOpenCheatSheet && (
            <button
              type="button"
              onClick={onOpenCheatSheet}
              className="inline-flex items-center gap-1.5 font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              title="Ouvrir le pense-bête condensé des regex"
            >
              <BookOpen className="size-3.5" />
              <span>Pense-bête regex</span>
            </button>
          )}
        </div>

        {/* Deux actions principales */}
        <div className="mt-8 grid w-full min-w-0 grid-cols-1 gap-4 text-left sm:grid-cols-2">
          {/* Action 1 : Importer un fichier (primaire) */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex min-w-0 cursor-pointer flex-col rounded-lg border border-primary/60 bg-surface p-5 transition-colors hover:border-primary hover:bg-surface-2 sm:p-6"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.tsv,.xlsx,.xls,.log"
              className="hidden"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportFile(file);
                e.target.value = "";
              }}
            />
            <div className="flex size-10 items-center justify-center rounded-md bg-primary-soft text-primary">
              <Upload className="size-5" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-foreground">Importer vos données</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Glissez-déposez un fichier ici ou parcourez vos dossiers, jusqu'à plus d'un million de
              lignes.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>Formats acceptés :</span>
              {ACCEPTED_FORMATS.map((ext) =>
                onOpenFormatsGuide ? (
                  <button
                    key={ext}
                    type="button"
                    onClick={openFormatsGuide}
                    className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-foreground/90 transition-colors hover:border-derived/50 hover:text-derived"
                    title={`Voir les détails et la structure du format ${ext}`}
                  >
                    {ext}
                  </button>
                ) : (
                  <span
                    key={ext}
                    className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-foreground/90"
                  >
                    {ext}
                  </span>
                ),
              )}
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <span>Parcourir mes fichiers</span>
                <ArrowRight className="size-4" />
              </button>
              <div
                className="flex flex-wrap items-center gap-1.5 text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <label className="cursor-pointer rounded-md border border-border px-2 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground">
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
                <label className="cursor-pointer rounded-md border border-border px-2 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground">
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
          </div>

          {/* Action 2 : Coller du texte / Grille vide */}
          <div
            onClick={onStartBlank}
            className="flex min-w-0 cursor-pointer flex-col rounded-lg border border-border bg-surface p-5 text-left transition-colors hover:border-primary/40 hover:bg-surface-2 sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-surface-2 text-foreground">
                <ClipboardPaste className="size-5" />
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                <span className="size-1.5 rounded-full bg-success" />
                Ctrl+V actif partout
              </span>
            </div>
            <h2 className="mt-4 text-base font-semibold text-foreground">
              Coller du texte ou partir d'une grille vide
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Faites{" "}
              <kbd className="rounded border border-border bg-surface-2 px-1 font-mono text-[11px] text-foreground">
                Ctrl+V
              </kbd>{" "}
              n'importe où sur l'écran pour importer vos données (depuis Excel, un CSV ou le
              bloc-notes), ou démarrez sur une grille vide.
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPaste();
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-surface-3"
              >
                <ClipboardPaste className="size-4 text-primary" />
                <span>Coller du texte</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartBlank();
                }}
                className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
              >
                Grille vide
              </button>
            </div>
          </div>
        </div>

        {/* Structure attendue */}
        <div className="mt-4 flex w-full min-w-0 flex-col items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4 text-left sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-derived-soft text-derived">
              <FileSpreadsheet className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
                <span>Structure attendue : 1 colonne source brute + 1 ou 2 exemples souhaités</span>
                <span className="rounded-md bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success">
                  Zéro prise de tête
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Importez vos lignes brutes (logs, factures, exports). Remplissez simplement{" "}
                <strong className="text-foreground">1 ou 2 exemples</strong> sur la colonne résultat
                : Regex Genius calcule la formule et génère tout le reste.
              </p>
            </div>
          </div>
          {onOpenFormatsGuide && (
            <button
              type="button"
              onClick={onOpenFormatsGuide}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 self-stretch rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-derived/50 hover:bg-surface-2 sm:self-auto"
            >
              <span>Explication des formats</span>
              <ArrowRight className="size-3.5" />
            </button>
          )}
        </div>

        {/* Cas d'usage métier */}
        <div className="mt-10 flex w-full flex-col gap-2 border-t border-border pt-6 text-left sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Ou essayez en 1 clic sur un cas d'usage métier
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ces modèles chargent des données réelles et déduisent les expressions immédiatement.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSample2}
            className="inline-flex shrink-0 items-center gap-1.5 self-start text-xs font-medium text-derived underline-offset-4 hover:underline sm:self-auto"
            title="Charger le dataset volumétrique de 1 138 logs d'audit"
          >
            <Database className="size-3.5" />
            <span>Grand dataset (1 138 logs)</span>
          </button>
        </div>

        <div className="mt-3 grid w-full min-w-0 grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
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
                title={`${preset.title} (${preset.category}) : ${preset.description}`}
                className="group flex h-full min-w-0 cursor-pointer flex-col rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-primary/50 hover:bg-surface-2"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="flex size-8 items-center justify-center rounded-md bg-surface-2 text-foreground transition-colors group-hover:bg-primary-soft group-hover:text-primary">
                    <Icon className="size-4" />
                  </div>
                  <span className="truncate rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {preset.category}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground">{preset.title}</h3>
                <TooltipProvider delayDuration={120}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="mt-1 line-clamp-2 text-xs leading-normal text-muted-foreground">
                        {preset.description}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      sideOffset={8}
                      className="z-50 max-w-[280px] rounded-md border border-border bg-popover p-2.5 text-xs text-foreground shadow-xl"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-primary">
                          {preset.title}
                        </span>
                        <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {preset.category}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-foreground/90">
                        {preset.description}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="mt-auto flex items-center pt-3 text-xs font-medium text-primary">
                  <span>Essayer ce cas</span>
                  <ArrowRight className="ml-1 size-3.5" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Bannière mode avion */}
        <div
          className={`mt-8 w-full min-w-0 rounded-lg border bg-surface p-4 text-left transition-colors sm:p-5 ${
            isOffline ? "border-success/60" : "border-border"
          }`}
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-md ${
                  isOffline ? "bg-success-soft text-success" : "bg-surface-2 text-foreground"
                }`}
              >
                {isOffline ? <WifiOff className="size-4.5" /> : <Plane className="size-4.5" />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-foreground">
                    {isOffline
                      ? "Défi relevé : mode avion actif"
                      : "Défi confidentialité : testez en mode avion"}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                      isOffline
                        ? "border-success/30 bg-success-soft text-success"
                        : "border-border bg-surface-2 text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${isOffline ? "bg-success" : "bg-warn"}`}
                    />
                    <span>
                      {isOffline
                        ? "0 réseau · 100 % local en RAM"
                        : "Fonctionne déjà sans connexion"}
                    </span>
                  </span>
                </div>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                  {isOffline ? (
                    <span className="text-foreground">
                      <strong>Zéro octet ne quitte votre machine.</strong> Toutes les déductions
                      s'exécutent strictement dans la mémoire vive de votre ordinateur. Même sans
                      Wi-Fi ni 4G, le site est pleinement opérationnel.
                    </span>
                  ) : (
                    <span>
                      <strong className="text-foreground">
                        Inutile d'installer quoi que ce soit :
                      </strong>{" "}
                      coupez simplement votre Wi-Fi ou activez le mode avion sur votre PC. Grâce au
                      Service Worker, cette page continue immédiatement de fonctionner à 100 % dans
                      cet onglet, sans aucun accès réseau.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {!isInstalled && (
              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border pt-3 sm:flex-col sm:items-end sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                <span className="text-[11px] text-muted-foreground">Optionnel</span>
                <button
                  type="button"
                  onClick={onInstall}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-surface-3"
                  title="Installer comme application autonome sur votre bureau Windows"
                >
                  <Download className="size-3.5 text-primary" />
                  <span>Installer sur PC</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Garanties */}
        <div className="mt-8 grid w-full grid-cols-1 gap-x-6 gap-y-2 text-left text-xs text-muted-foreground sm:flex sm:flex-wrap sm:items-center sm:justify-center">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 shrink-0 text-success" />
            <span>100 % privé dans votre navigateur</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="size-4 shrink-0 text-primary" />
            <span>Calcul instantané multithreadé</span>
          </div>
          <div className="flex items-center gap-2">
            <Split className="size-4 shrink-0 text-derived" />
            <span>Extraction multi-colonnes</span>
          </div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 shrink-0 text-success" />
            <span>Copier-coller Excel fluide</span>
          </div>
        </div>

        {/* Pied de page */}
        <footer className="mt-12 flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-border pt-6 text-xs text-muted-foreground">
          <span>
            Créé par{" "}
            <a
              href="https://lyderickh.github.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
              title="Portfolio de Lydérick Henry"
            >
              Lydérick Henry (portfolio)
            </a>
          </span>
          <span className="hidden text-border sm:inline">·</span>
          <a
            href="https://github.com/LyderickH/regex-genius"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-foreground/80 transition-colors hover:text-foreground"
          >
            <Github className="size-3.5" />
            <span>Code source GitHub</span>
          </a>
          <span className="hidden text-border sm:inline">·</span>
          <span>100 % client-side et open source</span>
        </footer>
      </div>
    </div>
  );
}
