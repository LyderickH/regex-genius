/// <reference lib="webworker" />
import { synthesize } from "./engine";

let cachedInputs: string[] = [];

self.onmessage = (event: MessageEvent) => {
  const { id, inputs, expected } = event.data as {
    id: number;
    inputs?: string[];
    expected: (string | null)[];
  };
  if (inputs) {
    cachedInputs = inputs;
  }
  const effectiveInputs = inputs ?? cachedInputs;
  let result;
  try {
    result = synthesize(effectiveInputs, expected);
  } catch {
    result = {
      rule: null,
      values: effectiveInputs.map(() => null),
      failures: [],
      matched: 0,
      total: effectiveInputs.length,
    };
  }
  (self as unknown as Worker).postMessage({ id, result });
};
