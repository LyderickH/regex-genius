/**
 * Moteur de synthèse d'expressions régulières à partir d'exemples.
 * 100% local : tokenisation, énumération guidée de règles candidates,
 * validation sur tous les exemples fournis, sélection de la plus simple.
 */

/** Transformations classiques appliquées après extraction. */
export type Fmt =
  | "none"
  | "date-fr" // AAAAMMJJ -> JJ/MM/AAAA
  | "date-iso" // AAAAMMJJ -> AAAA-MM-JJ
  | "date-slash" // AAAAMMJJ -> AAAA/MM/JJ
  | "day" // AAAAMMJJ -> jour de la semaine
  | "time" // HHMM ou HHMMSS -> HH:MM[:SS]
  | "div100" // centimes -> euros
  | "mul1000"; // x 1000

/** Nettoyage appliqué après extraction. */
export interface Transform {
  /** suppression : rien, espaces de début/fin, tous les espaces, tout sauf les chiffres */
  strip: "none" | "trim" | "spaces" | "digits";
  /** séparateur décimal : inchangé, virgule -> point, point -> virgule */
  dec: "none" | "dot" | "comma";
  casing: "none" | "upper" | "lower";
  /** transformation classique : date, heure, jour, multiplication… */
  fmt: Fmt;
}

export const NO_TRANSFORM: Transform = { strip: "none", dec: "none", casing: "none", fmt: "none" };

export function isIdentity(t: Transform): boolean {
  return t.strip === "none" && t.dec === "none" && t.casing === "none" && t.fmt === "none";
}

/** Description lisible du nettoyage, ou null s'il n'y en a pas. */
export function describeTransform(t: Transform): string | null {
  const parts: string[] = [];
  if (t.strip === "trim") parts.push("suppression des espaces de début et de fin");
  if (t.strip === "spaces") parts.push("suppression des espaces");
  if (t.strip === "digits") parts.push("conservation des chiffres uniquement");
  if (t.dec === "dot") parts.push("virgule décimale remplacée par un point");
  if (t.dec === "comma") parts.push("point décimal remplacé par une virgule");
  if (t.casing === "upper") parts.push("mise en MAJUSCULES");
  if (t.casing === "lower") parts.push("mise en minuscules");
  if (t.fmt === "date-fr") parts.push("conversion de la date AAAAMMJJ en JJ/MM/AAAA");
  if (t.fmt === "date-iso") parts.push("conversion de la date AAAAMMJJ en AAAA-MM-JJ");
  if (t.fmt === "date-slash") parts.push("conversion de la date AAAAMMJJ en AAAA/MM/JJ");
  if (t.fmt === "day") parts.push("jour de la semaine de la date AAAAMMJJ");
  if (t.fmt === "time") parts.push("conversion de l'heure HHMM ou HHMMSS en HH:MM");
  if (t.fmt === "div100") parts.push("division par 100 (centimes vers euros)");
  if (t.fmt === "mul1000") parts.push("multiplication par 1 000");
  return parts.length ? parts.join(", ") : null;
}

const FMTS: { id: Fmt; cost: number }[] = [
  { id: "none", cost: 0 },
  { id: "date-fr", cost: 3 },
  { id: "date-iso", cost: 3 },
  { id: "date-slash", cost: 3 },
  { id: "time", cost: 3 },
  { id: "day", cost: 4 },
  { id: "div100", cost: 4 },
  { id: "mul1000", cost: 4 },
];

const TRANSFORMS: Transform[] = (() => {
  const out: Transform[] = [];
  for (const strip of ["none", "trim", "spaces", "digits"] as const)
    for (const dec of ["none", "dot", "comma"] as const)
      for (const casing of ["none", "upper", "lower"] as const)
        for (const { id, cost: fc } of FMTS)
          out.push({ strip, dec, casing, fmt: id });
  // les nettoyages les plus simples d'abord
  const cost = (t: Transform) =>
    (t.strip === "none" ? 0 : t.strip === "trim" ? 1 : t.strip === "spaces" ? 2 : 4) +
    (t.dec === "none" ? 0 : 2) +
    (t.casing === "none" ? 0 : 1) +
    FMTS.find((f) => f.id === t.fmt)!.cost;
  return out.sort((a, b) => cost(a) - cost(b));
})();


export interface Rule {
  /** source de l'expression régulière, le groupe 1 contient la valeur extraite */
  source: string;
  flags: string;
  transform: Transform;
  /** règles alternatives, essayées dans l'ordre quand la principale ne s'applique pas */
  extra?: Rule[];
}

export interface Example {
  index: number;
  input: string;
  output: string;
}

export interface SynthResult {
  rule: Rule | null;
  /** valeurs calculées pour chaque ligne (null = pas de correspondance) */
  values: (string | null)[];
  failures: number[];
  matched: number;
  total: number;
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");
}

function escapeClass(s: string): string {
  return s.replace(/[\\\]^-]/g, "\\$&");
}

type Run = { kind: "d" | "a" | "o"; text: string };

function runs(s: string): Run[] {
  const out: Run[] = [];
  for (const ch of s) {
    const kind: Run["kind"] = /[0-9]/.test(ch) ? "d" : /[A-Za-z]/.test(ch) ? "a" : "o";
    const last = out[out.length - 1];
    if (last && last.kind === kind && kind !== "o") last.text += ch;
    else out.push({ kind, text: ch });
  }
  return out;
}

function runsPattern(s: string, exact: boolean): string {
  return runs(s)
    .map((r) => {
      if (r.kind === "d") return exact ? `\\d{${r.text.length}}` : "\\d+";
      if (r.kind === "a") return exact ? `[A-Za-z]{${r.text.length}}` : "[A-Za-z]+";
      return escapeRegex(r.text);
    })
    .join("");
}

/** Transformations classiques : date, heure, jour, opérations. */
function applyFmt(v: string, f: Fmt): string {
  if (f === "none") return v;
  if (f === "date-fr" || f === "date-iso" || f === "date-slash" || f === "day") {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v.trim());
    if (!m) return v;
    if (f === "date-fr") return `${m[3]}/${m[2]}/${m[1]}`;
    if (f === "date-iso") return `${m[1]}-${m[2]}-${m[3]}`;
    if (f === "date-slash") return `${m[1]}/${m[2]}/${m[3]}`;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const jours = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    return jours[d.getDay()] ?? v;
  }
  if (f === "time") {
    const m = /^(\d{2})(\d{2})(\d{2})?$/.exec(v.trim());
    if (!m) return v;
    return m[3] ? `${m[1]}:${m[2]}:${m[3]}` : `${m[1]}:${m[2]}`;
  }
  const n = Number(v.replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
  if (!isFinite(n)) return v;
  if (f === "div100") return (n / 100).toFixed(2).replace(".", ",");
  return String(Math.round(n * 1000));
}

function applyTransform(value: string, t: Transform): string {
  let v = value;
  if (t.strip === "trim") v = v.replace(/^[\s\u00a0\u202f]+|[\s\u00a0\u202f]+$/g, "");
  else if (t.strip === "spaces") v = v.replace(/[\s\u00a0\u202f]/g, "");
  else if (t.strip === "digits") v = v.replace(/[^0-9]/g, "");
  if (t.dec === "dot") v = v.replace(/,/g, ".");
  else if (t.dec === "comma") v = v.replace(/\./g, ",");
  if (t.casing === "upper") v = v.toUpperCase();
  else if (t.casing === "lower") v = v.toLowerCase();
  return applyFmt(v, t.fmt);
}

/** Positions et longueurs du texte brut donnant l'output une fois nettoyé. */
function occurrences(input: string, output: string, t: Transform): { pos: number; len: number }[] {
  const res: { pos: number; len: number }[] = [];
  if (!output) return res;
  // une transformation change la longueur : on essaie toutes les longueurs
  const sameLength = t.strip === "none" && t.fmt === "none";
  for (let i = 0; i < input.length; i++) {
    if (sameLength) {
      if (i + output.length > input.length) break;
      if (applyTransform(input.substr(i, output.length), t) === output)
        res.push({ pos: i, len: output.length });
    } else {
      const max = Math.min(input.length - i, output.length * 2 + 6);
      for (let len = 1; len <= max; len++) {
        if (applyTransform(input.substr(i, len), t) === output) {
          res.push({ pos: i, len });
          break;
        }
      }
    }
    if (res.length >= 4) break;
  }
  return res;
}

function capturePatterns(raw: string, rightChar: string | null): string[] {
  const set = new Set<string>();
  set.add(escapeRegex(raw));
  set.add(runsPattern(raw, true));
  set.add(runsPattern(raw, false));
  if (/^-?\d+$/.test(raw)) {
    set.add("\\d+");
    set.add("-?\\d+");
    if (!raw.startsWith("-")) set.add(`\\d{${raw.length}}`);
  }
  if (/^[A-Za-z]+$/.test(raw)) {
    set.add("[A-Za-z]+");
    if (raw === raw.toUpperCase()) set.add("[A-Z]+");
    if (raw === raw.toLowerCase()) set.add("[a-z]+");
    set.add("[A-Za-zÀ-ÿ'’-]+");
  }
  if (/^[A-Za-z0-9]+$/.test(raw)) set.add("[A-Za-z0-9]+");
  if (/^[A-Za-z0-9 ]+$/.test(raw)) set.add("[A-Za-z0-9 ]+");
  if (/^[\w.-]+$/.test(raw)) set.add("[\\w.-]+");
  if (/^\w+$/.test(raw)) set.add("\\w+");
  // identifiants, e-mails, dates, heures, IP : classes usuelles
  if (/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(raw)) set.add("[^\\s@]+@[^\\s@]+\\.[A-Za-z]{2,}");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(raw)) set.add("\\d{1,3}(?:\\.\\d{1,3}){3}");
  if (/^\d{2,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(raw)) set.add("\\d{2,4}[-/.]\\d{1,2}[-/.]\\d{1,4}");
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(raw)) set.add("\\d{1,2}:\\d{2}(?::\\d{2})?");
  if (/^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(raw)) set.add("[A-Za-z0-9][A-Za-z0-9_./-]*");
  if (!/[\s|;,]/.test(raw)) set.add("[^\\s|;,]+");
  // nombres formatés, éventuellement signés : "1 250,00", "-45,90", "3 410.90", "12 000"
  if (/^[+-]?\s?[\d][\d\s\u00a0\u202f.,]*\d$/.test(raw)) {
    // le signe doit faire partie de la classe, sinon un espace avant « - » le coupe
    set.add("[-+\\d\\s\\u00a0.,]+");
    set.add("[-+]?[\\d\\s\\u00a0.,]+");
    set.add("\\s*[-+]?[\\d\\s\\u00a0.,]+");
    set.add("[-+]?\\d[\\d\\s\\u00a0]*[.,]\\d+");
    set.add("[-+]?\\d[\\d\\s\\u00a0]*(?:[.,]\\d+)?");
    // pas de variante non signée : elle perdrait le « - » des montants négatifs
  }

  if (rightChar && !/\s/.test(rightChar)) set.add(`[^${escapeClass(rightChar)}]+`);
  if (!/\s/.test(raw)) set.add("\\S+");
  set.add("[^\\n]+?");
  set.add("[^\\n]+");
  return [...set];
}


/** Ponctuation technique : un vrai point d'ancrage (« : », « = », « | »…). */
const TECH_DELIM = /[:=#|[\]()<>{},;\t"']/;

/** Repère faible : uniquement des espaces, ou un mot de liaison de 1-2 lettres. */
function weakDelimiter(lit: string | null): boolean {
  if (lit == null || lit === "") return false;
  if (lit.trim() === "") return true;
  const t = lit.trim();
  if (/^[A-Za-zÀ-ÿ]{1,2}$/.test(t) && /^\s|\s$/.test(lit)) return true;
  // repère qui coupe un mot en deux : « eur » dans « utilisateur »
  return /[A-Za-zÀ-ÿ]$/.test(lit) && !/(^|[^A-Za-zÀ-ÿ])[A-Za-zÀ-ÿ]+$/.test(lit);
}

function strongDelimiter(lit: string | null): boolean {
  return lit != null && TECH_DELIM.test(lit);
}

/** Le groupe capturé est-il une constante brute (aucune classe de caractères) ? */
function literalCapture(cap: string): boolean {
  return !/[\\[\]+*?{}|.]/.test(cap);
}

/** Première capture définie : permet les motifs à deux branches (pivot avant/après). */
function firstGroup(m: RegExpExecArray | null): string | undefined {
  if (!m) return undefined;
  for (let i = 1; i < m.length; i++) if (m[i] !== undefined) return m[i];
  return undefined;
}

function scoreOf(cap: string, left: string, right: string): number {
  let s = cap.length + left.length + right.length;
  if (cap.includes("[^\\n]")) s += 60;
  if (cap === "\\S+") s += 25;
  if (left === "") s += 8;
  if (right === "") s += 8;
  if (left === "^" || right === "$") s -= 6;
  // les motifs « n-ième champ d'une ligne délimitée » sont très fiables
  if (left.startsWith("^(?:[^")) s -= left.length + 12;
  return s;
}

/** Préfixes « aller au n-ième champ » pour les lignes à délimiteur (| ; tab , /). */
function fieldPrefixes(input: string, pos: number): string[] {
  const out: string[] = [];
  for (const d of ["|", ";", "\t", ",", "/"]) {
    const total = input.split(d).length - 1;
    if (total < 2) continue;
    const n = input.slice(0, pos).split(d).length - 1;
    const cls = `[^${escapeClass(d)}]`;
    const lit = escapeRegex(d);
    out.push(n === 0 ? "^" : `^(?:${cls}*${lit}){${n}}`);
  }
  return out;
}

/**
 * Contextes communs à TOUS les exemples : suffixe gauche et préfixe droit
 * partagés. Ce sont les repères les plus fiables (« user= », « Montant : »…).
 */
function commonContexts(
  examples: Example[],
  transform: Transform,
): { lefts: string[]; rights: string[]; caps: string[] } {
  const lefts: string[] = [];
  const rights: string[] = [];
  const raws: string[] = [];
  for (const ex of examples) {
    const occ = occurrences(ex.input, ex.output, transform)[0];
    if (!occ) return { lefts: [], rights: [], caps: [] };
    lefts.push(ex.input.slice(0, occ.pos));
    rights.push(ex.input.slice(occ.pos + occ.len));
    raws.push(ex.input.substr(occ.pos, occ.len));
  }
  const suffix = (() => {
    let n = 0;
    const first = lefts[0]!;
    while (n < 24 && n < first.length && lefts.every((l) => l.length > n && l.charAt(l.length - 1 - n) === first.charAt(first.length - 1 - n))) n++;
    return first.slice(first.length - n);
  })();
  const prefix = (() => {
    let n = 0;
    const first = rights[0]!;
    while (n < 12 && n < first.length && rights.every((r) => r.length > n && r.charAt(n) === first.charAt(n))) n++;
    return first.slice(0, n);
  })();
  const outL: string[] = [];
  const outR: string[] = [];
  if (suffix) {
    outL.push(escapeRegex(suffix));
    outL.push(runsPattern(suffix, true));
    // on coupe aussi au dernier mot : « utilisateur= » plutôt que la ligne entière
    const word = /[A-Za-zÀ-ÿ0-9_]*[^A-Za-zÀ-ÿ0-9_]*$/.exec(suffix)?.[0];
    if (word && word !== suffix) outL.push(escapeRegex(word));
  }
  if (prefix) {
    outR.push(escapeRegex(prefix));
    outR.push(runsPattern(prefix, true));
  }
  return { lefts: outL, rights: outR, caps: antiUnify(raws) };
}

/** Découpe une valeur en jetons homogènes : chiffres / lettres / autres. */
function tokenize(s: string): { kind: "d" | "a" | "o"; text: string }[] {
  const out: { kind: "d" | "a" | "o"; text: string }[] = [];
  const re = /[0-9]+|[A-Za-zÀ-ÿ]+|[^0-9A-Za-zÀ-ÿ]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const text = m[0];
    out.push({ kind: /^[0-9]/.test(text) ? "d" : /^[^0-9A-Za-zÀ-ÿ]/.test(text) ? "o" : "a", text });
  }
  return out;
}

/**
 * Anti-unification : à partir de TOUTES les valeurs d'exemple, on remonte au
 * motif le plus précis qui les explique toutes (« FA-2024-0001 » + « FA/2024/87 »
 * -> « FA[-/]\d{4}[-/]\d+ ») au lieu de généraliser à l'aveugle.
 */
function antiUnify(raws: string[]): string[] {
  const clean = raws.filter(Boolean);
  if (clean.length === 0) return [];
  const toks = clean.map(tokenize);
  const n = toks[0]!.length;
  if (!toks.every((t) => t.length === n && t.every((x, i) => x.kind === toks[0]![i]!.kind))) return [];
  let exact = "";
  let loose = "";
  for (let i = 0; i < n; i++) {
    const parts = toks.map((t) => t[i]!.text);
    const kind = toks[0]![i]!.kind;
    const same = parts.every((p) => p === parts[0]);
    const lens = new Set(parts.map((p) => p.length));
    if (kind === "o") {
      if (same) {
        exact += escapeRegex(parts[0]!);
        loose += escapeRegex(parts[0]!);
      } else {
        const chars = [...new Set(parts.join("").split(""))].map(escapeClass).join("");
        const cls = `[${chars}]${lens.size === 1 && parts[0]!.length === 1 ? "" : "+"}`;
        exact += cls;
        loose += cls;
      }
    } else if (kind === "d") {
      exact += lens.size === 1 ? `\\d{${parts[0]!.length}}` : "\\d+";
      loose += "\\d+";
    } else {
      const upper = parts.every((p) => p === p.toUpperCase());
      const lower = parts.every((p) => p === p.toLowerCase());
      const cls = upper ? "[A-Z]" : lower ? "[a-z]" : "[A-Za-zÀ-ÿ]";
      exact += lens.size === 1 ? `${cls}{${parts[0]!.length}}` : `${cls}+`;
      loose += `${cls}+`;
    }
  }
  return exact === loose ? [exact] : [exact, loose];
}

function buildCandidates(
  ex: Example,
  transform: Transform,
  shared?: { lefts: string[]; rights: string[]; caps: string[] },
): string[] {
  const { input, output } = ex;
  const cands: { src: string; score: number }[] = [];
  for (const { pos, len } of occurrences(input, output, transform)) {
    const raw = input.substr(pos, len);
    const left = input.slice(0, pos);
    const right = input.slice(pos + len);

    // chaque repère garde son texte d'origine pour être qualifié (technique / mot de liaison)
    const lefts = new Map<string, string | null>([["", null]]);
    if (pos === 0) lefts.set("^", null);
    for (const p of fieldPrefixes(input, pos)) lefts.set(p, "|");
    for (const l of shared?.lefts ?? []) lefts.set(l, null);
    for (let l = 1; l <= 8 && l <= left.length; l++) {
      const chunk = left.slice(-l);
      lefts.set(escapeRegex(chunk), chunk);
      lefts.set(runsPattern(chunk, true), chunk);
      if (l === left.length) {
        lefts.set("^" + escapeRegex(chunk), chunk);
        lefts.set("^" + runsPattern(chunk, true), chunk);
      }
    }

    const rights = new Map<string, string | null>([["", null]]);
    if (right === "") rights.set("$", null);
    for (const r of shared?.rights ?? []) rights.set(r, null);
    for (let r = 1; r <= 4 && r <= right.length; r++) {
      const chunk = right.slice(0, r);
      rights.set(escapeRegex(chunk), chunk);
      rights.set(runsPattern(chunk, true), chunk);
    }

    const caps = new Set(capturePatterns(raw, right.length ? right.charAt(0) : null));
    // motifs anti-unifiés : prioritaires car déduits de TOUS les exemples
    const generalized = new Set<string>();
    for (const c of shared?.caps ?? []) {
      let ok = false;
      try {
        ok = new RegExp(`^(?:${c})$`).test(raw);
      } catch {
        ok = false;
      }
      if (ok) {
        caps.add(c);
        generalized.add(c);
      }
    }
    for (const cap of caps) {
      const isLit = literalCapture(cap) && cap === escapeRegex(raw);
      for (const [l, lLit] of lefts)
        for (const [r, rLit] of rights) {
          const anchored =
            l.startsWith("^") || r === "$" || strongDelimiter(lLit) || strongDelimiter(rLit);
          let score = scoreOf(cap, l, r) - (generalized.has(cap) ? 30 : 0);
          // 1. une constante brute sans ancre forte est du sur-apprentissage
          if (isLit && !anchored) score += 45;
          // 2. un mot de liaison ou un bout de mot n'est pas un repère fiable
          if (weakDelimiter(lLit)) score += 25;
          if (weakDelimiter(rLit)) score += 15;
          if (strongDelimiter(lLit)) score -= 10;
          cands.push({ src: `${l}(${cap})${r}`, score });
        }
    }
  }
  cands.sort((a, b) => a.score - b.score);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of cands) {
    if (seen.has(c.src)) continue;
    seen.add(c.src);
    out.push(c.src);
    if (out.length >= 4000) break;
  }
  return out;
}

function validate(source: string, transform: Transform, examples: Example[]): boolean {
  let re: RegExp;
  try {
    re = new RegExp(source);
  } catch {
    return false;
  }
  for (const ex of examples) {
    const g = firstGroup(re.exec(ex.input));
    if (g === undefined) return false;
    if (applyTransform(g, transform) !== ex.output) return false;
  }
  return true;
}

/** Forme abstraite d'une valeur : « 1250,00 » -> « 9,9 », « FA-2024-1 » -> « A-9-9 ». */
function shapeOf(s: string): string {
  return s
    .replace(/[0-9]+/g, "9")
    .replace(/[A-Za-zÀ-ÿ]+/g, "A")
    .replace(/\s+/g, " ")
    .slice(0, 32);
}

/**
 * Évalue un candidat sur l'ensemble des lignes : combien de lignes il couvre,
 * et combien de valeurs extraites ont la même forme que les exemples fournis.
 * C'est ce second signal qui évite les règles « qui matchent par hasard ».
 */
function coverageFit(
  src: string,
  transform: Transform,
  inputs: string[],
  shapes: Set<string>,
): { cov: number; fit: number } {
  let re: RegExp;
  try {
    re = new RegExp(src);
  } catch {
    return { cov: 0, fit: 0 };
  }
  let cov = 0;
  let fit = 0;
  for (const input of inputs) {
    if (!input) continue;
    const g = firstGroup(re.exec(input));
    if (g === undefined) continue;
    cov++;
    if (shapes.size === 0 || shapes.has(shapeOf(applyTransform(g, transform)))) fit++;
  }
  return { cov, fit };
}


/** La règle ne doit pas produire une valeur fausse sur les exemples d'un autre motif. */
function avoids(src: string, transform: Transform, negatives: Example[]): boolean {
  let re: RegExp;
  try {
    re = new RegExp(src);
  } catch {
    return false;
  }
  for (const n of negatives) {
    const g = firstGroup(re.exec(n.input));
    if (g !== undefined && applyTransform(g, transform) !== n.output) return false;
  }
  return true;
}

/** Trouve une règle qui explique 100% des exemples fournis. */
export function synthesizeRule(
  examples: Example[],
  allInputs?: string[],
  negatives?: Example[],
): Rule | null {
  const valid = examples.filter((e) => e.output !== "" && e.input !== "");
  if (valid.length === 0) return null;
  const neg = negatives?.filter((n) => !valid.includes(n));

  // cas constant
  const first = valid[0]!;
  if (valid.every((e) => e.output === first.output) && valid.length > 1) {
    const lit = escapeRegex(first.output);
    if (validate(`(${lit})`, NO_TRANSFORM, valid) && (!neg || avoids(`(${lit})`, NO_TRANSFORM, neg)))
      return { source: `(${lit})`, flags: "", transform: NO_TRANSFORM };
  }

  const inputs = (allInputs ?? examples.map((e) => e.input)).filter(Boolean).slice(0, 120);
  const target = inputs.length;
  const shapes = new Set(valid.map((e) => shapeOf(e.output)));

  // plusieurs exemples servent de base (la plus courte, la plus longue, une médiane)
  const sorted = valid.slice().sort((a, b) => a.input.length - b.input.length);
  const seeds: Example[] = [];
  for (const e of [sorted[0]!, sorted[sorted.length - 1]!, sorted[Math.floor(sorted.length / 2)]!])
    if (!seeds.includes(e)) seeds.push(e);

  const deadline = Date.now() + 1200;
  const seenOcc = new Set<string>();
  for (const transform of TRANSFORMS) {
    if (Date.now() > deadline) break;
    // élagage rapide : le nettoyage doit pouvoir produire chaque sortie attendue,
    // et deux nettoyages qui visent exactement les mêmes extraits sont redondants
    let feasible = true;
    const key: string[] = [];
    for (const e of valid) {
      const occ = occurrences(e.input, e.output, transform);
      if (occ.length === 0) {
        feasible = false;
        break;
      }
      key.push(occ.map((o) => `${o.pos}:${o.len}`).join(","));
    }
    if (!feasible) continue;
    const k = key.join("|");
    if (seenOcc.has(k)) continue;
    seenOcc.add(k);
    const shared = valid.length > 1 ? commonContexts(valid, transform) : undefined;
    // candidats des différentes graines, entrelacés pour rester dans l'ordre de simplicité
    const lists = seeds.map((s) => buildCandidates(s, transform, shared));
    const merged: string[] = [];
    const seenSrc = new Set<string>();
    const maxLen = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < maxLen; i++)
      for (const l of lists) {
        const src = l[i];
        if (src && !seenSrc.has(src)) {
          seenSrc.add(src);
          merged.push(src);
        }
      }

    let best: Rule | null = null;
    let bestScore = -1;
    let bestLen = Infinity;
    let seen = 0;
    for (const src of merged) {
      if (!validate(src, transform, valid)) continue;
      if (neg && neg.length > 0 && !avoids(src, transform, neg)) continue;
      const { cov, fit } = coverageFit(src, transform, inputs, shapes);
      // la cohérence de forme pèse plus lourd que la couverture, et les lignes
      // captées « de travers » (forme inattendue) comptent comme contre-exemples
      const wrong = cov - fit;
      // à couverture égale, la formulation la plus courte gagne
      const score = fit * 3 + cov - wrong * 2 - src.length / 500;
      if (score > bestScore || (score === bestScore && src.length < bestLen)) {
        best = { source: src, flags: "", transform };
        bestScore = score;
        bestLen = src.length;
      }
      if (fit >= target && wrong === 0) break;
      if (++seen >= 300 || Date.now() > deadline) break;
    }
    if (best) return best;
    if (Date.now() > deadline) break;
  }
  return null;
}


/**
 * Découpe les exemples en groupes cohérents : on cherche d'abord le plus grand
 * sous-ensemble expliqué par une même règle, puis on recommence sur le reste.
 * Permet de gérer deux (ou plus) motifs différents, et les exceptions.
 */
function partitionRules(examples: Example[], maxGroups = 3): { rule: Rule; size: number }[] {
  const deadline = Date.now() + 3000; // budget : la déduction doit rester instantanée
  const groups: Example[][] = [];
  let rest = examples.slice(0, 10);
  while (rest.length > 0 && groups.length < maxGroups && Date.now() < deadline) {
    let bestGroup: Example[] = [];
    const seeds = Math.min(rest.length, 4);
    for (let s = 0; s < seeds; s++) {
      let group: Example[] = [rest[s]!];
      let rule = synthesizeRule(group);
      if (!rule) continue;
      for (let j = 0; j < rest.length; j++) {
        if (j === s) continue;
        const cand = rest[j]!;
        // essai rapide : la règle courante explique-t-elle déjà cet exemple ?
        if (validate(rule.source, rule.transform, [cand])) {
          group = [...group, cand];
          continue;
        }
        if (Date.now() > deadline) break;
        const r2 = synthesizeRule([...group, cand]);
        if (r2) {
          group = [...group, cand];
          rule = r2;
        }
      }
      if (group.length > bestGroup.length) bestGroup = group;
      if (bestGroup.length === rest.length || Date.now() > deadline) break;
    }
    if (bestGroup.length === 0) break;
    groups.push(bestGroup);
    const used = new Set(bestGroup);
    rest = rest.filter((e) => !used.has(e));
  }

  // chaque règle est re-synthétisée en évitant les exemples des autres groupes,
  // pour qu'elle ne s'applique pas à tort aux lignes de l'autre motif
  const rules: { rule: Rule; group: Example[]; conflicts: number }[] = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]!;
    const others = groups.filter((_, j) => j !== i).flat();
    const rule = synthesizeRule(group, undefined, others) ?? synthesizeRule(group);
    if (!rule) continue;
    let conflicts = 0;
    for (const o of others) {
      const g = firstGroup(new RegExp(rule.source, rule.flags).exec(o.input));
      if (g !== undefined && applyTransform(g, rule.transform) !== o.output) conflicts++;
    }
    rules.push({ rule, group, conflicts });
  }
  // 4. ordre strict : les règles les plus contraintes d'abord, les constantes en dernier
  const level = (rule: Rule): number => {
    const src = rule.source;
    const i = src.indexOf("(");
    const j = src.lastIndexOf(")");
    const cap = i >= 0 && j > i ? src.slice(i + 1, j) : "";
    const before = i > 0 ? src.slice(0, i) : "";
    const after = j >= 0 ? src.slice(j + 1) : "";
    const leftAnchor = before.startsWith("^") || before.length > 0;
    const rightAnchor = after === "$" || after.length > 0;
    const typed = /\\d|\[A-Za-z|\\w/.test(cap);
    let lv = leftAnchor && rightAnchor ? 0 : (leftAnchor || rightAnchor) && typed ? 1 : 2;
    // une règle qui extrait une constante ne doit jamais servir de règle générale
    if (literalCapture(cap)) lv += 5;
    return lv;
  };
  rules.sort(
    (a, b) =>
      a.conflicts - b.conflicts ||
      level(a.rule) - level(b.rule) ||
      b.group.length - a.group.length,
  );
  return rules.map((r) => ({ rule: r.rule, size: r.group.length }));
}

function ruleChain(rule: Rule): Rule[] {
  return [rule, ...(rule.extra ?? [])];
}

export function applyRule(rule: Rule, inputs: string[]): SynthResult {
  const chain = ruleChain(rule).map((r) => ({ re: new RegExp(r.source, r.flags), transform: r.transform }));
  const values: (string | null)[] = [];
  const failures: number[] = [];
  let matched = 0;
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i] ?? "";
    let value: string | null = null;
    for (const { re, transform } of chain) {
      const g = firstGroup(re.exec(input));
      if (g !== undefined) {
        value = applyTransform(g, transform);
        break;
      }
    }
    if (value !== null) {
      values.push(value);
      matched++;
    } else {
      values.push(null);
      if (input !== "") failures.push(i);
    }
  }
  return { rule, values, failures, matched, total: inputs.length };
}

/** Nombre d'exemples réellement reproduits par la chaîne de règles. */
function explains(rule: Rule, examples: Example[]): number {
  const chain = ruleChain(rule).map((r) => ({ re: new RegExp(r.source, r.flags), transform: r.transform }));
  let n = 0;
  for (const ex of examples) {
    for (const { re, transform } of chain) {
      const g = re.exec(ex.input)?.[1];
      if (g !== undefined) {
        if (applyTransform(g, transform) === ex.output) n++;
        break;
      }
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// Auto-apprentissage (self-training) : quand la règle laisse des lignes de côté,
// on DEVINE la valeur probable sur ces lignes (plus proche voisin + rareté du
// mot + ressemblance du contexte), puis on re-synthétise avec ces pseudo-exemples.
// ---------------------------------------------------------------------------

function ngrams(s: string, n = 2): Set<string> {
  const out = new Set<string>();
  const t = `^${s.toLowerCase()}$`;
  for (let i = 0; i + n <= t.length; i++) out.add(t.slice(i, i + n));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const TOKEN_RE = /[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9_.@:/-]*/g;

function tokensOf(input: string): { text: string; pos: number }[] {
  const out: { text: string; pos: number }[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(input))) out.push({ text: m[0], pos: m.index });
  return out;
}

/** Hypothèses classées (top 3) pour chaque ligne non couverte. */
function guessValues(
  inputs: string[],
  examples: Example[],
  suspect: number[],
): { index: number; input: string; options: string[] }[] {
  if (examples.length === 0 || suspect.length === 0) return [];
  const shapes = new Set(examples.map((e) => shapeOf(e.output)));
  const vals = examples.map((e) => e.output);
  const valGrams = vals.map((v) => ngrams(v));
  const lens = vals.map((v) => v.length);
  const minLen = Math.min(...lens) - 2;
  const maxLen = Math.max(...lens) + 3;

  // fréquence documentaire : un mot présent partout n'est presque jamais la valeur
  const df = new Map<string, number>();
  for (const input of inputs) {
    if (!input) continue;
    for (const t of new Set(tokensOf(input).map((x) => x.text.toLowerCase())))
      df.set(t, (df.get(t) ?? 0) + 1);
  }
  const nLines = inputs.filter(Boolean).length || 1;

  // contextes des exemples (12 car. à gauche, 8 à droite)
  const ctxL: Set<string>[] = [];
  const ctxR: Set<string>[] = [];
  for (const ex of examples) {
    const pos = ex.input.indexOf(ex.output);
    if (pos < 0) continue;
    ctxL.push(ngrams(ex.input.slice(Math.max(0, pos - 12), pos)));
    ctxR.push(ngrams(ex.input.slice(pos + ex.output.length, pos + ex.output.length + 8)));
  }

  const out: { index: number; input: string; options: string[] }[] = [];
  for (const i of suspect) {
    const input = inputs[i] ?? "";
    if (!input) continue;
    const scored: { text: string; score: number }[] = [];
    for (const { text, pos } of tokensOf(input)) {
      if (!shapes.has(shapeOf(text))) continue;
      if (text.length < minLen || text.length > maxLen) continue;
      const g = ngrams(text);
      const sim = Math.max(...valGrams.map((v) => jaccard(g, v)));
      const rarity = 1 - ((df.get(text.toLowerCase()) ?? 1) - 1) / nLines;
      const lg = ngrams(input.slice(Math.max(0, pos - 12), pos));
      const rg = ngrams(input.slice(pos + text.length, pos + text.length + 8));
      const ctx =
        (ctxL.length ? Math.max(...ctxL.map((c) => jaccard(lg, c))) : 0) * 0.6 +
        (ctxR.length ? Math.max(...ctxR.map((c) => jaccard(rg, c))) : 0) * 0.4;
      const casing = vals.every((v) => v === v.toLowerCase()) && text !== text.toLowerCase() ? -0.25 : 0;
      scored.push({ text, score: sim * 1.6 + rarity * 1.2 + ctx * 0.8 + casing });
    }
    scored.sort((a, b) => b.score - a.score);
    const options = scored.filter((s) => s.score > 0.9).slice(0, 3).map((s) => s.text);
    if (options.length) out.push({ index: i, input, options });
  }
  return out;
}



/**
 * Auto-apprentissage : on repart des lignes non couvertes (ou dont la valeur
 * extraite n'a pas la forme attendue) pour deviner leur valeur, puis on
 * re-synthétise. On ne garde le résultat que s'il couvre plus de lignes SANS
 * trahir un seul exemple saisi par l'utilisateur.
 */
function selfTrain(
  base: SynthResult,
  inputs: string[],
  examples: Example[],
): SynthResult {
  if (!base.rule) return base;
  const shapes = new Set(examples.map((e) => shapeOf(e.output)));
  const lens = examples.map((e) => e.output.length);
  const minLen = Math.min(...lens) - 2;
  const maxLen = Math.max(...lens) + 3;
  const allLower = examples.every((e) => e.output === e.output.toLowerCase());
  // une valeur « plausible » a la forme, la longueur et la casse des exemples
  const plausible = (v: string | null): boolean =>
    v != null &&
    shapes.has(shapeOf(v)) &&
    v.length >= minLen &&
    v.length <= maxLen &&
    (!allLower || v === v.toLowerCase());

  const given = new Set(examples.map((e) => e.index));
  const suspect: number[] = [];
  for (let i = 0; i < inputs.length; i++) {
    if (!inputs[i] || given.has(i)) continue;
    if (!plausible(base.values[i] ?? null)) suspect.push(i);
  }
  if (suspect.length === 0) return base;

  const guesses = guessValues(inputs, examples, suspect.slice(0, 12));
  if (guesses.length === 0) return base;

  const deadline = Date.now() + 2500;
  const optionsAt = new Map(guesses.map((g) => [g.index, g.options] as const));
  const expectedAt = new Map(examples.map((e) => [e.index, e.output] as const));

  // valeur « acceptée » pour une ligne : l'exemple saisi, ou une hypothèse
  const accepted = (i: number, v: string | null): boolean => {
    if (v == null) return false;
    const want = expectedAt.get(i);
    if (want !== undefined) return v === want;
    const opts = optionsAt.get(i);
    return opts ? opts.includes(v) : plausible(v);
  };

  type Cand = { rule: Rule; good: Set<number>; bad: number };
  const evaluate = (rule: Rule): Cand | null => {
    let re: RegExp;
    try {
      re = new RegExp(rule.source, rule.flags);
    } catch {
      return null;
    }
    const good = new Set<number>();
    let bad = 0;
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i] ?? "";
      if (!input) continue;
      const g = re.exec(input)?.[1];
      if (g === undefined) continue;
      const v = applyTransform(g, rule.transform);
      if (accepted(i, v)) good.add(i);
      else bad++;
    }
    return { rule, good, bad };
  };

  // réservoir de règles : la règle de base + une règle par hypothèse de ligne
  const pool: Cand[] = [];
  for (const r of ruleChain(base.rule)) {
    const c = evaluate(r);
    if (c) pool.push(c);
  }
  for (const g of guesses) {
    for (const opt of g.options.slice(0, 2)) {
      if (Date.now() > deadline) break;
      const r =
        synthesizeRule([{ index: g.index, input: g.input, output: opt }], inputs, examples) ??
        synthesizeRule([{ index: g.index, input: g.input, output: opt }], inputs);
      if (!r) continue;
      const c = evaluate(r);
      if (c && c.good.size > 0) pool.push(c);
    }
    if (Date.now() > deadline) break;
  }
  if (pool.length === 0) return base;

  // couverture gloutonne : d'abord les règles les plus sûres (peu d'erreurs),
  // puis celles qui apportent de nouvelles lignes
  const chain: Cand[] = [];
  const covered = new Set<number>();
  for (let step = 0; step < 5; step++) {
    let pick: Cand | null = null;
    let pickGain = 0;
    for (const c of pool) {
      if (chain.includes(c)) continue;
      let gain = 0;
      for (const i of c.good) if (!covered.has(i)) gain++;
      const value = gain - c.bad * 1.5;
      if (gain > 0 && value > pickGain) {
        pick = c;
        pickGain = value;
      }
    }
    if (!pick) break;
    chain.push(pick);
    for (const i of pick.good) covered.add(i);
  }
  // les lignes d'exemple doivent impérativement être couvertes
  for (const e of examples) {
    if (covered.has(e.index)) continue;
    let add: Cand | null = null;
    for (const c of pool) {
      if (chain.includes(c) || !c.good.has(e.index)) continue;
      if (!add || c.bad < add.bad) add = c;
    }
    if (add) {
      chain.push(add);
      for (const i of add.good) covered.add(i);
    }
  }
  if (chain.length === 0) return base;

  // l'ordre compte : la règle la plus spécifique passe en premier, la plus
  // générale en dernier (sinon elle capterait les lignes des autres)
  const order = chain
    .slice()
    .sort((a, b) => a.bad - b.bad || a.good.size + a.bad - (b.good.size + b.bad));

  const scoreOf2 = (values: (string | null)[]): number =>
    values.reduce<number>((n, v, i) => n + (accepted(i, v) ? 1 : v != null && !plausible(v) ? -0.5 : 0), 0);
  const baseScore = scoreOf2(base.values);
  let best = base;
  let bestScore = baseScore;
  for (const list of [order, chain]) {
    const combined: Rule = { ...list[0]!.rule, extra: list.slice(1).map((c) => c.rule) };
    if (explains(combined, examples) < examples.length) continue;
    const res = applyRule(combined, inputs);
    const s = scoreOf2(res.values);
    if (s > bestScore) {
      best = res;
      bestScore = s;
    }
  }
  return best;
}

/**
 * Délimiteurs gauches qui isolent exactement la valeur sur cette ligne :
 * le plus court, et le plus court contenant un mot (repère plus fiable).
 */
function minimalLefts(
  input: string,
  pos: number,
  cap: string,
  raw: string,
  values: string[] = [],
): string[] {
  const before = input.slice(0, pos);
  if (pos === 0) {
    // valeur en tout début de ligne : l'ancre ^ fait office de délimiteur
    try {
      const m = new RegExp(`^(${cap})`).exec(input);
      if (m && m[1] === raw) return ["^"];
    } catch {
      return [];
    }
    return [];
  }
  const out: string[] = [];
  for (let len = 1; len <= 20 && len <= before.length; len++) {
    const tail = before.slice(before.length - len);
    // un délimiteur ne doit pas couper un mot ou un nombre en deux
    const prev = before[before.length - len - 1];
    if (prev && /[A-Za-z0-9]/.test(prev) && /[A-Za-z0-9]/.test(tail[0]!)) continue;
    // un délimiteur chiffré sans mot n'est qu'une donnée voisine, pas un repère
    if (/\d/.test(tail) && !/[A-Za-z]{2}/.test(tail)) continue;
    // un repère ne peut pas être une valeur extraite ailleurs : c'est un hasard
    if (values.some((v) => v.length >= 3 && tail.includes(v))) continue;
    // ni un mot de liaison court (« de », « à ») : trop de faux positifs
    if (weakDelimiter(tail)) continue;
    let re: RegExp;
    try {
      re = new RegExp(`${escapeRegex(tail)}(${cap})`);
    } catch {
      return out;
    }
    const m = re.exec(input);
    if (m && m.index + tail.length === pos && m[1] === raw) {
      const wordy = /[A-Za-z]{2}/.test(tail);
      if (out.length === 0) out.push(tail);
      if (wordy) {
        if (!out.includes(tail)) out.push(tail);
        return out;
      }
    }
  }
  return out;
}


/** Repère situé APRÈS la valeur (pivot inversé : « 50 € payés »). */
function minimalRight(
  input: string,
  end: number,
  cap: string,
  raw: string,
  values: string[] = [],
): string | null {
  const after = input.slice(end);
  if (!after) return null;
  for (let len = 1; len <= 14 && len <= after.length; len++) {
    const head = after.slice(0, len);
    const next = after[len];
    if (next && /[A-Za-z0-9]/.test(next) && /[A-Za-z0-9]/.test(head[head.length - 1]!)) continue;
    if (/\d/.test(head) && !/[A-Za-z]{2}/.test(head)) continue;
    if (values.some((v) => v.length >= 3 && head.includes(v))) continue;
    if (weakDelimiter(head)) continue;
    let re: RegExp;
    try {
      re = new RegExp(`(${cap})${escapeRegex(head)}`);
    } catch {
      return null;
    }
    const m = re.exec(input);
    if (m && m[1] === raw && /[A-Za-z]{2}|[:=#|]/.test(head)) return head;
  }
  return null;
}

/**
 * Générateur de motifs à délimiteurs : un seul regex copiable de la forme
 * `(?:délimiteur1|délimiteur2|…)(capture)`, déduit des valeurs connues.
 */
function alternationRule(
  inputs: string[],
  known: { index: number; value: string }[],
  transform: Transform,
  rate?: (index: number, value: string | null) => number,
): Rule | null {
  const hits: { i: number; raw: string; pos: number }[] = [];
  for (const k of known) {
    const input = inputs[k.index] ?? "";
    const o = occurrences(input, k.value, transform)[0];
    if (!o) continue;
    hits.push({ i: k.index, raw: input.slice(o.pos, o.pos + o.len), pos: o.pos });
  }
  if (hits.length < 2) return null;

  const caps = new Set<string>(antiUnify(hits.map((h) => h.raw)));
  for (const c of capturePatterns(hits[0]!.raw, null)) caps.add(c);
  // variantes à longueur minimale : évitent d'attraper « l » dans « l'agent »
  const minLen = Math.min(...hits.map((h) => h.raw.length));
  if (minLen >= 2)
    for (const base of ["[a-z]", "[A-Z]", "[A-Za-z]", "\\w", "[A-Za-z0-9]", "\\S"])
      caps.add(`${base}{${minLen},}`);
  const wanted = new Map(known.map((k) => [k.index, k.value] as const));
  const allValues = hits.map((h) => h.raw);

  let best: { rule: Rule; score: number } | null = null;
  for (const cap of caps) {
    let full: RegExp;
    try {
      full = new RegExp(`^(?:${cap})$`);
    } catch {
      continue;
    }
    if (!hits.every((h) => full.test(h.raw))) continue;

    const perLine: string[][] = [];
    const rightMarks: string[] = [];
    for (const h of hits) {
      const l = minimalLefts(inputs[h.i] ?? "", h.pos, cap, h.raw, allValues);
      if (l.length) perLine.push(l);
      else {
        // 3. pivot inversé : la valeur précède son repère (« 50 € payés »)
        const r = minimalRight(inputs[h.i] ?? "", h.pos + h.raw.length, cap, h.raw, allValues);
        if (r) rightMarks.push(r);
      }
    }
    if (perLine.length < 2 || perLine.length + rightMarks.length < hits.length * 0.6) continue;

    // deux jeux de repères : les plus courts, et ceux qui contiennent un mot
    const variants = [perLine.map((l) => l[0]!), perLine.map((l) => l[l.length - 1]!)];
    for (const lefts of variants) {
      const uniq = [...new Set(lefts)].sort((a, b) => b.length - a.length);
      if (uniq.length > 8) continue;
      // des repères longs et tous différents = du hasard, pas un motif
      const limit = uniq.every((u) => /[A-Za-z]{3}/.test(u) && !/\d/.test(u)) ? 18 : 12;
      if (uniq.length > 1 && uniq.some((u) => u.length > limit)) continue;
      const esc = (u: string): string => (u === "^" ? "^" : escapeRegex(u));
      const head = uniq.length === 1 ? esc(uniq[0]!) : `(?:${uniq.map(esc).join("|")})`;
      const tails = [...new Set(rightMarks)].filter((t) => t.length <= 12);
      // disjonction pivot-avant / pivot-après quand les deux ordres existent
      const src =
        tails.length > 0
          ? `(?:${head}(${cap})|(${cap})${tails.length === 1 ? escapeRegex(tails[0]!) : `(?:${tails.map(escapeRegex).join("|")})`})`
          : `${head}(${cap})`;
      let re: RegExp;
      try {
        re = new RegExp(src);
      } catch {
        continue;
      }

      let quality = 0;
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i] ?? "";
        if (!input) continue;
        const g = firstGroup(re.exec(input));
        const v = g === undefined ? null : applyTransform(g, transform);
        if (rate) {
          quality += rate(i, v);
          continue;
        }
        const w = wanted.get(i);
        if (w === undefined) continue;
        if (v === null) quality -= 0.5;
        else quality += v === w ? 1 : -1.5;
      }
      const score = quality - (uniq.length - 1) * 0.3 - src.length / 400;
      if (!best || score > best.score) best = { rule: { source: src, flags: "", transform }, score };
    }
  }
  return best?.rule ?? null;
}

/**
 * Si un regex unique à alternance de délimiteurs fait aussi bien qu'une chaîne
 * de motifs, on le préfère : il est copiable tel quel.
 */
function preferAlternation(res: SynthResult, inputs: string[], examples: Example[]): SynthResult {
  if (!res.rule) return res;
  const shapes = new Set(examples.map((e) => shapeOf(e.output)));
  const given = new Map(examples.map((e) => [e.index, e.output] as const));
  const known: { index: number; value: string }[] = examples.map((e) => ({
    index: e.index,
    value: e.output,
  }));
  const unknown: number[] = [];
  for (let i = 0; i < inputs.length; i++) {
    if (given.has(i) || !inputs[i]) continue;
    unknown.push(i);
    const v = res.values[i];
    if (v != null && shapes.has(shapeOf(v))) known.push({ index: i, value: v });
  }

  // les hypothèses servent d'arbitre : une valeur devinée en tête de liste
  // vaut plus qu'une valeur simplement « de la bonne forme »
  const ranked = new Map<number, string[]>();
  for (const g of guessValues(inputs, examples, unknown.slice(0, 14)))
    ranked.set(g.index, g.options);

  const rate = (i: number, v: string | null): number => {
    const w = given.get(i);
    if (w !== undefined) return v === w ? 1.5 : -2;
    if (v == null) return 0;
    const opts = ranked.get(i);
    // toutes les hypothèses d'une ligne pèsent pareil : leur ordre est incertain
    if (opts?.includes(v)) return 0.8;
    return shapes.has(shapeOf(v)) ? 0.5 : -0.6;
  };
  const score = (values: (string | null)[]): number =>
    values.reduce<number>((n, v, i) => n + (inputs[i] ? rate(i, v) : 0), 0);

  // deuxième jeu de valeurs de départ : les hypothèses les mieux classées
  const guessed: { index: number; value: string }[] = examples.map((e) => ({
    index: e.index,
    value: e.output,
  }));
  const guessed2 = [...guessed];
  for (const [i, opts] of ranked) {
    if (opts[0]) guessed.push({ index: i, value: opts[0] });
    if (opts[1] ?? opts[0]) guessed2.push({ index: i, value: (opts[1] ?? opts[0])! });
  }

  let out = res;
  let bestScore = score(res.values);
  for (const [n, seed] of [known, guessed, guessed2].entries()) {
    const alt = alternationRule(inputs, seed, res.rule.transform, rate);
    if (!alt || explains(alt, examples) < examples.length) continue;
    const cand = applyRule(alt, inputs);
    // à égalité, le regex unique gagne : il est copiable tel quel.
    // les valeurs devinées, elles, doivent faire nettement mieux.
    const need = n === 0 ? bestScore : bestScore + 0.75;
    if (score(cand.values) >= need) {
      out = cand;
      bestScore = score(cand.values);
    }
  }
  return out;
}

export function synthesize(inputs: string[], expected: (string | null)[]): SynthResult {
  const examples: Example[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const e = expected[i];
    if (e != null && e !== "") examples.push({ index: i, input: inputs[i] ?? "", output: e });
  }
  const empty: SynthResult = {
    rule: null,
    values: inputs.map(() => null),
    failures: [],
    matched: 0,
    total: inputs.length,
  };
  if (examples.length === 0) return empty;

  const single = synthesizeRule(examples, inputs);
  const singleRes = single ? applyRule(single, inputs) : null;
  const singleOk = single ? explains(single, examples) : 0;

  // la règle simple explique tous les exemples : on n'ajoute rien.
  // (des lignes non couvertes restent acceptables : on garde le maximum de lignes)
  if (single && singleRes && singleOk >= examples.length)
    return preferAlternation(selfTrain(singleRes, inputs, examples), inputs, examples);

  // sinon seulement : plusieurs motifs, ou une exception
  const parts = partitionRules(examples);
  if (parts.length > 1) {
    const combined: Rule = { ...parts[0]!.rule, extra: parts.slice(1).map((p) => p.rule) };
    const res = applyRule(combined, inputs);
    const comboOk = explains(combined, examples);
    // on ne complique la règle que si elle explique réellement plus d'exemples
    if (comboOk > singleOk || (comboOk === singleOk && res.matched > (singleRes?.matched ?? -1)))
      return preferAlternation(selfTrain(res, inputs, examples), inputs, examples);
  }
  if (singleRes) return preferAlternation(selfTrain(singleRes, inputs, examples), inputs, examples);
  if (parts[0])
    return preferAlternation(selfTrain(applyRule(parts[0].rule, inputs), inputs, examples), inputs, examples);
  return empty;
}

/** Regex combinée : un seul motif avec un groupe par colonne de sortie. */
export function combineColumns(
  inputs: string[],
  cols: { name: string; rule: Rule }[],
): { source: string; names: string[]; covered: number; total: number } | null {
  const usable = cols.filter((c) => c.rule && c.rule.source);
  if (usable.length < 2) return null;
  const rows = inputs.filter(Boolean);
  if (rows.length === 0) return null;

  // ordre des colonnes = ordre d'apparition de la capture dans la ligne
  const posOf = (rule: Rule): number => {
    let sum = 0;
    let n = 0;
    for (const input of rows) {
      let m: RegExpExecArray | null = null;
      try {
        m = new RegExp(rule.source, rule.flags).exec(input);
      } catch {
        return Infinity;
      }
      if (!m) continue;
      const g = firstGroup(m);
      if (g === undefined) continue;
      sum += input.indexOf(g, m.index);
      n++;
    }
    return n === 0 ? Infinity : sum / n;
  };
  const ordered = usable
    .map((c) => ({ ...c, at: posOf(c.rule) }))
    .filter((c) => Number.isFinite(c.at))
    .sort((a, b) => a.at - b.at);
  if (ordered.length < 2) return null;

  const FIELD = /^\^\(\?:\[\^(.)\]\*\\?(.)\)\{(\d+)\}/;
  const fieldInfo = (src: string): { delim: string; n: number } | null => {
    const m = FIELD.exec(src);
    return m ? { delim: m[1]!, n: Number(m[3]) } : null;
  };
  const strip = (src: string, first: boolean): string =>
    first ? src : src.replace(FIELD, "").replace(/^\^/, "");

  const build = (glue: string): string =>
    ordered.map((c, i) => strip(c.rule.source, i === 0)).join(glue);

  // variante « champs délimités » : on saute le bon nombre de champs entre deux captures
  const buildFields = (): string | null => {
    const infos = ordered.map((c) => fieldInfo(c.rule.source));
    const d = infos[0]?.delim;
    if (!d || !infos.every((i) => i && i.delim === d)) return null;
    let out = ordered[0]!.rule.source;
    for (let i = 1; i < ordered.length; i++) {
      const gap = infos[i]!.n - infos[i - 1]!.n;
      if (gap < 1) return null;
      const cls = `[^${escapeClass(d)}]`;
      out += `${cls}*(?:\\${d}${cls}*){${gap - 1}}\\${d}` + strip(ordered[i]!.rule.source, false);
    }
    return out;
  };

  let best: { source: string; covered: number } | null = null;
  const fieldVariant = buildFields();
  for (const glue of ["[\\s\\S]*?", ".*?", ""]) {
    const source = glue === "[\\s\\S]*?" && fieldVariant ? fieldVariant : build(glue);
    let re: RegExp;
    try {
      re = new RegExp(source);
    } catch {
      continue;
    }
    let covered = 0;
    for (const input of rows) {
      const m = re.exec(input);
      if (m && ordered.every((_, i) => m[i + 1] !== undefined)) covered++;
    }
    if (!best || covered > best.covered) best = { source, covered };
    if (covered === rows.length) break;
  }
  if (fieldVariant) {
    try {
      const re = new RegExp(fieldVariant);
      let covered = 0;
      for (const input of rows) {
        const m = re.exec(input);
        if (m && ordered.every((_, i) => m[i + 1] !== undefined)) covered++;
      }
      if (!best || covered > best.covered) best = { source: fieldVariant, covered };
    } catch {
      /* variante invalide */
    }
  }
  if (!best || best.covered === 0) return null;
  return {
    source: best.source,
    names: ordered.map((c) => c.name),
    covered: best.covered,
    total: rows.length,
  };
}
