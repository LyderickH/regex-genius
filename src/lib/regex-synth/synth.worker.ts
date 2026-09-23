/// <reference lib="webworker" />
import { synthesize } from "./engine";

self.onmessage = (event: MessageEvent) => {
  const { id, inputs, expected } = event.data as {
    id: number;
    inputs: string[];
    expected: (string | null)[];
  };
  let result;
  try {
    result = synthesize(inputs, expected);
  } catch {
    result = { rule: null, values: inputs.map(() => null), failures: [], matched: 0, total: inputs.length };
  }
  (self as unknown as Worker).postMessage({ id, result });
};
