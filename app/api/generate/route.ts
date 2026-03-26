import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { coverLetterSystemPrompt } from "../../../lib/prompts/cover-letter-system-prompt";

export const runtime = "nodejs";

const require = createRequire(import.meta.url);
const openRouterModels = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-20b:free",
  "google/gemma-3-27b-it:free",
  "liquid/lfm-2.5-1.2b-thinking:free",
  "stepfun/step-3.5-flash:free",
] as const;
const pdfParseWorkerUrl = pathToFileURL(
  path.join(
    process.cwd(),
    "node_modules",
    "pdf-parse",
    "dist",
    "pdf-parse",
    "cjs",
    "pdf.worker.mjs",
  ),
).href;

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
    code?: number;
    metadata?: {
      raw?: string;
      provider_name?: string;
      is_byok?: boolean;
    };
  };
};

type OpenRouterFailure = {
  model: string;
  status: number;
  message: string;
};

function extractCandidateName(parsedResumeText: string): string {
  const candidateLine = parsedResumeText
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 10)
    .find((line) => {
      const hasEmail = line.includes("@");
      const hasManyDigits = (line.match(/\d/g) ?? []).length >= 3;
      const words = line
        .replace(/[^A-Za-z\s'-]/g, " ")
        .split(/\s+/)
        .filter(Boolean);

      return !hasEmail && !hasManyDigits && words.length >= 2 && words.length <= 5;
    });

  return candidateLine ?? "";
}

function getOpenRouterMessageContent(response: OpenRouterResponse): string {
  const content = response.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }

  return "";
}

async function generateWithOpenRouter(
  openRouterApiKey: string,
  promptInput: string,
): Promise<
  | { letter: string; model: string }
  | { failures: OpenRouterFailure[] }
> {
  const failures: OpenRouterFailure[] = [];

  for (const model of openRouterModels) {
    const openRouterResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: coverLetterSystemPrompt,
            },
            {
              role: "user",
              content: promptInput,
            },
          ],
          temperature: 0.7,
        }),
      },
    );

    const responseText = await openRouterResponse.text();
    let openRouterData: OpenRouterResponse = {};

    try {
      openRouterData = JSON.parse(responseText) as OpenRouterResponse;
    } catch {
      openRouterData = {};
    }

    if (!openRouterResponse.ok) {
      const errorMessage =
        openRouterData.error?.metadata?.raw ??
        openRouterData.error?.message ??
        responseText ??
        "OpenRouter request failed.";

      failures.push({
        model,
        status: openRouterResponse.status,
        message: errorMessage,
      });

      continue;
    }

    const letter = getOpenRouterMessageContent(openRouterData);

    if (!letter) {
      failures.push({
        model,
        status: 500,
        message: "OpenRouter returned an empty response.",
      });

      continue;
    }

    return { letter, model };
  }

  return { failures };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const jobDescriptionValue = formData.get("jobDescription");
    const resumeFile = formData.get("resume");

    const jobDescription =
      typeof jobDescriptionValue === "string" ? jobDescriptionValue : "";

    if (!(resumeFile instanceof File)) {
      return Response.json(
        { error: "Please upload a PDF resume." },
        { status: 400 },
      );
    }

    if (resumeFile.type !== "application/pdf") {
      return Response.json(
        { error: "Only PDF files are supported." },
        { status: 400 },
      );
    }

    const { PDFParse } = require("pdf-parse") as typeof import("pdf-parse");

    PDFParse.setWorker(pdfParseWorkerUrl);

    const fileBuffer = Buffer.from(await resumeFile.arrayBuffer());
    const parser = new PDFParse({ data: fileBuffer });
    const parsedResume = await parser.getText();

    await parser.destroy();

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;

    if (!openRouterApiKey || openRouterApiKey === "paste_your_openrouter_api_key_here") {
      return Response.json(
        { error: "Missing OPENROUTER_API_KEY in .env.local." },
        { status: 500 },
      );
    }

    const promptInput = [
      "Candidate Name:",
      extractCandidateName(parsedResume.text),
      "",
      "Job Description:",
      jobDescription.trim(),
      "",
      "Parsed Resume:",
      parsedResume.text.trim(),
    ].join("\n");

    const openRouterResult = await generateWithOpenRouter(
      openRouterApiKey,
      promptInput,
    );

    if ("failures" in openRouterResult) {
      console.error("OpenRouter API errors:", openRouterResult.failures);
      const lastFailure =
        openRouterResult.failures[openRouterResult.failures.length - 1];

      return Response.json(
        {
          error: lastFailure
            ? `All fallback models failed. Last error from ${lastFailure.model}: ${lastFailure.message}`
            : "All fallback models failed.",
          parsedResumeText: parsedResume.text,
        },
        { status: lastFailure?.status ?? 500 },
      );
    }

    console.log("OpenRouter model used:", openRouterResult.model);

    return Response.json({
      letter: openRouterResult.letter,
      modelUsed: openRouterResult.model,
      parsedResumeText: parsedResume.text,
    });
  } catch (error) {
    console.error("Generate API error:", error);

    return Response.json(
      { error: "Failed to generate the cover letter." },
      { status: 500 },
    );
  }
}
