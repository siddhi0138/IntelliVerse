export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-5 w-5 text-xs" : "h-7 w-7 text-sm";
  return (
    <span className={`relative flex ${box} items-center justify-center rounded-md bg-accent-gradient shrink-0`}>
      <span className="absolute inset-0 rounded-md bg-accent-gradient blur-md opacity-60" />
      <span className="relative leading-none">🧠</span>
    </span>
  );
}
