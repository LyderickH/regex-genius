/**
 * Moteur de synthèse d'expressions régulières à partir d'exemples.
 * 100% local : tokenisation, énumération guidée de règles candidates,
 * validation sur tous les exemples fournis, sélection de la plus simple.
 */

/** Nettoyage appliqué après extraction. */
export interface Transform {
  /** suppression : rien, espaces de début/fin, tous les espaces, tout sauf les chiffres */
  strip: "none" | "trim" | "spaces" | "digits";
  /** séparateur décimal : inchangé, virgule -> point, point -> virgule */
  dec: "none" | "dot" | "comma";
  casing: "none" | "upper" | "lower";
}

export const NO_TRANSFORM: Transform = { strip: "none", dec: "none", casing: "none" };

export function isIdentity(t: Transform): boolean {
  return t.strip === "none" && t.dec === "none" && t.casing === "none";
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
  return parts.length ? parts.join(", ") : null;
}

const TRANSFORMS: Transform[] = (() => {
  const out: Transform[] = [];
  for (const strip of ["none", "trim", "spaces", "digits"] as const)
    for (const dec of ["none", "dot", "comma"] as const)
      for (const casing of ["none", "upper", "lower"] as const)
        out.push({ strip, dec, casing });
  // les nettoyages les plus simples d'abord
  const cost = (t: Transform) =>
    (t.strip === "none" ? 0 : t.strip === "trim" ? 1 : t.strip === "spaces" ? 2 : 4) +
    (t.dec === "none" ? 0 : 2) +
    (t.casing === "none" ? 0 : 1);
  return out.sort((a, b) => cost(a) - cost(b));
})();


export interface Rule {
  /** source de l'expression régulière, le groupe 1 contient la valeur extraite */
  source: string;
  flags: string;
  transform: Transform;
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

function applyTransform(value: string, t: Transform): string {
  let v = value;
  if (t.strip === "trim") v = v.replace(/^[\s\u00a0\u202f]+|[\s\u00a0\u202f]+$/g, "");
  else if (t.strip === "spaces") v = v.replace(/[\s\u00a0\u202f]/g, "");
  else if (t.strip === "digits") v = v.replace(/[^0-9]/g, "");
  if (t.dec === "dot") v = v.replace(/,/g, ".");
  else if (t.dec === "comma") v = v.replace(/\./g, ",");
  if (t.casing === "upper") v = v.toUpperCase();
  else if (t.casing === "lower") v = v.toLowerCase();
  return v;
}

/** Positions et longueurs du texte brut donnant l'output une fois nettoyé. */
function occurrences(input: string, output: string, t: Transform): { pos: number; len: number }[] {
  const res: { pos: number; len: number }[] = [];
  if (!output) return res;
  const sameLength = t.strip === "none";
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
  if (/^\d+$/.test(raw)) {
    set.add(`\\d{${raw.length}}`);
    set.add("\\d+");
  }
  if (/^[A-Za-z]+$/.test(raw)) set.add("[A-Za-z]+");
  if (/^[A-Za-z0-9]+$/.test(raw)) set.add("[A-Za-z0-9]+");
  if (/^[A-Za-z0-9 ]+$/.test(raw)) set.add("[A-Za-z0-9 ]+");
  // nombres formatés : "1 250,00", "3 410.90", "12 000"
  if (/^[\d][\d\s\u00a0\u202f.,]*\d$/.test(raw)) {
    set.add("[\\d\\s\\u00a0.,]+");
    set.add("\\d[\\d\\s\\u00a0]*[.,]\\d+");
    set.add("\\d[\\d\\s\\u00a0]*(?:[.,]\\d+)?");
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

/** Trouve une règle qui explique 100% des exemples fournis. */
export function synthesizeRule(examples: Example[]): Rule | null {
  const valid = examples.filter((e) => e.output !== "" && e.input !== "");
  if (valid.length === 0) return null;

  // cas constant
  const first = valid[0]!;
  if (valid.every((e) => e.output === first.output) && valid.length > 1) {
    const lit = escapeRegex(first.output);
    if (validate(`(${lit})`, NO_TRANSFORM, valid))
      return { source: `(${lit})`, flags: "", transform: NO_TRANSFORM };
  }

  const seed = valid.slice().sort((a, b) => a.input.length - b.input.length)[0]!;
  for (const transform of TRANSFORMS) {
    const candidates = buildCandidates(seed, transform);
    for (const src of candidates) {
      if (validate(src, transform, valid)) return { source: src, flags: "", transform };
    }
  }
  return null;
}

export function applyRule(rule: Rule, inputs: string[]): SynthResult {
  const re = new RegExp(rule.source, rule.flags);
  const values: (string | null)[] = [];
  const failures: number[] = [];
  let matched = 0;
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i] ?? "";
    const m = re.exec(input);
    const g = m?.[1];
    if (g !== undefined) {
      values.push(applyTransform(g, rule.transform));
      matched++;
    } else {
      values.push(null);
      if (input !== "") failures.push(i);
    }
  }
  return { rule, values, failures, matched, total: inputs.length };
}

export function synthesize(inputs: string[], expected: (string | null)[]): SynthResult {
  const examples: Example[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const e = expected[i];
    if (e != null && e !== "") examples.push({ index: i, input: inputs[i] ?? "", output: e });
  }
  const rule = synthesizeRule(examples);
  if (!rule) return { rule: null, values: inputs.map(() => null), failures: [], matched: 0, total: inputs.length };
  return applyRule(rule, inputs);
}
