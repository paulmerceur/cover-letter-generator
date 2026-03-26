import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const runtime = "nodejs";

const require = createRequire(import.meta.url);
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

    console.log("Generate request body:", {
      jobDescription,
      resumeText: parsedResume.text,
    });

    return Response.json({
      letter: "This is a placeholder cover letter.",
    });
  } catch (error) {
    console.error("Generate API error:", error);

    return Response.json(
      { error: "Failed to parse the uploaded PDF." },
      { status: 500 },
    );
  }
}
