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
  return { lefts: outL, rights: outR };
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
  shared?: { lefts: string[]; rights: string[] },
): string[] {
  const { input, output } = ex;
  const cands: { src: string; score: number }[] = [];
  for (const { pos, len } of occurrences(input, output, transform)) {
    const raw = input.substr(pos, len);
    const left = input.slice(0, pos);
    const right = input.slice(pos + len);

    const lefts = new Set<string>([""]);
    if (pos === 0) lefts.add("^");
    for (const p of fieldPrefixes(input, pos)) lefts.add(p);
    for (const l of shared?.lefts ?? []) lefts.add(l);
    for (let l = 1; l <= 8 && l <= left.length; l++) {
      const chunk = left.slice(-l);
      lefts.add(escapeRegex(chunk));
      lefts.add(runsPattern(chunk, true));
      if (l === left.length) {
        lefts.add("^" + escapeRegex(chunk));
        lefts.add("^" + runsPattern(chunk, true));
      }
    }


    const rights = new Set<string>([""]);
    if (right === "") rights.add("$");
    for (const r of shared?.rights ?? []) rights.add(r);
    for (let r = 1; r <= 4 && r <= right.length; r++) {
      const chunk = right.slice(0, r);
      rights.add(escapeRegex(chunk));
      rights.add(runsPattern(chunk, true));
    }

    const caps = capturePatterns(raw, right.length ? right.charAt(0) : null);
    for (const cap of caps)
      for (const l of lefts)
        for (const r of rights)
          cands.push({ src: `${l}(${cap})${r}`, score: scoreOf(cap, l, r) });
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
    const m = re.exec(ex.input);
    if (!m || m[1] === undefined) return false;
    if (applyTransform(m[1], transform) !== ex.output) return false;
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
    const g = re.exec(input)?.[1];
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
    const g = re.exec(n.input)?.[1];
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
      // la cohérence de forme pèse plus lourd que la simple couverture
      const score = fit * 3 + cov;
      if (score > bestScore || (score === bestScore && src.length < bestLen)) {
        best = { source: src, flags: "", transform };
        bestScore = score;
        bestLen = src.length;
      }
      if (fit >= target) break;
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
      const g = new RegExp(rule.source, rule.flags).exec(o.input)?.[1];
      if (g !== undefined && applyTransform(g, rule.transform) !== o.output) conflicts++;
    }
    rules.push({ rule, group, conflicts });
  }
  // les règles les plus spécifiques passent en premier
  rules.sort((a, b) => a.conflicts - b.conflicts || b.group.length - a.group.length);
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
      const g = re.exec(input)?.[1];
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
  if (single && singleRes && singleOk >= examples.length) return singleRes;

  // sinon seulement : plusieurs motifs, ou une exception
  const parts = partitionRules(examples);
  if (parts.length > 1) {
    const combined: Rule = { ...parts[0]!.rule, extra: parts.slice(1).map((p) => p.rule) };
    const res = applyRule(combined, inputs);
    const comboOk = explains(combined, examples);
    // on ne complique la règle que si elle explique réellement plus d'exemples
    if (comboOk > singleOk || (comboOk === singleOk && res.matched > (singleRes?.matched ?? -1)))
      return res;
  }
  if (singleRes) return singleRes;
  if (parts[0]) return applyRule(parts[0].rule, inputs);
  return empty;
}
