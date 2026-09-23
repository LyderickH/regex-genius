/**
 * Types pour le moteur LLM local (WebLLM / WebGPU / WASM)
 * et la validation algorithmique indépendante.
 */

export interface LocalModelConfig {
  id: string;
  name: string;
  family: "smollm" | "qwen" | "llama";
  size: string;
  description: string;
  recommended: "mobile" | "balanced" | "power";
  vramMB: number;
}

export const AVAILABLE_MODELS: LocalModelConfig[] = [
  {
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    name: "SmolLM2 360M",
    family: "smollm",
    size: "240 Mo",
    description: "Ultra-léger, rapide, idéal pour téléphones et petites machines.",
    recommended: "mobile",
    vramMB: 400,
  },
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 0.5B",
    family: "qwen",
    size: "350 Mo",
    description: "Compact et très performant sur les tâches d'extraction textuelle.",
    recommended: "mobile",
    vramMB: 600,
  },
  {
    id: "Qwen3.5-0.8B-q4f16_1-MLC",
    name: "Qwen 3.5 0.8B",
    family: "qwen",
    size: "520 Mo",
    description: "Excellent équilibre entre taille et capacité de raisonnement regex.",
    recommended: "balanced",
    vramMB: 900,
  },
  {
    id: "Qwen3.5-2B-q4f16_1-MLC",
    name: "Qwen 3.5 2B",
    family: "qwen",
    size: "1.3 Go",
    description: "Haute précision pour les cas complexes avec règles intriquées.",
    recommended: "power",
    vramMB: 1800,
  },
];

export type RuntimeDevice = "webgpu" | "wasm" | "unsupported";

export interface ModelProgressReport {
  status: "idle" | "downloading" | "loading" | "ready" | "generating" | "validating" | "error";
  progressPercent: number; // 0 - 100
  text: string;
  timeElapsedSeconds?: number;
}

export interface RegexCandidate {
  pattern: string;
  flags: string;
  explanation: string;
  confidence: number;
}

export interface ExamplePair {
  input: string;
  expected: string;
}

export interface NegativeExample {
  input: string;
  reason?: string;
}

export type SecurityRiskLevel = "low" | "medium" | "high";

export interface SecurityAnalysis {
  risk: SecurityRiskLevel;
  warnings: string[];
  hasCatastrophicBacktracking: boolean;
}

export interface RegexValidation {
  isValid: boolean;
  syntaxValid: boolean;
  positivePassed: number;
  positiveTotal: number;
  negativePassed: number;
  negativeTotal: number;
  edgeCasesPassed: number;
  edgeCasesTotal: number;
  security: SecurityAnalysis;
  errors: string[];
  failedExamples?: {
    type: "positive" | "negative" | "edge";
    input: string;
    expected?: string;
    got?: string | null;
  }[];
}

export interface LLMFeedbackStep {
  attempt: number;
  candidate: RegexCandidate | null;
  validation: RegexValidation | null;
  rawResponse?: string;
  error?: string;
}

export interface LLMSynthesisResult {
  success: boolean;
  candidate: RegexCandidate | null;
  validation: RegexValidation | null;
  attempts: LLMFeedbackStep[];
  modelId: string;
  runtime: RuntimeDevice;
}
