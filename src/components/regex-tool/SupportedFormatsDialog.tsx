import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText,
  FileSpreadsheet,
  Split,
  ClipboardPaste,
  AlertTriangle,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SupportedFormatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Puce d'information : monospace uniquement pour les extensions / valeurs techniques. */
function Chip({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] text-muted-foreground",
        mono && "font-mono",
      )}
    >
      {children}
    </span>
  );
}

function FormatCard({
  icon,
  title,
  chips,
  children,
}: {
  icon: ReactNode;
  title: string;
  chips: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface-2/40 p-3.5">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <div className="flex flex-wrap gap-1">{chips}</div>
      <div className="text-xs leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

const DEMO_ROWS = [
  {
    source: "VIR SEPA 15/01 FACT F2026-0892 1 250,00 €",
    result: "F2026-0892",
    note: "Exemple 1 saisi par vous",
    derived: false,
  },
  {
    source: "PRLV FOURN FACT INV-99412 840,00 €",
    result: "INV-99412",
    note: "Optionnel : exemple 2",
    derived: false,
  },
  {
    source: "VIR EMIS PIECE FACT-45120 6 300,00 €",
    result: "FACT-45120",
    note: "Déduit automatiquement par la regex",
    derived: true,
  },
];

export function SupportedFormatsDialog({ open, onOpenChange }: SupportedFormatsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-lg border-border bg-surface p-0 text-foreground shadow-2xl">
        {/* En-tête */}
        <DialogHeader className="space-y-0 border-b border-border px-5 py-4 text-left">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary-soft text-primary">
              <FileSpreadsheet className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-base font-semibold leading-tight text-foreground">
                Formats de fichiers et structure attendus
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Comprendre comment formater et importer vos données pour réussir vos expressions
                régulières.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Corps */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-left">
          {/* Le concept clé en 30 secondes */}
          <section className="rounded-lg border border-primary/25 bg-primary-soft p-4">
            <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-primary">
              <Sparkles className="size-4 shrink-0" />
              <span>Le principe clé de Regex Genius</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Regex Genius n'est pas un simple visualiseur de tableur. C'est un moteur qui déduit
              une <strong className="text-foreground">expression régulière</strong> en reliant une{" "}
              <strong className="text-foreground">colonne de texte brut (source)</strong> à{" "}
              <strong className="text-foreground">1 ou 2 exemples attendus (résultat)</strong>.
            </p>

            {/* Démonstration visuelle en tableau */}
            <div className="mt-3 overflow-hidden rounded-lg border border-border bg-background/80 text-[11px]">
              <div className="hidden grid-cols-2 gap-3 border-b border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground sm:grid">
                <div>Colonne source (ce que vous avez)</div>
                <div>Colonne résultat (ce que vous voulez)</div>
              </div>
              <div className="divide-y divide-border/50">
                {DEMO_ROWS.map((row) => (
                  <div
                    key={row.result}
                    className={cn(
                      "grid grid-cols-1 gap-x-3 gap-y-1 px-3 py-2 sm:grid-cols-2 sm:items-center sm:py-1.5",
                      row.derived && "bg-success-soft",
                    )}
                  >
                    <span className="min-w-0 truncate font-mono text-foreground">{row.source}</span>
                    <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <ArrowRight className="size-3 shrink-0 text-muted-foreground sm:hidden" />
                      <span
                        className={cn(
                          "font-mono font-semibold",
                          row.derived ? "text-success" : "text-primary",
                        )}
                      >
                        {row.result}
                      </span>
                      <span
                        className={cn(
                          "text-[11px]",
                          row.derived ? "text-success/80" : "text-muted-foreground",
                        )}
                      >
                        ({row.note})
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Grille des 4 grands formats supportés */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">
              Types de fichiers pris en charge
            </h4>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormatCard
                icon={<FileText className="size-4 shrink-0 text-primary" />}
                title="Logs et fichiers texte"
                chips={
                  <>
                    <Chip mono>.txt</Chip>
                    <Chip mono>.log</Chip>
                    <Chip mono>UTF-8 / ANSI</Chip>
                  </>
                }
              >
                <p>
                  Idéal pour les logs serveur (Apache, Nginx), traces applicatives, exports
                  bancaires ou blocs de texte brut.
                </p>
                <p className="mt-1.5 font-medium text-primary">
                  Recommandé : import automatique en 1 colonne brute.
                </p>
              </FormatCard>

              <FormatCard
                icon={<Split className="size-4 shrink-0 text-primary" />}
                title="Fichiers délimités"
                chips={
                  <>
                    <Chip mono>.csv</Chip>
                    <Chip mono>.tsv</Chip>
                    <Chip>
                      Séparateurs : <span className="font-mono">; , \t |</span>
                    </Chip>
                  </>
                }
              >
                <p>Deux modes possibles :</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  <li>
                    <strong className="text-foreground">Sans délimiteur (recommandé)</strong> :
                    conserve la ligne complète pour en extraire des champs.
                  </li>
                  <li>
                    <strong className="text-foreground">Avec délimiteur</strong> : découpe le CSV en
                    colonnes existantes.
                  </li>
                </ul>
              </FormatCard>

              <FormatCard
                icon={<FileSpreadsheet className="size-4 shrink-0 text-success" />}
                title="Classeurs Excel"
                chips={
                  <>
                    <Chip mono>.xlsx</Chip>
                    <Chip mono>.xls</Chip>
                    <Chip>Feuille 1 lue directement</Chip>
                  </>
                }
              >
                <p>
                  Les colonnes de votre feuille Excel sont importées. Vous choisissez quelle colonne
                  contient le texte brut à analyser, puis écrivez vos exemples dans la colonne d'à
                  côté.
                </p>
              </FormatCard>

              <FormatCard
                icon={<ClipboardPaste className="size-4 shrink-0 text-derived" />}
                title="Copier-coller direct (Ctrl+V)"
                chips={
                  <>
                    <Chip>Presse-papier</Chip>
                    <Chip>Multi-lignes</Chip>
                    <Chip>Ctrl+V actif partout</Chip>
                  </>
                }
              >
                <p>
                  Copiez une plage de cellules depuis Excel ou un extrait de texte dans le
                  bloc-notes, et faites <strong className="text-foreground">Ctrl+V</strong>{" "}
                  n'importe où sur l'écran pour charger vos données en 1 seconde.
                </p>
              </FormatCard>
            </div>
          </section>

          {/* Le piège classique à éviter absolument */}
          <section className="space-y-1.5 rounded-lg border border-warn/30 bg-warn/10 p-3.5 text-xs leading-relaxed">
            <div className="flex items-center gap-2 text-sm font-semibold text-warn">
              <AlertTriangle className="size-4 shrink-0" />
              <span>Erreur fréquente : ne remplissez pas 100 % des lignes</span>
            </div>
            <p className="text-muted-foreground">
              Si vous importez un tableau où{" "}
              <strong className="text-foreground">
                toutes les lignes contiennent déjà le résultat
              </strong>
              , Regex Genius pensera que vous voulez lui imposer des centaines d'exemples stricts au
              lieu de lui laisser déduire la formule.
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Laissez la colonne de résultat vide</strong>, sauf
              sur les 1 ou 2 premières lignes.
            </p>
          </section>
        </div>

        {/* Pied */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
            J'ai compris, fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
