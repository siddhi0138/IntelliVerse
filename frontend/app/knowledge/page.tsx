"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { askDocuments, deleteDocument, listDatasets, listDocuments, uploadDocuments } from "@/lib/api";
import type { AskDocumentsResponse, CatalogEntry, DocumentEntry } from "@/lib/types";

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<DocumentEntry[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [datasets, setDatasets] = useState<CatalogEntry[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>("");

  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<AskDocumentsResponse | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    listDocuments()
      .then(setDocuments)
      .catch((err) => setUploadError(err instanceof Error ? err.message : "Could not load documents."));
  }, []);

  useEffect(() => {
    refresh();
    listDatasets()
      .then(setDatasets)
      .catch(() => {});
  }, [refresh]);

  async function handleFiles(files: FileList | File[]) {
    setUploading(true);
    setUploadError(null);
    try {
      await uploadDocuments(Array.from(files));
      refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    await deleteDocument(docId);
    refresh();
  }

  async function handleAsk() {
    if (!question.trim()) return;
    setAsking(true);
    setAskError(null);
    setAnswer(null);
    try {
      const result = await askDocuments(question.trim(), selectedDataset || undefined);
      setAnswer(result);
    } catch (err) {
      setAskError(err instanceof Error ? err.message : "Could not answer that question.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">📄 Knowledge Assistant</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Ask questions across uploaded PDFs, Word docs, and PowerPoint decks — grounded only in what&apos;s
            retrieved, cited by filename. Optionally combine with a dataset&apos;s findings below.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full px-3 py-1.5 whitespace-nowrap"
        >
          &larr; Back to upload
        </Link>
      </header>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors mb-6 ${
          dragActive
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
            : "border-slate-300 dark:border-slate-800 hover:border-indigo-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.pptx,.txt"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
          }}
        />
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          {uploading ? "Uploading and indexing…" : "Drop PDF, DOCX, PPTX, or TXT files here, or click to browse"}
        </p>
      </div>

      {uploadError && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{uploadError}</p>}

      {documents && documents.length > 0 && (
        <div className="card mb-8">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">Uploaded documents</h3>
          <ul className="space-y-2">
            {documents.map((d) => (
              <li key={d.doc_id} className="flex items-center justify-between text-sm">
                <span>
                  {d.filename}{" "}
                  <span className="text-slate-500 text-xs">
                    ({d.chunk_count} chunk{d.chunk_count === 1 ? "" : "s"}, {new Date(d.uploaded_at).toLocaleString()})
                  </span>
                </span>
                <button onClick={() => handleDelete(d.doc_id)} className="btn-danger-ghost">
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {documents && documents.length === 0 && (
        <div className="card text-center py-8 mb-8">
          <p className="text-sm text-slate-500">No documents uploaded yet.</p>
        </div>
      )}

      <div className="card">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">Ask across your documents</h3>

        {datasets.length > 0 && (
          <div className="mb-3">
            <label className="block text-xs text-slate-500 mb-1">
              Also consider this dataset&apos;s findings (optional)
            </label>
            <select
              value={selectedDataset}
              onChange={(e) => setSelectedDataset(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm"
            >
              <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                Documents only
              </option>
              {datasets.map((d) => (
                <option
                  key={d.analysis_id}
                  value={d.analysis_id}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  {d.filename} ({d.domain})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="e.g. Why did revenue decrease last quarter?"
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-800 bg-transparent px-3 py-1.5 text-sm"
          />
          <button onClick={handleAsk} disabled={asking || !question.trim()} className="btn-primary">
            {asking ? "Thinking…" : "Ask"}
          </button>
        </div>

        {askError && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{askError}</p>}

        {answer && (
          <div className="mt-4 text-sm text-slate-700 dark:text-slate-300">
            <p>{answer.answer}</p>
            {answer.citations.length > 0 && (
              <p className="text-xs text-slate-500 mt-2">Sources: {answer.citations.join(", ")}</p>
            )}
            {answer.chunks_used.length === 0 && !selectedDataset && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                No document excerpts were retrieved for this question — upload a relevant document first.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
