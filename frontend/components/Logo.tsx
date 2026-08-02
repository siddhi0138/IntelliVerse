import { Brain } from "lucide-react";

export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span className={`glow-ring relative flex ${box} items-center justify-center rounded-xl bg-accent-gradient shrink-0`}>
      <Brain className={`${icon} text-primary-foreground`} />
      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent ring-2 ring-background" />
    </span>
  );
}
