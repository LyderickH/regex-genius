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
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Info,
} from "lucide-react";

interface SupportedFormatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupportedFormatsDialog({ open, onOpenChange }: SupportedFormatsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-border/80 bg-surface/98 p-6 text-foreground shadow-2xl backdrop-blur-xl font-sans">
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-cyan-500 text-slate-950 font-bold shadow-sm">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Formats de fichiers & structure attendus
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Comprendre comment formater et importer vos données pour réussir vos expressions régulières.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Le concept clé en 30 secondes */}
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4 text-left">
          <div className="flex items-center gap-2 text-xs font-bold text-primary mb-1.5">
            <Sparkles className="size-4" />
            <span>Le principe clé de Regex Genius (Ne pas se faire piéger) :</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Regex Genius n'est pas un simple visualiseur de tableur. C'est un moteur qui déduit une <strong>expression régulière</strong> en reliant une <strong>colonne de texte brut (Source)</strong> à <strong>1 ou 2 exemples attendus (Résultat)</strong>.
          </p>

          {/* Démonstration visuelle en tableau */}
          <div className="mt-3 overflow-hidden rounded-lg border border-border/80 bg-background/80 font-mono text-[11px]">
            <div className="grid grid-cols-2 border-b border-border bg-surface-2 px-3 py-1.5 font-sans font-bold text-muted-foreground text-[11px]">
              <div>COLONNE SOURCE (Ce que vous avez)</div>
              <div>COLONNE RÉSULTAT (Ce que vous voulez)</div>
            </div>
            <div className="divide-y divide-border/50 px-3">
              <div className="grid grid-cols-2 py-1.5 items-center">
                <span className="text-foreground truncate pr-2">VIR SEPA 15/01 FACT F2026-0892 1 250,00 €</span>
                <span className="text-primary font-bold">F2026-0892 <span className="text-[10px] font-sans font-normal text-muted-foreground">(Exemple 1 saisi par vous)</span></span>
              </div>
              <div className="grid grid-cols-2 py-1.5 items-center">
                <span className="text-foreground truncate pr-2">PRLV FOURN FACT INV-99412 840,00 €</span>
                <span className="text-primary font-bold">INV-99412 <span className="text-[10px] font-sans font-normal text-muted-foreground">(Optionnel : Exemple 2)</span></span>
              </div>
              <div className="grid grid-cols-2 py-1.5 items-center bg-emerald-500/5">
                <span className="text-foreground truncate pr-2">VIR EMIS PIECE FACT-45120 6 300,00 €</span>
                <span className="text-emerald-400 font-bold">FACT-45120 <span className="text-[10px] font-sans font-normal text-emerald-400/80">✨ Auto-déduit par la Regex !</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Grille des 4 grands formats supportés */}
        <div className="mt-4 space-y-3 text-left">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Types de fichiers pris en charge :
          </h4>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* 1. Fichiers Texte / Logs */}
            <div className="rounded-xl border border-border bg-surface-2/40 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <FileText className="size-4 text-amber-400" />
                <span>Logs & Fichiers texte (.txt, .log)</span>
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">.txt</span>
                <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">.log</span>
                <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">UTF-8 / ANSI</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Idéal pour les logs serveur (Apache, Nginx), traces applicatives, exports bancaires ou blocs de texte brut.
              </p>
              <div className="text-[10px] text-amber-400/90 font-medium">
                👉 Recommandé : import automatique en 1 colonne brute.
              </div>
            </div>

            {/* 2. CSV / TSV */}
            <div className="rounded-xl border border-border bg-surface-2/40 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <Split className="size-4 text-primary" />
                <span>Fichiers délimités (.csv, .tsv)</span>
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">.csv</span>
                <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">.tsv</span>
                <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">Séparateurs : ; , \t |</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Deux modes possibles :
                <br />• <strong>Sans délimiteur (Recommandé Regex)</strong> : conserve la ligne complète pour en extraire des champs.
                <br />• <strong>Avec délimiteur</strong> : découpe le CSV en colonnes existantes.
              </p>
            </div>

            {/* 3. Classeurs Excel */}
            <div className="rounded-xl border border-border bg-surface-2/40 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <FileSpreadsheet className="size-4 text-emerald-400" />
                <span>Classeurs Excel (.xlsx, .xls)</span>
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">.xlsx</span>
                <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">.xls</span>
                <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">Feuille 1 lue direct</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Les colonnes de votre feuille Excel sont importées. Vous choisissez quelle colonne contient le texte brut à analyser, puis écrivez vos exemples dans la colonne d'à côté.
              </p>
            </div>

            {/* 4. Presse-papier Ctrl+V */}
            <div className="rounded-xl border border-border bg-surface-2/40 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <ClipboardPaste className="size-4 text-cyan-400" />
                <span>Copier-Coller direct (Ctrl+V)</span>
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">Presse-papier</span>
                <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">Multi-lignes</span>
                <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">Ctrl+V actif partout</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Copiez une plage de cellules depuis Excel ou un extrait de texte dans le bloc-notes, et faites <strong>Ctrl+V</strong> n'importe où sur l'écran pour charger vos données en 1 seconde.
              </p>
            </div>
          </div>
        </div>

        {/* Le piège classique à éviter absolument */}
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-left text-xs leading-relaxed space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertTriangle className="size-4 shrink-0 text-amber-400" />
            <span>Erreur fréquente : Ne remplissez pas 100 % des lignes !</span>
          </div>
          <p className="text-muted-foreground">
            Si vous importez un tableau où <strong>toutes les lignes contiennent déjà le résultat</strong>, Regex Genius pensera que vous voulez lui imposer des centaines d'exemples stricts au lieu de lui laisser déduire la formule.
            <br />
            👉 <strong>Laissez la colonne de résultat vide</strong>, sauf sur les 1 ou 2 premières lignes !
          </p>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition cursor-pointer"
          >
            J'ai compris, fermer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
