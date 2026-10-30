export class GeminiError extends Error {
  status: number;
  body: string;

  constructor(statusOrMessage: number | string, body?: string) {
    if (typeof statusOrMessage === "number") {
      super(`Gemini API error (${statusOrMessage}): ${body || ""}`);
      this.status = statusOrMessage;
      this.body = body || "";
    } else {
      super(`Gemini API error: ${statusOrMessage}`);
      this.status = 502;
      this.body = statusOrMessage;
    }
    this.name = "GeminiError";
  }
}

export class GeminiParseError extends Error {
  rawText: string;

  constructor(message: string, rawText: string) {
    super(message);
    this.name = "GeminiParseError";
    this.rawText = rawText.slice(0, 1000); // truncated
  }
}

export interface GenerateStructuredParams {
  prompt: string;
  responseSchema: Record<string, unknown>;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

const BACKOFF_DELAYS = [500, 1500, 4000];

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateStructured<T>(
  params: GenerateStructuredParams
): Promise<T> {
  const {
    prompt,
    responseSchema,
    model = process.env.GEMINI_MODEL_BLUEPRINT || "gemini-4-argon",
    temperature = 0.2,
    maxOutputTokens = 8192,
  } = params;

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiError(
      401,
      "GEMINI_API_KEY is not defined. Please configure GEMINI_API_KEY in your environment."
    );
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature,
      maxOutputTokens,
    },
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);

      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (fetchErr: any) {
        if (fetchErr.name === "AbortError") {
          throw new GeminiError(504, "Gemini API request timed out after 45 seconds");
        }
        throw fetchErr;
      } finally {
        clearTimeout(timer);
      }

      if (res.status === 429 || res.status >= 500) {
        const errorText = await res.text().catch(() => "");
        lastError = new GeminiError(res.status, errorText);

        if (attempt < 2) {
          await sleep(BACKOFF_DELAYS[attempt]);
          continue;
        }
        throw lastError;
      }

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new GeminiError(res.status, errorText);
      }

      const json = await res.json();
      if (!json.candidates?.length) {
        throw new GeminiError("no candidates");
      }

      const candidate = json.candidates[0];
      if (candidate.finishReason && candidate.finishReason !== "STOP") {
        throw new GeminiError(`finishReason=${candidate.finishReason}`);
      }

      const partText = candidate.content?.parts?.[0]?.text;

      if (!partText || typeof partText !== "string") {
        throw new GeminiParseError("Gemini returned empty or missing part text", JSON.stringify(json));
      }

      try {
        return JSON.parse(partText) as T;
      } catch (parseErr: unknown) {
        throw new GeminiParseError(
          `Failed to parse Gemini output as JSON: ${(parseErr as Error).message}`,
          partText
        );
      }
    } catch (err: unknown) {
      if (err instanceof GeminiError && (err.status === 429 || err.status >= 500)) {
        lastError = err;
        if (attempt < 2) {
          await sleep(BACKOFF_DELAYS[attempt]);
          continue;
        }
      }
      throw err;
    }
  }

  throw lastError || new Error("Gemini generateContent request failed after retries");
}
