"use client";

import { ChangeEvent, useState } from "react";

export default function HomePage() {
  const [jobDescription, setJobDescription] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFileName(file?.name ?? "");
  };

  const handleGenerate = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobDescription }),
      });

      const data: { letter: string } = await response.json();
      setResult(data.letter);
    } catch (error) {
      console.error("Failed to generate cover letter:", error);
      setResult("Failed to generate cover letter.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-3xl font-semibold">Cover Letter Generator</h1>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Job Description</span>
        <textarea
          className="min-h-40 rounded border border-gray-300 p-3"
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          placeholder="Paste the job description here..."
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Resume PDF</span>
        <input
          className="rounded border border-gray-300 p-2"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
        />
      </label>

      {selectedFileName ? (
        <p className="text-sm text-gray-600">Selected file: {selectedFileName}</p>
      ) : null}

      <button
        className="w-fit rounded border border-gray-300 px-4 py-2"
        type="button"
        onClick={handleGenerate}
        disabled={isLoading}
      >
        {isLoading ? "Generating..." : "Generate"}
      </button>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Result</span>
        <textarea
          className="min-h-56 rounded border border-gray-300 p-3"
          value={result}
          readOnly
          placeholder="Generated cover letter will appear here..."
        />
      </label>
    </main>
  );
}
