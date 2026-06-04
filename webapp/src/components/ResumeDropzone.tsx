"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface ResumeDropzoneProps {
  onFileAccepted: (file: File, text: string, sessionId: string | null) => void;
}

export default function ResumeDropzone({ onFileAccepted }: ResumeDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setFileName(file.name);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");

        const data = await res.json();
        onFileAccepted(file, data.text, data.sessionId ?? null);
      } catch (err) {
        console.error("Upload error:", err);
        setError("Failed to process the resume. Please try again.");
        setFileName(null);
      } finally {
        setIsProcessing(false);
      }
    },
    [onFileAccepted]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="dropzone-wrapper">
      <div
        className={`dropzone ${isDragging ? "drag-over" : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        id="resume-dropzone"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.md,.txt"
          onChange={onInputChange}
        />

        {error ? (
          <>
            <div className="upload-icon" style={{ color: "#ef4444" }}>
              <AlertCircle size={40} strokeWidth={1.5} />
            </div>
            <h3 style={{ color: "#ef4444" }}>{error}</h3>
            <p>Click to try again</p>
          </>
        ) : isProcessing ? (
          <>
            <div className="upload-icon">
              <Loader2 size={40} strokeWidth={1.5} className="spin-icon" />
            </div>
            <h3>Processing {fileName}...</h3>
            <p>Extracting text from your resume</p>
          </>
        ) : fileName ? (
          <>
            <div className="upload-icon" style={{ color: "#22c55e" }}>
              <CheckCircle2 size={40} strokeWidth={1.5} />
            </div>
            <h3>{fileName}</h3>
            <p>Resume loaded! Click to upload a different one.</p>
          </>
        ) : (
          <>
            <div className="upload-icon">
              <Upload size={40} strokeWidth={1.5} />
            </div>
            <h3>Drop Your Resume Here</h3>
            <p>or click to browse files</p>
            <div className="file-types">
              <span className="file-type-tag">PDF</span>
              <span className="file-type-tag">DOCX</span>
              <span className="file-type-tag">Markdown</span>
              <span className="file-type-tag">TXT</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
