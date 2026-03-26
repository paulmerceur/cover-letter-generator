"use client";

import { ChangeEvent, useState } from "react";

export default function HomePage() {
  const [jobDescription, setJobDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [result, setResult] = useState("");
  const [parsedResumeText, setParsedResumeText] = useState("");
  const [modelUsed, setModelUsed] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file ?? null);
    setSelectedFileName(file?.name ?? "");
  };

  const handleGenerate = async () => {
    setIsLoading(true);

    try {
      setResult("");
      setParsedResumeText("");
      setModelUsed("");

      const formData = new FormData();
      formData.append("jobDescription", jobDescription);

      if (selectedFile) {
        formData.append("resume", selectedFile);
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const responseText = await response.text();
      let data: {
        error?: string;
        letter?: string;
        parsedResumeText?: string;
        modelUsed?: string;
      } = {};

      try {
        data = JSON.parse(responseText) as {
          error?: string;
          letter?: string;
          parsedResumeText?: string;
          modelUsed?: string;
        };
      } catch {
        data = {};
      }

      if (!response.ok) {
        setParsedResumeText(data.parsedResumeText ?? "");
        setModelUsed(data.modelUsed ?? "");
        setResult(data.error ?? responseText ?? "Failed to generate cover letter.");
        return;
      }

      setResult(data.letter ?? "Failed to generate cover letter.");
      setParsedResumeText(data.parsedResumeText ?? "");
      setModelUsed(data.modelUsed ?? "");
    } catch (error) {
      console.error("Failed to generate cover letter:", error);
      setResult("Failed to generate cover letter.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Cover Letter Generator</h1>

      <label className="mb-4 block">
        <div className="mb-2">Job Description</div>
        <textarea
          className="min-h-40 w-full border p-3"
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          placeholder="Paste the job description here..."
        />
      </label>

      <label className="mb-4 block">
        <div className="mb-2">Resume PDF</div>
        <input
          className="w-full border p-2"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
        />
      </label>

      {selectedFileName ? (
        <p className="mb-4">Selected file: {selectedFileName}</p>
      ) : null}

      <div className="flex justify-center">
        <button
          className="mb-6 border px-4 py-2"
          type="button"
          onClick={handleGenerate}
          disabled={isLoading}
        >
          {isLoading ? "Generating..." : "Generate"}
        </button>
      </div>

      {result ? (
        <section className="mb-8">
          <div className="border p-4 whitespace-pre-wrap">{result}</div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-4 text-lg font-semibold">Debug</h2>

        <div className="mb-4">
          <h3 className="mb-2 font-semibold">Model Used</h3>
          <div className="border p-3">{modelUsed || "No model used yet."}</div>
        </div>

        <div>
          <h3 className="mb-2 font-semibold">Parsed Resume</h3>
          <div className="max-h-80 overflow-auto border p-3 whitespace-pre-wrap">
            {parsedResumeText || "Parsed PDF text will appear here after generation..."}
          </div>
        </div>
      </section>
    </main>
  );
}
