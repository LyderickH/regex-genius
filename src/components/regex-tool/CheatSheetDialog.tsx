import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Search,
  Copy,
  Check,
  Layers,
  Clock,
  Compass,
  Code2,
  CheckCircle2,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SymbolDetailDialog } from "./SymbolDetailDialog";

interface CheatSheetItem {
  symbol: string;
  target: string;
  example: string;
  explanation?: string;
  category: "classes" | "quantifiers" | "anchors" | "groups" | "advanced";
}

const CHEAT_SHEET_DATA: CheatSheetItem[] = [
  // 1. Que chercher ? (Les classes de caractères)
  {
    symbol: ".",
    target: "N'importe quel caractère (sauf saut de ligne)",
    example: "a.c trouve abc, a1c, a-c",
    category: "classes",
  },
  {
    symbol: "\\d",
    target: "Un chiffre (0-9)",
    example: "\\d\\d trouve 42",
    category: "classes",
  },
  {
    symbol: "\\w",
    target: "Lettre, chiffre ou tiret bas _",
    example: "\\w+ trouve un mot standard",
    category: "classes",
  },
  {
    symbol: "\\s",
    target: "Espace, tabulation, saut de ligne",
    example: "prénom\\snom trouve 'prénom nom'",
    category: "classes",
  },
  {
    symbol: "[a-z]",
    target: "Une lettre minuscule de a à z",
    example: "[a-z] trouve e",
    category: "classes",
  },
  {
    symbol: "[A-Z]",
    target: "Une lettre majuscule de A à Z",
    example: "[A-Z] trouve E",
    category: "classes",
  },
  {
    symbol: "[0-9]",
    target: "Un chiffre",
    example: "Identique à \\d",
    category: "classes",
  },
  {
    symbol: "[^abc]",
    target: "Tout sauf ces caractères",
    example: "[^0-9] exclut les chiffres",
    category: "classes",
  },
  // Compléments classes
  {
    symbol: "\\D",
    target: "Tout sauf un chiffre (inverse de \\d)",
    example: "\\D+ trouve du texte sans chiffres",
    category: "classes",
  },
  {
    symbol: "\\S",
    target: "Tout caractère visible (non-blanc)",
    example: "\\S+ isole les mots sans espaces",
    category: "classes",
  },

  // 2. Combien de fois ? (Les quantificateurs)
  {
    symbol: "?",
    target: "0 ou 1 fois",
    example: "Optionnel (ex: https? trouve http et https)",
    category: "quantifiers",
  },
  {
    symbol: "*",
    target: "0, 1 ou plusieurs",
    example: "Zéro ou autant que possible",
    category: "quantifiers",
  },
  {
    symbol: "+",
    target: "Au moins 1 fois",
    example: "Obligatoire, sans limite haute",
    category: "quantifiers",
  },
  {
    symbol: "{3}",
    target: "Exactement 3 fois",
    example: "Ex: \\d{4} pour une année (ex: 2026)",
    category: "quantifiers",
  },
  {
    symbol: "{2,5}",
    target: "Entre 2 et 5 fois",
    example: "Borne minimale et maximale",
    category: "quantifiers",
  },
  // Compléments quantificateurs
  {
    symbol: "+?",
    target: "Au moins 1 fois (paresseux / lazy)",
    example: "S'arrête dès la 1ère correspondance au lieu d'avaler tout le texte",
    category: "quantifiers",
  },
  {
    symbol: "*?",
    target: "0 ou plusieurs fois (paresseux)",
    example: "Prend le plus petit nombre de caractères possible",
    category: "quantifiers",
  },

  // 3. Où chercher ? (Les ancres & limites)
  {
    symbol: "^",
    target: "Début de la ligne ou de la chaîne",
    example: "^[A-Z] force à commencer par une majuscule",
    category: "anchors",
  },
  {
    symbol: "$",
    target: "Fin de la ligne ou de la chaîne",
    example: "\\.pdf$ vérifie que le fichier finit par .pdf",
    category: "anchors",
  },
  {
    symbol: "\\b",
    target: "Frontière de mot (évite de matcher au milieu d'un mot)",
    example: "\\bchat\\b trouve 'chat' mais pas 'achat'",
    category: "anchors",
  },
  {
    symbol: "\\B",
    target: "Non-frontière de mot",
    example: "\\Bchat trouve 'achat' mais pas 'chat'",
    category: "anchors",
  },

  // 4. Isoler et échapper (Groupes & caractères spéciaux)
  {
    symbol: "( ... )",
    target: "Groupe de capture",
    example: "Met en paquet des éléments et permet d'en extraire la valeur spécifique",
    category: "groups",
  },
  {
    symbol: "(?: ... )",
    target: "Groupe non-capturant (contexte)",
    example: "Regroupe sans extraire la valeur (idéal pour les préfixes/suffixes)",
    category: "groups",
  },
  {
    symbol: "\\",
    target: "Antislash d'échappement",
    example:
      "Retire le pouvoir spécial des symboles : \\. = un vrai point, \\( = vraie parenthèse, \\? = vrai ?",
    category: "groups",
  },
  {
    symbol: "|",
    target: "OU logique",
    example: "chat|chien matche soit 'chat', soit 'chien'",
    category: "groups",
  },
];

const CATEGORIES = [
  { id: "all", label: "Tout le pense-bête", icon: Layers },
  { id: "classes", label: "1. Que chercher ? (Classes)", icon: Code2 },
  { id: "quantifiers", label: "2. Combien de fois ? (Quantificateurs)", icon: Clock },
  { id: "anchors", label: "3. Où chercher ? (Ancres)", icon: Compass },
  { id: "groups", label: "4. Groupes & Échappement", icon: Sparkles },
] as const;

export function CheatSheetDialog({
  open,
  onOpenChange,
  initialSymbol: _initialSymbol,
  onOpenSymbolDetail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSymbol?: string;
  onOpenSymbolDetail?: (symbol: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);
  const [localModalSymbol, setLocalModalSymbol] = useState<string | null>(null);

  const handleShowDetail = (sym: string) => {
    if (onOpenSymbolDetail) {
      onOpenSymbolDetail(sym);
    } else {
      setLocalModalSymbol(sym);
    }
  };

  const filtered = useMemo(() => {
    return CHEAT_SHEET_DATA.filter((item) => {
      if (activeCategory !== "all" && item.category !== activeCategory) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.symbol.toLowerCase().includes(q) ||
        item.target.toLowerCase().includes(q) ||
        item.example.toLowerCase().includes(q)
      );
    });
  }, [search, activeCategory]);

  const copySymbol = async (sym: string) => {
    await navigator.clipboard.writeText(sym);
    setCopiedSymbol(sym);
    toast.success(`Symbole ${sym} copié dans le presse-papiers`);
    setTimeout(() => setCopiedSymbol(null), 1500);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-lg border-border bg-surface p-0">
          {/* En-tête */}
          <DialogHeader className="space-y-0 border-b border-border px-5 py-4 text-left">
            <div className="flex items-start gap-3 pr-8">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary-soft text-primary">
                <BookOpen className="size-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <DialogTitle className="flex flex-wrap items-center gap-2 text-base font-semibold leading-tight text-foreground">
                  <span>Pense-bête Regex (Cheat Sheet)</span>
                  <span className="rounded-md border border-primary/25 bg-primary-soft px-1.5 py-0.5 text-[11px] font-medium text-primary">
                    95 % des cas
                  </span>
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Comprendre, décrypter et débugger les expressions régulières avec des exemples
                  concrets en 1 clic.
                </DialogDescription>
              </div>
            </div>

            {/* Barre de recherche */}
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un symbole (ex: \d, +, ?, ^, parenthèse, chiffre)..."
                className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Onglets des catégories */}
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pt-3">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                      isActive
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </DialogHeader>

          {/* Tableau scrollable des symboles */}
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="overflow-hidden rounded-lg border border-border bg-background/80">
              <table className="w-full table-fixed border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-xs font-semibold text-muted-foreground">
                    <th className="w-[108px] px-3 py-2.5 font-semibold sm:w-[120px]">Symbole</th>
                    <th className="px-3 py-2.5 font-semibold">Ce que ça cible / rôle</th>
                    <th className="hidden w-[42%] px-3 py-2.5 font-semibold sm:table-cell">
                      Exemple concret
                    </th>
                    <th className="w-[60px] px-2 py-2.5 text-right font-semibold">Copier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.map((item, idx) => (
                    <tr
                      key={idx}
                      id={`cheatsheet-row-${item.symbol}`}
                      className="group transition-colors hover:bg-surface-2/40"
                    >
                      {/* Symbole cliquable pour ouvrir la mini-boîte */}
                      <td className="px-3 py-2.5 align-middle">
                        <button
                          type="button"
                          onClick={() => handleShowDetail(item.symbol)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-primary/25 bg-primary-soft px-2 py-0.5 font-mono text-xs font-semibold text-primary transition hover:border-primary/50"
                          title="Cliquer pour ouvrir la boîte d'exemples de ce symbole"
                        >
                          <span>{item.symbol}</span>
                        </button>
                      </td>

                      {/* Rôle */}
                      <td className="px-3 py-2.5 align-middle font-medium text-foreground">
                        <div>{item.target}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground sm:hidden">
                          <span className="max-w-full truncate font-mono">{item.example}</span>
                          <button
                            type="button"
                            onClick={() => handleShowDetail(item.symbol)}
                            className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:bg-surface-3 hover:text-foreground"
                          >
                            <Plus className="size-3" />
                            <span>Exemples</span>
                          </button>
                        </div>
                      </td>

                      {/* Exemple concret avec l'unique bouton Exemples à droite */}
                      <td className="hidden px-3 py-2.5 align-middle text-[11px] text-muted-foreground sm:table-cell">
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate font-mono">{item.example}</span>
                          <button
                            type="button"
                            onClick={() => handleShowDetail(item.symbol)}
                            className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:bg-surface-3 hover:text-foreground"
                            title="Ouvrir la boîte d'exemples de ce symbole"
                          >
                            <Plus className="size-3" />
                            <span>Exemples</span>
                          </button>
                        </div>
                      </td>

                      {/* Bouton copier */}
                      <td className="px-2 py-2.5 text-right align-middle">
                        <button
                          onClick={() => copySymbol(item.symbol)}
                          className="cursor-pointer rounded-md p-1 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                          title="Copier le symbole"
                        >
                          {copiedSymbol === item.symbol ? (
                            <Check className="size-3.5 text-success" />
                          ) : (
                            <Copy className="size-3.5 opacity-60 group-hover:opacity-100" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                        Aucun symbole regex ne correspond à votre recherche « {search} ».
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bloc d'aide mnémotechnique supplémentaire */}
            <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary-soft p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-semibold text-primary">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>Règle d'or pour débugger : l'échappement par antislash \</span>
              </div>
              <p className="leading-relaxed">
                Les symboles{" "}
                <code className="font-mono text-primary">. * + ? ( ) [ ] {"{ }"} ^ $ | \</code> ont
                un super-pouvoir en regex. Pour cibler le <strong>vrai caractère littéral</strong>{" "}
                dans votre texte, placez toujours un antislash devant :
                <code className="ml-1 font-mono font-semibold text-foreground">\.</code> (vrai
                point),
                <code className="ml-1 font-mono font-semibold text-foreground">\(</code> (vraie
                parenthèse),
                <code className="ml-1 font-mono font-semibold text-foreground">\?</code> (vrai point
                d'interrogation).
              </p>
            </div>
          </div>

          {/* Pied */}
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mini-boîte d'exemples autonome (si ouverte directement depuis CheatSheet) */}
      <SymbolDetailDialog
        symbol={localModalSymbol}
        open={Boolean(localModalSymbol)}
        onOpenChange={(isOpen) => !isOpen && setLocalModalSymbol(null)}
      />
    </>
  );
}
