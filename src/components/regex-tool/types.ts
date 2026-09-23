import type { Rule } from "@/lib/regex-synth/engine";

export interface OutputColumn {
  id: string;
  name: string;
  /** valeurs saisies par l'utilisateur (exemples) */
  user: (string | null)[];
  /** valeurs déduites par le moteur */
  derived: (string | null)[];
  rule: Rule | null;
  matched: number;
  failures: number[];
  pending: boolean;
}

export const emptyColumn = (name: string, length: number): OutputColumn => ({
  id: Math.random().toString(36).slice(2, 9),
  name,
  user: Array(length).fill(null),
  derived: Array(length).fill(null),
  rule: null,
  matched: 0,
  failures: [],
  pending: false,
});

export const cellValue = (col: OutputColumn, i: number): string =>
  col.user[i] ?? col.derived[i] ?? "";
