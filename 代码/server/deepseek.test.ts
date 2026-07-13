import { describe, expect, it } from "vitest";
import { describeModelRequest, modelRequestOptions, modelTimeoutMessage } from "./deepseek.js";

describe("model request diagnostics", () => {
  it("reports a safe, normalized custom endpoint without exposing the API key", () => {
    expect(describeModelRequest({
      provider: "OpenRouter",
      model: "google/gemini-2.5-flash",
      baseUrl: "https://openrouter.ai/api/v1/",
      apiKey: "sk-secret-must-never-appear"
    })).toEqual({
      provider: "OpenRouter",
      model: "google/gemini-2.5-flash",
      endpoint: "https://openrouter.ai/api/v1/chat/completions"
    });
  });

  it("tells the user which safe endpoint timed out", () => {
    expect(modelTimeoutMessage({
      provider: "OpenRouter",
      model: "google/gemini-2.5-flash",
      baseUrl: "https://openrouter.ai/api/v1/"
    })).toBe("OpenRouter（google/gemini-2.5-flash）在 45 秒内未响应：https://openrouter.ai/api/v1/chat/completions");
  });

  it("disables GLM-5 thinking and bounds its JSON output for interactive use", () => {
    expect(modelRequestOptions({ model: "glm-5-turbo" })).toEqual({
      thinking: { type: "disabled" },
      max_tokens: 8192
    });
  });
});
