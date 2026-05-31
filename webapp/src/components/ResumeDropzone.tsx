"use client";

import { useState, useRef, useCallback } from "react";

interface ResumeDropzoneProps {
  onFileAccepted: (file: File, text: string, sessionId: string | null) => void;
}

export default function ResumeDropzone({ onFileAccepted }: ResumeDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setFileName(file.name);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");

        const data = await res.json();

        // data.sessionId is the Redis-backed resume session ID returned by FastAPI.
        // It is null when FastAPI is offline (graceful degradation).
        onFileAccepted(file, data.text, data.sessionId ?? null);
      } catch (err) {
        console.error("Upload error:", err);
        alert("Failed to process the resume. Please try again.");
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

        {isProcessing ? (
          <>
            <div className="upload-icon">⏳</div>
            <h3>Processing {fileName}...</h3>
            <p>Extracting text from your resume</p>
            <div style={{ marginTop: 16 }}>
              <span className="spinner" />
            </div>
          </>
        ) : fileName ? (
          <>
            <div className="upload-icon">✅</div>
            <h3>{fileName}</h3>
            <p>Resume loaded! Click to upload a different one.</p>
          </>
        ) : (
          <>
            <div className="upload-icon">📄</div>
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
