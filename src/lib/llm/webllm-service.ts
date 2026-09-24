/**
 * Service d'orchestration WebLLM côté client (WebGPU / WASM)
 * Exécuté dans un Web Worker dédié pour ne jamais bloquer l'UI.
 */

import {
  CreateWebWorkerMLCEngine,
  type WebWorkerMLCEngine,
  type InitProgressReport,
  hasModelInCache,
} from "@mlc-ai/web-llm";
import {
  AVAILABLE_MODELS,
  type LocalModelConfig,
  type ModelProgressReport,
  type RuntimeDevice,
} from "./types";

export type ProgressSubscriber = (report: ModelProgressReport) => void;

export interface DecryptedPatternStep {
  token: string;
  label: string;
  technical: string;
  human: string;
}

export interface DecryptedPatternResult {
  summary: string;
  steps: DecryptedPatternStep[];
}

class LocalLLMService {
  private engine: WebWorkerMLCEngine | null = null;
  private worker: Worker | null = null;
  private currentModelId: string = "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC";
  private device: RuntimeDevice = "webgpu";
  private isInitializing: boolean = false;
  private isLoadedState: boolean = false;
  private subscribers: Set<ProgressSubscriber> = new Set();
  private currentReport: ModelProgressReport = {
    status: "idle",
    progressPercent: 0,
    text: "En attente",
  };

  constructor() {
    this.detectDevice();
  }

  public async detectDevice(): Promise<RuntimeDevice> {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return "wasm";
    }
    if ("gpu" in navigator && (navigator as unknown as { gpu?: unknown }).gpu) {
      try {
        const gpu = (navigator as unknown as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu;
        const adapter = await gpu.requestAdapter();
        if (adapter) {
          this.device = "webgpu";
          return "webgpu";
        }
      } catch {
        // Fallback en cas d'échec
      }
    }
    this.device = "wasm";
    // Si mobile / WASM, basculer sur le modèle ultra-léger par défaut
    if (this.currentModelId.includes("Coder-1.5B") || this.currentModelId.includes("2B") || this.currentModelId.includes("0.8B")) {
      this.currentModelId = "SmolLM2-360M-Instruct-q4f16_1-MLC";
    }
    return "wasm";
  }

  public getDevice(): RuntimeDevice {
    return this.device;
  }

  public getCurrentModelId(): string {
    return this.currentModelId;
  }

  public getCurrentModelConfig(): LocalModelConfig {
    return (
      AVAILABLE_MODELS.find((m) => m.id === this.currentModelId) ?? AVAILABLE_MODELS[0]!
    );
  }

  public setModel(modelId: string) {
    if (this.currentModelId !== modelId) {
      this.currentModelId = modelId;
      // Si un modèle était déjà chargé, on libère l'ancien
      if (this.isLoadedState) {
        this.unload();
      }
    }
  }

  public subscribe(callback: ProgressSubscriber): () => void {
    this.subscribers.add(callback);
    callback(this.currentReport);
    return () => this.subscribers.delete(callback);
  }

  private notify(report: Partial<ModelProgressReport>) {
    this.currentReport = { ...this.currentReport, ...report };
    for (const sub of this.subscribers) {
      sub(this.currentReport);
    }
  }

  public isLoaded(): boolean {
    return this.isLoadedState && this.engine !== null;
  }

  public async isModelCached(modelId?: string): Promise<boolean> {
    const id = modelId ?? this.currentModelId;
    try {
      return await hasModelInCache(id);
    } catch {
      return false;
    }
  }

  /**
   * Charge le modèle local dans le Web Worker.
   * Si déjà chargé avec le même modèle, ne fait rien.
   */
  public async load(modelId?: string): Promise<void> {
    const targetModel = modelId ?? this.currentModelId;

    if (this.isLoadedState && this.engine && this.currentModelId === targetModel) {
      return;
    }

    if (this.isInitializing) {
      // Attendre que l'initialisation en cours se termine
      while (this.isInitializing) {
        await new Promise((r) => setTimeout(r, 200));
      }
      if (this.isLoadedState && this.currentModelId === targetModel) return;
    }

    this.isInitializing = true;
    this.currentModelId = targetModel;
    await this.detectDevice();

    this.notify({
      status: "downloading",
      progressPercent: 0,
      text: `Chargement de ${this.getCurrentModelConfig().name}...`,
    });

    try {
      // Nettoyage éventuel du worker précédent
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }

      this.worker = new Worker(new URL("./web-worker.ts", import.meta.url), {
        type: "module",
      });

      const startTime = performance.now();

      this.engine = await CreateWebWorkerMLCEngine(this.worker, targetModel, {
        initProgressCallback: (report: InitProgressReport) => {
          const percent = Math.min(100, Math.round((report.progress || 0) * 100));
          const elapsed = (performance.now() - startTime) / 1000;
          const status = percent >= 100 ? "loading" : "downloading";
          this.notify({
            status,
            progressPercent: percent,
            text: report.text || `Chargement des poids (${percent}%)...`,
            timeElapsedSeconds: Math.round(elapsed),
          });
        },
      });

      this.isLoadedState = true;
      this.isInitializing = false;
      this.notify({
        status: "ready",
        progressPercent: 100,
        text: `Modèle ${this.getCurrentModelConfig().name} prêt`,
      });
    } catch (err) {
      this.isInitializing = false;
      this.isLoadedState = false;
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.notify({
        status: "error",
        text: `Erreur de chargement du modèle : ${errorMsg}`,
      });
      throw err;
    }
  }

  /**
   * Exécute une requête de chat completion dans le Web Worker
   */
  public async generate(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    temperature = 0.05,
  ): Promise<string> {
    if (!this.engine || !this.isLoadedState) {
      await this.load();
    }

    if (!this.engine) {
      throw new Error("Moteur LLM local non disponible.");
    }

    this.notify({
      status: "generating",
      text: "Synthèse de l'expression régulière en cours...",
    });

    try {
      const completion = await this.engine.chat.completions.create({
        messages,
        temperature,
        max_tokens: 512,
        // @ts-expect-error MLC engine response_format supports schema / json_object
        response_format: {
          type: "json_object",
          schema: JSON.stringify({
            type: "object",
            properties: {
              pattern: { type: "string" },
              flags: { type: "string" },
              explanation: { type: "string" },
              confidence: { type: "number" },
            },
            required: ["pattern", "explanation", "confidence"],
          }),
        },
      });

      const responseText = completion.choices[0]?.message?.content || "";
      this.notify({
        status: "ready",
        text: "Génération terminée",
      });
      return responseText;
    } catch (err) {
      this.notify({
        status: "error",
        text: `Erreur lors de la génération : ${err instanceof Error ? err.message : String(err)}`,
      });
      throw err;
    }
  }

  /**
   * Demande au LLM local de décrypter et expliquer un motif regex sous un double angle :
   * technique (syntaxe regex) et humain (sens concret dans les données).
   */
  public async explainPattern(
    pattern: string,
    examples: Array<{ input: string; output: string }>,
  ): Promise<DecryptedPatternResult> {
    if (!this.engine || !this.isLoadedState) {
      await this.load();
    }

    if (!this.engine) {
      throw new Error("Moteur LLM local non disponible.");
    }

    this.notify({
      status: "generating",
      text: "Décryptage du motif par l'IA locale...",
    });

    const sampleText = examples
      .filter((e) => e.input && e.output)
      .slice(0, 4)
      .map((e) => `• "${e.input}" ➜ "${e.output}"`)
      .join("\n");

    const prompt = `Voici une expression régulière JavaScript : \`${pattern}\`
${sampleText ? `Exemples concrets de données traitées :\n${sampleText}\n` : ""}

Décompose cette expression régulière en ses tokens ou composants logiques essentiels (ex: préfixe repère, groupe(s) de capture, quantificateurs, suffixe, ancres).
Pour CHAQUE composant / token, explique obligatoirement :
1. "technical" : Ce que ça veut dire d'un point de vue technique (la règle regex, la syntaxe, classes de caractères autorisées, échappements, quantificateurs, groupes).
2. "human" : Ce que ça veut dire concrètement d'un point de vue humain (ce que cette partie représente dans les données réelles de l'utilisateur).

Ne découpe pas en caractères isolés sans contexte (ne sépare pas inutilement '1' puis '.' puis '1'), regroupe par token logique signifiant.

Réponds EXCLUSIVEMENT par un objet JSON valide de la forme :
{
  "summary": "Résumé limpide en français en une phrase",
  "steps": [
    {
      "token": "morceau_du_motif",
      "label": "Rôle du composant (ex: Préfixe textuel repère, Valeur extraite (Groupe 1)...)",
      "technical": "Explication technique détaillée de la syntaxe regex",
      "human": "Explication concrète dans le contexte des données réelles"
    }
  ]
}`;

    try {
      const completion = await this.engine.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "Tu es un expert pédagogique en expressions régulières. Tu décomposes les regex sous un double angle technique et humain. Réponds UNIQUEMENT par du JSON valide sans Markdown.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 600,
      });

      const responseText = completion.choices[0]?.message?.content?.trim() || "";
      this.notify({
        status: "ready",
        text: "Décryptage terminé",
      });

      let jsonStr = responseText;
      const fenceMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1];
      }
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && typeof parsed.summary === "string") {
            return {
              summary: parsed.summary,
              steps: Array.isArray(parsed.steps)
                ? parsed.steps.map((st: Record<string, unknown>) => ({
                    token: String(st.token || ""),
                    label: String(st.label || "Étape"),
                    technical: String(st.technical || ""),
                    human: String(st.human || ""),
                  }))
                : [],
            };
          }
        } catch {
          // Fallback sur le texte brut
        }
      }

      return {
        summary: responseText,
        steps: [],
      };
    } catch (err) {
      this.notify({
        status: "error",
        text: `Erreur lors du décryptage : ${err instanceof Error ? err.message : String(err)}`,
      });
      throw err;
    }
  }

  /**
   * Libère la mémoire VRAM/RAM et termine le worker
   */
  public async unload(): Promise<void> {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.engine = null;
    this.isLoadedState = false;
    this.isInitializing = false;
    this.notify({
      status: "idle",
      progressPercent: 0,
      text: "Modèle déchargé de la mémoire",
    });
  }
}

export const localLLM = new LocalLLMService();
