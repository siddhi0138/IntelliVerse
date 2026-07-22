import type { ColumnSchema } from "@/lib/types";

const TYPE_COLORS: Record<string, string> = {
  id: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  numeric: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  date: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  categorical: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  boolean: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  text: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function SchemaTable({ schema }: { schema: ColumnSchema[] }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
            <th className="px-4 py-2 font-medium">Column</th>
            <th className="px-4 py-2 font-medium">Inferred meaning</th>
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium">Unique</th>
          </tr>
        </thead>
        <tbody>
          {schema.map((col) => (
            <tr key={col.name} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
              <td className="px-4 py-2 font-mono text-xs">{col.name}</td>
              <td className="px-4 py-2">{col.semantic_label}</td>
              <td className="px-4 py-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[col.type] ?? ""}`}>
                  {col.type}
                </span>
              </td>
              <td className="px-4 py-2 text-slate-500">{String(col.stats.unique_count ?? "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
