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
  if (/^[A-Za-z]+$/.test(raw)) set.add("[A-Za-z]+");
  if (/^[A-Za-z0-9]+$/.test(raw)) set.add("[A-Za-z0-9]+");
  if (/^[A-Za-z0-9 ]+$/.test(raw)) set.add("[A-Za-z0-9 ]+");
  // nombres formatés, éventuellement signés : "1 250,00", "-45,90", "3 410.90", "12 000"
  if (/^[+-]?\s?[\d][\d\s\u00a0\u202f.,]*\d$/.test(raw)) {
    set.add("[-+]?[\\d\\s\\u00a0.,]+");
    set.add("[-+]?\\d[\\d\\s\\u00a0]*[.,]\\d+");
    set.add("[-+]?\\d[\\d\\s\\u00a0]*(?:[.,]\\d+)?");
    set.add("[\\d\\s\\u00a0.,]+");
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

function buildCandidates(ex: Example, transform: Transform): string[] {
  const { input, output } = ex;
  const cands: { src: string; score: number }[] = [];
  for (const { pos, len } of occurrences(input, output, transform)) {
    const raw = input.substr(pos, len);
    const left = input.slice(0, pos);
    const right = input.slice(pos + len);

    const lefts = new Set<string>([""]);
    if (pos === 0) lefts.add("^");
    for (const p of fieldPrefixes(input, pos)) lefts.add(p);
    for (let l = 1; l <= 4 && l <= left.length; l++) {
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
    for (let r = 1; r <= 3 && r <= right.length; r++) {
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

/** Nombre de lignes où la règle produit une valeur (sert à départager les candidats). */
function coverage(src: string, inputs: string[]): number {
  let re: RegExp;
  try {
    re = new RegExp(src);
  } catch {
    return 0;
  }
  let n = 0;
  for (const input of inputs) {
    if (!input) continue;
    if (re.exec(input)?.[1] !== undefined) n++;
  }
  return n;
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

  const inputs = (allInputs ?? examples.map((e) => e.input)).filter(Boolean);
  const target = inputs.length;
  const seed = valid.slice().sort((a, b) => a.input.length - b.input.length)[0]!;
  for (const transform of TRANSFORMS) {
    const candidates = buildCandidates(seed, transform);
    let best: Rule | null = null;
    let bestCov = -1;
    let seen = 0;
    for (const src of candidates) {
      if (!validate(src, transform, valid)) continue;
      if (neg && neg.length > 0 && !avoids(src, transform, neg)) continue;
      const cov = coverage(src, inputs);
      if (cov > bestCov) {
        best = { source: src, flags: "", transform };
        bestCov = cov;
      }
      if (bestCov >= target) break;
      if (++seen >= 40) break; // on ne scanne qu'un petit lot de variantes valides
    }
    if (best) return best;
  }
  return null;
}


/**
 * Découpe les exemples en groupes cohérents : on cherche d'abord le plus grand
 * sous-ensemble expliqué par une même règle, puis on recommence sur le reste.
 * Permet de gérer deux (ou plus) motifs différents, et les exceptions.
 */
function partitionRules(examples: Example[], maxGroups = 4): Rule[] {
  const groups: Example[][] = [];
  let rest = examples.slice(0, 14);
  while (rest.length > 0 && groups.length < maxGroups) {
    let bestGroup: Example[] = [];
    for (let s = 0; s < rest.length; s++) {
      let group: Example[] = [rest[s]!];
      if (!synthesizeRule(group)) continue;
      for (let j = 0; j < rest.length; j++) {
        if (j === s) continue;
        const trial = [...group, rest[j]!];
        if (synthesizeRule(trial)) group = trial;
      }
      if (group.length > bestGroup.length) bestGroup = group;
      if (bestGroup.length === rest.length) break;
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
  return rules.map((r) => r.rule);
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
  const nonEmpty = inputs.filter(Boolean).length;
  if (single) {
    const res = applyRule(single, inputs);
    if (res.matched >= nonEmpty) return res;
  }

  // une seule règle ne suffit pas (deux motifs, ou une exception) : on combine
  const parts = partitionRules(examples);
  if (parts.length > 1) {
    const combined: Rule = { ...parts[0]!, extra: parts.slice(1) };
    const res = applyRule(combined, inputs);
    const single_res = single ? applyRule(single, inputs) : null;
    if (!single_res || res.matched > single_res.matched || explains(combined, examples) > explains(single!, examples))
      return res;
    return single_res;
  }
  if (single) return applyRule(single, inputs);
  if (parts[0]) return applyRule(parts[0], inputs);
  return empty;
}
