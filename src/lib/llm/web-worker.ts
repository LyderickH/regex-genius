/// <reference lib="webworker" />
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// Gestionnaire Web Worker pour l'inférence WebLLM hors thread principal
const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
