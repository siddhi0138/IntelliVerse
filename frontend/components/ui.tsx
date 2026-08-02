import { type ReactNode } from "react";

export function Sparkline({
  data,
  className = "",
  stroke = "var(--primary)",
  fill = "color-mix(in oklab, var(--primary) 12%, transparent)",
  height = 40,
}: {
  data: number[];
  className?: string;
  stroke?: string;
  fill?: string;
  height?: number;
}) {
  const w = 120;
  const h = height;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1 || 1);
  const pts = data.map((d, i) => [i * step, h - ((d - min) / range) * (h - 6) - 3]);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none">
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ProgressBar({
  value,
  max = 100,
  color = "bg-primary",
  hexColor,
  track = "bg-white/5",
  className = "",
}: {
  value: number;
  max?: number;
  color?: string;
  // Takes priority over `color` when set — lets callers cycle a real hex
  // palette (e.g. charts.tsx's PALETTE) instead of one Tailwind class.
  hexColor?: string;
  track?: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full ${track} ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ${hexColor ? "" : color}`}
        style={{ width: `${pct}%`, background: hexColor }}
      />
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  icon,
  spark,
  tone = "neutral",
  accentColor,
}: {
  label: string;
  value: string;
  delta?: string;
  icon?: ReactNode;
  spark?: number[];
  tone?: "up" | "down" | "neutral";
  // Optional hex color — cycles KPI cards through a real palette (see
  // charts.tsx's PALETTE) instead of every icon box defaulting to the same
  // flat --primary cyan, which is what read as "plain" across a full row.
  accentColor?: string;
}) {
  return (
    <div className="card group relative overflow-hidden p-5">
      {accentColor && <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accentColor }} />}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">{value}</p>
        </div>
        {icon && (
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${
              accentColor ? "" : "bg-primary/10 text-primary ring-1 ring-primary/20"
            }`}
            style={
              accentColor
                ? {
                    background: `color-mix(in oklab, ${accentColor} 18%, transparent)`,
                    color: accentColor,
                    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${accentColor} 30%, transparent)`,
                  }
                : undefined
            }
          >
            {icon}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        {delta && (
          <span
            className={`text-xs font-semibold ${
              tone === "up" ? "text-accent" : tone === "down" ? "text-red-400" : "text-muted"
            }`}
          >
            {delta}
          </span>
        )}
        {spark && <Sparkline data={spark} className="h-10 w-28" />}
      </div>
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            {title && <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "good" | "warn" | "bad";
}) {
  const tones: Record<string, string> = {
    neutral: "border-border bg-white/5 text-muted",
    brand: "border-primary/30 bg-primary/10 text-primary",
    good: "border-accent/30 bg-accent/10 text-accent",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    bad: "border-red-500/30 bg-red-500/10 text-red-400",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
