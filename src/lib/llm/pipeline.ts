/**
 * Pipeline d'exécution principal :
 * « Algorithme d'abord, LLM local en fallback, validation indépendante. »
 */

import {
  applyRule,
  NO_TRANSFORM,
  synthesize,
  type Rule,
  type SynthResult,
} from "../regex-synth/engine";
import { buildCorrectionPrompt, buildInitialPrompt, parseCandidateJSON, SYSTEM_PROMPT } from "./prompts";
import type {
  ExamplePair,
  LLMFeedbackStep,
  LLMSynthesisResult,
  NegativeExample,
  RegexCandidate,
  RegexValidation,
} from "./types";
import { validateCandidate } from "./validator";
import { localLLM } from "./webllm-service";

export interface PipelineOptions {
  colName?: string;
  maxAttempts?: number;
  onAttempt?: (step: LLMFeedbackStep) => void;
  forceLLM?: boolean;
}

export type PipelineOutcome =
  | { origin: "algorithmic"; result: SynthResult }
  | { origin: "llm"; result: SynthResult; llmResult: LLMSynthesisResult }
  | { origin: "none"; error: string; llmResult?: LLMSynthesisResult };

/**
 * Exécute le pipeline complet :
 * 1. Moteur algorithmique existant.
 * 2. Si succès complet : conservation immédiate.
 * 3. Si échec ou couverture insuffisante : fallback LLM local avec boucle de validation.
 */
export async function runSynthesisPipeline(
  inputs: string[],
  expected: (string | null)[],
  options: PipelineOptions = {},
): Promise<PipelineOutcome> {
  const { colName, maxAttempts = 3, onAttempt, forceLLM = false } = options;

  // 1. Extraire les exemples positifs et les lignes non encore renseignées
  const positiveExamples: ExamplePair[] = [];
  const negativeExamples: NegativeExample[] = [];
  const unlabeledInputs: string[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const inp = inputs[i] ?? "";
    const exp = expected[i];
    if (exp != null && exp !== "") {
      positiveExamples.push({ input: inp, expected: exp });
    } else if (inp.trim() !== "") {
      unlabeledInputs.push(inp);
    }
  }

  // S'il n'y a aucun exemple positif fourni
  if (positiveExamples.length === 0) {
    return {
      origin: "algorithmic",
      result: {
        rule: null,
        values: inputs.map(() => null),
        failures: [],
        matched: 0,
        total: inputs.length,
      },
    };
  }

  // 2. MOTEUR ALGORITHMIQUE D'ABORD (sauf si forceLLM est expressément demandé)
  let partialAlgoResult: SynthResult | null = null;
  if (!forceLLM) {
    const algoResult = synthesize(inputs, expected);

    // Vérifier si le moteur algorithmique a expliqué 100% des exemples positifs
    let algoExplainsAll = false;
    if (algoResult.rule) {
      algoExplainsAll = positiveExamples.every((ex) => {
        const idx = inputs.findIndex((inp) => inp === ex.input);
        if (idx < 0) return true;
        return algoResult.values[idx] === ex.expected;
      });
    }

    if (algoResult.rule && algoExplainsAll) {
      // Si le résultat est parfait (0 échec sur toutes les lignes du fichier)
      if (algoResult.failures.length === 0) {
        return {
          origin: "algorithmic",
          result: algoResult,
        };
      }
      // Si la règle est partielle (ex: 8/10), la garder en réserve comme fallback
      partialAlgoResult = algoResult;
    }
  }

  // 3. FALLBACK LLM LOCAL (si l'algorithme n'a pas réussi ou est insuffisant)
  const attempts: LLMFeedbackStep[] = [];
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  let lastCandidate: RegexCandidate | null = null;
  let lastValidation: RegexValidation | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Préparer le prompt
    let userPrompt: string;
    if (attempt === 1) {
      userPrompt = buildInitialPrompt(positiveExamples, negativeExamples, colName, unlabeledInputs);
    } else {
      userPrompt = buildCorrectionPrompt(
        lastCandidate,
        lastValidation!,
        positiveExamples,
        negativeExamples,
      );
    }

    messages.push({ role: "user", content: userPrompt });

    let rawResponse = "";
    let candidate: RegexCandidate | null = null;
    let validation: RegexValidation | null = null;
    let stepError: string | undefined;

    try {
      rawResponse = await localLLM.generate(messages, 0.05 + (attempt - 1) * 0.1);
      candidate = parseCandidateJSON(rawResponse);

      if (!candidate) {
        stepError = "Format de réponse JSON non respecté par le modèle.";
        validation = {
          isValid: false,
          syntaxValid: false,
          positivePassed: 0,
          positiveTotal: positiveExamples.length,
          negativePassed: 0,
          negativeTotal: negativeExamples.length,
          edgeCasesPassed: 0,
          edgeCasesTotal: 0,
          security: { risk: "low", warnings: [], hasCatastrophicBacktracking: false },
          errors: [stepError],
        };
      } else {
        // Validation algorithmique indépendante
        validation = validateCandidate(candidate, positiveExamples, negativeExamples);
      }
    } catch (err) {
      stepError = err instanceof Error ? err.message : String(err);
      validation = {
        isValid: false,
        syntaxValid: false,
        positivePassed: 0,
        positiveTotal: positiveExamples.length,
        negativePassed: 0,
        negativeTotal: negativeExamples.length,
        edgeCasesPassed: 0,
        edgeCasesTotal: 0,
        security: { risk: "low", warnings: [], hasCatastrophicBacktracking: false },
        errors: [`Erreur d'exécution LLM : ${stepError}`],
      };
    }

    const step: LLMFeedbackStep = {
      attempt,
      candidate,
      validation,
      rawResponse,
      error: stepError,
    };
    attempts.push(step);
    if (onAttempt) onAttempt(step);

    lastCandidate = candidate;
    lastValidation = validation;

    // Si la validation algorithmique est validée avec succès
    if (validation && validation.isValid && candidate) {
      const validatedRule: Rule = {
        source: candidate.pattern,
        flags: candidate.flags,
        transform: NO_TRANSFORM,
        origin: "llm",
        llmMetadata: {
          modelName: localLLM.getCurrentModelConfig().name,
          runtime: localLLM.getDevice(),
          explanation: candidate.explanation,
          verified: true,
          securityRisk: validation.security.risk,
          positivePassed: validation.positivePassed,
          positiveTotal: validation.positiveTotal,
          negativePassed: validation.negativePassed,
          negativeTotal: validation.negativeTotal,
          attemptsCount: attempt,
        },
      };

      const finalResult = applyRule(validatedRule, inputs);

      return {
        origin: "llm",
        result: finalResult,
        llmResult: {
          success: true,
          candidate,
          validation,
          attempts,
          modelId: localLLM.getCurrentModelId(),
          runtime: localLLM.getDevice(),
        },
      };
    }

    // Préparer la réponse de l'assistant pour le tour de dialogue suivant
    if (rawResponse) {
      messages.push({ role: "assistant", content: rawResponse });
    }
  }

  // Si les 3 tentatives ont échoué, mais qu'un résultat algorithmique partiel existait
  if (partialAlgoResult && partialAlgoResult.rule) {
    return {
      origin: "algorithmic",
      result: partialAlgoResult,
    };
  }

  return {
    origin: "none",
    error: "Aucune regex fiable n'a pu être déduite automatiquement après 3 tentatives.",
    llmResult: {
      success: false,
      candidate: lastCandidate,
      validation: lastValidation,
      attempts,
      modelId: localLLM.getCurrentModelId(),
      runtime: localLLM.getDevice(),
    },
  };
}
