import type { AnalyzeResponse } from "@/lib/types";

// Mirrors the same trailing-"(r=0.82)"-stripping the PDF/Excel/PPTX exports use
// (backend/report.py's _plain_headline) — the plain sentence first, stats stay
// available elsewhere for anyone who wants to verify them.
function plainHeadline(headline: string): string {
  return headline.replace(/\s*\([^()]*\)\s*$/, "").trim() || headline;
}

function qualityLine(score: number): string {
  if (score >= 90) return `Data quality looks great — a score of ${score}/100, no major issues found.`;
  if (score >= 70) return `Data quality is decent — a score of ${score}/100, worth a quick look at the Data Quality panel below.`;
  return `Data quality needs attention — a score of ${score}/100. Check the Data Quality panel below before trusting the numbers too far.`;
}

export function QuickSummaryPanel({ result }: { result: AnalyzeResponse }) {
  const bullets: string[] = [];

  bullets.push(
    `This is a ${result.domain} dataset — ${result.row_count.toLocaleString()} rows across ${result.column_count} columns.`
  );

  bullets.push(qualityLine(result.quality.score));

  if (result.ranked_findings.length > 0) {
    bullets.push(`Top finding: ${plainHeadline(result.ranked_findings[0].headline)}.`);
  } else {
    bullets.push("No strong patterns were found between columns in this dataset — that can happen with small or very clean datasets.");
  }

  if (result.risk_alerts.length > 0) {
    const alert = result.risk_alerts[0];
    bullets.push(
      alert.kind === "threshold_crossing"
        ? `⚠ Heads up: ${alert.metric} is projected to hit a critical level within ${alert.periods_until_critical} period(s).`
        : `⚠ Heads up: ${alert.metric} is projected to decline.`
    );
  }

  if (result.forecast?.trend && result.forecast.column) {
    const trendWord = result.forecast.trend === "up" ? "rising" : result.forecast.trend === "down" ? "falling" : "flat";
    bullets.push(`${result.forecast.column} is forecast to keep ${trendWord} over the next few periods.`);
  }

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-900/20 p-5">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">📋 What you got, in plain terms</h3>
      <p className="text-xs text-slate-500 mb-3">
        Built directly from the same computed numbers everything below uses — no AI involved, so it&apos;s always
        accurate and always here.
      </p>
      <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
        {bullets.map((b, i) => (
          <li key={i}>• {b}</li>
        ))}
      </ul>
      <p className="text-xs text-slate-500 mt-3">
        Scroll down for the full findings, charts, and forecast — or use <b>Ask IntelliVerse</b> to ask a specific
        question, or click <b>🧭 Take a tour</b> above for a guided walkthrough of every panel.
      </p>
    </div>
  );
}
