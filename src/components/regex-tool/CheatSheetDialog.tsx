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
    example: "Retire le pouvoir spécial des symboles : \\. = un vrai point, \\( = vraie parenthèse, \\? = vrai ?",
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
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-surface border-border">
          {/* En-tête */}
          <DialogHeader className="p-4 sm:p-5 border-b border-border/80 bg-surface-2/40">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <BookOpen className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <span>Pense-bête Regex condensé (Cheat Sheet)</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">
                    95 % des cas
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Comprendre, décrypter et débugger les expressions régulières avec des exemples concrets en 1 clic.
                </DialogDescription>
              </div>
            </div>

            {/* Barre de recherche */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un symbole (ex: \\d, +, ?, ^, parenthèse, chiffre)..."
                className="w-full rounded-md border border-border bg-background py-1.5 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Onglets des catégories */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 no-scrollbar">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
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
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            <div className="rounded-lg border border-border bg-background/80 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
                    <th className="py-2.5 px-3 w-[110px]">Symbole</th>
                    <th className="py-2.5 px-3">Ce que ça cible / Rôle</th>
                    <th className="py-2.5 px-3 hidden sm:table-cell">Exemple concret</th>
                    <th className="py-2.5 px-2 text-right w-[50px]">Copier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.map((item, idx) => (
                    <tr
                      key={idx}
                      id={`cheatsheet-row-${item.symbol}`}
                      className="hover:bg-surface-2/40 transition-colors group"
                    >
                      {/* Symbole seul sans bouton doublon */}
                      <td className="py-2.5 px-3 font-mono font-bold align-middle">
                        <button
                          onClick={() => copySymbol(item.symbol)}
                          className="inline-flex items-center gap-1 font-mono text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/25 transition cursor-pointer"
                          title="Cliquer pour copier ce symbole"
                        >
                          <span>{item.symbol}</span>
                        </button>
                      </td>

                      {/* Rôle */}
                      <td className="py-2.5 px-3 text-foreground font-medium align-middle">
                        <div>{item.target}</div>
                        <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground sm:hidden mt-1 font-mono">
                          <span className="truncate">Ex : {item.example}</span>
                          <button
                            type="button"
                            onClick={() => handleShowDetail(item.symbol)}
                            className="shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border bg-surface-2 hover:bg-surface-3 text-muted-foreground hover:text-amber-300 border-border/80"
                          >
                            <Plus className="size-2.5" />
                            <span>+ d’ex</span>
                          </button>
                        </div>
                      </td>

                      {/* Exemple concret avec l'unique bouton + d'ex à droite */}
                      <td className="py-2.5 px-3 text-muted-foreground text-[11px] hidden sm:table-cell font-mono align-middle">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{item.example}</span>
                          <button
                            type="button"
                            onClick={() => handleShowDetail(item.symbol)}
                            className="shrink-0 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition cursor-pointer border bg-surface-2 hover:bg-surface-3 text-muted-foreground hover:text-amber-300 border-border/80 shadow-2xs"
                            title="Ouvrir la boîte d'exemples de ce symbole"
                          >
                            <Plus className="size-2.5" />
                            <span>+ d’ex</span>
                          </button>
                        </div>
                      </td>

                      {/* Bouton copier */}
                      <td className="py-2.5 px-2 text-right align-middle">
                        <button
                          onClick={() => copySymbol(item.symbol)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-2 transition cursor-pointer"
                          title="Copier le symbole"
                        >
                          {copiedSymbol === item.symbol ? (
                            <Check className="size-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="size-3.5 opacity-60 group-hover:opacity-100" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground text-xs">
                        Aucun symbole regex ne correspond à votre recherche « {search} ».
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bloc d'aide mnémotechnique supplémentaire */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs space-y-1.5 text-muted-foreground">
              <div className="flex items-center gap-1.5 font-semibold text-primary">
                <CheckCircle2 className="size-4" />
                <span>Règle d'or pour débugger : l'échappement par antislash \</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Les symboles <code className="text-amber-300 font-mono">. * + ? ( ) [ ] {'{ }'} ^ $ | \</code> ont un super-pouvoir en regex.
                Pour cibler le <strong>vrai caractère littéral</strong> dans votre texte, placez toujours un antislash devant :
                <code className="text-foreground font-mono ml-1 font-semibold">\.</code> (vrai point),
                <code className="text-foreground font-mono ml-1 font-semibold">\(</code> (vraie parenthèse),
                <code className="text-foreground font-mono ml-1 font-semibold">\?</code> (vrai point d'interrogation).
              </p>
            </div>
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
