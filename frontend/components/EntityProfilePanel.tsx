import type { EntityProfile } from "@/lib/types";

export function EntityProfilePanel({
  profile,
  onNavigate,
}: {
  profile: EntityProfile | null;
  onNavigate: (table: string, key: string) => void;
}) {
  if (!profile) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Entity Profile</h3>
        <p className="text-sm text-slate-500">Click a node in the graph to inspect it.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        {profile.table}: {profile.key}
      </h3>

      <table className="w-full text-sm mt-2 mb-4">
        <tbody>
          {Object.entries(profile.properties).map(([k, v]) => (
            <tr key={k} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
              <td className="py-1 pr-3 text-slate-500">{k}</td>
              <td className="py-1">{String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
        Connections ({profile.neighbors.length})
      </p>
      <ul className="space-y-1">
        {profile.neighbors.map((n, i) => (
          <li key={i} className="text-sm">
            <button
              onClick={() => onNavigate(n.table, n.key)}
              className="text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {n.table}:{n.key}
            </button>{" "}
            <span className="text-xs text-slate-500">
              ({n.direction === "outgoing" ? "→" : "←"} {n.relationship})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
