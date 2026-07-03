export type AiModelConfig = {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
};

export type AiRequestSettings = {
  prompt?: string;
  modelConfig?: AiModelConfig;
};

export const DEFAULT_MODEL_CONFIG: AiModelConfig = {
  provider: "DeepSeek",
  model: "",
  baseUrl: "",
  apiKey: ""
};

const PROMPT_STORAGE_KEY = "liqing.aiPrompt.v1";
const MODEL_STORAGE_KEY = "liqing.aiModel.v1";

export function loadAiPrompt() {
  try {
    return window.localStorage.getItem(PROMPT_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveAiPrompt(prompt: string) {
  window.localStorage.setItem(PROMPT_STORAGE_KEY, prompt);
}

export function loadAiModelConfig(): AiModelConfig {
  try {
    const raw = window.localStorage.getItem(MODEL_STORAGE_KEY);
    if (!raw) return DEFAULT_MODEL_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AiModelConfig>;
    return {
      provider: typeof parsed.provider === "string" ? parsed.provider : DEFAULT_MODEL_CONFIG.provider,
      model: typeof parsed.model === "string" ? parsed.model : "",
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : ""
    };
  } catch {
    return DEFAULT_MODEL_CONFIG;
  }
}

export function saveAiModelConfig(config: AiModelConfig) {
  window.localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(config));
}

export function buildAiRequestSettings(prompt: string, modelConfig: AiModelConfig): AiRequestSettings {
  const trimmedPrompt = prompt.trim();
  const cleanedModel = {
    provider: modelConfig.provider.trim(),
    model: modelConfig.model.trim(),
    baseUrl: modelConfig.baseUrl.trim(),
    apiKey: modelConfig.apiKey.trim()
  };
  const hasCustomModel =
    cleanedModel.model ||
    cleanedModel.baseUrl ||
    cleanedModel.apiKey ||
    (cleanedModel.provider && cleanedModel.provider !== DEFAULT_MODEL_CONFIG.provider);
  return {
    prompt: trimmedPrompt || undefined,
    modelConfig: hasCustomModel ? cleanedModel : undefined
  };
}
