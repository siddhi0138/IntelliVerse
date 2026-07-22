"use client";

import { reportUrl } from "@/lib/api";

const FORMATS: { format: "pdf" | "xlsx" | "pptx"; label: string }[] = [
  { format: "pdf", label: "PDF report" },
  { format: "xlsx", label: "Excel workbook" },
  { format: "pptx", label: "PowerPoint deck" },
];

export function ReportExportPanel({ analysisId }: { analysisId: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Export report</h3>
      <p className="text-xs text-slate-500 mb-3">
        Download this analysis as a formatted report — findings, risk alerts, and forecast, no re-computation.
      </p>
      <div className="flex gap-2 flex-wrap">
        {FORMATS.map(({ format, label }) => (
          <a
            key={format}
            href={reportUrl(analysisId, format)}
            download
            className="rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium px-4 py-1.5 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}
