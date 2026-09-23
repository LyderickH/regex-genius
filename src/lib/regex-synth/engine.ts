/**
 * Moteur de synthèse d'expressions régulières à partir d'exemples.
 * 100% local : tokenisation, énumération guidée de règles candidates,
 * validation sur tous les exemples fournis, sélection de la plus simple.
 */

export type Transform = "none" | "upper" | "lower";

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
  if (t === "upper") return value.toUpperCase();
  if (t === "lower") return value.toLowerCase();
  return value;
}

function occurrences(input: string, output: string, t: Transform): number[] {
  const res: number[] = [];
  if (!output) return res;
  for (let i = 0; i + output.length <= input.length; i++) {
    if (applyTransform(input.substr(i, output.length), t) === output) res.push(i);
    if (res.length >= 4) break;
  }
  return res;
}

function capturePatterns(output: string, rightChar: string | null): string[] {
  const set = new Set<string>();
  set.add(escapeRegex(output));
  set.add(runsPattern(output, true));
  set.add(runsPattern(output, false));
  if (/^\d+$/.test(output)) {
    set.add(`\\d{${output.length}}`);
    set.add("\\d+");
  }
  if (/^[A-Za-z]+$/.test(output)) set.add("[A-Za-z]+");
  if (/^[A-Za-z0-9]+$/.test(output)) set.add("[A-Za-z0-9]+");
  if (/^[A-Za-z0-9 ]+$/.test(output)) set.add("[A-Za-z0-9 ]+");
  if (rightChar && !/\s/.test(rightChar)) set.add(`[^${escapeClass(rightChar)}]+`);
  if (!/\s/.test(output)) set.add("\\S+");
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
  return s;
}

function buildCandidates(ex: Example, transform: Transform): string[] {
  const { input, output } = ex;
  const cands: { src: string; score: number }[] = [];
  for (const pos of occurrences(input, output, transform)) {
    const left = input.slice(0, pos);
    const right = input.slice(pos + output.length);

    const lefts = new Set<string>([""]);
    if (pos === 0) lefts.add("^");
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

    const caps = capturePatterns(output, right.length ? right.charAt(0) : null);
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
  if (valid.every((e) => e.output === valid[0].output) && valid.length > 1) {
    const lit = escapeRegex(valid[0].output);
    if (validate(`(${lit})`, "none", valid)) return { source: `(${lit})`, flags: "", transform: "none" };
  }

  const seed = valid.slice().sort((a, b) => a.input.length - b.input.length)[0];
  for (const transform of ["none", "upper", "lower"] as Transform[]) {
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
    const m = re.exec(inputs[i]);
    if (m && m[1] !== undefined) {
      values.push(applyTransform(m[1], rule.transform));
      matched++;
    } else {
      values.push(null);
      if (inputs[i] !== "") failures.push(i);
    }
  }
  return { rule, values, failures, matched, total: inputs.length };
}

export function synthesize(inputs: string[], expected: (string | null)[]): SynthResult {
  const examples: Example[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const e = expected[i];
    if (e != null && e !== "") examples.push({ index: i, input: inputs[i], output: e });
  }
  const rule = synthesizeRule(examples);
  if (!rule) return { rule: null, values: inputs.map(() => null), failures: [], matched: 0, total: inputs.length };
  return applyRule(rule, inputs);
}
