import { Buffer } from "node:buffer";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
    return Response.json({ error: "Only PDF files are supported." }, { status: 400 });
  }

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
}
